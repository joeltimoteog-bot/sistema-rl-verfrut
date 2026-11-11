/* ═══════════════════════════════════════════════════════════════════════════
   personas (_PADRON_PERSONAS_V1, 10-nov-2026) — Mantenimiento del PADRÓN ÚNICO de personas
   POST /api/personas/lista     {}                      -> personas, sectores, valores permitidos
   POST /api/personas/guardar   { id?, dni, apellidos, nombres, nombre_mostrar, usuario, cargo, empresa,
                                  sector, rol_campo, correo, vigente, desde, hasta, alias, notas }
                                                        -> crea (sin id) o actualiza (con id) UNA persona
   SOLO el creador del sistema (jtimoteo). Quien llama sale del token de sesion del Sistema RR.LL.
   (Authorization: Bearer, validado con shared/auth.verificarSoloRL, igual que informe-gh). Nada del
   cuerpo ni de la URL identifica al usuario: sin token valido -> 401 (los pases con "aud" de los ETI
   / SSO no valen); otro usuario -> 403.
   · Tablas (migracion/padron/01-esquema.sql): LEE rl.personas, rl.sectores y rl.usuarios (solo para
     comprobar que el login existe); ESCRIBE solo rl.personas y una fila de rastro en rl.cv_ops.
   · No existe borrar: dar de baja = vigente 0 + fecha "hasta".
   · Postgres directo (shared/db.pgDirecto), todo con parametros ($1, $2 …) y dentro de una
     transaccion con SET LOCAL search_path (citext vive en "extensions").
   · Rastro: cada alta / cambio deja una fila en rl.cv_ops (tipo 'padron'), la misma bitacora de
     operaciones que usan usr-guardar, alm-guardar y cap-guardar. Va con en_hoja = 1 para que NO entre
     a la cola que el Apps Script copia a las hojas de Google. Apagar: PADRON_RASTRO=0.
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
const AUTH = require('../shared/auth');

const SOLO_USUARIO = 'jtimoteo';
/* = CONSTRAINT ck_personas_rol de 01-esquema.sql (si cambia alla, cambiar aqui) */
const ROLES_CAMPO = ['SUPERVISOR_GH', 'ASISTENTE_RL', 'BIENESTAR_SOCIAL', 'COORDINACION', 'JEFATURA', 'ANALISTA_GH', 'REMUNERACIONES', 'DIGITADOR', 'OTRO'];
/* el esquema no restringe "empresa" (comentario: RAPEL / VERFRUT / OLMOS); AMBAS = trabaja para las dos razones sociales */
const EMPRESAS = ['RAPEL', 'VERFRUT', 'OLMOS', 'AMBAS'];
const SP = 'SET LOCAL search_path TO rl, public, extensions';
const COLS = `id, codigo, dni, apellidos, nombres, nombre_mostrar, usuario, cargo, empresa, sector, rol_campo, correo, vigente, evalua_kpi, evalua_cumplimiento,
  to_char(desde, 'YYYY-MM-DD') AS desde, to_char(hasta, 'YYYY-MM-DD') AS hasta, reemplaza_a, alias, notas,
  to_char(actualizado, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS actualizado, actualizado_por`;
/* campos que la pantalla puede cambiar (codigo, reemplaza_a y las tablas vecinas no se tocan aqui) */
const CAMPOS = ['dni', 'apellidos', 'nombres', 'nombre_mostrar', 'usuario', 'cargo', 'empresa', 'sector', 'rol_campo', 'correo', 'vigente', 'desde', 'hasta', 'alias', 'notas', 'evalua_kpi', 'evalua_cumplimiento'];   /* _PADRON_BANDERAS_V1 */

const txt = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001F\u007F]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const sinTilde = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '');
const fechaOk = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '')); if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])); return (!isNaN(d) && d.toISOString().slice(0, 10) === m[0] && +m[1] >= 1950 && +m[1] <= 2100) ? m[0] : null; };
const hoyLima = () => new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10);

function Mal(error, campo) { this.error = error; this.campo = campo || ''; }   /* error de validacion -> 400 con mensaje claro */

