const axios = require('axios');
const https = require('https');
const http = require('http');
const { RouterOSAPI } = require('node-routeros');
require('dotenv').config();
const db = require('./database');

// MONKEYPATCH: Cegah node-routeros crash saat menerima balasan '!empty' dari RouterOS v7
try {
  const ChannelModule = require('node-routeros/dist/Channel');
  const ChannelClass = ChannelModule.Channel || ChannelModule.default || ChannelModule;
  if (ChannelClass && ChannelClass.prototype && ChannelClass.prototype.onUnknown) {
    const originalOnUnknown = ChannelClass.prototype.onUnknown;
    ChannelClass.prototype.onUnknown = function (reply) {
      if (reply === '!empty' || (reply && reply.reply === '!empty')) return;
      return originalOnUnknown.apply(this, arguments);
    };
  }
} catch (e) {}

// Ambil config dari SQLite secara dinamis
const getConfig = () => {
  return new Promise((resolve) => {
    db.get(`SELECT * FROM controller_settings ORDER BY id DESC LIMIT 1`, (err, row) => {
      if (err || !row) {
        const protoEnv = (process.env.ROUTEROS_PROTOCOL || 'WWW-SSL').toUpperCase();
        resolve({
          protocol: protoEnv,
          host: process.env.ROUTEROS_HOST,
          port: parseInt(process.env.ROUTEROS_PORT) || (protoEnv === 'API-SSL' ? 8729 : protoEnv === 'API' ? 8728 : 443),
          username: process.env.ROUTEROS_USER,
          password: process.env.ROUTEROS_PASSWORD
        });
      } else {
        const protoDb = (row.protocol || 'WWW-SSL').toUpperCase();
        resolve({
          protocol: protoDb,
          host: row.host,
          port: parseInt(row.port) || (protoDb === 'API-SSL' ? 8729 : protoDb === 'API' ? 8728 : 443),
          username: row.username,
          password: row.password
        });
      }
    });
  });
};

const getProtocol = async () => {
  const config = await getConfig();
  return config.protocol;
};

// =====================================
// ADAPTER REST API (Selalu membaca config terbaru)
// =====================================
const restRequest = async (method, path, data = null) => {
  const configData = await getConfig();
  const isSsl = configData.protocol === 'WWW-SSL';
  const scheme = isSsl ? 'https' : 'http';
  const agent = isSsl ? new https.Agent({ rejectUnauthorized: false }) : new http.Agent();

  const config = {
    method,
    url: `${scheme}://${configData.host}:${configData.port}/rest${path}`,
    auth: { username: configData.username, password: configData.password },
    headers: { 'Content-Type': 'application/json' },
    timeout: 5000,
    httpsAgent: agent,
    httpAgent: agent
  };

  if (data) config.data = data;
  const res = await axios(config);
  return res.data;
};

// =====================================
// ADAPTER SOCKET API (Auto-Reconnect)
// =====================================
let socketClient = null;
let activeConfigStr = ''; // Pelacak hash/string config untuk deteksi perubahan

const getSocketMenu = async () => {
  const configData = await getConfig();
  const newConfigStr = JSON.stringify(configData);

  // Jika ada pengaturan yang diubah (Host, Port, User, atau Password), putus koneksi lama!
  if (socketClient && activeConfigStr !== newConfigStr) {
    console.log('🔄 Deteksi perubahan kredensial. Memulai ulang koneksi Socket...');
    socketClient.close();
    socketClient = null;
  }

  if (!socketClient) {
    activeConfigStr = newConfigStr;
    socketClient = new RouterOSAPI({
      host: configData.host,
      user: configData.username,
      password: configData.password,
      port: configData.port,
      timeout: 15,
      tls: configData.protocol === 'API-SSL',
      rejectUnauthorized: false
    });

    socketClient.on('error', (err) => {
      if (err.errno !== 'UNKNOWNREPLY') console.error('RouterOS Socket Error:', err.message || err);
    });
  }

  if (!socketClient.connected) {
    await socketClient.connect();
  }

  return socketClient;
};

const parseBoolean = (val) => {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') return val.toLowerCase() === 'true' || val.toLowerCase() === 'yes';
  return false;
};

module.exports = { getProtocol, restRequest, getSocketMenu, parseBoolean };