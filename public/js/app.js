let currentUser = null;
const $ = id => document.getElementById(id);
const esAdmin = () => currentUser?.rol === 'admin';
const esSuperAdmin = () => currentUser?.rol === 'admin' && currentUser?.id === 1;
const API = path => fetch(path).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
const POST = (path, body) => fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());
const PUT = (path, body) => fetch(path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());
const DEL = path => fetch(path, { method: 'DELETE' }).then(r => r.json());
const LOG = (accion, seccion, detalle) => POST('/api/actividad', { accion, seccion, detalle }).catch(() => {});

// INIT
async function init() {
  try {
    currentUser = await API('/api/auth/me');
    $('user-info').textContent = `${currentUser.nombre} (${currentUser.rol})`;
    const esAdmin = currentUser.rol === 'admin';
    if (!esAdmin) {
      document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
      // Trabajadoras: empiezan en Diario, no ven Inicio
      document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
      $('sec-diario').classList.add('active');
      document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
      document.querySelector('[data-section="diario"]').classList.add('active');
    }
    setupNav();
    $('fecha-hoy').textContent = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    if (esAdmin) cargarInicio();
    else cargarDiario();
  } catch {
    window.location.href = '/login';
  }
}

// NAV
function setupNav() {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
      btn.classList.add('active');
      const sec = btn.dataset.section;
      $(`sec-${sec}`).classList.add('active');
      const loaders = { inicio: cargarInicio, clientes: cargarClientes, plazas: cargarPlazas, ventas: cargarSoloVentas, caja: cargarSoloCaja, leads: cargarLeads, lesiones: cargarLesiones, cambios: cargarCambios, espera: cargarEspera, diario: cargarDiario, avisos: cargarAvisos, fichajes: cargarFichajesAdmin, config: cargarConfig };
      if (loaders[sec]) loaders[sec]();
    });
  });
  $('btn-logout').addEventListener('click', async () => { await POST('/api/auth/logout', {}); window.location.href = '/login'; });
  $('filtro-clientes').addEventListener('change', cargarClientes);
  $('form-password').addEventListener('submit', async e => {
    e.preventDefault();
    await PUT('/api/auth/password', { password: $('new-password').value });
    alert('Contraseña actualizada');
    $('new-password').value = '';
  });
}

// MODAL
function abrirModal(html) {
  $('modal-content').innerHTML = html;
  $('modal-overlay').classList.add('active');
}
function cerrarModal() { $('modal-overlay').classList.remove('active'); }
$('modal-overlay').addEventListener('click', e => { if (e.target === $('modal-overlay')) cerrarModal(); });

