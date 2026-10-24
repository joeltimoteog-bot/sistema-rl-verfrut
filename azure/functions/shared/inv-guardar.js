/* ═══════════════════════════════════════════════════════════════════════════
   _INV_AZURE_V1 (24-oct-2026) — INVENTARIO DE CANASTAS se guarda PRIMERO en Azure
   ---------------------------------------------------------------------------
   Replica LITERALMENTE las versiones vigentes del Apps Script (las ultimas definidas) sobre
   las 8 tablas espejo (INV_Productos, INV_Receta, INV_Responsables, INV_Meta, INV_Ingresos,
   INV_Canastas_Armadas, INV_Entregas, INV_Sectores), con las mismas reglas:
     stock = ingresos del producto - (canastas armadas x cantidad de la receta)
     disponibles por tipo (CANASTA / BOLSA) = armados del tipo - entregas del tipo
     no se puede borrar o reducir un armado si dejaria entregas sin respaldo
   invGetAll se arma desde las tablas con la misma forma que la respuesta de Google.
   Cada operacion queda en dbo.CV_Ops (tipo 'inv'); el Apps Script la copia a la hoja y
   refresca la copia JSON (mod/inv). Sin permisos especiales (igual que en Google): solo sesion.
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
const { sql } = require('./db');
const TH = require('./tablas-hoja');
const CG = require('./cv-guardar');
const CAP = require('./cap-guardar');

const K = { prod: 'inv_productos', rec: 'inv_receta', resp: 'inv_responsables', meta: 'inv_meta', ing: 'inv_ingresos', arm: 'inv_armados', ent: 'inv_entregas', sec: 'inv_sectores' };
const CLAVES = Object.keys(K).map(k => K[k]);
const ANCHO = { inv_productos: 5, inv_receta: 6, inv_responsables: 3, inv_meta: 3, inv_ingresos: 14, inv_armados: 10, inv_entregas: 15, inv_sectores: 5 };
const ACCIONES = ['invAgregarReceta', 'invEliminarReceta', 'invAgregarResponsable', 'invEliminarResponsable', 'invGuardarMeta',
  'invRegistrarIngreso', 'invEditarIngreso', 'invEliminarIngreso', 'invRegistrarArmado', 'invEditarArmado', 'invEliminarArmado',
  'invRegistrarEntrega', 'invEditarEntrega', 'invEliminarEntrega', 'invAgregarProducto', 'invEditarProducto', 'invEliminarProducto',
  'invAgregarSector', 'invEditarSector', 'invEliminarSector'];
const LECTURAS = ['invGetAll'];
/* que tabla toca cada accion */
const TABLA = { invAgregarReceta: K.rec, invEliminarReceta: K.rec, invAgregarResponsable: K.resp, invEliminarResponsable: K.resp, invGuardarMeta: K.meta,
  invRegistrarIngreso: K.ing, invEditarIngreso: K.ing, invEliminarIngreso: K.ing, invRegistrarArmado: K.arm, invEditarArmado: K.arm, invEliminarArmado: K.arm,
  invRegistrarEntrega: K.ent, invEditarEntrega: K.ent, invEliminarEntrega: K.ent, invAgregarProducto: K.prod, invEditarProducto: K.prod, invEliminarProducto: K.prod,
  invAgregarSector: K.sec, invEditarSector: K.sec, invEliminarSector: K.sec };

const esD = v => !!(v && typeof v === 'object' && typeof v.$d === 'string');
const S = v => esD(v) ? v.$s : String(v == null ? '' : v);
const vacio = v => v === '' || v === null || v === undefined;
/* valor como lo entrega Google al JSON: las fechas en ISO; lo demas tal cual */
const J = v => esD(v) ? (v.$d || '') : (v === undefined ? '' : v);
const p2 = n => (n < 10 ? '0' : '') + n;
const lima = ms => new Date(ms - 5 * 3600e3);
const ymdLima = ms => { const x = lima(ms); return x.getUTCFullYear() + '-' + p2(x.getUTCMonth() + 1) + '-' + p2(x.getUTCDate()); };
const tipoNorm = t => { t = String(t || '').toUpperCase(); return t.indexOf('BOL') === 0 ? 'BOLSA' : 'CANASTA'; };   /* = _invTipoNorm_ */
const fechaMs = v => { const d = esD(v) ? new Date(v.$d) : new Date(v); return isNaN(d) ? NaN : d.getTime(); };
const ordenFechaDesc = (a, b) => (fechaMs(b.fecha) || 0) - (fechaMs(a.fecha) || 0);
const pad = (f, n) => { const c = f.slice(); while (c.length < n) c.push(''); return c; };

