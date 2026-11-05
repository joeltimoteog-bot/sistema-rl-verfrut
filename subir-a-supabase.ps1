# ═══════════════════════════════════════════════════════════════════════════
#  subir-a-supabase.ps1 — _EDGE_V1 (05-nov-2026)
#  Sube el servidor del Sistema RR.LL. a Supabase (Edge Function "api").
#  Es el MISMO codigo de azure/functions, empaquetado en supabase/functions/api.
#  NO cambia las pantallas: hasta publicar azure-token.js nuevo, nadie lo usa.
#  Las claves se copian de Azure a Supabase sin mostrarse en pantalla.
# ═══════════════════════════════════════════════════════════════════════════
$ErrorActionPreference = 'Continue'   # avisos de az/npx en stderr no son errores; se revisa $LASTEXITCODE
$env:PYTHONWARNINGS = 'ignore'
$REF  = 'exdjzbfinppzatjyimxn'
$RAIZ = 'C:\sistema-rl-verfrut'
$URL  = "https://$REF.supabase.co/functions/v1/api"

function Alto($m) { Write-Host "ALTO: $m" -ForegroundColor Red; exit 1 }

Write-Host "`n== 0/3 Revisando requisitos ==" -ForegroundColor Cyan
if (-not (Test-Path "$RAIZ\supabase\functions\api\bundle.mjs")) { Alto 'Falta supabase\functions\api\bundle.mjs' }
if (-not (Test-Path "$RAIZ\supabase\functions\api\index.ts"))   { Alto 'Falta supabase\functions\api\index.ts' }
Write-Host 'Requisitos OK'

Write-Host "`n== 1/3 Copiando la configuracion de Azure a Supabase (las claves NO se muestran) ==" -ForegroundColor Cyan
$cfgTxt = (az functionapp config appsettings list -g rg-sistema-rl -n rl-fn-verfrut -o json 2>$null) -join "`n"
$cfg = $null; try { $cfg = $cfgTxt | ConvertFrom-Json } catch {}
if (-not $cfg) { Alto 'No se pudo leer la configuracion de Azure (az login?)' }
$m = @{}; foreach ($x in $cfg) { $m[$x.name] = $x.value }
if (-not $m['JWT_SECRET'])      { Alto 'Azure no tiene JWT_SECRET' }
if (-not $m['SUPABASE_DB_URL']) { Alto 'Azure no tiene SUPABASE_DB_URL' }
$claves = 'JWT_SECRET','STORAGE_ACCOUNT_NAME','STORAGE_ACCOUNT_KEY','LOGIN_INTENTOS_MAX','LOGIN_BLOQUEO_MIN','LECTURAS_CON_SESION','JWT_REQUIRED','INTERNAL_API_KEY','COMPROMISO_VERSION','CLAVE_CAMBIO_OBLIGATORIO'
$valores = [ordered]@{}
foreach ($k in $claves) { if ($m.ContainsKey($k) -and "$($m[$k])" -ne '') { $valores[$k] = "$($m[$k])" } }
$valores['RL_DB_URL']     = "$($m['SUPABASE_DB_URL'])"   # pooler (las SUPABASE_* son reservadas en Supabase)
$valores['USAR_SUPABASE'] = '1'
$valores['DBPG_MAX']      = '3'
$tmp = Join-Path $env:TEMP ("rl-sec-" + [guid]::NewGuid().ToString() + ".env")
try {
  $lineas = foreach ($k in $valores.Keys) {
    $v = $valores[$k]
    if ($v.Contains("'")) { "$k=`"" + $v.Replace('\','\\').Replace('"','\"') + "`"" } else { "$k='$v'" }   # comillas simples = literal
  }
  [IO.File]::WriteAllLines($tmp, $lineas, (New-Object Text.UTF8Encoding $false))
  npx -y supabase@latest secrets set --env-file $tmp --project-ref $REF --yes 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) { Alto 'No se pudieron guardar los secretos (falta "npx supabase login"?)' }
} finally { if (Test-Path $tmp) { Remove-Item $tmp -Force } }
Write-Host ("Secretos guardados: " + ($valores.Keys -join ', '))

Write-Host "`n== 2/3 Subiendo la funcion 'api' a Supabase ==" -ForegroundColor Cyan
Push-Location $RAIZ
try {
  npx -y supabase@latest functions deploy api --project-ref $REF --no-verify-jwt --use-api --yes
  if ($LASTEXITCODE -ne 0) {
    Write-Host 'Reintentando sin --use-api...' -ForegroundColor Yellow
    npx -y supabase@latest functions deploy api --project-ref $REF --no-verify-jwt --yes
    if ($LASTEXITCODE -ne 0) { Alto 'No se pudo subir la funcion' }
  }
} finally { Pop-Location }

Write-Host "`n== 3/3 Verificando ==" -ForegroundColor Cyan
Start-Sleep -Seconds 5
try { $s = Invoke-RestMethod "$URL/salud" -TimeoutSec 60; Write-Host ("OK salud: " + ($s | ConvertTo-Json -Compress)) -ForegroundColor Green }
catch { Alto ("La funcion no responde: " + $_.Exception.Message) }
# prueba de base de datos: login de un usuario que NO existe -> debe responder 401 "Usuario o contrasena incorrectos"
try {
  Invoke-RestMethod "$URL/auth/login" -Method Post -ContentType 'application/json' -Body '{"usuario":"verificacion.supabase","password":"x"}' -TimeoutSec 60 | Out-Null
  Write-Host 'Respuesta inesperada (200)' -ForegroundColor Yellow
} catch {
  $code = 0; try { $code = [int]$_.Exception.Response.StatusCode } catch {}
  $cuerpo = ''; try { $sr = New-Object IO.StreamReader($_.Exception.Response.GetResponseStream()); $cuerpo = $sr.ReadToEnd() } catch { $cuerpo = $_.ErrorDetails.Message }
  if ($code -eq 401) { Write-Host "OK base de datos: login de prueba rechazado como corresponde (401)" -ForegroundColor Green }
  else { Write-Host "ATENCION login de prueba: HTTP $code $cuerpo" -ForegroundColor Yellow }
}
Write-Host "`nLISTO: el servidor ya esta en Supabase ($URL). Las pantallas aun usan Azure hasta publicar azure-token.js?v=8." -ForegroundColor Green
