// ============================================================
// AZURE BLOB STORAGE - MÓDULO DE SUBIDA DIRECTA
// Sistema RL v3.0 | Verfrut / RAPEL SAC
// ============================================================

const AZURE_CONFIG = {
  storageUrl: 'https://sistemarlverfrut.blob.core.windows.net',
  sasTokens: {
    'casos-rl':      'st=2026-04-16T03:12:08Z&si=sistemrl2027&spr=https&sv=2025-11-05&sr=c&sig=HHiVoXQN4a4S0W5qAS04%2Br1tIYt9jSEJprnPwK8LKkk%3D',
    'visitas-campo': 'st=2026-04-16T03:09:16Z&si=sistemrl2027&spr=https&sv=2025-11-05&sr=c&sig=yNpnqGq2zEesLw0y%2BUHRikEJjNJoGqsxrtEoO1NqrkA%3D',
    'documentos':    'st=2026-04-16T03:11:14Z&si=sistemrl2027&spr=https&sv=2025-11-05&sr=c&sig=tudMq%2FDsygMKoQl04XbOYmcNwZoCBEFUJCTgQ6lMEjA%3D'
  },
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
    'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/html'
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
    const sasToken = AZURE_CONFIG.sasTokens[contenedor] || AZURE_CONFIG.sasTokens['documentos'];
    const blobUrl = `${AZURE_CONFIG.storageUrl}/${contenedor}/${nombreUnico}?${sasToken}`;

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
      console.error('[Azure] Error detallado:', {
        status:     response.status,
        statusText: response.statusText,
        url:        blobUrl.split('?')[0], // sin SAS token en el log
        contenedor,
        modulo,
        mimeType,
        errorBody:  errText
      });
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
    // TypeError: Failed to fetch → probable CORS o red
    // Error Azure 4xx/5xx → autenticación SAS, contenedor, permisos
    console.error('[Azure] Error completo:', error);
    console.error('[Azure] Error name:', error.name);
    console.error('[Azure] Error message:', error.message);
    console.error('[Azure] Stack:', error.stack);
    // Intentar fetch de diagnóstico para verificar CORS
    try {
      const testUrl = `${AZURE_CONFIG.storageUrl}/${contenedor}?restype=container&comp=list&${sasToken}`;
      const testResp = await fetch(testUrl, { method: 'GET' });
      console.log('[Azure] Test GET status:', testResp.status);
    } catch(testErr) {
      console.error('[Azure] Test GET también falló:', testErr.message);
    }
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
