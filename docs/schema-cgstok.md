# Schema do CGStok (PostgreSQL — Prisma)

> Gerado em 27/10/2026 a partir de `prisma/schema.prisma` (39 modelos).
> Stack: Next.js 16 + Prisma 5 + PostgreSQL. IDs são `uuid()` strings;
> datas `DateTime`; enums são `String` com valores documentados em comentário.

## Visão geral

O CGStok é um sistema completo de almoxarifado próprio:

- **Catálogo**: `Product` (code, barcode, name, unit, category, min/max stock, averageCost,
  defaultLocation), `ProductCategory`, `ProductUnit`.
- **Estrutura física**: `Worksite` (obra) → `Warehouse` → `WarehouseLocation`
  (hierárquico via `parentId`).
- **Saldo**: `Stock` — único por `(productId, locationId)`, com `quantity` e `reservedQuantity`.
- **Movimentos**: `StockMovement` (tipos ENTRY/EXIT/ADJUSTMENT/TRANSFER/RETURN),
  `StockReceipt`+`StockReceiptItem`, `MaterialRequest`+`MaterialRequestItem`,
  `MaterialReturn`+`MaterialReturnItem`, `StockTransfer`+`StockTransferItem`,
  `QuickIssue`+`QuickIssueItem`.
- **Inventário**: `Inventory`, `InventoryLocation`, `InventoryOperator`,
  `InventoryCollection`+`Item`, `InventoryDivergence` (com trilha de aprovação).
- **Pessoas**: `User` (com `employeeCode`, `qrToken`, acessos por obra/almoxarifado
  via `UserWorksiteAccess`/`UserWarehouseAccess`), `Role`/`Permission`.
- **Fornecedores**: `Supplier` (document único = CNPJ/CPF).
- **Suporte**: `Tenant`, `AuditLog`, `LoginAttempt`, `Notification`, `SystemSetting`,
  `OfflineSyncOperation` (idempotência do modo offline), `ImportBatch`.

## Pontos de atenção para o mapeamento

1. **Duas chaves por entidade**: `id` (uuid interno) vs. códigos de negócio
   (`Product.code`, `Warehouse.code`, `Worksite.code`, `Supplier.document`,
   `ProductUnit.code`, `User.employeeCode`). O sync deve usar os **códigos** como
   chave de reconciliação com o Informakon, nunca o uuid.
2. `Stock` é por **location** (nível mais fino), não por warehouse — o saldo do
   Informakon é por Centro de Custo (≈ Warehouse), então a localização de destino
   precisa de convenção (ex.: location "GERAL" por warehouse).
3. `Product.quantity` em `Stock` é `Int`; o Informakon usa `numeric(14,4)`
   (permite frações — ex.: 10152.89 kg). **Conflito potencial** — ver mapeamento.
4. Não existe entidade "movimento mensal" — o Informakon guarda **snapshot mensal**
   (`Estoque_AnoMes`); o CGStok guarda saldo corrente + movimentos.
5. Não há campos `externalId`/origem nos modelos atuais — a Fase 4 precisa de
   migrations adicionando identificadores do Informakon (`informakonKey`) e/ou
   tabelas-espelho (staging).

## Modelos

### `User`

