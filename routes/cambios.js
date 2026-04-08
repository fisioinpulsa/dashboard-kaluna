const router = require('express').Router();
const { query } = require('../db');
const { verificarToken } = require('../middleware/auth');

router.use(verificarToken);

router.get('/', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT c.*, u.nombre as trabajadora_nombre
       FROM kaluna_cambios c LEFT JOIN kaluna_usuarios u ON c.usuario_id = u.id
       ORDER BY c.estado ASC, c.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { tipo, cliente_nombre, descripcion } = req.body;
    const { rows } = await query(
      `INSERT INTO kaluna_cambios (usuario_id, tipo, cliente_nombre, descripcion)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.user.id, tipo || 'cambio', cliente_nombre, descripcion]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/gestionar', async (req, res) => {
  try {
    const { notas } = req.body;
    const { rows } = await query(
      `UPDATE kaluna_cambios SET estado='gestionado', gestionado_por=$1, gestionado_fecha=NOW(),
       descripcion = descripcion || E'\n---\nNota Lydia: ' || $2
       WHERE id=$3 RETURNING *`,
      [req.user.id, notas || 'OK', req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    if (req.user.rol !== 'admin') return res.status(403).json({ error: 'Solo admin' });
    await query("DELETE FROM kaluna_cambios WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
