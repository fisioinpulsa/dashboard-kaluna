require('dotenv/config');
const fs = require('fs');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function importar() {
  const csv = fs.readFileSync('/Users/lydia/Downloads/Control Kaluna - contactos anuncio.csv', 'utf-8');
  const lines = csv.split('\n').slice(1); // skip header

  // Map estados del Excel a los del dashboard
  const mapEstado = (e) => {
    if (!e) return 'nuevo';
    const el = e.trim().toLowerCase();
    if (el === 'agendada') return 'agendada';
    if (el.includes('sin respuesta')) return 'contactado_sin_respuesta';
    if (el.includes('espera')) return 'contactado_a_espera';
    if (el === 'no agenda') return 'no_agenda';
    if (el === 'no existe') return 'no_agenda';
    if (el === 'convertido' || el === 'convertida') return 'convertido';
    return 'nuevo';
  };

  // Parse CSV (handle commas inside quotes)
  function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { inQuotes = !inQuotes; }
      else if (c === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
      else { current += c; }
    }
    result.push(current.trim());
    return result;
  }

  // Borrar leads actuales
  await pool.query('DELETE FROM kaluna_leads');
  console.log('Leads borrados');

  let count = 0;
  for (const line of lines) {
    if (!line.trim()) continue;
    const [nombre, telefono, estado, trabajadora, notas] = parseCSVLine(line);
    if (!nombre || !nombre.trim()) continue;

    await pool.query(
      `INSERT INTO kaluna_leads (nombre, telefono, estado, notas, origen)
       VALUES ($1, $2, $3, $4, 'anuncio')`,
      [nombre.trim(), telefono?.trim() || null, mapEstado(estado), notas?.trim() || null]
    );
    count++;
  }

  console.log(`${count} leads importados`);
  await pool.end();
}

importar().catch(console.error);
