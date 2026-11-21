/* ════════════════════════════════════════════════════════════════════════
   bs — _BS_AZURE_V1 (01-nov-2026) · Lecturas del Sistema Bienestar Social desde Azure SQL
   Las hojas de Bienestar (accidentes, subsidios, hostigamiento, descansos, documentos, quejas)
   las sube el Apps Script de Bienestar (bs-azure-sync.js) a las tablas BS_* (tablas-hoja).
   GET bs/ficha?dni=        ficha 360 del trabajador: padrón (tablas Trabajadores_*), contrato,
                            kpis, alertas, accidentes, subsidios, hostigamiento, descansos, documentos,
                            timeline — misma forma que bs_fichaTrabajador del Apps Script.
   GET bs/tabla?clave=      filas de una hoja como objetos (sin anulados), opcional &dni=
   GET bs/estado            marcas y fecha de carga de cada tabla BS_*
   GET bs/permisos          _BS_GESTION_SOCIAL_V1 (14-nov): permisos del usuario segun "Acceso a Modulos" del RR.LL.
   POST bs/canal            _BS_GESTION_SOCIAL_V3 (15-nov): canal anonimo QR (SIN sesion; limites por huella y por dia)
   GET bs/dashboard         _BS_RESUMEN_SUPABASE_V1 (15-nov): KPIs del portal (antes bs_dashboard en Google)
   GET bs/alertas           _BS_RESUMEN_SUPABASE_V1 (15-nov): alertas legales del portal (antes bs_alertas en Google)
   GET bs/estadisticas      _BS_RESUMEN_SUPABASE_V1 (15-nov): estadisticas empresariales (antes bs_estadisticasEmpresariales en Google)
   POST bs/guardar          _BS_GUARDA_SUPABASE_V1 (08-nov): crear/actualizar/seguimiento/anular/restaurar directo en Supabase
   POST bs/auditar          evento de auditoría suelto (Apps Script con clave interna / navegador)
   GET|POST bs/fuente       quién manda por tabla ('hoja' = Google + sync, 'supabase' = se guarda aquí)
   POST bs/respaldo         copia diaria de todas las tablas bs_* a Storage (bucket privado 'respaldos')
   Exige sesión (Bearer rl_token). Las tablas en fuente 'hoja' siguen subiéndose desde Google.
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const { sql, getPool } = require('../shared/db');
const { exigirAuth } = require('../shared/auth');
const H = require('../shared/tablas-hoja');
const EMP = require('../shared/empresas');

const BG = require('../shared/bs-guardar');   /* _BS_GUARDA_SUPABASE_V1 (08-nov-2026): escrituras directas + fuente por tabla + respaldo */
const CLAVES = BG.CLAVES_BS;   /* _BS_AUDITORIA_SUPA_V1: + bs_auditoria */
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
/* _BS_GUARDA_SUPABASE_V1: el Apps Script anula con el texto 'SI · usuario · fecha · motivo' (no solo 'SI'); antes esa marca no se reconocía y los anulados se seguían contando */
function anulado(o) { const a = o.anulado; return a === true || /^(s|si|sí|true|1)(\b|$)/i.test(String(a || '').trim()); }
function mascara(n) { return String(n || '').trim().split(/\s+/).map(p => p ? p.charAt(0) + '***' : '').join(' '); }
function monto(o) { let v = num(o.monto_total); if (!v) v = num(o.pago_empresa) + num(o.recuperado_essalud); if (!v) v = num(o.reembolso_por_mes); if (!v) v = num(o.calculo_por_dia) * (parseInt(o.dias, 10) || 0); return Math.round(v * 100) / 100; }
function catSub(o) { const e = String(o.estado_general || '').trim().toUpperCase(); if (e === 'COBRADO' || e === 'RECUPERADO') return 'cobrado'; if (e === 'NO RECUPERABLE') return 'no_recuperable'; return 'por_cobrar'; }
function conting(o) {
  let t = String(o.tipo || '').trim().toUpperCase(); if (!t || /^\d+$/.test(t)) t = String(o.descripcion || t || '').trim().toUpperCase();
  if (/MATERN/.test(t)) return 'Maternidad pre y post natal'; if (/INCAP/.test(t)) return 'Incapacidad temporal'; if (/LACTAN/.test(t)) return 'Lactancia'; if (/SEPELIO/.test(t)) return 'Sepelio';
  return t ? (t.charAt(0) + t.slice(1).toLowerCase()) : '(Sin contingencia)';
}

/* hoja -> objetos por encabezado (null si la tabla aún no fue cargada) */
function planoHora(c) {   /* _BS_AUDITORIA_SUPA_V1: fecha y hora de Lima 'YYYY-MM-DD HH:mm' (la auditoría necesita la hora) */
  if (c && typeof c === 'object' && ('$d' in c || '$s' in c)) {
    if (c.$d) { const d = new Date(new Date(c.$d).getTime() - 5 * 3600e3); return isNaN(d) ? plano(c) : d.toISOString().slice(0, 16).replace('T', ' '); }
    return plano(c);
  }
  return c == null ? '' : c;
}
/* ═══ _BS_SEDE_V1 (21-nov-2026, decision de Joel): Bienestar por sede, aplicado en el servidor ═══
   Misma regla del Sistema RR.LL. (shared/sede.js): usuario de Olmos ve solo registros de Olmos; usuario de Piura, solo de Piura;
   alcance General (y jtimoteo) ve las dos. Un registro es de Olmos si su empresa/fundo/sede es de Olmos o si lo creo un
   usuario de Olmos (created_by). La tabla bs_hostigamiento_olmos es completa de Olmos. Los registros antiguos (sin nada de
   Olmos) son de Piura. Llamadas internas (sin usuario) no se filtran. Apagar: secreto SEDE_FILTRO=off. */
