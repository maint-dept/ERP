import { syncManager } from '../db/syncManager.js';
import { retryQueue } from '../db/retryQueue.js';
import { notificationService } from '../services/notificationService.js';

export function renderMultiDatabaseBackupHTML() {
  return `
    <!-- Card 6: Multi-Database Sync & Backup -->
    <div id="multi-db-backup-card" style="background: var(--bg-surface); border: 1.5px solid #0284c7; border-radius: var(--radius-lg); padding: 20px; display: flex; flex-direction: column; gap: 14px; grid-column: 1 / -1; box-shadow: 0 4px 24px rgba(2, 132, 199, 0.12);">
      
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 12px;">
        <h3 style="font-size: 16px; font-weight: 800; color: #38bdf8; margin: 0; display: flex; align-items: center; gap: 8px;">
          <span>☁️ Multi-Database Backup & Sync Management</span>
        </h3>
        <div style="display: flex; gap: 10px;">
          <button type="button" id="btn-add-secondary-db" class="btn btn-secondary btn-sm" style="font-weight: 700; color: #bae6fd; border-color: rgba(2, 132, 199, 0.4);">
            ➕ Add Secondary Database
          </button>
          <button type="button" id="btn-sync-all-dbs" class="btn btn-primary btn-sm" style="font-weight: 700; background: linear-gradient(135deg, #0284c7, #2563eb);">
            🔄 Sync All Databases
          </button>
        </div>
      </div>

      <!-- Databases List -->
      <div id="database-connections-list" style="display: flex; flex-direction: column; gap: 12px;">
        <!-- Loaded dynamically -->
      </div>
    </div>
  `;
}

