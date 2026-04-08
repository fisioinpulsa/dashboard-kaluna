const router = require('express').Router();
const { query } = require('../db');
const { verificarToken } = require('../middleware/auth');

router.use(verificarToken);

router.get('/', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT a.*, u.nombre as autor, r.nombre as resuelto_por_nombre
       FROM kaluna_avisos a
       LEFT JOIN kaluna_usuarios u ON a.usuario_id = u.id
       LEFT JOIN kaluna_usuarios r ON a.resuelto_por = r.id
       ORDER BY a.resuelto ASC, a.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { tipo, titulo, descripcion } = req.body;
    const { rows } = await query(
      `INSERT INTO kaluna_avisos (usuario_id, tipo, titulo, descripcion)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.user.id, tipo || 'error', titulo, descripcion]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/resolver', async (req, res) => {
  try {
    const { rows } = await query(
      "UPDATE kaluna_avisos SET resuelto = true, resuelto_por = $1, resuelto_fecha = NOW() WHERE id = $2 RETURNING *",
      [req.user.id, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    if (req.user.rol !== 'admin') return res.status(403).json({ error: 'Solo admin' });
    await query("DELETE FROM kaluna_avisos WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
