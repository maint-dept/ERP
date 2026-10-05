/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Preventive Machine Maintenance Component
 * 
 * Location: Machine Management -> Preventive Machine Maintenance
 * 
 * Full Feature Matrix:
 * 1. Summary Dashboard Cards (8 Metrics)
 * 2. Universal Search & Camera/Barcode QR Code Scanner
 * 3. Priority Urgency Reminders (Overdue, Due Today, Due Tomorrow, Due in 7 Days, Upcoming)
 * 4. Machine Maintenance Profile (Auto-filled with zero duplicate entry)
 * 5. 1-Click Fast Service Entry Modal with Interactive Checklist & Parts Replaced
 * 6. Smart Manpower Search & Auto-Fill (Search "Rahim", Card #, Floor, etc.)
 * 7. Service Sticker Serial Management (Lookup, Edit, Replace, Delete)
 * 8. High-Resolution Industrial Printable Service Sticker with Pure Vector QR Code
 * 9. Recently Serviced Section (Latest service first)
 * 10. Complete Machine Service History
 * 11. Multi-Dimensional Filter Engine (Floor, Line, Type, Brand, Dates, Mechanic)
 * 12. Admin Schedule Configuration (Machine Type Intervals & Inspection Checklists)
 */

import { state } from '../state.js';
import { authService } from '../services/authService.js';
import { barcodeService } from '../services/barcodeService.js';
import { masterDataService } from '../services/masterDataService.js';
import { preventiveMaintenanceService } from '../services/preventiveMaintenanceService.js';
import { machineService } from '../services/machineService.js';
import { employeeService } from '../services/employeeService.js';
import { notificationService } from '../services/notificationService.js';
import { excelService } from '../services/excelService.js';

// Local view state to preserve working session across tab switches
let activeTab = 'dashboard'; // 'dashboard' | 'recently-serviced' | 'machine-profile' | 'master-schedule' | 'admin-config'
let selectedMachineId = null; // Dynamically resolved to active machine
let searchQuery = '';
let filterFloorId = 'ALL';
let filterLineId = 'ALL';
let filterMachineType = 'ALL';
let filterUrgency = 'ALL';
let filterDateFrom = '';
let filterDateTo = '';
let filterServicedBy = 'ALL';

// Pagination state variables (matching Machine Inventory UX)
let pmCurrentPage = 1;
let pmPageSize = 25; // 25 | 50 | 100 | 'ALL'

/**
 * Standard date display formatter (DD-MM-YYYY)
 */
function formatDisplayDate(d) {
  return preventiveMaintenanceService.formatDateDMY(d, '-');
}

/**
 * Reusable clean pagination footer bar matching Machine Inventory
 */
function renderPaginationBar(totalItems, currentPage, pageSize, itemLabel = 'records') {
  const isAll = pageSize === 'ALL';
  const limit = isAll ? totalItems : parseInt(pageSize, 10);
  const totalPages = Math.max(1, isAll ? 1 : Math.ceil(totalItems / limit));
  const curPage = Math.min(currentPage, totalPages);
  const startItem = totalItems === 0 ? 0 : (curPage - 1) * limit + 1;
  const endItem = isAll ? totalItems : Math.min(curPage * limit, totalItems);

  let pageButtonsHtml = '';
  const maxButtons = 5;
  let startP = Math.max(1, curPage - 2);
  let endP = Math.min(totalPages, startP + maxButtons - 1);
  if (endP - startP < maxButtons - 1) {
    startP = Math.max(1, endP - maxButtons + 1);
  }

  for (let p = startP; p <= endP; p++) {
    pageButtonsHtml += `
      <button class="page-btn btn-pm-page-number ${p === curPage ? 'active' : ''}" data-page="${p}">
        ${p}
      </button>
    `;
  }

  return `
    <div class="inventory-pagination-bar" style="margin-top: 8px; padding: 6px 14px;">
      <div class="pagination-counter" style="font-size: 12px;">
        Showing <strong style="color: #fff;">${startItem}–${endItem}</strong> of <strong style="color: #38bdf8;">${totalItems}</strong> ${itemLabel}
      </div>

      <div style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-secondary);">
        <span>Rows per page:</span>
        <select class="filter-select-compact sel-pm-page-size" style="width: 72px; height: 28px; font-size: 11.5px; padding: 0 6px;">
          <option value="25" ${pageSize === 25 || pageSize === '25' ? 'selected' : ''}>25</option>
          <option value="50" ${pageSize === 50 || pageSize === '50' ? 'selected' : ''}>50</option>
          <option value="100" ${pageSize === 100 || pageSize === '100' ? 'selected' : ''}>100</option>
          <option value="ALL" ${pageSize === 'ALL' ? 'selected' : ''}>All</option>
        </select>
      </div>

      <div class="pagination-controls" style="gap: 3px;">
        <button class="page-btn btn-pm-prev-page" data-page="${curPage - 1}" ${curPage <= 1 ? 'disabled' : ''} title="Previous Page" style="height: 28px; min-width: 28px; font-size: 11px;">◀</button>
        ${pageButtonsHtml}
        <button class="page-btn btn-pm-next-page" data-page="${curPage + 1}" ${curPage >= totalPages ? 'disabled' : ''} title="Next Page" style="height: 28px; min-width: 28px; font-size: 11px;">▶</button>
      </div>
    </div>
  `;
}

/**
 * Robust dynamic machine resolver:
 * Ensures active machine context always resolves to a valid machine in the current filter scope or inventory
 */
function getValidActiveMachineId() {
  if (selectedMachineId) {
    const prof = preventiveMaintenanceService.getMachinePreventiveProfile(selectedMachineId);
    if (prof) return prof.machineId;
  }
  const filtered = preventiveMaintenanceService.getAllMachinesWithMaintenance({
    search: searchQuery,
    floorId: filterFloorId,
    lineId: filterLineId,
    machineType: filterMachineType,
    urgencyStatus: filterUrgency
  });
  if (filtered && filtered.length > 0) return filtered[0].machineId;
  const anyMachines = preventiveMaintenanceService.getAllMachinesWithMaintenance();
  if (anyMachines && anyMachines.length > 0) return anyMachines[0].machineId;
  return null;
}

// Active modal states
let activePmModal = null; // null | 'service-entry' | 'qr-scanner' | 'print-sticker' | 'edit-sticker' | 'config-modal' | 'bulk-excel-modal'
let modalMachineContext = null;
let modalServiceContext = null;
let bulkExcelParsedRows = null;
let bulkExcelPreviewResult = null;

let configSearchQuery = '';

export function renderPreventiveMaintenanceView() {
  const user = authService.getCurrentUser();
  const isAdmin = authService.isAdmin();
  const canCreate = isAdmin || (typeof authService.hasAccess === 'function' ? authService.hasAccess('preventive_maintenance', 'CREATE_SERVICE') : true);
  const canConfig = isAdmin || (typeof authService.hasAccess === 'function' ? authService.hasAccess('preventive_maintenance', 'CONFIGURATION') : true);

  // Active filter payload for dynamic metrics calculation
  const activeFilters = {
    search: searchQuery,
    floorId: filterFloorId,
    lineId: filterLineId,
    machineType: filterMachineType,
    urgencyStatus: filterUrgency
  };

  // Dynamic Metrics & Cascading Locations
  const metrics = preventiveMaintenanceService.getDashboardMetrics(activeFilters);
  const floors = masterDataService.getFloors ? masterDataService.getFloors() : [];
  // Cascading lines: ONLY lines for selected floor (or all if ALL selected)
  const lines = masterDataService.getLines ? masterDataService.getLines(filterFloorId === 'ALL' ? null : filterFloorId) : [];
  const configs = preventiveMaintenanceService.getConfigs();

  // Active Filter Tags List (Identical UX to Machine Inventory)
  const activeTags = [];
  if (searchQuery) activeTags.push({ key: 'search', label: `Search: "${searchQuery}"` });
  if (filterFloorId && filterFloorId !== 'ALL') {
    const flr = masterDataService.getFloorById ? masterDataService.getFloorById(filterFloorId) : floors.find(f => f.id === filterFloorId);
    activeTags.push({ key: 'floorId', label: `Floor: ${flr?.name || filterFloorId}` });
  }
  if (filterLineId && filterLineId !== 'ALL') {
    const lin = masterDataService.getLineById ? masterDataService.getLineById(filterLineId) : lines.find(l => l.id === filterLineId);
    activeTags.push({ key: 'lineId', label: `Line: ${lin?.name || filterLineId}` });
  }
  if (filterMachineType && filterMachineType !== 'ALL') {
    activeTags.push({ key: 'machineType', label: `Type: ${filterMachineType}` });
  }
  if (filterUrgency && filterUrgency !== 'ALL') {
    const uLabel = filterUrgency.replace(/_/g, ' ');
    activeTags.push({ key: 'urgency', label: `Urgency: ${uLabel}` });
  }
  const hasActiveFilters = activeTags.length > 0;

  return `
    <div class="page-view preventive-maintenance-page inventory-page-wrapper" style="display: flex; flex-direction: column; gap: 8px; height: 100%; min-height: 0; background: var(--bg-main); color: var(--text-primary); overflow-y: auto; padding: 10px 16px;">
      
      <!-- 1. ULTRA-COMPACT TOP UNIFIED BAR (Title + KPI Status Pills + Quick Action Buttons) -->
      <div class="inventory-top-unified-bar">
        
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <h1 style="font-size: 15.5px; font-weight: 800; color: #fff; margin: 0; display: flex; align-items: center; gap: 6px;">
            <span>🛡️</span> Preventive Maintenance
          </h1>

          <span class="pm-sync-badge" title="Live Auto-Sync with Machine Inventory & Master Data Storage Active" style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); font-size: 10.5px; font-weight: 700; padding: 2px 7px; border-radius: 12px; display: inline-flex; align-items: center; gap: 4px;">
            <span style="width: 6px; height: 6px; border-radius: 50%; background: #10b981; display: inline-block;"></span>
            Auto-Sync Active
          </span>

          <!-- Inline KPI Status Pills (Direct Click to Filter) -->
          <div class="inventory-inline-kpis">
            <div class="kpi-pill kpi-total pm-kpi-pill" data-kpi-action="reset" title="Total registered machines (Click to show all)" style="cursor: pointer;">
              <span class="kpi-dot">🏭</span>
              <strong class="kpi-val">${metrics.totalMachines}</strong>
              <span class="kpi-lbl">Total</span>
            </div>
            <div class="kpi-pill kpi-repair pm-kpi-pill" data-kpi-urgency="OVERDUE" title="Overdue maintenance (Click to filter)" style="border-left: 3px solid #ef4444; cursor: pointer; ${filterUrgency === 'OVERDUE' ? 'background: rgba(239, 68, 68, 0.25); border-color: #ef4444;' : ''}">
              <span class="kpi-dot">🔴</span>
              <strong class="kpi-val" style="color: #f87171;">${metrics.overdue}</strong>
              <span class="kpi-lbl">Overdue</span>
            </div>
            <div class="kpi-pill kpi-repair pm-kpi-pill" data-kpi-urgency="DUE_TODAY" title="Due today (Click to filter)" style="border-left: 3px solid #f97316; cursor: pointer; ${filterUrgency === 'DUE_TODAY' ? 'background: rgba(249, 115, 22, 0.25); border-color: #f97316;' : ''}">
              <span class="kpi-dot">🚨</span>
              <strong class="kpi-val" style="color: #fb923c;">${metrics.dueToday}</strong>
              <span class="kpi-lbl">Due Today</span>
            </div>
            <div class="kpi-pill kpi-usable pm-kpi-pill" data-kpi-urgency="DUE_SOON" title="Due in 7 days (Click to filter)" style="border-left: 3px solid #f59e0b; cursor: pointer; ${filterUrgency === 'DUE_SOON' ? 'background: rgba(245, 158, 11, 0.25); border-color: #f59e0b;' : ''}">
              <span class="kpi-dot">🟡</span>
              <strong class="kpi-val" style="color: #fbbf24;">${metrics.dueWithin7Days}</strong>
              <span class="kpi-lbl">Due 7d</span>
            </div>
            <div class="kpi-pill kpi-running pm-kpi-pill" data-kpi-urgency="SCHEDULED" title="Upcoming scheduled (Click to filter)" style="cursor: pointer; ${filterUrgency === 'SCHEDULED' ? 'background: rgba(16, 185, 129, 0.25); border-color: #10b981;' : ''}">
              <span class="kpi-dot">🟢</span>
              <strong class="kpi-val" style="color: #34d399;">${metrics.upcoming}</strong>
              <span class="kpi-lbl">Upcoming</span>
            </div>
            <div class="kpi-pill kpi-total pm-kpi-pill" data-kpi-tab="recently-serviced" title="Serviced today (Click to view records)" style="border-left: 3px solid #06b6d4; cursor: pointer;">
              <span class="kpi-dot">⚡</span>
              <strong class="kpi-val" style="color: #22d3ee;">${metrics.servicedToday}</strong>
              <span class="kpi-lbl">Today</span>
            </div>
          </div>
        </div>

        <!-- Right Side Quick Action Buttons -->
        <div class="inventory-top-actions-group" style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
          <button id="btn-pm-open-scanner" class="btn btn-secondary btn-sm" style="font-weight: 600; padding: 4px 10px; font-size: 12px;" title="Scan QR Code or Barcode">
            📷 Scan Barcode
          </button>
          ${canCreate ? `
            <button id="btn-pm-new-service-top" class="btn btn-primary btn-sm" style="font-weight: 700; padding: 4px 12px; font-size: 12px;">
              ➕ New Service Entry
            </button>
          ` : ''}
          <button id="btn-pm-print-active-sticker" class="btn btn-secondary btn-sm" style="font-weight: 600; padding: 4px 10px; font-size: 12px;" title="Print physical service sticker">
            🏷️ Print Sticker
          </button>
          <button id="btn-pm-export-excel" class="btn btn-secondary btn-sm" style="font-weight: 600; padding: 4px 10px; font-size: 12px;" title="Export filtered maintenance list to Excel">
            📤 Export
          </button>
          ${canConfig ? `
            <button id="btn-pm-top-bulk-excel" class="btn btn-secondary btn-sm" style="font-weight: 700; padding: 4px 10px; font-size: 12px; color: #38bdf8; border-color: rgba(56, 189, 248, 0.4); background: rgba(56, 189, 248, 0.1);" title="Bulk configure maintenance intervals (days) via Excel">
              📊 Bulk Excel Days
            </button>
            <button id="btn-pm-tab-config" class="btn btn-secondary btn-sm" style="font-weight: 600; padding: 4px 10px; font-size: 12px;" title="Admin Schedule Configuration">
              ⚙️ Config
            </button>
          ` : ''}
        </div>
      </div>

      <!-- 2. ROBUST 2-TIER STRUCTURED FILTER BAR -->
      <div class="compact-filter-bar" style="padding: 10px 14px; display: flex; flex-direction: column; gap: 8px; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); box-shadow: var(--shadow-sm);">
        
        <!-- Row 1: Universal Search & Location Hierarchy -->
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; width: 100%;">
          
          <!-- Unified Search Input -->
          <div class="filter-search-wrap" style="flex: 2 1 260px; min-width: 240px; position: relative;">
            <span class="filter-search-icon" style="left: 12px; font-size: 13px;">🔍</span>
            <input 
              type="text" 
              id="pm-universal-search-input" 
              class="filter-search-input has-icon-left" 
              placeholder="Search machine, serial, sticker, floor, line..." 
              value="${escapeHtml(searchQuery)}"
              style="height: 34px; font-size: 12.5px; padding-left: 44px !important; padding-right: ${searchQuery ? '36px' : '12px'} !important;"
            />
            <div class="filter-search-actions" style="right: 6px;">
              ${searchQuery ? `
                <button id="btn-pm-clear-search" type="button" class="filter-search-btn" style="height: 24px; width: 24px; font-size: 12px;" title="Clear Search">✕</button>
              ` : ''}
            </div>
            <div id="pm-search-suggestions-box" class="pm-suggestions-dropdown" style="display: none;"></div>
          </div>

          <!-- Floor Dropdown -->
          <div class="filter-select-item" style="flex: 1 1 130px; min-width: 125px;">
            <select id="pm-filter-floor" class="filter-select-compact" style="height: 34px; font-size: 12px; width: 100%;">
              <option value="ALL">All Floors (${floors.length})</option>
              ${floors.map(f => `<option value="${f.id}" ${filterFloorId === f.id ? 'selected' : ''}>${escapeHtml(f.name)}</option>`).join('')}
            </select>
          </div>

          <!-- Line Dropdown -->
          <div class="filter-select-item" style="flex: 1 1 130px; min-width: 125px;">
            <select id="pm-filter-line" class="filter-select-compact" style="height: 34px; font-size: 12px; width: 100%;">
              <option value="ALL">All Lines (${lines.length})</option>
              ${lines.map(l => `<option value="${l.id}" ${filterLineId === l.id ? 'selected' : ''}>${escapeHtml(l.name)}</option>`).join('')}
            </select>
          </div>

        </div>

        <!-- Row 2: Machine Type, Urgency Status & Action Controls -->
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; width: 100%;">
          
          <!-- Machine Type Dropdown -->
          <div class="filter-select-item" style="flex: 1.5 1 160px; min-width: 145px;">
            <select id="pm-filter-type" class="filter-select-compact" style="height: 32px; font-size: 12px; width: 100%;">
              <option value="ALL">All Machine Types (${configs.length})</option>
              ${configs.map(c => `<option value="${escapeHtml(c.machineType)}" ${filterMachineType === c.machineType ? 'selected' : ''}>${escapeHtml(c.machineType)} ${c.machineCount ? `(${c.machineCount})` : ''}</option>`).join('')}
            </select>
          </div>

          <!-- Urgency Dropdown -->
          <div class="filter-select-item" style="flex: 1 1 130px; min-width: 120px;">
            <select id="pm-filter-urgency" class="filter-select-compact" style="height: 32px; font-size: 12px; width: 100%;">
              <option value="ALL" ${filterUrgency === 'ALL' ? 'selected' : ''}>All Urgencies</option>
              <option value="OVERDUE" ${filterUrgency === 'OVERDUE' ? 'selected' : ''}>🔴 Overdue</option>
              <option value="DUE_TODAY" ${filterUrgency === 'DUE_TODAY' ? 'selected' : ''}>🔴 Due Today</option>
              <option value="DUE_TOMORROW" ${filterUrgency === 'DUE_TOMORROW' ? 'selected' : ''}>🟠 Due Tomorrow</option>
              <option value="DUE_SOON" ${filterUrgency === 'DUE_SOON' ? 'selected' : ''}>🟡 Due in 7 Days</option>
              <option value="SCHEDULED" ${filterUrgency === 'SCHEDULED' ? 'selected' : ''}>🟢 Upcoming</option>
            </select>
          </div>

          <!-- Reset Button -->
          <button id="btn-pm-reset-filters" class="btn btn-secondary btn-sm" style="font-weight: 700; font-size: 11.5px; padding: 4px 12px; height: 32px; border-radius: 6px; margin-left: auto;" title="Reset all filters">
            ↺ Reset
          </button>
        </div>

        <!-- Active Filter Tags Strip (identical to Machine Inventory) -->
        ${hasActiveFilters ? `
          <div style="display: flex; align-items: center; gap: 5px; flex-wrap: wrap; margin-top: 4px; padding-top: 4px; border-top: 1px solid rgba(255, 255, 255, 0.06);">
            <span style="font-size: 10.5px; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Active Filters:</span>
            ${activeTags.map(tag => `
              <span class="active-filter-tag pm-active-filter-tag" data-filter-key="${tag.key}" style="display: inline-flex; align-items: center; gap: 4px; background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 4px; padding: 1px 6px; font-size: 11px; color: #38bdf8; cursor: pointer;" title="Click to remove">
                ${tag.label} <span style="color: #f87171; font-weight: bold; margin-left: 2px;">✕</span>
              </span>
            `).join('')}
            <button id="btn-pm-clear-all-tags" class="btn btn-ghost btn-sm" style="padding: 1px 5px; font-size: 10.5px; color: #f87171; text-decoration: underline; cursor: pointer;">Clear All</button>
          </div>
        ` : ''}
      </div>

      <!-- 3. COMPACT NAVIGATION TABS BAR WITH RECORD COUNTS -->
      <div class="pm-tabs-bar" style="display: flex; gap: 4px; border-bottom: 1.5px solid var(--border-color); margin-top: 2px; margin-bottom: 4px;">
        <button class="pm-tab-btn ${activeTab === 'dashboard' ? 'active' : ''}" data-pm-tab="dashboard">
          📊 Priority Reminders (${metrics.totalMachines})
        </button>
        <button class="pm-tab-btn ${activeTab === 'recently-serviced' ? 'active' : ''}" data-pm-tab="recently-serviced">
          🕒 Recently Serviced (${metrics.recentlyServiced || 0})
        </button>
        <button class="pm-tab-btn ${activeTab === 'machine-profile' ? 'active' : ''}" data-pm-tab="machine-profile">
          🔍 Machine Profile
        </button>
        <button class="pm-tab-btn ${activeTab === 'master-schedule' ? 'active' : ''}" data-pm-tab="master-schedule">
          📅 Master Schedule (${metrics.globalTotalMachines || metrics.totalMachines})
        </button>
        ${canConfig ? `
          <button class="pm-tab-btn ${activeTab === 'admin-config' ? 'active' : ''}" data-pm-tab="admin-config">
            ⚙️ Admin Config (${configs.length})
          </button>
        ` : ''}
      </div>

      <!-- ACTIVE TAB CONTENT AREA -->
      <div class="pm-tab-content-container" style="flex: 1; min-height: 0;">
        ${renderActiveTabContent()}
      </div>

      <!-- MODAL LAYER CONTAINER -->
      <div id="pm-modal-layer">
        ${renderActivePmModal()}
      </div>

    </div>
  `;
}

// =========================================================================
// RENDER ACTIVE TAB
// =========================================================================

function renderActiveTabContent() {
  let content = '';
  switch (activeTab) {
    case 'dashboard':
      content = renderDashboardAndRemindersTab();
      break;
    case 'recently-serviced':
      content = renderRecentlyServicedTab();
      break;
    case 'machine-profile':
      content = renderMachineProfileTab();
      break;
    case 'master-schedule':
      content = renderMasterScheduleTab();
      break;
    case 'admin-config':
      content = renderAdminConfigTab();
      break;
    default:
      content = renderDashboardAndRemindersTab();
      break;
  }
  return `<div class="pm-tab-content-wrapper" style="max-width: 1560px; width: 100%; margin: 0 auto; display: flex; flex-direction: column; gap: 10px;">${content}</div>`;
}

// -------------------------------------------------------------------------
// TAB 1: DASHBOARD & URGENCY REMINDERS
// -------------------------------------------------------------------------
function renderDashboardAndRemindersTab() {
  const upcomingMachines = preventiveMaintenanceService.getUpcomingMaintenance({
    search: searchQuery,
    floorId: filterFloorId,
    lineId: filterLineId,
    machineType: filterMachineType,
    urgencyStatus: filterUrgency
  });

  const overdueList = upcomingMachines.filter(m => m.urgency.status === 'OVERDUE');
  const dueTodayList = upcomingMachines.filter(m => m.urgency.status === 'DUE_TODAY');

  const total = upcomingMachines.length;
  const isAll = pmPageSize === 'ALL';
  const limit = isAll ? total : parseInt(pmPageSize, 10);
  const totalPages = Math.max(1, isAll ? 1 : Math.ceil(total / limit));
  const curPage = Math.min(pmCurrentPage, totalPages);
  const startIndex = (curPage - 1) * limit;
  const pagedMachines = isAll ? upcomingMachines : upcomingMachines.slice(startIndex, startIndex + limit);

  return `
    <div style="display: flex; flex-direction: column; gap: 8px;">
      
      <!-- URGENT ALERTS BANNER IF ANY OVERDUE OR DUE TODAY -->
      ${(overdueList.length > 0 || dueTodayList.length > 0) ? `
        <div style="background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.35); border-radius: var(--radius-md); padding: 7px 14px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 8px; font-size: 12px;">
            <span style="font-size: 16px;">🚨</span>
            <span style="font-weight: 700; color: #f87171;">Action Required:</span>
            <span style="color: #cbd5e1;">
              <strong style="color: #fff;">${overdueList.length}</strong> overdue &bull; <strong style="color: #fff;">${dueTodayList.length}</strong> due today
            </span>
          </div>
          <button id="btn-pm-filter-urgent-only" class="btn btn-sm" style="background: #ef4444; color: #fff; font-weight: 700; font-size: 11px; padding: 2px 8px; border: none; border-radius: 4px; cursor: pointer;">
            Show Urgent Only
          </button>
        </div>
      ` : ''}

      <!-- REMINDER FOR NEXT SERVICING TABLE CARD -->
      <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-sm);">
        <div style="padding: 10px 14px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; background: rgba(255,255,255,0.015);">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 14px;">⏰</span>
            <strong style="font-size: 13px; color: #fff;">Reminder for Next Servicing (Priority Ranked)</strong>
            <span style="font-size: 11px; color: var(--text-muted);">&bull; Overdue &rarr; Due Today &rarr; Due 7d &rarr; Upcoming</span>
          </div>
          <span style="font-size: 12px; color: var(--text-muted); font-weight: 600;">
            Total: <strong style="color: #38bdf8;">${total}</strong> Schedules
          </span>
        </div>

        <div class="table-responsive" style="max-height: calc(100vh - 280px); overflow-y: auto; overflow-x: auto; width: 100%;">
          <table class="pm-table" style="width: 100%; min-width: 1000px; border-collapse: collapse; font-size: 12px; text-align: left;">
            <thead>
              <tr style="background: #0f172a; border-bottom: 1.5px solid var(--border-color); color: var(--text-secondary); text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; position: sticky; top: 0; z-index: 5;">
                <th style="padding: 8px 10px; width: 45px; text-align: center;">SL</th>
                <th style="padding: 8px 10px; width: 125px;">Urgency Status</th>
                <th style="padding: 8px 10px; width: 125px;">Machine Serial</th>
                <th style="padding: 8px 10px;">Machine Name / Model</th>
                <th style="padding: 8px 10px;">Location</th>
                <th style="padding: 8px 10px;">Last Service</th>
                <th style="padding: 8px 10px;">Next Target</th>
                <th style="padding: 8px 10px;">Frequency</th>
                <th style="padding: 8px 10px;">Assigned Manpower</th>
                <th style="padding: 8px 10px; text-align: center; width: 155px;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${upcomingMachines.length === 0 ? `
                <tr>
                  <td colspan="10" style="text-align: center; padding: 40px; color: var(--text-muted);">
                    No machines match the selected maintenance filter criteria.
                  </td>
                </tr>
              ` : pagedMachines.map((m, idx) => {
    const sl = String(startIndex + idx + 1).padStart(2, '0');
    return `
                <tr class="pm-table-row ${m.urgency.status === 'OVERDUE' ? 'row-overdue' : (m.urgency.status === 'DUE_TODAY' ? 'row-due-today' : '')}" style="border-bottom: 1px solid rgba(255,255,255,0.06); transition: background 0.15s;">
                  <td style="padding: 8px 10px; text-align: center; font-family: monospace; font-size: 11px; color: var(--text-muted);">${sl}</td>
                  <td style="padding: 8px 10px; white-space: nowrap;">
                    ${m.urgency.displayBadge}
                  </td>
                  <td style="padding: 8px 10px; font-weight: 700;">
                    <a href="javascript:void(0)" class="pm-link-machine machine-serial-link" data-serial="${escapeHtml(m.serialNumber)}" title="View Machine Profile">
                      ${escapeHtml(m.serialNumber)}
                    </a>
                  </td>
                  <td style="padding: 8px 10px;">
                    <div style="font-weight: 700; color: #fff;">${escapeHtml(m.machineName)}</div>
                    <div style="font-size: 11px; color: var(--text-secondary);">${escapeHtml(m.brand)} ${escapeHtml(m.model)}</div>
                  </td>
                  <td style="padding: 8px 10px;">
                    <span class="badge" style="background: rgba(56, 189, 248, 0.1); color: #38bdf8; font-size: 10.5px; margin-right: 4px;">${escapeHtml(m.floor)}</span>
                    <span style="font-size: 11px; color: #cbd5e1;">${escapeHtml(m.line)}</span>
                  </td>
                  <td style="padding: 8px 10px; font-family: monospace; color: var(--text-secondary);">
                    ${m.lastServiceDate ? formatDisplayDate(m.lastServiceDate) : '<span style="color: #64748b;">Not Recorded</span>'}
                  </td>
                  <td style="padding: 8px 10px; font-family: monospace; font-weight: 700; color: ${m.urgency.status === 'OVERDUE' || m.urgency.status === 'DUE_TODAY' ? '#f87171' : '#38bdf8'};">
                    ${formatDisplayDate(m.nextServiceDate)}
                  </td>
                  <td style="padding: 8px 10px;">
                    <span style="font-size: 11px; background: #1e293b; color: #94a3b8; padding: 2px 6px; border-radius: 4px;">
                      ${escapeHtml(m.frequencyLabel)}
                    </span>
                  </td>
                  <td style="padding: 8px 10px;">
                    ${m.lastServiceDate && m.assignedManpower ? `
                      <div style="font-weight: 600; color: #fff;">${escapeHtml(m.assignedManpower)}</div>
                      <div style="font-size: 10.5px; color: var(--text-muted);">${escapeHtml(m.lastServicedBy ? 'Last: ' + m.lastServicedBy : '')}</div>
                    ` : `
                      <span style="color: #64748b; font-size: 11px; font-style: italic;">Not Assigned Yet</span>
                    `}
                  </td>
                  <td style="padding: 8px 10px; text-align: center; white-space: nowrap;">
                    <button class="btn btn-primary btn-sm btn-pm-service-now" data-machine-id="${m.machineId}" style="padding: 3px 8px; font-size: 11px; font-weight: 700; margin-right: 3px;">
                      ⚡ Service
                    </button>
                    <button class="btn btn-secondary btn-sm btn-pm-print-single-sticker" data-serial="${escapeHtml(m.serialNumber)}" title="Print Sticker" style="padding: 3px 6px; font-size: 11px; margin-right: 3px;">
                      🏷️
                    </button>
                    <button class="btn btn-secondary btn-sm btn-pm-view-profile" data-serial="${escapeHtml(m.serialNumber)}" title="View Profile" style="padding: 3px 6px; font-size: 11px; margin-right: 3px;">
                      👁️
                    </button>
                    <button class="btn btn-secondary btn-sm btn-pm-replace-sticker" data-serial="${escapeHtml(m.serialNumber)}" title="Replace Physical Sticker (Sl No.)" style="padding: 3px 6px; font-size: 11px; color: #38bdf8;">
                      🔄
                    </button>
                  </td>
                </tr>
                `;
  }).join('')}
            </tbody>
          </table>
        </div>

        ${renderPaginationBar(total, curPage, pmPageSize, 'schedules')}
      </div>

    </div>
  `;
}

// -------------------------------------------------------------------------
// TAB 2: RECENTLY SERVICED (LATEST SERVICE FIRST)
// -------------------------------------------------------------------------
function renderRecentlyServicedTab() {
  const records = preventiveMaintenanceService.getRecentlyServiced({
    search: searchQuery,
    floorId: filterFloorId,
    lineId: filterLineId,
    machineType: filterMachineType,
    startDate: filterDateFrom,
    endDate: filterDateTo,
    servicedBy: filterServicedBy
  }, 1000);

  const total = records.length;
  const isAll = pmPageSize === 'ALL';
  const limit = isAll ? total : parseInt(pmPageSize, 10);
  const totalPages = Math.max(1, isAll ? 1 : Math.ceil(total / limit));
  const curPage = Math.min(pmCurrentPage, totalPages);
  const startIndex = (curPage - 1) * limit;
  const pagedRecords = isAll ? records : records.slice(startIndex, startIndex + limit);

  return `
    <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-sm);">
      <div style="padding: 10px 14px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; background: rgba(255,255,255,0.015);">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 14px;">🕒</span>
          <strong style="font-size: 13px; color: #fff;">Recently Serviced Machines</strong>
          <span style="font-size: 11px; color: var(--text-muted);">&bull; Chronological audit log (Latest Service &rarr; First)</span>
        </div>
        <span style="font-size: 12px; color: var(--text-muted); font-weight: 600;">
          Total: <strong style="color: #34d399;">${total}</strong> Completed Records
        </span>
      </div>

      <div class="table-responsive" style="max-height: calc(100vh - 280px); overflow-y: auto; overflow-x: auto; width: 100%;">
        <table class="pm-table" style="width: 100%; min-width: 950px; border-collapse: collapse; font-size: 12px; text-align: left;">
          <thead>
            <tr style="background: #0f172a; border-bottom: 1.5px solid var(--border-color); color: var(--text-secondary); text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; position: sticky; top: 0; z-index: 5;">
              <th style="padding: 8px 10px; width: 45px; text-align: center;">SL</th>
              <th style="padding: 8px 10px; width: 110px;">Service Date</th>
              <th style="padding: 8px 10px; width: 125px;">Machine Serial</th>
              <th style="padding: 8px 10px;">Machine Details</th>
              <th style="padding: 8px 10px;">Location</th>
              <th style="padding: 8px 10px;">Serviced By (Card #)</th>
              <th style="padding: 8px 10px;">Sticker Serial</th>
              <th style="padding: 8px 10px;">Next Target</th>
              <th style="padding: 8px 10px;">Remarks &amp; Parts</th>
              <th style="padding: 8px 10px; text-align: center; width: 130px;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${records.length === 0 ? `
              <tr>
                <td colspan="10" style="text-align: center; padding: 40px; color: var(--text-muted);">
                  No recent servicing records found matching the criteria.
                </td>
              </tr>
            ` : pagedRecords.map((r, idx) => {
    const sl = String(startIndex + idx + 1).padStart(2, '0');
    return `
              <tr class="pm-table-row" style="border-bottom: 1px solid rgba(255,255,255,0.06);">
                <td style="padding: 8px 10px; text-align: center; font-family: monospace; font-size: 11px; color: var(--text-muted);">${sl}</td>
                <td style="padding: 8px 10px; font-family: monospace; font-weight: 700; color: #10b981; white-space: nowrap;">
                  📅 ${formatDisplayDate(r.serviceDate)}
                </td>
                <td style="padding: 8px 10px; font-weight: 700;">
                  <a href="javascript:void(0)" class="pm-link-machine machine-serial-link" data-serial="${escapeHtml(r.serialNumber)}" title="View Machine Profile">
                    ${escapeHtml(r.serialNumber)}
                  </a>
                </td>
                <td style="padding: 8px 10px;">
                  <div style="font-weight: 700; color: #fff;">${escapeHtml(r.machineName)}</div>
                  <div style="font-size: 11px; color: var(--text-secondary);">${escapeHtml(r.brand)} ${escapeHtml(r.model)}</div>
                </td>
                <td style="padding: 8px 10px;">
                  <span class="badge" style="background: rgba(56, 189, 248, 0.1); color: #38bdf8; font-size: 10.5px; margin-right: 4px;">${escapeHtml(r.floor)}</span>
                  <span style="font-size: 11px; color: #cbd5e1;">${escapeHtml(r.line)}</span>
                </td>
                <td style="padding: 8px 10px;">
                  <div style="font-weight: 700; color: #fff;">${escapeHtml(r.servicedBy)}</div>
                  <div style="font-size: 10.5px; color: #38bdf8; font-family: monospace;">Card: ${escapeHtml(r.servicedByCardNumber || 'N/A')} &bull; ${escapeHtml(r.servicedByDesignation || '')}</div>
                </td>
                <td style="padding: 8px 10px; white-space: nowrap;">
                  <span class="badge" style="background: rgba(168, 85, 247, 0.15); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.3); font-family: monospace; font-weight: 700; font-size: 11px; padding: 2px 7px;">
                    🏷️ ${escapeHtml(r.serviceStickerSerial || 'N/A')}
                  </span>
                </td>
                <td style="padding: 8px 10px; font-family: monospace; font-weight: 700; color: #38bdf8; white-space: nowrap;">
                  ${r.nextServiceDate ? formatDisplayDate(r.nextServiceDate) : 'N/A'}
                </td>
                <td style="padding: 8px 10px; max-width: 190px;">
                  <div style="font-size: 11.5px; color: #cbd5e1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(r.serviceRemarks)}">
                    ${escapeHtml(r.serviceRemarks || 'Routine maintenance completed')}
                  </div>
                  ${r.partsReplaced ? `
                    <div style="font-size: 10.5px; color: #f59e0b; margin-top: 2px;">
                      ⚙️ ${escapeHtml(r.partsReplaced)}
                    </div>
                  ` : ''}
                </td>
                <td style="padding: 8px 10px; text-align: center; white-space: nowrap;">
                  <button class="btn btn-secondary btn-sm btn-pm-edit-sticker" data-record-id="${r.id}" data-current-sticker="${escapeHtml(r.serviceStickerSerial || '')}" title="Edit Sticker Serial" style="padding: 3px 6px; font-size: 11px; margin-right: 3px;">
                    ✏️ Sticker
                  </button>
                  <button class="btn btn-secondary btn-sm btn-pm-print-single-sticker" data-serial="${escapeHtml(r.serialNumber)}" title="Print Sticker" style="padding: 3px 6px; font-size: 11px; margin-right: 3px;">
                    🏷️
                  </button>
                  <button class="btn btn-secondary btn-sm btn-pm-view-profile" data-serial="${escapeHtml(r.serialNumber)}" title="View Profile" style="padding: 3px 6px; font-size: 11px;">
                    👁️
                  </button>
                </td>
              </tr>
              `;
  }).join('')}
          </tbody>
        </table>
      </div>

      ${renderPaginationBar(total, curPage, pmPageSize, 'completed records')}
    </div>
  `;
}

// -------------------------------------------------------------------------
// TAB 3: MACHINE MAINTENANCE PROFILE (AUTO-FILLED SPECIFICATION)
// -------------------------------------------------------------------------
function renderMachineProfileTab() {
  const targetId = selectedMachineId || getValidActiveMachineId();
  const profile = targetId ? preventiveMaintenanceService.getMachinePreventiveProfile(targetId) : null;
  if (profile) {
    selectedMachineId = profile.machineId;
  }

  if (!profile) {
    return `
      <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 40px; text-align: center;">
        <div style="font-size: 40px; margin-bottom: 12px;">🔍</div>
        <h3 style="color: #fff; font-size: 17px; font-weight: 700;">No Machine Selected</h3>
        <p style="color: var(--text-secondary); font-size: 13px; max-width: 440px; margin: 6px auto 18px auto;">
          Use the Universal Search bar above or enter a Machine Serial Number to automatically load the complete Preventive Maintenance Profile.
        </p>
        <button id="btn-pm-pick-first-machine" class="btn btn-primary btn-sm">
          Load First Available Machine
        </button>
      </div>
    `;
  }

  const qrSvg = barcodeService.generateQRCodeSVG(`AL-MUSLIM-ERP://MC/${profile.serialNumber}`, { size: 100 });
  const barcodeSvg = barcodeService.generateBarcodeSVG(profile.serialNumber, { width: 1.8, height: 35 });

  return `
    <div class="pm-profile-grid">
      
      <!-- LEFT COLUMN: LIVE AUTO-SYNCED MACHINE SPECS -->
      <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 16px; box-shadow: var(--shadow-sm); width: 100%;">
        
        <!-- Header with QR Code -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; border-bottom: 1px solid var(--border-color); padding-bottom: 16px;">
          <div>
            <div style="font-size: 11px; font-weight: 800; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.5px;">
              Machine Inventory Sync
            </div>
            <div style="font-size: 20px; font-weight: 800; color: #fff; margin-top: 2px;">
              ${escapeHtml(profile.serialNumber)}
            </div>
            <div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">
              ${escapeHtml(profile.machineName)}
            </div>
          </div>
          <div style="background: #fff; padding: 6px; border-radius: 6px; border: 1px solid #cbd5e1;">
            ${qrSvg}
          </div>
        </div>

        <!-- Specifications Table -->
        <div style="display: flex; flex-direction: column; gap: 10px; font-size: 12.5px;">
          
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 6px;">
            <span style="color: var(--text-secondary);">Model:</span>
            <span style="font-weight: 700; color: #fff;">${escapeHtml(profile.model)}</span>
          </div>

          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 6px;">
            <span style="color: var(--text-secondary);">Brand:</span>
            <span style="font-weight: 700; color: #fff;">${escapeHtml(profile.brand)}</span>
          </div>

          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 6px;">
            <span style="color: var(--text-secondary);">Machine Type:</span>
            <span style="font-weight: 700; color: #38bdf8;">${escapeHtml(profile.machineType)}</span>
          </div>

          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 6px;">
            <span style="color: var(--text-secondary);">Unit / Factory:</span>
            <span style="font-weight: 600; color: #fff; text-align: right; max-width: 180px;">${escapeHtml(profile.unit)}</span>
          </div>

          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 6px;">
            <span style="color: var(--text-secondary);">Floor:</span>
            <span style="font-weight: 700; color: #38bdf8;">${escapeHtml(profile.floor)}</span>
          </div>

          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 6px;">
            <span style="color: var(--text-secondary);">Line:</span>
            <span style="font-weight: 700; color: #fff;">${escapeHtml(profile.line)}</span>
          </div>

          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 6px;">
            <span style="color: var(--text-secondary);">Working Area:</span>
            <span style="font-weight: 600; color: #cbd5e1; text-align: right; max-width: 180px;">${escapeHtml(profile.workingArea)}</span>
          </div>

          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 6px;">
            <span style="color: var(--text-secondary);">Machine Status:</span>
            <span class="badge ${profile.machineStatus === 'ACTIVE' ? 'badge-active' : 'badge-warning'}">${escapeHtml(profile.machineStatus)}</span>
          </div>

        </div>

        <!-- Barcode display -->
        <div style="margin-top: 18px; text-align: center; background: #0f172a; padding: 10px; border-radius: 6px; border: 1px solid #334155;">
          ${barcodeSvg}
        </div>

        <!-- Action buttons on profile card -->
        <div style="margin-top: 18px; display: flex; flex-direction: column; gap: 8px;">
          <button class="btn btn-primary btn-sm btn-pm-service-now" data-machine-id="${profile.machineId}" style="width: 100%; font-weight: 700;">
            ⚡ Record New Service Entry
          </button>
          <button class="btn btn-secondary btn-sm btn-pm-replace-sticker" data-serial="${escapeHtml(profile.serialNumber)}" style="width: 100%; background: #0f766e; border-color: #14b8a6; color: #fff; font-weight: 700;">
            🔄 Replace Physical Sticker (Sl No.)
          </button>
          <button class="btn btn-secondary btn-sm btn-pm-print-single-sticker" data-serial="${escapeHtml(profile.serialNumber)}" style="width: 100%;">
            🏷️ Print Physical Service Sticker
          </button>
        </div>

      </div>

      <!-- RIGHT COLUMN: MAINTENANCE PROFILE, URGENCY & COMPLETE SERVICE HISTORY -->
      <div style="display: flex; flex-direction: column; gap: 16px; min-width: 0; width: 100%;">
        
        <!-- MAINTENANCE SUMMARY CARD -->
        <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 16px 20px; box-shadow: var(--shadow-sm);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;">
            <h3 style="font-size: 15px; font-weight: 800; color: #fff; margin: 0; display: flex; align-items: center; gap: 8px;">
              <span>🛠️</span> Preventive Servicing Intelligence
            </h3>
            <div>${profile.urgency.displayBadge}</div>
          </div>

          <div class="pm-intel-grid">
            
            <div style="background: #0f172a; border: 1px solid #334155; border-radius: 6px; padding: 12px;">
              <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase;">Last Service Date</div>
              <div style="font-size: 16px; font-weight: 800; color: #fff; margin-top: 4px; font-family: monospace;">
                ${profile.lastServiceDate ? formatDisplayDate(profile.lastServiceDate) : '<span style="color: #64748b;">Never</span>'}
              </div>
              <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
                By: ${escapeHtml(profile.lastServicedBy || 'N/A')}
              </div>
            </div>

            <div style="background: #0f172a; border: 1px solid #334155; border-radius: 6px; padding: 12px;">
              <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase;">Next Service Target</div>
              <div style="font-size: 16px; font-weight: 800; color: ${profile.urgency.status === 'OVERDUE' || profile.urgency.status === 'DUE_TODAY' ? '#f87171' : '#38bdf8'}; margin-top: 4px; font-family: monospace;">
                ${profile.nextServiceDate ? formatDisplayDate(profile.nextServiceDate) : 'N/A'}
              </div>
              <div style="font-size: 11px; color: #38bdf8; margin-top: 2px;">
                ${escapeHtml(profile.urgency.label)}
              </div>
            </div>

            <div style="background: #0f172a; border: 1px solid #334155; border-radius: 6px; padding: 12px;">
              <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase;">Service Frequency</div>
              <div style="font-size: 16px; font-weight: 800; color: #fff; margin-top: 4px;">
                ${escapeHtml(profile.frequencyLabel)}
              </div>
              <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
                Configured Interval
              </div>
            </div>

            <div style="background: #0f172a; border: 1px solid #334155; border-radius: 6px; padding: 12px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase;">Service Sticker Serial</div>
                <div style="font-size: 15px; font-weight: 800; color: #c084fc; margin-top: 4px; font-family: monospace;">
                  🏷️ ${escapeHtml(profile.serviceStickerSerial || 'N/A')}
                </div>
                <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
                  Company Tagged Sl No.
                </div>
              </div>
              <button class="btn btn-sm btn-pm-replace-sticker" data-serial="${escapeHtml(profile.serialNumber)}" title="Replace Sticker Serial Number" style="background: rgba(192, 132, 252, 0.15); border: 1px solid rgba(192, 132, 252, 0.4); color: #c084fc; font-size: 11px; font-weight: 700; padding: 4px 8px; border-radius: 5px; cursor: pointer;">
                🔄 Replace
              </button>
            </div>

          </div>

          <!-- ASSIGNED MANPOWER ROW -->
          <div style="background: rgba(56, 189, 248, 0.08); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 6px; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 20px;">👨‍🔧</span>
              <div>
                <div style="font-size: 11px; color: #38bdf8; font-weight: 700; text-transform: uppercase;">Serviced By / Assigned Mechanic:</div>
                <div style="font-size: 14px; font-weight: 800; color: #fff; margin-top: 2px;">
                  ${profile.lastServiceDate && profile.assignedManpower ? `
                    ${escapeHtml(profile.assignedManpower)}
                    ${profile.lastServicedByCardNumber ? `<span style="color: #38bdf8; font-size: 12px; font-family: monospace; margin-left: 6px;">(Card: ${escapeHtml(profile.lastServicedByCardNumber)})</span>` : ''}
                    ${profile.lastServicedByDesignation ? `<span style="color: #94a3b8; font-size: 11.5px; font-weight: 500; margin-left: 6px;">&bull; ${escapeHtml(profile.lastServicedByDesignation)}</span>` : ''}
                  ` : `
                    <span style="color: #94a3b8; font-size: 13px; font-weight: 500; font-style: italic;">
                      Not Assigned Yet (Technician assigns during servicing)
                    </span>
                  `}
                </div>
              </div>
            </div>
            <div style="font-size: 12px; color: var(--text-secondary);">
              Department: <strong>Mechanical Maintenance</strong>
            </div>
          </div>

        </div>

        <!-- COMPLETE SERVICE HISTORY TABLE -->
        <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-sm);">
          <div style="padding: 14px 20px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
            <h4 style="font-size: 14px; font-weight: 800; color: #fff; margin: 0; display: flex; align-items: center; gap: 8px;">
              <span>📜</span> Complete Maintenance History (${profile.history.length} Records)
            </h4>
            <span style="font-size: 11.5px; color: var(--text-secondary);">
              Machine: <strong>${escapeHtml(profile.serialNumber)}</strong>
            </span>
          </div>

          <div class="table-responsive" style="max-height: 380px; overflow-y: auto; overflow-x: auto; width: 100%;">
            <table class="pm-table" style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;">
              <thead>
                <tr style="background: #0f172a; border-bottom: 1.5px solid var(--border-color); color: var(--text-secondary); text-transform: uppercase; font-size: 11px; position: sticky; top: 0; z-index: 5;">
                  <th style="padding: 8px 10px; width: 45px; text-align: center;">SL</th>
                  <th style="padding: 8px 10px; width: 95px; white-space: nowrap;">Date</th>
                  <th style="padding: 8px 10px; width: 130px;">Service Type</th>
                  <th style="padding: 8px 10px; width: 150px;">Serviced By</th>
                  <th style="padding: 8px 10px; width: 100px; white-space: nowrap;">Next Target</th>
                  <th style="padding: 8px 10px; width: 110px; white-space: nowrap;">Sticker Serial</th>
                  <th style="padding: 8px 10px;">Checklist &amp; Remarks</th>
                  <th style="padding: 8px 10px; text-align: center; width: 60px;">Action</th>
                </tr>
              </thead>
              <tbody>
                ${profile.history.length === 0 ? `
                  <tr>
                    <td colspan="8" style="text-align: center; padding: 30px; color: var(--text-muted);">
                      No historical servicing entries recorded yet for this machine.
                    </td>
                  </tr>
                ` : profile.history.map((h, idx) => {
    const sl = String(idx + 1).padStart(2, '0');
    return `
                  <tr class="pm-table-row" style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <td style="padding: 8px 10px; text-align: center; font-family: monospace; font-size: 11px; color: var(--text-muted);">${sl}</td>
                    <td style="padding: 8px 10px; font-family: monospace; font-weight: 700; color: #10b981;">
                      ${formatDisplayDate(h.serviceDate)}
                    </td>
                    <td style="padding: 8px 10px; font-weight: 700; color: #fff;">
                      ${escapeHtml(h.serviceType || 'Preventive Service')}
                    </td>
                    <td style="padding: 8px 10px;">
                      <div style="font-weight: 700; color: #fff;">${escapeHtml(h.servicedBy)}</div>
                      <div style="font-size: 10.5px; color: var(--text-muted); font-family: monospace;">Card: ${escapeHtml(h.servicedByCardNumber || 'N/A')}</div>
                    </td>
                    <td style="padding: 8px 10px; font-family: monospace; color: #38bdf8; font-weight: 700;">
                      ${formatDisplayDate(h.nextServiceDate)}
                    </td>
                    <td style="padding: 8px 10px; font-family: monospace; color: #c084fc;">
                      ${escapeHtml(h.serviceStickerSerial || 'N/A')}
                    </td>
                    <td style="padding: 8px 10px; max-width: 220px;">
                      <div style="font-size: 11.5px; color: #cbd5e1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(h.serviceRemarks)}">
                        ${escapeHtml(h.serviceRemarks || 'Routine maintenance check')}
                      </div>
                      ${h.partsReplaced ? `
                        <div style="font-size: 11px; color: #f59e0b;">⚙️ ${escapeHtml(h.partsReplaced)}</div>
                      ` : ''}
                    </td>
                    <td style="padding: 8px 10px; text-align: center;">
                      <button class="btn btn-secondary btn-sm btn-pm-edit-sticker" data-record-id="${h.id}" data-current-sticker="${escapeHtml(h.serviceStickerSerial || '')}" title="Edit Sticker" style="padding: 3px 6px; font-size: 10.5px;">
                        ✏️
                      </button>
                    </td>
                  </tr>
                  `;
  }).join('')}
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>
  `;
}

// -------------------------------------------------------------------------
// -------------------------------------------------------------------------
// TAB 4: MASTER SCHEDULE LIST
// -------------------------------------------------------------------------
function renderMasterScheduleTab() {
  const machines = preventiveMaintenanceService.getAllMachinesWithMaintenance({
    search: searchQuery,
    floorId: filterFloorId,
    lineId: filterLineId,
    machineType: filterMachineType,
    urgencyStatus: filterUrgency
  });

  const total = machines.length;
  const isAll = pmPageSize === 'ALL';
  const limit = isAll ? total : parseInt(pmPageSize, 10);
  const totalPages = Math.max(1, isAll ? 1 : Math.ceil(total / limit));
  const curPage = Math.min(pmCurrentPage, totalPages);
  const startIndex = (curPage - 1) * limit;
  const pagedMachines = isAll ? machines : machines.slice(startIndex, startIndex + limit);

  return `
    <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-sm);">
      <div style="padding: 10px 14px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; background: rgba(255,255,255,0.015);">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 14px;">📅</span>
          <strong style="font-size: 13px; color: #fff;">Plant-Wide Master Maintenance Schedules</strong>
          <span style="font-size: 11px; color: var(--text-muted);">&bull; Comprehensive schedule registry across all machines</span>
        </div>
        <span style="font-size: 12px; color: var(--text-muted); font-weight: 600;">
          Total: <strong style="color: #38bdf8;">${total}</strong> Machines Active
        </span>
      </div>

      <div class="table-responsive" style="max-height: calc(100vh - 280px); overflow-y: auto; overflow-x: auto; width: 100%;">
        <table class="pm-table" style="width: 100%; min-width: 960px; border-collapse: collapse; font-size: 12px; text-align: left;">
          <thead>
            <tr style="background: #0f172a; border-bottom: 1.5px solid var(--border-color); color: var(--text-secondary); text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; position: sticky; top: 0; z-index: 5;">
              <th style="padding: 8px 10px; width: 45px; text-align: center;">SL</th>
              <th style="padding: 8px 10px; width: 125px;">Status</th>
              <th style="padding: 8px 10px; width: 125px;">Serial</th>
              <th style="padding: 8px 10px;">Machine Type / Name</th>
              <th style="padding: 8px 10px;">Brand &amp; Model</th>
              <th style="padding: 8px 10px;">Location</th>
              <th style="padding: 8px 10px;">Last Serviced</th>
              <th style="padding: 8px 10px;">Next Target</th>
              <th style="padding: 8px 10px;">Sticker Serial</th>
              <th style="padding: 8px 10px;">Assigned Manpower</th>
              <th style="padding: 8px 10px; text-align: center; width: 130px;">Action</th>
            </tr>
          </thead>
          <tbody>
            ${pagedMachines.map((m, idx) => {
    const sl = String(startIndex + idx + 1).padStart(2, '0');
    return `
              <tr class="pm-table-row" style="border-bottom: 1px solid rgba(255,255,255,0.06);">
                <td style="padding: 8px 10px; text-align: center; font-family: monospace; font-size: 11px; color: var(--text-muted);">${sl}</td>
                <td style="padding: 8px 10px; white-space: nowrap;">
                  ${m.urgency.displayBadge}
                </td>
                <td style="padding: 8px 10px; font-weight: 700;">
                  <a href="javascript:void(0)" class="pm-link-machine machine-serial-link" data-serial="${escapeHtml(m.serialNumber)}" title="View Machine Profile">
                    ${escapeHtml(m.serialNumber)}
                  </a>
                </td>
                <td style="padding: 8px 10px;">
                  <div style="font-weight: 700; color: #fff;">${escapeHtml(m.machineType)}</div>
                  <div style="font-size: 11px; color: var(--text-secondary);">${escapeHtml(m.machineName)}</div>
                </td>
                <td style="padding: 8px 10px;">
                  <div style="font-weight: 600; color: #fff;">${escapeHtml(m.brand)}</div>
                  <div style="font-size: 11px; color: var(--text-muted);">${escapeHtml(m.model)}</div>
                </td>
                <td style="padding: 8px 10px;">
                  <span class="badge" style="background: rgba(56, 189, 248, 0.1); color: #38bdf8; font-size: 10.5px;">${escapeHtml(m.floor)}</span>
                  <span style="font-size: 11px; color: #cbd5e1;">${escapeHtml(m.line)}</span>
                </td>
                <td style="padding: 8px 10px; font-family: monospace; color: var(--text-secondary);">
                  ${m.lastServiceDate ? formatDisplayDate(m.lastServiceDate) : 'None'}
                </td>
                <td style="padding: 8px 10px; font-family: monospace; font-weight: 700; color: ${m.urgency.status === 'OVERDUE' || m.urgency.status === 'DUE_TODAY' ? '#f87171' : '#38bdf8'};">
                  ${formatDisplayDate(m.nextServiceDate)}
                </td>
                <td style="padding: 8px 10px; font-family: monospace; color: #c084fc;">
                  ${escapeHtml(m.serviceStickerSerial || 'N/A')}
                </td>
                <td style="padding: 8px 10px;">
                  ${m.lastServiceDate && m.assignedManpower ? `
                    <div style="font-weight: 700; color: #fff;">${escapeHtml(m.assignedManpower)}</div>
                  ` : `
                    <span style="color: #64748b; font-size: 11px; font-style: italic;">Not Assigned Yet</span>
                  `}
                </td>
                <td style="padding: 8px 10px; text-align: center; white-space: nowrap;">
                  <button class="btn btn-primary btn-sm btn-pm-service-now" data-machine-id="${m.machineId}" style="padding: 3px 8px; font-size: 11px; font-weight: 700; margin-right: 3px;">
                    ⚡ Service
                  </button>
                  <button class="btn btn-secondary btn-sm btn-pm-view-profile" data-serial="${escapeHtml(m.serialNumber)}" title="Profile" style="padding: 3px 6px; font-size: 11px; margin-right: 3px;">
                    👁️
                  </button>
                  <button class="btn btn-secondary btn-sm btn-pm-replace-sticker" data-serial="${escapeHtml(m.serialNumber)}" title="Replace Physical Sticker (Sl No.)" style="padding: 3px 6px; font-size: 11px; color: #38bdf8;">
                    🔄
                  </button>
                </td>
              </tr>
              `;
  }).join('')}
          </tbody>
        </table>
      </div>

      ${renderPaginationBar(total, curPage, pmPageSize, 'machines')}
    </div>
  `;
}

// -------------------------------------------------------------------------
// TAB 5: ADMIN CONFIGURATION (MACHINE TYPE INTERVALS & CHECKLISTS)
// -------------------------------------------------------------------------
function renderAdminConfigTab() {
  let configs = preventiveMaintenanceService.getConfigs();

  if (configSearchQuery) {
    const q = configSearchQuery.toLowerCase().trim();
    configs = configs.filter(c =>
      c.machineType.toLowerCase().includes(q) ||
      (c.aliases && c.aliases.some(a => a.toLowerCase().includes(q))) ||
      (c.responsibleDepartment || '').toLowerCase().includes(q)
    );
  }

  return `
    <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-sm);">
      <div style="padding: 10px 14px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; background: rgba(255,255,255,0.015);">
        <div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <h3 style="font-size: 14px; font-weight: 800; color: #fff; margin: 0; display: flex; align-items: center; gap: 6px;">
              <span>⚙️</span> Machine Type Maintenance Configuration
            </h3>
            <span style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); font-size: 10.5px; font-weight: 700; padding: 2px 7px; border-radius: 12px;">
              Auto-Synced (Zero Duplicates)
            </span>
          </div>
          <p style="font-size: 11.5px; color: var(--text-secondary); margin: 3px 0 0 0;">
            All machine types from <strong>Master Data Storage (MACHINE_NAMES &amp; Inventory)</strong> are automatically consolidated.
          </p>
        </div>

        <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
          <input 
            type="text" 
            id="pm-config-search-input" 
            value="${escapeHtml(configSearchQuery)}" 
            placeholder="Filter machine type / aliases..." 
            style="padding: 4px 10px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 6px; color: #fff; font-size: 12px; width: 190px; height: 30px;" 
          />
          <button id="btn-pm-download-config-template" class="btn btn-secondary btn-sm" style="display: flex; align-items: center; gap: 5px; font-weight: 700; height: 30px; font-size: 11.5px; background: #0f172a; border-color: #38bdf8; color: #38bdf8;" title="Download Excel template with all 76 machine types and current intervals">
            <span>📥</span> Download Template (.xlsx)
          </button>
          <button id="btn-pm-open-bulk-excel-import" class="btn btn-primary btn-sm" style="display: flex; align-items: center; gap: 5px; font-weight: 700; height: 30px; font-size: 11.5px; background: linear-gradient(135deg, #0284c7, #0369a1); box-shadow: 0 0 10px rgba(2, 132, 199, 0.3);" title="Bulk import machine maintenance frequency (days) from Excel">
            <span>📊</span> Bulk Import (Excel)
          </button>
          <button id="btn-pm-sync-master-data" class="btn btn-secondary btn-sm" style="display: flex; align-items: center; gap: 5px; font-weight: 700; background: #1e293b; border-color: #10b981; color: #34d399; height: 30px; font-size: 11.5px;">
            <span>🔄</span> Sync Master Data
          </button>
          <button id="btn-pm-add-new-config" class="btn btn-secondary btn-sm" style="font-weight: 700; height: 30px; font-size: 11.5px;">
            ➕ Add Schedule
          </button>
        </div>
      </div>

      <div class="table-responsive" style="max-height: calc(100vh - 280px); overflow-y: auto; overflow-x: auto; width: 100%;">
        <table class="pm-table" style="width: 100%; min-width: 850px; border-collapse: collapse; font-size: 12px; text-align: left;">
          <thead>
            <tr style="background: #0f172a; border-bottom: 1.5px solid var(--border-color); color: var(--text-secondary); text-transform: uppercase; font-size: 11px; position: sticky; top: 0; z-index: 5;">
              <th style="padding: 8px 10px; width: 45px; text-align: center;">SL</th>
              <th style="padding: 8px 10px;">Machine Type Name</th>
              <th style="padding: 8px 10px; text-align: center;">Factory Machines</th>
              <th style="padding: 8px 10px;">Maintenance Frequency</th>
              <th style="padding: 8px 10px;">Service Interval</th>
              <th style="padding: 8px 10px;">Responsible Department</th>
              <th style="padding: 8px 10px;">Checklist Items</th>
              <th style="padding: 8px 10px;">Status</th>
              <th style="padding: 8px 10px; text-align: center; width: 120px;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${configs.length === 0 ? `
              <tr>
                <td colspan="9" style="text-align: center; padding: 40px; color: var(--text-muted);">
                  No schedule configuration matches the search filter.
                </td>
              </tr>
            ` : configs.map((c, idx) => {
    const sl = String(idx + 1).padStart(2, '0');
    return `
              <tr class="pm-table-row" style="border-bottom: 1px solid rgba(255,255,255,0.06);">
                <td style="padding: 8px 10px; text-align: center; font-family: monospace; font-size: 11px; color: var(--text-muted);">${sl}</td>
                <td style="padding: 8px 10px;">
                  <div style="font-weight: 800; color: #fff;">${escapeHtml(c.machineType)}</div>
                  ${c.aliases && c.aliases.length > 0 ? `
                    <div style="font-size: 10.5px; color: var(--text-muted); margin-top: 1px;">
                      Aliases: ${escapeHtml(c.aliases.slice(0, 3).join(', '))}${c.aliases.length > 3 ? '...' : ''}
                    </div>
                  ` : ''}
                </td>
                <td style="padding: 8px 10px; text-align: center;">
                  <span class="badge" style="background: ${c.machineCount > 0 ? 'rgba(56, 189, 248, 0.15)' : '#1e293b'}; color: ${c.machineCount > 0 ? '#38bdf8' : '#94a3b8'}; font-weight: 700; font-size: 11.5px;">
                    ${c.machineCount || 0} Machines
                  </span>
                </td>
                <td style="padding: 8px 10px;">
                  <span class="badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; font-weight: 700; font-size: 11.5px;">
                    ${escapeHtml(c.frequencyLabel || c.frequencyDays + ' Days')}
                  </span>
                </td>
                <td style="padding: 8px 10px; font-weight: 700; font-family: monospace; color: #10b981;">
                  ${c.frequencyDays} Days
                </td>
                <td style="padding: 8px 10px; color: #cbd5e1;">
                  ${escapeHtml(c.responsibleDepartment || 'Mechanical Maintenance')}
                </td>
                <td style="padding: 8px 10px;">
                  <span style="font-size: 11px; background: #1e293b; color: #cbd5e1; padding: 2px 6px; border-radius: 4px;">
                    📋 ${(c.checklist || []).length} Items
                  </span>
                </td>
                <td style="padding: 8px 10px;">
                  <span class="badge ${c.status === 'ACTIVE' ? 'badge-active' : 'badge-danger'}">
                    ${escapeHtml(c.status || 'ACTIVE')}
                  </span>
                </td>
                <td style="padding: 8px 10px; text-align: center; white-space: nowrap;">
                  <button class="btn btn-secondary btn-sm btn-pm-edit-config" data-config-id="${c.id}" style="padding: 3px 6px; font-size: 11px; margin-right: 3px;">
                    ✏️ Edit
                  </button>
                  <button class="btn btn-secondary btn-sm btn-pm-delete-config" data-config-id="${c.id}" style="padding: 3px 6px; font-size: 11px; color: #f87171;">
                    🗑️
                  </button>
                </td>
              </tr>
              `;
  }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// =========================================================================
// MODALS
// =========================================================================

function renderActivePmModal() {
  if (!activePmModal) return '';

  switch (activePmModal) {
    case 'service-entry':
      return renderServiceEntryModal();
    case 'qr-scanner':
      return renderQrScannerModal();
    case 'print-sticker':
      return renderPrintStickerModal();
    case 'edit-sticker':
    case 'replace-sticker':
      return renderReplaceStickerModal();
    case 'config-modal':
      return renderConfigModal();
    case 'bulk-excel-modal':
      return renderBulkExcelConfigModal();
    default:
      return '';
  }
}

/**
 * 1-Click Fast Service Entry Modal
 */
function renderServiceEntryModal() {
  const targetId = modalMachineContext;
  const profile = targetId ? preventiveMaintenanceService.getMachinePreventiveProfile(targetId) : null;

  const todayStr = new Date().toISOString().split('T')[0];
  const nextTargetDate = profile ? preventiveMaintenanceService.calculateNextServiceDate(todayStr, profile.frequencyDays) : '';
  const user = authService.getCurrentUser();
  const isAdmin = authService.isAdmin();

  const currentSticker = (profile && profile.serviceStickerSerial && profile.serviceStickerSerial !== 'STK-PENDING')
    ? profile.serviceStickerSerial
    : null;

  const checklistItems = profile
    ? ((profile.configChecklist && profile.configChecklist.length > 0)
      ? profile.configChecklist
      : [
        'Motor & Drive Belt Tension & Inspection',
        'Oil Level & High Speed Lubrication Circulation',
        'Needle Bar Height & Hook / Looper Timing Alignment',
        'Safety Guard & Eye Shield Intactness Check',
        'Dust, Lint Cleaning & Thread Waste Suction'
      ])
    : [];

  return `
    <div class="modal-backdrop" id="pm-service-entry-backdrop" style="position: fixed; inset: 0; background: rgba(0,0,0,0.75); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px;">
      <div class="modal-dialog" style="max-width: 720px; width: 100%; background: var(--bg-surface); border: 1.5px solid #3b82f6; border-radius: var(--radius-xl); box-shadow: 0 20px 40px rgba(0,0,0,0.8); display: flex; flex-direction: column; max-height: 90vh; overflow: hidden;">
        
        <!-- Modal Header -->
        <div style="padding: 16px 24px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; background: #0f172a;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 22px;">🛠️</span>
            <div>
              <h3 style="font-size: 16px; font-weight: 800; color: #fff; margin: 0;">
                ${profile ? `Preventive Service Entry — Machine ${escapeHtml(profile.serialNumber)}` : 'Preventive Service Entry'}
              </h3>
              <div style="font-size: 12px; color: #38bdf8;">
                ${profile
      ? `${escapeHtml(profile.machineName)} &bull; ${escapeHtml(profile.brand)} ${escapeHtml(profile.model)} (${escapeHtml(profile.floor)} - ${escapeHtml(profile.line)})`
      : '<span style="color: #94a3b8;">Search and select a machine below to record preventive service</span>'}
              </div>
            </div>
          </div>
          <button id="btn-pm-close-service-modal" style="background: none; border: none; color: #94a3b8; font-size: 20px; cursor: pointer;">✕</button>
        </div>

        <!-- Modal Form Body -->
        <div style="padding: 20px 24px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 16px;">
          
          <!-- 1. LIVE MACHINE SEARCH & SWITCHER -->
          <div style="background: #0f172a; border: 1.5px solid #38bdf8; border-radius: 8px; padding: 14px; position: relative;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; flex-wrap: wrap; gap: 4px;">
              <label style="font-size: 12px; font-weight: 800; color: #38bdf8; margin: 0; display: flex; align-items: center; gap: 6px;">
                <span>🔍</span> Select / Search Machine (Serial No., Model, Floor, Line) *
              </label>
              ${profile ? `
                <span class="badge badge-active" style="font-size: 11px; padding: 3px 8px; font-family: monospace;">
                  Active: ${escapeHtml(profile.serialNumber)}
                </span>
              ` : `
                <span class="badge" style="font-size: 11px; padding: 3px 8px; font-family: monospace; background: rgba(148, 163, 184, 0.15); color: #94a3b8; border: 1px solid rgba(148, 163, 184, 0.3);">
                  No Machine Selected
                </span>
              `}
            </div>
            <div style="position: relative;">
              <input 
                type="text" 
                id="pm-modal-machine-search" 
                value="${profile ? `${escapeHtml(profile.serialNumber)} — ${escapeHtml(profile.machineName)} (${escapeHtml(profile.brand)} ${escapeHtml(profile.model)} • ${escapeHtml(profile.floor)} / ${escapeHtml(profile.line)})` : ''}"
                placeholder="Search & select machine (Type Serial e.g. 5369, SL-1130, JA-01, Model, Floor, Line)..." 
                autocomplete="off"
                style="width: 100%; padding: 10px ${profile ? '36px' : '14px'} 10px 14px; background: var(--bg-card); border: 1.5px solid #38bdf8; border-radius: 6px; color: #fff; font-size: 13.5px; font-weight: 700;" 
              />
              ${profile ? `
                <button type="button" id="btn-pm-clear-selected-machine" title="Clear / Switch Machine" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: #1e293b; border: 1px solid rgba(255,255,255,0.2); border-radius: 50%; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-size: 12px; cursor: pointer; line-height: 1;">✕</button>
              ` : ''}
              <div id="pm-modal-machine-dropdown" class="pm-suggestions-dropdown" style="display: none; position: absolute; left: 0; right: 0; top: 100%; max-height: 240px; overflow-y: auto; background: #0f172a; border: 1.5px solid #38bdf8; border-radius: 6px; z-index: 1200; box-shadow: 0 10px 30px rgba(0,0,0,0.8); margin-top: 4px;"></div>
            </div>
            <div style="font-size: 11px; color: #94a3b8; margin-top: 6px;">
              💡 Type any serial or click to select machine. All specifications, checklist &amp; intervals auto-sync instantly.
            </div>
          </div>

          <!-- Read-only Synced Info Banner -->
          <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 6px; padding: 10px 14px; font-size: 12px; color: #cbd5e1; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px;">
            <div>🏭 Plant: <strong>${profile ? escapeHtml(profile.unit) : '<span style="color: #94a3b8;">--</span>'}</strong> &bull; Location: <strong>${profile ? `${escapeHtml(profile.floor)} / ${escapeHtml(profile.line)}` : '<span style="color: #94a3b8;">--</span>'}</strong></div>
            <div>Frequency: ${profile ? `<span class="badge badge-active">${escapeHtml(profile.frequencyLabel)}</span>` : `<span class="badge" style="background: rgba(148, 163, 184, 0.15); color: #94a3b8;">Select Machine</span>`}</div>
          </div>

          <!-- Dates & Type Row -->
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
            <div>
              <label style="font-size: 11.5px; font-weight: 700; color: #cbd5e1; display: block; margin-bottom: 4px;">Service Date *</label>
              <input type="date" id="pm-input-service-date" value="${todayStr}" style="width: 100%; padding: 8px 10px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 6px; color: #fff; font-size: 13px;" />
            </div>

            <div>
              <label style="font-size: 11.5px; font-weight: 700; color: #cbd5e1; display: block; margin-bottom: 4px;">Service Type</label>
              <select id="pm-input-service-type" style="width: 100%; padding: 8px 10px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 6px; color: #fff; font-size: 13px;">
                <option value="PREVENTIVE_SERVICE">Preventive Servicing</option>
                <option value="ROUTINE_INSPECTION">Routine Inspection</option>
                <option value="OVERHAUL">Full Machine Overhaul</option>
                <option value="CALIBRATION">Calibration &amp; Timing</option>
                <option value="LUBRICATION">Oil Change &amp; Lubrication</option>
              </select>
            </div>

            <div>
              <label style="font-size: 11.5px; font-weight: 700; color: #cbd5e1; display: block; margin-bottom: 4px;">Next Service Target</label>
              <div style="position: relative;">
                <input 
                  type="date" 
                  id="pm-input-next-date" 
                  value="${nextTargetDate}" 
                  readonly 
                  disabled
                  title="${profile ? `Next servicing date is auto-generated by the system based on the Admin configured schedule interval (${profile.frequencyDays} days). Editing is disabled.` : 'Select a machine first to auto-calculate the next servicing date.'}" 
                  style="width: 100%; padding: 8px 32px 8px 10px; background: #0b1329; border: 1.5px solid #1e3a8a; border-radius: 6px; color: #38bdf8; font-weight: 800; font-size: 13px; cursor: not-allowed; opacity: 0.95;" 
                />
                <span title="System auto-generated from Admin Schedule Config. User cannot edit." style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); font-size: 14px; pointer-events: none;">🔒</span>
              </div>
              <div style="font-size: 10.5px; color: #38bdf8; margin-top: 3px; font-weight: 600;">
                ${profile ? `⚡ Auto: Admin Schedule Interval (+${profile.frequencyDays} Days)` : '<span style="color: #94a3b8;">⚡ Auto: Calculates automatically once machine is selected</span>'}
              </div>
            </div>
          </div>

          <!-- Company Physical Sticker Serial Number (Purely Manual Entry) -->
          <div style="background: #0f172a; border: 1.5px solid #38bdf8; border-radius: 8px; padding: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; flex-wrap: wrap; gap: 6px;">
              <label style="font-size: 12px; font-weight: 800; color: #38bdf8; margin: 0;">
                🏷️ Company Physical Sticker Sl No. (Manual Entry) *
              </label>
              ${currentSticker ? `
                <span style="font-size: 11px; color: #fbbf24; background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.3); padding: 2px 8px; border-radius: 4px;">
                  Current Tagged: <strong>${escapeHtml(currentSticker)}</strong>
                </span>
              ` : ''}
            </div>
            <div>
              <input 
                type="text" 
                id="pm-input-sticker-serial" 
                value="" 
                placeholder="e.g. 238168 or 245231 (Enter from physical sticker pad)..." 
                style="width: 100%; padding: 10px 14px; background: var(--bg-card); border: 1.5px solid #38bdf8; border-radius: 6px; color: #fff; font-family: monospace; font-weight: 800; font-size: 15px; letter-spacing: 1px;" 
              />
            </div>
            <div style="font-size: 11px; color: #94a3b8; margin-top: 6px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 4px;">
              <span>✍️ Type the 6-digit Sl No. from the physical sticker affixed to the machine body.</span>
              ${currentSticker ? `<span style="color: #fbbf24;">(Submitting will update existing sticker: ${escapeHtml(currentSticker)})</span>` : ''}
            </div>
          </div>

          <!-- USER/TECHNICIAN PART: TECHNICIAN WHO ACTUALLY PERFORMS SERVICE ENTERS NAME / CARD -->
          <div style="background: var(--bg-card); border: 1.5px solid #38bdf8; border-radius: 8px; padding: 14px; position: relative;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; flex-wrap: wrap; gap: 4px;">
              <label style="font-size: 12px; font-weight: 800; color: #38bdf8; margin: 0;">
                👨‍🔧 Serviced By / Assigned Technician (Name / Card No.) *
              </label>
              <span style="font-size: 11px; color: #94a3b8;">(Technician Part - Entered upon service completion)</span>
            </div>
            <div style="position: relative;">
              <input 
                type="text" 
                id="pm-input-manpower-search" 
                value="" 
                placeholder="Type technician name or card number (e.g. 1088 or Rahim)..." 
                autocomplete="off"
                style="width: 100%; padding: 10px 12px; background: #0f172a; border: 1.5px solid #38bdf8; border-radius: 6px; color: #fff; font-size: 13.5px;" 
              />
              <div id="pm-manpower-suggestions" class="pm-suggestions-dropdown" style="display: none; position: absolute; left: 0; right: 0; top: 100%; max-height: 220px; overflow-y: auto; background: #0f172a; border: 1.5px solid #38bdf8; border-radius: 6px; z-index: 1200; box-shadow: 0 10px 30px rgba(0,0,0,0.8); margin-top: 4px;"></div>
            </div>
            <!-- Hidden inputs for auto-filled details -->
            <input type="hidden" id="pm-manpower-name" value="" />
            <input type="hidden" id="pm-manpower-card" value="" />
            <input type="hidden" id="pm-manpower-designation" value="" />
            <input type="hidden" id="pm-manpower-dept" value="Mechanical Maintenance" />
            
            <div id="pm-manpower-auto-badge" style="margin-top: 8px; font-size: 11.5px; color: #cbd5e1; display: none; gap: 8px; flex-wrap: wrap; align-items: center;">
              <span class="badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8;">Card: <span id="pm-badge-card">-</span></span>
              <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #10b981;"><span id="pm-badge-desig">-</span></span>
              <span class="badge" style="background: #1e293b; color: #94a3b8;"><span id="pm-badge-dept">Mechanical Maintenance</span></span>
            </div>
            <div style="font-size: 11px; color: #94a3b8; margin-top: 6px;">
              💡 Technicians enter their own details when completing service. Mechanics are not pre-assigned by Admin.
            </div>
          </div>

          <!-- INTERACTIVE CHECKLIST (ADMIN CONTROLLED) -->
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; flex-wrap: wrap; gap: 6px;">
              <label style="font-size: 12px; font-weight: 800; color: #fff; margin: 0; display: flex; align-items: center; gap: 6px;">
                <span>📋 Standard Inspection Checklist (<span id="pm-checklist-count">${checklistItems.length}</span> Items)</span>
                ${isAdmin && profile ? `<span class="badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; font-size: 10px; font-weight: normal; padding: 2px 6px;">Admin Controlled</span>` : ''}
              </label>
              <div style="display: flex; gap: 6px; align-items: center;">
                ${isAdmin && profile ? `
                  <button type="button" id="btn-pm-add-checklist-toggle" class="btn btn-outline-primary btn-sm" style="padding: 2px 8px; font-size: 11px; border-color: #38bdf8; color: #38bdf8; font-weight: 700;" title="Admin: Add new inspection item for this machine type">
                    ➕ Add Item
                  </button>
                ` : ''}
                ${profile ? `
                  <button type="button" id="btn-pm-check-all" class="btn btn-secondary btn-sm" style="padding: 2px 8px; font-size: 11px;">
                    Check All OK
                  </button>
                ` : ''}
              </div>
            </div>

            <!-- Admin Inline Add Box -->
            ${isAdmin && profile ? `
              <div id="pm-add-checklist-inline" style="display: none; margin-bottom: 8px; padding: 8px 10px; background: #1e293b; border: 1.5px dashed #38bdf8; border-radius: 6px;">
                <div style="font-size: 11px; color: #38bdf8; font-weight: 700; margin-bottom: 4px;">➕ Add New Inspection Checklist Item:</div>
                <div style="display: flex; gap: 6px;">
                  <input type="text" id="pm-new-checklist-input" placeholder="Type new checklist item (e.g. Check Bobbin Thread Tension)..." style="flex: 1; padding: 6px 10px; background: #0f172a; border: 1px solid #38bdf8; border-radius: 4px; color: #fff; font-size: 12px;" />
                  <button type="button" id="btn-pm-confirm-add-checklist" class="btn btn-primary btn-sm" style="padding: 4px 10px; font-size: 11.5px; font-weight: 700;">Add</button>
                  <button type="button" id="btn-pm-cancel-add-checklist" class="btn btn-secondary btn-sm" style="padding: 4px 8px; font-size: 11.5px;">Cancel</button>
                </div>
              </div>
            ` : ''}
            
            <div id="pm-checklist-items-container" style="background: #0f172a; border: 1px solid var(--border-color); border-radius: 6px; padding: 6px 10px; max-height: 180px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px;">
              ${profile ? checklistItems.map((item, idx) => `
                <div class="pm-checklist-row" data-index="${idx}" style="display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 5px 8px; border-radius: 4px; background: rgba(255,255,255,0.02); transition: background 0.15s ease;">
                  <label class="pm-checklist-label" style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: #cbd5e1; cursor: pointer; flex: 1; margin: 0;">
                    <input type="checkbox" class="pm-checklist-item" data-item="${escapeHtml(item)}" checked style="width: 15px; height: 15px; accent-color: #10b981;" />
                    <span class="pm-checklist-item-text" data-index="${idx}">${escapeHtml(item)}</span>
                  </label>
                  ${isAdmin ? `
                    <div class="pm-admin-checklist-actions" style="display: flex; gap: 4px; align-items: center;">
                      <button type="button" class="btn-pm-edit-checklist" data-index="${idx}" title="Admin: Edit Checklist Item" style="background: none; border: none; color: #38bdf8; cursor: pointer; font-size: 12px; padding: 2px 4px; border-radius: 3px; line-height: 1;">
                        ✏️
                      </button>
                      <button type="button" class="btn-pm-del-checklist" data-index="${idx}" title="Admin: Remove Checklist Item" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 12px; padding: 2px 4px; border-radius: 3px; line-height: 1;">
                        🗑️
                      </button>
                    </div>
                  ` : ''}
                </div>
              `).join('') : `
                <div style="padding: 16px 12px; text-align: center; color: #94a3b8; font-size: 12.5px; font-style: italic;">
                  🔍 Please search and select a machine above to load its standard inspection checklist.
                </div>
              `}
            </div>
          </div>

          <!-- Parts Replaced -->
          <div>
            <label style="font-size: 11.5px; font-weight: 700; color: #cbd5e1; display: block; margin-bottom: 4px;">
              ⚙️ Spare Parts Replaced (Optional)
            </label>
            <input type="text" id="pm-input-parts-replaced" placeholder="e.g. Rotary Hook Retainer, Needle Plate (Single Needle), V-Belt..." style="width: 100%; padding: 8px 10px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 6px; color: #fff; font-size: 12.5px;" />
          </div>

          <!-- Service Remarks -->
          <div>
            <label style="font-size: 11.5px; font-weight: 700; color: #cbd5e1; display: block; margin-bottom: 4px;">
              📝 Service Remarks &amp; Technical Notes
            </label>
            <textarea id="pm-input-remarks" rows="2" placeholder="Inspection findings, oil viscosity, sound test, calibration notes..." style="width: 100%; padding: 8px 10px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 6px; color: #fff; font-size: 12.5px; resize: vertical;">Routine preventive maintenance executed successfully according to standard garment SOP.</textarea>
          </div>

        </div>

        <!-- Modal Footer -->
        <div style="padding: 14px 24px; border-top: 1px solid var(--border-color); background: #0f172a; display: flex; justify-content: flex-end; gap: 10px;">
          <button type="button" id="btn-pm-cancel-service" class="btn btn-secondary btn-sm" style="padding: 8px 16px;">
            Cancel
          </button>
          <button type="button" id="btn-pm-submit-service" class="btn btn-primary btn-sm" style="padding: 8px 22px; font-weight: 700;">
            💾 Complete &amp; Save Service Record
          </button>
        </div>

      </div>
    </div>
  `;
}

/**
 * QR Code Scanner Modal (Supports Camera Live Preview, Barcode Scanner Gun, Image File)
 */
function renderQrScannerModal() {
  return `
    <div class="modal-backdrop" id="pm-scanner-backdrop" style="position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px;">
      <div class="modal-dialog" style="max-width: 520px; width: 100%; background: var(--bg-surface); border: 1px solid #3b82f6; border-radius: var(--radius-xl); box-shadow: 0 20px 40px rgba(0,0,0,0.8); overflow: hidden;">
        
        <div style="padding: 16px 20px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; background: #0f172a;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 20px;">📷</span>
            <h3 style="font-size: 15px; font-weight: 800; color: #fff; margin: 0;">Scan Machine QR Code / Barcode</h3>
          </div>
          <button id="btn-pm-close-scanner" style="background: none; border: none; color: #94a3b8; font-size: 18px; cursor: pointer;">✕</button>
        </div>

        <div style="padding: 24px; text-align: center;">
          
          <!-- Scanner Input (Accepts physical barcode gun swipe) -->
          <div style="margin-bottom: 18px;">
            <label style="font-size: 12px; color: #38bdf8; font-weight: 700; display: block; margin-bottom: 6px;">
              Handheld Scanner Gun &bull; Or Type Machine Serial / QR Text
            </label>
            <div style="display: flex; gap: 8px;">
              <input type="text" id="pm-scanner-text-input" autofocus placeholder="Scan barcode or type JA-01, GB-05, etc." style="flex: 1; padding: 10px 14px; background: #0f172a; border: 1.5px solid #3b82f6; border-radius: 6px; color: #fff; font-size: 14px; font-weight: 700; text-align: center;" />
              <button id="btn-pm-scanner-submit" class="btn btn-primary btn-sm" style="font-weight: 700;">
                Open Profile
              </button>
            </div>
          </div>

          <!-- Video Camera Simulation / Viewport -->
          <div style="position: relative; width: 280px; height: 240px; margin: 0 auto; background: #000; border: 2px dashed #3b82f6; border-radius: 12px; display: flex; align-items: center; justify-content: center; overflow: hidden;">
            <video id="pm-qr-video" autoplay playsinline style="width: 100%; height: 100%; object-fit: cover; display: none;"></video>
            
            <div id="pm-scanner-placeholder" style="color: var(--text-secondary); padding: 16px;">
              <div style="font-size: 38px; margin-bottom: 8px;">📱</div>
              <div style="font-size: 13px; font-weight: 700; color: #fff;">Point Camera at Machine QR Sticker</div>
              <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">Click "Activate Camera" to start live optical scan</div>
            </div>

            <!-- Optical targeting grid overlay -->
            <div style="position: absolute; inset: 20px; border: 2px solid rgba(56, 189, 248, 0.6); border-radius: 8px; pointer-events: none; box-shadow: 0 0 0 1000px rgba(0,0,0,0.3);">
              <div style="position: absolute; top: 0; left: 0; right: 0; height: 2px; background: #38bdf8; animation: pmScanLine 2s infinite ease-in-out;"></div>
            </div>
          </div>

          <div style="margin-top: 18px; display: flex; justify-content: center; gap: 10px; flex-wrap: wrap;">
            <button id="btn-pm-start-camera" class="btn btn-secondary btn-sm" style="font-size: 12px;">
              🎥 Activate Camera
            </button>
            <label class="btn btn-secondary btn-sm" style="font-size: 12px; cursor: pointer; margin: 0;">
              📁 Upload QR Image
              <input type="file" id="pm-qr-file-input" accept="image/*" style="display: none;" />
            </label>
          </div>

        </div>

      </div>
    </div>
  `;
}

/**
 * Printable Industrial Service Sticker Modal
 * Accurately replicates the Al-Muslim Group Maintenance Department physical sticker card
 */
function renderPrintStickerModal() {
  const targetId = modalMachineContext || selectedMachineId || getValidActiveMachineId();
  const profile = targetId ? preventiveMaintenanceService.getMachinePreventiveProfile(targetId) : null;
  if (!profile) {
    return `
      <div class="modal-backdrop" id="pm-print-modal-backdrop" style="position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px;">
        <div class="modal-dialog" style="max-width: 500px; width: 100%; background: var(--bg-surface); border: 1.5px solid #ef4444; border-radius: var(--radius-xl); padding: 24px; text-align: center;">
          <h3 style="color: #fff; margin-bottom: 8px;">No Machine Available to Print</h3>
          <p style="color: var(--text-secondary); font-size: 13px; margin-bottom: 16px;">Please select or add a machine before printing maintenance stickers.</p>
          <button id="btn-pm-close-print" class="btn btn-secondary btn-sm">Close</button>
        </div>
      </div>
    `;
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const serviceDate = profile.lastServiceDate || todayStr;
  const nextServiceDate = profile.nextServiceDate || todayStr;
  const stickerSerial = profile.serviceStickerSerial && profile.serviceStickerSerial !== 'STK-PENDING'
    ? profile.serviceStickerSerial
    : '245231';

  const qrSvg = barcodeService.generateQRCodeSVG(`AL-MUSLIM-ERP://MC/${profile.serialNumber}`, { size: 72 });

  return `
    <div class="modal-backdrop" id="pm-print-modal-backdrop" style="position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px;">
      <div class="modal-dialog" style="max-width: 540px; width: 100%; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); box-shadow: 0 20px 40px rgba(0,0,0,0.8); overflow: hidden;">
        
        <div style="padding: 14px 20px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; background: #0f172a;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 18px;">🏷️</span>
            <h3 style="font-size: 15px; font-weight: 800; color: #fff; margin: 0;">Printable Company Maintenance Sticker</h3>
          </div>
          <button id="btn-pm-close-print" style="background: none; border: none; color: #94a3b8; font-size: 18px; cursor: pointer;">✕</button>
        </div>

        <div style="padding: 24px; text-align: center; background: #090d16;">
          
          <!-- Physical Sticker Card (Matches Al-Muslim Group physical card) -->
          <div id="pm-printable-sticker-container" class="pm-printable-card" style="max-width: 440px; width: 100%; box-sizing: border-box; margin: 0 auto; background: #ffffff; color: #0f172a; border: 2.5px solid #1e3a8a; border-radius: 6px; display: flex; box-shadow: 0 10px 25px rgba(0,0,0,0.5); text-align: left; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; overflow: hidden; position: relative;">
            
            <!-- LEFT BLUE VERTICAL STRIP -->
            <div style="width: 95px; background: #1e3a8a; color: #fff; padding: 14px 6px; display: flex; flex-direction: column; align-items: center; justify-content: space-between; border-right: 2px solid #172554;">
              <!-- Al-Muslim Group Emblem -->
              <div style="text-align: center;">
                <svg width="42" height="42" viewBox="0 0 48 48" fill="none" style="margin: 0 auto; display: block;">
                  <polygon points="24,2 44,12 44,36 24,46 4,36 4,12" stroke="#ffffff" stroke-width="2.5" fill="rgba(255,255,255,0.1)"/>
                  <text x="24" y="29" font-family="Arial, sans-serif" font-size="14" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="-0.5">AM</text>
                </svg>
                <div style="font-size: 11px; font-weight: 800; color: #ffffff; text-transform: lowercase; letter-spacing: -0.3px; margin-top: 6px; line-height: 1.1; text-align: center;">
                  al-muslim group
                </div>
              </div>

              <!-- Vertical Rotated Text: Maintenance Department -->
              <div style="writing-mode: vertical-rl; transform: rotate(180deg); font-size: 11px; font-weight: 800; color: #ffffff; letter-spacing: 0.8px; text-transform: uppercase; margin: 12px 0;">
                Maintenance Department
              </div>

              <!-- Small bottom tag -->
              <div style="font-size: 8px; font-weight: 700; color: #93c5fd; letter-spacing: 0.5px; text-align: center;">
                FACTORY ERP
              </div>
            </div>

            <!-- RIGHT MAIN BODY (FORM ENTRIES) -->
            <div style="flex: 1; padding: 12px 16px; display: flex; flex-direction: column; justify-content: space-between; background: #ffffff;">
              
              <!-- Top Serial Row -->
              <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #1e3a8a; padding-bottom: 6px; margin-bottom: 8px;">
                <div style="font-size: 13px; font-weight: 900; color: #1e3a8a;">
                  Sl No. :
                </div>
                <div style="font-size: 22px; font-weight: 900; color: #000000; letter-spacing: 2px; font-family: monospace;">
                  ${escapeHtml(stickerSerial)}
                </div>
              </div>

              <!-- Form Lines with Dotted Underlines -->
              <div style="display: flex; flex-direction: column; gap: 7px; font-size: 11.5px; color: #0f172a;">
                
                <div style="display: flex; align-items: baseline;">
                  <span style="font-weight: 700; color: #1e3a8a; min-width: 105px;">Machine Name</span>
                  <span style="color: #64748b; margin-right: 4px;">:</span>
                  <span style="flex: 1; font-weight: 800; color: #0f172a; border-bottom: 1.5px dotted #94a3b8; padding-bottom: 1px; font-size: 12.5px;">
                    ${escapeHtml(profile.machineName)}
                  </span>
                </div>

                <div style="display: flex; align-items: baseline;">
                  <span style="font-weight: 700; color: #1e3a8a; min-width: 105px;">Machine Number</span>
                  <span style="color: #64748b; margin-right: 4px;">:</span>
                  <span style="flex: 1; font-weight: 800; color: #0f172a; border-bottom: 1.5px dotted #94a3b8; padding-bottom: 1px; font-size: 13px; font-family: monospace;">
                    ${escapeHtml(profile.serialNumber)}
                  </span>
                </div>

                <div style="display: flex; align-items: baseline;">
                  <span style="font-weight: 700; color: #1e3a8a; min-width: 105px;">Floor/Area</span>
                  <span style="color: #64748b; margin-right: 4px;">:</span>
                  <span style="flex: 1; font-weight: 800; color: #0f172a; border-bottom: 1.5px dotted #94a3b8; padding-bottom: 1px; font-size: 12px;">
                    ${escapeHtml(profile.floor)} - ${escapeHtml(profile.line)}
                  </span>
                </div>

                <div style="display: flex; align-items: baseline;">
                  <span style="font-weight: 700; color: #1e3a8a; min-width: 105px;">Servicing Date</span>
                  <span style="color: #64748b; margin-right: 4px;">:</span>
                  <span style="flex: 1; font-weight: 800; color: #0f172a; border-bottom: 1.5px dotted #94a3b8; padding-bottom: 1px; font-family: monospace;">
                    ${formatDisplayDate(serviceDate)}
                  </span>
                </div>

                <div style="display: flex; align-items: baseline;">
                  <span style="font-weight: 800; color: #dc2626; min-width: 105px;">Next Servicing Date</span>
                  <span style="color: #64748b; margin-right: 4px;">:</span>
                  <span style="flex: 1; font-weight: 900; color: #dc2626; border-bottom: 1.5px dotted #f87171; padding-bottom: 1px; font-family: monospace;">
                    ${formatDisplayDate(nextServiceDate)}
                  </span>
                </div>

              </div>

              <!-- Bottom Footer: QR & Verification -->
              <div style="margin-top: 10px; padding-top: 6px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: flex-end;">
                <div style="font-size: 8.5px; color: #64748b; font-weight: 600; line-height: 1.2;">
                  PREVENTIVE CARE &bull; AL-MUSLIM GROUP<br/>
                  VALIDATED CENTRAL ERP SCHEDULE
                </div>
                <div style="background: #ffffff; padding: 2px; border: 1px solid #cbd5e1; border-radius: 4px;">
                  ${qrSvg}
                </div>
              </div>

            </div>

          </div>

          <!-- Print & Close Controls -->
          <div style="margin-top: 20px; display: flex; justify-content: center; gap: 12px;">
            <button id="btn-pm-execute-print" class="btn btn-primary btn-sm" style="padding: 9px 26px; font-weight: 800; font-size: 13px;">
              🖨️ Print Physical Sticker Label
            </button>
            <button id="btn-pm-cancel-print" class="btn btn-secondary btn-sm" style="padding: 9px 20px;">
              Close
            </button>
          </div>

        </div>

      </div>
    </div>
  `;
}

