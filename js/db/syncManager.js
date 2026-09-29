import { FirebaseAdapter } from './adapters/firebaseAdapter.js';
import { SupabaseAdapter } from './adapters/supabaseAdapter.js';
import { retryQueue } from './retryQueue.js';

class SyncManager {
  constructor() {
    this.primaryAdapter = new FirebaseAdapter();
    this.secondaryAdapters = new Map(); // dbId -> adapter
    this.configLoaded = false;
  }

  /**
   * Load configurations from localStorage or secure Firestore collection
   */
  async loadConfig() {
    try {
      const stored = localStorage.getItem('erp_multi_db_config');
      if (stored) {
        const configs = JSON.parse(stored);
        this.secondaryAdapters.clear();
        configs.forEach(conf => {
          if (conf.enabled) {
            if (conf.type === 'SUPABASE') {
              this.secondaryAdapters.set(conf.id, new SupabaseAdapter(conf));
            }
            // Add other adapters here later
          }
        });
      }
      this.configLoaded = true;
    } catch (e) {
      console.error('Failed to load DB config', e);
    }
  }

  async _ensureConfig() {
    if (!this.configLoaded) {
      await this.loadConfig();
    }
  }

  /**
   * Save an entire table to Primary (Firebase), then Fan-out to Secondaries
   */
  async saveTable(collection, dataObj) {
    await this._ensureConfig();
    
    // 1. MUST succeed on Primary (Firebase)
    const primaryResult = await this.primaryAdapter.saveTable(collection, dataObj);
    if (!primaryResult.success) {
      // If primary fails, we throw to maintain the existing error handling (CloudSaveError)
      throw new Error(primaryResult.error || 'Primary database write failed');
    }

    // 2. Fan-out to secondaries asynchronously (Do not await to avoid blocking UI)
    this._fanoutTableSave(collection, dataObj);

    return primaryResult;
  }

  /**
   * Save a single record to Primary (Firebase), then Fan-out to Secondaries
   */
  async saveRecord(collection, docId, data) {
    await this._ensureConfig();

    const primaryResult = await this.primaryAdapter.saveRecord(collection, docId, data);
    if (!primaryResult.success) {
      throw new Error(primaryResult.error || 'Primary database write failed');
    }

    this._fanoutRecordSave(collection, docId, data);
    return primaryResult;
  }

  async _fanoutTableSave(collection, dataObj) {
    for (const [id, adapter] of this.secondaryAdapters.entries()) {
      if (!adapter.config.autoSync) continue;
      
      adapter.saveTable(collection, dataObj).then(res => {
        if (!res.success) {
          console.warn(`Sync failed for ${adapter.name} on ${collection}`);
          this._queueRetry(adapter, collection, null, 'SAVE_TABLE', dataObj, res.error);
        }
      }).catch(err => {
        this._queueRetry(adapter, collection, null, 'SAVE_TABLE', dataObj, err.message);
      });
    }
  }

  async _fanoutRecordSave(collection, docId, data) {
    for (const [id, adapter] of this.secondaryAdapters.entries()) {
      if (!adapter.config.autoSync) continue;

      adapter.saveRecord(collection, docId, data).then(res => {
        if (!res.success) {
          this._queueRetry(adapter, collection, docId, 'SAVE_RECORD', data, res.error);
        }
      }).catch(err => {
        this._queueRetry(adapter, collection, docId, 'SAVE_RECORD', data, err.message);
      });
    }
  }

  async _queueRetry(adapter, collection, docId, operation, data, error) {
    if (!adapter.config.retryEnabled) return;

    try {
      await retryQueue.enqueue({
        dbId: adapter.id,
        dbName: adapter.name,
        collection,
        docId,
        operation,
        data,
        error: error || 'Unknown error'
      });
    } catch (e) {
      console.error('Failed to queue retry:', e);
    }
  }

  /**
   * Process the retry queue
   */
  async processRetryQueue() {
    await this._ensureConfig();
    const pending = await retryQueue.getPending();
    for (const item of pending) {
      const adapter = this.secondaryAdapters.get(item.dbId);
      if (!adapter) continue; // Database removed or disabled

      try {
        let result = { success: false };
        if (item.operation === 'SAVE_TABLE') {
          result = await adapter.saveTable(item.collection, item.data);
        } else if (item.operation === 'SAVE_RECORD') {
          result = await adapter.saveRecord(item.collection, item.docId, item.data);
        }

        if (result.success) {
          await retryQueue.update(item.id, { status: 'SUCCESS', lastError: null });
        } else {
          await retryQueue.update(item.id, { 
            retryCount: item.retryCount + 1, 
            lastError: result.error 
          });
        }
      } catch (e) {
        await retryQueue.update(item.id, { 
          retryCount: item.retryCount + 1, 
          lastError: e.message 
        });
      }
    }
  }

  /**
   * Run a Full Initial Sync / Migration from Primary (Firebase) to a specific Secondary Database
   * Reads all tables from memory (which matches Firebase) and bulk-upserts to the backup.
   */
  async runFullSync(dbId) {
    await this._ensureConfig();
    const adapter = this.secondaryAdapters.get(dbId);
    if (!adapter) throw new Error('Database not found or disabled.');

    const { storage } = await import('./storage.js');
    const allData = storage.data;
    const tables = Object.keys(allData);
    
    let totalSuccess = 0;
    let totalFailed = 0;

    for (const tableName of tables) {
      const tableData = allData[tableName];
      if (!tableData || Object.keys(tableData).length === 0) continue;

      const result = await adapter.saveTable(tableName, tableData);
      if (result.success) {
        totalSuccess++;
      } else {
        totalFailed++;
        console.error(`Full Sync failed for table ${tableName} on ${adapter.name}:`, result.error);
        await this._queueRetry(adapter, tableName, null, 'SAVE_TABLE', tableData, result.error);
      }
    }

    if (totalFailed > 0) {
      throw new Error(`Sync completed with ${totalFailed} failed table(s).`);
    }

    // Update last sync time
    adapter.config.lastSync = new Date().toLocaleString();
    this._saveConfigs();
    
    return true;
  }

  _saveConfigs() {
    const configs = Array.from(this.secondaryAdapters.values()).map(a => a.config);
    localStorage.setItem('erp_multi_db_config', JSON.stringify(configs));
  }
}

export const syncManager = new SyncManager();
