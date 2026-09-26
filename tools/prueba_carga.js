/* ═══════════════════════════════════════════════════════════════════════════
   PRUEBA DE CARGA — Sistema RR.LL. (Fase 0, 26-set-2026)
   ---------------------------------------------------------------------------
   Simula usuarios usando el sistema contra AZURE, en escalones:
       25 → 50 → 100 → 200 → 300 usuarios virtuales (1 minuto cada uno)
   Cada usuario virtual hace lo que hace un supervisor real, con pausas de
   3 a 8 segundos entre accion y accion (un humano no hace clic sin parar):
       · buscar trabajador por DNI         (lo mas frecuente)
       · historial de atenciones por DNI
       · Mis Atenciones (lista de los ultimos dias)
       · indicadores del dashboard (stats)

   SEGURIDAD — que NO afecte a los usuarios:
     · SOLO LECTURAS (GET). No guarda, no edita, no borra nada.
     · NO toca Google (Apps Script ni la hoja): no gasta su cuota.
     · FRENO AUTOMATICO: si mas del 5 % de las consultas falla, o si la mitad
       mas lenta (p95) pasa de 8 s, se detiene sola en ese escalon.
     · Correrla de noche, cuando nadie usa el sistema (despues de las 21:00).
     · Ctrl + C la detiene en cualquier momento.

   Uso:   node prueba_carga.js            (todos los escalones)
          node prueba_carga.js 50         (solo hasta 50 usuarios)
   Requiere Node 18 o superior (el que ya usa Azure Functions Core Tools).
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';

const BASE = process.env.CARGA_BASE || 'https://rl-functions-verfrut-c0ctfjc0cjf5f0hz.brazilsouth-01.azurewebsites.net/api';
const KEY_LIST = 'mAcqIAfE5WQdqpcPxLvWmh6-FDk0rrIkQZyVIllZONO0AzFuaEOVBQ==';   // la misma llave de solo lectura que usa el dashboard
const TOPE = Number(process.argv[2]) || 300;
const ESCALONES = [25, 50, 100, 200, 300].filter(n => n <= TOPE);
const DURACION_MS = Number(process.env.CARGA_MS) || 60000;           // 1 minuto por escalon
const PAUSA_MIN = 3000, PAUSA_MAX = 8000;
const TIMEOUT_MS = 15000;
const FRENO_ERRORES = 0.05, FRENO_P95_MS = 8000;

const SUPERVISORES = ['ALEXANDER MARTINEZ JUAREZ', 'ALEX FABIAN ZAPATA SUAREZ', 'ROBERTO MOLERO ABAD',
  'CARMEN VIVIANA CAVERO', 'MURIEL DE LOS MILAGROS MECHATO NAVARRO', 'ALEXANDER TINEO RAMOS',
  'SERGIO VIERA GIRON', 'SOCORRO DEL PILAR MIRANDA PASAPERA', 'JOHN STEVE HERNANDEZ BORRERO'];

const azar = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const elegir = (l) => l[azar(0, l.length - 1)];
const dni = () => String(azar(10000000, 79999999));
const hace = (d) => { const f = new Date(); f.setDate(f.getDate() - d); return f.toISOString().slice(0, 10); };

/* acciones con su peso (cuanto se usa cada una en la vida real) */
const ACCIONES = [
  { nombre: 'buscar DNI',       peso: 45, url: () => `${BASE}/trabajadores/buscar?dni=${dni()}` },
  { nombre: 'historial DNI',    peso: 25, url: () => `${BASE}/atenciones/by-dni?dni=${dni()}&dias=60` },
  { nombre: 'Mis Atenciones',   peso: 20, url: () => `${BASE}/atenciones?limit=1000&page=1&desde=${hace(2)}&supervisor=${encodeURIComponent(elegir(SUPERVISORES))}&code=${encodeURIComponent(KEY_LIST)}` },
  { nombre: 'indicadores',      peso: 10, url: () => `${BASE}/atenciones/stats?supervisor=${encodeURIComponent(elegir(SUPERVISORES))}` },
];
const TOTAL_PESO = ACCIONES.reduce((s, a) => s + a.peso, 0);
function accionAlAzar() { let r = Math.random() * TOTAL_PESO; for (const a of ACCIONES) { if ((r -= a.peso) < 0) return a; } return ACCIONES[0]; }

