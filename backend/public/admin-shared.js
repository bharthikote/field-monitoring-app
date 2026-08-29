const NAV_STRUCTURE = [
  { href: '/admin', label: 'Pending Approvals' },
  {
    label: 'System Data',
    children: [
      { href: '/admin/locations', label: 'Locations' },
      { href: '/admin/crops', label: 'Crops' },
      { href: '/admin/master-lists', label: 'Master Lists' },
    ],
  },
  { href: '/admin/manage-users', label: 'All Users' },
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
