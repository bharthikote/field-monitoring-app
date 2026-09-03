// Leadership, TFO, Supervisor, Team Lead, and Country Manager only get
// Reports (scoped to whatever their location assignments cover) -
// everything else here is Admin/Super Admin only. Omit `roles` to show an
// entry to every role allowed into the web panel at all.
const NAV_ICONS = {
  pendingApprovals: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></svg>',
  systemUpdate: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>',
  reports: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
  dataCollection: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1"/><line x1="8" y1="11" x2="16" y2="11"/><line x1="8" y1="15" x2="16" y2="15"/></svg>',
  activityCosts: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
  nutrientConfig: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v6"/><path d="M8.5 5.5 12 2l3.5 3.5"/><path d="M5 12a7 7 0 0 0 14 0"/><path d="M12 22v-6"/></svg>',
  locations: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s7-7.58 7-13a7 7 0 1 0-14 0c0 5.42 7 13 7 13z"/><circle cx="12" cy="9" r="2.5"/></svg>',
  crops: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22v-7"/><path d="M12 15c-4-1-7-4-7-9 5 0 8 3 9 7"/><path d="M12 12c3-1 6-3 7-8-5 0-8 2-9 6"/></svg>',
  masterLists: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></svg>',
  allUsers: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  activityReturns: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h13"/><path d="m11 6 6 6-6 6"/><path d="M21 5v14"/></svg>',
};

const NAV_STRUCTURE = [
  { href: '/admin', label: 'Pending Approvals', icon: NAV_ICONS.pendingApprovals, roles: ['admin', 'super_admin'] },
  {
    label: 'System Update',
    icon: NAV_ICONS.systemUpdate,
    roles: ['admin', 'super_admin'],
    children: [
      { href: '/admin/locations', label: 'Locations', icon: NAV_ICONS.locations },
      { href: '/admin/crops', label: 'Crops', icon: NAV_ICONS.crops },
      { href: '/admin/master-lists', label: 'Master Lists', icon: NAV_ICONS.masterLists },
      { href: '/admin/manage-users', label: 'All Users', icon: NAV_ICONS.allUsers },
      { href: '/admin/activity-costs', label: 'Activity Costs', icon: NAV_ICONS.activityCosts, roles: ['super_admin'] },
      { href: '/admin/nutrient-configurations', label: 'Nutrient Config', icon: NAV_ICONS.nutrientConfig, roles: ['super_admin'] },
      { href: '/admin/activity-returns', label: 'Activity Returns', icon: NAV_ICONS.activityReturns, roles: ['super_admin'] },
    ],
  },
  {
    label: 'Reports',
    icon: NAV_ICONS.reports,
    children: [
      { href: '/admin/reports/farmers', label: 'Farmers' },
      { href: '/admin/reports/demos', label: 'Demos' },
      { href: '/admin/reports/master-list', label: 'Master List' },
    ],
  },
  { href: '/admin/data-collection-forms', label: 'Data Collection', icon: NAV_ICONS.dataCollection, roles: ['super_admin'] },
];

