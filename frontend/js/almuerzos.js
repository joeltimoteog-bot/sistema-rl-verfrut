'use strict';
/* ════════════════════════════════════════════════════════════════
   Programador de Almuerzos — Sistema RR.LL. (Verfrut / Rapel · Unifrutti)
   Hoja "PROGRAMACION DE ALMUERZOS" (fila 1 = títulos; datos desde fila 2):
     A=DNI  B=Nombre  C=Cargo  D=Régimen  E=Comedor  F=Tipo comida
     G=Estado(ACTIVO o motivo)  H=Observación  I=Empresa
   Activo = G === 'ACTIVO'.  Inactivo = G es un motivo.
   Bitácora de envíos: "BB.ALMUERZOS".  Acceso: admins + smiranda.
   ════════════════════════════════════════════════════════════════ */

let API  = '';
let USER = null;
let colaboradores = [];
let _trabajadorActual = null;

const AZURE_DNI = 'https://rl-functions-verfrut-c0ctfjc0cjf5f0hz.brazilsouth-01.azurewebsites.net/api/trabajadores/buscar?dni=';

// Destinatarios del correo de almuerzos
const ALM_TO = 'lucia.castillo@unifrutti.com';                                  // Para:
const ALM_CC = 'olga.vilela@unifrutti.com,jorge.chavez@unifrutti.com,joel.timoteo@unifrutti.com,eduardo.covenas@unifrutti.com';  // CC:

const COMEDORES = [
  'COMEDOR ADMINISTRACION',
  'COMEDOR GENERAL',
  'COMEDOR CAMPAMENTO',
  'COMEDOR SAN RAFAEL'
];
const TIPOS_COMIDA = ['ALMUERZO','DIETA'];
const MOTIVOS = ['VACACIONES','PERMISO','SUSPENSION','CESE','DESCANSO MEDICO'];
const EST_ACTIVO = 'ACTIVO';

// ¿está activo? (recibe su comida)
function esActivo(c){ return String(c.estado || '').toUpperCase().trim() === EST_ACTIVO; }

/* ─────────── Tabs ─────────── */
function showTab(tab, btn){
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('on'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('on'));
  const tc = document.getElementById('tab-' + tab);
  if(tc) tc.classList.add('on');
  if(btn) btn.classList.add('on');
  if(tab === 'lista') cargarLista();
}

/* ─────────── Búsqueda DNI (Azure) — para agregar nuevo ─────────── */
async function buscarDni(){
  let dni = document.getElementById('dni').value.trim().replace(/\D/g,'');
  if(dni.length === 7) dni = '0' + dni;
  const hint = document.getElementById('dniHint');
  const box = document.getElementById('workerBox');
  if(dni.length !== 8){ hint.textContent='Ingresa un DNI de 8 dígitos.'; hint.style.color='#dc2626'; box.classList.remove('on'); return; }
  hint.textContent='Buscando en Azure…'; hint.style.color='#64748b';
  _trabajadorActual = null;
  try{
    const r = await fetch(AZURE_DNI + encodeURIComponent(dni));
    const j = await r.json();
    if(j.trabajadores && j.trabajadores.length){
      const t = j.trabajadores[0];
      _trabajadorActual = {
        dni: String(t.dni || dni),
        nombre: t.nombre_completo || '',
        empresa: t.empresa || '',
        cargo: t.oficio || '',
        regimen: t.regimen || t.tipo_regimen || ''
      };
      document.getElementById('wNombre').textContent = _trabajadorActual.nombre || '(sin nombre)';
      document.getElementById('wMeta').textContent =
        [_trabajadorActual.empresa, _trabajadorActual.cargo, _trabajadorActual.regimen].filter(Boolean).join(' · ') || '—';
      box.classList.add('on');
      const ya = colaboradores.find(c => String(c.dni) === _trabajadorActual.dni);
      if(ya){ hint.textContent='⚠️ Ya está en la lista (comedor: '+(ya.comedor||'—')+').'; hint.style.color='#d97706'; }
      else  { hint.textContent='✓ Colaborador encontrado en '+( _trabajadorActual.empresa||'—')+'.'; hint.style.color='#16a34a'; }
    }else{
      box.classList.remove('on');
      hint.textContent='✗ No se encontró ese DNI en la base.'; hint.style.color='#dc2626';
    }
  }catch(e){
    box.classList.remove('on');
    hint.textContent='Error de conexión con Azure.'; hint.style.color='#dc2626';
  }
}

