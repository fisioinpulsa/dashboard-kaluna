const router = require('express').Router();
const { query } = require('../db');
const { verificarToken } = require('../middleware/auth');

router.use(verificarToken);

// ============================================================
// AUTO-ASIGNACIÓN A PLAZAS
// ============================================================
// Convierte cliente.dias ("Lunes y Miércoles") a array de días singulares
function parsearDias(dias) {
  if (!dias) return [];
  const d = dias.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // sin acentos
  const semana = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];
  const encontrados = [];
  for (const dia of semana) {
    if (d.includes(dia)) encontrados.push(dia.charAt(0).toUpperCase() + dia.slice(1));
  }
  // Mantener Miércoles con acento porque así están los grupos
  return encontrados.map(d => d === 'Miercoles' ? 'Miércoles' : d);
}

// Extrae la hora "10:00" -> "10"
function extraerHora(horario) {
  if (!horario) return null;
  const m = String(horario).match(/^(\d{1,2})/);
  return m ? m[1] : null;
}

// Sincroniza las plazas de un cliente: borra las suyas y vuelve a crearlas según sus días/horarios
async function sincronizarPlazasCliente(cliente) {
  if (!cliente || !cliente.nombre_completo) return { borradas: 0, creadas: 0 };
  const nombre = cliente.nombre_completo.trim();

  // 1) Borrar plazas previas de este cliente (matching por nombre)
  const del = await query(
    "DELETE FROM kaluna_plaza_ocupantes WHERE TRIM(nombre) ILIKE $1 RETURNING id",
    [nombre]
  );
  const borradas = del.rowCount;

  // 2) Si está de baja o sin datos suficientes, no creamos nada
  if (cliente.estado === 'baja') return { borradas, creadas: 0 };
  const dias = parsearDias(cliente.dias);
  if (!dias.length) return { borradas, creadas: 0 };

  const horarios = [extraerHora(cliente.horario), extraerHora(cliente.horario2)].filter(Boolean);
  if (!horarios.length) return { borradas, creadas: 0 };

  // 3) Para cada combinación día + hora, buscar grupo y crear ocupante
  let creadas = 0;
  for (const dia of dias) {
    for (const h of horarios) {
      // Buscar grupo cuyo nombre coincida exactamente o por dia+hora
      const grupos = await query(
        `SELECT id FROM kaluna_grupos
         WHERE dia = $1 AND (hora = $2 OR hora = $3) LIMIT 1`,
        [dia, `${h}:00`, h]
      );
      if (grupos.rows.length) {
        // Verificar que no haya excedido capacidad antes de añadir
        const ocupados = await query(
          'SELECT COUNT(*) as n FROM kaluna_plaza_ocupantes WHERE grupo_id = $1',
          [grupos.rows[0].id]
        );
        const cap = await query('SELECT max_plazas FROM kaluna_grupos WHERE id=$1', [grupos.rows[0].id]);
        const maxP = parseInt(cap.rows[0]?.max_plazas || 5);
        if (parseInt(ocupados.rows[0].n) < maxP) {
          await query(
            'INSERT INTO kaluna_plaza_ocupantes (grupo_id, nombre, es_vacio) VALUES ($1, $2, false)',
            [grupos.rows[0].id, nombre]
          );
          creadas++;
        }
      }
    }
  }
  return { borradas, creadas };
}

// ============================================================
// RUTAS
// ============================================================

