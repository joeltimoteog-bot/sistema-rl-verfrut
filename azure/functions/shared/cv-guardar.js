/* ═══════════════════════════════════════════════════════════════════════════
   _CV_AZURE_PRIMERO_V1 (26-set-2026) — CASOS y VISITAS se guardan PRIMERO en Azure
   ---------------------------------------------------------------------------
   Motor comun (lo usan cv-guardar con el token del login y cv-guardar-admin con
   la llave, para pruebas). Replica lo que hacen en la hoja saveCaso, updateCaso
   (+ fecha de cierre de cumplimiento), saveVisita, updateVisita, eliminarCaso y
   eliminarVisita, pero sobre dbo.Casos / dbo.Visitas.
   · N°: contador por tipo con candado (nunca se repite, ni con 200 a la vez).
   · client_id: si la misma operacion llega dos veces devuelve la misma respuesta.
   · Cada operacion queda en dbo.CV_Ops: el Apps Script la copia a la hoja (con el
     MISMO N°) y ahi siguen funcionando historial, contadores, alertas y correos.
   · Eliminar mueve el registro a dbo.Casos_Eliminados / dbo.Visitas_Eliminadas.
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
const { sql } = require('./db');
const TC = require('./tablas-cv');
const cvDb = require('./cv-db');

const ADMINS_ELIMINAR = ['jtimoteo', 'mportocarrero', 'jfernandez', 'lcovenas'];   /* = ADMINS_ELIMINAR_CASO / _VISITA del Apps Script */
const TIPO = { saveCaso: 'casos', updateCaso: 'casos', eliminarCaso: 'casos', saveVisita: 'visitas', updateVisita: 'visitas', eliminarVisita: 'visitas' };
const ELIM = { casos: 'dbo.Casos_Eliminados', visitas: 'dbo.Visitas_Eliminadas' };

let listo = null;
function asegurarTablas(pool) {
  if (!listo) listo = (async () => {
    await cvDb.asegurarTablas(pool);
    await TC.asegurarTablas(pool, 'casos'); await TC.asegurarTablas(pool, 'visitas');
    const elim = t => {
      const cols = TC.COLS[t].map(c => c[2] === 'fotos' ? 'fotos NVARCHAR(MAX) NULL, fotos_n FLOAT NULL' : c[0] + ' ' + tipoSql(c[2])).join(', ');
      return `IF OBJECT_ID('${ELIM[t]}', 'U') IS NULL CREATE TABLE ${ELIM[t]} (id INT IDENTITY(1,1) NOT NULL PRIMARY KEY, ${cols},
        eliminado_por NVARCHAR(100) NULL, fecha_eliminacion DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(), motivo_eliminacion NVARCHAR(1000) NULL);`;
    };
    await pool.request().query(`
      IF OBJECT_ID('dbo.CV_Contador', 'U') IS NULL
        CREATE TABLE dbo.CV_Contador (tipo NVARCHAR(20) NOT NULL PRIMARY KEY, ultimo INT NOT NULL, actualizado DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME());
      IF OBJECT_ID('dbo.CV_Ops', 'U') IS NULL
        CREATE TABLE dbo.CV_Ops (id INT IDENTITY(1,1) NOT NULL PRIMARY KEY, clave NVARCHAR(100) NOT NULL CONSTRAINT UQ_CV_Ops_clave UNIQUE,
          tipo NVARCHAR(20) NOT NULL, accion NVARCHAR(30) NOT NULL, nro INT NULL, usuario NVARCHAR(100) NULL,
          cuerpo NVARCHAR(MAX) NOT NULL, respuesta NVARCHAR(MAX) NULL, en_hoja BIT NOT NULL DEFAULT 0,
          creado DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(), aplicado DATETIME2(0) NULL, error NVARCHAR(500) NULL);
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CV_Ops_pend') CREATE INDEX IX_CV_Ops_pend ON dbo.CV_Ops(en_hoja, id);
      ${elim('casos')}
      ${elim('visitas')}`);
  })().catch(e => { listo = null; throw e; });
  return listo;
}
function tipoSql(t) {
  if (t === 'int') return 'INT NULL';
  if (t === 'num') return 'FLOAT NULL';
  if (t === 'fecha' || t === 'fechaflex') return 'DATETIME2(3) NULL';
  if (t === 'dni') return 'NVARCHAR(15) NULL';
  if (t === 'tmax') return 'NVARCHAR(MAX) NULL';
  if (t === 'tfecha100') return 'NVARCHAR(100) NULL';
  return 'NVARCHAR(' + t.slice(1) + ') NULL';
}

