# Sedes Piura / Olmos — estado y reglas (21-nov-2026)

Documento de referencia para cualquier sesion futura. Resume **todo lo hecho** para separar las sedes Piura y Olmos
en el Sistema RR.LL., Bienestar, Evaluaciones ETI y Capacitaciones ETI, las reglas que decidio Joel, los interruptores
para apagar cada cosa y lo que falta. Leer esto ANTES de tocar cualquier cosa de sedes.

> Seguridad: este documento no lleva DNIs, claves ni reglas de calculo de KPI. No agregarlos.

---

## 1. Reglas de negocio (decisiones de Joel)

- **Cada sede ve solo lo suyo.** Un usuario de Olmos ve Olmos; uno de Piura ve Piura. Vale tambien para administradores.
- **Ven las dos sedes:** `jtimoteo` siempre (creador y dueno del sistema). En el RR.LL. tambien quien tenga alcance `GENERAL`.
  En los ETI, ademas, `lcastillo` (programa las fechas de las dos sedes).
- **Dora Aguilar** (subgerente de Bienestar, sede Olmos): debe ver Bienestar de Piura y Olmos -> alcance `GENERAL` (lo asigna Joel en pantalla).
- **Usuario de Olmos** = empresa `OLMOS` en Gestion de Usuarios.
- **Registro de Olmos** = su empresa contiene OLMOS / BOMAREA / PIRONA / MOSQUETA / HEFEI / LEFKADA, o su fundo es de Olmos,
  o lo registro un usuario de Olmos.
- **Alcance por usuario** (`rl.usuarios.alcance`): `PROPIO` (solo lo suyo), `SEDE` (toda su sede), `GENERAL` (las dos sedes).
- **Olmos se organiza en los ETI por sus 5 empresas; cada empresa es un sector.** Mismo cuestionario y mismos temas que Piura.
- **Razones sociales de Olmos:** Bomarea S.R.L. · Inversiones Pirona S.A.C. · Inversiones Mosqueta S.A.C. · Inversiones Hefei S.A.C.
  **Lefkada: pendiente** (Joel debe confirmarla; hasta entonces sale "Lefkada (razon social por confirmar)" y no se emiten informes).
- **Registros antiguos de Bienestar** son todos de Piura. La tabla de hostigamiento de Olmos se deja tal cual; Piura tiene la suya con el mismo modelo.
- **Aviso de reincidencia (Precedentes) es por sede**: no cruza antecedentes entre Piura y Olmos (confirmado por Joel el 21-nov).
- **Nadie asigna accesos ni roles de personas salvo Joel**, en pantalla.

## 2. Donde vive la regla

| Sistema | Archivo | Que hace |
|---|---|---|
| RR.LL. servidor | `azure/functions/shared/sede.js` | `modo` (TODO/OLMOS/PIURA), `olmos`, `condOlmos`, `filtroSQL`, `esOlmos`, `filtrarFilas`, `alcanceDe`, `EMPRESAS_OLMOS`, `MSG_OTRA_SEDE` |
| RR.LL. pantalla | `frontend/js/dashboard/68-sede-v1.js` | marca de sede en listas |
| Evaluaciones ETI pantalla | `js/00-sedes-eti.js` (`window.ETI_SEDES`) | sedes, sectores, empresas, razones sociales, `visible`, `razonInforme`, `sectoresInforme`, `claveDe`, `clavesEmp` |
| ETI servidor | `azure/functions/eti/index.js` | `SEDE_COLS`, `sedeDe`, `condSede`, `ETI_AMBAS` |

El servidor se arma con `bash edge-build/build.sh SRC OUT` y se publica con `desplegar-servidor.ps1` (lo corre Joel).

## 3. Lo publicado, por sistema

