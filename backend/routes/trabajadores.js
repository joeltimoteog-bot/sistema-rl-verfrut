// routes/trabajadores.js — PostgreSQL
const express = require('express');
const { query } = require('../config/db');
const { verificarToken } = require('../middleware/auth');
const fetch = require('node-fetch');

const router = express.Router();

// GET /api/trabajadores/buscar/:dni
router.get('/buscar/:dni', verificarToken, async (req, res) => {
    const dni = req.params.dni.trim();
    if (!dni || dni.length < 7)
        return res.status(400).json({ ok: false, mensaje: 'DNI inválido.' });

    try {
        const r = await query(
            `SELECT dni, nombre_completo, sexo, fecha_inicio_periodo, fecha_termino_periodo,
                    empresa, fundo, cargo, ruta, codigo, celular, cuspp, afp
             FROM trabajadores WHERE dni = $1 AND activo = TRUE`,
            [dni]
        );
        if (r.rows.length === 0)
            return res.status(404).json({ ok: false, mensaje: 'DNI no encontrado en las bases de datos.' });

        const t = r.rows[0];
        if (t.fecha_inicio_periodo) {
            const hoy    = new Date();
            const inicio = new Date(t.fecha_inicio_periodo);
            let anios = hoy.getFullYear() - inicio.getFullYear();
            let meses = hoy.getMonth()   - inicio.getMonth();
            let dias  = hoy.getDate()    - inicio.getDate();
            if (dias  < 0) { meses--; dias  += 30; }
            if (meses < 0) { anios--; meses += 12; }
            t.antiguedad_anios = anios;
            t.antiguedad_meses = meses;
            t.antiguedad_dias  = dias;
        }
        res.json({ ok: true, data: t });
    } catch (err) {
        res.status(500).json({ ok: false, mensaje: 'Error al buscar trabajador.' });
    }
});

// GET /api/trabajadores/afp/:dni
router.get('/afp/:dni', verificarToken, async (req, res) => {
    const dni = req.params.dni.trim();
    try {
        const body = `CodigoTipoDocumento=0&NumeroDocumento=${dni}&__RequestVerificationToken=${process.env.AFP_TOKEN}`;
        const respuesta = await fetch(process.env.AFP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body
        });
        const texto = await respuesta.text();

        if (texto.includes('Registrado'))
            return res.json({ ok: true, estado: 'Registrado AFP', data: null });
        if (texto.includes('No encontrado') || texto.length < 10)
            return res.json({ ok: false, estado: 'DNI no encontrado en AFP NET', data: null });

        const partes = texto.split('|');
        res.json({
            ok: true, estado: 'Correcto',
            data: {
                cuspp:            partes[0] || '',
                apellido_paterno: partes[1] || '',
                apellido_materno: partes[2] || '',
                primer_nombre:    partes[3] || '',
                segundo_nombre:   partes[4] || '',
                fecha_nacimiento: partes[5] || '',
                afp:              partes[6] || ''
            }
        });
    } catch (err) {
        res.status(500).json({ ok: false, mensaje: 'No se pudo consultar AFP NET.' });
    }
});

// POST /api/trabajadores (importar lista)
router.post('/', verificarToken, async (req, res) => {
    const { trabajadores } = req.body;
    if (!Array.isArray(trabajadores) || trabajadores.length === 0)
        return res.status(400).json({ ok: false, mensaje: 'No hay trabajadores para importar.' });

    let insertados = 0, errores = 0;
    for (const t of trabajadores) {
        try {
            await query(
                `INSERT INTO trabajadores (dni, nombre_completo, sexo, fecha_inicio_periodo, fecha_termino_periodo, empresa, fundo, cargo, ruta, codigo)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
                 ON CONFLICT (dni) DO UPDATE SET
                     nombre_completo = EXCLUDED.nombre_completo,
                     empresa = EXCLUDED.empresa,
                     fundo = EXCLUDED.fundo,
                     cargo = EXCLUDED.cargo,
                     fecha_actualizacion = NOW()`,
                [t.dni, t.nombre_completo, t.sexo||null, t.fecha_inicio_periodo||null,
                 t.fecha_termino_periodo||null, t.empresa, t.fundo||null, t.cargo||null, t.ruta||null, t.codigo||null]
            );
            insertados++;
        } catch { errores++; }
    }
    res.json({ ok: true, insertados, errores });
});

module.exports = router;
