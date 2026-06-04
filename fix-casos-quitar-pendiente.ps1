# ==========================================================
# fix-casos-quitar-pendiente.ps1
# Sistema RL v3.0 - Modulo Registro de Casos
#
# Objetivo: que el "Estado del Caso" (gestion) solo sea En Proceso o
# Cerrado. "Pendiente" ya no debe aparecer.
#
# 3 cambios:
#  D) Quitar <option Pendiente> del desplegable cEstadoGestion y dejar
#     "En Proceso" como opcion por defecto (selected).
#  E) Al EDITAR un caso viejo con estado_gestion = 'PENDIENTE', mapearlo
#     a 'EN PROCESO' (para que el desplegable no quede en blanco).
#  F) En la columna GESTION de la tabla, mostrar los casos viejos con
#     'PENDIENTE' como 'EN PROCESO'.
# ==========================================================

$ErrorActionPreference = 'Stop'
$path = 'C:\sistema-rl-verfrut\frontend\pages\dashboard.html'
if (-not (Test-Path $path)) { Write-Host "[ABORTADO] No existe: $path" -ForegroundColor Red; exit 1 }

$enc = New-Object System.Text.UTF8Encoding $false
$raw = [System.IO.File]::ReadAllText($path, $enc)

if ($raw.Contains("c.estado_gestion !== 'PENDIENTE'")) {
    Write-Host "[INFO] Ya aplicado. Nada que hacer." -ForegroundColor Yellow; exit 0
}

# D (regex): colapsa las 2 options en una, con En Proceso por defecto
$rxD  = '<option value="PENDIENTE" selected>Pendiente</option>\s*<option value="EN PROCESO">En Proceso</option>'
$repD = '<option value="EN PROCESO" selected>En Proceso</option>'

# E (literal): prefill al editar -> PENDIENTE (o vacio) se mapea a EN PROCESO
$oldE = "document.getElementById('cEstadoGestion').value = c.estado_gestion || 'EN PROCESO';"
$newE = "document.getElementById('cEstadoGestion').value = (c.estado_gestion && c.estado_gestion !== 'PENDIENTE') ? c.estado_gestion : 'EN PROCESO';"

# F (regex): columna GESTION de la tabla -> PENDIENTE se muestra como EN PROCESO
$rxF  = '<td style="font-size:11px;font-weight:600">[^<]*c\.estado_gestion[^<]*</td>'
$repF = '<td style="font-size:11px;font-weight:600">$${(String(c.estado_gestion||'''').toUpperCase()===''PENDIENTE''?''EN PROCESO'':(c.estado_gestion||''-''))}</td>'

$cD = ([regex]::Matches($raw, $rxD)).Count
$cE = ([regex]::Matches($raw, [regex]::Escape($oldE))).Count
$cF = ([regex]::Matches($raw, $rxF)).Count

$err = @()
if ($cD -ne 1) { $err += "dropdown (D): esperaba 1, hay $cD" }
if ($cE -ne 1) { $err += "prefill (E): esperaba 1, hay $cE" }
if ($cF -ne 1) { $err += "columna gestion (F): esperaba 1, hay $cF" }
if ($err.Count -gt 0) {
    Write-Host "[ABORTADO] No se modifico nada:" -ForegroundColor Red
    $err | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow }; exit 1
}

Copy-Item $path "$path.bak" -Force
Write-Host "[OK] Backup: $path.bak" -ForegroundColor Green
$raw = [regex]::Replace($raw, $rxD, $repD)
$raw = $raw.Replace($oldE, $newE)
$raw = [regex]::Replace($raw, $rxF, $repF)
[System.IO.File]::WriteAllText($path, $raw, $enc)

Write-Host ""
Write-Host "[OK] D: desplegable sin 'Pendiente' (En Proceso por defecto + Cerrado)." -ForegroundColor Cyan
Write-Host "[OK] E: al editar, casos viejos 'PENDIENTE' -> 'En Proceso'." -ForegroundColor Cyan
Write-Host "[OK] F: columna GESTION muestra 'PENDIENTE' viejo como 'En Proceso'." -ForegroundColor Cyan
