# ═══════════════════════════════════════════════════════════════════════════
#  subir-fase3.ps1 — _FASE3_V1 (05-nov-2026)
#  1) Llaves de funcion de Azure -> secreto RL_FN_KEYS en Supabase (no se muestran)
#  2) Sube la Edge Function "api" con las 59 rutas (incluye mantenimiento, importaciones, reloj)
#  3) Programa kpi-reloj en Supabase (pg_cron) y lo prueba una vez
#  4) Crea en Supabase los indices que falten (db-indices)
#  Azure sigue funcionando igual: nada se apaga en este paso.
# ═══════════════════════════════════════════════════════════════════════════
$ErrorActionPreference = 'Continue'
$env:PYTHONWARNINGS = 'ignore'
$REF = 'exdjzbfinppzatjyimxn'; $RAIZ = 'C:\sistema-rl-verfrut'; $URL = "https://$REF.supabase.co/functions/v1/api"
$RG = 'rg-sistema-rl'; $APP = 'rl-fn-verfrut'
function Alto($m) { Write-Host "ALTO: $m" -ForegroundColor Red; exit 1 }

Write-Host "`n== 1/4 Copiando las llaves de funcion de Azure a Supabase (no se muestran) ==" -ForegroundColor Cyan
$llaves = New-Object System.Collections.Generic.List[string]
$hk = $null; try { $hk = ((az functionapp keys list -g $RG -n $APP -o json 2>$null) -join "`n") | ConvertFrom-Json } catch {}
if (-not $hk) { Alto 'No se pudieron leer las llaves de Azure' }
if ($hk.masterKey) { $llaves.Add($hk.masterKey) }
if ($hk.functionKeys) { $hk.functionKeys.PSObject.Properties | ForEach-Object { if ($_.Value) { $llaves.Add([string]$_.Value) } } }
$funcs = 'acceso-importar','atenciones-batch','atenciones-create','atenciones-depurar','atenciones-guardar-admin','cumpl-importar','cv-guardar-admin','cv-importar','db-indices','kpi-admin','mod-importar','tablas-cv','tablas-hoja','trabajadores-sync','usuarios-sync'
foreach ($f in $funcs) {
  $fk = $null; try { $fk = ((az functionapp function keys list -g $RG -n $APP --function-name $f -o json 2>$null) -join "`n") | ConvertFrom-Json } catch {}
  if ($fk) { $fk.PSObject.Properties | ForEach-Object { if ($_.Value) { $llaves.Add([string]$_.Value) } } }
}
$cron = ([guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N'))
$llaves.Add($cron)
$unicas = $llaves | Where-Object { $_ -and -not $_.Contains(',') } | Select-Object -Unique
$tmp = Join-Path $env:TEMP ("rl-k-" + [guid]::NewGuid().ToString() + ".env")
try {
  [IO.File]::WriteAllLines($tmp, @("RL_FN_KEYS='" + ($unicas -join ',') + "'", "RL_CRON_KEY='$cron'"), (New-Object Text.UTF8Encoding $false))
  npx -y supabase@latest secrets set --env-file $tmp --project-ref $REF --yes 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) { Alto 'No se pudieron guardar las llaves en Supabase' }
} finally { if (Test-Path $tmp) { Remove-Item $tmp -Force } }
Write-Host ("Llaves copiadas: " + @($unicas).Count + " (incluye la del reloj)")

Write-Host "`n== 2/4 Subiendo la funcion 'api' (59 rutas) ==" -ForegroundColor Cyan
Push-Location $RAIZ
try { npx -y supabase@latest functions deploy api --project-ref $REF --no-verify-jwt --use-api --yes; if ($LASTEXITCODE -ne 0) { Alto 'No se pudo subir la funcion' } } finally { Pop-Location }
Start-Sleep -Seconds 5
try { $s = Invoke-RestMethod "$URL/salud" -TimeoutSec 60; Write-Host ("OK salud: rutas=" + $s.rutas) -ForegroundColor Green; if ($s.rutas -lt 59) { Alto 'La funcion subida no tiene las 59 rutas' } } catch { Alto ('La funcion no responde: ' + $_.Exception.Message) }
try { Invoke-RestMethod "$URL/mantenimiento/indices" -TimeoutSec 60 | Out-Null; Write-Host 'ATENCION: mantenimiento respondio SIN llave' -ForegroundColor Yellow } catch { Write-Host 'OK: sin llave responde 401 (protegido)' -ForegroundColor Green }

Write-Host "`n== 3/4 Programando kpi-reloj en Supabase (pg_cron) y probandolo ==" -ForegroundColor Cyan
Push-Location "$RAIZ\migracion"
try { $env:RL_CRON_KEY = $cron; node programar-reloj.js; if ($LASTEXITCODE -ne 0) { Alto 'No se pudo programar el reloj' } } finally { Remove-Item Env:\RL_CRON_KEY -ErrorAction SilentlyContinue; Pop-Location }
try { $r = Invoke-RestMethod "$URL/_reloj/kpi-reloj" -Method Post -Headers @{ 'x-functions-key' = $cron } -ContentType 'application/json' -Body '{}' -TimeoutSec 150; Write-Host ("OK kpi-reloj en Supabase: " + ($r | ConvertTo-Json -Compress)) -ForegroundColor Green }
catch { Write-Host ("ATENCION kpi-reloj: " + $_.Exception.Message + " (Azure lo sigue corriendo)") -ForegroundColor Yellow }

Write-Host "`n== 4/4 Indices en Supabase (crea los que falten, sin bloquear) ==" -ForegroundColor Cyan
try { $i = Invoke-RestMethod "$URL/mantenimiento/indices?aplicar=1" -Method Post -Headers @{ 'x-functions-key' = $cron } -TimeoutSec 150; $i.acciones | ForEach-Object { Write-Host ("  " + $_.indice + ": " + $_.estado) } }
catch { Write-Host ("ATENCION indices: " + $_.Exception.Message) -ForegroundColor Yellow }

Write-Host "`nLISTO fase 3 en Supabase. Azure sigue igual (respaldo). Mandale el resultado a Claude." -ForegroundColor Green
