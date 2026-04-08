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

export async function register(username, email, password, birthday = null, gender = null) {
  const result = await restFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, email, password, birthday, gender }),
  });
  if (result.data?.token) {
    localStorage.setItem('token', result.data.token);
  }
  return result.data;
}

export async function googleLogin(credential, birthday = null, gender = null) {
  const body = { credential };
  if (birthday) body.birthday = birthday;
  if (gender) body.gender = gender;

  const result = await restFetch('/auth/google', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (result.data?.token) {
    localStorage.setItem('token', result.data.token);
  }
  return result.data;
}

export async function getSettings() {
  const result = await restFetch('/auth/settings');
  return result.data;
}

export async function changePassword(currentPassword, newPassword) {
  const result = await restFetch('/auth/settings/password', {
    method: 'POST',
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
  return result.data;
}

export async function updateSettingsProfile(data) {
  const result = await restFetch('/auth/settings/profile', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return result.data;
}

export async function forgotPassword(email) {
  const result = await restFetch('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
  return result.data;
}

export async function resetPassword(token, password) {
  const result = await restFetch('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, password }),
  });
  return result.data;
}

export async function createPayment(amount) {
  const result = await restFetch('/payment/create', {
    method: 'POST',
    body: JSON.stringify({ amount }),
  });
  return result.data;
}

export async function verifyPayment(queryString) {
  const result = await restFetch('/payment/verify?' + queryString);
  return result.data;
}

export async function getBalance() {
  const result = await restFetch('/payment/balance');
  return result.data;
}

export async function getTransactions() {
  const result = await restFetch('/payment/transactions');
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