function toggleMotivoNuevo(){
  const est = document.getElementById('nEstado').value;
  document.getElementById('nObsWrap').style.display = (est === EST_ACTIVO) ? 'block' : 'block'; // observación siempre visible
}

/* ─────────── Agregar colaborador (backend GAS) ─────────── */
async function agregarColaborador(){
  if(!_trabajadorActual){ toast('Busca y selecciona un colaborador primero', true); return; }
  const comedor = document.getElementById('nComedor').value;
  const tipo    = document.getElementById('nTipo').value;
  const estado  = document.getElementById('nEstado').value;
  const obs     = document.getElementById('nObs').value.trim();
  if(!comedor){ toast('Selecciona el comedor', true); return; }
  if(!tipo){ toast('Selecciona el tipo de comida', true); return; }
  if(!estado){ toast('Selecciona el estado', true); return; }

  if(colaboradores.find(c => String(c.dni) === _trabajadorActual.dni)){
    toast('Ese colaborador ya está en la lista', true); return;
  }

  const payload = {
    dni: _trabajadorActual.dni,
    nombre: _trabajadorActual.nombre,
    cargo: _trabajadorActual.cargo,
    regimen: _trabajadorActual.regimen,
    comedor: comedor,
    tipo_comida: tipo,
    estado: estado,
    observacion: obs,
    empresa: _trabajadorActual.empresa   // de Azure → columna I
  };

  const btn = document.getElementById('btnAgregar');
  btn.disabled = true; btn.textContent = 'Guardando…';
  try{
    const d = await apiPost({ action:'addAlmuerzo', colaborador: payload, usuario: USER ? USER.usuario : '' });
    if(d && d.success){
      toast('Colaborador agregado a la programación');
      limpiarNuevo();
      await cargarLista();
      showTab('lista', document.getElementById('tabBtnLista'));
    }else{
      toast('Error al guardar: ' + ((d && d.error) || 'desconocido'), true);
    }
  }catch(e){
    toast('Error de conexión: ' + e.message, true);
  }finally{
    btn.disabled = false; btn.textContent = 'Guardar colaborador';
  }
}

function limpiarNuevo(){
  document.getElementById('dni').value = '';
  document.getElementById('dniHint').textContent = '';
  document.getElementById('workerBox').classList.remove('on');
  document.getElementById('nComedor').selectedIndex = 0;
  document.getElementById('nTipo').selectedIndex = 0;
  document.getElementById('nEstado').value = EST_ACTIVO;
  document.getElementById('nObs').value = '';
  _trabajadorActual = null;
}

/* ─────────── Cargar lista maestra (backend GAS) ─────────── */
async function cargarLista(){
  const tbody = document.getElementById('tbody');
  tbody.innerHTML = '<tr><td colspan="9" class="loading">Cargando lista…</td></tr>';
  try{
    const d = await apiGet({ action:'getAlmuerzos' });
    colaboradores = (d && d.colaboradores) ? d.colaboradores.map(_normalizar) : [];
  }catch(e){
    colaboradores = [];
    tbody.innerHTML = '<tr><td colspan="9" class="empty">No se pudo cargar. Verifica la conexión.</td></tr>';
    return;
  }
  poblarFiltroComedor();
  render();
}

function _normalizar(c){
  return {
    dni: String(c.dni || ''),
    nombre: c.nombre || '',
    cargo: c.cargo || '',
    regimen: c.regimen || '',
    comedor: c.comedor || '',
    tipoComida: (c.tipo_comida || c.tipoComida || '').toUpperCase(),
    estado: (c.estado || '').toUpperCase(),
    observacion: c.observacion || '',
    empresa: c.empresa || ''
  };
}

/* ─────────── Autosave de fila (backend GAS) ─────────── */
async function guardarFila(dni){
  const c = colaboradores.find(x => String(x.dni) === String(dni));
  if(!c) return;
  const tr = document.querySelector('tr[data-dni="'+dni+'"]');
  const flag = tr ? tr.querySelector('.saving') : null;
  if(flag){ flag.textContent = '💾'; flag.style.color='#64748b'; }
  try{
    const d = await apiPost({
      action:'updateAlmuerzo',
      dni: c.dni, comedor: c.comedor, tipo_comida: c.tipoComida,
      estado: c.estado, observacion: c.observacion,
      usuario: USER ? USER.usuario : ''
    });
    if(d && d.success){ if(flag){ flag.textContent='✓'; flag.style.color='#16a34a'; setTimeout(()=>{ if(flag) flag.textContent=''; },1400); } }
    else { if(flag){ flag.textContent='✗'; flag.style.color='#dc2626'; } toast('Error al guardar: '+((d&&d.error)||'desconocido'), true); }
  }catch(e){
    if(flag){ flag.textContent='✗'; flag.style.color='#dc2626'; }
    toast('Error de conexión: '+e.message, true);
  }
  actualizarResumen();
}

