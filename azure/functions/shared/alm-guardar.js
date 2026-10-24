/* ═══════════════════════════════════════════════════════════════════════════
   _ALM_AZURE_V1 (24-oct-2026) — PROGRAMADOR DE ALMUERZOS se guarda PRIMERO en Azure
   ---------------------------------------------------------------------------
   Replica las versiones vigentes del Apps Script (libro aparte de Almuerzos):
     getAlmuerzos              lista maestra A..I (misma respuesta que Google)
     addAlmuerzo               agrega si el DNI (normalizado) no esta
     updateAlmuerzo            E comedor, F tipo comida, G estado, H observacion (por DNI)
     registrarEnvioAlmuerzos   bitacora BB.ALMUERZOS: borra lo de HOY y guarda el detalle del dia
   Permiso: ALMUERZOS_PERMITIDOS (usuario del login firmado).
   La operacion queda en dbo.CV_Ops (tipo 'alm'); el Apps Script la copia a las hojas.
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
const { sql } = require('./db');
const TH = require('./tablas-hoja');
const CG = require('./cv-guardar');
const CAP = require('./cap-guardar');

const K_LISTA = 'alm_lista', K_BIT = 'alm_bitacora';
const ACCIONES = ['addAlmuerzo', 'updateAlmuerzo', 'registrarEnvioAlmuerzos'];
const LECTURAS = ['getAlmuerzos'];
const PERMITIDOS = ['jtimoteo', 'mportocarrero', 'jfernandez', 'lcovenas', 'smiranda'];   /* = ALMUERZOS_PERMITIDOS */
const ANCHO_LISTA = 9, ANCHO_BIT = 10;
const esD = v => !!(v && typeof v === 'object' && typeof v.$d === 'string');
const S = v => esD(v) ? v.$s : String(v == null ? '' : v);
const p2 = n => (n < 10 ? '0' : '') + n;
const lima = ms => new Date(ms - 5 * 3600e3);
const dmyLima = ms => { const x = lima(ms); return p2(x.getUTCDate()) + '/' + p2(x.getUTCMonth() + 1) + '/' + x.getUTCFullYear(); };
const hmLima = ms => { const x = lima(ms); return p2(x.getUTCHours()) + ':' + p2(x.getUTCMinutes()); };
const normDni = v => { let s = String(v == null ? '' : v).replace(/\D/g, ''); if (s.length === 7) s = '0' + s; return s; };
const tiene = u => PERMITIDOS.indexOf(String(u || '').toLowerCase().trim()) >= 0;
const SIN_PERMISO = {
  getAlmuerzos: 'Sin permisos para ver el programador de almuerzos',
  updateAlmuerzo: 'Sin permisos para modificar el programador de almuerzos',
  addAlmuerzo: 'Sin permisos para agregar colaboradores al programador de almuerzos'
};

async function encendido(pool) {
  const r = await pool.request().query("SELECT valor FROM dbo.CV_Estado WHERE clave = 'alm_azure_primero'");
  return r.recordset.length && r.recordset[0].valor === '1';
}
async function actualizarFila(tx, clave, i, celdas) {
  const E = TH.ESQ[clave], f = TH.aFila(clave, celdas), r = tx.request();
  r.input('fila', sql.Int, i + 1);
  const sets = E.cols.map((c, k) => { r.input('v' + k, c[1] === 'f' ? sql.DateTime2(3) : c[1] === 'n' ? sql.Float : sql.NVarChar(parseInt(c[1].slice(1), 10)), f.vals[k]); return c[0] + ' = @v' + k; });
  r.input('o', sql.NVarChar(sql.MAX), f.otros);
  await r.query(`UPDATE ${E.tabla} SET ${sets.join(', ')}, otros = @o, actualizado = SYSUTCDATETIME() WHERE fila = @fila`);
}
/* borra filas (indices 0-based de T.filas) y renumera como lo hace la hoja al borrar */
async function eliminarFilas(tx, clave, indices) {
  if (!indices.length) return;
  const E = TH.ESQ[clave];
  await tx.request().query(`DELETE FROM ${E.tabla} WHERE fila IN (${indices.map(i => i + 1).join(',')});
    WITH x AS (SELECT fila, rn = ROW_NUMBER() OVER (ORDER BY fila) FROM ${E.tabla}) UPDATE x SET fila = rn;`);
}