async function encendido(pool) {
  const r = await pool.request().query("SELECT valor FROM dbo.CV_Estado WHERE clave = 'inv_azure_primero'");
  return r.recordset.length && r.recordset[0].valor === '1';
}

/* ── lecturas (= invLeer* del Apps Script) ── */
const leerReceta = T => T.filas.filter(r => !vacio(r[0])).map(r => ({ id: J(r[0]), producto: J(r[1]), unidad: J(r[2]), cantidad: Number(J(r[3])) || 0 }));
const leerResponsables = T => T.filas.filter(r => !vacio(r[0])).map(r => ({ id: J(r[0]), nombre: J(r[1]) }));
function leerMeta(T) {
  const meta = { total: 0, descripcion: '' };
  T.filas.forEach(r => { if (r[0] === 'total') meta.total = Number(J(r[1])) || 0; if (r[0] === 'descripcion') meta.descripcion = J(r[1]) || ''; });
  return meta;
}
const leerIngresos = T => T.filas.filter(r => !vacio(r[0])).map(r0 => { const r = pad(r0, 14); return {
  id: J(r[0]), fechaRegistro: J(r[1]), producto: J(r[2]), cantidad: Number(J(r[3])) || 0, unidad: J(r[4]), fechaIngreso: J(r[5]), fechaVenc: J(r[6]), lote: J(r[7]),
  responsable: J(r[8]), proveedor: J(r[9]), observaciones: J(r[10]), usuario: J(r[11]), sector: J(r[12]) || '', supervisor: J(r[13]) || '' }; });
const leerArmados = T => T.filas.filter(r => !vacio(r[0])).map(r0 => { const r = pad(r0, 10); return {
  id: J(r[0]), fechaRegistro: J(r[1]), fecha: J(r[2]), cantidad: Number(J(r[3])) || 0, responsable: J(r[4]), observaciones: J(r[5]), usuario: J(r[6]),
  sector: J(r[7]) || '', supervisor: J(r[8]) || '', tipo: tipoNorm(J(r[9])) }; }).sort(ordenFechaDesc);
const leerEntregas = T => T.filas.filter(r => !vacio(r[0])).map(r0 => { const r = pad(r0, 15); return {
  id: J(r[0]), fechaRegistro: J(r[1]), fecha: J(r[2]), empresa: J(r[3]), sector: J(r[4]), cantidad: Number(J(r[5])) || 0, responsable: J(r[6]), documento: J(r[7]),
  observaciones: J(r[8]), usuario: J(r[9]), supervisor: J(r[10]) || '', exportadora: J(r[11]) || '', motivo: J(r[12]) || '', tipo: tipoNorm(J(r[13])), solicitante: J(r[14]) || '' }; }).sort(ordenFechaDesc);
const listarActivos = T => T.filas.filter(r => !vacio(r[0]) && r[2] === true).map(r => ({ id: J(r[0]), nombre: J(r[1]), activo: r[2] })).sort((a, b) => String(a.nombre).localeCompare(String(b.nombre)));

