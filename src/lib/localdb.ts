import Dexie, { type Table } from 'dexie';

export interface LocalProduct {
  id: string;
  code: string;
  barcode: string | null;
  name: string;
  unitCode?: string | null;
  systemQuantity?: number;
  locationStocks?: Record<string, number>;
}

export interface LocalLocation {
  id: string;
  code: string;
  name?: string;
  status?: string;
}

export interface LocalInventory {
  id: string;
  code: string;
  name: string;
  status: string;
  warehouseId?: string;
  warehouseName?: string;
  locations: LocalLocation[];
}

export interface LocalCollectionItem {
  productId: string;
  code: string;
  name: string;
  unitCode?: string;
  systemQuantity?: number;
  quantity: number;
}

export interface CollectorDraft {
  id: string; // `${userId}:${inventoryId}:${locationId}`
  userId: string;
  inventoryId: string;
  locationId: string;
  locationCode?: string;
  updatedAt: Date;
  items: LocalCollectionItem[];
}

export interface OfflineSnapshot<T = unknown> {
  id: string;
  userId: string;
  module: string;
  downloadedAt: Date;
  expiresAt: Date;
  data: T;
}

export interface CollectorSnapshotData {
  products: LocalProduct[];
  inventories: LocalInventory[];
}

export type CollectorSnapshot = OfflineSnapshot<CollectorSnapshotData>

export interface LocalCatalogProduct {
  id: string;
  code: string;
  barcode: string | null;
  name: string;
  unitId?: string;
  unitCode: string | null;
  categoryId?: string;
  categoryName: string | null;
  minimumStock?: number;
  maximumStock?: number;
  averageCost?: number | null;
  status?: string;
}

export interface LocalWarehouse {
  id: string;
  code: string;
  name: string;
  worksiteId?: string | null;
  description?: string | null;
  status?: string;
}

export interface LocalWarehouseLocation {
  id: string;
  warehouseId: string;
  code: string;
  name: string;
  description?: string | null;
  status?: string;
}

export interface LocalSupplier {
  id: string;
  name: string;
  document?: string | null;
  status?: string;
}

export interface LocalWorksite {
  id: string;
  code?: string | null;
  name: string;
  status: string;
}

export interface LocalEmployee {
  id: string;
  name: string;
  email?: string | null;
  employeeCode?: string | null;
  document?: string | null;
  qrToken?: string | null;
  qrStatus: string;
  status: string;
  roles?: string[];
  worksites: LocalWorksite[];
}

export interface LocalCategory {
  id: string;
  name: string;
  description?: string | null;
  status?: string;
}

export interface CatalogSnapshotData {
  products: LocalCatalogProduct[];
  warehouses: LocalWarehouse[];
  locations: LocalWarehouseLocation[];
  suppliers: LocalSupplier[];
  units: { id: string; code: string; name: string; status?: string }[];
  categories?: LocalCategory[];
  employees?: LocalEmployee[];
  worksites?: LocalWorksite[];
  operators?: { id: string; name: string; email?: string | null; roles: string[] }[];
}

export interface StockSnapshotItem {
  productId: string;
  warehouseId: string;
  locationId: string;
  quantity: number;
  reservedQuantity: number;
}

export interface StockSnapshotData {
  items: StockSnapshotItem[];
}

export interface LocalRequestItem {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  unitId: string;
  unitCode: string;
  requestedQuantity: number;
  approvedQuantity: number;
  deliveredQuantity: number;
}

export interface LocalRequestRecord {
  id: string;
  requestNumber: string;
  status: string;
  priority?: string;
  notes?: string | null;
  warehouseId?: string;
  warehouseName?: string;
  requesterId?: string;
  requesterName?: string;
  approvedByName?: string | null;
  approvedAt?: string | null;
  createdAt: string;
  requestedAt?: string | null;
  fulfilledAt?: string | null;
  itemCount: number;
  items?: LocalRequestItem[];
  offlinePending?: boolean;
}

export interface RequestsSnapshotData {
  items: LocalRequestRecord[];
}

export interface LocalMovementRecord {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  unitCode: string;
  warehouseId: string;
  warehouseName: string;
  locationId: string;
  locationCode: string;
  type: string;
  quantity: number;
  referenceType?: string | null;
  referenceId?: string | null;
  documentNumber?: string | null;
  performedByName: string;
  recipientName?: string | null;
  reason?: string | null;
  notes?: string | null;
  createdAt: string;
  offlinePending?: boolean;
}

export interface LocalReceiptItemRecord {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  unitCode: string;
  locationId: string;
  locationCode: string;
  locationName?: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
}

