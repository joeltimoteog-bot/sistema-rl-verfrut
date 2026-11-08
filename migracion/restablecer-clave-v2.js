/* restablecer-clave.js — (08-nov-2026) Restablece la contraseña de UN usuario del Sistema RR.LL. directamente en
   Supabase (tabla rl.usuarios, hash bcrypt igual al que usa el servidor) y limpia su contador de intentos.
   Solo para el administrador, desde su PC. La clave se escribe oculta y no se guarda en ningún archivo.
   Uso (PowerShell): $p=Read-Host 'Clave nueva' -AsSecureString; $env:RL_CLAVE_NUEVA=[Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($p)); node restablecer-clave.js jtimoteo; Remove-Item Env:RL_CLAVE_NUEVA */
'use strict';
require('fs').readFileSync(require('path').join(__dirname, '.env'), 'utf8').split(/\r?\n/).forEach(l => { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); });
const { Client } = require('pg'); const bcrypt = require('bcryptjs');
(async () => {
  /* usuario por argumento; clave por variable de entorno RL_CLAVE_NUEVA (la pone PowerShell leyendola oculta) */
  const u = String(process.argv[2] || '').trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,40}$/.test(u)) throw new Error('indica el usuario: node restablecer-clave.js jtimoteo');
  const p1 = String(process.env.RL_CLAVE_NUEVA || '');
  if (p1.length < 8) throw new Error('falta la clave (RL_CLAVE_NUEVA) o tiene menos de 8 caracteres');
  const c = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } }); await c.connect();
  const t = (await c.query(`SELECT table_schema FROM information_schema.tables WHERE table_name='usuarios' AND table_schema IN ('rl','dbo','public') ORDER BY (table_schema='rl') DESC LIMIT 1`)).rows[0];
  if (!t) throw new Error('no encuentro la tabla usuarios');
  const S = t.table_schema;
  const ex = (await c.query(`SELECT usuario, activo FROM "${S}"."usuarios" WHERE lower(usuario)=$1`, [u])).rows[0];
  if (!ex) throw new Error('el usuario ' + u + ' no existe en Supabase');
  const hash = await bcrypt.hash(p1, 10);
  await c.query(`UPDATE "${S}"."usuarios" SET password=$2 WHERE lower(usuario)=$1`, [u, hash]);
  try { await c.query(`UPDATE "${S}"."usuarios" SET clave_temporal=0 WHERE lower(usuario)=$1`, [u]); } catch (e) {}
  try { await c.query(`DELETE FROM "${S}"."login_intentos" WHERE lower(usuario)=$1`, [u]); } catch (e) {}
  const ok = await bcrypt.compare(p1, (await c.query(`SELECT password FROM "${S}"."usuarios" WHERE lower(usuario)=$1`, [u])).rows[0].password);
  console.log(ok ? 'OK: clave de ' + u + ' restablecida en Supabase (esquema ' + S + '), intentos limpiados. Ya puedes ingresar.' : 'ERROR: la verificación no coincide');
  await c.end();
})().catch(e => { console.error('ERROR: ' + e.message); process.exit(1); });
