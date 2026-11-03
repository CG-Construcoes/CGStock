-- CreateTable: ToolAsset (Inventário próprio da Ferramentaria, separado de Stock/Product)
CREATE TABLE "ToolAsset" (
    "id" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "qrToken" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "brand" TEXT,
    "serialNumber" TEXT,
    "trackingType" TEXT NOT NULL DEFAULT 'ASSET',
    "totalQuantity" INTEGER NOT NULL DEFAULT 1,
    "unit" TEXT NOT NULL DEFAULT 'UN',
    "condition" TEXT NOT NULL DEFAULT 'GOOD',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ToolAsset_pkey" PRIMARY KEY ("id")
);

-- AlterTable: ToolLoanItem — desacopla de Product/WarehouseLocation e vincula a ToolAsset
ALTER TABLE "ToolLoanItem" ADD COLUMN IF NOT EXISTS "toolAssetId" TEXT;
ALTER TABLE "ToolLoanItem" ALTER COLUMN "productId" DROP NOT NULL;
ALTER TABLE "ToolLoanItem" ALTER COLUMN "locationId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "ToolAsset_qrToken_key" ON "ToolAsset"("qrToken");
CREATE UNIQUE INDEX "ToolAsset_warehouseId_code_key" ON "ToolAsset"("warehouseId", "code");
CREATE INDEX "ToolAsset_warehouseId_status_idx" ON "ToolAsset"("warehouseId", "status");
CREATE INDEX "ToolAsset_code_idx" ON "ToolAsset"("code");
CREATE INDEX "ToolLoanItem_toolAssetId_idx" ON "ToolLoanItem"("toolAssetId");

-- AddForeignKey
ALTER TABLE "ToolAsset" ADD CONSTRAINT "ToolAsset_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ToolLoanItem" ADD CONSTRAINT "ToolLoanItem_toolAssetId_fkey" FOREIGN KEY ("toolAssetId") REFERENCES "ToolAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
