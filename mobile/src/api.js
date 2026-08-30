import { API_BASE_URL } from './config';

async function request(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error || 'Something went wrong');
    err.code = data.code;
    err.existingFarmerName = data.existingFarmerName;
    throw err;
  }
  return data;
}

export const register = (name, identifier, password, role) =>
  request('/auth/register', { method: 'POST', body: { name, identifier, password, role } });

export const login = (identifier, password) =>
  request('/auth/login', { method: 'POST', body: { identifier, password } });

export const searchVillages = (token, q) => request(`/locations/villages/search?q=${encodeURIComponent(q)}`, { token });

export const listCrops = (token) => request('/master/crops', { token });
export const listVarieties = (token, cropId) => request(`/master/varieties?crop_id=${cropId}`, { token });

export const listDemoPlots = (token) => request('/demo-plots', { token });

export const searchDemoPlots = (token, query) =>
  request(`/demo-plots/search?q=${encodeURIComponent(query)}`, { token });

export const createDemoPlot = (token, payload) =>
  request('/demo-plots', { method: 'POST', body: payload, token });

export const listIssueTypes = (token) => request('/master/issue-types', { token });
export const listGoodThings = (token) => request('/master/good-things-observed', { token });
export const listDiseases = (token) => request('/master/diseases', { token });
export const listPests = (token) => request('/master/pests', { token });

export const listVisits = (token, demoPlotId) =>
  request(`/visits?demo_plot_id=${demoPlotId}`, { token });

export const getMyVisitCount = (token) => request('/visits/my-count', { token });

// Visits carry photos, so this posts multipart/form-data directly rather
// than going through the JSON-only `request` helper above.
export async function createVisit(token, formData) {
  const res = await fetch(`${API_BASE_URL}/visits`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Something went wrong');
  }
  return data;
}

export const listAssignableUsers = (token) => request('/issues/assignable-users', { token });
export const listIssuesAssignedToMe = (token) => request('/issues/assigned-to-me', { token });
export const listIssuesRaisedByMe = (token) => request('/issues/raised-by-me', { token });
export const getIssue = (token, issueId) => request(`/issues/${issueId}`, { token });
export const assignIssue = (token, issueId, assignedTo) =>
  request(`/issues/${issueId}/assign`, { method: 'POST', body: { assignedTo }, token });
export const startIssue = (token, issueId) =>
  request(`/issues/${issueId}/start`, { method: 'POST', body: {}, token });
export const resolveIssue = (token, issueId, note) =>
  request(`/issues/${issueId}/resolve`, { method: 'POST', body: { note }, token });
export const verifyIssue = (token, issueId, approved, note) =>
  request(`/issues/${issueId}/verify`, { method: 'POST', body: { approved, note }, token });

// Raising an issue carries an optional photo, so this posts multipart/
// form-data directly, same pattern as createVisit above.
export async function raiseIssue(token, formData) {
  const res = await fetch(`${API_BASE_URL}/issues`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Something went wrong');
  }
  return data;
}