| Campo | Tipo | Atributos |
|---|---|---|
| `id` | String | @id @default(uuid()) |
| `name` | String |  |
| `email` | String? | @unique |
| `passwordHash` | String? |  |
| `document` | String? |  |
| `phone` | String? |  |
| `roles` | Role[] |  |
| `status` | String | @default("ACTIVE") // ACTIVE, INACTIVE |
| `mustChangePassword` | Boolean | @default(false) |
| `sessionVersion` | Int | @default(0) |
| `temporaryPasswordExpiresAt` | DateTime? |  |
| `employeeCode` | String? | @unique |
| `loginEnabled` | Boolean | @default(false) |
| `allWarehouseAccess` | Boolean | @default(false) |
| `movementsPerformed` | StockMovement[] |  |
| `movementsReceived` | StockMovement[] | @relation("MovementRecipient") |
| `receiptsCreated` | StockReceipt[] |  |
| `requestsCreated` | MaterialRequest[] | @relation("RequestRequester") |
| `requestsApproved` | MaterialRequest[] | @relation("RequestApprover") |
| `inventoriesCreated` | Inventory[] | @relation("InventoryCreator") |
| `inventoriesFinished` | Inventory[] | @relation("InventoryFinisher") |
| `inventoryOperations` | InventoryOperator[] |  |
| `inventoryCollections` | InventoryCollection[] |  |
| `offlineSyncOperations` | OfflineSyncOperation[] |  |
| `divergencesReviewed` | InventoryDivergence[] | @relation("DivergenceReviewer") |
| `divergencesApproved` | InventoryDivergence[] | @relation("DivergenceApprover") |
| `divergencesRejected` | InventoryDivergence[] | @relation("DivergenceRejecter") |
| `returnsCreated` | MaterialReturn[] | @relation("ReturnCreator") |
| `returnsReceived` | MaterialReturn[] | @relation("ReturnReceiver") |
| `transfersCreated` | StockTransfer[] | @relation("TransferCreator") |
| `transfersCompleted` | StockTransfer[] | @relation("TransferCompleter") |
| `auditLogs` | AuditLog[] | @relation("UserAuditLogs") |
| `notifications` | Notification[] | @relation("UserNotifications") |
| `systemSettings` | SystemSetting[] | @relation("UserSystemSettings") |
| `qrToken` | String? | @unique |
| `qrStatus` | String | @default("ACTIVE") // ACTIVE, REVOKED |
| `worksiteAccesses` | UserWorksiteAccess[] |  |
| `warehouseAccesses` | UserWarehouseAccess[] | @relation("WarehouseAccessUser") |
| `grantedWarehouseAccesses` | UserWarehouseAccess[] | @relation("WarehouseAccessGrantedBy") |
| `importBatches` | ImportBatch[] |  |
| `quickIssuesReceived` | QuickIssue[] | @relation("IssueRecipient") |
| `quickIssuesPerformed` | QuickIssue[] | @relation("IssueOperator") |
| `createdAt` | DateTime | @default(now()) |
| `updatedAt` | DateTime | @updatedAt |

### `Role`

| Campo | Tipo | Atributos |
|---|---|---|
| `id` | String | @id @default(uuid()) |
| `name` | String | @unique |
| `description` | String? |  |
| `users` | User[] |  |
| `permissions` | RolePermission[] |  |
| `createdAt` | DateTime | @default(now()) |
| `updatedAt` | DateTime | @updatedAt |

### `Permission`

| Campo | Tipo | Atributos |
|---|---|---|
| `id` | String | @id @default(uuid()) |
| `key` | String | @unique |
| `name` | String |  |
| `description` | String? |  |
| `roles` | RolePermission[] |  |

### `RolePermission`

| Campo | Tipo | Atributos |
|---|---|---|
| `roleId` | String |  |
| `permissionId` | String |  |
| `role` | Role | @relation(fields: [roleId], references: [id], onDelete: Cascade) |
| `permission` | Permission | @relation(fields: [permissionId], references: [id], onDelete: Cascade) |

### `ProductCategory`

| Campo | Tipo | Atributos |
|---|---|---|
| `id` | String | @id @default(uuid()) |
| `name` | String | @unique |
| `description` | String? |  |
| `status` | String | @default("ACTIVE") |
| `products` | Product[] |  |
| `createdAt` | DateTime | @default(now()) |
| `updatedAt` | DateTime | @updatedAt |

### `ProductUnit`

| Campo | Tipo | Atributos |
|---|---|---|
| `id` | String | @id @default(uuid()) |
| `code` | String | @unique |
| `name` | String |  |
| `description` | String? |  |
| `status` | String | @default("ACTIVE") |
| `products` | Product[] |  |
| `requestItems` | MaterialRequestItem[] |  |
| `returnItems` | MaterialReturnItem[] |  |
| `transferItems` | StockTransferItem[] |  |
| `createdAt` | DateTime | @default(now()) |
| `updatedAt` | DateTime | @updatedAt |

### `Product`

| Campo | Tipo | Atributos |
|---|---|---|
| `id` | String | @id @default(uuid()) |
| `code` | String |  |
| `barcode` | String? |  |
| `name` | String |  |
| `shortDescription` | String? |  |
| `categoryId` | String |  |
| `category` | ProductCategory | @relation(fields: [categoryId], references: [id]) |
| `unitId` | String |  |
| `unit` | ProductUnit | @relation(fields: [unitId], references: [id]) |
| `brand` | String? |  |
| `model` | String? |  |
| `minimumStock` | Int | @default(0) |
| `maximumStock` | Int | @default(0) |
| `averageCost` | Decimal? | @db.Decimal(16, 6) |
| `defaultLocationId` | String? |  |
| `defaultLocation` | WarehouseLocation? | @relation(fields: [defaultLocationId], references: [id]) |
| `status` | String | @default("ACTIVE") // ACTIVE, INACTIVE |
| `notes` | String? |  |
| `stocks` | Stock[] |  |
| `movements` | StockMovement[] |  |
| `receiptItems` | StockReceiptItem[] |  |
| `requestItems` | MaterialRequestItem[] |  |
| `inventoryItems` | InventoryCollectionItem[] |  |
| `inventoryDivergences` | InventoryDivergence[] |  |
| `returnItems` | MaterialReturnItem[] |  |
| `transferItems` | StockTransferItem[] |  |
| `quickIssueItems` | QuickIssueItem[] |  |
| `createdAt` | DateTime | @default(now()) |
| `updatedAt` | DateTime | @updatedAt |

