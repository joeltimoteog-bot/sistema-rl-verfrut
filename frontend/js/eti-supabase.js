/* ═══════════════════════════════════════════════════════════════════════════
   eti-supabase.js — _ETI_SUPABASE_V1 (05-nov-2026) — ETAPA 1: ESPEJO
   Evaluacion ETI sigue usando Firestore como siempre; este archivo copia cada escritura
   (set / update / delete / add / batch) TAMBIEN a Supabase (tabla eti.<coleccion>), al mismo
   tiempo. Si Supabase no responde, la escritura queda en una cola local y se reintenta sola.
   No cambia lo que ven ni hacen los usuarios. Solo el proyecto Firestore "sistema-eti-verfrut".
   Herramientas del administrador (consola F12):
     etiSupabase.copiarTodo()   copia TODO el historico de Firestore a Supabase
     etiSupabase.verificar()    compara documento por documento Firestore vs Supabase
     etiSupabase.estado()       cola pendiente y ultimo error
   Apagar el espejo: localStorage.eti_supabase = 'off'
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.etiSupabase || !window.firebase || !firebase.firestore || !firebase.firestore.DocumentReference) return;
  var API = 'https://exdjzbfinppzatjyimxn.supabase.co/functions/v1/api/eti/';
  var PROYECTO = 'sistema-eti-verfrut';
  var COLS = ['respuestas_qr', 'evaluaciones_conocimiento', 'config_eti', 'sesiones_qr', 'programaciones_eti',
    'programaciones_eval', 'informes_enviados', 'evaluaciones_depuradas', 'banco_historial',
    'capacitaciones', 'supervisores_eti', 'usuarios_eti'];
  var CLAVE_COLA = 'eti_supabase_cola';
  var activo = true; try { if (localStorage.getItem('eti_supabase') === 'off') activo = false; } catch (e) {}
  var ultimoError = '';

  function token() { try { return sessionStorage.getItem('eti_token') || ''; } catch (e) { return ''; } }
  function post(accion, cuerpo) {
    var h = { 'Content-Type': 'application/json' }, t = token(); if (t) h.Authorization = 'Bearer ' + t;
    return fetch(API + accion, { method: 'POST', headers: h, body: JSON.stringify(cuerpo) }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok || !j.success) throw new Error((j && j.error) || ('HTTP ' + r.status)); return j; });
    });
  }
  /* datos a JSON puro (Date -> ISO; undefined fuera), como los guarda Firestore en este sistema */
  function limpio(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v, function (k, x) { return (x && typeof x === 'object' && typeof x.toDate === 'function') ? x.toDate().toISOString() : x; })); }
  function deRef(ref) {
    try {
      if (!ref || !ref.firestore || ref.firestore.app.options.projectId !== PROYECTO) return null;
      var p = String(ref.path || '').split('/');
      if (p.length !== 2 || COLS.indexOf(p[0]) < 0) return null;
      return { col: p[0], id: p[1] };
    } catch (e) { return null; }
  }
  function cola() { try { return JSON.parse(localStorage.getItem(CLAVE_COLA) || '[]'); } catch (e) { return []; } }
  function guardarCola(c) { try { localStorage.setItem(CLAVE_COLA, JSON.stringify(c.slice(-2000))); } catch (e) {} }
  function enviar(ops) {
    if (!activo || !ops.length) return;
    ops.forEach(function (o) { o.origen = 'espejo'; });
    post('escribir', { ops: ops }).catch(function (e) {
      ultimoError = e.message;
      if (/no permitida|invalid|Sesion requerida/.test(e.message)) { try { console.warn('[_ETI_SUPABASE_V1] no se copio:', e.message); } catch (x) {} return; }
      guardarCola(cola().concat(ops));
    });
  }
  var vaciando = false;
  function vaciarCola() {
    if (!activo || vaciando || !navigator.onLine) return;
    var c = cola(); if (!c.length) return;
    vaciando = true;
    var lote = c.slice(0, 100);
    post('escribir', { ops: lote }).then(function () { guardarCola(cola().slice(lote.length)); vaciando = false; if (cola().length) setTimeout(vaciarCola, 500); })
      .catch(function (e) { ultimoError = e.message; vaciando = false; });
  }
  window.addEventListener('online', vaciarCola);
  setInterval(vaciarCola, 60000); setTimeout(vaciarCola, 5000);

  /* ── ganchos sobre Firestore (compat) ── */
  var DR = firebase.firestore.DocumentReference.prototype, CR = firebase.firestore.CollectionReference.prototype, WB = firebase.firestore.WriteBatch && firebase.firestore.WriteBatch.prototype;
  var o_set = DR.set, o_update = DR.update, o_delete = DR.delete, o_add = CR.add;
  DR.set = function (datos, opc) {
    var r = deRef(this); if (r) enviar([{ col: r.col, id: r.id, op: 'set', datos: limpio(datos), merge: !!(opc && (opc.merge || opc.mergeFields)) }]);
    return o_set.apply(this, arguments);
  };
  DR.update = function (a) {
    var r = deRef(this);
    if (r) { var d = a; if (typeof a === 'string' || (a && a.constructor && a.constructor.name === 'FieldPath')) { d = {}; for (var i = 0; i + 1 < arguments.length; i += 2) d[String(arguments[i])] = arguments[i + 1]; }
      enviar([{ col: r.col, id: r.id, op: 'update', datos: limpio(d) }]); }
    return o_update.apply(this, arguments);
  };
  DR.delete = function () { var r = deRef(this); if (r) enviar([{ col: r.col, id: r.id, op: 'delete' }]); return o_delete.apply(this, arguments); };
  /* add = doc() nuevo + set: mismo id en Firestore y en Supabase */
  CR.add = function (datos) {
    try { if (deRef(this.doc('x'))) { var ref = this.doc(); return ref.set(datos).then(function () { return ref; }); } } catch (e) {}
    return o_add.apply(this, arguments);
  };
  if (WB) {
    var b_set = WB.set, b_update = WB.update, b_delete = WB.delete, b_commit = WB.commit;
    WB.set = function (ref, datos, opc) { var r = deRef(ref); if (r) (this._etiOps = this._etiOps || []).push({ col: r.col, id: r.id, op: 'set', datos: limpio(datos), merge: !!(opc && (opc.merge || opc.mergeFields)) }); return b_set.apply(this, arguments); };
    WB.update = function (ref, datos) { var r = deRef(ref); if (r && datos && typeof datos === 'object') (this._etiOps = this._etiOps || []).push({ col: r.col, id: r.id, op: 'update', datos: limpio(datos) }); return b_update.apply(this, arguments); };
    WB.delete = function (ref) { var r = deRef(ref); if (r) (this._etiOps = this._etiOps || []).push({ col: r.col, id: r.id, op: 'delete' }); return b_delete.apply(this, arguments); };
    WB.commit = function () { var ops = this._etiOps || []; this._etiOps = []; var p = b_commit.apply(this, arguments); if (ops.length) p.then(function () { enviar(ops); }, function () {}); return p; };
  }

  /* ── herramientas del administrador ── */
  function canon(v) { if (Array.isArray(v)) return v.map(canon); if (v && typeof v === 'object') { var o = {}; Object.keys(v).sort().forEach(function (k) { o[k] = canon(v[k]); }); return o; } return v; }
  function db() { return firebase.app().firestore(); }
  async function copiarTodo(soloCols) {
    if (!token()) throw new Error('Inicia sesion como administrador');
    var res = {};
    for (var c of (soloCols || COLS)) {
      var snap = await db().collection(c).get(), docs = snap.docs.map(function (d) { return { id: d.id, datos: limpio(d.data()) }; });
      var n = 0; for (var i = 0; i < docs.length; i += 300) { var j = await post('importar', { col: c, docs: docs.slice(i, i + 300) }); n += j.importados; }
      res[c] = docs.length + ' en Firestore -> ' + n + ' copiados'; console.log('[ETI -> Supabase] ' + c + ': ' + res[c]);
    }
    console.table(res); return res;
  }
  async function verificar(soloCols) {
    var res = {};
    for (var c of (soloCols || COLS)) {
      var fs = await db().collection(c).get(), sb = (await post('consultar', { col: c, limite: 20000 })).docs;
      var m = {}; sb.forEach(function (d) { m[d.id] = JSON.stringify(canon(d.datos)); });
      var faltan = 0, distintos = 0, ejemplo = '';
      fs.docs.forEach(function (d) { var x = m[d.id]; if (x === undefined) { faltan++; ejemplo = ejemplo || d.id; } else if (x !== JSON.stringify(canon(limpio(d.data())))) { distintos++; ejemplo = ejemplo || d.id; } });
      res[c] = { firestore: fs.size, supabase: sb.length, faltan: faltan, distintos: distintos, ejemplo: ejemplo };
    }
    console.table(res); return res;
  }
  window.etiSupabase = {
    copiarTodo: copiarTodo, verificar: verificar,
    estado: function () { var e = { activo: activo, enCola: cola().length, ultimoError: ultimoError }; console.log(e); return e; }
  };
})();
