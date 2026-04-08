document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    document.getElementById('form-admin').style.display = tab === 'admin' ? 'flex' : 'none';
    document.getElementById('form-trabajadora').style.display = tab === 'trabajadora' ? 'flex' : 'none';
  });
});

document.getElementById('form-admin').addEventListener('submit', async (e) => {
  e.preventDefault();
  await login({ email: document.getElementById('email').value, password: document.getElementById('password').value });
});

document.getElementById('form-trabajadora').addEventListener('submit', async (e) => {
  e.preventDefault();
  await login({ pin: document.getElementById('pin').value });
});

async function login(body) {
  const err = document.getElementById('login-error');
  err.style.display = 'none';
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) { err.textContent = data.error; err.style.display = 'block'; return; }
    window.location.href = '/dashboard';
  } catch (e) {
    err.textContent = 'Error de conexión'; err.style.display = 'block';
  }
}

// Check if already logged in
fetch('/api/auth/me').then(r => { if (r.ok) window.location.href = '/dashboard'; });