function onComedorChange(dni, val){ const c=colaboradores.find(x=>String(x.dni)===String(dni)); if(!c)return; c.comedor=val; guardarFila(dni); }
function onTipoChange(dni, val){ const c=colaboradores.find(x=>String(x.dni)===String(dni)); if(!c)return; c.tipoComida=val; guardarFila(dni); }
function onEstadoChange(dni, val){
  const c=colaboradores.find(x=>String(x.dni)===String(dni)); if(!c)return;
  c.estado=val; render(); guardarFila(dni);
}
function onObsChange(dni, val){ const c=colaboradores.find(x=>String(x.dni)===String(dni)); if(!c)return; c.observacion=val; guardarFila(dni); }

/* ─────────── Resumen (KPIs + motivos) ─────────── */
function actualizarResumen(){
  let activos=0, inactivos=0, almuerzo=0, dieta=0;
  const porMotivo = {};
  colaboradores.forEach(c=>{
    if(esActivo(c)){
      activos++;
      if(c.tipoComida === 'DIETA') dieta++; else almuerzo++;
    }else{
      inactivos++;
      const m = c.estado || 'SIN MOTIVO';
      porMotivo[m] = (porMotivo[m]||0)+1;
    }
  });
  setText('kActivos', activos);
  setText('kInactivos', inactivos);
  setText('kTotal', colaboradores.length);
  setText('kAlmuerzo', almuerzo);
  setText('kDieta', dieta);

  const chips = document.getElementById('motivosChips');
  const keys = Object.keys(porMotivo);
  chips.innerHTML = keys.length
    ? '<span class="mchip" style="color:#94a3b8">Inactivos por motivo:</span>' +
      keys.map(m => '<span class="mchip">'+esc(m)+' <b>'+porMotivo[m]+'</b></span>').join('')
    : '';
}

/* ─────────── Filtro comedor dinámico ─────────── */
function poblarFiltroComedor(){
  const fc = document.getElementById('fComedor');
  const actual = fc.value;
  const set = {};
  COMEDORES.forEach(c=>set[c]=true);
  colaboradores.forEach(c=>{ if(c.comedor) set[c.comedor]=true; });
  fc.innerHTML = '<option value="">Todos los comedores</option>' +
    Object.keys(set).map(c=>'<option'+(c===actual?' selected':'')+'>'+esc(c)+'</option>').join('');
}

