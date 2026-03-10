/* ═══════════════════════════════════════════════════════════════
   bella.js — Spairally B2B Platform
   Sections: config · auth · navigation · dashboard · detections · users · app
════════════════════════════════════════════════════════════════ */


// ─────────────────────────────────────────────────────────────
// config
// ─────────────────────────────────────────────────────────────

const API_BASE = "https://nchisecapi-production.up.railway.app";

function getAuthHeaders() {
  const token = localStorage.getItem('spairally_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

let currentUser    = null;
let allDetections  = [];
let allUsers       = [];
let leafletMap     = null;
let polygonLayer   = null;

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit',
  });
}

function severityClass(s) {
  const map = { high: 'high', medium: 'medium', low: 'low' };
  return map[(s || '').toLowerCase()] || 'low';
}


// ─────────────────────────────────────────────────────────────
// auth
// ─────────────────────────────────────────────────────────────

function setToken(token) {
  localStorage.setItem('spairally_token', token);
}

function clearToken() {
  localStorage.removeItem('spairally_token');
  localStorage.removeItem('spairally_user');
}

function saveUser(user) {
  localStorage.setItem('spairally_user', JSON.stringify(user));
}

function getSavedUser() {
  try { return JSON.parse(localStorage.getItem('spairally_user')); }
  catch { return null; }
}

function parseJwt(token) {
  try { return JSON.parse(atob(token.split('.')[1])); }
  catch { return {}; }
}

window.switchAuthTab = function (tab) {
  document.getElementById('login-form').style.display    = tab === 'login'    ? '' : 'none';
  document.getElementById('register-form').style.display = tab === 'register' ? '' : 'none';
  document.getElementById('tab-login').classList.toggle('active',    tab === 'login');
  document.getElementById('tab-register').classList.toggle('active', tab === 'register');
};

function showAuthError(formId, msg) {
  const el = document.getElementById(formId);
  el.textContent = msg;
  el.style.display = '';
}

function clearAuthError(formId) {
  document.getElementById(formId).style.display = 'none';
}

function setBtnLoading(btn, loading) {
  btn.querySelector('.btn-text').style.display    = loading ? 'none' : '';
  btn.querySelector('.btn-spinner').style.display = loading ? '' : 'none';
  btn.disabled = loading;
}

function initAuthListeners() {
  // Login
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAuthError('login-error');
    const btn      = e.target.querySelector('button[type=submit]');
    const email    = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    setBtnLoading(btn, true);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw { response: { status: res.status, data } };
      setToken(data.token);
      saveUser(data.user);
      onLogin(data.user);
    } catch (err) {
      const msg = err.response?.data?.error
        || err.response?.data?.message
        || err.response?.data
        || err.message
        || 'Invalid credentials. Try again.';
      showAuthError('login-error', typeof msg === 'object' ? JSON.stringify(msg) : msg);
    } finally {
      setBtnLoading(btn, false);
    }
  });

  // Register
  document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAuthError('register-error');
    const btn          = e.target.querySelector('button[type=submit]');
    const firstName    = document.getElementById('reg-firstName').value.trim();
    const lastName     = document.getElementById('reg-lastName').value.trim();
    const email        = document.getElementById('reg-email').value.trim();
    const organization = document.getElementById('reg-organization').value.trim();
    const password     = document.getElementById('reg-password').value;
    setBtnLoading(btn, true);
    const payload = { firstName, lastName, email, password, organization };
    console.log('[REGISTER] URL:', `${API_BASE}/auth/register`);
    console.log('[REGISTER] Payload:', JSON.stringify(payload, null, 2));
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw { response: { status: res.status, data } };
      setToken(data.token);
      saveUser(data.user);
      onLogin(data.user);
    } catch (err) {
      showAuthError('register-error', err.response?.data?.error || 'Registration failed. Try again.');
    } finally {
      setBtnLoading(btn, false);
    }
  });
}

