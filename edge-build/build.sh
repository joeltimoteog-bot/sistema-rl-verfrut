#!/bin/bash
# construye supabase/functions/api/ desde azure/functions (el mismo codigo)
set -e
SRC=${1:-/home/claude/edge/src}; OUT=${2:-/home/claude/edge/supabase/functions/api}
python3 /home/claude/edge/gen/generar.py "$SRC"
cp /home/claude/edge/gen/_adaptador_edge.js "$SRC/"
mkdir -p "$OUT"
cd "$SRC"
./node_modules/.bin/esbuild _adaptador_edge.js --bundle --platform=node --format=esm --target=es2022 \
  --external:mssql --external:tedious --outfile="$OUT/bundle.mjs" --log-level=warning \
  --banner:js="import { createRequire as __cr } from 'node:module'; import __proc from 'node:process'; import { Buffer as __Buf } from 'node:buffer'; const require = __cr(import.meta.url); globalThis.process ??= __proc; globalThis.Buffer ??= __Buf; globalThis.global ??= globalThis;"
cat > "$OUT/index.ts" <<'TS'
// _EDGE_V1 (05-nov-2026): API del Sistema RR.LL. en Supabase (mismo codigo que Azure Functions)
import mod from './bundle.mjs';
const { manejar } = (mod as any).default ?? mod;
Deno.serve((req: Request) => manejar(req));
TS
ls -la "$OUT"
