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
      window.location.href = 'dashboard.html';
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
