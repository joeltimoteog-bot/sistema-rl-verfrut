# ============================================================
#  add-ruta-codigo-v2.ps1
#  Agrega "Ruta" y "Codigo" a la tabla Mis Atenciones (dashboard.html)
#  Edita por NUMERO DE LINEA con verificacion previa.
#  Solo toca: header (357), fila renderAt (4557) y 6 colspan de
#  atenciones (360,4527,4532,4534,4541,4543).
#  NO toca la otra tabla (linea 5289) ni los colspan de casos.
#  Crea respaldo .bak. Si algo no calza, NO escribe nada.
# ============================================================

$path = 'C:\sistema-rl-verfrut\frontend\pages\dashboard.html'
if (-not (Test-Path $path)) { Write-Host "[X] No existe: $path" -ForegroundColor Red; return }

$utf8 = New-Object System.Text.UTF8Encoding $false
$raw  = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
$nl   = if ($raw.Contains("`r`n")) { "`r`n" } else { "`n" }
$lines = $raw -split "`r`n|`n"

$cod = 'C' + [char]0xF3 + 'digo'   # "Código"
$errores = @()

# 1) HEADER  (linea 357 -> indice 356)
$iH = 356
if ($lines[$iH].Contains('<th>Fundo</th><th>Documento</th>')) {
  $lines[$iH] = $lines[$iH].Replace(
    '<th>Fundo</th><th>Documento</th>',
    '<th>Fundo</th><th>Ruta</th><th>' + $cod + '</th><th>Documento</th>')
} else { $errores += "Linea 357 no tiene el header esperado" }

# 2) FILA renderAt  (linea 4557 -> indice 4556)
$iR = 4556
$tdFundo = "<td>`${a.fundo||''}</td>"
if ($lines[$iR].Contains($tdFundo)) {
  $lines[$iR] = $lines[$iR].Replace(
    $tdFundo,
    $tdFundo + "<td>`${a.ruta||''}</td><td>`${a.codigo||''}</td>")
} else { $errores += "Linea 4557 no tiene la celda fundo esperada" }

# 3) COLSPAN solo de Atenciones
$colspanLines = 360,4527,4532,4534,4541,4543
foreach ($ln in $colspanLines) {
  $idx = $ln - 1
  if ($lines[$idx].Contains('colspan="16"')) {
    $lines[$idx] = $lines[$idx].Replace('colspan="16"', 'colspan="18"')
  } else { $errores += "Linea $ln no tiene colspan=16" }
}

if ($errores.Count -gt 0) {
  Write-Host "[X] NO se modifico nada. Problemas:" -ForegroundColor Red
  $errores | ForEach-Object { Write-Host "   - $_" -ForegroundColor Red }
  return
}

Copy-Item $path "$path.bak" -Force
[System.IO.File]::WriteAllText($path, ($lines -join $nl), $utf8)

Write-Host "[OK] Ruta y Codigo agregadas a Mis Atenciones." -ForegroundColor Green
Write-Host "     Header + fila renderAt + 6 colspan (atenciones)." -ForegroundColor Green
Write-Host "     Tabla de casos y la otra tabla: intactas." -ForegroundColor Green
Write-Host "     Respaldo: dashboard.html.bak" -ForegroundColor Green
