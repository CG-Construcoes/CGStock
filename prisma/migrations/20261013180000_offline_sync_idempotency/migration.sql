CREATE TABLE "OfflineSyncOperation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "entityKey" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "resultId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OfflineSyncOperation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OfflineSyncOperation_userId_operation_idempotencyKey_key" ON "OfflineSyncOperation"("userId", "operation", "idempotencyKey");
CREATE UNIQUE INDEX "OfflineSyncOperation_userId_operation_entityKey_key" ON "OfflineSyncOperation"("userId", "operation", "entityKey");
ALTER TABLE "OfflineSyncOperation" ADD CONSTRAINT "OfflineSyncOperation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
