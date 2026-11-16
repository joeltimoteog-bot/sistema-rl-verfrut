/* _MOD_SIMPLES_V1 (26-set-2026) — consultas SIN calculo (Fusiones, Solicitudes de edicion,
   Motivos de casos, Inventario): el Apps Script manda la respuesta completa de su
   funcion y Azure la devuelve igual. Solo getSolicitudes aplica su unico filtro (estado). */
'use strict';
const copia = (o) => JSON.parse(JSON.stringify(o));
function crear(D) {
  return {
    getFusiones: () => copia(D.getFusiones),
    getMotivosCasos: () => copia(D.getMotivosCasos),
    invGetAll: () => copia(D.invGetAll),
    getSupervisores: async () => { const r = copia(D.getSupervisores); if (r && Array.isArray(r.data)) { try { await require('./padron-personas').aplicar(r.data); r.padron = r.data._padron || null; } catch (e) {} } return r; },   /* _PRELOAD_AZURE_V1 (01-oct): BD_Supervisores · _PADRON_MANDA_V1 (16-nov): DNI del Padron */
    getSolicitudes: (p) => {
      const r = copia(D.getSolicitudes);
      if (r && r.success && p && p.estado) r.data = (r.data || []).filter(s => s.estado === p.estado);
      return r;
    }
  };
}
module.exports = { crear };
