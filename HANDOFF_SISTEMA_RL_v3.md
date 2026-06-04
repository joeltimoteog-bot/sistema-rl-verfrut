# 📋 SISTEMA RL v3.0 — HANDOFF COMPLETO
**Fecha:** 04 de junio de 2026
**Usuario:** Joel Timoteo Gonza — Coordinador RR.LL. Verfrut/RAPEL Perú
**Estado:** EN PRODUCCIÓN con pendientes priorizados

---

## 🎯 CONTEXTO GENERAL

Joel administra el Sistema RL v3.0 que gestiona ~14-17 supervisores de campo en Verfrut/RAPEL (Unifrutti Group). Es el único desarrollador y admin de la plataforma.

**Arquitectura:**
- **Frontend:** GitHub Pages (HTML/CSS/JS vanilla) — `https://joeltimoteog-bot.github.io/sistema-rl-verfrut/`
- **Backend GAS:** Google Apps Script proyecto "Registro de Atenciones Diarias"
- **Database 1 (legado):** Google Sheets ID `1q79u2S3ZI_Qc-YnDzgnQwyv4jL7pxTuARiXICPPXgZw`
- **Database 2 (nuevo):** Azure SQL `rapel-sql-server.database.windows.net` DB `sistema-rl-db`
- **Realtime:** Firebase RTDB `sistema-rl-verfrut-default-rtdb`
- **Storage:** Azure Blob `sistemarlverfrut` (containers: `casos-rl`, `visitas-campo`)
- **Functions:** Azure Functions `rl-functions-verfrut-c0ctfjc0cjf5f0hz.brazilsouth-01.azurewebsites.net/api`

**URL GAS deployment:**
```
https://script.google.com/macros/s/AKfycbxZP3UGad-XwRl7sCYmTxeex57b1hEfmqslhe5x0IOzzvpbEbM4VYFR2d52b_YMB1lyyA/exec
```

**Repo local Joel:** `C:\sistema-rl-verfrut`
**Backup GAS local:** `C:\sistema-rl-verfrut\backend\gas\codigo.gs` (no es source of truth — eso es script.google.com)

---

## 📐 SCHEMA CONFIRMADO HOY (CRÍTICO)

**Hoja `BB. DE REGISTROS 2026`** (y similares 2024, 2025):

| Índice (0-based) | Columna | Contenido |
|---|---|---|
| 0 | A | nro (correlativo) |
| **1** | **B** | **fecha_atencion** ← ESTE ES EL FIX QUE SE PERDIÓ HOY |
| 2 | C | hora_inicio |
| 3 | D | hora_termino |
| 4 | E | nro_semana |
| 5 | F | mes |
| 6 | G | anio |
| **7** | **H** | **DNI** |
| 8 | I | nombre |
| 9 | J | sexo |
| 10 | K | fecha_inicio_periodo |
| 11 | L | empresa |
| 12 | M | fundo |
| 13 | N | cargo |
| 14 | O | ruta |
| 15 | P | codigo |
| 16 | Q | fundo_actual |
| 17 | R | celular |
| **18** | **S** | **supervisor** (NOMBRES COMPLETOS, ej: "SERGIO VIERA GIRON") |
| 19 | T | detalle_documento ("01 CITT - EMPRESA VERFRUT", "11 OTROS TRAMITES") |
| 20 | U | fecha_inicio_doc |
| 21 | V | fecha_termino_doc |
| 22 | W | dias_transcurridos |
| 23 | X | responsable_recepcion ("ALBERT PACHERRE", "JAIME SIANCAS") |
| 24 | Y | observaciones |
| 25 | Z | estado ("FINALIZADO", "EN PROCESO") |
| 26 | AA | fecha_registro |
| 27 | AB | usuario_sistema (USERNAMES: "fzapata", "sviera") |

**Constante COLS en codigo.gs:** array de 28 strings que mapea índices a nombres.

---

## ✅ LO QUE SE HIZO HOY (04/06/2026)

### Grupo 3+4: Visitas de Campo — DEPLOYADO ✅

**Backend GAS deployado:**
- `_asegurarColEnlaceInformeVisita(ws)` — detecta/crea columna "Enlace Informe PDF"
- `saveVisita` reescrita — appendRow con 29 cols + enlace_informe dinámico
- `getVisitas` reescrita — detecta columna enlace, parsea fotos como array de URLs Azure