### `Warehouse`

| Campo | Tipo | Atributos |
|---|---|---|
| `id` | String | @id @default(uuid()) |
| `name` | String |  |
| `code` | String | @unique |
| `description` | String? |  |
| `status` | String | @default("ACTIVE") |
| `worksiteId` | String? |  |
| `worksite` | Worksite? | @relation(fields: [worksiteId], references: [id]) |
| `locations` | WarehouseLocation[] |  |
| `stocks` | Stock[] |  |
| `movements` | StockMovement[] |  |
| `receipts` | StockReceipt[] |  |
| `requests` | MaterialRequest[] |  |
| `inventories` | Inventory[] |  |
| `returns` | MaterialReturn[] |  |
| `transfersSource` | StockTransfer[] | @relation("TransferSourceWarehouse") |
| `transfersDestination` | StockTransfer[] | @relation("TransferDestinationWarehouse") |
| `quickIssues` | QuickIssue[] |  |
| `userAccesses` | UserWarehouseAccess[] |  |
| `importBatches` | ImportBatch[] |  |
| `createdAt` | DateTime | @default(now()) |
| `updatedAt` | DateTime | @updatedAt |

### `WarehouseLocation`

| Campo | Tipo | Atributos |
|---|---|---|
| `id` | String | @id @default(uuid()) |
| `warehouseId` | String |  |
| `warehouse` | Warehouse | @relation(fields: [warehouseId], references: [id], onDelete: Cascade) |
| `code` | String | @unique |
| `name` | String |  |
| `description` | String? |  |
| `status` | String | @default("ACTIVE") |
| `parentId` | String? |  |
| `parent` | WarehouseLocation? | @relation("LocationHierarchy", fields: [parentId], references: [id]) |
| `children` | WarehouseLocation[] | @relation("LocationHierarchy") |
| `products` | Product[] |  |
| `stocks` | Stock[] |  |
| `movements` | StockMovement[] |  |
| `receiptItems` | StockReceiptItem[] |  |
| `inventoryLocations` | InventoryLocation[] |  |
| `inventoryCollections` | InventoryCollection[] |  |
| `inventoryDivergences` | InventoryDivergence[] |  |
| `returnItems` | MaterialReturnItem[] |  |
| `transfersSource` | StockTransfer[] | @relation("TransferSourceLocation") |
| `transfersDestination` | StockTransfer[] | @relation("TransferDestinationLocation") |
| `quickIssueItems` | QuickIssueItem[] |  |
| `createdAt` | DateTime | @default(now()) |
| `updatedAt` | DateTime | @updatedAt |

### `Stock`

| Campo | Tipo | Atributos |
|---|---|---|
| `id` | String | @id @default(uuid()) |
| `productId` | String |  |
| `product` | Product | @relation(fields: [productId], references: [id]) |
| `warehouseId` | String |  |
| `warehouse` | Warehouse | @relation(fields: [warehouseId], references: [id]) |
| `locationId` | String |  |
| `location` | WarehouseLocation | @relation(fields: [locationId], references: [id]) |
| `quantity` | Int |  |
| `reservedQuantity` | Int | @default(0) |
| `createdAt` | DateTime | @default(now()) |
| `updatedAt` | DateTime | @updatedAt |

### `StockMovement`

| Campo | Tipo | Atributos |
|---|---|---|
| `id` | String | @id @default(uuid()) |
| `productId` | String |  |
| `product` | Product | @relation(fields: [productId], references: [id]) |
| `warehouseId` | String |  |
| `warehouse` | Warehouse | @relation(fields: [warehouseId], references: [id]) |
| `locationId` | String |  |
| `location` | WarehouseLocation | @relation(fields: [locationId], references: [id]) |
| `type` | String | // ENTRY, EXIT, ADJUSTMENT_IN, ADJUSTMENT_OUT, TRANSFER_IN, TRANSFER_OUT, RETURN |
| `quantity` | Int |  |
| `unitCost` | Decimal? | @db.Decimal(16, 6) |
| `totalCost` | Decimal? | @db.Decimal(10, 2) |
| `referenceType` | String? | // RECEIPT, INVENTORY_ADJUSTMENT, TRANSFER, MATERIAL_REQUEST, MATERIAL_RETURN, QUICK_ISSUE |
| `referenceId` | String? |  |
| `documentNumber` | String? |  |
| `reason` | String? |  |
| `notes` | String? |  |
| `performedById` | String |  |
| `performedBy` | User | @relation(fields: [performedById], references: [id]) |
| `recipientUserId` | String? |  |
| `recipientUser` | User? | @relation("MovementRecipient", fields: [recipientUserId], references: [id]) |
| `worksiteId` | String? |  |
| `worksite` | Worksite? | @relation(fields: [worksiteId], references: [id]) |
| `createdAt` | DateTime | @default(now()) |

