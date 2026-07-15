/* ══════════════════════════════════════════════════════════════
   LicenseManager Pro — app.js
   Vanilla JS SPA: Dashboard · Licenses · Validate · Audit Log
   ══════════════════════════════════════════════════════════════ */

const API = '';   // same-origin: FastAPI serves on localhost:8000

/* ─────────────────────────────────────────────────────────────
   UTILITIES
───────────────────────────────────────────────────────────── */

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast t-${type}`;
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  el.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${msg}</span>`;
  document.getElementById('toastContainer').appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 400);
  }, 3500);
}

function fmtDate(str) {
  if (!str) return '<span style="color:var(--text-muted)">—</span>';
  const d = new Date(str);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function fmtDateTime(str) {
  if (!str) return '<span style="color:var(--text-muted)">—</span>';
  const d = new Date(str);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit' });
}

function statusBadge(status) {
  return `<span class="status-badge s-${status || 'inactive'}">${status || 'inactive'}</span>`;
}

function daysChip(days) {
  if (days === null || days === undefined)
    return `<span class="days-chip none">∞</span>`;
  if (days < 0)
    return `<span class="days-chip urgent">Expired</span>`;
  if (days <= 7)
    return `<span class="days-chip urgent">${days}d</span>`;
  if (days <= 30)
    return `<span class="days-chip warning">${days}d</span>`;
  return `<span class="days-chip ok">${days}d</span>`;
}

function truncate(str, n = 24) {
  if (!str) return '<span style="color:var(--text-muted)">—</span>';
  return str.length > n ? str.slice(0, n) + '…' : str;
}

/* ─────────────────────────────────────────────────────────────
   ROUTER / NAV
───────────────────────────────────────────────────────────── */

const pages = {
  dashboard: {
    title: 'Dashboard',
    sub: 'Overview of your license operations',
    showSearch: false,
    showNew: false,
    load: loadDashboard,
  },
  licenses: {
    title: 'Licenses',
    sub: 'Manage all license keys',
    showSearch: true,
    showNew: true,
    load: loadLicenses,
  },
  validate: {
    title: 'Validate License',
    sub: 'Check if a license key is valid',
    showSearch: false,
    showNew: false,
    load: () => {},
  },
  audit: {
    title: 'Audit Log',
    sub: 'Full history of all license actions',
    showSearch: false,
    showNew: false,
    load: loadAuditLogs,
  },
};

let currentPage = 'dashboard';
let currentStatus = 'all';
let searchDebounce = null;

function navigate(page) {
  if (!pages[page]) return;
  currentPage = page;

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(`page-${page}`).classList.add('active');

  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`nav-${page}`)?.classList.add('active');

  const cfg = pages[page];
  document.getElementById('pageTitle').textContent = cfg.title;
  document.getElementById('pageSub').textContent   = cfg.sub;
  document.getElementById('globalSearch').style.display = cfg.showSearch ? 'flex' : 'none';
  document.getElementById('newLicenseBtn').style.display = cfg.showNew  ? 'flex' : 'none';

  cfg.load();
}

document.querySelectorAll('.nav-item').forEach(el => {
  el.addEventListener('click', e => {
    e.preventDefault();
    navigate(el.dataset.page);
  });
});

/* ─────────────────────────────────────────────────────────────
   CONNECTION CHECK
───────────────────────────────────────────────────────────── */

async function checkConnection() {
  const dot = document.getElementById('connDot');
  try {
    await apiFetch('/api/stats');
    dot.className = 'status-dot connected';
    dot.title = 'Connected to API';
  } catch {
    dot.className = 'status-dot disconnected';
    dot.title = 'Cannot reach API — check the server';
  }
}

/* ─────────────────────────────────────────────────────────────
   DASHBOARD
───────────────────────────────────────────────────────────── */

async function loadDashboard() {
  try {
    const stats = await apiFetch('/api/stats');
    renderStats(stats);
    await loadExpiring();
  } catch (e) {
    toast(`Failed to load dashboard: ${e.message}`, 'error');
  }
}