/**
 * Dedicated Replace Physical Sticker Modal
 */
function renderReplaceStickerModal() {
  const profile = modalMachineContext ? preventiveMaintenanceService.getMachinePreventiveProfile(modalMachineContext) : null;
  if (!profile) return '';

  const currentSticker = profile.serviceStickerSerial && profile.serviceStickerSerial !== 'STK-PENDING'
    ? profile.serviceStickerSerial
    : 'None Tagged';

  return `
    <div class="modal-backdrop" id="pm-replace-sticker-backdrop" style="position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px;">
      <div class="modal-dialog" style="max-width: 480px; width: 100%; background: var(--bg-surface); border: 1.5px solid #38bdf8; border-radius: var(--radius-lg); box-shadow: 0 20px 40px rgba(0,0,0,0.8); overflow: hidden;">
        
        <div style="padding: 16px 20px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; background: #0f172a;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 20px;">🏷️</span>
            <div>
              <h3 style="font-size: 15px; font-weight: 800; color: #fff; margin: 0;">
                Replace Company Physical Sticker Sl No.
              </h3>
              <div style="font-size: 11.5px; color: #38bdf8;">
                Machine: ${escapeHtml(profile.serialNumber)} &bull; ${escapeHtml(profile.machineName)} (${escapeHtml(profile.floor)} - ${escapeHtml(profile.line)})
              </div>
            </div>
          </div>
          <button id="btn-pm-close-replace-modal" style="background: none; border: none; color: #94a3b8; font-size: 18px; cursor: pointer;">✕</button>
        </div>

        <div style="padding: 20px; display: flex; flex-direction: column; gap: 14px;">
          <input type="hidden" id="pm-replace-machine-id" value="${profile.machineId}" />
          
          <div style="background: #0f172a; border: 1px solid #334155; border-radius: 6px; padding: 10px 14px; font-size: 12px; display: flex; justify-content: space-between; align-items: center;">
            <span style="color: var(--text-secondary);">Current Physical Sticker Sl No:</span>
            <span style="font-family: monospace; font-weight: 800; color: #fbbf24; font-size: 14px;">${escapeHtml(currentSticker)}</span>
          </div>

          <div>
            <label style="font-size: 12px; font-weight: 700; color: #38bdf8; display: block; margin-bottom: 5px;">
              New Physical Sticker Sl No. (Manual Entry) *
            </label>
            <div>
              <input 
                type="text" 
                id="pm-replace-new-serial" 
                value="" 
                autofocus
                placeholder="e.g. 238168 or 245231 (Enter from physical sticker pad)..." 
                style="width: 100%; padding: 10px 14px; background: var(--bg-card); border: 1.5px solid #38bdf8; border-radius: 6px; color: #fff; font-family: monospace; font-size: 15px; font-weight: 800; letter-spacing: 1px;" 
              />
            </div>
            <div style="font-size: 11.5px; color: #94a3b8; margin-top: 5px;">
              ✍️ Enter the 6-digit Sl No. from the physical sticker affixed to this machine.
            </div>
          </div>

          <div>
            <label style="font-size: 12px; font-weight: 700; color: #cbd5e1; display: block; margin-bottom: 5px;">
              Reason for Replacement / Re-tagging
            </label>
            <select id="pm-replace-reason" style="width: 100%; padding: 8px 10px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 6px; color: #fff; font-size: 12.5px;">
              <option value="Re-tagged after preventive maintenance servicing">Re-tagged after preventive maintenance servicing</option>
              <option value="Old sticker damaged, detached or missing">Old sticker damaged, detached or missing</option>
              <option value="Printed serial number worn or illegible">Printed serial number worn or illegible</option>
              <option value="Machine relocated / floor re-assignment">Machine relocated / floor re-assignment</option>
              <option value="Audit inspection correction">Audit inspection correction</option>
            </select>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px;">
            <button id="btn-pm-cancel-replace-sticker" class="btn btn-secondary btn-sm" style="padding: 8px 16px;">Cancel</button>
            <button id="btn-pm-confirm-replace-sticker" class="btn btn-primary btn-sm" style="padding: 8px 22px; font-weight: 700;">
              💾 Save &amp; Tag New Sticker
            </button>
          </div>
        </div>

      </div>
    </div>
  `;
}

