const API_BASE = 'http://localhost:5000/api';

function getToken() {
  return localStorage.getItem('cgpa_token');
}

function saveAuth(data) {
  localStorage.setItem('cgpa_token', data.token);
  localStorage.setItem('cgpa_user', JSON.stringify(data.user));
}

function logout() {
  localStorage.removeItem('cgpa_token');
  localStorage.removeItem('cgpa_user');
  window.location.href = 'login.html';
}

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401) logout();
    throw new Error(data.message || 'Request failed');
  }
  return data;
}

function requireAuth() {
  if (!getToken()) window.location.href = 'login.html';
}
