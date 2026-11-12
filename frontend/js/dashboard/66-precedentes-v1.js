/* ═══════════════════════════════════════════════════════════════════
   66-precedentes-v1.js — _PREC_UI_V1 (31-oct-2026) — Casos Precedentes
   · Boton "⚖️ Precedentes" en la barra de Registro de Casos (se inyecta solo; no toca el nucleo).
   · Backend: POST /api/prec/{listar|obtener|guardar|editar|eliminar|materias|aviso} (Supabase, con token).
   ───────────────────────────────────────────────────────────────────
   _PREC_USUARIO_V1 (12-nov-2026) — precedentes POR USUARIO con aviso general de reincidencia
   · Cualquier usuario que registra casos registra tambien sus precedentes, con un formulario breve
     y SIN PDF: DNI (trae los datos del trabajador), ruta, codigo, area, tema del reporte, fecha,
     motivo que se le atribuye, descripcion breve y por que queda como precedente.
   · Cada usuario ve, edita y elimina SOLO los suyos. La administracion ve todos (filtro "Registrado por").
   · AVISO GENERAL: al escribir un DNI en "Nuevo caso" o en "Registrar precedente" aparece si ese
     trabajador ya tiene casos o precedentes, registrados por cualquier usuario: tipo, fecha, motivo,
     quien lo registro y su sector. El detalle de lo ajeno no se muestra. El aviso no bloquea nada.
   · Los precedentes anteriores (formato largo) se siguen viendo con todos sus datos y adjuntos.
   Apagar el aviso en Nuevo caso: localStorage.rl_prec_aviso = 'off'.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var AZ = (typeof AZURE_FN_BASE !== 'undefined' ? AZURE_FN_BASE : 'https://exdjzbfinppzatjyimxn.supabase.co/functions/v1/api') + '/prec/';
  var MATERIAS = ['Indisciplina', 'Incumplimiento RIT', 'Falta Grave', 'Observación Conductual', 'Contención', 'Enfermería', 'Transporte', 'Beca del Foro', 'Otros'];
  var ROLES_ADM = ['administrador', 'administrador 01', 'administrador 02', 'admin', 'admin01', 'admin02', 'coordinador', 'jefa_rl'];
  var lista = [], materiasAz = [], editandoId = null;

  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var fecha = function (v) { if (!v) return '—'; var m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '/' + m[2] + '/' + m[1] : String(v); };
  var U = function () { try { return (typeof USER !== 'undefined' && USER) ? USER : {}; } catch (e) { return {}; } };   /* USER es let global del nucleo */
  var yo = function () { return String(U().usuario || '').toLowerCase().trim(); };
  var esAdmin = function () { var u = U(); return ROLES_ADM.indexOf(String(u.rol || '').toLowerCase().trim()) >= 0 || yo() === 'jtimoteo'; };
  var esMio = function (p) { return String((p && p.creado_por) || '').toLowerCase().trim() === yo(); };
  var puedeTocar = function (p) { return esAdmin() || esMio(p); };
  var toast = function (m, t) { try { if (typeof mostrarToast === 'function') return mostrarToast(m, t || 'ok'); } catch (e) {} alert(m); };
  var confirmar = async function (titulo, texto, si) {
    var ok = false;
    try { if (typeof appConfirm === 'function') ok = await appConfirm(titulo + ' ' + texto); else ok = confirm(titulo + '\n\n' + texto); } catch (e) { ok = confirm(titulo + '\n\n' + texto); }
    if (ok) si();
  };
  var hoy = function () { var d = new Date(Date.now() - 5 * 3600000); return d.toISOString().slice(0, 10); };

  async function api(accion, cuerpo) {
    var tk = ''; try { tk = sessionStorage.getItem('rl_token') || ''; } catch (e) {}
    var r = await fetch(AZ + accion, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tk }, body: JSON.stringify(cuerpo || {}) });
    var j = await r.json().catch(function () { return {}; });
    if (r.status === 401) throw new Error('Tu sesión venció: vuelve a iniciar sesión');
    if (r.status === 403) throw new Error(j.error || 'Sin permiso');
    if (!r.ok) throw new Error(j.error || ('Supabase ' + r.status));
    return j;
  }

  /* ── estilos ── */
  var css = document.createElement('style'); css.id = 'precCss';
  css.textContent = '\
  #mPrec .modal{max-width:1040px;width:97vw;padding:0}\
  .prec-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 22px;background:#EDF1F6!important;background-image:none!important;color:#0F2748;border-bottom:1px solid #D6DEE9;border-radius:8px 8px 0 0}\
  .prec-head h3{margin:0;font-size:16px;font-weight:700;color:#0F2748!important;background:transparent!important;border:0!important;padding:0!important;border-radius:0!important}\
  .prec-head small{display:block;font-size:11.5px;color:#5B6B82;font-weight:400;margin-top:2px}\
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
  .prec-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:10px 14px}\
  .prec-grid .c2{grid-column:span 2}.prec-grid .c3{grid-column:span 3}.prec-grid .c4{grid-column:span 4}.prec-grid .full{grid-column:1/-1}\
  .prec-grid h5{grid-column:1/-1;margin:8px 0 0;font-size:12.5px;color:#0b1e45;font-weight:800}\
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
  .prec-aviso{background:#fff7ed;border:1.5px solid #c2410c;border-radius:10px;padding:12px 14px;color:#7c2d12;font-size:12.5px;line-height:1.5;margin-top:10px}\
  .prec-aviso b.t{display:block;font-size:13.5px;margin-bottom:6px}\
  .prec-aviso .ln{display:flex;gap:8px;align-items:baseline;margin:3px 0}\
  .prec-aviso .tp{flex:none;min-width:86px;text-align:center;font-size:10.5px;font-weight:800;color:#fff;border-radius:6px;padding:2px 6px}\
  .prec-aviso .tp.c{background:#0b1e45}.prec-aviso .tp.p{background:#9a3412}\
  .prec-aviso .pie{font-size:11.5px;color:#9a3412;margin-top:6px}\
  .prec-aviso a{color:#7c2d12;font-weight:700}\
  @media(max-width:700px){.prec-grid{grid-template-columns:1fr 1fr}.prec-grid .c2,.prec-grid .c3,.prec-grid .c4{grid-column:1/-1}}';
  document.head.appendChild(css);

  /* ── modal ── */
  function montar() {
    if ($('mPrec')) return;
    var d = document.createElement('div'); d.className = 'ov'; d.id = 'mPrec';
    d.innerHTML = '<div class="modal">\
      <div class="prec-head"><div><h3 id="precTitulo">Mis precedentes</h3><small id="precSub">Lo que tú registras como precedente. Al registrar un caso o un precedente, el sistema avisa si el trabajador ya tiene antecedentes.</small></div>\
        <button class="prec-btn n" onclick="cerrar(\'mPrec\')">✕ Cerrar</button></div>\
      <div class="prec-tabs"><button class="prec-tab on" id="precTabL" onclick="PREC.tab(\'l\')">🔎 Mis precedentes</button>\
        <button class="prec-tab" id="precTabN" onclick="PREC.nuevo()">➕ Registrar precedente</button></div>\
      <div class="prec-body">\
        <div id="precVistaL">\
          <div class="prec-filtros">\
            <input type="text" id="precQ" placeholder="Buscar por DNI, trabajador, tema, motivo o texto…" oninput="PREC.buscarLento()">\
            <select id="precFMat" onchange="PREC.listar()"><option value="">Todos los temas</option></select>\
            <select id="precFEmp" onchange="PREC.listar()"><option value="">Todas las empresas</option><option value="RAPEL">RAPEL</option><option value="VERFRUT">VERFRUT</option><option value="OLMOS">OLMOS</option></select>\
            <select id="precFAnio" onchange="PREC.listar()"><option value="">Todos los años</option></select>\
            <select id="precFUsr" onchange="PREC.listar()" style="display:none"><option value="">Registrado por: todos</option></select>\
          </div>\
          <div style="overflow-x:auto"><table class="prec-tbl"><thead><tr><th>Código</th><th>Fecha</th><th>Trabajador</th><th>Tema</th><th>Motivo</th><th>Ruta</th><th id="precThUsr">Registró</th><th></th></tr></thead>\
          <tbody id="precTb"><tr><td colspan="8" class="prec-vacio">Cargando…</td></tr></tbody></table></div>\
        </div>\
        <div id="precVistaN" style="display:none">\
          <div class="prec-grid">\
            <h5>1. Trabajador involucrado</h5>\
            <div class="c2"><label for="precDni">DNI *</label><div style="display:flex;gap:6px"><input type="text" id="precDni" maxlength="8" inputmode="numeric" placeholder="8 dígitos" oninput="PREC.dniCambio()"><button class="prec-btn p sm" type="button" onclick="PREC.buscarDni()">Buscar</button></div><div id="precDniMsg" style="font-size:11px;color:#64748b;margin-top:3px"></div></div>\
            <div class="c3"><label for="precNombre">Apellidos y nombres</label><input type="text" id="precNombre" placeholder="Se completa con el DNI (o escríbelo)"></div>\
            <div><label for="precEmp">Empresa</label><select id="precEmp"><option value="">—</option><option>RAPEL</option><option>VERFRUT</option><option>OLMOS</option></select></div>\
            <div class="full" id="precAviso" style="display:none"></div>\
            <div class="c2"><label for="precRuta">Ruta</label><input type="text" id="precRuta" maxlength="60"></div>\
            <div class="c2"><label for="precCod">Código</label><input type="text" id="precCod" maxlength="40"></div>\
            <div class="c2"><label for="precArea">Área / fundo (si está designada)</label><input type="text" id="precArea" maxlength="120"></div>\
            <h5>2. El hecho</h5>\
            <div class="c2"><label for="precMateria">Tema por el que se emitió el reporte *</label><input type="text" id="precMateria" list="precMaterias" placeholder="Elige o escribe"><datalist id="precMaterias"></datalist></div>\
            <div class="c2"><label for="precFecha">Fecha *</label><input type="date" id="precFecha"></div>\
            <div class="c2"><label for="precMotFalta">Motivo que se le atribuye *</label><input type="text" id="precMotFalta" maxlength="300" placeholder="Ej.: abandono de labores sin aviso"></div>\
            <div class="full"><label for="precHechos">Descripción breve *</label><textarea id="precHechos" maxlength="600" placeholder="Qué ocurrió, en pocas líneas (máx. 600 caracteres)"></textarea></div>\
            <div class="full"><label for="precMotivo">Por qué queda como precedente *</label><textarea id="precMotivo" maxlength="600" placeholder="Tu observación: por qué conviene dejarlo registrado"></textarea></div>\
          </div>\
          <div style="display:flex;gap:8px;justify-content:space-between;align-items:center;margin-top:16px;flex-wrap:wrap">\
            <span style="font-size:11.5px;color:#64748b" id="precPie">Sin PDF: solo tu observación breve.</span>\
            <span style="display:flex;gap:8px"><button class="prec-btn n" onclick="PREC.tab(\'l\')">Cancelar</button>\
            <button class="prec-btn g" id="precBtnGuardar" onclick="PREC.guardar()">💾 Guardar precedente</button></span></div>\
        </div>\
        <div id="precVistaF" style="display:none" class="prec-ficha"></div>\
      </div></div>';
    document.body.appendChild(d);
    var y = new Date().getFullYear(), fa = $('precFAnio'); for (var i = y; i >= 2023; i--) { var o = document.createElement('option'); o.value = i; o.textContent = i; fa.appendChild(o); }
    pintarMaterias();
  }
  function pintarMaterias() {
    var todas = MATERIAS.slice(); materiasAz.forEach(function (m) { if (todas.indexOf(m.materia) < 0) todas.push(m.materia); });
    var dl = $('precMaterias'), fm = $('precFMat'); if (!dl || !fm) return;
    dl.innerHTML = todas.map(function (m) { return '<option value="' + esc(m) + '">'; }).join('');
    var act = fm.value; fm.innerHTML = '<option value="">Todos los temas</option>' + todas.map(function (m) { return '<option value="' + esc(m) + '">' + esc(m) + '</option>'; }).join(''); fm.value = act;
  }

  /* ── AVISO GENERAL de reincidencia (casos y precedentes de cualquier usuario; de lo ajeno solo lo minimo) ── */
  function htmlAviso(j) {
    if (!j || !j.success || !j.total) return '';
    var partes = [];
    if (j.casos) partes.push(j.casos + (j.casos === 1 ? ' caso' : ' casos'));
    if (j.precedentes) partes.push(j.precedentes + (j.precedentes === 1 ? ' precedente' : ' precedentes'));
    var lineas = (j.items || []).map(function (x) {
      var quien = x.mio ? '<b>ti</b>' : '<b>' + esc(x.por || '—') + '</b>' + (x.sector ? ' · Sector <b>' + esc(x.sector) + '</b>' : '');
      var link = (x.tipo === 'PRECEDENTE' && x.id) ? ' · <a href="#" onclick="PREC.verDesdeAviso(' + x.id + ');return false">ver ficha</a>' : (x.tipo === 'CASO' && x.nro ? ' · N° ' + esc(x.nro) : '');
      return '<div class="ln"><span class="tp ' + (x.tipo === 'CASO' ? 'c' : 'p') + '">' + x.tipo + '</span><span>' + fecha(x.fecha) + ' · ' + esc(x.motivo || 'sin motivo') + ' · registrado por ' + quien + link + '</span></div>';
    }).join('');
    var mas = j.total > (j.items || []).length ? '<div class="ln"><span class="tp" style="background:#64748b">+' + (j.total - j.items.length) + '</span><span>registros más antiguos</span></div>' : '';
    return '<div class="prec-aviso" role="status"><b class="t">⚠️ Este trabajador ya tiene ' + partes.join(' y ') + (j.total === 1 ? ' registrado' : ' registrados') + '</b>' + lineas + mas +
      '<div class="pie">De lo registrado por otro compañero solo ves fecha, tipo, motivo, sector y supervisor. El detalle lo ve quien lo registró y el administrador. Este aviso no impide registrar.</div></div>';
  }
  var _avisoSeq = 0;
  async function pintarAviso(dni, cont, excluirId) {
    if (!cont) return;
    var mi = ++_avisoSeq; dni = String(dni || '').replace(/\D/g, '');
    if (dni.length !== 8) { cont.style.display = 'none'; cont.innerHTML = ''; return; }
    try {
      var j = await api('aviso', { dni: dni, excluir_id: excluirId || undefined, tope: 5 });
      if (mi !== _avisoSeq && cont.id === 'precAviso') return;   /* llego tarde: ya se escribio otro DNI */
      var h = htmlAviso(j); cont.innerHTML = h; cont.style.display = h ? 'block' : 'none';
    } catch (e) { cont.style.display = 'none'; cont.innerHTML = ''; }   /* el aviso nunca estorba el registro */
  }

  /* ── boton en Registro de Casos ── */
  function inyectarBoton() {
    if ($('btnPrecedentes')) return true;
    /* v1.1: va en el encabezado de Registro de Casos, junto a "+ Nuevo Caso" (la barra antigua de Exportar esta oculta por la UI moderna) */
    var ancla = $('btnCumplimientoCasos');
    if (!ancla) { ancla = Array.prototype.slice.call(document.querySelectorAll('button.btn-n')).filter(function (b) { return /abrirNuevoCaso/.test(b.getAttribute('onclick') || ''); })[0]; }
    if (!ancla || !ancla.parentNode) return false;
    var b = document.createElement('button'); b.className = 'btn-n'; b.id = 'btnPrecedentes'; b.textContent = '⚖️ Precedentes';
    b.style.cssText = 'background:#0b1e45'; b.onclick = function () { PREC.abrir(); };
    ancla.parentNode.insertBefore(b, ancla.nextSibling);
    return true;
  }

  var PREC = {
    abrir: function () {
      montar();
      var adm = esAdmin();
      $('precTitulo').textContent = adm ? 'Precedentes (todos los usuarios)' : 'Mis precedentes';
      $('precTabL').textContent = adm ? '🔎 Todos los precedentes' : '🔎 Mis precedentes';
      $('precFUsr').style.display = adm ? '' : 'none'; $('precThUsr').style.display = adm ? '' : 'none';
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
      var tb = $('precTb'), adm = esAdmin(), cols = adm ? 8 : 7; tb.innerHTML = '<tr><td colspan="8" class="prec-vacio">Cargando…</td></tr>';
      try {
        var j = await api('listar', { q: $('precQ').value, materia: $('precFMat').value, empresa: $('precFEmp').value, anio: $('precFAnio').value, creado_por: adm ? $('precFUsr').value : '', top: 300 });
        lista = (j && j.data) || [];
        if (adm && !$('precFUsr').value) {   /* lista de "Registrado por" a partir de lo que hay */
          var us = {}; lista.forEach(function (p) { var u = String(p.creado_por || '').toLowerCase(); if (u) us[u] = p.creado_nombre || u; });
          var fu = $('precFUsr'); fu.innerHTML = '<option value="">Registrado por: todos</option>' + Object.keys(us).sort().map(function (u) { return '<option value="' + esc(u) + '">' + esc(us[u]) + '</option>'; }).join('');
        }
        if (!lista.length) { tb.innerHTML = '<tr><td colspan="' + cols + '" class="prec-vacio">' + (adm ? 'No hay precedentes con esos filtros.' : 'Todavía no has registrado precedentes con esos filtros. Usa <b>➕ Registrar precedente</b>.') + '</td></tr>'; return; }
        tb.innerHTML = lista.map(function (p) {
          var w = puedeTocar(p);
          return '<tr><td><b>' + esc(p.codigo) + '</b></td>' +
            '<td>' + fecha(p.caso_fecha || p.creado) + '</td>' +
            '<td><b>' + esc(p.nombre || '—') + '</b><br><span style="font-size:10.5px;color:#64748b">' + esc(p.dni || '') + (p.empresa ? ' · ' + esc(p.empresa) : '') + '</span></td>' +
            '<td><span class="prec-chip">' + esc(p.materia) + '</span></td>' +
            '<td style="max-width:260px;color:#334155">' + esc(p.motivo_falta || (p.motivo_precedente || '').slice(0, 120)) + '</td>' +
            '<td>' + esc(p.ruta || '—') + '</td>' +
            (adm ? '<td>' + esc(p.creado_nombre || p.creado_por || '') + (p.creado_sector ? '<br><span style="font-size:10.5px;color:#64748b">' + esc(p.creado_sector) + '</span>' : '') + '</td>' : '') +
            '<td style="white-space:nowrap"><button class="prec-btn p sm" onclick="PREC.ver(' + p.id + ')">👁 Ver</button>' +
            (w ? ' <button class="prec-btn n sm" title="Editar" aria-label="Editar" onclick="PREC.editar(' + p.id + ')">✏️</button> <button class="prec-btn r sm" title="Eliminar" aria-label="Eliminar" onclick="PREC.eliminar(' + p.id + ',\'' + esc(p.codigo) + '\')">🗑</button>' : '') + '</td></tr>';
        }).join('');
      } catch (e) { tb.innerHTML = '<tr><td colspan="' + cols + '" class="prec-vacio">❌ ' + esc(e.message) + '</td></tr>'; }
    },
    ver: async function (id) {
      try {
        var j = await api('obtener', { id: id }); if (!j.success) throw new Error(j.error);
        var p = j.data, f = $('precVistaF'), viejo = !!(p.procedimiento && String(p.procedimiento).trim());
        f.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><div><span class="prec-chip">' + esc(p.codigo) + '</span> <span class="prec-chip">' + esc(p.materia) + '</span>' +
          (viejo && p.sancion ? ' <span class="prec-chip s">' + esc(p.sancion) + '</span>' : '') + '</div>' +
          '<div style="display:flex;gap:6px"><button class="prec-btn n sm" onclick="PREC.tab(\'l\')">← Volver</button>' + (puedeTocar(p) ? '<button class="prec-btn p sm" onclick="PREC.editar(' + p.id + ')">✏️ Editar</button>' : '') + '</div></div>' +
          '<div class="meta"><span>👤 <b>' + esc(p.nombre || '—') + '</b></span><span>DNI ' + esc(p.dni || '—') + '</span><span>' + esc(p.empresa || '') + '</span>' +
          (p.ruta ? '<span>Ruta ' + esc(p.ruta) + '</span>' : '') + (p.cod_trabajador ? '<span>Código ' + esc(p.cod_trabajador) + '</span>' : '') + ((p.area || p.fundo) ? '<span>Área ' + esc(p.area || p.fundo) + '</span>' : '') +
          '<span>📅 ' + fecha(p.caso_fecha) + '</span>' + (p.caso_nro ? '<span>📁 Caso ' + esc(p.caso_nro) + '</span>' : '') + '</div>' +
          (p.motivo_falta ? '<h4>Motivo que se le atribuye</h4><p>' + esc(p.motivo_falta) + '</p>' : '') +
          '<h4>' + (viejo ? 'Resumen de los hechos' : 'Descripción breve') + '</h4><p>' + esc(p.hechos) + '</p>' +
          (viejo ? '<h4>Cómo se procedió y resultado</h4><p>' + esc(p.procedimiento) + '</p>' : '') +
          '<h4>Por qué queda como precedente</h4><p style="background:#fffbeb;border-left:3px solid #f59e0b;padding:8px 10px;border-radius:6px">' + esc(p.motivo_precedente) + '</p>' +
          (p.palabras_clave ? '<h4>Palabras clave</h4><p>' + esc(p.palabras_clave) + '</p>' : '') +
          ((p.adjuntos || []).length ? '<h4>Adjuntos</h4><div class="prec-adj">' + p.adjuntos.map(function (a) { return '<a href="' + esc(a.url) + '" target="_blank" rel="noopener">📎 ' + esc(a.nombre || 'archivo') + '</a>'; }).join('') + '</div>' : '') +
          '<div class="meta" style="margin-top:14px;color:#64748b;font-size:11px"><span>Registrado por ' + esc(p.creado_nombre || p.creado_por) + (p.creado_sector ? ' · ' + esc(p.creado_sector) : '') + ' · ' + fecha(p.creado) + '</span>' + (p.actualizado ? '<span>Actualizado por ' + esc(p.actualizado_por) + ' · ' + fecha(p.actualizado) + '</span>' : '') + '</div>';
        PREC.tab('f');
      } catch (e) { toast('❌ ' + e.message, 'error'); }
    },
    verDesdeAviso: function (id) { if (!$('mPrec') || !$('mPrec').classList.contains('on')) PREC.abrir(); PREC.ver(id); },   /* abre el banco encima del formulario y muestra la ficha */
    _viejo: null,
    nuevo: function () {
      editandoId = null; PREC._viejo = null;
      ['precDni', 'precNombre', 'precRuta', 'precCod', 'precArea', 'precMateria', 'precMotFalta', 'precHechos', 'precMotivo'].forEach(function (id) { $(id).value = ''; });
      $('precEmp').value = ''; $('precFecha').value = hoy(); $('precDniMsg').textContent = '';
      $('precAviso').style.display = 'none'; $('precAviso').innerHTML = '';
      $('precPie').textContent = 'Sin PDF: solo tu observación breve.';
      $('precBtnGuardar').textContent = '💾 Guardar precedente'; PREC.tab('n');
    },
    editar: async function (id) {
      try {
        var j = await api('obtener', { id: id }); if (!j.success) throw new Error(j.error);
        var p = j.data; if (!puedeTocar(p)) return toast('🔒 Ese precedente lo registró otro usuario', 'error');
        PREC.nuevo(); editandoId = p.id;
        /* lo que el formulario breve no muestra (precedentes anteriores) se conserva tal cual al guardar */
        PREC._viejo = { fundo: p.fundo, cargo: p.cargo, caso_nro: p.caso_nro, procedimiento: p.procedimiento, sancion: p.sancion, palabras_clave: p.palabras_clave, adjuntos: p.adjuntos || [] };
        $('precDni').value = p.dni || ''; $('precNombre').value = p.nombre || ''; $('precEmp').value = p.empresa || '';
        $('precRuta').value = p.ruta || ''; $('precCod').value = p.cod_trabajador || ''; $('precArea').value = p.area || p.fundo || '';
        $('precFecha').value = p.caso_fecha || ''; $('precMateria').value = p.materia || ''; $('precMotFalta').value = p.motivo_falta || '';
        $('precHechos').value = p.hechos || ''; $('precMotivo').value = p.motivo_precedente || '';
        if ((p.adjuntos || []).length || (p.procedimiento && String(p.procedimiento).trim())) $('precPie').textContent = 'Precedente anterior: sus adjuntos y el detalle de cómo se procedió se conservan.';
        pintarAviso(p.dni, $('precAviso'), p.id);
        $('precBtnGuardar').textContent = '💾 Guardar cambios (' + p.codigo + ')';
      } catch (e) { toast('❌ ' + e.message, 'error'); }
    },
    eliminar: function (id, codigo) {
      confirmar('¿Eliminar el precedente ' + codigo + '?', 'Deja de mostrarse y deja de aparecer en los avisos (queda guardado como inactivo en Supabase).', async function () {
        try { var j = await api('eliminar', { id: id }); if (!j.success) throw new Error(j.error); toast('🗑 ' + codigo + ' eliminado'); PREC.listar(); } catch (e) { toast('❌ ' + e.message, 'error'); }
      });
    },
    dniCambio: function () {
      var dni = $('precDni').value.replace(/\D/g, ''); $('precDni').value = dni;
      if (dni.length === 8) PREC.buscarDni(); else { $('precAviso').style.display = 'none'; $('precAviso').innerHTML = ''; }
    },
    buscarDni: async function () {
      var dni = $('precDni').value.replace(/\D/g, ''); if (dni.length < 7) return;
      pintarAviso(dni, $('precAviso'), editandoId);   /* el aviso general sale aunque el trabajador no este en la base */
      $('precDniMsg').textContent = 'Buscando en Supabase…';
      try {
        var r = (typeof _buscarTrabApi === 'function') ? await _buscarTrabApi(dni, 'AMBAS') : null;
        var t = r && r.success && r.data && r.data[0];
        if (t) {
          var e = String(t.empresa || '').toUpperCase();
          $('precNombre').value = t.nombre || ''; $('precEmp').value = e.indexOf('RAPEL') >= 0 ? 'RAPEL' : e.indexOf('VERFRUT') >= 0 ? 'VERFRUT' : e.indexOf('OLMOS') >= 0 ? 'OLMOS' : $('precEmp').value;
          if (!$('precRuta').value) $('precRuta').value = t.ruta || '';
          if (!$('precCod').value) $('precCod').value = t.codigo || '';
          if (!$('precArea').value) $('precArea').value = t.fundo_actual || t.fundo || '';
          $('precDniMsg').textContent = '✅ Trabajador encontrado';
        } else $('precDniMsg').textContent = 'No está en la base de trabajadores (puede ser ex trabajador): completa el nombre a mano';
      } catch (e) { $('precDniMsg').textContent = 'No se pudo consultar: completa los datos a mano'; }
    },
    guardar: async function () {
      var v = PREC._viejo || {};
      var b = { id: editandoId, dni: $('precDni').value.replace(/\D/g, ''), nombre: $('precNombre').value.trim(), empresa: $('precEmp').value,
        ruta: $('precRuta').value.trim(), cod_trabajador: $('precCod').value.trim(), area: $('precArea').value.trim(),
        caso_fecha: $('precFecha').value, materia: $('precMateria').value.trim(), motivo_falta: $('precMotFalta').value.trim(),
        hechos: $('precHechos').value.trim(), motivo_precedente: $('precMotivo').value.trim(),
        fundo: v.fundo || $('precArea').value.trim(), cargo: v.cargo || '', caso_nro: v.caso_nro || '', procedimiento: v.procedimiento || '', sancion: v.sancion || '', palabras_clave: v.palabras_clave || '', adjuntos: v.adjuntos || [] };
      var faltan = [];
      if (b.dni.length !== 8 && !(editandoId && !b.dni)) faltan.push('DNI de 8 dígitos');   /* un precedente anterior sin DNI se puede seguir editando */ if (!b.materia) faltan.push('tema del reporte'); if (!b.caso_fecha) faltan.push('fecha');
      if (!b.motivo_falta) faltan.push('motivo que se le atribuye'); if (!b.hechos) faltan.push('descripción breve'); if (!b.motivo_precedente) faltan.push('por qué queda como precedente');
      if (faltan.length) return toast('❌ Falta: ' + faltan.join(', '), 'error');
      var btn = $('precBtnGuardar'); btn.disabled = true; btn.textContent = '⏳ Guardando…';
      try {
        var j = await api(editandoId ? 'editar' : 'guardar', b); if (!j.success) throw new Error(j.error || 'No se pudo guardar');
        toast('✅ Precedente ' + (j.codigo || 'actualizado') + ' guardado en Supabase');
        try { if (window.RLTrafico) RLTrafico.emit({ accion: (editandoId ? 'Editó' : 'Registró') + ' precedente ' + (j.codigo || ''), destino: 'Supabase' }); } catch (e) {}
        PREC.tab('l'); PREC.listar();
        api('materias').then(function (r) { if (r && r.success) { materiasAz = r.materias || []; pintarMaterias(); } }).catch(function () {});
      } catch (e) { toast('❌ ' + e.message, 'error'); }
      finally { btn.disabled = false; btn.textContent = editandoId ? '💾 Guardar cambios' : '💾 Guardar precedente'; }
    },
    aviso: function (dni, cont, excluirId) { return pintarAviso(dni, cont, excluirId); }
  };
  window.PREC = PREC;

  /* ── AVISO en "Nuevo caso": al escribir o buscar el DNI (no se muestra al editar un caso que ya existe) ── */
  function engancharCaso() {
    var apagado = false; try { apagado = localStorage.getItem('rl_prec_aviso') === 'off'; } catch (e) {}
    var inp = $('mCasoDNI'), msg = $('cBuscarMsg');
    if (apagado || !inp || !msg || $('precAvisoCaso')) return !!$('precAvisoCaso') || apagado;
    var caja = document.createElement('div'); caja.id = 'precAvisoCaso'; caja.style.display = 'none';
    msg.parentNode.insertBefore(caja, msg.nextSibling);
    var editando = function () { try { return typeof _editandoCasoNro !== 'undefined' && _editandoCasoNro !== null && _editandoCasoNro !== ''; } catch (e) { return false; } };
    var ultimo = '';
    var revisar = function () {
      var dni = String(inp.value || '').replace(/\D/g, '');
      if (dni.length !== 8 || editando()) { ultimo = ''; caja.style.display = 'none'; caja.innerHTML = ''; return; }
      if (dni === ultimo && caja.innerHTML) return;
      ultimo = dni; pintarAviso(dni, caja, 0);
    };
    inp.addEventListener('input', revisar); inp.addEventListener('change', revisar);
    var prev = window.buscarTrabajadorCaso;
    if (typeof prev === 'function' && !prev._precAviso) {
      var w = function () { var r; try { r = prev.apply(this, arguments); } finally { setTimeout(revisar, 0); } return r; };
      w._precAviso = true; window.buscarTrabajadorCaso = w;
    }
    /* al abrir el formulario con el DNI ya puesto (o vacio) se actualiza solo */
    var mod = $('mCaso');
    if (mod && typeof MutationObserver !== 'undefined') { try { new MutationObserver(function () { setTimeout(revisar, 150); }).observe(mod, { attributes: true, attributeFilter: ['class', 'style'] }); } catch (e) {} }
    return true;
  }

  /* el boton aparece cuando la pantalla de casos ya esta en el DOM (es estatica, pero por si carga tarde) */
  if (!inyectarBoton()) { var n = 0, it = setInterval(function () { if (inyectarBoton() || ++n > 40) clearInterval(it); }, 500); }
  if (!engancharCaso()) { var n2 = 0, it2 = setInterval(function () { if (engancharCaso() || ++n2 > 40) clearInterval(it2); }, 500); }
  console.log('[_PREC_UI_V1 · _PREC_USUARIO_V1] Precedentes por usuario con aviso general listo');
})();
