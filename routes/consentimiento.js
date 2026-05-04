const router = require('express').Router();
const { query } = require('../db');
const { verificarToken } = require('../middleware/auth');

router.use(verificarToken);

// GET estado: ¿necesita firmar?
router.get('/estado', async (req, res) => {
  try {
    const r = await query(
      'SELECT consentimiento_firmado_at FROM kaluna_usuarios WHERE id=$1',
      [req.user.id]
    );
    res.json({ firmado: !!r.rows[0]?.consentimiento_firmado_at });
  } catch (e) {
    console.error('consent estado error', e);
    res.status(500).json({ error: 'Error' });
  }
});

// POST firmar
router.post('/firmar', async (req, res) => {
  try {
    const { nombre_completo, dni, firma_data } = req.body;
    if (!nombre_completo || !firma_data) {
      return res.status(400).json({ error: 'Faltan datos' });
    }
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().slice(0, 100);
    const ua = (req.headers['user-agent'] || '').toString().slice(0, 300);
    await query(
      `INSERT INTO kaluna_consentimientos_trabajadoras
       (usuario_id, nombre_completo, dni, firma_data, ip_origen, user_agent)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [req.user.id, nombre_completo.trim(), (dni || '').trim() || null, firma_data, ip, ua]
    );
    await query(
      'UPDATE kaluna_usuarios SET consentimiento_firmado_at=now() WHERE id=$1',
      [req.user.id]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('consent firmar error', e);
    res.status(500).json({ error: 'Error al guardar consentimiento' });
  }
});

// GET lista (solo superadmin)
router.get('/', async (req, res) => {
  if (req.user.id !== 1) return res.status(403).json({ error: 'No autorizado' });
  try {
    const r = await query(`
      SELECT c.id, c.usuario_id, u.nombre as usuario, c.nombre_completo, c.dni,
             c.firmado_at, c.version_texto, c.ip_origen
      FROM kaluna_consentimientos_trabajadoras c
      JOIN kaluna_usuarios u ON u.id = c.usuario_id
      ORDER BY c.firmado_at DESC
    `);
    res.json(r.rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error' });
  }
});

// GET firma individual (solo superadmin)
router.get('/:id', async (req, res) => {
  if (req.user.id !== 1) return res.status(403).json({ error: 'No autorizado' });
  try {
    const r = await query(
      'SELECT * FROM kaluna_consentimientos_trabajadoras WHERE id=$1',
      [req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'No encontrado' });
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: 'Error' });
  }
});

module.exports = router;