/**
 * Add / Edit Admin Schedule Config Modal
 */
function renderConfigModal() {
  const cfg = modalServiceContext || {
    id: '',
    machineType: '',
    frequencyDays: 90,
    responsibleDepartment: 'Mechanical Maintenance',
    checklist: [
      'Motor & Drive Belt Inspection & Tension Adjustment',
      'Oil Level & High Speed Lubrication System',
      'Needle Bar Height & Timing Alignment',
      'Safety Guard & Eye Shield Intactness',
      'Dust, Lint & Waste Suction Cleaning'
    ]
  };

  return `
    <div class="modal-backdrop" id="pm-config-modal-backdrop" style="position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px;">
      <div class="modal-dialog" style="max-width: 540px; width: 100%; background: var(--bg-surface); border: 1px solid #3b82f6; border-radius: var(--radius-xl); box-shadow: 0 20px 40px rgba(0,0,0,0.8); overflow: hidden;">
        
        <div style="padding: 14px 18px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; background: #0f172a;">
          <h3 style="font-size: 15px; font-weight: 800; color: #fff; margin: 0;">
            ⚙️ ${cfg.id ? 'Edit' : 'Add'} Machine Type Schedule Config
          </h3>
          <button id="btn-pm-close-config-modal" style="background: none; border: none; color: #94a3b8; font-size: 18px; cursor: pointer;">✕</button>
        </div>

        <div style="padding: 20px; max-height: 80vh; overflow-y: auto; display: flex; flex-direction: column; gap: 14px;">
          <input type="hidden" id="pm-cfg-id" value="${cfg.id || ''}" />

          <div>
            <label style="font-size: 11.5px; font-weight: 700; color: #cbd5e1; display: block; margin-bottom: 4px;">Machine Type Name *</label>
            <input type="text" id="pm-cfg-type" value="${escapeHtml(cfg.machineType || '')}" placeholder="e.g. Lock Stitch, Overlock, Flatlock, Button Hole" style="width: 100%; padding: 8px 12px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 6px; color: #fff; font-size: 13px;" />
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div>
              <label style="font-size: 11.5px; font-weight: 700; color: #cbd5e1; display: block; margin-bottom: 4px;">Interval (Days) *</label>
              <input type="number" id="pm-cfg-days" value="${cfg.frequencyDays || 90}" style="width: 100%; padding: 8px 12px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 6px; color: #fff; font-size: 13px;" />
            </div>
            <div>
              <label style="font-size: 11.5px; font-weight: 700; color: #cbd5e1; display: block; margin-bottom: 4px;">Department</label>
              <input type="text" id="pm-cfg-dept" value="${escapeHtml(cfg.responsibleDepartment || 'Mechanical Maintenance')}" style="width: 100%; padding: 8px 12px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 6px; color: #fff; font-size: 13px;" />
            </div>
          </div>

          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <label style="font-size: 11.5px; font-weight: 700; color: #cbd5e1; margin: 0;">📋 Standard Inspection Checklist (Admin Controlled)</label>
              <span style="font-size: 11px; color: #38bdf8;">One item per line</span>
            </div>
            <textarea id="pm-cfg-checklist" rows="6" placeholder="Enter inspection checklist items, one per line..." style="width: 100%; padding: 8px 12px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 6px; color: #fff; font-size: 12.5px; line-height: 1.5;">${(cfg.checklist || []).join('\n')}</textarea>
            <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">
              💡 Admins can add, edit, or delete items by editing the lines above. These items will appear in the service entry checklist for this machine type.
            </div>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 6px;">
            <button id="btn-pm-cancel-config" class="btn btn-secondary btn-sm">Cancel</button>
            <button id="btn-pm-save-config" class="btn btn-primary btn-sm" style="font-weight: 700;">
              💾 Save Configuration
            </button>
          </div>
        </div>

      </div>
    </div>
  `;
}