async function encendido(pool) {
  const r = await pool.request().query("SELECT valor FROM dbo.CV_Estado WHERE clave = 'azure_primero'");
  return r.recordset.length && r.recordset[0].valor === '1';
}

/* ── valores como los guardaria la hoja ── */
const LIMA = 5 * 3600e3;
function limaHoy() { const x = new Date(Date.now() - LIMA); return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate(), 5)); }
function aFecha(v) {
  if (v === '' || v === null || v === undefined) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 5));              /* dia calendario de Lima, como la hoja */
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1], 5));
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
function valor(v, tipo) {
  if (v === '' || v === null || v === undefined) return tipo === 'fotos' ? [null, null] : null;
  if (tipo === 'int') { const n = parseInt(v, 10); return isNaN(n) ? null : n; }
  if (tipo === 'num') { if (typeof v === 'number') return v; const s = String(v).trim(); return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : null; }
  if (tipo === 'fecha' || tipo === 'fechaflex') return aFecha(v);
  if (tipo === 'dni') return String(v).trim().slice(0, 15);
  if (tipo === 'fotos') return typeof v === 'number' ? [null, v] : [String(v), null];
  if (tipo === 'tmax') return String(v);
  if (tipo === 'tfecha100') return String(v).slice(0, 100);
  return String(v).slice(0, parseInt(tipo.slice(1), 10));
}
function tipoMssql(t) {
  if (t === 'int') return sql.Int;
  if (t === 'num') return sql.Float;
  if (t === 'fecha' || t === 'fechaflex') return sql.DateTime2(3);
  if (t === 'dni') return sql.NVarChar(15);
  if (t === 'tmax') return sql.NVarChar(sql.MAX);
  if (t === 'tfecha100') return sql.NVarChar(100);
  return sql.NVarChar(parseInt(t.slice(1), 10));
}
/* celdas por indice de columna de la hoja → { columna: valor } */
function aColumnas(tipo, celdas) {
  const out = {};
  TC.COLS[tipo].forEach(c => {
    if (!(c[1] in celdas)) return;
    const v = valor(celdas[c[1]], c[2]);
    if (c[2] === 'fotos') { out.fotos = v[0]; out.fotos_n = v[1]; } else out[c[0]] = v;
  });
  return out;
}
function tipoDe(tipo, col) {
  if (col === 'fotos') return 'tmax'; if (col === 'fotos_n') return 'num';
  const c = TC.COLS[tipo].find(x => x[0] === col); return c ? c[2] : 'tmax';
}
function entradas(req, tipo, cols) {
  Object.keys(cols).forEach((k, i) => req.input('c' + i, tipoMssql(tipoDe(tipo, k)), cols[k]));
  return Object.keys(cols);
}

