/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Searchable Audit Trail & Activity Log Component
 * Comprehensive Multi-Factor Filtering, Category Grouping & Detailed Inspection
 */

import { storage } from '../db/storage.js';
import { TABLE_NAMES } from '../db/schema.js';
import { auditService } from '../services/auditService.js';
import { authService } from '../services/authService.js';

// Local view & filter state
let auditFilters = {
  search: '',
  category: 'ALL',     // 'ALL', 'MASTER_DATA', 'TRANSFERS', 'MACHINES', 'MAINTENANCE', 'USERS', 'SYSTEM'
  actionType: 'ALL',   // 'ALL', 'APPROVE', 'TRANSFER', 'TOGGLE', 'CREATE', 'UPDATE', 'DELETE'
  username: 'ALL',
  datePreset: 'ALL',   // 'ALL', 'TODAY', 'WEEK', 'MONTH', 'CUSTOM'
  startDate: '',
  endDate: '',
  page: 1,
  pageSize: 25
};

let activeLogDetail = null; // Currently opened modal detail

/**
 * Format timestamp into clean date and time badges
 */
function formatTimestamp(isoString) {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return { date: isoString, time: '' };

    const date = d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
    const time = d.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    return { date, time };
  } catch (_) {
    return { date: isoString, time: '' };
  }
}

/**
 * Resolve cryptic entity IDs (like lin-flo-1788686935788:806...) into user-friendly names
 */
function resolveEntityDisplay(entity, entityId) {
  let ent = 'ENTITY';
  if (typeof entity === 'string') ent = entity.toUpperCase();
  else if (entity != null) ent = String(entity).toUpperCase();

  let eid = '';
  if (typeof entityId === 'string') eid = entityId;
  else if (entityId != null) eid = (typeof entityId === 'object' ? JSON.stringify(entityId) : String(entityId));

  if (!eid) return { name: 'N/A', fullId: '', isSpecial: false };
  let friendlyName = null;

  try {
    if (ent === 'LINE') {
      const line = storage.getItem(TABLE_NAMES.LINES, eid);
      if (line && line.name) friendlyName = `Line: ${line.name}`;
    } else if (ent === 'FLOOR') {
      const floor = storage.getItem(TABLE_NAMES.FLOORS, eid);
      if (floor && floor.name) friendlyName = `Floor: ${floor.name}`;
    } else if (ent === 'UNIT') {
      const unit = storage.getItem(TABLE_NAMES.UNITS, eid);
      if (unit && unit.name) friendlyName = `Unit: ${unit.name}`;
    } else if (ent === 'MACHINE' || ent === 'MACHINE_HISTORY') {
      const m = storage.getItem(TABLE_NAMES.MACHINES, eid) || 
                (storage.getTable(TABLE_NAMES.MACHINES) || []).find(x => x.serialNumber === eid || x.id === eid);
      if (m && m.serialNumber) friendlyName = `Machine #${m.serialNumber}`;
      else friendlyName = `Machine #${eid}`;
    } else if (ent === 'TRANSFER') {
      friendlyName = `Pass ${eid}`;
    } else if (ent === 'TRANSFER_WORKFLOW') {
      friendlyName = `Workflow: ${eid}`;
    }
  } catch (_) {}

  if (friendlyName) {
    return { name: friendlyName, fullId: eid, isSpecial: true };
  }

  // Shorten raw UUID/timestamp if excessively long to prevent column clipping
  let shortened = eid;
  if (shortened.length > 20) {
    shortened = shortened.slice(0, 10) + '…' + shortened.slice(-6);
  }

  return { name: shortened, fullId: eid, isSpecial: false };
}

/**
 * Format action into readable label with color-coded badge style
 */
function formatActionBadge(action) {
  let actStr = 'ACTIVITY';
  if (typeof action === 'string') actStr = action;
  else if (typeof action === 'object' && action !== null) actStr = action.action || 'ACTIVITY';
  else if (action != null) actStr = String(action);

  const act = actStr.toUpperCase();

  if (act.includes('APPROV') || act.includes('ACCEPT') || act.includes('SUCCESS')) {
    return {
      label: act.replace(/_/g, ' '),
      icon: '✅',
      bg: 'rgba(16, 185, 129, 0.15)',
      border: 'rgba(16, 185, 129, 0.4)',
      text: '#34d399'
    };
  }
  if (act.includes('TRANSFER') || act.includes('RELOCAT') || act.includes('MOVE')) {
    return {
      label: act.replace(/_/g, ' '),
      icon: '🔄',
      bg: 'rgba(56, 189, 248, 0.15)',
      border: 'rgba(56, 189, 248, 0.4)',
      text: '#38bdf8'
    };
  }
  if (act.includes('TOGGL') || act.includes('STATUS')) {
    return {
      label: act.replace(/_/g, ' '),
      icon: '🔀',
      bg: 'rgba(168, 85, 247, 0.15)',
      border: 'rgba(168, 85, 247, 0.4)',
      text: '#c084fc'
    };
  }
  if (act.includes('CREATE') || act.includes('ADD') || act.includes('REGISTER') || act.includes('NEW')) {
    return {
      label: act.replace(/_/g, ' '),
      icon: '➕',
      bg: 'rgba(2, 132, 199, 0.15)',
      border: 'rgba(2, 132, 199, 0.4)',
      text: '#60a5fa'
    };
  }
  if (act.includes('UPDATE') || act.includes('EDIT') || act.includes('CONFIG') || act.includes('MODIFY')) {
    return {
      label: act.replace(/_/g, ' '),
      icon: '✏️',
      bg: 'rgba(245, 158, 11, 0.15)',
      border: 'rgba(245, 158, 11, 0.4)',
      text: '#fbbf24'
    };
  }
  if (act.includes('DELETE') || act.includes('REJECT') || act.includes('CANCEL') || act.includes('WIPE') || act.includes('FAIL')) {
    return {
      label: act.replace(/_/g, ' '),
      icon: '❌',
      bg: 'rgba(239, 68, 68, 0.15)',
      border: 'rgba(239, 68, 68, 0.4)',
      text: '#f87171'
    };
  }

  return {
    label: act.replace(/_/g, ' '),
    icon: 'ℹ️',
    bg: 'rgba(148, 163, 184, 0.15)',
    border: 'rgba(148, 163, 184, 0.3)',
    text: '#cbd5e1'
  };
}