function sesion(req) {
  const h = String((req.headers && (req.headers.authorization || req.headers.Authorization)) || '');
  if (!h.startsWith('Bearer ') || !process.env.JWT_SECRET) return null;
  try { return AUTH.verificarSoloRL(h.slice(7).trim()); } catch (e) { return null; }
}
function pool() {
  const db = require('../shared/db');
  if (typeof db.pgDirecto !== 'function') throw new Error('El padron solo funciona con Supabase');
  return db.pgDirecto();
}
/* una transaccion con la ruta de esquemas fijada; siempre devuelve la conexion */
async function enTx(fn) {
  const cli = await pool().connect();
  try {
    await cli.query('BEGIN'); await cli.query(SP);
    const out = await fn(cli);
    await cli.query('COMMIT');
    return out;
  } catch (e) { try { await cli.query('ROLLBACK'); } catch (x) {} throw e; } finally { cli.release(); }
}
/* consulta opcional: si falla (tabla que no existe, permiso) no tumba la transaccion */
async function opcional(cli, nombre, sqlTxt, vals) {
  await cli.query('SAVEPOINT ' + nombre);
  try { const r = await cli.query(sqlTxt, vals || []); await cli.query('RELEASE SAVEPOINT ' + nombre); return r; }
  catch (e) { await cli.query('ROLLBACK TO SAVEPOINT ' + nombre); return null; }
}

/* ── lista ─────────────────────────────────────────────────────────────────── */
async function lista() {
  return enTx(async (cli) => {
    const p = await cli.query(`SELECT ${COLS} FROM rl.personas ORDER BY vigente DESC, apellidos NULLS LAST, nombres NULLS LAST, id`);
    const s = await cli.query('SELECT codigo, nombre, empresa, tipo, activo FROM rl.sectores ORDER BY orden, nombre');
    const u = await opcional(cli, 'sp_usr', 'SELECT usuario, nombre FROM rl.usuarios ORDER BY usuario');
    return { success: true, version: 1, hoy: hoyLima(), personas: p.rows, sectores: s.rows,
      roles_campo: ROLES_CAMPO, empresas: EMPRESAS, usuarios: u ? u.rows : null };
  });
}

/* ── equipo (lectura para TODA sesion valida) ──────────────────────────────── */
/* _PADRON_EQUIPO_V1 (10-nov-2026): los filtros y listas de supervisores de los modulos leen de aqui (una sola fuente).
   Solo personas vigentes y solo los datos que esas listas ya mostraban (nombre, DNI, cargo, empresa, sector, correo). */
async function equipo() {
  return enTx(async (cli) => {
    const r = await cli.query(`SELECT p.usuario, p.dni, p.apellidos, p.nombres, p.nombre_mostrar, p.cargo, p.empresa, p.sector AS sector_codigo,
        COALESCE(s.nombre, p.sector) AS sector, p.rol_campo, p.correo, p.evalua_kpi, p.evalua_cumplimiento, to_char(p.desde, 'YYYY-MM-DD') AS desde
      FROM rl.personas p LEFT JOIN rl.sectores s ON s.codigo = p.sector WHERE p.vigente = 1 ORDER BY p.apellidos NULLS LAST, p.nombres NULLS LAST, p.id`);
    return { success: true, version: 1, personas: r.rows };
  });
}

/* ── sugerir DNI ───────────────────────────────────────────────────────────── */
/* _PADRON_DNI_MASIVO_V1 (10-nov-2026): para cada persona VIGENTE sin DNI busca su nombre en la base de trabajadores
   (rl.trabajadores_rapel / rl.trabajadores_verfrut, la misma de "Buscar trabajador") y propone el DNI. SOLO PROPONE:
   nada se guarda hasta que Joel lo confirma en pantalla (puede haber homonimos). No devuelve DNIs que ya son de otra persona. */
