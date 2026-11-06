/* ═══════════════════════════════════════════════════════════════════════════
   eti-supabase.js — _ETI_SUPABASE_V1 (05-nov-2026) — ETAPA 1: ESPEJO  (+ V2: lecturas, ver mas abajo)
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
    return fetch(API + accion + '?forceFunctionRegion=sa-east-1', {   /* _EDGE_REGION_V1: servidor en Sao Paulo, junto a la base */
       method: 'POST', headers: h, body: JSON.stringify(cuerpo) }).then(function (r) {
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
  var pend = {};   /* _ETI_SUPABASE_V2: escrituras del espejo en camino, por coleccion */
  function marcar(ops, d) { ops.forEach(function (o) { pend[o.col] = Math.max(0, (pend[o.col] || 0) + d); }); }
  function enviar(ops) {
    if (!activo || !ops.length) return;
    ops.forEach(function (o) { o.origen = 'espejo'; });
    marcar(ops, 1);
    post('escribir', { ops: ops }).then(function () { marcar(ops, -1); }, function (e) {
      marcar(ops, -1);
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

  /* ═══════════════════════════════════════════════════════════════════════════
     _ETI_SUPABASE_V2 (05-nov-2026) — ETAPA 2: LECTURAS DESDE SUPABASE
     Las consultas de una sola vez (.get()) de Evaluacion ETI se responden desde Supabase.
     Protecciones para no mostrar datos incompletos:
       1) solo colecciones que escribe Evaluacion ETI (las de Capacitaciones siguen en Firestore);
       2) si hay escrituras del espejo en camino o en cola para esa coleccion -> Firestore;
       3) Supabase y Firestore se consultan a la vez y gana el primero (V3);
       4) si Supabase falla -> Firestore, como antes;
       5) verificacion en sombra: cada respuesta se compara despues con Firestore; si difiere,
          Supabase se repara con el dato de Firestore y esa coleccion vuelve a leerse de Firestore
          durante la sesion.
     Las escuchas en vivo (onSnapshot) y la pagina QR (evaluar.html) siguen leyendo de Firestore.
     Apagar solo las lecturas: localStorage.eti_supabase_lectura = 'off'
     ═══════════════════════════════════════════════════════════════════════════ */
  var COLS_LECTURA = ['respuestas_qr', 'evaluaciones_conocimiento', 'config_eti', 'sesiones_qr', 'programaciones_eval',
    'informes_enviados', 'evaluaciones_depuradas', 'banco_historial'];
  var lecturaOn = activo && !/evaluar\.html/i.test(location.pathname);
  try { if (localStorage.getItem('eti_supabase_lectura') === 'off') lecturaOn = false; } catch (e) {}
  var est = { supabase: 0, firestore: 0, sombraOk: 0, sombraDif: 0, reparados: 0, ms: [] };
  var apagadas = {}; try { apagadas = JSON.parse(sessionStorage.getItem('eti_sb_apagadas') || '{}'); } catch (e) {}
  function apagar(col, motivo) { apagadas[col] = motivo; try { sessionStorage.setItem('eti_sb_apagadas', JSON.stringify(apagadas)); } catch (e) {} }
  function puedeLeer(col) {
    return lecturaOn && !!token() && navigator.onLine && COLS_LECTURA.indexOf(col) >= 0 && !apagadas[col] && !(pend[col] > 0)
      && !cola().some(function (o) { return o.col === col; });
  }
  function campoDe(o, p) { return String(p).split('.').reduce(function (x, k) { return x == null ? undefined : x[k]; }, o); }
  function rango(v) { return v == null ? 0 : typeof v === 'boolean' ? 1 : typeof v === 'number' ? 2 : typeof v === 'string' ? 4 : Array.isArray(v) ? 8 : 9; }
  function cmp(a, b) { var ra = rango(a), rb = rango(b); if (ra !== rb) return ra - rb; if (ra === 1 || ra === 2 || ra === 4) return a < b ? -1 : a > b ? 1 : 0; return 0; }
  /* mismo orden que Firestore: campo de orderBy (o el del filtro de rango) y luego el id */
  function ordenar(m, docs) {
    var campo = m.orden ? m.orden[0] : null, dir = m.orden && m.orden[1] === 'desc' ? -1 : 1;
    if (!campo) m.filtros.forEach(function (f) { if (!campo && ['>=', '<=', '<', '>'].indexOf(f[1]) >= 0) campo = f[0]; });
    return docs.slice().sort(function (x, y) {
      var c = campo ? cmp(campoDe(x.datos, campo), campoDe(y.datos, campo)) : 0;
      if (!c) c = x.id < y.id ? -1 : x.id > y.id ? 1 : 0;
      return c * dir;
    });
  }
  function docSnap(ref, id, datos) {
    return { id: id, ref: ref, exists: datos != null, metadata: { fromCache: false, hasPendingWrites: false, fuente: 'supabase' },
      data: function () { return datos == null ? undefined : JSON.parse(JSON.stringify(datos)); },
      get: function (p) { var v = datos == null ? undefined : campoDe(datos, p); return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); } };
  }
  function querySnap(q, col, filas) {
    var fs = q.firestore, docs = filas.map(function (r) { return docSnap(fs.collection(col).doc(r.id), r.id, r.datos); });
    return { docs: docs, size: docs.length, empty: !docs.length, query: q, metadata: { fromCache: false, hasPendingWrites: false, fuente: 'supabase' },
      forEach: function (cb, t) { docs.forEach(cb, t); },
      docChanges: function () { return docs.map(function (d, i) { return { type: 'added', doc: d, oldIndex: -1, newIndex: i }; }); } };
  }
  /* _ETI_SUPABASE_V3 (05-nov): Supabase y Firestore se consultan A LA VEZ y se muestra la primera respuesta valida
     (nunca mas lento que antes). Cuando llegan las dos, se comparan (verificacion en sombra) sin lecturas extra. */
  function carrera(promSb, fsFn, armar, sombra) {
    var t0 = Date.now();
    return new Promise(function (ok, mal) {
      var listo = false, rSb = null, sFs = null, sbMal = false, fsMal = null, comparado = false;
      function comparar() { if (comparado || !rSb || !sFs) return; comparado = true; try { sombra(rSb, sFs); } catch (e) {} }
      var fsP = fsFn();
      fsP.then(function (s) {
        sFs = s;
        if (!listo) { listo = true; est.firestore++; ok(s); }
        comparar();
      }, function (e) { fsMal = e; if (!listo && sbMal) { listo = true; mal(e); } });
      promSb.then(function (r) {
        var snap; try { snap = armar(r); } catch (e) { sbMal = true; ultimoError = 'lectura: ' + e.message; if (!listo && fsMal) { listo = true; mal(fsMal); } return; }
        rSb = r; est.ms.push(Date.now() - t0); if (est.ms.length > 50) est.ms.shift();
        if (!listo) { listo = true; est.supabase++; ok(snap); }
        comparar();
      }, function (e) {
        sbMal = true; ultimoError = 'lectura: ' + e.message;
        if (!listo && fsMal) { listo = true; mal(fsMal); }
      });
    });
  }
  function huella(id, datos) { return id + '=' + JSON.stringify(canon(limpio(datos))); }
  function reparar(col, fsDocs, idsSobran) {
    var ops = fsDocs.map(function (d) { return { col: col, id: d.id, op: 'set', datos: limpio(d.data()), merge: false, origen: 'reparacion' }; });
    var revisar = idsSobran.map(function (id) { return o_dget.call(db().collection(col).doc(id)).then(function (s) {
      if (s.exists) ops.push({ col: col, id: id, op: 'set', datos: limpio(s.data()), merge: false, origen: 'reparacion' });
      else ops.push({ col: col, id: id, op: 'delete', origen: 'reparacion' });
    }, function () {}); });
    Promise.all(revisar).then(function () { if (ops.length) post('escribir', { ops: ops }).then(function () { est.reparados += ops.length; }, function (e) { ultimoError = 'reparacion: ' + e.message; }); });
  }
  function diferencia(col, detalle) {
    est.sombraDif++; apagar(col, detalle);
    try { console.warn('[_ETI_SUPABASE_V2] ' + col + ' no coincidio con Firestore (' + detalle + '); se repara y esta sesion lee de Firestore'); } catch (e) {}
  }

  /* registrar los filtros de cada consulta (where / orderBy / limit) */
  var QP = firebase.firestore.Query && firebase.firestore.Query.prototype, META = new WeakMap(), o_dget = DR.get, o_qget = QP && QP.get;
  function metaDe(q) {
    var m = META.get(q); if (m) return m;
    try { if (q instanceof firebase.firestore.CollectionReference && q.firestore.app.options.projectId === PROYECTO && String(q.path).split('/').length === 1)
      return { col: String(q.path), filtros: [], orden: null, limite: null, ok: true }; } catch (e) {}
    return { ok: false };
  }
  function valorOk(v) { if (v === null || typeof v === 'string' || typeof v === 'boolean') return true; if (typeof v === 'number') return isFinite(v); if (Array.isArray(v)) return v.every(valorOk); return false; }
  function copiaM(m) { return { col: m.col, filtros: m.filtros.slice(), orden: m.orden, limite: m.limite, ok: true }; }
  function enganchar(nombre, fn) {
    if (!QP || typeof QP[nombre] !== 'function') return;
    var orig = QP[nombre];
    QP[nombre] = function () {
      var r = orig.apply(this, arguments);
      try { var m = metaDe(this); if (r && typeof r === 'object') META.set(r, m.ok ? fn(m, arguments) : { ok: false }); } catch (e) { try { META.set(r, { ok: false }); } catch (x) {} }
      return r;
    };
  }
  if (QP && o_qget) {
    enganchar('where', function (m, a) {
      var n = copiaM(m), campo = a[0], op = a[1], v = a[2];
      if (typeof campo !== 'string' || /^__/.test(campo) || ['==', '>=', '<=', '<', '>', 'in', 'array-contains'].indexOf(op) < 0 || !valorOk(v) || (op === 'in' && !Array.isArray(v))) n.ok = false;
      else n.filtros.push([campo, op, v]);
      return n;
    });
    enganchar('orderBy', function (m, a) { var n = copiaM(m); if (n.orden || typeof a[0] !== 'string' || /^__/.test(a[0])) n.ok = false; else n.orden = [a[0], a[1] === 'desc' ? 'desc' : 'asc']; return n; });
    enganchar('limit', function (m, a) { var n = copiaM(m); n.limite = a[0]; if (!n.orden || !(a[0] > 0)) n.ok = false; return n; });
    ['limitToLast', 'startAt', 'startAfter', 'endAt', 'endBefore', 'withConverter'].forEach(function (k) { enganchar(k, function () { return { ok: false }; }); });

    QP.get = function (opc) {
      var q = this, args = arguments, m = metaDe(q);
      if (!m.ok || (opc && opc.source) || !puedeLeer(m.col)) { est.firestore++; return o_qget.apply(q, args); }
      var sb = post('consultar', { col: m.col, filtros: m.filtros, orden: m.orden, limite: m.limite || 20000 });
      return carrera(sb, function () { return o_qget.apply(q, args); },
        function (j) { var d = j.docs || []; if (!m.limite && d.length >= 20000) throw new Error('demasiados documentos'); j._filas = ordenar(m, d); return querySnap(q, m.col, j._filas); },
        function (j, s) {
          var a = j._filas.map(function (r) { return huella(r.id, r.datos); }), b = s.docs.map(function (d) { return huella(d.id, d.data()); });
          if (a.join('\n') === b.join('\n')) { est.sombraOk++; return; }
          var enSb = {}; j._filas.forEach(function (r) { enSb[r.id] = huella(r.id, r.datos); });
          var enFs = {}; s.docs.forEach(function (d) { enFs[d.id] = 1; });
          diferencia(m.col, 'consulta ' + JSON.stringify(m.filtros).slice(0, 120));
          reparar(m.col, s.docs.filter(function (d) { return enSb[d.id] !== huella(d.id, d.data()); }), j._filas.map(function (r) { return r.id; }).filter(function (id) { return !enFs[id]; }));
        });
    };
  }
  DR.get = function (opc) {
    var ref = this, args = arguments, r = deRef(ref);
    if (!r || (opc && opc.source) || !puedeLeer(r.col)) { est.firestore++; return o_dget.apply(ref, args); }
    return carrera(post('doc', { col: r.col, id: r.id }), function () { return o_dget.apply(ref, args); },
      function (j) { return docSnap(ref, r.id, j.existe ? j.datos : null); },
      function (j, s) {
        var a = j.existe ? huella(r.id, j.datos) : '-', b = s.exists ? huella(r.id, s.data()) : '-';
        if (a === b) { est.sombraOk++; return; }
        diferencia(r.col, 'documento ' + r.id);
        reparar(r.col, s.exists ? [s] : [], s.exists ? [] : [r.id]);
      });
  };
  if (lecturaOn && token()) setTimeout(function () { post('consultar', { col: 'config_eti', limite: 1 }).catch(function () {}); }, 1500);   /* calentar el servidor */

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
    estado: function () {
      var ms = est.ms.slice().sort(function (a, b) { return a - b; });
      var e = { activo: activo, enCola: cola().length, ultimoError: ultimoError,
        lectura: lecturaOn ? 'Supabase' : 'Firestore', leidasSupabase: est.supabase, leidasFirestore: est.firestore,
        msMediana: ms.length ? ms[Math.floor(ms.length / 2)] : null, sombraOk: est.sombraOk, sombraDistintas: est.sombraDif,
        reparados: est.reparados, coleccionesEnFirestore: Object.keys(apagadas) };
      console.log(e); return e;
    }
  };
})();