### `Supplier`

| Campo | Tipo | Atributos |
|---|---|---|
| `id` | String | @id @default(uuid()) |
| `name` | String |  |
| `tradeName` | String? |  |
| `document` | String? | @unique |
| `email` | String? |  |
| `phone` | String? |  |
| `address` | String? |  |
| `city` | String? |  |
| `state` | String? |  |
| `zipCode` | String? |  |
| `notes` | String? |  |
| `status` | String | @default("ACTIVE") |
| `receipts` | StockReceipt[] |  |
| `createdAt` | DateTime | @default(now()) |
| `updatedAt` | DateTime | @updatedAt |

### `OfflineSyncOperation`

| Campo | Tipo | Atributos |
|---|---|---|
| `id` | String | @id @default(uuid()) |
| `userId` | String |  |
| `user` | User | @relation(fields: [userId], references: [id], onDelete: Cascade) |
| `operation` | String |  |
| `idempotencyKey` | String |  |
| `entityKey` | String |  |
| `payloadHash` | String |  |
| `resultId` | String? |  |
| `createdAt` | DateTime | @default(now()) |

### `StockReceipt`

| Campo | Tipo | Atributos |
|---|---|---|
| `id` | String | @id @default(uuid()) |
| `supplierId` | String |  |
| `supplier` | Supplier | @relation(fields: [supplierId], references: [id]) |
| `warehouseId` | String |  |
| `warehouse` | Warehouse | @relation(fields: [warehouseId], references: [id]) |
| `documentNumber` | String? |  |
| `documentDate` | DateTime? |  |
| `receivedAt` | DateTime? |  |
| `status` | String | @default("DRAFT") // DRAFT, COMPLETED, CANCELLED |
| `subtotal` | Decimal? | @db.Decimal(10, 2) |
| `total` | Decimal? | @db.Decimal(10, 2) |
| `notes` | String? |  |
| `createdById` | String |  |
| `createdBy` | User | @relation(fields: [createdById], references: [id]) |
| `items` | StockReceiptItem[] |  |
| `createdAt` | DateTime | @default(now()) |
| `updatedAt` | DateTime | @updatedAt |

### `StockReceiptItem`

| Campo | Tipo | Atributos |
|---|---|---|
| `id` | String | @id @default(uuid()) |
| `receiptId` | String |  |
| `receipt` | StockReceipt | @relation(fields: [receiptId], references: [id], onDelete: Cascade) |
| `productId` | String |  |
| `product` | Product | @relation(fields: [productId], references: [id]) |
| `locationId` | String |  |
| `location` | WarehouseLocation | @relation(fields: [locationId], references: [id]) |
| `quantity` | Int |  |
| `unitCost` | Decimal? | @db.Decimal(16, 6) |
| `totalCost` | Decimal? | @db.Decimal(10, 2) |
| `notes` | String? |  |

### `MaterialRequest`

| Campo | Tipo | Atributos |
|---|---|---|
| `id` | String | @id @default(uuid()) |
| `requestNumber` | String | @unique |
| `requesterId` | String |  |
| `requester` | User | @relation("RequestRequester", fields: [requesterId], references: [id]) |
| `warehouseId` | String |  |
| `warehouse` | Warehouse | @relation(fields: [warehouseId], references: [id]) |
| `status` | String | @default("DRAFT") // DRAFT, PENDING_APPROVAL, APPROVED, REJECTED, IN_SEPARATION, PARTIALLY_FULFILLED, FULFILLED, CANCELLED |
| `priority` | String | @default("NORMAL") // LOW, NORMAL, HIGH, URGENT |
| `notes` | String? |  |
| `approvedById` | String? |  |
| `approvedBy` | User? | @relation("RequestApprover", fields: [approvedById], references: [id]) |
| `requestedAt` | DateTime? |  |
| `approvedAt` | DateTime? |  |
| `fulfilledAt` | DateTime? |  |
| `completedAt` | DateTime? |  |
| `items` | MaterialRequestItem[] |  |
| `returns` | MaterialReturn[] |  |
| `createdAt` | DateTime | @default(now()) |
| `updatedAt` | DateTime | @updatedAt |

