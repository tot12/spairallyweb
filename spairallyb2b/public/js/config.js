/* ═══════════════════════════════════════════════════
   config.js — Shared API instance, state & utilities
   Loaded first. All other modules depend on this.
   Uses native fetch — no axios dependency needed.
═══════════════════════════════════════════════════ */

const API_BASE = 'https://nchisecapi-production.up.railway.app';

// ── Auth header helper — used by every authenticated fetch ──
function getAuthHeaders() {
  const token = localStorage.getItem('spairally_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

// ── Shared application state (global) ─────────────
let currentUser    = null;
let allDetections  = [];
let allUsers       = [];
let leafletMap     = null;
let polygonLayer   = null;

// ── Utility: HTML escape ──────────────────────────
function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ── Utility: format ISO timestamp ─────────────────
function formatTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Utility: severity → CSS class ─────────────────
function severityClass(s) {
  const map = { high: 'high', medium: 'medium', low: 'low' };
  return map[(s || '').toLowerCase()] || 'low';
}