function renderStats(s) {
  const grid = document.getElementById('statsGrid');
  const cards = [
    { label: 'Total Licenses',  value: s.total_licenses,   icon: '🔑', color: 'c-purple' },
    { label: 'Active',          value: s.active_licenses,  icon: '✅', color: 'c-green'  },
    { label: 'Inactive',        value: s.inactive_licenses,icon: '⏸️', color: 'c-blue'   },
    { label: 'Expired',         value: s.expired_licenses, icon: '⌛', color: 'c-red'    },
    { label: 'Revoked',         value: s.revoked_licenses, icon: '🚫', color: 'c-red'    },
    { label: 'Expiring Soon',   value: s.expiring_soon,    icon: '⚠️', color: 'c-yellow' },
  ];
  grid.innerHTML = cards.map(c => `
    <div class="stat-card ${c.color}">
      <div class="stat-icon">${c.icon}</div>
      <div class="stat-value">${c.value ?? 0}</div>
      <div class="stat-label">${c.label}</div>
    </div>
  `).join('');
}

async function loadExpiring() {
  try {
    const data = await apiFetch('/api/licenses/expiring/30');
    document.getElementById('expBadge').textContent = data.length;
    const tbody = document.getElementById('expiringBody');
    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="loading-cell">🎉 No licenses expiring in the next 30 days!</td></tr>`;
      return;
    }
    tbody.innerHTML = data.map(l => `
      <tr>
        <td><span class="key-text">${l.license_key}</span></td>
        <td>${escHtml(l.customer_name || '—')}</td>
        <td>${escHtml(l.product_name || '—')}</td>
        <td>${fmtDate(l.expiry_date)}</td>
        <td>${daysChip(l.days_until_expiry)}</td>
        <td>${statusBadge(l.status)}</td>
      </tr>
    `).join('');
  } catch (e) {
    toast(`Failed to load expiring licenses: ${e.message}`, 'error');
  }
}

/* ─────────────────────────────────────────────────────────────
   LICENSES PAGE
───────────────────────────────────────────────────────────── */

async function loadLicenses(status = currentStatus, search = '') {
  currentStatus = status;
  const tbody = document.getElementById('licensesBody');
  tbody.innerHTML = `<tr><td colspan="9" class="loading-cell">Loading…</td></tr>`;

  try {
    const params = new URLSearchParams();
    if (status && status !== 'all') params.set('status', status);
    if (search) params.set('search', search);
    const data = await apiFetch(`/api/licenses?${params}`);
    document.getElementById('licensesCount').textContent = `${data.length} license${data.length !== 1 ? 's' : ''}`;
    renderLicensesTable(data);
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="9" class="loading-cell" style="color:var(--accent-red)">⚠️ ${e.message}</td></tr>`;
    toast(`Failed to load licenses: ${e.message}`, 'error');
  }
}

