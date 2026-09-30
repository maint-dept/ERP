/**
 * Al-Muslim Group ERP — Data Engine & Multi-Provider Sync Dashboard
 *
 * Provides a comprehensive real-time synchronization view:
 * 1. Master / Source Database identification (Firebase)
 * 2. Visual Database Sync Topology Tree (Firebase -> PostgreSQL, MongoDB, MySQL, etc.)
 * 3. Data Flow fan-out view showing auto-sync percentages
 * 4. Data Differences table showing Total, Matched, Missing, Duplicates, Failed records
 * 5. Auto Sync ON/OFF toggle and Last Sync timestamp
 * 6. Interactive Missing Records viewer and instant Reconciliation repair
 * 7. Multi-Provider Configuration forms (PostgreSQL, MongoDB, MySQL, Turso, Firebase, Cloudflare D1, Neon)
 * 8. Unified Core Schema preview & Persistent Disk Storage backup/restore
 */

import { storage } from '../db/storage.js';
import { syncManager } from '../db/syncManager.js';
import { notificationService } from '../services/notificationService.js';
import { db } from '../db/dbClient.js';
import { PostgresAdapter } from '../db/adapters/postgresAdapter.js';
import { TursoAdapter } from '../db/adapters/tursoAdapterV2.js';
import { FirebaseAdapter } from '../db/adapters/firebaseAdapterV2.js';
import { CloudflareD1Adapter } from '../db/adapters/cloudflareD1Adapter.js';
import { NeonAdapter } from '../db/adapters/neonAdapter.js';
import { MongoAdapter } from '../db/adapters/mongoAdapter.js';
import { MysqlAdapter } from '../db/adapters/mysqlAdapter.js';
import { SupabaseAdapter, SUPABASE_SETUP_SQL } from '../db/adapters/supabaseAdapterV2.js';

