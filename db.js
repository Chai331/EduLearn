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
    CUSTOM_COURSES: 'eduDB_custom_courses'
  };

  /* ─── Low-level CRUD ───────────────────────────────────── */
  function readTable(key) { return JSON.parse(localStorage.getItem(key) || '[]'); }
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

  /* ─── Seed demo data ────────────────────────────────────── */
  function seed() {
    /* Users table */
    if (readTable(K.USERS).length === 0) {
      writeTable(K.USERS, [
        {
          id: 'u_seed01',
          firstName: 'Ahmad', lastName: 'Farid',
          email: 'student@edu.com',
          password: hashPw('password123'),
          programme: 'Computer Science', year: '2',
          avatar: 'A',
          avatarColor: 'linear-gradient(135deg,#667eea,#764ba2)',
          createdAt: '2025-01-15T08:00:00Z',
          role: 'student'
        },
        {
          id: 'u_admin',
          firstName: 'Admin', lastName: 'EduLearn',
          email: 'admin@edulearn.com',
          password: hashPw('admin123'),
          programme: 'Staff', year: 'N/A',
          avatar: 'A',
          avatarColor: 'linear-gradient(135deg,#ef4444,#991b1b)',
          createdAt: '2025-01-10T08:00:00Z',
          role: 'admin'
        }
      ]);
    }

    /* Enrollments table */
    if (readTable(K.ENROLLMENTS).length === 0) {
      writeTable(K.ENROLLMENTS, [
        {
          id: 'en1', userId: 'u_seed01', courseId: 'cybersec',
          courseName: 'Computer and Cyber Security',
          progress: 72, weeksTotal: 12, weeksCurrent: 8,
          completedLectures: [1, 2, 3, 4, 5], quizDone: true,
          icon: 'fa-shield-alt', color: 'linear-gradient(135deg,#1a1a2e,#16213e)'
        },
        {
          id: 'en2', userId: 'u_seed01', courseId: 'vision',
          courseName: 'Computer Vision & Image Processing',
          progress: 45, weeksTotal: 14, weeksCurrent: 6,
          completedLectures: [1, 2], quizDone: false,
          icon: 'fa-eye', color: 'linear-gradient(135deg,#0f3460,#533483)'
        },
        {
          id: 'en3', userId: 'u_seed01', courseId: 'ds',
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
        { name: 'Ahmad Farid', avatar: 'A', color: 'linear-gradient(135deg,#667eea,#764ba2)', id: 'u_seed01' },
        { name: 'Raj Kumar', avatar: 'R', color: 'linear-gradient(135deg,#43e97b,#38f9d7)', id: 'u_seed03' },
        { name: 'Siti Nurhaliza', avatar: 'S', color: 'linear-gradient(135deg,#f093fb,#f5576c)', id: 'u_seed02' },
        { name: 'Li Wei', avatar: 'L', color: 'linear-gradient(135deg,#4facfe,#00f2fe)', id: 'u_seed04' },
        { name: 'Maya Haris', avatar: 'M', color: 'linear-gradient(135deg,#fa709a,#fee140)', id: 'u_seed05' },
        { name: 'Admin EduLearn', avatar: 'A', color: 'linear-gradient(135deg,#ef4444,#991b1b)', id: 'u_admin' }
      ];

      var data = [
        // CALCULUS
        { cat: 'cal', q: 'What is the fundamental difference between a derivative and an integral?', a: 'A derivative measures the rate of change (slope), while an integral measures the accumulation (area under the curve).', u1: 1, u2: 0 },
        { cat: 'cal', q: 'When do we use the Chain Rule in differentiation?', a: 'We use the Chain Rule when differentiating composite functions (function within a function), like f(g(x)).', u1: 3, u2: 4 },
        { cat: 'cal', q: 'What does it mean for a function to be "continuous"?', a: 'A function is continuous if you can draw its graph without lifting your pencil—no holes or jumps.', u1: 0, u2: 2 },
        { cat: 'cal', q: "What is the significance of L'Hôpital's Rule?", a: "It is used to find the limits of indeterminate forms (like 0/0 or infinity/infinity) using derivatives.", u1: 4, u2: 5 },
        { cat: 'cal', q: 'How do you find the local maximum or minimum of a curve?', a: 'Find the first derivative, set it to zero for critical points, then use the second derivative test.', u1: 2, u2: 1 },
        // CYBER SECURITY
        { cat: 'security', q: 'What is the difference between Symmetric and Asymmetric encryption?', a: 'Symmetric uses one key for both. Asymmetric uses a public key to encrypt and a private key to decrypt.', u1: 1, u2: 3 },
        { cat: 'security', q: 'What is a "Man-in-the-Middle" (MitM) attack?', a: 'An attacker secretly intercepts and relays communication between two parties who think they are talking directly.', u1: 0, u2: 5 },
        { cat: 'security', q: 'Why is "Salting" a password important?', a: 'Salting adds random data to a password before hashing, preventing Rainbow Table attacks.', u1: 4, u2: 1 },
        { cat: 'security', q: 'What does the CIA Triad stand for in security?', a: 'Confidentiality (privacy), Integrity (accuracy), and Availability (accessibility).', u1: 2, u2: 0 },
        { cat: 'security', q: 'What is the difference between a Virus and a Worm?', a: 'A Virus needs human action to spread. A Worm self-replicates and spreads across networks automatically.', u1: 3, u2: 2 },
        // DATA STRUCTURES
        { cat: 'ds', q: 'When should I use a Linked List instead of an Array?', a: 'Use a Linked List if you need frequent insertions or deletions in the middle, as it avoids shifting elements.', u1: 1, u2: 4 },
        { cat: 'ds', q: 'What is "Big O" notation used for?', a: 'It describes how an algorithm\'s performance (time or space) grows as the input size increases.', u1: 5, u2: 0 },
        { cat: 'ds', q: 'How does a Stack differ from a Queue?', a: 'Stack is LIFO (Last-In, First-Out). Queue is FIFO (First-In, First-Out).', u1: 2, u2: 3 },
        { cat: 'ds', q: 'What is the advantage of a Binary Search Tree (BST)?', a: 'A BST allows for very fast searching and sorting, averaging O(log n) time.', u1: 0, u2: 1 },
        { cat: 'ds', q: 'What is Recursion?', a: 'Recursion is when a function calls itself to solve smaller pieces of a larger problem.', u1: 4, u2: 2 },
        // SOFTWARE ENGINEERING
        { cat: 'se', q: 'What is the "Agile" methodology?', a: 'An iterative approach focused on continuous feedback, flexibility, and frequent small releases.', u1: 3, u2: 5 },
        { cat: 'se', q: 'What is the purpose of Unit Testing?', a: 'To test individual components in isolation to ensure they work correctly before integration.', u1: 0, u2: 4 },
        { cat: 'se', q: 'What is "Technical Debt"?', a: 'The future cost of rework caused by choosing an easy "quick fix" now instead of a robust solution.', u1: 1, u2: 2 },
        { cat: 'se', q: 'What is a "Version Control System" (like Git)?', a: 'A tool that tracks changes to code over time, allowing multiple developers to collaborate.', u1: 5, u2: 3 },
        { cat: 'se', q: 'What is the difference between Front-end and Back-end?', a: 'Front-end is what users see (UI). Back-end is the logic, database, and server behind the scenes.', u1: 2, u2: 0 },
        // COMPUTER VISION
        { cat: 'vision', q: 'What is "Image Segmentation"?', a: 'Partitioning an image into segments to make it easier to analyze, like separating objects from background.', u1: 4, u2: 1 },
        { cat: 'vision', q: 'How does a "Grayscale" conversion work?', a: 'It converts color (RGB) to shades of gray by calculating a weighted average of pixel intensities.', u1: 1, u2: 5 },
        { cat: 'vision', q: 'What is the purpose of the "Sobel Operator"?', a: 'It is used for edge detection by calculating the intensity gradient at each pixel.', u1: 0, u2: 3 },
        { cat: 'vision', q: 'What is "OCR" (Optical Character Recognition)?', a: 'Technology that converts text within images (like scanned docs) into machine-readable text.', u1: 5, u2: 4 },
        { cat: 'vision', q: 'What is a "Convolutional Neural Network" (CNN)?', a: 'A deep learning model specifically designed to process and recognize pixel data/images.', u1: 2, u2: 0 }
      ];

      var seededPosts = data.map(function (item, index) {
        var u1 = seedUsers[item.u1];
        var u2 = seedUsers[item.u2];
        var postId = 'fp_seed_' + index;
        return {
          id: postId, userId: u1.id, author: u1.name, avatar: u1.avatar, avatarColor: u1.color,
          category: item.cat, title: item.q, content: 'I am looking for a clear explanation for this. Can someone help?',
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

    var user = {
      id: uid(),
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
    var books = readTable(K.CUSTOM_BOOKS).filter(function(b) { return b.id !== id; });
    writeTable(K.CUSTOM_BOOKS, books);
  }

  /* ─── ADMIN: CUSTOM COURSES ─────────────────────────────── */
  function addCustomCourseMaterial(courseId, material) {
    var courses = readTable(K.CUSTOM_COURSES);
    if (!courses[courseId]) courses[courseId] = { lectures: [], tutorials: [] };
    material.id = uid();
    material.createdAt = new Date().toISOString();
    courses[courseId][material.tab].push(material); // tab is 'lectures' or 'tutorials'
    writeTable(K.CUSTOM_COURSES, courses);
    return material;
  }
  function getCustomCourseMaterials() { return readTable(K.CUSTOM_COURSES); }
  function deleteCustomCourseMaterial(courseId, tab, materialId) {
    var courses = readTable(K.CUSTOM_COURSES);
    if (courses[courseId] && courses[courseId][tab]) {
      courses[courseId][tab] = courses[courseId][tab].filter(function(m) { return m.id !== materialId; });
      writeTable(K.CUSTOM_COURSES, courses);
    }
  }

  /* ─── Initialisation ────────────────────────────────────── */
  seed();   // populate demo data on first run

  /* ─── Public API ─────────────────────────────────────────── */
  return {
    /* Auth */
    register: register,
    login: login,
    logout: logout,
    getSession: getSession,
    isLoggedIn: isLoggedIn,
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
    /* Utils */
    ago: ago
  };
})();
