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
  const csv = fs.readFileSync('/Users/lydia/Downloads/ventas.csv', 'utf-8');
  const lines = csv.split('\n').slice(1).filter(l => l.trim());

  // Obtener trabajadoras
  const { rows: trabajadoras } = await pool.query("SELECT id, nombre FROM kaluna_usuarios");
  const mapTrabajadora = {};
  trabajadoras.forEach(t => mapTrabajadora[t.nombre.toLowerCase()] = t.id);

  // Borrar ventas existentes
  await pool.query('DELETE FROM kaluna_ventas');
  console.log('Ventas borradas');

  let count = 0;
  let skipped = 0;

  for (const line of lines) {
    const [trabajadora, cliente, fecha, articulo, precio, metodo, notas] = parseCSVLine(line);

    // Skip separadores (ENERO, FEBRERO, MARZO, ABRIL, etc.)
    if (!cliente || cliente.trim() === '' || cliente === 'Nombre del cliente') { skipped++; continue; }
    if (['ENERO','FEBRERO','MARZO','ABRIL','MAYO'].includes(cliente.toUpperCase())) { skipped++; continue; }

    // Parse fecha (d/mm/yyyy)
    let fechaSQL = null;
    if (fecha) {
      const parts = fecha.split('/');
      if (parts.length === 3) {
        const d = parts[0].padStart(2, '0');
        const m = parts[1].padStart(2, '0');
        const y = parts[2];
        fechaSQL = `${y}-${m}-${d}`;
      }
    }

    // Solo 2026
    if (fechaSQL && !fechaSQL.startsWith('2026') && !fechaSQL.startsWith('2025')) { skipped++; continue; }

    // Parse precio (quitar €, espacios, convertir coma a punto)
    let precioNum = 0;
    if (precio) {
      const clean = precio.replace(/[€\s]/g, '').replace(',', '.');
      precioNum = parseFloat(clean) || 0;
    }

    // Buscar trabajadora
    const trabNombre = (trabajadora || '').trim().toLowerCase();
    let trabId = mapTrabajadora[trabNombre] || mapTrabajadora['paloma'] || 2; // Default Paloma

    await pool.query(
      `INSERT INTO kaluna_ventas (trabajadora_id, cliente_nombre, fecha, articulo, precio, metodo_pago, notas)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [trabId, cliente.trim(), fechaSQL, (articulo || '').trim(), precioNum, (metodo || '').trim(), (notas || '').trim()]
    );
    count++;
  }

  console.log(`${count} ventas importadas (${skipped} líneas saltadas)`);

  // Resumen por mes
  const { rows: resumen } = await pool.query(`
    SELECT EXTRACT(MONTH FROM fecha) as mes, EXTRACT(YEAR FROM fecha) as año,
           COUNT(*) as total, SUM(precio) as suma
    FROM kaluna_ventas
    WHERE fecha IS NOT NULL
    GROUP BY EXTRACT(YEAR FROM fecha), EXTRACT(MONTH FROM fecha)
    ORDER BY año, mes
  `);
  console.log('\nResumen:');
  const meses = ['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  resumen.forEach(r => console.log(`  ${meses[r.mes]} ${r.año}: ${r.total} ventas, ${parseFloat(r.suma).toFixed(2)}€`));

  await pool.end();
}

importar().catch(console.error);
