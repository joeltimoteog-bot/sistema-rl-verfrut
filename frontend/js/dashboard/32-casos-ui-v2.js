/* dashboard.html · bloque 32 (antes en la linea 15273) · extraido el 24-oct-2026 sin cambios (_MODULAR_V1) */

(function(){
'use strict';
if(window._casosUi2Listo)return; window._casosUi2Listo=true;
var MESES=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
var per={anio:'',mes:''};          // filtro de periodo activo ('' = todos)
var visibles=null;                  // lista realmente pintada (para traducir índices)

/* ── 1) Decorar KPI y envolver la tabla ─────────────────────────────── */
function decorar(){
  try{
    var map={cTotalReg:['total','⚖️'],cEnPlazo:['ok','✅'],cRetrasado:['late','⏰'],cEstaSemana:['week','📅'],
             vTotalReg:['total','🏕️'],vEnPlazo:['ok','✅'],vRetrasado:['late','⏰'],vSemActual:['week','📅']};
    Object.keys(map).forEach(function(id){var el=document.getElementById(id);var c=el&&el.closest('.card');if(c){c.setAttribute('data-k',map[id][0]);c.setAttribute('data-ic',map[id][1]);}});
    var tb=document.getElementById('tbCasos'),wrap=tb&&tb.closest('div[style*="overflow-x"]');
    if(wrap)wrap.classList.add('cTablaWrap');
    var stats=document.getElementById('statsCasos');
    if(stats&&!document.getElementById('cPeriodos')){
      var p=document.createElement('div');p.id='cPeriodos';
      p.innerHTML='<div class="cp-t">📅 Casos por periodo <small id="cpInfo"></small></div><div class="cp-row"><span class="cp-lbl">Año</span><span id="cpAnios"></span></div><div class="cp-row"><span class="cp-lbl">Mes</span><span id="cpMeses"></span></div>';
      stats.parentNode.insertBefore(p,stats.nextSibling);
    }
  }catch(e){}
}
function ym(c){var f=String(c.fecha_reporte||c.fecha||'').slice(0,10);var m=f.match(/^(\d{4})-(\d{2})/);return m?{a:m[1],m:m[2]}:null;}
function pasa(c){ if(!per.anio)return true; var d=ym(c); if(!d)return false; if(d.a!==per.anio)return false; if(per.mes&&d.m!==per.mes)return false; return true; }

function chip(txt,n,on,f,extra){var b=document.createElement('button');b.type='button';b.className='cp-chip'+(on?' on':'')+(n===0?' cero':'')+(extra||'');b.innerHTML=txt+(n==null?'':' <b>'+n+'</b>');if(n!==0||on)b.onclick=f;return b;}
function pintarPeriodos(data){
  var A=document.getElementById('cpAnios'),M=document.getElementById('cpMeses'),info=document.getElementById('cpInfo'); if(!A||!M)return;
  var porA={},porM={};
  (data||[]).forEach(function(c){var d=ym(c);if(!d)return;porA[d.a]=(porA[d.a]||0)+1;if(d.a===(per.anio||''))porM[d.m]=(porM[d.m]||0)+1;});
  var anios=Object.keys(porA).sort().reverse();
  if(!per.anio&&anios.length){ /* sin selección: mostrar meses del año más reciente como referencia */ (data||[]).forEach(function(c){var d=ym(c);if(d&&d.a===anios[0])porM[d.m]=(porM[d.m]||0)+1;}); }
  A.innerHTML='';
  A.appendChild(chip('Todos',(data||[]).length,!per.anio,function(){per={anio:'',mes:''};refrescar();}));
  anios.forEach(function(a){A.appendChild(chip(a,porA[a],per.anio===a,function(){per={anio:a,mes:''};refrescar();}));});
  M.innerHTML='';
  var refA=per.anio||anios[0]||'';
  MESES.forEach(function(nm,i){var k=String(i+1).padStart(2,'0');M.appendChild(chip(nm,porM[k]||0,per.anio===refA&&per.mes===k,function(){per={anio:refA,mes:per.mes===k?'':k};refrescar();}));});
  if(per.anio)M.appendChild(chip('✕ Quitar periodo',null,false,function(){per={anio:'',mes:''};refrescar();},' limpiar'));
  var vis=(data||[]).filter(pasa).length;
  if(info)info.textContent=per.anio?('· mostrando '+vis+' caso(s) de '+(per.mes?MESES[+per.mes-1]+' ':'')+per.anio):('· '+(data||[]).length+' caso(s) en total · elige un año o mes para filtrar');
}
function refrescar(){ try{ if(typeof aplicarFiltrosCasos==='function')aplicarFiltrosCasos(); else if(typeof renderTablaCasos==='function')renderTablaCasos(casosData||[]); }catch(e){} }

/* ── 2) Envolver renderTablaCasos: aplica periodo y recuerda la lista visible ── */
var _renderPrev=window.renderTablaCasos;
if(typeof _renderPrev==='function'){
  window.renderTablaCasos=function(data){
    decorar();
    var base=Array.isArray(data)?data:[];
    pintarPeriodos(base);
    visibles=base.filter(pasa);
    var r=_renderPrev.call(this,visibles);
    corregirIndices();
    return r;
  };
}
/* ── 3) Índice de fila → índice real en casosData (reescribe los onclick de la fila) ── */
function real(idx){
  try{
    if(!visibles||!Array.isArray(casosData))return idx;
    var c=visibles[idx]; if(!c)return idx;
    var j=casosData.indexOf(c); if(j>=0)return j;
    j=casosData.findIndex(function(x){return String(x.nro)===String(c.nro);}); return j>=0?j:idx;
  }catch(e){return idx;}
}
function corregirIndices(){
  try{
    var tb=document.getElementById('tbCasos'); if(!tb)return;
    var filas=tb.querySelectorAll('tr');
    for(var i=0;i<filas.length;i++){
      var r=real(i); if(r===i)continue;
      filas[i].querySelectorAll('[onclick]').forEach(function(el){
        var oc=el.getAttribute('onclick')||'';
        var nuevo=oc.replace(new RegExp('^(\\s*[A-Za-z_$][\\w$]*\\()'+i+'([,)])'),'$1'+r+'$2');
        if(nuevo!==oc)el.setAttribute('onclick',nuevo);
      });
    }
  }catch(e){}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',decorar);else decorar();
setTimeout(decorar,1500);
console.log('[_CASOS_UI_V2] listo');
})();
