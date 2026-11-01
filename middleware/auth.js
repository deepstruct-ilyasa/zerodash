const requireAuth = (req, res, next) => {
  if (req.session && req.session.userId) {
    res.locals.currentUser = req.session; 
    return next();
  }
  if (req.xhr || req.headers.accept.indexOf('json') > -1) {
    return res.status(401).json({ success: false, message: 'Silakan login kembali.' });
  }
  res.redirect('/login');
};

const requireAdmin = (req, res, next) => {
  if (req.session && req.session.role === 'admin') return next();
  return res.status(403).json({ success: false, message: 'Akses Ditolak: Khusus Administrator.' });
};

// Satpam pelindung Read-Only secara global
const readOnlyGuard = (req, res, next) => {
  if (req.session && req.session.role === 'read_only') {
    // Blokir semua aksi modifikasi data (Create, Update, Delete)
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      return res.status(403).json({ success: false, message: 'Akses Ditolak: Anda login dengan akses Read-Only.' });
    }
  }
  next();
};

module.exports = { requireAuth, requireAdmin, readOnlyGuard };