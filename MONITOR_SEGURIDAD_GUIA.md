# 🛰️ Módulo Monitor en Vivo + Seguridad — Sistema RL v3.0

**Para:** Joel Timoteo — Coordinación RR.LL.
**Qué es:** Un módulo nuevo, independiente y solo para vos, que te deja **ver en vivo qué está haciendo cada usuario** (en qué módulo está, si está conectado) y **enviarle mensajes** directo a su pantalla ("recuerda subir tu informe", "¿por qué no registraste?", etc.).

Todo se monta sobre el **Firebase que ya tenés** — no se agrega ningún servicio nuevo y **no hace falta deployar GAS** (seguís con tu contador ~182/200 intacto).

---

## 📦 Archivos entregados

| Archivo | Dónde va | Qué hace |
|---|---|---|
| `frontend/js/presencia.js` | carpeta `frontend/js/` | Se incluye en cada página. Registra presencia + recibe tus mensajes. |
| `frontend/pages/monitor.html` | carpeta `frontend/pages/` | **Tu panel**. Lista en vivo + envío de mensajes. Solo lo abre `jtimoteo`. |
| `database.rules.json` | raíz (referencia) | Reglas de seguridad de Firebase (se pegan en la consola). |

Los dos primeros ya quedaron copiados en tu repo. Son **archivos nuevos**: no sobrescriben nada.

---

## 🚀 Despliegue — 3 pasos, en este orden

> ⚠️ Importante: primero las reglas de Firebase, si no, `presencia.js` no va a poder escribir.

### Paso 1 — Reglas de Firebase (2 min, sin tocar código)

1. Entrá a **Firebase Console → Realtime Database → pestaña "Reglas"**
   `https://console.firebase.google.com/project/sistema-rl-verfrut/database/sistema-rl-verfrut-default-rtdb/rules`
2. **Copiá lo que hay hoy y pegalo en un bloc de notas** (respaldo, por si acaso).
3. Pegá el contenido de `database.rules.json` y dale **Publicar**.
4. Listo. Esto **no cambia** tus lecturas de estadísticas (siguen igual), pero ahora **el cliente ya no puede escribir en ningún lado**, salvo en las rutas nuevas `/presencia` y `/mensajes` (y con formato validado). GAS no se ve afectado porque usa el secreto de admin.

### Paso 2 — Probar en UNA sola página primero (dashboard.html)

Antes de tocar todas las páginas, probamos en una. Agregá esta línea **justo antes de `</body>`** en `frontend/pages/dashboard.html`:

```html
<script src="/sistema-rl-verfrut/frontend/js/presencia.js" data-modulo="Dashboard"></script>
```

Hacé `git add . && git commit && git push`. Esperá ~1 min (GitHub Pages).

**Test:**
- Entrá al sistema con un usuario cualquiera (o pedile a un supervisor) y quedate en el dashboard.
- En otra pestaña, abrí `https://joeltimoteog-bot.github.io/sistema-rl-verfrut/frontend/pages/monitor.html` con **tu** usuario `jtimoteo`.
- Deberías verlo aparecer 🟢 con "📍 Dashboard".
- Escribile un mensaje → tiene que saltarle el aviso en su pantalla en 1-2 segundos.

Si eso funciona → seguís al paso 3. Si no → me avisás qué dice la consola (F12) y lo corregimos.

### Paso 3 — Extender a todas las páginas

Una vez validado, agregás la misma línea (cambiando el `data-modulo`) al final de cada página. Sugerencia de nombres:

| Página | data-modulo |
|---|---|
| dashboard.html | `Dashboard` |
| resumen.html | `Resumen Ejecutivo` |
| capacitaciones.html | `Capacitaciones` |
| inventario.html | `Inventario` |
| horas.html | `Control de Horas` |
| almuerzos.html | `Almuerzos` |
| preaviso.html | `Preavisos` |
| mantenimiento.html | `Mantenimiento` |
| evaluacion360.html | `Evaluación 360` |
| consulta-masiva.html | `Consulta Masiva` |
| … | … |

> Te puedo dar un script de PowerShell que inserte la línea en todas las páginas de una, con backup `.bak` de cada una — pero recién **después** de que valides el paso 2. Así no tocamos todo a ciegas.

---

## 🔒 Seguridad de las bases — auditoría honesta y plan

Me pediste reforzar la seguridad para que "nadie extraño pueda hackear el sistema". Acá va la foto real, sin adornos, y qué se arregla ya vs. qué necesita más trabajo.