const normNom = (t) => String(t || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();
async function sugerir() {
  return enTx(async (cli) => {
    const p = await cli.query('SELECT id, apellidos, nombres, nombre_mostrar, empresa FROM rl.personas WHERE vigente = 1 AND dni IS NULL ORDER BY apellidos NULLS LAST, nombres NULLS LAST, id');
    const usados = {}; (await cli.query('SELECT dni FROM rl.personas WHERE dni IS NOT NULL')).rows.forEach(r => { usados[String(r.dni)] = 1; });
    const NORM = "translate(upper(nombre_completo::text), 'ÁÉÍÓÚÜÑ', 'AEIOUUN')";
    const fuentes = [['RAPEL', 'trabajadores_rapel'], ['VERFRUT', 'trabajadores_verfrut']];
    const out = []; let fuenteOk = false;
    for (const per of p.rows) {
      const palabras = normNom((per.apellidos || '') + ' ' + (per.nombres || '')).split(' ').filter(w => w.length >= 3).slice(0, 6);
      const item = { id: per.id, nombre: per.nombre_mostrar || ((per.apellidos || '') + ' ' + (per.nombres || '')).trim(), empresa: per.empresa || '', candidatos: [] };
      if (palabras.length >= 2) {
        const pat = palabras.map(w => '%' + w.replace(/N/g, '_') + '%');   /* N/Ñ: la base puede traer la Ñ de otra forma */
        const vistos = {};
        for (const f of fuentes) {
          const r = await opcional(cli, 'sp_sug', `SELECT dni::text AS dni, nombre_completo::text AS nombre FROM rl.${f[1]} WHERE ${NORM} LIKE ALL($1::text[]) LIMIT 6`, [pat]);
          if (!r) continue; fuenteOk = true;
          r.rows.forEach(t => {
            let d = String(t.dni == null ? '' : t.dni).trim(); if (/^\d{7}$/.test(d)) d = '0' + d;
            if (!/^\d{8}$/.test(d) || usados[d] || vistos[d]) return; vistos[d] = 1;
            const nt = normNom(t.nombre).split(' ').filter(w => w.length >= 3);
            item.candidatos.push({ dni: d, nombre: String(t.nombre || '').trim(), empresa: f[0], exacto: nt.length === palabras.length });
          });
        }
      }
      item.candidatos = item.candidatos.slice(0, 6);
      out.push(item);
    }
    return { success: true, fuente_disponible: fuenteOk, personas: out };
  });
}

/* ── guardar ───────────────────────────────────────────────────────────────── */
/* limpia y valida lo que NO necesita la base. Devuelve los valores listos (vacio -> null). */
function limpiar(b) {
  const v = {};
  v.dni = txt(b.dni, 20).replace(/\s+/g, '') || null;
  if (v.dni && !/^[0-9]{8}$/.test(v.dni)) throw new Mal('El DNI debe tener exactamente 8 dígitos (o quedar vacío si aún no se confirma)', 'dni');
  v.apellidos = txt(b.apellidos, 120); if (!v.apellidos) throw new Mal('Escribe los apellidos', 'apellidos');
  v.nombres = txt(b.nombres, 120); if (!v.nombres) throw new Mal('Escribe los nombres', 'nombres');
  v.nombre_mostrar = txt(b.nombre_mostrar, 200) || (v.nombres + ' ' + v.apellidos);
  v.usuario = txt(b.usuario, 60).toLowerCase() || null;
  if (v.usuario && !/^[a-z0-9._-]{2,60}$/.test(v.usuario)) throw new Mal('El usuario solo lleva letras, números, punto o guion (sin espacios)', 'usuario');
  v.cargo = txt(b.cargo, 160) || null;
  v.empresa = txt(b.empresa, 20).toUpperCase() || null;
  if (v.empresa && EMPRESAS.indexOf(v.empresa) < 0) throw new Mal('La empresa debe ser ' + EMPRESAS.join(', ') + ' o quedar vacía', 'empresa');
  v.sector = txt(b.sector, 60) || null;
  v.rol_campo = txt(b.rol_campo, 40).toUpperCase() || null;
  if (v.rol_campo && ROLES_CAMPO.indexOf(v.rol_campo) < 0) throw new Mal('La función elegida no está en la lista permitida', 'rol_campo');
  v.correo = txt(b.correo, 160).toLowerCase() || null;
  if (v.correo && !/^[^\s@,;]+@[^\s@,;]+\.[a-z]{2,}$/.test(v.correo)) throw new Mal('El correo no tiene un formato válido (ejemplo: nombre@unifrutti.com)', 'correo');
  const vg = b.vigente === true ? 1 : b.vigente === false ? 0 : (b.vigente === undefined || b.vigente === null || b.vigente === '') ? null : String(b.vigente).trim();
  if (vg === null) v.vigente = null;
  else if (vg === 1 || vg === '1') v.vigente = 1; else if (vg === 0 || vg === '0') v.vigente = 0;
  else throw new Mal('Indica si la persona está vigente (Sí o No)', 'vigente');
  /* _PADRON_BANDERAS_V1 (10-nov-2026): se le miden los KPIs / entra al Control de Cumplimiento (Si o No). Sin dato = se conserva lo que tenia. */
  ['evalua_kpi', 'evalua_cumplimiento'].forEach(k => { const x = b[k]; v[k] = (x === undefined || x === null || x === '') ? null : (x === true || String(x).trim() === '1') ? 1 : (x === false || String(x).trim() === '0') ? 0 : -1; if (v[k] === -1) throw new Mal('Indica Sí o No', k); });
  const d = txt(b.desde, 12), h = txt(b.hasta, 12);
  v.desde = d ? fechaOk(d) : null; if (d && !v.desde) throw new Mal('La fecha "desde" no es válida', 'desde');
  v.hasta = h ? fechaOk(h) : null; if (h && !v.hasta) throw new Mal('La fecha "hasta" no es válida', 'hasta');
  if (v.desde && v.hasta && v.hasta < v.desde) throw new Mal('La fecha "hasta" no puede ser anterior a la fecha "desde"', 'hasta');
  const vistos = {};
  v.alias = String(b.alias == null ? '' : b.alias).split(/[|\r\n]+/).map(x => txt(x, 120)).filter(x => { const k = x.toLowerCase(); if (!x || vistos[k]) return false; vistos[k] = 1; return true; }).join('|').slice(0, 1000) || null;
  v.notas = String(b.notas == null ? '' : b.notas).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]+/g, ' ').trim().slice(0, 2000) || null;
  return v;
}
/* clave corta estable (solo al CREAR): con login = el usuario; sin login = nombre-apellido con guion */
async function codigoNuevo(cli, v) {
  const pal = s => sinTilde(s).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').trim().split(/\s+/)[0] || '';
  const base = (v.usuario || [pal(v.nombres), pal(v.apellidos)].filter(Boolean).join('-') || 'persona').slice(0, 60);
  for (let i = 1; i <= 60; i++) {
    const c = i === 1 ? base : base + '-' + i;
    const r = await cli.query('SELECT 1 FROM rl.personas WHERE codigo = $1', [c]);
    if (!r.rows.length) return c;
  }
  throw new Mal('No se pudo generar la clave de la persona. Avisa al administrador del sistema.', '');
}
const igual = (a, b) => String(a == null ? '' : a) === String(b == null ? '' : b);

