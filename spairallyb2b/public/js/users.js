/* ═══════════════════════════════════════════════════
   users.js — Users grid fetch & render
   Depends on: config.js
═══════════════════════════════════════════════════ */

// ── Fetch users from backend ──────────────────────
async function loadUsers() {
  try {
    const res = await fetch(`${API_BASE}/users`, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    allUsers = data || [];
  } catch {
    // Fallback: at minimum show the current user
    allUsers = [
      {
        id: 'u1',
        name: currentUser?.name || 'You',
        email: '',
        institution: currentUser?.institution,
        role: 'user',
        createdAt: new Date().toISOString(),
      },
    ];
  }
}

// ── Filter handler (called from HTML oninput) ─────
window.filterUsers = function () {
  const q = (document.getElementById('users-search').value || '').toLowerCase();
  const filtered = allUsers.filter(u =>
    !q || [u.name, u.institution, u.email].some(v => (v || '').toLowerCase().includes(q))
  );
  renderUsersGrid(filtered);
};

// ── Render users into card grid ───────────────────
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
