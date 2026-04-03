import { restFetch } from './api';

export async function login(email, password) {
  const result = await restFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (result.data?.token) {
    localStorage.setItem('token', result.data.token);
  }
  return result.data;
}

export async function register(username, email, password) {
  const result = await restFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, email, password }),
  });
  if (result.data?.token) {
    localStorage.setItem('token', result.data.token);
  }
  return result.data;
}

export async function logout() {
  await restFetch('/auth/logout', { method: 'POST' });
  localStorage.removeItem('token');
}

export async function getMe() {
  const result = await restFetch('/auth/me');
  return result.data;
}
