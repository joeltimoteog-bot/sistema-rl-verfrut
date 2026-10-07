/* ═══════════════════════════════════════════════════════════════════════════
   cumpl-motor (_CUMPL_AZURE_V1, 26-set-2026) — MOTOR DE CUMPLIMIENTO en Azure
   ---------------------------------------------------------------------------
   Copia FIEL del motor del Apps Script (cumplPendientes, cumplPanel,
   cumplIndice_, cumplActividadCaso_, cumplVisitasPendientes_,
   cumplRestriccion_ y getCumplimiento). Mismos plazos, mismo semaforo,
   mismos textos y el mismo orden de campos: la pantalla recibe lo mismo.
   Fechas: todo se trabaja como "dia calendario de Lima" (medianoche UTC del
   dia), asi el servidor de Azure (UTC) cuenta los dias igual que Google.
   Entrada (la manda el Apps Script por cumpl-importar):
     casos, config, usuarios, sups, restricc, constantes
   + las visitas y casos recientes que ya estan en dbo.CV_Visitas / CV_Casos.
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';

const DIA = 86400000;
const MESES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const PESO = { EN_PLAZO: 0, PROXIMO: 1, VENCE_HOY: 2, VENCIDO: 3, CRITICO: 4 };
const ROLES_ADMIN = ['administrador', 'administrador 01', 'administrador 02', 'coordinador', 'jefa_rl'];

const fecha = (y, m, d) => new Date(Date.UTC(y, m, d));
const copia = (d) => new Date(d.getTime());
const sumar = (d, n) => { const x = copia(d); x.setUTCDate(x.getUTCDate() + n); return x; };
function limaDe(d) {
  const s = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const p = s.split('-').map(Number);
  return fecha(p[0], p[1] - 1, p[2]);
}
const hoyLima = () => limaDe(new Date());
const ymd = (d) => d ? d.toISOString().slice(0, 10) : '';
const dmy = (d) => { const s = ymd(d); return s ? s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4) : ''; };
const ddmm = (d) => ('0' + d.getUTCDate()).slice(-2) + '/' + ('0' + (d.getUTCMonth() + 1)).slice(-2);
const usr = (u) => String(u || '').trim().toLowerCase();
const dias = (a, b) => Math.round((b.getTime() - a.getTime()) / DIA);
const esAdminRol = (rol) => ROLES_ADMIN.indexOf(String(rol || '').trim().toLowerCase()) >= 0;

/* _casoParse */
function parse(v) {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : limaDe(v);
  const s = String(v).trim();
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return fecha(+m[3], +m[2] - 1, +m[1]);
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return fecha(+m[1], +m[2] - 1, +m[3]);
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : limaDe(d);
}
/* _cumplFecha_ */
function fechaV(x) {
  if (!x) return null;
  const d = new Date(String(x).split('T')[0] + 'T00:00:00Z');
  return isNaN(d.getTime()) ? null : d;
}
/* _cumplSemanaNum_ */
function semanaNum(d) {
  const ini = fecha(d.getUTCFullYear(), 0, 1);
  return Math.ceil(((d - ini) / DIA + ini.getUTCDay() + 1) / 7);
}
/* _casoNombreMatch */
function nombreMatch(a, b) {
  const norm = (s) => ' ' + String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim() + ' ';
  const A = norm(a), B = norm(b);
  if (A === '  ' || B === '  ') return false;
  const toks = B.trim().split(' ').filter(t => t.length >= 3);
  if (!toks.length) return false;
  const need = Math.min(2, toks.length);
  let hit = 0;
  for (const t of toks) if (A.indexOf(' ' + t + ' ') !== -1) hit++;
  return hit >= need;
}

