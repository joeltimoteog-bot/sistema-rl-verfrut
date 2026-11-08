/* ═══════════════════════════════════════════════════════════════════════════
   _BS_GUARDA_SUPABASE_V1 (08-nov-2026) — Bienestar Social guarda DIRECTO en Supabase
   ---------------------------------------------------------------------------
   Base común del plan "Bienestar guarda directo en Supabase" (paso 0). Replica lo que
   hoy hace el Apps Script sobre las hojas BS_* pero sobre las tablas-hoja (shared/
   tablas-hoja.js), manteniendo la MISMA forma: una fila por registro, celdas en el
   orden del encabezado guardado en TH_Estado, columnas que la tabla no conoce (p. ej.
   'anulado' en la mayoría de hojas) en 'otros' (JSON), y la marca de TH_Estado se
   renueva en cada escritura para que bs/tabla (leer() con memoria por marca) vea el
   cambio al instante.
   · id = max(id)+1 con candado por tabla (igual que _bsSiguienteId_ del Apps Script).
   · anular = texto 'SI · usuario · dd/MM/yyyy HH:mm · motivo' en la columna 'anulado'
     (se agrega al encabezado si la hoja no la tenía), restaurar = la vacía.
   · Cada escritura deja su fila en BS_Auditoria dentro de la MISMA transacción.
   · BS_Fuente dice, por tabla, quién manda: 'hoja' (Google sigue siendo la fuente y
     la sube bs-azure-sync) o 'supabase' (se guarda aquí; la hoja ya no se vuelve a
     cargar encima: mantenimiento/hoja/<clave>/fin responde 409). Mientras una tabla
     esté en 'hoja', bs/guardar responde 409 y el navegador sigue usando Google.
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
const { sql } = require('./db');
const TH = require('./tablas-hoja');
const { comoHoja } = require('./cap-guardar');

const CLAVES_BS = ['bs_accidentes_casos', 'bs_accidentes_seguim', 'bs_hostigamiento', 'bs_hostigamiento_olmos', 'bs_subsidios', 'bs_documentos',
  'bs_quejas', 'bs_quejas_seguim', 'bs_descansos', 'bs_auditoria', 'bs_rendiciones', 'bs_sugerencias', 'bs_buzones'];
const MODULO_DE_CLAVE = { bs_accidentes_casos: 'accidentes', bs_accidentes_seguim: 'accidentes', bs_hostigamiento: 'hostigamiento', bs_hostigamiento_olmos: 'hostigamiento',
  bs_subsidios: 'subsidios', bs_documentos: '', bs_quejas: 'quejas', bs_quejas_seguim: 'quejas', bs_descansos: 'descansos', bs_auditoria: '',
  bs_rendiciones: 'rendiciones', bs_sugerencias: 'sugerencias', bs_buzones: 'quejas' };
/* seguimientos: tabla hija → padre, llave y contador que se actualiza en el padre (accidentes: numero_atenciones; hallazgos: solo updated_at) */
const SEGUIMIENTO = {
  bs_accidentes_seguim: { padre: 'bs_accidentes_casos', fk: 'id_caso', contador: 'numero_atenciones' },
  bs_quejas_seguim: { padre: 'bs_quejas', fk: 'id_queja', contador: null }
};
/* encabezado inicial de las hojas que aún no tienen tabla (mismo orden que las hojas de Google) */
const ENCABEZADO_INICIAL = {
  bs_rendiciones: ['id', 'fecha', 'semana', 'anio', 'rendicion', 'empresa', 'monto_reclutamiento', 'monto_relaciones_laborales', 'monto_capacitaciones', 'monto_bienestar', 'monto_total', 'responsable', 'estado', 'fecha_deposito', 'observaciones', 'created_by', 'created_at', 'updated_at'],
  bs_sugerencias: ['id', 'fecha', 'usuario', 'nombre_usuario', 'titulo', 'modulo', 'descripcion', 'prioridad', 'estado', 'respuesta_admin', 'fecha_finalizado', 'created_by', 'created_at', 'updated_at'],
  bs_buzones: ['id', 'empresa', 'sector', 'numero', 'ubicacion', 'activo', 'created_at']
};
const NO_EDITABLES = ['id', 'created_by', 'created_at', 'anulado'];
const esD = v => !!(v && typeof v === 'object' && typeof v.$d === 'string');
const texto = v => esD(v) ? v.$s : String(v == null ? '' : v);
const p2 = n => (n < 10 ? '0' : '') + n;
const celdaFecha = d => ({ $d: d.toISOString(), $s: TH.textoGoogle(d) });
function limaTexto(d) { const x = new Date(d.getTime() - 5 * 3600e3); return p2(x.getUTCDate()) + '/' + p2(x.getUTCMonth() + 1) + '/' + x.getUTCFullYear() + ' ' + p2(x.getUTCHours()) + ':' + p2(x.getUTCMinutes()); }
const mismoId = (a, b) => String(a == null ? '' : a).trim() === String(b == null ? '' : b).trim() || (Number(a) > 0 && Number(a) === Number(b));

