-- Nova permissão LOCATION_UPDATE para edição de localizações (idempotente).
INSERT INTO "Permission" ("id", "key", "name", "description")
SELECT gen_random_uuid()::text, 'LOCATION_UPDATE', 'Editar Localizações', 'Permite editar dados, status e hierarquia das localizações físicas.'
WHERE NOT EXISTS (SELECT 1 FROM "Permission" WHERE "key" = 'LOCATION_UPDATE');

-- Concede aos perfis que já podiam editar (CONFIG_MANAGE) ou criar (LOCATION_CREATE).
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT rp."roleId", p."id"
FROM "RolePermission" rp
JOIN "Permission" src ON src."id" = rp."permissionId" AND src."key" IN ('LOCATION_CREATE', 'CONFIG_MANAGE')
CROSS JOIN "Permission" p
WHERE p."key" = 'LOCATION_UPDATE'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