// ==================== INICIO ====================
async function cargarInicio() {
  const data = await API('/api/dashboard');
  const ventasTotal = data.ventas_mes?.total || 0;
  const ventasNum = data.ventas_mes?.num || 0;
  $('stats-grid').innerHTML = `
    <div class="stat-card success" style="cursor:pointer" onclick="verDesgloseActivos()"><div class="stat-icon">👥</div><div class="stat-value">${data.clientes_activos || 0}</div><div class="stat-label">Clientes activos <span style="font-size:.7rem">▶ ver</span></div></div>
    <div class="stat-card danger"><div class="stat-icon">📉</div><div class="stat-value">${data.clientes_baja || 0}</div><div class="stat-label">Bajas totales</div></div>
    <div class="stat-card success" style="cursor:pointer" onclick="verListaMes('altas')"><div class="stat-icon">📈</div><div class="stat-value">${data.clientes_alta_mes || 0}</div><div class="stat-label">Altas en ${data.mes_actual} <span style="font-size:.7rem">▶ ver</span></div></div>
    <div class="stat-card danger" style="cursor:pointer" onclick="verListaMes('bajas')"><div class="stat-icon">📉</div><div class="stat-value">${data.clientes_baja_mes || 0}</div><div class="stat-label">Bajas en ${data.mes_actual} <span style="font-size:.7rem">▶ ver</span></div></div>
    <div class="stat-card purple"><div class="stat-icon">💰</div><div class="stat-value">${parseFloat(ventasTotal).toFixed(0)}€</div><div class="stat-label">Ventas este mes (${ventasNum})</div></div>
    <div class="stat-card warning"><div class="stat-icon">⏳</div><div class="stat-value">${data.lista_espera || 0}</div><div class="stat-label">En lista de espera</div></div>
    <div class="stat-card purple"><div class="stat-icon">🗓</div><div class="stat-value">${data.total_grupos || 0}</div><div class="stat-label">Grupos configurados</div></div>
  `;
  // Resumen ventas
  if (data.ventas_meses && data.ventas_meses.length) {
    const meses = ['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    $('ventas-resumen-tabla').innerHTML = `<table><thead><tr><th>Mes</th><th>Ventas</th><th>Total</th></tr></thead><tbody>
      ${data.ventas_meses.map(v => `<tr><td>${meses[v.mes]} ${v.año}</td><td>${v.num}</td><td><b>${parseFloat(v.total).toFixed(2)}€</b></td></tr>`).join('')}
    </tbody></table>`;
  } else {
    $('ventas-resumen-tabla').innerHTML = '<p style="color:var(--text-light)">Sin datos de ventas aún</p>';
  }

  // Guardar listas para modal
  window._altasMes = data.lista_altas_mes || [];
  window._bajasMes = data.lista_bajas_mes || [];
  window._mesActual = data.mes_actual;
  window._activos = data.lista_activos || [];
  window._frecuencia = data.clientes_por_frecuencia || [];
}

function verListaMes(tipo) {
  const lista = tipo === 'altas' ? window._altasMes : window._bajasMes;
  const titulo = tipo === 'altas' ? `Altas en ${window._mesActual}` : `Bajas en ${window._mesActual}`;
  const icon = tipo === 'altas' ? '📈' : '📉';
  abrirModal(`<button class="modal-close" onclick="cerrarModal()">✕</button>
    <h3>${icon} ${titulo}</h3>
    ${lista.length ? `<table style="margin-top:1rem"><thead><tr><th>Nombre</th><th>Días</th><th>Horario</th></tr></thead><tbody>
      ${lista.map(c => `<tr><td><b>${c.nombre_completo}</b></td><td>${c.dias || ''}</td><td>${c.horario || ''}</td></tr>`).join('')}
    </tbody></table>` : '<p style="color:var(--text-light);margin-top:1rem">Ninguna</p>'}`);
}

function verDesgloseActivos() {
  const frec = window._frecuencia || [];
  const activos = window._activos || [];

  // Resumen por frecuencia
  let resumen = '<div style="display:flex;gap:.75rem;flex-wrap:wrap;margin:1rem 0">';
  frec.forEach(f => {
    const dias = parseInt(f.dias_semana) || 0;
    const label = dias === 0 ? 'Sin definir' : dias === 1 ? '1 día/semana' : `${dias} días/semana`;
    const color = dias === 1 ? 'var(--info)' : dias === 2 ? 'var(--success)' : dias >= 3 ? 'var(--primary)' : 'var(--text-light)';
    resumen += `<div onclick="filtrarDesglose(${dias})" style="cursor:pointer;padding:.6rem 1rem;background:white;border:2px solid ${color};border-radius:10px;text-align:center;min-width:120px">
      <div style="font-size:1.6rem;font-weight:700;color:${color}">${f.total}</div>
      <div style="font-size:.8rem;color:var(--text-light)">${label}</div>
    </div>`;
  });
  resumen += '</div>';

  abrirModal(`<button class="modal-close" onclick="cerrarModal()">✕</button>
    <h3>👥 Clientes activos (${activos.length})</h3>
    ${resumen}
    <div id="desglose-activos-lista">
      <table><thead><tr><th>Nombre</th><th>Días/sem</th><th>Días</th><th>Horario</th></tr></thead><tbody>
        ${activos.map(c => `<tr><td><b>${c.nombre_completo}</b></td><td><span class="badge badge-purple">${c.dias_semana || '-'}</span></td><td style="font-size:.85rem">${c.dias || ''}</td><td>${c.horario || ''}</td></tr>`).join('')}
      </tbody></table>
    </div>`);
}

function filtrarDesglose(dias) {
  const activos = window._activos || [];
  const filtrados = dias === 0 ? activos.filter(c => !c.dias_semana) : activos.filter(c => parseInt(c.dias_semana) === dias);
  document.getElementById('desglose-activos-lista').innerHTML = `
    <p style="margin-bottom:.5rem;color:var(--text-light)"><b>${filtrados.length}</b> clientes con ${dias === 0 ? 'sin frecuencia definida' : dias + (dias === 1 ? ' día' : ' días') + '/semana'} <button class="btn btn-sm btn-outline" onclick="verDesgloseActivos()">Ver todos</button></p>
    <table><thead><tr><th>Nombre</th><th>Días/sem</th><th>Días</th><th>Horario</th></tr></thead><tbody>
      ${filtrados.map(c => `<tr><td><b>${c.nombre_completo}</b></td><td><span class="badge badge-purple">${c.dias_semana || '-'}</span></td><td style="font-size:.85rem">${c.dias || ''}</td><td>${c.horario || ''}</td></tr>`).join('')}
    </tbody></table>`;
}

// ==================== CLIENTES ====================
async function cargarClientes() {
  const estado = $('filtro-clientes').value;
  const clientes = await API(`/api/clientes?estado=${estado}`);
  if (!clientes.length) {
    $('tabla-clientes').innerHTML = '<p style="color:var(--text-light)">No hay clientes</p>';
    return;
  }
  // Agrupar por días
  let lastDias = null;
  let rows = '';
  clientes.forEach(c => {
    if (c.dias !== lastDias) {
      lastDias = c.dias;
      rows += `<tr><td colspan="11" style="background:var(--primary);color:white;font-weight:700;padding:.6rem 1rem;font-size:.9rem">${c.dias || 'Sin asignar'}</td></tr>`;
    }
    rows += `<tr>
      <td><b>${c.nombre_completo}</b></td>
      <td>${c.telefono || ''}</td>
      <td><span class="badge badge-purple">${c.dias || ''}</span></td>
      <td>${c.horario || ''}${c.horario2 ? ' / '+c.horario2 : ''}</td>
      <td>${c.dias_semana || ''}</td>
      <td>${c.mes_inicio || ''}</td>
      <td>${c.estado === 'activo' ? '<span class="badge badge-success">Activo</span>' : '<span class="badge badge-danger">Baja '+(c.mes_baja||'')+'</span>'}</td>
      <td>${c.metodo_pago === 'domiciliacion' ? '<span class="badge badge-purple">Domiciliación</span>' : c.metodo_pago === 'efectivo_tarjeta' ? '<span class="badge badge-warning">Efectivo/Tarjeta</span>' : '<span class="badge badge-gray">-</span>'}</td>
      <td>${c.metodo_pago === 'domiciliacion' ? (c.iban_entregado ? '<span class="badge badge-success">IBAN OK</span>' : `<button class="btn btn-sm btn-warning" onclick="marcarIban(${c.id})">Sin IBAN</button>`) : c.metodo_pago === 'efectivo_tarjeta' ? (c.fianza_pagada ? '<span class="badge badge-success">Fianza OK</span>' : `<button class="btn btn-sm btn-warning" onclick="marcarFianza(${c.id})">Sin fianza</button>`) : ''}</td>
      <td style="max-width:200px;font-size:.8rem">${c.notas || ''}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-sm btn-outline" onclick='editarCliente(${JSON.stringify(c).replace(/'/g,"&#39;")})'>Editar</button>
        ${esSuperAdmin() && c.estado === 'activo' ? `<button class="btn btn-sm btn-danger" onclick="darBaja(${c.id})">Baja</button>` : ''}
      </td>
    </tr>`;
  });
  $('tabla-clientes').innerHTML = `<table><thead><tr>
    <th>Nombre</th><th>Teléfono</th><th>Días</th><th>Horario</th><th>Días/sem</th><th>Inicio</th><th>Estado</th><th>Pago</th><th>IBAN/Fianza</th><th>Notas</th><th></th>
  </tr></thead><tbody>${rows}</tbody></table>`;
}

function abrirModalCliente(c) {
  abrirModal(`<button class="modal-close" onclick="cerrarModal()">✕</button>
    <h3>${c ? 'Editar' : 'Nuevo'} Cliente</h3>
    <form onsubmit="guardarCliente(event, ${c?.id || 'null'})">
      <div class="form-grid">
        <div class="form-group"><label>Nombre completo</label><input name="nombre_completo" value="${c?.nombre_completo || ''}" required></div>
        <div class="form-group"><label>Teléfono</label><input name="telefono" value="${c?.telefono || ''}"></div>
        <div class="form-group"><label>Días</label>
          <div style="display:flex;flex-wrap:wrap;gap:.4rem" id="dias-checkboxes">
            ${['Lunes','Martes','Miércoles','Jueves','Viernes'].map(d => {
              const diasStr = (c?.dias || '').toLowerCase();
              const checked = diasStr.includes(d.toLowerCase()) || diasStr.includes(d.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase());
              return `<label style="display:flex;align-items:center;gap:.2rem;font-size:.85rem;cursor:pointer;padding:.2rem .5rem;border:1px solid var(--border);border-radius:6px;${checked?'background:var(--primary);color:white':''}">
                <input type="checkbox" value="${d}" ${checked?'checked':''} onchange="this.parentElement.style.background=this.checked?'var(--primary)':'';this.parentElement.style.color=this.checked?'white':''" style="display:none"> ${d}
              </label>`;
            }).join('')}
            <label style="display:flex;align-items:center;gap:.2rem;font-size:.85rem;cursor:pointer;padding:.2rem .5rem;border:1px solid var(--border);border-radius:6px;${(c?.dias||'')==='Sin fijo'?'background:var(--primary);color:white':''}">
              <input type="checkbox" value="Sin fijo" ${(c?.dias||'')==='Sin fijo'?'checked':''} onchange="this.parentElement.style.background=this.checked?'var(--primary)':'';this.parentElement.style.color=this.checked?'white':''" style="display:none"> Sin fijo
            </label>
            <label style="display:flex;align-items:center;gap:.2rem;font-size:.85rem;cursor:pointer;padding:.2rem .5rem;border:1px solid var(--border);border-radius:6px;${(c?.dias||'')==='clase suelta'?'background:var(--primary);color:white':''}">
              <input type="checkbox" value="clase suelta" ${(c?.dias||'')==='clase suelta'?'checked':''} onchange="this.parentElement.style.background=this.checked?'var(--primary)':'';this.parentElement.style.color=this.checked?'white':''" style="display:none"> Clase suelta
            </label>
          </div>
        </div>
        <div class="form-group"><label>Horario</label><input name="horario" value="${c?.horario || ''}" placeholder="9:00"></div>
        <div class="form-group"><label>Horario 2 (opcional)</label><input name="horario2" value="${c?.horario2 || ''}" placeholder="10:00"></div>
        <div class="form-group"><label>Días/semana</label><input type="number" name="dias_semana" value="${c?.dias_semana || 2}" min="1" max="5"></div>
        <div class="form-group"><label>Mes inicio</label><input name="mes_inicio" value="${c?.mes_inicio || ''}" placeholder="Enero"></div>
        <div class="form-group"><label>Método de pago</label>
          <select name="metodo_pago"><option value="">Sin definir</option>
            <option value="domiciliacion" ${c?.metodo_pago==='domiciliacion'?'selected':''}>Domiciliación</option>
            <option value="efectivo_tarjeta" ${c?.metodo_pago==='efectivo_tarjeta'?'selected':''}>Efectivo/Tarjeta</option>
          </select>
        </div>
        ${c ? `<div class="form-group"><label>Mes baja</label><input name="mes_baja" value="${c?.mes_baja || ''}"></div>
        <div class="form-group"><label>Estado</label><select name="estado"><option value="activo" ${c.estado==='activo'?'selected':''}>Activo</option><option value="baja" ${c.estado==='baja'?'selected':''}>Baja</option></select></div>` : ''}
      </div>
      <div class="form-group" style="margin-top:1rem"><label>Notas</label><textarea name="notas" rows="2">${c?.notas || ''}</textarea></div>
      <div class="form-actions"><button class="btn btn-outline" type="button" onclick="cerrarModal()">Cancelar</button><button class="btn btn-primary" type="submit">Guardar</button></div>
    </form>`);
}

function editarCliente(c) { abrirModalCliente(c); }

async function guardarCliente(e, id) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const body = Object.fromEntries(fd);
  // Recoger días de los checkboxes
  const diasChecked = Array.from(document.querySelectorAll('#dias-checkboxes input:checked')).map(cb => cb.value);
  body.dias = diasChecked.length === 1 && (diasChecked[0] === 'Sin fijo' || diasChecked[0] === 'clase suelta')
    ? diasChecked[0]
    : diasChecked.filter(d => d !== 'Sin fijo' && d !== 'clase suelta').join(' y ');
  if (id) { await PUT(`/api/clientes/${id}`, body); LOG('editar','clientes',`Editó "${body.nombre_completo}"`); }
  else { await POST('/api/clientes', body); LOG('crear','clientes',`Nuevo cliente "${body.nombre_completo}"`); }
  cerrarModal();
  cargarClientes();
}

async function marcarFianza(id) {
  if (!confirm('¿Marcar fianza como pagada?')) return;
  await PUT(`/api/clientes/${id}`, { fianza_pagada: true });
  LOG('editar','clientes',`Fianza marcada como pagada`);
  cargarClientes();
}

async function marcarIban(id) {
  if (!confirm('¿Marcar IBAN como entregado?')) return;
  await PUT(`/api/clientes/${id}`, { iban_entregado: true });
  LOG('editar','clientes',`IBAN marcado como entregado`);
  cargarClientes();
}

async function darBaja(id) {
  const mes = prompt('Mes de baja (ej: Abril):');
  if (!mes) return;
  await PUT(`/api/clientes/${id}/baja`, { mes_baja: mes });
  LOG('baja','clientes',`Baja en ${mes}`);
  cargarClientes();
}

// ==================== PLAZAS ====================
let plazasData = [];

async function cargarPlazas() {
  plazasData = await API('/api/plazas');
  if (!plazasData.length) {
    $('plazas-grid').innerHTML = '<p style="color:var(--text-light);padding:2rem">No hay grupos configurados.</p>';
    return;
  }
  // Agrupar por día
  const dias = {};
  plazasData.forEach(p => {
    if (!dias[p.dia]) dias[p.dia] = [];
    dias[p.dia].push(p);
  });

  const ordenDias = ['Lunes','Martes','Miércoles','Jueves','Viernes'];

  function renderCard(p) {
    if (p.es_prueba) {
      return `<div onclick="abrirModalPlaza(${p.id})" class="plaza-card" style="cursor:pointer;flex-shrink:0;min-width:180px;border-color:var(--info);background:#f0f7ff">
        <h4>${p.hora}</h4>
        <span class="badge badge-info">CLASE DE PRUEBA</span>
      </div>`;
    }
    const pct = (p.ocupadas / p.max_plazas) * 100;
    const fillClass = pct >= 100 ? 'full' : pct >= 60 ? 'mid' : 'ok';
    return `<div onclick="abrirModalPlaza(${p.id})" class="plaza-card ${p.lleno ? 'lleno' : 'libre'}" style="cursor:pointer;flex-shrink:0;min-width:180px">
      <h4>${p.hora} <span class="plaza-count">${p.ocupadas}/${p.max_plazas}</span></h4>
      <div class="plaza-bar"><div class="plaza-bar-fill ${fillClass}" style="width:${Math.min(pct,100)}%"></div></div>
      ${p.lleno ? '<span class="badge badge-danger">LLENO</span>' : `<span class="badge badge-success">${p.libres} libre${p.libres!==1?'s':''}</span>`}
      <div style="margin-top:.4rem">${p.ocupantes.map(o => `<div class="ocupante">- ${o.nombre_completo}</div>`).join('')}</div>
    </div>`;
  }

  let html = '';
  ordenDias.forEach(dia => {
    const grupos = dias[dia];
    if (!grupos || !grupos.length) return;
    html += `<div style="display:flex;align-items:stretch;margin-bottom:.75rem">
      <div style="background:var(--primary);color:white;font-weight:700;padding:.6rem;border-radius:8px 0 0 8px;min-width:85px;text-align:center;font-size:.85rem;display:flex;align-items:center;justify-content:center">${dia}</div>
      <div style="flex:1;display:flex;gap:.6rem;overflow-x:auto;padding:.6rem;background:var(--card);border:1px solid var(--border);border-left:none;border-radius:0 8px 8px 0;align-items:flex-start">
        ${grupos.map(p => renderCard(p)).join('')}
      </div>
    </div>`;
  });
  $('plazas-grid').innerHTML = html;
}

function abrirModalPlaza(grupoId) {
  const p = plazasData.find(x => x.id === grupoId);
  if (!p) return;

  let slots = '';
  for (let i = 0; i < p.max_plazas; i++) {
    const ocupante = p.ocupantes[i];
    if (ocupante) {
      slots += `<div style="display:flex;align-items:center;gap:.5rem;padding:.5rem 0;border-bottom:1px solid var(--border)">
        <span style="width:24px;text-align:center;font-weight:700;color:var(--primary)">${i+1}</span>
        <span style="flex:1">${ocupante.nombre_completo}</span>
        ${esSuperAdmin() ? `<button class="btn btn-sm btn-danger" onclick="quitarOcupanteModal(${ocupante.id},${grupoId})" style="padding:.15rem .4rem;font-size:.7rem">X</button>` : ''}
      </div>`;
    } else {
      slots += `<div style="display:flex;align-items:center;gap:.5rem;padding:.5rem 0;border-bottom:1px solid var(--border)">
        <span style="width:24px;text-align:center;font-weight:700;color:var(--text-light)">${i+1}</span>
        <span style="flex:1;color:var(--text-light);font-style:italic">VACÍO</span>
      </div>`;
    }
  }

  abrirModal(`<button class="modal-close" onclick="cerrarModal()">✕</button>
    <h3>${p.dia} ${p.hora} ${p.es_prueba ? '(Clase de prueba)' : ''}</h3>
    <div style="margin:.5rem 0;font-size:.9rem;color:var(--text-light)">${p.ocupadas}/${p.max_plazas} plazas ocupadas</div>
    ${slots}
    <div style="margin-top:1rem;display:flex;gap:.5rem">
      <input id="nuevo-ocupante-${grupoId}" placeholder="Añadir persona..." style="flex:1;padding:.5rem .8rem;border:2px solid var(--border);border-radius:8px;font-size:.9rem">
      <button class="btn btn-primary" onclick="añadirOcupanteModal(${grupoId})">Añadir</button>
    </div>`);
}

async function añadirOcupanteModal(grupoId) {
  const input = document.getElementById(`nuevo-ocupante-${grupoId}`);
  const nombre = input.value.trim();
  if (!nombre) return;
  const p = plazasData.find(x => x.id === grupoId);
  await POST('/api/plazas/ocupante', { grupo_id: grupoId, nombre });
  LOG('añadir', 'plazas', `Añadió a "${nombre}" en ${p?.dia} ${p?.hora}`);
  await cargarPlazas();
  abrirModalPlaza(grupoId);
}

async function quitarOcupanteModal(ocupanteId, grupoId) {
  if (!confirm('¿Quitar esta persona del grupo?')) return;
  const p = plazasData.find(x => x.id === grupoId);
  const ocupante = p?.ocupantes?.find(o => o.id === ocupanteId);
  await DEL(`/api/plazas/ocupante/${ocupanteId}`);
  LOG('eliminar', 'plazas', `Quitó a "${ocupante?.nombre_completo || '?'}" de ${p?.dia} ${p?.hora}`);
  await cargarPlazas();
  abrirModalPlaza(grupoId);
}

function abrirModalGrupo() {
  abrirModal(`<button class="modal-close" onclick="cerrarModal()">✕</button>
    <h3>Nuevo Grupo</h3>
    <form onsubmit="guardarGrupo(event)">
      <div class="form-grid">
        <div class="form-group"><label>Día</label>
          <select name="dia" required><option>Lunes</option><option>Martes</option><option>Miércoles</option><option>Jueves</option><option>Viernes</option></select>
        </div>
        <div class="form-group"><label>Hora</label><input name="hora" placeholder="9:00" required></div>
        <div class="form-group"><label>Plazas máximas</label><input type="number" name="max_plazas" value="5" min="1" max="20"></div>
      </div>
      <div class="form-actions"><button class="btn btn-outline" type="button" onclick="cerrarModal()">Cancelar</button><button class="btn btn-primary" type="submit">Crear</button></div>
    </form>`);
}

async function guardarGrupo(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const body = Object.fromEntries(fd);
  body.nombre = `${body.dia} ${body.hora}`;
  await POST('/api/plazas/grupo', body);
  cerrarModal();
  cargarPlazas();
}

// ==================== VENTAS / CAJA ====================
async function cargarVentas() { await cargarSoloVentas(); await cargarSoloCaja(); }

async function cargarSoloVentas() {
  const ventas = await API('/api/ventas');
  if (!ventas.length) { $('tabla-ventas').innerHTML = '<p style="color:var(--text-light)">Sin ventas</p>'; return; }
  const meses = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  // Agrupar ventas por mes
  const grupos = {};
  ventas.forEach(v => {
    const d = v.fecha ? new Date(v.fecha) : null;
    const key = d ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` : '0000-00';
    const label = d ? `${meses[d.getMonth()+1]} ${d.getFullYear()}` : 'Sin fecha';
    if (!grupos[key]) grupos[key] = { label, total: 0, efectivo: 0, tarjeta: 0, count: 0, items: [] };
    grupos[key].items.push(v);
    const p = parseFloat(v.precio || 0);
    grupos[key].total += p;
    if (v.metodo_pago === 'Efectivo') grupos[key].efectivo += p;
    else grupos[key].tarjeta += p;
    grupos[key].count++;
  });

  // Pestañas de meses
  const keys = Object.keys(grupos).sort().reverse();
  let tabs = '<div style="display:flex;flex-wrap:wrap;gap:.5rem;margin-bottom:1rem">';
  keys.forEach((k, i) => {
    const g = grupos[k];
    tabs += `<button class="btn ${i===0?'btn-primary':'btn-outline'} ventas-tab" data-mes="${k}" onclick="mostrarMesVentas('${k}')" style="flex-direction:column;line-height:1.3;padding:.5rem 1rem">
      <span>${g.label}</span>
      <span style="font-size:.75rem;opacity:.8">${g.count} ventas · ${g.total.toFixed(0)}€</span>
      <span style="font-size:.65rem;opacity:.6">💵${g.efectivo.toFixed(0)}€ 💳${g.tarjeta.toFixed(0)}€</span>
    </button>`;
  });
  tabs += '</div>';

  // Contenido de cada mes (solo el primero visible)
  let content = '';
  keys.forEach((k, i) => {
    const g = grupos[k];
    content += `<div class="ventas-mes-content" id="ventas-mes-${k}" style="${i>0?'display:none':''}">
      <div class="panel"><div class="panel-header"><h3>${g.label}</h3><div style="text-align:right"><div style="font-weight:700;color:var(--primary)">${g.total.toFixed(2)}€ total</div><div style="font-size:.8rem;color:var(--text-light)">💵 Efectivo: ${g.efectivo.toFixed(2)}€ · 💳 Tarjeta: ${g.tarjeta.toFixed(2)}€</div></div></div><div class="panel-body"><table><thead><tr>
        <th>Fecha</th><th>Cliente</th><th>Artículo</th><th>Precio</th><th>Pago</th><th>Trabajadora</th><th>Notas</th><th></th>
      </tr></thead><tbody>
        ${g.items.map(v => { const d = v.fecha ? new Date(v.fecha) : null; return `<tr>
          <td>${d ? d.toLocaleDateString('es-ES') : ''}</td>
          <td>${v.cliente_nombre || ''}</td>
          <td><span class="badge ${v.articulo?.includes('Suscripción') ? 'badge-purple' : v.articulo?.includes('Bebida') ? 'badge-info' : 'badge-gray'}">${v.articulo || ''}</span></td>
          <td><b>${parseFloat(v.precio || 0).toFixed(2)}€</b></td>
          <td><span class="badge ${v.metodo_pago === 'Efectivo' ? 'badge-success' : 'badge-info'}">${v.metodo_pago || ''}</span></td>
          <td>${v.trabajadora_nombre || ''}</td>
          <td style="font-size:.8rem">${v.notas || ''}</td>
          ${esSuperAdmin() ? `<td><button class="btn btn-sm btn-danger" onclick="eliminarVenta(${v.id})">X</button></td>` : '<td></td>'}
        </tr>`; }).join('')}
      </tbody></table></div></div>
    </div>`;
  });

  $('tabla-ventas').innerHTML = tabs + content;
}

