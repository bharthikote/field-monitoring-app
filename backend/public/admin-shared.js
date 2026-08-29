const NAV_STRUCTURE = [
  { href: '/admin', label: 'Pending Approvals' },
  {
    label: 'System Update',
    children: [
      { href: '/admin/locations', label: 'Locations' },
      { href: '/admin/crops', label: 'Crops' },
      { href: '/admin/master-lists', label: 'Master Lists' },
      { href: '/admin/manage-users', label: 'All Users' },
    ],
  },
  {
    label: 'Reports',
    children: [
      { href: '/admin/reports/farmers', label: 'Farmers' },
      { href: '/admin/reports/demos', label: 'Demos' },
      { href: '/admin/reports/master-list', label: 'Master List' },
    ],
  },
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
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}), Authorization: `Bearer ${getToken()}` },
  });
  if (res.status === 401) {
    clearToken();
    window.location.href = '/login.html';
    throw new Error('Session expired, redirecting to login');
  }
  return res;
}

function renderNav(user) {
  const nav = document.getElementById('admin-nav');
  if (!nav) return;

  const linksHtml = NAV_STRUCTURE.map((entry) => {
    if (entry.children) {
      const isActiveGroup = entry.children.some((c) => c.href === location.pathname);
      const childLinks = entry.children
        .map((c) => `<a href="${c.href}" class="${location.pathname === c.href ? 'active' : ''}">${c.label}</a>`)
        .join('');
      return `
        <div class="nav-dropdown">
          <button type="button" class="nav-dropdown-toggle ${isActiveGroup ? 'active' : ''}">
            ${entry.label} <span class="nav-caret">▾</span>
          </button>
          <div class="nav-dropdown-menu">${childLinks}</div>
        </div>
      `;
    }
    return `<a href="${entry.href}" class="${location.pathname === entry.href ? 'active' : ''}">${entry.label}</a>`;
  }).join('');

  nav.innerHTML = `
    <div class="nav-links">${linksHtml}</div>
    <div class="who">Logged in as <strong>${escapeHtml(user.name)}</strong> (${escapeHtml(user.role)})
      <button id="logout-btn">Log out</button>
    </div>
  `;

  document.getElementById('logout-btn').addEventListener('click', () => {
    clearToken();
    window.location.href = '/login.html';
  });

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