export function renderAuditLogsView() {
  const allLogs = storage.getTable(TABLE_NAMES.AUDIT_LOGS) || [];
  const counts = auditService.getCategoryCounts();

  // Get distinct usernames from users table + logs
  const allUsers = storage.getTable(TABLE_NAMES.USERS) || [];
  const userSet = new Set(allUsers.map(u => (u && typeof u.username === 'string' ? u.username : '')).filter(Boolean));
  allLogs.forEach(l => { 
    if (l && typeof l.username === 'string' && l.username) userSet.add(l.username);
    else if (l && l.username) userSet.add(String(l.username));
  });
  const distinctUsers = Array.from(userSet).sort();

  // Apply filters
  const filteredLogs = auditService.getLogs(auditFilters);

  // Pagination calculation
  const totalEntries = filteredLogs.length;
  const pageSize = auditFilters.pageSize === 9999 ? totalEntries : auditFilters.pageSize;
  const totalPages = Math.max(1, Math.ceil(totalEntries / (pageSize || 1)));
  
  if (auditFilters.page > totalPages) {
    auditFilters.page = totalPages;
  }
  const startIndex = (auditFilters.page - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalEntries);
  const paginatedLogs = filteredLogs.slice(startIndex, endIndex);

  return `
    <div class="page-view audit-page-root" style="gap: 16px; padding: 18px 22px; display: flex; flex-direction: column;">
      
      <!-- 1. Top Action & Navigation Header -->
      <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 16px 22px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px; box-shadow: var(--shadow-sm);">
        <div>
          <div style="font-weight: 800; font-size: 20px; color: #fff; display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 24px;">📜</span>
            <span>System Audit Trail &amp; Activity Ledger</span>
          </div>
          <p style="font-size: 13px; color: var(--text-secondary); margin-top: 4px; margin-bottom: 0;">
            Central tamper-evident operational logs tracking all machine relocations, approvals, master data changes, and user activities.
          </p>
        </div>

        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
          <button id="btn-export-audit-excel" class="btn btn-secondary btn-sm" style="font-weight: 700; height: 36px; display: inline-flex; align-items: center; gap: 6px;" title="Export filtered logs to Excel (.xlsx)">
            <span>📊</span>
            <span>Export Excel (.xlsx)</span>
          </button>
          <button id="btn-refresh-audit-logs" class="btn btn-ghost btn-sm" style="height: 36px; border: 1px solid var(--border-color);" title="Reload activity logs">
            <span>↺</span>
            <span>Refresh</span>
          </button>
          ${authService.isAdmin() ? `
            <button id="btn-clear-all-audit-logs" class="btn btn-ghost btn-sm" style="height: 36px; color: #f87171; border: 1px solid rgba(239, 68, 68, 0.35);" title="Wipe system audit logs (Admin Only)">
              <span>🗑️</span>
              <span>Purge Logs</span>
            </button>
          ` : ''}
        </div>
      </div>

      <!-- 2. KPI Category Summary Cards (Clickable Quick Filters) -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px;">
        
        <!-- Total Logs -->
        <div class="audit-kpi-card ${auditFilters.category === 'ALL' ? 'active' : ''}" data-category="ALL" style="background: var(--bg-surface); border: 1.5px solid ${auditFilters.category === 'ALL' ? '#38bdf8' : 'var(--border-color)'}; border-radius: var(--radius-lg); padding: 14px 16px; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 12px; box-shadow: var(--shadow-sm);">
          <div style="width: 44px; height: 44px; border-radius: 10px; background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.3); display: flex; align-items: center; justify-content: center; font-size: 22px;">
            📜
          </div>
          <div>
            <div style="font-size: 20px; font-weight: 800; color: #fff;">${counts.TOTAL}</div>
            <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">All Activities</div>
          </div>
        </div>

        <!-- Master Data -->
        <div class="audit-kpi-card ${auditFilters.category === 'MASTER_DATA' ? 'active' : ''}" data-category="MASTER_DATA" style="background: var(--bg-surface); border: 1.5px solid ${auditFilters.category === 'MASTER_DATA' ? '#c084fc' : 'var(--border-color)'}; border-radius: var(--radius-lg); padding: 14px 16px; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 12px; box-shadow: var(--shadow-sm);">
          <div style="width: 44px; height: 44px; border-radius: 10px; background: rgba(168, 85, 247, 0.15); border: 1px solid rgba(168, 85, 247, 0.3); display: flex; align-items: center; justify-content: center; font-size: 22px;">
            🏢
          </div>
          <div>
            <div style="font-size: 20px; font-weight: 800; color: #c084fc;">${counts.MASTER_DATA}</div>
            <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Master Data</div>
          </div>
        </div>

        <!-- Transfers -->
        <div class="audit-kpi-card ${auditFilters.category === 'TRANSFERS' ? 'active' : ''}" data-category="TRANSFERS" style="background: var(--bg-surface); border: 1.5px solid ${auditFilters.category === 'TRANSFERS' ? '#38bdf8' : 'var(--border-color)'}; border-radius: var(--radius-lg); padding: 14px 16px; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 12px; box-shadow: var(--shadow-sm);">
          <div style="width: 44px; height: 44px; border-radius: 10px; background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.3); display: flex; align-items: center; justify-content: center; font-size: 22px;">
            🔄
          </div>
          <div>
            <div style="font-size: 20px; font-weight: 800; color: #38bdf8;">${counts.TRANSFERS}</div>
            <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Transfers</div>
          </div>
        </div>

        <!-- Machines & Inventory -->
        <div class="audit-kpi-card ${auditFilters.category === 'MACHINES' ? 'active' : ''}" data-category="MACHINES" style="background: var(--bg-surface); border: 1.5px solid ${auditFilters.category === 'MACHINES' ? '#34d399' : 'var(--border-color)'}; border-radius: var(--radius-lg); padding: 14px 16px; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 12px; box-shadow: var(--shadow-sm);">
          <div style="width: 44px; height: 44px; border-radius: 10px; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); display: flex; align-items: center; justify-content: center; font-size: 22px;">
            🧵
          </div>
          <div>
            <div style="font-size: 20px; font-weight: 800; color: #34d399;">${counts.MACHINES}</div>
            <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Equipment</div>
          </div>
        </div>

        <!-- Maintenance & Service -->
        <div class="audit-kpi-card ${auditFilters.category === 'MAINTENANCE' ? 'active' : ''}" data-category="MAINTENANCE" style="background: var(--bg-surface); border: 1.5px solid ${auditFilters.category === 'MAINTENANCE' ? '#fbbf24' : 'var(--border-color)'}; border-radius: var(--radius-lg); padding: 14px 16px; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 12px; box-shadow: var(--shadow-sm);">
          <div style="width: 44px; height: 44px; border-radius: 10px; background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.3); display: flex; align-items: center; justify-content: center; font-size: 22px;">
            🛠️
          </div>
          <div>
            <div style="font-size: 20px; font-weight: 800; color: #fbbf24;">${counts.MAINTENANCE}</div>
            <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Maintenance</div>
          </div>
        </div>

        <!-- Users & Security -->
        <div class="audit-kpi-card ${auditFilters.category === 'USERS' ? 'active' : ''}" data-category="USERS" style="background: var(--bg-surface); border: 1.5px solid ${auditFilters.category === 'USERS' ? '#f472b6' : 'var(--border-color)'}; border-radius: var(--radius-lg); padding: 14px 16px; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 12px; box-shadow: var(--shadow-sm);">
          <div style="width: 44px; height: 44px; border-radius: 10px; background: rgba(236, 72, 153, 0.15); border: 1px solid rgba(236, 72, 153, 0.3); display: flex; align-items: center; justify-content: center; font-size: 22px;">
            👥
          </div>
          <div>
            <div style="font-size: 20px; font-weight: 800; color: #f472b6;">${counts.USERS}</div>
            <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Users / Auth</div>
          </div>
        </div>

      </div>

      <!-- 3. Dynamic Filter Hub (Search, Category, Action Type, User, Date Range) -->
      <div style="background: linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.95)); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: var(--radius-lg); padding: 16px 20px; display: flex; flex-direction: column; gap: 12px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.35);">
        
        <!-- Filter Row 1: Search + Category + Action Type + User -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; align-items: flex-end;">
          
          <!-- Live Keyword Search -->
          <div style="display: flex; flex-direction: column; gap: 5px; grid-column: span 1;">
            <label for="audit-search-input" style="font-size: 11px; font-weight: 800; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 5px;">
              <span>🔍 Search Activity Logs:</span>
            </label>
            <div style="position: relative; display: flex; align-items: center;">
              <span style="position: absolute; left: 12px; font-size: 13px; color: #38bdf8;">🔍</span>
              <input 
                type="text" 
                id="audit-search-input" 
                class="form-control" 
                placeholder="Search action, details, user, ID..." 
                value="${auditFilters.search || ''}"
                style="padding-left: 34px; padding-right: 28px; height: 38px; font-size: 12.5px; background: #080d1a; border: 1.5px solid rgba(56, 189, 248, 0.4); color: #fff; border-radius: 6px;"
              />
              ${auditFilters.search ? `
                <button id="btn-clear-audit-search" type="button" class="btn btn-ghost btn-sm" style="position: absolute; right: 6px; padding: 2px 6px; font-size: 11px; color: var(--text-muted);" title="Clear search">✕</button>
              ` : ''}
            </div>
          </div>

          <!-- Module / Category Dropdown -->
          <div style="display: flex; flex-direction: column; gap: 5px;">
            <label for="filter-audit-category" style="font-size: 11px; font-weight: 800; color: #c084fc; text-transform: uppercase; letter-spacing: 0.5px;">
              <span>🏢 Activity Category:</span>
            </label>
            <select id="filter-audit-category" class="filter-select" style="height: 38px; font-size: 12.5px; background: #080d1a; color: #e2e8f0; border: 1.5px solid rgba(168, 85, 247, 0.4); border-radius: 6px;">
              <option value="ALL" ${auditFilters.category === 'ALL' ? 'selected' : ''}>All Categories (${counts.TOTAL})</option>
              <option value="MASTER_DATA" ${auditFilters.category === 'MASTER_DATA' ? 'selected' : ''}>🏢 Plant &amp; Master Data (${counts.MASTER_DATA})</option>
              <option value="TRANSFERS" ${auditFilters.category === 'TRANSFERS' ? 'selected' : ''}>🔄 Transfers &amp; Relocations (${counts.TRANSFERS})</option>
              <option value="MACHINES" ${auditFilters.category === 'MACHINES' ? 'selected' : ''}>🧵 Machine &amp; Equipment (${counts.MACHINES})</option>
              <option value="MAINTENANCE" ${auditFilters.category === 'MAINTENANCE' ? 'selected' : ''}>🛠️ Maintenance &amp; Service (${counts.MAINTENANCE})</option>
              <option value="USERS" ${auditFilters.category === 'USERS' ? 'selected' : ''}>👥 Users &amp; Security (${counts.USERS})</option>
              <option value="SYSTEM" ${auditFilters.category === 'SYSTEM' ? 'selected' : ''}>⚙️ System Operations (${counts.SYSTEM})</option>
            </select>
          </div>

          <!-- Action Type Dropdown -->
          <div style="display: flex; flex-direction: column; gap: 5px;">
            <label for="filter-audit-action-type" style="font-size: 11px; font-weight: 800; color: #34d399; text-transform: uppercase; letter-spacing: 0.5px;">
              <span>⚡ Action Type:</span>
            </label>
            <select id="filter-audit-action-type" class="filter-select" style="height: 38px; font-size: 12.5px; background: #080d1a; color: #e2e8f0; border: 1.5px solid rgba(16, 185, 129, 0.4); border-radius: 6px;">
              <option value="ALL" ${auditFilters.actionType === 'ALL' ? 'selected' : ''}>All Action Types</option>
              <option value="APPROVE" ${auditFilters.actionType === 'APPROVE' ? 'selected' : ''}>✅ Approvals &amp; Acceptances</option>
              <option value="TRANSFER" ${auditFilters.actionType === 'TRANSFER' ? 'selected' : ''}>🔄 Transfers &amp; Physical Moves</option>
              <option value="TOGGLE" ${auditFilters.actionType === 'TOGGLE' ? 'selected' : ''}>🔀 Status Toggles (Active / Inactive)</option>
              <option value="CREATE" ${auditFilters.actionType === 'CREATE' ? 'selected' : ''}>➕ Additions &amp; Creations</option>
              <option value="UPDATE" ${auditFilters.actionType === 'UPDATE' ? 'selected' : ''}>✏️ Edits, Updates &amp; Configs</option>
              <option value="DELETE" ${auditFilters.actionType === 'DELETE' ? 'selected' : ''}>❌ Deletions, Rejections &amp; Cancels</option>
            </select>
          </div>

          <!-- User / Actor Dropdown -->
          <div style="display: flex; flex-direction: column; gap: 5px;">
            <label for="filter-audit-user" style="font-size: 11px; font-weight: 800; color: #fbbf24; text-transform: uppercase; letter-spacing: 0.5px;">
              <span>👤 Initiating User:</span>
            </label>
            <select id="filter-audit-user" class="filter-select" style="height: 38px; font-size: 12.5px; background: #080d1a; color: #e2e8f0; border: 1.5px solid rgba(245, 158, 11, 0.4); border-radius: 6px;">
              <option value="ALL" ${auditFilters.username === 'ALL' ? 'selected' : ''}>All Users (${distinctUsers.length})</option>
              ${distinctUsers.map(u => {
                const isSelected = String(auditFilters.username || '').toLowerCase() === String(u || '').toLowerCase();
                return `<option value="${u}" ${isSelected ? 'selected' : ''}>${u}</option>`;
              }).join('')}
            </select>
          </div>

        </div>

        <!-- Filter Row 2: Date Range Presets + Custom Range + Reset -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; border-top: 1px solid rgba(255, 255, 255, 0.08); padding-top: 10px;">
          
          <!-- Date Presets & Inputs -->
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <span style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">📅 Time Period:</span>
            
            <div style="display: flex; gap: 4px; background: rgba(8, 13, 26, 0.7); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 6px; padding: 2px;">
              ${[
                { id: 'ALL', label: 'All Time' },
                { id: 'TODAY', label: 'Today' },
                { id: 'WEEK', label: 'Last 7 Days' },
                { id: 'MONTH', label: 'This Month' }
              ].map(p => `
                <button type="button" class="btn btn-xs btn-date-preset ${auditFilters.datePreset === p.id ? 'active' : ''}" data-preset="${p.id}" style="padding: 4px 10px; font-size: 11px; font-weight: 700; border-radius: 4px; border: none; ${auditFilters.datePreset === p.id ? 'background: #0284c7; color: #fff;' : 'background: transparent; color: #94a3b8;'}">
                  ${p.label}
                </button>
              `).join('')}
            </div>

            <!-- Custom Date Inputs -->
            <div style="display: flex; align-items: center; gap: 6px;">
              <input 
                type="date" 
                id="audit-start-date" 
                class="filter-input" 
                value="${auditFilters.startDate || ''}" 
                style="height: 32px; font-size: 11.5px; background: #080d1a; color: #fff; border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 5px;"
                title="Start Date"
              />
              <span style="font-size: 11px; color: var(--text-muted);">&rarr;</span>
              <input 
                type="date" 
                id="audit-end-date" 
                class="filter-input" 
                value="${auditFilters.endDate || ''}" 
                style="height: 32px; font-size: 11.5px; background: #080d1a; color: #fff; border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 5px;"
                title="End Date"
              />
            </div>
          </div>

          <!-- Matching Count & Reset Filters Button -->
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 12px; color: #38bdf8; font-weight: 700;">
              Showing ${filteredLogs.length} matching event${filteredLogs.length === 1 ? '' : 's'}
            </span>
            <button id="btn-reset-audit-filters" type="button" class="btn btn-ghost btn-sm" style="font-size: 11px; color: #fca5a5; padding: 4px 10px; border: 1px solid rgba(239, 68, 68, 0.35); border-radius: 4px; font-weight: 600;">
              ↺ Reset Filters
            </button>
          </div>

        </div>

      </div>

      <!-- 4. Clean, Responsive Audit Trail Table -->
      <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.35); display: flex; flex-direction: column;">
        
        <div style="overflow-x: auto; width: 100%;">
          <table class="table" style="width: 100%; border-collapse: separate; border-spacing: 0; min-width: 980px; margin-bottom: 0;">
            <thead>
              <tr style="background: #090e1d; border-bottom: 2px solid #0284c7;">
                <th style="width: 50px; text-align: center; padding: 12px 8px; font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase;">#</th>
                <th style="width: 165px; padding: 12px 14px; font-size: 11px; font-weight: 800; color: #cbd5e1; text-transform: uppercase; letter-spacing: 0.5px;">Timestamp</th>
                <th style="width: 175px; padding: 12px 14px; font-size: 11px; font-weight: 800; color: #cbd5e1; text-transform: uppercase; letter-spacing: 0.5px;">Category / Module</th>
                <th style="width: 130px; padding: 12px 14px; font-size: 11px; font-weight: 800; color: #cbd5e1; text-transform: uppercase; letter-spacing: 0.5px;">User</th>
                <th style="width: 200px; padding: 12px 14px; font-size: 11px; font-weight: 800; color: #cbd5e1; text-transform: uppercase; letter-spacing: 0.5px;">Action Performed</th>
                <th style="width: 190px; padding: 12px 14px; font-size: 11px; font-weight: 800; color: #cbd5e1; text-transform: uppercase; letter-spacing: 0.5px;">Target Entity &amp; ID</th>
                <th style="padding: 12px 16px; font-size: 11px; font-weight: 800; color: #cbd5e1; text-transform: uppercase; letter-spacing: 0.5px;">Action Details</th>
                <th style="width: 80px; text-align: center; padding: 12px 8px; font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase;">Inspect</th>
              </tr>
            </thead>
            <tbody>
              ${paginatedLogs.length === 0 ? `
                <tr>
                  <td colspan="8" style="padding: 50px 20px; text-align: center;">
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 10px;">
                      <span style="font-size: 38px;">🔍</span>
                      <div style="font-size: 16px; font-weight: 700; color: #fff;">No activity logs found</div>
                      <div style="font-size: 12.5px; color: var(--text-muted); max-width: 480px;">
                        No audit events match your active filters. Try changing or clearing your search term, category, action type, or date criteria.
                      </div>
                      <button id="btn-empty-reset-audit" type="button" class="btn btn-secondary btn-sm" style="margin-top: 8px;">
                        ↺ Clear All Filters
                      </button>
                    </div>
                  </td>
                </tr>
              ` : paginatedLogs.map((l, idx) => {
                const globalIndex = startIndex + idx + 1;
                const timeInfo = formatTimestamp(l.timestamp);
                const cat = auditService.getLogCategory(l);
                const actBadge = formatActionBadge(l.action);
                const entityInfo = resolveEntityDisplay(l.entity, l.entityId);

                return `
                  <tr class="audit-log-row" data-log-id="${l.id}" style="border-bottom: 1px solid rgba(255, 255, 255, 0.05); transition: background 0.15s; cursor: pointer;">
                    
                    <!-- 1. SL -->
                    <td style="text-align: center; font-size: 11.5px; font-family: var(--font-mono); color: #64748b; padding: 12px 8px;">
                      ${globalIndex}
                    </td>

                    <!-- 2. Timestamp -->
                    <td style="padding: 12px 14px; white-space: nowrap;">
                      <div style="font-size: 12px; font-weight: 700; color: #f1f5f9;">${timeInfo.date}</div>
                      <div style="font-size: 10.5px; font-family: var(--font-mono); color: #94a3b8; margin-top: 2px;">${timeInfo.time}</div>
                    </td>

                    <!-- 3. Module / Category -->
                    <td style="padding: 12px 14px; white-space: nowrap;">
                      <span style="display: inline-flex; align-items: center; gap: 6px; padding: 3px 9px; border-radius: 6px; background: ${cat.bg}; border: 1px solid ${cat.border}; color: ${cat.color}; font-size: 11.5px; font-weight: 700;">
                        <span>${cat.icon}</span>
                        <span>${cat.label}</span>
                      </span>
                    </td>

                    <!-- 4. User -->
                    <td style="padding: 12px 14px; white-space: nowrap;">
                      <div style="display: flex; align-items: center; gap: 8px;">
                        <div style="width: 26px; height: 26px; border-radius: 50%; background: rgba(56, 189, 248, 0.2); border: 1px solid rgba(56, 189, 248, 0.4); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; color: #38bdf8; text-transform: uppercase;">
                          ${(l.username || 'U').charAt(0)}
                        </div>
                        <span style="font-weight: 700; color: #38bdf8; font-size: 12px;">${l.username || 'system'}</span>
                      </div>
                    </td>

                    <!-- 5. Action -->
                    <td style="padding: 12px 14px; white-space: nowrap;">
                      <span style="display: inline-flex; align-items: center; gap: 6px; padding: 3px 9px; border-radius: 6px; background: ${actBadge.bg}; border: 1px solid ${actBadge.border}; color: ${actBadge.text}; font-size: 11px; font-weight: 700; font-family: var(--font-mono); max-width: 190px; overflow: hidden; text-overflow: ellipsis;" title="${l.action}">
                        <span>${actBadge.icon}</span>
                        <span>${actBadge.label}</span>
                      </span>
                    </td>

                    <!-- 6. Target Entity & ID -->
                    <td style="padding: 12px 14px;">
                      <div style="display: flex; flex-direction: column; gap: 2px;">
                        <span style="font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px;">${l.entity || 'ENTITY'}</span>
                        <div style="font-size: 12px; font-weight: 700; color: ${entityInfo.isSpecial ? '#38bdf8' : '#e2e8f0'}; max-width: 175px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${entityInfo.fullId}">
                          ${entityInfo.name}
                        </div>
                      </div>
                    </td>

                    <!-- 7. Action Details -->
                    <td style="padding: 12px 16px; font-size: 12.5px; color: #cbd5e1; line-height: 1.5; min-width: 260px;">
                      ${l.details || 'No additional details logged.'}
                    </td>

                    <!-- 8. Inspect Button -->
                    <td style="text-align: center; padding: 12px 8px;">
                      <button type="button" class="btn btn-ghost btn-sm btn-inspect-log" data-log-id="${l.id}" style="padding: 3px 8px; font-size: 12px; color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3);" title="View full event details & payload">
                        👁️
                      </button>
                    </td>

                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>

        <!-- 5. Bottom Pagination Bar -->
        ${totalEntries > 0 ? `
          <div style="background: #090e1d; border-top: 1px solid var(--border-color); padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
            
            <!-- Showing info & page size -->
            <div style="display: flex; align-items: center; gap: 12px;">
              <span style="font-size: 12px; color: var(--text-secondary);">
                Showing <strong>${startIndex + 1}</strong> to <strong>${endIndex}</strong> of <strong>${totalEntries}</strong> entries
              </span>
              <div style="display: flex; align-items: center; gap: 6px;">
                <label for="audit-page-size" style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">Per Page:</label>
                <select id="audit-page-size" class="filter-select" style="height: 28px; font-size: 11.5px; padding: 2px 6px; background: #080d1a; color: #fff; border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 4px;">
                  <option value="25" ${auditFilters.pageSize === 25 ? 'selected' : ''}>25</option>
                  <option value="50" ${auditFilters.pageSize === 50 ? 'selected' : ''}>50</option>
                  <option value="100" ${auditFilters.pageSize === 100 ? 'selected' : ''}>100</option>
                  <option value="9999" ${auditFilters.pageSize === 9999 ? 'selected' : ''}>All</option>
                </select>
              </div>
            </div>

            <!-- Page Buttons -->
            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap; justify-content: center;">
              <button id="btn-audit-page-first" class="btn btn-ghost btn-xs" ${auditFilters.page <= 1 ? 'disabled style="opacity: 0.4;"' : ''}>⏮ First</button>
              <button id="btn-audit-page-prev" class="btn btn-ghost btn-xs" ${auditFilters.page <= 1 ? 'disabled style="opacity: 0.4;"' : ''}>◀ Prev</button>
              <span style="font-size: 11.5px; font-weight: 700; color: #fff; padding: 0 6px;">
                Page ${auditFilters.page} of ${totalPages}
              </span>
              <button id="btn-audit-page-next" class="btn btn-ghost btn-xs" ${auditFilters.page >= totalPages ? 'disabled style="opacity: 0.4;"' : ''}>Next ▶</button>
              <button id="btn-audit-page-last" class="btn btn-ghost btn-xs" ${auditFilters.page >= totalPages ? 'disabled style="opacity: 0.4;"' : ''}>Last ⏭</button>
            </div>

          </div>
        ` : ''}

      </div>

      <!-- 6. Log Detail Modal (Rendered when activeLogDetail is set) -->
      ${renderLogDetailModal(activeLogDetail)}

    </div>
  `;
}

/**
 * Print official single audit event certificate / save as PDF
 */
function printAuditDetail(log) {
  if (!log) return;
  const timeInfo = formatTimestamp(log.timestamp);
  const cat = auditService.getLogCategory(log);
  const actBadge = formatActionBadge(log.action);
  const entityInfo = resolveEntityDisplay(log.entity, log.entityId);

  const printHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Audit Event Certificate - ${log.id}</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Arial, sans-serif; color: #0f172a; margin: 0; padding: 25px; background: #fff; line-height: 1.5; font-size: 13px; }
        .header { text-align: center; border-bottom: 2.5px solid #0284c7; padding-bottom: 12px; margin-bottom: 18px; }
        .title { font-size: 20px; font-weight: 800; color: #0284c7; margin: 0; letter-spacing: 0.5px; text-transform: uppercase; }
        .subtitle { font-size: 12px; color: #64748b; margin-top: 3px; font-weight: 600; }
        .doc-type { font-size: 12px; font-weight: 800; color: #1e293b; margin-top: 8px; text-transform: uppercase; letter-spacing: 1px; background: #f0f9ff; display: inline-block; padding: 4px 14px; border-radius: 4px; border: 1px solid #bae6fd; }
        .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
        .meta-table th, .meta-table td { border: 1px solid #cbd5e1; padding: 8px 12px; font-size: 12px; text-align: left; vertical-align: middle; }
        .meta-table th { background: #f8fafc; font-weight: 700; color: #475569; width: 22%; }
        .meta-table td { color: #0f172a; }
        .section-title { font-size: 12.5px; font-weight: 800; color: #0284c7; margin-top: 16px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
        .details-box { background: #f8fafc; border: 1px solid #cbd5e1; border-left: 4px solid #0284c7; padding: 12px 16px; font-size: 12.5px; color: #1e293b; border-radius: 4px; line-height: 1.6; }
        .diff-container { display: flex; gap: 14px; margin-top: 10px; }
        .diff-box { flex: 1; border: 1px solid #cbd5e1; border-radius: 4px; padding: 10px; background: #f8fafc; font-family: monospace; font-size: 11px; white-space: pre-wrap; word-break: break-all; }
        .diff-box.old { border-color: #fca5a5; background: #fff5f5; }
        .diff-box.new { border-color: #86efac; background: #f0fdf4; }
        .footer { margin-top: 45px; border-top: 1px dashed #cbd5e1; padding-top: 25px; display: flex; justify-content: space-between; font-size: 11px; color: #64748b; }
        .signature-block { text-align: center; width: 220px; }
        .signature-line { border-top: 1px solid #94a3b8; margin-top: 45px; padding-top: 4px; font-weight: 600; color: #334155; }
        @media print {
          body { padding: 6mm; }
          @page { margin: 8mm; size: A4 portrait; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="title">AL-MUSLIM GROUP</div>
        <div class="subtitle">Garments Factory Central Maintenance Machine &amp; Operations ERP</div>
        <div class="doc-type">Official System Audit Trail &amp; Activity Log Record</div>
      </div>

      <table class="meta-table">
        <tr>
          <th>Log Entry ID:</th>
          <td><strong>${log.id}</strong></td>
          <th>Timestamp:</th>
          <td>${timeInfo.date} &bull; ${timeInfo.time}</td>
        </tr>
        <tr>
          <th>Module / Category:</th>
          <td><strong>${cat.label}</strong></td>
          <th>Action Performed:</th>
          <td><strong>${actBadge.label}</strong> (${log.action})</td>
        </tr>
        <tr>
          <th>User:</th>
          <td><strong>${log.username || 'system'}</strong></td>
          <th>IP Address:</th>
          <td>${log.ip || '127.0.0.1'}</td>
        </tr>
        <tr>
          <th>Target Entity:</th>
          <td>${log.entity || 'N/A'}</td>
          <th>Target Name / ID:</th>
          <td>${entityInfo.name} ${entityInfo.fullId ? `[${entityInfo.fullId}]` : ''}</td>
        </tr>
      </table>

      <div class="section-title">Action Details &amp; Operational Record</div>
      <div class="details-box">
        ${log.details || 'No additional details logged for this activity.'}
      </div>

      ${(log.oldData || log.newData) ? `
        <div class="section-title">State Snapshot / Payload Difference</div>
        <div class="diff-container">
          ${log.oldData ? `
            <div class="diff-box old">
              <div style="font-weight: bold; color: #dc2626; margin-bottom: 4px;">[BEFORE / OLD STATE]:</div>
              ${typeof log.oldData === 'object' ? JSON.stringify(log.oldData, null, 2) : log.oldData}
            </div>
          ` : ''}
          ${log.newData ? `
            <div class="diff-box new">
              <div style="font-weight: bold; color: #16a34a; margin-bottom: 4px;">[AFTER / NEW STATE]:</div>
              ${typeof log.newData === 'object' ? JSON.stringify(log.newData, null, 2) : log.newData}
            </div>
          ` : ''}
        </div>
      ` : ''}

      <div class="footer">
        <div class="signature-block">
          <div class="signature-line">System Administrator / IT Auditor</div>
          <div>Date &amp; Time</div>
        </div>
        <div style="text-align: center; max-width: 250px; font-size: 10px; color: #94a3b8; align-self: flex-end;">
          Tamper-evident electronic system audit trail. Generated from Al-Muslim Group ERP on ${new Date().toLocaleString()}.
        </div>
        <div class="signature-block">
          <div class="signature-line">Department In-Charge / Authority</div>
          <div>Signature &amp; Seal</div>
        </div>
      </div>

      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 300);
        };
      <\/script>
    </body>
    </html>
  `;

  const printWin = window.open('', '_blank', 'width=900,height=750');
  if (printWin) {
    printWin.document.open();
    printWin.document.write(printHtml);
    printWin.document.close();
  } else {
    // Popup was blocked: fallback to hidden iframe printing
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(printHtml);
    doc.close();
    iframe.contentWindow.focus();
    setTimeout(() => {
      iframe.contentWindow.print();
      setTimeout(() => iframe.remove(), 1000);
    }, 500);
  }
}

