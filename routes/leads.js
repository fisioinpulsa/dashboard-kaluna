const router = require('express').Router();
const { query } = require('../db');
const { verificarToken } = require('../middleware/auth');

router.use(verificarToken);

router.get('/', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT l.*, u.nombre as trabajadora_nombre
       FROM kaluna_leads l LEFT JOIN kaluna_usuarios u ON l.trabajadora_id = u.id
       ORDER BY l.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { nombre, telefono, estado, trabajadora_id, notas, origen, horario_preferencia } = req.body;
    const { rows } = await query(
      `INSERT INTO kaluna_leads (nombre, telefono, estado, trabajadora_id, notas, origen, horario_preferencia)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [nombre, telefono, estado || 'nuevo', trabajadora_id || req.user.id, notas, origen || 'anuncio', horario_preferencia]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { nombre, telefono, estado, trabajadora_id, notas, origen, horario_preferencia } = req.body;
    const { rows } = await query(
      `UPDATE kaluna_leads SET nombre=$1, telefono=$2, estado=$3, trabajadora_id=$4, notas=$5, origen=$6, horario_preferencia=$7
       WHERE id=$8 RETURNING *`,
      [nombre, telefono, estado, trabajadora_id, notas, origen, horario_preferencia, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await query("DELETE FROM kaluna_leads WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
