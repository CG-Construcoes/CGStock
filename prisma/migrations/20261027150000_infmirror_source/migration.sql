-- DropIndex
DROP INDEX "InfMirror_entity_deletedAt_idx";

-- DropIndex
DROP INDEX "InfMirror_entity_projectedHash_idx";

-- DropIndex
DROP INDEX "InfMirror_entity_sourceKey_key";

-- AlterTable
ALTER TABLE "InfMirror" ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'CV';

-- CreateIndex
CREATE INDEX "InfMirror_source_entity_deletedAt_idx" ON "InfMirror"("source", "entity", "deletedAt");

-- CreateIndex
CREATE INDEX "InfMirror_source_entity_projectedHash_idx" ON "InfMirror"("source", "entity", "projectedHash");

-- CreateIndex
CREATE UNIQUE INDEX "InfMirror_source_entity_sourceKey_key" ON "InfMirror"("source", "entity", "sourceKey");

