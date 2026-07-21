# ============================================================
# fix-visitas-porcentaje-avance.ps1
# Sistema RL v3.0 - Modulo Visitas de Campo
# Agrega columna %AVANCE a renderVisitas, recalculando EN VIVO:
#   limite = fechaLimiteInforme(fecha_fin)  (2 dias habiles + temporada)
#   pct    = calcularAvance(calcularRetraso(limiteStr, hoy))  (igual que casos)
# Ajusta contadores de columnas dinamicas (7->8, 8->9) y colspan vacio.
# Patron: validacion todo-o-nada + .bak + idempotencia
# ============================================================

$ErrorActionPreference = 'Stop'
$path = ".\dashboard.html"

if (-not (Test-Path $path)) {
    Write-Host "ERROR: no se encuentra $path. Ejecuta desde C:\sistema-rl-verfrut\frontend\pages" -ForegroundColor Red
    exit 1
}

# Leer UTF-8 sin BOM
$content = [System.IO.File]::ReadAllText((Resolve-Path $path), [System.Text.Encoding]::UTF8)

# ---- Idempotencia ----
if ($content -match 'let _pctAv = 100;') {
    Write-Host "YA APLICADO: la columna %AVANCE de visitas ya existe. No se hace nada." -ForegroundColor Yellow
    exit 0
}

# Detectar fin de linea del archivo
$nl = if ($content -match "`r`n") { "`r`n" } else { "`n" }

# Helper: contar ocurrencias literales
function Count-Lit($s) { ([regex]::Matches($content, [regex]::Escape($s))).Count }

# ============================================================
# DEFINIR LOS 6 FRAGMENTOS (todos ASCII, unicos)
# ============================================================

# 1) Cabecera estatica: insertar <th>% Avance</th> antes de Acciones
$theadOld = '<th>Fundo</th><th>Semana</th><th>Estado</th><th>Acciones</th>'
$theadNew = '<th>Fundo</th><th>Semana</th><th>Estado</th><th>% Avance</th><th>Acciones</th>'

# 2) Contador dinamico admin 7 -> 8
$cnt7Old = 'esAdmin && thead.children.length === 7'
$cnt7New = 'esAdmin && thead.children.length === 8'

# 3) Contador dinamico no-admin 8 -> 9
$cnt8Old = '!esAdmin && thead.children.length === 8'
$cnt8New = '!esAdmin && thead.children.length === 9'

# 4) Inyectar el calculo del % ANTES del btnVer de visitas (ancla unica: verInformeGuardado)
$bodyOld = 'const btnVer    = `<button onclick="verInformeGuardado'
$bodyLines = @(
  'let _pctAv = 100;',
  '      if (v.fecha_fin) {',
  "        const _ff = new Date(String(v.fecha_fin).split('T')[0] + 'T00:00:00');",
  '        if (!isNaN(_ff)) {',
  '          const _lim = fechaLimiteInforme(_ff);',
  "          const _limStr = _lim.getFullYear() + '-' + String(_lim.getMonth()+1).padStart(2,'0') + '-' + String(_lim.getDate()).padStart(2,'0');",
  '          const _hoyV = new Date(); _hoyV.setHours(0,0,0,0);',
  '          _pctAv = calcularAvance(calcularRetraso(_limStr, _hoyV));',
  '        }',
  '      }',
  "      const _pctColor = _pctAv >= 100 ? '#16a34a' : (_pctAv >= 50 ? '#d97706' : '#dc2626');",
  '      const btnVer    = `<button onclick="verInformeGuardado'
)
$bodyNew = $bodyLines -join $nl

# 5) Inyectar el <td> del % antes del <td> de acciones
$tdOld = '<td style="display:flex;gap:4px;flex-wrap:wrap">${btnVer}'
$tdLines = @(
  '<td style="font-weight:700;color:${_pctColor}">${_pctAv}%</td>',
  '        <td style="display:flex;gap:4px;flex-wrap:wrap">${btnVer}'
)
$tdNew = $tdLines -join $nl

# 6) colspan del estado vacio 8 -> 9
$colOld = 'colspan="8" class="empty">Sin registros de visitas'
$colNew = 'colspan="9" class="empty">Sin registros de visitas'

# ============================================================
# VALIDACION TODO-O-NADA
# ============================================================
$checks = @(
  @{n='thead (Fundo..Acciones)';      s=$theadOld; c=(Count-Lit $theadOld)},
  @{n='contador admin ===7';          s=$cnt7Old;  c=(Count-Lit $cnt7Old)},
  @{n='contador no-admin ===8';       s=$cnt8Old;  c=(Count-Lit $cnt8Old)},
  @{n='ancla btnVer visitas';         s=$bodyOld;  c=(Count-Lit $bodyOld)},
  @{n='td acciones (flex btnVer)';    s=$tdOld;    c=(Count-Lit $tdOld)},
  @{n='colspan Sin registros';        s=$colOld;   c=(Count-Lit $colOld)}
)

Write-Host "Coincidencias encontradas (se espera 1 en cada una):" -ForegroundColor Cyan
$ok = $true
foreach ($ch in $checks) {
    $mark = if ($ch.c -eq 1) { 'OK ' } else { 'XX ' }
    $color = if ($ch.c -eq 1) { 'Gray' } else { 'Red' }
    Write-Host ("  [{0}] {1,-30} : {2}" -f $mark, $ch.n, $ch.c) -ForegroundColor $color
    if ($ch.c -ne 1) { $ok = $false }
}

if (-not $ok) {
    Write-Host "ABORTADO: alguna coincidencia no es exactamente 1. No se modifico nada (sin .bak)." -ForegroundColor Red
    exit 1
}

# ---- Backup ----
$bak = "$path.bak"
[System.IO.File]::WriteAllText((Join-Path (Get-Location) $bak), $content, (New-Object System.Text.UTF8Encoding $false))
Write-Host "Backup creado: $bak" -ForegroundColor Green

# ---- Aplicar (literal .Replace, en orden) ----
$content = $content.Replace($theadOld, $theadNew)
$content = $content.Replace($cnt7Old,  $cnt7New)
$content = $content.Replace($cnt8Old,  $cnt8New)
$content = $content.Replace($bodyOld,  $bodyNew)
$content = $content.Replace($tdOld,    $tdNew)
$content = $content.Replace($colOld,   $colNew)

# ---- Guardar UTF-8 sin BOM ----
[System.IO.File]::WriteAllText((Resolve-Path $path), $content, (New-Object System.Text.UTF8Encoding $false))

Write-Host ""
Write-Host "LISTO: columna %AVANCE agregada a la tabla de visitas." -ForegroundColor Green
Write-Host "Recalcula en vivo desde fecha_fin con la regla de casos (100% en plazo, -10%/dia habil)." -ForegroundColor Cyan
Write-Host "Verifica con Ctrl+Shift+R y revisa que admin y supervisor vean la tabla cuadrada." -ForegroundColor Gray
