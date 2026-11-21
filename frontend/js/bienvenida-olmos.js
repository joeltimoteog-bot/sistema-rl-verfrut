/* ═══════════════════════════════════════════════════════════════════════════
   bienvenida-olmos.js — _BIENV_OLMOS_V1 (20-nov-2026, decision de Joel)
   Ventana de bienvenida para los usuarios de la sede Olmos (empresa OLMOS en Gestion de Usuarios).
   · Sale una sola vez por usuario y equipo (hasta pulsar "Entendido"). Solo presentacion: no guarda ni cambia datos.
   · Espera a que terminen el compromiso de confidencialidad y otros avisos de ingreso.
   · Apagar: localStorage.rl_bienv_olmos = 'off'.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window._rlBienvOlmosOk) return; window._rlBienvOlmosOk = true;
  try { if (localStorage.getItem('rl_bienv_olmos') === 'off') return; } catch (e) {}
  var CONTACTO = 'joel.timoteo@unifrutti.com';
  function usuario() { try { return (typeof USER !== 'undefined' && USER && USER.usuario) ? USER : JSON.parse(sessionStorage.getItem('user') || 'null'); } catch (e) { return null; } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function nombreBonito(n) { return String(n || '').toLowerCase().replace(/(^|\s)(\S)/g, function (m, a, b) { return a + b.toUpperCase(); }).trim(); }
  function ocupado() {   /* otro aviso de ingreso en pantalla: se espera */
    return !!document.querySelector('#segConf, #pwOv, #ncOv, #mcOv, #cumplGate');
  }
  function mostrar(U, clave) {
    if (document.getElementById('boOv')) return;
    var st = document.createElement('style');
    st.textContent = '#boOv{position:fixed;inset:0;background:rgba(15,39,72,.55);display:flex;align-items:center;justify-content:center;z-index:99980;padding:14px}' +
      '#boOv .bo{background:#fff;border-radius:14px;width:min(520px,96vw);box-shadow:0 24px 60px rgba(0,0,0,.3);overflow:hidden;font-family:inherit}' +
      '#boOv .bo-h{background:#0F2748;color:#fff;padding:18px 22px}#boOv .bo-h small{display:block;font-size:11px;letter-spacing:.12em;text-transform:uppercase;opacity:.8;margin-bottom:4px}' +
      '#boOv .bo-h b{font-size:18px;line-height:1.3}#boOv .bo-b{padding:18px 22px;color:#1e293b;font-size:14px;line-height:1.6}#boOv .bo-b p{margin:0 0 12px}' +
      '#boOv .bo-l{font-size:12px;color:#0F2748;font-weight:700;border-top:1px solid #e2e8f0;padding-top:12px;margin-top:4px;text-align:center}' +
      '#boOv .bo-f{padding:0 22px 18px;text-align:right}#boOv button{background:#0F2748;color:#fff;border:none;border-radius:9px;padding:10px 22px;font-weight:700;font-size:13px;cursor:pointer}';
    document.head.appendChild(st);
    var ov = document.createElement('div'); ov.id = 'boOv';
    ov.innerHTML = '<div class="bo" role="dialog" aria-modal="true"><div class="bo-h"><small>Sede Olmos</small><b>Le damos la bienvenida al Sistema RR.LL., ' + esc(nombreBonito(U.nombre || U.usuario)) + '</b></div>' +
      '<div class="bo-b"><p>Su usuario está configurado para la sede <b>Olmos</b>. Los registros que realice quedarán identificados como sede Olmos y podrá consultar la información de esa sede en los módulos que se le han asignado.</p>' +
      '<p>Si tiene alguna duda, sugerencia u observación, o desea proponer una mejora, comuníquese con <b>Joel Timoteo Gonza</b>, creador y administrador del sistema (<a href="mailto:' + CONTACTO + '">' + CONTACTO + '</a>).</p>' +
      '<div class="bo-l">Piura y Olmos, una sola Gestión Humana</div></div>' +
      '<div class="bo-f"><button type="button" id="boOk">Entendido</button></div></div>';
    document.body.appendChild(ov);
    document.getElementById('boOk').onclick = function () { try { localStorage.setItem(clave, new Date().toISOString()); } catch (e) {} try { ov.remove(); } catch (e) {} };
  }
  function intentar(n) {
    var U = usuario();
    if (!U || !U.usuario) { if (n < 20) setTimeout(function () { intentar(n + 1); }, 1500); return; }
    if (String(U.empresa || '').toUpperCase().trim() !== 'OLMOS') return;
    var clave = 'rl_bienv_olmos_' + String(U.usuario).toLowerCase().trim();
    try { if (localStorage.getItem(clave)) return; } catch (e) {}
    if (ocupado()) { if (n < 120) setTimeout(function () { intentar(n + 1); }, 2000); return; }
    mostrar(U, clave);
  }
  var arrancar = function () { setTimeout(function () { intentar(0); }, 3500); };
  if (document.readyState === 'complete') arrancar(); else window.addEventListener('load', arrancar);
  window._rlBienvOlmos = function () { var U = usuario(); if (U) mostrar(U, 'rl_bienv_olmos_' + String(U.usuario).toLowerCase().trim()); };
})();
