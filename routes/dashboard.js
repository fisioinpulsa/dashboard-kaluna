const router = require('express').Router();
const { query } = require('../db');
const { verificarToken } = require('../middleware/auth');

router.use(verificarToken);

router.get('/', async (req, res) => {
  try {
    const [clientes, bajas, leads, ventas, espera, pruebas, plazas] = await Promise.all([
      query("SELECT COUNT(*) as total FROM kaluna_clientes WHERE estado = 'activo'"),
      query("SELECT COUNT(*) as total FROM kaluna_clientes WHERE estado = 'baja'"),
      query(`SELECT estado, COUNT(*) as total FROM kaluna_leads GROUP BY estado`),
      query(`SELECT SUM(precio) as total, COUNT(*) as num
             FROM kaluna_ventas
             WHERE EXTRACT(MONTH FROM fecha) = EXTRACT(MONTH FROM NOW())
             AND EXTRACT(YEAR FROM fecha) = EXTRACT(YEAR FROM NOW())`),
      query("SELECT COUNT(*) as total FROM kaluna_lista_espera WHERE estado = 'esperando'"),
      query("SELECT COUNT(*) as total FROM kaluna_clases_prueba WHERE fecha >= CURRENT_DATE"),
      query("SELECT COUNT(*) as total, SUM(max_plazas) as max_total FROM kaluna_grupos")
    ]);

    // Clientes por día de la semana
    const { rows: clientesPorDia } = await query(`
      SELECT dias, COUNT(*) as total FROM kaluna_clientes WHERE estado = 'activo' GROUP BY dias
    `);

    // Ventas últimos 6 meses
    const { rows: ventasMeses } = await query(`
      SELECT EXTRACT(MONTH FROM fecha) as mes, EXTRACT(YEAR FROM fecha) as año,
             SUM(precio) as total, COUNT(*) as num
      FROM kaluna_ventas
      WHERE fecha >= NOW() - INTERVAL '6 months'
      GROUP BY EXTRACT(YEAR FROM fecha), EXTRACT(MONTH FROM fecha)
      ORDER BY año, mes
    `);

    res.json({
      clientes_activos: parseInt(clientes.rows[0].total),
      clientes_baja: parseInt(bajas.rows[0].total),
      leads_por_estado: leads.rows,
      ventas_mes: { total: parseFloat(ventas.rows[0].total || 0), num: parseInt(ventas.rows[0].num || 0) },
      lista_espera: parseInt(espera.rows[0].total),
      proximas_pruebas: parseInt(pruebas.rows[0].total),
      total_grupos: parseInt(plazas.rows[0].total || 0),
      clientes_por_dia: clientesPorDia,
      ventas_meses: ventasMeses
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
