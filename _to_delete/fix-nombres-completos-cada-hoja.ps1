# ==========================================================
# fix-nombres-completos-cada-hoja.ps1
# Sistema RL v3.0 - Modulo Capacitaciones (R-SC-01)
#
# Objetivo: que los APELLIDOS Y NOMBRES salgan COMPLETOS
# (sin recorte, sin "...") en UNA sola linea, y que el bloque
# "RESPONSABLE DEL REGISTRO" aparezca en TODAS las hojas.
#
# Como: en la tabla de participantes
#   1) Se ensancha la columna 2 (APELLIDOS Y NOMBRES): 65 -> 80 mm
#      (se reparte el ancho quitando a N, DNI, FIRMA y OBS;
#       CARGO se mantiene en 35 mm)
#   2) Se baja la fuente del cuerpo: 9 -> 8 (a 80mm caben ~55 chars)
#   3) Se quita el overflow 'ellipsize' (ya no recorta)
#
# Con el nombre en una sola linea, cada formato vuelve a ser de
# altura fija -> el bloque RESPONSABLE siempre cabe.
# La altura de fila se mantiene en 7 mm (espacio para firma).
#
# El script funciona tanto si YA corriste el fix de 'ellipsize'
# como si no.
# ==========================================================

$ErrorActionPreference = 'Stop'
$path = 'C:\sistema-rl-verfrut\frontend\js\capacitaciones.js'

if (-not (Test-Path $path)) {
    Write-Host "[ABORTADO] No se encontro el archivo: $path" -ForegroundColor Red
    exit 1
}

# Leer UTF-8 SIN BOM (preserva tildes)
$enc = New-Object System.Text.UTF8Encoding $false
$raw = [System.IO.File]::ReadAllText($path, $enc)

# --- Idempotencia: si la columna ya esta en 80mm, no hacer nada ---
if ($raw.Contains("2: { cellWidth: 80, halign: 'left' }")) {
    Write-Host "[INFO] El ajuste ya estaba aplicado (columna en 80mm). Nada que hacer." -ForegroundColor Yellow
    exit 0
}

# ==========================================================
# Definir reemplazos
# ==========================================================

# (1) bodyStyles -> fuente 8, sin ellipsize. Maneja AMBOS estados:
$bodyNew  = "fontSize: 8, halign: 'center', valign: 'middle', minCellHeight: 7 }"
$bodyConE = "fontSize: 9, halign: 'center', valign: 'middle', minCellHeight: 7, overflow: 'ellipsize' }"  # si ya se aplico ellipsize
$bodySinE = "fontSize: 9, halign: 'center', valign: 'middle', minCellHeight: 7 }"                          # estado original

# (2) anchos de columnas (fragmentos unicos de la tabla de participantes)
$c01o = "0: { cellWidth: 10 }, 1: { cellWidth: 22 },"
$c01n = "0: { cellWidth: 8 }, 1: { cellWidth: 20 },"

$c2o  = "2: { cellWidth: 65, halign: 'left' }"
$c2n  = "2: { cellWidth: 80, halign: 'left' }"

$c45o = "4: { cellWidth: 30 }, 5: { cellWidth: 28, halign: 'left' }"
$c45n = "4: { cellWidth: 27 }, 5: { cellWidth: 20, halign: 'left' }"

# ==========================================================
# Validar ANTES de escribir (todo o nada)
# ==========================================================
$errores = @()

# bodyStyles: debe existir uno de los dos estados
$bodyEstado = $null
if     ($raw.Contains($bodyConE)) { $bodyEstado = 'ellipsize' }
elseif ($raw.Contains($bodySinE)) { $bodyEstado = 'original' }
else   { $errores += "No se encontro el bodyStyles esperado de participantes." }

function Count-Frag([string]$h, [string]$needle) {
    return ([regex]::Matches($h, [regex]::Escape($needle))).Count
}

if ((Count-Frag $raw $c01o) -ne 1) { $errores += "Anchos N/DNI: se esperaba 1 coincidencia, hay $(Count-Frag $raw $c01o)." }
if ((Count-Frag $raw $c2o)  -ne 1) { $errores += "Ancho NOMBRES (65mm): se esperaba 1 coincidencia, hay $(Count-Frag $raw $c2o)." }
if ((Count-Frag $raw $c45o) -ne 1) { $errores += "Anchos FIRMA/OBS: se esperaba 1 coincidencia, hay $(Count-Frag $raw $c45o)." }

if ($errores.Count -gt 0) {
    Write-Host "[ABORTADO] No se modifico nada. Problemas encontrados:" -ForegroundColor Red
    $errores | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow }
    exit 1
}

# ==========================================================
# Backup + aplicar
# ==========================================================
Copy-Item $path "$path.bak" -Force
Write-Host "[OK] Backup creado: $path.bak" -ForegroundColor Green

if ($bodyEstado -eq 'ellipsize') {
    $raw = $raw.Replace($bodyConE, $bodyNew)
    Write-Host "[OK] bodyStyles: fuente 9->8 y se quito 'ellipsize'." -ForegroundColor Green
} else {
    $raw = $raw.Replace($bodySinE, $bodyNew)
    Write-Host "[OK] bodyStyles: fuente 9->8." -ForegroundColor Green
}

$raw = $raw.Replace($c01o, $c01n)
$raw = $raw.Replace($c2o,  $c2n)
$raw = $raw.Replace($c45o, $c45n)
Write-Host "[OK] Anchos: NOMBRES 65->80mm | N 10->8 | DNI 22->20 | FIRMA 30->27 | OBS 28->20 (CARGO sigue en 35)." -ForegroundColor Green

[System.IO.File]::WriteAllText($path, $raw, $enc)

Write-Host ""
Write-Host "Suma de anchos: 8+20+80+35+27+20 = 190mm (ancho util de la hoja). OK" -ForegroundColor Cyan
Write-Host "Los nombres ahora entran COMPLETOS en una sola linea -> altura de fila fija" -ForegroundColor Cyan
Write-Host "-> el bloque RESPONSABLE cabe en TODAS las hojas, sin recortes." -ForegroundColor Cyan
Write-Host ""
Write-Host "Prueba: genera una capacitacion con ~40 asistentes (incluye algun nombre largo)" -ForegroundColor White
Write-Host "y verifica los 2 PDFs: nombres completos + bloque del responsable en ambos." -ForegroundColor White
