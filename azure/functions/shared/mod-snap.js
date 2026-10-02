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
    getSupervisores: () => copia(D.getSupervisores),   /* _PRELOAD_AZURE_V1 (01-oct): BD_Supervisores */
    getSolicitudes: (p) => {
      const r = copia(D.getSolicitudes);
      if (r && r.success && p && p.estado) r.data = (r.data || []).filter(s => s.estado === p.estado);
      return r;
    }
  };
}
module.exports = { crear };
