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

function normalizar(s) {
  return (s || '').toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

async function importarArchivo(filePath, descripcion) {
  const csv = fs.readFileSync(filePath, 'utf-8');
  const lines = csv.split('\n').slice(1).filter(l => l.trim());

  const { rows: clientes } = await pool.query("SELECT id, nombre_completo FROM kaluna_clientes");

  let actualizados = 0;
  let noEncontrados = [];

  for (const line of lines) {
    const [nombre, iban, direccion, email] = parseCSVLine(line);
    if (!nombre) continue;

    const nombreNorm = normalizar(nombre);
    const cliente = clientes.find(c => {
      const cn = normalizar(c.nombre_completo);
      return cn === nombreNorm || cn.includes(nombreNorm) || nombreNorm.includes(cn);
    });

    if (!cliente) { noEncontrados.push(nombre); continue; }

    const ibanLimpio = (iban === 'falta' || !iban) ? null : iban.replace(/\s/g, '').toUpperCase();
    await pool.query(
      "UPDATE kaluna_clientes SET iban = $1, direccion = $2, email = $3 WHERE id = $4",
      [ibanLimpio, direccion || null, email || null, cliente.id]
    );
    actualizados++;
  }

  console.log(`\n=== ${descripcion} ===`);
  console.log(`✅ ${actualizados} actualizados`);
  if (noEncontrados.length) {
    console.log(`⚠️ No encontrados (${noEncontrados.length}):`);
    noEncontrados.forEach(n => console.log('  - ' + n));
  }
}

async function main() {
  await importarArchivo('/Users/lydia/Downloads/iban_kaluna_0.csv', '1 día/semana');
  await importarArchivo('/Users/lydia/Downloads/iban_2dias.csv', '2 días/semana');
  await importarArchivo('/Users/lydia/Downloads/iban_3dias.csv', '3 días/semana');

  // Resumen final
  const { rows } = await pool.query("SELECT COUNT(*) as total FROM kaluna_clientes WHERE iban IS NOT NULL AND iban != ''");
  console.log(`\n📊 TOTAL clientes con IBAN: ${rows[0].total}`);

  await pool.end();
}

main().catch(console.error);
