// ============================================================
// AZURE BLOB STORAGE - MÓDULO DE SUBIDA DIRECTA
// Sistema RL v3.0 | Verfrut / RAPEL SAC
// ============================================================

const AZURE_CONFIG = {
  storageUrl: 'https://sistemarlverfrut.blob.core.windows.net',
  sasToken: 'sp=racw&st=2026-04-15T13:41:47Z&se=2027-12-31T21:56:47Z&spr=https&sv=2025-11-05&sr=c&sig=7SyGQHquBgaXPNmMON40BqLgaxDxxvXtfzYgMEAvmAE%3D',
  contenedores: {
    casos:      'casos-rl',
    visitas:    'visitas-campo',
    documentos: 'documentos',
    fusiones:   'casos-rl',
    default:    'documentos'
  },
  maxSizeMB: 20,
  tiposPermitidos: ['image/jpeg','image/png','image/gif','image/webp',
    'application/pdf',
    'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
};

async function subirArchivoAzure(fileInput, modulo, msgElId, meta = {}) {
  const file = fileInput?.files?.[0];
  if (!file) return null;

  const msgEl = msgElId ? document.getElementById(msgElId) : null;
  const setMsg = (txt, color = '#6b7280') => {
    if (msgEl) { msgEl.textContent = txt; msgEl.style.color = color; }
  };

  const sizeMB = file.size / (1024 * 1024);
  if (sizeMB > AZURE_CONFIG.maxSizeMB) {
    setMsg(`❌ Archivo muy grande (${sizeMB.toFixed(1)} MB). Máximo ${AZURE_CONFIG.maxSizeMB} MB.`, '#dc2626');
    return null;
  }

  const mimeType = file.type || _detectarMime(file.name);
  if (AZURE_CONFIG.tiposPermitidos.length > 0 && !AZURE_CONFIG.tiposPermitidos.includes(mimeType)) {
    setMsg(`❌ Tipo de archivo no permitido: ${mimeType}`, '#dc2626');
    return null;
  }

  const contenedor  = AZURE_CONFIG.contenedores[modulo] || AZURE_CONFIG.contenedores.default;
  const nombreUnico = _generarNombreUnico(file.name, modulo, meta.usuario);

  setMsg(`⏳ Subiendo ${file.name}...`, '#f59e0b');

  try {
    const blobUrl = `${AZURE_CONFIG.storageUrl}/${contenedor}/${nombreUnico}?${AZURE_CONFIG.sasToken}`;

    const response = await fetch(blobUrl, {
      method: 'PUT',
      headers: {
        'x-ms-blob-type':     'BlockBlob',
        'Content-Type':       mimeType,
        'x-ms-meta-sistema':  'sistema-rl-v3',
        'x-ms-meta-modulo':   modulo,
        'x-ms-meta-usuario':  meta.usuario || 'desconocido',
        'x-ms-meta-empresa':  meta.empresa || 'verfrut',
        'x-ms-meta-original': encodeURIComponent(file.name)
      },
      body: file
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => response.statusText);
      throw new Error(`Azure ${response.status}: ${errText}`);
    }

    const urlPublica = `${AZURE_CONFIG.storageUrl}/${contenedor}/${nombreUnico}`;
    const resultado  = {
      nombre:     file.name,
      nombreBlob: nombreUnico,
      url:        urlPublica,
      tipo:       mimeType,
      tamaño:     file.size,
      tamañoMB:   sizeMB.toFixed(2),
      contenedor: contenedor,
      modulo:     modulo,
      fecha:      new Date().toISOString(),
      usuario:    meta.usuario || '',
      empresa:    meta.empresa || ''
    };

    setMsg(`✅ ${file.name} subido correctamente`, '#16a34a');
    console.log('[Azure] Subida exitosa:', resultado);
    return resultado;

  } catch (error) {
    console.error('[Azure] Error:', error);
    setMsg(`❌ Error: ${error.message}`, '#dc2626');
    return null;
  }
}

async function registrarArchivoEnSheets(datosArchivo, datosFormulario = {}) {
  if (!datosArchivo) return { success: false, error: 'Sin datos de archivo' };
  const payload = {
    action:        'registrarArchivoAzure',
    urlArchivo:    datosArchivo.url,
    nombreArchivo: datosArchivo.nombre,
    tipoArchivo:   datosArchivo.tipo,
    tamanoArchivo: datosArchivo.tamaño,
    contenedor:    datosArchivo.contenedor,
    modulo:        datosArchivo.modulo,
    fechaSubida:   datosArchivo.fecha,
    ...datosFormulario
  };
  try {
    return await apiPost(payload);
  } catch (error) {
    console.error('[Sheets] Error al registrar:', error);
    return { success: false, error: error.message };
  }
}

function _generarNombreUnico(nombreOriginal, modulo, usuario) {
  const ts   = Date.now();
  const ext  = (nombreOriginal || 'archivo').split('.').pop().toLowerCase();
  const base = (nombreOriginal || 'archivo')
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 40);
  const usr = (usuario || 'user').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 20);
  return modulo + '/' + usr + '_' + ts + '_' + base + '.' + ext;
}

function _detectarMime(nombreArchivo) {
  const ext   = (nombreArchivo || '').split('.').pop().toLowerCase();
  const mimes = {
    'jpg':'image/jpeg','jpeg':'image/jpeg','png':'image/png',
    'gif':'image/gif','webp':'image/webp','pdf':'application/pdf',
    'doc':'application/msword','docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls':'application/vnd.ms-excel',
    'xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  };
  return mimes[ext] || 'application/octet-stream';
}