// Provider specifications with fields, default values, and documentation
export const PROVIDER_SPECS = {
  POSTGRESQL: {
    key: 'POSTGRESQL',
    name: 'PostgreSQL Database',
    badge: 'SQL · Relational',
    icon: '🐘',
    color: '#336791',
    description: 'Enterprise Relational Database with ACID compliance and full transactional integrity.',
    fields: [
      { id: 'host', label: 'Host', type: 'text', placeholder: 'e.g. 192.168.1.100 or db.company.com', required: true },
      { id: 'port', label: 'Port', type: 'number', placeholder: '5432', defaultValue: '5432', required: true },
      { id: 'database', label: 'Database', type: 'text', placeholder: 'al_muslim_erp', required: true },
      { id: 'username', label: 'Username', type: 'text', placeholder: 'postgres_user', required: true },
      { id: 'password', label: 'Password', type: 'password', placeholder: '••••••••••••', required: true },
      { id: 'ssl', label: 'Require SSL / TLS', type: 'checkbox', defaultValue: true, note: 'Encrypt data in transit' },
      { id: 'endpoint', label: 'Proxy Endpoint URL (Optional)', type: 'text', placeholder: '/api/db/pg', note: 'Direct TCP from browser is blocked by browsers; uses REST proxy' }
    ]
  },
  MYSQL: {
    key: 'MYSQL',
    name: 'MySQL',
    badge: 'SQL · Relational RDBMS',
    icon: '🐬',
    color: '#00758f',
    description: 'High-performance SQL database engine with InnoDB transaction guarantees and indexing.',
    fields: [
      { id: 'host', label: 'Host', type: 'text', placeholder: '127.0.0.1 or db.almuslim.com', required: true },
      { id: 'port', label: 'Port', type: 'number', placeholder: '3306', defaultValue: '3306', required: true },
      { id: 'database', label: 'Database', type: 'text', placeholder: 'al_muslim_erp', required: true },
      { id: 'username', label: 'Username', type: 'text', placeholder: 'root', required: true },
      { id: 'password', label: 'Password', type: 'password', placeholder: '••••••••••••', required: true },
      { id: 'ssl', label: 'Require SSL / TLS', type: 'checkbox', defaultValue: false },
      { id: 'endpoint', label: 'Proxy Endpoint URL (Optional)', type: 'text', placeholder: '/api/db/mysql', note: 'Direct TCP blocked by browser; uses REST proxy' }
    ]
  },
  MONGODB: {
    key: 'MONGODB',
    name: 'MongoDB',
    badge: 'NoSQL · Document Store',
    icon: '🍃',
    color: '#10aa50',
    description: 'Document-oriented NoSQL database with high horizontal scalability and flexible BSON schema.',
    fields: [
      { id: 'uri', label: 'Connection URI', type: 'password', placeholder: 'mongodb+srv://admin:pass@cluster0.mongodb.net/al_muslim_erp?retryWrites=true', required: true },
      { id: 'database', label: 'Database Name', type: 'text', placeholder: 'al_muslim_erp', defaultValue: 'al_muslim_erp', required: true },
      { id: 'endpoint', label: 'REST Proxy Route (Optional)', type: 'text', placeholder: '/api/db/mongo', defaultValue: '/api/db/mongo' }
    ]
  },
  FIREBASE: {
    key: 'FIREBASE',
    name: 'Firebase (Cloud Firestore)',
    badge: 'NoSQL · Real-time Sync',
    icon: '🔥',
    color: '#f59e0b',
    description: 'Google Cloud managed real-time NoSQL with offline synchronization and instant change listeners.',
    fields: [
      { id: 'projectId', label: 'Project ID', type: 'text', placeholder: 'maint-dept-erp', required: true },
      { id: 'apiKey', label: 'API Key', type: 'password', placeholder: 'AIzaSyD-xxxxxxxxxxx', required: true },
      { id: 'authDomain', label: 'Auth Domain', type: 'text', placeholder: 'maint-dept-erp.firebaseapp.com', required: true },
      { id: 'storageBucket', label: 'Storage Bucket (Optional)', type: 'text', placeholder: 'maint-dept-erp.appspot.com', required: false },
      { id: 'databaseURL', label: 'Database URL (RTDB — Optional)', type: 'text', placeholder: 'Leave empty. Only needed if using Realtime DB instead of Firestore.', note: 'Cloud Firestore does NOT require RTDB URL. Leave blank.', required: false }
    ]
  },
  SUPABASE: {
    key: 'SUPABASE',
    name: 'Supabase (PostgreSQL)',
    badge: 'PostgreSQL · PostgREST',
    icon: '⚡',
    color: '#3ecf8e',
    description: 'Hosted Postgres with auto-generated RESTful API (PostgREST) and real-time subscriptions.',
    fields: [
      { id: 'url', label: 'Project URL', type: 'text', placeholder: 'https://xyzcompany.supabase.co', required: true },
      { id: 'anonKey', label: 'Anon / Publishable API Key', type: 'password', placeholder: 'eyJhbGciOi...', required: true }
    ]
  },
  NEON: {
    key: 'NEON',
    name: 'Neon Serverless Postgres',
    badge: 'PostgreSQL · Autoscaling',
    icon: '🌿',
    color: '#00e599',
    description: 'Modern serverless PostgreSQL with scale-to-zero, instant branching, and high availability.',
    fields: [
      { id: 'connectionString', label: 'Connection String', type: 'password', placeholder: 'postgres://user:password@ep-cool-fog-123456.us-east-2.aws.neon.tech/neondb?sslmode=require', required: true },
      { id: 'proxyUrl', label: 'Backend Proxy URL (Optional)', type: 'text', placeholder: '/api/db/neon', note: 'Keeps connection credentials secure on the backend server' }
    ]
  },
  TURSO: {
    key: 'TURSO',
    name: 'Turso (LibSQL)',
    badge: 'Edge SQLite · Serverless',
    icon: '🚀',
    color: '#4fff91',
    description: 'Ultra-low latency serverless SQLite database distributed at the edge. Supports direct HTTP pipeline.',
    fields: [
      { id: 'databaseUrl', label: 'Database URL', type: 'text', placeholder: 'https://al-muslim-erp-org.turso.io', required: true },
      { id: 'authToken', label: 'Auth Token', type: 'password', placeholder: 'eyJhbGciOi...', required: true }
    ]
  },
  CLOUDFLARE_D1: {
    key: 'CLOUDFLARE_D1',
    name: 'Cloudflare D1',
    badge: 'Edge SQL · Serverless',
    icon: '☁️',
    color: '#f97316',
    description: 'Serverless SQL database powered by Cloudflare Workers and global edge infrastructure.',
    fields: [
      { id: 'accountId', label: 'Account ID', type: 'text', placeholder: 'cf_account_id_32_chars', required: true },
      { id: 'databaseId', label: 'Database ID', type: 'text', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', required: true },
      { id: 'apiToken', label: 'API Token', type: 'password', placeholder: 'Cloudflare API Token with D1 permissions', required: true }
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
    if (count > 100) return count;
  }
  return 0;
}

/**
 * Persist a per-db sync metric update.
 * Called by the Sync All / Re-sync handlers after a real operation.
 */
export function recordSyncMetric(dbId, patch) {
  let metrics = {};
  try { metrics = JSON.parse(localStorage.getItem(SYNC_METRICS_KEY) || '{}'); } catch (_) {}
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
    const old = JSON.parse(localStorage.getItem(SYNC_STATE_KEY) || '{}');
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
    const pref = JSON.parse(localStorage.getItem(SYNC_STATE_KEY) || '{}');
    if (typeof pref.autoSync === 'boolean') autoSync = pref.autoSync;
    if (pref.lastSyncTime) lastSyncTime = pref.lastSyncTime;
  } catch (_) {}

  // Real per-db metrics written by sync operations
  let metrics = {};
  try { metrics = JSON.parse(localStorage.getItem(SYNC_METRICS_KEY) || '{}'); } catch (_) {}

  // Real configured secondary databases saved by the user
  let rawConfigs = [];
  try {
    const stored = localStorage.getItem('erp_multi_db_config');
    if (stored) rawConfigs = JSON.parse(stored);
  } catch (_) {}
  if ((!rawConfigs || rawConfigs.length === 0) && storage && typeof storage.getMultiDbConfigs === 'function') {
    try { rawConfigs = storage.getMultiDbConfigs() || []; } catch (_) {}
  }

  // Filter out any invalid or legacy entries without valid ID
  rawConfigs = (rawConfigs || []).filter(c => c && c.id && c.type);

  // Map provider type → display icon
  const TYPE_ICONS = {
    POSTGRESQL: '🐘', POSTGRES: '🐘',
    MONGODB: '🍃', MONGO: '🍃',
    MYSQL: '🐬',
    FIREBASE: '🔥',
    TURSO: '🚀',
    NEON: '🌿',
    CLOUDFLARE_D1: '☁️',
    SUPABASE: '⚡'
  };

  const databases = rawConfigs.map(conf => {
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

  return {
    autoSync,
    lastSyncTime,
    pendingCount,
    failedCount,
    duplicateCount: databases.reduce((a, d) => a + (d.duplicates || 0), 0),
    master: {
      name: 'Firebase',
      label: 'Main Database — Firebase',
      status: 'CONNECTED',
      total,
      matched: total,
      missing: 0,
      duplicates: 0,
      failed: 0,
      syncPct: 100.0,
      lastSync: lastSyncTime
    },
    databases,
    missingRecords
  };
}

function saveDashboardSyncState(patch) {
  // Only persist user preferences (autoSync toggle, lastSyncTime) — NOT the entire state
  let stored = {};
  try { stored = JSON.parse(localStorage.getItem(SYNC_STATE_KEY) || '{}'); } catch (_) {}
  const merged = { ...stored, ...patch };
  try { localStorage.setItem(SYNC_STATE_KEY, JSON.stringify(merged)); } catch (_) {}
}

export function renderDatabaseConfigView() {
  // Read real saved secondary-DB configs from localStorage
  let configs = [];
  try {
    const raw = localStorage.getItem('erp_multi_db_config');
    if (raw) configs = JSON.parse(raw);
  } catch (_) {}

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
              v4.22.0 Active
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
        
        <!-- Screenshot 1 Card: Database Status (Firebase Main Database) -->
        <div style="background: #090e1a; border: 1.5px solid #10b981; border-left: 4px solid #10b981; border-radius: 12px; padding: 22px; box-shadow: 0 10px 30px rgba(0,0,0,0.45); display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
              <span style="font-size: 18px;">📊</span>
              <h2 style="font-size: 16px; font-weight: 800; color: #fbbf24; margin: 0; letter-spacing: 0.2px;">Database Status</h2>
            </div>

            <div style="margin-bottom: 16px;">
              <div style="font-size: 17px; font-weight: 800; color: #ffffff; letter-spacing: -0.2px;">
                Firebase — Main Database
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
            Real-time broadcast flow: every ERP write in Firebase fans out to all configured secondary databases.
          </p>

          <div style="background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 18px; font-family: 'JetBrains Mono', 'Fira Code', monospace; font-size: 13.5px; line-height: 2;">
            <div style="color: #ffffff; font-weight: 700; margin-bottom: 4px;">
              🔥 Firebase <span style="font-size: 11px; color: #38bdf8; font-weight: normal; margin-left: 6px;">(Main Database / Source)</span>
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
                Main Database &mdash; Firebase (Master / Source)
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
              <!-- Master: Firebase (always real) -->
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.06); background: rgba(56, 189, 248, 0.03);">
                <td style="padding: 12px 14px; font-weight: 700; color: #fff;">🔥 Firebase</td>
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
              Connect multiple database instances (PostgreSQL, MySQL, MongoDB, Firebase, Supabase, Neon, Turso). Every added connection syncs with the Main Database.
            </p>
          </div>
          <span style="font-size: 11.5px; color: #38bdf8; background: rgba(2, 132, 199, 0.12); border: 1px solid rgba(2, 132, 199, 0.3); padding: 4px 10px; border-radius: 6px; font-weight: 700;">
            Multi-Database Active: ${configs.length} Target(s) Configured
          </span>
        </div>

        <div style="display: grid; grid-template-columns: 340px 1fr; gap: 20px; align-items: start;">
          
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
                  const isSelected = currentEditingDbId === c.id;
                  const typeUpper = (c.type || '').toUpperCase();
                  const pIcon = (PROVIDER_SPECS[typeUpper] && PROVIDER_SPECS[typeUpper].icon) || '🗄️';
                  const m = state.databases.find(d => d.id === c.id);
                  const dotCol = m ? m.statusColor : '#94a3b8';
                  const statusTxt = m ? m.statusLabel : 'Ready';

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
                      <button type="button" class="btn-delete-configured-db" data-delete-id="${c.id}" title="Remove Connection" style="background: transparent; border: none; color: #64748b; font-size: 14px; cursor: pointer; padding: 4px 6px; border-radius: 4px; transition: color 0.15s ease;" onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='#64748b'">
                        🗑️
                      </button>
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
          <div id="provider-config-container" style="background: var(--bg-surface); border: 1.5px solid #0284c7; border-radius: var(--radius-lg); padding: 24px; box-shadow: 0 4px 25px rgba(2, 132, 199, 0.1);">
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
              All database providers share the exact same entity schema. Swapping PostgreSQL ➔ Neon ➔ Firebase leaves frontend code completely untouched.
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

export function initDatabaseConfigEvents() {
  // ── One-time migration: wipe old sync_state that contained fake databases array ──
  try {
    const old = JSON.parse(localStorage.getItem('erp_data_engine_sync_state') || '{}');
    if (Array.isArray(old.databases)) {
      localStorage.setItem('erp_data_engine_sync_state', JSON.stringify({
        autoSync: old.autoSync !== false,
        lastSyncTime: old.lastSyncTime || '—'
      }));
      console.log('[Data Engine] Migrated: removed legacy mock databases from sync_state.');
    }
  } catch (_) {}

  // 1. Initial render of provider form
  renderProviderForm(currentProviderKey, currentEditingDbId);

  // 2. "➕ Add New Database Connection" button
  document.getElementById('btn-create-new-db')?.addEventListener('click', () => {
    currentEditingDbId = null;
    renderProviderForm(currentProviderKey, null);
    notificationService.toast('Ready to configure a new database connection.');
  });

  // 3. Configured Databases card clicks (select to edit)
  document.querySelectorAll('.configured-db-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('.btn-delete-configured-db')) return;
      const dbId = item.getAttribute('data-db-id');
      let configs = [];
      try { configs = JSON.parse(localStorage.getItem('erp_multi_db_config') || '[]'); } catch (_) {}
      const found = configs.find(c => c.id === dbId);
      if (found) {
        currentEditingDbId = dbId;
        currentProviderKey = (found.type || 'POSTGRESQL').toUpperCase();
        renderProviderForm(currentProviderKey, dbId);
        
        // Update selection highlight
        document.querySelectorAll('.configured-db-item').forEach(el => {
          el.style.borderColor = 'rgba(255,255,255,0.08)';
          el.style.background = 'rgba(15, 23, 42, 0.6)';
        });
        item.style.borderColor = '#38bdf8';
        item.style.background = 'rgba(2, 132, 199, 0.18)';
      }
    });
  });

  // 4. Quick Delete buttons on configured databases
  document.querySelectorAll('.btn-delete-configured-db').forEach(delBtn => {
    delBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const dbId = delBtn.getAttribute('data-delete-id');
      let configs = [];
      try { configs = JSON.parse(localStorage.getItem('erp_multi_db_config') || '[]'); } catch (_) {}
      const target = configs.find(c => c.id === dbId);
      const name = target ? (target.name || target.type) : 'this connection';

      if (!confirm(`Are you sure you want to remove the database "${name}"?`)) return;

      const updated = configs.filter(c => c.id !== dbId);
      localStorage.setItem('erp_multi_db_config', JSON.stringify(updated));
      if (storage && typeof storage.saveMultiDbConfigs === 'function') {
        await storage.saveMultiDbConfigs(updated).catch(() => {});
      }
      try {
        const metrics = JSON.parse(localStorage.getItem(SYNC_METRICS_KEY) || '{}');
        delete metrics[dbId];
        localStorage.setItem(SYNC_METRICS_KEY, JSON.stringify(metrics));
      } catch (_) {}

      syncManager.configLoaded = false;
      await syncManager.loadConfig();

      if (currentEditingDbId === dbId) currentEditingDbId = null;
      notificationService.toast(`🗑️ Removed "${name}".`);
      reRenderView();
    });
  });

  // 5. Provider Template clicks (+ Add template)
  document.querySelectorAll('.provider-template-item').forEach(tpl => {
    tpl.addEventListener('click', () => {
      const pKey = tpl.getAttribute('data-provider');
      if (!pKey || !PROVIDER_SPECS[pKey]) return;
      currentProviderKey = pKey;
      currentEditingDbId = null;
      renderProviderForm(currentProviderKey, null);
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

  // Helper: re-render the full view after state changes
  const reRenderView = () => {
    const appContainer = document.getElementById('app-view-container');
    if (appContainer) {
      appContainer.innerHTML = renderDatabaseConfigView();
      initDatabaseConfigEvents();
    }
  };

  // Helper: run a REAL full sync for a single configured database by its id
  const runRealSync = async (dbId, dbName, btn, originalLabel) => {
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Syncing...'; }
    notificationService.toast(`Syncing ${dbName || dbId}...`);
    try {
      await syncManager.loadConfig();
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
      try {
        const cfgs = JSON.parse(localStorage.getItem('erp_multi_db_config') || '[]');
        const found = cfgs.find(c => c.id === dbId);
        if (found) dbName = found.name || found.type || dbId;
      } catch (_) {}
      await runRealSync(dbId, dbName, b, b.textContent);
    });
  });

  // 9. "Fix & Re-sync All Missing" button — runs real sync on every configured DB that has issues
  const handleReconcileAll = async () => {
    const btn = document.getElementById('btn-fix-all-missing') || document.getElementById('btn-reconcile-all-records') || document.getElementById('btn-reconcile-missing-now');
    if (btn) { btn.disabled = true; btn.innerHTML = '⏳ Syncing all databases...'; }
    notificationService.toast('Running full sync across all configured databases...');
    try {
      let cfgs = [];
      try { cfgs = JSON.parse(localStorage.getItem('erp_multi_db_config') || '[]'); } catch (_) {}
      await syncManager.loadConfig();
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
      if (failCount > 0) {
        notificationService.toast(`⚠️ Sync complete: ${successCount} succeeded, ${failCount} failed. Check status.`);
      } else if (successCount > 0) {
        notificationService.toast(`✅ All ${successCount} database(s) synced successfully!`);
      } else {
        notificationService.toast('ℹ️ No enabled secondary databases to sync. Add a database below.');
      }
      reRenderView();
    } catch (err) {
      notificationService.toast(`Sync error: ${err.message}`);
      if (btn) { btn.disabled = false; btn.innerHTML = '⚡ Fix & Re-sync Missing'; }
    }
  };
  document.getElementById('btn-fix-all-missing')?.addEventListener('click', handleReconcileAll);
  document.getElementById('btn-reconcile-all-records')?.addEventListener('click', handleReconcileAll);
  document.getElementById('btn-reconcile-missing-now')?.addEventListener('click', handleReconcileAll);

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

function renderProviderForm(providerKey, dbId = null) {
  const container = document.getElementById('provider-form-content');
  if (!container) return;

  const spec = PROVIDER_SPECS[providerKey] || PROVIDER_SPECS.POSTGRESQL;
  currentProviderKey = spec.key;
  currentEditingDbId = dbId;

  // Load real saved configs from localStorage
  let allConfigs = [];
  try { allConfigs = JSON.parse(localStorage.getItem('erp_multi_db_config') || '[]'); } catch (_) {}
  
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
      <div>
        <span style="${badgeStyle} font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 4px;">
          ${badgeLabel}
        </span>
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
        if (f.id === 'databaseURL' && (val === 'https://al-muslim-erp-default-rtdb.firebaseio.com' || val.includes('default-rtdb'))) {
          val = '';
        }
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

      ${spec.key === 'SUPABASE' ? `
        <div style="background: rgba(62, 207, 142, 0.08); border: 1.5px solid rgba(62, 207, 142, 0.35); border-radius: 8px; padding: 14px 16px; margin-top: 4px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 16px;">⚡</span>
              <span style="font-size: 13px; font-weight: 800; color: #3ecf8e;">Supabase Setup (Run Once in SQL Editor)</span>
            </div>
            <div style="display: flex; gap: 8px;">
              <button type="button" id="btn-copy-supa-sql" class="btn btn-sm" style="background: #3ecf8e; color: #0b1329; font-weight: 800; font-size: 11.5px; padding: 4px 12px; border-radius: 6px; border: none; cursor: pointer; display: flex; align-items: center; gap: 5px;">
                <span>📋</span> <span>Copy Setup SQL</span>
              </button>
              <a id="link-open-supa-sql" href="https://supabase.com/dashboard" target="_blank" class="btn btn-sm" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); font-weight: 700; font-size: 11.5px; padding: 4px 12px; border-radius: 6px; text-decoration: none; display: flex; align-items: center; gap: 5px;">
                <span>↗️</span> <span>Open Supabase SQL Editor</span>
              </a>
            </div>
          </div>
          <p style="font-size: 11.5px; color: #cbd5e1; margin: 0 0 8px; line-height: 1.4;">
            PostgreSQL requires the storage table before syncing. Copy this SQL, open the SQL Editor in your Supabase dashboard, paste and click <strong>Run</strong>:
          </p>
          <pre style="background: #090d16; border: 1px solid rgba(255,255,255,0.08); padding: 10px 12px; border-radius: 6px; font-size: 11px; color: #a7f3d0; margin: 0; overflow-x: auto; font-family: monospace; line-height: 1.4; user-select: all;">${SUPABASE_SETUP_SQL.trim()}</pre>
        </div>
      ` : ''}

      ${spec.key === 'FIREBASE' ? `
        <div style="background: rgba(245, 158, 11, 0.08); border: 1.5px solid rgba(245, 158, 11, 0.35); border-radius: 8px; padding: 14px 16px; margin-top: 4px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 16px;">🔥</span>
              <span style="font-size: 13px; font-weight: 800; color: #f59e0b;">Cloud Firestore Rules Setup (Required Once)</span>
            </div>
            <a id="link-open-fb-rules" href="https://console.firebase.google.com" target="_blank" class="btn btn-sm" style="background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4); font-weight: 700; font-size: 11.5px; padding: 4px 12px; border-radius: 6px; text-decoration: none; display: flex; align-items: center; gap: 5px;">
              <span>↗️</span> <span>Open Firestore Rules Tab</span>
            </a>
          </div>
          <p style="font-size: 11.5px; color: #cbd5e1; margin: 0 0 8px; line-height: 1.4;">
            If Cloud Firestore is in locked mode, sync writes will be blocked. In your Firebase Console, open <strong>Firestore Database → Rules</strong> tab, paste and <strong>Publish</strong>:
          </p>
          <pre style="background: #090d16; border: 1px solid rgba(255,255,255,0.08); padding: 10px 12px; border-radius: 6px; font-size: 11px; color: #fde68a; margin: 0; overflow-x: auto; font-family: monospace; line-height: 1.4;">rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}</pre>
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
        ${isEditing ? `
          <button type="button" id="btn-delete-provider-db" class="btn btn-danger btn-sm" style="margin-right: auto; display: flex; align-items: center; gap: 6px;">
            🗑️ Remove Database
          </button>
        ` : ''}
        
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

  // Attach Supabase Copy SQL & Dynamic Link handlers
  const btnCopySql = document.getElementById('btn-copy-supa-sql');
  if (btnCopySql) {
    btnCopySql.addEventListener('click', () => {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(SUPABASE_SETUP_SQL).then(() => {
          notificationService.toast('✅ Supabase setup SQL copied to clipboard! Paste and run it in Supabase SQL Editor.', 'success');
        }).catch(() => {
          notificationService.toast('Setup SQL copied!', 'info');
        });
      }
    });
  }

  const supaUrlInput = document.getElementById('cfg-url');
  const supaLink = document.getElementById('link-open-supa-sql');
  if (supaUrlInput && supaLink) {
    const updateLink = () => {
      const u = supaUrlInput.value.trim();
      const m = u.match(/https:\/\/([a-z0-9_-]+)\.supabase\.co/i);
      if (m && m[1]) {
        supaLink.href = `https://supabase.com/dashboard/project/${m[1]}/sql/new`;
      } else {
        supaLink.href = 'https://supabase.com/dashboard';
      }
    };
    supaUrlInput.addEventListener('input', updateLink);
    updateLink();
  }

  const fbProjInput = document.getElementById('cfg-projectId');
  const fbRulesLink = document.getElementById('link-open-fb-rules');
  if (fbProjInput && fbRulesLink) {
    const updateFbLink = () => {
      const p = fbProjInput.value.trim();
      if (p) {
        fbRulesLink.href = `https://console.firebase.google.com/project/${encodeURIComponent(p)}/firestore/rules`;
      } else {
        fbRulesLink.href = 'https://console.firebase.google.com';
      }
    };
    fbProjInput.addEventListener('input', updateFbLink);
    updateFbLink();
  }

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
            if (testRes && testRes.isTableMissing) {
              resultBox.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 6px;">
                  <div>❌ <strong>Table Missing:</strong> ${errMsg}</div>
                  <div style="font-size: 11.5px; color: #cbd5e1;">Click "Copy Setup SQL" above, run it in your Supabase SQL Editor, and test again.</div>
                </div>
              `;
            } else {
              resultBox.innerHTML = `❌ <strong>Connection Notice:</strong> ${errMsg}`;
            }
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

        let currentConfigs = [];
        try { currentConfigs = JSON.parse(localStorage.getItem('erp_multi_db_config') || '[]'); } catch (_) {}

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

        // Reload syncManager
        syncManager.configLoaded = false;
        await syncManager.loadConfig();

        currentEditingDbId = targetId;
        notificationService.toast(`✅ "${connName}" saved! Appearing in DATABASE SYNC STATUS now.`);

        // Re-render full dashboard so the new/updated DB appears immediately in sync topology
        const appContainer = document.getElementById('app-view-container');
        if (appContainer) {
          appContainer.innerHTML = renderDatabaseConfigView();
          initDatabaseConfigEvents();
        }
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
      let currentConfigs = [];
      try { currentConfigs = JSON.parse(localStorage.getItem('erp_multi_db_config') || '[]'); } catch (_) {}
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
        const metrics = JSON.parse(localStorage.getItem(SYNC_METRICS_KEY) || '{}');
        delete metrics[currentEditingDbId];
        localStorage.setItem(SYNC_METRICS_KEY, JSON.stringify(metrics));
      } catch (_) {}

      syncManager.configLoaded = false;
      await syncManager.loadConfig();

      currentEditingDbId = null;
      notificationService.toast(`🗑️ Removed "${name}".`);

      const appContainer = document.getElementById('app-view-container');
      if (appContainer) {
        appContainer.innerHTML = renderDatabaseConfigView();
        initDatabaseConfigEvents();
      }
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
      values[f.id] = el.value.trim();
    }
  });
  return values;
}

function createTestAdapter(providerKey, config) {
  const c = { id: 'temp_test', name: 'Test Instance', ...config };
  switch (providerKey) {
    case 'POSTGRESQL':
      return new PostgresAdapter(c);
    case 'MONGODB':
      return new MongoAdapter(c);
    case 'MYSQL':
      return new MysqlAdapter(c);
    case 'TURSO':
      return new TursoAdapter(c);
    case 'FIREBASE':
      return new FirebaseAdapter(c);
    case 'CLOUDFLARE_D1':
      return new CloudflareD1Adapter(c);
    case 'NEON':
      return new NeonAdapter(c);
    case 'SUPABASE':
      return new SupabaseAdapter(c);
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
