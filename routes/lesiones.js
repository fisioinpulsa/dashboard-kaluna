const router = require('express').Router();
const { query } = require('../db');
const { verificarToken } = require('../middleware/auth');

router.use(verificarToken);

// Listar todas las fichas con estado del cliente (LEFT JOIN por nombre)
router.get('/', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT l.*,
        COALESCE(c.estado, 'sin_cliente') as cliente_estado,
        c.dias as cliente_dias,
        c.horario as cliente_horario
      FROM kaluna_lesiones l
      LEFT JOIN kaluna_clientes c
        ON LOWER(TRIM(c.nombre_completo)) = LOWER(TRIM(l.cliente_nombre))
      ORDER BY LOWER(TRIM(l.cliente_nombre)) ASC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Resumen para cabecera (totales y alertas)
router.get('/resumen', async (req, res) => {
  try {
    const r = await query(`
      WITH joined AS (
        SELECT l.id, l.cliente_nombre, l.ejercicios_no_recomendados, l.notas_pilates, l.notas_fisio, l.created_at,
          COALESCE(c.estado, 'sin_cliente') as cliente_estado
        FROM kaluna_lesiones l
        LEFT JOIN kaluna_clientes c
          ON LOWER(TRIM(c.nombre_completo)) = LOWER(TRIM(l.cliente_nombre))
      )
      SELECT
        COUNT(*) FILTER (WHERE cliente_estado='activo') as activas,
        COUNT(*) FILTER (WHERE cliente_estado='baja') as bajas,
        COUNT(*) FILTER (WHERE cliente_estado='sin_cliente') as huerfanas,
        COUNT(*) FILTER (WHERE cliente_estado='activo' AND COALESCE(TRIM(ejercicios_no_recomendados),'') != '') as con_restricciones,
        COUNT(*) FILTER (WHERE cliente_estado='activo' AND created_at >= date_trunc('month', now())) as actualizadas_mes
      FROM joined
    `);
    res.json(r.rows[0]);
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
