/**
 * CAMFIX Student Dashboard Controller
 * Handles student issue reporting, QR pre-fill, duplicate detection, and verification
 */

const studentDashboard = {
  buildingsData: [],
  selectedQrAsset: null,

  async render(container) {
    const user = auth.user || { name: 'Student', role: 'STUDENT' };

    container.innerHTML = `
      <div class="dashboard-header">
        <div class="dash-title">
          <h1>Student Issue Portal</h1>
          <p>Welcome back, <strong>${user.name}</strong>. Report, track, and verify campus infrastructure fixes.</p>
        </div>
        <div class="dash-actions">
          <button class="btn btn-primary" onclick="studentDashboard.openReportModal()">
            <span>+</span> Report New Issue
          </button>
        </div>
      </div>

      <!-- Quick KPI Stats -->
      <div class="stats-grid" id="studentKpis">
        <div class="stat-card total-card">
          <div class="stat-info"><span class="stat-value" id="stTotal">0</span><span class="stat-label">My Reports</span></div>
        </div>
        <div class="stat-card open-card">
          <div class="stat-info"><span class="stat-value" id="stOpen">0</span><span class="stat-label">In Progress</span></div>
        </div>
        <div class="stat-card verify-card">
          <div class="stat-info"><span class="stat-value" id="stVerify">0</span><span class="stat-label">Awaiting Verification</span></div>
        </div>
        <div class="stat-card closed-card">
          <div class="stat-info"><span class="stat-value" id="stClosed">0</span><span class="stat-label">Closed Issues</span></div>
        </div>
      </div>

      <!-- Action Required Verification Section (If any awaiting student action) -->
      <div id="studentVerificationAlerts"></div>

      <!-- My Reported Issues List -->
      <div class="glass-panel">
        <div class="panel-header">
          <h2 class="panel-title">My Infrastructure Reports</h2>
          <div class="panel-actions">
            <button class="btn btn-outline-sm" onclick="studentDashboard.loadStudentIssues()">Refresh</button>
          </div>
        </div>

        <div class="issue-grid" id="studentIssueGrid">
          <div class="text-sub">Loading your reports...</div>
        </div>
      </div>
    `;

    await this.loadBuildings();
    await this.loadStudentIssues();
  },

  async loadBuildings() {
    try {
      const res = await fetch('/api/buildings');
      const data = await res.json();
      if (data.success) {
        this.buildingsData = data.buildings;
        this.populateBuildingDropdown();
      }
    } catch (err) {
      console.error('Failed to load buildings:', err);
    }
  },

  populateBuildingDropdown() {
    const sel = document.getElementById('repBuilding');
    if (!sel) return;
    sel.innerHTML = '<option value="">Select Building...</option>' + 
      this.buildingsData.map(b => `<option value="${b.id}">${b.code} — ${b.name}</option>`).join('');
  },

  onBuildingChange() {
    const bId = parseInt(document.getElementById('repBuilding').value, 10);
    const flSel = document.getElementById('repFloor');
    const rmInput = document.getElementById('repRoom');
    
    flSel.innerHTML = '<option value="">Select Floor...</option>';
    rmInput.value = '';
    rmInput.disabled = true;

    if (!bId) {
      flSel.disabled = true;
      return;
    }

    const b = this.buildingsData.find(x => x.id === bId);
    if (b && b.floors) {
      flSel.innerHTML += b.floors.map(f => `<option value="${f.id}">${f.name}</option>`).join('');
      flSel.disabled = false;
    }
  },

  onFloorChange() {
    const fId = parseInt(document.getElementById('repFloor').value, 10);
    const rmInput = document.getElementById('repRoom');
    
    if (!fId) {
      rmInput.disabled = true;
      return;
    }

    rmInput.disabled = false;
  },

  onSeverityChange(elem) {
    if (!elem) return;
    const val = (elem.value || 'medium').toLowerCase();
    elem.className = `severity-select severity-${val}`;
  },

  openReportModal() {
    if (!auth.token) {
      app.showToast('Please login to report an issue', 'warning');
      app.toggleAuthModal();
      return;
    }
    this.selectedQrAsset = null;
    document.getElementById('qrAutoPopulatedBanner').style.display = 'none';
    document.getElementById('issueReportForm').reset();
    const repSev = document.getElementById('repSeverity');
    if (repSev) this.onSeverityChange(repSev);
    this.populateBuildingDropdown();
    app.openModal('reportIssueModal');
  },

  async openReportModalWithQr(asset) {
    this.openReportModal();
    this.selectedQrAsset = asset;

    // Auto-populate Building, Floor, Room, Asset
    const banner = document.getElementById('qrAutoPopulatedBanner');
    const details = document.getElementById('qrBannerDetails');
    banner.style.display = 'flex';
    details.innerHTML = `<strong>${asset.building.code}</strong> • ${asset.floor.name} • Room ${asset.room.number} • <strong>${asset.name} (${asset.asset_id})</strong>`;

    // Preselect building
    const repBuilding = document.getElementById('repBuilding');
    repBuilding.value = asset.building.id;
    this.onBuildingChange();

    // Preselect floor
    const repFloor = document.getElementById('repFloor');
    repFloor.value = asset.floor.id;
    this.onFloorChange();

    // Enter room number
    const repRoom = document.getElementById('repRoom');
    repRoom.value = asset.room.number || asset.room.name || '';
    repRoom.disabled = false;

    // Enter asset
    const repAsset = document.getElementById('repAsset');
    if (repAsset) repAsset.value = `${asset.name} (${asset.asset_id})`;

    // Preselect category if available
    const repCategory = document.getElementById('repCategory');
    if (asset.category && repCategory.querySelector(`option[value="${asset.category}"]`)) {
      repCategory.value = asset.category;
    }
  },

  clearQrAsset() {
    this.selectedQrAsset = null;
    document.getElementById('qrAutoPopulatedBanner').style.display = 'none';
    document.getElementById('issueReportForm').reset();
    this.populateBuildingDropdown();
  },

  previewImage(e) {
    const file = e.target.files[0];
    const box = document.getElementById('imagePreviewBox');
    const img = document.getElementById('imagePreviewImg');

    if (file) {
      const reader = new FileReader();
      reader.onload = function(evt) {
        img.src = evt.target.result;
        box.style.display = 'block';
      };
      reader.readAsDataURL(file);
    } else {
      box.style.display = 'none';
    }
  },

  async submitReport(e) {
    e.preventDefault();
    if (!auth.token) return;

    const category = document.getElementById('repCategory').value;
    const severity = document.getElementById('repSeverity').value;
    const description = document.getElementById('repDescription').value;
    const building_id = document.getElementById('repBuilding').value;
    const floor_id = document.getElementById('repFloor').value;
    const room_input = document.getElementById('repRoom').value.trim();
    const asset_input = document.getElementById('repAsset') ? document.getElementById('repAsset').value.trim() : '';
    const imageFile = document.getElementById('repImage').files[0];

    const formData = new FormData();
    formData.append('category', category);
    formData.append('severity', severity);
    formData.append('description', description);
    formData.append('building_id', building_id);
    formData.append('floor_id', floor_id);
    formData.append('room_id', room_input);
    if (asset_input) {
      formData.append('custom_asset', asset_input);
    }
    if (this.selectedQrAsset) {
      formData.append('asset_id', this.selectedQrAsset.id);
    }
    if (imageFile) {
      formData.append('image', imageFile);
    }

    try {
      const res = await fetch('/api/issues', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${auth.token}` },
        body: formData
      });
      const data = await res.json();

      if (data.success) {
        app.closeModal('reportIssueModal');

        // Check if duplicate warning returned
        if (data.duplicateCheck && data.duplicateCheck.isDuplicate) {
          app.showToast(`⚠️ Report linked to active duplicate issue ${data.duplicateCheck.primaryIssue.issue_code}!`, 'warning');
        } else {
          app.showToast(`Issue ${data.issue.issue_code} reported! Priority calculated: ${data.issue.priority}`, 'success');
        }

        this.loadStudentIssues();
      } else {
        app.showToast(data.error || 'Failed to submit report', 'error');
      }
    } catch (err) {
      app.showToast('Network error while submitting issue', 'error');
    }
  },

  async loadStudentIssues() {
    if (!auth.token) return;

    try {
      const res = await fetch(`/api/issues?student_id=${auth.user.id}`, {
        headers: { 'Authorization': `Bearer ${auth.token}` }
      });
      const data = await res.json();

      if (data.success) {
        this.renderKpis(data.issues);
        this.renderVerificationAlerts(data.issues);
        this.renderIssueGrid(data.issues);
      }
    } catch (err) {
      console.error('Failed to load student issues:', err);
    }
  },

  renderKpis(issues) {
    const total = issues.length;
    const open = issues.filter(i => ['REPORTED', 'VERIFIED', 'ASSIGNED', 'IN_PROGRESS', 'REOPENED'].includes(i.status)).length;
    const verify = issues.filter(i => i.status === 'AWAITING_VERIFICATION').length;
    const closed = issues.filter(i => i.status === 'CLOSED').length;

    document.getElementById('stTotal').innerText = total;
    document.getElementById('stOpen').innerText = open;
    document.getElementById('stVerify').innerText = verify;
    document.getElementById('stClosed').innerText = closed;
  },

  renderVerificationAlerts(issues) {
    const verifyIssues = issues.filter(i => i.status === 'AWAITING_VERIFICATION');
    const container = document.getElementById('studentVerificationAlerts');

    if (verifyIssues.length === 0) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = verifyIssues.map(i => `
      <div class="verification-proof-box">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <span class="badge badge-high">Verification Required</span>
            <h3>Issue ${i.issue_code}: Technician Completed Resolution Work</h3>
            <p>${i.category} in ${i.building_code} • Room ${i.room_number}</p>
          </div>
          <button class="btn btn-primary" onclick="app.viewIssueDetail(${i.id})">Review Proof & Verify</button>
        </div>
      </div>
    `).join('');
  },

  renderIssueGrid(issues) {
    const grid = document.getElementById('studentIssueGrid');
    if (issues.length === 0) {
      grid.innerHTML = '<div class="empty-state">You have not submitted any issue reports yet.</div>';
      return;
    }

    grid.innerHTML = issues.map(i => `
      <div class="issue-card ${i.priority === 'CRITICAL' ? 'critical-border' : ''}" onclick="app.viewIssueDetail(${i.id})">
        <div class="issue-card-header">
          <span class="issue-code">${i.issue_code}</span>
          <span class="status-badge status-${i.status.toLowerCase()}">${i.status.replace('_', ' ')}</span>
        </div>
        <div class="issue-meta-row">
          <span class="badge badge-${i.priority.toLowerCase()}">${i.priority}</span>
          <span>• ${new Date(i.created_at).toLocaleDateString()}</span>
        </div>
        <p class="issue-desc">${i.description}</p>
        <div class="location-tag">
          ${i.building_code} • Floor ${i.floor_number} • Room ${i.room_number} ${i.asset_code ? `(${i.asset_code})` : ''}
        </div>
        <!-- Process Dates Box -->
        <div class="process-dates-box" style="background:#f8fafc; border:1px solid var(--border-color); padding:0.45rem 0.65rem; font-size:0.75rem; display:flex; flex-direction:column; gap:0.2rem; margin-top:0.5rem;">
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
      </div>
    `).join('');
  },

  async verifyResolution(issueId, confirmed) {
    let reopenReason = '';
    if (!confirmed) {
      reopenReason = prompt('Please specify why the resolution was unsatisfactory:');
      if (!reopenReason) return;
    }

    try {
      const res = await fetch(`/api/issues/${issueId}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth.token}`
        },
        body: JSON.stringify({ confirmed, reopen_reason: reopenReason })
      });
      const data = await res.json();

      if (data.success) {
        app.closeModal('issueDetailModal');
        app.showToast(data.message, confirmed ? 'success' : 'warning');
        this.loadStudentIssues();
      } else {
        app.showToast(data.error || 'Verification failed', 'error');
      }
    } catch (err) {
      app.showToast('Error recording verification choice', 'error');
    }
  }
};
