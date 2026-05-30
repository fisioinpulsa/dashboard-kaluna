const router = require('express').Router();
const { query } = require('../db');
const { verificarToken } = require('../middleware/auth');

router.use(verificarToken);

// Solo admin (superadmin y admin) — no trabajadoras
function soloAdmin(req, res, next) {
  if (req.user.rol !== 'admin') return res.status(403).json({ error: 'Solo admin' });
  next();
}
router.use(soloAdmin);

// GET listar por mes/año
router.get('/', async (req, res) => {
  try {
    const now = new Date();
    const mes = parseInt(req.query.mes) || (now.getMonth() + 1);
    const anio = parseInt(req.query.anio) || now.getFullYear();
    const { rows } = await query(
      `SELECT g.*, u.nombre as creado_por
       FROM kaluna_gastos_centro g
       LEFT JOIN kaluna_usuarios u ON u.id = g.created_by
       WHERE g.mes = $1 AND g.anio = $2
       ORDER BY g.categoria, g.concepto`,
      [mes, anio]
    );
    const total = rows.reduce((s, g) => s + parseFloat(g.importe || 0), 0);
    res.json({ gastos: rows, total: total.toFixed(2), mes, anio });
  } catch (e) {
    console.error('gastos-centro list', e);
    res.status(500).json({ error: e.message });
  }
});

// GET histórico (todos los meses)
router.get('/historico', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT anio, mes, COUNT(*) as num, SUM(importe) as total
       FROM kaluna_gastos_centro
       GROUP BY anio, mes
       ORDER BY anio DESC, mes DESC`
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST crear gasto
router.post('/', async (req, res) => {
  try {
    const { concepto, importe, mes, anio, recurrente, categoria, notas } = req.body;
    if (!concepto || importe === undefined) return res.status(400).json({ error: 'Faltan datos' });
    const now = new Date();
    const m = mes || (now.getMonth() + 1);
    const a = anio || now.getFullYear();
    const { rows } = await query(
      `INSERT INTO kaluna_gastos_centro (concepto, importe, mes, anio, recurrente, categoria, notas, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [concepto, importe, m, a, recurrente !== false, categoria || 'fijo', notas || null, req.user.id]
    );
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT editar gasto
router.put('/:id', async (req, res) => {
  try {
    const { concepto, importe, recurrente, categoria, notas } = req.body;
    const { rows } = await query(
      `UPDATE kaluna_gastos_centro SET concepto=$1, importe=$2, recurrente=$3, categoria=$4, notas=$5, updated_at=now()
       WHERE id=$6 RETURNING *`,
      [concepto, importe, recurrente !== false, categoria || 'fijo', notas || null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'No encontrado' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE solo superadmin (id=1)
router.delete('/:id', async (req, res) => {
  if (req.user.id !== 1) return res.status(403).json({ error: 'Solo superadmin puede eliminar' });
  try {
    await query('DELETE FROM kaluna_gastos_centro WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST duplicar gastos recurrentes del mes anterior al mes actual
router.post('/duplicar-mes', async (req, res) => {
  try {
    const { desde_mes, desde_anio, hacia_mes, hacia_anio } = req.body;
    if (!desde_mes || !desde_anio || !hacia_mes || !hacia_anio) {
      return res.status(400).json({ error: 'Faltan datos de mes/año' });
    }
    // Comprobar si ya hay gastos ese mes
    const existe = await query(
      'SELECT COUNT(*) as c FROM kaluna_gastos_centro WHERE mes=$1 AND anio=$2',
      [hacia_mes, hacia_anio]
    );
    if (parseInt(existe.rows[0].c) > 0) {
      return res.status(400).json({ error: 'Ese mes ya tiene gastos. Bórralos antes o edita los existentes.' });
    }
    const { rows: origen } = await query(
      `SELECT concepto, importe, categoria, recurrente, notas FROM kaluna_gastos_centro
       WHERE mes=$1 AND anio=$2 AND recurrente=true`,
      [desde_mes, desde_anio]
    );
    if (!origen.length) return res.status(404).json({ error: 'Sin gastos recurrentes en ese mes origen' });
    for (const g of origen) {
      await query(
        `INSERT INTO kaluna_gastos_centro (concepto, importe, mes, anio, recurrente, categoria, notas, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [g.concepto, g.importe, hacia_mes, hacia_anio, true, g.categoria, g.notas, req.user.id]
      );
    }
    res.json({ ok: true, copiados: origen.length });
  } catch (e) {
    console.error('duplicar', e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
