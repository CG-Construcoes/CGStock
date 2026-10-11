-- CreateTable
CREATE TABLE "UserWarehouseAccess" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "grantedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserWarehouseAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserWarehouseAccess_userId_warehouseId_key" ON "UserWarehouseAccess"("userId", "warehouseId");

-- CreateIndex
CREATE INDEX "UserWarehouseAccess_userId_idx" ON "UserWarehouseAccess"("userId");

-- CreateIndex
CREATE INDEX "UserWarehouseAccess_warehouseId_idx" ON "UserWarehouseAccess"("warehouseId");

-- AddForeignKey
ALTER TABLE "UserWarehouseAccess" ADD CONSTRAINT "UserWarehouseAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserWarehouseAccess" ADD CONSTRAINT "UserWarehouseAccess_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserWarehouseAccess" ADD CONSTRAINT "UserWarehouseAccess_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Migração de dados: garante os acessos atuais por obra.
-- Para cada UserWorksiteAccess, concede acesso a todos os almoxarifados
-- daquela obra, de modo que nenhum usuário perca acesso que já possui.
INSERT INTO "UserWarehouseAccess" ("id", "userId", "warehouseId", "grantedById", "createdAt")
SELECT gen_random_uuid()::text, a."userId", w."id", NULL, CURRENT_TIMESTAMP
FROM "UserWorksiteAccess" a
JOIN "Warehouse" w ON w."worksiteId" = a."worksiteId"
ON CONFLICT ("userId", "warehouseId") DO NOTHING;
