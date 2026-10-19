/**
 * CAMFIX Maintenance Staff Dashboard Controller
 * Technician workload management, status updates, SLA countdown, and resolution proof upload
 */

const maintenanceDashboard = {
  currentIssues: [],
  activeTab: 'workload',

  async render(container) {
    const user = auth.user || { name: 'IT Tech Lead', role: 'MAINTENANCE' };

    container.innerHTML = `
      <div class="dashboard-header">
        <div class="dash-title">
          <h1>IT Tech & Central Maintenance Control Desk</h1>
          <p>Control Desk Lead: <strong>${user.name}</strong> • Dispatch Center: <strong>Central Campus Control</strong></p>
        </div>
        <div class="dash-actions">
          <button class="btn btn-outline" onclick="maintenanceDashboard.loadIssues()">Refresh Control Queue</button>
        </div>
      </div>

      <!-- Control Desk Sub-Tabs -->
      <div class="auth-tabs" style="margin-bottom: 1.75rem;">
        <button class="auth-tab ${this.activeTab === 'workload' ? 'active' : ''}" id="maintTabWorkload" onclick="maintenanceDashboard.switchTab('workload')">Workload & Dispatch Queue</button>
        <button class="auth-tab ${this.activeTab === 'campus-map' ? 'active' : ''}" id="maintTabMap" onclick="maintenanceDashboard.switchTab('campus-map')">Campus Distribution Map</button>
        <button class="auth-tab ${this.activeTab === 'analytics' ? 'active' : ''}" id="maintTabAnalytics" onclick="maintenanceDashboard.switchTab('analytics')">Facility & SLA Controls</button>
      </div>

      <div id="maintTabContent"></div>
    `;

    await this.switchTab(this.activeTab);
  },

  async switchTab(tabName) {
    this.activeTab = tabName;
    const content = document.getElementById('maintTabContent');
    if (!content) return;

    // Update active tab buttons
    document.querySelectorAll('.auth-tabs .auth-tab').forEach(btn => btn.classList.remove('active'));
    if (tabName === 'workload' && document.getElementById('maintTabWorkload')) document.getElementById('maintTabWorkload').classList.add('active');
    if (tabName === 'campus-map' && document.getElementById('maintTabMap')) document.getElementById('maintTabMap').classList.add('active');
    if (tabName === 'analytics' && document.getElementById('maintTabAnalytics')) document.getElementById('maintTabAnalytics').classList.add('active');

    if (tabName === 'workload') {
      content.innerHTML = `
        <!-- Workload KPI Summary -->
        <div class="stats-grid">
          <div class="stat-card total-card">
            <div class="stat-info"><span class="stat-value" id="techAssigned">0</span><span class="stat-label">Assigned Workload</span></div>
          </div>
          <div class="stat-card critical-card">
            <div class="stat-info"><span class="stat-value" id="techCritical">0</span><span class="stat-label">Critical Priority</span></div>
          </div>
          <div class="stat-card open-card">
            <div class="stat-info"><span class="stat-value" id="techDueSoon">0</span><span class="stat-label">Due Soon (&lt; 2h)</span></div>
          </div>
          <div class="stat-card breached-card">
            <div class="stat-info"><span class="stat-value" id="techBreached">0</span><span class="stat-label">SLA Breached</span></div>
          </div>
        </div>

        <!-- Filter Controls Bar -->
        <div class="filter-bar">
          <div class="filter-group">
            <label>Status</label>
            <select id="maintFilterStatus" onchange="maintenanceDashboard.applyFilters()">
              <option value="">All Active Statuses</option>
              <option value="ASSIGNED">Assigned</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="REOPENED">Reopened</option>
              <option value="AWAITING_VERIFICATION">Awaiting Verification</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>

          <div class="filter-group">
            <label>Priority</label>
            <select id="maintFilterPriority" onchange="maintenanceDashboard.applyFilters()">
              <option value="">All Priorities</option>
              <option value="CRITICAL">Critical Only</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>

          <div class="filter-group">
            <label>SLA Status</label>
            <select id="maintFilterSla" onchange="maintenanceDashboard.applyFilters()">
              <option value="">All SLA States</option>
              <option value="BREACHED">Breached</option>
              <option value="APPROACHING DEADLINE">Approaching Deadline</option>
              <option value="ON TRACK">On Track</option>
            </select>
          </div>

          <div class="filter-group" style="flex:2;">
            <label>Search Keyword</label>
            <input type="text" id="maintFilterSearch" placeholder="Search by Issue #, description, room..." oninput="maintenanceDashboard.applyFilters()">
          </div>
        </div>

        <!-- Workload Queue List -->
        <div class="glass-panel">
          <div class="panel-header">
            <h2 class="panel-title">Central Campus Workload & Dispatch Queue</h2>
          </div>

          <div class="issue-grid" id="maintIssueGrid">
            <div class="text-sub">Loading workload queue...</div>
          </div>
        </div>
      `;

      await this.loadIssues();
    } else if (tabName === 'campus-map') {
      await campusMap.render(content);
    } else if (tabName === 'analytics') {
      await adminDashboard.render(content);
    }
  },

  async loadIssues() {
    if (!auth.token) return;

    try {
      const res = await fetch('/api/issues', {
        headers: { 'Authorization': `Bearer ${auth.token}` }
      });
      const data = await res.json();

      if (data.success) {
        this.currentIssues = data.issues;
        this.renderKpis(data.issues);
        this.applyFilters();
      }
    } catch (err) {
      console.error('Failed to load maintenance issues:', err);
    }
  },

  renderKpis(issues) {
    const assigned = issues.filter(i => i.status !== 'CLOSED').length;
    const critical = issues.filter(i => i.priority === 'CRITICAL' && i.status !== 'CLOSED').length;
    const dueSoon = issues.filter(i => i.sla_status === 'APPROACHING DEADLINE' && i.status !== 'CLOSED').length;
    const breached = issues.filter(i => i.sla_status === 'BREACHED' && i.status !== 'CLOSED').length;

    document.getElementById('techAssigned').innerText = assigned;
    document.getElementById('techCritical').innerText = critical;
    document.getElementById('techDueSoon').innerText = dueSoon;
    document.getElementById('techBreached').innerText = breached;
  },

  applyFilters() {
    const status = document.getElementById('maintFilterStatus').value;
    const priority = document.getElementById('maintFilterPriority').value;
    const sla = document.getElementById('maintFilterSla').value;
    const search = document.getElementById('maintFilterSearch').value.toLowerCase().trim();

    let filtered = this.currentIssues;

    if (status) filtered = filtered.filter(i => i.status === status);
    if (priority) filtered = filtered.filter(i => i.priority === priority);
    if (sla) filtered = filtered.filter(i => i.sla_status === sla);
    if (search) {
      filtered = filtered.filter(i => 
        i.issue_code.toLowerCase().includes(search) ||
        i.description.toLowerCase().includes(search) ||
        i.building_code.toLowerCase().includes(search) ||
        i.room_number.toLowerCase().includes(search)
      );
    }

    this.renderGrid(filtered);
  },

  renderGrid(issues) {
    const grid = document.getElementById('maintIssueGrid');
    if (issues.length === 0) {
      grid.innerHTML = '<div class="empty-state">No matching maintenance tasks in queue.</div>';
      return;
    }

    grid.innerHTML = issues.map(i => {
      let slaClass = 'sla-on-track';
      if (i.sla_status === 'BREACHED') slaClass = 'sla-breached';
      else if (i.sla_status === 'APPROACHING DEADLINE') slaClass = 'sla-approaching';

      return `
        <div class="issue-card ${i.priority === 'CRITICAL' ? 'critical-border' : ''}">
          <div class="issue-card-header">
            <span class="issue-code">${i.issue_code}</span>
            <span class="status-badge status-${i.status.toLowerCase()}">${i.status.replace('_', ' ')}</span>
          </div>

          <div class="issue-meta-row">
            <span class="badge badge-${i.priority.toLowerCase()}">${i.priority}</span>
            <span class="sla-tag ${slaClass}">${i.sla_time_remaining || 'SLA Monitored'}</span>
          </div>

          <p class="issue-desc"><strong>[${i.category}]</strong> ${i.description}</p>
          
          <div class="location-tag">
            ${i.building_code} • Floor ${i.floor_number} • Room ${i.room_number} ${i.asset_code ? `(${i.asset_code})` : ''}
          </div>

          <!-- Process Dates Timeline Box -->
          <div class="process-dates-box" style="background:#f8fafc; border:1px solid var(--border-color); padding:0.5rem 0.65rem; font-size:0.75rem; display:flex; flex-direction:column; gap:0.25rem;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="color:var(--text-sub); font-weight:700;">📅 Reported:</span>
              <strong style="color:var(--text-main);">${new Date(i.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</strong>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="color:var(--text-sub); font-weight:700;">⏳ SLA Deadline:</span>
              <strong style="color:var(--text-main);">${i.sla_deadline ? new Date(i.sla_deadline).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Monitored'}</strong>
            </div>
            ${i.updated_at ? `
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="color:var(--text-sub); font-weight:700;">🔄 Last Step:</span>
              <strong style="color:var(--text-main);">${new Date(i.updated_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</strong>
            </div>
            ` : ''}
          </div>

          ${i.reopen_count > 0 ? `
            <div style="background:#fee2e2; color:#991b1b; border:1px solid #0f172a; padding:0.4rem 0.6rem; font-size:0.75rem; font-weight:700;">
              Reopened by student (${i.reopen_count}x). Reason: ${i.reopen_reason || 'N/A'}
            </div>
          ` : ''}

          <div class="issue-card-actions" style="margin-top:0.85rem; display:flex; flex-direction:column; gap:0.5rem;">
            <div style="display:flex; gap:0.5rem; width:100%;">
              <button class="btn btn-outline-sm" style="flex:1; text-align:center; justify-content:center;" onclick="app.viewIssueDetail(${i.id})">Details & Proof</button>
              <button class="btn btn-outline-sm" style="flex:1; text-align:center; justify-content:center; background:#f0f9ff; color:#0369a1; border-color:#0284c7;" onclick="app.openShareModal(${i.id})">📱 Share Complaint</button>
            </div>
            <div style="width:100%;">
              ${this.renderActionButtons(i)}
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  renderActionButtons(issue) {
    if (issue.status === 'ASSIGNED' || issue.status === 'REPORTED' || issue.status === 'VERIFIED') {
      return `<button class="btn btn-primary btn-sm" style="width:100%; text-align:center; justify-content:center;" onclick="maintenanceDashboard.updateStatus(${issue.id}, 'IN_PROGRESS')">Accept & Start Work</button>`;
    } else if (issue.status === 'IN_PROGRESS' || issue.status === 'REOPENED') {
      return `<button class="btn btn-success btn-sm" style="width:100%; text-align:center; justify-content:center;" onclick="maintenanceDashboard.openResolutionModal(${issue.id})">Upload Fix Photo & Resolve</button>`;
    } else {
      return `
        <div style="width:100%; display:flex; align-items:center; justify-content:center; gap:0.5rem; background:#f8fafc; border:1px solid var(--border-dark); padding:0.4rem 0.6rem; font-size:0.8rem; font-weight:700; color:var(--text-main);">
          <span>Status:</span>
          <span class="status-badge status-${issue.status.toLowerCase()}">${issue.status.replace('_', ' ')}</span>
        </div>
      `;
    }
  },

  async updateStatus(issueId, newStatus, notes = '') {
    try {
      const res = await fetch(`/api/issues/${issueId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth.token}`
        },
        body: JSON.stringify({ status: newStatus, notes })
      });
      const data = await res.json();

      if (data.success) {
        app.showToast(`Task updated to ${newStatus}`, 'success');
        this.loadIssues();
      } else {
        app.showToast(data.error || 'Failed to update status', 'error');
      }
    } catch (err) {
      app.showToast('Network error updating task', 'error');
    }
  },

  openResolutionModal(issueId) {
    app.viewIssueDetail(issueId);
  }
};
