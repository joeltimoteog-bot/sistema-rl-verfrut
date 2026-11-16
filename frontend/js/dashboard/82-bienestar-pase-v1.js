/* ═══════════════════════════════════════════════════════════════════════════
   82-bienestar-pase-v1.js — _BS_PASE_FRESCO_V1 (10-nov-2026) · V2 (15-nov-2026): entrada inmediata, sin esperar a Google
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
      /* _BS_PASE_FRESCO_V2 (15-nov-2026): ya NO se espera a Google (3-8 s, a veces sin respuesta: por eso Bienestar
         mandaba al login). Se entra AL INSTANTE con la sesion del RR.LL.; el portal de Bienestar (bs-sesion-rl.js) lee
         los permisos de Supabase y renueva el token de Google en segundo plano. */
      try {
        var U = window.USER || {}, prev = guardada() || {};
        localStorage.setItem('bienestarSocialAuth', JSON.stringify({ usuario: u, nombre: U.nombre || u, rol: U.rol || '', sector: U.sector || '', empresa: U.empresa || '',
          permisos: (String(prev.usuario || '').toLowerCase() === u && prev.permisos) ? prev.permisos : {},
          token: (String(prev.usuario || '').toLowerCase() === u && prev.token) ? prev.token : '', rl_token: tk,
          loginAt: (String(prev.usuario || '').toLowerCase() === u && prev.loginAt) ? prev.loginAt : new Date(0).toISOString(), source: 'sistema-rl-verfrut' }));
      } catch (e) {}
      window.location.href = PORTAL;
    };
    nuevo._bsPase = true; window._irBienestar = nuevo; return true;
  }
  var n = 0, t = setInterval(function () { if (enganchar() || ++n > 40) clearInterval(t); }, 500);
  enganchar();
})();