/* _CALENDARIO_V1 (27-set-2026): = _calParseDias_ / _calParseFeriados_ del Apps Script */
function calParseDias(v) {
  if (Array.isArray(v)) v = v.join(',');
  const M = { DOM: 0, LUN: 1, MAR: 2, MIE: 3, JUE: 4, VIE: 5, SAB: 6 }, out = [];
  String(v == null ? '' : v).toUpperCase().split(/[,;\s]+/).forEach(t => {
    t = t.trim(); if (!t) return;
    const n = /^[0-6]$/.test(t) ? +t : M[t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').slice(0, 3)];
    if (n !== undefined && out.indexOf(n) < 0) out.push(n);
  });
  return out.length ? out.sort() : [1, 2, 3, 4, 5];
}
function calParseFeriados(v) {
  const out = [], add = d => { if (d && out.indexOf(d) < 0) out.push(d); };
  if (Array.isArray(v)) v = v.join(',');
  const s = String(v == null ? '' : v);
  if (/^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(s.trim())) { add(ymd(limaDe(new Date(s.trim())))); return out; }   /* una sola fecha: la hoja la volvio fecha */
  s.split(/[,;\s]+/).forEach(t => {
    let m;
    if ((m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) add(m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2));
    else if ((m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) add(m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2));
  });
  return out.sort();
}

/* _AUSENCIAS_V1 (27-set-2026) — AUSENCIA / REEMPLAZO temporal (vacaciones, descanso medico, accidente, licencia)
   Se guardan en CUMPL_CONFIG clave 'ausencias' (JSON). Mientras la ausencia esta vigente:
     · los casos del titular los asume su reemplazo (plazos, avisos, escalamiento) y regresan solos al volver;
     · la semana de visitas en que falto la MAYOR PARTE de los dias habiles la responde el reemplazo;
     · el indice del titular no cuenta esos dias; lo cubierto suma al indice del reemplazo.
   Copia EXACTA en el Apps Script (cumplAusCtx_ / cumplAusAplicar_). */
const AUS_TIPOS = ['VACACIONES', 'DESCANSO MEDICO', 'ACCIDENTE', 'LICENCIA', 'OTRO'];
function ausParse(v) {
  let arr = [];
  try { arr = JSON.parse(String(v === null || v === undefined || v === '' ? '[]' : v)); } catch (e) { arr = []; }
  return Array.isArray(arr) ? arr.filter(a => a && typeof a === 'object' && a.id && a.usuario && a.desde) : [];
}
function crearAus(raw, usuarios, esDel, esHabil) {
  const todas = ausParse(raw && raw.ausencias), lista = todas.filter(a => !a.anulada);
  const by = {};
  (usuarios || []).forEach(u => { if (u && u.usuario && !by[u.usuario]) by[u.usuario] = u; });
  const vig = (a, s) => a.desde <= s && (!a.hasta || s <= a.hasta);
  function ausencia(u, s) { if (!u) return null; for (const a of lista) if (usr(a.usuario) === u.usuario && vig(a, s)) return a; return null; }
  function reemp(a) { const r = a ? by[usr(a.reemplazo)] : null; return r && r.activo && r.usuario !== usr(a.usuario) ? r : null; }
  function titular(a) { return by[usr(a.usuario)] || { usuario: usr(a.usuario), nombre: String(a.nombre || '') }; }
  function coberturas(u, s) { return u ? lista.filter(a => vig(a, s) && usr(a.reemplazo) === u.usuario && reemp(a)) : []; }
  /* dueno de un caso en una fecha: el titular, salvo que ese dia este ausente con reemplazo (entonces el reemplazo) */
  /* el reemplazo asume solo los casos de los que el titular es el RESPONSABLE (supervisor; si no hay, quien lo registro) */
  const esResp = (c, t) => esDel({ supervisor: c.supervisor || c.registrado_por, registrado_por: '' }, t);
  function duenoEn(c, u, s) {
    if (esDel(c, u)) { const a = ausencia(u, s); if (!(a && reemp(a))) return true; }
    return coberturas(u, s).some(a => esResp(c, titular(a)));
  }
  function cobCaso(c, s) { for (const a of lista) if (vig(a, s) && reemp(a) && esResp(c, titular(a))) return a; return null; }
  /* ausencia que cubre la MAYORIA de los dias habiles de la semana que empieza el lunes 'lunes' (Date) */
  function semana(u, lunes, ymdF, sumarF) {
    let hab = 0; const cnt = {}, obj = {};
    for (let i = 0; i < 7; i++) {
      const d = sumarF(lunes, i); if (!esHabil(d)) continue; hab++;
      const a = ausencia(u, ymdF(d)); if (a) { cnt[a.id] = (cnt[a.id] || 0) + 1; obj[a.id] = a; }
    }
    let best = null, n = 0;
    Object.keys(cnt).forEach(k => { if (cnt[k] > n) { n = cnt[k]; best = obj[k]; } });
    return best && n * 2 > hab ? best : null;
  }
  function etiqueta(o, a) { o.cubre_a = String(titular(a).nombre || a.nombre || ''); o.ausencia_tipo = String(a.tipo || ''); o.ausencia_hasta = String(a.hasta || ''); return o; }
  return { todas, lista, vig, ausencia, reemp, titular, coberturas, duenoEn, cobCaso, semana, etiqueta };
}
/* Registrar / editar / reincorporar / anular. Devuelve { lista, id, log } o { error }. hoyS = 'aaaa-mm-dd' de Lima */
function ausAplicar(lista, b, usuarios, hoyS, ahoraTxt, por) {
  const L = JSON.parse(JSON.stringify(lista || []));
  const op = String(b.op || 'registrar');
  const esF = s => /^\d{4}-\d\d-\d\d$/.test(s) && !isNaN(new Date(s + 'T00:00:00Z').getTime()) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;
  const menos1 = s => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); };
  const by = {}; (usuarios || []).forEach(u => { if (u && u.usuario && !by[u.usuario]) by[u.usuario] = u; });
  const dmyS = s => s ? s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4) : '';
  if (op === 'registrar' || op === 'editar') {
    let a = null;
    if (op === 'editar') { a = L.find(x => x.id === String(b.id || '')); if (!a || a.anulada) return { error: 'No se encontro la ausencia.' }; }
    const tit = by[usr(op === 'editar' ? a.usuario : b.titular)];
    if (!tit) return { error: 'Usuario no encontrado.' };
    const tipo = String(b.tipo || '').trim().toUpperCase();
    if (AUS_TIPOS.indexOf(tipo) < 0) return { error: 'Elige el tipo de ausencia.' };
    const desde = String(b.desde || '').trim(), hasta = String(b.hasta || '').trim();
    if (!esF(desde)) return { error: 'Fecha de inicio no valida.' };
    if (hasta && !esF(hasta)) return { error: 'Fecha de fin no valida.' };
    if (hasta && hasta < desde) return { error: 'La fecha de fin es anterior al inicio.' };
    const rp = by[usr(b.reemplazo)];
    if (!rp || !rp.activo) return { error: 'Elige un reemplazo activo.' };
    if (rp.usuario === tit.usuario) return { error: 'El reemplazo no puede ser la misma persona.' };
    const cruce = L.find(x => !x.anulada && x.id !== (a && a.id) && usr(x.usuario) === tit.usuario && x.desde <= (hasta || '9999-12-31') && desde <= (x.hasta || '9999-12-31'));
    if (cruce) return { error: 'Ya tiene una ausencia registrada que se cruza (' + dmyS(cruce.desde) + (cruce.hasta ? ' al ' + dmyS(cruce.hasta) : ' en adelante') + ').' };
    const obs = String(b.obs || '').trim().slice(0, 300);
    if (op === 'registrar') {
      a = { id: 'AUS-' + String(b.id_nuevo || '').replace(/[^\w-]/g, '').slice(0, 24), usuario: tit.usuario, nombre: tit.nombre };
      if (a.id === 'AUS-') return { error: 'Falta el identificador.' };
      if (L.some(x => x.id === a.id)) return { error: 'Esa ausencia ya fue registrada.' };
      a.registrado = ahoraTxt; a.por = por;
      L.push(a);
    } else { a.editado = ahoraTxt; a.editado_por = por; }
    a.tipo = tipo; a.desde = desde; a.hasta = hasta; a.reemplazo = rp.usuario; a.reemplazo_nombre = rp.nombre; a.obs = obs;
    return { lista: L, id: a.id, a, log: [tit.usuario, op === 'registrar' ? 'REGISTRADA' : 'EDITADA', tipo + ' ' + dmyS(desde) + (hasta ? ' al ' + dmyS(hasta) : ' en adelante') + ' · reemplazo: ' + rp.nombre + (obs ? ' · ' + obs : '')] };
  }
  if (op === 'reincorporar' || op === 'anular') {
    const a = L.find(x => x.id === String(b.id || ''));
    if (!a || a.anulada) return { error: 'No se encontro la ausencia.' };
    if (op === 'reincorporar') {
      const vuelve = String(b.regreso || hoyS).trim();
      if (!esF(vuelve)) return { error: 'Fecha de regreso no valida.' };
      const h = menos1(vuelve);
      if (h < a.desde) { a.anulada = true; a.anulado = ahoraTxt; a.anulado_por = por; }
      else { a.hasta = h; a.reincorporado = ahoraTxt; a.reincorporado_por = por; }
      return { lista: L, id: a.id, a, log: [usr(a.usuario), 'REINCORPORADO', 'Regresa el ' + dmyS(vuelve)] };
    }
    a.anulada = true; a.anulado = ahoraTxt; a.anulado_por = por;
    return { lista: L, id: a.id, a, log: [usr(a.usuario), 'ANULADA', String(a.tipo || '') + ' ' + dmyS(a.desde)] };
  }
  return { error: 'Operacion no valida.' };
}

