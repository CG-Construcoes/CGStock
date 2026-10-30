-- Almoxarifados e Fornecedores passam a ter empresa de origem (MGA = CG, CV = Conceito)
-- Fornecedores ganham código do ERP, categoria (Espécie de Credor) e data de cadastro.

-- AddColumn: Warehouse.source
ALTER TABLE "Warehouse" ADD COLUMN IF NOT EXISTS "source" TEXT;

-- AddColumn: Supplier.source / erpCode / category / registeredAt
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "source" TEXT;
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "erpCode" TEXT;
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "category" TEXT;
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "registeredAt" TIMESTAMP(3);

-- DropIndex: document deixa de ser único global (o mesmo CNPJ/CPF pode existir
-- em MGA e CV, e o ERP pode ter cadastros duplicados do mesmo documento)
DROP INDEX IF EXISTS "Supplier_document_key";

-- CreateIndex: chave de deduplicação da importação = empresa + código do ERP
CREATE UNIQUE INDEX IF NOT EXISTS "Supplier_source_erpCode_key" ON "Supplier"("source", "erpCode");
CREATE INDEX IF NOT EXISTS "Supplier_source_idx" ON "Supplier"("source");
CREATE INDEX IF NOT EXISTS "Supplier_category_idx" ON "Supplier"("category");
CREATE INDEX IF NOT EXISTS "Supplier_document_idx" ON "Supplier"("document");
