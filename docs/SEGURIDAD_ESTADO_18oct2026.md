# Sistema RL v3.0 · Estado de seguridad y protección legal (18-oct-2026)

Revisión hecha sobre el código real (Azure Functions, Google Apps Script, reglas de Firebase, frontend)
y con sondas en vivo. No se cambió nada: este documento es diagnóstico y plan.
Nota: la parte legal es orientación general, no asesoría de abogado; conviene validarla con Legal de Unifrutti.

## 1. Qué está bien hoy

- Todo viaja cifrado (HTTPS) entre navegador, GitHub Pages, Azure y Google.
- Login en Azure con contraseñas **cifradas con bcrypt** (y migración automática de las que aún estén en texto plano).
- Sesión con token firmado (JWT, 14 h) guardado en `sessionStorage` (se borra al cerrar la pestaña).
- **Todas las escrituras en Azure exigen token válido**: guardar/editar atenciones, casos, visitas, cumplimiento,
  capacitaciones, fusiones, horas, mantenimiento, solicitudes, evaluaciones 360, usuarios y permisos.
  Quien opera sale del token firmado, no de lo que manda el navegador.
- Usuarios, permisos por módulo y horarios de acceso se administran en Azure solo por roles de administración.
- Las funciones de importación/mantenimiento masivo (`*-importar`, `*-sync`, `db-indices`, `atenciones-batch`…) exigen clave de Azure (`authLevel: function`).
- Consultas SQL parametrizadas (sin concatenar texto del usuario) en las funciones revisadas.
- Firebase: nodos de estadísticas, alertas, sistema y accesos temporales exigen usuario autenticado;
  presencia/mensajes/tráfico tienen validación de forma y tamaño.
- Trazabilidad: cada atención guarda `usuario_sistema`, `autorizado_por` y fechas; ediciones registran quién y cuándo;
  LOG_ERRORES y Monitor en vivo registran actividad; `Auth_SinToken` cuenta las llamadas sin sesión.
- Subida de PDFs de casos con SAS de **solo escritura** y vencimiento corto.
- Copias de seguridad: Azure SQL (punto en el tiempo) + hoja de Google como respaldo funcional.

## 2. Brechas encontradas (de mayor a menor importancia)

### 2.1 Lecturas de Azure sin sesión (ALTA) — "modo suave"
`JWT_REQUIRED` no está en "1". Las funciones de lectura (`mod/*`, `cv/getCasos|getVisitas`, `cumpl/*`,
`atenciones/stats`, `atenciones/by-dni`, `trabajadores/buscar`, `kpi/*`, `eti-eval-stats`) responden a
**cualquiera que conozca la URL**, sin token. Comprobado hoy: `trabajadores/buscar` devolvió nombre, DNI,
cargo y fundo sin sesión; `getSupervisores` y `atenciones/stats` también.
Riesgo: exposición de datos personales de trabajadores y supervisores. El modo suave se dejó para
desplegar backend y frontend por separado; desde el 5-oct el frontend ya manda el token en todas las
llamadas (`azure-token.js`), así que puede cerrarse.
Cómo cerrarlo sin riesgo: revisar en `dbo.Auth_SinToken` qué rutas y pantallas aún llaman sin token
(debería ser casi solo mi sonda y el despertador), corregir esas, y luego poner `JWT_REQUIRED=1` en la
configuración de la Function App (reversible en 1 minuto si algo falla).

### 2.2 Google Apps Script sin verificación de sesión (ALTA)
La API de Google (`/exec`) es pública y **no valida quién llama**: el servidor solo corrige el `rol`
según el mapa de usuarios, pero acepta el `usuario` que venga en el cuerpo. Alguien con la URL podría
leer atenciones (`getAtenciones`, `consultaDNI`, `getUsuarios`) o registrar a nombre de otro.
Mitiga hoy: Google es respaldo; lo principal ya va por Azure con token. Pero el respaldo sigue abierto.
Opciones: (a) que Google exija el mismo token JWT de Azure (verificación HMAC en GAS, ~1 h de trabajo) o
(b) exigir una clave secreta por llamada que el frontend obtenga tras el login. Recomendación: (a).