let fuenteLista = null;
function asegurarFuente(pool) {
  if (!fuenteLista) fuenteLista = pool.request().query(`IF OBJECT_ID('dbo.BS_Fuente', 'U') IS NULL
    CREATE TABLE dbo.BS_Fuente (clave NVARCHAR(40) NOT NULL PRIMARY KEY, fuente NVARCHAR(20) NOT NULL, desde DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(), por NVARCHAR(100) NULL);`)
    .catch(e => { fuenteLista = null; throw e; });
  return fuenteLista;
}
/* 'supabase' | 'hoja' (sin fila = 'hoja': Google sigue mandando) */
async function fuenteDe(pool, clave) {
  await asegurarFuente(pool);
  const r = await pool.request().input('k', sql.NVarChar(40), clave).query('SELECT fuente FROM dbo.BS_Fuente WHERE clave = @k');
  return r.recordset.length ? String(r.recordset[0].fuente) : 'hoja';
}
async function fuentes(pool) {
  await asegurarFuente(pool);
  const r = await pool.request().query('SELECT clave, fuente, desde, por FROM dbo.BS_Fuente');
  const m = {}; r.recordset.forEach(x => { m[x.clave] = { fuente: x.fuente, desde: x.desde, por: x.por }; });
  return CLAVES_BS.map(k => Object.assign({ clave: k, modulo: MODULO_DE_CLAVE[k] || '' }, m[k] || { fuente: 'hoja', desde: null, por: null }));
}
async function ponerFuente(pool, clave, fuente, por) {
  if (CLAVES_BS.indexOf(clave) < 0) throw new Error('Tabla desconocida: ' + clave);
  if (fuente !== 'supabase' && fuente !== 'hoja') throw new Error("fuente debe ser 'supabase' u 'hoja'");
  await asegurarFuente(pool); await TH.asegurar(pool, clave);
  await pool.request().input('k', sql.NVarChar(40), clave).input('f', sql.NVarChar(20), fuente).input('p', sql.NVarChar(100), String(por || '').slice(0, 100))
    .query(`MERGE dbo.BS_Fuente AS x USING (SELECT @k AS clave) AS s ON x.clave = s.clave
            WHEN MATCHED THEN UPDATE SET fuente = @f, desde = SYSUTCDATETIME(), por = @p
            WHEN NOT MATCHED THEN INSERT (clave, fuente, por) VALUES (@k, @f, @p);`);
  if (fuente === 'supabase') { const tx = new sql.Transaction(pool); await tx.begin(); try { await cabecera(tx, clave); await tx.commit(); } catch (e) { try { await tx.rollback(); } catch (e2) {} throw e; } }
  return fuenteDe(pool, clave);
}

