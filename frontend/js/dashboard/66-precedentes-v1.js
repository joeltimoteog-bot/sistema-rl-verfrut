/* ═══════════════════════════════════════════════════════════════════
   66-precedentes-v1.js — _PREC_UI_V1 (31-oct-2026) — Casos Precedentes
   Banco de referencia de RR.LL.: casos ya resueltos que sirven de guia para casos futuros.
   · Boton "⚖️ Precedentes" en la barra de Registro de Casos (se inyecta solo; no toca el nucleo).
   · Lista con filtros (texto, materia, sancion, año, empresa) y ficha completa.
   · Nuevo / Editar (solo administracion, coordinador y jefa RL): DNI -> datos del trabajador desde Azure,
     caso de origen (de los casos cargados en pantalla), materia, hechos, como se procedio, sancion,
     por que queda como precedente, palabras clave y adjuntos (Azure Blob, misma via que los casos).
   · Backend: POST /api/prec/{listar|obtener|guardar|editar|eliminar|materias} (100 % Azure, con token).
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var AZ = (typeof AZURE_FN_BASE !== 'undefined' ? AZURE_FN_BASE : 'https://rl-fn-verfrut.azurewebsites.net/api') + '/prec/';
  var MATERIAS = ['Indisciplina', 'Incumplimiento RIT', 'Falta Grave', 'Observación Conductual', 'Contención', 'Enfermería', 'Transporte', 'Beca del Foro', 'Otros'];
  var SANCIONES = ['Sin sanción', 'Llamada de atención verbal', 'Memorándum', 'Carta de preaviso', 'Suspensión', 'Desvinculación laboral', 'Otro'];
  var ROLES_W = ['administrador', 'administrador 01', 'administrador 02', 'coordinador', 'jefa_rl'];
  var lista = [], materiasAz = [], editandoId = null, adjPend = [], adjActuales = [];

  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var fecha = function (v) { if (!v) return '—'; var m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '/' + m[2] + '/' + m[1] : String(v); };
  var U = function () { try { return (typeof USER !== 'undefined' && USER) ? USER : {}; } catch (e) { return {}; } };   /* USER es let global del nucleo */
  var CASOS = function () { try { return (typeof casosData !== 'undefined' && Array.isArray(casosData)) ? casosData : []; } catch (e) { return []; } };
  var puedeEscribir = function () { var u = U(); return ROLES_W.indexOf(String(u.rol || '').toLowerCase().trim()) >= 0 || String(u.usuario || '').toLowerCase() === 'jtimoteo'; };
  var toast = function (m, t) { try { if (typeof mostrarToast === 'function') return mostrarToast(m, t || 'ok'); } catch (e) {} alert(m); };
  var confirmar = async function (titulo, texto, si) {
    var ok = false;
    try { if (typeof appConfirm === 'function') ok = await appConfirm(titulo + ' ' + texto); else ok = confirm(titulo + '\n\n' + texto); } catch (e) { ok = confirm(titulo + '\n\n' + texto); }
    if (ok) si();
  };

  async function api(accion, cuerpo) {
    var tk = ''; try { tk = sessionStorage.getItem('rl_token') || ''; } catch (e) {}
    var r = await fetch(AZ + accion, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tk }, body: JSON.stringify(cuerpo || {}) });
    var j = await r.json().catch(function () { return {}; });
    if (r.status === 401) throw new Error('Tu sesión venció: vuelve a iniciar sesión');
    if (r.status === 403) throw new Error(j.error || 'Sin permiso');
    if (!r.ok) throw new Error(j.error || ('Azure ' + r.status));
    return j;
  }

  /* ── estilos ── */
  var css = document.createElement('style'); css.id = 'precCss';
  css.textContent = '\
  #mPrec .modal{max-width:1040px;width:97vw;padding:0}\
  .prec-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:16px 22px;background:linear-gradient(135deg,#0b1e45,#1e3a8a);color:#fff;border-radius:14px 14px 0 0}\
  .prec-head h3{margin:0;font-size:17px;font-weight:800}\
  .prec-head small{display:block;font-size:11px;opacity:.85;font-weight:400;margin-top:2px}\
  .prec-tabs{display:flex;gap:6px;padding:12px 22px 0}\
  .prec-tab{padding:8px 16px;border:none;border-radius:8px 8px 0 0;background:#e2e8f0;color:#334155;font-weight:700;font-size:12.5px;cursor:pointer}\
  .prec-tab.on{background:#fff;color:#0b1e45;box-shadow:0 -2px 0 #0b1e45 inset}\
  .prec-body{padding:16px 22px 22px}\
  .prec-filtros{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}\
  .prec-filtros input,.prec-filtros select{padding:8px 10px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:12.5px}\
  .prec-filtros input[type=text]{flex:1;min-width:220px}\
  .prec-tbl{width:100%;border-collapse:collapse;font-size:12px}\
  .prec-tbl th{background:#f1f5f9;color:#334155;text-align:left;padding:8px 10px;font-size:11px;text-transform:uppercase;letter-spacing:.3px}\
  .prec-tbl td{padding:8px 10px;border-bottom:1px solid #eef2f7;vertical-align:top}\
  .prec-tbl tr:hover td{background:#f8fafc}\
  .prec-chip{display:inline-block;padding:2px 8px;border-radius:999px;font-size:10.5px;font-weight:700;background:#eef2ff;color:#3730a3;white-space:nowrap}\
  .prec-chip.s{background:#fff7ed;color:#9a3412}\
  .prec-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px 14px}\
  .prec-grid .full{grid-column:1/-1}\
  .prec-grid label{display:block;font-size:11px;font-weight:700;color:#475569;margin-bottom:4px}\
  .prec-grid input,.prec-grid select,.prec-grid textarea{width:100%;padding:8px 10px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:12.5px;box-sizing:border-box;font-family:inherit}\
  .prec-grid textarea{min-height:76px;resize:vertical}\
  .prec-grid input[readonly]{background:#f8fafc;color:#475569}\
  .prec-btn{padding:8px 16px;border:none;border-radius:8px;font-weight:700;font-size:12.5px;cursor:pointer}\
  .prec-btn.p{background:#0b1e45;color:#fff}.prec-btn.g{background:#16a34a;color:#fff}.prec-btn.r{background:#dc2626;color:#fff}.prec-btn.n{background:#e2e8f0;color:#334155}.prec-btn.sm{padding:5px 9px;font-size:11px}\
  .prec-btn:disabled{opacity:.55;cursor:not-allowed}\
  .prec-adj{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}\
  .prec-adj a,.prec-adj span{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:8px;background:#f1f5f9;font-size:11.5px;color:#0b1e45;text-decoration:none}\
  .prec-ficha h4{margin:14px 0 4px;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.4px}\
  .prec-ficha p{margin:0;font-size:13px;line-height:1.55;white-space:pre-wrap}\
  .prec-ficha .meta{display:flex;flex-wrap:wrap;gap:8px 18px;font-size:12px;color:#334155;margin-top:8px}\
  .prec-vacio{text-align:center;color:#64748b;padding:26px;font-size:13px}\
  @media(max-width:700px){.prec-grid{grid-template-columns:1fr}}';
  document.head.appendChild(css);

  /* ── modal ── */
  function montar() {
    if ($('mPrec')) return;
    var d = document.createElement('div'); d.className = 'ov'; d.id = 'mPrec';
    d.innerHTML = '<div class="modal">\
      <div class="prec-head"><div><h3>⚖️ Casos Precedentes</h3><small>Banco de referencia: cómo se resolvieron casos anteriores y por qué sirven de guía</small></div>\
        <button class="prec-btn n" onclick="cerrar(\'mPrec\')">✕ Cerrar</button></div>\
      <div class="prec-tabs"><button class="prec-tab on" id="precTabL" onclick="PREC.tab(\'l\')">🔎 Buscar precedentes</button>\
        <button class="prec-tab" id="precTabN" onclick="PREC.nuevo()" style="display:none">➕ Nuevo precedente</button></div>\
      <div class="prec-body">\
        <div id="precVistaL">\
          <div class="prec-filtros">\
            <input type="text" id="precQ" placeholder="Buscar por trabajador, DNI, código, caso, palabra clave o texto…" oninput="PREC.buscarLento()">\
            <select id="precFMat" onchange="PREC.listar()"><option value="">Todas las materias</option></select>\
            <select id="precFSan" onchange="PREC.listar()"><option value="">Todas las sanciones</option></select>\
            <select id="precFEmp" onchange="PREC.listar()"><option value="">Todas las empresas</option><option value="RAPEL">RAPEL</option><option value="VERFRUT">VERFRUT</option><option value="OLMOS">OLMOS</option></select>\
            <select id="precFAnio" onchange="PREC.listar()"><option value="">Todos los años</option></select>\
          </div>\
          <div style="overflow-x:auto"><table class="prec-tbl"><thead><tr><th>Código</th><th>Fecha</th><th>Trabajador</th><th>Materia</th><th>Sanción</th><th>Por qué es precedente</th><th></th></tr></thead>\
          <tbody id="precTb"><tr><td colspan="7" class="prec-vacio">Cargando…</td></tr></tbody></table></div>\
        </div>\
        <div id="precVistaN" style="display:none">\
          <div class="prec-grid">\
            <div><label>DNI del trabajador</label><div style="display:flex;gap:6px"><input type="text" id="precDni" maxlength="8" placeholder="8 dígitos" oninput="PREC.dniCambio()"><button class="prec-btn p sm" type="button" onclick="PREC.buscarDni()">🔍</button></div><div id="precDniMsg" style="font-size:11px;color:#64748b;margin-top:3px"></div></div>\
            <div><label>Nombre completo</label><input type="text" id="precNombre" placeholder="Se completa con el DNI (o escríbelo)"></div>\
            <div><label>Empresa</label><select id="precEmp"><option value="">—</option><option>RAPEL</option><option>VERFRUT</option><option>OLMOS</option></select></div>\
            <div><label>Fundo / Cargo</label><div style="display:flex;gap:6px"><input type="text" id="precFundo" placeholder="Fundo"><input type="text" id="precCargo" placeholder="Cargo"></div></div>\
            <div><label>Caso de origen (opcional)</label><select id="precCaso" onchange="PREC.casoElegido()"><option value="">— Sin vincular / caso no registrado —</option></select></div>\
            <div><label>Fecha del caso</label><input type="date" id="precFecha"></div>\
            <div><label>Materia / tipo de falta *</label><input type="text" id="precMateria" list="precMaterias" placeholder="Elige o escribe"><datalist id="precMaterias"></datalist></div>\
            <div><label>Sanción / medida aplicada *</label><select id="precSancion"></select></div>\
            <div class="full"><label>Resumen de los hechos *</label><textarea id="precHechos" placeholder="Qué ocurrió, cuándo, quiénes intervinieron…"></textarea></div>\
            <div class="full"><label>Cómo se procedió y resultado *</label><textarea id="precProc" placeholder="Pasos seguidos: descargos, investigación, documentos emitidos, decisión final…"></textarea></div>\
            <div class="full"><label>Por qué queda como precedente *</label><textarea id="precMotivo" placeholder="Qué criterio fija este caso para situaciones similares"></textarea></div>\
            <div><label>Palabras clave</label><input type="text" id="precClaves" placeholder="separadas por coma: inasistencia, alcohol, agresión…"></div>\
            <div><label>Adjuntos (PDF, imagen · máx. 20 MB c/u)</label><input type="file" id="precFiles" multiple accept=".pdf,image/*" onchange="PREC.filesCambio()"><div class="prec-adj" id="precAdjLista"></div></div>\
          </div>\
          <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">\
            <button class="prec-btn n" onclick="PREC.tab(\'l\')">Cancelar</button>\
            <button class="prec-btn g" id="precBtnGuardar" onclick="PREC.guardar()">💾 Guardar precedente</button></div>\
        </div>\
        <div id="precVistaF" style="display:none" class="prec-ficha"></div>\
      </div></div>';
    document.body.appendChild(d);
    var sel = $('precSancion'); SANCIONES.forEach(function (s) { var o = document.createElement('option'); o.value = s; o.textContent = s; sel.appendChild(o); });
    var fs = $('precFSan'); SANCIONES.forEach(function (s) { var o = document.createElement('option'); o.value = s; o.textContent = s; fs.appendChild(o); });
    var y = new Date().getFullYear(), fa = $('precFAnio'); for (var i = y; i >= 2023; i--) { var o = document.createElement('option'); o.value = i; o.textContent = i; fa.appendChild(o); }
    pintarMaterias();
  }
  function pintarMaterias() {
    var todas = MATERIAS.slice(); materiasAz.forEach(function (m) { if (todas.indexOf(m.materia) < 0) todas.push(m.materia); });
    var dl = $('precMaterias'), fm = $('precFMat'); if (!dl || !fm) return;
    dl.innerHTML = todas.map(function (m) { return '<option value="' + esc(m) + '">'; }).join('');
    var act = fm.value; fm.innerHTML = '<option value="">Todas las materias</option>' + todas.map(function (m) { return '<option value="' + esc(m) + '">' + esc(m) + '</option>'; }).join(''); fm.value = act;
  }

  /* ── boton en Registro de Casos ── */
  function inyectarBoton() {
    if ($('btnPrecedentes')) return true;
    var btns = Array.prototype.slice.call(document.querySelectorAll('button')).filter(function (b) { return /exportarCasosExcel/.test(b.getAttribute('onclick') || ''); });
    if (!btns.length) return false;
    var b = document.createElement('button'); b.className = 'btn-a'; b.id = 'btnPrecedentes'; b.textContent = '⚖️ Precedentes';
    b.style.cssText = 'background:#0b1e45;color:#fff'; b.onclick = function () { PREC.abrir(); };
    btns[0].parentNode.insertBefore(b, btns[0].nextSibling);
    return true;
  }

  var PREC = {
    abrir: function () {
      if (window.etiTieneAcceso && typeof etiTieneAcceso === 'function') { /* sin uso aqui; los permisos los da Acceso a Modulos del propio Registro de Casos */ }
      montar(); $('precTabN').style.display = puedeEscribir() ? '' : 'none';
      PREC.tab('l'); abrir('mPrec');
      api('materias').then(function (j) { if (j && j.success) { materiasAz = j.materias || []; pintarMaterias(); } }).catch(function () {});
      PREC.listar();
    },
    tab: function (t) {
      $('precVistaL').style.display = t === 'l' ? '' : 'none'; $('precVistaN').style.display = t === 'n' ? '' : 'none'; $('precVistaF').style.display = t === 'f' ? '' : 'none';
      $('precTabL').classList.toggle('on', t === 'l'); $('precTabN').classList.toggle('on', t === 'n');
      if (t === 'l') $('mPrec').querySelector('.modal').scrollTop = 0;
    },
    _t: null,
    buscarLento: function () { clearTimeout(PREC._t); PREC._t = setTimeout(PREC.listar, 350); },
    listar: async function () {
      var tb = $('precTb'); tb.innerHTML = '<tr><td colspan="7" class="prec-vacio">Cargando…</td></tr>';
      try {
        var j = await api('listar', { q: $('precQ').value, materia: $('precFMat').value, sancion: $('precFSan').value, empresa: $('precFEmp').value, anio: $('precFAnio').value, top: 300 });
        lista = (j && j.data) || [];
        if (!lista.length) { tb.innerHTML = '<tr><td colspan="7" class="prec-vacio">No hay precedentes con esos filtros' + (puedeEscribir() ? '. Usa <b>➕ Nuevo precedente</b> para registrar el primero.' : '.') + '</td></tr>'; return; }
        var w = puedeEscribir();
        tb.innerHTML = lista.map(function (p) {
          return '<tr><td><b>' + esc(p.codigo) + '</b>' + (p.caso_nro ? '<br><span style="font-size:10.5px;color:#64748b">Caso ' + esc(p.caso_nro) + '</span>' : '') + '</td>' +
            '<td>' + fecha(p.caso_fecha || p.creado) + '</td>' +
            '<td><b>' + esc(p.nombre || '—') + '</b><br><span style="font-size:10.5px;color:#64748b">' + esc(p.dni || '') + (p.empresa ? ' · ' + esc(p.empresa) : '') + '</span></td>' +
            '<td><span class="prec-chip">' + esc(p.materia) + '</span></td><td><span class="prec-chip s">' + esc(p.sancion) + '</span></td>' +
            '<td style="max-width:300px;color:#334155">' + esc((p.motivo_precedente || '').slice(0, 160)) + ((p.motivo_precedente || '').length >= 160 ? '…' : '') + '</td>' +
            '<td style="white-space:nowrap"><button class="prec-btn p sm" onclick="PREC.ver(' + p.id + ')">👁 Ver</button>' +
            (w ? ' <button class="prec-btn n sm" onclick="PREC.editar(' + p.id + ')">✏️</button> <button class="prec-btn r sm" onclick="PREC.eliminar(' + p.id + ',\'' + esc(p.codigo) + '\')">🗑</button>' : '') + '</td></tr>';
        }).join('');
      } catch (e) { tb.innerHTML = '<tr><td colspan="7" class="prec-vacio">❌ ' + esc(e.message) + '</td></tr>'; }
    },
    ver: async function (id) {
      try {
        var j = await api('obtener', { id: id }); if (!j.success) throw new Error(j.error);
        var p = j.data, f = $('precVistaF');
        f.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><div><span class="prec-chip">' + esc(p.codigo) + '</span> <span class="prec-chip">' + esc(p.materia) + '</span> <span class="prec-chip s">' + esc(p.sancion) + '</span></div>' +
          '<div style="display:flex;gap:6px"><button class="prec-btn n sm" onclick="PREC.tab(\'l\')">← Volver</button>' + (puedeEscribir() ? '<button class="prec-btn p sm" onclick="PREC.editar(' + p.id + ')">✏️ Editar</button>' : '') + '</div></div>' +
          '<div class="meta"><span>👤 <b>' + esc(p.nombre || '—') + '</b></span><span>DNI ' + esc(p.dni || '—') + '</span><span>' + esc(p.empresa || '') + (p.fundo ? ' · ' + esc(p.fundo) : '') + (p.cargo ? ' · ' + esc(p.cargo) : '') + '</span>' +
          '<span>📅 ' + fecha(p.caso_fecha) + '</span>' + (p.caso_nro ? '<span>📁 Caso ' + esc(p.caso_nro) + '</span>' : '') + '</div>' +
          '<h4>Resumen de los hechos</h4><p>' + esc(p.hechos) + '</p><h4>Cómo se procedió y resultado</h4><p>' + esc(p.procedimiento) + '</p>' +
          '<h4>Por qué queda como precedente</h4><p style="background:#fffbeb;border-left:3px solid #f59e0b;padding:8px 10px;border-radius:6px">' + esc(p.motivo_precedente) + '</p>' +
          (p.palabras_clave ? '<h4>Palabras clave</h4><p>' + esc(p.palabras_clave) + '</p>' : '') +
          '<h4>Adjuntos</h4><div class="prec-adj">' + ((p.adjuntos || []).length ? p.adjuntos.map(function (a) { return '<a href="' + esc(a.url) + '" target="_blank" rel="noopener">📎 ' + esc(a.nombre || 'archivo') + '</a>'; }).join('') : '<span style="color:#94a3b8">Sin adjuntos</span>') + '</div>' +
          '<div class="meta" style="margin-top:14px;color:#64748b;font-size:11px"><span>Registrado por ' + esc(p.creado_por) + ' · ' + fecha(p.creado) + '</span>' + (p.actualizado ? '<span>Actualizado por ' + esc(p.actualizado_por) + ' · ' + fecha(p.actualizado) + '</span>' : '') + '</div>';
        PREC.tab('f');
      } catch (e) { toast('❌ ' + e.message, 'error'); }
    },
    nuevo: function () {
      if (!puedeEscribir()) return toast('🔒 Solo administración registra precedentes', 'error');
      editandoId = null; adjPend = []; adjActuales = [];
      ['precDni', 'precNombre', 'precFundo', 'precCargo', 'precFecha', 'precMateria', 'precHechos', 'precProc', 'precMotivo', 'precClaves'].forEach(function (id) { $(id).value = ''; });
      $('precEmp').value = ''; $('precSancion').value = SANCIONES[1]; $('precFiles').value = ''; $('precDniMsg').textContent = '';
      $('precCaso').innerHTML = '<option value="">— Sin vincular / caso no registrado —</option>'; pintarAdj();
      $('precBtnGuardar').textContent = '💾 Guardar precedente'; PREC.tab('n');
    },
    editar: async function (id) {
      if (!puedeEscribir()) return;
      try {
        var j = await api('obtener', { id: id }); if (!j.success) throw new Error(j.error);
        var p = j.data; PREC.nuevo(); editandoId = p.id; adjActuales = p.adjuntos || [];
        $('precDni').value = p.dni || ''; $('precNombre').value = p.nombre || ''; $('precEmp').value = p.empresa || ''; $('precFundo').value = p.fundo || ''; $('precCargo').value = p.cargo || '';
        $('precFecha').value = p.caso_fecha || ''; $('precMateria').value = p.materia || ''; $('precSancion').value = p.sancion || SANCIONES[1];
        $('precHechos').value = p.hechos || ''; $('precProc').value = p.procedimiento || ''; $('precMotivo').value = p.motivo_precedente || ''; $('precClaves').value = p.palabras_clave || '';
        PREC.dniCambio(); if (p.caso_nro) { var o = document.createElement('option'); o.value = p.caso_nro; o.textContent = 'Caso ' + p.caso_nro; o.selected = true; $('precCaso').appendChild(o); }
        pintarAdj(); $('precBtnGuardar').textContent = '💾 Guardar cambios (' + p.codigo + ')';
      } catch (e) { toast('❌ ' + e.message, 'error'); }
    },
    eliminar: function (id, codigo) {
      confirmar('¿Eliminar el precedente ' + codigo + '?', 'Deja de mostrarse en el banco (queda guardado como inactivo en Azure).', async function () {
        try { var j = await api('eliminar', { id: id }); if (!j.success) throw new Error(j.error); toast('🗑 ' + codigo + ' eliminado'); PREC.listar(); } catch (e) { toast('❌ ' + e.message, 'error'); }
      });
    },
    dniCambio: function () {
      var dni = $('precDni').value.replace(/\D/g, ''); $('precDni').value = dni;
      var sel = $('precCaso'), casos = CASOS().filter(function (c) { return dni && String(c.dni || '').replace(/\D/g, '') === dni; });
      sel.innerHTML = '<option value="">— Sin vincular / caso no registrado —</option>' + casos.map(function (c) { return '<option value="' + esc(c.nro) + '">Caso ' + esc(c.nro) + ' · ' + esc(c.fecha_reporte || c.fecha_atencion || '') + ' · ' + esc(c.motivo || '') + ' · ' + esc(c.estado || '') + '</option>'; }).join('');
      if (dni.length === 8) PREC.buscarDni();
    },
    buscarDni: async function () {
      var dni = $('precDni').value.replace(/\D/g, ''); if (dni.length < 7) return;
      $('precDniMsg').textContent = 'Buscando en Azure…';
      try {
        var r = (typeof _buscarTrabApi === 'function') ? await _buscarTrabApi(dni, 'AMBAS') : null;
        var t = r && r.success && r.data && r.data[0];
        if (t) { $('precNombre').value = t.nombre || ''; $('precEmp').value = String(t.empresa || '').toUpperCase().indexOf('RAPEL') >= 0 ? 'RAPEL' : String(t.empresa || '').toUpperCase().indexOf('VERFRUT') >= 0 ? 'VERFRUT' : String(t.empresa || '').toUpperCase().indexOf('OLMOS') >= 0 ? 'OLMOS' : $('precEmp').value; $('precFundo').value = t.fundo_actual || t.fundo || ''; $('precCargo').value = t.cargo || ''; $('precDniMsg').textContent = '✅ Trabajador encontrado'; }
        else $('precDniMsg').textContent = 'No está en la base de trabajadores (puede ser ex trabajador): completa el nombre a mano';
      } catch (e) { $('precDniMsg').textContent = 'No se pudo consultar: completa los datos a mano'; }
    },
    casoElegido: function () {
      var nro = $('precCaso').value, c = CASOS().filter(function (x) { return String(x.nro) === nro; })[0];
      if (!c) return;
      var f = String(c.fecha_reporte || c.fecha_atencion || ''), m = f.match(/^(\d{4})-(\d{2})-(\d{2})/) || f.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
      if (m) $('precFecha').value = m[1].length === 4 ? m[1] + '-' + m[2] + '-' + m[3] : m[3] + '-' + m[2] + '-' + m[1];
      if (c.motivo && !$('precMateria').value) $('precMateria').value = c.motivo;
      if (c.sancion && SANCIONES.indexOf(c.sancion) >= 0) $('precSancion').value = c.sancion;
      if (!$('precNombre').value && c.nombre) $('precNombre').value = c.nombre;
      if (!$('precEmp').value && c.empresa) $('precEmp').value = String(c.empresa).toUpperCase();
    },
    filesCambio: function () { adjPend = Array.prototype.slice.call($('precFiles').files || []).filter(function (f) { if (f.size > 20 * 1048576) { toast('❌ ' + f.name + ' supera 20 MB', 'error'); return false; } return true; }); pintarAdj(); },
    quitarAdj: function (i) { adjActuales.splice(i, 1); pintarAdj(); },
    guardar: async function () {
      var b = { id: editandoId, dni: $('precDni').value, nombre: $('precNombre').value, empresa: $('precEmp').value, fundo: $('precFundo').value, cargo: $('precCargo').value,
        caso_nro: $('precCaso').value, caso_fecha: $('precFecha').value, materia: $('precMateria').value.trim(), sancion: $('precSancion').value,
        hechos: $('precHechos').value.trim(), procedimiento: $('precProc').value.trim(), motivo_precedente: $('precMotivo').value.trim(), palabras_clave: $('precClaves').value.trim() };
      var faltan = []; if (!b.materia) faltan.push('materia'); if (!b.hechos) faltan.push('hechos'); if (!b.procedimiento) faltan.push('cómo se procedió'); if (!b.motivo_precedente) faltan.push('por qué es precedente');
      if (faltan.length) return toast('❌ Falta: ' + faltan.join(', '), 'error');
      var btn = $('precBtnGuardar'); btn.disabled = true; btn.textContent = '⏳ Guardando…';
      try {
        var subidos = [];
        for (var i = 0; i < adjPend.length; i++) {
          btn.textContent = '⏳ Subiendo adjunto ' + (i + 1) + '/' + adjPend.length + '…';
          var a = (typeof _subirViaBackend === 'function') ? await _subirViaBackend(adjPend[i], 'casos-rl', { modulo: 'precedentes', casoId: b.caso_nro || '' }) : null;
          if (!a || !a.url) throw new Error('No se pudo subir ' + adjPend[i].name);
          subidos.push({ nombre: a.nombre || adjPend[i].name, url: a.url, tipo: adjPend[i].type || '' });
        }
        b.adjuntos = adjActuales.concat(subidos);
        btn.textContent = '⏳ Guardando…';
        var j = await api(editandoId ? 'editar' : 'guardar', b); if (!j.success) throw new Error(j.error || 'No se pudo guardar');
        toast('✅ Precedente ' + (j.codigo || 'actualizado') + ' guardado en Azure');
        try { if (window.RLTrafico) RLTrafico.emit({ accion: (editandoId ? 'Editó' : 'Registró') + ' precedente ' + (j.codigo || ''), destino: 'Azure SQL' }); } catch (e) {}
        adjPend = []; $('precFiles').value = ''; PREC.tab('l'); PREC.listar();
        api('materias').then(function (r) { if (r && r.success) { materiasAz = r.materias || []; pintarMaterias(); } }).catch(function () {});
      } catch (e) { toast('❌ ' + e.message, 'error'); }
      finally { btn.disabled = false; btn.textContent = editandoId ? '💾 Guardar cambios' : '💾 Guardar precedente'; }
    }
  };
  function pintarAdj() {
    var c = $('precAdjLista'); if (!c) return;
    c.innerHTML = adjActuales.map(function (a, i) { return '<span>📎 ' + esc(a.nombre) + ' <b style="cursor:pointer;color:#dc2626" title="Quitar" onclick="PREC.quitarAdj(' + i + ')">✕</b></span>'; }).join('') +
      adjPend.map(function (f) { return '<span style="background:#ecfdf5">🆕 ' + esc(f.name) + '</span>'; }).join('');
  }
  window.PREC = PREC;

  /* el boton aparece cuando la pantalla de casos ya esta en el DOM (es estatica, pero por si carga tarde) */
  if (!inyectarBoton()) { var n = 0, it = setInterval(function () { if (inyectarBoton() || ++n > 40) clearInterval(it); }, 500); }
  console.log('[_PREC_UI_V1] Casos Precedentes listo');
})();
