/* ═══════════════════════════════════════════════════════════════════════════
   _COBERTURAS_LECTOR_V1 (18-oct-2026) — Reemplazos vigentes, leídos por Evaluaciones ETI y Capacitaciones ETI
   ---------------------------------------------------------------------------
   Origen: Sistema RR.LL. › Gestión de usuarios › 🔄 Ausencia (copia mínima en Firestore config_eti/coberturas,
   la publica coberturas-eti.js). Este archivo SOLO LEE y ofrece:
     ETICob.listo            → promesa (lista cargada)
     ETICob.lista            → [{id,titular,titular_nombre,tipo,desde,hasta,reemplazo,reemplazo_nombre}]
     ETICob.deTitular(x, f)  → cobertura vigente el día f (aaaa-mm-dd) para el titular x (login o nombre)
     ETICob.deReemplazo(x, f)→ cobertura que x (login o nombre) está cubriendo el día f
     ETICob.mismo(a, b)      → ¿mismo usuario? (login exacto o nombre parecido: 2+ palabras en común)
     ETICob.texto(c)         → "en reemplazo de Yhanell Luzón Venegas (descanso médico, 06/10/2026 al 31/10/2026)"
     ETICob.vigentes(f)      → coberturas vigentes ese día
   Se refresca cada 10 minutos. Si no hay datos, todo responde null / [] y nada cambia.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.ETICob) return;
  var URL_DOC = 'https://firestore.googleapis.com/v1/projects/sistema-eti-verfrut/databases/(default)/documents/config_eti/coberturas?key=AIzaSyAv-1VcbT8VCerClNAeVtVXzOxhSffeDpc';
  var TIPO = { 'VACACIONES': 'vacaciones', 'DESCANSO MEDICO': 'descanso médico', 'ACCIDENTE': 'accidente', 'LICENCIA': 'licencia', 'OTRO': 'ausencia' };
  function N(s) { return String(s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function mismo(a, b) {
    var x = N(a), y = N(b); if (!x || !y) return false; if (x === y) return true;
    if (x.indexOf(' ') < 0 || y.indexOf(' ') < 0) return false;   /* un login solo coincide exacto */
    var A = x.split(' ').filter(function (w) { return w.length > 2; }), B = y.split(' ').filter(function (w) { return w.length > 2; });
    var ig = function (p, q) { return p === q || (p.length >= 4 && q.length >= 4 && (p.indexOf(q) === 0 || q.indexOf(p) === 0)); };
    return A.filter(function (w) { return B.some(function (v) { return ig(w, v); }); }).length >= 2;
  }
  function titulo(s) { return String(s || '').toLowerCase().replace(/(^|\s)\S/g, function (c) { return c.toUpperCase(); }); }
  function dmy(s) { return s ? s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4) : ''; }
  function vig(c, f) { return !!c && !!f && c.desde <= f && (!c.hasta || f <= c.hasta); }
  function hoy() { try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date()); } catch (e) { return new Date().toISOString().slice(0, 10); } }
  var C = { lista: [], cargadoEn: 0, actualizado: '', fuente: '' };
  /* _COBERTURAS_SUPABASE_V1 (27-nov-2026): se lee de Supabase (eti.config_eti, documento "coberturas": lectura sin sesion,
     igual que antes en Firestore). Si Supabase no responde o no tiene el documento, se lee de Firestore como antes.
     Volver a Firestore sin publicar nada: localStorage.eti_cob_fuente = 'firestore' y recargar. */
  var URL_SB = 'https://exdjzbfinppzatjyimxn.supabase.co/functions/v1/api/eti/doc?forceFunctionRegion=sa-east-1';
  function soloFs() { try { return localStorage.getItem('eti_cob_fuente') === 'firestore'; } catch (e) { return false; } }
  function deSupabase() {
    if (soloFs()) return Promise.resolve(null);
    var ctl = null, t = null; try { ctl = new AbortController(); t = setTimeout(function () { try { ctl.abort(); } catch (e) {} }, 8000); } catch (e) {}
    return fetch(URL_SB, { method: 'POST', cache: 'no-store', signal: ctl ? ctl.signal : undefined, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ col: 'config_eti', id: 'coberturas' }) })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { if (t) clearTimeout(t); if (!j || !j.success || !j.existe || !j.datos || typeof j.datos.json !== 'string') return null; return { json: j.datos.json, actualizado: j.datos.actualizado || '' }; })
      .catch(function () { if (t) clearTimeout(t); return null; });
  }
  function deFirestore() {
    return fetch(URL_DOC, { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (!j) return null;
      return { json: (j.fields && j.fields.json && j.fields.json.stringValue) || '', actualizado: (j.fields && j.fields.actualizado && j.fields.actualizado.stringValue) || '' };
    }).catch(function () { return null; });
  }
  function cargar() {
    return deSupabase().then(function (d) { if (d) { d.fuente = 'supabase'; return d; } return deFirestore().then(function (f) { if (f) f.fuente = 'firestore'; return f; }); }).then(function (d) {
      if (!d) return C.lista;   /* ninguna fuente respondio: se conserva lo que ya habia */
      var l = []; try { l = d.json ? JSON.parse(d.json) : []; } catch (e) { l = []; }
      C.lista = Array.isArray(l) ? l : []; C.cargadoEn = Date.now(); C.actualizado = d.actualizado || ''; C.fuente = d.fuente;
      try { window.dispatchEvent(new CustomEvent('eti-coberturas', { detail: C.lista })); } catch (e) {}
      return C.lista;
    }).catch(function () { return C.lista; });
  }
  var listo = cargar();
  setInterval(function () { if (!document.hidden) cargar(); }, 10 * 60 * 1000);
  function deTitular(x, f) { f = f || hoy(); return C.lista.find(function (c) { return vig(c, f) && (mismo(x, c.titular) || mismo(x, c.titular_nombre)); }) || null; }
  function deReemplazo(x, f) { f = f || hoy(); return C.lista.find(function (c) { return vig(c, f) && (mismo(x, c.reemplazo) || mismo(x, c.reemplazo_nombre)); }) || null; }
  function texto(c) { if (!c) return ''; return 'en reemplazo de ' + titulo(c.titular_nombre || c.titular) + ' (' + (TIPO[c.tipo] || 'ausencia') + ', ' + dmy(c.desde) + ' al ' + (c.hasta ? dmy(c.hasta) : 'sin fecha fin') + ')'; }
  window.ETICob = {
    get lista() { return C.lista; }, get actualizado() { return C.actualizado; }, get fuente() { return C.fuente; },
    listo: listo, recargar: cargar, deTitular: deTitular, deReemplazo: deReemplazo, mismo: mismo, texto: texto, titulo: titulo, dmy: dmy,
    tipoTxt: function (t) { return TIPO[t] || 'ausencia'; }, hoy: hoy,
    vigentes: function (f) { f = f || hoy(); return C.lista.filter(function (c) { return vig(c, f); }); }
  };
})();
