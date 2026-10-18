# Pendientes del Sistema RL · revisar a mediados de noviembre 2026

Estado al 18-oct-2026: sistema estable y verificado (servidores OK, 18 módulos sin errores JS,
prueba automática en verde, actualizador automático funcionando). Esta semana se publicaron:
menú agrupado y compacto, Dashboard/modales/toasts modernizados, Capacitaciones con firma
digital por fotocheck, Visitas y Programación ETI modernizadas, Mantenimiento con carga rápida,
"Enviar Reporte" como botón en Mis Atenciones, "Trabajadores" (Buscar Trabajador + Consulta
por DNI), "Resumen General" oculto del menú, aviso flotante de novedades.

Regla permanente: nada se cambia sin maqueta aprobada por Joel; cambios aditivos (patrón
"piel": archivo JS nuevo con interruptor `window._XXX_V1`, reversible quitando el `<script>`).

## 1. Revisión de uso de módulos de indicadores (15-nov aprox.)
Pedir a Claude: **"revisemos el uso de los módulos"**.
- Leer tráfico de Firebase RTDB (`/trafico.json`, campos `accion`, `u`, `ts`), últimos 30 días,
  acciones "Entró a …" / "Abrió …" → aperturas y usuarios por módulo.
- Foco: Informe Gerencial, KPIs, Mis Estadísticas, Estadísticas Admin
  (oct-2026: 2, 0, 7 y 5 aperturas en 12 días) y cualquier módulo con < 5 aperturas.
- Proponer mantener / ocultar / fusionar; maqueta antes de ejecutar.

## 2. Firma digital en Capacitaciones
- Preguntar a los supervisores cómo les fue con el lector QR del fotocheck.
- Si un QR no da el código al instante: guardar `sessionStorage.rl_cap_ultimo_qr` y pasarlo
  a Claude para leer el código directo del carnet (hoy se toma de la BD, columna `codigo_trab`).

## 3. Azure (prevención, 10 min en el portal)
- Alerta de presupuesto en US$55/mes (hoy ~US$40, DB S1).
- Query Performance Insight: revisar `atenciones/stats` (la consulta más pesada).

## 4. Limpieza del repositorio (opcional)
- `git checkout -- frontend/js/inventario.js` (solo cambió el fin de línea, sin contenido).
- `tools/aplicar_mis_atenciones_azure.py` ya está aplicado; se puede guardar en git o borrar.

## 5. Próxima actualización con aviso a usuarios
- Editar `frontend/js/novedades.js`: cambiar `VERSION` y la lista `NOVEDADES`.