function renderLicensesTable(data) {
  const tbody = document.getElementById('licensesBody');
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="9" class="loading-cell">No licenses found.</td></tr>`;
    return;
  }
  tbody.innerHTML = data.map(l => `
    <tr id="row-${l.id}">
      <td><span class="key-text" title="${l.license_key}">${l.license_key}</span></td>
      <td>
        <div style="font-weight:600;font-size:0.85rem">${escHtml(l.customer_name || '—')}</div>
        ${l.customer_email ? `<div style="font-size:0.73rem;color:var(--text-muted)">${escHtml(l.customer_email)}</div>` : ''}
      </td>
      <td>
        <div>${escHtml(l.product_name || '—')}</div>
        <div style="font-size:0.72rem;color:var(--text-muted)">${escHtml(l.license_type || '')}</div>
      </td>
      <td>
        ${l.device_id
          ? `<span class="mono" style="font-size:0.75rem;color:var(--accent-blue)" title="${l.device_id}">${truncate(l.device_id, 20)}</span>`
          : `<span style="color:var(--text-muted);font-size:0.8rem">Unbound</span>`}
      </td>
      <td style="font-size:0.8rem">${fmtDate(l.activated_at)}</td>
      <td style="font-size:0.8rem">
        ${fmtDate(l.expiry_date)}
        ${l.days_until_expiry !== null && l.days_until_expiry !== undefined
          ? `<br>${daysChip(l.days_until_expiry)}`
          : ''}
      </td>
      <td style="font-size:0.8rem">${fmtDate(l.expired_at)}</td>
      <td>${statusBadge(l.status)}</td>
      <td>
        <div class="action-group">
          ${l.status === 'inactive' || l.status === 'active'
            ? `<button class="btn-icon btn-activate" onclick="openActivateModal('${l.id}','${escAttr(l.license_key)}')" title="Activate">⚡ Activate</button>`
            : ''}
          ${l.status !== 'revoked'
            ? `<button class="btn-icon btn-revoke" onclick="revokeAction('${l.id}')" title="Revoke">🚫</button>`
            : ''}
          ${l.status === 'active' || l.status === 'inactive'
            ? `<button class="btn-icon btn-expire" onclick="expireAction('${l.id}')" title="Expire">⌛</button>`
            : ''}
          ${l.status === 'revoked' || l.status === 'expired'
            ? `<button class="btn-icon" onclick="reactivateAction('${l.id}')" title="Reset to Inactive">♻️</button>`
            : ''}
          <button class="btn-icon btn-delete" onclick="deleteAction('${l.id}')" title="Delete">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');
}

/* Filter pills */
document.getElementById('filterPills').addEventListener('click', e => {
  const pill = e.target.closest('.pill');
  if (!pill) return;
  document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
  pill.classList.add('active');
  const search = document.getElementById('searchInput').value;
  loadLicenses(pill.dataset.status, search);
});

/* Search */
document.getElementById('searchInput').addEventListener('input', e => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => {
    loadLicenses(currentStatus, e.target.value.trim());
  }, 350);
});

/* ─────────────────────────────────────────────────────────────
   CREATE LICENSE MODAL
───────────────────────────────────────────────────────────── */

function openCreateModal() {
  document.getElementById('createModal').classList.add('open');
}

