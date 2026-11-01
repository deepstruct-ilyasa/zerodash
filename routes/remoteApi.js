const express = require('express');
const router = express.Router();
const axios = require('axios');
const https = require('https');
const http = require('http');
const { RouterOSAPI } = require('node-routeros');

// MONKEYPATCH: Cegah node-routeros crash pada tag aneh RouterOS v7
try {
  const ReceiverModule = require('node-routeros/dist/connector/Receiver');
  const ReceiverClass = ReceiverModule.Receiver || ReceiverModule.default || ReceiverModule;
  if (ReceiverClass && ReceiverClass.prototype && ReceiverClass.prototype.sendTagData) {
    const originalSendTagData = ReceiverClass.prototype.sendTagData;
    ReceiverClass.prototype.sendTagData = function (tag, value) {
      try {
        return originalSendTagData.call(this, tag, value);
      } catch (e) {
        if (e.errno === 'UNREGISTEREDTAG' || e.message?.includes('unregistered tag')) {
          if (this.currentSentence) {
            this.currentSentence[tag.replace(/^=/, '')] = value;
          }
          return;
        }
        throw e;
      }
    };
  }
} catch (e) {}

try {
  const ChannelModule = require('node-routeros/dist/Channel');
  const ChannelClass = ChannelModule.Channel || ChannelModule.default || ChannelModule;
  if (ChannelClass && ChannelClass.prototype && ChannelClass.prototype.onUnknown) {
    const originalOnUnknown = ChannelClass.prototype.onUnknown;
    ChannelClass.prototype.onUnknown = function (reply) {
      if (reply === '!empty' || (reply && reply.reply === '!empty')) {
        return;
      }
      return originalOnUnknown.apply(this, arguments);
    };
  }
} catch (e) {}

router.post('/fetch-data', async (req, res) => {
  let socketClient = null;
  try {
    const { host, port, protocol, username, password } = req.body;
    const proto = (protocol || 'WWW').toUpperCase();
    
    // ==========================================
    // 🌐 JALUR REST API (WWW / WWW-SSL)
    // ==========================================
    if (proto.startsWith('WWW')) {
      const isSsl = proto === 'WWW-SSL';
      const scheme = isSsl ? 'https' : 'http';
      const targetPort = parseInt(port) || (isSsl ? 443 : 80);
      
      const baseURL = `${scheme}://${host}:${targetPort}/rest`;
      const auth = { username, password };
      const headers = { 'Content-Type': 'application/json' };
      
      const httpsAgent = new https.Agent({ rejectUnauthorized: false });
      const httpAgent = new http.Agent();

      const fetchRest = async (path) => {
        try {
          const response = await axios.get(`${baseURL}${path}`, {
            auth, headers,
            httpsAgent: isSsl ? httpsAgent : undefined,
            httpAgent: !isSsl ? httpAgent : undefined,
            timeout: 6000
          });
          
          let resultData = response.data;
          if (resultData && Array.isArray(resultData.rows)) {
            resultData = resultData.rows;
          } else if (resultData && typeof resultData === 'object' && !Array.isArray(resultData)) {
            resultData = [resultData];
          }
          return Array.isArray(resultData) ? resultData : [];
        } catch (err) {
          return [];
        }
      };

      // Ambil data interface zerotier dan data lainnya secara paralel
      const [networks, instance, peer, routes, routerInterfaces, routingTables] = await Promise.all([
        fetchRest('/zerotier/interface'),
        fetchRest('/zerotier'),
        fetchRest('/zerotier/peer'),
        fetchRest('/ip/route'),
        fetchRest('/interface'),
        fetchRest('/routing/table')
      ]);

      return res.json({
        success: true,
        data: {
          networks: Array.isArray(networks) ? networks : [],
          instance: Array.isArray(instance) ? instance : [],
          peer: Array.isArray(peer) ? peer : [],
          routes: Array.isArray(routes) ? routes : [],
          interfaces: Array.isArray(routerInterfaces) ? routerInterfaces : [],
          routingTables: Array.isArray(routingTables) ? routingTables : []
        }
      });
    } 
    
    // ==========================================
    // ⚡ JALUR SOCKET API (API / API-SSL)
    // ==========================================
    else {
      const targetPort = parseInt(port) || (proto === 'API-SSL' ? 8729 : 8728);
      
      socketClient = new RouterOSAPI({
        host, user: username, password, port: targetPort,
        tls: proto === 'API-SSL', rejectUnauthorized: false, timeout: 8
      });

      socketClient.on('error', () => {});
      await socketClient.connect();

      const executeSafeStream = (cmd) => {
        return new Promise((resolve) => {
          const results = [];
          let isDone = false;

          try {
            const stream = socketClient.stream([cmd]);
            
            const finish = () => {
              if (!isDone) {
                isDone = true;
                try { stream.stop(); } catch(e){}
                resolve(results);
              }
            };

            stream.on('data', (data) => { results.push(data); });
            stream.on('done', finish);
            stream.on('error', finish);

            setTimeout(finish, 4000);
          } catch (err) {
            resolve(results);
          }
        });
      };

      const networks = await executeSafeStream('/zerotier/interface/print');
      const instance = await executeSafeStream('/zerotier/print');
      const peer = await executeSafeStream('/zerotier/peer/print');
      const routes = await executeSafeStream('/ip/route/print');
      const routerInterfaces = await executeSafeStream('/interface/print');
      const routingTables = await executeSafeStream('/routing/table/print');

      if (socketClient && socketClient.connected) {
        try { socketClient.close(); } catch (e) {}
      }

      return res.json({
        success: true,
        data: { networks, instance, peer, routes, interfaces: routerInterfaces, routingTables }
      });
    }

  } catch (error) {
    if (socketClient && socketClient.connected) {
      try { socketClient.close(); } catch (e) {}
    }
    console.error('❌ Remote API Error:', error.message);
    res.status(500).json({ success: false, message: error.message || 'Gagal terhubung ke router remote.' });
  }
});