/* ── lo que escribe cada funcion de la hoja, por indice de columna ── */
const D = (d, k) => (d[k] === undefined || d[k] === null) ? '' : d[k];
function filaNuevoCaso(d, nro, ahora) {
  return { 0: nro, 1: ahora, 2: d.dni || '', 3: d.nombre || '', 4: d.empresa || '', 5: d.cargo || '', 6: d.sector || '',
    7: d.ingreso || '', 8: d.termino || '', 9: d.supervisor || '', 10: d.motivo || '', 11: d.motivo_extra || '',
    12: d.fecha_reporte || '', 13: d.fecha_limite || '', 14: d.temporada || '',
    15: d.estado_caso || d.estado_plazo || d.estado || '',
    16: d.porcentaje !== undefined ? d.porcentaje : (d.porcentaje_avance || 0),
    17: d.dias_retraso !== undefined ? d.dias_retraso : (d.dias_habiles_transcurridos || 0),
    18: d.motivo_retraso || '', 19: d.redaccion || '', 20: d.nombre_informe || '', 21: d.enlace_informe || '',
    22: d.nombre_reporte || '', 23: d.enlace_reporte || '', 24: d.registrado_por || '', 25: d.gravedad || 'BAJO',
    26: d.estado_gestion || 'PENDIENTE', 27: d.tipo_sancion || '', 28: d.sancion_fecha_inicio || '',
    29: d.sancion_fecha_fin || '', 30: d.sancion_dias || 0 };
}
function cambiosCaso(d) {
  const c = {};
  const si = (k, i) => { if (d[k] !== undefined) c[i] = d[k]; };
  si('motivo', 10); si('motivo_extra', 11); si('fecha_reporte', 12); si('fecha_limite', 13); si('temporada', 14);
  if (d.estado_caso !== undefined) c[15] = d.estado_caso; else if (d.estado_plazo !== undefined) c[15] = d.estado_plazo; else if (d.estado !== undefined) c[15] = d.estado;
  if (d.porcentaje !== undefined) c[16] = d.porcentaje; else if (d.porcentaje_avance !== undefined) c[16] = d.porcentaje_avance;
  if (d.dias_retraso !== undefined) c[17] = d.dias_retraso; else if (d.dias_habiles_transcurridos !== undefined) c[17] = d.dias_habiles_transcurridos;
  si('motivo_retraso', 18); si('redaccion', 19); si('nombre_informe', 20); si('enlace_informe', 21); si('nombre_reporte', 22);
  si('enlace_reporte', 23); si('gravedad', 25); si('estado_gestion', 26); si('tipo_sancion', 27);
  si('sancion_fecha_inicio', 28); si('sancion_fecha_fin', 29); si('sancion_dias', 30);
  return c;
}
/* estado de la visita: mismos calculos que saveVisita (dias sin domingos desde fecha_fin, en hora de Lima) */
function estadoVisita(d) {
  let estado = 'EN PLAZO';
  if (d.fecha_fin) {
    const ff = new Date(d.fecha_fin);
    if (!isNaN(ff.getTime())) {
      const hoy = new Date(Date.now() - LIMA);
      const cur = new Date(ff.getTime() - LIMA);
      let dias = 0;
      cur.setUTCDate(cur.getUTCDate() + 1);
      while (cur <= hoy) { if (cur.getUTCDay() !== 0) dias++; cur.setUTCDate(cur.getUTCDate() + 1); }
      if (dias > 7) estado = 'RETRASADO';
    }
  }
  return estado;
}
function fotosDe(d) {
  if (Array.isArray(d.fotos_urls)) return d.fotos_urls.filter(Boolean).join('|');
  if (typeof d.fotos === 'string' && d.fotos.indexOf('http') !== -1) return d.fotos;
  return '';
}
function filaNuevaVisita(d, nro, ahora, estado, fotosStr) {
  const f = { 0: nro, 1: ahora, 2: d.empresa || '', 3: d.supervisor || '', 4: d.dni || '', 5: d.correo || '', 6: d.fundo || '',
    7: d.punto || '', 8: d.fecha_inicio || '', 9: d.fecha_fin || '', 10: d.semana || '', 11: d.fecha_informe || '',
    12: d.para || '', 13: d.asunto || '', 14: d.desarrollo || '', 15: d.rutas || '', 16: d.acciones || '',
    17: d.compromisos || '', 18: d.observaciones || '', 19: d.motivo || '', 20: fotosStr, 21: estado,
    22: d.registrado_por || '', 23: d.temporada || '', 24: d.dias_transcurridos || 0, 25: d.dias_permitidos || 1,
    26: d.dias_retraso || 0, 27: d.pct_avance || '0.00', 28: d.pct_retraso || '0.00' };
  if (d.enlace_informe) f[29] = String(d.enlace_informe);
  return f;
}
function cambiosVisita(d) {
  const c = {};
  [['empresa', 2], ['fundo', 6], ['punto', 7], ['fecha_inicio', 8], ['fecha_fin', 9], ['semana', 10], ['fecha_informe', 11],
   ['desarrollo', 14], ['rutas', 15], ['acciones', 16], ['compromisos', 17], ['observaciones', 18], ['motivo', 19]]
    .forEach(p => { c[p[1]] = d[p[0]] || ''; });
  return c;
}
const CONCLUIDO = s => ['CERRADO', 'CONCLUIDO', 'RESUELTO', 'FINALIZADO'].some(x => String(s || '').toUpperCase().indexOf(x) >= 0);

/* ═══ ejecutar una operacion ═══
   devuelve { status, body }  (body = lo mismo que responderia el Apps Script) */
