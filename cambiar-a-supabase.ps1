# ══════════════════════════════════════════════════════════════════════════════
#  cambiar-a-supabase.ps1 (05-nov-2026) — pasa el Sistema RR.LL. de Azure SQL a Supabase
#  1) configura la conexion  2) publica el codigo (sigue en Azure SQL)  3) copia final de datos
#  4) reserva ids  5) ACTIVA Supabase  6) trae lo registrado durante el cambio
#  Volver atras en cualquier momento:  powershell -ExecutionPolicy Bypass -File C:\sistema-rl-verfrut\volver-a-azure-sql.ps1
# ══════════════════════════════════════════════════════════════════════════════
$ErrorActionPreference = 'Stop'
$g = 'rg-sistema-rl'; $app = 'rl-fn-verfrut'
Set-Location C:\sistema-rl-verfrut\migracion
function Paso($t) { Write-Host "`n== $t ==" -ForegroundColor Cyan }
function Alto($t) { Write-Host "ALTO: $t" -ForegroundColor Red; Write-Host "El sistema sigue en Azure SQL (no se activo Supabase)." -ForegroundColor Yellow; exit 1 }

Paso '0/6 Revisando requisitos'
if (-not (Test-Path .env)) { Alto 'falta migracion\.env (conexion de Supabase)' }
$url = ((Get-Content .env | Where-Object { $_ -match '^SUPABASE_DB_URL=' }) -replace '^SUPABASE_DB_URL=', '').Trim()
if ($url -notmatch '^postgres') { Alto 'el .env no tiene SUPABASE_DB_URL' }
if (-not (Get-Command func -ErrorAction SilentlyContinue)) { Alto 'falta Azure Functions Core Tools (func). Avisale a Claude.' }
if (-not (Test-Path ..\azure\functions\shared\esquema-pg.json)) { Alto 'falta azure\functions\shared\esquema-pg.json (se crea con node migrar.js esquema)' }
'Requisitos OK'

Paso '1/6 Configurando la conexion en Azure (Supabase APAGADO todavia)'
az functionapp config appsettings set -g $g -n $app --settings "SUPABASE_DB_URL=$url" "SUPABASE_SCHEMA=rl" "USAR_SUPABASE=0" -o none
if ($LASTEXITCODE -ne 0) { Alto 'no se pudo guardar la configuracion' }
'Configuracion guardada (USAR_SUPABASE=0)'

Paso '2/6 Publicando el codigo nuevo (sigue usando Azure SQL)'
Set-Location ..\azure\functions
& .\publicar-azure.ps1
if ($LASTEXITCODE -ne 0) { Alto 'la publicacion fallo' }
Set-Location C:\sistema-rl-verfrut\migracion

Paso '3/6 Copia final Azure -> Supabase (5 a 10 min)'
$ErrorActionPreference = 'Continue'
node migrar.js todo --rehacer 2>&1 | Tee-Object -FilePath migracion-final.log | Where-Object { $_ -match 'Esquema creado|COINCIDEN|diferencias|ERROR|^.{0,3}Atenciones ' }
if (Select-String -Path migracion-final.log -Pattern 'ERROR:' -Quiet) { Alto 'la copia tuvo un error (ver migracion-final.log)' }

Paso '4/6 Reservando ids'
node migrar.js reservar 2>&1 | Select-Object -Last 2
if ($LASTEXITCODE -ne 0) { Alto 'no se pudieron reservar ids' }

Paso '5/6 ACTIVANDO SUPABASE'
az functionapp config appsettings set -g $g -n $app --settings "USAR_SUPABASE=1" -o none
az functionapp restart -g $g -n $app
Write-Host 'Supabase activado. Esperando 20 s a que reinicie...' -ForegroundColor Green
Start-Sleep 20

Paso '6/6 Trayendo lo registrado en Azure durante el cambio'
node migrar.js pendientes 2>&1 | Select-Object -Last 6

Write-Host "`nLISTO: el sistema ya usa SUPABASE. Pide a todos Ctrl+F5 y prueba ingresar, buscar un DNI y guardar una atencion." -ForegroundColor Green
Write-Host 'Si algo sale mal: powershell -ExecutionPolicy Bypass -File C:\sistema-rl-verfrut\volver-a-azure-sql.ps1' -ForegroundColor Yellow
