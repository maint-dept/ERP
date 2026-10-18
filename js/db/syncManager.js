import { MysqlAdapter }    from './adapters/mysqlAdapter.js';
import { PostgresAdapter } from './adapters/postgresAdapter.js';
import { retryQueue }      from './retryQueue.js';


class SyncManager {
  constructor() {
    this.primaryAdapter = new MysqlAdapter({
      id: 'mysql_primary',
      name: 'MySQL (maint_erp)',
      type: 'MYSQL',
      role: 'PRIMARY',
      endpoint: 'https://moviezonex.com/mysql_api.php',
      database: 'motaherh_maint-erp',
      username: 'motaherh_mainterp',
      password: 'Maint@456',
      retryEnabled: true,
      enabled: true,
      autoSync: true
    });
    this.primaryAdapter.id = 'mysql_primary';
    this.primaryAdapter.name = 'MySQL (maint_erp)';
    this.primaryAdapter.config = {
      id: 'mysql_primary',
      name: 'MySQL (maint_erp)',
      type: 'MYSQL',
      role: 'PRIMARY',
      endpoint: 'https://moviezonex.com/mysql_api.php',
      database: 'motaherh_maint-erp',
      username: 'motaherh_mainterp',
      password: 'Maint@456',
      retryEnabled: true,
      enabled: true,
      autoSync: true
    };
    this.secondaryAdapters = new Map(); // dbId -> adapter

    // Permanent Enterprise Secondary Backup Target (PostgreSQL)
    const defaultPg = new PostgresAdapter({
      id: 'db_postgresql_replica',
      name: 'PostgreSQL Database Connection',
      type: 'POSTGRESQL',
      role: 'BACKUP',
      host: '127.0.0.1',
      port: 5432,
      database: 'motaherh_Maintenance',
      username: 'motaherh_AMG-maint',
      password: 'ol(5_MK8mF{~7cdG',
      endpoint: 'https://moviezonex.com/api/pg_api.php',
      apiKey: '',
      ssl: false,
      enabled: true,
      autoSync: true,
      retryEnabled: true
    });
    defaultPg.id = 'db_postgresql_replica';
    defaultPg.name = 'PostgreSQL Database Connection';
    defaultPg.config = {
      id: 'db_postgresql_replica',
      name: 'PostgreSQL Database Connection',
      type: 'POSTGRESQL',
      role: 'BACKUP',
      host: '127.0.0.1',
      port: 5432,
      database: 'motaherh_Maintenance',
      username: 'motaherh_AMG-maint',
      password: 'ol(5_MK8mF{~7cdG',
      endpoint: 'https://moviezonex.com/api/pg_api.php',
      apiKey: '',
      ssl: false,
      enabled: true,
      autoSync: true,
      retryEnabled: true
    };
    this.secondaryAdapters.set('db_postgresql_replica', defaultPg);
    this.configLoaded = false;
  }

