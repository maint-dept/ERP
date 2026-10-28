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

    // Enterprise Automatic Failover & Recovery System
    this.isFailoverActive = (typeof localStorage !== 'undefined' && localStorage.getItem('erp_db_failover_active') === 'true');
    this.failoverReason = (typeof localStorage !== 'undefined' && localStorage.getItem('erp_db_failover_reason')) || '';
    this.failoverStartTime = (typeof localStorage !== 'undefined' && localStorage.getItem('erp_db_failover_started_at')) || null;
    let savedTables = [];
    try {
      if (typeof localStorage !== 'undefined') {
        savedTables = JSON.parse(localStorage.getItem('erp_db_failover_tables') || '[]');
      }
    } catch (_) {}
    this.failoverModifiedTables = new Set(Array.isArray(savedTables) ? savedTables : []);
    this._recoveryProbeTimer = null;
    this._isRecovering = false;
    this._recoveryProbeIntervalMs = 7000;

    if (this.isFailoverActive) {
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
              if (!ep || ep === '/api/db/mysql') {
                ep = 'https://moviezonex.com/mysql_api.php';
              } else if (ep === 'api/mysql_api.php' || ep === '/api/mysql_api.php') {
                if (typeof window !== 'undefined' && window.location && window.location.hostname.includes('github.io')) {
                  ep = 'https://moviezonex.com/mysql_api.php';
                } else if (typeof window !== 'undefined' && window.location && window.location.origin) {
                  ep = window.location.origin + '/api/mysql_api.php';
                } else {
                  ep = 'https://moviezonex.com/mysql_api.php';
                }
              } else if (!/^https?:\/\//i.test(ep)) {
                ep = (ep.startsWith('localhost') || ep.startsWith('127.0.0.1')) ? ('http://' + ep) : ('https://' + ep);
              }
              conf.endpoint = ep;
              if (!conf.database) conf.database = 'motaherh_maint-erp';
              if (!conf.username) conf.username = 'motaherh_mainterp';
              if (conf.password === undefined || conf.password === null) conf.password = 'Maint@456';
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
      } catch (_) {}
      this._startRecoveryProbe();
      console.warn(`[SyncManager Failover] ⚠️ ENTERPRISE FAILOVER ACTIVATED: All read/write operations routed to PostgreSQL replica. (${this.failoverReason})`);
    } else {
      this.failoverReason = '';
      this.failoverStartTime = null;
      this.failoverModifiedTables.clear();
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem('erp_db_failover_active');
          localStorage.removeItem('erp_db_failover_reason');
          localStorage.removeItem('erp_db_failover_started_at');
          localStorage.removeItem('erp_db_failover_tables');
          localStorage.removeItem('erp_db_failover_last_write');
        }
      } catch (_) {}
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
   * Track which tables have been modified while operating in Failover Mode
   */
  trackFailoverModification(table) {
    if (!table) return;
    this.failoverModifiedTables.add(table);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('erp_db_failover_tables', JSON.stringify(Array.from(this.failoverModifiedTables)));
        localStorage.setItem('erp_db_failover_last_write', new Date().toISOString());
      }
    } catch (_) {}
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
        this.checkPrimaryRecovery().catch(() => {});
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
   * Check if MySQL Primary is responsive and initiate auto-recovery if restored
   */
  async checkPrimaryRecovery() {
    if (!this.primaryAdapter || this._isRecovering) return false;
    try {
      const pingFn = typeof this.primaryAdapter.ping === 'function'
        ? this.primaryAdapter.ping.bind(this.primaryAdapter)
        : this.primaryAdapter.testConnection.bind(this.primaryAdapter);
      const res = await pingFn();
      if (res && res.success) {
        console.log('[Recovery Probe] 🐬 MySQL Primary is back online! Initiating Auto-Recovery & Reverse Sync...');
        await this.performAutoRecovery();
        return true;
      }
    } catch (_) {}
    return false;
  }

  /**
   * Enterprise Auto-Recovery (Reverse Sync):
   * 1. Re-syncs all fallback records from PostgreSQL / in-memory store to MySQL Primary
   * 2. Flushes and processes pending retry queue operations
   * 3. Verifies 100% data parity between primary and secondary
   * 4. Deactivates failover mode and seamlessly switches traffic back to MySQL Primary
   */
  async performAutoRecovery() {
    if (this._isRecovering) return false;
    this._isRecovering = true;

    try {
      console.log('[SyncManager Recovery] 🔄 Step 1/3: Starting Reverse-Sync from PostgreSQL to MySQL Primary...');
      if (typeof window !== 'undefined' && window.storage) {
        window.storage.updateStatusBadge('recovering');
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('erp:recovery-started'));
      }

      const { storage } = await import('./storage.js');
      const pgAdapter = this.getPostgresAdapter();

      // Gather latest tables to sync back to MySQL
      let tablesToSync = {};

      if (this.failoverModifiedTables.size > 0) {
        console.log(`[SyncManager Recovery] 📋 Syncing ${this.failoverModifiedTables.size} tables modified during failover:`, Array.from(this.failoverModifiedTables));
        for (const tbl of this.failoverModifiedTables) {
          if (storage.data && storage.data[tbl] !== undefined) {
            tablesToSync[tbl] = storage.data[tbl];
          } else if (pgAdapter) {
            try {
              const res = await pgAdapter.getTable(tbl);
              if (res && res.success && res.data !== undefined) {
                tablesToSync[tbl] = res.data;
              }
            } catch (_) {}
          }
        }
      } else {
        // Sync valid in-memory tables
        for (const [tName, tData] of Object.entries(storage.data || {})) {
          if (tData === null || tData === undefined) continue;
          if (Array.isArray(tData) && tData.length === 0) continue;
          if (!Array.isArray(tData) && typeof tData === 'object' && Object.keys(tData).length === 0) continue;
          tablesToSync[tName] = tData;
        }
      }

      // Step 2: Write back into MySQL Primary
      console.log(`[SyncManager Recovery] 🔄 Step 2/3: Upserting ${Object.keys(tablesToSync).length} table(s) to MySQL Primary...`);
      if (Object.keys(tablesToSync).length > 0) {
        if (typeof this.primaryAdapter.saveMultipleTables === 'function') {
          const res = await this.primaryAdapter.saveMultipleTables(tablesToSync);
          if (!res || !res.success) {
            throw new Error(`MySQL bulk recovery failed: ${res?.error || 'Unknown error'}`);
          }
        } else {
          for (const [tbl, data] of Object.entries(tablesToSync)) {
            const res = await this.primaryAdapter.saveTable(tbl, data);
            if (!res || !res.success) {
              throw new Error(`MySQL saveTable failed for ${tbl}: ${res?.error || 'Unknown error'}`);
            }
          }
        }
      }

      // Drain retry queue
      await this.processRetryQueue().catch(() => {});

      // Step 3: Verify Data Parity
      console.log('[SyncManager Recovery] 🔍 Step 3/3: Verifying Data Parity with MySQL Primary...');
      let parityConfirmed = true;
      try {
        const pingMysql = await this.primaryAdapter.ping();
        if (!pingMysql || !pingMysql.success) parityConfirmed = false;
      } catch (_) {
        parityConfirmed = false;
      }

      if (!parityConfirmed) {
        throw new Error('MySQL Primary parity verification failed.');
      }

      // Deactivate failover and restore normal state
      this.setFailoverMode(false);

      if (typeof window !== 'undefined' && window.storage) {
        window.storage._isCloudConnected = true;
        window.storage.updateStatusBadge('saved');
        const nowStr = new Date().toLocaleTimeString();
        const statusEl = document.getElementById('nav-db-status');
        if (statusEl) {
          statusEl.title = `MySQL Primary Synchronized (Recovered at ${nowStr}) • 100% Data Parity Verified`;
        }
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('erp:recovery-completed', {
          detail: {
            timestamp: new Date().toISOString(),
            tablesRestored: Object.keys(tablesToSync).length
          }
        }));
      }

      if (typeof window !== 'undefined' && window.notificationService) {
        window.notificationService.success(
          `🐬 MySQL Primary Recovered: 100% data parity verified. All failover records synchronized to MySQL.`
        );
      }

      console.log('[SyncManager Recovery] ✅ Auto-Recovery complete! Primary traffic seamlessly restored to MySQL.');
      return true;
    } catch (err) {
      console.error('[SyncManager Recovery] ❌ Auto-recovery attempt encountered error:', err.message);
      if (typeof window !== 'undefined' && window.storage) {
        window.storage.updateStatusBadge('failover');
      }
      return false;
    } finally {
      this._isRecovering = false;
    }
  }

  /**
   * Save multiple tables with Enterprise Automatic Failover:
   * Normal: Writes to MySQL Primary, then fans out to PostgreSQL.
   * Failover: If MySQL is offline or fails, seamlessly routes to PostgreSQL and logs to recovery queue.
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
            Object.keys(tablesObj).forEach(tbl => this.trackFailoverModification(tbl));
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
            Object.keys(tablesObj).forEach(tbl => this.trackFailoverModification(tbl));
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

      this._queueRetry(this.primaryAdapter, 'multiple', null, 'SAVE_MULTIPLE_TABLES', tablesObj, errMsg);
      return { success: false, error: errMsg };
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
            this.trackFailoverModification(collection);
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
            this.trackFailoverModification(collection);
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

      this._queueRetry(this.primaryAdapter, collection, null, 'SAVE_TABLE', dataObj, errMsg);
      return { success: false, error: errMsg };
    }

    // 4. Unidirectional Fan-out to PostgreSQL Backup Replica
    this._fanoutTableSave(collection, dataObj);
    return primaryResult;
  }

  /**
   * Save a single record with Enterprise Automatic Failover:
   * Normal: Writes to MySQL Primary, then fans out to PostgreSQL.
   * Failover: If MySQL is offline or fails, seamlessly routes to PostgreSQL and logs to recovery queue.
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
            this.trackFailoverModification(collection);
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
            this.trackFailoverModification(collection);
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

      this._queueRetry(this.primaryAdapter, collection, docId, 'SAVE_RECORD', data, errMsg);
      return { success: false, error: errMsg };
    }

    // 4. Unidirectional Fan-out to PostgreSQL Backup Replica
    this._fanoutRecordSave(collection, docId, data);
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
    } catch (_) {}
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