/* encabezado y ancho de la tabla (TH_Estado). Si la hoja nunca se cargó (tablas nuevas), se crea con el encabezado inicial. */
async function cabecera(tx, clave) {
  const r = await tx.request().input('k', sql.NVarChar(40), clave).query('SELECT encabezado, ancho, marca FROM dbo.TH_Estado WHERE clave = @k');
  const est = r.recordset[0];
  if (est && est.encabezado) {
    const enc = JSON.parse(est.encabezado).map(texto).map(s => s.trim());
    return { enc, ancho: Math.max(est.ancho || 0, enc.length), nueva: false };
  }
  const enc = ENCABEZADO_INICIAL[clave] || TH.ESQ[clave].cols.map(c => c[0]);
  await tx.request().input('k', sql.NVarChar(40), clave).input('e', sql.NVarChar(sql.MAX), JSON.stringify(enc)).input('a', sql.Int, enc.length).input('m', sql.NVarChar(40), String(Date.now()))
    .query(`MERGE dbo.TH_Estado AS x USING (SELECT @k AS clave) AS s ON x.clave = s.clave
            WHEN MATCHED THEN UPDATE SET encabezado = @e, ancho = @a, marca = @m, filas = (SELECT COUNT(*) FROM ${TH.ESQ[clave].tabla}), actualizado = SYSUTCDATETIME()
            WHEN NOT MATCHED THEN INSERT (clave, encabezado, ancho, marca, filas) VALUES (@k, @e, @a, @m, 0);`);
  return { enc, ancho: enc.length, nueva: true };
}
async function guardarCabecera(tx, clave, enc) {
  await tx.request().input('k', sql.NVarChar(40), clave).input('e', sql.NVarChar(sql.MAX), JSON.stringify(enc)).input('a', sql.Int, enc.length)
    .query('UPDATE dbo.TH_Estado SET encabezado = @e, ancho = @a WHERE clave = @k');
}
async function candado(tx, clave) {
  await tx.request().query(`EXEC sp_getapplock @Resource = 'bs_${clave}', @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 20000;`);
}
async function tocarMarca(tx, clave) {
  await tx.request().input('k', sql.NVarChar(40), clave).input('m', sql.NVarChar(40), String(Date.now()))
    .query('UPDATE dbo.TH_Estado SET marca = @m, filas = (SELECT COUNT(*) FROM ' + TH.ESQ[clave].tabla + '), actualizado = SYSUTCDATETIME() WHERE clave = @k');
}
/* siguiente id: max(id)+1 (ids no numéricos se ignoran, como _bsSiguienteId_) */
async function siguienteId(tx, clave, enc) {
  const E = TH.ESQ[clave], iId = enc.indexOf('id');
  if (iId < 0) throw new Error('La hoja ' + clave + ' no tiene columna id');
  const col = E.cols[iId] && E.cols[iId][0] === 'id' ? E.cols[iId] : E.cols.find(c => c[0] === 'id');
  if (col && col[1] === 'n') {
    const r = await tx.request().query(`SELECT ISNULL(MAX(id), 0) AS m FROM ${E.tabla}`);
    return Math.floor(Number(r.recordset[0].m) || 0) + 1;
  }
  const r = await tx.request().query(`SELECT id, otros FROM ${E.tabla}`);
  let m = 0; r.recordset.forEach(x => { const n = parseInt(x.id, 10); if (!isNaN(n) && n > m) m = n; });
  return m + 1;
}
async function siguienteFila(tx, clave) {
  const r = await tx.request().query(`SELECT ISNULL(MAX(fila), 0) AS m FROM ${TH.ESQ[clave].tabla}`);
  return Number(r.recordset[0].m) + 1;
}
async function insertarCeldas(tx, clave, fila, celdas) {
  const E = TH.ESQ[clave], f = TH.aFila(clave, celdas), r = tx.request(), ps = ['@f'];
  r.input('f', sql.Int, fila);
  E.cols.forEach((c, k) => { r.input('v' + k, c[1] === 'f' ? sql.DateTime2(3) : c[1] === 'n' ? sql.Float : sql.NVarChar(parseInt(c[1].slice(1), 10)), f.vals[k]); ps.push('@v' + k); });
  r.input('o', sql.NVarChar(sql.MAX), f.otros); ps.push('@o');
  await r.query(`INSERT INTO ${E.tabla} (fila, ${E.cols.map(c => c[0]).join(', ')}, otros) VALUES (${ps.join(', ')})`);
}
async function reemplazarCeldas(tx, clave, idFila, celdas) {
  const E = TH.ESQ[clave], f = TH.aFila(clave, celdas), r = tx.request(), sets = [];
  r.input('pk', sql.Int, idFila);
  E.cols.forEach((c, k) => { r.input('v' + k, c[1] === 'f' ? sql.DateTime2(3) : c[1] === 'n' ? sql.Float : sql.NVarChar(parseInt(c[1].slice(1), 10)), f.vals[k]); sets.push(c[0] + ' = @v' + k); });
  r.input('o', sql.NVarChar(sql.MAX), f.otros); sets.push('otros = @o');
  await r.query(`UPDATE ${E.tabla} SET ${sets.join(', ')}, actualizado = SYSUTCDATETIME() WHERE id_fila = @pk`);
}
/* registro por id → { id_fila, celdas } (celdas como las entrega la hoja) o null */
async function buscarPorId(tx, clave, id, ancho) {
  const E = TH.ESQ[clave], colId = E.cols.find(c => c[0] === 'id');
  let r;
  if (colId && colId[1] === 'n' && Number(id) > 0) r = await tx.request().input('id', sql.Float, Number(id)).query(`SELECT * FROM ${E.tabla} WHERE id = @id ORDER BY fila`);
  else r = await tx.request().input('id', sql.NVarChar(40), String(id).trim()).query(`SELECT * FROM ${E.tabla} WHERE LTRIM(RTRIM(CAST(id AS NVARCHAR(40)))) = @id ORDER BY fila`);
  if (!r.recordset.length) {   /* el id pudo quedar en 'otros' (celda fuera de tipo): se busca en todo */
    const todo = await tx.request().query(`SELECT * FROM ${E.tabla} ORDER BY fila`);
    const iId = E.cols.findIndex(c => c[0] === 'id');
    r = { recordset: todo.recordset.filter(x => mismoId(TH.aCeldas(clave, x, ancho)[iId], id)) };
  }
  if (!r.recordset.length) return null;
  const x = r.recordset[0];
  return { id_fila: x.id_fila, celdas: TH.aCeldas(clave, x, ancho) };
}
/* texto de 'anulado' de un registro ('' si no está anulado) */
function marcaAnulado(enc, celdas) { const i = enc.indexOf('anulado'); return i < 0 ? '' : texto(celdas[i]).trim(); }