/**
 * Save audit log detail as formatted text document
 */
function saveAuditTxt(log) {
  if (!log) return;
  const timeInfo = formatTimestamp(log.timestamp);
  const cat = auditService.getLogCategory(log);
  const entityInfo = resolveEntityDisplay(log.entity, log.entityId);

  const text = `==================================================================
AL-MUSLIM GROUP - GARMENTS FACTORY MAINTENANCE MACHINE ERP
OFFICIAL SYSTEM AUDIT TRAIL & ACTIVITY LOG RECORD
==================================================================

Event ID:       ${log.id}
Timestamp:      ${timeInfo.date} ${timeInfo.time} (${log.timestamp})
Category:       ${cat.label} (${cat.id})
Action:         ${log.action}
User:           ${log.username || 'system'}
IP Address:     ${log.ip || '127.0.0.1'}
Entity:         ${log.entity || 'N/A'}
Entity Target:  ${entityInfo.name} [${log.entityId || 'N/A'}]

------------------------------------------------------------------
ACTION DETAILS DESCRIPTION:
------------------------------------------------------------------
${log.details || 'No additional details logged.'}

${log.oldData ? `------------------------------------------------------------------
BEFORE (OLD STATE):
------------------------------------------------------------------
${typeof log.oldData === 'object' ? JSON.stringify(log.oldData, null, 2) : log.oldData}
` : ''}

${log.newData ? `------------------------------------------------------------------
AFTER (NEW STATE):
------------------------------------------------------------------
${typeof log.newData === 'object' ? JSON.stringify(log.newData, null, 2) : log.newData}
` : ''}
==================================================================
Generated on: ${new Date().toLocaleString()}
System Integrity: Tamper-Evident Local Storage Log
==================================================================
`;

  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Audit_Log_${log.id}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Save audit log detail as JSON payload file
 */
function saveAuditJson(log) {
  if (!log) return;
  const jsonStr = JSON.stringify(log, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Audit_Log_${log.id}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Copy formatted summary of audit log to clipboard
 */
function copyAuditDetail(log) {
  if (!log) return;
  const timeInfo = formatTimestamp(log.timestamp);
  const cat = auditService.getLogCategory(log);
  const entityInfo = resolveEntityDisplay(log.entity, log.entityId);

  const text = `[AUDIT LOG] ID: ${log.id} | Timestamp: ${timeInfo.date} ${timeInfo.time} | Category: ${cat.label} | User: ${log.username || 'system'} | Action: ${log.action} | Entity: ${log.entity} (${entityInfo.name}) | Details: ${log.details || 'N/A'}`;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      const icon = document.getElementById('copy-btn-icon');
      const label = document.getElementById('copy-btn-text');
      if (icon && label) {
        icon.textContent = '✓';
        label.textContent = 'Copied!';
        setTimeout(() => {
          icon.textContent = '📋';
          label.textContent = 'Copy Details';
        }, 2000);
      }
    }).catch(() => {
      prompt('Copy this log record:', text);
    });
  } else {
    prompt('Copy this log record:', text);
  }
}

