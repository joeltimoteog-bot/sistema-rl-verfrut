# ==========================================================
# fix-alerta-casos-por-vencer.ps1
# Sistema RL v3.0 - Modulo Registro de Casos
#
# Objetivo (Punto 3): que la alerta de "caso por vencer" le salga al
# usuario que registro el caso:
#   - Supervisores: solo SUS casos.
#   - Administradores: TODOS los casos.
#
# Diagnostico: verificarCasosPorVencer() ya corre al iniciar para todos
# (preload llena CACHE.casos y se llama en linea ~4083), y el toast+badge
# no tienen filtro de rol. PERO opera sobre CACHE.casos SIN filtrar por
# usuario -> un supervisor veria el conteo de TODOS los casos.
#
# Fix: agregar filtro de alcance al inicio de la funcion (mismo criterio
# que cargarCasos): admins = todos; supervisores = propios
# (supervisor / registrado_por / usuario_registro).
# ==========================================================

$ErrorActionPreference = 'Stop'
$path = 'C:\sistema-rl-verfrut\frontend\pages\dashboard.html'

if (-not (Test-Path $path)) {
    Write-Host "[ABORTADO] No se encontro: $path" -ForegroundColor Red
    exit 1
}

$enc = New-Object System.Text.UTF8Encoding $false
$raw = [System.IO.File]::ReadAllText($path, $enc)

# Idempotencia
if ($raw.Contains('_esAdminVC')) {
    Write-Host "[INFO] El filtro de alcance ya estaba aplicado. Nada que hacer." -ForegroundColor Yellow
    exit 0
}

# Detectar fin de linea del archivo
$nl = if ($raw.Contains("`r`n")) { "`r`n" } else { "`n" }

# Patron: cabecera de la funcion + las 2 primeras lineas (tolerante a espacios)
$rx = 'function verificarCasosPorVencer\(\)\s*\{\s*const casos = CACHE\.casos \|\| \[\];\s*if \(!casos\.length\) return;'

# Validar coincidencia unica
$n = ([regex]::Matches($raw, $rx)).Count
if ($n -ne 1) {
    Write-Host "[ABORTADO] Se esperaba 1 coincidencia del inicio de verificarCasosPorVencer y hay: $n" -ForegroundColor Red
    exit 1
}

# Construir reemplazo (const casos -> let casos + filtro de alcance)
$repLines = @(
    "function verificarCasosPorVencer() {",
    "  let casos = CACHE.casos || [];",
    "  if (!casos.length) return;",
    "  // Alcance: admins ven todos; supervisores solo los casos que registraron",
    "  const _esAdminVC = ROLES_ADMIN.includes(USER.rol) || ROLES_ADMIN2.includes(USER.rol);",
    "  if (!_esAdminVC) {",
    "    const _pnVC = (USER.nombre || USER.usuario || '').toLowerCase().trim().split(' ')[0];",
    "    const _usVC = (USER.usuario || '').toLowerCase().trim();",
    "    casos = casos.filter(c => String(c.supervisor||'').toLowerCase().includes(_pnVC) || String(c.registrado_por||'').toLowerCase().includes(_pnVC) || String(c.usuario_registro||'').toLowerCase().trim() === _usVC);",
    "  }"
)
$rep = $repLines -join $nl

# Backup
Copy-Item $path "$path.bak" -Force
Write-Host "[OK] Backup creado: $path.bak" -ForegroundColor Green

# Aplicar (regex, 1 sola coincidencia)
$raw = [regex]::Replace($raw, $rx, $rep)
[System.IO.File]::WriteAllText($path, $raw, $enc)

Write-Host ""
Write-Host "[OK] Filtro de alcance agregado en verificarCasosPorVencer:" -ForegroundColor Green
Write-Host "      - Administradores: alerta de TODOS los casos por vencer." -ForegroundColor Cyan
Write-Host "      - Supervisores: alerta SOLO de los casos que registraron." -ForegroundColor Cyan
Write-Host ""
Write-Host "Ya corre al iniciar sesion (preload), asi que cada usuario recibe su alerta." -ForegroundColor Cyan
