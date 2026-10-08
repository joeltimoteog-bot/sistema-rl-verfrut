/* ═══════════════════════════════════════════════════════════════════════════
   kpi-motor (_KPI_RRLL_V1, 30-set-2026) — KPIs OFICIALES del equipo de RR.LL.
   (archivo de la empresa "KPIs-Relaciones Laborales.xlsx", periodo ago-dic 2026)
   Calculo PURO: recibe los datos ya leidos y devuelve, por persona, cada KPI con
   numerador, denominador, %, nivel 1-5 y la EVIDENCIA registro por registro.
   Nada se escribe aqui; nada se edita a mano (salvo la nota del curso, con constancia).
   Reglas decididas por Joel Timoteo (30-set-2026):
     · Conflictos: informe del caso en <= 5 dias habiles desde el reporte (cumple);
       en <= 3 dias se marca ⭐ (plazo interno). Sin informe y pasado el dia 5 = no cumple.
     · Gestion documentaria: cada atencion registrada el MISMO dia en que se hizo +
       cada informe de caso subido dentro del plazo interno vigente del caso.
     · Capacitaciones: cada fecha programada en ETI (Capacitaciones ETI, Checklist,
       Ingresos masivos) registrada como ejecutada. La reprogramacion del administrador
       mueve la fecha (la antigua no cuenta) y queda como sustento. Reforzamiento: suma
       solo si se hace; si no, no resta.
     · Curso Legislacion Laboral: nota registrada por Joel con su constancia.
     · Ausencias (descanso medico, vacaciones...): lo que cae en esos dias lo responde
       el reemplazo y no cuenta para el titular. Ingresos nuevos: se miden desde su ingreso.
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
const { plazoEn, nombreMatch } = require('./cumpl-motor');

const PERIODO = { ini: '2026-09-01', fin: '2026-12-31', curso_desde: '2026-12-01' };   /* Joel (30-set): la medicion arranca el 01-set-2026 */
const VISORES = ['jtimoteo', 'lcovenas'];            /* ven el modulo */
const EDITORES = ['jtimoteo'];                        /* registran la nota del curso */
const TEMAS_ETI = ['CAPACITACIONES ETI', 'EVALUACIONES DE CHECKLIST', 'INGRESOS MASIVOS'];
const TEMA_OPCIONAL = 'REFORZAMIENTO';
const HORA_CIERRE = '16:36';                          /* cierre de la jornada: hasta esa hora se registra lo del dia (decision de Joel, 30-set) */
const DIAS_CONSULTA = 5;                              /* A3: consulta EN PROCESO mas de 5 dias habiles = no atendida */

/* Definicion oficial (texto tal cual del archivo de la empresa) */
const DEF = {
  SUP: [
    { codigo: 'K1', corto: 'Conflictos ≤5 días', peso: 0.20, meta: 0.95, unidad: 'casos',
      texto: 'Gestionar oportunamente el 95% de los conflictos laborales reportados durante el periodo de evaluación, asegurando respuesta en el plazo de 5 días hábiles según procedimiento.' },
    { codigo: 'K2', corto: 'Gestión documentaria', peso: 0.10, meta: 0.95, unidad: 'documentos',
      texto: 'Asegurar el 95% de cumplimiento en la gestión documentaria laboral dentro de los plazos establecidos de agosto a diciembre 2026.' },
    { codigo: 'K3', corto: 'Capacitaciones ETI', peso: 0.10, meta: 0.95, unidad: 'fechas programadas',
      texto: 'Ejecutar el 95% de las capacitaciones de Etica Social e Ingresos masivos, conforme al plan anual, de agosto a diciembre de 2026.' },
    { codigo: 'K4', corto: 'Curso Legislación', peso: 0.10, meta: null, unidad: 'nota',
      texto: 'Aprobar con nota mínima de 15 el curso de Legislación Laboral a Diciembre de 2026.' }
  ],
  ASIST: [
    { codigo: 'A1', corto: 'Registro el mismo día', peso: 0.20, meta: 0.90, unidad: 'documentos',
      texto: 'Recibir, validar y registrar el 90% de la documentación laboral recepcionada en el Sistema de Relaciones Laborales el mismo día, asegurando datos completos, legibles y correctamente clasificados.' },
    { codigo: 'A2', corto: 'Remisión el mismo día', peso: 0.10, meta: 0.95, unidad: 'documentos',
      texto: 'Remitir el 95% de la documentación registrada el mismo día hábil a las áreas correspondientes, incluyendo adicionales o subsanaciones, garantizando trazabilidad documentaria.' },
    { codigo: 'A3', corto: 'Consultas atendidas', peso: 0.10, meta: 0.90, unidad: 'consultas',
      texto: 'Atender el 90% de consultas del personal y derivar oportunamente los casos que requieran evaluación superior.' },
    { codigo: 'A4', corto: 'Asistencia a capacitaciones', peso: 0.10, meta: 0.95, unidad: 'capacitaciones',
      texto: 'Asistir a un minimo del 95% de las capacitaciones planificadas por la empresa, de agosto a diciembre 2026.' }
  ]
};

