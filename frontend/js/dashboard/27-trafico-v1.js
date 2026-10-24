/* dashboard.html · bloque 27 (antes en la linea 14401) · extraido el 24-oct-2026 sin cambios (_MODULAR_V1) */

/* ══════ _TRAFICO_V1 (20-set-2026) — acciones de negocio del RR.LL al mapa de tráfico ══════ */
(function(){
'use strict';
var MAPA={saveAtencion:['Guardó atención','Google Sheets'],updateAtencion:['Actualizó atención','Google Sheets'],deleteAtencion:['Eliminó atención','Google Sheets'],
  saveCaso:['Registró caso','Google Sheets'],updateCaso:['Actualizó caso','Google Sheets'],deleteCaso:['Eliminó caso','Google Sheets'],
  saveVisita:['Registró visita de campo','Google Sheets'],syncFirebaseAtencion:['Sincronizó atención','Azure SQL'],
  cumplJustificar:['Justificó incumplimiento','Google Sheets'],cumplConfigGuardar:['Cambió plazos de cumplimiento','Google Sheets'],cumplRestriccionLevantar:['Levantó restricción','Google Sheets']};
var prev=window.apiPost;
if(typeof prev==='function'){
  window.apiPost=async function(b){var r=await prev.apply(this,arguments);
    try{ if(window.RLTrafico&&RLTrafico.auto)return r;   /* _TRAFICO_V2: trafico.js ya registra todo (Azure y Google) a nivel de fetch */
      if(b&&MAPA[b.action]&&r&&r.success&&window.RLTrafico){var m=MAPA[b.action],det='';
      if(b.action==='updateCaso'&&b.estado_gestion&&/CERRADO|CONCLUIDO|FINALIZADO|RESUELTO/i.test(b.estado_gestion)){m=['Cerró caso','Google Sheets'];}
      else if(b.action==='updateCaso'&&(b.enlace_informe||b.enlace_reporte)){m=['Subió documentos del caso','Azure Blob'];}
      if(b.nro||r.nro)det='N° '+(b.nro||r.nro)+(b.nombre?' · '+String(b.nombre).split(' ').slice(0,2).join(' '):'');
      RLTrafico.emit({accion:m[0],destino:m[1],detalle:det});}
      else if(b&&MAPA[b.action]&&r&&!r.success&&window.RLTrafico){RLTrafico.emit({accion:'Error al '+MAPA[b.action][0].toLowerCase(),destino:MAPA[b.action][1],detalle:String(r.error||'').slice(0,80),tipo:'error'});}
    }catch(e){}
    return r;};
}
try{ if(!sessionStorage.getItem('_trf_in')){sessionStorage.setItem('_trf_in','1');setTimeout(function(){try{RLTrafico.emit({accion:'Entró al dashboard',destino:'Firebase'});}catch(e){}},1500);} }catch(e){}
var _lo=window.logout; if(typeof _lo==='function'){window.logout=function(){try{RLTrafico.emit({accion:'Cerró sesión',destino:'Firebase'});}catch(e){}return _lo.apply(this,arguments);};}
/* _TRAFICO_V2: al entrar a cada seccion del dashboard (una vez por sesion) */
/* _TRAFICO_V3 (15-oct-2026): CADA ingreso a un modulo se anota (antes solo el primero de la sesion, por eso
   el Monitor no mostraba los movimientos). Freno de 45 s por modulo para no repetir clics seguidos. */
var _ir=window.ir; if(typeof _ir==='function'){window.ir=function(id){try{var k='_trf_sec_'+id;var ult=Number(sessionStorage.getItem(k)||0);if(id&&id!=='dashboard'&&(Date.now()-ult)>45000){sessionStorage.setItem(k,String(Date.now()));var el=document.querySelector('[onclick*="ir(\''+id+'\'"]');var t=el?el.textContent.replace(/\s+/g,' ').trim().replace(/[0-9]+\s*$/,'').trim():id;RLTrafico.emit({accion:'Entró a '+t.replace(/^[^A-Za-zÁÉÍÓÚÑáéíóúñ]+/,''),destino:'Firebase',tipo:'nav'});}}catch(e){}return _ir.apply(this,arguments);};try{ir=window.ir;}catch(e){}}
console.log('[_TRAFICO_V1] listo');
})();
