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
export const searchLocations = (token, q) => request(`/locations/search?q=${encodeURIComponent(q)}`, { token });

export const listCrops = (token) => request('/master/crops', { token });
export const listVarieties = (token, cropId) => request(`/master/varieties?crop_id=${cropId}`, { token });
export const listSeasons = (token, countryId) =>
  request(`/master/seasons${countryId ? `?countryId=${countryId}` : ''}`, { token });

export const listDemoPlots = (token, plotType = 'demo') =>
  request(`/demo-plots?plot_type=${plotType}`, { token });

export const searchDemoPlots = (token, query, plotType = 'demo') =>
  request(`/demo-plots/search?q=${encodeURIComponent(query)}&plot_type=${plotType}`, { token });

export const createDemoPlot = (token, payload) =>
  request('/demo-plots', { method: 'POST', body: payload, token });

export const createTfoDemo = (token, payload) =>
  request('/tfo-demos', { method: 'POST', body: payload, token });
export const listTfoDemos = (token) => request('/tfo-demos', { token });
export const getTfoDemo = (token, demoId) => request(`/tfo-demos/${demoId}`, { token });
export const updateTfoDemo = (token, demoId, payload) =>
  request(`/tfo-demos/${demoId}`, { method: 'PATCH', body: payload, token });
export const setTfoDemoStatus = (token, demoId, status) =>
  request(`/tfo-demos/${demoId}/status`, { method: 'POST', body: { status }, token });

export const getExpectedCost = (token, demoId) => request(`/tfo-demos/${demoId}/expected-cost`, { token });
export const saveExpectedCostItem = (token, demoId, payload) =>
  request(`/tfo-demos/${demoId}/expected-cost`, { method: 'POST', body: payload, token });
export const deleteExpectedCostItem = (token, demoId, itemId) =>
  request(`/tfo-demos/${demoId}/expected-cost/${itemId}`, { method: 'DELETE', token });

export const getExpectedReturn = (token, demoId) => request(`/tfo-demos/${demoId}/expected-return`, { token });
export const saveExpectedReturnItem = (token, demoId, payload) =>
  request(`/tfo-demos/${demoId}/expected-return`, { method: 'POST', body: payload, token });
export const deleteExpectedReturnItem = (token, demoId, itemId) =>
  request(`/tfo-demos/${demoId}/expected-return/${itemId}`, { method: 'DELETE', token });

export const getActualCost = (token, demoId) => request(`/tfo-demos/${demoId}/actual-cost`, { token });
export const createActualCostTransaction = (token, demoId, payload) =>
  request(`/tfo-demos/${demoId}/actual-cost`, { method: 'POST', body: payload, token });
export const updateActualCostTransaction = (token, demoId, transactionId, payload) =>
  request(`/tfo-demos/${demoId}/actual-cost/${transactionId}`, { method: 'PATCH', body: payload, token });
export const deleteActualCostTransaction = (token, demoId, transactionId) =>
  request(`/tfo-demos/${demoId}/actual-cost/${transactionId}`, { method: 'DELETE', token });

export const getActualReturn = (token, demoId) => request(`/tfo-demos/${demoId}/actual-return`, { token });
export const createActualReturnTransaction = (token, demoId, payload) =>
  request(`/tfo-demos/${demoId}/actual-return`, { method: 'POST', body: payload, token });
export const updateActualReturnTransaction = (token, demoId, transactionId, payload) =>
  request(`/tfo-demos/${demoId}/actual-return/${transactionId}`, { method: 'PATCH', body: payload, token });
export const deleteActualReturnTransaction = (token, demoId, transactionId) =>
  request(`/tfo-demos/${demoId}/actual-return/${transactionId}`, { method: 'DELETE', token });

export const createTfoHomeGarden = (token, payload) =>
  request('/tfo-home-gardens', { method: 'POST', body: payload, token });
export const listTfoHomeGardens = (token) => request('/tfo-home-gardens', { token });

export const listFarmers = (token) => request('/farmers', { token });
export const searchFarmers = (token, query) => request(`/farmers/search?q=${encodeURIComponent(query)}`, { token });
export const getFarmerByPhone = (token, phone) =>
  request(`/farmers/by-phone?phone=${encodeURIComponent(phone)}`, { token });
// A farmer can optionally carry a photo (the detailed TFO create form), so
// this always posts multipart/form-data - the simple higher-role form just
// omits every field beyond name/phone/villageId.
export async function createFarmer(token, formData) {
  const res = await fetch(`${API_BASE_URL}/farmers`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error || 'Something went wrong');
    err.code = data.code;
    err.existingFarmerId = data.existingFarmerId;
    throw err;
  }
  return data;
}
export const getFarmer = (token, farmerId) => request(`/farmers/${farmerId}`, { token });