### `MaterialRequestItem`

| Campo | Tipo | Atributos |
|---|---|---|
| `id` | String | @id @default(uuid()) |
| `requestId` | String |  |
| `request` | MaterialRequest | @relation(fields: [requestId], references: [id], onDelete: Cascade) |
| `productId` | String |  |
| `product` | Product | @relation(fields: [productId], references: [id]) |
| `unitId` | String |  |
| `unit` | ProductUnit | @relation(fields: [unitId], references: [id]) |
| `requestedQuantity` | Int |  |
| `approvedQuantity` | Int | @default(0) |
| `separatedQuantity` | Int | @default(0) |
| `deliveredQuantity` | Int | @default(0) |
| `notes` | String? |  |
| `createdAt` | DateTime | @default(now()) |
| `updatedAt` | DateTime | @updatedAt |

### `Inventory`

| Campo | Tipo | Atributos |
|---|---|---|
| `id` | String | @id @default(uuid()) |
| `code` | String | @unique |
| `name` | String |  |
| `warehouseId` | String |  |
| `warehouse` | Warehouse | @relation(fields: [warehouseId], references: [id]) |
| `status` | String | @default("DRAFT") // DRAFT, READY, IN_PROGRESS, COUNTING, CONFERENCE, COMPLETED, CANCELLED |
| `type` | String | @default("PARTIAL") // FULL, PARTIAL, CYCLE_COUNT |
| `notes` | String? |  |
| `startedAt` | DateTime? |  |
| `finishedAt` | DateTime? |  |
| `createdById` | String |  |
| `createdBy` | User | @relation("InventoryCreator", fields: [createdById], references: [id]) |
| `finishedById` | String? |  |
| `finishedBy` | User? | @relation("InventoryFinisher", fields: [finishedById], references: [id]) |
| `locations` | InventoryLocation[] |  |
| `operators` | InventoryOperator[] |  |
| `collections` | InventoryCollection[] |  |
| `divergences` | InventoryDivergence[] |  |
| `createdAt` | DateTime | @default(now()) |
| `updatedAt` | DateTime | @updatedAt |

### `InventoryLocation`

| Campo | Tipo | Atributos |
|---|---|---|
| `id` | String | @id @default(uuid()) |
| `inventoryId` | String |  |
| `inventory` | Inventory | @relation(fields: [inventoryId], references: [id], onDelete: Cascade) |
| `locationId` | String |  |
| `location` | WarehouseLocation | @relation(fields: [locationId], references: [id]) |
| `status` | String | @default("PENDING") // PENDING, IN_PROGRESS, COMPLETED |
| `startedAt` | DateTime? |  |
| `finishedAt` | DateTime? |  |

### `InventoryOperator`

| Campo | Tipo | Atributos |
|---|---|---|
| `id` | String | @id @default(uuid()) |
| `inventoryId` | String |  |
| `inventory` | Inventory | @relation(fields: [inventoryId], references: [id], onDelete: Cascade) |
| `userId` | String |  |
| `user` | User | @relation(fields: [userId], references: [id]) |

### `InventoryCollection`

| Campo | Tipo | Atributos |
|---|---|---|
| `id` | String | @id @default(uuid()) |
| `inventoryId` | String |  |
| `inventory` | Inventory | @relation(fields: [inventoryId], references: [id], onDelete: Cascade) |
| `locationId` | String |  |
| `location` | WarehouseLocation | @relation(fields: [locationId], references: [id]) |
| `operatorId` | String |  |
| `operator` | User | @relation(fields: [operatorId], references: [id]) |
| `status` | String | @default("OPEN") // OPEN, IN_PROGRESS, SUBMITTED, CANCELLED |
| `startedAt` | DateTime? |  |
| `finishedAt` | DateTime? |  |
| `items` | InventoryCollectionItem[] |  |
| `createdAt` | DateTime | @default(now()) |
| `updatedAt` | DateTime | @updatedAt |

### `InventoryCollectionItem`

| Campo | Tipo | Atributos |
|---|---|---|
| `id` | String | @id @default(uuid()) |
| `collectionId` | String |  |
| `collection` | InventoryCollection | @relation(fields: [collectionId], references: [id], onDelete: Cascade) |
| `productId` | String |  |
| `product` | Product | @relation(fields: [productId], references: [id]) |
| `quantity` | Int |  |
| `createdAt` | DateTime | @default(now()) |
| `updatedAt` | DateTime | @updatedAt |

