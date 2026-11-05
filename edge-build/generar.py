import json,os,sys
src=sys.argv[1]; out=[]
for d in sorted(os.listdir(src)):
    fj=os.path.join(src,d,'function.json')
    if not os.path.isfile(fj): continue
    j=json.loads(open(fj,encoding='utf-8-sig').read())
    b=[x for x in j['bindings'] if x.get('type')=='httpTrigger']
    if not b or b[0].get('authLevel')!='anonymous': continue
    out.append("  { fn: %s, ruta: %s, metodos: %s, h: require('./%s/index.js') }" % (json.dumps(d), json.dumps(b[0].get('route') or d), json.dumps([m.upper() for m in b[0].get('methods',['get','post'])]), d))
open(os.path.join(src,'_rutas_edge.js'),'w').write("/* generado */\nmodule.exports = [\n" + ",\n".join(out) + "\n];\n")
print(len(out),'rutas')
