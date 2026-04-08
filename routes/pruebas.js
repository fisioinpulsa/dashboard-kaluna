const router = require('express').Router();
const { query } = require('../db');
const { verificarToken } = require('../middleware/auth');

router.use(verificarToken);

router.get('/', async (req, res) => {
  try {
    const { rows } = await query("SELECT * FROM kaluna_clases_prueba ORDER BY fecha DESC, hora DESC");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { nombre, telefono, fecha, hora, notas } = req.body;
    const { rows } = await query(
      `INSERT INTO kaluna_clases_prueba (nombre, telefono, fecha, hora, notas)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [nombre, telefono, fecha, hora, notas]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/recordatorio', async (req, res) => {
  try {
    const { rows } = await query(
      "UPDATE kaluna_clases_prueba SET recordatorio_enviado = true WHERE id = $1 RETURNING *",
      [req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await query("DELETE FROM kaluna_clases_prueba WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
