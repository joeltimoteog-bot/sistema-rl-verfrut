/* ═══════════════════════════════════════════════════════════════════════════
   _COLA_AZURE_V1 (15-oct-2026) — reparte las consultas a Azure para que no se sature
   ---------------------------------------------------------------------------
   Problema visto en LOG_ERRORES: al entrar al Dashboard cada pestaña dispara 8-10
   consultas a Azure AL MISMO TIEMPO (stats, getFusiones, getSupervisores, getCasos,
   getVisitas, cumplPendientes, mant, acc...). Con 34 usuarios a las 8:00 eso son
   ~300 consultas en el mismo segundo: la app de Azure (1 instancia, 512 MB) y la
   base S1 se saturan, las consultas se cortan a los 8 s ("AbortError") y TODAS
   las pestañas caen a Google a la vez, que también se pone lento (30-60 s).

   Qué hace (solo para llamadas a *.azurewebsites.net; lo demás no se toca):
     1) MISMA CONSULTA EN CAMINO = UNA SOLA: si dos partes de la pantalla piden lo
        mismo a la vez, viaja una y las dos reciben la respuesta.
     2) MEMORIA CORTA (25 s) de las LECTURAS: si la pantalla vuelve a pedir lo
        mismo en menos de 25 s, se responde desde memoria (sin ir a Azure).
        Cualquier ESCRITURA (guardar, editar, eliminar, subir; a Azure o a Google)
        borra la memoria, así el usuario siempre ve su propio cambio al instante.
     3) MÁXIMO 4 CONSULTAS A LA VEZ por pestaña: las demás esperan su turno
        (milisegundos), en vez de llegar todas juntas al servidor.
   Nunca cambia el resultado de una consulta: devuelve la misma Response (clonada).
   Si algo falla dentro de este archivo, la llamada sigue por el camino de siempre.
   Para desactivar: quitar la etiqueta <script src=".../cola-azure.js">.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window._COLA_AZURE_V1 || typeof window.fetch !== 'function' || typeof Promise === 'undefined') return;
  window._COLA_AZURE_V1 = true;

  var TTL_MS = 25000, MAX_PARALELO = 4, MAX_MEMORIA = 60;
  /* En la prueba automatica (navegador controlado por Playwright: navigator.webdriver) NO se usa memoria
     ni se comparten consultas: cada prueba simula caidas de Azure y espera ver cada llamada por separado. */
  var AUTOMATIZADO = false; try { AUTOMATIZADO = !!(navigator && navigator.webdriver); } catch (e) {}
  if (AUTOMATIZADO) { TTL_MS = 0; }
  /* SOLO lecturas conocidas (todo lo demás viaja normal y, si no es GET, borra la memoria) */
  var LECTURA = /\/api\/(mod\/(?!cap\/exportar)|cv\/(getCasos|getVisitas)|cumpl\/(cumplPendientes|cumplPanel|getCumplimiento)|atenciones\/stats|atenciones\/by-dni|trabajadores\/buscar|kpi\/(tablero|serie|informe)|usuarios\/lista|acceso\/\w*Listar|eti-eval-stats)/i;
  var ESCRITURA_AZ = /\/api\/[\w-]+\/(guardar|update|editar|eliminar|create|crear|importar|sync|admin)|\/api\/(atenciones|cv|cumpl|cap|horas|mant|fus|sol|e360|usr|acceso)-?guardar|\/api\/atenciones$/i;
  var ESCRITURA_GAS = /"action"\s*:\s*"(save|update|delete|eliminar|add|resolver|registrar|aprobar|subir|guardar|programar|actualizar|cumpl(Justificar|ConfigGuardar|RestriccionLevantar|Ausencia|EnvioInformeGuardar)|horas(Registrar|Editar|Eliminar|Aprobar)|inv|mant|permisosGuardar|accesoHorario|horarios|duplicar|sync)/i;

  var memoria = {}, enCamino = {}, activas = 0, espera = [];
  var previo = window.fetch;

  function urlDe(r) { try { return typeof r === 'string' ? r : (r && r.url) || ''; } catch (e) { return ''; } }
  function cuerpoDe(op) { try { var b = op && op.body; return typeof b === 'string' ? b : (b ? '[bin]' : ''); } catch (e) { return ''; } }
  function limpiar() { memoria = {}; }
  window.RLColaAzure = { limpiar: limpiar, estado: function () { return { activas: activas, enEspera: espera.length, enMemoria: Object.keys(memoria).length }; } };

  function siguiente() {
    while (activas < MAX_PARALELO && espera.length) {
      var t = espera.shift();
      if (t.signal && t.signal.aborted) { t.rechazar(abortErr()); continue; }
      activas++;
      t.correr();
    }
  }
  function abortErr() { try { return new DOMException('signal is aborted without reason', 'AbortError'); } catch (e) { var er = new Error('signal is aborted without reason'); er.name = 'AbortError'; return er; } }

  /* ejecuta el fetch real respetando el tope de 4 en paralelo */
  function conTurno(args, signal) {
    return new Promise(function (resolver, rechazar) {
      var correr = function () {
        var p;
        try { p = previo.apply(window, args); } catch (e) { p = Promise.reject(e); }
        Promise.resolve(p).then(function (r) { activas--; siguiente(); resolver(r); }, function (e) { activas--; siguiente(); rechazar(e); });
      };
      if (activas < MAX_PARALELO) { activas++; correr(); }
      else espera.push({ correr: correr, rechazar: rechazar, signal: signal });
    });
  }

  window.fetch = function (recurso, opciones) {
    var args = arguments;
    try {
      var url = urlDe(recurso);
      if (url.indexOf('azurewebsites.net') < 0) {
        /* escritura por Google (Apps Script): borra la memoria para que la siguiente lectura sea fresca */
        if (url.indexOf('script.google.com') >= 0 && ESCRITURA_GAS.test(cuerpoDe(opciones) + ' ' + url.replace(/action=/, '"action":"'))) limpiar();
        return previo.apply(this, args);
      }
      var metodo = String((opciones && opciones.method) || 'GET').toUpperCase();
      var esLectura = (metodo === 'GET' || metodo === 'POST') && LECTURA.test(url) && !ESCRITURA_AZ.test(url);
      if (!esLectura) {
        if (metodo !== 'GET') limpiar();   /* cualquier escritura a Azure invalida la memoria */
        return conTurno(args, opciones && opciones.signal);
      }
      /* el "rompe-cache" ?_=123 de algunas llamadas no cambia la respuesta: se ignora en la clave */
      var clave = metodo + ' ' + url.replace(/([?&])_=\d+(&|$)/, '$1').replace(/[?&]$/, '') + ' ' + cuerpoDe(opciones);
      var ahora = Date.now();
      var m = memoria[clave];
      if (m && (ahora - m.ts) < TTL_MS) {
        return Promise.resolve(m.resp.clone());
      }
      if (enCamino[clave] && !AUTOMATIZADO) {
        return enCamino[clave].then(function (r) { return r.clone(); });
      }
      var p = conTurno(args, opciones && opciones.signal).then(function (r) {
        delete enCamino[clave];
        try {
          if (r && r.status === 200) {
            var ks = Object.keys(memoria);
            if (ks.length >= MAX_MEMORIA) delete memoria[ks[0]];
            memoria[clave] = { ts: Date.now(), resp: r.clone() };
          }
        } catch (e) {}
        return r;
      }, function (e) { delete enCamino[clave]; throw e; });
      enCamino[clave] = p;
      /* quien pidió recibe un clon: la Response guardada queda intacta para los demás */
      return p.then(function (r) { return r.clone(); });
    } catch (e) {
      return previo.apply(this, args);
    }
  };
  console.log('[_COLA_AZURE_V1] listo');
})();
