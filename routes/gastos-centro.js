const router = require('express').Router();
const { query } = require('../db');
const { verificarToken } = require('../middleware/auth');

router.use(verificarToken);

// Solo admin (superadmin y admin) — no trabajadoras
function soloAdminOColab(req, res, next) {
  if (req.user.rol !== 'admin' && req.user.rol !== 'colaboradora') return res.status(403).json({ error: 'Solo admin o colaboradora' });
  next();
}
router.use(soloAdminOColab);

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
       ORDER BY g.orden NULLS LAST, g.id`,
      [mes, anio]
    );
    const totalPresupuesto = rows.reduce((s, g) => s + parseFloat(g.importe || 0), 0);
    const totalReal = rows.reduce((s, g) => s + parseFloat(g.importe_real || 0), 0);
    const diferencia = totalPresupuesto - totalReal;
    res.json({
      gastos: rows,
      total: totalPresupuesto.toFixed(2),
      total_real: totalReal.toFixed(2),
      diferencia: diferencia.toFixed(2),
      mes, anio
    });
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
    const { concepto, importe, mes, anio, recurrente, categoria, notas, orden, importe_real } = req.body;
    if (!concepto || importe === undefined) return res.status(400).json({ error: 'Faltan datos' });
    const now = new Date();
    const m = mes || (now.getMonth() + 1);
    const a = anio || now.getFullYear();
    // Si no se pasa orden, lo ponemos como el siguiente disponible (excluyendo reserva con 999)
    let ord = orden;
    if (ord === undefined || ord === null) {
      const r = await query('SELECT COALESCE(MAX(orden),0)+1 as nxt FROM kaluna_gastos_centro WHERE mes=$1 AND anio=$2 AND orden < 900', [m, a]);
      ord = parseInt(r.rows[0].nxt);
    }
    const { rows } = await query(
      `INSERT INTO kaluna_gastos_centro (concepto, importe, mes, anio, recurrente, categoria, notas, orden, importe_real, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [concepto, importe, m, a, recurrente !== false, categoria || 'fijo', notas || null, ord, importe_real || null, req.user.id]
    );
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT editar gasto completo
router.put('/:id', async (req, res) => {
  try {
    const { concepto, importe, recurrente, categoria, notas, orden, importe_real } = req.body;
    const { rows } = await query(
      `UPDATE kaluna_gastos_centro
       SET concepto=$1, importe=$2, recurrente=$3, categoria=$4, notas=$5,
           orden=COALESCE($6, orden), importe_real=$7, updated_at=now()
       WHERE id=$8 RETURNING *`,
      [concepto, importe, recurrente !== false, categoria || 'fijo', notas || null,
       (orden === undefined || orden === null || orden === '') ? null : parseInt(orden),
       (importe_real === undefined || importe_real === null || importe_real === '') ? null : parseFloat(importe_real),
       req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'No encontrado' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH actualizar solo importe_real (edición rápida inline)
router.patch('/:id/real', async (req, res) => {
  try {
    const { importe_real } = req.body;
    const val = (importe_real === '' || importe_real === null || importe_real === undefined) ? null : parseFloat(importe_real);
    if (val !== null && (isNaN(val) || val < 0)) return res.status(400).json({ error: 'Importe inválido' });
    const { rows } = await query(
      `UPDATE kaluna_gastos_centro SET importe_real=$1, updated_at=now() WHERE id=$2 RETURNING *`,
      [val, req.params.id]
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
