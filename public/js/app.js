document.addEventListener('alpine:init', () => {
  Alpine.data('controllerApp', () => ({
    activeTab: localStorage.getItem('activeTab') || 'networks',
    darkMode: localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches),
    isMobileMenuOpen: false,

    selectedControllerId: '',

    // Modals State: Members
    showAddMemberModal: false,
    showEditMemberModal: false,
    showDeleteMemberModal: false,
    memberToDelete: null,

    // Modals State: Networks (Controllers)
    showAddNetModal: false,
    showEditNetModal: false,
    showDeleteNetModal: false,
    netToDelete: null,

    // Modals State: Routes
    showAddRouteModal: false,
    showEditRouteModal: false,
    showDeleteRouteModal: false,
    routeToDelete: null,

    instances: [],
    networks: [],
    members: [],
    logs: [],

    // Form Add Member
    newMember: {
      network: '',
      'zt-address': '',
      name: '',
      'ip-address': '',
      authorized: true
    },

    // Form Edit Member
    editMemberData: {
      id: '',
      network: '',
      'zt-address': '',
      name: '',
      'ip-address': '',
      authorized: true
    },

    // Form Add Controller Network
    newNet: {
      name: '',
      instance: 'zt1',
      mtu: '2800',
      'ip-range': '10.10.10.1-10.10.10.30',
      private: true,
      disabled: false
    },

    // Form Edit Controller Network
    editNetData: {
      id: '',
      name: '',
      instance: 'zt1',
      mtu: '2800',
      'ip-range': '',
      private: true,
      disabled: false
    },

    // Form Add Routes
    newRoute: {
      subnet: '',
      gateway: ''
    },

    // Form Edit Routes
    editRouteData: {
      originalRaw: '', // Menyimpan rute lama sebelum diubah
      subnet: '',
      gateway: ''
    },

    switchTab(tabName) {
      this.activeTab = tabName;
      localStorage.setItem('activeTab', tabName);
      this.isMobileMenuOpen = false;
    },

    init() {
      this.addLog('SYSTEM', 'Connecting to ZeroTier Controller Backend...');
      this.fetchData();

      setTimeout(() => {
        if (window.lucide) window.lucide.createIcons();
      }, 100);

      setInterval(() => {
        this.fetchData(true);
      }, 5000);
    },

    toggleTheme() {
      this.darkMode = !this.darkMode;
      localStorage.setItem('theme', this.darkMode ? 'dark' : 'light');
      
      setTimeout(() => {
        if (window.lucide) window.lucide.createIcons();
      }, 20);
    },

    parseBool(val) {
      if (typeof val === 'boolean') return val;
      if (typeof val === 'string') return val.toLowerCase() === 'true' || val.toLowerCase() === 'yes';
      return false;
    },

    async fetchData(silent = false) {
      if (!silent) this.addLog('GET', '/api/controller/networks, members & instances');
      try {
        const [netRes, memRes, instRes] = await Promise.allSettled([
          fetch('/api/controller/networks').then(r => r.json()),
          fetch('/api/controller/members').then(r => r.json()),
          fetch('/api/controller/instances').then(r => r.json())
        ]);

        if (netRes.status === 'fulfilled' && netRes.value.success) {
          this.networks = netRes.value.data || [];
        }

        if (memRes.status === 'fulfilled' && memRes.value.success) {
          this.members = memRes.value.data || [];
        }

        if (instRes.status === 'fulfilled' && instRes.value.success) {
          this.instances = instRes.value.data || [];
        }
      } catch (err) {
        if (!silent) this.addLog('ERROR', 'Gagal sync data controller: ' + err.message);
      }
    },

    // ==========================================
    // --- CONTROLLER INSTANCE CRUD ---
    // ==========================================
    openAddNetModal() {
      // Jika data instances sudah ada, otomatis pilih instance pertama
      if (this.instances.length > 0) {
        this.newNet.instance = this.instances[0].name || '-';
      }
      this.showAddNetModal = true;
    },

    // ==========================================
    // --- CONTROLLER NETWORKS CRUD ---
    // ==========================================
    async submitAddNetwork() {
      if (!this.newNet.name) return alert('Nama Controller wajib diisi!');
      this.addLog('POST', `/api/controller/networks (${this.newNet.name})`);
      try {
        const res = await fetch('/api/controller/networks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.newNet)
        });
        const result = await res.json();
        if (result.success) {
          this.addLog('SUCCESS', `Controller Network ${this.newNet.name} created`);
          this.showAddNetModal = false;
          this.newNet = { name: '', instance: 'zt1', mtu: '2800', 'ip-range': '10.10.10.1-10.10.10.30', private: true, disabled: false };
          this.fetchData();
        } else {
          alert('Gagal tambah network: ' + result.message);
        }
      } catch (e) {
        alert('Error koneksi tambah network');
      }
    },

    openEditNetModal(net) {
      const isPrivateVal = net.private === 'yes' || net.private === true || net.private === 'YES' || net.private === 'true';

      this.editNetData = {
        id: net['.id'],
        name: net.name || '',
        instance: net.instance || '-',
        mtu: net.mtu || '2800',
        'ip-range': net['ip-range'] || '',
        private: isPrivateVal ? 'yes' : 'no',
        disabled: this.parseBool(net.disabled)
      };
      this.showEditNetModal = true;
    },

    async submitEditNetwork() {
      this.addLog('PATCH', `/api/controller/networks/${this.editNetData.id}`);
      try {
        const res = await fetch(`/api/controller/networks/${encodeURIComponent(this.editNetData.id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.editNetData)
        });
        const result = await res.json();
        if (result.success) {
          this.addLog('SUCCESS', `Controller Network updated`);
          this.showEditNetModal = false;
          this.fetchData();
        } else {
          alert('Gagal update network: ' + result.message);
        }
      } catch (e) {
        alert('Error update network');
      }
    },

    openDeleteNetModal(net) {
      this.netToDelete = net;
      this.showDeleteNetModal = true;
    },

    async confirmDeleteNetwork() {
      if (!this.netToDelete) return;
      const id = this.netToDelete['.id'];
      this.addLog('DELETE', `/api/controller/networks/${id}`);
      try {
        const res = await fetch(`/api/controller/networks/${encodeURIComponent(id)}`, { method: 'DELETE' });
        const result = await res.json();
        if (result.success) {
          this.addLog('SUCCESS', `Controller Network removed`);
          this.showDeleteNetModal = false;
          this.netToDelete = null;
          this.fetchData();
        } else {
          alert('Gagal hapus network: ' + result.message);
        }
      } catch (e) {
        alert('Error hapus network');
      }
    },

    // ==========================================
    // --- CONTROLLER MEMBERS CRUD ---
    // ==========================================
    openAddMemberModal() {
      if (this.networks.length > 0) {
        this.newMember.network = this.networks[0].name || this.networks[0].network || '';
      }
      this.showAddMemberModal = true;
    },

    async submitAddMember() {
      if (!this.newMember.network || !this.newMember['zt-address']) {
        return alert('Network dan ZT-Address wajib diisi!');
      }

      this.addLog('POST', `/api/controller/members (${this.newMember['zt-address']})`);
      try {
        const res = await fetch('/api/controller/members', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.newMember)
        });
        const result = await res.json();
        if (result.success) {
          this.addLog('SUCCESS', `Member added: ${this.newMember['zt-address']}`);
          this.showAddMemberModal = false;
          this.newMember = { network: '', 'zt-address': '', name: '', 'ip-address': '', authorized: true };
          this.fetchData();
        } else {
          alert('Gagal tambah member: ' + result.message);
        }
      } catch (e) {
        alert('Error koneksi tambah member: ' + e.message);
      }
    },

    openEditMemberModal(member) {
      this.editMemberData = {
        id: member['.id'],
        network: member.network || '',
        'zt-address': member['zt-address'] || '',
        name: member.name || '',
        'ip-address': member['ip-address'] || '',
        authorized: this.parseBool(member.authorized)
      };
      this.showEditMemberModal = true;
    },

    async submitEditMember() {
      this.addLog('PATCH', `/api/controller/members/${this.editMemberData.id}`);
      try {
        const res = await fetch(`/api/controller/members/${encodeURIComponent(this.editMemberData.id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: this.editMemberData.name,
            network: this.editMemberData.network,
            'ip-address': this.editMemberData['ip-address'],
            authorized: this.editMemberData.authorized
          })
        });
        const result = await res.json();
        if (result.success) {
          this.addLog('SUCCESS', `Member updated: ${this.editMemberData['zt-address']}`);
          this.showEditMemberModal = false;
          this.fetchData();
        } else {
          alert('Gagal update member: ' + result.message);
        }
      } catch (e) {
        alert('Error update member: ' + e.message);
      }
    },

    openDeleteMemberModal(member) {
      this.memberToDelete = member;
      this.showDeleteMemberModal = true;
    },

    async confirmDeleteMember() {
      if (!this.memberToDelete) return;
      const id = this.memberToDelete['.id'];

      this.addLog('DELETE', `/api/controller/members/${id}`);
      try {
        const res = await fetch(`/api/controller/members/${encodeURIComponent(id)}`, { method: 'DELETE' });
        const result = await res.json();
        if (result.success) {
          this.addLog('SUCCESS', `Member ${id} removed`);
          this.showDeleteMemberModal = false;
          this.memberToDelete = null;
          this.fetchData();
        } else {
          alert('Gagal hapus member: ' + result.message);
        }
      } catch (e) {
        alert('Error hapus member: ' + e.message);
      }
    },

    // ==========================================
    // --- ROUTES CRUD ---
    // ==========================================
    get parsedCurrentRoutes() {
      if (!this.selectedControllerId) return [];
      
      const currentNet = this.networks.find(net => net['.id'] === this.selectedControllerId);
      if (!currentNet || !currentNet.routes) return [];

      const rawRoutes = typeof currentNet.routes === 'string' ? currentNet.routes.split(',') : [];
      
      const netName = currentNet.name;
      const netId = currentNet.network || currentNet['network-id'];

      return rawRoutes.map(routeStr => {
        const trimmed = routeStr.trim();
        if (!trimmed) return null;

        const parts = trimmed.split('@');
        const subnet = parts[0].trim();
        const gateway = parts[1] ? parts[1].trim() : null;
        
        let viaMemberName = '-';

        if (gateway) {
           const foundMember = this.members.find(m => 
              (m.network === netName || m.network === netId) && 
              m['ip-address'] === gateway
           );
           
           if (foundMember) {
               viaMemberName = foundMember.name || 'Unnamed Member';
           }
        }

        return {
          raw: trimmed,
          subnet: subnet,
          gateway: gateway,
          viaMember: viaMemberName
        };
      }).filter(Boolean);
    },

    get membersForSelectedController() {
      if (!this.selectedControllerId) return [];
      const currentNet = this.networks.find(net => net['.id'] === this.selectedControllerId);
      if (!currentNet) return [];

      // Ambil nama controller atau Network ID untuk mencocokkan member
      const netName = currentNet.name;
      const netId = currentNet.network || currentNet['network-id'];

      return this.members.filter(m => m.network === netName || m.network === netId);
    },

    openEditRouteModal(route) {
      this.editRouteData.originalRaw = route.raw;
      this.editRouteData.subnet = route.subnet;
      this.editRouteData.gateway = route.gateway || '';
      this.showEditRouteModal = true;
    },

    deleteRoute(routeRaw) {
      this.routeToDelete = routeRaw;
      this.showDeleteRouteModal = true;
    },

    async submitAddRoute() {
      if (!this.selectedControllerId || !this.newRoute.subnet) {
        return alert('Pilih controller dan masukkan subnet tujuan (misal: 192.168.50.0/24)!');
      }

      const currentNet = this.networks.find(net => net['.id'] === this.selectedControllerId);
      if (!currentNet) return;

      const formattedRoute = this.newRoute.gateway.trim() 
        ? `${this.newRoute.subnet.trim()}@${this.newRoute.gateway.trim()}` 
        : this.newRoute.subnet.trim();

      const existingRoutes = currentNet.routes ? currentNet.routes.split(',').map(r => r.trim()).filter(Boolean) : [];

      if (existingRoutes.includes(formattedRoute)) {
        return alert('Route tersebut sudah ada di controller ini!');
      }

      existingRoutes.push(formattedRoute);
      const updatedRoutesString = existingRoutes.join(',');

      this.addLog('PATCH', `/api/controller/networks/${currentNet['.id']} (add route)`);
      try {
        const res = await fetch(`/api/controller/networks/${encodeURIComponent(currentNet['.id'])}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ routes: updatedRoutesString })
        });
        const result = await res.json();
        if (result.success) {
          this.addLog('SUCCESS', `Route ${formattedRoute} berhasil ditambahkan`);
          this.showAddRouteModal = false;
          this.newRoute = { subnet: '', gateway: '' };
          this.fetchData();
        } else {
          alert('Gagal menambah route: ' + result.message);
        }
      } catch (e) {
        alert('Error koneksi saat menambah route');
      }
    },

    async submitEditRoute() {
      if (!this.selectedControllerId || !this.editRouteData.subnet) {
        return alert('Subnet tujuan wajib diisi!');
      }

      const currentNet = this.networks.find(net => net['.id'] === this.selectedControllerId);
      if (!currentNet) return;

      const newFormattedRoute = this.editRouteData.gateway.trim() 
        ? `${this.editRouteData.subnet.trim()}@${this.editRouteData.gateway.trim()}` 
        : this.editRouteData.subnet.trim();

      const existingRoutes = currentNet.routes ? currentNet.routes.split(',').map(r => r.trim()).filter(Boolean) : [];
      const updatedRoutes = existingRoutes.map(r => r === this.editRouteData.originalRaw ? newFormattedRoute : r);
      const updatedRoutesString = updatedRoutes.join(',');

      this.addLog('PATCH', `/api/controller/networks/${currentNet['.id']} (edit route)`);
      try {
        const res = await fetch(`/api/controller/networks/${encodeURIComponent(currentNet['.id'])}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ routes: updatedRoutesString })
        });
        const result = await res.json();
        if (result.success) {
          this.addLog('SUCCESS', `Route berhasil diperbarui`);
          this.showEditRouteModal = false;
          this.fetchData();
        } else {
          alert('Gagal update route: ' + result.message);
        }
      } catch (e) {
        alert('Error koneksi saat memperbarui route');
      }
    },

    async confirmDeleteRoute() {
      if (!this.routeToDelete) return;

      const currentNet = this.networks.find(net => net['.id'] === this.selectedControllerId);
      if (!currentNet) return;

      const existingRoutes = currentNet.routes ? currentNet.routes.split(',').map(r => r.trim()).filter(Boolean) : [];
      const updatedRoutes = existingRoutes.filter(r => r !== this.routeToDelete).join(',');

      this.addLog('PATCH', `/api/controller/networks/${currentNet['.id']} (delete route)`);
      try {
        const res = await fetch(`/api/controller/networks/${encodeURIComponent(currentNet['.id'])}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ routes: updatedRoutes })
        });
        const result = await res.json();
        if (result.success) {
          this.addLog('SUCCESS', `Route berhasil dihapus`);
          this.showDeleteRouteModal = false;
          this.routeToDelete = null;
          this.fetchData();
        } else {
          alert('Gagal hapus route: ' + result.message);
        }
      } catch (e) {
        alert('Error koneksi saat menghapus route');
      }
    },

    async toggleAuth(id, currentAuth) {
      const nextState = !this.parseBool(currentAuth);
      this.addLog('PATCH', `/api/controller/members/${id} (authorized=${nextState})`);
      try {
        const res = await fetch(`/api/controller/members/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ authorized: nextState })
        });
        const result = await res.json();
        if (result.success) {
          this.fetchData();
        } else {
          alert('Gagal ubah otorisasi: ' + result.message);
        }
      } catch (e) {
        alert('Error otorisasi member');
      }
    },

    addLog(type, message) {
      const time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      
      this.logs = [{ time, type, message }, ...this.logs].slice(0, 50);
    }
  }));
});