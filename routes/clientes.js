const router = require('express').Router();
const { query } = require('../db');
const { verificarToken } = require('../middleware/auth');

router.use(verificarToken);

// Listar clientes
router.get('/', async (req, res) => {
  try {
    const estado = req.query.estado || 'activo';
    const orden = `ORDER BY
      CASE dias
        WHEN 'Lunes y Miercoles' THEN 1
        WHEN 'Lunes' THEN 2
        WHEN 'Martes y Jueves' THEN 3
        WHEN 'Martes' THEN 4
        WHEN 'Miércoles' THEN 5
        WHEN 'Jueves' THEN 6
        WHEN 'Sin fijo' THEN 7
        WHEN 'clase suelta' THEN 8
        ELSE 9
      END, LPAD(COALESCE(horario,'99:00'), 5, '0') ASC, nombre_completo`;
    const sql = estado === 'todos'
      ? `SELECT * FROM kaluna_clientes ${orden}`
      : `SELECT * FROM kaluna_clientes WHERE estado = $1 ${orden}`;
    const { rows } = estado === 'todos' ? await query(sql) : await query(sql, [estado]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Crear cliente
router.post('/', async (req, res) => {
  try {
    const { nombre_completo, telefono, dias, horario, horario2, dias_semana, notas, mes_inicio, metodo_pago } = req.body;
    const { rows } = await query(
      `INSERT INTO kaluna_clientes (nombre_completo, telefono, dias, horario, horario2, dias_semana, notas, mes_inicio, metodo_pago)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [nombre_completo, telefono, dias, horario, horario2, dias_semana || 2, notas, mes_inicio, metodo_pago || '']
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Actualizar cliente
router.put('/:id', async (req, res) => {
  try {
    const { nombre_completo, telefono, dias, horario, horario2, dias_semana, notas, mes_inicio, mes_baja, estado, metodo_pago, fianza_pagada } = req.body;
    // Si solo viene fianza_pagada, actualizar solo eso
    if (fianza_pagada !== undefined && !nombre_completo) {
      const { rows } = await query("UPDATE kaluna_clientes SET fianza_pagada = $1 WHERE id = $2 RETURNING *", [fianza_pagada, req.params.id]);
      return res.json(rows[0]);
    }
    const { rows } = await query(
      `UPDATE kaluna_clientes SET nombre_completo=$1, telefono=$2, dias=$3, horario=$4, horario2=$5,
       dias_semana=$6, notas=$7, mes_inicio=$8, mes_baja=$9, estado=$10, metodo_pago=$11 WHERE id=$12 RETURNING *`,
      [nombre_completo, telefono, dias, horario, horario2, dias_semana, notas, mes_inicio, mes_baja, estado, metodo_pago || '', req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Dar de baja
router.put('/:id/baja', async (req, res) => {
  try {
    const { mes_baja } = req.body;
    const { rows } = await query(
      "UPDATE kaluna_clientes SET estado='baja', mes_baja=$1 WHERE id=$2 RETURNING *",
      [mes_baja, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Eliminar
router.delete('/:id', async (req, res) => {
  try {
    if (req.user.rol !== 'admin') return res.status(403).json({ error: 'Solo admin' });
    await query("DELETE FROM kaluna_clientes WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
