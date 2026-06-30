'use strict';
/* ════════════════════════════════════════════════════════════
   Cartas de Preaviso — Sistema RR.LL. (Verfrut / Rapel · Unifrutti)
   Patrón estándar: sesión por sessionStorage + apiGet/apiPost al GAS.
   Búsqueda DNI anclada a Azure. Plazo en días NATURALES (Art.31 D.S.003-97-TR).
   Backend (acciones savePreaviso/getPreavisos/updatePreavisoDesenlace) = Fase 2.
   ════════════════════════════════════════════════════════════ */

let API  = '';
let USER = null;
let preavisos = [];
let _trabajadorActual = null;
let _desenlaceNro = null;

const PLAZO_DEFAULT = 6;
const AZURE_DNI = 'https://rl-functions-verfrut-c0ctfjc0cjf5f0hz.brazilsouth-01.azurewebsites.net/api/trabajadores/buscar?dni=';

/* ─────────── Utilidades fecha (días naturales) ─────────── */
function hoyISO(){ return new Date().toISOString().split('T')[0]; }
function sumarDiasNaturales(fechaISO, dias){
  const d = new Date(fechaISO + 'T00:00:00');
  d.setDate(d.getDate() + Number(dias));
  return d.toISOString().split('T')[0];
}
function diasEntre(desdeISO, hastaISO){
  const a = new Date(desdeISO + 'T00:00:00');
  const b = new Date(hastaISO + 'T00:00:00');
  return Math.round((b - a) / 86400000);
}
function fmtFecha(iso){
  if(!iso) return '—';
  const d = new Date(String(iso).split('T')[0] + 'T00:00:00');
  return d.toLocaleDateString('es-PE', {day:'2-digit', month:'short', year:'numeric'});
}

/* ─────────── Tabs ─────────── */
function showTab(tab, btn){
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('on'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('on'));
  const tc = document.getElementById('tab-' + tab);
  if(tc) tc.classList.add('on');
  if(btn) btn.classList.add('on');
  if(tab === 'registros') cargarPreavisos();
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
        sector: t.zona_labor || ''
      };
      document.getElementById('wNombre').textContent = _trabajadorActual.nombre || '(sin nombre)';
      document.getElementById('wMeta').textContent =
        [_trabajadorActual.empresa, _trabajadorActual.cargo, _trabajadorActual.sector].filter(Boolean).join(' · ') || '—';
      box.classList.add('on');
      hint.textContent='✓ Trabajador encontrado.'; hint.style.color='#16a34a';
    }else{
      box.classList.remove('on');
      hint.textContent='✗ No se encontró ese DNI en la base.'; hint.style.color='#dc2626';
    }
  }catch(e){
    box.classList.remove('on');
    hint.textContent='Error de conexión con Azure.'; hint.style.color='#dc2626';
  }
}

/* ─────────── Plazo ─────────── */
function recalcLimite(){
  const fe = document.getElementById('fechaEmision').value;
  let plazo = Number(document.getElementById('plazo').value) || PLAZO_DEFAULT;
  if(plazo < PLAZO_DEFAULT){ plazo = PLAZO_DEFAULT; document.getElementById('plazo').value = PLAZO_DEFAULT; }
  const box = document.getElementById('limiteBox');
  if(!fe){ box.classList.remove('on'); return; }
  const limite = sumarDiasNaturales(fe, plazo);
  document.getElementById('fechaLimiteTxt').textContent = fmtFecha(limite);
  const restantes = diasEntre(hoyISO(), limite);
  let info;
  if(restantes > 0) info = 'Faltan ' + restantes + ' día(s) naturales.';
  else if(restantes === 0) info = 'Vence hoy.';
  else info = 'Venció hace ' + Math.abs(restantes) + ' día(s).';
  document.getElementById('diasInfo').textContent = info;
  box.classList.add('on');
}

