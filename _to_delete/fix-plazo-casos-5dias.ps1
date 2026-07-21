# ==========================================================
# fix-plazo-casos-5dias.ps1
# Sistema RL v3.0 - Modulo Registro de Casos
#
# Cambio: subir el plazo para culminar un caso de 4 a 5 dias habiles.
# Unico punto: calcularFechaLimiteCaso() -> sumarDiasHabiles(fechaRep, 4)
# El resto de la logica (estado, retraso, dias restantes) trabaja sobre
# la fecha limite calculada, asi que respeta el cambio automaticamente.
#
# Nota: aplica a casos NUEVOS y a los que se editen/recalculen.
# Los casos ya guardados conservan su fecha_limite previa (calculada con 4).
# ==========================================================

$ErrorActionPreference = 'Stop'
$path = 'C:\sistema-rl-verfrut\frontend\pages\dashboard.html'

if (-not (Test-Path $path)) {
    Write-Host "[ABORTADO] No se encontro: $path" -ForegroundColor Red
    exit 1
}

$enc = New-Object System.Text.UTF8Encoding $false
$raw = [System.IO.File]::ReadAllText($path, $enc)

$old = "sumarDiasHabiles(fechaRep, 4)"
$new = "sumarDiasHabiles(fechaRep, 5)"

# Idempotencia
if ($raw.Contains("sumarDiasHabiles(fechaRep, 5)")) {
    Write-Host "[INFO] El plazo ya estaba en 5 dias habiles. Nada que hacer." -ForegroundColor Yellow
    exit 0
}

# Verificacion del cambio funcional (obligatorio)
$n = ([regex]::Matches($raw, [regex]::Escape($old))).Count
if ($n -ne 1) {
    Write-Host "[ABORTADO] Se esperaba 1 coincidencia de 'sumarDiasHabiles(fechaRep, 4)' y hay: $n" -ForegroundColor Red
    exit 1
}

# Backup
Copy-Item $path "$path.bak" -Force
Write-Host "[OK] Backup creado: $path.bak" -ForegroundColor Green

# 1) Cambio funcional (4 -> 5 dias habiles)
$raw = $raw.Replace($old, $new)
Write-Host "[OK] Plazo: sumarDiasHabiles(fechaRep, 4) -> 5 dias habiles." -ForegroundColor Green

# 2) Actualizar el comentario (best-effort, fragmento ASCII)
$cmtOld = "Plazo: 4"
$cmtN = ([regex]::Matches($raw, [regex]::Escape($cmtOld))).Count
if ($cmtN -eq 1) {
    $raw = $raw.Replace($cmtOld, "Plazo: 5")
    Write-Host "[OK] Comentario actualizado a 'Plazo: 5'." -ForegroundColor Green
} else {
    Write-Host "[INFO] Comentario no actualizado (coincidencias: $cmtN). No afecta la funcionalidad." -ForegroundColor DarkGray
}

[System.IO.File]::WriteAllText($path, $raw, $enc)

Write-Host ""
Write-Host "Listo: el plazo para culminar un caso ahora es de 5 dias habiles (lun-vie)." -ForegroundColor Cyan