function onLogin(user) {
  currentUser = user;
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app').style.display = '';

  const displayName = [user.firstname, user.lastname].filter(Boolean).join(' ') || 'User';
  const initial = (user.firstname || user.lastname || 'U')[0].toUpperCase();
  document.getElementById('sidebar-avatar').textContent      = initial;
  document.getElementById('topbar-avatar').textContent       = initial;
  document.getElementById('sidebar-username').textContent    = displayName;
  document.getElementById('sidebar-institution').textContent = user.organization || '—';

  const path   = location.pathname.slice(1);
  const target = APP_SECTIONS.includes(path) ? path : 'dashboard';
  navigate(target, document.querySelector('[data-section=' + target + ']'));
  loadDashboard();

  if (window.lucide) lucide.createIcons();
}

window.logout = function () {
  clearToken();
  currentUser   = null;
  allDetections = [];
  allUsers      = [];
  if (leafletMap) { leafletMap.remove(); leafletMap = null; polygonLayer = null; }
  document.getElementById('app').style.display = 'none';
  document.getElementById('auth-screen').style.display = '';
  history.replaceState(null, '', '/login');
};


// ─────────────────────────────────────────────────────────────
// navigation
// ─────────────────────────────────────────────────────────────

const APP_SECTIONS = ['dashboard', 'history', 'users'];

window.navigate = function (section, linkEl) {
  if (linkEl) {
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    if (linkEl.classList) linkEl.classList.add('active');
  }

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const page = document.getElementById('page-' + section);
  if (page) page.classList.add('active');

  const titles = { dashboard: 'Dashboard', history: 'Detection History', users: 'Users' };
  document.getElementById('topbar-title').textContent = titles[section] || section;

  if (section === 'history') renderHistoryTable(allDetections);
  if (section === 'users')   renderUsersGrid(allUsers);

  if (location.pathname !== '/' + section) {
    history.pushState(null, '', '/' + section);
  }

  closeSidebar();
  return false;
};

window.addEventListener('popstate', function () {
  if (!currentUser) return;
  const section = location.pathname.slice(1);
  if (APP_SECTIONS.includes(section)) {
    navigate(section, document.querySelector('[data-section=' + section + ']'));
  }
});

window.toggleSidebar = function () {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('open');
};

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('open');
}


// ─────────────────────────────────────────────────────────────
// dashboard
// ─────────────────────────────────────────────────────────────

async function loadDashboard() {
  if (!currentUser) return;

  document.getElementById('dash-subtitle').textContent =
    `Showing data for ${currentUser.organization || 'your organization'}`;
  document.getElementById('map-institution-label').textContent =
    currentUser.organization || '';

  await Promise.all([
    loadPolygon(),
    loadDetections(),
    loadUsers(),
  ]);

  updateStats();
}

window.refreshDashboard = function () { loadDashboard(); };

