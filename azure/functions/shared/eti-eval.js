/* ═══════════════════════════════════════════════════════════════════════════
   eti-eval (_ETI_EVAL_AZURE_V1, 30-set-2026) — Evaluaciones ETI (conocimiento)
   Tablas reales en Azure SQL:
     dbo.ETI_Evaluaciones          1 fila = 1 trabajador (QR, anonimo) o 1 ruta (manual, n evaluados)
     dbo.ETI_Evaluaciones_Seccion  % logrado por tema de cada fila
   El id lo genera la pagina (id del documento en Firebase): reenviar es seguro (no duplica).
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
const { sql } = require('./db');

let listo = null;
function asegurarTablas(pool) {
  if (!listo) listo = pool.request().query(`
    IF OBJECT_ID('dbo.ETI_Evaluaciones', 'U') IS NULL
      CREATE TABLE dbo.ETI_Evaluaciones (
        id NVARCHAR(80) NOT NULL PRIMARY KEY,
        modalidad NVARCHAR(10) NOT NULL,            -- QR | MANUAL
        sesion_id NVARCHAR(20) NULL,
        fecha DATE NOT NULL,
        empresa NVARCHAR(40) NULL,
        supervisor NVARCHAR(150) NULL,
        usuario NVARCHAR(60) NULL,
        sector NVARCHAR(150) NULL,
        tipo NVARCHAR(20) NULL,                     -- obrero | empleado
        ruta NVARCHAR(150) NULL,
        codigo NVARCHAR(60) NULL,
        evaluados INT NOT NULL DEFAULT 1,
        resultado DECIMAL(7,4) NOT NULL,            -- 0..1
        estado NVARCHAR(12) NULL,                   -- APROBADO | REFUERZO
        banco_version INT NULL,
        creado DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME());
    IF OBJECT_ID('dbo.ETI_Evaluaciones_Seccion', 'U') IS NULL
      CREATE TABLE dbo.ETI_Evaluaciones_Seccion (
        eval_id NVARCHAR(80) NOT NULL,
        sec_id NVARCHAR(40) NOT NULL,
        sec_nom NVARCHAR(120) NULL,
        peso DECIMAL(7,4) NULL,
        pct DECIMAL(7,4) NOT NULL,
        CONSTRAINT PK_ETI_Eval_Sec PRIMARY KEY (eval_id, sec_id));
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_ETI_Eval_Fecha')
      CREATE INDEX IX_ETI_Eval_Fecha ON dbo.ETI_Evaluaciones (fecha) INCLUDE (empresa, supervisor, sector, ruta, codigo, modalidad, evaluados, resultado);`)
    .catch(e => { listo = null; throw e; });
  return listo;
}

const txt = (v, n) => { const s = String(v == null ? '' : v).trim(); return s ? s.slice(0, n) : null; };
const num = (v, a, b) => { const x = Number(v); return Number.isFinite(x) ? Math.min(b, Math.max(a, x)) : null; };
const fechaOk = f => /^\d{4}-\d{2}-\d{2}$/.test(String(f || '')) ? f : null;

function normalizar(r) {
  const id = txt(r.id, 80), fecha = fechaOk(r.fecha), resultado = num(r.resultado, 0, 1);
  if (!id || !fecha || resultado == null) return null;
  const mod = String(r.modalidad || '').toUpperCase() === 'MANUAL' ? 'MANUAL' : 'QR';
  return {
    id, modalidad: mod, sesion_id: txt(r.sesion_id, 20), fecha,
    empresa: txt(r.empresa, 40), supervisor: txt(r.supervisor, 150), usuario: txt(r.usuario, 60),
    sector: txt(r.sector, 150), tipo: txt(r.tipo, 20),
    ruta: txt(String(r.ruta || '').toUpperCase(), 150), codigo: txt(String(r.codigo || '').toUpperCase(), 60),
    evaluados: Math.round(num(r.evaluados, 1, 5000) || 1), resultado,
    estado: resultado >= 0.7 ? 'APROBADO' : 'REFUERZO', banco_version: Math.round(num(r.banco_version, 0, 1e6) || 0),
    secciones: (Array.isArray(r.secciones) ? r.secciones : []).slice(0, 20).map(s => ({
      sec_id: txt(s.id, 40), sec_nom: txt(s.nom, 120), peso: num(s.peso, 0, 1), pct: num(s.pct, 0, 1)
    })).filter(s => s.sec_id && s.pct != null)
  };
}

/* Inserta los que no existen (idempotente, 1 viaje a SQL por registro). */
async function guardar(pool, lista) {
  const ok = [], out = { insertados: 0, existentes: 0, invalidos: 0 };
  lista.forEach(r => { const n = normalizar(r || {}); if (n) ok.push(n); else out.invalidos++; });
  for (const r of ok) {
    const q = pool.request();
    Object.entries({ id: r.id, modalidad: r.modalidad, sesion_id: r.sesion_id, fecha: r.fecha, empresa: r.empresa,
      supervisor: r.supervisor, usuario: r.usuario, sector: r.sector, tipo: r.tipo, ruta: r.ruta, codigo: r.codigo,
      estado: r.estado }).forEach(([k, v]) => q.input(k, sql.NVarChar, v));
    q.input('evaluados', sql.Int, r.evaluados); q.input('resultado', sql.Decimal(7, 4), r.resultado);
    q.input('banco_version', sql.Int, r.banco_version);
    const vals = r.secciones.map((s, i) => {
      q.input('s' + i, sql.NVarChar, s.sec_id); q.input('n' + i, sql.NVarChar, s.sec_nom);
      q.input('w' + i, sql.Decimal(7, 4), s.peso); q.input('c' + i, sql.Decimal(7, 4), s.pct);
      return `(@id,@s${i},@n${i},@w${i},@c${i})`;
    });
    const res = await q.query(`
      SET XACT_ABORT ON;
      IF EXISTS (SELECT 1 FROM dbo.ETI_Evaluaciones WHERE id=@id) SELECT 0 AS nuevo;
      ELSE BEGIN
        BEGIN TRAN;
        INSERT INTO dbo.ETI_Evaluaciones (id,modalidad,sesion_id,fecha,empresa,supervisor,usuario,sector,tipo,ruta,codigo,evaluados,resultado,estado,banco_version)
        VALUES (@id,@modalidad,@sesion_id,@fecha,@empresa,@supervisor,@usuario,@sector,@tipo,@ruta,@codigo,@evaluados,@resultado,@estado,@banco_version);
        ${vals.length ? 'INSERT INTO dbo.ETI_Evaluaciones_Seccion (eval_id,sec_id,sec_nom,peso,pct) VALUES ' + vals.join(',') + ';' : ''}
        COMMIT;
        SELECT 1 AS nuevo;
      END`);
    const nuevo = res.recordset && res.recordset[0] && res.recordset[0].nuevo === 1;
    if (nuevo) out.insertados++; else out.existentes++;
  }
  return out;
}

