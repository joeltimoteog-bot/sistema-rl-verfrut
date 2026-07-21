# ==========================================================
# fix-casos-estado-real.ps1
# Sistema RL v3.0 - Modulo Registro de Casos
#
# Objetivo: que la columna ESTADO de la tabla muestre el estado de
# plazo REAL (En Plazo / Por Vencer / Vencido / Concluido) calculado
# desde fecha_limite, en vez del texto guardado (que en casos viejos
# sale "-" o "PENDIENTE").
#
# 3 cambios en renderTablaCasos:
#  A) 'vencido' pasa a calcularse por FECHA (fecha_limite < hoy) y se
#     define 'concluido' (estado_caso CONCLUIDO* o gestion Cerrado/Resuelto/etc).
#  B) 'porVencer' exige tener fecha_limite y usa el nuevo 'concluido'.
#  C) 'estadoLabel' muestra: CONCLUIDO / VENCIDO / POR VENCER / EN PLAZO / -
# ==========================================================

$ErrorActionPreference = 'Stop'
$path = 'C:\sistema-rl-verfrut\frontend\pages\dashboard.html'
if (-not (Test-Path $path)) { Write-Host "[ABORTADO] No existe: $path" -ForegroundColor Red; exit 1 }

$enc = New-Object System.Text.UTF8Encoding $false
$raw = [System.IO.File]::ReadAllText($path, $enc)

if ($raw.Contains('const concluido = estadoCaso.startsWith')) {
    Write-Host "[INFO] Ya aplicado (existe 'concluido'). Nada que hacer." -ForegroundColor Yellow; exit 0
}

# A (literal)
$oldA = "const vencido = estadoCaso.includes('VENCIDO') || estadoCaso.includes('CON_RETRASO');"
$newA = "const concluido = estadoCaso.startsWith('CONCLUIDO') || ['CERRADO','CONCLUIDO','RESUELTO','FINALIZADO'].some(s => String(c.estado_gestion||'').toUpperCase().includes(s)); const _venc = c.fecha_limite ? (new Date(c.fecha_limite+'T00:00:00') < hoy) : (estadoCaso.includes('VENCIDO') || estadoCaso.includes('CON_RETRASO')); const vencido = _venc && !concluido;"

# B (literal)
$oldB = "const porVencer = !vencido && !estadoCaso.startsWith('CONCLUIDO') && diasRestantes <= 1;"
$newB = "const porVencer = !vencido && !concluido && !!c.fecha_limite && diasRestantes <= 1;"

# C (regex; el guion largo se matchea con '.')
$rxC  = "const estadoLabel = estadoCaso\.replace\(/_/g,' '\) \|\| '.';"
$repC = "const estadoLabel = concluido ? 'CONCLUIDO' : (vencido ? 'VENCIDO' : (porVencer ? 'POR VENCER' : (c.fecha_limite ? 'EN PLAZO' : '-')));"

$cA = ([regex]::Matches($raw, [regex]::Escape($oldA))).Count
$cB = ([regex]::Matches($raw, [regex]::Escape($oldB))).Count
$cC = ([regex]::Matches($raw, $rxC)).Count

$err = @()
if ($cA -ne 1) { $err += "vencido (A): esperaba 1, hay $cA" }
if ($cB -ne 1) { $err += "porVencer (B): esperaba 1, hay $cB" }
if ($cC -ne 1) { $err += "estadoLabel (C): esperaba 1, hay $cC" }
if ($err.Count -gt 0) {
    Write-Host "[ABORTADO] No se modifico nada:" -ForegroundColor Red
    $err | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow }; exit 1
}

Copy-Item $path "$path.bak" -Force
Write-Host "[OK] Backup: $path.bak" -ForegroundColor Green
$raw = $raw.Replace($oldA, $newA)
$raw = $raw.Replace($oldB, $newB)
$raw = [regex]::Replace($raw, $rxC, $repC)
[System.IO.File]::WriteAllText($path, $raw, $enc)

Write-Host ""
Write-Host "[OK] Columna ESTADO: muestra En Plazo / Por Vencer / Vencido / Concluido (segun fecha limite)." -ForegroundColor Cyan
Write-Host "     Adios al '-' y al 'PENDIENTE' en esa columna." -ForegroundColor Cyan
