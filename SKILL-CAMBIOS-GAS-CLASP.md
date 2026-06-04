# 🛠️ SKILL — Sistema RL v3.0 · Hacer cambios al backend (Apps Script) con clasp

Guía rápida para modificar el backend GAS sin romper producción ni gastar versiones de más.

---

## 0) 📋 Cómo "llamar a Claude" cuando quieras un cambio

Pega este bloque al inicio de tu mensaje (en este chat o en Claude Code) y describe abajo qué quieres:

```
Claude, necesito un cambio en el backend GAS del Sistema RL v3.0.

Contexto fijo:
- Trabajo con clasp. Carpeta: C:\sistema-rl-gas
- Archivo de codigo: Codigo.js (~8.100 lineas)
- Despliegue de PRODUCCION (no cambiar la URL):
  AKfycbxZP3UGad-XwRl7sCYmTxeex57b1hEfmqslhe5x0IOzzvpbEbM4VYFR2d52b_YMB1lyyA
- Mis preferencias: cambios quirurgicos, un bloque por mensaje,
  PowerShell, mostrar contexto + crear .bak antes de editar, respuestas en espanol.

EL CAMBIO QUE QUIERO:
(describe aqui que quieres modificar/agregar/arreglar)

Dame: 1) el cambio quirurgico (script .ps1 con .bak),
      2) los comandos clasp para publicar (push + deploy -i),
      sin cambiar la URL de produccion.
```

---

## 1) 🔑 Datos del proyecto (referencia)

| Dato | Valor |
|---|---|
| **Script ID** | `1CNKmgeAKxGWujcHnas4Ss5QPbZb3SyHgKEvH4DnKwwB21GAEqx2ec2Uw` |
| **Despliegue PRODUCCIÓN (ID)** | `AKfycbxZP3UGad-XwRl7sCYmTxeex57b1hEfmqslhe5x0IOzzvpbEbM4VYFR2d52b_YMB1lyyA` |
| **URL `/exec` (producción)** | `https://script.google.com/macros/s/AKfycbxZP3UGad-...B1lyyA/exec` |
| **Despliegue HEAD / pruebas (ID)** | `AKfycbzBjxloV4RQvNYl3FJvHT2isu4ruenocburThI2sT9H` |
| **URL `/dev` (pruebas, solo dueño)** | `https://script.google.com/macros/s/AKfycbzBjxlo...ThI2sT9H/dev` |
| **Carpeta clasp (código vivo)** | `C:\sistema-rl-gas` → archivo `Código.js` |
| **Repo frontend** | `joeltimoteog-bot/sistema-rl-verfrut` (`C:\sistema-rl-verfrut`) |
| **Spreadsheet** | `1q79u2S3ZI_Qc-YnDzgnQwyv4jL7pxTuARiXICPPXgZw` |
| **Límite de versiones** | 200 (limpiar con *Historial del proyecto → Eliminación masiva*) |

---

## 2) 🔄 Flujo para hacer un cambio (paso a paso)

```powershell
# 1. Traer SIEMPRE lo último antes de editar (evita pisar producción)
cd C:\sistema-rl-gas
clasp pull

# 2. Editar el código  (Código.js)  ← aquí Claude te da el .ps1 quirúrgico

# 3. Subir a Apps Script (head). Si hay cambios, dirá que subió X archivos.
clasp push

# 4. (Opcional) Probar en la URL /dev (HEAD) — NO gasta versión:
#    https://script.google.com/macros/s/AKfycbzBjxlo...ThI2sT9H/dev

# 5. Publicar a PRODUCCIÓN (misma URL, 1 versión nueva controlada):
clasp deploy -i AKfycbxZP3UGad-XwRl7sCYmTxeex57b1hEfmqslhe5x0IOzzvpbEbM4VYFR2d52b_YMB1lyyA -d "v3.x - lo que cambiaste"
```

> 💡 La descripción de `-d` es solo la etiqueta de la versión. Ponla descriptiva (ej. `"v3.2 - fix dedupe getEstadisticas"`).

**(Opcional) Respaldo en git** del backend, para historial:
```powershell
Copy-Item C:\sistema-rl-gas\Código.js C:\sistema-rl-verfrut\backend\gas\codigo.gs -Force
cd C:\sistema-rl-verfrut
git add backend/gas/codigo.gs
git commit -m "gas: <que cambiaste>"
git push origin main
```

---

## 3) 🧹 Mantenimiento del cupo de versiones (cada cierto tiempo)

Apps Script permite **200 versiones**. Para limpiar las viejas:

1. Editor de Apps Script → ícono 🕒 **Historial del proyecto**.
2. 🗑️ **Eliminación masiva de versiones**.
3. La versión EN USO por producción **no aparece** (está protegida) → selecciona las viejas y **Eliminar**.

Para ver cuántas tienes:
```powershell
cd C:\sistema-rl-gas
clasp versions
```

---

## 4) ✅ Reglas de oro (no romper producción)

- **`clasp pull` SIEMPRE antes de editar en local** (no sobrescribir con copia vieja).
- **Una sola fuente de edición:** o el editor web, o local con clasp. Si mezclas, `pull` primero.
- **Nunca uses "Nueva implementación"** en la UI. Siempre `clasp deploy -i <ID prod>` (o en la UI: Administrar implementaciones → ✏️ → Nueva versión). Eso **conserva la URL**.
- **Deploy solo con cambios reales.** Si `clasp push` dice *"already up to date"*, no hay nada nuevo → no deployees (sería una versión repetida).
- 🔐 **No subas a GitHub** el archivo `~/.clasprc.json` ni la carpeta `C:\sistema-rl-gas` (llevan tu token).
- La API de Apps Script debe estar **Activada**: `https://script.google.com/home/usersettings`.

---

## 5) ⚡ Chuleta de comandos clasp

| Acción | Comando |
|---|---|
| Ver versiones (cuántas quedan) | `clasp versions` |
| Ver despliegues | `clasp deployments` |
| Traer código del editor → PC | `clasp pull` |
| Subir código PC → editor (head) | `clasp push` |
| Publicar a producción (misma URL) | `clasp deploy -i AKfycbxZP3UGad-...B1lyyA -d "v3.x - cambio"` |

---

*Costo: $0 (clasp + Apps Script + GitHub Pages son gratis). Lo único de pago es Azure, aparte.*
