/* ════════════════════════════════════════════════════════════════════════
   bs — _BS_AZURE_V1 (01-nov-2026) · Lecturas del Sistema Bienestar Social desde Azure SQL
   Las hojas de Bienestar (accidentes, subsidios, hostigamiento, descansos, documentos, quejas)
   las sube el Apps Script de Bienestar (bs-azure-sync.js) a las tablas BS_* (tablas-hoja).
   GET bs/ficha?dni=        ficha 360 del trabajador: padrón (tablas Trabajadores_*), contrato,
                            kpis, alertas, accidentes, subsidios, hostigamiento, descansos, documentos,
                            timeline — misma forma que bs_fichaTrabajador del Apps Script.
   GET bs/tabla?clave=      filas de una hoja como objetos (sin anulados), opcional &dni=
   GET bs/estado            marcas y fecha de carga de cada tabla BS_*
   Solo lectura; exige sesión (Bearer rl_token). Google sigue siendo la copia de respaldo.
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const { sql, getPool } = require('../shared/db');
const { exigirAuth } = require('../shared/auth');
const H = require('../shared/tablas-hoja');
const EMP = require('../shared/empresas');

const CLAVES = ['bs_accidentes_casos', 'bs_accidentes_seguim', 'bs_hostigamiento', 'bs_hostigamiento_olmos', 'bs_subsidios', 'bs_documentos', 'bs_quejas', 'bs_quejas_seguim', 'bs_descansos'];
const CFG = { PERIODO_PRUEBA_DIAS: 90, INDETERMINADO_MESES: 54, PROXIMO_INDET_DIAS: 30, POR_VENCER_DIAS: 30, POR_COBRAR_DIAS: 90, DM_UMBRAL: 20 };
const MES = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };

/* celda de tablas-hoja -> valor plano; fechas a 'YYYY-MM-DD' (día de Lima, como _ymd de Google) */
function plano(c) {
  if (c && typeof c === 'object' && ('$d' in c || '$s' in c)) {
    const s = String(c.$s || '');
    const m = s.match(/^\w{3} (\w{3}) (\d{2}) (\d{4})/);
    if (m && MES[m[1]]) return m[3] + '-' + MES[m[1]] + '-' + m[2];
    if (c.$d) { const d = new Date(new Date(c.$d).getTime() - 5 * 3600e3); return isNaN(d) ? '' : d.toISOString().slice(0, 10); }
    return '';
  }
  return c == null ? '' : c;
}
function ymd(v) {
  if (!v) return '';
  if (v instanceof Date) return isNaN(v) ? '' : new Date(v.getTime() - 5 * 3600e3).toISOString().slice(0, 10);
  const s = String(v).trim(), m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return m[1] + '-' + m[2] + '-' + m[3];
  const m2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (m2) return m2[3] + '-' + ('0' + m2[2]).slice(-2) + '-' + ('0' + m2[1]).slice(-2);
  const d = new Date(s); return isNaN(d) ? s : d.toISOString().slice(0, 10);
}
function aFecha(s) { const y = ymd(s); if (!/^\d{4}-\d{2}-\d{2}$/.test(y)) return null; return new Date(y + 'T00:00:00Z'); }
function hoyLima() { return new Date(new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10) + 'T00:00:00Z'); }
function num(v) { const n = parseFloat(String(v == null ? '' : v).replace(/[^\d.-]/g, '')); return isNaN(n) ? 0 : n; }
function anulado(o) { return /^(s|si|sí|true|1)$/i.test(String(o.anulado || '').trim()); }
function mascara(n) { return String(n || '').trim().split(/\s+/).map(p => p ? p.charAt(0) + '***' : '').join(' '); }
function monto(o) { let v = num(o.monto_total); if (!v) v = num(o.pago_empresa) + num(o.recuperado_essalud); if (!v) v = num(o.reembolso_por_mes); if (!v) v = num(o.calculo_por_dia) * (parseInt(o.dias, 10) || 0); return Math.round(v * 100) / 100; }
function catSub(o) { const e = String(o.estado_general || '').trim().toUpperCase(); if (e === 'COBRADO' || e === 'RECUPERADO') return 'cobrado'; if (e === 'NO RECUPERABLE') return 'no_recuperable'; return 'por_cobrar'; }
function conting(o) {
  let t = String(o.tipo || '').trim().toUpperCase(); if (!t || /^\d+$/.test(t)) t = String(o.descripcion || t || '').trim().toUpperCase();
  if (/MATERN/.test(t)) return 'Maternidad pre y post natal'; if (/INCAP/.test(t)) return 'Incapacidad temporal'; if (/LACTAN/.test(t)) return 'Lactancia'; if (/SEPELIO/.test(t)) return 'Sepelio';
  return t ? (t.charAt(0) + t.slice(1).toLowerCase()) : '(Sin contingencia)';
}

