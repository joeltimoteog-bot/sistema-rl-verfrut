/* ═══════════════════════════════════════════════════════════════════════════
   _HORAS_AZURE_PRIMERO_V1 (27-set-2026) — ACUMULACION DE HORAS: los guardados en Azure
   ---------------------------------------------------------------------------
   Copia fiel (verificada con simulador contra el codigo original de Google) de:
     horasRegistrarV3 → horasRegistrar (+ compensacion automatica), devoluciones con
     tope diario (hv3ValidarDevolucion_ / hv3AnotarPagadas_), descuentos
     (hv3ArreglarDescuento_), jornada por horario vigente (horariosLeer_, hjVigente_,
     horasCalcularJornadaUnDia/Total), tardanza, horasEditar, horasEliminar,
     horasAprobar, horasAgregarMotivo, horasEliminarMotivo.
   Trabaja sobre las celdas de las tablas (como las da Google: fechas {$d,$s}) y
   devuelve lo que hay que escribir (filas nuevas, cambios de celdas, bitacora),
   con los mismos valores que escribia el Apps Script. El calendario es el de Lima.
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
const esD = v => !!(v && typeof v === 'object' && typeof v.$d === 'string');
const S = v => esD(v) ? v.$s : String(v);                                  /* String(celda) en Google */
const N = v => esD(v) ? (v.$d ? new Date(v.$d).getTime() : NaN) : Number(v);  /* Number(celda) en Google */
const r2 = n => Math.round(n * 100) / 100;
const DIA = 86400000;
const MESES = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
/* partes locales (Lima) de una celda fecha, leidas del texto que da Google */
function partes(v) {
  const m = String(v.$s || '').match(/^\w{3} (\w{3}) (\d{2}) (-?\d{4,}) (\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  return { y: +m[3], mo: MESES[m[1]], d: +m[2], hh: +m[4], mi: +m[5] };
}
function limaDe(t) { const x = new Date(t - 5 * 3600e3); return { y: x.getUTCFullYear(), mo: x.getUTCMonth() + 1, d: x.getUTCDate(), dow: x.getUTCDay() }; }
const iso = (y, mo, d) => y + '-' + (mo < 10 ? '0' : '') + mo + '-' + (d < 10 ? '0' : '') + d;

function norm(s) {   /* hv3Norm_ */
  return String(s || '').toLowerCase().replace(/[áàâä]/g, 'a').replace(/[éèêë]/g, 'e').replace(/[íìîï]/g, 'i').replace(/[óòôö]/g, 'o').replace(/[úùûü]/g, 'u').trim();
}
function normDni(x) { let s = String(x == null ? '' : (esD(x) ? x.$s : x)).replace(/\D/g, ''); if (!s) return ''; while (s.length < 8) s = '0' + s; return s; }
function esDevolucion(m) { const t = norm(esD(m) ? m.$s : m); if (!t) return false; if (t.indexOf('pagadas') >= 0) return false; return t.indexOf('devolucion') >= 0; }
function esDescuento(m) { const t = norm(m); if (!t) return false; if (t.indexOf('pagadas') >= 0) return false; if (t.indexOf('devolucion') >= 0) return false; return t.indexOf('descuento') >= 0; }

/* ── horarios de jornada (hoja HORARIOS JORNADA) ── */
function hjFecha(v) {
  if (esD(v)) { if (!v.$d) return ''; const p = partes(v); return p ? iso(p.y, p.mo, p.d) : ''; }
  const s = String(v == null ? '' : v).trim();
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.substring(0, 10) : '';
}
function hjHora(v) {
  if (esD(v)) { if (!v.$d) return -1; const p = partes(v); return p ? p.hh * 60 + p.mi : -1; }
  const s = String(v == null ? '' : v).trim(), m = s.match(/^(\d{1,2})[:.](\d{2})/);
  if (!m) return -1;
  const hh = parseInt(m[1], 10), mm = parseInt(m[2], 10);
  if (isNaN(hh) || isNaN(mm) || hh > 23 || mm > 59) return -1;
  return hh * 60 + mm;
}
function leerHorarios(filas) {   /* horariosLeer_ (filas = celdas desde la fila 2, 11 columnas) */
  const out = [];
  (filas || []).forEach((d, i) => {
    const desde = hjFecha(d[0]); if (!desde) return;
    out.push({ desde, hasta: hjFecha(d[1]), lvEnt: hjHora(d[2]), lvSal: hjHora(d[3]), lvRef: N(d[4]) || 0,
      sabEnt: hjHora(d[5]), sabSal: hjHora(d[6]), sabRef: N(d[7]) || 0, fila: i + 2 });
  });
  out.sort((a, b) => a.desde < b.desde ? 1 : -1);
  return out;
}
function netas(e, s, ref) { if (e < 0 || s < 0 || s <= e) return 0; const h = (s - e - (Number(ref) || 0)) / 60; return h > 0 ? r2(h) : 0; }
function vieja(mes, dia) { if (mes <= 5) return (dia >= 1 && dia <= 5) ? 9.6 : 0; if (dia >= 1 && dia <= 5) return 8.75; if (dia === 6) return 5.75; return 0; }

function crear(ctx) {
  /* ctx: { registros:[celdas], motivos:[celdas], horarios:[celdas], ahora: Date, admins:[], registradores:[] } */
  const HOR = leerHorarios(ctx.horarios);
  const vigente = (f) => { for (const x of HOR) { if (f < x.desde) continue; if (x.hasta && f > x.hasta) continue; return x; } return null; };
  const ADMINS = ctx.admins || [], REG = ctx.registradores || [];
  const esAdminEstricto = u => ADMINS.indexOf(String(u || '').toLowerCase().trim()) >= 0;
  const esAdmin = u => esAdminEstricto(u) || REG.indexOf(String(u || '').toLowerCase().trim()) >= 0;
  const ahora = ctx.ahora || new Date();
  const filas = (ctx.registros || []).map(r => r.slice());
  const nuevas = [], logs = [];
  const log = (u, accion, id, det) => logs.push([ahora, u || '', accion, id || '', det || '']);

  function jornadaYMD(t) {   /* t = medianoche UTC del dia calendario */
    const x = new Date(t), dow = x.getUTCDay();
    if (isNaN(dow)) return 0;
    if (dow === 0) return 0;
    const y = x.getUTCFullYear(), mo = x.getUTCMonth() + 1, dd = x.getUTCDate();
    const v = vigente(iso(y, mo, dd));
    if (v) return dow === 6 ? netas(v.sabEnt, v.sabSal, v.sabRef) : netas(v.lvEnt, v.lvSal, v.lvRef);
    return vieja(mo, dow);
  }
  function dia(f) {   /* fecha local como la arma Google (texto yyyy-mm-dd manual; lo demas, new Date) */
    if (typeof f === 'string' && f.length >= 10) {
      const p = f.substring(0, 10).split('-');
      if (p.length === 3) return Date.UTC(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
    }
    const d = new Date(f); if (isNaN(d.getTime())) return NaN;
    const L = limaDe(d.getTime()); return Date.UTC(L.y, L.mo - 1, L.d) + ((d.getTime() - 5 * 3600e3) % DIA + DIA) % DIA;
  }
  function jornadaUnDia(f) { const t = dia(f); if (isNaN(t)) return 0; return jornadaYMD(t - (t % DIA + DIA) % DIA); }
  function jornadaTotal(a, b) {
    const f1 = dia(a), f2 = dia(b);
    if (isNaN(f1) || isNaN(f2)) return 0;
    let total = 0;
    for (let cur = f1; cur <= f2; cur += DIA) total += jornadaYMD(cur - (cur % DIA + DIA) % DIA);
    return r2(total);
  }
  function turnoUnico(r) {
    try {
      if (!r || !r.fechaEntrada || !r.fechaSalida || !r.horaEntrada || !r.horaSalida) return false;
      if (String(r.fechaEntrada).substring(0, 10) === String(r.fechaSalida).substring(0, 10)) return false;
      const e = new Date(String(r.fechaEntrada).substring(0, 10) + 'T' + r.horaEntrada + ':00');
      const s = new Date(String(r.fechaSalida).substring(0, 10) + 'T' + r.horaSalida + ':00');
      const h = (s - e) / 3600000;
      return h > 0 && h < 24;
    } catch (e2) { return false; }
  }
  function tardanza(r) {
    try {
      const f = String(r.fechaEntrada || '').substring(0, 10), v = vigente(f); if (!v) return 0;
      const p = f.split('-'), dw = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay();
      const ent = dw === 6 ? v.sabEnt : v.lvEnt, llego = hjHora(r.horaEntrada);
      if (ent < 0 || llego < 0 || llego <= ent) return 0;
      return r2((llego - ent) / 60);
    } catch (e) { return 0; }
  }
  const todas = () => filas.concat(nuevas);
  function saldo(dni) {   /* horasCalcularSaldo */
    const obj = normDni(dni); let acum = 0, perm = 0, deuda = 0;
    todas().forEach(r => {
      if (normDni(r[3]) !== obj) return;
      if ((r[20] ? S(r[20]) : '').toLowerCase() === 'rechazado') return;
      acum += N(r[13]) || 0; perm += N(r[14]) || 0; deuda += N(r[15]) || 0;
    });
    return { acum: r2(acum), perm: r2(perm), deuda: r2(deuda), saldo: r2(acum - perm - deuda) };
  }

  function registrar(body) {   /* horasRegistrar */
    try {
      const r = body.registro || {};
      if (!esAdmin(body.usuario)) return { success: false, error: 'Solo administradores pueden registrar' };
      if (!r.dni || !r.motivo) return { success: false, error: 'DNI y motivo son obligatorios' };
      const motivo = String(r.motivo || '').toLowerCase().trim();
      let horasTrabajadas = Number(r.horasTrabajadas) || 0, horasAcum = 0, horasPermiso = 0, horasDeuda = 0, alerta = '', estado = 'aprobado';
      const jornadaEsp = turnoUnico(r) ? jornadaUnDia(r.fechaEntrada)
        : ((r.fechaEntrada && r.fechaSalida) ? jornadaTotal(r.fechaEntrada, r.fechaSalida) : (r.fechaEntrada ? jornadaUnDia(r.fechaEntrada) : 0));
      if (horasTrabajadas === 0 && r.fechaEntrada && r.horaEntrada && r.fechaSalida && r.horaSalida) {
        try {
          const ent = new Date(r.fechaEntrada + 'T' + r.horaEntrada + ':00'), sal = new Date(r.fechaSalida + 'T' + r.horaSalida + ':00');
          if (sal > ent) horasTrabajadas = r2((sal - ent) / 3600000);
        } catch (e) {}
      }
      if (motivo === 'acumulación' || motivo === 'acumulacion') {
        if (horasTrabajadas > jornadaEsp) horasAcum = r2(horasTrabajadas - jornadaEsp);
        alerta = 'Acumulación registrada';
      } else if (motivo === 'permiso' || motivo === 'devolución' || motivo === 'devolucion') {
        let pedidas = Number(r.horasPermiso) || 0;
        if (pedidas === 0 && r.fechaEntrada && r.fechaSalida) pedidas = jornadaTotal(r.fechaEntrada, r.fechaSalida);
        const dias = (r.fechaEntrada && r.fechaSalida) ? Math.floor((new Date(r.fechaSalida) - new Date(r.fechaEntrada)) / (24 * 60 * 60 * 1000)) + 1 : 1;
        if (dias >= 2) { alerta = 'OBSERVADO: Permiso por ' + dias + ' día(s). Requiere validación.'; estado = 'pendiente'; }
        else if (pedidas > 12) { alerta = 'OBSERVADO: Permiso excede 12 horas. Revisar autorización.'; estado = 'pendiente'; }
        else alerta = 'Permiso registrado';
        const s = saldo(r.dni);
        if (s.saldo >= pedidas) { horasPermiso = pedidas; horasDeuda = 0; alerta += ' - Cubierto con saldo (' + s.saldo.toFixed(2) + 'h disponibles)'; }
        else if (s.saldo > 0) { horasPermiso = s.saldo; horasDeuda = r2(pedidas - s.saldo); alerta += ' - ' + s.saldo.toFixed(2) + 'h del saldo + ' + horasDeuda.toFixed(2) + 'h de deuda'; }
        else { horasPermiso = 0; horasDeuda = pedidas; alerta += ' - Sin saldo: ' + horasDeuda.toFixed(2) + 'h registradas como deuda'; }
        horasTrabajadas = 0;
      } else if (motivo === 'compensación' || motivo === 'compensacion') {
        horasAcum = horasTrabajadas; alerta = 'Compensación registrada (recupera deuda)';
      } else if (norm(motivo).indexOf('dia libre') >= 0) {
        horasAcum = r2(horasTrabajadas); alerta = 'Trabajo en día libre: se acumulan las ' + horasAcum.toFixed(2) + 'h trabajadas';
      } else if (norm(motivo).indexOf('tardanza') >= 0) {
        const tarde = tardanza(r);
        if (tarde > 0) {
          const sT = saldo(r.dni);
          if (sT.saldo >= tarde) horasPermiso = tarde;
          else if (sT.saldo > 0) { horasPermiso = sT.saldo; horasDeuda = r2(tarde - sT.saldo); }
          else horasDeuda = tarde;
          alerta = 'Tardanza de ' + tarde.toFixed(2) + 'h' + (horasDeuda > 0 ? ' - ' + horasDeuda.toFixed(2) + 'h quedan como deuda' : ' - cubierta con saldo');
        } else alerta = 'Tardanza registrada sin descuento (llegó dentro del horario o no hay horario vigente)';
        horasTrabajadas = 0;
      } else alerta = 'Registro de tipo: ' + r.motivo;
      let necesitaComp = false, montoComp = 0;
      if (horasAcum > 0) {
        const s = saldo(r.dni);
        if (s.deuda > 0) {
          if (horasAcum >= s.deuda) { montoComp = s.deuda; necesitaComp = true; alerta += ' - Deuda previa de ' + s.deuda.toFixed(2) + 'h SALDADA con compensación automática'; }
          else { montoComp = horasAcum; necesitaComp = true; alerta += ' - Compensación de ' + horasAcum.toFixed(2) + 'h aplicada a deuda'; }
        }
      }
      const id = 'H' + ahora.getTime();
      nuevas.push([id, ahora, body.usuario || '', String(r.dni).trim(), r.nombre || '', r.empresa || '', r.cargo || '',
        r.fechaEntrada || '', r.horaEntrada || '', r.fechaSalida || '', r.horaSalida || '',
        r2(horasTrabajadas), r2(jornadaEsp), r2(horasAcum), r2(horasPermiso), r2(horasDeuda),
        r.motivo || '', r.detalle || '', r.observaciones || '', alerta, estado, '', '']);
      log(body.usuario, 'REGISTRAR', id, r.motivo + ' / ' + r.dni);
      if (necesitaComp && montoComp > 0) {
        const idComp = 'HC' + ahora.getTime();
        nuevas.push([idComp, ahora, body.usuario || '', String(r.dni).trim(), r.nombre || '', r.empresa || '', r.cargo || '',
          '', '', '', '', 0, 0, -montoComp, 0, -montoComp, 'Compensación automática', 'Auto: vinculado a registro ' + id,
          'Compensación de ' + montoComp.toFixed(2) + 'h: acumulación cubre deuda previa', 'Compensación automática', 'aprobado', body.usuario || '', ahora]);
        log(body.usuario, 'COMPENSACION_AUTO', idComp, 'Compensa ' + montoComp + 'h de deuda con acumulación de ' + id);
      }
      return { success: true, id, registro: { id, horasTrabajadas, jornadaEsperada: jornadaEsp, horasAcum, horasPermiso, horasDeuda, alerta, estado } };
    } catch (e) { return { success: false, error: e.message }; }
  }
  function devueltasDelDia(dni, fecha) {
    try {
      const d = String(dni || '').trim(), f = String(fecha || '').substring(0, 10);
      if (!d || !f) return 0;
      let total = 0;
      filas.forEach(r => {
        if (normDni(r[3]) !== normDni(d)) return;
        if ((r[20] ? S(r[20]) : '').toLowerCase() === 'rechazado') return;
        const fila = esD(r[7]) ? hjFecha(r[7]) : String(r[7] || '').substring(0, 10);
        if (fila !== f) return;
        if (!esDevolucion(r[16])) return;
        total += N(r[14]) || 0;
      });
      return r2(total);
    } catch (e) { return 0; }
  }
  const TOPE = ctx.topePagadas || 2;
  function validarDevolucion(r) {
    let pedidas = Number(r.horasDevolver);
    if (isNaN(pedidas) || pedidas <= 0) pedidas = Number(r.horasPermiso) || 0;
    pedidas = r2(pedidas);
    if (pedidas <= 0) return { ok: false, error: 'Indica cuantas horas se le van a pagar como extras.' };
    if (pedidas > TOPE + 0.001) return { ok: false, error: 'Solo se pueden pagar ' + TOPE + ' horas por dia. Se intento registrar ' + pedidas.toFixed(2) + '.' };
    const fecha = String(r.fechaEntrada || '').substring(0, 10), ya = devueltasDelDia(r.dni, fecha);
    if (ya + pedidas > TOPE + 0.001) {
      const libre = Math.max(0, r2(TOPE - ya));
      return { ok: false, error: 'El ' + fecha + ' a este trabajador ya se le pagaron ' + ya.toFixed(2) + ' h. Solo quedan ' + libre.toFixed(2) + ' h disponibles del tope diario de ' + TOPE + ' h.' };
    }
    return { ok: true, horas: pedidas, yaDevueltas: ya };
  }
  let pagadas = null;
  function registrarV3(body) {   /* horasRegistrarV3 */
    const r = (body && body.registro) || {};
    let chk = null, saldoAntes = 0;
    if (esDevolucion(r.motivo)) {
      chk = validarDevolucion(r);
      if (!chk.ok) return { success: false, error: chk.error };
      try { saldoAntes = (saldo(r.dni) || {}).saldo || 0; } catch (e) {}
      r.horasPermiso = chk.horas;
    }
    const res = registrar(body);
    try {
      if (!res || !res.success) return res;
      if (chk) {   /* hv3AnotarPagadas_ */
        const antes = r2(Number(saldoAntes) || 0), despues = r2(antes - chk.horas);
        pagadas = [ahora, body.usuario || '', String(r.fechaEntrada || '').substring(0, 10), String(r.dni || '').trim(), r.nombre || '', r.empresa || '', r.cargo || '',
          chk.horas, antes, despues, res.id || '', String(r.observaciones || r.detalle || '')];
        log(body.usuario, 'HORAS_PAGADAS', res.id || '', chk.horas + 'h a ' + r.dni + ' el ' + r.fechaEntrada);
        res.horasPagadas = { horas: chk.horas, saldoAntes: antes, saldoDespues: despues };
        return res;
      }
      if (esDescuento(r.motivo)) {   /* hv3ArreglarDescuento_ */
        const fila = [...nuevas].reverse().find(x => String(x[0]).trim() === String(res.id).trim());
        if (!fila) return res;
        let pedidas = Number(r.horasPermiso) || 0;
        if (pedidas <= 0 && r.fechaEntrada) pedidas = r.fechaSalida ? jornadaTotal(r.fechaEntrada, r.fechaSalida) : jornadaUnDia(r.fechaEntrada);
        pedidas = r2(pedidas);
        if (pedidas <= 0) return res;
        const disp = Number(saldo(r.dni).saldo) || 0;
        let permiso = 0, deuda = 0, detalle = '';
        if (disp >= pedidas) { permiso = pedidas; detalle = 'Cubierto con saldo (' + disp.toFixed(2) + 'h disponibles)'; }
        else if (disp > 0) { permiso = r2(disp); deuda = r2(pedidas - disp); detalle = disp.toFixed(2) + 'h del saldo + ' + deuda.toFixed(2) + 'h de deuda'; }
        else { deuda = pedidas; detalle = 'Sin saldo: ' + deuda.toFixed(2) + 'h quedan como deuda'; }
        const alerta = String(r.motivo || 'Descuento') + ' de ' + pedidas.toFixed(2) + 'h — ' + detalle;
        fila[14] = permiso; fila[15] = deuda; fila[19] = alerta;
        res.registro = res.registro || {}; res.registro.horasPermiso = permiso; res.registro.horasDeuda = deuda; res.registro.alerta = alerta;
      }
      return res;
    } catch (e) { return res; }
  }
  const cambios = [];   /* [id, columna (1..23), valor] */
  function porId(body, accion, cols, errAuth) {
    try {
      if (!esAdminEstricto(body.usuario)) return { success: false, error: errAuth };
      for (let i = 0; i < filas.length; i++) {
        if (filas[i][0] === body.id) { cols.forEach(c => cambios.push([body.id, c[0], c[1]])); log(body.usuario, accion, body.id, accion === 'EDITAR' ? JSON.stringify(body.registro || {}) : ''); return { success: true }; }
      }
      return { success: false, error: 'Registro no encontrado' };
    } catch (e) { return { success: false, error: e.message }; }
  }
  function editar(body) { const r = body.registro || {}; return porId(body, 'EDITAR', r.observaciones !== undefined ? [[19, r.observaciones]] : [], 'Solo administradores pueden editar'); }
  function eliminar(body) { return porId(body, 'ELIMINAR', [[21, 'rechazado'], [22, body.usuario || ''], [23, ahora]], 'Solo administradores pueden eliminar'); }
  function aprobar(body) { return porId(body, 'APROBAR', [[21, 'aprobado'], [22, body.usuario || ''], [23, ahora]], 'Solo administradores pueden aprobar'); }
  const motivoNuevo = [], motivoBorrar = [];
  function agregarMotivo(body) {
    try {
      if (!esAdminEstricto(body.usuario)) return { success: false, error: 'Solo administradores' };
      const nombre = String(body.nombre || '').trim();
      if (!nombre) return { success: false, error: 'Nombre vacío' };
      for (const d of (ctx.motivos || [])) if (String(d[0] ? S(d[0]) : '').toLowerCase().trim() === nombre.toLowerCase()) return { success: false, error: 'Ya existe ese motivo' };
      motivoNuevo.push([nombre]); log(body.usuario, 'AGREGAR_MOTIVO', '', nombre);
      return { success: true, motivo: nombre };
    } catch (e) { return { success: false, error: e.message }; }
  }
  function eliminarMotivo(body) {
    try {
      if (!esAdminEstricto(body.usuario)) return { success: false, error: 'Solo administradores' };
      const nombre = String(body.nombre || '').trim(), M = ctx.motivos || [];
      for (let i = M.length - 1; i >= 0; i--) {
        if (String(M[i][0] ? S(M[i][0]) : '').trim() === nombre) { motivoBorrar.push(i); log(body.usuario, 'ELIMINAR_MOTIVO', '', nombre); return { success: true }; }
      }
      return { success: false, error: 'Motivo no encontrado' };
    } catch (e) { return { success: false, error: e.message }; }
  }
  const ACC = { horasRegistrar: registrarV3, horasEditar: editar, horasEliminar: eliminar, horasAprobar: aprobar, horasAgregarMotivo: agregarMotivo, horasEliminarMotivo: eliminarMotivo };
  return {
    ejecutar(accion, body) {
      const fn = ACC[accion]; if (!fn) return null;
      const res = fn(body);
      return { res, nuevas, cambios, pagadas, logs, motivoNuevo, motivoBorrar };
    }
  };
}
module.exports = { crear, ACCIONES: ['horasRegistrar', 'horasEditar', 'horasEliminar', 'horasAprobar', 'horasAgregarMotivo', 'horasEliminarMotivo'] };
