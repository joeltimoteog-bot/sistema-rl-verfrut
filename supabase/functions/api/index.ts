// _EDGE_V1 (05-nov-2026): API del Sistema RR.LL. en Supabase (mismo codigo que Azure Functions)
import mod from './bundle.mjs';
const { manejar } = (mod as any).default ?? mod;
Deno.serve((req: Request) => manejar(req));
