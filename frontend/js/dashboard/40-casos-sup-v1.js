/* dashboard.html · bloque 40 (antes en la linea 16164) · extraido el 24-oct-2026 sin cambios (_MODULAR_V1) */

/* ═══════════════════════════════════════════════════════════════════════════
   _CASOS_SUP_V1 (24-set-2026) — Registro de Casos: supervisores desde la hoja
   ---------------------------------------------------------------------------
   Antes la lista "Supervisor *" de Casos estaba escrita fija en el HTML (13
   nombres) y los supervisores nuevos no aparecían. Ahora se completa con la
   MISMA hoja que administras con 👥 Supervisores (BD_Supervisores):
     · se conservan los nombres que ya estaban (no se pierde ninguno);
     · se agregan los supervisores ACTIVOS de la hoja (ej. reemplazos nuevos);
     · los marcados como RETIRADOS pasan a un grupo "Retirados" que no se puede
       elegir en casos nuevos, pero se siguen viendo en los casos antiguos.
   Solo lectura (getSupervisores). No cambia cómo se guarda un caso.
   Para revertir: borrar este bloque.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
'use strict';
if (window._rlCasosSupOk) return; window._rlCasosSupOk = true;
var CK = 'rl_casos_sup_v1', TTL = 10 * 60 * 1000, cargando = null;
function norm(s) { return String(s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim(); }

function lista() {
  try { var c = JSON.parse(sessionStorage.getItem(CK) || 'null'); if (c && (Date.now() - c.ts) < TTL) return Promise.resolve(c.l); } catch (e) {}
  if (cargando) return cargando;
  cargando = Promise.resolve(apiGet({ action: 'getSupervisores' })).then(function (r) {
    var l = (r && r.success && Array.isArray(r.data)) ? r.data.filter(function (x) { return x && x.gestionado && x.nombre; })
              .map(function (x) { return { nombre: String(x.nombre).trim(), activo: x.activo !== false } }) : [];
    if (l.length) { try { sessionStorage.setItem(CK, JSON.stringify({ ts: Date.now(), l: l })); } catch (e) {} }
    return l;
  }).catch(function () { return []; }).then(function (l) { cargando = null; return l; });
  return cargando;
}

function llenar() {
  var sel = document.getElementById('cSupervisor');
  if (!sel) return Promise.resolve();
  return lista().then(function (hoja) {
    if (!hoja.length) return;                                   // hoja sin importar: queda la lista de siempre
    var actual = sel.value;
    var retirados = {}; hoja.forEach(function (s) { if (!s.activo) retirados[norm(s.nombre)] = s.nombre; });
    var nombres = [], vistos = {};
    var agregar = function (n) { var k = norm(n); if (!k || vistos[k] || retirados[k]) return; vistos[k] = 1; nombres.push(n); };
    [].slice.call(sel.options).forEach(function (o) { if (o.value) agregar(o.value); });   // los de siempre
    hoja.forEach(function (s) { if (s.activo) agregar(s.nombre); });                         // activos de la hoja
    nombres.sort(function (a, b) { return a.localeCompare(b, 'es'); });
    var firma = JSON.stringify([nombres, Object.keys(retirados)]);
    if (sel.getAttribute('data-rl-firma') === firma) return;   /* ya está al día: no se redibuja */
    sel.setAttribute('data-rl-firma', firma);
    sel.innerHTML = '<option value="">-- Seleccionar --</option>';
    nombres.forEach(function (n) { var o = document.createElement('option'); o.value = o.textContent = n; sel.appendChild(o); });
    var ret = Object.keys(retirados);
    if (ret.length) {
      var g = document.createElement('optgroup'); g.label = 'Retirados (solo casos antiguos)';
      ret.forEach(function (k) { var o = document.createElement('option'); o.value = o.textContent = retirados[k]; o.disabled = true; g.appendChild(o); });
      sel.appendChild(g);
    }
    if (actual) {                                               // conservar lo elegido / el del caso que se edita
      if (![].slice.call(sel.options).some(function (o) { return o.value === actual; })) {
        var o2 = document.createElement('option'); o2.value = o2.textContent = actual; sel.appendChild(o2);
      }
      sel.value = actual;
    }
  });
}
window._casosSupLlenar = llenar;

/* Se completa al abrir la lista (sin esperar) y una vez al cargar la página */
document.addEventListener('focusin', function (ev) { if (ev.target && ev.target.id === 'cSupervisor') llenar(); }, true);
document.addEventListener('mousedown', function (ev) { if (ev.target && ev.target.id === 'cSupervisor') llenar(); }, true);
setTimeout(function () { try { llenar(); } catch (e) {} }, 4000);
console.log('[_CASOS_SUP_V1] listo');
})();
