/* aplicar-tablas-eti-2.js — _TABLAS_ETI_V2 (11-nov-2026): segunda parte. Crea las tablas con columnas propias para los
   documentos anidados de los ETI (banco de preguntas, configuracion, detalle por seccion, cuestionario de cada QR,
   depuradas, informe de capacitacion), las llena y COMPARA que coincidan. Requiere la primera parte ya aplicada.
   Usa SUPABASE_DB_URL de migracion\.env (no se muestra). Las tablas de origen no se tocan. Se puede repetir.
   Uso:      cd C:\sistema-rl-verfrut\migracion\tablas-eti ; node aplicar-tablas-eti-2.js
   Comparar: node aplicar-tablas-eti-2.js comparar     (no cambia nada)
   Deshacer: node aplicar-tablas-eti-2.js revertir */
'use strict';
const fs = require('fs'), path = require('path'); const { Client } = require(path.join(__dirname, '..', 'node_modules', 'pg'));
const m = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').match(/^\s*SUPABASE_DB_URL\s*=\s*(\S+)/m);
if (!m) { console.error('Falta SUPABASE_DB_URL en migracion\\.env'); process.exit(1); }
const modo = process.argv[2] || 'aplicar';
const NUEVAS = ['banco_versiones', 'banco_secciones', 'banco_preguntas', 'cfg_accesos', 'cfg_atribucion', 'cfg_coberturas', 'cfg_respaldo', 'eval_manual_ruta_secciones', 'eval_manual_fechas_programadas',
  'qr_sesion_secciones', 'qr_sesion_preguntas', 'eval_depuradas', 'eval_depurada_rutas', 'eval_depurada_ruta_secciones', 'cap_informes', 'cap_informe_fotos', 'eval_programaciones', 'eval_programacion_fechas'];