/* hoja -> objetos por encabezado (null si la tabla aún no fue cargada) */
async function objetos(pool, clave) {
  const d = await H.leer(pool, clave); if (!d) return null;
  const enc = d.encabezado.map(plano).map(String);
  return d.filas.map(f => { const o = {}; enc.forEach((k, i) => { if (k) o[k] = plano(f[i]); }); return o; });
}

async function padron(pool, dni) {
  const ex = await EMP.tablasExistentes(pool, sql);
  const tablas = EMP.EMPRESAS.filter(e => ex.has(e.tabla));
  if (!tablas.length) return null;
  const sin0 = dni.replace(/^0+/, '');
  /* _BS_FICHA_SUPA_V1 (06-nov): antes era un solo "TOP 1 … UNION ALL …" que Supabase rechazaba (error 500 -> la ficha caia a Google, lenta).
     Ahora una consulta por empresa, en el mismo orden, y se queda con la primera que encuentra: mismo resultado. */
  let t = null;
  for (const e of tablas) {
    const rq = pool.request(); rq.input('dni', sql.NVarChar(20), dni); rq.input('dni2', sql.NVarChar(20), sin0 || dni);
    const r = await rq.query(`SELECT TOP 1 *, '${e.codigo}' AS empresa_origen FROM dbo.${e.tabla} WHERE dni IN (@dni, @dni2)`);
    t = (r.recordset || [])[0]; if (t) break;
  }
  if (!t) return null;
  const nombre = String(t.nombre_completo || [t.ap_paterno, t.ap_materno, t.nombres].filter(Boolean).join(' ') || '').trim().toUpperCase();
  return { dni, nombre, empresa: String(t.empresa_origen || t.empresa || '').toUpperCase().replace(/\s*S\.?A\.?C\.?\s*$/, '').trim(), sexo: String(t.sexo || ''), cargo: String(t.oficio || t.cargo || ''),
    regimen: String(t.tipo_regimen || ''), zona: String(t.zona_labor || ''), fecha_inicio: ymd(t.fecha_inicio), fecha_termino: ymd(t.fecha_termino), ruta: String(t.ruta || ''), codigo: String(t.codigo_trab || t.cod || ''), fuente: 'azure' };
}
function contrato(p, hoy) {
  const ini = aFecha(p.fecha_inicio);
  if (!ini) return { tipo: 'sin_fecha', etiqueta: 'Sin fecha de ingreso', antiguedadMeses: null, porVencerDias: null, proximoIndeterminado: false };
  const dias = Math.round((hoy - ini) / 86400000);
  let meses = (hoy.getUTCFullYear() - ini.getUTCFullYear()) * 12 + (hoy.getUTCMonth() - ini.getUTCMonth()); if (hoy.getUTCDate() < ini.getUTCDate()) meses--;
  const tipo = dias <= CFG.PERIODO_PRUEBA_DIAS ? 'prueba' : (meses >= CFG.INDETERMINADO_MESES ? 'indeterminado' : 'plazo_fijo');
  const fIndet = new Date(Date.UTC(ini.getUTCFullYear(), ini.getUTCMonth() + CFG.INDETERMINADO_MESES, ini.getUTCDate()));
  const dPara = Math.round((fIndet - hoy) / 86400000), term = aFecha(p.fecha_termino);
  return { tipo, etiqueta: tipo === 'prueba' ? 'Período de prueba' : tipo === 'indeterminado' ? 'Indeterminado' : 'Plazo fijo', antiguedadDias: dias, antiguedadMeses: meses,
    antiguedadTexto: Math.floor(meses / 12) + ' a ' + (meses % 12) + ' m', fechaIndeterminado: fIndet.toISOString().slice(0, 10),
    proximoIndeterminado: tipo === 'plazo_fijo' && dPara >= 0 && dPara <= CFG.PROXIMO_INDET_DIAS, fechaTermino: p.fecha_termino || '', porVencerDias: term ? Math.round((term - hoy) / 86400000) : null };
}

