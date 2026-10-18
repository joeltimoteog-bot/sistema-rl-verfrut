# Seguridad · Paso 3: la hoja Usuarios deja de guardar contraseñas legibles (_CLAVE_HOJA_SHA_V1)

Problema (informe 2.3): la columna C de la hoja `Usuarios` (Google Sheets) tenía las 34 contraseñas en texto
plano y el login de respaldo (Apps Script) las comparaba tal cual. Quien tuviera acceso a la hoja veía todas.

Solución (sin costo): en la hoja se guarda `sha256$<sal>$<hex>`; el Apps Script lo verifica con
`Utilities.computeDigest` (nativo). En Azure sigue bcrypt. En ningún lugar queda la clave legible.

## Qué cambió (ya hecho, con respaldos .bak-18oct-antes-sha / -clavesha)
- **Azure `shared/usr-guardar.js`**: al crear o cambiar una clave desde Gestión de Usuarios, a Azure va bcrypt
  y a la hoja va `sha256$…` (antes iba el bcrypt, que el Apps Script no podía verificar).
- **Azure `usuarios-sync`**: si la hoja trae `sha256$…` o bcrypt, conserva la clave que Azure ya tiene
  (antes podía pisarla).
- **Apps Script `Código.js`**: `login` verifica con `_claveCoincide_` (sha256 → hash; texto plano → igualdad
  mientras no se migre); `saveUsuario`/`updateUsuario` y la copia desde Azure cifran antes de escribir;
  funciones nuevas `usuariosCifrarClavesHojaVer()` (solo cuenta) y `usuariosCifrarClavesHoja()` (migra).
- Pruebas: `outputs/t/pclave.js` (10 casos: formato, verificación, sal, legado, compatibilidad Azure↔Google, ñ).

## Activación (en este orden)
1. Azure:
   ```
   cd C:\sistema-rl-verfrut\azure\functions
   .\publicar-azure.ps1
   ```
2. Google:
   ```
   cd C:\sistema-rl-gas
   clasp push
   clasp deploy -i AKfycbxZP3UGad-XwRl7sCYmTxeex57b1hEfmqslhe5x0IOzzvpbEbM4VYFR2d52b_YMB1lyyA -d "claves de la hoja cifradas (sha256)"
   ```
   Hasta aquí nada cambia: las claves legibles siguen funcionando (modo legado).
3. Migración (una vez, 1 minuto): abrir el editor del Apps Script
   https://script.google.com/home/projects/1CNKmgeAKxGWujcHnas4Ss5QPbZb3SyHgKEvH4DnKwwB21GAEqx2ec2Uw/edit
   → en la lista de funciones (arriba) elegir **usuariosCifrarClavesHojaVer** → Ejecutar → ver en "Registro de
   ejecución": "claves legibles: 34 | ya cifradas: 0". Luego elegir **usuariosCifrarClavesHoja** → Ejecutar →
   debe decir "Claves cifradas en la hoja: 34" y "legibles: 0".
4. Verificación: entrar al sistema con tu usuario (va por Azure: igual que siempre). El login de respaldo por
   Google queda verificado por las pruebas; si algún día Azure cae, los usuarios entran igual con su clave.
5. Guardar en GitHub:
   ```
   cd C:\sistema-rl-verfrut
   git add azure/functions/shared/usr-guardar.js azure/functions/usuarios-sync/index.js docs/SEGURIDAD_PASO3_CLAVES_HOJA.md
   git commit -m "Seguridad: la hoja Usuarios guarda sha256 en vez de claves legibles; sync compatible"
   git push
   ```

## Volver atrás
No hay forma de "descifrar" la hoja (ese es el punto). Si hiciera falta reponer la clave de alguien, se cambia
desde Gestión de Usuarios (va a Azure y a la hoja cifrada). El código anterior está en los `.bak`.

## Consecuencias para ti
- Ya no verás las contraseñas de los usuarios en la hoja. Para ayudar a alguien que la olvidó: Gestión de
  Usuarios → editar → nueva contraseña (queda cifrada en los dos lados).
- Las contraseñas actuales siguen un patrón muy fácil de adivinar (usuario + año). Con la hoja cifrada ya no se
  ven, pero siguen siendo débiles: el paso 2.5 (contraseña mínima + cambio obligatorio + límite de intentos)
  es el siguiente que conviene hacer.