const L = (t, campo) => "COALESCE(SUM(jsonb_array_length(" + campo + ")),0)";
const SECS = "jsonb_array_elements(CASE WHEN jsonb_typeof(datos->'secs') = 'array' THEN datos->'secs' ELSE '[]'::jsonb END) s";
const PREG = "jsonb_array_length(CASE WHEN jsonb_typeof(s->'pregs') = 'array' THEN s->'pregs' ELSE '[]'::jsonb END)";
const RUT = "jsonb_array_elements(CASE WHEN jsonb_typeof(datos->'rutas') = 'array' THEN datos->'rutas' ELSE '[]'::jsonb END) r";
const RSEC = "jsonb_array_length(CASE WHEN jsonb_typeof(r->'secs') = 'array' THEN r->'secs' ELSE '[]'::jsonb END)";
const COMP = [
  ['Versiones del banco (vigente + historial)', "SELECT (SELECT COUNT(*) FROM eti.banco_historial) + (SELECT COUNT(*) FROM eti.config_eti WHERE id = 'banco') AS v", 'SELECT COUNT(*) AS v FROM eti.banco_versiones'],
  ['Secciones del banco', "SELECT (SELECT COUNT(*) FROM eti.banco_historial, " + SECS + ") + (SELECT COUNT(*) FROM eti.config_eti, " + SECS + " WHERE id = 'banco') AS v", 'SELECT COUNT(*) AS v FROM eti.banco_secciones'],
  ['Preguntas del banco', "SELECT (SELECT COALESCE(SUM(" + PREG + "),0) FROM eti.banco_historial, " + SECS + ") + (SELECT COALESCE(SUM(" + PREG + "),0) FROM eti.config_eti, " + SECS + " WHERE id = 'banco') AS v", 'SELECT COUNT(*) AS v FROM eti.banco_preguntas'],
  ['Preguntas del banco vigente', "SELECT COALESCE(SUM(" + PREG + "),0) AS v FROM eti.config_eti, " + SECS + " WHERE id = 'banco'", "SELECT COUNT(*) AS v FROM eti.banco_preguntas WHERE version_id = 'vigente'"],
  ['Usuarios con acceso configurado', "SELECT COALESCE((SELECT (SELECT COUNT(*) FROM jsonb_object_keys(datos->'usuarios')) FROM eti.config_eti WHERE id = 'accesos' AND jsonb_typeof(datos->'usuarios') = 'object'),0) AS v", 'SELECT COUNT(*) AS v FROM eti.cfg_accesos'],
  ['Supervisores en atribucion', "SELECT COALESCE((SELECT jsonb_array_length(datos->'sups') FROM eti.config_eti WHERE id = 'atribucion' AND jsonb_typeof(datos->'sups') = 'array'),0) AS v", 'SELECT COUNT(*) AS v FROM eti.cfg_atribucion'],
  ['Secciones por ruta (eval. manuales)', "SELECT COALESCE(SUM(" + RSEC + "),0) AS v FROM eti.evaluaciones_conocimiento, " + RUT, 'SELECT COUNT(*) AS v FROM eti.eval_manual_ruta_secciones'],
  ['Suma de porcentajes por seccion', "SELECT ROUND(COALESCE(SUM((x->>'pct')::numeric),0),2) AS v FROM eti.evaluaciones_conocimiento, " + RUT + ", jsonb_array_elements(CASE WHEN jsonb_typeof(r->'secs') = 'array' THEN r->'secs' ELSE '[]'::jsonb END) x", 'SELECT ROUND(COALESCE(SUM(porcentaje),0),2) AS v FROM eti.eval_manual_ruta_secciones'],
  ['Secciones del cuestionario de cada QR', "SELECT COALESCE(SUM(jsonb_array_length(datos->'banco')),0) AS v FROM eti.sesiones_qr WHERE jsonb_typeof(datos->'banco') = 'array'", 'SELECT COUNT(*) AS v FROM eti.qr_sesion_secciones'],
  ['Preguntas del cuestionario de cada QR', "SELECT COALESCE(SUM(" + PREG + "),0) AS v FROM eti.sesiones_qr, jsonb_array_elements(CASE WHEN jsonb_typeof(datos->'banco') = 'array' THEN datos->'banco' ELSE '[]'::jsonb END) s", 'SELECT COUNT(*) AS v FROM eti.qr_sesion_preguntas'],
  ['Evaluaciones depuradas', 'SELECT COUNT(*) AS v FROM eti.evaluaciones_depuradas', 'SELECT COUNT(*) AS v FROM eti.eval_depuradas'],
  ['Rutas de las depuradas', "SELECT COALESCE(SUM(CASE WHEN jsonb_typeof(datos->'rutas') = 'array' THEN jsonb_array_length(datos->'rutas') WHEN jsonb_typeof(datos->'ruta') = 'object' THEN 1 ELSE 0 END),0) AS v FROM eti.evaluaciones_depuradas", 'SELECT COUNT(*) AS v FROM eti.eval_depurada_rutas'],
  ['Informes de capacitacion', 'SELECT COUNT(*) AS v FROM eti.informes_cap', 'SELECT COUNT(*) AS v FROM eti.cap_informes'],
  ['Fotos de los informes', "SELECT COALESCE(SUM(jsonb_array_length(datos->'fotos')),0) AS v FROM eti.informes_cap WHERE jsonb_typeof(datos->'fotos') = 'array'", 'SELECT COUNT(*) AS v FROM eti.cap_informe_fotos'],
  ['Programaciones de checklist', 'SELECT COUNT(*) AS v FROM eti.programaciones_eval', 'SELECT COUNT(*) AS v FROM eti.eval_programaciones']];
