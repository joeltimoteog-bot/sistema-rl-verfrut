// server.js
// Servidor principal - Sistema RL Verfrut/Rapel

require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const path     = require('path');
const { conectar } = require('./config/db');

const app  = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// MIDDLEWARES
// ============================================================
app.use(cors({
    origin: ['http://localhost:5500', 'http://127.0.0.1:5500', 'https://tu-dominio.vercel.app'],
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Archivos estáticos (frontend)
app.use(express.static(path.join(__dirname, '../frontend')));

// Uploads (fotos de visitas)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ============================================================
// RUTAS API
// ============================================================
app.use('/api/auth',         require('./routes/auth'));
app.use('/api/trabajadores', require('./routes/trabajadores'));
app.use('/api/atenciones',   require('./routes/atenciones'));

// ============================================================
// RUTA PRINCIPAL → sirve el login
// ============================================================
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ============================================================
// INICIAR SERVIDOR
// ============================================================
async function iniciar() {
    try {
        await conectar();
        app.listen(PORT, () => {
            console.log('');
            console.log('╔════════════════════════════════════════╗');
            console.log('║   SISTEMA RL - VERFRUT & RAPEL         ║');
            console.log('║   Servidor corriendo en puerto ' + PORT + '     ║');
            console.log('║   http://localhost:' + PORT + '              ║');
            console.log('╚════════════════════════════════════════╝');
            console.log('');
        });
    } catch (err) {
        console.error('❌ Error al iniciar servidor:', err.message);
        process.exit(1);
    }
}

iniciar();
