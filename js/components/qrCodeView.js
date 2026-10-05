/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * QR Code & Label Studio Component
 * Enterprise Machine QR Tags, Location Placards (Unit + Floor) & A4 Sticker Sheet Designer
 */

import { storage } from '../db/storage.js';
import { TABLE_NAMES } from '../db/schema.js';
import { masterDataService } from '../services/masterDataService.js';
import { qrCodeService } from '../services/qrCodeService.js';
import { notificationService } from '../services/notificationService.js';
import { state } from '../state.js';

let activeStudioTab = 'machine'; // 'machine' | 'location'
let selectedMachineIds = new Set();
let qrFilters = {
  unitId: '',
  floorId: '',
  lineId: '',
  machineNameId: '',
  brandId: '',
  qrStatus: 'ALL',
  search: ''
};

// Pagination & Performance Settings
let qrPagination = {
  page: 1,
  pageSize: 24 // 12 | 24 | 48 | 96 | 0 (All)
};
let qrRenderToken = 0;
let searchDebounceTimer = null;

// Print / Layout Settings
let printSettings = {
  qrSize: 'medium', // 'small' (32mm) | 'medium' (44mm) | 'large' (56mm)
  colsPerRow: 3,    // 2 | 3 | 4
  labelsPerPage: 12,// 8 | 12 | 16 | 24
  showHeader: true,
  showLocation: true,
  showCuttingBorders: true
};

let labelDesignerModalOpen = false;
let tempLabelConfig = null;

export function renderQrCodeView() {
  const allMachines = storage.getTable(TABLE_NAMES.MACHINES) || [];
  const locationQrs = qrCodeService.getAllLocationQrs();

  // Filter machines
  const filteredMachines = filterMachines(allMachines);

  // Active status counts
  const totalMachinesCount = allMachines.length;
  const activeQrCount = allMachines.filter(m => m.qrStatus !== 'INACTIVE').length;

  const units = masterDataService.getUnits();
  const floors = qrFilters.unitId ? masterDataService.getFloors(qrFilters.unitId) : masterDataService.getFloors();
  let lines = [];
  if (qrFilters.floorId) {
    lines = masterDataService.getLines(qrFilters.floorId);
  } else if (qrFilters.unitId) {
    const unitFloors = masterDataService.getFloors(qrFilters.unitId);
    lines = unitFloors.flatMap(f => masterDataService.getLines(f.id));
  } else {
    lines = masterDataService.getLines();
  }
  const machineNames = masterDataService.getMachineNames();
  const brands = masterDataService.getBrands();

  return `
    <div class="page-view qr-studio-root" id="qr-studio-root">
      
      <!-- Studio Header Bar (Compact & Space Efficient) -->
      <div class="qr-studio-header-card">
        <div class="qr-header-left">
          <div class="qr-header-icon">🏷️</div>
          <div>
            <h1 class="qr-header-title">QR Code &amp; Label Studio</h1>
            <div class="qr-header-subtitle">
              Asset Tags &bull; Location Placards &bull; A4 Sheet Designer
            </div>
          </div>
          <div class="qr-studio-tabs">
            <button type="button" class="btn-studio-tab ${activeStudioTab === 'machine' ? 'active' : ''}" data-tab="machine">
              🏷️ Machine QR Tags (<span id="tab-badge-machine-count">${filteredMachines.length}</span>)
            </button>
            <button type="button" class="btn-studio-tab ${activeStudioTab === 'location' ? 'active' : ''}" data-tab="location">
              📍 Location Placards (${locationQrs.length})
            </button>
          </div>
        </div>

        <!-- Metric Badges -->
        <div class="qr-header-metrics">
          <div class="qr-metric-pill" title="Total machines registered in inventory">
            <span class="qr-metric-label">Total:</span>
            <span class="qr-metric-val">${totalMachinesCount}</span>
          </div>
          <div class="qr-metric-pill active" title="Active QR codes ready for scanning">
            <span class="qr-metric-label">Active:</span>
            <span class="qr-metric-val text-success">${activeQrCount}</span>
          </div>
          <div class="qr-metric-pill location" title="Registered location checkpoint QR codes">
            <span class="qr-metric-label">Locations:</span>
            <span class="qr-metric-val text-cyan">${locationQrs.length}</span>
          </div>
        </div>
      </div>

      <!-- Tab Content Area -->
      <div class="qr-studio-content-area">
        ${activeStudioTab === 'machine' ? renderMachineQrTab(filteredMachines, units, floors, lines, machineNames, brands) : renderLocationQrTab(locationQrs)}
      </div>

      <!-- Hidden Print Container specifically targeted by CSS @media print -->
      <div id="qr-print-container" class="qr-print-container" style="display: none;"></div>

      ${renderLabelDesignerModal()}

    </div>

    <!-- Scoped Styles for Studio & A4 Sticker Printing -->
    <style>
      .qr-studio-root {
        padding: 8px 12px 24px 12px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        height: 100%;
        overflow-y: auto;
        box-sizing: border-box;
      }

      .qr-studio-header-card {
        background: var(--bg-surface);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-md);
        padding: 6px 12px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
        min-height: 40px;
      }

      .qr-header-left {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }

      .qr-header-icon {
        font-size: 18px;
        width: 30px;
        height: 30px;
        border-radius: 6px;
        background: rgba(56, 189, 248, 0.12);
        border: 1px solid #38bdf8;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .qr-header-title {
        font-size: 14px;
        font-weight: 800;
        color: #fff;
        margin: 0;
        line-height: 1.1;
      }

      .qr-header-subtitle {
        font-size: 10.5px;
        color: #38bdf8;
        margin-top: 1px;
      }

      .qr-header-metrics {
        display: flex;
        gap: 6px;
        align-items: center;
        flex-wrap: wrap;
      }

      .qr-metric-pill {
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.1);
        padding: 2px 7px;
        border-radius: 4px;
        font-size: 11px;
        display: flex;
        gap: 4px;
        align-items: center;
      }

      .qr-metric-label {
        color: var(--text-muted);
      }

      .qr-metric-val {
        font-weight: 800;
        color: #fff;
      }

      .qr-studio-tabs {
        display: flex;
        gap: 4px;
        align-items: center;
      }

      .btn-studio-tab {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.12);
        color: var(--text-secondary);
        font-weight: 700;
        font-size: 11px;
        padding: 4px 10px;
        border-radius: 14px;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .btn-studio-tab:hover {
        background: rgba(255, 255, 255, 0.12);
        color: #fff;
      }

      .btn-studio-tab.active {
        background: #0284c7;
        border-color: #38bdf8;
        color: #fff;
        box-shadow: 0 2px 6px rgba(2, 132, 199, 0.4);
      }

      .qr-studio-content-area {
        display: flex;
        flex-direction: column;
        gap: 8px;
        flex: 1;
        min-height: 0;
      }

      /* Compact Control Toolbar */
      .qr-toolbar-card {
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-md);
        padding: 8px 12px;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .qr-filters-row {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
        gap: 6px;
        align-items: center;
      }

      .qr-actions-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 6px;
        border-top: 1px solid rgba(255, 255, 255, 0.06);
        padding-top: 6px;
      }

      .qr-print-settings-bar {
        display: flex;
        gap: 6px;
        align-items: center;
        flex-wrap: wrap;
        font-size: 11px;
        color: var(--text-secondary);
        background: rgba(0, 0, 0, 0.25);
        padding: 3px 8px;
        border-radius: 4px;
        border: 1px solid rgba(255, 255, 255, 0.06);
      }

      /* Label Grid */
      .qr-labels-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 10px;
        overflow-y: auto;
        padding-bottom: 16px;
      }

      /* Individual Sticker Label Card */
      .qr-sticker-card {
        background: #ffffff;
        color: #0f172a;
        border-radius: 8px;
        padding: 9px 11px;
        display: flex;
        flex-direction: column;
        gap: 5px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.35);
        border: 2px solid #e2e8f0;
        position: relative;
        box-sizing: border-box;
        transition: transform 0.15s ease, box-shadow 0.15s ease;
      }

      .qr-sticker-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 20px rgba(0,0,0,0.45);
        border-color: #38bdf8;
      }

      .qr-sticker-card.inactive {
        opacity: 0.6;
      }

      .qr-sticker-top-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 6px;
        border-bottom: 1.5px solid #0f172a;
        padding-bottom: 4px;
      }

      .qr-sticker-company {
        font-size: 10.5px;
        font-weight: 900;
        color: #0f172a;
        letter-spacing: 0.2px;
        text-transform: uppercase;
      }

      .qr-sticker-body {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 1;
        min-height: 0;
      }

      .qr-sticker-body.layout-left {
        flex-direction: row;
      }
      .qr-sticker-body.layout-right {
        flex-direction: row-reverse;
      }
      .qr-sticker-body.layout-top {
        flex-direction: column;
        text-align: center;
      }
      .qr-sticker-body.layout-qr-only {
        flex-direction: column;
        align-items: center;
        justify-content: center;
      }

      .qr-canvas-holder {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        background: #fff;
        padding: 2px;
        box-sizing: border-box;
      }

      .qr-canvas-holder img,
      .qr-canvas-holder canvas {
        width: 100% !important;
        height: 100% !important;
        display: block;
      }

      .qr-sticker-info {
        display: flex;
        flex-direction: column;
        gap: 1.5px;
        flex: 1;
        min-width: 0;
        line-height: 1.25;
      }

      .qr-mid-badge {
        font-family: var(--font-mono);
        font-size: 11.5px;
        font-weight: 900;
        color: #0284c7;
        letter-spacing: 0.2px;
      }

      .qr-sn-text {
        font-weight: 800;
        color: #0f172a;
        font-size: 11px;
      }

      .qr-mach-name {
        font-weight: 700;
        color: #1e293b;
        font-size: 10.5px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .qr-mach-spec {
        font-size: 10px;
        color: #475569;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .qr-mach-location {
        font-size: 9.5px;
        color: #64748b;
        border-top: 1px solid #e2e8f0;
        padding-top: 2px;
        margin-top: 2px;
        line-height: 1.2;
      }

      .qr-sticker-footer-actions {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-top: 1px dashed rgba(0,0,0,0.15);
        padding-top: 4px;
        margin-top: auto;
      }

      /* Compact Pagination Bar Styles */
      .qr-pagination-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-md);
        padding: 5px 12px;
        font-size: 11.5px;
        color: var(--text-secondary);
      }

      .qr-pagination-nav {
        display: flex;
        align-items: center;
        gap: 3px;
      }

      .btn-qr-page {
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.12);
        color: #fff;
        padding: 3px 8px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .btn-qr-page:hover:not(:disabled) {
        background: #0284c7;
        border-color: #38bdf8;
      }

      .btn-qr-page:disabled {
        opacity: 0.35;
        cursor: not-allowed;
      }

      .qr-sticker-card.selected {
        border-color: #38bdf8 !important;
        box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.45), 0 8px 20px rgba(0,0,0,0.5) !important;
      }
    </style>
  `;
}

