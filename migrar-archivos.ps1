# ═══════════════════════════════════════════════════════════════════════════
#  migrar-archivos.ps1 — _FASE4_ARCHIVOS_V1 (05-nov-2026)
#  Copia las fotos y PDF de Azure Blob a Supabase Storage (mismo nombre). La copia la hace el
#  servidor de Supabase; aqui solo se le pide lote por lote. Azure NO se toca (los enlaces viejos siguen).
#  Se puede repetir sin problema (si un archivo ya estaba, se reemplaza por el mismo).
# ═══════════════════════════════════════════════════════════════════════════
$ErrorActionPreference = 'Continue'
$env:PYTHONWARNINGS = 'ignore'
$URL = 'https://exdjzbfinppzatjyimxn.supabase.co/functions/v1/api/archivos'
function Alto($m) { Write-Host "ALTO: $m" -ForegroundColor Red; exit 1 }
$hk = $null; try { $hk = ((az functionapp keys list -g rg-sistema-rl -n rl-fn-verfrut -o json 2>$null) -join "`n") | ConvertFrom-Json } catch {}
if (-not $hk -or -not $hk.masterKey) { Alto 'No se pudo leer la llave de Azure (az login?)' }
$H = @{ 'x-functions-key' = [string]$hk.masterKey }
function Llamar($accion, $cuerpo) { Invoke-RestMethod "$URL/$accion" -Method Post -Headers $H -ContentType 'application/json' -Body ($cuerpo | ConvertTo-Json -Compress) -TimeoutSec 150 }

Write-Host "`n== 1/3 Preparando los contenedores en Supabase ==" -ForegroundColor Cyan
try { $p = Llamar 'preparar' @{}; $p.buckets.PSObject.Properties | ForEach-Object { Write-Host ("  " + $_.Name + ": " + $_.Value) } } catch { Alto ('preparar: ' + $_.Exception.Message) }

Write-Host "`n== 2/3 Copiando archivos (lotes de 15) ==" -ForegroundColor Cyan
$errores = @()
foreach ($c in 'casos-rl', 'visitas-campo') {
  $marcador = ''; $total = 0; $vuelta = 0
  do {
    $vuelta++; $r = $null
    for ($intento = 1; $intento -le 3 -and -not $r; $intento++) {
      try { $r = Llamar 'migrar' @{ contenedor = $c; marcador = $marcador; lote = 15 } } catch { Write-Host ("  reintento $intento ($c): " + $_.Exception.Message) -ForegroundColor Yellow; Start-Sleep -Seconds 3 }
    }
    if (-not $r) { Alto "No se pudo copiar un lote de $c (se puede volver a ejecutar el script)" }
    $total += $r.copiados; $errores += @($r.errores)
    Write-Host ("  $c lote $vuelta" + ": +" + $r.copiados + " (total $total)" + $(if (@($r.errores).Count) { ' errores: ' + @($r.errores).Count } else { '' }))
    $marcador = [string]$r.marcador
  } while (-not $r.fin)
}

Write-Host "`n== 3/3 Conteo en Supabase ==" -ForegroundColor Cyan
try { $e = Llamar 'estado' @{}; $e.archivos.PSObject.Properties | ForEach-Object { Write-Host ("  " + $_.Name + ": " + $_.Value + " archivos") } } catch { Write-Host ('estado: ' + $_.Exception.Message) -ForegroundColor Yellow }
if ($errores.Count) { Write-Host "`nArchivos con error:" -ForegroundColor Yellow; $errores | ForEach-Object { Write-Host ("  " + $_.nombre + ": " + $_.error) } }
Write-Host "`nLISTO. Esperado: casos-rl 229 y visitas-campo 637. Mandale el resultado a Claude." -ForegroundColor Green