async function ejecutar(pool, accion, b, usuario, prueba) {
  const tipo = TIPO[accion];
  if (!tipo) return { status: 404, body: { success: false, error: 'Accion desconocida' } };
  const T = TC.TABLA[tipo], d = Object.assign({}, b); delete d.client_id; delete d.action;
  const clave = String(b.client_id || '').replace(/[^\w-]/g, '').slice(0, 90);
  const claveOp = clave ? accion + ':' + clave : accion + ':sin-huella-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);

  if (clave && !prueba) {
    const p = await pool.request().input('k', sql.NVarChar(100), claveOp).query('SELECT respuesta FROM dbo.CV_Ops WHERE clave = @k');
    if (p.recordset.length && p.recordset[0].respuesta) return { status: 200, body: Object.assign(JSON.parse(p.recordset[0].respuesta), { duplicadoEvitado: true }) };
  }
  if ((accion === 'eliminarCaso' || accion === 'eliminarVisita')) {
    if (!usuario || ADMINS_ELIMINAR.indexOf(String(usuario).trim().toLowerCase()) < 0)
      return { status: 403, body: { success: false, error: accion === 'eliminarCaso' ? 'Sin permisos: solo administradores autorizados pueden eliminar casos' : 'Sin permisos: solo administradores pueden eliminar visitas' } };
    if (!d.nro) return { status: 400, body: { success: false, error: accion === 'eliminarCaso' ? 'Numero de caso requerido' : 'Numero de visita requerido' } };
    if (accion === 'eliminarCaso' && String(d.motivo || '').trim().length < 10) return { status: 400, body: { success: false, error: 'El motivo es obligatorio y debe tener al menos 10 caracteres' } };
  }
  if ((accion === 'updateCaso' || accion === 'updateVisita') && (d.nro === undefined || d.nro === '')) return { status: 400, body: { success: false, error: 'Falta el N°' } };

  const tx = new sql.Transaction(pool);
  await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  let resp, nro = null, cuerpoHoja = Object.assign({}, d);
  try {
    /* candado por tipo: todas las operaciones de casos (o de visitas) pasan en fila india */
    const c = await tx.request().input('t', sql.NVarChar(20), tipo).query(`
      SELECT (SELECT ultimo FROM dbo.CV_Contador WITH (UPDLOCK, HOLDLOCK) WHERE tipo = @t) AS ultimo,
             (SELECT MAX(nro) FROM ${T}) AS maxT, (SELECT MAX(nro) FROM ${ELIM[tipo]}) AS maxE, (SELECT MAX(fila) FROM ${T}) AS maxF`);
    const k0 = c.recordset[0];
    if (k0.ultimo === null || k0.ultimo === undefined) throw new Error('Contador de ' + tipo + ' sin iniciar (ejecutar cvAzurePrimeroActivar en el Apps Script)');
    const ahora = new Date();

    if (accion === 'saveCaso' || accion === 'saveVisita') {
      nro = Math.max(k0.ultimo || 0, k0.maxT || 0, k0.maxE || 0) + 1;
      let celdas, extra = {};
      if (accion === 'saveCaso') celdas = filaNuevoCaso(d, nro, ahora);
      else {
        const estado = estadoVisita(d), fotosStr = fotosDe(d);
        celdas = filaNuevaVisita(d, nro, ahora, estado, fotosStr);
        extra = { estado, fotos_count: fotosStr ? fotosStr.split('|').length : 0, enlace_informe: d.enlace_informe || '' };
        cuerpoHoja._estadoAzure = estado;
      }
      const cols = aColumnas(tipo, celdas); cols.fila = (k0.maxF || 0) + 1;
      const r = tx.request(); const nombres = Object.keys(cols);
      nombres.forEach((k, i) => r.input('c' + i, k === 'fila' ? sql.Int : tipoMssql(tipoDe(tipo, k)), cols[k]));
      await r.query(`INSERT INTO ${T} (${nombres.join(', ')}) VALUES (${nombres.map((k, i) => '@c' + i).join(', ')})`);
      await tx.request().input('t', sql.NVarChar(20), tipo).input('n', sql.Int, nro)
        .query('UPDATE dbo.CV_Contador SET ultimo = @n, actualizado = SYSUTCDATETIME() WHERE tipo = @t');
      resp = Object.assign({ success: true, nro }, extra);
      cuerpoHoja._nroAzure = nro; cuerpoHoja._fechaAzure = ahora.toISOString();
    } else {
      nro = parseInt(d.nro, 10);
      const f = await tx.request().input('n', sql.NVarChar(40), String(d.nro))
        .query(`SELECT TOP 1 * FROM ${T} WHERE CAST(nro AS NVARCHAR(40)) = @n ORDER BY fila`);
      const fila = f.recordset[0];
      if (!fila) {
        await tx.rollback();
        return { status: 404, body: { success: false, error: accion === 'eliminarCaso' ? 'Caso N° ' + d.nro + ' no encontrado' : accion === 'eliminarVisita' ? 'Visita N° ' + d.nro + ' no encontrada' : (tipo === 'casos' ? 'Caso no encontrado.' : 'Visita no encontrada.') } };
      }
      if (accion === 'updateCaso' || accion === 'updateVisita') {
        const cols = aColumnas(tipo, accion === 'updateCaso' ? cambiosCaso(d) : cambiosVisita(d));
        if (accion === 'updateCaso') {   /* cumplimiento: fecha de cierre al pasar a concluido (col 33) */
          const nuevoEst = d.estado_gestion !== undefined ? d.estado_gestion : fila.estado_gestion;
          if (CONCLUIDO(nuevoEst) && !CONCLUIDO(fila.estado_gestion) && !fila.fecha_cierre) { cols.fecha_cierre = limaHoy(); cuerpoHoja._cierreAzure = '1'; }
        }
        cols.actualizado = new Date();
        const r = tx.request(); const nombres = Object.keys(cols);
        nombres.forEach((k, i) => r.input('c' + i, k === 'actualizado' ? sql.DateTime2(0) : tipoMssql(tipoDe(tipo, k)), cols[k]));
        r.input('id', sql.Int, fila.id);
        if (nombres.length) await r.query(`UPDATE ${T} SET ${nombres.map((k, i) => k + ' = @c' + i).join(', ')} WHERE id = @id`);
        resp = { success: true };
      } else {
        const colsE = TC.COLS[tipo].map(x => x[2] === 'fotos' ? 'fotos, fotos_n' : x[0]).join(', ');
        await tx.request().input('id', sql.Int, fila.id).input('u', sql.NVarChar(100), String(usuario))
          .input('m', sql.NVarChar(1000), String(d.motivo || (accion === 'eliminarVisita' ? 'Sin motivo especificado' : '')).trim())
          .query(`INSERT INTO ${ELIM[tipo]} (${colsE}, eliminado_por, motivo_eliminacion) SELECT ${colsE}, @u, @m FROM ${T} WHERE id = @id;
                  DELETE FROM ${T} WHERE id = @id;
                  UPDATE ${T} SET fila = fila - 1 WHERE fila > ${fila.fila};`);
        resp = { success: true, mensaje: (tipo === 'casos' ? 'Caso N° ' : 'Visita N° ') + d.nro + ' archivad' + (tipo === 'casos' ? 'o' : 'a') + ' correctamente',
                 eliminado_por: usuario, fecha: ahora.toISOString() };
        cuerpoHoja.usuario = usuario;
      }
    }
    /* la pantalla y cumplimiento vuelven a leer la tabla */
    await tx.request().input('k', sql.NVarChar(40), 'tablas_' + tipo).input('v', sql.NVarChar(400), String(Date.now()))
      .query(`MERGE dbo.CV_Estado AS x USING (SELECT @k AS clave) AS s ON x.clave = s.clave
              WHEN MATCHED THEN UPDATE SET valor = @v, actualizado = SYSUTCDATETIME()
              WHEN NOT MATCHED THEN INSERT (clave, valor) VALUES (@k, @v);`);
    resp.fuente = 'azure';
    await tx.request().input('k', sql.NVarChar(100), claveOp).input('t', sql.NVarChar(20), tipo).input('a', sql.NVarChar(30), accion)
      .input('n', sql.Int, isNaN(nro) ? null : nro).input('u', sql.NVarChar(100), usuario ? String(usuario) : null)
      .input('c', sql.NVarChar(sql.MAX), JSON.stringify(cuerpoHoja)).input('r', sql.NVarChar(sql.MAX), JSON.stringify(resp))
      .query('INSERT INTO dbo.CV_Ops (clave, tipo, accion, nro, usuario, cuerpo, respuesta) VALUES (@k, @t, @a, @n, @u, @c, @r)');
    if (prueba) { await tx.rollback(); resp.prueba = true; } else await tx.commit();
  } catch (e) {
    try { await tx.rollback(); } catch (e2) {}
    if (clave && /UQ_CV_Ops_clave|duplicate key/i.test(e.message || '')) {
      const p = await pool.request().input('k', sql.NVarChar(100), claveOp).query('SELECT respuesta FROM dbo.CV_Ops WHERE clave = @k');
      if (p.recordset.length && p.recordset[0].respuesta) return { status: 200, body: Object.assign(JSON.parse(p.recordset[0].respuesta), { duplicadoEvitado: true }) };
    }
    throw e;
  }
  return { status: 200, body: resp };
}

module.exports = { asegurarTablas, encendido, ejecutar, estadoVisita, TIPO, _t: { filaNuevoCaso, cambiosCaso, filaNuevaVisita, cambiosVisita, aColumnas, valor } };
