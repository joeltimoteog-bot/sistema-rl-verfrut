/* ═══════════════════════════════════════════════════════════════════════════
   progeti-fs-shim.js — _PROGETI_SUPABASE_V1 (27-nov-2026) — PROGRAMACION ETI: SUPABASE MANDA
   Misma tecnica que Capacitaciones ETI (sistema-eti/js/eti-fs-shim.js): reemplaza las funciones de Firestore
   que usa programacion-eti.html (getFirestore, collection, doc, addDoc, setDoc, updateDoc, deleteDoc, onSnapshot)
   por versiones que LEEN y ESCRIBEN en Supabase (eti.<coleccion>, rutas /api/eti/consultar|escribir).
   · Firestore queda como COPIA: cada escritura se copia tambien a Firestore en segundo plano.
   · Las escuchas en vivo se emulan consultando Supabase cada 12 s, al volver a la pestana y despues de cada escritura propia.
   · Si una coleccion esta VACIA en Supabase y tiene datos en Firestore (p. ej. la proyeccion anual antes de copiarse),
     esa coleccion sigue en Firestore en esta sesion (lectura y escritura), para que nadie vea la pagina vacia.
     Cuando entra jtimoteo, se copian a Supabase SOLO los documentos de la proyeccion que falten (nunca se sobrescribe).
   · Sin sesion del RR.LL. (rl_token) o si Supabase no responde en la primera lectura: Firestore como antes.
   Volver atras en 1 segundo (sin publicar nada):  localStorage.progeti_motor = 'firestore'  y recargar.
   Herramientas (F12):  progetiMotor.estado()   progetiMotor.verificar()
   ═══════════════════════════════════════════════════════════════════════════ */
import * as FS from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

const API = 'https://exdjzbfinppzatjyimxn.supabase.co/functions/v1/api/eti/';
const POLL_MS = 12000;
const COLS = ['programaciones_eti', 'supervisores_eti', 'usuarios_eti', 'progeti_plan'];
const COPIAR_FALTANTES = ['progeti_plan'];   /* solo la proyeccion anual se completa sola (las programaciones ya estan iguales) */
let MOTOR = 'supabase'; try { if (localStorage.getItem('progeti_motor') === 'firestore') MOTOR = 'firestore'; } catch (e) {}
window.__PROGETI_MOTOR = MOTOR;   /* el espejo antiguo (progeti-espejo-supabase-v1.js) se apaga si el motor es Supabase */
const est = { motor: MOTOR, lecturas: 0, escrituras: 0, respaldos: 0, erroresRespaldo: 0, firestoreSinToken: 0, enFirestore: [], copiadosPlan: 0, ultimoError: '' };
const token = () => { try { return sessionStorage.getItem('rl_token') || ''; } catch (e) { return ''; } };
const yo = () => { try { return String((JSON.parse(sessionStorage.getItem('user') || 'null') || {}).usuario || '').trim().toLowerCase(); } catch (e) { return ''; } };
const enFs = {};   /* col -> true: esta sesion usa Firestore para esa coleccion */
const caidaSb = {};   /* col -> true: se paso a Firestore porque Supabase no respondio: lo que se escriba se envia tambien a Supabase */
const usaSupabase = (col) => MOTOR === 'supabase' && COLS.indexOf(col) >= 0 && !enFs[col] && !!token() && navigator.onLine;
let realDb = null;