/* _PLAZO_VIGENTE_V1 (28-set-2026): = cumplPlazosHist_ / cumplPlazoEn_ del Apps Script */
function plazosHist(raw) {
  const v = raw && raw.plazos_historial; let arr = [];
  try { arr = JSON.parse(String(v === null || v === undefined || v === '' ? '[]' : v)); } catch (e) { arr = []; }
  return Array.isArray(arr) ? arr.filter(x => x && x.clave && x.hasta) : [];
}
function plazoEn(cfg, clave, fechaRegYmd) {
  const actual = cfg[clave];
  if (!fechaRegYmd) return actual;
  const h = plazosHist(cfg.raw);
  for (const x of h) if (x.clave === clave && fechaRegYmd <= String(x.hasta)) { const n = parseInt(x.valor, 10); return isNaN(n) ? actual : n; }
  return actual;
}

function crearMotor(D) {
  const K = D.constantes || {};
  const FER = K.feriados || [], AI = K.altaIni || { m: 1, d: 5 }, AF = K.altaFin || { m: 6, d: 26 };
  const PLAZO_CASOS = K.plazo == null ? 5 : K.plazo;
  const cfg = D.config;
  const usuarios = D.usuarios || [];
  const sups = D.sups || [];
  const visitas = D.visitas || [];
  const restricc = D.restricc || [];
  const casos = (D.casos || []).map(c => Object.assign({}, c, {
    fecha_registro: parse(c.fecha_registro), fecha_reporte: parse(c.fecha_reporte),
    fecha_limite: parse(c.fecha_limite), fecha_cierre: parse(c.fecha_cierre)
  }));

  /* _CALENDARIO_V1: dias laborables + feriados de la configuracion (antes: temporada alta L-V / baja L-Sab) */
  const CAL_DIAS = calParseDias(cfg.dias), CAL_FER = {};
  calParseFeriados(cfg.feriados).concat(FER).forEach(f => { CAL_FER[f] = 1; });
  function esHabil(f) {
    if (CAL_DIAS.indexOf(f.getUTCDay()) < 0) return false;
    return !CAL_FER[ymd(f)];
  }
  function limiteVisita(lunes, plazo) {   /* = cumplLimiteVisita_ */
    let cur = copia(lunes), g = 0;
    while (!esHabil(cur) && g++ < 30) cur = sumar(cur, 1);
    const n = parseInt(plazo, 10) || 1;
    return n > 1 ? sumarHabiles(cur, n - 1) : cur;
  }
  function sumarHabiles(desde, n) {
    let cur = copia(desde), cont = 0, guardia = 0;
    n = parseInt(n, 10) || 0;
    while (cont < n && guardia < 90) { cur = sumar(cur, 1); if (esHabil(cur)) cont++; guardia++; }
    return cur;
  }
  /* _RETRASO_HABIL_V1: = _casoDiasHabilesEntre (a exclusivo, b inclusivo) y cumplRetrasoHabil_ */
  function habilesEntre(a, b) {
    if (b <= a) return 0;
    let cur = copia(a), n = 0, g = 0;
    while (cur < b && g < 400) { cur = sumar(cur, 1); if (esHabil(cur)) n++; g++; }
    return n;
  }
  function semaforo(limite, hoy) {
    const rest = hoy > limite ? -Math.max(1, habilesEntre(limite, hoy)) : habilesEntre(hoy, limite);   /* _RETRASO_HABIL_V1: dias habiles */
    const retraso = rest < 0 ? -rest : 0;
    const estado = rest > cfg.aviso_proximo_dias ? 'EN_PLAZO' : rest > 0 ? 'PROXIMO' : rest === 0 ? 'VENCE_HOY' : retraso >= cfg.critico_dias ? 'CRITICO' : 'VENCIDO';
    return { dias_restantes: rest, dias_retraso: retraso, estado };
  }
  function esSupCampo(u) {
    const nom = usr(u && u.nombre);
    for (let i = 0; i < sups.length; i++) { const k = usr(sups[i]); if (k === nom) return true; if (nombreMatch(k, nom) || nombreMatch(nom, k)) return true; }
    return false;
  }
  function usuarioPor(lista, clave) {
    const k = usr(clave);
    for (let i = 0; i < lista.length; i++) if (lista[i].usuario === k || usr(lista[i].nombre) === k) return lista[i];
    for (let j = 0; j < lista.length; j++) if (nombreMatch(usr(lista[j].nombre), k) || nombreMatch(k, usr(lista[j].nombre))) return lista[j];
    return null;
  }
  function esDelUsuario(caso, u) {
    if (!u) return false;
    const sup = usr(caso.supervisor), reg = usr(caso.registrado_por);
    if (reg === u.usuario || sup === u.usuario || sup === usr(u.nombre)) return true;
    return nombreMatch(sup, usr(u.nombre)) || nombreMatch(usr(u.nombre), sup);
  }
  function concluido(c) {
    const eg = c.estado_gestion || '', ec = String(c.estado || '').toUpperCase();
    return ['CERRADO', 'CONCLUIDO', 'RESUELTO', 'FINALIZADO'].some(s => eg.indexOf(s) >= 0) || ec.indexOf('CONCLUIDO') === 0;
  }
  const AUS = crearAus(cfg.raw || {}, usuarios, esDelUsuario, esHabil);   /* _AUSENCIAS_V1 */
  function actividadCaso(c, hoy) {
    const base = c.fecha_reporte || c.fecha_registro;
    if (!base) return null;
    const docs = [];
    if (!c.enlace_informe) docs.push('Informe');
    if (!c.enlace_reporte) docs.push('Reporte/Descargo');
    let etapa, limite, plazo;
    const fReg = ymd(c.fecha_registro);   /* _PLAZO_VIGENTE_V1 */
    if (!c.enlace_informe) { etapa = 'Investigación e informe'; plazo = plazoEn(cfg, 'plazo_investigacion', fReg); limite = sumarHabiles(base, plazo); }   /* _CALENDARIO_V1: siempre con el calendario vigente */
    else if (!c.enlace_reporte) { etapa = 'Carga de reporte/descargo'; plazo = plazoEn(cfg, 'plazo_documentos', fReg); limite = sumarHabiles(base, plazo); }
    else { etapa = 'Cierre del caso'; plazo = plazoEn(cfg, 'plazo_cierre', fReg); limite = sumarHabiles(base, plazo); }
    const s = semaforo(limite, hoy);
    const avance = c.enlace_informe && c.enlace_reporte ? 80 : c.enlace_informe ? 50 : 20;
    const o = {
      tipo: 'CASO', clave: 'caso_' + c.nro, caso: c.nro, actividad: etapa, trabajador: c.nombre, empresa: c.empresa, sector: c.sector,
      motivo: c.motivo.toLowerCase() === 'otros' && c.motivo_extra ? c.motivo_extra : c.motivo, gravedad: c.gravedad,
      responsable: c.supervisor || c.registrado_por, fecha_registro: ymd(base), plazo_dias: plazo, fecha_limite: ymd(limite),
      dias_transcurridos: dias(base, hoy), dias_restantes: s.dias_restantes, dias_retraso: s.dias_retraso, estado: s.estado,
      porcentaje: avance, documentos_pendientes: docs, estado_gestion: c.estado_gestion || 'EN PROCESO',
      accion: docs.length ? 'Subir ' + docs.join(' y ') : 'Concluir el caso'
    };
    const cb = AUS.cobCaso(c, ymd(hoy));   /* _AUSENCIAS_V1: el titular esta ausente -> lo responde el reemplazo */
    if (cb) { AUS.etiqueta(o, cb); o.responsable = AUS.reemp(cb).nombre; }
    return o;
  }
  let visPendCache = null;
  function visitasPendientes(hoy) {
    if (visPendCache) return visPendCache;
    const res = {};
    const dow = hoy.getUTCDay(), diffLunes = (dow === 0) ? 6 : dow - 1;
    const lunesEsta = sumar(hoy, -diffLunes);
    const lunesPasado = sumar(lunesEsta, -7);
    const domPasadoDia = sumar(lunesEsta, -1);
    const domingoPasado = new Date(domPasadoDia.getTime() + DIA - 1);
    const semana = semanaNum(domPasadoDia);
    const rango = ddmm(lunesPasado) + ' al ' + ddmm(domPasadoDia);
    const reportaron = {};
    visitas.forEach(v => {
      const fi = fechaV(v.fecha_inicio), ff = fechaV(v.fecha_fin) || fi, finf = fechaV(v.fecha_informe);
      if ((fi && ff && fi <= domingoPasado && ff >= lunesPasado) || (finf && finf >= lunesPasado && finf <= domingoPasado)) reportaron[usr(v.supervisor)] = true;
    });
    const limite = limiteVisita(lunesEsta, cfg.plazo_visita_dias);   /* _CALENDARIO_V1 */
    const s = semaforo(limite, hoy);
    sups.forEach(nombreSup => {
      const key = usr(nombreSup);
      let ok = !!reportaron[key];
      if (!ok) for (const k in reportaron) { if (nombreMatch(k, key) || nombreMatch(key, k)) { ok = true; break; } }
      if (ok) return;
      /* _AUSENCIAS_V1: falto la mayor parte de esa semana -> la responde su reemplazo (o nadie, si no hay) */
      const tU = usuarioPor(usuarios, nombreSup), aS = tU ? AUS.semana(tU, lunesPasado, ymd, sumar) : null;
      let rp = null;
      if (aS) {
        rp = AUS.reemp(aS); if (!rp) return;
        const kr = usr(rp.nombre);
        let okR = !!reportaron[kr];
        if (!okR) for (const k in reportaron) { if (nombreMatch(k, kr) || nombreMatch(kr, k)) { okR = true; break; } }
        if (okR) return;
      }
      res[key] = {
        tipo: 'VISITA', clave: 'visita_' + semana + '_' + key, caso: 'Sem. ' + semana, actividad: 'Informe de visitas de campo',
        trabajador: '', responsable: rp ? rp.nombre : nombreSup, fecha_registro: ymd(lunesEsta), plazo_dias: cfg.plazo_visita_dias,
        fecha_limite: ymd(limite), dias_transcurridos: dias(lunesEsta, hoy), dias_restantes: s.dias_restantes,
        dias_retraso: s.dias_retraso, estado: s.estado, porcentaje: 0, documentos_pendientes: ['Informe de visitas (' + rango + ')' + (rp ? ' — sector de ' + nombreSup : '')],
        accion: 'Registrar la visita de la semana ' + semana
      };
      if (rp) AUS.etiqueta(res[key], aS);
    });
    visPendCache = res;
    return res;
  }
  function restriccion(u, actividades, hoy) {
    const criticos = actividades.filter(a => a.estado === 'CRITICO');
    const out = { activa: false, modulos: [], criticos: criticos.length, motivo: '', exonerado_hasta: '' };
    if (!cfg.restricciones || !criticos.length) return out;
    for (let i = restricc.length - 1; i >= 0; i--) {
      const f = restricc[i];
      if (usr(f.usuario) !== u.usuario || String(f.tipo) !== 'LEVANTADA') continue;
      const hasta = parse(f.hasta);
      if (hasta && hasta >= hoy) { out.exonerado_hasta = ymd(hasta); out.motivo = 'Restricción levantada por ' + f.por + ' hasta ' + dmy(hasta); return out; }
      break;
    }
    out.activa = true; out.modulos = cfg.modulos_restringidos;
    out.motivo = criticos.length + ' actividad(es) con incumplimiento crítico (≥ ' + cfg.critico_dias + ' días de retraso)';
    return out;
  }
  function indice(u, visitasPend, hoy) {
    const y = hoy.getUTCFullYear(), m = hoy.getUTCMonth();
    const ini = fecha(y, m, 1);
    const mios = casos.filter(c => esDelUsuario(c, u));
    const delMes = mios.filter(c => { const f = c.fecha_reporte || c.fecha_registro; return f && f >= ini && f <= hoy; });
    const abiertos = casos.filter(c => !concluido(c) && AUS.duenoEn(c, u, ymd(hoy)));   /* _AUSENCIAS_V1: lo que responde HOY (propio o cubierto) */
    let enPlazo = 0, fuera = 0, sumaDias = 0, cerrados = 0;
    casos.forEach(c => {
      if (!concluido(c)) return;
      const base = c.fecha_reporte || c.fecha_registro; if (!base) return;
      const fin = c.fecha_cierre; if (!fin || fin < ini) return;
      if (!AUS.duenoEn(c, u, ymd(fin))) return;   /* _AUSENCIAS_V1: de quien era el caso el dia del cierre */
      cerrados++; sumaDias += dias(base, fin);
      const lim = sumarHabiles(base, plazoEn(cfg, 'plazo_cierre', ymd(c.fecha_registro)));   /* _PLAZO_VIGENTE_V1 */
      if (fin <= lim) enPlazo++; else fuera++;
    });
    let vencidos = 0, enInvest = 0, docsPend = 0;
    const detalleVencidos = [];
    abiertos.forEach(c => {
      const a = actividadCaso(c, hoy); if (!a) return;
      if (!c.enlace_informe) enInvest++;
      docsPend += a.documentos_pendientes.length;
      if (a.dias_retraso > 0) { vencidos++; detalleVencidos.push({ caso: c.nro, trabajador: c.nombre, actividad: a.actividad, dias_retraso: a.dias_retraso, fecha_limite: a.fecha_limite }); }
    });
    let semanas = 0, realizadas = 0, visEnPlazo = 0, primerLunesV = null;   /* _VISITA_PLAZO_V1 */
    const propio = esSupCampo(u);   /* _AUSENCIAS_V1: + semanas que cubre como reemplazo; - semanas en que estuvo ausente */
    const cobV = AUS.lista.filter(a => usr(a.reemplazo) === u.usuario && AUS.reemp(a) && esSupCampo(AUS.titular(a)));
    const lv = (propio || cobV.length) ? visitas : null;
    let d = copia(ini); while (d.getUTCDay() !== 1) d = sumar(d, 1);
    primerLunesV = copia(d);
    if (lv) {
      for (; ; d = sumar(d, 7)) {
        const dom = sumar(d, 6);
        const limV = limiteVisita(sumar(d, 7), cfg.plazo_visita_dias || 1);   /* _CALENDARIO_V1 */
        if (dom >= hoy || limV >= hoy) break;
        let obl = (propio && !AUS.semana(u, d, ymd, sumar)) ? 1 : 0;
        cobV.forEach(a => { if (AUS.semana(AUS.titular(a), d, ymd, sumar) === a) obl++; });
        if (!obl) continue;
        semanas += obl;
        const lunes = d;
        const cubren = lv.filter(v => {
          if (!esDelUsuario({ supervisor: v.supervisor, registrado_por: '' }, u)) return false;
          const fi = fechaV(v.fecha_inicio), ff = fechaV(v.fecha_fin) || fi, finf = fechaV(v.fecha_informe);
          return (fi && ff && fi <= dom && ff >= lunes) || (finf && finf >= lunes && finf <= dom);
        });
        if (cubren.length) realizadas += obl;
        if (cubren.some(v => { const fr = v.fecha_reg ? fechaV(String(v.fecha_reg).slice(0, 10)) : null; return !fr || fr <= limV; })) visEnPlazo += obl;   /* _VISITA_PLAZO_V1 */
      }
    }
    const denom = cerrados + vencidos + semanas;
    const pct = denom ? Math.round(100 * (enPlazo + visEnPlazo) / denom) : 100;   /* _VISITA_PLAZO_V1 */
    const nivel = pct >= cfg.excelente ? 'EXCELENTE' : pct >= cfg.regular ? 'REGULAR' : 'BAJO';
    const extraVis = (visitasPend && !(visitasPend.dias_retraso > 0 && primerLunesV && (function () { const l0 = parse(visitasPend.fecha_registro); if (!l0) return false; return sumar(l0, -7) >= primerLunesV; })())) ? 1 : 0;
    return {
      mes: MESES[m] + ' ' + y, porcentaje: pct, nivel,
      visitas_programadas: semanas, visitas_realizadas: realizadas, visitas_en_plazo: visEnPlazo, visitas_fuera_plazo: realizadas - visEnPlazo, visitas_pendientes: Math.max(0, semanas - realizadas) + extraVis,
      casos_asignados: delMes.length, casos_en_plazo: enPlazo, casos_fuera_plazo: fuera, casos_vencidos: vencidos,
      casos_en_investigacion: enInvest, documentos_pendientes: docsPend, casos_abiertos: abiertos.length,
      promedio_dias_cierre: cerrados ? Math.round(10 * sumaDias / cerrados) / 10 : 0, casos_cerrados_mes: cerrados,
      detalle_vencidos: detalleVencidos
    };
  }
  const ordenar = (x, y) => (PESO[y.estado] - PESO[x.estado]) || (x.dias_restantes - y.dias_restantes);

  function cumplPendientes(b) {
    b = b || {};
    const hoy = hoyLima();
    const u = usuarioPor(usuarios, b.usuario);
    if (!u) return { success: false, error: 'Usuario no encontrado: ' + b.usuario };
    const esAdmin = esAdminRol(u.rol);
    const vis = visitasPendientes(hoy);
    const acts = [];
    casos.forEach(c => {
      if (concluido(c)) return;
      if (!esAdmin && !AUS.duenoEn(c, u, ymd(hoy))) return;   /* _AUSENCIAS_V1 */
      const a = actividadCaso(c, hoy); if (a) acts.push(a);
    });
    let vp = null;
    Object.keys(vis).forEach(k => {
      const v = vis[k];
      const due = usuarioPor(usuarios, v.responsable);
      if (esAdmin || (due && due.usuario === u.usuario)) { acts.push(v); if (due && due.usuario === u.usuario) vp = v; }
    });
    acts.sort(ordenar);
    const resumen = { EN_PLAZO: 0, PROXIMO: 0, VENCE_HOY: 0, VENCIDO: 0, CRITICO: 0 };
    acts.forEach(a => { resumen[a.estado]++; });
    const propias = esAdmin ? acts.filter(a => a.tipo === 'VISITA' ? false : esDelUsuario({ supervisor: a.responsable, registrado_por: '' }, u)) : acts;
    const restr = restriccion(u, propias.filter(a => !a.cubre_a), hoy);   /* _AUSENCIAS_V1: lo heredado como reemplazo avisa y escala, pero no restringe modulos */
    const ind = esAdmin ? null : indice(u, vp, hoy);
    const out = { success: true, usuario: u.usuario, nombre: u.nombre, rol: u.rol, esAdmin, hoy: ymd(hoy),
      config: { aviso_proximo_dias: cfg.aviso_proximo_dias, critico_dias: cfg.critico_dias, escalar_dias: cfg.escalar_dias, excelente: cfg.excelente, regular: cfg.regular,
        calendario: { dias: CAL_DIAS, feriados: Object.keys(CAL_FER).sort() },   /* _CALENDARIO_V1 */
        plazos: { plazo_investigacion: cfg.plazo_investigacion, plazo_documentos: cfg.plazo_documentos, plazo_cierre: cfg.plazo_cierre, historial: plazosHist(cfg.raw) } },   /* _PLAZO_VIGENTE_V1 */
      actividades: acts, resumen, restriccion: restr, indice: ind };
    const au = AUS.ausencia(u, ymd(hoy)), cob = AUS.coberturas(u, ymd(hoy));   /* _AUSENCIAS_V1 */
    if (au) out.ausencia = { tipo: au.tipo, desde: au.desde, hasta: au.hasta || '', reemplazo: AUS.reemp(au) ? AUS.reemp(au).nombre : '' };
    if (cob.length) out.cubriendo = cob.map(a => ({ nombre: AUS.titular(a).nombre, desde: a.desde, hasta: a.hasta || '' }));
    return out;
  }

  function cumplPanel(b) {
    b = b || {};
    if (!esAdminRol(b.rol)) return { success: false, error: 'Solo administradores y coordinadores.' };
    const hoy = hoyLima();
    const vis = visitasPendientes(hoy);
    const lista = usuarios.filter(x => {
      if (x.activo && AUS.coberturas(x, ymd(hoy)).length) return true;   /* _AUSENCIAS_V1: el reemplazo entra al panel aunque no sea supervisor */
      if (!x.activo || x.rol !== 'supervisor') return false;
      if (esSupCampo(x)) return true;
      return casos.some(c => !concluido(c) && esDelUsuario(c, x));
    });
    const filas = [], detalle = [];
    lista.forEach(u => {
      const acts = [];
      casos.forEach(c => { if (concluido(c) || !AUS.duenoEn(c, u, ymd(hoy))) return; const a = actividadCaso(c, hoy); if (a) { a.usuario = u.usuario; a.sector = a.sector || u.sector; acts.push(a); } });   /* _AUSENCIAS_V1 */
      Object.keys(vis).forEach(k => { let v = vis[k]; const due = usuarioPor([u], v.responsable); if (due) { v = JSON.parse(JSON.stringify(v)); v.usuario = u.usuario; v.sector = u.sector; acts.push(v); } });
      const res = { EN_PLAZO: 0, PROXIMO: 0, VENCE_HOY: 0, VENCIDO: 0, CRITICO: 0 };
      acts.forEach(a => { res[a.estado]++; detalle.push(a); });
      const idx = indice(u, null, hoy);
      const restr = restriccion(u, acts.filter(a => !a.cubre_a), hoy);   /* _AUSENCIAS_V1 */
      const fila = { usuario: u.usuario, nombre: u.nombre, empresa: u.empresa, sector: u.sector,
        visitas_pendientes: acts.filter(a => a.tipo === 'VISITA').length,
        casos_abiertos: acts.filter(a => a.tipo === 'CASO').length,
        en_plazo: res.EN_PLAZO, por_vencer: res.PROXIMO + res.VENCE_HOY, vencidos: res.VENCIDO + res.CRITICO, criticos: res.CRITICO,
        porcentaje: idx.porcentaje, nivel: idx.nivel, restriccion: restr.activa, exonerado_hasta: restr.exonerado_hasta, indice: idx };
      const au = AUS.ausencia(u, ymd(hoy)), cob = AUS.coberturas(u, ymd(hoy));   /* _AUSENCIAS_V1 */
      if (au) fila.ausencia = { tipo: au.tipo, desde: au.desde, hasta: au.hasta || '', reemplazo: AUS.reemp(au) ? AUS.reemp(au).nombre : '' };
      if (cob.length) fila.cubriendo = cob.map(a => ({ nombre: AUS.titular(a).nombre, tipo: a.tipo, desde: a.desde, hasta: a.hasta || '' }));
      filas.push(fila);
    });
    filas.sort((a, b2) => (b2.criticos - a.criticos) || (b2.vencidos - a.vencidos) || (a.porcentaje - b2.porcentaje));
    detalle.sort(ordenar);
    return { success: true, hoy: ymd(hoy), supervisores: filas, actividades: detalle, config: cfg.raw };
  }

  /* getCumplimiento (banner del dashboard) */
  function getCumplimiento(params, casosRecientes) {
    params = params || {};
    const usuarioNorm = String(params.usuario || '').trim().toLowerCase();
    let nombreSol = '', rolSol = '';
    for (let i = 0; i < usuarios.length; i++) if (usuarios[i].usuario === usuarioNorm) { nombreSol = usuarios[i].nombre; rolSol = usuarios[i].rol; break; }
    const nombreNorm = nombreSol.toLowerCase();
    const esAdminGeneral = ROLES_ADMIN.indexOf(rolSol) >= 0;
    const hoy = hoyLima();
    const dow = hoy.getUTCDay();
    const lunesEsta = sumar(hoy, -((dow === 0) ? 6 : dow - 1));
    const lunesPasado = sumar(lunesEsta, -7);
    const domDia = sumar(lunesEsta, -1);
    const domingoPasado = new Date(domDia.getTime() + DIA - 1);
    const esLunesHoy = hoy <= limiteVisita(lunesEsta, cfg.plazo_visita_dias);   /* _CALENDARIO_V1: el lunes o el siguiente dia laborable */
    const sem = semanaNum(domDia);
    const rangoSemana = ddmm(lunesPasado) + ' al ' + ddmm(domDia);
    const reportaron = {};
    visitas.forEach(v => {
      const fi = fechaV(v.fecha_inicio), ff = fechaV(v.fecha_fin) || fi, finf = fechaV(v.fecha_informe);
      const cubre = (fi && ff && fi <= domingoPasado && ff >= lunesPasado) || (finf && finf >= lunesPasado && finf <= domingoPasado);
      if (cubre) reportaron[String(v.supervisor || '').trim().toLowerCase()] = true;
    });
    const pendientesVisitas = [];
    sups.forEach(nombreSup => {
      const key = nombreSup.toLowerCase();
      let ok = !!reportaron[key];
      if (!ok) for (const k in reportaron) { if (nombreMatch(k, key) || nombreMatch(key, k)) { ok = true; break; } }
      if (ok) return;
      const tU = usuarioPor(usuarios, nombreSup), aS = tU ? AUS.semana(tU, lunesPasado, ymd, sumar) : null;   /* _AUSENCIAS_V1 */
      if (aS) {
        const rp = AUS.reemp(aS); if (!rp) return;
        const kr = rp.nombre.toLowerCase();
        let okR = !!reportaron[kr];
        if (!okR) for (const k in reportaron) { if (nombreMatch(k, kr) || nombreMatch(kr, k)) { okR = true; break; } }
        if (!okR) pendientesVisitas.push({ nombre: rp.nombre, estado: esLunesHoy ? 'plazo_hoy' : 'vencido', semana: sem, rango: rangoSemana, cubre_a: nombreSup });
        return;
      }
      pendientesVisitas.push({ nombre: nombreSup, estado: esLunesHoy ? 'plazo_hoy' : 'vencido', semana: sem, rango: rangoSemana });
    });
    const casosPendientes = [];
    (casosRecientes || []).forEach(c => {
      const sinInforme = !String(c.enlace_informe || '').trim();
      const sinReporte = !String(c.enlace_reporte || '').trim();
      if (sinInforme && sinReporte) casosPendientes.push({ nombre_mostrar: c.supervisor || c.registrado_por || '(sin asignar)', supervisor: c.supervisor || '', registrado_por: c.registrado_por || '', motivo: c.motivo || '', nro: c.nro });
    });
    if (esAdminGeneral) return { success: true, esAdmin: true, semana: sem, rangoSemana, pendientesVisitas, casosPendientes };
    const misVisitas = pendientesVisitas.filter(p => p.nombre.toLowerCase() === nombreNorm || nombreMatch(p.nombre, nombreNorm));
    const quienes = [[usuarioNorm, nombreNorm]];   /* _AUSENCIAS_V1: + las personas que cubre hoy */
    const yo = usuarios.filter(x => x.usuario === usuarioNorm)[0];
    if (yo) AUS.coberturas(yo, ymd(hoy)).forEach(a => { const t = AUS.titular(a); quienes.push([t.usuario, String(t.nombre || '').toLowerCase()]); });
    const misCasos = casosPendientes.filter(c => {
      const sup = String(c.supervisor || '').toLowerCase(), reg = String(c.registrado_por || '').toLowerCase();
      return quienes.some(q => { const un = q[0], nn = q[1];
        return sup === un || sup === nn || reg === un || reg === nn
          || (sup && un && sup.indexOf(un) >= 0)
          || (sup && nn && sup.indexOf(nn) >= 0)
          || nombreMatch(sup, nn); });
    });
    return { success: true, esAdmin: false, semana: sem, rangoSemana, pendientesVisitas: misVisitas, casosPendientes: misCasos };
  }

  return { cumplPendientes, cumplPanel, getCumplimiento };
}

module.exports = { crearMotor, plazosHist, plazoEn, crearAus, ausParse, ausAplicar, AUS_TIPOS, nombreMatch, calParseDias, calParseFeriados, _t: { parse, fechaV, semanaNum, hoyLima, ymd } };
