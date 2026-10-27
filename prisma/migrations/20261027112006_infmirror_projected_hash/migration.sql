-- AlterTable
ALTER TABLE "InfMirror" ADD COLUMN     "projectedHash" TEXT;

-- CreateIndex
CREATE INDEX "InfMirror_entity_projectedHash_idx" ON "InfMirror"("entity", "projectedHash");

