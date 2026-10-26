/* ═══════════════════════════════════════════════════════════════════════════
   empresas.js — _EMPRESAS_V1 (26-oct-2026): catalogo central de empresas del grupo.
   Antes RAPEL y VERFRUT estaban escritas a mano en cada funcion; ahora las funciones
   de trabajadores (busqueda y sincronizacion) leen esta lista. Para sumar una empresa:
   agregar una fila aqui, crear la hoja Trabajadores_<CODIGO> en el libro de trabajadores
   (mismas columnas) y cargar su base. La tabla en Azure se crea sola en la primera carga.
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
const EMPRESAS = [
  { codigo: 'RAPEL',   nombre: 'RAPEL S.A.C',   tabla: 'Trabajadores_RAPEL',   clave: 'rapel',   fundos: [] },
  { codigo: 'VERFRUT', nombre: 'VERFRUT S.A.C', tabla: 'Trabajadores_VERFRUT', clave: 'verfrut', fundos: [] },
  { codigo: 'OLMOS',   nombre: 'OLMOS',         tabla: 'Trabajadores_OLMOS',   clave: 'olmos',   fundos: ['BOMAREA', 'PIRONA', 'MOSQUETA', 'HEFEI', 'LEFKADA'] }
];
const TODAS = ['AMBAS', 'TODAS', 'TODOS', ''];
function porCodigo(c) { c = String(c || '').trim().toUpperCase(); return EMPRESAS.find(e => e.codigo === c) || null; }
function esTodas(c) { return TODAS.indexOf(String(c || '').trim().toUpperCase()) >= 0; }
/* tablas de trabajadores que ya existen en la base (cache 5 min): una empresa recien agregada
   no rompe la busqueda mientras no se cargue su base */
let _ex = { t: 0, set: null };
async function tablasExistentes(pool, sql) {
  if (_ex.set && Date.now() - _ex.t < 300000) return _ex.set;
  const r = await pool.request().query("SELECT name FROM sys.tables WHERE name LIKE 'Trabajadores[_]%'");
  _ex = { t: Date.now(), set: new Set(r.recordset.map(x => x.name)) };
  return _ex.set;
}
function invalidarTablas() { _ex = { t: 0, set: null }; }
module.exports = { EMPRESAS, porCodigo, esTodas, tablasExistentes, invalidarTablas };
