/* ═══════════════════════════════════════════════════════════════════════════
   _CAP_AZURE_PRIMERO_V1 (26-set-2026) — CAPACITACIONES se guardan PRIMERO en Azure
   ---------------------------------------------------------------------------
   Replica capGuardar y capDuplicar del Apps Script sobre dbo.Cap_Cabeceras y
   dbo.Cap_Asistentes. Cada celda se guarda como la guardaria Google Sheets
   (textos de fecha/hora pasan a fecha, numeros escritos pasan a numero), asi la
   hoja y la tabla quedan identicas. La operacion queda en dbo.CV_Ops y el Apps
   Script la copia a la hoja con el MISMO ID y la misma fecha de registro.
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
const { sql } = require('./db');
const TH = require('./tablas-hoja');
const CG = require('./cv-guardar');

const CAP_ROLES_ADMIN = ['administrador', 'administrador 01', 'administrador 02', 'coordinador', 'jefa_rl', 'jefe_rl'];
const esD = v => !!(v && typeof v === 'object' && typeof v.$d === 'string');
const T = v => esD(v) ? v.$s : String(v == null ? '' : v);
const p2 = n => (n < 10 ? '0' : '') + n;
function limaAhora() { const x = new Date(Date.now() - 5 * 3600e3); return x.getUTCFullYear() + '-' + p2(x.getUTCMonth() + 1) + '-' + p2(x.getUTCDate()) + ' ' + p2(x.getUTCHours()) + ':' + p2(x.getUTCMinutes()) + ':' + p2(x.getUTCSeconds()); }
const LMT = 18516e3;
const celdaFecha = d => ({ $d: d.toISOString(), $s: TH.textoGoogle(d) });

/* Lo que hace Google Sheets al escribir un valor con appendRow/setValues (zona Lima) */
function comoHoja(v) {
  if (v === null || v === undefined || v === '') return '';
  if (esD(v)) return v;
  if (typeof v === 'number' || typeof v === 'boolean') return v;
  if (v instanceof Date) return celdaFecha(v);
  const s = String(v), t = s.trim();
  let m;
  if ((m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) return celdaFecha(new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 5)));
  if ((m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/))) return celdaFecha(new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] + 5, +m[5], +(m[6] || 0))));
  if ((m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) {   /* _FUS_AZURE_V1: la hoja esta en es_MX: dia/mes/año pasa a fecha (si es una fecha valida) */
    const d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1], 5));
    if (d.getUTCDate() === +m[1] && d.getUTCMonth() === +m[2] - 1) return celdaFecha(d);
    return s;
  }
  if ((m = t.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)) && +m[1] < 24) return celdaFecha(new Date(Date.UTC(1899, 11, 30, +m[1], +m[2], +(m[3] || 0)) + LMT));
  if (/^-?\d+(\.\d+)?$/.test(t) && t.replace(/[-.]/g, '').length <= 15) return Number(t);
  return s;
}
function capFecha(v) {   /* = capFecha_ */
  if (esD(v)) { if (!v.$d) return ''; const x = new Date(new Date(v.$d).getTime() - (new Date(v.$d).getTime() < Date.UTC(1908, 6, 28, 5, 8, 36) ? LMT : 5 * 3600e3)); return x.getUTCFullYear() + '-' + p2(x.getUTCMonth() + 1) + '-' + p2(x.getUTCDate()); }
  return String(v == null ? '' : v).substring(0, 10);
}
function capCol(headers, nombre) { for (let i = 0; i < headers.length; i++) if (T(headers[i]).trim().toUpperCase() === String(nombre).trim().toUpperCase()) return i; return -1; }

async function encendido(pool) {
  const r = await pool.request().query("SELECT valor FROM dbo.CV_Estado WHERE clave = 'cap_azure_primero'");
  return r.recordset.length && r.recordset[0].valor === '1';
}

