const router = require('express').Router();
const { query } = require('../db');
const { verificarToken } = require('../middleware/auth');

router.use(verificarToken);

router.get('/', async (req, res) => {
  try {
    const { mes, año } = req.query;
    let sql = `SELECT v.*, u.nombre as trabajadora_nombre
               FROM kaluna_ventas v LEFT JOIN kaluna_usuarios u ON v.trabajadora_id = u.id`;
    const params = [];
    if (mes && año) {
      sql += ` WHERE EXTRACT(MONTH FROM v.fecha) = $1 AND EXTRACT(YEAR FROM v.fecha) = $2`;
      params.push(mes, año);
    } else {
      sql += ` WHERE EXTRACT(YEAR FROM v.fecha) = 2026 OR v.fecha IS NULL`;
    }
    sql += ' ORDER BY v.fecha DESC, v.created_at DESC';
    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/resumen', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT
        EXTRACT(MONTH FROM fecha) as mes,
        EXTRACT(YEAR FROM fecha) as año,
        SUM(precio) as total,
        COUNT(*) as num_ventas,
        SUM(CASE WHEN metodo_pago = 'Efectivo' THEN precio ELSE 0 END) as total_efectivo,
        SUM(CASE WHEN metodo_pago = 'Tarjeta' THEN precio ELSE 0 END) as total_tarjeta
      FROM kaluna_ventas
      GROUP BY EXTRACT(YEAR FROM fecha), EXTRACT(MONTH FROM fecha)
      ORDER BY año DESC, mes DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { cliente_nombre, fecha, articulo, precio, metodo_pago, notas } = req.body;
    const { rows } = await query(
      `INSERT INTO kaluna_ventas (trabajadora_id, cliente_nombre, fecha, articulo, precio, metodo_pago, notas)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.user.id, cliente_nombre, fecha || new Date(), articulo, precio, metodo_pago, notas]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await query("DELETE FROM kaluna_ventas WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
