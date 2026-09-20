/* ══════════════════════════════════════════════════════════════
   LicenseManager Pro — app.js
   Vanilla JS SPA: Dashboard · Licenses · Validate · Audit Log
   ══════════════════════════════════════════════════════════════ */

const API = '';   // same-origin

/* ─────────────────────────────────────────────────────────────
   UTILITIES
───────────────────────────────────────────────────────────── */

/* ─────────────────────────────────────────────────────────────
   AUTH HELPERS
───────────────────────────────────────────────────────────── */

let currentUser = null;

function getToken() { return localStorage.getItem('lms_token'); }

function logout() {
  const token = getToken();
  if (token) {
    fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Authorization': `Token ${token}`, 'Content-Type': 'application/json' },
    }).catch(() => {});
  }
  localStorage.removeItem('lms_token');
  localStorage.removeItem('lms_user');
  window.location.href = '/login/';
}

/* ─────────────────────────────────────────────────────────────
   UTILITIES
───────────────────────────────────────────────────────────── */

async function apiFetch(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Token ${token}` } : {}),
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (res.status === 401) {
    localStorage.removeItem('lms_token');
    localStorage.removeItem('lms_user');
    window.location.href = '/login/';
    return;
  }
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
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
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
    showSearch: false, showNew: false,
    load: loadDashboard,
  },
  licenses: {
    title: 'Licenses',
    sub: 'Manage all license keys',
    showSearch: true, showNew: true,
    load: loadLicenses,
  },
  validate: {
    title: 'Validate License',
    sub: 'Check if a license key is valid',
    showSearch: false, showNew: false,
    load: () => { },
  },
  audit: {
    title: 'Audit Log',
    sub: 'Full history of all license actions',
    showSearch: false, showNew: false,
    load: loadAuditLogs,
  },
  customers: {
    title: 'Customers',
    sub: 'Manage customer accounts',
    showSearch: false, showNew: false,
    load: loadCustomers,
  },
  users: {
    title: 'Users',
    sub: 'Manage user accounts and access',
    showSearch: false, showNew: false,
    load: loadUsers,
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
  document.getElementById('pageSub').textContent = cfg.sub;
  document.getElementById('globalSearch').style.display = cfg.showSearch ? 'flex' : 'none';
  document.getElementById('newLicenseBtn').style.display = cfg.showNew ? 'flex' : 'none';

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
    { label: 'Total Licenses', value: s.total_licenses, icon: '🔑', color: 'c-purple' },
    { label: 'Active', value: s.active_licenses, icon: '✅', color: 'c-green' },
    { label: 'Inactive', value: s.inactive_licenses, icon: '⏸️', color: 'c-blue' },
    { label: 'Expired', value: s.expired_licenses, icon: '⌛', color: 'c-red' },
    { label: 'Revoked', value: s.revoked_licenses, icon: '🚫', color: 'c-red' },
    { label: 'Expiring Soon', value: s.expiring_soon, icon: '⚠️', color: 'c-yellow' },
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
          <button class="btn-icon btn-edit" onclick="openEditModal('${l.id}')" title="Edit">✏️ Edit</button>
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

async function openCreateModal() {
  // Populate customer dropdown
  const sel = document.getElementById('cCustomer');
  sel.innerHTML = '<option value="">— Select a customer —</option>';
  try {
    const customers = await apiFetch('/api/customers');
    customers.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.company_name + (c.contact_name ? ` (${c.contact_name})` : '');
      opt.dataset.email = c.email || '';
      opt.dataset.phone = c.phone || '';
      opt.dataset.contact = c.contact_name || '';
      sel.appendChild(opt);
    });
  } catch { /* silently ignore */ }
  document.getElementById('cCustomerInfo').style.display = 'none';
  document.getElementById('createModal').classList.add('open');
}

function closeCreateModal() {
  document.getElementById('createModal').classList.remove('open');
  document.getElementById('cCustomer').value = '';
  document.getElementById('cCustomerInfo').style.display = 'none';
  ['cProduct', 'cNotes', 'cCustomKey'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('cMaxAct').value = '1';
  document.getElementById('cExpiry').value = '';
  document.getElementById('cType').value = 'standard';
}

async function createLicense() {
  const sel = document.getElementById('cCustomer');
  const customer_id = sel.value.trim();
  if (!customer_id) { toast('Please select a customer', 'error'); return; }

  const expiryRaw = document.getElementById('cExpiry').value;
  const expiry_date = expiryRaw ? new Date(expiryRaw).toISOString() : null;

  const body = {
    customer_id,
    product_name: document.getElementById('cProduct').value.trim() || 'General',
    license_type: document.getElementById('cType').value,
    expiry_date,
    max_activations: parseInt(document.getElementById('cMaxAct').value) || 1,
    notes: document.getElementById('cNotes').value.trim(),
    custom_key: document.getElementById('cCustomKey').value.trim() || null,
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
   EDIT LICENSE MODAL
───────────────────────────────────────────────────────────── */

let _editLicId = null;

async function openEditModal(licenseId) {
  try {
    const lic = await apiFetch(`/api/licenses/${licenseId}`);
    _editLicId = licenseId;

    document.getElementById('editLicKey').textContent = `License: ${lic.license_key}`;

    // Pre-fill customer search with current customer
    const cust = lic.customer;
    if (cust) {
      document.getElementById('eCustomerSearch').value = cust.company_name || '';
      document.getElementById('eCustomerId').value = cust.id || '';
      document.getElementById('eCustomerInfoEmail').textContent = cust.email || '—';
      document.getElementById('eCustomerInfoPhone').textContent = cust.phone || '—';
      document.getElementById('eCustomerInfoContact').textContent = cust.contact_name || '—';
      document.getElementById('eCustomerInfo').style.display = '';
    } else {
      document.getElementById('eCustomerSearch').value = '';
      document.getElementById('eCustomerId').value = '';
      document.getElementById('eCustomerInfo').style.display = 'none';
    }
    document.getElementById('eCustomerDropdown').style.display = 'none';

    document.getElementById('eProduct').value = lic.product_name || '';
    document.getElementById('eType').value = lic.license_type || 'standard';
    document.getElementById('eMaxAct').value = lic.max_activations ?? 1;
    document.getElementById('eNotes').value = lic.notes || '';
    document.getElementById('eStatus').value = lic.status || 'inactive';

    // Convert ISO date → YYYY-MM-DD for the date input
    if (lic.expiry_date) {
      const d = new Date(lic.expiry_date);
      document.getElementById('eExpiry').value = d.toISOString().slice(0, 10);
    } else {
      document.getElementById('eExpiry').value = '';
    }

    document.getElementById('editModal').classList.add('open');
  } catch (e) {
    toast(`Failed to load license: ${e.message}`, 'error');
  }
}

function closeEditModal() {
  document.getElementById('editModal').classList.remove('open');
  _editLicId = null;
  document.getElementById('eCustomerDropdown').style.display = 'none';
  document.getElementById('eCustomerInfo').style.display = 'none';
}

async function saveEdit() {
  const customer_id = document.getElementById('eCustomerId').value.trim();
  if (!customer_id) { toast('Please select a customer', 'error'); return; }

  const expiryRaw = document.getElementById('eExpiry').value;
  const expiry_date = expiryRaw ? new Date(expiryRaw).toISOString() : null;

  const body = {
    customer_id,
    product_name: document.getElementById('eProduct').value.trim() || 'General',
    license_type: document.getElementById('eType').value,
    expiry_date,
    max_activations: parseInt(document.getElementById('eMaxAct').value) || 1,
    notes: document.getElementById('eNotes').value.trim() || '',
    status: document.getElementById('eStatus').value,
  };

  try {
    await apiFetch(`/api/licenses/${_editLicId}`, { method: 'PATCH', body });
    toast('License updated successfully!', 'success');
    closeEditModal();
    loadLicenses(currentStatus);
  } catch (e) {
    toast(`Update failed: ${e.message}`, 'error');
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
  const device_id = document.getElementById('validateDevice').value.trim() || null;
  const resultEl = document.getElementById('validateResult');

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
      CREATE: 'var(--accent-green)',
      ACTIVATE: 'var(--accent-blue)',
      REVOKE: 'var(--accent-red)',
      EXPIRE: 'var(--accent-orange)',
      DELETE: 'var(--accent-red)',
      UPDATE: 'var(--accent-primary)',
      REACTIVATE: 'var(--accent-purple)',
    };
    tbody.innerHTML = data.map(log => {
      const color = actionColors[log.action] || 'var(--text-secondary)';
      const details = log.details && Object.keys(log.details).length
        ? Object.entries(log.details).map(([k, v]) => `<span style="color:var(--text-muted)">${k}:</span> ${escHtml(String(v))}`).join(' · ')
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
document.getElementById('editModal').addEventListener('click', e => {
  if (e.target.id === 'editModal') closeEditModal();
});
document.getElementById('userModal').addEventListener('click', e => {
  if (e.target.id === 'userModal') closeUserModal();
});
document.getElementById('customerModal').addEventListener('click', e => {
  if (e.target.id === 'customerModal') closeCustomerModal();
});

/* ESC to close */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeCreateModal();
    closeActivateModal();
    closeEditModal();
    closeUserModal();
    closeCustomerModal();
  }
});

/* ─────────────────────────────────────────────────────────────
   CUSTOMER SEARCH DROPDOWN (Create & Edit modals)
───────────────────────────────────────────────────────────── */

let _customerSearchCache = [];

async function fetchCustomerSuggestions(query) {
  try {
    const params = query ? `?search=${encodeURIComponent(query)}` : '';
    const data = await apiFetch(`/api/customers${params}`);
    return data;
  } catch {
    return [];
  }
}

function buildCustomerDropdown(containerId, items, onSelect) {
  const dd = document.getElementById(containerId);
  if (!items.length) {
    dd.innerHTML = `<div class="cd-item cd-empty">No customers found</div>`;
  } else {
    dd.innerHTML = items.map(c => `
      <div class="cd-item" data-id="${c.id}" data-name="${escAttr(c.company_name)}"
           data-email="${escAttr(c.email)}" data-phone="${escAttr(c.phone || '')}"
           data-contact="${escAttr(c.contact_name || '')}">
        <div class="cd-name">${escHtml(c.company_name)}</div>
        <div class="cd-sub">${escHtml(c.email)}${c.contact_name ? ' · ' + escHtml(c.contact_name) : ''}</div>
      </div>
    `).join('');
  }
  dd.style.display = 'block';
  dd.querySelectorAll('.cd-item[data-id]').forEach(el => {
    el.addEventListener('click', () => {
      onSelect({
        id: el.dataset.id,
        company_name: el.dataset.name,
        email: el.dataset.email,
        phone: el.dataset.phone,
        contact_name: el.dataset.contact,
      });
      dd.style.display = 'none';
    });
  });
}


// ── Create modal customer select ──────────────────────────────
document.getElementById('cCustomer').addEventListener('change', function () {
  const opt = this.options[this.selectedIndex];
  if (this.value) {
    document.getElementById('cCustomerInfoEmail').textContent = opt.dataset.email || '—';
    document.getElementById('cCustomerInfoPhone').textContent = opt.dataset.phone || '—';
    document.getElementById('cCustomerInfoContact').textContent = opt.dataset.contact || '—';
    document.getElementById('cCustomerInfo').style.display = '';
  } else {
    document.getElementById('cCustomerInfo').style.display = 'none';
  }
});



// ── Edit modal customer search ────────────────────────────────
let _eSearchTimer = null;
document.getElementById('eCustomerSearch').addEventListener('input', e => {
  clearTimeout(_eSearchTimer);
  const q = e.target.value.trim();
  if (!q) {
    document.getElementById('eCustomerDropdown').style.display = 'none';
    document.getElementById('eCustomerId').value = '';
    document.getElementById('eCustomerInfo').style.display = 'none';
    return;
  }
  _eSearchTimer = setTimeout(async () => {
    const items = await fetchCustomerSuggestions(q);
    buildCustomerDropdown('eCustomerDropdown', items, c => {
      document.getElementById('eCustomerSearch').value = c.company_name;
      document.getElementById('eCustomerId').value = c.id;
      document.getElementById('eCustomerInfoEmail').textContent = c.email || '—';
      document.getElementById('eCustomerInfoPhone').textContent = c.phone || '—';
      document.getElementById('eCustomerInfoContact').textContent = c.contact_name || '—';
      document.getElementById('eCustomerInfo').style.display = '';
    });
  }, 280);
});
document.addEventListener('click', e => {
  if (!e.target.closest('#eCustomerDropdown') && !e.target.matches('#eCustomerSearch')) {
    document.getElementById('eCustomerDropdown').style.display = 'none';
  }
});

/* ─────────────────────────────────────────────────────────────
   CUSTOMERS PAGE
───────────────────────────────────────────────────────────── */

async function loadCustomers() {
  const tbody = document.getElementById('customersBody');
  tbody.innerHTML = `<tr><td colspan="7" class="loading-cell">Loading…</td></tr>`;
  try {
    const data = await apiFetch('/api/customers');
    document.getElementById('customersCount').textContent = `${data.length} customer${data.length !== 1 ? 's' : ''}`;
    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="loading-cell">No customers yet. Add your first customer!</td></tr>`;
      return;
    }
    tbody.innerHTML = data.map(c => `
      <tr id="crow-${c.id}">
        <td><strong style="font-size:0.88rem">${escHtml(c.company_name)}</strong></td>
        <td style="font-size:0.84rem">${escHtml(c.contact_name || '—')}</td>
        <td style="font-size:0.82rem;color:var(--text-secondary)">${escHtml(c.email)}</td>
        <td style="font-size:0.82rem;color:var(--text-secondary)">${escHtml(c.phone || '—')}</td>
        <td><span class="status-badge s-active">${c.license_count}</span></td>
        <td style="font-size:0.78rem;color:var(--text-muted)">${fmtDate(c.created_at)}</td>
        <td>
          <div class="action-group">
            <button class="btn-icon btn-edit" onclick="openCustomerModal('${c.id}')" title="Edit">✏️ Edit</button>
            <button class="btn-icon btn-delete" onclick="deleteCustomer('${c.id}', '${escAttr(c.company_name)}')" title="Delete">🗑️</button>
          </div>
        </td>
      </tr>`
    ).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="7" class="loading-cell" style="color:var(--accent-red)">⚠️ ${e.message}</td></tr>`;
    toast(`Failed to load customers: ${e.message}`, 'error');
  }
}

let _editCustomerId = null;

async function openCustomerModal(customerId) {
  _editCustomerId = customerId;
  const isEdit = !!customerId;

  document.getElementById('customerModalTitle').textContent = isEdit ? '✏️ Edit Customer' : '🏢 New Customer';
  document.getElementById('customerModalSaveBtn').textContent = isEdit ? 'Save Changes' : 'Create Customer';

  // Reset fields
  ['cuCompany', 'cuContact', 'cuPhone', 'cuEmail', 'cuNotes'].forEach(id => {
    document.getElementById(id).value = '';
  });

  if (isEdit) {
    try {
      const c = await apiFetch(`/api/customers/${customerId}`);
      document.getElementById('cuCompany').value  = c.company_name || '';
      document.getElementById('cuContact').value  = c.contact_name || '';
      document.getElementById('cuPhone').value    = c.phone || '';
      document.getElementById('cuEmail').value    = c.email || '';
      document.getElementById('cuNotes').value    = c.notes || '';
    } catch (e) {
      toast(`Failed to load customer: ${e.message}`, 'error');
      return;
    }
  }

  document.getElementById('customerModal').classList.add('open');
}

function closeCustomerModal() {
  document.getElementById('customerModal').classList.remove('open');
  _editCustomerId = null;
}

async function saveCustomer() {
  const isEdit = !!_editCustomerId;
  const company = document.getElementById('cuCompany').value.trim();
  const email   = document.getElementById('cuEmail').value.trim();
  if (!company) { toast('Company name is required', 'error'); return; }
  if (!email)   { toast('Email is required', 'error'); return; }

  const body = {
    company_name:  company,
    contact_name:  document.getElementById('cuContact').value.trim(),
    phone:         document.getElementById('cuPhone').value.trim(),
    email,
    notes:         document.getElementById('cuNotes').value.trim(),
  };

  try {
    if (isEdit) {
      await apiFetch(`/api/customers/${_editCustomerId}`, { method: 'PATCH', body });
      toast('Customer updated!', 'success');
    } else {
      await apiFetch('/api/customers', { method: 'POST', body });
      toast('Customer created!', 'success');
    }
    closeCustomerModal();
    loadCustomers();
  } catch (e) {
    toast(`Save failed: ${e.message}`, 'error');
  }
}

async function deleteCustomer(id, name) {
  if (!confirm(`Delete customer "${name}"? This will also affect their licenses.`)) return;
  try {
    await apiFetch(`/api/customers/${id}`, { method: 'DELETE' });
    toast(`Customer "${name}" deleted.`, 'info');
    loadCustomers();
  } catch (e) {
    toast(`Delete failed: ${e.message}`, 'error');
  }
}

/* ─────────────────────────────────────────────────────────────
   USERS PAGE
───────────────────────────────────────────────────────────── */

async function loadUsers() {
  const tbody = document.getElementById('usersBody');
  tbody.innerHTML = `<tr><td colspan="7" class="loading-cell">Loading…</td></tr>`;
  try {
    const data = await apiFetch('/api/users');
    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="loading-cell">No users found.</td></tr>`;
      return;
    }
    tbody.innerHTML = data.map(u => {
      const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || '—';
      const roleBadge = u.is_staff
        ? `<span class="status-badge" style="background:rgba(108,99,255,0.15);color:var(--accent-primary)">Admin</span>`
        : `<span class="status-badge s-inactive">User</span>`;
      const activeBadge = u.is_active
        ? `<span class="status-badge s-active">Active</span>`
        : `<span class="status-badge s-revoked">Disabled</span>`;
      const isSelf = currentUser && u.id === currentUser.id;
      return `
        <tr id="urow-${u.id}">
          <td><strong style="font-size:0.88rem">${escHtml(u.username)}</strong>${isSelf ? ' <span style="font-size:0.7rem;color:var(--accent-primary)">(you)</span>' : ''}</td>
          <td style="font-size:0.84rem">${escHtml(name)}</td>
          <td style="font-size:0.82rem;color:var(--text-secondary)">${escHtml(u.email || '—')}</td>
          <td>${roleBadge}</td>
          <td>${activeBadge}</td>
          <td style="font-size:0.78rem;color:var(--text-muted)">${fmtDateTime(u.last_login)}</td>
          <td>
            <div class="action-group">
              <button class="btn-icon btn-edit" onclick="openUserModal(${u.id})" title="Edit">✏️ Edit</button>
              ${!isSelf ? `<button class="btn-icon btn-delete" onclick="deleteUser(${u.id}, '${escAttr(u.username)}')" title="Delete">🗑️</button>` : ''}
            </div>
          </td>
        </tr>`;
    }).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="7" class="loading-cell" style="color:var(--accent-red)">⚠️ ${e.message}</td></tr>`;
    toast(`Failed to load users: ${e.message}`, 'error');
  }
}

let _editUserId = null;

async function openUserModal(userId) {
  _editUserId = userId;
  const isEdit = !!userId;

  document.getElementById('userModalTitle').textContent = isEdit ? '✏️ Edit User' : '👤 New User';
  document.getElementById('userModalSaveBtn').textContent = isEdit ? 'Save Changes' : 'Create User';
  document.getElementById('uPwHint').textContent = isEdit ? '(leave blank to keep)' : '*';
  document.getElementById('uStatusGroup').style.display = isEdit ? '' : 'none';

  // Reset fields
  ['uUsername', 'uPassword', 'uFirst', 'uLast', 'uEmail'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('uRole').value = 'false';
  document.getElementById('uActive').value = 'true';
  document.getElementById('uUsername').disabled = false;

  if (isEdit) {
    try {
      const u = await apiFetch(`/api/users/${userId}`);
      document.getElementById('uUsername').value  = u.username;
      document.getElementById('uUsername').disabled = true; // username not changeable
      document.getElementById('uFirst').value    = u.first_name || '';
      document.getElementById('uLast').value     = u.last_name  || '';
      document.getElementById('uEmail').value    = u.email      || '';
      document.getElementById('uRole').value     = String(u.is_staff);
      document.getElementById('uActive').value   = String(u.is_active);
    } catch (e) {
      toast(`Failed to load user: ${e.message}`, 'error');
      return;
    }
  }

  document.getElementById('userModal').classList.add('open');
}

function closeUserModal() {
  document.getElementById('userModal').classList.remove('open');
  _editUserId = null;
}

async function saveUser() {
  const isEdit = !!_editUserId;
  const pw = document.getElementById('uPassword').value;

  if (!isEdit) {
    const username = document.getElementById('uUsername').value.trim();
    if (!username) { toast('Username is required', 'error'); return; }
    if (!pw)       { toast('Password is required for new users', 'error'); return; }
  }

  const body = isEdit
    ? {
        first_name: document.getElementById('uFirst').value.trim(),
        last_name:  document.getElementById('uLast').value.trim(),
        email:      document.getElementById('uEmail').value.trim(),
        is_staff:   document.getElementById('uRole').value === 'true',
        is_active:  document.getElementById('uActive').value === 'true',
        ...(pw ? { password: pw } : {}),
      }
    : {
        username:   document.getElementById('uUsername').value.trim(),
        password:   pw,
        first_name: document.getElementById('uFirst').value.trim(),
        last_name:  document.getElementById('uLast').value.trim(),
        email:      document.getElementById('uEmail').value.trim(),
        is_staff:   document.getElementById('uRole').value === 'true',
      };

  try {
    if (isEdit) {
      await apiFetch(`/api/users/${_editUserId}`, { method: 'PATCH', body });
      toast('User updated!', 'success');
    } else {
      await apiFetch('/api/users', { method: 'POST', body });
      toast('User created!', 'success');
    }
    closeUserModal();
    loadUsers();
  } catch (e) {
    toast(`Save failed: ${e.message}`, 'error');
  }
}

async function deleteUser(id, username) {
  if (!confirm(`Delete user "${username}"? This cannot be undone.`)) return;
  try {
    await apiFetch(`/api/users/${id}`, { method: 'DELETE' });
    toast(`User "${username}" deleted.`, 'info');
    loadUsers();
  } catch (e) {
    toast(`Delete failed: ${e.message}`, 'error');
  }
}

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
  // Auth guard
  if (!getToken()) {
    window.location.href = '/login/';
    return;
  }

  // Load current user from storage
  try { currentUser = JSON.parse(localStorage.getItem('lms_user') || '{}'); } catch { currentUser = {}; }

  // Populate sidebar user info
  if (currentUser.username) {
    document.getElementById('suName').textContent  = currentUser.username;
    document.getElementById('suRole').textContent  = currentUser.is_staff ? 'Administrator' : 'User';
    document.getElementById('suAvatar').textContent = currentUser.username.charAt(0).toUpperCase();
  }

  // Show Users nav only for admins
  if (currentUser.is_staff) {
    document.getElementById('nav-users').style.display = '';
  }

  // Bump cache-bust version each session
  await checkConnection();
  navigate('dashboard');
  setInterval(checkConnection, 30_000);
})();
