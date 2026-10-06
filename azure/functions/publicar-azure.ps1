# ═══════════════════════════════════════════════════════════════════════════
#  publicar-azure.ps1 — publicar las Azure Functions SIN romper el sistema
#  (06-oct-2026) .funcignore excluye node_modules: si se publica sin
#  "--build remote", Azure queda SIN librerias (mssql, jsonwebtoken) y TODAS
#  las funciones fallan con 500 en 1 ms -> el sistema cae al respaldo de
#  Google y se pone lento. Este script siempre publica con --build remote.
#  Uso:  cd C:\sistema-rl-verfrut\azure\functions ;  .\publicar-azure.ps1
# ═══════════════════════════════════════════════════════════════════════════
Set-Location $PSScriptRoot
func azure functionapp publish rl-functions-verfrut --build remote
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR al publicar. Azure NO se actualizo." -ForegroundColor Red; exit 1 }

Write-Host "`nComprobando que Azure responda..." -ForegroundColor Cyan
Start-Sleep -Seconds 20
try {
  $r = Invoke-WebRequest -Uri "https://rl-functions-verfrut-c0ctfjc0cjf5f0hz.brazilsouth-01.azurewebsites.net/api/mod/horas/horasListarMotivos" -Method Post -Body '{}' -ContentType 'application/json' -UseBasicParsing
  Write-Host "OK: Azure responde (HTTP $($r.StatusCode))" -ForegroundColor Green
} catch {
  Write-Host "ATENCION: Azure respondio con error: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "Revisa el portal (Secuencia de registro) antes de seguir." -ForegroundColor Red
}
