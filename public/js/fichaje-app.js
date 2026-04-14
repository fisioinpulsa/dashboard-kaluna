let fichajeUser = null;
let tipoFichaje = null;
let firmaCtx = null;
let firmaDibujando = false;

// LOGIN
document.getElementById('form-fichaje-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = document.getElementById('fichaje-login-error');
  err.style.display = 'none';
  try {
    const res = await fetch('/api/fichaje/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: document.getElementById('fichaje-pin').value })
    });
    const data = await res.json();
    if (!res.ok) { err.textContent = data.error; err.style.display = 'block'; return; }
    fichajeUser = data;
    mostrarPanel();
  } catch { err.textContent = 'Error de conexión'; err.style.display = 'block'; }
});

async function mostrarPanel() {
  document.getElementById('fichaje-login').style.display = 'none';
  document.getElementById('fichaje-panel').style.display = 'block';

  // Reloj
  actualizarReloj();
  setInterval(actualizarReloj, 1000);

  // Fecha
  document.getElementById('fichaje-fecha').textContent = new Date().toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  // Cargar estado y fichajes
  await cargarEstado();
  await cargarHoy();
}

function actualizarReloj() {
  document.getElementById('fichaje-reloj').textContent = new Date().toLocaleTimeString('es-ES');
}

async function cargarEstado() {
  try {
    const res = await fetch('/api/fichaje/estado');
    const data = await res.json();
    if (!res.ok) { cerrarFichaje(); return; }

    document.getElementById('fichaje-nombre').textContent = data.nombre;

    const estado = document.getElementById('fichaje-estado');
    if (data.trabajando) {
      estado.className = 'fichaje-status dentro';
      estado.textContent = `Trabajando desde las ${data.ultimo.hora.substring(0, 5)}`;
    } else {
      estado.className = 'fichaje-status fuera';
      estado.textContent = data.ultimo ? `Última salida: ${data.ultimo.hora.substring(0, 5)}` : 'Sin fichar hoy';
    }
  } catch { cerrarFichaje(); }
}

async function cargarHoy() {
  try {
    const res = await fetch('/api/fichaje/hoy');
    const fichajes = await res.json();
    const container = document.getElementById('fichaje-hoy');
    container.innerHTML = fichajes.length ? fichajes.map(f =>
      `<div class="fichaje-registro">
        <span class="tipo-${f.tipo}">${f.tipo === 'entrada' ? '🟢 Entrada' : '🔴 Salida'}</span>
        <span>${f.hora.substring(0, 5)}</span>
      </div>`
    ).join('') : '<p style="color:var(--text-light);font-size:.85rem">No hay fichajes hoy</p>';
  } catch {}
}

function iniciarFichaje(tipo) {
  tipoFichaje = tipo;
  document.getElementById('fichaje-botones').style.display = 'none';
  document.getElementById('fichaje-firma-container').style.display = 'block';
  const btn = document.getElementById('btn-confirmar');
  btn.textContent = tipo === 'entrada' ? 'Confirmar ENTRADA' : 'Confirmar SALIDA';
  btn.className = `fichaje-btn ${tipo}`;
  // Inicializar canvas ahora que es visible
  setTimeout(() => { initFirma(); limpiarFirma(); }, 50);
}

async function confirmarFichaje() {
  const canvas = document.getElementById('firma-canvas');
  // Comprobar si el canvas tiene algo dibujado
  const ctx = canvas.getContext('2d');
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let vacio = true;
  for (let i = 3; i < pixels.length; i += 4) {
    if (pixels[i] > 0) { vacio = false; break; }
  }
  if (vacio) { alert('Debes firmar antes de confirmar'); return; }
  const firma = canvas.toDataURL('image/png');

  try {
    const res = await fetch('/api/fichaje/registrar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: tipoFichaje, firma })
    });
    if (res.ok) {
      document.getElementById('fichaje-firma-container').style.display = 'none';
      document.getElementById('fichaje-botones').style.display = 'block';
      await cargarEstado();
      await cargarHoy();
    }
  } catch {}
}

function cerrarFichaje() {
  fetch('/api/fichaje/logout', { method: 'POST' });
  document.getElementById('fichaje-panel').style.display = 'none';
  document.getElementById('fichaje-login').style.display = 'block';
  document.getElementById('fichaje-pin').value = '';
}

// FIRMA
let firmaIniciada = false;

function initFirma() {
  const canvas = document.getElementById('firma-canvas');
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width - 4;
  canvas.height = 150;
  firmaCtx = canvas.getContext('2d');
  firmaCtx.strokeStyle = '#333';
  firmaCtx.lineWidth = 2.5;
  firmaCtx.lineCap = 'round';
  firmaCtx.lineJoin = 'round';

  if (!firmaIniciada) {
    firmaIniciada = true;

    function getPos(e) {
      const r = canvas.getBoundingClientRect();
      const touch = e.touches ? e.touches[0] : e;
      return { x: touch.clientX - r.left, y: touch.clientY - r.top };
    }

    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      firmaDibujando = true;
      const pos = getPos(e);
      firmaCtx.beginPath();
      firmaCtx.moveTo(pos.x, pos.y);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!firmaDibujando) return;
      e.preventDefault();
      const pos = getPos(e);
      firmaCtx.lineTo(pos.x, pos.y);
      firmaCtx.stroke();
    });
    canvas.addEventListener('pointerup', (e) => { e.preventDefault(); firmaDibujando = false; });
    canvas.addEventListener('pointerleave', () => firmaDibujando = false);
  }
}

function limpiarFirma() {
  const canvas = document.getElementById('firma-canvas');
  if (firmaCtx) firmaCtx.clearRect(0, 0, canvas.width, canvas.height);
}

// Auto-check login
fetch('/api/fichaje/estado').then(r => { if (r.ok) return r.json().then(d => { fichajeUser = d; mostrarPanel(); }); });
