/* ═══════════════════════════════════════════════════
   navigation.js — Page routing & sidebar toggle
   Depends on: config.js
═══════════════════════════════════════════════════ */

const APP_SECTIONS = ['dashboard', 'history', 'users'];

// ── Page navigation ───────────────────────────────
window.navigate = function (section, linkEl) {
  // Update active nav link
  if (linkEl) {
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    if (linkEl.classList) linkEl.classList.add('active');
  }

  // Show target page
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const page = document.getElementById('page-' + section);
  if (page) page.classList.add('active');

  // Update topbar title
  const titles = { dashboard: 'Dashboard', history: 'Detection History', users: 'Users' };
  document.getElementById('topbar-title').textContent = titles[section] || section;

  // Populate section data on first visit
  if (section === 'history') renderHistoryTable(allDetections);
  if (section === 'users')   renderUsersGrid(allUsers);

  // Push clean pathname route — e.g. /dashboard
  if (location.pathname !== '/' + section) {
    history.pushState(null, '', '/' + section);
  }

  closeSidebar();
  return false;
};

// ── Browser back / forward ────────────────────────
window.addEventListener('popstate', function () {
  if (!currentUser) return;
  const section = location.pathname.slice(1); // e.g. '/dashboard' → 'dashboard'
  if (APP_SECTIONS.includes(section)) {
    navigate(section, document.querySelector('[data-section=' + section + ']'));
  }
});

// ── Sidebar toggle (mobile) ───────────────────────
window.toggleSidebar = function () {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('open');
};

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('open');
}
