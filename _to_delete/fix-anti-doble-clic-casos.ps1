# ==========================================================
# fix-anti-doble-clic-casos.ps1
# Sistema RL v3.0 - Modulo Registro de Casos
#
# Bug: doble clic en "Guardar Caso" (en investigacion o concluido)
# crea registros duplicados, porque guardarCaso() es async y desactiva
# el boton DESPUES de las validaciones -> dos llamadas pasan el control.
#
# Fix: candado sincrono window._savingCaso (mismo patron que atenciones).
#  1) En el punto de commit (declaracion del btn): guard + activar candado.
#  2) En los 2 puntos que reactivan el boton (return de error de subida y
#     finally): liberar el candado.
#
# guardarCaso maneja ambos modos (investigacion/concluido), asi que un
# solo candado cubre las dos duplicaciones.
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
if ($raw.Contains('window._savingCaso')) {
    Write-Host "[INFO] El candado anti-doble-clic ya estaba aplicado. Nada que hacer." -ForegroundColor Yellow
    exit 0
}

# (1) Punto de commit: guard + activar candado (ancla unica: selector del btn del modal de caso)
$old1 = "const btn = document.querySelector('#mCaso .btn-n:last-child');"
$new1 = "if (window._savingCaso) return; window._savingCaso = true; const btn = document.querySelector('#mCaso .btn-n:last-child');"

# (2) Liberar candado en los 2 puntos que reactivan el boton (fragmento sin emoji, aparece 2 veces)
$old2 = "Guardar Caso'; btn.disabled = false;"
$new2 = "Guardar Caso'; btn.disabled = false; window._savingCaso = false;"

# --- Validacion (todo o nada) ---
$n1 = ([regex]::Matches($raw, [regex]::Escape($old1))).Count
$n2 = ([regex]::Matches($raw, [regex]::Escape($old2))).Count

$errores = @()
if ($n1 -ne 1) { $errores += "Ancla del btn (#mCaso): se esperaba 1, hay $n1." }
if ($n2 -ne 2) { $errores += "Puntos de reseteo del boton: se esperaban 2, hay $n2." }

if ($errores.Count -gt 0) {
    Write-Host "[ABORTADO] No se modifico nada. Problemas:" -ForegroundColor Red
    $errores | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow }
    exit 1
}

# Backup
Copy-Item $path "$path.bak" -Force
Write-Host "[OK] Backup creado: $path.bak" -ForegroundColor Green

# Aplicar
$raw = $raw.Replace($old1, $new1)
$raw = $raw.Replace($old2, $new2)   # reemplaza las 2 ocurrencias
[System.IO.File]::WriteAllText($path, $raw, $enc)

Write-Host ""
Write-Host "[OK] 1/2 Candado activado en el commit (if window._savingCaso return + = true)." -ForegroundColor Green
Write-Host "[OK] 2/2 Candado liberado en los 2 puntos de reseteo del boton (= false)." -ForegroundColor Green
Write-Host ""
Write-Host "Resultado: el doble clic en Guardar Caso ya NO duplica (investigacion ni concluido)." -ForegroundColor Cyan
