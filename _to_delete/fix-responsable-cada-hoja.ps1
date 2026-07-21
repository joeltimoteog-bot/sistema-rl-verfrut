# ==========================================================
# fix-responsable-cada-hoja.ps1
# Sistema RL v3.0 - Modulo Capacitaciones (R-SC-01)
#
# Problema: con nombres largos, la fila de participante hace
# WRAP (2 lineas), crece la tabla, el bloque "RESPONSABLE DEL
# REGISTRO" se empuja a la pagina 2 y la linea 970
# (while...deletePage) lo borra. Resultado: el bloque solo
# aparece en las hojas donde ningun nombre se parte.
#
# Fix: agregar overflow:'ellipsize' a la tabla de participantes
# -> los nombres NO hacen wrap -> cada formato queda de altura
# fija (20 filas) -> el bloque RESPONSABLE SIEMPRE cabe en la
# pagina -> aparece en TODAS las hojas.
#
# Cambio: 1 sola edicion en bodyStyles de la tabla de
# participantes (linea ~934 de capacitaciones.js).
# ==========================================================

$ErrorActionPreference = 'Stop'
$path = 'C:\sistema-rl-verfrut\frontend\js\capacitaciones.js'

if (-not (Test-Path $path)) {
    Write-Host "[ABORTADO] No se encontro el archivo: $path" -ForegroundColor Red
    exit 1
}

# Leer UTF-8 SIN BOM (preserva tildes y caracteres especiales)
$enc = New-Object System.Text.UTF8Encoding $false
$raw = [System.IO.File]::ReadAllText($path, $enc)

# Fragmento UNICO de la tabla de participantes
# (el bloque RESPONSABLE usa minCellHeight: 10, asi que no colisiona)
$old = "fontSize: 9, halign: 'center', valign: 'middle', minCellHeight: 7 }"
$new = "fontSize: 9, halign: 'center', valign: 'middle', minCellHeight: 7, overflow: 'ellipsize' }"

# 1) Idempotencia: si ya esta aplicado, no hacer nada
if ($raw.Contains("minCellHeight: 7, overflow: 'ellipsize' }")) {
    Write-Host "[INFO] El fix ya estaba aplicado. Nada que hacer." -ForegroundColor Yellow
    exit 0
}

# 2) Verificacion: el fragmento debe existir EXACTAMENTE 1 vez
$n = ([regex]::Matches($raw, [regex]::Escape($old))).Count
if ($n -ne 1) {
    Write-Host "[ABORTADO] Se esperaba 1 coincidencia del fragmento y se encontraron: $n" -ForegroundColor Red
    Write-Host "No se modifico nada. Revisemos el archivo antes de continuar." -ForegroundColor Yellow
    exit 1
}

# 3) Backup
Copy-Item $path "$path.bak" -Force
Write-Host "[OK] Backup creado: $path.bak" -ForegroundColor Green

# 4) Aplicar el cambio
$raw = $raw.Replace($old, $new)
[System.IO.File]::WriteAllText($path, $raw, $enc)

Write-Host ""
Write-Host "[OK] Tabla de participantes con overflow 'ellipsize' (los nombres ya no hacen wrap)." -ForegroundColor Green
Write-Host "     -> Cada formato R-SC-01 queda de altura fija (20 filas)." -ForegroundColor Cyan
Write-Host "     -> El bloque RESPONSABLE DEL REGISTRO ahora cabe en TODAS las hojas." -ForegroundColor Cyan
Write-Host ""
Write-Host "Prueba: genera una capacitacion con 40 asistentes y revisa que el bloque" -ForegroundColor White
Write-Host "del responsable salga en los 2 formatos PDF." -ForegroundColor White
