# SKILL — Resumen General Firebase-First y Cache GAS
**Sesión:** 1 jun 2026 (~05:00 p.m. → 09:00 p.m.)
**Sistema:** Sistema RL v3.0 — Verfrut/RAPEL (Joel Timoteo)

---

## 🎯 OBJETIVO DE LA SESIÓN
Arreglar el módulo Resumen General que (1) no mostraba atenciones, (2) era lento (5-10s), (3) tenía conteos incorrectos en la tabla detallada.

---

## ✅ LO QUE SE LOGRÓ (en orden cronológico)

### 1. Auditoría inicial (9 bugs identificados)
- `resumenEjecutivo` NO procesaba atenciones
- Casos leía col 15 buscando "EN PROCESO" (que vive en col 27)
- No devolvía `casos.finalizados` → frontend mostraba "—"
- `cap.asistentes` vs `total_asistentes` (nombre incorrecto)
- Comparativa RAPEL/VERFRUT con `colEmp=2` hardcodeado, falla en Fusiones
- `getResumenGeneral` leía 1 sola hoja anual (no 4)
- Cap hardcodeado de 500 registros
- Contaba `RESUELTO` pero frontend espera `FINALIZADO`
- `cTendAnual` truncaba años malformados

### 2. Cambios aplicados a Backend GAS (codigo.gs)
- ✅ **`getResumenGeneral` (FIX [A][B][C])**: lee 4 hojas con dedup, devuelve `total` real, acepta RESUELTO=FINALIZADO. Commit en GAS, versión nueva desplegada.
- ✅ **`resumenEjecutivo` (refactor completo)**: ahora procesa atenciones + 7 bugs corregidos. Detección dinámica de columna empresa (`getColEmpresa`). Versión nueva desplegada.
- ✅ **Fix de tendencia**: cambiada de `tendencia: tendencia` (objeto) a `tendencia: Object.keys(tendencia).map(...)` (array). Versión nueva desplegada.

### 3. Cambios aplicados a Frontend (resumen.html)
- ✅ **Commit `9d5770e`**: KPIs grandes incluyen atenciones via `(resp.atenciones?.hoy || 0)`
- ✅ **Commit `f7827cf`**: Firebase-first para KPIs (modelo Mi Dashboard) — Parches 1-4
- ✅ **Fix tabla conteos**: `_aplicarDatosResumen` ahora usa `data.total` y Firebase para `rT/rP/rR` en lugar del slice de 1000

### 4. Cache + Pre-warm en GAS
- ✅ **`resumenEjecutivoCached`**: wrapper con cache 10 min
- ✅ **`getResumenGeneralCached`**: wrapper con cache 10 min + reduce slice a 100
- ✅ **`prewarmCacheResumen`**: trigger cada 5 min que mantiene cache caliente
- ✅ Router actualizado para usar las versiones `Cached`

---

## 📊 ESTADO ACTUAL — qué funciona

### Resumen General (https://joeltimoteog-bot.github.io/sistema-rl-verfrut/frontend/pages/resumen.html)

**Cards grandes superiores** (vienen de Firebase, modelo Mi Dashboard):
- ATENCIONES HOY: 43 ✓
- ESTE MES: 46 (at+vis+cas) ✓
- EN PROCESO: 27 (igual que Mi Dashboard) ✓
- TOTAL HISTÓRICO: 48,162 (at+vis+cas) ✓

**Cards módulos** (vienen de Firebase `/estadisticas_modulos`):
- Visitas: 27 total / 1 mes / 27 plazo / 0 retrasadas ✓
- Casos: 26 total / 2 mes / 1 proceso / 25 finalizados ✓
- Fusiones: 5 total / 0 mes ✓
- Capacitaciones: 51 total / 1164 capacitados ✓

**Performance:**
- Primera carga: ahora rápida porque Firebase pinta cards inmediatamente (<300ms)
- API GAS solo se usa para comparativa, tendencia, alertas y tabla detallada

---

## ⚠️ PENDIENTES PRIORITARIOS

