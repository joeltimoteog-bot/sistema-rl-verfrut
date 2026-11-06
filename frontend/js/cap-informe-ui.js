/* ═══════════════════════════════════════════════════════════════════════════
   cap-informe-ui.js — _CAP_INFORME_V1 (05-nov-2026) · Capacitaciones del Sistema RR.LL.
   Informe INF-SC-GH-03 ("Informe de capacitaciones de buenas prácticas sociales") de CUALQUIER
   capacitación (ETI, reforzamiento, cambio de horario, otros temas):
     · Botón 📝 Informe en cada fila de "Registros" y aviso al terminar de guardar una capacitación.
     · Todo se llena solo con lo registrado: empresa (Rapel/Verfrut), tema, fecha, semana, duración,
       sector, responsable, total, hombres y mujeres. El usuario revisa los textos y agrega 4 a 6 fotos.
     · El Word sale sobre el MODELO OFICIAL, se descarga y se guarda en Supabase con sus fotos.
     · 📚 Informes: cada usuario ve los suyos; Joel Timoteo, Lucía Castillo y los administradores
       ven todos y pueden corregirlos (nueva versión con historial).
   No cambia el registro, el guardado ni los PDF de la capacitación.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.capInformeUI) return;
  var BASE = '/sistema-rl-verfrut/frontend/';
  var API = 'https://exdjzbfinppzatjyimxn.supabase.co/functions/v1/api/', REG = '?forceFunctionRegion=sa-east-1';
  var EDITORES = ['jtimoteo', 'lcastillo'];
  var DESTINOS = [
    { nom: 'Joel Angel Timoteo Gonza', cargo: 'Responsable de capacitaciones de ética social · desarrollador del Sistema RR.LL.', correo: 'joel.timoteo@unifrutti.com' },
    { nom: 'Lucia Gabriela Castillo Celi', cargo: 'Responsable de capacitaciones de ética social', correo: 'lucia.castillo@unifrutti.com' },
    { nom: 'Luis Eduardo Coveñas Chero', cargo: 'Subgerente de personas', correo: 'eduardo.covenas@unifrutti.com' }
  ];
  var MIN_FOTOS = 4, MAX_FOTOS = 6, LADO = 1600, CALIDAD = 0.82;

  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  var fF = function (f) { return f ? String(f).slice(0, 10).split('-').reverse().join('/') : '—'; };
  var hoy = function () { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  function usuario() { try { return (typeof USER !== 'undefined' && USER) ? USER : null; } catch (e) { return null; } }
  function token() { try { return sessionStorage.getItem('rl_token') || ''; } catch (e) { return ''; } }
  function esEditor() { var u = usuario(); if (!u) return false; return EDITORES.indexOf(String(u.usuario || '').toLowerCase()) >= 0 || /^admin/i.test(String(u.rol || '')); }
  function avisar(m, t) { try { if (typeof mostrarFeedback === 'function') { mostrarFeedback(t === 'e' ? 'err' : 'ok', m); return; } } catch (e) {} try { console.log('[_CAP_INFORME_V1] ' + m); } catch (e) {} }

  function post(ruta, cuerpo) {
    var h = { 'Content-Type': 'application/json' }, t = token(); if (t) h.Authorization = 'Bearer ' + t;
    return fetch(API + ruta + REG, { method: 'POST', headers: h, body: JSON.stringify(cuerpo) }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok || !j.success) throw new Error((j && j.error) || ('HTTP ' + r.status)); return j; });
    });
  }
  function cargar(src) { return new Promise(function (ok, no) { var e = document.createElement('script'); e.src = src; e.onload = function () { ok(); }; e.onerror = function () { no(new Error('No se pudo cargar ' + src)); }; document.head.appendChild(e); }); }
  async function libs() {
    if (typeof window.JSZip === 'undefined') await cargar(BASE + 'js/lib/jszip.min.js?v=1');
    if (typeof window.capInformeWord !== 'function' || (window.capInformeWord.version || 0) < 2) await cargar(BASE + 'js/cap-informe.js?v=2');
  }
  async function plantilla() { var r = await fetch(BASE + 'plantillas/plantilla-informe-capacitacion.docx?v=2', { cache: 'no-store' }); if (!r.ok) throw new Error('No se pudo leer el modelo del informe (HTTP ' + r.status + ')'); return r.arrayBuffer(); }
  function aBase64(bytes) { var s = '', b = new Uint8Array(bytes), n = 0x8000; for (var i = 0; i < b.length; i += n) s += String.fromCharCode.apply(null, b.subarray(i, i + n)); return btoa(s); }

  /* ── estilos y ventanas ── */
  function css() {
    if ($('ci-css')) return;
    var st = document.createElement('style'); st.id = 'ci-css';
    st.textContent = [
      '.ci-ov{position:fixed;inset:0;background:rgba(10,20,40,.55);z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:1rem}',
      '.ci-box{background:#fff;border-radius:16px;max-width:820px;width:100%;max-height:92vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.3);font-family:Inter,"Segoe UI",sans-serif;color:#0F172A}',
      '.ci-box.ancho{max-width:1150px}',
      '.ci-hd{padding:1rem 1.2rem;border-bottom:1px solid #E2E8F0;display:flex;justify-content:space-between;align-items:flex-start;gap:.8rem}',
      '.ci-hd b{font-size:1.05rem;color:#0E2A5C}.ci-hd small{display:block;color:#5B6B82;font-size:.8rem;margin-top:.2rem}',
      '.ci-bd{padding:1rem 1.2rem;overflow:auto}',
      '.ci-ft{padding:.8rem 1.2rem;border-top:1px solid #E2E8F0;display:flex;justify-content:flex-end;gap:.5rem;flex-wrap:wrap}',
      '.ci-b{font:600 14px Inter,"Segoe UI",sans-serif;border-radius:8px;padding:0 16px;min-height:42px;cursor:pointer;border:1px solid #CBD5E1;background:#fff;color:#18428A;text-decoration:none;display:inline-flex;align-items:center;gap:6px}',
      '.ci-b.p{background:#18428A;color:#fff;border-color:#18428A}.ci-b:disabled{opacity:.5;cursor:not-allowed}',
      '.ci-res{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:.6rem;margin-bottom:1rem}',
      '.ci-res div{background:#F4F6FA;border:1px solid #E2E8F0;border-radius:10px;padding:.5rem .7rem;font-size:.76rem;color:#5B6B82}.ci-res div b{display:block;font-size:.98rem;color:#0F172A;margin-top:.1rem}',
      '.ci-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.7rem .9rem}',
      '.ci-grid label{display:flex;flex-direction:column;gap:4px;font-size:.78rem;font-weight:600;color:#334155}',
      '.ci-grid input,.ci-grid select,.ci-grid textarea{font:14px Inter,"Segoe UI",sans-serif;padding:9px 10px;border:1px solid #CBD5E1;border-radius:8px;color:#0F172A;background:#fff}',
      '.ci-grid textarea{min-height:84px;resize:vertical}.ci-full{grid-column:1/-1}',
      '.ci-grid span input{min-width:0;width:100%;box-sizing:border-box}.ci-grid input,.ci-grid select,.ci-grid textarea{box-sizing:border-box;width:100%}',
      '.ci-fotos{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:.7rem}',
      '.ci-foto{position:relative;border:1px solid #CBD5E1;border-radius:10px;overflow:hidden;aspect-ratio:4/3;background:#F4F6FA}',
      '.ci-foto img{width:100%;height:100%;object-fit:cover;display:block}',
      '.ci-foto span{position:absolute;left:6px;top:6px;background:#0E2A5C;color:#fff;font-size:.72rem;font-weight:700;border-radius:6px;padding:.1rem .45rem}',
      '.ci-foto button{position:absolute;right:6px;top:6px;width:30px;height:30px;border-radius:50%;border:0;background:rgba(15,23,42,.75);color:#fff;font-size:15px;cursor:pointer}',
      '.ci-add{border:2px dashed #94A3B8;border-radius:10px;aspect-ratio:4/3;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.3rem;color:#18428A;font-weight:700;cursor:pointer;background:#F8FAFC;font-size:.9rem}',
      '.ci-ok{display:flex;gap:.8rem;align-items:flex-start;background:#ECFDF3;border:1px solid #A7E3BF;border-radius:12px;padding:.9rem 1rem;color:#14532D;margin-bottom:.9rem}',
      '.ci-err{background:#FFF1F3;border:1px solid #F5C2C9;color:#9F1239;border-radius:12px;padding:.8rem 1rem;margin-bottom:.9rem}',
      '.ci-tab{width:100%;border-collapse:collapse;font-size:.83rem}.ci-tab th{background:#F8FAFC;color:#475569;text-align:left;padding:.5rem .6rem;border-bottom:1px solid #E2E8F0;white-space:nowrap;font-size:.75rem}',
      '.ci-tab td{padding:.5rem .6rem;border-bottom:1px solid #EEF2F6;vertical-align:middle}',
      '.ci-row-btn{background:#E8EFFB!important;color:#18428A!important;border:1px solid #C7D6F0!important}',
      '@media(max-width:700px){.ci-grid{grid-template-columns:1fr}}'
    ].join('\n');
    document.head.appendChild(st);
  }
  function modal(html, ancho) { css(); var m = document.createElement('div'); m.className = 'ci-ov'; m.innerHTML = '<div class="ci-box' + (ancho ? ' ancho' : '') + '" role="dialog" aria-modal="true">' + html + '</div>'; document.body.appendChild(m); return m; }

  /* ── datos de la capacitación (fila de Registros o formulario recién guardado) ── */
  var num = function (x) { var n = parseFloat(String(x == null ? '' : x).replace(',', '.')); return isNaN(n) ? 0 : n; };
  function campo(r, re) { var k = Object.keys(r || {}).find(function (k) { return re.test(k); }); return k ? r[k] : ''; }
  function fechaIso(x) { var s = String(x || ''); if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10); var m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (m) return m[3] + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[1]).padStart(2, '0'); var d = new Date(s); return isNaN(d) ? hoy() : d.toISOString().slice(0, 10); }
  function duracion(h) { h = num(h); if (!h) return ''; var t = Math.round(h * 10) / 10; return (Number.isInteger(t) ? t : String(t).replace('.', ',')) + (t === 1 ? ' hora' : ' horas'); }
  function desdeRegistro(r) {
    var n = num(r.totalAsistentes || campo(r, /^total/i)), h = num(r.hombres || campo(r, /hombre|varon|masc/i)), m = num(r.mujeres || campo(r, /mujer|fem/i));
    var area = String(r.area && r.area !== '—' ? r.area : (r.lugar || r.fundo || '')).trim();
    return { idCap: r.idCapacitacion || '', emp: String(r.empresa || ''), tema: String(r.tema || '').trim(), tipoCap: String(r.tipo || ''), fecha: fechaIso(r.fecha || r.fechaCapacitacion),
      horas: num(r.totalHoras), area: area, resp: String(r.capacitadorNombre || r.creadaPorNombre || '').trim(), capDni: String(r.capacitadorDni || '').trim(), n: n, h: h, m: m, creadaPor: r.creadaPor || '' };
  }
  /* ── _CAP_INFORME_V2 (05-nov): el informe se emite cuando el usuario TERMINA de registrar y cubre
        el total del dia, las fechas programadas que elija, un rango o todas (informe general) ── */
  var normTema = function (t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); };
  var esRapel = function (e) { return /RAPEL/i.test(String(e || '')); };
  async function todasLasCapacitaciones() {
    var u = usuario() || {};
    if (typeof window.apiPost !== 'function') throw new Error('Lista de capacitaciones no disponible');
    var d = await window.apiPost({ action: 'listarCapacitaciones', rol: u.rol, usuario: u.usuario, empresa: '', desde: '', hasta: '', supervisor: '' });
    if (!d || !d.success) throw new Error((d && d.error) || 'No se pudo leer las capacitaciones');
    return d.capacitaciones || [];
  }
  function agrupar(base, lista, fechas) {
    var sel = lista.filter(function (x) { return fechas.indexOf(x.fecha) >= 0; });
    var c = Object.assign({}, base, { fechas: fechas.slice().sort(), fecha: fechas.slice().sort().slice(-1)[0], n: 0, h: 0, m: 0, horas: 0, idCaps: [] });
    var areas = [];
    sel.forEach(function (x) { c.n += x.n; c.h += x.h; c.m += x.m; c.horas += x.horas; c.idCaps.push(x.idCap); if (x.area && areas.indexOf(x.area.toUpperCase()) < 0) areas.push(x.area.toUpperCase()); if (!c.capDni && x.capDni) c.capDni = x.capDni; });
    c.area = areas.join(', ') || base.area; c.sesiones = sel.length; return c;
  }
  async function elegirAlcance(base, modo) {
    var u = usuario() || {}, quien = String(base.creadaPor || u.usuario || '').toLowerCase().trim();
    var lista;
    try {
      lista = (await todasLasCapacitaciones()).map(desdeRegistro).filter(function (x) {
        return normTema(x.tema) === normTema(base.tema) && esRapel(x.emp) === esRapel(base.emp) && (!quien || String(x.creadaPor || '').toLowerCase().trim() === quien);
      });
    } catch (e) { console.warn('[_CAP_INFORME_V2]', e); lista = []; }
    if (!lista.some(function (x) { return x.fecha === base.fecha; })) lista.push(base);
    var dias = {}; lista.forEach(function (x) { var d = dias[x.fecha] || (dias[x.fecha] = { n: 0, h: 0, m: 0, k: 0 }); d.n += x.n; d.h += x.h; d.m += x.m; d.k++; });
    var fechas = Object.keys(dias).sort();
    return new Promise(function (resolver) {
      var m = modal('<div class="ci-hd"><div><b>📅 ¿Qué incluye el informe?</b><small>' + esc(base.tema) + ' · ' + esc(esRapel(base.emp) ? 'Rapel' : 'Verfrut') + ' · registrado por ' + esc(base.creadaPor || u.usuario || '') + '</small></div></div>' +
        '<div class="ci-bd"><div style="display:flex;flex-wrap:wrap;gap:.5rem;margin-bottom:.8rem">' +
        '<button class="ci-b" data-m="dia">Solo el ' + esc(fF(base.fecha)) + '</button><button class="ci-b" data-m="todas">Informe general (todas las fechas)</button>' +
        '<span style="display:inline-flex;gap:.4rem;align-items:center;font-size:.8rem;color:#475569">Rango <input type="date" id="ci-r1" style="padding:6px;border:1px solid #CBD5E1;border-radius:8px"> a <input type="date" id="ci-r2" style="padding:6px;border:1px solid #CBD5E1;border-radius:8px"><button class="ci-b" data-m="rango">Aplicar</button></span></div>' +
        '<p style="font-size:.82rem;color:#475569;margin:.2rem 0 .5rem">Marca las fechas programadas que entran en este informe:</p>' +
        '<div style="overflow-x:auto"><table class="ci-tab"><thead><tr><th></th><th>Fecha</th><th>Registros</th><th>Capacitados</th><th>Hombres</th><th>Mujeres</th></tr></thead><tbody>' +
        fechas.map(function (f) { var d = dias[f]; return '<tr><td><input type="checkbox" class="ci-dia" value="' + f + '" aria-label="Incluir ' + fF(f) + '"></td><td>' + fF(f) + '</td><td>' + d.k + '</td><td><b>' + d.n + '</b></td><td>' + d.h + '</td><td>' + d.m + '</td></tr>'; }).join('') +
        '</tbody></table></div><div class="ci-res" style="margin:.9rem 0 0" id="ci-sum"></div></div>' +
        '<div class="ci-ft"><button class="ci-b" id="ci-no">Cancelar</button><button class="ci-b p" id="ci-si">Continuar →</button></div>', true);
      var cks = function () { return Array.prototype.slice.call(m.querySelectorAll('.ci-dia')); };
      var marcar = function (fn) { cks().forEach(function (c) { c.checked = fn(c.value); }); resumen(); };
      function resumen() {
        var sel = cks().filter(function (c) { return c.checked; }).map(function (c) { return c.value; }), t = { n: 0, h: 0, m: 0 };
        sel.forEach(function (f) { t.n += dias[f].n; t.h += dias[f].h; t.m += dias[f].m; });
        $('ci-sum').innerHTML = '<div>Fechas<b>' + sel.length + '</b></div><div>Total capacitados<b>' + t.n + '</b></div><div>Hombres<b>' + t.h + '</b></div><div>Mujeres<b>' + t.m + '</b></div>';
        $('ci-si').disabled = !sel.length;
      }
      m.querySelector('[data-m="dia"]').onclick = function () { marcar(function (f) { return f === base.fecha; }); };
      m.querySelector('[data-m="todas"]').onclick = function () { marcar(function () { return true; }); };
      m.querySelector('[data-m="rango"]').onclick = function () { var a = $('ci-r1').value, b = $('ci-r2').value; if (!a || !b) { avisar('Elige las dos fechas del rango', 'e'); return; } marcar(function (f) { return f >= a && f <= b; }); };
      cks().forEach(function (c) { c.onchange = resumen; });
      marcar(modo === 'todas' ? function () { return true; } : function (f) { return f === base.fecha; });
      $('ci-no').onclick = function () { m.remove(); resolver(null); };
      $('ci-si').onclick = function () { var sel = cks().filter(function (c) { return c.checked; }).map(function (c) { return c.value; }); m.remove(); resolver(agrupar(base, lista, sel)); };
    });
  }
  function cap(t) { return String(t || '').toLowerCase().replace(/(^|\s)\S/g, function (c) { return c.toUpperCase(); }); }

  /* ── 1) formulario con todo prellenado ── */
  function formulario(c, previo) {
    return new Promise(async function (resolver) {
      try { await libs(); } catch (e) { avisar(e.message, 'e'); resolver(null); return; }
      var S = window.capInformeWord.sugerencias({ tema: c.tema, tipo: c.tipoCap, n: c.n });
      var v = previo || {
        emp: /RAPEL/i.test(c.emp) ? 'RAPEL' : 'VERFRUT', tema: c.tema, tipoInforme: 'Capacitación', fecha: c.fecha, fechas: c.fechas || [c.fecha], fechaInforme: hoy(),
        dur: (c.sesiones || 1) > 1 ? duracion(c.horas) + ' (' + c.sesiones + ' sesiones)' : duracion(c.horas), firmaDni: c.capDni || '', idCaps: c.idCaps || [c.idCap],
        sector: (c.area ? c.area.toUpperCase() : '') + ' / OBREROS', resp: String(c.resp).toUpperCase(), reportado: 'Luis Eduardo Coveñas Chero – Subgerente de personas',
        objetivo: S.objetivo, temas: S.temas, conclusiones: S.conclusiones, adjuntos: S.adjuntos,
        firmaNom: window.capInformeWord.nombrePropio(c.resp), firmaCargo: 'Supervisor de Gestión Humana Sector ' + cap(c.area), n: c.n, h: c.h, m: c.m
      };
      var ed = esEditor();
      var m = modal(
        '<div class="ci-hd"><div><b>📝 Informe de capacitación · INF-SC-GH-03</b><small>Todo viene lleno con lo registrado. Revisa los textos y continúa para agregar las fotos.</small></div></div>' +
        '<div class="ci-bd"><div class="ci-res"><div>Empresa<b>' + esc(v.emp === 'RAPEL' ? 'Sociedad Agrícola Rapel' : 'Sociedad Exportadora Verfrut') + '</b></div><div>Fecha(s)<b>' + esc((v.fechas || [v.fecha]).map(fF).join(', ')) + '</b></div>' +
        '<div>Total capacitados<b>' + esc(v.n) + '</b></div><div>Hombres / Mujeres<b>' + esc(v.h) + ' / ' + esc(v.m) + '</b></div></div>' +
        '<div class="ci-grid">' +
        '<label class="ci-full">Tema<input id="ci-tema" value="' + esc(v.tema) + '"></label>' +
        '<label>Tipo<input id="ci-tipo" value="' + esc(v.tipoInforme) + '"></label><label>Duración<input id="ci-dur" value="' + esc(v.dur) + '"></label>' +
        '<label>Sector<input id="ci-sector" value="' + esc(v.sector) + '"></label><label>Responsable<input id="ci-resp" value="' + esc(v.resp) + '"></label>' +
        (ed ? '<label>Fecha(s) de la capacitación (dd/mm/aaaa, separadas por coma)<input id="ci-fecha" value="' + esc((v.fechas || [v.fecha]).map(fF).join(', ')) + '"></label><label>Fecha del informe<input id="ci-finf" type="date" value="' + esc(v.fechaInforme) + '"></label>' +
              '<label>Total<input id="ci-n" type="number" value="' + esc(v.n) + '"></label><label>Hombres / Mujeres<span style="display:flex;gap:6px"><input id="ci-h" type="number" value="' + esc(v.h) + '" style="flex:1"><input id="ci-m" type="number" value="' + esc(v.m) + '" style="flex:1"></span></label>' : '') +
        '<label class="ci-full">II. Objetivo<textarea id="ci-obj">' + esc(v.objetivo) + '</textarea></label>' +
        '<label class="ci-full">III. Temas (uno por renglón)<textarea id="ci-temas" style="min-height:120px">' + esc((v.temas || []).join('\n')) + '</textarea></label>' +
        '<label class="ci-full">Conclusiones (una por renglón)<textarea id="ci-conc">' + esc((v.conclusiones || []).join('\n')) + '</textarea></label>' +
        '<label class="ci-full">Se adjunta (uno por renglón)<textarea id="ci-adj" style="min-height:64px">' + esc((v.adjuntos || []).join('\n')) + '</textarea></label>' +
        '<label>Firma (nombre)<input id="ci-fnom" value="' + esc(v.firmaNom) + '"></label><label>Cargo bajo la firma<input id="ci-fcar" value="' + esc(v.firmaCargo) + '"></label>' +
        '<label>DNI para la firma digital<input id="ci-fdni" maxlength="8" inputmode="numeric" value="' + esc(v.firmaDni || '') + '"></label><label>&nbsp;<span style="font-weight:500;color:#5B6B82;font-size:.76rem">Sale "FIRMADO DIGITALMENTE" con DNI, fecha y código de verificación sobre la firma.</span></label>' +
        '<label class="ci-full">Reportado a<input id="ci-rep" value="' + esc(v.reportado) + '"></label>' +
        '</div></div>' +
        '<div class="ci-ft"><button class="ci-b" id="ci-no">Cancelar</button><button class="ci-b p" id="ci-si">Continuar: fotos →</button></div>');
      var lineas = function (id) { return String($(id).value || '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean); };
      $('ci-no').onclick = function () { m.remove(); resolver(null); };
      $('ci-si').onclick = function () {
        var o = Object.assign({}, v, { tema: $('ci-tema').value.trim(), tipoInforme: $('ci-tipo').value.trim(), dur: $('ci-dur').value.trim(), sector: $('ci-sector').value.trim(), resp: $('ci-resp').value.trim(),
          objetivo: $('ci-obj').value.trim(), temas: lineas('ci-temas'), conclusiones: lineas('ci-conc'), adjuntos: lineas('ci-adj'), firmaNom: $('ci-fnom').value.trim(), firmaCargo: $('ci-fcar').value.trim(), reportado: $('ci-rep').value.trim(), firmaDni: $('ci-fdni').value.trim() });
        if (ed) { var fsx = String($('ci-fecha').value || '').split(',').map(function (t) { var p = t.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); return p ? p[3] + '-' + String(p[2]).padStart(2, '0') + '-' + String(p[1]).padStart(2, '0') : null; });
          if (!fsx.length || fsx.some(function (x) { return !x; })) { avisar('Revisa las fechas: formato dd/mm/aaaa, separadas por coma', 'e'); return; }
          o.fechas = fsx.sort(); o.fecha = o.fechas[o.fechas.length - 1]; o.fechaInforme = $('ci-finf').value || v.fechaInforme; o.n = num($('ci-n').value); o.h = num($('ci-h').value); o.m = num($('ci-m').value); }
        if (!o.tema) { avisar('Escribe el tema', 'e'); return; }
        m.remove(); resolver(o);
      };
    });
  }

  /* ── 2) fotos (4 a 6, comprimidas en el navegador) ── */
  function leerImagen(file) {
    return new Promise(function (ok, no) {
      var url = URL.createObjectURL(file), im = new Image();
      im.onload = function () {
        var w = im.naturalWidth, h = im.naturalHeight, k = Math.min(1, LADO / Math.max(w, h)); w = Math.round(w * k); h = Math.round(h * k);
        var c = document.createElement('canvas'); c.width = w; c.height = h; var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(im, 0, 0, w, h); URL.revokeObjectURL(url);
        c.toBlob(function (b) { if (!b) { no(new Error('No se pudo leer la foto')); return; } b.arrayBuffer().then(function (ab) { ok({ bytes: new Uint8Array(ab), w: w, h: h, prev: URL.createObjectURL(b) }); }, no); }, 'image/jpeg', CALIDAD);
      };
      im.onerror = function () { URL.revokeObjectURL(url); no(new Error('El archivo ' + file.name + ' no es una imagen válida')); };
      im.src = url;
    });
  }
  async function fotoDesdeUrl(u) { var r = await fetch(u, { cache: 'no-store' }); if (!r.ok) throw new Error('No se pudo leer una foto guardada'); var b = await r.blob(); var x = await leerImagen(new File([b], 'foto.jpg', { type: b.type || 'image/jpeg' })); x.url = u; return x; }
  function pedirFotos(v, iniciales) {
    return new Promise(function (resolver) {
      var fotos = (iniciales || []).slice();
      var m = modal('<div class="ci-hd"><div><b>📷 Evidencia · Informe de capacitación</b><small>Agrega de ' + MIN_FOTOS + ' a ' + MAX_FOTOS + ' fotos. Se colocan solas en la sección IV del informe y quedan guardadas.</small></div></div>' +
        '<div class="ci-bd"><div class="ci-res"><div>Tema<b>' + esc(v.tema) + '</b></div><div>Fecha(s)<b>' + esc((v.fechas || [v.fecha]).map(fF).join(', ')) + '</b></div><div>Total<b>' + esc(v.n) + '</b></div><div>Hombres / Mujeres<b>' + esc(v.h) + ' / ' + esc(v.m) + '</b></div></div>' +
        '<div class="ci-fotos" id="ci-grid"></div><p id="ci-cnt" style="margin:.8rem 0 0;font-size:.85rem"></p><input type="file" id="ci-file" accept="image/*" multiple style="display:none"></div>' +
        '<div class="ci-ft"><button class="ci-b" id="ci-no">Cancelar</button><button class="ci-b p" id="ci-si">Generar informe</button></div>');
      function pintar() {
        var g = $('ci-grid'); g.innerHTML = '';
        fotos.forEach(function (f, i) { var d = document.createElement('div'); d.className = 'ci-foto'; d.innerHTML = '<img alt="Foto ' + (i + 1) + '" src="' + f.prev + '"><span>Foto ' + (i + 1) + '</span><button type="button" aria-label="Quitar foto ' + (i + 1) + '">✕</button>'; d.querySelector('button').onclick = function () { fotos.splice(i, 1); pintar(); }; g.appendChild(d); });
        if (fotos.length < MAX_FOTOS) { var a = document.createElement('button'); a.type = 'button'; a.className = 'ci-add'; a.innerHTML = '<span style="font-size:1.6rem">＋</span>Agregar foto' + (fotos.length ? '' : 's') + '<small style="font-weight:500;color:#5B6B82">cámara o galería</small>'; a.onclick = function () { $('ci-file').click(); }; g.appendChild(a); }
        var n = fotos.length, ok = n >= MIN_FOTOS && n <= MAX_FOTOS;
        $('ci-cnt').innerHTML = ok ? '✅ <b>' + n + ' fotos</b> listas.' : '📷 <b>' + n + ' de ' + MIN_FOTOS + '</b> fotos como mínimo (máximo ' + MAX_FOTOS + ').';
        $('ci-si').disabled = !ok;
      }
      $('ci-file').onchange = async function () {
        var lista = Array.prototype.slice.call(this.files || []); this.value = ''; var libres = MAX_FOTOS - fotos.length;
        $('ci-cnt').textContent = '⏳ Preparando fotos…';
        for (var f of lista.slice(0, libres)) { try { fotos.push(await leerImagen(f)); } catch (e) { avisar(e.message, 'e'); } }
        pintar();
      };
      $('ci-no').onclick = function () { m.remove(); resolver(null); };
      $('ci-si').onclick = function () { m.remove(); resolver(fotos); };
      pintar();
    });
  }

  /* ── 3) generar, descargar y guardar ── */
  function descargar(blob, nombre) { var a = document.createElement('a'), u = URL.createObjectURL(blob); a.href = u; a.download = nombre; a.style.display = 'none'; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(u); a.remove(); }, 800); }
  function nombreArchivo(v, ver) { return 'Informe_Capacitacion_' + String(v.tema || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 50) + '_' + (v.fechas && v.fechas.length > 1 ? v.fechas[0].replace(/-/g, '') + '_al_' : '') + String(v.fecha).replace(/-/g, '') + (ver > 1 ? '_v' + ver : '') + '.docx'; }
  async function subir(nombre, bytes, tipo) { var j = await post('archivos/subir', { contenedor: 'documentos', nombre: nombre, base64: aBase64(bytes), tipo: tipo }); return j.url || j.enlace; }
  async function generarYGuardar(c, v, fotos, previo) {
    await libs();
    var datos = { plantilla: await plantilla(), emp: v.emp, tema: v.tema, tipo: c.tipoCap, tipoInforme: v.tipoInforme, fechaInforme: v.fechaInforme, fecha: v.fecha, fechas: v.fechas || [v.fecha], firmaDni: v.firmaDni, dur: v.dur, sector: v.sector, resp: v.resp,
      n: v.n, h: v.h, m: v.m, reportado: v.reportado, objetivo: v.objetivo, temas: v.temas, conclusiones: v.conclusiones, adjuntos: v.adjuntos, firmaNom: v.firmaNom, firmaCargo: v.firmaCargo, fotos: fotos };
    var blob = await window.capInformeWord(datos);
    var ver = previo ? (previo.version || 1) + 1 : 1, nombre = nombreArchivo(v, ver);
    descargar(blob, nombre);
    var u = usuario() || {}, id = previo ? previo.id : 'CAPINF-' + String(v.fecha).replace(/-/g, '') + '-' + String(u.usuario || 'usuario').replace(/[^a-z0-9]/gi, '') + '-' + Date.now().toString(36);
    var urls = [];
    for (var i = 0; i < fotos.length; i++) urls.push(fotos[i].url && previo ? fotos[i].url : await subir(id + '_foto' + (i + 1) + (ver > 1 ? '_v' + ver : '') + '.jpg', fotos[i].bytes, 'image/jpeg'));
    var docx = await subir(id + (ver > 1 ? '_v' + ver : '') + '.docx', new Uint8Array(await blob.arrayBuffer()), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    var reg = Object.assign({}, v, {
      tipo: 'INF-SC-GH-03-CAP', id: id, nombre: nombre, docx: docx, fotos: urls.map(function (x, i) { return { url: x, w: fotos[i].w, h: fotos[i].h }; }),
      cap: { idCapacitacion: c.idCap, idCaps: v.idCaps || c.idCaps || [c.idCap], tipo: c.tipoCap, creadaPor: c.creadaPor, area: c.area, horas: c.horas, capDni: c.capDni || '', sesiones: c.sesiones || 1 },
      usuario: previo ? previo.usuario : (u.usuario || ''), nomUsuario: previo ? previo.nomUsuario : (u.nombre || ''),
      creado: previo ? previo.creado : new Date().toISOString(), ts: previo ? previo.ts : Date.now(), actualizado: new Date().toISOString(),
      version: ver, historial: previo ? (previo.historial || []).concat([{ en: new Date().toISOString(), por: u.usuario || '', version: ver, docxAnterior: previo.docx || '', cambios: previo._cambios || [] }]).slice(-30) : []
    });
    await post('eti/escribir', { ops: [{ col: 'informes_cap', id: id, op: 'set', datos: reg, merge: false, origen: previo ? 'informe-correccion' : 'informe' }] });
    return reg;
  }
  function correoHref(r) {
    var para = DESTINOS.map(function (d) { return d.correo; }).join(','), emp = r.emp === 'RAPEL' ? 'Sociedad Agrícola Rapel S.A.C.' : 'Sociedad Exportadora Verfrut S.A.C.';
    var fsT = (r.fechas || [r.fecha]).map(fF).join(', '), asunto = 'Informe de capacitación (INF-SC-GH-03) · ' + r.tema + ' · ' + fsT;
    var cuerpo = 'Buenos días,\n\nAdjunto el informe de la capacitación:\n\n• Empresa: ' + emp + '\n• Tema: ' + r.tema + '\n• Fecha(s): ' + fsT + '\n• Sector: ' + r.sector + '\n• Responsable: ' + r.resp +
      '\n• Total capacitados: ' + r.n + ' (hombres ' + r.h + ', mujeres ' + r.m + ')\n• Evidencia: ' + (r.fotos || []).length + ' fotos\n\nInforme en Word (guardado en el sistema): ' + r.docx + '\n\nAtentamente,\n' + ((usuario() || {}).nombre || '');
    return 'mailto:' + para + '?subject=' + encodeURIComponent(asunto) + '&body=' + encodeURIComponent(cuerpo);
  }
  function listo(reg, corregido) {
    var m = modal('<div class="ci-hd"><div><b>' + (corregido ? '✏️ Informe corregido y guardado' : '✅ Informe emitido y guardado') + '</b><small>' + esc(reg.tema) + ' · ' + esc(fF(reg.fecha)) + ' · versión ' + reg.version + '</small></div></div>' +
      '<div class="ci-bd"><div class="ci-ok"><span style="font-size:1.4rem">📁</span><div>El Word ya se descargó y quedó <b>guardado en el sistema</b> con sus ' + (reg.fotos || []).length + ' fotos. Puedes volver a descargarlo desde <b>📚 Informes</b>.</div></div>' +
      '<div style="font-size:.84rem;color:#334155;line-height:1.55"><b>Envíalo por correo a:</b><br>' + DESTINOS.map(function (d) { return '• ' + esc(d.nom) + ' — ' + esc(d.cargo); }).join('<br>') +
      '<br><span style="color:#5B6B82">Antes de enviarlo coloca tu firma digital y adjunta el registro de asistencia.</span></div></div>' +
      '<div class="ci-ft"><a class="ci-b" href="' + esc(reg.docx) + '" target="_blank" rel="noopener">⬇️ Descargar Word</a><a class="ci-b p" href="' + esc(correoHref(reg)) + '">✉️ Preparar correo</a><button class="ci-b" id="ci-c">Cerrar</button></div>');
    m.querySelector('#ci-c').onclick = function () { m.remove(); };
  }
  async function emitir(c) {
    if (!token()) { avisar('Tu sesión no tiene llave del servidor: vuelve a ingresar al sistema', 'e'); return; }
    var cA = await elegirAlcance(c, arguments[1]); if (!cA) return; c = cA;
    var v = await formulario(c); if (!v) return;
    var fotos = await pedirFotos(v, []); if (!fotos) return;
    var intento = async function () {
      try { avisar('⏳ Generando y guardando el informe…'); listo(await generarYGuardar(c, v, fotos, null), false); }
      catch (e) {
        console.error('[_CAP_INFORME_V1]', e);
        var m = modal('<div class="ci-hd"><div><b>⚠️ No se pudo completar</b><small>' + esc(e.message) + '</small></div></div><div class="ci-bd"><div class="ci-err">Si el Word ya se descargó, <b>no se perdió</b>. Revisa tu conexión y pulsa <b>Reintentar</b> para guardarlo en el sistema.</div></div>' +
          '<div class="ci-ft"><button class="ci-b" id="ci-c">Cerrar</button><button class="ci-b p" id="ci-r">Reintentar</button></div>');
        m.querySelector('#ci-c').onclick = function () { m.remove(); }; m.querySelector('#ci-r').onclick = function () { m.remove(); intento(); };
      }
    };
    intento();
  }

  /* ── 4) lista de informes y corrección (Joel · Lucía · administradores) ── */
  async function panel() {
    var u = usuario(); if (!u) return;
    var m = modal('<div class="ci-hd"><div><b>📚 Informes de capacitación emitidos</b><small>' + (esEditor() ? 'Todos los informes · puedes corregir datos, fechas y fotos' : 'Tus informes emitidos') + '</small></div><button class="ci-b" id="ci-x" aria-label="Cerrar">✕</button></div><div class="ci-bd" id="ci-lista"><p>⏳ Cargando…</p></div>', true);
    m.querySelector('#ci-x').onclick = function () { m.remove(); };
    var L;
    try { var c = { col: 'informes_cap', limite: 3000 }; if (!esEditor()) c.filtros = [['usuario', '==', u.usuario]]; L = ((await post('eti/consultar', c)).docs || []).map(function (d) { return d.datos; }).sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); }); }
    catch (e) { $('ci-lista').innerHTML = '<div class="ci-err">No se pudo cargar: ' + esc(e.message) + '</div>'; return; }
    if (!L.length) { $('ci-lista').innerHTML = '<p>Aún no hay informes. Se emiten con el botón <b>📝</b> de cada capacitación en Registros.</p>'; return; }
    $('ci-lista').innerHTML = '<div style="overflow-x:auto"><table class="ci-tab"><thead><tr><th>Emitido</th><th>Fecha(s)</th><th>Empresa</th><th>Tema</th><th>Sector</th><th>Total (H/M)</th><th>Fotos</th><th>Versión</th><th>Emitido por</th><th></th></tr></thead><tbody>' +
      L.map(function (r, i) {
        return '<tr><td>' + esc(fF(String(r.creado || '').slice(0, 10))) + '</td><td>' + esc((r.fechas || [r.fecha]).map(fF).join(', ')) + '</td><td>' + esc(r.emp) + '</td><td>' + esc(String(r.tema || '').slice(0, 60)) + '</td><td>' + esc(r.sector) + '</td>' +
          '<td>' + esc(r.n) + ' (' + esc(r.h) + '/' + esc(r.m) + ')</td><td>' + (r.fotos || []).length + '</td><td>v' + (r.version || 1) + '</td><td>' + esc(r.nomUsuario || r.usuario) + '</td><td style="white-space:nowrap">' +
          '<a class="ci-b" style="min-height:34px;padding:0 10px" href="' + esc(r.docx) + '" target="_blank" rel="noopener">⬇️</a> <a class="ci-b" style="min-height:34px;padding:0 10px" href="' + esc(correoHref(r)) + '" aria-label="Correo">✉️</a>' +
          (esEditor() ? ' <button class="ci-b p" style="min-height:34px;padding:0 10px" data-i="' + i + '">✏️ Corregir</button>' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    Array.prototype.forEach.call(m.querySelectorAll('button[data-i]'), function (b) { b.onclick = function () { m.remove(); corregir(L[+b.getAttribute('data-i')]); }; });
  }
  async function corregir(r) {
    if (!esEditor()) { avisar('Solo Joel Timoteo, Lucía Castillo y los administradores pueden corregir informes', 'e'); return; }
    var c = { idCap: (r.cap || {}).idCapacitacion, idCaps: (r.cap || {}).idCaps, emp: r.emp, tema: r.tema, tipoCap: (r.cap || {}).tipo, fecha: r.fecha, fechas: r.fechas || [r.fecha], sesiones: (r.cap || {}).sesiones, capDni: (r.cap || {}).capDni, horas: (r.cap || {}).horas, area: (r.cap || {}).area, resp: r.resp, n: r.n, h: r.h, m: r.m, creadaPor: (r.cap || {}).creadaPor };
    var v = await formulario(c, r); if (!v) return;
    var ini = []; for (var f of (r.fotos || [])) { try { ini.push(await fotoDesdeUrl(f.url)); } catch (e) { avisar(e.message, 'e'); } }
    var fotos = await pedirFotos(v, ini); if (!fotos) return;
    var cambios = ['tema', 'tipoInforme', 'dur', 'sector', 'resp', 'fecha', 'fechaInforme', 'n', 'h', 'm', 'objetivo', 'firmaNom', 'firmaCargo', 'reportado', 'firmaDni'].filter(function (k) { return String(v[k]) !== String(r[k]); });
    ['temas', 'conclusiones', 'adjuntos', 'fechas'].forEach(function (k) { if ((v[k] || []).join('|') !== (r[k] || []).join('|')) cambios.push(k); });
    if ((r.fotos || []).map(function (x) { return x.url; }).join('|') !== fotos.map(function (x) { return x.url || ''; }).join('|')) cambios.push('fotos');
    try { avisar('⏳ Guardando la corrección…'); listo(await generarYGuardar(c, v, fotos, Object.assign({}, r, { _cambios: cambios })), true); }
    catch (e) { console.error('[_CAP_INFORME_V1] corregir', e); avisar('No se pudo corregir: ' + e.message, 'e'); }
  }

  /* ── 5) botones en la pantalla ── */
  function botonesFilas() {
    var w = $('tbRegistrosWrap'); if (!w) return;
    Array.prototype.forEach.call(w.querySelectorAll('button.creg-reu[onclick^="capAbrirDuplicar("]'), function (b) {
      if (b.parentNode.querySelector('.ci-row-btn')) return;
      var i = +((b.getAttribute('onclick') || '').match(/\((\d+)\)/) || [])[1];
      var n = document.createElement('button'); n.type = 'button'; n.className = 'btn btn-sm creg-reu ci-row-btn'; n.title = 'Informe INF-SC-GH-03 de este tema: total del día, fechas programadas o general (con fotos)'; n.textContent = '📝';
      n.onclick = function () { var r = (window._capRegistros || [])[i]; if (!r) { avisar('No encuentro esa capacitación. Actualiza la lista.', 'e'); return; } emitir(desdeRegistro(r)); };
      b.parentNode.insertBefore(n, b);
    });
    if (!$('ci-panel-btn')) {
      var cnt = $('cregConteo'); if (cnt && cnt.parentNode) {
        var p = document.createElement('button'); p.type = 'button'; p.id = 'ci-panel-btn'; p.className = 'btn btn-sm ci-row-btn'; p.style.marginLeft = '8px'; p.textContent = '📚 Informes'; p.onclick = panel;
        cnt.parentNode.insertBefore(p, cnt.nextSibling);
      }
    }
  }
  /* aviso al terminar de guardar una capacitación nueva */
  function engancharGuardado() {
    if (typeof window.guardarYGenerar !== 'function' || window.guardarYGenerar._ci) return;
    var g0 = window.guardarYGenerar;
    window.guardarYGenerar = async function () {
      var antes = false; try { antes = _capGuardada; } catch (e) {}
      var out = await g0.apply(this, arguments);
      try {
        if (!antes && _capGuardada === true && typeof _buildBody === 'function') {
          var b = await _buildBody(), a = b.actividad, as = b.asistentesEnvio || [];
          var H = as.filter(function (x) { return typeof _capEsHombre === 'function' ? _capEsHombre(x.sexo) : /^m|^h/i.test(x.sexo || ''); }).length;
          var M = as.filter(function (x) { return typeof _capEsMujer === 'function' ? _capEsMujer(x.sexo) : /^f/i.test(x.sexo || ''); }).length;
          var c = desdeRegistro(Object.assign({}, a, { totalAsistentes: as.length, hombres: H, mujeres: M }));
          c.creadaPor = c.creadaPor || ((usuario() || {}).usuario || '');
          var m = modal('<div class="ci-hd"><div><b>✅ Capacitación guardada</b><small>' + esc(c.tema) + ' · ' + esc(fF(c.fecha)) + '</small></div></div>' +
            '<div class="ci-bd"><div class="ci-ok"><span style="font-size:1.4rem">🎉</span><div>Se registraron <b>' + c.n + ' asistentes</b> (' + c.h + ' hombres, ' + c.m + ' mujeres) en este registro.<br><b>¿Terminaste de registrar este tema?</b> Genera el <b>Informe de capacitación (INF-SC-GH-03)</b> con el total del día, de las fechas programadas o general. Si aún vas a registrar más grupos, elige <b>Sigo registrando</b>: el informe lo emites al final desde <b>Registros → 📝</b>.</div></div></div>' +
            '<div class="ci-ft"><button class="ci-b" id="ci-luego">Sigo registrando</button><button class="ci-b p" id="ci-ya">📝 Terminé: generar informe</button></div>');
          m.querySelector('#ci-luego').onclick = function () { m.remove(); };
          m.querySelector('#ci-ya').onclick = function () { m.remove(); emitir(c); };
        }
      } catch (e) { console.warn('[_CAP_INFORME_V1] aviso', e); }
      return out;
    };
    window.guardarYGenerar._ci = true;
  }

  window.capInformeUI = { emitir: emitir, panel: panel, corregir: corregir, desdeRegistro: desdeRegistro, version: 2 };
  function iniciar() { try { botonesFilas(); engancharGuardado(); } catch (e) {} }
  setInterval(iniciar, 1200); setTimeout(iniciar, 300);
  try { console.log('[_CAP_INFORME_V1] listo'); } catch (e) {}
})();