export interface LocalReceiptRecord {
  id: string;
  documentNumber: string | null;
  documentDate: string | null;
  receivedAt?: string | null;
  status: string;
  supplierId: string;
  supplierName: string;
  supplierDocument?: string | null;
  warehouseId: string;
  warehouseName: string;
  warehouseCode?: string;
  createdByName?: string;
  createdByEmail?: string | null;
  total: number;
  itemCount: number;
  createdAt: string;
  items?: LocalReceiptItemRecord[];
  offlinePending?: boolean;
}

export interface LocalTransferRecord {
  id: string;
  transferNumber: string;
  status: string;
  sourceWarehouseId: string;
  sourceWarehouseName: string;
  sourceLocationId: string;
  sourceLocationCode: string;
  destinationWarehouseId: string;
  destinationWarehouseName: string;
  destinationLocationId: string;
  destinationLocationCode: string;
  createdByName: string;
  itemCount: number;
  createdAt: string;
  offlinePending?: boolean;
}

export interface LocalReturnRecord {
  id: string;
  returnNumber: string;
  status: string;
  warehouseId: string;
  warehouseName: string;
  requestId?: string | null;
  requestNumber?: string | null;
  returnedByName: string;
  reason?: string | null;
  itemCount: number;
  createdAt: string;
  offlinePending?: boolean;
}

export interface LocalInventoryRecord {
  id: string;
  code: string;
  name: string;
  type?: string;
  status: string;
  warehouseId: string;
  warehouseName: string;
  createdByName: string;
  startedAt: string | null;
  finishedAt?: string | null;
  locations: { id: string; locationId: string; code: string; status: string }[];
  operators: { userId: string; name: string; email?: string | null }[];
  collections: { id: string; locationId: string; locationCode: string; operatorName: string; itemCount: number; startedAt: string | null }[];
  offlinePending?: boolean;
}

export interface OperationsSnapshotData {
  movements: LocalMovementRecord[];
  receipts: LocalReceiptRecord[];
  transfers: LocalTransferRecord[];
  returns: LocalReturnRecord[];
  inventories: LocalInventoryRecord[];
}

export interface UserContextSnapshotData {
  userId: string;
  name: string;
  email: string;
  roles: string[];
  permissions: string[];
  warehouses: { id: string; code: string; name: string }[];
  activeWarehouseId?: string;
  qrToken?: string | null;
}

export type SyncOperationType =
  | 'SUBMIT_COLLECTION'
  | 'CREATE_RECEIPT'
  | 'CONFIRM_RECEIPT'
  | 'CREATE_REQUEST'
  | 'CREATE_ADJUSTMENT'
  | 'CREATE_TRANSFER'
  | 'CREATE_RETURN'
  | 'CREATE_QUICK_ISSUE'
  | 'FULFILL_REQUEST'
  | 'REQUEST_STATUS'
  | 'CREATE_INVENTORY';

export interface SyncQueueTask {
  id?: number;
  operation: SyncOperationType;
  entityId: string;
  userId?: string;
  payload: Record<string, unknown>;
  status: 'PENDING' | 'SYNCING' | 'SYNCED' | 'ERROR' | 'CONFLICT';
  attempts: number;
  lastAttemptAt?: Date;
  error?: string;
  createdAt: Date;
  dependsOnEntityId?: string;
  clientTempId?: string;
}

export class EstokaLocalDB extends Dexie {
  products!: Table<LocalProduct, string>;
  inventories!: Table<LocalInventory, string>;
  syncQueue!: Table<SyncQueueTask, number>;
  snapshots!: Table<OfflineSnapshot, string>;
  collectorDrafts!: Table<CollectorDraft, string>;

  constructor() {
    super('EstokaLocalDB');
    this.version(1).stores({
      products: 'id, code, barcode, name',
      inventories: 'id, status',
      syncQueue: '++id, operation, status, createdAt'
    });
    this.version(2).stores({
      products: 'id, code, barcode, name',
      inventories: 'id, status',
      syncQueue: '++id, userId, operation, status, createdAt'
    });
    this.version(3).stores({
      products: 'id, code, barcode, name',
      inventories: 'id, status',
      syncQueue: '++id, userId, operation, status, createdAt',
      collectorSnapshots: 'id, userId, expiresAt'
    });
    this.version(4).stores({
      products: 'id, code, barcode, name',
      inventories: 'id, status',
      syncQueue: '++id, userId, operation, status, createdAt',
      collectorSnapshots: null,
      snapshots: 'id, userId, module, expiresAt'
    });
    this.version(5).stores({
      products: 'id, code, barcode, name',
      inventories: 'id, status',
      syncQueue: '++id, userId, operation, status, createdAt, entityId',
      snapshots: 'id, userId, module, expiresAt',
      collectorDrafts: 'id, userId, inventoryId, locationId, updatedAt'
    });
  }
}

export const localDb = typeof window !== 'undefined' ? new EstokaLocalDB() : null;
