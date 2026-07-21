# ==========================================================
# fix-carga-instantanea-atenciones.ps1
# Sistema RL v3.0 - Modulo Mis Atenciones
#
# Objetivo: que la tabla aparezca AL INSTANTE al abrir el modulo
# (incluso tras recargar la pagina), con patron stale-while-revalidate.
#
# Diagnostico:
#  - guardarCacheLS() EXCLUIA las atenciones del localStorage -> al
#    abrir, CACHE.atenciones estaba vacio -> se iba a Azure (lento).
#  - cargarCacheLS() tenia candado de 10 min (CACHE_TTL): si abrias
#    despues, descartaba la cache y hacia carga completa (lento "cada vez").
#  - filtrarAt() filtra solo sobre atTodas (HOY) -> basta cachear hoy.
#
# Fix (3 cambios en dashboard.html):
#  1) guardarCacheLS: guardar tambien atHoy (atenciones de hoy, max 2000).
#  2) cargarCacheLS: quitar el candado de TTL (restaurar aunque este vieja).
#  3) cargarCacheLS: restaurar atHoy como CACHE.atenciones (pinta al instante).
#
# El refresco en 2do plano (onload + visibilitychange) actualiza en silencio.
# ==========================================================

$ErrorActionPreference = 'Stop'
$path = 'C:\sistema-rl-verfrut\frontend\pages\dashboard.html'

if (-not (Test-Path $path)) {
    Write-Host "[ABORTADO] No se encontro: $path" -ForegroundColor Red
    exit 1
}

$enc = New-Object System.Text.UTF8Encoding $false
$raw = [System.IO.File]::ReadAllText($path, $enc)

# --- Idempotencia ---
if ($raw.Contains('stored.atHoy')) {
    Write-Host "[INFO] El fix ya estaba aplicado (existe 'stored.atHoy'). Nada que hacer." -ForegroundColor Yellow
    exit 0
}

# --- Definir los 3 reemplazos (fragmentos unicos, una sola linea c/u) ---

# (1) guardarCacheLS: agregar atHoy al payload
$old1 = "const payload = JSON.stringify({data: datosReducidos, ts: CACHE_TS});"
$new1 = "const _hoyLS = (typeof hoy === 'function') ? hoy() : ''; const _atHoy = Array.isArray(_a) ? _a.filter(a => a.fecha_atencion === _hoyLS).slice(0, 2000) : []; const payload = JSON.stringify({data: datosReducidos, atHoy: _atHoy, ts: CACHE_TS});"

# (2) cargarCacheLS: quitar candado de TTL (stale-while-revalidate)
$old2 = " || (Date.now() - stored.ts) > CACHE_TTL) return false;"
$new2 = ") return false;"

# (3) cargarCacheLS: restaurar atHoy como CACHE.atenciones
$old3 = "= stored.data;"
$new3 = "= stored.data; if (Array.isArray(stored.atHoy) && stored.atHoy.length) CACHE.atenciones = stored.atHoy;"

# --- Validar (todo o nada): cada fragmento debe existir EXACTAMENTE 1 vez ---
function Count-Frag([string]$h, [string]$needle) {
    return ([regex]::Matches($h, [regex]::Escape($needle))).Count
}
$errores = @()
if ((Count-Frag $raw $old1) -ne 1) { $errores += "guardarCacheLS payload: se esperaba 1, hay $(Count-Frag $raw $old1)." }
if ((Count-Frag $raw $old2) -ne 1) { $errores += "cargarCacheLS TTL: se esperaba 1, hay $(Count-Frag $raw $old2)." }
if ((Count-Frag $raw $old3) -ne 1) { $errores += "cargarCacheLS stored.data: se esperaba 1, hay $(Count-Frag $raw $old3)." }

if ($errores.Count -gt 0) {
    Write-Host "[ABORTADO] No se modifico nada. Problemas:" -ForegroundColor Red
    $errores | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow }
    exit 1
}

# --- Backup ---
Copy-Item $path "$path.bak" -Force
Write-Host "[OK] Backup creado: $path.bak" -ForegroundColor Green

# --- Aplicar ---
$raw = $raw.Replace($old1, $new1)
$raw = $raw.Replace($old2, $new2)
$raw = $raw.Replace($old3, $new3)
[System.IO.File]::WriteAllText($path, $raw, $enc)

Write-Host ""
Write-Host "[OK] 1/3 guardarCacheLS: ahora guarda atHoy (atenciones de hoy, max 2000) en localStorage." -ForegroundColor Green
Write-Host "[OK] 2/3 cargarCacheLS: candado de 10 min removido (restaura aunque este vieja)." -ForegroundColor Green
Write-Host "[OK] 3/3 cargarCacheLS: restaura atHoy como CACHE.atenciones -> tabla al instante." -ForegroundColor Green
Write-Host ""
Write-Host "Resultado: Mis Atenciones pinta AL INSTANTE al abrir/recargar; el refresco" -ForegroundColor Cyan
Write-Host "en 2do plano (onload + visibilitychange) actualiza los datos en silencio." -ForegroundColor Cyan
