const express = require('express');
const path = require('path');
require('dotenv').config();

// Modul Auth & Session
const session = require('express-session');
const { requireAuth, requireAdmin, readOnlyGuard } = require('./middleware/auth');
const authRoutes = require('./routes/auth');

const db = require('./config/database');

// Modul API Routes
const topologyRoute = require('./routes/topology');
const apiRoutes = require('./routes/api');
const remoteApi = require('./routes/remoteApi');
const routerMaster = require('./routes/routerMaster');
const userRoutes = require('./routes/users');

const app = express();
const PORT = process.env.PORT || 3100;

// Setup Template Engine EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Parsing Body & Folder Static
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/lucide', express.static(path.join(__dirname, 'node_modules/lucide/dist')));

// ==========================================
// 1. SETUP SESSION
// ==========================================
app.use(session({
  secret: process.env.SESSION_SECRET || 'zerodash-super-secret-key', // Bisa diganti lewat .env
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false, // Set ke true jika di-hosting menggunakan HTTPS
    maxAge: 24 * 60 * 60 * 1000 // Berlaku 24 jam
  }
}));

// ==========================================
// 2. PUBLIC ROUTES (Tanpa Login)
// ==========================================
// Mengatur rute /login dan /logout (tidak boleh diproteksi agar user bisa masuk)
app.use('/', authRoutes);

// ==========================================
// 3. MIDDLEWARE PROTEKSI GLOBAL
// ==========================================
// Semua rute di bawah baris ini otomatis diblokir jika user belum login
app.use(requireAuth);

app.use((req, res, next) => {
  if (req.path === '/remote/fetch-data' || req.path === '/api/remote/fetch-data') {
    return next(); // Izinkan user read-only melakukan fetch data
  }
  return readOnlyGuard(req, res, next);
});

// ==========================================
// 4. PRIVATE / PROTECTED ROUTES
// ==========================================
// Rute API Backend
app.use(topologyRoute(db));
app.use('/api', apiRoutes);
app.use('/api/remote', remoteApi);
app.use('/api/master-routers', routerMaster);
app.use('/api/users', userRoutes);

// Rute Halaman Dashboard Utama
app.get('/', (req, res) => {
  res.render('index', { currentUser: req.session });
});

// ==========================================
// 5. SERVER LISTENER
// ==========================================
app.listen(PORT, () => {
  console.log(`================================================`);
  console.log(`🚀 ZeroTier Controller Dashboard Running!`);
  console.log(`📡 URL : http://localhost:${PORT}`);
  console.log(`================================================`);
});