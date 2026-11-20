const { sql, getPool } = require('../shared/db');
const { exigirAuth } = require('../shared/auth');

/* _SUBSIDIO_ALERTA_V1: tipo de un documento de atencion para el conteo de incapacidad (misma regla en la pantalla) */
function clasificarDocIncap(t) {
  const x = String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  /* _SUBSIDIO_ALERTA_V2 (20-nov, Joel): el CITT que entrega un companero o familiar ES del trabajador (no puede venir por su salud): cuenta igual */
  if (/MATERNIDAD/.test(x)) return 'maternidad';
  if (/ENFERMEDAD PROFESIONAL/.test(x)) return 'profesional';
  if (/CITT|DESCANSO MEDICO/.test(x)) return 'incap';
  return null;
}

module.exports = async function (context, req) {
  // Validación JWT (modo suave hasta activar JWT_REQUIRED=1)
  const authUser = exigirAuth(context, req);
  if (authUser === null) return;

  const t0 = Date.now();
  context.log('atenciones-by-dni triggered');

  try {
    // Validar input (DNI 8 dígitos)
    const dni = String(req.query.dni || (req.body && req.body.dni) || '').trim();
    if (!dni || !/^\d{8}$/.test(dni)) {
      context.res = {
        status: 400,
        body: { success: false, error: 'DNI invalido (debe ser 8 digitos)' }
      };
      return;
    }

    // Ventana de tiempo configurable (default 60 días)
    /* _BYDNI_COMPLETO_V1 (01-nov-2026): Bienestar Social (Descansos Medicos) necesita el historial completo
       de un DNI. Con completo=1 la ventana sube hasta 3 anos, se leen hasta 200 filas y las finalizadas
       no se recortan a 5. Sin el parametro, el comportamiento anterior se mantiene identico. */
    const completo = String(req.query.completo || '') === '1';
    const maxDias = completo ? 1095 : 365;
    const topN = completo ? 200 : 30;
    const dias = Math.max(1, Math.min(maxDias, parseInt(req.query.dias || '60', 10)));
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() - dias);
    fechaLimite.setHours(0, 0, 0, 0);

    // Query Azure SQL
    const pool = await getPool();
    const result = await pool.request()
      .input('dni', sql.NVarChar(15), dni)
      .input('fechaLimite', sql.Date, fechaLimite)
      .query(`
        SELECT TOP ${topN}
          id, nro, fecha_atencion, dni, nombre, empresa, fundo,
          detalle_documento, fecha_inicio_doc, fecha_termino_doc,
          dias_transcurridos, observaciones, supervisor,
          responsable_recepcion, estado
        FROM Atenciones
        WHERE dni = @dni
          AND fecha_atencion >= @fechaLimite
        ORDER BY fecha_atencion DESC, id DESC
      `);

    const atenciones = result.recordset || [];

    // Separar por estado
    const en_proceso = atenciones.filter(a => {
      const est = String(a.estado || '').toUpperCase();
      return est.includes('PROCESO');
    });

    const finalizadas_recientes = atenciones.filter(a => {
      const est = String(a.estado || '').toUpperCase();
      return est.includes('FINALIZ');
    });

    /* _AUTOLLENADO_DNI_V1 (20-nov-2026): con contacto=1 (Nueva atencion) se devuelve el ultimo celular, ruta y codigo
       registrados para ese DNI en atenciones anteriores: celular de la atencion mas reciente que lo tenga; ruta y codigo
       solo si la atencion es de los ultimos 60 dias (cambian entre campanas). Una consulta chica por DNI (indice por dni).
       Sin el parametro la respuesta es identica a la de antes (Bienestar y Consulta por DNI no cambian). */
    let contacto;
    if (String(req.query.contacto || '') === '1') {
      try {
        const rc = await pool.request().input('dni', sql.NVarChar(15), dni).query(`
          SELECT TOP 20 fecha_atencion, celular, ruta, codigo
          FROM Atenciones
          WHERE dni = @dni
          ORDER BY fecha_atencion DESC, id DESC`);
        const ymd = v => v instanceof Date ? v.toISOString().slice(0, 10) : String(v || '').slice(0, 10);
        const lim60 = new Date(); lim60.setDate(lim60.getDate() - 60); const l60 = lim60.toISOString().slice(0, 10);
        const txt = v => String(v == null ? '' : v).trim();
        contacto = { celular: '', celular_fecha: '', ruta: '', ruta_fecha: '', codigo: '', codigo_fecha: '' };
        (rc.recordset || []).forEach(x => {
          const f = ymd(x.fecha_atencion);
          if (!contacto.celular && txt(x.celular)) { contacto.celular = txt(x.celular); contacto.celular_fecha = f; }
          if (f >= l60 && !contacto.ruta && txt(x.ruta)) { contacto.ruta = txt(x.ruta); contacto.ruta_fecha = f; }
          if (f >= l60 && !contacto.codigo && txt(x.codigo)) { contacto.codigo = txt(x.codigo); contacto.codigo_fecha = f; }
        });
      } catch (eC) { context.log.warn('atenciones-by-dni contacto: ' + eC.message); contacto = null; }
    }

    /* _SUBSIDIO_ALERTA_V1 (20-nov-2026, decision de Joel): con incap=1 (Nueva atencion) se devuelven los periodos de
       incapacidad del trabajador desde el 1 de enero del ano anterior (solo fechas y tipo, sin nombres): la pantalla suma
       los dias unicos del ano calendario para avisar desde cuando corresponde subsidio EsSalud (el empleador paga los
       primeros 20 dias del ano). Tipos: incap = CITT (todas sus variantes, regularizar, canjear) y DESCANSO MEDICO;
       maternidad (subsidio desde el primer dia); profesional (va por SCTR, no suma a los 20). El CITT que entrega un
       companero o familiar cuenta (es del trabajador). Cada ano calendario se cuenta desde cero. Sin el parametro la respuesta no cambia. */
    let incapacidad;
    if (String(req.query.incap || '') === '1') {
      try {
        const desdeInc = new Date(Date.UTC(new Date().getUTCFullYear() - 1, 0, 1));
        const ri = await pool.request().input('dni', sql.NVarChar(15), dni).input('desdeInc', sql.Date, desdeInc).query(`
          SELECT TOP 400 nro, detalle_documento, fecha_inicio_doc, fecha_termino_doc
          FROM Atenciones
          WHERE dni = @dni AND fecha_termino_doc >= @desdeInc
          ORDER BY fecha_inicio_doc DESC`);
        const ymdI = v => v instanceof Date ? v.toISOString().slice(0, 10) : String(v || '').slice(0, 10);
        incapacidad = [];
        (ri.recordset || []).forEach(x => {
          const tipo = clasificarDocIncap(x.detalle_documento);
          const ini = ymdI(x.fecha_inicio_doc), fin = ymdI(x.fecha_termino_doc);
          if (!tipo || !/^\d{4}-\d{2}-\d{2}$/.test(ini) || !/^\d{4}-\d{2}-\d{2}$/.test(fin) || fin < ini) return;
          incapacidad.push({ nro: x.nro, ini, fin, tipo });
        });
      } catch (eI) { context.log.warn('atenciones-by-dni incapacidad: ' + eI.message); incapacidad = null; }
    }

    const elapsed_ms = Date.now() - t0;
    context.log(`atenciones-by-dni: dni=${dni} total=${atenciones.length} en_proceso=${en_proceso.length} finalizadas=${finalizadas_recientes.length} - ${elapsed_ms}ms`);

    context.res = {
      status: 200,
      body: {
        success: true,
        dni,
        total: atenciones.length,
        en_proceso,
        finalizadas_recientes: completo ? finalizadas_recientes : finalizadas_recientes.slice(0, 5),
        completo,
        ventana_dias: dias,
        ...(contacto !== undefined ? { contacto } : {}),   /* _AUTOLLENADO_DNI_V1 */
        ...(incapacidad !== undefined ? { incapacidad } : {}),   /* _SUBSIDIO_ALERTA_V1 */
        elapsed_ms
      }
    };
  } catch (e) {
    context.log.error('Error en atenciones-by-dni:', e.message);
    context.res = {
      status: 500,
      body: { success: false, error: e.message }
    };
  }
};
module.exports.clasificarDocIncap = clasificarDocIncap;   /* _SUBSIDIO_ALERTA_V1: para las pruebas */
