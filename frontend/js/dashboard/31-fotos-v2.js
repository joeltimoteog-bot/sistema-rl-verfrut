/* dashboard.html · bloque 31 (antes en la linea 15030) · extraido el 24-oct-2026 sin cambios (_MODULAR_V1) */

(function(){
'use strict';
if(window._rlFotosV2)return; window._rlFotosV2=true;
var HEIC_LIB='https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js';
var IDS=['fFoto1','fFoto2','fFoto3','vFotos','cInforme','cReporte'];
function esHeic(f){return /image\/hei[cf]/i.test(f.type||'')||/\.(heic|heif)$/i.test(f.name||'');}
function esImagen(f){return /^image\//i.test(f.type||'')||/\.(jpe?g|png|gif|webp|bmp|heic|heif)$/i.test(f.name||'');}
function avisar(m,t){try{mostrarToast(m,t||'error');}catch(e){try{alert(m);}catch(e2){}}}
function msgDe(el){return el&&/^fFoto\d$/.test(el.id)?document.getElementById(el.id+'Msg'):el&&el.id==='vFotos'?document.getElementById('vFotosCount'):null;}

/* ── 1) Fusiones: cámara o galería ─────────────────────────────────────── */
function quitarCapture(){['fFoto1','fFoto2','fFoto3'].forEach(function(id){var el=document.getElementById(id);if(el&&el.hasAttribute('capture'))el.removeAttribute('capture');});}
quitarCapture();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',quitarCapture);
setTimeout(quitarCapture,2000);

/* ── 2) Al elegir: HEIC → JPG y aviso si la foto no se puede leer ──────── */
var libP=null;
function cargarLib(){
  if(window.heic2any)return Promise.resolve();
  if(libP)return libP;
  libP=new Promise(function(ok,no){
    var s=document.createElement('script');s.src=HEIC_LIB;
    s.onload=function(){window.heic2any?ok():(libP=null,no(new Error('convertidor no disponible')));};
    s.onerror=function(){libP=null;no(new Error('no se pudo cargar el convertidor de fotos de iPhone (revisa tu internet)'));};
    document.head.appendChild(s);
  });
  return libP;
}
function aJpg(f){
  return cargarLib().then(function(){return window.heic2any({blob:f,toType:'image/jpeg',quality:0.85});}).then(function(b){
    if(Array.isArray(b))b=b[0];
    var n=String(f.name||'foto').replace(/\.[^.]+$/,'')+'.jpg';
    try{return new File([b],n,{type:'image/jpeg'});}catch(e){b.name=n;return b;}
  });
}
window._rlFotoLegible=function(f){
  return new Promise(function(ok){
    if(!f||!esImagen(f)||esHeic(f))return ok(true);
    var u,i=new Image(),t=setTimeout(function(){fin(true);},20000);
    function fin(v){clearTimeout(t);try{URL.revokeObjectURL(u);}catch(e){}ok(v);}
    i.onload=function(){fin(true);};i.onerror=function(){fin(false);};
    try{u=URL.createObjectURL(f);i.src=u;}catch(e){fin(true);}
  });
};
var puedeReemplazar=(function(){try{return !!new DataTransfer().items;}catch(e){return false;}})();
function prog(t,fn){return window.RLProgreso&&window.RLProgreso.accion?window.RLProgreso.accion(t,fn):Promise.resolve().then(fn);}

document.addEventListener('change',function(ev){
  var el=ev.target;
  if(ev._rlV2||!el||el.type!=='file'||IDS.indexOf(el.id)<0)return;
  var files=Array.prototype.slice.call(el.files||[]);
  if(!files.length)return;
  ev.stopImmediatePropagation();   /* se revisan primero y luego se entrega el cambio a la pantalla */
  var heic=files.filter(esHeic).length, msg=msgDe(el);
  if(heic&&msg)msg.textContent='⏳ Convirtiendo '+heic+' foto(s) de iPhone…';
  var trabajo=function(){
    return Promise.all(files.map(function(f){
      if(esHeic(f))return aJpg(f).then(function(j){return {f:j};},function(e){return {f:null,motivo:(e&&e.message)||'no se pudo convertir',nombre:f.name};});
      return window._rlFotoLegible(f).then(function(ok){return ok?{f:f}:{f:null,motivo:'formato no compatible o archivo dañado',nombre:f.name};});
    }));
  };
  (heic?prog(['Preparando la foto…','Foto lista','No se pudo preparar la foto'],trabajo):trabajo()).then(function(res){
    var buenos=res.filter(function(r){return r.f;}).map(function(r){return r.f;});
    var malos=res.filter(function(r){return !r.f;});
    var cambio=heic||malos.length;
    if(malos.length)avisar('⚠️ No se puede usar: '+malos.map(function(r){return r.nombre+' ('+r.motivo+')';}).join(', ')+'. Elige otra foto o tómale una captura de pantalla.','error');
    if(cambio){
      if(!puedeReemplazar){ try{el.value='';}catch(e){} if(msg)msg.textContent='⚠️ Este navegador no puede convertir la foto. Actualiza el navegador o elige una foto JPG.'; return; }
      var dt=new DataTransfer(); buenos.forEach(function(f){dt.items.add(f);});
      try{el.files=dt.files;}catch(e){}
    }
    if(msg&&/Convirtiendo/.test(msg.textContent))msg.textContent='';
    if(!el.files||!el.files.length){ if(/^fFoto\d$/.test(el.id)){var p=document.getElementById('prev'+el.id.slice(-1));if(p)p.style.display='none';} return; }
    var e2;try{e2=new Event('change',{bubbles:true});}catch(x){e2=document.createEvent('Event');e2.initEvent('change',true,false);}
    e2._rlV2=true; el.dispatchEvent(e2);
  }).catch(function(e){ console.error('[_FOTOS_V2]',e); var e3=new Event('change',{bubbles:true}); e3._rlV2=true; el.dispatchEvent(e3); });
},true);

/* ── 3) Subida: 2 a la vez, 1 reintento si se cortó, y el motivo si falla ─ */
function traducir(err){
  err=String(err||'');
  if(/HTTP 403/.test(err)&&/expir|AuthenticationFailed|Signature|not authorized/i.test(err))return 'el permiso de Azure para guardar archivos venció o no es válido (avisa a RR.LL.)';
  if(/HTTP 403/.test(err))return 'Azure rechazó el archivo (permiso)';
  if(/HTTP 413|too large|Exceeded|limit/i.test(err))return 'la foto es demasiado grande';
  if(/SAS Token no configurado/i.test(err))return 'falta configurar el permiso de Azure (avisa a RR.LL.)';
  if(/4 minutos/.test(err))return 'la subida tardó demasiado (señal débil); intenta con mejor señal';
  if(/Sin conexi/i.test(err))return 'sin conexión (revisa tu señal o el wifi)';
  return err.slice(0,140)||'sin respuesta del servidor';
}
var activos=0,cola=[];
function turno(){return new Promise(function(ok){if(activos<2){activos++;ok();}else cola.push(ok);});}
function liberar(){var s=cola.shift();if(s)s();else activos=Math.max(0,activos-1);}
var postPrev=window.apiPost;
if(typeof postPrev==='function'){
  window.apiPost=function(b){
    if(!(b&&b.action==='subirArchivoAzure'))return postPrev.apply(this,arguments);
    var self=this,args=arguments;
    function intentar(n){
      return Promise.resolve(postPrev.apply(self,args)).then(function(r){
        if(r&&r.success)return r;
        var err=(r&&r.error)||'sin respuesta';
        var transitorio=!/HTTP 4\d\d/.test(err)&&((r&&r._redError)||/HTTP 5\d\d|HTTP 429|Sin conexi|Timeout|Address unavailable|Service|ocupado|Respuesta no v/i.test(err));
        if(n<2&&transitorio)return new Promise(function(z){setTimeout(z,2500);}).then(function(){return intentar(n+1);});
        window._rlUltErrSubida={nombre:b.nombre||'',error:traducir(err),t:Date.now()};
        return r;
      });
    }
    return turno().then(function(){return intentar(1);}).then(function(r){liberar();return r;},function(e){liberar();throw e;});
  };
}
function ultimoError(){var u=window._rlUltErrSubida;return u&&Date.now()-u.t<600000?u.error:'revisa tu conexión';}

/* ── 4) Fusiones: nunca queda "Subiendo…" sin fin y dice por qué no subió ─ */
var fusOrig=window.subirFotoFusion;
if(typeof fusOrig==='function'){
  window.subirFotoFusion=function(file,sector,ruta,idx){
    if(!file)return fusOrig.apply(this,arguments);
    var self=this,args=arguments;
    return window._rlFotoLegible(file).then(function(ok){
      if(!ok){window._rlUltErrSubida={error:'formato de foto no compatible',t:Date.now()};return '';}
      return Promise.race([Promise.resolve(fusOrig.apply(self,args)),
        new Promise(function(z){setTimeout(function(){window._rlUltErrSubida={error:'la subida tardó demasiado (señal débil)',t:Date.now()};z('');},300000);})]);
    }).then(function(url){
      if(!url){
        var motivo=ultimoError(), n=0;
        avisar('⚠️ La foto '+idx+' de la fusión no se subió: '+motivo+'. El registro se guarda; puedes editarlo luego para adjuntarla.','error');
        var iv=setInterval(function(){var m=document.getElementById('fFoto'+idx+'Msg');if(m&&/No subida$/.test(m.textContent)){m.textContent='⚠️ No subida: '+motivo;clearInterval(iv);}if(++n>40)clearInterval(iv);},250);
      }
      return url||'';
    });
  };
}

/* ── 5) Visitas: avisar si alguna foto no se subió ─────────────────────── */
var visOrig=window.subirFotosVisitaAzure;
if(typeof visOrig==='function'){
  window.subirFotosVisitaAzure=async function(){
    var lista=(typeof visitasFotos!=='undefined'&&Array.isArray(visitasFotos))?visitasFotos:[];
    var esperadas=lista.filter(function(f){return f&&(f.url||f.data);}).length;
    var r=await visOrig.apply(this,arguments);
    var n=Array.isArray(r)?r.length:0;
    if(esperadas&&n<esperadas)avisar('⚠️ '+(esperadas-n)+' de '+esperadas+' foto(s) no se subieron: '+ultimoError()+'. La visita se guarda; edítala luego para adjuntarlas de nuevo.','error');
    return r;
  };
}
console.log('[_FOTOS_V2] listo');
})();
