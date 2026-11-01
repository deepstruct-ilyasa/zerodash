const express = require('express');
const router = express.Router();
const db = require('../config/database');

// 1. Ambil Semua Data Router
router.get('/', (req, res) => {
  if (req.session && req.session.role === 'read_only') {
    return res.json({ success: true, data: [] }); // Kirim data kosong
  }
  
  db.all('SELECT * FROM routers ORDER BY id DESC', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
    res.json({ success: true, data: rows });
  });
});

// 2. Tambah Router Baru
router.post('/add', (req, res) => {
  const { name, host, protocol, port, username, password, description } = req.body;
  
  if (!name || !host || !username || !password) {
    return res.status(400).json({ success: false, message: 'Nama, Host, Username, dan Password wajib diisi!' });
  }

  const query = `INSERT INTO routers (name, host, protocol, port, username, password, description) VALUES (?, ?, ?, ?, ?, ?, ?)`;
  db.run(query, [name, host, protocol, port, username, password, description || ''], function(err) {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
    res.json({ success: true, message: 'Router berhasil ditambahkan ke Master Data!', id: this.lastID });
  });
});

// 3. Edit / Update Router
router.post('/update', (req, res) => {
  const { id, name, host, protocol, port, username, password, description } = req.body;

  const query = `UPDATE routers SET name = ?, host = ?, protocol = ?, port = ?, username = ?, password = ?, description = ? WHERE id = ?`;
  db.run(query, [name, host, protocol, port, username, password, description, id], function(err) {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
    res.json({ success: true, message: 'Router berhasil diperbarui!' });
  });
});

// 4. Hapus Router
router.post('/delete', (req, res) => {
  const { id } = req.body;
  db.run(`DELETE FROM routers WHERE id = ?`, [id], function(err) {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
    res.json({ success: true, message: 'Router berhasil dihapus dari Master Data!' });
  });
});

module.exports = router;