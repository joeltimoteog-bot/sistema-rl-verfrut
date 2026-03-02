// middleware/auth.js
// Verificación de tokens JWT - Sistema RL

const jwt = require('jsonwebtoken');

function verificarToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ 
            ok: false, 
            mensaje: 'Acceso denegado. Inicia sesión primero.' 
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.usuario = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ 
            ok: false, 
            mensaje: 'Sesión expirada. Vuelve a iniciar sesión.' 
        });
    }
}

function soloAdmin(req, res, next) {
    if (req.usuario?.rol !== 'administrador') {
        return res.status(403).json({ 
            ok: false, 
            mensaje: 'Acción reservada para el Administrador.' 
        });
    }
    next();
}

function adminOJefa(req, res, next) {
    const rolesPermitidos = ['administrador', 'jefa_rl', 'coordinador'];
    if (!rolesPermitidos.includes(req.usuario?.rol)) {
        return res.status(403).json({ 
            ok: false, 
            mensaje: 'No tienes permisos para esta acción.' 
        });
    }
    next();
}

module.exports = { verificarToken, soloAdmin, adminOJefa };
