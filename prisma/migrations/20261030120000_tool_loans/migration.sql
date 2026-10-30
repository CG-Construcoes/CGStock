-- CreateTable: ToolLoan (Cautela Diária de Ferramentas/Materiais)
CREATE TABLE IF NOT EXISTS "ToolLoan" (
    "id" TEXT NOT NULL,
    "loanNumber" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "worksiteId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "loanedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "returnedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ToolLoan_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ToolLoanItem (Itens emprestados e devolvidos na cautela)
CREATE TABLE IF NOT EXISTS "ToolLoanItem" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "quantityLoaned" INTEGER NOT NULL,
    "quantityReturned" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "returnedAt" TIMESTAMP(3),
    "returnedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ToolLoanItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ToolLoan_loanNumber_key" ON "ToolLoan"("loanNumber");
CREATE INDEX IF NOT EXISTS "ToolLoan_recipientId_status_idx" ON "ToolLoan"("recipientId", "status");
CREATE INDEX IF NOT EXISTS "ToolLoan_warehouseId_status_idx" ON "ToolLoan"("warehouseId", "status");
CREATE INDEX IF NOT EXISTS "ToolLoan_loanedAt_idx" ON "ToolLoan"("loanedAt");

CREATE INDEX IF NOT EXISTS "ToolLoanItem_loanId_idx" ON "ToolLoanItem"("loanId");
CREATE INDEX IF NOT EXISTS "ToolLoanItem_productId_idx" ON "ToolLoanItem"("productId");
CREATE INDEX IF NOT EXISTS "ToolLoanItem_status_idx" ON "ToolLoanItem"("status");

-- AddForeignKey (idempotente)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ToolLoan_operatorId_fkey') THEN
        ALTER TABLE "ToolLoan" ADD CONSTRAINT "ToolLoan_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ToolLoan_recipientId_fkey') THEN
        ALTER TABLE "ToolLoan" ADD CONSTRAINT "ToolLoan_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ToolLoan_worksiteId_fkey') THEN
        ALTER TABLE "ToolLoan" ADD CONSTRAINT "ToolLoan_worksiteId_fkey" FOREIGN KEY ("worksiteId") REFERENCES "Worksite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ToolLoan_warehouseId_fkey') THEN
        ALTER TABLE "ToolLoan" ADD CONSTRAINT "ToolLoan_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ToolLoanItem_loanId_fkey') THEN
        ALTER TABLE "ToolLoanItem" ADD CONSTRAINT "ToolLoanItem_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "ToolLoan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ToolLoanItem_productId_fkey') THEN
        ALTER TABLE "ToolLoanItem" ADD CONSTRAINT "ToolLoanItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ToolLoanItem_locationId_fkey') THEN
        ALTER TABLE "ToolLoanItem" ADD CONSTRAINT "ToolLoanItem_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "WarehouseLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ToolLoanItem_returnedById_fkey') THEN
        ALTER TABLE "ToolLoanItem" ADD CONSTRAINT "ToolLoanItem_returnedById_fkey" FOREIGN KEY ("returnedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
