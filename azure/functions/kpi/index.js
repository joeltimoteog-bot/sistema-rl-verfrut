/* ═══════════════════════════════════════════════════════════════════════════
   kpi (_KPI_RRLL_V1, 30-set-2026) — KPIs oficiales del equipo de RR.LL.
   POST /api/kpi/tablero        todo el tablero (personas, KPIs, evidencia, alertas)
   POST /api/kpi/guardarNota    { usuario, nota, fecha_examen, constancia, observacion }  (solo jtimoteo)
   POST /api/kpi/recalcular     vuelve a leer ETI y recalcula ya                         (solo jtimoteo)
   Quien consulta sale del login firmado: solo jtimoteo y lcovenas (Eduardo Coveñas).
   ═══════════════════════════════════════════════════════════════════════════ */
const jwt = require('jsonwebtoken');
const { sql, getPool } = require('../shared/db');
const KDB = require('../shared/kpi-db');
const ETI = require('../shared/kpi-eti');
const K = require('../shared/kpi-motor');

function token(req) {
  const h = (req.headers && (req.headers.authorization || req.headers.Authorization)) || '';
  if (!h.startsWith('Bearer ') || !process.env.JWT_SECRET) return null;
  try { return jwt.verify(h.slice(7).trim(), process.env.JWT_SECRET); } catch (e) { return null; }
}

let base = { t: 0, B: null };   /* datos leidos (se reusan 60 s para tablero / serie) */
const CACHE_MS = 60000;
const fechaOk = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) ? String(s) : null;

async function datosBase(pool, context, forzar) {
  if (!forzar && base.B && Date.now() - base.t < CACHE_MS) return base;
  /* lo registrado en ETI se ve al instante: si la ultima copia tiene mas de 3 minutos, se copia antes de calcular */
  try {
    const s = await pool.request().query("SELECT valor FROM dbo.CV_Estado WHERE clave = 'kpi_eti_sync'");
    const v = s.recordset.length ? Date.parse(String(s.recordset[0].valor).slice(0, 19) + 'Z') : 0;
    if (forzar || !v || Date.now() - v > 180000) await ETI.sincronizar(pool);
  } catch (e) { context.log.warn('[kpi] ETI: ' + e.message); }
  base = { t: Date.now(), B: await KDB.cargar(pool) };
  return base;
}

module.exports = async function (context, req) {
  const accion = context.bindingData && context.bindingData.accion;
  const res = (status, body) => { context.res = { status, body }; };
  try {
    const t = token(req);
    const quien = String((t && t.usuario) || '').trim().toLowerCase();
    if (!t) return res(401, { success: false, error: 'Sin sesion valida' });
    if (K.VISORES.indexOf(quien) < 0) return res(403, { success: false, error: 'Este modulo es solo para la Coordinacion de RR.LL. y la Subgerencia de Personas' });
    const pool = await getPool();
    await KDB.asegurarTablas(pool);
    const b = req.body || {};

    if (accion === 'tablero') {   /* { desde, hasta } opcionales: sin rango = todo el periodo hasta hoy */
      const c = await datosBase(pool, context);
      const d = KDB.calcularCon(c.B, KDB.hoyLima(), fechaOk(b.desde), fechaOk(b.hasta));
      const al = await KDB.alertas(pool, 150);
      let cie = []; try { cie = await KDB.cierres(pool); } catch (e) {}
      delete d.avisos;
      return res(200, Object.assign({ success: true, fuente: 'azure', puedeEditar: K.EDITORES.indexOf(quien) >= 0, calculado: new Date(c.t).toISOString() },
        d, { alertas: al, definiciones: K.DEF, cierres: cie, hora_cierre: K.HORA_CIERRE }));
    }
    if (accion === 'serie') {   /* { desde, hasta }: por dia, lo que vencia ese dia */
      const c = await datosBase(pool, context);
      const hoy = KDB.hoyLima();
      const desde = fechaOk(b.desde) || K.PERIODO.ini, hasta = fechaOk(b.hasta) || hoy;
      return res(200, { success: true, desde, hasta, serie: KDB.serie(c.B, hoy, desde < K.PERIODO.ini ? K.PERIODO.ini : desde, hasta) });
    }
    if (accion === 'informe') {   /* informe de un mes CERRADO (foto inmutable) */
      const mes = String(b.mes || '');
      const inf = await KDB.informeMes(pool, mes);
      if (!inf) return res(200, { success: false, error: 'El mes ' + mes + ' aún no está cerrado' });
      return res(200, Object.assign({ success: true }, inf));
    }

    if (K.EDITORES.indexOf(quien) < 0) return res(403, { success: false, error: 'Solo el Coordinador de RR.LL. puede hacer este cambio' });

    if (accion === 'guardarNota') {
      const b = req.body || {};
      const u = String(b.usuario || '').trim().toLowerCase();
      const per = await KDB.personas(pool);
      if (!per.some(p => p.usuario === u)) return res(200, { success: false, error: 'La persona no esta en la lista de KPIs' });
      const n = parseFloat(String(b.nota).replace(',', '.'));
      if (isNaN(n) || n < 0 || n > 20) return res(200, { success: false, error: 'La nota debe estar entre 0 y 20' });
      const constancia = String(b.constancia || '').trim();
      if (!/^https?:\/\//i.test(constancia)) return res(200, { success: false, error: 'Adjunta el enlace de la constancia (PDF o imagen)' });
      const f = /^\d{4}-\d{2}-\d{2}$/.test(String(b.fecha_examen || '')) ? b.fecha_examen : null;
      await pool.request().input('u', sql.NVarChar(60), u).input('n', sql.Decimal(4, 1), Math.round(n * 10) / 10).input('f', sql.Date, f)
        .input('c', sql.NVarChar(1000), constancia.slice(0, 1000)).input('o', sql.NVarChar(500), String(b.observacion || '').slice(0, 500))
        .input('p', sql.NVarChar(60), quien)
        .query('INSERT INTO dbo.KPI_Notas (usuario, nota, fecha_examen, constancia, observacion, registrado_por) VALUES (@u, @n, @f, @c, @o, @p)');
      base = { t: 0, B: null };
      return res(200, { success: true });
    }

    if (accion === 'recalcular') {
      let eti = null;
      try { eti = await ETI.sincronizar(pool); } catch (e) { eti = { error: e.message }; }
      base = { t: Date.now(), B: await KDB.cargar(pool) };
      const d = KDB.calcularCon(base.B, KDB.hoyLima());
      const r = await KDB.registrar(pool, d);
      return res(200, { success: true, eti, registro: r });
    }
    if (accion === 'cerrarMes') {   /* el mes ya terminado queda congelado (no se edita ni se borra) */
      const c = await datosBase(pool, context, true);
      const r = await KDB.cerrarMes(pool, String(b.mes || ''), quien, c.B);
      return res(200, r);
    }

    return res(404, { success: false, error: 'Accion desconocida: ' + accion });
  } catch (err) {
    context.log.error('[kpi] ' + accion + ': ' + err.message);
    return res(500, { success: false, error: err.message });
  }
};