### Sistema RR.LL. (`C:\sistema-rl-verfrut`)
- Atenciones, estadisticas, pizarron, modulos: filtran por sede; editar/eliminar de otra sede -> 403.
- Casos y visitas: alcance SEDE/GENERAL; editar/eliminar de otra sede -> 403; ediciones de casos ajenos de la misma sede solo se **registran** (no se bloquean).
- Bienestar (`bs/`): tablas propias en Supabase, por sede; importar y cierre masivo respetan la sede.
- Gestion de Usuarios: boton Editar (nombre, rol, empresa, correo, alcance).
- Bienvenida para usuarios de Olmos (`bienvenida-olmos.js`).
- Control central de modulos (`shared/modulos-guard.js`): secreto `MODULOS_GUARD` = `log` (hoy) / `on` / `off`; anota en `rl.acceso_registro`.
- **Precedentes por sede** (`prec/index.js`, `_PREC_SEDE_V1`): listar, ver, editar, eliminar, materias y aviso. Commit `4593fad`.
- **Panel principal** (`04-nucleo-dashboard.js`, `_SEDE_FB_STATS_V1`): un usuario de Olmos no usa el resumen global de Firebase `/estadisticas`; sus cifras salen del servidor. Commit `4593fad`.
- **Panel principal, todos los usuarios** (`24-stats-azure-v1.js` + `shared/stats-pizarron.js`, `_SEDE_FB_STATS_V2`): flechas y barras, comparativa, RAPEL/VERFRUT del mes, ranking de supervisores y tendencia de 6 meses salen del servidor (`/atenciones/stats`, campos nuevos `mes_actual` y `por_mes_empresa`), ya filtrados por sede. Firebase `/estadisticas` solo avisa que algo cambio (refresca la lista en vivo); ya no pinta cifras. Si el servidor no entrega los campos nuevos, la pantalla sigue con Firebase como antes. Con el servidor caido no se muestran cifras globales de Firebase. Prueba automatica agregada en `tools/prueba_sistema.py` (232 pruebas).

- **Busqueda de trabajadores por sede** (`trabajadores-search`, `_SEDE_TRAB_V1/V2`, 23-nov): usuario de Olmos -> solo `Trabajadores_OLMOS` (si no esta cargada, no encuentra a nadie); usuario de Piura -> RAPEL y VERFRUT; GENERAL y jtimoteo -> todas. Si el trabajador existe en la otra sede responde "No cuenta con acceso a la información de la sede ..." (`otra_sede: true`, sin datos). La pantalla muestra el aviso (`RLSedeAviso` en `68-sede-v1.js`) y, para usuarios de Olmos, ya no usa la busqueda de respaldo en Google (`_SEDE_GOOGLE_V1`). Decision de Joel (23-nov): ningun usuario de Olmos, incluida Dora (alcance SEDE), ve personal de Piura; la excepcion solo la da Joel con alcance GENERAL.
- **Papelera de atenciones eliminadas por sede** (`atenciones-eliminadas`, `_SEDE_ELIMINADAS_V1`, 23-nov).

### Evaluaciones ETI (`C:\Sistema - Evaluacion Eti`, repo `eti-evaluacion-verfrut`)
- Sin prueba automatica: **el push publica directo**. Se edita con respaldo en `_bak/`.
- Sedes y sectores centralizados (`8aec61e`); empresa del QR sigue al sector y la sede (`5bf1b4a`).
- Evaluacion manual, Indicadores, Mis evaluaciones, informes (cierre de ciclo, expediente, capacitaciones, evaluaciones, hojas por ruta, informe por sector) y encuesta de satisfaccion por sede; razon social de Olmos en informes; "General · ambas empresas" es solo Piura (`b70e873`).
- El QR permanente de un supervisor que ya tiene uno se puede cambiar de empresa/sector: pregunta y actualiza el mismo QR (`_ETI_QR_CAMBIO_V1`, `b70e873`).
- Indicadores se piden con la sesion (`e87b5ba`).
- **Pagina del QR (`evaluar.html`) lee la evaluacion primero de Supabase**, luego Firebase, luego la copia del celular (`_QR_SUPABASE_V1`, `f494161`). - **El ENVIO de respuestas del QR tiene a Supabase como destino principal** (`_QR_ENVIO_SUPABASE_V1`, `ecfdc45`): la pagina envia directo a `/api/eti/escribir` (origen `qr`), Firebase queda de respaldo y `etieval/guardar` como copia; "enviada" = confirma Supabase (o Firebase si Supabase no responde). Mismo id en los reintentos: no duplica. Probado en vivo el 21-nov con una sesion de prueba (envio normal y con reintentos), ya eliminada.

### Capacitaciones ETI (`C:\sistema-eti`, repo `sistema-eti`)
- Lee y guarda por el mismo servidor `/api/eti` (motor `eti-fs-shim.js`), asi que el filtro por sede del servidor ya le aplica.
- El sector sale del supervisor (texto libre con prefijo `SECTOR `). **Un supervisor de Olmos debe registrarse con SECTOR BOMAREA / PIRONA / MOSQUETA / HEFEI / LEFKADA**; con otro nombre el servidor lo trata como de Piura. Hay sugerencias en los dos formularios (`e8d3a24`).
- `script.js` es GENERADO desde `src\NN-*.js` con `construir-script.ps1`.

