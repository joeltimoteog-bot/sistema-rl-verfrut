/* _KPI_RRLL_V1 (30-set-2026): prueba del motor de KPIs RR.LL. -> node tools/prueba_kpis.js */
const assert = require('assert');
const { crearMotor } = require('../azure/functions/shared/cumpl-motor');
const K = require('../azure/functions/shared/kpi-motor');
const usuarios = [
  { usuario: 'ptamayo', nombre: 'POOL WILFREDO TAMAYO RODRIGUEZ', activo: true },
  { usuario: 'yluzon', nombre: 'YHANELLY GERALDENY LUZON VENEGAS', activo: true },
  { usuario: 'smiranda', nombre: 'SOCORRO DEL PILAR MIRANDA PASAPERA', activo: true },
  { usuario: 'fzapata', nombre: 'ALEX FABIAN ZAPATA SUAREZ', activo: true },
  { usuario: 'almartinez', nombre: 'ALEXANDER MARTINEZ JUAREZ', activo: true },
];
const aus = [{ id: 'a1', usuario: 'yluzon', nombre: 'YHANELLY', tipo: 'DESCANSO MEDICO', desde: '2026-09-15', hasta: '2026-09-30', reemplazo: 'smiranda' }];
const cfg = { dias: '1,2,3,4,5', feriados: '2026-10-08', plazo_investigacion: 3, plazo_documentos: 7, plazo_cierre: 10, aviso_proximo_dias: 2, critico_dias: 5,
  raw: { ausencias: JSON.stringify(aus), plazos_historial: JSON.stringify([{ clave: 'plazo_investigacion', valor: 5, hasta: '2026-09-28', cambio: '2026-09-29', por: 'jtimoteo' }]) } };
const C = (nro, sup, rep, extra) => Object.assign({ nro, fecha_registro: rep, fecha_reporte: rep, supervisor: sup, registrado_por: '', nombre: 'TRAB ' + nro,
  empresa: 'RAPEL', motivo: 'X', motivo_extra: '', estado: 'EN PROCESO', estado_gestion: 'EN PROCESO', enlace_informe: '', enlace_reporte: '', fecha_cierre: '' }, extra || {});