/* Filas agregadas por dia/empresa/supervisor/sector/ruta/codigo/modalidad (+ temas) */
async function stats(pool, f) {
  const q = pool.request(), w = ['1=1'];
  const add = (k, cond, tipo, v) => { if (v) { q.input(k, tipo, v); w.push(cond); } };
  add('desde', 'e.fecha >= @desde', sql.Date, fechaOk(f.desde));
  add('hasta', 'e.fecha <= @hasta', sql.Date, fechaOk(f.hasta));
  add('empresa', 'e.empresa = @empresa', sql.NVarChar, txt(f.empresa, 40));
  add('sector', 'e.sector = @sector', sql.NVarChar, txt(f.sector, 150));
  add('modalidad', 'e.modalidad = @modalidad', sql.NVarChar, ['QR', 'MANUAL'].includes(String(f.modalidad || '').toUpperCase()) ? String(f.modalidad).toUpperCase() : null);
  const W = w.join(' AND ');
  const keys = 'CONVERT(char(10), e.fecha, 23) AS fecha, e.empresa, e.supervisor, e.sector, e.ruta, e.codigo, e.modalidad';
  const grp = 'e.fecha, e.empresa, e.supervisor, e.sector, e.ruta, e.codigo, e.modalidad';
  const r1 = await q.query(`
    SELECT ${keys}, SUM(e.evaluados) AS n, SUM(e.resultado * e.evaluados) AS sr,
           SUM(CASE WHEN e.resultado >= 0.7 THEN e.evaluados ELSE 0 END) AS apr, COUNT(*) AS regs,
           SUM(CASE WHEN e.resultado >= 0.0 AND e.resultado < 0.1 THEN e.evaluados ELSE 0 END) AS b0,
           SUM(CASE WHEN e.resultado >= 0.1 AND e.resultado < 0.2 THEN e.evaluados ELSE 0 END) AS b1,
           SUM(CASE WHEN e.resultado >= 0.2 AND e.resultado < 0.3 THEN e.evaluados ELSE 0 END) AS b2,
           SUM(CASE WHEN e.resultado >= 0.3 AND e.resultado < 0.4 THEN e.evaluados ELSE 0 END) AS b3,
           SUM(CASE WHEN e.resultado >= 0.4 AND e.resultado < 0.5 THEN e.evaluados ELSE 0 END) AS b4,
           SUM(CASE WHEN e.resultado >= 0.5 AND e.resultado < 0.6 THEN e.evaluados ELSE 0 END) AS b5,
           SUM(CASE WHEN e.resultado >= 0.6 AND e.resultado < 0.7 THEN e.evaluados ELSE 0 END) AS b6,
           SUM(CASE WHEN e.resultado >= 0.7 AND e.resultado < 0.8 THEN e.evaluados ELSE 0 END) AS b7,
           SUM(CASE WHEN e.resultado >= 0.8 AND e.resultado < 0.9 THEN e.evaluados ELSE 0 END) AS b8,
           SUM(CASE WHEN e.resultado >= 0.9 AND e.resultado <= 1.0 THEN e.evaluados ELSE 0 END) AS b9
      FROM dbo.ETI_Evaluaciones e WHERE ${W} GROUP BY ${grp};
    SELECT ${keys}, s.sec_id, MAX(s.sec_nom) AS sec_nom, SUM(s.pct * e.evaluados) AS sp
      FROM dbo.ETI_Evaluaciones e JOIN dbo.ETI_Evaluaciones_Seccion s ON s.eval_id = e.id
     WHERE ${W} GROUP BY ${grp}, s.sec_id;`);
  const clave = r => [r.fecha, r.empresa, r.supervisor, r.sector, r.ruta, r.codigo, r.modalidad].join('|');
  const m = new Map();
  (r1.recordsets[0] || []).forEach(r => m.set(clave(r), { fecha: r.fecha, empresa: r.empresa, supervisor: r.supervisor, sector: r.sector,
    ruta: r.ruta, codigo: r.codigo, modalidad: r.modalidad, n: Number(r.n) || 0, sr: Number(r.sr) || 0, apr: Number(r.apr) || 0, regs: Number(r.regs) || 0,
    bins: [0,1,2,3,4,5,6,7,8,9].map(i => Number(r['b' + i]) || 0), secs: {} }));
  (r1.recordsets[1] || []).forEach(r => { const g = m.get(clave(r)); if (g) g.secs[r.sec_id] = { nom: r.sec_nom, sp: Number(r.sp) || 0 }; });
  return [...m.values()];
}

