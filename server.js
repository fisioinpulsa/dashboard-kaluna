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

// SPA fallback
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));

async function start() {
  await crearAdminInicial();
  await crearTrabajadoraInicial();
  app.listen(PORT, () => console.log(`Dashboard Kalüna en http://localhost:${PORT}`));
}

start().catch(console.error);