// ==========================================
// INTERFACE CRUD ENDPOINTS
// ==========================================
router.post('/add', async (req, res) => {
  try {
    let { host, port, protocol, username, password, name, network, instance, 'allow-managed': allowManaged, 'allow-global': allowGlobal, 'allow-default': allowDefault } = req.body;
    if (!host) return res.status(400).json({ success: false, message: 'Host/IP router belum diisi.' });

    const proto = (protocol || 'WWW').toUpperCase();
    if (proto.startsWith('WWW')) {
      const isSsl = proto === 'WWW-SSL';
      const targetPort = port ? parseInt(port) : (isSsl ? 443 : 80);
      const baseURL = `${isSsl ? 'https' : 'http'}://${host}:${targetPort}/rest/zerotier/interface`;
      const agent = new https.Agent({ rejectUnauthorized: false });

      await axios.put(baseURL, {
        name, network, instance: instance || 'zt1',
        'allow-managed': allowManaged === 'yes',
        'allow-global': allowGlobal === 'yes',
        'allow-default': allowDefault === 'yes'
      }, { auth: { username, password }, httpsAgent: agent, timeout: 5000 });
    } else {
      const client = new RouterOSAPI({ host, user: username, password, port: parseInt(port) || 8728, tls: proto === 'API-SSL', rejectUnauthorized: false });
      await client.connect();
      await client.write([
        '/zerotier/interface/add',
        `=name=${name}`,
        `=network=${network}`,
        `=instance=${instance || 'zt1'}`,
        `=allow-managed=${allowManaged || 'yes'}`,
        `=allow-global=${allowGlobal || 'yes'}`,
        `=allow-default=${allowDefault || 'yes'}`
      ]);
      client.close();
    }
    res.json({ success: true, message: 'Interface ZeroTier berhasil ditambahkan!' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.response?.data?.detail || error.message });
  }
});

