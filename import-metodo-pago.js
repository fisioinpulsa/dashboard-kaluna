require('dotenv/config');
const fs = require('fs');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { if (inQuotes && line[i+1] === '"') { current += '"'; i++; } else inQuotes = !inQuotes; }
    else if (c === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
    else { current += c; }
  }
  result.push(current.trim());
  return result;
}

async function importar() {
  const csv = fs.readFileSync('/Users/lydia/Downloads/Control Kaluna - Control clientes.csv', 'utf-8');
  const lines = csv.split('\n').slice(1).filter(l => l.trim());

  let count = 0;
  for (const line of lines) {
    const [nombre, , , , , , metodo, col1] = parseCSVLine(line);
    if (!nombre || nombre === 'DEJAR ESPACIO PARA LLEVAR CONTROL') continue;

    let metodoPago = (metodo || '').trim().toLowerCase();
    if (metodoPago === 'domiciliación' || metodoPago === 'domiciliacion') metodoPago = 'domiciliacion';
    else if (metodoPago.includes('efectivo') || metodoPago.includes('tarjeta')) metodoPago = 'efectivo_tarjeta';
    else metodoPago = '';

    // Detectar fianza pagada desde col1
    const notas = (col1 || '').toLowerCase();
    const fianzaPagada = notas.includes('fianza pagada') || notas.includes('fianza pagad');

    const { rowCount } = await pool.query(
      "UPDATE kaluna_clientes SET metodo_pago = $1, fianza_pagada = $2 WHERE LOWER(nombre_completo) = LOWER($3) AND metodo_pago = ''",
      [metodoPago, fianzaPagada, nombre.trim()]
    );
    if (rowCount > 0) count++;
  }

  console.log(`${count} clientes actualizados con método de pago`);

  const { rows } = await pool.query("SELECT metodo_pago, COUNT(*) as total FROM kaluna_clientes WHERE estado='activo' GROUP BY metodo_pago ORDER BY total DESC");
  console.log('\nResumen activos:');
  rows.forEach(r => console.log(`  ${r.metodo_pago || '(sin definir)'}: ${r.total}`));

  await pool.end();
}

importar().catch(console.error);