// Listar clientes
router.get('/', async (req, res) => {
  try {
    const estado = req.query.estado || 'activo';
    const orden = `ORDER BY
      CASE dias
        WHEN 'Lunes y Miercoles' THEN 1
        WHEN 'Lunes' THEN 2
        WHEN 'Martes y Jueves' THEN 3
        WHEN 'Martes' THEN 4
        WHEN 'Miércoles' THEN 5
        WHEN 'Jueves' THEN 6
        WHEN 'Sin fijo' THEN 7
        WHEN 'clase suelta' THEN 8
        ELSE 9
      END, LPAD(COALESCE(horario,'99:00'), 5, '0') ASC, nombre_completo`;
    const sql = estado === 'todos'
      ? `SELECT * FROM kaluna_clientes ${orden}`
      : `SELECT * FROM kaluna_clientes WHERE estado = $1 ${orden}`;
    const { rows } = estado === 'todos' ? await query(sql) : await query(sql, [estado]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Resumen contadores
router.get('/resumen', async (req, res) => {
  try {
    const r = await query(`
      SELECT
        COUNT(*) FILTER (WHERE estado='activo') as activos,
        COUNT(*) FILTER (WHERE estado='baja')   as bajas,
        COUNT(*) FILTER (WHERE estado='activo' AND metodo_pago='domiciliacion' AND COALESCE(iban_entregado,false)=false) as sin_iban,
        COUNT(*) FILTER (WHERE estado='activo' AND metodo_pago='efectivo_tarjeta' AND COALESCE(fianza_pagada,false)=false) as sin_fianza,
        COUNT(*) FILTER (WHERE estado='activo' AND metodo_pago='domiciliacion') as domiciliacion,
        COUNT(*) FILTER (WHERE estado='activo' AND metodo_pago='efectivo_tarjeta') as efectivo_tarjeta
      FROM kaluna_clientes
    `);
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Crear cliente (auto-asigna a plazas)
router.post('/', async (req, res) => {
  try {
    const { nombre_completo, telefono, dias, horario, horario2, dias_semana, notas, mes_inicio, metodo_pago } = req.body;
    if (!nombre_completo || !nombre_completo.trim()) {
      return res.status(400).json({ error: 'Nombre requerido' });
    }

    const dup = await query(
      `SELECT id, nombre_completo, estado FROM kaluna_clientes
       WHERE LOWER(TRIM(nombre_completo)) = LOWER(TRIM($1))
       OR (telefono IS NOT NULL AND telefono != '' AND telefono = $2)
       LIMIT 1`,
      [nombre_completo, telefono || '']
    );
    if (dup.rows.length) {
      const existente = dup.rows[0];
      return res.status(400).json({
        error: `Ya existe un cliente con ese nombre o teléfono: "${existente.nombre_completo}" (${existente.estado}). No se puede duplicar.`
      });
    }

    const { rows } = await query(
      `INSERT INTO kaluna_clientes (nombre_completo, telefono, dias, horario, horario2, dias_semana, notas, mes_inicio, metodo_pago)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [nombre_completo, telefono, dias, horario, horario2, dias_semana || 2, notas, mes_inicio, metodo_pago || '']
    );
    const cliente = rows[0];
    let plazas = { borradas: 0, creadas: 0 };
    try { plazas = await sincronizarPlazasCliente(cliente); } catch(e) { console.error('sync plazas POST', e); }
    res.json({ ...cliente, _plazas_sync: plazas });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Actualizar cliente (re-sincroniza plazas si cambian días/horario/estado)
router.put('/:id', async (req, res) => {
  try {
    const { nombre_completo, telefono, dias, horario, horario2, dias_semana, notas, mes_inicio, mes_baja, estado, metodo_pago, fianza_pagada, iban_entregado } = req.body;
    // Actualización parcial (solo un campo) - no toca plazas
    if (!nombre_completo) {
      if (fianza_pagada !== undefined) {
        const { rows } = await query("UPDATE kaluna_clientes SET fianza_pagada = $1 WHERE id = $2 RETURNING *", [fianza_pagada, req.params.id]);
        return res.json(rows[0]);
      }
      if (iban_entregado !== undefined) {
        const { rows } = await query("UPDATE kaluna_clientes SET iban_entregado = $1 WHERE id = $2 RETURNING *", [iban_entregado, req.params.id]);
        return res.json(rows[0]);
      }
    }
    const { rows } = await query(
      `UPDATE kaluna_clientes SET nombre_completo=$1, telefono=$2, dias=$3, horario=$4, horario2=$5,
       dias_semana=$6, notas=$7, mes_inicio=$8, mes_baja=$9, estado=$10, metodo_pago=$11 WHERE id=$12 RETURNING *`,
      [nombre_completo, telefono, dias, horario, horario2, dias_semana, notas, mes_inicio, mes_baja, estado, metodo_pago || '', req.params.id]
    );
    const cliente = rows[0];
    let plazas = { borradas: 0, creadas: 0 };
    try { plazas = await sincronizarPlazasCliente(cliente); } catch(e) { console.error('sync plazas PUT', e); }
    res.json({ ...cliente, _plazas_sync: plazas });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Dar de baja (también libera plazas)
router.put('/:id/baja', async (req, res) => {
  try {
    const { mes_baja } = req.body;
    const { rows } = await query(
      "UPDATE kaluna_clientes SET estado='baja', mes_baja=$1 WHERE id=$2 RETURNING *",
      [mes_baja, req.params.id]
    );
    let plazas = { borradas: 0, creadas: 0 };
    try { plazas = await sincronizarPlazasCliente(rows[0]); } catch(e) { console.error('sync plazas baja', e); }
    res.json({ ...rows[0], _plazas_sync: plazas });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Eliminar (también libera plazas)
router.delete('/:id', async (req, res) => {
  try {
    if (req.user.rol !== 'admin') return res.status(403).json({ error: 'Solo admin' });
    // Obtener nombre antes de borrar para limpiar plazas
    const prev = await query("SELECT nombre_completo FROM kaluna_clientes WHERE id=$1", [req.params.id]);
    if (prev.rows.length) {
      await query("DELETE FROM kaluna_plaza_ocupantes WHERE TRIM(nombre) ILIKE $1", [prev.rows[0].nombre_completo.trim()]);
    }
    await query("DELETE FROM kaluna_clientes WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Resincronizar TODAS las plazas desde clientes activos (one-shot, solo admin)
router.post('/resync-plazas', async (req, res) => {
  if (req.user.rol !== 'admin') return res.status(403).json({ error: 'Solo admin' });
  try {
    // Borrar todas las plazas no-vacías (mantener las marcadas es_vacio=true)
    await query("DELETE FROM kaluna_plaza_ocupantes WHERE COALESCE(es_vacio,false) = false");
    const { rows: activos } = await query("SELECT * FROM kaluna_clientes WHERE estado='activo'");
    let creadas = 0, fallidos = [];
    for (const c of activos) {
      try {
        const r = await sincronizarPlazasCliente(c);
        creadas += r.creadas;
      } catch (e) {
        fallidos.push({ id: c.id, nombre: c.nombre_completo, error: e.message });
      }
    }
    res.json({ ok: true, clientes_procesados: activos.length, plazas_creadas: creadas, fallidos });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