async function ejecutar(pool, accion, b, usuario, prueba, ahoraMs) {
  if (ACCIONES.indexOf(accion) < 0) return { status: 404, body: { success: false, error: 'Accion desconocida' } };
  b = b || {};
  if (accion !== 'registrarEnvioAlmuerzos' && !tiene(usuario)) return { status: 200, body: { success: false, error: SIN_PERMISO[accion] } };
  const clave = accion === 'registrarEnvioAlmuerzos' ? K_BIT : K_LISTA, ancho = accion === 'registrarEnvioAlmuerzos' ? ANCHO_BIT : ANCHO_LISTA;
  await CG.asegurarTablas(pool); await TH.asegurar(pool, clave);
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
    await tx.request().query("EXEC sp_getapplock @Resource = 'alm_guardar', @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 20000;");
    const T = await TH.leer(pool, clave);
    if (!T) { await tx.rollback(); return { status: 503, body: { success: false, error: 'Tabla ' + clave + ' aun no cargada' } }; }
    const filas = T.filas.map(f => { const c = f.slice(); while (c.length < ancho) c.push(''); return c; });
    let resp, cuerpo, nuevas = [], cambiadas = [], borradas = [];
    if (accion === 'addAlmuerzo') {
      const c = b.colaborador || {}, dni = normDni(c.dni);
      if (!dni) { await tx.rollback(); return { status: 200, body: { success: false, error: 'DNI inválido' } }; }
      if (filas.some(f => normDni(S(f[0])) === dni)) { await tx.rollback(); return { status: 200, body: { success: false, error: 'El colaborador ya está en la lista' } }; }
      const fila = [dni, c.nombre || '', c.cargo || '', c.regimen || '', c.comedor || '', c.tipo_comida || '', c.estado || 'ACTIVO', c.observacion || '', c.empresa || ''];
      const celdas = fila.map(v => CAP.comoHoja(v));
      nuevas.push(celdas); await CAP.agregarFilas(tx, K_LISTA, nuevas);
      resp = { success: true };
      cuerpo = { accion, fila, usuario: String(usuario || ''), ms };
    } else if (accion === 'updateAlmuerzo') {
      if (!filas.length) { await tx.rollback(); return { status: 200, body: { success: false, error: 'Lista vacía' } }; }
      const objetivo = normDni(b.dni), i = filas.findIndex(f => normDni(S(f[0])) === objetivo);
      if (i < 0) { await tx.rollback(); return { status: 200, body: { success: false, error: 'DNI no encontrado en la lista' } }; }
      const celdas = filas[i].slice();
      celdas[4] = CAP.comoHoja(b.comedor || ''); celdas[5] = CAP.comoHoja(b.tipo_comida || ''); celdas[6] = CAP.comoHoja(b.estado || ''); celdas[7] = CAP.comoHoja(b.observacion || '');
      await actualizarFila(tx, K_LISTA, i, celdas); cambiadas.push({ fila: i + 2, celdas });
      resp = { success: true };
      cuerpo = { accion, dni: String(b.dni || ''), comedor: b.comedor || '', tipo_comida: b.tipo_comida || '', estado: b.estado || '', observacion: b.observacion || '', usuario: String(usuario || ''), ms };
    } else {
      const lista = Array.isArray(b.colaboradores) ? b.colaboradores : [];
      if (!lista.length) { await tx.rollback(); return { status: 200, body: { success: false, error: 'No llegó el detalle de colaboradores' } }; }
      const hoyTxt = dmyLima(ms), horaTxt = hmLima(ms), hoyYmd = lima(ms).toISOString().slice(0, 10);
      filas.forEach((f, i) => {
        const v = f[0], esHoy = esD(v) ? (v.$d && lima(new Date(v.$d).getTime()).toISOString().slice(0, 10) === hoyYmd) : String(v == null ? '' : v).trim() === hoyTxt;
        if (esHoy) borradas.push(i);
      });
      await eliminarFilas(tx, K_BIT, borradas);
      const filasG = lista.map(c => [hoyTxt, horaTxt, String(c.dni || ''), c.nombre || '', c.comedor || '', c.tipo_comida || 'ALMUERZO', c.taper ? 'SÍ' : '', c.empresa || '', c.observacion || '', b.remitente_nombre || usuario || '']);
      nuevas = filasG.map(f => f.map((v, k) => k === 2 ? String(v) : CAP.comoHoja(v)));   /* el DNI va como texto (la hoja lo recibe con apostrofe) */
      await CAP.agregarFilas(tx, K_BIT, nuevas);
      resp = { success: true, guardados: filasG.length };
      cuerpo = { accion, hoyTxt, horaTxt, filas: filasG, usuario: String(usuario || ''), ms };
    }
    await CAP.tocarMarcas(tx, [clave]);
    resp.fuente = 'azure';
    await tx.request().input('k', sql.NVarChar(100), claveOp).input('a', sql.NVarChar(30), accion).input('u', sql.NVarChar(100), usuario ? String(usuario) : null)
      .input('c', sql.NVarChar(sql.MAX), JSON.stringify(cuerpo)).input('r', sql.NVarChar(sql.MAX), JSON.stringify(resp))
      .query("INSERT INTO dbo.CV_Ops (clave, tipo, accion, nro, usuario, cuerpo, respuesta) VALUES (@k, 'alm', @a, NULL, @u, @c, @r)");
    if (prueba) { await tx.rollback(); resp.prueba = true; resp._op = cuerpo; resp._nuevas = nuevas; resp._cambiadas = cambiadas; resp._borradas = borradas.length; } else await tx.commit();
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

/* = getAlmuerzos del Apps Script (A..I), desde la tabla */
function getAlmuerzos(T, usuario) {
  if (!tiene(usuario)) return { success: false, error: SIN_PERMISO.getAlmuerzos, colaboradores: [] };
  const t = v => S(v).trim();
  const out = [];
  T.filas.forEach(r => {
    const dni = t(r[0]); if (!dni) return;
    out.push({ dni, nombre: t(r[1]), cargo: t(r[2]), regimen: t(r[3]), comedor: t(r[4]), tipo_comida: t(r[5]), estado: t(r[6]), observacion: t(r[7]), empresa: t(r[8]) });
  });
  return { success: true, colaboradores: out, fuente: 'azure' };
}

module.exports = { ejecutar, encendido, getAlmuerzos, ACCIONES, LECTURAS, K_LISTA, K_BIT };