/**
 * Bulk Preventive Schedule Import & Frequency Configuration Modal
 */
function renderBulkExcelConfigModal() {
  const preview = bulkExcelPreviewResult;
  const fileName = bulkExcelParsedRows ? (bulkExcelParsedRows._fileName || 'Uploaded Excel File') : '';

  return `
    <div class="modal-backdrop" id="pm-bulk-excel-backdrop" style="position: fixed; inset: 0; background: rgba(0,0,0,0.82); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px;">
      <div class="modal-dialog" style="max-width: 960px; width: 100%; background: var(--bg-surface); border: 1.5px solid #0284c7; border-radius: var(--radius-xl); box-shadow: 0 25px 50px rgba(0,0,0,0.85); display: flex; flex-direction: column; max-height: 90vh; overflow: hidden;">
        
        <!-- Header -->
        <div style="padding: 16px 22px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; background: #0f172a;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 24px;">📊</span>
            <div>
              <h3 style="font-size: 16px; font-weight: 800; color: #fff; margin: 0; display: flex; align-items: center; gap: 8px;">
                <span>Bulk Maintenance Schedule &amp; Frequency (Days) Excel Import</span>
                <span class="badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; font-size: 11px; font-weight: 700;">Zero Manual Entry</span>
              </h3>
              <p style="font-size: 12px; color: var(--text-secondary); margin: 3px 0 0 0;">
                Rapidly update servicing frequency intervals (days) for all 76 machine types or factory machinery in one batch.
              </p>
            </div>
          </div>
          <button id="btn-pm-close-bulk-modal" style="background: none; border: none; color: #94a3b8; font-size: 20px; cursor: pointer; padding: 4px;" title="Close Modal">✕</button>
        </div>

        <!-- Body -->
        <div style="padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 16px;">
          
          <!-- Step 1: Instruction & Template Download Card -->
          <div style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: var(--radius-lg); padding: 14px 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
            <div style="display: flex; flex-direction: column; gap: 4px;">
              <div style="font-size: 13px; font-weight: 800; color: #38bdf8; display: flex; align-items: center; gap: 6px;">
                <span>📥</span> Step 1: Download Current Pre-Filled Excel Template
              </div>
              <div style="font-size: 11.5px; color: var(--text-secondary);">
                Pre-populated with all current machine types, existing service interval days, and active factory machine counts.
              </div>
            </div>
            <button id="btn-pm-modal-download-template" class="btn btn-secondary btn-sm" style="display: flex; align-items: center; gap: 6px; font-weight: 700; border-color: #38bdf8; color: #38bdf8; background: #1e293b; height: 32px; padding: 0 14px;">
              <span>📥</span> Download Template (.xlsx)
            </button>
          </div>

          <!-- Step 2: Upload Zone -->
          <div 
            id="pm-bulk-excel-dropzone" 
            style="border: 2px dashed ${preview ? '#10b981' : '#0284c7'}; border-radius: var(--radius-lg); background: ${preview ? 'rgba(16, 185, 129, 0.04)' : 'rgba(2, 132, 199, 0.04)'}; padding: 22px; text-align: center; cursor: pointer; transition: all 0.2s ease;"
          >
            <input type="file" id="pm-bulk-excel-file-input" accept=".xlsx, .xls, .csv" style="display: none;" />
            <div style="font-size: 32px; margin-bottom: 6px;">${preview ? '✅' : '📁'}</div>
            <div style="font-size: 14px; font-weight: 700; color: #fff; margin-bottom: 4px;">
              ${preview ? `File Loaded: <span style="color: #38bdf8;">${escapeHtml(fileName)}</span>` : 'Drop your completed Excel file here or click to browse'}
            </div>
            <div style="font-size: 11.5px; color: var(--text-muted);">
              Supports .xlsx, .xls, and .csv files. Columns: "Machine Type Name", "Service Interval (Days)"
            </div>
          </div>

          <!-- Step 3: Live Preview Area (if preview generated) -->
          ${preview ? `
            <div style="display: flex; flex-direction: column; gap: 12px;">
              
              <!-- Metric Summary Grid -->
              <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px;">
                <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px; text-align: center;">
                  <div style="font-size: 18px; font-weight: 900; color: #fff;">${preview.totalRows}</div>
                  <div style="font-size: 11px; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">Total Rows</div>
                </div>
                <div style="background: rgba(56, 189, 248, 0.12); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 8px; padding: 10px; text-align: center;">
                  <div style="font-size: 18px; font-weight: 900; color: #38bdf8;">${preview.changedCount}</div>
                  <div style="font-size: 11px; color: #38bdf8; font-weight: 700; text-transform: uppercase;">🔄 To Update</div>
                </div>
                <div style="background: rgba(168, 85, 247, 0.12); border: 1px solid rgba(168, 85, 247, 0.3); border-radius: 8px; padding: 10px; text-align: center;">
                  <div style="font-size: 18px; font-weight: 900; color: #c084fc;">${preview.newCount}</div>
                  <div style="font-size: 11px; color: #c084fc; font-weight: 700; text-transform: uppercase;">✨ New Types</div>
                </div>
                <div style="background: rgba(148, 163, 184, 0.08); border: 1px solid rgba(148, 163, 184, 0.2); border-radius: 8px; padding: 10px; text-align: center;">
                  <div style="font-size: 18px; font-weight: 900; color: #94a3b8;">${preview.unchangedCount}</div>
                  <div style="font-size: 11px; color: #94a3b8; font-weight: 600; text-transform: uppercase;">⚪ Unchanged</div>
                </div>
                <div style="background: ${preview.invalidRows.length > 0 ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.08)'}; border: 1px solid ${preview.invalidRows.length > 0 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.2)'}; border-radius: 8px; padding: 10px; text-align: center;">
                  <div style="font-size: 18px; font-weight: 900; color: ${preview.invalidRows.length > 0 ? '#f87171' : '#34d399'};">${preview.invalidRows.length}</div>
                  <div style="font-size: 11px; color: ${preview.invalidRows.length > 0 ? '#f87171' : '#34d399'}; font-weight: 600; text-transform: uppercase;">${preview.invalidRows.length > 0 ? '⚠️ Invalid' : '✅ 0 Errors'}</div>
                </div>
              </div>

              <!-- Preview Table -->
              <div style="border: 1px solid var(--border-color); border-radius: var(--radius-lg); overflow: hidden;">
                <div style="padding: 8px 12px; background: #0b1329; border-bottom: 1px solid var(--border-color); font-size: 11.5px; font-weight: 700; color: #cbd5e1; display: flex; justify-content: space-between; align-items: center;">
                  <span>📋 Parsed Schedule Changes (${preview.validRows.length} Valid Items)</span>
                  <span style="font-size: 11px; color: #38bdf8;">Green highlighted items indicate modified days</span>
                </div>
                <div style="max-height: 280px; overflow-y: auto; overflow-x: auto;">
                  <table class="data-table" style="width: 100%; min-width: 780px; border-collapse: collapse; font-size: 12px;">
                    <thead>
                      <tr>
                        <th style="width: 45px; text-align: center;">SL</th>
                        <th style="min-width: 220px; text-align: left;">Machine Type Name</th>
                        <th style="text-align: center; width: 100px;">Current Days</th>
                        <th style="text-align: center; width: 130px;">New Days (Excel)</th>
                        <th style="text-align: center; width: 110px;">Factory Machines</th>
                        <th style="min-width: 130px; text-align: center;">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${preview.items.map((item) => {
                        const isMod = item.isChanged && item.isValid;
                        return `
                          <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); background: ${isMod ? 'rgba(56, 189, 248, 0.06)' : 'transparent'};">
                            <td style="text-align: center; color: var(--text-muted); font-size: 11px;">${item.sl}</td>
                            <td style="font-weight: 700; color: #fff;">
                              ${escapeHtml(item.machineType)}
                              ${item.rawMachineType && item.rawMachineType !== item.machineType ? `<span style="font-size: 10px; color: #94a3b8; margin-left: 4px;">(${escapeHtml(item.rawMachineType)})</span>` : ''}
                            </td>
                            <td style="text-align: center; color: #94a3b8; font-family: monospace; font-size: 12px;">
                              ${item.currentDays ? item.currentDays + ' Days' : '—'}
                            </td>
                            <td style="text-align: center; font-weight: 800; font-family: monospace; font-size: 12.5px;">
                              ${item.newDays ? `
                                <span style="background: ${isMod ? 'rgba(16, 185, 129, 0.2)' : '#1e293b'}; color: ${isMod ? '#34d399' : '#cbd5e1'}; border: 1px solid ${isMod ? '#10b981' : 'transparent'}; padding: 2px 8px; border-radius: 4px;">
                                  ${item.newDays} Days
                                </span>
                              ` : '<span style="color: #f87171;">Invalid</span>'}
                            </td>
                            <td style="text-align: center;">
                              <span class="badge" style="background: rgba(56, 189, 248, 0.12); color: #38bdf8; font-size: 11px;">
                                ${item.targetMachinesCount || 0} Units
                              </span>
                            </td>
                            <td style="text-align: center;">
                              ${item.actionStatus === 'UPDATE' ? `
                                <span class="badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; font-weight: 700; font-size: 10.5px;">
                                  🔄 Will Update
                                </span>
                              ` : item.actionStatus === 'NEW' ? `
                                <span class="badge" style="background: rgba(168, 85, 247, 0.15); color: #c084fc; font-weight: 700; font-size: 10.5px;">
                                  ✨ New Type
                                </span>
                              ` : item.actionStatus === 'INVALID' ? `
                                <span class="badge badge-danger" style="font-size: 10.5px;">
                                  ⚠️ ${escapeHtml(item.actionLabel)}
                                </span>
                              ` : `
                                <span class="badge" style="background: #1e293b; color: #94a3b8; font-size: 10.5px;">
                                  ⚪ No Change
                                </span>
                              `}
                            </td>
                          </tr>
                        `;
                      }).join('')}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          ` : ''}

        </div>

        <!-- Footer -->
        <div style="padding: 14px 22px; border-top: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; background: #0f172a;">
          <button id="btn-pm-cancel-bulk-modal" class="btn btn-secondary btn-sm" style="font-weight: 600; padding: 6px 14px;">
            Cancel
          </button>
          
          <div style="display: flex; gap: 10px; align-items: center;">
            <button 
              id="btn-pm-apply-bulk-import" 
              class="btn btn-primary btn-sm" 
              style="font-weight: 800; font-size: 12.5px; padding: 6px 20px; background: linear-gradient(135deg, #0284c7, #0369a1); box-shadow: 0 0 15px rgba(2, 132, 199, 0.35);"
              ${!preview || preview.validRows.length === 0 ? 'disabled' : ''}
            >
              ✅ Apply Bulk Schedule Update (${preview ? preview.validRows.length : 0} Machine Types)
            </button>
          </div>
        </div>

      </div>
    </div>
  `;
}

