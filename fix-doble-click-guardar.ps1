# ============================================================
#  fix-doble-click-guardar.ps1
#  Anti doble-clic REAL en guardarAt() (dashboard.html).
#  Agrega un candado sincrono window._savingAt:
#    - guard al inicio (linea 4817): si ya hay guardado en curso, return
#    - set flag al deshabilitar boton (linea 4836)
#    - clear flag en el finally (linea 4945)
#  Ediciones EN LINEA (no mueve numeros de linea). Crea .bak.
#  Es idempotente: si ya esta aplicado, no duplica.
# ============================================================

$path = 'C:\sistema-rl-verfrut\frontend\pages\dashboard.html'
if (-not (Test-Path $path)) { Write-Host "[X] No existe: $path" -ForegroundColor Red; return }

$utf8 = New-Object System.Text.UTF8Encoding $false
$raw  = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
$nl   = if ($raw.Contains("`r`n")) { "`r`n" } else { "`n" }
$lines = $raw -split "`r`n|`n"

$errores = @()
$cambios = 0

# 1) GUARD al inicio (linea 4817 -> idx 4816)
$i1 = 4816
if ($lines[$i1].Contains('async function guardarAt')) {
  if (-not $lines[$i1].Contains('_savingAt')) {
    $lines[$i1] = $lines[$i1] + ' if(window._savingAt) return;'
    $cambios++
  }
} else { $errores += "Linea 4817 no es 'async function guardarAt'" }

# 2) SET flag al deshabilitar el boton (linea 4836 -> idx 4835)
$i2 = 4835
if ($lines[$i2].Contains('btnAt.disabled=true')) {
  if (-not $lines[$i2].Contains('_savingAt')) {
    $lines[$i2] = $lines[$i2] + ' window._savingAt=true;'
    $cambios++
  }
} else { $errores += "Linea 4836 no tiene 'btnAt.disabled=true'" }

# 3) CLEAR flag en el finally (linea 4945 -> idx 4944)
$i3 = 4944
if ($lines[$i3].Contains('finally{')) {
  if (-not $lines[$i3].Contains('_savingAt')) {
    $lines[$i3] = $lines[$i3].Replace('finally{', 'finally{window._savingAt=false;')
    $cambios++
  }
} else { $errores += "Linea 4945 no tiene 'finally{'" }

if ($errores.Count -gt 0) {
  Write-Host "[X] NO se modifico nada. Problemas:" -ForegroundColor Red
  $errores | ForEach-Object { Write-Host "   - $_" -ForegroundColor Red }
  return
}

if ($cambios -eq 0) {
  Write-Host "[=] El candado anti-doble-clic ya estaba aplicado. Nada que hacer." -ForegroundColor Yellow
  return
}

Copy-Item $path "$path.bak" -Force
[System.IO.File]::WriteAllText($path, ($lines -join $nl), $utf8)

Write-Host "[OK] Candado anti-doble-clic agregado ($cambios ediciones)." -ForegroundColor Green
Write-Host "     guard (4817) + set flag (4836) + clear en finally (4945)." -ForegroundColor Green
Write-Host "     Respaldo: dashboard.html.bak" -ForegroundColor Green
