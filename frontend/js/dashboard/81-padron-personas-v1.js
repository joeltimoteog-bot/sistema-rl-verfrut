/* ═══════════════════════════════════════════════════════════════════════════
   81-padron-personas-v1.js — _PADRON_PERSONAS_V1 (10-nov-2026)
   PADRÓN DE PERSONAS · pantalla de mantenimiento (paso 3 de migracion/padron/PLAN.md)
   · SOLO el creador del sistema (jtimoteo). El botón del menú se crea únicamente en su sesión; la
     restricción verdadera está en el servidor: POST /api/personas/{lista|guardar} responde 403 a
     cualquier otro usuario.
   · Lee y guarda en rl.personas (Supabase). No existe "eliminar": dar de baja = Vigente "No" + fecha "hasta".
   · Se abre en un cuadro dentro de la misma página (Shadow DOM: no hereda ni altera estilos del
     sistema). Alturas en dvh (no se corta en celular). Formulario en UNA sola hoja.
   · Solo AGREGA: no cambia ninguna pantalla ni lista existente.
   · Apagar en un navegador:  localStorage.rl_padron = 'off'  (y recargar).
   · window.rlPadronPersonas = { abrir, cerrar }
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.rlPadronPersonas) return;
  var APAGADO = false; try { APAGADO = localStorage.getItem('rl_padron') === 'off'; } catch (e) {}
  if (APAGADO) { window.rlPadronPersonas = { abrir: function () {}, apagado: true, version: 1 }; return; }

  /* ── configuración ── */
  var SOLO_USUARIO = 'jtimoteo';
  var LIMITE_MS = 30000;
  var NO_PUBLICADO = 'El padrón aún no está publicado en el servidor';
  var SOLO_CREADOR = 'El padrón de personas es solo para el creador del sistema';
  var BASE = (function () { try { if (typeof AZURE_FN_BASE === 'string' && AZURE_FN_BASE) return AZURE_FN_BASE; } catch (e) {} return 'https://rl-fn-verfrut.azurewebsites.net/api'; })();   /* azure-token.js la lleva a Supabase */
  var ROL_TXT = { SUPERVISOR_GH: 'Supervisor de Gestión Humana', ASISTENTE_RL: 'Asistente de Relaciones Laborales', BIENESTAR_SOCIAL: 'Bienestar Social', COORDINACION: 'Coordinación',
    JEFATURA: 'Jefatura', ANALISTA_GH: 'Analista de Gestión Humana', REMUNERACIONES: 'Remuneraciones', DIGITADOR: 'Digitador', OTRO: 'Otro' };

  /* ── utilitarios ── */
  var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); };
  var MAY = function (s) { return String(s == null ? '' : s).toUpperCase(); };
  var plano = function (s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); };
  var fF = function (f) { return f ? String(f).slice(0, 10).split('-').reverse().join('/') : ''; };
  var p2 = function (n) { return String(n).padStart(2, '0'); };
  var hoy = function () { var d = new Date(); return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); };
  function usuario() {
    try { if (typeof USER !== 'undefined' && USER && USER.usuario) return String(USER.usuario).trim().toLowerCase(); } catch (e) {}
    try { var u = JSON.parse(sessionStorage.getItem('user') || 'null'); return u && u.usuario ? String(u.usuario).trim().toLowerCase() : ''; } catch (e) { return ''; }
  }
  var esCreador = function () { return usuario() === SOLO_USUARIO; };
  var aviso = function (m, tipo) { try { if (typeof mostrarToast === 'function') return mostrarToast(m, tipo || 'error'); } catch (e) {} if (tipo !== 'success') alert(m); };
  var nomCompleto = function (p) { return MAY(((p.apellidos || '') + ' ' + (p.nombres || '')).trim() || p.nombre_mostrar || ''); };

  /* ── servidor (límite de 30 s; nunca muestra textos técnicos) ── */
  async function pedir(accion, cuerpo) {
    var tk = ''; try { tk = sessionStorage.getItem('rl_token') || ''; } catch (e) {}
    if (!tk) throw new Error('Tu sesión venció: vuelve a iniciar sesión');
    var ctl = (typeof AbortController === 'function') ? new AbortController() : null, vencio = false;
    var reloj = setTimeout(function () { vencio = true; if (ctl) { try { ctl.abort(); } catch (e) {} } }, LIMITE_MS);
    var r, j = null;
    try {
      var envio = fetch(BASE + '/personas/' + accion, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tk }, body: JSON.stringify(cuerpo || {}), signal: ctl ? ctl.signal : undefined });
      var tope = new Promise(function (_, no) { setTimeout(function () { vencio = true; no(new Error('tiempo')); }, LIMITE_MS + 500); });
      r = await Promise.race([envio, tope]);
      j = await Promise.race([r.json().catch(function () { return null; }), tope]);
    } catch (e) {
      throw new Error(vencio ? 'El servidor tardó demasiado en responder. Intenta de nuevo en unos minutos.' : 'No hay conexión con el servidor o ' + NO_PUBLICADO.charAt(0).toLowerCase() + NO_PUBLICADO.slice(1) + '. Intenta de nuevo en unos minutos.');
    } finally { clearTimeout(reloj); }
    if (r.status === 401) throw new Error('Tu sesión venció: vuelve a iniciar sesión');
    if (r.status === 403) throw new Error(SOLO_CREADOR);
    if (r.status === 404) throw new Error(NO_PUBLICADO);
    if (r.status === 400 && j && j.error) { var e4 = new Error(String(j.error)); e4.campo = j.campo || ''; throw e4; }
    if (r.status >= 500) throw new Error('El servidor tuvo un problema. Intenta de nuevo en unos minutos.');
    if (!j) throw new Error(NO_PUBLICADO);
    if (!r.ok || !j.success) throw new Error('No se pudo completar la operación. Intenta de nuevo.');
    return j;
  }

  /* ── estado ── */
  var HOST = null, RAIZ = null;
  var D = { personas: [], sectores: [], roles: [], empresas: [], usuarios: null };
  var F = { q: '', estado: 'vigentes', empresa: '', sector: '' };
  var q = function (sel) { return RAIZ ? RAIZ.querySelector(sel) : null; };
  var secNombre = function (cod) { if (!cod) return ''; var k = plano(cod); for (var i = 0; i < D.sectores.length; i++) if (plano(D.sectores[i].codigo) === k) return D.sectores[i].nombre || cod; return cod; };
  var esVig = function (p) { return Number(p.vigente) === 1; };
  var sinDni = function (p) { return !String(p.dni || '').trim(); };

  function filtradas() {
    var t = plano(F.q).trim().split(/\s+/).filter(Boolean);
    return D.personas.filter(function (p) {
      if (F.estado === 'vigentes' && !esVig(p)) return false;
      if (F.estado === 'no' && esVig(p)) return false;
      if (F.estado === 'sindni' && !sinDni(p)) return false;
      if (F.estado === 'vigsindni' && !(esVig(p) && sinDni(p))) return false;
      if (F.empresa === '-' ? !!p.empresa : (F.empresa && MAY(p.empresa) !== F.empresa)) return false;
      if (F.sector === '-' ? !!p.sector : (F.sector && plano(p.sector) !== plano(F.sector))) return false;
      if (!t.length) return true;
      var txt = plano([p.dni, p.apellidos, p.nombres, p.nombre_mostrar, p.usuario, p.cargo, p.correo, p.alias, secNombre(p.sector), p.empresa].join(' '));
      return t.every(function (x) { return txt.indexOf(x) >= 0; });
    });
  }

  function css() {
    return '<style>:host{all:initial}*{box-sizing:border-box}' +
      '.ov{position:fixed;inset:0;z-index:2147483000;background:rgba(10,20,40,.55);display:flex;align-items:center;justify-content:center;padding:10px;font-family:Arial,Helvetica,sans-serif;color:#0F172A}' +
      '.box{background:#F1F5F9;border-radius:14px;width:100%;max-width:1180px;height:94vh;height:94dvh;max-height:94dvh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.3)}' +
      '.hd{padding:10px 14px;display:flex;justify-content:space-between;align-items:flex-start;gap:10px;border-bottom:1px solid #E2E8F0;background:#fff;flex:0 0 auto}.hd b{font-size:17px;color:#0E2A5C}.hd small{display:block;color:#5B6B82;font-size:12px;margin-top:2px}' +
      '.bd{padding:12px 14px 18px;overflow:auto;flex:1 1 auto;min-height:0;-webkit-overflow-scrolling:touch}' +
      '.b{min-height:38px;padding:0 13px;border-radius:9px;border:1.5px solid #0E2A5C;background:#fff;font:700 13px Arial,sans-serif;color:#0E2A5C;cursor:pointer;white-space:nowrap}.b.p{background:#0E2A5C;color:#fff}.b:disabled{opacity:.45;cursor:not-allowed}' +
      '.f{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:10px 12px}' +
      'label{display:block;font-size:12px;font-weight:700;color:#475569;margin:0 0 4px}' +
      'input,select,textarea{width:100%;min-height:38px;padding:6px 8px;border:1.5px solid #C7D2E6;border-radius:9px;font:600 14px Arial,sans-serif;background:#fff;color:#0F172A;max-width:100%}textarea{min-height:64px;resize:vertical;font-weight:400}' +
      'input:focus,select:focus,textarea:focus{outline:2px solid #2563EB;outline-offset:1px}.malo{border-color:#DC2626;background:#FEF2F2}' +
      '.f .g{flex:1 1 150px}.f .g.q{flex:2 1 240px}.acc{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px}' +
      '.chip{display:inline-flex;align-items:center;min-height:34px;padding:0 12px;border-radius:999px;font:700 13px Arial,sans-serif;border:1.5px solid #CBD5E1;background:#fff;color:#334155}' +
      '.chip.al{background:#FEF3C7;border-color:#F59E0B;color:#92400E;cursor:pointer}.chip.ok{background:#DCFCE7;border-color:#22C55E;color:#166534}' +
      '.tw{background:#fff;border:1px solid #E2E8F0;border-radius:12px;margin-top:10px;overflow:auto;-webkit-overflow-scrolling:touch}' +
      'table{width:100%;border-collapse:collapse;font-size:12.5px;min-width:860px}th{background:#0b1e45;color:#fff;padding:8px 7px;text-align:left;font-size:12px;white-space:nowrap;position:sticky;top:0}' +
      'td{padding:8px 7px;border-top:1px solid #EEF2F7;vertical-align:top}tbody tr{cursor:pointer}tbody tr:hover,tbody tr:focus{background:#EFF6FF;outline:none}tr.nv td{color:#64748B;background:#F8FAFC}' +
      '.et{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700}.et.s{background:#DCFCE7;color:#166534}.et.n{background:#E2E8F0;color:#475569}.et.f{background:#FEF3C7;color:#92400E}' +
      '.vacio{padding:18px;text-align:center;color:#64748B;background:#fff;border:1px dashed #CBD5E1;border-radius:12px;margin-top:10px;font-size:14px}.vacio.e{color:#991B1B;border-color:#FCA5A5;background:#FEF2F2}' +
      '.hoja{background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:14px;max-width:860px;margin:0 auto}.hoja h3{margin:0 0 4px;font-size:16px;color:#0E2A5C}.hoja p.s{margin:0 0 12px;font-size:12px;color:#64748B}' +
      '.gr{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 12px}.gr .w{grid-column:1/-1}.ay{font-size:11px;color:#64748B;margin-top:3px}' +
      '.err{display:none;margin:0 0 10px;padding:10px 12px;border-radius:9px;background:#FEF2F2;border:1px solid #FCA5A5;color:#991B1B;font-size:13px;font-weight:700}.err.on{display:block}' +
      '.nota{margin-top:8px;font-size:12px;color:#64748B}' +
      '@media (max-width:640px){.ov{padding:0}.box{height:100vh;height:100dvh;max-height:100dvh;border-radius:0}.hd b{font-size:15px}.bd{padding:10px 8px 16px}.f .g{flex:1 1 44%}.f .g.q{flex:1 1 100%}.gr{grid-template-columns:1fr}.hoja{padding:10px}.acc .b{flex:1 1 auto}}</style>';
  }

  /* ── lista ── */
  var opt = function (L, sel) { return L.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(sel == null ? '' : sel) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join(''); };
  function pintarLista() {
    if (!RAIZ) return;
    var secs = [['', 'Todos los sectores']].concat(D.sectores.map(function (s) { return [s.codigo, s.nombre || s.codigo]; })).concat([['-', '(Sin sector)']]);
    var emps = [['', 'Todas las empresas']].concat(D.empresas.map(function (e) { return [e, e]; })).concat([['-', '(Sin empresa)']]);
    q('#out').innerHTML = '<div class="f">' +
      '<div class="g q"><label for="fq">Buscar</label><input id="fq" type="search" placeholder="DNI, nombre, usuario, cargo, correo…" autocomplete="off" value="' + esc(F.q) + '"></div>' +
      '<div class="g"><label for="fe">Mostrar</label><select id="fe">' + opt([['vigentes', 'Vigentes'], ['no', 'No vigentes'], ['sindni', 'Sin DNI'], ['vigsindni', 'Vigentes sin DNI'], ['todos', 'Todos']], F.estado) + '</select></div>' +
      '<div class="g"><label for="fm">Empresa</label><select id="fm">' + opt(emps, F.empresa) + '</select></div>' +
      '<div class="g"><label for="fs">Sector</label><select id="fs">' + opt(secs, F.sector) + '</select></div></div>' +
      '<div class="acc"><button class="b p" id="nueva" type="button">+ Nueva persona</button><button class="b" id="xls" type="button">Exportar a Excel</button><button class="b" id="rec" type="button">Actualizar</button>' +
      '<span id="cont"></span></div><div id="tabla"></div>' +
      '<div class="nota">Toca una fila para editarla. Nadie se elimina del padrón: para dar de baja se marca Vigente “No” y se indica la fecha “hasta”.</div>';
    q('#fq').oninput = function () { F.q = this.value; pintarTabla(); };
    q('#fe').onchange = function () { F.estado = this.value; pintarTabla(); };
    q('#fm').onchange = function () { F.empresa = this.value; pintarTabla(); };
    q('#fs').onchange = function () { F.sector = this.value; pintarTabla(); };
    q('#nueva').onclick = function () { pintarForm(null); };
    q('#xls').onclick = excel;
    q('#rec').onclick = cargar;
    pintarTabla();
  }
  function pintarTabla() {
    if (!q('#tabla')) return;
    var L = filtradas(), vig = D.personas.filter(esVig), falta = vig.filter(sinDni).length;
    q('#cont').innerHTML = (falta ? '<button type="button" class="chip al" id="cfalta" title="Ver solo los vigentes sin DNI">' + falta + (falta === 1 ? ' vigente sin DNI' : ' vigentes sin DNI') + '</button>'
      : '<span class="chip ok" id="cfalta">0 vigentes sin DNI</span>') +
      ' <span class="chip">' + vig.length + ' vigentes de ' + D.personas.length + '</span> <span class="chip">Mostrando ' + L.length + '</span>';
    var cf = q('#cfalta'); if (cf && falta) cf.onclick = function () { F.estado = 'vigsindni'; F.q = ''; F.empresa = ''; F.sector = ''; pintarLista(); };
    if (!L.length) { q('#tabla').innerHTML = '<div class="vacio">' + (D.personas.length ? 'Ninguna persona coincide con la búsqueda o los filtros.' : 'El padrón todavía no tiene personas.') + '</div>'; return; }
    q('#tabla').innerHTML = '<div class="tw"><table><thead><tr><th>DNI</th><th>Apellidos y nombres</th><th>Cargo</th><th>Empresa</th><th>Sector</th><th>Usuario</th><th>Correo</th><th>Vigente</th></tr></thead><tbody>' +
      L.map(function (p) {
        return '<tr tabindex="0" data-id="' + esc(p.id) + '"' + (esVig(p) ? '' : ' class="nv"') + '>' +
          '<td>' + (sinDni(p) ? '<span class="et f">FALTA</span>' : esc(p.dni)) + '</td>' +
          '<td><b>' + esc(nomCompleto(p)) + '</b></td><td>' + esc(MAY(p.cargo)) + '</td><td>' + esc(MAY(p.empresa)) + '</td><td>' + esc(MAY(secNombre(p.sector))) + '</td>' +
          '<td>' + esc(p.usuario || '') + '</td><td>' + esc(p.correo || '') + '</td>' +
          '<td>' + (esVig(p) ? '<span class="et s">SÍ</span>' : '<span class="et n">NO</span>' + (p.hasta ? '<br><small>hasta ' + esc(fF(p.hasta)) + '</small>' : '')) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    var tb = q('#tabla tbody');
    var abrirFila = function (e) { var tr = e.target && e.target.closest ? e.target.closest('tr[data-id]') : null; if (!tr) return;
      var id = tr.getAttribute('data-id'), p = null; D.personas.forEach(function (x) { if (String(x.id) === id) p = x; }); if (p) pintarForm(p); };
    tb.addEventListener('click', abrirFila);
    tb.addEventListener('keydown', function (e) { if (e.key === 'Enter') abrirFila(e); });
  }

  /* ── formulario (una sola hoja) ── */
  var CAMPOS = ['dni', 'apellidos', 'nombres', 'nombre_mostrar', 'usuario', 'cargo', 'empresa', 'sector', 'rol_campo', 'correo', 'vigente', 'desde', 'hasta', 'alias', 'notas'];
  function pintarForm(p) {
    if (!RAIZ) return;
    var n = !p; p = p || { vigente: 1 };
    var inp = function (id, et, val, extra, ayuda) { return '<div><label for="c-' + id + '">' + et + '</label><input id="c-' + id + '" value="' + esc(val == null ? '' : val) + '" ' + (extra || 'type="text"') + ' autocomplete="off">' + (ayuda ? '<div class="ay">' + ayuda + '</div>' : '') + '</div>'; };
    var sel = function (id, et, L, val, ayuda) { return '<div><label for="c-' + id + '">' + et + '</label><select id="c-' + id + '">' + opt(L, val) + '</select>' + (ayuda ? '<div class="ay">' + ayuda + '</div>' : '') + '</div>'; };
    var con = function (L, val) { var v = String(val == null ? '' : val); if (v && !L.some(function (o) { return plano(o[0]) === plano(v); })) L = L.concat([[v, v]]); return L; };
    var selDe = function (L, val) { var v = String(val == null ? '' : val), r = v; L.forEach(function (o) { if (plano(o[0]) === plano(v)) r = o[0]; }); return r; };
    var Ls = con([['', '(Sin sector)']].concat(D.sectores.map(function (s) { return [s.codigo, (s.nombre || s.codigo) + (s.empresa ? ' · ' + s.empresa : '')]; })), p.sector);
    var Le = con([['', '(Sin empresa)']].concat(D.empresas.map(function (e) { return [e, e]; })), p.empresa);
    var Lr = con([['', '(Sin función)']].concat(D.roles.map(function (r) { return [r, ROL_TXT[r] || r]; })), p.rol_campo);
    var dl = D.usuarios && D.usuarios.length ? '<datalist id="dl-usr">' + D.usuarios.map(function (u) { return '<option value="' + esc(u.usuario) + '">' + esc(u.nombre || '') + '</option>'; }).join('') + '</datalist>' : '';
    q('#out').innerHTML = '<div class="hoja"><h3>' + (n ? 'Nueva persona' : esc(nomCompleto(p))) + '</h3>' +
      '<p class="s">' + (n ? 'Completa los datos y pulsa Guardar.' : 'Última actualización: ' + esc(p.actualizado ? new Date(p.actualizado).toLocaleString('es-PE') : '—') + (p.actualizado_por ? ' · por ' + esc(p.actualizado_por) : '')) + '</p>' +
      '<div class="err" id="err" role="alert"></div><div class="gr">' +
      inp('dni', 'DNI', p.dni, 'type="text" inputmode="numeric" maxlength="8" placeholder="8 dígitos"', 'Déjalo vacío si aún no está confirmado.') +
      sel('vigente', 'Vigente', [['1', 'Sí · en funciones'], ['0', 'No · dado de baja']], esVig(p) ? '1' : '0') +
      inp('apellidos', 'Apellidos *', p.apellidos, 'type="text" maxlength="120"') +
      inp('nombres', 'Nombres *', p.nombres, 'type="text" maxlength="120"') +
      inp('nombre_mostrar', 'Nombre a mostrar', p.nombre_mostrar, 'type="text" maxlength="200"', 'Nombre oficial que verán las pantallas e informes. Vacío = nombres + apellidos.') +
      inp('usuario', 'Usuario del sistema', p.usuario, 'type="text" maxlength="60" list="dl-usr" autocapitalize="none" spellcheck="false"', 'Solo si tiene cuenta en el Sistema RR.LL.') +
      inp('cargo', 'Cargo', p.cargo, 'type="text" maxlength="160"') +
      sel('empresa', 'Empresa', Le, selDe(Le, p.empresa)) +
      sel('sector', 'Sector', Ls, selDe(Ls, p.sector)) +
      sel('rol_campo', 'Función / rol de campo', Lr, selDe(Lr, p.rol_campo)) +
      inp('correo', 'Correo', p.correo, 'type="email" maxlength="160" autocapitalize="none" spellcheck="false"') +
      '<div></div>' +
      inp('desde', 'Desde', p.desde, 'type="date"', 'Desde cuándo está en la función o sector.') +
      inp('hasta', 'Hasta', p.hasta, 'type="date"', 'Solo para quien ya no está vigente.') +
      '<div class="w"><label for="c-alias">Alias (otras formas en que aparece su nombre, una por línea)</label><textarea id="c-alias" maxlength="1000">' + esc(String(p.alias || '').split('|').join('\n')) + '</textarea></div>' +
      '<div class="w"><label for="c-notas">Notas</label><textarea id="c-notas" maxlength="2000">' + esc(p.notas || '') + '</textarea></div>' +
      '</div>' + dl + '<div class="acc"><button class="b p" id="guardar" type="button">Guardar</button><button class="b" id="volver" type="button">Cancelar y volver a la lista</button></div></div>';
    q('.bd').scrollTop = 0;
    q('#volver').onclick = pintarLista;
    q('#c-vigente').onchange = function () { if (this.value === '0' && !q('#c-hasta').value) q('#c-hasta').value = hoy(); };
    q('#c-dni').oninput = function () { var v = this.value.replace(/\D+/g, '').slice(0, 8); if (v !== this.value) this.value = v; };
    q('#guardar').onclick = function () { guardar(n ? null : p.id); };
  }
  function error(msg, campo) {
    var e = q('#err'); if (!e) { if (msg) aviso(msg); return; }
    CAMPOS.forEach(function (k) { var c = q('#c-' + k); if (c) c.classList.remove('malo'); });
    e.textContent = msg || ''; e.classList.toggle('on', !!msg);
    if (msg) { var c = campo ? q('#c-' + campo) : null; if (c) { c.classList.add('malo'); try { c.focus(); } catch (x) {} } q('.bd').scrollTop = 0; }
  }
  var GUARDANDO = false;
  async function guardar(id) {
    if (GUARDANDO || !RAIZ) return;
    var v = {}; CAMPOS.forEach(function (k) { var c = q('#c-' + k); v[k] = c ? String(c.value).trim() : ''; });
    /* mismas reglas que el servidor (él vuelve a comprobarlas) */
    if (v.dni && !/^\d{8}$/.test(v.dni)) return error('El DNI debe tener exactamente 8 dígitos (o quedar vacío si aún no se confirma).', 'dni');
    if (!v.apellidos) return error('Escribe los apellidos.', 'apellidos');
    if (!v.nombres) return error('Escribe los nombres.', 'nombres');
    if (v.correo && !/^[^\s@,;]+@[^\s@,;]+\.[A-Za-z]{2,}$/.test(v.correo)) return error('El correo no tiene un formato válido (ejemplo: nombre@unifrutti.com).', 'correo');
    if (v.desde && v.hasta && v.hasta < v.desde) return error('La fecha “hasta” no puede ser anterior a la fecha “desde”.', 'hasta');
    if (v.vigente === '1' && v.hasta) return error('Una persona vigente no lleva fecha “hasta”. Borra esa fecha o márcala como no vigente.', 'hasta');
    if (v.dni) { var rep = null; D.personas.forEach(function (x) { if (String(x.dni || '') === v.dni && String(x.id) !== String(id)) rep = x; });
      if (rep) return error('Ese DNI ya está registrado a nombre de ' + nomCompleto(rep) + '. Revisa el número.', 'dni'); }
    v.alias = v.alias.split(/[|\r\n]+/).map(function (x) { return x.trim(); }).filter(Boolean).join('|');
    v.vigente = v.vigente === '0' ? 0 : 1;
    if (id != null) v.id = id;
    var b = q('#guardar'), b2 = q('#volver'); GUARDANDO = true; error('');
    if (b) { b.disabled = true; b.textContent = 'Guardando…'; } if (b2) b2.disabled = true;
    try {
      var j = await pedir('guardar', v), np = j.persona;
      if (!np || np.id == null) throw new Error('El servidor devolvió una respuesta incompleta. Actualiza la lista para confirmar si se guardó.');
      var hallado = false; D.personas = D.personas.map(function (x) { if (String(x.id) === String(np.id)) { hallado = true; return np; } return x; });
      if (!hallado) D.personas.push(np);
      GUARDANDO = false;
      if (!RAIZ) return;
      pintarLista();
      aviso(j.sinCambios ? 'No había cambios que guardar' : (j.creado ? 'Persona agregada al padrón' : 'Cambios guardados') + (j.rastro === false ? ' (no se pudo anotar en la bitácora: avisa al administrador)' : ''), j.rastro === false ? 'warning' : 'success');
    } catch (e) {
      GUARDANDO = false;
      if (b) { b.disabled = false; b.textContent = 'Guardar'; } if (b2) b2.disabled = false;
      error((e && e.message) || 'No se pudo guardar. Intenta de nuevo.', e && e.campo);
    }
  }

  /* ── Excel (lo que se ve con los filtros actuales) ── */
  function excel() {
    if (!window.XLSX) { aviso('No se pudo cargar la librería de Excel en esta página'); return; }
    var L = filtradas(); if (!L.length) { aviso('No hay personas que exportar con esos filtros'); return; }
    try {
      var filas = [['DNI', 'Apellidos', 'Nombres', 'Nombre a mostrar', 'Usuario', 'Cargo', 'Empresa', 'Sector', 'Función', 'Correo', 'Vigente', 'Desde', 'Hasta', 'Alias', 'Notas']].concat(L.map(function (p) {
        return [String(p.dni || ''), MAY(p.apellidos), MAY(p.nombres), MAY(p.nombre_mostrar), p.usuario || '', MAY(p.cargo), MAY(p.empresa), MAY(secNombre(p.sector)), ROL_TXT[MAY(p.rol_campo)] || p.rol_campo || '',
          p.correo || '', esVig(p) ? 'SÍ' : 'NO', fF(p.desde), fF(p.hasta), String(p.alias || '').split('|').join(' | '), p.notas || '']; }));
      var wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(filas), 'Padron');
      XLSX.writeFile(wb, 'padron_personas_' + hoy() + '.xlsx');
    } catch (e) { aviso('No se pudo generar el Excel. Intenta de nuevo.'); }
  }

  /* ── cuadro en la misma página ── */
  function cerrar() { if (HOST) { HOST.remove(); HOST = null; RAIZ = null; } GUARDANDO = false; document.removeEventListener('keydown', tecla); }
  function enLista() { return !q('#guardar'); }
  function tecla(e) { if (e.key === 'Escape' && enLista()) cerrar(); }   /* con el formulario abierto, Escape no cierra (para no perder lo escrito) */
  async function cargar() {
    if (!RAIZ) return;
    var mio = HOST;
    q('#out').innerHTML = '<div class="vacio">Cargando el padrón…</div>';
    try {
      var j = await pedir('lista', {});
      if (HOST !== mio || !RAIZ) return;
      if (!Array.isArray(j.personas)) throw new Error('El servidor devolvió una respuesta incompleta. Intenta de nuevo.');
      D.personas = j.personas; D.sectores = Array.isArray(j.sectores) ? j.sectores : [];
      D.roles = Array.isArray(j.roles_campo) ? j.roles_campo : Object.keys(ROL_TXT); D.empresas = Array.isArray(j.empresas) ? j.empresas : ['RAPEL', 'VERFRUT'];
      D.usuarios = Array.isArray(j.usuarios) ? j.usuarios : null;
      pintarLista();
    } catch (e) {
      if (HOST !== mio || !RAIZ) return;
      q('#out').innerHTML = '<div class="vacio e"><span id="emsg"></span><div class="acc" style="justify-content:center"><button class="b" id="reint" type="button">Reintentar</button></div></div>';
      q('#emsg').textContent = (e && e.message) || 'No se pudo abrir el padrón. Intenta de nuevo.';
      q('#reint').onclick = cargar;
    }
  }
  function abrir() {
    if (!esCreador()) { aviso(SOLO_CREADOR); return; }
    cerrar();
    HOST = document.createElement('div'); HOST.id = 'rlPadronPersonas';
    try { RAIZ = HOST.attachShadow({ mode: 'open' }); } catch (e) { RAIZ = HOST; }
    RAIZ.innerHTML = css() + '<div class="ov"><div class="box" role="dialog" aria-modal="true" aria-label="Padrón de personas">' +
      '<div class="hd"><div><b>Padrón de personas</b><small>Lista única del personal de Gestión Humana · solo el creador del sistema · datos de Supabase</small></div><button class="b" id="x" type="button">✕ Cerrar</button></div>' +
      '<div class="bd"><div id="out"></div></div></div></div>';
    document.body.appendChild(HOST);
    q('#x').onclick = cerrar;
    q('.ov').addEventListener('click', function (e) { if (e.target === q('.ov') && enLista()) cerrar(); });
    document.addEventListener('keydown', tecla);
    cargar();
  }

  /* ── entrada en el menú lateral: solo en la sesión del creador ── */
  var intentos = 0;
  function boton() {
    if (document.getElementById('navPadron')) return true;
    if (!esCreador()) return false;
    var ref = document.getElementById('navUsr') || document.getElementById('navInformeGH'), nav = ref ? ref.parentNode : document.querySelector('.nav');
    if (!nav) return false;
    var b = document.createElement('button'); b.className = 'ni'; b.id = 'navPadron'; b.type = 'button';
    b.innerHTML = '<span class="ic">🪪</span>Padrón de personas';
    b.title = 'Padrón único de personas (solo el creador del sistema)';
    b.onclick = function () { abrir(); };
    if (ref && ref.nextSibling) nav.insertBefore(b, ref.nextSibling); else nav.appendChild(b);
    return true;
  }
  function esperar() { if (boton() || ++intentos > 20) return; setTimeout(esperar, 700); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', esperar); else esperar();

  window.rlPadronPersonas = { abrir: abrir, cerrar: cerrar, version: 1 };
})();