### 1. Firebase Realtime Database — **el punto más importante**

**Riesgo actual:** la config de Firebase (`apiKey`, `databaseURL`) está a la vista en el HTML. **Esto es normal en Firebase web** — esa "apiKey" NO es un secreto, es solo un identificador. La seguridad real de Firebase **depende 100% de las reglas de la base**, no de esa clave.

- ✅ **Se arregla YA (Paso 1):** con las reglas nuevas, el cliente **ya no puede escribir/borrar** tus estadísticas ni nada — solo presencia y mensajes con formato validado. Esto tapa el hueco más grande (que alguien inyecte o borre datos).
- ⚠️ **Queda pendiente (Fase 2):** las **lecturas** siguen abiertas (como hoy). Es decir, alguien que conozca la URL podría *leer* tus estadísticas. Cerrar eso del todo requiere **Firebase Authentication** (que el login genere un token de Firebase, no solo el de GAS). Es un cambio más grande y hay que hacerlo con cuidado para no romper las lecturas actuales. Lo dejo planteado como siguiente fase, medido, no a las apuradas.

### 2. Azure SQL (vía Azure Functions)

- ✅ **Bien:** el frontend **no** se conecta directo a la base. Habla con las Azure Functions, y esas llamadas ya van con `Authorization: Bearer <token>` (lo vi en el código). La cadena de conexión a SQL vive server-side, no se expone. Eso está correcto.
- 🔧 **Recomendado:** confirmar en Azure Portal que el SQL Server tiene el **firewall restringido** (solo "Permitir servicios de Azure", sin `0.0.0.0`), y rotar la contraseña del SQL cada cierto tiempo.

### 3. Azure Blob Storage (fotos/PDFs de visitas y casos)

- ⚠️ **A revisar:** el sistema usa **SAS tokens**. Si un SAS con permiso de escritura quedó embebido en el frontend o con vencimiento muy largo, es un riesgo. Lo ideal: SAS **de solo lectura** y de **corta duración**, generados por GAS on-demand, nunca uno permanente en el HTML.
- 🔧 **Acción:** revisamos juntos dónde se usa el SAS en el frontend y si conviene moverlo detrás de GAS.

### 4. Google Apps Script

- ✅ **Bien:** los secretos (`AZURE_API_KEY`, `AZURE_SAS_TOKEN`, `FIREBASE_DB_SECRET`) están en **Script Properties**, server-side. Correcto.
- 🔧 **Recomendado:** que `doGet/doPost` valide el token/usuario en las acciones sensibles (eliminar, editar), no solo en el frontend. Si ya lo hace por la whitelist `ADMINS_ELIMINAR_*`, mejor aún — solo conviene confirmar que esa validación está del lado del **backend** y no solo escondiendo botones en el front.

### Prioridad sugerida
1. **HOY:** publicar las reglas de Firebase (Paso 1). Tapa el hueco más grave, sin romper nada.
2. **Esta semana:** revisar el SAS de Azure Blob (punto 3).
3. **Fase 2 (con calma):** Firebase Auth para cerrar también las lecturas (punto 1).

> Ninguna de estas acciones toca producción "a ciegas": las reglas de Firebase se prueban en el Paso 2, y lo de Azure lo revisamos antes de cambiar nada.

---

## 🧩 Cómo está armado (para que lo tengas claro)

**Rutas nuevas en Firebase:**
- `/presencia/{usuario}` → `{ nombre, rol, empresa, modulo, pagina, online, ultimo_ping }`
  El navegador la actualiza cada 20s. Al cerrar la pestaña, Firebase lo marca offline **solo** (con `onDisconnect`).
- `/mensajes/{usuario}/{idAuto}` → `{ texto, de, ts, leido }`
  Vos escribís desde el panel; la página del usuario lo escucha y le muestra el aviso, y lo marca como leído.

**A prueba de fallos:** `presencia.js` está todo envuelto en `try/catch`. Si Firebase no carga, si no hay sesión, o si algo falla, **el módulo no hace nada y la página sigue funcionando igual**. No puede romper el sistema.

**Acceso al panel:** `monitor.html` solo se abre si tu usuario está en `MONITOR_ADMINS = ['jtimoteo']`. Si querés sumar a `ovilela` o `jchavez`, es cambiar esa línea.

---

*Módulo v1: presencia en vivo + mensajería. La v2 (pendientes automáticos por usuario — "informe no subido", "caso abierto" — leídos de tus datos reales) la armamos cuando valides esta base.*