**Frontend dashboard.html deployado:**
- FIX 1: `_calcSemanaISO()` — semana ISO 8601 estándar
- FIX 2: Botones nuevos en tabla visitas — `btnPDF` (verde) y `btnReenviar` (morado)
- FIX 3: Fotos persistentes con `_cargarFotosEnEdicion(v)` — paralelo con Promise.all
- `_generarYSubirPDFInforme()` — genera PDF con html2pdf, sube a Azure Blob
- `descargarPDFVisita()` — usa `window.print()` (NO html2pdf) por bugs de PDF en blanco
- `_PDF_FOTOS_FIX_V1`: fetch + base64 de fotos para evitar CORS
- Modal `mReenvioVisita` movido a posición correcta (estaba dentro de template literal)

### Lección aprendida HOY (BUG GRAVE) 🐛

**Lo que rompió:** Le pasé a Joel 2 patches al backend (`PATCH_CONSULTA_DNI_FINAL.gs` v3 y `PATCH_CONSULTA_DNI_V4.gs` v4) que usaban `r[0]` para fecha de atención, cuando en realidad la fecha está en `r[1]` (columna B). Resultado: filtro de fecha descartaba TODOS los registros → `consultaDNI` siempre devolvía total: 0.

**Cómo se resolvió:** Joel eliminó ambos bloques del codigo.gs. La función `consultaDNI` original (línea ~470) sigue ahí y usa correctamente `rows[i][1]`. Joel debe deployar nueva versión.

### Estado actual de `consultaDNI` (después del cleanup)

La función original que SÍ funciona ya está en codigo.gs:
- Acepta: dni, fechaDesde, fechaHasta, supervisor
- Lee hojas `BB. DE REGISTROS YYYY` (2024, 2025, 2026 + base)
- Fecha en `rows[i][1]` ✅
- DNI en `rows[i][7]` ✅
- Supervisor matchea contra `rows[i][18]` con contains + exact
- Enriquece con ruta/codigo/cumpleanos desde caché Trabajadores

### Estado actual de `getResponsablesEnRango`

- **Sin fechas:** devuelve usernames (col 1 de hoja Usuarios) — `rmolero`, `sviera`...
- **Con fechas:** devuelve nombres completos (col 18 de registros) — `SERGIO VIERA GIRON`...

**Joel reportó esto como confuso.** Decisión tomada: cambiar a "siempre nombres completos" (NO implementado todavía).

---

## ⏸️ PENDIENTES PRIORITARIOS

### 🔴 P0 — Validar deploy de cleanup

Joel debe:
1. Confirmar que eliminó los bloques `PATCH CONSULTA DNI v3` y `PATCH CONSULTA DNI v4` del codigo.gs
2. Ctrl+F → `function consultaDNI` debe aparecer **1 sola vez**
3. Guardar + Implementar nueva versión
4. **Test:** URL ↓ debe devolver `total > 0`

```
.../exec?action=consultaDNI&rol=administrador&fechaDesde=2026-06-03&fechaHasta=2026-06-03&anio=2026
```

### 🟠 P1 — Migración Consulta DNI a Azure SQL (10x más rápido)

Joel pidió esto explícitamente. Plan:

1. **Frontend:** modificar `consultarDNI()` en dashboard.html para llamar directamente a:
   ```
   https://rl-functions-verfrut-c0ctfjc0cjf5f0hz.brazilsouth-01.azurewebsites.net/api/atenciones
   ?dni=XXX&desde=YYYY-MM-DD&hasta=YYYY-MM-DD&supervisor=XXX
   ```
2. El endpoint Azure `/api/atenciones` ya existe y soporta esos filtros (visto en `listAtencionesAzure`)
3. Mantener fallback a GAS si Azure falla
4. Esperado: < 300ms vs 3-8s actuales

**Pendiente verificar:**
- Si el endpoint Azure requiere `x-functions-key` o es anonymous
- Si la key puede exponerse en el frontend o debe ir vía GAS

### 🟡 P2 — Dropdown de Responsable: siempre nombres completos

