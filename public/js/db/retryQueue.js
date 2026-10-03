/**
 * Retry Queue for Multi-Database Sync
 * Stores failed operations in IndexedDB and provides methods to retry them.
 */
const DB_NAME = 'erp_sync_retry_db';
const STORE_NAME = 'failed_sync_queue';
const DB_VERSION = 1;

export class RetryQueue {
  constructor() {
    this.db = null;
    this.initPromise = this._initDB();
  }

  async _initDB() {
    if (typeof indexedDB === 'undefined') return;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = (e) => reject('IndexedDB error: ' + e.target.error);
      request.onsuccess = (e) => {
        this.db = e.target.result;
        resolve();
      };
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
          store.createIndex('dbId', 'dbId', { unique: false });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  /**
   * Add a failed operation to the queue
   * @param {Object} item 
   * { dbId, collection, docId, operation, data, error }
   */
  async enqueue(item) {
    await this.initPromise;
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const payload = {
        ...item,
        timestamp: new Date().toISOString(),
        retryCount: 0,
        status: 'PENDING'
      };
      const req = store.add(payload);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Get all pending items for a specific database (or all)
   */
  async getPending(dbId = null) {
    await this.initPromise;
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([STORE_NAME], 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        let results = req.result.filter(r => r.status === 'PENDING');
        if (dbId) results = results.filter(r => r.dbId === dbId);
        resolve(results.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)));
      };
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Remove an item from the queue
   */
  async remove(id) {
    await this.initPromise;
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Update retry count and status
   */
  async update(id, updates) {
    await this.initPromise;
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => {
        const data = { ...req.result, ...updates };
        const putReq = store.put(data);
        putReq.onsuccess = () => resolve(true);
        putReq.onerror = () => reject(putReq.error);
      };
      req.onerror = () => reject(req.error);
    });
  }
}

export const retryQueue = new RetryQueue();
