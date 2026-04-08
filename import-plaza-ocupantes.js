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
    if (c === '"') { inQuotes = !inQuotes; }
    else if (c === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
    else { current += c; }
  }
  result.push(current.trim());
  return result;
}

async function importar() {
  const csv = fs.readFileSync('/Users/lydia/Downloads/Control Kaluna - Control plazas.csv', 'utf-8');
  const lines = csv.split('\n').slice(1).filter(l => l.trim());

  // Borrar asignaciones anteriores
  await pool.query('DELETE FROM kaluna_plaza_ocupantes');

  // Obtener grupos
  const { rows: grupos } = await pool.query('SELECT id, nombre FROM kaluna_grupos');
  const grupoMap = {};
  grupos.forEach(g => grupoMap[g.nombre] = g.id);

  let count = 0;
  for (const line of lines) {
    const [grupo, nombre] = parseCSVLine(line);
    if (!grupo || !nombre) continue;

    // Normalizar nombre del grupo (Miercoles -> Miércoles)
    const grupoNorm = grupo.replace('Miercoles', 'Miércoles');
    const grupoId = grupoMap[grupoNorm];

    if (!grupoId) {
      console.log(`  Grupo no encontrado: ${grupo} -> ${grupoNorm}`);
      continue;
    }

    const esVacio = nombre === 'VACIO' || nombre === 'CLASE DE PRUEBA';

    await pool.query(
      'INSERT INTO kaluna_plaza_ocupantes (grupo_id, nombre, es_vacio) VALUES ($1, $2, $3)',
      [grupoId, nombre, esVacio]
    );
    count++;
  }

  console.log(`${count} asignaciones importadas`);
  await pool.end();
}

importar().catch(console.error);