// =========================================================================
// EVENT HANDLERS & BINDINGS
// =========================================================================

export function initPreventiveMaintenanceEvents() {
  const container = document.querySelector('.preventive-maintenance-page');
  if (!container) return;

  // 1. Tab switching
  container.querySelectorAll('.pm-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tab = btn.getAttribute('data-pm-tab');
      if (tab && tab !== activeTab) {
        activeTab = tab;
        pmCurrentPage = 1;
        rerenderView();
      }
    });
  });

  // Top action: Open Scanner
  document.getElementById('btn-pm-open-scanner')?.addEventListener('click', () => {
    activePmModal = 'qr-scanner';
    rerenderView();
  });

  // Top action: New Service Entry (starts fresh with NO default machine selected)
  document.getElementById('btn-pm-new-service-top')?.addEventListener('click', () => {
    modalMachineContext = null;
    activePmModal = 'service-entry';
    rerenderView();
  });

  // Top action: Print Active Sticker (resolves active machine gracefully)
  document.getElementById('btn-pm-print-active-sticker')?.addEventListener('click', () => {
    modalMachineContext = selectedMachineId || getValidActiveMachineId();
    activePmModal = 'print-sticker';
    rerenderView();
  });

  // Top action: Export Excel (respects active filters)
  document.getElementById('btn-pm-export-excel')?.addEventListener('click', () => {
    exportMaintenanceToExcel();
  });

  // Top action: Config Tab
  document.getElementById('btn-pm-tab-config')?.addEventListener('click', () => {
    activeTab = 'admin-config';
    pmCurrentPage = 1;
    rerenderView();
  });

  // Top action: Bulk Excel Days
  document.getElementById('btn-pm-top-bulk-excel')?.addEventListener('click', () => {
    bulkExcelParsedRows = null;
    bulkExcelPreviewResult = null;
    activePmModal = 'bulk-excel-modal';
    rerenderView();
  });

  // 2. Universal Search Input & Auto-Suggest
  const searchInput = document.getElementById('pm-universal-search-input');
  const suggestionsBox = document.getElementById('pm-search-suggestions-box');

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      const clean = searchQuery.trim();

      // Auto-suggest popup
      if (clean.length >= 1) {
        const matches = preventiveMaintenanceService.getAllMachinesWithMaintenance({ search: clean }).slice(0, 6);
        if (matches.length > 0 && suggestionsBox) {
          suggestionsBox.style.display = 'block';
          suggestionsBox.innerHTML = matches.map(m => `
            <div class="pm-suggestion-item" data-serial="${escapeHtml(m.serialNumber)}" style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong style="color: #38bdf8;">${escapeHtml(m.serialNumber)}</strong> &bull; <span style="color: #fff;">${escapeHtml(m.machineName)}</span>
                <div style="font-size: 11px; color: var(--text-secondary);">${escapeHtml(m.floor)} &bull; Line: ${escapeHtml(m.line)}</div>
              </div>
              <div>${m.urgency.displayBadge}</div>
            </div>
          `).join('');

          suggestionsBox.querySelectorAll('.pm-suggestion-item').forEach(item => {
            item.addEventListener('click', () => {
              const s = item.getAttribute('data-serial');
              selectMachineBySerial(s);
              suggestionsBox.style.display = 'none';
            });
          });
        } else if (suggestionsBox) {
          suggestionsBox.style.display = 'none';
        }
      } else if (suggestionsBox) {
        suggestionsBox.style.display = 'none';
      }
    });

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        searchQuery = searchInput.value.trim();
        pmCurrentPage = 1;
        if (suggestionsBox) suggestionsBox.style.display = 'none';
        rerenderView();
      }
    });

    searchInput.addEventListener('change', () => {
      searchQuery = searchInput.value.trim();
      pmCurrentPage = 1;
      rerenderView();
    });
  }

  // Search icon click trigger
  document.getElementById('btn-pm-search-icon')?.addEventListener('click', () => {
    if (searchInput) searchQuery = searchInput.value.trim();
    pmCurrentPage = 1;
    rerenderView();
  });

  // Clear search
  document.getElementById('btn-pm-clear-search')?.addEventListener('click', () => {
    searchQuery = '';
    pmCurrentPage = 1;
    rerenderView();
  });

  // Active filter tags removal (identical UX to Machine Inventory)
  container.querySelectorAll('.pm-active-filter-tag').forEach(tag => {
    tag.addEventListener('click', () => {
      const key = tag.getAttribute('data-filter-key');
      if (key === 'search') searchQuery = '';
      else if (key === 'floorId') filterFloorId = 'ALL';
      else if (key === 'lineId') filterLineId = 'ALL';
      else if (key === 'machineType') filterMachineType = 'ALL';
      else if (key === 'urgency') filterUrgency = 'ALL';
      pmCurrentPage = 1;
      rerenderView();
    });
  });

  // Clear all tags button
  document.getElementById('btn-pm-clear-all-tags')?.addEventListener('click', () => {
    searchQuery = '';
    filterFloorId = 'ALL';
    filterLineId = 'ALL';
    filterMachineType = 'ALL';
    filterUrgency = 'ALL';
    pmCurrentPage = 1;
    rerenderView();
  });

  // Dropdown filter changes
  document.getElementById('pm-filter-floor')?.addEventListener('change', (e) => {
    filterFloorId = e.target.value;
    if (filterFloorId !== 'ALL' && filterLineId !== 'ALL') {
      const validLines = masterDataService.getLines(filterFloorId);
      const stillValid = validLines.some(l => l.id === filterLineId || l.name === filterLineId || l.code === filterLineId);
      if (!stillValid) {
        filterLineId = 'ALL';
      }
    }
    pmCurrentPage = 1;
    rerenderView();
  });

  document.getElementById('pm-filter-line')?.addEventListener('change', (e) => {
    filterLineId = e.target.value;
    if (filterLineId !== 'ALL' && filterFloorId === 'ALL') {
      const lineObj = storage.getItem(TABLE_NAMES.LINES, filterLineId);
      if (lineObj && lineObj.floorId) {
        filterFloorId = lineObj.floorId;
      }
    }
    pmCurrentPage = 1;
    rerenderView();
  });

  document.getElementById('pm-filter-type')?.addEventListener('change', (e) => {
    filterMachineType = e.target.value;
    pmCurrentPage = 1;
    rerenderView();
  });

  document.getElementById('pm-filter-urgency')?.addEventListener('change', (e) => {
    filterUrgency = e.target.value;
    pmCurrentPage = 1;
    rerenderView();
  });

  document.getElementById('btn-pm-reset-filters')?.addEventListener('click', () => {
    searchQuery = '';
    filterFloorId = 'ALL';
    filterLineId = 'ALL';
    filterMachineType = 'ALL';
    filterUrgency = 'ALL';
    pmCurrentPage = 1;
    rerenderView();
  });

  // Interactive KPI Cards & Inline KPI Status Pills
  container.querySelectorAll('.pm-metric-card[data-kpi-urgency], .pm-kpi-pill[data-kpi-urgency]').forEach(card => {
    card.addEventListener('click', () => {
      const u = card.getAttribute('data-kpi-urgency');
      filterUrgency = u || 'ALL';
      activeTab = 'dashboard';
      pmCurrentPage = 1;
      rerenderView();
    });
  });

  container.querySelectorAll('.pm-metric-card[data-kpi-tab], .pm-kpi-pill[data-kpi-tab]').forEach(card => {
    card.addEventListener('click', () => {
      const t = card.getAttribute('data-kpi-tab');
      if (t) {
        activeTab = t;
        pmCurrentPage = 1;
        rerenderView();
      }
    });
  });

  container.querySelectorAll('.pm-metric-card[data-kpi-action="reset"], .pm-kpi-pill[data-kpi-action="reset"]').forEach(card => {
    card.addEventListener('click', () => {
      searchQuery = '';
      filterFloorId = 'ALL';
      filterLineId = 'ALL';
      filterMachineType = 'ALL';
      filterUrgency = 'ALL';
      activeTab = 'dashboard';
      pmCurrentPage = 1;
      rerenderView();
    });
  });

  // Pagination Event Controls (Matching Machine Inventory)
  container.querySelectorAll('.btn-pm-page-number').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = parseInt(btn.getAttribute('data-page'), 10);
      if (!isNaN(p)) {
        pmCurrentPage = p;
        rerenderView();
      }
    });
  });

  container.querySelectorAll('.btn-pm-prev-page').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = parseInt(btn.getAttribute('data-page'), 10);
      if (!isNaN(p) && p >= 1) {
        pmCurrentPage = p;
        rerenderView();
      }
    });
  });

  container.querySelectorAll('.btn-pm-next-page').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = parseInt(btn.getAttribute('data-page'), 10);
      if (!isNaN(p)) {
        pmCurrentPage = p;
        rerenderView();
      }
    });
  });

  container.querySelectorAll('.sel-pm-page-size').forEach(sel => {
    sel.addEventListener('change', (e) => {
      pmPageSize = e.target.value === 'ALL' ? 'ALL' : parseInt(e.target.value, 10);
      pmCurrentPage = 1;
      rerenderView();
    });
  });

  // Pick first machine button inside profile tab
  document.getElementById('btn-pm-pick-first-machine')?.addEventListener('click', () => {
    const firstId = getValidActiveMachineId();
    if (firstId) {
      selectedMachineId = firstId;
      rerenderView();
    }
  });

  // Filter urgent only button on banner
  document.getElementById('btn-pm-filter-urgent-only')?.addEventListener('click', () => {
    filterUrgency = 'OVERDUE';
    rerenderView();
  });

  // Clickable machine serial link to open profile
  container.querySelectorAll('.pm-link-machine, .btn-pm-view-profile').forEach(el => {
    el.addEventListener('click', () => {
      const serial = el.getAttribute('data-serial');
      selectMachineBySerial(serial);
    });
  });

  // 1-Click "Service Now" button
  container.querySelectorAll('.btn-pm-service-now').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const mId = btn.getAttribute('data-machine-id');
      modalMachineContext = mId;
      activePmModal = 'service-entry';
      rerenderView();
    });
  });

  // Replace physical sticker button
  container.querySelectorAll('.btn-pm-replace-sticker').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const serial = btn.getAttribute('data-serial');
      modalMachineContext = serial;
      activePmModal = 'replace-sticker';
      rerenderView();
    });
  });

  // Print single sticker button
  container.querySelectorAll('.btn-pm-print-single-sticker').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const serial = btn.getAttribute('data-serial');
      modalMachineContext = serial;
      activePmModal = 'print-sticker';
      rerenderView();
    });
  });

  // Edit sticker serial button
  container.querySelectorAll('.btn-pm-edit-sticker').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const recId = btn.getAttribute('data-record-id');
      const curSticker = btn.getAttribute('data-current-sticker');
      modalServiceContext = { recordId: recId, currentSticker: curSticker };
      activePmModal = 'edit-sticker';
      rerenderView();
    });
  });

  // Admin Config Actions
  document.getElementById('btn-pm-download-config-template')?.addEventListener('click', async () => {
    await preventiveMaintenanceService.exportScheduleConfigExcelTemplate();
  });

  document.getElementById('btn-pm-open-bulk-excel-import')?.addEventListener('click', () => {
    bulkExcelParsedRows = null;
    bulkExcelPreviewResult = null;
    activePmModal = 'bulk-excel-modal';
    rerenderView();
  });

  document.getElementById('btn-pm-sync-master-data')?.addEventListener('click', () => {
    const synced = preventiveMaintenanceService.syncConfigsFromMasterData();
    notificationService.success(`Consolidated ${synced.length} machine types from Master Data Storage with zero duplicates!`);
    rerenderView();
  });

  const cfgSearchInput = document.getElementById('pm-config-search-input');
  if (cfgSearchInput) {
    cfgSearchInput.addEventListener('input', (e) => {
      configSearchQuery = e.target.value;
      rerenderView();
      const refocused = document.getElementById('pm-config-search-input');
      if (refocused) {
        refocused.focus({ preventScroll: true });
        refocused.setSelectionRange(refocused.value.length, refocused.value.length);
      }
    });
  }

  document.getElementById('btn-pm-add-new-config')?.addEventListener('click', () => {
    modalServiceContext = null;
    activePmModal = 'config-modal';
    rerenderView();
  });

  container.querySelectorAll('.btn-pm-edit-config').forEach(btn => {
    btn.addEventListener('click', () => {
      const cfgId = btn.getAttribute('data-config-id');
      const cfg = preventiveMaintenanceService.getConfigById(cfgId);
      modalServiceContext = cfg;
      activePmModal = 'config-modal';
      rerenderView();
    });
  });

  container.querySelectorAll('.btn-pm-delete-config').forEach(btn => {
    btn.addEventListener('click', () => {
      const cfgId = btn.getAttribute('data-config-id');
      if (confirm('Are you sure you want to delete this machine schedule configuration?')) {
        preventiveMaintenanceService.deleteConfig(cfgId);
        notificationService.success('Configuration deleted successfully.');
        rerenderView();
      }
    });
  });

  // Modal event bindings
  bindModalEvents();
}

