/* dashboard.html · bloque 33 (antes en la linea 15434) · extraido el 24-oct-2026 sin cambios (_MODULAR_V1) */

(function(){
'use strict';
if(window._casosUi3Listo)return; window._casosUi3Listo=true;
var ICO={ver:'👁️',editar:'✏️',concluir:'✅',informe:'📄',descargo:'📋'};
function reordenar(){
  try{
    var sec=document.getElementById('sec-casos'); if(!sec)return;
    var filt=sec.querySelector('.filtros'), busc=document.getElementById('cBuscar');
    /* 1) buscador a la primera fila de filtros (se mueve el mismo input: conserva su oninput) */
    if(filt&&busc&&!document.getElementById('cBuscarWrap')){
      var caja=busc.parentNode; caja.id='cBuscarWrap';
      filt.insertBefore(caja,filt.firstChild);
    }
    /* 2) Excel + Limpiar a la fila de chips (mismos botones, mismo onclick) */
    var chipsRow=filt&&filt.nextElementSibling;
    if(filt&&chipsRow&&!document.getElementById('cAccionesFiltro')){
      var acc=document.createElement('div'); acc.id='cAccionesFiltro';
      var ex=filt.querySelector('.btn-a'), li=filt.querySelector('button:not(.btn-a)');
      if(ex){var ex2=ex.cloneNode(true);ex2.textContent='📥 Excel';ex2.style.cssText='background:#1a7f4b;color:#fff;border:none';acc.appendChild(ex2);}
      if(li){var li2=li.cloneNode(true);li2.textContent='🔄 Limpiar';acc.appendChild(li2);}
      chipsRow.appendChild(acc);
    }
    /* 3) Periodo: año como lista desplegable (dispara el mismo clic del chip) */
    var A=document.getElementById('cpAnios');
    if(A){
      var sel=document.getElementById('cpAnioSel');
      if(!sel){sel=document.createElement('select');sel.id='cpAnioSel';A.parentNode.insertBefore(sel,A);
        sel.onchange=function(){var ch=A.querySelectorAll('.cp-chip')[+this.value];if(ch)ch.click();};}
      var chips=A.querySelectorAll('.cp-chip'), html='';
      chips.forEach(function(ch,i){var t=ch.textContent.replace(/\s+/g,' ').trim().replace(/ (\d+)$/,' ($1)');html+='<option value="'+i+'"'+(ch.classList.contains('on')?' selected':'')+'>'+t+'</option>';});
      if(sel.innerHTML!==html)sel.innerHTML=html;
      var info=document.getElementById('cpInfo'), i2=document.getElementById('cpInfo2'), per=document.getElementById('cPeriodos');
      if(per&&!i2){i2=document.createElement('span');i2.id='cpInfo2';per.appendChild(i2);}
      if(info&&i2){var t2=info.textContent.replace(/^·\s*/,'').replace(/· elige un año o mes para filtrar/,'').trim();i2.textContent=t2;}
    }
    /* 4) Tabla: % avance -> barra; botones -> iconos con titulo (mismo onclick) */
    var tb=document.getElementById('tbCasos'); if(!tb)return;
    tb.querySelectorAll('tr').forEach(function(tr){
      var tds=tr.children; if(tds.length<11||tr.dataset.ui3)return; tr.dataset.ui3='1';
      var av=tds[7], m=(av.textContent||'').match(/(\d+)%/);
      if(m){var p=Math.min(100,+m[1]),col=av.style.color||'#16a34a';av.innerHTML='<div class="ui3-av"><i><b style="width:'+p+'%;background:'+col+'"></b></i><span style="color:'+col+'">'+p+'%</span></div>';}
      tds[10].querySelectorAll('button').forEach(function(b){
        var t=(b.textContent||'').trim(), k=/Ver/.test(t)?'ver':/Editar/.test(t)?'editar':/Concluir/.test(t)?'concluir':/Informe/.test(t)?'informe':/Descargo/.test(t)?'descargo':'';
        if(!k)return; b.dataset.ui3=k; b.textContent=ICO[k]; b.title=b.title||t.replace(/^[^A-Za-z]+/,''); b.setAttribute('aria-label',b.title);
      });
    });
  }catch(e){console.warn('[_CASOS_UI_V3]',e);}
}
var _prev=window.renderTablaCasos;
if(typeof _prev==='function'){window.renderTablaCasos=function(d){var r=_prev.apply(this,arguments);reordenar();return r;};}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',reordenar);else reordenar();
setTimeout(reordenar,1800);
console.log('[_CASOS_UI_V3] listo');
})();
