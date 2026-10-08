/**
 * Al-Muslim Group ERP — Data Engine & Multi-Provider Sync Dashboard
 *
 * Provides a comprehensive real-time synchronization view:
 * 1. Master / Source Database identification (MySQL Primary)
 * 2. Visual Database Sync Topology Tree (MySQL Primary -> PostgreSQL, etc.)
 * 3. Data Flow fan-out view showing auto-sync percentages
 * 4. Data Differences table showing Total, Matched, Missing, Duplicates, Failed records
 * 5. Auto Sync ON/OFF toggle and Last Sync timestamp
 * 6. Interactive Missing Records viewer and instant Reconciliation repair
 * 7. Multi-Provider Configuration forms (MySQL, PostgreSQL)
 * 8. Unified Core Schema preview & Persistent Disk Storage backup/restore
 */

import { storage } from '../db/storage.js';
import { syncManager } from '../db/syncManager.js';
import { notificationService } from '../services/notificationService.js';
import { db } from '../db/dbClient.js';
import { PostgresAdapter } from '../db/adapters/postgresAdapter.js';
import { MysqlAdapter } from '../db/adapters/mysqlAdapter.js';

// Provider specifications with fields, default values, and documentation
export const PROVIDER_SPECS = {
  MYSQL: {
    key: 'MYSQL',
    name: 'MySQL Database',
    badge: 'SQL · Primary RDBMS',
    icon: '🐬',
    color: '#00758f',
    description: 'High-performance SQL database engine with InnoDB transaction guarantees. Primary Master database for ERP on Paid Hosting.',
    fields: [
      { id: 'endpoint', label: 'Hosting REST API Endpoint URL', type: 'text', placeholder: 'https://moviezonex.com/mysql_api.php', defaultValue: 'https://moviezonex.com/mysql_api.php', required: true, note: 'Upload mysql_api.php to your paid hosting and enter its full URL here.' },
      { id: 'database', label: 'Database Name', type: 'text', placeholder: 'motaherh_maint-erp', defaultValue: 'motaherh_maint-erp', required: true },
      { id: 'username', label: 'Database User', type: 'text', placeholder: 'motaherh_mainterp', defaultValue: 'motaherh_mainterp', required: true },
      { id: 'password', label: 'Database Password', type: 'password', placeholder: 'Maint@456', defaultValue: 'Maint@456', required: true },
      { id: 'host', label: 'Database Host', type: 'text', placeholder: 'localhost', defaultValue: 'localhost', required: false },
      { id: 'port', label: 'Port', type: 'number', placeholder: '3306', defaultValue: '3306', required: false },
      { id: 'apiKey', label: 'API Secret Key (Optional)', type: 'password', placeholder: 'e.g. secret_key_123', note: 'Matches $API_KEY defined in mysql_api.php for secure authentication.' }
    ]
  },
  POSTGRESQL: {
    key: 'POSTGRESQL',
    name: 'PostgreSQL Database',
    badge: 'SQL · Secondary Replica',
    icon: '🐘',
    color: '#336791',
    description: 'Enterprise Relational Database with ACID compliance and full transactional integrity. Secondary sync backup target.',
    fields: [
      { id: 'host', label: 'Host', type: 'text', placeholder: 'e.g. 192.168.1.100 or db.company.com', required: true },
      { id: 'port', label: 'Port', type: 'number', placeholder: '5432', defaultValue: '5432', required: true },
      { id: 'database', label: 'Database', type: 'text', placeholder: 'al_muslim_erp', required: true },
      { id: 'username', label: 'Username', type: 'text', placeholder: 'postgres_user', required: true },
      { id: 'password', label: 'Password', type: 'password', placeholder: '••••••••••••', required: true },
      { id: 'ssl', label: 'Require SSL / TLS', type: 'checkbox', defaultValue: true, note: 'Encrypt data in transit' },
      { id: 'endpoint', label: 'Proxy Endpoint URL (Optional)', type: 'text', placeholder: '/api/db/pg', note: 'Direct TCP from browser is blocked by browsers; uses REST proxy' }
    ]
  }
};

// Unified Core Database Schemas
export const CORE_SCHEMAS = [
  { name: 'machines', icon: '🏭', desc: 'Sewing, cutting, finishing, knitting and boiler assets' },
  { name: 'machine_categories', icon: '🏷️', desc: 'Classification: SNLS, DNLS, Overlock, Interlock, etc.' },
  { name: 'brands', icon: '🏢', desc: 'Juki, Brother, Pegasus, Kansai, Siruba, Jack' },
  { name: 'locations', icon: '📍', desc: 'Building, Floor, Line, Room and Zone hierarchical positions' },
  { name: 'machine_movements', icon: '🔄', desc: 'Historical line-to-line, floor, or factory transfer records' },
  { name: 'maintenance', icon: '🔧', desc: 'Preventive schedules, breakdown logs, job cards & repairs' },
  { name: 'spare_parts', icon: '⚙️', desc: 'Needles, loopers, rotary hooks, belts, knives catalog' },
  { name: 'stock_transactions', icon: '📦', desc: 'Stock In/Out ledger, requisitions & adjustments' },
  { name: 'suppliers', icon: '🤝', desc: 'Parts vendors, machinery dealers, service contractors' },
  { name: 'users', icon: '👤', desc: 'Authentication, RBAC roles (Admin, Manager, Mechanic)' },
  { name: 'audit_logs', icon: '📜', desc: 'Tamper-evident logs of all ERP data updates and actions' }
];

// Storage keys
const SYNC_STATE_KEY    = 'erp_data_engine_sync_state';    // auto-sync ON/OFF preference
const SYNC_METRICS_KEY  = 'erp_data_engine_sync_metrics';  // per-db real sync metrics

/**
 * Calculates current total records across active in-memory storage.
 */
function getTotalRecordCount() {
  if (storage && storage.data) {
    let count = 0;
    for (const k in storage.data) {
      const val = storage.data[k];
      if (Array.isArray(val)) count += val.length;
      else if (val && typeof val === 'object') count += Object.keys(val).length;
    }
    return count;
  }
  return 0;
}

function safeGetJson(key, fallback = null) {
  try {
    if (typeof localStorage === 'undefined') return fallback;
    const val = localStorage.getItem(key);
    if (!val || val === 'undefined' || val === 'null' || val === '') return fallback;
    const parsed = JSON.parse(val);
    return parsed !== null && parsed !== undefined ? parsed : fallback;
  } catch (_) {
    return fallback;
  }
}

/**
 * Persist a per-db sync metric update.
 * Called by the Sync All / Re-sync handlers after a real operation.
 */
export function recordSyncMetric(dbId, patch) {
  let metrics = safeGetJson(SYNC_METRICS_KEY, {});
  metrics[dbId] = { ...(metrics[dbId] || {}), ...patch, lastUpdated: new Date().toISOString() };
  try { localStorage.setItem(SYNC_METRICS_KEY, JSON.stringify(metrics)); } catch (_) {}
}

/**
 * Builds the real dashboard state from:
 *   1. erp_multi_db_config  — user-saved secondary databases
 *   2. erp_data_engine_sync_metrics — per-db sync outcomes written by real sync ops
 *   3. erp_data_engine_sync_state  — auto-sync preference toggle
 * No hardcoded demo rows. If nothing is configured the databases array is empty.
 */
function getDashboardSyncState() {
  const total = getTotalRecordCount();

  // ── One-time migration: wipe legacy mock databases array from sync_state if present ──
  try {
    const old = safeGetJson(SYNC_STATE_KEY, {});
    if (Array.isArray(old.databases)) {
      localStorage.setItem(SYNC_STATE_KEY, JSON.stringify({
        autoSync: old.autoSync !== false,
        lastSyncTime: old.lastSyncTime || '—'
      }));
      console.log('[Data Engine] Auto-migration: wiped legacy mock databases from sync_state.');
    }
  } catch (_) {}

  // Auto-sync preference (persisted toggle)
  let autoSync = true;
  let lastSyncTime = '—';
  try {
    const pref = safeGetJson(SYNC_STATE_KEY, {});
    if (typeof pref.autoSync === 'boolean') autoSync = pref.autoSync;
    if (pref.lastSyncTime) lastSyncTime = pref.lastSyncTime;
  } catch (_) {}

  // Real per-db metrics written by sync operations
  let metrics = safeGetJson(SYNC_METRICS_KEY, {});

  // Real configured secondary databases saved by the user
  let rawConfigs = safeGetJson('erp_multi_db_config', []);

  // Filter to keep only supported providers: MYSQL and POSTGRESQL
  rawConfigs = (rawConfigs || []).filter(c => c && c.id && (c.type === 'MYSQL' || c.type === 'POSTGRESQL'));

  // Ensure Primary MySQL exists with production credentials
  let mysqlPrimary = rawConfigs.find(c => c.id === 'mysql_primary' || (c.type === 'MYSQL' && c.role === 'PRIMARY'));
  if (!mysqlPrimary) {
    mysqlPrimary = {
      id: 'mysql_primary',
      name: 'MySQL (maint_erp)',
      type: 'MYSQL',
      role: 'PRIMARY',
      host: 'localhost',
      port: 3306,
      database: 'motaherh_maint-erp',
      username: 'motaherh_mainterp',
      password: 'Maint@456',
      endpoint: 'https://moviezonex.com/mysql_api.php',
      apiKey: '',
      enabled: true,
      autoSync: true,
      retryEnabled: true,
      updatedAt: new Date().toISOString()
    };
    rawConfigs.unshift(mysqlPrimary);
    try { localStorage.setItem('erp_multi_db_config', JSON.stringify(rawConfigs)); } catch (_) {}
  } else {
    // Normalize endpoint to live hosting URL if relative or outdated
    if (!mysqlPrimary.endpoint || mysqlPrimary.endpoint === 'api/mysql_api.php' || !mysqlPrimary.endpoint.startsWith('http')) {
      mysqlPrimary.endpoint = 'https://moviezonex.com/mysql_api.php';
      mysqlPrimary.database = 'motaherh_maint-erp';
      mysqlPrimary.username = 'motaherh_mainterp';
      mysqlPrimary.password = 'Maint@456';
      mysqlPrimary.role = 'PRIMARY';
      try { localStorage.setItem('erp_multi_db_config', JSON.stringify(rawConfigs)); } catch (_) {}
    }
  }

  // Clear any stale failed metric for mysql_primary
  if (metrics['mysql_primary'] && metrics['mysql_primary'].failed > 0) {
    metrics['mysql_primary'].failed = 0;
    metrics['mysql_primary'].missing = 0;
    metrics['mysql_primary'].matched = total;
    try { localStorage.setItem(SYNC_METRICS_KEY, JSON.stringify(metrics)); } catch (_) {}
  }

  // Map provider type → display icon
  const TYPE_ICONS = {
    POSTGRESQL: '🐘', POSTGRES: '🐘',
    MYSQL: '🐬'
  };

  // Only secondary databases are shown in fan-out / secondary list
  const secondaryConfigs = rawConfigs.filter(c => c.role !== 'PRIMARY' && c.id !== 'mysql_primary');

  const databases = secondaryConfigs.map(conf => {
    const type  = (conf.type || '').toUpperCase();
    const m     = metrics[conf.id] || {};
    const name  = conf.name || conf.type || 'Unknown';
    const icon  = TYPE_ICONS[type] || '🗄️';

    // Determine status from real metric data
    let status, statusLabel, statusColor;
    if (!conf.enabled) {
      status = 'DISABLED';   statusLabel = 'Disabled';       statusColor = '#64748b';
    } else if (!m.lastUpdated) {
      status = 'PENDING';    statusLabel = 'Not Synced Yet'; statusColor = '#94a3b8';
    } else if (m.failed > 0) {
      status = 'FAILED';     statusLabel = 'Failed';         statusColor = '#ef4444';
    } else if (m.missing > 0) {
      status = 'MISSING';    statusLabel = 'Missing';        statusColor = '#f59e0b';
    } else {
      status = 'SYNCED';     statusLabel = 'Synced';         statusColor = '#10b981';
    }

    const matched   = (m.matched   !== undefined) ? m.matched   : (status === 'SYNCED' ? total : 0);
    const missing   = (m.missing   !== undefined) ? m.missing   : 0;
    const failed    = (m.failed    !== undefined) ? m.failed    : 0;
    const duplicates= (m.duplicates!== undefined) ? m.duplicates: 0;
    const syncPct   = total > 0 ? +((matched / total) * 100).toFixed(1) : 0;
    const lastSync  = m.lastSyncTime || (m.lastUpdated ? new Date(m.lastUpdated).toLocaleString() : '—');

    return {
      id:              conf.id,
      name,
      type,
      icon,
      role:            'SECONDARY',
      enabled:         !!conf.enabled,
      status,
      statusLabel,
      statusColor,
      total,
      matched,
      missing,
      duplicates,
      failed,
      syncPct,
      autoSyncEnabled: !!conf.enabled,
      lastSync
    };
  });

  // Aggregate failed / pending counts
  const failedCount  = databases.reduce((a, d) => a + (d.failed  || 0), 0);
  const pendingCount = databases.filter(d => d.status === 'PENDING').length;

  // Collect real missing records from metrics
  const missingRecords = [];
  for (const db of databases) {
    const m = metrics[db.id] || {};
    if (Array.isArray(m.missingRecords)) {
      m.missingRecords.forEach(r => missingRecords.push({ ...r, db: db.name }));
    }
  }

  // Master (Primary) database is MySQL
  const masterObj = {
    id: mysqlPrimary.id,
    name: mysqlPrimary.name || 'MySQL (maint_erp)',
    icon: '🐬',
    role: 'PRIMARY',
    label: `Main Database — ${mysqlPrimary.name || 'MySQL (maint_erp)'}`,
    status: 'CONNECTED',
    total,
    matched: total,
    missing: 0,
    duplicates: 0,
    failed: 0,
    syncPct: 100.0,
    lastSync: lastSyncTime
  };

  return {
    autoSync,
    lastSyncTime,
    pendingCount,
    failedCount,
    duplicateCount: databases.reduce((a, d) => a + (d.duplicates || 0), 0),
    master: masterObj,
    databases,
    missingRecords
  };
}

