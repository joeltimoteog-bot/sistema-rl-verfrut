/* ═══════════════════════════════════════════════════════════════════════════
   shared/clave-politica.js — _CLAVE_POLITICA_V1 (18-oct-2026)
   Regla minima de contraseña del Sistema RL (misma en el login, en el cambio de
   clave y en la pantalla): 8+ caracteres, una mayuscula, una minuscula, un numero,
   y que no contenga el usuario ni sea del tipo usuario+año o 123456.
   evaluar(clave, usuario) -> { ok, motivos: [...] }
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
const COMUNES = ['123456', '12345678', 'password', 'contrasena', 'contraseña', 'qwerty', 'abc123', 'verfrut', 'rapel', 'unifrutti', 'admin'];
function evaluar(clave, usuario) {
  const c = String(clave == null ? '' : clave), u = String(usuario == null ? '' : usuario).trim().toLowerCase();
  const motivos = [];
  if (c.length < 8) motivos.push('Mínimo 8 caracteres');
  if (!/[A-ZÁÉÍÓÚÑ]/.test(c)) motivos.push('Al menos una mayúscula');
  if (!/[a-záéíóúñ]/.test(c)) motivos.push('Al menos una minúscula');
  if (!/\d/.test(c)) motivos.push('Al menos un número');
  const cl = c.toLowerCase();
  if (u && u.length >= 3 && cl.indexOf(u) >= 0) motivos.push('No puede contener tu usuario');
  if (COMUNES.some(x => cl === x || cl === x + '2025' || cl === x + '2026')) motivos.push('Es una contraseña muy común');
  if (/^[a-z]+\d{2,4}$/.test(cl) && u && cl.indexOf(u) === 0) motivos.push('No puede ser usuario + año');
  return { ok: motivos.length === 0, motivos };
}
module.exports = { evaluar };
