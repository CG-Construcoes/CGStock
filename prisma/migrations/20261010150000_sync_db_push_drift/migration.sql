-- Sincroniza objetos que haviam sido aplicados via `prisma db push`
-- e nunca foram capturados em migration. Sem esta migration, um deploy
-- em banco novo falha em `20261010180000_user_warehouse_access`, que
-- lê "UserWorksiteAccess" e "Warehouse"."worksiteId".

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_roleId_fkey";

-- DropIndex
DROP INDEX "Product_code_key";

-- AlterTable
ALTER TABLE "Inventory" ALTER COLUMN "type" SET DEFAULT 'PARTIAL';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "averageCost" DECIMAL(16,6);

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN "recipientUserId" TEXT,
ADD COLUMN "worksiteId" TEXT,
ALTER COLUMN "unitCost" SET DATA TYPE DECIMAL(16,6);

-- AlterTable
ALTER TABLE "StockReceiptItem" ALTER COLUMN "unitCost" SET DATA TYPE DECIMAL(16,6);

-- AlterTable
ALTER TABLE "User" DROP COLUMN "roleId",
ADD COLUMN "document" TEXT,
ADD COLUMN "employeeCode" TEXT,
ADD COLUMN "loginEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "phone" TEXT,
ADD COLUMN "qrStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "qrToken" TEXT,
ADD COLUMN "temporaryPasswordExpiresAt" TIMESTAMP(3),
ALTER COLUMN "email" DROP NOT NULL,
ALTER COLUMN "passwordHash" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Warehouse" ADD COLUMN "worksiteId" TEXT;

-- CreateTable
CREATE TABLE "Worksite" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Worksite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserWorksiteAccess" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "worksiteId" TEXT NOT NULL,
    "canViewStock" BOOLEAN NOT NULL DEFAULT true,
    "canRequestMaterial" BOOLEAN NOT NULL DEFAULT false,
    "canUseQuickIssue" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserWorksiteAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuickIssue" (
    "id" TEXT NOT NULL,
    "issueNumber" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "worksiteId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "QuickIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuickIssueItem" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "notes" TEXT,

    CONSTRAINT "QuickIssueItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'STAGING',
    "warehouseId" TEXT,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportBatchRow" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "productCode" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unitCost" DECIMAL(18,4),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,

    CONSTRAINT "ImportBatchRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_RoleToUser" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Worksite_code_key" ON "Worksite"("code");

-- CreateIndex
CREATE UNIQUE INDEX "UserWorksiteAccess_userId_worksiteId_key" ON "UserWorksiteAccess"("userId", "worksiteId");

-- CreateIndex
CREATE UNIQUE INDEX "QuickIssue_issueNumber_key" ON "QuickIssue"("issueNumber");

-- CreateIndex
CREATE UNIQUE INDEX "_RoleToUser_AB_unique" ON "_RoleToUser"("A", "B");

-- CreateIndex
CREATE INDEX "_RoleToUser_B_index" ON "_RoleToUser"("B");

-- CreateIndex
CREATE INDEX "Product_code_idx" ON "Product"("code");

-- CreateIndex
CREATE UNIQUE INDEX "User_employeeCode_key" ON "User"("employeeCode");

-- CreateIndex
CREATE UNIQUE INDEX "User_qrToken_key" ON "User"("qrToken");

-- AddForeignKey
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_worksiteId_fkey" FOREIGN KEY ("worksiteId") REFERENCES "Worksite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_worksiteId_fkey" FOREIGN KEY ("worksiteId") REFERENCES "Worksite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserWorksiteAccess" ADD CONSTRAINT "UserWorksiteAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserWorksiteAccess" ADD CONSTRAINT "UserWorksiteAccess_worksiteId_fkey" FOREIGN KEY ("worksiteId") REFERENCES "Worksite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuickIssue" ADD CONSTRAINT "QuickIssue_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuickIssue" ADD CONSTRAINT "QuickIssue_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuickIssue" ADD CONSTRAINT "QuickIssue_worksiteId_fkey" FOREIGN KEY ("worksiteId") REFERENCES "Worksite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuickIssue" ADD CONSTRAINT "QuickIssue_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuickIssueItem" ADD CONSTRAINT "QuickIssueItem_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "QuickIssue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuickIssueItem" ADD CONSTRAINT "QuickIssueItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuickIssueItem" ADD CONSTRAINT "QuickIssueItem_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "WarehouseLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatchRow" ADD CONSTRAINT "ImportBatchRow_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RoleToUser" ADD CONSTRAINT "_RoleToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RoleToUser" ADD CONSTRAINT "_RoleToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