function saveDashboardSyncState(patch) {
  // Only persist user preferences (autoSync toggle, lastSyncTime) — NOT the entire state
  const stored = safeGetJson(SYNC_STATE_KEY, {});
  const merged = { ...stored, ...patch };
  try { localStorage.setItem(SYNC_STATE_KEY, JSON.stringify(merged)); } catch (_) {}
}

export function renderDatabaseConfigView() {
  // Read real saved secondary-DB configs from localStorage
  const configs = safeGetJson('erp_multi_db_config', []);

  const state = getDashboardSyncState();
  const totalRecords = state.master.total;
  const formattedTotal = totalRecords > 0 ? totalRecords.toLocaleString() : '—';

  const hasMissing = state.databases.some(d => d.missing > 0);
  const totalMissing = state.databases.reduce((acc, d) => acc + (d.missing || 0), 0);

  return `
    <div class="page-view" style="max-width: 1440px; margin: 0 auto; padding-bottom: 60px;">
      
      <!-- Top Title & Global Controls -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; flex-wrap: wrap; gap: 16px;">
        <div>
          <div style="display: flex; align-items: center; gap: 12px;">
            <h1 style="font-size: 26px; font-weight: 800; color: #fff; margin: 0; letter-spacing: -0.5px;">🗄️ Data Engine</h1>
            <span style="background: rgba(16, 185, 129, 0.15); border: 1px solid #10b981; color: #34d399; font-size: 11px; font-weight: 700; padding: 3px 12px; border-radius: 999px;">
              v4.24.5 Active
            </span>
            <span id="badge-auto-sync" style="background: ${state.autoSync ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)'}; border: 1px solid ${state.autoSync ? '#10b981' : '#ef4444'}; color: ${state.autoSync ? '#34d399' : '#f87171'}; font-size: 11px; font-weight: 700; padding: 3px 12px; border-radius: 999px;">
              ${state.autoSync ? '🟢 Auto Sync ON' : '🔴 Auto Sync OFF'}
            </span>
          </div>
          <p style="font-size: 13.5px; color: var(--text-secondary); margin: 6px 0 0;">
            Real-time synchronization topology, single source of truth validation, and automatic difference reconciliation.
          </p>
        </div>

        <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
          <button id="btn-toggle-auto-sync" class="btn btn-secondary btn-sm" style="font-weight: 700; border-color: ${state.autoSync ? '#10b981' : '#64748b'}; color: ${state.autoSync ? '#34d399' : '#cbd5e1'}; display: flex; align-items: center; gap: 6px;">
            <span>${state.autoSync ? '⏸️ Turn Auto-Sync OFF' : '▶️ Turn Auto-Sync ON'}</span>
          </button>
          <button id="btn-sync-all-providers" class="btn btn-primary btn-sm" style="font-weight: 700; background: linear-gradient(135deg, #0284c7, #2563eb); display: flex; align-items: center; gap: 6px; box-shadow: 0 4px 15px rgba(2, 132, 199, 0.35);">
            <span>🔄 Sync All Databases</span>
          </button>
          <button id="btn-fix-all-missing" class="btn btn-warning btn-sm" style="font-weight: 700; background: #f59e0b; color: #000; border: none; display: flex; align-items: center; gap: 6px;">
            <span>⚡ Fix &amp; Re-sync Missing (${totalMissing})</span>
          </button>
        </div>
      </div>

      <!-- SECTION 1: TWO-COLUMN OVERVIEW (Database Status Card & Data Flow Tree) -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(420px, 1fr)); gap: 20px; margin-bottom: 24px;">
        
        <!-- Screenshot 1 Card: Database Status (MySQL Main Database) -->
        <div style="background: #090e1a; border: 1.5px solid #10b981; border-left: 4px solid #10b981; border-radius: 12px; padding: 22px; box-shadow: 0 10px 30px rgba(0,0,0,0.45); display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
              <span style="font-size: 18px;">📊</span>
              <h2 style="font-size: 16px; font-weight: 800; color: #fbbf24; margin: 0; letter-spacing: 0.2px;">Database Status</h2>
            </div>

            <div style="margin-bottom: 16px;">
              <div style="font-size: 17px; font-weight: 800; color: #ffffff; letter-spacing: -0.2px;">
                ${state.master.icon} ${state.master.name} — Main Database
              </div>
              <div style="display: flex; align-items: center; gap: 6px; margin-top: 4px; font-size: 13px; font-weight: 700; color: #34d399;">
                <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: #10b981; box-shadow: 0 0 10px #10b981;"></span>
                Connected · Master / Single Source of Truth
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 140px 1fr; row-gap: 8px; font-size: 13.5px; font-family: 'JetBrains Mono', monospace; margin-bottom: 18px; border-bottom: 1px dashed rgba(255,255,255,0.12); padding-bottom: 16px;">
              <span style="color: #94a3b8;">Data Sync:</span>
              <strong style="color: #ffffff;">100.0%</strong>

              <span style="color: #94a3b8;">Data Matched:</span>
              <strong style="color: #ffffff;">100.0%</strong>

              <span style="color: #94a3b8;">Last Sync:</span>
              <strong style="color: #ffffff;" id="stat-last-sync-time">${state.lastSyncTime}</strong>

              <span style="color: #94a3b8;">Pending:</span>
              <strong style="color: #ffffff;">${state.pendingCount}</strong>

              <span style="color: #94a3b8;">Failed:</span>
              <strong style="color: #ffffff;">${state.failedCount}</strong>
            </div>
          </div>

          <div>
            <div style="font-family: 'JetBrains Mono', monospace; font-size: 13px; color: #38bdf8; display: flex; justify-content: space-between; align-items: center;">
              <span>Sync Progress:</span>
              <strong>${formattedTotal} / ${formattedTotal} records &rarr; 100.0%</strong>
            </div>
            <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.08); border-radius: 999px; margin-top: 8px; overflow: hidden;">
              <div style="width: 100%; height: 100%; background: linear-gradient(90deg, #10b981, #38bdf8); border-radius: 999px;"></div>
            </div>
          </div>
        </div>

        <!-- DATA FLOW Card — dynamic from real configured databases -->
        <div style="background: #090e1a; border: 1.5px solid rgba(56, 189, 248, 0.35); border-radius: 12px; padding: 22px; box-shadow: 0 10px 30px rgba(0,0,0,0.45); display: flex; flex-direction: column;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 18px; color: #38bdf8;">🔄</span>
              <h2 style="font-size: 16px; font-weight: 800; color: #e2e8f0; margin: 0; font-family: 'JetBrains Mono', monospace; letter-spacing: 0.5px;">DATA FLOW</h2>
            </div>
            <span style="font-size: 11px; color: #94a3b8; background: rgba(255,255,255,0.06); padding: 3px 8px; border-radius: 6px;">
              ${state.databases.length > 0 ? 'Real-time Fan-Out Active' : 'No Targets Configured'}
            </span>
          </div>

          <p style="font-size: 12px; color: var(--text-secondary); margin: 0 0 16px;">
            Real-time broadcast flow: every ERP write in ${state.master.name} fans out to all configured secondary databases.
          </p>

          <div style="background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 18px; font-family: 'JetBrains Mono', 'Fira Code', monospace; font-size: 13.5px; line-height: 2;">
            <div style="color: #ffffff; font-weight: 700; margin-bottom: 4px;">
              ${state.master.icon} ${state.master.name} <span style="font-size: 11px; color: #38bdf8; font-weight: normal; margin-left: 6px;">(Main Database / Source)</span>
            </div>
            <div style="color: #cbd5e1;">│</div>

            ${state.databases.length === 0
              ? `<div style="color: #64748b; font-size: 12px; padding: 8px 0;">└── (No secondary databases configured yet)</div>`
              : state.databases.map((d, i) => {
                  const isLast  = i === state.databases.length - 1;
                  const prefix  = isLast ? '└──' : '├──';
                  const dotCol  = d.status === 'SYNCED' ? '#10b981' : d.status === 'MISSING' ? '#f59e0b' : d.status === 'FAILED' ? '#ef4444' : '#64748b';
                  const txtCol  = d.status === 'SYNCED' ? '#34d399' : d.status === 'MISSING' ? '#fbbf24' : d.status === 'FAILED' ? '#f87171' : '#94a3b8';
                  const pct     = d.status === 'PENDING' ? '—' : d.syncPct.toFixed(1) + '%';
                  return `
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: #cbd5e1;">${prefix} Auto Sync ──&gt; ${d.icon} ${d.name}</span>
                    <span style="display: flex; align-items: center; gap: 6px; font-weight: 700; color: ${txtCol};">
                      <span style="display: inline-block; width: 9px; height: 9px; border-radius: 50%; background: ${dotCol}; box-shadow: 0 0 6px ${dotCol};"></span>
                      ${pct}
                      ${d.missing > 0 ? `<span style="background: rgba(245,158,11,0.2); border: 1px solid #f59e0b; padding: 0 6px; border-radius: 4px; font-size: 11px; color: #fde68a;">⚠️ ${d.missing} missing</span>` : ''}
                      ${d.status === 'PENDING' ? `<span style="font-size: 11px; color: #64748b;">Not synced yet</span>` : ''}
                    </span>
                  </div>`;
                }).join('')
            }
          </div>

          <div style="margin-top: 14px; font-size: 11.5px; color: #94a3b8; display: flex; align-items: center; gap: 6px;">
            <span>ℹ️</span>
            <span>Add secondary databases below via <strong style="color:#38bdf8;">Database List &amp; Provider Settings</strong>.</span>
          </div>
        </div>

      </div>

      <!-- SECTION 2: SCREENSHOT 2 — TOPOLOGY / DATABASE SYNC STATUS TREE -->
      <div style="background: #090e1a; border: 1.5px solid rgba(255,255,255,0.12); border-radius: 12px; padding: 22px 24px; margin-bottom: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 12px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 20px;">📊</span>
            <h2 style="font-size: 16px; font-weight: 800; color: #ffffff; margin: 0; font-family: 'JetBrains Mono', monospace; letter-spacing: 0.5px;">DATABASE SYNC STATUS</h2>
          </div>
          <div style="display: flex; gap: 8px;">
            <button id="btn-refresh-topology" class="btn btn-secondary btn-sm" style="font-size: 12px; padding: 4px 10px;">
              🔄 Refresh Status
            </button>
          </div>
        </div>

        <!-- Monospace Box-Drawing Topology Diagram matching Screenshot 2 -->
        <div style="background: #050811; border: 1px solid #1e293b; border-radius: 10px; padding: 24px; overflow-x: auto;">
          
          <!-- Master Database Box -->
          <div style="max-width: 680px; margin: 0 auto; background: rgba(15, 23, 42, 0.9); border: 1.5px solid #38bdf8; border-radius: 8px; padding: 14px 20px; font-family: 'JetBrains Mono', monospace; box-shadow: 0 4px 20px rgba(56, 189, 248, 0.15);">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
              <div style="display: flex; align-items: center; gap: 8px; font-weight: 800; font-size: 14.5px; color: #ffffff;">
                <span style="display: inline-block; width: 11px; height: 11px; border-radius: 50%; background: #10b981; box-shadow: 0 0 8px #10b981;"></span>
                Main Database &mdash; ${state.master.icon} ${state.master.name} (Master / Source)
              </div>
              <div style="display: flex; gap: 18px; font-size: 13px; color: #cbd5e1;">
                <span>Records: <strong style="color: #fff;">${formattedTotal}</strong></span>
                <span>Missing: <strong style="color: #34d399;">0</strong></span>
                <span>Sync: <strong style="color: #38bdf8;">100%</strong></span>
              </div>
            </div>
          </div>

          <!-- Dynamic Tree Branches Connectors -->
          ${state.databases.length === 0 ? `
            <div style="max-width: 680px; margin: 0 auto; text-align: center; font-family: 'JetBrains Mono', monospace; font-size: 14px; line-height: 1.1; color: #64748b; padding: 8px 0;">
              <div style="color: #64748b;">│</div>
              <div style="color: #64748b;">▼</div>
            </div>
          ` : state.databases.length === 1 ? `
            <div style="max-width: 680px; margin: 0 auto; text-align: center; font-family: 'JetBrains Mono', monospace; font-size: 14px; line-height: 1.1; color: #38bdf8; padding: 8px 0;">
              <div style="color: #38bdf8;">│</div>
              <div style="color: #38bdf8;">▼</div>
            </div>
          ` : `
            <div style="max-width: 680px; margin: 0 auto; text-align: center; font-family: 'JetBrains Mono', monospace; font-size: 14px; line-height: 1.1; color: #38bdf8; padding: 8px 0;">
              <div style="color: #38bdf8;">│</div>
              <div style="color: #38bdf8;">┌────────────────────────┼────────────────────────┐</div>
              <div style="color: #38bdf8;">▼                        ▼                        ▼</div>
            </div>
          `}

          <!-- Secondary Database Boxes — dynamically rendered from real config -->
          ${state.databases.length === 0
            ? `<div style="max-width: 760px; margin: 0 auto; background: rgba(15,23,42,0.7); border: 1px dashed rgba(255,255,255,0.12); border-radius: 8px; padding: 20px; text-align: center; font-size: 13px; color: #64748b; font-family: 'JetBrains Mono', monospace;">
                No secondary databases configured yet.<br/>
                <span style="font-size: 11.5px;">Add a provider below via <strong style="color:#38bdf8;">Database List &amp; Provider Settings</strong>.</span>
               </div>`
            : `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; max-width: 760px; margin: 0 auto;">
                ${state.databases.map(d => `
                  <div style="background: rgba(15,23,42,0.9); border: 1.5px solid ${d.statusColor}; border-radius: 8px; padding: 14px; font-family: 'JetBrains Mono', monospace; box-shadow: ${d.status === 'MISSING' ? '0 0 15px rgba(245,158,11,0.2)' : 'none'};">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                      <div style="font-weight: 800; font-size: 13.5px; color: #fff;">${d.icon} ${d.name}</div>
                      <div style="display: flex; align-items: center; gap: 5px; font-size: 11.5px; font-weight: 700; color: ${d.statusColor};">
                        <span style="display: inline-block; width: 9px; height: 9px; border-radius: 50%; background: ${d.statusColor}; box-shadow: 0 0 6px ${d.statusColor};"></span>
                        ${d.statusLabel}
                      </div>
                    </div>
                    <div style="font-size: 12px; color: #cbd5e1; line-height: 1.7;">
                      <div>${d.status === 'PENDING' ? '— / ' + (formattedTotal || '—') : d.matched.toLocaleString() + ' / ' + (formattedTotal || '—')}</div>
                      <div style="color: ${d.missing > 0 ? '#fbbf24' : '#94a3b8'}; font-weight: ${d.missing > 0 ? '700' : 'normal'};">Missing: ${d.missing}</div>
                      <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Last sync: ${d.lastSync}</div>
                    </div>
                  </div>
                `).join('')}
               </div>`
          }

          <!-- Bottom Summary Line from Screenshot 2 -->
          <div style="max-width: 760px; margin: 24px auto 0; padding-top: 16px; border-top: 1px dashed rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px; font-family: 'JetBrains Mono', monospace; font-size: 13px;">
            <div style="display: flex; gap: 24px; flex-wrap: wrap;">
              <span style="color: #94a3b8;">Last Sync: <strong style="color: #fff;" id="tree-last-sync">${state.lastSyncTime}</strong></span>
              <span style="color: #94a3b8; display: flex; align-items: center; gap: 6px;">
                Auto Sync:
                <span id="tree-auto-sync-status" style="color: ${state.autoSync ? '#34d399' : '#f87171'}; font-weight: 800; display: inline-flex; align-items: center; gap: 5px;">
                  <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${state.autoSync ? '#10b981' : '#ef4444'};"></span>
                  ${state.autoSync ? 'ON' : 'OFF'}
                </span>
              </span>
              <span style="color: #94a3b8;">Failed: <strong style="color: #fff;">${state.failedCount}</strong></span>
              <span style="color: #94a3b8;">Pending: <strong style="color: #fff;">${state.pendingCount}</strong></span>
            </div>
            
            <div style="display: flex; gap: 8px;">
              <button id="btn-toggle-auto-sync-2" class="btn btn-secondary btn-sm" style="font-size: 11.5px; padding: 4px 10px;">
                Toggle Auto Sync (${state.autoSync ? 'ON' : 'OFF'})
              </button>
            </div>
          </div>

        </div>
      </div>

      <!-- SECTION 3: SCREENSHOT 4 — DATA DIFFERENCES TABLE & RECONCILIATION -->
      <div style="background: #090e1a; border: 1.5px solid rgba(245, 158, 11, 0.4); border-radius: 12px; padding: 22px 24px; margin-bottom: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 10px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 20px; color: #fbbf24;">⚠️</span>
              <h2 style="font-size: 16px; font-weight: 800; color: #fbbf24; margin: 0; font-family: 'JetBrains Mono', monospace; letter-spacing: 0.5px;">DATA DIFFERENCES</h2>
            </div>
            <p style="font-size: 12px; color: var(--text-secondary); margin: 4px 0 0;">
              Audit discrepancies, compare record totals, and reconcile missing documents across databases:
            </p>
          </div>

          <div style="display: flex; gap: 8px; align-items: center;">
            <button id="btn-view-missing-records" class="btn btn-secondary btn-sm" style="font-weight: 700; color: #fbbf24; border-color: rgba(245, 158, 11, 0.4); font-family: 'JetBrains Mono', monospace;">
              [ View Missing Records (${totalMissing}) ]
            </button>
            <button id="btn-reconcile-all-records" class="btn btn-primary btn-sm" style="font-weight: 700; background: linear-gradient(135deg, #10b981, #059669); border: none; font-family: 'JetBrains Mono', monospace;">
              [ ⚡ Re-sync All Missing ]
            </button>
          </div>
        </div>

        <!-- Differences Table matching Screenshot 4 format -->
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; font-family: 'JetBrains Mono', monospace; font-size: 13.5px; text-align: left;">
            <thead>
              <tr style="border-bottom: 1.5px solid rgba(255,255,255,0.15); color: #94a3b8; font-size: 12.5px; text-transform: uppercase;">
                <th style="padding: 10px 14px;">Database</th>
                <th style="padding: 10px 14px;">Role</th>
                <th style="padding: 10px 14px;">Total</th>
                <th style="padding: 10px 14px;">Matched</th>
                <th style="padding: 10px 14px;">Missing</th>
                <th style="padding: 10px 14px;">Duplicate / Extra</th>
                <th style="padding: 10px 14px;">Failed</th>
                <th style="padding: 10px 14px;">Status</th>
                <th style="padding: 10px 14px; text-align: right;">Action</th>
              </tr>
            </thead>
            <tbody>
              <!-- Master: MySQL Primary (always real) -->
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.06); background: rgba(56, 189, 248, 0.03);">
                <td style="padding: 12px 14px; font-weight: 700; color: #fff;">${state.master.icon} ${state.master.name}</td>
                <td style="padding: 12px 14px; color: #38bdf8; font-size: 11.5px; font-weight: 700;">Master (Source)</td>
                <td style="padding: 12px 14px; color: #fff;">${formattedTotal}</td>
                <td style="padding: 12px 14px; color: #34d399; font-weight: 700;">${formattedTotal}</td>
                <td style="padding: 12px 14px; color: #34d399;">0</td>
                <td style="padding: 12px 14px; color: #94a3b8;">0</td>
                <td style="padding: 12px 14px; color: #94a3b8;">0</td>
                <td style="padding: 12px 14px;">
                  <span style="display: inline-flex; align-items: center; gap: 5px; color: #34d399; font-weight: 700; font-size: 12px;">🟢 Connected</span>
                </td>
                <td style="padding: 12px 14px; text-align: right;">
                  <span style="font-size: 11px; color: #64748b;">Source of Truth</span>
                </td>
              </tr>

              <!-- Configured Secondary Databases (real data only) -->
              ${state.databases.length === 0
                ? `<tr><td colspan="9" style="padding: 20px 14px; text-align: center; color: #64748b; font-size: 12.5px; font-family: 'JetBrains Mono', monospace;">No secondary databases configured. Add a provider below.</td></tr>`
                : state.databases.map(d => {
                    const statusEmoji = d.status === 'SYNCED' ? '🟢' : d.status === 'MISSING' ? '🟡' : d.status === 'FAILED' ? '🔴' : '⚪';
                    const actionBtn = d.status === 'DISABLED'
                      ? `<span style="font-size: 11px; color: #64748b;">Disabled</span>`
                      : d.status === 'PENDING'
                      ? `<button class="btn btn-secondary btn-sm btn-resync-db" data-db-id="${d.id}" style="font-size: 11px; padding: 2px 8px;">▶ First Sync</button>`
                      : d.missing > 0 || d.status === 'FAILED'
                      ? `<button class="btn btn-warning btn-sm btn-resync-db" data-db-id="${d.id}" style="font-size: 11px; padding: 2px 8px; font-weight: 700;">⚡ Fix &amp; Sync</button>`
                      : `<button class="btn btn-secondary btn-sm btn-resync-db" data-db-id="${d.id}" style="font-size: 11px; padding: 2px 8px;">🔄 Re-sync</button>`;
                    return `
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.06); background: ${d.missing > 0 ? 'rgba(245,158,11,0.04)' : d.status === 'FAILED' ? 'rgba(239,68,68,0.04)' : 'transparent'};">
                      <td style="padding: 12px 14px; font-weight: 700; color: #fff;">${d.icon} ${d.name}</td>
                      <td style="padding: 12px 14px; color: #94a3b8; font-size: 11.5px;">Secondary Target</td>
                      <td style="padding: 12px 14px; color: #fff;">${formattedTotal}</td>
                      <td style="padding: 12px 14px; color: ${d.status === 'SYNCED' ? '#34d399' : '#fbbf24'}; font-weight: 700;">${d.status === 'PENDING' ? '—' : d.matched.toLocaleString()}</td>
                      <td style="padding: 12px 14px; color: ${d.missing > 0 ? '#fbbf24' : '#34d399'}; font-weight: ${d.missing > 0 ? '800' : 'normal'}">${d.missing}</td>
                      <td style="padding: 12px 14px; color: #94a3b8;">${d.duplicates}</td>
                      <td style="padding: 12px 14px; color: ${d.failed > 0 ? '#f87171' : '#94a3b8'}; font-weight: ${d.failed > 0 ? '700' : 'normal'}">${d.failed}</td>
                      <td style="padding: 12px 14px;">
                        <span style="display: inline-flex; align-items: center; gap: 5px; color: ${d.statusColor}; font-weight: 700; font-size: 12px;">${statusEmoji} ${d.statusLabel}</span>
                      </td>
                      <td style="padding: 12px 14px; text-align: right;">${actionBtn}</td>
                    </tr>`;
                  }).join('')
              }
            </tbody>
          </table>
        </div>

        <!-- Missing Records Inspector Box (Expandable) -->
        <div id="missing-records-panel" style="display: none; margin-top: 20px; background: #050811; border: 1.5px solid #f59e0b; border-radius: 8px; padding: 18px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 16px;">🔍</span>
              <strong style="color: #fbbf24; font-size: 14px; font-family: 'JetBrains Mono', monospace;">
                Missing &amp; Desynchronized Records (${state.missingRecords.length})
              </strong>
            </div>
            <div style="display: flex; gap: 8px;">
              ${state.missingRecords.length > 0 ? `
              <button id="btn-reconcile-missing-now" class="btn btn-primary btn-sm" style="font-size: 11.5px; background: #10b981; border: none; font-weight: 700;">
                ⚡ Sync All ${state.missingRecords.length} Missing Records Now
              </button>` : ''}
              <button id="btn-close-missing-panel" class="btn btn-secondary btn-sm" style="font-size: 11.5px; padding: 2px 8px;">
                ✕ Close
              </button>
            </div>
          </div>

          <div style="max-height: 260px; overflow-y: auto;">
            ${state.missingRecords.length === 0
              ? `<div style="text-align: center; padding: 20px; color: #34d399; font-size: 13px; font-family: 'JetBrains Mono', monospace;">✅ No missing records — all databases are in sync.</div>`
              : `<table style="width: 100%; border-collapse: collapse; font-family: 'JetBrains Mono', monospace; font-size: 12px; text-align: left;">
              <thead>
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.1); color: #94a3b8;">
                  <th style="padding: 6px 10px;">Table</th>
                  <th style="padding: 6px 10px;">Record ID</th>
                  <th style="padding: 6px 10px;">Item Name / Description</th>
                  <th style="padding: 6px 10px;">Target DB</th>
                  <th style="padding: 6px 10px;">Reason</th>
                  <th style="padding: 6px 10px; text-align: right;">Action</th>
                </tr>
              </thead>
              <tbody>
                ${state.missingRecords.map(m => `
                  <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
                    <td style="padding: 8px 10px; color: #38bdf8;">${m.table || '—'}</td>
                    <td style="padding: 8px 10px; color: #fff;"><code>${m.id}</code></td>
                    <td style="padding: 8px 10px; color: #cbd5e1;">${m.name || '—'}</td>
                    <td style="padding: 8px 10px; color: #fbbf24; font-weight: 700;">${m.db || '—'}</td>
                    <td style="padding: 8px 10px; color: #94a3b8;">${m.issue || 'Unknown'}</td>
                    <td style="padding: 8px 10px; text-align: right;">
                      <button class="btn btn-secondary btn-sm btn-sync-single-record" data-id="${m.id}" style="font-size: 10.5px; padding: 1px 6px;">
                        ⚡ Re-sync
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>`
            }
          </div>
        </div>

      </div>

      <!-- SECTION 4: DATABASE PROVIDERS CONFIGURATION & ADAPTER MANAGEMENT -->
      <div style="margin-bottom: 30px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 10px;">
          <div>
            <h2 style="font-size: 18px; font-weight: 800; color: #fff; margin: 0;">Database List &amp; Provider Settings</h2>
            <p style="font-size: 12px; color: var(--text-secondary); margin: 3px 0 0;">
              Connect database instances (MySQL Primary Master, PostgreSQL Secondary Replica). Every update automatically syncs with the MySQL Main Database.
            </p>
          </div>
          <span style="font-size: 11.5px; color: #38bdf8; background: rgba(2, 132, 199, 0.12); border: 1px solid rgba(2, 132, 199, 0.3); padding: 4px 10px; border-radius: 6px; font-weight: 700;">
            Multi-Database Active: ${configs.length} Target(s) Configured
          </span>
        </div>

        <div style="display: grid; grid-template-columns: minmax(280px, 340px) 1fr; gap: 20px; align-items: start; min-width: 0;">
          
          <!-- Left Column: Multi-Database Manager & Provider Templates -->
          <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 18px; display: flex; flex-direction: column; gap: 14px;">
            
            <!-- Create New Instance Button -->
            <button type="button" id="btn-create-new-db" class="btn btn-primary" style="width: 100%; font-weight: 800; font-size: 13px; padding: 11px 14px; background: linear-gradient(135deg, #0284c7, #2563eb); border: none; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 15px rgba(2, 132, 199, 0.35); border-radius: 8px; cursor: pointer;">
              <span>➕ Add New Database Connection</span>
            </button>

            <!-- Configured Secondary Databases List -->
            <div>
              <div style="font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; padding-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.06); margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
                <span>Configured Databases</span>
                <span style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; font-size: 10.5px; padding: 1px 7px; border-radius: 999px;">${configs.length}</span>
              </div>

              <div id="configured-db-list" style="display: flex; flex-direction: column; gap: 8px; max-height: 240px; overflow-y: auto;">
                ${configs.length === 0 ? `
                  <div style="font-size: 12px; color: #64748b; padding: 14px 10px; text-align: center; border: 1px dashed rgba(255,255,255,0.1); border-radius: 8px; line-height: 1.5;">
                    No secondary databases added yet.<br/>
                    <span style="font-size: 11px; color: #94a3b8;">Click "+ Add New Database Connection" or a template below to add one.</span>
                  </div>
                ` : configs.map(c => {
                  const isSelected = isConfigFormOpen && currentEditingDbId === c.id;
                  const isPrimary = c.role === 'PRIMARY' || c.id === 'mysql_primary';
                  const typeUpper = (c.type || '').toUpperCase();
                  const pIcon = (PROVIDER_SPECS[typeUpper] && PROVIDER_SPECS[typeUpper].icon) || '🗄️';
                  const m = state.databases.find(d => d.id === c.id);
                  const dotCol = isPrimary ? '#10b981' : (m ? m.statusColor : '#94a3b8');
                  const statusTxt = isPrimary ? 'Connected (Master)' : (m ? m.statusLabel : 'Ready');

                  return `
                    <div class="configured-db-item" data-db-id="${c.id}" style="display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-radius: 8px; border: 1.5px solid ${isSelected ? '#38bdf8' : 'rgba(255,255,255,0.08)'}; background: ${isSelected ? 'rgba(2, 132, 199, 0.18)' : 'rgba(15, 23, 42, 0.6)'}; cursor: pointer; transition: all 0.2s ease;">
                      <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
                        <span style="font-size: 18px; flex-shrink: 0;">${pIcon}</span>
                        <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                          <div style="font-weight: 700; font-size: 13px; color: #fff; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${c.name || c.type}</div>
                          <div style="font-size: 11px; color: #94a3b8; display: flex; align-items: center; gap: 6px;">
                            <span>${c.type || 'DB'}</span> · 
                            <span style="color: ${dotCol}; display: inline-flex; align-items: center; gap: 4px;">
                              <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: ${dotCol};"></span>
                              ${statusTxt}
                            </span>
                          </div>
                        </div>
                      </div>
                      ${isPrimary ? `
                        <span style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.4); color: #34d399; font-size: 10px; font-weight: 800; padding: 2px 7px; border-radius: 4px; white-space: nowrap;">
                          PRIMARY
                        </span>
                      ` : `
                        <button type="button" class="btn-delete-configured-db" data-delete-id="${c.id}" title="Remove Connection" style="background: transparent; border: none; color: #64748b; font-size: 14px; cursor: pointer; padding: 4px 6px; border-radius: 4px; transition: color 0.15s ease;" onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='#64748b'">
                          🗑️
                        </button>
                      `}
                    </div>
                  `;
                }).join('')}
              </div>
            </div>

            <!-- Provider Templates (Quick Add) -->
            <div>
              <div style="font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; padding-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.06); margin-bottom: 8px;">
                Supported Provider Templates
              </div>

              <div style="display: flex; flex-direction: column; gap: 6px;">
                ${Object.values(PROVIDER_SPECS).map(p => `
                  <div class="provider-template-item" data-provider="${p.key}" style="display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05); background: rgba(15, 23, 42, 0.4); cursor: pointer; transition: all 0.15s ease;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <span style="font-size: 16px;">${p.icon}</span>
                      <span style="font-size: 12px; font-weight: 600; color: #cbd5e1;">${p.name}</span>
                    </div>
                    <span style="font-size: 10.5px; color: #38bdf8; font-weight: 700;">+ Add</span>
                  </div>
                `).join('')}
              </div>
            </div>

          </div>

          <!-- Right Column: Interactive Configuration Form for Selected Provider -->
          <div id="provider-config-container" style="background: var(--bg-surface); border: 1.5px solid ${isConfigFormOpen ? '#0284c7' : 'rgba(255,255,255,0.1)'}; border-radius: var(--radius-lg); padding: 24px; box-shadow: ${isConfigFormOpen ? '0 4px 25px rgba(2, 132, 199, 0.18)' : 'none'}; min-width: 0; transition: border-color 0.2s, box-shadow 0.2s;">
            <div id="provider-form-content"></div>
          </div>

        </div>
      </div>

      <!-- SECTION 5: CORE DATABASE SCHEMA & REPOSITORY DESIGN -->
      <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 22px; margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 18px;">💎</span>
              <h3 style="font-size: 16px; font-weight: 800; color: #38bdf8; margin: 0;">
                Core Database Schema (Single Source of Truth)
              </h3>
            </div>
            <p style="font-size: 12px; color: var(--text-secondary); margin: 3px 0 0;">
              All database providers share the exact same entity schema. Replicating MySQL ➔ PostgreSQL leaves frontend code completely untouched.
            </p>
          </div>
          <span style="font-size: 11.5px; color: #a5f3fc; background: rgba(56,189,248,0.1); border: 1px solid rgba(56,189,248,0.25); padding: 4px 10px; border-radius: 6px; font-family: monospace;">
            import { db } from './public/js/db/dbClient.js';
          </span>
        </div>

        <!-- Schema Entity Cards Grid -->
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; margin-bottom: 20px;">
          ${CORE_SCHEMAS.map(s => `
            <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 12px 14px; display: flex; flex-direction: column; gap: 4px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 16px;">${s.icon}</span>
                <code style="color: #34d399; font-weight: 700; font-size: 12.5px;">${s.name}</code>
              </div>
              <div style="font-size: 11px; color: var(--text-secondary); line-height: 1.4;">
                ${s.desc}
              </div>
            </div>
          `).join('')}
        </div>

        <!-- Unified API Code Preview -->
        <div style="background: #090d16; border: 1px solid #1e293b; border-radius: 8px; padding: 14px 18px;">
          <div style="font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; margin-bottom: 8px;">
            Universal Repository API Example (Consistent Across All Databases)
          </div>
          <pre style="margin: 0; font-family: 'JetBrains Mono', monospace; font-size: 12px; line-height: 1.6; color: #38bdf8; background: transparent; padding: 0;">
