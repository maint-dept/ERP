import { MysqlAdapter } from './adapters/mysqlAdapter.js';
import { PostgresAdapter } from './adapters/postgresAdapter.js';
import { retryQueue } from './retryQueue.js';


class SyncManager {
  constructor() {
    const defaultMysqlEndpoint = (typeof window !== 'undefined' && window.location && window.location.hostname === 'erp.moviezonex.com')
      ? (window.location.origin + '/mysql_api.php')
      : 'https://erp.moviezonex.com/mysql_api.php';

    this.primaryAdapter = new MysqlAdapter({
      id: 'mysql_primary',
      name: 'MySQL (maint_erp)',
      type: 'MYSQL',
      role: 'PRIMARY',
      endpoint: defaultMysqlEndpoint,
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
      endpoint: defaultMysqlEndpoint,
      database: 'motaherh_maint-erp',
      username: 'motaherh_mainterp',
      password: 'Maint@456',
      retryEnabled: true,
      enabled: true,
      autoSync: true
    };
    this.secondaryAdapters = new Map(); // dbId -> adapter

    const defaultPgEndpoint = (typeof window !== 'undefined' && window.location && window.location.hostname === 'erp.moviezonex.com')
      ? (window.location.origin + '/api/pg_api.php')
      : 'https://erp.moviezonex.com/api/pg_api.php';

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
      endpoint: defaultPgEndpoint,
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
      endpoint: defaultPgEndpoint,
      apiKey: '',
      ssl: false,
      enabled: true,
      autoSync: true,
      retryEnabled: true
    };
    this.secondaryAdapters.set('db_postgresql_replica', defaultPg);
    this.configLoaded = false;

    // Enterprise Automatic Failover & Recovery System
    this.isFailoverActive = (typeof localStorage !== 'undefined' && localStorage.getItem('erp_db_failover_active') === 'true');
    this.failoverReason = (typeof localStorage !== 'undefined' && localStorage.getItem('erp_db_failover_reason')) || '';
    this.failoverStartTime = (typeof localStorage !== 'undefined' && localStorage.getItem('erp_db_failover_started_at')) || null;
    this.isRecoveryPending = (typeof localStorage !== 'undefined' && localStorage.getItem('erp_db_recovery_pending') === 'true');
    this.recoveryPendingCount = Number((typeof localStorage !== 'undefined' && localStorage.getItem('erp_db_recovery_pending_count')) || 0);

    let savedTables = [];
    try {
      if (typeof localStorage !== 'undefined') {
        savedTables = JSON.parse(localStorage.getItem('erp_db_failover_tables') || '[]');
      }
    } catch (_) { }
    this.failoverModifiedTables = new Set(Array.isArray(savedTables) ? savedTables : []);

    // Track individual modified records for strict Row-Level Upsert
    let savedRecords = [];
    try {
      if (typeof localStorage !== 'undefined') {
        savedRecords = JSON.parse(localStorage.getItem('erp_db_failover_records') || '[]');
      }
    } catch (_) { }
    this.failoverModifiedRecords = new Map();
    if (Array.isArray(savedRecords)) {
      savedRecords.forEach(r => {
        if (r && r.collection && r.docId) {
          this.failoverModifiedRecords.set(`${r.collection}:${r.docId}`, r);
        }
      });
    }

    this._recoveryProbeTimer = null;
    this._isRecovering = false;
    this._recoveryProbeIntervalMs = 7000;

    if (this.isFailoverActive) {
      // Proactively test if MySQL Primary is healthy on startup to clear stale failovers
      setTimeout(() => {
        this.checkPrimaryRecovery().catch(() => {});
      }, 500);
      this._startRecoveryProbe();
    }
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
          try { configs = JSON.parse(stored); } catch (_) { }
        }
      }

      // Always clear old adapters before rebuilding (prevents stale adapter bug)
      this.secondaryAdapters.clear();

      const defaultMysqlEndpoint = (typeof window !== 'undefined' && window.location && window.location.hostname === 'erp.moviezonex.com')
        ? (window.location.origin + '/mysql_api.php')
        : 'https://erp.moviezonex.com/mysql_api.php';
      const defaultPgEndpoint = (typeof window !== 'undefined' && window.location && window.location.hostname === 'erp.moviezonex.com')
        ? (window.location.origin + '/api/pg_api.php')
        : 'https://erp.moviezonex.com/api/pg_api.php';

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
            endpoint: defaultPgEndpoint,
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
          endpoint: defaultPgEndpoint,
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
              if (typeof window !== 'undefined' && window.location && window.location.hostname.includes('moviezonex.com')) {
                ep = window.location.origin + '/mysql_api.php';
              } else if (!ep || ep === '/api/db/mysql' || ep === 'mysql_api.php' || ep === '/mysql_api.php' || ep === 'api/mysql_api.php' || ep === '/api/mysql_api.php') {
                ep = defaultMysqlEndpoint;
              } else if (!/^https?:\/\//i.test(ep)) {
                ep = (typeof window !== 'undefined' && window.location?.protocol ? window.location.protocol : 'https:') + '//' + ep;
              }
              conf.endpoint = ep;
              if (!conf.database) conf.database = 'motaherh_maint-erp';
              if (!conf.username) conf.username = 'motaherh_mainterp';
              if (conf.password === undefined || conf.password === null) conf.password = 'Maint@456';
              adapter = new MysqlAdapter(conf);
            } else if (t === 'POSTGRESQL' || t === 'POSTGRES') {
              let ep = (conf.endpoint || '').trim().replace(/\/$/, '');
              if (typeof window !== 'undefined' && window.location && window.location.hostname.includes('moviezonex.com')) {
                ep = window.location.origin + '/api/pg_api.php';
              } else if (!ep || ep === 'api/pg_api.php' || ep === '/api/pg_api.php' || ep.includes('://api/pg_api.php') || ep === '/api/db/pg' || (ep.includes('api/pg_api.php') && !ep.startsWith('http'))) {
                ep = defaultPgEndpoint;
              } else if (!/^https?:\/\//i.test(ep) && !ep.startsWith('/')) {
                ep = (typeof window !== 'undefined' && window.location?.protocol ? window.location.protocol : 'https:') + '//' + ep;
              }
              conf.endpoint = ep || defaultPgEndpoint;
              conf.id = conf.id || 'db_postgresql_replica';
              conf.name = conf.name || 'PostgreSQL Database Connection';
              conf.role = conf.role || 'BACKUP';
              if (!conf.host) conf.host = '127.0.0.1';
              if (!conf.port) conf.port = 5432;
              if (conf.id === 'db_postgresql_replica') {
                if (!conf.database || conf.database === 'motaherh_maint_pg') conf.database = 'motaherh_Maintenance';
                if (!conf.username || conf.username === 'motaherh_pguser') conf.username = 'motaherh_AMG-maint';
                if (!conf.password) conf.password = 'ol(5_MK8mF{~7cdG';
              }
              if (conf.enabled === undefined) conf.enabled = true;
              if (conf.autoSync === undefined) conf.autoSync = true;
              if (conf.retryEnabled === undefined) conf.retryEnabled = true;
              adapter = new PostgresAdapter(conf);
            }

            if (adapter) {
              // If configured as PRIMARY, assign as primaryAdapter
              if (conf.role === 'PRIMARY' || conf.id === 'mysql_primary') {
                adapter.id = conf.id || 'mysql_primary';
                adapter.name = conf.name || `${conf.type} Primary`;
                adapter.config = {
                  ...conf,
                  id: conf.id || 'mysql_primary',
                  role: 'PRIMARY',
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
        try { localStorage.setItem('erp_multi_db_config', JSON.stringify(configs)); } catch (_) { }
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

  /**
   * Set Failover Mode Active / Inactive
   * When Active: all reads and writes are directed safely to PostgreSQL replica.
   */
  setFailoverMode(active, reason = '') {
    const prev = this.isFailoverActive;
    this.isFailoverActive = Boolean(active);

    if (this.isFailoverActive) {
      this.failoverReason = reason || this.failoverReason || 'MySQL Primary unreachable';
      if (!this.failoverStartTime) this.failoverStartTime = new Date().toISOString();
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('erp_db_failover_active', 'true');
          localStorage.setItem('erp_db_failover_reason', this.failoverReason);
          localStorage.setItem('erp_db_failover_started_at', this.failoverStartTime);
        }
      } catch (_) { }
      this._startRecoveryProbe();
      console.warn(`[SyncManager Failover] ⚠️ ENTERPRISE FAILOVER ACTIVATED: All read/write operations routed to PostgreSQL replica. (${this.failoverReason})`);
    } else {
      this.failoverReason = '';
      this.failoverStartTime = null;
      this.isRecoveryPending = false;
      this.recoveryPendingCount = 0;
      this.failoverModifiedTables.clear();
      if (this.failoverModifiedRecords) this.failoverModifiedRecords.clear();
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem('erp_db_failover_active');
          localStorage.removeItem('erp_db_failover_reason');
          localStorage.removeItem('erp_db_failover_started_at');
          localStorage.removeItem('erp_db_failover_tables');
          localStorage.removeItem('erp_db_failover_records');
          localStorage.removeItem('erp_db_failover_last_write');
          localStorage.removeItem('erp_db_recovery_pending');
          localStorage.removeItem('erp_db_recovery_pending_count');
        }
      } catch (_) { }
      this._stopRecoveryProbe();
      console.log(`[SyncManager Failover] 🐬 ENTERPRISE FAILOVER DEACTIVATED: Primary operational traffic restored to MySQL.`);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('erp:failover-status-changed', {
        detail: {
          isFailover: this.isFailoverActive,
          reason: this.failoverReason,
          modifiedTables: Array.from(this.failoverModifiedTables)
        }
      }));
    }
  }

  /**
   * Track which tables and individual rows have been modified while operating in Failover Mode
   */
  trackFailoverModification(table, docId = null, data = null) {
    if (!table) return;
    this.failoverModifiedTables.add(table);

    if (docId && data) {
      this.trackFailoverRecord(table, docId, data);
    } else if (data && typeof data === 'object') {
      if (Array.isArray(data)) {
        data.forEach(item => {
          const rId = item.id || item._id || item.serialNumber || item.machineId;
          if (rId) this.trackFailoverRecord(table, rId, item);
        });
      } else {
        const rId = data.id || data._id || data.serialNumber || data.machineId;
        if (rId) this.trackFailoverRecord(table, rId, data);
      }
    }

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('erp_db_failover_tables', JSON.stringify(Array.from(this.failoverModifiedTables)));
        localStorage.setItem('erp_db_failover_last_write', new Date().toISOString());
      }
    } catch (_) { }
  }

  /**
   * Track individual modified record for strict Row-Level Upsert Reverse Sync
   */
  trackFailoverRecord(collection, docId, data) {
    if (!collection || !docId) return;
    const key = `${collection}:${docId}`;
    const entry = {
      collection,
      docId: String(docId),
      data,
      updatedAt: (data && (data.updatedAt || data.updated_at)) || new Date().toISOString()
    };
    if (!this.failoverModifiedRecords) this.failoverModifiedRecords = new Map();
    this.failoverModifiedRecords.set(key, entry);

    try {
      if (typeof localStorage !== 'undefined') {
        const serialized = Array.from(this.failoverModifiedRecords.values());
        localStorage.setItem('erp_db_failover_records', JSON.stringify(serialized));
      }
    } catch (_) { }
  }

  /**
   * Get total number of delta records waiting in failover queue
   */
  async getPendingRecoveryCount() {
    let count = this.failoverModifiedRecords ? this.failoverModifiedRecords.size : 0;
    try {
      const pendingItems = await retryQueue.getPending();
      const failoverPending = pendingItems.filter(item => item.isFailover || item.status === 'PENDING');
      count = Math.max(count, failoverPending.length);
    } catch (_) { }
    return count;
  }

  /**
   * Set recovery pending state (Rule 3: Controlled Reverse Sync with Admin Prompt)
   */
  setRecoveryPending(pending, count = 0) {
    this.isRecoveryPending = Boolean(pending);
    this.recoveryPendingCount = Number(count) || 0;

    try {
      if (typeof localStorage !== 'undefined') {
        if (this.isRecoveryPending) {
          localStorage.setItem('erp_db_recovery_pending', 'true');
          localStorage.setItem('erp_db_recovery_pending_count', String(this.recoveryPendingCount));
        } else {
          localStorage.removeItem('erp_db_recovery_pending');
          localStorage.removeItem('erp_db_recovery_pending_count');
        }
      }
    } catch (_) { }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('erp:recovery-pending', {
        detail: {
          isRecoveryPending: this.isRecoveryPending,
          pendingCount: this.recoveryPendingCount
        }
      }));
      if (window.storage && typeof window.storage.updateStatusBadge === 'function') {
        window.storage.updateStatusBadge(
          this.isRecoveryPending ? 'recovery-pending' : (this.isFailoverActive ? 'failover' : 'saved'),
          { pendingCount: this.recoveryPendingCount }
        );
      }
    }
  }

  /**
   * Auto-Recovery Probe: periodically pings MySQL Primary to check if it came back online
   */
  _startRecoveryProbe(intervalMs = 7000) {
    if (this._recoveryProbeTimer) return;
    this._recoveryProbeIntervalMs = intervalMs;
    console.log(`[SyncManager Failover] 🛰️ Auto-Recovery probe active: probing MySQL Primary every ${intervalMs / 1000}s...`);
    this._recoveryProbeTimer = setInterval(() => {
      if (this.isFailoverActive && !this._isRecovering) {
        this.checkPrimaryRecovery().catch(() => { });
      }
    }, intervalMs);
  }

  _stopRecoveryProbe() {
    if (this._recoveryProbeTimer) {
      clearInterval(this._recoveryProbeTimer);
      this._recoveryProbeTimer = null;
    }
  }

  /**
   * Check if MySQL Primary is responsive.
   * STRICT SAFETY RULE 3: Do NOT blindly overwrite MySQL in the background.
   * Pause auto-write recovery and signal that MySQL is back online with pending records
   * awaiting Admin Confirmation.
   */
  async checkPrimaryRecovery() {
    if (!this.primaryAdapter || this._isRecovering) return false;
    try {
      const pingFn = typeof this.primaryAdapter.ping === 'function'
        ? this.primaryAdapter.ping.bind(this.primaryAdapter)
        : this.primaryAdapter.testConnection.bind(this.primaryAdapter);
      const res = await pingFn();
      if (res && res.success) {
        // MySQL is back online!
        const pendingCount = await this.getPendingRecoveryCount();
        if (pendingCount === 0 && (!this.failoverModifiedTables || this.failoverModifiedTables.size === 0)) {
          console.log('[Recovery Probe] 🐬 MySQL Primary is back online and 100% healthy with 0 pending delta records. Deactivating failover.');
          this.setFailoverMode(false);
          return true;
        }
        console.log(`[Recovery Probe] 🐬 MySQL Primary is back online! Pausing auto-write recovery. ${pendingCount} pending delta records awaiting Admin verification.`);
        this.setRecoveryPending(true, pendingCount);
        return true;
      }
    } catch (_) { }
    return false;
  }

  /**
   * Controlled Reverse Sync (PostgreSQL -> MySQL):
   * STRICT SAFETY RULE 1: Never use full-table replacement.
   * Performs Row-Level Upsert by checking record ID and updated_at timestamp.
   * Older records can NEVER overwrite newer records in MySQL.
   *
   * STRICT SAFETY RULE 3: Triggered after Admin confirmation or manual verification.
   */
  async executeControlledRecovery(isManual = false) {
    if (this._isRecovering) {
      return { success: false, error: 'Reverse sync recovery is already in progress.' };
    }
    this._isRecovering = true;
    if (isManual) this._isManualRecovery = true;

    try {
      console.log('[SyncManager Recovery] 🛡️ Starting Controlled Row-Level Delta Reverse Sync (PostgreSQL -> MySQL)...');
      if (typeof window !== 'undefined' && window.storage) {
        window.storage.updateStatusBadge('recovering');
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('erp:recovery-started'));
      }

      // Step 1: Confirm MySQL Primary is live and accessible
      const pingFn = typeof this.primaryAdapter.ping === 'function'
        ? this.primaryAdapter.ping.bind(this.primaryAdapter)
        : this.primaryAdapter.testConnection.bind(this.primaryAdapter);
      const ping = await pingFn();
      if (!ping || !ping.success) {
        throw new Error('MySQL Primary connection probe failed. Reverse sync aborted.');
      }

      // Step 2: Collect all delta records from failover tracking and retry queue
      const deltaRecords = new Map(); // key: "collection:docId" -> { collection, docId, data, updatedAt }

      // 2a. From tracked failover records
      if (this.failoverModifiedRecords) {
        for (const [key, item] of this.failoverModifiedRecords.entries()) {
          deltaRecords.set(key, item);
        }
      }

      // 2b. From retryQueue pending failover items
      const pendingQueue = await retryQueue.getPending();
      for (const qItem of pendingQueue) {
        if (qItem.collection && qItem.data) {
          if (qItem.operation === 'SAVE_RECORD' && qItem.docId) {
            const key = `${qItem.collection}:${qItem.docId}`;
            if (!deltaRecords.has(key)) {
              deltaRecords.set(key, {
                collection: qItem.collection,
                docId: String(qItem.docId),
                data: qItem.data,
                updatedAt: qItem.failoverAt || qItem.timestamp || new Date().toISOString()
              });
            }
          } else if (qItem.operation === 'SAVE_TABLE' && Array.isArray(qItem.data)) {
            // Extract individual rows from table array
            qItem.data.forEach(row => {
              const rId = row.id || row._id || row.serialNumber || row.machineId;
              if (rId) {
                const key = `${qItem.collection}:${rId}`;
                if (!deltaRecords.has(key)) {
                  deltaRecords.set(key, {
                    collection: qItem.collection,
                    docId: String(rId),
                    data: row,
                    updatedAt: row.updatedAt || row.updated_at || qItem.failoverAt || qItem.timestamp || new Date().toISOString()
                  });
                }
              }
            });
          }
        }
      }

      // 2c. If no individual records tracked but tables were modified, inspect memory for changed rows
      if (deltaRecords.size === 0 && this.failoverModifiedTables.size > 0) {
        const { storage } = await import('./storage.js');
        for (const tbl of this.failoverModifiedTables) {
          const currentTblData = storage.data && storage.data[tbl];
          if (Array.isArray(currentTblData)) {
            currentTblData.forEach(row => {
              const rId = row.id || row._id || row.serialNumber;
              if (rId) {
                const key = `${tbl}:${rId}`;
                deltaRecords.set(key, {
                  collection: tbl,
                  docId: String(rId),
                  data: row,
                  updatedAt: row.updatedAt || row.updated_at || new Date().toISOString()
                });
              }
            });
          }
        }
      }

      console.log(`[SyncManager Recovery] 📋 Total Delta records identified for Row-Level Upsert: ${deltaRecords.size}`);

      // Step 3: Strict Row-Level Upsert with Timestamp Check
      let syncedCount = 0;
      let skippedCount = 0;
      let failedCount = 0;

      // Group records by collection
      const byCollection = new Map();
      for (const [key, item] of deltaRecords.entries()) {
        if (!byCollection.has(item.collection)) {
          byCollection.set(item.collection, []);
        }
        byCollection.get(item.collection).push(item);
      }

      for (const [collection, records] of byCollection.entries()) {
        // Fetch current MySQL table to check timestamps
        let mysqlTableData = [];
        try {
          const tableRes = await this.primaryAdapter.getTable(collection);
          if (tableRes && tableRes.success && Array.isArray(tableRes.data)) {
            mysqlTableData = tableRes.data;
          }
        } catch (_) { }

        const mysqlMap = new Map();
        mysqlTableData.forEach(r => {
          const id = r.id || r._id || r.serialNumber || r.machineId;
          if (id) mysqlMap.set(String(id), r);
        });

        for (const item of records) {
          const existingMysql = mysqlMap.get(item.docId);
          if (existingMysql) {
            // Check timestamps: delta record MUST be strictly newer than existing MySQL record
            const deltaTs = Date.parse(item.updatedAt || item.data?.updatedAt || item.data?.updated_at || 0) || 0;
            const mysqlTs = Date.parse(existingMysql.updatedAt || existingMysql.updated_at || existingMysql.updateTime || 0) || 0;

            if (mysqlTs > deltaTs) {
              console.warn(`[SyncManager Safety] ⛔ SKIPPED record "${collection}:${item.docId}" — MySQL has newer timestamp (${new Date(mysqlTs).toISOString()} > ${new Date(deltaTs).toISOString()}). Older data will NEVER overwrite newer data.`);
              skippedCount++;
              continue;
            }
          }

          // Execute Row-Level Upsert to MySQL (NEVER full-table replacement!)
          try {
            const upsertRes = await this.primaryAdapter.saveRecord(collection, item.docId, item.data);
            if (upsertRes && upsertRes.success) {
              syncedCount++;
            } else {
              failedCount++;
              console.error(`[SyncManager Recovery] Failed to upsert record "${collection}:${item.docId}":`, upsertRes?.error);
            }
          } catch (upsertErr) {
            failedCount++;
            console.error(`[SyncManager Recovery] Upsert exception for "${collection}:${item.docId}":`, upsertErr.message);
          }
        }
      }

      // Step 4: Clear recovery queue and failover storage
      for (const qItem of pendingQueue) {
        await retryQueue.remove(qItem.id).catch(() => { });
      }
      if (this.failoverModifiedRecords) this.failoverModifiedRecords.clear();
      if (this.failoverModifiedTables) this.failoverModifiedTables.clear();
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem('erp_db_failover_records');
          localStorage.removeItem('erp_db_failover_tables');
          localStorage.removeItem('erp_db_failover_last_write');
        }
      } catch (_) { }

      // Step 5: Deactivate recovery pending and failover mode
      this.setRecoveryPending(false, 0);
      this.setFailoverMode(false);

      if (typeof window !== 'undefined' && window.storage) {
        window.storage._isCloudConnected = true;
        window.storage.updateStatusBadge('saved');
        const nowStr = new Date().toLocaleTimeString();
        const statusEl = document.getElementById('nav-db-status');
        if (statusEl) {
          statusEl.title = `System Cloud Synchronized (Last Sync: ${nowStr})`;
        }
      }

      const summary = `Controlled Reverse Sync Completed: ${syncedCount} row(s) safely upserted to MySQL, ${skippedCount} older row(s) skipped, ${failedCount} errors.`;
      console.log(`[SyncManager Recovery] ✅ ${summary}`);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('erp:recovery-completed', {
          detail: { syncedCount, skippedCount, failedCount }
        }));
        if (window.notificationService && (isManual || this._isManualRecovery)) {
          window.notificationService.success(
            `Data Restored: ${syncedCount} record(s) synchronized.`
          );
        }
      }

      return { success: true, syncedCount, skippedCount, failedCount };
    } catch (err) {
      console.error('[SyncManager Recovery] ❌ Controlled reverse sync error:', err.message);
      if (typeof window !== 'undefined' && window.notificationService && (isManual || this._isManualRecovery)) {
        window.notificationService.error(`Recovery Sync Error: ${err.message}`);
      }
      return { success: false, error: err.message };
    } finally {
      this._isRecovering = false;
      this._isManualRecovery = false;
    }
  }

  // Alias for backward compatibility
  async performAutoRecovery() {
    return this.executeControlledRecovery();
  }

  /**
   * Save multiple tables with Enterprise Automatic Failover:
   * Normal: Writes to MySQL Primary, then fans out to PostgreSQL.
   * Failover: If MySQL is offline or fails, seamlessly routes to PostgreSQL and logs to recovery queue.
   * Rule 4 (Write Protection): If both MySQL and PostgreSQL fail, block the save and abort.
   */
  async saveMultipleTables(tablesObj) {
    await this._ensureConfig();
    const pgAdapter = this.getPostgresAdapter();

    // 1. Direct Failover Route if failover is already active
    if (this.isFailoverActive) {
      if (pgAdapter && pgAdapter.config && pgAdapter.config.enabled) {
        console.warn('[SyncManager Failover] 🐘 Failover mode active: writing multiple tables to PostgreSQL...');
        try {
          const pgResult = await pgAdapter.saveMultipleTables(tablesObj);
          if (pgResult && pgResult.success) {
            Object.entries(tablesObj).forEach(([tbl, data]) => this.trackFailoverModification(tbl, null, data));
            this._queueRetry(this.primaryAdapter, 'multiple', null, 'SAVE_MULTIPLE_TABLES', tablesObj, 'Failover write while MySQL offline');
            if (typeof window !== 'undefined' && window.storage) {
              window.storage.updateStatusBadge('failover');
            }
            return { success: true, failover: true, target: 'POSTGRESQL', updatedAt: new Date().toISOString() };
          }
        } catch (pgErr) {
          console.error('[SyncManager Failover] ❌ PostgreSQL saveMultipleTables failed:', pgErr);
        }
      }

      // Resilient fallback check: test if MySQL Primary is responsive before failing
      if (this.primaryAdapter) {
        try {
          const myResult = await this.primaryAdapter.saveMultipleTables(tablesObj);
          if (myResult && myResult.success) {
            console.log('[SyncManager Failover] 🐬 MySQL Primary responded successfully during saveMultipleTables! Restoring primary operation.');
            this.setFailoverMode(false);
            return myResult;
          }
        } catch (_) {}
      }

      // Rule 4: Dual Failure Protection
      console.error('[SyncManager Protection] 🚨 DUAL FAILURE: Both MySQL Primary and PostgreSQL Replica failed!');
      return {
        success: false,
        error: 'Write Blocked: Both MySQL Primary and PostgreSQL Replica are unreachable. Save action aborted to prevent data corruption.',
        dualFailure: true
      };
    }

    if (!this.primaryAdapter) {
      throw new Error('CRITICAL: Primary MySQL database adapter is not initialized.');
    }

    // 2. Attempt commit to Primary MySQL
    let primaryResult = null;
    try {
      primaryResult = await this.primaryAdapter.saveMultipleTables(tablesObj);
    } catch (netErr) {
      primaryResult = { success: false, error: netErr.message };
    }

    // 3. Automatic Failover Trigger if MySQL write fails
    if (!primaryResult || !primaryResult.success) {
      const errMsg = primaryResult?.error || 'Primary MySQL saveMultipleTables operation failed.';
      console.warn(`[SyncManager] ⚠️ Primary MySQL write failed (${errMsg}). Activating Automatic Failover to PostgreSQL...`);
      this.setFailoverMode(true, errMsg);

      if (pgAdapter && pgAdapter.config && pgAdapter.config.enabled) {
        try {
          const pgResult = await pgAdapter.saveMultipleTables(tablesObj);
          if (pgResult && pgResult.success) {
            Object.entries(tablesObj).forEach(([tbl, data]) => this.trackFailoverModification(tbl, null, data));
            this._queueRetry(this.primaryAdapter, 'multiple', null, 'SAVE_MULTIPLE_TABLES', tablesObj, errMsg);
            if (typeof window !== 'undefined' && window.storage) {
              window.storage.updateStatusBadge('failover');
            }
            return { success: true, failover: true, target: 'POSTGRESQL', updatedAt: new Date().toISOString() };
          }
        } catch (pgErr) {
          console.error('[SyncManager] PostgreSQL failover write also failed:', pgErr);
        }
      }

      // Rule 4: Dual failure!
      this._queueRetry(this.primaryAdapter, 'multiple', null, 'SAVE_MULTIPLE_TABLES', tablesObj, errMsg);
      return {
        success: false,
        error: 'Write Blocked: Both MySQL Primary and PostgreSQL Replica are unreachable. Save action aborted to prevent data corruption.',
        dualFailure: true
      };
    }

    // 4. Unidirectional Backup Fan-out: MySQL (Authoritative) → PostgreSQL (Backup Replica)
    for (const [collection, dataObj] of Object.entries(tablesObj)) {
      this._fanoutTableSave(collection, dataObj);
    }

    return primaryResult;
  }

  /**
   * Save an entire table with Enterprise Automatic Failover:
   * Normal: Writes to MySQL Primary, then fans out to PostgreSQL.
   * Failover: If MySQL is offline or fails, seamlessly routes to PostgreSQL and logs to recovery queue.
   * Rule 4 (Write Protection): If both MySQL and PostgreSQL fail, block the save and abort.
   */
  async saveTable(collection, dataObj) {
    await this._ensureConfig();
    const pgAdapter = this.getPostgresAdapter();

    // 1. Direct Failover Route if failover is already active
    if (this.isFailoverActive) {
      if (pgAdapter && pgAdapter.config && pgAdapter.config.enabled) {
        console.warn(`[SyncManager Failover] 🐘 Failover mode active: writing table "${collection}" to PostgreSQL...`);
        try {
          const pgResult = await pgAdapter.saveTable(collection, dataObj);
          if (pgResult && pgResult.success) {
            this.trackFailoverModification(collection, null, dataObj);
            this._queueRetry(this.primaryAdapter, collection, null, 'SAVE_TABLE', dataObj, 'Failover write while MySQL offline');
            if (typeof window !== 'undefined' && window.storage) {
              window.storage.updateStatusBadge('failover');
            }
            return { success: true, failover: true, target: 'POSTGRESQL', updatedAt: new Date().toISOString() };
          }
        } catch (pgErr) {
          console.error(`[SyncManager Failover] ❌ PostgreSQL saveTable("${collection}") failed:`, pgErr);
        }
      }

      // Resilient fallback check: test if MySQL Primary is responsive before failing
      if (this.primaryAdapter) {
        try {
          const myResult = await this.primaryAdapter.saveTable(collection, dataObj);
          if (myResult && myResult.success) {
            console.log(`[SyncManager Failover] 🐬 MySQL Primary responded successfully for "${collection}"! Restoring primary operation.`);
            this.setFailoverMode(false);
            return myResult;
          }
        } catch (_) {}
      }

      // Rule 4: Dual Failure Protection
      return {
        success: false,
        error: 'Write Blocked: Both MySQL Primary and PostgreSQL Replica are unreachable. Save action aborted to prevent data corruption.',
        dualFailure: true
      };
    }

    if (!this.primaryAdapter) {
      throw new Error('CRITICAL: Primary MySQL database adapter is not initialized.');
    }

    // 2. Attempt commit to Primary MySQL
    let primaryResult = null;
    try {
      primaryResult = await this.primaryAdapter.saveTable(collection, dataObj);
    } catch (netErr) {
      primaryResult = { success: false, error: netErr.message };
    }

    // 3. Automatic Failover Trigger if MySQL write fails
    if (!primaryResult || !primaryResult.success) {
      const errMsg = primaryResult?.error || `Primary MySQL saveTable failed for collection "${collection}".`;
      console.warn(`[SyncManager] ⚠️ Primary MySQL saveTable failed (${errMsg}). Activating Automatic Failover to PostgreSQL...`);
      this.setFailoverMode(true, errMsg);

      if (pgAdapter && pgAdapter.config && pgAdapter.config.enabled) {
        try {
          const pgResult = await pgAdapter.saveTable(collection, dataObj);
          if (pgResult && pgResult.success) {
            this.trackFailoverModification(collection, null, dataObj);
            this._queueRetry(this.primaryAdapter, collection, null, 'SAVE_TABLE', dataObj, errMsg);
            if (typeof window !== 'undefined' && window.storage) {
              window.storage.updateStatusBadge('failover');
            }
            return { success: true, failover: true, target: 'POSTGRESQL', updatedAt: new Date().toISOString() };
          }
        } catch (pgErr) {
          console.error('[SyncManager] PostgreSQL failover saveTable also failed:', pgErr);
        }
      }

      // Rule 4: Dual failure!
      this._queueRetry(this.primaryAdapter, collection, null, 'SAVE_TABLE', dataObj, errMsg);
      return {
        success: false,
        error: 'Write Blocked: Both MySQL Primary and PostgreSQL Replica are unreachable. Save action aborted to prevent data corruption.',
        dualFailure: true
      };
    }

    // 4. Unidirectional Fan-out to PostgreSQL Backup Replica
    this._fanoutTableSave(collection, dataObj);
    return primaryResult;
  }

  /**
   * Save a single record with Enterprise Automatic Failover:
   * Normal: Writes to MySQL Primary, then fans out to PostgreSQL.
   * Failover: If MySQL is offline or fails, seamlessly routes to PostgreSQL and logs to recovery queue.
   * Rule 4 (Write Protection): If both MySQL and PostgreSQL fail, block the save and abort.
   */
  async saveRecord(collection, docId, data) {
    await this._ensureConfig();
    const pgAdapter = this.getPostgresAdapter();

    // 1. Direct Failover Route if failover is already active
    if (this.isFailoverActive) {
      if (pgAdapter && pgAdapter.config && pgAdapter.config.enabled) {
        try {
          const pgResult = await pgAdapter.saveRecord(collection, docId, data);
          if (pgResult && pgResult.success) {
            this.trackFailoverModification(collection, docId, data);
            this._queueRetry(this.primaryAdapter, collection, docId, 'SAVE_RECORD', data, 'Failover write while MySQL offline');
            if (typeof window !== 'undefined' && window.storage) {
              window.storage.updateStatusBadge('failover');
            }
            return { success: true, failover: true, target: 'POSTGRESQL', updatedAt: new Date().toISOString() };
          }
        } catch (pgErr) {
          console.error(`[SyncManager Failover] ❌ PostgreSQL saveRecord failed:`, pgErr);
        }
      }

      // Resilient fallback check: test if MySQL Primary is responsive before failing
      if (this.primaryAdapter) {
        try {
          const myResult = await this.primaryAdapter.saveRecord(collection, docId, data);
          if (myResult && myResult.success) {
            console.log(`[SyncManager Failover] 🐬 MySQL Primary responded successfully for "${collection}/${docId}"! Restoring primary operation.`);
            this.setFailoverMode(false);
            return myResult;
          }
        } catch (_) {}
      }

      // Rule 4: Dual failure protection
      return {
        success: false,
        error: 'Write Blocked: Both MySQL Primary and PostgreSQL Replica are unreachable. Save action aborted to prevent data corruption.',
        dualFailure: true
      };
    }

    if (!this.primaryAdapter) {
      throw new Error('CRITICAL: Primary MySQL database adapter is not initialized.');
    }

    // 2. Attempt commit to Primary MySQL
    let primaryResult = null;
    try {
      primaryResult = await this.primaryAdapter.saveRecord(collection, docId, data);
    } catch (netErr) {
      primaryResult = { success: false, error: netErr.message };
    }

    // 3. Automatic Failover Trigger if MySQL write fails
    if (!primaryResult || !primaryResult.success) {
      const errMsg = primaryResult?.error || `Primary MySQL saveRecord failed for "${collection}/${docId}".`;
      console.warn(`[SyncManager] ⚠️ Primary MySQL saveRecord failed (${errMsg}). Activating Automatic Failover to PostgreSQL...`);
      this.setFailoverMode(true, errMsg);

      if (pgAdapter && pgAdapter.config && pgAdapter.config.enabled) {
        try {
          const pgResult = await pgAdapter.saveRecord(collection, docId, data);
          if (pgResult && pgResult.success) {
            this.trackFailoverModification(collection, docId, data);
            this._queueRetry(this.primaryAdapter, collection, docId, 'SAVE_RECORD', data, errMsg);
            if (typeof window !== 'undefined' && window.storage) {
              window.storage.updateStatusBadge('failover');
            }
            return { success: true, failover: true, target: 'POSTGRESQL', updatedAt: new Date().toISOString() };
          }
        } catch (pgErr) {
          console.error('[SyncManager] PostgreSQL failover saveRecord also failed:', pgErr);
        }
      }

      // Rule 4: Dual failure!
      this._queueRetry(this.primaryAdapter, collection, docId, 'SAVE_RECORD', data, errMsg);
      return {
        success: false,
        error: 'Write Blocked: Cloud database servers are currently unreachable. Save action paused to protect system data.',
        dualFailure: true
      };
    }

    // 4. Unidirectional Fan-out to PostgreSQL Backup Replica
    this._fanoutRecordSave(collection, docId, data);
    return primaryResult;
  }

  /**
   * Delete a single record with Enterprise Automatic Failover:
   * Normal: Deletes on MySQL Primary, then fans out to PostgreSQL.
   * Failover: If MySQL is offline or fails, seamlessly routes delete to PostgreSQL.
   */
  async deleteRecord(collection, docId) {
    await this._ensureConfig();
    const pgAdapter = this.getPostgresAdapter();

    if (this.isFailoverActive) {
      if (pgAdapter && pgAdapter.config && pgAdapter.config.enabled) {
        try {
          const pgResult = await pgAdapter.deleteRecord(collection, docId);
          if (pgResult && pgResult.success) {
            this._queueRetry(this.primaryAdapter, collection, docId, 'DELETE_RECORD', null, 'Failover delete while MySQL offline');
            return { success: true, failover: true, target: 'POSTGRESQL', updatedAt: new Date().toISOString() };
          }
        } catch (pgErr) {
          console.error('[SyncManager Failover] ❌ PostgreSQL deleteRecord failed:', pgErr);
        }
      }

      if (this.primaryAdapter) {
        try {
          const myResult = await this.primaryAdapter.deleteRecord(collection, docId);
          if (myResult && myResult.success) {
            this.setFailoverMode(false);
            return myResult;
          }
        } catch (_) {}
      }

      return {
        success: false,
        error: 'Write Blocked: Both MySQL Primary and PostgreSQL Replica are unreachable. Delete action aborted.',
        dualFailure: true
      };
    }

    if (!this.primaryAdapter) {
      throw new Error('CRITICAL: Primary MySQL database adapter is not initialized.');
    }

    let primaryResult = null;
    try {
      primaryResult = await this.primaryAdapter.deleteRecord(collection, docId);
    } catch (netErr) {
      primaryResult = { success: false, error: netErr.message };
    }

    if (!primaryResult || !primaryResult.success) {
      const errMsg = primaryResult?.error || `Primary MySQL deleteRecord failed for "${collection}/${docId}".`;
      console.warn(`[SyncManager] ⚠️ Primary MySQL deleteRecord failed (${errMsg}). Activating Automatic Failover to PostgreSQL...`);
      this.setFailoverMode(true, errMsg);

      if (pgAdapter && pgAdapter.config && pgAdapter.config.enabled) {
        try {
          const pgResult = await pgAdapter.deleteRecord(collection, docId);
          if (pgResult && pgResult.success) {
            this._queueRetry(this.primaryAdapter, collection, docId, 'DELETE_RECORD', null, errMsg);
            return { success: true, failover: true, target: 'POSTGRESQL', updatedAt: new Date().toISOString() };
          }
        } catch (pgErr) {
          console.error('[SyncManager] PostgreSQL failover deleteRecord also failed:', pgErr);
        }
      }

      this._queueRetry(this.primaryAdapter, collection, docId, 'DELETE_RECORD', null, errMsg);
      return {
        success: false,
        error: 'Write Blocked: Cloud database servers are currently unreachable.',
        dualFailure: true
      };
    }

    this._fanoutRecordDelete(collection, docId);
    return primaryResult;
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
          this._recordMetric(id, {
            failed: 1,
            lastError: res.error,
            lastSyncTime: new Date().toLocaleString()
          });
        } else {
          if (adapter.config) adapter.config.lastSync = new Date().toLocaleString();
          const currentTotal = (typeof window !== 'undefined' && window.storage)
            ? Object.values(window.storage.data || {}).reduce((sum, t) => sum + (Array.isArray(t) ? t.length : (t && typeof t === 'object' ? Object.keys(t).length : 0)), 0)
            : 0;
          this._recordMetric(id, {
            matched: currentTotal || undefined,
            missing: 0,
            failed: 0,
            lastError: null,
            lastSyncTime: new Date().toLocaleString()
          });
        }
      }).catch(err => {
        this._queueRetry(adapter, collection, null, 'SAVE_TABLE', dataObj, err.message);
        this._recordMetric(id, {
          failed: 1,
          lastError: err.message,
          lastSyncTime: new Date().toLocaleString()
        });
      });
    }
  }

  async _fanoutRecordDelete(collection, docId, excludeDbId = null) {
    for (const [id, adapter] of this.secondaryAdapters.entries()) {
      if (!adapter.config.enabled || id === excludeDbId) continue;
      if (adapter.config.autoSync === false) continue;
      if (typeof adapter.deleteRecord !== 'function') continue;

      adapter.deleteRecord(collection, docId).then(res => {
        if (!res.success) {
          this._queueRetry(adapter, collection, docId, 'DELETE_RECORD', null, res.error);
        }
      }).catch(err => {
        this._queueRetry(adapter, collection, docId, 'DELETE_RECORD', null, err.message);
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
          this._recordMetric(id, {
            failed: 1,
            lastError: res.error,
            lastSyncTime: new Date().toLocaleString()
          });
        } else {
          if (adapter.config) adapter.config.lastSync = new Date().toLocaleString();
          const currentTotal = (typeof window !== 'undefined' && window.storage)
            ? Object.values(window.storage.data || {}).reduce((sum, t) => sum + (Array.isArray(t) ? t.length : (t && typeof t === 'object' ? Object.keys(t).length : 0)), 0)
            : 0;
          this._recordMetric(id, {
            matched: currentTotal || undefined,
            missing: 0,
            failed: 0,
            lastError: null,
            lastSyncTime: new Date().toLocaleString()
          });
        }
      }).catch(err => {
        this._queueRetry(adapter, collection, docId, 'SAVE_RECORD', data, err.message);
        this._recordMetric(id, {
          failed: 1,
          lastError: err.message,
          lastSyncTime: new Date().toLocaleString()
        });
      });
    }
  }

  async _queueRetry(adapter, collection, docId, operation, data, error) {
    if (!adapter || (adapter.config && adapter.config.retryEnabled === false)) return;

    try {
      await retryQueue.enqueue({
        dbId: adapter.id || 'mysql_primary',
        dbName: adapter.name || 'MySQL (maint_erp)',
        collection,
        docId,
        operation,
        data,
        error: error || 'Unknown error',
        isFailover: Boolean(this.isFailoverActive),
        failoverAt: this.isFailoverActive ? new Date().toISOString() : null
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
        } else if (item.operation === 'DELETE_RECORD') {
          result = typeof adapter.deleteRecord === 'function' ? await adapter.deleteRecord(item.collection, item.docId) : { success: true };
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
    let totalFailed = 0;

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
          errStr.includes('not found') ||
          errStr.includes('authentication') ||
          errStr.includes('password') ||
          errStr.includes('access denied') ||
          errStr.includes('pg_hba') ||
          errStr.includes('failed to fetch') ||
          errStr.includes('network') ||
          errStr.includes('cors') ||
          errStr.includes('blocked') ||
          errStr.includes('permission denied') ||
          errStr.includes('unauthorized') ||
          errStr.includes('cannot reach') ||
          errStr.includes('consumer_invalid') ||
          errStr.includes('invalid') ||
          errStr.includes('http 500') ||
          errStr.includes('failed: http') ||
          errStr.includes('connection failed') ||
          errStr.includes('save-table failed') ||
          errStr.includes('sqlstate') ||
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

  /**
   * Safely backup all committed MySQL tables in memory to PostgreSQL Backup Replica.
   * This is strictly a unidirectional push: MySQL Primary (Authoritative) → PostgreSQL Backup Replica.
   * Backup errors never roll back or alter MySQL data.
   */
  async backupToPostgres() {
    await this._ensureConfig();
    const pgAdapter = this.getPostgresAdapter();
    if (!pgAdapter || !pgAdapter.config || !pgAdapter.config.enabled) {
      return { success: false, error: 'PostgreSQL Backup is not configured or disabled' };
    }
    try {
      const ok = await this.runFullSync(pgAdapter.id);
      return { success: ok };
    } catch (err) {
      console.warn('[SyncManager] PostgreSQL backup notice:', err.message);
      return { success: false, error: err.message };
    }
  }

  _recordMetric(dbId, patch) {
    try {
      if (typeof localStorage === 'undefined') return;
      const raw = localStorage.getItem('erp_data_engine_sync_metrics');
      const metrics = raw ? JSON.parse(raw) : {};
      metrics[dbId] = { ...(metrics[dbId] || {}), ...patch, lastUpdated: new Date().toISOString() };
      localStorage.setItem('erp_data_engine_sync_metrics', JSON.stringify(metrics));
    } catch (_) { }
  }

  /**
   * Start the Background Auto-Sync Engine.
   * Periodically checks secondary databases and automatically reconciles/syncs
   * any secondary database that is enabled, pending, or desynchronized.
   */
  startAutoSyncEngine(intervalMs = 15000) {
    if (this._autoSyncTimer) {
      clearInterval(this._autoSyncTimer);
      this._autoSyncTimer = null;
    }

    // Initial background sync check 3 seconds after boot
    if (typeof setTimeout !== 'undefined') {
      setTimeout(() => {
        this.triggerAutoSync({ silent: true }).catch(() => { });
      }, 3500);
    }

    // Recurring sync check
    if (typeof setInterval !== 'undefined') {
      this._autoSyncTimer = setInterval(() => {
        this.triggerAutoSync({ silent: true }).catch(() => { });
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
      } catch (_) { }

      if (!isAutoSyncEnabled) return false;

      let metrics = {};
      try {
        if (typeof localStorage !== 'undefined') {
          const mStored = localStorage.getItem('erp_data_engine_sync_metrics');
          if (mStored) metrics = JSON.parse(mStored) || {};
        }
      } catch (_) { }

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
      await this.processRetryQueue().catch(() => { });

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
      window.storage.saveMultiDbConfigs(configs).catch(() => { });
    } else {
      try { localStorage.setItem('erp_multi_db_config', JSON.stringify(configs)); } catch (_) { }
    }
  }
}

export const syncManager = new SyncManager();
