/* limpiar-papelera-atenciones.js — _LIMPIAR_PAPELERA_V1 (12-nov-2026)
   Quita de Supabase las atenciones que YA estan en la PAPELERA (se "eliminaron" desde la pantalla cuando
   eliminar solo borraba la hoja de Google) y que por eso siguen contando en estadisticas y descargas.
     node limpiar-papelera-atenciones.js            -> SOLO MUESTRA lo que haria (no cambia nada)
     node limpiar-papelera-atenciones.js aplicar    -> copia cada fila completa a rl.atenciones_respaldo y la borra
   Reglas de seguridad:
     · Solo toca una atencion si hay EXACTAMENTE UNA fila con ese N° y ese DNI. Si hay mas de una, la deja y la informa.
     · Copia y borrado van en UNA transaccion: si algo falla, no se borra nada.
     · Al final vuelve a contar: deben faltar exactamente las que borro, ni una mas.
   Deshacer una: la fila completa queda en rl.atenciones_respaldo (motivo 'eliminada (papelera) 12-nov'). */
'use strict';
const fs = require('fs'), path = require('path'); const { Client } = require('pg');
const m = fs.readFileSync(path.join(__dirname, '.env'), 'utf8').match(/^\s*SUPABASE_DB_URL\s*=\s*(\S+)/m);
if (!m) { console.error('Falta migracion\\.env con SUPABASE_DB_URL'); process.exit(1); }
const GAS = 'https://script.google.com/macros/s/AKfycbxZP3UGad-XwRl7sCYmTxeex57b1hEfmqslhe5x0IOzzvpbEbM4VYFR2d52b_YMB1lyyA/exec';
const SIM = process.env.AUDIT_SIMULADO || '';
const aplicar = process.argv[2] === 'aplicar';
const MOTIVO = 'eliminada (papelera) 12-nov';
const sinCeros = (d) => String(d == null ? '' : d).trim().replace(/^0+/, '');

(async () => {
  let pares;
  try {
    if (SIM) pares = JSON.parse(fs.readFileSync(SIM, 'utf8')).pares;
    else { const r = await fetch(GAS, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ action: 'papeleraNros' }) }); const j = await r.json(); if (!j || !j.success) throw new Error('sin respuesta'); pares = j.pares || []; }
  } catch (e) { console.error('ALTO: no se pudo leer la PAPELERA de Google (' + e.message + '). No se hizo nada.'); process.exit(1); }
  const vistos = {}, lista = [];
  pares.forEach((p) => { const s = String(p).split('|'), nro = parseInt(s[0], 10), dni = sinCeros(s[1]); const k = nro + '|' + dni; if (nro && dni && !vistos[k]) { vistos[k] = 1; lista.push({ nro, dni }); } });

  const url = m[1].replace(/^"|"$/g, '');
  const c = new Client({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false } }); await c.connect();
  try {
    const antes = (await c.query('SELECT COUNT(*)::int AS n FROM rl.atenciones')).rows[0].n;
    const borrar = [], dudosas = [];
    for (const p of lista) {
      const r = await c.query(`SELECT id, nro, anio, to_char(fecha_atencion, 'YYYY-MM-DD') AS fecha, usuario_sistema::text AS usuario, estado::text AS estado
                               FROM rl.atenciones WHERE nro = $1 AND ltrim(trim(dni::text), '0') = $2 ORDER BY id`, [p.nro, p.dni]);
      if (r.rows.length === 1) borrar.push(r.rows[0]);
      else if (r.rows.length > 1) dudosas.push(p.nro + ' (' + r.rows.length + ' filas)');
    }
    console.log('\nPAPELERA: ' + lista.length + ' atenciones · en Supabase hoy: ' + antes);
    console.log((aplicar ? 'SE VAN A QUITAR ' : 'SE QUITARIAN ') + borrar.length + ' (una sola fila con ese N° y DNI):');
    borrar.forEach((x) => console.log('   N° ' + x.nro + ' · id ' + x.id + ' · ' + x.fecha + ' · registro ' + (x.usuario || '-') + ' · ' + (x.estado || '-')));
    if (dudosas.length) console.log('NO SE TOCAN (mas de una fila con ese N° y DNI; hay que verlas a mano): ' + dudosas.join(', '));
    if (!aplicar) { console.log('\nSOLO VISTA PREVIA: no se cambio nada. Para aplicar: node limpiar-papelera-atenciones.js aplicar'); return; }
    if (!borrar.length) { console.log('\nRESULTADO: NADA QUE LIMPIAR'); return; }

    const ids = borrar.map((x) => x.id);
    await c.query('BEGIN');
    try {
      const cop = await c.query(`INSERT INTO rl.atenciones_respaldo (id, datos, motivo) SELECT a.id, row_to_json(a)::text, $2 FROM rl.atenciones a WHERE a.id = ANY($1::int[])`, [ids, MOTIVO]);
      if (cop.rowCount !== ids.length) throw new Error('se esperaba copiar ' + ids.length + ' y se copiaron ' + cop.rowCount);
      const del = await c.query('DELETE FROM rl.atenciones WHERE id = ANY($1::int[])', [ids]);
      if (del.rowCount !== ids.length) throw new Error('se esperaba borrar ' + ids.length + ' y serian ' + del.rowCount);
      const medio = (await c.query('SELECT COUNT(*)::int AS n FROM rl.atenciones')).rows[0].n;
      if (medio !== antes - ids.length) throw new Error('el total no cuadra: antes ' + antes + ', ahora ' + medio);
      await c.query('COMMIT');
    } catch (e) { try { await c.query('ROLLBACK'); } catch (e2) {} console.error('\nALTO: ' + e.message + '. Se deshizo todo: no se borro NADA.'); process.exit(1); }
    const despues = (await c.query('SELECT COUNT(*)::int AS n FROM rl.atenciones')).rows[0].n;
    const resp = (await c.query('SELECT COUNT(*)::int AS n FROM rl.atenciones_respaldo WHERE motivo::text = $1', [MOTIVO])).rows[0].n;
    console.log('\nAtenciones antes: ' + antes + ' · despues: ' + despues + ' · quitadas: ' + (antes - despues) + ' · copias en el respaldo: ' + resp);
    console.log(antes - despues === ids.length && resp >= ids.length ? 'RESULTADO: LISTO' : 'RESULTADO: REVISAR');
  } finally { await c.end(); }
})().catch((e) => { console.error('ERROR: ' + e.message); process.exit(1); });
