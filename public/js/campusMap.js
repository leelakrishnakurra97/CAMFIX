/**
 * CAMFIX Campus Issue Distribution Visual Heatmap Controller
 */

const campusMap = {
  async render(container) {
    container.innerHTML = `
      <div class="glass-panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">Visual Campus Infrastructure Distribution Map</h2>
          </div>
          <button class="btn btn-outline-sm" onclick="campusMap.loadMap()">Refresh Map</button>
        </div>

        <div class="campus-map-grid" id="campusMapGrid">
          <div class="text-sub">Loading campus map...</div>
        </div>
      </div>
    `;

    await this.loadMap();
  },

  async loadMap() {
    try {
      const res = await fetch('/api/analytics/campus-map', {
        headers: { 'Authorization': `Bearer ${auth.token}` }
      });
      const data = await res.json();

      if (data.success) {
        this.renderMapGrid(data.campusMap);
      }
    } catch (err) {
      console.error('Failed to load campus map:', err);
    }
  },

  renderMapGrid(buildings) {
    const grid = document.getElementById('campusMapGrid');
    if (!grid) return;

    grid.innerHTML = buildings.map(b => {
      const hasIssues = b.total_issues > 0;
      const hasCritical = b.floors.some(f => f.rooms.some(r => r.has_critical));

      let cardClass = 'map-building-card';
      if (hasCritical) cardClass += ' has-critical';
      else if (hasIssues) cardClass += ' has-issues';

      return `
        <div class="${cardClass}">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <h3>${b.code} — ${b.name}</h3>
            <span class="badge ${hasCritical ? 'badge-critical' : (hasIssues ? 'badge-high' : 'badge-low')}">
              ${b.total_issues} Active Issues
            </span>
          </div>

          <p class="text-sub" style="font-size:0.8rem;">${b.description || ''}</p>

          ${b.floors.map(f => `
            <div class="map-floor-row">
              <strong style="font-size:0.85rem; color:var(--text-muted);">${f.name}</strong>
              <div class="map-room-pills">
                ${f.rooms.map(r => {
                  let pillClass = 'clean';
                  if (r.has_critical) pillClass = 'critical';
                  else if (r.issue_count > 0) pillClass = 'warning';

                  return `
                    <span class="room-pill ${pillClass}" title="${r.issue_count} issue(s) reported in ${r.name}">
                      Room ${r.room_number} ${r.issue_count > 0 ? `(${r.issue_count})` : '✓'}
                    </span>
                  `;
                }).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }).join('');
  }
};
