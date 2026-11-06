/* revisar-estadisticas.js — SOLO LECTURA (06-nov-2026).
   1) Compara mes a mes visitas y casos: tabla REAL de Supabase vs la copia que manda Google.
   2) Exporta para revision (no borra nada): atenciones posiblemente duplicadas y atenciones sin fecha o con fecha imposible.
   Uso:  cd C:\sistema-rl-verfrut\migracion ; node revisar-estadisticas.js
   Salida: revision-atenciones-duplicadas.csv y revision-atenciones-sin-fecha.csv (se abren con Excel) */
'use strict';
const fs = require('fs'), path = require('path'); const { Client } = require('pg');
const m = fs.readFileSync(path.join(__dirname, '.env'), 'utf8').match(/^\s*SUPABASE_DB_URL\s*=\s*(\S+)/m);
if (!m) { console.error('Falta SUPABASE_DB_URL en migracion\\.env'); process.exit(1); }
const csv = (file, filas) => {
  const esc = v => { const s = v == null ? '' : String(v); return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  fs.writeFileSync(path.join(__dirname, file), '\ufeff' + filas.map(f => f.map(esc).join(';')).join('\r\n'), 'utf8');
};
(async () => {
  const c = new Client({ connectionString: m[1].replace(/^"|"$/g, ''), ssl: { rejectUnauthorized: false } }); await c.connect();
  const q = async (s, p) => (await c.query(s, p || [])).rows;
  const f = await q(`SELECT datos::text d FROM rl.mod_datos WHERE modulo::text = 'estadm' AND clave::text = 'filas'`);
  const F = f.length ? JSON.parse(f[0].d) : { vis: [], cas: [] };
  for (const [nom, tabla, cop] of [['VISITAS', 'visitas', F.vis || []], ['CASOS', 'casos', F.cas || []]]) {
    const T = await q(`SELECT EXTRACT(YEAR FROM fecha_reg)::int a, EXTRACT(MONTH FROM fecha_reg)::int m, COUNT(*)::int n,
      COUNT(*) FILTER (WHERE UPPER(COALESCE(estado::text,'')) LIKE '%RETRAS%')::int r FROM rl.${tabla} GROUP BY 1, 2 ORDER BY 1, 2`);
    const C = {}; cop.forEach(x => { const k = x[4] + '-' + x[3]; C[k] = C[k] || { n: 0, r: 0 }; C[k].n++; if (String(x[2]).indexOf('RETRAS') >= 0) C[k].r++; });
    const tot = T.reduce((s, x) => s + x.n, 0);
    console.log(`\n=== ${nom}: tabla real ${tot} · copia de Google ${cop.length} ===`);
    const ks = new Set(T.map(x => x.a + '-' + x.m).concat(Object.keys(C)));
    let dif = 0;
    [...ks].sort((a, b) => { const [y1, m1] = a.split('-').map(Number), [y2, m2] = b.split('-').map(Number); return y1 - y2 || m1 - m2; }).forEach(k => {
      const t = T.find(x => x.a + '-' + x.m === k) || { n: 0, r: 0 }, cc = C[k] || { n: 0, r: 0 };
      const ok = t.n === cc.n && t.r === cc.r; if (!ok) dif++;
      console.log(`${k.padEnd(8)} tabla ${String(t.n).padStart(4)} (retras. ${t.r}) · copia ${String(cc.n).padStart(4)} (retras. ${cc.r})${ok ? '' : '   <-- distinto'}`);
    });
    console.log(dif ? `${dif} mes(es) distintos` : 'IGUALES mes a mes ✅');
  }
  const D = await q(`WITH g AS (SELECT dni::text dni, fecha_atencion, UPPER(COALESCE(supervisor::text,'')) sup, UPPER(COALESCE(detalle_documento::text,'')) doc, COALESCE(hora_inicio::text,'') hi, COUNT(*) n
      FROM rl.atenciones WHERE dni IS NOT NULL AND dni::text <> '' GROUP BY 1,2,3,4,5 HAVING COUNT(*) > 1)
    SELECT a.id, a.nro, a.fecha_atencion::text fecha, a.hora_inicio::text hora, a.dni::text dni, a.nombre::text nombre, a.empresa::text empresa, a.supervisor::text supervisor,
      a.detalle_documento::text documento, a.estado::text estado, a.fecha_registro::text registrado, a.usuario_sistema::text usuario, g.n veces
    FROM rl.atenciones a JOIN g ON g.dni = a.dni::text AND g.fecha_atencion IS NOT DISTINCT FROM a.fecha_atencion AND g.sup = UPPER(COALESCE(a.supervisor::text,''))
      AND g.doc = UPPER(COALESCE(a.detalle_documento::text,'')) AND g.hi = COALESCE(a.hora_inicio::text,'')
    ORDER BY a.dni::text, a.fecha_atencion, a.id`);
  csv('revision-atenciones-duplicadas.csv', [['id', 'nro', 'fecha_atencion', 'hora_inicio', 'dni', 'nombre', 'empresa', 'supervisor', 'documento', 'estado', 'registrado', 'usuario', 'veces']].concat(D.map(r => Object.values(r))));
  const S = await q(`SELECT id, nro, fecha_atencion::text fecha, dni::text dni, nombre::text nombre, empresa::text empresa, supervisor::text supervisor, estado::text estado,
      fecha_registro::text registrado, usuario_sistema::text usuario, CASE WHEN fecha_atencion IS NULL THEN 'SIN FECHA' ELSE 'FECHA IMPOSIBLE' END problema
    FROM rl.atenciones WHERE fecha_atencion IS NULL OR fecha_atencion < DATE '2015-01-01' OR fecha_atencion > (now() + interval '1 day')::date ORDER BY fecha_registro`);
  csv('revision-atenciones-sin-fecha.csv', [['id', 'nro', 'fecha_atencion', 'dni', 'nombre', 'empresa', 'supervisor', 'estado', 'registrado', 'usuario', 'problema']].concat(S.map(r => Object.values(r))));
  const porAnio = await q(`SELECT EXTRACT(YEAR FROM fecha_registro)::int a, COUNT(*)::int n FROM rl.atenciones WHERE fecha_atencion IS NULL GROUP BY 1 ORDER BY 1`);
  console.log(`\n=== ATENCIONES PARA REVISAR ===\nduplicadas: ${D.length} filas -> revision-atenciones-duplicadas.csv\nsin fecha o fecha imposible: ${S.length} filas -> revision-atenciones-sin-fecha.csv`);
  console.log('sin fecha, por año de registro: ' + porAnio.map(r => (r.a || '¿?') + ' ' + r.n).join(' · '));
  await c.end();
})().catch(e => { console.error('ERROR: ' + e.message); process.exit(1); });
