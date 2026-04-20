const router = require('express').Router();
const { query } = require('../db');
const { verificarToken } = require('../middleware/auth');

router.use(verificarToken);

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

function normalizarTel(tel) {
  if (!tel) return '';
  return tel.replace(/[^0-9]/g, '').replace(/^34/, '');
}

// POST /api/import-csv/meta-leads - Body: { csv: "..." }
router.post('/meta-leads', async (req, res) => {
  try {
    const { csv } = req.body;
    if (!csv) return res.status(400).json({ error: 'Falta CSV' });

    const lines = csv.split('\n').slice(1).filter(l => l.trim());

    // Obtener teléfonos existentes
    const { rows: existentes } = await query("SELECT telefono FROM kaluna_leads WHERE telefono IS NOT NULL");
    const telefonosExistentes = new Set(existentes.map(r => normalizarTel(r.telefono)));

    let nuevos = 0;
    let duplicados = 0;
    const nuevosNombres = [];

    for (const line of lines) {
      const cols = parseCSVLine(line);
      const fecha = cols[0];
      const nombre = cols[1];
      const telefono = cols[9] || cols[11] || '';

      if (!nombre || !telefono) continue;

      const telNorm = normalizarTel(telefono);
      if (telefonosExistentes.has(telNorm)) { duplicados++; continue; }

      await query(
        "INSERT INTO kaluna_leads (nombre, telefono, estado, origen, notas) VALUES ($1, $2, 'nuevo', 'anuncio', $3)",
        [nombre.trim(), telefono.replace('+34', '').trim(), `Meta Ads - ${fecha}`]
      );
      telefonosExistentes.add(telNorm);
      nuevos++;
      nuevosNombres.push(nombre);
    }

    res.json({ nuevos, duplicados, nuevosNombres });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