Joel eligió esta opción. Cambio en `getResponsablesEnRango`:
- Caso SIN fechas: leer col 3 (nombre) de hoja Usuarios en vez de col 1 (usuario)
- Caso CON fechas: ya está OK (col 18 de registros)

**Patch generado pero NO pegado todavía:** `PATCH_DROPDOWN_NOMBRES_COMPLETOS.gs` (en outputs). Joel pidió no tocar nada hasta validar lo anterior.

### 🔵 P3 — Migración Buscar Trabajador a Azure (Grupo 2)

Pendiente de sesión anterior:
- `trabajadores-search/index.js` modificado en `/mnt/user-data/outputs/trabajadores-search-index.js`
- Soporta `?q=` multi-modo (DNI exact, DNI prefix, nombre LIKE)
- Deploy: `func azure functionapp publish rl-functions-verfrut --javascript --build remote`
- Después aplicar el script Python que reemplaza `buscarTrab()` para usar Azure directo

### 🔵 P4 — Bugs latentes (no urgentes)

1. `getEstadisticas` dedupe-by-nro descarta 2024/2025 records (no production impact, Azure SQL es source of truth)
2. `cTendAnual` rendering truncated years (202-, 204-) en Chart.js
3. Debug log cleanup (BUG2/BUG3) en dashboard.html
4. Visitas viejas con PDFs en blanco en Azure (mitigado: `descargarPDFVisita` regenera siempre)

---

## 🚧 NO HACER NUNCA (errores que se cometieron en esta sesión)

1. **NO asumir columnas sin verificar el schema.** La columna de fecha en `BB. DE REGISTROS YYYY` es la **B (índice 1)**, no la A (índice 0). Esto costó toda la sesión de hoy.
2. **NO pasar múltiples patches alternativos sin verificar el anterior.** Confunde a Joel y rompe lo que funciona.
3. **NO sobrescribir funciones por hoisting sin avisar.** Si pegas una función al final que sobrescribe la original, la versión nueva debe ser TAN ROBUSTA o más que la original.
4. **NO modificar nada en producción sin URL de test que confirme el cambio.**

---

## 🛠️ CONVENCIONES DE TRABAJO CON JOEL

### Estilo de comunicación
- **Idioma:** español, dirección vos
- **Tono:** directo, con emojis moderados (✅ ❌ 🎯 ⚠️ 🔧 📋 🧪)
- **Joel escribe en MAYÚSCULAS cuando está apurado/molesto** — interpretar como urgencia
- **Cuando algo no funciona Joel se frustra rápido** — ser corto, no dar excusas, dar SOLUCIÓN
- **Joel pega manualmente en el editor GAS** — no usar `clasp` ni nada automatizado

### Estilo técnico
- **Surgical changes:** solo lo pedido, nada extra
- **PowerShell defensivo** para Windows: `[System.IO.File]::ReadAllText/WriteAllText` UTF-8 no-BOM
- **Backup `.bak` antes de cambios destructivos** en archivos
- **Scripts Python para frontend** (más fácil que sed)
- **SQL solo en Azure Query Editor**, nunca desde PowerShell
- **GAS deployment counter:** ~182/200 — atención al límite

### Patrón GAS
- `doGet/doPost` → `handle(e)` → `switch(action)` → handlers que devuelven objetos planos
- `handle()` envuelve la respuesta en JSON via ContentService
- Cache via `CacheService.getScriptCache()` con chunks de 90KB
- Properties: `AZURE_API_URL`, `AZURE_API_KEY`, `AZURE_SAS_TOKEN`, `FIREBASE_DB_SECRET`

### Apps Script Properties necesarias
- `AZURE_STORAGE_ACCOUNT` = `sistemarlverfrut`
- `AZURE_SAS_VISITAS_CAMPO` o `AZURE_SAS_TOKEN`
- `AZURE_CONTAINER_VISITAS` = `visitas-campo`
- `FIREBASE_DB_SECRET`
- `AZURE_API_URL`, `AZURE_API_KEY`
- `SPREADSHEET_ID` = `1q79u2S3ZI_Qc-YnDzgnQwyv4jL7pxTuARiXICPPXgZw`

### Permisos y whitelist
```javascript
const ADMINS_ELIMINAR_VISITA = ['jtimoteo', 'ovilela', 'jchavez'];
const ADMINS_ELIMINAR_CASO   = ['jtimoteo', 'ovilela', 'jchavez'];
const HORAS_ADMINS           = ['jtimoteo', 'ovilela', 'jchavez'];
```

