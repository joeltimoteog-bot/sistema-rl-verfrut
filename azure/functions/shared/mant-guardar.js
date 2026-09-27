/* ═══════════════════════════════════════════════════════════════════════════
   _MANT_AZURE_V1 (27-set-2026) — MANTENIMIENTO se guarda PRIMERO en Azure
   ---------------------------------------------------------------------------
   Replica sobre dbo.Mant_Registro lo que escriben en "Registro de Mantenimiento":
     guardarSolicitudMantenimiento   fila nueva A-S, ID 'SOL-###' (la regla de siempre; nunca repite)
     programarMantenimiento          columnas O-R (estado, fecha programada, comentario, fecha respuesta)
     actualizarEstadoMantenimiento   Atendida / Cerrar: estado + fecha y usuario (columnas por cabecera)
   Mismas respuestas que el Apps Script ({ok, id} / {ok:false, msg}). Los CORREOS
   (al admin y al solicitante con copia) los sigue enviando Google al copiar la fila
   (cola CV_Ops tipo 'mant'), una sola vez.
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
const { sql } = require('./db');
const TH = require('./tablas-hoja');
const CG = require('./cv-guardar');
const CAP = require('./cap-guardar');

const ACCIONES = ['guardarSolicitudMantenimiento', 'programarMantenimiento', 'actualizarEstadoMantenimiento'];
const esD = v => !!(v && typeof v === 'object' && typeof v.$d === 'string');
const S = v => esD(v) ? v.$s : String(v == null ? '' : v);
const p2 = n => (n < 10 ? '0' : '') + n;
const pad3 = n => ('000' + n).slice(-3);

/* Utilities.formatDate(ahora, 'America/Lima', ...) — Lima es UTC-5 todo el año */
function lima(d) { const x = new Date(d.getTime() - 5 * 3600e3); return { dia: p2(x.getUTCDate()) + '/' + p2(x.getUTCMonth() + 1) + '/' + x.getUTCFullYear(), hm: p2(x.getUTCHours()) + ':' + p2(x.getUTCMinutes()) }; }
/* como la hoja (es_MX): 'dd/MM/yyyy HH:mm' valido pasa a fecha-hora; lo demas, las reglas de siempre */
function celda(v) {
  const m = typeof v === 'string' && v.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (m && +m[4] < 24 && +m[5] < 60) {
    const d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1], +m[4] + 5, +m[5], +(m[6] || 0)));
    if (new Date(Date.UTC(+m[3], +m[2] - 1, +m[1])).getUTCDate() === +m[1] && +m[2] >= 1 && +m[2] <= 12) return CAP.comoHoja(d);
  }
  return CAP.comoHoja(v);
}
const norm = s => String(s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9]/g, '');
/* = _mantColumnas (con ID_Solicitud / Estado_Solicitud reconocidos): indices 0-based, -1 si falta */
function columnas(enc) {
  const idx = {}; (enc || []).forEach((c, k) => { idx[norm(c)] = k; });
  const b = function () { for (let i = 0; i < arguments.length; i++) { const k = norm(arguments[i]); if (k in idx) return idx[k]; } return -1; };
  return { id: b('id', 'numSolicitud', 'n_solicitud', 'ID_Solicitud'), estado: b('estado', 'Estado_Solicitud'),
    fechaAtencion: b('fechaAtencion'), atendidoPor: b('atendidoPor'), fechaCierre: b('fechaCierre'), cerradoPor: b('cerradoPor') };
}

async function encendido(pool) {
  const r = await pool.request().query("SELECT valor FROM dbo.CV_Estado WHERE clave = 'mant_azure_primero'");
  return r.recordset.length && r.recordset[0].valor === '1';
}

async function actualizarFila(tx, i, celdas) {
  const E = TH.ESQ.mant_registro, f = TH.aFila('mant_registro', celdas), r = tx.request();
  r.input('fila', sql.Int, i + 1);
  const sets = E.cols.map((c, k) => { r.input('v' + k, c[1] === 'f' ? sql.DateTime2(3) : c[1] === 'n' ? sql.Float : sql.NVarChar(parseInt(c[1].slice(1), 10)), f.vals[k]); return c[0] + ' = @v' + k; });
  r.input('o', sql.NVarChar(sql.MAX), f.otros);
  await r.query(`UPDATE ${E.tabla} SET ${sets.join(', ')}, otros = @o, actualizado = SYSUTCDATETIME() WHERE fila = @fila`);
}

