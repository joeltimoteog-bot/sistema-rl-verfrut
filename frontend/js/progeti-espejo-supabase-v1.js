/* ════════════════════════════════════════════════════════════════════════════
   progeti-espejo-supabase-v1.js — _PROGETI_ESPEJO_V1 (10-nov-2026)
   PROBLEMA: Programacion ETI guarda en Firestore (SDK modular) y NO copiaba a Supabase (el espejo
   eti-supabase.js solo sirve para el SDK compat de los ETI). Los informes leen Supabase, asi que las
   programaciones y reprogramaciones hechas aqui despues del 05-nov podian faltar alla.
   SOLUCION (sin tocar la logica de la pagina): escucha la misma coleccion programaciones_eti de Firestore
   (la misma app "progeti" que ya abrio la pagina) y deja Supabase (eti.programaciones_eti) IGUAL:
     · al abrir: compara documento por documento y copia a Supabase lo que falte o este distinto;
     · despues: cada alta o cambio se copia; cada eliminacion en Firestore se elimina en Supabase.
   No borra en Supabase nada que no se haya visto borrar en vivo (los "sobrantes" solo se informan).
   Firestore sigue siendo la fuente; nada cambia para el usuario.
   Consola:  progetiEspejo.estado()   ·   Apagar: localStorage.progeti_espejo = 'off'
   ════════════════════════════════════════════════════════════════════════════ */
const API = 'https://exdjzbfinppzatjyimxn.supabase.co/functions/v1/api/eti/', REG = '?forceFunctionRegion=sa-east-1';
const COL = 'programaciones_eti';
const est = { inicio: null, revisados: 0, copiados: 0, eliminados: 0, sobrantes: [], errores: 0, ultimoError: '', listo: false };
window.progetiEspejo = { estado: () => JSON.parse(JSON.stringify(est)) };

function apagado() { try { return localStorage.getItem('progeti_espejo') === 'off'; } catch (e) { return false; } }
function token() { try { return sessionStorage.getItem('rl_token') || ''; } catch (e) { return ''; } }
async function post(accion, cuerpo) {
  const t = token(); if (!t) throw new Error('sin sesion');
  const r = await fetch(API + accion + REG, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify(cuerpo) });
  const j = await r.json().catch(() => ({})); if (!r.ok || !j.success) throw new Error((j && j.error) || ('HTTP ' + r.status)); return j;
}
/* mismo formato que el espejo de los ETI (eti-supabase.js): Timestamps -> ISO, sin undefined */
const limpio = (v) => JSON.parse(JSON.stringify(v, (k, x) => (x && typeof x === 'object' && typeof x.toDate === 'function') ? x.toDate().toISOString() : x));
const estable = (v) => Array.isArray(v) ? '[' + v.map(estable).join(',') + ']' : (v && typeof v === 'object') ? '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + estable(v[k])).join(',') + '}' : JSON.stringify(v);
async function enviar(ops) {
  for (let i = 0; i < ops.length; i += 200) {
    const lote = ops.slice(i, i + 200).map(o => Object.assign({ col: COL, origen: 'espejo-progeti' }, o));
    try { await post('escribir', { ops: lote }); lote.forEach(o => { if (o.op === 'delete') est.eliminados++; else est.copiados++; }); }
    catch (e) { est.errores++; est.ultimoError = e.message; console.warn('[_PROGETI_ESPEJO_V1] no se pudo copiar a Supabase:', e.message); }
  }
}
function pintar() {
  const n = document.getElementById('nube'); if (!n) return;
  let b = document.getElementById('progetiEspejoEst');
  if (!b) { b = document.createElement('span'); b.id = 'progetiEspejoEst'; b.className = 'noprint'; b.style.cssText = 'margin-left:8px;font-size:12px;color:#475569'; n.insertAdjacentElement('afterend', b); }
  b.textContent = est.errores ? '⚠️ Supabase: revisar (' + est.ultimoError + ')' : est.listo ? '⇄ Supabase al día' : '⇄ Sincronizando Supabase…';
  b.title = 'Programaciones revisadas: ' + est.revisados + ' · copiadas: ' + est.copiados + ' · eliminadas: ' + est.eliminados + (est.sobrantes.length ? ' · solo en Supabase: ' + est.sobrantes.length : '');
}

async function iniciar() {
  if (apagado()) { console.log('[_PROGETI_ESPEJO_V1] apagado (localStorage progeti_espejo=off)'); return; }
  const V = 'https://www.gstatic.com/firebasejs/10.8.0/';
  const { getApps } = await import(V + 'firebase-app.js');
  const { getFirestore, collection, onSnapshot } = await import(V + 'firebase-firestore.js');
  let app = null;
  for (let i = 0; i < 40 && !app; i++) { app = getApps().find(a => a.name === 'progeti') || null; if (!app) await new Promise(r => setTimeout(r, 500)); }
  if (!app) { console.warn('[_PROGETI_ESPEJO_V1] la pagina no abrio Firestore; no se sincroniza'); return; }
  for (let i = 0; i < 40 && !token(); i++) await new Promise(r => setTimeout(r, 500));
  if (!token()) { console.warn('[_PROGETI_ESPEJO_V1] sin sesion del Sistema RR.LL.; no se sincroniza'); return; }
  est.inicio = new Date().toISOString();
  let primera = true;
  onSnapshot(collection(getFirestore(app), COL), { includeMetadataChanges: false }, async (snap) => {
    if (snap.metadata.fromCache || snap.metadata.hasPendingWrites) return;   /* solo lo confirmado por el servidor */
    try {
      if (primera) {
        primera = false;
        const sb = {}; (await post('consultar', { col: COL, filtros: [], limite: 20000 })).docs.forEach(d => { sb[d.id] = d.datos; });
        const ops = [], vistos = {};
        snap.docs.forEach(d => { const datos = limpio(d.data()); vistos[d.id] = 1; est.revisados++;
          if (!(d.id in sb) || estable(sb[d.id]) !== estable(datos)) ops.push({ id: d.id, op: 'set', datos: datos }); });
        est.sobrantes = Object.keys(sb).filter(id => !vistos[id]);
        if (ops.length) await enviar(ops);
        est.listo = true;
        console.log('[_PROGETI_ESPEJO_V1] revisadas ' + est.revisados + ' programaciones · copiadas a Supabase ' + ops.length + (est.sobrantes.length ? ' · solo en Supabase (no se borran): ' + est.sobrantes.length : ''));
      } else {
        const ops = [];
        snap.docChanges().forEach(c => { if (c.type === 'removed') ops.push({ id: c.doc.id, op: 'delete' }); else ops.push({ id: c.doc.id, op: 'set', datos: limpio(c.doc.data()) }); });
        if (ops.length) await enviar(ops);
      }
    } catch (e) { est.errores++; est.ultimoError = e.message; console.warn('[_PROGETI_ESPEJO_V1]', e.message); }
    pintar();
  }, (e) => { est.errores++; est.ultimoError = e.message; pintar(); });
  pintar();
}
iniciar().catch(e => console.warn('[_PROGETI_ESPEJO_V1]', e.message));
