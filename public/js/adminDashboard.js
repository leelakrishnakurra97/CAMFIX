/**
 * CAMFIX Administrator Dashboard & Analytics Hub
 * KPIs, Chart.js visualizations, SLA Rules Manager, QR Code Hub, and User/Team Management
 */

const adminDashboard = {
  charts: {},
  activeTab: 'qr-manager',

  async render(container) {
    const user = auth.user || { name: 'Admin', role: 'ADMIN' };

    container.innerHTML = `
      <!-- Navigation Sub-Tabs -->
      <div class="auth-tabs" id="adminSubTabs" style="margin-bottom: 1.75rem;">
        <button class="auth-tab ${this.activeTab === 'qr-manager' ? 'active' : ''}" data-tab="qr-manager" onclick="adminDashboard.switchTab('qr-manager')">Asset & QR Manager</button>
        <button class="auth-tab ${this.activeTab === 'sla-manager' ? 'active' : ''}" data-tab="sla-manager" onclick="adminDashboard.switchTab('sla-manager')">SLA Rules Config</button>
        <button class="auth-tab ${this.activeTab === 'user-manager' ? 'active' : ''}" data-tab="user-manager" onclick="adminDashboard.switchTab('user-manager')">Users & Teams</button>
        <button class="auth-tab ${this.activeTab === 'campus-map' ? 'active' : ''}" data-tab="campus-map" onclick="adminDashboard.switchTab('campus-map')">Campus Distribution Map</button>
      </div>

      <div id="adminTabContent">
        <!-- Sub-tab content dynamically rendered -->
      </div>
    `;

    this.switchTab(this.activeTab);
  },

  async switchTab(tabName) {
    this.activeTab = tabName;

    // Toggle active class on all subtab buttons
    document.querySelectorAll('#adminSubTabs .auth-tab').forEach(btn => {
      if (btn.getAttribute('data-tab') === tabName) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    const content = document.getElementById('adminTabContent');
    if (!content) return;

    if (tabName === 'campus-map') {
      campusMap.render(content);
    } else if (tabName === 'qr-manager') {
      this.renderQrManager(content);
    } else if (tabName === 'sla-manager') {
      this.renderSlaManager(content);
    } else if (tabName === 'user-manager') {
      this.renderUserManager(content);
    }
  },

  async renderQrManager(container) {
    container.innerHTML = `
      <div class="glass-panel">
        <div class="panel-header">
          <h2 class="panel-title">Asset & QR Code Management</h2>
          <button class="btn btn-primary" onclick="adminDashboard.openCreateAssetModal()">+ Create New Asset & QR</button>
        </div>

        <div class="issue-grid" id="adminAssetGrid">
          <div class="text-sub">Loading campus assets...</div>
        </div>
      </div>
    `;

    try {
      const res = await fetch('/api/assets');
      const data = await res.json();
      if (data.success) {
        const grid = document.getElementById('adminAssetGrid');
        grid.innerHTML = data.assets.map(a => `
          <div class="issue-card">
            <div class="issue-card-header">
              <strong style="font-size:1.1rem; color:var(--primary);">${a.asset_id}</strong>
              <span class="badge ${a.is_active ? 'badge-low' : 'badge-critical'}">${a.is_active ? 'Active' : 'Disabled'}</span>
            </div>
            <p><strong>${a.name}</strong> (${a.category})</p>
            <div class="location-tag">${a.building_code} • ${a.floor_name} • Room ${a.room_number}</div>
            <div style="margin-top:0.5rem; display:flex; gap:0.5rem;">
              <a href="/uploads/qrcodes/${a.asset_id}.png" download="${a.asset_id}.png" class="btn btn-outline-sm">Download QR</a>
              <button class="btn btn-outline-sm" onclick="window.open('/uploads/qrcodes/${a.asset_id}.png')">Print</button>
              <button class="btn btn-outline-sm" onclick="adminDashboard.toggleAssetStatus(${a.id}, ${!a.is_active})">${a.is_active ? 'Disable' : 'Enable'}</button>
            </div>
          </div>
        `).join('');
      }
    } catch (err) {
      console.error('Failed to load assets:', err);
    }
  },

  async toggleAssetStatus(id, isActive) {
    try {
      const res = await fetch(`/api/assets/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${auth.token}` },
        body: JSON.stringify({ is_active: isActive })
      });
      const data = await res.json();
      if (data.success) {
        app.showToast(data.message, 'success');
        this.renderQrManager(document.getElementById('adminTabContent'));
      }
    } catch (err) {
      app.showToast('Failed to update asset status', 'error');
    }
  },

  openCreateAssetModal() {
    const assetId = prompt('Enter New Unique Asset ID (e.g. AB2-305-P02):');
    if (!assetId) return;
    const name = prompt('Enter Asset Name (e.g. Overhead Projector 2):');
    if (!name) return;
    const category = prompt('Enter Category (e.g. Projector/AV, Electrical, HVAC, Plumbing, IT/Network):', 'Projector/AV');
    if (!category) return;

    this.createAsset(assetId, name, category, 1);
  },

  async createAsset(asset_id, name, category, room_id) {
    try {
      const res = await fetch('/api/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${auth.token}` },
        body: JSON.stringify({ asset_id, name, category, room_id })
      });
      const data = await res.json();
      if (data.success) {
        app.showToast(`Asset ${asset_id} created with QR Code!`, 'success');
        this.renderQrManager(document.getElementById('adminTabContent'));
      } else {
        app.showToast(data.error || 'Failed to create asset', 'error');
      }
    } catch (err) {
      app.showToast('Network error creating asset', 'error');
    }
  },

  async renderSlaManager(container) {
    container.innerHTML = `
      <div class="glass-panel">
        <div class="panel-header">
          <h2 class="panel-title">SLA Configuration & Target Rules</h2>
        </div>
        <div id="slaRulesTable">
          <div style="padding: 1.5rem 0; color: var(--text-sub); font-weight: 600;">Loading SLA rules...</div>
        </div>
      </div>
    `;

    try {
      const res = await fetch('/api/sla/rules', {
        headers: { 'Authorization': `Bearer ${auth.token}` }
      });
      const data = await res.json();
      if (data.success && data.rules) {
        const table = document.getElementById('slaRulesTable');
        table.innerHTML = `
          <div style="overflow-x: auto;">
            <table style="width:100%; text-align:left; border-collapse:collapse;">
              <thead>
                <tr style="border-bottom: 2px solid var(--border-dark); color: var(--text-main); font-weight: 800; font-size: 0.85rem; text-transform: uppercase;">
                  <th style="padding: 0.85rem 1rem;">Category</th>
                  <th style="padding: 0.85rem 1rem;">Severity</th>
                  <th style="padding: 0.85rem 1rem;">Resolution SLA Target</th>
                  <th style="padding: 0.85rem 1rem;">Early Warning Threshold</th>
                </tr>
              </thead>
              <tbody>
                ${data.rules.map(r => `
                  <tr style="border-bottom: 1px solid var(--border-color);">
                    <td style="padding: 0.85rem 1rem;"><strong>${r.category}</strong></td>
                    <td style="padding: 0.85rem 1rem;"><span class="badge badge-${r.severity.toLowerCase()}">${r.severity}</span></td>
                    <td style="padding: 0.85rem 1rem; font-weight: 700;">${r.resolution_hours} Hours</td>
                    <td style="padding: 0.85rem 1rem; font-weight: 600; color: var(--text-sub);">${r.warning_hours} Hours</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      } else {
        const table = document.getElementById('slaRulesTable');
        if (table) table.innerHTML = `<div style="padding: 1rem 0; color: var(--accent-crimson); font-weight: 700;">Failed to load SLA rules.</div>`;
      }
    } catch (err) {
      console.error('Failed to load SLA rules:', err);
    }
  },

  async renderUserManager(container) {
    container.innerHTML = `
      <div class="glass-panel">
        <div class="panel-header">
          <h2 class="panel-title">Users & Maintenance Teams Roster</h2>
        </div>
        <div id="usersTable">
          <div style="padding: 1.5rem 0; color: var(--text-sub); font-weight: 600;">Loading users and teams...</div>
        </div>
      </div>
    `;

    try {
      const res = await fetch('/api/users', {
        headers: { 'Authorization': `Bearer ${auth.token}` }
      });
      const data = await res.json();
      if (data.success && data.users) {
        const table = document.getElementById('usersTable');
        table.innerHTML = `
          <div style="overflow-x: auto;">
            <table style="width:100%; text-align:left; border-collapse:collapse;">
              <thead>
                <tr style="border-bottom: 2px solid var(--border-dark); color: var(--text-main); font-weight: 800; font-size: 0.85rem; text-transform: uppercase;">
                  <th style="padding: 0.85rem 1rem;">Name</th>
                  <th style="padding: 0.85rem 1rem;">Email</th>
                  <th style="padding: 0.85rem 1rem;">System Role</th>
                  <th style="padding: 0.85rem 1rem;">Assigned Maintenance Team</th>
                </tr>
              </thead>
              <tbody>
                ${data.users.map(u => `
                  <tr style="border-bottom: 1px solid var(--border-color);">
                    <td style="padding: 0.85rem 1rem;"><strong>${u.name}</strong></td>
                    <td style="padding: 0.85rem 1rem; color: var(--text-muted);">${u.email}</td>
                    <td style="padding: 0.85rem 1rem;"><span class="badge ${u.role === 'ADMIN' ? 'badge-critical' : u.role === 'MAINTENANCE' ? 'badge-primary' : 'badge-low'}">${u.role}</span></td>
                    <td style="padding: 0.85rem 1rem; font-weight: 600;">${u.team_name || '—'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      } else {
        const table = document.getElementById('usersTable');
        if (table) table.innerHTML = `<div style="padding: 1rem 0; color: var(--accent-crimson); font-weight: 700;">${data.error || 'Failed to load users roster'}</div>`;
      }
    } catch (err) {
      console.error('Failed to load users:', err);
      const table = document.getElementById('usersTable');
      if (table) table.innerHTML = `<div style="padding: 1rem 0; color: var(--accent-crimson); font-weight: 700;">Network error loading users roster.</div>`;
    }
  }
};