### Servidor de los ETI (`/api/eti`, en el repo del RR.LL.)
- `_ETI_SEDE_SERVIDOR_V1` (`dd58c06`): con sesion, `consultar` y `doc` entregan solo documentos de la sede del usuario. Sin sesion (pagina del trabajador) no cambia.
- `_ETI_SEDE_ESCRITURA_V1` (`646fa48`): con sesion, nadie modifica ni borra un documento existente de la otra sede. **Crear no se restringe.** El mensaje de error incluye "no permitida" a proposito (asi la cola espejo no reintenta).
- `_ETI_STATS_SEDE_V1` (`646fa48`): `etieval/stats` filtra por sede cuando llega la sesion.
- `_ETI_SEDE_SUPS_V1` (`15015be`): `supervisores_eti` tambien va por sede.
- Colecciones con sede (`SEDE_COLS`): respuestas_qr, evaluaciones_conocimiento, sesiones_qr, programaciones_eti, programaciones_eval, capacitaciones, encuestas_qr, encuestas_sat, alertas_ref, informes_eti, informes_cap, informes_enviados, evaluaciones_depuradas, supervisores_eti.

## 4. Interruptores (secretos de Supabase)

| Secreto | Valor | Efecto |
|---|---|---|
| `SEDE_FILTRO` | `off` | Apaga TODA la separacion por sede en el servidor (RR.LL. y ETI). Solo para emergencia. |
| `MODULOS_GUARD` | `log` / `on` / `off` | Control central de modulos. Hoy `log`. |
| `ETI_STATS_SESION` | `on` | Exige sesion para ver indicadores de ETI. Hoy apagado: activar tras confirmar que todos entran. |

En el navegador: `localStorage.eti_motor = 'firestore'` devuelve Capacitaciones ETI a Firebase (camino de retorno).
En el celular / navegador: `localStorage.eti_qr_envio = 'firebase'` devuelve el envio del QR a como era (Firebase manda).
En el navegador: `localStorage.stats_fuente = 'firebase'` devuelve los cuadros del panel principal del RR.LL. al resumen de Firebase.

## 5. Pendientes

**De Joel**
- Alcance `GENERAL` a Dora. Configurar a `mportocarrero` en Acceso a Modulos (hoy sin filas de permisos; su rol le abre todo).
- Razon social de Lefkada. Nomina de Olmos (para restringir la busqueda de trabajadores por sede).
- Decidir quien edita casos ajenos dentro de la misma sede.
- Probar con Dora: bienvenida, modulos y su QR de ETI.

**Tecnicos, en este orden**
1. Con uso real: revisar que todos entren a Indicadores de ETI y activar `ETI_STATS_SESION=on`; revisar `rl.acceso_registro` antes de `MODULOS_GUARD=on`.
2. HECHO (21-nov): envio del QR con Supabase como destino principal (`_QR_ENVIO_SUPABASE_V1`).
3. HECHO (21-nov): panel principal con las cifras del servidor para todos (`_SEDE_FB_STATS_V2`). Falta mirarlo con uso real el lunes.
4. Retirar Firebase (ya se puede empezar). Unas 30 pantallas del RR.LL. y los dos ETI aun lo leen o lo usan de respaldo. Decision de Joel (21-nov): TODO debe leer y guardar en Supabase; Firebase no debe quedar ni como respaldo.
   Ojo: `evaluar.html` hoy NO abre si Firebase no carga (muestra "Sin conexion"); hay que quitar esa dependencia antes de retirar Firebase del QR. Opcional: prueba de carga de 100 envios simultaneos del QR (no se ha hecho).
5. Pendientes antiguos: sesion obligatoria en Apps Script (`GAS_SESION_MODO=on`), rotar la clave de sesiones (cierra la sesion de todos: hacerlo en un horario sin usuarios), origenes permitidos (CORS/CSP), retirar Azure.
6. Supervisores de Olmos en la lista fija de Evaluaciones ETI (`js/01-nucleo-evaluaciones.js`) cuando los contraten.

