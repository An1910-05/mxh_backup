import { API_ORIGIN } from '../config';

const API_URL = API_ORIGIN;
const GRAPHQL_URL =
  import.meta.env.VITE_GRAPHQL_URL || `${API_ORIGIN.replace(/\/$/, '')}/graphql`;

function getToken() {
  return localStorage.getItem('token');
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function restFetch(endpoint, options = {}) {
  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...options.headers,
    },
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.message || 'Request failed');
  }

  return data;
}

export async function uploadFile(endpoint, fieldName, file) {
  const formData = new FormData();
  formData.append(fieldName, file);

  const token = getToken();
  const res = await fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  const raw = await res.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    throw new Error('Server upload trả về không phải JSON. Vui lòng kiểm tra log backend/PHP.');
  }

  if (!res.ok) throw new Error(data?.message || 'Upload failed');
  return data;
}

export async function graphqlFetch(query, variables = {}) {
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await res.json();

  if (json.errors && json.errors.length > 0) {
    const err = json.errors[0];
    const debug = err.debugMessage || err.extensions?.debugMessage;
    const message = debug ? `${err.message}: ${debug}` : err.message;
    throw new Error(message);
  }

  return json.data;
}