/* = invCalcularStock (hoy = medianoche de Lima) */
function calcularStock(receta, ingresos, armados, ms) {
  const totalCanastas = armados.reduce((s, a) => s + Number(a.cantidad || 0), 0);
  const hoyLima = Date.UTC(lima(ms).getUTCFullYear(), lima(ms).getUTCMonth(), lima(ms).getUTCDate());
  return receta.map(r => {
    const ingProducto = ingresos.filter(i => String(i.producto || '').toLowerCase() === String(r.producto).toLowerCase());
    const totalIngresado = ingProducto.reduce((s, i) => s + Number(i.cantidad || 0), 0);
    const stockActual = totalIngresado - totalCanastas * r.cantidad;
    const vencimientos = ingProducto.map(i => i.fechaVenc ? fechaMs(i.fechaVenc) : NaN).filter(d => !isNaN(d));
    let fechaVenc = null, diasRestantes = null;
    if (vencimientos.length) {
      const prox = Math.min.apply(null, vencimientos), pl = lima(prox);
      fechaVenc = ymdLima(prox);
      diasRestantes = Math.floor((Date.UTC(pl.getUTCFullYear(), pl.getUTCMonth(), pl.getUTCDate()) - hoyLima) / 864e5);
    }
    return { producto: r.producto, unidad: r.unidad, stock: Math.max(0, stockActual), fecha_venc: fechaVenc, dias_restantes: diasRestantes };
  });
}

async function leerTodo(pool) {
  const T = {};
  for (const k of CLAVES) { T[k] = await TH.leer(pool, k); if (!T[k]) return null; }
  return T;
}
/* = invGetAll */
function getAll(T, ms) {
  const receta = leerReceta(T[K.rec]), ingresos = leerIngresos(T[K.ing]), armados = leerArmados(T[K.arm]), entregas = leerEntregas(T[K.ent]);
  return { success: true, productos: listarActivos(T[K.prod]), receta, responsables: leerResponsables(T[K.resp]), meta: leerMeta(T[K.meta]),
    stock: calcularStock(receta, ingresos, armados, ms || Date.now()),
    canastasArmadas: armados.reduce((s, a) => s + Number(a.cantidad || 0), 0), canastasEntregadas: entregas.reduce((s, e) => s + Number(e.cantidad || 0), 0),
    historialArmados: armados, historialEntregas: entregas, historialIngresos: ingresos, fuente: 'azure' };
}

/* ── escritura en las tablas ── */
async function actualizarFila(tx, clave, i, celdas) {
  const E = TH.ESQ[clave], f = TH.aFila(clave, celdas), r = tx.request();
  r.input('fila', sql.Int, i + 1);
  const sets = E.cols.map((c, k) => { r.input('v' + k, c[1] === 'f' ? sql.DateTime2(3) : c[1] === 'n' ? sql.Float : sql.NVarChar(parseInt(c[1].slice(1), 10)), f.vals[k]); return c[0] + ' = @v' + k; });
  r.input('o', sql.NVarChar(sql.MAX), f.otros);
  await r.query(`UPDATE ${E.tabla} SET ${sets.join(', ')}, otros = @o, actualizado = SYSUTCDATETIME() WHERE fila = @fila`);
}
async function eliminarFila(tx, clave, i) {
  const E = TH.ESQ[clave];
  await tx.request().input('f', sql.Int, i + 1).query(`DELETE FROM ${E.tabla} WHERE fila = @f;
    WITH x AS (SELECT fila, rn = ROW_NUMBER() OVER (ORDER BY fila) FROM ${E.tabla}) UPDATE x SET fila = rn;`);
}
const H = v => CAP.comoHoja(v);
const idx = (T, id) => T.filas.findIndex(r => r[0] === id);   /* === body.id, como Google */
const ok = body => ({ status: 200, body });