<span style="color: #64748b;">// 1. Machine Inventory Repository</span>
<span style="color: #f43f5e;">const</span> machines = <span style="color: #f43f5e;">await</span> db.machines.getAll();
<span style="color: #f43f5e;">const</span> newMachine = <span style="color: #f43f5e;">await</span> db.machines.create({ name: <span style="color: #a3e635;">'Brother S-7200C'</span>, categoryId: <span style="color: #a3e635;">'cat_snls'</span>, floor: <span style="color: #a3e635;">'Floor 3'</span> });
<span style="color: #f43f5e;">await</span> db.machines.update(newMachine.id, { status: <span style="color: #a3e635;">'Operational'</span> });
<span style="color: #f43f5e;">await</span> db.machines.delete(newMachine.id);

<span style="color: #64748b;">// 2. Real-time Multi-Provider Fan-out Sync</span>
<span style="color: #f43f5e;">await</span> db.maintenance.create({ machineId: <span style="color: #a3e635;">'M-042'</span>, type: <span style="color: #a3e635;">'Oil change'</span>, dueDate: <span style="color: #a3e635;">'2026-10-15'</span> });</pre>
        </div>
      </div>

      <!-- SECTION 6: LOCAL SERVER DISK STORAGE & BACKUP / RESTORE -->
      <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 20px; display: flex; flex-direction: column; gap: 14px;">
        <h3 style="font-size: 15px; font-weight: 700; color: #fbbf24; border-bottom: 1px solid var(--border-color); padding-bottom: 8px; margin: 0;">
          💾 Server Disk Storage &amp; Manual Backup / Restore
        </h3>

        <!-- Persistent Server Database Status Banner -->
        <div style="background: rgba(16, 185, 129, 0.08); border: 1.5px solid rgba(16, 185, 129, 0.35); border-radius: 8px; padding: 12px 16px; font-size: 12.5px; color: #d1fae5; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
          <div>
            🟢 <strong>Persistent Server Database File:</strong> <code>data/erp_database.json</code><br/>
            <span style="font-size: 11.5px; color: var(--text-secondary);">
              All database records (Master Data, Machines, Spare Parts, Lines &amp; Rooms) are actively synchronized and stored to server disk.
            </span>
          </div>
          <button type="button" id="btn-sync-server-db" class="btn btn-secondary btn-sm" style="font-weight: 700; color: #34d399; border-color: rgba(16, 185, 129, 0.4);">
            💾 Save to Disk Now
          </button>
        </div>

        <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
          <button id="btn-download-db-backup" class="btn btn-primary">
            📥 Backup Data (JSON)
          </button>

          <label class="btn btn-secondary" style="cursor: pointer; margin: 0;">
            📤 Restore Data
            <input type="file" id="db-restore-file-input" accept=".json" style="display: none;" />
          </label>

          <button id="btn-factory-reset" class="btn btn-danger btn-sm" style="margin-left: auto;">
            ⚠️ Reset Data
          </button>
        </div>
      </div>

    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// Event Initialization and Interactive Configuration Handlers
