// _CARGA_EXCEL_V1 (jun-2026) · Capacitaciones: carga masiva de asistentes por Excel
// Búsqueda anclada a Azure (reutiliza buscarTrabajadorAzure de capacitaciones.js).
// NO modifica el formato R-SC-01 ni generarPDFsFormatos. Archivo independiente.
'use strict';

(function () {
  let _excelEncontrados = []; // [{dni,nombre,empresa,cargo,sexo}]
  let _excelNoHallados  = []; // [dni,...]

  function _estado(html, color) {
    const el = document.getElementById('excelEstado');
    if (el) { el.innerHTML = html; el.style.color = color || '#475569'; }
  }

  // ── Abrir la pestaña Cargar Excel ──
  function abrirCargaExcel() {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('on'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('on'));
    const tc = document.getElementById('tab-excel');
    if (tc) tc.classList.add('on');
    const btn = document.getElementById('tabBtnExcel');
    if (btn) btn.classList.add('on');
    if (typeof detenerScanner === 'function') detenerScanner();
    _excelEncontrados = []; _excelNoHallados = [];
    const inp = document.getElementById('excelFile'); if (inp) inp.value = '';
    const res = document.getElementById('excelResultado'); if (res) res.innerHTML = '';
    _estado('Sube un Excel/CSV con una columna <b>DNI</b> (o los DNIs en la primera columna).');
  }

  // ── Plantilla descargable ──
  function descargarPlantillaExcel() {
    if (typeof XLSX === 'undefined') { _estado('\u26A0\uFE0F Falta la librería XLSX (SheetJS).', '#dc2626'); return; }
    const ws = XLSX.utils.aoa_to_sheet([['DNI'], ['46073509'], ['00000000']]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'DNIs');
    XLSX.writeFile(wb, 'plantilla_capacitacion_dnis.xlsx');
  }

  // ── Extraer DNIs (columna "DNI" o primera columna; dedup; relleno 7->8) ──
  function _extraerDnis(rows) {
    if (!rows || !rows.length) return [];
    let col = 0, start = 0;
    const head = rows[0].map(c => String(c == null ? '' : c).trim().toUpperCase());
    const idx = head.indexOf('DNI');
    if (idx >= 0) { col = idx; start = 1; }
    else {
      const c0 = String(rows[0][0] == null ? '' : rows[0][0]).replace(/\D/g, '');
      if (!(c0.length === 7 || c0.length === 8)) start = 1; // primera fila parece header
    }
    const out = [], vistos = {};
    for (let i = start; i < rows.length; i++) {
      const raw = rows[i] ? rows[i][col] : null;
      if (raw == null) continue;
      let d = String(raw).replace(/\D/g, '');
      if (d.length === 7) d = '0' + d;
      if (d.length !== 8) continue;
      if (vistos[d]) continue;
      vistos[d] = true;
      out.push(d);
    }
    return out;
  }

  async function onExcelFile(ev) {
    const file = ev.target.files && ev.target.files[0];
    if (!file) return;
    if (typeof XLSX === 'undefined') { _estado('\u26A0\uFE0F Falta la librería XLSX (SheetJS).', '#dc2626'); return; }
    _estado('Leyendo archivo\u2026');
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });
      const dnis = _extraerDnis(rows);
      if (!dnis.length) { _estado('\u274C No encontré DNIs válidos. Revisa que haya una columna DNI con 8 dígitos.', '#dc2626'); return; }
      await _consultarDnis(dnis);
    } catch (e) {
      _estado('\u274C Error leyendo el archivo: ' + e, '#dc2626');
    }
  }

  async function _consultarDnis(dnis) {
    _excelEncontrados = []; _excelNoHallados = [];
    const total = dnis.length;
    for (let i = 0; i < total; i++) {
      const dni = dnis[i];
      _estado('Consultando ' + (i + 1) + ' / ' + total + '\u2026');
      try {
        const r = await buscarTrabajadorAzure(dni);
        if (r && r.success && r.data && r.data.length) {
          const t = r.data[0];
          _excelEncontrados.push({ dni: dni, nombre: t.nombre || '', empresa: t.empresa || '', cargo: t.cargo || '', sexo: t.sexo || '' });
        } else {
          _excelNoHallados.push(dni);
        }
      } catch (e) {
        _excelNoHallados.push(dni);
      }
    }
    _renderRevision();
  }

  function _renderRevision() {
    const enc = _excelEncontrados, no = _excelNoHallados;
    const cont = document.getElementById('excelResultado');
    if (!cont) return;
    const formatos = Math.ceil(Math.max(enc.length, 1) / FILAS_POR_FORMATO);
    let html = '';
    html += '<div style="margin:10px 0;font-weight:700;color:#0a2463" id="excelResumen">' +
            enc.length + ' encontrados \u00B7 ' + no.length + ' no hallados \u00B7 ' + formatos + ' formato(s) R-SC-01</div>';

    if (enc.length) {
      html += '<div style="overflow-x:auto"><table class="data-table"><thead><tr>' +
              '<th><input type="checkbox" id="excelChkAll" checked onclick="toggleTodosExcel(this)"></th>' +
              '<th>N\u00B0</th><th>DNI</th><th>Apellidos y nombres</th><th>Empresa</th><th>Cargo</th></tr></thead><tbody>';
      enc.forEach((a, i) => {
        html += '<tr>' +
          '<td><input type="checkbox" class="excelChk" data-dni="' + a.dni + '" checked onclick="recalcFormatosExcel()"></td>' +
          '<td style="color:#64748b;font-weight:700">' + (i + 1) + '</td>' +
          '<td><code style="font-size:12px">' + a.dni + '</code></td>' +
          '<td>' + (a.nombre || '<span style="color:#94a3b8">Sin nombre</span>') + '</td>' +
          '<td>' + (a.empresa || '\u2014') + '</td>' +
          '<td style="font-size:12px;color:#475569">' + (a.cargo || '\u2014') + '</td></tr>';
      });
      html += '</tbody></table></div>';
    }

    if (no.length) {
      html += '<div style="margin-top:14px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px">' +
              '<b style="color:#dc2626">DNIs no encontrados (' + no.length + '):</b><br>' +
              '<code style="font-size:12px;color:#7f1d1d">' + no.join(', ') + '</code></div>';
    }

    if (enc.length) {
      html += '<div class="act-row" style="margin-top:16px">' +
              '<button class="btn btn-primary" onclick="continuarDesdeExcel()">Continuar \u2192 Datos de la actividad</button></div>';
    }
    cont.innerHTML = html;
    _estado('Listo. Revisa la lista y continúa.', '#16a34a');
  }

  function toggleTodosExcel(master) {
    document.querySelectorAll('.excelChk').forEach(c => { c.checked = master.checked; });
    recalcFormatosExcel();
  }

  function recalcFormatosExcel() {
    const marcados = document.querySelectorAll('.excelChk:checked').length;
    const formatos = Math.ceil(Math.max(marcados, 1) / FILAS_POR_FORMATO);
    const el = document.getElementById('excelResumen');
    if (el) el.textContent = marcados + ' seleccionados \u00B7 ' + _excelNoHallados.length + ' no hallados \u00B7 ' + formatos + ' formato(s) R-SC-01';
  }

  async function continuarDesdeExcel() {
    const marcados = [];
    document.querySelectorAll('.excelChk:checked').forEach(c => {
      const dni = c.getAttribute('data-dni');
      const t = _excelEncontrados.find(x => x.dni === dni);
      if (t) marcados.push(t);
    });
    if (!marcados.length) { _estado('Selecciona al menos un asistente.', '#dc2626'); return; }

    // Cargar al array global reutilizando la lógica existente (dedup + render + conteo H/M)
    asistentes.length = 0;
    marcados.forEach(t => agregarAsistente({ dni: t.dni, nombre: t.nombre, empresa: t.empresa, cargo: t.cargo, sexo: t.sexo }));

    // No retroactivo
    _esRetroactivo = false; _fechaRetroactiva = null; _motivoRetroactivo = '';

    // Setear cantidad y reutilizar el salto al Paso 1 existente
    sv('cantTrabajadores', String(asistentes.length));
    _activarTabNueva('tabBtnNueva');
    await continuarAPaso1();
    renderLista();
  }

  // Exponer a window (para los onclick del HTML)
  window.abrirCargaExcel         = abrirCargaExcel;
  window.descargarPlantillaExcel = descargarPlantillaExcel;
  window.onExcelFile             = onExcelFile;
  window.toggleTodosExcel        = toggleTodosExcel;
  window.recalcFormatosExcel     = recalcFormatosExcel;
  window.continuarDesdeExcel     = continuarDesdeExcel;
})();
