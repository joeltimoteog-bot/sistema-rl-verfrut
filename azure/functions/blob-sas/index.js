// ============================================================
// blob-sas — Genera tokens SAS de corta duración para subida
// Sistema RL v3.0 | Verfrut / RAPEL SAC
//
// Reemplaza los tokens SAS hardcodeados en azure-blob-upload.js.
// GET /api/blob-sas?contenedor=casos-rl
//   Header: Authorization: Bearer <jwt>
//   → { success, sasToken, expiraEn }
//
// Variables de entorno requeridas:
//   STORAGE_ACCOUNT_NAME : sistemarlverfrut
//   STORAGE_ACCOUNT_KEY  : clave de la cuenta (Portal → Access keys)
// ============================================================
const { exigirAuth } = require('../shared/auth');
const {
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  ContainerSASPermissions
} = require('@azure/storage-blob');

const CONTENEDORES_PERMITIDOS = ['casos-rl', 'visitas-campo', 'documentos'];
const SAS_MINUTOS = 15;

module.exports = async function (context, req) {
  const authUser = exigirAuth(context, req);
  if (authUser === null) return;

  try {
    const contenedor = String(req.query.contenedor || '').trim();
    if (!CONTENEDORES_PERMITIDOS.includes(contenedor)) {
      context.res = { status: 400, body: { success: false, error: 'Contenedor no permitido' } };
      return;
    }

    const account = process.env.STORAGE_ACCOUNT_NAME;
    const key = process.env.STORAGE_ACCOUNT_KEY;
    if (!account || !key) {
      context.res = { status: 500, body: { success: false, error: 'STORAGE_ACCOUNT_NAME/KEY no configurados' } };
      return;
    }

    const cred = new StorageSharedKeyCredential(account, key);
    const ahora = new Date();
    const expira = new Date(ahora.getTime() + SAS_MINUTOS * 60 * 1000);

    const sas = generateBlobSASQueryParameters({
      containerName: contenedor,
      permissions: ContainerSASPermissions.parse('cw'), // solo crear/escribir
      startsOn: new Date(ahora.getTime() - 5 * 60 * 1000), // -5 min por clock skew
      expiresOn: expira,
      protocol: 'https'
    }, cred).toString();

    context.res = {
      status: 200,
      body: { success: true, sasToken: sas, expiraEn: expira.toISOString() }
    };
  } catch (e) {
    context.log.error('blob-sas error:', e.message);
    context.res = { status: 500, body: { success: false, error: 'Error interno: ' + e.message } };
  }
};
