// ============================================================
// AZURE BLOB STORAGE - MÓDULO DE SUBIDA DIRECTA
// Sistema RL v3.0 | Verfrut / RAPEL SAC
// ============================================================

const AZURE_CONFIG = {
  storageUrl: 'https://sistemarlverfrut.blob.core.windows.net',
  // Endpoint que emite tokens SAS de corta duración (Function blob-sas)
  sasEndpoint: 'https://rl-functions-verfrut-c0ctfjc0cjf5f0hz.brazilsouth-01.azurewebsites.net/api/blob-sas',
  // ⚠️ FALLBACK LEGADO: eliminar estos tokens y revocar la política
  // "sistemrl2027" en Azure Portal cuando la Function blob-sas esté deployada.
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

// Caché de tokens SAS pedidos al backend (se renuevan solos al expirar)
const _sasCache = {}; // { contenedor: { token, expira } }

async function _obtenerSAS(contenedor) {
  // 1. Caché vigente (margen de 60s)
  const c = _sasCache[contenedor];
  if (c && (c.expira - Date.now()) > 60000) return c.token;

  // 2. Pedir token corto a la Function blob-sas
  try {
    const jwt = sessionStorage.getItem('rl_token') || '';
    const r = await fetch(AZURE_CONFIG.sasEndpoint + '?contenedor=' + encodeURIComponent(contenedor), {
      headers: jwt ? { 'Authorization': 'Bearer ' + jwt } : {}
    });
    if (r.ok) {
      const d = await r.json();
      if (d.success && d.sasToken) {
        _sasCache[contenedor] = { token: d.sasToken, expira: new Date(d.expiraEn).getTime() };
        return d.sasToken;
      }
    }
    console.warn('[Azure-SAS] Function blob-sas no disponible (status ' + r.status + '), usando fallback');
  } catch (e) {
    console.warn('[Azure-SAS] Error pidiendo SAS, usando fallback:', e.message);
  }

  // 3. Fallback legado (eliminar cuando blob-sas esté deployada)
  return AZURE_CONFIG.sasTokens[contenedor] || AZURE_CONFIG.sasTokens['documentos'];
}

async function subirArchivoAzure(fileInput, modulo, msgElId, meta = {}) {
  console.log('[Azure-DEBUG] Entrada:', {fileInput, modulo, msgElId, meta});

  // Verificar si fileInput es un File directamente o un input
  let file;
  if (fileInput instanceof File) {
    file = fileInput;
    console.log('[Azure-DEBUG] Es File directo');
  } else if (fileInput?.files?.[0]) {
    file = fileInput.files[0];
    console.log('[Azure-DEBUG] Es input element');
  } else {
    console.error('[Azure-DEBUG] fileInput inválido:', fileInput);
    return null;
  }

  console.log('[Azure-DEBUG] File:', file.name, file.size, file.type);

  const contenedor  = AZURE_CONFIG.contenedores[modulo] || AZURE_CONFIG.contenedores.default;
  const sasToken    = await _obtenerSAS(contenedor);
  const nombreUnico = `${modulo}/${Date.now()}_${file.name}`;
  const blobUrl     = `${AZURE_CONFIG.storageUrl}/${contenedor}/${nombreUnico}?${sasToken}`;

  console.log('[Azure-DEBUG] URL (sin token):', blobUrl.split('?')[0]);
  console.log('[Azure-DEBUG] Contenedor:', contenedor);
  console.log('[Azure-DEBUG] SAS existe:', !!sasToken);

  try {
    console.log('[Azure-DEBUG] Iniciando fetch PUT...');
    const response = await fetch(blobUrl, {
      method: 'PUT',
      headers: {
        'x-ms-blob-type': 'BlockBlob',
        'Content-Type':   file.type || 'text/html'
      },
      body: file
    });

    console.log('[Azure-DEBUG] Response status:', response.status);
    console.log('[Azure-DEBUG] Response ok:', response.ok);

    if (!response.ok) {
      const txt = await response.text();
      console.error('[Azure-DEBUG] Error body:', txt);
      return null;
    }

    const urlPublica = `${AZURE_CONFIG.storageUrl}/${contenedor}/${nombreUnico}`;
    console.log('[Azure-DEBUG] Subida exitosa:', urlPublica);
    return {
      nombre:     file.name,
      url:        urlPublica,
      tipo:       file.type,
      tamaño:     file.size,
      contenedor: contenedor,
      modulo:     modulo,
      fecha:      new Date().toISOString(),
      usuario:    meta.usuario || '',
      empresa:    meta.empresa || ''
    };

  } catch(err) {
    console.error('[Azure-DEBUG] Catch error:', err.name, err.message);
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
