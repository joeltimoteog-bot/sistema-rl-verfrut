/* aplicar-prec-bloqueo.js — _PREC_USUARIO_V1 + _AT_BLOQUEO_V1 (12-nov-2026)
   Agrega en Supabase las columnas nuevas de Precedentes y la tabla de bloqueos de Atenciones. Solo agrega.
   Usa SUPABASE_DB_URL de migracion\.env (no se muestra). Se puede repetir.
   Uso:      cd C:\sistema-rl-verfrut\migracion\prec-bloqueo ; node aplicar-prec-bloqueo.js
   Deshacer: node aplicar-prec-bloqueo.js revertir */
'use strict';
const fs = require('fs'), path = require('path'); const { Client } = require(path.join(__dirname, '..', 'node_modules', 'pg'));
const m = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').match(/^\s*SUPABASE_DB_URL\s*=\s*(\S+)/m);
if (!m) { console.error('Falta SUPABASE_DB_URL en migracion\\.env'); process.exit(1); }
const revertir = process.argv[2] === 'revertir';
(async () => {
  const url = m[1].replace(/^"|"$/g, '');
  const c = new Client({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false } }); await c.connect();
  try {
    const antes = (await c.query('SELECT COUNT(*)::int AS n FROM rl.casos_precedentes')).rows[0].n;
    const a = revertir ? '01-prec-bloqueo-REVERTIR.sql' : '01-prec-bloqueo.sql';
    try { await c.query(fs.readFileSync(path.join(__dirname, a), 'utf8')); console.log('OK ' + a); }
    catch (e) { try { await c.query('ROLLBACK'); } catch (e2) {} throw new Error(a + ': ' + e.message); }
    const despues = (await c.query('SELECT COUNT(*)::int AS n FROM rl.casos_precedentes')).rows[0].n;
    console.log('  precedentes antes: ' + antes + ' · despues: ' + despues + (antes === despues ? '  (ninguno se perdio)' : '  ATENCION: cambio la cantidad'));
    if (!revertir) {
      const cols = (await c.query(`SELECT column_name FROM information_schema.columns WHERE table_schema = 'rl' AND table_name = 'casos_precedentes'
        AND column_name IN ('ruta','cod_trabajador','area','motivo_falta','creado_sector','creado_nombre')`)).rows.length;
      const t = (await c.query(`SELECT to_regclass('rl.at_bloqueos') IS NOT NULL AS ok`)).rows[0].ok;
      const por = (await c.query(`SELECT lower(creado_por::text) AS u, COUNT(*)::int AS n FROM rl.casos_precedentes WHERE activo = 1 GROUP BY 1 ORDER BY 2 DESC`)).rows;
      console.log('  columnas nuevas de precedentes: ' + cols + ' de 6 · tabla rl.at_bloqueos: ' + (t ? 'creada' : 'FALTA'));
      console.log('  precedentes vigentes por quien los registro: ' + (por.length ? por.map((x) => x.u + ' ' + x.n).join(' · ') : '(ninguno)'));
      console.log(cols === 6 && t && antes === despues ? 'RESULTADO: LISTO' : 'RESULTADO: REVISAR (algo no quedo)');
    } else console.log('RESULTADO: REVERTIDO');
  } finally { await c.end(); }
})().catch(e => { console.error('ERROR: ' + e.message); process.exit(1); });