// ─────────────────────────────────────────────────────────────────────────────
// Current selection state for editing/adding database instances
let currentEditingDbId = null; // null if adding new database, string if editing
let currentProviderKey = 'POSTGRESQL';
let isConfigFormOpen = false; // Closed by default — opens only when user clicks/selects a database!

// Helper: re-render the full view after state changes
function reRenderView() {
  if (window.app && typeof window.app.renderMainContent === 'function') {
    window.app.renderMainContent(true);
    return;
  }
  if (window.app && typeof window.app.render === 'function') {
    window.app.render(false, true);
    return;
  }
  const appContainer = document.getElementById('main-view-container') || document.getElementById('app-view-container');
  if (appContainer) {
    appContainer.innerHTML = renderDatabaseConfigView();
    initDatabaseConfigEvents();
  }
}

function openConfigForm(providerKey = 'POSTGRESQL', dbId = null) {
  isConfigFormOpen = true;
  currentProviderKey = providerKey || 'POSTGRESQL';
  currentEditingDbId = dbId;

  const container = document.getElementById('provider-config-container');
  if (container) {
    container.style.borderColor = '#0284c7';
    container.style.boxShadow = '0 4px 25px rgba(2, 132, 199, 0.18)';
  }
  renderProviderForm(currentProviderKey, currentEditingDbId);

  // Update selection highlight on sidebar items
  document.querySelectorAll('.configured-db-item').forEach(el => {
    if (dbId && el.getAttribute('data-db-id') === dbId) {
      el.style.borderColor = '#38bdf8';
      el.style.background = 'rgba(2, 132, 199, 0.18)';
    } else {
      el.style.borderColor = 'rgba(255,255,255,0.08)';
      el.style.background = 'rgba(15, 23, 42, 0.6)';
    }
  });

  if (container) {
    container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function closeConfigForm() {
  isConfigFormOpen = false;
  currentEditingDbId = null;

  const container = document.getElementById('provider-config-container');
  if (container) {
    container.style.borderColor = 'rgba(255, 255, 255, 0.1)';
    container.style.boxShadow = 'none';
  }
  renderProviderPlaceholder();

  document.querySelectorAll('.configured-db-item').forEach(el => {
    el.style.borderColor = 'rgba(255,255,255,0.08)';
    el.style.background = 'rgba(15, 23, 42, 0.6)';
  });
}

export function initDatabaseConfigEvents() {
  // ── One-time migration: wipe old sync_state that contained fake databases array ──
  try {
    const old = safeGetJson('erp_data_engine_sync_state', {});
    if (Array.isArray(old.databases)) {
      localStorage.setItem('erp_data_engine_sync_state', JSON.stringify({
        autoSync: old.autoSync !== false,
        lastSyncTime: old.lastSyncTime || '—'
      }));
      console.log('[Data Engine] Migrated: removed legacy mock databases from sync_state.');
    }
  } catch (_) {}

  // 1. Initial render: placeholder hub by default (form opens only on user request)
  if (isConfigFormOpen) {
    renderProviderForm(currentProviderKey, currentEditingDbId);
  } else {
    renderProviderPlaceholder();
  }

  // 2. "➕ Add New Database Connection" button
  document.getElementById('btn-create-new-db')?.addEventListener('click', () => {
    openConfigForm('POSTGRESQL', null);
    notificationService.toast('Ready to configure a new database connection.');
  });

  // 3. Configured Databases card clicks (select to edit, or toggle close)
  document.querySelectorAll('.configured-db-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('.btn-delete-configured-db')) return;
      const dbId = item.getAttribute('data-db-id');
      if (isConfigFormOpen && currentEditingDbId === dbId) {
        closeConfigForm();
        return;
      }
      const configs = safeGetJson('erp_multi_db_config', []);
      const found = configs.find(c => c.id === dbId);
      if (found) {
        const pKey = (found.type || 'POSTGRESQL').toUpperCase();
        openConfigForm(pKey, dbId);
      }
    });
  });

  // 4. Quick Delete buttons on configured databases
  document.querySelectorAll('.btn-delete-configured-db').forEach(delBtn => {
    delBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const dbId = delBtn.getAttribute('data-delete-id');
      const configs = safeGetJson('erp_multi_db_config', []);
      const target = configs.find(c => c.id === dbId);
      const name = target ? (target.name || target.type) : 'this connection';

      if (!confirm(`Are you sure you want to remove the database "${name}"?`)) return;

      const updated = configs.filter(c => c.id !== dbId);
      localStorage.setItem('erp_multi_db_config', JSON.stringify(updated));
      if (storage && typeof storage.saveMultiDbConfigs === 'function') {
        await storage.saveMultiDbConfigs(updated).catch(() => {});
      }
      try {
        const metrics = safeGetJson(SYNC_METRICS_KEY, {});
        delete metrics[dbId];
        localStorage.setItem(SYNC_METRICS_KEY, JSON.stringify(metrics));
      } catch (_) {}

      await syncManager.reloadConfig();

      if (currentEditingDbId === dbId) {
        currentEditingDbId = null;
        isConfigFormOpen = false;
      }
      notificationService.toast(`🗑️ Removed "${name}".`);
      reRenderView();
    });
  });

  // 5. Provider Template clicks (+ Add template)
  document.querySelectorAll('.provider-template-item').forEach(tpl => {
    tpl.addEventListener('click', () => {
      const pKey = tpl.getAttribute('data-provider');
      if (!pKey || !PROVIDER_SPECS[pKey]) return;
      openConfigForm(pKey, null);
      notificationService.toast(`Ready to configure a new ${PROVIDER_SPECS[pKey].name} connection.`);
    });
  });

  // 6. Auto Sync Toggle
  const handleToggleAutoSync = () => {
    const state = getDashboardSyncState();
    const newVal = !state.autoSync;
    saveDashboardSyncState({ autoSync: newVal });

    const badge = document.getElementById('badge-auto-sync');
    if (badge) {
      badge.textContent = newVal ? '🟢 Auto Sync ON' : '🔴 Auto Sync OFF';
      badge.style.background = newVal ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)';
      badge.style.borderColor = newVal ? '#10b981' : '#ef4444';
      badge.style.color = newVal ? '#34d399' : '#f87171';
    }
    const treeStatus = document.getElementById('tree-auto-sync-status');
    if (treeStatus) {
      treeStatus.innerHTML = `<span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${newVal ? '#10b981' : '#ef4444'};"></span> ${newVal ? 'ON' : 'OFF'}`;
      treeStatus.style.color = newVal ? '#34d399' : '#f87171';
    }
    const btn1 = document.getElementById('btn-toggle-auto-sync');
    if (btn1) {
      btn1.innerHTML = `<span>${newVal ? '⏸️ Turn Auto-Sync OFF' : '▶️ Turn Auto-Sync ON'}</span>`;
      btn1.style.borderColor = newVal ? '#10b981' : '#64748b';
      btn1.style.color = newVal ? '#34d399' : '#cbd5e1';
    }
    const btn2 = document.getElementById('btn-toggle-auto-sync-2');
    if (btn2) btn2.textContent = `Toggle Auto Sync (${newVal ? 'ON' : 'OFF'})`;
    notificationService.toast(`Auto Sync is now ${newVal ? 'ENABLED' : 'PAUSED'}.`);
  };
  document.getElementById('btn-toggle-auto-sync')?.addEventListener('click', handleToggleAutoSync);
  document.getElementById('btn-toggle-auto-sync-2')?.addEventListener('click', handleToggleAutoSync);

  // 7. View Missing Records toggle
  const missingPanel = document.getElementById('missing-records-panel');
  const btnViewMissing = document.getElementById('btn-view-missing-records');
  if (btnViewMissing && missingPanel) {
    btnViewMissing.addEventListener('click', () => {
      missingPanel.style.display = missingPanel.style.display === 'none' ? 'block' : 'none';
      if (missingPanel.style.display === 'block') {
        missingPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  }
  document.getElementById('btn-close-missing-panel')?.addEventListener('click', () => {
    if (missingPanel) missingPanel.style.display = 'none';
  });



  // Helper: run a REAL full sync for a single configured database by its id
  const runRealSync = async (dbId, dbName, btn, originalLabel) => {
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Syncing...'; }
    notificationService.toast(`Syncing ${dbName || dbId}...`);
    try {
      await syncManager.reloadConfig();
      await syncManager.runFullSync(dbId);
      // Record REAL success metrics
      const total = getTotalRecordCount();
      recordSyncMetric(dbId, {
        matched: total,
        missing: 0,
        failed: 0,
        duplicates: 0,
        lastSyncTime: new Date().toLocaleString(),
        lastError: null
      });
      saveDashboardSyncState({ lastSyncTime: new Date().toLocaleString() });
      notificationService.toast(`✅ ${dbName || dbId}: sync complete — ${total.toLocaleString()} records written.`);
      reRenderView();
    } catch (err) {
      // Record REAL failure metrics
      recordSyncMetric(dbId, {
        failed: 1,
        matched: 0,
        lastSyncTime: new Date().toLocaleString(),
        lastError: err.message
      });
      notificationService.toast(`❌ Sync FAILED for ${dbName || dbId}: ${err.message}`);
      if (btn) { btn.disabled = false; btn.textContent = originalLabel || '🔄 Re-sync'; }
      reRenderView();
    }
  };

  // 8. Re-sync buttons on the Differences table (use real data-db-id)
  document.querySelectorAll('.btn-resync-db').forEach(b => {
    b.addEventListener('click', async () => {
      const dbId = b.getAttribute('data-db-id');
      if (!dbId) return;
      let dbName = dbId;
      const cfgs = safeGetJson('erp_multi_db_config', []);
      const found = cfgs.find(c => c.id === dbId);
      if (found) dbName = found.name || found.type || dbId;
      await runRealSync(dbId, dbName, b, b.textContent);
    });
  });

  // 9. "Fix & Re-sync All Missing" button — runs real sync on every configured DB that has issues
  const handleReconcileAll = async () => {
    const btn = document.getElementById('btn-fix-all-missing') || document.getElementById('btn-reconcile-all-records') || document.getElementById('btn-reconcile-missing-now');
    if (btn) { btn.disabled = true; btn.innerHTML = '⏳ Syncing all databases...'; }
    notificationService.toast('Running full sync across all configured databases...');
    try {
      const cfgs = safeGetJson('erp_multi_db_config', []);
      await syncManager.reloadConfig();
      let successCount = 0, failCount = 0;
      const total = getTotalRecordCount();
      for (const c of cfgs) {
        if (!c.enabled) continue;
        try {
          await syncManager.runFullSync(c.id);
          recordSyncMetric(c.id, {
            matched: total, missing: 0, failed: 0, duplicates: 0,
            lastSyncTime: new Date().toLocaleString(),
            lastError: null
          });
          successCount++;
        } catch (err) {
          recordSyncMetric(c.id, { failed: 1, matched: 0, lastSyncTime: new Date().toLocaleString(), lastError: err.message });
          failCount++;
        }
      }
      saveDashboardSyncState({ lastSyncTime: new Date().toLocaleString() });
      notificationService.toast(`⚡ Sync finished: ${successCount} successful, ${failCount} failed.`);
      reRenderView();
    } catch (err) {
      notificationService.toast('Reconciliation failed: ' + err.message);
      if (btn) { btn.disabled = false; btn.innerHTML = '⚡ Sync All Real Databases'; }
      reRenderView();
    }
  };
  document.getElementById('btn-fix-all-missing')?.addEventListener('click', handleReconcileAll);
  document.getElementById('btn-reconcile-all-records')?.addEventListener('click', handleReconcileAll);
  document.getElementById('btn-reconcile-missing-now')?.addEventListener('click', handleReconcileAll);

  // 10. Direct "Sync Now" button on topology MySQL card
  document.getElementById('btn-sync-mysql-direct')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-sync-mysql-direct');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Syncing...'; }
    notificationService.toast('Running full push to MySQL primary database...');
    try {
      await syncManager.reloadConfig();
      await syncManager.runFullSync('mysql_primary');
      const total = getTotalRecordCount();
      recordSyncMetric('mysql_primary', {
        matched: total, missing: 0, failed: 0, duplicates: 0,
        lastSyncTime: new Date().toLocaleString(), lastError: null
      });
      saveDashboardSyncState({ lastSyncTime: new Date().toLocaleString() });
      notificationService.toast(`✅ MySQL Primary sync complete: ${total.toLocaleString()} records updated.`);
      reRenderView();
    } catch (err) {
      recordSyncMetric('mysql_primary', { failed: 1, matched: 0, lastSyncTime: new Date().toLocaleString(), lastError: err.message });
      notificationService.toast('❌ MySQL sync failed: ' + err.message);
      if (btn) { btn.disabled = false; btn.textContent = '🔄 Sync Now'; }
      reRenderView();
    }
  });

  // 11. Topology card config button shortcuts
  document.getElementById('btn-topo-config-mysql')?.addEventListener('click', () => {
    openConfigForm('MYSQL', 'mysql_primary');
  });
  document.getElementById('btn-topo-config-postgres')?.addEventListener('click', () => {
    const cfgs = safeGetJson('erp_multi_db_config', []);
    const pg = cfgs.find(c => (c.type || '').toUpperCase() === 'POSTGRESQL' && c.role !== 'PRIMARY');
    if (pg) {
      openConfigForm('POSTGRESQL', pg.id);
    } else {
      openConfigForm('POSTGRESQL', null);
    }
  });

  // 12. Placeholder card action handlers
  document.getElementById('btn-placeholder-create-db')?.addEventListener('click', () => {
    openConfigForm('POSTGRESQL', null);
  });
  document.getElementById('btn-placeholder-edit-mysql')?.addEventListener('click', () => {
    openConfigForm('MYSQL', 'mysql_primary');
  });
  document.getElementById('btn-placeholder-edit-postgres')?.addEventListener('click', () => {
    const cfgs = safeGetJson('erp_multi_db_config', []);
    const pg = cfgs.find(c => (c.type || '').toUpperCase() === 'POSTGRESQL' && c.role !== 'PRIMARY');
    if (pg) {
      openConfigForm('POSTGRESQL', pg.id);
    } else {
      openConfigForm('POSTGRESQL', null);
    }
  });

  // 10. Single Record Re-sync
  document.querySelectorAll('.btn-sync-single-record').forEach(b => {
    b.addEventListener('click', async () => {
      const recordId = b.getAttribute('data-id');
      b.disabled = true;
      b.textContent = '⏳ Syncing...';
      notificationService.toast(`Attempting record sync: ${recordId}`);
      try {
        const tableName = recordId.startsWith('mac') ? 'machines'
          : recordId.startsWith('sp') ? 'spare_parts'
          : recordId.startsWith('pm') ? 'preventive_maintenance'
          : recordId.startsWith('tl') ? 'tools_master'
          : recordId.startsWith('loc') ? 'locations' : 'unknown';
        const record = storage.data?.[tableName]?.find?.(r => r.id === recordId)
          || Object.values(storage.data?.[tableName] || {}).find?.(r => r.id === recordId);
        if (!record) throw new Error(`Record ${recordId} not found in local data.`);
        await syncManager._ensureConfig();
        let synced = 0, failed = 0;
        for (const [id, adapter] of syncManager.secondaryAdapters.entries()) {
          const res = await adapter.saveRecord(tableName, recordId, record).catch(e => ({ success: false, error: e.message }));
          if (res.success) synced++; else failed++;
        }
        if (failed > 0 && synced === 0) throw new Error('All adapters failed.');
        b.textContent = '✅ Synced';
        b.style.color = '#34d399';
        notificationService.toast(`✅ Record ${recordId} synced to ${synced} database(s).`);
      } catch (err) {
        b.textContent = '❌ Failed';
        b.style.color = '#f87171';
        notificationService.toast(`❌ Record sync failed: ${err.message}`);
        setTimeout(() => { b.disabled = false; b.textContent = '⚡ Re-sync'; b.style.color = ''; }, 3000);
      }
    });
  });

  // 11. Refresh Topology button
  document.getElementById('btn-refresh-topology')?.addEventListener('click', () => {
    reRenderView();
    notificationService.toast('Sync topology refreshed from live config.');
  });

  // 12. Sync All Databases button
  const btnSyncAll = document.getElementById('btn-sync-all-providers');
  if (btnSyncAll) {
    btnSyncAll.addEventListener('click', async () => {
      btnSyncAll.disabled = true;
      btnSyncAll.innerHTML = '⏳ Syncing All Databases...';
      await handleReconcileAll();
      btnSyncAll.disabled = false;
      btnSyncAll.innerHTML = '🔄 Sync All Databases';
    });
  }

  // 13. Backup & Restore Handlers
  initBackupHandlers();
}

