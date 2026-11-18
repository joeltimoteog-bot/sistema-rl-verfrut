/* ═══════════════════════════════════════════════════════════════════════════
   _PADRON_EXCEL_V1 (17-nov-2026) — Actualizar el padron de trabajadores DIRECTO desde el Excel
   ---------------------------------------------------------------------------
   Antes: copiar las bases de RAPEL y VERFRUT del Excel "BB.DD_ SISTEMA WEB.xlsm" y pegarlas en las
   hojas de Google; luego Apps Script las subia a Supabase.
   Ahora (solo administradores, pantalla "Trabajadores"):
     · "Elegir archivo": una sola vez; el navegador recuerda el archivo (Chrome / Edge).
     · "Actualizar padron": lee el Excel EN ESTA COMPUTADORA (hojas Trabajadores_RAPEL y
       Trabajadores_VERFRUT, encabezado en la fila de "RutTrabajador"), muestra cuantos trabajadores
       trae cada empresa contra los que hay hoy, y al confirmar envia una empresa por vez a Supabase.
   El servidor usa el MISMO motor seguro de siempre (solo cambia lo distinto, freno si llega menos de la
   mitad, si algo falla no toca nada). Los valores se arman IGUAL que Apps Script (leerHojaTrabajadores).
   Tras la primera carga, la subida automatica desde las hojas de Google queda en pausa.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window._PADRON_EXCEL_V1) return; window._PADRON_EXCEL_V1 = true;

  var HOJAS = { RAPEL: 'Trabajadores_RAPEL', VERFRUT: 'Trabajadores_VERFRUT' };
  var CAMPOS = ['dni', 'ap_paterno', 'ap_materno', 'nombres', 'codigo_trab', 'fecha_inicio', 'sexo', 'oficio', 'tipo_regimen',
    'id_empresa', 'zona_labor', 'direccion', 'total', 'empresa', 'nombre_completo', 'ruta', 'cod', 'fecha_termino', 'fecha_nacimiento'];
  var FECHAS = { fecha_inicio: 1, fecha_termino: 1, fecha_nacimiento: 1 };
  /* comienzo esperado de cada encabezado (columnas A..S); si el Excel cambia el orden, se detiene */
  var ENC = ['rut', 'ap', 'ap', 'nombre', 'codigo', 'fechainicio', 'sexo', 'oficio', 'tipo', 'idempresa', 'zona', 'direccion', 'total',
    'empresa', 'nombre', 'ruta', 'cod', 'fecha', 'fecha'];

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function usuario() { try { return (typeof USER !== 'undefined' && USER) || JSON.parse(sessionStorage.getItem('user') || '{}'); } catch (e) { return {}; } }
  function esAdmin() {
    var u = usuario(), r = String(u.rol || '').toLowerCase().trim();
    return String(u.usuario || '').toLowerCase() === 'jtimoteo' || ['administrador', 'administrador 01', 'administrador 02', 'admin', 'admin01', 'admin02'].indexOf(r) >= 0;
  }
  function base() { return (typeof AZURE_FN_BASE !== 'undefined' && AZURE_FN_BASE) || 'https://rl-fn-verfrut.azurewebsites.net/api'; }
  function api(accion, cuerpo, ms) {
    var tk = ''; try { tk = sessionStorage.getItem('rl_token') || ''; } catch (e) {}
    var c = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var t = setTimeout(function () { try { c && c.abort(); } catch (e) {} }, ms || 30000);
    var op = { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tk }, body: JSON.stringify(cuerpo || {}) };
    if (c) op.signal = c.signal;
    return fetch(base() + '/padron/' + accion, op).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { clearTimeout(t); return { status: r.status, j: j }; });
    }, function (e) { clearTimeout(t); throw e; });
  }
  function n(x) { return Number(x || 0).toLocaleString('es-PE'); }

  /* ── archivo recordado (IndexedDB guarda el "acceso" al archivo, no su contenido) ── */
  function idb(modo, valor) {
    return new Promise(function (ok) {
      try {
        var rq = indexedDB.open('rl-padron-excel', 1);
        rq.onupgradeneeded = function () { rq.result.createObjectStore('h'); };
        rq.onerror = function () { ok(null); };
        rq.onsuccess = function () {
          try {
            var tx = rq.result.transaction('h', modo === 'leer' ? 'readonly' : 'readwrite'), st = tx.objectStore('h');
            var op = modo === 'leer' ? st.get('excel') : (modo === 'borrar' ? st.delete('excel') : st.put(valor, 'excel'));
            op.onsuccess = function () { ok(modo === 'leer' ? op.result || null : true); };
            op.onerror = function () { ok(null); };
          } catch (e) { ok(null); }
        };
      } catch (e) { ok(null); }
    });
  }
  var puedeRecordar = typeof window.showOpenFilePicker === 'function';
  async function elegir() {
    if (!puedeRecordar) return elegirClasico();
    try {
      var hs = await window.showOpenFilePicker({ multiple: false, types: [{ description: 'Excel', accept: { 'application/vnd.ms-excel.sheet.macroEnabled.12': ['.xlsm'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] } }] });
      await idb('guardar', hs[0]); pintarArchivo(hs[0].name); return hs[0];
    } catch (e) { return null; }   /* el usuario cancelo */
  }
  function elegirClasico() {
    return new Promise(function (ok) {
      var i = document.createElement('input'); i.type = 'file'; i.accept = '.xlsm,.xlsx';
      i.onchange = function () { var f = i.files && i.files[0]; if (f) pintarArchivo(f.name); ok(f ? { _archivo: f, name: f.name } : null); };
      i.click();
    });
  }
  async function archivo() {
    var h = puedeRecordar ? await idb('leer') : null;
    if (!h) h = await elegir();
    if (!h) return null;
    if (h._archivo) return h._archivo;
    try {
      var p = await h.queryPermission({ mode: 'read' });
      if (p !== 'granted') p = await h.requestPermission({ mode: 'read' });
      if (p !== 'granted') { aviso('Chrome no dio permiso para leer el archivo. Pulsa de nuevo y elige "Permitir".', 'err'); return null; }
      return await h.getFile();
    } catch (e) {
      aviso('No se pudo abrir el archivo recordado (¿lo movieron o renombraron?). Elígelo de nuevo.', 'err');
      await idb('borrar'); pintarArchivo('');
      return null;
    }
  }

  /* ── lectura del Excel (en un "trabajador" aparte para no congelar la pantalla) ── */
  function leerExcel(buf) {
    var url = location.origin + '/sistema-rl-verfrut/frontend/lib/xlsx.full.min.js';
    var codigo = 'importScripts(' + JSON.stringify(url) + ');(' + procesar.toString() + ')(self);';
    return new Promise(function (ok, mal) {
      var w;
      try { w = new Worker(URL.createObjectURL(new Blob([codigo], { type: 'text/javascript' }))); }
      catch (e) { try { ok(procesarEnPagina(buf)); } catch (e2) { mal(e2); } return; }
      var t = setTimeout(function () { try { w.terminate(); } catch (e) {} mal(new Error('El Excel tardó demasiado en leerse (más de 3 minutos).')); }, 180000);
      w.onmessage = function (ev) { clearTimeout(t); w.terminate(); if (ev.data && ev.data.error) mal(new Error(ev.data.error)); else ok(ev.data); };
      w.onerror = function (ev) { clearTimeout(t); w.terminate(); try { ok(procesarEnPagina(buf)); } catch (e2) { mal(new Error((ev && ev.message) || 'No se pudo leer el Excel')); } };
      w.postMessage({ buf: buf, hojas: HOJAS, campos: CAMPOS, fechas: FECHAS, enc: ENC }, [buf]);
    });
  }
  function procesarEnPagina(buf) {
    var res = null, falso = { postMessage: function (d) { res = d; } };
    procesar(falso, { data: { buf: buf, hojas: HOJAS, campos: CAMPOS, fechas: FECHAS, enc: ENC } });
    if (res && res.error) throw new Error(res.error);
    return res;
  }
  /* corre dentro del "trabajador" (o en la pagina como respaldo): no usa nada de afuera */
  function procesar(ctx, evDirecto) {
    function trabajo(ev) {
      try {
        var d = ev.data, X = (typeof XLSX !== 'undefined') ? XLSX : self.XLSX;
        var nombres = Object.keys(d.hojas).map(function (k) { return d.hojas[k]; });
        var wb = X.read(new Uint8Array(d.buf), { type: 'array', sheets: nombres, dense: true, cellDates: false, cellNF: true, cellFormula: false, cellHTML: false, cellText: false });
        var out = { empresas: {} };
        Object.keys(d.hojas).forEach(function (emp) {
          var ws = wb.Sheets[d.hojas[emp]];
          if (!ws) { out.empresas[emp] = { falta: true }; return; }
          var data = ws['!data'] || (Array.isArray(ws) ? ws : []);   /* SheetJS 0.18 (la del sistema) guarda las filas en la hoja misma */
          var fe = -1;
          for (var r = 0; r < Math.min(data.length, 30); r++) {
            var c0 = data[r] && data[r][0];
            if (c0 && /^\s*rut\s*trabajador\s*$/i.test(String(c0.v))) { fe = r; break; }   /* exacto: arriba hay una tabla dinamica con "Cuenta de RutTrabajador" */
          }
          if (fe < 0) { out.empresas[emp] = { error: 'No encontré la fila de encabezados ("RutTrabajador") en la hoja ' + d.hojas[emp] }; return; }
          var norm = function (s) { return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, ''); };
          for (var k = 0; k < d.enc.length; k++) {
            var h = data[fe][k] ? norm(data[fe][k].v) : '';
            if (h.indexOf(d.enc[k]) !== 0) { out.empresas[emp] = { error: 'En ' + d.hojas[emp] + ' la columna ' + String.fromCharCode(65 + k) + ' dice "' + (data[fe][k] ? data[fe][k].v : '') + '": el orden de columnas cambió. No se envió nada.' }; return; }
          }
          var fecha = function (c) {
            if (!c || c.v == null || c.v === '') return null;
            if (c.t === 'n' && isFinite(c.v) && c.v > 0) {   /* fecha de Excel (numero de serie) -> AAAA-MM-DD */
              var ms = Math.round((c.v - 25569) * 86400000); var dt = new Date(ms); if (isNaN(dt.getTime())) return null;
              return dt.toISOString().slice(0, 10);
            }
            var s = String(c.v).trim(), m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
            if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
            m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return m[1] + '-' + m[2] + '-' + m[3];
            return null;
          };
          var txt = function (c) { if (!c || c.v == null) return null; var s = String(c.v).trim(); return s === '' ? null : s; };
          var filas = [], sinDni = 0, vistos = {}, repetidos = 0;
          for (var i = fe + 1; i < data.length; i++) {
            var row = data[i]; if (!row) continue;
            var o = {};
            for (var j = 0; j < d.campos.length; j++) {
              var cmp = d.campos[j], cel = row[j];
              if (d.fechas[cmp]) o[cmp] = fecha(cel);
              else if (cmp === 'total') { var v = cel && cel.v; var p = parseInt(v, 10); o[cmp] = (v === null || v === undefined || v === '' || isNaN(p)) ? null : p; }
              else o[cmp] = txt(cel);
            }
            if (!o.dni) { if (row.some(function (c) { return c && c.v != null && String(c.v).trim() !== ''; })) sinDni++; continue; }
            if (row[0] && row[0].t === 'n' && /^\d{1,7}$/.test(o.dni)) o.dni = ('00000000' + o.dni).slice(-8);   /* DNI guardado como numero: se le devuelve el cero */
            if (vistos[o.dni]) repetidos++; vistos[o.dni] = 1;
            filas.push(o);
          }
          out.empresas[emp] = { filas: filas, sinDni: sinDni, repetidos: repetidos };
        });
        ctx.postMessage(out);
      } catch (e) { ctx.postMessage({ error: 'No se pudo leer el Excel: ' + (e && e.message ? e.message : e) }); }
    }
    if (evDirecto) trabajo(evDirecto); else ctx.onmessage = trabajo;
  }

  /* ── pantalla ── */
  var ESTADO = null, LEIDO = null, ocupado = false;
  function aviso(t, tipo) {
    var m = $('pxMsg'); if (!m) return;
    m.className = 'px-msg ' + (tipo || ''); m.innerHTML = t || ''; m.style.display = t ? 'block' : 'none';
  }
  function pintarArchivo(nom) { var e = $('pxArchivo'); if (e) e.textContent = nom ? nom : 'ninguno (elígelo la primera vez)'; }
  function pintarEstado() {
    var e = $('pxEstado'); if (!e || !ESTADO) return;
    var f = String(ESTADO.fuente || ''), p = f.split('|');
    var em = (ESTADO.empresas || []).filter(function (x) { return x.existe; }).map(function (x) { return '<b>' + esc(x.empresa) + '</b> ' + n(x.total); }).join(' · ');
    e.innerHTML = 'En el sistema: ' + em + '<br>' + (/^excel/i.test(f)
      ? 'Última carga desde el Excel: <b>' + esc(p[1] || '') + '</b> por ' + esc(p[2] || '')
      : 'Hasta hoy el padrón se subía desde las hojas de Google.');
  }
  function cargarEstado() {
    return api('estado', {}, 20000).then(function (r) {
      if (r.status === 200 && r.j && r.j.ok) { ESTADO = r.j; pintarEstado(); }
      else if ($('pxEstado')) $('pxEstado').textContent = (r.j && r.j.msg) || 'No se pudo consultar el padrón.';
    }).catch(function () { if ($('pxEstado')) $('pxEstado').textContent = 'Sin conexión con el servidor.'; });
  }
  function hoy(emp) { var x = (ESTADO && ESTADO.empresas || []).find(function (e) { return e.empresa === emp; }); return x ? x.total : 0; }

  async function actualizar() {
    if (ocupado) return; ocupado = true; LEIDO = null; $('pxConfirmar').style.display = 'none';
    var b = $('pxActualizar'); b.disabled = true;
    try {
      var f = await archivo(); if (!f) return;
      aviso('📖 Leyendo <b>' + esc(f.name) + '</b> (' + (f.size / 1048576).toFixed(1) + ' MB)… puede tardar unos segundos. Si tienes el Excel abierto, que esté <b>guardado</b>.', 'inf');
      var t0 = Date.now(), res = await leerExcel(await f.arrayBuffer());
      if (res.error) { aviso(esc(res.error), 'err'); return; }
      var filasHtml = [], errores = [], listo = {};
      Object.keys(HOJAS).forEach(function (emp) {
        var e = res.empresas[emp] || {};
        if (e.falta) { errores.push('No encontré la hoja <b>' + HOJAS[emp] + '</b>.'); return; }
        if (e.error) { errores.push(esc(e.error)); return; }
        var antes = hoy(emp), ahora = e.filas.length, dif = ahora - antes;
        var alerta = antes > 100 && ahora < antes * 0.5;
        listo[emp] = e.filas;
        filasHtml.push('<tr><td><b>' + emp + '</b></td><td>' + n(antes) + '</td><td><b>' + n(ahora) + '</b></td><td>' + (dif >= 0 ? '+' : '') + n(dif) + '</td><td>' +
          (alerta ? '<span style="color:#b91c1c;font-weight:700">Menos de la mitad: el servidor no lo aceptará</span>' : (e.repetidos ? n(e.repetidos) + ' DNI repetidos' : 'OK')) + '</td></tr>');
      });
      if (errores.length) { aviso(errores.join('<br>') + '<br>No se envió nada.', 'err'); return; }
      LEIDO = listo;
      aviso('<b>Excel leído en ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s.</b> Revisa y confirma:' +
        '<table class="px-tab"><tr><th>Empresa</th><th>Hoy en el sistema</th><th>En el Excel</th><th>Diferencia</th><th></th></tr>' + filasHtml.join('') + '</table>' +
        'Solo se cambia lo distinto: los nuevos entran, los modificados se actualizan y los que ya no están en el Excel salen del padrón.', 'inf');
      $('pxConfirmar').style.display = '';
    } catch (e) {
      aviso('No se pudo leer el Excel: ' + esc(e && e.message ? e.message : e), 'err');
    } finally { b.disabled = false; ocupado = false; }
  }
  async function confirmar() {
    if (!LEIDO || ocupado) return; ocupado = true;
    var bc = $('pxConfirmar'), ba = $('pxActualizar'); bc.disabled = true; ba.disabled = true;
    var lineas = [], todoOk = true;
    try {
      for (var emp of Object.keys(LEIDO)) {
        aviso(lineas.concat(['⏳ Enviando <b>' + emp + '</b> (' + n(LEIDO[emp].length) + ' trabajadores)…']).join('<br>'), 'inf');
        var r; try { r = await api('cargar', { empresa: emp, filas: LEIDO[emp] }, 170000); } catch (e) { r = null; }
        if (r && r.status === 200 && r.j && r.j.ok) {
          var x = r.j.resultado || {};
          var antes = hoy(emp), despues = (x.modo === 'incremental') ? (antes - (x.eliminados || 0) + (x.inserted || 0)) : (x.inserted || 0);
          lineas.push('✅ <b>' + emp + '</b>: ' + (x.modo === 'incremental'
            ? n(x.inserted) + ' nuevos o actualizados · ' + n(x.sin_cambios) + ' sin cambios · ahora ' + n(despues) + ' (antes ' + n(antes) + ')'
            : n(x.inserted) + ' trabajadores cargados'));
        } else {
          todoOk = false;
          lineas.push('❌ <b>' + emp + '</b>: ' + esc((r && r.j && (r.j.msg || r.j.error)) || (r ? 'código ' + r.status : 'sin respuesta del servidor')) + ' — no se cambió nada de ' + emp + '.');
        }
      }
      aviso(lineas.join('<br>') + (todoOk ? '<br><b>Padrón actualizado.</b> La búsqueda por DNI ya usa los datos nuevos.' : ''), todoOk ? 'ok' : 'err');
      LEIDO = null; bc.style.display = 'none';
      await cargarEstado();
    } finally { bc.disabled = false; ba.disabled = false; ocupado = false; }
  }

  function montar() {
    if (!esAdmin()) return;
    var sec = $('sec-trabajadores'); if (!sec || $('pxCard')) return;
    var st = document.createElement('style');
    st.textContent = '#pxCard .px-fila{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-top:10px}' +
      '#pxCard .px-btn{padding:9px 14px;border-radius:8px;border:1px solid #cbd5e1;background:#fff;color:#0f172a;font-weight:700;font-size:13px;cursor:pointer}' +
      '#pxCard .px-btn.pri{background:#0a2540;color:#fff;border-color:#0a2540}#pxCard .px-btn.ok{background:#15803d;color:#fff;border-color:#15803d}' +
      '#pxCard .px-btn:disabled{opacity:.55;cursor:wait}#pxCard .px-sub{font-size:12.5px;color:#475569}' +
      '#pxCard .px-msg{display:none;margin-top:12px;padding:10px 12px;border-radius:8px;font-size:13px;line-height:1.55}' +
      '#pxCard .px-msg.inf{background:#eff6ff;border:1px solid #bfdbfe;color:#1e3a8a}#pxCard .px-msg.ok{background:#f0fdf4;border:1px solid #bbf7d0;color:#14532d}' +
      '#pxCard .px-msg.err{background:#fef2f2;border:1px solid #fecaca;color:#7f1d1d}' +
      '#pxCard .px-tab{border-collapse:collapse;margin:8px 0;font-size:12.5px}#pxCard .px-tab th,#pxCard .px-tab td{border:1px solid #cbd5e1;padding:5px 9px;text-align:left;background:#fff;color:#0f172a}';
    document.head.appendChild(st);
    var c = document.createElement('div'); c.className = 'card'; c.id = 'pxCard';
    c.innerHTML = '<div class="card-h"><span class="card-t">Padrón de trabajadores · Actualizar desde el Excel</span></div>' +
      '<div class="px-sub" id="pxEstado">Consultando…</div>' +
      '<div class="px-sub" style="margin-top:6px">Archivo: <b id="pxArchivo">…</b></div>' +
      '<div class="px-fila">' +
      '<button class="px-btn pri" type="button" id="pxActualizar">🔄 Actualizar padrón</button>' +
      '<button class="px-btn ok" type="button" id="pxConfirmar" style="display:none">✅ Confirmar y enviar a Supabase</button>' +
      '<button class="px-btn" type="button" id="pxElegir">📂 Elegir otro archivo</button></div>' +
      '<div class="px-msg" id="pxMsg"></div>';
    sec.insertBefore(c, sec.firstChild);
    $('pxActualizar').onclick = actualizar;
    $('pxConfirmar').onclick = confirmar;
    $('pxElegir').onclick = function () { LEIDO = null; $('pxConfirmar').style.display = 'none'; aviso(''); elegir(); };
    if (puedeRecordar) idb('leer').then(function (h) { pintarArchivo(h ? h.name : ''); }); else pintarArchivo('se elige en cada carga (este navegador no recuerda archivos)');
    cargarEstado();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(montar, 800); });
  else setTimeout(montar, 800);
  window._pxMontar = montar;
})();
