/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Database Backup & Recovery View
 */

import { storage } from '../db/storage.js';
import { renderMultiDatabaseBackupHTML, initMultiDatabaseBackupEvents } from './databaseBackupView.js?v=4.13.0';

export function renderDatabaseConfigView() {
  return `
    <div class="page-view">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <div>
          <h1 style="font-size: 22px; font-weight: 800; color: #fff;">☁️ Database Backup & Sync</h1>
          <p style="font-size: 12.5px; color: var(--text-secondary);">
            Manage multi-database connections, automatic failover sync, and manual JSON backups.
          </p>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px;">
        
        <!-- Multi Database Backup & Sync -->
        ${renderMultiDatabaseBackupHTML()}

        <!-- Card 5: Database JSON Backup & Restore -->
        <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 20px; display: flex; flex-direction: column; gap: 14px; grid-column: 1 / -1;">
          <h3 style="font-size: 15px; font-weight: 700; color: #fbbf24; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
            💾 Backup & Recovery
          </h3>

          <!-- Persistent Server Database Status Banner -->
          <div style="background: rgba(16, 185, 129, 0.08); border: 1.5px solid rgba(16, 185, 129, 0.35); border-radius: 8px; padding: 12px 16px; font-size: 12.5px; color: #d1fae5; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
            <div>
              🟢 <strong>Persistent Server Database File:</strong> <code>data/erp_database.json</code><br/>
              <span style="font-size: 11.5px; color: var(--text-secondary);">All database records (Master Data, Machines, Spare Parts, Lines &amp; Rooms) are actively synchronized and stored to server disk.</span>
            </div>
            <button type="button" id="btn-sync-server-db" class="btn btn-secondary btn-sm" style="font-weight: 700; color: #34d399; border-color: rgba(16, 185, 129, 0.4);">
              Save Now
            </button>
          </div>

          <div style="display: flex; gap: 12px; align-items: center;">
            <button id="btn-download-db-backup" class="btn btn-primary">
              Backup Data
            </button>

            <label class="btn btn-secondary" style="cursor: pointer;">
              Restore Data
              <input type="file" id="db-restore-file-input" accept=".json" style="display: none;" />
            </label>

            <button id="btn-factory-reset" class="btn btn-danger btn-sm" style="margin-left: auto;">
              Reset Data
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function initDatabaseConfigEvents() {
  initMultiDatabaseBackupEvents();

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
        btnSyncDb.textContent = '💾 Force Save Records to Database File';
      }
    });
  }
}
