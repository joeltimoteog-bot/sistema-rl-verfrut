// Ejecutar: node scripts/generar-passwords.js
// Copia el SQL generado y ejecútalo en Railway → PostgreSQL

const bcrypt = require('bcryptjs');

const usuarios = [
    { usuario: 'jtimoteo',  password: 'kevin2025' },
    { usuario: 'ovilela',   password: 'ovilela2025' },
    { usuario: 'jchavez',   password: 'jchavez2025' },
    { usuario: 'mmechato',  password: 'mmechato2025' },
    { usuario: 'mypanaque', password: 'mypanaque2025' },
    { usuario: 'smiranda',  password: 'smiranda2025' },
    { usuario: 'ecastro',   password: 'ecastro2025' },
    { usuario: 'ptamayo',   password: 'ptamayo2025' },
    { usuario: 'atineo',    password: 'atineo2025' },
    { usuario: 'fpulache',  password: 'fpulache2025' },
    { usuario: 'azapata',   password: 'fzapata2025' },
    { usuario: 'yluzon',    password: 'yluzon2025' },
    { usuario: 'amartinez', password: 'almartinez2025' },
    { usuario: 'sviera',    password: 'sviera2025' },
    { usuario: 'rmolero',   password: 'rmolero2025' },
];

async function generar() {
    console.log('-- Copiar y ejecutar en Railway PostgreSQL:');
    console.log('');
    for (const u of usuarios) {
        const hash = await bcrypt.hash(u.password, 10);
        console.log(`UPDATE usuarios SET password_hash = '${hash}' WHERE usuario = '${u.usuario}';`);
    }
    console.log('');
    console.log('-- ✅ Contraseñas encriptadas correctamente');
}
generar();