router.post('/update', async (req, res) => {
  try {
    // 1. Tangkap 'disabled' dari req.body
    let { host, port, protocol, username, password, id, '.id': dotId, name, network, instance, disabled, 'allow-managed': allowManaged, 'allow-global': allowGlobal, 'allow-default': allowDefault } = req.body;
    
    const targetId = id || dotId;
    if (!host) return res.status(400).json({ success: false, message: 'Host/IP router belum diisi.' });
    if (!targetId) return res.status(400).json({ success: false, message: 'Missing resource identifier (.id kosong).' });

    const proto = (protocol || 'WWW').toUpperCase();
    
    const isDisabledBool = disabled === 'true' || disabled === true || disabled === 'yes';
    const isDisabledStr = isDisabledBool ? 'yes' : 'no';

    if (proto.startsWith('WWW')) {
      const isSsl = proto === 'WWW-SSL';
      const targetPort = port ? parseInt(port) : (isSsl ? 443 : 80);
      const baseURL = `${isSsl ? 'https' : 'http'}://${host}:${targetPort}/rest/zerotier/interface/${targetId}`;
      const agent = new https.Agent({ rejectUnauthorized: false });

      await axios.patch(baseURL, {
        name, 
        network, 
        instance: instance || 'zt1',
        disabled: isDisabledBool,
        'allow-managed': allowManaged === 'yes',
        'allow-global': allowGlobal === 'yes',
        'allow-default': allowDefault === 'yes'
      }, { auth: { username, password }, httpsAgent: agent, timeout: 5000 });

    } else {
      const client = new RouterOSAPI({ host, user: username, password, port: parseInt(port) || 8728, tls: proto === 'API-SSL', rejectUnauthorized: false });
      await client.connect();
      await client.write([
        '/zerotier/interface/set',
        `=.id=${targetId}`,
        `=name=${name}`,
        `=network=${network}`,
        `=instance=${instance || 'zt1'}`,
        `=disabled=${isDisabledStr}`,
        `=allow-managed=${allowManaged}`,
        `=allow-global=${allowGlobal}`,
        `=allow-default=${allowDefault}`
      ]);
      client.close();
    }
    res.json({ success: true, message: 'Interface ZeroTier berhasil diperbarui!' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.response?.data?.detail || error.message });
  }
});

router.post('/delete', async (req, res) => {
  try {
    let { host, port, protocol, username, password, id } = req.body;
    if (!host) return res.status(400).json({ success: false, message: 'Host router belum diisi.' });

    const proto = (protocol || 'WWW').toUpperCase();
    if (proto.startsWith('WWW')) {
      const isSsl = proto === 'WWW-SSL';
      const targetPort = port ? parseInt(port) : (isSsl ? 443 : 80);
      const baseURL = `${isSsl ? 'https' : 'http'}://${host}:${targetPort}/rest/zerotier/interface/${id}`;
      const agent = new https.Agent({ rejectUnauthorized: false });

      await axios.delete(baseURL, { auth: { username, password }, httpsAgent: agent, timeout: 5000 });
    } else {
      const client = new RouterOSAPI({ host, user: username, password, port: parseInt(port) || 8728, tls: proto === 'API-SSL', rejectUnauthorized: false });
      await client.connect();
      await client.write(['/zerotier/interface/remove', `=.id=${id}`]);
      client.close();
    }
    res.json({ success: true, message: 'Interface ZeroTier berhasil dihapus!' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.response?.data?.detail || error.message });
  }
});

// ==========================================
// INSTANCE CRUD ENDPOINTS
// ==========================================
router.post('/instance/add', async (req, res) => {
  try {
    let { host, port: routerPort, protocol, username, password, name, ztPort, routeDistance, interfaces, disabled } = req.body;
    if (!host) return res.status(400).json({ success: false, message: 'Host router belum diisi.' });

    const proto = (protocol || 'WWW').toUpperCase();
    if (proto.startsWith('WWW')) {
      const isSsl = proto === 'WWW-SSL';
      const targetPort = routerPort ? parseInt(routerPort) : (isSsl ? 443 : 80);
      const baseURL = `${isSsl ? 'https' : 'http'}://${host}:${targetPort}/rest/zerotier`;
      const agent = new https.Agent({ rejectUnauthorized: false });

      await axios.put(baseURL, {
        name,
        port: parseInt(ztPort) || 9993,
        'route-distance': parseInt(routeDistance) || 1,
        interfaces: interfaces || 'all',
        disabled: disabled === 'true' || disabled === true
      }, { auth: { username, password }, httpsAgent: agent, timeout: 5000 });
    } else {
      const client = new RouterOSAPI({ host, user: username, password, port: parseInt(routerPort) || 8728, tls: proto === 'API-SSL', rejectUnauthorized: false });
      await client.connect();
      await client.write([
        '/zerotier/add',
        `=name=${name}`,
        `=port=${parseInt(ztPort) || 9993}`,
        `=route-distance=${parseInt(routeDistance) || 1}`,
        `=interfaces=${interfaces || 'all'}`,
        `=disabled=${disabled === 'true' ? 'yes' : 'no'}`
      ]);
      client.close();
    }
    res.json({ success: true, message: 'Instance ZeroTier berhasil ditambahkan!' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.response?.data?.detail || error.message });
  }
});