function mostrarMesVentas(key) {
  document.querySelectorAll('.ventas-mes-content').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.ventas-tab').forEach(b => { b.classList.remove('btn-primary'); b.classList.add('btn-outline'); });
  const panel = document.getElementById(`ventas-mes-${key}`);
  const tab = document.querySelector(`.ventas-tab[data-mes="${key}"]`);
  if (panel) panel.style.display = 'block';
  if (tab) { tab.classList.add('btn-primary'); tab.classList.remove('btn-outline'); }
}

async function cargarSoloCaja() {
  const cajas = await API('/api/caja');
  $('tabla-caja').innerHTML = cajas.length ? `<table><thead><tr>
    <th>Fecha</th><th>Trabajadora</th><th>Efectivo total</th><th>Monedas</th><th>Billetes</th><th>Notas</th>
  </tr></thead><tbody>
    ${cajas.map(c => `<tr>
      <td>${c.fecha ? new Date(c.fecha).toLocaleDateString('es-ES') : ''}</td>
      <td>${c.trabajadora_nombre || ''}</td>
      <td><b>${parseFloat(c.efectivo_total || 0).toFixed(2)}€</b></td>
      <td>${parseFloat(c.monedas || 0).toFixed(2)}€</td>
      <td>${c.billetes || ''}</td>
      <td style="font-size:.8rem">${c.notas || ''}</td>
    </tr>`).join('')}
  </tbody></table>` : '<p style="color:var(--text-light)">Sin arqueos</p>';
}

