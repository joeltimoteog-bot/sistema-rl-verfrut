# ==========================================================
# fix-casos-porcentaje-vivo.ps1
# Sistema RL v3.0 - Modulo Registro de Casos
#
# Objetivo: que la columna % AVANCE se calcule EN VIVO desde la fecha
# limite (igual que ESTADO), en vez de leer el valor guardado
# (c.porcentaje_avance) que en casos viejos sale 0%.
#
# Regla (ya existente en el codigo): 100% en plazo, -10% por cada dia
# habil de retraso  -> calcularAvance(calcularRetraso(fecha_limite, hoy)).
# Aplica a todos (incluidos concluidos) recalculando en vivo.
#
# Cambio unico en renderTablaCasos (linea ~3754):
#   const porcentaje = Math.min(100, Math.max(0, Number(c.porcentaje_avance ?? c.porcentaje) || 0));
# ->
#   const porcentaje = c.fecha_limite
#     ? calcularAvance(calcularRetraso(c.fecha_limite, hoy))
#     : Math.min(100, Math.max(0, Number(c.porcentaje_avance ?? c.porcentaje) || 0));
# ==========================================================

$ErrorActionPreference = 'Stop'
$path = 'C:\sistema-rl-verfrut\frontend\pages\dashboard.html'
if (-not (Test-Path $path)) { Write-Host "[ABORTADO] No existe: $path" -ForegroundColor Red; exit 1 }

$enc = New-Object System.Text.UTF8Encoding $false
$raw = [System.IO.File]::ReadAllText($path, $enc)

# Idempotencia
if ($raw.Contains('calcularAvance(calcularRetraso(c.fecha_limite, hoy))')) {
    Write-Host "[INFO] El % en vivo ya estaba aplicado. Nada que hacer." -ForegroundColor Yellow; exit 0
}

$old = "const porcentaje = Math.min(100, Math.max(0, Number(c.porcentaje_avance ?? c.porcentaje) || 0));"
$new = "const porcentaje = c.fecha_limite ? calcularAvance(calcularRetraso(c.fecha_limite, hoy)) : Math.min(100, Math.max(0, Number(c.porcentaje_avance ?? c.porcentaje) || 0));"

$n = ([regex]::Matches($raw, [regex]::Escape($old))).Count
if ($n -ne 1) {
    Write-Host "[ABORTADO] Se esperaba 1 coincidencia y hay: $n" -ForegroundColor Red
    exit 1
}

Copy-Item $path "$path.bak" -Force
Write-Host "[OK] Backup: $path.bak" -ForegroundColor Green

$raw = $raw.Replace($old, $new)
[System.IO.File]::WriteAllText($path, $raw, $enc)

Write-Host ""
Write-Host "[OK] Columna % AVANCE: ahora se calcula en vivo (100% en plazo, -10% por dia habil de retraso)." -ForegroundColor Cyan
Write-Host "     Reusa tus helpers calcularRetraso + calcularAvance. Adios al 0% en casos viejos." -ForegroundColor Cyan