router.post('/instance/update', async (req, res) => {
  try {
    let { host, port: routerPort, protocol, username, password, id, '.id': dotId, name, ztPort, routeDistance, interfaces, disabled } = req.body;
    const targetId = id || dotId;
    if (!host) return res.status(400).json({ success: false, message: 'Host router belum diisi.' });
    if (!targetId) return res.status(400).json({ success: false, message: 'Missing resource identifier (.id kosong).' });

    const proto = (protocol || 'WWW').toUpperCase();
    if (proto.startsWith('WWW')) {
      const isSsl = proto === 'WWW-SSL';
      const targetPort = routerPort ? parseInt(routerPort) : (isSsl ? 443 : 80);
      const baseURL = `${isSsl ? 'https' : 'http'}://${host}:${targetPort}/rest/zerotier/${targetId}`;
      const agent = new https.Agent({ rejectUnauthorized: false });

      await axios.patch(baseURL, {
        name,
        port: parseInt(ztPort) || 9993,
        'route-distance': parseInt(routeDistance) || 1,
        interfaces: interfaces || 'all',
        disabled: disabled === 'true' || disabled === true
      }, { auth: { username, password }, httpsAgent: agent, timeout: 5000 });
    } else {
      const client = new RouterOSAPI({ host, user: username, password, port: parseInt(routerPort) || 8728, tls: proto === 'API-SSL', rejectUnauthorized: false });
      await client.connect();
      await client.write([
        '/zerotier/set',
        `=.id=${targetId}`,
        `=name=${name}`,
        `=port=${parseInt(ztPort) || 9993}`,
        `=route-distance=${parseInt(routeDistance) || 1}`,
        `=interfaces=${interfaces || 'all'}`,
        `=disabled=${disabled === 'true' ? 'yes' : 'no'}`
      ]);
      client.close();
    }
    res.json({ success: true, message: 'Instance ZeroTier berhasil diperbarui!' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.response?.data?.detail || error.message });
  }
});

router.post('/instance/delete', async (req, res) => {
  try {
    let { host, port, protocol, username, password, id } = req.body;
    if (!host) return res.status(400).json({ success: false, message: 'Host router belum diisi.' });
    if (!id) return res.status(400).json({ success: false, message: 'Missing resource identifier.' });

    const proto = (protocol || 'WWW').toUpperCase();
    if (proto.startsWith('WWW')) {
      const isSsl = proto === 'WWW-SSL';
      const targetPort = port ? parseInt(port) : (isSsl ? 443 : 80);
      const baseURL = `${isSsl ? 'https' : 'http'}://${host}:${targetPort}/rest/zerotier/${id}`;
      const agent = new https.Agent({ rejectUnauthorized: false });

      await axios.delete(baseURL, { auth: { username, password }, httpsAgent: agent, timeout: 5000 });
    } else {
      const client = new RouterOSAPI({ host, user: username, password, port: parseInt(port) || 8728, tls: proto === 'API-SSL', rejectUnauthorized: false });
      await client.connect();
      await client.write(['/zerotier/remove', `=.id=${id}`]);
      client.close();
    }
    res.json({ success: true, message: 'Instance ZeroTier berhasil dihapus!' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.response?.data?.detail || error.message });
  }
});

// ==========================================
// ROUTES CRUD ENDPOINTS (NEW)
// ==========================================
// 1. TAMBAH STATIC ROUTE
router.post('/route/add', async (req, res) => {
  try {
    const { host, port, protocol, username, password, 'dst-address': dstAddress, gateway, distance, 'routing-table': routingTable, disabled } = req.body;
    if (!host) return res.status(400).json({ success: false, message: 'Host router belum diisi.' });

    const proto = (protocol || 'WWW').toUpperCase();
    if (proto.startsWith('WWW')) {
      const isSsl = proto === 'WWW-SSL';
      const targetPort = port ? parseInt(port) : (isSsl ? 443 : 80);
      const baseURL = `${isSsl ? 'https' : 'http'}://${host}:${targetPort}/rest/ip/route`;
      const agent = new https.Agent({ rejectUnauthorized: false });

      const payload = {
        'dst-address': dstAddress,
        gateway: gateway,
        distance: parseInt(distance) || 1,
        disabled: disabled === 'true' || disabled === true
      };
      if (routingTable && routingTable !== 'main') {
        payload['routing-table'] = routingTable;
      }

      await axios.put(baseURL, payload, { auth: { username, password }, httpsAgent: agent, timeout: 5000 });
    } else {
      const client = new RouterOSAPI({ host, user: username, password, port: parseInt(port) || 8728, tls: proto === 'API-SSL', rejectUnauthorized: false });
      await client.connect();
      
      const writeCmd = [
        '/ip/route/add',
        `=dst-address=${dstAddress}`,
        `=gateway=${gateway}`,
        `=distance=${parseInt(distance) || 1}`,
        `=disabled=${disabled === 'true' ? 'yes' : 'no'}`
      ];
      if (routingTable && routingTable !== 'main') {
        writeCmd.push(`=routing-table=${routingTable}`);
      }

      await client.write(writeCmd);
      client.close();
    }
    res.json({ success: true, message: 'Static route berhasil ditambahkan!' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.response?.data?.detail || error.message });
  }
});

