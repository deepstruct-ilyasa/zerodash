// Ubah import 'protocol' menjadi 'getProtocol'
const { getProtocol, restRequest, getSocketMenu, parseBoolean } = require('../config/routerosClient');

class ControllerService {
  // --- INTERFACES ROUTER ---
  async getInterfaces() {
    const protocol = await getProtocol();
    if (protocol.startsWith('WWW')) {
      return await restRequest('GET', '/interface');
    } else {
      const api = await getSocketMenu();
      return await api.write('/interface/print');
    }
  }

  // --- INSTANCES (FULL CRUD) ---
  async getInstances() {
    const protocol = await getProtocol();
    if (protocol.startsWith('WWW')) {
      return await restRequest('GET', '/zerotier');
    } else {
      const api = await getSocketMenu();
      return await api.write('/zerotier/print');
    }
  }

  async addInstance(data) {
    const protocol = await getProtocol();
    const isDisabled = data.disabled === 'true' || data.disabled === true;

    if (protocol.startsWith('WWW')) {
      const payload = {
        name: data.name,
        port: parseInt(data.ztPort) || 9993,
        'route-distance': parseInt(data.routeDistance) || 1,
        interfaces: data.interfaces || 'all',
        disabled: isDisabled ? 'yes' : 'no'
      };
      return await restRequest('PUT', '/zerotier', payload);
    } else {
      const api = await getSocketMenu();
      return await api.write('/zerotier/add', [
        `=name=${data.name}`,
        `=port=${parseInt(data.ztPort) || 9993}`,
        `=route-distance=${parseInt(data.routeDistance) || 1}`,
        `=interfaces=${data.interfaces || 'all'}`,
        `=disabled=${isDisabled ? 'yes' : 'no'}`
      ]);
    }
  }

  async updateInstance(id, data) {
    const protocol = await getProtocol();
    const isDisabled = data.disabled === 'true' || data.disabled === true;

    if (protocol.startsWith('WWW')) {
      const encodedId = encodeURIComponent(id);
      const payload = {
        name: data.name,
        port: parseInt(data.ztPort) || 9993,
        'route-distance': parseInt(data.routeDistance) || 1,
        interfaces: data.interfaces || 'all',
        disabled: isDisabled ? 'yes' : 'no'
      };
      return await restRequest('PATCH', `/zerotier/${encodedId}`, payload);
    } else {
      const api = await getSocketMenu();
      return await api.write('/zerotier/set', [
        `=.id=${id}`,
        `=name=${data.name}`,
        `=port=${parseInt(data.ztPort) || 9993}`,
        `=route-distance=${parseInt(data.routeDistance) || 1}`,
        `=interfaces=${data.interfaces || 'all'}`,
        `=disabled=${isDisabled ? 'yes' : 'no'}`
      ]);
    }
  }

  async deleteInstance(id) {
    const protocol = await getProtocol();
    if (protocol.startsWith('WWW')) {
      const encodedId = encodeURIComponent(id);
      return await restRequest('DELETE', `/zerotier/${encodedId}`);
    } else {
      const api = await getSocketMenu();
      return await api.write('/zerotier/remove', [`=.id=${id}`]);
    }
  }



  // --- NETWORKS ---
  async getNetworks() {
    const protocol = await getProtocol();
    if (protocol.startsWith('WWW')) {
      return await restRequest('GET', '/zerotier/controller');
    } else {
      const api = await getSocketMenu();
      return await api.write('/zerotier/controller/print');
    }
  }

  async addNetwork(data) {
    const protocol = await getProtocol();
    const isPrivate = data.private === true || data.private === 'yes' || data.private === 'true' || data.private === 'YES';

    if (protocol.startsWith('WWW')) {
      const payload = { ...data, private: isPrivate ? 'yes' : 'no' };
      return await restRequest('PUT', '/zerotier/controller', payload);
    } else {
      const api = await getSocketMenu();
      const params = [
        `=name=${data.name}`,
        `=instance=${data.instance || 'zt1'}`,
        `=mtu=${data.mtu || '2800'}`,
        `=private=${isPrivate ? 'yes' : 'no'}`
      ];
      if (data['ip-range']) params.push(`=ip-range=${data['ip-range']}`);
      return await api.write('/zerotier/controller/add', params);
    }
  }

