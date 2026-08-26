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

// ======================================================
// GLOBAL BUTTON RATE LIMITING
// ------------------------------------------------------
// Every button gets a 10-second cooldown after it is clicked, so rapid
// repeated clicks can't spam the (cold-starting) server with API calls.
// Modal close buttons (.close) and anything marked [data-no-ratelimit]
// are exempt so users are never trapped in a dialog.
// ======================================================

const RATE_LIMIT_MS = 10000;
const _rlCooldowns = new WeakMap();

document.addEventListener('click', function (e) {
  const btn = e.target.closest('button');
  if (!btn) return;
  if (btn.classList.contains('close') || btn.hasAttribute('data-no-ratelimit')) return;

  const now = Date.now();
  const until = _rlCooldowns.get(btn) || 0;

  if (now < until) {
    // Still cooling down — block the click's action completely.
    e.preventDefault();
    e.stopImmediatePropagation();
    return;
  }

  _rlCooldowns.set(btn, now + RATE_LIMIT_MS);
  _startButtonCooldown(btn, RATE_LIMIT_MS);
}, true); // capture phase: runs before the button's own handlers

function _startButtonCooldown(btn, ms) {
  // Defer so THIS click's own handler still runs before we disable it.
  setTimeout(() => {
    if (btn.disabled) return;
    const original = btn.textContent;
    // Only rewrite the label for plain-text buttons (skip icon-only buttons).
    const isTextButton = original && original.trim().length > 1 && !btn.querySelector('*');
    btn.disabled = true;
    btn.classList.add('rl-cooldown');

    let remaining = Math.round(ms / 1000);
    if (isTextButton) btn.textContent = 'Wait ' + remaining + 's';

    const iv = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(iv);
        btn.disabled = false;
        btn.classList.remove('rl-cooldown');
        if (isTextButton) btn.textContent = original;
      } else if (isTextButton) {
        btn.textContent = 'Wait ' + remaining + 's';
      }
    }, 1000);
  }, 0);
}

// ======================================================
// PWA: register the service worker (installable app + offline shell)
// ======================================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
