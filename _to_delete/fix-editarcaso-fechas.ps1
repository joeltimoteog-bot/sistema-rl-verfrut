# ==========================================================
# fix-editarcaso-fechas.ps1
# Sistema RL v3.0 - Modulo Registro de Casos
#
# Bug: al EDITAR un caso, la Fecha Reporte queda vacia y, en cascada,
# Temporada y Fecha Limite no se muestran.
#
# Causa: Sheets devuelve las fechas como timestamp ISO con hora
# (ej. 2026-04-01T05:00:00.000Z). El campo cFechaReporte es <input type=date>
# y rechaza ese formato -> queda vacio -> calcularFechaLimiteCaso() lee
# el input vacio y no calcula Temporada ni Fecha Limite.
#
# Fix: normalizar a YYYY-MM-DD (quitar la hora con split('T')[0]) en
# editarCaso para: cFechaReporte (clave), cTermino y cIngreso.
# Con la Fecha Reporte valida, calcularFechaLimiteCaso() (llamada en la
# linea 3096) recalcula Temporada + Fecha Limite y se visualizan.
# ==========================================================

$ErrorActionPreference = 'Stop'
$path = 'C:\sistema-rl-verfrut\frontend\pages\dashboard.html'

if (-not (Test-Path $path)) {
    Write-Host "[ABORTADO] No se encontro: $path" -ForegroundColor Red
    exit 1
}

$enc = New-Object System.Text.UTF8Encoding $false
$raw = [System.IO.File]::ReadAllText($path, $enc)

# Idempotencia
if ($raw.Contains("c.fecha_reporte ? String(c.fecha_reporte)")) {
    Write-Host "[INFO] El fix ya estaba aplicado. Nada que hacer." -ForegroundColor Yellow
    exit 0
}

# Reemplazos tolerantes a espacios (regex). Cada uno debe coincidir 1 vez.
$edits = @(
    @{ name='cFechaReporte';
       rx="getElementById\('cFechaReporte'\)\.value\s*=\s*c\.fecha_reporte\s*\|\|\s*''";
       new="getElementById('cFechaReporte').value = c.fecha_reporte ? String(c.fecha_reporte).split('T')[0] : ''" },
    @{ name='cTermino';
       rx="getElementById\('cTermino'\)\.value\s*=\s*c\.termino\s*\|\|\s*''";
       new="getElementById('cTermino').value = c.termino ? String(c.termino).split('T')[0] : ''" },
    @{ name='cIngreso';
       rx="getElementById\('cIngreso'\)\.value\s*=\s*c\.ingreso\s*\|\|\s*''";
       new="getElementById('cIngreso').value = c.ingreso ? String(c.ingreso).split('T')[0] : ''" }
)

# Validar (todo o nada)
$errores = @()
foreach ($e in $edits) {
    $cnt = ([regex]::Matches($raw, $e.rx)).Count
    if ($cnt -ne 1) { $errores += ("{0}: se esperaba 1 coincidencia, hay {1}." -f $e.name, $cnt) }
}
if ($errores.Count -gt 0) {
    Write-Host "[ABORTADO] No se modifico nada. Problemas:" -ForegroundColor Red
    $errores | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow }
    exit 1
}

# Backup
Copy-Item $path "$path.bak" -Force
Write-Host "[OK] Backup creado: $path.bak" -ForegroundColor Green

# Aplicar
foreach ($e in $edits) {
    $raw = [regex]::Replace($raw, $e.rx, $e.new)
    Write-Host ("[OK] {0}: normalizado a YYYY-MM-DD." -f $e.name) -ForegroundColor Green
}

[System.IO.File]::WriteAllText($path, $raw, $enc)

Write-Host ""
Write-Host "Resultado al editar un caso:" -ForegroundColor Cyan
Write-Host " - Fecha Reporte se mantiene (formato valido para el input date)." -ForegroundColor Cyan
Write-Host " - Temporada y Fecha Limite (auto) se recalculan y se visualizan." -ForegroundColor Cyan
Write-Host " - Fecha Termino e Ingreso se muestran limpias (sin la hora ISO)." -ForegroundColor Cyan
