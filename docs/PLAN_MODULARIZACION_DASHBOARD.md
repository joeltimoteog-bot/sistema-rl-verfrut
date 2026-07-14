# Plan de Modularización — dashboard.html

**Estado:** propuesto (no ejecutado). Fecha: 14-jul-2026
**Problema:** `frontend/pages/dashboard.html` = 580 KB / ~10,350 líneas. Todo el JS vive inline en un solo `<script>`.

## Mapa de módulos (líneas aprox. del archivo original)

| Módulo | Líneas | Tamaño | Archivo destino propuesto |
|---|---|---|---|
| Fusiones de Buses | 1312–1867 | ~556 líneas | `frontend/js/fusiones-buses.js` |
| Visitas de Campo (parte 1: carga/filtros) | 1868–2019 | ~150 líneas | `frontend/js/visitas.js` |
| Solicitudes de Edición | 2020–2113 | ~95 líneas | `frontend/js/solicitudes-edicion.js` |
| Accesos Temporales | 2114–~3250 | ~1,100 líneas | `frontend/js/accesos-temporales.js` |
| **Casos** (el más grande) | 3348–~7580 | ~4,200 líneas | `frontend/js/casos.js` (subdividir) |
| Comparativa mes actual/anterior | ~7580–8130 | ~550 líneas | `frontend/js/estadisticas-comparativa.js` |
| Visitas de Campo (parte 2: PDF/informes) | 8135–~9180 | ~1,050 líneas | `frontend/js/visitas.js` (mismo archivo) |

## Procedimiento seguro (por módulo, uno a la vez)

1. Copiar el bloque a `frontend/js/<modulo>.js` (sin tags `<script>`).
2. En dashboard.html, reemplazar el bloque por:
   ```html
   </script>
   <script src="../js/<modulo>.js"></script>
   <script>
   ```
   Las declaraciones top-level (`const`/`let`/`function`) siguen siendo accesibles entre bloques `<script>`; solo importa mantener el **orden de carga**.
3. Verificar que las variables compartidas (`USER`, `API`, `AZURE_FN_BASE`, `_fusionesData`, etc.) queden declaradas **antes** del script externo.
4. Probar en local (login + módulo extraído completo) antes de commit.
5. Commit individual por módulo — rollback fácil.

## Orden recomendado

1. **Fusiones de Buses** — el más autocontenido, buen piloto.
2. Solicitudes de Edición (pequeño).
3. Comparativa estadísticas.
4. Visitas de Campo (unificar partes 1 y 2).
5. Accesos Temporales.
6. Casos — al final, subdividido (casos-crud.js, casos-ui.js, casos-pdf.js).

## Notas

- El patrón ya existe: `frontend/js/capacitaciones.js`, `almuerzos.js`, `horas.js`, `inventario.js` se cargan igual.
- Los `onclick="fn()"` inline siguen funcionando (resuelven en runtime global).
- ⚠️ No redeclarar `const` entre bloques: si un módulo extraído define `const X` que también existe en el inline restante, lanza SyntaxError. Verificar con búsqueda antes de cada extracción.
- Beneficio extra: los .js externos se cachean en el navegador; el HTML queda liviano.
