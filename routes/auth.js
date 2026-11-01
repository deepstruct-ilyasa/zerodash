const express = require('express');
const router = express.Router();
const db = require('../config/database');
const bcrypt = require('bcryptjs');

// Tampilkan Halaman Login
router.get('/login', (req, res) => {
  if (req.session.userId) return res.redirect('/');
  res.render('login', { error: null });
});

// Proses Login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, user) => {
    if (err || !user) {
      return res.render('login', { error: 'Username atau password salah!' });
    }

    const isValid = bcrypt.compareSync(password, user.password);
    if (!isValid) {
      return res.render('login', { error: 'Username atau password salah!' });
    }

    // Set Session jika berhasil
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.role = user.role;
    
    res.redirect('/');
  });
});

// Proses Logout
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

module.exports = router;