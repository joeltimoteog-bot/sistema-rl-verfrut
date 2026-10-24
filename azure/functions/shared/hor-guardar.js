/* ═══════════════════════════════════════════════════════════════════════════
   _HOR_AZURE_V1 (24-oct-2026) — HORARIOS DE JORNADA (Horas / Monitor) se guardan PRIMERO en Azure
   ---------------------------------------------------------------------------
   Replica horariosListar / horariosGuardar / horariosEliminar del Apps Script sobre la tabla
   dbo.Horas_Horarios (= hoja HORARIOS JORNADA, 11 cols, todo como TEXTO). Mismas validaciones y
   mismos mensajes. Solo administradores y registradores de Horas.
   La operacion queda en dbo.CV_Ops (tipo 'hor'); el Apps Script la copia a la hoja, vacia su
   memoria de horarios (horariosRefrescar) y deja la auditoria (horasLog), como siempre.
   El calculo de Horas en Azure ya lee esta misma tabla: ve el cambio al instante.
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
const { sql } = require('./db');
const TH = require('./tablas-hoja');
const CG = require('./cv-guardar');
const CAP = require('./cap-guardar');

const CLAVE = 'horas_horarios';
const ACCIONES = ['horariosGuardar', 'horariosEliminar'];
const LECTURAS = ['horariosListar'];
const ADMINS = ['jtimoteo', 'mportocarrero', 'jfernandez', 'lcovenas', 'ovilela', 'jchavez'];   /* = HORAS_ADMINS */
const REGISTRADORES = ['dsanchez', 'lmorales', 'jsiancas'];                                   /* = HORAS_REG_V7 */
const ANCHO = 11;
const esD = v => !!(v && typeof v === 'object' && typeof v.$d === 'string');
const S = v => esD(v) ? v.$s : String(v == null ? '' : v);
const p2 = n => (n < 10 ? '0' : '') + n;
const lima = ms => new Date(ms - 5 * 3600e3);
const ymdLima = ms => { const x = lima(ms); return x.getUTCFullYear() + '-' + p2(x.getUTCMonth() + 1) + '-' + p2(x.getUTCDate()); };
const esAdmin = u => { u = String(u || '').toLowerCase().trim(); return ADMINS.indexOf(u) >= 0 || REGISTRADORES.indexOf(u) >= 0; };   /* = horasEsAdmin */

/* = hjFecha_ / hjHora_ / hjNetas_ / hjTxt_ */
function hjFecha(v) {
  if (esD(v)) { if (!v.$d) return ''; return ymdLima(new Date(v.$d).getTime()); }
  const s = String(v == null ? '' : v).trim();
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.substring(0, 10) : '';
}
function hjHora(v) {
  if (esD(v)) { if (!v.$d) return -1; const x = lima(new Date(v.$d).getTime()); return x.getUTCHours() * 60 + x.getUTCMinutes(); }
  const s = String(v == null ? '' : v).trim(), m = s.match(/^(\d{1,2})[:.](\d{2})/);
  if (!m) return -1;
  const hh = parseInt(m[1], 10), mm = parseInt(m[2], 10);
  if (isNaN(hh) || isNaN(mm) || hh > 23 || mm > 59) return -1;
  return hh * 60 + mm;
}
const hjNetas = (e, s, ref) => { if (e < 0 || s < 0 || s <= e) return 0; const h = (s - e - (Number(ref) || 0)) / 60; return h > 0 ? Math.round(h * 100) / 100 : 0; };
const hjTxt = min => min < 0 ? '—' : p2(Math.floor(min / 60)) + ':' + p2(min % 60);

/* = horariosLeer_ (sin memoria: la tabla ya es rapida) */
function leer(T) {
  const out = [];
  T.filas.forEach((d0, i) => {
    const d = d0.slice(); while (d.length < ANCHO) d.push('');
    const desde = hjFecha(d[0]); if (!desde) return;
    out.push({ desde, hasta: hjFecha(d[1]), lvEnt: hjHora(d[2]), lvSal: hjHora(d[3]), lvRef: Number(S(d[4])) || 0,
      sabEnt: hjHora(d[5]), sabSal: hjHora(d[6]), sabRef: Number(S(d[7])) || 0,
      accesoActivo: S(d[8]).trim().toUpperCase() === 'SI',
      accesoMargen: (d[9] === '' || d[9] == null) ? 60 : (Number(S(d[9])) || 0),
      nota: S(d[10]), fila: i + 2 });
  });
  out.sort((a, b) => a.desde < b.desde ? 1 : -1);
  return out;
}
const vigente = (filas, hoy) => filas.find(f => !(hoy < f.desde) && !(f.hasta && hoy > f.hasta)) || null;