async function guardar(b, operador, log) {
  const v = limpiar(b);
  let id = null;
  if (b.id !== undefined && b.id !== null && b.id !== '') {
    id = Number(b.id);
    if (!Number.isInteger(id) || id <= 0 || id > 2147483647) throw new Mal('No se reconoce a la persona que quieres editar. Cierra y vuelve a abrir el padrón.', '');
  }
  return enTx(async (cli) => {
    let antes = null;
    if (id) {
      const a = await cli.query(`SELECT ${COLS} FROM rl.personas WHERE id = $1 FOR UPDATE`, [id]);
      if (!a.rows.length) throw new Mal('Esa persona ya no figura en el padrón. Actualiza la lista.', '');
      antes = a.rows[0];
    }
    if (v.vigente === null) v.vigente = antes ? Number(antes.vigente) : 1;
    ['evalua_kpi', 'evalua_cumplimiento'].forEach(k => { if (v[k] === null) v[k] = antes ? Number(antes[k] || 0) : 0; });   /* _PADRON_BANDERAS_V1 */
    if (v.vigente === 1 && v.hasta) throw new Mal('Una persona vigente no lleva fecha "hasta". Borra esa fecha o márcala como no vigente.', 'hasta');
    if (v.vigente === 0 && !v.hasta && antes && Number(antes.vigente) === 1) throw new Mal('Para dar de baja indica la fecha "hasta" (último día en la función).', 'hasta');

    if (v.dni) {
      const r = await cli.query('SELECT id, nombre_mostrar FROM rl.personas WHERE dni = $1 AND id <> $2 LIMIT 1', [v.dni, id || 0]);
      if (r.rows.length) throw new Mal('Ese DNI ya está registrado a nombre de ' + String(r.rows[0].nombre_mostrar || 'otra persona').toUpperCase() + '. Revisa el número.', 'dni');
    }
    if (v.sector) {
      const r = await cli.query('SELECT codigo FROM rl.sectores WHERE codigo = $1', [v.sector]);
      if (!r.rows.length) throw new Mal('El sector elegido no existe en la lista de sectores', 'sector');
      v.sector = r.rows[0].codigo;   /* tal como esta escrito en rl.sectores */
    }
    if (v.usuario) {
      const r = await cli.query('SELECT id, nombre_mostrar FROM rl.personas WHERE usuario = $1 AND id <> $2 LIMIT 1', [v.usuario, id || 0]);
      if (r.rows.length) throw new Mal('El usuario "' + v.usuario + '" ya está enlazado a ' + String(r.rows[0].nombre_mostrar || 'otra persona').toUpperCase(), 'usuario');
      const u = await opcional(cli, 'sp_usr', 'SELECT usuario FROM rl.usuarios WHERE usuario = $1', [v.usuario]);
      if (u && !u.rows.length) throw new Mal('El usuario "' + v.usuario + '" no existe en Gestión de Usuarios. Créalo primero o deja el campo vacío.', 'usuario');
      if (u && u.rows.length) v.usuario = String(u.rows[0].usuario);
    }

    const cambios = {};
    CAMPOS.forEach(k => { if (!antes || !igual(antes[k], v[k])) cambios[k] = antes ? [antes[k] == null ? null : antes[k], v[k]] : v[k]; });
    if (antes && !Object.keys(cambios).length) return { success: true, creado: false, sinCambios: true, rastro: true, persona: antes };

    const vals = CAMPOS.map(k => v[k]);
    let fila;
    if (antes) {
      const set = CAMPOS.map((k, i) => k + ' = $' + (i + 1)).join(', ');
      const r = await cli.query(`UPDATE rl.personas SET ${set}, actualizado = (now() at time zone 'utc'), actualizado_por = $${CAMPOS.length + 1}
        WHERE id = $${CAMPOS.length + 2} RETURNING ${COLS}`, vals.concat([operador, id]));
      fila = r.rows[0];
    } else {
      const codigo = await codigoNuevo(cli, v);
      const r = await cli.query(`INSERT INTO rl.personas (codigo, ${CAMPOS.join(', ')}, actualizado, actualizado_por)
        VALUES ($1, ${CAMPOS.map((k, i) => '$' + (i + 2)).join(', ')}, (now() at time zone 'utc'), $${CAMPOS.length + 2}) RETURNING ${COLS}`, [codigo].concat(vals, [operador]));
      fila = r.rows[0];
    }

    /* rastro en la bitacora de operaciones (no entra a la cola de Google: en_hoja = 1). Si falla, el guardado sigue y se avisa. */
    let rastro = false;
    if (process.env.PADRON_RASTRO !== '0') {
      const clave = 'padron-' + fila.id + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
      const r = await opcional(cli, 'sp_rastro', `INSERT INTO rl.cv_ops (clave, tipo, accion, nro, usuario, cuerpo, respuesta, en_hoja, aplicado)
        VALUES ($1, 'padron', $2, $3, $4, $5, $6, 1, (now() at time zone 'utc'))`,
        [clave, antes ? 'actualizar' : 'crear', fila.id, operador, JSON.stringify({ id: fila.id, codigo: fila.codigo, cambios }), JSON.stringify({ success: true })]);
      rastro = !!r;
      if (!r && log) log.warn('[personas] no se pudo anotar el rastro en rl.cv_ops (persona ' + fila.id + ')');
    }
    /* _PADRON_DNI_MASIVO_V1: el DNI del padron se lleva a las tablas que ya guardan DNI del equipo, SOLO donde esta vacio
       (nunca pisa un DNI existente). Si alguna no existe o falla, el guardado sigue. */
    const conectado = [];
    if (fila.dni && fila.usuario) {
      const k = await opcional(cli, 'sp_kpi', "UPDATE rl.kpi_personas SET dni = $1 WHERE lower(usuario::text) = lower($2) AND (dni IS NULL OR btrim(dni::text) = '')", [String(fila.dni), String(fila.usuario)]);
      if (k && k.rowCount) conectado.push('KPIs');
    }
    /* _PADRON_SYNC_V1: la marca "Se le miden los KPIs" enciende o apaga a la persona en la tabla de KPIs (solo si cambio, o al crear) */
    if (!antes || Number(antes.evalua_kpi || 0) !== Number(fila.evalua_kpi || 0)) { try { const mk = await require('../shared/padron-sync').marcaKpi(cli, opcional, fila); if (mk) conectado.push(mk); } catch (eK) {} }
    return { success: true, creado: !antes, rastro, conectado, persona: fila };
  });
}

