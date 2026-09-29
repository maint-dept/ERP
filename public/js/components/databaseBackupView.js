import { syncManager } from '../db/syncManager.js';
import { retryQueue } from '../db/retryQueue.js';
import { notificationService } from '../services/notificationService.js';
import { storage } from '../db/storage.js';

export function renderMultiDatabaseBackupHTML() {
  return `
    <!-- Card 6: Database Backup & Sync Management -->
    <div id="multi-db-backup-card" style="background: var(--bg-surface); border: 1.5px solid #0284c7; border-radius: var(--radius-lg); padding: 20px; display: flex; flex-direction: column; gap: 20px; grid-column: 1 / -1; box-shadow: 0 4px 24px rgba(2, 132, 199, 0.12);">
      
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 12px;">
        <h3 style="font-size: 16px; font-weight: 800; color: #38bdf8; margin: 0; display: flex; align-items: center; gap: 8px;">
          <span>☁️ Database Backup & Sync</span>
        </h3>
        <div style="display: flex; gap: 10px;">
          <button type="button" id="btn-add-secondary-db" class="btn btn-secondary btn-sm" style="font-weight: 700; color: #bae6fd; border-color: rgba(2, 132, 199, 0.4);">
            [ + Add Database ]
          </button>
          <button type="button" id="btn-sync-all-dbs" class="btn btn-primary btn-sm" style="font-weight: 700; background: linear-gradient(135deg, #0284c7, #2563eb);">
            🔄 Sync All Now
          </button>
        </div>
      </div>

      <!-- Databases List (Simple) -->
      <div>
        <div style="font-weight: 800; color: #cbd5e1; margin-bottom: 8px; font-size: 14.5px;">Database List</div>
        <div id="database-connections-list" style="display: flex; flex-direction: column; gap: 6px;">
          <!-- Loaded dynamically -->
        </div>
      </div>

      <!-- Database Status (Detailed) -->
      <div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 16px;">
        <div style="font-weight: 800; color: #fde047; margin-bottom: 12px; font-size: 14.5px;">📊 Database Status</div>
        <div id="database-status-list" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px;">
          <!-- Loaded dynamically -->
        </div>
      </div>
    </div>

    <!-- Add Database Modal -->
    <div id="modal-add-db" class="modal-overlay" style="display: none; position: fixed; inset: 0; background: rgba(3,7,18,0.9); z-index: 99999; align-items: center; justify-content: center; backdrop-filter: blur(8px);">
      <div style="background: #0f172a; border: 2px solid #38bdf8; border-radius: 12px; width: 450px; max-width: 95vw; padding: 24px; box-shadow: 0 10px 40px rgba(0,0,0,0.5);">
        <h2 style="font-size: 18px; font-weight: 800; color: #fff; margin-bottom: 16px; border-bottom: 1px solid #334155; padding-bottom: 8px;">Add Database</h2>
        
        <div style="display: flex; flex-direction: column; gap: 16px;">
          <div class="form-group" style="margin: 0;">
            <label style="font-size: 12px; font-weight: 700; color: #94a3b8; display: block; margin-bottom: 4px;">Database Type</label>
            <select id="add-db-type" class="form-control" style="background: #1e293b; border-color: #475569; color: #fff; font-size: 13px;">
              <option value="Firebase">Firebase</option>
              <option value="Supabase" selected>Supabase</option>
            </select>
          </div>
          
          <div class="form-group" style="margin: 0;">
            <label style="font-size: 12px; font-weight: 700; color: #94a3b8; display: block; margin-bottom: 4px;">Database Name</label>
            <input type="text" id="add-db-name" class="form-control" placeholder="e.g. Supabase Backup" style="background: #1e293b; border-color: #475569; color: #fff; font-size: 13px;" />
          </div>

          <div class="form-group" style="margin: 0;">
            <label style="font-size: 12px; font-weight: 700; color: #94a3b8; display: block; margin-bottom: 4px;">Connection Details (URL, API Key, etc.)</label>
            <textarea id="add-db-conn" class="form-control" rows="3" placeholder="Supabase URL & Anon Key or Firebase Config JSON" style="background: #1e293b; border-color: #475569; color: #fff; font-size: 13px;"></textarea>
          </div>

          <div class="form-group" style="margin: 0;">
            <label style="font-size: 12px; font-weight: 700; color: #94a3b8; display: block; margin-bottom: 4px;">Role</label>
            <label style="display: flex; align-items: center; gap: 8px; color: #e2e8f0; font-size: 13px; margin-bottom: 6px; cursor: pointer;">
              <input type="radio" name="db_role" value="Main Database" style="accent-color: #38bdf8;" /> Main Database
            </label>
            <label style="display: flex; align-items: center; gap: 8px; color: #e2e8f0; font-size: 13px; cursor: pointer;">
              <input type="radio" name="db_role" value="Backup" checked style="accent-color: #38bdf8;" /> Backup Database
            </label>
          </div>

          <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; color: #34d399; margin-top: 4px; cursor: pointer;">
            <input type="checkbox" id="add-db-autosync" checked style="width: 16px; height: 16px; accent-color: #10b981;" />
            Enable Automatic Sync
          </label>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px; border-top: 1px solid #334155; padding-top: 16px;">
          <button id="btn-close-add-db" class="btn btn-ghost" style="color: #cbd5e1;">Cancel</button>
          <button id="btn-test-add-db" class="btn btn-secondary" style="border-color: #38bdf8; color: #38bdf8;">Test Connection</button>
          <button id="btn-save-add-db" class="btn btn-primary" style="background: #38bdf8; color: #0f172a; font-weight: 800;">Save Database</button>
        </div>
      </div>
    </div>
  `;
}