export function initMultiDatabaseBackupEvents() {
  const container = document.getElementById('database-connections-list');
  if (!container) return;

  async function renderDatabases() {
    await syncManager._ensureConfig();
    
    let html = `
      <!-- PRIMARY FIREBASE -->
      <div style="background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(16, 185, 129, 0.3); border-left: 4px solid #10b981; border-radius: 8px; padding: 14px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-weight: 800; font-size: 14px; color: #fff; margin-bottom: 4px;">Firebase Firestore</div>
          <div style="font-size: 12px; color: var(--text-secondary);">
            <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #10b981; margin-right: 4px;"></span>
            Connected — <strong>Primary Source of Truth</strong>
          </div>
        </div>
        <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #34d399; font-weight: 700; padding: 4px 10px;">🟢 PRIMARY</span>
      </div>
    `;

    if (syncManager.secondaryAdapters.size === 0) {
      html += `
        <div style="text-align: center; padding: 30px; background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.1); border-radius: 8px;">
          <div style="font-size: 24px; margin-bottom: 10px;">🗄️</div>
          <div style="color: var(--text-muted); font-size: 13px;">No secondary databases configured.<br/>Click "Add Secondary Database" to configure a backup instance (e.g. Supabase).</div>
        </div>
      `;
    } else {
      const pendingStats = await retryQueue.getPending();
      
      for (const [id, adapter] of syncManager.secondaryAdapters.entries()) {
        const failedCount = pendingStats.filter(p => p.dbId === id).length;
        const statusColor = adapter.config.enabled ? (failedCount > 0 ? '#fbbf24' : '#10b981') : '#64748b';
        const statusText = adapter.config.enabled ? (failedCount > 0 ? '🟡 Syncing / Retrying' : '🟢 Fully Synced') : '⚪ Disabled';
        
        html += `
          <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(56, 189, 248, 0.2); border-left: 4px solid ${statusColor}; border-radius: 8px; padding: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div>
                <div style="font-weight: 800; font-size: 14px; color: #fff; margin-bottom: 4px;">${adapter.name} <span style="font-size: 11px; color: #94a3b8; font-weight: 500;">(${adapter.type})</span></div>
                <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 8px;">
                  <span style="font-weight: 600; color: ${statusColor};">${statusText}</span>
                </div>
                <div style="display: flex; gap: 16px; font-size: 11.5px; color: #94a3b8;">
                  <span>Auto Sync: <strong style="color: ${adapter.config.autoSync ? '#34d399' : '#f87171'}">${adapter.config.autoSync ? 'ON' : 'OFF'}</strong></span>
                  <span>Pending/Failed: <strong style="color: ${failedCount > 0 ? '#f59e0b' : '#34d399'}">${failedCount}</strong></span>
                  <span>Last Sync: <strong>${adapter.config.lastSync || 'Never'}</strong></span>
                </div>
              </div>
              <div style="display: flex; gap: 8px;">
                <button type="button" class="btn btn-ghost btn-xs btn-test-db" data-id="${id}" style="font-size: 11.5px; color: #38bdf8; border: 1px solid rgba(56,189,248,0.3);">
                  Test Connection
                </button>
                <button type="button" class="btn btn-ghost btn-xs btn-full-sync-db" data-id="${id}" style="font-size: 11.5px; color: #c084fc; border: 1px solid rgba(192,132,252,0.3);">
                  🔄 Full Sync
                </button>
                <button type="button" class="btn btn-ghost btn-xs btn-edit-db" data-id="${id}" style="font-size: 11.5px; color: #cbd5e1;">
                  Edit
                </button>
              </div>
            </div>
          </div>
        `;
      }
    }
    
    container.innerHTML = html;
    attachListEvents();
  }

  function attachListEvents() {
    document.querySelectorAll('.btn-test-db').forEach(btn => {
      btn.onclick = async (e) => {
        const id = e.target.getAttribute('data-id');
        const adapter = syncManager.secondaryAdapters.get(id);
        if (!adapter) return;
        btn.innerHTML = 'Testing...';
        btn.disabled = true;
        
        try {
          const success = await adapter.testConnection();
          if (success) {
            notificationService.toast(`✅ Connected to ${adapter.name} successfully!`);
          } else {
            notificationService.toast(`❌ Connection to ${adapter.name} failed. Check URL and Key.`, 'error');
          }
        } catch (err) {
          notificationService.toast(`❌ Error: ${err.message}`, 'error');
        } finally {
          btn.innerHTML = 'Test Connection';
          btn.disabled = false;
        }
      };
    });

    document.querySelectorAll('.btn-full-sync-db').forEach(btn => {
      btn.onclick = async (e) => {
        const id = e.target.getAttribute('data-id');
        const adapter = syncManager.secondaryAdapters.get(id);
        if (!adapter) return;
        
        const confirmed = await notificationService.confirm({
          title: 'Full Database Sync',
          message: `Are you sure you want to run a Full Initial Sync from Firebase to <strong>${adapter.name}</strong>? This will copy all existing records.`,
          confirmText: 'Start Full Sync'
        });
        
        if (confirmed) {
          notificationService.toast(`🚀 Starting Full Sync to ${adapter.name}...`);
          syncManager.runFullSync(id).catch(err => {
            console.error(err);
            notificationService.toast(`Full Sync Failed: ${err.message}`, 'error');
          });
        }
      };
    });
  }

  document.getElementById('btn-add-secondary-db').onclick = () => {
    // Basic prompt flow for adding a new db (we'll expand this with a modal)
    const name = prompt('Enter Database Name (e.g. Supabase #1):', 'Supabase Backup');
    if (!name) return;
    const url = prompt('Enter Supabase Project URL:');
    if (!url) return;
    const anonKey = prompt('Enter Supabase Anon / Publishable Key (Securely stored):');
    if (!anonKey) return;
    
    const newConfig = {
      id: 'db_' + Date.now(),
      name,
      type: 'SUPABASE',
      role: 'BACKUP',
      url,
      anonKey,
      enabled: true,
      autoSync: true,
      retryEnabled: true
    };
    
    // Read existing
    const existing = JSON.parse(localStorage.getItem('erp_multi_db_config') || '[]');
    existing.push(newConfig);
    localStorage.setItem('erp_multi_db_config', JSON.stringify(existing));
    
    syncManager.loadConfig().then(() => {
      notificationService.toast(`✅ Added ${name}. Please click Full Sync to begin initial migration.`);
      renderDatabases();
    });
  };

  renderDatabases();
  
  // Set up periodic queue processing
  setInterval(() => {
    syncManager.processRetryQueue().then(() => renderDatabases());
  }, 30000); // Check every 30s
}