/* = horariosListar */
function listar(T, ms) {
  const filas = leer(T), hoy = ymdLima(ms), vig = vigente(filas, hoy);
  const out = filas.map(f => ({
    fila: f.fila, desde: f.desde, hasta: f.hasta,
    lvEntrada: hjTxt(f.lvEnt), lvSalida: hjTxt(f.lvSal), lvRefrigMin: f.lvRef,
    sabEntrada: hjTxt(f.sabEnt), sabSalida: hjTxt(f.sabSal), sabRefrigMin: f.sabRef,
    accesoActivo: f.accesoActivo, accesoMargen: f.accesoMargen, nota: f.nota,
    horasLV: hjNetas(f.lvEnt, f.lvSal, f.lvRef), horasSab: hjNetas(f.sabEnt, f.sabSal, f.sabRef),
    vigente: !!(vig && vig.fila === f.fila)
  }));
  out.forEach(o => { o.horasSemana = Math.round((o.horasLV * 5 + o.horasSab) * 100) / 100; });
  return { success: true, horarios: out, hoy, fuente: 'azure' };
}

async function encendido(pool) {
  const r = await pool.request().query("SELECT valor FROM dbo.CV_Estado WHERE clave = 'hor_azure_primero'");
  return r.recordset.length && r.recordset[0].valor === '1';
}
async function actualizarFila(tx, i, celdas) {
  const E = TH.ESQ[CLAVE], f = TH.aFila(CLAVE, celdas), r = tx.request();
  r.input('fila', sql.Int, i + 1);
  const sets = E.cols.map((c, k) => { r.input('v' + k, c[1] === 'f' ? sql.DateTime2(3) : c[1] === 'n' ? sql.Float : sql.NVarChar(parseInt(c[1].slice(1), 10)), f.vals[k]); return c[0] + ' = @v' + k; });
  r.input('o', sql.NVarChar(sql.MAX), f.otros);
  await r.query(`UPDATE ${E.tabla} SET ${sets.join(', ')}, otros = @o, actualizado = SYSUTCDATETIME() WHERE fila = @fila`);
}
async function eliminarFila(tx, i) {
  const E = TH.ESQ[CLAVE];
  await tx.request().input('f', sql.Int, i + 1).query(`DELETE FROM ${E.tabla} WHERE fila = @f;
    WITH x AS (SELECT fila, rn = ROW_NUMBER() OVER (ORDER BY fila) FROM ${E.tabla}) UPDATE x SET fila = rn;`);
}

