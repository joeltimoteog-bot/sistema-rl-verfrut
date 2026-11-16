# Propuesta: qué quitar, qué juntar y qué agregar en el Sistema RR.LL. (15-nov-2026)

Base: `actividad/resumen` 2026 (ingresos por módulo desde oct-2026, 37 usuarios con acceso, ~17 activos).
Nada de esto se ejecuta sin aprobación de Joel; cada cambio será una "piel" reversible.

## 1. Uso real (ingresos · personas distintas)
| Módulo | Ingresos | Personas |
|---|---:|---:|
| Atenciones | 741 | 17 |
| Registro de casos | 154 (+18) | 13 |
| Visitas de campo | 107 (+6) | 13 |
| Mis Atenciones | 70 | 11 |
| Reportes por correo | 48 | 10 |
| Consulta masiva | 43 | 12 |
| Capacitaciones | 39 | 9 |
| Bienestar Social | 38 | 6 |
| Estadísticas / Estadísticas de atenciones | 29 / 27 | 10 / 9 |
| Fusiones de buses | 22 | 6 |
| Control de cumplimiento | ~31 (5 nombres distintos) | 2 |
| Horas / Acumulación de horas | 19 / 11 | 2 |
| Almuerzos / Programación de almuerzos | 16 / 14 | 2 |
| Programación ETI | 15 | 2 |
| Cálculo remunerativo | 13 + 11 | 8 |
| Mantenimiento / Solicitudes de mantenimiento | 13 / 11 | 6 |
| Indicadores KPI · Cerebro · Evaluación 360 · Padrón · Alertas | 2–13 c/u | 1 |
| Actividad de usuarios · Acceso a Módulos · Gestión usuarios · Seguridad | solo administrador | 1–2 |

Lectura: el equipo vive en **Atenciones → Registro de casos → Visitas → Mis Atenciones**. Diez módulos
los usa una sola persona (Joel). Varios módulos aparecen con 2–5 nombres distintos en la actividad
(Control de cumplimiento0…6, Registro de casos/Casos, Visitas de campo/Visitas de Campo, Actividad de
usuarios/Usuarios): el nombre se registra desde distintas pantallas y eso ensucia la estadística.

## 2. Quitar (del menú; el código y los datos se conservan)
- `navProgEti` y `navAppEti` duplicados: dejar **un** acceso "ETI" que abra el hub (Capacitaciones /
  Evaluaciones) con el pase sso2.
- `navMonitor` y `navFbAlertas` (dependen de Firebase): retirar junto con Firebase; "Actividad de usuarios"
  ya cubre lo útil.
- "Resumen General" ya está oculto; eliminar también su entrada del catálogo de permisos.

## 3. Juntar
- **Personas**: Trabajadores + Consulta por DNI + Consulta masiva → una sola pantalla con pestañas
  (Buscar · Masiva · Padrón). Hoy 3 entradas para la misma pregunta "¿quién es?".
- **Indicadores**: Estadísticas + Estadísticas de atenciones + Indicadores KPI + Evaluación 360 → una
  pantalla "Indicadores" con filtros (atenciones / visitas / capacitaciones / 360). Las cuatro las usa
  casi solo Joel.
- **Horas**: Horas + Acumulación de horas → una pantalla con dos pestañas (2 personas las usan).
- **Almuerzos**: Almuerzos + Programación de almuerzos → una pantalla.
- **Mantenimiento**: Mantenimiento + Solicitudes de mantenimiento → una pantalla (solicitud y atención).
- **Administración** (solo admin): Acceso a Módulos + Gestión usuarios + Seguridad + Actividad +
  Cerebro + Alertas → un grupo "Administración" colapsado al final del menú.

Resultado: de ~30 entradas a ~14, sin perder ninguna función.

## 4. Agregar (para que el usuario interactúe más)
1. **"Mi día"** como pantalla de inicio del supervisor: sus atenciones pendientes, visitas programadas,
   capacitaciones ETI del día, alertas de Bienestar que le tocan y un botón "Registrar" por cada una.
   Es la única pantalla nueva que mueve el uso: hoy entran a Atenciones 741 veces para ver lo mismo.
2. **Avisos dentro del sistema** (campana), sin Firebase: tabla `rl.avisos` en Supabase + sondeo cada 60 s.
   Caso de uso: "tu reporte fue observado", "te asignaron una visita", "ETI vencida".
3. **Captura sin señal** en Atenciones y Visitas: guardar el formulario en el navegador y enviarlo cuando
   vuelva la red (mismo patrón que la cola del espejo ETI). En campo es la queja número 1.
4. **Confirmación al trabajador**: al registrar una atención, opción de enviar constancia por WhatsApp/SMS
   con el número de caso (transparencia hacia el trabajador; refuerza lo de Bienestar).
5. **Nombre único por módulo** en `actividad/ingreso` (catálogo central) para que la estadística de uso
   sea confiable y se pueda volver a medir en 30 días.

## 5. Orden sugerido
Semana 1: nombres únicos (5) + quitar duplicados (2) + grupo Administración.  
Semana 2: Personas e Indicadores juntos.  
Semana 3: "Mi día".  
Semana 4: avisos y captura sin señal.  
Medir de nuevo con `actividad/resumen` a los 30 días.