  async updateNetwork(id, data) {
    const protocol = await getProtocol();
    const { id: _, ...payload } = data;
    
    if (payload.private !== undefined) {
      const isPrivate = payload.private === true || payload.private === 'yes' || payload.private === 'true' || payload.private === 'YES';
      payload.private = isPrivate ? 'yes' : 'no';
    }

    if (protocol.startsWith('WWW')) {
      const encodedId = encodeURIComponent(id);
      return await restRequest('PATCH', `/zerotier/controller/${encodedId}`, payload);
    } else {
      const api = await getSocketMenu();
      const params = [`=.id=${id}`];
      if (payload.name !== undefined) params.push(`=name=${payload.name}`);
      if (payload.instance !== undefined) params.push(`=instance=${payload.instance}`);
      if (payload.mtu !== undefined) params.push(`=mtu=${payload.mtu}`);
      if (payload['ip-range'] !== undefined) params.push(`=ip-range=${payload['ip-range']}`);
      if (payload.private !== undefined) params.push(`=private=${payload.private}`);
      if (payload.disabled !== undefined) params.push(`=disabled=${payload.disabled ? 'yes' : 'no'}`);
      
      // ==========================================
      // TAMBAHKAN INI AGAR ROUTES IKUT TERKIRIM KE MIKROTIK
      // ==========================================
      if (payload.routes !== undefined) {
        params.push(`=routes=${payload.routes}`);
      }

      return await api.write('/zerotier/controller/set', params);
    }
  }

  async deleteNetwork(id) {
    const protocol = await getProtocol();
    if (protocol.startsWith('WWW')) {
      const encodedId = encodeURIComponent(id);
      return await restRequest('DELETE', `/zerotier/controller/${encodedId}`);
    } else {
      const api = await getSocketMenu();
      return await api.write('/zerotier/controller/remove', [`=.id=${id}`]);
    }
  }

  // --- PEERS (LATENCY & PATH) ---
  async getPeers() {
    const protocol = await getProtocol();
    if (protocol.startsWith('WWW')) {
      return await restRequest('GET', '/zerotier/peer');
    } else {
      const api = await getSocketMenu();
      return await api.write('/zerotier/peer/print');
    }
  }

  // --- MEMBERS ---
  async getMembers() {
    const protocol = await getProtocol();
    if (protocol.startsWith('WWW')) {
      return await restRequest('GET', '/zerotier/controller/member');
    } else {
      const api = await getSocketMenu();
      return await api.write('/zerotier/controller/member/print');
    }
  }

  async addMember(data) {
    const protocol = await getProtocol();
    if (protocol.startsWith('WWW')) {
      return await restRequest('PUT', '/zerotier/controller/member', data);
    } else {
      const api = await getSocketMenu();
      const params = [
        `=network=${data.network}`,
        `=zt-address=${data['zt-address']}`,
        `=name=${data.name || ''}`,
        `=authorized=${data.authorized ? 'yes' : 'no'}`
      ];
      if (data['ip-address']) params.push(`=ip-address=${data['ip-address']}`);
      return await api.write('/zerotier/controller/member/add', params);
    }
  }

  async updateMember(id, data) {
    const protocol = await getProtocol();
    if (protocol.startsWith('WWW')) {
      const encodedId = encodeURIComponent(id);
      return await restRequest('PATCH', `/zerotier/controller/member/${encodedId}`, data);
    } else {
      const api = await getSocketMenu();
      const params = [`=.id=${id}`];
      if (data.name !== undefined) params.push(`=name=${data.name}`);
      if (data.network !== undefined) params.push(`=network=${data.network}`);
      if (data['ip-address'] !== undefined) params.push(`=ip-address=${data['ip-address']}`);
      if (data.authorized !== undefined) params.push(`=authorized=${parseBoolean(data.authorized) ? 'yes' : 'no'}`);
      return await api.write('/zerotier/controller/member/set', params);
    }
  }

