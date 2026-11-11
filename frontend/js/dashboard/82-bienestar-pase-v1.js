/* ═══════════════════════════════════════════════════════════════════════════
   82-bienestar-pase-v1.js — _BS_PASE_FRESCO_V1 (10-nov-2026)
   PROBLEMA: al iniciar sesion en el RR.LL. se pide en segundo plano la sesion de Bienestar Social (tarda ~5 s). Si el
   usuario pasa al panel antes de que llegue, queda guardada la sesion ANTERIOR. "_irBienestar" la usaba tal cual: si ya
   habia vencido (dura 12 h), Bienestar abria y enseguida devolvia al login.
   SOLUCION: al entrar a Bienestar, si la sesion guardada no es de este usuario, no tiene pase o tiene mas de 10 h,
   se pide una nueva con la sesion vigente del RR.LL. (sin clave) y recien entonces se abre. Si algo falla, se usa el
   camino de siempre. No cambia nada mas. Apagar: localStorage.rl_bs_pase = 'off'.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  try { if (localStorage.getItem('rl_bs_pase') === 'off') return; } catch (e) {}
  var GAS_BS = 'https://script.google.com/macros/s/AKfycbyJIUtdpApEc35Jj4ZNP-3ONqGe64J1VhaRvkt87vVUNTgSagrOgOS0T99eIt0-w3Yi/exec';
  var PORTAL = 'https://sistemarrll.com/bienestar-social-verfrut/portal.html';
  var MAX_MS = 10 * 3600 * 1000, pidiendo = false;
  function yo() { try { return String((window.USER && USER.usuario) || '').toLowerCase().trim(); } catch (e) { return ''; } }
  function guardada() { try { return JSON.parse(localStorage.getItem('bienestarSocialAuth') || 'null'); } catch (e) { return null; } }
  function fresca(s, u) {
    if (!s || !s.token || String(s.usuario || '').toLowerCase().trim() !== u) return false;
    var t = Date.parse(s.loginAt || ''); return !!t && (Date.now() - t) < MAX_MS && (Date.now() - t) > -60000;
  }
  function aviso(m) { try { if (typeof mostrarToast === 'function') mostrarToast(m, 'info'); } catch (e) {} }
  function enganchar() {
    var orig = window._irBienestar;
    if (typeof orig !== 'function' || orig._bsPase) return !!(orig && orig._bsPase);
    var nuevo = function () {
      var u = yo(), tk = ''; try { tk = sessionStorage.getItem('rl_token') || ''; } catch (e) {}
      if (!u || !tk || fresca(guardada(), u)) return orig.apply(this, arguments);
      if (pidiendo) return; pidiendo = true;
      aviso('Abriendo Bienestar Social…');
      var ctl = (typeof AbortController === 'function') ? new AbortController() : null;
      var reloj = setTimeout(function () { if (ctl) { try { ctl.abort(); } catch (e) {} } }, 15000);
      var self = this, args = arguments;
      fetch(GAS_BS, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, signal: ctl ? ctl.signal : undefined,
        body: JSON.stringify({ action: 'bs_login', usuario: u, password: '', rl_token: tk }) })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          clearTimeout(reloj); pidiendo = false;
          if (d && d.ok && d.user && d.user.token) {
            localStorage.setItem('bienestarSocialAuth', JSON.stringify({ usuario: d.user.usuario, nombre: d.user.nombre, rol: d.user.rol, permisos: d.user.permisos,
              token: d.user.token, rl_token: tk, loginAt: new Date().toISOString(), source: 'sistema-rl-verfrut' }));
            window.location.href = PORTAL; return;
          }
          /* sin acceso a Bienestar (o respuesta inesperada): el camino de siempre decide y muestra su mensaje */
          if (d && d.ok === false && d.message && /acceso/i.test(d.message)) { try { if (typeof appAlert === 'function') { appAlert(d.message); return; } } catch (e) {} }
          orig.apply(self, args);
        })
        .catch(function () { clearTimeout(reloj); pidiendo = false; orig.apply(self, args); });
    };
    nuevo._bsPase = true; window._irBienestar = nuevo; return true;
  }
  var n = 0, t = setInterval(function () { if (enganchar() || ++n > 40) clearInterval(t); }, 500);
  enganchar();
})();