async function post(accion, cuerpo) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 20000);
  try {
    const r = await fetch(API + accion + '?forceFunctionRegion=sa-east-1', { method: 'POST', signal: ctl.signal, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() }, body: JSON.stringify(cuerpo || {}) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.success === false) { const e = new Error(j.error || j.message || ('HTTP ' + r.status)); e.status = r.status; throw e; }
    return j;
  } finally { clearTimeout(t); }
}
const limpio = (v) => v === undefined ? undefined : JSON.parse(JSON.stringify(v, (k, x) => (x && typeof x === 'object' && typeof x.toDate === 'function') ? x.toDate().toISOString() : x));
function idNuevo() { const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'; let s = ''; const r = new Uint8Array(20); crypto.getRandomValues(r); for (let i = 0; i < 20; i++) s += A[r[i] % 62]; return s; }

export function getFirestore(app) { realDb = FS.getFirestore(app); return MOTOR === 'firestore' ? realDb : { __shim: true, app }; }
export function collection(db, name) { return (db && db.__shim) ? { __t: 'col', col: name } : FS.collection(db, name); }
export function doc(db, col, id) {
  if (db && db.__shim) return { __t: 'doc', col, id: id || idNuevo() };
  return FS.doc(db, col, id);
}

function snapDe(col, filas) {
  const docs = filas.map(r => ({ id: r.id, ref: { __t: 'doc', col, id: r.id }, exists: () => true, data: () => r.datos || {} }));
  return { docs, empty: !docs.length, size: docs.length, forEach: (fn) => docs.forEach(fn), metadata: { fromCache: false, hasPendingWrites: false, fuente: 'supabase' } };
}
async function consultar(col) { const j = await post('consultar', { col, filtros: [], limite: 20000 }); est.lecturas++; return snapDe(col, j.docs || []); }

/* ── copia a Firestore (segundo plano, nunca bloquea) ── */
const colaRespaldo = [];
async function respaldar(op) {
  if (!realDb) return;
  try {
    if (op.op === 'delete') await FS.deleteDoc(FS.doc(realDb, op.col, op.id));
    else if (op.op === 'set') await FS.setDoc(FS.doc(realDb, op.col, op.id), op.datos, { merge: !!op.merge });
    else await FS.setDoc(FS.doc(realDb, op.col, op.id), op.datos, { merge: true });
    est.respaldos++;
  } catch (e) { est.erroresRespaldo++; est.ultimoError = 'copia Firestore: ' + (e && e.message); colaRespaldo.push(op); if (colaRespaldo.length > 500) colaRespaldo.shift(); }
}
setInterval(() => { if (!colaRespaldo.length || !navigator.onLine) return; respaldar(colaRespaldo.shift()); }, 15000);

/* ── si Supabase no respondio al abrir, lo escrito en Firestore se envia tambien a Supabase (con reintentos) ── */
const colaSb = [];
async function aSupabase(op) {
  if (!caidaSb[op.col] || MOTOR !== 'supabase' || !token()) return;
  try { await post('escribir', { ops: [Object.assign({ origen: 'programacion-eti-reintento' }, op)] }); est.reenviadosSupabase = (est.reenviadosSupabase || 0) + 1; }
  catch (e) { est.ultimoError = 'reenvio Supabase: ' + (e && e.message); colaSb.push(op); if (colaSb.length > 500) colaSb.shift(); }
}
setInterval(() => { if (!colaSb.length || !navigator.onLine) return; aSupabase(colaSb.shift()); }, 15000);
async function enFirestore(col, op, fn) { const r = await fn(); est.firestoreSinToken++; aSupabase(Object.assign({ col }, op, op.op === 'set' && r && r.id ? { id: r.id } : {})); return r; }

/* ── escrituras: Supabase primero (si falla, la pagina muestra su aviso de error); luego copia a Firestore ── */
const oyentes = {};
function avisar(col) { (oyentes[col] || new Set()).forEach(fn => { try { fn(true); } catch (e) {} }); }
async function escribir(op) {
  await post('escribir', { ops: [Object.assign({ origen: 'programacion-eti' }, op)] });
  est.escrituras++; avisar(op.col); respaldar(op);
}
export async function addDoc(colRef, datos) {
  if (!(colRef && colRef.__t)) return FS.addDoc(colRef, datos);
  if (!usaSupabase(colRef.col)) return enFirestore(colRef.col, { op: 'set', datos: limpio(datos) }, () => FS.addDoc(FS.collection(realDb, colRef.col), datos));
  const id = idNuevo(); await escribir({ col: colRef.col, id, op: 'set', datos: limpio(datos) });
  return { __t: 'doc', col: colRef.col, id };
}
export async function setDoc(ref, datos, opc) {
  if (!(ref && ref.__t)) return FS.setDoc(ref, datos, opc);
  if (!usaSupabase(ref.col)) return enFirestore(ref.col, { id: ref.id, op: 'set', datos: limpio(datos), merge: !!(opc && opc.merge) }, () => FS.setDoc(FS.doc(realDb, ref.col, ref.id), datos, opc || {}));
  await escribir({ col: ref.col, id: ref.id, op: 'set', datos: limpio(datos), merge: !!(opc && opc.merge) });
}
export async function updateDoc(ref, datos) {
  if (!(ref && ref.__t)) return FS.updateDoc(ref, datos);
  if (!usaSupabase(ref.col)) return enFirestore(ref.col, { id: ref.id, op: 'update', datos: limpio(datos) }, () => FS.updateDoc(FS.doc(realDb, ref.col, ref.id), datos));
  await escribir({ col: ref.col, id: ref.id, op: 'update', datos: limpio(datos) });
}
export async function deleteDoc(ref) {
  if (!(ref && ref.__t)) return FS.deleteDoc(ref);
  if (!usaSupabase(ref.col)) return enFirestore(ref.col, { id: ref.id, op: 'delete' }, () => FS.deleteDoc(FS.doc(realDb, ref.col, ref.id)));
  await escribir({ col: ref.col, id: ref.id, op: 'delete' });
}

/* ── proyeccion anual: copiar a Supabase solo lo que falte (lo hace jtimoteo; nunca sobrescribe) ── */
async function copiarFaltantes(col, idsSb) {
  if (COPIAR_FALTANTES.indexOf(col) < 0 || yo() !== 'jtimoteo' || !realDb) return 0;
  const fs = await FS.getDocs(FS.collection(realDb, col)), ya = {}; idsSb.forEach(id => { ya[id] = 1; });
  const ops = fs.docs.filter(d => !ya[d.id]).map(d => ({ col, id: d.id, op: 'set', datos: limpio(d.data()), origen: 'migracion-progeti' }));
  if (!ops.length) return 0;
  await post('escribir', { ops });
  est.copiadosPlan += ops.length;
  console.log('[progeti-motor] ' + col + ': ' + ops.length + ' documento(s) copiados de Firestore a Supabase (solo los que faltaban)');
  return ops.length;
}

/* ── escuchas en vivo ── */
export function onSnapshot(q, cb, errCb) {
  if (!(q && q.__t)) return FS.onSnapshot(q, cb, errCb);
  const col = q.col;
  const aFirestore = (motivo) => { if (!enFs[col]) { enFs[col] = true; est.enFirestore.push(col + ' (' + motivo + ')'); console.warn('[progeti-motor] ' + col + ': se usa Firestore en esta sesion (' + motivo + ')'); } return FS.onSnapshot(FS.collection(realDb, col), cb, errCb); };
  if (!usaSupabase(col)) { est.firestoreSinToken++; return FS.onSnapshot(FS.collection(realDb, col), cb, errCb); }
  let vivo = true, huella = null, enVuelo = false, unsubFs = null, iv = null, primera = true;
  const parar = () => { vivo = false; clearInterval(iv); document.removeEventListener('visibilitychange', vis); if (oyentes[col]) oyentes[col].delete(tick); };
  const tick = async (forzar) => {
    if (!vivo || enVuelo || (document.hidden && huella !== null && !forzar)) return; enVuelo = true;
    try {
      let s = await consultar(col);
      if (primera) {
        primera = false;
        if (s.empty && realDb) {   /* vacia en Supabase: ¿tiene datos en Firestore? */
          const n = await copiarFaltantes(col, []).catch(e => { est.ultimoError = 'copia ' + col + ': ' + (e && e.message); return 0; });
          if (n) s = await consultar(col);
          if (s.empty) { const fs = await FS.getDocs(FS.collection(realDb, col)); if (!fs.empty) { parar(); unsubFs = aFirestore('vacia en Supabase'); return; } }
        } else if (!s.empty) { copiarFaltantes(col, s.docs.map(d => d.id)).then(n => { if (n) tick(true); }).catch(e => { est.ultimoError = 'copia ' + col + ': ' + (e && e.message); }); }
      }
      const h = JSON.stringify(s.docs.map(d => [d.id, d.data()]));
      if (h !== huella) { huella = h; cb(s); }
    } catch (e) {
      est.ultimoError = 'escucha ' + col + ': ' + (e && e.message);
      if (huella === null) { parar(); try { if (!(e && (e.status === 401 || e.status === 403))) caidaSb[col] = true; unsubFs = aFirestore((e && e.status === 403) ? 'sin permiso en Supabase' : 'Supabase no respondio'); } catch (e2) { if (errCb) errCb(e); } }
    } finally { enVuelo = false; }
  };
  const vis = () => { if (!document.hidden) tick(); };
  iv = setInterval(tick, POLL_MS); tick();
  document.addEventListener('visibilitychange', vis);
  (oyentes[col] = oyentes[col] || new Set()).add(tick);
  return () => { parar(); if (unsubFs) unsubFs(); };
}

/* ── herramientas ── */
function canon(v) { if (Array.isArray(v)) return v.map(canon); if (v && typeof v === 'object') { const o = {}; Object.keys(v).sort().forEach(k => { o[k] = canon(v[k]); }); return o; } return v; }
window.progetiMotor = {
  estado: () => { const e = Object.assign({}, est, { token: !!token(), enColaCopia: colaRespaldo.length, enColaSupabase: colaSb.length }); console.log(e); return e; },
  /* compara Supabase con Firestore documento por documento (solo cuenta; no muestra datos) */
  verificar: async (cols) => {
    const res = {};
    for (const c of (cols || COLS)) {
      try {
        const sb = (await post('consultar', { col: c, limite: 20000 })).docs, fs = await FS.getDocs(FS.collection(realDb, c));
        const m = {}; sb.forEach(d => { m[d.id] = JSON.stringify(canon(d.datos)); });
        let faltanEnSupabase = 0, distintos = 0, faltanEnFirestore = 0; const vistos = {};
        fs.docs.forEach(d => { vistos[d.id] = 1; const x = m[d.id]; if (x === undefined) faltanEnSupabase++; else if (x !== JSON.stringify(canon(limpio(d.data())))) distintos++; });
        sb.forEach(d => { if (!vistos[d.id]) faltanEnFirestore++; });
        res[c] = { supabase: sb.length, firestore: fs.size, faltanEnSupabase, faltanEnFirestore, distintos };
      } catch (e) { res[c] = { error: e && e.message }; }
    }
    console.table(res); return res;
  }
};
console.log('[progeti-motor] Programacion ETI: motor de datos = ' + MOTOR + (MOTOR === 'supabase' ? ' (Firestore como copia)' : ''));
