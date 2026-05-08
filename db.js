/*!
 * ============================================================
 *  EduLearn – localStorage Database Simulation
 *  Simulates MySQL / MongoDB for local file deployment
 *
 *  Tables (keys in localStorage):
 *    eduDB_users        – registered user accounts
 *    eduDB_session      – current logged-in user
 *    eduDB_enrollments  – course enrolments per user
 *    eduDB_posts        – forum posts
 *    eduDB_orders       – bookstore purchase orders
 *    eduCart            – shopping cart items
 * ============================================================
 */
window.EduDB = (function () {
  'use strict';

  /* ─── Table keys ───────────────────────────────────────── */
  var K = {
    USERS: 'eduDB_users',
    SESSION: 'eduDB_session',
    ENROLLMENTS: 'eduDB_enrollments',
    POSTS: 'eduDB_posts_real',
    ORDERS: 'eduDB_orders',
    ACTIVITY: 'eduDB_activity',
    CART: 'eduCart',
    PURCHASED: 'eduDB_purchased',
    CUSTOM_BOOKS: 'eduDB_custom_books',
    CUSTOM_COURSES: 'eduDB_custom_courses',
    SAVED_RESOURCES: 'eduDB_saved_resources',
    RESET_REQUESTS: 'eduDB_reset_reqs'
  };

  /* ─── Low-level CRUD ───────────────────────────────────── */
  function readTable(key, defaultVal) {
    return JSON.parse(localStorage.getItem(key) || (defaultVal || '[]'));
  }
  function readOne(key) { return JSON.parse(localStorage.getItem(key) || 'null'); }
  function writeTable(k, v) { localStorage.setItem(k, JSON.stringify(v)); }

  /* ─── Utilities ─────────────────────────────────────────── */
  /** Simple password obfuscation (demo only – NOT production secure) */
  function hashPw(pw) {
    return btoa(unescape(encodeURIComponent(pw + '_edu2025_salt')));
  }

  /** Generate a random unique ID */
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /** Human-readable time difference */
  function ago(iso) {
    var s = Math.floor((Date.now() - new Date(iso)) / 1000);
    if (s < 60) return 'Just now';
    if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    return Math.floor(s / 86400) + 'd ago';
  }

  /* ─── Firebase Cloud Sync Layer ─────────────────────────── */
  var _fb = {
    db: null, ready: false,
    init: function () {
      try {
        if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
          this.db = firebase.firestore(); this.ready = true;
          console.log('EduDB: Firestore connected ✓');
        }
      } catch (e) { console.warn('EduDB: Firebase unavailable.'); }
    },
    saveUser: function (user) {
      if (!this.ready) return;
      this.db.collection('users').doc(user.id).set(JSON.parse(JSON.stringify(user)))
        .catch(function (e) { console.warn('saveUser:', e); });
    },
    saveUserData: function (userId) {
      if (!this.ready) return;
      var enr = readTable(K.ENROLLMENTS).filter(function (e) { return e.userId === userId; });
      var pRec = readTable(K.PURCHASED).find(function (r) { return r.userId === userId; });
      var ords = readTable(K.ORDERS).filter(function (o) { return o.userId === userId; });
      this.db.collection('userData').doc(userId).set({
        enrollments: enr, purchased: pRec ? pRec.books : [], orders: ords,
        updatedAt: new Date().toISOString()
      }).catch(function (e) { console.warn('saveUserData:', e); });
    },
    syncUserData: function (userId, callback) {
      if (!this.ready) { if (callback) callback(false); return; }
      this.db.collection('userData').doc(userId).get().then(function (doc) {
        if (doc.exists) {
          var data = doc.data();
          if (data.enrollments && data.enrollments.length > 0) {
            var lEnr = readTable(K.ENROLLMENTS);
            data.enrollments.forEach(function (ce) {
              var i = lEnr.findIndex(function (le) { return le.id === ce.id; });
              if (i === -1) lEnr.push(ce); else if (ce.progress >= lEnr[i].progress) lEnr[i] = ce;
            });
            writeTable(K.ENROLLMENTS, lEnr);
          }
          if (data.purchased && data.purchased.length > 0) {
            var allP = readTable(K.PURCHASED);
            var rec = allP.find(function (r) { return r.userId === userId; });
            if (!rec) allP.push({ userId: userId, books: data.purchased });
            else data.purchased.forEach(function (b) { if (rec.books.indexOf(b) === -1) rec.books.push(b); });
            writeTable(K.PURCHASED, allP);
          }
          if (data.orders && data.orders.length > 0) {
            var lOrds = readTable(K.ORDERS);
            data.orders.forEach(function (co) {
              if (!lOrds.some(function (lo) { return lo.id === co.id; })) lOrds.unshift(co);
            });
            writeTable(K.ORDERS, lOrds);
          }
        }
        if (callback) callback(true);
      }).catch(function (e) { console.warn('syncUserData:', e); if (callback) callback(false); });
    },
    fetchUserByEmail: function (email, callback) {
      if (!this.ready) { callback(null); return; }
      this.db.collection('users').where('email', '==', email.toLowerCase().trim()).get()
        .then(function (snap) { callback(snap.empty ? null : snap.docs[0].data()); })
        .catch(function () { callback(null); });
    },
    savePosts: function () {
      if (!this.ready) return;
      this.db.collection('appData').doc('forumPosts')
        .set({ posts: readTable(K.POSTS), updatedAt: new Date().toISOString() })
        .catch(function (e) { console.warn('savePosts:', e); });
    },
    loadPosts: function (callback) {
      if (!this.ready) { if (callback) callback(false); return; }
      this.db.collection('appData').doc('forumPosts').get().then(function (doc) {
        if (doc.exists && doc.data().posts) {
          var cp = doc.data().posts, lp = readTable(K.POSTS);
          cp.forEach(function (c) {
            var i = lp.findIndex(function (l) { return l.id === c.id; });
            if (i === -1) lp.push(c); else if (c.replies >= lp[i].replies) lp[i] = c;
          });
          writeTable(K.POSTS, lp);
        }
        if (callback) callback(true);
      }).catch(function () { if (callback) callback(false); });
    }
  };

  /* Cross-device login: fetches user from Firestore, caches locally, then logs in */
  function loginFromCloud(email, password, callback) {
    _fb.fetchUserByEmail(email, function (cloudUser) {
      if (!cloudUser) { callback({ success: false, message: 'No account found with that email.' }); return; }
      var users = readTable(K.USERS);
      if (!users.some(function (u) { return u.email === cloudUser.email; })) {
        users.push(cloudUser); writeTable(K.USERS, users);
      }
      var result = login(email, password);
      if (result.success) _fb.syncUserData(cloudUser.id, function () { callback(result); });
      else callback(result);
    });
  }

  function syncFromCloud(userId, cb) { _fb.syncUserData(userId, cb); }
  function loadPostsFromCloud(cb) { _fb.loadPosts(cb); }

  /* ─── Seed demo data ────────────────────────────────────── */
  function seed() {
    // ─── ONE-TIME MIGRATION TO SEQUENTIAL IDs ───
    (function migrateToEduIds() {
      try {
        var users = readTable(K.USERS);
        var enrollments = readTable(K.ENROLLMENTS);
        var posts = readTable(K.POSTS);
        var orders = readTable(K.ORDERS);
        var activity = readTable(K.ACTIVITY);
        var purchased = readTable(K.PURCHASED);
        var saved = readTable(K.SAVED_RESOURCES);
        
        var needsMigration = users.some(function(u) { 
          return u && u.role === 'student' && u.id && !u.id.startsWith('edu_'); 
        });

        if (!needsMigration) return;

        var idMap = {};
        var nextNum = 1;

        // Map existing students to new IDs
        users.forEach(function(u) {
          if (!u) return;
          if (u.role === 'student' && u.id && !u.id.startsWith('edu_')) {
            var ns = String(nextNum);
            while(ns.length < 4) ns = '0' + ns; 
            var newId = 'edu_' + ns;
            idMap[u.id] = newId;
            u.id = newId;
            nextNum++;
          } else if (u.id && u.id.startsWith('edu_')) {
            var num = parseInt(u.id.split('_')[1]);
            if (!isNaN(num) && num >= nextNum) nextNum = num + 1;
          }
        });

        // Update all references
        function updateRef(obj, key) { if (obj && obj[key] && idMap[obj[key]]) obj[key] = idMap[obj[key]]; }

        if (Array.isArray(enrollments)) enrollments.forEach(function(e) { updateRef(e, 'userId'); });
        if (Array.isArray(orders)) orders.forEach(function(o) { updateRef(o, 'userId'); });
        if (Array.isArray(activity)) activity.forEach(function(a) { updateRef(a, 'userId'); });
        if (Array.isArray(purchased)) purchased.forEach(function(p) { updateRef(p, 'userId'); });
        if (Array.isArray(saved)) saved.forEach(function(s) { updateRef(s, 'userId'); });
        
        if (Array.isArray(posts)) posts.forEach(function(p) {
          if (!p) return;
          updateRef(p, 'userId');
          if (Array.isArray(p.likes)) p.likes = p.likes.map(function(l) { return idMap[l] || l; });
          if (Array.isArray(p.replyData)) {
            p.replyData.forEach(function(r) {
              if (!r) return;
              updateRef(r, 'userId');
              if (Array.isArray(r.likes)) r.likes = r.likes.map(function(l) { return idMap[l] || l; });
            });
          }
        });

        writeTable(K.USERS, users);
        writeTable(K.ENROLLMENTS, enrollments);
        writeTable(K.POSTS, posts);
        writeTable(K.ORDERS, orders);
        writeTable(K.ACTIVITY, activity);
        writeTable(K.PURCHASED, purchased);
        writeTable(K.SAVED_RESOURCES, saved);

        console.log('EduDB: Migration to sequential IDs complete ✓');
      } catch (err) {
        console.error('EduDB: Migration failed:', err);
      }
    })();

    // ─── ONE-TIME CLEANUP FOR AHMAD FARID ───
    (function cleanupOldSeed() {
      var users = readTable(K.USERS);
      var enrollments = readTable(K.ENROLLMENTS);
      var posts = readTable(K.POSTS);
      var changed = false;

      // Remove Ahmad from users
      var newUsers = users.filter(function (u) { return (u.firstName !== 'Ahmad' || u.lastName !== 'Farid') && u.id !== 'u_seed01'; });
      if (newUsers.length !== users.length) { writeTable(K.USERS, newUsers); changed = true; }

      // Remove Ahmad from enrollments
      var newEnrol = enrollments.filter(function (e) { return e.userId !== 'u_seed01' && e.userId !== 'edu_0001' && !e.userId.startsWith('u_seed'); });
      // Keep some seed enrollments if they are mapped
      if (newEnrol.length !== enrollments.length) { writeTable(K.ENROLLMENTS, newEnrol); changed = true; }

      // Remove Ahmad from posts
      var newPosts = posts.filter(function (p) { return p.author !== 'Ahmad Farid'; });
      if (newPosts.length !== posts.length) { writeTable(K.POSTS, newPosts); changed = true; }

      if (changed) { console.log('EduDB: Seed cleanup complete.'); }
    })();

    /* Users table - seed the admin account */
    var existingUsers = readTable(K.USERS);
    var hasAdmin = existingUsers.some(function (u) { return u.role === 'admin'; });
    if (!hasAdmin) {
      existingUsers = existingUsers.filter(function (u) { return u.role !== 'admin'; });
      existingUsers.push({
        id: 'u_admin',
        firstName: 'Admin', lastName: 'EduLearn',
        email: 'admin@edulearn.com',
        password: hashPw('admin123'),
        programme: 'Administration', year: 'N/A',
        avatar: 'A',
        avatarColor: 'linear-gradient(135deg,#ef4444,#991b1b)',
        createdAt: '2025-01-01T08:00:00Z',
        role: 'admin'
      });
      writeTable(K.USERS, existingUsers);
    }

    /* Enrollments table */
    if (readTable(K.ENROLLMENTS).length === 0) {
      writeTable(K.ENROLLMENTS, [
        {
          id: 'en2', userId: 'u_seed02', courseId: 'vision',
          courseName: 'Computer Vision & Image Processing',
          progress: 45, weeksTotal: 14, weeksCurrent: 6,
          completedLectures: [1, 2], quizDone: false,
          icon: 'fa-eye', color: 'linear-gradient(135deg,#0f3460,#533483)'
        },
        {
          id: 'en3', userId: 'u_seed03', courseId: 'ds',
          courseName: 'Introduction to Data Structures',
          progress: 88, weeksTotal: 10, weeksCurrent: 9,
          completedLectures: [1, 2, 3, 4, 5, 6], quizDone: true,
          icon: 'fa-sitemap', color: 'linear-gradient(135deg,#1b4332,#2d6a4f)'
        }
      ]);
    }

    /* Forum posts table - Seeded with 25 real Q&A sets */
    if (readTable(K.POSTS).length === 0) {
      var seedUsers = [
        { name: 'Raj Kumar', avatar: 'R', color: 'linear-gradient(135deg,#43e97b,#38f9d7)', id: 'edu_0001' },
        { name: 'Siti Nurhaliza', avatar: 'S', color: 'linear-gradient(135deg,#f093fb,#f5576c)', id: 'edu_0002' },
        { name: 'Li Wei', avatar: 'L', color: 'linear-gradient(135deg,#4facfe,#00f2fe)', id: 'edu_0003' },
        { name: 'Maya Haris', avatar: 'M', color: 'linear-gradient(135deg,#fa709a,#fee140)', id: 'edu_0004' },
        { name: 'Loh Mun Yee', avatar: 'L', color: 'linear-gradient(135deg,#f093fb,#f5576c)', id: 'edu_0005' },
        { name: 'Edu Support', avatar: 'E', color: 'linear-gradient(135deg,#ef4444,#991b1b)', id: 'admin' }
      ];

      var data = [
        // CALCULUS
        { cat: 'cal', q: 'What is the fundamental difference between a derivative and an integral?', d: 'I am trying to wrap my head around these two concepts. Are they opposites?', a: 'Yes! They are inverses. A derivative measures the rate of change, while an integral measures the accumulation.', u1: 0, u2: 4 },
        { cat: 'cal', q: 'When do we use the Chain Rule in differentiation?', d: 'The formula in the textbook is a bit confusing. Can anyone simplify it?', a: 'Use it when you have a function inside another. Think of it as "outside derivative times inside derivative."', u1: 2, u2: 3 },
        { cat: 'cal', q: 'What does it mean for a function to be "continuous"?', d: 'Does every smooth graph have to be continuous at every point?', a: 'A function is continuous if you can draw its graph without lifting your pencil—no holes, jumps, or gaps.', u1: 4, u2: 1 },
        { cat: 'cal', q: "What is the significance of L'Hôpital's Rule?", d: 'When exactly should we stop applying it in a limit problem?', a: "Use it for 0/0 or inf/inf. Stop when the limit is no longer indeterminate or becomes easy to solve.", u1: 3, u2: 4 },
        { cat: 'cal', q: 'How do you find the local maximum or minimum of a curve?', d: 'I am working on an optimization problem and need a quick refresher.', a: 'Find where the first derivative is zero (critical points), then use the second derivative to check concavity.', u1: 1, u2: 0 },
        // CYBER SECURITY
        { cat: 'security', q: 'What is the difference between Symmetric and Asymmetric encryption?', d: 'Which one is generally faster for encrypting large database files?', a: 'Symmetric is much faster. Asymmetric is usually used for small bits of data like exchanging keys.', u1: 0, u2: 2 },
        { cat: 'security', q: 'What is a "Man-in-the-Middle" (MitM) attack?', d: 'Is using public Wi-Fi at a coffee shop really as dangerous as they say?', a: 'Yes! Attackers can intercept your traffic. Always use a VPN or stick to HTTPS websites.', u1: 4, u2: 4 },
        { cat: 'security', q: 'Why is "Salting" a password important?', d: 'Why not just use a really long password instead of salting?', a: 'Salting prevents Rainbow Table attacks. Even long passwords can be cracked if the hash is leaked without salt.', u1: 3, u2: 0 },
        { cat: 'security', q: 'What does the CIA Triad stand for in security?', d: 'How do we balance availability and confidentiality without breaking the system?', a: 'It is a balancing act. Confidentiality protects data, Integrity ensures accuracy, and Availability ensures access.', u1: 1, u2: 4 },
        { cat: 'security', q: 'What is the difference between a Virus and a Worm?', d: 'My laptop is acting weird. How can I tell which one might be infecting it?', a: 'Worms spread by themselves over the network. Viruses need you to open a file. Both are bad!', u1: 2, u2: 1 },
        // DATA STRUCTURES
        { cat: 'ds', q: 'When should I use a Linked List instead of an Array?', d: 'My professor mentioned memory allocation. Is it true arrays are always faster?', a: 'Arrays are faster for access, but Linked Lists are faster for adding/removing items in the middle.', u1: 0, u2: 3 },
        { cat: 'ds', q: 'What is "Big O" notation used for?', d: 'I keep getting confused between O(n) and O(log n) performance.', a: 'It measures how slow an algorithm gets as data grows. O(log n) is much better for large datasets.', u1: 4, u2: 4 },
        { cat: 'ds', q: 'How does a Stack differ from a Queue?', d: 'Can someone give me a real-world example of each structure in action?', a: 'Stack is like a stack of plates (Last-In-First-Out). Queue is like a line at a store (First-In-First-Out).', u1: 1, u2: 2 },
        { cat: 'ds', q: 'What is the advantage of a Binary Search Tree (BST)?', d: 'What happens to the search speed if the tree becomes completely unbalanced?', a: 'Unbalanced trees become slow (O(n)). Balanced BSTs are very fast for searching (O(log n)).', u1: 4, u2: 0 },
        { cat: 'ds', q: 'What is Recursion?', d: 'I am worried about hitting a "stack overflow" error in my code.', a: 'Recursion is a function calling itself. Always ensure you have a "base case" to stop the loop!', u1: 3, u2: 1 },
        // SOFTWARE ENGINEERING
        { cat: 'se', q: 'What is the "Agile" methodology?', d: 'How is it actually different from the old Waterfall model in practice?', a: 'Agile is about small steps and constant feedback. Waterfall is about doing everything in one big shot.', u1: 2, u2: 4 },
        { cat: 'se', q: 'What is the purpose of Unit Testing?', d: 'Is it worth the extra time to write tests for small functions?', a: 'Yes! It prevents bugs later. It is much cheaper to fix a bug in a test than in production.', u1: 4, u2: 3 },
        { cat: 'se', q: 'What is "Technical Debt"?', d: 'Our team is rushing to meet a deadline. Should we worry about technical debt?', a: 'You can ignore it for a while, but eventually it slows you down. It is like a loan you have to pay back.', u1: 0, u2: 1 },
        { cat: 'se', q: 'What is a "Version Control System" (like Git)?', d: 'Why should I use Git instead of just zipping my project files?', a: 'Git lets you see exactly what changed, revert mistakes, and collaborate with others easily.', u1: 5, u2: 3 },
        { cat: 'se', q: 'What is the difference between Front-end and Back-end?', d: 'Which side usually handles user authentication and database logic?', a: 'The Back-end handles the "brains" (data/security), while the Front-end handles the "face" (UI).', u1: 2, u2: 0 },
        // COMPUTER VISION
        { cat: 'vision', q: 'What is "Image Segmentation"?', d: 'I am trying to isolate a car from a busy street photo. Any tips?', a: 'Segmentation labels every pixel. You can use edge detection or color thresholding to start.', u1: 4, u2: 1 },
        { cat: 'vision', q: 'How does a "Grayscale" conversion work?', d: 'Does it lose any important data during the conversion from RGB?', a: 'It loses color info, but keeps brightness. It makes processing much faster for many algorithms.', u1: 1, u2: 5 },
        { cat: 'vision', q: 'What is the purpose of the "Sobel Operator"?', d: 'Are there any better operators for detecting edges in noisy images?', a: 'Sobel is great for simple edges. For noisy images, Canny edge detection is usually better.', u1: 0, u2: 3 },
        { cat: 'vision', q: 'What is "OCR" (Optical Character Recognition)?', d: 'Can it read messy handwriting as well as clean printed text?', a: 'Printed text is easy. Messy handwriting is very hard and usually requires deep learning (AI).', u1: 5, u2: 4 },
        { cat: 'vision', q: 'What is a "Convolutional Neural Network" (CNN)?', d: 'Why are they better than regular neural networks for processing images?', a: 'They "see" patterns like edges and shapes directly, which makes them very accurate for image tasks.', u1: 2, u2: 0 }
      ];

      var seededPosts = data.map(function (item, index) {
        var u1 = seedUsers[item.u1];
        var u2 = seedUsers[item.u2];
        var postId = 'fp_seed_' + index;
        return {
          id: postId, userId: u1.id, author: u1.name, avatar: u1.avatar, avatarColor: u1.color,
          category: item.cat, title: item.q, content: item.d,
          replies: 1, views: Math.floor(Math.random() * 200) + 50, likes: [u2.id], solved: true,
          createdAt: new Date(Date.now() - (index * 3600000)).toISOString(),
          replyData: [
            {
              id: 'rp_seed_' + index, userId: u2.id, author: u2.name, avatar: u2.avatar, avatarColor: u2.color,
              content: item.a, likes: [u1.id], createdAt: new Date(Date.now() - (index * 3000000)).toISOString()
            }
          ]
        };
      });

      writeTable(K.POSTS, seededPosts);
    }

    /* Activity table */
    if (readTable(K.ACTIVITY).length === 0) {
      writeTable(K.ACTIVITY, [
        {
          id: uid(), userId: 'u_seed01', type: 'lecture',
          text: 'Watched: "Functions and Domain" – Calculus Week 1',
          icon: 'fa-play-circle', bg: '#f0f2ff', iclr: '#667eea',
          createdAt: new Date(Date.now() - 3600000 * 2).toISOString()
        },
        {
          id: uid(), userId: 'u_seed01', type: 'quiz',
          text: 'Completed Quiz: Data Structures – Foundation (Score: 90%)',
          icon: 'fa-check-circle', bg: '#d1fae5', iclr: '#10b981',
          createdAt: new Date(Date.now() - 86400000).toISOString()
        }
      ]);
    }
  }

  /* ─── AUTH ──────────────────────────────────────────────── */

  /**
   * Register a new user.
   * @param {Object} d – {firstName, lastName, email, password, programme, year}
   * @returns {Object} {success, message, user?}
   */
  function register(d) {
    if (!d.firstName || !d.email || !d.password)
      return { success: false, message: 'Please fill in all required fields.' };
    if (d.password.length < 8)
      return { success: false, message: 'Password must be at least 8 characters.' };
    if (d.password !== d.confirm)
      return { success: false, message: 'Passwords do not match.' };
    if (d.email.toLowerCase().trim() === 'admin@edulearn.com')
      return { success: false, message: 'This email is reserved for system administrators.' };

    var users = readTable(K.USERS);
    if (users.some(function (u) { return u.email.toLowerCase() === d.email.toLowerCase().trim(); }))
      return { success: false, message: 'This email is already registered.' };

    var nextNum = 1;
    users.forEach(function(u) {
      if (u.id.startsWith('edu_')) {
        var num = parseInt(u.id.split('_')[1]);
        if (!isNaN(num) && num >= nextNum) nextNum = num + 1;
      }
    });
    var ns = String(nextNum);
    while(ns.length < 4) ns = '0' + ns; 
    var eduId = 'edu_' + ns;

    var user = {
      id: eduId,
      firstName: d.firstName.trim(),
      lastName: (d.lastName || '').trim(),
      email: d.email.toLowerCase().trim(),
      password: hashPw(d.password),
      programme: d.programme || 'Computer Science',
      year: d.year || '1',
      avatar: d.firstName.charAt(0).toUpperCase(),
      avatarColor: 'linear-gradient(135deg,#667eea,#764ba2)',
      createdAt: new Date().toISOString(),
      role: 'student'
    };
    users.push(user);
    writeTable(K.USERS, users);
    _fb.saveUser(user);
    return { success: true, message: 'Account created successfully!', user: user };
  }

  /**
   * Log in with email & password.
   * @returns {Object} {success, message, user?}
   */
  function login(email, password) {
    var users = readTable(K.USERS);
    var user = users.find(function (u) {
      return u.email.toLowerCase() === email.toLowerCase().trim();
    });
    if (!user)
      return { success: false, message: 'No account found with that email.' };
    if (user.password !== hashPw(password))
      return { success: false, message: 'Incorrect password. Please try again.' };

    var session = {
      id: user.id, firstName: user.firstName, lastName: user.lastName,
      email: user.email, programme: user.programme,
      avatar: user.avatar, avatarColor: user.avatarColor,
      role: user.role || 'student'
    };
    writeTable(K.SESSION, session);
    return { success: true, message: 'Login successful!', user: session };
  }

  /** Update user profile data */
  function updateUserProfile(userId, data) {
    var users = readTable(K.USERS);
    var userIdx = users.findIndex(function (u) { return u.id === userId; });
    if (userIdx === -1) return { success: false, message: 'User not found.' };

    users[userIdx].firstName = data.firstName || users[userIdx].firstName;
    users[userIdx].lastName = data.lastName || users[userIdx].lastName;
    users[userIdx].email = data.email || users[userIdx].email;
    users[userIdx].avatar = users[userIdx].firstName.charAt(0).toUpperCase();

    writeTable(K.USERS, users);

    // Update session
    var sess = getSession();
    if (sess && sess.id === userId) {
      sess.firstName = users[userIdx].firstName;
      sess.lastName = users[userIdx].lastName;
      sess.email = users[userIdx].email;
      sess.avatar = users[userIdx].avatar;
      writeTable(K.SESSION, sess);
    }
    return { success: true, message: 'Profile updated.' };
  }

  /** Change user password with old password verification */
  function updateUserPassword(userId, oldPass, newPass) {
    var users = readTable(K.USERS);
    var userIdx = users.findIndex(function (u) { return u.id === userId; });
    if (userIdx === -1) return { success: false, message: 'User not found.' };

    if (users[userIdx].password !== hashPw(oldPass)) {
      return { success: false, message: 'Incorrect old password.' };
    }
    if (newPass.length < 8) {
      return { success: false, message: 'New password must be at least 8 characters.' };
    }

    users[userIdx].password = hashPw(newPass);
    writeTable(K.USERS, users);
    return { success: true, message: 'Password changed successfully.' };
  }

  /** Log out the current user. */
  function logout() { localStorage.removeItem(K.SESSION); }

  /** Return the current session object, or null. */
  function getSession() { return readOne(K.SESSION); }

  /** Return true if a user is logged in. */
  function isLoggedIn() { return getSession() !== null; }

  /* ─── ENROLLMENTS ───────────────────────────────────────── */

  function getUserEnrollments(userId) {
    return readTable(K.ENROLLMENTS).filter(function (e) { return e.userId === userId; });
  }

  function enrol(userId, courseId, courseName, icon, color) {
    var enr = readTable(K.ENROLLMENTS);
    if (enr.some(function (e) { return e.userId === userId && e.courseId === courseId; }))
      return { success: false, message: 'Already enrolled in this course.' };
    enr.push({
      id: uid(), userId: userId, courseId: courseId,
      courseName: courseName, progress: 0,
      weeksTotal: 12, weeksCurrent: 0,
      completedLectures: [], completedQuizzes: [],
      icon: icon, color: color
    });
    writeTable(K.ENROLLMENTS, enr);
    _fb.saveUserData(userId);
    return { success: true, message: 'Successfully enrolled!' };
  }

  function updateProgress(enrollmentId, progress, weeksCurrent) {
    var enr = readTable(K.ENROLLMENTS);
    enr.forEach(function (e) {
      if (e.id === enrollmentId) {
        e.progress = progress;
        e.weeksCurrent = weeksCurrent;
      }
    });
    writeTable(K.ENROLLMENTS, enr);
  }

  function markLectureRead(userId, courseId, week, lectureTitle, totalLecs, totalQuiz) {
    var enr = readTable(K.ENROLLMENTS);
    var enrollment = enr.find(function (e) { return e.userId === userId && e.courseId === courseId; });
    if (!enrollment) return;

    if (!enrollment.completedLectures) enrollment.completedLectures = [];
    if (enrollment.completedLectures.indexOf(week) === -1) {
      enrollment.completedLectures.push(week);

      var doneLecs = enrollment.completedLectures.length;
      var doneQuizzes = (enrollment.completedQuizzes || []).length;
      var totalItems = (totalLecs || 5) + (totalQuiz || 5);

      enrollment.progress = Math.min(100, Math.round(((doneLecs + doneQuizzes) / totalItems) * 100));
      if (enrollment.weeksCurrent < week) enrollment.weeksCurrent = week;

      writeTable(K.ENROLLMENTS, enr);
      _fb.saveUserData(userId);
      logActivity(userId, 'lecture', 'Watched: "' + lectureTitle + '" – ' + enrollment.courseName + ' Week ' + week, 'fa-play-circle', '#f0f2ff', '#667eea');
    }
  }

  function markQuizDone(userId, courseId, quizIndex, score, total, totalLecs, totalQuiz) {
    var enr = readTable(K.ENROLLMENTS);
    var enrollment = enr.find(function (e) { return e.userId === userId && e.courseId === courseId; });
    if (!enrollment) return;

    if (!enrollment.completedQuizzes) enrollment.completedQuizzes = [];
    if (enrollment.completedQuizzes.indexOf(quizIndex) === -1) {
      enrollment.completedQuizzes.push(quizIndex);

      var doneLecs = (enrollment.completedLectures || []).length;
      var doneQuizzes = enrollment.completedQuizzes.length;
      var totalItems = (totalLecs || 5) + (totalQuiz || 5);

      enrollment.progress = Math.min(100, Math.round(((doneLecs + doneQuizzes) / totalItems) * 100));
      writeTable(K.ENROLLMENTS, enr);
      _fb.saveUserData(userId);
      logActivity(userId, 'quiz', 'Completed Quiz ' + quizIndex + ': ' + enrollment.courseName + ' (Score: ' + score + '/' + total + ')', 'fa-check-circle', '#d1fae5', '#10b981');
    }
  }

  function logActivity(userId, type, text, icon, bg, iclr) {
    var acts = readTable(K.ACTIVITY);
    acts.unshift({
      id: uid(), userId: userId, type: type, text: text, icon: icon, bg: bg, iclr: iclr, createdAt: new Date().toISOString()
    });
    if (acts.length > 20) acts.pop(); // keep last 20
    writeTable(K.ACTIVITY, acts);
  }

  function getActivityLog(userId) {
    return readTable(K.ACTIVITY).filter(function (a) { return a.userId === userId; });
  }

  /* ─── FORUM ─────────────────────────────────────────────── */

  function getAllPosts() { return readTable(K.POSTS); }

  function addPost(sess, category, title, content) {
    var posts = readTable(K.POSTS);
    var post = {
      id: uid(),
      userId: sess.id,
      author: (sess.firstName + ' ' + (sess.lastName || '')).trim(),
      avatar: sess.avatar,
      avatarColor: sess.avatarColor || 'linear-gradient(135deg,#667eea,#764ba2)',
      category: category,
      title: title,
      content: content,
      replies: 0,
      replyData: [],
      views: 1,
      likes: [],
      createdAt: new Date().toISOString(),
      solved: false
    };
    posts.unshift(post);
    writeTable(K.POSTS, posts);
    _fb.savePosts();
    return post;
  }

  function addReply(postId, sess, content) {
    var posts = readTable(K.POSTS);
    var post = posts.find(function (p) { return p.id === postId; });
    if (!post) return null;

    if (!post.replyData) post.replyData = [];
    var reply = {
      id: uid(),
      userId: sess.id,
      author: (sess.firstName + ' ' + (sess.lastName || '')).trim(),
      avatar: sess.avatar,
      avatarColor: sess.avatarColor || 'linear-gradient(135deg,#667eea,#764ba2)',
      content: content,
      likes: [],
      createdAt: new Date().toISOString()
    };
    post.replyData.push(reply);
    post.replies = post.replyData.length;

    writeTable(K.POSTS, posts);
    _fb.savePosts();
    return post;
  }

  function togglePostLike(postId, userId) {
    var posts = readTable(K.POSTS);
    var post = posts.find(function (p) { return p.id === postId; });
    if (!post) return null;

    if (!post.likes) post.likes = [];
    var idx = post.likes.indexOf(userId);
    if (idx === -1) post.likes.push(userId);
    else post.likes.splice(idx, 1);

    writeTable(K.POSTS, posts);
    return post;
  }

  function toggleReplyLike(postId, replyId, userId) {
    var posts = readTable(K.POSTS);
    var post = posts.find(function (p) { return p.id === postId; });
    if (!post) return null;

    var reply = post.replyData.find(function (r) { return r.id === replyId; });
    if (!reply) return null;

    if (!reply.likes) reply.likes = [];
    var idx = reply.likes.indexOf(userId);
    if (idx === -1) reply.likes.push(userId);
    else reply.likes.splice(idx, 1);

    writeTable(K.POSTS, posts);
    return post;
  }

  function deletePost(postId, userId, userRole) {
    var posts = readTable(K.POSTS);
    var post = posts.find(function (p) { return p.id === postId; });
    if (!post) return false;

    // Allow deletion if owner OR admin
    if (post.userId === userId || userRole === 'admin') {
      posts = posts.filter(function (p) { return p.id !== postId; });
      writeTable(K.POSTS, posts);
      return true;
    }
    return false;
  }

  /* ─── ORDERS ────────────────────────────────────────────── */

  function addOrder(userId, items, total) {
    var orders = readTable(K.ORDERS);
    var order = {
      id: uid(),
      userId: userId,
      items: items,
      total: total,
      status: 'Completed',
      orderNum: Math.floor(Math.random() * 900000 + 100000),
      createdAt: new Date().toISOString()
    };
    orders.unshift(order);
    writeTable(K.ORDERS, orders);
    _fb.saveUserData(userId);
    return order;
  }

  function getUserOrders(userId) {
    return readTable(K.ORDERS).filter(function (o) { return o.userId === userId; });
  }

  /* ─── PURCHASED BOOKS ──────────────────────────────────── */

  /**
   * Save the names of books a user has purchased.
   * @param {string} userId
   * @param {Array}  items  – cart items [{name, price, qty}, ...]
   */
  function addPurchasedBooks(userId, items) {
    var all = readTable(K.PURCHASED);
    var record = all.find(function (r) { return r.userId === userId; });
    if (!record) {
      record = { userId: userId, books: [] };
      all.push(record);
    }
    items.forEach(function (item) {
      if (record.books.indexOf(item.name) === -1) {
        record.books.push(item.name);
      }
    });
    writeTable(K.PURCHASED, all);
    _fb.saveUserData(userId);
  }

  /**
   * Return the array of book names purchased by a user.
   * @param {string} userId
   * @returns {Array<string>}
   */
  function getPurchasedBooks(userId) {
    var all = readTable(K.PURCHASED);
    var record = all.find(function (r) { return r.userId === userId; });
    return record ? record.books : [];
  }

  /* ─── CART ──────────────────────────────────────────────── */
  function getCart() { return readTable(K.CART); }
  function saveCart(c) { writeTable(K.CART, c); }
  function clearCart() { localStorage.removeItem(K.CART); }

  /* ─── ADMIN: CUSTOM BOOKS ───────────────────────────────── */
  function addCustomBook(book) {
    var books = readTable(K.CUSTOM_BOOKS);
    book.id = uid();
    book.createdAt = new Date().toISOString();
    books.push(book);
    writeTable(K.CUSTOM_BOOKS, books);
    return book;
  }
  function getCustomBooks() { return readTable(K.CUSTOM_BOOKS); }
  function deleteCustomBook(id) {
    var books = readTable(K.CUSTOM_BOOKS).filter(function (b) { return b.id !== id; });
    writeTable(K.CUSTOM_BOOKS, books);
  }

  /* ─── ADMIN: CUSTOM COURSES ─────────────────────────────── */
  function addCustomCourseMaterial(courseId, material) {
    var courses = readTable(K.CUSTOM_COURSES, '{}');
    if (!courses[courseId]) courses[courseId] = { lectures: [], tutorials: [] };
    material.id = uid();
    material.createdAt = new Date().toISOString();
    courses[courseId][material.tab].push(material); // tab is 'lectures' or 'tutorials'
    writeTable(K.CUSTOM_COURSES, courses);
    return material;
  }
  function getCustomCourseMaterials() { return readTable(K.CUSTOM_COURSES, '{}'); }
  function deleteCustomCourseMaterial(courseId, tab, materialId) {
    var courses = readTable(K.CUSTOM_COURSES, '{}');
    if (courses[courseId] && courses[courseId][tab]) {
      courses[courseId][tab] = courses[courseId][tab].filter(function (m) { return m.id !== materialId; });
      writeTable(K.CUSTOM_COURSES, courses);
    }
  }

  /* ─── ADMIN: MONITORING ────────────────────────────────── */
  function getAllUsers() { return readTable(K.USERS); }
  function getAllEnrollments() { return readTable(K.ENROLLMENTS); }
  function getAllOrders() {
    var orders = readTable(K.ORDERS);
    var valid = orders.filter(function (o) { return o.items && o.items.length > 0; });
    if (valid.length !== orders.length) writeTable(K.ORDERS, valid);
    return valid;
  }

  function deleteOrder(orderId) {
    var orders = readTable(K.ORDERS);
    var filtered = orders.filter(function (o) { return o.id !== orderId; });
    writeTable(K.ORDERS, filtered);
  }
  function getAllForumPosts() { return readTable(K.POSTS); }

  /* ─── SAVED RESOURCES ───────────────────────────────────── */
  function toggleSavedResource(userId, res) {
    var all = readTable(K.SAVED_RESOURCES, '{}');
    if (!all[userId]) all[userId] = [];

    var idx = all[userId].findIndex(function (item) { return item.file === res.file; });
    if (idx === -1) {
      res.savedAt = new Date().toISOString();
      all[userId].push(res);
      writeTable(K.SAVED_RESOURCES, all);
      return { success: true, action: 'saved' };
    } else {
      all[userId].splice(idx, 1);
      writeTable(K.SAVED_RESOURCES, all);
      return { success: true, action: 'removed' };
    }
  }

  function getSavedResources(userId) {
    var all = readTable(K.SAVED_RESOURCES, '{}');
    return all[userId] || [];
  }
  function isResourceSaved(userId, file) {
    var all = readTable(K.SAVED_RESOURCES, '{}');
    if (!all[userId]) return false;
    return all[userId].some(function (item) { return item.file === file; });
  }

  /* ─── PASSWORD RESETS ───────────────────────────────────── */
  function requestPasswordReset(email) {
    if (!email) return { success: false, message: 'Please enter your email address.' };
    email = email.toLowerCase().trim();
    var users = readTable(K.USERS);
    if (!users.some(function(u) { return u.email === email; })) {
      return { success: true, message: 'If this email exists, a notification has been sent.' };
    }
    var reqs = readTable(K.RESET_REQUESTS);
    if (reqs.some(function(r) { return r.email === email && r.status === 'pending'; })) {
      return { success: true, message: 'A reset request is already pending for this email.' };
    }
    reqs.push({
      id: 'req_' + uid(),
      email: email,
      createdAt: new Date().toISOString(),
      status: 'pending'
    });
    writeTable(K.RESET_REQUESTS, reqs);
    return { success: true, message: 'Notification sent to Admin. Please wait for an admin to assist you.' };
  }

  function getResetRequests() {
    return readTable(K.RESET_REQUESTS).filter(function(r) { return r.status === 'pending'; });
  }

  function resolveResetRequest(reqId, newPassword) {
    var reqs = readTable(K.RESET_REQUESTS);
    var rIdx = reqs.findIndex(function(r) { return r.id === reqId; });
    if (rIdx === -1) return false;
    
    var users = readTable(K.USERS);
    var uIdx = users.findIndex(function(u) { return u.email === reqs[rIdx].email; });
    if (uIdx !== -1) {
      users[uIdx].password = hashPw(newPassword);
      writeTable(K.USERS, users);
    }
    
    reqs[rIdx].status = 'resolved';
    writeTable(K.RESET_REQUESTS, reqs);
    return true;
  }

  /* ─── Initialisation ────────────────────────────────────── */
  seed();              // populate demo data on first run
  _fb.init();          // connect to Firebase Firestore

  /* ─── Public API ─────────────────────────────────────────── */
  return {
    /* Auth */
    register: register,
    login: login,
    logout: logout,
    getSession: getSession,
    isLoggedIn: isLoggedIn,
    updateUserProfile: updateUserProfile,
    updateUserPassword: updateUserPassword,
    /* Enrollments */
    getUserEnrollments: getUserEnrollments,
    enrol: enrol,
    updateProgress: updateProgress,
    markLectureRead: markLectureRead,
    markQuizDone: markQuizDone,
    getActivityLog: getActivityLog,
    /* Forum */
    getAllPosts: getAllPosts,
    addPost: addPost,
    addReply: addReply,
    togglePostLike: togglePostLike,
    toggleReplyLike: toggleReplyLike,
    deletePost: deletePost,
    /* Orders */
    addOrder: addOrder,
    getUserOrders: getUserOrders,
    /* Purchased Books */
    addPurchasedBooks: addPurchasedBooks,
    getPurchasedBooks: getPurchasedBooks,
    /* Cart */
    getCart: getCart,
    saveCart: saveCart,
    clearCart: clearCart,
    /* Admin */
    addCustomBook: addCustomBook,
    getCustomBooks: getCustomBooks,
    deleteCustomBook: deleteCustomBook,
    addCustomCourseMaterial: addCustomCourseMaterial,
    getCustomCourseMaterials: getCustomCourseMaterials,
    deleteCustomCourseMaterial: deleteCustomCourseMaterial,
    /* Admin Monitoring */
    getAllUsers: getAllUsers,
    getAllEnrollments: getAllEnrollments,
    getAllOrders: getAllOrders,
    deleteOrder: deleteOrder,
    getAllForumPosts: getAllForumPosts,
    /* Saved Resources */
    toggleSavedResource: toggleSavedResource,
    getSavedResources: getSavedResources,
    isResourceSaved: isResourceSaved,
    /* Password Resets */
    requestPasswordReset: requestPasswordReset,
    getResetRequests: getResetRequests,
    resolveResetRequest: resolveResetRequest,
    /* Utils */
    ago: ago,
    /* Cloud Sync */
    loginFromCloud: loginFromCloud,
    syncFromCloud: syncFromCloud,
    loadPostsFromCloud: loadPostsFromCloud
  };
})();