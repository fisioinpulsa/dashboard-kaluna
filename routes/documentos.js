const router = require('express').Router();
const { query } = require('../db');
const { verificarToken } = require('../middleware/auth');

// Listar todos los documentos (cualquier usuario logueado)
router.get('/', verificarToken, async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT d.id, d.titulo, d.descripcion, d.contenido, d.archivo_tipo, d.fecha_creacion,
        u.nombre as creado_por_nombre,
        (SELECT COUNT(*) FROM kaluna_documento_firmas WHERE documento_id = d.id) as num_firmas
      FROM kaluna_documentos d
      LEFT JOIN kaluna_usuarios u ON d.creado_por = u.id
      ORDER BY d.fecha_creacion DESC
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Ver un documento con sus firmas
router.get('/:id', verificarToken, async (req, res) => {
  try {
    const { rows: docs } = await query(
      `SELECT d.*, u.nombre as creado_por_nombre
       FROM kaluna_documentos d
       LEFT JOIN kaluna_usuarios u ON d.creado_por = u.id
       WHERE d.id = $1`, [req.params.id]
    );
    if (!docs.length) return res.status(404).json({ error: 'No encontrado' });

    const { rows: firmas } = await query(
      "SELECT * FROM kaluna_documento_firmas WHERE documento_id = $1 ORDER BY fecha_firma DESC",
      [req.params.id]
    );
    res.json({ ...docs[0], firmas });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Crear documento (admin)
router.post('/', verificarToken, async (req, res) => {
  try {
    if (req.user.rol !== 'admin') return res.status(403).json({ error: 'Solo admin' });
    const { titulo, descripcion, contenido, archivo_base64, archivo_tipo } = req.body;
    if (!titulo) return res.status(400).json({ error: 'Título requerido' });
    if (!contenido && !archivo_base64) return res.status(400).json({ error: 'Falta contenido o archivo' });

    const { rows } = await query(
      `INSERT INTO kaluna_documentos (titulo, descripcion, contenido, archivo_base64, archivo_tipo, creado_por)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, titulo`,
      [titulo, descripcion || '', contenido || '', archivo_base64 || null, archivo_tipo || null, req.user.id]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Firmar documento (cualquier usuario logueado)
router.post('/:id/firmar', verificarToken, async (req, res) => {
  try {
    const { firma, nombre_completo, dni } = req.body;
    if (!firma) return res.status(400).json({ error: 'Firma requerida' });
    if (!nombre_completo) return res.status(400).json({ error: 'Nombre completo requerido' });
    if (!dni) return res.status(400).json({ error: 'DNI requerido' });

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    // Comprobar si ya firmó
    const { rows: existe } = await query(
      "SELECT id FROM kaluna_documento_firmas WHERE documento_id = $1 AND usuario_kaluna_id = $2",
      [req.params.id, req.user.id]
    );
    if (existe.length) return res.status(400).json({ error: 'Ya has firmado este documento' });

    await query(
      `INSERT INTO kaluna_documento_firmas (documento_id, usuario_kaluna_id, nombre_firmante, dni, firma, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [req.params.id, req.user.id, nombre_completo, dni, firma, ip]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Eliminar documento (solo superadmin)
router.delete('/:id', verificarToken, async (req, res) => {
  try {
    if (req.user.id !== 1) return res.status(403).json({ error: 'Solo superadmin' });
    await query("DELETE FROM kaluna_documentos WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
