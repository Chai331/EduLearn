// firebase-config.js
// Uses Firebase 10 Compat SDK – works in plain HTML without a bundler.
// Must be loaded AFTER Firebase CDN scripts and BEFORE db.js.

(function () {
  var firebaseConfig = {
    apiKey: "AIzaSyAexZdwGHd6UTmxZtCxDZ8k7UvBbP45DAA",
    authDomain: "edulearn-40023.firebaseapp.com",
    projectId: "edulearn-40023",
    storageBucket: "edulearn-40023.firebasestorage.app",
    messagingSenderId: "751727683540",
    appId: "1:751727683540:web:2ffcee4abf03703644d841"
  };

  try {
    if (typeof firebase !== 'undefined' && !firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
  } catch (e) {
    console.warn('Firebase init failed:', e.message);
  }
})();
