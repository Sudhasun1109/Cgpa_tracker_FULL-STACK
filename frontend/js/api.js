const API_BASE = 'https://cgpa-tracker-backend.onrender.com/api';

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
    // Only force logout when a session token exists (expired/invalid session).
    // On login/forgot pages there is no token, so we let the error show.
    if (response.status === 401 && getToken()) logout();
    throw new Error(data.message || 'Request failed');
  }
  return data;
}

function getUser() {
  try {
    return JSON.parse(localStorage.getItem('cgpa_user')) || null;
  } catch {
    return null;
  }
}

function requireAuth() {
  if (!getToken()) window.location.href = 'login.html';
}

function requireAdmin() {
  if (!getToken()) { window.location.href = 'login.html'; return; }
  const user = getUser();
  if (!user || user.role !== 'admin') {
    // Not an admin -> send to the normal dashboard.
    window.location.href = 'dashboard.html';
  }
}
