# reparar-llaves.ps1 — _FASE3_V1 (05-nov-2026): vuelve a copiar las llaves (sin archivo temporal),
# genera una llave nueva para el reloj, reprograma kpi-reloj y prueba reloj + indices.
$ErrorActionPreference = 'Continue'
$env:PYTHONWARNINGS = 'ignore'
$REF = 'exdjzbfinppzatjyimxn'; $RAIZ = 'C:\sistema-rl-verfrut'; $URL = "https://$REF.supabase.co/functions/v1/api"
$RG = 'rg-sistema-rl'; $APP = 'rl-fn-verfrut'
function Alto($m) { Write-Host "ALTO: $m" -ForegroundColor Red; exit 1 }

Write-Host "`n== 1/3 Llaves (no se muestran) ==" -ForegroundColor Cyan
$llaves = New-Object System.Collections.Generic.List[string]
$hk = $null; try { $hk = ((az functionapp keys list -g $RG -n $APP -o json 2>$null) -join "`n") | ConvertFrom-Json } catch {}
if (-not $hk) { Alto 'No se pudieron leer las llaves de Azure' }
if ($hk.masterKey) { $llaves.Add([string]$hk.masterKey) }
if ($hk.functionKeys) { $hk.functionKeys.PSObject.Properties | ForEach-Object { if ($_.Value) { $llaves.Add([string]$_.Value) } } }
$funcs = 'acceso-importar','atenciones-batch','atenciones-create','atenciones-depurar','atenciones-guardar-admin','cumpl-importar','cv-guardar-admin','cv-importar','db-indices','kpi-admin','mod-importar','tablas-cv','tablas-hoja','trabajadores-sync','usuarios-sync'
foreach ($f in $funcs) {
  $fk = $null; try { $fk = ((az functionapp function keys list -g $RG -n $APP --function-name $f -o json 2>$null) -join "`n") | ConvertFrom-Json } catch {}
  if ($fk) { $fk.PSObject.Properties | ForEach-Object { if ($_.Value) { $llaves.Add([string]$_.Value) } } }
}
$cron = ([guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N'))
$llaves.Add($cron)
$unicas = @($llaves | Where-Object { $_ -match '^[A-Za-z0-9_\-=/+.]+$' } | Select-Object -Unique)
$raras = @($llaves | Where-Object { $_ -notmatch '^[A-Za-z0-9_\-=/+.]+$' }).Count
npx -y supabase@latest secrets set ("RL_FN_KEYS=" + ($unicas -join ',')) ("RL_CRON_KEY=" + $cron) --project-ref $REF --yes 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { Alto 'No se pudieron guardar las llaves' }
Write-Host ("Llaves guardadas: " + $unicas.Count + $(if ($raras) { " (omitidas con caracteres raros: $raras)" } else { '' }))
Start-Sleep -Seconds 10

Write-Host "`n== 2/3 Reprogramando kpi-reloj con la llave nueva ==" -ForegroundColor Cyan
Push-Location "$RAIZ\migracion"
try { $env:RL_CRON_KEY = $cron; node programar-reloj.js; if ($LASTEXITCODE -ne 0) { Alto 'No se pudo programar el reloj' } } finally { Remove-Item Env:\RL_CRON_KEY -ErrorAction SilentlyContinue; Pop-Location }

Write-Host "`n== 3/3 Probando ==" -ForegroundColor Cyan
foreach ($modo in 'header','code') {
  try {
    if ($modo -eq 'header') { $r = Invoke-RestMethod "$URL/_reloj/kpi-reloj" -Method Post -Headers @{ 'x-functions-key' = $cron } -ContentType 'application/json' -Body '{}' -TimeoutSec 150 }
    else { $r = Invoke-RestMethod ("$URL/_reloj/kpi-reloj?code=" + $cron) -Method Post -ContentType 'application/json' -Body '{}' -TimeoutSec 150 }
    Write-Host ("OK kpi-reloj ($modo): " + ($r | ConvertTo-Json -Compress)) -ForegroundColor Green; break
  } catch { Write-Host ("kpi-reloj ($modo): " + $_.Exception.Message) -ForegroundColor Yellow }
}
try { $i = Invoke-RestMethod ("$URL/mantenimiento/indices?aplicar=1&code=" + $cron) -Method Post -TimeoutSec 150; $i.acciones | ForEach-Object { Write-Host ("  " + $_.indice + ": " + $_.estado) } }
catch { Write-Host ("ATENCION indices: " + $_.Exception.Message) -ForegroundColor Yellow }
Write-Host "`nListo. Mandale el resultado a Claude." -ForegroundColor Green
