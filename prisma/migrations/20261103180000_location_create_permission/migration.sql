-- Garante a permissão LOCATION_CREATE na matriz de permissões.
-- Idempotente: não duplica nem sobrescreve caso a chave já exista.
INSERT INTO "Permission" ("id", "key", "name", "description")
SELECT gen_random_uuid()::text, 'LOCATION_CREATE', 'Criar Localizações', 'Permite cadastrar novas localizações físicas nos almoxarifados.'
WHERE NOT EXISTS (SELECT 1 FROM "Permission" WHERE "key" = 'LOCATION_CREATE');
