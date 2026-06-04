# ============================================================
# fix-visitas-plazo-2dias.ps1
# Sistema RL v3.0 - Modulo Visitas de Campo
# Cambia el plazo del informe de 1 a 2 dias habiles
#   - fechaLimiteInforme: while (plazo < 1)  -> < 2
#   - calcSemanaVisita:   const diasPerm = 1 ->  = 2
#   - comentario "1 dia habil" -> "2 dias habiles" (via regex, tolera tildes)
# Patron: validacion todo-o-nada + .bak + idempotencia
# ============================================================

$ErrorActionPreference = 'Stop'
$path = ".\dashboard.html"

if (-not (Test-Path $path)) {
    Write-Host "ERROR: no se encuentra $path. Ejecuta desde C:\sistema-rl-verfrut\frontend\pages" -ForegroundColor Red
    exit 1
}

# Leer UTF-8 sin BOM
$content = [System.IO.File]::ReadAllText((Resolve-Path $path), [System.Text.Encoding]::UTF8)

# ---- Idempotencia: si ya esta en 2, no hacer nada ----
if ($content -match 'while\s*\(plazo\s*<\s*2\)' -and $content -match 'const\s+diasPerm\s*=\s*2\s*;') {
    Write-Host "YA APLICADO: el plazo ya esta en 2 dias habiles. No se hace nada." -ForegroundColor Yellow
    exit 0
}

# ---- Definir cambios (fragmentos UNICOS) ----
# 1) while (plazo < 1)  -> while (plazo < 2)   [ASCII puro]
$old1 = 'while (plazo < 1) {'
$new1 = 'while (plazo < 2) {'

# 2) const diasPerm   = 1;  -> = 2;   [ASCII puro, respeta espacios con regex]
$rxDiasPerm = [regex]'const\s+diasPerm\s+=\s+1;'

# 3) comentario: "// Plazo: 1 dia habil a partir..."  (tildes -> usar . )
#    Texto real: // Plazo: 1 dÃ­a hÃ¡bil a partir del dÃ­a siguiente a fechaFin
$rxComent = [regex]'// Plazo: 1 d.a h.bil a partir del d.a siguiente a fechaFin'

# ---- Validacion todo-o-nada (contar ANTES de tocar) ----
$c1 = ([regex][regex]::Escape($old1)).Matches($content).Count
$c2 = $rxDiasPerm.Matches($content).Count
$c3 = $rxComent.Matches($content).Count

Write-Host "Coincidencias encontradas:" -ForegroundColor Cyan
Write-Host "  while (plazo < 1)      : $c1  (se espera 1)"
Write-Host "  const diasPerm = 1     : $c2  (se espera 1)"
Write-Host "  comentario '1 dia'     : $c3  (se espera 1)"

if ($c1 -ne 1 -or $c2 -ne 1 -or $c3 -ne 1) {
    Write-Host "ABORTADO: las coincidencias no son exactamente 1. No se modifico nada (sin .bak)." -ForegroundColor Red
    exit 1
}

# ---- Backup ----
$bak = "$path.bak"
[System.IO.File]::WriteAllText((Join-Path (Get-Location) $bak), $content, (New-Object System.Text.UTF8Encoding $false))
Write-Host "Backup creado: $bak" -ForegroundColor Green

# ---- Aplicar cambios ----
$content = $content.Replace($old1, $new1)
$content = $rxDiasPerm.Replace($content, 'const diasPerm   = 2;')
$content = $rxComent.Replace($content, '// Plazo: 2 dias habiles a partir del dia siguiente a fechaFin')

# ---- Guardar UTF-8 sin BOM ----
[System.IO.File]::WriteAllText((Resolve-Path $path), $content, (New-Object System.Text.UTF8Encoding $false))

Write-Host ""
Write-Host "LISTO: plazo de visitas cambiado a 2 dias habiles." -ForegroundColor Green
Write-Host "Verifica en el navegador (Ctrl+Shift+R) y prueba con una visita de viernes (temp. baja):" -ForegroundColor Cyan
Write-Host "  viernes -> sab/dom no cuentan -> lunes (1) -> martes (2) = vence martes." -ForegroundColor Gray