const casos = [
  C(1, 'POOL WILFREDO TAMAYO RODRIGUEZ', '2026-09-01', { enlace_informe: 'http://x' }),   // informe 03/09 -> 2 habiles ⭐
  C(2, 'POOL WILFREDO TAMAYO RODRIGUEZ', '2026-09-07', { enlace_informe: 'http://x' }),   // informe 11/09 -> 4 habiles ok sin estrella
  C(3, 'POOL WILFREDO TAMAYO RODRIGUEZ', '2026-09-14', { enlace_informe: 'http://x' }),   // informe 23/09 -> 7 habiles NO
  C(4, 'POOL WILFREDO TAMAYO RODRIGUEZ', '2026-09-16'),                                    // sin informe, vence 23/09 -> vencido
  C(5, 'POOL WILFREDO TAMAYO RODRIGUEZ', '2026-09-28'),                                    // sin informe, vence 05/10 -> pendiente
  C(6, 'POOL WILFREDO TAMAYO RODRIGUEZ', '2026-08-20', { enlace_informe: 'http://x' }),   // informe sin fecha -> excluido
  C(7, 'YHANELLY GERALDENY LUZON VENEGAS', '2026-09-17'),                                   // durante ausencia -> excluido de yluzon
  C(8, 'YHANELLY GERALDENY LUZON VENEGAS', '2026-09-08', { enlace_informe: 'http://x' }), // informe 10/09 ok
  C(9, 'POOL WILFREDO TAMAYO RODRIGUEZ', '2026-07-20', { enlace_informe: 'http://x' }),   // fuera de periodo
  C(10, 'POOL WILFREDO TAMAYO RODRIGUEZ', '2026-09-29', { enlace_informe: 'http://x' }),  // plazo interno 3: informe 02/10 -> 3 habiles ok ⭐
];
const informes = { 1: { fecha: '2026-09-03' }, 2: { fecha: '2026-09-11' }, 3: { fecha: '2026-09-23' }, 8: { fecha: '2026-09-10' }, 9: { fecha: '2026-07-21' }, 10: { fecha: '2026-10-02' } };
const D = { casos, config: cfg, usuarios, sups: [], restricc: [], constantes: {}, visitas: [] };
const m = crearMotor(D);
const ats = [
  { anio: 2026, nro: 1, fecha_atencion: '2026-09-02', usuario_sistema: 'ptamayo', fecha_registro: '2026-09-02 10:00', estado: 'FINALIZADO', nombre: 'A' },
  { anio: 2026, nro: 2, fecha_atencion: '2026-09-02', usuario_sistema: 'ptamayo', fecha_registro: '2026-09-04 10:00', estado: 'FINALIZADO', nombre: 'B' },
  { anio: 2026, nro: 3, fecha_atencion: '2026-09-03', usuario_sistema: 'ptamayo', fecha_registro: null, estado: 'FINALIZADO', nombre: 'C' },
  { anio: 2026, nro: 4, fecha_atencion: '2026-09-10', usuario_sistema: 'smiranda', fecha_registro: '2026-09-10 08:00', estado: 'FINALIZADO', nombre: 'D' },
  { anio: 2026, nro: 5, fecha_atencion: '2026-09-10', usuario_sistema: 'smiranda', fecha_registro: '2026-09-11 08:00', estado: 'EN PROCESO', nombre: 'E' },
  { anio: 2026, nro: 6, fecha_atencion: '2026-10-01', usuario_sistema: 'smiranda', fecha_registro: '2026-10-01 08:00', estado: 'EN PROCESO', nombre: 'F' },
];
const eti = { registros: { r1: { fecha_ejecucion: '2026-09-09' }, r2: { fecha_ejecucion: '2026-09-25' } }, programaciones: [
  { id: 'p1', supervisor: 'POOL TAMAYO RODRIGUEZ', sector: 'LIMONES', tema: 'CAPACITACIONES ETI', fechas: ['2026-09-08', '2026-09-09'], fechas_ejecutadas: [], estado: 'ejecutada', registro_id: 'r1' },
  { id: 'p2', supervisor: 'POOL TAMAYO RODRIGUEZ', sector: 'LIMONES', tema: 'EVALUACIONES DE CHECKLIST', fechas: ['2026-09-21', '2026-09-22'], fechas_ejecutadas: ['2026-09-21'], estado: 'pendiente' },
  { id: 'p3', supervisor: 'POOL TAMAYO RODRIGUEZ', sector: 'LIMONES', tema: 'REFORZAMIENTO', fechas: ['2026-09-24'], fechas_ejecutadas: [], estado: 'pendiente' },
  { id: 'p4', supervisor: 'POOL TAMAYO RODRIGUEZ', sector: 'LIMONES', tema: 'CAPACITACIONES ETI', fechas: ['2026-09-15'], fechas_ejecutadas: [], estado: 'ejecutada', registro_id: 'r2' },
  { id: 'p5', supervisor: 'POOL TAMAYO RODRIGUEZ', sector: 'LIMONES', tema: 'CAPACITACIONES ETI', fechas: ['2026-10-02'], fechas_ejecutadas: [], estado: 'pendiente', veces_reprog: 1, reprogramaciones: [{ motivo: 'LLUVIA', registradoPor: 'Joel' }] },
  { id: 'p6', supervisor: 'ALEX ZAPATA JUAREZ', sector: 'APROA', tema: 'CAPACITACIONES ETI', fechas: ['2026-09-10'], fechas_ejecutadas: [], estado: 'pendiente' },
]};
const r = K.calcular({ M: m._kpi, personas: K.PERSONAS, informes, atenciones: ats, eti, notas: { fzapata: { nota: 16, constancia: 'http://c' } }, hoy: '2026-10-01' });
const P = u => r.personas.find(p => p.usuario === u), KP = (u, c) => P(u).kpis.find(k => k.codigo === c);
const pt = P('ptamayo'), k1 = KP('ptamayo', 'K1');
console.log('K1 ptamayo', k1.num, '/', k1.den, k1.nivel, 'estrellas', k1.estrellas);
k1.evidencia.forEach(e => console.log('   ', e.ref, e.ok, e.detalle));
assert.equal(k1.num, 3); assert.equal(k1.den, 5); assert.equal(k1.estrellas, 2);   // 1,2,10 ok; 3,4 no; 5 pend; 6 excl
const k2 = KP('ptamayo', 'K2'); console.log('K2 ptamayo', k2.num, '/', k2.den); k2.evidencia.forEach(e => console.log('   ', e.ref, e.ok, e.detalle));
// atenciones: 1 ok, 2 no (sin hora excl) ; informes: 1 (limInt 5 hasta 08/09) ok, 2 (limInt 5 -> 14/09) ok, 3 (hasta 21/09) no, 4 sin informe vencido (limInt 23/09) no, 10 (3 dias hasta 02/10) ok, 5 (limInt 3 -> 01/10 hoy) not passed -> skip
assert.equal(k2.num, 1 + 3); assert.equal(k2.den, 2 + 5);
const k3 = KP('ptamayo', 'K3'); console.log('K3 ptamayo', k3.num, '/', k3.den); k3.evidencia.forEach(e => console.log('   ', e.fecha, e.ok, e.detalle, e.sustento || ''));
// p1: 2 fechas ok; p2: 21 ok, 22 no; p3: opcional no hecho -> excl; p4: ejecutado 25/09 > 15/09 -> tarde (no); p5 pendiente
assert.equal(k3.num, 3); assert.equal(k3.den, 5);
assert.equal(KP('ptamayo', 'K4').estado, 'pendiente');
const yl = KP('yluzon', 'K1'); console.log('K1 yluzon', yl.num, '/', yl.den); yl.evidencia.forEach(e => console.log('   ', e.ref, e.ok, e.detalle));
assert.equal(yl.den, 1); assert.equal(yl.num, 1);
const fz = P('fzapata'); console.log('fzapata K3', KP('fzapata', 'K3').num, '/', KP('fzapata', 'K3').den, 'K4', KP('fzapata', 'K4').nivel, 'nota', fz.nota);
assert.equal(KP('fzapata', 'K3').den, 1); assert.equal(KP('fzapata', 'K3').num, 0); assert.equal(KP('fzapata', 'K4').nivel, 3);
assert.equal(KP('almartinez', 'K3').den, 0);   // no toma la programacion de ALEX ZAPATA JUAREZ
const sm = P('smiranda'); console.log('smiranda', sm.kpis.map(k => k.codigo + ':' + k.estado + ':' + k.num + '/' + k.den).join(' '), 'nota', sm.nota);
assert.equal(KP('smiranda', 'A1').num, 2); assert.equal(KP('smiranda', 'A1').den, 3);
assert.equal(KP('smiranda', 'A3').estado, 'en_evaluacion'); assert.equal(KP('smiranda', 'A3').calc_num, 1); assert.equal(KP('smiranda', 'A3').calc_den, 2);
console.log('avisos', r.avisos.map(a => a.clave).join(' | '));
console.log('niveles', K.nivelPct(1,.95), K.nivelPct(.98,.95), K.nivelPct(.95,.95), K.nivelPct(.9,.95), K.nivelPct(.899,.95), K.nivelPct(.95,.9), K.nivelPct(.9,.9), K.nivelPct(.85,.9), K.nivelPct(.849,.9));
console.log('notas', [10,12,14.9,15,18,20].map(K.nivelNota).join(','));
console.log('✅ motor OK');
/* ── enlace exacto con la cuenta ETI + solicitud de reprogramacion ── */
{
  const eti2 = { registros: {}, supervisores: [{ nombre: 'ALEX ZAPATA JUAREZ', sector: 'SECTOR APROA' }, { nombre: 'POOL TAMAYO RODRIGUEZ', sector: 'LIMONES' }, { nombre: 'POOL TAMAYO RODRIGUEZ', sector: 'EL PAPAYO' }],
    usuarios: { fzapata: { nombre: 'ALEX ZAPATA JUAREZ', estado: 'activo' }, ptamayo: { nombre: 'POOL TAMAYO RODRIGUEZ', estado: 'activo' } },
    programaciones: [
      { id: 'z1', supervisor: 'ALEX ZAPATA JUAREZ', sector: 'APROA', tema: 'CAPACITACIONES ETI', fechas: ['2026-09-10'], estado: 'pendiente',
        solicitudes: [{ id: 's1', estado: 'PENDIENTE', motivo: 'LLUVIA', detalle: 'no se pudo', fechas: ['2026-09-10'], fecha: '2026-09-11T10:00:00Z' }] },
      { id: 'z2', supervisor: 'ALEX ZAPATA SUAREZ', sector: 'APROA', tema: 'CAPACITACIONES ETI', fechas: ['2026-09-12'], estado: 'pendiente' },   // otro nombre: con cuenta ETI no se toma
      { id: 'z3', supervisor: 'ALEX ZAPATA JUAREZ', sector: 'APROA', tema: 'INGRESOS MASIVOS', fechas: ['2026-09-20'], fechas_ejecutadas: ['2026-09-20'], estado: 'pendiente' },
      { id: 'z4', supervisor: 'ALEX ZAPATA JUAREZ', sector: 'APROA', tema: 'EVALUACIONES DE CHECKLIST', fechas: ['2026-10-05'], estado: 'pendiente', veces_reprog: 1,
        reprogramaciones: [{ motivo: 'LLUVIA', registradoPor: 'Joel', fecha: '2026-09-12T00:00:00Z', antes: ['2026-09-10'], despues: ['2026-10-05'] }] } ] };
  const r2 = K.calcular({ M: m._kpi, personas: K.PERSONAS, informes, atenciones: ats, eti: eti2, notas: {}, hoy: '2026-10-01' });
  const z = r2.personas.find(p => p.usuario === 'fzapata'), k3z = z.kpis.find(k => k.codigo === 'K3');
  console.log('fzapata K3', k3z.num, '/', k3z.den, 'enlace', JSON.stringify(z.enlace)); k3z.evidencia.forEach(e => console.log('   ', e.fecha, e.ok, e.detalle, e.sustento || ''));
  assert.equal(k3z.den, 2); assert.equal(k3z.num, 1);   // z1 no (con solicitud), z3 si, z4 futura (reprogramada) -> no cuenta, z2 no es de el
  assert.ok(/pidió reprogramar/.test(k3z.evidencia.find(e => e.prog === 'z1').detalle));
  assert.ok(r2.avisos.some(a => a.tipo === 'SOLICITUD' && a.usuario === 'fzapata'));
  assert.equal(z.enlace.eti_activa, true); assert.deepEqual(z.enlace.eti_sectores, ['SECTOR APROA']); assert.equal(z.enlace.programaciones, 3);
  const pt2 = r2.personas.find(p => p.usuario === 'ptamayo'); assert.equal(pt2.enlace.eti_sectores.length, 2);
  const jb = r2.personas.find(p => p.usuario === 'jborrero'); assert.equal(jb.enlace.eti_cuenta, false);
  console.log('✅ enlace ETI y solicitudes OK');
}
/* ── fecha del informe desde el nombre del archivo en Azure Blob ── */
{
  const ms = Date.UTC(2026, 8, 3, 15, 0, 0);   // 03/09 10:00 Lima
  assert.equal(K.fechaDeUrl('https://sistemarlverfrut.blob.core.windows.net/casos-rl/casos/' + ms + '_informe.pdf'), '2026-09-03');
  assert.equal(K.fechaDeUrl('https://sistemarlverfrut.blob.core.windows.net/casos-rl/casos/' + Date.UTC(2026, 8, 4, 3, 0, 0) + '_x.pdf'), '2026-09-03');   // 22:00 Lima del 03
  assert.equal(K.fechaDeUrl('https://drive.google.com/file/d/abc'), '');
  const D3 = { casos: [C(71, 'POOL WILFREDO TAMAYO RODRIGUEZ', '2026-09-01', { enlace_informe: 'https://sistemarlverfrut.blob.core.windows.net/casos-rl/casos/' + ms + '_i.pdf' })], config: cfg, usuarios, sups: [], restricc: [], constantes: {}, visitas: [] };
  const r3 = K.calcular({ M: crearMotor(D3)._kpi, personas: K.PERSONAS, informes: { 71: { fecha: '2026-09-27', fuente: 'registro de Azure' } }, atenciones: [], eti: { programaciones: [], registros: {} }, notas: {}, hoy: '2026-10-01' });
  const e = r3.personas.find(p => p.usuario === 'ptamayo').kpis[0].evidencia[0];
  assert.equal(e.ok, true); assert.ok(e.estrella);   // manda la hora real de subida (03/09), no la del registro posterior
  console.log('✅ fecha real de subida del informe OK:', e.detalle);
}
/* ── atencion de sabado registrada el lunes = cumple ── */
{
  const at2 = [{ anio: 2026, nro: 90, fecha_atencion: '2026-08-01', usuario_sistema: 'atineo', fecha_registro: '2026-08-03 08:10', estado: 'FINALIZADO', nombre: 'S' },
               { anio: 2026, nro: 91, fecha_atencion: '2026-08-01', usuario_sistema: 'atineo', fecha_registro: '2026-08-04 08:10', estado: 'FINALIZADO', nombre: 'S2' },
               { anio: 2026, nro: 92, fecha_atencion: '2026-08-11', usuario_sistema: 'atineo', fecha_registro: '2026-08-12 09:00', estado: 'FINALIZADO', nombre: 'M' }];
  const r4 = K.calcular({ M: m._kpi, personas: K.PERSONAS, informes: {}, atenciones: at2, eti: { programaciones: [], registros: {} }, notas: {}, hoy: '2026-10-01' });
  const k = r4.personas.find(p => p.usuario === 'atineo').kpis.find(x => x.codigo === 'K2');
  console.log('sabado->lunes', k.num, '/', k.den, k.evidencia.filter(e => e.ok === false).map(e => e.detalle).join(' | '));
  assert.equal(k.num, 1); assert.equal(k.den, 3);
  console.log('✅ regla de dia no laborable OK');
}
/* ── cierre de la jornada 16:36 ── */
{
  const at3 = [
    { anio: 2026, nro: 1, fecha_atencion: '2026-09-02', hora_inicio: '09:00', usuario_sistema: 'atineo', fecha_registro: '2026-09-02 16:30', nombre: 'a' },   // si
    { anio: 2026, nro: 2, fecha_atencion: '2026-09-02', hora_inicio: '09:00', usuario_sistema: 'atineo', fecha_registro: '2026-09-02 16:37', nombre: 'b' },   // no: despues del cierre
    { anio: 2026, nro: 3, fecha_atencion: '2026-09-02', hora_inicio: '17:10', usuario_sistema: 'atineo', fecha_registro: '2026-09-03 08:00', nombre: 'c' },   // si: atendida despues del cierre -> dia siguiente
    { anio: 2026, nro: 4, fecha_atencion: '2026-09-05', hora_inicio: '10:00', usuario_sistema: 'atineo', fecha_registro: '2026-09-07 16:00', nombre: 'd' },   // si: sabado -> lunes
    { anio: 2026, nro: 5, fecha_atencion: '2026-09-05', hora_inicio: '10:00', usuario_sistema: 'atineo', fecha_registro: '2026-09-07 17:00', nombre: 'e' },   // no
    { anio: 2026, nro: 6, fecha_atencion: '2026-09-03', hora_inicio: '09:00', usuario_sistema: 'atineo', fecha_registro: '2026-09-04 08:00', nombre: 'f' } ]; // no
  const r5 = K.calcular({ M: m._kpi, personas: K.PERSONAS, informes: {}, atenciones: at3, eti: { programaciones: [], registros: {} }, notas: {}, hoy: '2026-10-01' });
  const k = r5.personas.find(p => p.usuario === 'atineo').kpis.find(x => x.codigo === 'K2');
  k.evidencia.filter(e => e.ok === false).forEach(e => console.log('   ', e.ref, e.detalle));
  assert.equal(k.num, 3); assert.equal(k.den, 6);
  console.log('✅ cierre de jornada 16:36 OK');
}
