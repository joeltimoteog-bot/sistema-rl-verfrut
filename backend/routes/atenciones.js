// routes/atenciones.js — PostgreSQL
const express = require('express');
const { query } = require('../config/db');
const { verificarToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/atenciones/tipos-documento
router.get('/tipos-documento', verificarToken, async (req, res) => {
    try {
        const r = await query(`SELECT id, codigo, descripcion, responsable, empresa FROM tipos_documento WHERE activo = TRUE ORDER BY codigo::int`);
        res.json({ ok: true, data: r.rows });
    } catch (err) {
        res.status(500).json({ ok: false, mensaje: 'Error al obtener tipos de documento.' });
    }
});

// GET /api/atenciones/supervisores
router.get('/supervisores', verificarToken, async (req, res) => {
    try {
        const r = await query(`SELECT id, nombre_completo, sector, empresa, cargo, correo, celular FROM supervisores WHERE activo = TRUE ORDER BY nombre_completo`);
        res.json({ ok: true, data: r.rows });
    } catch (err) {
        res.status(500).json({ ok: false, mensaje: 'Error al obtener supervisores.' });
    }
});

// GET /api/atenciones/estadisticas
router.get('/estadisticas', verificarToken, async (req, res) => {
    const anio    = parseInt(req.query.anio) || new Date().getFullYear();
    const empresa = req.query.empresa || null;
    const filtro  = empresa ? `AND empresa = '${empresa}'` : '';

    try {
        const [porMes, porSupervisor, porDocumento, porEmpresa, totales] = await Promise.all([
            query(`SELECT mes, COUNT(*)::int as total FROM atenciones WHERE anio=$1 ${filtro} GROUP BY mes ORDER BY MIN(fecha_atencion)`, [anio]),
            query(`SELECT supervisor, COUNT(*)::int as total FROM atenciones WHERE anio=$1 ${filtro} GROUP BY supervisor ORDER BY total DESC`, [anio]),
            query(`SELECT tipo_documento, COUNT(*)::int as total FROM atenciones WHERE anio=$1 ${filtro} GROUP BY tipo_documento ORDER BY total DESC LIMIT 15`, [anio]),
            query(`SELECT empresa, COUNT(*)::int as total FROM atenciones WHERE anio=$1 GROUP BY empresa`, [anio]),
            query(`SELECT
                COUNT(*)::int as total_anio,
                SUM(CASE WHEN fecha_atencion = CURRENT_DATE THEN 1 ELSE 0 END)::int as total_hoy,
                SUM(CASE WHEN EXTRACT(week FROM fecha_atencion)=EXTRACT(week FROM NOW()) AND anio=EXTRACT(year FROM NOW()) THEN 1 ELSE 0 END)::int as total_semana,
                SUM(CASE WHEN mes=TO_CHAR(NOW(),'TMMonth') AND anio=EXTRACT(year FROM NOW()) THEN 1 ELSE 0 END)::int as total_mes
                FROM atenciones WHERE anio=$1 ${filtro}`, [anio])
        ]);
        res.json({ ok: true, data: {
            porMes: porMes.rows, porSupervisor: porSupervisor.rows,
            porDocumento: porDocumento.rows, porEmpresa: porEmpresa.rows,
            totales: totales.rows[0]
        }});
    } catch (err) {
        console.error(err);
        res.status(500).json({ ok: false, mensaje: 'Error en estadísticas.' });
    }
});

// POST /api/atenciones
router.post('/', verificarToken, async (req, res) => {
    const d = req.body;
    if (!d.dni || !d.nombre_completo || !d.supervisor || !d.tipo_documento)
        return res.status(400).json({ ok: false, mensaje: 'Completa los campos obligatorios.' });

    try {
        const fecha   = d.fecha_atencion ? new Date(d.fecha_atencion) : new Date();
        const meses   = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
        const mes     = meses[fecha.getMonth()];
        const anio    = fecha.getFullYear();
        const semana  = Math.ceil((fecha - new Date(anio, 0, 1)) / 604800000 + 1);

        // Detectar reiterativo
        const reit = await query(
            `SELECT COUNT(*)::int as total FROM atenciones WHERE dni=$1 AND tipo_documento=$2 AND anio=$3`,
            [d.dni, d.tipo_documento, anio]
        );
        const totalPrevio   = reit.rows[0].total;
        const esReiterativo = totalPrevio > 0;
        const numReit       = totalPrevio + 1;
        const alertaTeniente = d.tipo_documento.toLowerCase().includes('teniente') && numReit >= 3;

        const reitMes = await query(
            `SELECT COUNT(*)::int as total FROM atenciones WHERE dni=$1 AND tipo_documento=$2 AND mes=$3 AND anio=$4`,
            [d.dni, d.tipo_documento, mes, anio]
        );

        // Insertar
        const ins = await query(
            `INSERT INTO atenciones (
                fecha_atencion, hora_inicio, hora_termino, numero_semana, mes, anio,
                dni, nombre_completo, sexo, fecha_inicio_contrato, fecha_termino_contrato,
                antiguedad_anios, antiguedad_meses, antiguedad_dias,
                empresa, fundo, fundo_actual, cargo, ruta, codigo, celular,
                supervisor, tipo_documento, fecha_inicio_doc, fecha_termino_doc,
                dias_transcurridos, responsable_recepcion, observaciones,
                es_reiterativo, numero_reiteracion, alerta_teniente, registrado_por
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32)
            RETURNING id`,
            [
                fecha, d.hora_inicio||null, d.hora_termino||null, semana, mes, anio,
                d.dni, d.nombre_completo, d.sexo||null,
                d.fecha_inicio_contrato||null, d.fecha_termino_contrato||null,
                d.antiguedad_anios||null, d.antiguedad_meses||null, d.antiguedad_dias||null,
                d.empresa||null, d.fundo||null, d.fundo_actual||null,
                d.cargo||null, d.ruta||null, d.codigo||null, d.celular||null,
                d.supervisor, d.tipo_documento,
                d.fecha_inicio_doc||null, d.fecha_termino_doc||null,
                d.dias_transcurridos||null, d.responsable_recepcion||null, d.observaciones||null,
                esReiterativo, numReit, alertaTeniente, req.usuario.usuario
            ]
        );

        // Actualizar alertas
        await query(
            `INSERT INTO alertas_reiterativas (dni, tipo_documento, anio, total_registros)
             VALUES ($1,$2,$3,1)
             ON CONFLICT DO NOTHING`,
            [d.dni, d.tipo_documento, anio]
        ).catch(() => {});
        await query(
            `UPDATE alertas_reiterativas SET total_registros=total_registros+1, ultima_alerta=NOW()
             WHERE dni=$1 AND tipo_documento=$2 AND anio=$3`,
            [d.dni, d.tipo_documento, anio]
        );

        res.json({
            ok: true, id: ins.rows[0].id,
            mensaje: 'Atención registrada correctamente.',
            alerta: { esReiterativo, numeroReiteracion: numReit, totalMes: reitMes.rows[0].total, alertaTeniente, mes }
        });

    } catch (err) {
        console.error('Error atención:', err);
        res.status(500).json({ ok: false, mensaje: 'Error al registrar la atención.' });
    }
});

// GET /api/atenciones — Historial
router.get('/', verificarToken, async (req, res) => {
    const { criterio, empresa, supervisor, mes, anio, desde, hasta, pagina = 1, limite = 50 } = req.query;
    const params = [];
    const conds  = [];

    if (criterio) {
        params.push(`%${criterio}%`);
        const n = params.length;
        conds.push(`(dni ILIKE $${n} OR nombre_completo ILIKE $${n} OR tipo_documento ILIKE $${n} OR supervisor ILIKE $${n} OR empresa ILIKE $${n})`);
    }
    if (empresa)    { params.push(empresa);           conds.push(`empresa=$${params.length}`); }
    if (supervisor) { params.push(supervisor);        conds.push(`supervisor=$${params.length}`); }
    if (mes)        { params.push(mes);               conds.push(`mes=$${params.length}`); }
    if (anio)       { params.push(parseInt(anio));    conds.push(`anio=$${params.length}`); }
    if (desde)      { params.push(new Date(desde));   conds.push(`fecha_atencion>=$${params.length}`); }
    if (hasta)      { params.push(new Date(hasta));   conds.push(`fecha_atencion<=$${params.length}`); }

    if (req.usuario.rol === 'supervisor') {
        params.push(req.usuario.nombre);
        conds.push(`supervisor=$${params.length}`);
    }

    const where  = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const offset = (parseInt(pagina) - 1) * parseInt(limite);

    try {
        const total = await query(`SELECT COUNT(*)::int as total FROM atenciones ${where}`, params);
        const data  = await query(`SELECT * FROM atenciones ${where} ORDER BY fecha_atencion DESC, hora_inicio DESC LIMIT ${limite} OFFSET ${offset}`, params);
        res.json({ ok: true, total: total.rows[0].total, pagina: parseInt(pagina), data: data.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ ok: false, mensaje: 'Error al obtener historial.' });
    }
});

module.exports = router;
