const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');

if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = document.getElementById('message');
    message.textContent = 'Logging in...';
    try {
      const data = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: document.getElementById('email').value,
          password: document.getElementById('password').value
        })
      });
      saveAuth(data);
      // Role-based redirect: admins go to the admin panel.
      if (data.user && data.user.role === 'admin') {
        window.location.href = 'admin.html';
      } else {
        window.location.href = 'dashboard.html';
      }
    } catch (err) {
      message.textContent = err.message;
    }
  });
}

if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = document.getElementById('message');
    message.textContent = 'Creating account...';
    try {
      await api('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: document.getElementById('name').value,
          registerNumber: document.getElementById('registerNumber').value,
          email: document.getElementById('email').value,
          password: document.getElementById('password').value,
          college: document.getElementById('college').value,
          department: document.getElementById('department').value
        })
      });
      message.style.color = '#16803c';
      message.textContent = 'Registration successful. Redirecting to login...';
      setTimeout(() => window.location.href = 'login.html', 900);
    } catch (err) {
      message.style.color = '#d12f2f';
      message.textContent = err.message;
    }
  });
}

// ======================================================
// SHOW / HIDE PASSWORD TOGGLES
// ======================================================

function setupShowPassword(checkboxId, inputIds) {
  const box = document.getElementById(checkboxId);
  if (!box) return;
  box.addEventListener('change', () => {
    inputIds.forEach(id => {
      const input = document.getElementById(id);
      if (input) input.type = box.checked ? 'text' : 'password';
    });
  });
}

setupShowPassword('showLoginPass', ['password']);
setupShowPassword('showRegPass', ['password']);
setupShowPassword('showForgotPass', ['newPassword', 'confirmPassword']);

// ======================================================
// FORGOT PASSWORD
// ======================================================

const forgotForm = document.getElementById('forgotForm');
if (forgotForm) {
  forgotForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = document.getElementById('message');
    message.style.color = '';
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (newPassword !== confirmPassword) {
      message.style.color = '#d12f2f';
      message.textContent = 'Passwords do not match.';
      return;
    }

    message.textContent = 'Resetting...';
    try {
      const data = await api('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({
          email: document.getElementById('email').value.trim(),
          registerNumber: document.getElementById('registerNumber').value.trim(),
          newPassword
        })
      });
      message.style.color = '#16803c';
      message.textContent = data.message + ' Redirecting to login...';
      setTimeout(() => window.location.href = 'login.html', 1200);
    } catch (err) {
      message.style.color = '#d12f2f';
      message.textContent = err.message;
    }
  });
}