/* Personas evaluadas (archivo de la empresa). usuario = login del sistema; alias = como aparecen en ETI */
const PERSONAS = [
  { usuario: 'smiranda', dni: '47262764', nombre: 'MIRANDA PASAPERA SOCORRO DEL PILAR', empresa: 'RAPEL', tipo: 'ASIST', puesto: 'ASISTENTE DE RELACIONES LABORALES', ingreso: '2015-08-04' },
  { usuario: 'jborrero', dni: '45984661', nombre: 'HERNANDEZ BORRERO JHON STEVE', empresa: 'RAPEL', tipo: 'SUP', puesto: 'SUPERVISOR(A) DE GESTIÓN HUMANA', ingreso: '2026-09-11' },
  { usuario: 'yluzon', dni: '76329783', nombre: 'LUZON VENEGAS YHANELLY GERALDENY', empresa: 'VERFRUT', tipo: 'SUP', puesto: 'SUPERVISOR(A) DE GESTIÓN HUMANA', ingreso: '2021-06-01' },
  { usuario: 'almartinez', dni: '72952975', nombre: 'MARTINEZ JUAREZ ALEXANDER', empresa: 'VERFRUT', tipo: 'SUP', puesto: 'SUPERVISOR(A) DE GESTIÓN HUMANA', ingreso: '2024-09-03' },
  { usuario: 'rmolero', dni: '74218729', nombre: 'MOLERO ABAD ROBERTO CARLOS', empresa: 'VERFRUT', tipo: 'SUP', puesto: 'SUPERVISOR(A) DE GESTIÓN HUMANA', ingreso: '2024-09-23' },
  { usuario: 'fpulache', dni: '46793507', nombre: 'PULACHE VIERA FLOR DE LOS MILAGROS', empresa: 'RAPEL', tipo: 'SUP', puesto: 'SUPERVISOR(A) DE GESTIÓN HUMANA', ingreso: '2012-07-23' },
  { usuario: 'ptamayo', dni: '72954772', nombre: 'TAMAYO RODRIGUEZ POOL WILFREDO', empresa: 'RAPEL', tipo: 'SUP', puesto: 'SUPERVISOR(A) DE GESTIÓN HUMANA', ingreso: '2022-04-01' },
  { usuario: 'atineo', dni: '73332618', nombre: 'TINEO RAMOS ALEXANDER', empresa: 'VERFRUT', tipo: 'SUP', puesto: 'SUPERVISOR(A) DE GESTIÓN HUMANA', ingreso: '2024-04-04' },
  { usuario: 'sviera', dni: '46066300', nombre: 'VIERA GIRON SERGIO', empresa: 'RAPEL', tipo: 'SUP', puesto: 'SUPERVISOR(A) DE GESTIÓN HUMANA', ingreso: '2011-07-11' },
  { usuario: 'fzapata', dni: '75656528', nombre: 'ZAPATA SUAREZ ALEX FABIAN', empresa: 'RAPEL', tipo: 'SUP', puesto: 'SUPERVISOR(A) DE GESTIÓN HUMANA', ingreso: '2023-08-01', alias: ['ALEX ZAPATA JUAREZ', 'ALEX FABIAN ZAPATA JUAREZ'] }
];

/* ── utilidades ── */
const DIA = 86400000;
const usr = (u) => String(u || '').trim().toLowerCase();
const ymd = (d) => d ? d.toISOString().slice(0, 10) : '';
const aFecha = (s) => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null; };
const dm = (s) => s ? String(s).slice(8, 10) + '/' + String(s).slice(5, 7) : '';
const max = (a, b) => (a > b ? a : b);
const min = (a, b) => (a < b ? a : b);

