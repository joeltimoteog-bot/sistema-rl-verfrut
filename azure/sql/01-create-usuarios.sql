-- ════════════════════════════════════════════════════
-- Tabla usuarios - migracion desde Sheets a Azure SQL
-- Sistema RL v3.0 - Verfrut/Rapel
-- ════════════════════════════════════════════════════

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'usuarios')
BEGIN
    CREATE TABLE [dbo].[usuarios] (
        [id_sistema]     NVARCHAR(50)  NOT NULL PRIMARY KEY,
        [usuario]        NVARCHAR(50)  NOT NULL UNIQUE,
        [password]       NVARCHAR(255) NOT NULL,
        [nombre]         NVARCHAR(200) NOT NULL,
        [rol]            NVARCHAR(50)  NULL,
        [empresa]        NVARCHAR(50)  NULL,
        [activo]         BIT           NOT NULL DEFAULT 1,
        [fecha_creacion] DATETIME2     NULL,
        [correo]         NVARCHAR(200) NULL,
        [cargo]          NVARCHAR(200) NULL,
        [sector]         NVARCHAR(100) NULL,
        [fecha_sync]     DATETIME2     NOT NULL DEFAULT GETDATE()
    );

    CREATE INDEX IX_usuarios_login ON [dbo].[usuarios]([usuario], [activo]);

    PRINT '✅ Tabla usuarios creada con index IX_usuarios_login';
END
ELSE
BEGIN
    PRINT 'ℹ️ La tabla usuarios ya existe, no se hizo nada';
END
GO

-- Verificacion
SELECT 
    name AS tabla,
    create_date,
    modify_date
FROM sys.tables
WHERE name = 'usuarios';

SELECT 
    COLUMN_NAME, 
    DATA_TYPE, 
    CHARACTER_MAXIMUM_LENGTH,
    IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'usuarios'
ORDER BY ORDINAL_POSITION;
GO
