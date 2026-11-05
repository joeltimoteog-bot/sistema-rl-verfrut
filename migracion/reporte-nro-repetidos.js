/* reporte-nro-repetidos.js — SOLO LEE. Lista las atenciones cuyo N° (mismo año) se repite con distinto DNI.
   Genera migracion\reporte-nro-repetidos.csv (se abre con Excel). No cambia nada. */
'use strict';
const fs = require('fs'), path = require('path'); const { Client } = require('pg');
const m = fs.readFileSync(path.join(__dirname, '.env'), 'utf8').match(/^SUPABASE_DB_URL=(.+)$/m);
(async () => {
  const c = new Client({ connectionString: m[1].trim().replace(/^"|"$/g, ''), ssl: { rejectUnauthorized: false } }); await c.connect();
  const r = await c.query(`
    WITH rep AS (SELECT anio, nro FROM rl.atenciones WHERE nro IS NOT NULL GROUP BY anio, nro HAVING COUNT(DISTINCT LTRIM(TRIM(dni), '0')) > 1)
    SELECT a.anio, a.nro, a.id, a.dni, a.nombre, to_char(a.fecha_atencion, 'YYYY-MM-DD') AS fecha, a.empresa, a.detalle_documento,
           a.estado, a.usuario_sistema, a.supervisor
      FROM rl.atenciones a JOIN rep USING (anio, nro)
     ORDER BY a.anio, a.nro, a.id`);
  const col = ['anio', 'nro', 'id', 'dni', 'nombre', 'fecha', 'empresa', 'detalle_documento', 'estado', 'usuario_sistema', 'supervisor'];
  const esc = v => { const s = v == null ? '' : String(v); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const csv = '﻿' + col.join(';') + '\n' + r.rows.map(f => col.map(k => esc(f[k])).join(';')).join('\n');
  const out = path.join(__dirname, 'reporte-nro-repetidos.csv');
  fs.writeFileSync(out, csv, 'utf8');
  const grupos = new Set(r.rows.map(f => f.anio + '-' + f.nro)).size;
  console.log(`N° repetidos: ${grupos} · atenciones involucradas: ${r.rows.length}\nArchivo: ${out}`);
  await c.end();
})().catch(e => { console.error('ERROR: ' + e.message); process.exit(1); });
