const express = require('express');
const router = express.Router();
const controllerService = require('../services/controllerService');
const db = require('../config/database');
const { requireAuth, requireAdmin, readOnlyGuard } = require('../middleware/auth');

const handleRequest = async (res, action) => {
  try {
    const data = await action();
    res.json({ success: true, data });
  } catch (error) {
    console.error('RouterOS API Error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      message: error.response?.data?.detail || error.message || 'Gagal berkomunikasi dengan RouterOS'
    });
  }
};

// ==========================================
// ENDPOINT SETTINGS CONTROLLER (SQLITE)
// ==========================================
router.get('/settings/controller', requireAuth, (req, res) => {
  db.get(`SELECT * FROM controller_settings ORDER BY id DESC LIMIT 1`, (err, row) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    const data = row || { host: '', port: '8728', protocol: 'API', username: '', password: '' };
    res.json({ success: true, data });
  });
});

router.post('/settings/controller', requireAuth, requireAdmin, (req, res) => {
  const { host, port, protocol, username, password } = req.body;
  
  if (!host || !username) {
    return res.status(400).json({ success: false, message: 'Host dan Username wajib diisi.' });
  }

  db.serialize(() => {
    db.run(`DELETE FROM controller_settings`);
    db.run(
      `INSERT INTO controller_settings (host, port, protocol, username, password) VALUES (?, ?, ?, ?, ?)`,
      [host, port, protocol, username, password],
      function (err) {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, message: 'Kredensial Controller berhasil disimpan ke database!' });
      }
    );
  });
});

// ==========================================
// INTERFACE ENDPOINTS
// ==========================================
router.get('/router/interfaces', requireAuth, (req, res) => {
  handleRequest(res, () => controllerService.getInterfaces());
});

// ==========================================
// INSTANCES ENDPOINTS (FULL CRUD)
// ==========================================
router.get('/controller/instances', requireAuth, (req, res) => {
  handleRequest(res, () => controllerService.getInstances());
});

router.post('/controller/instances', requireAuth, requireAdmin, (req, res) => {
  handleRequest(res, () => controllerService.addInstance(req.body));
});

router.patch('/controller/instances/:id', requireAuth, requireAdmin, (req, res) => {
  handleRequest(res, () => controllerService.updateInstance(req.params.id, req.body));
});

router.delete('/controller/instances/:id', requireAuth, requireAdmin, (req, res) => {
  handleRequest(res, () => controllerService.deleteInstance(req.params.id));
});

// Networks Endpoints (Full CRUD)
router.get('/controller/networks', (req, res) => {
  handleRequest(res, () => controllerService.getNetworks());
});

router.post('/controller/networks', (req, res) => {
  handleRequest(res, () => controllerService.addNetwork(req.body));
});

router.patch('/controller/networks/:id', (req, res) => {
  handleRequest(res, () => controllerService.updateNetwork(req.params.id, req.body));
});

router.delete('/controller/networks/:id', (req, res) => {
  handleRequest(res, () => controllerService.deleteNetwork(req.params.id));
});

// ==========================================
// MEMBERS ENDPOINTS (DENGAN DINAMIS IP SYNC)
// ==========================================
router.get('/controller/members', (req, res) => {
  handleRequest(res, async () => {
    const members = await controllerService.getMembers();
    
    // Sinkronkan IP member secara otomatis agar Traffic Flow membaca IP real-time
    if (typeof global.updateValidMemberIps === 'function') {
      global.updateValidMemberIps(members);
    }
    
    return members;
  });
});

router.post('/controller/members', (req, res) => {
  handleRequest(res, () => controllerService.addMember(req.body));
});

router.patch('/controller/members/:id', (req, res) => {
  handleRequest(res, () => controllerService.updateMember(req.params.id, req.body));
});

router.delete('/controller/members/:id', (req, res) => {
  handleRequest(res, () => controllerService.deleteMember(req.params.id));
});

// Peers Endpoints (Latency & Path)
router.get('/controller/peers', requireAuth, (req, res) => {
  handleRequest(res, () => controllerService.getPeers());
});

// ==========================================
// ENDPOINT TRAFFIC FLOW SETTINGS & TARGETS
// ==========================================
router.get('/router/traffic-flow', requireAuth, (req, res) => {
  handleRequest(res, () => controllerService.getTrafficFlow());
});

router.post('/router/traffic-flow', requireAuth, requireAdmin, (req, res) => {
  handleRequest(res, () => controllerService.setTrafficFlow(req.body));
});

router.get('/router/traffic-flow/targets', requireAuth, (req, res) => {
  handleRequest(res, () => controllerService.getTrafficFlowTargets());
});

router.post('/router/traffic-flow/targets', requireAuth, requireAdmin, (req, res) => {
  handleRequest(res, () => controllerService.saveTrafficFlowTarget(req.body));
});

router.delete('/router/traffic-flow/targets/:id', requireAuth, requireAdmin, (req, res) => {
  handleRequest(res, () => controllerService.deleteTrafficFlowTarget(req.params.id));
});

// ==========================================
// ENDPOINT TRAFFIC FLOW STATS
// ==========================================
router.get('/controller/traffic-stats', requireAuth, (req, res) => {
  res.json({
    success: true,
    data: global.trafficStats || {}
  });
});

module.exports = router;