const SD = require('../shared/sede');
async function sedeBS(pool, u) {
  try { const modo = await SD.modo(pool, (u && u.usuario) ? { usuario: u.usuario } : null); return modo === 'TODO' ? null : { modo, o: await SD.olmos(pool) }; }
  catch (e) { throw Object.assign(new Error('No se pudo determinar tu sede en este momento. Intenta de nuevo en unos segundos.'), { status: 503 }); }
}
function filaOlmosBS(clave, f, o) {
  if (clave === 'bs_hostigamiento_olmos') return true;
  if (SD.esOlmos(f, o, { empresa: 'empresa', fundo: 'fundo', usuario: 'created_by', supervisor: null })) return true;
  if (f && f.sede && SD._N(f.sede).indexOf('OLMOS') >= 0) return true;
  if (f && f.usuario && !f.created_by && o.usuarios.indexOf(String(f.usuario).trim().toLowerCase()) >= 0) return true;   /* bs_auditoria */
  return false;
}
function porSedeBS(clave, filas, sd) {
  if (!sd || !filas) return filas;
  const quiere = sd.modo === 'OLMOS';
  return filas.filter(f => filaOlmosBS(clave, f, sd.o) === quiere);
}
async function objetos(pool, clave, conHora, sd) { return porSedeBS(clave, await objetosTodos(pool, clave, conHora), sd); }
async function objetosTodos(pool, clave, conHora) {
  const d = await H.leer(pool, clave); if (!d) return null;
  const enc = d.encabezado.map(plano).map(String), P = conHora ? planoHora : plano;
  return d.filas.map(f => { const o = {}; enc.forEach((k, i) => { if (k) o[k] = P(f[i]); }); return o; });
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

async function ficha(pool, dni, perm, esAdmin, sd) {
  const t0 = Date.now(), ms = {}, hoy = hoyLima();
  const puede = m => esAdmin || !!perm[m];
  const out = { ok: true, dni, padron: null, contrato: null, kpis: {}, alertas: [], accidentes: [], subsidios: [], hostigamiento: [], descansos: [], documentos: [], timeline: [],
    permisos: { accidentes: puede('accidentes'), subsidios: puede('subsidios'), hostigamiento: puede('hostigamiento'), descansos: puede('descansos') }, fuente: 'azure' };
  const [p, acc, sub, hosP, hosO, dms, docs] = await Promise.all([
    padron(pool, dni), puede('accidentes') ? objetos(pool, 'bs_accidentes_casos', false, sd) : [], puede('subsidios') ? objetos(pool, 'bs_subsidios', false, sd) : [],
    puede('hostigamiento') ? objetos(pool, 'bs_hostigamiento', false, sd) : [], puede('hostigamiento') ? objetos(pool, 'bs_hostigamiento_olmos', false, sd) : [],
    puede('descansos') ? objetos(pool, 'bs_descansos', false, sd) : [], objetos(pool, 'bs_documentos', false, sd)]);
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

/* _BS_PERMISOS_SERVIDOR_V1 (08-nov-2026) — permisos de Bienestar decididos en el servidor.
   · esAdmin: rol del token (admin/coordinador/jefa) o bs_admin en "Acceso a Modulos".
   · Si el usuario esta configurado en "Acceso a Modulos" (definido=true): mandan esos permisos; lo que mande el navegador se ignora.
   · Si NO esta configurado (o la consulta no responde): se conserva el comportamiento anterior (permisos que envia Bienestar
     desde su hoja Usuarios), salvo HOSTIGAMIENTO, que queda cerrado hasta que el administrador lo configure en RR.LL. */
const MODULO_DE_CLAVE = BG.MODULO_DE_CLAVE;
async function permisosBS(u, q) {
  const rol = String((u && (u.rol || u.role)) || '').toLowerCase(), usuario = String((u && u.usuario) || '').toLowerCase();
  let esAdmin = rol.indexOf('admin') >= 0 || /coordinador|jefa/.test(rol);
  let acc = null; try { acc = usuario ? await require('../auth-sso/index.js').accesosDe(usuario) : null; } catch (e) { acc = null; }
  /* _BS_ADMIN_MODULOS_V2 (21-nov-2026): si "Acceso a Modulos" no respondio, se reintenta una vez; si sigue sin responder, el ROL
     administrador ya no abre todo: se responde 503 para que la pantalla reintente (jtimoteo no depende de esa lectura). */
  if (acc === null && usuario) { try { acc = await require('../auth-sso/index.js').accesosDe(usuario); } catch (e) { acc = null; } }
  if (acc === null && usuario && esAdmin && usuario !== 'jtimoteo') throw Object.assign(new Error('No se pudieron leer tus permisos en este momento. Intenta de nuevo en unos segundos.'), { status: 503 });
  if (acc && acc.definido) {
    if (!acc.activo || !acc.bs || !acc.bs.acceso) return { esAdmin: false, permisos: {}, fuente: 'rrll:sin-acceso' };
    /* _BS_ADMIN_MODULOS_V1 (21-nov-2026, decision de Joel): con el usuario configurado en "Acceso a Modulos", el ROL ya no abre
       todo Bienestar: administra solo quien tiene marcado "Administrador de Bienestar" (bs_admin). jtimoteo, siempre. */
    esAdmin = !!acc.bs.admin || usuario === 'jtimoteo';
    return { esAdmin, permisos: Object.assign({}, acc.bs.permisos || {}), fuente: 'rrll' };
  }
  /* _SEG_SERVIDOR_V1 (10-nov-2026): los permisos YA NO se leen de la URL (?permisos=): cualquiera podia escribirlos.
     Usuario sin configurar en "Acceso a Modulos" (o base sin responder): sin permisos de modulo, salvo que su rol sea
     administrador/coordinador/jefa. Salida de emergencia (solo mientras se configura a los usuarios): secreto
     BS_PERMISOS_URL=1 en el servidor vuelve al comportamiento anterior. */
  const legadoUrl = process.env.BS_PERMISOS_URL !== '0';   /* _SEG_SERVIDOR_V3 (10-nov-2026, decision de Joel: nadie pierde acceso al desplegar): el respaldo por URL sigue SOLO para quien aun no esta configurado en "Acceso a Modulos"; se anota quien lo usa; se cierra con BS_PERMISOS_URL=0 cuando la lista quede vacia */
  if (legadoUrl && usuario && !esAdmin) { try { console.warn('[bs] _SEG_SERVIDOR_V3 permisos por URL (usuario sin configurar o base sin respuesta): ' + usuario); } catch (e) {} }
  /* _SEG_SERVIDOR_V2 (10-nov-2026, verificacion): si "Acceso a Modulos" no respondio (base lenta) no se niega el acceso: 503 para que la pantalla reintente */
  if (acc === null && usuario && !esAdmin && !legadoUrl) throw Object.assign(new Error('No se pudieron leer tus permisos en este momento. Intenta de nuevo en unos segundos.'), { status: 503 });
  let perm = {}; if (legadoUrl) { try { perm = JSON.parse((q && q.permisos) || '{}') || {}; } catch (e) { perm = {}; } }
  if (!esAdmin) perm.hostigamiento = false;
  return { esAdmin, permisos: perm, fuente: (acc === null ? 'bienestar:sin-respuesta-rrll' : 'bienestar:no-configurado') + (legadoUrl ? '' : ':url-ignorada') };
}

/* ═══ _BS_GESTION_SOCIAL_V3 (15-nov-2026): CANAL ANÓNIMO (QR en fundos, comedores y buses) ═══
   POST bs/canal { empresa, fundo, sede, categoria, mensaje, contacto?, hp }  — SIN sesión: lo llena el trabajador desde su celular.
   Protecciones: honeypot (hp debe venir vacío), tamaño del mensaje (10–2000), catálogo cerrado de categoría/empresa,
   límite por huella (IP+navegador) 5 mensajes / 10 min y 30 / día, y tope global 400 / día. La IP nunca se guarda en claro
   (huella = sha256 recortado). Lo demás del módulo (leer, atender, anular) sigue exigiendo sesión y permiso gestion_social. */
const CANAL_CATEGORIAS = ['Queja', 'Sugerencia', 'Reconocimiento', 'Seguridad / salud en el trabajo', 'Trato / discriminación', 'Pago / horas', 'Transporte / comedor / SS.HH.', 'Hostigamiento (se deriva al comité)', 'Otro'];
const CANAL_EMPRESAS = ['RAPEL', 'VERFRUT', 'OLMOS'];
const canalMem = { porHuella: new Map(), dia: '', total: 0 };
function canalHuella(req) {
  const h = req.headers || {}, ip = String(h['x-forwarded-for'] || h['x-real-ip'] || '').split(',')[0].trim(), ua = String(h['user-agent'] || '').slice(0, 120);
  return require('crypto').createHash('sha256').update(ip + '|' + ua + '|' + (process.env.JWT_SECRET || 'canal')).digest('hex').slice(0, 32);
}
function canalPermitido(huella) {
  const hoy = new Date().toISOString().slice(0, 10), ahora = Date.now();
  if (canalMem.dia !== hoy) { canalMem.dia = hoy; canalMem.total = 0; canalMem.porHuella.clear(); }
  if (canalMem.total >= 400) return 'El canal recibió demasiados mensajes hoy. Intenta mañana o acércate a Bienestar Social.';
  const r = canalMem.porHuella.get(huella) || { t: [] }; r.t = r.t.filter(t => ahora - t < 86400e3);
  if (r.t.filter(t => ahora - t < 600e3).length >= 5) return 'Enviaste varios mensajes seguidos. Espera unos minutos para enviar otro.';
  if (r.t.length >= 30) return 'Llegaste al máximo de mensajes por día desde este dispositivo.';
  r.t.push(ahora); canalMem.porHuella.set(huella, r); canalMem.total++;
  return '';
}
async function canalRecibir(req, res) {
  if (String(req.method || '').toUpperCase() !== 'POST') return res(405, { ok: false, success: false, message: 'Usa POST' });
  const b = req.body || {}, limpio = (x, n) => String(x == null ? '' : x).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
  if (limpio(b.hp, 10)) return res(200, { ok: true, success: true, codigo: 'CQ-0000' });   /* bot: se le responde ok sin guardar */
  const empresa = limpio(b.empresa, 40).toUpperCase(), fundo = limpio(b.fundo, 200), sede = limpio(b.sede || 'PIURA', 20).toUpperCase(), categoria = limpio(b.categoria, 100), mensaje = limpio(b.mensaje, 2000), contacto = limpio(b.contacto, 200);
  if (CANAL_EMPRESAS.indexOf(empresa) < 0) return res(400, { ok: false, success: false, message: 'Empresa no válida.' });
  if (CANAL_CATEGORIAS.indexOf(categoria) < 0) return res(400, { ok: false, success: false, message: 'Elige una categoría de la lista.' });
  if (mensaje.length < 10) return res(400, { ok: false, success: false, message: 'Cuéntanos un poco más (mínimo 10 letras).' });
  const huella = canalHuella(req), bloqueo = canalPermitido(huella); if (bloqueo) return res(429, { ok: false, success: false, message: bloqueo });
  const pool = await getPool();
  const r = await BG.crear(pool, 'bs_gs_canal', { empresa, fundo, sede, categoria, mensaje, contacto, origen: 'QR', huella }, 'canal-qr');
  if (!r.ok) return res(r.status || 500, { ok: false, success: false, message: r.message || 'No se pudo registrar.' });
  return res(200, { ok: true, success: true, id: r.id, codigo: r.codigo || ('CQ-' + String(r.id).padStart(4, '0')) });
}

/* ═══ _BS_RESUMEN_SUPABASE_V1 (15-nov-2026): el portal de Bienestar deja de pedir a Google (hoja congelada el 14-nov)
   los KPIs (bs_dashboard = getEstadisticasBienestar) y las alertas legales (bs_alertas = calcularAlertasBienestar).
   Misma lógica y misma forma de salida que el Apps Script, pero leyendo las tablas bs_* de Supabase (sin anulados).
   GET bs/dashboard  → { ok, quejas, accidentes, hostigamiento, subsidios, tendencia, recientes, generado }
   GET bs/alertas    → { ok, alertas:[{modulo,id,regla,descripcion,fechaBase,fechaLimite,diasRestantes,estado,empresa}], resumen, generado } */
const RES_CFG = { PLAZO_QUEJAS_DIAS: 15, PLAZO_QUEJAS_TIPO: 'habiles', UMBRAL_AMBAR_DIAS: 2, PLAZO_CANJE_CITT: 30,
  FERIADOS: ['2026-01-01', '2026-04-02', '2026-04-03', '2026-05-01', '2026-06-07', '2026-06-29', '2026-07-23', '2026-07-28', '2026-07-29', '2026-08-06', '2026-08-30', '2026-10-08', '2026-11-01', '2026-12-08', '2026-12-09', '2026-12-25',
    '2027-01-01', '2027-03-25', '2027-03-26', '2027-05-01', '2027-06-07', '2027-06-29', '2027-07-23', '2027-07-28', '2027-07-29', '2027-08-06', '2027-08-30', '2027-10-08', '2027-11-01', '2027-12-08', '2027-12-09', '2027-12-25'] };
const rTxt = v => String(v == null ? '' : v).trim();
const rNum = v => { const x = Number(rTxt(v).replace(/,/g, '')); return isNaN(x) ? 0 : x; };
const rEmp = v => { const s = rTxt(v).toUpperCase(); return s.indexOf('RAPEL') >= 0 ? 'RAPEL' : s.indexOf('VERFRUT') >= 0 ? 'VERFRUT' : 'OTRO'; };
const rFecha = v => { const m = rTxt(v).match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])); const m2 = rTxt(v).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m2 ? new Date(Date.UTC(+m2[3], +m2[2] - 1, +m2[1])) : null; };
const rYmd = d => d ? d.toISOString().slice(0, 10) : '';
const rYm = v => { const d = rFecha(v); if (d) return rYmd(d).slice(0, 7); const m = rTxt(v).match(/(\d{4})\D(\d{1,2})/); return m ? m[1] + '-' + ('0' + m[2]).slice(-2) : ''; };
const rHoy = () => hoyLima();   /* ya es Date UTC-medianoche de Lima */
const rHabil = d => { const w = d.getUTCDay(); return w !== 0 && w !== 6 && RES_CFG.FERIADOS.indexOf(rYmd(d)) < 0; };
const rSumaCal = (d, n) => new Date(d.getTime() + n * 86400000);
const rSumaHab = (d, n) => { let x = new Date(d.getTime()), c = 0; while (c < n) { x = rSumaCal(x, 1); if (rHabil(x)) c++; } return x; };
const rVenc = fl => { const dr = Math.round((fl - rHoy()) / 86400000); return { estado: dr < 0 ? 'rojo' : dr <= RES_CFG.UMBRAL_AMBAR_DIAS ? 'ambar' : 'verde', diasRestantes: dr }; };
async function resObjetos(pool, clave, sd) { try { const f = await objetos(pool, clave, false, sd); return (f || []).filter(o => !anulado(o)); } catch (e) { return []; } }
function resPermisos(P) { const v = k => P.esAdmin || !!P.permisos[k]; return { quejas: v('quejas'), accidentes: v('accidentes'), hostigamiento: v('hostigamiento'), descansos: v('descansos'), subsidios: v('subsidios'), lactancia: v('gs_lactancia') || v('gs_gestantes') }; }   /* _BS_LACTANCIA_V1: alertas de lactancia para quien tiene el módulo (o Gestantes) */

