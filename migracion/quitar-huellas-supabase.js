/* quitar-huellas-supabase.js — _SIN_CLAVES_ETI_V1 (11-nov-2026)
   Retira la huella de clave (y cualquier clave antigua) de la copia de las cuentas de los ETI en Supabase
   (eti.usuarios_eti). En Firestore ya se retiraron. Las cuentas NO se borran: solo se les quita ese campo.
   Requiere haber sacado la copia antes (respaldo-usuarios-eti.js). Se puede repetir. No muestra ninguna huella.
   Uso:  cd C:\sistema-rl-verfrut\migracion ; node quitar-huellas-supabase.js */
'use strict';
const fs = require('fs'), path = require('path'); const { Client } = require('pg');
const m = fs.readFileSync(path.join(__dirname, '.env'), 'utf8').match(/^\s*SUPABASE_DB_URL\s*=\s*(\S+)/m);
if (!m) { console.error('Falta SUPABASE_DB_URL en migracion\\.env'); process.exit(1); }
const hayCopia = (d) => { try { return fs.readdirSync(d).some(f => /^respaldo-usuarios-eti-.*\.json$/.test(f)); } catch (e) { return false; } };
if (!hayCopia('C:\\sistema-rl-backups') && !hayCopia(__dirname)) { console.error('ALTO: no encuentro la copia de seguridad. Corre primero: node respaldo-usuarios-eti.js'); process.exit(1); }
(async () => {
  const c = new Client({ connectionString: m[1].replace(/^"|"$/g, ''), ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false } }); await c.connect();
  const cuenta = async () => (await c.query("SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE datos ? 'password_hash' OR datos ? 'password')::int AS con FROM eti.usuarios_eti")).rows[0];
  const a = await cuenta();
  const r = await c.query("UPDATE eti.usuarios_eti SET datos = datos - 'password_hash' - 'password', actualizado = now() WHERE datos ? 'password_hash' OR datos ? 'password'");
  const d = await cuenta();
  let ord = null; try { ord = (await c.query('SELECT COUNT(*)::int AS n FROM eti.usuarios')).rows[0].n; } catch (e) {}
  await c.end();
  console.log('Cuentas en eti.usuarios_eti: ' + a.total + ' · con huella antes: ' + a.con + ' · limpiadas ahora: ' + r.rowCount + ' · con huella despues: ' + d.con);
  if (ord !== null) console.log('Tabla ordenada eti.usuarios: ' + ord + ' cuentas (nunca tuvo columna de clave)');
  console.log(d.con === 0 && d.total === a.total ? 'RESULTADO: LISTO. Ninguna cuenta guarda huella de clave y no se borro ninguna cuenta.' : 'RESULTADO: REVISAR. Pegale esta salida a Claude.');
})().catch(e => { console.error('ERROR: ' + e.message); process.exit(1); });
