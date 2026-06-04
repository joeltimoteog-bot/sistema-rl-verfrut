# ============================================================
#  fb-async-guardar.ps1
#  Tras guardar una atencion NUEVA, dispara la actualizacion de
#  Firebase en SEGUNDO PLANO (fire-and-forget), para que el
#  guardado no espere las ~6 llamadas a Firebase.
#  Requiere que el GAS ya tenga la accion 'syncFirebaseAtencion'.
#  Edita 1 linea EN LINEA con verificacion. Crea .bak. Idempotente.
# ============================================================

$path = 'C:\sistema-rl-verfrut\frontend\pages\dashboard.html'
if (-not (Test-Path $path)) { Write-Host "[X] No existe: $path" -ForegroundColor Red; return }

$utf8 = New-Object System.Text.UTF8Encoding $false
$raw  = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
$nl   = if ($raw.Contains("`r`n")) { "`r`n" } else { "`n" }
$lines = $raw -split "`r`n|`n"

$iB = 4870   # linea 4871 (console.log [guardarAt] Guardado en hoja)
$snippet = " apiPost({action:'syncFirebaseAtencion', ...d}).catch(function(){});"

if (-not $lines[$iB].Contains('[guardarAt] Guardado en hoja')) {
  Write-Host "[X] La linea 4871 no es el log esperado. NO se modifico nada." -ForegroundColor Red
  Write-Host ("    Contenido actual: " + $lines[$iB])
  return
}

if ($lines[$iB].Contains('syncFirebaseAtencion')) {
  Write-Host "[=] Ya estaba aplicado. Nada que hacer." -ForegroundColor Yellow
  return
}

Copy-Item $path "$path.bak" -Force
$lines[$iB] = $lines[$iB] + $snippet
[System.IO.File]::WriteAllText($path, ($lines -join $nl), $utf8)

Write-Host "[OK] Firebase ahora se actualiza en segundo plano tras guardar." -ForegroundColor Green
Write-Host "     El guardado ya no espera a Firebase (~5s menos)." -ForegroundColor Green
Write-Host "     Respaldo: dashboard.html.bak" -ForegroundColor Green
