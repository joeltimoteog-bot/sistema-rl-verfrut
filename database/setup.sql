-- ============================================================
-- SISTEMA DE GESTIÓN DE RELACIONES LABORALES
-- VERFRUT & RAPEL — PostgreSQL / Railway
-- ============================================================

CREATE TABLE IF NOT EXISTS usuarios (
    id              SERIAL PRIMARY KEY,
    usuario         VARCHAR(50)  NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    nombre_completo VARCHAR(100) NOT NULL,
    cargo           VARCHAR(100) NOT NULL DEFAULT '',
    rol             VARCHAR(20)  NOT NULL CHECK (rol IN ('administrador','jefa_rl','coordinador','asistente','supervisor')),
    empresa_acceso  VARCHAR(20)  NOT NULL DEFAULT 'AMBAS' CHECK (empresa_acceso IN ('RAPEL','VERFRUT','AMBAS')),
    activo          BOOLEAN      NOT NULL DEFAULT TRUE,
    intentos_fallidos INT        NOT NULL DEFAULT 0,
    ultimo_acceso   TIMESTAMP    NULL,
    fecha_creacion  TIMESTAMP    NOT NULL DEFAULT NOW(),
    creado_por      VARCHAR(50)  NULL
);

CREATE TABLE IF NOT EXISTS supervisores (
    id              SERIAL PRIMARY KEY,
    nombre_completo VARCHAR(100) NOT NULL,
    dni             VARCHAR(8)   NULL,
    sector          VARCHAR(100) NOT NULL,
    empresa         VARCHAR(20)  NOT NULL DEFAULT 'AMBAS',
    cargo           VARCHAR(100) NOT NULL DEFAULT 'Supervisor de Gestión Humana',
    correo          VARCHAR(100) NULL,
    celular         VARCHAR(15)  NULL,
    activo          BOOLEAN      NOT NULL DEFAULT TRUE,
    fecha_creacion  TIMESTAMP    NOT NULL DEFAULT NOW(),
    creado_por      VARCHAR(50)  NULL
);