// Same shape as createFarmer (multipart - the optional photo needs it), a
// PATCH instead of a POST.
export async function updateFarmer(token, farmerId, formData) {
  const res = await fetch(`${API_BASE_URL}/farmers/${farmerId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error || 'Something went wrong');
    err.code = data.code;
    throw err;
  }
  return data;
}
export const getFarmerActivities = (token, farmerId) => request(`/farmers/${farmerId}/activities`, { token });
export const deactivateFarmer = (token, farmerId) =>
  request(`/farmers/${farmerId}/deactivate`, { method: 'POST', body: {}, token });

export const listIssueTypes = (token) => request('/master/issue-types', { token });
export const listGoodThings = (token) => request('/master/good-things-observed', { token });
export const listDiseases = (token) => request('/master/diseases', { token });
export const listPests = (token) => request('/master/pests', { token });
export const listTechniques = (token) => request('/master/techniques', { token });

export const listVisits = (token, demoPlotId) =>
  request(`/visits?demo_plot_id=${demoPlotId}`, { token });

export const getMyVisitCount = (token, plotType) =>
  request(`/visits/my-count${plotType ? `?plot_type=${plotType}` : ''}`, { token });

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

export const listTrainings = (token) => request('/trainings', { token });
export const getMyTrainingCount = (token) => request('/trainings/my-count', { token });

// Trainings carry a photo, so this posts multipart/form-data directly,
// same pattern as createVisit.
export async function createTraining(token, formData) {
  const res = await fetch(`${API_BASE_URL}/trainings`, {
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

export const listFieldDays = (token) => request('/field-days', { token });
export const getMyFieldDayCount = (token) => request('/field-days/my-count', { token });

// Field days carry a photo, so this posts multipart/form-data directly,
// same pattern as createTraining.
export async function createFieldDay(token, formData) {
  const res = await fetch(`${API_BASE_URL}/field-days`, {
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

export const listInstitutions = (token) => request('/institutions', { token });
export const searchInstitutions = (token, query) => request(`/institutions/search?q=${encodeURIComponent(query)}`, { token });
export const createInstitution = (token, payload) =>
  request('/institutions', { method: 'POST', body: payload, token });
export const getInstitution = (token, institutionId) => request(`/institutions/${institutionId}`, { token });
export const getMyInstitutionVisitCount = (token) => request('/institution-visits/my-count', { token });

// Institution visits carry a photo, so this posts multipart/form-data
// directly, same pattern as createVisit.
export async function createInstitutionVisit(token, formData) {
  const res = await fetch(`${API_BASE_URL}/institution-visits`, {
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

export const listAgroDealers = (token) => request('/agro-dealers', { token });
export const searchAgroDealers = (token, query) => request(`/agro-dealers/search?q=${encodeURIComponent(query)}`, { token });
export const createAgroDealer = (token, payload) =>
  request('/agro-dealers', { method: 'POST', body: payload, token });
export const getAgroDealer = (token, dealerId) => request(`/agro-dealers/${dealerId}`, { token });
export const getMyAgroDealerVisitCount = (token) => request('/agro-dealer-visits/my-count', { token });

// Agro dealer visits carry a photo, so this posts multipart/form-data
// directly, same pattern as createVisit.
export async function createAgroDealerVisit(token, formData) {
  const res = await fetch(`${API_BASE_URL}/agro-dealer-visits`, {
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

export const getMyDataCollectionForms = (token) => request('/my-data-collection-forms', { token });
export const getDataCollectionForm = (token, formId) => request(`/data-collection-forms/${formId}`, { token });

// Field values carry a mix of plain text and photo files, so this posts
// multipart/form-data directly, same pattern as createVisit.
export async function submitDataCollectionForm(token, formId, formData) {
  const res = await fetch(`${API_BASE_URL}/data-collection-forms/${formId}/submissions`, {
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

export const getMyProjects = (token) => request('/my-projects', { token });

export const listAssignableUsers = (token, villageId, issueId) =>
  request(`/issues/assignable-users?villageId=${villageId}${issueId ? `&issueId=${issueId}` : ''}`, { token });
export const acknowledgeIssue = (token, issueId, note) =>
  request(`/issues/${issueId}/acknowledge`, { method: 'POST', body: { note }, token });
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
export const disputeIssue = (token, issueId, note) =>
  request(`/issues/${issueId}/dispute`, { method: 'POST', body: { note }, token });
export const reviewDispute = (token, issueId, genuine, note) =>
  request(`/issues/${issueId}/dispute-review`, { method: 'POST', body: { genuine, note }, token });
export const listReassignableUsers = (token, villageId) =>
  request(`/issues/reassignable-users?villageId=${villageId}`, { token });
export const reassignIssue = (token, issueId, assignedTo, comment) =>
  request(`/issues/${issueId}/reassign`, { method: 'POST', body: { assignedTo, comment }, token });
export const listReassignments = (token, issueId) =>
  request(`/issues/${issueId}/reassignments`, { token });
export const getIssueStats = (token) => request('/issues/stats', { token });
export const listOpenIssuesForPlot = (token, demoPlotId) =>
  request(`/issues/open-for-plot?demoPlotId=${demoPlotId}`, { token });
export const bulkVerifyIssues = (token, issueIds) =>
  request('/issues/bulk-verify', { method: 'POST', body: { issueIds }, token });

export const listNotifications = (token) => request('/notifications', { token });
export const getUnreadNotificationCount = (token) => request('/notifications/unread-count', { token });
export const markNotificationRead = (token, notificationId) =>
  request(`/notifications/${notificationId}/read`, { method: 'POST', body: {}, token });
export const markAllNotificationsRead = (token) =>
  request('/notifications/read-all', { method: 'POST', body: {}, token });
