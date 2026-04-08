const router = require('express').Router();
const { query } = require('../db');
const { verificarToken } = require('../middleware/auth');

router.use(verificarToken);

// Obtener mapa de plazas (lectura directa de asignaciones)
router.get('/', async (req, res) => {
  try {
    const { rows: grupos } = await query(`SELECT * FROM kaluna_grupos ORDER BY
      CASE dia
        WHEN 'Lunes' THEN 1
        WHEN 'Martes' THEN 2
        WHEN 'Miércoles' THEN 3
        WHEN 'Jueves' THEN 4
        WHEN 'Viernes' THEN 5
        ELSE 6
      END, LPAD(hora, 5, '0')`);

    const { rows: ocupantes } = await query(
      "SELECT * FROM kaluna_plaza_ocupantes ORDER BY id"
    );

    const mapa = grupos.map(g => {
      const asignados = ocupantes.filter(o => o.grupo_id === g.id);
      const personas = asignados.filter(o => !o.es_vacio);
      const esPrueba = asignados.some(o => o.nombre === 'CLASE DE PRUEBA');
      return {
        ...g,
        es_prueba: esPrueba,
        ocupantes: personas.map(o => ({ id: o.id, nombre_completo: o.nombre })),
        ocupadas: personas.length,
        libres: g.max_plazas - personas.length,
        lleno: personas.length >= g.max_plazas
      };
    });

    res.json(mapa);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Crear/editar grupo
router.post('/grupo', async (req, res) => {
  try {
    if (req.user.rol !== 'admin') return res.status(403).json({ error: 'Solo admin' });
    const { nombre, dia, hora, max_plazas } = req.body;
    const { rows } = await query(
      `INSERT INTO kaluna_grupos (nombre, dia, hora, max_plazas)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (nombre) DO UPDATE SET dia=$2, hora=$3, max_plazas=$4
       RETURNING *`,
      [nombre, dia, hora, max_plazas || 5]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Añadir persona a un grupo
router.post('/ocupante', async (req, res) => {
  try {
    const { grupo_id, nombre } = req.body;
    const { rows } = await query(
      'INSERT INTO kaluna_plaza_ocupantes (grupo_id, nombre, es_vacio) VALUES ($1, $2, false) RETURNING *',
      [grupo_id, nombre]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Quitar persona de un grupo
router.delete('/ocupante/:id', async (req, res) => {
  try {
    await query('DELETE FROM kaluna_plaza_ocupantes WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/grupo/:id', async (req, res) => {
  try {
    if (req.user.rol !== 'admin') return res.status(403).json({ error: 'Solo admin' });
    await query("DELETE FROM kaluna_grupos WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
