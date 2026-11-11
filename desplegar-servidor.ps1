# ══════════════════════════════════════════════════════════════════════
#  desplegar-servidor.ps1 — _SIN_AZURE_V1 (11-nov-2026)
#  Publica el servidor del Sistema RR.LL. (Edge Function "api") en Supabase.
#  NO depende de Azure (el script anterior, subir-a-supabase.ps1, leia la
#  configuracion desde Azure y deja de funcionar cuando Azure se apague).
#  Los secretos del servidor ya estan guardados en Supabase: aqui no se tocan.
#  Uso:  cd C:\sistema-rl-verfrut ; .\desplegar-servidor.ps1
# ══════════════════════════════════════════════════════════════════════
$ErrorActionPreference = 'Continue'
$REF  = 'exdjzbfinppzatjyimxn'
$RAIZ = 'C:\sistema-rl-verfrut'
$URL  = "https://$REF.supabase.co/functions/v1/api"
function Alto($m) { Write-Host "ALTO: $m" -ForegroundColor Red; exit 1 }

if (-not (Test-Path "$RAIZ\supabase\functions\api\bundle.mjs")) { Alto 'Falta supabase\functions\api\bundle.mjs' }
if (-not (Test-Path "$RAIZ\supabase\functions\api\index.ts"))   { Alto 'Falta supabase\functions\api\index.ts' }

Write-Host "`n== 1/2 Subiendo la funcion 'api' a Supabase ==" -ForegroundColor Cyan
Push-Location $RAIZ
try {
  npx -y supabase@latest functions deploy api --project-ref $REF --no-verify-jwt --use-api --yes
  if ($LASTEXITCODE -ne 0) { Alto 'No se pudo subir la funcion (falta "npx supabase login"?)' }
} finally { Pop-Location }

Write-Host "`n== 2/2 Verificando ==" -ForegroundColor Cyan
Start-Sleep -Seconds 5
try { $s = Invoke-RestMethod "$URL/salud" -TimeoutSec 60; Write-Host ("OK salud: " + ($s | ConvertTo-Json -Compress)) -ForegroundColor Green }
catch { Alto ("La funcion no responde: " + $_.Exception.Message) }
Write-Host "`nListo. El servidor quedo publicado." -ForegroundColor Green
