# ETI etapa 3 — Supabase manda (15-nov-2026)

Estado de los dos sistemas ETI después de esta sesión. Todo lo que ve un usuario sale de Supabase
(proyecto `exdjzbfinppzatjyimxn`, esquema `eti`, tablas `eti.<coleccion>` con `id` + `datos jsonb`).
Firestore (`sistema-eti-verfrut`) queda **solo como respaldo** durante ~2 semanas; luego se retira.

## Capacitaciones ETI (`C:\sistema-eti`)
- `js/eti-fs-shim.js` (_ETI_SUPABASE_V3): reemplaza las funciones de Firestore que usa `script.js`
  (`collection, doc, addDoc, getDocs, updateDoc, deleteDoc, deleteField, query, orderBy, onSnapshot`).
  - Lee y escribe en Supabase (`/api/eti/consultar|doc|escribir`) con el token del RR.LL.
    (`sessionStorage.eti_rl_token`, ahora guardado para todos los usuarios, no solo admin).
  - Cada escritura se copia a Firestore en segundo plano (respaldo; si falla se reintenta cada 15 s).
  - `onSnapshot` = sondeo a Supabase cada 12 s + al volver a la pestaña + al instante tras escribir.
  - Sin token, sin red o si Supabase falla en la primera lectura → Firestore, como antes.
- `src/01-core.js` importa el shim; `src/02-sesion.js` guarda el token; `index.html` → `script.js?v=src12`.
- `src/` quedó sincronizado con `script.js` (dos ediciones del 14-nov estaban solo en el generado).
- Servidor: `eti/escribir` acepta `borrar:[campos]` (equivalente a `deleteField`).
- Prueba en producción (15-nov): crear/actualizar/eliminar supervisor → Supabase y Firestore iguales;
  paridad final 23/29/20/10 documentos, 0 diferencias.

## Evaluaciones ETI (`C:\Sistema - Evaluacion Eti`)
- `frontend/js/eti-supabase.js` V4 (_ETI_SUPABASE_V4), cargado por `index.html?v=4`:
  - Escrituras: Supabase primero; si el servidor responde error (permiso/validación) el usuario lo ve y
    **no** se escribe en Firestore. Luego copia a Firestore (respaldo). Sin red → Firestore + cola, como antes.
  - Lecturas `.get()`: Supabase primero, Firestore solo si Supabase falla (ya no hay carrera).
  - `onSnapshot` (consultas y documentos): sondeo a Supabase cada 12 s; si la primera lectura falla,
    escucha de Firestore.
  - Comparación en sombra: máximo 40 por carga; las diferencias se anotan (`etiSupabase.estado().diferenciasAnotadas`)
    y **no** se repara Supabase con Firestore (Supabase manda).
  - `COLS_LECTURA` incluye ahora `programaciones_eti`.
- `evaluar.html` (QR del trabajador en campo) **no cambia**: Firestore con cola sin conexión + espejo a
  Supabase. Pendiente: replicar la cola sin conexión contra Supabase antes de moverlo.
- Prueba en producción (15-nov): 11 lecturas Supabase / 0 Firestore, 5 escuchas, set/update/get/delete OK.
  Quedó un documento residual en Firestore `config_eti/prueba_etapa3_15nov` (las reglas de Firestore no
  permiten borrar en `config_eti`): borrar a mano desde Firebase Console. No afecta al sistema.

## Volver atrás (sin publicar nada)
- Capacitaciones: `localStorage.eti_motor = 'firestore'` y recargar.
- Evaluaciones: `localStorage.eti_motor = 'firestore'` y recargar (vuelve a V3: Firestore + espejo + carrera).

## Herramientas (consola F12)
- Capacitaciones: `etiMotor.estado()`, `etiMotor.verificar()`, `etiMotor.copiarASupabase()`, `etiMotor.copiarAFirestore()`.
- Evaluaciones: `etiSupabase.estado()`, `etiSupabase.verificar()`, `etiSupabase.copiarTodo()`.

## Pendientes
1. `evaluar.html` a Supabase con cola sin conexión propia.
2. Tras 2 semanas sin diferencias: retirar Firebase de ambos ETI (SDK, reglas, llave anónima).
3. Capacitaciones pierde la sesión al recargar o al cambiar de módulo desde la barra superior (ya era así).