/* errores de la base -> mensaje claro (por si dos guardados chocan o una regla de la tabla lo rechaza) */
function deBase(e) {
  const c = e && e.code, n = String((e && e.constraint) || '');
  if (c === '23505') return /dni/i.test(n) ? new Mal('Ese DNI ya está registrado en otra persona', 'dni')
    : /usuario/i.test(n) ? new Mal('Ese usuario ya está enlazado a otra persona', 'usuario') : new Mal('Ya existe una persona con esos datos', '');
  if (c === '23503') return /usuario/i.test(n) ? new Mal('El usuario no existe en Gestión de Usuarios', 'usuario')
    : /sector/i.test(n) ? new Mal('El sector elegido no existe en la lista de sectores', 'sector') : new Mal('Hay un dato que no existe en las listas del sistema', '');
  if (c === '23514') return /dni/i.test(n) ? new Mal('El DNI debe tener exactamente 8 dígitos', 'dni') : /fechas/i.test(n) ? new Mal('La fecha "hasta" no puede ser anterior a la fecha "desde"', 'hasta')
    : /rol/i.test(n) ? new Mal('La función elegida no está en la lista permitida', 'rol_campo') : new Mal('Hay un dato que la base no acepta. Revisa el formulario.', '');
  if (c === '23502') return new Mal('Falta un dato obligatorio. Revisa el formulario.', '');
  return null;
}