function closeCreateModal() {
  document.getElementById('createModal').classList.remove('open');
  ['cName','cEmail','cProduct','cNotes','cCustomKey'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('cMaxAct').value = '1';
  document.getElementById('cExpiry').value = '';
  document.getElementById('cType').value = 'standard';
}

async function createLicense() {
  const customer_name = document.getElementById('cName').value.trim();
  if (!customer_name) { toast('Customer name is required', 'error'); return; }

  const expiryRaw = document.getElementById('cExpiry').value;
  const expiry_date = expiryRaw ? new Date(expiryRaw).toISOString() : null;

  const body = {
    customer_name,
    customer_email: document.getElementById('cEmail').value.trim(),
    product_name:   document.getElementById('cProduct').value.trim() || 'General',
    license_type:   document.getElementById('cType').value,
    expiry_date,
    max_activations: parseInt(document.getElementById('cMaxAct').value) || 1,
    notes:          document.getElementById('cNotes').value.trim(),
    custom_key:     document.getElementById('cCustomKey').value.trim() || null,
  };

  try {
    const result = await apiFetch('/api/licenses', { method: 'POST', body });
    toast(`License created: ${result.license_key}`, 'success');
    closeCreateModal();
    loadLicenses(currentStatus);
  } catch (e) {
    toast(`Create failed: ${e.message}`, 'error');
  }
}

/* ─────────────────────────────────────────────────────────────
   ACTIVATE MODAL
───────────────────────────────────────────────────────────── */

let _activateLicId = null;

function openActivateModal(licenseId, licenseKey) {
  _activateLicId = licenseId;
  document.getElementById('activateLicKey').textContent = `License: ${licenseKey}`;
  document.getElementById('activateDeviceId').value = '';
  document.getElementById('activateModal').classList.add('open');
}

function closeActivateModal() {
  document.getElementById('activateModal').classList.remove('open');
  _activateLicId = null;
}

async function doActivate() {
  const device_id = document.getElementById('activateDeviceId').value.trim();
  if (!device_id) { toast('Device ID is required', 'error'); return; }
  try {
    await apiFetch(`/api/licenses/${_activateLicId}/activate`, {
      method: 'POST',
      body: { device_id },
    });
    toast('License activated successfully!', 'success');
    closeActivateModal();
    loadLicenses(currentStatus);
  } catch (e) {
    toast(`Activation failed: ${e.message}`, 'error');
  }
}

/* ─────────────────────────────────────────────────────────────
   QUICK ACTIONS (revoke / expire / reactivate / delete)
───────────────────────────────────────────────────────────── */

async function revokeAction(id) {
  if (!confirm('Revoke this license? This cannot be undone easily.')) return;
  try {
    await apiFetch(`/api/licenses/${id}/revoke`, { method: 'POST' });
    toast('License revoked.', 'success');
    loadLicenses(currentStatus);
  } catch (e) {
    toast(`Revoke failed: ${e.message}`, 'error');
  }
}

async function expireAction(id) {
  if (!confirm('Mark this license as expired?')) return;
  try {
    await apiFetch(`/api/licenses/${id}/expire`, { method: 'POST' });
    toast('License marked as expired.', 'success');
    loadLicenses(currentStatus);
  } catch (e) {
    toast(`Expire failed: ${e.message}`, 'error');
  }
}

async function reactivateAction(id) {
  if (!confirm('Reset this license back to Inactive (unbinds device)?')) return;
  try {
    await apiFetch(`/api/licenses/${id}/reactivate`, { method: 'POST' });
    toast('License reset to inactive.', 'success');
    loadLicenses(currentStatus);
  } catch (e) {
    toast(`Reset failed: ${e.message}`, 'error');
  }
}

async function deleteAction(id) {
  if (!confirm('Permanently DELETE this license? This cannot be undone.')) return;
  try {
    await apiFetch(`/api/licenses/${id}`, { method: 'DELETE' });
    toast('License deleted.', 'info');
    loadLicenses(currentStatus);
  } catch (e) {
    toast(`Delete failed: ${e.message}`, 'error');
  }
}

/* ─────────────────────────────────────────────────────────────
   VALIDATE PAGE
───────────────────────────────────────────────────────────── */

async function validateLicense() {
  const license_key = document.getElementById('validateKey').value.trim().toUpperCase();
  const device_id   = document.getElementById('validateDevice').value.trim() || null;
  const resultEl    = document.getElementById('validateResult');

  if (!license_key) { toast('Enter a license key to validate', 'error'); return; }

  resultEl.className = 'validate-result hidden';
  resultEl.innerHTML = '';

  try {
    const r = await apiFetch('/api/validate', { method: 'POST', body: { license_key, device_id } });
    const lic = r.license || {};
    const isValid = r.valid;

    resultEl.className = `validate-result ${isValid ? 'valid' : 'invalid'}`;
    resultEl.innerHTML = `
      <span class="res-icon">${isValid ? '🟢' : '🔴'}</span>
      <div class="res-title">${isValid ? 'Valid License' : 'Invalid License'}</div>
      <div class="res-reason">${r.reason}</div>
      ${lic.id ? `
        <div class="res-details">
          <div class="res-detail-item"><span class="dk">Customer</span><br><span class="dv">${escHtml(lic.customer_name || '—')}</span></div>
          <div class="res-detail-item"><span class="dk">Product</span><br><span class="dv">${escHtml(lic.product_name || '—')}</span></div>
          <div class="res-detail-item"><span class="dk">Status</span><br><span class="dv">${lic.status || '—'}</span></div>
          <div class="res-detail-item"><span class="dk">Type</span><br><span class="dv">${lic.license_type || '—'}</span></div>
          <div class="res-detail-item"><span class="dk">Device ID</span><br><span class="dv">${escHtml(lic.device_id || 'Unbound')}</span></div>
          <div class="res-detail-item"><span class="dk">Activated At</span><br><span class="dv">${fmtDate(lic.activated_at)}</span></div>
          <div class="res-detail-item"><span class="dk">Expiry Date</span><br><span class="dv">${fmtDate(lic.expiry_date)}</span></div>
          <div class="res-detail-item"><span class="dk">Days Left</span><br><span class="dv">${daysChip(lic.days_until_expiry)}</span></div>
        </div>
      ` : ''}
    `;
  } catch (e) {
    resultEl.className = 'validate-result invalid';
    resultEl.innerHTML = `
      <span class="res-icon">⚠️</span>
      <div class="res-title">Error</div>
      <div class="res-reason">${e.message}</div>
    `;
  }
}

/* Enter key to validate */
document.getElementById('validateKey').addEventListener('keydown', e => {
  if (e.key === 'Enter') validateLicense();
});

/* ─────────────────────────────────────────────────────────────
   AUDIT LOG PAGE
───────────────────────────────────────────────────────────── */

async function loadAuditLogs() {
  const tbody = document.getElementById('auditBody');
  tbody.innerHTML = `<tr><td colspan="5" class="loading-cell">Loading…</td></tr>`;
  try {
    const data = await apiFetch('/api/audit-logs?limit=200');
    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="loading-cell">No audit log entries yet.</td></tr>`;
      return;
    }
    const actionColors = {
      CREATE:           'var(--accent-green)',
      ACTIVATE:         'var(--accent-blue)',
      REVOKE:           'var(--accent-red)',
      EXPIRE:           'var(--accent-orange)',
      DELETE:           'var(--accent-red)',
      UPDATE:           'var(--accent-primary)',
      REACTIVATE:       'var(--accent-purple)',
    };
    tbody.innerHTML = data.map(log => {
      const color = actionColors[log.action] || 'var(--text-secondary)';
      const details = log.details && Object.keys(log.details).length
        ? Object.entries(log.details).map(([k,v]) => `<span style="color:var(--text-muted)">${k}:</span> ${escHtml(String(v))}`).join(' · ')
        : '—';
      return `
        <tr>
          <td style="font-size:0.78rem;color:var(--text-muted);white-space:nowrap">${fmtDateTime(log.created_at)}</td>
          <td><span style="color:${color};font-weight:700;font-size:0.78rem">${log.action}</span></td>
          <td><span class="key-text" style="font-size:0.72rem">${escHtml(log.license_key || '—')}</span></td>
          <td style="font-size:0.78rem;color:var(--text-secondary)">${details}</td>
          <td style="font-size:0.78rem;color:var(--text-muted)">${escHtml(log.performed_by || 'system')}</td>
        </tr>
      `;
    }).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="5" class="loading-cell" style="color:var(--accent-red)">⚠️ ${e.message}</td></tr>`;
    toast(`Failed to load audit logs: ${e.message}`, 'error');
  }
}

/* ─────────────────────────────────────────────────────────────
   CLOSE MODALS ON OVERLAY CLICK
───────────────────────────────────────────────────────────── */

document.getElementById('createModal').addEventListener('click', e => {
  if (e.target.id === 'createModal') closeCreateModal();
});

document.getElementById('activateModal').addEventListener('click', e => {
  if (e.target.id === 'activateModal') closeActivateModal();
});

/* ESC to close */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeCreateModal();
    closeActivateModal();
  }
});

/* ─────────────────────────────────────────────────────────────
   SECURITY: XSS escape helpers
───────────────────────────────────────────────────────────── */

function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str ?? '';
  return d.innerHTML;
}

function escAttr(str) {
  return (str ?? '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

/* ─────────────────────────────────────────────────────────────
   BOOT
───────────────────────────────────────────────────────────── */

(async function init() {
  await checkConnection();
  navigate('dashboard');
  // Refresh connection status every 30s
  setInterval(checkConnection, 30_000);
})();