/* Ejecuta UNA accion. Devuelve {status, body, op} donde op es lo que copiara Google */
async function aplicar(tx, T, accion, b, usuario, ms) {
  const ahora = new Date(ms), celda = f => f.map(H);
  let celdas, i, cuerpo, resp;
  switch (accion) {
    case 'invAgregarReceta': {
      const producto = String((b.item && b.item.producto) != null ? b.item.producto : (b.producto != null ? b.producto : '')).trim();
      const unidad = String((b.item && b.item.unidad) != null ? b.item.unidad : (b.unidad != null ? b.unidad : '')).trim();
      const cantidad = Number((b.item && b.item.cantidad) != null ? b.item.cantidad : (b.cantidad != null ? b.cantidad : 0));
      if (!producto) return ok({ success: false, error: 'Falta el producto' });
      if (!unidad) return ok({ success: false, error: 'Falta la unidad' });
      if (!cantidad || cantidad <= 0) return ok({ success: false, error: 'Cantidad inválida' });
      if (cantidad < 0.1 && cantidad !== 0.05) return ok({ success: false, error: 'Cantidad muy pequeña (' + cantidad + '). ¿Seguro que es correcto? Ejemplo: 1 kg por canasta, no 0.01 kg.' });
      const id = 'R' + ms, fila = [id, producto, unidad, cantidad, ahora, b.usuario || ''];
      await CAP.agregarFilas(tx, K.rec, [celda(fila)]);
      resp = { success: true, item: { id, producto, unidad, cantidad } }; cuerpo = { tipo: 'agregar', clave: K.rec, fila: fila.map((v, k) => k === 4 ? null : v), fechaMs: { 4: ms } };
      break;
    }
    case 'invEliminarReceta': {
      const buscarId = b.id ? String(b.id) : '', buscarProducto = b.producto ? String(b.producto).trim().toLowerCase() : '';
      if (!buscarId && !buscarProducto) return ok({ success: false, error: 'Falta id o producto' });
      for (let r = T[K.rec].filas.length - 1; r >= 0; r--) {
        const f = T[K.rec].filas[r], filaId = S(f[0]), filaProducto = S(f[1]).trim().toLowerCase();
        if ((buscarId && filaId === buscarId) || (buscarProducto && filaProducto === buscarProducto)) {
          await eliminarFila(tx, K.rec, r);
          resp = { success: true, eliminado: J(f[1]), por: (buscarId && filaId === buscarId) ? 'id' : 'producto' }; cuerpo = { tipo: 'eliminar', clave: K.rec, id: filaId, desdeAbajo: true };
          break;
        }
      }
      if (!resp) return ok({ success: false, error: 'No se encontró el producto en la receta' });
      break;
    }
    case 'invAgregarResponsable': {
      if (!b.nombre || !String(b.nombre).trim()) return ok({ success: false, error: 'Nombre vacío' });
      const id = 'R' + ms, nombre = String(b.nombre).trim(), fila = [id, nombre, ahora];
      await CAP.agregarFilas(tx, K.resp, [celda(fila)]);
      resp = { success: true, item: { id, nombre } }; cuerpo = { tipo: 'agregar', clave: K.resp, fila: [id, nombre, null], fechaMs: { 2: ms } };
      break;
    }
    case 'invEliminarResponsable': {
      const buscarId = b.id ? String(b.id) : '', buscarNombre = b.nombre ? String(b.nombre).trim().toLowerCase() : '';
      if (!buscarId && !buscarNombre) return ok({ success: false, error: 'Falta id o nombre' });
      for (let r = T[K.resp].filas.length - 1; r >= 0; r--) {
        const f = T[K.resp].filas[r], filaId = S(f[0]), filaNombre = S(f[1]).trim().toLowerCase();
        if ((buscarId && filaId === buscarId) || (buscarNombre && filaNombre === buscarNombre)) {
          await eliminarFila(tx, K.resp, r);
          resp = { success: true, eliminado: J(f[1]) }; cuerpo = { tipo: 'eliminar', clave: K.resp, id: filaId, desdeAbajo: true };
          break;
        }
      }
      if (!resp) return ok({ success: false, error: 'No encontrado' });
      break;
    }
    case 'invGuardarMeta': {
      const total = parseInt((b.meta && b.meta.total) != null ? b.meta.total : (b.meta_total != null ? b.meta_total : b.total), 10) || 0;
      const descripcion = String((b.meta && b.meta.descripcion) != null ? b.meta.descripcion : (b.descripcion != null ? b.descripcion : ''));
      if (total < 0) return ok({ success: false, error: 'La meta debe ser mayor o igual a 0' });
      const F = T[K.meta].filas; let iT = -1, iD = -1;
      F.forEach((r, k) => { if (r[0] === 'total') iT = k; if (r[0] === 'descripcion') iD = k; });
      const nuevas = [];
      if (iT < 0) nuevas.push(celda(['total', total, ahora])); else { celdas = pad(F[iT], 3); celdas[1] = H(total); celdas[2] = H(ahora); await actualizarFila(tx, K.meta, iT, celdas); }
      if (iD < 0) nuevas.push(celda(['descripcion', descripcion, ahora])); else { celdas = pad(F[iD], 3); celdas[1] = H(descripcion); celdas[2] = H(ahora); await actualizarFila(tx, K.meta, iD, celdas); }
      if (nuevas.length) await CAP.agregarFilas(tx, K.meta, nuevas);
      resp = { success: true, meta: { total, descripcion }, mensaje: 'Meta guardada correctamente' }; cuerpo = { tipo: 'meta', total, descripcion, ms };
      break;
    }
    case 'invRegistrarIngreso': {
      const g = b.ingreso;
      if (!g || !g.producto || !g.cantidad || !g.fechaIngreso || !g.fechaVenc) return ok({ success: false, error: 'Datos incompletos' });
      const id = 'I' + ms, fila = [id, ahora, g.producto, Number(g.cantidad), g.unidad || '', g.fechaIngreso, g.fechaVenc, g.lote || '', g.responsable, g.proveedor || '', g.observaciones || '', g.usuario || '', g.sector || '', g.supervisor || ''];
      await CAP.agregarFilas(tx, K.ing, [celda(fila)]);
      resp = { success: true, id }; cuerpo = { tipo: 'agregar', clave: K.ing, fila: fila.map((v, k) => k === 1 ? null : v), fechaMs: { 1: ms } };
      break;
    }
    case 'invEditarIngreso': {
      const g = b.ingreso || {}; i = idx(T[K.ing], b.id);
      if (i < 0) return ok({ success: false, error: 'Ingreso no encontrado' });
      celdas = pad(T[K.ing].filas[i], 14); const set = {};
      const m = { cantidad: [3, v => Number(v)], unidad: [4], fechaIngreso: [5], fechaVenc: [6], lote: [7], responsable: [8], proveedor: [9], observaciones: [10], sector: [12], supervisor: [13] };
      Object.keys(m).forEach(c => { if (g[c] !== undefined) { const v = m[c][1] ? m[c][1](g[c]) : g[c]; celdas[m[c][0]] = H(v); set[m[c][0] + 1] = v; } });
      await actualizarFila(tx, K.ing, i, celdas);
      resp = { success: true }; cuerpo = { tipo: 'editar', clave: K.ing, id: String(b.id), set };
      break;
    }
    case 'invEliminarIngreso': {
      for (let r = T[K.ing].filas.length - 1; r >= 0; r--) if (T[K.ing].filas[r][0] === b.id) { await eliminarFila(tx, K.ing, r); resp = { success: true }; break; }
      if (!resp) return ok({ success: false, error: 'Ingreso no encontrado' });
      cuerpo = { tipo: 'eliminar', clave: K.ing, id: String(b.id), desdeAbajo: true };
      break;
    }
    case 'invRegistrarArmado': {
      const a = b.armado;
      if (!a || !a.cantidad || !a.fecha || !a.responsable) return ok({ success: false, error: 'Datos incompletos' });
      const receta = leerReceta(T[K.rec]), stock = calcularStock(receta, leerIngresos(T[K.ing]), leerArmados(T[K.arm]), ms);
      for (const r of receta) {
        const s = stock.find(x => x.producto === r.producto), stockActual = s ? s.stock : 0, necesario = a.cantidad * r.cantidad;
        if (stockActual < necesario) return ok({ success: false, error: 'Stock insuficiente de ' + r.producto + ': tienes ' + stockActual + ' ' + r.unidad + ', necesitas ' + necesario });
      }
      const id = 'A' + ms, fila = [id, ahora, a.fecha, Number(a.cantidad), a.responsable, a.observaciones || '', a.usuario || '', a.sector || '', a.supervisor || '', tipoNorm(a.tipo)];
      await CAP.agregarFilas(tx, K.arm, [celda(fila)]);
      resp = { success: true, id }; cuerpo = { tipo: 'agregar', clave: K.arm, fila: fila.map((v, k) => k === 1 ? null : v), fechaMs: { 1: ms } };
      break;
    }
    case 'invEditarArmado': {
      const a = b.armado || {}; i = idx(T[K.arm], b.id);
      if (i < 0) return ok({ success: false, error: 'Armado no encontrado' });
      celdas = pad(T[K.arm].filas[i], 10); const set = {};
      if (a.cantidad !== undefined) {
        const cantOriginal = Number(J(celdas[3])) || 0, cantNueva = Number(a.cantidad), diff = cantNueva - cantOriginal;
        if (diff > 0) {
          const receta = leerReceta(T[K.rec]), ingresos = leerIngresos(T[K.ing]), armados = leerArmados(T[K.arm]);
          for (const rec of receta) {
            const totalIng = ingresos.filter(x => String(x.producto || '').toLowerCase() === String(rec.producto).toLowerCase()).reduce((s, x) => s + Number(x.cantidad || 0), 0);
            const totalArmadas = armados.reduce((s, x) => s + Number(x.cantidad || 0), 0);
            if (totalIng - totalArmadas * rec.cantidad < diff * rec.cantidad) return ok({ success: false, error: 'No hay stock suficiente de ' + rec.producto + ' para aumentar a ' + cantNueva });
          }
        }
        if (diff < 0) {
          const totalArmadasNuevo = leerArmados(T[K.arm]).reduce((s, x) => s + Number(x.cantidad || 0), 0) + diff;
          const totalEntregadas = leerEntregas(T[K.ent]).reduce((s, x) => s + Number(x.cantidad || 0), 0);
          if (totalArmadasNuevo < totalEntregadas) return ok({ success: false, error: 'No puedes reducir: ya hay ' + totalEntregadas + ' unidades entregadas' });
        }
        celdas[3] = H(cantNueva); set[4] = cantNueva;
      }
      const m = { fecha: 2, responsable: 4, observaciones: 5, sector: 7, supervisor: 8 };
      Object.keys(m).forEach(c => { if (a[c] !== undefined) { celdas[m[c]] = H(a[c]); set[m[c] + 1] = a[c]; } });
      if (a.tipo !== undefined) { celdas[9] = H(tipoNorm(a.tipo)); set[10] = tipoNorm(a.tipo); }
      await actualizarFila(tx, K.arm, i, celdas);
      resp = { success: true }; cuerpo = { tipo: 'editar', clave: K.arm, id: String(b.id), set };
      break;
    }
    case 'invEliminarArmado': {
      i = idx(T[K.arm], b.id);
      if (i < 0) return ok({ success: false, error: 'Armado no encontrado' });
      const cantElim = Number(J(T[K.arm].filas[i][3])) || 0;
      const totalArmadas = leerArmados(T[K.arm]).reduce((s, x) => s + Number(x.cantidad || 0), 0), totalEntregadas = leerEntregas(T[K.ent]).reduce((s, x) => s + Number(x.cantidad || 0), 0);
      if (totalArmadas - cantElim < totalEntregadas) return ok({ success: false, error: 'No puedes eliminar: ya hay ' + totalEntregadas + ' canastas entregadas y solo quedarían ' + (totalArmadas - cantElim) });
      await eliminarFila(tx, K.arm, i);
      resp = { success: true }; cuerpo = { tipo: 'eliminar', clave: K.arm, id: String(b.id) };
      break;
    }
    case 'invRegistrarEntrega': {
      const e = b.entrega;
      if (!e || !e.empresa || !e.sector || !e.cantidad || !e.fecha || !e.responsable) return ok({ success: false, error: 'Datos incompletos' });
      const tipo = tipoNorm(e.tipo);
      const armT = leerArmados(T[K.arm]).filter(a => a.tipo === tipo).reduce((s, a) => s + Number(a.cantidad || 0), 0);
      const entT = leerEntregas(T[K.ent]).filter(x => x.tipo === tipo).reduce((s, x) => s + Number(x.cantidad || 0), 0);
      const disponibles = armT - entT;
      if (e.cantidad > disponibles) return ok({ success: false, error: 'Solo hay ' + disponibles + ' ' + (tipo === 'BOLSA' ? 'bolsa(s) de víveres' : 'canasta(s)') + ' disponibles de ese tipo' });
      const id = 'E' + ms, fila = [id, ahora, e.fecha, e.empresa, e.sector, Number(e.cantidad), e.responsable, e.documento || '', e.observaciones || '', e.usuario || '', e.supervisor || '', e.exportadora || '', e.motivo || '', tipo, e.solicitante || ''];
      await CAP.agregarFilas(tx, K.ent, [celda(fila)]);
      resp = { success: true, id }; cuerpo = { tipo: 'agregar', clave: K.ent, fila: fila.map((v, k) => k === 1 ? null : v), fechaMs: { 1: ms } };
      break;
    }
    case 'invEditarEntrega': {
      const e = b.entrega || {}; i = idx(T[K.ent], b.id);
      if (i < 0) return ok({ success: false, error: 'Entrega no encontrada' });
      celdas = pad(T[K.ent].filas[i], 15); const set = {};
      if (e.cantidad !== undefined) {
        const cantOriginal = Number(J(celdas[5])) || 0, cantNueva = Number(e.cantidad), diff = cantNueva - cantOriginal;
        if (diff > 0) {
          const tipo = e.tipo !== undefined ? tipoNorm(e.tipo) : tipoNorm(J(celdas[13]));
          const armT = leerArmados(T[K.arm]).filter(a => a.tipo === tipo).reduce((s, x) => s + Number(x.cantidad || 0), 0);
          const entT = leerEntregas(T[K.ent]).filter(x => x.tipo === tipo).reduce((s, x) => s + Number(x.cantidad || 0), 0);
          if (armT - entT < diff) return ok({ success: false, error: 'Solo hay ' + (armT - entT) + ' disponibles de ese tipo para aumentar' });
        }
        celdas[5] = H(cantNueva); set[6] = cantNueva;
      }
      const m = { fecha: 2, empresa: 3, sector: 4, responsable: 6, documento: 7, observaciones: 8, supervisor: 10, exportadora: 11, motivo: 12, solicitante: 14 };
      Object.keys(m).forEach(c => { if (e[c] !== undefined) { celdas[m[c]] = H(e[c]); set[m[c] + 1] = e[c]; } });
      if (e.tipo !== undefined) { celdas[13] = H(tipoNorm(e.tipo)); set[14] = tipoNorm(e.tipo); }
      await actualizarFila(tx, K.ent, i, celdas);
      resp = { success: true }; cuerpo = { tipo: 'editar', clave: K.ent, id: String(b.id), set };
      break;
    }
    case 'invEliminarEntrega': {
      for (let r = T[K.ent].filas.length - 1; r >= 0; r--) if (T[K.ent].filas[r][0] === b.id) { await eliminarFila(tx, K.ent, r); resp = { success: true }; break; }
      if (!resp) return ok({ success: false, error: 'Entrega no encontrada' });
      cuerpo = { tipo: 'eliminar', clave: K.ent, id: String(b.id), desdeAbajo: true };
      break;
    }
    case 'invAgregarProducto': case 'invAgregarSector': {
      const esSec = accion === 'invAgregarSector', clave = esSec ? K.sec : K.prod;
      let nombre = String(b.nombre || '').trim(); if (esSec) nombre = nombre.toUpperCase();
      if (!nombre) return ok({ success: false, error: 'Nombre vacío' });
      const ya = T[clave].filas.some(r => (esSec ? S(r[1]).toUpperCase() === nombre : S(r[1]).toLowerCase() === nombre.toLowerCase()) && r[2] === true);
      if (ya) return ok({ success: false, error: esSec ? 'Ya existe un sector con ese nombre' : 'Ya existe un producto con ese nombre' });
      const id = (esSec ? 'S' : 'P') + ms, fila = [id, nombre, true, ahora, b.usuario || ''];
      await CAP.agregarFilas(tx, clave, [celda(fila)]);
      resp = { success: true, item: { id, nombre, activo: true } }; cuerpo = { tipo: 'agregar', clave, fila: [id, nombre, true, null, b.usuario || ''], fechaMs: { 3: ms } };
      break;
    }
    case 'invEditarProducto': case 'invEditarSector': {
      const esSec = accion === 'invEditarSector', clave = esSec ? K.sec : K.prod; i = idx(T[clave], b.id);
      if (i < 0) return ok({ success: false, error: esSec ? 'Sector no encontrado' : 'Producto no encontrado' });
      celdas = pad(T[clave].filas[i], 5); const set = {};
      if (b.nombre) { const n = esSec ? String(b.nombre).trim().toUpperCase() : String(b.nombre).trim(); celdas[1] = H(n); set[2] = n; }
      await actualizarFila(tx, clave, i, celdas);
      resp = { success: true }; cuerpo = { tipo: 'editar', clave, id: String(b.id), set };
      break;
    }
    case 'invEliminarProducto': case 'invEliminarSector': {
      const esSec = accion === 'invEliminarSector', clave = esSec ? K.sec : K.prod; i = idx(T[clave], b.id);
      if (i < 0) return ok({ success: false, error: esSec ? 'Sector no encontrado' : 'Producto no encontrado' });
      celdas = pad(T[clave].filas[i], 5); celdas[2] = false;
      await actualizarFila(tx, clave, i, celdas);
      resp = { success: true }; cuerpo = { tipo: 'editar', clave, id: String(b.id), set: { 3: false } };
      break;
    }
    default: return { status: 404, body: { success: false, error: 'Accion desconocida' } };
  }
  cuerpo.accion = accion; cuerpo.usuario = String(usuario || ''); cuerpo.ms = ms;
  return { status: 200, body: resp, op: cuerpo };
}