function abrirModalVenta() {
  abrirModal(`<button class="modal-close" onclick="cerrarModal()">✕</button>
    <h3>Nueva Venta</h3>
    <form onsubmit="guardarVenta(event)">
      <div class="form-grid">
        <div class="form-group"><label>Cliente</label><input name="cliente_nombre" required></div>
        <div class="form-group"><label>Fecha</label><input type="date" name="fecha" value="${new Date().toISOString().split('T')[0]}"></div>
        <div class="form-group"><label>Artículo</label>
          <select name="articulo"><option>Suscripción kaluna</option><option>Calcetines</option><option>Bebida</option><option>Clase suelta</option><option>Otro</option></select>
        </div>
        <div class="form-group"><label>Precio (€)</label><input type="number" name="precio" step="0.01" required></div>
        <div class="form-group"><label>Método de pago</label><select name="metodo_pago"><option>Efectivo</option><option>Tarjeta</option></select></div>
      </div>
      <div class="form-group" style="margin-top:1rem"><label>Notas</label><textarea name="notas" rows="2"></textarea></div>
      <div class="form-actions"><button class="btn btn-outline" type="button" onclick="cerrarModal()">Cancelar</button><button class="btn btn-primary" type="submit">Guardar</button></div>
    </form>`);
}

function abrirModalCaja() {
  abrirModal(`<button class="modal-close" onclick="cerrarModal()">✕</button>
    <h3>Arqueo de Caja</h3>
    <form onsubmit="guardarCaja(event)">
      <div class="form-group"><label>Fecha</label><input type="date" name="fecha" value="${new Date().toISOString().split('T')[0]}"></div>
      <div style="margin-top:1rem;padding:1rem;background:var(--bg);border-radius:10px">
        <label style="font-weight:700;color:var(--primary-dark);margin-bottom:.75rem;display:block">Billetes</label>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:.5rem">
          ${[50,20,10,5].map(b => `<div style="text-align:center">
            <div style="font-weight:700;font-size:1.1rem;color:var(--primary)">${b}€</div>
            <input type="number" id="caja-b${b}" min="0" value="0" oninput="calcularCaja()" style="width:60px;text-align:center;padding:.3rem;border:2px solid var(--border);border-radius:6px;font-size:1rem">
          </div>`).join('')}
        </div>
        <div style="margin-top:.5rem;font-size:.85rem;color:var(--text-light)">Total billetes: <b id="caja-total-billetes">0.00€</b></div>
      </div>
      <div style="margin-top:.75rem;padding:1rem;background:var(--bg);border-radius:10px">
        <label style="font-weight:700;color:var(--primary-dark);margin-bottom:.75rem;display:block">Monedas</label>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:.5rem">
          ${[2,1,0.5,0.2,0.1,0.05,0.02,0.01].map(m => `<div style="text-align:center">
            <div style="font-weight:600;font-size:.9rem">${m}€</div>
            <input type="number" id="caja-m${String(m).replace('.','_')}" min="0" value="0" oninput="calcularCaja()" style="width:60px;text-align:center;padding:.3rem;border:2px solid var(--border);border-radius:6px;font-size:.9rem">
          </div>`).join('')}
        </div>
        <div style="margin-top:.5rem;font-size:.85rem;color:var(--text-light)">Total monedas: <b id="caja-total-monedas">0.00€</b></div>
      </div>
      <div style="margin-top:.75rem;padding:.75rem;background:var(--primary);color:white;border-radius:10px;text-align:center">
        <div style="font-size:.85rem">TOTAL EFECTIVO EN CAJA</div>
        <div style="font-size:1.8rem;font-weight:700" id="caja-total-efectivo">0.00€</div>
      </div>
      <input type="hidden" name="efectivo_total" id="caja-input-total">
      <input type="hidden" name="monedas" id="caja-input-monedas">
      <input type="hidden" name="billetes" id="caja-input-billetes">
      <div class="form-group" style="margin-top:1rem"><label>Notas</label><textarea name="notas" rows="2"></textarea></div>
      <div class="form-actions"><button class="btn btn-outline" type="button" onclick="cerrarModal()">Cancelar</button><button class="btn btn-primary" type="submit">Guardar</button></div>
    </form>`);
}

function calcularCaja() {
  let totalBilletes = 0;
  let desglose = [];
  [50,20,10,5].forEach(b => {
    const n = parseInt(document.getElementById(`caja-b${b}`)?.value || 0);
    if (n > 0) { totalBilletes += n * b; desglose.push(`${n}x${b}`); }
  });

  let totalMonedas = 0;
  [2,1,0.5,0.2,0.1,0.05,0.02,0.01].forEach(m => {
    const id = `caja-m${String(m).replace('.','_')}`;
    const n = parseInt(document.getElementById(id)?.value || 0);
    if (n > 0) totalMonedas += n * m;
  });

  const total = totalBilletes + totalMonedas;
  document.getElementById('caja-total-billetes').textContent = totalBilletes.toFixed(2) + '€';
  document.getElementById('caja-total-monedas').textContent = totalMonedas.toFixed(2) + '€';
  document.getElementById('caja-total-efectivo').textContent = total.toFixed(2) + '€';
  document.getElementById('caja-input-total').value = total.toFixed(2);
  document.getElementById('caja-input-monedas').value = totalMonedas.toFixed(2);
  document.getElementById('caja-input-billetes').value = desglose.join('+') || '0';
}

async function guardarVenta(e) { e.preventDefault(); const d=Object.fromEntries(new FormData(e.target)); await POST('/api/ventas',d); LOG('crear','ventas',`${d.cliente_nombre} - ${d.articulo} ${d.precio}€`); cerrarModal(); cargarSoloVentas(); }
async function guardarCaja(e) { e.preventDefault(); const d=Object.fromEntries(new FormData(e.target)); await POST('/api/caja',d); LOG('crear','caja',`Arqueo: ${d.efectivo_total}€`); cerrarModal(); cargarSoloCaja(); }
async function eliminarVenta(id) { if (confirm('¿Eliminar venta?')) { await DEL(`/api/ventas/${id}`); LOG('eliminar','ventas',`Venta #${id} eliminada`); cargarSoloVentas(); } }

// ==================== LEADS ====================
const LEAD_ESTADOS = [
  { key: 'nuevo', label: 'Nuevos', color: 'info' },
  { key: 'agendada', label: 'Agendada', color: 'success' },
  { key: 'contactado_sin_respuesta', label: 'Sin respuesta', color: 'warning' },
  { key: 'contactado_a_espera', label: 'A la espera', color: 'purple' },
  { key: 'no_agenda', label: 'No agenda', color: 'danger' },
  { key: 'convertido', label: 'Convertido', color: 'success' }
];
let leadsData = [];
let filtroLeadsActual = 'pendientes';

function filtrarLeads(filtro) {
  filtroLeadsActual = filtro;
  document.querySelectorAll('.filtro-leads').forEach(b => { b.classList.remove('btn-primary'); b.classList.add('btn-outline'); b.classList.remove('active'); });
  document.querySelector(`.filtro-leads[data-filtro="${filtro}"]`).classList.add('btn-primary');
  document.querySelector(`.filtro-leads[data-filtro="${filtro}"]`).classList.remove('btn-outline');
  document.querySelector(`.filtro-leads[data-filtro="${filtro}"]`).classList.add('active');
  renderLeads();
}

async function cargarLeads() {
  leadsData = await API('/api/leads');
  renderLeads();
}

async function importarCSVMeta(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    const csv = e.target.result;
    try {
      const res = await fetch('/api/import-csv/meta-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv })
      });
      const data = await res.json();
      if (data.error) { alert('Error: ' + data.error); return; }
      LOG('crear','leads',`Importados ${data.nuevos} leads de Meta`);
      alert(`✅ ${data.nuevos} leads nuevos importados\n⏭ ${data.duplicados} duplicados ignorados${data.nuevosNombres?.length ? '\n\nNuevos:\n- ' + data.nuevosNombres.slice(0,10).join('\n- ') + (data.nuevosNombres.length > 10 ? `\n...y ${data.nuevosNombres.length - 10} más` : '') : ''}`);
      cargarLeads();
    } catch (err) { alert('Error al importar: ' + err.message); }
    event.target.value = '';
  };
  reader.readAsText(file);
}