### 2.3 Contraseñas en texto plano en la hoja Usuarios de Google (ALTA)
El login de respaldo (`login` en GAS) compara la clave tal cual con la columna 3 de la hoja; y
`usuarios-sync` lee esas claves. Quien tenga acceso a la hoja ve todas las contraseñas.
Plan: hacer que el login de respaldo acepte **solo** las claves ya cifradas (bcrypt desde Azure) o
eliminar el login por Google (Azure ya está estable), y luego borrar la columna de claves de la hoja.
Mientras tanto: la hoja debe estar compartida solo con Joel (verificar "Compartir" en Drive).

### 2.4 Firebase: mensajes y tráfico legibles por cualquiera (MEDIA)
`mensajes`, `presencia` y `trafico` tienen `.read: true` y `.write: true` (presencia/mensajes) —
cualquiera con la URL de la base puede leer los mensajes internos de Coordinación a los supervisores
(pueden mencionar trabajadores) y escribir mensajes falsos a nombre de otro. `bienestar/senales` también
es escribible por cualquiera.
Plan: usar Firebase Auth anónimo (ya existe `auth != null` en otros nodos) y poner `.read/.write: auth != null`
en estos nodos; `presencia.js` y `monitor.html` ya trabajan con el SDK, solo falta iniciar sesión anónima.
Las reglas de **Firestore** (programación ETI) no están en el repositorio: revisar en la consola que no
estén en modo prueba ("allow read, write: if true").

### 2.5 Sin límite de intentos en el login (MEDIA)
`auth-login` no bloquea tras N intentos fallidos ni registra la IP. Con contraseñas sencillas, un ataque de
diccionario es posible. Plan: contador por usuario/IP en SQL (5 intentos → espera 15 min) + aviso a Joel.
Además: política mínima de contraseñas (8+ caracteres, no "123456"), y cambio de clave por el propio usuario.

### 2.6 Datos sensibles (salud, familia) en varios sistemas (MEDIA, legal)
Las atenciones registran descansos médicos, licencias, parentesco, celular y DNI. Hoy viven en Azure SQL,
en la hoja de Google, en LOG_ERRORES (fragmentos), en Firebase (tráfico con nombres) y en copias locales
(`localStorage` de atenciones pendientes y cachés). Ver sección 3.

### 2.7 Menores
- La URL de Google y la de Azure están en el código público de GitHub Pages (inevitable en una app web;
  por eso importa 2.1 y 2.2). El repositorio en GitHub debe ser **privado**.
- `local.settings.json` existe en `azure/functions/`: confirmar que está en `.gitignore` y que no se subió nunca
  con la cadena de conexión.
- CORS de la Function App: restringir a `https://joeltimoteog-bot.github.io` (hoy no se ve configuración en el repo).
- Azure SQL: confirmar firewall solo "servicios de Azure" + auditoría activada (Defender for SQL es opcional, tiene costo).

## 3. Protección legal (Perú · Ley 29733 de Protección de Datos Personales y su reglamento)

El sistema trata datos personales de trabajadores (DNI, nombre, celular, cargo, fundo) y **datos sensibles**
(salud: descansos médicos y licencias; situación familiar: parentesco; procesos disciplinarios: casos y
preavisos). Para que la empresa esté cubierta, lo habitual es:

1. **Inscripción del banco de datos** "Atenciones y gestión de Relaciones Laborales" ante la Autoridad Nacional
   de Protección de Datos Personales (ANPDP, Ministerio de Justicia). Lo hace Legal/RR.HH. de la empresa
   (RAPEL S.A.C. y VERFRUT S.A.C., cada titular). Es un trámite administrativo; sin él, la multa es la más común.
