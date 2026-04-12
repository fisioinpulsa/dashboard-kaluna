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
  // Importar lista de espera
  const csv1 = fs.readFileSync('/Users/lydia/Downloads/espera.csv', 'utf-8');
  const lines1 = csv1.split('\n').slice(1).filter(l => l.trim());
  await pool.query('DELETE FROM kaluna_lista_espera');
  let count1 = 0;
  for (const line of lines1) {
    const [trabajadora, nombre, fecha, horario, dias, notas] = parseCSVLine(line);
    if (!nombre) continue;
    let fechaSQL = null;
    if (fecha) {
      const parts = fecha.split('/');
      if (parts.length >= 2) {
        const d = parts[0].padStart(2, '0');
        const m = parts[1].padStart(2, '0');
        const y = parts[2] || '2026';
        fechaSQL = `${y}-${m}-${d}`;
      }
    }
    await pool.query(
      "INSERT INTO kaluna_lista_espera (nombre, fecha, horario_deseado, dias, notas) VALUES ($1,$2,$3,$4,$5)",
      [nombre.trim(), fechaSQL, (horario || '').trim(), (dias || '').trim(), (notas || '').trim()]
    );
    count1++;
  }
  console.log(`${count1} entradas de lista de espera importadas`);

  // Importar contactos clase como leads con origen 'clase'
  const csv2 = fs.readFileSync('/Users/lydia/Downloads/contactos_clase.csv', 'utf-8');
  const lines2 = csv2.split('\n').slice(1).filter(l => l.trim());
  let count2 = 0;
  for (const line of lines2) {
    const [nombre, telefono, horario, notas] = parseCSVLine(line);
    if (!nombre) continue;
    // Check if already exists
    const { rows } = await pool.query("SELECT id FROM kaluna_leads WHERE nombre = $1 AND telefono = $2", [nombre.trim(), (telefono||'').trim()]);
    if (rows.length) continue;
    await pool.query(
      "INSERT INTO kaluna_leads (nombre, telefono, estado, origen, horario_preferencia, notas) VALUES ($1,$2,'agendada','clase',$3,$4)",
      [nombre.trim(), (telefono||'').trim(), (horario||'').trim(), (notas||'').trim()]
    );
    count2++;
  }
  console.log(`${count2} contactos de clase añadidos a leads`);

  await pool.end();
}

importar().catch(console.error);