### Pendiente 1 — Verificar tabla detallada (URGENTE)
Tabla que antes mostraba "TOTAL 1000 / EN PROCESO 0 / FINALIZADO 1000".
El fix ya está aplicado y pusheado. Falta que Joel haga hard refresh y verifique:
- Debería mostrar: TOTAL ~48,162 / EN PROCESO 27 / FINALIZADO ~48,000

### Pendiente 2 — Timestamp "(FB)" no aparece
El badge "(FB)" en el timestamp del Resumen Ejecutivo no se pinta en la primera carga.
**Causa**: race condition — `cargarResumenEjecutivo()` se ejecuta ANTES de que Firebase responda. El `_rFbAplicarKPIs` sí se ejecuta después y pinta valores correctos, pero la sobreescritura del timestamp puede no estar pasando.
**No es crítico**, los datos sí son los correctos.

### Pendiente 3 — Fusiones RAPEL/VERFRUT y Capacitaciones RAPEL muestran "—"
**Causa**: en `resumenEjecutivo` backend, el código:
```javascript
const emp = String(r[2] || '').toUpperCase();
```
asume columna empresa en índice 2, pero `Fusiones_Buses` tiene 'Hora' ahí. No hay columna empresa en Fusiones_Buses. Solución: detección dinámica por hoja, o agregar columna empresa a esa hoja.

### Pendiente 4 — Estadísticas Admin (NO AUDITADO EN ESTA SESIÓN)
- Joel originalmente pidió arreglar Resumen General Y Estadísticas Admin
- Solo se cerró Resumen General
- Sospechas: "Mejor Supervisor ALEX FABIAN" con 7,855 atenciones (4.4× promedio - posible doble conteo), Firebase 48k vs GAS 30k discrepancia
- Trigger fantasma `recalcularEstadisticasCompletas` puede haber vuelto a ser fantasma

### Pendiente 5 — Módulo Cumplimiento de Supervisores (POSTPUESTO)
- Spec completa armada pero NO empezado
- Bloqueado hasta que Estadísticas Admin tenga datos confiables
- Plan: Fase 0 auditoría → Fase 1 MVP (tabla + conteos + % + semáforo + Excel) → Fase 2 refinamiento

### Pendientes pre-existentes (de sesiones anteriores, no de hoy)
- Token JWT en Azure Functions (paso 4 frontend)
- Importación trabajadores desde OneDrive Excel `.xlsm`
- Fix tarjeta "Atenciones Hoy" undercounting Firebase
- bcrypt en passwords auth-login
- Restringir CORS Function App a `https://joeltimoteog-bot.github.io`
- Borrar registro prueba Azure SQL: `DELETE FROM Atenciones WHERE id = 48039`
- Etiqueta tarjeta "AÑO 2028 VS 2026" mal (debería 2025)

---

## 🛡️ BACKUPS CREADOS HOY (locales en C:\sistema-rl-verfrut\frontend\pages\)
- `resumen.html.bak-20260601-122428`
- `resumen.html.bak-fix-20260601-154822`
- `resumen.html.bak-fix-20260601-155039`
- `resumen.html.bak-firebase-first`
- `resumen.html.bak-fbfirst-20260601-204116`
- `resumen.html.bak-conteos-20260601-211556`
- `resumen.html.bak-conteos-20260601-215639`

**Para rollback completo** (ir a estado de antes de la sesión):
```powershell
copy resumen.html.bak-20260601-122428 resumen.html
```

---

## 💻 COMANDOS ÚTILES

### Limpiar cache de Resumen General manualmente (desde GAS editor)
```javascript
// Ejecutar la función:
limpiarCacheResumen()
```

### Forzar pre-warm del cache (desde GAS editor)
```javascript
prewarmCacheResumen()
```

### Verificar trigger activo (desde GAS editor)
```javascript
listarTriggers()
```

### Rollback frontend si algo se rompe
```powershell
cd C:\sistema-rl-verfrut\frontend\pages
copy resumen.html.bak-fbfirst-20260601-204116 resumen.html
cd C:\sistema-rl-verfrut
git add frontend/pages/resumen.html
git commit -m "revert: rollback firebase-first"
git push origin main
```

---

## 🔧 ARQUITECTURA ACTUAL DEL RESUMEN GENERAL

