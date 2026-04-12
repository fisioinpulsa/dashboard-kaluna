const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { query } = require('../db');

// Login por PIN (tabla usuarios del fichaje)
router.post('/login', async (req, res) => {
  try {
    const { pin } = req.body;
    if (!pin) return res.status(400).json({ error: 'PIN requerido' });

    const { rows } = await query("SELECT * FROM usuarios WHERE rol = 'empleado' AND activo = 1");
    let user = null;
    for (const u of rows) {
      if (u.pin && bcrypt.compareSync(pin, u.pin)) { user = u; break; }
    }
    if (!user) return res.status(401).json({ error: 'PIN incorrecto' });

    const token = jwt.sign(
      { id: user.id, nombre: `${user.nombre} ${user.apellidos}`, rol: 'fichaje' },
      process.env.JWT_SECRET, { expiresIn: '12h' }
    );
    res.cookie('fichaje_token', token, { httpOnly: true, sameSite: 'lax', maxAge: 43200000 });
    res.json({ nombre: `${user.nombre} ${user.apellidos}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('fichaje_token');
  res.json({ ok: true });
});

// Middleware auth fichaje
function authFichaje(req, res, next) {
  const token = req.cookies?.fichaje_token;
  if (!token) return res.status(401).json({ error: 'No autenticado' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch { res.status(401).json({ error: 'Sesión expirada' }); }
}

// Estado actual
router.get('/estado', authFichaje, async (req, res) => {
  try {
    const hoy = new Date().toISOString().split('T')[0];
    const { rows } = await query(
      "SELECT * FROM fichajes WHERE usuario_id = $1 AND fecha = $2 ORDER BY hora DESC LIMIT 1",
      [req.user.id, hoy]
    );
    const ultimo = rows[0];
    res.json({
      nombre: req.user.nombre,
      trabajando: ultimo?.tipo === 'entrada',
      ultimo: ultimo || null
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Fichajes de hoy
router.get('/hoy', authFichaje, async (req, res) => {
  try {
    const hoy = new Date().toISOString().split('T')[0];
    const { rows } = await query(
      "SELECT tipo, hora, firma FROM fichajes WHERE usuario_id = $1 AND fecha = $2 ORDER BY hora ASC",
      [req.user.id, hoy]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Registrar fichaje
router.post('/registrar', authFichaje, async (req, res) => {
  try {
    const { tipo, firma } = req.body;
    const now = new Date();
    const fecha = now.toISOString().split('T')[0];
    const hora = now.toTimeString().split(' ')[0];

    // Generar hash de integridad
    const datos = { usuario_id: req.user.id, tipo, fecha, hora };
    const hash = crypto.createHash('sha256').update(JSON.stringify(datos)).digest('hex');

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const ua = req.headers['user-agent'];

    const { rows } = await query(
      `INSERT INTO fichajes (usuario_id, tipo, fecha, hora, firma, ip_address, user_agent, hash_integridad)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.user.id, tipo, fecha, hora, firma || null, ip, ua, hash]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// === ADMIN: consultar fichajes (usa auth del dashboard, no del fichaje) ===
const { verificarToken, soloAdmin } = require('../middleware/auth');

// Lista empleados del fichaje
router.get('/admin/empleados', verificarToken, soloAdmin, async (req, res) => {
  try {
    const { rows } = await query("SELECT id, nombre, apellidos FROM usuarios WHERE rol = 'empleado' AND activo = 1 ORDER BY nombre");
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Consultar fichajes filtrados
router.get('/admin/registros', verificarToken, soloAdmin, async (req, res) => {
  try {
    const { usuario_id, mes, año } = req.query;
    let sql = `SELECT f.*, u.nombre || ' ' || u.apellidos as empleado_nombre
               FROM fichajes f LEFT JOIN usuarios u ON f.usuario_id = u.id`;
    const params = [];
    const conds = [];

    if (usuario_id) { conds.push(`f.usuario_id = $${params.length + 1}`); params.push(usuario_id); }
    if (mes && año) {
      conds.push(`EXTRACT(MONTH FROM f.fecha) = $${params.length + 1}`); params.push(mes);
      conds.push(`EXTRACT(YEAR FROM f.fecha) = $${params.length + 1}`); params.push(año);
    }

    if (conds.length) sql += ' WHERE ' + conds.join(' AND ');
    sql += ' ORDER BY f.fecha DESC, f.hora DESC LIMIT 200';

    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
