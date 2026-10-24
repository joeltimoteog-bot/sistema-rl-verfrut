/* dashboard.html · bloque 28 (antes en la linea 14476) · extraido el 24-oct-2026 sin cambios (_MODULAR_V1) */

(function(){
'use strict';
if(window._rlAsisListo)return; window._rlAsisListo=true;

/* ── 1) Columna vertical de botones flotantes ─────────────────────────── */
function columna(){
  var col=document.getElementById('rlFabCol');
  if(!col){col=document.createElement('div');col.id='rlFabCol';document.body.appendChild(col);}
  return col;
}
function acomodar(){
  try{
    var col=columna();
    // Orden visual (de arriba hacia abajo): 🤖 Asistente · 💬 Coordinación · WhatsApp
    var asis=document.getElementById('rlAsisBtn');
    var chat=document.getElementById('_rlChatBtn');
    var wa=document.querySelector('a[href^="https://wa.me/"][title="Consultas al Administrador"]');
    [asis,chat,wa].forEach(function(el){ if(el&&el.parentNode!==col) col.appendChild(el); });
    // Reordenar por si presencia.js creó su botón después
    [asis,chat,wa].forEach(function(el){ if(el) col.appendChild(el); });
    // Al abrir 💬 se cierra el asistente (y viceversa): un solo panel a la vez
    if(chat&&!chat._rlAsisHook){ chat._rlAsisHook=true; chat.addEventListener('click',function(){ var p=document.getElementById('rlAsisPanel'); if(p)p.classList.remove('on'); },true); }
  }catch(e){}
}
function crearBoton(){
  if(document.getElementById('rlAsisBtn'))return;
  var b=document.createElement('button');
  b.id='rlAsisBtn';b.type='button';b.title='Asistente RR.LL. — dudas y consultas de tus módulos';
  b.innerHTML='🤖<span class="rlAsisDot"></span>';
  b.addEventListener('click',toggle);
  columna().appendChild(b);
}

/* ── 2) Base de conocimiento por módulo (guion, sin IA) ────────────────── */
// nav: id del botón del menú (o texto) para saber si el usuario lo tiene asignado e "Ir al módulo"
var MODS=[
 {k:'dashboard',t:'📊 Mi Dashboard',nav:'dashboard',kw:'dashboard indicador tarjeta kpi grafico resumen',q:[
  ['¿Qué muestran las tarjetas?','Las tarjetas resumen tus atenciones del año seleccionado: Total, Hoy, En proceso, Finalizadas y Por estado. Como supervisor solo ves TUS registros; el administrador ve el consolidado. Se actualizan solas cada 90 s y al guardar una atención.'],
  ['¿Qué es el Índice de cumplimiento?','Es tu porcentaje de tareas en plazo (informes, reportes/descargos, cierres y visitas). 🟢 al día · 🟡 próximo a vencer · 🟠 vence hoy · 🔴 vencido · ⚫ crítico. Sube regularizando lo pendiente; nunca se te bloquea regularizar.'],
  ['¿Para qué sirve la campana 🔔?','La campana muestra tus pendientes con plazo y cuántos días faltan o llevan vencidos. Haz clic en un pendiente para ir directo al registro y regularizarlo.'],
  ['Los números no coinciden con mis registros','Verifica el año seleccionado y que no tengas filtros activos. Si aún así difiere, presiona Ctrl+F5 para recargar. Si persiste, escríbele a Joel por el botón 💬 con el N° de registro que falta.']]},
 {k:'atenciones',t:'📋 Mis Atenciones',nav:'navAt',kw:'atencion atenciones registrar guardar licencia parentesco recordatorio whatsapp trabajador dni estado proceso finalizado',q:[
  ['¿Cómo registro una atención?','1) En Mis Atenciones pulsa ➕ Nueva atención. 2) Escribe el DNI (8 dígitos): el sistema completa nombre, empresa, fundo, cargo y ruta. 3) Elige el Documento/trámite; si lo pide, completa N° de licencia, parentesco y fechas del documento. 4) Revisa fecha y horas de atención, responsable de recepción, observaciones y estado. 5) 💾 Guardar. El botón se bloquea mientras guarda, así no se duplica.'],
  ['¿Cuándo pongo N° de licencia o parentesco?','Solo cuando el motivo lo pide (licencias, permisos por familiar, fallecimiento, etc.) aparecen los campos N° de licencia y Parentesco. Si no los ves, ese motivo no los requiere.'],
  ['¿Qué diferencia hay entre EN PROCESO y FINALIZADO?','EN PROCESO = la atención sigue abierta (requiere seguimiento). FINALIZADO = ya se resolvió. Puedes cambiar el estado editando la atención; el sistema guarda quién y cuándo lo cambió.'],
  ['¿Cómo envío el recordatorio por WhatsApp 📲?','En atenciones EN PROCESO con celular registrado aparece el botón 📲. Al pulsarlo se abre WhatsApp con el mensaje listo; solo confirmas el envío desde tu teléfono o WhatsApp Web.'],
  ['Guardé y no aparece en la lista','La lista se refresca sola al guardar y cada 90 s. Si no aparece, revisa el filtro de fecha/estado. Si salió "Sin conexión", NO la registres de nuevo: queda guardada en tu equipo (aviso naranja ⏳ abajo a la izquierda) y se envía sola apenas vuelve internet.'],
  ['¿Qué es el aviso naranja ⏳ "atención pendiente de envío"?','Aparece cuando guardaste sin conexión. Tu atención está a salvo en tu equipo y se envía sola cada 45 s o apenas vuelve internet; al enviarse verás ✅ con su N°. Puedes hacer clic en el aviso para reintentar ya. No cierres sesión en otro equipo esperando verla: se envía desde este.']]},
 {k:'trabajadores',t:'👷 Trabajadores',nav:'trabajadores',kw:'buscar trabajador trabajadores consulta dni nombre masiva excel datos personal historial ficha',q:[
  ['¿Cómo busco a un trabajador?','En 👷 Trabajadores escribe el DNI o el nombre (mínimo 2 caracteres) y pulsa Buscar. Verás dos pestañas: 👤 Datos del trabajador (empresa, cargo, fundo, ruta, código, periodo) e 📋 Historial de atenciones. Si escribes un DNI, las dos se llenan de una vez; en cada fila tienes + Atención y 📋 Historial.'],
  ['¿Dónde quedó Consulta por DNI?','Ahora está dentro de 👷 Trabajadores, en la pestaña 📋 Historial de atenciones. Para consultar por fechas o responsable de recepción (sin DNI) abre ahí "Búsqueda avanzada"; el Excel del historial sigue en el mismo lugar.'],
  ['¿Cómo consulto varios DNI a la vez?','Usa Consulta Masiva (Excel): sube un archivo con una columna de DNI y el sistema devuelve un Excel con los datos y atenciones de cada uno.'],
  ['No encuentro al trabajador','Revisa que el DNI tenga 8 dígitos sin espacios. Si el trabajador es nuevo puede no estar aún en la base; avisa a Joel por 💬 indicando DNI y empresa.']]},
 {k:'correo',t:'📧 Enviar Reporte',nav:'navCorreo',kw:'correo reporte enviar excel exportar email',q:[
  ['¿Cómo envío mi reporte?','Enviar Reporte ya no está en el menú: es el botón naranja 📧 Enviar reporte dentro de 📋 Mis Atenciones. Elige el rango de fechas y los destinatarios; el sistema arma el correo con tus atenciones y el Excel adjunto. Revisa la vista previa antes de enviar.'],
  ['Me sale "restringido por cumplimiento"','Enviar Reporte y la exportación a Excel se restringen cuando tienes tareas vencidas. Regulariza lo pendiente (campana 🔔) y la restricción se levanta sola; si necesitas enviar de urgencia, pide a Joel que la levante por 💬.']]},
 {k:'visitas',t:'🏕️ Visitas de Campo',nav:'navVisitas',kw:'visita campo sector plazo pendiente registrar',q:[
  ['¿Cómo registro una visita?','En Visitas de Campo pulsa Nueva visita, elige fecha, empresa/sector y describe lo observado y los acuerdos. Guarda y quedará en tu historial con semáforo de plazo.'],
  ['¿Cada cuánto debo registrar visitas?','El plazo lo configura Coordinación (⚙️ Plazos y reglas). Si te acercas al límite verás 🟡; si lo pasas 🔴 y aparecerá en tu campana 🔔. Registrar la visita atrasada lo regulariza de inmediato.']]},
 {k:'casos',t:'⚖️ Registro de Casos',nav:'navCasos',kw:'caso casos investigacion informe reporte descargo cierre cerrar documento subir adjuntar justificacion plazo vencido',q:[
  ['¿Cómo registro un caso nuevo?','Pulsa Nuevo caso y elige: 🔍 En Investigación (caso abierto, sin documentos aún) o ✅ Caso Concluido (ya tienes informe y reporte/descargo para adjuntar). Completa DNI, tipo de falta, fecha del hecho y descripción, y guarda.'],
  ['¿Cuáles son las etapas y plazos?','Cada caso pasa por 3 etapas con plazo: 1) Investigación e informe · 2) Carga de reporte/descargo · 3) Cierre. En la tabla ves el semáforo de cada caso: 🟢 en plazo · 🟡 próximo · 🟠 vence hoy · 🔴 vencido · ⚫ crítico.'],
  ['¿Cómo subo el informe o el reporte/descargo?','Abre el caso (✏️ editar), adjunta el PDF en el campo correspondiente y guarda. El archivo se sube a la nube y queda el enlace en el caso. Tamaño recomendado: menos de 10 MB.'],
  ['¿Cómo cierro un caso?','Edita el caso, asegúrate de que tenga informe y reporte/descargo cargados, cambia el estado a cerrado/concluido y guarda. El sistema registra la fecha de cierre y lo saca de tus pendientes.'],
  ['Me pide una justificación al guardar','Cuando regularizas una etapa fuera de plazo el sistema pide una justificación obligatoria (mínimo unas palabras). Queda registrada para Coordinación; no bloquea el guardado, solo debes explicar el motivo del retraso.']]},
 {k:'fusiones',t:'🚌 Fusiones de Buses',nav:'navFusiones',kw:'fusion fusiones bus buses ruta',q:[
  ['¿Cómo registro una fusión?','En Fusiones de Buses pulsa Nueva fusión, indica fecha, rutas/buses fusionados y motivo, y guarda. El registro alimenta el reporte de transporte.'],
  ['No puedo entrar a Fusiones','Este módulo se restringe cuando tienes pendientes vencidos de mayor nivel. Regulariza desde la campana 🔔 o pide a Joel que levante la restricción por 💬.']]},
 {k:'capacitaciones',t:'📚 Capacitaciones',nav:'capacitaciones.html',kw:'capacitacion capacitaciones charla asistencia tema',q:[
  ['¿Cómo registro una capacitación?','Entra a Capacitaciones, pulsa Nueva, indica fecha, tema, expositor y los asistentes (por DNI o lista). Guarda y podrás exportar la asistencia a Excel.'],
  ['¿Cómo exporto la asistencia?','En la lista de capacitaciones usa el botón Excel: descarga el registro con los asistentes y sus datos.']]},
 {k:'preaviso',t:'⚖️ Cartas de Preaviso',nav:'navPreaviso',kw:'preaviso carta despido falta grave',q:[
  ['¿Cómo genero una carta de preaviso?','En Cartas de Preaviso elige al trabajador por DNI, el tipo de falta y los hechos; el sistema genera la carta con el formato legal para imprimir o descargar en PDF.']]},
 {k:'almuerzos',t:'🍽️ Programador de Almuerzos',nav:'navAlmuerzos',kw:'almuerzo almuerzos comedor programar menu',q:[
  ['¿Cómo programo los almuerzos?','En Programador de Almuerzos elige la fecha y la cantidad por sector/empresa; guarda antes de la hora de corte para que comedor reciba el pedido.'],
  ['No puedo entrar a Almuerzos','Este módulo se restringe en el nivel más alto de incumplimiento. Regulariza tus pendientes (campana 🔔) o coordina con Joel por 💬.']]},
 {k:'inventario',t:'📦 Inventario Canastas',nav:'navInventario',kw:'inventario canasta canastas stock entrega',q:[
  ['¿Cómo registro entregas o stock?','En Inventario Canastas registra ingresos y entregas por sector; el saldo se calcula automáticamente y puedes exportarlo a Excel.']]},
 {k:'horas',t:'⏱️ Acumulación de Horas',nav:'navHoras',kw:'horas acumulacion acumuladas compensacion extra',q:[
  ['¿Cómo registro horas acumuladas?','En Acumulación de Horas busca al trabajador por DNI, registra la fecha y las horas (a favor o compensadas). El saldo se muestra por trabajador.']]},
 {k:'calculo',t:'🧮 Cálculo Remunerativo',nav:'navCalcRemu',kw:'calculo remunerativo liquidacion sueldo remuneracion',q:[
  ['¿Cómo hago un cálculo?','En Cálculo Remunerativo ingresa los datos del trabajador y el periodo; el sistema calcula los conceptos y te permite imprimir o exportar. Verifica siempre las fechas de ingreso y cese.'],
  ['No puedo entrar a Cálculo Remunerativo','Se restringe cuando tienes pendientes vencidos. Regulariza desde la campana 🔔 o pide a Joel que levante la restricción.']]},
 {k:'estadisticas',t:'📈 Estadísticas',nav:'navMisEstadisticas',kw:'estadistica estadisticas grafico tendencia mes',q:[
  ['¿Qué veo en Mis Estadísticas?','Gráficos de tus atenciones por mes, tipo, motivo y estado, con filtro por año. Sirve para tu reporte mensual y para ver tu tendencia.']]},
 {k:'solicitudes',t:'🔔 Solicitudes',nav:'navSolicitudes',kw:'solicitud solicitudes acceso temporal permiso aprobar',q:[
  ['¿Qué son las solicitudes?','Son pedidos de acceso temporal o permisos que envían los usuarios. Como administrador puedes aprobar o rechazar; el usuario recibe el aviso en pantalla.']]},
 {k:'mantenimiento',t:'🔧 Solicitud de Mantenimiento',nav:'navMantenimiento',kw:'mantenimiento solicitud reparacion averia',q:[
  ['¿Cómo pido un mantenimiento?','En Solicitud de Mantenimiento describe la avería, el lugar y la urgencia, adjunta foto si tienes y envía. Sigues el estado desde la misma pantalla.'],
  ['No puedo entrar a Mantenimiento','Se restringe en el nivel más alto de incumplimiento. Regulariza tus pendientes (campana 🔔) o coordina con Joel por 💬.']]},
 {k:'usuarios',t:'👥 Gestión Usuarios',nav:'navUsr',kw:'usuario usuarios clave contraseña rol permisos modulos',q:[
  ['¿Cómo asigno módulos a un usuario?','En Gestión Usuarios → Permisos por módulo, elige al usuario y marca los módulos que debe ver. Se guarda en la hoja PERMISOS MODULOS y aplica en su siguiente ingreso.'],
  ['¿Cómo restablezco una contraseña?','En Gestión Usuarios edita al usuario y define la nueva clave; recuerda sincronizar con Azure si el ingreso sigue fallando.']]},
 {k:'monitor',t:'🛰️ Monitor en Vivo',nav:'navMonitor',kw:'monitor vivo presencia trafico conectados',q:[
  ['¿Qué muestra el Monitor?','Quién está conectado, en qué módulo, mensajes con los usuarios y, en la pestaña 🛰️ Tráfico, el flujo de acciones entre usuarios, RR.LL., los módulos ETI y los servidores.']]},
 {k:'cumplimiento',t:'✅ Control de Cumplimiento',nav:'navCumpl',always:true,kw:'cumplimiento semaforo restriccion restringido justificacion plazo plazos vencido escalar',q:[
  ['¿Cómo funciona el semáforo?','🟢 en plazo · 🟡 próximo a vencer · 🟠 vence hoy · 🔴 vencido · ⚫ crítico. Cada etapa de caso y cada visita tiene su plazo configurado por Coordinación.'],
  ['¿Qué restricciones existen?','Según el nivel de atraso se restringen progresivamente: Enviar Reporte/Excel → Fusiones y Cálculo Remunerativo → Mantenimiento y Almuerzos. NUNCA se bloquea registrar, editar ni regularizar: al ponerte al día la restricción se levanta sola.'],
  ['¿Qué pasa si no regularizo?','Recibes alertas progresivas en la campana y al ingresar; si el atraso continúa, el caso se escala a Coordinación por correo. Todo queda en el historial de cumplimiento.'],
  ['¿Cómo justifico un retraso?','Al guardar una etapa vencida el sistema abre el cuadro de justificación. Escribe el motivo real; Coordinación lo revisa y puede levantar la restricción.']]}
];
// Temas siempre disponibles (no dependen de permisos)
var GENERAL={k:'general',t:'🧭 Uso general del sistema',kw:'sesion clave contraseña ingresar salir cerrar sin conexion error lento recargar celular movil',q:[
  ['¿Qué cambió en el menú? (18-oct)','Tres cosas: 1) 👷 Buscar Trabajador y Consulta por DNI ahora son un solo módulo, Trabajadores, con pestañas Datos e Historial. 2) 📧 Enviar Reporte salió del menú y es el botón naranja dentro de Mis Atenciones. 3) Resumen General se retiró (sus cifras están en Estadísticas Admin). Nada de tu información cambió.'],
  ['Me sale "Sin conexión con el servidor"','Suele ser una caída momentánea. Las consultas se reintentan solas; espera unos segundos. Si fue al guardar una atención, no la repitas: queda en tu equipo (aviso ⏳) y se envía sola. Si se repite seguido, usa 🆘 Reportar para que Joel lo vea con el detalle técnico.'],
  ['¿Cómo reporto un problema del sistema?','Usa la pestaña roja 🆘 Reportar en el borde derecho de la pantalla. Escribe qué pasó y envía: llega a Joel con tu usuario, el módulo y los últimos errores de tu equipo, sin que tengas que explicar lo técnico.'],
  ['Me salió "Hay una versión nueva del sistema"','Significa que se publicó una mejora. Termina y guarda lo que estás haciendo y pulsa Actualizar. Si eliges Después, te vuelve a avisar en 30 min.'],
  ['¿Qué datos míos puedo consultar aquí?','Pulsa 📊 Mis datos en el menú o escribe, por ejemplo, "mis pendientes", "cuántas atenciones llevo" o "mi índice": te muestro tus atenciones del día/mes/año, tu índice de cumplimiento y lo que tienes por vencer o vencido.'],
  ['¿Cómo cambio mi contraseña?','Pídela a Coordinación por 💬 o WhatsApp; Joel la actualiza en Gestión Usuarios y te la confirma.'],
  ['¿Puedo usar el sistema desde el celular?','Sí. Abre la misma dirección en el navegador del celular; el menú se despliega con ☰. Para subir documentos de casos es más cómodo hacerlo desde la PC.'],
  ['¿Cómo vuelvo a la pantalla de módulos (ETI)?','Usa el botón 🏠 Inicio al final del menú: vuelves a la pantalla de los 3 módulos sin volver a escribir tu clave mientras la pestaña siga abierta.']]};

/* ── 3) Módulos designados al usuario (según lo visible en su menú) ─────── */
function visible(el){ if(!el)return false; var cs=getComputedStyle(el); return cs.display!=='none'&&cs.visibility!=='hidden'; }
function navDe(m){
  if(!m.nav)return null;
  var el=document.getElementById(m.nav); if(el)return el;
  var bs=document.querySelectorAll('.nav .ni');
  for(var i=0;i<bs.length;i++){ var oc=bs[i].getAttribute('onclick')||''; if(oc.indexOf("'"+m.nav+"'")>=0||oc.indexOf(m.nav)>=0) return bs[i]; }
  return null;
}
function misModulos(){
  var out=[];
  MODS.forEach(function(m){ var el=navDe(m); m._el=(el&&visible(el))?el:null; if(m._el||m.always) out.push(m); });
  return out;
}

/* ── 4) Panel y conversación ───────────────────────────────────────────── */
var body,inp,mods=[];
function crearPanel(){
  if(document.getElementById('rlAsisPanel'))return;
  var p=document.createElement('div');p.id='rlAsisPanel';
  p.innerHTML='<div id="rlAsisHead"><div class="av">🤖</div><div><b>Asistente RR.LL.</b><small>Ayuda de tus módulos · sin esperar respuesta</small></div>'+
    '<button type="button" id="rlAsisMenu" title="Menú principal">🏠 Menú</button><button type="button" id="rlAsisClose" title="Cerrar">✕</button></div>'+
    '<div id="rlAsisBody"></div>'+
    '<div id="rlAsisFoot"><input id="rlAsisInp" placeholder="Escribe tu duda… (ej. cómo cierro un caso)" maxlength="160"><button type="button" id="rlAsisSend">➤</button></div>';
  document.body.appendChild(p);
  body=p.querySelector('#rlAsisBody'); inp=p.querySelector('#rlAsisInp');
  p.querySelector('#rlAsisClose').onclick=toggle;
  p.querySelector('#rlAsisMenu').onclick=function(){menu(true);};
  p.querySelector('#rlAsisSend').onclick=enviar;
  inp.addEventListener('keydown',function(e){ if(e.key==='Enter'){e.preventDefault();enviar();} });
}
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
function bot(t){ var d=document.createElement('div');d.className='rlm bot';d.textContent=t;body.appendChild(d);scroll(); }
function usr(t){ var d=document.createElement('div');d.className='rlm usr';d.textContent=t;body.appendChild(d);scroll(); }
function opts(list){
  var w=document.createElement('div');w.className='rlopts';
  list.forEach(function(o){ var b=document.createElement('button');b.type='button';b.textContent=o.t;if(o.c)b.className=o.c;b.onclick=function(){usr(o.t);setTimeout(o.f,120);};w.appendChild(b); });
  body.appendChild(w);scroll();
}
function scroll(){ try{body.scrollTop=body.scrollHeight;}catch(e){} }
function nombre(){ try{var u=(typeof USER!=='undefined'&&USER)||JSON.parse(sessionStorage.getItem('user')||'{}');return String(u.nombre||u.usuario||'').split(' ')[0];}catch(e){return '';} }

function menu(limpiar){
  if(limpiar)body.innerHTML='';
  try{ if(typeof window._rlAsisAdminHome==='function'&&window._rlAsisAdminHome()) return; }catch(e){}
  menuModulos();
}
function menuModulos(){
  mods=misModulos();
  var n=nombre();
  bot((n?'Hola '+n+' 👋. ':'Hola 👋. ')+'Soy el asistente del Sistema RR.LL. Te ayudo con dudas de los módulos que tienes asignados ('+mods.length+'). ¿Sobre cuál quieres consultar?');
  var l=mods.map(function(m){return {t:m.t,f:function(){modulo(m);}};});
  if(typeof window._rlAsisMisDatos==='function') l.unshift({t:'📊 Mis datos',c:'go',f:function(){window._rlAsisMisDatos();}});   /* _ASISTENTE_DATOS_V1 */
  l.push({t:GENERAL.t,c:'sec',f:function(){modulo(GENERAL);}});
  l.push({t:'👤 Hablar con Joel',c:'sec',f:contacto});
  opts(l);
}
function modulo(m){
  bot('Preguntas frecuentes de '+m.t+':');
  var l=m.q.map(function(q){return {t:q[0],f:function(){respuesta(m,q);}};});
  if(m._el)l.push({t:'➡️ Ir al módulo',c:'go',f:function(){ir(m);}});
  l.push({t:'🏠 Menú',c:'sec',f:function(){menu(false);}});
  opts(l);
}
function respuesta(m,q){
  bot(q[1]);
  var l=[];
  if(m._el)l.push({t:'➡️ Ir al módulo',c:'go',f:function(){ir(m);}});
  l.push({t:'↩️ Más de '+m.t.replace(/^\S+\s/,''),f:function(){modulo(m);}});
  l.push({t:'🏠 Menú',c:'sec',f:function(){menu(false);}});
  l.push({t:'👤 No resolví mi duda',c:'sec',f:contacto});
  opts(l);
}
function ir(m){
  try{ if(m._el){m._el.click();bot('Listo, te llevé a '+m.t+'. Si tienes otra duda, aquí sigo 😊');} }catch(e){}
  opts([{t:'🏠 Menú',c:'sec',f:function(){menu(false);}}]);
}
function contacto(){
  bot('Puedes escribirle a Joel Timoteo (Coordinación RR.LL.) por dos vías:');
  opts([
    {t:'💬 Mensaje interno (queda registrado)',f:function(){ var b=document.getElementById('_rlChatBtn'); if(b){b.click();bot('Abrí el cuadro de mensaje a Coordinación, escríbele ahí 👇');} else bot('El mensaje interno aún no está disponible; usa WhatsApp.'); }},
    {t:'🆘 Reportar una falla del sistema',f:function(){ if(typeof window.rlReportar==='function'){window.rlReportar();bot('Abrí el formulario de reporte 👉 cuéntame qué pasó y envíalo.');} else bot('El formulario de reporte no está disponible; usa 💬 o WhatsApp.'); }},
    {t:'📱 WhatsApp',f:function(){ var a=document.querySelector('#rlFabCol a[href^="https://wa.me/"]'); if(a)window.open(a.href,'_blank'); bot('Abrí WhatsApp con el mensaje listo para Joel.'); }},
    {t:'🏠 Menú',c:'sec',f:function(){menu(false);}}
  ]);
}
// Texto libre: búsqueda por palabras clave (sin IA)
function norm(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9ñ ]/g,' ');}
function enviar(){
  var t=(inp.value||'').trim(); if(!t)return; inp.value=''; usr(t);
  try{ if(typeof window._rlAsisAdminTexto==='function'&&window._rlAsisAdminTexto(t)) return; }catch(e){}
  try{ if(typeof window._rlAsisDatosTexto==='function'&&window._rlAsisDatosTexto(t)) return; }catch(e){}   /* _ASISTENTE_DATOS_V1 */
  var pal=norm(t).split(/\s+/).filter(function(w){return w.length>2&&['como','para','que','del','los','las','una','uno','con','por','puedo','hago','donde','esta','este','tengo','sale','hay'].indexOf(w)<0;});
  var cand=[]; var pool=misModulos().concat([GENERAL]);
  pool.forEach(function(m){ m.q.forEach(function(q){ var txt=norm(m.t+' '+m.kw+' '+q[0]+' '+q[1]); var sc=0; pal.forEach(function(w){ if(txt.indexOf(w)>=0)sc+= (norm(q[0]).indexOf(w)>=0?3:1); }); if(sc>0)cand.push({sc:sc,m:m,q:q}); }); });
  cand.sort(function(a,b){return b.sc-a.sc;});
  if(!cand.length||!pal.length){
    bot('No encontré una respuesta para eso 🤔. Prueba con otras palabras, elige un módulo del menú o, si es una falla del sistema, repórtala con 🆘.');
    opts([{t:'🏠 Menú',c:'sec',f:function(){menu(false);}},{t:'🆘 Reportar un problema',c:'sec',f:function(){ if(typeof window.rlReportar==='function'){window.rlReportar();} else contacto(); }},{t:'👤 Hablar con Joel',c:'sec',f:contacto}]);
    return;
  }
  if(cand.length===1||cand[0].sc>=cand[1].sc+3){ bot('Creo que esto te ayuda ('+cand[0].m.t+'):'); respuesta(cand[0].m,cand[0].q); return; }
  bot('Encontré varias respuestas posibles, ¿cuál se parece a tu duda?');
  var vistos={}; var l=[];
  cand.slice(0,4).forEach(function(c){ var id=c.m.k+'|'+c.q[0]; if(vistos[id])return; vistos[id]=1; l.push({t:c.q[0],f:function(){respuesta(c.m,c.q);}}); });
  l.push({t:'👤 Hablar con Joel',c:'sec',f:contacto});
  opts(l);
}
function toggle(){
  crearPanel();
  var p=document.getElementById('rlAsisPanel');
  var abrir=!p.classList.contains('on');
  p.classList.toggle('on',abrir);
  if(abrir){ try{var c=document.getElementById('_rlChatPanel'); if(c)c.parentNode.removeChild(c);}catch(e){} if(!body.children.length)menu(true); setTimeout(function(){try{inp.focus();}catch(e){}},150); }
}

/* ── 5) Arranque ───────────────────────────────────────────────────────── */
function init(){
  crearBoton(); acomodar();
  // presencia.js crea 💬 después: lo recogemos cuando aparezca
  var n=0, iv=setInterval(function(){ acomodar(); if(++n>40||document.getElementById('_rlChatBtn'))clearInterval(iv); },500);
  try{ new MutationObserver(function(){ var b=document.getElementById('_rlChatBtn'); if(b&&b.parentNode&&b.parentNode.id!=='rlFabCol')acomodar(); }).observe(document.body,{childList:true}); }catch(e){}
  window._rlAsis={bot:bot,usr:usr,opts:opts,menu:menu,menuModulos:menuModulos,respuesta:respuesta,contacto:contacto,misModulos:misModulos,getBody:function(){return body;}};
  console.log('[_ASISTENTE_RL_V1] listo');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init); else init();
})();
