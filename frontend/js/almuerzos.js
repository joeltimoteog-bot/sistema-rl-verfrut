'use strict';
/* ════════════════════════════════════════════════════════════════
   Programador de Almuerzos — Sistema RR.LL. (Verfrut / Rapel · Unifrutti)
   Patrón estándar: sesión por sessionStorage + apiGet/apiPost al GAS.
   Búsqueda DNI anclada a Azure. Lista maestra editable con autosave.
   Hojas: "PROGRAMACION DE ALMUERZOS" (maestro A-G) · "BB.ALMUERZOS" (bitácora envíos)
   Backend (getAlmuerzos / updateAlmuerzo / addAlmuerzo / enviarResumenAlmuerzos) = Fase 2.
   ════════════════════════════════════════════════════════════════ */

let API  = '';
let USER = null;
let colaboradores = [];        // lista maestra normalizada
let _trabajadorActual = null;  // para agregar nuevo

const AZURE_DNI = 'https://rl-functions-verfrut-c0ctfjc0cjf5f0hz.brazilsouth-01.azurewebsites.net/api/trabajadores/buscar?dni=';

const COMEDORES = [
  'Comedor administrativo',
  'Comedor general',
  'Comedor campamento',
  'Comedor san rafael'
];
const MOTIVOS = ['VACACIONES','PERMISO','SUSPENSION','CESE','DESCANSO MEDICO'];
const EST_ACTIVO   = 'ALMUERZO ACTIVO';
const EST_INACTIVO = 'ALMUERZO INACTIVO';

/* ─────────── Tabs ─────────── */
function showTab(tab, btn){
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('on'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('on'));
  const tc = document.getElementById('tab-' + tab);
  if(tc) tc.classList.add('on');
  if(btn) btn.classList.add('on');
  if(tab === 'lista') cargarLista();
}

/* ─────────── Búsqueda DNI (Azure) ─────────── */
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
      // ¿ya existe en la lista?
      const ya = colaboradores.find(c => String(c.dni) === _trabajadorActual.dni);
      if(ya){ hint.textContent='⚠️ Este colaborador ya está en la lista (comedor: '+(ya.comedor||'—')+').'; hint.style.color='#d97706'; }
      else  { hint.textContent='✓ Colaborador encontrado.'; hint.style.color='#16a34a'; }
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
  document.getElementById('nMotivoWrap').style.display = (est === EST_INACTIVO) ? 'block' : 'none';
}