async function resDashboard(pool, P) {
  const ver = resPermisos(P), tend = {}, recientes = [];
  const bump = (per, mod) => { if (!per) return; if (!tend[per]) tend[per] = { quejas: 0, accidentes: 0, hostigamiento: 0, subsidios: 0 }; tend[per][mod]++; };
  const addRec = (modulo, icon, fecha, titulo, estado, empresa) => { const d = rFecha(fecha); recientes.push({ modulo, icon, fecha: rYmd(d), titulo, estado, empresa, _ts: d ? d.getTime() : 0 }); };
  const [Q, A, H1, H2, S] = await Promise.all([resObjetos(pool, 'bs_quejas', P.sd), resObjetos(pool, 'bs_accidentes_casos', P.sd), ver.hostigamiento ? resObjetos(pool, 'bs_hostigamiento', P.sd) : [], ver.hostigamiento ? resObjetos(pool, 'bs_hostigamiento_olmos', P.sd) : [], resObjetos(pool, 'bs_subsidios', P.sd)]);
  const quejas = { total: 0, resueltas: 0, pendientes: 0, porEmpresa: { RAPEL: 0, VERFRUT: 0 } };
  Q.forEach(r => { quejas.total++; if (/resuelt|cerrad/i.test(rTxt(r.resultado))) quejas.resueltas++; const e = rEmp(r.empresa); if (quejas.porEmpresa[e] !== undefined) quejas.porEmpresa[e]++; bump(rYm(r.fecha_recepcion), 'quejas'); addRec('Quejas', '📋', r.fecha_recepcion, 'Queja' + (rTxt(r.categoria) ? ' · ' + rTxt(r.categoria) : ''), rTxt(r.resultado) || 'Pendiente', e); });
  quejas.pendientes = quejas.total - quejas.resueltas;
  const accidentes = { total: 0, cerrados: 0, enSeguimiento: 0, porEmpresa: { RAPEL: 0, VERFRUT: 0 } };
  A.forEach(r => { accidentes.total++; if (/cerrad/i.test(rTxt(r.estado_caso))) accidentes.cerrados++; const e = rEmp(r.empresa); if (accidentes.porEmpresa[e] !== undefined) accidentes.porEmpresa[e]++; const fa = rTxt(r.dia_reportado) || r.dia_accidente; bump(rYm(fa), 'accidentes'); const det = rTxt(r.parte_cuerpo) || rTxt(r.tipo_accidente); addRec('Accidentes', '🩺', fa, 'Accidente' + (det ? ' · ' + det : ''), rTxt(r.estado_caso) || 'En seguimiento', e); });
  accidentes.enSeguimiento = accidentes.total - accidentes.cerrados;
  const hostigamiento = { acceso: ver.hostigamiento, total: 0 };
  if (ver.hostigamiento) H1.concat(H2).forEach(r => { hostigamiento.total++; bump(rYm(r.fecha_denuncia), 'hostigamiento'); addRec('Hostigamiento', '🔒', r.fecha_denuncia, 'Denuncia registrada', rTxt(r.status) || 'En proceso', ''); });
  const subsidios = { total: 0, recuperadoEssalud: 0, montoTotal: 0, porEmpresa: { RAPEL: 0, VERFRUT: 0 }, porEstado: {} };
  S.forEach(r => { subsidios.total++; subsidios.recuperadoEssalud += rNum(r.recuperado_essalud); subsidios.montoTotal += rNum(r.monto_total); const e = rEmp(r.empresa); if (subsidios.porEmpresa[e] !== undefined) subsidios.porEmpresa[e]++; const e2 = rTxt(r.estado_general) || 'Sin estado'; subsidios.porEstado[e2] = (subsidios.porEstado[e2] || 0) + 1;
    const per = rTxt(r.anio) ? rYm(rTxt(r.anio) + '-' + rTxt(r.mes)) : rYm(r.inicio); bump(per, 'subsidios'); const fsub = rTxt(r.inicio) || (rTxt(r.anio) ? rTxt(r.anio) + '-' + ('0' + rTxt(r.mes)).slice(-2) + '-01' : ''); addRec('Subsidios', '💰', fsub, 'Subsidio' + (rTxt(r.tipo) ? ' · ' + rTxt(r.tipo) : ''), e2, e); });
  const tendencia = Object.keys(tend).sort().slice(-12).map(p => Object.assign({ periodo: p }, tend[p]));
  recientes.sort((x, y) => y._ts - x._ts);
  return { ok: true, success: true, quejas, accidentes, hostigamiento, subsidios, tendencia, recientes: recientes.slice(0, 10).map(it => ({ modulo: it.modulo, icon: it.icon, fecha: it.fecha, titulo: it.titulo, estado: it.estado, empresa: it.empresa })), generado: new Date().toISOString(), fuente: 'supabase' };
}
async function resAlertas(pool, P) {
  const ver = resPermisos(P), alertas = [];
  const push = (modulo, id, regla, descripcion, fb, fl, empresa) => { const e = rVenc(fl); alertas.push({ modulo, id, regla, descripcion, fechaBase: rYmd(fb), fechaLimite: rYmd(fl), diasRestantes: e.diasRestantes, estado: e.estado, empresa }); };
  const [Q, D, H1, H2, A] = await Promise.all([ver.quejas ? resObjetos(pool, 'bs_quejas', P.sd) : [], ver.descansos ? resObjetos(pool, 'bs_descansos', P.sd) : [], ver.hostigamiento ? resObjetos(pool, 'bs_hostigamiento', P.sd) : [], ver.hostigamiento ? resObjetos(pool, 'bs_hostigamiento_olmos', P.sd) : [], ver.accidentes ? resObjetos(pool, 'bs_accidentes_casos', P.sd) : []]);
  Q.forEach(r => { if (/resuelt|cerrad/i.test(rTxt(r.resultado))) return; const fb = rFecha(r.fecha_recepcion); if (!fb) return; const fl = RES_CFG.PLAZO_QUEJAS_TIPO === 'calendario' ? rSumaCal(fb, RES_CFG.PLAZO_QUEJAS_DIAS) : rSumaHab(fb, RES_CFG.PLAZO_QUEJAS_DIAS); push('Quejas', rTxt(r.id), 'Atencion/resolucion', 'Queja' + (rTxt(r.categoria) ? ' · ' + rTxt(r.categoria) : ''), fb, fl, rTxt(r.empresa) ? rEmp(r.empresa) : ''); });
  D.forEach(x => { if (rTxt(x.citt_estado) !== 'Pendiente de canje') return; const fb = rFecha(x.fecha_inicio); if (!fb) return; push('Descansos', x.id, 'Canje de CITT', 'DM ' + rTxt(x.tipo) + ' · ' + rTxt(x.nombre).split(/\s+/).slice(0, 2).join(' '), fb, rSumaCal(fb, RES_CFG.PLAZO_CANJE_CITT), rTxt(x.empresa)); });
  H1.concat(H2).forEach(r => { const fb = rFecha(r.fecha_denuncia); if (!fb) return; const cerrado = /cerrad|resuelt|archivad/i.test(rTxt(r.status)); if (!rTxt(r.medida_proteccion)) push('Hostigamiento', rTxt(r.id), 'Medidas de proteccion (3 dh)', 'Caso de hostigamiento #' + rTxt(r.id), fb, rSumaHab(fb, 3), ''); if (!cerrado) push('Hostigamiento', rTxt(r.id), 'Informe de investigacion (15 dcal)', 'Caso de hostigamiento #' + rTxt(r.id), fb, rSumaCal(fb, 15), ''); });
  A.forEach(r => { if (!/mortal|grave|incidente peligroso/i.test(rTxt(r.tipo_accidente) + ' ' + rTxt(r.estatus_accidente))) return; if (/cerrad/i.test(rTxt(r.estado_caso))) return; const fb = rFecha(r.dia_accidente); if (!fb) return; push('Accidentes', rTxt(r.id), 'Notificacion MTPE (24h)', 'Accidente' + (rTxt(r.parte_cuerpo) ? ' · ' + rTxt(r.parte_cuerpo) : '') + ' (mortal/grave)', fb, rSumaCal(fb, 1), rTxt(r.empresa) ? rEmp(r.empresa) : ''); });
  /* _BS_LACTANCIA_V1 (16-nov-2026): descansos por acumulación de horas de lactancia (motor compartido con la pantalla) */
  if (ver.lactancia) {
    try {
      const Lm = require('../shared/bs-lactancia-motor');
      const [LA, HO] = await Promise.all([resObjetos(pool, 'bs_gs_lactancia', P.sd), resObjetos(pool, 'bs_gs_lactancia_horarios', P.sd)]);
      const hoy = rYmd(rHoy()), horarios = HO.filter(h => !rTxt(h.anulado));
      LA.forEach(r => {
        if (rTxt(r.anulado) || rTxt(r.estado) === 'Cerrada') return;
        const R = Lm.calcular(r, { horarios, feriados: RES_CFG.FERIADOS, hoy });
        R.alertas.forEach(al => {
          const fl = new Date(al.fecha + 'T00:00:00Z');
          alertas.push({ modulo: 'Lactancia', id: rTxt(r.codigo || r.id), regla: al.tipo === 'vencido' ? 'Descanso no registrado' : al.tipo === 'fin' ? 'Fin de lactancia' : al.tipo === 'sin_programar' ? 'Horas acumuladas' : 'Descanso por lactancia',
            descripcion: rTxt(r.nombre).split(/\s+/).slice(0, 3).join(' ') + ' · ' + al.t, fechaBase: hoy, fechaLimite: al.fecha, diasRestantes: Math.round((fl - rHoy()) / 86400000), estado: al.n === 'rojo' ? 'rojo' : 'ambar', empresa: rTxt(r.empresa) });
        });
      });
    } catch (e) { try { console.warn('[bs/alertas] lactancia: ' + e.message); } catch (x) {} }
  }
  const orden = { rojo: 0, ambar: 1, verde: 2 }; alertas.sort((x, y) => (orden[x.estado] - orden[y.estado]) || (x.diasRestantes - y.diasRestantes));
  const resumen = { rojo: 0, ambar: 0, verde: 0 }; alertas.forEach(a => { resumen[a.estado]++; });
  return { ok: true, success: true, alertas, resumen, generado: new Date().toISOString(), fuente: 'supabase' };
}

