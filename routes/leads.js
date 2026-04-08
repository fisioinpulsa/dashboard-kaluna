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
    // Si hay nota inicial, crear historial
    let historial = '[]';
    if (notas) {
      historial = JSON.stringify([{ texto: notas, fecha: new Date().toISOString(), autor: req.user.nombre }]);
    }
    const { rows } = await query(
      `INSERT INTO kaluna_leads (nombre, telefono, estado, trabajadora_id, notas, origen, horario_preferencia, historial_notas)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [nombre, telefono, estado || 'nuevo', trabajadora_id || req.user.id, notas, origen || 'anuncio', horario_preferencia, historial]
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

// Añadir nota con timestamp
router.post('/:id/nota', async (req, res) => {
  try {
    const { texto } = req.body;
    // Obtener historial actual
    const { rows: current } = await query("SELECT historial_notas, notas FROM kaluna_leads WHERE id = $1", [req.params.id]);
    if (!current.length) return res.status(404).json({ error: 'Lead no encontrado' });

    let historial = [];
    try { historial = JSON.parse(current[0].historial_notas || '[]'); } catch {}
    historial.push({ texto, fecha: new Date().toISOString(), autor: req.user.nombre });

    // La nota más reciente se guarda también en el campo notas
    const { rows } = await query(
      "UPDATE kaluna_leads SET notas = $1, historial_notas = $2 WHERE id = $3 RETURNING *",
      [texto, JSON.stringify(historial), req.params.id]
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