/**
 * Modal to inspect full metadata, before/after diff and raw payload of a single audit log
 */
function renderLogDetailModal(log) {
  if (!log) return '';

  const timeInfo = formatTimestamp(log.timestamp);
  const cat = auditService.getLogCategory(log);
  const actBadge = formatActionBadge(log.action);
  const entityInfo = resolveEntityDisplay(log.entity, log.entityId);

  return `
    <div class="modal-overlay" id="audit-detail-modal-overlay" style="z-index: 10005; background: rgba(8, 13, 26, 0.85); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center;">
      <div class="modal-dialog" style="max-width: 720px; width: 95%; background: linear-gradient(145deg, #0f172a, #1e293b); border: 1.5px solid rgba(56, 189, 248, 0.4); border-radius: var(--radius-xl); box-shadow: 0 20px 60px rgba(0,0,0,0.85); overflow: hidden; display: flex; flex-direction: column;">
        
        <!-- Header -->
        <div class="modal-header" style="background: linear-gradient(135deg, #0284c7, #0369a1); padding: 16px 22px; display: flex; justify-content: space-between; align-items: center; gap: 12px;">
          <div style="display: flex; align-items: center; gap: 10px; color: #fff;">
            <span style="font-size: 22px;">📜</span>
            <div>
              <div style="font-size: 16px; font-weight: 800; color: #fff;">Audit Event Inspection</div>
              <div style="font-size: 11px; color: #e0f2fe; margin-top: 2px;">Tamper-evident system activity log record</div>
            </div>
          </div>
          
          <div style="display: flex; align-items: center; gap: 8px;">
            <button id="btn-header-print-audit" type="button" class="btn btn-secondary btn-sm" style="height: 32px; font-size: 12px; font-weight: 700; border-color: rgba(255,255,255,0.35); color: #fff; background: rgba(255,255,255,0.15); display: inline-flex; align-items: center; gap: 6px;" title="Print official event certificate / Save as PDF">
              <span>🖨️</span>
              <span>Print / PDF</span>
            </button>
            <button class="btn btn-ghost btn-sm btn-close-audit-detail-modal" style="color: #fff; font-size: 18px; padding: 2px 8px;" title="Close popup">✕</button>
          </div>
        </div>

        <!-- Body -->
        <div class="modal-body" style="padding: 22px; display: flex; flex-direction: column; gap: 16px; max-height: 72vh; overflow-y: auto;">
          
          <!-- Metadata Card Grid -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: rgba(8, 13, 26, 0.6); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; padding: 14px;">
            <div>
              <span style="font-size: 10.5px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Timestamp:</span>
              <div style="font-size: 13px; font-weight: 700; color: #fff; margin-top: 2px;">${timeInfo.date} &bull; ${timeInfo.time}</div>
            </div>
            <div>
              <span style="font-size: 10.5px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">User &amp; IP:</span>
              <div style="font-size: 13px; font-weight: 700; color: #38bdf8; margin-top: 2px;">${log.username || 'system'} <span style="font-size: 11px; color: #94a3b8; font-weight: normal;">(${log.ip || '127.0.0.1'})</span></div>
            </div>
            <div>
              <span style="font-size: 10.5px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Category:</span>
              <div style="margin-top: 3px;">
                <span style="display: inline-flex; align-items: center; gap: 5px; padding: 2px 8px; border-radius: 4px; background: ${cat.bg}; border: 1px solid ${cat.border}; color: ${cat.color}; font-size: 11px; font-weight: 700;">
                  ${cat.icon} ${cat.label}
                </span>
              </div>
            </div>
            <div>
              <span style="font-size: 10.5px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Action:</span>
              <div style="margin-top: 3px;">
                <span style="display: inline-flex; align-items: center; gap: 5px; padding: 2px 8px; border-radius: 4px; background: ${actBadge.bg}; border: 1px solid ${actBadge.border}; color: ${actBadge.text}; font-size: 11px; font-weight: 700; font-family: var(--font-mono);">
                  ${actBadge.icon} ${log.action}
                </span>
              </div>
            </div>
            <div style="grid-column: span 2;">
              <span style="font-size: 10.5px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Target Entity &amp; ID:</span>
              <div style="font-size: 13px; font-weight: 700; color: #38bdf8; margin-top: 2px; font-family: var(--font-mono); word-break: break-all;">
                ${log.entity}: ${entityInfo.name} <span style="font-size: 11px; color: #64748b;">[${log.entityId || 'N/A'}]</span>
              </div>
            </div>
          </div>

          <!-- Action Details -->
          <div>
            <label style="font-size: 11px; font-weight: 800; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 6px;">
              Action Details Description:
            </label>
            <div style="background: rgba(8, 13, 26, 0.75); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 8px; padding: 14px; font-size: 13px; color: #f1f5f9; line-height: 1.6;">
              ${log.details || 'No additional details provided.'}
            </div>
          </div>

          <!-- Payload / Diff (if oldData or newData exists) -->
          ${(log.oldData || log.newData) ? `
            <div>
              <label style="font-size: 11px; font-weight: 800; color: #c084fc; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 6px;">
                State Snapshot / Payload Diff:
              </label>
              <div style="display: grid; grid-template-columns: ${log.oldData && log.newData ? '1fr 1fr' : '1fr'}; gap: 10px;">
                ${log.oldData ? `
                  <div style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 6px; padding: 10px;">
                    <div style="font-size: 11px; font-weight: 700; color: #f87171; text-transform: uppercase; margin-bottom: 4px;">Before (Old State):</div>
                    <pre style="margin: 0; font-size: 11px; color: #fca5a5; max-height: 160px; overflow-y: auto; white-space: pre-wrap; font-family: var(--font-mono);">${typeof log.oldData === 'object' ? JSON.stringify(log.oldData, null, 2) : log.oldData}</pre>
                  </div>
                ` : ''}
                ${log.newData ? `
                  <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 6px; padding: 10px;">
                    <div style="font-size: 11px; font-weight: 700; color: #34d399; text-transform: uppercase; margin-bottom: 4px;">After (New State):</div>
                    <pre style="margin: 0; font-size: 11px; color: #86efac; max-height: 160px; overflow-y: auto; white-space: pre-wrap; font-family: var(--font-mono);">${typeof log.newData === 'object' ? JSON.stringify(log.newData, null, 2) : log.newData}</pre>
                  </div>
                ` : ''}
              </div>
            </div>
          ` : ''}

        </div>

        <!-- Footer with Save / Print / Copy Options -->
        <div class="modal-footer" style="background: rgba(8, 13, 26, 0.95); border-top: 1px solid var(--border-color); padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
          
          <!-- Save Options on the left -->
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <button id="btn-copy-audit-detail" type="button" class="btn btn-secondary btn-sm" style="font-size: 11.5px; font-weight: 600; height: 32px; display: inline-flex; align-items: center; gap: 5px;" title="Copy all event details to clipboard">
              <span id="copy-btn-icon">📋</span>
              <span id="copy-btn-text">Copy Details</span>
            </button>
            <button id="btn-save-audit-txt" type="button" class="btn btn-secondary btn-sm" style="font-size: 11.5px; font-weight: 600; height: 32px; display: inline-flex; align-items: center; gap: 5px;" title="Download event details as a text document (.txt)">
              <span>📄</span>
              <span>Save (.txt)</span>
            </button>
            <button id="btn-save-audit-json" type="button" class="btn btn-secondary btn-sm" style="font-size: 11.5px; font-weight: 600; height: 32px; display: inline-flex; align-items: center; gap: 5px;" title="Download raw event payload as JSON (.json)">
              <span>💾</span>
              <span>Save (.json)</span>
            </button>
          </div>

          <!-- Primary Action & Close on the right -->
          <div style="display: flex; align-items: center; gap: 8px;">
            <button id="btn-footer-print-audit" type="button" class="btn btn-primary btn-sm" style="height: 32px; font-size: 12px; font-weight: 700; background: linear-gradient(135deg, #0284c7, #0369a1); box-shadow: 0 2px 10px rgba(2, 132, 199, 0.4); display: inline-flex; align-items: center; gap: 6px;" title="Print official event certificate / Save as PDF">
              <span>🖨️</span>
              <span>Print / Save as PDF</span>
            </button>
            <button type="button" class="btn btn-ghost btn-sm btn-close-audit-detail-modal" style="height: 32px; font-size: 12px; color: #94a3b8;">
              Close
            </button>
          </div>

        </div>

      </div>
    </div>
  `;
}

