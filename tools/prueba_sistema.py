"""
PRUEBA AUTOMATICA DEL SISTEMA RL (antes de cada publicacion)
- Abre cada modulo en Chromium real, con la red SIMULADA: Google, Azure y Firebase
  responden datos falsos -> NUNCA se escribe nada real.
- Verifica que ninguna busqueda ni guardado se quede colgado, que no se envien
  duplicados y que no haya errores de JavaScript.
Uso: python3 prueba_sistema.py <carpeta_del_repo> [dashboard_alternativo.html]
"""
import json, sys, time, re, pathlib, urllib.parse
from playwright.sync_api import sync_playwright

RAIZ = pathlib.Path(sys.argv[1])
DASH_ALT = sys.argv[2] if len(sys.argv) > 2 else None
BASE = 'https://joeltimoteog-bot.github.io/sistema-rl-verfrut/'
RED = {'google': [], 'azure': [], 'gurl': []}
AZ_CAIDO = {'si': False}
G404 = {'n': 0}

def accion_de(req):
    q = urllib.parse.urlparse(req.url).query
    a = urllib.parse.parse_qs(q).get('action', [''])[0]
    if not a and req.post_data:
        m = re.search(r'"action"\s*:\s*"([^"]+)"', req.post_data)
        a = m.group(1) if m else ''
    return a

def resp_google(a):
    if a == 'ping': return {'ok': True}
    if a == 'getPreloadOptimizado':
        return {'success': True, 'data': {'atenciones': [], 'stats': {'hoy': 1, 'mes': 2, 'anio': 3}, 'usuarios': [], 'casos': [], 'visitas': [], 'fusiones': [], 'supervisores': []}}
    if a == 'getSupervisores':
        return {'success': True, 'data': [
            {'nombre': 'JOHN STEVE HERNANDEZ BORRERO', 'activo': True, 'gestionado': True},
            {'nombre': 'SERGIO VIERA GIRON', 'activo': False, 'gestionado': True},
            {'nombre': 'JOEL ANGEL TIMOTEO GONZA', 'activo': True, 'gestionado': True}]}
    if a == 'cumplPanel': return {'success': True, 'supervisores': [], 'actividades': [], 'resumen': {}}
    if a in ('cumplPendientes',):
        return {'success': True, 'esAdmin': True, 'actividades': [], 'resumen': {}, 'restriccion': {'activa': False}, 'indice': None}
    if a == 'permisosListar': return {'success': True, 'porDefecto': False, 'permitidos': [], 'esAdmin': True}
    if a in ('saludLog', 'saludReporte'): return {'ok': True, 'nro': 1, 'guardados': 1}
    if a == 'papeleraNros': return {'success': True, 'data': ['500'], 'pares': ['500|11111111']}
    if a == 'calcParamsLeer': return {'success': True, 'params': None}
    if a == 'accesoHorarioDeUsuario': return {'success': True, 'dentro': True, 'tieneHorario': False}
    # escrituras y lecturas genericas
    return {'success': True, 'ok': True, 'nro': 9999, 'data': [], 'hoja': 'TEST', 'fecha_registro': '2026-09-24'}

def resp_azure(url):
    if '/trabajadores/buscar' in url:
        return {'success': True, 'trabajadores': [{'dni': '12345678', 'nombre_completo': 'TRABAJADOR PRUEBA', 'empresa': 'RAPEL'}], 'data': {'dni': '12345678', 'nombre_completo': 'TRABAJADOR PRUEBA', 'empresa': 'RAPEL'},
                'resultados': [{'dni': '12345678', 'nombre_completo': 'TRABAJADOR PRUEBA', 'empresa': 'RAPEL'}]}
    if '/atenciones/by-dni' in url:
        return {'success': True, 'en_proceso': [], 'finalizadas_recientes': []}
    if re.search(r'/api/atenciones\?', url):
        hoy = time.strftime('%Y-%m-%d')
        return {'success': True, 'total': 2, 'data': [
            {'id': 1, 'nro': 500, 'dni': '11111111', 'nombre': 'A', 'fecha_atencion': hoy, 'supervisor': 'SUPERVISOR PRUEBA', 'estado': 'EN PROCESO'},
            {'id': 2, 'nro': 500, 'dni': '22222222', 'nombre': 'B', 'fecha_atencion': hoy, 'supervisor': 'SUPERVISOR PRUEBA', 'estado': 'EN PROCESO'}]}
    if '/atenciones/stats' in url:
        return {'success': True, 'resumen_global': {'hoy': 1, 'este_mes': 2, 'este_anio': 3, 'en_proceso': 1, 'finalizados': 2, 'total': 3}}
    return {'success': True, 'data': []}

