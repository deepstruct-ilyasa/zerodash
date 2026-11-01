const express = require('express');
const router = express.Router();
const db = require('../config/database');
const bcrypt = require('bcryptjs');
const { requireAuth, requireAdmin } = require('../middleware/auth');

router.use(requireAuth, requireAdmin);

// Ambil semua data user (Kecuali passwordnya)
router.get('/', (req, res) => {
  db.all(`SELECT id, username, role, created_at FROM users ORDER BY id ASC`, [], (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json({ success: true, data: rows });
  });
});

// Tambah User Baru
router.post('/', (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password) return res.status(400).json({ success: false, message: 'Username & Password wajib diisi!' });

  const hash = bcrypt.hashSync(password, 10);
  db.run(`INSERT INTO users (username, password, role) VALUES (?, ?, ?)`, [username, hash, role || 'read_only'], function(err) {
    if (err) return res.status(500).json({ success: false, message: 'Username mungkin sudah digunakan.' });
    res.json({ success: true, message: 'User berhasil ditambahkan!' });
  });
});

// Edit User
router.patch('/:id', (req, res) => {
  const { username, password, role } = req.body;
  const id = req.params.id;

  if (password) {
    const hash = bcrypt.hashSync(password, 10);
    db.run(`UPDATE users SET username = ?, password = ?, role = ? WHERE id = ?`, [username, hash, role, id], err => {
      if (err) return res.status(500).json({ success: false, message: err.message });
      res.json({ success: true, message: 'User & Password berhasil diperbarui!' });
    });
  } else {
    db.run(`UPDATE users SET username = ?, role = ? WHERE id = ?`, [username, role, id], err => {
      if (err) return res.status(500).json({ success: false, message: err.message });
      res.json({ success: true, message: 'Data User berhasil diperbarui!' });
    });
  }
});

// Hapus User
router.delete('/:id', (req, res) => {
  if (req.params.id == req.session.userId) return res.status(400).json({ success: false, message: 'Tidak dapat menghapus akun Anda sendiri saat sedang login!' });
  
  db.run(`DELETE FROM users WHERE id = ?`, [req.params.id], err => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json({ success: true, message: 'User berhasil dihapus!' });
  });
});

module.exports = router;