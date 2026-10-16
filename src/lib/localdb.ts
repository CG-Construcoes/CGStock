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
}

export interface LocalInventory {
  id: string;
  code: string;
  name: string;
  status: string;
  locations: LocalLocation[];
}

export interface LocalCollectionItem {
  productId: string;
  code: string;
  name: string;
  quantity: number;
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
  unitCode: string | null;
  categoryName: string | null;
}

export interface LocalWarehouse {
  id: string;
  code: string;
  name: string;
}

export interface LocalWarehouseLocation {
  id: string;
  warehouseId: string;
  code: string;
  name: string;
}

export interface LocalSupplier {
  id: string;
  name: string;
}

export interface CatalogSnapshotData {
  products: LocalCatalogProduct[];
  warehouses: LocalWarehouse[];
  locations: LocalWarehouseLocation[];
  suppliers: LocalSupplier[];
  units: { id: string; code: string; name: string }[];
}

export interface StockSnapshotData {
  items: { productId: string; warehouseId: string; locationId: string; quantity: number; reservedQuantity: number }[];
}

export interface RequestsSnapshotData {
  items: { id: string; requestNumber: string; status: string; createdAt: string; itemCount: number }[];
}

export interface SyncQueueTask {
  id?: number;
  operation: 'SUBMIT_COLLECTION' | 'CREATE_RECEIPT' | 'CREATE_REQUEST' | 'CREATE_ADJUSTMENT' | 'CREATE_TRANSFER' | 'CREATE_RETURN' | 'CREATE_QUICK_ISSUE' | 'FULFILL_REQUEST' | 'REQUEST_STATUS';
  entityId: string;
  userId?: string;
  payload: Record<string, unknown>;
  status: 'PENDING' | 'SYNCING' | 'SYNCED' | 'ERROR' | 'CONFLICT';
  attempts: number;
  lastAttemptAt?: Date;
  error?: string;
  createdAt: Date;
}

export class EstokaLocalDB extends Dexie {
  products!: Table<LocalProduct, string>;
  inventories!: Table<LocalInventory, string>;
  syncQueue!: Table<SyncQueueTask, number>;
  snapshots!: Table<OfflineSnapshot, string>;

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
  }
}

export const localDb = typeof window !== 'undefined' ? new EstokaLocalDB() : null;
