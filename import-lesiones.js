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
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    }
    else if (c === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
    else { current += c; }
  }
  result.push(current.trim());
  return result;
}

async function importar() {
  const csv = fs.readFileSync('/Users/lydia/Downloads/Control Kaluna - Control lesiones.csv', 'utf-8');
  const lines = csv.split('\n').slice(1).filter(l => l.trim());

  await pool.query('DELETE FROM kaluna_lesiones');

  // El CSV tiene múltiples filas por paciente (una por cada ejercicio/nota)
  // Necesitamos agrupar por paciente
  const pacientes = {};
  let currentName = null;

  for (const line of lines) {
    const [nombre, fecha, ejercicio, notaMaria, notaAlessandra] = parseCSVLine(line);

    if (nombre && nombre.trim()) {
      currentName = nombre.trim();
      if (!pacientes[currentName]) {
        pacientes[currentName] = { fecha: fecha || null, ejercicios: [], notasMaria: [], notasAlessandra: [] };
      }
    }

    if (!currentName) continue;

    if (ejercicio && ejercicio.trim()) {
      pacientes[currentName].ejercicios.push(ejercicio.trim());
    }
    if (notaMaria && notaMaria.trim()) {
      pacientes[currentName].notasMaria.push(notaMaria.trim());
    }
    if (notaAlessandra && notaAlessandra.trim()) {
      pacientes[currentName].notasAlessandra.push(notaAlessandra.trim());
    }
  }

  let count = 0;
  for (const [nombre, data] of Object.entries(pacientes)) {
    const fechaVal = data.fecha ? data.fecha.split('/').reverse().join('-') : null;
    // Validate date
    let fechaSQL = null;
    if (fechaVal) {
      try {
        const d = new Date(fechaVal);
        if (!isNaN(d.getTime())) fechaSQL = fechaVal;
      } catch {}
    }

    await pool.query(
      `INSERT INTO kaluna_lesiones (cliente_nombre, fecha, ejercicios_no_recomendados, notas_pilates, notas_fisio)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        nombre,
        fechaSQL,
        data.ejercicios.join('\n'),
        data.notasAlessandra.join('\n'),
        data.notasMaria.join('\n')
      ]
    );
    count++;
  }

  console.log(`${count} fichas de lesiones importadas`);
  for (const [nombre, data] of Object.entries(pacientes)) {
    console.log(`  ${nombre}: ${data.ejercicios.length} ejercicios, ${data.notasMaria.length} notas fisio, ${data.notasAlessandra.length} notas pilates`);
  }
  await pool.end();
}

importar().catch(console.error);