/* _BS_RESUMEN_SUPABASE_V1 · GET bs/estadisticas?modulo=&usuario=&empresa=&desde=&hasta=  (antes bs_estadisticasEmpresariales en Google)
   Parámetros = copia de la hoja BS_Parametros (bs_setupParametros) al 15-nov-2026; si Joel los cambia, se cambian aquí. */
const EST_CFG = [
  { modulo: 'Quejas', claves: ['bs_quejas'], col_estado: 'resultado', estados_cierre: ['cerrado'], col_fecha_inicio: 'fecha_recepcion', col_fecha_cierre: '', col_responsable: 'created_by', plazo_dias: 7, usa_seguimiento: true },
  { modulo: 'Accidentes', claves: ['bs_accidentes_casos'], col_estado: 'estado_caso', estados_cierre: ['revisar (ej: cerrado, finalizado)'], col_fecha_inicio: 'dia_accidente', col_fecha_cierre: '', col_responsable: 'created_by', plazo_dias: 15, usa_seguimiento: false },
  { modulo: 'Hostigamiento', claves: ['bs_hostigamiento', 'bs_hostigamiento_olmos'], col_estado: 'decision', estados_cierre: ['proceso de resolución', 'improcedente'], col_fecha_inicio: 'fecha_denuncia', col_fecha_cierre: '', col_responsable: 'created_by', plazo_dias: 30, usa_seguimiento: false },
  { modulo: 'Subsidios', claves: ['bs_subsidios'], col_estado: 'estado_general', estados_cierre: ['revisar (ej: cerrado, pagado)'], col_fecha_inicio: 'inicio', col_fecha_cierre: '', col_responsable: 'created_by', plazo_dias: 15, usa_seguimiento: false },
  { modulo: 'Sugerencias', claves: ['bs_sugerencias'], col_estado: 'estado', estados_cierre: ['finalizada'], col_fecha_inicio: 'fecha', col_fecha_cierre: 'fecha_finalizado', col_responsable: 'created_by', plazo_dias: 3, usa_seguimiento: false }
];
const estDMY = d => d ? ('0' + d.getUTCDate()).slice(-2) + '/' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '/' + d.getUTCFullYear() : '';
async function resEstadisticas(pool, P, q) {
  const ver = resPermisos(P), fModulo = q.modulo && q.modulo !== 'Todos' ? q.modulo : null, fUsuario = q.usuario && q.usuario !== 'Todos' ? q.usuario : null, fEmpresa = q.empresa && q.empresa !== 'Todas' ? q.empresa : null;
  const fDesde = q.desde ? rFecha(q.desde) : null, fHasta = q.hasta ? rFecha(q.hasta) : null, hoy = rHoy();
  const cfgs = EST_CFG.filter(c => c.modulo !== 'Hostigamiento' || ver.hostigamiento);   /* hostigamiento solo con permiso */
  const cache = {}; for (const cfg of cfgs) { let rows = []; for (const k of cfg.claves) rows = rows.concat(await resObjetos(pool, k, P.sd)); cache[cfg.modulo] = rows; }
  const usuariosSet = {}; cfgs.forEach(cfg => cache[cfg.modulo].forEach(r => { const u = rTxt(r.created_by); if (u) usuariosSet[u] = true; }));
  const totales = {}, estados = {}, porEmpresa = { RAPEL: {}, VERFRUT: {} }, tendMap = {}, usuariosMap = {}, cumpModulo = {}, cumpUsuario = {}, vencidos = [];
  let generalTotal = 0; const nuevoCump = () => ({ total: 0, cerrados: 0, a_tiempo: 0, fuera: 0, abierto_plazo: 0, vencido: 0, suma_dias_cierre: 0, n_cierre: 0 }); const cumpGlobal = nuevoCump();
  cfgs.forEach(cfg => {
    if (fModulo && cfg.modulo !== fModulo) return;
    totales[cfg.modulo] = totales[cfg.modulo] || 0; estados[cfg.modulo] = estados[cfg.modulo] || {}; cumpModulo[cfg.modulo] = cumpModulo[cfg.modulo] || nuevoCump();
    cache[cfg.modulo].forEach(row => {
      const cbVal = rTxt(row.created_by), respVal = rTxt(row[cfg.col_responsable]) || cbVal, emp = rTxt(row.empresa);
      let fIni = rFecha(row[cfg.col_fecha_inicio]) || rFecha(row.created_at);
      if (fUsuario && respVal !== fUsuario && cbVal !== fUsuario) return;
      if (fEmpresa && emp !== fEmpresa) return;
      if (fDesde && fIni && fIni < fDesde) return; if (fHasta && fIni && fIni > fHasta) return;
      totales[cfg.modulo]++; generalTotal++;
      const est = rTxt(row[cfg.col_estado]) || '(sin estado)'; estados[cfg.modulo][est] = (estados[cfg.modulo][est] || 0) + 1;
      if (emp === 'RAPEL' || emp === 'VERFRUT') porEmpresa[emp][cfg.modulo] = (porEmpresa[emp][cfg.modulo] || 0) + 1;
      if (fIni) { const ym = rYmd(fIni).slice(0, 7); tendMap[ym] = tendMap[ym] || {}; tendMap[ym][cfg.modulo] = (tendMap[ym][cfg.modulo] || 0) + 1; }
      const ukey = cbVal || respVal || '(sin usuario)'; usuariosMap[ukey] = usuariosMap[ukey] || { total: 0, porModulo: {} }; usuariosMap[ukey].total++; usuariosMap[ukey].porModulo[cfg.modulo] = (usuariosMap[ukey].porModulo[cfg.modulo] || 0) + 1;
      const esCierre = cfg.estados_cierre.length > 0 && cfg.estados_cierre.indexOf(est.toLowerCase()) >= 0;
      let limite = null;
      if (cfg.usa_seguimiento && rTxt(row.seguimiento) === 'Sí') limite = rFecha(row.seguimiento_fin);
      if (!limite && fIni && cfg.plazo_dias > 0) limite = rSumaCal(fIni, cfg.plazo_dias);
      const CM = cumpModulo[cfg.modulo]; cumpUsuario[ukey] = cumpUsuario[ukey] || nuevoCump(); const CU = cumpUsuario[ukey];
      CM.total++; CU.total++; cumpGlobal.total++;
      if (esCierre) {
        CM.cerrados++; CU.cerrados++; cumpGlobal.cerrados++;
        const fCierre = (cfg.col_fecha_cierre ? rFecha(row[cfg.col_fecha_cierre]) : null) || rFecha(row.updated_at);
        const aTiempo = (limite && fCierre) ? (fCierre <= limite) : true;
        if (aTiempo) { CM.a_tiempo++; CU.a_tiempo++; cumpGlobal.a_tiempo++; } else { CM.fuera++; CU.fuera++; cumpGlobal.fuera++; }
        if (fIni && fCierre) { const dd = Math.round((fCierre - fIni) / 86400000); if (dd >= 0) { CM.suma_dias_cierre += dd; CM.n_cierre++; CU.suma_dias_cierre += dd; CU.n_cierre++; cumpGlobal.suma_dias_cierre += dd; cumpGlobal.n_cierre++; } }
      } else if (limite && hoy > limite) {
        CM.vencido++; CU.vencido++; cumpGlobal.vencido++;
        vencidos.push({ modulo: cfg.modulo, id: row.id != null ? row.id : '', usuario: ukey, empresa: emp, fecha_inicio: estDMY(fIni), limite: estDMY(limite), dias_vencido: Math.round((hoy - limite) / 86400000) });
      } else { CM.abierto_plazo++; CU.abierto_plazo++; cumpGlobal.abierto_plazo++; }
    });
  });
  const cerrar = c => { const cumplidos = c.a_tiempo + c.abierto_plazo; c.pct_cierre = c.total ? Math.round(c.cerrados * 1000 / c.total) / 10 : 0; c.pct_cumplimiento = c.total ? Math.round(cumplidos * 1000 / c.total) / 10 : 0; c.pct_a_tiempo = c.cerrados ? Math.round(c.a_tiempo * 1000 / c.cerrados) / 10 : 0; c.tiempo_prom_cierre = c.n_cierre ? Math.round(c.suma_dias_cierre * 10 / c.n_cierre) / 10 : 0; delete c.suma_dias_cierre; delete c.n_cierre; return c; };
  cerrar(cumpGlobal); Object.keys(cumpModulo).forEach(k => cerrar(cumpModulo[k]));
  const porUsuario = Object.keys(cumpUsuario).map(k => { const c = cerrar(cumpUsuario[k]); c.usuario = k; return c; }).sort((a, b) => b.pct_cumplimiento - a.pct_cumplimiento);
  vencidos.sort((a, b) => b.dias_vencido - a.dias_vencido);
  const ymKeys = Object.keys(tendMap).sort(), modList = cfgs.filter(cf => !fModulo || cf.modulo === fModulo).map(cf => cf.modulo), tendencia = { labels: ymKeys, series: {} };
  modList.forEach(m => { tendencia.series[m] = ymKeys.map(k => tendMap[k][m] || 0); });
  const usuarios = Object.keys(usuariosMap).map(k => ({ usuario: k, total: usuariosMap[k].total, porModulo: usuariosMap[k].porModulo })).sort((a, b) => b.total - a.total);
  const gen = new Date(Date.now() - 5 * 3600e3).toISOString();
  return { ok: true, success: true, generado: gen.slice(0, 10) + ' ' + gen.slice(11, 16), filtros: { modulo: fModulo || 'Todos', usuario: fUsuario || 'Todos', empresa: fEmpresa || 'Todas', desde: q.desde || '', hasta: q.hasta || '' }, totales, general: generalTotal, porEmpresa, estados, tendencia, usuarios, usuariosDisponibles: Object.keys(usuariosSet).sort(), cumplimiento: { global: cumpGlobal, porModulo: cumpModulo, porUsuario, vencidosAbiertos: vencidos.slice(0, 100) }, fuente: 'supabase' };
}

