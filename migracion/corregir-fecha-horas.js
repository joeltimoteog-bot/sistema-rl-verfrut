/* corregir-fecha-horas.js — _HORAS_FECHA_FIX_V1 (06-nov-2026). Corrige la FECHA de un registro de Acumulación de Horas
   en Supabase (rl.horas_registros). No cambia horas, acumuladas, permiso, deuda ni saldo.
   Uso:
     node corregir-fecha-horas.js <ID> <yyyy-mm-dd>             -> solo VISTA PREVIA (no cambia nada)
     node corregir-fecha-horas.js <ID> <yyyy-mm-dd> --aplicar   -> aplica (con copia de respaldo en migracion\)
   Despues corrige la misma fecha en la hoja de Google (HORAS REGISTROS) para que la copia quede igual. */
'use strict';
const fs = require('fs'), path = require('path'); const PG = require('pg'), { Client } = PG;
PG.types.setTypeParser(1114, s => s == null ? null : new Date(String(s).replace(' ', 'T') + 'Z'));
const ENV = path.join(__dirname, '.env');
const m = fs.existsSync(ENV) && fs.readFileSync(ENV, 'utf8').match(/^\s*SUPABASE_DB_URL\s*=\s*(\S+)/m);
const URL = process.env.AUDIT_DB_URL || (m && m[1].replace(/^"|"$/g, ''));
const [ID, NUEVA] = [process.argv[2], process.argv[3]], APLICAR = process.argv.includes('--aplicar');
if (!URL) { console.error('Falta SUPABASE_DB_URL en migracion\\.env'); process.exit(1); }
if (!ID || !/^\d{4}-\d{2}-\d{2}$/.test(NUEVA || '')) { console.error('Uso: node corregir-fecha-horas.js <ID> <yyyy-mm-dd> [--aplicar]'); process.exit(1); }
const ymd = t => t ? new Date(new Date(t).getTime() - 5 * 3600e3).toISOString().slice(0, 10) : '';
(async () => {
  const c = new Client({ connectionString: URL, ssl: /localhost|127\.0\.0\.1/.test(URL) ? false : { rejectUnauthorized: false } }); await c.connect();
  const r = (await c.query('SELECT * FROM rl.horas_registros WHERE id::text = $1', [ID])).rows;
  if (r.length !== 1) { console.error('No se encontro un unico registro con id ' + ID + ' (encontrados: ' + r.length + ')'); await c.end(); process.exit(1); }
  const x = r[0], fe = ymd(x.fecha_entrada), fs2 = ymd(x.fecha_salida);
  const dw = new Date(NUEVA + 'T12:00:00Z').getUTCDay(), DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  console.log('Registro ' + ID + ' · DNI ' + x.dni + ' ' + x.nombre + ' · ' + x.motivo + ' · estado ' + (x.estado || '(vacio)'));
  console.log('   fecha de entrada: ' + fe + '  ->  ' + NUEVA + ' (' + DIAS[dw] + ')');
  console.log('   fecha de salida:  ' + (fs2 || '(vacia)') + '  ->  ' + (fs2 ? NUEVA : '(vacia)'));
  console.log('   horas, jornada (' + x.jornada_esperada + '), acumuladas, permiso (' + x.horas_permiso + ') y deuda (' + x.horas_deuda + '): SIN CAMBIO');
  if (!APLICAR) { console.log('\nVISTA PREVIA: no se cambio nada. Para aplicar, repite el comando con --aplicar'); await c.end(); return; }
  const respaldo = path.join(__dirname, 'respaldo-horas-' + ID + '-' + Date.now() + '.json');
  fs.writeFileSync(respaldo, JSON.stringify(x, null, 1));
  const nueva = NUEVA + ' 05:00:00';   /* medianoche de Lima, como guarda las fechas el sistema */
  await c.query('BEGIN');
  try {
    const u = await c.query('UPDATE rl.horas_registros SET fecha_entrada = $2::timestamp, fecha_salida = CASE WHEN fecha_salida IS NULL THEN NULL ELSE $2::timestamp END, actualizado = now() WHERE id::text = $1', [ID, nueva]);
    if (u.rowCount !== 1) throw new Error('se esperaba 1 fila y se cambiaron ' + u.rowCount);
    await c.query("UPDATE rl.th_estado SET marca = $1 WHERE clave::text = 'horas_registros'", [String(Date.now())]);   /* avisa a las pantallas y al servidor que hay cambios */
    await c.query('COMMIT');
  } catch (e) { await c.query('ROLLBACK'); throw e; }
  console.log('\n✅ Fecha corregida en Supabase. Respaldo del registro: ' + path.basename(respaldo));
  console.log('   Falta: en la hoja de Google (HORAS REGISTROS) cambiar la misma fecha en las columnas FECHA_ENTRADA y FECHA_SALIDA del ID ' + ID + '.');
  await c.end();
})().catch(e => { console.error('ERROR: ' + e.message); process.exit(1); });