/* ── Administración (solo admin con token): editar / eliminar por filtro ── */
function whereFiltro(q, f) {
  const w = [], ids = Array.isArray(f.ids) ? f.ids.map(x => txt(x, 80)).filter(Boolean).slice(0, 2000) : [];
  if (ids.length) { ids.forEach((v, i) => q.input('id' + i, sql.NVarChar, v)); w.push('id IN (' + ids.map((_, i) => '@id' + i).join(',') + ')'); }
  const add = (k, cond, tipo, v) => { if (v != null && v !== '') { q.input(k, tipo, v); w.push(cond); } };
  add('f_ses', 'sesion_id = @f_ses', sql.NVarChar, txt(f.sesion_id, 20));
  add('f_sector', 'sector = @f_sector', sql.NVarChar, txt(f.sector, 150));
  add('f_ruta', 'ruta = @f_ruta', sql.NVarChar, f.ruta != null ? txt(String(f.ruta).toUpperCase(), 150) : null);
  if (f.codigo != null) { q.input('f_cod', sql.NVarChar, txt(String(f.codigo).toUpperCase(), 60)); w.push("ISNULL(codigo,'') = ISNULL(@f_cod,'')"); }
  add('f_desde', 'fecha >= @f_desde', sql.Date, fechaOk(f.desde));
  add('f_hasta', 'fecha <= @f_hasta', sql.Date, fechaOk(f.hasta));
  add('f_mod', 'modalidad = @f_mod', sql.NVarChar, ['QR', 'MANUAL'].includes(String(f.modalidad || '').toUpperCase()) ? String(f.modalidad).toUpperCase() : null);
  /* nunca un filtro "vacio": exige ids, sesion o sector/ruta */
  if (!ids.length && !f.sesion_id && !f.sector && f.ruta == null) throw new Error('Filtro demasiado amplio');
  return w.join(' AND ');
}
async function eliminar(pool, f) {
  const q = pool.request(); const W = whereFiltro(q, f || {});
  const r = await q.query(`SET XACT_ABORT ON; BEGIN TRAN;
    DELETE FROM dbo.ETI_Evaluaciones_Seccion WHERE eval_id IN (SELECT id FROM dbo.ETI_Evaluaciones WHERE ${W});
    DELETE FROM dbo.ETI_Evaluaciones WHERE ${W}; SELECT @@ROWCOUNT AS n; COMMIT;`);
  return { eliminados: (r.recordset && r.recordset[0] && r.recordset[0].n) || 0 };
}
async function editar(pool, f, c) {
  const q = pool.request(); const W = whereFiltro(q, f || {}); const set = [];
  if (c && c.sector) { q.input('c_sector', sql.NVarChar, txt(c.sector, 150)); set.push('sector = @c_sector'); }
  if (c && c.ruta) { q.input('c_ruta', sql.NVarChar, txt(String(c.ruta).toUpperCase(), 150)); set.push('ruta = @c_ruta'); }
  if (c && c.codigo != null) { q.input('c_cod', sql.NVarChar, txt(String(c.codigo).toUpperCase(), 60)); set.push('codigo = @c_cod'); }
  if (!set.length) throw new Error('Sin cambios');
  const r = await q.query(`UPDATE dbo.ETI_Evaluaciones SET ${set.join(', ')} WHERE ${W}; SELECT @@ROWCOUNT AS n;`);
  return { editados: (r.recordset && r.recordset[0] && r.recordset[0].n) || 0 };
}

module.exports = { asegurarTablas, guardar, stats, normalizar, eliminar, editar };