### `InventoryDivergence`

| Campo | Tipo | Atributos |
|---|---|---|
| `id` | String | @id @default(uuid()) |
| `inventoryId` | String |  |
| `inventory` | Inventory | @relation(fields: [inventoryId], references: [id], onDelete: Cascade) |
| `locationId` | String |  |
| `location` | WarehouseLocation | @relation(fields: [locationId], references: [id]) |
| `productId` | String |  |
| `product` | Product | @relation(fields: [productId], references: [id]) |
| `systemQuantity` | Int |  |
| `countedQuantity` | Int |  |
| `difference` | Int |  |
| `status` | String | @default("PENDING") // PENDING, REVIEWED, APPROVED, REJECTED, ADJUSTED |
| `notes` | String? |  |
| `reviewedById` | String? |  |
| `reviewedBy` | User? | @relation("DivergenceReviewer", fields: [reviewedById], references: [id]) |
| `reviewedAt` | DateTime? |  |
| `reviewNotes` | String? |  |
| `approvedById` | String? |  |
| `approvedBy` | User? | @relation("DivergenceApprover", fields: [approvedById], references: [id]) |
| `approvedAt` | DateTime? |  |
| `approvalNotes` | String? |  |
| `rejectedById` | String? |  |
| `rejectedBy` | User? | @relation("DivergenceRejecter", fields: [rejectedById], references: [id]) |
| `rejectedAt` | DateTime? |  |
| `rejectionReason` | String? |  |
| `createdAt` | DateTime | @default(now()) |
| `updatedAt` | DateTime | @updatedAt |

### `MaterialReturn`

| Campo | Tipo | Atributos |
|---|---|---|
| `id` | String | @id @default(uuid()) |
| `returnNumber` | String | @unique |
| `warehouseId` | String |  |
| `warehouse` | Warehouse | @relation(fields: [warehouseId], references: [id]) |
| `requestId` | String? |  |
| `request` | MaterialRequest? | @relation(fields: [requestId], references: [id]) |
| `returnedById` | String |  |
| `returnedBy` | User | @relation("ReturnCreator", fields: [returnedById], references: [id]) |
| `receivedById` | String? |  |
| `receivedBy` | User? | @relation("ReturnReceiver", fields: [receivedById], references: [id]) |
| `status` | String | @default("DRAFT") // DRAFT, RECEIVED, CANCELLED |
| `reason` | String? |  |
| `notes` | String? |  |
| `items` | MaterialReturnItem[] |  |
| `createdAt` | DateTime | @default(now()) |
| `updatedAt` | DateTime | @updatedAt |

### `MaterialReturnItem`

| Campo | Tipo | Atributos |
|---|---|---|
| `id` | String | @id @default(uuid()) |
| `returnId` | String |  |
| `return` | MaterialReturn | @relation(fields: [returnId], references: [id], onDelete: Cascade) |
| `productId` | String |  |
| `product` | Product | @relation(fields: [productId], references: [id]) |
| `locationId` | String |  |
| `location` | WarehouseLocation | @relation(fields: [locationId], references: [id]) |
| `quantity` | Int |  |
| `unitId` | String |  |
| `unit` | ProductUnit | @relation(fields: [unitId], references: [id]) |
| `condition` | String | @default("GOOD") // GOOD, DAMAGED, UNUSABLE |
| `notes` | String? |  |
| `createdAt` | DateTime | @default(now()) |
| `updatedAt` | DateTime | @updatedAt |

### `StockTransfer`

| Campo | Tipo | Atributos |
|---|---|---|
| `id` | String | @id @default(uuid()) |
| `transferNumber` | String | @unique |
| `sourceWarehouseId` | String |  |
| `sourceWarehouse` | Warehouse | @relation("TransferSourceWarehouse", fields: [sourceWarehouseId], references: [id]) |
| `sourceLocationId` | String |  |
| `sourceLocation` | WarehouseLocation | @relation("TransferSourceLocation", fields: [sourceLocationId], references: [id]) |
| `destinationWarehouseId` | String |  |
| `destinationWarehouse` | Warehouse | @relation("TransferDestinationWarehouse", fields: [destinationWarehouseId], references: [id]) |
| `destinationLocationId` | String |  |
| `destinationLocation` | WarehouseLocation | @relation("TransferDestinationLocation", fields: [destinationLocationId], references: [id]) |
| `status` | String | @default("DRAFT") // DRAFT, IN_TRANSIT, COMPLETED, CANCELLED |
| `createdById` | String |  |
| `createdBy` | User | @relation("TransferCreator", fields: [createdById], references: [id]) |
| `completedById` | String? |  |
| `completedBy` | User? | @relation("TransferCompleter", fields: [completedById], references: [id]) |
| `items` | StockTransferItem[] |  |
| `createdAt` | DateTime | @default(now()) |
| `updatedAt` | DateTime | @updatedAt |

