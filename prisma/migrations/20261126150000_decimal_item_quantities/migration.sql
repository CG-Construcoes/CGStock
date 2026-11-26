-- AlterTable
ALTER TABLE `StockReceiptItem` MODIFY `quantity` DOUBLE NOT NULL;

-- AlterTable
ALTER TABLE `MaterialRequestItem` MODIFY `requestedQuantity` DOUBLE NOT NULL,
    MODIFY `approvedQuantity` DOUBLE NOT NULL DEFAULT 0,
    MODIFY `deliveredQuantity` DOUBLE NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `InventoryCollectionItem` MODIFY `quantity` DOUBLE NOT NULL;

-- AlterTable
ALTER TABLE `MaterialReturnItem` MODIFY `quantity` DOUBLE NOT NULL;

-- AlterTable
ALTER TABLE `StockTransferItem` MODIFY `quantity` DOUBLE NOT NULL;

-- AlterTable
ALTER TABLE `QuickIssueItem` MODIFY `quantity` DOUBLE NOT NULL;

-- AlterTable
ALTER TABLE `ToolLoanItem` MODIFY `quantityLoaned` DOUBLE NOT NULL,
    MODIFY `quantityReturned` DOUBLE NOT NULL DEFAULT 0;

