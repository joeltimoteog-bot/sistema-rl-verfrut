/* dashboard.html · bloque 39 (antes en la linea 16030) · extraido el 24-oct-2026 sin cambios (_MODULAR_V1) */

/* ═══════════════════════════════════════════════════════════════════════════
   _ASISTENTE_DATOS_V1 (24-set-2026) — el asistente 🤖 responde con TUS datos
   ---------------------------------------------------------------------------
   · Opcion "📊 Mis datos" en el menu del asistente y preguntas libres como
     "mis pendientes", "cuantas atenciones llevo", "mi indice", "estoy restringido".
   · Atenciones: Azure /atenciones/stats?supervisor=<tu nombre> (rapido).
   · Cumplimiento: cumplPendientes (misma fuente que la campana 🔔, con cache).
   · Cada usuario ve SOLO lo suyo. Solo lectura: no guarda ni cambia nada.
   Para revertir: borrar este bloque (el asistente vuelve a funcionar igual).
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
'use strict';
var SEM = { EN_PLAZO: '🟢', PROXIMO: '🟡', VENCE_HOY: '🟠', VENCIDO: '🔴', CRITICO: '⚫' };
var TXT = { EN_PLAZO: 'en plazo', PROXIMO: 'próximo a vencer', VENCE_HOY: 'vence hoy', VENCIDO: 'vencido', CRITICO: 'crítico' };

function A() { return window._rlAsis || null; }
function u() { try { return (typeof USER !== 'undefined' && USER && USER.usuario) ? USER : JSON.parse(sessionStorage.getItem('user') || 'null'); } catch (e) { return null; } }
function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
function fmt(iso) { iso = String(iso || ''); return iso.length >= 10 ? iso.slice(8, 10) + '/' + iso.slice(5, 7) : iso; }
function primer(n) { n = String(n || '').trim().split(' ')[0] || ''; return n.charAt(0).toUpperCase() + n.slice(1).toLowerCase(); }
function menuBtn() { return { t: '🏠 Menú', c: 'sec', f: function () { A().menu(false); } }; }

async function stats(us) {
  try {
    if (typeof AZURE_FN_BASE === 'undefined') return null;
    var r = await fetch(AZURE_FN_BASE + '/atenciones/stats?supervisor=' + encodeURIComponent(us.nombre || us.usuario));
    if (!r.ok) return null;
    var j = await r.json();
    return (j && j.success && j.resumen_global) ? j.resumen_global : null;
  } catch (e) { return null; }
}
async function cumpl(us) {
  try {
    var r = await apiPost({ action: 'cumplPendientes', usuario: us.usuario, rol: us.rol });
    return (r && r.success) ? r : null;
  } catch (e) { return null; }
}

/* foco: 'todo' | 'atenciones' | 'pendientes' | 'indice' */
async function misDatos(foco) {
  var a = A(); if (!a) return;
  var us = u();
  if (!us || !us.usuario) { a.bot('No pude identificar tu sesión. Recarga la página e intenta de nuevo.'); return; }
  foco = foco || 'todo';
  a.bot('Reviso tus datos, ' + primer(us.nombre || us.usuario) + '… ⏳');
  var res = await Promise.all([
    (foco === 'todo' || foco === 'atenciones') ? stats(us) : Promise.resolve(null),
    (foco !== 'atenciones') ? cumpl(us) : Promise.resolve(null)
  ]);
  var st = res[0], c = res[1], partes = [], botones = [];

  if (foco === 'todo' || foco === 'atenciones') {
    if (st) {
      partes.push('📋 Tus atenciones\n' +
        '• Hoy: ' + (st.hoy || 0) + '   • Este mes: ' + (st.este_mes || 0) + '   • Este año: ' + (st.este_anio || 0) + '\n' +
        '• En proceso: ' + (st.en_proceso || 0) + '   • Finalizadas: ' + (st.finalizados || 0));
      if ((st.en_proceso || 0) > 0) partes.push('💡 Tienes ' + st.en_proceso + ' atención(es) EN PROCESO: revisa si ya puedes finalizarlas.');
    } else if (foco === 'atenciones') {
      partes.push('📋 No pude leer tus atenciones en este momento. Intenta en unos segundos.');
    }
    var nav = document.getElementById('navAt');
    if (nav) botones.push({ t: '➡️ Ir a Mis Atenciones', c: 'go', f: function () { nav.click(); a.bot('Listo, te llevé a Mis Atenciones.'); a.opts([menuBtn()]); } });
  }

  if (foco !== 'atenciones') {
    if (!c) {
      partes.push('✅ No pude leer tu cumplimiento ahora (el servidor está ocupado). Intenta en un minuto o revisa la campana 🔔.');
    } else {
      var acts = c.actividades || [];
      if (c.esAdmin) {
        acts = acts.filter(function (x) {
          var r = norm(x.responsable);
          return r && (r === norm(us.nombre) || r === norm(us.usuario));
        });
      }
      if ((foco === 'todo' || foco === 'indice') && c.indice) {
        var i = c.indice, _sdI = i.porcentaje === null || i.porcentaje === undefined, ic = _sdI ? '⚪' : i.nivel === 'EXCELENTE' ? '🟢' : i.nivel === 'REGULAR' ? '🟡' : '🔴';   /* _IND_FIX_V1 */
        partes.push('📈 Tu índice de cumplimiento (' + (i.mes || 'este mes') + '): ' + ic + ' ' + (_sdI ? 'sin datos aún' : i.porcentaje + '% — ' + i.nivel) + '\n' +
          '• Visitas: ' + (i.visitas_realizadas || 0) + ' de ' + (i.visitas_programadas || 0) + ' realizadas' +
          ((i.visitas_pendientes || 0) ? ' (' + i.visitas_pendientes + ' pendiente/s)' : '') + '\n' +
          '• Casos abiertos: ' + (i.casos_abiertos || 0) + (i.casos_vencidos ? '  · vencidos: ' + i.casos_vencidos : '') +
          (i.documentos_pendientes ? '  · documentos por subir: ' + i.documentos_pendientes : ''));
      }
      if (foco === 'todo' || foco === 'pendientes') {
        var urg = acts.filter(function (x) { return x.estado !== 'EN_PLAZO'; });
        if (!acts.length) {
          partes.push('🎉 No tienes pendientes con plazo. ¡Todo al día!');
        } else {
          var cnt = {}; acts.forEach(function (x) { cnt[x.estado] = (cnt[x.estado] || 0) + 1; });
          var res2 = ['CRITICO', 'VENCIDO', 'VENCE_HOY', 'PROXIMO', 'EN_PLAZO'].filter(function (k) { return cnt[k]; })
                       .map(function (k) { return SEM[k] + ' ' + cnt[k] + ' ' + TXT[k]; }).join('  ·  ');
          var lista = (urg.length ? urg : acts).slice(0, 5).map(function (x) {
            var que = x.tipo === 'VISITA' ? ('Informe de visita' + (x.semana ? ' (sem. ' + x.semana + ')' : '')) : ('Caso N° ' + x.caso + (x.trabajador ? ' · ' + primer(x.trabajador) : '') + ' — ' + (x.accion || x.actividad || ''));
            var cuando = x.dias_retraso > 0 ? (x.dias_retraso + ' día(s) de atraso') : (x.dias_restantes === 0 ? 'vence hoy' : (x.fecha_limite ? 'vence ' + fmt(x.fecha_limite) : ''));
            return SEM[x.estado] + ' ' + que + (cuando ? ' · ' + cuando : '');
          }).join('\n');
          partes.push('🔔 Tus pendientes: ' + res2 + '\n' + lista + (acts.length > 5 && urg.length > 5 ? '\n… y ' + (urg.length - 5) + ' más en la campana 🔔.' : ''));
          (urg.length ? urg : acts).slice(0, 3).forEach(function (x) {
            if (typeof window._cumplIrA !== 'function') return;
            botones.push({ t: '➡️ ' + (x.tipo === 'VISITA' ? 'Registrar visita' : 'Abrir caso N° ' + x.caso), c: 'go',
                           f: function () { window._cumplIrA(x.tipo, x.caso); a.bot('Listo, te llevé ahí para regularizarlo.'); a.opts([menuBtn()]); } });
          });
        }
        if (c.restriccion && c.restriccion.activa) {
          partes.push('⛔ Tienes restricción por cumplimiento' + (c.restriccion.modulos && c.restriccion.modulos.length ? ' en: ' + c.restriccion.modulos.join(', ') : '') +
                      '. Se levanta sola al regularizar lo crítico. Registrar y editar NUNCA se bloquea.');
        }
      }
    }
  }

  a.bot(partes.join('\n\n') || 'No encontré datos para mostrarte.');
  if (foco !== 'todo') botones.push({ t: '📊 Ver todos mis datos', f: function () { misDatos('todo'); } });
  botones.push(menuBtn());
  a.opts(botones);
}

window._rlAsisMisDatos = function () { return misDatos('todo'); };

/* Preguntas libres sobre los propios datos */
window._rlAsisDatosTexto = function (t) {
  var n = norm(t);
  var propio = /\b(mi|mis|mio|mias|tengo|llevo|estoy|debo)\b|cuant|me falta/.test(n);
  if (/\bmis datos\b|\bmi resumen\b|\bcomo voy\b|\bcomo estoy\b/.test(n)) { misDatos('todo'); return true; }
  if (!propio) return false;
  if (/indice|porcentaje|cumplimiento|nota|calificacion/.test(n)) { misDatos('indice'); return true; }
  if (/pendiente|vencid|vence|atras|retras|plazo|restring|restriccion|bloque|campana|visita|caso/.test(n)) { misDatos('pendientes'); return true; }
  if (/atencion|registr|finaliz|proceso|hoy|mes|ano|anio/.test(n)) { misDatos('atenciones'); return true; }
  return false;
};
console.log('[_ASISTENTE_DATOS_V1] listo');
})();