/* auditoría en la misma transacción (BS_Auditoria: fecha, usuario, accion, modulo, registro_id, detalle) */
async function auditar(tx, usuario, accion, modulo, registroId, detalle) {
  const clave = 'bs_auditoria', cab = await cabecera(tx, clave), ahora = new Date();
  const v = { fecha: celdaFecha(ahora), usuario: String(usuario || ''), accion: String(accion || ''), modulo: String(modulo || ''),
    registro_id: registroId === undefined || registroId === null ? '' : (typeof registroId === 'number' ? registroId : String(registroId)), detalle: String(detalle || '').slice(0, 500) };
  const celdas = cab.enc.map(h => (v[h] !== undefined ? v[h] : ''));
  await insertarCeldas(tx, clave, await siguienteFila(tx, clave), celdas);
  await tocarMarca(tx, clave);
}

/* ---- operaciones (todas dentro de una transacción con candado por tabla) ---- */
async function enTransaccion(pool, claves, fn) {
  const tx = new sql.Transaction(pool); await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try { for (const k of claves) await candado(tx, k); const out = await fn(tx); await tx.commit(); return out; }
  catch (e) { try { await tx.rollback(); } catch (e2) {} throw e; }
}
function valoresDesde(datos, enc, usuario, ahora, nuevo) {
  const v = {};
  Object.keys(datos || {}).forEach(h => { if (enc.indexOf(h) >= 0 && NO_EDITABLES.indexOf(h) < 0) v[h] = comoHoja(datos[h]); });
  if (nuevo) { v.created_by = String(usuario || ''); v.created_at = celdaFecha(ahora); }
  v.updated_at = celdaFecha(ahora); if (enc.indexOf('updated_by') >= 0 && !nuevo) v.updated_by = String(usuario || '');
  return v;
}
async function crear(pool, clave, datos, usuario, opciones) {
  const o = opciones || {};
  return enTransaccion(pool, [clave, 'bs_auditoria'], async tx => {
    const cab = await cabecera(tx, clave), ahora = new Date(), enc = cab.enc;
    const id = await siguienteId(tx, clave, enc), v = valoresDesde(datos, enc, usuario, ahora, true); v.id = id;
    if (o.completar) o.completar(v, enc);
    const celdas = enc.map(h => (v[h] !== undefined ? v[h] : ''));
    await insertarCeldas(tx, clave, await siguienteFila(tx, clave), celdas);
    await tocarMarca(tx, clave);
    await auditar(tx, usuario, 'CREAR', MODULO_DE_CLAVE[clave] || clave, id, o.detalle || '');
    return { ok: true, success: true, id, fuente: 'supabase' };
  });
}
async function actualizar(pool, clave, id, datos, usuario, opciones) {
  const o = opciones || {};
  return enTransaccion(pool, [clave, 'bs_auditoria'], async tx => {
    const cab = await cabecera(tx, clave), ahora = new Date(), enc = cab.enc;
    const reg = await buscarPorId(tx, clave, id, cab.ancho);
    if (!reg) return { ok: false, success: false, status: 404, message: 'Registro #' + id + ' no encontrado.' };
    if (marcaAnulado(enc, reg.celdas) && !o.permitirAnulado) return { ok: false, success: false, status: 409, message: 'El registro #' + id + ' está anulado; restáuralo antes de editarlo.' };
    const v = valoresDesde(datos, enc, usuario, ahora, false), celdas = reg.celdas.slice();
    while (celdas.length < enc.length) celdas.push('');
    let cambios = 0; enc.forEach((h, i) => { if (v[h] !== undefined) { if (h !== 'updated_at' && h !== 'updated_by' && texto(celdas[i]) !== texto(v[h])) cambios++; celdas[i] = v[h]; } });
    await reemplazarCeldas(tx, clave, reg.id_fila, celdas);
    await tocarMarca(tx, clave);
    await auditar(tx, usuario, 'ACTUALIZAR', MODULO_DE_CLAVE[clave] || clave, id, o.detalle || ('campos: ' + Object.keys(v).filter(k => k !== 'updated_at' && k !== 'updated_by').join(', ')));
    return { ok: true, success: true, id, cambios, fuente: 'supabase' };
  });
}
/* seguimiento = fila nueva en la tabla hija (numero_seguimiento consecutivo dentro del caso) + updated_at/contador en el padre */
async function seguimiento(pool, claveHija, idPadre, datos, usuario) {
  const S = SEGUIMIENTO[claveHija]; if (!S) throw new Error(claveHija + ' no es una tabla de seguimientos');
  return enTransaccion(pool, [claveHija, S.padre, 'bs_auditoria'], async tx => {
    const cabP = await cabecera(tx, S.padre), padre = await buscarPorId(tx, S.padre, idPadre, cabP.ancho);
    if (!padre) return { ok: false, success: false, status: 404, message: 'Caso #' + idPadre + ' no encontrado.' };
    const cab = await cabecera(tx, claveHija), enc = cab.enc, ahora = new Date();
    const todas = await tx.request().query(`SELECT * FROM ${TH.ESQ[claveHija].tabla} ORDER BY fila`);
    const iFk = enc.indexOf(S.fk), numero = todas.recordset.filter(x => mismoId(TH.aCeldas(claveHija, x, cab.ancho)[iFk], idPadre)).length + 1;
    const id = await siguienteId(tx, claveHija, enc);
    const v = { id, numero_seguimiento: numero, fecha_seguimiento: datos && datos.fecha_seguimiento ? comoHoja(datos.fecha_seguimiento) : celdaFecha(ahora),
      detalle: String((datos && datos.detalle) || ''), created_by: String(usuario || ''), created_at: celdaFecha(ahora) };
    v[S.fk] = Number(idPadre) > 0 ? Number(idPadre) : String(idPadre);
    await insertarCeldas(tx, claveHija, await siguienteFila(tx, claveHija), enc.map(h => (v[h] !== undefined ? v[h] : '')));
    await tocarMarca(tx, claveHija);
    const cp = padre.celdas.slice(); while (cp.length < cabP.enc.length) cp.push('');
    const iUpd = cabP.enc.indexOf('updated_at'); if (iUpd >= 0) cp[iUpd] = celdaFecha(ahora);
    if (S.contador) { const iC = cabP.enc.indexOf(S.contador); if (iC >= 0) cp[iC] = numero; }
    await reemplazarCeldas(tx, S.padre, padre.id_fila, cp);
    await tocarMarca(tx, S.padre);
    await auditar(tx, usuario, 'CREAR', MODULO_DE_CLAVE[claveHija] || claveHija, id, 'seguimiento #' + numero + ' del caso ' + idPadre);
    return { ok: true, success: true, id, numero, message: 'Seguimiento #' + numero + ' registrado', fuente: 'supabase' };
  });
}
async function anular(pool, clave, id, motivo, usuario) {
  motivo = String(motivo || '').trim();
  if (!motivo) return { ok: false, success: false, status: 400, message: 'Indica el motivo de la anulación.' };
  return enTransaccion(pool, [clave, 'bs_auditoria'], async tx => {
    const cab = await cabecera(tx, clave); let enc = cab.enc;
    const reg = await buscarPorId(tx, clave, id, cab.ancho);
    if (!reg) return { ok: false, success: false, status: 404, message: 'No se encontró el registro #' + id + '.' };
    const ya = marcaAnulado(enc, reg.celdas);
    if (ya) return { ok: false, success: false, status: 409, message: 'El registro #' + id + ' ya estaba anulado (' + ya + ').' };
    if (enc.indexOf('anulado') < 0) { enc = enc.concat(['anulado']); await guardarCabecera(tx, clave, enc); }   /* como el Apps Script: crea la columna al final */
    const celdas = reg.celdas.slice(); while (celdas.length < enc.length) celdas.push('');
    const ahora = new Date();
    celdas[enc.indexOf('anulado')] = 'SI · ' + String(usuario || '') + ' · ' + limaTexto(ahora) + ' · ' + motivo;
    const iUpd = enc.indexOf('updated_at'); if (iUpd >= 0) celdas[iUpd] = celdaFecha(ahora);
    await reemplazarCeldas(tx, clave, reg.id_fila, celdas);
    await tocarMarca(tx, clave);
    await auditar(tx, usuario, 'ANULAR', MODULO_DE_CLAVE[clave] || clave, id, motivo);
    return { ok: true, success: true, id, message: 'Registro #' + id + ' anulado.', fuente: 'supabase' };
  });
}
async function restaurar(pool, clave, id, usuario, motivo) {
  return enTransaccion(pool, [clave, 'bs_auditoria'], async tx => {
    const cab = await cabecera(tx, clave), enc = cab.enc;
    const reg = await buscarPorId(tx, clave, id, cab.ancho);
    if (!reg) return { ok: false, success: false, status: 404, message: 'No se encontró el registro #' + id + '.' };
    const ya = marcaAnulado(enc, reg.celdas);
    if (!ya) return { ok: false, success: false, status: 409, message: 'El registro #' + id + ' no estaba anulado.' };
    const celdas = reg.celdas.slice(); while (celdas.length < enc.length) celdas.push('');
    celdas[enc.indexOf('anulado')] = '';
    const iUpd = enc.indexOf('updated_at'); if (iUpd >= 0) celdas[iUpd] = celdaFecha(new Date());
    await reemplazarCeldas(tx, clave, reg.id_fila, celdas);
    await tocarMarca(tx, clave);
    await auditar(tx, usuario, 'RESTAURAR', MODULO_DE_CLAVE[clave] || clave, id, String(motivo || '').trim() || ('estaba: ' + ya));
    return { ok: true, success: true, id, message: 'Registro #' + id + ' restaurado.', fuente: 'supabase' };
  });
}
/* evento de auditoría suelto (lo manda el Apps Script por cada escritura que aún hace en Google, y el frontend ACCESO/EXPORTAR) */
async function registrarEvento(pool, ev) {
  return enTransaccion(pool, ['bs_auditoria'], async tx => {
    await auditar(tx, ev.usuario, ev.accion, ev.modulo, ev.registro_id, ev.detalle);
    return { ok: true, success: true };
  });
}

