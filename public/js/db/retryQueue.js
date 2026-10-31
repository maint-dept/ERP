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
    this.initPromise = this._initDB().catch(e => {
      console.warn('[RetryQueue] IndexedDB unavailable, using fallback storage:', e);
    });
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
   * { dbId, collection, docId, operation, data, error, isFailover }
   */
  async enqueue(item) {
    try {
      await this.initPromise;
    } catch (_) { }

    if (!this.db) {
      try {
        const raw = localStorage.getItem('erp_sync_retry_queue_backup') || '[]';
        const list = JSON.parse(raw);
        const payload = {
          ...item,
          id: 'fb_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
          timestamp: new Date().toISOString(),
          retryCount: 0,
          status: 'PENDING'
        };
        list.push(payload);
        localStorage.setItem('erp_sync_retry_queue_backup', JSON.stringify(list));
        return payload.id;
      } catch (e) {
        return null;
      }
    }

    return new Promise((resolve) => {
      try {
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
        req.onerror = () => {
          // Fallback to localStorage on error
          try {
            const raw = localStorage.getItem('erp_sync_retry_queue_backup') || '[]';
            const list = JSON.parse(raw);
            list.push({ ...payload, id: 'fb_' + Date.now() });
            localStorage.setItem('erp_sync_retry_queue_backup', JSON.stringify(list));
          } catch (_) { }
          resolve(null);
        };
      } catch (err) {
        try {
          const raw = localStorage.getItem('erp_sync_retry_queue_backup') || '[]';
          const list = JSON.parse(raw);
          const payload = {
            ...item,
            id: 'fb_' + Date.now(),
            timestamp: new Date().toISOString(),
            retryCount: 0,
            status: 'PENDING'
          };
          list.push(payload);
          localStorage.setItem('erp_sync_retry_queue_backup', JSON.stringify(list));
          resolve(payload.id);
        } catch (_) {
          resolve(null);
        }
      }
    });
  }

  /**
   * Get all pending items for a specific database (or all)
   */
  async getPending(dbId = null) {
    try {
      await this.initPromise;
    } catch (_) { }

    let fallbackItems = [];
    try {
      const raw = localStorage.getItem('erp_sync_retry_queue_backup') || '[]';
      fallbackItems = JSON.parse(raw).filter(r => r.status === 'PENDING');
      if (dbId) fallbackItems = fallbackItems.filter(r => r.dbId === dbId);
    } catch (_) { }

    if (!this.db) {
      return fallbackItems.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    }

    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction([STORE_NAME], 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => {
          let results = req.result.filter(r => r.status === 'PENDING');
          if (dbId) results = results.filter(r => r.dbId === dbId);
          const combined = [...results, ...fallbackItems];
          resolve(combined.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)));
        };
        req.onerror = () => resolve(fallbackItems);
      } catch (_) {
        resolve(fallbackItems);
      }
    });
  }

  /**
   * Remove an item from the queue
   */
  async remove(id) {
    try {
      await this.initPromise;
    } catch (_) { }

    // Check localStorage fallback
    if (typeof id === 'string' && id.startsWith('fb_')) {
      try {
        const raw = localStorage.getItem('erp_sync_retry_queue_backup') || '[]';
        const list = JSON.parse(raw).filter(r => r.id !== id);
        localStorage.setItem('erp_sync_retry_queue_backup', JSON.stringify(list));
        return true;
      } catch (_) { }
    }

    if (!this.db) return true;

    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction([STORE_NAME], 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(id);
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      } catch (_) {
        resolve(false);
      }
    });
  }

  /**
   * Update retry count and status
   */
  async update(id, updates) {
    try {
      await this.initPromise;
    } catch (_) { }

    // Check localStorage fallback
    if (typeof id === 'string' && id.startsWith('fb_')) {
      try {
        const raw = localStorage.getItem('erp_sync_retry_queue_backup') || '[]';
        const list = JSON.parse(raw);
        const item = list.find(r => r.id === id);
        if (item) {
          Object.assign(item, updates);
          localStorage.setItem('erp_sync_retry_queue_backup', JSON.stringify(list));
        }
        return true;
      } catch (_) { }
    }

    if (!this.db) return true;

    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction([STORE_NAME], 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(id);
        req.onsuccess = () => {
          if (!req.result) return resolve(false);
          const data = { ...req.result, ...updates };
          const putReq = store.put(data);
          putReq.onsuccess = () => resolve(true);
          putReq.onerror = () => resolve(false);
        };
        req.onerror = () => resolve(false);
      } catch (_) {
        resolve(false);
      }
    });
  }
}

export const retryQueue = new RetryQueue();
