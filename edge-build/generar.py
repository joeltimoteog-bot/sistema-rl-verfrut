import json,os,sys
src=sys.argv[1]; out=[]
for d in sorted(os.listdir(src)):
    fj=os.path.join(src,d,'function.json')
    if not os.path.isfile(fj): continue
    j=json.loads(open(fj,encoding='utf-8-sig').read())
    b=[x for x in j['bindings'] if x.get('type')=='httpTrigger']
    t=[x for x in j['bindings'] if x.get('type')=='timerTrigger']
    if b:
        out.append("  { fn: %s, ruta: %s, metodos: %s, llave: %s, h: require('./%s/index.js') }" % (json.dumps(d), json.dumps(b[0].get('route') or d), json.dumps([m.upper() for m in b[0].get('methods',['get','post'])]), 'true' if b[0].get('authLevel','function')!='anonymous' else 'false', d))
    elif t:   # _FASE3_V1: reloj -> ruta interna con llave (la llama pg_cron)
        out.append("  { fn: %s, ruta: %s, metodos: [\"POST\"], llave: true, reloj: true, h: require('./%s/index.js') }" % (json.dumps(d), json.dumps('_reloj/'+d), d))
open(os.path.join(src,'_rutas_edge.js'),'w').write("/* generado */\nmodule.exports = [\n" + ",\n".join(out) + "\n];\n")
print(len(out),'rutas')