async function loadPolygon() {
  if (!leafletMap) {
    leafletMap = L.map('map', { zoomControl: true }).setView([51.5074, -0.1278], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    }).addTo(leafletMap);
  }

  try {
    const res = await fetch(`${API_BASE}/bella/geofence`, {
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

async function loadDetections() {
  try {
    const qs = currentUser?.organization
      ? '?' + new URLSearchParams({ institution: currentUser.organization })
      : '';
    const res = await fetch(`${API_BASE}/bella/detections${qs}`, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    allDetections = data || [];
  } catch {
    allDetections = [
      { id:'d1', type:'Smoke Detection',  location:'Building A, Floor 2', institution: currentUser?.organization, severity:'high',   status:'resolved', time:'2026-03-10T08:32:00Z' },
      { id:'d2', type:'Motion Detected',  location:'Parking Zone C',      institution: currentUser?.organization, severity:'low',    status:'active',   time:'2026-03-10T09:15:00Z' },
      { id:'d3', type:'Perimeter Breach', location:'East Fence Line',     institution: currentUser?.organization, severity:'high',   status:'active',   time:'2026-03-10T10:01:00Z' },
      { id:'d4', type:'Object Detected',  location:'Main Entrance',       institution: currentUser?.organization, severity:'medium', status:'resolved', time:'2026-03-09T14:22:00Z' },
      { id:'d5', type:'Thermal Anomaly',  location:'Server Room',         institution: currentUser?.organization, severity:'medium', status:'active',   time:'2026-03-09T18:45:00Z' },
    ];
  }

  const activeCount = allDetections.filter(d => d.status === 'active').length;
  const badge = document.getElementById('history-badge');
  if (activeCount > 0) { badge.textContent = activeCount; badge.classList.add('show'); }
  else { badge.classList.remove('show'); }

  renderRecentAlerts();
}

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

function updateStats() {
  document.getElementById('stat-zones').textContent      = polygonLayer ? '1' : '0';
  const active = allDetections.filter(d => d.status === 'active').length;
  document.getElementById('stat-alerts').textContent     = active;
  document.getElementById('stat-detections').textContent = allDetections.length;
  document.getElementById('stat-users').textContent      = allUsers.length;
}


// ─────────────────────────────────────────────────────────────
// detections
// ─────────────────────────────────────────────────────────────

window.filterHistory = function () {
  const q   = (document.getElementById('history-search').value || '').toLowerCase();
  const sev = (document.getElementById('history-filter').value || '').toLowerCase();

  const filtered = allDetections.filter(d => {
    const matchQ   = !q   || [d.type, d.location, d.status].some(v => (v || '').toLowerCase().includes(q));
    const matchSev = !sev || (d.severity || '').toLowerCase() === sev;
    return matchQ && matchSev;
  });

  renderHistoryTable(filtered);
};

function renderHistoryTable(data) {
  const tbody = document.getElementById('history-tbody');

  if (!data || !data.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="table-empty">No detections found</td></tr>';
    return;
  }

  tbody.innerHTML = [...data]
    .sort((a, b) => new Date(b.time) - new Date(a.time))
    .map(d => `
      <tr>
        <td style="color:var(--text-1);font-weight:500;">${esc(d.type)}</td>
        <td>${esc(d.location)}</td>
        <td><span class="badge badge-${severityClass(d.severity)}">${esc(d.severity || 'unknown')}</span></td>
        <td><span class="badge badge-${d.status === 'active' ? 'active' : 'resolved'}">${esc(d.status || 'unknown')}</span></td>
        <td style="white-space:nowrap;">${formatTime(d.time)}</td>
      </tr>
    `).join('');
}


// ─────────────────────────────────────────────────────────────
// users
// ─────────────────────────────────────────────────────────────

async function loadUsers() {
  try {
    const res = await fetch('/api/users', {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    allUsers = data || [];
  } catch {
    allUsers = [
      {
        id: 'u1',
        name: [currentUser?.firstname, currentUser?.lastname].filter(Boolean).join(' ') || 'You',
        email: currentUser?.email || '',
        institution: currentUser?.organization,
        role: 'user',
        createdAt: new Date().toISOString(),
      },
    ];
  }
}

window.filterUsers = function () {
  const q = (document.getElementById('users-search').value || '').toLowerCase();
  const filtered = allUsers.filter(u =>
    !q || [u.name, u.institution, u.email].some(v => (v || '').toLowerCase().includes(q))
  );
  renderUsersGrid(filtered);
};

function renderUsersGrid(data) {
  const grid = document.getElementById('users-grid');

  if (!data || !data.length) {
    grid.innerHTML = '<div class="table-empty" style="padding:2rem;">No users found</div>';
    return;
  }

  grid.innerHTML = data.map(u => `
    <div class="user-card">
      <div class="user-card-avatar">${((u.name || 'U')[0]).toUpperCase()}</div>
      <div class="user-card-info">
        <div class="user-card-name">${esc(u.name)}</div>
        <div class="user-card-inst">${esc(u.institution || u.email || '—')}</div>
      </div>
      <span class="user-card-role ${u.role === 'admin' ? 'admin' : ''}">${esc(u.role || 'user')}</span>
    </div>
  `).join('');
}


// ─────────────────────────────────────────────────────────────
// app (entry point)
// ─────────────────────────────────────────────────────────────

function initApp() {
  const token = localStorage.getItem('spairally_token');
  const user  = getSavedUser();

  if (token && user) {
    setToken(token);
    const payload = parseJwt(token);
    if (payload.exp && payload.exp * 1000 > Date.now()) {
      onLogin(user);
      return;
    }
  }

  clearToken();
  if (location.pathname !== '/login') {
    history.replaceState(null, '', '/login');
  }
  if (window.lucide) lucide.createIcons();
}

document.addEventListener('DOMContentLoaded', function () {
  if (window.lucide) lucide.createIcons();
  initAuthListeners();
  initApp();
});
