# Azure Functions - Sistema RL

API REST que conecta Apps Script con Azure SQL Database para Atenciones.

## Estructura

- atenciones-create: POST /api/atenciones - Crear nueva atencion
- atenciones-list: GET /api/atenciones - Listar atenciones con filtros

## Variables de entorno (configuradas en Azure Portal)

- SQL_SERVER: rapel-sql-server.database.windows.net
- SQL_DATABASE: sistema-rl-db
- SQL_USER: sqladmin
- SQL_PASSWORD: (secret)

## Instalar dependencias

cd azure/functions
npm install

## Desplegar a Azure

cd azure/functions
func azure functionapp publish rl-functions-verfrut

## URL base

https://rl-functions-verfrut-c0ctfjc0cjf5f0hz.brazilsouth-01.azurewebsites.net

## Endpoints

### POST /api/atenciones

Crear nueva atencion. Body JSON con campos: dni, nombre, fecha_atencion, supervisor, empresa, etc.

### GET /api/atenciones?supervisor=X&desde=Y&hasta=Z&limite=50&pagina=1

Listar con filtros opcionales.
