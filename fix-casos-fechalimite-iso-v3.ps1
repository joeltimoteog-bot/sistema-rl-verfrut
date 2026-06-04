# ==========================================================
# fix-casos-fechalimite-iso-v3.ps1  (sin ancla, fragmentos unicos)
# Sistema RL v3.0 - Modulo Registro de Casos (renderTablaCasos)
#
# Bug: c.fecha_limite llega como ISO con hora -> new Date(c.fecha_limite+'T00:00:00')
# = Invalid Date -> un caso vencido sale "POR VENCER" y el % no calcula.
#
# Fix sin anclas: reemplazo los fragmentos UNICOS del bloque de la tabla
# (los que tienen el codigo del Script 1: _venc, porcentaje en vivo)
# normalizando la fecha dentro de cada expresion con .split('T')[0].
# Estos fragmentos NO existen en verDetalleCaso, asi que son unicos.
# ==========================================================

$ErrorActionPreference = 'Stop'
$path = 'C:\sistema-rl-verfrut\frontend\pages\dashboard.html'
if (-not (Test-Path $path)) { Write-Host "[ABORTADO] No existe: $path" -ForegroundColor Red; exit 1 }

$enc = New-Object System.Text.UTF8Encoding $false
$raw = [System.IO.File]::ReadAllText($path, $enc)

if ($raw.Contains("String(c.fecha_limite).split('T')[0]+'T00:00:00') < hoy")) {
    Write-Host "[INFO] Ya aplicado. Nada que hacer." -ForegroundColor Yellow; exit 0
}

# Fragmentos UNICOS del bloque de la tabla (incluyen codigo del Script 1)
$edits = @(
    # vencido (linea 3750) - el _venc solo existe en la tabla
    @{ old = "const _venc = c.fecha_limite ? (new Date(c.fecha_limite+'T00:00:00') < hoy)";
       new = "const _venc = c.fecha_limite ? (new Date(String(c.fecha_limite).split('T')[0]+'T00:00:00') < hoy)" },
    # porcentaje en vivo (linea 3754) - calcularAvance(calcularRetraso(... solo existe en la tabla
    @{ old = "const porcentaje = c.fecha_limite ? calcularAvance(calcularRetraso(c.fecha_limite, hoy))";
       new = "const porcentaje = c.fecha_limite ? calcularAvance(calcularRetraso(String(c.fecha_limite).split('T')[0], hoy))" }
)

# diasRestantes (3744-3747): el patron exacto aparece 2 veces (tabla y detalle).
# Para no afectar el detalle, normalizamos AMBAS ocurrencias del calculo de
# dias restantes (el detalle tambien tiene el mismo bug ISO, asi que mejor).
$editsDual = @(
    @{ old = "new Date(c.fecha_limite+'T00:00:00') >= hoy"; expect = 2;
       new = "new Date(String(c.fecha_limite).split('T')[0]+'T00:00:00') >= hoy" },
    @{ old = "calcularDiasHabilesTranscurridos(hoy, new Date(c.fecha_limite+'T00:00:00'))"; expect = 2;
       new = "calcularDiasHabilesTranscurridos(hoy, new Date(String(c.fecha_limite).split('T')[0]+'T00:00:00'))" }
)

# Validacion
$err = @()
foreach ($e in $edits) {
    $c = ([regex]::Matches($raw, [regex]::Escape($e.old))).Count
    if ($c -ne 1) { $err += ("UNICO '{0}...': esperaba 1, hay {1}" -f $e.old.Substring(0,[Math]::Min(42,$e.old.Length)), $c) }
}
foreach ($e in $editsDual) {
    $c = ([regex]::Matches($raw, [regex]::Escape($e.old))).Count
    if ($c -ne $e.expect) { $err += ("DUAL '{0}...': esperaba {1}, hay {2}" -f $e.old.Substring(0,[Math]::Min(42,$e.old.Length)), $e.expect, $c) }
}
if ($err.Count -gt 0) {
    Write-Host "[ABORTADO] No se modifico nada:" -ForegroundColor Red
    $err | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow }; exit 1
}

Copy-Item $path "$path.bak" -Force
Write-Host "[OK] Backup: $path.bak" -ForegroundColor Green

foreach ($e in $edits)     { $raw = $raw.Replace($e.old, $e.new) }
foreach ($e in $editsDual) { $raw = $raw.Replace($e.old, $e.new) }  # reemplaza ambas ocurrencias

[System.IO.File]::WriteAllText($path, $raw, $enc)

Write-Host ""
Write-Host "[OK] fecha_limite normalizada (split('T')[0]) en los calculos de la tabla (y detalle)." -ForegroundColor Cyan
Write-Host "     Caso con fecha limite pasada -> VENCIDO (rojo). % y retraso correctos." -ForegroundColor Cyan
