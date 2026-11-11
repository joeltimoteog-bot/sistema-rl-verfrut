/* aplicar-tablas-eti.js — _TABLAS_ETI_V1 (11-nov-2026): crea las tablas con columnas propias de los ETI, las llena desde las
   tablas "amontonadas" y COMPARA que coincidan. Usa SUPABASE_DB_URL de migracion\.env (no se muestra).
   Las tablas de origen no se tocan. Se puede repetir.
   Uso:      cd C:\sistema-rl-verfrut\migracion\tablas-eti ; node aplicar-tablas-eti.js
   Comparar: node aplicar-tablas-eti.js comparar      (no cambia nada)
   Deshacer: node aplicar-tablas-eti.js revertir */
'use strict';
const fs = require('fs'), path = require('path'); const { Client } = require(path.join(__dirname, '..', 'node_modules', 'pg'));
const m = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').match(/^\s*SUPABASE_DB_URL\s*=\s*(\S+)/m);
if (!m) { console.error('Falta SUPABASE_DB_URL en migracion\\.env'); process.exit(1); }
const modo = process.argv[2] || 'aplicar';
const PARES = [
  ['capacitaciones', 'cap_registros'], ['programaciones_eti', 'prog_programaciones'], ['evaluaciones_conocimiento', 'eval_manuales'], ['sesiones_qr', 'qr_sesiones'],
  ['respuestas_qr', 'qr_respuestas'], ['informes_enviados', 'eval_informes_dia'], ['supervisores_eti', 'supervisores'], ['usuarios_eti', 'usuarios']];
/* comprobaciones de contenido: la misma suma calculada en la tabla amontonada y en la ordenada */
const SUMAS = [
  ['Capacitados (total de las actas)', "SELECT COALESCE(SUM(NULLIF(datos->>'total','')::numeric),0) AS v FROM eti.capacitaciones", 'SELECT COALESCE(SUM(total),0) AS v FROM eti.cap_registros'],
  ['Varones + mujeres de las actas', "SELECT COALESCE(SUM(NULLIF(datos->>'varones','')::numeric + NULLIF(datos->>'mujeres','')::numeric),0) AS v FROM eti.capacitaciones", 'SELECT COALESCE(SUM(varones + mujeres),0) AS v FROM eti.cap_registros'],
  ['Rutas de las actas', "SELECT COALESCE(SUM(jsonb_array_length(datos->'rutas')),0) AS v FROM eti.capacitaciones WHERE jsonb_typeof(datos->'rutas') = 'array'", 'SELECT COUNT(*) AS v FROM eti.cap_registro_rutas'],
  ['Codigos capacitados', "SELECT COALESCE(SUM(jsonb_array_length(datos->'codigosCapacitados')),0) AS v FROM eti.capacitaciones WHERE jsonb_typeof(datos->'codigosCapacitados') = 'array'", 'SELECT COUNT(*) AS v FROM eti.cap_registro_codigos'],
  ['Programaciones ejecutadas', "SELECT COUNT(*) AS v FROM eti.programaciones_eti WHERE datos->>'ejecutadaEn' IS NOT NULL", 'SELECT COUNT(*) AS v FROM eti.prog_programaciones WHERE ejecutada_en IS NOT NULL'],
  ['Fechas programadas', "SELECT COALESCE(SUM(jsonb_array_length(datos->'fechas')),0) AS v FROM eti.programaciones_eti WHERE jsonb_typeof(datos->'fechas') = 'array'", "SELECT COUNT(*) AS v FROM eti.prog_fechas WHERE tipo = 'PROGRAMADA'"],
  ['Reprogramaciones', "SELECT COALESCE(SUM(jsonb_array_length(datos->'reprogramaciones')),0) AS v FROM eti.programaciones_eti WHERE jsonb_typeof(datos->'reprogramaciones') = 'array'", 'SELECT COUNT(*) AS v FROM eti.prog_reprogramaciones'],
  ['Rutas de evaluaciones manuales', "SELECT COALESCE(SUM(jsonb_array_length(datos->'rutas')),0) AS v FROM eti.evaluaciones_conocimiento WHERE jsonb_typeof(datos->'rutas') = 'array'", 'SELECT COUNT(*) AS v FROM eti.eval_manual_rutas'],
  ['Suma de resultados QR', "SELECT ROUND(COALESCE(SUM(NULLIF(datos->>'resultado','')::numeric),0),2) AS v FROM eti.respuestas_qr", 'SELECT ROUND(COALESCE(SUM(resultado),0),2) AS v FROM eti.qr_respuestas'],
  ['Preguntas respondidas por QR', "SELECT COALESCE(SUM((SELECT COUNT(*) FROM jsonb_object_keys(datos->'resp'))),0) AS v FROM eti.respuestas_qr WHERE jsonb_typeof(datos->'resp') = 'object'", 'SELECT COUNT(*) AS v FROM eti.qr_respuesta_preguntas WHERE respuesta IS NOT NULL'],
  ['Secciones calificadas por QR', "SELECT COALESCE(SUM(jsonb_array_length(datos->'secs')),0) AS v FROM eti.respuestas_qr WHERE jsonb_typeof(datos->'secs') = 'array'", 'SELECT COUNT(*) AS v FROM eti.qr_respuesta_secciones'],
  ['Evaluados informados por dia', "SELECT COALESCE(SUM(NULLIF(datos->>'n','')::numeric),0) AS v FROM eti.informes_enviados", 'SELECT COALESCE(SUM(evaluados),0) AS v FROM eti.eval_informes_dia']];
