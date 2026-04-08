const router = require('express').Router();
const { query } = require('../db');
const { verificarToken } = require('../middleware/auth');

router.use(verificarToken);

// Listar todas las fichas
router.get('/', async (req, res) => {
  try {
    const { rows } = await query("SELECT * FROM kaluna_lesiones ORDER BY cliente_nombre");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Obtener ficha de un cliente
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await query("SELECT * FROM kaluna_lesiones WHERE id = $1", [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'No encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Crear ficha
router.post('/', async (req, res) => {
  try {
    const { cliente_nombre, fecha, ejercicios_no_recomendados, notas_pilates, notas_fisio } = req.body;
    const { rows } = await query(
      `INSERT INTO kaluna_lesiones (cliente_nombre, fecha, ejercicios_no_recomendados, notas_pilates, notas_fisio)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [cliente_nombre, fecha || null, ejercicios_no_recomendados || '', notas_pilates || '', notas_fisio || '']
    );
    res.json(rows[0]);
  } catch (err) {
    if (err.message.includes('unique')) return res.status(400).json({ error: 'Ya existe una ficha para este cliente' });
    res.status(500).json({ error: err.message });
  }
});

// Actualizar ficha
router.put('/:id', async (req, res) => {
  try {
    const { cliente_nombre, fecha, ejercicios_no_recomendados, notas_pilates, notas_fisio } = req.body;
    const { rows } = await query(
      `UPDATE kaluna_lesiones SET cliente_nombre=$1, fecha=$2, ejercicios_no_recomendados=$3, notas_pilates=$4, notas_fisio=$5
       WHERE id=$6 RETURNING *`,
      [cliente_nombre, fecha || null, ejercicios_no_recomendados || '', notas_pilates || '', notas_fisio || '', req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Eliminar ficha
router.delete('/:id', async (req, res) => {
  try {
    if (req.user.rol !== 'admin') return res.status(403).json({ error: 'Solo admin' });
    await query("DELETE FROM kaluna_lesiones WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
