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
  bs_accidentes_seguim: { padre: 'bs_accidentes_casos', fk: 'id_caso', contador: 'numero_atenciones', exige: ['detalle'] },
  bs_quejas_seguim: { padre: 'bs_quejas', fk: 'id_queja', contador: null, exige: ['fecha_seguimiento', 'detalle'], mensaje: 'Completa fecha y detalle' }
};
/* valores por defecto y tipos al CREAR, iguales a los que ponía el Apps Script (bs_crearQueja, etc.) */
const ENTERO = v => { const n = parseInt(String(v == null ? '' : v).replace(/[^\d-]/g, ''), 10); return isNaN(n) ? 0 : n; };
const DECIMAL = v => { const n = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isNaN(n) ? 0 : n; };
const NORMALIZAR = {
  bs_accidentes_casos: (v, nuevo) => {
    const INT = ['dias_restriccion', 'numero_atenciones', 'descanso_medico_dias', 'goce_dias'];
    if (nuevo) {
      if (!v.estado_caso) v.estado_caso = 'Activo';
      INT.forEach(k => { v[k] = ENTERO(v[k]); });
      v.edad = v.edad === '' || v.edad == null || isNaN(parseInt(v.edad, 10)) ? '' : parseInt(v.edad, 10);
      v.accidente_horas = DECIMAL(v.accidente_horas);
    } else {
      INT.forEach(k => { if (v[k] !== undefined) v[k] = ENTERO(v[k]); });
      if (v.edad !== undefined) v.edad = isNaN(parseInt(v.edad, 10)) ? 0 : parseInt(v.edad, 10);
      if (v.accidente_horas !== undefined) v.accidente_horas = DECIMAL(v.accidente_horas);
    }
  },
  bs_quejas: (v, nuevo) => {
    if (nuevo) {
      if (!v.fecha_recepcion) v.fecha_recepcion = celdaFecha(new Date());
      if (!v.resultado) v.resultado = 'En proceso';
      if (!v.seguimiento) v.seguimiento = 'No';
      ['cantidad_buzones', 'cantidad_quejas', 'seguimiento_dias', 'seguimiento_alerta'].forEach(k => { v[k] = ENTERO(v[k]); });
    } else {
      ['cantidad_buzones', 'cantidad_quejas', 'seguimiento_dias', 'seguimiento_alerta'].forEach(k => { if (v[k] !== undefined) v[k] = ENTERO(v[k]); });
    }
  }
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
function valoresDesde(datos, enc, usuario, ahora, nuevo, clave) {
  const v = {}, tipos = {}; ((TH.ESQ[clave] || {}).cols || []).forEach(c => { tipos[c[0]] = c[1]; });
  Object.keys(datos || {}).forEach(h => {
    if (enc.indexOf(h) < 0 || NO_EDITABLES.indexOf(h) >= 0) return;
    let x = comoHoja(datos[h]);
    if (tipos[h] === 'n' && typeof x === 'string' && /^-?\d+(\.\d+)?$/.test(x.trim())) x = Number(x.trim());   /* la columna es numérica: '3' → 3 (como parseInt del Apps Script) */
    if (tipos[h] && tipos[h][0] === 't' && typeof x === 'number' && typeof datos[h] === 'string') x = datos[h].trim();   /* columna de texto (dni, teléfono, número): se guarda tal cual, sin perder ceros a la izquierda */
    v[h] = x;
  });
  if (nuevo) { v.created_by = String(usuario || ''); v.created_at = celdaFecha(ahora); }
  v.updated_at = celdaFecha(ahora); if (enc.indexOf('updated_by') >= 0 && !nuevo) v.updated_by = String(usuario || '');
  return v;
}
async function crear(pool, clave, datos, usuario, opciones) {
  const o = opciones || {};
  return enTransaccion(pool, [clave, 'bs_auditoria'], async tx => {
    const cab = await cabecera(tx, clave), ahora = new Date(), enc = cab.enc;
    const id = await siguienteId(tx, clave, enc), v = valoresDesde(datos, enc, usuario, ahora, true, clave); v.id = id;
    if (NORMALIZAR[clave]) NORMALIZAR[clave](v, true);
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
    const v = valoresDesde(datos, enc, usuario, ahora, false, clave), celdas = reg.celdas.slice();
    if (NORMALIZAR[clave]) NORMALIZAR[clave](v, false);
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
  if ((S.exige || []).some(k => !String((datos || {})[k] || '').trim())) return { ok: false, success: false, status: 400, message: S.mensaje || ('Completa ' + S.exige.join(' y ')) };
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
/* importación por lotes (bs_importarAccidentes del navegador: modo upsert). Llave de coincidencia por tabla; si ya existe → actualiza, si no → crea.
   Devuelve { creados, actualizados, errores:[{fila, error}] } como espera la página. */
const LLAVE_IMPORTAR = { bs_accidentes_casos: ['dni', 'dia_accidente'], bs_subsidios: ['numero', 'fecha_inicio'] };
async function importar(pool, clave, filas, usuario) {
  const llave = LLAVE_IMPORTAR[clave]; if (!llave) return { ok: false, success: false, status: 400, message: 'La tabla ' + clave + ' no admite importación.' };
  if (!Array.isArray(filas) || !filas.length) return { ok: false, success: false, status: 400, message: 'No llegaron filas.' };
  if (filas.length > 500) return { ok: false, success: false, status: 400, message: 'Máximo 500 filas por lote.' };
  const ymdCelda = c => { if (esD(c)) { const d = new Date(new Date(c.$d).getTime() - 5 * 3600e3); return isNaN(d) ? '' : d.toISOString().slice(0, 10); } const s = String(c == null ? '' : c).trim(); const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return m[1] + '-' + p2(+m[2]) + '-' + p2(+m[3]); const m2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m2 ? m2[3] + '-' + p2(+m2[2]) + '-' + p2(+m2[1]) : s; };
  const firma = (c, enc) => llave.map(k => { const i = enc.indexOf(k); const x = i < 0 ? '' : c[i]; return /fecha|dia_/.test(k) ? ymdCelda(x) : texto(x).trim().toLowerCase(); }).join('|');
  return enTransaccion(pool, [clave, 'bs_auditoria'], async tx => {
    const cab = await cabecera(tx, clave), enc = cab.enc, E = TH.ESQ[clave];
    const todo = await tx.request().query(`SELECT * FROM ${E.tabla} ORDER BY fila`);
    const existentes = {}; todo.recordset.forEach(x => { const c = TH.aCeldas(clave, x, cab.ancho); if (!marcaAnulado(enc, c)) existentes[firma(c, enc)] = { id_fila: x.id_fila, celdas: c }; });
    let siguiente = await siguienteId(tx, clave, enc), fila = await siguienteFila(tx, clave);
    const out = { ok: true, success: true, creados: 0, actualizados: 0, errores: [], fuente: 'supabase' }, ahora = new Date();
    for (let n = 0; n < filas.length; n++) {
      try {
        const d = filas[n] || {};
        if (llave.some(k => !String(d[k] == null ? '' : d[k]).trim())) { out.errores.push({ fila: n + 1, error: 'falta ' + llave.filter(k => !String(d[k] == null ? '' : d[k]).trim()).join(', ') }); continue; }
        const vN = valoresDesde(d, enc, usuario, ahora, true, clave); if (NORMALIZAR[clave]) NORMALIZAR[clave](vN, true);
        const f = firma(enc.map(h => (vN[h] !== undefined ? vN[h] : '')), enc), ex = existentes[f];
        if (ex) {
          const vU = valoresDesde(d, enc, usuario, ahora, false, clave); if (NORMALIZAR[clave]) NORMALIZAR[clave](vU, false);
          const c = ex.celdas.slice(); while (c.length < enc.length) c.push('');
          enc.forEach((h, i) => { if (vU[h] !== undefined) c[i] = vU[h]; });
          await reemplazarCeldas(tx, clave, ex.id_fila, c); ex.celdas = c; out.actualizados++;
        } else {
          vN.id = siguiente++;
          const c = enc.map(h => (vN[h] !== undefined ? vN[h] : ''));
          await insertarCeldas(tx, clave, fila++, c); existentes[f] = { id_fila: -1, celdas: c }; out.creados++;
        }
      } catch (e) { out.errores.push({ fila: n + 1, error: String(e.message || e).slice(0, 200) }); }
    }
    if (out.creados || out.actualizados) { await tocarMarca(tx, clave); await auditar(tx, usuario, 'IMPORTAR', MODULO_DE_CLAVE[clave] || clave, 'lote', 'Importación: ' + out.creados + ' nuevos, ' + out.actualizados + ' actualizados' + (out.errores.length ? ', ' + out.errores.length + ' con error' : '')); }
    return out;
  });
}
/* cierre masivo de hallazgos (bs_cierreMasivoQuejas del Apps Script): los no cerrados con fecha_recepcion anterior al corte pasan a 'Cerrado',
   con sello en observaciones. simular=true solo cuenta. */
async function cerrarMasivo(pool, clave, p, usuario) {
  if (clave !== 'bs_quejas') return { ok: false, success: false, status: 400, message: 'El cierre masivo solo aplica a hallazgos.' };
  const mC = String(p.fecha_corte || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!mC) return { ok: false, success: false, status: 400, message: 'Indica una fecha de corte válida.' };
  const corte = mC[1] + '-' + mC[2] + '-' + mC[3], motivo = String(p.motivo || '').trim(), simular = !!p.simular;
  if (!simular && motivo.length < 5) return { ok: false, success: false, status: 400, message: 'Escribe un motivo (mínimo 5 caracteres); queda en el historial.' };
  const ymdCelda = c => { if (esD(c)) { const d = new Date(new Date(c.$d).getTime() - 5 * 3600e3); return isNaN(d) ? '' : d.toISOString().slice(0, 10); } const s = String(c == null ? '' : c).trim(); const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return m[1] + '-' + p2(+m[2]) + '-' + p2(+m[3]); const m2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m2 ? m2[3] + '-' + p2(+m2[2]) + '-' + p2(+m2[1]) : ''; };
  return enTransaccion(pool, simular ? [] : [clave, 'bs_auditoria'], async tx => {
    const cab = await cabecera(tx, clave), enc = cab.enc, E = TH.ESQ[clave];
    const iFec = enc.indexOf('fecha_recepcion'), iRes = enc.indexOf('resultado'), iObs = enc.indexOf('observaciones'), iUpd = enc.indexOf('updated_at'), iEmp = enc.indexOf('empresa');
    if (iFec < 0 || iRes < 0) return { ok: false, success: false, status: 400, message: 'Faltan columnas fecha_recepcion / resultado.' };
    const todo = await tx.request().query(`SELECT * FROM ${E.tabla} ORDER BY fila`);
    const hoy = new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10), sello = 'Cierre masivo ' + hoy + ' por ' + usuario + (motivo ? ': ' + motivo : '');
    const porEmp = {}; let n = 0;
    for (const x of todo.recordset) {
      const c = TH.aCeldas(clave, x, cab.ancho); while (c.length < enc.length) c.push('');
      if (marcaAnulado(enc, c)) continue;
      if (/cerrad|resuelt/i.test(texto(c[iRes]))) continue;
      const f = ymdCelda(c[iFec]); if (!f || f >= corte) continue;
      n++; const e = texto(c[iEmp]) || '—'; porEmp[e] = (porEmp[e] || 0) + 1;
      if (simular) continue;
      c[iRes] = 'Cerrado';
      if (iObs >= 0) { const o = texto(c[iObs]).trim(); c[iObs] = o ? o + ' | ' + sello : sello; }
      if (iUpd >= 0) c[iUpd] = celdaFecha(new Date());
      await reemplazarCeldas(tx, clave, x.id_fila, c);
    }
    if (!simular && n) { await tocarMarca(tx, clave); await auditar(tx, usuario, 'ACTUALIZAR', 'quejas', 'masivo', 'Cierre masivo de ' + n + ' hallazgos anteriores a ' + corte + ' · ' + motivo); }
    return { ok: true, success: true, simulado: simular, total: n, porEmpresa: porEmp, fecha_corte: corte, fuente: 'supabase',
      message: (simular ? 'Se cerrarían ' : 'Se cerraron ') + n + ' hallazgo(s) anteriores a ' + corte + '.' };
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

module.exports = { CLAVES_BS, MODULO_DE_CLAVE, SEGUIMIENTO, cerrarMasivo, importar, fuenteDe, fuentes, ponerFuente, crear, actualizar, seguimiento, anular, restaurar, registrarEvento, respaldar, auditar, cabecera };
