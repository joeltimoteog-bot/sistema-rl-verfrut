/* ═══════════════════════════════════════════════════════════════════════════
   acceso-importar (_ACCESO_AZURE_V1) — pasa a Azure los permisos y horarios
   que hoy estan en las hojas. Solo con la llave de la funcion (Apps Script).
   POST { permisos:[[usuario,modulo,permitido,actualizado,por],...],
          horarios:[{usuario,hora_inicio,hora_fin,dias,desde,hasta,activo,nota,actualizado,por},...],
          soloUsuario?: 'xxx' }        -> reemplaza todo (o solo ese usuario)
   GET  -> cuantos permisos y horarios hay en Azure
   ═══════════════════════════════════════════════════════════════════════════ */
const A = require('../shared/acceso-db');

module.exports = async function (context, req) {
  try {
    const p = await A.pool();
    if (req.method === 'GET') {
      const r = await p.request().query(`SELECT (SELECT COUNT(*) FROM dbo.PermisosModulos) AS permisos,
        (SELECT COUNT(DISTINCT usuario) FROM dbo.PermisosModulos) AS usuarios_con_permisos,
        (SELECT COUNT(*) FROM dbo.AccesoHorarios) AS horarios`);
      context.res = { status: 200, body: Object.assign({ success: true }, r.recordset[0]) };
      return;
    }
    const b = req.body || {};
    const solo = b.soloUsuario ? A.usr(b.soloUsuario) : null;
    const perms = (b.permisos || []).map(f => [A.usr(f[0]), String(f[1] || '').trim().slice(0, 80),
      (f[2] === true || ['SI', 'TRUE', '1'].indexOf(String(f[2]).toUpperCase()) >= 0) ? 1 : 0, f[3] || null, A.usr(f[4])])
      .filter(f => f[0] && f[1] && (!solo || f[0] === solo));
    const hors = (b.horarios || []).map(A.filaHorario).filter(f => f.usuario && (!solo || f.usuario === solo));

    const tx = new A.sql.Transaction(p);
    await tx.begin();
    try {
      const q = (s, ins) => { const r = tx.request(); (ins || []).forEach(x => r.input(x[0], x[1], x[2])); return r.query(s); };
      if (solo) {
        await q('DELETE FROM dbo.PermisosModulos WHERE usuario = @u', [['u', A.sql.NVarChar(60), solo]]);
        await q('DELETE FROM dbo.AccesoHorarios WHERE usuario = @u', [['u', A.sql.NVarChar(60), solo]]);
      } else {
        await q('DELETE FROM dbo.PermisosModulos'); await q('DELETE FROM dbo.AccesoHorarios');
      }
      const vistos = {};
      for (const f of perms) {
        const k = f[0] + '|' + f[1]; if (vistos[k]) continue; vistos[k] = 1;   // si la hoja repite, gana la primera
        const fecha = f[3] && !isNaN(new Date(f[3])) ? new Date(f[3]) : null;
        await q('INSERT INTO dbo.PermisosModulos (usuario, modulo, permitido, actualizado, por) VALUES (@u,@m,@p,@a,@por)',
          [['u', A.sql.NVarChar(60), f[0]], ['m', A.sql.NVarChar(80), f[1]], ['p', A.sql.Bit, f[2]], ['a', A.sql.DateTime2, fecha], ['por', A.sql.NVarChar(60), f[4]]]);
      }
      const vh = {};
      for (const f of hors) {
        if (vh[f.usuario]) continue; vh[f.usuario] = 1;
        await q(`INSERT INTO dbo.AccesoHorarios (usuario, hora_inicio, hora_fin, dias, desde, hasta, activo, nota, actualizado, por)
                 VALUES (@u,@i,@f,@d,@de,@ha,@a,@n,@s,@por)`,
          [['u', A.sql.NVarChar(60), f.usuario], ['i', A.sql.NVarChar(5), A.txt(f.ini)], ['f', A.sql.NVarChar(5), A.txt(f.fin)],
           ['d', A.sql.NVarChar(20), f.dias.join(',')], ['de', A.sql.NVarChar(10), f.desde || null], ['ha', A.sql.NVarChar(10), f.hasta || null],
           ['a', A.sql.Bit, f.activo ? 1 : 0], ['n', A.sql.NVarChar(300), f.nota.slice(0, 300)], ['s', A.sql.NVarChar(20), f.actualizado.slice(0, 20)],
           ['por', A.sql.NVarChar(60), A.usr(f.por)]]);
      }
      await tx.commit();
    } catch (e) { try { await tx.rollback(); } catch (e2) {} throw e; }
    context.res = { status: 200, body: { success: true, permisos: perms.length, horarios: hors.length, soloUsuario: solo } };
  } catch (e) {
    context.res = { status: 500, body: { success: false, error: [e.message, e.originalError && e.originalError.message].filter(Boolean).join(' | ') } };
  }
};