/**
 * Filter helper for machines
 */
function filterMachines(allMachines) {
  return allMachines.filter(m => {
    if (!m) return false;
    if (qrFilters.unitId && m.unitId !== qrFilters.unitId) return false;
    if (qrFilters.floorId && m.floorId !== qrFilters.floorId) return false;
    if (qrFilters.lineId && m.lineId !== qrFilters.lineId) return false;
    if (qrFilters.machineNameId && m.machineNameId !== qrFilters.machineNameId) return false;
    if (qrFilters.brandId && m.brandId !== qrFilters.brandId) return false;
    if (qrFilters.qrStatus !== 'ALL') {
      const isInactive = m.qrStatus === 'INACTIVE';
      if (qrFilters.qrStatus === 'INACTIVE' && !isInactive) return false;
      if (qrFilters.qrStatus === 'ACTIVE' && isInactive) return false;
    }
    if (qrFilters.search) {
      const q = qrFilters.search.toLowerCase();
      const sn = (m.serialNumber || '').toLowerCase();
      const permId = (m.permanentMachineId || '').toLowerCase();
      const id = (m.id || '').toLowerCase();
      if (!sn.includes(q) && !permId.includes(q) && !id.includes(q)) return false;
    }
    return true;
  });
}

// ─────────────────────────────────────────────────────────────
// 1. MACHINE QR TAB
// ─────────────────────────────────────────────────────────────
function renderMachineQrTab(filteredMachines, units, floors, lines, machineNames, brands) {
  const totalFiltered = filteredMachines.length;
  const pageSize = qrPagination.pageSize > 0 ? qrPagination.pageSize : totalFiltered;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / (pageSize || 1)));
  if (qrPagination.page > totalPages) qrPagination.page = totalPages;
  if (qrPagination.page < 1) qrPagination.page = 1;

  const startIndex = (qrPagination.page - 1) * pageSize;
  const pageMachines = filteredMachines.slice(startIndex, startIndex + (pageSize || totalFiltered));

  return `
    <div class="qr-toolbar-card">
      
      <!-- Multi-attribute Filters (Compact Single Row) -->
      <div class="qr-filters-row">
        <div>
          <select id="qr-filter-unit" class="form-control" style="font-size: 11.5px; padding: 3px 6px; height: 30px;">
            <option value="">All Units</option>
            ${units.map(u => `<option value="${u.id}" ${u.id === qrFilters.unitId ? 'selected' : ''}>${u.name}</option>`).join('')}
          </select>
        </div>

        <div>
          <select id="qr-filter-floor" class="form-control" style="font-size: 11.5px; padding: 3px 6px; height: 30px;">
            <option value="">All Floors</option>
            ${floors.map(f => `<option value="${f.id}" ${f.id === qrFilters.floorId ? 'selected' : ''}>${f.name}</option>`).join('')}
          </select>
        </div>

        <div>
          <select id="qr-filter-line" class="form-control" style="font-size: 11.5px; padding: 3px 6px; height: 30px;">
            <option value="">All Lines</option>
            ${lines.map(l => `<option value="${l.id}" ${l.id === qrFilters.lineId ? 'selected' : ''}>${l.name}</option>`).join('')}
          </select>
        </div>

        <div>
          <select id="qr-filter-name" class="form-control" style="font-size: 11.5px; padding: 3px 6px; height: 30px;">
            <option value="">All Machine Names</option>
            ${machineNames.map(mn => `<option value="${mn.id}" ${mn.id === qrFilters.machineNameId ? 'selected' : ''}>${mn.name}</option>`).join('')}
          </select>
        </div>

        <div>
          <select id="qr-filter-status" class="form-control" style="font-size: 11.5px; padding: 3px 6px; height: 30px;">
            <option value="ALL" ${qrFilters.qrStatus === 'ALL' ? 'selected' : ''}>Status: All</option>
            <option value="ACTIVE" ${qrFilters.qrStatus === 'ACTIVE' ? 'selected' : ''}>Status: Active</option>
            <option value="INACTIVE" ${qrFilters.qrStatus === 'INACTIVE' ? 'selected' : ''}>Status: Inactive</option>
          </select>
        </div>

        <div>
          <input
            type="text"
            id="qr-search-input"
            class="form-control"
            placeholder="Search Serial, MID, Name..."
            value="${qrFilters.search}"
            style="font-size: 11.5px; padding: 3px 8px; height: 30px;"
          />
        </div>
      </div>

      <!-- Compact Actions & Layout Settings Bar -->
      <div class="qr-actions-row">
        
        <!-- Selection counter & helpers -->
        <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
          <label style="display: flex; align-items: center; gap: 5px; font-size: 11.5px; color: #fff; cursor: pointer; margin: 0;">
            <input type="checkbox" id="qr-select-page-check" style="accent-color: #38bdf8;" />
            <span>Select Page (${pageMachines.length})</span>
          </label>
          <button type="button" id="btn-select-all-filtered" class="btn btn-ghost btn-xs" style="font-size: 10.5px; padding: 2px 6px; color: #38bdf8; border: 1px dashed rgba(56,189,248,0.4);" title="Select all machines matching current filters across all pages">
            Select All (${totalFiltered})
          </button>
          <button type="button" id="btn-clear-selection" class="btn btn-ghost btn-xs" style="font-size: 10.5px; padding: 2px 5px; color: #94a3b8;" title="Clear selection">
            Clear
          </button>
          <span id="qr-selected-count-pill" class="badge badge-info" style="font-size: 10.5px; font-weight: 700; padding: 2px 6px;">
            ${selectedMachineIds.size} Selected
          </span>
        </div>

        <!-- A4 Print Layout Controls -->
        <div class="qr-print-settings-bar">
          <span style="font-weight: 700; color: #cbd5e1;">📐 Layout:</span>
          
          <label style="display: flex; align-items: center; gap: 3px;">
            Size:
            <select id="qr-set-size" style="background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.15); color: #fff; font-size: 11px; padding: 1px 4px; border-radius: 4px; height: 24px;">
              <option value="small" ${printSettings.qrSize === 'small' ? 'selected' : ''}>Small (32mm)</option>
              <option value="medium" ${printSettings.qrSize === 'medium' ? 'selected' : ''}>Medium (44mm)</option>
              <option value="large" ${printSettings.qrSize === 'large' ? 'selected' : ''}>Large (56mm)</option>
            </select>
          </label>

          <label style="display: flex; align-items: center; gap: 3px;">
            Cols:
            <select id="qr-set-per-row" style="background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.15); color: #fff; font-size: 11px; padding: 1px 4px; border-radius: 4px; height: 24px;">
              <option value="2" ${printSettings.colsPerRow === 2 ? 'selected' : ''}>2 cols</option>
              <option value="3" ${printSettings.colsPerRow === 3 ? 'selected' : ''}>3 cols</option>
              <option value="4" ${printSettings.colsPerRow === 4 ? 'selected' : ''}>4 cols</option>
            </select>
          </label>

          <label style="display: flex; align-items: center; gap: 3px;">
            Page:
            <select id="qr-set-per-page" style="background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.15); color: #fff; font-size: 11px; padding: 1px 4px; border-radius: 4px; height: 24px;">
              <option value="8" ${printSettings.labelsPerPage === 8 ? 'selected' : ''}>8 labels</option>
              <option value="12" ${printSettings.labelsPerPage === 12 ? 'selected' : ''}>12 labels</option>
              <option value="16" ${printSettings.labelsPerPage === 16 ? 'selected' : ''}>16 labels</option>
              <option value="24" ${printSettings.labelsPerPage === 24 ? 'selected' : ''}>24 labels</option>
            </select>
          </label>
        </div>

        <!-- Primary Generation & Print Actions -->
        <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
          <button type="button" id="btn-open-label-designer" class="btn btn-secondary btn-sm" style="font-weight: 800; font-size: 11.5px; padding: 4px 10px; height: 28px; border: 1.5px solid #38bdf8; color: #38bdf8; background: rgba(56, 189, 248, 0.12); display: flex; align-items: center; gap: 5px;">
            ⚙️ Label Designer
          </button>
          <button type="button" id="btn-qr-bulk-generate" class="btn btn-secondary btn-sm" style="font-weight: 700; font-size: 11.5px; padding: 4px 10px; height: 28px; border-color: rgba(56, 189, 248, 0.4);">
            ⚡ Bulk Generate
          </button>
          <button type="button" id="btn-qr-print-a4" class="btn btn-primary btn-sm" style="font-weight: 800; font-size: 11.5px; padding: 4px 12px; height: 28px; background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); border: 1px solid #38bdf8; box-shadow: 0 2px 6px rgba(2, 132, 199, 0.4);">
            🖨️ A4 Print Label Sheet
          </button>
        </div>

      </div>

    </div>

    <!-- Slim Top Summary Bar -->
    <div class="qr-pagination-bar" id="qr-pagination-top" style="padding: 4px 12px; min-height: 26px; font-size: 11.5px;">
      ${renderPaginationBarInnerHtml(totalFiltered, qrPagination.page, totalPages, startIndex, pageMachines.length, qrPagination.pageSize)}
    </div>

    <!-- Live Preview Grid of Machine QR Labels -->
    <div class="qr-labels-grid" id="qr-machine-cards-grid">
      ${renderCardsListHtml(pageMachines)}
    </div>

    <!-- Bottom Pagination Bar -->
    <div class="qr-pagination-bar" id="qr-pagination-bottom">
      ${renderPaginationBarInnerHtml(totalFiltered, qrPagination.page, totalPages, startIndex, pageMachines.length, qrPagination.pageSize)}
    </div>
  `;
}