async function ficha(pool, dni, perm, esAdmin) {
  const t0 = Date.now(), ms = {}, hoy = hoyLima();
  const puede = m => esAdmin || !!perm[m];
  const out = { ok: true, dni, padron: null, contrato: null, kpis: {}, alertas: [], accidentes: [], subsidios: [], hostigamiento: [], descansos: [], documentos: [], timeline: [],
    permisos: { accidentes: puede('accidentes'), subsidios: puede('subsidios'), hostigamiento: puede('hostigamiento'), descansos: puede('descansos') }, fuente: 'azure' };
  const [p, acc, sub, hosP, hosO, dms, docs] = await Promise.all([
    padron(pool, dni), puede('accidentes') ? objetos(pool, 'bs_accidentes_casos') : [], puede('subsidios') ? objetos(pool, 'bs_subsidios') : [],
    puede('hostigamiento') ? objetos(pool, 'bs_hostigamiento') : [], puede('hostigamiento') ? objetos(pool, 'bs_hostigamiento_olmos') : [],
    puede('descansos') ? objetos(pool, 'bs_descansos') : [], objetos(pool, 'bs_documentos')]);
  ms.lecturas = Date.now() - t0;
  out.padron = p; if (p) out.contrato = contrato(p, hoy);
  if (out.contrato) {
    if (out.contrato.porVencerDias !== null && out.contrato.porVencerDias >= 0 && out.contrato.porVencerDias <= CFG.POR_VENCER_DIAS) out.alertas.push({ nivel: 'ambar', modulo: 'contrato', titulo: 'Contrato vence en ' + out.contrato.porVencerDias + ' día(s)', detalle: 'Término: ' + out.contrato.fechaTermino });
    if (out.contrato.proximoIndeterminado) out.alertas.push({ nivel: 'ambar', modulo: 'contrato', titulo: 'Próximo a indeterminado', detalle: 'Cumple 54 meses el ' + out.contrato.fechaIndeterminado });
  }
  /* 2. accidentes */
  if (puede('accidentes')) {
    const lista = (acc || []).filter(o => String(o.dni).trim() === dni && !anulado(o)).sort((a, b) => (num(b.id)) - (num(a.id)));
    out.accidentes = lista.map(o => ({ id: o.id, dia_accidente: ymd(o.dia_accidente), tipo_accidente: o.tipo_accidente, parte_cuerpo: o.parte_cuerpo, diagnostico: o.diagnostico, estado_caso: o.estado_caso, estado: o.estado, descanso_medico: o.descanso_medico, dias_restriccion: num(o.dias_restriccion), fecha_fin_restriccion: ymd(o.fecha_fin_restriccion), fecha_reincorporo: ymd(o.fecha_reincorporo), empresa: o.empresa, fundo: o.fundo }));
    out.kpis.accidentes_total = out.accidentes.length;
    out.kpis.accidentes_abiertos = out.accidentes.filter(a => !/cerrad|finaliz/i.test(String(a.estado_caso || ''))).length;
    out.accidentes.forEach(a => {
      const fin = aFecha(a.fecha_fin_restriccion);
      if (fin && fin >= hoy) out.alertas.push({ nivel: 'rojo', modulo: 'accidentes', titulo: 'Restricción médica vigente', detalle: 'Hasta ' + a.fecha_fin_restriccion + ' · caso #' + a.id, id: a.id });
      out.timeline.push({ fecha: a.dia_accidente, modulo: 'accidentes', id: a.id, titulo: 'Accidente: ' + (a.tipo_accidente || ''), detalle: a.diagnostico || '' });
    });
  }
  /* 3. subsidios (columna "numero" = DNI) */
  if (puede('subsidios')) {
    const lista = (sub || []).filter(o => String(o.numero).trim() === dni && !anulado(o)).sort((a, b) => num(b.id) - num(a.id));
    let tram = 0, cob = 0, porCob = 0, noRec = 0, dias = 0;
    out.subsidios = lista.map(o => {
      const m = monto(o), cat = catSub(o); tram += m; dias += num(o.dias);
      if (cat === 'cobrado') cob += m; else if (cat === 'no_recuperable') noRec += m; else porCob += m;
      const inicio = ymd(o.inicio);
      if (cat === 'por_cobrar') { const fi = aFecha(inicio); const edad = fi ? Math.round((hoy - fi) / 86400000) : 0;
        if (edad > CFG.POR_COBRAR_DIAS) out.alertas.push({ nivel: 'ambar', modulo: 'subsidios', titulo: 'Subsidio por cobrar con ' + edad + ' días', detalle: 'S/ ' + m.toFixed(2) + ' · ' + (o.tipo || '') + ' · exp. ' + (o.expediente || '-'), id: o.id }); }
      out.timeline.push({ fecha: inicio, modulo: 'subsidios', id: o.id, titulo: 'Subsidio: ' + conting(o), detalle: (o.dias || 0) + ' días · S/ ' + m.toFixed(2) + ' · ' + cat.replace('_', ' ') });
      return { id: o.id, anio: o.anio, mes: o.mes, tipo: o.tipo, contingencia: conting(o), dias: num(o.dias), inicio, termino: ymd(o.termino), monto: m, categoria: cat, estado: o.estado, estado_general: o.estado_general, expediente: o.expediente, empresa: o.empresa };
    });
    out.kpis.subsidios_total = out.subsidios.length; out.kpis.subsidios_dias = dias;
    out.kpis.subsidios_tramitado = Math.round(tram * 100) / 100; out.kpis.subsidios_cobrado = Math.round(cob * 100) / 100;
    out.kpis.subsidios_por_cobrar = Math.round(porCob * 100) / 100; out.kpis.subsidios_no_recuperable = Math.round(noRec * 100) / 100;
  }
  /* 4. hostigamiento (ambas sedes; nombres enmascarados) */
  if (puede('hostigamiento')) {
    [['PIURA', hosP], ['OLMOS', hosO]].forEach(([sede, lista]) => {
      (lista || []).filter(o => (String(o.denunciante_dni).trim() === dni || String(o.denunciado_dni).trim() === dni) && !anulado(o)).forEach(o => {
        const rol = String(o.denunciante_dni).trim() === dni ? 'denunciante' : 'denunciado', f = ymd(o.fecha_denuncia);
        out.hostigamiento.push({ id: o.id, codigo: o.codigo || (sede.slice(0, 3) + '-' + ('000' + o.id).slice(-3)), sede, fecha_denuncia: f, rol, status: o.status, decision: o.decision, medida_proteccion: o.medida_proteccion, otra_parte: mascara(rol === 'denunciante' ? o.denunciado_nombre : o.denunciante_nombre), empresa: o.empresa });
        out.timeline.push({ fecha: f, modulo: 'hostigamiento', id: o.id, titulo: 'Caso de hostigamiento (' + rol + ')', detalle: sede + ' · ' + (o.status || '') });
      });
    });
    out.kpis.hostigamiento_total = out.hostigamiento.length;
  }
  /* 4b. descansos médicos */
  if (puede('descansos')) {
    const lista = (dms || []).filter(o => String(o.dni).trim() === dni && !anulado(o)).map(x => Object.assign({}, x, { fecha_inicio: ymd(x.fecha_inicio), fecha_fin: ymd(x.fecha_fin) })).sort((a, b) => String(b.fecha_inicio).localeCompare(String(a.fecha_inicio)));
    const anio = String(hoy.getUTCFullYear()); let acum = 0, mat = 0;
    out.descansos = lista.map(x => {
      const d = num(x.dias);
      if (String(x.fecha_inicio).slice(0, 4) === anio) { if (x.tipo === 'Maternidad') mat += d; else acum += d; }
      if (x.estado === 'Activo') out.alertas.push({ nivel: 'rojo', modulo: 'descansos', titulo: 'Descanso médico vigente hasta ' + x.fecha_fin, detalle: (x.tipo || '') + ' · ' + d + ' días', id: x.id });
      if (x.citt_estado === 'Pendiente de canje') out.alertas.push({ nivel: 'ambar', modulo: 'descansos', titulo: 'Certificado pendiente de canje a CITT', detalle: 'DM ' + x.id + ' · ' + x.fecha_inicio, id: x.id });
      out.timeline.push({ fecha: x.fecha_inicio, modulo: 'descansos', id: x.id, titulo: 'Descanso médico: ' + (x.tipo || ''), detalle: d + ' días · ' + (x.diagnostico || '') });
      return { id: x.id, tipo: x.tipo, origen: x.origen, citt_numero: x.citt_numero, citt_estado: x.citt_estado, fecha_inicio: x.fecha_inicio, fecha_fin: x.fecha_fin, dias: d, diagnostico: x.diagnostico, estado: x.estado, id_subsidio: x.id_subsidio, id_accidente: x.id_accidente, empresa: x.empresa };
    });
    out.kpis.descansos_total = out.descansos.length; out.kpis.descansos_dias_anio = acum; out.kpis.descansos_umbral = CFG.DM_UMBRAL; out.kpis.descansos_maternidad_anio = mat;
    if (acum > CFG.DM_UMBRAL) out.alertas.push({ nivel: 'rojo', modulo: 'descansos', titulo: acum + ' días de descanso médico en ' + anio, detalle: 'Supera el umbral de ' + CFG.DM_UMBRAL + ' días: pasa a Subsidios' });
  }
  /* 5. documentos de sus casos */
  const idsAcc = new Set(out.accidentes.map(a => String(a.id))), idsSub = new Set(out.subsidios.map(s => String(s.id)));
  (docs || []).forEach(r => { const mod = String(r.modulo || '').toUpperCase(), caso = String(r.id_caso || '');
    if ((mod === 'ACCIDENTES' && idsAcc.has(caso)) || (mod === 'SUBSIDIOS' && idsSub.has(caso))) out.documentos.push({ id: r.id, modulo: mod, caso_id: caso, nombre: r.nombre_archivo, tipo: r.tipo_archivo, tamano_kb: r.tamano_kb, fecha: ymd(r.created_at) }); });
  out.kpis.documentos = out.documentos.length;
  out.timeline.sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')));
  out.alertas.sort((a, b) => (a.nivel === 'rojo' ? 0 : 1) - (b.nivel === 'rojo' ? 0 : 1));
  ms.total = Date.now() - t0; out._ms = ms;
  out.cargadas = { accidentes: acc !== null, subsidios: sub !== null, hostigamiento: hosP !== null, descansos: dms !== null, documentos: docs !== null };
  return out;
}