/* ─────────── Estado / semáforo ─────────── */
function calcularEstado(p){
  const des = String(p.desenlace || '').toLowerCase();
  if(des === 'cerrado')    return {key:'cerrado',   label:'Cerrado / Entregado', cls:'b-cerrado', dias:null};
  if(des === 'sinefecto') return {key:'sinefecto', label:'Sin efecto', cls:'b-sinefecto', dias:null};
  if(des === 'despido')   return {key:'despido',   label:'Procede despido', cls:'b-despido', dias:null};
  const restantes = diasEntre(hoyISO(), String(p.fechaLimite).split('T')[0]);
  if(restantes < 0)  return {key:'vencido',   label:'Vencido', cls:'b-vencido', dias:restantes};
  if(restantes <= 2) return {key:'porvencer', label:'Por vencer', cls:'b-porvencer', dias:restantes};
  return {key:'plazo', label:'Aún en plazo', cls:'b-plazo', dias:restantes};
}

/* ─────────── Guardar (backend GAS) ─────────── */
async function guardarPreaviso(){
  if(!_trabajadorActual){ toast('Busca y selecciona un trabajador primero', true); return; }
  const tipo = document.getElementById('tipoFalta').value;
  const hechos = document.getElementById('hechos').value.trim();
  const fe = document.getElementById('fechaEmision').value;
  let plazo = Number(document.getElementById('plazo').value) || PLAZO_DEFAULT;
  if(plazo < PLAZO_DEFAULT) plazo = PLAZO_DEFAULT;
  if(!tipo){ toast('Selecciona el tipo de falta', true); return; }
  if(!hechos){ toast('Describe los hechos', true); return; }
  if(!fe){ toast('Indica la fecha de emisión', true); return; }

  const payload = {
    dni: _trabajadorActual.dni,
    nombre: _trabajadorActual.nombre,
    empresa: _trabajadorActual.empresa,
    cargo: _trabajadorActual.cargo,
    sector: _trabajadorActual.sector,
    tipo_falta: tipo,
    hechos: hechos,
    fecha_emision: fe,
    plazo: plazo,
    fecha_limite: sumarDiasNaturales(fe, plazo),
    registrado_por: USER ? (USER.nombre || USER.usuario) : '',
    usuario: USER ? USER.usuario : ''
  };

  const btn = document.getElementById('btnGuardar');
  btn.disabled = true; btn.textContent = 'Guardando…';
  try{
    const d = await apiPost({ action: 'savePreaviso', preaviso: payload });
    if(d && d.success){
      toast('Preaviso registrado (N° ' + (d.nro || '—') + ')');
      limpiarForm();
      await cargarPreavisos();
    }else{
      toast('Error al guardar: ' + ((d && d.error) || 'desconocido'), true);
    }
  }catch(e){
    toast('Error de conexión: ' + e.message, true);
  }finally{
    btn.disabled = false; btn.textContent = 'Registrar preaviso';
  }
}

function limpiarForm(){
  document.getElementById('dni').value = '';
  document.getElementById('dniHint').textContent = '';
  document.getElementById('workerBox').classList.remove('on');
  document.getElementById('tipoFalta').value = '';
  document.getElementById('hechos').value = '';
  document.getElementById('fechaEmision').value = hoyISO();
  document.getElementById('plazo').value = PLAZO_DEFAULT;
  recalcLimite();
  _trabajadorActual = null;
}

/* ─────────── Cargar lista (backend GAS) ─────────── */
async function cargarPreavisos(){
  const tbody = document.getElementById('tbody');
  tbody.innerHTML = '<tr><td colspan="8" class="loading">Cargando…</td></tr>';
  try{
    const d = await apiGet({ action: 'getPreavisos' });
    preavisos = (d && d.preavisos) ? d.preavisos.map(_normalizar) : [];
  }catch(e){
    preavisos = [];
    tbody.innerHTML = '<tr><td colspan="8" class="empty">No se pudo cargar. Verifica la conexión.</td></tr>';
    return;
  }
  render();
  actualizarBanner();
}

