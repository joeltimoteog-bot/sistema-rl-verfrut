/* _MOD_AZURE_V1 — ACUMULACION DE HORAS: copia fiel de horasListar,
   horasResumenIndividual, horasResumenGeneral y horasListarMotivos (Apps Script).
   D.registros = TODAS las filas de la hoja 'registros', ya armadas como las arma
   horasListar (DNI a 8 digitos) + _conId (la fila tiene ID) + _estadoCrudo (col U tal cual). */
'use strict';
function normDni(x) { let s = String(x == null ? '' : x).replace(/\D/g, ''); if (!s) return ''; while (s.length < 8) s = '0' + s; return s; }
const r2 = (n) => Math.round(n * 100) / 100;

function crear(D) {
  const C = D.config || {};
  const ADMINS = C.admins || [], REG = C.registradores || [];
  const esAdminEstricto = (u) => ADMINS.indexOf(String(u || '').toLowerCase().trim()) >= 0;
  const esRegistrador = (u) => REG.indexOf(String(u || '').toLowerCase().trim()) >= 0;
  const esRestringido = (u) => esRegistrador(u) && !esAdminEstricto(u);
  const todas = D.registros || [];
  const sinMarca = (r) => { const o = {}; Object.keys(r).forEach(k => { if (k.charAt(0) !== '_') o[k] = r[k]; }); return o; };

  function horasListar(body) {
    const quien = String((body && body.usuario) || '').trim();
    if (!quien) return { success: false, sesionInvalida: true, error: C.msgSesion };
    let regs = todas.filter(r => r._conId).map(sinMarca);
    if (esRestringido(quien)) { const u = quien.toLowerCase(); regs = regs.filter(r => String(r.registradoPor || '').toLowerCase().trim() === u); }
    if (body && body.dni) { const d = normDni(body.dni); regs = regs.filter(r => r.dni === d); }
    if (body && body.estado) regs = regs.filter(r => r.estado === body.estado);
    regs.sort((a, b) => new Date(b.fechaRegistro) - new Date(a.fechaRegistro));
    return { success: true, registros: regs };
  }
  function saldoDni(dni) {
    let acum = 0, perm = 0, deuda = 0;
    todas.forEach(r => {
      if (r.dni !== dni) return;
      if (String(r._estadoCrudo || '').toLowerCase() === 'rechazado') return;
      acum += Number(r.horasAcumuladas) || 0; perm += Number(r.horasPermiso) || 0; deuda += Number(r.horasDeuda) || 0;
    });
    return { acum: r2(acum), perm: r2(perm), deuda: r2(deuda), saldo: r2(acum - perm - deuda) };
  }
  function saldoDeRegistros(regs) {
    let acum = 0, perm = 0, deuda = 0;
    (regs || []).forEach(r => {
      if (String(r.estado || '').toLowerCase() === 'rechazado') return;
      acum += Number(r.horasAcumuladas) || 0; perm += Number(r.horasPermiso) || 0; deuda += Number(r.horasDeuda) || 0;
    });
    return { acum: r2(acum), perm: r2(perm), deuda: r2(deuda), saldo: r2(acum - perm - deuda) };
  }
  function horasResumenIndividual(body) {
    const quien = String((body && body.usuario) || '').trim();
    if (!quien) return { success: false, sesionInvalida: true, error: C.msgSesion };
    const dni = normDni((body && body.dni) || '');
    if (!dni) return { success: false, error: 'DNI requerido' };
    const restringido = esRestringido(quien);
    const lista = horasListar({ dni: dni, usuario: quien });
    if (!lista.success) return lista;
    if (restringido && lista.registros.length === 0) return { success: false, bloqueado: true, dni, registros: [], totales: null, mensaje: C.msgAut, error: C.msgAut };
    const saldo = restringido ? saldoDeRegistros(lista.registros) : saldoDni(dni);
    return { success: true, bloqueado: false, parcial: restringido, dni, registros: lista.registros, totales: saldo,
      comentario: (restringido ? 'TOTALES SOLO DE TUS REGISTROS · ' : '') + (saldo.saldo > 0 ? 'Saldo a favor: ' + saldo.saldo.toFixed(2) + ' horas'
        : (saldo.saldo < 0 ? 'Deuda pendiente: ' + Math.abs(saldo.saldo).toFixed(2) + ' horas' : 'Sin saldo pendiente')) };
  }
  function horasResumenGeneral() {
    const map = {};
    todas.forEach(r => {
      const dni = r.dni; if (!dni) return;
      if (String(r._estadoCrudo || '').toLowerCase() === 'rechazado') return;
      if (!map[dni]) map[dni] = { dni, nombre: r.nombre, empresa: r.empresa, cargo: r.cargo, acum: 0, perm: 0, deuda: 0 };
      map[dni].acum += Number(r.horasAcumuladas) || 0; map[dni].perm += Number(r.horasPermiso) || 0; map[dni].deuda += Number(r.horasDeuda) || 0;
    });
    const resumen = Object.values(map).map(t => Object.assign({}, t, { acum: r2(t.acum), perm: r2(t.perm), deuda: r2(t.deuda), saldo: r2(t.acum - t.perm - t.deuda) }))
      .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
    return { success: true, resumen };
  }
  function horasListarMotivos() { return { success: true, motivos: D.motivos || [] }; }
  return { horasListar, horasResumenIndividual, horasResumenGeneral, horasListarMotivos };
}
module.exports = { crear };
