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
// BACKGROUND TRAFFIC FLOW LISTENER (DYNAMIC SUBNET)
// ==========================================
const dgram = require('dgram');

global.trafficStats = {}; 
let rawTrafficCache = {}; 
// Cache daftar IP valid milik member yang didapat dari router secara berkala
let validMemberIps = new Set(); 

const udpServer = dgram.createSocket('udp4');

udpServer.on('error', (err) => {
    console.error(`Traffic Flow UDP Error:\n${err.stack}`);
    udpServer.close();
});

// Fungsi bantu untuk mendaftarkan IP member secara dinamis dari file rute lain atau API
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

        console.log(`📥 NetFlow Versi: ${version}, Jumlah Record: ${count}`);

        if (version === 5) {
            for (let i = 0; i < count; i++) {
                const offset = 24 + (i * 48);
                if (offset + 48 <= msg.length) {
                    const srcIp = [msg[offset], msg[offset+1], msg[offset+2], msg[offset+3]].join('.');
                    const dstIp = [msg[offset+4], msg[offset+5], msg[offset+6], msg[offset+7]].join('.');
                    const bytes = msg.readUInt32BE(offset + 16);

                    console.log(`   🔍 Flow Record [${i+1}] -> Src: ${srcIp} | Dst: ${dstIp} | Bytes: ${bytes}`);

                    if (dstIp.endsWith('.255') || dstIp === '255.255.255.255') continue;

                    // Cek apakah terdaftar di validMemberIps, atau untuk sementara kita tampung semua IP yang masuk dulu
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
        } else {
            console.log(`⚠️ Peringatan: MikroTik mengirim NetFlow Versi ${version}, tetapi parser memproses Versi 5!`);
        }
    } catch (e) {
        console.error('❌ Error parsing NetFlow packet:', e.message);
    }
});

function formatBandwidth(bytes) {
    const bps = (bytes * 8) / 5; 
    if (bps === 0) return '0 Kbps';
    if (bps < 1000) return bps.toFixed(1) + ' bps'; // Tampilkan bps jika kecil
    if (bps < 1000000) return (bps / 1000).toFixed(2) + ' Kbps';
    return (bps / 1000000).toFixed(2) + ' Mbps';
}

setInterval(() => {
    const ips = Object.keys(rawTrafficCache);
    ips.forEach(ip => {
        global.trafficStats[ip] = {
            uploadRaw: rawTrafficCache[ip].upload,
            downloadRaw: rawTrafficCache[ip].download,
            uploadFormatted: formatBandwidth(rawTrafficCache[ip].upload),
            downloadFormatted: formatBandwidth(rawTrafficCache[ip].download)
        };
    });
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