function bindModalEvents() {
  // 1. Service Entry Modal Events
  document.getElementById('btn-pm-close-service-modal')?.addEventListener('click', () => closeModal());
  document.getElementById('btn-pm-cancel-service')?.addEventListener('click', () => closeModal());

  // -------------------------------------------------------------
  // Admin-Controlled Inspection Checklist Management
  // -------------------------------------------------------------
  const checklistContainer = document.getElementById('pm-checklist-items-container');
  const checklistCountSpan = document.getElementById('pm-checklist-count');
  const addInlineBox = document.getElementById('pm-add-checklist-inline');
  const newChecklistInput = document.getElementById('pm-new-checklist-input');
  const isAdmin = authService.isAdmin();

  const activeProf = modalMachineContext ? preventiveMaintenanceService.getMachinePreventiveProfile(modalMachineContext) : null;
  const targetMachineType = activeProf?.machineType || 'Plane / Lock Stitch Machine';

  const getCurrentChecklistItems = () => {
    const items = [];
    document.querySelectorAll('.pm-checklist-row').forEach(row => {
      const textSpan = row.querySelector('.pm-checklist-item-text');
      if (textSpan) {
        const txt = textSpan.textContent.trim();
        if (txt) items.push(txt);
      }
    });
    return items;
  };

  const renderChecklistRows = (items) => {
    if (!checklistContainer) return;
    if (checklistCountSpan) checklistCountSpan.textContent = items.length;

    checklistContainer.innerHTML = items.map((item, idx) => `
      <div class="pm-checklist-row" data-index="${idx}" style="display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 5px 8px; border-radius: 4px; background: rgba(255,255,255,0.02); transition: background 0.15s ease;">
        <label class="pm-checklist-label" style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: #cbd5e1; cursor: pointer; flex: 1; margin: 0;">
          <input type="checkbox" class="pm-checklist-item" data-item="${escapeHtml(item)}" checked style="width: 15px; height: 15px; accent-color: #10b981;" />
          <span class="pm-checklist-item-text" data-index="${idx}">${escapeHtml(item)}</span>
        </label>
        ${isAdmin ? `
          <div class="pm-admin-checklist-actions" style="display: flex; gap: 4px; align-items: center;">
            <button type="button" class="btn-pm-edit-checklist" data-index="${idx}" title="Admin: Edit Checklist Item" style="background: none; border: none; color: #38bdf8; cursor: pointer; font-size: 12px; padding: 2px 4px; border-radius: 3px; line-height: 1;">
              ✏️
            </button>
            <button type="button" class="btn-pm-del-checklist" data-index="${idx}" title="Admin: Remove Checklist Item" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 12px; padding: 2px 4px; border-radius: 3px; line-height: 1;">
              🗑️
            </button>
          </div>
        ` : ''}
      </div>
    `).join('');

    bindChecklistRowEvents();
  };

  const bindChecklistRowEvents = () => {
    if (!isAdmin || !checklistContainer) return;

    // Delete item
    checklistContainer.querySelectorAll('.btn-pm-del-checklist').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute('data-index'), 10);
        const currentItems = getCurrentChecklistItems();
        const itemToRemove = currentItems[idx];
        if (!confirm(`Are you sure you want to remove inspection checklist item:\n"${itemToRemove}"?`)) {
          return;
        }
        currentItems.splice(idx, 1);
        try {
          preventiveMaintenanceService.updateChecklistForMachineType(targetMachineType, currentItems);
          renderChecklistRows(currentItems);
          notificationService.success(`Checklist item removed for ${targetMachineType}`);
        } catch (err) {
          alert('Error removing checklist item: ' + err.message);
        }
      });
    });

    // Edit item
    checklistContainer.querySelectorAll('.btn-pm-edit-checklist').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute('data-index'), 10);
        const row = checklistContainer.querySelector(`.pm-checklist-row[data-index="${idx}"]`);
        if (!row) return;

        const currentItems = getCurrentChecklistItems();
        const oldText = currentItems[idx] || '';

        row.innerHTML = `
          <div style="display: flex; gap: 6px; align-items: center; width: 100%; padding: 2px 0;">
            <input type="text" class="pm-edit-item-input" value="${escapeHtml(oldText)}" style="flex: 1; padding: 4px 8px; background: #0f172a; border: 1.5px solid #38bdf8; border-radius: 4px; color: #fff; font-size: 12px;" />
            <button type="button" class="btn-pm-save-edit-item btn btn-primary btn-sm" style="padding: 2px 8px; font-size: 11px; font-weight: 700;">Save</button>
            <button type="button" class="btn-pm-cancel-edit-item btn btn-secondary btn-sm" style="padding: 2px 6px; font-size: 11px;">Cancel</button>
          </div>
        `;

        const editInput = row.querySelector('.pm-edit-item-input');
        editInput?.focus({ preventScroll: true });

        row.querySelector('.btn-pm-save-edit-item')?.addEventListener('click', () => {
          const newText = editInput?.value?.trim();
          if (!newText) {
            alert('Checklist item text cannot be empty.');
            return;
          }
          currentItems[idx] = newText;
          try {
            preventiveMaintenanceService.updateChecklistForMachineType(targetMachineType, currentItems);
            renderChecklistRows(currentItems);
            notificationService.success(`Checklist item updated for ${targetMachineType}`);
          } catch (err) {
            alert('Error updating checklist item: ' + err.message);
          }
        });

        row.querySelector('.btn-pm-cancel-edit-item')?.addEventListener('click', () => {
          renderChecklistRows(currentItems);
        });

        editInput?.addEventListener('keydown', (ke) => {
          if (ke.key === 'Enter') {
            ke.preventDefault();
            row.querySelector('.btn-pm-save-edit-item')?.click();
          } else if (ke.key === 'Escape') {
            row.querySelector('.btn-pm-cancel-edit-item')?.click();
          }
        });
      });
    });
  };

  // Bind existing rows on open
  bindChecklistRowEvents();

  // Add Item Toggle & Confirm
  document.getElementById('btn-pm-add-checklist-toggle')?.addEventListener('click', () => {
    if (!addInlineBox) return;
    const isHidden = addInlineBox.style.display === 'none';
    addInlineBox.style.display = isHidden ? 'block' : 'none';
    if (isHidden && newChecklistInput) {
      newChecklistInput.value = '';
      newChecklistInput.focus({ preventScroll: true });
    }
  });

  document.getElementById('btn-pm-cancel-add-checklist')?.addEventListener('click', () => {
    if (addInlineBox) addInlineBox.style.display = 'none';
    if (newChecklistInput) newChecklistInput.value = '';
  });

  document.getElementById('btn-pm-confirm-add-checklist')?.addEventListener('click', () => {
    const newText = newChecklistInput?.value?.trim();
    if (!newText) {
      alert('Please enter text for the new checklist item.');
      newChecklistInput?.focus({ preventScroll: true });
      return;
    }
    const currentItems = getCurrentChecklistItems();
    currentItems.push(newText);
    try {
      preventiveMaintenanceService.updateChecklistForMachineType(targetMachineType, currentItems);
      renderChecklistRows(currentItems);
      if (addInlineBox) addInlineBox.style.display = 'none';
      if (newChecklistInput) newChecklistInput.value = '';
      notificationService.success(`Checklist item added to ${targetMachineType}`);
    } catch (err) {
      alert('Error adding checklist item: ' + err.message);
    }
  });

  newChecklistInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('btn-pm-confirm-add-checklist')?.click();
    } else if (e.key === 'Escape') {
      document.getElementById('btn-pm-cancel-add-checklist')?.click();
    }
  });

  // Check all checklist items
  document.getElementById('btn-pm-check-all')?.addEventListener('click', () => {
    document.querySelectorAll('.pm-checklist-item').forEach(cb => { cb.checked = true; });
  });

  // Clear selected machine button in modal
  document.getElementById('btn-pm-clear-selected-machine')?.addEventListener('click', (e) => {
    e.stopPropagation();
    modalMachineContext = null;
    rerenderView();
  });

  // Service date change strictly auto-updates Next Target Date from Admin Config frequency
  document.getElementById('pm-input-service-date')?.addEventListener('change', (e) => {
    const nextDateInput = document.getElementById('pm-input-next-date');
    if (nextDateInput && modalMachineContext) {
      const prof = preventiveMaintenanceService.getMachinePreventiveProfile(modalMachineContext);
      if (prof) {
        const freq = prof.frequencyDays || 90;
        nextDateInput.value = preventiveMaintenanceService.calculateNextServiceDate(e.target.value, freq);
      }
    }
  });

  // 1. Live Machine Search & Switcher inside Modal
  const machineSearchInput = document.getElementById('pm-modal-machine-search');
  const machineDropdown = document.getElementById('pm-modal-machine-dropdown');

  const updateMachineDropdown = (q = '') => {
    if (!machineDropdown) return;
    const machines = preventiveMaintenanceService.searchMachines(q, 15);
    if (machines.length === 0) {
      machineDropdown.style.display = 'block';
      machineDropdown.innerHTML = `<div style="padding: 12px; color: #94a3b8; font-size: 12px; text-align: center;">No machines found matching "${escapeHtml(q)}"</div>`;
      return;
    }
    machineDropdown.style.display = 'block';
    machineDropdown.innerHTML = machines.map(m => `
      <div class="pm-machine-suggest-item" data-id="${escapeHtml(m.machineId)}" data-serial="${escapeHtml(m.serialNumber)}" style="padding: 10px 14px; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.06); display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-family: monospace; font-weight: 800; color: #38bdf8; font-size: 13.5px;">${escapeHtml(m.serialNumber)}</span>
            <span style="font-size: 12px; color: #fff; font-weight: 700;">${escapeHtml(m.machineName)}</span>
          </div>
          <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">
            ${escapeHtml(m.brand)} ${escapeHtml(m.model)} &bull; 📍 ${escapeHtml(m.floor)} / ${escapeHtml(m.line)}
          </div>
        </div>
        <div style="text-align: right;">
          <span class="badge ${m.urgency?.badgeClass || 'badge-active'}" style="font-size: 10px;">${escapeHtml(m.urgency?.label || 'Scheduled')}</span>
          <div style="font-size: 10px; color: #fbbf24; font-family: monospace; margin-top: 2px;">🏷️ ${escapeHtml(m.serviceStickerSerial || 'Pending')}</div>
        </div>
      </div>
    `).join('');

    machineDropdown.querySelectorAll('.pm-machine-suggest-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const mId = item.getAttribute('data-id');
        modalMachineContext = mId;
        machineDropdown.style.display = 'none';
        rerenderView();
      });
    });
  };

  if (machineSearchInput) {
    machineSearchInput.addEventListener('focus', () => {
      if (modalMachineContext) {
        machineSearchInput.select();
      }
      updateMachineDropdown(machineSearchInput.value.split('—')[0].trim());
    });
    machineSearchInput.addEventListener('input', (e) => {
      updateMachineDropdown(e.target.value.trim());
    });
    machineSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const firstItem = machineDropdown?.querySelector('.pm-machine-suggest-item');
        if (firstItem) {
          firstItem.click();
        }
      }
    });
  }

  // 2. Smart Universal Manpower Autocomplete Search (Name, Card No, Designation, Dept, Location, Phone)
  const manpowerInput = document.getElementById('pm-input-manpower-search');
  const manpowerBox = document.getElementById('pm-manpower-suggestions');
  const badgeBox = document.getElementById('pm-manpower-auto-badge');

  const populateManpowerFields = (emp) => {
    if (!emp) return;
    if (manpowerInput) manpowerInput.value = `${emp.name} (${emp.cardNumber ? 'Card: ' + emp.cardNumber : emp.designation || 'Technician'})`;
    const nameHidden = document.getElementById('pm-manpower-name');
    if (nameHidden) nameHidden.value = emp.name;
    const cardHidden = document.getElementById('pm-manpower-card');
    if (cardHidden) cardHidden.value = emp.cardNumber || '';
    const desigHidden = document.getElementById('pm-manpower-designation');
    if (desigHidden) desigHidden.value = emp.designation || '';
    const deptHidden = document.getElementById('pm-manpower-dept');
    if (deptHidden) deptHidden.value = emp.department || 'Mechanical Maintenance';

    const bCard = document.getElementById('pm-badge-card');
    if (bCard) bCard.textContent = emp.cardNumber || 'N/A';
    const bDesig = document.getElementById('pm-badge-desig');
    if (bDesig) bDesig.textContent = emp.designation || '';
    const bDept = document.getElementById('pm-badge-dept');
    if (bDept) bDept.textContent = emp.department || '';

    if (badgeBox) badgeBox.style.display = 'flex';
    if (manpowerBox) manpowerBox.style.display = 'none';
  };

  const updateManpowerDropdown = (q = '') => {
    if (!manpowerBox) return;
    const suggestions = preventiveMaintenanceService.searchManpowerSuggestions(q);
    if (suggestions.length === 0) {
      manpowerBox.style.display = 'block';
      manpowerBox.innerHTML = `<div style="padding: 10px 12px; color: #94a3b8; font-size: 12px; text-align: center;">No technician found for "${escapeHtml(q)}"</div>`;
      return;
    }
    manpowerBox.style.display = 'block';
    manpowerBox.innerHTML = suggestions.map(s => {
      const areaOrFloor = s.workingArea || s.floorName || s.floor || '';
      return `
      <div class="pm-manpower-suggest-item" data-id="${escapeHtml(s.id || '')}" data-name="${escapeHtml(s.name)}" data-card="${escapeHtml(s.cardNumber || '')}" data-desig="${escapeHtml(s.designation || '')}" data-dept="${escapeHtml(s.department || '')}" data-area="${escapeHtml(areaOrFloor)}" style="padding: 9px 12px; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.06); display: flex; justify-content: space-between; align-items: center; transition: background 0.15s ease;">
        <div style="flex: 1; min-width: 0; padding-right: 8px;">
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <strong style="color: #fff; font-size: 13px;">${escapeHtml(s.name)}</strong> 
            <span style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; font-weight: 700; font-size: 11px; padding: 1px 6px; border-radius: 4px; font-family: monospace;">Card: ${escapeHtml(s.cardNumber || 'N/A')}</span>
            ${s.phone ? `<span style="color: #94a3b8; font-size: 11px;">📞 ${escapeHtml(s.phone)}</span>` : ''}
          </div>
          <div style="font-size: 11px; color: var(--text-secondary); margin-top: 3px; display: flex; gap: 6px; flex-wrap: wrap; align-items: center;">
            <span style="color: #10b981; font-weight: 600;">${escapeHtml(s.designation || 'Technician')}</span>
            <span style="color: #64748b;">&bull;</span>
            <span style="color: #cbd5e1;">${escapeHtml(s.department || 'Mechanical Maintenance')}</span>
            ${areaOrFloor ? `<span style="color: #64748b;">&bull;</span><span style="color: #fbbf24;">📍 ${escapeHtml(areaOrFloor)}</span>` : ''}
          </div>
        </div>
        <span class="badge badge-active" style="font-size: 10px; padding: 3px 8px; border-radius: 4px; background: #2563eb; color: #fff; flex-shrink: 0;">Select</span>
      </div>
      `;
    }).join('');

    manpowerBox.querySelectorAll('.pm-manpower-suggest-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const emp = {
          id: item.getAttribute('data-id'),
          name: item.getAttribute('data-name'),
          cardNumber: item.getAttribute('data-card'),
          designation: item.getAttribute('data-desig'),
          department: item.getAttribute('data-dept'),
          workingArea: item.getAttribute('data-area')
        };
        populateManpowerFields(emp);
      });
    });
  };

  const resolveTypedManpower = (q) => {
    if (!q) return;
    const suggestions = preventiveMaintenanceService.searchManpowerSuggestions(q);
    if (suggestions.length > 0) {
      const qNorm = q.trim().toLowerCase();
      const exactCardMatch = suggestions.find(s => String(s.cardNumber || '').trim().toLowerCase() === qNorm);
      const exactNameMatch = suggestions.find(s => (s.name || '').trim().toLowerCase() === qNorm);
      const chosen = exactCardMatch || exactNameMatch || (suggestions.length === 1 ? suggestions[0] : null);
      if (chosen) {
        populateManpowerFields(chosen);
      }
    }
  };

  if (manpowerInput) {
    manpowerInput.addEventListener('focus', () => {
      updateManpowerDropdown(manpowerInput.value.trim());
    });
    manpowerInput.addEventListener('input', (e) => {
      const q = e.target.value.trim();
      const nameHidden = document.getElementById('pm-manpower-name');
      if (nameHidden) nameHidden.value = q;

      if (!q) {
        const cardInput = document.getElementById('pm-manpower-card');
        const desigInput = document.getElementById('pm-manpower-designation');
        if (cardInput) cardInput.value = '';
        if (desigInput) desigInput.value = '';
        if (badgeBox) badgeBox.style.display = 'none';
      }
      updateManpowerDropdown(q);
    });
    manpowerInput.addEventListener('blur', () => {
      // Delay slightly so click on dropdown item can register first
      setTimeout(() => {
        resolveTypedManpower(manpowerInput.value.trim());
      }, 200);
    });
    manpowerInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        resolveTypedManpower(manpowerInput.value.trim());
        if (manpowerBox) manpowerBox.style.display = 'none';
      }
    });
  }

  // Dismiss dropdowns when clicking outside
  document.addEventListener('click', (e) => {
    if (machineDropdown && !machineDropdown.contains(e.target) && e.target !== machineSearchInput) {
      machineDropdown.style.display = 'none';
    }
    if (manpowerBox && !manpowerBox.contains(e.target) && e.target !== manpowerInput) {
      manpowerBox.style.display = 'none';
    }
  });

  // Submit Service Record
  document.getElementById('btn-pm-submit-service')?.addEventListener('click', () => {
    const prof = modalMachineContext ? preventiveMaintenanceService.getMachinePreventiveProfile(modalMachineContext) : null;
    if (!prof) {
      alert('Please search and select a machine first.');
      const searchInput = document.getElementById('pm-modal-machine-search');
      if (searchInput) {
        searchInput.focus({ preventScroll: true });
        updateMachineDropdown('');
      }
      return;
    }

    const sDate = document.getElementById('pm-input-service-date')?.value;
    const sType = document.getElementById('pm-input-service-type')?.value;
    const nDate = document.getElementById('pm-input-next-date')?.value;
    const sticker = document.getElementById('pm-input-sticker-serial')?.value?.trim();

    if (!sticker) {
      alert('Please enter the physical sticker serial number (e.g. 238168 or 245231) from the machine.');
      document.getElementById('pm-input-sticker-serial')?.focus({ preventScroll: true });
      return;
    }
    const mpName = document.getElementById('pm-manpower-name')?.value?.trim() || document.getElementById('pm-input-manpower-search')?.value?.trim();
    if (!mpName) {
      alert('Please enter the technician name or card number who performed the service.');
      document.getElementById('pm-input-manpower-search')?.focus({ preventScroll: true });
      return;
    }
    const mpCard = document.getElementById('pm-manpower-card')?.value?.trim() || '';
    const mpDesig = document.getElementById('pm-manpower-designation')?.value?.trim() || '';
    const mpDept = document.getElementById('pm-manpower-dept')?.value?.trim() || 'Mechanical Maintenance';
    const parts = document.getElementById('pm-input-parts-replaced')?.value;
    const remarks = document.getElementById('pm-input-remarks')?.value;

    const checklist = [];
    document.querySelectorAll('.pm-checklist-item').forEach(cb => {
      checklist.push({ item: cb.getAttribute('data-item'), checked: cb.checked, notes: cb.checked ? 'Passed' : 'Pending' });
    });

    try {
      preventiveMaintenanceService.createServiceEntry({
        machineId: prof.machineId,
        serialNumber: prof.serialNumber,
        serviceDate: sDate,
        serviceType: sType,
        serviceStickerSerial: sticker,
        servicedBy: mpName,
        servicedByCardNumber: mpCard,
        servicedByDesignation: mpDesig,
        servicedByDepartment: mpDept,
        assignedManpower: mpName,
        serviceChecklist: checklist,
        partsReplaced: parts,
        serviceRemarks: remarks
      });

      notificationService.success(`Preventive maintenance recorded for machine ${prof.serialNumber} [${sticker}].`);
      closeModal();
      activeTab = 'recently-serviced';
      rerenderView();
    } catch (err) {
      alert(err.message);
    }
  });

  // 2. Scanner Modal Events
  document.getElementById('btn-pm-close-scanner')?.addEventListener('click', () => closeModal());

  const scannerSubmit = () => {
    const txt = document.getElementById('pm-scanner-text-input')?.value.trim();
    if (txt) {
      let clean = txt;
      if (clean.includes('AL-MUSLIM-ERP://MC/')) clean = clean.split('AL-MUSLIM-ERP://MC/')[1];
      closeModal();
      selectMachineBySerial(clean);
    }
  };

  document.getElementById('btn-pm-scanner-submit')?.addEventListener('click', scannerSubmit);
  document.getElementById('pm-scanner-text-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') scannerSubmit();
  });

  // Camera activation emulation
  document.getElementById('btn-pm-start-camera')?.addEventListener('click', () => {
    const vid = document.getElementById('pm-qr-video');
    const pl = document.getElementById('pm-scanner-placeholder');
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then(stream => {
          if (vid) {
            vid.srcObject = stream;
            vid.style.display = 'block';
            if (pl) pl.style.display = 'none';
          }
        })
        .catch(() => {
          alert('Camera stream active or unavailable. You can also scan using your barcode reader gun or type the serial number.');
        });
    } else {
      alert('Camera access is not supported on this browser context. Handheld scanner gun & manual input is fully operational.');
    }
  });

  // 3. Print Sticker Modal Events
  document.getElementById('btn-pm-close-print')?.addEventListener('click', () => closeModal());
  document.getElementById('btn-pm-cancel-print')?.addEventListener('click', () => closeModal());
  document.getElementById('btn-pm-execute-print')?.addEventListener('click', () => {
    window.print();
  });

  // 4. Edit Sticker Serial Modal Events
  document.getElementById('btn-pm-close-edit-sticker')?.addEventListener('click', () => closeModal());
  document.getElementById('btn-pm-cancel-edit-sticker')?.addEventListener('click', () => closeModal());
  document.getElementById('btn-pm-save-edit-sticker')?.addEventListener('click', () => {
    const recId = document.getElementById('pm-edit-sticker-record-id')?.value;
    const newSticker = document.getElementById('pm-edit-sticker-input')?.value.trim();
    if (!newSticker) {
      alert('Sticker serial number cannot be blank.');
      return;
    }
    preventiveMaintenanceService.updateStickerSerial(recId, newSticker);
    notificationService.success(`Sticker serial updated to ${newSticker}.`);
    closeModal();
    rerenderView();
  });

  // 5. Config Modal Events
  document.getElementById('btn-pm-close-config-modal')?.addEventListener('click', () => closeModal());
  document.getElementById('btn-pm-cancel-config')?.addEventListener('click', () => closeModal());
  document.getElementById('btn-pm-save-config')?.addEventListener('click', () => {
    const cId = document.getElementById('pm-cfg-id')?.value;
    const mType = document.getElementById('pm-cfg-type')?.value.trim();
    const days = parseInt(document.getElementById('pm-cfg-days')?.value, 10) || 90;
    const dept = document.getElementById('pm-cfg-dept')?.value.trim();
    const checklistRaw = document.getElementById('pm-cfg-checklist')?.value || '';
    const checklist = checklistRaw.split('\n').map(x => x.trim()).filter(Boolean);

    if (!mType) {
      alert('Machine Type name is required.');
      return;
    }

    preventiveMaintenanceService.saveConfig({
      id: cId,
      machineType: mType,
      frequencyDays: days,
      frequencyLabel: `Every ${days} Days`,
      responsibleDepartment: dept,
      checklist
    });

    notificationService.success(`Schedule configuration for ${mType} saved.`);
    closeModal();
    rerenderView();
  });

  // 6. Replace Physical Sticker Modal Events (Purely Manual Entry)
  document.getElementById('btn-pm-close-replace-modal')?.addEventListener('click', () => closeModal());
  document.getElementById('btn-pm-cancel-replace-sticker')?.addEventListener('click', () => closeModal());
  document.getElementById('btn-pm-confirm-replace-sticker')?.addEventListener('click', () => {
    const newSerial = document.getElementById('pm-replace-new-serial')?.value.trim();
    const reason = document.getElementById('pm-replace-reason')?.value || 'Sticker replacement';
    if (!newSerial) {
      alert('Please enter the new physical sticker serial number (e.g. 238168 or 245231).');
      document.getElementById('pm-replace-new-serial')?.focus({ preventScroll: true });
      return;
    }
    if (!modalMachineContext) return;
    try {
      preventiveMaintenanceService.replaceMachineSticker(modalMachineContext, newSerial, reason);
      notificationService.success(`Physical sticker serial successfully updated to ${newSerial}.`);
      closeModal();
      rerenderView();
    } catch (err) {
      alert(err.message);
    }
  });

  // 7. Bulk Excel Modal Events
  document.getElementById('btn-pm-close-bulk-modal')?.addEventListener('click', () => {
    bulkExcelParsedRows = null;
    bulkExcelPreviewResult = null;
    closeModal();
  });
  document.getElementById('btn-pm-cancel-bulk-modal')?.addEventListener('click', () => {
    bulkExcelParsedRows = null;
    bulkExcelPreviewResult = null;
    closeModal();
  });
  document.getElementById('pm-bulk-excel-backdrop')?.addEventListener('click', (e) => {
    if (e.target.id === 'pm-bulk-excel-backdrop') {
      bulkExcelParsedRows = null;
      bulkExcelPreviewResult = null;
      closeModal();
    }
  });

  document.getElementById('btn-pm-modal-download-template')?.addEventListener('click', async () => {
    await preventiveMaintenanceService.exportScheduleConfigExcelTemplate();
  });

  const dropzone = document.getElementById('pm-bulk-excel-dropzone');
  const fileInp = document.getElementById('pm-bulk-excel-file-input');

  const handleBulkExcelFile = async (file) => {
    if (!file) return;
    try {
      const rows = await excelService.parseExcelFile(file);
      if (!rows || rows.length === 0) {
        alert('The uploaded Excel file has no data rows. Please use the pre-filled template.');
        return;
      }
      rows._fileName = file.name;
      bulkExcelParsedRows = rows;
      bulkExcelPreviewResult = preventiveMaintenanceService.previewBulkScheduleImport(rows);
      rerenderView();
    } catch (err) {
      console.error('Excel parse error:', err);
      alert('Failed to parse Excel file: ' + err.message);
    }
  };

  if (dropzone && fileInp) {
    dropzone.addEventListener('click', () => {
      fileInp.click();
    });

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.style.borderColor = '#38bdf8';
      dropzone.style.background = 'rgba(56, 189, 248, 0.12)';
    });

    dropzone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.style.borderColor = '#0284c7';
      dropzone.style.background = 'rgba(2, 132, 199, 0.04)';
    });

    dropzone.addEventListener('drop', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        await handleBulkExcelFile(files[0]);
      }
    });

    fileInp.addEventListener('change', async (e) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        await handleBulkExcelFile(files[0]);
      }
    });
  }

  document.getElementById('btn-pm-apply-bulk-import')?.addEventListener('click', () => {
    if (!bulkExcelPreviewResult || !bulkExcelPreviewResult.validRows || bulkExcelPreviewResult.validRows.length === 0) {
      alert('No valid rows found to apply.');
      return;
    }

    try {
      const res = preventiveMaintenanceService.applyBulkScheduleImport(bulkExcelPreviewResult.validRows);
      notificationService.success(
        `Bulk updated ${res.updatedConfigsCount} machine type intervals! Synchronized ${res.affectedMachinesCount} factory machines.`
      );
      bulkExcelParsedRows = null;
      bulkExcelPreviewResult = null;
      closeModal();
    } catch (err) {
      alert('Error applying bulk updates: ' + err.message);
    }
  });
}