  /**
   * Load configurations from storage engine or localStorage.
   * Always clears old adapters and rebuilds fresh from latest saved configs.
   */
  async loadConfig() {
    try {
      let configs = [];
      if (typeof window !== 'undefined' && window.storage && typeof window.storage.getMultiDbConfigs === 'function') {
        configs = window.storage.getMultiDbConfigs();
      } else if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem('erp_multi_db_config');
        if (stored) {
          try { configs = JSON.parse(stored); } catch (_) {}
        }
      }

      // Always clear old adapters before rebuilding (prevents stale adapter bug)
      this.secondaryAdapters.clear();

      if (!configs || !Array.isArray(configs) || configs.length === 0) {
        configs = [
          this.primaryAdapter.config,
          {
            id: 'db_postgresql_replica',
            name: 'PostgreSQL Database Connection',
            type: 'POSTGRESQL',
            role: 'BACKUP',
            host: '127.0.0.1',
            port: 5432,
            database: 'motaherh_Maintenance',
            username: 'motaherh_AMG-maint',
            password: 'ol(5_MK8mF{~7cdG',
            endpoint: 'https://moviezonex.com/api/pg_api.php',
            apiKey: '',
            ssl: false,
            enabled: true,
            autoSync: true,
            retryEnabled: true,
            updatedAt: new Date().toISOString()
          }
        ];
      }

      // Guarantee PostgreSQL secondary backup replica is ALWAYS present and active
      const hasPg = configs.some(c => (c.type || '').toUpperCase() === 'POSTGRESQL' || (c.type || '').toUpperCase() === 'POSTGRES');
      if (!hasPg) {
        configs.push({
          id: 'db_postgresql_replica',
          name: 'PostgreSQL Database Connection',
          type: 'POSTGRESQL',
          role: 'BACKUP',
          host: '127.0.0.1',
          port: 5432,
          database: 'motaherh_Maintenance',
          username: 'motaherh_AMG-maint',
          password: 'ol(5_MK8mF{~7cdG',
          endpoint: 'https://moviezonex.com/api/pg_api.php',
          apiKey: '',
          ssl: false,
          enabled: true,
          autoSync: true,
          retryEnabled: true,
          updatedAt: new Date().toISOString()
        });
      }

      if (configs && Array.isArray(configs)) {
        configs.forEach(conf => {
          if (conf && conf.enabled) {
            let adapter = null;
            const t = (conf.type || '').toUpperCase();
            if (t === 'MYSQL') {
              let ep = (conf.endpoint || '').trim().replace(/\/$/, '');
              if (!ep || ep === 'api/mysql_api.php' || ep === '/api/mysql_api.php' || ep.includes('://api/mysql_api.php') || ep === '/api/db/mysql' || (ep.includes('api/mysql_api.php') && !ep.startsWith('http'))) {
                ep = 'https://moviezonex.com/mysql_api.php';
              } else if (!/^https?:\/\//i.test(ep) && typeof window !== 'undefined' && window.location && (window.location.hostname.includes('github.io') || window.location.hostname.includes('moviezonex.com'))) {
                ep = 'https://moviezonex.com/mysql_api.php';
              }
              conf.endpoint = ep;
              if (!conf.database || conf.database === 'al_muslim_erp' || conf.database === 'maint_erp') conf.database = 'motaherh_maint-erp';
              if (!conf.username || conf.username === 'mainterp') conf.username = 'motaherh_mainterp';
              if (!conf.password) conf.password = 'Maint@456';
              adapter = new MysqlAdapter(conf);
            } else if (t === 'POSTGRESQL' || t === 'POSTGRES') {
              let ep = (conf.endpoint || '').trim().replace(/\/$/, '');
              if (!ep || ep === 'api/pg_api.php' || ep === '/api/pg_api.php' || ep.includes('://api/pg_api.php') || ep === '/api/db/pg' || (ep.includes('api/pg_api.php') && !ep.startsWith('http'))) {
                if (typeof window !== 'undefined' && window.location && (window.location.hostname.includes('github.io') || window.location.hostname.includes('moviezonex.com'))) {
                  ep = 'https://moviezonex.com/api/pg_api.php';
                }
              } else if (!/^https?:\/\//i.test(ep) && !ep.startsWith('/')) {
                ep = 'https://' + ep;
              }
              conf.endpoint = ep || 'https://moviezonex.com/api/pg_api.php';
              conf.id = 'db_postgresql_replica';
              conf.name = conf.name || 'PostgreSQL Database Connection';
              conf.role = 'BACKUP';
              if (!conf.host) conf.host = '127.0.0.1';
              if (!conf.port) conf.port = 5432;
              if (!conf.database || conf.database === 'motaherh_maint_pg') conf.database = 'motaherh_Maintenance';
              if (!conf.username || conf.username === 'motaherh_pguser') conf.username = 'motaherh_AMG-maint';
              if (!conf.password) conf.password = 'ol(5_MK8mF{~7cdG';
              conf.enabled = true;
              conf.autoSync = true;
              conf.retryEnabled = true;
              adapter = new PostgresAdapter(conf);
            }

            if (adapter) {
              // If configured as PRIMARY, assign as primaryAdapter
              if (conf.role === 'PRIMARY') {
                adapter.id = conf.id;
                adapter.name = conf.name || `${conf.type} Primary`;
                adapter.config = {
                  ...conf,
                  retryEnabled: conf.retryEnabled !== false,
                  autoSync: true,
                  enabled: true
                };
                this.primaryAdapter = adapter;
              } else {
                this.secondaryAdapters.set(conf.id, adapter);
              }
            }
          }
        });
        try { localStorage.setItem('erp_multi_db_config', JSON.stringify(configs)); } catch (_) {}
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
   * Force a fresh reload of all secondary adapter configs.
   * Call this whenever configs are saved, updated, or deleted.
   */
  async reloadConfig() {
    this.configLoaded = false;
    await this.loadConfig();
  }

  getPostgresAdapter() {
    return this.secondaryAdapters.get('db_postgresql_replica') || 
      Array.from(this.secondaryAdapters.values()).find(a => (a.type || '').toUpperCase() === 'POSTGRESQL' || (a.type || '').toUpperCase() === 'POSTGRES') ||
      null;
  }

  async saveMultipleTables(tablesObj) {
    await this._ensureConfig();
    
    // 1. Try Primary (MySQL)
    let primarySuccess = false;
    let primaryResult = null;
    try {
      if (this.primaryAdapter && this.primaryAdapter.saveMultipleTables) {
        primaryResult = await this.primaryAdapter.saveMultipleTables(tablesObj);
        if (primaryResult && primaryResult.success) {
          primarySuccess = true;
          for (const [collection, dataObj] of Object.entries(tablesObj)) {
             this._fanoutTableSave(collection, dataObj);
          }
          return primaryResult;
        }
      }
    } catch (e) {
      console.warn('[SyncManager] Primary MySQL saveMultipleTables exception:', e.message);
    }

    // 2. PRIMARY FAILED -> Automatic Failover to PostgreSQL Secondary Backup Replica
    console.warn(`[SyncManager] ⚠️ Primary MySQL unavailable. Initiating automatic failover to PostgreSQL Secondary Replica...`);
    
    // Queue retry for primary MySQL so all tables are synced to MySQL when it recovers
    if (this.primaryAdapter) {
      for (const [collection, dataObj] of Object.entries(tablesObj)) {
        this._queueRetry(this.primaryAdapter, collection, null, 'SAVE_TABLE', dataObj, 'Primary MySQL was unavailable during multi-table save');
      }
    }

    const pgAdapter = this.getPostgresAdapter();
    if (pgAdapter && typeof pgAdapter.saveMultipleTables === 'function') {
      try {
        const failoverResult = await pgAdapter.saveMultipleTables(tablesObj);
        if (failoverResult && failoverResult.success) {
          console.log(`[SyncManager] 🐘 Failover save to PostgreSQL successful! Data preserved in backup replica.`);
          this._recordMetric(pgAdapter.id, { lastSyncTime: new Date().toLocaleString(), failed: 0 });
          for (const [collection, dataObj] of Object.entries(tablesObj)) {
            this._fanoutTableSave(collection, dataObj, pgAdapter.id);
          }
          return failoverResult;
        }
      } catch (pgErr) {
        console.error('[SyncManager] PostgreSQL failover write error:', pgErr.message);
      }
    }

    // 3. Fallback table by table
    let result = { success: true };
    for (const [collection, dataObj] of Object.entries(tablesObj)) {
       const res = await this.saveTable(collection, dataObj);
       if (!res.success) result = res;
    }
    return result;
  }

  /**
   * Save an entire table to Primary (MySQL), then Fan-out to Secondaries
   */
  async saveTable(collection, dataObj) {
    await this._ensureConfig();

    // 1. Try Primary
    const primaryResult = await this.primaryAdapter.saveTable(collection, dataObj);
    if (primaryResult.success) {
      this._fanoutTableSave(collection, dataObj);
      return primaryResult;
    }

    // 2. PRIMARY FAILED -> Initiate Automatic Failover
    console.warn(`Primary DB failed on ${collection}. Initiating automatic failover...`);
    this._queueRetry(this.primaryAdapter, collection, null, 'SAVE_TABLE', dataObj, primaryResult.error);

    for (const [id, adapter] of this.secondaryAdapters.entries()) {
      if (!adapter.config.enabled) continue;

      const failoverResult = await adapter.saveTable(collection, dataObj);
      if (failoverResult.success) {
        console.log(`✅ Failover successful on ${adapter.name}`);
        this._fanoutTableSave(collection, dataObj, id); // Fan out to the rest
        return failoverResult;
      } else {
        this._queueRetry(adapter, collection, null, 'SAVE_TABLE', dataObj, failoverResult.error);
      }
    }

    throw new Error('CRITICAL: Primary and all Secondary databases failed to write.');
  }

  /**
   * Save a single record to Primary (MySQL), then Fan-out to Secondaries
   */
  async saveRecord(collection, docId, data) {
    await this._ensureConfig();

    // 1. Try Primary
    const primaryResult = await this.primaryAdapter.saveRecord(collection, docId, data);
    if (primaryResult.success) {
      this._fanoutRecordSave(collection, docId, data);
      return primaryResult;
    }

    // 2. PRIMARY FAILED -> Initiate Automatic Failover
    console.warn(`Primary DB failed on record ${docId}. Initiating failover...`);
    this._queueRetry(this.primaryAdapter, collection, docId, 'SAVE_RECORD', data, primaryResult.error);

    for (const [id, adapter] of this.secondaryAdapters.entries()) {
      if (!adapter.config.enabled) continue;

      const failoverResult = await adapter.saveRecord(collection, docId, data);
      if (failoverResult.success) {
        console.log(`✅ Failover successful on ${adapter.name}`);
        this._fanoutRecordSave(collection, docId, data, id); // Fan out to the rest
        return failoverResult;
      } else {
        this._queueRetry(adapter, collection, docId, 'SAVE_RECORD', data, failoverResult.error);
      }
    }

    throw new Error('CRITICAL: Primary and all Secondary databases failed to write.');
  }

  async _fanoutTableSave(collection, dataObj, excludeDbId = null) {
    for (const [id, adapter] of this.secondaryAdapters.entries()) {
      // Primary gate: adapter must be enabled
      if (!adapter.config.enabled || id === excludeDbId) continue;
      // Secondary gate: real-time auto-sync must be ON
      if (adapter.config.autoSync === false) continue;

      adapter.saveTable(collection, dataObj).then(res => {
        if (!res.success) {
          console.warn(`[SyncManager] Fan-out failed for ${adapter.name} on ${collection}: ${res.error}`);
          this._queueRetry(adapter, collection, null, 'SAVE_TABLE', dataObj, res.error);
        } else {
          if (adapter.config) adapter.config.lastSync = new Date().toLocaleString();
          this._recordMetric(id, { lastSyncTime: new Date().toLocaleString() });
        }
      }).catch(err => {
        this._queueRetry(adapter, collection, null, 'SAVE_TABLE', dataObj, err.message);
      });
    }
  }

  async _fanoutRecordSave(collection, docId, data, excludeDbId = null) {
    for (const [id, adapter] of this.secondaryAdapters.entries()) {
      if (!adapter.config.enabled || id === excludeDbId) continue;
      if (adapter.config.autoSync === false) continue;

      adapter.saveRecord(collection, docId, data).then(res => {
        if (!res.success) {
          this._queueRetry(adapter, collection, docId, 'SAVE_RECORD', data, res.error);
        } else {
          if (adapter.config) adapter.config.lastSync = new Date().toLocaleString();
          this._recordMetric(id, { lastSyncTime: new Date().toLocaleString() });
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
      let adapter = this.secondaryAdapters.get(item.dbId);
      if (item.dbId === 'default_fb' || (this.primaryAdapter && (item.dbId === this.primaryAdapter.id || item.dbId === 'mysql_primary'))) {
        adapter = this.primaryAdapter;
      }

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
  /**
   * Run a Full Initial Sync / Migration from Primary (MySQL) to a specific Secondary Database.
   * Reads all tables from in-memory storage (mirrors MySQL Primary) and bulk-upserts to the target.
   * Uses 1-shot batch sync (saveMultipleTables) when available for 10x faster migration.
   */
  async runFullSync(dbId) {
    await this._ensureConfig();
    let adapter = this.secondaryAdapters.get(dbId);
    if (!adapter && this.primaryAdapter && (this.primaryAdapter.id === dbId || dbId === 'mysql_primary')) {
      adapter = this.primaryAdapter;
    }
    if (!adapter) throw new Error('Database not found or disabled. Make sure the database is enabled and config is saved.');

    const { storage } = await import('./storage.js');
    const allData = storage.data || {};

    // Filter valid non-empty tables to sync
    const validTables = {};
    for (const [tName, tData] of Object.entries(allData)) {
      if (tData === null || tData === undefined) continue;
      if (Array.isArray(tData) && tData.length === 0) continue;
      if (!Array.isArray(tData) && typeof tData === 'object' && Object.keys(tData).length === 0) continue;
      validTables[tName] = tData;
    }

    const totalRecords = this._getTotalRecordCount(validTables);

    // 1. FAST BATCH SYNC: If adapter supports saveMultipleTables, sync all tables in 1 shot
    if (typeof adapter.saveMultipleTables === 'function' && Object.keys(validTables).length > 0) {
      try {
        console.log(`[SyncManager] ⚡ Attempting fast batch sync to ${adapter.name} (${Object.keys(validTables).length} tables)...`);
        const batchResult = await adapter.saveMultipleTables(validTables);
        if (batchResult && batchResult.success) {
          if (adapter.config) {
            adapter.config.lastSync = new Date().toLocaleString();
          }
          this._saveConfigs();
          this._recordMetric(dbId, {
            matched: totalRecords,
            missing: 0,
            failed: 0,
            duplicates: 0,
            lastSyncTime: new Date().toLocaleString(),
            lastError: null
          });
          return true;
        }

        const errStr = (batchResult?.error || '').toLowerCase();
        const isAuthOrFatal = errStr.includes('authentication') ||
          errStr.includes('password') ||
          errStr.includes('access denied') ||
          errStr.includes('pg_hba') ||
          errStr.includes('no encryption') ||
          errStr.includes('cannot reach') ||
          errStr.includes('http 500') ||
          errStr.includes('failed: http') ||
          errStr.includes('connection failed') ||
          errStr.includes('sqlstate') ||
          errStr.includes('fatal');

        if (isAuthOrFatal) {
          throw new Error(batchResult.error);
        }
        console.warn(`[SyncManager] Batch sync unconfirmed (${batchResult?.error}), trying sequential fallback...`);
      } catch (batchErr) {
        const errStr = (batchErr.message || '').toLowerCase();
        const isAuthOrFatal = errStr.includes('authentication') ||
          errStr.includes('password') ||
          errStr.includes('access denied') ||
          errStr.includes('pg_hba') ||
          errStr.includes('no encryption') ||
          errStr.includes('cannot reach') ||
          errStr.includes('http 500') ||
          errStr.includes('failed: http') ||
          errStr.includes('connection failed') ||
          errStr.includes('sqlstate') ||
          errStr.includes('fatal');

        if (isAuthOrFatal) {
          throw batchErr;
        }
        console.warn(`[SyncManager] Batch sync threw (${batchErr.message}), trying sequential fallback...`);
      }
    }

    // 2. SEQUENTIAL FALLBACK: Table-by-table sync
    let totalSuccess = 0;
    let totalFailed  = 0;

    for (const [tableName, tableData] of Object.entries(validTables)) {
      const result = await adapter.saveTable(tableName, tableData);
      if (result && result.success) {
        totalSuccess++;
      } else {
        totalFailed++;
        console.error(`[SyncManager] Sync failed for table "${tableName}" on "${adapter.name}":`, result?.error);

        // Abort early on fatal / unrecoverable errors
        const errStr = (result?.error || '').toLowerCase();
        const isFatal = result?.isTableMissing || result?.isAuthError ||
          errStr.includes('not found')        ||
          errStr.includes('authentication')   ||
          errStr.includes('password')         ||
          errStr.includes('access denied')    ||
          errStr.includes('pg_hba')           ||
          errStr.includes('failed to fetch')  ||
          errStr.includes('network')          ||
          errStr.includes('cors')             ||
          errStr.includes('blocked')          ||
          errStr.includes('permission denied') ||
          errStr.includes('unauthorized')     ||
          errStr.includes('cannot reach')     ||
          errStr.includes('consumer_invalid') ||
          errStr.includes('invalid')          ||
          errStr.includes('http 500')         ||
          errStr.includes('failed: http')     ||
          errStr.includes('connection failed')||
          errStr.includes('save-table failed')||
          errStr.includes('sqlstate')         ||
          errStr.includes('fatal');

        if (isFatal) {
          throw new Error(result?.error || 'Database sync failed: fatal connection or credential error.');
        }

        await this._queueRetry(adapter, tableName, null, 'SAVE_TABLE', tableData, result?.error);
      }
    }

    if (totalFailed > 0) {
      throw new Error(`Sync completed with ${totalFailed} failed table(s). Check console for details.`);
    }

    // Persist updated lastSync timestamp back into config
    if (adapter.config) {
      adapter.config.lastSync = new Date().toLocaleString();
    }
    this._saveConfigs();
    this._recordMetric(dbId, {
      matched: totalRecords,
      missing: 0,
      failed: 0,
      duplicates: 0,
      lastSyncTime: new Date().toLocaleString(),
      lastError: null
    });

    return true;
  }

  _getTotalRecordCount(dataObj) {
    let count = 0;
    for (const k in dataObj || {}) {
      const val = dataObj[k];
      if (Array.isArray(val)) count += val.length;
      else if (val && typeof val === 'object') count += Object.keys(val).length;
    }
    return count;
  }

  _recordMetric(dbId, patch) {
    try {
      if (typeof localStorage === 'undefined') return;
      const raw = localStorage.getItem('erp_data_engine_sync_metrics');
      const metrics = raw ? JSON.parse(raw) : {};
      metrics[dbId] = { ...(metrics[dbId] || {}), ...patch, lastUpdated: new Date().toISOString() };
      localStorage.setItem('erp_data_engine_sync_metrics', JSON.stringify(metrics));
    } catch (_) {}
  }

  /**
   * Start the Background Auto-Sync Engine.
   * Periodically checks secondary databases and automatically reconciles/syncs
   * any secondary database that is enabled, pending, or desynchronized.
   */
  startAutoSyncEngine(intervalMs = 45000) {
    if (this._autoSyncTimer) {
      clearInterval(this._autoSyncTimer);
      this._autoSyncTimer = null;
    }

    // Initial background sync check 3 seconds after boot
    if (typeof setTimeout !== 'undefined') {
      setTimeout(() => {
        this.triggerAutoSync({ silent: true }).catch(() => {});
      }, 3500);
    }

    // Recurring sync check
    if (typeof setInterval !== 'undefined') {
      this._autoSyncTimer = setInterval(() => {
        this.triggerAutoSync({ silent: true }).catch(() => {});
      }, intervalMs);
    }
  }

  /**
   * Trigger an Auto-Sync run across all enabled secondary databases.
   */
  async triggerAutoSync(options = {}) {
    if (this._isAutoSyncRunning) return false;
    this._isAutoSyncRunning = true;

    try {
      await this._ensureConfig();

      // Check global autoSync preference
      let isAutoSyncEnabled = true;
      try {
        if (typeof localStorage !== 'undefined') {
          const stored = localStorage.getItem('erp_data_engine_sync_state');
          if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed.autoSync === false) isAutoSyncEnabled = false;
          }
        }
      } catch (_) {}

      if (!isAutoSyncEnabled) return false;

      let metrics = {};
      try {
        if (typeof localStorage !== 'undefined') {
          const mStored = localStorage.getItem('erp_data_engine_sync_metrics');
          if (mStored) metrics = JSON.parse(mStored) || {};
        }
      } catch (_) {}

      let syncedAny = false;

      for (const [id, adapter] of this.secondaryAdapters.entries()) {
        if (!adapter.config || !adapter.config.enabled || adapter.config.autoSync === false) continue;

        const m = metrics[id];
        // Condition to auto-sync:
        // 1. Never synced yet (no lastUpdated or status was PENDING)
        // 2. Has missing records (missing > 0)
        const isPending = !m || !m.lastUpdated || m.matched === undefined;
        const hasMissing = m && m.missing && m.missing > 0;

        if (isPending || hasMissing) {
          try {
            console.log(`[AutoSync Engine] 🔄 Auto-syncing secondary replica "${adapter.name}" (${id})...`);
            await this.runFullSync(id);
            syncedAny = true;
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('erp-database-sync-updated', { detail: { dbId: id, status: 'SYNCED' } }));
            }
          } catch (err) {
            console.warn(`[AutoSync Engine] ⚠️ Auto-sync notice for "${adapter.name}":`, err.message);
            this._recordMetric(id, {
              failed: 1,
              lastSyncTime: new Date().toLocaleString(),
              lastError: err.message
            });
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('erp-database-sync-updated', { detail: { dbId: id, status: 'FAILED', error: err.message } }));
            }
          }
        }
      }

      // Also process retry queue
      await this.processRetryQueue().catch(() => {});

      return syncedAny;
    } finally {
      this._isAutoSyncRunning = false;
    }
  }

  _saveConfigs() {
    const configs = [];
    if (this.primaryAdapter && this.primaryAdapter.config && this.primaryAdapter.config.role === 'PRIMARY') {
      configs.push(this.primaryAdapter.config);
    }
    for (const a of this.secondaryAdapters.values()) {
      if (a.config) configs.push(a.config);
    }
    if (typeof window !== 'undefined' && window.storage && typeof window.storage.saveMultiDbConfigs === 'function') {
      window.storage.saveMultiDbConfigs(configs).catch(() => {});
    } else {
      try { localStorage.setItem('erp_multi_db_config', JSON.stringify(configs)); } catch (_) {}
    }
  }
}

export const syncManager = new SyncManager();
