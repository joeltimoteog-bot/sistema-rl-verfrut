const A = require('./arnes-edge.js');
const assert = (c, m) => { if (!c) { console.log('   ✗ ' + m); process.exitCode = 1; } else console.log('   ✓ ' + m); };
(async () => {
  const { Client } = require('pg'); const c = new Client({ connectionString: process.env.SUPABASE_DB_URL }); await c.connect(); await c.query('SET search_path TO rl, extensions');
  const call = (accion, body, usuario) => A.llamar('e360-guardar', { method: 'POST', bindingData: { accion }, body: body || {}, usuario: usuario || { usuario: 'jtimoteo', rol: 'administrador' } });
  let r = await call('e360Programa');
  assert(r.status === 200 && r.body.dia_inicio === 16 && r.body.frecuencia === 'mensual' && r.body.evaluadores.indexOf('jtimoteo') >= 0, 'programa por defecto: ' + JSON.stringify(r.body));
  r = await call('e360Programa', { dia_inicio: 40 }); assert(r.status === 400, 'dia_inicio inválido → 400');
  r = await call('e360Programa', { dia_inicio: 1, evaluadores: ['lcovenas'] }); assert(r.status === 200 && r.body.dia_inicio === 1 && r.body.evaluadores.join() === 'jtimoteo,lcovenas', 'programa cambiado (jtimoteo siempre incluido): ' + JSON.stringify(r.body.evaluadores));
  r = await call('e360Programa', { dia_inicio: 1 }, { usuario: 'ovilela', rol: 'administrador' }); assert(r.status === 403, 'otro usuario no cambia la programación');
  /* personas KPI de prueba */
  await c.query("INSERT INTO kpi_personas (usuario, dni, nombre, empresa, tipo, puesto, orden, activo) VALUES ('rperez','1','PEREZ RUIZ ROBERTO','RAPEL','SUP','Supervisor GH',1,1), ('aquispe','2','QUISPE LOPEZ ANA','VERFRUT','ASIST','Asistente RR.LL.',2,1), ('bbien','3','BIENESTAR PERSONA','RAPEL','BIEN','Bienestar',3,1), ('xinact','4','INACTIVO UNO','RAPEL','SUP','Supervisor',4,0) ON CONFLICT (usuario) DO NOTHING");
  r = await call('e360Pendientes');
  const per = new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 7);
  const noms = r.body.pendientes.map(p => p.nombre);
  assert(r.status === 200 && r.body.periodo === per && noms.indexOf('PEREZ RUIZ ROBERTO') >= 0 && noms.indexOf('QUISPE LOPEZ ANA') >= 0 && noms.indexOf('BIENESTAR PERSONA') < 0 && noms.indexOf('INACTIVO UNO') < 0 && r.body.evaluador_autorizado === true, 'pendientes: incluye SUP y ASIST activos, excluye Bienestar e inactivos (' + noms.length + ' en total), periodo ' + per);
  const antes = noms.length;
  /* tabla de evaluaciones cargada (vacía) con el encabezado de la hoja */
  const enc = ['ID','Fecha','Evaluador','Supervisor','Empresa','Sector','Liderazgo','Comunicación','Cumplimiento','Gestión de Equipo','Resolución de Problemas','Planificación','Total','Porcentaje','Clasificación','Observaciones','Recomendaciones','Usuario Registro','Fecha Registro','Periodo','Detalle'];
  await A.llamar('tablas-hoja', { bindingData: { clave: 'e360_evaluaciones', accion: 'inicio' }, body: {} });
  await A.llamar('tablas-hoja', { bindingData: { clave: 'e360_evaluaciones', accion: 'fin' }, body: { encabezado: enc, ancho: enc.length, total: 0 } });
  r = await call('e360Pendientes', {}, { usuario: 'ovilela', rol: 'administrador' });
  assert(r.body.evaluador_autorizado === false, 'ovilela no es evaluador autorizado');
  /* una evaluación guardada del periodo quita a la persona de pendientes */
  await c.query("UPDATE cv_estado SET valor='1' WHERE clave='e360_azure_primero'"); await c.query("INSERT INTO cv_estado (clave, valor) SELECT 'e360_azure_primero','1' WHERE NOT EXISTS (SELECT 1 FROM cv_estado WHERE clave='e360_azure_primero')");
  r = await call('saveEvaluacion360', { client_id: 'p1', supervisor: 'Roberto Perez Ruiz', empresa: 'RAPEL', fecha: per + '-16', evaluador: 'Joel', competencias: [{ nombre: 'Liderazgo', promedio: 4 }], total: 80, porcentaje: 80, clasificacion: 'Bueno', obs: '' });
  assert(r.status === 200 && r.body.success, 'saveEvaluacion360 guardó: ' + JSON.stringify(r.body).slice(0, 120));
  r = await call('e360Pendientes');
  const desp = r.body.pendientes.map(p => p.nombre);
  assert(r.body.hechas === 1 && desp.length === antes - 1 && desp.indexOf('PEREZ RUIZ ROBERTO') < 0 && desp.indexOf('QUISPE LOPEZ ANA') >= 0, 'tras evaluar a "Roberto Perez Ruiz" (otro orden de nombre) sale de pendientes y Quispe sigue');
  await c.query("DELETE FROM kpi_personas WHERE usuario IN ('rperez','aquispe','bbien','xinact')"); await c.end();
  console.log(process.exitCode ? 'HAY FALLAS' : 'TODO OK'); process.exit();
})().catch(e => { console.error('ERROR', e); process.exit(1); });
