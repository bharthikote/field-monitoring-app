const NAV_LINKS = [
  { href: '/admin', label: 'Pending Approvals' },
  { href: '/admin/locations', label: 'Locations' },
  { href: '/admin/crops', label: 'Crops' },
  { href: '/admin/master-lists', label: 'Master Lists' },
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
  const links = NAV_LINKS.map(
    (l) => `<a href="${l.href}" class="${location.pathname === l.href ? 'active' : ''}">${l.label}</a>`,
  ).join('');
  nav.innerHTML = `
    <div class="nav-links">${links}</div>
    <div class="who">Logged in as <strong>${escapeHtml(user.name)}</strong> (${escapeHtml(user.role)})
      <button id="logout-btn">Log out</button>
    </div>
  `;
  document.getElementById('logout-btn').addEventListener('click', () => {
    clearToken();
    window.location.href = '/login.html';
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