module.exports = async function (context, req) {
  const accion = String(context.bindingData.accion || '').toLowerCase(), q = req.query || {};
  const res = (status, body) => { context.res = { status, headers: { 'Content-Type': 'application/json' }, body }; };
  if (accion === 'canal') { try { return await canalRecibir(req, res); } catch (e) { context.log && context.log.error && context.log.error('[bs/canal] ' + (e && e.message)); return res(500, { ok: false, success: false, message: 'Error del servidor: ' + ((e && e.message) || e) }); } }
  const u = exigirAuth(context, req); if (u === null) return;
  try {
    const pool = await getPool();
    if (accion === 'ficha') {
      const dni = String(q.dni || '').trim(); if (!/^\d{8}$/.test(dni)) return res(400, { ok: false, success: false, message: 'DNI inválido (8 dígitos).' });
      /* _BS_PERMISOS_SERVIDOR_V1 (08-nov-2026): antes el rol podia venir en ?rol= y los permisos en ?permisos= (el navegador
         decidia). Ahora el rol sale SOLO del token y los permisos de "Acceso a Modulos" del RR.LL. (dbo.PermisosModulos). */
      const P = await permisosBS(u, q);
      const out = await ficha(pool, dni, P.permisos, P.esAdmin, await sedeBS(pool, u)); out.success = true; out.permisos_fuente = P.fuente; return res(200, out);
    }
    if (accion === 'estadisticas') {   /* _BS_RESUMEN_SUPABASE_V1: Estadísticas empresariales (solo administración / permiso estadisticas) */
      const P = await permisosBS(u, q); if (!P.esAdmin && !P.permisos.estadisticas) return res(403, { ok: false, success: false, message: 'Sin permiso para Estadísticas.' });
      P.sd = await sedeBS(pool, u);   /* _BS_SEDE_V1 */
      return res(200, await resEstadisticas(pool, P, q));
    }
    if (accion === 'dashboard' || accion === 'alertas') {   /* _BS_RESUMEN_SUPABASE_V1 (15-nov-2026): KPIs y alertas del portal desde Supabase */
      const P = await permisosBS(u, q); P.sd = await sedeBS(pool, u);   /* _BS_SEDE_V1 */
      return res(200, accion === 'dashboard' ? await resDashboard(pool, P) : await resAlertas(pool, P));
    }
    if (accion === 'permisos') {   /* _BS_GESTION_SOCIAL_V1 (14-nov-2026): permisos de Bienestar decididos en el servidor ("Acceso a Modulos" del RR.LL.), para que el portal de Bienestar los use en vez de la hoja Usuarios congelada */
      const P = await permisosBS(u, q);
      return res(200, { ok: true, success: true, usuario: String((u && u.usuario) || '').toLowerCase(), esAdmin: P.esAdmin, permisos: P.permisos, fuente: P.fuente });
    }
    if (accion === 'tabla') {
      const clave = String(q.clave || ''); if (CLAVES.indexOf(clave) < 0) return res(400, { success: false, error: 'clave desconocida' });
      if (clave === 'bs_auditoria') { const rolA = String((u && (u.rol || u.role)) || '').toLowerCase(), usA = String((u && u.usuario) || '').toLowerCase();
        if (rolA.indexOf('admin') < 0 && !/coordinador|jefa/.test(rolA) && ['jtimoteo'].indexOf(usA) < 0) return res(403   /* _SEG_SERVIDOR_V1 (10-nov-2026): se retiro a ovilela (ya no trabaja en el area) */, { success: false, error: 'Solo administradores pueden ver la auditoría.' }); }
      /* _BS_PERMISOS_SERVIDOR_V1: cada tabla exige el permiso de su modulo (calculado en el servidor) */
      const modT = MODULO_DE_CLAVE[clave] || '';
      if (modT && clave !== 'bs_auditoria') { const PT = await permisosBS(u, q); if (!PT.esAdmin && !PT.permisos[modT]) return res(403, { success: false, error: 'Sin permiso para el módulo ' + modT + '.' }); }
      let filas = await objetos(pool, clave, String(q.hora || '') === '1', await sedeBS(pool, u)); if (filas === null) return res(200, { success: true, cargada: false, items: [] });
      if (String(q.anulados || '') !== '1') filas = filas.filter(o => !anulado(o));   /* _BS_GUARDA_SUPABASE_V1: las páginas de módulo piden anulados=1 y los ocultan ellas (casilla "Ver anulados") */
      const dni = String(q.dni || '').trim(); if (dni) filas = filas.filter(o => [o.dni, o.numero, o.denunciante_dni, o.denunciado_dni].some(v => String(v || '').trim() === dni));
      return res(200, { success: true, cargada: true, total: filas.length, items: filas });
    }
    if (accion === 'padron') {   /* _BS_DASH_PRO_V1 (07-nov): personal del padrón por empresa, para la tasa de casos de los dashboards (antes bs_clasificacion en Google, 2-4 s) */
      const ex = await EMP.tablasExistentes(pool, sql);
      const out = { ok: true, success: true, total: 0, vigentes: 0, porEmpresa: {}, fuente: 'supabase' };
      for (const e of EMP.EMPRESAS) {
        if (!ex.has(e.tabla)) continue;
        const r = await pool.request().query(`SELECT COUNT(*) AS n, SUM(CASE WHEN fecha_termino IS NULL OR fecha_termino >= CAST(GETDATE() AS DATE) THEN 1 ELSE 0 END) AS v FROM dbo.${e.tabla} WHERE dni IS NOT NULL`);
        const n = Number((r.recordset[0] || {}).n || 0), v = Number((r.recordset[0] || {}).v || 0);
        out.porEmpresa[e.codigo] = { total: n, vigentes: v }; out.total += n; out.vigentes += v;
      }
      return res(200, out);
    }
    /* ═══ _BS_GUARDA_SUPABASE_V1 (08-nov-2026): ESCRITURAS directas en Supabase ═══
       POST bs/guardar { clave, op: crear|actualizar|seguimiento|anular|restaurar|importar|cierre_masivo, id, datos, motivo, filas }
       Solo si BS_Fuente dice que esa tabla ya manda desde Supabase (si no: 409 fuente:'hoja' y el navegador sigue con Google).
       El rol sale del token y los permisos de "Acceso a Módulos" del RR.LL. (permisosBS). Todo queda en BS_Auditoria. */
    if (accion === 'guardar') {
      if (String(req.method || 'POST').toUpperCase() !== 'POST') return res(405, { success: false, error: 'Usa POST' });
      const b = req.body || {}, clave = String(b.clave || ''), op = String(b.op || '').toLowerCase();
      if (CLAVES.indexOf(clave) < 0 || clave === 'bs_auditoria') return res(400, { ok: false, success: false, message: 'Tabla desconocida: ' + clave });
      /* clave interna (Apps Script, p. ej. generar subsidio desde un descanso médico): el usuario viene en el cuerpo y no se filtran permisos */
      const usuario = String((u && u.interno ? (req.body || {}).usuario : (u && u.usuario)) || '').toLowerCase();
      if (!usuario) return res(401, { ok: false, success: false, message: 'Sesión sin usuario.' });
      const fuente = await BG.fuenteDe(pool, clave);
      if (fuente !== 'supabase') return res(409, { ok: false, success: false, fuente, message: 'La tabla ' + clave + ' todavía se guarda en Google.' });
      const modG = MODULO_DE_CLAVE[clave] || '';
      const PG = u && u.interno ? { esAdmin: true, permisos: {} } : await permisosBS(u, q);
      if (!PG.esAdmin && modG && !PG.permisos[modG]) return res(403, { ok: false, success: false, message: 'Sin permiso para el módulo ' + modG + '.' });
      /* _SEDE_ESCRITURA_V1 (21-nov-2026): no se modifica, anula ni restaura un registro de la otra sede.
         importar y cierre masivo solo tocan los registros de la sede de quien los ejecuta (_SEDE_ESCRITURA_V2) */
      let filtroSede = null;
      if (!(u && u.interno)) {
        const sdG = await sedeBS(pool, u);
        if (sdG) {
          filtroSede = o => filaOlmosBS(clave, o, sdG.o) === (sdG.modo === 'OLMOS');
          if (op !== 'crear' && b.id !== undefined && b.id !== null && b.id !== '') {
            const todas = (await objetosTodos(pool, clave)) || [], reg = todas.filter(o => String(o.id) === String(b.id))[0];
            if (reg && filaOlmosBS(clave, reg, sdG.o) !== (sdG.modo === 'OLMOS')) return res(403, { ok: false, success: false, otra_sede: true, message: SD.MSG_OTRA_SEDE });
          }
        }
      }
      /* anular/restaurar: igual que hoy en Google, basta el permiso del módulo (queda en auditoría con usuario y motivo) */
      let out;
      if (op === 'crear') out = await BG.crear(pool, clave, b.datos || {}, usuario);
      else if (op === 'actualizar') { if (b.id === undefined || b.id === null || b.id === '') return res(400, { ok: false, success: false, message: 'Falta el id.' }); out = await BG.actualizar(pool, clave, b.id, b.datos || {}, usuario); }
      else if (op === 'seguimiento') { if (!BG.SEGUIMIENTO[clave]) return res(400, { ok: false, success: false, message: clave + ' no lleva seguimientos.' }); out = await BG.seguimiento(pool, clave, b.id, b.datos || {}, usuario); }
      else if (op === 'anular') out = await BG.anular(pool, clave, b.id, b.motivo, usuario);
      else if (op === 'eliminar') out = await BG.anular(pool, clave, b.id, String(b.motivo || 'Eliminado desde el módulo'), usuario);   /* en Supabase no se borra: queda anulado y sale de la vista */
      else if (op === 'restaurar') out = await BG.restaurar(pool, clave, b.id, usuario, b.motivo);
      else if (op === 'importar') out = await BG.importar(pool, clave, b.filas, usuario, b.modo, filtroSede);
      else if (op === 'generar_subsidio') { if (clave !== 'bs_descansos') return res(400, { ok: false, success: false, message: 'Solo desde descansos médicos.' }); out = await BG.generarSubsidioDM(pool, b.id, usuario); }
      else if (op === 'cierre_masivo') { if (!PG.esAdmin) return res(403, { ok: false, success: false, message: 'Solo administradores pueden hacer cierres masivos.' }); out = await BG.cerrarMasivo(pool, clave, b, usuario, filtroSede); }
      else return res(400, { ok: false, success: false, message: 'Operación desconocida: ' + op });
      const st = out.status || 200; delete out.status;
      return res(st, out);
    }
    /* bs/doc — adjuntos (evidencias) en el bucket privado 'bienestar':
       GET  bs/doc?modulo=&caso_id=   lista del caso · GET bs/doc?id=  enlace firmado (5 min) o {drive:true} si es histórico de Drive
       POST bs/doc { modulo, caso_id, nombre, mime, base64 }  sube (imagen/PDF ≤ 6 MB) y registra la fila + auditoría */
    if (accion === 'doc') {
      if (u && u.interno) return res(403, { ok: false, success: false, message: 'bs/doc exige la sesión de un usuario.' });
      const usuario = String((u && u.usuario) || '').toLowerCase(); if (!usuario) return res(401, { ok: false, success: false, message: 'Sesión sin usuario.' });
      const fuente = await BG.fuenteDe(pool, 'bs_documentos');
      if (fuente !== 'supabase') return res(409, { ok: false, success: false, fuente, message: 'Los adjuntos todavía se guardan en Google.' });
      const PG = await permisosBS(u, q);
      /* _SEDE_ESCRITURA_V2 (21-nov-2026): los adjuntos siguen la sede de su caso. Se busca el caso en las tablas de su modulo;
         si existe y ninguno es de la sede del usuario -> 403. Si no se ubica el caso, pasa (como antes). */
      const sdD = (u && u.interno) ? null : await sedeBS(pool, u);
      const casoDeOtraSede = async (modulo, casoId) => {
        if (!sdD || casoId === undefined || casoId === null || casoId === '') return false;
        const md = BG.docModulo(modulo); if (!md) return false;
        const claves = Object.keys(MODULO_DE_CLAVE).filter(k => MODULO_DE_CLAVE[k] === md && k !== 'bs_documentos' && !/seguim|_horarios$/.test(k));
        let hallados = 0, propios = 0;
        for (const k of claves) { const filas = (await objetosTodos(pool, k).catch(() => null)) || []; filas.filter(o => String(o.id) === String(casoId)).forEach(o => { hallados++; if (filaOlmosBS(k, o, sdD.o) === (sdD.modo === 'OLMOS')) propios++; }); }
        return hallados > 0 && propios === 0;
      };
      if (String(req.method || 'GET').toUpperCase() === 'POST') {
        const b = req.body || {}, modG = BG.docModulo(b.modulo);
        if (await casoDeOtraSede(b.modulo, b.caso_id)) return res(403, { ok: false, success: false, otra_sede: true, message: SD.MSG_OTRA_SEDE });
        if (modG && !PG.esAdmin && !PG.permisos[modG]) return res(403, { ok: false, success: false, message: 'Sin permiso para el módulo ' + modG + '.' });
        const out = await BG.docSubir(pool, b, usuario); const st = out.status || 200; delete out.status; return res(st, out);
      }
      if (q.id) {
        if (sdD) { const dd = ((await objetosTodos(pool, 'bs_documentos').catch(() => null)) || []).filter(o => String(o.id) === String(q.id))[0]; if (dd && await casoDeOtraSede(dd.modulo, dd.caso_id !== undefined ? dd.caso_id : dd.id_caso)) return res(403, { ok: false, success: false, otra_sede: true, message: SD.MSG_OTRA_SEDE }); }
        const out = await BG.docVer(pool, q.id, PG); const st = out.status || 200; delete out.status; return res(st, out); }
      const modL = BG.docModulo(q.modulo);
      if (!q.modulo || !q.caso_id) return res(400, { ok: false, success: false, message: 'Faltan modulo y caso_id.' });
      if (modL && !PG.esAdmin && !PG.permisos[modL]) return res(403, { ok: false, success: false, message: 'Sin permiso para el módulo ' + modL + '.' });
      if (await casoDeOtraSede(q.modulo, q.caso_id)) return res(403, { ok: false, success: false, otra_sede: true, message: SD.MSG_OTRA_SEDE });
      return res(200, await BG.docListar(pool, q.modulo, q.caso_id));
    }
    /* POST bs/auditar { usuario, accion, modulo, registro_id, detalle } — evento suelto. Lo manda el Apps Script (clave interna) por cada
       escritura que aún hace en Google, y el navegador (ACCESO / EXPORTAR). Con sesión de usuario, el usuario es el del token. */
    if (accion === 'auditar') {
      if (String(req.method || 'POST').toUpperCase() !== 'POST') return res(405, { success: false, error: 'Usa POST' });
      const b = req.body || {}, usuario = u && u.interno ? String(b.usuario || 'servidor-google') : String((u && u.usuario) || '');
      if (!usuario) return res(401, { ok: false, success: false, message: 'Sesión sin usuario.' });
      const acc = String(b.accion || '').trim().toUpperCase().slice(0, 60);
      if (!acc) return res(400, { ok: false, success: false, message: 'Falta la acción.' });
      return res(200, await BG.registrarEvento(pool, { usuario, accion: acc, modulo: String(b.modulo || '').toLowerCase().slice(0, 60), registro_id: b.registro_id, detalle: String(b.detalle || '').slice(0, 500) }));
    }
    /* GET bs/fuente → quién manda por tabla · POST bs/fuente { clave, fuente } (solo Joel/clave interna) → cambia la fuente */
    if (accion === 'fuente') {
      if (String(req.method || 'GET').toUpperCase() === 'POST') {
        const usF = String((u && u.usuario) || '').toLowerCase();
        if (!(u && u.interno) && usF !== 'jtimoteo') return res(403, { ok: false, success: false, message: 'Solo el coordinador puede cambiar la fuente de una tabla.' });
        const b = req.body || {};
        const f = await BG.ponerFuente(pool, String(b.clave || ''), String(b.fuente || ''), usF || 'servidor-google');
        return res(200, { ok: true, success: true, clave: b.clave, fuente: f });
      }
      return res(200, { ok: true, success: true, tablas: await BG.fuentes(pool) });
    }
    /* POST bs/respaldo [{ dias }] — copia diaria de todas las tablas bs_* al bucket privado 'respaldos' (lo dispara el Apps Script a la 01:00) */
    if (accion === 'respaldo') {
      if (String(req.method || 'POST').toUpperCase() !== 'POST') return res(405, { success: false, error: 'Usa POST' });
      const usR = String((u && u.usuario) || '').toLowerCase();
      if (!(u && u.interno) && usR !== 'jtimoteo') return res(403, { ok: false, success: false, message: 'Solo el sistema o el coordinador pueden lanzar el respaldo.' });
      return res(200, await BG.respaldar(pool, (req.body || {}).dias));
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
    return res(e.status || 500, { ok: false, success: false, message: e.message, error: e.message });   /* _SEG_SERVIDOR_V2: respeta el 503 de permisos sin respuesta */
  }
};
