const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function query(text, params) {
  const res = await pool.query(text, params);
  return res;
}

async function crearAdminInicial() {
  const { rows } = await query("SELECT id FROM kaluna_usuarios WHERE rol = 'admin'");
  if (rows.length === 0) {
    const hash = bcrypt.hashSync('admin1234', 10);
    await query(
      "INSERT INTO kaluna_usuarios (nombre, email, password, rol) VALUES ($1, $2, $3, 'admin')",
      ['Lydia', 'admin@kaluna.es', hash]
    );
    console.log('Admin creado: admin@kaluna.es / admin1234');
  }
}

async function crearTrabajadoraInicial() {
  const { rows } = await query("SELECT id FROM kaluna_usuarios WHERE rol = 'trabajadora'");
  if (rows.length === 0) {
    await query(
      "INSERT INTO kaluna_usuarios (nombre, pin, rol) VALUES ($1, $2, 'trabajadora')",
      ['Paloma', '1234']
    );
    console.log('Trabajadora Paloma creada con PIN: 1234');
  }
}

module.exports = { query, pool, crearAdminInicial, crearTrabajadoraInicial };
