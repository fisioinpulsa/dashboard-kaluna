const router = require('express').Router();
const { query } = require('../db');
const { verificarToken } = require('../middleware/auth');

router.use(verificarToken);

router.get('/', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT c.*, u.nombre as trabajadora_nombre
       FROM kaluna_caja c LEFT JOIN kaluna_usuarios u ON c.trabajadora_id = u.id
       ORDER BY c.fecha DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { fecha, efectivo_total, monedas, billetes, notas } = req.body;
    const { rows } = await query(
      `INSERT INTO kaluna_caja (trabajadora_id, fecha, efectivo_total, monedas, billetes, notas)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.user.id, fecha || new Date(), efectivo_total, monedas, billetes, notas]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { fecha, efectivo_total, monedas, billetes, notas } = req.body;
    const { rows } = await query(
      `UPDATE kaluna_caja SET fecha=$1, efectivo_total=$2, monedas=$3, billetes=$4, notas=$5 WHERE id=$6 RETURNING *`,
      [fecha || null, efectivo_total, monedas, billetes, notas, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    if (req.user.rol !== 'admin') return res.status(403).json({ error: 'Solo admin' });
    await query("DELETE FROM kaluna_caja WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
