const router = require('express').Router();
const { query } = require('../db');
const { verificarToken, soloAdmin } = require('../middleware/auth');

// Registrar actividad (interno, se llama desde el frontend)
router.post('/', verificarToken, async (req, res) => {
  try {
    const { accion, seccion, detalle } = req.body;
    await query(
      "INSERT INTO kaluna_actividad (usuario_id, usuario_nombre, accion, seccion, detalle) VALUES ($1,$2,$3,$4,$5)",
      [req.user.id, req.user.nombre, accion, seccion, detalle]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Consultar actividad (solo admin)
router.get('/', verificarToken, soloAdmin, async (req, res) => {
  try {
    const { rows } = await query(
      "SELECT * FROM kaluna_actividad ORDER BY created_at DESC LIMIT 200"
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
