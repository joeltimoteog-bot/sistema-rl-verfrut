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
/* '1,250.50' → 1250.5 · '12,5' → 12.5 · '1,250' → 1250 (formato peruano: punto decimal, coma de miles; una coma con 1-2 decimales se toma como decimal) */
const DECIMAL = v => {
  if (typeof v === 'number') return isNaN(v) ? 0 : v;
  let t = String(v == null ? '' : v).replace(/[^\d,.-]/g, '');
  if (t.indexOf(',') >= 0 && t.indexOf('.') >= 0) t = t.replace(/,/g, '');
  else if (t.indexOf(',') >= 0) { const d = t.split(',').pop(); t = d.length === 3 ? t.replace(/,/g, '') : t.replace(',', '.'); }
  const n = parseFloat(t); return isNaN(n) ? 0 : n;
};
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
  bs_subsidios: (v, nuevo) => {
    const DEC = ['dias', 'calculo_por_dia', 'pago_empresa', 'reembolso_por_mes', 'recuperado_essalud', 'monto_total', 'diferencias'];
    if (nuevo) {
      v.anio = ENTERO(v.anio) || new Date(Date.now() - 5 * 3600e3).getUTCFullYear();
      if (!v.estado_general) v.estado_general = 'En proceso';
      DEC.forEach(k => { v[k] = DECIMAL(v[k]); });
    } else {
      if (v.anio !== undefined) v.anio = ENTERO(v.anio);
      DEC.forEach(k => { if (v[k] !== undefined) v[k] = DECIMAL(v[k]); });
    }
  },
  bs_hostigamiento: (v, nuevo) => { if (nuevo) { if (!v.fecha_denuncia) v.fecha_denuncia = celdaFecha(new Date()); if (!v.status) v.status = 'En investigación'; } v.sede = 'PIURA'; },
  bs_hostigamiento_olmos: (v, nuevo) => { if (nuevo) { if (!v.fecha_denuncia) v.fecha_denuncia = celdaFecha(new Date()); if (!v.status) v.status = 'En investigación'; } v.sede = 'OLMOS'; },
  bs_rendiciones: (v, nuevo, usuario) => {
    const DEC = ['monto_reclutamiento', 'monto_relaciones_laborales', 'monto_capacitaciones', 'monto_bienestar', 'monto_total'];
    if (nuevo) {
      if (!v.fecha) v.fecha = celdaFecha(new Date());
      const f = ymdDe(v.fecha); v.anio = ENTERO(v.anio) || (f ? +f.slice(0, 4) : +hoyLima().slice(0, 4));
      v.semana = ENTERO(v.semana) || ''; if (!v.estado) v.estado = 'NO DEPOSITADO';
      DEC.forEach(k => { v[k] = DECIMAL(v[k]); });
    } else { if (v.anio !== undefined) v.anio = ENTERO(v.anio); if (v.semana !== undefined) v.semana = ENTERO(v.semana) || ''; DEC.forEach(k => { if (v[k] !== undefined) v[k] = DECIMAL(v[k]); }); }
  },
  bs_sugerencias: (v, nuevo, usuario) => {
    if (nuevo) { v.fecha = celdaFecha(new Date()); v.usuario = String(usuario || ''); if (!v.prioridad) v.prioridad = 'Media'; v.estado = 'Recibida'; v.respuesta_admin = v.respuesta_admin || ''; v.fecha_finalizado = ''; }
    else if (v.estado === 'Finalizada') v.fecha_finalizado = celdaFecha(new Date());
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
  bs_buzones: ['id', 'empresa', 'sector', 'numero', 'ubicacion', 'activo', 'created_at'],
  bs_documentos: ['id', 'modulo', 'caso_id', 'nombre', 'url', 'mime', 'subido_por', 'fecha'],
  /* hostigamiento OLMOS: la hoja puede no existir todavía; mismo encabezado que BS_HOSTIG_HEADERS del Apps Script */
  bs_hostigamiento: ['id', 'fecha_denuncia', 'denunciante_dni', 'denunciante_nombre', 'denunciante_puesto', 'medida_proteccion', 'denunciado_dni', 'denunciado_nombre', 'denunciado_puesto', 'sede', 'fundo', 'decision', 'status', 'observaciones', 'empresa', 'created_by', 'created_at', 'updated_at'],
  bs_hostigamiento_olmos: ['id', 'fecha_denuncia', 'denunciante_dni', 'denunciante_nombre', 'denunciante_puesto', 'medida_proteccion', 'denunciado_dni', 'denunciado_nombre', 'denunciado_puesto', 'sede', 'fundo', 'decision', 'status', 'observaciones', 'empresa', 'created_by', 'created_at', 'updated_at']
};
const NO_EDITABLES = ['id', 'created_by', 'created_at', 'anulado'];
/* ymd Lima de una celda (fecha {$d} o texto) */
const ymdDe = c => { if (esD(c)) { const d = new Date(new Date(c.$d).getTime() - 5 * 3600e3); return isNaN(d) ? '' : d.toISOString().slice(0, 10); } const t = String(c == null ? '' : c).trim(); const m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2); const m2 = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m2 ? m2[3] + '-' + ('0' + m2[2]).slice(-2) + '-' + ('0' + m2[1]).slice(-2) : ''; };
const diasEntre = (a, b) => Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 86400e3) + 1;
const hoyLima = () => new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10);
/* reglas de Descansos médicos (= bs-descansos.js del Apps Script) */
const BS_DM = { UMBRAL_DIAS: 20, UMBRAL_AMBAR: 15, UMBRAL_INVALIDEZ: 150, PLAZO_CANJE_DIAS: 30, TIPOS: ['Enfermedad común', 'Accidente de trabajo', 'Accidente común', 'Maternidad'], ORIGENES: ['Particular', 'EsSalud'] };
/* COMPLETAR[clave](obj, nuevo, usuario): recibe la fila COMPLETA (encabezado → valor) ya fusionada; puede corregir campos y devolver un mensaje de error */
const COMPLETAR = {
  bs_descansos: (o, nuevo, usuario) => {
    o.dni = String(o.dni == null ? '' : (esD(o.dni) ? o.dni.$s : o.dni)).trim();
    if (!/^\d{8}$/.test(o.dni)) return 'DNI inválido (8 dígitos).';
    if (!texto(o.nombre).trim()) return 'Falta el nombre del trabajador.';
    if (!texto(o.empresa).trim()) return 'Falta la empresa.';
    const ini = ymdDe(o.fecha_inicio), fin = ymdDe(o.fecha_fin);
    if (!ini || !fin) return 'Fechas de inicio y fin obligatorias.';
    if (fin < ini) return 'La fecha fin no puede ser anterior al inicio.';
    const dias = diasEntre(ini, fin); if (dias > 366) return 'Un descanso no puede superar 366 días; divídelo.';
    if (texto(o.tipo) && BS_DM.TIPOS.indexOf(texto(o.tipo)) < 0) return 'Tipo no válido.';
    o.nombre = texto(o.nombre).toUpperCase(); o.cie10 = texto(o.cie10).toUpperCase(); o.dias = dias;
    if (nuevo) {
      if (!texto(o.tipo)) o.tipo = BS_DM.TIPOS[0];
      if (!texto(o.origen)) o.origen = BS_DM.ORIGENES[0];
      if (!texto(o.citt_estado)) o.citt_estado = texto(o.origen) === 'EsSalud' ? 'Canjeado' : 'Pendiente de canje';
      o.id_subsidio = ''; o.anulado = '';
    }
    if (nuevo || !o.__estadoDado) o.estado = fin >= hoyLima() ? 'Activo' : 'Concluido';
    if (o.updated_by !== undefined) o.updated_by = String(usuario || '');
    return null;
  }
};
const filaObjeto = (enc, celdas) => { const o = {}; enc.forEach((h, i) => { o[h] = celdas[i]; }); return o; };
const aplicarCompletar = (clave, enc, celdas, nuevo, usuario, datos) => {
  if (!COMPLETAR[clave]) return null;
  const o = filaObjeto(enc, celdas); if (datos && datos.estado !== undefined) o.__estadoDado = true;
  const err = COMPLETAR[clave](o, nuevo, usuario); delete o.__estadoDado;
  if (err) return err;
  enc.forEach((h, i) => { if (o[h] !== undefined) celdas[i] = o[h]; });
  return null;
};
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
  /* columna id de texto (descansos): el Apps Script escribe el id numérico, así que la celda cae en 'otros'; se lee la celda real */
  const r = await tx.request().query(`SELECT * FROM ${E.tabla}`);
  let m = 0; r.recordset.forEach(x => { const n = parseInt(texto(TH.aCeldas(clave, x, enc.length)[iId]), 10); if (!isNaN(n) && n > m) m = n; });
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
    if (NORMALIZAR[clave]) NORMALIZAR[clave](v, true, usuario);
    if (o.completar) o.completar(v, enc);
    const celdas = enc.map(h => (v[h] !== undefined ? v[h] : ''));
    const errC = aplicarCompletar(clave, enc, celdas, true, usuario, datos); if (errC) return { ok: false, success: false, status: 400, message: errC };
    await insertarCeldas(tx, clave, await siguienteFila(tx, clave), celdas);
    await tocarMarca(tx, clave);
    await auditar(tx, usuario, 'CREAR', o.modulo || MODULO_DE_CLAVE[clave] || clave, id, o.detalle || '');
    const ob = filaObjeto(enc, celdas);
    return { ok: true, success: true, id, fuente: 'supabase', dias: ob.dias, estado: ob.estado };
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
    if (NORMALIZAR[clave]) NORMALIZAR[clave](v, false, usuario);
    while (celdas.length < enc.length) celdas.push('');
    let cambios = 0; enc.forEach((h, i) => { if (v[h] !== undefined) { if (h !== 'updated_at' && h !== 'updated_by' && texto(celdas[i]) !== texto(v[h])) cambios++; celdas[i] = v[h]; } });
    const errA = aplicarCompletar(clave, enc, celdas, false, usuario, datos); if (errA) return { ok: false, success: false, status: 400, message: errA };
    await reemplazarCeldas(tx, clave, reg.id_fila, celdas);
    await tocarMarca(tx, clave);
    await auditar(tx, usuario, 'ACTUALIZAR', MODULO_DE_CLAVE[clave] || clave, id, o.detalle || ('campos: ' + Object.keys(v).filter(k => k !== 'updated_at' && k !== 'updated_by').join(', ')));
    const obA = filaObjeto(enc, celdas);
    return { ok: true, success: true, id, cambios, fuente: 'supabase', dias: obA.dias, estado: obA.estado };
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
const LLAVE_IMPORTAR = {
  bs_accidentes_casos: { campos: ['dni', 'dia_accidente'], firma: g => { const d = texto(g('dni')).trim(), f = g('dia_accidente'); return d && f ? 'K:' + d + '|' + f : null; } },
  /* igual que bs_importarSubsidios del Apps Script: expediente manda; si no, numero|anio|tipo|periodo */
  bs_subsidios: { campos: [], firma: g => { const e = texto(g('expediente')).trim().toUpperCase(); if (e) return 'EXP:' + e; const k = [texto(g('numero')).trim(), texto(g('anio')).trim(), texto(g('tipo')).trim().toUpperCase(), texto(g('periodo')).trim().toUpperCase()].join('|'); return k === '|||' ? null : 'K:' + k; } }
};
async function importar(pool, clave, filas, usuario, modo) {
  const L = LLAVE_IMPORTAR[clave]; if (!L) return { ok: false, success: false, status: 400, message: 'La tabla ' + clave + ' no admite importación.' };
  if (!Array.isArray(filas) || !filas.length) return { ok: false, success: false, status: 400, message: 'No llegaron filas para importar.' };
  if (filas.length > 500) return { ok: false, success: false, status: 400, message: 'Máximo 500 filas por lote.' };
  const soloAgregar = String(modo || '') === 'solo_agregar';
  const ymdCelda = c => { if (esD(c)) { const d = new Date(new Date(c.$d).getTime() - 5 * 3600e3); return isNaN(d) ? '' : d.toISOString().slice(0, 10); } const s = String(c == null ? '' : c).trim(); const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return m[1] + '-' + p2(+m[2]) + '-' + p2(+m[3]); const m2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m2 ? m2[3] + '-' + p2(+m2[2]) + '-' + p2(+m2[1]) : s; };
  const firmaDe = (c, enc) => L.firma(k => { const i = enc.indexOf(k); if (i < 0) return ''; const x = c[i]; return /fecha|dia_|inicio|termino/.test(k) && (esD(x) || /^\d{4}-\d{2}-\d{2}/.test(texto(x))) ? ymdCelda(x) : (esD(x) ? ymdCelda(x) : x); });
  const vacio = x => x === '' || x === null || x === undefined;
  return enTransaccion(pool, [clave, 'bs_auditoria'], async tx => {
    const cab = await cabecera(tx, clave), enc = cab.enc, E = TH.ESQ[clave];
    const todo = await tx.request().query(`SELECT * FROM ${E.tabla} ORDER BY fila`);
    const existentes = {}; todo.recordset.forEach(x => { const c = TH.aCeldas(clave, x, cab.ancho); if (marcaAnulado(enc, c)) return; const f = firmaDe(c, enc); if (f && existentes[f] === undefined) existentes[f] = { id_fila: x.id_fila, celdas: c }; });
    let siguiente = await siguienteId(tx, clave, enc), fila = await siguienteFila(tx, clave);
    const out = { ok: true, success: true, creados: 0, actualizados: 0, errores: [], fuente: 'supabase' }, ahora = new Date();
    for (let n = 0; n < filas.length; n++) {
      try {
        const d = filas[n] || {};
        const faltan = L.campos.filter(k => vacio(d[k]) || !String(d[k]).trim());
        if (faltan.length) { out.errores.push({ fila: n + 1, error: 'falta ' + faltan.join(', ') }); continue; }
        const vN = valoresDesde(d, enc, usuario, ahora, true, clave); if (NORMALIZAR[clave]) NORMALIZAR[clave](vN, true);
        const f = firmaDe(enc.map(h => (vN[h] !== undefined ? vN[h] : '')), enc), ex = f && !soloAgregar ? existentes[f] : null;
        if (ex && ex.id_fila > 0) {
          /* actualizar: solo los campos que traen valor (como el Apps Script) */
          const dLleno = {}; Object.keys(d).forEach(k => { if (!vacio(d[k])) dLleno[k] = d[k]; });
          const vU = valoresDesde(dLleno, enc, usuario, ahora, false, clave); if (NORMALIZAR[clave]) NORMALIZAR[clave](vU, false);
          const c = ex.celdas.slice(); while (c.length < enc.length) c.push('');
          enc.forEach((h, i) => { if (vU[h] !== undefined) c[i] = vU[h]; });
          await reemplazarCeldas(tx, clave, ex.id_fila, c); ex.celdas = c; out.actualizados++;
        } else if (ex) { out.errores.push({ fila: n + 1, error: 'repetida dentro del mismo lote' }); }
        else {
          vN.id = siguiente++;
          const c = enc.map(h => (vN[h] !== undefined ? vN[h] : ''));
          await insertarCeldas(tx, clave, fila++, c); if (f) existentes[f] = { id_fila: -1, celdas: c }; out.creados++;
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
/* Descansos → expediente de subsidio (= bs_generarSubsidioDesdeDM del Apps Script), todo en una transacción */
const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SETIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
async function generarSubsidioDM(pool, id, usuario) {
  return enTransaccion(pool, ['bs_descansos', 'bs_subsidios', 'bs_auditoria'], async tx => {
    const cab = await cabecera(tx, 'bs_descansos'), enc = cab.enc;
    const reg = await buscarPorId(tx, 'bs_descansos', id, cab.ancho);
    if (!reg) return { ok: false, success: false, status: 404, message: 'Descanso #' + id + ' no encontrado.' };
    const c = reg.celdas.slice(); while (c.length < enc.length) c.push('');
    const dm = filaObjeto(enc, c); Object.keys(dm).forEach(k => { if (esD(dm[k])) dm[k] = ymdDe(dm[k]); });
    if (texto(dm.id_subsidio).trim()) return { ok: false, success: false, status: 409, message: 'Este descanso ya tiene el subsidio #' + texto(dm.id_subsidio) + '.' };
    if (dm.citt_estado !== 'Canjeado' && dm.tipo !== 'Maternidad') return { ok: false, success: false, status: 409, message: 'Primero registra el CITT como "Canjeado": EsSalud solo subsidia con CITT.' };
    const ini = ymdDe(dm.fecha_inicio), fin = ymdDe(dm.fecha_fin), anio = parseInt(ini.slice(0, 4), 10) || +hoyLima().slice(0, 4);
    let diasSub = Number(dm.dias) || 0;
    if (dm.tipo !== 'Maternidad') {
      const todo = await tx.request().query(`SELECT * FROM ${TH.ESQ.bs_descansos.tabla} ORDER BY fila`);
      let previos = 0;
      todo.recordset.forEach(x => { const cc = TH.aCeldas('bs_descansos', x, cab.ancho); while (cc.length < enc.length) cc.push(''); const o = filaObjeto(enc, cc); if (marcaAnulado(enc, cc)) return;
        if (String(o.dni).trim() === String(dm.dni).trim() && (parseInt(texto(o.id), 10) || 0) < (parseInt(texto(dm.id), 10) || 0) && texto(o.tipo) !== 'Maternidad' && ymdDe(o.fecha_inicio).slice(0, 4) == anio) previos += Number(o.dias) || 0; });
      diasSub = Math.max(0, Math.min(Number(dm.dias) || 0, previos + (Number(dm.dias) || 0) - BS_DM.UMBRAL_DIAS));
      if (diasSub <= 0) return { ok: false, success: false, status: 409, message: 'Aún no supera los ' + BS_DM.UMBRAL_DIAS + ' días acumulados del año (' + (previos + (Number(dm.dias) || 0)) + '): no hay días subsidiables.' };
    }
    const partes = texto(dm.nombre).trim().split(/\s+/), nombres = partes.slice(2).join(' ') || partes.join(' ');
    const finD = new Date(fin + 'T05:00:00Z'), iniSub = dm.tipo === 'Maternidad' ? new Date(ini + 'T05:00:00Z') : new Date(finD.getTime() - (diasSub - 1) * 86400e3);
    const datosSub = { anio, mes: MESES[iniSub.getUTCMonth()], tipo: dm.tipo === 'Maternidad' ? 'MATERNIDAD' : 'INCAPACIDAD TEMPORAL', numero: String(dm.dni), apellido_paterno: partes[0] || '', apellido_materno: partes[1] || '', nombres,
      descripcion: (dm.tipo === 'Maternidad' ? 'Maternidad' : 'Incapacidad temporal') + ' · ' + texto(dm.diagnostico) + (texto(dm.cie10) ? ' (' + texto(dm.cie10) + ')' : ''),
      estado: 'Pendiente', dias: diasSub, inicio: iniSub.toISOString().slice(0, 10), termino: fin, expediente: texto(dm.citt_numero), observaciones: 'Generado desde Descanso Médico #' + texto(dm.id), estado_general: 'En proceso', empresa: texto(dm.empresa) };
    /* subsidio dentro de la misma transacción */
    const cabS = await cabecera(tx, 'bs_subsidios'), ahora = new Date(), encS = cabS.enc;
    const idS = await siguienteId(tx, 'bs_subsidios', encS), vS = valoresDesde(datosSub, encS, usuario, ahora, true, 'bs_subsidios'); vS.id = idS; NORMALIZAR.bs_subsidios(vS, true);
    await insertarCeldas(tx, 'bs_subsidios', await siguienteFila(tx, 'bs_subsidios'), encS.map(h => (vS[h] !== undefined ? vS[h] : '')));
    await tocarMarca(tx, 'bs_subsidios');
    /* el descanso apunta al subsidio */
    const iSub = enc.indexOf('id_subsidio'), iUb = enc.indexOf('updated_by'), iUa = enc.indexOf('updated_at');
    if (iSub >= 0) c[iSub] = idS; if (iUb >= 0) c[iUb] = String(usuario || ''); if (iUa >= 0) c[iUa] = celdaFecha(ahora);
    await reemplazarCeldas(tx, 'bs_descansos', reg.id_fila, c);
    await tocarMarca(tx, 'bs_descansos');
    await auditar(tx, usuario, 'CREAR', 'subsidios', idS, 'Generado desde DM #' + texto(dm.id) + ' · ' + diasSub + ' días');
    return { ok: true, success: true, id_subsidio: idS, dias: diasSub, fuente: 'supabase', message: 'Expediente de subsidio #' + idS + ' creado con ' + diasSub + ' día(s).' };
  });
}
/* ---- ADJUNTOS (evidencias): bucket privado 'bienestar', fila en BS_Documentos (encabezado de la hoja: id, modulo, caso_id, nombre, url, mime, subido_por, fecha).
   url = 'storage:<ruta>' para los nuevos; los históricos conservan su enlace de Drive y se abren por Google (bs_verDocumento). ---- */
const DOC_BUCKET = 'bienestar', DOC_MAX = 6 * 1024 * 1024;
/* el navegador manda el módulo abreviado (MOD_KEY de bs-mejoras.js: 'queja', 'accidente', 'subsidio', 'rendici', 'hostigamiento'); se lleva al nombre del permiso */
const docModulo = m => { const x = String(m || '').toLowerCase().trim(); if (!x) return '';
  if (/^(queja|hallazgo)/.test(x)) return 'quejas'; if (/^accidente/.test(x)) return 'accidentes'; if (/^subsidio/.test(x)) return 'subsidios'; if (/^rendici/.test(x)) return 'rendiciones';
  if (/^hostig/.test(x)) return 'hostigamiento'; if (/^descanso/.test(x)) return 'descansos'; if (/^sugerencia/.test(x)) return 'sugerencias'; return x; };
async function docAsegurarBucket(s) {
  const r = await fetch(s.url + '/storage/v1/bucket/' + DOC_BUCKET, { headers: s.h });
  if (r.status === 404 || r.status === 400) { const c = await fetch(s.url + '/storage/v1/bucket', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, s.h), body: JSON.stringify({ id: DOC_BUCKET, name: DOC_BUCKET, public: false, file_size_limit: DOC_MAX }) }); if (!c.ok && c.status !== 409) throw new Error('Storage bucket HTTP ' + c.status); }
}
async function docFilas(tx, cab) {
  const todo = await tx.request().query(`SELECT * FROM ${TH.ESQ.bs_documentos.tabla} ORDER BY fila`);
  return todo.recordset.map(x => { const c = TH.aCeldas('bs_documentos', x, cab.ancho); while (c.length < cab.enc.length) c.push(''); const o = filaObjeto(cab.enc, c); o.__id_fila = x.id_fila; return o; });
}
const fechaTexto = c => { if (esD(c)) { const d = new Date(new Date(c.$d).getTime() - 5 * 3600e3); return isNaN(d) ? '' : p2(d.getUTCDate()) + '/' + p2(d.getUTCMonth() + 1) + '/' + d.getUTCFullYear() + ' ' + p2(d.getUTCHours()) + ':' + p2(d.getUTCMinutes()); } return texto(c); };
async function docListar(pool, modulo, casoId) {
  const tx = new sql.Transaction(pool); await tx.begin();
  try {
    const cab = await cabecera(tx, 'bs_documentos'), mod = String(modulo || '').toUpperCase(), caso = String(casoId);
    const items = (await docFilas(tx, cab)).filter(o => String(o.modulo).toUpperCase() === mod && String(o.caso_id) === caso && !marcaAnulado(cab.enc, cab.enc.map(h => o[h])))
      .map(o => ({ id: o.id, modulo: o.modulo, caso_id: o.caso_id, nombre: texto(o.nombre), url: texto(o.url), mime: texto(o.mime), subido_por: texto(o.subido_por), fecha: fechaTexto(o.fecha), en_storage: /^storage:/.test(texto(o.url)) }));
    await tx.commit(); return { ok: true, success: true, items, fuente: 'supabase' };
  } catch (e) { try { await tx.rollback(); } catch (e2) {} throw e; }
}
async function docSubir(pool, d, usuario) {
  if (!d || !d.modulo || !d.caso_id || !d.base64 || !d.nombre) return { ok: false, success: false, status: 400, message: 'Faltan datos (modulo, caso_id, nombre, base64).' };
  const mime = String(d.mime || 'application/octet-stream');
  if (!/^image\/|^application\/pdf$/.test(mime)) return { ok: false, success: false, status: 400, message: 'Solo se permiten imágenes o PDF.' };
  const bytes = Buffer.from(String(d.base64), 'base64');
  if (!bytes.length) return { ok: false, success: false, status: 400, message: 'Archivo vacío.' };
  if (bytes.length > DOC_MAX) return { ok: false, success: false, status: 400, message: 'El archivo supera el máximo de 6 MB.' };
  const s = storage(); await docAsegurarBucket(s);
  const nombre = String(d.nombre).replace(/[\\/:*?"<>|]/g, '_').slice(0, 180), mod = String(d.modulo).toUpperCase().replace(/[^A-Z0-9_]/g, '_');
  const ruta = mod + '/CASO_' + String(d.caso_id).replace(/[^A-Za-z0-9_-]/g, '_') + '/' + new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14) + '-' + nombre;
  const up = await fetch(s.url + '/storage/v1/object/' + DOC_BUCKET + '/' + ruta.split('/').map(encodeURIComponent).join('/'), { method: 'POST', headers: Object.assign({ 'Content-Type': mime, 'x-upsert': 'false' }, s.h), body: bytes });
  if (!up.ok) return { ok: false, success: false, status: 502, message: 'Storage HTTP ' + up.status + ': ' + (await up.text()).slice(0, 200) };
  const r = await crear(pool, 'bs_documentos', { modulo: mod, caso_id: d.caso_id, nombre, url: 'storage:' + ruta, mime, subido_por: String(d.subido_por || usuario || ''), fecha: celdaFecha(new Date()) }, usuario, { modulo: docModulo(d.modulo) || 'bs_documentos', detalle: 'evidencia ' + nombre + ' del caso ' + d.caso_id + ' (' + Math.round(bytes.length / 1024) + ' KB)' });
  if (!r.ok) return r;
  return { ok: true, success: true, id: r.id, nombre, url: 'storage:' + ruta, fuente: 'supabase' };
}
async function docVer(pool, id, permisos) {
  const tx = new sql.Transaction(pool); await tx.begin();
  let doc = null;
  try { const cab = await cabecera(tx, 'bs_documentos'); doc = (await docFilas(tx, cab)).find(o => mismoId(o.id, id)) || null; await tx.commit(); }
  catch (e) { try { await tx.rollback(); } catch (e2) {} throw e; }
  if (!doc) return { ok: false, success: false, status: 404, message: 'Documento no encontrado.' };
  const mod = docModulo(doc.modulo);
  if (mod && !permisos.esAdmin && permisos.permisos[mod] !== true) return { ok: false, success: false, status: 403, message: 'No tienes permiso para ver documentos de ' + mod + '.' };
  const url = texto(doc.url);
  if (!/^storage:/.test(url)) return { ok: true, success: true, drive: true, nombre: texto(doc.nombre), mime: texto(doc.mime) };   /* histórico en Drive: lo sirve Google */
  const s = storage(), ruta = url.slice(8);
  const r = await fetch(s.url + '/storage/v1/object/sign/' + DOC_BUCKET + '/' + ruta.split('/').map(encodeURIComponent).join('/'), { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, s.h), body: JSON.stringify({ expiresIn: 300 }) });
  if (!r.ok) return { ok: false, success: false, status: 502, message: 'Storage sign HTTP ' + r.status };
  const j = await r.json();
  return { ok: true, success: true, nombre: texto(doc.nombre), mime: texto(doc.mime), url: s.url + '/storage/v1' + j.signedURL, expira_seg: 300 };
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

module.exports = { CLAVES_BS, MODULO_DE_CLAVE, SEGUIMIENTO, BS_DM, cerrarMasivo, importar, generarSubsidioDM, docListar, docSubir, docVer, docModulo, fuenteDe, fuentes, ponerFuente, crear, actualizar, seguimiento, anular, restaurar, registrarEvento, respaldar, auditar, cabecera };