function nivelPct(p, meta) {
  if (p >= 1 - 1e-9) return 5;
  const m4 = meta >= 0.95 ? 0.98 : 0.95;
  if (p >= m4 - 1e-9) return 4;
  if (p >= meta - 1e-9) return 3;
  if (p >= meta - 0.05 - 1e-9) return 2;
  return 1;
}
/* Los archivos subidos a Azure Blob se nombran <modulo>/<milisegundos>_<archivo>: de ahi sale el dia (Lima) en que se subio */
function fechaDeUrl(u) {
  const m = String(u || '').match(/blob\.core\.windows\.net\/[^?#]*?\/(\d{13})_/);
  if (!m) return '';
  const ms = +m[1];
  if (ms < Date.UTC(2025, 0, 1) || ms > Date.now() + 86400000) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date(ms));
}
function nivelNota(n) { return n >= 20 ? 5 : n >= 18 ? 4 : n >= 15 ? 3 : n >= 12 ? 2 : 1; }

/* ¿el nombre (ETI / supervisor) es de esta persona? */
const normN = (s) => String(s || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
function esPersona(nombre, p, nombreUsuario) {
  const n = String(nombre || '').trim();
  if (!n) return false;
  if ((p.alias || []).some(a => usr(a) === usr(n))) return true;
  return [p.nombre, nombreUsuario].filter(Boolean).some(x => nombreMatch(n, x) || nombreMatch(x, n));
}
/* ETI: si la persona tiene cuenta en ETI (usuarios_eti), se enlaza EXACTO por el nombre de esa cuenta
   (igual que lo hace ETI para mostrarle sus programaciones); si no, por coincidencia de nombre. */
function esPersonaEti(nombre, p, nombreUsuario, etiNombre) {
  if (etiNombre) return normN(nombre) === normN(etiNombre) || (p.alias || []).some(a => normN(a) === normN(nombre));
  return esPersona(nombre, p, nombreUsuario);
}

/* ── motor ──
   E = { M: crearMotor(D)._kpi, personas, informes:{nro:{fecha,fuente}}, atenciones:[...],
         eti:{ programaciones:[...], registros:{id:{fecha_ejecucion}} }, notas:{usuario:{nota,fecha,constancia,por}},
         hoy:'aaaa-mm-dd' } */
function calcular(E) {
  const M = E.M, hoyS = E.hoy, hoy = aFecha(hoyS);
  /* RANGO: cada registro cuenta en el dia en que VENCE (caso: dia 5; atencion: su dia de registro; ETI: la fecha programada).
     Asi un mes (o del 1 al 15) se evalua con lo que vencia en ese lapso. */
  const R = { desde: max(PERIODO.ini, String(E.desde || PERIODO.ini).slice(0, 10)), hasta: min(PERIODO.fin, String(E.hasta || PERIODO.fin).slice(0, 10)) };
  const enR = (d) => !!d && d >= R.desde && d <= R.hasta;
  const piso = ymd(new Date(aFecha(R.desde).getTime() - 20 * DIA));   /* registros de hasta 20 dias antes pueden vencer dentro del rango */
  const personas = (E.personas && E.personas.length ? E.personas : PERSONAS).filter(p => p.activo !== false);
  const porUsuario = {};
  (M.usuarios || []).forEach(u => { if (u && u.usuario) porUsuario[usr(u.usuario)] = u; });
  const avisos = [];
  const salida = personas.map(p => {
    const uSis = porUsuario[usr(p.usuario)] || null;
    const u = { usuario: usr(p.usuario), nombre: uSis ? uSis.nombre : p.nombre };
    const desde = max(piso, p.ingreso || piso);   /* desde aqui se toman registros (la fecha de vencimiento decide si cuentan) */
    const cEti = E.eti && E.eti.usuarios ? E.eti.usuarios[u.usuario] : null;
    const etiNombre = cEti && String(cEti.estado || 'activo') !== 'inactivo' ? cEti.nombre : null;
    const ausencias = (M.AUS.todas || []).filter(a => !a.anulada && usr(a.usuario) === u.usuario && (a.hasta || '9999') >= R.desde && a.desde <= R.hasta)
      .map(a => ({ tipo: a.tipo, desde: a.desde, hasta: a.hasta || '', reemplazo: a.reemplazo || '' }));
    const casosP = casosDe(p, u, desde), av0 = avisos.length;
    const kpis = (DEF[p.tipo] || DEF.SUP).map(d => {
      let r;
      if (d.codigo === 'K1') r = k1(casosP);
      else if (d.codigo === 'K2') r = k2(casosP, atencionesDe(p, u, desde));
      else if (d.codigo === 'K3') r = k3(p, u, desde, etiNombre);
      else if (d.codigo === 'K4') r = k4(p);
      else if (d.codigo === 'A1') r = a1(atencionesDe(p, u, desde));
      else if (d.codigo === 'A3') {   /* Joel (30-set): se deja EN EVALUACION; se muestra el calculo pero no suma a la nota ni genera alertas */
        r = a3(atencionesDe(p, u, desde));
        r = Object.assign(r, { estado: 'en_evaluacion', calc_num: r.num, calc_den: r.den, num: 0, den: 0,
          nota_def: 'En evaluación por el Coordinador de RR.LL.: aún no suma a la nota. Cálculo referencial: ' + r.num + ' de ' + r.den + ' atenciones FINALIZADAS (las EN PROCESO de más de ' + DIAS_CONSULTA + ' días hábiles cuentan como no atendidas).' });
      }
      else r = { estado: 'sin_datos', num: 0, den: 0, evidencia: [], nota_def: d.codigo === 'A2'
        ? 'Aún no existe en el sistema la marca "Remitido a…" con fecha y hora. Se medirá cuando se habilite.'
        : 'Aún no existe la lista de capacitaciones a las que es convocada. Se medirá cuando se habilite.' };
      const o = Object.assign({ codigo: d.codigo, corto: d.corto, texto: d.texto, peso: d.peso, meta: d.meta, unidad: d.unidad }, r);
      if (o.estado === 'ok') { o.pct = o.den ? o.num / o.den : 0; if (d.codigo !== 'K4') o.nivel = nivelPct(o.pct, d.meta); }
      return o;
    });
    for (let i = av0; i < avisos.length; i++) { avisos[i].usuario = u.usuario; avisos[i].nombre = p.nombre; avisos[i].clave += ':' + u.usuario; }
    let sp = 0, sw = 0, cp = 0, cw = 0;
    kpis.forEach(k => { if (k.estado === 'ok' && k.nivel) { sp += k.nivel * k.peso; sw += k.peso; } });
    kpis.forEach(k => { if (k.estado === 'ok' && k.codigo !== 'K4' && k.den) { cp += (k.num / k.den) * k.peso; cw += k.peso; } });   /* % de cumplimiento (sin el curso) */
    const progsP = ((E.eti && E.eti.programaciones) || []).filter(g => esPersonaEti(g.supervisor, p, u.nombre, etiNombre));
    const enlace = { rrll: !!uSis, rrll_nombre: uSis ? uSis.nombre : '', eti_cuenta: !!cEti, eti_activa: !!etiNombre, eti_nombre: cEti ? cEti.nombre : '',
      eti_sectores: ((E.eti && E.eti.supervisores) || []).filter(x => etiNombre ? normN(x.nombre) === normN(etiNombre) : esPersona(x.nombre, p, u.nombre)).map(x => x.sector || ''),
      programaciones: progsP.length, aplica_eti: p.tipo === 'SUP' };
    return { usuario: u.usuario, nombre: p.nombre, empresa: p.empresa, tipo: p.tipo, puesto: p.puesto, dni: p.dni, ingreso: p.ingreso,
      desde, ausencias, usuario_encontrado: !!uSis, enlace, kpis, nota: sw ? Math.round(sp / sw * 100) / 100 : null, peso_evaluado: Math.round(sw * 100) / 100,
      cumpl: cw ? Math.round(cp / cw * 1000) / 1000 : null, sectores: enlace.eti_sectores.length ? enlace.eti_sectores : [p.tipo === 'ASIST' ? 'COORDINACIÓN RR.LL.' : 'SIN SECTOR'] };
  });
  return { hoy: hoyS, periodo: PERIODO, rango: R, personas: salida, avisos };

  /* casos de la persona en el periodo, con fecha del informe y plazos */
  function casosDe(p, u, desde) {
    const out = [];
    (M.casos || []).forEach(c => {
      const base = c.fecha_reporte || c.fecha_registro; if (!base) return;
      const b = ymd(base); if (b < desde || b > hoyS || b > R.hasta) return;
      const propio = M.esDelUsuario(c, u);
      const dueno = M.AUS.duenoEn(c, u, b);
      if (!propio && !dueno) return;
      const ref = 'Caso N° ' + c.nro;
      if (!dueno) {   /* era suyo pero estaba ausente: lo responde el reemplazo */
        const a = M.AUS.cobCaso(c, b), r = a && M.AUS.reemp(a);
        out.push({ c, ref, base, lim5: M.sumarHabiles(base, 5), excluido: 'Reportado durante su ausencia: lo atiende ' + (r ? r.nombre : 'el reemplazo') + '. No cuenta para su KPI.' });
        return;
      }
      const lim5 = M.sumarHabiles(base, 5), lim3 = M.sumarHabiles(base, 3);
      const limInt = M.sumarHabiles(base, plazoEn(M.cfg, 'plazo_investigacion', ymd(c.fecha_registro || base)));
      const inf = E.informes && E.informes[String(c.nro)];
      let fi = null, fuente = '';
      const fUrl = fechaDeUrl(c.enlace_informe);   /* hora exacta de subida del PDF (va en el nombre del archivo en Azure Blob) */
      if (fUrl) {
        fi = aFecha(fUrl); fuente = 'hora de subida del archivo';
        /* _IND_FIX_V1 (08-oct-2026): cuenta el PRIMER informe; si se volvio a subir corregido, antes valia la fecha del ultimo */
        if (inf && inf.fecha) { const f2 = aFecha(inf.fecha); if (f2 && fi && f2 < fi) { fi = f2; fuente = inf.fuente || 'primer registro del informe'; } }
      }
      else if (c.enlace_informe && inf && inf.fecha) { fi = aFecha(inf.fecha); fuente = inf.fuente || ''; }
      else if (!c.enlace_informe && M.concluido(c) && c.fecha_cierre) { fi = c.fecha_cierre; fuente = 'cierre sin informe'; }
      out.push({ c, ref, base, lim5, lim3, limInt, fi, fuente, cubre: !propio, sinFecha: !!(c.enlace_informe && !fi) });
    });
    return out;
  }

  function k1(casos) {
    const ev = []; let num = 0, den = 0;
    casos.forEach(x => {
      if (!enR(ymd(x.lim5))) return;   /* cuenta en el rango donde vence (dia 5 habil) */
      const c = x.c, e = { ref: x.ref, fecha: x.base ? ymd(x.base) : '', vence: ymd(x.lim5), trabajador: c.nombre, caso: c.nro };
      if (x.excluido) { e.ok = null; e.detalle = x.excluido; ev.push(e); return; }
      if (x.cubre) e.cubre = true;
      if (x.sinFecha) { e.ok = null; e.detalle = 'Tiene informe, pero se subió antes del registro automático de fechas: no se puede verificar el día. No suma ni resta.'; ev.push(e); return; }
      if (x.fi) {
        const d = M.habilesEntre(x.base, x.fi);
        e.ok = x.fi <= x.lim5; e.estrella = x.fi <= x.lim3; e.dias = d;
        e.detalle = (x.fuente === 'cierre sin informe' ? 'Cerrado sin informe el ' : 'Informe subido el ') + dm(ymd(x.fi)) + ' (' + d + ' día' + (d === 1 ? '' : 's') + ' hábil' + (d === 1 ? '' : 'es') + ')' +
          (e.ok ? (e.estrella ? ' ⭐ dentro del plazo interno de 3 días' : ' · dentro de los 5 días') : ' · fuera de los 5 días (vencía el ' + dm(ymd(x.lim5)) + ')');
        den++; if (e.ok) num++;
      } else if (hoy > x.lim5) {
        const r = M.habilesEntre(x.lim5, hoy);
        e.ok = false; e.dias_retraso = r;
        e.detalle = 'Sin informe. Venció el ' + dm(ymd(x.lim5)) + ' (' + r + ' día' + (r === 1 ? '' : 's') + ' hábil' + (r === 1 ? '' : 'es') + ' de retraso)';
        den++;
        avisos.push({ clave: 'venc:caso:' + c.nro, codigo: 'K1', tipo: 'VENCIDO', caso: c.nro,
          mensaje: 'Caso N° ' + c.nro + ' (' + (c.nombre || '') + ') venció el ' + dm(ymd(x.lim5)) + ' sin informe (5 días hábiles).' });
      } else {
        const rest = M.habilesEntre(hoy, x.lim5);
        e.ok = null; e.pendiente = true;
        e.detalle = 'En plazo: vence el ' + dm(ymd(x.lim5)) + (rest <= 1 ? (rest === 0 ? ' (HOY)' : ' (mañana)') : '');
        if (rest <= 1) avisos.push({ clave: 'prev:caso:' + c.nro + ':' + rest, codigo: 'K1', tipo: 'PREVENTIVA', caso: c.nro,
          mensaje: 'Caso N° ' + c.nro + ' (' + (c.nombre || '') + ') vence ' + (rest === 0 ? 'HOY' : 'mañana') + ' (' + dm(ymd(x.lim5)) + ') y aún no tiene informe.' });
      }
      ev.push(e);
    });
    return { estado: den ? 'ok' : 'sin_datos', num, den, evidencia: ev,
      estrellas: ev.filter(e => e.estrella).length };
  }

  function atencionesDe(p, u, desde) {
    return (E.atenciones || []).filter(a => {
      const f = String(a.fecha_atencion || '').slice(0, 10);
      if (!f || f < desde || f > hoyS || f > R.hasta) return false;
      const us = usr(a.usuario_sistema);
      return us ? us === u.usuario : esPersona(a.supervisor, p, u.nombre);
    });
  }

  function mismoDia(ats, ev) {
    let num = 0, den = 0, sinHora = 0;
    const malas = [], fuera = [];
    ats.forEach(a => {
      const f = String(a.fecha_atencion).slice(0, 10), fr = a.fecha_registro ? String(a.fecha_registro).slice(0, 10) : '';
      const fd0 = aFecha(f), hIni0 = String(a.hora_inicio || '').slice(0, 5);
      const lim0 = (!M.esHabil(fd0) || (/^\d{2}:\d{2}$/.test(hIni0) && hIni0 > HORA_CIERRE)) ? ymd(M.sumarHabiles(fd0, 1)) : f;
      if (!enR(lim0)) return;   /* cuenta en el dia en que debia registrarse */
      if (!fr) { sinHora++; return; }
      /* Regla (Joel, 30-set): se registra el MISMO dia hasta el cierre de la jornada (HORA_CIERRE).
         Atendida en sabado, domingo o feriado, o despues del cierre: vale hasta el cierre del primer dia habil siguiente. */
      const fd = aFecha(f), hIni = String(a.hora_inicio || '').slice(0, 5), hReg = String(a.fecha_registro).slice(11, 16);
      const pasaDia = !M.esHabil(fd) || (/^\d{2}:\d{2}$/.test(hIni) && hIni > HORA_CIERRE);
      const limite = pasaDia ? ymd(M.sumarHabiles(fd, 1)) : f;
      if (fr === limite && hReg && hReg > HORA_CIERRE) {   /* Joel (30-set): mismo dia pero despues del cierre -> "fuera de horario": no suma ni resta, se evalua aparte */
        fuera.push({ ref: 'Atención N° ' + a.nro + ' (' + a.anio + ')', fecha: f, trabajador: a.nombre, ok: null, fuera_horario: true,
          detalle: '⏰ Fuera de horario: atendida el ' + dm(f) + (hIni ? ' ' + hIni : '') + ', registrada el ' + dm(fr) + ' a las ' + hReg + ' (después del cierre de ' + HORA_CIERRE + '). No suma ni resta: en evaluación.' });
        return;
      }
      den++;
      const ok = fr < limite || (fr === limite && (!hReg || hReg <= HORA_CIERRE));
      if (ok) num++;
      else {
        const dh = M.habilesEntre(aFecha(limite), aFecha(fr));
        malas.push({ ref: 'Atención N° ' + a.nro + ' (' + a.anio + ')', fecha: f, trabajador: a.nombre, ok: false,
          detalle: 'Atendida el ' + dm(f) + (hIni ? ' ' + hIni : '') + ' · debía registrarse hasta el ' + dm(limite) + ' ' + HORA_CIERRE +
            ' · se registró el ' + dm(fr) + (hReg ? ' ' + hReg : '') + (dh ? ' (' + dh + ' día(s) hábil(es) después)' : ' (después del cierre de la jornada)') });
      }
    });
    if (den) ev.push({ ref: 'Atenciones registradas el mismo día', ok: true, resumen: true, detalle: num + ' de ' + den + ' atenciones se registraron el mismo día, hasta el cierre de la jornada (' + HORA_CIERRE + ').' });
    malas.forEach(x => ev.push(x));
    if (fuera.length) ev.push({ ref: 'Registradas fuera de horario', ok: null, resumen: true, fuera_horario: fuera.length,
      detalle: fuera.length + ' atención(es) registradas el mismo día pero después de las ' + HORA_CIERRE + '. No suman ni restan (en evaluación del Coordinador).' });
    fuera.forEach(x => ev.push(x));
    if (sinHora) ev.push({ ref: 'Atenciones sin hora de registro', ok: null, resumen: true, detalle: sinHora + ' atención(es) sin hora de registro guardada (antes de la migración). No suman ni restan.' });
    return { num, den, fuera: fuera.length };
  }

  function k2(casos, ats) {
    const ev = [];
    const r = mismoDia(ats, ev);
    let num = r.num, den = r.den;
    casos.forEach(x => {
      if (x.excluido || x.sinFecha || !enR(ymd(x.limInt))) return;
      const c = x.c, pz = M.habilesEntre(x.base, x.limInt);
      const e = { ref: 'Informe del caso N° ' + c.nro, fecha: ymd(x.base), trabajador: c.nombre };
      if (x.fi && x.fuente !== 'cierre sin informe') {
        e.ok = x.fi <= x.limInt; den++; if (e.ok) num++;
        e.detalle = 'Subido el ' + dm(ymd(x.fi)) + ' · plazo interno ' + pz + ' días (hasta el ' + dm(ymd(x.limInt)) + ')' + (e.ok ? '' : ' → fuera de plazo');
      } else if (!x.fi && hoy > x.limInt) {
        e.ok = false; den++;
        e.detalle = 'Sin informe · el plazo interno (' + pz + ' días) venció el ' + dm(ymd(x.limInt));
      } else return;
      ev.push(e);
    });
    return { estado: den ? 'ok' : 'sin_datos', num, den, evidencia: ev, fuera_horario: r.fuera };
  }

  function k3(p, u, desde, etiNombre) {
    const ev = []; let num = 0, den = 0;
    const progs = ((E.eti && E.eti.programaciones) || []).filter(g => esPersonaEti(g.supervisor, p, u.nombre, etiNombre));
    progs.forEach(g => {
      const tema = String(g.tema || '').toUpperCase().trim();
      const opcional = tema === TEMA_OPCIONAL;
      if (!opcional && TEMAS_ETI.indexOf(tema) < 0) return;
      const fechas = (g.fechas || []).slice().sort();
      const ejec = new Set(g.fechas_ejecutadas || []);
      const reg = g.registro_id && E.eti.registros ? E.eti.registros[g.registro_id] : null;
      const fReg = reg && reg.fecha_ejecucion ? String(reg.fecha_ejecucion).slice(0, 10) : (g.ejecutada_en ? String(g.ejecutada_en).slice(0, 10) : '');
      const fin = fechas[fechas.length - 1] || '';
      const sustento = g.veces_reprog > 0 ? 'Reprogramada ' + g.veces_reprog + ' vez(es): ' + (g.reprogramaciones || []).map(r => (r.motivo || '') + (r.fecha ? ' el ' + dm(String(r.fecha).slice(0, 10)) : '') + (r.registradoPor ? ' por ' + r.registradoPor : '')).join(' · ') : '';
      const sols = (g.solicitudes || []);
      sols.forEach(sl => {   /* el responsable informo que no se hizo y pide reprogramar -> aviso al administrador */
        if (String(sl.estado).toUpperCase() === 'PENDIENTE') avisos.push({ clave: 'sol:' + g.id + ':' + (sl.id || sl.fecha), codigo: 'K3', tipo: 'SOLICITUD',
          mensaje: 'Solicita reprogramar ' + tema + ' (' + (g.sector || '') + ') de las fechas ' + (sl.fechas || []).map(dm).join(', ') + '. Motivo: ' + (sl.motivo || '') + (sl.detalle ? ' — ' + sl.detalle : '') + '. Asigna la nueva fecha en ETI.' });
      });
      const solDe = (f) => { let r = null; sols.forEach(sl => { if ((sl.fechas || []).indexOf(f) >= 0) r = sl; }); return r; };
      fechas.forEach(f => {
        if (f < desde || !enR(f)) return;
        const e = { ref: tema + ' · ' + (g.sector || ''), fecha: f, prog: g.id };
        /* _IND_FIX_V1: programada en dias de AUSENCIA con reemplazo y no ejecutada -> no cuenta para el titular */
        const _aus = M.AUS && M.AUS.ausencia ? M.AUS.ausencia(u, f) : null, _rmp = _aus && M.AUS.reemp(_aus);
        if (_rmp && !ejec.has(f) && g.estado !== 'ejecutada') {
          e.ok = null; e.detalle = 'Programada el ' + dm(f) + ' durante su ausencia (' + String(_aus.tipo || 'ausencia').toLowerCase() + '; reemplazo: ' + (_rmp.nombre || _rmp.usuario) + '). No cuenta para su KPI.';
          ev.push(e); return;
        }
        if (sustento) e.sustento = sustento;
        const hecha = ejec.has(f) || (g.estado === 'ejecutada' && f <= hoyS);   /* _IND_FIX_V1: el estado global no da por hechas fechas futuras */
        if (hecha) {
          const tarde = !ejec.has(f) && fReg && fReg > fin;
          e.ok = !tarde;
          e.detalle = tarde ? 'Programada el ' + dm(f) + ', ejecutada recién el ' + dm(fReg) + ' (fuera de la fecha programada)' : 'Programada el ' + dm(f) + ' · ejecutada' + (fReg ? ' (registro del ' + dm(fReg) + ')' : '');
          if (opcional) e.detalle += ' · reforzamiento (opcional)';
          den++; if (e.ok) num++;
        } else if (f < hoyS) {
          if (opcional) { e.ok = null; e.detalle = 'Reforzamiento del ' + dm(f) + ' no realizado: es opcional, no suma ni resta.'; }
          else {
            e.ok = false; den++;
            e.detalle = 'Programada el ' + dm(f) + ' y no registrada como ejecutada' + (sustento ? '' : ' (sin reprogramación)');
            const sl = solDe(f);
            if (sl) e.detalle += String(sl.estado).toUpperCase() === 'PENDIENTE'
              ? ' · el ' + dm(String(sl.fecha).slice(0, 10)) + ' informó el motivo (' + (sl.motivo || '') + ') y pidió reprogramar: cuenta como no ejecutada hasta que el administrador asigne la nueva fecha'
              : ' · informó el motivo (' + (sl.motivo || '') + ')';
            avisos.push({ clave: 'venc:eti:' + g.id + ':' + f, codigo: 'K3', tipo: 'VENCIDO',
              mensaje: tema + ' programada el ' + dm(f) + ' (' + (g.sector || '') + ') no fue registrada como ejecutada.' });
          }
        } else {
          e.ok = null; e.pendiente = true; e.detalle = 'Programada para el ' + dm(f) + (f === hoyS ? ' (HOY)' : '');
          if (!opcional && M.habilesEntre(hoy, aFecha(f)) <= 1) avisos.push({ clave: 'prev:eti:' + g.id + ':' + f, codigo: 'K3', tipo: 'PREVENTIVA',
            mensaje: tema + ' programada para ' + (f === hoyS ? 'HOY' : 'mañana') + ' (' + dm(f) + ', ' + (g.sector || '') + ').' });
        }
        ev.push(e);
      });
    });
    ev.sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
    return { estado: den ? 'ok' : 'sin_datos', num, den, evidencia: ev };
  }

  function k4(p) {
    const n = E.notas && E.notas[usr(p.usuario)];
    if (n && n.nota !== null && n.nota !== undefined && n.nota !== '') {
      const v = +n.nota;
      return { estado: 'ok', num: v, den: 20, pct: v / 20, nivel: nivelNota(v), nota_curso: v,
        evidencia: [{ ref: 'Curso de Legislación Laboral', fecha: n.fecha || '', ok: v >= 15,
          detalle: 'Nota ' + v + (v >= 15 ? ' (aprobado)' : ' (desaprobado, mínimo 15)') + (n.constancia ? ' · constancia adjunta' : '') + (n.por ? ' · registrado por ' + n.por : ''), constancia: n.constancia || '' }] };
    }
    return { estado: hoyS < PERIODO.curso_desde ? 'pendiente' : 'sin_datos', num: 0, den: 0, evidencia: [],
      nota_def: 'Se registra la nota del curso en diciembre de 2026, con la constancia adjunta.' };
  }

  function a1(ats) {
    const ev = [], r = mismoDia(ats, ev);
    return { estado: r.den ? 'ok' : 'sin_datos', num: r.num, den: r.den, evidencia: ev, fuera_horario: r.fuera };
  }

  function a3(ats) {
    const ev = []; let num = 0, den = 0, pend = 0;
    ats.forEach(a => {
      const f = String(a.fecha_atencion).slice(0, 10), est = String(a.estado || '').toUpperCase();
      if (!enR(f)) return;
      if (est.indexOf('FINALIZ') === 0 || est.indexOf('DERIV') === 0 || est.indexOf('ATENDID') === 0) { num++; den++; return; }
      const d = M.habilesEntre(aFecha(f), hoy);
      if (d > DIAS_CONSULTA) { den++; ev.push({ ref: 'Atención N° ' + a.nro + ' (' + a.anio + ')', fecha: f, trabajador: a.nombre, ok: false,
        detalle: 'Sigue "' + (a.estado || 'EN PROCESO') + '" desde el ' + dm(f) + ' (' + d + ' días hábiles)' }); }
      else pend++;
    });
    if (den) ev.unshift({ ref: 'Consultas atendidas o derivadas', ok: true, resumen: true, detalle: num + ' de ' + den + ' consultas cerradas (FINALIZADO / derivadas).' });
    if (pend) ev.push({ ref: 'Consultas recientes', ok: null, resumen: true, detalle: pend + ' consulta(s) en proceso dentro de los ' + DIAS_CONSULTA + ' días hábiles: aún no cuentan.' });
    return { estado: den ? 'ok' : 'sin_datos', num, den, evidencia: ev };
  }
}

module.exports = { calcular, fechaDeUrl, HORA_CIERRE, nivelPct, nivelNota, esPersona, esPersonaEti, PERIODO, DEF, PERSONAS, VISORES, EDITORES, TEMAS_ETI, TEMA_OPCIONAL };