/* ─────────── Agregar colaborador (backend GAS) ─────────── */
async function agregarColaborador(){
  if(!_trabajadorActual){ toast('Busca y selecciona un colaborador primero', true); return; }
  const comedor = document.getElementById('nComedor').value;
  const estado  = document.getElementById('nEstado').value;
  const motivo  = (estado === EST_INACTIVO) ? document.getElementById('nMotivo').value : '';
  if(!comedor){ toast('Selecciona el comedor', true); return; }
  if(estado === EST_INACTIVO && !motivo){ toast('Selecciona el motivo de inactividad', true); return; }

  if(colaboradores.find(c => String(c.dni) === _trabajadorActual.dni)){
    toast('Ese colaborador ya está en la lista', true); return;
  }

  const payload = {
    dni: _trabajadorActual.dni,
    nombre: _trabajadorActual.nombre,
    cargo: _trabajadorActual.cargo,
    regimen: _trabajadorActual.regimen,
    comedor: comedor,
    estado: estado,
    motivo: motivo
  };

  const btn = document.getElementById('btnAgregar');
  btn.disabled = true; btn.textContent = 'Guardando…';
  try{
    const d = await apiPost({ action:'addAlmuerzo', colaborador: payload, usuario: USER ? USER.usuario : '' });
    if(d && d.success){
      toast('Colaborador agregado a la programación');
      limpiarNuevo();
      await cargarLista();
      // saltar a la pestaña lista
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
  document.getElementById('nEstado').value = EST_ACTIVO;
  toggleMotivoNuevo();
  _trabajadorActual = null;
}

/* ─────────── Cargar lista maestra (backend GAS) ─────────── */
async function cargarLista(){
  const tbody = document.getElementById('tbody');
  tbody.innerHTML = '<tr><td colspan="7" class="loading">Cargando lista…</td></tr>';
  try{
    const d = await apiGet({ action:'getAlmuerzos' });
    colaboradores = (d && d.colaboradores) ? d.colaboradores.map(_normalizar) : [];
  }catch(e){
    colaboradores = [];
    tbody.innerHTML = '<tr><td colspan="7" class="empty">No se pudo cargar. Verifica la conexión.</td></tr>';
    return;
  }
  render();
}

function _normalizar(c){
  return {
    dni: String(c.dni || ''),
    nombre: c.nombre || '',
    cargo: c.cargo || '',
    regimen: c.regimen || '',
    comedor: c.comedor || '',
    estado: (c.estado || EST_ACTIVO).toUpperCase().indexOf('INACTIVO') >= 0 ? EST_INACTIVO : EST_ACTIVO,
    motivo: c.motivo || ''
  };
}

/* ─────────── Autosave de fila (backend GAS) ─────────── */
async function guardarFila(dni){
  const c = colaboradores.find(x => String(x.dni) === String(dni));
  if(!c) return;
  const tr = document.querySelector('tr[data-dni="'+dni+'"]');
  const flag = tr ? tr.querySelector('.saving') : null;
  if(flag){ flag.textContent = '💾 guardando…'; flag.style.color='#64748b'; }
  try{
    const d = await apiPost({
      action:'updateAlmuerzo',
      dni: c.dni, comedor: c.comedor, estado: c.estado, motivo: c.motivo,
      usuario: USER ? USER.usuario : ''
    });
    if(d && d.success){ if(flag){ flag.textContent='✓ guardado'; flag.style.color='#16a34a'; setTimeout(()=>{ if(flag) flag.textContent=''; },1500); } }
    else { if(flag){ flag.textContent='✗ error'; flag.style.color='#dc2626'; } toast('Error al guardar: '+((d&&d.error)||'desconocido'), true); }
  }catch(e){
    if(flag){ flag.textContent='✗ error'; flag.style.color='#dc2626'; }
    toast('Error de conexión: '+e.message, true);
  }
  actualizarResumen();
}

/* Cambios desde los <select> de la tabla */
function onComedorChange(dni, val){
  const c = colaboradores.find(x => String(x.dni)===String(dni)); if(!c) return;
  c.comedor = val; guardarFila(dni);
}
function onEstadoChange(dni, val){
  const c = colaboradores.find(x => String(x.dni)===String(dni)); if(!c) return;
  c.estado = val;
  if(val === EST_ACTIVO) c.motivo = '';  // activo no lleva motivo
  render();          // re-render para mostrar/ocultar el select de motivo
  guardarFila(dni);
}
function onMotivoChange(dni, val){
  const c = colaboradores.find(x => String(x.dni)===String(dni)); if(!c) return;
  c.motivo = val; guardarFila(dni);
}

/* ─────────── Resumen (KPIs + motivos) ─────────── */
function actualizarResumen(){
  let activos=0, inactivos=0;
  const porMotivo = {};
  colaboradores.forEach(c=>{
    if(c.estado === EST_INACTIVO){ inactivos++; const m=c.motivo||'SIN MOTIVO'; porMotivo[m]=(porMotivo[m]||0)+1; }
    else activos++;
  });
  setText('kActivos', activos);
  setText('kInactivos', inactivos);
  setText('kTotal', colaboradores.length);

  const chips = document.getElementById('motivosChips');
  const keys = Object.keys(porMotivo);
  if(!keys.length){ chips.innerHTML=''; return; }
  chips.innerHTML = '<span class="mchip" style="color:#94a3b8">Inactivos por motivo:</span>' +
    keys.map(m => '<span class="mchip">'+esc(m)+' <b>'+porMotivo[m]+'</b></span>').join('');
}

/* ─────────── Render tabla ─────────── */
function render(){
  const fBuscar = (document.getElementById('fBuscar').value || '').toLowerCase().trim();
  const fComedor = document.getElementById('fComedor').value;
  const fEstado = document.getElementById('fEstado').value;
  const tbody = document.getElementById('tbody');

  const filas = colaboradores.filter(c=>{
    if(fComedor && c.comedor !== fComedor) return false;
    if(fEstado && c.estado !== fEstado) return false;
    if(fBuscar){
      const hay = (c.nombre+' '+c.dni).toLowerCase();
      if(hay.indexOf(fBuscar) < 0) return false;
    }
    return true;
  });

  actualizarResumen();

  if(!filas.length){
    tbody.innerHTML = '<tr><td colspan="7" class="empty">'+(colaboradores.length?'Sin resultados con esos filtros':'No hay colaboradores en la lista')+'</td></tr>';
    return;
  }

  tbody.innerHTML = filas.map(c=>{
    const inactivo = c.estado === EST_INACTIVO;
    const optComedor = COMEDORES.map(co => '<option'+(co===c.comedor?' selected':'')+'>'+esc(co)+'</option>').join('');
    const comedorSel = (c.comedor && COMEDORES.indexOf(c.comedor)<0)
      ? '<option selected>'+esc(c.comedor)+'</option>'+optComedor : optComedor;
    const optMotivo = ['<option value="">— Seleccionar —</option>'].concat(
      MOTIVOS.map(m => '<option'+(m===c.motivo?' selected':'')+'>'+esc(m)+'</option>')).join('');

    return '<tr data-dni="'+esc(c.dni)+'">'+
      '<td>'+esc(c.dni)+'</td>'+
      '<td><div style="font-weight:600">'+esc(c.nombre)+'</div></td>'+
      '<td>'+esc(c.cargo)+'</td>'+
      '<td>'+esc(c.regimen)+'</td>'+
      '<td><select onchange="onComedorChange(\''+esc(c.dni)+'\',this.value)"><option value="">—</option>'+comedorSel+'</select></td>'+
      '<td><select class="'+(inactivo?'estado-inactivo':'estado-activo')+'" onchange="onEstadoChange(\''+esc(c.dni)+'\',this.value)">'+
        '<option value="'+EST_ACTIVO+'"'+(!inactivo?' selected':'')+'>Activo</option>'+
        '<option value="'+EST_INACTIVO+'"'+(inactivo?' selected':'')+'>Inactivo</option>'+
        '</select><span class="saving"></span></td>'+
      '<td>'+(inactivo
        ? '<select onchange="onMotivoChange(\''+esc(c.dni)+'\',this.value)">'+optMotivo+'</select>'
        : '<span style="color:#cbd5e1">—</span>')+'</td>'+
    '</tr>';
  }).join('');
}

/* ─────────── Envío de correo ─────────── */
function _construirCuerpo(){
  const activos = colaboradores.filter(c => c.estado === EST_ACTIVO);
  const hoy = new Date().toLocaleDateString('es-PE', {day:'2-digit', month:'long', year:'numeric'});
  const firma = USER ? (USER.nombre || USER.usuario) : '';

  let detalle = '';
  COMEDORES.forEach(co=>{
    const grupo = activos.filter(c => c.comedor === co);
    if(grupo.length){
      detalle += '\n' + co.toUpperCase() + ' ('+grupo.length+')\n';
      grupo.forEach((c,i)=>{ detalle += '   '+(i+1)+'. '+c.nombre+'\n'; });
    }
  });
  // comedores fuera de la lista fija
  const otros = activos.filter(c => COMEDORES.indexOf(c.comedor) < 0);
  if(otros.length){
    detalle += '\nOTROS\n';
    otros.forEach((c,i)=>{ detalle += '   '+(i+1)+'. '+c.nombre+' ('+(c.comedor||'sin comedor')+')\n'; });
  }

  return 'Estimada Lucía, buenos días.\n\n'+
    'Adjunto el detalle del personal que se está programando su almuerzo para el día de hoy '+hoy+', '+
    'así mismo los comedores donde han sido designados.\n'+
    '\nTotal de personal con almuerzo activo: '+activos.length+'\n'+
    detalle+
    '\nSaludos,\n'+firma;
}

function abrirEnvioCorreo(){
  if(!colaboradores.length){ toast('No hay colaboradores cargados', true); return; }
  const activos = colaboradores.filter(c => c.estado === EST_ACTIVO).length;
  if(!activos){ toast('No hay personal con almuerzo activo para enviar', true); return; }
  document.getElementById('correoPreview').textContent = _construirCuerpo();
  document.getElementById('ovCorreo').classList.add('on');
}
function cerrarEnvioCorreo(){ document.getElementById('ovCorreo').classList.remove('on'); }

async function enviarCorreo(){
  const btn = document.getElementById('btnEnviar');
  btn.disabled = true; btn.textContent = 'Enviando…';
  try{
    const d = await apiPost({
      action:'enviarResumenAlmuerzos',
      cuerpo: _construirCuerpo(),
      usuario: USER ? USER.usuario : '',
      remitente_nombre: USER ? (USER.nombre || USER.usuario) : ''
    });
    if(d && d.success){
      cerrarEnvioCorreo();
      toast('Correo enviado a Lucía ✓ ('+(d.activos!=null?d.activos+' activos':'enviado')+')');
    }else{
      toast('Error al enviar: ' + ((d && d.error) || 'desconocido'), true);
    }
  }catch(e){
    toast('Error de conexión: ' + e.message, true);
  }finally{
    btn.disabled = false; btn.textContent = 'Enviar correo';
  }
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

/* ─────────── API (mismo patrón que capacitaciones/preaviso) ─────────── */
async function apiGet(p){
  const r = await fetch(API + '?' + new URLSearchParams(p));
  return r.json();
}
async function apiPost(b){
  const r = await fetch(API, { method:'POST', body:JSON.stringify(b), headers:{'Content-Type':'text/plain'} });
  return r.json();
}

/* ─────────── Poblar selects fijos ─────────── */
function poblarSelectsFijos(){
  // filtro comedor
  const fc = document.getElementById('fComedor');
  COMEDORES.forEach(co=>{ const o=document.createElement('option'); o.value=co; o.textContent=co; fc.appendChild(o); });
  // nuevo: comedor
  const nc = document.getElementById('nComedor');
  nc.innerHTML = '<option value="">— Seleccionar —</option>';
  COMEDORES.forEach(co=>{ const o=document.createElement('option'); o.value=co; o.textContent=co; nc.appendChild(o); });
  // nuevo: motivo
  const nm = document.getElementById('nMotivo');
  nm.innerHTML = '<option value="">— Seleccionar —</option>';
  MOTIVOS.forEach(m=>{ const o=document.createElement('option'); o.value=m; o.textContent=m; nm.appendChild(o); });
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
window.onEstadoChange = onEstadoChange;
window.onMotivoChange = onMotivoChange;
window.render = render;
window.abrirEnvioCorreo = abrirEnvioCorreo;
window.cerrarEnvioCorreo = cerrarEnvioCorreo;
window.enviarCorreo = enviarCorreo;
