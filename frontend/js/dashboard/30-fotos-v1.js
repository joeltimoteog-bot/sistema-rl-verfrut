/* dashboard.html · bloque 30 (antes en la linea 14915) · extraido el 24-oct-2026 sin cambios (_MODULAR_V1) */

(function(){
'use strict';
if(window._rlFotosListo)return; window._rlFotosListo=true;
var MAX_LADO=1600, CALIDAD=0.82, UMBRAL=450*1024, TIMEOUT_SUBIDA=240000;

function esImagenDataUrl(d){return /^data:image\//i.test(String(d||''));}
/** dataURL → dataURL JPEG comprimido (si no es imagen o es pequeña, devuelve igual) */
window._rlComprimirDataUrl=function(dataUrl){
  return new Promise(function(res){
    try{
      if(!esImagenDataUrl(dataUrl))return res(dataUrl);
      var aprox=Math.round(String(dataUrl).length*3/4);
      var img=new Image();
      img.onload=function(){
        try{
          var w=img.naturalWidth||img.width,h=img.naturalHeight||img.height;
          if(aprox<UMBRAL&&Math.max(w,h)<=MAX_LADO)return res(dataUrl);
          var esc=Math.min(1,MAX_LADO/Math.max(w,h));
          var cw=Math.max(1,Math.round(w*esc)),ch=Math.max(1,Math.round(h*esc));
          var c=document.createElement('canvas');c.width=cw;c.height=ch;
          var ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,cw,ch);ctx.drawImage(img,0,0,cw,ch);
          var out=c.toDataURL('image/jpeg',CALIDAD);
          console.log('[_FOTOS_V1] comprimida '+w+'x'+h+' ('+Math.round(aprox/1024)+' KB) → '+cw+'x'+ch+' ('+Math.round(out.length*3/4/1024)+' KB)');
          res(out.length<dataUrl.length?out:dataUrl);
        }catch(e){res(dataUrl);}
      };
      img.onerror=function(){res(dataUrl);};
      img.src=dataUrl;
    }catch(e){res(dataUrl);}
  });
};
function dataUrlAFile(dataUrl,nombre){
  var p=dataUrl.split(','),mime=(p[0].match(/data:([^;]+)/)||[])[1]||'image/jpeg',bin=atob(p[1]),u8=new Uint8Array(bin.length);
  for(var i=0;i<bin.length;i++)u8[i]=bin.charCodeAt(i);
  var nom=String(nombre||'imagen').replace(/\.[^.]+$/,'')+'.jpg';
  try{return new File([u8],nom,{type:mime});}catch(e){var b=new Blob([u8],{type:mime});b.name=nom;return b;}
}
function leerDataUrl(file){return new Promise(function(res,rej){var r=new FileReader();r.onload=function(e){res(e.target.result);};r.onerror=rej;r.readAsDataURL(file);});}

/* ── 1) Visitas de Campo: previewFotos con compresión ─────────────────── */
var _prevOrig=window.previewFotos;
if(typeof _prevOrig==='function'){
  window.previewFotos=function(input){
    var files=Array.from(input.files||[]);
    if(!files.length)return;
    if(files.length+visitasFotos.length>6){mostrarToast('❌ Máximo 6 imágenes permitidas.','error');input.value='';return;}
    var prev=document.getElementById('vFotosPreview'),cnt=document.getElementById('vFotosCount');
    if(cnt)cnt.textContent='⏳ Preparando '+files.length+' imagen(es)…';
    files.reduce(function(p,file){return p.then(function(){
      return leerDataUrl(file).then(window._rlComprimirDataUrl).then(function(data){
        visitasFotos.push({name:file.name,data:data});
        var d=document.createElement('div');d.style.cssText='position:relative;display:inline-block';
        d.innerHTML='<img src="'+data+'" style="width:80px;height:80px;object-fit:cover;border-radius:6px;border:2px solid #e2e8f0">'+
          '<button onclick="quitarFotoVisita(this.parentElement)" style="position:absolute;top:-6px;right:-6px;background:#ef4444;color:#fff;border:none;border-radius:50%;width:18px;height:18px;font-size:10px;cursor:pointer;line-height:18px;padding:0">✕</button>';
        if(prev)prev.appendChild(d);
        if(cnt)cnt.textContent=visitasFotos.length+' imagen(es) seleccionada(s)';
      }).catch(function(e){console.error('[_FOTOS_V1] visita foto',e);mostrarToast('❌ No se pudo leer la imagen '+file.name,'error');});
    });},Promise.resolve()).then(function(){try{input.value='';}catch(e){}});
  };
}

/* ── 2) Casos: aceptar PDF o imagen, y comprimir imágenes antes de subir ─ */
function habilitarImagenesCasos(){
  ['cInforme','cReporte'].forEach(function(id){
    var el=document.getElementById(id); if(!el)return;
    el.setAttribute('accept','application/pdf,.pdf,image/*');
    var lbl=el.parentElement&&el.parentElement.querySelector('label span');
    if(lbl&&/solo PDF/i.test(lbl.textContent))lbl.textContent='(PDF o foto)';
  });
  var aviso=document.querySelector('#panelAdjuntosCaso div[style*="fffbeb"]');
  if(aviso&&/Google Drive/.test(aviso.textContent))aviso.textContent='☁️ Los archivos se suben automáticamente a la nube al guardar. Las fotos se comprimen solas.';
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',habilitarImagenesCasos);else habilitarImagenesCasos();
setTimeout(habilitarImagenesCasos,2000);

var _subirOrig=window._subirViaBackend;
if(typeof _subirOrig==='function'){
  window._subirViaBackend=async function(file,carpeta,meta){
    try{
      if(file&&/^image\//i.test(file.type||'')&&file.size>UMBRAL){
        var data=await leerDataUrl(file), comp=await window._rlComprimirDataUrl(data);
        if(comp&&comp!==data)file=dataUrlAFile(comp,file.name);
      }
    }catch(e){console.warn('[_FOTOS_V1] sin comprimir:',e.message);}
    return _subirOrig.call(this,file,carpeta,meta);
  };
}

/* ── 3) Subida con tiempo límite propio (4 min) ───────────────────────── */
var _postPrev=window.apiPost;
if(typeof _postPrev==='function'){
  window.apiPost=function(b){
    if(!(b&&b.action==='subirArchivoAzure'))return _postPrev.apply(this,arguments);
    var url=(typeof API!=='undefined'&&API&&API.trim())?API:(typeof API_URL_DEFAULT!=='undefined'?API_URL_DEFAULT:'');
    var ctrl=(typeof AbortController!=='undefined')?new AbortController():null;
    var reloj=setTimeout(function(){try{ctrl&&ctrl.abort();}catch(e){}},TIMEOUT_SUBIDA);
    var kb=Math.round(String(b.base64||'').length*3/4/1024);
    console.log('[_FOTOS_V1] subiendo',b.nombre,kb+' KB →',b.carpeta);
    var op={method:'POST',body:JSON.stringify(b),headers:{'Content-Type':'text/plain'}}; if(ctrl)op.signal=ctrl.signal;
    return fetch(url,op).then(function(r){return r.text();}).then(function(t){clearTimeout(reloj);try{return JSON.parse(t);}catch(e){return {success:false,error:'Respuesta no válida del servidor al subir '+(b.nombre||'')};}})
      .catch(function(e){clearTimeout(reloj);console.error('[_FOTOS_V1] error subida',e);return {success:false,error:(e&&e.name==='AbortError')?'La subida tardó más de 4 minutos':'Sin conexión al subir '+(b.nombre||''),_redError:true};});
  };
}
console.log('[_FOTOS_V1] listo');
})();
