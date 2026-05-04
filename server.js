require('dotenv/config');
const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const { crearAdminInicial, crearTrabajadoraInicial } = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/clientes', require('./routes/clientes'));
app.use('/api/leads', require('./routes/leads'));
app.use('/api/ventas', require('./routes/ventas'));
app.use('/api/caja', require('./routes/caja'));
app.use('/api/espera', require('./routes/espera'));
app.use('/api/plazas', require('./routes/plazas'));
app.use('/api/pruebas', require('./routes/pruebas'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/avisos', require('./routes/avisos'));
app.use('/api/diario', require('./routes/diario'));
app.use('/api/lesiones', require('./routes/lesiones'));
app.use('/api/cambios', require('./routes/cambios'));
app.use('/api/fichaje', require('./routes/fichaje'));
app.use('/api/actividad', require('./routes/actividad'));
app.use('/api/meta-webhook', require('./routes/meta-webhook'));
app.use('/api/import-csv', require('./routes/import-csv'));
app.use('/api/documentos', require('./routes/documentos'));
app.use('/api/iban', require('./routes/iban'));
app.use('/api/gastos', require('./routes/gastos'));
app.use('/api/pagos-centro', require('./routes/pagos-centro'));
app.use('/api/consentimiento', require('./routes/consentimiento'));

// Pages
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));
app.get('/fichaje', (req, res) => res.sendFile(path.join(__dirname, 'public', 'fichaje.html')));

async function start() {
  await crearAdminInicial();
  await crearTrabajadoraInicial();
  app.listen(PORT, () => console.log(`Dashboard Kalüna en http://localhost:${PORT}`));
}

start().catch(console.error);
