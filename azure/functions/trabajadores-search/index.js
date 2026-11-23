const { sql, getPool } = require('../shared/db');
const { exigirAuth } = require('../shared/auth');
/* _EMPRESAS_V1 (26-oct-2026): las tablas salen del catalogo central shared/empresas.js
   (RAPEL, VERFRUT, OLMOS...). Solo se consultan las tablas que existen en la base. */
const EMP = require('../shared/empresas');
const SD = require('../shared/sede');
/* _SEDE_TRAB_V1 (23-nov-2026, decision de Joel: "nadie de Olmos debe ver lo de Piura"): la busqueda de trabajadores va por sede.
   Usuario de Olmos -> solo la nomina de Olmos (tabla Trabajadores_OLMOS; si aun no se ha cargado, no encuentra a nadie).
   Usuario de Piura -> RAPEL y VERFRUT, nunca la nomina de Olmos. jtimoteo y alcance GENERAL -> todas. Apagar: SEDE_FILTRO=off. */
async function tablasEmpresa(pool, empresa, modoSd) {
  const ex = await EMP.tablasExistentes(pool, sql);
  return EMP.EMPRESAS.filter(function (e) {
    if (modoSd === 'OLMOS' && e.codigo !== 'OLMOS') return false;
    if (modoSd === 'PIURA' && e.codigo === 'OLMOS') return false;
    return ex.has(e.tabla) && (EMP.esTodas(empresa) || e.codigo === empresa);
  });
}
/* _SEDE_TRAB_V2 (23-nov-2026, pedido de Joel): si la busqueda no encuentra nada en la sede del usuario pero el trabajador SI
   existe en la otra sede, se responde "no cuenta con acceso a la informacion de la sede ..." (sin entregar ningun dato). */
const OTRA_SEDE = { OLMOS: 'PIURA', PIURA: 'OLMOS' };
const NOM_SEDE = { OLMOS: 'Olmos', PIURA: 'Piura' };
function msgOtraSede(modoSd) { return 'No cuenta con acceso a la información de la sede ' + NOM_SEDE[OTRA_SEDE[modoSd]] + '.'; }
async function existeEnOtraSede(pool, modoSd, cond, poner) {
  try {
    if (!OTRA_SEDE[modoSd]) return false;
    const tb = await tablasEmpresa(pool, '', OTRA_SEDE[modoSd]);
    if (!tb.length) return false;
    const rq = pool.request(); poner(rq);
    const r = await rq.query(tb.map(function (e) { return `(SELECT TOP 1 1 AS x FROM dbo.${e.tabla} WHERE ${cond})`; }).join(' UNION ALL '));
    return (r.recordset || []).length > 0;
  } catch (e) { return false; }
}

