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
}

module.exports = new ControllerService();