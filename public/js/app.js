let currentUser = null;
const $ = id => document.getElementById(id);
const API = path => fetch(path).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
const POST = (path, body) => fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());
const PUT = (path, body) => fetch(path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());
const DEL = path => fetch(path, { method: 'DELETE' }).then(r => r.json());

// INIT
async function init() {
  try {
    currentUser = await API('/api/auth/me');
    $('user-info').textContent = `${currentUser.nombre} (${currentUser.rol})`;
    if (currentUser.rol !== 'admin') {
      document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
    }
    setupNav();
    $('fecha-hoy').textContent = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    cargarInicio();
  } catch {
    window.location.href = '/';
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
      const loaders = { inicio: cargarInicio, clientes: cargarClientes, plazas: cargarPlazas, ventas: cargarSoloVentas, caja: cargarSoloCaja, leads: cargarLeads, espera: cargarEspera, diario: cargarDiario, avisos: cargarAvisos, config: cargarConfig };
      if (loaders[sec]) loaders[sec]();
    });
  });
  $('btn-logout').addEventListener('click', async () => { await POST('/api/auth/logout', {}); window.location.href = '/'; });
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
    <div class="stat-card success"><div class="stat-icon">👥</div><div class="stat-value">${data.clientes_activos || 0}</div><div class="stat-label">Clientes activos</div></div>
    <div class="stat-card danger"><div class="stat-icon">📉</div><div class="stat-value">${data.clientes_baja || 0}</div><div class="stat-label">Bajas totales</div></div>
    <div class="stat-card purple"><div class="stat-icon">💰</div><div class="stat-value">${parseFloat(ventasTotal).toFixed(0)}€</div><div class="stat-label">Ventas este mes (${ventasNum})</div></div>
    <div class="stat-card warning"><div class="stat-icon">⏳</div><div class="stat-value">${data.lista_espera || 0}</div><div class="stat-label">En lista de espera</div></div>
    <div class="stat-card info"><div class="stat-icon">🎯</div><div class="stat-value">${data.proximas_pruebas || 0}</div><div class="stat-label">Clases prueba pendientes</div></div>
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
      rows += `<tr><td colspan="9" style="background:var(--primary);color:white;font-weight:700;padding:.6rem 1rem;font-size:.9rem">${c.dias || 'Sin asignar'}</td></tr>`;
    }
    rows += `<tr>
      <td><b>${c.nombre_completo}</b></td>
      <td>${c.telefono || ''}</td>
      <td><span class="badge badge-purple">${c.dias || ''}</span></td>
      <td>${c.horario || ''}${c.horario2 ? ' / '+c.horario2 : ''}</td>
      <td>${c.dias_semana || ''}</td>
      <td>${c.mes_inicio || ''}</td>
      <td>${c.estado === 'activo' ? '<span class="badge badge-success">Activo</span>' : '<span class="badge badge-danger">Baja '+(c.mes_baja||'')+'</span>'}</td>
      <td style="max-width:200px;font-size:.8rem">${c.notas || ''}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-sm btn-outline" onclick='editarCliente(${JSON.stringify(c).replace(/'/g,"&#39;")})'>Editar</button>
        ${c.estado === 'activo' ? `<button class="btn btn-sm btn-danger" onclick="darBaja(${c.id})">Baja</button>` : ''}
      </td>
    </tr>`;
  });
  $('tabla-clientes').innerHTML = `<table><thead><tr>
    <th>Nombre</th><th>Teléfono</th><th>Días</th><th>Horario</th><th>Días/sem</th><th>Inicio</th><th>Estado</th><th>Notas</th><th></th>
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
          <select name="dias"><option value="">Seleccionar</option>
            <option ${c?.dias==='Lunes y Miercoles'?'selected':''}>Lunes y Miercoles</option>
            <option ${c?.dias==='Martes y Jueves'?'selected':''}>Martes y Jueves</option>
            <option ${c?.dias==='Lunes'?'selected':''}>Lunes</option><option ${c?.dias==='Martes'?'selected':''}>Martes</option>
            <option ${c?.dias==='Miércoles'||c?.dias==='Miercoles'?'selected':''}>Miércoles</option><option ${c?.dias==='Jueves'?'selected':''}>Jueves</option>
            <option ${c?.dias==='Sin fijo'?'selected':''}>Sin fijo</option>
            <option ${c?.dias==='clase suelta'?'selected':''}>clase suelta</option>
          </select>
        </div>
        <div class="form-group"><label>Horario</label><input name="horario" value="${c?.horario || ''}" placeholder="9:00"></div>
        <div class="form-group"><label>Horario 2 (opcional)</label><input name="horario2" value="${c?.horario2 || ''}" placeholder="10:00"></div>
        <div class="form-group"><label>Días/semana</label><input type="number" name="dias_semana" value="${c?.dias_semana || 2}" min="1" max="5"></div>
        <div class="form-group"><label>Mes inicio</label><input name="mes_inicio" value="${c?.mes_inicio || ''}" placeholder="Enero"></div>
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
  if (id) await PUT(`/api/clientes/${id}`, body);
  else await POST('/api/clientes', body);
  cerrarModal();
  cargarClientes();
}

async function darBaja(id) {
  const mes = prompt('Mes de baja (ej: Abril):');
  if (!mes) return;
  await PUT(`/api/clientes/${id}/baja`, { mes_baja: mes });
  cargarClientes();
}

// ==================== PLAZAS ====================
async function cargarPlazas() {
  const plazas = await API('/api/plazas');
  if (!plazas.length) {
    $('plazas-grid').innerHTML = '<p style="color:var(--text-light);padding:2rem">No hay grupos configurados. Crea uno con "+ Nuevo grupo".</p>';
    return;
  }
  $('plazas-grid').innerHTML = plazas.map(p => {
    const pct = (p.ocupadas / p.max_plazas) * 100;
    const fillClass = pct >= 100 ? 'full' : pct >= 60 ? 'mid' : 'ok';
    return `<div class="plaza-card ${p.lleno ? 'lleno' : 'libre'}">
      <h4>${p.nombre} <span class="plaza-count">${p.ocupadas}/${p.max_plazas}</span></h4>
      <div class="plaza-bar"><div class="plaza-bar-fill ${fillClass}" style="width:${Math.min(pct,100)}%"></div></div>
      ${p.lleno ? '<span class="badge badge-danger">LLENO</span>' : `<span class="badge badge-success">${p.libres} libre${p.libres!==1?'s':''}</span>`}
      <div style="margin-top:.5rem">${p.ocupantes.map(o => `<div class="ocupante">- ${o.nombre_completo}</div>`).join('')}</div>
    </div>`;
  }).join('');
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
    if (!grupos[key]) grupos[key] = { label, total: 0, count: 0, items: [] };
    grupos[key].items.push(v);
    grupos[key].total += parseFloat(v.precio || 0);
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
    </button>`;
  });
  tabs += '</div>';

  // Contenido de cada mes (solo el primero visible)
  let content = '';
  keys.forEach((k, i) => {
    const g = grupos[k];
    content += `<div class="ventas-mes-content" id="ventas-mes-${k}" style="${i>0?'display:none':''}">
      <div class="panel"><div class="panel-header"><h3>${g.label}</h3><span style="font-weight:700;color:var(--primary)">${g.count} ventas · ${g.total.toFixed(2)}€</span></div><div class="panel-body"><table><thead><tr>
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
          <td><button class="btn btn-sm btn-danger" onclick="eliminarVenta(${v.id})">X</button></td>
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
      <div class="form-grid">
        <div class="form-group"><label>Fecha</label><input type="date" name="fecha" value="${new Date().toISOString().split('T')[0]}"></div>
        <div class="form-group"><label>Efectivo total (€)</label><input type="number" name="efectivo_total" step="0.01" required></div>
        <div class="form-group"><label>Monedas (€)</label><input type="number" name="monedas" step="0.01"></div>
        <div class="form-group"><label>Billetes (desglose)</label><input name="billetes" placeholder="2x50+10+5x2"></div>
      </div>
      <div class="form-group" style="margin-top:1rem"><label>Notas</label><textarea name="notas" rows="2"></textarea></div>
      <div class="form-actions"><button class="btn btn-outline" type="button" onclick="cerrarModal()">Cancelar</button><button class="btn btn-primary" type="submit">Guardar</button></div>
    </form>`);
}

