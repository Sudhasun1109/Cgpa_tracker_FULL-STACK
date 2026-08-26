/* Global click/submit rate limiter.
   After a button is clicked (or a form submitted), the SAME element is
   locked for COOLDOWN_MS. Further clicks within that window are ignored,
   which stops rapid repeated API calls from hammering the server.

   Opt a control out with the `data-no-rl` attribute (used for pure UI
   buttons like opening/closing modals, editing, navigation). Modal close
   buttons (.close) and the logout button are opted out automatically. */
(function () {
  const COOLDOWN_MS = 10000; // 10 seconds

  function toast(msg) {
    let t = document.getElementById('rl-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'rl-toast';
      t.className = 'rl-toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._hideTimer);
    t._hideTimer = setTimeout(() => t.classList.remove('show'), 1800);
  }

  function optedOut(el) {
    if (!el) return true;
    if (el.hasAttribute('data-no-rl')) return true;
    if (el.closest('[data-no-rl]')) return true;
    if (el.classList && el.classList.contains('close')) return true;
    if (el.id === 'logoutBtn') return true;
    return false;
  }

  function remaining(el) {
    const until = Number(el.dataset.rlUntil || 0);
    return until - Date.now();
  }

  function startCooldown(el) {
    el.dataset.rlUntil = String(Date.now() + COOLDOWN_MS);
    el.classList.add('rl-cooling');
    setTimeout(() => {
      el.classList.remove('rl-cooling');
      delete el.dataset.rlUntil;
    }, COOLDOWN_MS);
  }

  // Rapid repeated clicks on the same button.
  document.addEventListener('click', function (e) {
    const el = e.target.closest('button');
    if (!el || optedOut(el)) return;
    const left = remaining(el);
    if (left > 0) {
      e.preventDefault();
      e.stopImmediatePropagation();
      toast(`Please wait ${Math.ceil(left / 1000)}s before clicking again`);
      return;
    }
    startCooldown(el);
  }, true);

  // Rapid repeated form submissions (also covers Enter-key submits).
  document.addEventListener('submit', function (e) {
    const form = e.target;
    if (!form || optedOut(form)) return;
    const left = remaining(form);
    if (left > 0) {
      e.preventDefault();
      e.stopImmediatePropagation();
      toast(`Please wait ${Math.ceil(left / 1000)}s before submitting again`);
      return;
    }
    startCooldown(form);
  }, true);

  window.RL_COOLDOWN_MS = COOLDOWN_MS;
})();
