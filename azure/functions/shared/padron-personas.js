/* ═════════════════════════════════════════════════════════════════
   padron-personas.js — _PADRON_MANDA_V1 (16-nov-2026)
   El PADRÓN DE PERSONAS (rl.personas, Supabase) es la fuente de verdad de los datos de identidad del
   equipo (DNI, correo, cargo, sector, empresa). Las demás listas del sistema (BD_Supervisores =
   rl.sup_registro, lista fija del dashboard, copia JSON de Google) se corrigen con el padrón ANTES de
   salir del servidor, así una persona tiene el mismo DNI en Visitas, Casos, Capacitaciones y Padrón.
   · Se empareja por usuario (login) si la lista lo trae, si no por nombre (sin tildes, sin mayúsculas,
     ignorando el orden de las palabras, y también por "alias" del padrón).
   · Solo personas VIGENTES del padrón corrigen. Si una persona no está en el padrón, se deja como estaba.
   · Si el padrón no responde, la lista sale como siempre (nunca se rompe la pantalla).
   · Cada fila corregida lleva dni_anterior y fuente_dni = 'padron' para poder auditar.
   Apagar: PADRON_MANDA=0 en las variables del servidor.
   ═════════════════════════════════════════════════════════════════ */
'use strict';
const sinTilde = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '');
const norm = s => sinTilde(s).toLowerCase().replace(/[^a-z0-9ñ ]+/g, ' ').replace(/\s+/g, ' ').trim();
const clavePalabras = s => norm(s).split(' ').filter(Boolean).sort().join(' ');
const soloDni = v => String(v == null ? '' : v).replace(/\D+/g, '');

let memo = { t: 0, idx: null };
const VIDA_MS = 60 * 1000;   /* un minuto: un cambio en el padrón se ve enseguida sin consultar en cada clic */

async function indice() {
  if (process.env.PADRON_MANDA === '0') return null;
  if (memo.idx && (Date.now() - memo.t) < VIDA_MS) return memo.idx;
  const db = require('./db');
  if (typeof db.pgDirecto !== 'function') return null;
  const cli = await db.pgDirecto().connect();
  try {
    await cli.query('SET search_path TO rl, public, extensions');
    const r = await cli.query(`SELECT p.dni, p.apellidos, p.nombres, p.nombre_mostrar, p.usuario, p.cargo, p.empresa, COALESCE(s.nombre, p.sector) AS sector, p.correo, p.alias
      FROM rl.personas p LEFT JOIN rl.sectores s ON s.codigo = p.sector WHERE p.vigente = 1`);   /* mismo criterio que personas/equipo */
    const porUsuario = {}, porNombre = {}, porPalabras = {};
    r.rows.forEach(p => {
      const dni = soloDni(p.dni); if (!dni) return;
      const fila = { dni, usuario: String(p.usuario || '').toLowerCase().trim(), correo: String(p.correo || '').trim(), cargo: String(p.cargo || '').trim(),
        sector: String(p.sector || '').trim(), empresa: String(p.empresa || '').trim(), nombre: String(p.nombre_mostrar || ((p.nombres || '') + ' ' + (p.apellidos || ''))).trim() };
      if (fila.usuario) porUsuario[fila.usuario] = fila;
      const nombres = [fila.nombre, (p.nombres || '') + ' ' + (p.apellidos || ''), (p.apellidos || '') + ' ' + (p.nombres || '')]
        .concat(String(p.alias || '').split(/[;,|\n]+/));
      nombres.forEach(n => { const k = norm(n); if (!k) return; porNombre[k] = fila; porPalabras[clavePalabras(n)] = fila; });
    });
    const personas = []; const vistos = new Set();
    Object.keys(porPalabras).forEach(k => { const f = porPalabras[k]; if (!vistos.has(f)) { vistos.add(f); personas.push({ fila: f, palabras: new Set(k.split(' ')) }); } });
    memo = { t: Date.now(), idx: { porUsuario, porNombre, porPalabras, personas, total: r.rows.length } };
    return memo.idx;
  } finally { cli.release(); }
}

function buscar(idx, item) {
  const u = String(item.usuario || '').toLowerCase().trim();
  if (u && idx.porUsuario[u]) return idx.porUsuario[u];
  const n = String(item.nombre || '');
  const directo = idx.porNombre[norm(n)] || idx.porPalabras[clavePalabras(n)];
  if (directo) return directo;
  /* el padrón suele traer el nombre completo (dos nombres, dos apellidos) y las listas solo una parte:
     vale si TODAS las palabras del nombre corto están en el largo (mínimo 3 en común) y la persona es única */
  const w = new Set(clavePalabras(n).split(' ').filter(Boolean));
  if (w.size < 2) return null;
  let hallado = null, cuantos = 0;
  idx.personas.forEach(p => {
    const chica = w.size <= p.palabras.size ? w : p.palabras, grande = chica === w ? p.palabras : w;
    let ok = true; chica.forEach(x => { if (!grande.has(x)) ok = false; });
    if (ok && chica.size >= Math.min(3, grande.size)) { cuantos++; hallado = p.fila; }
  });
  return cuantos === 1 ? hallado : null;
}

/* lista: arreglo de objetos con al menos { nombre } (y opcionalmente dni, usuario, correo, cargo, sector, empresa). Devuelve la misma lista corregida. */
async function aplicar(lista, opciones) {
  const op = Object.assign({ completar: true }, opciones || {});
  if (!Array.isArray(lista) || !lista.length) return lista;
  let idx = null;
  try { idx = await indice(); } catch (e) { return lista; }
  if (!idx) return lista;
  let corregidos = 0;
  lista.forEach(it => {
    if (!it || typeof it !== 'object') return;
    const p = buscar(idx, it); if (!p) return;
    const dniAnt = soloDni(it.dni);
    if (dniAnt !== p.dni) { it.dni_anterior = it.dni === undefined ? '' : it.dni; it.dni = p.dni; it.fuente_dni = 'padron'; corregidos++; }
    if (op.completar) {
      if (!String(it.correo || '').trim() && p.correo) it.correo = p.correo;
      if (!String(it.cargo || '').trim() && p.cargo) it.cargo = p.cargo;
      if (!String(it.empresa || '').trim() && p.empresa) it.empresa = p.empresa;
    }
  });
  lista._padron = { personas: idx.total, corregidos };
  return lista;
}

module.exports = { aplicar, indice, norm };