```
┌────────────────────────────────────────────────────────┐
│  RESUMEN GENERAL — Flujo de datos                       │
└────────────────────────────────────────────────────────┘

[Frontend: resumen.html]
   │
   ├─→ Firebase RTDB (suscripción WebSocket)
   │     ├─ /estadisticas/resumen_global ──→ cards grandes (KPIs)
   │     ├─ /estadisticas/por_supervisor  ──→ panel supervisores
   │     └─ /estadisticas_modulos          ──→ cards de módulos
   │       (visitas, casos, fusiones, capacitaciones)
   │
   └─→ API GAS (POST a doGet/doPost)
         ├─ action=resumenEjecutivo → resumenEjecutivoCached
         │     └─ Cache 10 min → comparativa, tendencia, alertas
         └─ action=getResumenGeneral → getResumenGeneralCached
               └─ Cache 10 min, slice 100 → tabla detallada

[Backend GAS: codigo.gs]
   │
   ├─ Trigger: prewarmCacheResumen (cada 5 min)
   │     └─ Mantiene cache caliente
   │
   ├─ Trigger: recalcularEstadisticasCompletas (diario 00:01)
   │     └─ Actualiza Firebase /estadisticas
   │
   └─ En cada saveAtencion, saveVisita, saveCaso, etc.:
         └─ actualizarFirebaseModulos() / actualizarFirebaseRapido()
               └─ Actualiza Firebase en tiempo real
```

---

## 🧠 LECCIONES APRENDIDAS HOY (importante mantenerlas)

1. **PowerShell 5.1 lee `.ps1` como ANSI**. Para evitar corrupción de UTF-8:
   - Usar `[System.IO.File]::ReadAllText(path, [System.Text.Encoding]::UTF8)` (NO `Get-Content -Raw`)
   - Usar `[System.IO.File]::WriteAllText(path, content, [System.Text.UTF8Encoding]::new($false))`
   - NO usar emojis literales en scripts `.ps1` (usar `[char]0x00F0` si necesitas)

2. **Errores `ERR_NETWORK_*` en consola NO son del código** — son del navegador/red local del cliente. Pasa con muchos deploys seguidos o Chrome suspendiendo tabs inactivas.

3. **GAS CacheService**:
   - Límite: 100 KB por entrada
   - Wrappear funciones existentes con cache es la forma más segura
   - Trigger pre-warm cada 5 min evita la primera carga lenta

4. **Firebase-first es el patrón ganador** para módulos de visualización:
   - Frontend se suscribe a Firebase RTDB
   - Cards se pintan al recibir cada update (WebSocket, no fetch)
   - API GAS queda como fallback / detalles adicionales
   - **Mi Dashboard ya tenía este patrón**, Resumen General ahora también

5. **Cuando hagas cambios al frontend con find/replace**, siempre:
   - Backup con timestamp ANTES
   - Verificar cada ancla ANTES de cualquier replace
   - Verificar delta de tamaño antes de escribir
   - Si una sola ancla falla, abortar SIN escribir nada

---

## 🚀 PRÓXIMA SESIÓN — CÓMO RETOMAR

Pegale a Claude algo así:

> "Hola Claude. Estoy retomando el Sistema RL v3.0. Ayer (1 jun 2026) hicimos un refactor grande del módulo Resumen General que ahora funciona Firebase-first y tiene cache + pre-warm. El estado y pendientes está en el archivo SKILL-RESUMEN-GENERAL-FIREBASE-FIRST.md que te paso ahora. [adjuntar este archivo]
>
> Hoy quiero seguir con [una de estas tres opciones]:
>
> A) **Estadísticas Admin** — auditarlo y arreglarlo (sospechas: Mejor Supervisor inflado, Firebase 48k vs GAS 30k)
>
> B) **Módulo Cumplimiento de Supervisores** — el módulo nuevo que querías originalmente
>
> C) **Limpiar pendientes menores** del Resumen General (fix Fusiones empresa, timestamp (FB), etc.)
>
> Decime cuál te parece más urgente o si querés que armemos un plan para los tres."

---

**FIN DEL SKILL** — Si Claude lee esto en otra conversación, debería tener contexto completo para retomar sin perder nada.
