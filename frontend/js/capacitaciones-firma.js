/* ═══════════════════════════════════════════════════════════════════════════
   _CAP_FIRMA_DIGITAL_V1 (16-oct-2026) — firma digital con el fotocheck + DNIs en lote
   ---------------------------------------------------------------------------
   Capa ADITIVA sobre capacitaciones.js (el registro, el guardado y el formato R-SC-01
   siguen igual; solo se agrega):
     · Interruptor "✍️ Firma digital" (se recuerda por usuario). Cada fotocheck ESCANEADO queda
       firmado con el código de trabajador de la base (columna "codigo de trabajador"), fecha/hora
       y método (QR). Para Excel, lote y DNI manual se pregunta antes si llevan firma digital.
     · Botón "📋 Agregar DNIs en lote": pega 50-200 DNIs, los busca de 4 en 4 y los agrega.
     · Columna "Firma" en la lista de asistentes.
     · En el formato, la celda FIRMA / HUELLA imprime "FIRMADO DIGITALMENTE / Cód. ... / fecha · QR"
       (misma estructura y anchos del R-SC-01). Quien no tiene firma digital conserva la celda en blanco.
     · Las firmas se guardan en Azure (tabla nueva Cap_Firmas) al guardar la capacitación y se vuelven
       a leer al regenerar el formato desde Registros. Respaldo local si Azure no responde.
   Para desactivar: quitar el <script src=".../capacitaciones-firma.js">.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window._CAP_FIRMA_DIGITAL_V1) return;
  window._CAP_FIRMA_DIGITAL_V1 = true;

  var AZ = 'https://rl-functions-verfrut-c0ctfjc0cjf5f0hz.brazilsouth-01.azurewebsites.net/api/cap-firmas/';
  var MAX_LOTE = 200, PARALELO = 4;
  function $(id) { return document.getElementById(id); }
  function lista() { try { return Array.isArray(asistentes) ? asistentes : []; } catch (e) { return []; } }   /* 'asistentes' es let global de capacitaciones.js */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function usr() { try { return (typeof USER !== 'undefined' && USER && USER.usuario) ? USER : JSON.parse(sessionStorage.getItem('user') || 'null'); } catch (e) { return null; } }
  function tk() { try { return sessionStorage.getItem('rl_token') || ''; } catch (e) { return ''; } }
  function ahoraTxt(iso) { var d = iso ? new Date(iso) : new Date(); if (isNaN(d)) d = new Date(); var p = function (n) { return ('0' + n).slice(-2); }; return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); }
  function toast(m, t) { try { if (typeof mostrarFeedback === 'function') mostrarFeedback(t === 'error' ? 'err' : t === 'warn' ? 'dup' : 'ok', m); else if (typeof mostrarToast === 'function') mostrarToast(m, t); } catch (e) {} }
  async function pregunta(msg) { try { if (typeof appConfirm === 'function') return await appConfirm(msg); } catch (e) {} return confirm(msg); }

  /* ── estado ── */
  var KEY = 'rl_cap_firma_' + ((usr() || {}).usuario || '');
  var firmaOn = true; try { firmaOn = localStorage.getItem(KEY) !== '0'; } catch (e) {}
  var origen = null;            /* { tipo:'qr'|'excel'|'lote'|'manual', firma:bool, hasta:ms } */
  var manualPreguntado = null;  /* respuesta de la sesion para DNI manual */

  /* ── firma: texto de la celda del formato y etiqueta de la lista ── */
  window._capFirmaCelda = function (p) {
    try {
      var f = p && p.firma; if (!f || !f.digital) return '';
      var cod = String(f.codigo || '').trim();
      return 'FIRMADO DIGITALMENTE\n' + (cod ? 'Cód. fotocheck ' + cod : 'DNI ' + (p.dni || '') + ' (sin cód. en BD)') + '\n' + ahoraTxt(f.fecha) + ' · ' + (f.metodo || 'QR');
    } catch (e) { return ''; }
  };
  window._capFirmaBadge = function (a) {
    try {
      var f = a && a.firma;
      if (!f || !f.digital) return '<span style="font-size:10.5px;font-weight:800;padding:2px 8px;border-radius:999px;background:#f1f5f9;color:#475569" title="Firmará en el formato impreso">Papel</span>';
      var cod = String(f.codigo || '').trim();
      return cod ? '<span style="font-size:10.5px;font-weight:800;padding:2px 8px;border-radius:999px;background:#dcfce7;color:#166534" title="' + esc(ahoraTxt(f.fecha) + ' · ' + (f.metodo || 'QR')) + '">✍️ Digital · cód. ' + esc(cod) + '</span>'
                 : '<span style="font-size:10.5px;font-weight:800;padding:2px 8px;border-radius:999px;background:#fef3c7;color:#92400e" title="Sin código en la base: se firma con el DNI">✍️ Digital · sin código</span>';
    } catch (e) { return ''; }
  };

  /* ── etiquetar cada asistente nuevo segun su origen ── */
  function marcaFirma(t) {
    var tipo = (origen && Date.now() < origen.hasta) ? origen.tipo : 'manual';
    var conFirma = origen && Date.now() < origen.hasta ? !!origen.firma : (firmaOn && manualPreguntado === true);
    if (!conFirma) return null;
    return { digital: true, codigo: String(t.codigo || '').trim(), fecha: new Date().toISOString(), metodo: tipo === 'qr' ? 'QR' : tipo === 'excel' ? 'Excel' : tipo === 'lote' ? 'Lote' : 'Manual' };
  }
  function envolverAgregar() {
    var prev = window.agregarAsistente; if (typeof prev !== 'function' || prev._firma) return;
    var w = function (t) {
      try { if (t && !t.firma) { var f = marcaFirma(t); if (f) t.firma = f; } } catch (e) {}
      var r = prev.apply(this, arguments);
      try { if (t && t.firma && t.firma.digital && !t.firma.codigo) completarCodigo(t.dni); } catch (e) {}
      try { pintarResumen(); } catch (e) {}
      return r;
    };
    w._firma = true; window.agregarAsistente = w; try { agregarAsistente = w; } catch (e) {}
  }
  /* QR: la ventana de origen dura 4 s desde la lectura */
  function envolverQR() {
    var prev = window.procesarQR; if (typeof prev !== 'function' || prev._firma) return;
    var w = function (texto) {
      try { sessionStorage.setItem('rl_cap_ultimo_qr', String(texto || '').slice(0, 200)); } catch (e) {}
      origen = { tipo: 'qr', firma: firmaOn, hasta: Date.now() + 4000 };
      return prev.apply(this, arguments);
    };
    w._firma = true; window.procesarQR = w; try { procesarQR = w; } catch (e) {}
  }
  /* DNI manual: se pregunta una vez por sesion */
  function envolverManual() {
    var prev = window.buscarDniManual; if (typeof prev !== 'function' || prev._firma) return;
    var w = async function () {
      if (firmaOn && manualPreguntado === null) manualPreguntado = await pregunta('✍️ Los DNIs que agregues a mano, ¿llevan firma digital (el trabajador está presente con su fotocheck)?\n\nSe recordará durante esta sesión.');
      origen = { tipo: 'manual', firma: firmaOn && manualPreguntado === true, hasta: Date.now() + 15000 };
      return prev.apply(this, arguments);
    };
    w._firma = true; window.buscarDniManual = w; try { buscarDniManual = w; } catch (e) {}
  }
  /* Excel: se pregunta antes de pasar los marcados a la lista */
  function envolverExcel() {
    var prev = window.continuarDesdeExcel; if (typeof prev !== 'function' || prev._firma) return;
    var w = async function () {
      var con = firmaOn ? await pregunta('✍️ ¿Las asistencias de este Excel se registran con FIRMA DIGITAL?\n\nSí = en el formato saldrá "Firmado digitalmente" con el código de cada trabajador.\nNo = la celda de firma queda en blanco para firmar en papel.') : false;
      origen = { tipo: 'excel', firma: con, hasta: Date.now() + 60000 };
      try { return await prev.apply(this, arguments); } finally { origen = null; }
    };
    w._firma = true; window.continuarDesdeExcel = w;
  }
  /* completar el codigo de quien entro sin el (Excel/lote antiguos): busca en Azure, de a uno */
  var _colaCod = [], _codEnCurso = 0;
  function completarCodigo(dni) { _colaCod.push(dni); procCola(); }
  async function procCola() {
    if (_codEnCurso >= 2 || !_colaCod.length) return;
    _codEnCurso++;
    var dni = _colaCod.shift();
    try {
      var r = await buscarTrabajadorAzure(dni);
      var t = (r && r.success && r.data && r.data[0]) || null;
      var a = lista().find(function (x) { return String(x.dni) === String(dni); });
      if (a && a.firma && t && t.codigo) { a.firma.codigo = t.codigo; if (!a.nombre && t.nombre) a.nombre = t.nombre; if (typeof renderLista === 'function') renderLista(); }
    } catch (e) {} finally { _codEnCurso--; procCola(); }
  }

  /* ── guardar firmas en Azure al guardar la capacitacion ── */
  var _ultimoId = null;
  function envolverBuildBody() {
    var prev = window._buildBody; if (typeof prev !== 'function' || prev._firma) return;
    var w = async function () { var r = await prev.apply(this, arguments); try { _ultimoId = r && r.actividad && r.actividad.idCapacitacion; } catch (e) {} return r; };
    w._firma = true; window._buildBody = w; try { _buildBody = w; } catch (e) {}
  }
  function firmasDe(lista) { return (lista || []).filter(function (a) { return a.firma && a.firma.digital; }).map(function (a) { return { dni: String(a.dni), codigo: a.firma.codigo || '', nombre: a.nombre || '', fecha: a.firma.fecha || new Date().toISOString(), metodo: a.firma.metodo || 'QR' }; }); }
  async function post(accion, body) {
    var h = { 'Content-Type': 'application/json' }; if (tk()) h.Authorization = 'Bearer ' + tk();
    var c = (typeof AbortController !== 'undefined') ? new AbortController() : null; var t = setTimeout(function () { try { c && c.abort(); } catch (e) {} }, 12000);
    try { var r = await fetch(AZ + accion, { method: 'POST', headers: h, body: JSON.stringify(body || {}), signal: c ? c.signal : undefined }); clearTimeout(t); return await r.json(); }
    catch (e) { clearTimeout(t); throw e; }
  }
  async function guardarFirmas(id, lista) {
    var firmas = firmasDe(lista); if (!id || !firmas.length) return;
    try { localStorage.setItem('rl_cap_firmas_' + id, JSON.stringify(firmas)); } catch (e) {}
    try {
      var j = await post('guardar', { idCapacitacion: id, firmas: firmas, usuario: (usr() || {}).usuario });
      if (j && j.success) { toast('✍️ ' + j.guardadas + ' firma(s) digital(es) guardada(s)'); try { localStorage.removeItem('rl_cap_firmas_' + id); } catch (e) {} }
      else toast('⚠️ Las firmas quedaron guardadas en este equipo; se reintentará al regenerar', 'warn');
    } catch (e) { toast('⚠️ Azure no respondió: las firmas quedaron guardadas en este equipo', 'warn'); }
  }
  function envolverGuardar() {
    var prev = window.guardarCapacitacion; if (typeof prev !== 'function' || prev._firma) return;
    var w = async function () {
      var copia = lista().slice();
      var ok = await prev.apply(this, arguments);
      if (ok) { try { await guardarFirmas(_ultimoId, copia); } catch (e) {} }
      return ok;
    };
    w._firma = true; window.guardarCapacitacion = w; try { guardarCapacitacion = w; } catch (e) {}
  }
  /* al regenerar desde Registros: leer las firmas guardadas y ponerlas en los asistentes */
  async function cargarFirmas(id) {
    if (!id) return [];
    var local = null; try { local = JSON.parse(localStorage.getItem('rl_cap_firmas_' + id) || 'null'); } catch (e) {}
    try {
      var j = await post('listar', { idCapacitacion: id });
      if (j && j.success && Array.isArray(j.firmas)) {
        if (local && local.length && !j.firmas.length) { try { await post('guardar', { idCapacitacion: id, firmas: local }); } catch (e) {} return local; }   /* reintento del respaldo */
        return j.firmas;
      }
    } catch (e) {}
    return local || [];
  }
  function envolverRegenerar() {
    var prev = window.regenerarFormatoCapacitacion; if (typeof prev !== 'function' || prev._firma) return;
    var w = async function (cap) {
      try {
        var id = cap && (cap.id || cap.idCapacitacion || cap.id_capacitacion);
        if (id && Array.isArray(cap.asistentes)) {
          var firmas = await cargarFirmas(String(id));
          if (firmas.length) {
            var m = {}; firmas.forEach(function (f) { m[String(f.dni)] = f; });
            cap.asistentes.forEach(function (a) { var f = m[String(a.dni)]; if (f) a.firma = { digital: true, codigo: f.codigo || '', fecha: f.fecha || '', metodo: f.metodo || 'QR' }; });
          }
        }
      } catch (e) {}
      return prev.apply(this, arguments);
    };
    w._firma = true; window.regenerarFormatoCapacitacion = w; try { regenerarFormatoCapacitacion = w; } catch (e) {}
  }

  /* ── interfaz: interruptor + boton lote + resumen ── */
  var CSS = '\
#capFirmaSw{display:flex;align-items:center;gap:10px;background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:12px;padding:9px 12px;margin:0 0 10px;cursor:pointer;user-select:none}\
#capFirmaSw.off{background:#f8fafc;border-color:#e2e8f0}\
#capFirmaSw i{width:40px;height:22px;border-radius:999px;background:#16a34a;position:relative;flex:none;transition:background .2s}#capFirmaSw i:after{content:"";position:absolute;right:3px;top:3px;width:16px;height:16px;border-radius:50%;background:#fff;transition:right .2s}\
#capFirmaSw.off i{background:#cbd5e1}#capFirmaSw.off i:after{right:21px}\
#capFirmaSw b{color:#166534;font-size:13px}#capFirmaSw.off b{color:#475569}#capFirmaSw small{display:block;color:#475569;font-weight:500;font-size:11.5px}\
#capLoteBtn{background:#fff;color:#0a2463;border:1.5px solid #c7d2e6;border-radius:9px;padding:8px 12px;font-weight:800;font-size:12.5px;cursor:pointer}\
#capLote{display:none;background:#fff;border:1.5px solid #c7d2e6;border-radius:12px;padding:12px;margin:8px 0 12px}\
#capLote textarea{width:100%;min-height:90px;padding:9px 11px;border:1.5px solid #c7d2e6;border-radius:9px;font:500 13px Barlow,"Segoe UI",sans-serif;resize:vertical}\
#capLote .r{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px}\
#capLote .op{border:1.5px solid #e2e8f0;border-radius:999px;padding:5px 11px;font-size:12px;font-weight:800;cursor:pointer;background:#fff;color:#475569}#capLote .op.on{border-color:#16a34a;background:#dcfce7;color:#166534}\
#capLote .pg{height:8px;background:#eef2f8;border-radius:999px;overflow:hidden;margin-top:8px}#capLote .pg b{display:block;height:100%;width:0;background:linear-gradient(90deg,#0a2463,#2563eb);transition:width .2s}\
#capLote .est{font-size:12px;color:#475569;margin-top:6px;min-height:16px}\
#capFirmaRes{font-size:11.5px;color:#475569;margin:4px 0 0}\
#capCols{display:grid;grid-template-columns:1.1fr 1fr;gap:14px;align-items:start;margin-bottom:14px}\
#capCols>div{background:#fff;border:1px solid #e3e9f3;border-radius:14px;padding:14px}\
#capCols .ct{font-size:13px;font-weight:800;color:#0a2463;margin-bottom:10px;display:flex;align-items:center;gap:8px}\
#capCols .ct .tg{margin-left:auto;font-size:10.5px;font-weight:800;padding:2px 8px;border-radius:999px;background:#dcfce7;color:#166534}\
#capCols #capLote{display:block;border:0;padding:0;margin:0}\
#capCols #qr-reader{max-width:100%}\
#capNovedad{display:flex;gap:10px;align-items:center;background:linear-gradient(90deg,#f0fdf4,#eef4ff);border:1px solid #bbf7d0;border-radius:12px;padding:9px 14px;margin:0 0 12px;font-size:12.5px;color:#0f172a}\
#capNovedad b{color:#166534}#capNovedad small{color:#64748b}\
@media(max-width:900px){#capCols{grid-template-columns:1fr}}';
  function ui() {
    var manual = $('dniManual'); var fila = manual && manual.parentNode; if (!fila || $('capFirmaSw')) return;
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    var sw = document.createElement('div'); sw.id = 'capFirmaSw'; sw.className = firmaOn ? '' : 'off';
    sw.innerHTML = '<i></i><div><b>✍️ Firma digital ' + (firmaOn ? 'activada' : 'desactivada') + '</b><small>Cada fotocheck escaneado queda firmado con el código del trabajador. Para Excel, lote y DNI manual se pregunta antes.</small></div>';
    sw.onclick = function () { firmaOn = !firmaOn; try { localStorage.setItem(KEY, firmaOn ? '1' : '0'); } catch (e) {} sw.className = firmaOn ? '' : 'off'; sw.querySelector('b').textContent = '✍️ Firma digital ' + (firmaOn ? 'activada' : 'desactivada'); manualPreguntado = null; };
    fila.parentNode.insertBefore(sw, fila);
    var b = document.createElement('button'); b.type = 'button'; b.id = 'capLoteBtn'; b.textContent = '📋 DNIs en lote'; b.title = 'Pegar 50-200 DNIs y agregarlos de una vez'; fila.appendChild(b);
    var panel = document.createElement('div'); panel.id = 'capLote';
    panel.innerHTML = '<div style="font-weight:800;color:#0a2463;margin-bottom:6px">📋 Agregar DNIs en lote <span style="font-weight:600;color:#64748b;font-size:11.5px">· hasta ' + MAX_LOTE + ' · pega desde Excel, con comas, espacios o uno por línea</span></div>' +
      '<textarea id="capLoteTxt" placeholder="72651234 45123456 70123987&#10;41234567, 46789012"></textarea>' +
      '<div class="r"><span class="op on" data-f="1">✍️ Con firma digital</span><span class="op" data-f="0">Firma en papel</span><span id="capLoteN" style="margin-left:auto;font-weight:800;color:#0a2463"></span></div>' +
      '<div class="pg"><b id="capLotePg"></b></div><div class="est" id="capLoteEst"></div>' +
      '<div class="r" style="justify-content:flex-end"><button type="button" class="btn btn-gray" id="capLoteCancel">Cancelar</button><button type="button" class="btn btn-primary" id="capLoteOk">➕ Agregar</button></div>';
    fila.parentNode.insertBefore(panel, fila.nextSibling);
    var res = document.createElement('div'); res.id = 'capFirmaRes'; var cont = $('contadorAsist'); if (cont && cont.parentNode && cont.parentNode.parentNode) cont.parentNode.parentNode.insertBefore(res, cont.parentNode.nextSibling);
    b.onclick = function () { panel.style.display = panel.style.display === 'block' ? 'none' : 'block'; if (panel.style.display === 'block') { if (!firmaOn) elegir('0'); $('capLoteTxt').focus(); } };
    $('capLoteCancel').onclick = function () { panel.style.display = 'none'; };
    panel.querySelectorAll('.op').forEach(function (o) { o.onclick = function () { elegir(o.getAttribute('data-f')); }; });
    $('capLoteTxt').addEventListener('input', contar);
    $('capLoteOk').onclick = lote;
    function elegir(f) { panel.querySelectorAll('.op').forEach(function (o) { o.classList.toggle('on', o.getAttribute('data-f') === f); }); }
    /* ── layout en 2 columnas (como la maqueta): izquierda lector QR + firma, derecha DNIs en lote ── */
    try {
      var card = $('qr-reader') && $('qr-reader').closest('.card');
      var qrWrap = $('qr-reader') && $('qr-reader').parentNode, btnsQR = $('btnIniciarQR') && $('btnIniciarQR').parentNode;
      if (card && qrWrap && btnsQR && !$('capCols')) {
        var cols = document.createElement('div'); cols.id = 'capCols';
        var izq = document.createElement('div'); izq.innerHTML = '<div class="ct">📷 Lector QR de fotochecks <span class="tg">⚡ lectura rápida</span></div>';
        var der = document.createElement('div'); der.innerHTML = '<div class="ct">📋 Agregar DNIs en lote <span class="tg" style="background:#dbeafe;color:#1e40af">hasta ' + MAX_LOTE + '</span></div>';
        card.insertBefore(cols, qrWrap);
        cols.appendChild(izq); cols.appendChild(der);
        izq.appendChild(sw); izq.appendChild(qrWrap); izq.appendChild(btnsQR);
        var hr = fila.previousElementSibling; if (hr && hr.tagName === 'HR') hr.remove();
        izq.appendChild(fila);
        panel.style.display = 'block'; panel.querySelector('div').style.display = 'none';   /* el titulo ya esta en la columna */
        der.appendChild(panel);
        b.style.display = 'none';   /* ya no hace falta el boton: el panel esta siempre visible */
        $('capLoteCancel').style.display = 'none';
      }
    } catch (e) { console.warn('[_CAP_FIRMA_DIGITAL_V1] columnas', e); }
    /* ── aviso en el paso 0 para que se vea la novedad desde el inicio ── */
    try {
      var p0 = $('paso0'); if (p0 && !$('capNovedad')) {
        var nov = document.createElement('div'); nov.id = 'capNovedad';
        nov.innerHTML = '<span style="font-size:20px">✍️</span><div><b>Firma digital con fotocheck</b> y <b>carga de DNIs en lote</b> ya están disponibles en el paso <b>2 · Asistentes</b>. <small>Cada QR escaneado queda firmado con el código del trabajador; en el formato R-SC-01 sale "Firmado digitalmente".</small></div>';
        p0.insertBefore(nov, p0.firstChild);
      }
    } catch (e) {}
  }
  function dnisDe(txt) { var out = [], v = {}; (String(txt || '').match(/\d{7,8}/g) || []).forEach(function (d) { if (d.length === 7) d = '0' + d; if (!v[d]) { v[d] = 1; out.push(d); } }); return out; }
  function contar() { var l = dnisDe($('capLoteTxt').value), rep = (String($('capLoteTxt').value).match(/\d{7,8}/g) || []).length - l.length, ya = l.filter(function (d) { return lista().some(function (a) { return String(a.dni) === d; }); }).length; $('capLoteN').textContent = l.length ? l.length + ' DNIs' + (rep ? ' · ' + rep + ' repetidos' : '') + (ya ? ' · ' + ya + ' ya en la lista' : '') : ''; $('capLoteOk').textContent = '➕ Agregar' + (l.length ? ' ' + l.length : ''); }
  var _loteEnCurso = false;
  async function lote() {
    if (_loteEnCurso) return;
    var l = dnisDe($('capLoteTxt').value).filter(function (d) { return !lista().some(function (a) { return String(a.dni) === d; }); });
    if (!l.length) { toast('Pega al menos un DNI nuevo', 'warn'); return; }
    if (l.length > MAX_LOTE) { toast('Máximo ' + MAX_LOTE + ' DNIs por lote', 'warn'); return; }
    var con = $('capLote').querySelector('.op.on').getAttribute('data-f') === '1' && firmaOn;
    var tope = 0; try { tope = _trabajadoresProgramados; } catch (e) {}
    if (tope && lista().length + l.length > tope && !(await pregunta('Con estos ' + l.length + ' DNIs se supera la cantidad programada (' + tope + ').\n\n¿Agregar igual? (la cantidad se ajustará)'))) return;
    _loteEnCurso = true; var btn = $('capLoteOk'); btn.disabled = true;
    var hechos = 0, ok = 0, sin = 0, sig = 0, res = new Array(l.length);
    var pg = $('capLotePg'), est = $('capLoteEst');
    async function obrero() {
      while (sig < l.length) {
        var i = sig++, dni = l[i];
        try { var r = await buscarTrabajadorAzure(dni); res[i] = (r && r.success && r.data && r.data[0]) || null; } catch (e) { res[i] = null; }
        hechos++; if (res[i]) ok++; else sin++;
        pg.style.width = Math.round(hechos / l.length * 100) + '%'; est.textContent = 'Buscando ' + hechos + ' de ' + l.length + '… · ✅ ' + ok + ' encontrados · ⚠️ ' + sin + ' sin datos en BD';
      }
    }
    await Promise.all(Array.from({ length: Math.min(PARALELO, l.length) }, obrero));
    /* agregar en el orden pegado, con el origen "lote" */
    if (tope && lista().length + l.length > tope) { try { _trabajadoresProgramados = lista().length + l.length; if (typeof sv === 'function') sv('cantTrabajadores', String(_trabajadoresProgramados)); } catch (e) {} }
    origen = { tipo: 'lote', firma: con, hasta: Date.now() + 60000 };
    try {
      l.forEach(function (dni, i) { var t = res[i]; window.agregarAsistente(t ? { dni: dni, nombre: t.nombre || '', empresa: t.empresa || '', cargo: t.cargo || '', sexo: t.sexo || '', codigo: t.codigo || '' } : { dni: dni, nombre: '', empresa: (typeof v === 'function' ? v('capEmpresa') : '') || '', cargo: '', sexo: '', codigo: '' }); });
    } finally { origen = null; }
    est.textContent = '✅ Agregados ' + l.length + ' asistentes (' + ok + ' con datos, ' + sin + ' solo con DNI)' + (con ? ' · ✍️ con firma digital' : ' · firma en papel');
    toast('➕ ' + l.length + ' asistentes agregados en lote');
    $('capLoteTxt').value = ''; contar(); pg.style.width = '0'; btn.disabled = false; _loteEnCurso = false;
    try { if (typeof beep === 'function') beep(true); } catch (e) {}
  }
  function pintarResumen() {
    var r = $('capFirmaRes'); if (!r) return; var l = lista(); var dig = l.filter(function (a) { return a.firma && a.firma.digital; }).length, sinCod = l.filter(function (a) { return a.firma && a.firma.digital && !a.firma.codigo; }).length;
    r.textContent = l.length ? ('✍️ ' + dig + ' con firma digital' + (sinCod ? ' (' + sinCod + ' sin código en BD)' : '') + ' · ' + (l.length - dig) + ' firman en papel') : '';
  }

  function iniciar() {
    try { envolverAgregar(); envolverQR(); envolverManual(); envolverExcel(); envolverBuildBody(); envolverGuardar(); envolverRegenerar(); } catch (e) { console.warn('[_CAP_FIRMA_DIGITAL_V1] envolver', e); }
    try { ui(); } catch (e) { console.warn('[_CAP_FIRMA_DIGITAL_V1] ui', e); }
    try { if (typeof renderLista === 'function') { var pr = window.renderLista; if (pr && !pr._firma) { var w = function () { var r = pr.apply(this, arguments); try { pintarResumen(); } catch (e) {} return r; }; w._firma = true; window.renderLista = w; try { renderLista = w; } catch (e) {} } } } catch (e) {}
    console.log('[_CAP_FIRMA_DIGITAL_V1] listo');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
