import { API_BASE_URL } from './config';

async function request(path, body) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Something went wrong');
  }
  return data;
}

export const register = (name, identifier, password, role) =>
  request('/auth/register', { name, identifier, password, role });

export const login = (identifier, password) =>
  request('/auth/login', { identifier, password });
