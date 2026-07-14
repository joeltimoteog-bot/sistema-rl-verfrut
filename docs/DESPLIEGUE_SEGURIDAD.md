# Despliegue — Mejoras de Seguridad (14-jul-2026)

Cambios hechos en el repo (pendientes de deploy):

- `azure/functions/auth-login/index.js` — bcrypt con **auto-migración**: cada login exitoso convierte el password en texto plano a hash bcrypt automáticamente. Además firma un JWT de 8h.
- `azure/functions/shared/auth.js` — NUEVO. Firma/valida JWT. Modo suave por defecto.
- `azure/functions/blob-sas/` — NUEVA Function. Emite tokens SAS de 15 min (solo crear/escribir).
- Las otras 9 Functions ahora validan JWT (modo suave hasta activar `JWT_REQUIRED=1`).
- `azure/functions/package.json` — nuevas deps: `bcryptjs`, `jsonwebtoken`, `@azure/storage-blob`.
- `index.html` — guarda el JWT del login y lo adjunta (wrapper de fetch) a llamadas a Azure Functions. Logs silenciados en producción.
- `frontend/pages/dashboard.html` — mismo wrapper JWT + logs silenciados (`localStorage.setItem('rl_debug','1')` para reactivarlos).
- `frontend/pages/azure-blob-upload.js` — pide SAS cortos a la Function `blob-sas`; los tokens hardcodeados quedan solo como fallback temporal.

## Pasos de despliegue (en orden)

### 1. Instalar dependencias y deployar Functions
```powershell
cd C:\sistema-rl-verfrut\azure\functions
npm install
func azure functionapp publish rl-functions-verfrut
```

### 2. Configurar variables en la Function App
Portal Azure → rl-functions-verfrut → Configuration → Application settings:

| Variable | Valor |
|---|---|
| `JWT_SECRET` | Genera uno: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `STORAGE_ACCOUNT_NAME` | `sistemarlverfrut` |
| `STORAGE_ACCOUNT_KEY` | Portal → Storage account → Access keys → key1 |
| `JWT_REQUIRED` | **NO configurar todavía** (ver paso 5) |

### 3. Push del frontend
`git add` + commit + push → GitHub Pages publica solo. Probar login normal.

### 4. Verificar auto-migración bcrypt
Tras unos días de logins, revisar en Azure SQL:
```sql
SELECT usuario, CASE WHEN password LIKE '$2%' THEN 'bcrypt' ELSE 'PLANO' END estado
FROM dbo.usuarios WHERE activo = 1;
```
A los rezagados que nunca inician sesión se les puede regenerar el hash manualmente.

### 5. Activar JWT obligatorio
Cuando el login ya devuelva token y todos usen el frontend nuevo (dar ~1 semana):
`JWT_REQUIRED = 1` en Application settings. Desde ahí, requests sin token → 401.

### 6. Revocar los tokens SAS viejos (IMPORTANTE)
Los 3 tokens SAS de `azure-blob-upload.js` están públicos en GitHub (incluso en el historial de git). Cuando `blob-sas` esté deployada y probada:
1. Portal → Storage account → contenedores `casos-rl`, `visitas-campo`, `documentos` → Access policy → **eliminar la política `sistemrl2027`** (esto invalida los 3 tokens al instante).
2. Borrar el bloque `sasTokens` (fallback) de `azure-blob-upload.js`.

### 7. Pendiente adicional detectado
- `dashboard.html` línea ~2815: `AZURE_FN_KEY_ATLIST` (function key de atenciones-list) también está pública. Con JWT_REQUIRED activo, conviene regenerar esa key en el Portal y quitarla del frontend.
- El GAS (`codigo.gs`) no valida JWT — su seguridad sigue dependiendo de la URL secreta del deployment. Mejora futura: pasar el token en el payload y validarlo en GAS.

## Rollback
- Frontend: `git revert` + push.
- Functions: el modo suave garantiza que nada se rompe aunque el frontend viejo no mande token. bcrypt solo migra tras un login exitoso; los hashes conviven con contraseñas planas sin conflicto.
