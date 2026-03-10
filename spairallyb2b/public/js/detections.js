/* ═══════════════════════════════════════════════════
   detections.js — Detection history table
   Depends on: config.js
═══════════════════════════════════════════════════ */

// ── Filter handler (called from HTML oninput) ─────
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

// ── Render detections into table ──────────────────
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