async function consultar(accion, stats) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const t0 = Date.now();
  let ok = false, detalle = '';
  try {
    const r = await fetch(accion.url(), { signal: ctrl.signal, headers: { 'x-prueba-carga': '1' } });
    await r.text();
    ok = r.ok || r.status === 404;           // 404 = DNI no existe: respuesta valida
    if (!ok) detalle = 'HTTP ' + r.status;
  } catch (e) { detalle = e.name === 'AbortError' ? 'TIMEOUT 15s' : e.message; }
  finally { clearTimeout(t); }
  const ms = Date.now() - t0;
  const s = stats[accion.nombre] || (stats[accion.nombre] = { n: 0, err: 0, tiempos: [], motivos: {} });
  s.n++; s.tiempos.push(ms);
  if (!ok) { s.err++; s.motivos[detalle] = (s.motivos[detalle] || 0) + 1; }
  /* freno inmediato: tras 40 consultas, si fallan mas del 20 % o 10 seguidas tardan > 8 s, se corta el escalon */
  stats._n = (stats._n || 0) + 1; stats._e = (stats._e || 0) + (ok ? 0 : 1);
  stats._lentas = ms > FRENO_P95_MS ? (stats._lentas || 0) + 1 : 0;
  if ((stats._n >= 40 && stats._e / stats._n > 0.2) || stats._lentas >= 10) stats._cortar = true;
}

function pct(l, p) { if (!l.length) return 0; const o = [...l].sort((a, b) => a - b); return o[Math.min(o.length - 1, Math.floor(o.length * p))]; }

async function escalon(usuarios) {
  const stats = {}, fin = Date.now() + DURACION_MS;
  const vu = async () => {
    await new Promise(r => setTimeout(r, azar(0, PAUSA_MAX)));      // no arrancan todos juntos
    while (Date.now() < fin && !stats._cortar) {
      await consultar(accionAlAzar(), stats);
      await new Promise(r => setTimeout(r, azar(PAUSA_MIN, PAUSA_MAX)));
    }
  };
  await Promise.all(Array.from({ length: usuarios }, vu));
  let n = 0, err = 0, todos = [];
  const cortado = !!stats._cortar;
  const filas = Object.entries(stats).filter(([k]) => k[0] !== '_').map(([k, s]) => {
    n += s.n; err += s.err; todos = todos.concat(s.tiempos);
    return `   ${k.padEnd(16)} ${String(s.n).padStart(5)} consultas | p50 ${String(pct(s.tiempos, .5)).padStart(5)} ms | p95 ${String(pct(s.tiempos, .95)).padStart(5)} ms | errores ${s.err}` +
           (s.err ? '  (' + Object.entries(s.motivos).map(([m, c]) => m + ' x' + c).join(', ') + ')' : '');
  });
  return { cortado, usuarios, n, err, tasaErr: n ? err / n : 0, p50: pct(todos, .5), p95: pct(todos, .95), porSeg: (n / (DURACION_MS / 1000)).toFixed(1), filas };
}

(async () => {
  const hora = new Date().getHours();
  console.log('═══ PRUEBA DE CARGA — Sistema RR.LL. (solo lecturas en Azure) ═══');
  if (hora >= 6 && hora < 21) {
    console.log('\n⚠️  Son las ' + hora + ' h. Esta prueba debe correrse de NOCHE (21:00 a 06:00) para no afectar a los usuarios.');
    console.log('   Si igual quieres correrla ahora, ejecuta:  node prueba_carga.js ' + TOPE + ' --ahora');
    if (!process.argv.includes('--ahora')) process.exit(1);
  }
  console.log('Escalones: ' + ESCALONES.join(' → ') + ' usuarios, 1 min cada uno. Freno: >5 % errores o p95 > 8 s.\n');
  const resumen = [];
  for (const u of ESCALONES) {
    process.stdout.write('▶ ' + u + ' usuarios simultaneos... ');
    const r = await escalon(u);
    resumen.push(r);
    const estado = (r.cortado || r.tasaErr > FRENO_ERRORES || r.p95 > FRENO_P95_MS) ? '❌ SATURADO' : (r.p95 > 3000 ? '⚠️ LENTO' : '✅ OK');
    console.log(estado + `  (${r.porSeg} consultas/s, p50 ${r.p50} ms, p95 ${r.p95} ms, errores ${(r.tasaErr * 100).toFixed(1)} %)`);
    r.filas.forEach(f => console.log(f));
    if (estado === '❌ SATURADO') { console.log('\n🛑 Freno automatico: se detiene aqui para no cargar mas la base.'); break; }
    await new Promise(res => setTimeout(res, 15000));   // respiro entre escalones
  }
  console.log('\n═══ RESUMEN (copia esto y pasaselo a Claude) ═══');
  resumen.forEach(r => console.log(`${String(r.usuarios).padStart(4)} usuarios | ${r.porSeg.padStart(5)} consultas/s | p50 ${String(r.p50).padStart(5)} ms | p95 ${String(r.p95).padStart(5)} ms | errores ${(r.tasaErr * 100).toFixed(1)} %`));
  console.log('Fecha: ' + new Date().toString());
})();
