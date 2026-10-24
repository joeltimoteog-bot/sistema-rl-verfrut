/* ═══════════════════════════════════════════════════════════════════════════
   _SUP_AZURE_V1 (24-oct-2026) — SUPERVISORES y MOTIVOS DE CASOS se guardan PRIMERO en Azure
   ---------------------------------------------------------------------------
   Replica las versiones vigentes del Apps Script sobre las tablas reales:
     saveSupervisor   dbo.Supervisores  (= hoja BD_Supervisores, 12 cols A..L)
                      se identifica por DNI (dni_original si se corrige); nunca borra;
                      d.lista = [...] guarda varios de una vez. Solo jtimoteo + rol administrador.
     addMotivoCaso    dbo.Casos_Motivos (= hoja Motivos_Casos, 3 cols)
                      si ya existe (sin distinguir mayusculas) responde yaExistia.
     getSupervisores / getMotivosCasos   la misma respuesta que da Google, desde la tabla.
   La operacion queda en dbo.CV_Ops (tipo 'sup'); el Apps Script la copia a la hoja y
   refresca la copia JSON (mod/sup y mod/casosaux) que usan las pantallas de siempre.
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
const { sql } = require('./db');
const TH = require('./tablas-hoja');
const CG = require('./cv-guardar');
const CAP = require('./cap-guardar');

const K_SUP = 'sup_registro', K_MOT = 'casos_motivos';
const ACCIONES = ['saveSupervisor', 'addMotivoCaso'];
const LECTURAS = ['getSupervisores', 'getMotivosCasos'];
const SUP_ADMIN_USUARIOS = ['jtimoteo'];   /* = SUP_ADMIN_USUARIOS del Apps Script */
const ANCHO_SUP = 12, ANCHO_MOT = 3;
const esD = v => !!(v && typeof v === 'object' && typeof v.$d === 'string');
const S = v => esD(v) ? v.$s : String(v == null ? '' : v);
const p2 = n => (n < 10 ? '0' : '') + n;
const ymdLima = ms => { const x = new Date(ms - 5 * 3600e3); return x.getUTCFullYear() + '-' + p2(x.getUTCMonth() + 1) + '-' + p2(x.getUTCDate()); };

async function encendido(pool) {
  const r = await pool.request().query("SELECT valor FROM dbo.CV_Estado WHERE clave = 'sup_azure_primero'");
  return r.recordset.length && r.recordset[0].valor === '1';
}

async function actualizarFila(tx, clave, i, celdas) {
  const E = TH.ESQ[clave], f = TH.aFila(clave, celdas), r = tx.request();
  r.input('fila', sql.Int, i + 1);
  const sets = E.cols.map((c, k) => { r.input('v' + k, c[1] === 'f' ? sql.DateTime2(3) : c[1] === 'n' ? sql.Float : sql.NVarChar(parseInt(c[1].slice(1), 10)), f.vals[k]); return c[0] + ' = @v' + k; });
  r.input('o', sql.NVarChar(sql.MAX), f.otros);
  await r.query(`UPDATE ${E.tabla} SET ${sets.join(', ')}, otros = @o, actualizado = SYSUTCDATETIME() WHERE fila = @fila`);
}

