# ═══════════════════════════════════════════════════════════════════════════
#  seguridad-etapa-BD.ps1 (18-oct-2026) — Etapas B y D del candado del servidor
#  B) INTERNAL_API_KEY = todas las claves de funciones de la app (las que usa el Apps Script)
#  D) LECTURAS_CON_SESION = 1  (las lecturas exigen sesion o clave interna)
#  No toca codigo. Para volver atras: .\seguridad-etapa-BD.ps1 -Apagar
#  Requiere Azure CLI con sesion iniciada (la misma que usa publicar-azure.ps1).
# ═══════════════════════════════════════════════════════════════════════════
param([switch]$Apagar, [switch]$SoloVer)

$app = 'rl-functions-verfrut'
$ErrorActionPreference = 'Continue'   # az imprime avisos por stderr (Python 32 bits): no son errores
$env:PYTHONWARNINGS = 'ignore'

function Rg {
  $j = (& az functionapp list --query "[?name=='$app'].resourceGroup" -o tsv 2>$null | Out-String)
  if (-not $j -or -not $j.Trim()) { throw "No encuentro la Function App '$app'. Ejecuta primero: az login" }
  return $j.Trim()
}

Write-Host "Buscando la app $app..." -ForegroundColor Cyan
$rg = Rg
Write-Host "Grupo de recursos: $rg"

if ($SoloVer) {
  & az functionapp config appsettings list -n $app -g $rg --query "[?name=='INTERNAL_API_KEY' || name=='LECTURAS_CON_SESION' || name=='JWT_REQUIRED'].{nombre:name, valor:value}" -o table
  exit 0
}

if ($Apagar) {
  Write-Host "Apagando LECTURAS_CON_SESION (se vuelve al comportamiento anterior en ~30 s)..." -ForegroundColor Yellow
  & az functionapp config appsettings set -n $app -g $rg --settings LECTURAS_CON_SESION=0 -o none 2>$null
  Write-Host "Listo: LECTURAS_CON_SESION=0" -ForegroundColor Green
  exit 0
}

# ── B) claves de funciones de la app (host keys): entre ellas estan las que usa el Apps Script ──
Write-Host "Leyendo las claves de funciones de la app..." -ForegroundColor Cyan
$keysJson = (& az functionapp keys list -n $app -g $rg -o json 2>$null | Out-String)
$keys = $keysJson | ConvertFrom-Json
$lista = @()
if ($keys.functionKeys) { $keys.functionKeys.PSObject.Properties | ForEach-Object { if ($_.Value) { $lista += $_.Value } } }
if ($keys.systemKeys)   { $keys.systemKeys.PSObject.Properties   | ForEach-Object { if ($_.Value) { $lista += $_.Value } } }
# clave fija del Apps Script (Código.js) por si no es una host key
$gas = 'C:\sistema-rl-gas\Código.js'
if (Test-Path $gas) {
  $m = Select-String -Path $gas -Pattern "AZURE_FUNCTION_KEY\s*=\s*'([^']+)'" | Select-Object -First 1
  if ($m) { $lista += $m.Matches[0].Groups[1].Value }
}
$lista = $lista | Where-Object { $_ } | Select-Object -Unique
if (-not $lista) { throw "No se obtuvo ninguna clave. ¿La sesion de Azure CLI es la correcta?" }
Write-Host ("Claves encontradas: " + $lista.Count + " (no se muestran)") -ForegroundColor Green
$valor = ($lista -join ',')

# ── guardar B y D ──
Write-Host "Guardando INTERNAL_API_KEY y LECTURAS_CON_SESION=1..." -ForegroundColor Cyan
& az functionapp config appsettings set -n $app -g $rg --settings "INTERNAL_API_KEY=$valor" "LECTURAS_CON_SESION=1" -o none 2>$null
if ($LASTEXITCODE -ne 0) { throw "az no pudo guardar la configuracion (codigo $LASTEXITCODE)" }
Write-Host "Guardado. La app se reinicia sola (~30 s)." -ForegroundColor Green

Start-Sleep -Seconds 35
Write-Host "Comprobando: una lectura SIN sesion debe responder 401..." -ForegroundColor Cyan
try {
  $r = Invoke-WebRequest -Uri "https://rl-functions-verfrut-c0ctfjc0cjf5f0hz.brazilsouth-01.azurewebsites.net/api/mod/sup/getSupervisores" -Method POST -ContentType 'application/json' -Body '{}' -UseBasicParsing -TimeoutSec 30
  Write-Host ("Respondio HTTP " + $r.StatusCode + " (aun abierto: espera 1 min y vuelve a probar con -SoloVer)") -ForegroundColor Yellow
} catch {
  $code = $_.Exception.Response.StatusCode.value__
  if ($code -eq 401) { Write-Host "OK: HTTP 401 sin sesion. Candado activo." -ForegroundColor Green }
  else { Write-Host ("Respondio HTTP " + $code) -ForegroundColor Yellow }
}
