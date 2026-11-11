'use strict';
/* padron-sync.js — _PADRON_SYNC_V1 (10-nov-2026, decision de Joel: "todo conectado al padron")
   Lleva al PADRON UNICO (rl.personas) lo que se registra en otras pantallas, para no agregar a la misma persona en varios
   lugares. Regla: el padron manda. Aqui solo se COMPLETA lo que el padron tiene vacio o se CREA la persona que falta;
   nunca se pisa un dato que ya esta en el padron ni se da de baja a nadie. Si algo falla, no afecta al guardado original.
   Apagar: secreto PADRON_SYNC=0. */
const SP = 'SET LOCAL search_path TO rl, public, extensions';
const norm = (t) => String(t || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();
const palabras = (t) => norm(t).split(' ').filter(w => w.length >= 3);
function mismaPersona(a, b) {
  const A = palabras(a), B = palabras(b); if (A.length < 2 || B.length < 2) return false;
  const corta = A.length <= B.length ? A : B, larga = A.length <= B.length ? B : A;
  return corta.every(w => larga.indexOf(w) >= 0);
}
function rolDe(cargo) { const c = norm(cargo); return /ASIST/.test(c) && /RELACION|RR|LABORAL/.test(c) ? 'ASISTENTE_RL' : /SUPERV/.test(c) ? 'SUPERVISOR_GH' : null; }
const vacio = (v) => v === null || v === undefined || String(v).trim() === '';

/* lista = [{ dni, nombre, cargo, sector, empresa, correo }] (lo que guarda el boton "Supervisores" de Visitas de Campo) */
async function desdeSupervisores(lista, operador, log) {
  if (process.env.PADRON_SYNC === '0') return { ok: true, apagado: true };
  const db = require('./db'); if (typeof db.pgDirecto !== 'function') return { ok: false, motivo: 'sin postgres' };
  const cli = await db.pgDirecto().connect();
  const out = { ok: true, creados: 0, completados: 0, sinCambio: 0 };
  try {
    await cli.query('BEGIN'); await cli.query(SP);
    const sect = (await cli.query('SELECT codigo, nombre, alias FROM rl.sectores')).rows;
    const sectorDe = (n) => { const k = norm(n); if (!k) return null; for (const s of sect) { if (norm(s.codigo).replace(/ /g, '') === k.replace(/ /g, '') || norm(s.nombre) === k || String(s.alias || '').split('|').some(a => norm(a) === k)) return s.codigo; } return null; };
    for (const x of (Array.isArray(lista) ? lista : [])) {
      const dni = String((x && x.dni) || '').trim(), nombre = String((x && x.nombre) || '').trim();
      if (!/^\d{8}$/.test(dni) || palabras(nombre).length < 2) continue;
      const empresa = /^(RAPEL|VERFRUT|OLMOS|AMBAS)$/.test(norm(x.empresa)) ? norm(x.empresa) : null;
      const correo = /^[^\s@,;]+@[^\s@,;]+\.[a-z]{2,}$/i.test(String(x.correo || '').trim()) ? String(x.correo).trim().toLowerCase() : null;
      const cargo = String(x.cargo || '').trim().slice(0, 160) || null, sector = sectorDe(x.sector), rol = rolDe(x.cargo);
      let p = (await cli.query('SELECT * FROM rl.personas WHERE dni = $1 LIMIT 1', [dni])).rows[0];
      if (!p) {   /* misma persona escrita sin DNI en el padron */
        const sinDni = (await cli.query('SELECT * FROM rl.personas WHERE dni IS NULL')).rows.filter(r => mismaPersona(nombre, (r.nombres || '') + ' ' + (r.apellidos || '')) || mismaPersona(nombre, r.nombre_mostrar) || String(r.alias || '').split('|').some(a => mismaPersona(nombre, a)));
        if (sinDni.length === 1) p = sinDni[0];
      }
      if (!p && (x.activo === false || String(x.activo).toUpperCase() === 'NO')) continue;   /* un retirado que no esta en el padron no se crea como vigente */
      if (p) {
        const set = [], vals = []; const pon = (col, v) => { if (v !== null && vacio(p[col])) { vals.push(v); set.push(col + ' = $' + vals.length); } };
        pon('dni', dni); pon('cargo', cargo); pon('empresa', empresa); pon('sector', sector); pon('correo', correo); pon('rol_campo', rol);
        if (!set.length) { out.sinCambio++; continue; }
        vals.push(String(operador || 'supervisores')); vals.push(p.id);
        await cli.query(`UPDATE rl.personas SET ${set.join(', ')}, actualizado = (now() at time zone 'utc'), actualizado_por = $${vals.length - 1} WHERE id = $${vals.length}`, vals);
        out.completados++;
      } else {
        const w = nombre.replace(/\s+/g, ' ').split(' ');
        /* la hoja de Supervisores trae el nombre en un solo campo: se parte por la mitad y se deja una nota para revisarlo */
        const corte = w.length >= 4 ? 2 : 1, nombres = w.slice(0, corte).join(' '), apellidos = w.slice(corte).join(' ') || nombres;
        const pal = (s) => norm(s).toLowerCase().split(' ')[0] || '';
        let codigo = ([pal(nombres), pal(apellidos)].filter(Boolean).join('-') || 'persona').slice(0, 50), n = 1;
        while ((await cli.query('SELECT 1 FROM rl.personas WHERE codigo = $1', [n === 1 ? codigo : codigo + '-' + n])).rows.length && n < 60) n++;
        if (n > 1) codigo = codigo + '-' + n;
        await cli.query(`INSERT INTO rl.personas (codigo, dni, apellidos, nombres, nombre_mostrar, cargo, empresa, sector, rol_campo, correo, vigente, notas, actualizado, actualizado_por)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 1, $11, (now() at time zone 'utc'), $12)`,
          [codigo, dni, apellidos, nombres, nombre, cargo, empresa, sector, rol, correo, 'Creado automaticamente desde el boton Supervisores de Visitas de Campo. Revisar nombres y apellidos, usuario y marcas de KPI / Cumplimiento.', String(operador || 'supervisores')]);
        out.creados++;
      }
    }
    await cli.query('COMMIT');
  } catch (e) {
    try { await cli.query('ROLLBACK'); } catch (x) {}
    out.ok = false; out.motivo = e.message; try { if (log && log.warn) log.warn('[padron-sync] ' + e.message); } catch (x) {}
  } finally { cli.release(); }
  return out;
}

/* la marca "Se le miden los KPIs" del padron gobierna rl.kpi_personas.activo (y crea la fila si falta). Dentro de la transaccion del padron. */
async function marcaKpi(cli, opcional, fila) {
  if (process.env.PADRON_SYNC === '0' || !fila || !fila.usuario) return null;
  const t = await opcional(cli, 'sp_kt', "SELECT data_type FROM information_schema.columns WHERE table_schema = 'rl' AND table_name = 'kpi_personas' AND column_name = 'activo'");
  if (!t || !t.rows.length) return null;
  const on = Number(fila.evalua_kpi) === 1, val = /bool/i.test(t.rows[0].data_type) ? (on ? 'true' : 'false') : (on ? '1' : '0');
  const u = await opcional(cli, 'sp_ku', `UPDATE rl.kpi_personas SET activo = ${val} WHERE lower(usuario::text) = lower($1) AND activo IS DISTINCT FROM ${val}`, [String(fila.usuario)]);
  if (u && u.rowCount) return on ? 'KPIs (activado)' : 'KPIs (desactivado)';
  if (!on) return null;
  const ya = await opcional(cli, 'sp_ky', 'SELECT 1 FROM rl.kpi_personas WHERE lower(usuario::text) = lower($1)', [String(fila.usuario)]);
  if (!ya || ya.rows.length) return null;
  const tipo = fila.rol_campo === 'ASISTENTE_RL' ? 'ASIST' : 'SUP';
  const nom = norm(String(fila.apellidos || '') + ' ' + String(fila.nombres || ''));
  const i = await opcional(cli, 'sp_ki', `INSERT INTO rl.kpi_personas (usuario, dni, nombre, empresa, tipo, puesto, ingreso, alias, orden, activo)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 99, ${val})`,
    [String(fila.usuario), fila.dni ? String(fila.dni) : null, nom, fila.empresa || null, tipo, fila.cargo ? String(fila.cargo).toUpperCase() : null, fila.desde || null, norm(fila.nombre_mostrar) || null]);
  return i && i.rowCount ? 'KPIs (agregado)' : null;
}
module.exports = { desdeSupervisores, marcaKpi, _t: { mismaPersona, rolDe, norm } };
