/* ═══════════════════════════════════════════════════════════════════════════
   Modulo ACCESO A MODULOS en Azure SQL (_ACCESO_AZURE_V1, 26-set-2026)
   Tablas (se crean solas la primera vez):
     dbo.PermisosModulos (usuario, modulo, permitido, actualizado, por)
     dbo.AccesoHorarios  (usuario, hora_inicio, hora_fin, dias, desde, hasta,
                          activo, nota, actualizado, por)
   Misma logica que las hojas "PERMISOS MODULOS" y "ACCESO HORARIOS" del
   Apps Script, con las mismas respuestas, para que la pantalla no cambie.
   ═══════════════════════════════════════════════════════════════════════════ */
const { sql, getPool } = require('./db');

let listo = null;
function asegurarTablas(pool) {
  if (!listo) listo = pool.request().query(`
    IF OBJECT_ID('dbo.PermisosModulos', 'U') IS NULL
      CREATE TABLE dbo.PermisosModulos (
        usuario NVARCHAR(60) NOT NULL, modulo NVARCHAR(80) NOT NULL, permitido BIT NOT NULL,
        actualizado DATETIME2 NULL, por NVARCHAR(60) NULL,
        CONSTRAINT PK_PermisosModulos PRIMARY KEY (usuario, modulo));
    IF OBJECT_ID('dbo.AccesoHorarios', 'U') IS NULL
      CREATE TABLE dbo.AccesoHorarios (
        usuario NVARCHAR(60) NOT NULL CONSTRAINT PK_AccesoHorarios PRIMARY KEY,
        hora_inicio NVARCHAR(5) NULL, hora_fin NVARCHAR(5) NULL, dias NVARCHAR(20) NULL,
        desde NVARCHAR(10) NULL, hasta NVARCHAR(10) NULL, activo BIT NOT NULL DEFAULT 1,
        nota NVARCHAR(300) NULL, actualizado NVARCHAR(20) NULL, por NVARCHAR(60) NULL);`)
    .catch(e => { listo = null; throw e; });
  return listo;
}

async function pool() { const p = await getPool(); await asegurarTablas(p); return p; }

const usr = (u) => String(u == null ? '' : u).toLowerCase().trim();

/* ── horarios: mismas reglas que ahHora_ / ahTxt_ / ahDias_ / ahFecha_ ── */
function hora(v) {
  if (v === null || v === undefined || v === '') return -1;
  if (typeof v === 'number') { if (v > 0 && v < 1) return v * 24; return (v >= 0 && v <= 24) ? v : -1; }
  const m = String(v).trim().match(/^(\d{1,2})(?::(\d{1,2}))?$/);
  if (!m) return -1;
  const hh = Number(m[1]), mm = Number(m[2] || 0);
  if (hh < 0 || hh > 24 || mm < 0 || mm > 59) return -1;
  return hh + mm / 60;
}
function txt(h) {
  if (h < 0) return '';
  let hh = Math.floor(h), mm = Math.round((h - hh) * 60);
  if (mm === 60) { hh += 1; mm = 0; }
  return ('0' + hh).slice(-2) + ':' + ('0' + mm).slice(-2);
}
function fecha(v) { const s = String(v || '').trim(); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ''; }
function dias(v) {
  const s = String(v === null || v === undefined ? '' : v).trim();
  if (!s) return [1, 2, 3, 4, 5, 6];
  const out = [], m = s.match(/^(\d)\s*-\s*(\d)$/);
  if (m) { for (let i = Number(m[1]); i <= Number(m[2]); i++) if (i >= 1 && i <= 7) out.push(i); return out.length ? out : [1, 2, 3, 4, 5, 6]; }
  s.split(/[,;.\s]+/).forEach(t => { const n = Number(t); if (n >= 1 && n <= 7 && out.indexOf(n) < 0) out.push(n); });
  return out.length ? out : [1, 2, 3, 4, 5, 6];
}

/* hora de Lima sin depender de la zona del servidor */
function limaAhora(d) {
  const p = {};
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' })
    .formatToParts(d || new Date()).forEach(x => { p[x.type] = x.value; });
  const dow = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[p.weekday];
  return { iso: p.year + '-' + p.month + '-' + p.day, h: Number(p.hour) + Number(p.minute) / 60, dow,
           sello: p.year + '-' + p.month + '-' + p.day + ' ' + p.hour + ':' + p.minute };
}

function filaHorario(r) {
  return { usuario: usr(r.usuario), ini: hora(r.hora_inicio), fin: hora(r.hora_fin), dias: dias(r.dias),
           desde: fecha(r.desde), hasta: fecha(r.hasta), activo: r.activo !== false && r.activo !== 0,
           nota: String(r.nota || ''), actualizado: r.actualizado ? String(r.actualizado) : '', por: String(r.por || '') };
}

module.exports = { sql, pool, usr, hora, txt, fecha, dias, limaAhora, filaHorario };
