# Seguridad · Paso 2: cerrar Firebase (presencia, mensajes, tráfico, historial, bienestar) — sin costo

Problema (informe 2.4): esos nodos tenían `.read: true` (y varios `.write: true`): cualquiera con la URL de
la base podía leer los mensajes internos de Coordinación, la presencia y el tráfico, o escribir a nombre de otro.

Solución: autenticación **anónima** de Firebase (gratis en el plan Spark; es el mismo proveedor que ya usan
presencia.js y el Dashboard con el SDK) + reglas `auth != null`. Nada de Blaze, nada de pago.

## Qué cambió (ya hecho)
- **`frontend/js/firebase-llave.js`** (`_FB_LLAVE_V1`): obtiene una llave anónima por navegador (REST, sin SDK),
  la guarda en localStorage, la renueva sola, y agrega `auth=<llave>` a toda llamada REST a la base RL que no la
  traiga. Si no consigue llave, las llamadas salen como hoy (sin auth). Probado en jsdom (11 casos) y en vivo.
- Incluido como 2.º script del `<head>` (después de azure-token.js) en index.html y en las 18 páginas que tocan
  Firebase. En **Sistema ETI** (`sistema-eti/index.html`) y **Evaluación ETI** (`index.html`) se carga desde el
  sitio RL: `https://joeltimoteog-bot.github.io/sistema-rl-verfrut/frontend/js/firebase-llave.js`.
- **monitor.html**: firma anónima con el SDK en su propia app (igual que presencia.js) para `onValue`.
- **`database.rules.json`** (respaldo `.bak-18oct-antes-auth`): presencia, mensajes, tráfico, historial y
  bienestar/senales pasan a `auth != null` (se conservan todas las validaciones de forma y tamaño).
- El Apps Script no se ve afectado: escribe con `FIREBASE_DB_SECRET` (acceso de administrador).

## Activación (en este orden; cada paso es reversible)

### 1) Publicar los tres sitios (frontend primero, reglas después)
```
cd C:\sistema-rl-verfrut
git add frontend/js/firebase-llave.js index.html frontend/pages/*.html database.rules.json docs/SEGURIDAD_PASO2_FIREBASE.md
git commit -m "Firebase: llave anonima para presencia/mensajes/trafico + reglas auth (sin costo)"
git push

cd C:\sistema-eti
git add index.html
git commit -m "Llave anonima de Firebase (Monitor RR.LL.)"
git push

cd "C:\Sistema - Evaluacion Eti"
git add index.html
git commit -m "Llave anonima de Firebase (Monitor RR.LL.)"
git push
```
Esperar ~3 min (GitHub Pages) y avisarme: verifico desde Chrome que las escrituras de presencia/tráfico salen con
`auth=` en los tres sitios. **Hasta aquí nada cambia para los usuarios** (las reglas siguen abiertas).

### 2) Pegar las reglas en Firebase (2 min)
Consola de Firebase → proyecto **sistema-rl-verfrut** → Realtime Database → pestaña **Reglas**:
1. Copiar lo que hay y guardarlo en un bloc de notas (respaldo).
2. Pegar el contenido completo de `C:\sistema-rl-verfrut\database.rules.json` → **Publicar**.
Las reglas aplican al instante. Los usuarios con la pestaña ya abierta siguen funcionando (su llave ya está cargada).

### 3) Verificación (la hago yo)
- Sin llave: `GET /presencia.json`, `/mensajes.json`, `/trafico.json` → **401**.
- Con llave anónima: 200; el Monitor en vivo muestra usuarios y mensajes; el tráfico sigue llegando.
- Usuarios: entrar al Dashboard, abrir el Monitor, enviar un mensaje 💬 desde el Monitor y verlo llegar.

### Volver atrás
Consola de Firebase → Reglas → pegar el respaldo (`database.rules.json.bak-18oct-antes-auth`) → Publicar. 30 s.

## Pendiente del punto 2.4
Las reglas de **Firestore** (programación ETI, proyecto sistema-eti-verfrut) no están en el repositorio:
revisar en la consola de ese proyecto que no estén en modo prueba (`allow read, write: if true`).