CREATE TABLE IF NOT EXISTS tipos_documento (
    id                    SERIAL PRIMARY KEY,
    codigo                VARCHAR(10)  NOT NULL,
    descripcion           VARCHAR(200) NOT NULL,
    responsable           VARCHAR(100) NOT NULL,
    empresa               VARCHAR(20)  NOT NULL DEFAULT 'AMBAS',
    requiere_fecha_inicio BOOLEAN      NOT NULL DEFAULT TRUE,
    requiere_fecha_fin    BOOLEAN      NOT NULL DEFAULT TRUE,
    activo                BOOLEAN      NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS trabajadores (
    id                    SERIAL PRIMARY KEY,
    dni                   VARCHAR(8)   NOT NULL UNIQUE,
    nombre_completo       VARCHAR(150) NOT NULL,
    sexo                  VARCHAR(10)  NULL,
    fecha_inicio_periodo  DATE         NULL,
    fecha_termino_periodo DATE         NULL,
    empresa               VARCHAR(20)  NOT NULL DEFAULT 'RAPEL',
    fundo                 VARCHAR(100) NULL,
    cargo                 VARCHAR(100) NULL,
    ruta                  VARCHAR(50)  NULL,
    codigo                VARCHAR(50)  NULL,
    celular               VARCHAR(15)  NULL,
    cuspp                 VARCHAR(20)  NULL,
    afp                   VARCHAR(50)  NULL,
    fecha_nacimiento      DATE         NULL,
    activo                BOOLEAN      NOT NULL DEFAULT TRUE,
    fecha_actualizacion   TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS atenciones (
    id                     SERIAL PRIMARY KEY,
    fecha_atencion         DATE         NOT NULL DEFAULT CURRENT_DATE,
    hora_inicio            TIME         NOT NULL DEFAULT CURRENT_TIME,
    hora_termino           TIME         NULL,
    numero_semana          INT          NULL,
    mes                    VARCHAR(20)  NULL,
    anio                   INT          NULL,
    dni                    VARCHAR(8)   NOT NULL,
    nombre_completo        VARCHAR(150) NULL,
    sexo                   VARCHAR(10)  NULL,
    fecha_inicio_contrato  DATE         NULL,
    fecha_termino_contrato DATE         NULL,
    antiguedad_anios       INT          NULL,
    antiguedad_meses       INT          NULL,
    antiguedad_dias        INT          NULL,
    empresa                VARCHAR(20)  NULL,
    fundo                  VARCHAR(100) NULL,
    fundo_actual           VARCHAR(100) NULL,
    cargo                  VARCHAR(100) NULL,
    ruta                   VARCHAR(50)  NULL,
    codigo                 VARCHAR(50)  NULL,
    celular                VARCHAR(15)  NULL,
    supervisor             VARCHAR(100) NULL,
    tipo_documento         VARCHAR(200) NULL,
    fecha_inicio_doc       DATE         NULL,
    fecha_termino_doc      DATE         NULL,
    dias_transcurridos     INT          NULL,
    responsable_recepcion  VARCHAR(100) NULL,
    observaciones          TEXT         NULL,
    estado                 VARCHAR(20)  NOT NULL DEFAULT 'PENDIENTE',
    es_reiterativo         BOOLEAN      NOT NULL DEFAULT FALSE,
    numero_reiteracion     INT          NOT NULL DEFAULT 1,
    alerta_teniente        BOOLEAN      NOT NULL DEFAULT FALSE,
    fecha_registro         TIMESTAMP    NOT NULL DEFAULT NOW(),
    registrado_por         VARCHAR(50)  NULL
);

CREATE TABLE IF NOT EXISTS alertas_reiterativas (
    id              SERIAL PRIMARY KEY,
    dni             VARCHAR(8)   NOT NULL,
    tipo_documento  VARCHAR(200) NOT NULL,
    anio            INT          NOT NULL,
    total_registros INT          NOT NULL DEFAULT 0,
    ultima_alerta   TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS casos_legales (
    id                SERIAL PRIMARY KEY,
    dni               VARCHAR(8)   NOT NULL,
    nombre_completo   VARCHAR(150) NULL,
    cargo             VARCHAR(100) NULL,
    fecha_ingreso     DATE         NULL,
    fecha_termino     DATE         NULL,
    empresa           VARCHAR(20)  NULL,
    sector            VARCHAR(100) NULL,
    codigo            VARCHAR(50)  NULL,
    supervisor        VARCHAR(100) NULL,
    motivo            VARCHAR(100) NULL,
    motivo_detalle    TEXT         NULL,
    articulo_rit      VARCHAR(200) NULL,
    fecha_reporte     DATE         NULL,
    fecha_limite      DATE         NULL,
    estado_plazo      VARCHAR(30)  NULL,
    porcentaje_avance VARCHAR(10)  NULL,
    dias_retraso      INT          NULL DEFAULT 0,
    redaccion         TEXT         NULL,
    ruta_informe      VARCHAR(500) NULL,
    ruta_reporte      VARCHAR(500) NULL,
    ruta_carpeta      VARCHAR(500) NULL,
    temporada         VARCHAR(20)  NULL,
    fecha_registro    TIMESTAMP    NOT NULL DEFAULT NOW(),
    registrado_por    VARCHAR(50)  NULL
);

CREATE TABLE IF NOT EXISTS visitas_campo (
    id                 SERIAL PRIMARY KEY,
    empresa            VARCHAR(20)  NOT NULL,
    supervisor         VARCHAR(100) NOT NULL,
    dni_supervisor     VARCHAR(8)   NULL,
    correo_supervisor  VARCHAR(100) NULL,
    fundo              VARCHAR(100) NOT NULL,
    punto_zona         VARCHAR(100) NULL,
    lugar              VARCHAR(200) NULL,
    fecha_inicio       DATE         NOT NULL,
    fecha_fin          DATE         NOT NULL,
    numero_semana      INT          NULL,
    hora_visita        TIME         NULL,
    hallazgos          TEXT         NULL,
    acciones           TEXT         NULL,
    correcciones       TEXT         NULL,
    compromisos        TEXT         NULL,
    observaciones      TEXT         NULL,
    dias_permitidos    INT          NOT NULL DEFAULT 7,
    dias_transcurridos INT          NULL,
    dias_retraso       INT          NULL DEFAULT 0,
    porcentaje_avance  VARCHAR(10)  NULL,
    estado_plazo       VARCHAR(20)  NULL,
    motivo_retraso     TEXT         NULL,
    temporada          VARCHAR(20)  NULL,
    total_fotos        INT          NOT NULL DEFAULT 0,
    fecha_registro     TIMESTAMP    NOT NULL DEFAULT NOW(),
    registrado_por     VARCHAR(50)  NULL
);

CREATE TABLE IF NOT EXISTS evidencias_visita (
    id             SERIAL PRIMARY KEY,
    id_visita      INT          NOT NULL REFERENCES visitas_campo(id),
    nombre_archivo VARCHAR(255) NOT NULL,
    ruta_archivo   VARCHAR(500) NOT NULL,
    fecha_subida   TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS log_correos (
    id              SERIAL PRIMARY KEY,
    tipo            VARCHAR(50)  NOT NULL,
    destinatarios   VARCHAR(500) NULL,
    responsable     VARCHAR(100) NULL,
    fecha_desde     DATE         NULL,
    fecha_hasta     DATE         NULL,
    total_registros INT          NULL,
    estado          VARCHAR(20)  NOT NULL DEFAULT 'ENVIADO',
    fecha_envio     TIMESTAMP    NOT NULL DEFAULT NOW(),
    enviado_por     VARCHAR(50)  NULL
);

-- ÍNDICES
CREATE INDEX IF NOT EXISTS ix_atenciones_dni        ON atenciones(dni);
CREATE INDEX IF NOT EXISTS ix_atenciones_fecha      ON atenciones(fecha_atencion);
CREATE INDEX IF NOT EXISTS ix_atenciones_empresa    ON atenciones(empresa);
CREATE INDEX IF NOT EXISTS ix_atenciones_supervisor ON atenciones(supervisor);
CREATE INDEX IF NOT EXISTS ix_trabajadores_dni      ON trabajadores(dni);
CREATE INDEX IF NOT EXISTS ix_casos_dni             ON casos_legales(dni);

-- USUARIOS (contraseñas se actualizan con generar-passwords.js)
INSERT INTO usuarios (usuario, password_hash, nombre_completo, cargo, rol, empresa_acceso) VALUES
('jtimoteo',  '$2b$10$placeholder', 'Joel Timoteo Gonza',               'Administrador del Sistema',           'administrador', 'AMBAS'),
('ovilela',   '$2b$10$placeholder', 'Olga Vilela',                      'Jefa de Relaciones Laborales',        'jefa_rl',       'AMBAS'),
('jchavez',   '$2b$10$placeholder', 'Jorge Chávez',                     'Coordinador de Relaciones Laborales', 'coordinador',   'AMBAS'),
('mmechato',  '$2b$10$placeholder', 'Muriel Mechato Navarro',           'Asistente de Relaciones Laborales',   'asistente',     'AMBAS'),
('mypanaque', '$2b$10$placeholder', 'Marco Panaqué',                    'Asistente de Relaciones Laborales',   'asistente',     'AMBAS'),
('smiranda',  '$2b$10$placeholder', 'Socorro Miranda Pasapera',         'Asistente de Relaciones Laborales',   'asistente',     'AMBAS'),
('ecastro',   '$2b$10$placeholder', 'Castro Bayona Elberth Jan Pierre', 'Supervisor de Gestión Humana',        'supervisor',    'AMBAS'),
('ptamayo',   '$2b$10$placeholder', 'Tamayo Rodríguez Pool Wilfredo',   'Supervisor de Gestión Humana',        'supervisor',    'AMBAS'),
('atineo',    '$2b$10$placeholder', 'Alex Tineo Ramos',                 'Supervisor de Gestión Humana',        'supervisor',    'AMBAS'),
('fpulache',  '$2b$10$placeholder', 'Flor Pulache Viera',               'Supervisora de Gestión Humana',       'supervisor',    'AMBAS'),
('azapata',   '$2b$10$placeholder', 'Alex Fabián Zapata Suárez',        'Supervisor de Gestión Humana',        'supervisor',    'AMBAS'),
('yluzon',    '$2b$10$placeholder', 'Luzón Venegas Yhanelly Geraldine', 'Supervisora de Gestión Humana',       'supervisor',    'AMBAS'),
('amartinez', '$2b$10$placeholder', 'Martínez Juárez Alexander',        'Supervisor de Gestión Humana',        'supervisor',    'AMBAS'),
('sviera',    '$2b$10$placeholder', 'Sergio Viera Girón',               'Supervisor de Gestión Humana',        'supervisor',    'AMBAS'),
('rmolero',   '$2b$10$placeholder', 'Roberto Molero',                   'Supervisor de Gestión Humana',        'supervisor',    'AMBAS')
ON CONFLICT (usuario) DO NOTHING;

-- SUPERVISORES
INSERT INTO supervisores (nombre_completo, sector, empresa, cargo) VALUES
('Castro Bayona Elberth Jan Pierre',     'SAN VICENTE',       'AMBAS', 'Supervisor de Gestión Humana'),
('Tamayo Rodríguez Pool Wilfredo',       'EL PAPAYO',         'AMBAS', 'Supervisor de Gestión Humana'),
('Tamayo Rodríguez Pool Wilfredo',       'LIMONES',           'AMBAS', 'Supervisor de Gestión Humana'),
('Alex Tineo Ramos',                     'LOS OLIVARES BAJO', 'AMBAS', 'Supervisor de Gestión Humana'),
('Flor Pulache Viera',                   'LOS OLIVARES ALTO', 'AMBAS', 'Supervisora de Gestión Humana'),
('Alex Fabián Zapata Suárez',            'APROA',             'AMBAS', 'Supervisor de Gestión Humana'),
('Luzón Venegas Yhanelly Geraldine',     'SANTA ROSA',        'AMBAS', 'Supervisora de Gestión Humana'),
('Martínez Juárez Alexander',            'PUNTA ARENAS',      'AMBAS', 'Supervisor de Gestión Humana'),
('Sergio Viera Girón',                   'LOS ALGARROBOS',    'AMBAS', 'Supervisor de Gestión Humana'),
('Roberto Molero',                       'PLANTA RAPEL',      'RAPEL', 'Supervisor de Gestión Humana'),
('Muriel Mechato Navarro',               'VARIOS',            'AMBAS', 'Asistente de Relaciones Laborales'),
('Socorro Miranda Pasapera',             'CAMPO A',           'AMBAS', 'Asistente de Relaciones Laborales');

-- TIPOS DE DOCUMENTO
INSERT INTO tipos_documento (codigo, descripcion, responsable, empresa) VALUES
('01','CITT - EMPRESA VERFRUT','ALBERT PACHERRE','VERFRUT'),
('02','CITT - EMPRESA RAPEL','ALBERT PACHERRE','RAPEL'),
('03','REGULARIZAR CITT - GENERAR FORMULARIO','ALBERT PACHERRE','AMBAS'),
('04','CMP - EMPRESA VERFRUT / RAPEL','ALBERT PACHERRE','AMBAS'),
('05','REGULARIZAR CMP - GENERAR FORMULARIO','ALBERT PACHERRE','AMBAS'),
('06','CERTIFICADO ODONTOLOGICO','ALBERT PACHERRE','AMBAS'),
('07','REGULARIZAR CERTIFICADO ODONTOLOGICO - GENERAR FORMULARIO','ALBERT PACHERRE','AMBAS'),
('08','INGRESO AL PROGRAMA DE GESTANTES VERFRUT / RAPEL','ALBERT PACHERRE','AMBAS'),
('09','INGRESO A HORAS DE LACTANCIA VERFRUT / RAPEL','ALBERT PACHERRE','AMBAS'),
('10','COPIAS PARA ASIGNACION FAMILIAR','JAIME SIANCAS','AMBAS'),
('11','CONSTANCIA DE ESTUDIOS - JUSTIFICACION','ALBERT PACHERRE','AMBAS'),
('12','CONTROL GESTANTE - JUSTIFICACION','ALBERT PACHERRE','AMBAS'),
('13','DECLARACION SEGUROS DE VIDA LEY','JAIRO FERNÁNDEZ','AMBAS'),
('14','FORMULARIO DE INTERCONSULTA','DANIELA REYNA','AMBAS'),
('15','17 HORAS DE LACTANCIA VERFRUT / RAPEL','DANIELA REYNA','AMBAS'),
('16','CONSTANCIA DE HOSPITALIZACION - GENERAR FORMULARIO/JUSTIFICAR','ALBERT PACHERRE','AMBAS'),
('17','COMPRA DE MEDECINA (JUSTIFICACION)','ALBERT PACHERRE','AMBAS'),
('18','LICENCIA POR PATERNIDAD VERFRUT / RAPEL','DANIELA REYNA','AMBAS'),
('19','LICENCIA POR FALLECIMIENTO VERFRUT / RAPEL','DANIELA REYNA','AMBAS'),
('20','LICENCIA POR ENFERMEDAD GRAVE VERFRUT / RAPEL','DANIELA REYNA','AMBAS'),
('21','RECETA MEDICA (JUSTIFICACION)','ALBERT PACHERRE','AMBAS'),
('22','REGULARIZAR LICENCIA POR MATERNIDAD - GENERAR FORMULARIO','ALBERT PACHERRE','AMBAS'),
('23','REGULARIZAR LICENCIA POR PATERNIDAD - GENERAR FORMULARIO','ALBERT PACHERRE','AMBAS'),
('24','REGULARIZAR LICENCIA POR DEFUNCION - GENERAR FORMULARIO','ALBERT PACHERRE','AMBAS'),
('25','REGULARIZAR LICENCIA POR ENFERMEDAD GRAVE - GENERAR FORMULARIO','ALBERT PACHERRE','AMBAS'),
('26','JUSTIFICACION DEL JUEZ DE PAZ','ALBERT PACHERRE','AMBAS'),
('27','OTROS TRAMITES','ALBERT PACHERRE','AMBAS'),
('28','CMP - VALIDADO POR SIS','ALBERT PACHERRE','AMBAS'),
('29','FORMULARIO INTERCONSULTA','ALBERT PACHERRE','AMBAS'),
('30','FORMULARIO DE TRAMITE GESTANTE','ALBERT PACHERRE','AMBAS'),
('31','NUMERO DE CUENTA','ROSS MERY','AMBAS'),
('32','ELECCION DE SISTEMA PENSIONARIO','ELIZBETH DIOSES','AMBAS'),
('33','LICENCIA POR MATERNIDAD','ALBERT PACHERRE','AMBAS');
