const router = require('express').Router();
const { query } = require('../db');
const { verificarToken } = require('../middleware/auth');

router.use(verificarToken);

// Obtener mapa de plazas (calculado desde clientes activos)
router.get('/', async (req, res) => {
  try {
    // Obtener grupos configurados
    const { rows: grupos } = await query("SELECT * FROM kaluna_grupos ORDER BY dia, hora");

    // Obtener clientes activos
    const { rows: clientes } = await query(
      "SELECT id, nombre_completo, dias, horario, horario2 FROM kaluna_clientes WHERE estado = 'activo'"
    );

    // Montar mapa de plazas
    const mapa = grupos.map(g => {
      const ocupantes = clientes.filter(c => {
        const diasCliente = (c.dias || '').toLowerCase();
        const diaGrupo = g.dia.toLowerCase();
        const horaGrupo = g.hora;
        const matchDia = diasCliente.includes(diaGrupo);
        const matchHora = c.horario === horaGrupo || c.horario2 === horaGrupo;
        return matchDia && matchHora;
      });
      return {
        ...g,
        ocupantes,
        ocupadas: ocupantes.length,
        libres: g.max_plazas - ocupantes.length,
        lleno: ocupantes.length >= g.max_plazas
      };
    });

    res.json(mapa);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Crear/editar grupo
router.post('/grupo', async (req, res) => {
  try {
    if (req.user.rol !== 'admin') return res.status(403).json({ error: 'Solo admin' });
    const { nombre, dia, hora, max_plazas } = req.body;
    const { rows } = await query(
      `INSERT INTO kaluna_grupos (nombre, dia, hora, max_plazas)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (nombre) DO UPDATE SET dia=$2, hora=$3, max_plazas=$4
       RETURNING *`,
      [nombre, dia, hora, max_plazas || 5]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/grupo/:id', async (req, res) => {
  try {
    if (req.user.rol !== 'admin') return res.status(403).json({ error: 'Solo admin' });
    await query("DELETE FROM kaluna_grupos WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
