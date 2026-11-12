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
app.use('/', authRoutes);

// ==========================================
// 3. MIDDLEWARE PROTEKSI GLOBAL
// ==========================================
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
// Posisikan topologyRoute agar endpoint /api/topology/positions terbaca sempurna
app.use('/api', topologyRoute(db));
app.use('/api', apiRoutes);
app.use('/api/remote', remoteApi);
app.use('/api/master-routers', routerMaster);
app.use('/api/users', userRoutes);

// ==========================================
// TAMBAHAN ENDPOINT LIVE DATA UNTUK CYTOSCAPE AUTO-REFRESH
// ==========================================
app.get('/api/overview/live-data', requireAuth, async (req, res) => {
  try {
    const routerId = req.session.routerId;
    
    // Mengambil cache data aktif yang sedang berjalan di background server
    res.json({
      success: true,
      networks: global.activeNetworksCache?.[routerId] || [],
      members: global.activeMembersCache?.[routerId] || [],
      peers: global.activePeersCache?.[routerId] || [],
      trafficData: global.trafficStats || {}
    });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// Rute Halaman Dashboard Utama
app.get('/', (req, res) => {
  res.render('index', { currentUser: req.session });
});

// ==========================================
// BACKGROUND TRAFFIC FLOW LISTENER (DYNAMIC SUBNET)
// ==========================================
const dgram = require('dgram');

global.trafficStats = {}; 
let rawTrafficCache = {}; 
let validMemberIps = new Set(); 

const udpServer = dgram.createSocket('udp4');

udpServer.on('error', (err) => {
    console.error(`Traffic Flow UDP Error:\n${err.stack}`);
    udpServer.close();
});

global.updateValidMemberIps = function(memberList) {
    validMemberIps.clear();
    (memberList || []).forEach(m => {
        const ip = (m['ip-address'] || m.ip || '').trim();
        if (ip) validMemberIps.add(ip);
    });
};

udpServer.on('message', (msg, rinfo) => {
    try {
        const version = msg.readUInt16BE(0);
        const count = msg.readUInt16BE(2);

        if (version === 5) {
            for (let i = 0; i < count; i++) {
                const offset = 24 + (i * 48);
                if (offset + 48 <= msg.length) {
                    const srcIp = [msg[offset], msg[offset+1], msg[offset+2], msg[offset+3]].join('.');
                    const dstIp = [msg[offset+4], msg[offset+5], msg[offset+6], msg[offset+7]].join('.');
                    const bytes = msg.readUInt32BE(offset + 16);

                    if (dstIp.endsWith('.255') || dstIp === '255.255.255.255') continue;

                    if (validMemberIps.size === 0 || validMemberIps.has(srcIp)) {
                        if (!rawTrafficCache[srcIp]) rawTrafficCache[srcIp] = { upload: 0, download: 0 };
                        rawTrafficCache[srcIp].upload += bytes;
                    }

                    if (validMemberIps.size === 0 || validMemberIps.has(dstIp)) {
                        if (!rawTrafficCache[dstIp]) rawTrafficCache[dstIp] = { upload: 0, download: 0 };
                        rawTrafficCache[dstIp].download += bytes;
                    }
                }
            }
        }
    } catch (e) {
        console.error('❌ Error parsing NetFlow packet:', e.message);
    }
});

function formatBandwidth(bytes) {
    const bps = (bytes * 8) / 5; 
    if (bps === 0) return '0 Kbps';
    if (bps < 1000) return bps.toFixed(1) + ' bps';
    if (bps < 1000000) return (bps / 1000).toFixed(2) + ' Kbps';
    return (bps / 1000000).toFixed(2) + ' Mbps';
}

setInterval(() => {
    const freshTrafficStats = {}; 
    
    const ips = Object.keys(rawTrafficCache);
    ips.forEach(ip => {
        freshTrafficStats[ip] = {
            uploadRaw: rawTrafficCache[ip].upload,
            downloadRaw: rawTrafficCache[ip].upload,
            uploadFormatted: formatBandwidth(rawTrafficCache[ip].upload),
            downloadFormatted: formatBandwidth(rawTrafficCache[ip].download)
        };
    });
    
    global.trafficStats = freshTrafficStats; 
    rawTrafficCache = {}; 
}, 5000);

udpServer.bind(2055, () => {
    console.log(`📡 Traffic Flow Listener aktif di UDP Port 2055 (Mode Dinamis)`);
});

// ==========================================
// 6. SERVER LISTENER
// ==========================================
app.listen(PORT, () => {
  console.log(`================================================`);
  console.log(`🚀 ZeroTier Controller Dashboard Running!`);
  console.log(`📡 URL : http://localhost:${PORT}`);
  console.log(`================================================`);
});