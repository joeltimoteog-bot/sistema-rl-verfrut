# ============================================================
#  fix-dedup-nro-refrescar.ps1
#  Corrige la comparacion de 'nro' en refrescarEnBackground
#  (lineas 4158-4159 de dashboard.html). Normaliza a String
#  ambos lados para que el registro recien guardado SI case
#  con el del servidor -> no se re-inserta -> no duplica, y
#  los "no confirmados" dejan de acumularse.
#  Ediciones EN LINEA con verificacion. Crea .bak. Idempotente.
# ============================================================

$path = 'C:\sistema-rl-verfrut\frontend\pages\dashboard.html'
if (-not (Test-Path $path)) { Write-Host "[X] No existe: $path" -ForegroundColor Red; return }

$utf8 = New-Object System.Text.UTF8Encoding $false
$raw  = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
$nl   = if ($raw.Contains("`r`n")) { "`r`n" } else { "`n" }
$lines = $raw -split "`r`n|`n"

$errores = @()
$cambios = 0

# 1) Set de nros del API -> normalizar a String (linea 4158 -> idx 4157)
$i1 = 4157
$old1 = 'CACHE.atenciones.map(a => a.nro)'
$new1 = 'CACHE.atenciones.map(a => String(a.nro))'
if ($lines[$i1].Contains($old1)) {
  $lines[$i1] = $lines[$i1].Replace($old1, $new1); $cambios++
} elseif ($lines[$i1].Contains($new1)) {
  # ya aplicado
} else { $errores += "Linea 4158 no tiene el .map(a => a.nro) esperado" }

# 2) Filtro de pendientes -> normalizar a String (linea 4159 -> idx 4158)
$i2 = 4158
$old2 = '!_nrosApi.has(a.nro)'
$new2 = '!_nrosApi.has(String(a.nro))'
if ($lines[$i2].Contains($old2)) {
  $lines[$i2] = $lines[$i2].Replace($old2, $new2); $cambios++
} elseif ($lines[$i2].Contains($new2)) {
  # ya aplicado
} else { $errores += "Linea 4159 no tiene el !_nrosApi.has(a.nro) esperado" }

if ($errores.Count -gt 0) {
  Write-Host "[X] NO se modifico nada. Problemas:" -ForegroundColor Red
  $errores | ForEach-Object { Write-Host "   - $_" -ForegroundColor Red }
  return
}

if ($cambios -eq 0) {
  Write-Host "[=] El fix ya estaba aplicado. Nada que hacer." -ForegroundColor Yellow
  return
}

Copy-Item $path "$path.bak" -Force
[System.IO.File]::WriteAllText($path, ($lines -join $nl), $utf8)

Write-Host "[OK] Comparacion de nro normalizada a String ($cambios ediciones)." -ForegroundColor Green
Write-Host "     Adios duplicados y acumulacion de 'no confirmados'." -ForegroundColor Green
Write-Host "     Respaldo: dashboard.html.bak" -ForegroundColor Green
