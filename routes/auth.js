const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../db');
const { verificarToken } = require('../middleware/auth');

// Login admin (email + password)
router.post('/login', async (req, res) => {
  try {
    const { email, password, pin } = req.body;

    if (pin) {
      // Login trabajadora por PIN
      const { rows } = await query(
        "SELECT * FROM kaluna_usuarios WHERE pin = $1 AND activo = true AND rol = 'trabajadora'",
        [pin]
      );
      if (rows.length === 0) return res.status(401).json({ error: 'PIN incorrecto' });
      const user = rows[0];
      const token = jwt.sign({ id: user.id, nombre: user.nombre, rol: user.rol }, process.env.JWT_SECRET, { expiresIn: '24h' });
      res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 86400000 });
      return res.json({ nombre: user.nombre, rol: user.rol });
    }

    if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });

    const { rows } = await query("SELECT * FROM kaluna_usuarios WHERE email = $1 AND activo = true", [email]);
    if (rows.length === 0) return res.status(401).json({ error: 'Credenciales incorrectas' });

    const user = rows[0];
    if (!bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: 'Credenciales incorrectas' });

    const token = jwt.sign({ id: user.id, nombre: user.nombre, rol: user.rol }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 86400000 });
    res.json({ nombre: user.nombre, rol: user.rol });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/me', verificarToken, (req, res) => {
  res.json(req.user);
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

// Gestión trabajadoras (solo admin)
router.get('/trabajadoras', verificarToken, async (req, res) => {
  try {
    const { rows } = await query("SELECT id, nombre, pin, rol, activo FROM kaluna_usuarios ORDER BY nombre");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/trabajadoras', verificarToken, async (req, res) => {
  try {
    if (req.user.rol !== 'admin') return res.status(403).json({ error: 'Solo admin' });
    const { nombre, pin } = req.body;
    const { rows } = await query(
      "INSERT INTO kaluna_usuarios (nombre, pin, rol) VALUES ($1, $2, 'trabajadora') RETURNING id, nombre, pin",
      [nombre, pin]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/password', verificarToken, async (req, res) => {
  try {
    const hash = bcrypt.hashSync(req.body.password, 10);
    await query("UPDATE kaluna_usuarios SET password = $1 WHERE id = $2", [hash, req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