async function ejecutar(pool, accion, b, usuario, prueba, ahoraMs) {
  if (ACCIONES.indexOf(accion) < 0) return { status: 404, body: { success: false, error: 'Accion desconocida' } };
  b = b || {};
  if (!esAdmin(usuario)) return { status: 200, body: { success: false, error: accion === 'horariosGuardar' ? 'Solo un administrador puede cambiar los horarios.' : 'Solo un administrador puede borrar horarios.' } };
  await CG.asegurarTablas(pool); await TH.asegurar(pool, CLAVE);
  const huella = String(b.client_id || '').replace(/[^\w-]/g, '').slice(0, 90);
  const claveOp = huella ? accion + ':' + huella : accion + ':sin-huella-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  if (huella && !prueba) {
    const p = await pool.request().input('k', sql.NVarChar(100), claveOp).query('SELECT respuesta FROM dbo.CV_Ops WHERE clave = @k');
    if (p.recordset.length && p.recordset[0].respuesta) return { status: 200, body: Object.assign(JSON.parse(p.recordset[0].respuesta), { duplicadoEvitado: true }) };
  }
  const ms = prueba && ahoraMs ? +ahoraMs : Date.now();
  const tx = new sql.Transaction(pool);
  await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    await tx.request().query("EXEC sp_getapplock @Resource = 'hor_guardar', @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 20000;");
    const T = await TH.leer(pool, CLAVE);
    if (!T) { await tx.rollback(); return { status: 503, body: { success: false, error: 'Tabla de horarios aun no cargada' } }; }
    const ultimaFila = T.filas.length + 1;   /* = h.getLastRow() */
    let resp, cuerpo, celdas;
    if (accion === 'horariosGuardar') {
      const d = b.horario || {};
      const desde = hjFecha(d.desde); if (!desde) { await tx.rollback(); return { status: 200, body: { success: false, error: 'Falta la fecha DESDE, en formato 2026-09-01.' } }; }
      const hasta = hjFecha(d.hasta); if (hasta && hasta < desde) { await tx.rollback(); return { status: 200, body: { success: false, error: 'La fecha HASTA no puede ser anterior a DESDE.' } }; }
      const lvE = hjHora(d.lvEntrada), lvS = hjHora(d.lvSalida);
      if (lvE < 0 || lvS < 0) { await tx.rollback(); return { status: 200, body: { success: false, error: 'Faltan la entrada y la salida de lunes a viernes.' } }; }
      if (lvS <= lvE) { await tx.rollback(); return { status: 200, body: { success: false, error: 'La salida de lunes a viernes debe ser posterior a la entrada.' } }; }
      const sabE = hjHora(d.sabEntrada), sabS = hjHora(d.sabSalida);
      if ((sabE >= 0) !== (sabS >= 0)) { await tx.rollback(); return { status: 200, body: { success: false, error: 'Del sabado hay que poner las dos horas, o ninguna si se descansa.' } }; }
      if (sabE >= 0 && sabS <= sabE) { await tx.rollback(); return { status: 200, body: { success: false, error: 'La salida del sabado debe ser posterior a la entrada.' } }; }
      let lvRef = Number(d.lvRefrigMin); if (isNaN(lvRef) || lvRef < 0) lvRef = 0;
      let sabRef = Number(d.sabRefrigMin); if (isNaN(sabRef) || sabRef < 0) sabRef = 0;
      let margen = Number(d.accesoMargen); if (isNaN(margen) || margen < 0) margen = 60;
      const neto = hjNetas(lvE, lvS, lvRef);
      if (neto <= 0) { await tx.rollback(); return { status: 200, body: { success: false, error: 'Con esas horas la jornada queda en cero. Revisa el refrigerio.' } }; }
      const valores = [desde, hasta, hjTxt(lvE), hjTxt(lvS), lvRef, sabE < 0 ? '' : hjTxt(sabE), sabS < 0 ? '' : hjTxt(sabS), sabRef, d.accesoActivo ? 'SI' : 'NO', margen, String(d.nota || '')];
      celdas = valores.slice();   /* la hoja esta en formato texto: se guarda tal cual, sin convertir a fecha */
      let fila = Number(d.fila) || 0;
      if (fila >= 2 && fila <= ultimaFila) await actualizarFila(tx, fila - 2, celdas);
      else { await CAP.agregarFilas(tx, CLAVE, [celdas]); fila = ultimaFila + 1; }
      resp = { success: true, fila, horasLV: neto, horasSab: hjNetas(sabE, sabS, sabRef) };
      cuerpo = { accion, fila: (Number(d.fila) || 0), valores, detalle: desde + ' L-V ' + hjTxt(lvE) + '-' + hjTxt(lvS) + ' = ' + neto + 'h', usuario: String(usuario || ''), ms };
    } else {
      const fila = Number(b.fila) || 0;
      if (fila < 2 || fila > ultimaFila) { await tx.rollback(); return { status: 200, body: { success: false, error: 'No encuentro ese horario.' } }; }
      if (ultimaFila <= 2) { await tx.rollback(); return { status: 200, body: { success: false, error: 'No se puede borrar el ultimo horario: el sistema se quedaria sin jornada.' } }; }
      const eraDesde = S(T.filas[fila - 2][0]);
      await eliminarFila(tx, fila - 2);
      resp = { success: true };
      cuerpo = { accion, fila, eraDesde, usuario: String(usuario || ''), ms };
    }
    await CAP.tocarMarcas(tx, [CLAVE]);
    resp.fuente = 'azure';
    await tx.request().input('k', sql.NVarChar(100), claveOp).input('a', sql.NVarChar(30), accion).input('u', sql.NVarChar(100), usuario ? String(usuario) : null)
      .input('c', sql.NVarChar(sql.MAX), JSON.stringify(cuerpo)).input('r', sql.NVarChar(sql.MAX), JSON.stringify(resp))
      .query("INSERT INTO dbo.CV_Ops (clave, tipo, accion, nro, usuario, cuerpo, respuesta) VALUES (@k, 'hor', @a, NULL, @u, @c, @r)");
    if (prueba) { await tx.rollback(); resp.prueba = true; resp._op = cuerpo; resp._celdas = celdas; } else await tx.commit();
    return { status: 200, body: resp };
  } catch (e) {
    try { await tx.rollback(); } catch (e2) {}
    if (huella && /UQ_CV_Ops_clave|duplicate key/i.test(e.message || '')) {
      const p = await pool.request().input('k', sql.NVarChar(100), claveOp).query('SELECT respuesta FROM dbo.CV_Ops WHERE clave = @k');
      if (p.recordset.length && p.recordset[0].respuesta) return { status: 200, body: Object.assign(JSON.parse(p.recordset[0].respuesta), { duplicadoEvitado: true }) };
    }
    throw e;
  }
}

module.exports = { ejecutar, encendido, listar, ACCIONES, LECTURAS, CLAVE };