/* inserta filas (ya como celdas de hoja) al final de una tabla de la hoja */
async function agregarFilas(tx, clave, filasCeldas) {
  const E = TH.ESQ[clave];
  const mx = (await tx.request().query(`SELECT ISNULL(MAX(fila), 0) AS m FROM ${E.tabla} WITH (UPDLOCK, HOLDLOCK)`)).recordset[0].m;
  for (let i = 0; i < filasCeldas.length; i += 80) {
    const lote = filasCeldas.slice(i, i + 80), r = tx.request(), vals = [];
    lote.forEach((celdas, j) => {
      const f = TH.aFila(clave, celdas), ps = ['@f' + j];
      r.input('f' + j, sql.Int, mx + i + j + 1);
      E.cols.forEach((c, k) => { r.input('v' + j + '_' + k, c[1] === 'f' ? sql.DateTime2(3) : c[1] === 'n' ? sql.Float : sql.NVarChar(parseInt(c[1].slice(1), 10)), f.vals[k]); ps.push('@v' + j + '_' + k); });
      r.input('o' + j, sql.NVarChar(sql.MAX), f.otros); ps.push('@o' + j);
      vals.push('(' + ps.join(', ') + ')');
    });
    await r.query(`INSERT INTO ${E.tabla} (fila, ${E.cols.map(c => c[0]).join(', ')}, otros) VALUES ${vals.join(', ')}`);
  }
}
async function tocarMarcas(tx, claves) {
  for (const k of claves) await tx.request().input('k', sql.NVarChar(40), k).input('m', sql.NVarChar(40), String(Date.now()))
    .query('UPDATE dbo.TH_Estado SET marca = @m, filas = (SELECT COUNT(*) FROM ' + TH.ESQ[k].tabla + '), actualizado = SYSUTCDATETIME() WHERE clave = @k');
}

