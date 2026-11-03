/**
 * Al-Muslim Group ERP — High-Capacity IndexedDB Cache Engine
 * Bypasses browser localStorage 5MB quota limit for large enterprise datasets
 * (Tool Allocations, Machine Inventories, Manpower Staff)
 * Enhanced with Automatic Closed Connection Recovery & Resilient Transaction Guards
 */

const DB_NAME = 'al_muslim_erp_idb_cache';
const DB_VERSION = 1;
const STORE_NAME = 'tables';

class IDBCache {
  constructor() {
    this._db = null;
    this._initPromise = null;
  }

  _resetConnection() {
    try {
      if (this._db) this._db.close();
    } catch (_) {}
    this._db = null;
    this._initPromise = null;
  }

  async _getDB(forceFresh = false) {
    if (forceFresh) {
      this._resetConnection();
    }
    if (this._db) return this._db;
    if (typeof indexedDB === 'undefined') return null;

    if (!this._initPromise) {
      this._initPromise = new Promise((resolve) => {
        const timer = setTimeout(() => {
          console.warn('[IDBCache] Open timeout (1500ms), fallback to memory/storage');
          this._initPromise = null;
          resolve(null);
        }, 1500);

        try {
          const req = indexedDB.open(DB_NAME, DB_VERSION);
          req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
              db.createObjectStore(STORE_NAME);
            }
          };
          req.onsuccess = (e) => {
            clearTimeout(timer);
            const db = e.target.result;
            db.onclose = () => {
              this._resetConnection();
            };
            db.onversionchange = () => {
              this._resetConnection();
            };
            this._db = db;
            resolve(this._db);
          };
          req.onerror = () => {
            clearTimeout(timer);
            this._resetConnection();
            resolve(null);
          };
          req.onblocked = () => {
            clearTimeout(timer);
            this._resetConnection();
            resolve(null);
          };
        } catch (_) {
          clearTimeout(timer);
          this._resetConnection();
          resolve(null);
        }
      });
    }
    return this._initPromise;
  }

  async setTable(tableName, data, isRetry = false) {
    try {
      const db = await this._getDB();
      if (!db) return false;
      return new Promise((resolve) => {
        try {
          const tx = db.transaction([STORE_NAME], 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          const req = store.put(data, tableName);
          req.onsuccess = () => resolve(true);
          req.onerror = () => resolve(false);
          tx.onabort = () => resolve(false);
        } catch (txErr) {
          if (!isRetry) {
            this._resetConnection();
            this.setTable(tableName, data, true).then(resolve).catch(() => resolve(false));
          } else {
            resolve(false);
          }
        }
      });
    } catch (_) {
      return false;
    }
  }

  async getTable(tableName, isRetry = false) {
    try {
      const db = await this._getDB();
      if (!db) return null;
      return new Promise((resolve) => {
        try {
          const tx = db.transaction([STORE_NAME], 'readonly');
          const store = tx.objectStore(STORE_NAME);
          const req = store.get(tableName);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => resolve(null);
          tx.onabort = () => resolve(null);
        } catch (txErr) {
          if (!isRetry) {
            this._resetConnection();
            this.getTable(tableName, true).then(resolve).catch(() => resolve(null));
          } else {
            resolve(null);
          }
        }
      });
    } catch (_) {
      return null;
    }
  }

  async getAllTables(isRetry = false) {
    try {
      const db = await this._getDB();
      if (!db) return {};
      return new Promise((resolve) => {
        const timer = setTimeout(() => {
          resolve({});
        }, 1500);

        try {
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
              clearTimeout(timer);
              resolve(tables);
            }
          };
          req.onerror = () => {
            clearTimeout(timer);
            resolve({});
          };
          tx.onabort = () => {
            clearTimeout(timer);
            resolve({});
          };
        } catch (txErr) {
          clearTimeout(timer);
          if (!isRetry) {
            this._resetConnection();
            this.getAllTables(true).then(resolve).catch(() => resolve({}));
          } else {
            resolve({});
          }
        }
      });
    } catch (_) {
      return {};
    }
  }
}

export const idbCache = new IDBCache();
