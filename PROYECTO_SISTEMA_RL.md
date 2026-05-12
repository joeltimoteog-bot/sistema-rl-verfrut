# 📋 Sistema RL v3.0 — Contexto del Proyecto

> **Cómo usar este archivo:** Guardalo en la raíz de tu repo `C:\sistema-rl-verfrut\PROYECTO_SISTEMA_RL.md`. Cuando abras una conversación nueva con Claude, pegá su contenido (o adjuntalo) en el primer mensaje. Así Claude arranca con todo el contexto del proyecto sin preguntar lo básico.

---

## 🏢 Quién soy y dónde trabajo

- **Nombre:** Joel A. Timoteo Gonza
- **Rol:** Coordinador de Relaciones Laborales en Verfrut / RAPEL SAC (Unifrutti Group, Perú)
- **Equipo:** ~10-14 supervisores entre RAPEL y VERFRUT
- **Creador y mantenedor técnico de los sistemas internos**
- **Estudiante en IES CIBERTEC** (Desarrollo de Entornos Web)

---

## 🌐 Sistema RL v3.0 — Stack y URLs

### Producción
- **Frontend:** https://joeltimoteog-bot.github.io/sistema-rl-verfrut/
  - Login: `index.html` (raíz)
  - Dashboard: `frontend/pages/dashboard.html`
  - GitHub Pages, repo: `joeltimoteog-bot/sistema-rl-verfrut`

### Backend
- **Apps Script** (script.google.com) — proyecto "Registro de Atenciones Diarias"
  - Backup local: `backend/gas/codigo.gs` (NO es source of truth)
  - ~7,400 líneas, 187 funciones
- **Google Sheets:** `1q79u2S3ZI_Qc-YnDzgnQwyv4jL7pxTuARiXICPPXgZw`
  - Hojas clave: `BB. DE REGISTROS 2024/2025/2026`, `Visitas_Campo`, `BD_Casos`, `Fusiones_Buses`, `usuarios`, `Trabajadores_RAPEL/VERFRUT`, `Solicitudes_Acceso`, `registros` (horas), `CAPACITACIONES_HDR`, `INV_*` (inventario)

### Servicios integrados
- **Firebase RTDB:** `sistema-rl-verfrut-default-rtdb.firebaseio.com`
  - Path: `/estadisticas/{resumen_global, por_mes, por_anio, por_supervisor, por_empresa}`
  - Path: `/estadisticas_modulos`, `/alertas`
- **Azure SQL** via Azure Functions (Brasil South)
  - Función `/atenciones`, `/atenciones/batch`, `/atenciones/stats`, `/trabajadores/sync`
- **Azure Blob Storage:** cuenta `sistemarlverfrut`, contenedores `casos-rl` y `visitas-campo`

### Local
- **Repo:** `C:\sistema-rl-verfrut`
- **OS:** Windows / PowerShell
- **Git account:** `joeltimoteog-bot`

---

## ⚙️ Workflow GAS vs. Git

⚠️ **Importante:** Apps Script se mantiene SEPARADO del repo. El backup `backend/gas/codigo.gs` es solo respaldo. El código que corre en producción está en script.google.com.

**Cuando se cambia código GAS:**
1. Aplicar el cambio en el **editor de Apps Script** (script.google.com)
2. Replicar el mismo cambio en `backend/gas/codigo.gs` (local)
3. `git commit` + `git push` del backup local

---

## 🐛 Patrones conocidos / lessons learned

### 1. Trigger fantasma en Apps Script
Un trigger puede aparecer en **Activadores** pero el scheduler **nunca lo dispara** (ni siquiera falla, simplemente no corre). Detectar: panel **Ejecuciones** → filtrar por trigger ID → si dice "0 ejecuciones en N días" es fantasma.

**Fix:** ejecutar `eliminarTriggerResetDiario()` + `crearTriggerResetDiario()` (o `crearTriggerXxx` para otros triggers).

### 2. Script Cloudflare `email-decode.min.js` 404
Si un HTML pasó por algún editor/Cloudflare en algún momento, puede quedar inyectado:
```html
<script data-cfasync="false" src="/cdn-cgi/scripts/.../email-decode.min.js"></script>
```
Buscar y eliminar. GitHub Pages no sirve `/cdn-cgi/*` y da 404 silencioso vía Service Worker.

### 3. ReferenceError silencioso por `global` no definido
Apps Script V8 NO expone `global` como objeto runtime. Cualquier código tipo `global.foo` tira ReferenceError y el `try/catch` del `handle(e)` se lo come devolviendo `{ error: "..." }`. **Solo usar `global` como variable local explícita** (`let global = {}`).

