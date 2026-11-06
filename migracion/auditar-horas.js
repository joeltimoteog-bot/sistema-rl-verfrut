/* auditar-horas.js — SOLO LECTURA (06-nov-2026). Revisa Acumulación de Horas con los datos REALES de Supabase
   (rl.horas_registros + rl.horas_horarios) y lista los registros que salen mal calculados. No cambia nada.
   Uso:  cd C:\sistema-rl-verfrut\migracion ; node auditar-horas.js
   Deja el detalle en migracion\revision-horas.csv (abre con Excel). */
'use strict';
const fs = require('fs'), path = require('path'); const PG = require('pg'), { Client } = PG;
PG.types.setTypeParser(1114, s => s == null ? null : new Date(String(s).replace(' ', 'T') + 'Z'));   /* fechas guardadas en UTC sin zona: leerlas como UTC */
const ENV = path.join(__dirname, '.env');
const m = fs.existsSync(ENV) && fs.readFileSync(ENV, 'utf8').match(/^\s*SUPABASE_DB_URL\s*=\s*(\S+)/m);
const URL = process.env.AUDIT_DB_URL || (m && m[1].replace(/^"|"$/g, ''));
if (!URL) { console.error('Falta SUPABASE_DB_URL en migracion\\.env'); process.exit(1); }
const r2 = n => Math.round(n * 100) / 100, L = t => console.log(t);
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
const PLANILLA = { '03209092': 2 };
const dni8 = d => { let s = String(d == null ? '' : d).replace(/\.0+$/, '').replace(/\D/g, ''); while (s && s.length < 8) s = '0' + s; return s; };
/* fecha (timestamp guardado en UTC) -> 'yyyy-mm-dd' de Lima */
function ymd(t) { if (!t) return ''; const x = new Date(new Date(t).getTime() - 5 * 3600e3); return isNaN(x) ? '' : x.toISOString().slice(0, 10); }
/* hora de Google (fecha 1899 con huso historico de Lima -5:08:12, o actual -5:00) -> minutos del dia */
function minutos(t) {
  if (!t) return -1; const ms = new Date(t).getTime(); if (isNaN(ms)) return -1;
  for (const off of [5 * 3600e3, (5 * 3600 + 8 * 60 + 12) * 1e3, (5 * 3600 + 8 * 60) * 1e3]) {
    const x = ((ms - off) % 86400e3 + 86400e3) % 86400e3; if (x % 60000 === 0) return x / 60000;
  }
  return Math.round(((ms - 5 * 3600e3) % 86400e3 + 86400e3) % 86400e3 / 60000);
}
(async () => {
  const c = new Client({ connectionString: URL, ssl: /localhost|127\.0\.0\.1/.test(URL) ? false : { rejectUnauthorized: false } }); await c.connect();
  const HC = (await c.query('SELECT * FROM rl.horas_horarios ORDER BY fila')).rows;
  const EST = (await c.query("SELECT clave::text, filas, marca::text, (actualizado AT TIME ZONE 'UTC' AT TIME ZONE 'America/Lima')::text lima FROM rl.th_estado WHERE clave::text LIKE 'horas%' ORDER BY 1")).rows;
  L('=== TABLA DE HORARIOS EN SUPABASE (rl.horas_horarios): ' + HC.length + ' fila(s) ===');
  HC.slice(0, 10).forEach(h => L('   fila ' + h.fila + ' · desde ' + h.desde + ' · hasta ' + h.hasta + ' · L-V ' + h.lv_entrada + ' a ' + h.lv_salida + ' ref ' + h.lv_refrig_min + ' · sab ' + h.sab_entrada + ' a ' + h.sab_salida + ' · otros ' + String(h.otros || '').slice(0, 160)));
  L('   cargas: ' + EST.map(e => e.clave + ' ' + e.filas + ' filas (' + String(e.lima || '').slice(0, 16) + ')').join(' · ') + '\n');
  const H = HC.slice().sort((x, y) => (y.desde || 0) - (x.desde || 0)).map(h => ({
    desde: ymd(h.desde), hasta: ymd(h.hasta), lvE: minutos(h.lv_entrada), lvS: minutos(h.lv_salida), lvR: Number(h.lv_refrig_min) || 0,
    sbE: minutos(h.sab_entrada), sbS: minutos(h.sab_salida), sbR: Number(h.sab_refrig_min) || 0 })).filter(h => h.desde);
  const vig = f => H.find(h => f >= h.desde && (!h.hasta || f <= h.hasta)) || null;
  const netas = (e, s, ref) => (e < 0 || s < 0 || s <= e) ? 0 : Math.max(0, r2((s - e - ref) / 60));
  function jornadaDia(f) {
    const p = f.split('-'), dw = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay(); if (dw === 0) return 0;
    const v = vig(f); if (v) return dw === 6 ? netas(v.sbE, v.sbS, v.sbR) : netas(v.lvE, v.lvS, v.lvR);
    const mo = +p[1]; if (mo <= 5) return dw <= 5 ? 9.6 : 0; return dw <= 5 ? 8.75 : (dw === 6 ? 5.75 : 0);
  }
  function refDia(f) { const p = f.split('-'), dw = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay(); const v = vig(f); return v ? (dw === 6 ? v.sbR : v.lvR) : (dw === 6 ? 0 : 45); }

  const R = (await c.query('SELECT * FROM rl.horas_registros ORDER BY fecha_registro, fila')).rows;
  const SOLO = (process.argv[2] || '').replace(/\D/g, '');
  if (SOLO) {   /* historial de un trabajador, paso a paso, en el orden en que se registro */
    let ac = 0, pe = 0, de = 0;
    L('=== HISTORIAL ' + dni8(SOLO) + ' (orden de registro) ===');
    L('registrado        dia trabajo  motivo                    trab  jorn   acum   perm  deuda  | saldo antes -> despues  estado  id');
    for (const r of R) {
      if (dni8(r.dni) !== dni8(SOLO)) continue;
      const rech = norm(r.estado) === 'rechazado', antes = r2(ac - pe - de);
      if (!rech) { ac += +r.horas_acumuladas || 0; pe += +r.horas_permiso || 0; de += +r.horas_deuda || 0; }
      const f = x => String(r2(+x || 0)).padStart(6);
      L(String(r.fecha_registro ? new Date(r.fecha_registro).toISOString().slice(0, 16).replace('T', ' ') : '').padEnd(17) + ' ' + ymd(r.fecha_entrada).padEnd(12) + ' ' + String(r.motivo || '').slice(0, 24).padEnd(24) + f(r.horas_trabajadas) + f(r.jornada_esperada) + f(r.horas_acumuladas) + f(r.horas_permiso) + f(r.horas_deuda) + '  | ' + String(antes).padStart(7) + ' -> ' + String(r2(ac - pe - de)).padStart(7) + '  ' + String(r.estado || '').padEnd(9) + ' ' + r.id + (rech ? ' (RECHAZADO, no cuenta)' : ''));
    }
    L('TOTAL acum ' + r2(ac) + ' · permiso ' + r2(pe) + ' · deuda ' + r2(de) + ' · SALDO ' + r2(ac - pe - de));
    await c.end(); return;
  }
  const hallazgos = [], porDni = {};
  const add = (r, tipo, detalle, efecto) => hallazgos.push({ tipo, id: String(r.id), dni: dni8(r.dni), nombre: String(r.nombre || ''), fecha: ymd(r.fecha_entrada), motivo: String(r.motivo || ''),
    trab: r2(+r.horas_trabajadas || 0), jornada: r2(+r.jornada_esperada || 0), acum: r2(+r.horas_acumuladas || 0), perm: r2(+r.horas_permiso || 0), deuda: r2(+r.horas_deuda || 0), detalle, efecto: r2(efecto || 0) });
  const conteoMot = {}; let legado = 0;
  for (const r of R) {
    if (norm(r.estado) === 'rechazado') continue;
    const mot = norm(r.motivo), d = dni8(r.dni), fe = ymd(r.fecha_entrada), fs = ymd(r.fecha_salida) || fe;
    conteoMot[r.motivo] = (conteoMot[r.motivo] || 0) + 1;
    const trab = r2(+r.horas_trabajadas || 0), jor = r2(+r.jornada_esperada || 0), acum = r2(+r.horas_acumuladas || 0), perm = r2(+r.horas_permiso || 0), deuda = r2(+r.horas_deuda || 0);
    const S = porDni[d] = porDni[d] || { nombre: r.nombre, acum: 0, perm: 0, deuda: 0, acumPlanilla: [], devPlanilla: 0 };
    const saldoAntes = r2(S.acum - S.perm - S.deuda);
    const he = minutos(r.hora_entrada), hs = minutos(r.hora_salida);
    let presencia = null;
    if (fe && he >= 0 && hs >= 0) { const dias = fs && fs !== fe ? Math.round((Date.parse(fs) - Date.parse(fe)) / 864e5) : 0; presencia = r2((dias * 1440 + hs - he) / 60); }

    if (mot === 'acumulacion' && fe) {
      /* 1) acumuladas = trabajadas - jornada */
      const esperado = trab > jor ? r2(trab - jor) : 0;
      if (trab === 0 && acum > 0) { S.manual = (S.manual || 0) + 1; legado++; }
      else if (Math.abs(esperado - acum) > 0.011) add(r, 'ACUM_NO_CUADRA', 'acumuladas ' + acum + ' pero trabajadas ' + trab + ' - jornada ' + jor + ' = ' + esperado, esperado - acum);
      /* 2) trabajadas sin descontar el refrigerio (periodo 22-ago a 28-oct) */
      const ref = refDia(fe);
      if (presencia != null && presencia >= 5 && ref > 0 && Math.abs(presencia - trab) < 0.02)
        add(r, 'REFRIGERIO_NO_DESCONTADO', 'en planta ' + presencia + ' h y se tomaron como trabajadas ' + trab + ' h (falta restar ' + ref + ' min de refrigerio)', -Math.min(acum, r2(ref / 60)));
      /* 3) jornada guardada distinta a la del horario de ese dia */
      const jReal = (presencia != null && presencia > 0 && presencia < 24 && fs !== fe) ? jornadaDia(fe) : (fs && fs !== fe ? 0 : jornadaDia(fe));
      if (H.length && trab > 0 && fs === fe && Math.abs(jReal - jor) > 0.011) add(r, 'JORNADA_DISTINTA_AL_HORARIO', 'jornada guardada ' + jor + ' h, el horario de ese dia da ' + jReal + ' h', (jor - jReal));
      if (PLANILLA[d] && acum > 0) S.acumPlanilla.push({ id: String(r.id), fecha: fe, acum, devolver: Math.min(PLANILLA[d], acum) });
    }
    if (mot === 'permiso' && fe && fs === fe) {
      const j = jornadaDia(fe);
      if (H.length && perm + deuda > j + 0.011 && j > 0) add(r, 'PERMISO_MAYOR_A_LA_JORNADA', 'se cobraron ' + r2(perm + deuda) + ' h y la jornada de ese dia es ' + j + ' h', perm + deuda - j);
    }
    /* 4) descuentos: horas cobradas vs lo que dice el registro */
    if (mot.indexOf('descuento') >= 0 && mot.indexOf('devolucion') < 0) {
      const cobrado = r2(perm + deuda);
      if (presencia != null && presencia > 0 && presencia < 24 && Math.abs(cobrado - presencia) > 0.25 && Math.abs(cobrado - jor) < 0.02)
        add(r, 'DESCUENTO_COBRA_JORNADA_COMPLETA', 'el descuento indicaba ' + presencia + ' h segun sus horas y se cobro la jornada completa ' + cobrado + ' h', cobrado - presencia);
      if (cobrado === 0) add(r, 'DESCUENTO_SIN_HORAS', 'el descuento quedo en 0 h (no se cobro nada)', 0);
    }
    /* 5) deuda creada teniendo saldo para cubrirla */
    if (deuda > 0 && (mot === 'permiso' || mot.indexOf('descuento') >= 0 || mot.indexOf('tardanza') >= 0) && saldoAntes > 0.01) {
      const debio = Math.max(0, r2(deuda - Math.max(0, saldoAntes - perm)));
      if (Math.abs(debio - deuda) > 0.011) add(r, 'DEUDA_CON_SALDO_DISPONIBLE', 'tenia ' + saldoAntes + ' h de saldo antes y quedo deuda ' + deuda + ' h (correcto: ' + debio + ')', deuda - debio);
    }
    if (mot.indexOf('pagadas') >= 0 && mot.indexOf('devolucion') >= 0) S.devPlanilla += perm;
    S.acum += acum; S.perm += perm; S.deuda += deuda;
    /* 6) acumulacion que debia saldar deuda y no genero compensacion */
    if (acum > 0 && saldoAntes < -0.01 && (mot === 'acumulacion' || mot.indexOf('dia libre') >= 0 || mot.indexOf('compensacion') === 0)) {
      const compensado = R.some(x => String(x.id).startsWith('HC') && String(x.detalle || '').indexOf(String(r.id)) >= 0 && norm(x.estado) !== 'rechazado');
      if (!compensado) add(r, 'DEUDA_NO_COMPENSADA', 'tenia deuda ' + r2(-saldoAntes) + ' h y esta acumulacion de ' + acum + ' h no la compenso', 0);
    }
  }
  /* 7) saldos por trabajador: deuda y horas a favor a la vez */
  const doble = [];
  for (const d of Object.keys(porDni)) {
    const S = porDni[d], favor = r2(S.acum - S.perm), deuda = r2(S.deuda);
    if (deuda > 0.01 && favor > 0.01) doble.push({ dni: d, nombre: S.nombre, aFavor: favor, deuda, saldoReal: r2(favor - deuda) });
    /* 8) planilla: devoluciones automaticas que faltan */
    if (S.acumPlanilla.length) {
      const deber = r2(S.acumPlanilla.reduce((a, x) => a + x.devolver, 0));
      if (deber - S.devPlanilla > 0.011) hallazgos.push({ tipo: 'PLANILLA_SIN_DEVOLUCION', id: S.acumPlanilla.map(x => x.id).join(' '), dni: d, nombre: String(S.nombre || ''), fecha: S.acumPlanilla.map(x => x.fecha).join(' '), motivo: 'Acumulación',
        trab: 0, jornada: 0, acum: r2(S.acumPlanilla.reduce((a, x) => a + x.acum, 0)), perm: 0, deuda: 0,
        detalle: 'cobra ' + PLANILLA[d] + ' h/dia en planilla: debian descontarse ' + deber + ' h y solo hay ' + r2(S.devPlanilla) + ' h devueltas', efecto: -(deber - S.devPlanilla) });
    }
  }
  await c.end();

  L('=== ACUMULACION DE HORAS · revision de ' + R.length + ' registros (' + Object.keys(porDni).length + ' trabajadores) ===');
  L('Horarios: ' + H.map(h => h.desde + '→' + (h.hasta || 'hoy') + ' L-V ' + netas(h.lvE, h.lvS, h.lvR) + 'h sab ' + netas(h.sbE, h.sbS, h.sbR) + 'h').join(' | '));
  L('Motivos usados: ' + Object.entries(conteoMot).sort((a, b) => b[1] - a[1]).map(x => x[0] + ' ' + x[1]).join(' · '));
  const tipos = {}; hallazgos.forEach(h => { tipos[h.tipo] = tipos[h.tipo] || { n: 0, efecto: 0, dnis: new Set() }; tipos[h.tipo].n++; tipos[h.tipo].efecto += h.efecto; tipos[h.tipo].dnis.add(h.dni); });
  L('\n--- HALLAZGOS (efecto = horas que deberian sumarse (+) o restarse (-) al saldo del trabajador) ---');
  if (!hallazgos.length) L('Ninguno ✅');
  Object.entries(tipos).forEach(([t, x]) => L(t.padEnd(34) + String(x.n).padStart(5) + ' registros · ' + String(x.dnis.size).padStart(4) + ' trabajadores · efecto ' + r2(x.efecto) + ' h'));
  L('\nAcumulaciones antiguas cargadas a mano (trabajadas 0, sin horas de entrada/salida): ' + legado + ' (no se marcan como error)');
  L('\n--- Hallazgos por año del registro ---');
  const porAnio = {}; hallazgos.forEach(h => { const y = (h.fecha || '????').slice(0, 4); porAnio[y] = porAnio[y] || {}; porAnio[y][h.tipo] = (porAnio[y][h.tipo] || 0) + 1; });
  Object.keys(porAnio).sort().forEach(y => L('   ' + y + ': ' + Object.entries(porAnio[y]).map(x => x[0] + ' ' + x[1]).join(' · ')));
  const recientes = R.filter(r => ymd(r.fecha_registro) >= '2026-09-27' && norm(r.estado) !== 'rechazado');
  L('\n--- Registros hechos desde el 27-set-2026 (servidor nuevo): ' + recientes.length + ' ---');
  recientes.slice(-12).forEach(r => L('   ' + ymd(r.fecha_registro) + ' ' + String(r.motivo).padEnd(12) + ' ' + dni8(r.dni) + ' ' + String(r.nombre || '').slice(0, 22).padEnd(22) + ' dia ' + ymd(r.fecha_entrada) + ' ' + (minutos(r.hora_entrada) >= 0 ? String(Math.floor(minutos(r.hora_entrada) / 60)).padStart(2, '0') + ':' + String(minutos(r.hora_entrada) % 60).padStart(2, '0') : '--:--') + '-' + (minutos(r.hora_salida) >= 0 ? String(Math.floor(minutos(r.hora_salida) / 60)).padStart(2, '0') + ':' + String(minutos(r.hora_salida) % 60).padStart(2, '0') : '--:--') + ' trab ' + (+r.horas_trabajadas || 0) + ' jornada ' + (+r.jornada_esperada || 0) + ' acum ' + (+r.horas_acumuladas || 0) + ' perm ' + (+r.horas_permiso || 0) + ' deuda ' + (+r.horas_deuda || 0)));
  L('\nTrabajadores con DEUDA y horas A FAVOR a la vez (se ven como que deben, pero no deben tanto): ' + doble.length);
  doble.sort((a, b) => b.deuda - a.deuda).slice(0, 15).forEach(x => L('   ' + x.dni + ' ' + String(x.nombre).slice(0, 30).padEnd(30) + ' a favor ' + x.aFavor + ' h · deuda ' + x.deuda + ' h · saldo real ' + x.saldoReal + ' h'));
  L('\nEjemplos:'); Object.keys(tipos).forEach(t => hallazgos.filter(h => h.tipo === t).slice(0, 3).forEach(h => L('   [' + t + '] ' + h.id + ' · ' + h.dni + ' ' + h.nombre.slice(0, 25) + ' · ' + h.fecha + ' · ' + h.detalle)));
  const csv = ['\ufefftipo;id;dni;nombre;fecha;motivo;trabajadas;jornada;acumuladas;permiso;deuda;detalle;efecto_en_saldo']
    .concat(hallazgos.map(h => [h.tipo, h.id, "'" + h.dni, h.nombre, h.fecha, h.motivo, h.trab, h.jornada, h.acum, h.perm, h.deuda, h.detalle, h.efecto].map(x => String(x).replace(/;/g, ',')).join(';')))
    .concat(doble.map(x => ['DEUDA_Y_SALDO_A_FAVOR', '', "'" + x.dni, x.nombre, '', '', '', '', x.aFavor, '', x.deuda, 'saldo real ' + x.saldoReal, 0].join(';')));
  fs.writeFileSync(path.join(__dirname, 'revision-horas.csv'), csv.join('\r\n'), 'utf8');
  L('\nDetalle completo: migracion\\revision-horas.csv (' + (csv.length - 1) + ' filas). No se cambio nada.');
})().catch(e => { console.error('ERROR: ' + e.message); process.exit(1); });