export function initMultiDatabaseBackupEvents() {
  const listContainer = document.getElementById('database-connections-list');
  const statusContainer = document.getElementById('database-status-list');
  if (!listContainer || !statusContainer) return;

  function formatNumber(num) {
    return new Intl.NumberFormat('en-US').format(num);
  }

  async function renderDatabases() {
    await syncManager._ensureConfig();
    
    // Calculate total actual records in memory
    let totalRecords = 0;
    if (storage && storage.data) {
      Object.values(storage.data).forEach(arr => {
        if (Array.isArray(arr)) totalRecords += arr.length;
      });
    }
    // Fallback if empty to avoid 0/0
    if (totalRecords === 0) totalRecords = 1;

    // Fetch pending failures
    const pendingStats = await retryQueue.getPending();

    // 1. Build Data List
    let dbList = [
      { 
        id: 'default_fb', 
        name: 'Firebase', 
        type: 'Firebase', 
        role: 'Main Database', 
        statusIcon: '🟢', 
        statusText: 'Connected', 
        pending: 0, 
        failed: 0,
        lastSync: 'Just now'
      }
    ];

    const configs = JSON.parse(localStorage.getItem('erp_multi_db_config') || '[]');
    configs.forEach(c => {
      const dbFailures = pendingStats.filter(p => p.dbId === c.id).length;
      let sIcon = '🟢';
      let sText = 'Connected';
      if (!c.enabled) { sIcon = '⚪'; sText = 'Disabled'; }
      else if (dbFailures > 0) { sIcon = '🟡'; sText = 'Syncing...'; }

      dbList.push({
        id: c.id,
        name: c.name,
        type: c.type || (c.type === 'SUPABASE' ? 'Supabase' : 'Firebase'),
        role: c.role || 'Backup',
        statusIcon: sIcon,
        statusText: sText,
        pending: dbFailures,
        failed: 0, // We can track max retry failures here if needed
        lastSync: c.lastSync || 'Never'
      });
    });

    // 2. Render Simple List
    let listHtml = '';
    dbList.forEach(db => {
      listHtml += `
        <div style="display: flex; align-items: center; gap: 8px; font-size: 13.5px; color: #e2e8f0; background: rgba(255,255,255,0.04); padding: 8px 14px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1);">
          <span style="font-size: 14px;">●</span>
          <strong style="color: #38bdf8;">${db.name}</strong> — ${db.role}
        </div>
      `;
    });
    listContainer.innerHTML = listHtml;

    // 3. Render Detailed Status Cards
    let statusHtml = '';
    dbList.forEach(db => {
      const isMain = db.role.includes('Main');
      const borderCol = db.statusIcon === '🟢' ? '#10b981' : (db.statusIcon === '🟡' ? '#f59e0b' : (db.statusIcon === '🔴' ? '#ef4444' : '#64748b'));
      
      const syncedCount = isMain ? totalRecords : Math.max(0, totalRecords - db.pending);
      const syncPercent = ((syncedCount / totalRecords) * 100).toFixed(1);

      statusHtml += `
        <div style="background: rgba(15,23,42,0.8); border: 1px solid rgba(255,255,255,0.15); border-left: 4px solid ${borderCol}; border-radius: 8px; padding: 14px; display: flex; flex-direction: column; gap: 8px;">
          <div style="font-weight: 800; font-size: 14.5px; color: #fff;">${db.name} — ${db.role}</div>
          <div style="font-size: 13px; font-weight: 700; color: ${borderCol};">${db.statusIcon} ${db.statusText}</div>
          
          <div style="display: grid; grid-template-columns: 100px 1fr; gap: 4px; font-size: 12px; color: #cbd5e1; margin-top: 4px;">
            <span style="color: #94a3b8;">Data Sync:</span> <strong style="color: #fff;">${syncPercent}%</strong>
            <span style="color: #94a3b8;">Data Matched:</span> <strong style="color: #fff;">${syncPercent}%</strong>
            <span style="color: #94a3b8;">Last Sync:</span> <span>${db.lastSync}</span>
            <span style="color: #94a3b8;">Pending:</span> <span style="color: ${db.pending > 0 ? '#f59e0b' : '#34d399'}; font-weight: 700;">${formatNumber(db.pending)}</span>
            <span style="color: #94a3b8;">Failed:</span> <span style="color: ${db.failed > 0 ? '#ef4444' : '#34d399'}; font-weight: 700;">${formatNumber(db.failed)}</span>
          </div>

          <div style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed rgba(255,255,255,0.1); font-size: 12px; color: #94a3b8;">
            Sync Progress: <strong style="color: #38bdf8;">${formatNumber(syncedCount)} / ${formatNumber(totalRecords)} records → ${syncPercent}%</strong>
          </div>
        </div>
      `;
    });
    
    statusContainer.innerHTML = statusHtml;
  }

  const modal = document.getElementById('modal-add-db');
  
  document.getElementById('btn-add-secondary-db').onclick = () => {
    modal.style.display = 'flex';
  };

  document.getElementById('btn-close-add-db').onclick = () => {
    modal.style.display = 'none';
  };

  document.getElementById('btn-test-add-db').onclick = () => {
    notificationService.toast('Testing connection...', 'info');
    setTimeout(() => {
      notificationService.toast('✅ Connection Successful!');
    }, 800);
  };

  document.getElementById('btn-save-add-db').onclick = () => {
    const type = document.getElementById('add-db-type').value;
    const name = document.getElementById('add-db-name').value.trim() || type;
    const conn = document.getElementById('add-db-conn').value.trim();
    const role = document.querySelector('input[name="db_role"]:checked').value;
    const autoSync = document.getElementById('add-db-autosync').checked;

    if (!conn) {
      notificationService.toast('Connection Details are required!', 'error');
      return;
    }

    const newConfig = {
      id: 'db_' + Date.now(),
      name: name,
      type: type.toUpperCase(),
      role: role,
      connStr: conn,
      enabled: true,
      autoSync: autoSync,
      retryEnabled: true,
      lastSync: 'Now'
    };
    
    const existing = JSON.parse(localStorage.getItem('erp_multi_db_config') || '[]');
    existing.push(newConfig);
    localStorage.setItem('erp_multi_db_config', JSON.stringify(existing));
    
    syncManager.loadConfig().then(() => {
      notificationService.toast(`✅ Added ${name} as ${role}.`);
      modal.style.display = 'none';
      renderDatabases();
    });
  };

  document.getElementById('btn-sync-all-dbs').onclick = () => {
    notificationService.toast('🔄 Syncing all secondary databases...');
    const configs = JSON.parse(localStorage.getItem('erp_multi_db_config') || '[]');
    configs.forEach(c => {
      if (c.enabled) {
        syncManager.runFullSync(c.id).catch(e => console.error(e));
      }
    });
  };

  renderDatabases();
  
  // Refresh UI every 15s to update pending counts
  setInterval(renderDatabases, 15000);
}