### 4. Dedupe entre hojas con nros compartidos
Las hojas `BB. DE REGISTROS 2024/2025/2026` comparten el mismo rango de `nro` (1, 2, 3...). Si se dedupe por solo `nro`, se pierden 2 de 3 años. Usar `nro + nombre_hoja` como clave.

### 5. Service Worker y deploys
GitHub Pages tarda 30-60s en deployar después de un `git push`. Durante esa ventana, archivos pueden devolver 404 transitorio. El SW intenta hacer update y se ve como "Not Found" en la consola — generalmente se resuelve solo.

---

## 📚 Funciones GAS importantes

| Función | Propósito |
|---|---|
| `recalcularEstadisticasCompletas()` | Recalcula `/estadisticas` completo. Trigger diario 00:01 Lima. |
| `actualizarFirebaseRapido(d)` | Incrementa contadores Firebase al guardar atención (sincrónico). |
| `actualizarFirebaseModulos()` | Actualiza `/estadisticas_modulos` y `/alertas` (al guardar caso/visita/fusion). |
| `getPreloadOptimizado(p)` | Preload con stats desde Azure SQL (fallback a Sheets). |
| `getEstadisticasAzure(filtros)` | Stats agregadas desde Azure SQL — vía endpoint `/atenciones/stats`. |
| `saveAtencionAzure(data)` | Inserta atención a Azure SQL (no bloquea si falla). |
| `migrarAnio(anio)` | Migración masiva Sheets → Azure SQL en lotes. |
| `crearTriggerResetDiario()` | Crea trigger diario para `recalcularEstadisticasCompletas`. |
| `eliminarTriggerResetDiario()` | Borra ese trigger. |
| `syncTrabajadoresAAzure()` | Sync Trabajadores_RAPEL/VERFRUT → Azure SQL. Trigger cada 6h. |
| `verificarSistemaCompleto()` | Diagnóstico end-to-end. |
| `listarTriggers()` | Lista todos los triggers del proyecto. |
| `diagnosticarFirebaseEstadisticas()` | Diagnóstico específico Firebase. |

---

## 🛠️ Preferencias de trabajo

- **Cambios quirúrgicos** — no excederse del scope solicitado
- **Step-by-step** — un solo comando o bloque por mensaje
- **PowerShell** para Windows (no bash)
- **Backup previo** (`.bak`) antes de cualquier edición destructiva
- **Verificación previa** del bloque a modificar antes de tocar
- **Español** — respuestas en español, emojis moderados
- **Prompts a Claude Code** en formato directo y conciso

---

## 📦 Otros sistemas que mantengo

### Sistema ETI / Seguimientos Generales
- Repo: `joeltimoteog-bot/sistema-eti`
- Stack: vanilla JS + Firebase Firestore + Chart.js
- GitHub Pages
- Módulo Gerencial (6 sub-tabs), Mantenimiento de Unidades (alertas KM), Capacitaciones
- Usuarios: jtimoteo (admin), ovilela, jchavez, glucia (restricted)

### Sistema ETI – Evaluación de Conocimiento v4
- Single-file HTML/JS/CSS
- 35 preguntas, 6 secciones ponderadas
- Deploy: `joeltimoteog-bot.github.io/eti-evaluacion-verfrut`

### Excel VBA Sistema de Gestión Humana
- UserForms: frmHoras, frmMenuPrincipal, frmLogin, frmCarga, frmMenuAtenciones, UF_VisitaCampo

### Académico (CIBERTEC)
- Proyecto React SPA "Sabor Criollo" (Vite/React + Word report + PPT)
- Curso: Desarrollo de Entornos Web

---

## 📌 Estado actual (al cierre del 11-may-2026)

✅ Dashboard sin errores 404 / sin "Firebase stale"
✅ Firebase RTDB sincronizado al día (`fecha_ultima_actualizacion = 2026-05-11`)
✅ Trigger `recalcularEstadisticasCompletas` recreado y activo (corre 00:01 Lima diario)
✅ Bloque muerto `global.fecha_ultima_actualizacion` eliminado de `getEstadisticas`
✅ Commits del día: `614cf12` (cloudflare) y `82cdd7b` (bloque muerto)

### ⏳ Pendiente verificar el 12-may después de las 9 AM
GAS → Ejecuciones → filtro `recalcularEstadisticasCompletas` → últimos 1 día
Esperar: 1 ejecución del 12-may ~00:01 AM, estado "Completada"

### 🔮 Backlog (no urgente)
1. **getEstadisticas** — dedupe por `nro + nombre_hoja` para no perder 2024/2025
2. **cTendAnual** — años truncados visualmente (`202-`, `204-`) en Chart.js
3. **Logs debug** — limpiar etiquetas `[dibujar] BUG2/BUG3` antes de producción "final"

---

*Última actualización: 11-may-2026 21:15 Lima · Sesión con Claude*
