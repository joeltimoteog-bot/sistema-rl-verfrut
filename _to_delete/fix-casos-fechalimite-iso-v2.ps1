# ==========================================================
# fix-casos-fechalimite-iso-v2.ps1  (ancla UNICA)
# Sistema RL v3.0 - Modulo Registro de Casos
#
# Bug: en renderTablaCasos, c.fecha_limite llega como timestamp ISO con
# hora (ej. "2026-05-08T05:00:00.000Z"). El codigo hace
# new Date(c.fecha_limite + 'T00:00:00') -> "...000ZT00:00:00" ->
# Invalid Date -> la comparacion < hoy da false -> un caso YA VENCIDO se
# muestra como "POR VENCER" y el % no calcula bien.
#
# Fix: normalizar a YYYY-MM-DD una sola vez (_flCaso) y usarla en todos
# los calculos de la fila. Se inserta _flCaso ANTES de la linea
# 'const diasRestantes = c.fecha_limite' (ancla UNICA de renderTablaCasos;
# el 'estadoCaso' aparecia 2 veces, por eso usamos esta).
# ==========================================================

$ErrorActionPreference = 'Stop'
$path = 'C:\sistema-rl-verfrut\frontend\pages\dashboard.html'
if (-not (Test-Path $path)) { Write-Host "[ABORTADO] No existe: $path" -ForegroundColor Red; exit 1 }

$enc = New-Object System.Text.UTF8Encoding $false
$raw = [System.IO.File]::ReadAllText($path, $enc)

if ($raw.Contains('const _flCaso =')) {
    Write-Host "[INFO] Ya aplicado (_flCaso). Nada que hacer." -ForegroundColor Yellow; exit 0
}

# Ancla UNICA
$ancla = "const diasRestantes = c.fecha_limite"
$nIns  = ([regex]::Matches($raw, [regex]::Escape($ancla))).Count
if ($nIns -ne 1) {
    Write-Host "[ABORTADO] Ancla 'const diasRestantes = c.fecha_limite': esperaba 1, hay $nIns" -ForegroundColor Red; exit 1
}

# Reemplazos c.fecha_limite -> _flCaso (cada fragmento unico)
$edits = @(
    @{ old = "const diasRestantes = c.fecha_limite";                                              new = "const diasRestantes = _flCaso" },
    @{ old = "? (new Date(c.fecha_limite+'T00:00:00') >= hoy";                                     new = "? (new Date(_flCaso+'T00:00:00') >= hoy" },
    @{ old = "? calcularDiasHabilesTranscurridos(hoy, new Date(c.fecha_limite+'T00:00:00'))";      new = "? calcularDiasHabilesTranscurridos(hoy, new Date(_flCaso+'T00:00:00'))" },
    @{ old = "const _venc = c.fecha_limite ? (new Date(c.fecha_limite+'T00:00:00') < hoy)";        new = "const _venc = _flCaso ? (new Date(_flCaso+'T00:00:00') < hoy)" },
    @{ old = "const porVencer = !vencido && !concluido && !!c.fecha_limite && diasRestantes <= 1;"; new = "const porVencer = !vencido && !concluido && !!_flCaso && diasRestantes <= 1;" },
    @{ old = "const porcentaje = c.fecha_limite ? calcularAvance(calcularRetraso(c.fecha_limite, hoy))"; new = "const porcentaje = _flCaso ? calcularAvance(calcularRetraso(_flCaso, hoy))" },
    @{ old = "(porVencer ? 'POR VENCER' : (c.fecha_limite ? 'EN PLAZO' : '-')))";                  new = "(porVencer ? 'POR VENCER' : (_flCaso ? 'EN PLAZO' : '-')))" }
)

# Validar todos (todo o nada)
$err = @()
foreach ($e in $edits) {
    $cnt = ([regex]::Matches($raw, [regex]::Escape($e.old))).Count
    if ($cnt -ne 1) { $err += ("'{0}...': esperaba 1, hay {1}" -f $e.old.Substring(0,[Math]::Min(48,$e.old.Length)), $cnt) }
}
if ($err.Count -gt 0) {
    Write-Host "[ABORTADO] No se modifico nada:" -ForegroundColor Red
    $err | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow }; exit 1
}

# Backup
Copy-Item $path "$path.bak" -Force
Write-Host "[OK] Backup: $path.bak" -ForegroundColor Green

# Insertar _flCaso ANTES del ancla (su propia linea + sangria)
$insertado = "const _flCaso = c.fecha_limite ? String(c.fecha_limite).split('T')[0] : '';`r`n        " + $ancla
$raw = $raw.Replace($ancla, $insertado)

# Aplicar reemplazos
foreach ($e in $edits) { $raw = $raw.Replace($e.old, $e.new) }

[System.IO.File]::WriteAllText($path, $raw, $enc)

Write-Host ""
Write-Host "[OK] fecha_limite normalizada (_flCaso) en renderTablaCasos." -ForegroundColor Cyan
Write-Host "     Caso con fecha limite pasada -> VENCIDO (rojo). % y retraso correctos." -ForegroundColor Cyan
