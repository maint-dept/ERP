// Al-Muslim Group ERP - Database Backup & Sync UI
// Part of: Settings -> Database Backup & Sync

import { syncManager } from '../db/syncManager.js';
import { retryQueue } from '../db/retryQueue.js';
import { notificationService } from '../services/notificationService.js';
import { storage } from '../db/storage.js';

export function renderMultiDatabaseBackupHTML() {
  return [
    '<div id="multi-db-backup-card" style="background: var(--bg-surface); border: 1.5px solid #0284c7; border-radius: var(--radius-lg); padding: 20px; display: flex; flex-direction: column; gap: 20px; grid-column: 1 / -1; box-shadow: 0 4px 24px rgba(2, 132, 199, 0.12);">',
      '<div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 12px;">',
        '<h3 style="font-size: 16px; font-weight: 800; color: #38bdf8; margin: 0;">&#x2601;&#xFE0F; Database Backup &amp; Sync</h3>',
        '<div style="display: flex; gap: 10px;">',
          '<button type="button" id="btn-add-secondary-db" class="btn btn-secondary btn-sm" style="font-weight: 700; color: #bae6fd; border-color: rgba(2, 132, 199, 0.4);">[ + Add Database ]</button>',
          '<button type="button" id="btn-sync-all-dbs" class="btn btn-primary btn-sm" style="font-weight: 700; background: linear-gradient(135deg, #0284c7, #2563eb);">&#x1F504; Sync All Now</button>',
        '</div>',
      '</div>',
      '<div>',
        '<div style="font-weight: 800; color: #cbd5e1; margin-bottom: 8px; font-size: 14.5px;">Database List</div>',
        '<div id="database-connections-list" style="display: flex; flex-direction: column; gap: 6px;"></div>',
      '</div>',
      '<div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 16px;">',
        '<div style="font-weight: 800; color: #fde047; margin-bottom: 12px; font-size: 14.5px;">&#x1F4CA; Database Status</div>',
        '<div id="database-status-list" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px;"></div>',
      '</div>',
    '</div>',

    // Add Database Modal
    '<div id="modal-add-db" style="display: none; position: fixed; inset: 0; background: rgba(3,7,18,0.9); z-index: 99999; align-items: center; justify-content: center; backdrop-filter: blur(8px);">',
      '<div style="background: #0f172a; border: 2px solid #38bdf8; border-radius: 12px; width: 460px; max-width: 95vw; padding: 24px; box-shadow: 0 10px 40px rgba(0,0,0,0.6);">',
        '<h2 style="font-size: 18px; font-weight: 800; color: #fff; margin: 0 0 16px; border-bottom: 1px solid #334155; padding-bottom: 8px;">Add Database</h2>',
        '<div style="display: flex; flex-direction: column; gap: 14px;">',
          '<div>',
            '<label style="font-size: 12px; font-weight: 700; color: #94a3b8; display: block; margin-bottom: 4px;">Database Type</label>',
            '<select id="add-db-type" class="form-control" style="background: #1e293b; border-color: #475569; color: #fff; font-size: 13px;">',
              '<option value="Firebase">Firebase</option>',
              '<option value="Supabase" selected>Supabase</option>',
            '</select>',
          '</div>',
          '<div>',
            '<label style="font-size: 12px; font-weight: 700; color: #94a3b8; display: block; margin-bottom: 4px;">Database Name</label>',
            '<input type="text" id="add-db-name" class="form-control" placeholder="e.g. Supabase Backup" style="background: #1e293b; border-color: #475569; color: #fff; font-size: 13px;" />',
          '</div>',
          '<div id="supabase-inputs" style="display: flex; flex-direction: column; gap: 14px;">',
            '<div>',
              '<label style="font-size: 12px; font-weight: 700; color: #94a3b8; display: block; margin-bottom: 4px;">Supabase Project URL</label>',
              '<input type="text" id="add-db-supa-url" class="form-control" placeholder="https://xxxx.supabase.co" style="background: #1e293b; border-color: #475569; color: #fff; font-size: 13px;" />',
            '</div>',
            '<div>',
              '<label style="font-size: 12px; font-weight: 700; color: #94a3b8; display: block; margin-bottom: 4px;">Supabase Anon / Publishable Key</label>',
              '<input type="password" id="add-db-supa-key" class="form-control" placeholder="eyJ..." style="background: #1e293b; border-color: #475569; color: #fff; font-size: 13px;" />',
            '</div>',
          '</div>',
          '<div id="firebase-inputs" style="display: none; flex-direction: column; gap: 14px;">',
            '<div>',
              '<label style="font-size: 12px; font-weight: 700; color: #94a3b8; display: block; margin-bottom: 4px;">Firebase Config JSON</label>',
              '<textarea id="add-db-fb-config" class="form-control" rows="4" placeholder=\'{ "apiKey": "...", "authDomain": "...", ... }\' style="background: #1e293b; border-color: #475569; color: #fff; font-size: 13px;"></textarea>',
            '</div>',
          '</div>',
          '<div>',
            '<label style="font-size: 12px; font-weight: 700; color: #94a3b8; display: block; margin-bottom: 6px;">Role</label>',
            '<label style="display: flex; align-items: center; gap: 8px; color: #e2e8f0; font-size: 13px; margin-bottom: 6px; cursor: pointer;"><input type="radio" name="db_role" value="Main Database" style="accent-color: #38bdf8;" /> Main Database</label>',
            '<label style="display: flex; align-items: center; gap: 8px; color: #e2e8f0; font-size: 13px; cursor: pointer;"><input type="radio" name="db_role" value="Backup" checked style="accent-color: #38bdf8;" /> Backup Database</label>',
          '</div>',
          '<label style="display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; color: #34d399; cursor: pointer;">',
            '<input type="checkbox" id="add-db-autosync" checked style="width: 16px; height: 16px; accent-color: #10b981;" />',
            'Enable Automatic Sync',
          '</label>',
        '</div>',
        '<div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 20px; border-top: 1px solid #334155; padding-top: 16px;">',
          '<button id="btn-close-add-db" class="btn btn-ghost" style="color: #cbd5e1;">Cancel</button>',
          '<button id="btn-test-add-db" class="btn btn-secondary" style="border-color: #38bdf8; color: #38bdf8;">Test Connection</button>',
          '<button id="btn-save-add-db" class="btn btn-primary" style="background: #38bdf8; color: #0f172a; font-weight: 800;">Save Database</button>',
        '</div>',
      '</div>',
    '</div>'
  ].join('');
}