(async () => {
  const c = new Client({ connectionString: m[1].replace(/^"|"$/g, ''), ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false } }); await c.connect();
  c.on('notice', n => { if (!/already exists|does not exist, skipping/.test(n.message)) console.log('  aviso: ' + n.message); });
  let mal = 0;
  try {
    if (modo === 'revertir') {
      /* solo se deshace si este paquete esta instalado: asi nunca se borra una tabla ajena que se llame igual */
      if (!(await c.query("SELECT 1 FROM pg_proc p JOIN pg_namespace s ON s.oid = p.pronamespace WHERE s.nspname = 'eti' AND p.proname = '_copiar'")).rows.length) { console.log('No hay nada que deshacer: las tablas ordenadas no estan instaladas.'); return; }
      await c.query(fs.readFileSync(path.join(__dirname, '01-tablas-eti-REVERTIR.sql'), 'utf8')); console.log('OK revertido: se quitaron las tablas ordenadas y sus disparadores (las de origen no se tocaron)'); return;
    }
    if (modo === 'aplicar') {
      /* antes de crear nada: ningun nombre nuevo debe chocar con algo que ya exista en el esquema eti y que no sea una tabla de este paquete */
      const NUEVAS = ['cap_registros', 'cap_registro_rutas', 'cap_registro_codigos', 'prog_programaciones', 'prog_fechas', 'prog_reprogramaciones', 'prog_solicitudes', 'eval_manuales', 'eval_manual_rutas',
        'qr_sesiones', 'qr_respuestas', 'qr_respuesta_preguntas', 'qr_respuesta_secciones', 'eval_informes_dia', 'supervisores', 'usuarios', '_tablas_errores'];
      const ex = await c.query("SELECT c.relname AS n, c.relkind AS k, obj_description(c.oid) AS d FROM pg_class c JOIN pg_namespace s ON s.oid = c.relnamespace WHERE s.nspname = 'eti' AND c.relkind IN ('r','v','m','f','p','i','I','S') ORDER BY 1");
      const tipo = { r: 'tabla', v: 'vista', m: 'vista materializada', f: 'tabla externa', p: 'tabla', i: 'indice', I: 'indice', S: 'secuencia' };   /* los indices comparten nombres con las tablas: eti.informes_dia ya era un indice */
      /* si este paquete ya se aplico antes (existe eti._copiar), sus propias tablas no cuentan como choque */
      const instalado = (await c.query("SELECT 1 FROM pg_proc p JOIN pg_namespace s ON s.oid = p.pronamespace WHERE s.nspname = 'eti' AND p.proname = '_copiar'")).rows.length > 0;
      const choques = ex.rows.filter(x => NUEVAS.indexOf(x.n) >= 0 && !(x.k === 'r' && instalado));
      if (choques.length) {
        console.log('ALTO: no se creo nada. Estos nombres ya existen en el esquema eti y no son de este paquete:');
        choques.forEach(x => console.log('  eti.' + x.n + '  (' + (tipo[x.k] || x.k) + ')'));
        console.log('\nLo que hay hoy en el esquema eti:'); ex.rows.forEach(x => console.log('  ' + (tipo[x.k] || x.k).padEnd(8) + ' eti.' + x.n));
        console.log('\nPegale esta salida a Claude para que cambie los nombres.'); return;
      }
      try { await c.query(fs.readFileSync(path.join(__dirname, '01-tablas-eti.sql'), 'utf8')); console.log('OK 01-tablas-eti.sql (tablas y disparadores creados)'); }
      catch (e) { try { await c.query('ROLLBACK'); } catch (e2) {} throw new Error('01-tablas-eti.sql: ' + e.message); }
      const r = await c.query('SELECT * FROM eti.tablas_reconstruir()');
      console.log('\n== Llenado desde las tablas de origen ==');
      r.rows.forEach(x => { console.log('  ' + String(x.origen).padEnd(28) + String(x.filas).padStart(5) + ' copiadas' + (x.fallidas ? '   ' + x.fallidas + ' FALLIDAS' : '')); if (x.fallidas) mal++; });
    }
    console.log('\n== Comparacion de filas (origen amontonado -> tabla ordenada) ==');
    for (const [o, d] of PARES) {
      const a = (await c.query('SELECT COUNT(*)::int AS n FROM eti."' + o + '"')).rows[0].n, b = (await c.query('SELECT COUNT(*)::int AS n FROM eti."' + d + '"')).rows[0].n;
      const falt = (await c.query('SELECT COUNT(*)::int AS n FROM eti."' + o + '" x WHERE NOT EXISTS (SELECT 1 FROM eti."' + d + '" y WHERE y.id = x.id)')).rows[0].n;
      const ok = a === b && falt === 0; if (!ok) mal++;
      console.log('  ' + (ok ? 'OK ' : 'MAL') + ' ' + ('eti.' + o).padEnd(34) + String(a).padStart(5) + '  ->  ' + ('eti.' + d).padEnd(26) + String(b).padStart(5) + (falt ? '   faltan ' + falt : ''));
    }
    console.log('\n== Comparacion de contenido (la misma suma en las dos) ==');
    for (const [n, qa, qb] of SUMAS) {
      let va, vb; try { va = String((await c.query(qa)).rows[0].v); vb = String((await c.query(qb)).rows[0].v); } catch (e) { va = 'error'; vb = e.message.slice(0, 60); }
      const ok = Number(va) === Number(vb); if (!ok) mal++;
      console.log('  ' + (ok ? 'OK ' : 'MAL') + ' ' + n.padEnd(36) + String(va).padStart(10) + '  =  ' + String(vb).padStart(10));
    }
    const e = await c.query('SELECT tabla, COUNT(*)::int AS n, MAX(error) AS ej FROM eti._tablas_errores GROUP BY 1 ORDER BY 1');
    console.log('\n== Errores de copia anotados ==' + (e.rows.length ? '' : '\n  ninguno'));
    e.rows.forEach(x => { mal++; console.log('  ' + x.tabla + ': ' + x.n + '  (ejemplo: ' + String(x.ej).slice(0, 90) + ')'); });
    console.log('\n' + (mal ? 'RESULTADO: HAY ' + mal + ' DIFERENCIA(S). No uses las tablas nuevas todavia; pegale esta salida a Claude.' : 'RESULTADO: TODO COINCIDE. Las tablas ordenadas tienen lo mismo que las amontonadas.'));
  } finally { await c.end(); }
})().catch(e => { console.error('ERROR: ' + e.message); process.exit(1); });