async function ejecutar(pool, accion, b, usuario, prueba, ahoraMs, rol) {
  if (ACCIONES.indexOf(accion) < 0) return { status: 404, body: { success: false, error: 'Accion desconocida' } };
  b = b || {};
  const u = String(usuario || '').trim().toLowerCase();
  if (accion === 'saveSupervisor' && (SUP_ADMIN_USUARIOS.indexOf(u) < 0 || String(rol || b.rol || '').trim().toLowerCase() !== 'administrador'))
    return { status: 200, body: { success: false, error: 'Solo el administrador del sistema puede modificar la lista de supervisores.' } };
  if (accion === 'addMotivoCaso') {
    const motivo = String(b.motivo || '').trim();
    if (!motivo) return { status: 200, body: { success: false, error: 'Motivo vacío' } };
    if (motivo.length > 80) return { status: 200, body: { success: false, error: 'Motivo demasiado largo' } };
  }
  const clave = accion === 'saveSupervisor' ? K_SUP : K_MOT, ancho = accion === 'saveSupervisor' ? ANCHO_SUP : ANCHO_MOT;
  await CG.asegurarTablas(pool); await TH.asegurar(pool, clave);
  const huella = String(b.client_id || '').replace(/[^\w-]/g, '').slice(0, 90);
  const claveOp = huella ? accion + ':' + huella : accion + ':sin-huella-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  if (huella && !prueba) {
    const p = await pool.request().input('k', sql.NVarChar(100), claveOp).query('SELECT respuesta FROM dbo.CV_Ops WHERE clave = @k');
    if (p.recordset.length && p.recordset[0].respuesta) return { status: 200, body: Object.assign(JSON.parse(p.recordset[0].respuesta), { duplicadoEvitado: true }) };
  }
  const ms = prueba && ahoraMs ? +ahoraMs : Date.now(), ahora = new Date(ms);
  const tx = new sql.Transaction(pool);
  await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    await tx.request().query("EXEC sp_getapplock @Resource = 'sup_guardar', @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 20000;");
    const T = await TH.leer(pool, clave);
    if (!T) { await tx.rollback(); return { status: 503, body: { success: false, error: 'Tabla ' + clave + ' aun no cargada' } }; }
    const filas = T.filas.map(f => { const c = f.slice(); while (c.length < ancho) c.push(''); return c; });
    let resp, cuerpo, nuevas = [], cambiadas = [];
    if (accion === 'saveSupervisor') {
      const lista = Array.isArray(b.lista) ? b.lista : [b];
      let creados = 0, actualizados = 0;
      for (const x of lista) {
        const dni = String(x.dni || '').trim(), nombre = String(x.nombre || '').trim();
        if (!dni || !nombre) continue;
        const k = String(x.dni_original || dni).trim();
        const activo = x.activo === false || String(x.activo).toUpperCase() === 'NO' ? 'NO' : 'SI';
        const fila = [dni, nombre, String(x.cargo || ''), String(x.sector || ''), String(x.empresa || ''), String(x.correo || ''),
                      x.reemplazo ? 'SI' : 'NO', activo, activo === 'NO' ? (x.fecha_baja || ymdLima(ms)) : '',
                      String(x.observacion || ''), ahora, String(usuario || '')];
        const celdas = fila.map(v => CAP.comoHoja(v));
        const i = filas.findIndex(f => S(f[0]).trim() === k);
        if (i >= 0) { filas[i] = celdas; await actualizarFila(tx, K_SUP, i, celdas); cambiadas.push({ fila: i + 2, celdas }); actualizados++; }
        else { filas.push(celdas); nuevas.push(celdas); creados++; }
      }
      if (nuevas.length) await CAP.agregarFilas(tx, K_SUP, nuevas);
      resp = { success: true, action: creados ? 'created' : 'updated', creados, actualizados };
      cuerpo = { accion, usuario: String(usuario || ''), ms, lista: lista.map(x => ({ dni: x.dni, dni_original: x.dni_original, nombre: x.nombre, cargo: x.cargo, sector: x.sector, empresa: x.empresa, correo: x.correo, reemplazo: !!x.reemplazo, activo: x.activo, fecha_baja: x.fecha_baja, observacion: x.observacion })) };
    } else {
      const motivo = String(b.motivo || '').trim();
      const ya = filas.find(f => S(f[0]).trim().toLowerCase() === motivo.toLowerCase());
      if (ya) { await tx.rollback(); return { status: 200, body: { success: true, yaExistia: true, motivo: S(ya[0]).trim(), fuente: 'azure' } }; }
      const celdas = [CAP.comoHoja(motivo), CAP.comoHoja(ahora), CAP.comoHoja(String(usuario || ''))];
      nuevas.push(celdas);
      await CAP.agregarFilas(tx, K_MOT, nuevas);
      resp = { success: true, motivo };
      cuerpo = { accion, motivo, usuario: String(usuario || ''), ms };
    }
    await CAP.tocarMarcas(tx, [clave]);
    resp.fuente = 'azure';
    await tx.request().input('k', sql.NVarChar(100), claveOp).input('a', sql.NVarChar(30), accion).input('u', sql.NVarChar(100), usuario ? String(usuario) : null)
      .input('c', sql.NVarChar(sql.MAX), JSON.stringify(cuerpo)).input('r', sql.NVarChar(sql.MAX), JSON.stringify(resp))
      .query("INSERT INTO dbo.CV_Ops (clave, tipo, accion, nro, usuario, cuerpo, respuesta) VALUES (@k, 'sup', @a, NULL, @u, @c, @r)");
    if (prueba) { await tx.rollback(); resp.prueba = true; resp._op = cuerpo; resp._nuevas = nuevas; resp._cambiadas = cambiadas; } else await tx.commit();
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

/* = getSupervisores del Apps Script, desde la tabla */
function getSupervisores(T) {
  const fb = v => esD(v) ? (v.$d ? ymdLima(new Date(v.$d).getTime()) : '') : String(v || '');
  const data = T.filas.filter(r => r[0] !== '' && r[0] !== null && r[0] !== undefined).map(r => {
    const c = r.slice(); while (c.length < ANCHO_SUP) c.push('');
    const act = String(c[7] == null ? '' : S(c[7])).trim();
    return {
      dni: S(c[0]), nombre: c[1], cargo: c[2], sector: c[3], empresa: c[4], correo: c[5],
      reemplazo: c[6] === 'SI' || c[6] === true,
      activo: act.toUpperCase() !== 'NO',
      fecha_baja: fb(c[8]),
      observacion: String(c[9] || ''),
      gestionado: act !== ''
    };
  });
  return { success: true, data, fuente: 'azure' };
}
/* = getMotivosCasos del Apps Script, desde la tabla */
function getMotivosCasos(T) {
  const out = [], vistos = {};
  T.filas.forEach(r => { const m = S(r[0]).trim(); if (!m) return; const k = m.toLowerCase(); if (vistos[k]) return; vistos[k] = true; out.push(m); });
  out.sort((a, b) => { if (a.toLowerCase() === 'otros') return 1; if (b.toLowerCase() === 'otros') return -1; return a.localeCompare(b); });
  return { success: true, data: out, fuente: 'azure' };
}

module.exports = { ejecutar, encendido, getSupervisores, getMotivosCasos, ACCIONES, LECTURAS, K_SUP, K_MOT };
