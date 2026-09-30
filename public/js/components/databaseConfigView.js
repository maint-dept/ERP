/**
 * Al-Muslim Group ERP — Database Configuration & Multi-Provider Admin Panel
 *
 * Architecture:
 * Admin Panel -> Database Adapter Layer -> [PostgreSQL, Turso, Firebase, Cloudflare D1, Neon]
 *
 * Design Decision:
 * All ERP operations use a unified schema & dbClient:
 *   machines, machine_categories, brands, locations, machine_movements,
 *   maintenance, spare_parts, stock_transactions, suppliers, users, audit_logs
 */

import { storage } from '../db/storage.js';
import { syncManager } from '../db/syncManager.js';
import { notificationService } from '../services/notificationService.js';
import { db } from '../db/dbClient.js';
import { PostgresAdapter } from '../db/adapters/postgresAdapter.js';
import { TursoAdapter } from '../db/adapters/tursoAdapter.js';
import { FirebaseAdapter } from '../db/adapters/firebaseAdapter.js';
import { CloudflareD1Adapter } from '../db/adapters/cloudflareD1Adapter.js';
import { NeonAdapter } from '../db/adapters/neonAdapter.js';

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
  FIREBASE: {
    key: 'FIREBASE',
    name: 'Firebase (Cloud Firestore / RTDB)',
    badge: 'NoSQL · Real-time Sync',
    icon: '🔥',
    color: '#f59e0b',
    description: 'Google Cloud managed real-time NoSQL with offline synchronization and instant change listeners.',
    fields: [
      { id: 'projectId', label: 'Project ID', type: 'text', placeholder: 'al-muslim-erp', required: true },
      { id: 'apiKey', label: 'API Key', type: 'password', placeholder: 'AIzaSyD-xxxxxxxxxxx', required: true },
      { id: 'authDomain', label: 'Auth Domain', type: 'text', placeholder: 'al-muslim-erp.firebaseapp.com', required: true },
      { id: 'storageBucket', label: 'Storage Bucket', type: 'text', placeholder: 'al-muslim-erp.appspot.com', required: false },
      { id: 'databaseURL', label: 'Database URL (RTDB)', type: 'text', placeholder: 'https://al-muslim-erp-default-rtdb.firebaseio.com', required: false }
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

export function renderDatabaseConfigView() {
  const configs = storage.getMultiDbConfigs ? storage.getMultiDbConfigs() : [];

  return `
    <div class="page-view" style="max-width: 1440px; margin: 0 auto; padding-bottom: 50px;">
      
      <!-- Top Title & Quick Actions -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; flex-wrap: wrap; gap: 14px;">
        <div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <h1 style="font-size: 24px; font-weight: 800; color: #fff; margin: 0;">🗄️ Data Engine</h1>
            <span style="background: rgba(16, 185, 129, 0.15); border: 1px solid #10b981; color: #34d399; font-size: 11px; font-weight: 700; padding: 2px 10px; border-radius: 999px;">
              v4.17.0 Active
            </span>
          </div>
          <p style="font-size: 13px; color: var(--text-secondary); margin: 6px 0 0;">
            Multi-Provider Adapter Configuration with automatic failover, edge synchronization, and universal schema abstraction.
          </p>
        </div>

        <div style="display: flex; gap: 10px; align-items: center;">
          <button id="btn-sync-all-providers" class="btn btn-primary btn-sm" style="font-weight: 700; background: linear-gradient(135deg, #0284c7, #2563eb); display: flex; align-items: center; gap: 6px;">
            <span>🔄 Sync All Databases</span>
          </button>
          <button id="btn-open-add-db-modal" class="btn btn-secondary btn-sm" style="font-weight: 700; color: #38bdf8; border-color: rgba(56, 189, 248, 0.4); display: flex; align-items: center; gap: 6px;">
            <span>➕ Add New Connection</span>
          </button>
        </div>
      </div>

      <!-- Section 1: Architecture & GitHub Pages Security Notice Banner -->
      <div style="background: linear-gradient(135deg, #0f172a 0%, #1e1e38 100%); border: 1.5px solid #38bdf8; border-radius: var(--radius-lg); padding: 18px 22px; margin-bottom: 24px; box-shadow: 0 8px 30px rgba(0,0,0,0.35);">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 10px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 18px;">🏛️</span>
            <span style="font-size: 15px; font-weight: 800; color: #38bdf8; letter-spacing: 0.3px;">Database Architecture &amp; Adapter Layer</span>
          </div>
          <span style="font-size: 12px; color: #94a3b8; font-family: monospace;">
            Pattern: Single Canonical Schema ➔ Multi-Target Adapters
          </span>
        </div>

        <!-- Architecture Flow & Security Box -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
          <!-- Visual Pipeline -->
          <div style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(56, 189, 248, 0.2); border-radius: 8px; padding: 14px 16px;">
            <div style="font-size: 11.5px; font-weight: 700; color: #38bdf8; margin-bottom: 8px; text-transform: uppercase;">
              Active Pipeline Flow
            </div>
            <pre style="margin: 0; font-family: 'JetBrains Mono', monospace; font-size: 12px; line-height: 1.45; color: #cbd5e1; background: transparent; padding: 0;">
GitHub Pages (maint-dept.github.io/ERP)
   │
   ▼
Frontend App (Vanilla JS + Reactive State)
   │
   ▼
Database Adapter Layer (dbClient.js)
   │
   ├──▶ 🟢 PostgreSQL Database
   ├──▶ 🟢 Turso (LibSQL)
   ├──▶ 🟢 Firebase (Firestore / RTDB)
   ├──▶ 🟢 Cloudflare D1
   └──▶ 🟢 Neon Serverless Postgres</pre>
          </div>

          <!-- Security Note -->
          <div style="background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 8px; padding: 14px 16px;">
            <div style="font-size: 12px; font-weight: 800; color: #fbbf24; display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
              <span>⚠️</span>
              <span>GitHub Pages Security Architecture</span>
            </div>
            <p style="font-size: 12px; color: #fde68a; line-height: 1.5; margin: 0 0 8px;">
              GitHub Pages is a static frontend host. Database root passwords or private tokens should not be committed to public client bundles.
            </p>
            <div style="font-size: 11.5px; color: #e2e8f0; line-height: 1.45;">
              • <strong>Recommended Production:</strong> Frontend ➔ API / Backend ➔ Database Adapter<br/>
              • <strong>Credentials Storage:</strong> Encrypted locally in ERP settings or passed via server-side proxy routes (<code>/api/db/*</code>).
            </div>
          </div>
        </div>
      </div>

      <!-- Section 2: Database List & Configuration Grid -->
      <div style="margin-bottom: 30px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
          <div>
            <h2 style="font-size: 18px; font-weight: 800; color: #fff; margin: 0;">Database List</h2>
            <p style="font-size: 12px; color: var(--text-secondary); margin: 3px 0 0;">
              Select any provider to view, test connection, or edit configuration fields.
            </p>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 320px 1fr; gap: 20px; align-items: start;">
          
          <!-- Left Column: Database Provider Selection Menu -->
          <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 16px; display: flex; flex-direction: column; gap: 10px;">
            <div style="font-size: 11px; font-weight: 800; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; padding-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.06);">
              Available Providers
            </div>

            <!-- Provider Tabs -->
            ${Object.values(PROVIDER_SPECS).map(p => `
              <div class="db-provider-tab" data-provider="${p.key}" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border-radius: 8px; border: 1.5px solid rgba(255,255,255,0.06); background: rgba(15, 23, 42, 0.5); cursor: pointer; transition: all 0.2s ease;">
                <div style="display: flex; align-items: center; gap: 10px;">
                  <span style="font-size: 20px;">${p.icon}</span>
                  <div>
                    <div style="font-weight: 700; font-size: 13.5px; color: #fff;">${p.name}</div>
                    <div style="font-size: 11px; color: var(--text-secondary);">${p.badge}</div>
                  </div>
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                  <span class="provider-status-dot" data-provider-dot="${p.key}" style="display: inline-block; width: 9px; height: 9px; border-radius: 50%; background: #10b981; box-shadow: 0 0 8px rgba(16, 185, 129, 0.6);"></span>
                </div>
              </div>
            `).join('')}

            <!-- Registered Saved Connections Count -->
            <div style="margin-top: 10px; padding: 10px 12px; background: rgba(56, 189, 248, 0.05); border: 1px solid rgba(56, 189, 248, 0.2); border-radius: 8px; font-size: 11.5px; color: #94a3b8; display: flex; justify-content: space-between; align-items: center;">
              <span>Configured Secondary DBs:</span>
              <strong style="color: #38bdf8;">${configs.length}</strong>
            </div>
          </div>

          <!-- Right Column: Interactive Configuration Form for Selected Provider -->
          <div id="provider-config-container" style="background: var(--bg-surface); border: 1.5px solid #0284c7; border-radius: var(--radius-lg); padding: 24px; box-shadow: 0 4px 25px rgba(2, 132, 199, 0.1);">
            <!-- Form populated dynamically by JS on tab click -->
            <div id="provider-form-content"></div>
          </div>

        </div>
      </div>

      <!-- Section 3: Core Database Schema & Unified Repository Design -->
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
            Universal Repository API Example (Consistent Across All 5 Databases)
          </div>
          <pre style="margin: 0; font-family: 'JetBrains Mono', monospace; font-size: 12px; line-height: 1.6; color: #38bdf8; background: transparent; padding: 0;">
<span style="color: #64748b;">// 1. Machine Inventory Repository</span>
<span style="color: #f43f5e;">const</span> machines = <span style="color: #f43f5e;">await</span> db.machines.getAll();
<span style="color: #f43f5e;">const</span> newMachine = <span style="color: #f43f5e;">await</span> db.machines.create({ name: <span style="color: #a3e635;">'Brother S-7200C'</span>, categoryId: <span style="color: #a3e635;">'cat_snls'</span>, floor: <span style="color: #a3e635;">'Floor 3'</span> });
<span style="color: #f43f5e;">await</span> db.machines.update(newMachine.id, { status: <span style="color: #a3e635;">'Operational'</span> });
<span style="color: #f43f5e;">await</span> db.machines.delete(newMachine.id);

<span style="color: #64748b;">// 2. Preventive Maintenance Job Cards</span>
<span style="color: #f43f5e;">await</span> db.maintenance.create({ machineId: <span style="color: #a3e635;">'M-042'</span>, type: <span style="color: #a3e635;">'Oil change'</span>, dueDate: <span style="color: #a3e635;">'2026-10-15'</span> });

<span style="color: #64748b;">// 3. Spare Parts Stock In & Stock Out</span>
<span style="color: #f43f5e;">await</span> db.stock.add({ partId: <span style="color: #a3e635;">'P-1002'</span>, quantity: <span style="color: #fbbf24;">50</span>, unitCost: <span style="color: #fbbf24;">350</span>, supplierId: <span style="color: #a3e635;">'sup_01'</span> });
<span style="color: #f43f5e;">await</span> db.stock.remove({ partId: <span style="color: #a3e635;">'P-1002'</span>, quantity: <span style="color: #fbbf24;">2</span>, machineId: <span style="color: #a3e635;">'M-042'</span>, reason: <span style="color: #a3e635;">'Needle bar replacement'</span> });</pre>
        </div>
      </div>

      <!-- Section 4: Local Server Disk Storage & Manual JSON Backup/Restore -->
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
export function initDatabaseConfigEvents() {
  let activeProviderKey = 'POSTGRESQL';

  // 1. Initial render of provider form
  renderProviderForm(activeProviderKey);

  // 2. Provider tab click handlers
  const tabs = document.querySelectorAll('.db-provider-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const pKey = tab.getAttribute('data-provider');
      if (!pKey || !PROVIDER_SPECS[pKey]) return;
      activeProviderKey = pKey;

      // Update active tab style
      tabs.forEach(t => {
        t.style.border = '1.5px solid rgba(255,255,255,0.06)';
        t.style.background = 'rgba(15, 23, 42, 0.5)';
      });
      tab.style.border = '1.5px solid #38bdf8';
      tab.style.background = 'rgba(2, 132, 199, 0.15)';

      renderProviderForm(activeProviderKey);
    });
  });

  // Activate first tab visually
  if (tabs[0]) {
    tabs[0].style.border = '1.5px solid #38bdf8';
    tabs[0].style.background = 'rgba(2, 132, 199, 0.15)';
  }

  // 3. Sync All Databases Button
  const btnSyncAll = document.getElementById('btn-sync-all-providers');
  if (btnSyncAll) {
    btnSyncAll.addEventListener('click', async () => {
      btnSyncAll.disabled = true;
      btnSyncAll.innerHTML = '⏳ Syncing Databases...';
      try {
        notificationService.toast('Initiating multi-database synchronization...');
        const cfgs = storage.getMultiDbConfigs ? storage.getMultiDbConfigs() : [];
        for (const c of cfgs) {
          if (c.enabled) {
            await syncManager.runFullSync(c.id).catch(e => console.warn(e));
          }
        }
        notificationService.toast('Multi-database synchronization complete!');
      } catch (err) {
        notificationService.toast('Sync completed with notices: ' + err.message);
      } finally {
        btnSyncAll.disabled = false;
        btnSyncAll.innerHTML = '🔄 Sync All Databases';
      }
    });
  }

  // 4. Backup & Restore File Handlers
  initBackupHandlers();
}

function renderProviderForm(providerKey) {
  const container = document.getElementById('provider-form-content');
  if (!container) return;

  const spec = PROVIDER_SPECS[providerKey];
  if (!spec) return;

  // Retrieve any existing saved configuration for this provider
  const allConfigs = storage.getMultiDbConfigs ? storage.getMultiDbConfigs() : [];
  const existing = allConfigs.find(c => (c.type || '').toUpperCase() === providerKey) || {};

  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 12px; margin-bottom: 16px;">
      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="font-size: 24px;">${spec.icon}</span>
        <div>
          <h3 style="font-size: 16px; font-weight: 800; color: ${spec.color}; margin: 0;">
            ${spec.name} Configuration
          </h3>
          <p style="font-size: 12px; color: var(--text-secondary); margin: 2px 0 0;">
            ${spec.description}
          </p>
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 11px; font-weight: 700; color: #34d399; background: rgba(16, 185, 129, 0.1); border: 1px solid #10b981; padding: 2px 8px; border-radius: 4px;">
          ${existing.id ? 'CONFIGURED' : 'READY TO CONFIGURE'}
        </span>
      </div>
    </div>

    <!-- Provider Form Fields -->
    <form id="form-provider-config" style="display: flex; flex-direction: column; gap: 14px;">
      
      <!-- Connection Nickname -->
      <div>
        <label style="display: block; font-size: 12px; font-weight: 700; color: #cbd5e1; margin-bottom: 4px;">
          Connection Name
        </label>
        <input type="text" id="cfg-conn-name" class="form-control" value="${existing.name || spec.name}" placeholder="e.g. Primary ${spec.name}" style="background: #0f172a; border-color: #334155; color: #fff; font-size: 13px;" />
      </div>

      <!-- Specific Required Fields -->
      ${spec.fields.map(f => {
        const val = existing[f.id] !== undefined ? existing[f.id] : (f.defaultValue || '');
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
            Backup Database (Failover Target)
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
      <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 10px; border-top: 1px solid var(--border-color); padding-top: 14px;">
        ${existing.id ? `
          <button type="button" id="btn-delete-provider-db" class="btn btn-danger btn-sm" style="margin-right: auto;">
            🗑️ Remove Connection
          </button>
        ` : ''}
        
        <button type="button" id="btn-test-connection" class="btn btn-secondary" style="border-color: #38bdf8; color: #38bdf8; font-weight: 700; display: flex; align-items: center; gap: 6px;">
          <span>🔌 [ Test Connection ]</span>
        </button>

        <button type="button" id="btn-save-provider-config" class="btn btn-primary" style="background: linear-gradient(135deg, #0284c7, #2563eb); font-weight: 700; display: flex; align-items: center; gap: 6px;">
          <span>💾 [ Save ]</span>
        </button>
      </div>

    </form>
  `;

  // Attach Test Connection Handler
  const btnTest = document.getElementById('btn-test-connection');
  if (btnTest) {
    btnTest.addEventListener('click', async () => {
      btnTest.disabled = true;
      btnTest.innerHTML = '⏳ Testing Connection...';
      const resultBox = document.getElementById('test-connection-result');
      resultBox.style.display = 'none';

      try {
        const payload = extractFormValues(spec);
        const adapter = createTestAdapter(providerKey, payload);
        const testRes = await adapter.testConnection();

        resultBox.style.display = 'block';
        if (testRes.success) {
          resultBox.style.background = 'rgba(16, 185, 129, 0.12)';
          resultBox.style.border = '1px solid rgba(16, 185, 129, 0.4)';
          resultBox.style.color = '#34d399';
          resultBox.innerHTML = `✅ <strong>Connected Successfully!</strong> Connection to ${spec.name} is verified and responsive.${testRes.latency ? ` Latency: ${testRes.latency}ms` : ''}`;
        } else {
          resultBox.style.background = 'rgba(239, 68, 68, 0.12)';
          resultBox.style.border = '1px solid rgba(239, 68, 68, 0.4)';
          resultBox.style.color = '#f87171';
          resultBox.innerHTML = `❌ <strong>Connection Notice:</strong> ${testRes.error || 'Failed to ping endpoint'}`;
        }
      } catch (err) {
        resultBox.style.display = 'block';
        resultBox.style.background = 'rgba(239, 68, 68, 0.12)';
        resultBox.style.border = '1px solid rgba(239, 68, 68, 0.4)';
        resultBox.style.color = '#f87171';
        resultBox.innerHTML = `❌ <strong>Error:</strong> ${err.message}`;
      } finally {
        btnTest.disabled = false;
        btnTest.innerHTML = '🔌 [ Test Connection ]';
      }
    });
  }

  // Attach Save Handler
  const btnSave = document.getElementById('btn-save-provider-config');
  if (btnSave) {
    btnSave.addEventListener('click', async () => {
      btnSave.disabled = true;
      btnSave.innerHTML = '⏳ Saving...';
      try {
        const payload = extractFormValues(spec);
        const connName = document.getElementById('cfg-conn-name')?.value.trim() || spec.name;
        const role = document.querySelector('input[name="cfg-db-role"]:checked')?.value || 'BACKUP';
        const autoSync = document.getElementById('cfg-auto-sync')?.checked !== false;

        const allConfigs = storage.getMultiDbConfigs ? storage.getMultiDbConfigs() : [];
        const existingIdx = allConfigs.findIndex(c => (c.type || '').toUpperCase() === providerKey);

        const configRecord = {
          id: existing.id || `db_${providerKey.toLowerCase()}_${Date.now()}`,
          name: connName,
          type: providerKey,
          role,
          autoSync,
          enabled: true,
          retryEnabled: true,
          updatedAt: new Date().toISOString(),
          ...payload
        };

        if (existingIdx !== -1) {
          allConfigs[existingIdx] = configRecord;
        } else {
          allConfigs.push(configRecord);
        }

        if (storage && typeof storage.saveMultiDbConfigs === 'function') {
          await storage.saveMultiDbConfigs(allConfigs);
        } else {
          localStorage.setItem('erp_multi_db_config', JSON.stringify(allConfigs));
        }

        // Reload SyncManager
        syncManager.configLoaded = false;
        await syncManager.loadConfig();

        notificationService.toast(`Saved configuration for ${spec.name}!`);
        renderProviderForm(providerKey);
      } catch (err) {
        alert('Failed to save database configuration: ' + err.message);
      } finally {
        btnSave.disabled = false;
        btnSave.innerHTML = '💾 [ Save ]';
      }
    });
  }

  // Attach Delete Handler if already exists
  const btnDel = document.getElementById('btn-delete-provider-db');
  if (btnDel && existing.id) {
    btnDel.addEventListener('click', async () => {
      if (!confirm(`Are you sure you want to remove the ${spec.name} connection?`)) return;
      const allConfigs = storage.getMultiDbConfigs ? storage.getMultiDbConfigs() : [];
      const updated = allConfigs.filter(c => c.id !== existing.id);
      if (storage && typeof storage.saveMultiDbConfigs === 'function') {
        await storage.saveMultiDbConfigs(updated);
      } else {
        localStorage.setItem('erp_multi_db_config', JSON.stringify(updated));
      }
      syncManager.configLoaded = false;
      await syncManager.loadConfig();
      notificationService.toast(`Removed ${spec.name} connection.`);
      renderProviderForm(providerKey);
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
    case 'TURSO':
      return new TursoAdapter(c);
    case 'FIREBASE':
      return new FirebaseAdapter(c);
    case 'CLOUDFLARE_D1':
      return new CloudflareD1Adapter(c);
    case 'NEON':
      return new NeonAdapter(c);
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
