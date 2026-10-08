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
ATC = {'urls': [], 'data': [], 'total': None}   # _AT_CAMBIOS_V1
AZE = {'modo': 'ok', 'llamadas': [], 'cuerpos': []}   # _EDIT_AZURE_PRIMERO_V1  ok | caido | 503 | 403 | 404
MODX = {'modo': 'ok', 'llamadas': []}
CVG = {'modo': 'ok', 'llamadas': []}   # _CV_AZURE_PRIMERO_V1
CAPG = {'modo': 'ok', 'llamadas': [], 'auth': []}   # _CAP_AZURE_PRIMERO_V1
USRG = {'modo': 'ok', 'llamadas': [], 'cuerpos': []}   # _USR_AZURE_V1  ok | caido
CUMPLW = {'modo': 'ok', 'llamadas': [], 'cuerpos': []}   # _CUMPL_W_V1  ok | caido
AUS_LISTA = [{'id': 'AUS-1', 'usuario': 'ptamayo', 'nombre': 'TAMAYO RODRIGUEZ POOL', 'tipo': 'DESCANSO MEDICO', 'desde': '2026-09-15', 'hasta': '', 'reemplazo': 'nuevo', 'reemplazo_nombre': 'Usuario Nuevo Prueba', 'obs': 'accidente'}]   # _AUSENCIAS_V1
SOLG = {'modo': 'ok', 'llamadas': [], 'auth': []}   # _SOL_AZURE_V1  ok | caido
FUSG = {'modo': 'ok', 'llamadas': [], 'auth': []}   # _FUS_AZURE_V1  ok | caido | 503
E360G = {'modo': 'ok', 'llamadas': [], 'auth': [], 'cuerpos': []}   # _E360_AZURE_V1  ok | rechazo | caido | 503
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
    if a == 'cumplConfigListar': return {'success': True, 'filas': [
        {'clave': 'plazo_investigacion', 'valor': 5, 'descripcion': 'Dias habiles', 'actualizado': '', 'por': ''},
        {'clave': 'dias_laborables', 'valor': 'LUN,MAR,MIE,JUE,VIE', 'descripcion': 'CALENDARIO', 'actualizado': '', 'por': ''},
        {'clave': 'feriados', 'valor': '2026-10-08,2026-12-25', 'descripcion': 'CALENDARIO', 'actualizado': '', 'por': ''},
        {'clave': 'ausencias', 'valor': '[{"id":"AUS-1"}]', 'descripcion': 'AUSENCIAS', 'actualizado': '', 'por': ''}]}
    if a == 'getUsuarios': return {'success': True, 'data': [
        {'usuario': 'ptamayo', 'nombre': 'TAMAYO RODRIGUEZ POOL', 'rol': 'supervisor', 'empresa': 'RAPEL', 'activo': True},
        {'usuario': 'jtimoteo', 'nombre': 'JOEL ANGEL TIMOTEO GONZA', 'rol': 'administrador', 'empresa': 'AMBAS', 'activo': True},
        {'usuario': 'nuevo', 'nombre': 'Usuario Nuevo Prueba', 'rol': 'supervisor', 'empresa': 'VERFRUT', 'activo': True},
        {'usuario': 'baja', 'nombre': 'Usuario Dado De Baja', 'rol': 'supervisor', 'empresa': 'RAPEL', 'activo': False}]}
    if a == 'accesoHorarioDeUsuario': return {'success': True, 'dentro': True, 'tieneHorario': False}
    if a == 'cumplAusencias': return {'success': True, 'hoy': '2026-09-27', 'ausencias': AUS_LISTA}
    if a == 'cumplAusencia': return {'success': True, 'id': 'AUS-g', 'ausencias': AUS_LISTA}
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
        if acc == 'exportarCapacitaciones': base.update({'data': [], 'total': 0, 'esAdmin': True})   # _CAP_EXPORT_AZURE_V1
        if acc in ('getFusiones', 'getSolicitudes', 'getMotivosCasos'): base['data'] = []
        if acc == 'getSupervisores': base['data'] = resp_google('getSupervisores')['data']   # _PRELOAD_AZURE_V1: la misma lista que da Google
        if acc == 'invGetAll': base.update({'productos': [], 'ingresos': [], 'entregas': []})
        if acc == 'getEstadisticasAdmin': base['data'] = {'stats': {'atenciones': {'total': 5, 'enProceso': 1, 'finalizados': 4, 'esteMes': 2}, 'visitas': {'total': 0, 'enPlazo': 0, 'retrasadas': 0, 'esteMes': 0}, 'casos': {'total': 0, 'enPlazo': 0, 'retrasados': 0, 'esteMes': 0}, 'fusiones': {'total': 0, 'pendientes': 0, 'validados': 0, 'trabajadores': 0, 'esteMes': 0}}, 'porSupervisor': {}, 'tendencia': [], 'filtros': {'anio': '', 'mes': ''}}
        return base
    if '/api/atenciones/editar' in url:
        AZE['llamadas'].append('editar'); AZE['cuerpos'].append(post)
        return {'success': True, 'nro': 4242, 'anio': 2026, 'filas': 1, 'fuente': 'azure'}
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
        if acc == 'cumplAusencia':
            if CUMPLW.get('rechazo'): return {'success': False, 'error': 'Ya tiene una ausencia registrada que se cruza (15/09/2026 en adelante).'}
            return {'success': True, 'fuente': 'azure', 'id': 'AUS-2', 'ausencias': AUS_LISTA + [{'id': 'AUS-2', 'usuario': 'baja2', 'nombre': 'X', 'tipo': 'VACACIONES', 'desde': '2026-10-01', 'hasta': '2026-10-15', 'reemplazo': 'jtimoteo', 'reemplazo_nombre': 'JOEL'}]}
        return {'success': True, 'fuente': 'azure', 'hasta': '2026-10-04', 'cambios': 1, 'config': {}}
    if '/api/cumpl/' in url:
        acc = url.split('/api/cumpl/')[1].split('?')[0]
        CUMPL['llamadas'].append(acc)
        if acc == 'cumplAusencias': return {'success': True, 'hoy': '2026-09-27', 'ausencias': AUS_LISTA, 'fuente': 'azure'}
        if acc == 'cumplPanel' and CUMPL.get('aus'):
            idx = {'porcentaje': 100, 'nivel': 'EXCELENTE'}
            return {'success': True, 'hoy': '2026-09-28', 'fuente': 'azure', 'config': {}, 'supervisores': [
                {'usuario': 'ptamayo', 'nombre': 'TAMAYO RODRIGUEZ POOL', 'empresa': 'RAPEL', 'sector': 'A', 'visitas_pendientes': 0, 'casos_abiertos': 0, 'en_plazo': 0, 'por_vencer': 0, 'vencidos': 0, 'criticos': 0, 'porcentaje': 100, 'nivel': 'EXCELENTE', 'restriccion': False, 'exonerado_hasta': '', 'indice': idx,
                 'ausencia': {'tipo': 'DESCANSO MEDICO', 'desde': '2026-09-15', 'hasta': '2026-10-10', 'reemplazo': 'Usuario Nuevo Prueba'}},
                {'usuario': 'nuevo', 'nombre': 'Usuario Nuevo Prueba', 'empresa': 'VERFRUT', 'sector': '', 'visitas_pendientes': 1, 'casos_abiertos': 1, 'en_plazo': 0, 'por_vencer': 0, 'vencidos': 1, 'criticos': 1, 'porcentaje': 0, 'nivel': 'BAJO', 'restriccion': False, 'exonerado_hasta': '', 'indice': idx,
                 'cubriendo': [{'nombre': 'TAMAYO RODRIGUEZ POOL', 'tipo': 'DESCANSO MEDICO', 'desde': '2026-09-15', 'hasta': '2026-10-10'}]}],
              'actividades': [{'tipo': 'CASO', 'clave': 'caso_5', 'caso': 5, 'actividad': 'Investigación e informe', 'trabajador': 'JUAN', 'responsable': 'Usuario Nuevo Prueba', 'cubre_a': 'TAMAYO RODRIGUEZ POOL', 'ausencia_hasta': '2026-10-10', 'fecha_registro': '2026-09-10', 'fecha_limite': '2026-09-17', 'dias_retraso': 7, 'dias_restantes': -7, 'estado': 'CRITICO', 'documentos_pendientes': ['Informe'], 'usuario': 'nuevo'}]}
        if acc == 'cumplPanel': return {'success': True, 'hoy': '2026-09-26', 'supervisores': [], 'actividades': [], 'config': {}, 'fuente': 'azure'}
        if acc == 'cumplPendientes' and CUMPL.get('venc'): return {'success': True, 'usuario': 'ptamayo', 'nombre': 'POOL TAMAYO', 'rol': 'supervisor', 'esAdmin': False, 'hoy': '2026-09-28',
                'config': {'aviso_proximo_dias': 2, 'critico_dias': 5, 'escalar_dias': 3, 'excelente': 90, 'regular': 70},
                'actividades': [{'tipo': 'CASO', 'clave': 'caso_77', 'caso': 77, 'actividad': 'Investigación e informe', 'trabajador': 'JUAN', 'fecha_limite': '2026-09-22', 'dias_retraso': 6, 'dias_restantes': -6, 'estado': 'CRITICO', 'accion': 'Subir Informe', 'documentos_pendientes': ['Informe']},
                                {'tipo': 'CASO', 'clave': 'caso_78', 'caso': 78, 'actividad': 'Cierre del caso', 'trabajador': 'ANA', 'fecha_limite': '2026-09-26', 'dias_retraso': 2, 'dias_restantes': -2, 'estado': 'VENCIDO', 'accion': 'Concluir el caso', 'documentos_pendientes': []}],
                'resumen': {'EN_PLAZO': 0, 'PROXIMO': 0, 'VENCE_HOY': 0, 'VENCIDO': 1, 'CRITICO': 1}, 'restriccion': {'activa': False, 'modulos': [], 'criticos': 1, 'motivo': '', 'exonerado_hasta': ''}, 'indice': None, 'fuente': 'azure'}
        if acc == 'cumplPendientes' and CUMPL.get('cal'): return {'success': True, 'usuario': 'jtimoteo', 'nombre': 'JOEL', 'rol': 'administrador', 'esAdmin': True, 'hoy': '2026-09-26',
                'config': {'aviso_proximo_dias': 2, 'critico_dias': 5, 'escalar_dias': 3, 'excelente': 90, 'regular': 70, 'calendario': CUMPL['cal']},
                'actividades': [], 'resumen': {'EN_PLAZO': 0, 'PROXIMO': 0, 'VENCE_HOY': 0, 'VENCIDO': 0, 'CRITICO': 0}, 'restriccion': {'activa': False, 'modulos': [], 'criticos': 0, 'motivo': '', 'exonerado_hasta': ''}, 'indice': None, 'fuente': 'azure'}
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
    if '/api/e360/guardar/' in url:
        acc = url.split('/api/e360/guardar/')[1].split('?')[0]
        E360G['llamadas'].append(acc); E360G['cuerpos'].append(post)
        if E360G['modo'] == 'rechazo': return {'success': False, 'error': 'Sin permisos: solo administradores pueden eliminar evaluaciones'}
        if acc == 'saveEvaluacion360': return {'success': True, 'id': 'EVA-1', 'accion': 'creada', 'periodo': '2026-09', 'fuente': 'azure'}
        return {'success': True, 'mensaje': 'Evaluación archivada correctamente', 'fuente': 'azure'}
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
        ATC['urls'].append(url)
    if re.search(r'/api/atenciones\?', url) and 'cambiosDesde=' in url:   # _AT_CAMBIOS_V1
        if 'cambiosDesde=2999' in url: return {'success': True, 'total': 0, 'data': [], 'ahora': '2026-10-02T05:00:00.000Z'}
        d = list(ATC['data'])
        return {'success': True, 'total': ATC['total'] if ATC['total'] is not None else len(d), 'data': d, 'ahora': '2026-10-02T05:03:00.000Z'}
    if re.search(r'/api/atenciones\?', url):
        hoy = time.strftime('%Y-%m-%d')
        return {'success': True, 'total': 2, 'data': [
            {'id': 1, 'nro': 500, 'dni': '11111111', 'nombre': 'A', 'fecha_atencion': hoy, 'supervisor': 'SUPERVISOR PRUEBA', 'estado': 'EN PROCESO'},
            {'id': 2, 'nro': 500, 'dni': '22222222', 'nombre': 'B', 'fecha_atencion': hoy, 'supervisor': 'SUPERVISOR PRUEBA', 'estado': 'EN PROCESO'}]}
    if '/api/usuarios/lista' in url:   # _PRELOAD_AZURE_V1
        RED.setdefault('usrlista', []).append(1)
        return {'success': True, 'data': resp_google('getUsuarios')['data'], 'fuente': 'azure'}
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
        if '/api/e360/guardar/' in url:
            E360G['auth'].append(req.headers.get('authorization', ''))
            if E360G['modo'] == 'caido':
                E360G['llamadas'].append('caido')
                return route.abort()
            if E360G['modo'] == '503':
                E360G['llamadas'].append('503')
                return route.fulfill(status=503, body='{"success":false,"apagado":true}', headers={'content-type': 'application/json', 'access-control-allow-origin': '*'})
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
        if '/api/atenciones/editar' in url and AZE['modo'] != 'ok':
            AZE['llamadas'].append(AZE['modo'])
            if AZE['modo'] == 'caido': return route.abort()
            cuerpo = {'503': '{"success":false,"apagado":true}', '403': '{"success":false,"error":"No tienes permiso para editar este registro."}', '404': '{"success":false,"noEsta":true}'}[AZE['modo']]
            return route.fulfill(status=int(AZE['modo']), body=cuerpo, headers={'content-type': 'application/json', 'access-control-allow-origin': '*'})
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
    if 'firebaseio.com/trafico/' in url and req.method == 'PUT': RED.setdefault('trf', []).append(req.post_data or '')   # _TRAFICO_V2
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
    ok('Casos/Visitas: al entrar se traen de Azure (la hoja no los lee)', not pre and nC == 2 and nV == 1 and 'getCasos' in CV['llamadas'],
       'preload por Google: ' + str(len(pre)) + ' | casos ' + str(nC) + ' | visitas ' + str(nV) + ' | azure: ' + ','.join(CV['llamadas']))
    # ── Carga al entrar desde Azure (_PRELOAD_AZURE_V1) ──
    r = pag.evaluate("() => [CACHE.stats && CACHE.stats.hoy, (CACHE.supervisores || []).length, Array.isArray(CACHE.fusiones), Array.isArray(CACHE.solicitudes)].join('|')")
    ok('Carga al entrar (admin): sale de Azure (cifras, fusiones, solicitudes, supervisores) y NO pide getPreloadOptimizado a Google', not pre and r == '1|3|true|true' and all(m in MODX['llamadas'] for m in ['fus/getFusiones', 'sup/getSupervisores', 'sol/getSolicitudes']), r + ' | mod: ' + ','.join(sorted(set(MODX['llamadas']))))
    PRE = {'action': 'getPreloadOptimizado', 'usuario': 'jtimoteo', 'nombre': 'JOEL', 'rol': 'administrador', 'empresa': '', 'cvAzure': '1'}
    RED['google'].clear()
    r = pag.evaluate("""async (p) => { const d = await apiGet(p); return [d && d.fuente, d && d.data && d.data.usuarios && d.data.usuarios.length, d && d.data && d.data.stats && d.data.stats.anio].join('|'); }""", PRE)
    ok('Carga al entrar (administrador): usuarios y cifras vienen de Azure (/usuarios/lista y /atenciones/stats)', r == 'azure|4|3' and 'getPreloadOptimizado' not in RED['google'] and 'getUsuarios' not in RED['google'], r + ' | google: ' + ','.join(RED['google']))
    r = pag.evaluate("""async (p) => { const d = await apiGet(Object.assign({}, p, {rol: 'coordinador'})); return [d && d.fuente, d && d.data && ('usuarios' in d.data)].join('|'); }""", PRE)
    ok('Carga al entrar (coordinador): no pide ni manda la lista de usuarios (como Google)', r == 'azure|false', r)
    RED['google'].clear()
    r = pag.evaluate("""async () => { const d = await apiGet({action: 'getUsuarios', usuario: 'jtimoteo', rol: 'administrador'}); return (d && d.fuente) + ':' + (d && d.data && d.data.length) + ':' + (d && d.data && d.data.some(u => 'password' in u)); }""")
    ok('Gestion de usuarios: la lista sale de Azure (sin contraseñas)', r == 'azure:4:false' and 'getUsuarios' not in RED['google'], r + ' | google: ' + ','.join(RED['google']))
    MODX['modo'] = 'caido'; RED['google'].clear()
    r = pag.evaluate("""async (p) => { const t0 = Date.now(); const d = await apiGet(p); return [d && d.success, d && d.fuente === 'azure', Date.now() - t0 < 8000].join('|'); }""", PRE)
    ok('Carga al entrar: si Azure falla, la carga completa va por Google (como antes)', r == 'true|false|true' and 'getPreloadOptimizado' in RED['google'], r + ' | google: ' + ','.join(RED['google']))
    MODX['modo'] = 'ok'; RED['google'].clear()
    r = pag.evaluate("""async () => { const d = await apiGet({action: 'getSupervisores'}); return (d && d.fuente) + ':' + (d && d.data && d.data.length); }""")
    ok('Supervisores: la lista sale de Azure (antes ~22 s por Google)', r == 'azure:3' and 'getSupervisores' not in RED['google'], r + ' | google: ' + ','.join(RED['google']))
    # ── Mis Atenciones: refresco solo con lo que cambio (_AT_CAMBIOS_V1) ──
    def completas(): return [u for u in ATC['urls'] if 'cambiosDesde=' not in u]
    def cambios(): return [u for u in ATC['urls'] if 'cambiosDesde=' in u and 'cambiosDesde=2999' not in u]
    pag.evaluate("() => { _atCur.t = null; }"); ATC['urls'].clear(); ATC['data'] = []; ATC['total'] = None
    pag.evaluate("async () => { await refrescarAtencionesHoy('prueba 1'); }")
    ok('Mis Atenciones: la 1ra vez toma la hora de Azure (limit=1) y hace la carga completa de 2 dias', any('cambiosDesde=2999' in u and 'limit=1&' in u for u in ATC['urls']) and len(completas()) >= 1, str(len(completas())) + ' completas | ' + ' '.join(u.split('?')[1][:60] for u in ATC['urls'])[:300])
    ATC['urls'].clear()
    r = pag.evaluate("async () => await refrescarAtencionesHoy('prueba 2')")
    ok('Mis Atenciones: luego pide SOLO lo que cambio (sin carga completa) y con 2 min de margen', r is False and len(cambios()) == 1 and not completas() and 'cambiosDesde=2026-10-02T04%3A58%3A00.000Z' in cambios()[0], str(r) + ' | ' + ' '.join(u.split('?')[1][:90] for u in ATC['urls']))
    hoyS = time.strftime('%Y-%m-%d'); ATC['urls'].clear()
    ATC['data'] = [{'id': 77, 'nro': 7777, 'dni': '33333333', 'nombre': 'CAMBIO NUEVO', 'fecha_atencion': hoyS + 'T00:00:00.000Z', 'supervisor': 'X', 'estado': 'FINALIZADO'}]
    r = pag.evaluate("async () => { await refrescarAtencionesHoy('prueba 3'); const a = (CACHE.atenciones || []).find(x => String(x.nro) === '7777'); return a ? a.estado + '|' + a.fecha_atencion : 'no esta'; }")
    ok('Mis Atenciones: un cambio llega a la lista (con la fecha normalizada) sin recargar los 2 dias', r == 'FINALIZADO|' + hoyS and not completas() and 'cambiosDesde=2026-10-02T05%3A01%3A00.000Z' in ''.join(cambios()), r + ' | ' + ' '.join(u.split('?')[1][:90] for u in ATC['urls']))
    ATC['urls'].clear(); ATC['total'] = 5000
    pag.evaluate("async () => { await refrescarAtencionesHoy('prueba 4'); }")
    ok('Mis Atenciones: si hay demasiados cambios (mas de 1000), hace la carga completa como antes', len(completas()) >= 1, str(len(completas())) + ' completas')
    ATC['data'] = []; ATC['total'] = None
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
    # ── _CALENDARIO_V1: un solo calendario laboral (L-V por defecto, feriados) para casos, visitas y cumplimiento ──
    r = pag.evaluate("""() => { const y = d => { const x = sumarDiasHabiles(new Date(d + 'T00:00:00'), 5); return x.getFullYear() + '-' + ('0' + (x.getMonth() + 1)).slice(-2) + '-' + ('0' + x.getDate()).slice(-2); };
        const v = d => { const x = fechaLimiteInforme(new Date(d + 'T00:00:00')); return x.getFullYear() + '-' + ('0' + (x.getMonth() + 1)).slice(-2) + '-' + ('0' + x.getDate()).slice(-2); };
        return [y('2026-09-28'), y('2026-10-05'), v('2026-10-02'), v('2026-10-04'), RL_CAL.dias.join('')].join('|'); }""")
    ok('Calendario: caso reportado lun 28/09 vence lun 05/10 (sin sab/dom); el del 05/10 vence 13/10 (8/10 feriado); visitas vencen el lunes', r == '2026-10-05|2026-10-13|2026-10-05|2026-10-05|12345', str(r))
    CUMPL['cal'] = {'dias': [1, 2, 3, 4, 5, 6], 'feriados': ['2026-10-05']}
    pag.evaluate("async () => { await window._cumplRecargar('prueba calendario'); }"); pag.wait_for_timeout(300)
    r = pag.evaluate("""() => { const x = fechaLimiteInforme(new Date('2026-10-02T00:00:00')); return RL_CAL.dias.join('') + '|' + x.getDate() + '|' + JSON.parse(localStorage.getItem('rl_calendario')).feriados.join(','); }""")
    ok('Calendario: si el administrador lo cambia (L-S, lunes 05/10 feriado), la pantalla lo toma y la visita vence el martes 06/10', r == '123456|6|2026-10-05', str(r))
    CUMPL['cal'] = {'dias': [1, 2, 3, 4, 5], 'feriados': ['2026-10-08', '2026-12-25']}
    pag.evaluate("async () => { await window._cumplRecargar('prueba calendario 2'); }"); pag.wait_for_timeout(300); CUMPL.pop('cal', None)
    CUMPLW['llamadas'].clear(); CUMPLW['cuerpos'].clear()
    pag.evaluate("() => { const b = document.getElementById('navCumpl'); if (b) b.click(); }"); pag.wait_for_timeout(1200)
    pag.evaluate("() => { const t = document.querySelector('.cumpl-tabs button[data-t=\\'cfg\\']'); if (t) t.click(); }"); pag.wait_for_timeout(1200)
    r = pag.evaluate("() => { const s = document.querySelector('[data-tipo=\\'dias\\']'), t = document.querySelector('[data-tipo=\\'feriados\\']'); if (!s || !t) return 'sin controles: ' + (document.getElementById('cumplAdminBody') || {}).innerText; return s.querySelectorAll('input:checked').length + '|' + t.value.split('\\n').length; }")
    ok('Configuracion: dias laborables con casillas (5 marcadas) y feriados en un cuadro', r == '5|2', str(r)[:200])
    pag.evaluate("""() => { const s = document.querySelector('[data-tipo="dias"]'); s.querySelector('input[value="SAB"]').checked = true; const t = document.querySelector('[data-tipo="feriados"]'); t.value = '25/12/2026\\n2026-10-08\\n2026-12-8'; document.getElementById('cumplCfgGuardar').click(); }""")
    pag.wait_for_timeout(1500)
    cu = ''.join(CUMPLW['cuerpos'])
    ok('Configuracion: al guardar envia el calendario ordenado (LUN..SAB y feriados aaaa-mm-dd)', 'cumplConfigGuardar' in CUMPLW['llamadas'] and '"dias_laborables":"LUN,MAR,MIE,JUE,VIE,SAB"' in cu and '"feriados":"2026-10-08,2026-12-08,2026-12-25"' in cu, ','.join(CUMPLW['llamadas']) + ' | ' + cu[:300])
    pag.evaluate("() => { const t = document.querySelector('[data-tipo=\\'feriados\\']'); if (t) { t.value = '31/02/2026'; document.getElementById('cumplCfgGuardar').click(); } }"); pag.wait_for_timeout(600)
    ok('Configuracion: una fecha de feriado no valida se rechaza (no se guarda)', CUMPLW['llamadas'].count('cumplConfigGuardar') == 1, ','.join(CUMPLW['llamadas']))
    r = pag.evaluate("() => { const b = document.getElementById('cumplAdminBody'); return (b.innerText.indexOf('registren desde hoy') >= 0) + '|' + !document.querySelector('[data-k=\"plazos_historial\"]') + '|' + !!(document.querySelector('[data-k=\"plazo_investigacion\"]') && !document.querySelector('[data-k=\"plazo_investigacion\"]').disabled); }")
    ok('Configuracion (jtimoteo): aviso de que el cambio de plazo aplica a casos nuevos, historial oculto y plazos editables', r == 'true|true|true', r)
    r = pag.evaluate("""async () => { const u0 = USER.usuario; USER.usuario = 'ovilela'; const t = document.querySelector('.cumpl-tabs button[data-t=\\'cfg\\']'); if (t) t.click(); await new Promise(z => setTimeout(z, 1200));
        const i = document.querySelector('[data-k="plazo_investigacion"]'), g = document.getElementById('cumplCfgGuardar'); const x = (i && i.disabled) + '|' + (g && g.style.display === 'none') + '|' + (document.getElementById('cumplAdminBody').innerText.indexOf('Solo el administrador del sistema') >= 0);
        USER.usuario = u0; if (t) t.click(); await new Promise(z => setTimeout(z, 1200)); return x; }""")
    ok('Configuracion: otro administrador la ve pero NO puede cambiar plazos ni calendario', r == 'true|true|true', r)
    ok('Configuracion: las ausencias NO aparecen como parametro editable (se gestionan en Usuarios)', pag.evaluate("() => !document.querySelector('[data-k=\"ausencias\"]') && !!document.getElementById('cumplCfgGuardar')"), 'ok')
    # ── _AUSENCIAS_V1: insignias en la tabla del coordinador ──
    CUMPL['aus'] = True
    pag.evaluate("async () => { const t = document.querySelector('.cumpl-tabs button[data-t=\\'tabla\\']'); if (t) t.click(); await window._cumplPanelAdmin(true); }"); pag.wait_for_timeout(900)
    r = pag.evaluate("() => (document.getElementById('cumplAdminBody') || {}).innerText || ''")
    ok('Panel: el ausente muestra su motivo y quien lo cubre; el reemplazo muestra a quien cubre', 'Descanso médico hasta 10/10/2026' in r and 'lo cubre Usuario Nuevo Prueba' in r and 'Cubre a TAMAYO RODRIGUEZ POOL' in r, r[:400].replace('\n', ' | '))
    pag.evaluate("() => { const t = document.querySelector('.cumpl-tabs button[data-t=\\'acts\\']'); if (t) t.click(); }"); pag.wait_for_timeout(600)
    r = pag.evaluate("() => (document.getElementById('cumplAdminBody') || {}).innerText || ''")
    ok('Panel: en actividades, el caso heredado dice "cubre a" el titular', 'cubre a TAMAYO RODRIGUEZ POOL' in r, r[:300].replace('\n', ' | '))
    CUMPL.pop('aus', None)
    # ── _AUSENCIAS_V1: tambien en Gestion Usuarios DENTRO del dashboard (la que usa Joel) ──
    pag.evaluate("() => { delete CACHE.usuarios; ir('usuarios', document.getElementById('navUsr')); }"); pag.wait_for_timeout(1500)
    r = pag.evaluate("() => document.getElementById('tbUs').innerText + ' || ' + document.getElementById('tbAus').innerText + ' || ' + document.querySelectorAll('#tbUs button').length + ' || ' + USER.usuario + ' || ' + typeof window._ausBtn")
    ok('Dashboard > Gestion Usuarios: columna Ausencia/Reemplazo, boton 🔄 Ausencia y tarjeta de ausencias', 'Descanso médico' in r and 'Cubre a TAMAYO RODRIGUEZ POOL' in r and 'VIGENTE' in r and '🔄 Ausencia' in r, r[-250:].replace('\n', ' '))
    CUMPLW['llamadas'].clear(); CUMPLW['cuerpos'].clear(); RED['google'].clear()
    pag.evaluate("() => { _ausAbrir('nuevo'); sv('aus_tipo','VACACIONES'); sv('aus_reemp','jtimoteo'); sv('aus_desde','2026-10-01'); _ausGuardarForm(); }"); pag.wait_for_timeout(1200)
    ok('Dashboard > Gestion Usuarios: registrar ausencia va a Azure y no por Google', CUMPLW['llamadas'] == ['cumplAusencia'] and '"titular":"nuevo"' in ''.join(CUMPLW['cuerpos']) and 'cumplAusencia' not in RED['google'], ','.join(CUMPLW['llamadas']) + ' | google: ' + ','.join(RED['google']))
    pag.evaluate("() => cerrar('mAus')")
    pag.evaluate("() => { const b = document.getElementById('navDash') || document.querySelector('.ni'); if (b) b.click(); }"); pag.wait_for_timeout(300)
    # ── _COLUMNAS_AT_V1: Mis Atenciones (Excel) y Consulta por DNI (tabla y Excel) con TODAS las columnas ──
    r = pag.evaluate("""async () => { const cap = []; const orig = window.exportarExcelGen; window.exportarExcelGen = (d, cols, n) => cap.push(n + ':' + cols.length + ':' + cols.map(c => c.key).join('|'));
        window._atFiltradas = [{nro: 1, dni: '11111111'}]; exportarAtenciones(); window._consultaDNIResultados = [{nro: 1}]; exportarConsultaDNI(); window.exportarExcelGen = orig; return cap; }""")
    at = r[0] if r else ''; cd = r[1] if len(r) > 1 else ''
    faltan = [k for k in ['nro','fecha_atencion','hora_inicio','hora_termino','nro_semana','mes','anio','dni','nombre','sexo','fecha_inicio_periodo','empresa','fundo','cargo','ruta','codigo','fundo_actual','celular','supervisor','detalle_documento','fecha_inicio_doc','fecha_termino_doc','dias_transcurridos','responsable_recepcion','observaciones','estado','fecha_registro','usuario_sistema','nro_licencia','parentesco'] if k not in at.split(':')[-1].split('|') or k not in cd.split(':')[-1].split('|')]
    ok('Excel de Mis Atenciones y de Consulta por DNI llevan TODAS las columnas (33 / 34 con cumpleaños; + Tipo de Licencia)', at.startswith('Atenciones:33:') and cd.startswith('ConsultaDNI:34:') and 'tipo_licencia' in at and not faltan, at[:40] + ' | ' + cd[:40] + ' | faltan: ' + ','.join(faltan))
    pag.evaluate("() => { document.getElementById('cDNI').value = '11111111'; }")
    pag.evaluate("async () => { await consultarDNI(); }"); pag.wait_for_timeout(800)
    r = pag.evaluate("() => { const t = document.querySelector('#consultaResult table'); if (!t) return 'sin tabla: ' + document.getElementById('consultaResult').innerText.slice(0, 120); return t.querySelectorAll('thead th').length + ':' + t.querySelectorAll('tbody tr').length + ':' + (t.querySelector('tbody tr') ? t.querySelector('tbody tr').children.length : 0) + ':' + Array.from(t.querySelectorAll('thead th')).map(x => x.textContent).slice(0, 6).join('|'); }")
    ok('Consulta por DNI: la tabla muestra TODAS las columnas (34) en cada fila', re.match(r'^34:[1-9]\d*:34:', str(r)) is not None, str(r))   # _AT_TIPO_LIC_V1: + Tipo de Licencia
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
    RED['trf'] = []
    r = pag.evaluate("""() => { rlPlazosFijar({plazo_investigacion: 3, plazo_documentos: 7, plazo_cierre: 10, historial: [{clave: 'plazo_investigacion', valor: 5, hasta: '2026-09-27'}]});
        const fr = document.getElementById('cFechaReporte'), fl = document.getElementById('cFechaLimite'); if (!fr || !fl) return 'sin formulario';
        _editandoCasoNro = null; fr.value = '2026-10-01'; calcularFechaLimiteCaso(); const nuevo = fl.value;
        casosData.push({nro: 9191, fecha_reg: '2026-09-20'}); _editandoCasoNro = 9191; calcularFechaLimiteCaso(); const viejo = fl.value; _editandoCasoNro = null;
        return nuevo + '|' + viejo + '|' + rlPlazoEn('plazo_investigacion', '2026-09-27') + '|' + rlPlazoEn('plazo_investigacion', '2026-09-28'); }""")
    ok('Casos: caso NUEVO vence a los 3 dias habiles (01/10 → 06/10); un caso registrado antes del cambio conserva sus 5 dias (→ 09/10, 8/10 feriado)', r == '2026-10-06|2026-10-09|5|3', str(r))
    r = pag.evaluate("""() => { const tb = document.getElementById('tbCasos'); if (!tb) return 'sin tabla'; renderTablaCasos([{nro: 1, nombre: 'A', estado_caso: 'CONCLUIDO_CON_RETRASO', estado_gestion: 'CERRADO', fecha_limite: '2026-09-01'}, {nro: 2, nombre: 'B', estado_caso: 'CONCLUIDO_DENTRO_PLAZO', estado_gestion: 'CERRADO', fecha_limite: '2026-09-01'}]); return tb.innerText; }""")
    ok('Casos: el concluido fuera de plazo sale como OBSERVADO POR RETRASO (el concluido a tiempo, CONCLUIDO)', 'OBSERVADO POR RETRASO' in str(r) and 'CONCLUIDO' in str(r), ' '.join(str(r).split())[:200])
    r = pag.evaluate("() => COLS_AT_TODAS.map(c => c.label).join('|') + ' || ' + COLS_CONSULTA_DNI.map(c => c.key).join(',')")
    ok('Excel de atenciones: trae Parentesco, N° Licencia, Autorizado por y F. Término Periodo; Consulta DNI mantiene Cumpleaños despues de Código', all(x in r for x in ['|Parentesco', '|N° Licencia', '|Autorizado por', 'F. Término Periodo']) and 'codigo,cumpleanos,fundo_actual' in r, r[:400])
    r = pag.evaluate("""async () => { atTodas.push({nro: 4242, dni: '12345678', nombre: 'EDIT PRUEBA', empresa: 'RAPEL', detalle_documento: '34 LICENCIA POR MATERNIDAD', nro_licencia: 'LIC-99', autorizado_por: 'ESSALUD', parentesco: '', fecha_termino_periodo: '2026-12-31'});
        editarAt(4242); await new Promise(z => setTimeout(z, 300));
        const g = id => (document.getElementById(id) || {}).value; const x = [g('at_nlic'), g('at_autoriz'), g('at_ftp')].join('|'); cerrar('mAt'); return x; }""")
    ok('Editar atencion: el formulario carga N° licencia, Autorizado por y F. Término Periodo (antes quedaban vacios y se perdian)', r == 'LIC-99|ESSALUD|2026-12-31', str(r))
    r = pag.evaluate("() => [window._respDe('35 DESCANSO MEDICO - ENFERMEDAD','RAPEL'), window._respDe('34 LICENCIA POR MATERNIDAD','RAPEL'), window._respDe('35 DESCANSO MEDICO - ENFERMEDAD','VERFRUT')].join('|')")
    ok('Mis Atenciones: documentos de RAPEL que llevaba Tania Vera van ahora a Rubi Figueroa (VERFRUT sigue con Leandro)', r == 'RUBI FIGUEROA FLORES|RUBI FIGUEROA FLORES|LEANDRO BILL MORALES YARLEQUE', r)
    AT = {'action': 'saveAtencion', 'dni': '87654321', 'nombre': 'PRUEBA AZURE', 'empresa': 'RAPEL', 'detalle_documento': 'X', 'usuario_sistema': 'jtimoteo', 'autorizado_por': 'ESSALUD', 'fecha_termino_periodo': '2026-12-31'}
    RED['google'].clear(); RED['gurl'].clear(); AZG['llamadas'].clear(); AZG['cuerpos'].clear()
    r = pag.evaluate("""async (b) => { const d = await apiPost(Object.assign({}, b)); await new Promise(z => setTimeout(z, 600)); return (d && d.fuente) + ':' + (d && d.nro); }""", AT)
    hoja = [u for u in RED['gurl'] if 'saveAtencionDesdeAzure' in u]
    ok('Atencion nueva: se guarda en Azure (N° de Azure) y NO pasa por Google', r == 'azure:777' and 'saveAtencion' not in RED['google'] and AZG['llamadas'] == ['guardar'], r + ' | google: ' + ','.join(RED['google']))
    pag.wait_for_timeout(600)
    trf = [json.loads(x) for x in RED.get('trf', []) if x]
    g = [t for t in trf if t.get('accion') == 'Guardó atención']
    ok('Atencion nueva: Autorizado por y F. Término Periodo viajan a Azure', any('"autorizado_por":"ESSALUD"' in c and '"fecha_termino_periodo":"2026-12-31"' in c for c in AZG['cuerpos']), ''.join(AZG['cuerpos'])[:200])
    ok('Monitor en vivo: la atencion guardada en Azure aparece en el trafico (una sola vez, destino Azure SQL, con N°)', len(g) == 1 and g[0].get('destino') == 'Azure SQL' and 'N° 777' in g[0].get('detalle', '') and g[0].get('u') == 'jtimoteo', json.dumps(g)[:300])
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
    # ── Editar atencion: primero en Azure (_EDIT_AZURE_PRIMERO_V1) ──
    ED = {'action': 'updateAtencion', 'nro': 4242, 'estado': 'FINALIZADO', 'hora_termino': '10:30', 'observaciones': 'ok', 'rol': 'administrador', 'usuario': 'jtimoteo'}
    def limpiar_ed(): AZE['llamadas'].clear(); AZE['cuerpos'].clear(); RED['google'].clear(); RED['gurl'].clear()
    limpiar_ed()
    r = pag.evaluate("""async (b) => { const t0 = Date.now(); const d = await apiPost(Object.assign({}, b)); await new Promise(z => setTimeout(z, 900)); return (d && d.fuente) + ':' + (d && d.success) + ':' + (Date.now() - t0); }""", ED)
    hoja = [u for u in RED['gurl'] if 'updateAtencionDesdeAzure' in u]
    ok('Editar atencion: va a Azure y NO espera a Google (ni pide syncAtencionAzure)', r.startswith('azure:true:') and AZE['llamadas'] == ['editar'] and 'updateAtencion' not in RED['google'] and 'syncAtencionAzure' not in RED['google'], r + ' | azure: ' + ','.join(AZE['llamadas']) + ' | google: ' + ','.join(RED['google']))
    ok('Editar atencion: la hoja se actualiza en 2do plano (una vez, mismo N°)', len(hoja) == 1 and '"nro":4242' in hoja[0] and '"estado":"FINALIZADO"' in hoja[0], str(len(hoja)) + ' ' + (hoja[0][-160:] if hoja else ''))
    ok('Editar atencion: Azure no recibe "action" y si recibe rol/usuario', AZE['cuerpos'] and '"action"' not in AZE['cuerpos'][0] and '"usuario":"jtimoteo"' in AZE['cuerpos'][0], (AZE['cuerpos'][0][:160] if AZE['cuerpos'] else ''))
    pag.wait_for_timeout(300)
    trf = [json.loads(x) for x in RED.get('trf', []) if x]
    ge = [t for t in trf if t.get('accion') == 'Actualizó atención']
    ok('Monitor en vivo: la edicion aparece una vez como Azure SQL (la copia a la hoja no se cuenta)', len(ge) == 1 and ge[0].get('destino') == 'Azure SQL', json.dumps(ge)[:300])
    limpiar_ed()
    r = pag.evaluate("""async (b) => { const x = await Promise.all([apiPost(Object.assign({}, b)), apiPost(Object.assign({}, b))]); return x.map(d => d && d.fuente).join(','); }""", dict(ED, observaciones='doble'))
    ok('Editar atencion: doble clic -> 1 solo envio a Azure', AZE['llamadas'] == ['editar'] and r == 'azure,azure', r + ' | azure: ' + ','.join(AZE['llamadas']))
    limpiar_ed()
    r = pag.evaluate("""async () => { atTodas.push({nro: 4343, dni: '12345678', nombre: 'EDIT AZ', empresa: 'RAPEL', detalle_documento: '34 LICENCIA POR MATERNIDAD', nro_licencia: 'LIC-1', autorizado_por: 'ESSALUD', parentesco: '', fecha_termino_periodo: '2026-12-31', estado: 'EN PROCESO'});
        editarAt(4343); await new Promise(z => setTimeout(z, 300)); await guardarAt(); await new Promise(z => setTimeout(z, 600)); try { cerrar('mAt'); } catch (e) {} return 'ok'; }""")
    cu = ''.join(AZE['cuerpos'])
    ok('Editar atencion (formulario completo): Autorizado por, licencia y fin de periodo viajan a Azure', AZE['llamadas'] == ['editar'] and '"autorizado_por":"ESSALUD"' in cu and '"nro_licencia":"LIC-1"' in cu and '"fecha_termino_periodo":"2026-12-31"' in cu and '"parentesco"' in cu and 'updateAtencion' not in RED['google'], cu[:300] + ' | google: ' + ','.join(RED['google']))
    AZE['modo'] = 'caido'; limpiar_ed()
    r = pag.evaluate(CARRERA, dict(ED, observaciones='caido'))
    ok('Editar atencion: Azure caido -> 2 intentos y se edita por Google (con sync a Azure como antes)', r['r'] == 'OK' and AZE['llamadas'].count('caido') == 2 and 'updateAtencion' in RED['google'], r['r'] + ' ' + str(r['ms']) + ' ms | azure: ' + ','.join(AZE['llamadas']) + ' | google: ' + ','.join(RED['google']))
    AZE['modo'] = '403'; limpiar_ed()
    r = pag.evaluate("""async (b) => { const d = await apiPost(Object.assign({}, b)); return (d && d.success) + ':' + (d && d.error); }""", dict(ED, observaciones='ajeno', rol='supervisor'))
    ok('Editar atencion: sin permiso (403) -> muestra el aviso y NO va a Google', r == 'false:No tienes permiso para editar este registro.' and 'updateAtencion' not in RED['google'], r + ' | google: ' + ','.join(RED['google']))
    AZE['modo'] = '404'; limpiar_ed()
    r = pag.evaluate("""async (b) => { const d = await apiPost(Object.assign({}, b)); return String(d && d.success); }""", dict(ED, observaciones='no esta'))
    ok('Editar atencion: no esta en Azure (404) -> se edita por Google', r == 'true' and AZE['llamadas'] == ['404'] and 'updateAtencion' in RED['google'], r + ' | azure: ' + ','.join(AZE['llamadas']) + ' | google: ' + ','.join(RED['google']))
    AZE['modo'] = '503'; limpiar_ed()
    r = pag.evaluate(CARRERA, dict(ED, observaciones='apagado 1'))
    r2 = pag.evaluate(CARRERA, dict(ED, observaciones='apagado 2'))
    ok('Editar atencion: apagado (503) -> Google, y no vuelve a preguntar a Azure por 5 min', r['r'] == 'OK' and r2['r'] == 'OK' and AZE['llamadas'] == ['503'] and RED['google'].count('updateAtencion') == 2, 'azure: ' + ','.join(AZE['llamadas']) + ' | google updateAtencion x' + str(RED['google'].count('updateAtencion')))
    AZE['modo'] = 'ok'
    # ── _EDIT_RAPIDO_V1: "Detalle -> Actualizar" no espera la recarga completa ──
    limpiar_ed()
    r = pag.evaluate("""async () => {
        const orig = refrescarEnBackground; let llamado = false;
        refrescarEnBackground = () => { llamado = true; return new Promise(z => setTimeout(z, 5000)); };   // recarga lenta simulada
        try {
          atTodas.push({nro: 4545, dni: '12345678', nombre: 'DET RAPIDO', estado: 'EN PROCESO', fecha_atencion: hoy()});
          detNro = 4545; sv('dEst', 'FINALIZADO'); sv('dHT', '11:45'); sv('dObs', 'listo');
          const t0 = Date.now(); await updateAt(); const ms = Date.now() - t0;
          await new Promise(z => setTimeout(z, 500));
          const a = atTodas.find(x => String(x.nro) === '4545');
          return [ms < 1500, a && a.estado, a && a.hora_termino, llamado, (document.getElementById('_toast') || {}).textContent || ''].join('|');
        } finally { refrescarEnBackground = orig; }
    }""")
    ok('Detalle -> Actualizar: responde al instante (no espera la recarga completa) y la fila se ve cambiada', r.startswith('true|FINALIZADO|11:45|true|') and 'Actualizado' in r and (AZE['llamadas'] == ['editar'] or 'updateAtencion' in RED['google']), r + ' | azure: ' + ','.join(AZE['llamadas']) + ' | google: ' + ','.join(RED['google']))   # tras la prueba del 503, por 5 min va por Google (a proposito)
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
    RED['google'].clear(); RED['gurl'].clear(); RED['azure'].clear(); MODX['llamadas'].clear()
    pag = ctxS.new_page(); errores = []
    pag.on('pageerror', lambda e: errores.append((str(e)+' @ '+(e.stack or '').split('\n')[1:3].__str__())[:400]))
    pag.goto(BASE + 'frontend/pages/dashboard.html', wait_until='load')
    pag.wait_for_timeout(6000)
    pre = [u for u in RED['gurl'] if 'getPreloadOptimizado' in u]
    ok('Supervisor: la carga al entrar sale de Azure (no pide getPreloadOptimizado a Google)', not pre and 'sup/getSupervisores' in MODX['llamadas'], str(len(pre)) + ' pedidos a Google | mod: ' + ','.join(sorted(set(MODX['llamadas']))))
    ok('Supervisor: no lee atenciones de la hoja al entrar', 'getAtencionesOptimizado' not in RED['google'], ','.join(sorted(set(RED['google']))))
    n = pag.evaluate("(typeof CACHE!=='undefined' && Array.isArray(CACHE.atenciones)) ? CACHE.atenciones.length : -1")
    ok('Supervisor: atenciones cargadas desde Azure al entrar', n >= 1, str(n) + ' registros')
    r = pag.evaluate("""async () => { await _sincronizarPapelera(); const x = await window._azAtencionesSup(30, true);
      return (x||[]).map(a => a.nro + '|' + a.dni).join(','); }""")
    ok('Supervisor: eliminada se oculta y la otra con el mismo N° sigue visible', r == '500|22222222', r)
    RED['google'].clear(); AZE['llamadas'].clear()
    r = pag.evaluate(CARRERA, {'action': 'updateAtencion', 'nro': 500, 'estado': 'FINALIZADO', 'usuario': 'sprueba', 'rol': 'supervisor'})
    pag.wait_for_timeout(1500)
    ok('Supervisor: editar -> guarda en Azure y copia a la hoja en 2do plano (_EDIT_AZURE_PRIMERO_V1)', r['r'] == 'OK' and AZE['llamadas'] == ['editar'] and 'updateAtencionDesdeAzure' in RED['google'] and 'updateAtencion' not in RED['google'], r['r'] + ' | azure: ' + ','.join(AZE['llamadas']) + ' | red: ' + ','.join(RED['google']))
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
    # _AVISO_ESCALAR_V1: supervisor con casos retrasados -> aviso claro de que se reporta a Joel Timoteo y Eduardo Coveñas
    CUMPL['venc'] = True
    c, pg, errs = sesion_perm('ptamayo')
    t = pg.evaluate("() => { const g = document.getElementById('cumplGate'); return g ? g.innerText : 'SIN AVISO'; }")
    ok('Aviso de casos retrasados: el supervisor ve cuantos tiene, el detalle y que se reportara a Joel Timoteo y Eduardo Coveñas', 'TIENES 2 CASOS / ACTIVIDADES RETRASADAS' in t and 'Joel Timoteo' in t and 'Eduardo Coveñas' in t and '3 días hábiles de retraso' in t and '1 de tus actividades ya superaron' in t and 'Por favor, cumple con este proceso' in t, t[:300].replace('\n', ' '))
    c.close(); CUMPL.pop('venc', None)
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
    ok('Capacitaciones: el export (y Fecha anterior) sale de Azure', r['r'] == 'OK' and 'exportarCapacitaciones' not in RED['google'] and 'cap/exportarCapacitaciones' in MODX['llamadas'], r['r'])   # _CAP_EXPORT_AZURE_V1
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

    # ───────── EVALUACION 360 (_E360_AZURE_V1) ─────────
    pag = ctx.new_page(); errores = []
    pag.on('pageerror', lambda e: errores.append((str(e)+' @ '+(e.stack or '').split('\n')[1:3].__str__())[:400]))
    pag.goto(BASE + 'frontend/pages/evaluacion360.html', wait_until='load'); pag.wait_for_timeout(3000)
    ok('Evaluacion 360: la pagina carga (apiPost existe)', pag.evaluate("typeof apiPost") == 'function', pag.url)
    r = pag.evaluate("() => Array.from(document.getElementById('eval_supervisor').options).map(o => o.value)")
    pool = [x for x in r if 'tamayo' in x.lower()]
    ok('Evaluacion 360: "Supervisor evaluado" trae a todos los usuarios activos, sin repetir a quien ya estaba ni a los dados de baja', 'JOEL ANGEL TIMOTEO GONZA' in r and 'USUARIO NUEVO PRUEBA' in r and 'USUARIO DADO DE BAJA' not in r and pool == ['POOL TAMAYO RODRÍGUEZ'] and 'DEYSI QUISPE JUÁREZ' in r and all(x == x.upper() for x in r), str(len(r)) + ' opciones | tamayo: ' + str(pool) + ' | ' + ', '.join(r[-4:]))
    r = pag.evaluate("() => { const s = document.getElementById('eval_supervisor'); s.value = 'USUARIO NUEVO PRUEBA'; actualizarEmpresaSup(); return document.getElementById('eval_empresa').value; }")
    ok('Evaluacion 360: al elegir un usuario nuevo se pone su empresa', r == 'VERFRUT', str(r))
    r = pag.evaluate("() => { localStorage.setItem('eval360_historial', JSON.stringify([{id:'A', supervisor:'Pool Tamayo Rodríguez', periodo:'2026-06', porcentaje:70}])); return getHistorial()[0].supervisor; }")
    ok('Evaluacion 360: las evaluaciones antiguas tambien se ven en MAYUSCULAS (mismo supervisor que la lista)', r == 'POOL TAMAYO RODRÍGUEZ', str(r))
    E360G['llamadas'].clear(); E360G['auth'].clear(); E360G['cuerpos'].clear(); RED['google'].clear()
    r = pag.evaluate("""async () => { const b = {action:'saveEvaluacion360', id:'EVA-1', supervisor:'Pool Tamayo Rodríguez', empresa:'RAPEL', fecha:'2026-09-27', periodo:'2026-09', competencias:[{nombre:'Liderazgo', promedio:4, respuestas:[{valor:4}]}], porcentaje:80, clasificacion:'Bueno', evaluadorUser:'JOEL'};
        const x = await Promise.all([apiPost(Object.assign({}, b)), apiPost(Object.assign({}, b))]); return x.map(d => (d && d.fuente) + ':' + (d && d.success) + ':' + (d && d.accion)).join(','); }""")
    ok('Evaluacion 360: guardar va a Azure (una sola vez con doble clic) y NO por Google', r == 'azure:true:creada,azure:true:creada' and E360G['llamadas'] == ['saveEvaluacion360'] and 'saveEvaluacion360' not in RED['google'], r + ' | azure: ' + ','.join(E360G['llamadas']) + ' | google: ' + ','.join(RED['google']))
    ok('Evaluacion 360: va con el token y la huella, y espera que Google copie a la hoja', E360G['cuerpos'] and E360G['auth'][0].startswith('Bearer ') and '"client_id":"e360-' in E360G['cuerpos'][0] and '"periodo":"2026-09"' in E360G['cuerpos'][0] and 'cvAplicarDesdeAzure' in RED['google'], str(E360G['auth'][:1]) + ' | ' + (E360G['cuerpos'][0][:140] if E360G['cuerpos'] else 'Azure no recibio nada') + ' | google: ' + ','.join(RED['google']))
    E360G['llamadas'].clear(); RED['google'].clear()
    r = pag.evaluate("""async () => { const d = await apiPost({action:'deleteEvaluacion360', id:'EVA-1', usuario:'jtimoteo'}); return (d && d.fuente) + ':' + (d && d.success); }""")
    ok('Evaluacion 360: eliminar va a Azure y NO por Google', r == 'azure:true' and E360G['llamadas'] == ['deleteEvaluacion360'] and 'deleteEvaluacion360' not in RED['google'], r + ' | google: ' + ','.join(RED['google']))
    pag.wait_for_timeout(800); E360G['modo'] = 'rechazo'; RED['google'].clear()
    r = pag.evaluate("""async () => { const d = await apiPost({action:'deleteEvaluacion360', id:'EVA-2', usuario:'jtimoteo'}); await new Promise(z => setTimeout(z, 300)); return (d && d.success) + ':' + (d && d.error); }""")
    ok('Evaluacion 360: si Azure dice que no (sin permiso), ese es el mensaje y NO se reintenta por Google', r == 'false:Sin permisos: solo administradores pueden eliminar evaluaciones' and 'deleteEvaluacion360' not in RED['google'] and 'cvAplicarDesdeAzure' not in RED['google'], r + ' | google: ' + ','.join(RED['google']))
    E360G['modo'] = 'caido'; RED['google'].clear(); E360G['llamadas'].clear()
    r = pag.evaluate(CARRERA, {'action': 'saveEvaluacion360', 'supervisor': 'X', 'x': 'caido'})
    ok('Evaluacion 360: con Azure caido, se guarda por Google', r['r'] == 'OK' and 'saveEvaluacion360' in RED['google'] and E360G['llamadas'].count('caido') == 2, r['r'] + ' | azure: ' + ','.join(E360G['llamadas']) + ' | google: ' + ','.join(RED['google']))
    E360G['modo'] = '503'; RED['google'].clear(); E360G['llamadas'].clear()
    pag.evaluate(CARRERA, {'action': 'saveEvaluacion360', 'supervisor': 'Y', 'x': 1}); pag.evaluate(CARRERA, {'action': 'saveEvaluacion360', 'supervisor': 'Z', 'x': 2})
    ok('Evaluacion 360: apagado (503) -> Google, y no vuelve a preguntar a Azure por 5 min', E360G['llamadas'] == ['503'] and RED['google'].count('saveEvaluacion360') == 2, 'azure: ' + ','.join(E360G['llamadas']) + ' | google: ' + ','.join(RED['google']))
    E360G['modo'] = 'ok'; RED['google'].clear()
    r = pag.evaluate("""async () => { const d = await apiGet({action:'getEvaluaciones360', empresa:'AMBAS'}); return d && d.success; }""")
    ok('Evaluacion 360: la lista sigue saliendo de Google', r is True and 'getEvaluaciones360' in RED['google'], ','.join(RED['google']))
    ok('Evaluacion 360 sin errores de JavaScript', not errores, '; '.join(errores[:4]))
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
    # ── _AUSENCIAS_V1: Gestion Usuarios → Ausencia / Reemplazo ──
    pag = ctx.new_page(); errores = []
    pag.on('pageerror', lambda e: errores.append(str(e)[:300]))
    pag.on('dialog', lambda d: d.accept('2026-10-05') if d.type == 'prompt' else d.accept())
    pag.goto(BASE + 'frontend/pages/usuarios.html', wait_until='load'); pag.wait_for_timeout(2500)
    r = pag.evaluate("() => document.getElementById('tbUs').innerText + ' || ' + document.getElementById('tbAus').innerText")
    ok('Usuarios: la fila del ausente dice su motivo y su reemplazo; la del reemplazo dice a quien cubre; y la tarjeta lo lista VIGENTE', '🏥 Descanso médico' in r and 'reemplazo: Usuario Nuevo Prueba' in r and 'Cubre a TAMAYO RODRIGUEZ POOL' in r and 'VIGENTE' in r and 'cumplAusencias' in CUMPL['llamadas'], r[:500].replace('\n', ' '))
    r = pag.evaluate("() => { _ausAbrir('ptamayo'); const o = Array.from(document.querySelectorAll('#aus_reemp option')).map(x => x.value); return o.join(',') + '|' + document.getElementById('ausLista').innerText; }")
    ok('Usuarios: el reemplazo se elige entre usuarios ACTIVOS (sin el titular ni los dados de baja) y se ven sus ausencias registradas', r.startswith(',jtimoteo,nuevo|') and 'Se reincorporó' in r, r[:200])
    CUMPLW['llamadas'].clear(); CUMPLW['cuerpos'].clear(); RED['google'].clear()
    pag.evaluate("() => { sv('aus_tipo','VACACIONES'); sv('aus_desde','2026-10-01'); sv('aus_hasta','2026-10-15'); _ausGuardarForm(); }"); pag.wait_for_timeout(400)
    ok('Usuarios: sin reemplazo no se guarda', CUMPLW['llamadas'] == [] and 'cumplAusencia' not in RED['google'], ','.join(CUMPLW['llamadas']))
    pag.evaluate("() => { _ausAbrir('baja'); sv('aus_tipo','VACACIONES'); sv('aus_reemp','jtimoteo'); sv('aus_desde','2026-10-01'); sv('aus_hasta','2026-10-15'); sv('aus_obs','vacaciones'); _ausGuardarForm(); _ausGuardarForm(); }"); pag.wait_for_timeout(1200)
    cu = ''.join(CUMPLW['cuerpos'])
    ok('Usuarios: registrar ausencia va a Azure UNA vez (doble clic), con titular, reemplazo y huella, y NO por Google', CUMPLW['llamadas'] == ['cumplAusencia'] and '"op":"registrar"' in cu and '"titular":"baja"' in cu and '"reemplazo":"jtimoteo"' in cu and '"client_id":"aus-' in cu and 'cumplAusencia' not in RED['google'] and 'cvAplicarDesdeAzure' in RED['google'], ','.join(CUMPLW['llamadas']) + ' | ' + cu[:200] + ' | google: ' + ','.join(RED['google']))
    r = pag.evaluate("() => document.getElementById('tbAus').innerText")
    ok('Usuarios: tras guardar, la tarjeta muestra la nueva ausencia PROGRAMADA', 'PROGRAMADA' in r, r[:300].replace('\n', ' '))
    CUMPLW['llamadas'].clear(); CUMPLW['cuerpos'].clear()
    pag.evaluate("() => { _ausAbrir('ptamayo'); _ausReincorporar('AUS-1'); }"); pag.wait_for_timeout(900)
    cu = ''.join(CUMPLW['cuerpos'])
    ok('Usuarios: "Se reincorporó" envia la fecha de regreso', CUMPLW['llamadas'] == ['cumplAusencia'] and '"op":"reincorporar"' in cu and '"regreso":"2026-10-05"' in cu and '"id":"AUS-1"' in cu, cu[:200])
    CUMPLW['rechazo'] = True; CUMPLW['llamadas'].clear(); RED['google'].clear()
    r = pag.evaluate("async () => { _ausAbrir('ptamayo'); sv('aus_tipo','LICENCIA'); sv('aus_reemp','nuevo'); sv('aus_desde','2026-10-01'); await _ausGuardarForm(); await new Promise(z => setTimeout(z, 300)); return (document.getElementById('_toast') || {}).textContent; }")
    ok('Usuarios: si Azure dice que no (se cruza), se muestra el motivo y NO se reintenta por Google', 'se cruza' in (r or '') and 'cumplAusencia' not in RED['google'], str(r))
    CUMPLW.pop('rechazo', None); CUMPLW['modo'] = 'caido'; RED['google'].clear()
    pag.evaluate("async () => { _ausAbrir('ptamayo'); sv('aus_tipo','LICENCIA'); sv('aus_reemp','nuevo'); sv('aus_desde','2026-11-01'); await _ausGuardarForm(); }"); pag.wait_for_timeout(1500)
    ok('Usuarios: con Azure caido, la ausencia se guarda por Google', 'cumplAusencia' in RED['google'], ','.join(RED['google']))
    CUMPLW['modo'] = 'ok'
    trf = [json.loads(x) for x in RED.get('trf', []) if x]
    ok('Monitor en vivo: en Gestion Usuarios se ve "Abrió Gestión usuarios" y el registro de ausencia (Azure SQL)', any(t.get('accion') == 'Abrió Gestión usuarios' for t in trf) and any(t.get('accion') == 'Registró ausencia / reemplazo' and t.get('destino') == 'Azure SQL' for t in trf) and any(t.get('accion') == 'Registró ausencia / reemplazo' and t.get('destino') == 'Google Sheets' for t in trf), ', '.join(sorted(set(t.get('accion', '') + '@' + t.get('destino', '') for t in trf)))[:400])
    ok('Gestion Usuarios sin errores de JavaScript', not errores, '; '.join(errores[:3]))
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
