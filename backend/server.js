// server.js — Sistema RL Verfrut/Rapel — CORREGIDO

require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const path     = require('path');
const { pool } = require('./config/db');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth',         require('./routes/auth'));
app.use('/api/trabajadores', require('./routes/trabajadores'));
app.use('/api/atenciones',   require('./routes/atenciones'));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

async function iniciar() {
    try {
        await pool.query('SELECT 1');
        console.log('✅ Conectado a PostgreSQL - Supabase');
        app.listen(PORT, () => {
            console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
        });
    } catch (err) {
        console.error('❌ Error al iniciar servidor:', err.message);
        process.exit(1);
    }
}

iniciar();
