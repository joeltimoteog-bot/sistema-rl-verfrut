# ============================================================
#  add-ruta-codigo.ps1
#  Agrega columnas "Ruta" y "Codigo" a la tabla Mis Atenciones
#  (dashboard.html del Sistema RL).
#  - Crea respaldo .bak
#  - VERIFICA ocurrencias antes de tocar: si algo no calza
#    exactamente, NO escribe nada y avisa.
# ============================================================

$path = 'C:\sistema-rl-verfrut\frontend\pages\dashboard.html'
if (-not (Test-Path $path)) { Write-Host "[X] No existe: $path" -ForegroundColor Red; return }

$utf8 = New-Object System.Text.UTF8Encoding $false        # UTF-8 sin BOM
$raw  = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)

$cod = 'C' + [char]0xF3 + 'digo'                          # "Codigo" con tilde -> Código

# --- 1) HEADER: insertar Ruta y Codigo antes de Documento ---
$hOld = '<th>Celular</th><th>Empresa</th><th>Fundo</th><th>Documento</th>'
$hNew = '<th>Celular</th><th>Empresa</th><th>Fundo</th><th>Ruta</th><th>' + $cod + '</th><th>Documento</th>'

# --- 2) FILA (renderAt): agregar <td> ruta y codigo despues de fundo ---
$rOld = "<td>`${a.fundo||''}</td>"
$rNew = "<td>`${a.fundo||''}</td><td>`${a.ruta||''}</td><td>`${a.codigo||''}</td>"

# --- Conteos de verificacion ---
$cH = ([regex]::Matches($raw, [regex]::Escape($hOld))).Count
$cR = ([regex]::Matches($raw, [regex]::Escape($rOld))).Count
$cC = ([regex]::Matches($raw, [regex]::Escape('colspan="16"'))).Count

Write-Host "Header tabla atenciones encontrado : $cH  (esperado 1)"
Write-Host "Fila <td> fundo encontrada         : $cR  (esperado 1)"
Write-Host "colspan=16 a cambiar               : $cC"

if ($cH -ne 1 -or $cR -ne 1) {
  Write-Host "[X] Conteo inesperado. NO se modifico nada. Pasame estos numeros." -ForegroundColor Red
  return
}

# --- Aplicar ---
Copy-Item $path "$path.bak" -Force
$raw = $raw.Replace($hOld, $hNew)
$raw = $raw.Replace($rOld, $rNew)
$raw = $raw.Replace('colspan="16"', 'colspan="18"')
[System.IO.File]::WriteAllText($path, $raw, $utf8)

Write-Host "[OK] Columnas Ruta y Codigo agregadas a Mis Atenciones." -ForegroundColor Green
Write-Host "     Respaldo: dashboard.html.bak" -ForegroundColor Green
