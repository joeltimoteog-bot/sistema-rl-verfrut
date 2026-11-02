/* ════════════════════════════════════════════════════════════════════════
   shared/login-audit.js — _LOGIN_AUDIT_V1 (02-nov-2026) · Registro de ingresos al sistema
   Tabla dbo.Login_Sesiones: una fila por intento de ingreso (correcto o fallido) y por renovación/SSO.
     fecha (UTC), usuario, rol, empresa, sistema (RRLL / RENOVAR / SSO-ETI / SSO-BIENESTAR),
     resultado (ok / clave_incorrecta / bloqueado / inexistente / inactivo / vencido / invalido),
     ip (pública, x-forwarded-for), dispositivo (SO + navegador del user-agent), ua (user-agent
     completo, 300 chars), sid (identificador corto de la sesión = claim 'sid' del token).
   Nunca interrumpe el login: todo va en try/catch y se dispara sin esperar.
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const { sql } = require('./db');
const crypto = require('crypto');

let lista = null;
function asegurar(pool) {
  if (!lista) lista = pool.request().query(`
    IF OBJECT_ID('dbo.Login_Sesiones', 'U') IS NULL BEGIN
      CREATE TABLE dbo.Login_Sesiones (
        id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Login_Sesiones PRIMARY KEY,
        fecha DATETIME2(0) NOT NULL CONSTRAINT DF_Login_Sesiones_fecha DEFAULT SYSUTCDATETIME(),
        usuario NVARCHAR(100) NOT NULL, rol NVARCHAR(40) NULL, empresa NVARCHAR(40) NULL,
        sistema NVARCHAR(30) NOT NULL, resultado NVARCHAR(30) NOT NULL,
        ip NVARCHAR(60) NULL, dispositivo NVARCHAR(120) NULL, ua NVARCHAR(300) NULL, sid NVARCHAR(24) NULL);
      CREATE INDEX IX_Login_Sesiones_fecha ON dbo.Login_Sesiones (fecha DESC);
      CREATE INDEX IX_Login_Sesiones_usuario ON dbo.Login_Sesiones (usuario, fecha DESC);
    END`).catch(e => { lista = null; throw e; });
  return lista;
}

function ipDe(req) {
  try { return String(((req.headers || {})['x-forwarded-for'] || '')).split(',')[0].replace(/:\d+$/, '').trim().slice(0, 60) || null; } catch (e) { return null; }
}
function uaDe(req) { try { return String((req.headers || {})['user-agent'] || '').slice(0, 300); } catch (e) { return ''; } }
function dispositivo(ua) {
  ua = String(ua || '');
  let so = 'Otro';
  if (/Windows NT 10|Windows NT 11/.test(ua)) so = 'Windows'; else if (/Windows/.test(ua)) so = 'Windows (antiguo)';
  else if (/Android/.test(ua)) so = 'Android'; else if (/iPhone/.test(ua)) so = 'iPhone'; else if (/iPad/.test(ua)) so = 'iPad';
  else if (/Mac OS X/.test(ua)) so = 'Mac'; else if (/CrOS/.test(ua)) so = 'Chromebook'; else if (/Linux/.test(ua)) so = 'Linux';
  let nav = 'Otro';
  if (/Edg\//.test(ua)) nav = 'Edge'; else if (/OPR\//.test(ua)) nav = 'Opera'; else if (/SamsungBrowser/.test(ua)) nav = 'Samsung';
  else if (/Chrome\//.test(ua)) nav = 'Chrome'; else if (/Firefox\//.test(ua)) nav = 'Firefox'; else if (/Safari\//.test(ua)) nav = 'Safari';
  const tipo = /Mobile|Android|iPhone/.test(ua) ? 'celular' : (/iPad|Tablet/.test(ua) ? 'tablet' : 'PC');
  return (so + ' · ' + nav + ' · ' + tipo).slice(0, 120);
}
function nuevoSid() { return crypto.randomBytes(9).toString('base64').replace(/[+/=]/g, '').slice(0, 12); }

/* registra sin bloquear: devuelve una promesa que nunca rechaza */
function registrar(pool, req, d) {
  return (async () => {
    try {
      await asegurar(pool);
      const ua = uaDe(req);
      await pool.request()
        .input('u', sql.NVarChar(100), String(d.usuario || '').toLowerCase().slice(0, 100))
        .input('r', sql.NVarChar(40), d.rol ? String(d.rol).slice(0, 40) : null)
        .input('e', sql.NVarChar(40), d.empresa ? String(d.empresa).slice(0, 40) : null)
        .input('s', sql.NVarChar(30), String(d.sistema || 'RRLL').slice(0, 30))
        .input('x', sql.NVarChar(30), String(d.resultado || 'ok').slice(0, 30))
        .input('ip', sql.NVarChar(60), ipDe(req))
        .input('dv', sql.NVarChar(120), dispositivo(ua))
        .input('ua', sql.NVarChar(300), ua || null)
        .input('sid', sql.NVarChar(24), d.sid ? String(d.sid).slice(0, 24) : null)
        .query('INSERT INTO dbo.Login_Sesiones (usuario, rol, empresa, sistema, resultado, ip, dispositivo, ua, sid) VALUES (@u, @r, @e, @s, @x, @ip, @dv, @ua, @sid)');
    } catch (e) { /* la auditoría nunca frena el ingreso */ }
  })();
}

/* lectura para administradores */
async function listar(pool, { dias = 7, usuario = '', limite = 500 } = {}) {
  await asegurar(pool);
  const rq = pool.request().input('d', sql.Int, Math.max(1, Math.min(365, parseInt(dias, 10) || 7))).input('n', sql.Int, Math.max(1, Math.min(5000, parseInt(limite, 10) || 500)));
  let w = 'fecha >= DATEADD(day, -@d, SYSUTCDATETIME())';
  if (usuario) { rq.input('u', sql.NVarChar(100), String(usuario).toLowerCase()); w += ' AND usuario = @u'; }
  const r = await rq.query(`SELECT TOP (@n) id, fecha, usuario, rol, empresa, sistema, resultado, ip, dispositivo, sid FROM dbo.Login_Sesiones WHERE ${w} ORDER BY fecha DESC`);
  return r.recordset.map(x => Object.assign({}, x, { fecha_lima: x.fecha ? new Date(new Date(x.fecha).getTime() - 5 * 3600e3).toISOString().slice(0, 19).replace('T', ' ') : '' }));
}

module.exports = { asegurar, registrar, listar, ipDe, dispositivo, nuevoSid };