### `StockTransferItem`

| Campo | Tipo | Atributos |
|---|---|---|
| `id` | String | @id @default(uuid()) |
| `transferId` | String |  |
| `transfer` | StockTransfer | @relation(fields: [transferId], references: [id], onDelete: Cascade) |
| `productId` | String |  |
| `product` | Product | @relation(fields: [productId], references: [id]) |
| `quantity` | Int |  |
| `unitId` | String |  |
| `unit` | ProductUnit | @relation(fields: [unitId], references: [id]) |
| `notes` | String? |  |
| `createdAt` | DateTime | @default(now()) |
| `updatedAt` | DateTime | @updatedAt |

### `Tenant`

| Campo | Tipo | Atributos |
|---|---|---|
| `id` | String | @id @default(uuid()) |
| `name` | String |  |
| `slug` | String | @unique |
| `status` | String | @default("ACTIVE") |
| `createdAt` | DateTime | @default(now()) |
| `updatedAt` | DateTime | @updatedAt |

### `AuditLog`

| Campo | Tipo | Atributos |
|---|---|---|
| `id` | String | @id @default(uuid()) |
| `userId` | String |  |
| `user` | User | @relation("UserAuditLogs", fields: [userId], references: [id]) |
| `action` | String |  |
| `entityType` | String |  |
| `entityId` | String |  |
| `metadata` | Json? |  |
| `ip` | String? |  |
| `userAgent` | String? |  |
| `timestamp` | DateTime | @default(now()) |

### `LoginAttempt`

| Campo | Tipo | Atributos |
|---|---|---|
| `id` | String | @id @default(uuid()) |
| `email` | String |  |
| `ip` | String? |  |
| `success` | Boolean |  |
| `createdAt` | DateTime | @default(now()) |

### `Notification`

| Campo | Tipo | Atributos |
|---|---|---|
| `id` | String | @id @default(uuid()) |
| `userId` | String |  |
| `user` | User | @relation("UserNotifications", fields: [userId], references: [id]) |
| `type` | String |  |
| `title` | String |  |
| `message` | String |  |
| `readAt` | DateTime? |  |
| `createdAt` | DateTime | @default(now()) |

### `SystemSetting`

| Campo | Tipo | Atributos |
|---|---|---|
| `id` | String | @id @default(uuid()) |
| `key` | String | @unique |
| `value` | String |  |
| `type` | String | @default("STRING") // STRING, NUMBER, BOOLEAN, JSON |
| `description` | String? |  |
| `updatedById` | String |  |
| `updatedBy` | User | @relation("UserSystemSettings", fields: [updatedById], references: [id]) |
| `updatedAt` | DateTime | @updatedAt |

### `Worksite`

| Campo | Tipo | Atributos |
|---|---|---|
| `id` | String | @id @default(uuid()) |
| `code` | String | @unique |
| `name` | String |  |
| `description` | String? |  |
| `status` | String | @default("ACTIVE") // ACTIVE, INACTIVE |
| `warehouses` | Warehouse[] |  |
| `users` | UserWorksiteAccess[] |  |
| `quickIssues` | QuickIssue[] |  |
| `movements` | StockMovement[] |  |
| `createdAt` | DateTime | @default(now()) |
| `updatedAt` | DateTime | @updatedAt |

### `UserWorksiteAccess`

| Campo | Tipo | Atributos |
|---|---|---|
| `id` | String | @id @default(uuid()) |
| `userId` | String |  |
| `user` | User | @relation(fields: [userId], references: [id], onDelete: Cascade) |
| `worksiteId` | String |  |
| `worksite` | Worksite | @relation(fields: [worksiteId], references: [id], onDelete: Cascade) |
| `canViewStock` | Boolean | @default(true) |
| `canRequestMaterial` | Boolean | @default(false) |
| `canUseQuickIssue` | Boolean | @default(false) |
| `createdAt` | DateTime | @default(now()) |

### `QuickIssue`