function renderLeads() {
  const estadoColor = e => { const m = LEAD_ESTADOS.find(x => x.key === e); return m ? m.color : 'gray'; };
  const estadoLabel = e => { const m = LEAD_ESTADOS.find(x => x.key === e); return m ? m.label : e; };

  const agendados = ['agendada', 'convertido'];
  const noAgenda = ['no_agenda'];
  let filtrados;
  if (filtroLeadsActual === 'agendados') filtrados = leadsData.filter(l => agendados.includes(l.estado));
  else if (filtroLeadsActual === 'no_agenda') filtrados = leadsData.filter(l => noAgenda.includes(l.estado));
  else if (filtroLeadsActual === 'pendientes') filtrados = leadsData.filter(l => !agendados.includes(l.estado) && !noAgenda.includes(l.estado));
  else filtrados = leadsData;

  $('pipeline-leads').innerHTML = filtrados.length ? `<table><thead><tr>
    <th>Nombre</th><th>Teléfono</th><th>Estado</th><th>Trabajadora</th><th>Notas</th><th></th>
  </tr></thead><tbody>
    ${filtrados.map(l => {
      const numNotas = (() => { try { return JSON.parse(l.historial_notas || '[]').length; } catch { return 0; } })();
      return `<tr style="cursor:pointer" onclick="toggleFichaLead(${l.id})">
        <td><b>${l.nombre}</b></td>
        <td>${l.telefono || ''}</td>
        <td><span class="badge badge-${estadoColor(l.estado)}">${estadoLabel(l.estado)}</span></td>
        <td>${l.trabajadora_nombre || ''}</td>
        <td style="max-width:250px;font-size:.8rem;color:var(--text-light)">${l.notas || ''}</td>
        <td style="white-space:nowrap">
          ${numNotas ? `<span class="badge badge-gray">${numNotas} notas</span>` : ''}
          <span style="font-size:.7rem;color:var(--text-light);margin-left:.3rem">▼</span>
        </td>
      </tr>
      <tr id="ficha-lead-${l.id}" style="display:none">
        <td colspan="6" style="padding:0;background:var(--bg)">
          <div style="padding:1rem 1.25rem" id="ficha-content-${l.id}"></div>
        </td>
      </tr>`;
    }).join('')}
  </tbody></table>` : '<p style="color:var(--text-light)">No hay leads</p>';
}

function toggleFichaLead(id) {
  const fila = document.getElementById(`ficha-lead-${id}`);
  if (!fila) return;
  const visible = fila.style.display !== 'none';
  // Cerrar todas las fichas abiertas
  document.querySelectorAll('[id^="ficha-lead-"]').forEach(el => el.style.display = 'none');
  if (!visible) {
    fila.style.display = 'table-row';
    renderFichaLead(id);
  }
}