function selectMachineBySerial(serialOrId) {
  const prof = preventiveMaintenanceService.getMachinePreventiveProfile(serialOrId);
  if (prof) {
    selectedMachineId = prof.machineId;
    activeTab = 'machine-profile';
    rerenderView();
  } else {
    alert(`Machine with Serial or ID "${serialOrId}" not found in ERP inventory.`);
  }
}

function closeModal() {
  activePmModal = null;
  modalMachineContext = null;
  modalServiceContext = null;

  const modalLayer = document.getElementById('pm-modal-layer');
  if (modalLayer) {
    modalLayer.innerHTML = '';
  } else {
    rerenderView();
  }
}

function rerenderView() {
  const container = document.getElementById('main-view-container');
  if (!container) return;

  const containerY = container.scrollTop;
  const containerX = container.scrollLeft;
  const pageView = container.querySelector('.page-view');
  const pageViewY = pageView ? pageView.scrollTop : 0;
  const pageViewX = pageView ? pageView.scrollLeft : 0;
  const tableWrap = container.querySelector('.table-responsive, .pm-table-container, .pm-table-wrapper');
  const tableY = tableWrap ? tableWrap.scrollTop : 0;
  const tableX = tableWrap ? tableWrap.scrollLeft : 0;
  const winY = window.scrollY || document.documentElement.scrollTop || 0;
  const winX = window.scrollX || document.documentElement.scrollLeft || 0;

  container.innerHTML = renderPreventiveMaintenanceView();
  initPreventiveMaintenanceEvents();

  const restore = () => {
    container.scrollTop = containerY;
    container.scrollLeft = containerX;
    const newPv = container.querySelector('.page-view');
    if (newPv) {
      newPv.scrollTop = pageViewY;
      newPv.scrollLeft = pageViewX;
    }
    const newTw = container.querySelector('.table-responsive, .pm-table-container, .pm-table-wrapper');
    if (newTw) {
      newTw.scrollTop = tableY;
      newTw.scrollLeft = tableX;
    }
    if (winY > 0 || winX > 0) {
      window.scrollTo({ top: winY, left: winX, behavior: 'instant' });
    }
  };

  restore();
  requestAnimationFrame(restore);
}

