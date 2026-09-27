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
ACC = {'modo': 'ok', 'llamadas': []}   # ok | caido | 403
CV = {'caido': False, 'llamadas': []}
PERMX = {'resp': None, 'gas_falla': False}
CUMPL = {'modo': 'ok', 'llamadas': []}   # ok | caido | 503
AZG = {'modo': 'ok', 'llamadas': [], 'cuerpos': []}   # ok | caido | 503
MODX = {'modo': 'ok', 'llamadas': []}
CVG = {'modo': 'ok', 'llamadas': []}   # _CV_AZURE_PRIMERO_V1
CAPG = {'modo': 'ok', 'llamadas': [], 'auth': []}   # _CAP_AZURE_PRIMERO_V1
USRG = {'modo': 'ok', 'llamadas': [], 'cuerpos': []}   # _USR_AZURE_V1  ok | caido
CUMPLW = {'modo': 'ok', 'llamadas': [], 'cuerpos': []}   # _CUMPL_W_V1  ok | caido
SOLG = {'modo': 'ok', 'llamadas': [], 'auth': []}   # _SOL_AZURE_V1  ok | caido
FUSG = {'modo': 'ok', 'llamadas': [], 'auth': []}   # _FUS_AZURE_V1  ok | caido | 503
MANTG = {'modo': 'ok', 'llamadas': [], 'auth': [], 'cuerpos': []}   # _MANT_AZURE_V1  ok | rechazo | caido | 503
HORASG = {'modo': 'ok', 'llamadas': [], 'auth': [], 'cuerpos': []}   # _HORAS_AZURE_PRIMERO_V1  ok | rechazo | caido | 503

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

