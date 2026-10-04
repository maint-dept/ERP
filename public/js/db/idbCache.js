/**
 * Al-Muslim Group ERP — High-Capacity IndexedDB Cache Engine
 * Bypasses browser localStorage 5MB quota limit for large enterprise datasets
 * (Tool Allocations, Machine Inventories, Manpower Staff)
 */

const DB_NAME = 'al_muslim_erp_idb_cache';
const DB_VERSION = 1;
const STORE_NAME = 'tables';

class IDBCache {
  constructor() {
    this._db = null;
    this._initPromise = null;
  }

  async _getDB() {
    if (this._db) return this._db;
    if (typeof indexedDB === 'undefined') return null;

    if (!this._initPromise) {
      this._initPromise = new Promise((resolve) => {
        try {
          const req = indexedDB.open(DB_NAME, DB_VERSION);
          req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
              db.createObjectStore(STORE_NAME);
            }
          };
          req.onsuccess = (e) => {
            this._db = e.target.result;
            resolve(this._db);
          };
          req.onerror = () => {
            console.warn('[IDBCache] Open failed, fallback to memory');
            resolve(null);
          };
        } catch (_) {
          resolve(null);
        }
      });
    }
    return this._initPromise;
  }

  async setTable(tableName, data) {
    try {
      const db = await this._getDB();
      if (!db) return false;
      return new Promise((resolve) => {
        const tx = db.transaction([STORE_NAME], 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(data, tableName);
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      });
    } catch (_) {
      return false;
    }
  }

  async getTable(tableName) {
    try {
      const db = await this._getDB();
      if (!db) return null;
      return new Promise((resolve) => {
        const tx = db.transaction([STORE_NAME], 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(tableName);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch (_) {
      return null;
    }
  }

  async getAllTables() {
    try {
      const db = await this._getDB();
      if (!db) return {};
      return new Promise((resolve) => {
        const tx = db.transaction([STORE_NAME], 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.openCursor();
        const tables = {};
        req.onsuccess = (e) => {
          const cursor = e.target.result;
          if (cursor) {
            tables[cursor.key] = cursor.value;
            cursor.continue();
          } else {
            resolve(tables);
          }
        };
        req.onerror = () => resolve({});
      });
    } catch (_) {
      return {};
    }
  }
}

export const idbCache = new IDBCache();