(async () => {
  const c = new Client({ connectionString: m[1].replace(/^"|"$/g, ''), ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false } }); await c.connect();
  c.on('notice', n => { if (!/already exists|does not exist, skipping/.test(n.message)) console.log('  aviso: ' + n.message); });
  const hay = async (f) => (await c.query("SELECT 1 FROM pg_proc p JOIN pg_namespace s ON s.oid = p.pronamespace WHERE s.nspname = 'eti' AND p.proname = $1", [f])).rows.length > 0;
  let mal = 0;
  try {
    if (!(await hay('_copiar'))) { console.log('ALTO: primero aplica la primera parte (node aplicar-tablas-eti.js). No se hizo nada.'); return; }
    const instalado = await hay('_copiar2');
    if (modo === 'revertir') {
      if (!instalado) { console.log('No hay nada que deshacer: la segunda parte no esta instalada.'); return; }
      await c.query(fs.readFileSync(path.join(__dirname, '02-tablas-eti-anidadas-REVERTIR.sql'), 'utf8'));
      console.log('OK revertido: se quitaron las tablas de la segunda parte (las de origen y las de la primera parte no se tocaron)'); return;
    }
    if (modo === 'aplicar') {
      const ex = await c.query("SELECT c.relname AS n, c.relkind AS k FROM pg_class c JOIN pg_namespace s ON s.oid = c.relnamespace WHERE s.nspname = 'eti' AND c.relkind IN ('r','v','m','f','p','i','I','S') ORDER BY 1");
      const tipo = { r: 'tabla', v: 'vista', m: 'vista materializada', f: 'tabla externa', p: 'tabla', i: 'indice', I: 'indice', S: 'secuencia' };
      const choques = ex.rows.filter(x => NUEVAS.indexOf(x.n) >= 0 && !(x.k === 'r' && instalado));
      if (choques.length) { console.log('ALTO: no se creo nada. Estos nombres ya existen en el esquema eti y no son de este paquete:'); choques.forEach(x => console.log('  eti.' + x.n + '  (' + (tipo[x.k] || x.k) + ')')); console.log('\nPegale esta salida a Claude para que cambie los nombres.'); return; }
      try { await c.query(fs.readFileSync(path.join(__dirname, '02-tablas-eti-anidadas.sql'), 'utf8')); console.log('OK 02-tablas-eti-anidadas.sql (tablas y disparadores creados)'); }
      catch (e) { try { await c.query('ROLLBACK'); } catch (e2) {} throw new Error('02-tablas-eti-anidadas.sql: ' + e.message); }
      const r = await c.query('SELECT * FROM eti.tablas_reconstruir2()');
      console.log('\n== Llenado desde las tablas de origen ==');
      r.rows.forEach(x => { console.log('  ' + String(x.origen).padEnd(28) + String(x.filas).padStart(5) + ' procesadas' + (x.fallidas ? '   ' + x.fallidas + ' FALLIDAS' : '')); if (x.fallidas) mal++; });
    } else if (!instalado) { console.log('La segunda parte no esta instalada: no hay nada que comparar.'); return; }
    console.log('\n== Comparacion (lo que hay en el documento amontonado = lo que quedo en la tabla ordenada) ==');
    for (const [n, qa, qb] of COMP) {
      let va, vb; try { va = String((await c.query(qa)).rows[0].v); vb = String((await c.query(qb)).rows[0].v); } catch (e) { va = 'error'; vb = e.message.slice(0, 70); }
      const ok = Number(va) === Number(vb); if (!ok) mal++;
      console.log('  ' + (ok ? 'OK ' : 'MAL') + ' ' + n.padEnd(40) + String(va).padStart(9) + '  =  ' + String(vb).padStart(9));
    }
    const e = await c.query('SELECT tabla, COUNT(*)::int AS n, MAX(error) AS ej FROM eti._tablas_errores GROUP BY 1 ORDER BY 1');
    console.log('\n== Errores de copia anotados ==' + (e.rows.length ? '' : '\n  ninguno'));
    e.rows.forEach(x => { mal++; console.log('  ' + x.tabla + ': ' + x.n + '  (ejemplo: ' + String(x.ej).slice(0, 90) + ')'); });
    console.log('\n' + (mal ? 'RESULTADO: HAY ' + mal + ' DIFERENCIA(S). No uses las tablas nuevas todavia; pegale esta salida a Claude.' : 'RESULTADO: TODO COINCIDE. Las tablas ordenadas tienen lo mismo que los documentos amontonados.'));
  } finally { await c.end(); }
})().catch(e => { console.error('ERROR: ' + e.message); process.exit(1); });