// 2. UPDATE STATIC ROUTE
router.post('/route/update', async (req, res) => {
  try {
    const { host, port, protocol, username, password, id, '.id': dotId, 'dst-address': dstAddress, gateway, distance, 'routing-table': routingTable, disabled } = req.body;
    const targetId = id || dotId;
    if (!host) return res.status(400).json({ success: false, message: 'Host router belum diisi.' });
    if (!targetId) return res.status(400).json({ success: false, message: 'Missing resource identifier (.id kosong).' });

    const proto = (protocol || 'WWW').toUpperCase();
    if (proto.startsWith('WWW')) {
      const isSsl = proto === 'WWW-SSL';
      const targetPort = port ? parseInt(port) : (isSsl ? 443 : 80);
      const baseURL = `${isSsl ? 'https' : 'http'}://${host}:${targetPort}/rest/ip/route/${targetId}`;
      const agent = new https.Agent({ rejectUnauthorized: false });

      const payload = {
        'dst-address': dstAddress,
        gateway: gateway,
        distance: parseInt(distance) || 1,
        disabled: disabled === 'true' || disabled === true
      };
      if (routingTable && routingTable !== 'main') {
        payload['routing-table'] = routingTable;
      }

      await axios.patch(baseURL, payload, { auth: { username, password }, httpsAgent: agent, timeout: 5000 });
    } else {
      const client = new RouterOSAPI({ host, user: username, password, port: parseInt(port) || 8728, tls: proto === 'API-SSL', rejectUnauthorized: false });
      await client.connect();
      
      const writeCmd = [
        '/ip/route/set',
        `=.id=${targetId}`,
        `=dst-address=${dstAddress}`,
        `=gateway=${gateway}`,
        `=distance=${parseInt(distance) || 1}`,
        `=disabled=${disabled === 'true' ? 'yes' : 'no'}`
      ];
      if (routingTable && routingTable !== 'main') {
        writeCmd.push(`=routing-table=${routingTable}`);
      }

      await client.write(writeCmd);
      client.close();
    }
    res.json({ success: true, message: 'Static route berhasil diperbarui!' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.response?.data?.detail || error.message });
  }
});

// 3. DELETE STATIC ROUTE
router.post('/route/delete', async (req, res) => {
  try {
    const { host, port, protocol, username, password, id } = req.body;
    if (!host) return res.status(400).json({ success: false, message: 'Host router belum diisi.' });
    if (!id) return res.status(400).json({ success: false, message: 'Missing resource identifier.' });

    const proto = (protocol || 'WWW').toUpperCase();
    if (proto.startsWith('WWW')) {
      const isSsl = proto === 'WWW-SSL';
      const targetPort = port ? parseInt(port) : (isSsl ? 443 : 80);
      const baseURL = `${isSsl ? 'https' : 'http'}://${host}:${targetPort}/rest/ip/route/${id}`;
      const agent = new https.Agent({ rejectUnauthorized: false });

      await axios.delete(baseURL, { auth: { username, password }, httpsAgent: agent, timeout: 5000 });
    } else {
      const client = new RouterOSAPI({ host, user: username, password, port: parseInt(port) || 8728, tls: proto === 'API-SSL', rejectUnauthorized: false });
      await client.connect();
      await client.write(['/ip/route/remove', `=.id=${id}`]);
      client.close();
    }
    res.json({ success: true, message: 'Static route berhasil dihapus!' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.response?.data?.detail || error.message });
  }
});

module.exports = router;