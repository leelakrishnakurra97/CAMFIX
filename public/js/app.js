/**
 * CAMFIX Main Single-Page Application Router & UI Orchestrator
 */

const app = {
  currentView: 'dashboard',

  init() {
    auth.init();
    this.updateUserUI();
    this.navigate(auth.user ? 'dashboard' : 'home');
    this.startNotificationPolling();
    this.checkEmergencyAlerts();
  },

  updateUserUI() {
    const user = auth.user;
    const navUserName = document.getElementById('navUserName');
    const navUserRole = document.getElementById('navUserRole');
    const authBtn = document.getElementById('authBtn');
    const mainNav = document.getElementById('mainNav');
    const headerQrBtn = document.getElementById('headerQrBtn');
    const navUserInfo = document.getElementById('navUserInfo');

    if (user) {
      if (headerQrBtn) headerQrBtn.style.display = '';
      if (navUserInfo) navUserInfo.style.display = 'flex';
      navUserName.innerText = user.name;
      navUserRole.innerText = user.role;
      authBtn.innerText = 'Logout';
      authBtn.onclick = () => auth.clearSession();

      // Render Nav based on Role
      let navHtml = `
        <span class="nav-item ${this.currentView === 'dashboard' ? 'active' : ''}" onclick="app.navigate('dashboard')">Dashboard</span>
      `;

      if (user.role === 'ADMIN' || user.role === 'MAINTENANCE') {
        navHtml += `
          <span class="nav-item ${this.currentView === 'maintenance' ? 'active' : ''}" onclick="app.navigate('maintenance')">IT Tech Control Desk</span>
          <span class="nav-item ${this.currentView === 'campus-map' ? 'active' : ''}" onclick="app.navigate('campus-map')">Campus Distribution Map</span>
        `;
      } else {
        navHtml += `
          <span class="nav-item ${this.currentView === 'student' ? 'active' : ''}" onclick="app.navigate('student')">My Reported Issues</span>
          <span class="nav-item ${this.currentView === 'campus-map' ? 'active' : ''}" onclick="app.navigate('campus-map')">Campus Distribution Map</span>
        `;
      }

      mainNav.innerHTML = navHtml;
    } else {
      if (headerQrBtn) headerQrBtn.style.display = 'none';
      if (navUserInfo) navUserInfo.style.display = 'none';
      authBtn.innerText = 'Sign In';
      authBtn.onclick = () => app.toggleAuthModal();

      mainNav.innerHTML = '';
    }
  },

  navigate(viewName) {
    this.currentView = viewName;
    const container = document.getElementById('mainContainer');
    const user = auth.user;

    this.updateUserUI();

    if (viewName === 'home') {
      this.renderHomePage(container);
    } else if (viewName === 'student-login' || viewName === 'tech-login' || viewName === 'login') {
      this.renderHomePage(container);
      this.toggleAuthModal();
    } else if (viewName === 'dashboard') {
      if (!user) {
        this.renderHomePage(container);
      } else if (user.role === 'ADMIN' || user.role === 'MAINTENANCE') {
        maintenanceDashboard.render(container);
      } else {
        studentDashboard.render(container);
      }
    } else if (viewName === 'student') {
      if (!user) {
        this.renderHomePage(container);
        this.toggleAuthModal();
      } else {
        studentDashboard.render(container);
      }
    } else if (viewName === 'maintenance') {
      if (!user) {
        this.renderHomePage(container);
        this.toggleAuthModal();
      } else {
        maintenanceDashboard.render(container);
      }
    } else if (viewName === 'admin') {
      if (!user) {
        this.renderHomePage(container);
        this.toggleAuthModal();
      } else {
        maintenanceDashboard.render(container);
      }
    } else if (viewName === 'campus-map') {
      campusMap.render(container);
    }
  },

  renderHomePage(container) {
    this.currentView = 'home';
    this.updateUserUI();

    container.innerHTML = `
      <div class="home-page" style="max-width: 1200px; margin: 0 auto; padding: 0.5rem 0 3rem 0;">
        
        <!-- Hero Section -->
        <div class="glass-panel" style="background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%); border: 2px solid var(--border-dark); padding: 2.75rem 2rem; margin-bottom: 2.5rem; text-align: center;">
          <span class="badge badge-primary" style="margin-bottom: 1rem; font-size: 0.82rem; letter-spacing: 0.08em; padding: 0.35rem 0.85rem;">
            CAMPUS INFRASTRUCTURE PLATFORM
          </span>
          <h1 style="font-size: 2.5rem; color: #1e3a8a; font-weight: 800; line-height: 1.2; margin-bottom: 0.85rem;">
            Smart Campus Issue Reporting &amp; Resolution Engine
          </h1>
          <p style="font-size: 1.1rem; color: var(--text-muted); max-width: 820px; margin: 0 auto 2rem auto; line-height: 1.6;">
            Empowering students to log facility faults with instant QR location detection, and providing IT Techs with rapid triage dispatch and verified Google Drive repair photo verification.
          </p>

          <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
            <button class="btn btn-primary" onclick="app.toggleAuthModal()">
              Sign In to CAMFIX
            </button>
          </div>
        </div>

        <!-- Key Platform Capabilities Showcase -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem;">
          
          <div class="glass-panel" style="background: #ffffff; border: 2px solid var(--border-dark); padding: 1.75rem;">
            <div style="font-size: 1.75rem; margin-bottom: 0.75rem;">📷</div>
            <h3 style="font-size: 1.15rem; color: var(--text-main); font-weight: 800; margin-bottom: 0.5rem;">Instant QR Asset Tracking</h3>
            <p style="font-size: 0.88rem; color: var(--text-muted); line-height: 1.55;">
              Scan any QR label placed on projectors, power distribution boxes, or AC units to automatically pre-fill building, floor, room number, and category with zero manual typing.
            </p>
          </div>

          <div class="glass-panel" style="background: #ffffff; border: 2px solid var(--border-dark); padding: 1.75rem;">
            <div style="font-size: 1.75rem; margin-bottom: 0.75rem;">⚡</div>
            <h3 style="font-size: 1.15rem; color: var(--text-main); font-weight: 800; margin-bottom: 0.5rem;">Explainable Priority &amp; SLA</h3>
            <p style="font-size: 0.88rem; color: var(--text-muted); line-height: 1.55;">
              Automated hazard classification immediately escalates exposed wires and water leaks to Critical/High priority with strict SLA countdown timers and early warning alerts.
            </p>
          </div>

          <div class="glass-panel" style="background: #ffffff; border: 2px solid var(--border-dark); padding: 1.75rem;">
            <div style="font-size: 1.75rem; margin-bottom: 0.75rem;">📂</div>
            <h3 style="font-size: 1.15rem; color: var(--text-main); font-weight: 800; margin-bottom: 0.5rem;">Google Drive Verified Proof</h3>
            <p style="font-size: 0.88rem; color: var(--text-muted); line-height: 1.55;">
              Technicians submit repair photos to the centralized Google Drive folder. IT Techs inspect and attach proof links before students confirm satisfactory resolution.
            </p>
          </div>

        </div>

      </div>
    `;
  },

  toggleAuthModal() {
    this.openModal('authModal');
  },

  switchAuthTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'none';

    if (tab === 'login') {
      document.getElementById('tabLogin').classList.add('active');
      document.getElementById('loginForm').style.display = 'block';
    } else if (tab === 'register') {
      document.getElementById('tabRegister').classList.add('active');
      document.getElementById('registerForm').style.display = 'block';
    }
  },

  openModal(modalId) {
    document.getElementById(modalId).classList.add('show');
  },

  closeModal(modalId) {
    document.getElementById(modalId).classList.remove('show');
  },

  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';
    if (type === 'warning') icon = '⚠️';

    toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 4000);
  },

  toggleNotifications() {
    const dropdown = document.getElementById('notificationDropdown');
    dropdown.classList.toggle('show');
    if (dropdown.classList.contains('show')) {
      this.fetchNotifications();
    }
  },

  async fetchNotifications() {
    if (!auth.token) return;
    try {
      const res = await fetch('/api/notifications', {
        headers: { 'Authorization': `Bearer ${auth.token}` }
      });
      const data = await res.json();

      if (data.success) {
        const badge = document.getElementById('bellBadge');
        if (data.unreadCount > 0) {
          badge.innerText = data.unreadCount;
          badge.style.display = 'flex';
        } else {
          badge.style.display = 'none';
        }

        const list = document.getElementById('notificationList');
        if (data.notifications.length === 0) {
          list.innerHTML = '<div class="empty-state">No notifications</div>';
          return;
        }

        list.innerHTML = data.notifications.map(n => `
          <div class="notif-item ${n.is_read ? '' : 'unread'}" onclick="app.onNotificationClick(${n.id}, ${n.issue_id})">
            <span class="notif-title">${n.title}</span>
            <span class="notif-msg">${n.message}</span>
            <span class="notif-time">${new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        `).join('');
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  },

  async onNotificationClick(notifId, issueId) {
    try {
      await fetch(`/api/notifications/${notifId}/read`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${auth.token}` }
      });
      document.getElementById('notificationDropdown').classList.remove('show');
      this.fetchNotifications();
      if (issueId) {
        this.viewIssueDetail(issueId);
      }
    } catch (err) {
      console.error(err);
    }
  },

  async markAllNotificationsRead() {
    if (!auth.token) return;
    try {
      await fetch('/api/notifications/all/read', {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${auth.token}` }
      });
      this.fetchNotifications();
    } catch (err) {
      console.error(err);
    }
  },

  startNotificationPolling() {
    this.fetchNotifications();
    setInterval(() => {
      this.fetchNotifications();
    }, 15000);
  },

  async checkEmergencyAlerts() {
    try {
      const res = await fetch('/api/issues?priority=CRITICAL');
      const data = await res.json();
      if (data.success && data.issues.length > 0) {
        const activeCritical = data.issues.find(i => i.status !== 'CLOSED');
        const banner = document.getElementById('emergencyBanner');
        const text = document.getElementById('emergencyBannerText');

        if (activeCritical && banner && text) {
          text.innerText = `EMERGENCY CRITICAL SAFETY ISSUE ${activeCritical.issue_code}: "${activeCritical.category}" reported in ${activeCritical.building_code} Room ${activeCritical.room_number}!`;
          banner.style.display = 'block';
          banner.dataset.issueId = activeCritical.id;
        } else if (banner) {
          banner.style.display = 'none';
        }
      }
    } catch (err) {
      console.error(err);
    }
  },

  viewCriticalIssue() {
    const banner = document.getElementById('emergencyBanner');
    if (banner && banner.dataset.issueId) {
      this.viewIssueDetail(banner.dataset.issueId);
    }
  },

  async viewIssueDetail(issueId) {
    if (!auth.token) {
      app.showToast('Please login to view details', 'warning');
      app.toggleAuthModal();
      return;
    }

    try {
      const res = await fetch(`/api/issues/${issueId}`, {
        headers: { 'Authorization': `Bearer ${auth.token}` }
      });
      const data = await res.json();

      if (data.success) {
        const issue = data.issue;
        const timeline = data.timeline;
        const content = document.getElementById('issueDetailContent');

        content.innerHTML = `
          <div class="modal-header" style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div>
              <div style="display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap;">
                <h2 style="margin:0;">${issue.issue_code}</h2>
                <span class="status-badge status-${issue.status.toLowerCase()}">${issue.status.replace('_', ' ')}</span>
                <span class="badge badge-${issue.priority.toLowerCase()}">${issue.priority}</span>
                <button class="btn btn-outline-sm" style="background:#f0f9ff; color:#0369a1; border-color:#0284c7; margin-left:0.5rem;" onclick="app.openShareModal(${issue.id})">📱 Share Details</button>
              </div>
              <p style="margin-top:0.35rem;">Category: <strong>${issue.category}</strong> • Submitted by: <strong>${issue.student_name || 'Student'}</strong></p>
            </div>
          </div>

          <!-- Priority Reason Explanation Box -->
          <div style="background:#eff6ff; border:2px solid var(--border-dark); padding:0.85rem; margin-bottom:1.25rem;">
            <strong style="color:var(--primary);">Smart Explainable Priority Engine Result:</strong>
            <p style="font-size:0.85rem; color:var(--text-main); margin-top:0.25rem;">${issue.priority_reason || 'Standard rule-based priority.'}</p>
          </div>

          <!-- Location & Asset Meta -->
          <div class="filter-bar" style="background:#f1f5f9; margin-bottom:1rem;">
            <div><strong>Location:</strong> ${issue.building_name} (${issue.building_code}) • ${issue.floor_name} • Room ${issue.room_number}</div>
            ${issue.asset_name ? `<div><strong>Asset Identified:</strong> ${issue.asset_name} [${issue.asset_code}]</div>` : ''}
            <div><strong>Assigned Team:</strong> ${issue.assigned_team_name || 'Auto-Assigned Specialty Team'} (${issue.technician_name || 'Unassigned Technician'})</div>
          </div>

          <!-- Process Timeline & Key Dates Strip -->
          <div style="background:#f8fafc; border:2px solid var(--border-dark); padding:0.85rem; margin-bottom:1.25rem; display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:0.75rem;">
            <div>
              <span style="font-size:0.75rem; color:var(--text-sub); font-weight:700; text-transform:uppercase;">📅 Reported Date:</span>
              <div style="font-weight:800; font-size:0.9rem; color:var(--text-main); margin-top:0.2rem;">${new Date(issue.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</div>
            </div>
            <div>
              <span style="font-size:0.75rem; color:var(--text-sub); font-weight:700; text-transform:uppercase;">⏳ Target SLA Deadline:</span>
              <div style="font-weight:800; font-size:0.9rem; color:var(--text-main); margin-top:0.2rem;">${issue.sla_deadline ? new Date(issue.sla_deadline).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Monitored'}</div>
            </div>
            <div>
              <span style="font-size:0.75rem; color:var(--text-sub); font-weight:700; text-transform:uppercase;">🔄 Last Action Date:</span>
              <div style="font-weight:800; font-size:0.9rem; color:var(--text-main); margin-top:0.2rem;">${issue.updated_at ? new Date(issue.updated_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : new Date(issue.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</div>
            </div>
            ${issue.resolved_at ? `
            <div>
              <span style="font-size:0.75rem; color:var(--accent-emerald); font-weight:700; text-transform:uppercase;">✅ Work Resolved At:</span>
              <div style="font-weight:800; font-size:0.9rem; color:#065f46; margin-top:0.2rem;">${new Date(issue.resolved_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</div>
            </div>
            ` : ''}
          </div>

          <!-- Description -->
          <div class="form-group" style="margin-top:1rem;">
            <label>Reported Description:</label>
            <p style="color:var(--text-main); background:#f8fafc; border:2px solid var(--border-dark); padding:0.85rem;">${issue.description}</p>
          </div>

          <!-- Before vs After Photo Proof Comparison -->
          <div class="proof-images-grid">
            <div class="proof-image-card">
              <label>Before Photo Proof (Student Upload):</label>
              <div class="proof-image-preview">
                ${issue.before_image_url ? 
                  `<img src="${issue.before_image_url}" alt="Before Photo Proof" onerror="this.parentElement.innerHTML='<div class=\\'empty-state\\' style=\\'padding:1rem; text-align:center; color:var(--text-sub);\\'>Photo preview unavailable</div>'">` : 
                  '<div class="empty-state" style="padding:1rem; text-align:center; color:var(--text-sub);">No before image provided</div>'}
              </div>
            </div>
            <div class="proof-image-card">
              <label>After Resolution Proof (Technician Upload):</label>
              <div class="proof-image-preview">
                ${issue.after_image_url ? 
                  (issue.after_image_url.includes('drive.google.com') ? 
                    `<div style="padding:1rem; text-align:center; background:#f0f9ff; width:100%; height:100%; display:flex; flex-direction:column; justify-content:center; align-items:center;">
                       <strong style="color:#0369a1; font-size:0.85rem;">📂 Google Drive Proof Attached</strong>
                       <a href="${issue.after_image_url}" target="_blank" class="btn btn-outline-sm" style="margin-top:0.5rem; text-decoration:none; background:#ffffff; color:#0369a1; border-color:#0284c7;">Open Google Drive Photo &rarr;</a>
                     </div>` : 
                    `<img src="${issue.after_image_url}" alt="After Resolution Photo" onerror="this.parentElement.innerHTML='<div class=\\'empty-state\\' style=\\'padding:1rem; text-align:center; color:var(--text-sub);\\'>Resolution photo unavailable</div>'">`
                  ) : '<div class="empty-state" style="padding:1rem; text-align:center; color:var(--text-sub);">Pending technician resolution proof</div>'}
              </div>
            </div>
          </div>

          <!-- Student Resolution Verification Action Panel -->
          ${issue.status === 'AWAITING_VERIFICATION' && auth.user.role === 'STUDENT' ? `
            <div class="verification-proof-box" style="margin-top:1.5rem;">
              <h3 style="color:#059669; margin-bottom:0.5rem;">Action Required: Verify Infrastructure Resolution</h3>
              <p>Technician has submitted resolution proof photo. Please confirm if the issue is solved satisfactorily.</p>
              <div style="display:flex; gap:1rem; margin-top:1rem;">
                <button class="btn btn-success" style="flex:1;" onclick="studentDashboard.verifyResolution(${issue.id}, true)">YES — Confirm & Close Issue</button>
                <button class="btn btn-danger" style="flex:1;" onclick="studentDashboard.verifyResolution(${issue.id}, false)">NO — Reject & Reopen Issue</button>
              </div>
            </div>
          ` : ''}

          <!-- Technician Action Work Panel -->
          ${(auth.user.role === 'MAINTENANCE' || auth.user.role === 'ADMIN') && issue.status !== 'CLOSED' ? `
            <div class="glass-panel" style="margin-top:1.5rem; padding:1.25rem;">
              <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-bottom:1rem;">
                <h3 style="margin:0;">IT Tech Verification & Work Resolution Center</h3>
                <a href="https://drive.google.com/drive/folders/1LlHp7Xu_iHQm5Z3gjb1fmvGwgsYs6By4?usp=drive_link" target="_blank" class="btn btn-outline-sm" style="background:#f0f9ff; color:#0369a1; border-color:#0284c7; text-decoration:none;">📂 Open Worker Google Drive Folder &rarr;</a>
              </div>

              <!-- Google Drive Worker Proof Notice -->
              <div style="background:#eff6ff; border:2px solid #0284c7; padding:0.85rem; margin-bottom:1rem;">
                <strong style="color:#0369a1;">Worker Photo Proof Instructions:</strong>
                <p style="font-size:0.85rem; color:#0f172a; margin-top:0.25rem;">Mechanics and electricians upload after-fix photos to the shared campus Google Drive folder. Inspect the photo in Drive, then attach the link or file below to mark the work done.</p>
              </div>

              <form onsubmit="app.handleTechStatusUpdate(event, ${issue.id})">
                <div class="form-grid">
                  <div class="form-group">
                    <label>Update Work Status</label>
                    <select id="techUpdateStatus" required>
                      <option value="IN_PROGRESS" ${issue.status === 'IN_PROGRESS' ? 'selected' : ''}>In Progress (Work Dispatched to Mechanic)</option>
                      <option value="RESOLVED" ${issue.status === 'RESOLVED' || issue.status === 'AWAITING_VERIFICATION' ? 'selected' : ''}>Mark Verified & Done (Resolution Proof Verified)</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label>Paste Google Drive Photo Proof Link (Recommended)</label>
                    <input type="url" id="techProofUrl" placeholder="https://drive.google.com/file/d/...">
                  </div>
                </div>

                <div class="form-group" style="margin-top:0.75rem;">
                  <label>Or Upload Photo File Directly from Computer</label>
                  <input type="file" id="techProofImage" accept="image/*">
                </div>

                <div class="form-group" style="margin-top:0.75rem;">
                  <label>Verification Notes / Work Performed</label>
                  <textarea id="techActionNotes" rows="2" placeholder="e.g. Mechanic replaced burnt outlet and tested voltage load. Verified from Google Drive photo."></textarea>
                </div>
                <button type="submit" class="btn btn-primary">Update Status on CAMFIX Platform</button>
              </form>
            </div>
          ` : ''}

          <!-- Issue Lifecycle Audit Trail History -->
          <div style="margin-top:1.5rem;">
            <h3>📜 Complete Audit Trail & Status History</h3>
            <div class="timeline">
              ${timeline.map(t => `
                <div class="timeline-item">
                  <div class="timeline-dot"></div>
                  <div class="timeline-content">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                      <strong>${t.action}</strong>
                      <span style="font-size:0.75rem; color:var(--text-sub);">${new Date(t.timestamp).toLocaleString()}</span>
                    </div>
                    <p style="font-size:0.85rem; margin-top:0.25rem;">Actor: <strong>${t.actor_name || 'System'}</strong> • ${t.notes || ''}</p>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `;

        this.openModal('issueDetailModal');
      }
    } catch (err) {
      this.showToast('Error loading issue details', 'error');
    }
  },

  async handleTechStatusUpdate(e, issueId) {
    e.preventDefault();
    const status = document.getElementById('techUpdateStatus').value;
    const notes = document.getElementById('techActionNotes').value;
    const imageFile = document.getElementById('techProofImage').files[0];
    const proofUrl = document.getElementById('techProofUrl') ? document.getElementById('techProofUrl').value.trim() : '';

    const formData = new FormData();
    formData.append('status', status);
    formData.append('notes', notes);
    if (proofUrl) {
      formData.append('resolution_url', proofUrl);
    }
    if (imageFile) {
      formData.append('resolution_image', imageFile);
    }

    try {
      const res = await fetch(`/api/issues/${issueId}/status`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${auth.token}` },
        body: formData
      });
      const data = await res.json();

      if (data.success) {
        this.closeModal('issueDetailModal');
        this.showToast(data.message, 'success');
        if (this.currentView === 'maintenance') maintenanceDashboard.loadIssues();
        else if (this.currentView === 'student') studentDashboard.loadStudentIssues();
        else if (this.currentView === 'admin') adminDashboard.loadAnalytics();
      } else {
        this.showToast(data.error || 'Update failed', 'error');
      }
    } catch (err) {
      this.showToast('Network error updating issue status', 'error');
    }
  },

  currentShareText: '',

  async openShareModal(issueId) {
    try {
      const res = await fetch(`/api/issues/${issueId}`, {
        headers: { 'Authorization': `Bearer ${auth.token}` }
      });
      const data = await res.json();
      if (!data.success) {
        this.showToast('Could not fetch issue details for sharing', 'error');
        return;
      }

      const issue = data.issue;
      const code = String(issue.issue_code || '').startsWith('#') ? issue.issue_code : `#${issue.issue_code}`;
      const locationLine = `${issue.building_code || 'Building'} (${issue.building_name || ''})`;
      const floorLine = issue.floor_name || (issue.floor_number !== undefined ? `Floor ${issue.floor_number}` : 'N/A');
      const roomLine = issue.room_number ? `Room ${issue.room_number}` : 'General Area';
      const assetLine = issue.asset_name ? `${issue.asset_name} ${issue.asset_code ? `[${issue.asset_code}]` : ''}` : 'Not Specified';
      const reporterName = issue.student_name || 'Student';
      const reporterEmail = issue.student_email || 'campus student';
      const deadlineStr = issue.sla_deadline ? new Date(issue.sla_deadline).toLocaleString() : 'Monitored';
      const photoLink = issue.before_image_url ? `${window.location.origin}${issue.before_image_url}` : 'No photo uploaded';
      const driveFolder = 'https://drive.google.com/drive/folders/1LlHp7Xu_iHQm5Z3gjb1fmvGwgsYs6By4?usp=drive_link';

      const shareText = 
`========================================
       CAMFIX DISPATCH SLIP
       Complaint ID: ${code}
========================================

[LOCATION DETAILS]
• Building : ${locationLine}
• Floor    : ${floorLine}
• Room     : ${roomLine}
• Asset    : ${assetLine}

[ISSUE SPECIFICATIONS]
• Category : ${issue.category || 'General'}
• Severity : ${issue.severity || 'Medium'}
• Priority : ${issue.priority || 'MEDIUM'}
• Status   : ${(issue.status || 'REPORTED').replace(/_/g, ' ')}

[STUDENT / REPORTER]
• Name     : ${reporterName}
• Email    : ${reporterEmail}

[PROBLEM DESCRIPTION]
${issue.description || 'No description provided.'}

[DISPATCH TIMELINE & VERIFICATION]
• SLA Deadline  : ${deadlineStr}
• Student Photo : ${photoLink}
• Drive Upload  : ${driveFolder}
• Instructions  : Worker must upload after-fix photo to the Google Drive folder above. IT Tech will verify the photo and update the platform.

========================================
Dispatched by CAMFIX IT Tech Control Desk
========================================`;

      this.currentShareText = shareText;
      const content = document.getElementById('shareComplaintContent');
      if (content) {
        content.innerHTML = `
          <div style="background:#ffffff; border:2px solid var(--border-dark); padding:1.25rem; font-family:'Courier New', Courier, monospace; font-size:0.86rem; line-height:1.45; white-space:pre-wrap; max-height:340px; overflow-y:auto; color:#0f172a; margin-bottom:1rem; box-shadow:inset 0 1px 3px rgba(0,0,0,0.05);">
${this.escapeHtml(shareText)}
          </div>
        `;
      }
      this.openModal('shareComplaintModal');
    } catch (err) {
      this.showToast('Error generating share details', 'error');
    }
  },

  escapeHtml(text) {
    return (text || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  },

  shareViaWhatsApp() {
    if (!this.currentShareText) return;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(this.currentShareText)}`;
    window.open(url, '_blank');
    this.showToast('Opening WhatsApp dispatch share...', 'info');
  },

  shareViaEmail() {
    if (!this.currentShareText) return;
    const subject = encodeURIComponent(`CAMFIX Maintenance Dispatch Slip`);
    const body = encodeURIComponent(this.currentShareText);
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
    this.showToast('Opening email dispatch client...', 'info');
  },

  async copyShareDetails() {
    if (!this.currentShareText) return;
    try {
      await navigator.clipboard.writeText(this.currentShareText);
      this.showToast('📋 Complaint details copied to clipboard!', 'success');
    } catch (err) {
      this.showToast('Copied text summary', 'success');
    }
  }
};

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  app.init();
});
