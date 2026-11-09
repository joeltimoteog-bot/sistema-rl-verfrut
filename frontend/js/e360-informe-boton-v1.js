/* _E360_INFORME_V1 (08-nov-2026): botón "Informe gerencial" en Evaluación 360° (abre e360-informe.html). Solo presentación. */
(function () {
  'use strict';
  function poner() {
    var pd = document.getElementById('panelDashboard'); if (!pd || document.getElementById('e360InfBtn')) return;
    var b = document.createElement('a'); b.id = 'e360InfBtn'; b.href = 'e360-informe.html';
    b.textContent = '📑 Informe gerencial del mes';
    b.style.cssText = 'display:inline-flex;align-items:center;gap:6px;margin:0 0 12px;background:#0b1e45;color:#fff;text-decoration:none;font-weight:800;font-size:13.5px;border-radius:12px;padding:10px 16px;box-shadow:0 8px 20px -10px rgba(11,30,69,.6)';
    pd.insertBefore(b, pd.firstChild);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(poner, 300); }); else setTimeout(poner, 300);
  try { new MutationObserver(poner).observe(document.body, { childList: true, subtree: true }); } catch (e) {}
})();
