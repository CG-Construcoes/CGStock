-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "informakonKey" TEXT,
ALTER COLUMN "minimumStock" SET DEFAULT 0,
ALTER COLUMN "minimumStock" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "maximumStock" SET DEFAULT 0,
ALTER COLUMN "maximumStock" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "ProductCategory" ADD COLUMN     "informakonKey" TEXT;

-- AlterTable
ALTER TABLE "ProductUnit" ADD COLUMN     "informakonKey" TEXT;

-- AlterTable
ALTER TABLE "Stock" ALTER COLUMN "quantity" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "reservedQuantity" SET DEFAULT 0,
ALTER COLUMN "reservedQuantity" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "StockMovement" ALTER COLUMN "quantity" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "informakonKey" TEXT;

-- AlterTable
ALTER TABLE "Warehouse" ADD COLUMN     "informakonKey" TEXT;

-- AlterTable
ALTER TABLE "Worksite" ADD COLUMN     "informakonKey" TEXT;

-- CreateTable
CREATE TABLE "SyncCheckpoint" (
    "id" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "watermark" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastStatus" TEXT NOT NULL DEFAULT 'NEVER',
    "lastError" TEXT,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncCheckpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncRun" (
    "id" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "upserted" INTEGER NOT NULL DEFAULT 0,
    "deleted" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,

    CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InfMirror" (
    "id" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "InfMirror_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SyncCheckpoint_entity_key" ON "SyncCheckpoint"("entity");

-- CreateIndex
CREATE INDEX "SyncRun_entity_startedAt_idx" ON "SyncRun"("entity", "startedAt");

-- CreateIndex
CREATE INDEX "InfMirror_entity_deletedAt_idx" ON "InfMirror"("entity", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "InfMirror_entity_sourceKey_key" ON "InfMirror"("entity", "sourceKey");

-- CreateIndex
CREATE UNIQUE INDEX "Product_informakonKey_key" ON "Product"("informakonKey");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCategory_informakonKey_key" ON "ProductCategory"("informakonKey");

-- CreateIndex
CREATE UNIQUE INDEX "ProductUnit_informakonKey_key" ON "ProductUnit"("informakonKey");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_informakonKey_key" ON "Supplier"("informakonKey");

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_informakonKey_key" ON "Warehouse"("informakonKey");

-- CreateIndex
CREATE UNIQUE INDEX "Worksite_informakonKey_key" ON "Worksite"("informakonKey");

