// routes/auth.js — PostgreSQL
const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { query } = require('../config/db');
const { verificarToken, soloAdmin } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
    const { usuario, password } = req.body;
    if (!usuario || !password)
        return res.status(400).json({ ok: false, mensaje: 'Usuario y contraseña requeridos.' });

    try {
        const r = await query(
            `SELECT id, usuario, password_hash, nombre_completo, cargo, rol,
                    empresa_acceso, activo, intentos_fallidos
             FROM usuarios WHERE usuario = $1`,
            [usuario.toLowerCase().trim()]
        );
        const user = r.rows[0];

        if (!user)
            return res.status(401).json({ ok: false, mensaje: 'Usuario o contraseña incorrectos.' });
        if (!user.activo)
            return res.status(403).json({ ok: false, mensaje: 'Cuenta desactivada. Contacta al administrador.' });
        if (user.intentos_fallidos >= 3)
            return res.status(403).json({ ok: false, mensaje: 'Cuenta bloqueada. Contacta al administrador.' });

        const ok = await bcrypt.compare(password, user.password_hash);
        if (!ok) {
            await query(`UPDATE usuarios SET intentos_fallidos = intentos_fallidos + 1 WHERE usuario = $1`, [usuario.toLowerCase()]);
            const restantes = 3 - (user.intentos_fallidos + 1);
            return res.status(401).json({ ok: false, mensaje: `Contraseña incorrecta. Te quedan ${restantes} intento(s).` });
        }

        await query(`UPDATE usuarios SET intentos_fallidos = 0, ultimo_acceso = NOW() WHERE usuario = $1`, [usuario.toLowerCase()]);

        const token = jwt.sign(
            { id: user.id, usuario: user.usuario, nombre: user.nombre_completo, cargo: user.cargo, rol: user.rol, empresa_acceso: user.empresa_acceso },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
        );

        const hora = new Date().getHours();
        const saludo = hora < 12 ? 'Buenos días' : hora < 18 ? 'Buenas tardes' : 'Buenas noches';
        const motivaciones = [
            'Liderazgo consciente: inspira con tu ejemplo.',
            'Escucha activa: la empatía genera compromiso.',
            'Comunicación efectiva: sé claro, directo y humano.',
            'Resiliencia ante los retos: adaptarte es avanzar.',
            'Organización y enfoque: prioriza lo importante.',
            'Colaboración y equipo: juntos logramos más.',
            'Asertividad: comunica con respeto y firmeza.',
            'Toma decisiones con visión y responsabilidad.',
            'Creatividad: innova para resolver con inteligencia.',
            'Ética y compromiso: base del liderazgo.'
        ];
        const motivacion = motivaciones[Math.ceil(new Date().getDate() / 7) % motivaciones.length];

        res.json({
            ok: true, token,
            usuario: { nombre: user.nombre_completo, cargo: user.cargo, rol: user.rol, empresa: user.empresa_acceso },
            saludo: `${saludo}, ${user.nombre_completo}`,
            motivacion
        });

    } catch (err) {
        console.error('Error login:', err);
        res.status(500).json({ ok: false, mensaje: 'Error interno del servidor.' });
    }
});

// GET /api/auth/verificar
router.get('/verificar', verificarToken, (req, res) => {
    res.json({ ok: true, usuario: req.usuario });
});

// GET /api/auth/usuarios (solo admin)
router.get('/usuarios', verificarToken, soloAdmin, async (req, res) => {
    try {
        const r = await query(`SELECT id, usuario, nombre_completo, cargo, rol, empresa_acceso, activo, ultimo_acceso FROM usuarios ORDER BY nombre_completo`);
        res.json({ ok: true, data: r.rows });
    } catch (err) {
        res.status(500).json({ ok: false, mensaje: 'Error al obtener usuarios.' });
    }
});

// POST /api/auth/usuarios (crear - solo admin)
router.post('/usuarios', verificarToken, soloAdmin, async (req, res) => {
    const { usuario, password, nombre_completo, cargo, rol, empresa_acceso } = req.body;
    if (!usuario || !password || !nombre_completo || !rol)
        return res.status(400).json({ ok: false, mensaje: 'Faltan datos obligatorios.' });
    try {
        const hash = await bcrypt.hash(password, 10);
        await query(
            `INSERT INTO usuarios (usuario, password_hash, nombre_completo, cargo, rol, empresa_acceso, creado_por)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [usuario.toLowerCase(), hash, nombre_completo, cargo || '', rol, empresa_acceso || 'AMBAS', req.usuario.usuario]
        );
        res.json({ ok: true, mensaje: 'Usuario creado correctamente.' });
    } catch (err) {
        if (err.code === '23505') return res.status(400).json({ ok: false, mensaje: 'El usuario ya existe.' });
        res.status(500).json({ ok: false, mensaje: 'Error al crear usuario.' });
    }
});

// PUT /api/auth/usuarios/:id/desbloquear
router.put('/usuarios/:id/desbloquear', verificarToken, soloAdmin, async (req, res) => {
    try {
        await query(`UPDATE usuarios SET intentos_fallidos = 0, activo = TRUE WHERE id = $1`, [req.params.id]);
        res.json({ ok: true, mensaje: 'Usuario desbloqueado.' });
    } catch (err) {
        res.status(500).json({ ok: false, mensaje: 'Error al desbloquear.' });
    }
});

// POST /api/auth/cambiar-password
router.post('/cambiar-password', verificarToken, async (req, res) => {
    const { password_actual, password_nuevo } = req.body;
    if (!password_actual || !password_nuevo || password_nuevo.length < 6)
        return res.status(400).json({ ok: false, mensaje: 'Contraseña nueva debe tener al menos 6 caracteres.' });
    try {
        const r = await query(`SELECT password_hash FROM usuarios WHERE id = $1`, [req.usuario.id]);
        const ok = await bcrypt.compare(password_actual, r.rows[0].password_hash);
        if (!ok) return res.status(401).json({ ok: false, mensaje: 'Contraseña actual incorrecta.' });
        const hash = await bcrypt.hash(password_nuevo, 10);
        await query(`UPDATE usuarios SET password_hash = $1 WHERE id = $2`, [hash, req.usuario.id]);
        res.json({ ok: true, mensaje: 'Contraseña actualizada.' });
    } catch (err) {
        res.status(500).json({ ok: false, mensaje: 'Error al cambiar contraseña.' });
    }
});

module.exports = router;
