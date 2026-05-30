const router = require('express').Router();
const { query } = require('../db');
const { verificarToken } = require('../middleware/auth');

router.use(verificarToken);

// Solo admin (titular y colaboradora) — no trabajadoras
function soloAdmin(req, res, next) {
  if (req.user.rol !== 'admin') return res.status(403).json({ error: 'Solo admin' });
  next();
}
router.use(soloAdmin);

const TIPOS_VALIDOS = ['suscripcion', 'calcetines', 'bebida', 'clase_suelta', 'fianza', 'otros'];
const PAGOS_VALIDOS = ['tarjeta', 'efectivo', 'domiciliacion'];

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

// GET listar por mes/año + resumen
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
    const resumen = {
      total: 0, base: 0, iva: 0, num: rows.length,
      por_tipo: {}, por_pago: {}
    };
    rows.forEach(v => {
      const t = parseFloat(v.importe_total), b = parseFloat(v.base_imponible), i = parseFloat(v.iva_importe);
      resumen.total += t; resumen.base += b; resumen.iva += i;
      resumen.por_tipo[v.tipo] = (resumen.por_tipo[v.tipo] || 0) + t;
      resumen.por_pago[v.metodo_pago] = (resumen.por_pago[v.metodo_pago] || 0) + t;
    });
    resumen.total = Math.round(resumen.total * 100) / 100;
    resumen.base = Math.round(resumen.base * 100) / 100;
    resumen.iva = Math.round(resumen.iva * 100) / 100;
    res.json({ ventas: rows, resumen, mes, anio });
  } catch (e) {
    console.error('ventas-centro list', e);
    res.status(500).json({ error: e.message });
  }
});

// POST crear venta
router.post('/', async (req, res) => {
  try {
    const { fecha, tipo, descripcion, cliente_nombre, importe_total, iva_pct, metodo_pago, notas } = req.body;
    if (!tipo || !TIPOS_VALIDOS.includes(tipo)) return res.status(400).json({ error: 'Tipo inválido' });
    if (!metodo_pago || !PAGOS_VALIDOS.includes(metodo_pago)) return res.status(400).json({ error: 'Método de pago inválido' });
    if (importe_total === undefined || isNaN(parseFloat(importe_total)) || parseFloat(importe_total) < 0) {
      return res.status(400).json({ error: 'Importe inválido' });
    }
    // Fianza por defecto sin IVA (es depósito reembolsable)
    let ivaPctFinal = (iva_pct !== undefined && iva_pct !== null && iva_pct !== '') ? parseFloat(iva_pct) : (tipo === 'fianza' ? 0 : 21);
    const calc = calcularIva(importe_total, ivaPctFinal);
    const { rows } = await query(
      `INSERT INTO kaluna_ventas_centro
       (fecha, tipo, descripcion, cliente_nombre, importe_total, iva_pct, base_imponible, iva_importe, metodo_pago, notas, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [fecha || new Date().toISOString().slice(0,10), tipo, descripcion || null, cliente_nombre || null, calc.total, ivaPctFinal, calc.base, calc.iva, metodo_pago, notas || null, req.user.id]
    );
    res.json(rows[0]);
  } catch (e) {
    console.error('ventas-centro post', e);
    res.status(500).json({ error: e.message });
  }
});

// PUT editar venta
router.put('/:id', async (req, res) => {
  try {
    const { fecha, tipo, descripcion, cliente_nombre, importe_total, iva_pct, metodo_pago, notas } = req.body;
    if (tipo && !TIPOS_VALIDOS.includes(tipo)) return res.status(400).json({ error: 'Tipo inválido' });
    if (metodo_pago && !PAGOS_VALIDOS.includes(metodo_pago)) return res.status(400).json({ error: 'Método de pago inválido' });
    let ivaPctFinal = (iva_pct !== undefined && iva_pct !== null && iva_pct !== '') ? parseFloat(iva_pct) : (tipo === 'fianza' ? 0 : 21);
    const calc = calcularIva(importe_total, ivaPctFinal);
    const { rows } = await query(
      `UPDATE kaluna_ventas_centro
       SET fecha=$1, tipo=$2, descripcion=$3, cliente_nombre=$4, importe_total=$5, iva_pct=$6,
           base_imponible=$7, iva_importe=$8, metodo_pago=$9, notas=$10, updated_at=now()
       WHERE id=$11 RETURNING *`,
      [fecha, tipo, descripcion || null, cliente_nombre || null, calc.total, ivaPctFinal, calc.base, calc.iva, metodo_pago, notas || null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'No encontrado' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE solo superadmin
router.delete('/:id', async (req, res) => {
  if (req.user.id !== 1) return res.status(403).json({ error: 'Solo superadmin puede eliminar' });
  try {
    await query('DELETE FROM kaluna_ventas_centro WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
