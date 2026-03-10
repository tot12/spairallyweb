/* ═══════════════════════════════════════════════════
   auth.js — Login, Register, Session, Logout
   Depends on: config.js, navigation.js, dashboard.js
═══════════════════════════════════════════════════ */

// ── Token / session helpers ───────────────────────
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

// ── Auth UI helpers ───────────────────────────────
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

// ── Form listeners — called by loader.js after DOM is ready ──
function initAuthListeners() {
  // Login
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAuthError('login-error');
    const btn      = e.target.querySelector('button[type=submit]');
    const name     = document.getElementById('login-name').value.trim();
    const password = document.getElementById('login-password').value;
    setBtnLoading(btn, true);
    console.group('[AUTH] Login attempt');
    console.log('URL:', `${API_BASE}/auth/login`);
    console.log('Payload:', { name, password: '***' });
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, password }),
      });
      const data = await res.json();
      console.log('Response status:', res.status);
      console.log('Response data:', data);
      console.groupEnd();
      if (!res.ok) throw { response: { status: res.status, data } };
      setToken(data.token);
      saveUser(data.user);
      onLogin(data.user);
    } catch (err) {
      console.error('Status:', err.response?.status);
      console.error('Response body:', err.response?.data);
      console.error('Raw error:', err.message);
      console.groupEnd();
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
    const btn         = e.target.querySelector('button[type=submit]');
    const name        = document.getElementById('reg-name').value.trim();
    const email       = document.getElementById('reg-email').value.trim();
    const institution = document.getElementById('reg-institution').value.trim();
    const password    = document.getElementById('reg-password').value;
    setBtnLoading(btn, true);
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, institution, password }),
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

// ── Post-login setup ──────────────────────────────
function onLogin(user) {
  currentUser = user;
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app').style.display = '';

  const initial = (user.name || 'U')[0].toUpperCase();
  document.getElementById('sidebar-avatar').textContent      = initial;
  document.getElementById('topbar-avatar').textContent       = initial;
  document.getElementById('sidebar-username').textContent    = user.name || '—';
  document.getElementById('sidebar-institution').textContent = user.institution || '—';

  // Honour the incoming pathname — e.g. arriving via /history or /dashboard
  const path   = location.pathname.slice(1);
  const target = (typeof APP_SECTIONS !== 'undefined' && APP_SECTIONS.includes(path)) ? path : 'dashboard';
  navigate(target, document.querySelector('[data-section=' + target + ']'));
  loadDashboard();

  if (window.lucide) lucide.createIcons();
}


// ── Logout ────────────────────────────────────────
window.logout = function () {
  clearToken();
  currentUser   = null;
  allDetections = [];
  allUsers      = [];
  if (leafletMap) { leafletMap.remove(); leafletMap = null; polygonLayer = null; }
  document.getElementById('app').style.display = 'none';
  document.getElementById('auth-screen').style.display = '';
  // Redirect to /login so the URL doesn't leak a protected route
  history.replaceState(null, '', '/login');
};
