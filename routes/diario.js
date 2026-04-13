const router = require('express').Router();
const { query } = require('../db');
const { verificarToken } = require('../middleware/auth');

router.use(verificarToken);

// Obtener entradas del diario (admin ve todo, trabajadora solo lo suyo)
router.get('/', async (req, res) => {
  try {
    const { fecha, usuario_id } = req.query;
    let sql = `SELECT d.*, u.nombre as autor
               FROM kaluna_diario d
               LEFT JOIN kaluna_usuarios u ON d.usuario_id = u.id`;
    const params = [];
    const conditions = [];

    // Trabajadoras solo ven lo suyo
    if (req.user.rol !== 'admin') {
      conditions.push(`d.usuario_id = $${params.length + 1}`);
      params.push(req.user.id);
    } else if (usuario_id) {
      conditions.push(`d.usuario_id = $${params.length + 1}`);
      params.push(usuario_id);
    }

    if (fecha) {
      conditions.push(`d.fecha = $${params.length + 1}`);
      params.push(fecha);
    }

    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY d.fecha DESC, d.created_at DESC';

    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Crear entrada
router.post('/', async (req, res) => {
  try {
    const { contenido } = req.body;
    // Siempre fecha de hoy (hora España)
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Madrid' }));
    const hoy = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    const { rows } = await query(
      `INSERT INTO kaluna_diario (usuario_id, fecha, contenido)
       VALUES ($1, $2, $3) RETURNING *`,
      [req.user.id, hoy, contenido]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Editar entrada (solo la propia)
router.put('/:id', async (req, res) => {
  try {
    const { contenido } = req.body;
    const { rows } = await query(
      "UPDATE kaluna_diario SET contenido = $1 WHERE id = $2 AND (usuario_id = $3 OR $4 = 'admin') RETURNING *",
      [contenido, req.params.id, req.user.id, req.user.rol]
    );
    if (!rows.length) return res.status(403).json({ error: 'No autorizado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Eliminar
router.delete('/:id', async (req, res) => {
  try {
    await query(
      "DELETE FROM kaluna_diario WHERE id = $1 AND (usuario_id = $2 OR $3 = 'admin')",
      [req.params.id, req.user.id, req.user.rol]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