function getToken() {
  return localStorage.getItem('admin_token');
}
function setToken(token) {
  localStorage.setItem('admin_token', token);
}
function clearToken() {
  localStorage.removeItem('admin_token');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

async function authedFetch(path, options = {}) {
  // A FormData body (file upload) needs the browser to set its own
  // multipart Content-Type with the correct boundary - forcing JSON here
  // would break it.
  const isFormData = options.body instanceof FormData;
  const headers = { Authorization: `Bearer ${getToken()}`, ...(options.headers || {}) };
  if (!isFormData) headers['Content-Type'] = 'application/json';

  const res = await fetch(path, { ...options, headers });
  if (res.status === 401) {
    clearToken();
    window.location.href = '/login.html';
    throw new Error('Session expired, redirecting to login');
  }
  return res;
}

// Downloads a file from an authenticated endpoint. A plain <a href> can't
// carry the Bearer token, so this fetches the file as a blob first.
async function downloadAuthedFile(path, filename) {
  const res = await authedFetch(path);
  if (!res.ok) throw new Error('Download failed');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function initialsFor(name) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] || '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

function renderNav(user) {
  const nav = document.getElementById('admin-nav');
  if (!nav) return;

  const linksHtml = NAV_STRUCTURE.filter((entry) => !entry.roles || entry.roles.includes(user.role)).map((entry) => {
    if (entry.children) {
      const visibleChildren = entry.children.filter((c) => !c.roles || c.roles.includes(user.role));
      const isActiveGroup = visibleChildren.some((c) => c.href === location.pathname);
      const childLinks = visibleChildren
        .map((c) => `<a href="${c.href}" class="${location.pathname === c.href ? 'active' : ''}">${c.icon || ''} ${c.label}</a>`)
        .join('');
      return `
        <div class="nav-dropdown">
          <button type="button" class="nav-dropdown-toggle ${isActiveGroup ? 'active' : ''}">
            ${entry.icon} ${entry.label} <span class="nav-caret"></span>
          </button>
          <div class="nav-dropdown-menu">${childLinks}</div>
        </div>
      `;
    }
    return `<a href="${entry.href}" class="${location.pathname === entry.href ? 'active' : ''}">${entry.icon} ${entry.label}</a>`;
  }).join('');

  nav.innerHTML = `
    <div class="nav-links">${linksHtml}</div>
    <div class="who">
      <a href="/admin/user-profile/${user.id}" class="avatar-btn" title="${escapeHtml(user.name)} - view profile">${escapeHtml(initialsFor(user.name))}</a>
    </div>
  `;

  nav.querySelectorAll('.nav-dropdown').forEach((dropdown) => {
    const toggle = dropdown.querySelector('.nav-dropdown-toggle');
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = dropdown.classList.contains('open');
      nav.querySelectorAll('.nav-dropdown.open').forEach((d) => d.classList.remove('open'));
      if (!isOpen) dropdown.classList.add('open');
    });
  });
  document.addEventListener('click', () => {
    nav.querySelectorAll('.nav-dropdown.open').forEach((d) => d.classList.remove('open'));
  });
}

// Downloads `rows` (array of arrays, matching `headers`) as a .csv file.
// A CSV opens directly in Excel and imports cleanly into Google Sheets, so
// this one function covers every "export" button in the Reports section.
function exportToCsv(filename, headers, rows) {
  const escapeCell = (val) => {
    const str = val === null || val === undefined ? '' : String(val);
    return /[",\n]/.test(str) ? '"' + str.replace(/"/g, '""') + '"' : str;
  };
  const lines = [headers, ...rows].map((row) => row.map(escapeCell).join(','));
  // Leading BOM so Excel opens the file as UTF-8 instead of guessing wrong
  // and mangling non-ASCII names.
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Upgrades a plain <select> into a custom-styled dropdown, in place. The
// original <select> stays in the DOM (hidden) so every bit of code that
// already reads its .value or listens for its 'change' event keeps working
// unmodified - clicking a custom option just sets the real select's value
// and dispatches a real 'change' event on it.
function enhanceSelect(select) {
  if (select.dataset.enhanced || select.disabled) return;
  select.dataset.enhanced = 'true';

  const wrapper = document.createElement('div');
  wrapper.className = 'custom-select';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'custom-select-btn';

  const menu = document.createElement('div');
  menu.className = 'custom-select-menu';

  function syncFromSelect() {
    const selected = select.options[select.selectedIndex];
    btn.textContent = selected ? selected.textContent : '';
    menu.querySelectorAll('.custom-select-option').forEach((opt) => {
      opt.classList.toggle('selected', opt.dataset.value === select.value);
    });
  }

  [...select.options].forEach((opt) => {
    const item = document.createElement('div');
    item.className = 'custom-select-option';
    item.textContent = opt.textContent;
    item.dataset.value = opt.value;
    item.addEventListener('click', () => {
      select.value = opt.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      syncFromSelect();
      wrapper.classList.remove('open');
    });
    menu.appendChild(item);
  });

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelectorAll('.custom-select.open').forEach((el) => {
      if (el !== wrapper) el.classList.remove('open');
    });
    wrapper.classList.toggle('open');
  });

  select.parentNode.insertBefore(wrapper, select);
  select.style.display = 'none';
  wrapper.appendChild(btn);
  wrapper.appendChild(menu);
  wrapper.appendChild(select);
  syncFromSelect();
}

function enhanceAllSelects(container) {
  (container || document).querySelectorAll('select').forEach(enhanceSelect);
}

document.addEventListener('click', () => {
  document.querySelectorAll('.custom-select.open').forEach((el) => el.classList.remove('open'));
});

// Call at the top of every admin page. Redirects to login if not authenticated.
// Returns the current user object, or null if a redirect happened.
async function initAdminPage() {
  if (!getToken()) {
    window.location.href = '/login.html';
    return null;
  }
  try {
    const res = await authedFetch('/admin/me');
    const data = await res.json();
    renderNav(data.user);
    return data.user;
  } catch {
    return null;
  }
}