async function ejecutar(pool, accion, b, usuario, prueba, ahoraMs) {
  if (ACCIONES.indexOf(accion) < 0) return { status: 404, body: { success: false, error: 'Accion desconocida' } };
  b = b || {};
  await CG.asegurarTablas(pool); for (const k of CLAVES) await TH.asegurar(pool, k);
  const huella = String(b.client_id || '').replace(/[^\w-]/g, '').slice(0, 90);
  const claveOp = huella ? accion + ':' + huella : accion + ':sin-huella-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  if (huella && !prueba) {
    const p = await pool.request().input('k', sql.NVarChar(100), claveOp).query('SELECT respuesta FROM dbo.CV_Ops WHERE clave = @k');
    if (p.recordset.length && p.recordset[0].respuesta) return { status: 200, body: Object.assign(JSON.parse(p.recordset[0].respuesta), { duplicadoEvitado: true }) };
  }
  const ms = prueba && ahoraMs ? +ahoraMs : Date.now();
  const tx = new sql.Transaction(pool);
  await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    await tx.request().query("EXEC sp_getapplock @Resource = 'inv_guardar', @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 20000;");
    const T = await leerTodo(pool);
    if (!T) { await tx.rollback(); return { status: 503, body: { success: false, error: 'Tablas de inventario aun no cargadas' } }; }
    const r = await aplicar(tx, T, accion, b, usuario, ms);
    if (!r.op) { await tx.rollback(); return r; }   /* validacion rechazada: misma respuesta que Google, nada escrito */
    await CAP.tocarMarcas(tx, [TABLA[accion]]);
    r.body.fuente = 'azure';
    await tx.request().input('k', sql.NVarChar(100), claveOp).input('a', sql.NVarChar(30), accion).input('u', sql.NVarChar(100), usuario ? String(usuario) : null)
      .input('c', sql.NVarChar(sql.MAX), JSON.stringify(r.op)).input('r', sql.NVarChar(sql.MAX), JSON.stringify(r.body))
      .query("INSERT INTO dbo.CV_Ops (clave, tipo, accion, nro, usuario, cuerpo, respuesta) VALUES (@k, 'inv', @a, NULL, @u, @c, @r)");
    if (prueba) { await tx.rollback(); r.body.prueba = true; r.body._op = r.op; } else await tx.commit();
    return { status: 200, body: r.body };
  } catch (e) {
    try { await tx.rollback(); } catch (e2) {}
    if (huella && /UQ_CV_Ops_clave|duplicate key/i.test(e.message || '')) {
      const p = await pool.request().input('k', sql.NVarChar(100), claveOp).query('SELECT respuesta FROM dbo.CV_Ops WHERE clave = @k');
      if (p.recordset.length && p.recordset[0].respuesta) return { status: 200, body: Object.assign(JSON.parse(p.recordset[0].respuesta), { duplicadoEvitado: true }) };
    }
    throw e;
  }
}

module.exports = { ejecutar, encendido, leerTodo, getAll, ACCIONES, LECTURAS, CLAVES, K };
