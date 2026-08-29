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
    throw new Error(data.error || 'Something went wrong');
  }
  return data;
}

export const register = (name, identifier, password, role) =>
  request('/auth/register', { method: 'POST', body: { name, identifier, password, role } });

export const login = (identifier, password) =>
  request('/auth/login', { method: 'POST', body: { identifier, password } });

export const listCountries = (token) => request('/locations/countries', { token });
export const listStates = (token, countryId) => request(`/locations/states?country_id=${countryId}`, { token });
export const listDistricts = (token, stateId) => request(`/locations/districts?state_id=${stateId}`, { token });
export const listBlocks = (token, districtId) => request(`/locations/blocks?district_id=${districtId}`, { token });
export const listVillages = (token, blockId) => request(`/locations/villages?block_id=${blockId}`, { token });

export const listCrops = (token) => request('/master/crops', { token });
export const listVarieties = (token, cropId) => request(`/master/varieties?crop_id=${cropId}`, { token });

export const lookupDemoPlots = (token, phone) =>
  request(`/demo-plots/lookup?phone=${encodeURIComponent(phone)}`, { token });

export const createDemoPlot = (token, payload) =>
  request('/demo-plots', { method: 'POST', body: payload, token });