function exportMaintenanceToExcel() {
  try {
    if (typeof XLSX === 'undefined') {
      alert('Excel export library is loading, please try again in a moment.');
      return;
    }

    const activeFilters = {
      search: searchQuery,
      floorId: filterFloorId,
      lineId: filterLineId,
      machineType: filterMachineType,
      urgencyStatus: filterUrgency
    };
    const data = preventiveMaintenanceService.getAllMachinesWithMaintenance(activeFilters);
    const rows = data.map((m, idx) => ({
      'SL': idx + 1,
      'Machine Serial': m.serialNumber,
      'Machine Name': m.machineName,
      'Machine Type': m.machineType,
      'Model': m.model,
      'Brand': m.brand,
      'Floor': m.floor,
      'Line': m.line,
      'Working Area': m.workingArea,
      'Last Service Date': m.lastServiceDate ? formatDisplayDate(m.lastServiceDate) : 'N/A',
      'Next Service Date': m.nextServiceDate ? formatDisplayDate(m.nextServiceDate) : 'N/A',
      'Urgency Status': m.urgency.label,
      'Frequency': m.frequencyLabel,
      'Service Sticker': m.serviceStickerSerial || 'N/A',
      'Assigned Manpower': m.assignedManpower || 'Unassigned',
      'Machine Status': m.machineStatus
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Preventive Maintenance');
    XLSX.writeFile(wb, `Al_Muslim_Preventive_Maintenance_${new Date().toISOString().split('T')[0]}.xlsx`);
    if (typeof notificationService !== 'undefined' && notificationService.success) {
      notificationService.success(`Preventive maintenance report exported (${rows.length} machines).`);
    } else {
      alert(`Preventive maintenance report exported successfully (${rows.length} machines).`);
    }
  } catch (err) {
    console.error('Export error:', err);
    alert('Failed to export Excel report: ' + err.message);
  }
}

function escapeHtml(str) {
  if (str === undefined || str === null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
