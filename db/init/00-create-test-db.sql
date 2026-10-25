-- Crea la base de tests si no existe.
-- migrate-test la recrea en cada ejecución para partir de un esquema limpio.
SELECT 'CREATE DATABASE wall_test'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'wall_test')\gexec
