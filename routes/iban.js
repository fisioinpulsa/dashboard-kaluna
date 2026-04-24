const router = require('express').Router();
const { query } = require('../db');
const { verificarToken } = require('../middleware/auth');

// Solo superadmin (Lydia, id=1) puede ver/editar
function soloSuperAdmin(req, res, next) {
  if (req.user.rol !== 'admin' || req.user.id !== 1) {
    return res.status(403).json({ error: 'Acceso restringido' });
  }
  next();
}

router.use(verificarToken, soloSuperAdmin);

// Obtener todos los IBANs agrupados por días/semana
router.get('/', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT id, nombre_completo, dni, iban, direccion, email, telefono,
        importe_mensual, dias, horario, dias_semana, metodo_pago,
        CASE
          WHEN LOWER(TRIM(dias)) = 'clase suelta' THEN 'clase_suelta'
          WHEN LOWER(TRIM(dias)) = 'sin fijo' THEN 'sin_fijo'
          ELSE COALESCE(dias_semana::text, '0')
        END as categoria
      FROM kaluna_clientes
      WHERE estado = 'activo' AND metodo_pago = 'domiciliacion'
      ORDER BY dias_semana DESC NULLS LAST, nombre_completo
    `);

    // Agrupar por categoría
    const grupos = {
      '3': { titulo: '3 días/semana', clientes: [] },
      '2': { titulo: '2 días/semana', clientes: [] },
      '1': { titulo: '1 día/semana', clientes: [] },
      'clase_suelta': { titulo: 'Clase suelta', clientes: [] },
      'sin_fijo': { titulo: 'Sin fijo', clientes: [] },
      '0': { titulo: 'Sin frecuencia', clientes: [] }
    };
    rows.forEach(r => {
      if (grupos[r.categoria]) grupos[r.categoria].clientes.push(r);
    });

    res.json(grupos);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Actualizar datos bancarios de un cliente
router.put('/:id', async (req, res) => {
  try {
    const { iban, dni, direccion, email, importe_mensual } = req.body;
    const { rows } = await query(
      `UPDATE kaluna_clientes
       SET iban = $1, dni = $2, direccion = $3, email = $4, importe_mensual = $5
       WHERE id = $6 RETURNING *`,
      [iban || null, dni || null, direccion || null, email || null, importe_mensual || null, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Generar archivo SEPA XML / CSV para remesa bancaria
router.get('/remesa', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT nombre_completo, dni, iban, direccion, importe_mensual, dias_semana
      FROM kaluna_clientes
      WHERE estado = 'activo' AND metodo_pago = 'domiciliacion' AND iban IS NOT NULL AND iban != ''
      ORDER BY dias_semana DESC, nombre_completo
    `);

    let csv = 'Nombre,DNI,IBAN,Dirección,Importe,Días/semana\n';
    rows.forEach(r => {
      csv += `"${r.nombre_completo || ''}","${r.dni || ''}","${r.iban || ''}","${r.direccion || ''}",${r.importe_mensual || 0},${r.dias_semana || 0}\n`;
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="remesa-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send('\ufeff' + csv);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
