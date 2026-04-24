const router = require('express').Router();
const { query } = require('../db');
const { verificarToken } = require('../middleware/auth');

function soloSuperAdmin(req, res, next) {
  if (req.user.rol !== 'admin' || req.user.id !== 1) {
    return res.status(403).json({ error: 'Acceso restringido' });
  }
  next();
}

router.use(verificarToken, soloSuperAdmin);

// Listar gastos de un mes/año (auto-crea desde plantilla si está vacío)
router.get('/', async (req, res) => {
  try {
    const { mes, año } = req.query;
    const m = mes || (new Date().getMonth() + 1);
    const y = año || new Date().getFullYear();
    let { rows } = await query(
      "SELECT * FROM kaluna_gastos WHERE mes = $1 AND año = $2 ORDER BY orden, categoria, id",
      [m, y]
    );

    // Si está vacío, crear desde plantilla
    if (!rows.length) {
      const { rows: plantilla } = await query(
        "SELECT categoria, concepto, estimacion, orden FROM kaluna_gastos_plantilla WHERE activo = true ORDER BY orden"
      );
      for (const p of plantilla) {
        await query(
          "INSERT INTO kaluna_gastos (mes, año, categoria, concepto, estimacion, orden) VALUES ($1,$2,$3,$4,$5,$6)",
          [m, y, p.categoria, p.concepto, p.estimacion, p.orden]
        );
      }
      const result = await query(
        "SELECT * FROM kaluna_gastos WHERE mes = $1 AND año = $2 ORDER BY orden, categoria, id",
        [m, y]
      );
      rows = result.rows;
    }
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Plantilla (para editar los gastos fijos recurrentes)
router.get('/plantilla', async (req, res) => {
  try {
    const { rows } = await query("SELECT * FROM kaluna_gastos_plantilla ORDER BY orden");
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/plantilla', async (req, res) => {
  try {
    const { categoria, concepto, estimacion, orden } = req.body;
    const { rows } = await query(
      "INSERT INTO kaluna_gastos_plantilla (categoria, concepto, estimacion, orden) VALUES ($1,$2,$3,$4) RETURNING *",
      [categoria, concepto, estimacion || 0, orden || 0]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/plantilla/:id', async (req, res) => {
  try {
    const { categoria, concepto, estimacion, activo } = req.body;
    const { rows } = await query(
      "UPDATE kaluna_gastos_plantilla SET categoria=$1, concepto=$2, estimacion=$3, activo=$4 WHERE id=$5 RETURNING *",
      [categoria, concepto, estimacion || 0, activo !== false, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/plantilla/:id', async (req, res) => {
  try {
    await query("DELETE FROM kaluna_gastos_plantilla WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Resumen por mes (últimos 12 meses)
router.get('/resumen', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT mes, año,
        SUM(estimacion) as total_estimacion,
        SUM(realidad) as total_realidad,
        SUM(ahorro) as total_ahorro,
        COUNT(*) as num
      FROM kaluna_gastos
      GROUP BY año, mes
      ORDER BY año DESC, mes DESC
      LIMIT 12
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Crear gasto
router.post('/', async (req, res) => {
  try {
    const { mes, año, categoria, concepto, estimacion, semana, realidad, ahorro, notas, orden } = req.body;
    const { rows } = await query(
      `INSERT INTO kaluna_gastos (mes, año, categoria, concepto, estimacion, semana, realidad, ahorro, notas, orden)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [mes, año, categoria, concepto, estimacion || 0, semana || null, realidad || 0, ahorro || 0, notas || '', orden || 0]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Editar gasto
router.put('/:id', async (req, res) => {
  try {
    const { categoria, concepto, estimacion, semana, realidad, ahorro, notas } = req.body;
    const { rows } = await query(
      `UPDATE kaluna_gastos SET categoria=$1, concepto=$2, estimacion=$3, semana=$4, realidad=$5, ahorro=$6, notas=$7
       WHERE id=$8 RETURNING *`,
      [categoria, concepto, estimacion || 0, semana || null, realidad || 0, ahorro || 0, notas || '', req.params.id]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Duplicar gastos de un mes a otro (para reutilizar plantilla)
router.post('/copiar', async (req, res) => {
  try {
    const { origen_mes, origen_año, destino_mes, destino_año } = req.body;
    const { rows } = await query(
      `INSERT INTO kaluna_gastos (mes, año, categoria, concepto, estimacion, orden)
       SELECT $1, $2, categoria, concepto, estimacion, orden
       FROM kaluna_gastos WHERE mes = $3 AND año = $4
       RETURNING *`,
      [destino_mes, destino_año, origen_mes, origen_año]
    );
    res.json({ copiados: rows.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Eliminar gasto
router.delete('/:id', async (req, res) => {
  try {
    await query("DELETE FROM kaluna_gastos WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