/* ─────────── Banner de alerta (1 día antes / vence hoy, sin desenlace) ─────────── */
function actualizarBanner(){
  const banner = document.getElementById('alertBanner');
  const txt = document.getElementById('alertBannerTxt');
  const pendientes = preavisos.filter(p=>{
    if(p.desenlace) return false; // ya tiene desenlace (cerrado/sin efecto/despido)
    const restantes = diasEntre(hoyISO(), String(p.fechaLimite).split('T')[0]);
    return restantes === 0 || restantes === 1;
  });
  if(!pendientes.length){ banner.classList.remove('on'); return; }
  const hoy = pendientes.filter(p=>diasEntre(hoyISO(), String(p.fechaLimite).split('T')[0])===0).length;
  const manana = pendientes.length - hoy;
  let partes = [];
  if(hoy)    partes.push(hoy + ' vence' + (hoy>1?'n':'') + ' HOY');
  if(manana) partes.push(manana + ' vence' + (manana>1?'n':'') + ' mañana');
  txt.innerHTML = '<b>' + pendientes.length + ' preaviso' + (pendientes.length>1?'s':'') + ' requiere' + (pendientes.length>1?'n':'') + ' atención:</b> ' +
    partes.join(' · ') + '. Si el trabajador ya respondió, márcalo como <b>Cerrado / Entregado</b>.';
  banner.classList.add('on');
}

// Normaliza campos del backend a los que usa el front
function _normalizar(p){
  return {
    nro: p.nro,
    dni: p.dni, nombre: p.nombre, empresa: p.empresa, cargo: p.cargo, sector: p.sector,
    tipoFalta: p.tipo_falta || p.tipoFalta || '',
    hechos: p.hechos || '',
    fechaEmision: String(p.fecha_emision || p.fechaEmision || '').split('T')[0],
    plazo: p.plazo || PLAZO_DEFAULT,
    fechaLimite: String(p.fecha_limite || p.fechaLimite || '').split('T')[0],
    desenlace: p.desenlace || '',
    observacion: p.observacion || ''
  };
}

/* ─────────── Desenlace ─────────── */
function abrirDesenlace(nro){
  const p = preavisos.find(x=>String(x.nro)===String(nro)); if(!p) return;
  _desenlaceNro = nro;
  document.getElementById('desenlaceWho').textContent = p.nombre + ' · DNI ' + p.dni;
  document.getElementById('dEstado').value = 'sinefecto';
  document.getElementById('dObs').value = p.observacion || '';
  document.getElementById('ovDesenlace').classList.add('on');
}
function cerrarDesenlace(){ document.getElementById('ovDesenlace').classList.remove('on'); _desenlaceNro=null; }

async function guardarDesenlace(){
  const p = preavisos.find(x=>String(x.nro)===String(_desenlaceNro)); if(!p) return;
  const estado = document.getElementById('dEstado').value;
  const obs = document.getElementById('dObs').value.trim();
  const btn = document.getElementById('btnDesenlace');
  btn.disabled = true; btn.textContent = 'Guardando…';
  try{
    const d = await apiPost({ action: 'updatePreavisoDesenlace', nro: p.nro, desenlace: estado, observacion: obs, usuario: USER ? USER.usuario : '' });
    if(d && d.success){
      cerrarDesenlace();
      toast('Desenlace registrado');
      await cargarPreavisos();
    }else{
      toast('Error: ' + ((d && d.error) || 'desconocido'), true);
    }
  }catch(e){
    toast('Error de conexión: ' + e.message, true);
  }finally{
    btn.disabled = false; btn.textContent = 'Guardar desenlace';
  }
}

