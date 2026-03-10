/* ═══════════════════════════════════════════════════
   dashboard.js — Map, stats, polygon, recent alerts
   Depends on: config.js, detections.js, users.js
═══════════════════════════════════════════════════ */

// ── Load all dashboard data ───────────────────────
async function loadDashboard() {
  if (!currentUser) return;

  document.getElementById('dash-subtitle').textContent =
    `Showing data for ${currentUser.institution || 'your institution'}`;
  document.getElementById('map-institution-label').textContent =
    currentUser.institution || '';

  await Promise.all([
    loadPolygon(),
    loadDetections(),
    loadUsers(),
  ]);

  updateStats();
}

window.refreshDashboard = function () { loadDashboard(); };

// ── Leaflet map + geofence polygon ────────────────
async function loadPolygon() {
  if (!leafletMap) {
    leafletMap = L.map('map', { zoomControl: true }).setView([51.5074, -0.1278], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    }).addTo(leafletMap);
  }

  try {
    const params = new URLSearchParams({ institution: currentUser.institution });
    const res = await fetch(`${API_BASE}/bella/geofence?${params}`, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    applyPolygon(data);
  } catch (err) {
    console.warn('[dashboard] geofence fetch failed — using fallback demo polygon');
    applyPolygon({
      type: 'Feature',
      geometry: {
        type: 'MultiPolygon',
        coordinates: [[[
          [-0.1278, 51.5074], [-0.1270, 51.5074],
          [-0.1270, 51.5080], [-0.1278, 51.5080],
          [-0.1278, 51.5074],
        ]]],
      },
    });
  }
}

function applyPolygon(geo) {
  if (polygonLayer) leafletMap.removeLayer(polygonLayer);
  polygonLayer = L.geoJSON(geo, {
    style: {
      color: '#3b82f6',
      weight: 2,
      opacity: 0.9,
      fillColor: '#3b82f6',
      fillOpacity: 0.12,
    },
  }).addTo(leafletMap);
  leafletMap.fitBounds(polygonLayer.getBounds(), { padding: [24, 24] });
}

// ── Fetch detections + update badge ──────────────
async function loadDetections() {
  try {
    const qs = currentUser?.institution ? '?' + new URLSearchParams({ institution: currentUser.institution }) : '';
    const res = await fetch(`${API_BASE}/bella/detections${qs}`, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    allDetections = data || [];
  } catch {
    allDetections = [
      { id:'d1', type:'Smoke Detection',  location:'Building A, Floor 2', institution: currentUser?.institution, severity:'high',   status:'resolved', time:'2026-03-10T08:32:00Z' },
      { id:'d2', type:'Motion Detected',  location:'Parking Zone C',      institution: currentUser?.institution, severity:'low',    status:'active',   time:'2026-03-10T09:15:00Z' },
      { id:'d3', type:'Perimeter Breach', location:'East Fence Line',     institution: currentUser?.institution, severity:'high',   status:'active',   time:'2026-03-10T10:01:00Z' },
      { id:'d4', type:'Object Detected',  location:'Main Entrance',       institution: currentUser?.institution, severity:'medium', status:'resolved', time:'2026-03-09T14:22:00Z' },
      { id:'d5', type:'Thermal Anomaly',  location:'Server Room',         institution: currentUser?.institution, severity:'medium', status:'active',   time:'2026-03-09T18:45:00Z' },
    ];
  }

  // Update sidebar badge
  const activeCount = allDetections.filter(d => d.status === 'active').length;
  const badge = document.getElementById('history-badge');
  if (activeCount > 0) { badge.textContent = activeCount; badge.classList.add('show'); }
  else { badge.classList.remove('show'); }

  renderRecentAlerts();
}

// ── Recent alerts widget ──────────────────────────
function renderRecentAlerts() {
  const container = document.getElementById('recent-alerts-list');
  const recent = [...allDetections]
    .sort((a, b) => new Date(b.time) - new Date(a.time))
    .slice(0, 6);

  if (!recent.length) {
    container.innerHTML = '<div class="empty-state-sm">No alerts yet</div>';
    return;
  }

  container.innerHTML = recent.map(d => `
    <div class="alert-item">
      <div class="alert-dot ${d.severity || 'low'}"></div>
      <div class="alert-content">
        <div class="alert-type">${esc(d.type)}</div>
        <div class="alert-meta">${esc(d.location)} &middot; ${formatTime(d.time)}</div>
      </div>
      <span class="badge badge-${d.status === 'active' ? 'active' : 'resolved'}">${d.status || ''}</span>
    </div>
  `).join('');
}

// ── Stat cards ────────────────────────────────────
function updateStats() {
  document.getElementById('stat-zones').textContent      = polygonLayer ? '1' : '0';
  const active = allDetections.filter(d => d.status === 'active').length;
  document.getElementById('stat-alerts').textContent     = active;
  document.getElementById('stat-detections').textContent = allDetections.length;
  document.getElementById('stat-users').textContent      = allUsers.length;
}
