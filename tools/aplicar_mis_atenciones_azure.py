"""_AT_SUP_AZURE_V1: Mis Atenciones de supervisores desde Azure (con respaldo en la hoja). Uso: python3 at_sup_azure.py dashboard.html"""
import sys
p=sys.argv[1] if len(sys.argv)>1 else 'frontend/pages/dashboard.html'
s=open(p,encoding='utf-8',newline='').read()
if '_AT_SUP_AZURE_V1' in s:
    print('Ya estaba aplicado. No se cambio nada.'); sys.exit(0)
import shutil; shutil.copy2(p, p+'.bak-24set-antes-atsupazure'); print('Respaldo creado:', p+'.bak-24set-antes-atsupazure')
def rep(a,b):
    global s
    assert s.count(a)==1, ('ANCLA', a[:90], s.count(a)); s=s.replace(a,b)
# 1) cargarAtenciones: supervisor -> Azure antes de la hoja
rep("""  // 2) GAS (fallback de admin o ruta default de supervisor)
  try {
    const _emp = _esAdminAt ? '' : (USER.empresa || '');""",
"""  // 1b) _AT_SUP_AZURE_V1 (24-set): supervisor -> Azure (rapido). Si Azure falla, sigue a la hoja.
  if (!_esAdminAt && typeof window._azAtencionesSup === 'function') {
    try {
      const _t0s = Date.now();
      const _datosS = await window._azAtencionesSup(historial ? 365 : 2);
      if (_datosS) {
        CACHE.atenciones = _datosS;
        atTodas = _datosS.filter(a => a.fecha_atencion === hoy());
        renderAt(atTodas);
        console.log('[cargarAtenciones] Azure (supervisor):', _datosS.length, '| hoy:', atTodas.length, '|', (Date.now() - _t0s) + 'ms');
        return;
      }
    } catch (e) { console.warn('[cargarAtenciones] Azure supervisor error:', e.message, '- fallback a la hoja'); }
  }

  // 2) GAS (fallback de admin o de supervisor)
  try {
    const _emp = _esAdminAt ? '' : (USER.empresa || '');""")
# 2) refrescarAtencionesHoy: supervisor -> Azure
rep("""      if (!frescos || !frescos.length) {
        var _emp = esAdmin ? '' : (USER.empresa || '');""",
"""      if (!esAdmin && typeof window._azAtencionesSup === 'function') {   /* _AT_SUP_AZURE_V1 */
        try { frescos = await window._azAtencionesSup(2, true); } catch (eS) { frescos = null; }
        if (frescos && !frescos.length) return false;   // Azure respondio: no hay nada nuevo, no se molesta a la hoja
      }
      if (!frescos || !frescos.length) {
        var _emp = esAdmin ? '' : (USER.empresa || '');""")
# 3) funcion nueva al final
bloque = r'''<script>
/* ═══════════════════════════════════════════════════════════════════════════
   _AT_SUP_AZURE_V1 (24-set-2026) — "Mis Atenciones" de supervisores desde Azure
   ---------------------------------------------------------------------------
   Antes: los administradores cargaban de Azure (rapido) pero los SUPERVISORES
   cargaban de la hoja de Google (getAtencionesOptimizado), que lee la planilla
   completa y se pone lenta cuando varios la piden a la vez.
   Ahora: dos consultas a Azure EN PARALELO (por nombre de supervisor y por
   usuario del sistema), unidas por N° sin duplicados. Si Azure falla o tarda
   mas de 15 s -> devuelve null y el codigo de siempre usa la hoja.
   Cache de 45 s por pantalla (evita pedir lo mismo en cada refresco).
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
'use strict';
if (window._azAtencionesSup) return;
var cache = {}, enCurso = {};
function hace(d) { var f = new Date(); f.setDate(f.getDate() - (Number(d) || 0)); return f.toISOString().slice(0, 10); }
function url(extra, desde, pag) {
  var u = AZURE_FN_BASE + '/atenciones?limit=1000&page=' + pag + '&desde=' + desde + extra;
  try { if (typeof AZURE_FN_KEY_ATLIST !== 'undefined' && AZURE_FN_KEY_ATLIST) u += '&code=' + encodeURIComponent(AZURE_FN_KEY_ATLIST); } catch (e) {}
  return u;
}
function pedir(u) {
  var c = (typeof AbortController !== 'undefined') ? new AbortController() : null;
  var t = setTimeout(function () { try { c && c.abort(); } catch (e) {} }, 15000);
  return fetch(u, c ? { signal: c.signal } : undefined).then(function (r) {
    clearTimeout(t); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json();
  }, function (e) { clearTimeout(t); throw e; });
}
async function todo(extra, desde) {
  var j = await pedir(url(extra, desde, 1));
  if (!j || !j.success) throw new Error('Azure sin respuesta valida');
  var lista = (j.data || []).slice(), pags = Math.min(12, Math.ceil(Number(j.total || lista.length) / 1000));
  if (pags > 1) {
    var mas = [];
    for (var p = 2; p <= pags; p++) mas.push(pedir(url(extra, desde, p)).catch(function () { return null; }));
    (await Promise.all(mas)).forEach(function (x) { if (x && x.success) lista = lista.concat(x.data || []); });
  }
  return lista;
}
window._azAtencionesSup = async function (dias, sinCache) {
  if (typeof AZURE_FN_BASE === 'undefined' || typeof USER === 'undefined' || !USER || !USER.usuario) return null;
  var desde = hace(dias), k = desde;
  var c = cache[k];
  if (!sinCache && c && (Date.now() - c.t) < 45000) return c.d;
  if (enCurso[k]) return enCurso[k];
  enCurso[k] = (async function () {
    try {
      var nombre = String(USER.nombre || '').trim(), usuario = String(USER.usuario || '').trim();
      var r = await Promise.all([
        nombre ? todo('&supervisor=' + encodeURIComponent(nombre), desde) : Promise.resolve([]),
        todo('&usuario=' + encodeURIComponent(usuario), desde)
      ]);
      var porNro = {}, out = [];
      r[0].concat(r[1]).forEach(function (a) {
        if (!a) return;
        ['fecha_atencion', 'fecha_inicio_periodo', 'fecha_termino_periodo', 'fecha_inicio_doc', 'fecha_termino_doc', 'fecha_registro', 'fecha_creacion']
          .forEach(function (f) { if (a[f]) a[f] = String(a[f]).slice(0, 10); });
        var key = a.nro != null ? 'n' + a.nro : 'i' + a.id;
        if (porNro[key]) return; porNro[key] = 1; out.push(a);
      });
      out.sort(function (a, b) { return String(b.fecha_atencion).localeCompare(String(a.fecha_atencion)) || (Number(b.nro) - Number(a.nro)); });
      cache[k] = { t: Date.now(), d: out };
      return out;
    } catch (e) {
      console.warn('[_AT_SUP_AZURE_V1] Azure no respondio (' + e.message + ') -> se usa la hoja');
      return null;
    } finally { delete enCurso[k]; }
  })();
  return enCurso[k];
};
console.log('[_AT_SUP_AZURE_V1] listo');
})();
</script>
'''
i=s.rfind('\n</body>'); s=s[:i+1]+bloque+s[i+1:]
open(p,'w',encoding='utf-8',newline='').write(s); print('parche aplicado OK')