  async deleteMember(id) {
    const protocol = await getProtocol();
    if (protocol.startsWith('WWW')) {
      const encodedId = encodeURIComponent(id);
      return await restRequest('DELETE', `/zerotier/controller/member/${encodedId}`);
    } else {
      const api = await getSocketMenu();
      return await api.write('/zerotier/controller/member/remove', [`=.id=${id}`]);
    }
  }

  // ==========================================
  // TRAFFIC FLOW & TARGETS (CRUD FIX)
  // ==========================================
  async getTrafficFlow() {
    const protocol = await getProtocol();
    if (protocol.startsWith('WWW')) {
      try {
        const res = await restRequest('GET', '/ip/traffic-flow');
        return Array.isArray(res) ? res[0] : res;
      } catch (e) { return {}; }
    } else {
      const api = await getSocketMenu();
      const res = await api.write('/ip/traffic-flow/print');
      return Array.isArray(res) ? res[0] : res;
    }
  }

  async setTrafficFlow(data) {
    const protocol = await getProtocol();
    const enabledStr = (data.enabled === true || data.enabled === 'yes' || data.enabled === 1) ? 'yes' : 'no';
    const samplingStr = (data.packetSampling === true || data.packetSampling === 'yes' || data.packetSampling === 1) ? 'yes' : 'no';
    
    const interfacesVal = Array.isArray(data.interfaces) && data.interfaces.length > 0 
      ? data.interfaces.filter(i => i && i !== '').join(',') 
      : 'all';

    const cacheEntries = data.cacheEntries || '1M';
    const activeTimeout = data.activeFlowTimeout || '00:00:05';
    const inactiveTimeout = data.inactiveFlowTimeout || '00:00:05';

    // 1. Jika menggunakan protokol HTTP / HTTPS (WWW / WWW-SSL)
    if (protocol.startsWith('WWW')) {
      const payload = {
        enabled: enabledStr,
        interfaces: interfacesVal,
        'cache-entries': cacheEntries,
        'active-flow-timeout': activeTimeout,
        'inactive-flow-timeout': inactiveTimeout,
        'packet-sampling': samplingStr
      };

      try {
        return await restRequest('POST', '/ip/traffic-flow/set', payload);
      } catch (err) {
        return await restRequest('PUT', '/ip/traffic-flow', payload);
      }
    } 
    // 2. Jika menggunakan protokol API / API-SSL (Socket API murni)
    else {
      // Gunakan getSocketMenu() atau ambil instance socket dasar, lalu pastikan path absolut '/ip/traffic-flow/set'
      const api = await getSocketMenu();
      
      // Jika helper Anda mendukung penulisan path absolut langsung pada write:
      if (typeof api.write === 'function') {
        return await api.write('/ip/traffic-flow/set', [
          `=enabled=${enabledStr}`,
          `=interfaces=${interfacesVal}`,
          `=cache-entries=${cacheEntries}`,
          `=active-flow-timeout=${activeTimeout}`,
          `=inactive-flow-timeout=${inactiveTimeout}`,
          `=packet-sampling=${samplingStr}`
        ]);
      } else {
        throw new Error('Socket API write method tidak tersedia.');
      }
    }
  }