/* ---- respaldo diario: cada tabla bs_* como JSON {encabezado, filas} en Storage (bucket privado 'respaldos'), 90 días ---- */
const env = k => (typeof process !== 'undefined' && process.env && process.env[k]) || '';
function storage() {
  const url = env('SUPABASE_URL').replace(/\/+$/, ''), key = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Respaldo: faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  return { url, h: { Authorization: 'Bearer ' + key, apikey: key } };
}
async function respaldar(pool, dias) {
  const s = storage(), bucket = 'respaldos', conservar = Math.max(7, parseInt(dias, 10) || 90);
  let r = await fetch(s.url + '/storage/v1/bucket/' + bucket, { headers: s.h });
  if (r.status === 404 || r.status === 400) {
    r = await fetch(s.url + '/storage/v1/bucket', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, s.h), body: JSON.stringify({ id: bucket, name: bucket, public: false }) });
    if (!r.ok && r.status !== 409) throw new Error('Storage bucket HTTP ' + r.status + ': ' + (await r.text()).slice(0, 200));
  } else if (!r.ok) throw new Error('Storage bucket HTTP ' + r.status);
  const dia = new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10), out = { ok: true, success: true, dia, bucket, tablas: {}, borrados: 0 };
  for (const k of CLAVES_BS) {
    const d = await TH.leer(pool, k);
    if (!d) { out.tablas[k] = 'sin cargar'; continue; }
    const cuerpo = JSON.stringify({ clave: k, tabla: TH.ESQ[k].tabla, fecha: new Date().toISOString(), encabezado: d.encabezado, filas: d.filas });
    const nombre = 'bienestar/' + dia + '/' + k + '.json';
    r = await fetch(s.url + '/storage/v1/object/' + bucket + '/' + nombre, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json', 'x-upsert': 'true' }, s.h), body: cuerpo });
    if (!r.ok) throw new Error('Storage ' + nombre + ' HTTP ' + r.status + ': ' + (await r.text()).slice(0, 200));
    out.tablas[k] = d.filas.length + ' filas · ' + Math.round(cuerpo.length / 1024) + ' KB';
  }
  /* poda: carpetas bienestar/YYYY-MM-DD anteriores a 'conservar' días */
  r = await fetch(s.url + '/storage/v1/object/list/' + bucket, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, s.h), body: JSON.stringify({ prefix: 'bienestar/', limit: 1000, offset: 0 }) });
  if (r.ok) {
    const carpetas = (await r.json()).map(x => x.name).filter(n => /^\d{4}-\d{2}-\d{2}$/.test(n));
    const limite = new Date(Date.now() - 5 * 3600e3 - conservar * 86400e3).toISOString().slice(0, 10);
    for (const c of carpetas.filter(n => n < limite)) {
      const rl = await fetch(s.url + '/storage/v1/object/list/' + bucket, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, s.h), body: JSON.stringify({ prefix: 'bienestar/' + c + '/', limit: 1000, offset: 0 }) });
      if (!rl.ok) continue;
      const nombres = (await rl.json()).map(x => 'bienestar/' + c + '/' + x.name);
      if (!nombres.length) continue;
      const rd = await fetch(s.url + '/storage/v1/object/' + bucket, { method: 'DELETE', headers: Object.assign({ 'Content-Type': 'application/json' }, s.h), body: JSON.stringify({ prefixes: nombres }) });
      if (rd.ok) out.borrados += nombres.length;
    }
  }
  return out;
}

module.exports = { CLAVES_BS, MODULO_DE_CLAVE, SEGUIMIENTO, fuenteDe, fuentes, ponerFuente, crear, actualizar, seguimiento, anular, restaurar, registrarEvento, respaldar, auditar, cabecera };
