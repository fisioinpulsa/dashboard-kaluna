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

  // Agrupar por grupo
  const grupos = {};
  for (const line of lines) {
    const [grupo, nombre] = parseCSVLine(line);
    if (!grupo) continue;
    if (!grupos[grupo]) grupos[grupo] = { nombres: [], vacios: 0, total: 0 };
    grupos[grupo].total++;
    if (nombre === 'VACIO' || nombre === 'CLASE DE PRUEBA' || !nombre) {
      grupos[grupo].vacios++;
    } else {
      grupos[grupo].nombres.push(nombre);
    }
  }

  // Recrear grupos
  await pool.query('DELETE FROM kaluna_grupos');
  console.log('Grupos borrados');

  for (const [nombre, data] of Object.entries(grupos)) {
    // Extraer dia y hora del nombre del grupo (ej: "Lunes 9" -> dia=Lunes, hora=9:00)
    const parts = nombre.split(' ');
    const dia = parts[0] === 'Miercoles' ? 'Miércoles' : parts[0];
    const hora = parts[1] + ':00';
    const max = data.total;

    await pool.query(
      `INSERT INTO kaluna_grupos (nombre, dia, hora, max_plazas)
       VALUES ($1, $2, $3, $4) ON CONFLICT (nombre) DO UPDATE SET dia=$2, hora=$3, max_plazas=$4`,
      [nombre.replace('Miercoles', 'Miércoles'), dia, hora, max]
    );
    console.log(`  ${dia} ${hora}: ${data.nombres.length}/${max} (${data.vacios} vacíos)`);
  }

  // Verificar clientes faltantes
  const { rows: clientes } = await pool.query("SELECT nombre_completo FROM kaluna_clientes");
  const clienteNames = new Set(clientes.map(c => c.nombre_completo.toLowerCase()));

  const allNombres = new Set();
  for (const data of Object.values(grupos)) {
    data.nombres.forEach(n => allNombres.add(n));
  }

  console.log('\n--- Personas en plazas que NO están en clientes ---');
  let missing = 0;
  for (const nombre of allNombres) {
    if (!clienteNames.has(nombre.toLowerCase())) {
      console.log(`  FALTA: ${nombre}`);
      missing++;
    }
  }
  console.log(`Total faltantes: ${missing}`);

  console.log(`\nTotal grupos: ${Object.keys(grupos).length}`);
  await pool.end();
}

importar().catch(console.error);
