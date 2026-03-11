/* ═══════════════════════════════════════════════════════════════
   bella.js — Spairally B2B Platform
   Sections: config · auth · navigation · dashboard · detections · users · app
════════════════════════════════════════════════════════════════ */


// ─────────────────────────────────────────────────────────────
// config
// ─────────────────────────────────────────────────────────────

const API_BASE = "https://nchisecapi-production.up.railway.app";

// Stripe Payment Link - Replace with your actual Stripe Payment Link
const STRIPE_PAYMENT_LINK = "https://buy.stripe.com/00wcN4eyUczi2vuc5ddAk03";

// Subscription status
let isSubscribed = false;

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
  
  // Check subscription status
  isSubscribed = user.subscribed === true || user.subscription_status === 'active';
  
  // Check for successful payment return from Stripe
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('payment') === 'success') {
    // Payment was successful, verify with backend
    verifySubscription();
    // Clean up URL
    history.replaceState(null, '', location.pathname);
  }
  
  // If not subscribed, show subscription modal
  if (!isSubscribed) {
    showSubscriptionModal();
    return; // Don't proceed to app until subscribed
  }
  
  proceedToApp(user);
}

function proceedToApp(user) {
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

// ─────────────────────────────────────────────────────────────
// Subscription Management
// ─────────────────────────────────────────────────────────────

function showSubscriptionModal() {
  document.getElementById('subscription-modal').style.display = 'flex';
  if (window.lucide) lucide.createIcons();
}

function closeSubscriptionModal() {
  document.getElementById('subscription-modal').style.display = 'none';
  // Optional: Log out user if they decline subscription
  // logout();
}
window.closeSubscriptionModal = closeSubscriptionModal;

function redirectToStripe() {
  // Build Stripe Payment Link with customer email for tracking
  const email = currentUser?.email || '';
  const userId = currentUser?.id || '';
  
  // Add customer info to Stripe link for webhook tracking
  const stripeUrl = new URL(STRIPE_PAYMENT_LINK);
  stripeUrl.searchParams.set('prefilled_email', email);
  stripeUrl.searchParams.set('client_reference_id', userId);
  
  // Set success and cancel URLs
  const successUrl = `${window.location.origin}/dashboard?payment=success`;
  const cancelUrl = `${window.location.origin}/login?payment=cancelled`;
  
  // Note: For Stripe Payment Links, success/cancel URLs are configured in Stripe Dashboard
  // The client_reference_id and prefilled_email help track the payment
  
  window.location.href = stripeUrl.toString();
}
window.redirectToStripe = redirectToStripe;

async function verifySubscription() {
  try {
    const res = await fetch(`${API_BASE}/bella/subscription/verify`, {
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.subscribed || data.subscription_status === 'active') {
        isSubscribed = true;
        currentUser.subscribed = true;
        saveUser(currentUser);
        closeSubscriptionModal();
        proceedToApp(currentUser);
      }
    }
  } catch (err) {
    console.warn('[subscription] Verification failed:', err);
  }
}

async function checkSubscriptionStatus() {
  try {
    const res = await fetch(`${API_BASE}/bella/subscription/status`, {
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      const data = await res.json();
      return data.subscribed === true || data.subscription_status === 'active';
    }
  } catch (err) {
    console.warn('[subscription] Status check failed:', err);
  }
  return false;
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
    leafletMap = L.map('map', { zoomControl: true }).setView([-1.2921, 36.8219], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    }).addTo(leafletMap);
  }

  try {
    console.log('[GEOFENCE] URL:', `${API_BASE}/bella/geofence`);
    console.log('[GEOFENCE] Headers:', getAuthHeaders());
    const res = await fetch(`${API_BASE}/bella/geofence`, {
      headers: getAuthHeaders(),
    });
    console.log('[GEOFENCE] Response status:', res.status);
    const data = await res.json();
    console.log('[GEOFENCE] Response data:', data);
    applyPolygon(data);
  } catch (err) {
    console.warn('[dashboard] geofence fetch failed — using fallback demo polygon');
    applyPolygon({
      geometry: {
        type: 'MultiPolygon',
        coordinates: [[[[36.8219, -1.2921], [36.8300, -1.2850], [36.8350, -1.2921], [36.8300, -1.3000], [36.8219, -1.2921]]]],
      },
    });
  }
}

function applyPolygon(geofence) {
  if (polygonLayer) leafletMap.removeLayer(polygonLayer);
  
  // Handle the backend response structure: { id, organization, geometry: { type, coordinates }, ... }
  const geometry = geofence.geometry;
  if (!geometry) {
    console.warn('[applyPolygon] No geometry found in geofence data');
    return;
  }

  // Convert to GeoJSON Feature format for Leaflet
  const geoJsonFeature = {
    type: 'Feature',
    properties: {
      id: geofence.id,
      name: geofence.name,
      organization: geofence.organization,
      created_by: geofence.created_by,
    },
    geometry: geometry,
  };

  // Leaflet expects [lat, lng] but GeoJSON uses [lng, lat], so we need to flip coordinates
  polygonLayer = L.geoJSON(geoJsonFeature, {
    coordsToLatLng: function(coords) {
      // GeoJSON is [lng, lat], Leaflet needs [lat, lng]
      return L.latLng(coords[1], coords[0]);
    },
    style: {
      color: '#ffffff',
      weight: 2,
      opacity: 0.9,
      fillColor: '#ffffff',
      fillOpacity: 0.1,
    },
    onEachFeature: function(feature, layer) {
      if (feature.properties && feature.properties.name) {
        layer.bindPopup(`<strong>${feature.properties.name}</strong><br>Organization: ${feature.properties.organization || 'N/A'}`);
      }
    },
  }).addTo(leafletMap);
  
  leafletMap.fitBounds(polygonLayer.getBounds(), { padding: [24, 24] });
}

async function loadDetections() {
  try {
    const res = await fetch(`${API_BASE}/bella/detections`, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    console.log('[DETECTIONS] Response data:', data);
    // Handle various response formats: array, object with detections property, or single object
    if (Array.isArray(data)) {
      allDetections = data;
    } else if (data && Array.isArray(data.detections)) {
      allDetections = data.detections;
    } else if (data && typeof data === 'object') {
      // If it's a single detection object, wrap it in an array
      allDetections = [data];
    } else {
      allDetections = [];
    }
  } catch (err) {
    console.warn('[DETECTIONS] Fetch failed:', err);
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