module.exports = async function (context, req) {
  const u = exigirAuth(context, req); if (u === null) return;
  const accion = String(context.bindingData.accion || '').toLowerCase(), q = req.query || {};
  const res = (status, body) => { context.res = { status, headers: { 'Content-Type': 'application/json' }, body }; };
  try {
    const pool = await getPool();
    if (accion === 'ficha') {
      const dni = String(q.dni || '').trim(); if (!/^\d{8}$/.test(dni)) return res(400, { ok: false, success: false, message: 'DNI inválido (8 dígitos).' });
      let perm = {}; try { perm = JSON.parse(q.permisos || '{}'); } catch (e) {}
      const rol = String((u && (u.rol || u.role)) || q.rol || '').toLowerCase();
      const esAdmin = rol.indexOf('admin') >= 0 || /coordinador|jefa/.test(rol);   /* rol del token de RR.LL.; los permisos por módulo los manda Bienestar */
      const out = await ficha(pool, dni, perm, esAdmin); out.success = true; return res(200, out);
    }
    if (accion === 'tabla') {
      const clave = String(q.clave || ''); if (CLAVES.indexOf(clave) < 0) return res(400, { success: false, error: 'clave desconocida' });
      let filas = await objetos(pool, clave); if (filas === null) return res(200, { success: true, cargada: false, items: [] });
      filas = filas.filter(o => !anulado(o));
      const dni = String(q.dni || '').trim(); if (dni) filas = filas.filter(o => [o.dni, o.numero, o.denunciante_dni, o.denunciado_dni].some(v => String(v || '').trim() === dni));
      return res(200, { success: true, cargada: true, total: filas.length, items: filas });
    }
    if (accion === 'estado') {
      const r = await pool.request().query(`IF OBJECT_ID('dbo.TH_Estado','U') IS NULL SELECT CAST(NULL AS NVARCHAR(40)) clave, CAST(NULL AS INT) filas, CAST(NULL AS DATETIME2) actualizado WHERE 1=0
        ELSE SELECT clave, filas, actualizado FROM dbo.TH_Estado WHERE clave LIKE 'bs_%'`);
      const est = {}; (r.recordset || []).forEach(x => { est[x.clave] = { filas: x.filas, actualizado: x.actualizado }; });
      return res(200, { success: true, tablas: CLAVES.map(k => ({ clave: k, cargada: !!est[k], filas: est[k] ? est[k].filas : 0, actualizado: est[k] ? est[k].actualizado : null })) });
    }
    return res(404, { success: false, error: 'Acción desconocida: ' + accion });
  } catch (e) {
    context.log.error('bs/' + accion + ': ' + e.message);
    return res(500, { ok: false, success: false, message: e.message });
  }
};