2. **Consentimiento informado / información al trabajador**: en el contrato o en un anexo de RR.HH. debe
   constar que la empresa trata sus datos (incluidos los de salud) para gestión laboral, por cuánto tiempo y
   con qué finalidad. Para gestión del vínculo laboral la ley permite el tratamiento sin consentimiento, pero
   los datos **sensibles** sí requieren consentimiento expreso y por escrito. Confirmar con Legal el formato.
3. **Deber de confidencialidad de los 34 usuarios**: un compromiso de confidencialidad firmado por cada
   supervisor/usuario del sistema (puede ser una cláusula en su contrato o un acta). Lo registramos en el sistema
   como pantalla de aceptación en el primer ingreso (fecha, usuario, versión del texto) — fácil de agregar.
4. **Medidas de seguridad documentadas** (la Directiva de Seguridad de la ANPDP las exige): control de acceso
   por usuario y rol (ya), registro de accesos (ya, Monitor + Auth_SinToken + LOG), cifrado en tránsito (ya),
   contraseñas cifradas (Azure sí; Google no, ver 2.3), copias de seguridad (ya), gestión de incidentes
   (correo del monitor), y **plazos de conservación** (definir: p. ej. atenciones 5 años, casos 5 años tras cierre,
   LOG_ERRORES 90 días, tráfico Firebase 90 días → se puede automatizar la depuración).
5. **Derechos ARCO**: un canal para que un trabajador pida acceso/rectificación/cancelación de sus datos
   (puede ser el correo de RR.LL.); el sistema ya permite consultar y editar por DNI.
6. **Encargados de tratamiento**: Microsoft (Azure, región Brasil Sur), Google (Sheets/Apps Script/Firebase) y
   GitHub (Pages, solo código). Al salir los datos del Perú corresponde declararlo como **flujo transfronterizo**
   en la inscripción del banco de datos. Los contratos estándar de estos proveedores cubren la parte técnica.
7. **Trazabilidad para procesos disciplinarios**: para que un caso o preaviso sirva como evidencia, conviene que
   el sistema conserve quién registró, cuándo y que los PDFs adjuntos no se puedan alterar: hoy el contenedor
   se escribe con SAS de corta vida; se puede activar "inmutabilidad" o versionado en el Blob Storage sin costo relevante.

## 4. Plan propuesto (orden sugerido, todo reversible)

| # | Acción | Dónde | Esfuerzo | Riesgo de ejecución |
|---|--------|-------|----------|---------------------|
| 1 | Revisar `Auth_SinToken`, corregir llamadas sin token y poner `JWT_REQUIRED=1` | Azure (config) | 1 h + 1 día de observación | Bajo (se revierte en 1 min) |
| 2 | Verificar reglas de Firestore y cerrar `mensajes/presencia/trafico/bienestar` con auth anónima | Firebase console + presencia.js/monitor.html | 2 h | Bajo |
| 3 | Login de respaldo en Google solo con claves cifradas; borrar claves en texto plano de la hoja | GAS + hoja | 2 h | Medio (probar con 2 usuarios antes) |
| 4 | Verificación del token JWT en Google Apps Script para lecturas/escrituras | GAS | 2–3 h | Medio |
| 5 | Límite de intentos de login + política mínima de contraseña + cambio de clave por el usuario | Azure auth-login + pantalla | 2 h | Bajo |
| 6 | Pantalla de aceptación de confidencialidad en el primer ingreso (texto lo da Legal) | index.html | 1 h | Bajo |
| 7 | Plazos de conservación + depuración automática (LOG_ERRORES, tráfico Firebase, cachés locales) | GAS + Firebase | 1 h | Bajo |
| 8 | Repositorio GitHub privado, CORS, firewall SQL, `local.settings.json` fuera de git, versionado del Blob | Portales | 1 h | Nulo |
| 9 | Trámites con Legal/RR.HH.: inscripción del banco de datos, consentimiento de datos sensibles, anexo de confidencialidad | Empresa | — | — |

Cada punto técnico se hará como siempre: respaldo, cambio aditivo con interruptor, prueba y publicación.
