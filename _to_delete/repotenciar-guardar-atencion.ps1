# ============================================================
#  repotenciar-guardar-atencion.ps1
#  Refuerza la VALIDACION de guardarAt() en dashboard.html
#  (la linea 4830). DNI 8 digitos + Nombre + Documento, y
#  enfoca el primer campo que falte.
#  El anti doble-clic (disable + finally) y los toasts YA
#  existian, no se tocan.
#  Edita por numero de linea con verificacion. Crea .bak.
# ============================================================

$path = 'C:\sistema-rl-verfrut\frontend\pages\dashboard.html'
if (-not (Test-Path $path)) { Write-Host "[X] No existe: $path" -ForegroundColor Red; return }

$utf8 = New-Object System.Text.UTF8Encoding $false
$raw  = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
$nl   = if ($raw.Contains("`r`n")) { "`r`n" } else { "`n" }
$lines = $raw -split "`r`n|`n"

$iV = 4829   # linea 4830 (validacion actual)

# Nueva validacion (una sola linea JS, ASCII puro)
$nuevaVal = @'
  const _miss=[];if(!/^\d{8}$/.test(String(d.dni||'').trim()))_miss.push(['at_dni','DNI (8 digitos)']);if(!String(d.nombre||'').trim())_miss.push(['at_nom','Nombre']);if(!String(d.detalle_documento||'').trim())_miss.push(['at_doc_txt','Documento']);if(_miss.length){const el=document.getElementById(_miss[0][0]);if(el){el.focus();el.style.borderColor='#ef4444';setTimeout(function(){el.style.borderColor='';},2500);}mostrarToast('Falta completar: '+_miss.map(function(m){return m[1];}).join(', '),'error');return;}
'@

if (-not $lines[$iV].Contains('if(!d.dni||!d.nombre)')) {
  Write-Host "[X] La linea 4830 no tiene la validacion esperada. NO se modifico nada." -ForegroundColor Red
  Write-Host ("    Contenido actual de la 4830:") -ForegroundColor Yellow
  Write-Host ("    " + $lines[$iV])
  return
}

Copy-Item $path "$path.bak" -Force
$lines[$iV] = $nuevaVal
[System.IO.File]::WriteAllText($path, ($lines -join $nl), $utf8)

Write-Host "[OK] Validacion repotenciada en guardarAt (linea 4830)." -ForegroundColor Green
Write-Host "     Obligatorios: DNI (8 digitos) + Nombre + Documento." -ForegroundColor Green
Write-Host "     Enfoca y resalta el primer campo que falte + toast." -ForegroundColor Green
Write-Host "     Anti doble-clic y feedback: ya estaban OK (no se tocaron)." -ForegroundColor Green
Write-Host "     Respaldo: dashboard.html.bak" -ForegroundColor Green
