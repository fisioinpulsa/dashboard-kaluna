const router = require('express').Router();
const { query } = require('../db');
const { verificarToken } = require('../middleware/auth');

router.use(verificarToken);

router.get('/', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT e.*, u.nombre as trabajadora_nombre
       FROM kaluna_lista_espera e LEFT JOIN kaluna_usuarios u ON e.trabajadora_id = u.id
       ORDER BY e.fecha DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { nombre, telefono, fecha, horario_deseado, dias, notas } = req.body;
    const { rows } = await query(
      `INSERT INTO kaluna_lista_espera (trabajadora_id, nombre, telefono, fecha, horario_deseado, dias, notas)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.user.id, nombre, telefono, fecha, horario_deseado, dias, notas]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { nombre, telefono, fecha, horario_deseado, dias, notas } = req.body;
    const { rows } = await query(
      `UPDATE kaluna_lista_espera SET nombre=$1, telefono=$2, fecha=$3, horario_deseado=$4, dias=$5, notas=$6
       WHERE id=$7 RETURNING *`,
      [nombre, telefono, fecha || null, horario_deseado, dias, notas, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/estado', async (req, res) => {
  try {
    const { rows } = await query(
      "UPDATE kaluna_lista_espera SET estado = $1 WHERE id = $2 RETURNING *",
      [req.body.estado, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await query("DELETE FROM kaluna_lista_espera WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
