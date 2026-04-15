// ============================================================
// AZURE BLOB STORAGE — Subida directa de archivos
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
  tiposPermitidos: [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
};

/**
 * Sube un archivo directamente a Azure Blob Storage via PUT.
 * @param {HTMLInputElement|File} fileInput - input[type=file] o File directamente
 * @param {string} modulo  - 'casos' | 'visitas' | 'fusiones' | 'documentos'
 * @param {string|null} msgElId - ID del elemento donde mostrar estado (puede ser null)
 * @param {Object} meta    - { usuario, empresa }
 * @returns {Promise<{nombre,enlace,url,tipo,tamaño,contenedor}|null>}
 */
async function subirArchivoAzure(fileInput, modulo, msgElId, meta) {
  const file = (fileInput && fileInput.files) ? fileInput.files[0] : fileInput;
  if (!file) return null;
  const msgEl = msgElId ? document.getElementById(msgElId) : null;

  // Validar tipo
  const mimeType = file.type || _detectarMime(file.name);
  if (!AZURE_CONFIG.tiposPermitidos.includes(mimeType)) {
    if (msgEl) { msgEl.textContent = '❌ Tipo de archivo no permitido'; msgEl.style.color = '#dc2626'; }
    mostrarToast('❌ Tipo de archivo no permitido: ' + (file.name || ''), 'error');
    return null;
  }

  // Validar tamaño
  if (file.size > AZURE_CONFIG.maxSizeMB * 1024 * 1024) {
    if (msgEl) { msgEl.textContent = '❌ Máx ' + AZURE_CONFIG.maxSizeMB + 'MB'; msgEl.style.color = '#dc2626'; }
    mostrarToast('❌ Archivo supera los ' + AZURE_CONFIG.maxSizeMB + 'MB permitidos', 'error');
    return null;
  }

  const usuario   = (meta && meta.usuario) ? meta.usuario
                  : (typeof USER !== 'undefined' ? USER.usuario || 'user' : 'user');
  const nombreBlob = _generarNombreUnico(file.name, modulo, usuario);
  const contenedor = AZURE_CONFIG.contenedores[modulo] || AZURE_CONFIG.contenedores.default;
  const uploadUrl  = AZURE_CONFIG.storageUrl + '/' + contenedor + '/' + nombreBlob
                   + '?' + AZURE_CONFIG.sasToken;

  if (msgEl) { msgEl.textContent = '⏳ Subiendo ' + file.name + '...'; msgEl.style.color = '#64748b'; }

  try {
    const resp = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'x-ms-blob-type': 'BlockBlob',
        'Content-Type':   mimeType
      },
      body: file
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => String(resp.status));
      if (msgEl) { msgEl.textContent = '❌ Error al subir (' + resp.status + ')'; msgEl.style.color = '#dc2626'; }
      console.error('[subirArchivoAzure]', resp.status, errText);
      return null;
    }

    const urlFinal = AZURE_CONFIG.storageUrl + '/' + contenedor + '/' + nombreBlob;
    if (msgEl) { msgEl.textContent = '✅ ' + file.name; msgEl.style.color = '#16a34a'; }

    return {
      nombre:     nombreBlob,
      enlace:     urlFinal,
      url:        urlFinal,
      tipo:       mimeType,
      tamaño:     file.size,
      contenedor
    };
  } catch (err) {
    if (msgEl) { msgEl.textContent = '❌ ' + err.message; msgEl.style.color = '#dc2626'; }
    console.error('[subirArchivoAzure]', err);
    return null;
  }
}

/**
 * Registra los metadatos del archivo subido en la hoja Archivos_Azure de Sheets.
 * @param {Object} datosArchivo   - { nombre, url|enlace, tipo, tamaño, contenedor }
 * @param {Object} datosFormulario - { casoId?, visitaId?, modulo, empresa?, usuario? }
 */
async function registrarArchivoEnSheets(datosArchivo, datosFormulario) {
  const usuario = (datosFormulario && datosFormulario.usuario)
    ? datosFormulario.usuario
    : (typeof USER !== 'undefined' ? USER.usuario || '' : '');
  return apiPost({
    action:        'registrarArchivoAzure',
    urlArchivo:    datosArchivo.url    || datosArchivo.enlace || '',
    nombreArchivo: datosArchivo.nombre || '',
    tipoArchivo:   datosArchivo.tipo   || '',
    tamanoArchivo: datosArchivo.tamaño || 0,
    contenedor:    datosArchivo.contenedor || '',
    modulo:        (datosFormulario && datosFormulario.modulo)   || '',
    casoId:        (datosFormulario && datosFormulario.casoId)   || '',
    visitaId:      (datosFormulario && datosFormulario.visitaId) || '',
    empresa:       (datosFormulario && datosFormulario.empresa)  || '',
    usuario
  });
}

/**
 * Genera un nombre único para el blob: modulo/usuario_timestamp_nombreBase.ext
 */
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

/**
 * Detecta el MIME type por extensión cuando file.type está vacío.
 */
function _detectarMime(nombreArchivo) {
  const ext = (nombreArchivo || '').split('.').pop().toLowerCase();
  const mimeMap = {
    jpg:  'image/jpeg',
    jpeg: 'image/jpeg',
    png:  'image/png',
    gif:  'image/gif',
    webp: 'image/webp',
    pdf:  'application/pdf',
    doc:  'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls:  'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  };
  return mimeMap[ext] || 'application/octet-stream';
}
