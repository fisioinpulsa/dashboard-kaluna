const router = require('express').Router();
const { query } = require('../db');
const { verificarToken } = require('../middleware/auth');

router.use(verificarToken);

// GET /api/pagos-centro?mes=4&anio=2026 → devuelve los pagos marcados para ese mes/año
router.get('/', async (req, res) => {
  try {
    const mes = parseInt(req.query.mes);
    const anio = parseInt(req.query.anio || req.query.año);
    if (!mes || !anio) return res.status(400).json({ error: 'mes y anio requeridos' });
    const { rows } = await query(
      `SELECT cliente_id, pagado, fecha_marcado, importe FROM kaluna_pagos_centro WHERE mes = $1 AND año = $2`,
      [mes, anio]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/pagos-centro → marcar/desmarcar pago de un cliente para un mes/año
router.post('/', async (req, res) => {
  try {
    const { cliente_id, mes, anio, año, pagado, importe } = req.body;
    const finalAnio = parseInt(anio || año);
    if (!cliente_id || !mes || !finalAnio) return res.status(400).json({ error: 'cliente_id, mes y anio requeridos' });
    const { rows } = await query(
      `INSERT INTO kaluna_pagos_centro (cliente_id, mes, año, pagado, fecha_marcado, importe)
       VALUES ($1, $2, $3, $4, NOW(), $5)
       ON CONFLICT (cliente_id, mes, año)
       DO UPDATE SET pagado = EXCLUDED.pagado, fecha_marcado = EXCLUDED.fecha_marcado, importe = COALESCE(EXCLUDED.importe, kaluna_pagos_centro.importe)
       RETURNING *`,
      [cliente_id, parseInt(mes), finalAnio, !!pagado, importe || null]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
