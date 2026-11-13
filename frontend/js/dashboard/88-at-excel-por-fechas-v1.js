/* ═══════════════════════════════════════════════════════════════════════════
   88-at-excel-por-fechas-v1.js — _AT_EXCEL_FECHAS_V1 (13-nov-2026)
   Boton "📥 Excel por fechas" en Mis Atenciones: descarga TODAS las atenciones de un rango
   de fechas, pedidas completas a Supabase (no depende de lo que este cargado en pantalla).
   ---------------------------------------------------------------------------
   Por que: el boton "📥 Excel" de la lista exporta solo lo que la pantalla tiene cargado
   (hoy / ultimos dias). Para la descarga de cierre de quincena o de mes salia incompleto
   sin avisar.
   Como: pide /atenciones?desde&hasta de 1000 en 1000 (la misma consulta de solo lectura que
   usa el Reporte por rango), y SOLO genera el Excel si el numero de filas recibidas es igual
   al total que informa el servidor y no hay repetidas. Si no cuadra, no descarga nada y avisa.
   Quien lo ve: solo los roles que ya ven todas las atenciones (ROLES_VER_TODO). No amplia permisos.
   Usa las mismas columnas y el mismo generador que el Excel de siempre (COLS_AT_TODAS, exportarExcelGen).
   No guarda ni cambia nada. Funciona tambien con el modulo bloqueado (es solo lectura).
   Apagar en un equipo: localStorage.rl_at_excel_fechas = 'off'.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  try { if (localStorage.getItem('rl_at_excel_fechas') === 'off') return; } catch (e) {}
  if (window._atExcelFechasOk) return; window._atExcelFechasOk = true;
  var MAX_PAG = 40, MAX_DIAS = 366, ID_BTN = 'btnAtExcelFechas', ID_OV = 'atExcelFechasOv';
  var FECHAS = ['fecha_atencion', 'fecha_inicio_doc', 'fecha_termino_doc', 'fecha_inicio_periodo', 'fecha_termino_periodo', 'fecha_registro', 'fecha_creacion'];
  var dos = function (n) { return (n < 10 ? '0' : '') + n; };
  var ymd = function (d) { return d.getFullYear() + '-' + dos(d.getMonth() + 1) + '-' + dos(d.getDate()); };
  var dmy = function (s) { return s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4); };
  function veTodo() {
    try { return typeof ROLES_VER_TODO !== 'undefined' && typeof USER !== 'undefined' && USER && ROLES_VER_TODO.indexOf(USER.rol) >= 0; } catch (e) { return false; }
  }
  function aviso(t, tipo) { try { if (typeof mostrarToast === 'function') return mostrarToast(t, tipo || 'info'); } catch (e) {} try { console.log('[_AT_EXCEL_FECHAS_V1] ' + t); } catch (e2) {} }

  /* valida el rango: devuelve '' si esta bien o el texto del problema */
  function validar(d, h) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !/^\d{4}-\d{2}-\d{2}$/.test(h)) return 'Elige las dos fechas.';
    if (d > h) return 'La fecha "Desde" no puede ser posterior a "Hasta".';
    var dias = Math.round((new Date(h + 'T00:00:00') - new Date(d + 'T00:00:00')) / 86400000) + 1;
    if (dias > MAX_DIAS) return 'El rango maximo es de un año. Descarga en dos partes.';
    return '';
  }
  async function pagina(d, h, pag) {
    var u = AZURE_FN_BASE + '/atenciones?limit=1000&page=' + pag + '&desde=' + encodeURIComponent(d) + '&hasta=' + encodeURIComponent(h);
    try { if (typeof AZURE_FN_KEY_ATLIST !== 'undefined' && AZURE_FN_KEY_ATLIST) u += '&code=' + encodeURIComponent(AZURE_FN_KEY_ATLIST); } catch (e) {}
    var ctl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var to = setTimeout(function () { try { ctl && ctl.abort(); } catch (e) {} }, 30000);
    try {
      var r = await fetch(u, ctl ? { signal: ctl.signal } : undefined);
      if (!r.ok) throw new Error('el servidor respondió ' + r.status);
      var j = await r.json(); if (!j || !j.success || !Array.isArray(j.data)) throw new Error('respuesta sin datos');
      return j;
    } finally { clearTimeout(to); }
  }
  /* trae el rango completo y lo verifica. Devuelve la lista o lanza un error (nunca una lista incompleta) */
  async function traer(d, h, progreso) {
    var j1 = await pagina(d, h, 1), total = Number(j1.total);
    if (!isFinite(total) || total < 0) throw new Error('el servidor no informó el total');
    var pags = Math.ceil(total / 1000);
    if (pags > MAX_PAG) throw new Error('son ' + total + ' atenciones: demasiadas para una sola descarga. Usa un rango más corto.');
    var lista = j1.data.slice();
    for (var p = 2; p <= pags; p++) { if (progreso) progreso(lista.length, total); var jp = await pagina(d, h, p); lista = lista.concat(jp.data); }
    var vistos = {}, rep = 0;
    lista.forEach(function (a) { var k = String(a.id != null ? a.id : (a.anio + '-' + a.nro)); if (vistos[k]) rep++; vistos[k] = 1; });
    if (rep) throw new Error('llegaron ' + rep + ' filas repetidas (alguien registró mientras se descargaba). Vuelve a intentar.');
    if (lista.length !== total) throw new Error('llegaron ' + lista.length + ' de ' + total + ' atenciones. Vuelve a intentar.');
    var fuera = lista.filter(function (a) { var f = String(a.fecha_atencion || '').slice(0, 10); return f < d || f > h; }).length;
    if (fuera) throw new Error(fuera + ' filas quedaron fuera del rango pedido.');
    FECHAS.forEach(function (c) { lista.forEach(function (a) { if (a && a[c]) a[c] = String(a[c]).substring(0, 10); }); });
    return lista;
  }

  function cerrar() { var o = document.getElementById(ID_OV); if (o) o.remove(); }
  function abrir() {
    if (!veTodo()) return aviso('Esta descarga es solo para Coordinación y Administración.', 'error');
    cerrar();
    var hoy = new Date(), ini = ymd(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() <= 15 ? 1 : 16));
    var o = document.createElement('div'); o.id = ID_OV;
    o.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;padding:16px;font-family:inherit';
    o.innerHTML = '<div role="dialog" aria-label="Excel por fechas" style="background:#fff;color:#0f172a;border-radius:14px;max-width:420px;width:100%;padding:20px 22px;box-shadow:0 20px 50px rgba(0,0,0,.3)">' +
      '<div style="font-weight:800;font-size:16px;margin-bottom:4px">📥 Excel por fechas</div>' +
      '<div style="font-size:12.5px;color:#475569;margin-bottom:14px">Descarga todas las atenciones del rango, completas, directo de la base de datos.</div>' +
      '<div style="display:flex;gap:10px;margin-bottom:12px">' +
      '<label style="flex:1;font-size:12px;font-weight:700">Desde<input type="date" id="aefD" style="display:block;width:100%;margin-top:4px;padding:8px;border:1.5px solid #cbd5e1;border-radius:8px;font:inherit"></label>' +
      '<label style="flex:1;font-size:12px;font-weight:700">Hasta<input type="date" id="aefH" style="display:block;width:100%;margin-top:4px;padding:8px;border:1.5px solid #cbd5e1;border-radius:8px;font:inherit"></label></div>' +
      '<div id="aefMsg" style="min-height:18px;font-size:12.5px;font-weight:600;color:#475569;margin-bottom:12px"></div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end">' +
      '<button type="button" id="aefNo" style="padding:9px 14px;border:1px solid #cbd5e1;background:#fff;border-radius:8px;font:inherit;font-weight:700;cursor:pointer">Cerrar</button>' +
      '<button type="button" id="aefSi" style="padding:9px 16px;border:0;background:#1a7f4b;color:#fff;border-radius:8px;font:inherit;font-weight:800;cursor:pointer">Descargar Excel</button></div></div>';
    document.body.appendChild(o);
    var D = o.querySelector('#aefD'), H = o.querySelector('#aefH'), M = o.querySelector('#aefMsg'), SI = o.querySelector('#aefSi');
    D.value = ini; H.value = ymd(hoy);
    var di = function (t, color) { M.textContent = t; M.style.color = color || '#475569'; };
    o.querySelector('#aefNo').onclick = cerrar;
    o.addEventListener('mousedown', function (e) { if (e.target === o && !SI.disabled) cerrar(); });
    SI.onclick = async function () {
      var d = D.value, h = H.value, mal = validar(d, h);
      if (mal) return di(mal, '#b91c1c');
      SI.disabled = true; SI.style.opacity = '.6'; di('Buscando atenciones del ' + dmy(d) + ' al ' + dmy(h) + '…');
      try {
        var lista = await traer(d, h, function (n, t) { di('Descargando… ' + n + ' de ' + t); });
        if (!lista.length) { di('No hay atenciones en ese rango.', '#b45309'); return; }
        lista.sort(function (a, b) { var fa = String(a.fecha_atencion), fb = String(b.fecha_atencion); return fa < fb ? -1 : fa > fb ? 1 : (Number(a.nro) || 0) - (Number(b.nro) || 0); });
        exportarExcelGen(lista, COLS_AT_TODAS, 'Atenciones_' + d + '_a_' + h);
        di('✅ Listo: ' + lista.length + ' atenciones del ' + dmy(d) + ' al ' + dmy(h) + '. Verificado contra la base de datos.', '#15803d');
        try { console.log('[_AT_EXCEL_FECHAS_V1] ' + lista.length + ' atenciones del ' + d + ' al ' + h); } catch (e) {}
      } catch (e) {
        di('No se descargó nada: ' + (e && e.name === 'AbortError' ? 'el servidor tardó demasiado' : (e && e.message) || 'error') + '.', '#b91c1c');
      } finally { SI.disabled = false; SI.style.opacity = '1'; }
    };
  }

  function poner() {
    try {
      if (document.getElementById(ID_BTN) || !veTodo()) return;
      var ref = document.querySelector('#sec-atenciones button[onclick="exportarAtenciones()"]'); if (!ref) return;
      var b = document.createElement('button'); b.type = 'button'; b.id = ID_BTN; b.className = ref.className; b.textContent = '📥 Excel por fechas';
      b.title = 'Descarga todas las atenciones de un rango de fechas (completas, desde la base de datos)';
      b.style.cssText = 'background:#0f5132';
      b.onclick = abrir;
      ref.parentNode.insertBefore(b, ref.nextSibling);
    } catch (e) {}
  }
  /* USER se llena despues del arranque: se intenta varias veces y luego ya no */
  var n = 0, t = setInterval(function () { poner(); if (document.getElementById(ID_BTN) || ++n > 40) clearInterval(t); }, 1500);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', poner); else poner();
  window._atExcelFechas = { abrir: abrir, traer: traer, validar: validar };
  console.log('[_AT_EXCEL_FECHAS_V1] listo');
})();