function renderFichaLead(id) {
  const l = leadsData.find(x => x.id === id);
  if (!l) return;
  let historial = [];
  try { historial = JSON.parse(l.historial_notas || '[]'); } catch {}

  const estadoColor = e => { const m = LEAD_ESTADOS.find(x => x.key === e); return m ? m.color : 'gray'; };

  document.getElementById(`ficha-content-${id}`).innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem">
      <div>
        <h4 style="margin-bottom:.75rem;color:var(--primary-dark)">Datos del contacto</h4>
        <div class="form-grid" style="grid-template-columns:1fr 1fr">
          <div class="form-group"><label>Nombre</label><input id="lead-${id}-nombre" value="${l.nombre}" style="padding:.4rem .6rem;border:2px solid var(--border);border-radius:6px;font-size:.85rem"></div>
          <div class="form-group"><label>Teléfono</label><input id="lead-${id}-telefono" value="${l.telefono || ''}" style="padding:.4rem .6rem;border:2px solid var(--border);border-radius:6px;font-size:.85rem"></div>
          <div class="form-group"><label>Estado</label><select id="lead-${id}-estado" style="padding:.4rem .6rem;border:2px solid var(--border);border-radius:6px;font-size:.85rem">${LEAD_ESTADOS.map(e => `<option value="${e.key}" ${l.estado===e.key?'selected':''}>${e.label}</option>`).join('')}</select></div>
          <div class="form-group"><label>Origen</label><select id="lead-${id}-origen" style="padding:.4rem .6rem;border:2px solid var(--border);border-radius:6px;font-size:.85rem"><option ${l.origen==='anuncio'?'selected':''}>anuncio</option><option ${l.origen==='clase'?'selected':''}>clase</option><option ${l.origen==='referido'?'selected':''}>referido</option></select></div>
          <div class="form-group"><label>Horario preferencia</label><input id="lead-${id}-horario" value="${l.horario_preferencia || ''}" style="padding:.4rem .6rem;border:2px solid var(--border);border-radius:6px;font-size:.85rem"></div>
        </div>
        <div style="margin-top:.75rem;display:flex;gap:.5rem">
          <button class="btn btn-primary btn-sm" onclick="guardarFichaLead(${id})">Guardar cambios</button>
          ${esSuperAdmin() ? `<button class="btn btn-danger btn-sm" onclick="eliminarLead(${id})">Eliminar</button>` : ''}
        </div>
      </div>
      <div>
        <h4 style="margin-bottom:.75rem;color:var(--primary-dark)">Historial de llamadas / notas</h4>
        <div style="display:flex;gap:.5rem;margin-bottom:.75rem">
          <textarea id="nueva-nota-${id}" rows="2" placeholder="Añadir nota de llamada..." style="flex:1;padding:.4rem .6rem;border:2px solid var(--border);border-radius:6px;font-size:.85rem;font-family:inherit;resize:vertical"></textarea>
          <button class="btn btn-primary btn-sm" onclick="añadirNotaLead(${id})" style="align-self:flex-end">Añadir</button>
        </div>
        <div style="max-height:250px;overflow-y:auto">
          ${historial.length ? historial.slice().reverse().map(n => {
            const f = new Date(n.fecha).toLocaleString('es-ES', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
            return `<div style="padding:.5rem;margin-bottom:.4rem;background:white;border-radius:6px;border-left:3px solid var(--primary);font-size:.85rem">
              <div><span style="font-weight:600;color:var(--primary)">${n.autor}</span> <span style="color:var(--text-light);font-size:.75rem">${f}</span></div>
              <div style="margin-top:.2rem">${n.texto}</div>
            </div>`;
          }).join('') : '<p style="color:var(--text-light);font-size:.85rem">Sin notas aún. Añade una nota de llamada arriba.</p>'}
        </div>
      </div>
    </div>`;
}

async function guardarFichaLead(id) {
  const body = {
    nombre: document.getElementById(`lead-${id}-nombre`).value,
    telefono: document.getElementById(`lead-${id}-telefono`).value,
    estado: document.getElementById(`lead-${id}-estado`).value,
    origen: document.getElementById(`lead-${id}-origen`).value,
    horario_preferencia: document.getElementById(`lead-${id}-horario`).value,
    notas: leadsData.find(l => l.id === id)?.notas || ''
  };
  await PUT(`/api/leads/${id}`, body);
  cargarLeads();
}

function abrirModalLead() {
  abrirModal(`<button class="modal-close" onclick="cerrarModal()">✕</button>
    <h3>Nuevo Lead</h3>
    <form onsubmit="guardarLeadNuevo(event)">
      <div class="form-grid">
        <div class="form-group"><label>Nombre</label><input name="nombre" required></div>
        <div class="form-group"><label>Teléfono</label><input name="telefono"></div>
        <div class="form-group"><label>Estado</label>
          <select name="estado">${LEAD_ESTADOS.map(e => `<option value="${e.key}">${e.label}</option>`).join('')}</select>
        </div>
        <div class="form-group"><label>Origen</label>
          <select name="origen"><option>anuncio</option><option>clase</option><option>referido</option></select>
        </div>
        <div class="form-group"><label>Horario preferencia</label><input name="horario_preferencia"></div>
      </div>
      <div class="form-group" style="margin-top:1rem"><label>Notas</label><textarea name="notas" rows="2"></textarea></div>
      <div class="form-actions"><button class="btn btn-outline" type="button" onclick="cerrarModal()">Cancelar</button><button class="btn btn-primary" type="submit">Crear</button></div>
    </form>`);
}

async function guardarLeadNuevo(e) { e.preventDefault(); const d=Object.fromEntries(new FormData(e.target)); await POST('/api/leads',d); LOG('crear','leads',`Nuevo lead "${d.nombre}"`); cerrarModal(); cargarLeads(); }

async function añadirNotaLead(id) {
  const textarea = document.getElementById(`nueva-nota-${id}`);
  const texto = textarea.value.trim();
  if (!texto) return;
  const result = await POST(`/api/leads/${id}/nota`, { texto });
  // Actualizar datos locales y re-renderizar la ficha
  const idx = leadsData.findIndex(l => l.id === id);
  if (idx >= 0) {
    leadsData[idx] = result;
    renderFichaLead(id);
  }
  cargarLeads().then(() => {
    // Reabrir ficha
    const fila = document.getElementById(`ficha-lead-${id}`);
    if (fila) { fila.style.display = 'table-row'; renderFichaLead(id); }
  });
}

async function eliminarLead(id) {
  if (confirm('¿Eliminar lead?')) { await DEL(`/api/leads/${id}`); cerrarModal(); cargarLeads(); }
}

// ==================== CONTROL LESIONES ====================
let lesionesData = [];

async function cargarLesiones() {
  lesionesData = await API('/api/lesiones');
  renderLesiones(lesionesData);
  const buscar = $('buscar-lesion');
  buscar.oninput = () => {
    const q = buscar.value.toLowerCase();
    renderLesiones(q ? lesionesData.filter(l => l.cliente_nombre.toLowerCase().includes(q)) : lesionesData);
  };
}

function renderLesiones(fichas) {
  $('lista-lesiones').innerHTML = fichas.length ? `<table><thead><tr>
    <th>Paciente</th><th>Fecha</th><th>Ejercicios no recomendados</th><th></th>
  </tr></thead><tbody>
    ${fichas.map(f => `<tr style="cursor:pointer" onclick="toggleFichaLesion(${f.id})">
      <td><b>${f.cliente_nombre}</b></td>
      <td>${f.fecha ? new Date(f.fecha).toLocaleDateString('es-ES') : ''}</td>
      <td style="max-width:300px;font-size:.8rem;color:var(--text-light);white-space:pre-wrap">${(f.ejercicios_no_recomendados || '').substring(0, 80)}${(f.ejercicios_no_recomendados||'').length > 80 ? '...' : ''}</td>
      <td><span style="font-size:.7rem;color:var(--text-light)">▼</span></td>
    </tr>
    <tr id="ficha-lesion-${f.id}" style="display:none">
      <td colspan="4" style="padding:0;background:var(--bg)">
        <div style="padding:1.25rem" id="ficha-lesion-content-${f.id}"></div>
      </td>
    </tr>`).join('')}
  </tbody></table>` : '<p style="color:var(--text-light)">No hay fichas de lesiones. Crea una con "+ Nueva ficha".</p>';
}

function toggleFichaLesion(id) {
  const fila = document.getElementById(`ficha-lesion-${id}`);
  if (!fila) return;
  const visible = fila.style.display !== 'none';
  document.querySelectorAll('[id^="ficha-lesion-"]').forEach(el => { if (el.id.includes('content')) return; el.style.display = 'none'; });
  if (!visible) { fila.style.display = 'table-row'; renderFichaLesion(id); }
}

function renderFichaLesion(id) {
  const f = lesionesData.find(x => x.id === id);
  if (!f) return;
  document.getElementById(`ficha-lesion-content-${id}`).innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1rem">
      <div>
        <h4 style="color:var(--danger);margin-bottom:.5rem">Ejercicios NO recomendados</h4>
        <textarea id="lesion-${id}-ejercicios" rows="8" style="width:100%;padding:.5rem;border:2px solid var(--border);border-radius:8px;font-size:.85rem;font-family:inherit;resize:vertical">${f.ejercicios_no_recomendados || ''}</textarea>
      </div>
      <div>
        <h4 style="color:var(--primary);margin-bottom:.5rem">Notas Pilates</h4>
        <div style="background:var(--bg);border-radius:8px;padding:.5rem;max-height:200px;overflow-y:auto;margin-bottom:.5rem;font-size:.82rem;white-space:pre-wrap">${f.notas_pilates || '<span style="color:var(--text-light)">Sin notas</span>'}</div>
        <textarea id="lesion-${id}-nueva-pilates" rows="2" placeholder="Añadir nota de pilates..." style="width:100%;padding:.4rem;border:2px solid var(--primary);border-radius:8px;font-size:.85rem;font-family:inherit;resize:vertical"></textarea>
        <button class="btn btn-sm btn-primary" style="margin-top:.3rem" onclick="añadirNotaLesion(${id},'pilates')">Añadir nota</button>
      </div>
      <div>
        <h4 style="color:var(--info);margin-bottom:.5rem">Notas Fisio</h4>
        <div style="background:var(--bg);border-radius:8px;padding:.5rem;max-height:200px;overflow-y:auto;margin-bottom:.5rem;font-size:.82rem;white-space:pre-wrap">${f.notas_fisio || '<span style="color:var(--text-light)">Sin notas</span>'}</div>
        <textarea id="lesion-${id}-nueva-fisio" rows="2" placeholder="Añadir nota de fisio..." style="width:100%;padding:.4rem;border:2px solid var(--info);border-radius:8px;font-size:.85rem;font-family:inherit;resize:vertical"></textarea>
        <button class="btn btn-sm" style="margin-top:.3rem;background:var(--info);color:white" onclick="añadirNotaLesion(${id},'fisio')">Añadir nota</button>
      </div>
    </div>
    <div style="margin-top:.75rem;display:flex;gap:.5rem">
      <button class="btn btn-primary btn-sm" onclick="guardarFichaLesion(${id})">Guardar ejercicios</button>
      ${esSuperAdmin() ? `<button class="btn btn-danger btn-sm" onclick="eliminarLesion(${id})">Eliminar ficha</button>` : ''}
    </div>`;
}

async function guardarFichaLesion(id) {
  const f = lesionesData.find(x => x.id === id);
  await PUT(`/api/lesiones/${id}`, {
    cliente_nombre: f.cliente_nombre,
    fecha: f.fecha,
    ejercicios_no_recomendados: document.getElementById(`lesion-${id}-ejercicios`).value,
    notas_pilates: f.notas_pilates,
    notas_fisio: f.notas_fisio
  });
  alert('Ejercicios guardados');
  cargarLesiones();
}

async function añadirNotaLesion(id, tipo) {
  const textarea = document.getElementById(`lesion-${id}-nueva-${tipo}`);
  if (!textarea) { console.error('Textarea no encontrado'); return; }
  const texto = textarea.value.trim();
  if (!texto) { alert('Escribe algo antes de añadir'); return; }
  const f = lesionesData.find(x => x.id === id);
  if (!f) return;
  const fecha = new Date().toLocaleString('es-ES', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
  const nuevaNota = `[${currentUser.nombre} - ${fecha}]\n${texto}`;
  const campo = tipo === 'pilates' ? 'notas_pilates' : 'notas_fisio';
  const notasActuales = f[campo] || '';
  const notasNuevas = notasActuales ? notasActuales + '\n\n' + nuevaNota : nuevaNota;

  // Actualizar en servidor
  const result = await PUT(`/api/lesiones/${id}`, {
    cliente_nombre: f.cliente_nombre,
    fecha: f.fecha,
    ejercicios_no_recomendados: f.ejercicios_no_recomendados,
    notas_pilates: tipo === 'pilates' ? notasNuevas : f.notas_pilates,
    notas_fisio: tipo === 'fisio' ? notasNuevas : f.notas_fisio
  });

  // Actualizar datos locales sin recargar toda la lista
  f.notas_pilates = tipo === 'pilates' ? notasNuevas : f.notas_pilates;
  f.notas_fisio = tipo === 'fisio' ? notasNuevas : f.notas_fisio;

  // Re-renderizar solo esta ficha
  renderFichaLesion(id);
}

function abrirModalLesion() {
  abrirModal(`<button class="modal-close" onclick="cerrarModal()">✕</button>
    <h3>Nueva Ficha de Lesión</h3>
    <form onsubmit="crearLesion(event)">
      <div class="form-grid">
        <div class="form-group"><label>Nombre del paciente</label><input name="cliente_nombre" required></div>
        <div class="form-group"><label>Fecha valoración</label><input type="date" name="fecha"></div>
      </div>
      <div class="form-group" style="margin-top:.75rem"><label>Ejercicios NO recomendados</label><textarea name="ejercicios_no_recomendados" rows="3"></textarea></div>
      <div class="form-group" style="margin-top:.5rem"><label>Notas Pilates</label><textarea name="notas_pilates" rows="3"></textarea></div>
      <div class="form-group" style="margin-top:.5rem"><label>Notas Fisio</label><textarea name="notas_fisio" rows="3"></textarea></div>
      <div class="form-actions"><button class="btn btn-outline" type="button" onclick="cerrarModal()">Cancelar</button><button class="btn btn-primary" type="submit">Crear ficha</button></div>
    </form>`);
}

async function crearLesion(e) {
  e.preventDefault();
  const d = Object.fromEntries(new FormData(e.target));
  const fecha = new Date().toLocaleString('es-ES', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
  if (d.notas_pilates) d.notas_pilates = `[${currentUser.nombre} - ${fecha}]\n${d.notas_pilates}`;
  if (d.notas_fisio) d.notas_fisio = `[${currentUser.nombre} - ${fecha}]\n${d.notas_fisio}`;
  await POST('/api/lesiones', d);
  cerrarModal(); cargarLesiones();
}
async function eliminarLesion(id) { if (confirm('¿Eliminar ficha?')) { await DEL(`/api/lesiones/${id}`); cargarLesiones(); } }

// ==================== CAMBIOS / BAJAS ====================
let filtroCambiosActual = 'pendientes';

async function cargarCambios() {
  const cambios = await API('/api/cambios');
  const filtrados = filtroCambiosActual === 'todos' ? cambios :
    filtroCambiosActual === 'gestionados' ? cambios.filter(c => c.estado === 'gestionado') : cambios.filter(c => c.estado === 'pendiente');

  const tipoIcon = { cambio: '🔄', baja: '📉', alta: '📈', otro: '📌' };
  $('tabla-cambios').innerHTML = filtrados.length ? `<table><thead><tr>
    <th>Tipo</th><th>Cliente</th><th>Cambio</th><th>Trabajadora</th><th>Fecha</th><th>Estado</th><th></th>
  </tr></thead><tbody>
    ${filtrados.map(c => {
      const fecha = new Date(c.created_at).toLocaleString('es-ES', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
      return `<tr>
        <td>${tipoIcon[c.tipo] || '📌'} <span class="badge badge-${c.tipo==='baja'?'danger':c.tipo==='alta'?'success':'info'}">${c.tipo}</span></td>
        <td><b>${c.cliente_nombre}</b></td>
        <td style="max-width:300px;font-size:.85rem;white-space:pre-wrap">${c.descripcion}</td>
        <td><b>${c.trabajadora_nombre || ''}</b></td>
        <td style="font-size:.8rem">${fecha}</td>
        <td>${c.estado === 'gestionado' ? '<span class="badge badge-success">Gestionado</span>' : '<span class="badge badge-warning">Pendiente</span>'}</td>
        <td style="white-space:nowrap">
          ${c.estado === 'pendiente' ? `<button class="btn btn-sm btn-success" onclick="gestionarCambio(${c.id})">Gestionar</button>` : ''}
          ${currentUser?.rol === 'admin' ? `<button class="btn btn-sm btn-danger" onclick="eliminarCambio(${c.id})">X</button>` : ''}
        </td>
      </tr>`;
    }).join('')}
  </tbody></table>` : '<p style="color:var(--text-light)">No hay cambios</p>';
}

function filtrarCambios(filtro) {
  filtroCambiosActual = filtro;
  document.querySelectorAll('.filtro-cambios').forEach(b => b.classList.remove('active'));
  document.querySelector(`.filtro-cambios[data-filtro="${filtro}"]`).classList.add('active');
  cargarCambios();
}

function abrirModalCambio() {
  abrirModal(`<button class="modal-close" onclick="cerrarModal()">✕</button>
    <h3>Nuevo Cambio / Baja</h3>
    <form onsubmit="guardarCambio(event)">
      <div class="form-grid">
        <div class="form-group"><label>Tipo</label>
          <select name="tipo"><option value="cambio">Cambio de plaza</option><option value="baja">Baja</option><option value="alta">Alta</option><option value="otro">Otro</option></select>
        </div>
        <div class="form-group"><label>Cliente</label><input name="cliente_nombre" required></div>
      </div>
      <div class="form-group" style="margin-top:.75rem"><label>Descripción del cambio</label><textarea name="descripcion" rows="3" required placeholder="Ej: cambia a martes y jueves a las 21, baja en mayo, etc."></textarea></div>
      <div class="form-actions"><button class="btn btn-outline" type="button" onclick="cerrarModal()">Cancelar</button><button class="btn btn-primary" type="submit">Crear</button></div>
    </form>`);
}

async function guardarCambio(e) { e.preventDefault(); const d=Object.fromEntries(new FormData(e.target)); await POST('/api/cambios',d); LOG('crear','cambios',`${d.tipo}: ${d.cliente_nombre} - ${d.descripcion}`); cerrarModal(); cargarCambios(); }

async function gestionarCambio(id) {
  const notas = prompt('Nota de gestión (opcional):');
  if (notas === null) return;
  await PUT(`/api/cambios/${id}/gestionar`, { notas: notas || 'OK' });
  cargarCambios();
}

async function eliminarCambio(id) { if (confirm('¿Eliminar?')) { await DEL(`/api/cambios/${id}`); cargarCambios(); } }

// ==================== LISTA DE ESPERA ====================
async function cargarEspera() {
  const espera = await API('/api/espera');
  $('tabla-espera').innerHTML = espera.length ? `<table><thead><tr>
    <th>Nombre</th><th>Teléfono</th><th>Fecha</th><th>Horario deseado</th><th>Estado</th><th>Registrado por</th><th>Notas</th><th></th>
  </tr></thead><tbody>
    ${espera.map(e => `<tr>
      <td><b>${e.nombre}</b></td><td>${e.telefono || ''}</td>
      <td>${e.fecha ? new Date(e.fecha).toLocaleDateString('es-ES') : ''}</td>
      <td>${e.horario_deseado || ''}</td>
      <td><span class="badge badge-${e.estado==='esperando'?'warning':e.estado==='contactado'?'info':'success'}">${e.estado}</span></td>
      <td style="font-size:.8rem">${e.trabajadora_nombre || ''} <span style="color:var(--text-light)">${e.created_at ? new Date(e.created_at).toLocaleDateString('es-ES') : ''}</span></td>
      <td style="font-size:.8rem">${e.notas || ''}</td>
      <td style="white-space:nowrap">
        <select onchange="cambiarEstadoEspera(${e.id}, this.value)" style="padding:.3rem;border-radius:6px;border:1px solid var(--border);font-size:.8rem">
          <option value="esperando" ${e.estado==='esperando'?'selected':''}>Esperando</option>
          <option value="contactado" ${e.estado==='contactado'?'selected':''}>Contactado</option>
          <option value="colocado" ${e.estado==='colocado'?'selected':''}>Colocado</option>
        </select>
        ${esSuperAdmin() ? `<button class="btn btn-sm btn-danger" onclick="eliminarEspera(${e.id})">X</button>` : ''}
      </td>
    </tr>`).join('')}
  </tbody></table>` : '<p style="color:var(--text-light)">Lista de espera vacía</p>';
}

function abrirModalEspera() {
  abrirModal(`<button class="modal-close" onclick="cerrarModal()">✕</button>
    <h3>Añadir a lista de espera</h3>
    <form onsubmit="guardarEspera(event)">
      <div class="form-grid">
        <div class="form-group"><label>Nombre</label><input name="nombre" required></div>
        <div class="form-group"><label>Teléfono</label><input name="telefono"></div>
        <div class="form-group"><label>Fecha</label><input type="date" name="fecha" value="${new Date().toISOString().split('T')[0]}"></div>
        <div class="form-group"><label>Horario deseado</label><input name="horario_deseado" placeholder="miércoles 18 a las 19h"></div>
        <div class="form-group"><label>Días</label><input name="dias"></div>
      </div>
      <div class="form-group" style="margin-top:1rem"><label>Notas</label><textarea name="notas" rows="2"></textarea></div>
      <div class="form-actions"><button class="btn btn-outline" type="button" onclick="cerrarModal()">Cancelar</button><button class="btn btn-primary" type="submit">Guardar</button></div>
    </form>`);
}

async function guardarEspera(e) { e.preventDefault(); const d=Object.fromEntries(new FormData(e.target)); await POST('/api/espera',d); LOG('crear','espera',`"${d.nombre}" - ${d.horario_deseado||''}`); cerrarModal(); cargarEspera(); }
async function cambiarEstadoEspera(id, estado) { await PUT(`/api/espera/${id}/estado`, { estado }); LOG('editar','espera',`Estado cambiado a "${estado}"`); }
async function eliminarEspera(id) { if (confirm('¿Eliminar?')) { await DEL(`/api/espera/${id}`); LOG('eliminar','espera',`Entrada #${id} eliminada`); cargarEspera(); } }

// ==================== CLASES DE PRUEBA ====================
async function cargarPruebas() {
  const pruebas = await API('/api/pruebas');
  $('tabla-pruebas').innerHTML = pruebas.length ? `<table><thead><tr>
    <th>Nombre</th><th>Teléfono</th><th>Fecha</th><th>Hora</th><th>Recordatorio</th><th>Notas</th><th></th>
  </tr></thead><tbody>
    ${pruebas.map(p => `<tr>
      <td><b>${p.nombre}</b></td><td>${p.telefono || ''}</td>
      <td>${p.fecha ? new Date(p.fecha).toLocaleDateString('es-ES') : ''}</td>
      <td>${p.hora || ''}</td>
      <td>${p.recordatorio_enviado ? '<span class="badge badge-success">Enviado</span>' : `<button class="btn btn-sm btn-warning" onclick="marcarRecordatorio(${p.id})">Marcar enviado</button>`}</td>
      <td style="font-size:.8rem">${p.notas || ''}</td>
      <td><button class="btn btn-sm btn-danger" onclick="eliminarPrueba(${p.id})">X</button></td>
    </tr>`).join('')}
  </tbody></table>` : '<p style="color:var(--text-light)">Sin clases de prueba</p>';
}

function abrirModalPrueba() {
  abrirModal(`<button class="modal-close" onclick="cerrarModal()">✕</button>
    <h3>Nueva Clase de Prueba</h3>
    <form onsubmit="guardarPrueba(event)">
      <div class="form-grid">
        <div class="form-group"><label>Nombre</label><input name="nombre" required></div>
        <div class="form-group"><label>Teléfono</label><input name="telefono"></div>
        <div class="form-group"><label>Fecha</label><input type="date" name="fecha" required></div>
        <div class="form-group"><label>Hora</label><input name="hora" placeholder="20:00"></div>
      </div>
      <div class="form-group" style="margin-top:1rem"><label>Notas</label><textarea name="notas" rows="2"></textarea></div>
      <div class="form-actions"><button class="btn btn-outline" type="button" onclick="cerrarModal()">Cancelar</button><button class="btn btn-primary" type="submit">Guardar</button></div>
    </form>`);
}

async function guardarPrueba(e) { e.preventDefault(); await POST('/api/pruebas', Object.fromEntries(new FormData(e.target))); cerrarModal(); cargarPruebas(); }
async function marcarRecordatorio(id) { await PUT(`/api/pruebas/${id}/recordatorio`, {}); cargarPruebas(); }
async function eliminarPrueba(id) { if (confirm('¿Eliminar?')) { await DEL(`/api/pruebas/${id}`); cargarPruebas(); } }

// ==================== DIARIO ====================
async function cargarDiario() {
  const hoy = new Date();
  $('diario-fecha').value = hoy.toISOString().split('T')[0];
  $('diario-fecha-label').textContent = hoy.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  if (currentUser?.rol === 'admin') {
    // Admin ve todo + puede filtrar por trabajadora
    const select = $('filtro-diario-trabajadora');
    if (select.options.length <= 1) {
      const trabajadoras = await API('/api/auth/trabajadoras');
      trabajadoras.filter(t => t.activo).forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id; opt.textContent = t.nombre;
        select.appendChild(opt);
      });
      select.addEventListener('change', cargarDiarioEntradas);
    }
    document.querySelectorAll('.trabajadora-only').forEach(el => el.style.display = 'none');
    await cargarDiarioEntradas();
  } else {
    // Trabajadora ve solo lo suyo
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
    const entradas = await API('/api/diario');
    renderDiarioEntradas(entradas, 'lista-diario-propio');
  }
}

async function cargarDiarioEntradas() {
  const filtro = $('filtro-diario-trabajadora')?.value;
  const url = filtro ? `/api/diario?usuario_id=${filtro}` : '/api/diario';
  const entradas = await API(url);
  renderDiarioEntradas(entradas, 'lista-diario');
}

function renderDiarioEntradas(entradas, containerId) {
  const container = $(containerId);
  if (!entradas.length) { container.innerHTML = '<p style="color:var(--text-light)">Sin entradas</p>'; return; }

  let lastFecha = null;
  container.innerHTML = entradas.map(e => {
    const fecha = new Date(e.fecha).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const hora = new Date(e.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    let header = '';
    if (fecha !== lastFecha) { lastFecha = fecha; header = `<div style="margin-top:1rem;padding:.5rem 0;border-bottom:2px solid var(--primary);font-weight:700;color:var(--primary-dark);font-size:.95rem">${fecha}</div>`; }
    return `${header}<div class="aviso-card" style="border-left-color:var(--primary)">
      <div class="aviso-header">
        <div><span style="font-weight:700;color:var(--primary)">${e.autor || 'Sistema'}</span><span class="aviso-meta" style="margin-left:.5rem">${hora}</span></div>
        ${esSuperAdmin() || e.usuario_id === currentUser?.id ? `<button class="btn btn-sm btn-danger" onclick="eliminarDiario(${e.id})">X</button>` : ''}
      </div>
      <div class="aviso-desc">${e.contenido}</div>
    </div>`;
  }).join('');
}

async function guardarDiario(e) {
  e.preventDefault();
  const body = Object.fromEntries(new FormData(e.target));
  await POST('/api/diario', body);
  e.target.querySelector('textarea').value = '';
  cargarDiario();
}

async function eliminarDiario(id) {
  if (confirm('¿Eliminar entrada?')) { await DEL(`/api/diario/${id}`); cargarDiario(); }
}

// ==================== AVISOS / INCIDENCIAS ====================
let filtroAvisosActual = 'pendientes';

async function cargarAvisos() {
  const avisos = await API('/api/avisos');
  const filtrados = filtroAvisosActual === 'todos' ? avisos :
    filtroAvisosActual === 'resueltos' ? avisos.filter(a => a.resuelto) : avisos.filter(a => !a.resuelto);

  $('lista-avisos').innerHTML = filtrados.length ? filtrados.map(a => {
    const fecha = new Date(a.created_at).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    return `<div class="aviso-card tipo-${a.tipo} ${a.resuelto ? 'resuelto' : ''}">
      <div class="aviso-header">
        <div>
          <span class="badge badge-${a.tipo==='error'?'danger':a.tipo==='urgente'?'purple':a.tipo==='aviso'?'warning':'info'}">${a.tipo.toUpperCase()}</span>
          <span class="aviso-titulo" style="margin-left:.5rem">${a.titulo}</span>
        </div>
        <span class="aviso-meta">${fecha}</span>
      </div>
      <div class="aviso-meta">Por: ${a.autor || 'Sistema'}</div>
      ${a.descripcion ? `<div class="aviso-desc">${a.descripcion}</div>` : ''}
      ${a.resuelto ? `<div class="aviso-resuelto-info">Resuelto por ${a.resuelto_por_nombre || '?'} el ${new Date(a.resuelto_fecha).toLocaleString('es-ES', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}</div>` : ''}
      <div class="aviso-actions">
        ${!a.resuelto ? `<button class="btn btn-sm btn-success" onclick="resolverAviso(${a.id})">Marcar resuelto</button>` : ''}
        ${currentUser?.rol === 'admin' ? `<button class="btn btn-sm btn-danger" onclick="eliminarAviso(${a.id})">Eliminar</button>` : ''}
      </div>
    </div>`;
  }).join('') : '<p style="color:var(--text-light);padding:1rem">No hay avisos</p>';
}

function filtrarAvisos(filtro) {
  filtroAvisosActual = filtro;
  document.querySelectorAll('.filtro-avisos').forEach(b => b.classList.remove('active'));
  document.querySelector(`.filtro-avisos[data-filtro="${filtro}"]`).classList.add('active');
  cargarAvisos();
}

function abrirModalAviso() {
  abrirModal(`<button class="modal-close" onclick="cerrarModal()">✕</button>
    <h3>Nuevo Aviso / Incidencia</h3>
    <form onsubmit="guardarAviso(event)">
      <div class="form-grid">
        <div class="form-group"><label>Tipo</label>
          <select name="tipo"><option value="error">Error</option><option value="aviso">Aviso</option><option value="mejora">Mejora</option><option value="urgente">Urgente</option></select>
        </div>
        <div class="form-group"><label>Título</label><input name="titulo" required placeholder="Resumen breve del aviso"></div>
      </div>
      <div class="form-group" style="margin-top:1rem"><label>Descripción detallada</label><textarea name="descripcion" rows="4" placeholder="Describe qué ha pasado, quién estaba, qué se ha hecho..."></textarea></div>
      <div class="form-actions"><button class="btn btn-outline" type="button" onclick="cerrarModal()">Cancelar</button><button class="btn btn-primary" type="submit">Crear aviso</button></div>
    </form>`);
}

async function guardarAviso(e) { e.preventDefault(); await POST('/api/avisos', Object.fromEntries(new FormData(e.target))); cerrarModal(); cargarAvisos(); }
async function resolverAviso(id) { await PUT(`/api/avisos/${id}/resolver`, {}); cargarAvisos(); }
async function eliminarAviso(id) { if (confirm('¿Eliminar aviso?')) { await DEL(`/api/avisos/${id}`); cargarAvisos(); } }

// ==================== CONFIGURACIÓN ====================
async function cargarConfig() {
  const trabajadoras = await API('/api/auth/trabajadoras');
  $('tabla-trabajadoras').innerHTML = `<table><thead><tr><th>Nombre</th><th>PIN</th><th>Rol</th><th>Estado</th></tr></thead><tbody>
    ${trabajadoras.map(t => `<tr>
      <td>${t.nombre}</td><td>${t.pin || '(email/password)'}</td>
      <td><span class="badge badge-${t.rol==='admin'?'purple':'info'}">${t.rol}</span></td>
      <td>${t.activo ? '<span class="badge badge-success">Activo</span>' : '<span class="badge badge-danger">Inactivo</span>'}</td>
    </tr>`).join('')}
  </tbody></table>`;

  // Cargar registro de actividad
  try {
    const actividad = await API('/api/actividad');
    const iconos = { crear: '🟢', editar: '🔵', eliminar: '🔴', baja: '📉', añadir: '➕' };
    $('tabla-actividad').innerHTML = actividad.length ? `<table><thead><tr><th>Fecha</th><th>Quién</th><th>Acción</th><th>Sección</th><th>Detalle</th></tr></thead><tbody>
      ${actividad.map(a => {
        const f = new Date(a.created_at).toLocaleString('es-ES',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
        return `<tr>
          <td style="white-space:nowrap;font-size:.8rem">${f}</td>
          <td><b>${a.usuario_nombre||''}</b></td>
          <td>${iconos[a.accion]||'📌'} ${a.accion}</td>
          <td><span class="badge badge-gray">${a.seccion||''}</span></td>
          <td style="font-size:.8rem;max-width:300px">${a.detalle||''}</td>
        </tr>`;
      }).join('')}
    </tbody></table>` : '<p style="color:var(--text-light)">Sin actividad registrada</p>';
  } catch {}
}

function abrirModalTrabajadora() {
  abrirModal(`<button class="modal-close" onclick="cerrarModal()">✕</button>
    <h3>Nueva Trabajadora</h3>
    <form onsubmit="guardarTrabajadora(event)">
      <div class="form-grid">
        <div class="form-group"><label>Nombre</label><input name="nombre" required></div>
        <div class="form-group"><label>PIN</label><input name="pin" required placeholder="1234"></div>
      </div>
      <div class="form-actions"><button class="btn btn-outline" type="button" onclick="cerrarModal()">Cancelar</button><button class="btn btn-primary" type="submit">Crear</button></div>
    </form>`);
}

async function guardarTrabajadora(e) { e.preventDefault(); await POST('/api/auth/trabajadoras', Object.fromEntries(new FormData(e.target))); cerrarModal(); cargarConfig(); }

// ==================== FICHAJES ADMIN ====================
let fichajesEmpleadosCargados = false;

async function cargarFichajesAdmin() {
  // Cargar empleados en el select (solo la primera vez)
  if (!fichajesEmpleadosCargados) {
    const empleados = await API('/api/fichaje/admin/empleados');
    const select = $('fichaje-filtro-empleado');
    empleados.forEach(e => {
      const opt = document.createElement('option');
      opt.value = e.id;
      opt.textContent = `${e.nombre} ${e.apellidos}`;
      select.appendChild(opt);
    });

    // Llenar meses (últimos 6)
    const selectMes = $('fichaje-filtro-mes');
    const meses = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const ahora = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
      const opt = document.createElement('option');
      opt.value = `${d.getMonth()+1}-${d.getFullYear()}`;
      opt.textContent = `${meses[d.getMonth()+1]} ${d.getFullYear()}`;
      if (i === 0) opt.selected = true;
      selectMes.appendChild(opt);
    }
    fichajesEmpleadosCargados = true;
  }

  await cargarFichajes();
}

async function cargarFichajes() {
  const empleadoId = $('fichaje-filtro-empleado').value;
  const mesAño = $('fichaje-filtro-mes').value.split('-');
  const mes = mesAño[0]; const año = mesAño[1];

  let url = `/api/fichaje/admin/registros?mes=${mes}&año=${año}`;
  if (empleadoId) url += `&usuario_id=${empleadoId}`;

  const registros = await API(url);

  if (!registros.length) {
    $('tabla-fichajes').innerHTML = '<p style="color:var(--text-light)">Sin fichajes en este periodo</p>';
    return;
  }

  // Agrupar por día
  let lastFecha = null;
  let html = `<div style="margin-bottom:1rem"><button class="btn btn-primary" onclick="descargarPDFFichajes()">📄 Descargar PDF del mes</button></div>`;
  html += '<table><thead><tr><th>Empleado</th><th>Tipo</th><th>Hora</th><th>Firma</th></tr></thead><tbody>';
  registros.forEach(f => {
    const fecha = new Date(f.fecha).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    if (fecha !== lastFecha) {
      lastFecha = fecha;
      html += `<tr><td colspan="4" style="background:var(--primary);color:white;font-weight:700;padding:.5rem 1rem;text-transform:capitalize">${fecha}</td></tr>`;
    }
    const firmaHtml = f.firma && f.firma.startsWith('data:image')
      ? `<img src="${f.firma}" style="height:40px;border:1px solid var(--border);border-radius:4px;cursor:pointer" onclick="abrirModal('<img src=\\'${f.firma}\\' style=\\'max-width:100%;max-height:400px\\'><br><button class=\\'btn btn-outline\\' onclick=\\'cerrarModal()\\'>Cerrar</button>')">`
      : (f.firma ? '<span style="color:var(--success);font-size:.8rem">✓ Firmado</span>' : '<span style="color:var(--text-light);font-size:.8rem">Sin firma</span>');
    html += `<tr>
      <td><b>${f.empleado_nombre || ''}</b></td>
      <td>${f.tipo === 'entrada' ? '<span class="badge badge-success">Entrada</span>' : '<span class="badge badge-danger">Salida</span>'}</td>
      <td>${f.hora ? f.hora.substring(0, 5) : ''}</td>
      <td>${firmaHtml}</td>
    </tr>`;
  });
  html += '</tbody></table>';
  $('tabla-fichajes').innerHTML = html;
}

// INIT
init();