function renderPaginationBarInnerHtml(totalFiltered, page, totalPages, startIndex, pageCount, pageSize) {
  if (totalFiltered === 0) {
    return `
      <div>Showing 0 of 0 machines</div>
      <div style="color: var(--text-muted);">No machines matching current filter criteria.</div>
    `;
  }

  const endRange = Math.min(startIndex + pageCount, totalFiltered);

  return `
    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
      <span>Showing <strong style="color: #fff;">${startIndex + 1} - ${endRange}</strong> of <strong style="color: #38bdf8;">${totalFiltered}</strong> machines</span>
      <span style="color: rgba(255,255,255,0.2);">|</span>
      <label style="display: flex; align-items: center; gap: 4px; font-size: 11.5px;">
        Show:
        <select class="qr-page-size-select" style="background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.15); color: #fff; font-size: 11px; padding: 2px 6px; border-radius: 4px;">
          <option value="12" ${pageSize === 12 ? 'selected' : ''}>12 / page</option>
          <option value="24" ${pageSize === 24 ? 'selected' : ''}>24 / page</option>
          <option value="48" ${pageSize === 48 ? 'selected' : ''}>48 / page</option>
          <option value="96" ${pageSize === 96 ? 'selected' : ''}>96 / page</option>
          <option value="0" ${pageSize === 0 ? 'selected' : ''}>All (${totalFiltered})</option>
        </select>
      </label>
    </div>

    <div class="qr-pagination-nav">
      <button type="button" class="btn-qr-page" data-page="1" ${page <= 1 ? 'disabled' : ''} title="First Page">« First</button>
      <button type="button" class="btn-qr-page" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''} title="Previous Page">‹ Prev</button>
      <span style="font-weight: 700; color: #fff; padding: 0 6px; font-size: 11.5px;">Page ${page} of ${totalPages}</span>
      <button type="button" class="btn-qr-page" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''} title="Next Page">Next ›</button>
      <button type="button" class="btn-qr-page" data-page="${totalPages}" ${page >= totalPages ? 'disabled' : ''} title="Last Page">Last »</button>
    </div>
  `;
}

/**
 * Resolves the top-right Floor / Location Tag string based on admin label configuration
 */
function resolveStickerLocationTag(d, cfg) {
  if (!cfg || cfg.showLocationTag === false) return '';
  if (cfg.locationTagMode === 'custom' && cfg.customLocationTag && String(cfg.customLocationTag).trim()) {
    return String(cfg.customLocationTag).trim().toUpperCase();
  }
  if (cfg.locationTagMode === 'floor_only') {
    return String(d.floorName || '').replace(/floor/gi, '').replace(/[^a-zA-Z0-9]/g, '').trim().toUpperCase() || 'FLOOR';
  }
  if (cfg.locationTagMode === 'unit_only') {
    return String(d.unitName || '').split(/\s+/)[0].replace(/[^a-zA-Z0-9]/g, '').toUpperCase() || 'UNIT';
  }
  return d.locationTag || '';
}

function renderCardsListHtml(pageMachines) {
  if (!pageMachines || pageMachines.length === 0) {
    return `
      <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: var(--text-muted);">
        <div style="font-size: 36px; margin-bottom: 8px;">🏷️</div>
        <div style="font-size: 14px; font-weight: 700; color: #fff;">No matching machines found</div>
        <div style="font-size: 12px; margin-top: 4px;">Adjust your filters or search term above.</div>
      </div>
    `;
  }

  return pageMachines.map(m => {
    const d = qrCodeService.getMachineQrDetails(m);
    const cfg = qrCodeService.getLabelConfig();
    const isSelected = selectedMachineIds.has(m.id);
    const isInactive = d.qrStatus === 'INACTIVE';
    const tagText = resolveStickerLocationTag(d, cfg);

    const isRight = cfg.qrPosition === 'right';
    const isTop = cfg.qrPosition === 'top';
    const isQrOnly = cfg.qrPosition === 'qr_only';

    let bodyLayoutClass = 'layout-left';
    if (isRight) bodyLayoutClass = 'layout-right';
    else if (isTop) bodyLayoutClass = 'layout-top';
    else if (isQrOnly) bodyLayoutClass = 'layout-qr-only';

    const qrPx = parseInt(cfg.qrSize, 10) || 86;

    return `
      <div class="qr-sticker-card ${isInactive ? 'inactive' : ''} ${isSelected ? 'selected' : ''}" data-id="${m.id}" data-payload="${d.payload}">
        
        <!-- Sticker Top Header -->
        <div class="qr-sticker-top-row">
          <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; margin: 0; min-width: 0; flex: 1;">
            <input type="checkbox" class="qr-card-check" data-id="${m.id}" ${isSelected ? 'checked' : ''} style="accent-color: #0284c7; flex-shrink: 0;" />
            ${cfg.showCompany ? `<span class="qr-sticker-company" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${cfg.companyName || 'AL-MUSLIM GROUP'}</span>` : ''}
          </label>
          <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
            ${tagText ? `<span class="qr-sticker-loc-tag" style="font-weight: 900; font-size: 11px; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.5px;" title="Floor Tag: ${tagText}">${tagText}</span>` : ''}
            ${cfg.showTagStatus ? `
              <span class="badge ${isInactive ? 'badge-danger' : 'badge-active'}" style="font-size: 9px; padding: 1px 5px; font-weight: 800;">
                ${d.qrStatus}
              </span>
            ` : ''}
          </div>
        </div>

        <!-- Sticker Center (QR Code & Machine Data dynamically ordered) -->
        <div class="qr-sticker-body ${bodyLayoutClass}">
          <div class="qr-canvas-holder" id="qr-holder-${m.id}" data-payload="${d.payload}" style="width: ${qrPx}px; height: ${qrPx}px;"></div>

          ${!isQrOnly ? `
            <div class="qr-sticker-info" style="font-size: ${cfg.fontSize === 'large' ? '12.5px' : (cfg.fontSize === 'small' ? '10px' : '11px')};">
              ${cfg.showPermanentId ? `<span class="qr-mid-badge">${d.permanentMachineId}</span>` : ''}
              ${cfg.showSerialNumber ? `<span class="qr-sn-text">SN: ${d.serialNumber}</span>` : ''}
              ${cfg.showMachineName ? `<span class="qr-mach-name" title="${d.machineName}">${d.machineName}</span>` : ''}
              ${cfg.showBrandModel ? `<span class="qr-mach-spec">${d.brand} &bull; ${d.model}</span>` : ''}
              ${cfg.showNeedleQuantity && (m.needleQuantity || m.customValues?.needle_quantity) ? `
                <span style="font-size: 10px; color: #38bdf8; font-weight: 700;">Needles: ${m.needleQuantity || m.customValues?.needle_quantity}</span>
              ` : ''}
              ${cfg.showLocation ? `
                <div class="qr-mach-location">
                  📍 ${d.unitName} &bull; ${d.floorName} &bull; ${d.lineName}
                </div>
              ` : ''}
            </div>
          ` : `
            <div style="font-family: var(--font-mono); font-size: 11px; font-weight: 900; color: #38bdf8; text-align: center;">
              ${d.permanentMachineId}
            </div>
          `}
        </div>

        ${cfg.showFooter && cfg.footerText ? `
          <div style="font-size: 9px; color: var(--text-muted); border-top: 1px dashed rgba(255,255,255,0.08); padding-top: 3px; text-align: center; margin-top: 2px;">
            ${cfg.footerText}
          </div>
        ` : ''}

        <!-- Sticker Card Footer Controls -->
        <div class="qr-sticker-footer-actions">
          <div style="font-size: 9.5px; color: #64748b;">
            ${d.qrReprintCount > 0 ? `Reprints: ${d.qrReprintCount}` : 'Tag Ready'}
          </div>
          <div style="display: flex; gap: 4px;">
            <button type="button" class="btn btn-ghost btn-xs btn-qr-toggle-status" data-id="${m.id}" data-status="${d.qrStatus}" style="color: ${isInactive ? '#059669' : '#dc2626'}; padding: 2px 6px; font-size: 10.5px; font-weight: 700;">
              ${isInactive ? 'Activate' : 'Deactivate'}
            </button>
            <button type="button" class="btn btn-secondary btn-xs btn-qr-single-print" data-id="${m.id}" style="padding: 2px 8px; font-size: 10.5px; font-weight: 700; color: #0284c7; border-color: #0284c7;">
              🖨️ Print
            </button>
          </div>
        </div>

      </div>
    `;
  }).join('');
}