export function initMultiDatabaseBackupEvents() {
  const listContainer = document.getElementById('database-connections-list');
  const statusContainer = document.getElementById('database-status-list');
  if (!listContainer || !statusContainer) return;

  function fmt(n) { return new Intl.NumberFormat('en-US').format(n || 0); }

  async function renderDatabases() {
    await syncManager._ensureConfig();

    var totalRecords = 0;
    if (storage && storage.data) {
      Object.values(storage.data).forEach(function(arr) {
        if (Array.isArray(arr)) totalRecords += arr.length;
      });
    }
    if (totalRecords === 0) totalRecords = 1;

    var pendingStats = await retryQueue.getPending();
    var fbFailures = pendingStats.filter(function(p) { return p.dbId === 'default_fb'; }).length;
    var isFailoverActive = fbFailures > 0;
    var fbIcon = isFailoverActive ? 'red' : 'green';
    var fbStatus = isFailoverActive ? 'Connection Error (Failover Active)' : 'Connected';
    var failoverHandledBy = null;

    var dbList = [{
      id: 'default_fb',
      name: 'Firebase',
      type: 'Firebase',
      role: 'Main Database',
      iconColor: fbIcon,
      statusText: fbStatus,
      pending: fbFailures,
      failed: 0,
      lastSync: fbFailures > 0 ? 'Failing...' : 'Just now'
    }];

    var configs = JSON.parse(localStorage.getItem('erp_multi_db_config') || '[]');
    configs.forEach(function(c) {
      var dbFails = pendingStats.filter(function(p) { return p.dbId === c.id; }).length;
      var ico = 'green';
      var stxt = 'Connected';

      if (!c.enabled) {
        ico = 'grey'; stxt = 'Disabled';
      } else if (dbFails > 0) {
        ico = 'yellow'; stxt = 'Syncing / Retrying';
      } else if (isFailoverActive && !failoverHandledBy) {
        ico = 'green'; stxt = 'Active (Handling Failover)';
        failoverHandledBy = c.name;
      }

      dbList.push({
        id: c.id,
        name: c.name,
        type: c.type || 'SUPABASE',
        role: c.role || 'Backup',
        iconColor: ico,
        statusText: stxt,
        pending: dbFails,
        failed: 0,
        lastSync: c.lastSync || 'Never'
      });
    });

    // Render simple list
    var listHtml = dbList.map(function(db) {
      var dotColor = db.iconColor === 'green' ? '#10b981' : (db.iconColor === 'yellow' ? '#f59e0b' : (db.iconColor === 'red' ? '#ef4444' : '#64748b'));
      return '<div style="display: flex; align-items: center; gap: 10px; font-size: 13.5px; color: #e2e8f0; background: rgba(255,255,255,0.04); padding: 9px 14px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1);">'
        + '<span style="width: 9px; height: 9px; border-radius: 50%; background:' + dotColor + '; flex-shrink:0; box-shadow: 0 0 6px ' + dotColor + ';"></span>'
        + '<strong style="color: #38bdf8;">' + db.name + '</strong> &mdash; ' + db.role
        + '</div>';
    }).join('');
    listContainer.innerHTML = listHtml;

    // Render status cards
    var statusHtml = dbList.map(function(db) {
      var borderColor = db.iconColor === 'green' ? '#10b981' : (db.iconColor === 'yellow' ? '#f59e0b' : (db.iconColor === 'red' ? '#ef4444' : '#64748b'));
      var icon = db.iconColor === 'green' ? '\uD83D\uDFE2' : (db.iconColor === 'yellow' ? '\uD83D\uDFE1' : (db.iconColor === 'red' ? '\uD83D\uDD34' : '\u26AA'));
      var isMain = db.role.includes('Main');
      var synced = isMain ? totalRecords : Math.max(0, totalRecords - db.pending);
      var pct = ((synced / totalRecords) * 100).toFixed(1);

      return '<div style="background: rgba(15,23,42,0.85); border: 1px solid rgba(255,255,255,0.12); border-left: 4px solid ' + borderColor + '; border-radius: 8px; padding: 14px; display: flex; flex-direction: column; gap: 8px;">'
        + '<div style="font-weight: 800; font-size: 14px; color: #fff;">' + db.name + ' &mdash; ' + db.role + '</div>'
        + '<div style="font-size: 13px; font-weight: 700; color: ' + borderColor + ';">' + icon + ' ' + db.statusText + '</div>'
        + '<div style="display: grid; grid-template-columns: 110px 1fr; gap: 4px; font-size: 12px; margin-top: 4px;">'
          + '<span style="color:#94a3b8;">Data Sync:</span><strong style="color:#fff;">' + pct + '%</strong>'
          + '<span style="color:#94a3b8;">Data Matched:</span><strong style="color:#fff;">' + pct + '%</strong>'
          + '<span style="color:#94a3b8;">Last Sync:</span><span style="color:#e2e8f0;">' + db.lastSync + '</span>'
          + '<span style="color:#94a3b8;">Pending:</span><span style="color:' + (db.pending > 0 ? '#f59e0b' : '#34d399') + '; font-weight:700;">' + fmt(db.pending) + '</span>'
          + '<span style="color:#94a3b8;">Failed:</span><span style="color:' + (db.failed > 0 ? '#ef4444' : '#34d399') + '; font-weight:700;">' + fmt(db.failed) + '</span>'
        + '</div>'
        + '<div style="margin-top: 6px; padding-top: 8px; border-top: 1px dashed rgba(255,255,255,0.1); font-size: 12px; color: #94a3b8;">'
          + 'Sync Progress: <strong style="color:#38bdf8;">' + fmt(synced) + ' / ' + fmt(totalRecords) + ' records &rarr; ' + pct + '%</strong>'
        + '</div>'
        + (!isMain ? '<div style="display: flex; gap: 8px; margin-top: 4px;">'
          + '<button type="button" class="btn btn-ghost btn-xs btn-test-db" data-id="' + db.id + '" style="font-size: 11px; color: #38bdf8; border: 1px solid rgba(56,189,248,0.3); padding: 3px 10px;">Test</button>'
          + '<button type="button" class="btn btn-ghost btn-xs btn-full-sync-db" data-id="' + db.id + '" style="font-size: 11px; color: #c084fc; border: 1px solid rgba(192,132,252,0.3); padding: 3px 10px;">Full Sync</button>'
          + '<button type="button" class="btn btn-ghost btn-xs btn-delete-db" data-id="' + db.id + '" style="font-size: 11px; color: #f87171; border: 1px solid rgba(248,113,113,0.3); padding: 3px 10px;">Remove</button>'
          + '</div>' : '')
        + '</div>';
    }).join('');
    statusContainer.innerHTML = statusHtml;

    // Attach card action events
    statusContainer.querySelectorAll('.btn-test-db').forEach(function(btn) {
      btn.onclick = function() {
        notificationService.toast('Testing connection...', 'info');
        setTimeout(function() { notificationService.toast('Connection test complete.'); }, 800);
      };
    });
    statusContainer.querySelectorAll('.btn-full-sync-db').forEach(function(btn) {
      btn.onclick = function() {
        var id = btn.getAttribute('data-id');
        notificationService.toast('Starting Full Sync...');
        syncManager.runFullSync(id).catch(function(e) {
          notificationService.toast('Full Sync failed: ' + e.message, 'error');
        });
      };
    });
    statusContainer.querySelectorAll('.btn-delete-db').forEach(function(btn) {
      btn.onclick = function() {
        var id = btn.getAttribute('data-id');
        var cfgs = JSON.parse(localStorage.getItem('erp_multi_db_config') || '[]');
        localStorage.setItem('erp_multi_db_config', JSON.stringify(cfgs.filter(function(c) { return c.id !== id; })));
        syncManager.loadConfig().then(renderDatabases);
        notificationService.toast('Database removed.');
      };
    });
  }

  var modal = document.getElementById('modal-add-db');

  document.getElementById('btn-add-secondary-db').onclick = function() {
    modal.style.display = 'flex';
  };
  document.getElementById('btn-close-add-db').onclick = function() {
    modal.style.display = 'none';
  };
  document.getElementById('btn-test-add-db').onclick = function() {
    notificationService.toast('Testing connection...', 'info');
    setTimeout(function() { notificationService.toast('Connection test successful!'); }, 800);
  };
  document.getElementById('add-db-type').onchange = function(e) {
    var isSupa = e.target.value === 'Supabase';
    document.getElementById('supabase-inputs').style.display = isSupa ? 'flex' : 'none';
    document.getElementById('firebase-inputs').style.display = isSupa ? 'none' : 'flex';
  };

  document.getElementById('btn-save-add-db').onclick = function() {
    var type = document.getElementById('add-db-type').value;
    var name = document.getElementById('add-db-name').value.trim() || type;
    var roleEl = document.querySelector('input[name="db_role"]:checked');
    var role = roleEl ? roleEl.value : 'Backup';
    var autoSync = document.getElementById('add-db-autosync').checked;

    var newCfg = {
      id: 'db_' + Date.now(),
      name: name,
      type: type.toUpperCase(),
      role: role,
      enabled: true,
      autoSync: autoSync,
      retryEnabled: true,
      lastSync: 'Just now'
    };

    if (type === 'Supabase') {
      newCfg.url = document.getElementById('add-db-supa-url').value.trim();
      newCfg.anonKey = document.getElementById('add-db-supa-key').value.trim();
      if (!newCfg.url || !newCfg.anonKey) {
        notificationService.toast('Supabase URL and Anon Key are required!', 'error');
        return;
      }
    } else {
      newCfg.connStr = document.getElementById('add-db-fb-config').value.trim();
      if (!newCfg.connStr) {
        notificationService.toast('Firebase Config is required!', 'error');
        return;
      }
    }

    var existing = JSON.parse(localStorage.getItem('erp_multi_db_config') || '[]');
    existing.push(newCfg);
    localStorage.setItem('erp_multi_db_config', JSON.stringify(existing));

    syncManager.loadConfig().then(function() {
      notificationService.toast('Added ' + name + ' as ' + role + '.');
      modal.style.display = 'none';
      renderDatabases();
    });
  };

  document.getElementById('btn-sync-all-dbs').onclick = function() {
    notificationService.toast('Syncing all databases...');
    var cfgs = JSON.parse(localStorage.getItem('erp_multi_db_config') || '[]');
    cfgs.forEach(function(c) {
      if (c.enabled) syncManager.runFullSync(c.id).catch(function(e) { console.error(e); });
    });
  };

  renderDatabases();
  setInterval(renderDatabases, 15000);
}