### Triggers activos en GAS
- `syncTrabajadoresAAzure` — cada 6h (sincroniza Sheets → Azure SQL)
- `recalcularEstadisticasCompletas` — diario 00:01 Lima
- `prewarmCacheResumen` — cada 5 min

### Temporadas (Visitas de Campo)
- **Temporada Baja (Ene–Jun 26):** Lun–Vie hábil
- **Temporada Alta (27 Jun–Dic):** Lun–Sáb hábil
- **Plazo informe:** fecha fin + 2 días hábiles

---

## 📁 ARCHIVOS DE OUTPUT GENERADOS HOY (referencia)

Todos en `/mnt/user-data/outputs/`:

| Archivo | Estado | Uso |
|---|---|---|
| `dashboard.html` | ✅ DEPLOYADO | Frontend con Grupos 3+4 |
| `PATCH_VISITAS_PDF_AZURE_codigo_gs.gs` | ✅ DEPLOYADO | Backend Visitas (saveVisita/getVisitas) |
| `PACK_CONSULTA_DNI_BACKEND.gs` | Sigue activo en GAS (versión correcta de ayer) | NO eliminar |
| `PATCH_CONSULTA_DNI_FINAL.gs` | ❌ ELIMINADO | Era el v3 roto (r[0] mal) |
| `PATCH_CONSULTA_DNI_V4.gs` | ❌ ELIMINADO | Era el v4 roto (r[0] mal) |
| `PATCH_DROPDOWN_NOMBRES_COMPLETOS.gs` | ⏸️ NO PEGADO TODAVÍA | Para cambiar dropdown a nombres completos |
| `trabajadores-search-index.js` | ⏸️ NO DEPLOYADO | Para migración Buscar Trabajador a Azure |

---

## 🚀 PARA INICIAR LA PRÓXIMA CONVERSACIÓN

**Empezar diciendo:**
> "Continúo el proyecto Sistema RL v3.0. Adjunto el handoff. El último paso fue eliminar los patches rotos de `consultaDNI` del codigo.gs. Necesito validar que funciona y avanzar con el P1: migración Consulta DNI a Azure SQL."

**Adjuntar:**
1. Este archivo (handoff completo)
2. El codigo.gs actual (después del cleanup)
3. El dashboard.html actual (525KB)

**Primer paso de la nueva conversación:**
1. Joel pega el JSON de la URL de test (para confirmar consultaDNI Sheets funciona)
2. Si funciona → arrancar migración Azure SQL
3. Verificar si el endpoint `/api/atenciones` es anonymous o requiere key (decide si el frontend llama directo a Azure o vía GAS)

---

## 🔗 LINKS ÚTILES

- **Frontend producción:** `https://joeltimoteog-bot.github.io/sistema-rl-verfrut/`
- **Apps Script editor:** `https://script.google.com/home/projects/[ID-PROYECTO]/edit`
- **Azure Portal:** `https://portal.azure.com/`
- **Firebase Console:** `https://console.firebase.google.com/project/sistema-rl-verfrut`
- **GitHub Repo Backend Azure:** `joeltimoteog-bot/rl-functions-verfrut`

---

## 📊 MÉTRICAS DEL PROYECTO

- **Total atenciones registradas:** ~50,000+ (2024+2025+2026)
- **Trabajadores sincronizados en Azure SQL:** 4,940 (RAPEL + VERFRUT)
- **Total supervisores activos:** 17
- **Hojas en Google Sheets:** 30+ (BB. DE REGISTROS, Visitas_Campo, BD_Casos, Fusiones_Buses, CAPACITACIONES_HDR, BD_Capacitaciones, INV_*, etc.)
- **Líneas de código GAS:** ~7400+ con 187+ funciones
- **Líneas de código frontend (dashboard.html):** ~9500+

---

**Última actualización:** 04/06/2026 — Sesión cerrada por saturación de contexto

**Estado emocional Joel:** Frustrado por la pérdida de tiempo con los patches rotos. Importante en la próxima sesión: SER MÁS CUIDADOSO, NO ASUMIR SCHEMAS, VERIFICAR ANTES DE GENERAR PATCHES.
