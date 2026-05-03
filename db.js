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

    /* Forum posts table - Now starts empty for real messages */
    if (readTable(K.POSTS).length === 0) {
      writeTable(K.POSTS, []);
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