async function ejecutar(pool, accion, b, usuario, prueba, ahoraFija) {
  if (ACCIONES.indexOf(accion) < 0) return { status: 404, body: { ok: false, msg: 'Accion desconocida' } };
  await CG.asegurarTablas(pool); await TH.asegurar(pool, 'mant_registro');
  b = b || {};
  const clave = String(b.client_id || '').replace(/[^\w-]/g, '').slice(0, 90);
  const claveOp = (clave ? 'mant:' + clave : 'mant:sin-huella-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8)).slice(0, 100);
  if (clave && !prueba) {
    const p = await pool.request().input('k', sql.NVarChar(100), claveOp).query('SELECT respuesta FROM dbo.CV_Ops WHERE clave = @k');
    if (p.recordset.length && p.recordset[0].respuesta) return { status: 200, body: Object.assign(JSON.parse(p.recordset[0].respuesta), { duplicadoEvitado: true }) };
  }
  const tx = new sql.Transaction(pool);
  await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    await tx.request().query("EXEC sp_getapplock @Resource = 'mant_guardar', @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 20000;");
    const T = await TH.leer(pool, 'mant_registro');
    if (!T) { await tx.rollback(); return { status: 503, body: { ok: false, msg: 'Tabla de mantenimiento aun no cargada' } }; }
    const ahora = ahoraFija ? new Date(ahoraFija) : new Date(), L = lima(ahora);
    const buscar = id => T.filas.findIndex(f => S(f[0]).trim() === String(id).trim());
    let resp, cuerpo, celdas;
    if (accion === 'guardarSolicitudMantenimiento') {
      const d = b, ids = new Set(T.filas.map(f => S(f[0]).trim()));
      let n = T.filas.length + 1, id = 'SOL-' + pad3(n);            /* = 'SOL-' + ('000' + getLastRow()).slice(-3) */
      while (ids.has(id)) { n++; id = 'SOL-' + (n < 1000 ? pad3(n) : n); }   /* nunca repetir un ID */
      const fecha = L.dia + ' ' + L.hm;
      const fila = [id, fecha, d.dni || '', d.nombre || '', d.empresa || '', d.codInterno || '', ((d.modelo || '') + ' ' + (d.marca || '')).trim(),
        d.numLicencia || '', d.tipoLicencia || '', d.fRevalidacion || '', d.estadoLicencia || '', d.kilometraje || '', d.tipoMantenimiento || '',
        d.observaciones || '', 'PENDIENTE', '', '', '', d.solicitante || ''];
      celdas = fila.map(celda);
      await CAP.agregarFilas(tx, 'mant_registro', [celdas]);
      resp = { ok: true, id };
      const correo = {}; ['dni', 'nombre', 'empresa', 'modelo', 'marca', 'codInterno', 'kilometraje', 'numLicencia', 'tipoLicencia', 'fRevalidacion', 'estadoLicencia', 'tipoMantenimiento', 'observaciones'].forEach(k => { if (d[k] !== undefined) correo[k] = d[k]; });
      cuerpo = { accion, id, ahora: fecha, fila, d: correo };
    } else if (accion === 'programarMantenimiento') {
      const i = buscar(b.id);
      if (i < 0) { await tx.rollback(); return { status: 200, body: { ok: false, msg: 'No se encontró la solicitud ' + b.id } }; }
      const estado = String(b.estado || 'PROGRAMADO').toUpperCase();
      const valores = [estado, b.fechaProgramada || '', b.comentario || '', L.dia + ' ' + L.hm];
      celdas = T.filas[i].slice(); while (celdas.length < 18) celdas.push('');
      valores.forEach((v, k) => { celdas[14 + k] = celda(v); });
      await actualizarFila(tx, i, celdas);
      resp = { ok: true };
      cuerpo = { accion, id: String(b.id), valores };   /* el id tal cual (el correo lo usa asi); Google lo busca sin espacios */
    } else {
      const estado = String(b.estado || '').toUpperCase().trim();
      if (!b.id) { await tx.rollback(); return { status: 200, body: { ok: false, msg: 'Falta el id de la solicitud' } }; }
      if (estado !== 'ATENDIDO' && estado !== 'CERRADO') { await tx.rollback(); return { status: 200, body: { ok: false, msg: 'Estado inválido: ' + estado } }; }
      const col = columnas(T.encabezado);
      const cF = estado === 'ATENDIDO' ? col.fechaAtencion : col.fechaCierre, cP = estado === 'ATENDIDO' ? col.atendidoPor : col.cerradoPor;
      if (col.id < 0 || col.estado < 0 || cF < 0 || cP < 0) { await tx.rollback(); return { status: 409, body: { ok: false, msg: 'La hoja no tiene las columnas esperadas: se usa Google' } }; }
      const i = T.filas.findIndex(f => S(f[col.id]).trim() === String(b.id).trim());
      if (i < 0) { await tx.rollback(); return { status: 200, body: { ok: false, msg: 'Solicitud no encontrada: ' + b.id } }; }
      const admin = b.admin || '';
      celdas = T.filas[i].slice(); while (celdas.length < Math.max(cF, cP, col.estado) + 1) celdas.push('');
      celdas[col.estado] = celda(estado); celdas[cF] = celda(L.dia); celdas[cP] = celda(admin);
      await actualizarFila(tx, i, celdas);
      resp = { ok: true, id: b.id, estado, fecha: L.dia };
      cuerpo = { accion, id: String(b.id), estado, fecha: L.dia, admin };
    }
    cuerpo.clave = claveOp;   /* Google no repite el correo si copia esta operacion dos veces */
    await CAP.tocarMarcas(tx, ['mant_registro']);
    resp.fuente = 'azure';
    await tx.request().input('k', sql.NVarChar(100), claveOp).input('a', sql.NVarChar(30), accion.slice(0, 30)).input('u', sql.NVarChar(100), usuario ? String(usuario) : null)
      .input('c', sql.NVarChar(sql.MAX), JSON.stringify(cuerpo)).input('r', sql.NVarChar(sql.MAX), JSON.stringify(resp))
      .query("INSERT INTO dbo.CV_Ops (clave, tipo, accion, nro, usuario, cuerpo, respuesta) VALUES (@k, 'mant', @a, NULL, @u, @c, @r)");
    if (prueba) { await tx.rollback(); resp.prueba = true; resp._op = cuerpo; resp._celdas = celdas; } else await tx.commit();
    return { status: 200, body: resp };
  } catch (e) {
    try { await tx.rollback(); } catch (e2) {}
    if (clave && /UQ_CV_Ops_clave|duplicate key/i.test(e.message || '')) {
      const p = await pool.request().input('k', sql.NVarChar(100), claveOp).query('SELECT respuesta FROM dbo.CV_Ops WHERE clave = @k');
      if (p.recordset.length && p.recordset[0].respuesta) return { status: 200, body: Object.assign(JSON.parse(p.recordset[0].respuesta), { duplicadoEvitado: true }) };
    }
    throw e;
  }
}
module.exports = { ejecutar, encendido, columnas, celda, lima, ACCIONES };
