import Dexie, { type Table } from 'dexie';

export interface LocalProduct {
  id: string;
  code: string;
  barcode: string | null;
  name: string;
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

export interface SyncQueueTask {
  id?: number;
  operation: 'SUBMIT_COLLECTION' | 'CREATE_RECEIPT';
  entityId: string;
  payload: Record<string, unknown>;
  status: 'PENDING' | 'SYNCING' | 'SYNCED' | 'ERROR';
  attempts: number;
  lastAttemptAt?: Date;
  error?: string;
  createdAt: Date;
}

export class EstokaLocalDB extends Dexie {
  products!: Table<LocalProduct, string>;
  inventories!: Table<LocalInventory, string>;
  syncQueue!: Table<SyncQueueTask, number>;

  constructor() {
    super('EstokaLocalDB');
    this.version(1).stores({
      products: 'id, code, barcode, name',
      inventories: 'id, status',
      syncQueue: '++id, operation, status, createdAt'
    });
  }
}

export const localDb = typeof window !== 'undefined' ? new EstokaLocalDB() : null;