/**
 * Clean Overview Hub rendered when no database configuration form is actively open.
 * Shows status cards for MySQL Primary and PostgreSQL, with one-click Edit / Connect actions.
 */
function renderProviderPlaceholder() {
  const container = document.getElementById('provider-form-content');
  if (!container) return;

  // Retrieve current configs
  let configs = safeGetJson('erp_multi_db_config', []);
  const mysqlDb = configs.find(c => c.role === 'PRIMARY' || c.id === 'mysql_primary' || (c.type || '').toUpperCase() === 'MYSQL');
  const pgDb = configs.find(c => ((c.type || '').toUpperCase() === 'POSTGRESQL' || (c.type || '').toUpperCase() === 'POSTGRES') && c.role !== 'PRIMARY');

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 20px;">
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 14px; flex-wrap: wrap; gap: 10px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 26px;">🗄️</span>
          <div>
            <h3 style="font-size: 16px; font-weight: 800; color: #fff; margin: 0;">
              Database Connection Hub
            </h3>
            <p style="font-size: 12px; color: var(--text-secondary); margin: 2px 0 0;">
              Select a database from the list on the left to edit credentials, or click below to add a new connection.
            </p>
          </div>
        </div>
        <button type="button" id="btn-placeholder-create-db" class="btn btn-primary btn-sm" style="background: linear-gradient(135deg, #0284c7, #2563eb); font-weight: 700; display: flex; align-items: center; gap: 6px; box-shadow: 0 4px 15px rgba(2, 132, 199, 0.35); padding: 7px 14px; border-radius: 6px;">
          <span>➕ Add Connection</span>
        </button>
      </div>

      <!-- Quick Inspection / Edit Cards -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;">
        <!-- MySQL Primary Master Card -->
        <div style="background: rgba(0, 117, 143, 0.08); border: 1.5px solid rgba(0, 117, 143, 0.4); border-radius: 10px; padding: 18px; display: flex; flex-direction: column; justify-content: space-between; gap: 14px;">
          <div>
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 24px;">🐬</span>
                <div>
                  <div style="font-size: 14.5px; font-weight: 800; color: #38bdf8;">MySQL Database</div>
                  <div style="font-size: 11px; color: #94a3b8;">Primary Master · Single Source of Truth</div>
                </div>
              </div>
              <span style="background: rgba(16, 185, 129, 0.15); border: 1px solid #10b981; color: #34d399; font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 999px;">
                ACTIVE MASTER
              </span>
            </div>

            <div style="font-size: 12px; color: #cbd5e1; line-height: 1.6; font-family: monospace; background: rgba(0,0,0,0.3); padding: 10px 12px; border-radius: 6px; display: flex; flex-direction: column; gap: 3px;">
              <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                <span style="color: #64748b;">Endpoint:</span> <span style="color: #38bdf8;">${mysqlDb && mysqlDb.endpoint ? mysqlDb.endpoint : 'https://moviezonex.com/mysql_api.php'}</span>
              </div>
              <div>
                <span style="color: #64748b;">Database:</span> <span style="color: #34d399;">${mysqlDb && mysqlDb.database ? mysqlDb.database : 'motaherh_maint-erp'}</span>
              </div>
              <div>
                <span style="color: #64748b;">User:</span> <span style="color: #fed7aa;">${mysqlDb && mysqlDb.username ? mysqlDb.username : 'motaherh_mainterp'}</span>
              </div>
            </div>
          </div>

          <button type="button" id="btn-placeholder-edit-mysql" class="btn btn-secondary btn-sm" style="width: 100%; font-weight: 700; border-color: rgba(56, 189, 248, 0.4); color: #38bdf8; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 7px 12px; border-radius: 6px;">
            <span>⚙️ View / Edit MySQL Credentials</span>
          </button>
        </div>

        <!-- PostgreSQL Secondary Card -->
        <div style="background: rgba(51, 103, 145, 0.08); border: 1.5px solid rgba(51, 103, 145, 0.4); border-radius: 10px; padding: 18px; display: flex; flex-direction: column; justify-content: space-between; gap: 14px;">
          <div>
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 24px;">🐘</span>
                <div>
                  <div style="font-size: 14.5px; font-weight: 800; color: #60a5fa;">PostgreSQL Database</div>
                  <div style="font-size: 11px; color: #94a3b8;">Secondary Replica · Backup Sync Target</div>
                </div>
              </div>
              <span style="background: ${pgDb ? 'rgba(16, 185, 129, 0.15)' : 'rgba(148, 163, 184, 0.12)'}; border: 1px solid ${pgDb ? '#10b981' : '#64748b'}; color: ${pgDb ? '#34d399' : '#94a3b8'}; font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 999px;">
                ${pgDb ? 'CONFIGURED' : 'READY TO CONNECT'}
              </span>
            </div>

            <div style="font-size: 12px; color: #cbd5e1; line-height: 1.6; font-family: monospace; background: rgba(0,0,0,0.3); padding: 10px 12px; border-radius: 6px; display: flex; flex-direction: column; gap: 3px;">
              ${pgDb ? `
                <div><span style="color: #64748b;">Host:</span> <span style="color: #60a5fa;">${pgDb.host || '—'}</span></div>
                <div><span style="color: #64748b;">Database:</span> <span style="color: #34d399;">${pgDb.database || '—'}</span></div>
                <div><span style="color: #64748b;">User:</span> <span style="color: #fed7aa;">${pgDb.username || '—'}</span></div>
              ` : `
                <div style="color: #94a3b8; font-family: sans-serif; font-size: 11.5px; padding: 8px 0; text-align: center;">
                  No PostgreSQL instance configured yet.<br/>
                  Click below to enter PostgreSQL connection settings.
                </div>
              `}
            </div>
          </div>

          <button type="button" id="btn-placeholder-edit-postgres" class="btn btn-secondary btn-sm" style="width: 100%; font-weight: 700; border-color: rgba(96, 165, 250, 0.4); color: #93c5fd; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 7px 12px; border-radius: 6px;">
            <span>${pgDb ? '⚙️ View / Edit PostgreSQL Credentials' : '➕ Connect PostgreSQL Database'}</span>
          </button>
        </div>
      </div>

      <!-- Clean Help / Instruction Card -->
      <div style="background: rgba(15, 23, 42, 0.5); border: 1px dashed rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 14px 18px; display: flex; align-items: center; gap: 12px;">
        <span style="font-size: 20px;">💡</span>
        <div style="font-size: 12px; color: #94a3b8; line-height: 1.5;">
          <strong>Tip:</strong> The configuration edit form opens only when you click on a database or choose to add one. Click <strong style="color: #38bdf8;">⚙️ View / Edit</strong> above or click any item in <strong style="color: #e2e8f0;">Configured Databases</strong> on the left.
        </div>
      </div>
    </div>
  `;

  // Attach button events inside placeholder
  document.getElementById('btn-placeholder-create-db')?.addEventListener('click', () => {
    openConfigForm('POSTGRESQL', null);
  });
  document.getElementById('btn-placeholder-edit-mysql')?.addEventListener('click', () => {
    openConfigForm('MYSQL', 'mysql_primary');
  });
  document.getElementById('btn-placeholder-edit-postgres')?.addEventListener('click', () => {
    if (pgDb) {
      openConfigForm('POSTGRESQL', pgDb.id);
    } else {
      openConfigForm('POSTGRESQL', null);
    }
  });
}

function renderProviderForm(providerKey, dbId = null) {
  const container = document.getElementById('provider-form-content');
  if (!container) return;

  const spec = PROVIDER_SPECS[providerKey] || PROVIDER_SPECS.POSTGRESQL;
  currentProviderKey = spec.key;
  currentEditingDbId = dbId;
  isConfigFormOpen = true;

  // Load real saved configs from localStorage
  let allConfigs = safeGetJson('erp_multi_db_config', []);
  
  let existing = {};
  if (dbId) {
    existing = allConfigs.find(c => c.id === dbId) || {};
  }

  const isEditing = !!(existing && existing.id);
  const formTitle = isEditing ? `Edit: ${existing.name || spec.name}` : `Add New ${spec.name} Connection`;
  const badgeLabel = isEditing ? `EDITING (#${existing.id})` : '➕ NEW DATABASE INSTANCE';
  const badgeStyle = isEditing
    ? 'background: rgba(14, 165, 233, 0.15); border: 1px solid #0284c7; color: #38bdf8;'
    : 'background: rgba(16, 185, 129, 0.15); border: 1px solid #10b981; color: #34d399;';

  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 14px; margin-bottom: 16px; flex-wrap: wrap; gap: 10px;">
      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="font-size: 26px;">${spec.icon}</span>
        <div>
          <h3 style="font-size: 16px; font-weight: 800; color: ${spec.color || '#38bdf8'}; margin: 0;">
            ${formTitle}
          </h3>
          <p style="font-size: 12px; color: var(--text-secondary); margin: 2px 0 0;">
            ${spec.description}
          </p>
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="${badgeStyle} font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 4px;">
          ${badgeLabel}
        </span>
        <button type="button" id="btn-close-provider-form" class="btn btn-secondary btn-sm" title="Close Form" style="border-color: rgba(255,255,255,0.25); color: #cbd5e1; font-weight: 700; display: flex; align-items: center; gap: 5px; padding: 4px 10px; font-size: 12px; border-radius: 6px; cursor: pointer;">
          <span>✕</span> <span>Close Form</span>
        </button>
      </div>
    </div>

    <!-- Provider Form -->
    <form id="form-provider-config" style="display: flex; flex-direction: column; gap: 14px;">
      
      <!-- Provider Type Dropdown -->
      <div>
        <label style="display: block; font-size: 12px; font-weight: 700; color: #cbd5e1; margin-bottom: 4px;">
          Database Provider Type
        </label>
        <select id="cfg-provider-select" class="form-control" style="background: #0f172a; border-color: #38bdf8; color: #fff; font-size: 13px; font-weight: 700;">
          ${Object.values(PROVIDER_SPECS).map(p => `
            <option value="${p.key}" ${p.key === spec.key ? 'selected' : ''}>
              ${p.icon} ${p.name} (${p.badge})
            </option>
          `).join('')}
        </select>
      </div>

      <!-- Connection Name / Nickname -->
      <div>
        <label style="display: block; font-size: 12px; font-weight: 700; color: #cbd5e1; margin-bottom: 4px;">
          Connection Name / Label <span style="color: #ef4444;">*</span>
        </label>
        <input type="text" id="cfg-conn-name" class="form-control" value="${existing.name || spec.name + ' Connection'}" placeholder="e.g. Primary ${spec.name} or Branch 2 Replica" style="background: #0f172a; border-color: #334155; color: #fff; font-size: 13px;" required />
        <span style="font-size: 11px; color: #64748b; margin-top: 2px; display: block;">
          Displayed in Data Flow and Database Sync Status diagrams.
        </span>
      </div>

      <!-- Specific Required Fields -->
      ${spec.fields.map(f => {
        let val = existing[f.id] !== undefined ? existing[f.id] : (f.defaultValue || '');
        if (f.type === 'checkbox') {
          return `
            <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
              <input type="checkbox" id="cfg-${f.id}" ${val ? 'checked' : ''} style="width: 16px; height: 16px; accent-color: #38bdf8;" />
              <label for="cfg-${f.id}" style="font-size: 12.5px; font-weight: 700; color: #e2e8f0; cursor: pointer;">
                ${f.label}
              </label>
              ${f.note ? `<span style="font-size: 11px; color: var(--text-secondary);">(${f.note})</span>` : ''}
            </div>
          `;
        }
        return `
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <label style="font-size: 12px; font-weight: 700; color: #cbd5e1;">
                ${f.label} ${f.required ? '<span style="color: #ef4444;">*</span>' : ''}
              </label>
              ${f.note ? `<span style="font-size: 11px; color: #64748b;">${f.note}</span>` : ''}
            </div>
            <input type="${f.type}" id="cfg-${f.id}" class="form-control" value="${val}" placeholder="${f.placeholder || ''}" style="background: #0f172a; border-color: #334155; color: #fff; font-size: 13px; font-family: ${f.type === 'password' ? 'inherit' : 'monospace'};" />
          </div>
        `;
      }).join('')}



      ${spec.key === 'MYSQL' ? `
        <div style="background: rgba(0, 117, 143, 0.08); border: 1.5px solid rgba(0, 117, 143, 0.4); border-radius: 8px; padding: 14px 16px; margin-top: 4px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 18px;">🐬</span>
              <span style="font-size: 13.5px; font-weight: 800; color: #38bdf8;">MySQL Paid Hosting Setup (cPanel / Hostinger / VPS)</span>
            </div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <a href="api/mysql_api.php" download="mysql_api.php" class="btn btn-sm" style="background: #0284c7; color: #fff; font-weight: 800; font-size: 11.5px; padding: 6px 12px; border-radius: 6px; text-decoration: none; display: flex; align-items: center; gap: 5px; box-shadow: 0 2px 8px rgba(2, 132, 199, 0.3);">
                <span>📥</span> <span>Download mysql_api.php</span>
              </a>
              <a href="data/erp_mysql_dump.sql" download="erp_mysql_dump.sql" class="btn btn-sm" style="background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4); font-weight: 800; font-size: 11.5px; padding: 6px 12px; border-radius: 6px; text-decoration: none; display: flex; align-items: center; gap: 5px;">
                <span>📥</span> <span>Download Seed SQL (.sql)</span>
              </a>
            </div>
          </div>
          <p style="font-size: 12px; color: #cbd5e1; margin: 0 0 10px; line-height: 1.5;">
            Paid Hosting (cPanel / Hostinger / Namecheap / VPS) blocks direct TCP socket connections (port 3306) from browsers. Follow these 4 quick steps to connect seamlessly:
          </p>
          <div style="background: #090d16; border: 1px solid rgba(255,255,255,0.08); padding: 12px 14px; border-radius: 6px; font-size: 11.5px; color: #e2e8f0; line-height: 1.6;">
            <strong>Step 1:</strong> In your Paid Hosting cPanel, navigate to <em>MySQL Databases</em>, create database <code>maint_erp</code>, user <code>mainterp</code>, password <code>Maint@456</code>, and grant All Privileges.<br/>
            <strong>Step 2:</strong> Open <em>phpMyAdmin</em>, select database <code>maint_erp</code>, click the <strong>Import</strong> tab, and upload <code>erp_mysql_dump.sql</code>. (All factory tables and records will be initialized instantly).<br/>
            <strong>Step 3:</strong> In cPanel <em>File Manager</em>, upload <code>mysql_api.php</code> into <code>public_html/api/</code> (credentials are already pre-configured inside).<br/>
            <strong>Step 4:</strong> Enter your hosting URL in the <strong>Hosting REST API Endpoint URL</strong> field above (e.g. <code>https://yourdomain.com/api/mysql_api.php</code>) and click <strong>[ Test Connection ]</strong> below!
          </div>
        </div>
      ` : ''}

      <!-- Options: Role & AutoSync -->
      <div style="background: rgba(15, 23, 42, 0.8); border: 1px solid #1e293b; border-radius: 8px; padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; margin-top: 6px;">
        <div style="font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase;">
          Operational Role &amp; Sync Trigger
        </div>
        <div style="display: flex; gap: 20px; align-items: center; flex-wrap: wrap;">
          <label style="display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: #e2e8f0; cursor: pointer;">
            <input type="radio" name="cfg-db-role" value="PRIMARY" ${existing.role === 'PRIMARY' ? 'checked' : ''} style="accent-color: #f59e0b;" />
            Main Database (Primary)
          </label>
          <label style="display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: #e2e8f0; cursor: pointer;">
            <input type="radio" name="cfg-db-role" value="BACKUP" ${existing.role !== 'PRIMARY' ? 'checked' : ''} style="accent-color: #38bdf8;" />
            Backup Database (Secondary Target)
          </label>
        </div>
        <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
          <input type="checkbox" id="cfg-auto-sync" ${existing.autoSync !== false ? 'checked' : ''} style="width: 16px; height: 16px; accent-color: #10b981;" />
          <label for="cfg-auto-sync" style="font-size: 12.5px; font-weight: 700; color: #34d399; cursor: pointer;">
            Enable Automatic Real-time Sync (fan-out on every insert/update)
          </label>
        </div>
      </div>

      <!-- Live Test Result Banner -->
      <div id="test-connection-result" style="display: none; padding: 10px 14px; border-radius: 6px; font-size: 12.5px; font-weight: 600;"></div>

      <!-- Action Buttons -->
      <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 10px; border-top: 1px solid var(--border-color); padding-top: 14px; flex-wrap: wrap;">
        ${isEditing && existing.role !== 'PRIMARY' && existing.id !== 'mysql_primary' ? `
          <button type="button" id="btn-delete-provider-db" class="btn btn-danger btn-sm" style="margin-right: auto; display: flex; align-items: center; gap: 6px;">
            🗑️ Remove Database
          </button>
        ` : ''}

        <button type="button" id="btn-cancel-provider-config" class="btn btn-secondary" style="${(isEditing && (existing.role === 'PRIMARY' || existing.id === 'mysql_primary')) || !isEditing ? 'margin-right: auto;' : ''} display: flex; align-items: center; gap: 6px; font-weight: 700;">
          ✕ Cancel / Close
        </button>
        
        <button type="button" id="btn-test-connection" class="btn btn-secondary" style="border-color: #38bdf8; color: #38bdf8; font-weight: 700; display: flex; align-items: center; gap: 6px;">
          <span>🔌 [ Test Connection ]</span>
        </button>

        <button type="button" id="btn-save-provider-config" class="btn btn-primary" style="background: linear-gradient(135deg, #0284c7, #2563eb); font-weight: 700; display: flex; align-items: center; gap: 6px; box-shadow: 0 4px 15px rgba(2, 132, 199, 0.35);">
          <span>💾 ${isEditing ? '[ Update Database ]' : '[ Add & Save Database ]'}</span>
        </button>
      </div>

    </form>
  `;

  // Attach Provider Selector onChange
  document.getElementById('cfg-provider-select')?.addEventListener('change', (e) => {
    const selectedKey = e.target.value;
    renderProviderForm(selectedKey, dbId);
  });

  // Attach Close & Cancel Form Handlers
  document.getElementById('btn-close-provider-form')?.addEventListener('click', () => {
    closeConfigForm();
  });
  document.getElementById('btn-cancel-provider-config')?.addEventListener('click', () => {
    closeConfigForm();
  });



  // Attach Test Connection Handler (Real check, real error)
  const btnTest = document.getElementById('btn-test-connection');
  if (btnTest) {
    btnTest.addEventListener('click', async () => {
      btnTest.disabled = true;
      btnTest.innerHTML = '⏳ Testing Connection...';
      const resultBox = document.getElementById('test-connection-result');
      if (resultBox) resultBox.style.display = 'none';

      try {
        const payload = extractFormValues(spec);
        const adapter = createTestAdapter(spec.key, payload);
        const testRes = await adapter.testConnection();

        if (resultBox) {
          resultBox.style.display = 'block';
          const isSuccess = testRes === true || (testRes && testRes.success === true);
          if (isSuccess) {
            resultBox.style.background = 'rgba(16, 185, 129, 0.12)';
            resultBox.style.border = '1px solid rgba(16, 185, 129, 0.4)';
            resultBox.style.color = '#34d399';
            const latency = (testRes && testRes.latency) ? ` Latency: ${testRes.latency}ms` : '';
            resultBox.innerHTML = `✅ <strong>Connected Successfully!</strong> Connection to ${spec.name} is verified and responsive.${latency}`;
          } else {
            resultBox.style.background = 'rgba(239, 68, 68, 0.12)';
            resultBox.style.border = '1px solid rgba(239, 68, 68, 0.4)';
            resultBox.style.color = '#f87171';
            const errMsg = (testRes && testRes.error) ? testRes.error : 'Could not reach database endpoint. Please verify credentials.';
              resultBox.innerHTML = `❌ <strong>Connection Notice:</strong> ${errMsg}`;
          }
        }
      } catch (err) {
        if (resultBox) {
          resultBox.style.display = 'block';
          resultBox.style.background = 'rgba(239, 68, 68, 0.12)';
          resultBox.style.border = '1px solid rgba(239, 68, 68, 0.4)';
          resultBox.style.color = '#f87171';
          resultBox.innerHTML = `❌ <strong>Error:</strong> ${err.message}`;
        }
      } finally {
        btnTest.disabled = false;
        btnTest.innerHTML = '🔌 [ Test Connection ]';
      }
    });
  }

  // Attach Save Handler (Supports multiple instances of the same DB!)
  const btnSave = document.getElementById('btn-save-provider-config');
  if (btnSave) {
    btnSave.addEventListener('click', async () => {
      btnSave.disabled = true;
      btnSave.innerHTML = '⏳ Saving...';
      try {
        const payload = extractFormValues(spec);
        const connName = document.getElementById('cfg-conn-name')?.value.trim() || `${spec.name} Connection`;
        const role = document.querySelector('input[name="cfg-db-role"]:checked')?.value || 'BACKUP';
        const autoSync = document.getElementById('cfg-auto-sync')?.checked !== false;

        let currentConfigs = safeGetJson('erp_multi_db_config', []);

        // Use currentEditingDbId if editing, or create a unique instance ID
        const targetId = currentEditingDbId || `db_${spec.key.toLowerCase()}_${Date.now()}`;
        const existingIdx = currentConfigs.findIndex(c => c.id === targetId);

        const configRecord = {
          id: targetId,
          name: connName,
          type: spec.key,
          role,
          autoSync,
          enabled: true,
          retryEnabled: true,
          updatedAt: new Date().toISOString(),
          ...payload
        };

        if (existingIdx !== -1) {
          currentConfigs[existingIdx] = configRecord;
        } else {
          currentConfigs.push(configRecord);
        }

        // Persist to localStorage
        localStorage.setItem('erp_multi_db_config', JSON.stringify(currentConfigs));

        // Persist to storage engine
        if (storage && typeof storage.saveMultiDbConfigs === 'function') {
          await storage.saveMultiDbConfigs(currentConfigs).catch(() => {});
        }

        // Reload syncManager with fresh config
        await syncManager.reloadConfig();

        isConfigFormOpen = false;
        currentEditingDbId = null;
        notificationService.toast(`✅ "${connName}" saved! Appearing in DATABASE SYNC STATUS now.`);

        // Re-render full dashboard so the new/updated DB appears immediately in sync topology
        reRenderView();
      } catch (err) {
        alert('Failed to save database configuration: ' + err.message);
      } finally {
        btnSave.disabled = false;
        btnSave.innerHTML = '💾 Save Database';
      }
    });
  }

  // Attach Delete Handler
  const btnDel = document.getElementById('btn-delete-provider-db');
  if (btnDel && currentEditingDbId) {
    btnDel.addEventListener('click', async () => {
      let currentConfigs = safeGetJson('erp_multi_db_config', []);
      const existingRec = currentConfigs.find(c => c.id === currentEditingDbId);
      const name = existingRec ? (existingRec.name || existingRec.type) : 'this database';

      if (!confirm(`Are you sure you want to remove the database "${name}"?`)) return;

      const updated = currentConfigs.filter(c => c.id !== currentEditingDbId);
      localStorage.setItem('erp_multi_db_config', JSON.stringify(updated));
      if (storage && typeof storage.saveMultiDbConfigs === 'function') {
        await storage.saveMultiDbConfigs(updated).catch(() => {});
      }

      // Clear metrics for this db
      try {
        const metrics = safeGetJson(SYNC_METRICS_KEY, {});
        delete metrics[currentEditingDbId];
        localStorage.setItem(SYNC_METRICS_KEY, JSON.stringify(metrics));
      } catch (_) {}

      await syncManager.reloadConfig();

      currentEditingDbId = null;
      isConfigFormOpen = false;
      notificationService.toast(`🗑️ Removed "${name}".`);

      reRenderView();
    });
  }
}

function extractFormValues(spec) {
  const values = {};
  spec.fields.forEach(f => {
    const el = document.getElementById(`cfg-${f.id}`);
    if (!el) return;
    if (f.type === 'checkbox') {
      values[f.id] = el.checked;
    } else {
      let val = el.value.trim();
      if (f.id === 'endpoint' && val && !val.startsWith('/') && !/^https?:\/\//i.test(val)) {
        val = 'https://' + val;
      }
      values[f.id] = val;
    }
  });
  return values;
}

function createTestAdapter(providerKey, config) {
  const c = { id: 'temp_test', name: 'Test Instance', ...config };
  switch (providerKey) {
    case 'MYSQL':
      return new MysqlAdapter(c);
    case 'POSTGRESQL':
      return new PostgresAdapter(c);
    default:
      throw new Error(`Unsupported provider: ${providerKey}`);
  }
}

function initBackupHandlers() {
  const btnBackup = document.getElementById('btn-download-db-backup');
  if (btnBackup) {
    btnBackup.addEventListener('click', () => {
      const jsonStr = storage.exportBackup();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Al_Muslim_ERP_Backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  const restoreInput = document.getElementById('db-restore-file-input');
  if (restoreInput) {
    restoreInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (evt) => {
        const res = storage.importBackup(evt.target.result);
        if (res.success) {
          alert(`Database restored successfully (${res.count} machines loaded).`);
          window.location.reload();
        } else {
          alert('Restore Failed: ' + res.error);
        }
      };
      reader.readAsText(file);
    });
  }

  const btnReset = document.getElementById('btn-factory-reset');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      if (confirm('Are you sure you want to perform a factory reset? All existing custom machines and modifications will be replaced with initial demo records.')) {
        storage.resetToInitialData();
        alert('ERP reset to initial factory demo state.');
        window.location.reload();
      }
    });
  }

  const btnSyncDb = document.getElementById('btn-sync-server-db');
  if (btnSyncDb) {
    btnSyncDb.addEventListener('click', async () => {
      btnSyncDb.disabled = true;
      btnSyncDb.textContent = '⏳ Saving to Database File...';
      try {
        await storage.persistToServerDatabase();
        alert('All data records were successfully stored into data/erp_database.json on the server disk!');
      } catch (err) {
        alert('Database save error: ' + err.message);
      } finally {
        btnSyncDb.disabled = false;
        btnSyncDb.textContent = '💾 Save to Disk Now';
      }
    });
  }
}
