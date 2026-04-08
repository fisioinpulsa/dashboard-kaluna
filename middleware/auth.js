const jwt = require('jsonwebtoken');

function verificarToken(req, res, next) {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ error: 'No autenticado' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
}

function soloAdmin(req, res, next) {
  if (req.user?.rol !== 'admin') return res.status(403).json({ error: 'Solo admin' });
  next();
}

module.exports = { verificarToken, soloAdmin };
