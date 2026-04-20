const router = require('express').Router();
const { query } = require('../db');

const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || 'kaluna-meta-2026';
const PAGE_TOKEN = process.env.META_PAGE_TOKEN || '';

// Verificación del webhook (Meta llama una vez con GET)
router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Meta webhook verified');
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// Recepción de leads (Meta llama con POST cuando hay un lead nuevo)
router.post('/', async (req, res) => {
  res.sendStatus(200); // Responder rápido a Meta
  try {
    const body = req.body;
    if (body.object !== 'page') return;

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== 'leadgen') continue;
        const leadId = change.value.leadgen_id;
        if (!leadId || !PAGE_TOKEN) continue;

        // Obtener datos del lead vía Graph API
        const url = `https://graph.facebook.com/v19.0/${leadId}?access_token=${PAGE_TOKEN}`;
        const resp = await fetch(url);
        const lead = await resp.json();
        if (!lead.field_data) continue;

        // Extraer nombre y teléfono
        let nombre = '', telefono = '';
        for (const f of lead.field_data) {
          const v = (f.values && f.values[0]) || '';
          if (f.name === 'full_name' || f.name === 'name') nombre = v;
          if (f.name === 'phone_number' || f.name === 'phone') telefono = v;
        }

        if (!nombre || !telefono) continue;

        // Comprobar si ya existe
        const telNorm = telefono.replace(/[^0-9]/g, '').replace(/^34/, '');
        const { rows: existe } = await query(
          "SELECT id FROM kaluna_leads WHERE REPLACE(REPLACE(telefono, '+', ''), ' ', '') LIKE $1",
          ['%' + telNorm + '%']
        );
        if (existe.length) { console.log('Lead duplicado:', nombre); continue; }

        // Insertar
        await query(
          "INSERT INTO kaluna_leads (nombre, telefono, estado, origen, notas) VALUES ($1, $2, 'nuevo', 'anuncio', $3)",
          [nombre.trim(), telefono.replace('+34', '').trim(), `Meta Ads webhook - ${new Date().toISOString().split('T')[0]}`]
        );
        console.log('Lead nuevo de Meta:', nombre);
      }
    }
  } catch (err) {
    console.error('Meta webhook error:', err.message);
  }
});

module.exports = router;