// ─────────────────────────────────────────────────────────────
// 2. LOCATION QR TAB (Unit + Floor Placards e.g. AKM-TISTA)
// ─────────────────────────────────────────────────────────────
function renderLocationQrTab(locationQrs) {
  return `
    <div class="qr-toolbar-card">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
        <div>
          <h2 style="font-size: 15px; font-weight: 800; color: #fff; margin: 0;">
            📍 Location QR Checkpoints (${locationQrs.length} Floors)
          </h2>
          <div style="font-size: 11.5px; color: var(--text-secondary); margin-top: 2px;">
            Place these QR placards at factory entrance pillars or floor walls. Scanning automatically selects the Unit &amp; Floor during Relocate.
          </div>
        </div>

        <button type="button" id="btn-print-all-locations" class="btn btn-primary btn-sm" style="font-weight: 800; font-size: 12px; padding: 6px 14px; background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); border: 1px solid #38bdf8;">
          🖨️ Print All Location Placards
        </button>
      </div>
    </div>

    <!-- Location Placard Cards Grid -->
    <div class="location-placards-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr)); gap: 14px; overflow-y: auto;">
      ${locationQrs.map((loc, idx) => `
        <div class="location-placard-card" style="background: #ffffff; color: #0f172a; border: 2.5px solid #0f172a; border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 10px; box-shadow: 0 4px 14px rgba(0,0,0,0.3);">
          
          <!-- Placard Header -->
          <div style="text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 6px;">
            <div style="font-size: 11px; font-weight: 900; letter-spacing: 1px; color: #0284c7; text-transform: uppercase;">
              AL-MUSLIM GROUP &bull; MAINTENANCE ERP
            </div>
            <div style="font-size: 20px; font-weight: 900; color: #0f172a; margin-top: 2px; letter-spacing: 0.5px;">
              ${loc.locationTag}
            </div>
          </div>

          <!-- Placard Center (Big QR Code) -->
          <div style="display: flex; gap: 14px; align-items: center; justify-content: center; padding: 6px 0;">
            <div class="qr-canvas-holder" id="qr-loc-holder-${idx}" data-payload="${loc.payload}" style="width: 120px; height: 120px; border: 2px solid #0f172a;"></div>
            
            <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px;">
              <div style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 700;">Factory Unit</div>
              <div style="font-size: 14px; font-weight: 800; color: #0f172a;">${loc.unitName}</div>

              <div style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 700; margin-top: 4px;">Floor</div>
              <div style="font-size: 14px; font-weight: 800; color: #0284c7;">${loc.floorName}</div>

              <div style="font-size: 9.5px; color: #475569; margin-top: 4px; line-height: 1.3;">
                Scan with phone camera to auto-select floor and start audit.
              </div>
            </div>
          </div>

          <!-- Placard Footer -->
          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #e2e8f0; padding-top: 8px;">
            <span style="font-size: 10px; font-weight: 700; color: #64748b; font-family: var(--font-mono);">
              ${loc.payload}
            </span>
            <button type="button" class="btn btn-secondary btn-sm btn-print-location-card" data-idx="${idx}" style="font-size: 11px; font-weight: 800; padding: 4px 10px; color: #0284c7; border-color: #0284c7;">
              🖨️ Print Placard
            </button>
          </div>

        </div>
      `).join('')}
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────
// 3. ADMIN QR LABEL DESIGNER & CONFIGURATION MODAL
// ─────────────────────────────────────────────────────────────
function renderLabelDesignerModal() {
  if (!labelDesignerModalOpen) return '';

  const cfg = tempLabelConfig || qrCodeService.getLabelConfig();

  return `
    <div class="modal-overlay" id="modal-label-designer-overlay" style="z-index: 10050;">
      <div class="modal-dialog" style="max-width: 940px; width: 95%; max-height: 90vh; display: flex; flex-direction: column;">
        
        <!-- Header -->
        <div class="modal-header" style="padding: 12px 18px; border-bottom: 1px solid rgba(255,255,255,0.1);">
          <div class="modal-title" style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 22px;">⚙️</span>
            <div>
              <div style="font-size: 16px; font-weight: 800; color: #fff;">Admin QR Sticker &amp; Label Designer</div>
              <div style="font-size: 11.5px; color: #38bdf8;">Configure which fields to display, layout orientation, and QR placement for all machine tags</div>
            </div>
          </div>
          <button type="button" id="btn-close-label-designer" class="btn btn-ghost btn-sm" style="font-size: 16px; width: 36px; height: 36px; border-radius: 50%;">✕</button>
        </div>

        <!-- Modal Body: 2 Columns (Left: Config Controls, Right: Live Real-time Preview) -->
        <div class="modal-body" style="padding: 16px; display: grid; grid-template-columns: 1.2fr 1fr; gap: 16px; overflow-y: auto; flex: 1;">
          
          <!-- Column 1: Configuration Controls -->
          <div style="display: flex; flex-direction: column; gap: 12px;">
            
            <!-- Group 1: Company Header & Floor Tag -->
            <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 12px;">
              <div style="font-size: 12px; font-weight: 800; color: #38bdf8; margin-bottom: 8px;">1. Sticker Header &amp; Branding</div>
              
              <!-- Company Title (Top-Left) -->
              <div class="form-group" style="margin-bottom: 10px;">
                <label style="font-size: 11px; color: var(--text-muted); display: flex; justify-content: space-between;">
                  <span>Company / Factory Title (Top-Left):</span>
                  <label style="display: flex; align-items: center; gap: 4px; cursor: pointer; color: #38bdf8;">
                    <input type="checkbox" id="cfg-show-company" ${cfg.showCompany ? 'checked' : ''} style="accent-color: #38bdf8;" />
                    <span>Show on Tag</span>
                  </label>
                </label>
                <input type="text" id="cfg-company-name" class="form-control" value="${cfg.companyName || 'AL-MUSLIM GROUP'}" style="font-size: 13px; font-weight: 700;" />
              </div>

              <!-- Floor Tag (Top-Right: Marked in Red on sticker) -->
              <div class="form-group" style="margin-bottom: 10px; background: rgba(56, 189, 248, 0.05); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 6px; padding: 9px 11px;">
                <label style="font-size: 11px; color: #38bdf8; font-weight: 800; display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                  <span>🏷️ Floor / Location Tag (Top-Right e.g. AKM-TISTA):</span>
                  <label style="display: flex; align-items: center; gap: 4px; cursor: pointer; color: #38bdf8; font-weight: 600;">
                    <input type="checkbox" id="cfg-show-loc-tag" ${cfg.showLocationTag !== false ? 'checked' : ''} style="accent-color: #38bdf8;" />
                    <span>Show Floor Tag</span>
                  </label>
                </label>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                  <div>
                    <label style="font-size: 10.5px; color: var(--text-muted);">Floor Tag Source:</label>
                    <select id="cfg-loc-tag-mode" class="form-control" style="font-size: 11.5px; margin-top: 2px;">
                      <option value="auto" ${(cfg.locationTagMode || 'auto') === 'auto' ? 'selected' : ''}>🏢 Master Data Floor Tag (e.g. AKM-TISTA)</option>
                      <option value="floor_only" ${cfg.locationTagMode === 'floor_only' ? 'selected' : ''}>🏷️ Floor Name Only (e.g. TISTA)</option>
                      <option value="unit_only" ${cfg.locationTagMode === 'unit_only' ? 'selected' : ''}>🏭 Unit Name Only (e.g. AKM)</option>
                      <option value="custom" ${cfg.locationTagMode === 'custom' ? 'selected' : ''}>✏️ Custom Text Override</option>
                    </select>
                  </div>
                  <div>
                    <label style="font-size: 10.5px; color: var(--text-muted);">Custom Tag Text / Override:</label>
                    <input type="text" id="cfg-custom-loc-tag" class="form-control" value="${cfg.customLocationTag || ''}" placeholder="e.g. AKM-TISTA" style="font-size: 11.5px; font-weight: 700; text-transform: uppercase; margin-top: 2px;" />
                  </div>
                </div>
                <div style="font-size: 10px; color: #94a3b8; margin-top: 4px;">
                  💡 <strong>Admin Note:</strong> Each floor tag can also be customized directly in <strong>Master Data &rarr; Floors</strong>.
                </div>
              </div>

              <!-- Status Badge -->
              <label style="display: flex; align-items: center; gap: 6px; font-size: 11.5px; color: #cbd5e1; cursor: pointer;">
                <input type="checkbox" id="cfg-show-tag-status" ${cfg.showTagStatus ? 'checked' : ''} style="accent-color: #38bdf8;" />
                <span>Show QR Status Badge (ACTIVE / INACTIVE)</span>
              </label>
            </div>

            <!-- Group 2: Data Fields To Include (Kothay Ki Thakbe) -->
            <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 12px;">
              <div style="font-size: 12px; font-weight: 800; color: #38bdf8; margin-bottom: 8px;">2. Machine Data Fields on Label</div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                <label style="display: flex; align-items: center; gap: 6px; font-size: 11.5px; color: #fff; cursor: pointer;">
                  <input type="checkbox" id="cfg-show-mid" ${cfg.showPermanentId ? 'checked' : ''} style="accent-color: #38bdf8;" />
                  <span>Unique Machine ID (MID-XXXX)</span>
                </label>
                <label style="display: flex; align-items: center; gap: 6px; font-size: 11.5px; color: #fff; cursor: pointer;">
                  <input type="checkbox" id="cfg-show-sn" ${cfg.showSerialNumber ? 'checked' : ''} style="accent-color: #38bdf8;" />
                  <span>Serial Number (SN)</span>
                </label>
                <label style="display: flex; align-items: center; gap: 6px; font-size: 11.5px; color: #fff; cursor: pointer;">
                  <input type="checkbox" id="cfg-show-name" ${cfg.showMachineName ? 'checked' : ''} style="accent-color: #38bdf8;" />
                  <span>Machine Name</span>
                </label>
                <label style="display: flex; align-items: center; gap: 6px; font-size: 11.5px; color: #fff; cursor: pointer;">
                  <input type="checkbox" id="cfg-show-spec" ${cfg.showBrandModel ? 'checked' : ''} style="accent-color: #38bdf8;" />
                  <span>Brand &amp; Model</span>
                </label>
                <label style="display: flex; align-items: center; gap: 6px; font-size: 11.5px; color: #fff; cursor: pointer;">
                  <input type="checkbox" id="cfg-show-loc" ${cfg.showLocation ? 'checked' : ''} style="accent-color: #38bdf8;" />
                  <span>Location (Unit &bull; Floor &bull; Line)</span>
                </label>
                <label style="display: flex; align-items: center; gap: 6px; font-size: 11.5px; color: #fff; cursor: pointer;">
                  <input type="checkbox" id="cfg-show-needles" ${cfg.showNeedleQuantity ? 'checked' : ''} style="accent-color: #38bdf8;" />
                  <span>Needle Quantity</span>
                </label>
              </div>
            </div>

            <!-- Group 3: Layout & Position -->
            <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 12px;">
              <div style="font-size: 12px; font-weight: 800; color: #38bdf8; margin-bottom: 8px;">3. QR Position &amp; Orientation</div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div>
                  <label style="font-size: 11px; color: var(--text-muted);">QR Code Position:</label>
                  <select id="cfg-qr-position" class="form-control" style="font-size: 12px; margin-top: 3px;">
                    <option value="left" ${cfg.qrPosition === 'left' ? 'selected' : ''}>⬅️ Left (QR Left, Details Right)</option>
                    <option value="right" ${cfg.qrPosition === 'right' ? 'selected' : ''}>➡️ Right (Details Left, QR Right)</option>
                    <option value="top" ${cfg.qrPosition === 'top' ? 'selected' : ''}>⬆️ Top (QR Centered on Top)</option>
                    <option value="qr_only" ${cfg.qrPosition === 'qr_only' ? 'selected' : ''}>🔲 QR Code Only (Compact)</option>
                  </select>
                </div>
                <div>
                  <label style="font-size: 11px; color: var(--text-muted);">QR Graphic Size:</label>
                  <select id="cfg-qr-size" class="form-control" style="font-size: 12px; margin-top: 3px;">
                    <option value="70" ${cfg.qrSize == 70 ? 'selected' : ''}>Small (70px)</option>
                    <option value="86" ${cfg.qrSize == 86 ? 'selected' : ''}>Medium (86px - Standard)</option>
                    <option value="100" ${cfg.qrSize == 100 ? 'selected' : ''}>Large (100px)</option>
                    <option value="120" ${cfg.qrSize == 120 ? 'selected' : ''}>Extra Large (120px)</option>
                  </select>
                </div>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 8px;">
                <div>
                  <label style="font-size: 11px; color: var(--text-muted);">Font Sizing:</label>
                  <select id="cfg-font-size" class="form-control" style="font-size: 12px; margin-top: 3px;">
                    <option value="small" ${cfg.fontSize === 'small' ? 'selected' : ''}>Compact (10px)</option>
                    <option value="medium" ${cfg.fontSize === 'medium' ? 'selected' : ''}>Medium (11.5px - Standard)</option>
                    <option value="large" ${cfg.fontSize === 'large' ? 'selected' : ''}>Large (13px - High Visibility)</option>
                  </select>
                </div>
                <div>
                  <label style="font-size: 11px; color: var(--text-muted);">A4 Sheet Columns:</label>
                  <select id="cfg-stickers-per-row" class="form-control" style="font-size: 12px; margin-top: 3px;">
                    <option value="2" ${cfg.stickersPerRow == 2 ? 'selected' : ''}>2 stickers / row (Large stickers)</option>
                    <option value="3" ${cfg.stickersPerRow == 3 ? 'selected' : ''}>3 stickers / row (Standard A4)</option>
                    <option value="4" ${cfg.stickersPerRow == 4 ? 'selected' : ''}>4 stickers / row (Compact)</option>
                  </select>
                </div>
              </div>
            </div>

            <!-- Group 4: Footer Note -->
            <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 12px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <span style="font-size: 12px; font-weight: 700; color: #cbd5e1;">Custom Tag Footer Note:</span>
                <label style="display: flex; align-items: center; gap: 4px; cursor: pointer; font-size: 11px; color: #38bdf8;">
                  <input type="checkbox" id="cfg-show-footer" ${cfg.showFooter ? 'checked' : ''} style="accent-color: #38bdf8;" />
                  <span>Show Footer</span>
                </label>
              </div>
              <input type="text" id="cfg-footer-text" class="form-control" value="${cfg.footerText || 'Factory Maintenance Machine Tag'}" style="font-size: 12px;" />
            </div>

          </div>

          <!-- Column 2: Live Real-Time Sticker Preview -->
          <div style="display: flex; flex-direction: column; gap: 10px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 12.5px; font-weight: 800; color: #38bdf8;">👁️ Live Sticker Preview</span>
              <span style="font-size: 10px; background: rgba(56,189,248,0.15); color: #38bdf8; padding: 2px 6px; border-radius: 4px; font-family: monospace;">REAL-TIME</span>
            </div>
            <div style="font-size: 11px; color: var(--text-muted);">
              Every configuration change above reflects on this sample tag in real time before saving.
            </div>

            <!-- Live Preview Sticker Card Container -->
            <div style="flex: 1; display: flex; align-items: center; justify-content: center; padding: 10px 0;">
              <div id="designer-live-preview-container" style="width: 100%; max-width: 380px;">
                ${renderDesignerPreviewCard(cfg)}
              </div>
            </div>

            <div style="font-size: 10.5px; color: #94a3b8; text-align: center; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 8px;">
              Note: This layout will apply to all individual machine tags and A4 print sheets.
            </div>
          </div>

        </div>

        <!-- Modal Footer Actions -->
        <div class="modal-footer" style="padding: 12px 18px; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.1);">
          <button type="button" id="btn-reset-label-config" class="btn btn-ghost btn-sm" style="color: #f87171; font-weight: 700;">
            🔄 Reset to Default
          </button>
          <div style="display: flex; gap: 8px;">
            <button type="button" id="btn-cancel-label-designer" class="btn btn-secondary btn-sm" style="font-weight: 700;">Cancel</button>
            <button type="button" id="btn-save-label-config" class="btn btn-primary btn-sm" style="font-weight: 800; padding: 8px 18px; background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); border-color: #38bdf8;">
              💾 Save Configuration &amp; Apply
            </button>
          </div>
        </div>

      </div>
    </div>
  `;
}

/**
 * Renders sample sticker card for the live preview
 */
function renderDesignerPreviewCard(cfg) {
  const isRight = cfg.qrPosition === 'right';
  const isTop = cfg.qrPosition === 'top';
  const isQrOnly = cfg.qrPosition === 'qr_only';

  let bodyLayoutClass = 'layout-left';
  if (isRight) bodyLayoutClass = 'layout-right';
  else if (isTop) bodyLayoutClass = 'layout-top';
  else if (isQrOnly) bodyLayoutClass = 'layout-qr-only';

  const qrPx = parseInt(cfg.qrSize, 10) || 86;

  return `
    <div class="qr-sticker-card" style="background: #ffffff; color: #0f172a; border: 2px solid #0284c7; box-shadow: 0 4px 15px rgba(0,0,0,0.4); width: 100%; border-radius: 8px; padding: 10px;">
      <!-- Sticker Header -->
      <div class="qr-sticker-top-row" style="border-bottom: 1.5px solid #0f172a; padding-bottom: 4px; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center;">
        <div style="font-weight: 900; font-size: 11px; color: #0f172a; text-transform: uppercase;">
          ${cfg.showCompany ? (cfg.companyName || 'AL-MUSLIM GROUP') : ''}
        </div>
        <div style="display: flex; align-items: center; gap: 6px;">
          ${resolveStickerLocationTag({ unitName: 'AKM Knit Wear Ltd.', floorName: 'Tista Floor', locationTag: 'AKM-TISTA' }, cfg) ? `
            <span style="font-weight: 900; font-size: 11px; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">
              ${resolveStickerLocationTag({ unitName: 'AKM Knit Wear Ltd.', floorName: 'Tista Floor', locationTag: 'AKM-TISTA' }, cfg)}
            </span>
          ` : ''}
          ${cfg.showTagStatus ? `
            <span style="background: #dcfce7; color: #15803d; font-size: 9px; font-weight: 800; padding: 1px 5px; border-radius: 4px;">ACTIVE</span>
          ` : ''}
        </div>
      </div>

      <!-- Sticker Body -->
      <div class="qr-sticker-body ${bodyLayoutClass}" style="margin: 4px 0;">
        <div class="qr-canvas-holder" id="preview-sample-qr-holder" data-payload="AL-MUSLIM-ERP://MC/mac-sample-5369" style="width: ${qrPx}px; height: ${qrPx}px; border: 1px solid #cbd5e1; background: #fff; padding: 2px; box-sizing: border-box;"></div>

        ${!isQrOnly ? `
          <div class="qr-sticker-info" style="color: #0f172a; font-size: ${cfg.fontSize === 'large' ? '12.5px' : (cfg.fontSize === 'small' ? '10px' : '11px')};">
            ${cfg.showPermanentId ? `<span style="font-family: monospace; font-size: 13px; font-weight: 900; color: #0284c7;">MID-000026</span>` : ''}
            ${cfg.showSerialNumber ? `<span style="font-size: 12px; font-weight: 800; color: #0f172a;">SN: 5369</span>` : ''}
            ${cfg.showMachineName ? `<span style="font-weight: 700; color: #1e293b;">Plane Machine</span>` : ''}
            ${cfg.showBrandModel ? `<span style="color: #475569;">Juki &bull; DDL-900BB</span>` : ''}
            ${cfg.showNeedleQuantity ? `<span style="color: #0369a1; font-weight: 700; font-size: 10px;">Needles: 2</span>` : ''}
            ${cfg.showLocation ? `<div style="font-size: 10px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 2px; margin-top: 2px;">📍 AKM Knit Wear &bull; Tista &bull; TS-G</div>` : ''}
          </div>
        ` : `
          <div style="font-family: monospace; font-size: 12px; font-weight: 900; color: #0284c7; text-align: center;">
            MID-000026
          </div>
        `}
      </div>

      ${cfg.showFooter && cfg.footerText ? `
        <div style="font-size: 9px; color: #64748b; text-align: center; border-top: 1px dashed #cbd5e1; padding-top: 3px; margin-top: 4px;">
          ${cfg.footerText}
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Updates the designer live preview card and draws sample QR
 */
function updateDesignerPreview(cfg) {
  const container = document.getElementById('designer-live-preview-container');
  if (!container) return;
  container.innerHTML = renderDesignerPreviewCard(cfg);

  const holder = document.getElementById('preview-sample-qr-holder');
  if (holder) {
    const QRLib = typeof window !== 'undefined' && window.QRCode ? window.QRCode : (typeof QRCode !== 'undefined' ? QRCode : null);
    if (QRLib) {
      holder.innerHTML = '';
      const qrPx = parseInt(cfg.qrSize, 10) || 86;
      const correctLevel = (QRLib.CorrectLevel && QRLib.CorrectLevel[cfg.errorCorrectionLevel || 'M']) || (QRLib.CorrectLevel && QRLib.CorrectLevel.M) || 0;
      try {
        new QRLib(holder, {
          text: 'AL-MUSLIM-ERP://MC/mac-sample-5369',
          width: qrPx,
          height: qrPx,
          colorDark: '#000000',
          colorLight: '#ffffff',
          correctLevel: correctLevel
        });
      } catch (e) {
        console.error('Error rendering preview QR:', e);
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────
// EVENT HANDLERS & CONTROLLER
// ─────────────────────────────────────────────────────────────
export function initQrCodeEvents() {
  const root = document.getElementById('qr-studio-root');
  if (!root) return;

  const refreshView = () => {
    const container = document.getElementById('main-view-container');
    if (!container) return;

    const containerY = container.scrollTop;
    const containerX = container.scrollLeft;
    const pv = container.querySelector('.page-view');
    const pvY = pv ? pv.scrollTop : 0;
    const pvX = pv ? pv.scrollLeft : 0;

    container.innerHTML = renderQrCodeView();
    initQrCodeEvents();

    const restore = () => {
      container.scrollTop = containerY;
      container.scrollLeft = containerX;
      const newPv = container.querySelector('.page-view');
      if (newPv) {
        newPv.scrollTop = pvY;
        newPv.scrollLeft = pvX;
      }
    };
    restore();
    requestAnimationFrame(restore);
  };

  // Helper to re-render only the cards grid and pagination bars (avoids destroying dropdowns or search input)
  function updateCardsAndPagination() {
    const allMachines = storage.getTable(TABLE_NAMES.MACHINES) || [];
    const filtered = filterMachines(allMachines);
    const totalFiltered = filtered.length;
    const pageSize = qrPagination.pageSize > 0 ? qrPagination.pageSize : totalFiltered;
    const totalPages = Math.max(1, Math.ceil(totalFiltered / (pageSize || 1)));

    if (qrPagination.page > totalPages) qrPagination.page = totalPages;
    if (qrPagination.page < 1) qrPagination.page = 1;

    const startIndex = (qrPagination.page - 1) * pageSize;
    const pageMachines = filtered.slice(startIndex, startIndex + (pageSize || totalFiltered));

    // 1. Update Grid
    const grid = root.querySelector('#qr-machine-cards-grid');
    if (grid) {
      grid.innerHTML = renderCardsListHtml(pageMachines);
    }

    // 2. Update Pagination Bars
    const topBar = root.querySelector('#qr-pagination-top');
    if (topBar) {
      topBar.innerHTML = renderPaginationBarInnerHtml(totalFiltered, qrPagination.page, totalPages, startIndex, pageMachines.length, qrPagination.pageSize);
    }
    const btmBar = root.querySelector('#qr-pagination-bottom');
    if (btmBar) {
      btmBar.innerHTML = renderPaginationBarInnerHtml(totalFiltered, qrPagination.page, totalPages, startIndex, pageMachines.length, qrPagination.pageSize);
    }

    // 3. Update Select All button and selection badge
    updateSelectionIndicators(pageMachines, totalFiltered);

    // 4. Re-bind events
    attachCardEvents();
    attachPaginationEvents();

    // 5. Render visible QR codes
    renderAllVisibleQrCodes();
  }

  function updateSelectionIndicators(pageMachines, totalFiltered) {
    const pill = root.querySelector('#qr-selected-count-pill');
    if (pill) {
      pill.textContent = `${selectedMachineIds.size} Selected`;
    }

    const selPageCheck = root.querySelector('#qr-select-page-check');
    if (selPageCheck) {
      if (pageMachines.length === 0) {
        selPageCheck.checked = false;
        selPageCheck.indeterminate = false;
      } else {
        const allPageSelected = pageMachines.every(m => selectedMachineIds.has(m.id));
        const somePageSelected = pageMachines.some(m => selectedMachineIds.has(m.id));
        selPageCheck.checked = allPageSelected;
        selPageCheck.indeterminate = !allPageSelected && somePageSelected;
      }
    }

    const countTab = root.querySelector('#tab-badge-machine-count');
    if (countTab) {
      countTab.textContent = totalFiltered;
    }

    const btnSelAll = root.querySelector('#btn-select-all-filtered');
    if (btnSelAll) {
      btnSelAll.textContent = `Select All (${totalFiltered})`;
    }
  }

  function attachCardEvents() {
    // Checkbox on each card (Instant DOM toggle without full page re-render)
    root.querySelectorAll('.qr-card-check').forEach(chk => {
      chk.addEventListener('change', () => {
        const id = chk.getAttribute('data-id');
        const card = chk.closest('.qr-sticker-card');
        if (chk.checked) {
          selectedMachineIds.add(id);
          card?.classList.add('selected');
        } else {
          selectedMachineIds.delete(id);
          card?.classList.remove('selected');
        }
        const allMachines = storage.getTable(TABLE_NAMES.MACHINES) || [];
        const filtered = filterMachines(allMachines);
        const pageSize = qrPagination.pageSize > 0 ? qrPagination.pageSize : filtered.length;
        const startIndex = (qrPagination.page - 1) * pageSize;
        const pageMachines = filtered.slice(startIndex, startIndex + (pageSize || filtered.length));
        updateSelectionIndicators(pageMachines, filtered.length);
      });
    });

    // Single label print
    root.querySelectorAll('.btn-qr-single-print').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        qrCodeService.recordMachineReprint(id);
        printSingleLabel(id);
      });
    });

    // Status toggle (Active / Inactive)
    root.querySelectorAll('.btn-qr-toggle-status').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const curStatus = btn.getAttribute('data-status');
        const nextStatus = curStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
        qrCodeService.updateMachineQrStatus(id, nextStatus);
        notificationService.notifyInfo('Status Updated', `Machine QR set to ${nextStatus}.`);
        updateCardsAndPagination();
      });
    });
  }

  function attachPaginationEvents() {
    root.querySelectorAll('.btn-qr-page').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetPage = parseInt(btn.getAttribute('data-page'), 10);
        if (targetPage && targetPage !== qrPagination.page) {
          qrPagination.page = targetPage;
          updateCardsAndPagination();
          root.querySelector('#qr-machine-cards-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });

    root.querySelectorAll('.qr-page-size-select').forEach(sel => {
      sel.addEventListener('change', () => {
        qrPagination.pageSize = parseInt(sel.value, 10);
        qrPagination.page = 1;
        updateCardsAndPagination();
      });
    });
  }

  // 1. Generate QR Code graphics for visible page cards
  renderAllVisibleQrCodes();
  attachCardEvents();
  attachPaginationEvents();

  // 2. Tab Switching
  root.querySelectorAll('.btn-studio-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activeStudioTab = btn.getAttribute('data-tab');
      refreshView();
    });
  });

  // 3. Dropdown Filters with dynamic cascading
  const selUnit = root.querySelector('#qr-filter-unit');
  const selFloor = root.querySelector('#qr-filter-floor');
  const selLine = root.querySelector('#qr-filter-line');
  const selName = root.querySelector('#qr-filter-name');
  const selStatus = root.querySelector('#qr-filter-status');
  const inpSearch = root.querySelector('#qr-search-input');

  function updateCascadingDropdowns() {
    if (selFloor) {
      const floors = qrFilters.unitId ? masterDataService.getFloors(qrFilters.unitId) : masterDataService.getFloors();
      selFloor.innerHTML = '<option value="">All Floors</option>' +
        floors.map(f => `<option value="${f.id}" ${f.id === qrFilters.floorId ? 'selected' : ''}>${f.name}</option>`).join('');
      if (qrFilters.floorId && !floors.some(f => f.id === qrFilters.floorId)) {
        qrFilters.floorId = '';
        selFloor.value = '';
      }
    }

    if (selLine) {
      let lines = [];
      if (qrFilters.floorId) {
        lines = masterDataService.getLines(qrFilters.floorId);
      } else if (qrFilters.unitId) {
        const unitFloors = masterDataService.getFloors(qrFilters.unitId);
        lines = unitFloors.flatMap(f => masterDataService.getLines(f.id));
      } else {
        lines = masterDataService.getLines();
      }
      selLine.innerHTML = '<option value="">All Lines</option>' +
        lines.map(l => `<option value="${l.id}" ${l.id === qrFilters.lineId ? 'selected' : ''}>${l.name}</option>`).join('');
      if (qrFilters.lineId && !lines.some(l => l.id === qrFilters.lineId)) {
        qrFilters.lineId = '';
        selLine.value = '';
      }
    }
  }

  if (selUnit) {
    selUnit.addEventListener('change', () => {
      qrFilters.unitId = selUnit.value;
      updateCascadingDropdowns();
      qrPagination.page = 1;
      updateCardsAndPagination();
    });
  }

  if (selFloor) {
    selFloor.addEventListener('change', () => {
      qrFilters.floorId = selFloor.value;
      updateCascadingDropdowns();
      qrPagination.page = 1;
      updateCardsAndPagination();
    });
  }

  if (selLine) {
    selLine.addEventListener('change', () => {
      qrFilters.lineId = selLine.value;
      qrPagination.page = 1;
      updateCardsAndPagination();
    });
  }

  if (selName) {
    selName.addEventListener('change', () => {
      qrFilters.machineNameId = selName.value;
      qrPagination.page = 1;
      updateCardsAndPagination();
    });
  }

  if (selStatus) {
    selStatus.addEventListener('change', () => {
      qrFilters.qrStatus = selStatus.value;
      qrPagination.page = 1;
      updateCardsAndPagination();
    });
  }

  if (inpSearch) {
    inpSearch.addEventListener('input', () => {
      if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => {
        qrFilters.search = inpSearch.value.trim();
        qrPagination.page = 1;
        updateCardsAndPagination();
      }, 180);
    });
  }

  // 4. Print Settings Customizer
  const setSize = root.querySelector('#qr-set-size');
  const setCols = root.querySelector('#qr-set-per-row');
  const setPage = root.querySelector('#qr-set-per-page');

  if (setSize) setSize.addEventListener('change', () => printSettings.qrSize = setSize.value);
  if (setCols) setCols.addEventListener('change', () => printSettings.colsPerRow = parseInt(setCols.value, 10));
  if (setPage) setPage.addEventListener('change', () => printSettings.labelsPerPage = parseInt(setPage.value, 10));

  // 5. Select Page / Select All / Clear Checkboxes
  const chkSelectPage = root.querySelector('#qr-select-page-check');
  if (chkSelectPage) {
    chkSelectPage.addEventListener('change', () => {
      const allMachines = storage.getTable(TABLE_NAMES.MACHINES) || [];
      const filtered = filterMachines(allMachines);
      const pageSize = qrPagination.pageSize > 0 ? qrPagination.pageSize : filtered.length;
      const startIndex = (qrPagination.page - 1) * pageSize;
      const pageMachines = filtered.slice(startIndex, startIndex + (pageSize || filtered.length));

      if (chkSelectPage.checked) {
        pageMachines.forEach(m => selectedMachineIds.add(m.id));
      } else {
        pageMachines.forEach(m => selectedMachineIds.delete(m.id));
      }

      root.querySelectorAll('.qr-card-check').forEach(chk => {
        const id = chk.getAttribute('data-id');
        chk.checked = selectedMachineIds.has(id);
        const card = chk.closest('.qr-sticker-card');
        if (chk.checked) card?.classList.add('selected');
        else card?.classList.remove('selected');
      });

      updateSelectionIndicators(pageMachines, filtered.length);
    });
  }

  const btnSelectAllFiltered = root.querySelector('#btn-select-all-filtered');
  if (btnSelectAllFiltered) {
    btnSelectAllFiltered.addEventListener('click', () => {
      const allMachines = storage.getTable(TABLE_NAMES.MACHINES) || [];
      const filtered = filterMachines(allMachines);
      filtered.forEach(m => selectedMachineIds.add(m.id));

      root.querySelectorAll('.qr-card-check').forEach(chk => {
        chk.checked = true;
        chk.closest('.qr-sticker-card')?.classList.add('selected');
      });

      const pageSize = qrPagination.pageSize > 0 ? qrPagination.pageSize : filtered.length;
      const startIndex = (qrPagination.page - 1) * pageSize;
      const pageMachines = filtered.slice(startIndex, startIndex + (pageSize || filtered.length));
      updateSelectionIndicators(pageMachines, filtered.length);
      notificationService.notifySuccess('All Selected', `Selected all ${filtered.length} matching machines for print/export.`);
    });
  }

  const btnClearSelection = root.querySelector('#btn-clear-selection');
  if (btnClearSelection) {
    btnClearSelection.addEventListener('click', () => {
      selectedMachineIds.clear();
      root.querySelectorAll('.qr-card-check').forEach(chk => {
        chk.checked = false;
        chk.closest('.qr-sticker-card')?.classList.remove('selected');
      });
      const allMachines = storage.getTable(TABLE_NAMES.MACHINES) || [];
      const filtered = filterMachines(allMachines);
      const pageSize = qrPagination.pageSize > 0 ? qrPagination.pageSize : filtered.length;
      const startIndex = (qrPagination.page - 1) * pageSize;
      const pageMachines = filtered.slice(startIndex, startIndex + (pageSize || filtered.length));
      updateSelectionIndicators(pageMachines, filtered.length);
    });
  }

  // 6. Bulk Generate Button
  const btnBulkGenerate = root.querySelector('#btn-qr-bulk-generate');
  if (btnBulkGenerate) {
    btnBulkGenerate.addEventListener('click', () => {
      const allMachines = storage.getTable(TABLE_NAMES.MACHINES) || [];
      const targetIds = selectedMachineIds.size > 0
        ? Array.from(selectedMachineIds)
        : filterMachines(allMachines).map(m => m.id);

      if (targetIds.length === 0) {
        alert('No machines selected for QR generation.');
        return;
      }

      const generatedCount = qrCodeService.bulkGenerateMachineQrs(targetIds);
      notificationService.notifySuccess('QR Codes Generated', `Successfully activated QR codes for ${generatedCount} machines!`);
      updateCardsAndPagination();
    });
  }

  // 7. A4 Sheet Print Button
  const btnPrintA4 = root.querySelector('#btn-qr-print-a4');
  if (btnPrintA4) {
    btnPrintA4.addEventListener('click', () => {
      const allMachines = storage.getTable(TABLE_NAMES.MACHINES) || [];
      const targetMachines = selectedMachineIds.size > 0
        ? allMachines.filter(m => selectedMachineIds.has(m.id))
        : filterMachines(allMachines);

      if (targetMachines.length === 0) {
        notificationService.notifyWarning('No Machines', 'No machines available to print. Please select machines or adjust filters.');
        return;
      }

      printA4LabelSheet(targetMachines);
    });
  }

  // 8. Print Location Placards
  root.querySelectorAll('.btn-print-location-card').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      const locationQrs = qrCodeService.getAllLocationQrs();
      const loc = locationQrs[idx];
      if (loc) printSingleLocationPlacard(loc);
    });
  });

  const btnPrintAllLoc = root.querySelector('#btn-print-all-locations');
  if (btnPrintAllLoc) {
    btnPrintAllLoc.addEventListener('click', () => {
      const locationQrs = qrCodeService.getAllLocationQrs();
      printAllLocationPlacards(locationQrs);
    });
  }

  // 9. Admin Label Designer Modal Events
  const btnDesigner = root.querySelector('#btn-open-label-designer');
  if (btnDesigner) {
    btnDesigner.addEventListener('click', () => {
      tempLabelConfig = { ...qrCodeService.getLabelConfig() };
      labelDesignerModalOpen = true;
      refreshView();
      setTimeout(() => updateDesignerPreview(tempLabelConfig), 50);
    });
  }

  const closeDesigner = () => {
    labelDesignerModalOpen = false;
    refreshView();
  };
  const btnCloseDes = root.querySelector('#btn-close-label-designer');
  const btnCancelDes = root.querySelector('#btn-cancel-label-designer');
  const desOverlay = root.querySelector('#modal-label-designer-overlay');
  if (btnCloseDes) btnCloseDes.addEventListener('click', closeDesigner);
  if (btnCancelDes) btnCancelDes.addEventListener('click', closeDesigner);
  if (desOverlay) {
    desOverlay.addEventListener('click', (e) => {
      if (e.target === desOverlay) closeDesigner();
    });
  }

  const bindDesignerInput = (selector, key, isCheck = true) => {
    const el = root.querySelector(selector);
    if (!el) return;
    el.addEventListener(isCheck ? 'change' : 'input', () => {
      if (!tempLabelConfig) tempLabelConfig = { ...qrCodeService.getLabelConfig() };
      tempLabelConfig[key] = isCheck ? el.checked : el.value;
      updateDesignerPreview(tempLabelConfig);
    });
  };

  bindDesignerInput('#cfg-show-company', 'showCompany', true);
  bindDesignerInput('#cfg-company-name', 'companyName', false);
  bindDesignerInput('#cfg-show-loc-tag', 'showLocationTag', true);
  bindDesignerInput('#cfg-loc-tag-mode', 'locationTagMode', false);
  bindDesignerInput('#cfg-custom-loc-tag', 'customLocationTag', false);
  bindDesignerInput('#cfg-show-tag-status', 'showTagStatus', true);
  bindDesignerInput('#cfg-show-mid', 'showPermanentId', true);
  bindDesignerInput('#cfg-show-sn', 'showSerialNumber', true);
  bindDesignerInput('#cfg-show-name', 'showMachineName', true);
  bindDesignerInput('#cfg-show-spec', 'showBrandModel', true);
  bindDesignerInput('#cfg-show-loc', 'showLocation', true);
  bindDesignerInput('#cfg-show-needles', 'showNeedleQuantity', true);
  bindDesignerInput('#cfg-qr-position', 'qrPosition', false);
  bindDesignerInput('#cfg-qr-size', 'qrSize', false);
  bindDesignerInput('#cfg-font-size', 'fontSize', false);
  bindDesignerInput('#cfg-stickers-per-row', 'stickersPerRow', false);
  bindDesignerInput('#cfg-show-footer', 'showFooter', true);
  bindDesignerInput('#cfg-footer-text', 'footerText', false);

  const btnSaveConfig = root.querySelector('#btn-save-label-config');
  if (btnSaveConfig) {
    btnSaveConfig.addEventListener('click', () => {
      if (tempLabelConfig) {
        qrCodeService.saveLabelConfig(tempLabelConfig);
        notificationService.notifySuccess('Label Configuration Saved', 'Sticker layout & fields updated successfully for all labels!');
      }
      labelDesignerModalOpen = false;
      refreshView();
    });
  }

  const btnResetConfig = root.querySelector('#btn-reset-label-config');
  if (btnResetConfig) {
    btnResetConfig.addEventListener('click', () => {
      tempLabelConfig = qrCodeService.resetLabelConfig();
      notificationService.notifyInfo('Configuration Reset', 'Label settings restored to factory default.');
      refreshView();
      setTimeout(() => updateDesignerPreview(tempLabelConfig), 50);
    });
  }
}

/**
 * Renders high-resolution QR codes into holders using QRCode.js with instant cancellation & batching
 */
function renderAllVisibleQrCodes() {
  const QRLib = typeof window !== 'undefined' && window.QRCode ? window.QRCode : (typeof QRCode !== 'undefined' ? QRCode : null);
  if (!QRLib) {
    setTimeout(renderAllVisibleQrCodes, 100);
    return;
  }

  const currentToken = ++qrRenderToken;
  const cfg = qrCodeService.getLabelConfig();
  const qrWidth = parseInt(cfg.qrSize, 10) || 86;
  const correctLevel = QRLib.CorrectLevel ? ((QRLib.CorrectLevel[cfg.errorCorrectionLevel || 'M']) || QRLib.CorrectLevel.M || 0) : 0;

  const machineHolders = Array.from(document.querySelectorAll('#qr-machine-cards-grid .qr-canvas-holder[id^="qr-holder-"]'));
  const locHolders = Array.from(document.querySelectorAll('.qr-canvas-holder[id^="qr-loc-holder-"]'));

  function processBatch(items, isLocation, batchSize = 12) {
    if (currentToken !== qrRenderToken || !items || items.length === 0) return;
    const slice = items.splice(0, batchSize);
    slice.forEach(holder => {
      if (currentToken !== qrRenderToken) return;
      const payload = holder.getAttribute('data-payload');
      if (!payload || holder.querySelector('canvas, img, svg')) return;
      holder.innerHTML = '';
      try {
        new QRLib(holder, {
          text: payload,
          width: isLocation ? 120 : qrWidth,
          height: isLocation ? 120 : qrWidth,
          colorDark: '#000000',
          colorLight: '#ffffff',
          correctLevel: isLocation ? (QRLib.CorrectLevel ? QRLib.CorrectLevel.H : 2) : correctLevel
        });
      } catch (e) {
        console.error('Error generating QR:', e);
      }
    });

    if (items.length > 0 && currentToken === qrRenderToken) {
      requestAnimationFrame(() => processBatch(items, isLocation, batchSize));
    }
  }

  processBatch(machineHolders, false, 12);
  processBatch(locHolders, true, 12);
}

/**
 * Prints a single label sticker formatted per Admin Configuration
 */
function printSingleLabel(machineId) {
  const allMachines = storage.getTable(TABLE_NAMES.MACHINES) || [];
  const machine = allMachines.find(m => m.id === machineId);
  if (!machine) return;

  const cfg = qrCodeService.getLabelConfig();
  const d = qrCodeService.getMachineQrDetails(machine);
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    notificationService.notifyWarning('Popup Blocked', 'Please allow popups to print label sticker.');
    return;
  }

  const isRight = cfg.qrPosition === 'right';
  const isTop = cfg.qrPosition === 'top';
  const isQrOnly = cfg.qrPosition === 'qr_only';

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Print Label - ${d.serialNumber}</title>
      <script src="lib/qrcode.min.js"><\/script>
      <style>
        body { margin: 0; padding: 15px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #fff; }
        .label-card {
          width: 75mm;
          border: 1.5px solid #000;
          border-radius: 6px;
          padding: 8px 10px;
          box-sizing: border-box;
          background: #fff;
        }
        .header {
          font-size: 10px;
          font-weight: 900;
          border-bottom: 1px solid #000;
          padding-bottom: 3px;
          display: flex;
          justify-content: space-between;
          text-transform: uppercase;
        }
        .body {
          display: flex;
          flex-direction: ${isTop ? 'column' : (isRight ? 'row-reverse' : 'row')};
          gap: 8px;
          align-items: center;
          margin-top: 6px;
        }
        .qr-box {
          width: 25mm;
          height: 25mm;
          flex-shrink: 0;
        }
        .qr-box canvas, .qr-box img {
          width: 100% !important;
          height: 100% !important;
          display: block;
        }
        .info {
          font-size: 9.5px;
          line-height: 1.3;
          flex: 1;
          min-width: 0;
          ${isTop ? 'text-align: center;' : ''}
        }
        .mid { font-size: 11px; font-weight: 900; font-family: monospace; color: #000; }
        .sn { font-size: 10.5px; font-weight: 800; }
        .loc { font-size: 8.5px; border-top: 1px solid #eee; margin-top: 3px; padding-top: 2px; }
        .footer { font-size: 8px; text-align: center; color: #555; border-top: 1px dashed #ccc; margin-top: 4px; padding-top: 2px; }
        @media print { body { padding: 0; } }
      </style>
    </head>
    <body>
      <div class="label-card">
        ${(cfg.showCompany || resolveStickerLocationTag(d, cfg)) ? `
          <div class="header">
            <span>${cfg.showCompany ? (cfg.companyName || 'AL-MUSLIM GROUP') : ''}</span>
            <span>${resolveStickerLocationTag(d, cfg)}</span>
          </div>
        ` : ''}

        <div class="body">
          <div class="qr-box" id="print-qr"></div>
          ${!isQrOnly ? `
            <div class="info">
              ${cfg.showPermanentId ? `<div class="mid">${d.permanentMachineId}</div>` : ''}
              ${cfg.showSerialNumber ? `<div class="sn">SN: ${d.serialNumber}</div>` : ''}
              ${cfg.showMachineName ? `<div style="font-weight: 700;">${d.machineName}</div>` : ''}
              ${cfg.showBrandModel ? `<div style="color: #444;">${d.brand} / ${d.model}</div>` : ''}
              ${cfg.showNeedleQuantity && machine.needleQuantity ? `<div style="font-weight: 700; color: #0284c7;">Needles: ${machine.needleQuantity}</div>` : ''}
              ${cfg.showLocation ? `<div class="loc">📍 ${d.unitName} &bull; ${d.floorName} &bull; ${d.lineName}</div>` : ''}
            </div>
          ` : `
            <div style="font-family: monospace; font-size: 11px; font-weight: 900; text-align: center;">
              ${d.permanentMachineId}
            </div>
          `}
        </div>

        ${cfg.showFooter && cfg.footerText ? `
          <div class="footer">${cfg.footerText}</div>
        ` : ''}
      </div>

      <script>
        function draw() {
          const QRLib = typeof window !== 'undefined' && window.QRCode ? window.QRCode : (typeof QRCode !== 'undefined' ? QRCode : null);
          if (!QRLib) { setTimeout(draw, 100); return; }
          new QRLib(document.getElementById('print-qr'), {
            text: "${d.payload}",
            width: 80,
            height: 80,
            colorDark: '#000000',
            colorLight: '#ffffff'
          });
          setTimeout(() => { window.print(); window.close(); }, 600);
        }
        if (document.readyState === 'complete') { draw(); } else { window.addEventListener('load', draw); }
      <\/script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

/**
 * Prints A4 Label Sheet for all selected/filtered machines per Admin Configuration
 */
function printA4LabelSheet(machines) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    notificationService.notifyWarning('Popup Blocked', 'Please allow popups to print label sheet.');
    return;
  }

  const cfg = qrCodeService.getLabelConfig();
  const detailsList = machines.map(m => qrCodeService.getMachineQrDetails(m));
  const cols = cfg.stickersPerRow || 3;
  const isRight = cfg.qrPosition === 'right';
  const isTop = cfg.qrPosition === 'top';
  const isQrOnly = cfg.qrPosition === 'qr_only';

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Machine QR Label Sheet - ${cfg.companyName || 'Al-Muslim Group'}</title>
      <script src="lib/qrcode.min.js"><\/script>
      <style>
        @page {
          size: A4 portrait;
          margin: 8mm;
        }
        body {
          margin: 0;
          padding: 0;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          background: #fff;
          color: #000;
        }
        .a4-grid {
          display: grid;
          grid-template-columns: repeat(${cols}, 1fr);
          gap: 5mm;
        }
        .a4-label {
          border: 1.2px ${cfg.showCuttingBorder ? 'dashed #94a3b8' : 'solid #000'};
          border-radius: 4px;
          padding: 3mm;
          box-sizing: border-box;
          page-break-inside: avoid;
          display: flex;
          flex-direction: column;
          background: #fff;
        }
        .label-head {
          font-size: 8pt;
          font-weight: 900;
          border-bottom: 1px solid #000;
          padding-bottom: 1mm;
          margin-bottom: 2mm;
          display: flex;
          justify-content: space-between;
          text-transform: uppercase;
        }
        .label-content {
          display: flex;
          flex-direction: ${isTop ? 'column' : (isRight ? 'row-reverse' : 'row')};
          gap: 3mm;
          align-items: center;
        }
        .label-qr {
          width: ${isTop ? '26mm' : '22mm'};
          height: ${isTop ? '26mm' : '22mm'};
          flex-shrink: 0;
        }
        .label-qr canvas, .label-qr img {
          width: 100% !important;
          height: 100% !important;
          display: block;
        }
        .label-meta {
          font-size: 7.5pt;
          line-height: 1.25;
          flex: 1;
          min-width: 0;
          ${isTop ? 'text-align: center;' : ''}
        }
        .meta-mid {
          font-size: 8.5pt;
          font-weight: 900;
          font-family: monospace;
          color: #000;
        }
        .meta-sn {
          font-size: 8.5pt;
          font-weight: 800;
        }
        .meta-name {
          font-weight: 700;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .meta-loc {
          font-size: 6.8pt;
          border-top: 0.5px solid #ccc;
          margin-top: 1mm;
          padding-top: 0.5mm;
          color: #333;
        }
        .label-footer {
          font-size: 6.5pt;
          text-align: center;
          color: #555;
          border-top: 0.5px dashed #aaa;
          margin-top: 1.5mm;
          padding-top: 0.5mm;
        }
      </style>
    </head>
    <body>
      <div class="a4-grid">
        ${detailsList.map((d, i) => `
          <div class="a4-label">
            ${(cfg.showCompany || resolveStickerLocationTag(d, cfg)) ? `
              <div class="label-head">
                <span>${cfg.showCompany ? (cfg.companyName || 'AL-MUSLIM GROUP') : ''}</span>
                <span>${resolveStickerLocationTag(d, cfg)}</span>
              </div>
            ` : ''}

            <div class="label-content">
              <div class="label-qr" id="print-qr-${i}"></div>
              
              ${!isQrOnly ? `
                <div class="label-meta">
                  ${cfg.showPermanentId ? `<div class="meta-mid">${d.permanentMachineId}</div>` : ''}
                  ${cfg.showSerialNumber ? `<div class="meta-sn">SN: ${d.serialNumber}</div>` : ''}
                  ${cfg.showMachineName ? `<div class="meta-name">${d.machineName}</div>` : ''}
                  ${cfg.showBrandModel ? `<div>${d.brand} / ${d.model}</div>` : ''}
                  ${cfg.showNeedleQuantity && d.needleQuantity ? `<div style="font-weight: 700; color: #0284c7;">Needles: ${d.needleQuantity}</div>` : ''}
                  ${cfg.showLocation ? `<div class="meta-loc">📍 ${d.unitName} &bull; ${d.floorName} &bull; ${d.lineName}</div>` : ''}
                </div>
              ` : `
                <div style="font-family: monospace; font-size: 8pt; font-weight: 900; text-align: center;">
                  ${d.permanentMachineId}
                </div>
              `}
            </div>

            ${cfg.showFooter && cfg.footerText ? `
              <div class="label-footer">${cfg.footerText}</div>
            ` : ''}
          </div>
        `).join('')}
      </div>

      <script>
        const items = ${JSON.stringify(detailsList.map(d => d.payload))};
        function drawAll() {
          const QRLib = typeof window !== 'undefined' && window.QRCode ? window.QRCode : (typeof QRCode !== 'undefined' ? QRCode : null);
          if (!QRLib) {
            setTimeout(drawAll, 100);
            return;
          }
          items.forEach((payload, idx) => {
            const el = document.getElementById('print-qr-' + idx);
            if (el) {
              new QRLib(el, {
                text: payload,
                width: 80,
                height: 80,
                colorDark: '#000000',
                colorLight: '#ffffff'
              });
            }
          });
          setTimeout(() => { window.print(); }, 700);
        }
        if (document.readyState === 'complete') {
          drawAll();
        } else {
          window.addEventListener('load', drawAll);
        }
      <\/script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

/**
 * Prints a Location Placard for pillar/entrance
 */
function printSingleLocationPlacard(loc) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to print placard.');
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Location QR Placard - ${loc.locationTag}</title>
      <script src="lib/qrcode.min.js"><\/script>
      <style>
        body { margin: 0; padding: 20px; font-family: sans-serif; display: flex; justify-content: center; align-items: center; min-height: 90vh; }
        .placard {
          width: 140mm;
          border: 4px solid #000;
          border-radius: 12px;
          padding: 15mm;
          text-align: center;
          box-sizing: border-box;
        }
        .head { font-size: 14pt; font-weight: 900; letter-spacing: 1px; color: #0284c7; }
        .tag { font-size: 32pt; font-weight: 900; margin: 5mm 0; }
        .qr-box { width: 50mm; height: 50mm; margin: 8mm auto; }
        .qr-box canvas, .qr-box img { width: 100% !important; height: 100% !important; }
        .unit-floor { font-size: 16pt; font-weight: 800; margin-top: 5mm; }
        .inst { font-size: 11pt; color: #555; margin-top: 4mm; }
      </style>
    </head>
    <body>
      <div class="placard">
        <div class="head">AL-MUSLIM GROUP &bull; FACTORY MAINTENANCE ERP</div>
        <div class="tag">${loc.locationTag}</div>
        <div class="qr-box" id="placard-qr"></div>
        <div class="unit-floor">${loc.unitName} &bull; ${loc.floorName}</div>
        <div class="inst">Point phone camera to scan Location QR during physical verification audit.</div>
      </div>
      <script>
        new QRCode(document.getElementById('placard-qr'), {
          text: "${loc.payload}",
          width: 200,
          height: 200,
          colorDark: '#000000',
          colorLight: '#ffffff'
        });
        setTimeout(() => { window.print(); window.close(); }, 600);
      <\/script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

/**
 * Prints all Location Placards
 */
function printAllLocationPlacards(locationQrs) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to print placards.');
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>All Location QR Placards - Al-Muslim Group</title>
      <script src="lib/qrcode.min.js"><\/script>
      <style>
        @page { size: A4 portrait; margin: 15mm; }
        body { margin: 0; padding: 0; font-family: sans-serif; }
        .placard-page {
          page-break-after: always;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 260mm;
          border: 4px solid #000;
          border-radius: 12px;
          padding: 15mm;
          box-sizing: border-box;
          text-align: center;
        }
        .head { font-size: 14pt; font-weight: 900; color: #0284c7; }
        .tag { font-size: 36pt; font-weight: 900; margin: 8mm 0; }
        .qr-box { width: 60mm; height: 60mm; margin: 8mm auto; }
        .qr-box canvas, .qr-box img { width: 100% !important; height: 100% !important; }
        .unit-floor { font-size: 18pt; font-weight: 800; }
        .inst { font-size: 12pt; color: #555; margin-top: 6mm; }
      </style>
    </head>
    <body>
      ${locationQrs.map((loc, idx) => `
        <div class="placard-page">
          <div class="head">AL-MUSLIM GROUP &bull; FACTORY MAINTENANCE ERP</div>
          <div class="tag">${loc.locationTag}</div>
          <div class="qr-box" id="loc-qr-${idx}"></div>
          <div class="unit-floor">${loc.unitName} &bull; ${loc.floorName}</div>
          <div class="inst">Point phone camera to scan Location QR during physical verification audit.</div>
        </div>
      `).join('')}

      <script>
        const list = ${JSON.stringify(locationQrs.map(l => l.payload))};
        list.forEach((payload, idx) => {
          const el = document.getElementById('loc-qr-' + idx);
          if (el) {
            new QRCode(el, {
              text: payload,
              width: 240,
              height: 240,
              colorDark: '#000000',
              colorLight: '#ffffff'
            });
          }
        });
        setTimeout(() => { window.print(); }, 800);
      <\/script>
    </body>
    </html>
  `);
  printWindow.document.close();
}
