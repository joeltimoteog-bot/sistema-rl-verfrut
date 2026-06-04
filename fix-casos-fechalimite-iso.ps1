# ==========================================================
# fix-casos-fechalimite-iso.ps1
# Sistema RL v3.0 - Modulo Registro de Casos
#
# Bug: en renderTablaCasos, c.fecha_limite llega como timestamp ISO con
# hora (ej. "2026-05-08T05:00:00.000Z"). El codigo hace
# new Date(c.fecha_limite + 'T00:00:00'), lo que produce
# "2026-05-08T05:00:00.000ZT00:00:00" -> Invalid Date -> la comparacion
# < hoy da false -> un caso YA VENCIDO se muestra como "POR VENCER" y
# el % no calcula bien.
#
# Fix: normalizar la fecha a YYYY-MM-DD una sola vez (quitando la hora)
# y usar esa variable limpia (_flCaso) en TODOS los calculos de la fila:
# diasRestantes, vencido, porVencer, porcentaje (calcularRetraso/Avance).
#
# Cambios en renderTablaCasos:
#  1) Tras 'const estadoCaso = ...;' se agrega:
#       const _flCaso = c.fecha_limite ? String(c.fecha_limite).split('T')[0] : '';
#  2) Se reemplazan los usos de c.fecha_limite por _flCaso en el bloque de calculo.
# ==========================================================

$ErrorActionPreference = 'Stop'
$path = 'C:\sistema-rl-verfrut\frontend\pages\dashboard.html'
if (-not (Test-Path $path)) { Write-Host "[ABORTADO] No existe: $path" -ForegroundColor Red; exit 1 }

$enc = New-Object System.Text.UTF8Encoding $false
$raw = [System.IO.File]::ReadAllText($path, $enc)

# Idempotencia
if ($raw.Contains('const _flCaso =')) {
    Write-Host "[INFO] Ya aplicado (existe _flCaso). Nada que hacer." -ForegroundColor Yellow; exit 0
}

# 1) Insertar la normalizacion justo despues de la definicion de estadoCaso
$ancla = "const estadoCaso = String(c.estado_caso || c.estado || '');"
$nIns  = ([regex]::Matches($raw, [regex]::Escape($ancla))).Count
if ($nIns -ne 1) {
    Write-Host "[ABORTADO] Ancla estadoCaso: esperaba 1, hay $nIns" -ForegroundColor Red; exit 1
}

# 2) Reemplazos de c.fecha_limite -> _flCaso SOLO en las lineas de calculo del bloque.
#    Cada fragmento es unico dentro del archivo.
$edits = @(
    # diasRestantes (3744-3748)
    @{ old = "const diasRestantes = c.fecha_limite";
       new = "const diasRestantes = _flCaso" },
    @{ old = "? (new Date(c.fecha_limite+'T00:00:00') >= hoy";
       new = "? (new Date(_flCaso+'T00:00:00') >= hoy" },
    @{ old = "? calcularDiasHabilesTranscurridos(hoy, new Date(c.fecha_limite+'T00:00:00'))";
       new = "? calcularDiasHabilesTranscurridos(hoy, new Date(_flCaso+'T00:00:00'))" },
    # vencido (3750)
    @{ old = "const _venc = c.fecha_limite ? (new Date(c.fecha_limite+'T00:00:00') < hoy)";
       new = "const _venc = _flCaso ? (new Date(_flCaso+'T00:00:00') < hoy)" },
    # porVencer (3751)
    @{ old = "const porVencer = !vencido && !concluido && !!c.fecha_limite && diasRestantes <= 1;";
       new = "const porVencer = !vencido && !concluido && !!_flCaso && diasRestantes <= 1;" },
    # porcentaje (3754)
    @{ old = "const porcentaje = c.fecha_limite ? calcularAvance(calcularRetraso(c.fecha_limite, hoy))";
       new = "const porcentaje = _flCaso ? calcularAvance(calcularRetraso(_flCaso, hoy))" },
    # estadoLabel (3755) - el ternario final usa c.fecha_limite
    @{ old = "(porVencer ? 'POR VENCER' : (c.fecha_limite ? 'EN PLAZO' : '-')))";
       new = "(porVencer ? 'POR VENCER' : (_flCaso ? 'EN PLAZO' : '-')))" }
)

# Validar todos (todo o nada)
$err = @()
foreach ($e in $edits) {
    $cnt = ([regex]::Matches($raw, [regex]::Escape($e.old))).Count
    if ($cnt -ne 1) { $err += ("'{0}...': esperaba 1, hay {1}" -f $e.old.Substring(0,[Math]::Min(45,$e.old.Length)), $cnt) }
}
if ($err.Count -gt 0) {
    Write-Host "[ABORTADO] No se modifico nada:" -ForegroundColor Red
    $err | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow }; exit 1
}

# Backup
Copy-Item $path "$path.bak" -Force
Write-Host "[OK] Backup: $path.bak" -ForegroundColor Green

# Insertar _flCaso despues del ancla
$raw = $raw.Replace($ancla, $ancla + "`r`n        const _flCaso = c.fecha_limite ? String(c.fecha_limite).split('T')[0] : '';")

# Aplicar reemplazos
foreach ($e in $edits) { $raw = $raw.Replace($e.old, $e.new) }

[System.IO.File]::WriteAllText($path, $raw, $enc)

Write-Host ""
Write-Host "[OK] fecha_limite normalizada a YYYY-MM-DD (_flCaso) en renderTablaCasos." -ForegroundColor Cyan
Write-Host "     Ahora un caso con fecha limite pasada se muestra VENCIDO (rojo), no 'Por Vencer'." -ForegroundColor Cyan
Write-Host "     El % de avance y los dias de retraso tambien se calculan correctamente." -ForegroundColor Cyan
