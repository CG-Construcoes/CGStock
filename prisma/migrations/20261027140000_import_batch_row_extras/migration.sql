-- AlterTable
ALTER TABLE "ImportBatchRow" ADD COLUMN     "categoryName" TEXT,
ADD COLUMN     "minimumStock" DECIMAL(18,4),
ADD COLUMN     "unitCode" TEXT;