async function guardarVenta(e) { e.preventDefault(); await POST('/api/ventas', Object.fromEntries(new FormData(e.target))); cerrarModal(); cargarSoloVentas(); }
async function guardarCaja(e) { e.preventDefault(); await POST('/api/caja', Object.fromEntries(new FormData(e.target))); cerrarModal(); cargarSoloCaja(); }
async function eliminarVenta(id) { if (confirm('¿Eliminar venta?')) { await DEL(`/api/ventas/${id}`); cargarSoloVentas(); } }

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

async function cargarLeads() {
  leadsData = await API('/api/leads');
  const estadoColor = e => { const m = LEAD_ESTADOS.find(x => x.key === e); return m ? m.color : 'gray'; };
  const estadoLabel = e => { const m = LEAD_ESTADOS.find(x => x.key === e); return m ? m.label : e; };

  $('pipeline-leads').innerHTML = leadsData.length ? `<table><thead><tr>
    <th>Nombre</th><th>Teléfono</th><th>Estado</th><th>Trabajadora</th><th>Notas</th><th></th>
  </tr></thead><tbody>
    ${leadsData.map(l => {
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
          <button class="btn btn-danger btn-sm" onclick="eliminarLead(${id})">Eliminar</button>
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

async function guardarLeadNuevo(e) { e.preventDefault(); await POST('/api/leads', Object.fromEntries(new FormData(e.target))); cerrarModal(); cargarLeads(); }

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

// ==================== LISTA DE ESPERA ====================
async function cargarEspera() {
  const espera = await API('/api/espera');
  $('tabla-espera').innerHTML = espera.length ? `<table><thead><tr>
    <th>Nombre</th><th>Teléfono</th><th>Fecha</th><th>Horario deseado</th><th>Días</th><th>Estado</th><th>Notas</th><th></th>
  </tr></thead><tbody>
    ${espera.map(e => `<tr>
      <td><b>${e.nombre}</b></td><td>${e.telefono || ''}</td>
      <td>${e.fecha ? new Date(e.fecha).toLocaleDateString('es-ES') : ''}</td>
      <td>${e.horario_deseado || ''}</td><td>${e.dias || ''}</td>
      <td><span class="badge badge-${e.estado==='esperando'?'warning':e.estado==='contactado'?'info':'success'}">${e.estado}</span></td>
      <td style="font-size:.8rem">${e.notas || ''}</td>
      <td style="white-space:nowrap">
        <select onchange="cambiarEstadoEspera(${e.id}, this.value)" style="padding:.3rem;border-radius:6px;border:1px solid var(--border);font-size:.8rem">
          <option value="esperando" ${e.estado==='esperando'?'selected':''}>Esperando</option>
          <option value="contactado" ${e.estado==='contactado'?'selected':''}>Contactado</option>
          <option value="colocado" ${e.estado==='colocado'?'selected':''}>Colocado</option>
        </select>
        <button class="btn btn-sm btn-danger" onclick="eliminarEspera(${e.id})">X</button>
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

async function guardarEspera(e) { e.preventDefault(); await POST('/api/espera', Object.fromEntries(new FormData(e.target))); cerrarModal(); cargarEspera(); }
async function cambiarEstadoEspera(id, estado) { await PUT(`/api/espera/${id}/estado`, { estado }); }
async function eliminarEspera(id) { if (confirm('¿Eliminar?')) { await DEL(`/api/espera/${id}`); cargarEspera(); } }

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
  $('diario-fecha').value = new Date().toISOString().split('T')[0];

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
        <button class="btn btn-sm btn-danger" onclick="eliminarDiario(${e.id})">X</button>
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

// INIT
init();