/* ─────────── Render ─────────── */
function render(){
  const filtro = document.getElementById('fEstado').value;
  const tbody = document.getElementById('tbody');
  let total=0, plazo=0, vencidos=0, resueltos=0;

  const filas = preavisos.map(p=>{
    const e = calcularEstado(p);
    total++;
    if(e.key==='plazo'||e.key==='porvencer') plazo++;
    if(e.key==='vencido') vencidos++;
    if(e.key==='sinefecto'||e.key==='despido'||e.key==='cerrado') resueltos++;
    return {p, e};
  }).filter(x => !filtro || x.e.key===filtro);

  setText('kTotal', total); setText('kPlazo', plazo);
  setText('kVencidos', vencidos); setText('kResueltos', resueltos);

  if(!filas.length){
    tbody.innerHTML = '<tr><td colspan="8" class="empty">'+(preavisos.length?'Sin resultados con ese filtro':'Sin preavisos registrados todavía')+'</td></tr>';
    return;
  }
  tbody.innerHTML = filas.map(({p,e})=>{
    let diasTxt = '—';
    if(e.dias !== null){
      if(e.dias > 0) diasTxt = '<span class="dias-chip" style="color:#16a34a">'+e.dias+'</span>';
      else if(e.dias === 0) diasTxt = '<span class="dias-chip" style="color:#d97706">hoy</span>';
      else diasTxt = '<span class="dias-chip" style="color:#dc2626">+'+Math.abs(e.dias)+'</span>';
    }
    const puede = !p.desenlace;
    return '<tr>'+
      '<td>'+esc(p.nro)+'</td>'+
      '<td><div style="font-weight:600">'+esc(p.nombre)+'</div><div style="color:#94a3b8;font-size:11px">'+esc(p.dni)+' · '+esc(p.empresa)+'</div></td>'+
      '<td>'+esc(p.tipoFalta)+'</td>'+
      '<td>'+fmtFecha(p.fechaEmision)+'</td>'+
      '<td>'+fmtFecha(p.fechaLimite)+'</td>'+
      '<td>'+diasTxt+'</td>'+
      '<td><span class="badge '+e.cls+'">'+e.label+'</span></td>'+
      '<td>'+(puede ? '<button class="btn btn-ghost btn-sm" onclick="abrirDesenlace(\''+esc(p.nro)+'\')">Desenlace</button>' : '<span style="color:#94a3b8;font-size:11px">resuelto</span>')+'</td>'+
    '</tr>';
  }).join('');
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
  _toastT = setTimeout(()=>t.classList.remove('on'), 2600);
}

/* ─────────── API (mismo patrón que capacitaciones) ─────────── */
async function apiGet(p){
  const r = await fetch(API + '?' + new URLSearchParams(p));
  return r.json();
}
async function apiPost(b){
  const r = await fetch(API, { method:'POST', body:JSON.stringify(b), headers:{'Content-Type':'text/plain'} });
  return r.json();
}

/* ─────────── INIT ─────────── */
document.addEventListener('DOMContentLoaded', () => {
  const ud = sessionStorage.getItem('user');
  API = sessionStorage.getItem('api') || '';
  if(!ud || !API){ location.href = '../../index.html'; return; }
  USER = JSON.parse(ud);
  const el = document.getElementById('topNombre');
  if(el) el.textContent = USER.nombre || USER.usuario || '';

  document.getElementById('fechaEmision').value = hoyISO();
  recalcLimite();
  document.getElementById('dni').addEventListener('keydown', e=>{ if(e.key==='Enter') buscarDni(); });

  cargarPreavisos();
});

/* ─────────── Exposiciones para onclick ─────────── */
window.showTab = showTab;
window.buscarDni = buscarDni;
window.recalcLimite = recalcLimite;
window.guardarPreaviso = guardarPreaviso;
window.limpiarForm = limpiarForm;
window.abrirDesenlace = abrirDesenlace;
window.cerrarDesenlace = cerrarDesenlace;
window.guardarDesenlace = guardarDesenlace;
window.render = render;
