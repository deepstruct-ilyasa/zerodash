const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Gagal terhubung ke SQLite:', err.message);
  } else {
    console.log('✅ Berhasil terhubung ke database SQLite.');
  }
});

db.serialize(() => {
  // Tabel master routers (sudah ada)
  db.run(`
    CREATE TABLE IF NOT EXISTS routers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      host TEXT NOT NULL,
      protocol TEXT NOT NULL,
      port INTEGER NOT NULL,
      username TEXT NOT NULL,
      password TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT (datetime('now', 'localtime'))
    )
  `, (err) => {
    if (err) console.error('Gagal membuat tabel routers:', err.message);
    else console.log('📌 Tabel master_routers siap digunakan.');
  });

  // TAMBAHAN: Tabel Controller Settings
  db.run(`
    CREATE TABLE IF NOT EXISTS controller_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      host TEXT NOT NULL,
      port TEXT NOT NULL,
      protocol TEXT NOT NULL,
      username TEXT NOT NULL,
      password TEXT NOT NULL,
      updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
    )
  `, (err) => {
    if (err) console.error('Gagal membuat tabel controller_settings:', err.message);
    else console.log('📌 Tabel controller_settings siap digunakan.');
  });

  // TAMBAHAN: Tabel Users untuk Login & Roles
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'read_only',
      created_at DATETIME DEFAULT (datetime('now', 'localtime'))
    )
  `, (err) => {
    if (err) console.error('Gagal membuat tabel users:', err.message);
    else {
      console.log('📌 Tabel users siap digunakan.');
      // Buat default admin otomatis jika tabel masih kosong
      db.get(`SELECT COUNT(*) as count FROM users`, (err, row) => {
        if (row && row.count === 0) {
          const bcrypt = require('bcryptjs');
          const hash = bcrypt.hashSync('admin123', 10);
          db.run(
            `INSERT INTO users (username, password, role) VALUES (?, ?, ?)`, 
            ['admin', hash, 'admin']
          );
          console.log('✅ Default Admin dibuat! (User: admin, Pass: admin123)');
        }
      });
    }
  });

  db.run(`CREATE TABLE IF NOT EXISTS topology_positions (
      node_id TEXT PRIMARY KEY,
      x REAL,
      y REAL
  )`, (err) => {
    if (err) {
      console.error('❌ Gagal membuat tabel topology_positions:', err.message);
    } else {
      console.log('📌 Tabel topology_positions siap digunakan.');
    }
  });
});

module.exports = db;