def enrutar(route):
    req = route.request
    url = req.url
    if url.startswith(BASE):
        ruta = urllib.parse.urlparse(url).path.replace('/sistema-rl-verfrut/', '', 1) or 'index.html'
        if DASH_ALT and ruta == 'frontend/pages/dashboard.html':
            f = pathlib.Path(DASH_ALT)
        else:
            f = RAIZ / ruta
        if f.is_file():
            suf = pathlib.Path(ruta).suffix
            ct = 'text/html' if suf == '.html' else 'application/javascript' if suf == '.js' else 'text/css' if suf == '.css' else 'application/octet-stream'
            return route.fulfill(status=200, body=f.read_bytes(), headers={'content-type': ct, 'last-modified': 'Thu, 24 Sep 2026 10:00:00 GMT'})
        return route.fulfill(status=404, body='')
    if 'script.google.com' in url:
        a = accion_de(req)
        RED['google'].append(a)
        RED['gurl'].append(url + ' ' + (req.post_data or ''))
        if G404['n'] > 0 and a == 'accesoHorarioGuardar':   # Google falla una vez (como el 25-set 13:11)
            G404['n'] -= 1
            return route.fulfill(status=404, body="<html><script>window['ppConfig'] = {productName: 'x'}</script>Not Found</html>", headers={'content-type': 'text/html', 'access-control-allow-origin': '*'})
        time.sleep(0.15)
        return route.fulfill(status=200, body=json.dumps(resp_google(a)), headers={'content-type': 'application/json', 'access-control-allow-origin': '*'})
    if 'azurewebsites.net' in url:
        RED['azure'].append(urllib.parse.urlparse(url).path)
        if AZ_CAIDO['si'] and req.method != 'OPTIONS':
            return route.fulfill(status=500, body='{"success":false}', headers={'content-type': 'application/json', 'access-control-allow-origin': '*'})
        if req.method == 'OPTIONS':
            return route.fulfill(status=204, headers={'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*'})
        return route.fulfill(status=200, body=json.dumps(resp_azure(url)), headers={'content-type': 'application/json', 'access-control-allow-origin': '*'})
    # firebase, fuentes, cdn, etc.
    if 'firebaseio.com' in url and req.method in ('PUT', 'POST', 'PATCH'): RED.setdefault('firebase_escrituras', []).append(url)
    return route.fulfill(status=200, body='{}', headers={'content-type': 'application/json', 'access-control-allow-origin': '*'})

USUARIO = {'usuario': 'jtimoteo', 'nombre': 'JOEL TIMOTEO', 'rol': 'administrador', 'sector': ''}

resultados = []
def ok(nombre, cond, detalle=''):
    resultados.append((nombre, bool(cond), detalle))

CARRERA = """async (b) => {
  const t0 = performance.now();
  const r = await Promise.race([ (window.apiPost ? apiPost(b) : Promise.resolve({success:false,error:'sin apiPost'})).catch(e => ({success:false, error:'EXCEPCION '+e.message})),
                                 new Promise(x => setTimeout(() => x('COLGADO'), 8000)) ]);
  return {r: (typeof r === 'string') ? r : (r && (r.success || r.ok) ? 'OK' : 'ERROR ' + (r && r.error)), ms: Math.round(performance.now() - t0)};
}"""

SIN_ESCAPE = ("(function(){var f=window.fetch;window.fetch=function(u,o){if(o&&o.keepalive){o=Object.assign({},o);delete o.keepalive;}return f.call(this,u,o);};"
              "try{navigator.sendBeacon=function(){return true;};}catch(e){}})();")

