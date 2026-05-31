const router = require('express').Router();
const { query } = require('../db');
const { verificarToken } = require('../middleware/auth');

router.use(verificarToken);

// Solo admin (titular y colaboradora) — no trabajadoras
function soloAdminOColab(req, res, next) {
  if (req.user.rol !== 'admin' && req.user.rol !== 'colaboradora') return res.status(403).json({ error: 'Solo admin o colaboradora' });
  next();
}
router.use(soloAdminOColab);

const TIPOS_VALIDOS = ['suscripcion', 'calcetines', 'bebida', 'clase_suelta', 'fianza', 'otros'];
const PAGOS_VALIDOS = ['tarjeta', 'efectivo', 'domiciliacion'];
const TIPOS_INCIDENCIA = ['rechazo_transferencia', 'devolucion_recibo'];

// Tarifas de comisión pactadas
const COMISION_TARJETA_PCT = 0.20;   // 0,20 % sobre importe total
const COMISION_DOMI_FIJO   = 0.35;   // 0,35 € por transacción de remesa
const CARGO_RECHAZO_TRANSF = 3.50;   // 3,50 € por rechazo de transferencia
const CARGO_DEVOL_RECIBO   = 15.50;  // 15,50 € por devolución de recibo

function calcularIva(total, ivaPct) {
  const t = parseFloat(total);
  const p = parseFloat(ivaPct);
  const base = t / (1 + p / 100);
  const iva = t - base;
  return {
    base: Math.round(base * 100) / 100,
    iva: Math.round(iva * 100) / 100,
    total: Math.round(t * 100) / 100
  };
}

function calcularComision(importe, metodo_pago) {
  const t = parseFloat(importe);
  if (metodo_pago === 'tarjeta') {
    const c = t * (COMISION_TARJETA_PCT / 100);
    return {
      comision: Math.round(c * 100) / 100,
      descripcion: `TPV ${COMISION_TARJETA_PCT}%`
    };
  }
  if (metodo_pago === 'domiciliacion') {
    return {
      comision: COMISION_DOMI_FIJO,
      descripcion: `Remesa ${COMISION_DOMI_FIJO.toFixed(2)}€`
    };
  }
  return { comision: 0, descripcion: null };
}

function importeIncidencia(tipo) {
  if (tipo === 'rechazo_transferencia') return CARGO_RECHAZO_TRANSF;
  if (tipo === 'devolucion_recibo') return CARGO_DEVOL_RECIBO;
  return 0;
}

// ====================================================
// GET listar ventas + resumen
// ====================================================
router.get('/', async (req, res) => {
  try {
    const now = new Date();
    const mes = parseInt(req.query.mes) || (now.getMonth() + 1);
    const anio = parseInt(req.query.anio) || now.getFullYear();
    const { rows } = await query(
      `SELECT v.*, u.nombre as creado_por
       FROM kaluna_ventas_centro v
       LEFT JOIN kaluna_usuarios u ON u.id = v.created_by
       WHERE EXTRACT(MONTH FROM v.fecha) = $1 AND EXTRACT(YEAR FROM v.fecha) = $2
       ORDER BY v.fecha DESC, v.id DESC`,
      [mes, anio]
    );
    // Incidencias del mes
    const inc = await query(
      `SELECT i.*, u.nombre as creado_por
       FROM kaluna_ventas_centro_incidencias i
       LEFT JOIN kaluna_usuarios u ON u.id = i.created_by
       WHERE EXTRACT(MONTH FROM i.fecha) = $1 AND EXTRACT(YEAR FROM i.fecha) = $2
       ORDER BY i.fecha DESC, i.id DESC`,
      [mes, anio]
    );

    const resumen = {
      total: 0, base: 0, iva: 0, comisiones: 0, incidencias: 0,
      neto: 0, num: rows.length, num_incidencias: inc.rows.length,
      por_tipo: {}, por_pago: {}, por_incidencia: {}
    };
    rows.forEach(v => {
      const t = parseFloat(v.importe_total);
      const b = parseFloat(v.base_imponible);
      const i = parseFloat(v.iva_importe);
      const c = parseFloat(v.comision || 0);
      resumen.total += t; resumen.base += b; resumen.iva += i; resumen.comisiones += c;
      resumen.por_tipo[v.tipo] = (resumen.por_tipo[v.tipo] || 0) + t;
      resumen.por_pago[v.metodo_pago] = (resumen.por_pago[v.metodo_pago] || 0) + t;
    });
    inc.rows.forEach(x => {
      const im = parseFloat(x.importe);
      resumen.incidencias += im;
      resumen.por_incidencia[x.tipo] = (resumen.por_incidencia[x.tipo] || 0) + im;
    });
    // Neto real = base imponible - comisiones (las incidencias quedan SOLO informativas, no descuentan)
    resumen.neto = resumen.base - resumen.comisiones;
    // Redondeos
    ['total','base','iva','comisiones','incidencias','neto'].forEach(k => {
      resumen[k] = Math.round(resumen[k] * 100) / 100;
    });

    res.json({ ventas: rows, incidencias: inc.rows, resumen, mes, anio });
  } catch (e) {
    console.error('ventas-centro list', e);
    res.status(500).json({ error: e.message });
  }
});