async function ejecutar(pool, accion, b, usuario, rol, prueba) {
  await CG.asegurarTablas(pool); await TH.asegurar(pool, 'cap_cabeceras'); await TH.asegurar(pool, 'cap_asistentes');
  const clave = String(b.client_id || '').replace(/[^\w-]/g, '').slice(0, 90);
  const claveOp = clave ? accion + ':' + clave : accion + ':sin-huella-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  if (clave && !prueba) {
    const p = await pool.request().input('k', sql.NVarChar(100), claveOp).query('SELECT respuesta FROM dbo.CV_Ops WHERE clave = @k');
    if (p.recordset.length && p.recordset[0].respuesta) return { status: 200, body: Object.assign(JSON.parse(p.recordset[0].respuesta), { duplicadoEvitado: true }) };
  }
  const fechaReg = (prueba && b._fechaRegPrueba) ? String(b._fechaRegPrueba) : limaAhora();
  let cab, filas, resp, cuerpo;
  if (accion === 'guardarCapacitacion') {
    const a = b.actividad, asis = b.asistentes || [];
    if (!a || !a.idCapacitacion) return { status: 400, body: { success: false, error: 'Faltan datos de la actividad' } };
    if (!asis.length) return { status: 400, body: { success: false, error: 'No hay asistentes para guardar' } };
    const H = asis.filter(x => /^m(asc)?$|^h$|masculino|hombre/i.test(x.sexo || '')).length;
    const M = asis.filter(x => /^f$|^muj?$|femenino|mujer/i.test(x.sexo || '')).length;
    cab = [a.idCapacitacion, fechaReg, a.empresa, a.tipo, a.tema, a.fuente || '', a.area, a.lugar, a.fecha, a.horaInicio, a.horaFin,
      a.totalHoras || '', a.frecuencia || '', a.capacitadorDni, a.capacitadorNombre, a.capacitadorCargo || '', asis.length, H, M,
      a.creadaPor || 'sistema', a.creadaPorNombre || ''];
    filas = asis.map((x, i) => [a.idCapacitacion, fechaReg, a.empresa, a.tipo, a.tema, a.fecha, a.horaInicio, a.horaFin, i + 1, x.dni,
      x.nombres || x.nombre || '', x.cargo || x.area || '', x.sexo || '', x.fundo || '', a.area, a.lugar, a.capacitadorNombre, a.creadaPor || 'sistema']);
    resp = { success: true, idCapacitacion: a.idCapacitacion, registrosGuardados: asis.length, mensaje: 'Capacitación guardada correctamente' };
    cuerpo = { actividad: Object.assign({}, a, { _fechaRegAzure: fechaReg }), asistentes: asis };
  } else if (accion === 'duplicarCapacitacion') {
    const id = String(b.idCapacitacion || '').trim(), titulo = String(b.tituloNuevo || '').trim(), u = String(usuario || '').toLowerCase().trim();
    if (!id) return { status: 400, body: { success: false, error: 'Falta indicar que capacitacion se va a reutilizar.' } };
    if (!titulo) return { status: 400, body: { success: false, error: 'Escribe el titulo del nuevo registro.' } };
    if (titulo.length < 4) return { status: 400, body: { success: false, error: 'El titulo es muy corto. Escribe algo que se entienda.' } };
    const Hd = await TH.leer(pool, 'cap_cabeceras'), Bd = await TH.leer(pool, 'cap_asistentes');
    if (!Hd || !Bd) return { status: 503, body: { success: false, error: 'Tablas de capacitaciones aun no cargadas' } };
    let cId = capCol(Hd.encabezado, 'ID_CAPACITACION'); if (cId < 0) cId = 0;
    const cTema = capCol(Hd.encabezado, 'TEMA'); let cFecha = capCol(Hd.encabezado, 'FECHA_CAPACITACION'); if (cFecha < 0) cFecha = capCol(Hd.encabezado, 'FECHA');
    const cTipo = capCol(Hd.encabezado, 'TIPO'), cCreada = capCol(Hd.encabezado, 'CREADA_POR');
    const original = Hd.filas.find(f => T(f[cId]).trim() === id);
    if (!original) return { status: 404, body: { success: false, error: 'No encuentro esa capacitacion. Actualiza la lista y vuelve a intentar.' } };
    const dueno = cCreada >= 0 ? T(original[cCreada]).toLowerCase().trim() : '';
    if (CAP_ROLES_ADMIN.indexOf(String(rol || '').toLowerCase().trim()) < 0 && dueno && dueno !== u)
      return { status: 403, body: { success: false, error: 'Esta capacitacion la registro ' + dueno + '. Solo esa persona o un administrador pueden reutilizar su nomina.' } };
    let bId = capCol(Bd.encabezado, 'ID_CAPACITACION'); if (bId < 0) bId = 0;
    const bTema = capCol(Bd.encabezado, 'TEMA'); let bFecha = capCol(Bd.encabezado, 'FECHA_CAPACITACION'); if (bFecha < 0) bFecha = capCol(Bd.encabezado, 'FECHA');
    const asis = Bd.filas.filter(f => T(f[bId]).trim() === id);
    if (!asis.length) return { status: 400, body: { success: false, error: 'Esa capacitacion no tiene asistentes registrados. No hay nomina que reutilizar.' } };
    const idNuevo = 'CAP-' + Date.now(), fechaNueva = capFecha(b.fecha) || capFecha(original[cFecha]);
    cab = original.slice(); cab[cId] = idNuevo; cab[1] = fechaReg;
    if (cTema >= 0) cab[cTema] = titulo; if (cFecha >= 0) cab[cFecha] = fechaNueva; if (cTipo >= 0 && b.tipo) cab[cTipo] = String(b.tipo);
    filas = asis.map(f => { const n = f.slice(); n[bId] = idNuevo; n[1] = fechaReg; if (bTema >= 0) n[bTema] = titulo; if (bFecha >= 0) n[bFecha] = fechaNueva; return n; });
    resp = { success: true, idCapacitacion: idNuevo, titulo, fecha: fechaNueva, asistentes: filas.length };
    cuerpo = { idCapacitacion: id, tituloNuevo: titulo, fecha: b.fecha, tipo: b.tipo, usuario: u, rol: rol, _idAzure: idNuevo, _fechaRegAzure: fechaReg };
  } else return { status: 404, body: { success: false, error: 'Accion desconocida' } };

  const tx = new sql.Transaction(pool);
  await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    await tx.request().query("EXEC sp_getapplock @Resource = 'cap_guardar', @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 20000;");
    await agregarFilas(tx, 'cap_cabeceras', [cab.map(comoHoja)]);
    await agregarFilas(tx, 'cap_asistentes', filas.map(f => f.map(comoHoja)));
    await tocarMarcas(tx, ['cap_cabeceras', 'cap_asistentes']);
    resp.fuente = 'azure';
    await tx.request().input('k', sql.NVarChar(100), claveOp).input('a', sql.NVarChar(30), accion).input('u', sql.NVarChar(100), usuario ? String(usuario) : null)
      .input('c', sql.NVarChar(sql.MAX), JSON.stringify(cuerpo)).input('r', sql.NVarChar(sql.MAX), JSON.stringify(resp))
      .query("INSERT INTO dbo.CV_Ops (clave, tipo, accion, nro, usuario, cuerpo, respuesta) VALUES (@k, 'cap', @a, NULL, @u, @c, @r)");
    if (prueba) { await tx.rollback(); resp.prueba = true; resp._celdas = { cab: cab.map(comoHoja), filas: filas.slice(0, 5).map(f => f.map(comoHoja)) }; } else await tx.commit();
  } catch (e) {
    try { await tx.rollback(); } catch (e2) {}
    if (clave && /UQ_CV_Ops_clave|duplicate key/i.test(e.message || '')) {
      const p = await pool.request().input('k', sql.NVarChar(100), claveOp).query('SELECT respuesta FROM dbo.CV_Ops WHERE clave = @k');
      if (p.recordset.length && p.recordset[0].respuesta) return { status: 200, body: Object.assign(JSON.parse(p.recordset[0].respuesta), { duplicadoEvitado: true }) };
    }
    throw e;
  }
  return { status: 200, body: resp };
}
module.exports = { ejecutar, encendido, comoHoja, capFecha, agregarFilas, tocarMarcas };   /* _HORAS_AZURE_PRIMERO_V1: agregarFilas y tocarMarcas tambien los usa horas-guardar */