module.exports = async function (context, req) {
  const accion = context.bindingData && context.bindingData.accion;
  const res = (status, body) => { context.res = { status, headers: { 'Cache-Control': 'no-store' }, body }; };
  try {
    /* 1. quien llama: SOLO el token firmado (nunca el cuerpo ni la URL) */
    const t = sesion(req);
    if (!t || !t.usuario) return res(401, { success: false, error: 'Sin sesion valida' });
    if (accion === 'equipo') return res(200, await equipo());   /* _PADRON_EQUIPO_V1: cualquier sesion valida del RR.LL. */
    if (String(t.usuario).trim().toLowerCase() !== SOLO_USUARIO) return res(403, { success: false, error: 'El padrón de personas es solo para el creador del sistema' });

    if (accion === 'lista') return res(200, await lista());
    if (accion === 'sugerir') return res(200, await sugerir());   /* _PADRON_DNI_MASIVO_V1 */
    if (accion === 'guardar') {
      let b = req.body;
      if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = null; } }
      if (!b || typeof b !== 'object' || Array.isArray(b)) return res(400, { success: false, error: 'No llegaron los datos de la persona' });
      return res(200, await guardar(b, SOLO_USUARIO, context.log));
    }
    return res(404, { success: false, error: 'Accion desconocida' });
  } catch (err) {
    const m = err instanceof Mal ? err : deBase(err);
    if (m) return res(400, { success: false, error: m.error, campo: m.campo });
    try { context.log.error('[personas] ' + accion + ': ' + (err && err.message)); } catch (e) {}
    return res(500, { success: false, error: 'No se pudo completar la operación. Intenta de nuevo en unos minutos.' });
  }
};
module.exports._t = { limpiar, fechaOk, ROLES_CAMPO, EMPRESAS, CAMPOS };