// ====================================================
// POST crear venta
// ====================================================
router.post('/', async (req, res) => {
  try {
    const { fecha, tipo, descripcion, cliente_nombre, importe_total, iva_pct, metodo_pago, notas } = req.body;
    if (!tipo || !TIPOS_VALIDOS.includes(tipo)) return res.status(400).json({ error: 'Tipo inválido' });
    if (!metodo_pago || !PAGOS_VALIDOS.includes(metodo_pago)) return res.status(400).json({ error: 'Método de pago inválido' });
    if (importe_total === undefined || isNaN(parseFloat(importe_total)) || parseFloat(importe_total) < 0) {
      return res.status(400).json({ error: 'Importe inválido' });
    }
    let ivaPctFinal = (iva_pct !== undefined && iva_pct !== null && iva_pct !== '') ? parseFloat(iva_pct) : (tipo === 'fianza' ? 0 : 21);
    const calc = calcularIva(importe_total, ivaPctFinal);
    const com = calcularComision(calc.total, metodo_pago);
    const { rows } = await query(
      `INSERT INTO kaluna_ventas_centro
       (fecha, tipo, descripcion, cliente_nombre, importe_total, iva_pct, base_imponible, iva_importe,
        metodo_pago, comision, comision_descripcion, notas, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [fecha || new Date().toISOString().slice(0,10), tipo, descripcion || null, cliente_nombre || null,
       calc.total, ivaPctFinal, calc.base, calc.iva, metodo_pago, com.comision, com.descripcion,
       notas || null, req.user.id]
    );
    res.json(rows[0]);
  } catch (e) {
    console.error('ventas-centro post', e);
    res.status(500).json({ error: e.message });
  }
});

// ====================================================
// PUT editar venta
// ====================================================
router.put('/:id', async (req, res) => {
  try {
    const { fecha, tipo, descripcion, cliente_nombre, importe_total, iva_pct, metodo_pago, notas } = req.body;
    if (tipo && !TIPOS_VALIDOS.includes(tipo)) return res.status(400).json({ error: 'Tipo inválido' });
    if (metodo_pago && !PAGOS_VALIDOS.includes(metodo_pago)) return res.status(400).json({ error: 'Método de pago inválido' });
    let ivaPctFinal = (iva_pct !== undefined && iva_pct !== null && iva_pct !== '') ? parseFloat(iva_pct) : (tipo === 'fianza' ? 0 : 21);
    const calc = calcularIva(importe_total, ivaPctFinal);
    const com = calcularComision(calc.total, metodo_pago);
    const { rows } = await query(
      `UPDATE kaluna_ventas_centro
       SET fecha=$1, tipo=$2, descripcion=$3, cliente_nombre=$4, importe_total=$5, iva_pct=$6,
           base_imponible=$7, iva_importe=$8, metodo_pago=$9, comision=$10, comision_descripcion=$11,
           notas=$12, updated_at=now()
       WHERE id=$13 RETURNING *`,
      [fecha, tipo, descripcion || null, cliente_nombre || null, calc.total, ivaPctFinal, calc.base, calc.iva,
       metodo_pago, com.comision, com.descripcion, notas || null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'No encontrado' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ====================================================
// DELETE venta (solo superadmin)
// ====================================================
router.delete('/:id', async (req, res) => {
  if (req.user.id !== 1) return res.status(403).json({ error: 'Solo superadmin puede eliminar' });
  try {
    await query('DELETE FROM kaluna_ventas_centro WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ====================================================
// POST registrar incidencia (rechazo o devolución)
// ====================================================
router.post('/incidencias', async (req, res) => {
  try {
    const { fecha, tipo, cliente_nombre, notas, venta_id, importe } = req.body;
    if (!tipo || !TIPOS_INCIDENCIA.includes(tipo)) {
      return res.status(400).json({ error: 'Tipo de incidencia inválido (rechazo_transferencia o devolucion_recibo)' });
    }
    // Si no pasan importe, usar el estándar del tipo
    const importeFinal = (importe !== undefined && importe !== null && importe !== '') ? parseFloat(importe) : importeIncidencia(tipo);
    if (isNaN(importeFinal) || importeFinal < 0) return res.status(400).json({ error: 'Importe inválido' });
    const { rows } = await query(
      `INSERT INTO kaluna_ventas_centro_incidencias
       (fecha, tipo, importe, cliente_nombre, notas, venta_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [fecha || new Date().toISOString().slice(0,10), tipo, importeFinal,
       cliente_nombre || null, notas || null, venta_id || null, req.user.id]
    );
    res.json(rows[0]);
  } catch (e) {
    console.error('incidencias post', e);
    res.status(500).json({ error: e.message });
  }
});

// PUT editar incidencia
router.put('/incidencias/:id', async (req, res) => {
  try {
    const { fecha, tipo, cliente_nombre, notas, importe } = req.body;
    if (tipo && !TIPOS_INCIDENCIA.includes(tipo)) return res.status(400).json({ error: 'Tipo inválido' });
    const importeFinal = (importe !== undefined && importe !== null && importe !== '') ? parseFloat(importe) : importeIncidencia(tipo);
    const { rows } = await query(
      `UPDATE kaluna_ventas_centro_incidencias
       SET fecha=$1, tipo=$2, importe=$3, cliente_nombre=$4, notas=$5
       WHERE id=$6 RETURNING *`,
      [fecha, tipo, importeFinal, cliente_nombre || null, notas || null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'No encontrado' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE incidencia (solo superadmin)
router.delete('/incidencias/:id', async (req, res) => {
  if (req.user.id !== 1) return res.status(403).json({ error: 'Solo superadmin puede eliminar' });
  try {
    await query('DELETE FROM kaluna_ventas_centro_incidencias WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
