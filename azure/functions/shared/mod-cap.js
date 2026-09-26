/* _MOD_AZURE_V1 — CAPACITACIONES: copia fiel de capListar y capEstadisticas (Apps Script).
   D.hdr / D.bbdd = hojas CAPACITACIONES_HDR y BD_Capacitaciones completas (con encabezado).
   Las celdas con fecha llegan como { $d: ISO, $s: texto }: $s es exactamente lo que da
   String(fecha) en Google (asi las comparaciones de texto dan lo mismo) y $d es lo que
   Google devuelve a la pantalla en el JSON. El export sigue por Google. */
'use strict';
const esD = (v) => !!(v && typeof v === 'object' && typeof v.$d === 'string');
const T = (v) => esD(v) ? v.$s : String(v);
const J = (v) => esD(v) ? v.$d : v;
const pInt = (v) => parseInt(esD(v) ? v.$s : v);
const ROLES_ADMIN = ['administrador', 'administrador 01', 'administrador 02', 'coordinador', 'jefa_rl', 'jefe_rl'];
const camel = (s) => s.toString().toLowerCase().replace(/_([a-z])/g, (_, c) => c.toUpperCase());
function limaYM() {
  const p = {};
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit' }).formatToParts(new Date()).forEach(x => { p[x.type] = x.value; });
  return { y: +p.year, m: +p.month - 1 };
}
const ym = (y, m) => { const d = new Date(Date.UTC(y, m, 1)); return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2); };

function crear(D) {
  function capListar(body) {
    try {
      const f0 = body || {};
      const rol = String(f0.rol || '').toLowerCase().trim(), esAdmin = ROLES_ADMIN.includes(rol);
      const usuario = String(f0.usuario || '').toLowerCase().trim(), supervisor = String(f0.supervisor || '').toLowerCase().trim();
      const datos = D.hdr;
      if (!datos) return { success: true, capacitaciones: [], total: 0, esAdmin };
      if (datos.length < 2) return { success: true, capacitaciones: [], total: 0, esAdmin };
      const headers = datos[0], desde = f0.desde || '', hasta = f0.hasta || '', empresa = f0.empresa || '';
      const res = [];
      for (let r = 1; r < datos.length; r++) {
        const obj = {};
        headers.forEach((h, i) => { obj[camel(T(h))] = datos[r][i]; });
        const f = T(obj.fecha || '').split('T')[0];
        if (desde && f < desde) continue;
        if (hasta && f > hasta) continue;
        if (empresa && empresa !== 'AMBAS' && J(obj.empresa) !== empresa) continue;
        if (!esAdmin && usuario && T(obj.creadaPor || '').toLowerCase().trim() !== usuario) continue;
        if (esAdmin && supervisor && T(obj.creadaPor || '').toLowerCase().trim() !== supervisor) continue;
        res.push(obj);
      }
      res.sort((a, b) => T(b.fechaRegistro || b.fecha || '').localeCompare(T(a.fechaRegistro || a.fecha || '')));
      const out = res.map(o => { const x = {}; Object.keys(o).forEach(k => { x[k] = J(o[k]); }); return x; });
      return { success: true, capacitaciones: out, total: out.length, esAdmin };
    } catch (err) { return { success: false, error: err.message }; }
  }

  function capEstadisticas(body) {
    try {
      const f0 = body || {};
      const esAdmin = ROLES_ADMIN.includes(String(f0.rol || '').toLowerCase().trim());
      if (!esAdmin) return { success: true, esAdmin: false, stats: {} };
      if (!D.hdr || !D.bbdd) return { success: true, esAdmin: true, stats: {} };
      const filasHdr = D.hdr.slice(1).filter(r => r[0]);
      const filasBdd = D.bbdd.slice(1).filter(r => r[0]);
      const L = limaYM(), mesAct = ym(L.y, L.m);
      const esteMes = filasHdr.filter(r => T(r[8] || '').substring(0, 7) === mesAct);
      const asistentesEsteMes = filasBdd.filter(r => T(r[5] || '').substring(0, 7) === mesAct).length;
      const porEmpresa = { RAPEL: 0, VERFRUT: 0 };
      filasBdd.forEach(r => { const e = T(r[2] || '').toUpperCase(); if (e.indexOf('RAPEL') !== -1) porEmpresa.RAPEL++; else if (e.indexOf('VERFRUT') !== -1) porEmpresa.VERFRUT++; });
      const porSup = {};
      esteMes.forEach(r => {
        const sup = T(r[19] || 'sin_asignar');
        if (!porSup[sup]) porSup[sup] = { nombre: T(r[20] || r[19] || sup), capacitaciones: 0, asistentes: 0 };
        porSup[sup].capacitaciones++; porSup[sup].asistentes += pInt(r[16]) || 0;
      });
      const topSupervisores = Object.keys(porSup).sort((a, b) => porSup[b].asistentes - porSup[a].asistentes).slice(0, 5)
        .map(u => ({ usuario: u, nombre: porSup[u].nombre, capacitaciones: porSup[u].capacitaciones, asistentes: porSup[u].asistentes }));
      const tm = {};
      for (let i = 5; i >= 0; i--) tm[ym(L.y, L.m - i)] = { capacitaciones: 0, asistentes: 0 };
      filasHdr.forEach(r => { const f = T(r[8] || '').substring(0, 7); if (tm[f]) { tm[f].capacitaciones++; tm[f].asistentes += pInt(r[16]) || 0; } });
      const tendencia = Object.keys(tm).map(mes => ({ mes, capacitaciones: tm[mes].capacitaciones, asistentes: tm[mes].asistentes }));
      const porTema = {};
      filasHdr.forEach(r => { const t = T(r[4] || 'Sin especificar').substring(0, 60); porTema[t] = (porTema[t] || 0) + 1; });
      const topTemas = Object.keys(porTema).sort((a, b) => porTema[b] - porTema[a]).slice(0, 5).map(t => ({ tema: t, count: porTema[t] }));
      const act = new Set(); esteMes.forEach(r => { if (r[19]) act.add(T(r[19])); });
      return { success: true, esAdmin: true, stats: { totalCapacitaciones: filasHdr.length, totalAsistentes: filasBdd.length,
        capacitacionesEsteMes: esteMes.length, asistentesEsteMes, supervisoresActivosMes: act.size, porEmpresa, topSupervisores, tendencia, topTemas } };
    } catch (e) { return { success: false, error: e.toString() }; }
  }
  return { capListar, capEstadisticas };
}
module.exports = { crear };
