/* ═══════════════════════════════════════════════════════════════════════════
   _DASH_AZURE_V1 (05-oct-2026) — lecturas que el DASHBOARD pedia a Google al entrar
     POST /api/mod/acc/getSolicitudesAcceso            (= getSolicitudesAcceso del Apps Script)
     POST /api/mod/mant/listarSolicitudesMantenimiento (= listarSolicitudesMantenimiento; sin el
          correo del responsable, que vive en otra hoja: la pantalla solo cuenta pendientes)
   Se leen de las tablas reales (dbo.Acceso_Solicitudes / dbo.Mant_Registro) SOLO si
   Azure es quien guarda primero ese modulo (CV_Estado usr_azure_primero / mant_azure_primero);
   si no, responde 503 y la pantalla usa Google, como siempre (asi nunca muestra datos atrasados).
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
const { sql } = require('./db');
const TH = require('./tablas-hoja');

const esD = v => !!(v && typeof v === 'object' && typeof v.$d === 'string');
const S = v => esD(v) ? v.$s : String(v == null ? '' : v);
const vacio = v => v === '' || v === null || v === undefined;
const p2 = n => (n < 10 ? '0' : '') + n;
const MESES = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
/* partes de una fecha tal como la muestra Google en hora de Lima ($s = String(fecha) del Apps Script) */
function partes(v) {
  const m = String(v.$s || '').match(/^\w{3} (\w{3}) (\d{2}) (-?\d+) (\d{2}):(\d{2})/);
  if (m) return { d: m[2], m: p2(MESES[m[1]]), y: m[3], h: m[4], mi: m[5] };
  const x = new Date(new Date(v.$d).getTime() - 5 * 3600e3);
  return { d: p2(x.getUTCDate()), m: p2(x.getUTCMonth() + 1), y: String(x.getUTCFullYear()), h: p2(x.getUTCHours()), mi: p2(x.getUTCMinutes()) };
}
const hhmm = v => { const p = partes(v); return p.h + ':' + p.mi; };
const dmy = v => { const p = partes(v); return p.d + '/' + p.m + '/' + p.y; };
const dmyhm = v => dmy(v) + ' ' + hhmm(v);
function dmyhmMs(ms) { const x = new Date(ms - 5 * 3600e3); return p2(x.getUTCDate()) + '/' + p2(x.getUTCMonth() + 1) + '/' + x.getUTCFullYear() + ' ' + p2(x.getUTCHours()) + ':' + p2(x.getUTCMinutes()); }
const cel = (r, i) => r[i] === undefined ? '' : r[i];

async function azurePrimero(pool, clave) {
  try {
    const r = await pool.request().input('k', sql.NVarChar(100), clave).query("SELECT valor FROM dbo.CV_Estado WHERE clave = @k");
    return !!(r.recordset.length && r.recordset[0].valor === '1');
  } catch (e) { return false; }
}

/* = getSolicitudesAcceso(p) del Apps Script (mismo orden, mismos campos, mismo filtro) */
function solicitudesAcceso(T, p) {
  const enc = T.encabezado || [];
  const tieneHeader = typeof enc[0] === 'string' && isNaN(enc[0]);
  const filas = tieneHeader ? T.filas : [enc].concat(T.filas);
  let data = filas.filter(r => !vacio(cel(r, 0))).map((r, i) => {
    const r11 = cel(r, 11), r8 = cel(r, 8), r9 = cel(r, 9), r1 = cel(r, 1);
    let expiraMs = 0;
    if (!vacio(r11)) expiraMs = esD(r11) ? new Date(r11.$d).getTime() : (parseInt(r11, 10) || 0);
    const horaFin = vacio(r9) ? '' : (esD(r9) ? hhmm(r9) : String(r9));
    const horaIni = vacio(r8) ? '' : (esD(r8) ? hhmm(r8) : String(r8));
    const horas = parseInt(S(cel(r, 5)), 10) || 0;
    return {
      fila: tieneHeader ? i + 2 : i + 1,
      nro: esD(r[0]) ? r[0].$s : r[0],
      fecha: esD(r1) ? dmyhm(r1) : S(r1),
      usuario: S(cel(r, 2)), nombre: S(cel(r, 3)), motivo: S(cel(r, 4)),
      horas: horas, horas_solicitadas: horas,
      estado: S(cel(r, 6)).trim(),
      aprobado_por: S(cel(r, 7)),
      hora_inicio: horaIni, hora_fin: horaFin,
      expira_ms: expiraMs,
      expira_fecha: expiraMs ? dmyhmMs(expiraMs) : ''
    };
  });
  if (p && p.estado) data = data.filter(s => s.estado === p.estado);
  return { success: true, data };
}

/* = listarSolicitudesMantenimiento(params) del Apps Script (sin 'correo': otra hoja) */
function solicitudesMant(T, p) {
  const fM = v => vacio(v) ? '' : (esD(v) ? dmy(v) : String(v).trim());   /* = _fmtFechaMant */
  const filtroDni = String((p && p.dni) || '').trim(), filtroUser = String((p && p.solicitante) || '').trim().toLowerCase();
  const out = [];
  for (let i = T.filas.length - 1; i >= 0; i--) {   /* mas recientes primero */
    const r = T.filas[i], s = k => S(cel(r, k));
    const dni = s(2).trim(), usuario = s(18).trim().toLowerCase();
    if (filtroDni && dni !== filtroDni) continue;
    if (filtroUser && usuario !== filtroUser) continue;
    out.push({ id: s(0), fechaSolicitud: fM(cel(r, 1)), dni, nombre: s(3), empresa: s(4), codInterno: s(5), unidad: s(6),
      numLicencia: s(7), tipoLicencia: s(8), revalidacion: fM(cel(r, 9)), estadoLic: s(10), km: s(11), tipo: s(12),
      observaciones: s(13), estado: s(14) || 'PENDIENTE', fechaProgramada: fM(cel(r, 15)), comentarioAdmin: s(16),
      solicitante: s(18), correo: '' });
  }
  return { ok: true, data: out, sinCorreo: true };
}

const LECTURAS = {
  acc:  { tabla: 'acc_solicitudes', interruptor: 'usr_azure_primero',  fn: solicitudesAcceso },
  mant: { tabla: 'mant_registro',   interruptor: 'mant_azure_primero', fn: solicitudesMant }
};
/* devuelve la respuesta, o null si Azure no es la fuente al dia (-> 503 -> Google) */
async function leer(pool, modulo, body) {
  const L = LECTURAS[modulo];
  if (!L || !(await azurePrimero(pool, L.interruptor))) return null;
  const T = await TH.leer(pool, L.tabla);
  if (!T) return null;
  return L.fn(T, body || {});
}
module.exports = { leer, LECTURAS, solicitudesAcceso, solicitudesMant };