| Campo | Tipo | Atributos |
|---|---|---|
| `id` | String | @id @default(uuid()) |
| `issueNumber` | String | @unique |
| `operatorId` | String |  |
| `operator` | User | @relation("IssueOperator", fields: [operatorId], references: [id]) |
| `recipientId` | String |  |
| `recipient` | User | @relation("IssueRecipient", fields: [recipientId], references: [id]) |
| `worksiteId` | String |  |
| `worksite` | Worksite | @relation(fields: [worksiteId], references: [id]) |
| `warehouseId` | String |  |
| `warehouse` | Warehouse | @relation(fields: [warehouseId], references: [id]) |
| `status` | String | @default("DRAFT") // DRAFT, COMPLETED, CANCELLED |
| `notes` | String? |  |
| `items` | QuickIssueItem[] |  |
| `createdAt` | DateTime | @default(now()) |
| `completedAt` | DateTime? |  |

### `QuickIssueItem`

| Campo | Tipo | Atributos |
|---|---|---|
| `id` | String | @id @default(uuid()) |
| `issueId` | String |  |
| `issue` | QuickIssue | @relation(fields: [issueId], references: [id], onDelete: Cascade) |
| `productId` | String |  |
| `product` | Product | @relation(fields: [productId], references: [id]) |
| `locationId` | String |  |
| `location` | WarehouseLocation | @relation(fields: [locationId], references: [id]) |
| `quantity` | Int |  |
| `notes` | String? |  |

### `UserWarehouseAccess`

| Campo | Tipo | Atributos |
|---|---|---|
| `id` | String | @id @default(uuid()) |
| `userId` | String |  |
| `warehouseId` | String |  |
| `grantedById` | String? |  |
| `createdAt` | DateTime | @default(now()) |
| `user` | User | @relation("WarehouseAccessUser", fields: [userId], references: [id], onDelete: Cascade) |
| `warehouse` | Warehouse | @relation(fields: [warehouseId], references: [id], onDelete: Cascade) |
| `grantedBy` | User? | @relation("WarehouseAccessGrantedBy", fields: [grantedById], references: [id], onDelete: SetNull) |

### `ImportBatch`

| Campo | Tipo | Atributos |
|---|---|---|
| `id` | String | @id @default(uuid()) |
| `createdAt` | DateTime | @default(now()) |
| `createdById` | String |  |
| `status` | String | @default("STAGING") |
| `warehouseId` | String? |  |
| `createdBy` | User | @relation(fields: [createdById], references: [id]) |
| `warehouse` | Warehouse? | @relation(fields: [warehouseId], references: [id]) |
| `rows` | ImportBatchRow[] |  |

### `ImportBatchRow`

| Campo | Tipo | Atributos |
|---|---|---|
| `id` | String | @id @default(uuid()) |
| `batchId` | String |  |
| `productCode` | String |  |
| `productName` | String |  |
| `quantity` | Decimal | @db.Decimal(18, 4) |
| `unitCost` | Decimal? | @db.Decimal(18, 4) |
| `status` | String | @default("PENDING") |
| `errorMessage` | String? |  |
| `batch` | ImportBatch | @relation(fields: [batchId], references: [id], onDelete: Cascade) |


---

## Adendo — Sync Informakon (migration `informakon_sync`)

### `informakonKey` (novo campo `String? @unique`)

Presente em: `ProductCategory`, `ProductUnit`, `Product`, `Warehouse`,
`Worksite`, `Supplier`. Funcionários reconciliam via `User.employeeCode`
(prefixo `INF-`), movimentos via `StockMovement.referenceId` (prefixo `INF-`).
Registros sem `informakonKey` são 100% do CGStok — o sync nunca os toca.

### Tipos alterados

`Stock.quantity`, `Stock.reservedQuantity`, `StockMovement.quantity`,
`Product.minimumStock`, `Product.maximumStock`: `Int → Float` (double) —
o Informakon usa `numeric(14,4)` fracionário.

### Novos modelos

| Modelo | Papel |
|---|---|
| `InfMirror` | Espelho bruto `(entity, sourceKey)` → `payload` JSONB + `hash` sha256. `projectedHash` NULL = pendente de projeção (fila de retry persistente); `'DEL'` = exclusão já tratada. `deletedAt` = soft-delete da fonte. |
| `SyncCheckpoint` | 1 linha por entidade: `lastSuccessAt`, `lastStatus`, `totalRows`, `lastError` — alimenta "atualizado às HH:MM" no app. |
| `SyncRun` | Histórico de execuções por entidade (`upserted`, `deleted`, `error`). |

### Feature flag

`SystemSetting key='informakon.sync.enabled'`: `'true'`/`'false'`. Controla a
projeção (o espelho continua atualizando). Criada pelo próprio sync com default
`'true'`; desligar = voltar a operar só com dados locais sem perder o espelho.
