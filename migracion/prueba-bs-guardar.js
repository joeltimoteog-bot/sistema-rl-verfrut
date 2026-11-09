/* prueba del paso 0: bs/guardar, bs/auditar, bs/fuente y el seguro de mantenimiento/hoja/fin */
const A = require('./arnes-edge.js');
const cel = d => ({ $d: d.toISOString(), $s: String(d) });
const bs = (op, body, usuario) => A.llamar('bs', { method: op === 'GET' ? 'GET' : 'POST', bindingData: { accion: body._accion }, body, usuario });
const assert = (c, m) => { if (!c) { console.log('   ✗ ' + m); process.exitCode = 1; } else console.log('   ✓ ' + m); };
(async () => {
  /* 1) la hoja BS_Quejas y BS_Quejas_Seguimientos llegan desde "Google" por mantenimiento/hoja (como hoy) */
  const encQ = ['id', 'fecha_recepcion', 'clasificacion', 'canal', 'categoria', 'sector', 'detalle', 'accion_correctiva', 'accion_mejora', 'coordinacion', 'fecha_levantamiento_ac', 'frecuencia_seguimiento_ac', 'fecha_seguimiento_am', 'observaciones', 'resultado', 'documentos', 'empresa', 'created_by', 'created_at', 'updated_at', 'tipo_lugar', 'seguimiento', 'seguimiento_frecuencia', 'seguimiento_inicio', 'seguimiento_fin', 'seguimiento_dias', 'seguimiento_alerta', 'cantidad_buzones', 'cantidad_quejas', 'buzones_detalle'];
  const fila = (id, det) => { const f = encQ.map(() => ''); f[0] = id; f[1] = cel(new Date('2026-11-01T05:00:00Z')); f[2] = 'QUEJA'; f[6] = det; f[16] = 'VERFRUT'; f[17] = 'ovilela'; f[18] = cel(new Date('2026-11-01T15:00:00Z')); return f; };
  const hoja = async (clave, enc, filas) => {
    await A.llamar('tablas-hoja', { bindingData: { clave, accion: 'inicio' }, body: {} });
    await A.llamar('tablas-hoja', { bindingData: { clave, accion: 'lote' }, body: { desde: 0, filas } });
    return A.llamar('tablas-hoja', { bindingData: { clave, accion: 'fin' }, body: { encabezado: enc, ancho: enc.length, total: filas.length } });
  };
  let r = await hoja('bs_quejas', encQ, [fila(1, 'uno'), fila(2, 'dos'), fila(7, 'siete')]);
  assert(r.status === 200, 'carga inicial BS_Quejas desde Google: ' + JSON.stringify(r.body).slice(0, 80));
  const encS = ['id', 'id_queja', 'numero_seguimiento', 'fecha_seguimiento', 'detalle', 'created_by', 'created_at'];
  r = await hoja('bs_quejas_seguim', encS, [[1, 7, 1, cel(new Date()), 'seg previo', 'ovilela', cel(new Date())]]);
  assert(r.status === 200, 'carga inicial BS_Quejas_Seguimientos');
  r = await hoja('bs_auditoria', ['fecha', 'usuario', 'accion', 'modulo', 'registro_id', 'detalle'], [[cel(new Date()), 'ovilela', 'CREAR', 'quejas', 7, '']]);
  assert(r.status === 200, 'carga inicial BS_Auditoria');

  /* 2) con la tabla en fuente 'hoja', guardar responde 409 */
  r = await bs('POST', { _accion: 'guardar', clave: 'bs_quejas', op: 'crear', datos: { detalle: 'x' } });
  assert(r.status === 409 && r.body.fuente === 'hoja', 'guardar con fuente hoja → 409: ' + r.body.message);

  /* 3) fuente: lista y cambio (solo jtimoteo) */
  r = await bs('POST', { _accion: 'fuente', clave: 'bs_quejas', fuente: 'supabase' }, { usuario: 'ovilela', rol: 'administrador' });
  assert(r.status === 403, 'otro admin no puede cambiar la fuente');
  for (const k of ['bs_quejas', 'bs_quejas_seguim', 'bs_auditoria']) { r = await bs('POST', { _accion: 'fuente', clave: k, fuente: 'supabase' }); assert(r.status === 200 && r.body.fuente === 'supabase', 'fuente ' + k + ' → supabase'); }
  r = await bs('GET', { _accion: 'fuente' }); assert(r.status === 200 && r.body.tablas.length === 13 && r.body.tablas.find(t => t.clave === 'bs_quejas').fuente === 'supabase', 'GET fuente lista 13 tablas');

  /* 4) la hoja ya no reemplaza la tabla */
  r = await hoja('bs_quejas', encQ, [fila(1, 'uno')]);
  assert(r.status === 409, 'mantenimiento/hoja/fin con fuente supabase → 409: ' + r.body.error);
  r = await A.llamar('bs', { method: 'GET', bindingData: { accion: 'tabla' }, query: { clave: 'bs_quejas' } });
  assert(r.body.total === 3, 'la tabla sigue con sus 3 filas');

  /* 5) crear */
  r = await bs('POST', { _accion: 'guardar', clave: 'bs_quejas', op: 'crear', datos: { fecha_recepcion: '2026-11-08', clasificacion: 'HALLAZGO', canal: 'Buzón', detalle: 'Nuevo <b>hallazgo</b>', empresa: 'RAPEL', cantidad_quejas: '3', campo_que_no_existe: 'zz', id: 999, created_by: 'hacker' } }, { usuario: 'ovilela', rol: 'administrador' });
  assert(r.status === 200 && r.body.id === 8, 'crear → id 8 (max 7 + 1): ' + JSON.stringify(r.body));
  r = await A.llamar('bs', { method: 'GET', bindingData: { accion: 'tabla' }, query: { clave: 'bs_quejas' } });
  const n8 = r.body.items.find(o => Number(o.id) === 8);
  assert(r.body.total === 4 && n8 && n8.fecha_recepcion === '2026-11-08' && n8.created_by === 'ovilela' && n8.cantidad_quejas === 3 && n8.campo_que_no_existe === undefined, 'bs/tabla ve la fila nueva al instante (marca renovada): ' + JSON.stringify(n8).slice(0, 160));

  /* 6) actualizar */
  r = await bs('POST', { _accion: 'guardar', clave: 'bs_quejas', op: 'actualizar', id: 8, datos: { resultado: 'Cerrado', detalle: 'editado', id: 5 } }, { usuario: 'ovilela', rol: 'administrador' });
  assert(r.status === 200 && r.body.cambios === 2, 'actualizar → 2 cambios: ' + JSON.stringify(r.body));
  r = await bs('POST', { _accion: 'guardar', clave: 'bs_quejas', op: 'actualizar', id: 777, datos: { resultado: 'x' } }, { usuario: 'ovilela', rol: 'administrador' });
  assert(r.status === 404, 'actualizar id inexistente → 404');

  /* 7) seguimiento (numero consecutivo dentro del caso, padre updated_at) */
  r = await bs('POST', { _accion: 'guardar', clave: 'bs_quejas_seguim', op: 'seguimiento', id: 7, datos: { detalle: 'segundo', fecha_seguimiento: '2026-11-08' } }, { usuario: 'ovilela', rol: 'administrador' });
  assert(r.status === 200 && r.body.numero === 2 && r.body.id === 2, 'seguimiento del caso 7 → #2: ' + JSON.stringify(r.body));
  r = await bs('POST', { _accion: 'guardar', clave: 'bs_quejas_seguim', op: 'seguimiento', id: 8, datos: { detalle: 'primero del 8', fecha_seguimiento: '2026-11-08' } }, { usuario: 'ovilela', rol: 'administrador' });
  assert(r.status === 200 && r.body.numero === 1, 'seguimiento del caso 8 → #1');
  r = await A.llamar('bs', { method: 'GET', bindingData: { accion: 'tabla' }, query: { clave: 'bs_quejas_seguim' } });
  assert(r.body.total === 3, 'seguimientos: 3 filas');

  /* 8) anular / restaurar (crea la columna anulado en el encabezado; bs/tabla oculta anulados) */
  r = await bs('POST', { _accion: 'guardar', clave: 'bs_quejas', op: 'anular', id: 2, motivo: 'duplicado' }, { usuario: 'rperez', rol: 'usuario' });
  assert(r.status === 403, 'anular sin permiso del módulo → 403');
  r = await bs('POST', { _accion: 'guardar', clave: 'bs_quejas', op: 'anular', id: 2 }, { usuario: 'ovilela', rol: 'administrador' });
  assert(r.status === 400, 'anular sin motivo → 400');
  r = await bs('POST', { _accion: 'guardar', clave: 'bs_quejas', op: 'anular', id: 2, motivo: 'duplicado' }, { usuario: 'ovilela', rol: 'administrador' });
  assert(r.status === 200, 'anular #2: ' + r.body.message);
  r = await bs('POST', { _accion: 'guardar', clave: 'bs_quejas', op: 'anular', id: 2, motivo: 'otra vez' }, { usuario: 'ovilela', rol: 'administrador' });
  assert(r.status === 409, 'anular dos veces → 409: ' + r.body.message);
  r = await A.llamar('bs', { method: 'GET', bindingData: { accion: 'tabla' }, query: { clave: 'bs_quejas' } });
  assert(r.body.total === 3 && !r.body.items.find(o => Number(o.id) === 2), 'bs/tabla oculta el anulado (3 visibles)');
  r = await A.llamar('tablas-hoja', { method: 'GET', bindingData: { clave: 'bs_quejas', accion: 'leer' }, query: {} });
  const iA = r.body.encabezado.indexOf('anulado'), f2 = r.body.filas.find(f => Number(f[0]) === 2);
  assert(iA === encQ.length && /^SI · ovilela · \d\d\/\d\d\/\d{4} \d\d:\d\d · duplicado$/.test(f2[iA]), 'columna anulado al final con la marca como Google: ' + f2[iA]);
  r = await bs('POST', { _accion: 'guardar', clave: 'bs_quejas', op: 'actualizar', id: 2, datos: { resultado: 'x' } }, { usuario: 'ovilela', rol: 'administrador' });
  assert(r.status === 409, 'editar un anulado → 409');
  r = await bs('POST', { _accion: 'guardar', clave: 'bs_quejas', op: 'restaurar', id: 2 }, { usuario: 'ovilela', rol: 'administrador' });
  assert(r.status === 200, 'restaurar #2');
  r = await A.llamar('bs', { method: 'GET', bindingData: { accion: 'tabla' }, query: { clave: 'bs_quejas' } });
  assert(r.body.total === 4, 'vuelve a verse (4)');

  /* 9) auditoría: una fila por operación + evento suelto del Apps Script (clave interna) + inmutable */
  process.env.INTERNAL_API_KEY = 'clave-interna-prueba';
  r = await A.llamar('bs', { method: 'POST', headers: { 'x-functions-key': 'clave-interna-prueba' }, bindingData: { accion: 'auditar' }, body: { usuario: 'rperez', accion: 'crear', modulo: 'subsidios', registro_id: 44, detalle: 'desde Google' } });
  assert(r.status === 200 && r.body.ok, 'bs/auditar con clave interna');
  r = await A.llamar('bs', { method: 'POST', bindingData: { accion: 'auditar' }, body: { usuario: 'otro', accion: 'ACCESO', modulo: 'panel' }, usuario: { usuario: 'ovilela', rol: 'usuario' } });
  assert(r.status === 200, 'bs/auditar con sesión');
  r = await A.llamar('bs', { method: 'GET', bindingData: { accion: 'tabla' }, query: { clave: 'bs_auditoria', hora: '1' } });
  const acc = r.body.items.map(o => o.accion + ':' + o.usuario + ':' + o.registro_id);
  assert(r.body.total === 1 + 6 + 2, 'auditoría: 9 filas (1 inicial + 6 operaciones + 2 eventos) → ' + acc.join(' | '));
  assert(r.body.items.find(o => o.accion === 'ACCESO').usuario === 'ovilela', 'con sesión el usuario es el del token (no el del cuerpo)');
  const { Client } = require('pg'); const c = new Client({ connectionString: process.env.SUPABASE_DB_URL }); await c.connect(); await c.query('SET search_path TO rl, extensions');
  let err = ''; try { await c.query('DELETE FROM bs_auditoria WHERE fila = 1'); } catch (e) { err = e.message; } assert(/inmutable/.test(err), 'DELETE en bs_auditoria bloqueado: ' + err);
  err = ''; try { await c.query("UPDATE bs_auditoria SET detalle = 'x' WHERE fila = 1"); } catch (e) { err = e.message; } assert(/inmutable/.test(err), 'UPDATE bloqueado');
  await c.end();
  r = await hoja('bs_auditoria', ['fecha', 'usuario', 'accion', 'modulo', 'registro_id', 'detalle'], [[cel(new Date()), 'x', 'CREAR', 'quejas', 1, '']]);
  assert(r.status === 409, 'la hoja ya no reemplaza bs_auditoria');

  /* 10) tablas nuevas sin carga previa: crear arma el encabezado inicial */
  r = await bs('POST', { _accion: 'fuente', clave: 'bs_rendiciones', fuente: 'supabase' });
  r = await bs('POST', { _accion: 'guardar', clave: 'bs_rendiciones', op: 'crear', datos: { fecha: '2026-11-08', semana: 45, anio: 2026, rendicion: 'R-1', empresa: 'VERFRUT', monto_total: '150.50', estado: 'Pendiente' } }, { usuario: 'ovilela', rol: 'administrador' });
  assert(r.status === 200 && r.body.id === 1, 'rendición #1 en tabla nueva');
  r = await A.llamar('bs', { method: 'GET', bindingData: { accion: 'tabla' }, query: { clave: 'bs_rendiciones' } });
  assert(r.body.total === 1 && r.body.items[0].monto_total === 150.5 && r.body.items[0].semana === 45, 'bs/tabla rendiciones: ' + JSON.stringify(r.body.items[0]).slice(0, 140));
  r = await A.llamar('bs', { method: 'GET', bindingData: { accion: 'estado' }, query: {} });
  assert(r.body.tablas.length === 13, 'bs/estado lista 13 tablas');
  /* permisos: usuario sin acceso al módulo */
  r = await bs('POST', { _accion: 'guardar', clave: 'bs_quejas', op: 'crear', datos: { detalle: 'x' } }, { usuario: 'rperez', rol: 'usuario' });
  assert(r.status === 403, 'usuario sin permiso del módulo → 403: ' + r.body.message);
  /* 11) módulo Hallazgos: anulados=1, defaults de crear, cierre masivo */
  r = await bs('POST', { _accion: 'guardar', clave: 'bs_quejas', op: 'anular', id: 7, motivo: 'prueba vista' }, { usuario: 'ovilela', rol: 'administrador' });
  r = await A.llamar('bs', { method: 'GET', bindingData: { accion: 'tabla' }, query: { clave: 'bs_quejas', anulados: '1' } });
  const a3 = r.body.items.find(o => Number(o.id) === 7);
  assert(r.body.total === 4 && a3 && /^SI · ovilela/.test(a3.anulado), 'bs/tabla anulados=1 incluye el anulado con su marca: ' + (a3 && a3.anulado));
  r = await bs('POST', { _accion: 'guardar', clave: 'bs_quejas', op: 'crear', datos: { clasificacion: 'QUEJA', detalle: 'sin fecha ni resultado', empresa: 'VERFRUT', cantidad_quejas: 'abc' } }, { usuario: 'ovilela', rol: 'administrador' });
  r = await A.llamar('bs', { method: 'GET', bindingData: { accion: 'tabla' }, query: { clave: 'bs_quejas' } });
  const n9 = r.body.items.find(o => Number(o.id) === 9);
  assert(n9 && n9.resultado === 'En proceso' && n9.seguimiento === 'No' && /^\d{4}-\d{2}-\d{2}$/.test(n9.fecha_recepcion) && n9.cantidad_quejas === 0, 'defaults al crear (En proceso / No / hoy / 0): ' + JSON.stringify([n9.resultado, n9.seguimiento, n9.fecha_recepcion, n9.cantidad_quejas]));
  r = await bs('POST', { _accion: 'guardar', clave: 'bs_quejas_seguim', op: 'seguimiento', id: 9, datos: { detalle: '' } }, { usuario: 'ovilela', rol: 'administrador' });
  assert(r.status === 400 && /Completa fecha y detalle/.test(r.body.message), 'seguimiento sin detalle → "Completa fecha y detalle"');
  r = await bs('POST', { _accion: 'guardar', clave: 'bs_quejas', op: 'cierre_masivo', fecha_corte: '2026-11-05', simular: true }, { usuario: 'ovilela', rol: 'administrador' });
  assert(r.status === 200 && r.body.simulado && r.body.total === 2, 'cierre masivo simulado: 2 (ids 1 y 2; #7 anulado, #8 y #9 de hoy) → ' + JSON.stringify(r.body));
  r = await bs('POST', { _accion: 'guardar', clave: 'bs_quejas', op: 'cierre_masivo', fecha_corte: '2026-11-05', motivo: 'xx' }, { usuario: 'ovilela', rol: 'administrador' });
  assert(r.status === 400, 'cierre masivo con motivo corto → 400');
  r = await bs('POST', { _accion: 'guardar', clave: 'bs_quejas', op: 'cierre_masivo', fecha_corte: '2026-11-05', motivo: 'depuración anual' }, { usuario: 'ovilela', rol: 'usuario' });
  assert(r.status === 403, 'cierre masivo no admin → 403');
  r = await bs('POST', { _accion: 'guardar', clave: 'bs_quejas', op: 'cierre_masivo', fecha_corte: '2026-11-05', motivo: 'depuración anual' }, { usuario: 'ovilela', rol: 'administrador' });
  assert(r.status === 200 && r.body.total === 2, 'cierre masivo real: 2 cerrados');
  r = await A.llamar('bs', { method: 'GET', bindingData: { accion: 'tabla' }, query: { clave: 'bs_quejas' } });
  const c1 = r.body.items.find(o => Number(o.id) === 1);
  assert(c1.resultado === 'Cerrado' && /Cierre masivo .* por ovilela: depuración anual/.test(c1.observaciones), 'la #1 quedó Cerrado con sello: ' + c1.observaciones);
  r = await A.llamar('bs', { method: 'GET', bindingData: { accion: 'tabla' }, query: { clave: 'bs_auditoria', hora: '1' } });
  assert(r.body.items.some(o => o.registro_id === 'masivo' || o.registro_id === 'masivo'), 'auditoría del cierre masivo (registro_id masivo)');
  /* 12) módulo Accidentes: defaults, seguimiento con contador, importación upsert */
  for (const k of ['bs_accidentes_casos', 'bs_accidentes_seguim']) { r = await bs('POST', { _accion: 'fuente', clave: k, fuente: 'supabase' }); assert(r.status === 200, 'fuente ' + k); }
  r = await bs('POST', { _accion: 'guardar', clave: 'bs_accidentes_casos', op: 'crear', datos: { dni: '44556677', nombre: 'PRUEBA UNO', edad: '34', fundo: 'F1', empresa: 'RAPEL', dia_accidente: '2026-11-02', dias_restriccion: '', accidente_horas: '1,5' } }, { usuario: 'ovilela', rol: 'administrador' });
  assert(r.status === 200 && r.body.id === 1, 'accidente #1 creado: ' + JSON.stringify(r.body));
  r = await A.llamar('bs', { method: 'GET', bindingData: { accion: 'tabla' }, query: { clave: 'bs_accidentes_casos' } });
  const ac1 = r.body.items[0];
  assert(ac1.estado_caso === 'Activo' && ac1.edad === 34 && ac1.dias_restriccion === 0 && ac1.numero_atenciones === 0 && ac1.accidente_horas === 1.5 && ac1.dia_accidente === '2026-11-02', 'defaults accidente: ' + JSON.stringify([ac1.estado_caso, ac1.edad, ac1.dias_restriccion, ac1.numero_atenciones, ac1.accidente_horas, ac1.dia_accidente]));
  r = await bs('POST', { _accion: 'guardar', clave: 'bs_accidentes_seguim', op: 'seguimiento', id: 1, datos: { detalle: 'control', fecha_seguimiento: '2026-11-08' } }, { usuario: 'ovilela', rol: 'administrador' });
  assert(r.status === 200 && r.body.numero === 1, 'seguimiento accidente #1 → #1');
  r = await A.llamar('bs', { method: 'GET', bindingData: { accion: 'tabla' }, query: { clave: 'bs_accidentes_casos' } });
  assert(r.body.items[0].numero_atenciones === 1, 'numero_atenciones del caso pasa a 1');
  r = await bs('POST', { _accion: 'guardar', clave: 'bs_accidentes_casos', op: 'importar', filas: [
    { dni: '44556677', nombre: 'PRUEBA UNO EDITADO', empresa: 'RAPEL', dia_accidente: '2026-11-02', fundo: 'F9' },
    { dni: '11223344', nombre: 'PRUEBA DOS', empresa: 'VERFRUT', dia_accidente: '2026-10-30', edad: '41' },
    { dni: '', nombre: 'SIN DNI', empresa: 'VERFRUT', dia_accidente: '2026-10-30' }
  ] }, { usuario: 'ovilela', rol: 'administrador' });
  assert(r.status === 200 && r.body.creados === 1 && r.body.actualizados === 1 && r.body.errores.length === 1, 'importar upsert: 1 nuevo, 1 actualizado, 1 error → ' + JSON.stringify(r.body));
  r = await A.llamar('bs', { method: 'GET', bindingData: { accion: 'tabla' }, query: { clave: 'bs_accidentes_casos' } });
  const u1 = r.body.items.find(o => o.id === 1), n2 = r.body.items.find(o => o.id === 2);
  assert(r.body.total === 2 && u1.fundo === 'F9' && u1.numero_atenciones === 1 && n2.dni === '11223344' && n2.edad === 41 && n2.estado_caso === 'Activo', 'tras importar: #1 editado conserva atenciones, #2 nuevo con defaults');
  r = await A.llamar('bs', { method: 'GET', bindingData: { accion: 'tabla' }, query: { clave: 'bs_auditoria', hora: '1' } });
  assert(r.body.items.some(o => o.accion === 'IMPORTAR' && o.modulo === 'accidentes'), 'auditoría IMPORTAR accidentes');
  /* 13) módulo Subsidios: defaults, importación upsert por expediente / numero|anio|tipo|periodo, clave interna */
  r = await bs('POST', { _accion: 'fuente', clave: 'bs_subsidios', fuente: 'supabase' }); assert(r.status === 200, 'fuente bs_subsidios');
  r = await bs('POST', { _accion: 'guardar', clave: 'bs_subsidios', op: 'crear', datos: { numero: '07123456', apellido_paterno: 'PEREZ', nombres: 'ANA', tipo: 'INCAPACIDAD TEMPORAL', dias: '12.5', monto_total: '1,250.50', expediente: 'EXP-001', empresa: 'RAPEL' } }, { usuario: 'ovilela', rol: 'administrador' });
  assert(r.status === 200 && r.body.id === 1, 'subsidio #1');
  r = await A.llamar('bs', { method: 'GET', bindingData: { accion: 'tabla' }, query: { clave: 'bs_subsidios' } });
  const s1 = r.body.items[0];
  assert(s1.anio === 2026 && s1.estado_general === 'En proceso' && s1.dias === 12.5 && s1.pago_empresa === 0 && s1.numero === '07123456', 'defaults subsidio (anio actual, En proceso, 0, numero con cero): ' + JSON.stringify([s1.anio, s1.estado_general, s1.dias, s1.pago_empresa, s1.numero, s1.monto_total]));
  r = await bs('POST', { _accion: 'guardar', clave: 'bs_subsidios', op: 'importar', modo: 'upsert', filas: [
    { expediente: 'exp-001', estado: 'Pagado', monto_total: '', recuperado_essalud: '900' },
    { numero: '11112222', anio: '2026', tipo: 'MATERNIDAD', periodo: 'ENERO', nombres: 'LUZ', dias: '98' },
    { numero: '11112222', anio: '2026', tipo: 'MATERNIDAD', periodo: 'ENERO', nombres: 'LUZ MARIA' },
    { descripcion: 'sin llave' }
  ] }, { usuario: 'ovilela', rol: 'administrador' });
  assert(r.status === 200 && r.body.actualizados === 1 && r.body.creados === 2 && r.body.errores.length === 1 && /repetida/.test(r.body.errores[0].error), 'importar subsidios: 1 actualizado (EXP), 2 creados, 1 repetida → ' + JSON.stringify(r.body));
  r = await A.llamar('bs', { method: 'GET', bindingData: { accion: 'tabla' }, query: { clave: 'bs_subsidios' } });
  const e1 = r.body.items.find(o => o.id === 1);
  assert(e1.estado === 'Pagado' && e1.monto_total === 1250.5 && e1.recuperado_essalud === 900 && e1.apellido_paterno === 'PEREZ', 'upsert por expediente: cambia estado/recuperado, conserva monto y apellido: ' + JSON.stringify([e1.estado, e1.monto_total, e1.recuperado_essalud]));
  r = await bs('POST', { _accion: 'guardar', clave: 'bs_subsidios', op: 'importar', modo: 'solo_agregar', filas: [{ expediente: 'EXP-001', nombres: 'OTRA' }] }, { usuario: 'ovilela', rol: 'administrador' });
  assert(r.status === 200 && r.body.creados === 1, 'modo solo_agregar crea aunque exista la llave');
  /* clave interna (Apps Script: generar subsidio desde descanso) */
  r = await A.llamar('bs', { method: 'POST', headers: { 'x-functions-key': 'clave-interna-prueba' }, bindingData: { accion: 'guardar' }, body: { clave: 'bs_subsidios', op: 'crear', usuario: 'rperez', datos: { numero: '33334444', tipo: 'INCAPACIDAD TEMPORAL', observaciones: 'Generado desde Descanso Médico #5' } } });
  assert(r.status === 200 && r.body.ok, 'bs/guardar con clave interna y usuario en el cuerpo');
  r = await A.llamar('bs', { method: 'POST', headers: { 'x-functions-key': 'clave-interna-prueba' }, bindingData: { accion: 'guardar' }, body: { clave: 'bs_subsidios', op: 'crear', datos: { numero: '1' } } });
  assert(r.status === 401, 'clave interna sin usuario → 401');
  r = await A.llamar('bs', { method: 'GET', bindingData: { accion: 'tabla' }, query: { clave: 'bs_subsidios' } });
  assert(r.body.total === 5 && r.body.items.find(o => o.numero === '33334444').created_by === 'rperez', 'subsidios: 5 filas, autor del interno = rperez');
  /* 14) Hostigamiento: dos tablas, correlativo independiente, sede forzada, OLMOS sin carga previa */
  for (const k of ['bs_hostigamiento', 'bs_hostigamiento_olmos']) { r = await bs('POST', { _accion: 'fuente', clave: k, fuente: 'supabase' }); assert(r.status === 200, 'fuente ' + k); }
  r = await bs('POST', { _accion: 'guardar', clave: 'bs_hostigamiento', op: 'crear', datos: { denunciante_nombre: 'A', denunciado_nombre: 'B', empresa: 'RAPEL', sede: 'OLMOS' } }, { usuario: 'ovilela', rol: 'administrador' });
  assert(r.status === 200 && r.body.id === 1, 'denuncia PIURA #1');
  r = await bs('POST', { _accion: 'guardar', clave: 'bs_hostigamiento_olmos', op: 'crear', datos: { denunciante_nombre: 'C', empresa: 'VERFRUT' } }, { usuario: 'ovilela', rol: 'administrador' });
  assert(r.status === 200 && r.body.id === 1, 'denuncia OLMOS #1 (correlativo independiente, tabla sin carga previa)');
  r = await A.llamar('bs', { method: 'GET', bindingData: { accion: 'tabla' }, query: { clave: 'bs_hostigamiento', anulados: '1' } });
  const h1 = r.body.items[0];
  assert(h1.sede === 'PIURA' && h1.status === 'En investigación' && /^\d{4}-\d{2}-\d{2}$/.test(h1.fecha_denuncia), 'PIURA: sede forzada por tabla, status y fecha por defecto: ' + JSON.stringify([h1.sede, h1.status, h1.fecha_denuncia]));
  r = await A.llamar('bs', { method: 'GET', bindingData: { accion: 'tabla' }, query: { clave: 'bs_hostigamiento_olmos' } });
  assert(r.body.total === 1 && r.body.items[0].sede === 'OLMOS' && r.body.items[0].denunciante_nombre === 'C', 'OLMOS: 1 fila con sede OLMOS');
  r = await bs('POST', { _accion: 'guardar', clave: 'bs_hostigamiento', op: 'crear', datos: { denunciante_nombre: 'X' } }, { usuario: 'rperez', rol: 'usuario' });
  assert(r.status === 403, 'hostigamiento sin permiso → 403');
  /* 15) Descansos médicos: validación, días/estado calculados, generar subsidio */
  r = await bs('POST', { _accion: 'fuente', clave: 'bs_descansos', fuente: 'supabase' }); assert(r.status === 200, 'fuente bs_descansos');
  const adm = { usuario: 'ovilela', rol: 'administrador' };
  r = await bs('POST', { _accion: 'guardar', clave: 'bs_descansos', op: 'crear', datos: { dni: '123', nombre: 'x', empresa: 'RAPEL', fecha_inicio: '2026-10-01', fecha_fin: '2026-10-05' } }, adm);
  assert(r.status === 400 && /DNI inválido/.test(r.body.message), 'descanso: DNI inválido → 400');
  r = await bs('POST', { _accion: 'guardar', clave: 'bs_descansos', op: 'crear', datos: { dni: '44556677', nombre: 'perez ruiz juan', empresa: 'RAPEL', fecha_inicio: '2026-10-10', fecha_fin: '2026-10-01' } }, adm);
  assert(r.status === 400 && /anterior/.test(r.body.message), 'descanso: fin < inicio → 400');
  r = await bs('POST', { _accion: 'guardar', clave: 'bs_descansos', op: 'crear', datos: { dni: '44556677', nombre: 'perez ruiz juan', empresa: 'RAPEL', fecha_inicio: '2026-10-01', fecha_fin: '2026-10-15', cie10: 'j06', diagnostico: 'gripe' } }, adm);
  assert(r.status === 200 && r.body.dias === 15 && r.body.estado === 'Concluido', 'descanso #1: 15 días, Concluido → ' + JSON.stringify(r.body));
  r = await A.llamar('bs', { method: 'GET', bindingData: { accion: 'tabla' }, query: { clave: 'bs_descansos' } });
  const d1 = r.body.items[0];
  assert(d1.nombre === 'PEREZ RUIZ JUAN' && d1.cie10 === 'J06' && d1.tipo === 'Enfermedad común' && d1.origen === 'Particular' && d1.citt_estado === 'Pendiente de canje' && d1.dias === 15, 'defaults descanso: ' + JSON.stringify([d1.nombre, d1.cie10, d1.tipo, d1.origen, d1.citt_estado, d1.dias]));
  r = await bs('POST', { _accion: 'guardar', clave: 'bs_descansos', op: 'generar_subsidio', id: 1 }, adm);
  assert(r.status === 409 && /Canjeado/.test(r.body.message), 'generar subsidio sin CITT canjeado → 409');
  r = await bs('POST', { _accion: 'guardar', clave: 'bs_descansos', op: 'actualizar', id: 1, datos: { citt_estado: 'Canjeado', fecha_fin: '2026-10-20' } }, adm);
  assert(r.status === 200 && r.body.dias === 20, 'actualizar recalcula días (20): ' + JSON.stringify(r.body));
  r = await bs('POST', { _accion: 'guardar', clave: 'bs_descansos', op: 'generar_subsidio', id: 1 }, adm);
  assert(r.status === 409 && /no hay días subsidiables/.test(r.body.message), '20 días acumulados no superan el umbral → 409');
  r = await bs('POST', { _accion: 'guardar', clave: 'bs_descansos', op: 'crear', datos: { dni: '44556677', nombre: 'PEREZ RUIZ JUAN', empresa: 'RAPEL', fecha_inicio: '2026-11-01', fecha_fin: '2026-11-07', origen: 'EsSalud', citt_numero: 'CITT-9' } }, adm);
  assert(r.status === 200 && r.body.id === 2 && r.body.dias === 7, 'descanso #2: 7 días (origen EsSalud → Canjeado)');
  const nSubAntes = (await A.llamar('bs', { method: 'GET', bindingData: { accion: 'tabla' }, query: { clave: 'bs_subsidios' } })).body.total;
  r = await bs('POST', { _accion: 'guardar', clave: 'bs_descansos', op: 'generar_subsidio', id: 2 }, adm);
  assert(r.status === 200 && r.body.dias === 7 && r.body.id_subsidio === nSubAntes + 1, 'genera subsidio: 20+7-20 = 7 días subsidiables → ' + JSON.stringify(r.body));
  r = await A.llamar('bs', { method: 'GET', bindingData: { accion: 'tabla' }, query: { clave: 'bs_subsidios' } });
  const sb = r.body.items.find(o => o.id === nSubAntes + 1);
  assert(sb && sb.tipo === 'INCAPACIDAD TEMPORAL' && sb.numero === '44556677' && sb.apellido_paterno === 'PEREZ' && sb.nombres === 'JUAN' && sb.dias === 7 && sb.inicio === '2026-11-01' && sb.expediente === 'CITT-9' && sb.mes === 'NOVIEMBRE', 'subsidio generado con los datos del DM: ' + JSON.stringify([sb.tipo, sb.numero, sb.apellido_paterno, sb.nombres, sb.dias, sb.inicio, sb.mes]));
  r = await A.llamar('bs', { method: 'GET', bindingData: { accion: 'tabla' }, query: { clave: 'bs_descansos' } });
  assert(String(r.body.items.find(o => String(o.id) === '2').id_subsidio) === String(nSubAntes + 1), 'el descanso #2 apunta al subsidio');
  r = await bs('POST', { _accion: 'guardar', clave: 'bs_descansos', op: 'generar_subsidio', id: 2 }, adm);
  assert(r.status === 409 && /ya tiene el subsidio/.test(r.body.message), 'no genera dos veces');
  /* 16) Rendiciones y Sugerencias */
  for (const k of ['bs_sugerencias']) { r = await bs('POST', { _accion: 'fuente', clave: k, fuente: 'supabase' }); assert(r.status === 200, 'fuente ' + k); }
  r = await bs('POST', { _accion: 'guardar', clave: 'bs_rendiciones', op: 'crear', datos: { rendicion: 'R-2', empresa: 'VERFRUT', monto_bienestar: '100', monto_total: '100', semana: '46' } }, adm);
  assert(r.status === 200 && r.body.id === 2, 'rendición #2');
  r = await A.llamar('bs', { method: 'GET', bindingData: { accion: 'tabla' }, query: { clave: 'bs_rendiciones' } });
  const rd = r.body.items.find(o => o.id === 2);
  assert(rd.estado === 'NO DEPOSITADO' && rd.anio === 2026 && rd.semana === 46 && rd.monto_reclutamiento === 0 && /^\d{4}-\d{2}-\d{2}$/.test(rd.fecha), 'defaults rendición: ' + JSON.stringify([rd.estado, rd.anio, rd.semana, rd.monto_reclutamiento, rd.fecha]));
  r = await bs('POST', { _accion: 'guardar', clave: 'bs_rendiciones', op: 'eliminar', id: 2 }, adm);
  assert(r.status === 200, 'eliminar rendición → queda anulada');
  r = await A.llamar('bs', { method: 'GET', bindingData: { accion: 'tabla' }, query: { clave: 'bs_rendiciones' } });
  assert(!r.body.items.find(o => o.id === 2), 'la rendición eliminada ya no se lista');
  r = await bs('POST', { _accion: 'guardar', clave: 'bs_sugerencias', op: 'crear', datos: { titulo: 'Mejorar X', modulo: 'quejas', descripcion: 'detalle', nombre_usuario: 'Ovidio', usuario: 'hacker', estado: 'Finalizada' } }, adm);
  assert(r.status === 200 && r.body.id === 1, 'sugerencia #1');
  r = await A.llamar('bs', { method: 'GET', bindingData: { accion: 'tabla' }, query: { clave: 'bs_sugerencias' } });
  const sg = r.body.items[0];
  assert(sg.usuario === 'ovilela' && sg.estado === 'Recibida' && sg.prioridad === 'Media' && sg.fecha_finalizado === '' , 'defaults sugerencia (usuario del token, Recibida, Media): ' + JSON.stringify([sg.usuario, sg.estado, sg.prioridad, sg.fecha_finalizado]));
  r = await bs('POST', { _accion: 'guardar', clave: 'bs_sugerencias', op: 'actualizar', id: 1, datos: { estado: 'Finalizada', respuesta_admin: 'Listo' } }, adm);
  r = await A.llamar('bs', { method: 'GET', bindingData: { accion: 'tabla' }, query: { clave: 'bs_sugerencias' } });
  assert(/^\d{4}-\d{2}-\d{2}$/.test(r.body.items[0].fecha_finalizado) && r.body.items[0].respuesta_admin === 'Listo', 'Finalizada pone fecha_finalizado');
  console.log(process.exitCode ? 'HAY FALLAS' : 'TODO OK');
  process.exit();
})().catch(e => { console.error('ERROR', e); process.exit(1); });