  async getTrafficFlowTargets() {
    const protocol = await getProtocol();
    let rawTargets = [];

    if (protocol.startsWith('WWW')) {
      try {
        const res = await restRequest('GET', '/ip/traffic-flow/target');
        rawTargets = Array.isArray(res) ? res : (res?.data || []);
      } catch (e) { rawTargets = []; }
    } else {
      const api = await getSocketMenu();
      const res = await api.write('/ip/traffic-flow/target/print');
      rawTargets = Array.isArray(res) ? res : [];
    }

    return rawTargets.map(t => ({
      '.id': t['.id'] || t.id || t['id'],
      enabled: t.enabled,
      address: t.address || t['src-address'] || '0.0.0.0',
      'dst-address': t['dst-address'] || t.destination || t.address,
      port: t.port || 2055,
      version: t.version || 5,
      'v9-template-refresh': t['v9-template-refresh'] || 20,
      'v9-template-timeout': t['v9-template-timeout'] || 1800
    }));
  }

  async saveTrafficFlowTarget(targetData) {
    const protocol = await getProtocol();
    const enabledStr = (targetData.enabled === true || targetData.enabled === 'yes' || targetData.enabled === 1) ? 'yes' : 'no';
    
    // Ambil parameter sesuai dengan hasil terminal router
    const targetAddress = targetData['dst_address'] || targetData.address || '';
    const sourceAddress = targetData['src-address'] || targetData.address || '0.0.0.0';
    
    let targetId = targetData['.id'] ? String(targetData['.id']).trim() : null;
    if (targetId === '' || targetId === 'null' || targetId === 'undefined') {
      targetId = null;
    }

    const portVal = parseInt(targetData.port) || 2055;
    const versionVal = parseInt(targetData.version) || 5;
    const templateRefresh = parseInt(targetData['v9-template-refresh'] || targetData['v9_template_refresh']) || 20;
    const templateTimeout = parseInt(targetData['v9-template-timeout'] || targetData['v9_template_timeout']) || 1800;

    // 1. Jika menggunakan protokol HTTP / HTTPS (WWW / WWW-SSL)
    if (protocol.startsWith('WWW')) {
      const payload = {
        disabled: enabledStr === 'yes' ? 'no' : 'yes',
        'src-address': sourceAddress,
        'dst-address': targetAddress,
        port: portVal,
        version: versionVal,
        'v9-template-refresh': templateRefresh,
        'v9-template-timeout': templateTimeout
      };

      if (targetId) {
        return await restRequest('PATCH', `/ip/traffic-flow/target/${encodeURIComponent(targetId)}`, payload);
      } else {
        return await restRequest('PUT', '/ip/traffic-flow/target', payload);
      }
    } 
    // 2. Jika menggunakan protokol API / API-SSL (Socket API murni)
    else {
      const api = await getSocketMenu();
      if (targetId) {
        return await api.write('/ip/traffic-flow/target/set', [
          `=.id=${targetId}`,
          `=disabled=${enabledStr === 'yes' ? 'no' : 'yes'}`,
          `=src-address=${sourceAddress}`,
          `=dst-address=${targetAddress}`,
          `=port=${portVal}`,
          `=version=${versionVal}`,
          `=v9-template-refresh=${templateRefresh}`,
          `=v9-template-timeout=${templateTimeout}`
        ]);
      } else {
        return await api.write('/ip/traffic-flow/target/add', [
          `=disabled=${enabledStr === 'yes' ? 'no' : 'yes'}`,
          `=src-address=${sourceAddress}`,
          `=dst-address=${targetAddress}`,
          `=port=${portVal}`,
          `=version=${versionVal}`,
          `=v9-template-refresh=${templateRefresh}`,
          `=v9-template-timeout=${templateTimeout}`
        ]);
      }
    }
  }

  async deleteTrafficFlowTarget(id) {
    const protocol = await getProtocol();
    const cleanId = String(id).trim();

    if (protocol.startsWith('WWW')) {
      return await restRequest('DELETE', `/ip/traffic-flow/target/${encodeURIComponent(cleanId)}`);
    } else {
      const api = await getSocketMenu();
      return await api.write('/ip/traffic-flow/target/remove', [`=.id=${cleanId}`]);
    }
  }
}

module.exports = new ControllerService();