/* ─────────── Render tabla ─────────── */
function render(){
  const fBuscar = (document.getElementById('fBuscar').value || '').toLowerCase().trim();
  const fComedor = document.getElementById('fComedor').value;
  const fEstado = document.getElementById('fEstado').value;   // '', 'activo', 'inactivo'
  const fTipo = document.getElementById('fTipo').value;       // '', 'ALMUERZO', 'DIETA'
  const tbody = document.getElementById('tbody');

  const filas = colaboradores.filter(c=>{
    if(fComedor && c.comedor !== fComedor) return false;
    if(fEstado === 'activo' && !esActivo(c)) return false;
    if(fEstado === 'inactivo' && esActivo(c)) return false;
    if(fTipo && c.tipoComida !== fTipo) return false;
    if(fBuscar){ if((c.nombre+' '+c.dni).toLowerCase().indexOf(fBuscar) < 0) return false; }
    return true;
  });

  actualizarResumen();

  if(!filas.length){
    tbody.innerHTML = '<tr><td colspan="9" class="empty">'+(colaboradores.length?'Sin resultados con esos filtros':'No hay colaboradores en la lista')+'</td></tr>';
    return;
  }

  tbody.innerHTML = filas.map(c=>{
    const activo = esActivo(c);
    // comedor (incluye valor actual si no está en la lista base)
    const comedorOpts = COMEDORES.slice();
    if(c.comedor && comedorOpts.indexOf(c.comedor)<0) comedorOpts.unshift(c.comedor);
    const selComedor = '<option value="">—</option>' + comedorOpts.map(co=>'<option'+(co===c.comedor?' selected':'')+'>'+esc(co)+'</option>').join('');
    // tipo comida
    const selTipo = TIPOS_COMIDA.map(t=>'<option'+(t===c.tipoComida?' selected':'')+'>'+esc(t)+'</option>').join('');
    // estado: ACTIVO + motivos (incluye valor actual si no está)
    const estOpts = [EST_ACTIVO].concat(MOTIVOS);
    if(c.estado && estOpts.indexOf(c.estado)<0) estOpts.push(c.estado);
    const selEstado = estOpts.map(e=>'<option'+(e===c.estado?' selected':'')+'>'+esc(e)+'</option>').join('');

    return '<tr data-dni="'+esc(c.dni)+'">'+
      '<td>'+esc(c.dni)+'</td>'+
      '<td><div style="font-weight:600">'+esc(c.nombre)+'</div></td>'+
      '<td>'+esc(c.cargo)+'</td>'+
      '<td>'+esc(c.regimen)+'</td>'+
      '<td>'+(c.empresa?'<span class="badge b-emp">'+esc(c.empresa)+'</span>':'<span style="color:#cbd5e1">—</span>')+'</td>'+
      '<td><select onchange="onComedorChange(\''+esc(c.dni)+'\',this.value)">'+selComedor+'</select></td>'+
      '<td><select class="tipo-'+(c.tipoComida==='DIETA'?'dieta':'almuerzo')+'" onchange="onTipoChange(\''+esc(c.dni)+'\',this.value)">'+selTipo+'</select></td>'+
      '<td><select class="'+(activo?'estado-activo':'estado-inactivo')+'" onchange="onEstadoChange(\''+esc(c.dni)+'\',this.value)">'+selEstado+'</select><span class="saving"></span></td>'+
      '<td><input type="text" class="obs-input" value="'+esc(c.observacion)+'" placeholder="—" onchange="onObsChange(\''+esc(c.dni)+'\',this.value)"></td>'+
    '</tr>';
  }).join('');
}

/* ─────────── Envío de correo ─────────── */
function _construirCuerpo(){
  const activos = colaboradores.filter(esActivo);
  const hoy = new Date().toLocaleDateString('es-PE', {day:'2-digit', month:'long', year:'numeric'});
  const firma = USER ? (USER.nombre || USER.usuario) : '';
  let totalAlm=0, totalDie=0;
  activos.forEach(c=>{ if(c.tipoComida==='DIETA') totalDie++; else totalAlm++; });

  // agrupar por comedor (lista base + comedores extra)
  const comedoresOrden = COMEDORES.slice();
  activos.forEach(c=>{ if(c.comedor && comedoresOrden.indexOf(c.comedor)<0) comedoresOrden.push(c.comedor); });

  let detalle = '';
  comedoresOrden.forEach(co=>{
    const grupo = activos.filter(c => c.comedor === co);
    if(!grupo.length) return;
    const alm = grupo.filter(c=>c.tipoComida!=='DIETA');
    const die = grupo.filter(c=>c.tipoComida==='DIETA');
    detalle += '\n'+co+' ('+grupo.length+')\n';
    if(alm.length){
      detalle += '   Almuerzo ('+alm.length+'):\n';
      alm.forEach((c,i)=>{ detalle += '      '+(i+1)+'. '+c.nombre+(c.observacion?'  ['+c.observacion+']':'')+'\n'; });
    }
    if(die.length){
      detalle += '   Dieta ('+die.length+'):\n';
      die.forEach((c,i)=>{ detalle += '      '+(i+1)+'. '+c.nombre+(c.observacion?'  ['+c.observacion+']':'')+'\n'; });
    }
  });

  return 'Estimada Lucía, buenos días.\n\n'+
    'Adjunto el detalle del personal que se está programando su almuerzo para el día de hoy '+hoy+', '+
    'así mismo los comedores donde han sido designados.\n'+
    '\nTotal con programación activa: '+activos.length+'   (Almuerzo: '+totalAlm+' · Dieta: '+totalDie+')\n'+
    detalle+
    '\nSaludos,\n'+firma;
}

function abrirEnvioCorreo(){
  if(!colaboradores.length){ toast('No hay colaboradores cargados', true); return; }
  const activos = colaboradores.filter(esActivo).length;
  if(!activos){ toast('No hay personal activo para enviar', true); return; }
  document.getElementById('correoPreview').textContent = _construirCuerpo();
  document.getElementById('ovCorreo').classList.add('on');
}
function cerrarEnvioCorreo(){ document.getElementById('ovCorreo').classList.remove('on'); }

