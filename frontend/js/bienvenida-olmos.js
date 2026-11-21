/* ═══════════════════════════════════════════════════════════════════════════
   bienvenida-olmos.js — _BIENV_OLMOS_V1 (20-nov-2026, decision de Joel)
   Ventana de bienvenida para los usuarios de la sede Olmos (empresa OLMOS en Gestion de Usuarios).
   · _BIENV_OLMOS_V2 (21-nov-2026): texto ampliado (contexto de la plataforma, modulos, seguridad y autor).
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
      '#boOv .bo{background:#fff;border-radius:14px;width:min(600px,96vw);box-shadow:0 24px 60px rgba(0,0,0,.3);overflow:hidden;font-family:inherit}' +
      '#boOv .bo-h{background:#0F2748;color:#fff;padding:18px 22px}#boOv .bo-h small{display:block;font-size:11px;letter-spacing:.12em;text-transform:uppercase;opacity:.8;margin-bottom:4px}' +
      '#boOv .bo-h b{font-size:18px;line-height:1.3}#boOv .bo-b{padding:18px 22px;color:#1e293b;font-size:14px;line-height:1.6}#boOv .bo-b p{margin:0 0 12px}' +
      '#boOv .bo-l{font-size:12px;color:#0F2748;font-weight:700;border-top:1px solid #e2e8f0;padding-top:12px;margin-top:4px;text-align:center}' +
      '#boOv .bo{max-height:92vh;overflow:auto}#boOv .bo-h i{display:block;font-style:normal;font-size:12px;opacity:.85;margin-top:4px}' +
      '#boOv .bo-g{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0 0 12px}#boOv .bo-m{border:1px solid #e2e8f0;border-left:3px solid #0F2748;border-radius:8px;padding:8px 10px;background:#f8fafc}' +
      '#boOv .bo-m b{display:block;font-size:12.5px;color:#0F2748}#boOv .bo-m span{font-size:11.5px;color:#475569;line-height:1.4;display:block}#boOv .bo-c{font-size:13px;background:#f1f5f9;border-radius:8px;padding:10px 12px}' +
      '@media(max-width:520px){#boOv .bo-g{grid-template-columns:1fr}}' +
      '#boOv .bo-f{padding:0 22px 18px;text-align:right}#boOv button{background:#0F2748;color:#fff;border:none;border-radius:9px;padding:10px 22px;font-weight:700;font-size:13px;cursor:pointer}';
    document.head.appendChild(st);
    var ov = document.createElement('div'); ov.id = 'boOv';
    var mod = function (t, d) { return '<div class="bo-m"><b>' + t + '</b><span>' + d + '</span></div>'; };
    ov.innerHTML = '<div class="bo" role="dialog" aria-modal="true"><div class="bo-h"><small>Unifrutti · Sede Olmos</small><b>Le damos la bienvenida, ' + esc(nombreBonito(U.nombre || U.usuario)) + '</b><i>Sistema RR.LL. · Plataforma de Gestión Humana</i></div>' +
      '<div class="bo-b"><p>Desde hoy la sede <b>Olmos</b> forma parte de la misma plataforma con la que Piura gestiona a su personal. Una sola herramienta, un mismo modelo de trabajo y la misma transparencia para ambas sedes.</p>' +
      '<div class="bo-g">' +
        mod('Relaciones Laborales', 'Atenciones al trabajador, historial por DNI, casos y visitas de campo.') +
        mod('Bienestar Social', 'Quejas, accidentes, descansos médicos, subsidios y gestión social.') +
        mod('Capacitaciones ETI', 'Programación y registro de capacitaciones por sector.') +
        mod('Evaluaciones ETI', 'Evaluación de conocimiento por código QR e indicadores.') +
      '</div>' +
      '<p>Su usuario pertenece a la sede <b>Olmos</b>: lo que registre quedará identificado con su sede, y verá la información de los módulos y el alcance que se le han asignado. La información de los trabajadores es confidencial: su acceso es personal e intransferible.</p>' +
      '<p class="bo-c">Este sistema fue creado y es administrado por <b>Joel A. Timoteo Gonza</b>, Coordinador de Relaciones Laborales. Si tiene una duda, una sugerencia o detecta algo que deba mejorarse, escríbale a <a href="mailto:' + CONTACTO + '">' + CONTACTO + '</a>. Su opinión ayuda a mejorar la plataforma.</p>' +
      '<div class="bo-l">Piura y Olmos, una sola Gestión Humana</div></div>' +
      '<div class="bo-f"><button type="button" id="boOk">Comenzar</button></div></div>';
    document.body.appendChild(ov);
    document.getElementById('boOk').onclick = function () { try { localStorage.setItem(clave, new Date().toISOString()); } catch (e) {} try { ov.remove(); } catch (e) {} };
  }
  function intentar(n) {
    var U = usuario();
    if (!U || !U.usuario) { if (n < 20) setTimeout(function () { intentar(n + 1); }, 1500); return; }
    if (String(U.empresa || '').toUpperCase().trim() !== 'OLMOS') return;
    var clave = 'rl_bienv_olmos2_' + String(U.usuario).toLowerCase().trim();
    try { if (localStorage.getItem(clave)) return; } catch (e) {}
    if (ocupado()) { if (n < 120) setTimeout(function () { intentar(n + 1); }, 2000); return; }
    mostrar(U, clave);
  }
  var arrancar = function () { setTimeout(function () { intentar(0); }, 3500); };
  if (document.readyState === 'complete') arrancar(); else window.addEventListener('load', arrancar);
  window._rlBienvOlmos = function () { var U = usuario(); if (U) mostrar(U, 'rl_bienv_olmos2_' + String(U.usuario).toLowerCase().trim()); };
})();
