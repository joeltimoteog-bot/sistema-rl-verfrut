/* dashboard.html · bloque 29 (antes en la linea 14727) · extraido el 24-oct-2026 sin cambios (_MODULAR_V1) */

(function(){
'use strict';
if(window._rlAsisAdminListo)return; window._rlAsisAdminListo=true;
var DB='https://sistema-rl-verfrut-default-rtdb.firebaseio.com';
var FS='https://firestore.googleapis.com/v1/projects/sistema-eti-verfrut/databases/(default)/documents/';
var KEY='AIzaSyAv-1VcbT8VCerClNAeVtVXzOxhSffeDpc';
var cache=null, CACHE_MS=5*60*1000;

function A(){return window._rlAsis||null;}
function esAdmin(){ try{ if(typeof _permEsAdmin==='function')return _permEsAdmin(); }catch(e){} try{return /admin|coordinador/i.test(String((USER&&USER.rol)||''));}catch(e){return false;} }
function ukey(s){return String(s||'').toLowerCase().replace(/[.#$\/\[\]]/g,'_');}
function norm(s){return String(s||'').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\s+/g,' ').trim();}
function coincide(a,b){
  a=norm(a);b=norm(b); if(!a||!b)return false; if(a===b)return true;
  var Aw=a.split(' ').filter(function(w){return w.length>2;}), Bw=b.split(' ').filter(function(w){return w.length>2;});
  var ig=function(x,y){return x===y||(x.length>=4&&y.length>=4&&(x.indexOf(y)===0||y.indexOf(x)===0));};
  var c=Aw.filter(function(w){return Bw.some(function(v){return ig(w,v);});}).length;
  return c>=3||(c>=2&&(Aw.length<=2||Bw.length<=2));
}
function fsVal(v){ if(!v)return null; if(v.stringValue!==undefined)return v.stringValue; if(v.integerValue!==undefined)return Number(v.integerValue); if(v.doubleValue!==undefined)return v.doubleValue; if(v.booleanValue!==undefined)return v.booleanValue; if(v.arrayValue)return (v.arrayValue.values||[]).map(fsVal); if(v.mapValue){var o={},f=v.mapValue.fields||{};Object.keys(f).forEach(function(k){o[k]=fsVal(f[k]);});return o;} return null; }
function fsGet(col){ return fetch(FS+col+'?pageSize=300&key='+KEY).then(function(r){return r.json();}).then(function(j){return (j&&j.documents||[]).map(function(d){var o={},f=d.fields||{};Object.keys(f).forEach(function(k){o[k]=fsVal(f[k]);});return o;});}).catch(function(){return [];}); }
function hoyISO(){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function dias(a,b){return Math.round((new Date(b+'T12:00:00')-new Date(a+'T12:00:00'))/86400000);}
function fmtD(iso){return iso?iso.slice(8,10)+'/'+iso.slice(5,7):'';}
function primer(n){n=String(n||'').trim().split(' ')[0]||'';return n.charAt(0).toUpperCase()+n.slice(1).toLowerCase();}

/* ── Carga y cruce de fuentes ─────────────────────────────────────────── */
async function cargar(force){
  if(cache&&!force&&Date.now()-cache.ts<CACHE_MS)return cache;
  var r=await Promise.all([
    apiPost({action:'cumplPanel',usuario:USER.usuario,rol:USER.rol}).catch(function(){return null;}),
    fsGet('usuarios_eti'), fsGet('programaciones_eti'), fsGet('programaciones_eval')
  ]);
  var rl=r[0], cuentas=r[1], capP=r[2], evP=r[3], hoy=hoyISO();
  if(!rl||!rl.success)throw new Error((rl&&rl.error)||'No se pudo leer el Control de Cumplimiento');
  var sups=(rl.supervisores||[]).map(function(s){
    var acts=(rl.actividades||[]).filter(function(a){return a.usuario===s.usuario;});
    var cta=cuentas.find(function(c){return String(c.usuario||'').toLowerCase()===String(s.usuario).toLowerCase();});
    var nSup=(cta&&cta.supervisorNombre)||s.nombre;
    var caps=[]; capP.forEach(function(p){
      if(p.estado==='ejecutada')return;
      if(!coincide(p.supervisor||'',nSup)&&!coincide(p.supervisor||'',s.nombre))return;
      var f=(p.fechas&&p.fechas.length?p.fechas.slice().sort():[p.fechaProgramada,p.fechaFin||p.fechaProgramada].filter(Boolean).sort());
      if(!f.length)return; var ini=f[0],fin=f[f.length-1];
      if(hoy>fin)caps.push({tema:p.tema||'Capacitación ETI',sector:p.sector||'',fechas:ini===fin?fmtD(ini):fmtD(ini)+' al '+fmtD(fin),atraso:dias(fin,hoy),vencida:true});
      else if(hoy>=ini)caps.push({tema:p.tema||'Capacitación ETI',sector:p.sector||'',fechas:fmtD(ini),atraso:0,vencida:false,hoyTxt:'en curso / hoy'});
    });
    var evs=[]; evP.forEach(function(p){
      if(p.estado==='ejecutada')return; if(!coincide(p.sup||'',s.nombre))return;
      var ej=p.fechasEjecutadas||[]; var pend=(p.fechas||[]).filter(function(f){return ej.indexOf(f)<0;}).sort();
      var venc=pend.filter(function(f){return f<hoy;}); if(venc.length)evs.push({fechas:venc.map(fmtD).join(', '),atraso:dias(venc[venc.length-1],hoy),n:venc.length});
    });
    var rlV=acts.filter(function(a){return a.estado==='VENCIDO'||a.estado==='CRITICO';});
    var capV=caps.filter(function(c){return c.vencida;});
    var totalV=rlV.length+capV.length+evs.length;
    var sem=s.criticos>0?'⚫':(totalV>0?'🔴':((s.por_vencer||0)>0?'🟡':'🟢'));
    return {u:s.usuario,nombre:s.nombre,empresa:s.empresa,sector:s.sector,pct:s.porcentaje,restr:s.restriccion,acts:acts,rlV:rlV,caps:caps,capV:capV,evs:evs,totalV:totalV,sem:sem,porVencer:s.por_vencer||0};
  });
  sups.sort(function(a,b){return (b.totalV-a.totalV)||((a.pct||0)-(b.pct||0));});
  cache={ts:Date.now(),sups:sups,hoy:rl.hoy||hoy};
  return cache;
}

/* ── Vistas ───────────────────────────────────────────────────────────── */
function menuBtn(){return {t:'🏠 Menú',c:'sec',f:function(){A().menu(false);}};}
async function resumen(force){
  var a=A(); a.bot('Consultando RR.LL., Capacitaciones ETI y Evaluaciones ETI… ⏳');
  var d; try{d=await cargar(force);}catch(e){a.bot('No pude leer los datos: '+e.message);a.opts([menuBtn()]);return;}
  var conAtraso=d.sups.filter(function(s){return s.totalV>0;});
  var txt='📊 Estado de los supervisores al '+fmtD(d.hoy)+' — '+conAtraso.length+' con atrasos de '+d.sups.length+':\n\n'+
    d.sups.map(function(s){ return s.sem+' '+s.nombre+' — RR.LL. '+s.rlV.length+' venc. · Cap. ETI '+s.capV.length+' · Eval. ETI '+s.evs.length+' · índice '+(s.pct==null?'–':s.pct+'%')+(s.restr?' · 🔒':''); }).join('\n');
  a.bot(txt);
  var l=d.sups.map(function(s){return {t:s.sem+' '+primer(s.nombre)+' ('+s.totalV+')',f:function(){detalle(s);}};});
  if(conAtraso.length)l.push({t:'📢 Avisar a todos los retrasados ('+conAtraso.length+')',c:'go',f:function(){difusion(conAtraso);}});
  l.push({t:'🔄 Actualizar',c:'sec',f:function(){resumen(true);}}); l.push(menuBtn());
  a.opts(l);
}
function lineas(s){
  var L=[];
  s.acts.forEach(function(x){
    var st=x.estado==='CRITICO'?'⚫':x.estado==='VENCIDO'?'🔴':x.estado==='VENCE_HOY'?'🟠':x.estado==='PROXIMO'?'🟡':'🟢';
    var q=x.tipo==='CASO'?('Caso N° '+x.caso+(x.trabajador?' – '+x.trabajador:'')+': '+x.actividad):(x.actividad+' ('+x.caso+')');
    var t=(x.dias_retraso>0)?x.dias_retraso+' día(s) de atraso':(x.dias_restantes===0?'vence hoy':'vence en '+x.dias_restantes+' día(s)');
    L.push({txt:st+' '+q+' — '+t+' (límite '+fmtD(x.fecha_limite)+')',venc:x.dias_retraso>0,msg:'• '+q+': '+t+'.'});
  });
  s.caps.forEach(function(c){ var t=c.vencida?c.atraso+' día(s) de atraso':c.hoyTxt; L.push({txt:(c.vencida?'🔴':'🟠')+' Capacitación ETI "'+c.tema+'"'+(c.sector?' ('+c.sector+')':'')+' — '+t+' ('+c.fechas+')',venc:c.vencida,msg:'• Capacitación ETI "'+c.tema+'"'+(c.sector?' ('+c.sector+')':'')+' programada el '+c.fechas+': '+t+'.'}); });
  s.evs.forEach(function(e){ L.push({txt:'🔴 Evaluación ETI — '+e.n+' fecha(s) sin registrar: '+e.fechas+' ('+e.atraso+' día(s) de atraso)',venc:true,msg:'• Evaluación ETI: fecha(s) '+e.fechas+' programada(s) y aún sin registrar ('+e.atraso+' día(s) de atraso).'}); });
  return L;
}
function detalle(s){
  var a=A(), L=lineas(s);
  a.bot(s.sem+' '+s.nombre+(s.sector?' · '+s.sector:'')+(s.empresa?' · '+s.empresa:'')+'\nÍndice de cumplimiento: '+(s.pct==null?'–':s.pct+'%')+(s.restr?' · 🔒 con restricción activa':'')+'\n\n'+
    (L.length?L.map(function(x){return x.txt;}).join('\n'):'✅ Sin pendientes en RR.LL. ni ETI.'));
  var l=[];
  if(L.some(function(x){return x.venc;}))l.push({t:'📨 Redactar aviso a '+primer(s.nombre),c:'go',f:function(){redactar(s);}});
  else l.push({t:'📨 Enviar mensaje a '+primer(s.nombre),f:function(){redactar(s);}});
  l.push({t:'↩️ Volver a la lista',f:function(){resumen(false);}}); l.push(menuBtn());
  a.opts(l);
}
function textoAviso(s){
  var V=lineas(s).filter(function(x){return x.venc;});
  var de=(USER&&USER.nombre)||'Joel Timoteo';
  if(!V.length)return 'Hola '+primer(s.nombre)+', te escribe '+de+' (Coordinación RR.LL.).\n\n';
  return 'Hola '+primer(s.nombre)+', te escribe '+de+' (Coordinación RR.LL.).\n\nTienes pendientes RETRASADOS en el sistema:\n'+V.map(function(x){return x.msg;}).join('\n')+
    '\n\nPor favor ponte al día hoy mismo y sube los documentos/registros correspondientes. Al regularizar, tu semáforo se actualiza solo. Cualquier inconveniente respóndeme por este medio. Gracias.';
}
function cajaTexto(texto,onEnviar,onCancel){
  var a=A(), body=a.getBody();
  var w=document.createElement('div'); w.className='rlm bot'; w.style.maxWidth='96%'; w.style.width='96%';
  w.innerHTML='<div style="font-weight:700;margin-bottom:6px">✏️ Revisa o edita el aviso antes de enviarlo:</div>'+
    '<textarea style="width:100%;box-sizing:border-box;min-height:150px;border:1px solid #cbd5e1;border-radius:8px;padding:8px;font:12.5px/1.45 inherit;resize:vertical"></textarea>'+
    '<div style="display:flex;gap:6px;margin-top:6px"><button type="button" class="ok" style="flex:1;background:#16a34a;color:#fff;border:none;border-radius:8px;padding:8px;font-weight:700;cursor:pointer">📨 Enviar</button>'+
    '<button type="button" class="no" style="background:#e2e8f0;color:#334155;border:none;border-radius:8px;padding:8px 12px;font-weight:700;cursor:pointer">Cancelar</button></div>';
  w.querySelector('textarea').value=texto;
  w.querySelector('.ok').onclick=function(){var t=w.querySelector('textarea').value.trim(); if(!t)return; w.querySelectorAll('button').forEach(function(b){b.disabled=true;}); onEnviar(t,w);};
  w.querySelector('.no').onclick=function(){w.remove();onCancel();};
  body.appendChild(w); body.scrollTop=body.scrollHeight; w.querySelector('textarea').focus();
}
function enviarA(usuario,texto){
  return fetch(DB+'/mensajes/'+ukey(usuario)+'.json',{method:'POST',body:JSON.stringify({texto:texto,de:(USER&&USER.nombre)||USER.usuario,de_usuario:USER.usuario,ts:{'.sv':'timestamp'},leido:false})})
    .then(function(r){return !!r.ok;}).catch(function(){return false;});
}
function redactar(s){
  var a=A();
  cajaTexto(textoAviso(s),async function(t,w){
    var ok=await enviarA(s.u,t); w.remove();
    a.bot(ok?'✅ Aviso enviado a '+s.nombre+'. Lo verá como mensaje emergente en cuanto entre al sistema (o al instante si está conectado).':'❌ No se pudo enviar el aviso a '+s.nombre+'. Intenta de nuevo.');
    try{ if(ok&&window.RLTrafico)RLTrafico.emit({accion:'Envió aviso de cumplimiento',destino:'Firebase',detalle:s.nombre}); }catch(e){}
    a.opts([{t:'↩️ Volver a la lista',f:function(){resumen(false);}},menuBtn()]);
  },function(){a.opts([{t:'↩️ Volver',f:function(){detalle(s);}},menuBtn()]);});
}
function difusion(lista){
  var a=A();
  a.bot('📢 Voy a enviar un aviso PERSONALIZADO a cada uno de estos '+lista.length+' supervisor(es), con sus propios pendientes:\n'+lista.map(function(s){return s.sem+' '+s.nombre+' ('+s.totalV+')';}).join('\n')+'\n\nEjemplo para '+primer(lista[0].nombre)+':\n───\n'+textoAviso(lista[0])+'\n───');
  a.opts([
    {t:'📨 Sí, enviar a los '+lista.length,c:'go',f:async function(){
      a.bot('Enviando… ⏳');
      var rs=await Promise.all(lista.map(function(s){return enviarA(s.u,textoAviso(s));}));
      var ok=rs.filter(Boolean).length;
      a.bot((ok===lista.length?'✅':'⚠️')+' Avisos enviados: '+ok+' de '+lista.length+'.'+(ok<lista.length?' Fallaron: '+lista.filter(function(s,i){return !rs[i];}).map(function(s){return s.nombre;}).join(', '):''));
      try{ if(window.RLTrafico)RLTrafico.emit({accion:'Difusión de cumplimiento',destino:'Firebase',detalle:ok+' supervisores'}); }catch(e){}
      a.opts([{t:'↩️ Volver a la lista',f:function(){resumen(false);}},menuBtn()]);
    }},
    {t:'✏️ Prefiero revisar uno por uno',f:function(){resumen(false);}},
    menuBtn()
  ]);
}

/* ── Ganchos con el asistente ─────────────────────────────────────────── */
window._rlAsisAdminHome=function(){
  if(!esAdmin())return false;
  var a=A();
  a.bot('Hola '+primer((USER&&USER.nombre)||'')+' 👋 — modo ADMINISTRADOR. Aquí ves cómo van todos los usuarios del sistema (RR.LL. + Capacitaciones ETI + Evaluaciones ETI) y puedes enviarles avisos desde este chat.');
  var extra=[{t:'👤 Consultar un supervisor',f:async function(){ try{var d=await cargar(false);}catch(e){a.bot('No pude leer los datos: '+e.message);a.opts([menuBtn()]);return;} a.bot('¿De quién quieres ver el detalle?'); a.opts(d.sups.map(function(s){return {t:s.sem+' '+primer(s.nombre),f:function(){detalle(s);}};}).concat([menuBtn()])); }},
    {t:'📚 Ayuda de módulos (vista de usuario)',c:'sec',f:function(){a.menuModulos();}}];
  a.opts(window._rlAsisAdminMenu(extra));
  resumen(false);
  return true;
};
window._rlAsisAdminMenu=function(l){
  if(!esAdmin())return l;
  return [
    {t:'🛠️ ¿Cómo van los usuarios?',c:'go',f:function(){resumen(false);}},
    {t:'📢 Avisar a los retrasados',c:'go',f:async function(){ var a=A(); a.bot('Reviso quién tiene atrasos… ⏳'); try{var d=await cargar(false);}catch(e){a.bot('No pude leer los datos: '+e.message);a.opts([menuBtn()]);return;} var c=d.sups.filter(function(s){return s.totalV>0;}); if(!c.length){a.bot('🎉 Nadie tiene atrasos hoy.');a.opts([menuBtn()]);return;} difusion(c); }}
  ].concat(l);
};
window._rlAsisAdminTexto=function(t){
  if(!esAdmin())return false;
  var n=norm(t);
  if(/AVIS|DIFUSI|ENVIA|MANDA|RECORDATORIO/.test(n)){ window._rlAsisAdminMenu([])[1].f(); return true; }
  if(/COMO VAN|PENDIENTE|RETRAS|ATRAS|VENCID|ESTADO DE LOS|SUPERVISOR|USUARIOS|RANKING|QUIEN/.test(n)){
    if(cache){ var s=cache.sups.find(function(x){return coincide(x.nombre,t)||n.indexOf(norm(x.u))>=0||n.indexOf(norm(primer(x.nombre)))>=0;}); if(s){detalle(s);return true;} }
    resumen(false); return true;
  }
  if(cache){ var s2=cache.sups.find(function(x){return coincide(x.nombre,t)||n.indexOf(norm(x.u))>=0;}); if(s2){detalle(s2);return true;} }
  return false;
};
console.log('[_ASISTENTE_ADMIN_V1] listo');
})();
