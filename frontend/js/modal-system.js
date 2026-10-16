/* ===================================================================
   SISTEMA DE MODALES PERSONALIZADOS - Sistema RR.LL. Unifrutti
   _MODAL_SYSTEM_V1 (07-jun-2026) — Joel Timoteo Gonza · _MODAL_SYSTEM_V2 (15-oct-2026): nueva presentacion, misma API

   REEMPLAZA: alert(), confirm(), prompt() nativos del navegador
   (que muestran "joeltimoteog-bot.github.io dice")

   USO:
     await appAlert("Mensaje")           // reemplaza alert()
     await appConfirm("¿Confirmas?")     // reemplaza confirm() — devuelve true/false
     await appPrompt("Ingresa DNI:")     // reemplaza prompt() — devuelve string o null

   IMPORTANTE: las funciones DEVUELVEN PROMESAS. Las funciones que
   las llamen deben ser async y usar await.

   COMPATIBILIDAD: este script intencionalmente NO sobrescribe los
   window.alert/confirm/prompt nativos para no romper código legacy.
   ====================================================================*/

(function() {
  'use strict';

  // Idempotencia: si ya está cargado, no hacer nada
  if (window.appAlert && window._MODAL_SYSTEM_LOADED) return;
  window._MODAL_SYSTEM_LOADED = true;

  // ─── _MODAL_SYSTEM_V2 (15-oct-2026) — nueva presentacion, misma API ─────
  //   · Tarjeta centrada con franja e icono de color segun el tipo (exito, error,
  //     alerta, informacion, pregunta); el titulo sale de la primera linea del
  //     mensaje y las lineas "Clave: valor" se muestran como tabla.
  //   · appAlert / appConfirm / appPrompt, las teclas (Enter/Esc), los botones
  //     [data-action="ok|cancel"] y el #appmsys-input siguen IGUAL que en la V1.
  const CSS = `
    .appmsys-overlay{position:fixed;inset:0;background:rgba(5,12,30,.62);
      backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);z-index:99999;display:flex;align-items:center;
      justify-content:center;padding:16px;opacity:0;transition:opacity .18s;
      font-family:Barlow,-apple-system,'Segoe UI',Roboto,sans-serif}
    .appmsys-overlay.appmsys-on{opacity:1}
    .appmsys-box{--a:#1d4ed8;--b:#2563eb;--bg:#dbeafe;--halo:rgba(37,99,235,.18);
      background:#fff;border-radius:20px;box-shadow:0 30px 80px rgba(0,0,0,.45),0 0 0 1px rgba(255,255,255,.08);
      max-width:430px;width:100%;overflow:hidden;transform:translateY(14px) scale(.96);
      transition:transform .28s cubic-bezier(.2,.9,.3,1.2)}
    .appmsys-overlay.appmsys-on .appmsys-box{transform:none}
    .appmsys-box.ok{--a:#16a34a;--b:#22c55e;--bg:#dcfce7;--halo:rgba(34,197,94,.18)}
    .appmsys-box.err{--a:#dc2626;--b:#ef4444;--bg:#fee2e2;--halo:rgba(239,68,68,.18)}
    .appmsys-box.warn{--a:#d97706;--b:#f59e0b;--bg:#fef3c7;--halo:rgba(245,158,11,.2)}
    .appmsys-box.ask{--a:#0a2463;--b:#1e3a8a;--bg:#e0e7ff;--halo:rgba(30,58,138,.18)}
    .appmsys-top{height:6px;background:linear-gradient(90deg,var(--a),var(--b))}
    .appmsys-ic{width:64px;height:64px;border-radius:50%;margin:22px auto 10px;display:flex;align-items:center;
      justify-content:center;font-size:30px;font-weight:800;background:var(--bg);color:var(--a);box-shadow:0 0 0 10px var(--halo);line-height:1}
    .appmsys-tt{text-align:center;font-size:19px;font-weight:800;color:#0f172a;padding:0 24px;line-height:1.3;word-break:break-word}
    .appmsys-ms{text-align:center;font-size:13.5px;color:#475569;padding:8px 26px 0;line-height:1.55;white-space:pre-wrap;word-break:break-word}
    .appmsys-ms:empty{display:none}
    .appmsys-det{margin:14px 24px 0;background:#f6f8fc;border:1px solid #e6ebf4;border-radius:12px;overflow:hidden}
    .appmsys-det div{display:flex;justify-content:space-between;gap:12px;padding:9px 14px;font-size:13px;border-bottom:1px solid #e6ebf4;text-align:left}
    .appmsys-det div:last-child{border:0}
    .appmsys-det span{color:#64748b}.appmsys-det b{color:#0f172a;font-variant-numeric:tabular-nums;text-align:right}
    .appmsys-body{padding:0}
    .appmsys-msg{display:contents}
    .appmsys-input{display:block;width:calc(100% - 48px);margin:14px 24px 0;box-sizing:border-box;padding:12px 14px;
      border:2px solid #dbe3f0;border-radius:12px;font-size:16px;font-family:inherit;text-align:center;outline:none;transition:border-color .15s}
    .appmsys-input:focus{border-color:var(--a);box-shadow:0 0 0 4px var(--halo)}
    .appmsys-actions{display:flex;gap:10px;padding:20px 24px 14px;background:#fff;border:0}
    .appmsys-btn{flex:1;border:none;border-radius:12px;padding:12px 14px;font-weight:800;font-size:14px;cursor:pointer;
      font-family:inherit;transition:transform .12s,box-shadow .12s;min-width:0}
    .appmsys-btn-primary,.appmsys-btn-danger{background:linear-gradient(90deg,var(--a),var(--b));color:#fff;box-shadow:0 8px 18px var(--halo)}
    .appmsys-btn-primary:hover,.appmsys-btn-danger:hover{transform:translateY(-2px)}
    .appmsys-btn-gray{background:#f1f5f9;color:#334155}
    .appmsys-btn-gray:hover{background:#e2e8f0}
    .appmsys-btn:focus-visible{outline:3px solid var(--halo)}
    .appmsys-ft{text-align:center;font-size:10.5px;color:#94a3b8;padding:0 0 14px;letter-spacing:.5px;font-weight:700;text-transform:uppercase}
    .appmsys-ft b{display:inline-flex;width:16px;height:16px;border-radius:50%;background:#0a2463;color:#fff;font-size:8px;
      align-items:center;justify-content:center;margin-right:5px;vertical-align:-3px}
    @keyframes appmsysShake{0%,100%{transform:translateX(0)} 25%{transform:translateX(-6px)} 75%{transform:translateX(6px)}}
    .appmsys-shake{animation:appmsysShake .3s}
    @media(max-width:480px){.appmsys-box{max-width:100%}.appmsys-actions{flex-direction:column-reverse}}
  `;
  const styleEl = document.createElement('style');
  styleEl.id = 'appmsys-styles';
  styleEl.textContent = CSS;
  document.head.appendChild(styleEl);


  // ─── HELPER: ESCAPAR HTML ────────────────────────────────────────
  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ─── HELPER: TIPO DE MENSAJE (color + icono) ─────────────────────
  //   Misma deteccion por contenido que la V1 (_detectarIcono), ahora devuelve tambien la clase.
  function _tipoDe(msg, tipo) {
    const s = String(msg || '').toLowerCase();
    if (s.includes('error') || s.includes('fallo') || s.includes('❌') || s.includes('no se pudo') || s.includes('incorrect') || s.includes('inválid') || s.includes('invalid')) return { c: 'err', i: '!' };
    if (s.includes('eliminar') || s.includes('rechazar') || s.includes('borrar') || s.includes('⚠')) return { c: 'warn', i: '⚠' };
    if (s.includes('exitoso') || s.includes('correctamente') || s.includes('✅') || s.includes('guardad') || s.includes('registrad') || s.includes('vigente')) return { c: 'ok', i: '✓' };
    if (s.includes('expirad') || s.includes('caducad') || s.includes('fuera de horario') || s.includes('⏰')) return { c: 'warn', i: '⏰' };
    if (tipo === 'prompt' || s.includes('dni') || s.includes('ingresa') || s.includes('escribe')) return { c: 'ask', i: '✎' };
    if (tipo === 'confirm') return { c: 'ask', i: '?' };
    return { c: 'info', i: 'i' };
  }
  function _detectarIcono(msg) { return _tipoDe(msg).i; }   // compatibilidad

  // ─── HELPER: titulo / texto / tabla a partir del mensaje de siempre ─
  //   1ra linea = titulo (sin el emoji inicial); "Clave: valor" = fila de tabla; el resto = texto.
  const TIT = { alert: 'Aviso', confirm: '¿Confirmas?', prompt: 'Ingresa un dato' };
  function _partes(mensaje, tipo) {
    const lineas = String(mensaje == null ? '' : mensaje).split(/\r?\n/).map(l => l.trim());
    let titulo = '', texto = [], filas = [];
    const sinEmoji = l => l.replace(/^[^\wÁÉÍÓÚÑáéíóúñ¿¡"'(\[]+/, '').trim();
    const primera = lineas.find(l => l);
    if (primera && sinEmoji(primera).length <= 80 && !/^[^:]{2,40}:\s*\S/.test(sinEmoji(primera))) {
      titulo = sinEmoji(primera);
      lineas.splice(lineas.indexOf(primera), 1);
    }
    const ENCAB = /^(error|aviso|atenci[oó]n|nota|ojo|importante|alerta|listo|éxito|exito)$/i;
    lineas.forEach(l => {
      if (!l) return;
      const m = l.match(/^([^:]{2,40}):\s*(.+)$/);
      if (m && !titulo && ENCAB.test(sinEmoji(m[1]))) { titulo = sinEmoji(m[1]); texto.push(m[2].trim()); return; }   // "Error: ..." -> titulo Error
      if (m && !/https?$/i.test(m[1]) && m[2].trim().length <= 60) filas.push([sinEmoji(m[1]) || m[1].trim(), m[2].trim()]); else texto.push(l);
    });
    if (!titulo) titulo = TIT[tipo] || 'Aviso';
    if (titulo.length > 1) titulo = titulo.charAt(0).toUpperCase() + titulo.slice(1);
    titulo = titulo.replace(/[.:]+$/, '');
    return { titulo, texto: texto.join('\n'), filas };
  }


  // ─── CORE: CREAR MODAL ───────────────────────────────────────────
  function _crearModal(opts) {
    const overlay = document.createElement('div');
    overlay.className = 'appmsys-overlay';

    const marca = opts.titulo || 'Sistema RR.LL. · Unifrutti';
    const esDanger = opts.tipo === 'confirm' && /elimin|borrar|rechaz|cancel/i.test(opts.mensaje || '');
    const t = esDanger ? { c: 'warn', i: '⚠' } : _tipoDe(opts.mensaje, opts.tipo);
    const icono = opts.icono || t.i;
    const p = _partes(opts.mensaje, opts.tipo);
    const inputHTML = opts.tipo === 'prompt'
      ? `<input type="text" class="appmsys-input" id="appmsys-input"
              value="${_esc(opts.valorDefault || '')}"
              placeholder="${_esc(opts.placeholder || '')}" autocomplete="off">`
      : '';

    let botonesHTML = '';
    if (opts.tipo === 'alert') {
      botonesHTML = `<button class="appmsys-btn appmsys-btn-primary" data-action="ok">${t.c === 'err' ? 'Entendido' : 'Aceptar'}</button>`;
    } else if (opts.tipo === 'confirm') {
      botonesHTML = `
        <button class="appmsys-btn appmsys-btn-gray" data-action="cancel">Cancelar</button>
        <button class="appmsys-btn ${esDanger ? 'appmsys-btn-danger' : 'appmsys-btn-primary'}" data-action="ok">${esDanger ? 'Sí, continuar' : 'Aceptar'}</button>
      `;
    } else if (opts.tipo === 'prompt') {
      botonesHTML = `
        <button class="appmsys-btn appmsys-btn-gray" data-action="cancel">Cancelar</button>
        <button class="appmsys-btn appmsys-btn-primary" data-action="ok">Aceptar</button>
      `;
    }

    overlay.innerHTML = `
      <div class="appmsys-box ${t.c}" role="dialog" aria-modal="true" aria-label="${_esc(p.titulo)}">
        <div class="appmsys-top"></div>
        <div class="appmsys-ic" aria-hidden="true">${_esc(icono)}</div>
        <div class="appmsys-tt">${_esc(p.titulo)}</div>
        <div class="appmsys-body">
          <div class="appmsys-msg">
            <div class="appmsys-ms">${_esc(p.texto)}</div>
            ${p.filas.length ? '<div class="appmsys-det">' + p.filas.map(f => '<div><span>' + _esc(f[0]) + '</span><b>' + _esc(f[1]) + '</b></div>').join('') + '</div>' : ''}
          </div>
          ${inputHTML}
        </div>
        <div class="appmsys-actions">
          ${botonesHTML}
        </div>
        <div class="appmsys-ft"><b>RL</b>${_esc(marca)}</div>
      </div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('appmsys-on'));

    return new Promise(resolve => {
      const box = overlay.querySelector('.appmsys-box');
      const input = overlay.querySelector('#appmsys-input');
      const focusInicial = input || overlay.querySelector('[data-action="ok"]');
      setTimeout(() => focusInicial && focusInicial.focus(), 80);
      if (input) input.select();

      const cerrar = (valor) => {
        overlay.classList.remove('appmsys-on');
        setTimeout(() => {
          overlay.remove();
          document.removeEventListener('keydown', onKey);
          resolve(valor);
        }, 150);
      };

      const onKey = (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          cerrar(opts.tipo === 'confirm' ? false : null);
        } else if (e.key === 'Enter') {
          if (opts.tipo === 'prompt' && document.activeElement === input) {
            e.preventDefault();
            cerrar(input.value);
          } else if (opts.tipo === 'alert') {
            e.preventDefault();
            cerrar(true);
          }
        }
      };
      document.addEventListener('keydown', onKey);

      overlay.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', () => {
          const action = btn.dataset.action;
          if (action === 'cancel') {
            cerrar(opts.tipo === 'confirm' ? false : null);
          } else if (action === 'ok') {
            if (opts.tipo === 'prompt') cerrar(input ? input.value : '');
            else cerrar(true);
          }
        });
      });
      // NO cerrar al click fuera (igual que los modales del sistema)
    });
  }


  // ─── API PÚBLICA ─────────────────────────────────────────────────

  /**
   * Muestra un mensaje informativo. Reemplaza alert().
   * @param {string} mensaje
   * @returns {Promise<true>}
   */
  window.appAlert = function(mensaje) {
    return _crearModal({ tipo: 'alert', mensaje: mensaje });
  };

  /**
   * Pide confirmación. Reemplaza confirm().
   * @param {string} mensaje
   * @returns {Promise<boolean>}
   */
  window.appConfirm = function(mensaje) {
    return _crearModal({ tipo: 'confirm', mensaje: mensaje });
  };

  /**
   * Pide texto al usuario. Reemplaza prompt().
   * @param {string} mensaje
   * @param {string} [valorDefault='']
   * @returns {Promise<string|null>} string si Aceptar, null si Cancelar
   */
  window.appPrompt = function(mensaje, valorDefault) {
    return _crearModal({
      tipo: 'prompt',
      mensaje: mensaje,
      valorDefault: valorDefault || ''
    });
  };

  console.log('✅ Sistema de modales Unifrutti cargado (appAlert, appConfirm, appPrompt)');
})();
