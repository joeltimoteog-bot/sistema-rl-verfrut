# Seguridad · Paso 4: límite de intentos + contraseña mínima + cambio por el usuario (2.5)

## Qué cambió (ya hecho; respaldos .bak-18oct-antes-intentos / -clave)
- **Azure `auth/login`** (`_LOGIN_INTENTOS_V1`): 5 claves incorrectas seguidas → 15 min de espera para ese
  usuario (tabla `dbo.Login_Intentos`, se crea sola; un ingreso correcto limpia el contador). Respuesta 429 con
  `bloqueado:true` y el mensaje para el usuario. Un usuario inexistente no cuenta (para no bloquear nombres al azar).
  Interruptores: `LOGIN_INTENTOS_MAX` (5; 0 = apagado) y `LOGIN_BLOQUEO_MIN` (15).
  Además (`_CLAVE_POLITICA_V1`): al entrar evalúa la clave con la regla mínima y lo informa en el token (`cd`)
  y en la respuesta (`claveDebil`, `claveMotivos`). `CLAVE_CAMBIO_OBLIGATORIO=1` hace el cambio obligatorio (`co`).
- **Regla mínima** (`shared/clave-politica.js`, misma en pantalla): 8+ caracteres, mayúscula, minúscula, número,
  sin el usuario, no común (123456, password, verfrut, rapel, unifrutti…), no usuario+año.
- **Azure `usr/guardar/cambiarMiClave`**: cualquier usuario cambia SU clave: verifica la actual (bcrypt), exige la
  regla, guarda bcrypt en Azure y `sha256$` en la hoja (mismo camino que updateUsuario).
- **Google `login`**: mismo límite (5 fallos → 15 min, con CacheService).
- **index.html**: si Azure rechazó la clave o bloqueó por intentos, ya no se prueba por Google (antes ese
  respaldo habría permitido saltarse el límite).
- **seguridad-ui.js** (`v=3`): tras el compromiso, si la clave es débil aparece **"Actualiza tu contraseña"**
  (actual, nueva, repetir, barra y lista de requisitos en vivo; "Más tarde" salvo que sea obligatorio).
  En **Mi cuenta**: estado de la clave ("Débil: conviene cambiarla" / "Cumple la regla") y enlace **cambiar**.
- Pruebas: `outputs/t/ppw.js` (12), `pseg.js` (17), `ppol.js` (13 claves, servidor y pantalla coinciden).

## Activación
```
cd C:\sistema-rl-verfrut\azure\functions
.\publicar-azure.ps1

cd C:\sistema-rl-gas
clasp push
clasp deploy -i AKfycbxZP3UGad-XwRl7sCYmTxeex57b1hEfmqslhe5x0IOzzvpbEbM4VYFR2d52b_YMB1lyyA -d "limite de intentos en login de respaldo"

cd C:\sistema-rl-verfrut
git add azure/functions/auth-login/index.js azure/functions/shared/clave-politica.js azure/functions/shared/usr-guardar.js index.html frontend/js/seguridad-ui.js frontend/pages/dashboard.html docs/SEGURIDAD_PASO4_INTENTOS_Y_CLAVE.md
git commit -m "Seguridad: limite de intentos, regla de contrasena, cambio de clave por el usuario"
git push
```

## Cómo lo vive el usuario
- Mañana, al entrar (como casi todas las claves actuales son usuario+año), verá "Actualiza tu contraseña"
  después del compromiso. Puede pulsar "Más tarde" (se le vuelve a pedir en el siguiente ingreso) hasta que
  tú actives `CLAVE_CAMBIO_OBLIGATORIO=1` en Azure (recomendado: avisar una semana antes).
- Si se equivoca 5 veces, espera 15 minutos o te pide que le asignes una clave nueva (Gestión de Usuarios).

## Volver atrás
`LOGIN_INTENTOS_MAX=0` apaga el límite; quitar `<script seguridad-ui.js>` quita la pantalla; los `.bak` tienen
el código anterior.

## Actualización (18-oct, tarde): usuario bloqueado → desbloqueo y clave temporal por el administrador
- **Pantalla de login**: el límite visible pasa de 3 a 5 (igual que el servidor) y usa el contador real de Azure.
  Al agotar los 5 intentos aparece una ventana "Usuario bloqueado temporalmente" (15 min) que indica comunicarse
  con el administrador del sistema, Joel Timoteo, con botón **💬 Escribir a Joel por WhatsApp** (mensaje con su usuario).
- **Mi cuenta → 🛡️ Seguridad de usuarios** (solo jtimoteo): en cada fila **🔓 Desbloquear** (si tiene fallos) y
  **🔑 Nueva clave**: genera una contraseña temporal válida (editable, 🎲 para otra), la asigna, levanta el bloqueo
  y deja listo el mensaje para copiar y enviar por WhatsApp. La fila pasa a "Temporal · debe cambiarla".
- **Al entrar con la clave temporal** el usuario ve "Crea tu contraseña" sin opción "Más tarde" (obligatorio), y la
  nueva clave sirve en el RR.LL., Capacitaciones ETI y Evaluaciones ETI (todas validan contra Azure).
- Azure: columnas nuevas en `dbo.usuarios` (`clave_fuerte`, `clave_cambiada`, `clave_temporal`, se crean solas).