**Respaldos (21-nov-2026, sin costo adicional; Joel descarto PITR por precio)**
- Supabase: respaldo diario automatico (toda la base, ultimos dias). PITR NO esta activo.
- Drive `Respaldos Sistema RR.LL.`: copia semanal (domingo 03:00, `respaldo-semanal.js`), ahora con los esquemas `rl` y `eti`.
- Drive `Respaldos Sistema RR.LL. > ETI diario`: copia de cada noche (23:00, `respaldo-eti-diario.js`, `_RESPALDO_ETI_V1`) del esquema `eti`; guarda 14 noches; avisa por correo si falla. Primera copia real: 53 tablas, 10 390 filas, unos 2,5 min (el limite del script es 5 min: si los ETI crecen mucho habra que partirla).
- Sin copia propia: los archivos de Storage (pendiente de revisar).

**Limites conocidos (no ocultar)**
- **Bienestar Social, cierre de pantalla para Olmos** (`_BS_SEDE_PANTALLA_V1`, 23-nov): `assets/js/bs-sede.js` (cargado despues de `modal-system.js` en portal, panel y los 21 modulos). El servidor dice la sede en `bs/permisos` (`sede`: OLMOS / PIURA / TODO, `_BS_SEDE_PERMISOS_V1`). A un usuario de Olmos se le cierran las consultas y guardados que van al Apps Script de Bienestar (siguen pasando: iniciar sesion, llave de Supabase, permisos, bitacora y correos de aviso), ve el aviso "No cuenta con acceso a la informacion de la sede Piura." y las listas/pastillas de empresa muestran BOMAREA, PIRONA, MOSQUETA, HEFEI, LEFKADA. Piura y alcance General: sin cambios. Interruptor (no vale para Olmos): `localStorage.bs_sede_pantalla='off'`. Respaldo: `_bak/sede-pantalla-23nov/`.
- **Bienestar Social, cierre dentro de Google** (`_BS_SEDE_GOOGLE_V1`, 23-nov, Apps Script version 93): al iniciar sesion, `auth/sso` (accion `sesion`) dice la sede del usuario (`_SSO_SEDE_V1`) y el Apps Script la guarda en la sesion (`permisos._sede`). A una sesion de OLMOS, `bs_validarAcceso` le rechaza toda accion de datos (403, `otra_sede`), salvo `bs_login`, `bs_sbToken`, `bs_permisosUsuario`, `bs_registrarEvento` y `bs_notificar*`. Interruptor: propiedad del script `BS_SEDE_GOOGLE=off`. Respaldos: `gas/*.bak-20261123-1050`.
- **Limites conocidos de Bienestar:** una sesion de Google anterior al cambio (o creada cuando el servidor no pudo leer la sede) no trae la sede y no se cierra hasta el siguiente inicio de sesion (12 h como maximo); ahi sigue valiendo el cierre de pantalla. Etiqueta "Sede Olmos" / "Ambas sedes" y textos de tarjetas: `_BS_SEDE_ETIQUETA_V1` (bs-sede v2) y `_SEDE_ETIQUETA_V1` (RR.LL.). Falta: indicadores de cada modulo con filtros RAPEL/VERFRUT (se veran cuando Olmos tenga casos), sectores/buzones de Olmos en los formularios y que un usuario de Piura no vea por Google la hoja de Hostigamiento de Olmos.
- El servidor de Google (Apps Script) del RR.LL. tampoco filtra por sede; solo se usa de respaldo cuando Supabase falla.
- `MODULOS_GUARD` sigue en `log`: con `on` hoy se bloquearia a una usuaria de Piura al cargar Casos y Visitas en su panel (revisar el mapa antes).
- Mientras Firebase exista como respaldo, los datos de los ETI siguen ahi sin el filtro por sede.
- Usuarios de ETI que no existen en `rl.usuarios` se tratan como de Piura.
- El filtro del servidor de ETI solo se probo en produccion con `jtimoteo` (que ve todo); el resto se probo en base de prueba y por conteos.

## 6. Como se trabaja (reglas de Joel)

- No mentir: decir que se probo y que no. Probar antes de publicar. Cambios quirurgicos con `.bak`.
- Un bloque de PowerShell por mensaje. Scripts `aplicar-*.ps1` 100 % ASCII, en `C:\sistema-rl-verfrut\_parches\<carpeta>`.
- Joel ejecuta `git push`, `desplegar-servidor.ps1`, `clasp` y los SQL. No usar sus credenciales ni las de otras personas.
- Consultas en el editor SQL de Supabase: solo lectura y solo conteos (nunca DNIs ni listas de personas).
- El flujo `publicar.yml` del RR.LL. corre `tools/prueba_sistema.py` (231 pruebas) y publica solo si todo pasa (~5-8 min).
