# ==========================================================
# fix-codigo-bus-atenciones.ps1
# Sistema RL v3.0 - Modulo Mis Atenciones (+ Nueva Atencion)
#
# Bug: al buscar por DNI (via Azure), el campo "Codigo" traia el
# codigo del TRABAJADOR (a.codigo_trab, columna E) en vez del
# codigo del BUS (a.cod, columna Q).
#
# Causa: en _mapTrabajadorAzureALegado (dashboard.html ~linea 2622):
#   codigo: a.codigo_trab || a.cod || ''
# Como codigo_trab casi siempre tiene valor, nunca usa a.cod.
#
# Fix: usar el codigo de bus (a.cod):
#   codigo: a.cod || ''
#
# El codigo de bus YA se sincroniza a Azure (leerHojaTrabajadores
# -> cod: row[16] = columna Q), asi que es solo cambio de frontend.
# ==========================================================

$ErrorActionPreference = 'Stop'
$path = 'C:\sistema-rl-verfrut\frontend\pages\dashboard.html'

if (-not (Test-Path $path)) {
    Write-Host "[ABORTADO] No se encontro: $path" -ForegroundColor Red
    exit 1
}

# Leer UTF-8 SIN BOM
$enc = New-Object System.Text.UTF8Encoding $false
$raw = [System.IO.File]::ReadAllText($path, $enc)

$old = "a.codigo_trab || a.cod || ''"
$new = "a.cod || ''"

# Idempotencia: si ya no existe a.codigo_trab, ya se aplico
if (-not $raw.Contains('a.codigo_trab')) {
    Write-Host "[INFO] El fix ya estaba aplicado (no hay 'a.codigo_trab'). Nada que hacer." -ForegroundColor Yellow
    exit 0
}

# Verificacion: el fragmento debe existir EXACTAMENTE 1 vez
$n = ([regex]::Matches($raw, [regex]::Escape($old))).Count
if ($n -ne 1) {
    Write-Host "[ABORTADO] Se esperaba 1 coincidencia y se encontraron: $n" -ForegroundColor Red
    Write-Host "No se modifico nada." -ForegroundColor Yellow
    exit 1
}

# Backup
Copy-Item $path "$path.bak" -Force
Write-Host "[OK] Backup creado: $path.bak" -ForegroundColor Green

# Aplicar
$raw = $raw.Replace($old, $new)
[System.IO.File]::WriteAllText($path, $raw, $enc)

Write-Host ""
Write-Host "[OK] Linea ~2622: el campo 'codigo' ahora usa a.cod (codigo de bus, columna Q)." -ForegroundColor Green
Write-Host "     Antes: codigo: a.codigo_trab || a.cod || ''  (traia codigo del trabajador)" -ForegroundColor DarkGray
Write-Host "     Ahora: codigo: a.cod || ''                   (trae codigo del bus)" -ForegroundColor Cyan
Write-Host ""
Write-Host "PRUEBA: tras el push, Ctrl+Shift+R y busca un DNI con bus asignado" -ForegroundColor White
Write-Host "-> el campo Codigo debe mostrar el codigo del BUS." -ForegroundColor White