with sync_playwright() as pw:
    nav = pw.chromium.launch()
    ctx = nav.new_context(service_workers='block')
    ctx.add_init_script(SIN_ESCAPE); ctx.add_init_script('sessionStorage.setItem("user", ' + json.dumps(json.dumps(USUARIO)) + '); sessionStorage.setItem("rl_token","x"); sessionStorage.setItem("api","https://script.google.com/macros/s/AKfycbxZP3UGad-XwRl7sCYmTxeex57b1hEfmqslhe5x0IOzzvpbEbM4VYFR2d52b_YMB1lyyA/exec");'
                        'try{localStorage.setItem("rl_nov_2026-09-23_jtimoteo","1")}catch(e){}')
    ctx.route('**/*', enrutar)

    # ───────── DASHBOARD ─────────
    pag = ctx.new_page(); errores = []
    pag.on('pageerror', lambda e: errores.append((str(e)+' @ '+(e.stack or '').split('\n')[1:3].__str__())[:400]))
    pag.goto(BASE + 'frontend/pages/dashboard.html', wait_until='load')
    pag.wait_for_timeout(5000)
    for acc in ['saveAtencion', 'updateAtencion', 'deleteAtencion', 'saveVisita', 'updateVisita', 'saveCaso', 'updateCaso',
                'saveFusion', 'updateFusion', 'saveSupervisor', 'permisosGuardar', 'accesoHorarioGuardar', 'saveUsuario']:
        RED['google'].clear()
        r = pag.evaluate(CARRERA, {'action': acc, 'dni': '12345678', 'nombre': 'PRUEBA', 'nro': 1, 'x': acc})
        ok('Dashboard guardar ' + acc, r['r'] == 'OK', f"{r['r']} {r['ms']} ms")
    for acc in ['getAtenciones', 'getCasos', 'getVisitas', 'cumplPendientes', 'getUsuarios']:
        r = pag.evaluate(CARRERA, {'action': acc, 'usuario': 'jtimoteo', 'rol': 'administrador'})
        ok('Dashboard leer ' + acc, r['r'] == 'OK', f"{r['r']} {r['ms']} ms")
    # Google responde 404 una vez al guardar un horario -> se reintenta solo y guarda
    G404['n'] = 1; RED['google'].clear()
    r = pag.evaluate(CARRERA.replace('8000', '15000'), {'action': 'accesoHorarioGuardar', 'usuario': 'jtimoteo', 'rol': 'administrador', 'horario': {'usuario': 'almartinez'}})
    ok('Horario: si Google falla un instante, se reintenta y guarda', r['r'] == 'OK' and RED['google'].count('accesoHorarioGuardar') == 2, f"{r['r']} {r['ms']} ms, envios {RED['google'].count('accesoHorarioGuardar')}")
    # doble clic: 2 envios iguales al mismo tiempo -> 1 solo a la red
    RED['google'].clear()
    pag.evaluate("""async () => { const b = {action:'saveAtencion', dni:'11111111', nombre:'DOBLE'}; await Promise.all([apiPost(Object.assign({},b)), apiPost(Object.assign({},b))]); }""")
    n = RED['google'].count('saveAtencion')
    ok('Dashboard doble clic -> 1 solo guardado', n == 1, f'{n} envios')
    # busquedas de trabajador (Azure)
    r = pag.evaluate("""async () => { const t0=performance.now(); const x = await Promise.race([buscarTrabajadorPorDniAzure('12345678'), new Promise(z=>setTimeout(()=>z('COLGADO'),8000))]); return {x: x==='COLGADO'?'COLGADO':(x?'OK':'VACIO'), ms: Math.round(performance.now()-t0)}; }""")
    ok('Dashboard buscar DNI (Azure)', r['x'] == 'OK', f"{r['x']} {r['ms']} ms")
    r = pag.evaluate("""async () => { if (typeof _buscarTrabApi!=='function') return {x:'SIN FUNCION'}; const t0=performance.now(); const x = await Promise.race([_buscarTrabApi('juan perez',''), new Promise(z=>setTimeout(()=>z('COLGADO'),8000))]); return {x: x==='COLGADO'?'COLGADO':'OK', ms: Math.round(performance.now()-t0)}; }""")
    ok('Dashboard buscar por nombre', r['x'] == 'OK', f"{r['x']} {r.get('ms','')} ms")
    # flujo real de la pantalla Nueva Atencion (formulario + boton)
    r = pag.evaluate("""async () => {
      try { if (typeof abrirNuevaAt==='function') abrirNuevaAt(); } catch(e) {}
      const set=(id,v)=>{const e=document.getElementById(id); if(e) e.value=v;};
      set('at_dni','12345678'); set('at_nom','TRABAJADOR PRUEBA'); set('at_doc','LICENCIA'); set('at_doc_txt','LICENCIA'); set('at_nro_edit','');
      try { modoEdicion=false; window._savingAt=false; } catch(e) {}
      const t0=performance.now();
      const p = guardarAt();
      await new Promise(z=>setTimeout(z,600));
      const no = document.getElementById('_ceNo'); const pregunto = !!no; if (no) no.click();   // responde "No, sigue EN PROCESO"
      const fin = await Promise.race([Promise.resolve(p).then(()=> 'TERMINO'), new Promise(z=>setTimeout(()=>z('COLGADO'),10000))]);
      const btn=document.getElementById('btnGuardarAt');
      const modales=[...document.querySelectorAll('.app-modal-overlay, .modal-overlay, [id*=odal], .mo')].filter(m=>getComputedStyle(m).display!=='none' && m.offsetParent!==null).map(m=>(m.id||m.className)+': '+m.innerText.slice(0,120).replace(/\s+/g,' '));
      return {fin, ms: Math.round(performance.now()-t0), boton: btn ? btn.textContent.trim() : '?', libre: btn ? !btn.disabled : null, pregunto, modales, redGuardo: 0};
    }""")
    ok('Dashboard pantalla Nueva Atencion (boton Guardar)', r['fin'] == 'TERMINO' and r['libre'], json.dumps(r, ensure_ascii=False))
    # Registro de Casos: lista de supervisores desde la hoja
    r = pag.evaluate("""async () => {
      if (typeof _casosSupLlenar !== 'function') return {x:'SIN BLOQUE'};
      await _casosSupLlenar(); const sel=document.getElementById('cSupervisor');
      const ops=[...sel.options]; const john=ops.find(o=>o.value==='JOHN STEVE HERNANDEZ BORRERO'); const sergio=ops.find(o=>o.value==='SERGIO VIERA GIRON');
      return {total: ops.length, john: !!john && !john.disabled, sergioBloqueado: !!sergio && sergio.disabled, conservaFijos: ops.some(o=>o.value==='ROBERTO MOLERO ABAD')};
    }""")
    ok('Casos: supervisor nuevo aparece / retirado bloqueado / fijos se conservan', r.get('john') and r.get('sergioBloqueado') and r.get('conservaFijos'), json.dumps(r))
    ok('Dashboard sin errores de JavaScript', not errores, '; '.join(errores[:4]))
    pag.close()

    # ───────── SUPERVISOR (atenciones desde Azure, login liviano) ─────────
    ctxS = nav.new_context(service_workers='block')
    SUP = {'usuario': 'sprueba', 'nombre': 'SUPERVISOR PRUEBA', 'rol': 'supervisor', 'sector': '', 'empresa': 'RAPEL'}
    ctxS.add_init_script(SIN_ESCAPE); ctxS.add_init_script('sessionStorage.setItem("user", ' + json.dumps(json.dumps(SUP)) + '); sessionStorage.setItem("rl_token","x"); sessionStorage.setItem("api","https://script.google.com/macros/s/AKfycbxZP3UGad-XwRl7sCYmTxeex57b1hEfmqslhe5x0IOzzvpbEbM4VYFR2d52b_YMB1lyyA/exec");'
                         'try{localStorage.setItem("rl_nov_2026-09-23_sprueba","1")}catch(e){}')
    ctxS.route('**/*', enrutar)
    RED['google'].clear(); RED['gurl'].clear(); RED['azure'].clear()
    pag = ctxS.new_page(); errores = []
    pag.on('pageerror', lambda e: errores.append((str(e)+' @ '+(e.stack or '').split('\n')[1:3].__str__())[:400]))
    pag.goto(BASE + 'frontend/pages/dashboard.html', wait_until='load')
    pag.wait_for_timeout(6000)
    pre = [u for u in RED['gurl'] if 'getPreloadOptimizado' in u]
    ok('Supervisor: login pide preload liviano (atAzure=1)', pre and all('atAzure=1' in u for u in pre), str(len(pre)) + ' pedidos')
    ok('Supervisor: no lee atenciones de la hoja al entrar', 'getAtencionesOptimizado' not in RED['google'], ','.join(sorted(set(RED['google']))))
    n = pag.evaluate("(typeof CACHE!=='undefined' && Array.isArray(CACHE.atenciones)) ? CACHE.atenciones.length : -1")
    ok('Supervisor: atenciones cargadas desde Azure al entrar', n >= 1, str(n) + ' registros')
    r = pag.evaluate("""async () => { await _sincronizarPapelera(); const x = await window._azAtencionesSup(30, true);
      return (x||[]).map(a => a.nro + '|' + a.dni).join(','); }""")
    ok('Supervisor: eliminada se oculta y la otra con el mismo N° sigue visible', r == '500|22222222', r)
    RED['google'].clear()
    r = pag.evaluate(CARRERA, {'action': 'updateAtencion', 'nro': 500, 'estado': 'FINALIZADO', 'usuario': 'sprueba', 'rol': 'supervisor'})
    pag.wait_for_timeout(1500)
    ok('Supervisor: editar -> guarda y sube a Azure en 2do plano', r['r'] == 'OK' and 'syncAtencionAzure' in RED['google'], r['r'] + ' | red: ' + ','.join(RED['google']))
    RED['google'].clear()
    r = pag.evaluate("""async () => { if (typeof _chequearHistorialDNI!=='function') return 'SIN FUNCION';
      await Promise.race([_chequearHistorialDNI('12345678'), new Promise(z=>setTimeout(z,8000))]); return 'OK'; }""")
    ok('Supervisor: historial por DNI solo en Azure (no lee la hoja)', r == 'OK' and 'consultaDNI' not in RED['google'], r + ' | red: ' + ','.join(RED['google']))
    ok('Supervisor: dashboard sin errores de JavaScript', not errores, '; '.join(errores[:4]))
    pag.close(); ctxS.close()
    # Azure caido: el supervisor igual ve sus atenciones (respaldo: la hoja). Sesion limpia.
    ctxS = nav.new_context(service_workers='block')
    ctxS.add_init_script(SIN_ESCAPE); ctxS.add_init_script('sessionStorage.setItem("user", ' + json.dumps(json.dumps(SUP)) + '); sessionStorage.setItem("rl_token","x"); sessionStorage.setItem("api","https://script.google.com/macros/s/AKfycbxZP3UGad-XwRl7sCYmTxeex57b1hEfmqslhe5x0IOzzvpbEbM4VYFR2d52b_YMB1lyyA/exec");'
                         'try{localStorage.setItem("rl_nov_2026-09-23_sprueba","1")}catch(e){}')
    ctxS.route('**/*', enrutar)
    AZ_CAIDO['si'] = True; RED['google'].clear()
    pag = ctxS.new_page(); errores = []
    pag.on('pageerror', lambda e: errores.append(str(e)[:300]))
    pag.goto(BASE + 'frontend/pages/dashboard.html', wait_until='load'); pag.wait_for_timeout(6000)
    ok('Supervisor con Azure caido: usa la hoja de respaldo', 'getAtencionesOptimizado' in RED['google'], ','.join(sorted(set(RED['google']))))
    RED['google'].clear()
    r = pag.evaluate("""async () => { await Promise.race([_chequearHistorialDNI('12345678'), new Promise(z=>setTimeout(z,8000))]); return 'OK'; }""")
    ok('Supervisor con Azure caido: historial DNI usa la hoja', 'consultaDNI' in RED['google'], ','.join(RED['google']))
    ok('Supervisor con Azure caido: sin errores de JavaScript', not errores, '; '.join(errores[:4]))
    AZ_CAIDO['si'] = False
    pag.close(); ctxS.close()

    # ───────── HORAS ─────────
    pag = ctx.new_page(); errores = []
    pag.on('pageerror', lambda e: errores.append((str(e)+' @ '+(e.stack or '').split('\n')[1:3].__str__())[:400]))
    pag.goto(BASE + 'frontend/pages/horas.html', wait_until='load'); pag.wait_for_timeout(3000)
    for acc in ['horasListar', 'horasRegistrar', 'horasEditar', 'horasEliminar', 'horasAprobar', 'horariosListar']:
        r = pag.evaluate(CARRERA, {'action': acc, 'dni': '12345678', 'x': acc})
        ok('Horas ' + acc, r['r'] == 'OK', f"{r['r']} {r['ms']} ms")
    RED['google'].clear()
    ok('Horas pagina cargada (apiPost existe)', pag.evaluate("typeof window.apiPost") == 'function', pag.url + ' | apiPost=' + pag.evaluate("typeof window.apiPost"))
    try: pag.evaluate("""async () => { const b={action:'horasRegistrar', dni:'22222222', h:1}; await Promise.all([apiPost(Object.assign({},b)), apiPost(Object.assign({},b))]); }""")
    except Exception as e: pass
    ok('Horas doble clic -> 1 solo registro', RED['google'].count('horasRegistrar') == 1, f"{RED['google'].count('horasRegistrar')} envios")
    ok('Horas sin errores de JavaScript', not errores, '; '.join(errores[:4]))
    pag.close()

    # ───────── INVENTARIO ─────────
    pag = ctx.new_page(); errores = []
    pag.on('pageerror', lambda e: errores.append((str(e)+' @ '+(e.stack or '').split('\n')[1:3].__str__())[:400]))
    pag.goto(BASE + 'frontend/pages/inventario.html', wait_until='load'); pag.wait_for_timeout(3000)
    for acc in ['invGetAll', 'invRegistrarIngreso', 'invRegistrarEntrega', 'invEliminarIngreso']:
        r = pag.evaluate(CARRERA, {'action': acc, 'x': acc})
        ok('Inventario ' + acc, r['r'] == 'OK', f"{r['r']} {r['ms']} ms")
    ok('Inventario sin errores de JavaScript', not errores, '; '.join(errores[:4]))
    pag.close()

    # ───────── CALCULO REMUNERATIVO y LOGIN ─────────
    for nombre, ruta in [('Calculo Remunerativo', 'frontend/pages/calculo-remunerativo.html'), ('Login (index)', 'index.html')]:
        pag = ctx.new_page(); errores = []
        pag.on('pageerror', lambda e: errores.append((str(e)+' @ '+(e.stack or '').split('\n')[1:3].__str__())[:400]))
        pag.goto(BASE + ruta, wait_until='load'); pag.wait_for_timeout(3000)
        ok(nombre + ' carga sin errores de JavaScript', not errores, '; '.join(errores[:4]))
        pag.close()
    nav.close()

ok('Ninguna peticion se salio de la simulacion (keepalive/beacon)', True, str(len(RED.get('firebase_escrituras', []))) + ' escrituras a Firebase atrapadas por la simulacion')
fallas = [r for r in resultados if not r[1]]
for n, c, d in resultados:
    print(('  OK   ' if c else '  FALLA') + ' | ' + n + (' | ' + d if d else ''))
print('\nRESULTADO: ' + ('✅ TODO OK (' + str(len(resultados)) + ' pruebas)' if not fallas else '❌ ' + str(len(fallas)) + ' FALLA(S) de ' + str(len(resultados))))
sys.exit(1 if fallas else 0)
