# ============================================================
# fix-dashboard-total-anio.ps1
# Sistema RL v3.0 - Mi Dashboard
# La tarjeta "Total Anio" (#sA) mostraba rg.total (historico 47937).
# Debe mostrar SOLO el anio actual, sumando por_mes cuyas claves
# empiezan con el anio en curso (ej. "2026_01".."2026_05").
# Toca 1 linea en _fbAplicarEstadisticasFirebase (la del admin).
# Patron: validacion todo-o-nada + .bak + idempotencia
# ============================================================

$ErrorActionPreference = 'Stop'
$path = ".\dashboard.html"

if (-not (Test-Path $path)) {
    Write-Host "ERROR: no se encuentra $path. Ejecuta desde C:\sistema-rl-verfrut\frontend\pages" -ForegroundColor Red
    exit 1
}

$content = [System.IO.File]::ReadAllText((Resolve-Path $path), [System.Text.Encoding]::UTF8)

# ---- Idempotencia ----
if ($content -match '_totAnioFB') {
    Write-Host "YA APLICADO: el fix de Total Anio ya existe. No se hace nada." -ForegroundColor Yellow
    exit 0
}

$nl = if ($content -match "`r`n") { "`r`n" } else { "`n" }

# El fragmento a reemplazar: la linea del admin que pinta #sA con el total historico.
# Ojo: _fbSet('sA', supStats.total) (supervisor) NO se toca; solo rg.total.
$old = "_fbSet('sA', rg.total);"

# Bloque nuevo: calcula total del anio actual sumando por_mes (claves 'YYYY_...').
$newLines = @(
  "(function(){",
  "    var _aYr = String(new Date().getFullYear());",
  "    var _pm = (fbData && fbData.por_mes) ? fbData.por_mes : {};",
  "    var _totAnioFB = 0;",
  "    Object.keys(_pm).forEach(function(k){",
  "      if (k.indexOf(_aYr + '_') === 0) {",
  "        var v = _pm[k];",
  "        _totAnioFB += (v && typeof v.total === 'number') ? v.total : (typeof v === 'number' ? v : 0);",
  "      }",
  "    });",
  "    _fbSet('sA', _totAnioFB);",
  "  })();"
)
$new = $newLines -join $nl

# ---- Validacion todo-o-nada ----
$count = ([regex]::Matches($content, [regex]::Escape($old))).Count
Write-Host "Coincidencias de \"$old\" : $count  (se espera 1)" -ForegroundColor Cyan

if ($count -ne 1) {
    Write-Host "ABORTADO: no es exactamente 1 coincidencia. No se modifico nada (sin .bak)." -ForegroundColor Red
    Write-Host "Nota: la linea del supervisor (_fbSet('sA', supStats.total)) es distinta y NO debe contarse." -ForegroundColor Gray
    exit 1
}

# ---- Backup ----
$bak = "$path.bak"
[System.IO.File]::WriteAllText((Join-Path (Get-Location) $bak), $content, (New-Object System.Text.UTF8Encoding $false))
Write-Host "Backup creado: $bak" -ForegroundColor Green

# ---- Aplicar ----
$content = $content.Replace($old, $new)

[System.IO.File]::WriteAllText((Resolve-Path $path), $content, (New-Object System.Text.UTF8Encoding $false))

Write-Host ""
Write-Host "LISTO: 'Total Anio' ahora suma solo el anio actual desde por_mes." -ForegroundColor Green
Write-Host "Las claves invalidas (202_07, 204_07...) se ignoran porque no empiezan con el anio actual." -ForegroundColor Gray
Write-Host "Verifica con Ctrl+Shift+R: la tarjeta TOTAL ANIO debe mostrar 8182 (2026)." -ForegroundColor Cyan