module.exports = async function (context, req) {
  // Validación JWT (modo suave hasta activar JWT_REQUIRED=1)
  const authUser = exigirAuth(context, req);
  if (authUser === null) return;

  context.log('trabajadores-search triggered');
  const startTime = Date.now();

  try {
    const dni = (req.query.dni || '').toString().trim();
    const empresa = (req.query.empresa || '').toString().trim().toUpperCase();
    const modoSd = await SD.modo(await getPool(), authUser);   /* _SEDE_TRAB_V1 */

    /* _BUSCAR_NOMBRE_V1 (23-set-2026): busqueda por NOMBRE (?q=juan perez).
       Cada palabra debe aparecer en el nombre completo. Maximo 30 resultados.
       La busqueda por DNI de siempre no cambia. */
    const q = (req.query.q || '').toString().trim();
    if (!dni && q.length >= 3) {
      const palabras = q.split(/\s+/).filter(function (w) { return w.length >= 2; }).slice(0, 5);
      const poolQ = await getPool();
      const rq = poolQ.request();
      const conds = palabras.map(function (w, i) { rq.input('w' + i, sql.NVarChar(120), '%' + w + '%'); return 'nombre_completo LIKE @w' + i; }).join(' AND ') || '1=0';
      const partes = (await tablasEmpresa(poolQ, empresa, modoSd)).map(function (e) { return `SELECT TOP 30 *, '${e.codigo}' AS empresa_origen FROM dbo.${e.tabla} WHERE ${conds}`; });
      const rs = partes.length ? await rq.query(partes.map(function (x) { return '(' + x + ')'; }).join(' UNION ALL ')) : { recordset: [] };
      const lista = (rs.recordset || []).slice(0, 30);
      const cuerpoQ = { success: true, encontrados: lista.length, trabajadores: lista, elapsed_ms: Date.now() - startTime, fuente: 'AZURE_SQL' };
      if (!lista.length && await existeEnOtraSede(poolQ, modoSd, conds, function (r2) { palabras.forEach(function (w, i) { r2.input('w' + i, sql.NVarChar(120), '%' + w + '%'); }); })) {
        cuerpoQ.otra_sede = true; cuerpoQ.aviso_sede = msgOtraSede(modoSd);   /* _SEDE_TRAB_V2 */
      }
      context.res = { status: 200, body: cuerpoQ };
      return;
    }

    if (!dni) {
      context.res = {
        status: 400,
        body: {
          success: false,
          error: 'Parametro dni es requerido. Ej: ?dni=12345678'
        }
      };
      return;
    }

    const pool = await getPool();
    const request = pool.request();
    request.input('dni', sql.NVarChar(20), dni);
    /* _DNI_CERO_V1 (02-oct-2026): en la hoja los DNI que empiezan con 0 se guardan como
       numero (01234567 -> 1234567). Antes Azure buscaba solo el texto exacto -> 404 ->
       el sistema caia a Google (~20 s). Ahora busca las dos formas (con y sin ceros a la
       izquierda) y devuelve el DNI con 8 digitos, igual que buscarTrabajador de Google. */
    const dniSin0 = /^\d+$/.test(dni) ? dni.replace(/^0+/, '') : dni;
    const dni8 = /^\d{1,8}$/.test(dniSin0) ? ('00000000' + dniSin0).slice(-8) : dni;
    request.input('dni2', sql.NVarChar(20), dniSin0 || dni);
    request.input('dni3', sql.NVarChar(20), dni8);
    const W = 'dni IN (@dni, @dni2, @dni3)';

    const tablas = await tablasEmpresa(pool, empresa, modoSd);
    const query = tablas.map(function (e) { return `SELECT *, '${e.codigo}' AS empresa_origen FROM dbo.${e.tabla} WHERE ${W}`; }).join(' UNION ALL ');
    const result = query ? await request.query(query) : { recordset: [] };
    (result.recordset || []).forEach(function (t) {
      const d = String(t.dni == null ? '' : t.dni).trim();
      if (/^\d{7}$/.test(d)) t.dni = '0' + d;   /* _DNI_CERO_V1: misma forma que Google */
    });
    const elapsed = Date.now() - startTime;
    context.log('Busqueda DNI ' + dni + ' en ' + elapsed + 'ms - ' + result.recordset.length + ' resultado(s)');

    if (result.recordset.length === 0) {
      const otraSd = await existeEnOtraSede(pool, modoSd, W, function (r2) { r2.input('dni', sql.NVarChar(20), dni); r2.input('dni2', sql.NVarChar(20), dniSin0 || dni); r2.input('dni3', sql.NVarChar(20), dni8); });   /* _SEDE_TRAB_V2 */
      context.res = {
        status: 404,
        body: {
          success: false,
          mensaje: otraSd ? msgOtraSede(modoSd) : 'Trabajador no encontrado',
          otra_sede: otraSd,
          dni: dni,
          elapsed_ms: elapsed,
          fuente: 'AZURE_SQL'
        }
      };
      return;
    }

    context.res = {
      status: 200,
      body: {
        success: true,
        encontrados: result.recordset.length,
        trabajadores: result.recordset,
        elapsed_ms: elapsed,
        fuente: 'AZURE_SQL'
      }
    };
  } catch (e) {
    context.log.error('Error en trabajadores-search:', e);
    context.res = {
      status: 500,
      body: {
        success: false,
        error: e.message,
        code: e.code,
        name: e.name
      }
    };
  }
};