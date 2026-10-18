# Seguridad · Paso 1: cerrar las lecturas de Azure sin sesión (_LECTURAS_SESION_V1)

Qué se logra: ninguna consulta a Azure (datos de trabajadores, atenciones, casos, visitas, cumplimiento,
supervisores, fusiones, mantenimiento…) responde sin una sesión válida del sistema. El servidor de Google
(Apps Script) sigue funcionando porque se identifica con su clave de funciones.

Qué cambió en el código (ya está hecho, con respaldos `.bak-18oct-antes-lecturas`):
- `shared/auth.js`: acepta como "llamada interna" la cabecera `x-functions-key` cuando coincide con la
  variable `INTERNAL_API_KEY` (admite varias claves separadas por coma); nueva función `exigirSesionLectura`
  con interruptor `LECTURAS_CON_SESION`.
- `mod/index.js`, `cv/index.js`, `cumpl/index.js`: candado al inicio. Con el interruptor apagado se comportan
  exactamente como hoy (solo anotan en `Auth_SinToken`).
- Las funciones que ya usaban `exigirAuth` (stats, by-dni, trabajadores/buscar, cap-firmas, blob-sas, list,
  create, update, batch, sync) pasan a exigir sesión cuando `JWT_REQUIRED=1`, y aceptan la clave interna.
- `kpi/*`, `usuarios/lista`, `usr/*`, `acceso/*` y todas las escrituras ya exigían token: sin cambios.
- `etieval/stats` y `etieval/guardar` quedan abiertos a propósito: la evaluación ETI es anónima
  (no hay login del trabajador) y las estadísticas son agregadas, sin datos personales.

Pruebas: `outputs/t/pauth.js` (12 casos: apagado, encendido, token bueno/vencido/basura, clave interna
correcta/incorrecta, JWT_REQUIRED). Todas OK.

## Activación por etapas (cada etapa es reversible cambiando una variable)

### Etapa A — publicar el código (sin cambio de comportamiento)
```
cd C:\sistema-rl-verfrut\azure\functions
.\publicar-azure.ps1
```
Luego `git add azure/functions/shared/auth.js azure/functions/mod/index.js azure/functions/cv/index.js azure/functions/cumpl/index.js docs/SEGURIDAD_*.md; git commit -m "Seguridad: lecturas con sesion (interruptor) + clave interna para Apps Script"; git push`.

### Etapa B — configurar la clave interna (Portal de Azure)
1. Apps Script: Configuración del proyecto → Propiedades del script → copiar `AZURE_API_KEY` y, si existe,
   `AZURE_HOST_KEY`. Además, en `Código.js` línea ~8010 hay una clave fija `AZURE_FUNCTION_KEY` (copiarla también).
2. Portal de Azure → Function App `rl-functions-verfrut` → Configuración → Variables de entorno → Agregar:
   - `INTERNAL_API_KEY` = las claves copiadas, separadas por coma (sin espacios).
   Guardar (la app se reinicia sola, ~30 s; los usuarios no lo notan: cola de 25 s + respaldo Google).
3. Comprobar que las claves son válidas: en el portal → Function App → Claves de la aplicación (App keys)
   deben aparecer ahí (host keys). Si alguna ya no existe, el Apps Script tampoco la está usando con éxito.

### Etapa C — leer Auth_SinToken (quién llama sin sesión hoy)
En Azure SQL (Query editor), antes de encender:
```
SELECT dia, ruta, motivo, origen, n FROM dbo.Auth_SinToken WHERE dia >= DATEADD(day,-7,GETDATE()) ORDER BY n DESC;
```
Lo esperado: casi todo con `origen` = script.google.com (Apps Script) o vacío (sondas/monitor).
Si aparece una página del sistema (github.io/…html) con muchas llamadas, avisarme antes de encender:
sería una pantalla que llama sin token y habría que corregirla primero.

### Etapa D — encender las lecturas con sesión
Portal → Variables de entorno → Agregar `LECTURAS_CON_SESION` = `1` → Guardar.
Verificación (yo lo hago desde Chrome): sin sesión `mod/sup/getSupervisores` y `cv/getCasos` deben responder
401; con sesión, todo igual que antes. Observar 1 día: LOG_ERRORES sin `azure_http 401` de usuarios y
el Monitor de Google sin alertas.

### Etapa E — exigir token en el resto (stats, buscar, by-dni, cap-firmas, blob-sas…)
Portal → Variables de entorno → `JWT_REQUIRED` = `1` → Guardar. Misma verificación.

### Volver atrás
Poner la variable en `0` (o borrarla) y Guardar: en 30 s vuelve el comportamiento anterior. No hace falta
republicar nada.

## Efecto para los usuarios
Ninguno mientras estén logueados (el frontend manda el token en todas las llamadas desde el 5-oct).
Si una sesión vence (14 h), las lecturas pasan al respaldo de Google y al guardar aparece el aviso
"Tu sesión venció… vuelve a entrar", como ya ocurre hoy.