async function enviarCorreo(){
  const cuerpo = _construirCuerpo();
  const hoy = new Date().toLocaleDateString('es-PE', {day:'2-digit', month:'2-digit', year:'numeric'});
  const asunto = 'Programación de almuerzos - ' + hoy;

  // Abre Outlook (Microsoft 365) con el correo listo: Para=Lucía, CC=los 4, asunto y cuerpo.
  // El usuario revisa y envía desde SU cuenta (queda en sus Enviados).
  const url = 'https://outlook.office.com/mail/deeplink/compose?'
    + 'to='      + encodeURIComponent(ALM_TO)
    + '&cc='     + encodeURIComponent(ALM_CC)
    + '&subject='+ encodeURIComponent(asunto)
    + '&body='   + encodeURIComponent(cuerpo);
  window.open(url, '_blank');

  cerrarEnvioCorreo();
  toast('Se abrió Outlook con el correo listo. Revísalo y dale Enviar 📤');

  // Registro en bitácora (opcional, no bloquea si el backend no la tiene)
  try{
    await apiPost({
      action:'registrarEnvioAlmuerzos',
      usuario: USER ? USER.usuario : '',
      remitente_nombre: USER ? (USER.nombre || USER.usuario) : ''
    });
  }catch(e){ /* silencioso */ }
}

/* ─────────── Helpers ─────────── */
function setText(id, v){ const el=document.getElementById(id); if(el) el.textContent=v; }
function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
let _toastT;
function toast(msg, err){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.background = err ? '#dc2626' : '#0a2463';
  t.classList.add('on');
  clearTimeout(_toastT);
  _toastT = setTimeout(()=>t.classList.remove('on'), 2800);
}

/* ─────────── API ─────────── */
async function apiGet(p){ const r = await fetch(API + '?' + new URLSearchParams(p)); return r.json(); }
async function apiPost(b){ const r = await fetch(API, { method:'POST', body:JSON.stringify(b), headers:{'Content-Type':'text/plain'} }); return r.json(); }

/* ─────────── Poblar selects fijos (pestaña agregar) ─────────── */
function poblarSelectsFijos(){
  const nc = document.getElementById('nComedor');
  nc.innerHTML = '<option value="">— Seleccionar —</option>' + COMEDORES.map(c=>'<option>'+c+'</option>').join('');
  const nt = document.getElementById('nTipo');
  nt.innerHTML = '<option value="">— Seleccionar —</option>' + TIPOS_COMIDA.map(t=>'<option>'+t+'</option>').join('');
  const ne = document.getElementById('nEstado');
  ne.innerHTML = '<option value="'+EST_ACTIVO+'">ACTIVO (recibe)</option>' + MOTIVOS.map(m=>'<option>'+m+'</option>').join('');
}

/* ─────────── INIT ─────────── */
document.addEventListener('DOMContentLoaded', () => {
  const ud = sessionStorage.getItem('user');
  API = sessionStorage.getItem('api') || '';
  if(!ud || !API){ location.href = '../../index.html'; return; }
  USER = JSON.parse(ud);

  // ─── Control de acceso: solo administradores + smiranda ───
  var _permitidos = ['jtimoteo','ovilela','jchavez','smiranda'];
  if(_permitidos.indexOf((USER.usuario||'').toLowerCase().trim()) < 0){
    alert('No tienes acceso a este módulo.');
    location.href = 'dashboard.html';
    return;
  }

  const el = document.getElementById('topNombre');
  if(el) el.textContent = USER.nombre || USER.usuario || '';

  poblarSelectsFijos();
  document.getElementById('dni').addEventListener('keydown', e=>{ if(e.key==='Enter') buscarDni(); });

  cargarLista();
});

/* ─────────── Exposiciones para onclick ─────────── */
window.showTab = showTab;
window.buscarDni = buscarDni;
window.toggleMotivoNuevo = toggleMotivoNuevo;
window.agregarColaborador = agregarColaborador;
window.limpiarNuevo = limpiarNuevo;
window.onComedorChange = onComedorChange;
window.onTipoChange = onTipoChange;
window.onEstadoChange = onEstadoChange;
window.onObsChange = onObsChange;
window.render = render;
window.abrirEnvioCorreo = abrirEnvioCorreo;
window.cerrarEnvioCorreo = cerrarEnvioCorreo;
window.enviarCorreo = enviarCorreo;