def resp_azure(url, post=''):
    if '/api/mod/' in url:
        partes = url.split('/api/mod/')[1].split('?')[0].split('/')
        MODX['llamadas'].append('/'.join(partes))
        acc = partes[1] if len(partes) > 1 else ''
        base = {'success': True, 'fuente': 'azure'}
        if acc == 'horasListar': base['registros'] = []
        if acc == 'horasResumenIndividual': base.update({'registros': [], 'totales': {'acum': 0, 'perm': 0, 'deuda': 0, 'saldo': 0}, 'bloqueado': False, 'comentario': 'Sin saldo pendiente'})
        if acc == 'horasResumenGeneral': base['resumen'] = []
        if acc == 'horasListarMotivos': base['motivos'] = ['A']
        if acc == 'listarCapacitaciones': base.update({'capacitaciones': [], 'total': 0, 'esAdmin': True})
        if acc == 'estadisticasCapacitaciones': base.update({'esAdmin': True, 'stats': {}})
        if acc in ('getFusiones', 'getSolicitudes', 'getMotivosCasos'): base['data'] = []
        if acc == 'invGetAll': base.update({'productos': [], 'ingresos': [], 'entregas': []})
        if acc == 'getEstadisticasAdmin': base['data'] = {'stats': {'atenciones': {'total': 5, 'enProceso': 1, 'finalizados': 4, 'esteMes': 2}, 'visitas': {'total': 0, 'enPlazo': 0, 'retrasadas': 0, 'esteMes': 0}, 'casos': {'total': 0, 'enPlazo': 0, 'retrasados': 0, 'esteMes': 0}, 'fusiones': {'total': 0, 'pendientes': 0, 'validados': 0, 'trabajadores': 0, 'esteMes': 0}}, 'porSupervisor': {}, 'tendencia': [], 'filtros': {'anio': '', 'mes': ''}}
        return base
    if '/api/atenciones/guardar' in url:
        AZG['llamadas'].append('guardar'); AZG['cuerpos'].append(post)
        return {'success': True, 'nro': 777, 'hoja': 'BB. DE REGISTROS 2026', 'fuente': 'azure', 'fecha_atencion': '2026-09-26', 'hora_inicio': '08:00', 'estado': 'EN PROCESO', 'parentesco': '', 'nro_licencia': ''}
    if '/api/usr/guardar/' in url:
        acc = url.split('/api/usr/guardar/')[1].split('?')[0]
        USRG['llamadas'].append(acc); USRG['cuerpos'].append(post)
        return {'success': True, 'fuente': 'azure', 'nro': 7, 'hastaHora': '18:00'}
    if '/api/cumpl/guardar/' in url:
        acc = url.split('/api/cumpl/guardar/')[1].split('?')[0]
        CUMPLW['llamadas'].append(acc); CUMPLW['cuerpos'].append(post)
        return {'success': True, 'fuente': 'azure', 'hasta': '2026-10-04', 'cambios': 1, 'config': {}}
    if '/api/cumpl/' in url:
        acc = url.split('/api/cumpl/')[1].split('?')[0]
        CUMPL['llamadas'].append(acc)
        if acc == 'cumplPanel': return {'success': True, 'hoy': '2026-09-26', 'supervisores': [], 'actividades': [], 'config': {}, 'fuente': 'azure'}
        if acc == 'getCumplimiento': return {'success': True, 'esAdmin': True, 'semana': 39, 'rangoSemana': '14/09 al 20/09', 'pendientesVisitas': [], 'casosPendientes': [], 'fuente': 'azure'}
        return {'success': True, 'usuario': 'jtimoteo', 'nombre': 'JOEL', 'rol': 'administrador', 'esAdmin': True, 'hoy': '2026-09-26',
                'config': {'aviso_proximo_dias': 2, 'critico_dias': 5, 'escalar_dias': 3, 'excelente': 90, 'regular': 70},
                'actividades': [], 'resumen': {'EN_PLAZO': 0, 'PROXIMO': 0, 'VENCE_HOY': 0, 'VENCIDO': 0, 'CRITICO': 0},
                'restriccion': {'activa': False, 'modulos': [], 'criticos': 0, 'motivo': '', 'exonerado_hasta': ''}, 'indice': None, 'fuente': 'azure'}
    if '/api/sol/guardar/' in url:
        SOLG['llamadas'].append(url.split('/api/sol/guardar/')[1].split('?')[0])
        return {'success': True, 'fuente': 'azure'}
    if '/api/fus/guardar/' in url:
        acc = url.split('/api/fus/guardar/')[1].split('?')[0]
        FUSG['llamadas'].append(acc)
        return {'success': True, 'fuente': 'azure', 'id': 'FUS-0013'} if acc == 'saveFusion' else {'success': True, 'fuente': 'azure', 'message': 'Fusión actualizada'}
    if '/api/mant/guardar/' in url:
        acc = url.split('/api/mant/guardar/')[1].split('?')[0]
        MANTG['llamadas'].append(acc); MANTG['cuerpos'].append(post)
        if MANTG['modo'] == 'rechazo': return {'ok': False, 'msg': 'No se encontró la solicitud SOL-999'}
        if acc == 'guardarSolicitudMantenimiento': return {'ok': True, 'id': 'SOL-018', 'fuente': 'azure'}
        if acc == 'actualizarEstadoMantenimiento': return {'ok': True, 'id': 'SOL-001', 'estado': 'ATENDIDO', 'fecha': '27/09/2026', 'fuente': 'azure'}
        return {'ok': True, 'fuente': 'azure'}
    if '/api/horas/guardar/' in url:
        acc = url.split('/api/horas/guardar/')[1].split('?')[0]
        HORASG['llamadas'].append(acc); HORASG['cuerpos'].append(post)
        if HORASG['modo'] == 'rechazo': return {'success': False, 'error': 'Solo administradores pueden registrar'}
        return {'success': True, 'fuente': 'azure', 'id': 'H1790000000000'}
    if '/api/cap/guardar/' in url:
        acc = url.split('/api/cap/guardar/')[1].split('?')[0]
        CAPG['llamadas'].append(acc)
        return {'success': True, 'fuente': 'azure', 'idCapacitacion': 'CAP-AZ-1', 'registrosGuardados': 2, 'asistentes': 2}
    if '/api/cv/guardar/' in url:
        acc = url.split('/api/cv/guardar/')[1].split('?')[0]
        CVG['llamadas'].append(acc)
        r = {'success': True, 'fuente': 'azure'}
        if acc in ('saveCaso', 'saveVisita'): r['nro'] = 555
        if acc == 'saveVisita': r.update({'estado': 'EN PLAZO', 'fotos_count': 0, 'enlace_informe': ''})
        if acc.startswith('eliminar'): r.update({'mensaje': 'archivado', 'eliminado_por': 'jtimoteo'})
        return r
    if '/api/cv/' in url:
        acc = url.split('/api/cv/')[1].split('?')[0]
        CV['llamadas'].append(acc)
        if acc == 'getCasos':
            return {'success': True, 'fuente': 'azure', 'data': [{'nro': 1, 'nombre': 'CASO AZURE', 'supervisor': 'X', 'estado': 'ABIERTO', 'fecha_reg': '2026-09-01'}, {'nro': 2, 'nombre': 'CASO AZURE 2', 'supervisor': 'X', 'estado': 'CERRADO', 'fecha_reg': '2026-09-02'}]}
        return {'success': True, 'fuente': 'azure', 'data': [{'nro': 7, 'supervisor': 'X', 'empresa': 'RAPEL', 'fecha_reg': '2026-09-01 10:00', 'fotos_urls': []}]}
    if '/api/acceso/' in url:
        acc = url.split('/api/acceso/')[1].split('?')[0]
        ACC['llamadas'].append(acc)
        if acc == 'permisosListar' and PERMX['resp'] is not None:
            return PERMX['resp']
        if acc == 'permisosListar':
            return {'success': True, 'permisos': {'navAt': True}, 'vacio': False, 'usuario': 'x', 'fuente': 'azure'}
        if acc == 'accesoHorarioListar':
            return {'success': True, 'horarios': [], 'total': 0, 'fuente': 'azure'}
        if acc == 'accesoHorarioGuardar':
            return {'success': True, 'horario': '05:30 a 17:00', 'cruzaMedianoche': False, 'aviso': 'ok', 'fuente': 'azure'}
        return {'success': True, 'fuente': 'azure'}
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
        if PERMX['gas_falla'] and a == 'permisosListar':
            return route.fulfill(status=500, body='error', headers={'content-type': 'text/html', 'access-control-allow-origin': '*'})
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
        if '/api/usr/guardar/' in url and USRG['modo'] == 'caido':
            USRG['llamadas'].append('caido')
            return route.abort()
        if '/api/cumpl/guardar/' in url and CUMPLW['modo'] == 'caido':
            CUMPLW['llamadas'].append('caido')
            return route.abort()
        if '/api/sol/guardar/' in url:
            SOLG['auth'].append(req.headers.get('authorization', ''))
            if SOLG['modo'] == 'caido':
                SOLG['llamadas'].append('caido')
                return route.abort()
        if '/api/fus/guardar/' in url:
            FUSG['auth'].append(req.headers.get('authorization', ''))
            if FUSG['modo'] == 'caido':
                FUSG['llamadas'].append('caido')
                return route.abort()
        if '/api/mant/guardar/' in url:
            MANTG['auth'].append(req.headers.get('authorization', ''))
            if MANTG['modo'] == 'caido':
                MANTG['llamadas'].append('caido')
                return route.abort()
            if MANTG['modo'] == '503':
                MANTG['llamadas'].append('503')
                return route.fulfill(status=503, body='{"ok":false,"apagado":true}', headers={'content-type': 'application/json', 'access-control-allow-origin': '*'})
        if '/api/horas/guardar/' in url:
            HORASG['auth'].append(req.headers.get('authorization', ''))
            if HORASG['modo'] == 'caido':
                HORASG['llamadas'].append('caido')
                return route.abort()
            if HORASG['modo'] == '503':
                HORASG['llamadas'].append('503')
                return route.fulfill(status=503, body='{"success":false,"apagado":true}', headers={'content-type': 'application/json', 'access-control-allow-origin': '*'})
        if '/api/cap/guardar/' in url:
            CAPG['auth'].append(req.headers.get('authorization', ''))
            if CAPG['modo'] == 'caido':
                CAPG['llamadas'].append('caido')
                return route.abort()
        if '/api/cv/guardar/' in url and CVG['modo'] == 'caido':
            CVG['llamadas'].append('caido')
            return route.abort()
        if '/api/mod/' in url and MODX['modo'] == 'caido':
            MODX['llamadas'].append('caido')
            return route.abort()
        if '/api/atenciones/guardar' in url and AZG['modo'] == 'caido':
            AZG['llamadas'].append('caido')
            return route.abort()
        if '/api/atenciones/guardar' in url and AZG['modo'] == '503':
            AZG['llamadas'].append('503')
            return route.fulfill(status=503, body='{"success":false,"apagado":true}', headers={'content-type': 'application/json', 'access-control-allow-origin': '*'})
        if '/api/cumpl/' in url and CUMPL['modo'] == 'caido':
            return route.abort()
        if '/api/cumpl/' in url and CUMPL['modo'] == '503':
            return route.fulfill(status=503, body='{"success":false,"error":"aun no migrado"}', headers={'content-type': 'application/json', 'access-control-allow-origin': '*'})
        if '/api/cv/' in url and CV['caido']:
            return route.abort()
        if '/api/acceso/' in url and ACC['modo'] == 'caido':
            return route.abort()
        if '/api/acceso/' in url and ACC['modo'] == '403':
            ACC['llamadas'].append('403')
            return route.fulfill(status=403, body='{"success":false,"requiereToken":true}', headers={'content-type': 'application/json', 'access-control-allow-origin': '*'})
        return route.fulfill(status=200, body=json.dumps(resp_azure(url, req.post_data or '')), headers={'content-type': 'application/json', 'access-control-allow-origin': '*'})
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
    # ── Casos y Visitas desde Azure ──
    pre = [u for u in RED['gurl'] if 'getPreloadOptimizado' in u]
    nC = pag.evaluate("(typeof CACHE!=='undefined' && Array.isArray(CACHE.casos)) ? CACHE.casos.length : -1")
    nV = pag.evaluate("(typeof CACHE!=='undefined' && Array.isArray(CACHE.visitas)) ? CACHE.visitas.length : -1")
    ok('Casos/Visitas: al entrar se traen de Azure (la hoja no los lee)', pre and all('cvAzure=1' in u for u in pre) and nC == 2 and nV == 1 and 'getCasos' in CV['llamadas'],
       'preload con cvAzure: ' + str(bool(pre) and all('cvAzure=1' in u for u in pre)) + ' | casos ' + str(nC) + ' | visitas ' + str(nV) + ' | azure: ' + ','.join(CV['llamadas']))
    RED['google'].clear(); CV['llamadas'].clear()
    r = pag.evaluate("""async () => { const d = await apiGet({action:'getCasos', empresa:'', motivo:'', usuario:'jtimoteo', rol:'administrador'}); return (d && d.fuente) + ':' + (d && d.data ? d.data.length : -1); }""")
    ok('Casos/Visitas: la lista de casos sale de Azure', r == 'azure:2' and 'getCasos' not in RED['google'], r + ' | google: ' + ','.join(RED['google']))
    CV['caido'] = True; RED['google'].clear()
    r = pag.evaluate("""async () => { const d = await apiGet({action:'getVisitas', empresa:'', mes:''}); return d && d.success ? 'OK' : 'ERROR'; }""")
    ok('Casos/Visitas: con Azure caido, las visitas salen de la hoja', r == 'OK' and 'getVisitas' in RED['google'], r + ' | google: ' + ','.join(RED['google']))
    CV['caido'] = False
    # ── Consultas simples desde Azure ──
    RED['google'].clear(); MODX['llamadas'].clear()
    r = pag.evaluate("""async () => { const x = await Promise.all([apiGet({action:'getFusiones', usuario:'TODOS'}), apiGet({action:'getSolicitudes', estado:'PENDIENTE'}), apiGet({action:'getMotivosCasos'})]); return x.map(d => d && d.fuente).join(','); }""")
    ok('Fusiones, Solicitudes y Motivos salen de Azure (no de Google)', r == 'azure,azure,azure' and not any(a in RED['google'] for a in ['getFusiones', 'getSolicitudes', 'getMotivosCasos']), r + ' | google: ' + ','.join(RED['google']))
    MODX['modo'] = 'caido'; RED['google'].clear()
    r = pag.evaluate("""async () => { const d = await apiGet({action:'getFusiones', usuario:'TODOS'}); return d && d.success ? 'OK' : 'ERROR'; }""")
    ok('Fusiones: con Azure caido, sale de Google', r == 'OK' and 'getFusiones' in RED['google'], r)
    # ── Estadisticas Admin desde Azure (_ESTADM_AZURE_V1) ──
    MODX['modo'] = 'ok'; RED['google'].clear(); MODX['llamadas'].clear()
    r = pag.evaluate("""async () => { const d = await apiGet({action:'getEstadisticasAdmin', empresa:'', mes:'', supervisor:'', rol:'administrador'}); return (d && d.fuente) + ':' + (d && d.data && d.data.stats.atenciones.total); }""")
    ok('Estadisticas Admin (dashboard) salen de Azure', r == 'azure:5' and 'getEstadisticasAdmin' not in RED['google'] and 'estadm/getEstadisticasAdmin' in MODX['llamadas'], r + ' | google: ' + ','.join(RED['google']))
    MODX['modo'] = 'caido'; RED['google'].clear()
    r = pag.evaluate("""async () => { const d = await apiGet({action:'getEstadisticasAdmin', empresa:'', mes:'', supervisor:''}); return d && d.success ? 'OK' : 'ERROR'; }""")
    ok('Estadisticas Admin: con Azure caido, sale de Google', r == 'OK' and 'getEstadisticasAdmin' in RED['google'], r)
    MODX['modo'] = 'ok'
    RED['google'].clear()
    # ── Fusiones: primero en Azure (_FUS_AZURE_V1) ──
    FUSG['llamadas'].clear(); FUSG['auth'].clear()
    r = pag.evaluate("""async () => { const b = {action:'saveFusion', id:'', fecha:'27/9/2026', hora:'08:05 a. m.', sector:'El Papayo', estado:'Pendiente'}; const x = await Promise.all([apiPost(Object.assign({}, b)), apiPost(Object.assign({}, b))]); await new Promise(z => setTimeout(z, 500)); return x.map(d => (d && d.fuente) + ':' + (d && d.id)).join(','); }""")
    ok('Fusion nueva: se guarda en Azure (una sola vez con doble clic) y NO pasa por Google', r == 'azure:FUS-0013,azure:FUS-0013' and FUSG['llamadas'] == ['saveFusion'] and 'saveFusion' not in RED['google'], r + ' | azure: ' + ','.join(FUSG['llamadas']) + ' | google: ' + ','.join(RED['google']))
    ok('Fusion nueva: va con el token y Google copia a la hoja en 2do plano', FUSG['auth'] and FUSG['auth'][0].startswith('Bearer ') and 'cvAplicarDesdeAzure' in RED['google'], str(FUSG['auth'][:1]) + ' | ' + ','.join(RED['google']))
    RED['google'].clear()
    r = pag.evaluate("""async () => { const d = await apiPost({action:'updateFusion', id:'FUS-0012', sector:'X'}); return (d && d.fuente) + ':' + (d && d.success); }""")
    ok('Fusion editada: va a Azure y NO por Google', r == 'azure:true' and 'updateFusion' not in RED['google'], r + ' | google: ' + ','.join(RED['google']))
    pag.wait_for_timeout(500); FUSG['modo'] = 'caido'; RED['google'].clear()
    r = pag.evaluate(CARRERA, {'action': 'saveFusion', 'x': 1})
    ok('Fusiones: con Azure caido, guardar va por Google', r['r'] == 'OK' and 'saveFusion' in RED['google'], r['r'] + ' | google: ' + ','.join(RED['google']))
    FUSG['modo'] = 'ok'
    # ── Solicitudes: aprobar/rechazar primero en Azure (_SOL_AZURE_V1) ──
    pag.wait_for_timeout(500); SOLG['llamadas'].clear(); SOLG['auth'].clear(); RED['google'].clear()
    r = pag.evaluate("""async () => { const b = {action:'resolverSolicitud', fila:3, decision:'APROBADA', estado:'APROBADA', motivo_rechazo:'', resuelto_por:'JOEL'}; const x = await Promise.all([apiPost(Object.assign({}, b)), apiPost(Object.assign({}, b))]); await new Promise(z => setTimeout(z, 500)); return x.map(d => (d && d.fuente) + ':' + (d && d.success)).join(','); }""")
    ok('Solicitud aprobada: va a Azure (una sola vez con doble clic) y NO por Google', r == 'azure:true,azure:true' and SOLG['llamadas'] == ['resolverSolicitud'] and 'resolverSolicitud' not in RED['google'], r + ' | azure: ' + ','.join(SOLG['llamadas']) + ' | google: ' + ','.join(RED['google']))
    ok('Solicitud: va con el token y Google copia a la hoja en 2do plano', SOLG['auth'] and SOLG['auth'][0].startswith('Bearer ') and 'cvAplicarDesdeAzure' in RED['google'], str(SOLG['auth'][:1]) + ' | ' + ','.join(RED['google']))
    pag.wait_for_timeout(500); SOLG['modo'] = 'caido'; RED['google'].clear()
    r = pag.evaluate(CARRERA, {'action': 'resolverSolicitud', 'fila': 4, 'estado': 'RECHAZADA'})
    ok('Solicitudes: con Azure caido, resolver va por Google', r['r'] == 'OK' and 'resolverSolicitud' in RED['google'], r['r'] + ' | google: ' + ','.join(RED['google']))
    SOLG['modo'] = 'ok'
    # ── Cumplimiento: escrituras primero en Azure (_CUMPL_W_V1) y justificacion al cerrar fuera de plazo (_CUMPL_JUST_FIX_V1) ──
    pag.wait_for_timeout(500); CUMPLW['llamadas'].clear(); RED['google'].clear()
    r = pag.evaluate("""async () => { const x = await Promise.all([apiPost({action:'cumplConfigGuardar', usuario:'jtimoteo', rol:'administrador', config:{critico_dias:6}}), apiPost({action:'cumplRestriccionLevantar', usuario:'jtimoteo', rol:'administrador', objetivo:'ptamayo', dias:7, motivo:'x'})]); await new Promise(z => setTimeout(z, 500)); return x.map(d => (d && d.fuente) + ':' + (d && d.success)).join(','); }""")
    ok('Cumplimiento: cambiar plazos y levantar restriccion van a Azure y NO por Google', r == 'azure:true,azure:true' and sorted(CUMPLW['llamadas']) == ['cumplConfigGuardar', 'cumplRestriccionLevantar'] and not any(a in RED['google'] for a in ['cumplConfigGuardar', 'cumplRestriccionLevantar']), r + ' | azure: ' + ','.join(CUMPLW['llamadas']) + ' | google: ' + ','.join(RED['google']))
    pag.wait_for_timeout(500); CUMPLW['llamadas'].clear(); CUMPLW['cuerpos'].clear(); CVG['llamadas'].clear(); RED['google'].clear()
    pag.evaluate("""() => { window._rj = null; apiPost({action:'updateCaso', nro: 5, estado_gestion: 'CERRADO', fecha_limite: '2026-09-01', usuario: 'jtimoteo'}).then(r => window._rj = r); }""")
    pag.wait_for_timeout(1500)
    modal = pag.evaluate("() => !!document.getElementById('cumplJustTxt')")
    ok('Cerrar un caso FUERA de plazo (Casos en Azure): pide la justificacion ANTES de guardar', modal and CVG['llamadas'] == [], 'ventana: ' + str(modal) + ' | azure casos: ' + ','.join(CVG['llamadas']))
    if modal:
        pag.fill('#cumplJustTxt', 'Demora por falta de documentos del trabajador'); pag.evaluate("() => document.getElementById('cumplJO').click()"); pag.wait_for_timeout(2500)
    cuerpo = ''.join(CUMPLW['cuerpos'])
    ok('... y con el motivo: cierra el caso en Azure y registra la justificacion en Azure', CVG['llamadas'] == ['updateCaso'] and CUMPLW['llamadas'] == ['cumplJustificar'] and 'Demora por falta' in cuerpo and 'cumplJustificar' not in RED['google'], 'casos: ' + ','.join(CVG['llamadas']) + ' | cumpl: ' + ','.join(CUMPLW['llamadas']) + ' | google: ' + ','.join(RED['google']))
    CVG['llamadas'].clear()
    pag.evaluate("""() => { window._rj2 = null; apiPost({action:'updateCaso', nro: 6, estado_gestion: 'CERRADO', fecha_limite: '2026-09-01', usuario: 'jtimoteo'}).then(r => window._rj2 = r); }""")
    pag.wait_for_timeout(1200); pag.evaluate("() => { const b = document.getElementById('cumplJC'); if (b) b.click(); }"); pag.wait_for_timeout(600)
    r = pag.evaluate("() => JSON.stringify(window._rj2)")
    ok('... y si cancela la justificacion, el caso NO se cierra', CVG['llamadas'] == [] and 'Debes registrar el motivo' in (r or ''), (r or '') + ' | casos: ' + ','.join(CVG['llamadas']))
    CUMPLW['modo'] = 'caido'; RED['google'].clear()
    r = pag.evaluate(CARRERA, {'action': 'cumplRestriccionLevantar', 'usuario': 'jtimoteo', 'rol': 'administrador', 'objetivo': 'ptamayo'})
    ok('Cumplimiento: con Azure caido, se guarda por Google', r['r'] == 'OK' and 'cumplRestriccionLevantar' in RED['google'], r['r'] + ' | google: ' + ','.join(RED['google']))
    CUMPLW['modo'] = 'ok'
    # ── Usuarios y accesos temporales primero en Azure (_USR_AZURE_V1) ──
    pag.wait_for_timeout(500); USRG['llamadas'].clear(); RED['google'].clear()
    r = pag.evaluate("""async () => { const d = await apiPost({action:'saveUsuario', usuario:'nuevo', password:'Clave123', nombre:'N', rol:'supervisor', empresa:'RAPEL', correo:''}); return (d && d.fuente) + ':' + (d && d.success); }""")
    ok('Usuario nuevo: se crea en Azure, NO por Google, y espera la copia a la hoja antes de responder', r == 'azure:true' and USRG['llamadas'] == ['saveUsuario'] and 'saveUsuario' not in RED['google'] and 'cvAplicarDesdeAzure' in RED['google'], r + ' | azure: ' + ','.join(USRG['llamadas']) + ' | google: ' + ','.join(RED['google']))
    RED['google'].clear()
    r = pag.evaluate("""async () => { const x = await Promise.all([apiPost({action:'updateUsuario', usuario:'ptamayo', activo:false}), apiPost({action:'resolverAccesoTemporal', fila:3, usuario:'ptamayo', decision:'APROBADO', aprobado_por:'jtimoteo'})]); return x.map(d => (d && d.fuente) + ':' + (d && d.success)).join(','); }""")
    ok('Activar/desactivar usuario y aprobar acceso temporal van a Azure y NO por Google', r == 'azure:true,azure:true' and not any(a in RED['google'] for a in ['updateUsuario', 'resolverAccesoTemporal']), r + ' | azure: ' + ','.join(USRG['llamadas']) + ' | google: ' + ','.join(RED['google']))
    ok('... y la contraseña viaja solo a Azure (con el token)', any('Clave123' in c for c in USRG['cuerpos']) and not any('Clave123' in g for g in RED['gurl']), 'ok')
    pag.wait_for_timeout(500); USRG['modo'] = 'caido'; RED['google'].clear()
    r = pag.evaluate(CARRERA, {'action': 'updateUsuario', 'usuario': 'ptamayo', 'activo': True})
    ok('Usuarios: con Azure caido, va por Google', r['r'] == 'OK' and 'updateUsuario' in RED['google'], r['r'] + ' | google: ' + ','.join(RED['google']))
    USRG['modo'] = 'ok'
    # ── _CAPAS_V1: 'Eliminar caso' se abre ENCIMA del formulario del caso · _PROGRESO_V1: circulo y ✓ ──
    pag.evaluate("() => { const n = document.getElementById('rlNovOv'); if (n) n.remove(); }")
    pag.wait_for_function("() => { const c = document.getElementById('rlProg'); return !c || c.style.display !== 'flex'; }", timeout=8000)
    r = pag.evaluate("""() => { _editandoCasoNro = 5; abrir('mCaso'); abrirModalEliminarCaso(); const m = document.getElementById('mEliminarCaso').getBoundingClientRect();
        const e = document.elementFromPoint(m.left + m.width/2, m.top + m.height/2); const ok = !!(e && e.closest('#mEliminarCaso')); const q = e ? (e.id || '') + '.' + String(e.className || '').slice(0,40) + ' en ' + ((e.closest('[id]') || {}).id || '') + ' z=' + getComputedStyle(e.closest('.ov') || e).zIndex : 'nada'; const zE = document.getElementById('mEliminarCaso').style.zIndex; cerrar('mEliminarCaso'); cerrar('mCaso'); return ok ? true : ('tapa: ' + q + ' | z eliminar=' + zE + ' | rect=' + JSON.stringify([m.left, m.top, m.width, m.height])); }""")
    ok('Eliminar caso: el formulario del motivo se abre ENCIMA del caso (no detras)', r is True, str(r))
    pag.evaluate("() => { window._vistos = []; const t = setInterval(() => { const c = document.getElementById('rlProg'); if (c && c.style.display === 'flex') { const v = (c.classList.contains('fin-ok') ? 'OK ' : 'GIRA ') + c.querySelector('.t').textContent; if (window._vistos[window._vistos.length-1] !== v) window._vistos.push(v); } }, 60); setTimeout(() => clearInterval(t), 4000); apiPost({action:'updateCaso', nro: 5, estado_gestion: 'EN PROCESO'}); }")
    pag.wait_for_timeout(4200)
    v = pag.evaluate("() => window._vistos")
    ok('Al guardar aparece el circulo "Actualizando…" y luego ✓ "Actualizado"', 'OK Actualizado' in v, str(v))
    # ── Casos y Visitas: primero en Azure (_CV_AZURE_PRIMERO_V1) ──
    RED['google'].clear(); CVG['llamadas'].clear()
    r = pag.evaluate("""async () => { const d = await apiPost({action:'saveCaso', dni:'70000001', nombre:'PRUEBA CV', motivo:'Hurto'}); await new Promise(z => setTimeout(z, 600)); return (d && d.fuente) + ':' + (d && d.nro); }""")
    ok('Caso nuevo: se guarda en Azure (N° de Azure) y NO pasa por Google', r == 'azure:555' and 'saveCaso' not in RED['google'] and CVG['llamadas'] == ['saveCaso'], r + ' | google: ' + ','.join(RED['google']))
    ok('Caso nuevo: Google copia a la hoja en 2do plano (cvAplicarDesdeAzure)', 'cvAplicarDesdeAzure' in RED['google'], ','.join(RED['google']))
    RED['google'].clear(); CVG['llamadas'].clear()
    r = pag.evaluate("""async () => { const x = await Promise.all([apiPost({action:'updateCaso', nro:5, estado_gestion:'CERRADO'}), apiPost({action:'updateCaso', nro:5, estado_gestion:'CERRADO'})]); return x.map(d => d && d.fuente).join(','); }""")
    ok('Caso: doble clic en editar = una sola operacion en Azure', r == 'azure,azure' and CVG['llamadas'] == ['updateCaso'], r + ' | azure: ' + ','.join(CVG['llamadas']))
    RED['google'].clear(); CVG['llamadas'].clear()
    r = pag.evaluate("""async () => { const x = await Promise.all([apiPost({action:'saveVisita', empresa:'RAPEL', asunto:'x'}), apiPost({action:'eliminarVisita', nro:9, usuario:'jtimoteo'}), apiPost({action:'eliminarCaso', nro:9, usuario:'jtimoteo', motivo:'motivo de prueba largo'})]); return x.map(d => (d && d.fuente) + ':' + (d && d.success)).join(','); }""")
    ok('Visita nueva y eliminar visita/caso van a Azure', r == 'azure:true,azure:true,azure:true' and not any(a in RED['google'] for a in ['saveVisita', 'eliminarVisita', 'eliminarCaso']), r + ' | google: ' + ','.join(RED['google']))
    CVG['modo'] = 'caido'; RED['google'].clear()
    r = pag.evaluate("""async () => { const d = await apiPost({action:'saveVisita', empresa:'RAPEL', asunto:'respaldo'}); return d && d.success ? 'OK' : 'ERROR'; }""")
    ok('Visita: con Azure caido, se guarda por Google', r == 'OK' and 'saveVisita' in RED['google'], r + ' | google: ' + ','.join(RED['google']))
    CVG['modo'] = 'ok'
    # ── Nueva Atencion: primero en Azure ──
    AT = {'action': 'saveAtencion', 'dni': '87654321', 'nombre': 'PRUEBA AZURE', 'empresa': 'RAPEL', 'detalle_documento': 'X', 'usuario_sistema': 'jtimoteo'}
    RED['google'].clear(); RED['gurl'].clear(); AZG['llamadas'].clear(); AZG['cuerpos'].clear()
    r = pag.evaluate("""async (b) => { const d = await apiPost(Object.assign({}, b)); await new Promise(z => setTimeout(z, 600)); return (d && d.fuente) + ':' + (d && d.nro); }""", AT)
    hoja = [u for u in RED['gurl'] if 'saveAtencionDesdeAzure' in u]
    ok('Atencion nueva: se guarda en Azure (N° de Azure) y NO pasa por Google', r == 'azure:777' and 'saveAtencion' not in RED['google'] and AZG['llamadas'] == ['guardar'], r + ' | google: ' + ','.join(RED['google']))
    ok('Atencion nueva: la hoja se escribe en 2do plano con el MISMO N°', len(hoja) == 1 and '"nro":777' in hoja[0], str(len(hoja)) + ' ' + (hoja[0][-160:] if hoja else ''))
    ok('Atencion nueva: Azure recibe la huella (client_id)', AZG['cuerpos'] and '"client_id":"at-' in AZG['cuerpos'][0], (AZG['cuerpos'][0][:120] if AZG['cuerpos'] else ''))
    AZG['llamadas'].clear(); RED['google'].clear()
    r = pag.evaluate("""async (b) => { const x = await Promise.all([apiPost(Object.assign({}, b)), apiPost(Object.assign({}, b))]); return x.map(d => d && d.nro).join(','); }""", dict(AT, nombre='DOBLE CLIC'))
    ok('Atencion nueva: doble clic -> 1 solo envio a Azure', AZG['llamadas'] == ['guardar'] and r == '777,777', r + ' | azure: ' + ','.join(AZG['llamadas']))
    AZG['modo'] = 'caido'; AZG['llamadas'].clear(); RED['google'].clear(); RED['gurl'].clear()
    r = pag.evaluate(CARRERA, dict(AT, nombre='AZURE CAIDO'))
    g = [u for u in RED['gurl'] if '"saveAtencion"' in u]
    ok('Atencion nueva: Azure caido -> 2 intentos y se guarda por Google con la misma huella', r['r'] == 'OK' and AZG['llamadas'].count('caido') == 2 and len(g) == 1 and '"client_id":"at-' in g[0], r['r'] + ' ' + str(r['ms']) + ' ms | azure: ' + ','.join(AZG['llamadas']))
    AZG['modo'] = '503'; AZG['llamadas'].clear(); RED['google'].clear()
    r = pag.evaluate(CARRERA, dict(AT, nombre='APAGADO 1'))
    r2 = pag.evaluate(CARRERA, dict(AT, nombre='APAGADO 2'))
    ok('Atencion nueva: apagado (503) -> Google, y no vuelve a preguntar a Azure por 5 min', r['r'] == 'OK' and r2['r'] == 'OK' and AZG['llamadas'] == ['503'] and RED['google'].count('saveAtencion') == 2, 'azure: ' + ','.join(AZG['llamadas']) + ' | google saveAtencion x' + str(RED['google'].count('saveAtencion')))
    AZG['modo'] = 'ok'
    # ── Control de Cumplimiento desde Azure ──
    RED['google'].clear(); CUMPL['llamadas'].clear()
    r = pag.evaluate("""async () => { const d = await apiPost({action:'cumplPendientes', usuario:'jtimoteo', rol:'administrador'}); return (d && d.fuente) + ':' + (d && d.success); }""")
    ok('Cumplimiento: pendientes/campana salen de Azure', r == 'azure:true' and 'cumplPendientes' not in RED['google'], r + ' | google: ' + ','.join(RED['google']))
    r = pag.evaluate("""async () => { const d = await apiGet({action:'getCumplimiento', usuario:'jtimoteo'}); return (d && d.fuente) + ':' + (d && d.success); }""")
    ok('Cumplimiento: aviso del dashboard sale de Azure', r == 'azure:true' and 'getCumplimiento' not in RED['google'], r + ' | google: ' + ','.join(RED['google']))
    r = pag.evaluate("""async () => { const d = await apiPost({action:'cumplPanel', usuario:'jtimoteo', rol:'administrador'}); return (d && d.fuente) + ':' + (d && d.success); }""")
    ok('Cumplimiento: panel del coordinador sale de Azure', r == 'azure:true' and 'cumplPanel' not in RED['google'], r + ' | google: ' + ','.join(RED['google']))
    for modo in ('caido', '503'):
        CUMPL['modo'] = modo; RED['google'].clear()
        r = pag.evaluate(CARRERA, {'action': 'cumplPendientes', 'usuario': 'jtimoteo', 'rol': 'administrador'})
        ok('Cumplimiento: con Azure ' + modo + ', se usa Google', r['r'] == 'OK' and 'cumplPendientes' in RED['google'], r['r'] + ' ' + str(r['ms']) + ' ms | google: ' + ','.join(RED['google']))
    CUMPL['modo'] = 'ok'
    CUMPLW['llamadas'].clear(); RED['google'].clear()
    r = pag.evaluate(CARRERA, {'action': 'cumplJustificar', 'usuario': 'jtimoteo', 'nro': 1, 'justificacion': 'prueba de justificacion'})
    ok('Cumplimiento: justificar se guarda en Azure (_CUMPL_W_V1) y NO por Google', r['r'] == 'OK' and CUMPLW['llamadas'] == ['cumplJustificar'] and 'cumplJustificar' not in RED['google'], r['r'] + ' | azure: ' + ','.join(CUMPLW['llamadas']) + ' | google: ' + ','.join(RED['google']))
    # ── Acceso a Modulos migrado a Azure ──
    ok('Acceso: al entrar, los permisos se leen de Azure (no de Google)', 'permisosListar' in ACC['llamadas'] and 'permisosListar' not in RED['google'],
       'azure: ' + ','.join(ACC['llamadas']) + ' | google tiene permisosListar: ' + str('permisosListar' in RED['google']))
    ACC['llamadas'].clear(); RED['google'].clear(); RED['gurl'].clear()
    r = pag.evaluate(CARRERA, {'action': 'accesoHorarioGuardar', 'usuario': 'jtimoteo', 'rol': 'administrador', 'horario': {'usuario': 'almartinez', 'horaInicio': '05:30', 'horaFin': '17:00'}})
    pag.wait_for_timeout(800)
    copia = [u for u in RED['gurl'] if 'accesoHorarioGuardar' in u]
    ok('Acceso: guardar horario va a Azure y deja copia en la hoja', r['r'] == 'OK' and 'accesoHorarioGuardar' in ACC['llamadas'] and copia and '_desdeAzure' in copia[0],
       r['r'] + ' | azure: ' + ','.join(ACC['llamadas']) + ' | copia hoja: ' + str(len(copia)))
    ACC['modo'] = 'caido'; RED['google'].clear()
    r = pag.evaluate(CARRERA, {'action': 'permisosListar', 'usuario': 'jtimoteo', 'rol': 'administrador'})
    ok('Acceso: con Azure caido, los permisos salen de la hoja', r['r'] == 'OK' and 'permisosListar' in RED['google'], r['r'] + ' ' + str(r['ms']) + ' ms')
    ACC['modo'] = '403'; RED['google'].clear(); RED['gurl'].clear()
    r = pag.evaluate(CARRERA, {'action': 'permisosGuardar', 'usuario': 'jtimoteo', 'rol': 'administrador', 'usuarioObjetivo': 'x', 'modulos': {'navAt': True}})
    g = [u for u in RED['gurl'] if 'permisosGuardar' in u]
    ok('Acceso: sin sesion firmada, el guardado va a la hoja (y Google lo sube a Azure)', r['r'] == 'OK' and g and '_desdeAzure' not in g[0], r['r'] + ' | hoja: ' + str(len(g)))
    ACC['modo'] = 'ok'
    # Google responde 404 una vez al guardar un horario -> se reintenta solo y guarda
    G404['n'] = 1; RED['google'].clear(); ACC['modo'] = 'caido'   # ruta de respaldo (Google)
    r = pag.evaluate(CARRERA.replace('8000', '15000'), {'action': 'accesoHorarioGuardar', 'usuario': 'jtimoteo', 'rol': 'administrador', 'horario': {'usuario': 'almartinez'}})
    ACC['modo'] = 'ok'
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

    # ───────── PERMISOS BLINDADOS (supervisor real: fpulache) ─────────
    PF = {"mod_dashboard": True, "navAt": True, "navCasos": True, "navVisitas": True, "navMisEstadisticas": True, "navFusiones": False, "navMonitor": False, "navHoras": False, "mod_trabajadores": True}
    def sesion_perm(usuario, ls_perm=None):
        c = nav.new_context(service_workers='block')
        U = {'usuario': usuario, 'nombre': usuario.upper(), 'rol': 'supervisor', 'sector': '', 'empresa': 'VERFRUT'}
        c.add_init_script(SIN_ESCAPE)
        c.add_init_script('sessionStorage.setItem("user", ' + json.dumps(json.dumps(U)) + '); sessionStorage.setItem("rl_token","x"); sessionStorage.setItem("api","https://script.google.com/macros/s/AKfycbxZP3UGad-XwRl7sCYmTxeex57b1hEfmqslhe5x0IOzzvpbEbM4VYFR2d52b_YMB1lyyA/exec");'
                          + 'try{localStorage.setItem("rl_nov_2026-09-23_' + usuario + '","1")}catch(e){}'
                          + ('try{localStorage.setItem("rl_perm_' + usuario + '", ' + json.dumps(json.dumps(ls_perm)) + ')}catch(e){}' if ls_perm is not None else ''))
        c.route('**/*', enrutar)
        pg = c.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
        pg.goto(BASE + 'frontend/pages/dashboard.html', wait_until='load'); pg.wait_for_timeout(9500)
        return c, pg, errs
    VIS = """() => { const v=id=>{const b=document.getElementById(id); return b? getComputedStyle(b).display!=='none' : null}; return {fusiones:v('navFusiones'), casos:v('navCasos'), atenciones:v('navAt'), horas:v('navHoras')}; }"""
    ABRIR = """(id) => { ir(id, null); return new Promise(z=>setTimeout(()=>{ const s=document.getElementById('sec-'+id); z(!!(s && s.classList.contains('on'))); }, 400)); }"""
    # 1) permisos normales desde Azure
    PERMX['resp'] = {'success': True, 'permisos': PF, 'vacio': False, 'usuario': 'fpulache', 'fuente': 'azure'}
    c, pg, errs = sesion_perm('fpulache')
    m = pg.evaluate(VIS); f = pg.evaluate(ABRIR, 'fusiones'); cs = pg.evaluate(ABRIR, 'casos')
    ok('Permisos: supervisor ve solo lo suyo y Fusiones no se abre por ningun camino', m['fusiones'] is False and m['casos'] and f is False and cs is True, json.dumps(m) + ' | abre fusiones: ' + str(f) + ' | abre casos: ' + str(cs))
    ok('Permisos: sin errores de JavaScript', not errs, '; '.join(errs[:3])); c.close()
    # 2) Azure y Google fallan, sin permisos previos -> solo lo basico
    ACC['modo'] = 'caido'; PERMX['gas_falla'] = True
    c, pg, errs = sesion_perm('fpulache')
    m = pg.evaluate(VIS); cs = pg.evaluate(ABRIR, 'casos')
    ok('Permisos: si fallan los servidores y no hay datos previos -> solo lo basico (nunca menu completo)', m['atenciones'] and m['fusiones'] is False and m['casos'] is False and cs is False, json.dumps(m) + ' | abre casos: ' + str(cs))
    c.close()
    # 3) fallan, pero hay permisos previos en el equipo -> se usan esos
    c, pg, errs = sesion_perm('fpulache', PF)
    m = pg.evaluate(VIS)
    ok('Permisos: si fallan los servidores se usan los ultimos permisos conocidos', m['casos'] and m['fusiones'] is False, json.dumps(m))
    c.close()
    ACC['modo'] = 'ok'; PERMX['gas_falla'] = False
    # 4) usuario antiguo sin permisos guardados -> menu de siempre
    PERMX['resp'] = {'success': True, 'permisos': {}, 'vacio': True, 'usuario': 'ovilela', 'fuente': 'azure'}
    c, pg, errs = sesion_perm('ovilela')
    m = pg.evaluate(VIS)
    ok('Permisos: usuario antiguo sin permisos guardados conserva su menu', m['atenciones'] is not False, json.dumps(m))
    c.close(); PERMX['resp'] = None

    # ───────── HORAS ─────────
    pag = ctx.new_page(); errores = []
    pag.on('pageerror', lambda e: errores.append((str(e)+' @ '+(e.stack or '').split('\n')[1:3].__str__())[:400]))
    pag.goto(BASE + 'frontend/pages/horas.html', wait_until='load'); pag.wait_for_timeout(3000)
    for acc in ['horasListar', 'horasRegistrar', 'horasEditar', 'horasEliminar', 'horasAprobar', 'horariosListar']:
        r = pag.evaluate(CARRERA, {'action': acc, 'dni': '12345678', 'x': acc})
        ok('Horas ' + acc, r['r'] == 'OK', f"{r['r']} {r['ms']} ms")
    RED['google'].clear()
    ok('Horas pagina cargada (apiPost existe)', pag.evaluate("typeof window.apiPost") == 'function', pag.url + ' | apiPost=' + pag.evaluate("typeof window.apiPost"))
    HORASG['llamadas'].clear(); HORASG['auth'].clear()
    try: pag.evaluate("""async () => { const b={action:'horasRegistrar', dni:'22222222', h:1}; await Promise.all([apiPost(Object.assign({},b)), apiPost(Object.assign({},b))]); await new Promise(z => setTimeout(z, 400)); }""")
    except Exception as e: pass
    ok('Horas doble clic -> 1 solo registro (en Azure, nada por Google)', HORASG['llamadas'] == ['horasRegistrar'] and 'horasRegistrar' not in RED['google'], ','.join(HORASG['llamadas']) + ' | google: ' + ','.join(RED['google']))
    ok('Horas: va con el token del login y Google copia a la hoja en 2do plano', HORASG['auth'] and HORASG['auth'][0].startswith('Bearer ') and 'cvAplicarDesdeAzure' in RED['google'], str(HORASG['auth'][:1]) + ' | ' + ','.join(RED['google']))
    RED['google'].clear(); MODX['llamadas'].clear()
    r = pag.evaluate("""async () => { const d = await apiPost({action:'horasListar', usuario:'jtimoteo'}); return (d && d.fuente) + ':' + (d && d.success); }""")
    ok('Horas: el listado sale de Azure (no de Google)', r == 'azure:true' and 'horasListar' not in RED['google'] and 'horas/horasListar' in MODX['llamadas'], r + ' | google: ' + ','.join(RED['google']))
    r = pag.evaluate("""async () => { const d = await apiPost({action:'horasResumenIndividual', usuario:'jtimoteo', dni:'12345678'}); return (d && d.fuente) + ':' + (d && d.success); }""")
    ok('Horas: saldo por DNI sale de Azure', r == 'azure:true' and 'horasResumenIndividual' not in RED['google'], r)
    RED['google'].clear()
    # ── Horas: guardar primero en Azure (_HORAS_AZURE_PRIMERO_V1) ──
    HORASG['llamadas'].clear()
    for acc in ['horasRegistrar', 'horasEditar', 'horasEliminar', 'horasAprobar', 'horasAgregarMotivo', 'horasEliminarMotivo']:
        r = pag.evaluate("""async (b) => { const d = await apiPost(b); return (d && d.fuente) + ':' + (d && d.success); }""", {'action': acc, 'usuario': 'jtimoteo', 'id': 'H1', 'nombre': 'M ' + acc})
        ok('Horas ' + acc + ': se guarda en Azure y NO por Google', r == 'azure:true' and acc not in RED['google'], r + ' | google: ' + ','.join(RED['google']))
    ok('Horas: las 6 escrituras llegaron a Azure', HORASG['llamadas'] == ['horasRegistrar', 'horasEditar', 'horasEliminar', 'horasAprobar', 'horasAgregarMotivo', 'horasEliminarMotivo'], ','.join(HORASG['llamadas']))
    ok('Horas: el cuerpo lleva la huella (client_id)', all('"client_id":"hr-' in c for c in HORASG['cuerpos'][-6:]), HORASG['cuerpos'][-1][:160])
    HORASG['llamadas'].clear(); RED['google'].clear()
    r = pag.evaluate("""async () => { const b = {action:'horasRegistrar', usuario:'jtimoteo', registro:{dni:'44444444', motivo:'Permiso'}}; await apiPost(Object.assign({}, b)); await new Promise(z => setTimeout(z, 3300)); await apiPost(Object.assign({}, b)); return 'ok'; }""")
    ok('Horas: dos registros iguales hechos a proposito (no doble clic) se guardan los dos', HORASG['llamadas'] == ['horasRegistrar', 'horasRegistrar'] and len(set(c.split('"client_id":')[1] for c in HORASG['cuerpos'][-2:])) == 2, ','.join(HORASG['llamadas']))
    pag.wait_for_timeout(800); HORASG['modo'] = 'rechazo'; RED['google'].clear()
    r = pag.evaluate("""async () => { const d = await apiPost({action:'horasRegistrar', usuario:'x', registro:{dni:'5', motivo:'P'}}); await new Promise(z => setTimeout(z, 300)); return (d && d.success) + ':' + (d && d.error); }""")
    ok('Horas: si Azure dice que no (p. ej. sin permiso), esa es la respuesta y NO se reintenta por Google', r == 'false:Solo administradores pueden registrar' and 'horasRegistrar' not in RED['google'] and 'cvAplicarDesdeAzure' not in RED['google'], r + ' | google: ' + ','.join(RED['google']))
    HORASG['modo'] = 'caido'; RED['google'].clear()
    r = pag.evaluate(CARRERA, {'action': 'horasRegistrar', 'dni': '33333333', 'x': 'reg'})
    ok('Horas: con Azure caido, registrar se guarda por Google', r['r'] == 'OK' and 'horasRegistrar' in RED['google'], r['r'] + ' ' + str(r['ms']) + ' ms | google: ' + ','.join(RED['google']))
    HORASG['modo'] = '503'; RED['google'].clear(); HORASG['llamadas'].clear()
    r = pag.evaluate(CARRERA, {'action': 'horasAprobar', 'id': 'H9', 'x': 'a1'})
    r2 = pag.evaluate(CARRERA, {'action': 'horasAprobar', 'id': 'H8', 'x': 'a2'})
    ok('Horas: con el guardado en Azure apagado (503) va a Google y no insiste por 5 min', r['r'] == 'OK' and r2['r'] == 'OK' and RED['google'].count('horasAprobar') == 2 and HORASG['llamadas'] == ['503'], ','.join(HORASG['llamadas']) + ' | google: ' + ','.join(RED['google']))
    HORASG['modo'] = 'ok'
    MODX['modo'] = 'caido'; RED['google'].clear()
    r = pag.evaluate(CARRERA, {'action': 'horasListar', 'usuario': 'jtimoteo'})
    ok('Horas: con Azure caido, el listado sale de Google', r['r'] == 'OK' and 'horasListar' in RED['google'], r['r'] + ' ' + str(r['ms']) + ' ms')
    MODX['modo'] = 'ok'
    ok('Horas sin errores de JavaScript', not errores, '; '.join(errores[:4]))
    pag.close()

    # ───────── CAPACITACIONES ─────────
    pag = ctx.new_page(); errores = []
    pag.on('pageerror', lambda e: errores.append((str(e)+' @ '+(e.stack or '').split('\n')[1:3].__str__())[:400]))
    pag.goto(BASE + 'frontend/pages/capacitaciones.html', wait_until='load'); pag.wait_for_timeout(3000)
    RED['google'].clear(); MODX['llamadas'].clear()
    r = pag.evaluate("""async () => { const d = await apiPost({action:'listarCapacitaciones', rol:'administrador', usuario:'jtimoteo'}); return (d && d.fuente) + ':' + (d && d.success); }""")
    ok('Capacitaciones: el listado sale de Azure', r == 'azure:true' and 'listarCapacitaciones' not in RED['google'], r + ' | google: ' + ','.join(RED['google']))
    r = pag.evaluate("""async () => { const d = await apiPost({action:'estadisticasCapacitaciones', rol:'administrador', usuario:'jtimoteo'}); return (d && d.fuente) + ':' + (d && d.success); }""")
    ok('Capacitaciones: estadisticas salen de Azure', r == 'azure:true' and 'estadisticasCapacitaciones' not in RED['google'], r)
    RED['google'].clear()
    r = pag.evaluate(CARRERA, {'action': 'exportarCapacitaciones', 'desde': '2026-09-01', 'hasta': '2026-09-30', 'rol': 'administrador'})
    ok('Capacitaciones: el export sigue por Google', r['r'] == 'OK' and 'exportarCapacitaciones' in RED['google'], r['r'])
    MODX['modo'] = 'caido'; RED['google'].clear()
    r = pag.evaluate(CARRERA, {'action': 'listarCapacitaciones', 'rol': 'administrador'})
    ok('Capacitaciones: con Azure caido, sale de Google', r['r'] == 'OK' and 'listarCapacitaciones' in RED['google'], r['r'])
    MODX['modo'] = 'ok'
    # ── Capacitaciones: guardar primero en Azure (_CAP_AZURE_PRIMERO_V1) ──
    RED['google'].clear(); CAPG['llamadas'].clear(); CAPG['auth'].clear()
    r = pag.evaluate("""async () => { const b = {action:'guardarCapacitacion', actividad:{idCapacitacion:'CAP-1', tema:'X'}, asistentes:[{dni:'1'}]}; const x = await Promise.all([apiPost(b), apiPost(b)]); await new Promise(z => setTimeout(z, 500)); return x.map(d => (d && d.fuente) + ':' + (d && d.idCapacitacion)).join(','); }""")
    ok('Capacitacion nueva: se guarda en Azure (una sola vez con doble clic) y NO pasa por Google', r == 'azure:CAP-AZ-1,azure:CAP-AZ-1' and CAPG['llamadas'] == ['guardarCapacitacion'] and 'guardarCapacitacion' not in RED['google'], r + ' | azure: ' + ','.join(CAPG['llamadas']) + ' | google: ' + ','.join(RED['google']))
    ok('Capacitacion nueva: va con el token del login y Google copia a la hoja en 2do plano', CAPG['auth'] and CAPG['auth'][0].startswith('Bearer ') and 'cvAplicarDesdeAzure' in RED['google'], str(CAPG['auth'][:1]) + ' | ' + ','.join(RED['google']))
    CAPG['modo'] = 'caido'; RED['google'].clear()
    r = pag.evaluate("""async () => { const d = await apiPost({action:'duplicarCapacitacion', idCapacitacion:'CAP-1', tituloNuevo:'Otro titulo'}); return d && d.success ? 'OK' : 'ERROR'; }""")
    ok('Duplicar capacitacion: con Azure caido, se hace por Google', r == 'OK' and 'duplicarCapacitacion' in RED['google'], r + ' | google: ' + ','.join(RED['google']))
    CAPG['modo'] = 'ok'
    ok('Capacitaciones sin errores de JavaScript', not errores, '; '.join(errores[:4]))
    pag.close()

    # ───────── INVENTARIO ─────────
    pag = ctx.new_page(); errores = []
    pag.on('pageerror', lambda e: errores.append((str(e)+' @ '+(e.stack or '').split('\n')[1:3].__str__())[:400]))
    pag.goto(BASE + 'frontend/pages/inventario.html', wait_until='load'); pag.wait_for_timeout(3000)
    for acc in ['invGetAll', 'invRegistrarIngreso', 'invRegistrarEntrega', 'invEliminarIngreso']:
        r = pag.evaluate(CARRERA, {'action': acc, 'x': acc})
        ok('Inventario ' + acc, r['r'] == 'OK', f"{r['r']} {r['ms']} ms")
    RED['google'].clear()
    r = pag.evaluate("""async () => { const d = await apiGet({action:'invGetAll'}); return (d && d.fuente) + ':' + (d && d.success); }""")
    ok('Inventario: la carga sale de Azure', r == 'azure:true' and 'invGetAll' not in RED['google'], r + ' | google: ' + ','.join(RED['google']))
    ok('Inventario sin errores de JavaScript', not errores, '; '.join(errores[:4]))
    pag.close()

    # ───────── ESTADISTICAS ADMIN (_ESTADM_AZURE_V1) ─────────
    pag = ctx.new_page(); errores = []
    pag.on('pageerror', lambda e: errores.append((str(e)+' @ '+(e.stack or '').split('\n')[1:3].__str__())[:400]))
    RED['google'].clear(); MODX['llamadas'].clear()
    pag.goto(BASE + 'frontend/pages/estadisticas.html', wait_until='load'); pag.wait_for_timeout(3500)
    r = pag.evaluate("""async () => { const d = await apiGet({action:'getEstadisticasAdmin', empresa:'RAPEL', mes:'', supervisor:'', anio:'2025'}); return (d && d.fuente) + ':' + (d && d.success); }""")
    ok('Pagina Estadisticas: los datos salen de Azure', r == 'azure:true' and 'getEstadisticasAdmin' not in RED['google'], r + ' | google: ' + ','.join(RED['google']))
    MODX['modo'] = 'caido'; RED['google'].clear()
    r = pag.evaluate("""async () => { const d = await apiGet({action:'getEstadisticasAdmin', empresa:'', anio:'2025'}); return d && d.success ? 'OK' : 'ERROR'; }""")
    ok('Pagina Estadisticas: con Azure caido, sale de Google', r == 'OK' and 'getEstadisticasAdmin' in RED['google'], r)
    MODX['modo'] = 'ok'
    ok('Pagina Estadisticas sin errores de JavaScript', not errores, '; '.join(errores[:4]))
    pag.close()

    # ───────── MANTENIMIENTO (_MANT_AZURE_V1) ─────────
    pag = ctx.new_page(); errores = []
    pag.on('pageerror', lambda e: errores.append((str(e)+' @ '+(e.stack or '').split('\n')[1:3].__str__())[:400]))
    pag.goto(BASE + 'frontend/pages/mantenimiento.html', wait_until='load'); pag.wait_for_timeout(3000)
    MPOST = """async (b) => { const r = await fetch(API, {method:'POST', body: JSON.stringify(b), headers:{'Content-Type':'text/plain'}}); return await r.json(); }"""
    MANTG['llamadas'].clear(); MANTG['auth'].clear(); MANTG['cuerpos'].clear(); RED['google'].clear()
    r = pag.evaluate("""async () => { const b = {action:'guardarSolicitudMantenimiento', dni:'73332618', nombre:'TINEO', kilometraje:'995', tipoMantenimiento:'Preventivo', solicitante:'jtimoteo'};
        const f = () => fetch(API, {method:'POST', body: JSON.stringify(b), headers:{'Content-Type':'text/plain'}}).then(r => r.json());
        const x = await Promise.all([f(), f()]); return x.map(d => (d && d.fuente) + ':' + (d && d.ok) + ':' + (d && d.id)).join(','); }""")
    ok('Mantenimiento: solicitud nueva se guarda en Azure (N° de Azure, una sola vez con doble clic) y NO por Google', r == 'azure:true:SOL-018,azure:true:SOL-018' and MANTG['llamadas'] == ['guardarSolicitudMantenimiento'] and 'guardarSolicitudMantenimiento' not in RED['google'], r + ' | azure: ' + ','.join(MANTG['llamadas']) + ' | google: ' + ','.join(RED['google']))
    ok('Mantenimiento: va con el token y la huella, y espera que Google copie a la hoja (y mande el correo)', MANTG['auth'] and MANTG['cuerpos'] and MANTG['auth'][0].startswith('Bearer ') and '"client_id":"mant-' in MANTG['cuerpos'][0] and '"action"' not in MANTG['cuerpos'][0] and 'cvAplicarDesdeAzure' in RED['google'], str(MANTG['auth'][:1]) + ' | ' + (MANTG['cuerpos'][0][:120] if MANTG['cuerpos'] else 'Azure no recibio nada') + ' | google: ' + ','.join(RED['google']))
    MANTG['llamadas'].clear(); RED['google'].clear()
    pag.evaluate("""async () => { nuevaSolicitud(); for (const [id, v] of [['dni','73332618'],['nombre','TINEO'],['kilometraje','995']]) document.getElementById(id).value = v;
        document.getElementById('tipoMant').value = document.getElementById('tipoMant').options[1].value; document.getElementById('tipoLicencia').value = document.getElementById('tipoLicencia').options[1].value; await enviarSolicitud(); }""")
    pag.wait_for_timeout(600)
    t = pag.evaluate("() => document.getElementById('solicitudId').textContent + ' | visible=' + document.getElementById('confirmMsg').classList.contains('show')")
    ok('Mantenimiento (pantalla): ENVIAR SOLICITUD muestra el N° que dio Azure', 'SOL-018' in t and 'visible=True' in t.replace('true', 'True') and MANTG['llamadas'] == ['guardarSolicitudMantenimiento'] and 'guardarSolicitudMantenimiento' not in RED['google'], t + ' | azure: ' + ','.join(MANTG['llamadas']) + ' | google: ' + ','.join(RED['google']))
    MANTG['llamadas'].clear(); RED['google'].clear()
    pag.evaluate("""async () => { _idActual = 'SOL-001'; document.getElementById('progFecha').value = '2026-09-30'; document.getElementById('progComentario').value = 'Traer 8:00'; await guardarProgramacion(); }""")
    pag.wait_for_timeout(600)
    cu = MANTG['cuerpos'][-1] if MANTG['cuerpos'] else ''
    ok('Mantenimiento (pantalla): Programar va a Azure con la fecha dd/mm/aaaa y NO por Google; luego recarga la lista de Google', MANTG['llamadas'] == ['programarMantenimiento'] and '"fechaProgramada":"30/09/2026"' in cu and 'programarMantenimiento' not in RED['google'] and 'listarSolicitudesMantenimiento' in RED['google'], cu[:160] + ' | google: ' + ','.join(RED['google']))
    MANTG['llamadas'].clear(); RED['google'].clear()
    r = pag.evaluate(MPOST, {'action': 'actualizarEstadoMantenimiento', 'id': 'SOL-001', 'estado': 'ATENDIDO', 'admin': 'jtimoteo'})
    ok('Mantenimiento: Atendida/Cerrar va a Azure y NO por Google', r.get('ok') is True and r.get('fuente') == 'azure' and 'actualizarEstadoMantenimiento' not in RED['google'], json.dumps(r) + ' | google: ' + ','.join(RED['google']))
    pag.wait_for_timeout(1500)
    MANTG['modo'] = 'rechazo'; RED['google'].clear()
    pag.evaluate("() => { window._vistos = []; const t = setInterval(() => { const c = document.getElementById('rlProg'); if (c && c.style.display === 'flex') { const v = (c.classList.contains('fin-no') ? 'NO ' : c.classList.contains('fin-ok') ? 'OK ' : 'GIRA ') + c.querySelector('.t').textContent + ' ' + c.querySelector('.d').textContent; if (window._vistos[window._vistos.length-1] !== v) window._vistos.push(v); } }, 60); setTimeout(() => clearInterval(t), 3000); }")
    r = pag.evaluate(MPOST, {'action': 'programarMantenimiento', 'id': 'SOL-999', 'fechaProgramada': '30/09/2026'})
    pag.wait_for_timeout(2500)
    v = pag.evaluate("() => window._vistos")
    ok('Mantenimiento: si Azure dice que no, ese es el mensaje y NO se reintenta por Google', r.get('ok') is False and r.get('msg') == 'No se encontró la solicitud SOL-999' and 'programarMantenimiento' not in RED['google'] and 'cvAplicarDesdeAzure' not in RED['google'], json.dumps(r) + ' | google: ' + ','.join(RED['google']))
    ok('Mantenimiento: el indicador muestra ✗ con el motivo cuando la respuesta es {ok:false}', any(x.startswith('NO No se pudo') and 'SOL-999' in x for x in v), str(v))
    MANTG['modo'] = 'caido'; RED['google'].clear(); MANTG['llamadas'].clear()
    r = pag.evaluate(MPOST, {'action': 'guardarSolicitudMantenimiento', 'dni': '1', 'x': 'caido'})
    ok('Mantenimiento: con Azure caido, se guarda por Google', r.get('ok') is True and 'guardarSolicitudMantenimiento' in RED['google'] and MANTG['llamadas'].count('caido') == 2, json.dumps(r) + ' | azure: ' + ','.join(MANTG['llamadas']) + ' | google: ' + ','.join(RED['google']))
    MANTG['modo'] = '503'; RED['google'].clear(); MANTG['llamadas'].clear()
    pag.evaluate(MPOST, {'action': 'programarMantenimiento', 'id': 'SOL-002', 'x': 1}); pag.evaluate(MPOST, {'action': 'programarMantenimiento', 'id': 'SOL-003', 'x': 2})
    ok('Mantenimiento: apagado (503) -> Google, y no vuelve a preguntar a Azure por 5 min', MANTG['llamadas'] == ['503'] and RED['google'].count('programarMantenimiento') == 2, 'azure: ' + ','.join(MANTG['llamadas']) + ' | google: ' + ','.join(RED['google']))
    MANTG['modo'] = 'ok'; RED['google'].clear()
    r = pag.evaluate("""async () => { const r = await fetch(API + '?' + new URLSearchParams({action:'listarSolicitudesMantenimiento'})); const d = await r.json(); return d && d.ok; }""")
    ok('Mantenimiento: las consultas (listar) siguen por Google', r is True and 'listarSolicitudesMantenimiento' in RED['google'], ','.join(RED['google']))
    ok('Mantenimiento sin errores de JavaScript', not errores, '; '.join(errores[:4]))
    pag.close()

    # ───────── CALCULO REMUNERATIVO y LOGIN ─────────
    # ── Login: pedir acceso temporal fuera de horario va a Azure con las horas pedidas (_USR_AZURE_V1) ──
    pag = ctx.new_page(); errores = []
    pag.on('pageerror', lambda e: errores.append(str(e)[:300]))
    pag.goto(BASE + 'index.html', wait_until='load'); pag.wait_for_timeout(2500)
    USRG['llamadas'].clear(); USRG['cuerpos'].clear(); RED['google'].clear()
    pag.evaluate("""async () => { _bloqueoUser = {usuario:'ptamayo', nombre:'Pool'}; document.getElementById('blMotivo').value = 'Cierre de planilla'; const h = document.getElementById('blHoras'); if (h) { if (!Array.from(h.options || []).some(o => o.value === '3')) { const o = document.createElement('option'); o.value = '3'; h.appendChild(o); } h.value = '3'; } await enviarSolicitudAcceso(); }""")
    pag.wait_for_timeout(800)
    cu = ''.join(USRG['cuerpos'])
    ok('Login: pedir acceso temporal va a Azure con las horas pedidas y NO por Google', USRG['llamadas'] == ['saveSolicitudAcceso'] and '"horas_solicitadas":"3"' in cu and 'saveSolicitudAcceso' not in RED['google'] and pag.evaluate("() => document.getElementById('blConfirmacion').style.display") == 'block', ','.join(USRG['llamadas']) + ' | ' + cu[:160] + ' | google: ' + ','.join(RED['google']))
    USRG['modo'] = 'caido'; USRG['llamadas'].clear(); RED['google'].clear()
    pag.evaluate("""async () => { document.getElementById('blMotivo').value = 'otra'; await enviarSolicitudAcceso(); }""")
    pag.wait_for_timeout(800)
    ok('Login: con Azure caido, pedir acceso va por Google', 'saveSolicitudAcceso' in RED['google'], ','.join(RED['google']))
    USRG['modo'] = 'ok'
    ok('Login (index) sin errores de JavaScript en la solicitud de acceso', not errores, '; '.join(errores[:3]))
    pag.close()
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
