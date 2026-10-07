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

  function esHabil(f) {
    const dia = f.getUTCDay();
    if (dia === 0) return false;
    if (FER.indexOf(ymd(f)) !== -1) return false;
    const y = f.getUTCFullYear();
    const alta = f >= fecha(y, AI.m - 1, AI.d) && f <= fecha(y, AF.m - 1, AF.d);
    if (alta) return dia >= 1 && dia <= 5;
    return dia >= 1 && dia <= 6;
  }
  function sumarHabiles(desde, n) {
    let cur = copia(desde), cont = 0, guardia = 0;
    n = parseInt(n, 10) || 0;
    while (cont < n && guardia < 90) { cur = sumar(cur, 1); if (esHabil(cur)) cont++; guardia++; }
    return cur;
  }
  function semaforo(limite, hoy) {
    const rest = dias(hoy, limite);
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
  function actividadCaso(c, hoy) {
    const base = c.fecha_reporte || c.fecha_registro;
    if (!base) return null;
    const docs = [];
    if (!c.enlace_informe) docs.push('Informe');
    if (!c.enlace_reporte) docs.push('Reporte/Descargo');
    let etapa, limite, plazo;
    if (!c.enlace_informe) { etapa = 'Investigación e informe'; plazo = cfg.plazo_investigacion; limite = (c.fecha_limite && plazo === PLAZO_CASOS) ? c.fecha_limite : sumarHabiles(base, plazo); }
    else if (!c.enlace_reporte) { etapa = 'Carga de reporte/descargo'; plazo = cfg.plazo_documentos; limite = sumarHabiles(base, plazo); }
    else { etapa = 'Cierre del caso'; plazo = cfg.plazo_cierre; limite = sumarHabiles(base, plazo); }
    const s = semaforo(limite, hoy);
    const avance = c.enlace_informe && c.enlace_reporte ? 80 : c.enlace_informe ? 50 : 20;
    return {
      tipo: 'CASO', clave: 'caso_' + c.nro, caso: c.nro, actividad: etapa, trabajador: c.nombre, empresa: c.empresa, sector: c.sector,
      motivo: c.motivo.toLowerCase() === 'otros' && c.motivo_extra ? c.motivo_extra : c.motivo, gravedad: c.gravedad,
      responsable: c.supervisor || c.registrado_por, fecha_registro: ymd(base), plazo_dias: plazo, fecha_limite: ymd(limite),
      dias_transcurridos: dias(base, hoy), dias_restantes: s.dias_restantes, dias_retraso: s.dias_retraso, estado: s.estado,
      porcentaje: avance, documentos_pendientes: docs, estado_gestion: c.estado_gestion || 'EN PROCESO',
      accion: docs.length ? 'Subir ' + docs.join(' y ') : 'Concluir el caso'
    };
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
    const limite = sumar(lunesEsta, cfg.plazo_visita_dias - 1);
    const s = semaforo(limite, hoy);
    sups.forEach(nombreSup => {
      const key = usr(nombreSup);
      let ok = !!reportaron[key];
      if (!ok) for (const k in reportaron) { if (nombreMatch(k, key) || nombreMatch(key, k)) { ok = true; break; } }
      if (ok) return;
      res[key] = {
        tipo: 'VISITA', clave: 'visita_' + semana + '_' + key, caso: 'Sem. ' + semana, actividad: 'Informe de visitas de campo',
        trabajador: '', responsable: nombreSup, fecha_registro: ymd(lunesEsta), plazo_dias: cfg.plazo_visita_dias,
        fecha_limite: ymd(limite), dias_transcurridos: dias(lunesEsta, hoy), dias_restantes: s.dias_restantes,
        dias_retraso: s.dias_retraso, estado: s.estado, porcentaje: 0, documentos_pendientes: ['Informe de visitas (' + rango + ')'],
        accion: 'Registrar la visita de la semana ' + semana
      };
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
    const abiertos = mios.filter(c => !concluido(c));
    let enPlazo = 0, fuera = 0, sumaDias = 0, cerrados = 0;
    mios.forEach(c => {
      if (!concluido(c)) return;
      const base = c.fecha_reporte || c.fecha_registro; if (!base) return;
      const fin = c.fecha_cierre; if (!fin || fin < ini) return;
      cerrados++; sumaDias += dias(base, fin);
      const lim = sumarHabiles(base, cfg.plazo_cierre);
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
    let semanas = 0, realizadas = 0, primerLunesV = null;
    const lv = esSupCampo(u) ? visitas : null;
    let d = copia(ini); while (d.getUTCDay() !== 1) d = sumar(d, 1);
    primerLunesV = copia(d);
    if (lv) {
      for (; ; d = sumar(d, 7)) {
        const dom = sumar(d, 6);
        const limV = sumar(d, 6 + (cfg.plazo_visita_dias || 1));
        if (dom >= hoy || limV >= hoy) break;
        semanas++;
        const lunes = d;
        const ok = lv.some(v => {
          if (!esDelUsuario({ supervisor: v.supervisor, registrado_por: '' }, u)) return false;
          const fi = fechaV(v.fecha_inicio), ff = fechaV(v.fecha_fin) || fi, finf = fechaV(v.fecha_informe);
          return (fi && ff && fi <= dom && ff >= lunes) || (finf && finf >= lunes && finf <= dom);
        });
        if (ok) realizadas++;
      }
    }
    const denom = cerrados + vencidos + semanas;
    const pct = denom ? Math.round(100 * (enPlazo + realizadas) / denom) : 100;
    const nivel = pct >= cfg.excelente ? 'EXCELENTE' : pct >= cfg.regular ? 'REGULAR' : 'BAJO';
    const extraVis = (visitasPend && !(visitasPend.dias_retraso > 0 && primerLunesV && (function () { const l0 = parse(visitasPend.fecha_registro); if (!l0) return false; return sumar(l0, -7) >= primerLunesV; })())) ? 1 : 0;
    return {
      mes: MESES[m] + ' ' + y, porcentaje: pct, nivel,
      visitas_programadas: semanas, visitas_realizadas: realizadas, visitas_pendientes: Math.max(0, semanas - realizadas) + extraVis,
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
      if (!esAdmin && !esDelUsuario(c, u)) return;
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
    const restr = restriccion(u, propias, hoy);
    const ind = esAdmin ? null : indice(u, vp, hoy);
    return { success: true, usuario: u.usuario, nombre: u.nombre, rol: u.rol, esAdmin, hoy: ymd(hoy),
      config: { aviso_proximo_dias: cfg.aviso_proximo_dias, critico_dias: cfg.critico_dias, escalar_dias: cfg.escalar_dias, excelente: cfg.excelente, regular: cfg.regular },
      actividades: acts, resumen, restriccion: restr, indice: ind };
  }

  function cumplPanel(b) {
    b = b || {};
    if (!esAdminRol(b.rol)) return { success: false, error: 'Solo administradores y coordinadores.' };
    const hoy = hoyLima();
    const vis = visitasPendientes(hoy);
    const lista = usuarios.filter(x => {
      if (!x.activo || x.rol !== 'supervisor') return false;
      if (esSupCampo(x)) return true;
      return casos.some(c => !concluido(c) && esDelUsuario(c, x));
    });
    const filas = [], detalle = [];
    lista.forEach(u => {
      const acts = [];
      casos.forEach(c => { if (concluido(c) || !esDelUsuario(c, u)) return; const a = actividadCaso(c, hoy); if (a) { a.usuario = u.usuario; a.sector = a.sector || u.sector; acts.push(a); } });
      Object.keys(vis).forEach(k => { let v = vis[k]; const due = usuarioPor([u], v.responsable); if (due) { v = JSON.parse(JSON.stringify(v)); v.usuario = u.usuario; v.sector = u.sector; acts.push(v); } });
      const res = { EN_PLAZO: 0, PROXIMO: 0, VENCE_HOY: 0, VENCIDO: 0, CRITICO: 0 };
      acts.forEach(a => { res[a.estado]++; detalle.push(a); });
      const idx = indice(u, null, hoy);
      const restr = restriccion(u, acts, hoy);
      filas.push({ usuario: u.usuario, nombre: u.nombre, empresa: u.empresa, sector: u.sector,
        visitas_pendientes: acts.filter(a => a.tipo === 'VISITA').length,
        casos_abiertos: acts.filter(a => a.tipo === 'CASO').length,
        en_plazo: res.EN_PLAZO, por_vencer: res.PROXIMO + res.VENCE_HOY, vencidos: res.VENCIDO + res.CRITICO, criticos: res.CRITICO,
        porcentaje: idx.porcentaje, nivel: idx.nivel, restriccion: restr.activa, exonerado_hasta: restr.exonerado_hasta, indice: idx });
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
    const esLunesHoy = (dow === 1);
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
      if (!ok) pendientesVisitas.push({ nombre: nombreSup, estado: esLunesHoy ? 'plazo_hoy' : 'vencido', semana: sem, rango: rangoSemana });
    });
    const casosPendientes = [];
    (casosRecientes || []).forEach(c => {
      const sinInforme = !String(c.enlace_informe || '').trim();
      const sinReporte = !String(c.enlace_reporte || '').trim();
      if (sinInforme && sinReporte) casosPendientes.push({ nombre_mostrar: c.supervisor || c.registrado_por || '(sin asignar)', supervisor: c.supervisor || '', registrado_por: c.registrado_por || '', motivo: c.motivo || '', nro: c.nro });
    });
    if (esAdminGeneral) return { success: true, esAdmin: true, semana: sem, rangoSemana, pendientesVisitas, casosPendientes };
    const misVisitas = pendientesVisitas.filter(p => p.nombre.toLowerCase() === nombreNorm || nombreMatch(p.nombre, nombreNorm));
    const misCasos = casosPendientes.filter(c => {
      const sup = String(c.supervisor || '').toLowerCase(), reg = String(c.registrado_por || '').toLowerCase();
      return sup === usuarioNorm || sup === nombreNorm || reg === usuarioNorm || reg === nombreNorm
        || (sup && usuarioNorm && sup.indexOf(usuarioNorm) >= 0)
        || (sup && nombreNorm && sup.indexOf(nombreNorm) >= 0)
        || nombreMatch(sup, nombreNorm);
    });
    return { success: true, esAdmin: false, semana: sem, rangoSemana, pendientesVisitas: misVisitas, casosPendientes: misCasos };
  }

  return { cumplPendientes, cumplPanel, getCumplimiento };
}

module.exports = { crearMotor, nombreMatch, _t: { parse, fechaV, semanaNum, hoyLima, ymd } };
