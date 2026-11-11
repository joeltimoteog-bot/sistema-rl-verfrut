/* ════════════════════════════════════════════════════════════════════════════
   _INFORME_GENERAL_GH_V1 (10-nov-2026) — INFORME GENERAL DE GESTIÓN HUMANA
   · Solo para el creador del sistema (jtimoteo). El botón solo se crea en su sesión, pero la protección
     verdadera está en el servidor: POST /api/informe-gh/datos responde 403 a cualquier otro usuario.
   · Periodo: un mes, un rango de meses o el año.  Alcance: general, por empresa (RAPEL / VERFRUT) o por sector.
   · Formato del modelo oficial INF-SC-GH-03 (cabecera en cuadrícula, secciones en romanos, Arial, cuadros de borde
     negro con encabezado gris, cierre y UNA firma centrada). Sin sección de satisfacción.
   · Se abre en un cuadro dentro de la misma página, montado en Shadow DOM (el CSS de la página no lo deforma),
     con Imprimir / PDF (marco oculto, sin abrir otra pestaña) y Excel. Alturas en dvh (no se corta en celular).
   · Solo lee. Todo sale de Supabase por la Edge Function "api" (misma llamada que los demás módulos).
   · Apagar en un navegador:  localStorage.rl_informe_gh = 'off'  (y recargar).
   · Uso:  window.rlInformeGeneralGH.abrir()
   ════════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.rlInformeGeneralGH) return;
  var APAGADO = false; try { APAGADO = localStorage.getItem('rl_informe_gh') === 'off'; } catch (e) {}
  if (APAGADO) { window.rlInformeGeneralGH = { abrir: function () {}, apagado: true, version: 1 }; return; }

  /* ── configuración ── */
  var SOLO_USUARIO = 'jtimoteo';
  var COD_DOC = 'INF-SC-GH-03';            /* PENDIENTE de confirmar con Joel: código de documento propio de este informe */
  var VERSION_DOC = 'Versión N° 0.0', REVISION_DOC = '24/03/2026';
  var TITULO_DOC = 'INFORME GENERAL DE GESTIÓN HUMANA';
  var EMISOR = { nom: 'Joel Angel Timoteo Gonza', cargo: 'Coordinador de Relaciones Laborales' };
  var RAZON = { RAPEL: 'Sociedad Agrícola Rapel S.A.C.', VERFRUT: 'Sociedad Exportadora Verfrut S.A.C.' };
  var MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  var SECTORES = ['El Papayo', 'Limones', 'Los Olivares', 'Aproa', 'Algarrobos', 'San Vicente', 'Planta Rapel', 'Olivares Bajo', 'Santa Rosa', 'Punta Arenas'];   /* = informes ETI */
  var ANIO_MIN = 2024;
  var NO_PUBLICADO = 'El informe aún no está publicado en el servidor';
  var BASE = (function () { try { if (typeof AZURE_FN_BASE === 'string' && AZURE_FN_BASE) return AZURE_FN_BASE; } catch (e) {} return 'https://rl-fn-verfrut.azurewebsites.net/api'; })();   /* azure-token.js la lleva a Supabase */

  /* ── utilitarios ── */
  var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  var p2 = function (n) { return String(n).padStart(2, '0'); };
  var fF = function (f) { return f ? String(f).slice(0, 10).split('-').reverse().join('/') : '—'; };
  var pc = function (x) { return x == null || isNaN(x) ? '—' : (Math.round(x * 1000) / 10).toFixed(1) + '%'; };
  var nn = function (x) { var v = Number(x) || 0; return (Math.round(v * 100) / 100).toLocaleString('es-PE'); };
  var hoy = function () { var d = new Date(); return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); };
  function usuario() {
    try { if (typeof USER !== 'undefined' && USER && USER.usuario) return String(USER.usuario).trim().toLowerCase(); } catch (e) {}
    try { var u = JSON.parse(sessionStorage.getItem('user') || 'null'); return u && u.usuario ? String(u.usuario).trim().toLowerCase() : ''; } catch (e) { return ''; }
  }
  var esCreador = function () { return usuario() === SOLO_USUARIO; };
  var aviso = function (m) { try { if (typeof mostrarToast === 'function') return mostrarToast(m, 'error'); } catch (e) {} alert(m); };
  function logoUrl() { try { return new URL('../images/logo-unifrutti.jpg', location.href).href; } catch (e) { return ''; } }

  /* ── servidor ── */
  async function pedir(cuerpo) {
    var tk = ''; try { tk = sessionStorage.getItem('rl_token') || ''; } catch (e) {}
    if (!tk) throw new Error('Tu sesión venció: vuelve a iniciar sesión');
    var r;
    try { r = await fetch(BASE + '/informe-gh/datos', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tk }, body: JSON.stringify(cuerpo) }); }
    catch (e) { throw new Error(NO_PUBLICADO + ' o no hay conexión. Intenta de nuevo en unos minutos.'); }
    var j = await r.json().catch(function () { return null; });
    if (r.status === 401) throw new Error('Tu sesión venció: vuelve a iniciar sesión');
    if (r.status === 403) throw new Error((j && j.error) || 'Este informe es solo para el creador del sistema');
    if (r.status >= 500) throw new Error((j && j.error) || ('El servidor tuvo un error (' + r.status + '). Intenta de nuevo en unos minutos.'));
    if (r.status === 404 || !j) throw new Error(NO_PUBLICADO + '.');
    if (!r.ok || !j.success) throw new Error(j.error || ('El servidor respondió ' + r.status));
    if (!j.alcance || !j.bloques) throw new Error('El servidor devolvió una respuesta incompleta. Intenta de nuevo.');
    return j;
  }

  /* ── periodo y alcance ── */
  function periodo(tipo, anio, m1, m2) {
    if (tipo === 'anio') return { tipo: tipo, nom: 'Año ' + anio, desde: anio + '-01-01', hasta: anio + '-12-31' };
    if (tipo === 'rango') { var a = Math.min(m1, m2), b = Math.max(m1, m2);
      return { tipo: a === b ? 'mes' : tipo, nom: a === b ? MESES[a - 1] + ' ' + anio : MESES[a - 1] + ' a ' + MESES[b - 1] + ' ' + anio, desde: anio + '-' + p2(a) + '-01', hasta: anio + '-' + p2(b) + '-' + p2(new Date(anio, b, 0).getDate()) }; }
    return { tipo: 'mes', nom: MESES[m1 - 1] + ' ' + anio, desde: anio + '-' + p2(m1) + '-01', hasta: anio + '-' + p2(m1) + '-' + p2(new Date(anio, m1, 0).getDate()) };
  }
  var mesNom = function (k) { var m = String(k).match(/^(\d{4})-(\d{2})$/); return m ? MESES[+m[2] - 1] + ' ' + m[1] : String(k); };

  /* ── documento (modelo INF-SC-GH-03) ── */
  var SIN = 'Sin registros en el periodo';
  function estilosDoc() {
    var B = '1px solid #000';
    return '<style>.x-doc{font-family:Arial,Helvetica,sans-serif;color:#000;font-size:12px;line-height:1.45;background:#fff}.x-doc *{box-sizing:border-box}' +
      '.x-hd{display:grid;grid-template-columns:112px 1fr 128px;border:' + B + ';font-size:12px}.x-logo{grid-row:1 / span 3;display:flex;align-items:center;justify-content:center;border-right:' + B + ';padding:4px}.x-logo img{max-height:64px;max-width:100%;width:auto}' +
      '.x-rz{text-align:center;font-weight:700;padding:3px;border-right:' + B + ';border-bottom:' + B + '}.x-c1{text-align:center;font-weight:700;padding:3px;border-bottom:' + B + '}' +
      '.x-tit{grid-row:2 / span 2;grid-column:2;display:flex;align-items:center;justify-content:center;text-align:center;font-weight:700;padding:4px 10px;border-right:' + B + '}' +
      '.x-c2{text-align:center;font-weight:700;padding:3px;border-bottom:' + B + '}.x-c3{text-align:center;padding:3px}' +
      '.x-sub{text-align:center;margin:12px 0 4px;font-size:12px}.x-sub b{font-size:13px}' +
      '.x-h2{margin:16px 0 8px;font-size:12px;font-weight:700;color:#000;text-transform:uppercase;break-after:avoid}' +
      '.x-h3{margin:10px 0 4px;font-size:12px;font-weight:700;color:#000;break-after:avoid}' +
      '.x-kv{border-collapse:collapse;margin-left:14px;font-size:12px}.x-kv th{width:150px;text-align:left;vertical-align:top;font-weight:700;padding:2px 8px 2px 0}.x-kv th:after{content:":"}.x-kv td{padding:2px 0;text-align:justify}' +
      '.x-cards{display:grid;grid-template-columns:repeat(3,1fr);border-top:' + B + ';border-left:' + B + '}.x-cards>div{border-right:' + B + ';border-bottom:' + B + ';padding:5px 8px;break-inside:avoid}.x-cards span{display:block;font-weight:700}.x-cards b{display:block;font-size:15px;line-height:1.3;color:#000}.x-cards small{font-size:11px;color:#333}' +
      '.x-sc{overflow-x:auto;-webkit-overflow-scrolling:touch;margin-bottom:8px}' +
      '.x-t{width:100%;border-collapse:collapse;font-size:12px}.x-t th{background:#d9d9d9;color:#000;font-weight:700;padding:3px 5px;border:' + B + ';text-align:center}.x-t td{padding:3px 5px;border:' + B + ';vertical-align:top}.x-t tr{break-inside:avoid}' +
      '.x-t td.x-v{text-align:center;color:#333;font-style:italic}.x-t tr.x-tot td{background:#eee;font-weight:700}' +
      '.x-chip{display:inline-block;padding:0 6px;border-radius:3px;font-weight:700;font-size:12px;white-space:nowrap}.x-p{margin:5px 0 6px;text-align:justify}' +
      '.x-ul{margin:0;padding-left:30px}.x-ul li{margin-bottom:3px;text-align:justify}' +
      '.x-firmas{display:flex;justify-content:center;margin-top:60px;text-align:center;break-inside:avoid}.x-firmas>div{width:300px}.x-l{border-top:' + B + ';padding-top:4px;font-weight:400}.x-firmas small{font-size:12px;color:#000}' +
      '.x-pie{display:flex;justify-content:space-between;gap:10px;margin-top:18px;border-top:1px solid #999;padding-top:5px;color:#555;font-size:10px}' +
      '@media (max-width:560px){.x-hd{grid-template-columns:70px 1fr 92px;font-size:10.5px}.x-cards{grid-template-columns:repeat(2,1fr)}.x-kv th{width:104px}}' +
      '@media print{.x-sc{overflow:visible}.x-cards{grid-template-columns:repeat(3,1fr)}}</style>';
  }
  function cabecera(razon, sub1, sub2) {
    var l = logoUrl();
    return '<div class="x-hd"><div class="x-logo">' + (l ? '<img src="' + esc(l) + '" alt="Unifrutti">' : '') + '</div><div class="x-rz">' + esc(String(razon).toUpperCase()) + '</div><div class="x-c1">' + esc(COD_DOC) + '</div>' +
      '<div class="x-tit">' + esc(TITULO_DOC) + '</div><div class="x-c2">' + esc(VERSION_DOC) + '</div><div class="x-c3"><b>Última revisión:</b><br>' + esc(REVISION_DOC) + '</div></div>' +
      '<div class="x-sub"><b>' + esc(sub1) + '</b><br>' + esc(sub2) + '</div>';
  }
  function firma() { return '<div class="x-firmas"><div><div class="x-l">' + esc(EMISOR.nom) + '</div><small>' + esc(EMISOR.cargo) + '</small></div></div>'; }
  function tabla(heads, filas, al, total) {
    var td = function (x, i) { return '<td style="text-align:' + ((al || [])[i] || 'left') + '">' + x + '</td>'; };
    return '<div class="x-sc"><table class="x-t"><thead><tr>' + heads.map(function (x) { return '<th>' + x + '</th>'; }).join('') + '</tr></thead><tbody>' +
      (filas.length ? filas.map(function (f) { return '<tr>' + f.map(td).join('') + '</tr>'; }).join('') : '<tr><td class="x-v" colspan="' + heads.length + '">' + SIN + '</td></tr>') +
      (total && filas.length ? '<tr class="x-tot">' + total.map(td).join('') + '</tr>' : '') + '</tbody></table></div>';
  }
  var colP = function (p, meta) { return p == null ? ['#eee', '#333'] : p >= meta ? ['#DCFCE7', '#15803D'] : p >= meta - 0.15 ? ['#FEF3C7', '#92400E'] : ['#FEE2E2', '#B91C1C']; };
  var chip = function (p, meta) { var c = colP(p, meta == null ? 0.95 : meta); return '<span class="x-chip" style="background:' + c[0] + ';color:' + c[1] + '">' + pc(p) + '</span>'; };
  var noDisp = function (b) { return '<p class="x-p"><i>Cuadro no disponible: ' + esc((b && b.motivo) || 'el servidor no entregó este bloque') + '</i></p>'; };
  /* lista [{k,n}] -> cuadro "concepto / cantidad / %" */
  function cuadroKN(titulo, L, total, encabezado) {
    L = L || [];
    return tabla([titulo, encabezado || 'Cantidad', '% del total'], L.map(function (x) { return [esc(x.k), nn(x.n), total ? pc(x.n / total) : '—']; }), ['left', 'right', 'right'], ['Total', nn(total), total ? '100.0%' : '—']);
  }

  function documento(P, alcTxt, J) {
    var B = J.bloques || {}, n = 0, emp = J.alcance.empresa || J.alcance.empresaDelSector || '';
    var razon = RAZON[emp] || (RAZON.RAPEL + ' · ' + RAZON.VERFRUT);
    var ROM = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI'];
    var h2 = function (t) { n++; return '<h2 class="x-h2">' + ROM[n - 1] + '.&nbsp;&nbsp;' + t + ':</h2>'; };
    var h3 = function (t) { return '<div class="x-h3">' + t + '</div>'; };
    var at = B.atenciones || {}, vi = B.visitas || {}, fu = B.fusiones || {}, ca = B.casos || {}, ce = B.capEti || {}, ev = B.evalEti || {}, bs = B.bienestar || {}, ho = B.horas || {}, kp = B.kpis || {};
    var x = cabecera(razon, (P.tipo === 'anio' ? 'INFORME ANUAL' : P.tipo === 'rango' ? 'INFORME DEL PERIODO' : 'INFORME MENSUAL') + ' · ' + alcTxt.toUpperCase(), P.nom + ' · emitido el ' + fF(J.hoy || hoy()));

    x += h2('Generalidades') + '<table class="x-kv"><tbody>' + [['Periodo', esc(P.nom) + ' · ' + fF(P.desde) + ' al ' + fF(P.hasta)], ['Empresa', esc(razon)], ['Alcance', esc(alcTxt)],
      ['Área', 'Gestión Humana · Relaciones Laborales'], ['Fuente de datos', 'Sistema RR.LL., Capacitaciones y Evaluaciones ETI y Bienestar Social · base de datos Supabase'],
      ['Emitido por', esc(EMISOR.nom) + ' · ' + esc(EMISOR.cargo)]].map(function (r) { return '<tr><th>' + r[0] + '</th><td>' + r[1] + '</td></tr>'; }).join('') + '</tbody></table>';

    /* resumen ejecutivo: una casilla por bloque disponible */
    var C = [];
    if (at.ok) C.push(['Atenciones al trabajador', nn(at.total), nn(at.finalizadas) + ' finalizadas · ' + nn(at.enProceso) + ' en proceso']);
    if (vi.ok) C.push(['Visitas a campo', nn(vi.total), nn(vi.conInforme) + ' con informe · ' + nn(vi.conRetraso) + ' con retraso']);
    if (fu.ok) C.push(['Fusiones de buses', nn(fu.total), nn(fu.trabajadores) + ' trabajadores trasladados']);
    if (ca.ok) C.push(['Casos e investigaciones', nn(ca.total), ca.total ? pc(ca.pctInforme) + ' con informe · ' + nn(ca.conRetraso) + ' con retraso' : SIN]);
    if (ce.ok) C.push(['Capacitaciones ETI', pc(ce.cumpl.pct), ce.cumpl.ejec + ' de ' + (ce.cumpl.ejec + ce.cumpl.venc) + ' vencidas · meta 95 %']);
    if (ev.ok) C.push(['Evaluaciones ETI', nn(ev.evaluados), ev.evaluados ? 'promedio ' + pc(ev.promedio) + ' · ' + pc(ev.pctAprobados) + ' aprobados' : SIN]);
    if (bs.ok) C.push(['Bienestar Social', nn(((bs.accidentes || {}).total || 0) + ((bs.descansos || {}).total || 0) + ((bs.quejas || {}).total || 0)), 'accidentes, descansos médicos y quejas registrados']);
    if (ho.ok) C.push(['Horas acumuladas', nn(ho.acumuladas), nn(ho.registros) + ' registros · saldo ' + nn(ho.saldo) + ' h']);
    if (kp.ok) { var conC = kp.personas.filter(function (p) { return p.cumpl != null; }); C.push(['Cumplimiento de KPIs del equipo', conC.length ? pc(conC.reduce(function (s, p) { return s + p.cumpl; }, 0) / conC.length) : '—', kp.personas.length + ' personas evaluadas']); }
    x += h2('Resumen ejecutivo') + (C.length ? '<div class="x-cards">' + C.map(function (k) { return '<div><span>' + k[0] + '</span><b>' + k[1] + '</b><small>' + esc(k[2]) + '</small></div>'; }).join('') + '</div>' : '<p class="x-p">' + SIN + '.</p>');

    /* atenciones */
    x += h2('Atenciones al trabajador');
    if (!at.ok) x += noDisp(at); else {
      x += '<p class="x-p">Se registraron <b>' + nn(at.total) + '</b> atenciones en el periodo.</p>' +
        h3('Por tipo de atención') + cuadroKN('Tipo de atención', at.porTipo, at.total) +
        h3('Por responsable') + cuadroKN('Responsable', at.porResponsable, at.total) +
        h3('Por estado') + cuadroKN('Estado', at.porEstado, at.total);
      if (!J.alcance.sector && !J.alcance.empresa) x += h3('Por empresa') + cuadroKN('Empresa', at.porEmpresa, at.total);
      if (at.porMes && at.porMes.length > 1) x += h3('Por mes') + tabla(['Mes', 'Atenciones'], at.porMes.map(function (m) { return [esc(mesNom(m.k)), nn(m.n)]; }), ['left', 'right'], ['Total', nn(at.total)]);
    }

    /* visitas */
    x += h2('Visitas a campo');
    if (!vi.ok) x += noDisp(vi); else {
      x += tabla(['Supervisor', 'Visitas', 'Con informe', 'Con retraso'], vi.porSupervisor.map(function (s) { return [esc(s.k), nn(s.n), nn(s.conInforme || 0), nn(s.conRetraso || 0)]; }), ['left', 'right', 'right', 'right'],
        ['Total', nn(vi.total), nn(vi.conInforme), nn(vi.conRetraso)]) + h3('Por sector visitado') + cuadroKN('Sector / fundo', vi.porSector, vi.total, 'Visitas');
    }

    /* fusiones */
    x += h2('Fusiones de buses');
    if (!fu.ok) x += noDisp(fu); else {
      x += tabla(['Sector', 'Fusiones', 'Trabajadores'], fu.porSector.map(function (s) { return [esc(s.k), nn(s.n), nn(s.trab || 0)]; }), ['left', 'right', 'right'], ['Total', nn(fu.total), nn(fu.trabajadores)]) +
        h3('Por supervisor') + tabla(['Supervisor', 'Fusiones', 'Trabajadores'], fu.porSupervisor.map(function (s) { return [esc(s.k), nn(s.n), nn(s.trab || 0)]; }), ['left', 'right', 'right'], ['Total', nn(fu.total), nn(fu.trabajadores)]) +
        h3('Por motivo') + cuadroKN('Motivo', fu.porMotivo, fu.total, 'Fusiones');
    }

    /* casos */
    x += h2('Casos, investigaciones y cumplimiento');
    if (!ca.ok) x += noDisp(ca); else {
      x += '<p class="x-p">Casos registrados en el periodo: <b>' + nn(ca.total) + '</b>' + (ca.total ? ' · con informe cargado: <b>' + nn(ca.conInforme) + '</b> (' + pc(ca.pctInforme) + ') · con días de retraso: <b>' + nn(ca.conRetraso) + '</b>' : '') + '.</p>' +
        tabla(['Supervisor', 'Casos', 'Con informe', '% con informe', 'Con retraso'], ca.porSupervisor.map(function (s) { return [esc(s.k), nn(s.n), nn(s.conInforme || 0), s.n ? pc((s.conInforme || 0) / s.n) : '—', nn(s.conRetraso || 0)]; }),
          ['left', 'right', 'right', 'right', 'right'], ['Total', nn(ca.total), nn(ca.conInforme), pc(ca.pctInforme), nn(ca.conRetraso)]) +
        h3('Por motivo') + cuadroKN('Motivo', ca.porMotivo, ca.total, 'Casos') + h3('Por estado') + cuadroKN('Estado', ca.porEstado, ca.total, 'Casos') +
        h3('Por estado de gestión') + cuadroKN('Estado de gestión', ca.porGestion, ca.total, 'Casos') + h3('Por gravedad') + cuadroKN('Gravedad', ca.porGravedad, ca.total, 'Casos');
    }

    /* capacitaciones ETI */
    x += h2('Capacitaciones ETI');
    if (!ce.ok) x += noDisp(ce); else {
      var c = ce.cumpl, t = ce.tot;
      x += '<p class="x-p">Cumplimiento = ejecutadas / (ejecutadas + vencidas). Meta: 95 %. Fechas programadas: <b>' + c.prog + '</b> · ejecutadas: <b>' + c.ejec + '</b> · vencidas: <b>' + c.venc + '</b> · por venir: <b>' + c.fut +
        '</b> · cumplimiento: ' + chip(c.pct, 0.95) + '. Sesiones registradas: <b>' + nn(t.sesiones) + '</b> · personal capacitado: <b>' + nn(t.capacitados) + '</b> (' + nn(t.hombres) + ' hombres y ' + nn(t.mujeres) + ' mujeres) · reprogramaciones: <b>' + nn(ce.reprogramaciones) + '</b>.</p>' +
        tabla(['Sector', 'Empresa', 'Programadas', 'Ejecutadas', 'Vencidas', 'Por venir', 'Cumplimiento', 'Sesiones', 'Capacitados'],
          ce.sectores.map(function (s) { return [esc(s.sector), esc(s.empresa || '—'), s.c.prog, s.c.ejec, s.c.venc, s.c.fut, chip(s.c.pct, 0.95), nn(s.sesiones), nn(s.capacitados)]; }),
          ['left', 'left', 'right', 'right', 'right', 'right', 'center', 'right', 'right'], ['Total', '', c.prog, c.ejec, c.venc, c.fut, chip(c.pct, 0.95), nn(t.sesiones), nn(t.capacitados)]) +
        h3('Actas') + tabla(['Actas en plazo', 'Actas fuera de plazo', 'Sin fecha de envío'], t.sesiones ? [[nn(t.actasPlazo), nn(t.actasFuera), nn(t.sinActa)]] : [], ['center', 'center', 'center']) +
        h3('Por tema') + tabla(['Tema', 'Sesiones', 'Capacitados'], ce.porTema.map(function (m) { return [esc(m.k), nn(m.n), nn(m.capacitados || 0)]; }), ['left', 'right', 'right'], ['Total', nn(t.sesiones), nn(t.capacitados)]);
    }

    /* evaluaciones ETI */
    x += h2('Evaluaciones ETI');
    if (!ev.ok) x += noDisp(ev); else {
      x += '<p class="x-p">Trabajadores evaluados: <b>' + nn(ev.evaluados) + '</b>' + (ev.evaluados ? ' · resultado promedio: <b>' + pc(ev.promedio) + '</b> · aprobados (70 % o más): <b>' + nn(ev.aprobados) + '</b> (' + pc(ev.pctAprobados) + ')' : '') + '.</p>' +
        tabla(['Sector', 'Empresa', 'Rutas', 'Evaluados', 'Aprobados', 'Resultado promedio'], ev.porSector.map(function (s) { return [esc(s.sector), esc(s.empresa || '—'), nn(s.rutas), nn(s.evaluados), nn(s.aprobados), chip(s.promedio, 0.7)]; }),
          ['left', 'left', 'right', 'right', 'right', 'center'], ['Total', '', '', nn(ev.evaluados), nn(ev.aprobados), chip(ev.promedio, 0.7)]);
    }

    /* bienestar social (solo conteos) */
    x += h2('Bienestar Social');
    if (!bs.ok) x += noDisp(bs); else {
      var fila = function (nom, o, extra) { return o ? [nom, nn(o.total), extra || '—'] : [nom, '—', nom === 'Subsidios' && J.alcance.sector ? 'Los subsidios no guardan sector: solo salen en el alcance general o por empresa' : 'Tabla aún no cargada en la base']; };
      x += tabla(['Módulo', 'Registros del periodo', 'Detalle'], [
        fila('Accidentes de trabajo', bs.accidentes, bs.accidentes ? nn(bs.accidentes.abiertos) + ' con caso abierto' : ''),
        fila('Descansos médicos', bs.descansos, bs.descansos ? nn(bs.descansos.dias) + ' días de descanso' : ''),
        fila('Subsidios', bs.subsidios, bs.subsidios ? nn(bs.subsidios.dias) + ' días subsidiados' : ''),
        fila('Quejas y sugerencias', bs.quejas, ''),
        fila('Denuncias de hostigamiento', bs.hostigamiento, '')], ['left', 'right', 'left']);
      if (bs.accidentes) x += h3('Accidentes por tipo') + cuadroKN('Tipo de accidente', bs.accidentes.porTipo, bs.accidentes.total, 'Accidentes');
      if (bs.descansos) x += h3('Descansos médicos por tipo') + tabla(['Tipo', 'Descansos', 'Días'], bs.descansos.porTipo.map(function (m) { return [esc(m.k), nn(m.n), nn(m.dias || 0)]; }), ['left', 'right', 'right'], ['Total', nn(bs.descansos.total), nn(bs.descansos.dias)]);
      if (bs.quejas) x += h3('Quejas por clasificación') + cuadroKN('Clasificación', bs.quejas.porClasificacion, bs.quejas.total, 'Quejas');
    }

    /* horas */
    x += h2('Acumulación de horas');
    if (!ho.ok) x += noDisp(ho); else {
      x += '<p class="x-p">Registros aprobados o pendientes: <b>' + nn(ho.registros) + '</b> (rechazados, no sumados: ' + nn(ho.rechazados) + ') · horas acumuladas: <b>' + nn(ho.acumuladas) + '</b> · horas de permiso: <b>' + nn(ho.permiso) + '</b> · horas de deuda: <b>' + nn(ho.deuda) + '</b> · saldo del periodo: <b>' + nn(ho.saldo) + '</b>.</p>' +
        tabla(['Motivo', 'Registros', 'Acumuladas', 'Permiso', 'Deuda'], ho.porMotivo.map(function (m) { return [esc(m.k), nn(m.n), nn(m.acum || 0), nn(m.perm || 0), nn(m.deuda || 0)]; }), ['left', 'right', 'right', 'right', 'right'],
          ['Total', nn(ho.registros), nn(ho.acumuladas), nn(ho.permiso), nn(ho.deuda)]) +
        h3('Por quien registró') + cuadroKN('Usuario', ho.porRegistrador, ho.registros, 'Registros');
    }

    /* KPIs */
    x += h2('Desempeño por supervisor y sector (KPIs)');
    if (!kp.ok) x += noDisp(kp); else {
      x += '<p class="x-p">Indicadores oficiales del equipo de Relaciones Laborales, calculados con la misma regla del módulo de KPIs' + (kp.inicioMedicion && kp.inicioMedicion > P.desde ? ' (la medición inicia el ' + fF(kp.inicioMedicion) + ')' : '') + '.</p>' +
        tabla(['Persona', 'Puesto', 'Sector(es)', 'Indicadores (resultado / meta)', 'Cumplimiento', 'Nota'], kp.personas.map(function (p) {
          var ks = (p.kpis || []).map(function (k) { return '<b>' + esc(k.codigo) + '</b> ' + esc(k.corto || '') + ': ' + (k.estado === 'ok' ? (k.meta == null ? nn(k.num) + ' / ' + nn(k.den) : pc(k.pct) + ' (' + nn(k.num) + ' de ' + nn(k.den) + ') / ' + pc(k.meta)) : 'sin datos'); }).join('<br>');
          return ['<b>' + esc(p.nombre) + '</b>', esc(p.puesto || p.tipo || ''), esc((p.sectores || []).join(', ')), ks || '—', chip(p.cumpl, 0.95), p.nota == null ? '—' : '<b>' + nn(p.nota) + '</b>']; }),
          ['left', 'left', 'left', 'left', 'center', 'center']);
      /* indicadores del equipo vs. meta: suma de cumplidos y evaluados de todas las personas del alcance */
      var EQ = {}, ordenK = [];
      kp.personas.forEach(function (p) { (p.kpis || []).forEach(function (k) { if (k.estado !== 'ok' || k.meta == null || !k.den) return;
        var z = EQ[k.codigo]; if (!z) { z = EQ[k.codigo] = { codigo: k.codigo, corto: k.corto, meta: k.meta, num: 0, den: 0 }; ordenK.push(k.codigo); } z.num += Number(k.num) || 0; z.den += Number(k.den) || 0; }); });
      x += h3('Indicadores del equipo frente a la meta') + tabla(['Cód.', 'Indicador', 'Meta', 'Cumplidos', 'Evaluados', 'Resultado', 'Estado'], ordenK.sort().map(function (c) { var z = EQ[c], r = z.num / z.den;
        return ['<b>' + esc(z.codigo) + '</b>', esc(z.corto || ''), pc(z.meta), nn(z.num), nn(z.den), chip(r, z.meta), r >= z.meta ? 'Cumple' : 'Bajo meta']; }), ['left', 'left', 'right', 'right', 'right', 'center', 'left']);
    }

    /* conclusiones: solo lo que dicen las cifras */
    var L = [];
    if (at.ok) L.push('Se registraron ' + nn(at.total) + ' atenciones al trabajador' + (at.porTipo[0] ? '; el tipo más frecuente fue "' + at.porTipo[0].k + '" (' + nn(at.porTipo[0].n) + ')' : '') + '.');
    if (vi.ok && fu.ok) L.push('Se realizaron ' + nn(vi.total) + ' visitas a campo y ' + nn(fu.total) + ' fusiones de buses.');
    if (ca.ok) L.push(ca.total ? 'De ' + nn(ca.total) + ' casos registrados, ' + nn(ca.conInforme) + ' tienen informe cargado (' + pc(ca.pctInforme) + ') y ' + nn(ca.conRetraso) + ' presentan días de retraso.' : 'No se registraron casos en el periodo.');
    if (ce.ok) L.push(ce.cumpl.pct == null ? 'Capacitaciones ETI: no hubo fechas programadas vencidas en el periodo.' : 'Capacitaciones ETI: ' + ce.cumpl.ejec + ' ejecutadas de ' + (ce.cumpl.ejec + ce.cumpl.venc) + ' con fecha vencida (' + pc(ce.cumpl.pct) + '); ' + (ce.cumpl.pct >= 0.95 ? 'se cumple' : 'no se alcanza') + ' la meta de 95 %.');
    if (ev.ok && ev.evaluados) L.push('Evaluaciones ETI: ' + nn(ev.evaluados) + ' trabajadores evaluados con resultado promedio de ' + pc(ev.promedio) + '.');
    if (kp.ok && kp.personas.length) { var bajo = kp.personas.filter(function (p) { return p.cumpl != null && p.cumpl < 0.95; }); L.push(bajo.length ? 'Personas con cumplimiento de KPIs menor a 95 %: ' + bajo.map(function (p) { return p.nombre + ' (' + pc(p.cumpl) + ')'; }).join(', ') + '.' : 'Ninguna persona evaluada tiene cumplimiento de KPIs menor a 95 %.'); }
    var fuera = [['Atenciones', at], ['Visitas', vi], ['Fusiones', fu], ['Casos', ca], ['Capacitaciones ETI', ce], ['Evaluaciones ETI', ev], ['Bienestar Social', bs], ['Horas', ho], ['KPIs', kp]].filter(function (z) { return !z[1].ok; }).map(function (z) { return z[0]; });
    if (fuera.length) L.push('Cuadros no disponibles en esta emisión: ' + fuera.join(', ') + '.');
    x += h2('Conclusiones') + (L.length ? '<ul class="x-ul">' + L.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul>' : '<p class="x-p">' + SIN + '.</p>');

    x += '<p class="x-p" style="margin-top:14px">Es todo en cuanto tengo que informar.</p>' + firma();
    x += '<div class="x-pie"><span>Gestión Humana · Relaciones Laborales · Unifrutti Perú</span><span>Generado por el Sistema RR.LL. desde Supabase · ' + esc(new Date(J.generado || Date.now()).toLocaleString('es-PE')) + '</span></div>';
    return '<div class="x-doc">' + estilosDoc() + x + '</div>';
  }

  /* ── cuadro en la misma página (todo dentro de un Shadow DOM) ── */
  var HOST = null, RAIZ = null, ULT = null;
  var q = function (sel) { return RAIZ ? RAIZ.querySelector(sel) : null; };
  function cssCuadro() {
    return '<style>:host{all:initial}*{box-sizing:border-box}' +
      '.ov{position:fixed;inset:0;z-index:2147483000;background:rgba(10,20,40,.55);display:flex;align-items:center;justify-content:center;padding:10px;font-family:Arial,Helvetica,sans-serif;color:#0F172A}' +
      '.box{background:#F1F5F9;border-radius:14px;width:100%;max-width:1100px;height:94vh;height:94dvh;max-height:94dvh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.3)}' +
      '.hd{padding:10px 14px;display:flex;justify-content:space-between;align-items:flex-start;gap:10px;border-bottom:1px solid #E2E8F0;background:#fff;flex:0 0 auto}.hd b{font-size:17px;color:#0E2A5C}.hd small{display:block;color:#5B6B82;font-size:12px;margin-top:2px}' +
      '.bd{padding:12px 14px 18px;overflow:auto;flex:1 1 auto;min-height:0;-webkit-overflow-scrolling:touch}' +
      '.b{min-height:38px;padding:0 13px;border-radius:9px;border:1.5px solid #0E2A5C;background:#fff;font:700 13px Arial,sans-serif;color:#0E2A5C;cursor:pointer;white-space:nowrap}.b.p{background:#0E2A5C;color:#fff}.b.r{background:#C8102E;border-color:#C8102E;color:#fff}.b:disabled{opacity:.45;cursor:not-allowed}' +
      '.f{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:10px 12px}.f label{display:block;font-size:12px;font-weight:700;color:#475569;margin:0 0 4px}' +
      '.f select{min-height:38px;padding:0 8px;border:1.5px solid #C7D2E6;border-radius:9px;font:600 14px Arial,sans-serif;background:#fff;color:#0F172A;max-width:100%}' +
      '.vacio{padding:18px;text-align:center;color:#64748B;background:#fff;border:1px dashed #CBD5E1;border-radius:12px;margin-top:10px;font-size:14px}.vacio.e{color:#991B1B;border-color:#FCA5A5;background:#FEF2F2}' +
      '.acc{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.doc{background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:14px;margin-top:10px}.hoja{max-width:794px;margin:0 auto}' +
      '@media (max-width:640px){.ov{padding:0}.box{height:100vh;height:100dvh;max-height:100dvh;border-radius:0}.hd b{font-size:15px}.bd{padding:10px 8px 16px}.doc{padding:8px}.f>div{flex:1 1 44%}.f select{width:100%}}</style>';
  }
  function cerrar() { if (HOST) { HOST.remove(); HOST = null; RAIZ = null; } document.removeEventListener('keydown', tecla); }
  function tecla(e) { if (e.key === 'Escape') cerrar(); }
  function abrir() {
    if (!esCreador()) { aviso('El Informe General de Gestión Humana es solo para el creador del sistema'); return; }
    cerrar();
    var d = new Date(), y = d.getFullYear(), anios = []; for (var a = y; a >= ANIO_MIN; a--) anios.push([a, a]);
    var opt = function (L, sel) { return L.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(sel) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join(''); };
    var meses = MESES.map(function (m, i) { return [i + 1, m]; });
    HOST = document.createElement('div'); HOST.id = 'rlInformeGH';
    try { RAIZ = HOST.attachShadow({ mode: 'open' }); } catch (e) { RAIZ = HOST; }
    RAIZ.innerHTML = cssCuadro() + '<div class="ov"><div class="box" role="dialog" aria-modal="true" aria-label="Informe General de Gestión Humana">' +
      '<div class="hd"><div><b>Informe General de Gestión Humana</b><small>Consolidado del área por periodo y alcance · solo lectura · datos de Supabase</small></div><button class="b" id="x" type="button">✕ Cerrar</button></div>' +
      '<div class="bd"><div class="f">' +
      '<div><label>Periodo</label><select id="tipo">' + opt([['mes', 'Un mes'], ['rango', 'Rango de meses'], ['anio', 'Año completo']], 'mes') + '</select></div>' +
      '<div id="w-m1"><label id="l-m1">Mes</label><select id="m1">' + opt(meses, d.getMonth() + 1) + '</select></div>' +
      '<div id="w-m2" style="display:none"><label>Hasta el mes</label><select id="m2">' + opt(meses, d.getMonth() + 1) + '</select></div>' +
      '<div><label>Año</label><select id="anio">' + opt(anios, y) + '</select></div>' +
      '<div><label>Alcance</label><select id="alc">' + opt([['', 'General · ambas empresas'], ['E:RAPEL', 'Empresa · RAPEL'], ['E:VERFRUT', 'Empresa · VERFRUT']].concat(SECTORES.map(function (s) { return ['S:' + s, 'Sector · ' + s]; })), '') + '</select></div>' +
      '<div><button class="b p" id="ver" type="button">Ver informe</button></div></div>' +
      '<div id="out"><div class="vacio">Elige el periodo y el alcance, y pulsa <b>Ver informe</b>.</div></div></div></div></div>';
    document.body.appendChild(HOST);
    q('#x').onclick = cerrar;
    q('.ov').addEventListener('click', function (e) { if (e.target === q('.ov')) cerrar(); });
    document.addEventListener('keydown', tecla);
    var sync = function () { var t = q('#tipo').value; q('#w-m1').style.display = t === 'anio' ? 'none' : ''; q('#w-m2').style.display = t === 'rango' ? '' : 'none'; q('#l-m1').textContent = t === 'rango' ? 'Desde el mes' : 'Mes'; };
    q('#tipo').onchange = sync; sync();
    q('#ver').onclick = ver;
  }
  async function ver() {
    var out = q('#out'), b = q('#ver'); if (!out || !b) return;
    var P = periodo(q('#tipo').value, +q('#anio').value, +q('#m1').value, +q('#m2').value), v = q('#alc').value;
    var emp = v.indexOf('E:') === 0 ? v.slice(2) : '', sec = v.indexOf('S:') === 0 ? v.slice(2) : '';
    var alcTxt = sec ? 'Sector ' + sec : emp ? 'Empresa ' + emp : 'General · RAPEL y VERFRUT';
    b.disabled = true; out.innerHTML = '<div class="vacio">Leyendo de Supabase la gestión de ' + esc(P.nom) + '…</div>';
    try {
      var J = await pedir({ desde: P.desde, hasta: P.hasta, empresa: emp, sector: sec });
      if (!HOST || !out.isConnected) return;
      ULT = { P: P, alcTxt: alcTxt, J: J, html: documento(P, alcTxt, J) };
      out.innerHTML = '<div class="acc"><button class="b r" id="pdf" type="button">Imprimir / PDF</button><button class="b p" id="xls" type="button">Excel</button></div><div class="doc"><div class="hoja">' + ULT.html + '</div></div>';
      q('#pdf').onclick = imprimir; q('#xls').onclick = excel;
    } catch (e) {
      try { console.error('[_INFORME_GENERAL_GH_V1]', e); } catch (x) {}
      if (out.isConnected) out.innerHTML = '<div class="vacio e">' + esc(e.message || 'No se pudo preparar el informe') + '</div>';
    } finally { b.disabled = false; }
  }
  function nombreArchivo() { return ('Informe_General_GH_' + ULT.alcTxt + '_' + ULT.P.nom).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, ''); }

  /* imprimir / PDF sin abrir otra pestaña: marco oculto en la misma página */
  function imprimir() {
    if (!ULT) return;
    var viejo = document.getElementById('rlInformeGHPrint'); if (viejo) viejo.remove();
    var f = document.createElement('iframe'); f.id = 'rlInformeGHPrint'; f.setAttribute('aria-hidden', 'true');
    f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0';
    document.body.appendChild(f);
    var w = f.contentWindow, dd = w.document, tit = document.title;
    dd.open();
    dd.write('<!doctype html><html lang="es"><head><meta charset="utf-8"><title>' + esc(nombreArchivo()) + '</title><style>@page{size:A4;margin:14mm 12mm}html,body{margin:0;background:#fff}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}</style></head><body>' + ULT.html + '</body></html>');
    dd.close();
    var lanzar = function () { try { document.title = nombreArchivo(); w.focus(); w.print(); } catch (e) { aviso('No se pudo abrir la impresión en este navegador'); } setTimeout(function () { document.title = tit; }, 1500); };
    var img = dd.querySelector('img'), hecho = false, una = function () { if (hecho) return; hecho = true; setTimeout(lanzar, 150); };
    if (img && !img.complete) { img.onload = una; img.onerror = una; setTimeout(una, 2500); } else una();
  }

  function excel() {
    if (!ULT) return;
    if (!window.XLSX) { aviso('No se pudo cargar la librería de Excel en esta página'); return; }
    var J = ULT.J, B = J.bloques || {}, wb = XLSX.utils.book_new(), p = function (x) { return x == null ? '' : Math.round(x * 1000) / 10; };
    var hoja = function (nom, filas) { XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(filas.length > 1 ? filas : filas.concat([[SIN]])), nom.slice(0, 31)); };
    var kn = function (L, t1, t2) { return [[t1, t2 || 'Cantidad']].concat((L || []).map(function (x) { return [x.k, x.n]; })); };
    var R = [[TITULO_DOC], ['Código', COD_DOC], ['Periodo', ULT.P.nom], ['Desde', fF(ULT.P.desde)], ['Hasta', fF(ULT.P.hasta)], ['Alcance', ULT.alcTxt], ['Emitido por', EMISOR.nom + ' · ' + EMISOR.cargo], ['Emitido el', fF(J.hoy || hoy())], []];
    var at = B.atenciones || {}, vi = B.visitas || {}, fu = B.fusiones || {}, ca = B.casos || {}, ce = B.capEti || {}, ev = B.evalEti || {}, bs = B.bienestar || {}, ho = B.horas || {}, kp = B.kpis || {};
    var falta = function (nom, b) { R.push([nom, 'No disponible: ' + ((b && b.motivo) || '')]); };
    if (at.ok) { R.push(['Atenciones', at.total], ['Atenciones finalizadas', at.finalizadas], ['Atenciones en proceso', at.enProceso]);
      hoja('Atenciones tipo', kn(at.porTipo, 'Tipo de atención')); hoja('Atenciones responsable', kn(at.porResponsable, 'Responsable')); hoja('Atenciones estado', kn(at.porEstado, 'Estado'));
      hoja('Atenciones empresa', kn(at.porEmpresa, 'Empresa')); hoja('Atenciones mes', [['Mes', 'Atenciones']].concat((at.porMes || []).map(function (m) { return [mesNom(m.k), m.n]; }))); } else falta('Atenciones', at);
    if (vi.ok) { R.push(['Visitas a campo', vi.total], ['Visitas con informe', vi.conInforme], ['Visitas con retraso', vi.conRetraso]);
      hoja('Visitas', [['Supervisor', 'Visitas', 'Con informe', 'Con retraso']].concat(vi.porSupervisor.map(function (s) { return [s.k, s.n, s.conInforme || 0, s.conRetraso || 0]; }))); hoja('Visitas sector', kn(vi.porSector, 'Sector / fundo', 'Visitas')); } else falta('Visitas', vi);
    if (fu.ok) { R.push(['Fusiones de buses', fu.total], ['Trabajadores en fusiones', fu.trabajadores]);
      hoja('Fusiones sector', [['Sector', 'Fusiones', 'Trabajadores']].concat(fu.porSector.map(function (s) { return [s.k, s.n, s.trab || 0]; })));
      hoja('Fusiones supervisor', [['Supervisor', 'Fusiones', 'Trabajadores']].concat(fu.porSupervisor.map(function (s) { return [s.k, s.n, s.trab || 0]; }))); hoja('Fusiones motivo', kn(fu.porMotivo, 'Motivo', 'Fusiones')); } else falta('Fusiones', fu);
    if (ca.ok) { R.push(['Casos registrados', ca.total], ['Casos con informe', ca.conInforme], ['Casos con retraso', ca.conRetraso]);
      hoja('Casos supervisor', [['Supervisor', 'Casos', 'Con informe', 'Con retraso']].concat(ca.porSupervisor.map(function (s) { return [s.k, s.n, s.conInforme || 0, s.conRetraso || 0]; })));
      hoja('Casos motivo', kn(ca.porMotivo, 'Motivo', 'Casos')); hoja('Casos estado', kn(ca.porEstado, 'Estado', 'Casos')); hoja('Casos gravedad', kn(ca.porGravedad, 'Gravedad', 'Casos')); } else falta('Casos', ca);
    if (ce.ok) { R.push(['ETI fechas programadas', ce.cumpl.prog], ['ETI ejecutadas', ce.cumpl.ejec], ['ETI vencidas', ce.cumpl.venc], ['ETI por venir', ce.cumpl.fut], ['ETI cumplimiento %', p(ce.cumpl.pct)], ['ETI meta %', 95],
        ['ETI sesiones registradas', ce.tot.sesiones], ['ETI capacitados', ce.tot.capacitados], ['ETI reprogramaciones', ce.reprogramaciones]);
      hoja('Capacitaciones ETI', [['Sector', 'Empresa', 'Programadas', 'Ejecutadas', 'Vencidas', 'Por venir', 'Cumplimiento %', 'Sesiones', 'Capacitados']].concat(ce.sectores.map(function (s) { return [s.sector, s.empresa, s.c.prog, s.c.ejec, s.c.venc, s.c.fut, p(s.c.pct), s.sesiones, s.capacitados]; })));
      hoja('Capacitaciones ETI tema', [['Tema', 'Sesiones', 'Capacitados']].concat(ce.porTema.map(function (m) { return [m.k, m.n, m.capacitados || 0]; }))); } else falta('Capacitaciones ETI', ce);
    if (ev.ok) { R.push(['Evaluaciones ETI: evaluados', ev.evaluados], ['Evaluaciones ETI: promedio %', p(ev.promedio)], ['Evaluaciones ETI: aprobados', ev.aprobados]);
      hoja('Evaluaciones ETI', [['Sector', 'Empresa', 'Rutas', 'Evaluados', 'Aprobados', 'Promedio %']].concat(ev.porSector.map(function (s) { return [s.sector, s.empresa, s.rutas, s.evaluados, s.aprobados, p(s.promedio)]; }))); } else falta('Evaluaciones ETI', ev);
    if (bs.ok) { var F = [['Módulo', 'Registros', 'Dato', 'Valor']];
      if (bs.accidentes) { F.push(['Accidentes', bs.accidentes.total, 'Con caso abierto', bs.accidentes.abiertos]); bs.accidentes.porTipo.forEach(function (m) { F.push(['Accidentes', '', 'Tipo: ' + m.k, m.n]); }); }
      if (bs.descansos) { F.push(['Descansos médicos', bs.descansos.total, 'Días', bs.descansos.dias]); bs.descansos.porTipo.forEach(function (m) { F.push(['Descansos médicos', '', 'Tipo: ' + m.k, m.n]); }); }
      if (bs.subsidios) { F.push(['Subsidios', bs.subsidios.total, 'Días', bs.subsidios.dias]); bs.subsidios.porEstado.forEach(function (m) { F.push(['Subsidios', '', 'Estado: ' + m.k, m.n]); }); }
      if (bs.quejas) { F.push(['Quejas y sugerencias', bs.quejas.total, '', '']); bs.quejas.porClasificacion.forEach(function (m) { F.push(['Quejas y sugerencias', '', 'Clasificación: ' + m.k, m.n]); }); }
      if (bs.hostigamiento) { F.push(['Denuncias de hostigamiento', bs.hostigamiento.total, '', '']); bs.hostigamiento.porEstado.forEach(function (m) { F.push(['Denuncias de hostigamiento', '', 'Estado: ' + m.k, m.n]); }); }
      hoja('Bienestar Social', F); } else falta('Bienestar Social', bs);
    if (ho.ok) { R.push(['Horas: registros', ho.registros], ['Horas acumuladas', ho.acumuladas], ['Horas de permiso', ho.permiso], ['Horas de deuda', ho.deuda], ['Horas: saldo', ho.saldo]);
      hoja('Horas', [['Motivo', 'Registros', 'Acumuladas', 'Permiso', 'Deuda']].concat(ho.porMotivo.map(function (m) { return [m.k, m.n, m.acum || 0, m.perm || 0, m.deuda || 0]; }))); } else falta('Horas', ho);
    if (kp.ok) { var K = [['Persona', 'Puesto', 'Empresa', 'Sector(es)', 'Indicador', 'Descripción', 'Resultado %', 'Cumplidos', 'Evaluados', 'Meta %', 'Cumplimiento general %', 'Nota']];
      kp.personas.forEach(function (x) { (x.kpis && x.kpis.length ? x.kpis : [{}]).forEach(function (k) { K.push([x.nombre, x.puesto || x.tipo || '', x.empresa, (x.sectores || []).join(', '), k.codigo || '', k.corto || '', k.estado === 'ok' ? p(k.pct) : '', k.estado === 'ok' ? k.num : '', k.estado === 'ok' ? k.den : '', k.meta == null ? '' : p(k.meta), p(x.cumpl), x.nota == null ? '' : x.nota]); }); });
      hoja('KPIs', K); } else falta('KPIs', kp);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(R), 'Resumen');
    wb.SheetNames.unshift(wb.SheetNames.pop());   /* "Resumen" primero */
    XLSX.writeFile(wb, nombreArchivo() + '.xlsx');
  }

  /* ── entrada en el menú lateral: solo en la sesión del creador ── */
  var intentos = 0;
  function boton() {
    if (document.getElementById('navInformeGH')) return true;
    if (!esCreador()) return false;
    var ref = document.getElementById('navKpis'), nav = ref ? ref.parentNode : document.querySelector('.nav');
    if (!nav) return false;
    var b = document.createElement('button'); b.className = 'ni'; b.id = 'navInformeGH'; b.type = 'button';
    b.innerHTML = '<span class="ic">📑</span>Informe General GH';
    b.title = 'Informe General de Gestión Humana (solo el creador del sistema)';
    b.onclick = function () { abrir(); };
    if (ref && ref.nextSibling) nav.insertBefore(b, ref.nextSibling); else nav.appendChild(b);
    return true;
  }
  function esperar() { if (boton() || ++intentos > 20) return; setTimeout(esperar, 700); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', esperar); else esperar();

  window.rlInformeGeneralGH = { abrir: abrir, cerrar: cerrar, version: 1, _documento: documento, _periodo: periodo };
})();