/**
 * Trigger re-render of audit logs view
 */
function updateAuditView() {
  if (typeof window.app !== 'undefined' && typeof window.app.renderMainContent === 'function') {
    window.app.renderMainContent(true);
  } else {
    window.dispatchEvent(new CustomEvent('erp:master-data-updated'));
  }
}

/**
 * Initialize all interactive event listeners for Audit Logs
 */
export function initAuditLogsEvents() {

  // 1. KPI Card Click -> Filter by Category
  document.querySelectorAll('.audit-kpi-card').forEach(card => {
    card.addEventListener('click', () => {
      const cat = card.getAttribute('data-category');
      if (cat) {
        auditFilters.category = cat;
        auditFilters.page = 1;
        updateAuditView();
      }
    });
  });

  // 2. Keyword Search Input (debounced)
  const searchInput = document.getElementById('audit-search-input');
  if (searchInput) {
    let timeout = null;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        auditFilters.search = e.target.value;
        auditFilters.page = 1;
        updateAuditView();
      }, 250);
    });
  }

  // Clear Search
  document.getElementById('btn-clear-audit-search')?.addEventListener('click', () => {
    auditFilters.search = '';
    auditFilters.page = 1;
    updateAuditView();
  });

  // 3. Category Dropdown Change
  document.getElementById('filter-audit-category')?.addEventListener('change', (e) => {
    auditFilters.category = e.target.value;
    auditFilters.page = 1;
    updateAuditView();
  });

  // 4. Action Type Dropdown Change
  document.getElementById('filter-audit-action-type')?.addEventListener('change', (e) => {
    auditFilters.actionType = e.target.value;
    auditFilters.page = 1;
    updateAuditView();
  });

  // 5. User Dropdown Change
  document.getElementById('filter-audit-user')?.addEventListener('change', (e) => {
    auditFilters.username = e.target.value;
    auditFilters.page = 1;
    updateAuditView();
  });

  // 6. Date Presets (All Time, Today, Last 7 Days, This Month)
  document.querySelectorAll('.btn-date-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = btn.getAttribute('data-preset');
      auditFilters.datePreset = preset;
      auditFilters.page = 1;

      const now = new Date();
      if (preset === 'ALL') {
        auditFilters.startDate = '';
        auditFilters.endDate = '';
      } else if (preset === 'TODAY') {
        const todayStr = now.toISOString().split('T')[0];
        auditFilters.startDate = todayStr;
        auditFilters.endDate = todayStr;
      } else if (preset === 'WEEK') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        auditFilters.startDate = weekAgo.toISOString().split('T')[0];
        auditFilters.endDate = now.toISOString().split('T')[0];
      } else if (preset === 'MONTH') {
        const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        auditFilters.startDate = firstOfMonth.toISOString().split('T')[0];
        auditFilters.endDate = now.toISOString().split('T')[0];
      }

      updateAuditView();
    });
  });

  // Custom Date Range Inputs
  document.getElementById('audit-start-date')?.addEventListener('change', (e) => {
    auditFilters.startDate = e.target.value;
    auditFilters.datePreset = 'CUSTOM';
    auditFilters.page = 1;
    updateAuditView();
  });
  document.getElementById('audit-end-date')?.addEventListener('change', (e) => {
    auditFilters.endDate = e.target.value;
    auditFilters.datePreset = 'CUSTOM';
    auditFilters.page = 1;
    updateAuditView();
  });

  // 7. Reset Filters Button
  const resetHandler = () => {
    auditFilters = {
      search: '',
      category: 'ALL',
      actionType: 'ALL',
      username: 'ALL',
      datePreset: 'ALL',
      startDate: '',
      endDate: '',
      page: 1,
      pageSize: 25
    };
    updateAuditView();
  };

  document.getElementById('btn-reset-audit-filters')?.addEventListener('click', resetHandler);
  document.getElementById('btn-empty-reset-audit')?.addEventListener('click', resetHandler);

  // 8. Refresh Button
  document.getElementById('btn-refresh-audit-logs')?.addEventListener('click', () => {
    updateAuditView();
  });

  // 9. Export to Excel
  document.getElementById('btn-export-audit-excel')?.addEventListener('click', () => {
    const filtered = auditService.getLogs(auditFilters);
    auditService.exportLogsToExcel(filtered);
  });

  // 10. Clear All Logs (Superadmin)
  document.getElementById('btn-clear-all-audit-logs')?.addEventListener('click', () => {
    if (confirm('Are you sure you want to completely clear and purge all system audit logs? This action is permanent.')) {
      auditService.clearAllLogs();
      updateAuditView();
    }
  });

  // 11. Pagination Handlers
  document.getElementById('audit-page-size')?.addEventListener('change', (e) => {
    auditFilters.pageSize = parseInt(e.target.value, 10);
    auditFilters.page = 1;
    updateAuditView();
  });

  document.getElementById('btn-audit-page-first')?.addEventListener('click', () => {
    auditFilters.page = 1;
    updateAuditView();
  });
  document.getElementById('btn-audit-page-prev')?.addEventListener('click', () => {
    if (auditFilters.page > 1) {
      auditFilters.page--;
      updateAuditView();
    }
  });
  document.getElementById('btn-audit-page-next')?.addEventListener('click', () => {
    auditFilters.page++;
    updateAuditView();
  });
  document.getElementById('btn-audit-page-last')?.addEventListener('click', () => {
    const total = auditService.getLogs(auditFilters).length;
    const totalPages = Math.max(1, Math.ceil(total / auditFilters.pageSize));
    auditFilters.page = totalPages;
    updateAuditView();
  });

  // 12. Inspect Log Modal Triggers
  const openDetail = (logId) => {
    const all = storage.getTable(TABLE_NAMES.AUDIT_LOGS) || [];
    const found = all.find(l => l.id === logId);
    if (found) {
      activeLogDetail = found;
      updateAuditView();
    }
  };

  document.querySelectorAll('.btn-inspect-log').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const logId = btn.getAttribute('data-log-id');
      if (logId) openDetail(logId);
    });
  });

  document.querySelectorAll('.audit-log-row').forEach(row => {
    row.addEventListener('click', () => {
      const logId = row.getAttribute('data-log-id');
      if (logId) openDetail(logId);
    });
  });

  // 13. Modal Actions: Print, Save TXT, Save JSON, Copy Details
  const handlePrintModal = () => {
    if (activeLogDetail) printAuditDetail(activeLogDetail);
  };
  document.getElementById('btn-header-print-audit')?.addEventListener('click', handlePrintModal);
  document.getElementById('btn-footer-print-audit')?.addEventListener('click', handlePrintModal);

  document.getElementById('btn-save-audit-txt')?.addEventListener('click', () => {
    if (activeLogDetail) saveAuditTxt(activeLogDetail);
  });

  document.getElementById('btn-save-audit-json')?.addEventListener('click', () => {
    if (activeLogDetail) saveAuditJson(activeLogDetail);
  });

  document.getElementById('btn-copy-audit-detail')?.addEventListener('click', () => {
    if (activeLogDetail) copyAuditDetail(activeLogDetail);
  });

  // Close Modal
  document.querySelectorAll('.btn-close-audit-detail-modal').forEach(btn => {
    btn.addEventListener('click', () => {
      activeLogDetail = null;
      updateAuditView();
    });
  });

  const modalOverlay = document.getElementById('audit-detail-modal-overlay');
  if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) {
        activeLogDetail = null;
        updateAuditView();
      }
    });
  }
}
