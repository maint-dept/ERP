/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Master Data Storage, Quality Gate Studio & Custom Schema Builder
 * 
 * Jitter-Free & Zero-Scroll-Jump Architecture:
 * - Pinned Top Header, KPI Summary & Feature Navigation Bar (Never scrolls or shifts)
 * - In-place Targeted DOM Updates for Tabs, Filters, and Checkboxes (Zero page re-renders)
 * - Isolated Dedicated Modal Layer (Modals open/close with zero underlying page movement)
 * - Data Quality Gate Studio & Real-time Auto-Correction Engine
 * - 100% Professional English Interface
 */

import { smartStorageService } from '../services/smartStorageService.js?v=4.22.19';
import { storageSchemaService } from '../services/storageSchemaService.js';
import { storage } from '../db/storage.js';
import { TABLE_NAMES } from '../db/schema.js';
import { authService } from '../services/authService.js';
import { notificationService } from '../services/notificationService.js';
import { state } from '../state.js';

let activeTab = 'MACHINE'; // 'MACHINE' | 'SPARE_PART' | 'TOOL' | 'LOCATION' | 'SCHEMA_BUILDER' | 'RULES' | 'HEALTH_SCANNER' | custom keys
let machineViewMode = 'GROUPED'; // 'GROUPED' | 'FLAT'
let searchQuery = '';
let integrityFilter = 'ALL'; // 'ALL' | 'CLEAN' | 'FLAWED'
let selectedItemIds = new Set();
let selectedMachineNames = new Set();
let scanResults = null;
let isScanning = false;
let activeModalState = null;
let activeBuilderCategory = 'MACHINE';
let qualityGateData = null;
let excelImportParsedRows = [];
let excelImportFileName = '';
let excelImportActiveTab = 'UPLOAD'; // 'UPLOAD' | 'PASTE'

export function renderStorageView() {
  const isAdmin = authService.isAdmin();
  const allHierarchyGroups = smartStorageService.getMachineModelsHierarchy();
  const totalMachines = allHierarchyGroups.length;
  const totalModels = allHierarchyGroups.reduce((acc, g) => acc + g.models.length, 0);
  const registeredBrands = storage.getTable(TABLE_NAMES.BRANDS) || [];
  const brandSet = new Set();
  registeredBrands.forEach(b => {
    if (b && b.name && b.name.trim()) brandSet.add(b.name.trim().toUpperCase());
  });
  allHierarchyGroups.forEach(g => {
    (g.models || []).forEach(m => {
      if (m.brand && m.brand.trim()) brandSet.add(m.brand.trim().toUpperCase());
    });
  });
  const totalBrands = brandSet.size;

  return `
    <div class="page-view" id="storage-page-root" style="padding: 8px 14px; display: flex; flex-direction: column; gap: 8px; height: 100%; overflow: hidden; box-sizing: border-box;">
      
      <!-- Unified Compact Top Header: Title, Live KPIs & Primary Workflow Actions -->
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; min-height: 42px; flex-shrink: 0; background: var(--bg-surface); padding: 8px 14px; border: 1px solid var(--border-color); border-radius: var(--radius-md);">
        
        <!-- Left: Title & Live KPI Pills -->
        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap; min-width: 0;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="font-size: 18px; background: rgba(56, 189, 248, 0.12); border: 1px solid #38bdf8; border-radius: var(--radius-sm); width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
              🧵
            </div>
            <div>
              <h1 style="font-size: 15px; font-weight: 800; color: #fff; margin: 0; letter-spacing: -0.2px; line-height: 1.2;">
                Machine &amp; Model Master Setup
              </h1>
            </div>
          </div>

          <!-- Compact KPI Badges -->
          <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
            <div style="background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: var(--radius-sm); padding: 3px 8px; display: inline-flex; align-items: center; gap: 5px;">
              <span style="font-size: 12px;">🧵</span>
              <span id="kpi-total-machines" style="font-size: 12px; font-weight: 800; color: #38bdf8;">${totalMachines} Types</span>
            </div>

            <div id="btn-open-manage-brands" style="background: rgba(52, 211, 153, 0.1); border: 1px solid rgba(52, 211, 153, 0.3); border-radius: var(--radius-sm); padding: 3px 8px; display: inline-flex; align-items: center; gap: 5px; cursor: pointer; transition: all 0.15s ease;" title="Click to view and delete registered brands">
              <span style="font-size: 12px;">🏷️</span>
              <span id="kpi-total-brands" style="font-size: 12px; font-weight: 800; color: #34d399;">${totalBrands} Brands</span>
              <span id="kpi-total-brands-sub" style="display: none;">${totalBrands === 0 ? 'No Brands Registered' : Array.from(brandSet).slice(0, 3).join(', ')}</span>
              <span style="font-size: 10px; color: #34d399; font-weight: 800; background: rgba(52, 211, 153, 0.2); padding: 1px 4px; border-radius: 3px;">Manage &rarr;</span>
            </div>

            <div style="background: rgba(251, 191, 36, 0.1); border: 1px solid rgba(251, 191, 36, 0.3); border-radius: var(--radius-sm); padding: 3px 8px; display: inline-flex; align-items: center; gap: 5px;">
              <span style="font-size: 12px;">🔢</span>
              <span id="kpi-total-models" style="font-size: 12px; font-weight: 800; color: #fbbf24;">${totalModels} Models</span>
            </div>
          </div>
        </div>

        <!-- Right: Primary Workflow Actions -->
        <div style="display: flex; gap: 6px; flex-wrap: wrap; align-items: center;">
          ${isAdmin ? `
            <button type="button" id="btn-open-excel-master-modal-top" class="btn btn-sm btn-open-excel-master-modal" style="font-weight: 800; background: linear-gradient(135deg, #059669 0%, #047857 100%); border: 1px solid #34d399; color: #fff; padding: 5px 12px; font-size: 11.5px; box-shadow: 0 2px 8px rgba(5, 150, 105, 0.35); cursor: pointer;" title="Bulk Import Machine Name, Brand & Model via Excel Sheet">
              📊 Excel Studio (Import / Export)
            </button>
            <button type="button" id="btn-open-bulk-import-machine-names-top" class="btn btn-secondary btn-sm" style="font-weight: 700; border: 1px solid rgba(56, 189, 248, 0.4); color: #38bdf8; padding: 5px 10px; font-size: 11.5px;">
              🧵 Step 1: Add Machines
            </button>
            <button type="button" id="btn-open-fast-brand-model-importer-top" class="btn btn-primary btn-sm" style="font-weight: 800; background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); border-color: #38bdf8; padding: 5px 12px; font-size: 11.5px; box-shadow: 0 2px 6px rgba(2, 132, 199, 0.3);">
              📥 Step 2: Add Models
            </button>
            <button type="button" id="btn-storage-export-excel-top" class="btn btn-ghost btn-sm" style="font-weight: 700; color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.35); padding: 5px 9px; font-size: 11px;" title="Export all registered Machines, Brands & Models to Excel file">
              📥 Export (.xlsx)
            </button>
            <button type="button" id="btn-storage-add-new-machine" class="btn btn-ghost btn-sm" style="font-size: 11px; color: #94a3b8; border: 1px solid var(--border-color); padding: 5px 9px;">
              ➕ Add Single
            </button>
            <button type="button" id="btn-storage-clear-all-data" class="btn btn-ghost btn-sm" style="font-weight: 800; color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4); padding: 5px 9px; font-size: 11px; background: rgba(239, 68, 68, 0.08);" title="Wipe all old machines, models, and brands to start 100% fresh">
              🧹 Fresh Start
            </button>
          ` : ''}
        </div>
      </div>

      <!-- Main Storage Content Area (Flex 1, Isolated Scroll) -->
      <div id="storage-tab-content-area" style="flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 8px; overflow: hidden;">
        ${renderActiveTabContent()}
      </div>

      <!-- Dedicated Modal Layer -->
      <div id="storage-modal-layer">
        ${renderStorageModal()}
      </div>
    </div>
  `;
}

function renderActiveTabContent() {
  if (machineViewMode === 'FLAT') {
    return renderStorageItemsTab();
  }
  return renderGroupedMachinesView();
}

/**
 * Renders the Hierarchical Grouped Machine & Models View
 */
function renderGroupedMachinesView() {
  const groups = smartStorageService.getMachineModelsHierarchy();
  const q = searchQuery.toLowerCase().trim();

  let filteredGroups = groups;
  if (q) {
    filteredGroups = groups.filter(g => {
      if (g.machineName.toLowerCase().includes(q)) return true;
      return g.models.some(m => 
        (m.model && m.model.toLowerCase().includes(q)) ||
        (m.brand && m.brand.toLowerCase().includes(q)) ||
        (Array.isArray(m.aliases) && m.aliases.some(a => a.toLowerCase().includes(q)))
      );
    });
  }

  const isAdmin = authService.isAdmin();
  const totalModels = groups.reduce((acc, g) => acc + g.models.length, 0);

  return `
    <!-- Compact Filter Bar with Mode Switcher & Overview -->
    <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 6px 12px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; flex-shrink: 0;">
      
      <!-- Search Input -->
      <div style="display: flex; align-items: center; gap: 6px; flex: 1; max-width: 280px;">
        <span style="font-size: 13px;">🔍</span>
        <input 
          type="text" 
          id="inp-storage-search" 
          class="form-control" 
          placeholder="Search machines or models..." 
          value="${searchQuery}"
          style="font-size: 11.5px; padding: 4px 10px; height: 30px;"
        />
        ${searchQuery ? `<button type="button" id="btn-clear-storage-search" class="btn btn-ghost btn-sm" style="font-size: 10px; padding: 2px 5px;">✕</button>` : ''}
      </div>

      <!-- View Switcher Toggle -->
      <div style="display: flex; align-items: center; gap: 3px; background: rgba(0,0,0,0.3); padding: 2px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
        <button type="button" class="btn btn-sm btn-machine-view-toggle btn-primary" data-mode="GROUPED" style="font-size: 10.5px; padding: 3px 8px; font-weight: 700;">
          📁 Grouped
        </button>
        <button type="button" class="btn btn-sm btn-machine-view-toggle btn-ghost" data-mode="FLAT" style="font-size: 10.5px; padding: 3px 8px; font-weight: 700;">
          📋 Table View
        </button>
      </div>

      <!-- Catalog Overview & Select All in One Line -->
      <div style="display: flex; align-items: center; gap: 10px; font-size: 11.5px;">
        <span style="color: #cbd5e1; font-weight: 600;">
          <strong style="color: #38bdf8;">${filteredGroups.length}</strong> Machine Types &bull; <strong style="color: #34d399;">${totalModels}</strong> Models
        </span>
        ${(isAdmin && filteredGroups.length > 0) ? `
          <label style="display: inline-flex; align-items: center; gap: 5px; font-size: 11px; color: #94a3b8; cursor: pointer; user-select: none; background: rgba(255,255,255,0.06); padding: 2px 7px; border-radius: 4px; border: 1px solid var(--border-color); margin: 0;">
            <input type="checkbox" id="chk-group-select-all" ${filteredGroups.length > 0 && filteredGroups.every(g => selectedMachineNames.has(g.machineName)) ? 'checked' : ''} style="cursor: pointer; width: 13px; height: 13px;" />
            <span style="color: #e2e8f0; font-weight: 600;">Select All</span>
          </label>
        ` : ''}
      </div>
    </div>

    <!-- Grouped Cards Container (Scrollable Area) -->
    <div id="storage-grouped-container" style="flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; padding-right: 4px;">

      ${selectedMachineNames.size > 0 ? `
        <div id="grouped-selection-action-bar" style="background: rgba(15, 23, 42, 0.96); border: 1.5px solid #ef4444; border-radius: var(--radius-md); padding: 8px 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; box-shadow: 0 4px 16px rgba(0,0,0,0.5); flex-shrink: 0;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 13px; font-weight: 800; color: #fff;">
              Selected <strong style="color: #38bdf8;">${selectedMachineNames.size}</strong> of ${filteredGroups.length} Machines
            </span>
            <button type="button" id="btn-deselect-all-machines" class="btn btn-ghost btn-sm" style="font-size: 11px; color: var(--text-muted); padding: 2px 8px;">
              ✕ Clear Selection
            </button>
          </div>
          <button type="button" id="btn-delete-selected-machines" class="btn btn-danger btn-sm" style="font-weight: 800; font-size: 12px; background: #dc2626; border-color: #ef4444; padding: 5px 14px; box-shadow: 0 2px 8px rgba(220, 38, 38, 0.4);">
            🗑️ Delete Selected Machines (${selectedMachineNames.size})
          </button>
        </div>
      ` : ''}

      ${filteredGroups.length === 0 ? `
        <div style="text-align: center; padding: 50px 20px; background: var(--bg-card); border: 1.5px dashed var(--border-color); border-radius: var(--radius-md); color: var(--text-muted);">
          <div style="font-size: 32px; margin-bottom: 8px;">🧵</div>
          <div style="font-size: 15px; font-weight: 700; color: #fff;">No Machines Registered Yet</div>
          <div style="font-size: 12px; margin-top: 4px; margin-bottom: 16px;">First input your Machine Names, then select a machine from the dropdown to paste Brand &amp; Model Numbers.</div>
          ${isAdmin ? `
            <div style="display: flex; justify-content: center; gap: 10px; flex-wrap: wrap;">
              <button type="button" id="btn-open-bulk-import-machine-names-empty" class="btn btn-secondary btn-sm" style="font-weight: 700; border: 1.5px solid rgba(56, 189, 248, 0.4); color: #38bdf8;">
                🧵 Step 1: Input Machine Names
              </button>
              <button type="button" class="btn btn-primary btn-sm btn-open-bulk-add-models" data-machine="" style="font-weight: 800; background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);">
                📥 Step 2: Add Models (Dropdown + 2 Boxes)
              </button>
            </div>
          ` : ''}
        </div>
      ` : filteredGroups.map(grp => `
        <div class="machine-group-card" style="background: var(--bg-card); border: 1.5px solid ${grp.models.length > 0 ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.08)'}; border-radius: var(--radius-md); padding: 14px 18px; display: flex; flex-direction: column; gap: 12px; transition: border-color 0.2s ease; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
          
          <!-- Card Header -->
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 10px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              ${isAdmin ? `
                <input type="checkbox" class="chk-machine-card" data-machine="${grp.machineName}" ${selectedMachineNames.has(grp.machineName) ? 'checked' : ''} style="cursor: pointer; width: 16px; height: 16px; margin-right: 2px;" title="Select machine" />
              ` : ''}
              <span class="badge" style="font-size: 11.5px; font-weight: 900; background: rgba(56, 189, 248, 0.2); color: #38bdf8; border: 1.5px solid #38bdf8; padding: 4px 9px; border-radius: var(--radius-sm); letter-spacing: 0.5px; font-family: var(--font-mono);">SL #${grp.serialNo}</span>
              <div style="font-size: 20px; background: rgba(56, 189, 248, 0.1); width: 34px; height: 34px; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; border: 1px solid rgba(56, 189, 248, 0.3);">
                🧵
              </div>
              <div>
                <span style="font-size: 15px; font-weight: 800; color: #fff; letter-spacing: -0.2px;">
                  ${grp.machineName}
                </span>
                ${grp.code ? `
                  <span class="badge" style="margin-left: 6px; font-size: 11px; font-weight: 800; background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.35); font-family: monospace;" title="Machine Short Code: ${grp.code}">
                    ${grp.code}
                  </span>
                ` : ''}
                <span class="badge ${grp.models.length > 0 ? 'badge-active' : ''}" style="margin-left: 8px; font-size: 10.5px; font-weight: 800; ${grp.models.length === 0 ? 'background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3);' : ''}">
                  ${grp.models.length} ${grp.models.length === 1 ? 'Model' : 'Models'}
                </span>
              </div>
            </div>

            <!-- Header Actions -->
            <div style="display: flex; align-items: center; gap: 6px;">
              ${isAdmin ? `
                <button 
                  type="button" 
                  class="btn btn-ghost btn-sm btn-edit-machine-group" 
                  data-machine="${grp.machineName}" 
                  style="font-size: 11px; font-weight: 700; padding: 4px 10px; color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.35); background: rgba(56, 189, 248, 0.08); border-radius: 4px;" 
                  title="Rename Machine Type & Edit Short Code"
                >
                  ✏️ Edit / Short Code
                </button>
                <button 
                  type="button" 
                  class="btn btn-primary btn-sm btn-open-bulk-add-models" 
                  data-machine="${grp.machineName}" 
                  style="font-size: 11.5px; font-weight: 800; padding: 4px 12px; background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);"
                >
                  ➕ Add Models
                </button>
                <button 
                  type="button" 
                  class="btn btn-ghost btn-sm btn-delete-machine-group" 
                  data-machine="${grp.machineName}" 
                  style="color: #f87171; font-size: 11px; padding: 4px 8px;" 
                  title="Delete Machine and All Models"
                >
                  🗑️
                </button>
              ` : ''}
            </div>
          </div>

          <!-- Models Chips Grid or Empty Prompt -->
          ${grp.models.length > 0 ? `
            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
              ${grp.models.map(m => `
                <div style="background: rgba(15, 23, 42, 0.7); border: 1.5px solid rgba(56, 189, 248, 0.25); border-radius: var(--radius-sm); padding: 6px 12px; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.2);">
                  <span style="background: rgba(255, 255, 255, 0.12); color: #38bdf8; font-family: var(--font-mono); font-size: 11px; font-weight: 800; padding: 2px 6px; border-radius: 4px;">#${m.serialNo}</span>
                  <span class="badge badge-active" style="font-size: 9.5px; font-weight: 800;">${m.brand || 'JUKI'}</span>
                  <strong style="font-family: var(--font-mono); font-size: 12.5px; color: #fff;">${m.model}</strong>
                  
                  ${isAdmin ? `
                    <div style="display: inline-flex; align-items: center; gap: 3px; margin-left: 4px; border-left: 1px solid rgba(255,255,255,0.12); padding-left: 6px;">
                      <button type="button" class="btn btn-ghost btn-sm btn-edit-model-item" data-id="${m.id}" data-model="${m.model}" data-machine="${grp.machineName}" data-brand="${m.brand}" data-status="${m.status || 'ACTIVE'}" style="padding: 1px 4px; font-size: 10px; color: #38bdf8; line-height: 1;" title="Edit Model Specification">
                        ✏️
                      </button>
                      <button type="button" class="btn btn-ghost btn-sm btn-delete-storage-item" data-id="${m.id}" data-model="${m.model}" data-machine="${grp.machineName}" style="padding: 1px 4px; font-size: 10px; color: #f87171; line-height: 1;" title="Delete Model">
                        ✕
                      </button>
                    </div>
                  ` : ''}
                </div>
              `).join('')}
            </div>
          ` : `
            <div style="padding: 12px 16px; background: rgba(56, 189, 248, 0.04); border: 1px dashed rgba(56, 189, 248, 0.25); border-radius: var(--radius-sm); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
              <span style="font-size: 12.5px; color: #94a3b8;">
                No models registered under <strong>${grp.machineName}</strong> yet.
              </span>
              <button type="button" class="btn btn-primary btn-sm btn-open-bulk-add-models" data-machine="${grp.machineName}" style="font-size: 11.5px; font-weight: 700; padding: 4px 14px; background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);">
                📥 Add Models in Box 2
              </button>
            </div>
          `}
        </div>
      `).join('')}
    </div>
  `;
}

/**
 * Renders the All Records Flat Table
 */
function renderStorageItemsTab() {
  const groups = smartStorageService.getMachineModelsHierarchy();
  const q = searchQuery.toLowerCase().trim();

  let allRows = [];
  groups.forEach(g => {
    g.models.forEach(m => {
      allRows.push({
        machineName: g.machineName,
        machineSerialNo: g.serialNo,
        brand: m.brand,
        model: m.model,
        serialNo: m.serialNo,
        id: m.id,
        status: m.status || 'ACTIVE'
      });
    });
  });

  if (q) {
    allRows = allRows.filter(r => 
      r.machineName.toLowerCase().includes(q) ||
      r.brand.toLowerCase().includes(q) ||
      r.model.toLowerCase().includes(q)
    );
  }

  const isAdmin = authService.isAdmin();

  return `
    <!-- Compact Filter Bar with Mode Switcher & Overview -->
    <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 6px 12px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; flex-shrink: 0;">
      <div style="display: flex; align-items: center; gap: 6px; flex: 1; max-width: 280px;">
        <span style="font-size: 13px;">🔍</span>
        <input 
          type="text" 
          id="inp-storage-search" 
          class="form-control" 
          placeholder="Search machines or models..." 
          value="${searchQuery}"
          style="font-size: 11.5px; padding: 4px 10px; height: 30px;"
        />
        ${searchQuery ? `<button type="button" id="btn-clear-storage-search" class="btn btn-ghost btn-sm" style="font-size: 10px; padding: 2px 5px;">✕</button>` : ''}
      </div>

      <div style="display: flex; align-items: center; gap: 3px; background: rgba(0,0,0,0.3); padding: 2px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
        <button type="button" class="btn btn-sm btn-machine-view-toggle btn-ghost" data-mode="GROUPED" style="font-size: 10.5px; padding: 3px 8px; font-weight: 700;">
          📁 Grouped
        </button>
        <button type="button" class="btn btn-sm btn-machine-view-toggle btn-primary" data-mode="FLAT" style="font-size: 10.5px; padding: 3px 8px; font-weight: 700;">
          📋 Table View
        </button>
      </div>

      <div style="font-size: 11.5px; color: #cbd5e1; font-weight: 600;">
        Showing <strong style="color: #38bdf8;">${allRows.length}</strong> Total Model Records
      </div>
    </div>

    ${selectedItemIds.size > 0 ? `
      <div id="table-selection-action-bar" style="background: rgba(15, 23, 42, 0.96); border: 1.5px solid #ef4444; border-radius: var(--radius-md); padding: 8px 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; box-shadow: 0 4px 16px rgba(0,0,0,0.5); flex-shrink: 0;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 13px; font-weight: 800; color: #fff;">
            Selected <strong style="color: #38bdf8;">${selectedItemIds.size}</strong> of ${allRows.length} Records
          </span>
          <button type="button" id="btn-deselect-all-rows" class="btn btn-ghost btn-sm" style="font-size: 11px; color: var(--text-muted); padding: 2px 8px;">
            ✕ Clear Selection
          </button>
        </div>
        <button type="button" id="btn-delete-selected-rows" class="btn btn-danger btn-sm" style="font-weight: 800; font-size: 12px; background: #dc2626; border-color: #ef4444; padding: 5px 14px; box-shadow: 0 2px 8px rgba(220, 38, 38, 0.4);">
          🗑️ Delete Selected Records (${selectedItemIds.size})
        </button>
      </div>
    ` : ''}

    <div id="storage-table-container" style="flex: 1; min-height: 0; overflow-y: auto; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md);">
      <table class="table" style="width: 100%; margin: 0; font-size: 12px; border-collapse: collapse;">
        <thead style="position: sticky; top: 0; background: #0f172a; z-index: 1; border-bottom: 1.5px solid var(--border-color);">
          <tr>
            ${isAdmin ? `
              <th style="padding: 10px 14px; width: 42px; text-align: center;">
                <input type="checkbox" id="chk-table-select-all" ${allRows.length > 0 && allRows.every(r => selectedItemIds.has(r.id)) ? 'checked' : ''} style="cursor: pointer; width: 15px; height: 15px;" title="Select All Records" />
              </th>
            ` : ''}
            <th style="padding: 10px 14px; width: 65px; text-align: center; color: #38bdf8;">SL #</th>
            <th style="padding: 10px 14px; color: #38bdf8;">Machine Name</th>
            <th style="padding: 10px 14px; width: 140px; color: #34d399;">Brand</th>
            <th style="padding: 10px 14px; color: #fbbf24;">Model Number</th>
            <th style="padding: 10px 14px; width: 100px; text-align: center; color: #94a3b8;">Status</th>
            ${isAdmin ? `<th style="padding: 10px 14px; width: 120px; text-align: right; color: #94a3b8;">Actions</th>` : ''}
          </tr>
        </thead>
        <tbody>
          ${allRows.length === 0 ? `
            <tr>
              <td colspan="${isAdmin ? 7 : 5}" style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
                No model specifications found. Click <strong>"Step 2: Add Models"</strong> above to register models.
              </td>
            </tr>
          ` : allRows.map((row, idx) => `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.04); ${selectedItemIds.has(row.id) ? 'background: rgba(56, 189, 248, 0.08);' : ''}">
              ${isAdmin ? `
                <td style="padding: 8px 14px; text-align: center;">
                  <input type="checkbox" class="chk-table-row" data-id="${row.id}" data-model="${row.model}" data-machine="${row.machineName}" ${selectedItemIds.has(row.id) ? 'checked' : ''} style="cursor: pointer; width: 15px; height: 15px;" />
                </td>
              ` : ''}
              <td style="padding: 8px 14px; text-align: center; color: #38bdf8; font-family: var(--font-mono); font-weight: 800;">#${idx + 1}</td>
              <td style="padding: 8px 14px; font-weight: 700; color: #fff;">${row.machineName}</td>
              <td style="padding: 8px 14px;">
                <span class="badge" style="background: rgba(52, 211, 153, 0.15); color: #34d399; font-weight: 800; font-size: 10.5px;">${row.brand}</span>
              </td>
              <td style="padding: 8px 14px; font-family: var(--font-mono); font-weight: 700; color: #fff;">${row.model}</td>
              <td style="padding: 8px 14px; text-align: center;">
                <span class="badge ${row.status === 'INACTIVE' ? 'badge-inactive' : 'badge-active'}" style="font-size: 10px;">${row.status || 'ACTIVE'}</span>
              </td>
              ${isAdmin ? `
                <td style="padding: 8px 14px; text-align: right;">
                  <div style="display: inline-flex; align-items: center; gap: 4px; justify-content: flex-end;">
                    <button type="button" class="btn btn-ghost btn-sm btn-edit-model-item" data-id="${row.id}" data-model="${row.model}" data-machine="${row.machineName}" data-brand="${row.brand}" data-status="${row.status || 'ACTIVE'}" style="color: #38bdf8; font-size: 11px; padding: 2px 7px; border: 1px solid rgba(56, 189, 248, 0.35); border-radius: 4px; font-weight: 700; background: rgba(56, 189, 248, 0.08);" title="Edit Model Specification">
                      ✏️ Edit
                    </button>
                    <button type="button" class="btn btn-ghost btn-sm btn-delete-storage-item" data-id="${row.id}" data-model="${row.model}" data-machine="${row.machineName}" style="color: #f87171; font-size: 11px; padding: 2px 6px;" title="Delete Model">
                      ✕
                    </button>
                  </div>
                </td>
              ` : ''}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderBulkBarHtml(audit) {
  if (selectedItemIds.size === 0 && (!audit || (audit.flawedCount === 0 && audit.warningCount === 0))) {
    return '';
  }

  return `
    <div style="background: rgba(15, 23, 42, 0.95); border: 1px solid #38bdf8; border-radius: var(--radius-md); padding: 8px 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);">
      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="font-size: 12.5px; font-weight: 700; color: #fff;">
          ${selectedItemIds.size > 0 ? `Selected: <strong style="color: #38bdf8;">${selectedItemIds.size}</strong> records` : `Quality Actions available`}
        </span>
        ${selectedItemIds.size > 0 ? `
          <button type="button" id="btn-bulk-deselect-all" class="btn btn-ghost btn-sm" style="font-size: 11px; color: var(--text-muted); padding: 2px 6px;">
            ✕ Clear Selection
          </button>
        ` : ''}
      </div>

      <div style="display: flex; gap: 6px; flex-wrap: wrap;">
        ${selectedItemIds.size > 0 ? `
          <button type="button" id="btn-bulk-delete-selected" class="btn btn-danger btn-sm" style="font-weight: 800; font-size: 11px; padding: 4px 10px;">
            🗑️ Delete Selected (${selectedItemIds.size})
          </button>
        ` : ''}

        ${audit && audit.warningCount > 0 ? `
          <button type="button" id="btn-bulk-autofix-warnings" class="btn btn-warning btn-sm" style="font-weight: 800; font-size: 11px; padding: 4px 10px;">
            ✨ Auto-Fix Typos (${audit.warningCount})
          </button>
        ` : ''}

        ${audit && audit.flawedCount > 0 ? `
          <button type="button" id="btn-purge-all-flawed" class="btn btn-danger btn-sm" style="font-weight: 800; font-size: 11px; padding: 4px 10px; background: rgba(239, 68, 68, 0.2); border: 1px solid #ef4444; color: #f87171;">
            🧹 Discard Flawed Entries (${audit.flawedCount})
          </button>
        ` : ''}
      </div>
    </div>
  `;
}

/**
 * Renders the Custom Master Schema Builder tab (Isolated Scroll Area)
 */
function renderSchemaBuilderTab() {
  const allCategories = storageSchemaService.getAllCategories();
  const currentSchema = storageSchemaService.getSchema(activeBuilderCategory);

  return `
    <div style="display: flex; gap: 16px; flex: 1; min-height: 0; overflow: hidden;">
      
      <!-- Left Category Selector Sidebar -->
      <div style="width: 240px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px; display: flex; flex-direction: column; gap: 10px; flex-shrink: 0;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <strong style="color: #fff; font-size: 13px;">Reference Schemas</strong>
          <button type="button" id="btn-open-add-category" class="btn btn-primary btn-sm" style="font-size: 10.5px; padding: 2px 7px; font-weight: 700;">
            ➕ New Category
          </button>
        </div>

        <div style="display: flex; flex-direction: column; gap: 5px; overflow-y: auto; flex: 1;" id="builder-cat-list">
          ${allCategories.map(cat => `
            <div 
              class="builder-cat-item ${activeBuilderCategory === cat.categoryKey ? 'active' : ''}" 
              data-cat="${cat.categoryKey}"
              style="padding: 8px 10px; border-radius: var(--radius-sm); border: 1px solid ${activeBuilderCategory === cat.categoryKey ? '#38bdf8' : 'var(--border-color)'}; background: ${activeBuilderCategory === cat.categoryKey ? 'rgba(56, 189, 248, 0.1)' : 'transparent'}; cursor: pointer; display: flex; align-items: center; justify-content: space-between; transition: all 0.15s ease;"
            >
              <div style="display: flex; align-items: center; gap: 8px; overflow: hidden;">
                <span style="font-size: 15px;">${cat.icon}</span>
                <div style="overflow: hidden;">
                  <div style="font-weight: 700; font-size: 12px; color: ${activeBuilderCategory === cat.categoryKey ? '#38bdf8' : '#fff'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    ${cat.title}
                  </div>
                  <div style="font-size: 10px; color: var(--text-muted);">
                    ${(cat.standardFields?.length || 0) + (cat.customFields?.length || 0)} attributes
                  </div>
                </div>
              </div>
              ${!cat.isSystem ? `
                <button type="button" class="btn btn-ghost btn-sm btn-delete-custom-category" data-cat="${cat.categoryKey}" style="color: #f87171; padding: 1px 4px; font-size: 10px;" title="Delete Category">
                  ✕
                </button>
              ` : ''}
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Right Schema Details & Field Editor (Scrollable) -->
      <div id="builder-details-panel" style="flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 12px; overflow-y: auto;">
        ${renderBuilderDetailsHtml(currentSchema)}
      </div>
    </div>
  `;
}

function renderBuilderDetailsHtml(currentSchema) {
  return `
    <!-- Category Overview Card -->
    <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; flex-shrink: 0;">
      <div style="display: flex; align-items: center; gap: 10px;">
        <div style="font-size: 26px;">${currentSchema.icon}</div>
        <div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <h3 style="font-size: 15px; font-weight: 800; color: #fff; margin: 0;">${currentSchema.title}</h3>
            <span class="badge badge-active" style="font-size: 9.5px;">${currentSchema.categoryKey}</span>
            ${currentSchema.isSystem ? `<span class="badge badge-purple" style="font-size: 9.5px;">System Core</span>` : `<span class="badge badge-teal" style="font-size: 9.5px;">Custom Schema</span>`}
          </div>
          <div style="font-size: 11.5px; color: var(--text-secondary); margin-top: 2px;">
            ${currentSchema.description}
          </div>
        </div>
      </div>

      <div style="display: flex; gap: 6px;">
        <button type="button" id="btn-schema-dl-template" class="btn btn-secondary btn-sm" style="font-weight: 700; font-size: 11px;">
          📥 Download Template
        </button>
        <button type="button" id="btn-open-add-field" class="btn btn-primary btn-sm" style="font-weight: 800; font-size: 11px;">
          ➕ Add Custom Attribute
        </button>
      </div>
    </div>

    <!-- Standard Core Attributes Table -->
    <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px; flex-shrink: 0;">
      <div style="font-size: 12.5px; font-weight: 800; color: #38bdf8; margin-bottom: 8px;">
        📌 Standard Core Attributes (System Defined)
      </div>

      <table class="excel-grid-table" style="font-size: 11.5px;">
        <thead>
          <tr>
            <th>Attribute Label</th>
            <th>Database Key</th>
            <th>Data Type</th>
            <th>Required</th>
            <th>Show in Table</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${(currentSchema.standardFields || []).map(f => `
            <tr>
              <td style="font-weight: 700; color: #fff;">${f.label}</td>
              <td style="font-family: var(--font-mono); color: #38bdf8;">${f.key}</td>
              <td><span class="badge badge-purple" style="font-size: 9.5px;">${f.type.toUpperCase()}</span></td>
              <td>${f.required ? '<span class="badge badge-danger" style="font-size: 9.5px;">MANDATORY</span>' : '<span style="color: var(--text-muted);">Optional</span>'}</td>
              <td>
                <button type="button" class="btn btn-ghost btn-sm btn-toggle-field-table" data-cat="${currentSchema.categoryKey}" data-field="${f.key}" style="font-size: 10.5px; padding: 2px 6px;">
                  ${f.showInTable !== false ? '👁️ Visible' : '🚫 Hidden'}
                </button>
              </td>
              <td><span class="badge badge-active" style="font-size: 9.5px;">SYSTEM CORE</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <!-- Custom User-Defined Attributes Table -->
    <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px; flex-shrink: 0;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <div style="font-size: 12.5px; font-weight: 800; color: #34d399;">
          ✨ Custom Attributes &bull; Factory Specific Fields (${(currentSchema.customFields || []).length})
        </div>
        <button type="button" id="btn-open-add-field-2" class="btn btn-success btn-sm" style="font-size: 10.5px; font-weight: 700; padding: 2px 7px;">
          ➕ Add Field
        </button>
      </div>

      ${(currentSchema.customFields || []).length === 0 ? `
        <div style="text-align: center; padding: 20px 12px; border: 1px dashed var(--border-color); border-radius: var(--radius-sm); color: var(--text-muted); font-size: 11.5px;">
          No custom attributes defined yet for ${currentSchema.title}. Click "+ Add Custom Attribute" to track extra specifications, power ratings, or needle codes.
        </div>
      ` : `
        <table class="excel-grid-table" style="font-size: 11.5px;">
          <thead>
            <tr>
              <th>Attribute Label</th>
              <th>Database Key</th>
              <th>Data Type</th>
              <th>Required</th>
              <th>Show in Table</th>
              <th>Options / Values</th>
              <th style="width: 60px; text-align: center;">Action</th>
            </tr>
          </thead>
          <tbody>
            ${currentSchema.customFields.map(f => `
              <tr>
                <td style="font-weight: 700; color: #34d399;">${f.label}</td>
                <td style="font-family: var(--font-mono); color: #38bdf8;">${f.key}</td>
                <td><span class="badge badge-teal" style="font-size: 9.5px;">${f.type.toUpperCase()}</span></td>
                <td>${f.required ? '<span class="badge badge-danger" style="font-size: 9.5px;">MANDATORY</span>' : '<span style="color: var(--text-muted);">Optional</span>'}</td>
                <td>
                  <button type="button" class="btn btn-ghost btn-sm btn-toggle-field-table" data-cat="${currentSchema.categoryKey}" data-field="${f.key}" style="font-size: 10.5px; padding: 2px 6px;">
                    ${f.showInTable ? '👁️ Visible' : '🚫 Hidden'}
                  </button>
                </td>
                <td style="font-size: 11px; color: var(--text-secondary);">
                  ${f.options && f.options.length ? f.options.join(', ') : '—'}
                </td>
                <td style="text-align: center;">
                  <button type="button" class="btn btn-ghost btn-sm btn-delete-custom-field" data-cat="${currentSchema.categoryKey}" data-field="${f.key}" style="color: #f87171; padding: 2px 5px;" title="Delete Field">
                    🗑️
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `}
    </div>
  `;
}

/**
 * Correction Rules Dictionary Tab (Isolated Scroll Area)
 */
function renderCorrectionRulesTab() {
  const rules = smartStorageService.getCorrectionRules();
  return `
    <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 10px 16px; flex-shrink: 0;">
      <div>
        <div style="font-size: 13.5px; font-weight: 800; color: #f43f5e;">
          📝 Custom Typo &amp; Auto-Correction Rules Dictionary
        </div>
        <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">
          Intercepts common typos, colloquial slang, and casing variants, correcting them to canonical standards.
        </div>
      </div>
      <button type="button" id="btn-add-correction-rule" class="btn btn-primary btn-sm" style="font-weight: 700;">
        ➕ Add Correction Rule
      </button>
    </div>

    <div class="table-responsive" style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); flex: 1; min-height: 0; overflow-y: auto;">
      <table class="excel-grid-table" style="font-size: 11.5px; width: 100%;">
        <thead style="position: sticky; top: 0; z-index: 2; background: var(--bg-card);">
          <tr>
            <th style="width: 45px; text-align: center;">#</th>
            <th>Raw Input Pattern</th>
            <th>Canonical Target Standard</th>
            <th>Category</th>
            <th>Issue Type</th>
            <th>Notes / Comments</th>
            <th style="width: 80px; text-align: center;">Action</th>
          </tr>
        </thead>
        <tbody>
          ${rules.length === 0 ? `
            <tr><td colspan="7" style="text-align: center; padding: 30px; color: var(--text-muted);">No custom correction rules defined</td></tr>
          ` : rules.map((r, idx) => `
            <tr>
              <td style="text-align: center; color: var(--text-muted); font-family: var(--font-mono); font-size: 11px;">${idx + 1}</td>
              <td style="font-family: var(--font-mono); font-weight: 700; color: #f87171;">"${r.rawPattern}"</td>
              <td style="font-family: var(--font-mono); font-weight: 800; color: #34d399; font-size: 12.5px;">"${r.targetValue}"</td>
              <td><span class="badge badge-active" style="font-size: 9.5px;">${r.category || 'ALL'}</span></td>
              <td><span class="badge badge-purple" style="font-size: 9.5px;">${r.issueType || 'casing'}</span></td>
              <td style="color: var(--text-secondary); font-size: 11px;">${r.note || '—'}</td>
              <td style="text-align: center;">
                <button type="button" class="btn btn-ghost btn-sm btn-delete-correction-rule" data-id="${r.id}" style="color: #f87171; padding: 2px 5px;">
                  🗑️ Delete
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

/**
 * Health Scanner Tab (Isolated Scroll Area)
 */
function renderHealthScannerTab() {
  return `
    <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; flex-shrink: 0;">
      <div>
        <div style="font-size: 14px; font-weight: 800; color: #fbbf24; display: flex; align-items: center; gap: 6px;">
          <span>🩺 Database Health Audit &amp; Auto-Correction Scanner</span>
        </div>
        <div style="font-size: 11.5px; color: var(--text-secondary); margin-top: 2px; max-width: 600px;">
          Audits physical machine inventory, spare parts, and tools in the database to detect casing mismatches and formatting typos, offering 1-click batch fixing.
        </div>
      </div>

      <div style="display: flex; gap: 8px;">
        <button type="button" id="btn-run-health-scan" class="btn btn-warning btn-sm" style="font-weight: 800; display: flex; align-items: center; gap: 5px;">
          <span>${isScanning ? '⏳ Scanning Database...' : '🔍 Scan Database'}</span>
        </button>

        ${scanResults && scanResults.totalIssuesFound > 0 ? `
          <button type="button" id="btn-batch-fix-all-issues" class="btn btn-success btn-sm" style="font-weight: 800; display: flex; align-items: center; gap: 5px;">
            <span>✨ Batch Fix All (${scanResults.totalIssuesFound})</span>
          </button>
        ` : ''}
      </div>
    </div>

    <!-- Scan Results Display -->
    <div style="flex: 1; min-height: 0; overflow-y: auto;">
      ${!scanResults ? `
        <div style="text-align: center; padding: 40px 16px; background: var(--bg-card); border: 1px dashed var(--border-color); border-radius: var(--radius-md);">
          <div style="font-size: 36px; margin-bottom: 8px;">🩺</div>
          <h3 style="font-size: 15px; font-weight: 800; color: #fff;">Click "Scan Database" to begin consistency audit</h3>
          <p style="font-size: 11.5px; color: var(--text-secondary); max-width: 440px; margin: 4px auto 0;">
            Machine brands (e.g. juki vs JUKI), models (e.g. ddl 8700 vs DDL-8700), and parts will be audited.
          </p>
        </div>
      ` : scanResults.totalIssuesFound === 0 ? `
        <div style="text-align: center; padding: 35px 16px; background: rgba(16, 185, 129, 0.08); border: 1.5px solid #10b981; border-radius: var(--radius-md);">
          <div style="font-size: 38px; margin-bottom: 6px;">✅</div>
          <h3 style="font-size: 16px; font-weight: 800; color: #34d399;">Database is Clean &amp; Healthy! No Inconsistencies Found</h3>
          <p style="font-size: 12px; color: var(--text-secondary); margin-top: 3px;">
            Scanned ${scanResults.totalRecordsScanned} records across physical inventory. All models, brands, and parts adhere to canonical standards.
          </p>
        </div>
      ` : `
        <div style="display: flex; flex-direction: column; gap: 10px;">
          <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.35); border-left: 4px solid #ef4444; border-radius: var(--radius-md); padding: 10px 14px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <strong style="color: #f87171; font-size: 12.5px;">
                ⚠️ ${scanResults.totalIssuesFound} Inconsistencies Found! (${scanResults.totalRecordsScanned} total records scanned)
              </strong>
              <div style="font-size: 11px; color: var(--text-secondary); margin-top: 1px;">
                Auto-correct records to canonical master values in 1 click, or fix individually below.
              </div>
            </div>
            <button type="button" id="btn-batch-fix-all-issues-top" class="btn btn-success btn-sm" style="font-weight: 800; font-size: 11px;">
              ✨ Batch Fix All
            </button>
          </div>

          <div class="table-responsive" style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md);">
            <table class="excel-grid-table" style="font-size: 11px; width: 100%;">
              <thead style="position: sticky; top: 0; z-index: 2; background: var(--bg-card);">
                <tr>
                  <th style="width: 75px; text-align: center;">Type</th>
                  <th>ID / Serial</th>
                  <th>Field</th>
                  <th>Current Value (Entered)</th>
                  <th>Canonical Standard (Suggested)</th>
                  <th>Issue Type</th>
                  <th style="width: 80px; text-align: center;">Action</th>
                </tr>
              </thead>
              <tbody>
                ${scanResults.issues.map(iss => `
                  <tr>
                    <td style="text-align: center;"><span class="badge badge-active" style="font-size: 9.5px;">${iss.entityType}</span></td>
                    <td style="font-family: var(--font-mono); font-weight: 700; color: #38bdf8;">${iss.serialNumber || iss.recordId}</td>
                    <td style="color: var(--text-secondary); font-weight: 600;">${iss.fieldLabel}</td>
                    <td style="font-family: var(--font-mono); font-weight: 700; color: #f87171; background: rgba(239, 68, 68, 0.05); padding: 3px 6px;">
                      "${iss.original}"
                    </td>
                    <td style="font-family: var(--font-mono); font-weight: 800; color: #34d399; background: rgba(52, 211, 153, 0.08); padding: 3px 6px;">
                      "${iss.suggested}"
                    </td>
                    <td>
                      <span class="badge ${iss.issueType === 'casing' ? 'badge-purple' : 'badge-warning'}" style="font-size: 9.5px;">
                        ${iss.issueTitle || iss.issueType}
                      </span>
                    </td>
                    <td style="text-align: center;">
                      <button type="button" class="btn btn-success btn-sm btn-fix-single-issue" data-issue-id="${iss.id}" style="font-size: 10.5px; padding: 2px 7px; font-weight: 700;">
                        ⚡ Fix
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `}
    </div>
  `;
}

function renderExcelImportExportModal() {
  const rows = excelImportParsedRows || [];
  const validRows = rows.filter(r => r.machineName && r.machineName.trim());
  const uniqueMachines = new Set(validRows.map(r => r.machineName.trim().toUpperCase())).size;
  const uniqueBrands = new Set(validRows.filter(r => r.brand).map(r => r.brand.trim().toUpperCase())).size;
  const uniqueModels = new Set(validRows.filter(r => r.model).map(r => (r.machineName + ':::' + r.model).trim().toUpperCase())).size;

  return `
    <div class="modal-overlay" id="modal-excel-master-overlay" style="z-index: 10000;">
      <div class="modal-dialog" style="max-width: 820px; width: 95%; max-height: 90vh; display: flex; flex-direction: column;">
        
        <!-- Header -->
        <div class="modal-header" style="background: linear-gradient(135deg, #064e3b 0%, #022c22 100%); border-bottom: 2px solid #10b981; padding: 14px 20px;">
          <div class="modal-title" style="display: flex; align-items: center; gap: 10px;">
            <div style="font-size: 24px; background: rgba(16, 185, 129, 0.2); width: 40px; height: 40px; border-radius: 8px; display: flex; align-items: center; justify-content: center; border: 1px solid #10b981;">
              📊
            </div>
            <div>
              <div style="font-weight: 800; font-size: 16px; color: #fff; line-height: 1.2;">
                Machine Name, Brand &amp; Model — Excel Sheet Studio
              </div>
              <div style="font-size: 11px; color: #6ee7b7; margin-top: 2px;">
                Input all Machine Names, Brands, and Models in 1 click via Excel file or Copy-Paste table
              </div>
            </div>
          </div>
          <button type="button" id="btn-close-storage-modal" class="btn btn-ghost btn-sm" style="color: #fff; font-size: 16px;">✕</button>
        </div>

        <!-- Body (Scrollable) -->
        <div class="modal-body" style="padding: 18px 20px; display: flex; flex-direction: column; gap: 14px; overflow-y: auto; flex: 1;">
          
          <!-- Quick Action Bar: Download Template & Export Master Data -->
          <div style="background: rgba(16, 185, 129, 0.08); border: 1px dashed rgba(16, 185, 129, 0.35); border-radius: var(--radius-md); padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
            <div>
              <div style="font-size: 12.5px; font-weight: 700; color: #a7f3d0;">
                📥 Need an Excel Template?
              </div>
              <div style="font-size: 11px; color: #94a3b8; margin-top: 1px;">
                Download pre-formatted spreadsheet with columns: <strong>Machine Name, Brand, Model, Remarks</strong>
              </div>
            </div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <button type="button" id="btn-excel-modal-download-template" class="btn btn-sm" style="background: #059669; color: #fff; font-weight: 700; font-size: 11.5px; border: 1px solid #10b981; padding: 6px 14px; display: flex; align-items: center; gap: 6px;">
                <span>📥</span> Download Excel Template (.xlsx)
              </button>
              <button type="button" id="btn-excel-modal-export" class="btn btn-sm" style="background: #0284c7; color: #fff; font-weight: 700; font-size: 11.5px; border: 1px solid #38bdf8; padding: 6px 14px; display: flex; align-items: center; gap: 6px;">
                <span>📤</span> Export Current Catalog (.xlsx)
              </button>
            </div>
          </div>

          <!-- Input Method Tabs -->
          <div style="display: flex; gap: 6px; border-bottom: 1px solid var(--border-color); padding-bottom: 2px;">
            <button type="button" class="btn btn-sm btn-excel-mode-tab ${excelImportActiveTab === 'UPLOAD' ? 'btn-primary' : 'btn-ghost'}" data-tab="UPLOAD" style="font-size: 12px; font-weight: 700; padding: 6px 14px;">
              📁 Option A: Upload Excel File (.xlsx, .xls, .csv)
            </button>
            <button type="button" class="btn btn-sm btn-excel-mode-tab ${excelImportActiveTab === 'PASTE' ? 'btn-primary' : 'btn-ghost'}" data-tab="PASTE" style="font-size: 12px; font-weight: 700; padding: 6px 14px;">
              📋 Option B: Copy &amp; Paste from Excel Table
            </button>
          </div>

          <!-- Mode A: Upload Excel File -->
          <div id="excel-tab-upload-container" style="${excelImportActiveTab === 'UPLOAD' ? '' : 'display: none;'}">
            <div id="excel-dropzone" style="border: 2px dashed ${rows.length > 0 ? '#10b981' : 'rgba(56, 189, 248, 0.4)'}; border-radius: var(--radius-md); background: ${rows.length > 0 ? 'rgba(16, 185, 129, 0.05)' : 'rgba(15, 23, 42, 0.6)'}; padding: 26px 20px; text-align: center; cursor: pointer; transition: all 0.2s ease;">
              <input type="file" id="inp-excel-master-file" accept=".xlsx, .xls, .csv" style="display: none;" />
              <div style="font-size: 32px; margin-bottom: 8px;">
                ${rows.length > 0 ? '✅' : '📊'}
              </div>
              <div style="font-size: 13.5px; font-weight: 700; color: #fff;">
                ${excelImportFileName ? `Loaded: <span style="color: #34d399;">${excelImportFileName}</span>` : 'Click to select or Drag &amp; Drop Excel spreadsheet here'}
              </div>
              <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">
                Supports Microsoft Excel (.xlsx, .xls) and CSV (.csv). Headers: Machine Name, Brand, Model, Remarks
              </div>
              <button type="button" id="btn-browse-excel-file" class="btn btn-secondary btn-sm" style="margin-top: 12px; font-size: 11.5px; font-weight: 700;">
                📂 Browse Spreadsheet File...
              </button>
            </div>
          </div>

          <!-- Mode B: Paste from Excel -->
          <div id="excel-tab-paste-container" style="${excelImportActiveTab === 'PASTE' ? '' : 'display: none;'}">
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <div style="font-size: 11.5px; color: #cbd5e1; font-weight: 600;">
                Select and copy rows from your Excel sheet (including or excluding headers), then paste below:
              </div>
              <textarea 
                id="txt-excel-paste-input" 
                class="form-control" 
                rows="6" 
                placeholder="Machine Name	Brand	Model	Remarks&#10;Plane Machine	JUKI	DDL-8700	Lockstitch 1-Needle&#10;Plane Machine	BROTHER	S-7200C	Direct Drive&#10;Overlock Machine	PEGASUS	M952-52	4-Thread"
                style="font-family: monospace; font-size: 11.5px; line-height: 1.4; padding: 10px;"
              ></textarea>
              <div style="display: flex; justify-content: flex-end;">
                <button type="button" id="btn-parse-pasted-excel" class="btn btn-primary btn-sm" style="font-weight: 700; font-size: 12px; padding: 6px 16px;">
                  🔍 Parse &amp; Preview Pasted Data
                </button>
              </div>
            </div>
          </div>

          <!-- Preview & Validation Area (Shows when data is loaded) -->
          ${rows.length > 0 ? `
            <div style="border: 1px solid var(--border-color); border-radius: var(--radius-md); background: rgba(0,0,0,0.25); padding: 12px; display: flex; flex-direction: column; gap: 10px;">
              
              <!-- Metrics Cards -->
              <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                  <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid #10b981; font-weight: 700; font-size: 11px; padding: 4px 10px;">
                    ✅ ${validRows.length} Valid Rows
                  </span>
                  <span class="badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid #38bdf8; font-weight: 700; font-size: 11px; padding: 4px 10px;">
                    🧵 ${uniqueMachines} Unique Machine Types
                  </span>
                  <span class="badge" style="background: rgba(251, 191, 36, 0.15); color: #fbbf24; border: 1px solid #fbbf24; font-weight: 700; font-size: 11px; padding: 4px 10px;">
                    🏷️ ${uniqueBrands} Unique Brands
                  </span>
                  <span class="badge" style="background: rgba(168, 85, 247, 0.15); color: #c084fc; border: 1px solid #a855f7; font-weight: 700; font-size: 11px; padding: 4px 10px;">
                    🔢 ${uniqueModels} Unique Models
                  </span>
                </div>
                <button type="button" id="btn-clear-excel-preview" class="btn btn-ghost btn-sm" style="color: #f87171; font-size: 11px; font-weight: 700;">
                  ✕ Clear Table
                </button>
              </div>

              <!-- Preview Table -->
              <div style="max-height: 220px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: var(--radius-sm);">
                <table class="table" style="width: 100%; font-size: 11.5px; border-collapse: collapse; margin: 0;">
                  <thead style="background: var(--bg-surface); position: sticky; top: 0; z-index: 2;">
                    <tr>
                      <th style="padding: 6px 10px; width: 45px; text-align: center;">#</th>
                      <th style="padding: 6px 10px;">Machine Name</th>
                      <th style="padding: 6px 10px;">Brand</th>
                      <th style="padding: 6px 10px;">Model</th>
                      <th style="padding: 6px 10px;">Remarks</th>
                      <th style="padding: 6px 10px; text-align: center; width: 75px;">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${rows.slice(0, 60).map((r, i) => {
                      const isValid = Boolean(r.machineName && r.machineName.trim());
                      return `
                        <tr style="background: ${i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent'};">
                          <td style="padding: 5px 10px; text-align: center; color: var(--text-muted);">${i + 1}</td>
                          <td style="padding: 5px 10px; font-weight: 700; color: #fff;">${r.machineName || '<span style="color:#f87171;">(Missing)</span>'}</td>
                          <td style="padding: 5px 10px; color: #34d399; font-weight: 600;">${r.brand || '-'}</td>
                          <td style="padding: 5px 10px; color: #fbbf24; font-weight: 600;">${r.model || '-'}</td>
                          <td style="padding: 5px 10px; color: var(--text-muted); font-size: 10.5px;">${r.remarks || '-'}</td>
                          <td style="padding: 5px 10px; text-align: center;">
                            ${isValid ? `<span style="color: #34d399; font-weight: 700; font-size: 10px; background: rgba(52,211,153,0.1); padding: 2px 6px; border-radius: 3px;">VALID</span>` : `<span style="color: #f87171; font-weight: 700; font-size: 10px; background: rgba(239,68,68,0.1); padding: 2px 6px; border-radius: 3px;">ERROR</span>`}
                          </td>
                        </tr>
                      `;
                    }).join('')}
                    ${rows.length > 60 ? `
                      <tr>
                        <td colspan="6" style="text-align: center; padding: 8px; color: var(--text-muted); font-size: 11px;">
                          ... and ${rows.length - 60} more rows ready for import
                        </td>
                      </tr>
                    ` : ''}
                  </tbody>
                </table>
              </div>

              <!-- Auto-Creation & Formatting Options -->
              <div style="display: flex; gap: 16px; flex-wrap: wrap; background: rgba(255,255,255,0.02); padding: 8px 12px; border-radius: var(--radius-sm); font-size: 11.5px;">
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; color: #34d399; font-weight: 700; margin: 0;">
                  <input type="checkbox" id="chk-excel-replace-existing" checked style="cursor: pointer; accent-color: #10b981;" />
                  <span>🧹 Clean &amp; Replace models for imported machines (Prevents mixing with old wrong models)</span>
                </label>
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; color: #e2e8f0; margin: 0;">
                  <input type="checkbox" id="chk-excel-auto-brands" checked style="cursor: pointer;" />
                  <span>Auto-create missing Brands</span>
                </label>
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; color: #e2e8f0; margin: 0;">
                  <input type="checkbox" id="chk-excel-auto-machines" checked style="cursor: pointer;" />
                  <span>Auto-create missing Machine Names</span>
                </label>
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; color: #e2e8f0; margin: 0;">
                  <input type="checkbox" id="chk-excel-clean-names" checked style="cursor: pointer;" />
                  <span>Format &amp; Standardize Names</span>
                </label>
              </div>

            </div>
          ` : `
            <div style="background: rgba(0,0,0,0.15); border: 1px dashed var(--border-color); border-radius: var(--radius-md); padding: 24px; text-align: center; color: var(--text-muted);">
              <div style="font-size: 22px; margin-bottom: 6px;">📋</div>
              <div style="font-size: 12.5px; font-weight: 700; color: #cbd5e1;">No Spreadsheet Data Loaded Yet</div>
              <div style="font-size: 11px; margin-top: 3px;">
                Upload an Excel file or paste rows above to preview Machine Names, Brands, and Models before importing.
              </div>
            </div>
          `}

        </div>

        <!-- Footer -->
        <div class="modal-footer" style="padding: 12px 20px; border-top: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; background: var(--bg-surface);">
          <div style="font-size: 11px; color: var(--text-muted);">
            ${validRows.length > 0 ? `Ready to import <strong>${validRows.length}</strong> items into Cloud &amp; Local Database.` : 'Upload or paste rows to begin.'}
          </div>
          <div style="display: flex; gap: 8px;">
            <button type="button" id="btn-cancel-storage-modal" class="btn btn-secondary btn-sm" style="font-weight: 700;">
              Close
            </button>
            <button 
              type="button" 
              id="btn-excel-modal-execute-import" 
              class="btn btn-primary btn-sm" 
              style="font-weight: 800; background: linear-gradient(135deg, #059669 0%, #047857 100%); border-color: #10b981; color: #fff; padding: 7px 20px; font-size: 12.5px; box-shadow: 0 2px 10px rgba(5, 150, 105, 0.4);"
              ${validRows.length === 0 ? 'disabled' : ''}
            >
              📥 Import to Database (${validRows.length} Records)
            </button>
          </div>
        </div>

      </div>
    </div>
  `;
}

/**
 * Modals Renderer (Rendered into isolated #storage-modal-layer)
 */
function renderStorageModal() {
  if (!activeModalState) return '';

  // 00. EXCEL SHEET INPUT / EXPORT STUDIO MODAL
  if (activeModalState.type === 'EXCEL_IMPORT_EXPORT') {
    return renderExcelImportExportModal();
  }

  // 0. MANAGE BRANDS MODAL
  if (activeModalState.type === 'MANAGE_BRANDS') {
    const brdTable = storage.getTable(TABLE_NAMES.BRANDS) || [];
    const allModels = storage.getTable(TABLE_NAMES.MODELS) || [];
    const brandMap = new Map();
    brdTable.forEach(b => {
      if (b && b.name) {
        brandMap.set(b.name.trim().toUpperCase(), { id: b.id, name: b.name.trim().toUpperCase() });
      }
    });
    allModels.forEach(m => {
      const bName = (m.brand || '').trim().toUpperCase();
      if (bName && !brandMap.has(bName)) {
        brandMap.set(bName, { id: m.brandId || '', name: bName });
      }
    });
    const brdList = Array.from(brandMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    return `
      <div class="modal-overlay" id="modal-manage-brands-overlay">
        <div class="modal-dialog" style="max-width: 500px;">
          <div class="modal-header" style="border-bottom: 1px solid var(--border-color); padding: 14px 18px;">
            <div class="modal-title" style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 20px;">🏷️</span>
              <span style="font-weight: 800; font-size: 15px; color: #fff;">Registered Machinery Brands</span>
              <span class="badge badge-active" style="font-size: 11px;">${brdList.length} Brands</span>
            </div>
            <button type="button" id="btn-close-storage-modal" class="btn btn-ghost btn-sm">✕</button>
          </div>

          <div class="modal-body" style="padding: 16px; display: flex; flex-direction: column; gap: 14px; max-height: 60vh; overflow-y: auto;">
            <!-- Add New Brand Quick Input -->
            <form id="form-quick-add-brand" style="display: flex; gap: 8px;">
              <input type="text" id="inp-quick-brand-name" class="form-control" placeholder="Type new brand name (e.g. JUKI, BROTHER)..." required style="font-size: 12.5px; text-transform: uppercase;" />
              <button type="submit" class="btn btn-primary btn-sm" style="font-weight: 700; white-space: nowrap; padding: 6px 14px;">➕ Add Brand</button>
            </form>

            <div style="font-size: 11px; color: var(--text-muted);">
              Brands can be added here or automatically in Step 2 when pasting models. Delete any unwanted brand:
            </div>

            <!-- Brands List -->
            <div style="display: flex; flex-direction: column; gap: 6px;" id="brands-modal-list">
              ${brdList.length === 0 ? `
                <div style="text-align: center; padding: 30px 10px; color: var(--text-muted); background: rgba(0,0,0,0.2); border-radius: var(--radius-sm); border: 1px dashed var(--border-color);">
                  <div style="font-size: 24px; margin-bottom: 4px;">🏷️</div>
                  <div style="font-size: 13px; font-weight: 700; color: #fff;">No Brands Registered</div>
                  <div style="font-size: 11px; margin-top: 2px;">Enter a brand name above or use Step 2 to register brands.</div>
                </div>
              ` : brdList.map(b => `
                <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); padding: 8px 12px; border-radius: var(--radius-sm);">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 14px;">🏷️</span>
                    <strong style="font-size: 13px; color: #34d399; letter-spacing: 0.5px;">${b.name}</strong>
                  </div>
                  <div style="display: flex; align-items: center; gap: 6px;">
                    <button type="button" class="btn btn-ghost btn-sm btn-edit-brand-record" data-id="${b.id}" data-name="${b.name}" style="color: #38bdf8; font-size: 11.5px; padding: 2px 8px; border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 4px;" title="Edit / Rename Brand">
                      ✏️ Edit
                    </button>
                    <button type="button" class="btn btn-ghost btn-sm btn-delete-brand-record" data-id="${b.id}" data-name="${b.name}" style="color: #f87171; font-size: 11.5px; padding: 2px 8px;" title="Delete Brand">
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="modal-footer" style="padding: 12px 18px; border-top: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
            ${brdList.length > 0 ? `
              <button type="button" id="btn-wipe-all-brands" class="btn btn-ghost btn-sm" style="color: #f87171; font-weight: 700; font-size: 11px;">
                🧹 Delete All Brands
              </button>
            ` : '<div></div>'}
            <button type="button" id="btn-close-storage-modal-footer" class="btn btn-secondary btn-sm" style="font-weight: 700;">
              Close
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // 1. ADD / EDIT STORAGE ITEM MODAL
  if (activeModalState.type === 'ADD' || activeModalState.type === 'EDIT') {
    const isEdit = activeModalState.type === 'EDIT';
    const it = activeModalState.data || {};
    const cat = it.category || activeTab || 'MACHINE';
    const schema = storageSchemaService.getSchema(cat);
    const fields = storageSchemaService.getCategoryFields(cat);

    return `
      <div class="modal-overlay" id="modal-storage-item-overlay">
        <div class="modal-dialog" style="max-width: 600px;">
          <div class="modal-header">
            <div class="modal-title">
              <span>${isEdit ? '✏️ Edit Master Storage Record' : '➕ Add Master Storage Record'}</span>
              <span class="badge badge-active" style="font-size: 10px;">${schema.icon} ${schema.title}</span>
            </div>
            <button type="button" id="btn-close-storage-modal" class="btn btn-ghost btn-sm">✕</button>
          </div>

          <form id="form-storage-item" class="modal-body" style="padding: 18px; display: flex; flex-direction: column; gap: 12px; max-height: 70vh; overflow-y: auto;">
            <input type="hidden" name="id" value="${it.id || ''}" />
            <input type="hidden" name="category" value="${cat}" />

            <div class="form-grid-2">
              ${fields.map(f => {
                const val = it[f.key] || '';
                if (f.type === 'select') {
                  const opts = f.options || [];
                  return `
                    <div class="form-group">
                      <label class="form-label">${f.label} ${f.required ? '<span class="req">*</span>' : ''}</label>
                      <select name="${f.key}" class="form-control" ${f.required ? 'required' : ''}>
                        <option value="">Select ${f.label}...</option>
                        ${opts.map(o => `<option value="${o}" ${val === o ? 'selected' : ''}>${o}</option>`).join('')}
                      </select>
                    </div>
                  `;
                }
                return `
                  <div class="form-group">
                    <label class="form-label">${f.label} ${f.required ? '<span class="req">*</span>' : ''}</label>
                    <input 
                      type="${f.type === 'number' ? 'number' : 'text'}" 
                      name="${f.key}" 
                      class="form-control" 
                      value="${val}" 
                      placeholder="${f.placeholder || ''}" 
                      ${f.required ? 'required' : ''} 
                      style="${(f.key === 'model' || f.key === 'brand' || f.key === 'code') ? 'font-weight: 800;' : ''}"
                    />
                  </div>
                `;
              }).join('')}
            </div>

            <div class="form-group">
              <label class="form-label">
                Recognized Aliases or Common Misspellings (comma separated)
              </label>
              <input 
                type="text" 
                name="aliases" 
                class="form-control" 
                value="${Array.isArray(it.aliases) ? it.aliases.join(', ') : ''}" 
                placeholder="e.g. juki, juky, ddl8700, ddl 8700" 
              />
              <div style="font-size: 10.5px; color: var(--text-muted); margin-top: 2px;">
                💡 Used by the fuzzy auto-correction engine to map colloquial terms to this canonical record.
              </div>
            </div>

            <div class="modal-footer" style="padding: 10px 0 0; display: flex; justify-content: flex-end; gap: 8px;">
              <button type="button" id="btn-cancel-storage-modal" class="btn btn-secondary btn-sm">Cancel</button>
              <button type="submit" class="btn btn-primary btn-sm" style="font-weight: 700;">💾 Save Record</button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  // 1B. 2-BOX FAST MODEL IMPORTER (DROPDOWN MACHINE SELECT + BRAND & MODEL NUMBER BOXES)
  if (activeModalState.type === 'BULK_ADD_MODELS') {
    const defaultMachine = activeModalState.machineName || '';
    const allRegisteredMachines = smartStorageService.getAllMachineNames();
    
    // Ensure defaultMachine is in the list
    if (defaultMachine && !allRegisteredMachines.some(m => m.toLowerCase() === defaultMachine.toLowerCase())) {
      allRegisteredMachines.unshift(defaultMachine);
    }
    if (allRegisteredMachines.length === 0) {
      allRegisteredMachines.push('Plane Machine', 'Overlock Machine', 'Vertical Machine', 'Interlock Machine');
    }

    const machineOptions = allRegisteredMachines.map((m, idx) => `
      <option value="${m}" ${m.toLowerCase() === defaultMachine.toLowerCase() ? 'selected' : ''}>SL #${idx + 1}: ${m}</option>
    `).join('');

    return `
      <div class="modal-overlay" id="modal-bulk-add-models-overlay">
        <div class="modal-dialog" style="max-width: 860px; width: 95%; max-height: 92vh; display: flex; flex-direction: column;">
          
          <!-- Header -->
          <div class="modal-header" style="border-bottom: 1px solid var(--border-color); padding: 14px 20px;">
            <div class="modal-title" style="display: flex; align-items: center; gap: 8px;">
              <span>📥 Step 2: Add Models to Machine</span>
              <span class="badge badge-active" style="font-size: 11px;">Dropdown System + 2 Boxes</span>
            </div>
            <button type="button" id="btn-close-storage-modal" class="btn btn-ghost btn-sm">✕</button>
          </div>

          <!-- Body -->
          <form id="form-bulk-add-models" class="modal-body" style="padding: 16px 20px; display: flex; flex-direction: column; gap: 14px; overflow-y: auto;">
            
            <!-- STEP 1: DROPDOWN SYSTEM (SELECT MACHINE NAME) -->
            <div style="background: rgba(56, 189, 248, 0.08); border: 1.5px solid rgba(56, 189, 248, 0.35); border-radius: var(--radius-sm); padding: 12px 16px; display: flex; flex-direction: column; gap: 8px;">
              <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                <label for="sel-target-machine-name" style="font-weight: 800; color: #38bdf8; font-size: 13px; margin: 0; display: flex; align-items: center; gap: 6px;">
                  <span>🧵 Step 1: Select Machine Name (Dropdown) *</span>
                </label>
                <div style="display: flex; align-items: center; gap: 6px;">
                  <button type="button" id="btn-toggle-inline-new-machine" class="btn btn-ghost btn-sm" style="font-size: 11px; color: #38bdf8; border: 1px dashed rgba(56, 189, 248, 0.5); padding: 2px 10px; font-weight: 700;">
                    ➕ New Machine Name
                  </button>
                  <button type="button" id="btn-switch-to-bulk-machine-input" class="btn btn-ghost btn-sm" style="font-size: 11px; color: #94a3b8; padding: 2px 8px;">
                    📋 Paste Machine Names
                  </button>
                </div>
              </div>

              <select id="sel-target-machine-name" class="form-control" style="font-size: 13.5px; font-weight: 700; height: 38px; background: #0f172a; color: #fff; border: 1.5px solid rgba(56, 189, 248, 0.4);" required>
                <option value="">-- Choose Machine Name from Dropdown --</option>
                ${machineOptions}
              </select>

              <!-- Quick Add Machine Input (hidden by default, toggled on click) -->
              <div id="box-inline-new-machine" style="display: none; align-items: center; gap: 8px; margin-top: 4px;">
                <input type="text" id="inp-inline-new-machine-name" class="form-control" placeholder="Type new machine name (e.g. Double Needle Lockstitch)" style="font-size: 12px;" />
                <button type="button" id="btn-save-inline-new-machine" class="btn btn-primary btn-sm" style="font-size: 11.5px; white-space: nowrap; font-weight: 700;">
                  💾 Save &amp; Select
                </button>
                <button type="button" id="btn-cancel-inline-new-machine" class="btn btn-ghost btn-sm" style="font-size: 11.5px;">✕</button>
              </div>
            </div>

            <!-- STEP 2: 2 TA BOX (BOX 1: BRAND, BOX 2: MODEL NUMBER) -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
              
              <!-- BOX 1: BRAND -->
              <div style="display: flex; flex-direction: column; gap: 6px; background: rgba(255, 255, 255, 0.02); border: 1.5px solid rgba(52, 211, 153, 0.3); border-radius: var(--radius-sm); padding: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <label class="form-label" style="font-weight: 800; color: #34d399; font-size: 12.5px; margin: 0;">
                    🏷️ Box 1: Brand (One per line)
                  </label>
                  <span id="cnt-box-brand" class="badge" style="font-size: 10px; background: rgba(52, 211, 153, 0.15); color: #34d399; font-weight: 700;">1 line</span>
                </div>
                <div style="font-size: 11px; color: var(--text-muted);">
                  Enter 1 brand for all models, OR enter brands line-by-line
                </div>
                <textarea 
                  id="txt-col-brand" 
                  class="form-control" 
                  rows="9" 
                  placeholder="JUKI&#10;JUKI&#10;BROTHER&#10;PEGASUS&#10;JACK&#10;...or enter 1 brand for all"
                  style="font-family: var(--font-mono); font-size: 12px; line-height: 1.5; text-transform: uppercase; resize: vertical;"
                >JUKI</textarea>

                <!-- Quick Brand Chips -->
                <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 2px;">
                  <span style="font-size: 10px; color: var(--text-muted); align-self: center;">Quick:</span>
                  <button type="button" class="btn-col-brand-chip badge" data-brand="JUKI" style="cursor: pointer; font-size: 10px; padding: 2px 6px; background: rgba(56, 189, 248, 0.15); color: #38bdf8;">JUKI</button>
                  <button type="button" class="btn-col-brand-chip badge" data-brand="BROTHER" style="cursor: pointer; font-size: 10px; padding: 2px 6px; background: rgba(167, 139, 250, 0.15); color: #a78bfa;">BROTHER</button>
                  <button type="button" class="btn-col-brand-chip badge" data-brand="PEGASUS" style="cursor: pointer; font-size: 10px; padding: 2px 6px; background: rgba(244, 114, 182, 0.15); color: #f472b6;">PEGASUS</button>
                  <button type="button" class="btn-col-brand-chip badge" data-brand="JACK" style="cursor: pointer; font-size: 10px; padding: 2px 6px; background: rgba(251, 191, 36, 0.15); color: #fbbf24;">JACK</button>
                  <button type="button" class="btn-col-brand-chip badge" data-brand="TYPICAL" style="cursor: pointer; font-size: 10px; padding: 2px 6px; background: rgba(52, 211, 153, 0.15); color: #34d399;">TYPICAL</button>
                  <button type="button" class="btn-col-brand-chip badge" data-brand="SIRUBA" style="cursor: pointer; font-size: 10px; padding: 2px 6px; background: rgba(251, 146, 60, 0.15); color: #fb923c;">SIRUBA</button>
                </div>
              </div>

              <!-- BOX 2: MODEL NUMBER -->
              <div style="display: flex; flex-direction: column; gap: 6px; background: rgba(255, 255, 255, 0.02); border: 1.5px solid rgba(251, 191, 36, 0.3); border-radius: var(--radius-sm); padding: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <label class="form-label" style="font-weight: 800; color: #fbbf24; font-size: 12.5px; margin: 0;">
                    🔢 Box 2: Model Number (One per line) *
                  </label>
                  <span id="cnt-box-model" class="badge" style="font-size: 10px; background: rgba(251, 191, 36, 0.15); color: #fbbf24; font-weight: 700;">0 models</span>
                </div>
                <div style="font-size: 11px; color: var(--text-muted);">
                  Paste model numbers line-by-line (one under another)
                </div>
                <textarea 
                  id="txt-col-model" 
                  class="form-control" 
                  rows="9" 
                  placeholder="DDL-8700&#10;DDL-9000C&#10;DDL-900BB &amp; C&#10;S-7200C&#10;MO-6814S&#10;...paste unlimited models here"
                  style="font-family: var(--font-mono); font-size: 12px; line-height: 1.5; resize: vertical;"
                  required
                ></textarea>

                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 2px;">
                  <button type="button" id="btn-quick-sample-models" class="btn btn-ghost btn-sm" style="font-size: 11px; color: #fbbf24; padding: 1px 8px; font-weight: 700;">
                    📋 Load Sample Models
                  </button>
                  <button type="button" id="btn-clear-model-boxes" class="btn btn-ghost btn-sm" style="font-size: 11px; color: #f87171; padding: 1px 8px; font-weight: 700;">
                    🧹 Clear Boxes
                  </button>
                </div>
              </div>

            </div>

            <!-- LIVE REAL-TIME PREVIEW -->
            <div style="display: flex; flex-direction: column; gap: 6px;">
              <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 10px;">
                <div style="font-weight: 800; font-size: 12.5px; color: #fff; display: flex; align-items: center; gap: 6px;">
                  <span>👁️ Live Preview</span>
                </div>
                <div id="lbl-live-model-counter" style="font-size: 11.5px; font-weight: 700; color: #94a3b8;">
                  0 Models Ready
                </div>
              </div>

              <div id="bulk-models-live-preview-box">
                <div style="text-align: center; padding: 18px; color: var(--text-muted); font-size: 12px; border: 1.5px dashed rgba(255,255,255,0.1); border-radius: var(--radius-sm); background: rgba(0,0,0,0.15);">
                  Select a Machine Name above and paste model numbers in Box 2. The live preview will appear here instantly.
                </div>
              </div>
            </div>

            <!-- FOOTER -->
            <div class="modal-footer" style="padding: 10px 0 0; display: flex; justify-content: space-between; align-items: center;">
              <button type="button" id="btn-cancel-storage-modal" class="btn btn-secondary btn-sm">Cancel</button>
              <button type="submit" id="btn-submit-bulk-models" class="btn btn-primary btn-sm" style="font-weight: 800; padding: 8px 24px; font-size: 13px; background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); border-color: #38bdf8;" disabled>
                💾 Submit &amp; Save Models
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  // 1B-EDIT. EDIT MODEL SPECIFICATION MODAL
  if (activeModalState.type === 'EDIT_MODEL_SPEC') {
    const data = activeModalState.data || {};
    const allMachineNames = smartStorageService.getAllMachineNames();
    const registeredBrands = storage.getTable(TABLE_NAMES.BRANDS) || [];
    const brandSet = new Set();
    registeredBrands.forEach(b => {
      if (b && b.name && b.name.trim()) brandSet.add(b.name.trim().toUpperCase());
    });
    const allHierarchyGroups = smartStorageService.getMachineModelsHierarchy();
    allHierarchyGroups.forEach(g => {
      (g.models || []).forEach(m => {
        if (m.brand && m.brand.trim()) brandSet.add(m.brand.trim().toUpperCase());
      });
    });
    const allBrands = Array.from(brandSet).sort();

    return `
      <div class="modal-overlay" id="modal-edit-model-spec-overlay">
        <div class="modal-dialog" style="max-width: 500px; width: 95%;">
          <div class="modal-header" style="border-bottom: 1px solid var(--border-color); padding: 14px 18px;">
            <div class="modal-title" style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 18px;">✏️</span>
              <span style="font-weight: 800; font-size: 15px; color: #fff;">Edit Model Specification</span>
              <span class="badge badge-active" style="font-size: 11px;">${data.model || ''}</span>
            </div>
            <button type="button" id="btn-close-storage-modal" class="btn btn-ghost btn-sm">✕</button>
          </div>

          <form id="form-edit-model-spec" class="modal-body" style="padding: 18px; display: flex; flex-direction: column; gap: 14px;">
            <input type="hidden" id="inp-edit-model-id" value="${data.id || ''}" />
            <input type="hidden" id="inp-orig-machine" value="${data.machineName || ''}" />
            <input type="hidden" id="inp-orig-brand" value="${data.brand || ''}" />
            <input type="hidden" id="inp-orig-model" value="${data.model || ''}" />

            <!-- Machine Name -->
            <div class="form-group" style="display: flex; flex-direction: column; gap: 5px;">
              <label class="form-label" style="font-weight: 700; color: #38bdf8; font-size: 12px; margin: 0;">
                Machine Name / Type *
              </label>
              <input 
                type="text" 
                id="inp-edit-machine-name" 
                class="form-control" 
                list="list-edit-machines" 
                value="${data.machineName || ''}" 
                placeholder="Select or enter machine type..." 
                required 
                style="font-size: 12.5px; font-weight: 700;"
              />
              <datalist id="list-edit-machines">
                ${allMachineNames.map(mn => `<option value="${mn}"></option>`).join('')}
              </datalist>
              <span style="font-size: 11px; color: var(--text-muted);">Assign to an existing machine type or type a new one.</span>
            </div>

            <!-- Brand -->
            <div class="form-group" style="display: flex; flex-direction: column; gap: 5px;">
              <label class="form-label" style="font-weight: 700; color: #34d399; font-size: 12px; margin: 0;">
                Brand *
              </label>
              <input 
                type="text" 
                id="inp-edit-brand-name" 
                class="form-control" 
                list="list-edit-brands" 
                value="${data.brand || 'JUKI'}" 
                placeholder="e.g. JUKI, BROTHER, PEGASUS, SIRUBA..." 
                required 
                style="font-size: 12.5px; font-weight: 700; text-transform: uppercase;"
              />
              <datalist id="list-edit-brands">
                ${allBrands.map(b => `<option value="${b}"></option>`).join('')}
              </datalist>
              <span style="font-size: 11px; color: var(--text-muted);">Brand will be saved in uppercase.</span>
            </div>

            <!-- Model Number -->
            <div class="form-group" style="display: flex; flex-direction: column; gap: 5px;">
              <label class="form-label" style="font-weight: 700; color: #fbbf24; font-size: 12px; margin: 0;">
                Model Number / Spec *
              </label>
              <input 
                type="text" 
                id="inp-edit-model-number" 
                class="form-control" 
                value="${data.model || ''}" 
                placeholder="e.g. DDL-9000A-SH, MO-6814S..." 
                required 
                style="font-family: var(--font-mono); font-size: 13px; font-weight: 700;"
              />
            </div>

            <!-- Status -->
            <div class="form-group" style="display: flex; flex-direction: column; gap: 5px;">
              <label class="form-label" style="font-weight: 700; color: #94a3b8; font-size: 12px; margin: 0;">
                Status
              </label>
              <select id="sel-edit-model-status" class="form-control" style="font-size: 12px; font-weight: 700;">
                <option value="ACTIVE" ${(data.status || 'ACTIVE') === 'ACTIVE' ? 'selected' : ''}>ACTIVE (Available in inventory &amp; operations)</option>
                <option value="INACTIVE" ${(data.status || '') === 'INACTIVE' ? 'selected' : ''}>INACTIVE</option>
              </select>
            </div>

            <div class="modal-footer" style="padding: 12px 0 0; display: flex; justify-content: flex-end; gap: 8px; border-top: 1px solid var(--border-color);">
              <button type="button" id="btn-cancel-storage-modal" class="btn btn-secondary btn-sm" style="font-weight: 700;">Cancel</button>
              <button type="submit" id="btn-submit-edit-model-spec" class="btn btn-primary btn-sm" style="font-weight: 800; background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);">
                💾 Save Changes
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  // 1B-RENAME-MACHINE. RENAME MACHINE TYPE & SHORT CODE MODAL
  if (activeModalState.type === 'EDIT_MACHINE_NAME') {
    const curName = activeModalState.machineName || '';
    const curCode = activeModalState.code || smartStorageService.getMachineShortCode(curName) || '';
    const returnTo = activeModalState.returnTo || null;
    return `
      <div class="modal-overlay" id="modal-edit-machine-name-overlay">
        <div class="modal-dialog" style="max-width: 480px; width: 95%;">
          <div class="modal-header" style="border-bottom: 1px solid var(--border-color); padding: 14px 18px;">
            <div class="modal-title" style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 18px;">✏️</span>
              <span style="font-weight: 800; font-size: 15px; color: #fff;">Edit Machine Type &amp; Short Code</span>
            </div>
            <button type="button" id="btn-close-storage-modal" class="btn btn-ghost btn-sm">✕</button>
          </div>

          <form id="form-edit-machine-name" class="modal-body" style="padding: 18px; display: flex; flex-direction: column; gap: 14px;">
            <input type="hidden" id="inp-orig-machine-name" value="${curName}" />
            <input type="hidden" id="inp-return-to" value="${returnTo || ''}" />

            <div class="form-group" style="display: flex; flex-direction: column; gap: 6px;">
              <label class="form-label" style="font-weight: 700; color: #38bdf8; font-size: 12.5px; margin: 0;">
                Machine Name / Type *
              </label>
              <input 
                type="text" 
                id="inp-new-renamed-machine-name" 
                class="form-control" 
                value="${curName}" 
                required 
                autofocus 
                style="font-size: 13px; font-weight: 700;"
              />
            </div>

            <div class="form-group" style="display: flex; flex-direction: column; gap: 6px;">
              <label class="form-label" style="font-weight: 700; color: #38bdf8; font-size: 12.5px; margin: 0;">
                Machine Short Code (e.g. P/M, D/N-A, O/L, B/T, C/S)
              </label>
              <input 
                type="text" 
                id="inp-machine-short-code" 
                class="form-control" 
                value="${curCode}" 
                placeholder="e.g. P/M"
                style="font-size: 13px; font-weight: 700; font-family: monospace; max-width: 200px;"
              />
              <div style="background: rgba(56, 189, 248, 0.08); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 4px; padding: 8px 10px; font-size: 11px; color: #cbd5e1; line-height: 1.4;">
                ℹ️ This short code will automatically prefix Excel serial numbers during import (e.g. <code>P/M-400035</code>).
              </div>
            </div>

            <div class="modal-footer" style="padding: 10px 0 0; display: flex; justify-content: flex-end; gap: 8px; border-top: 1px solid var(--border-color);">
              <button type="button" id="btn-cancel-storage-modal" class="btn btn-secondary btn-sm" style="font-weight: 700;">Cancel</button>
              <button type="submit" id="btn-submit-rename-machine" class="btn btn-primary btn-sm" style="font-weight: 800; background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);">
                💾 Save Changes
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  // 1B-RENAME-BRAND. RENAME BRAND MODAL
  if (activeModalState.type === 'EDIT_BRAND_NAME') {
    const curBrand = activeModalState.brandName || '';
    const bId = activeModalState.brandId || '';
    return `
      <div class="modal-overlay" id="modal-edit-brand-name-overlay">
        <div class="modal-dialog" style="max-width: 480px; width: 95%;">
          <div class="modal-header" style="border-bottom: 1px solid var(--border-color); padding: 14px 18px;">
            <div class="modal-title" style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 18px;">🏷️</span>
              <span style="font-weight: 800; font-size: 15px; color: #fff;">Rename Machinery Brand</span>
            </div>
            <button type="button" id="btn-close-storage-modal" class="btn btn-ghost btn-sm">✕</button>
          </div>

          <form id="form-edit-brand-name" class="modal-body" style="padding: 18px; display: flex; flex-direction: column; gap: 14px;">
            <input type="hidden" id="inp-orig-brand-id" value="${bId}" />
            <input type="hidden" id="inp-orig-brand-name" value="${curBrand}" />

            <div class="form-group" style="display: flex; flex-direction: column; gap: 6px;">
              <label class="form-label" style="font-weight: 700; color: #34d399; font-size: 12.5px; margin: 0;">
                Brand Name *
              </label>
              <input 
                type="text" 
                id="inp-new-renamed-brand-name" 
                class="form-control" 
                value="${curBrand}" 
                required 
                autofocus 
                style="font-size: 13px; font-weight: 700; text-transform: uppercase;"
              />
              <div style="background: rgba(52, 211, 153, 0.08); border: 1px solid rgba(52, 211, 153, 0.25); border-radius: 4px; padding: 8px 10px; font-size: 11px; color: #cbd5e1; line-height: 1.4;">
                ℹ️ Renaming will automatically update this brand across all registered models, machines, and master tables.
              </div>
            </div>

            <div class="modal-footer" style="padding: 10px 0 0; display: flex; justify-content: flex-end; gap: 8px; border-top: 1px solid var(--border-color);">
              <button type="button" id="btn-cancel-edit-brand" class="btn btn-secondary btn-sm" style="font-weight: 700;">Back to Brands</button>
              <button type="submit" id="btn-submit-rename-brand" class="btn btn-primary btn-sm" style="font-weight: 800; background: linear-gradient(135deg, #059669 0%, #047857 100%);">
                💾 Save Brand Name
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  // 1C. ADD NEW MACHINE NAME (ALL ENGLISH)
  if (activeModalState.type === 'ADD_MACHINE_NAME') {
    return `
      <div class="modal-overlay" id="modal-add-machine-name-overlay">
        <div class="modal-dialog" style="max-width: 480px;">
          <div class="modal-header">
            <div class="modal-title">
              <span>➕ Add Machine Name / Type</span>
            </div>
            <button type="button" id="btn-close-storage-modal" class="btn btn-ghost btn-sm">✕</button>
          </div>

          <form id="form-add-machine-name" class="modal-body" style="padding: 18px; display: flex; flex-direction: column; gap: 12px;">
            <div class="form-group">
              <label class="form-label" style="font-weight: 700; color: #fff;">Machine Name / Category *</label>
              <input 
                type="text" 
                id="inp-new-machine-name" 
                class="form-control" 
                placeholder="e.g. Plain Machine 1-Needle, Coverstitch Machine, Feed Off The Arm" 
                required 
                autofocus
                style="font-weight: 700;"
              />
              <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">
                Enter the machine type name. You can add model numbers under it anytime.
              </div>
            </div>

            <div class="modal-footer" style="padding: 10px 0 0; display: flex; justify-content: flex-end; gap: 8px;">
              <button type="button" id="btn-cancel-storage-modal" class="btn btn-secondary btn-sm">Cancel</button>
              <button type="submit" class="btn btn-primary btn-sm" style="font-weight: 800;">
                💾 Save Machine Name
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  // 1D. BULK IMPORT MACHINE NAMES (STEP 1)
  if (activeModalState.type === 'BULK_IMPORT_MACHINE_NAMES') {
    const existingNames = smartStorageService.getAllMachineNames();
    return `
      <div class="modal-overlay" id="modal-bulk-machine-names-overlay">
        <div class="modal-dialog" style="max-width: 620px; width: 95%; max-height: 90vh; display: flex; flex-direction: column;">
          <div class="modal-header" style="border-bottom: 1px solid var(--border-color); padding: 14px 20px;">
            <div class="modal-title" style="display: flex; align-items: center; gap: 8px;">
              <span>🧵 Step 1: Input Machine Names (Bulk)</span>
              <span class="badge badge-active" style="font-size: 11px;">${existingNames.length} Registered</span>
            </div>
            <button type="button" id="btn-close-storage-modal" class="btn btn-ghost btn-sm">✕</button>
          </div>

          <form id="form-bulk-machine-names" class="modal-body" style="padding: 18px 20px; display: flex; flex-direction: column; gap: 14px; overflow-y: auto;">
            <div class="form-group" style="display: flex; flex-direction: column; gap: 6px;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <label class="form-label" style="font-weight: 800; color: #38bdf8; font-size: 13px; margin: 0;">
                  Paste Machine Names (One under another, line-by-line): *
                </label>
                <span id="cnt-bulk-mn-lines" class="badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; font-size: 10px; font-weight: 700;">0 lines</span>
              </div>
              <div style="font-size: 11px; color: var(--text-muted);">
                Input your machine types here. Once saved, you can pick any machine from the dropdown in Step 2 to add models under it.
              </div>
              <textarea 
                id="txt-bulk-machine-names" 
                class="form-control" 
                rows="7" 
                placeholder="Plane Machine&#10;Overlock Machine&#10;Vertical Machine&#10;Interlock Machine&#10;Button Hole Machine&#10;Button Attach Machine&#10;Feed Off The Arm Machine&#10;...paste your list here"
                style="font-family: var(--font-mono); font-size: 12px; line-height: 1.5;"
                required
              ></textarea>
              <div style="display: flex; justify-content: flex-end; align-items: center; margin-top: 2px;">
                <button type="button" id="btn-load-sample-mn" class="btn btn-ghost btn-sm" style="font-size: 11px; color: #38bdf8; padding: 2px 8px; font-weight: 700;">
                  📋 Load Sample Machine Names
                </button>
              </div>
            </div>

            <!-- Existing Machine Names Section with Quick Delete -->
            <div style="border-top: 1px solid rgba(255,255,255,0.08); padding-top: 10px; display: flex; flex-direction: column; gap: 6px;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <label style="font-weight: 700; font-size: 12px; color: #fff; margin: 0;">
                  Registered Machine Names in System (${existingNames.length}):
                </label>
                <button type="button" id="btn-purge-empty-dummy-names" class="btn btn-ghost btn-sm" style="font-size: 10.5px; color: #f87171; border: 1px solid rgba(248,113,113,0.3); padding: 2px 8px; font-weight: 700;">
                  🧹 Clear 0-Model Dummy Names
                </button>
              </div>
              <div style="display: flex; flex-wrap: wrap; gap: 6px; max-height: 130px; overflow-y: auto; padding: 6px; background: rgba(0,0,0,0.25); border-radius: var(--radius-sm); border: 1px solid rgba(255,255,255,0.06);">
                ${existingNames.length === 0 ? '<div style="font-size: 11px; color: var(--text-muted); padding: 6px;">No machine names registered yet. Paste names above to start.</div>' : existingNames.map((name, idx) => `
                  <span class="badge" style="background: rgba(56, 189, 248, 0.12); border: 1px solid rgba(56, 189, 248, 0.25); color: #e2e8f0; font-size: 11px; padding: 4px 8px; display: inline-flex; align-items: center; gap: 6px;">
                    <strong style="color: #38bdf8; font-family: var(--font-mono); font-weight: 800;">SL #${idx + 1}</strong>
                    <span>${name}</span>
                    <button type="button" class="btn-edit-single-mn" data-name="${name}" style="background: none; border: none; color: #38bdf8; cursor: pointer; padding: 0 2px; font-size: 11px; line-height: 1;" title="Rename this machine name">✏️</button>
                    <button type="button" class="btn-delete-single-mn" data-name="${name}" style="background: none; border: none; color: #f87171; cursor: pointer; padding: 0 2px; font-size: 11px; line-height: 1;" title="Delete this machine name">✕</button>
                  </span>
                `).join('')}
              </div>
            </div>

            <div class="modal-footer" style="padding: 10px 0 0; display: flex; justify-content: space-between; align-items: center;">
              <button type="button" id="btn-cancel-storage-modal" class="btn btn-secondary btn-sm">Cancel</button>
              <div style="display: flex; gap: 8px;">
                <button type="submit" id="btn-save-mn-only" class="btn btn-secondary btn-sm" style="font-weight: 700;">
                  💾 Save Machine Names
                </button>
                <button type="button" id="btn-save-mn-and-open-models" class="btn btn-primary btn-sm" style="font-weight: 800; background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);">
                  👉 Save &amp; Go to Step 2 (Add Models)
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  // 2. PRE-IMPORT QUALITY GATE STUDIO
  if (activeModalState.type === 'QUALITY_GATE') {
    const qg = qualityGateData;
    if (!qg) return '';

    const filterType = qg.filter || 'ALL';
    const displayedRows = qg.stagedRows.filter(r => {
      if (filterType === 'READY') return r.status === 'READY';
      if (filterType === 'WARNING') return r.status === 'WARNING';
      if (filterType === 'FATAL') return r.status === 'FATAL';
      return true;
    });

    return `
      <div class="modal-overlay" id="modal-quality-gate-overlay">
        <div class="modal-dialog modal-dialog-xl" style="max-width: 920px;">
          <div class="modal-header" style="background: var(--bg-card); border-bottom: 1px solid var(--border-color); padding: 14px 20px;">
            <div class="modal-title" style="display: flex; align-items: center; gap: 8px;">
              <span>🛡️ Pre-Import Quality Gate &amp; Staging Studio</span>
              <span class="badge badge-active" style="font-size: 10px;">Category: ${qg.category}</span>
            </div>
            <button type="button" id="btn-close-storage-modal" class="btn btn-ghost btn-sm" style="font-size: 16px;">✕</button>
          </div>

          <div class="modal-body" style="padding: 16px 20px; display: flex; flex-direction: column; gap: 12px; max-height: 70vh; overflow-y: auto;">
            <div style="font-size: 12px; color: var(--text-secondary);">
              Master Data is the single source of truth for the entire factory ERP. Only <strong>100% verified, clean records</strong> are committed to protect other modules from errors.
            </div>

            <!-- KPI Counters -->
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;">
              <div style="background: rgba(0,0,0,0.25); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 8px 12px;">
                <div style="font-size: 10px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Total Staged Rows</div>
                <div style="font-size: 18px; font-weight: 800; color: #fff;">${qg.totalCount}</div>
              </div>
              <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.4); border-radius: var(--radius-sm); padding: 8px 12px;">
                <div style="font-size: 10px; font-weight: 700; color: #34d399; text-transform: uppercase;">✅ Verified Ready</div>
                <div style="font-size: 18px; font-weight: 800; color: #34d399;">${qg.readyCount}</div>
              </div>
              <div style="background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.4); border-radius: var(--radius-sm); padding: 8px 12px;">
                <div style="font-size: 10px; font-weight: 700; color: #fbbf24; text-transform: uppercase;">⚠️ Auto-Fixable</div>
                <div style="font-size: 18px; font-weight: 800; color: #fbbf24;">${qg.warningCount}</div>
              </div>
              <div style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.4); border-radius: var(--radius-sm); padding: 8px 12px;">
                <div style="font-size: 10px; font-weight: 700; color: #f87171; text-transform: uppercase;">❌ Fatal / Invalid</div>
                <div style="font-size: 18px; font-weight: 800; color: #f87171;">${qg.fatalCount}</div>
              </div>
            </div>

            <!-- Filters & Global Actions -->
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
              <div style="display: flex; gap: 5px;">
                <button type="button" class="btn btn-sm btn-qg-filter ${filterType === 'ALL' ? 'btn-primary' : 'btn-ghost'}" data-filter="ALL" style="font-size: 10.5px;">
                  Show All (${qg.totalCount})
                </button>
                <button type="button" class="btn btn-sm btn-qg-filter ${filterType === 'READY' ? 'btn-primary' : 'btn-ghost'}" data-filter="READY" style="font-size: 10.5px; color: #34d399;">
                  Ready (${qg.readyCount})
                </button>
                <button type="button" class="btn btn-sm btn-qg-filter ${filterType === 'WARNING' ? 'btn-primary' : 'btn-ghost'}" data-filter="WARNING" style="font-size: 10.5px; color: #fbbf24;">
                  Fixable (${qg.warningCount})
                </button>
                <button type="button" class="btn btn-sm btn-qg-filter ${filterType === 'FATAL' ? 'btn-primary' : 'btn-ghost'}" data-filter="FATAL" style="font-size: 10.5px; color: #f87171;">
                  Fatal (${qg.fatalCount})
                </button>
              </div>

              <div style="display: flex; gap: 6px;">
                ${qg.warningCount > 0 ? `
                  <button type="button" id="btn-qg-autofix-all" class="btn btn-warning btn-sm" style="font-weight: 800; font-size: 10.5px;">
                    ✨ Auto-Fix All (${qg.warningCount})
                  </button>
                ` : ''}
                ${qg.fatalCount > 0 ? `
                  <button type="button" id="btn-qg-discard-invalid" class="btn btn-danger btn-sm" style="font-weight: 800; font-size: 10.5px;">
                    🧹 Discard Invalid Rows (${qg.fatalCount})
                  </button>
                ` : ''}
              </div>
            </div>

            <!-- Staged Table -->
            <div class="table-responsive" style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-sm); max-height: 320px; overflow-y: auto;">
              <table class="excel-grid-table" style="font-size: 11px; width: 100%;">
                <thead style="position: sticky; top: 0; z-index: 2; background: var(--bg-card);">
                  <tr>
                    <th style="width: 40px; text-align: center;">Row</th>
                    <th style="width: 90px; text-align: center;">Status</th>
                    <th>Staged Data Preview</th>
                    <th>Quality Notes / Typos</th>
                    <th style="width: 90px; text-align: center;">Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${displayedRows.length === 0 ? `
                    <tr><td colspan="5" style="text-align: center; padding: 25px; color: var(--text-muted);">No staged records in this filter</td></tr>
                  ` : displayedRows.map(r => {
                    const isFatal = r.status === 'FATAL';
                    const isWarning = r.status === 'WARNING';

                    return `
                      <tr style="${isFatal ? 'background: rgba(239, 68, 68, 0.06);' : (isWarning ? 'background: rgba(245, 158, 11, 0.05);' : '')}">
                        <td style="text-align: center; font-family: var(--font-mono); color: var(--text-muted); font-size: 10.5px;">
                          ${r.rowNum}
                        </td>
                        <td style="text-align: center;">
                          ${r.status === 'READY' ? `
                            <span class="badge badge-active" style="font-size: 9.5px;">✅ Ready</span>
                          ` : isWarning ? `
                            <span class="badge badge-warning" style="font-size: 9.5px;">⚠️ Fixable</span>
                          ` : `
                            <span class="badge badge-danger" style="background: rgba(239, 68, 68, 0.2); border: 1px solid #ef4444; color: #f87171; font-size: 9.5px;">❌ Invalid</span>
                          `}
                        </td>
                        <td>
                          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                            ${Object.entries(r.data).filter(([k]) => k !== 'category').map(([k, v]) => `
                              <span style="font-size: 10.5px;">
                                <strong style="color: var(--text-muted);">${k}:</strong> <span style="color: #fff; font-family: var(--font-mono);">${v || '—'}</span>
                              </span>
                            `).join(' | ')}
                          </div>
                        </td>
                        <td>
                          ${r.issues.map(iss => `
                            <div style="color: #f87171; font-size: 10.5px; font-weight: 600;">&bull; ${iss.message}</div>
                          `).join('')}
                          ${r.autoFixes.map(fix => `
                            <div style="color: #fbbf24; font-size: 10.5px;">&bull; ${fix.fieldLabel}: "${fix.original}" &rarr; <strong>"${fix.suggested}"</strong></div>
                          `).join('')}
                          ${r.status === 'READY' ? '<span style="color: #34d399; font-size: 10.5px;">No issues detected. Ready.</span>' : ''}
                        </td>
                        <td style="text-align: center;">
                          <div style="display: flex; justify-content: center; gap: 3px;">
                            ${isWarning ? `
                              <button type="button" class="btn btn-warning btn-sm btn-qg-autofix-row" data-row-id="${r.rowId}" style="font-size: 9.5px; padding: 1px 5px;">
                                ⚡ Fix
                              </button>
                            ` : ''}
                            <button type="button" class="btn btn-ghost btn-sm btn-qg-discard-row" data-row-id="${r.rowId}" style="font-size: 9.5px; color: #f87171; padding: 1px 5px;" title="Discard Row">
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <div class="modal-footer" style="padding: 12px 20px; background: var(--bg-card); border-top: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
            <button type="button" id="btn-cancel-storage-modal" class="btn btn-secondary btn-sm">Cancel Import</button>

            <div style="display: flex; align-items: center; gap: 8px;">
              ${qg.fatalCount > 0 ? `
                <span style="font-size: 11px; color: #f87171; font-weight: 600;">
                  ⚠️ Discard all invalid rows before committing to Main Data.
                </span>
              ` : ''}
              <button 
                type="button" 
                id="btn-qg-commit-import" 
                class="btn btn-success btn-sm" 
                style="font-weight: 800; padding: 5px 14px; font-size: 12px;" 
                ${qg.fatalCount > 0 || (qg.readyCount + qg.warningCount) === 0 ? 'disabled' : ''}
              >
                🚀 Commit &amp; Save Verified Records (${qg.readyCount})
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // 3. BULK PASTE INPUT MODAL
  if (activeModalState.type === 'BULK_PASTE') {
    const cat = (activeTab === 'SCHEMA_BUILDER' || activeTab === 'HEALTH_SCANNER' || activeTab === 'RULES') ? 'MACHINE' : activeTab;
    const schema = storageSchemaService.getSchema(cat);

    return `
      <div class="modal-overlay" id="modal-storage-bulk-paste-overlay">
        <div class="modal-dialog" style="max-width: 620px;">
          <div class="modal-header">
            <div class="modal-title">
              <span>📋 Bulk Multi-Line Text Import</span>
              <span class="badge badge-active">${schema.icon} ${schema.title}</span>
            </div>
            <button type="button" id="btn-close-storage-modal" class="btn btn-ghost btn-sm">✕</button>
          </div>

          <div class="modal-body" style="padding: 18px; display: flex; flex-direction: column; gap: 10px;">
            <div style="font-size: 12px; color: var(--text-secondary);">
              Paste rows from Excel, Notepad, or CSV. The Quality Gate will inspect, flag, and auto-correct rows before committing to Main Data!
            </div>

            <div style="background: rgba(56, 189, 248, 0.08); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: var(--radius-sm); padding: 8px 12px; font-family: var(--font-mono); font-size: 10.5px; color: #38bdf8;">
              ${cat === 'MACHINE' ? `Format: Machine Name | Brand | Model Number<br>Example: Plain Machine | JUKI | DDL-8700` : ''}
              ${cat === 'SPARE_PART' ? `Format: Part Name | Part Code | Category | Compatible Models<br>Example: Bobbin Case | BC-DB1-NBL | Mechanical | JUKI DDL-8700` : ''}
              ${cat === 'TOOL' ? `Format: Tool Name | Tool Code | Specs | Kit<br>Example: Allen Key Set | TL-AK-001 | 1.5-10mm | Standard Kit` : ''}
              ${cat === 'LOCATION' ? `Format: Unit | Floor | Line Name<br>Example: Unit-01 | 1st Floor | Line-A` : ''}
            </div>

            <textarea 
              id="txt-bulk-paste-input" 
              class="form-control" 
              rows="8" 
              placeholder="Paste rows here..." 
              style="font-family: var(--font-mono); font-size: 11.5px;"
            ></textarea>
          </div>

          <div class="modal-footer" style="padding: 10px 18px; display: flex; justify-content: space-between; align-items: center;">
            <button type="button" id="btn-cancel-storage-modal" class="btn btn-secondary btn-sm">Cancel</button>
            <button type="button" id="btn-execute-bulk-paste-inspect" class="btn btn-primary btn-sm" style="font-weight: 800;">
              🔍 Inspect &amp; Verify Quality
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // 4. FILE IMPORT MODAL
  if (activeModalState.type === 'IMPORT_FILE') {
    const cat = (activeTab === 'SCHEMA_BUILDER' || activeTab === 'HEALTH_SCANNER' || activeTab === 'RULES') ? 'MACHINE' : activeTab;
    const schema = storageSchemaService.getSchema(cat);

    return `
      <div class="modal-overlay" id="modal-storage-file-import-overlay">
        <div class="modal-dialog" style="max-width: 550px;">
          <div class="modal-header">
            <div class="modal-title">
              <span>📥 Import Master Data from Excel / CSV</span>
              <span class="badge badge-active">${schema.icon} ${schema.title}</span>
            </div>
            <button type="button" id="btn-close-storage-modal" class="btn btn-ghost btn-sm">✕</button>
          </div>

          <div class="modal-body" style="padding: 22px; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 12px;">
            <div style="width: 54px; height: 54px; border-radius: 50%; background: rgba(56, 189, 248, 0.1); border: 2px solid #38bdf8; display: flex; align-items: center; justify-content: center; font-size: 24px;">
              📊
            </div>
            <div>
              <h3 style="font-size: 15px; font-weight: 800; color: #fff; margin: 0;">Upload .xlsx / .csv File</h3>
              <p style="font-size: 11.5px; color: var(--text-secondary); margin-top: 3px;">
                Select spreadsheet for: <strong>${schema.title}</strong>.
              </p>
            </div>

            <div style="border: 2px dashed #38bdf8; border-radius: var(--radius-md); padding: 20px; width: 100%; background: rgba(56, 189, 248, 0.04); cursor: pointer;" id="storage-drop-zone">
              <input type="file" id="storage-file-input" accept=".csv, .xlsx, .xls" style="display: none;" />
              <div style="font-size: 24px; margin-bottom: 4px;">📂</div>
              <div style="font-size: 13px; font-weight: 700; color: #fff;">Click to select Excel / CSV spreadsheet</div>
              <div style="font-size: 10.5px; color: var(--text-muted); margin-top: 3px;" id="storage-selected-file-name">No file selected</div>
            </div>

            <div style="display: flex; gap: 8px; width: 100%; justify-content: center;">
              <button type="button" id="btn-storage-modal-dl-template" class="btn btn-ghost btn-sm" style="color: #34d399; font-size: 11px;">
                📋 Download Schema Blank Template
              </button>
            </div>
          </div>

          <div class="modal-footer" style="padding: 10px 18px; display: flex; justify-content: flex-end; gap: 8px;">
            <button type="button" id="btn-cancel-storage-modal" class="btn btn-secondary btn-sm">Cancel</button>
            <button type="button" id="btn-execute-file-inspect" class="btn btn-primary btn-sm" style="font-weight: 800;" disabled>
              🔍 Inspect in Quality Gate
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // 5. ADD CUSTOM FIELD MODAL
  if (activeModalState.type === 'ADD_CUSTOM_FIELD') {
    const cat = activeBuilderCategory || 'MACHINE';
    const schema = storageSchemaService.getSchema(cat);

    return `
      <div class="modal-overlay" id="modal-storage-field-overlay">
        <div class="modal-dialog" style="max-width: 500px;">
          <div class="modal-header">
            <div class="modal-title">
              <span>➕ Add Custom Attribute</span>
              <span class="badge badge-active">${schema.icon} ${schema.title}</span>
            </div>
            <button type="button" id="btn-close-storage-modal" class="btn btn-ghost btn-sm">✕</button>
          </div>

          <form id="form-add-custom-field" class="modal-body" style="padding: 18px; display: flex; flex-direction: column; gap: 12px;">
            <div class="form-group">
              <label class="form-label">Attribute Label (Display Name) <span class="req">*</span></label>
              <input type="text" name="label" id="inp-custom-field-label" class="form-control" placeholder="e.g. Power Rating (kW), Needle System, Supplier" required />
            </div>

            <div class="form-grid-2">
              <div class="form-group">
                <label class="form-label">Database Field Key</label>
                <input type="text" name="key" id="inp-custom-field-key" class="form-control" placeholder="e.g. powerRating" style="font-family: var(--font-mono);" />
                <div style="font-size: 10px; color: var(--text-muted); margin-top: 2px;">Leave blank to auto-generate.</div>
              </div>

              <div class="form-group">
                <label class="form-label">Data Type</label>
                <select name="type" id="sel-custom-field-type" class="form-control">
                  <option value="text">Text / String</option>
                  <option value="number">Number</option>
                  <option value="select">Dropdown Select</option>
                  <option value="date">Date</option>
                  <option value="boolean">Boolean (Yes/No)</option>
                </select>
              </div>
            </div>

            <div class="form-group" id="group-field-options" style="display: none;">
              <label class="form-label">Dropdown Options (Comma separated)</label>
              <input type="text" name="options" class="form-control" placeholder="e.g. Direct Drive, Servo Motor, Clutch Motor" />
            </div>

            <div style="display: flex; gap: 16px; margin-top: 2px;">
              <label style="display: flex; align-items: center; gap: 5px; font-size: 11.5px; color: #fff; cursor: pointer;">
                <input type="checkbox" name="required" value="1" />
                <span>Mandatory / Required Field</span>
              </label>

              <label style="display: flex; align-items: center; gap: 5px; font-size: 11.5px; color: #fff; cursor: pointer;">
                <input type="checkbox" name="showInTable" value="1" checked />
                <span>Show Column in Master Table</span>
              </label>
            </div>

            <div class="modal-footer" style="padding: 12px 0 0; display: flex; justify-content: flex-end; gap: 8px;">
              <button type="button" id="btn-cancel-storage-modal" class="btn btn-secondary btn-sm">Cancel</button>
              <button type="submit" class="btn btn-success btn-sm" style="font-weight: 800;">💾 Save Custom Attribute</button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  // 6. ADD CUSTOM CATEGORY MODAL
  if (activeModalState.type === 'ADD_CATEGORY') {
    return `
      <div class="modal-overlay" id="modal-storage-category-overlay">
        <div class="modal-dialog" style="max-width: 480px;">
          <div class="modal-header">
            <div class="modal-title">
              <span>➕ Create Custom Master Category</span>
            </div>
            <button type="button" id="btn-close-storage-modal" class="btn btn-ghost btn-sm">✕</button>
          </div>

          <form id="form-add-custom-category" class="modal-body" style="padding: 18px; display: flex; flex-direction: column; gap: 12px;">
            <div class="form-group">
              <label class="form-label">Category Title <span class="req">*</span></label>
              <input type="text" name="title" class="form-control" placeholder="e.g. Sewing Attachments &amp; Folders, Lubricants" required />
            </div>

            <div class="form-grid-2">
              <div class="form-group">
                <label class="form-label">Category Unique Key</label>
                <input type="text" name="categoryKey" class="form-control" placeholder="e.g. ATTACHMENT" style="font-family: var(--font-mono); text-transform: uppercase;" />
              </div>

              <div class="form-group">
                <label class="form-label">Icon Emoji</label>
                <input type="text" name="icon" class="form-control" value="📁" style="font-size: 16px; text-align: center;" />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Description / Purpose</label>
              <input type="text" name="description" class="form-control" placeholder="e.g. Folders, binders, pullers, and custom presser feet" />
            </div>

            <div class="modal-footer" style="padding: 12px 0 0; display: flex; justify-content: flex-end; gap: 8px;">
              <button type="button" id="btn-cancel-storage-modal" class="btn btn-secondary btn-sm">Cancel</button>
              <button type="submit" class="btn btn-primary btn-sm" style="font-weight: 800;">🚀 Create Category</button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  // 7. ADD CORRECTION RULE MODAL
  if (activeModalState.type === 'ADD_RULE') {
    return `
      <div class="modal-overlay" id="modal-storage-rule-overlay">
        <div class="modal-dialog" style="max-width: 480px;">
          <div class="modal-header">
            <div class="modal-title">
              <span>➕ Add New Correction Rule</span>
            </div>
            <button type="button" id="btn-close-storage-modal" class="btn btn-ghost btn-sm">✕</button>
          </div>

          <form id="form-correction-rule" class="modal-body" style="padding: 18px; display: flex; flex-direction: column; gap: 12px;">
            <div class="form-group">
              <label class="form-label">Raw Input Pattern (To Intercept) <span class="req">*</span></label>
              <input type="text" name="rawPattern" class="form-control" placeholder="e.g. juki, ddl 8700, plen mashin" required style="font-family: var(--font-mono); color: #f87171;" />
              <div style="font-size: 10.5px; color: var(--text-muted); margin-top: 2px;">User input matching this pattern will be intercepted.</div>
            </div>

            <div class="form-group">
              <label class="form-label">Canonical Target Standard <span class="req">*</span></label>
              <input type="text" name="targetValue" class="form-control" placeholder="e.g. JUKI, DDL-8700, Plain Machine 1-Needle" required style="font-family: var(--font-mono); font-weight: 800; color: #34d399;" />
            </div>

            <div class="form-grid-2">
              <div class="form-group">
                <label class="form-label">Category</label>
                <select name="category" class="form-control">
                  <option value="BRAND">BRAND</option>
                  <option value="MODEL">MODEL</option>
                  <option value="MACHINE_NAME">MACHINE_NAME</option>
                  <option value="SPARE_PART">SPARE_PART</option>
                  <option value="TOOL">TOOL</option>
                  <option value="LOCATION">LOCATION</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">Issue Type</label>
                <select name="issueType" class="form-control">
                  <option value="casing">casing (Capital / Lowercase)</option>
                  <option value="formatting">formatting (Hyphen or Spacing)</option>
                  <option value="spelling">spelling (Typo / Misspelling)</option>
                  <option value="slang">slang (Factory Slang / Nickname)</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Notes / Comments</label>
              <input type="text" name="note" class="form-control" placeholder="e.g. Standard casing convention" />
            </div>

            <div class="modal-footer" style="padding: 10px 0 0; display: flex; justify-content: flex-end; gap: 8px;">
              <button type="button" id="btn-cancel-storage-modal" class="btn btn-secondary btn-sm">Cancel</button>
              <button type="submit" class="btn btn-success btn-sm" style="font-weight: 800;">💾 Save Rule</button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  // 8. TEST BENCH MODAL
  if (activeModalState.type === 'TEST_CORRECTION') {
    return `
      <div class="modal-overlay" id="modal-storage-test-bench-overlay">
        <div class="modal-dialog" style="max-width: 500px;">
          <div class="modal-header">
            <div class="modal-title">
              <span>⚡ Live Auto-Correction Test Bench</span>
            </div>
            <button type="button" id="btn-close-storage-modal" class="btn btn-ghost btn-sm">✕</button>
          </div>

          <div class="modal-body" style="padding: 18px; display: flex; flex-direction: column; gap: 12px;">
            <div style="font-size: 12px; color: var(--text-secondary);">
              Type any misspelled or lowercase value to test the intelligent auto-correction engine in real-time!
            </div>

            <div style="display: flex; flex-direction: column; gap: 5px;">
              <label class="form-label" style="font-weight: 700; color: #38bdf8;">
                Test Input (Type anything):
              </label>
              <input 
                type="text" 
                id="inp-test-bench-input" 
                class="form-control" 
                placeholder="e.g. juki, ddl 8700, brother s7200, bobin..." 
                style="font-size: 13.5px; font-weight: 700; padding: 8px 12px;"
              />
            </div>

            <div id="test-bench-result-container" style="min-height: 45px;"></div>
          </div>

          <div class="modal-footer" style="padding: 10px 18px; display: flex; justify-content: space-between;">
            <button type="button" id="btn-cancel-storage-modal" class="btn btn-secondary btn-sm">Close</button>
            <button type="button" id="btn-run-test-bench-check" class="btn btn-primary btn-sm" style="font-weight: 800;">
              🔍 Check Now
            </button>
          </div>
        </div>
      </div>
    `;
  }

  return '';
}

// ==========================================
// In-Place Smooth Update Handlers (Zero-Jump)
// ==========================================

function updateModalLayer() {
  let modalLayer = document.getElementById('storage-modal-layer');
  if (!modalLayer) {
    const pageRoot = document.getElementById('storage-page-root');
    if (pageRoot) {
      modalLayer = document.createElement('div');
      modalLayer.id = 'storage-modal-layer';
      pageRoot.appendChild(modalLayer);
    }
  }

  if (modalLayer) {
    const view = document.getElementById('main-view-container');
    const containerY = view ? view.scrollTop : 0;
    const containerX = view ? view.scrollLeft : 0;
    const pageRoot = document.getElementById('storage-page-root');
    const pageY = pageRoot ? pageRoot.scrollTop : 0;
    const winY = window.scrollY || document.documentElement.scrollTop || 0;
    const winX = window.scrollX || document.documentElement.scrollLeft || 0;

    modalLayer.innerHTML = renderStorageModal();
    initModalInteractions();

    const restore = () => {
      if (view) {
        view.scrollTop = containerY;
        view.scrollLeft = containerX;
      }
      if (pageRoot) pageRoot.scrollTop = pageY;
      if (winY > 0 || winX > 0) {
        window.scrollTo({ top: winY, left: winX, behavior: 'instant' });
      }
    };
    restore();
    requestAnimationFrame(restore);
  }
}

function switchStorageTab(newTab) {
  if (!newTab || newTab === activeTab) return;
  activeTab = newTab;
  searchQuery = '';
  integrityFilter = 'ALL';
  selectedItemIds.clear();

  const container = document.getElementById('storage-page-root');
  if (!container) {
    renderPage();
    return;
  }

  // Update tab navigation buttons in-place
  container.querySelectorAll('.btn-storage-nav').forEach(btn => {
    if (btn.dataset.tab === newTab) {
      btn.classList.remove('btn-secondary');
      btn.classList.add('btn-primary');
    } else {
      btn.classList.remove('btn-primary');
      btn.classList.add('btn-secondary');
    }
  });

  // Update KPI card highlights in-place
  container.querySelectorAll('.storage-kpi-card').forEach(card => {
    if (card.dataset.tab === newTab) {
      card.style.borderColor = '#38bdf8';
    } else if (card.dataset.tab === 'HEALTH_SCANNER' || card.dataset.tab === 'SCHEMA_BUILDER') {
      card.style.borderColor = 'rgba(56, 189, 248, 0.3)';
    } else {
      card.style.borderColor = 'var(--border-color)';
    }
  });

  // Update only the content area in-place
  const contentArea = container.querySelector('#storage-tab-content-area');
  if (contentArea) {
    contentArea.innerHTML = renderActiveTabContent();
    rebindContentEvents();
  }
}

function updateBulkBarInPlace() {
  const barContainer = document.getElementById('storage-bulk-bar-container');
  if (!barContainer) return;

  const audit = smartStorageService.auditAllStorageItems(activeTab);
  barContainer.innerHTML = renderBulkBarHtml(audit);

  // Rebind bulk actions
  const btnClear = barContainer.querySelector('#btn-bulk-deselect-all');
  if (btnClear) {
    btnClear.addEventListener('click', (e) => {
      e.preventDefault();
      selectedItemIds.clear();
      document.querySelectorAll('.chk-storage-row').forEach(cb => cb.checked = false);
      const masterCb = document.getElementById('chk-master-select-all');
      if (masterCb) masterCb.checked = false;
      updateBulkBarInPlace();
    });
  }

  const btnBulkDelete = barContainer.querySelector('#btn-bulk-delete-selected');
  if (btnBulkDelete) {
    btnBulkDelete.addEventListener('click', (e) => {
      e.preventDefault();
      if (selectedItemIds.size === 0) return;
      if (confirm(`Delete ${selectedItemIds.size} selected master records?`)) {
        smartStorageService.deleteStorageItemsBatch(Array.from(selectedItemIds));
        selectedItemIds.clear();
        refreshStorageTabContent();
      }
    });
  }

  const btnPurgeFlawed = barContainer.querySelector('#btn-purge-all-flawed');
  if (btnPurgeFlawed) {
    btnPurgeFlawed.addEventListener('click', (e) => {
      e.preventDefault();
      if (confirm(`Clean up and discard all flawed records in ${activeTab}?`)) {
        const count = smartStorageService.purgeFlawedItems(activeTab);
        selectedItemIds.clear();
        alert(`🧹 Cleaned up ${count} flawed records!`);
        refreshStorageTabContent();
      }
    });
  }

  const btnAutoFix = barContainer.querySelector('#btn-bulk-autofix-warnings');
  if (btnAutoFix) {
    btnAutoFix.addEventListener('click', (e) => {
      e.preventDefault();
      const count = smartStorageService.batchAutoFixStorageItems(activeTab);
      alert(`✨ Auto-corrected ${count} records!`);
      refreshStorageTabContent();
    });
  }
}

function refreshStorageTabContent() {
  const contentArea = document.getElementById('storage-tab-content-area');
  if (!contentArea) {
    renderPage();
    return;
  }

  // Preserve table scroll position
  const tableContainer = document.getElementById('storage-table-container');
  const savedScroll = tableContainer ? tableContainer.scrollTop : 0;

  contentArea.innerHTML = renderActiveTabContent();
  rebindContentEvents();

  if (tableContainer && savedScroll > 0) {
    const newTbl = document.getElementById('storage-table-container');
    if (newTbl) newTbl.scrollTop = savedScroll;
  }

  // Update KPI badge counters in-place
  updateKpiCountsInPlace();
}

function updateKpiCountsInPlace() {
  const allHierarchyGroups = smartStorageService.getMachineModelsHierarchy();
  const totalMachines = allHierarchyGroups.length;
  const totalModels = allHierarchyGroups.reduce((acc, g) => acc + (g.models ? g.models.length : 0), 0);
  const registeredBrands = storage.getTable(TABLE_NAMES.BRANDS) || [];
  const brandSet = new Set();
  registeredBrands.forEach(b => {
    if (b && b.name && b.name.trim()) brandSet.add(b.name.trim().toUpperCase());
  });
  allHierarchyGroups.forEach(g => {
    (g.models || []).forEach(m => {
      if (m.brand && m.brand.trim()) brandSet.add(m.brand.trim().toUpperCase());
    });
  });
  const totalBrands = brandSet.size;

  const elM = document.getElementById('kpi-total-machines');
  if (elM) elM.textContent = `${totalMachines} Types`;
  const elB = document.getElementById('kpi-total-brands');
  if (elB) elB.textContent = `${totalBrands} Brands`;
  const elBSub = document.getElementById('kpi-total-brands-sub');
  if (elBSub) elBSub.textContent = totalBrands === 0 ? 'No Brands Registered' : Array.from(brandSet).slice(0, 3).join(', ');
  const elMo = document.getElementById('kpi-total-models');
  if (elMo) elMo.textContent = `${totalModels} Models`;
}

// ==========================================
// Event Listeners Initialization
// ==========================================

export function initStorageEvents() {
  const container = document.getElementById('main-view-container');
  if (!container) return;

  // 0. Top Header Excel Sheet Input/Export Studio
  container.querySelectorAll('.btn-open-excel-master-modal, #btn-open-excel-master-modal-top, #btn-open-excel-master-modal-mid').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      activeModalState = { type: 'EXCEL_IMPORT_EXPORT', data: {} };
      updateModalLayer();
    });
  });

  // 0B. Top Header Export Catalog to Excel
  const btnTopExport = container.querySelector('#btn-storage-export-excel-top');
  if (btnTopExport) {
    btnTopExport.addEventListener('click', (e) => {
      e.preventDefault();
      try {
        const res = smartStorageService.exportMachinesToExcel();
        if (typeof notificationService !== 'undefined' && notificationService.success) {
          notificationService.success('Export Complete', `Exported ${res.totalExported} rows to ${res.fileName}.`);
        }
      } catch (err) {
        alert('Export error: ' + err.message);
      }
    });
  }

  // 1. Top Header Step 1: Input Machine Names
  const btnTopBulkMn = container.querySelector('#btn-open-bulk-import-machine-names-top');
  if (btnTopBulkMn) {
    btnTopBulkMn.addEventListener('click', (e) => {
      e.preventDefault();
      activeModalState = { type: 'BULK_IMPORT_MACHINE_NAMES', data: {} };
      updateModalLayer();
    });
  }

  // 2. Top Header Step 2: Add Models (Dropdown + 2 Boxes)
  const btnTopAddModels = container.querySelector('#btn-open-fast-brand-model-importer-top');
  if (btnTopAddModels) {
    btnTopAddModels.addEventListener('click', (e) => {
      e.preventDefault();
      activeModalState = { type: 'BULK_ADD_MODELS', machineName: '' };
      updateModalLayer();
    });
  }

  // 3. Top Header Add Machine Name
  const btnTopAddMn = container.querySelector('#btn-storage-add-new-machine');
  if (btnTopAddMn) {
    btnTopAddMn.addEventListener('click', (e) => {
      e.preventDefault();
      activeModalState = { type: 'ADD_MACHINE_NAME', data: {} };
      updateModalLayer();
    });
  }

  // 4. Top Header: Clear All Data (Full Fresh Start)
  const btnClearAll = container.querySelector('#btn-storage-clear-all-data');
  if (btnClearAll) {
    btnClearAll.addEventListener('click', async (e) => {
      e.preventDefault();
      const confirmed = confirm(
        '⚠️ CLEAR ALL MACHINE DATA & START FULL FRESH?\n\n' +
        'This will permanently delete all registered machine names and model specifications from the database so you can do a 100% clean fresh import.\n\n' +
        'Are you sure you want to clear all data?'
      );
      if (!confirmed) return;

      const originalHtml = btnClearAll.innerHTML;
      btnClearAll.disabled = true;
      btnClearAll.innerHTML = '🧹 Wiping Data...';

      try {
        await smartStorageService.clearAllMachineCatalogData();
        selectedItemIds.clear();
        selectedMachineNames.clear();
        if (typeof notificationService !== 'undefined' && notificationService.success) {
          notificationService.success('All machine catalog data wiped! Database is 100% fresh and ready for new import.');
        } else {
          alert('All machine catalog data wiped! Database is 100% fresh and ready for new import.');
        }
        refreshStorageTabContent();
      } catch (err) {
        console.error('Failed to clear catalog data:', err);
        alert('Error clearing data: ' + err.message);
      } finally {
        btnClearAll.disabled = false;
        btnClearAll.innerHTML = originalHtml;
      }
    });
  }

  // 4b. Manage Machinery Brands Button
  const btnManageBrands = container.querySelector('#btn-open-manage-brands');
  if (btnManageBrands) {
    btnManageBrands.addEventListener('click', (e) => {
      e.preventDefault();
      activeModalState = { type: 'MANAGE_BRANDS', data: {} };
      updateModalLayer();
    });
  }

  // 5. Global real-time synchronization listener (triggers immediate update upon save/sync)
  if (!window._erpStorageRealtimeBound) {
    window._erpStorageRealtimeBound = true;
    ['erp:master-data-updated', 'erp:storage-updated', 'storage:updated'].forEach(evt => {
      window.addEventListener(evt, () => {
        const pageRoot = document.getElementById('storage-page-root');
        if (pageRoot) {
          refreshStorageTabContent();
        }
      });
    });
  }

  rebindContentEvents();
  initModalInteractions();
}

function rebindContentEvents() {
  const container = document.getElementById('main-view-container');
  if (!container) return;

  // Search Input (In-place)
  const searchInp = container.querySelector('#inp-storage-search');
  if (searchInp) {
    searchInp.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      const content = container.querySelector('#storage-tab-content-area');
      if (content) {
        content.innerHTML = renderActiveTabContent();
        rebindContentEvents();
        const newInp = container.querySelector('#inp-storage-search');
        if (newInp) {
          newInp.focus({ preventScroll: true });
          newInp.setSelectionRange(newInp.value.length, newInp.value.length);
        }
      }
    });
  }

  const clearSearchBtn = container.querySelector('#btn-clear-storage-search');
  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', (e) => {
      e.preventDefault();
      searchQuery = '';
      refreshStorageTabContent();
    });
  }

  // 1. Grouped View: Select All Machines Checkbox
  const chkGroupSelectAll = container.querySelector('#chk-group-select-all');
  if (chkGroupSelectAll) {
    chkGroupSelectAll.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      const allMachineCards = container.querySelectorAll('.chk-machine-card');
      if (isChecked) {
        allMachineCards.forEach(cb => {
          cb.checked = true;
          if (cb.dataset.machine) selectedMachineNames.add(cb.dataset.machine);
        });
      } else {
        allMachineCards.forEach(cb => {
          cb.checked = false;
        });
        selectedMachineNames.clear();
      }
      refreshStorageTabContent();
    });
  }

  // 2. Grouped View: Individual Machine Card Checkbox
  container.querySelectorAll('.chk-machine-card').forEach(cb => {
    cb.addEventListener('change', (e) => {
      e.stopPropagation();
      const machineName = cb.dataset.machine;
      if (cb.checked) {
        selectedMachineNames.add(machineName);
      } else {
        selectedMachineNames.delete(machineName);
      }
      refreshStorageTabContent();
    });
  });

  // 3. Grouped View: Deselect All Machines Button
  const btnDeselectMachines = container.querySelector('#btn-deselect-all-machines');
  if (btnDeselectMachines) {
    btnDeselectMachines.addEventListener('click', (e) => {
      e.preventDefault();
      selectedMachineNames.clear();
      refreshStorageTabContent();
    });
  }

  // 4. Grouped View: Delete Selected Machines Button
  const btnDeleteSelectedMachines = container.querySelector('#btn-delete-selected-machines');
  if (btnDeleteSelectedMachines) {
    btnDeleteSelectedMachines.addEventListener('click', async (e) => {
      e.preventDefault();
      if (selectedMachineNames.size === 0) return;
      const confirmed = confirm(`Are you sure you want to permanently delete ${selectedMachineNames.size} selected machine types and all their registered models from the database?`);
      if (!confirmed) return;

      btnDeleteSelectedMachines.disabled = true;
      btnDeleteSelectedMachines.innerHTML = '⏳ Deleting...';

      try {
        await smartStorageService.deleteMachineGroupsBatch(Array.from(selectedMachineNames));
        selectedMachineNames.clear();
        if (typeof notificationService !== 'undefined' && notificationService.success) {
          notificationService.success('Selected machines and models deleted from database.');
        }
        refreshStorageTabContent();
      } catch (err) {
        console.error('Failed to delete selected machines:', err);
        alert('Error deleting machines: ' + err.message);
      }
    });
  }

  // 5. Flat Table View: Select All Rows Checkbox
  const chkTableSelectAll = container.querySelector('#chk-table-select-all');
  if (chkTableSelectAll) {
    chkTableSelectAll.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      const allRowCbs = container.querySelectorAll('.chk-table-row');
      if (isChecked) {
        allRowCbs.forEach(cb => {
          cb.checked = true;
          if (cb.dataset.id) selectedItemIds.add(cb.dataset.id);
        });
      } else {
        allRowCbs.forEach(cb => {
          cb.checked = false;
        });
        selectedItemIds.clear();
      }
      refreshStorageTabContent();
    });
  }

  // 6. Flat Table View: Individual Row Checkbox
  container.querySelectorAll('.chk-table-row').forEach(cb => {
    cb.addEventListener('change', (e) => {
      e.stopPropagation();
      const id = cb.dataset.id;
      if (cb.checked) {
        selectedItemIds.add(id);
      } else {
        selectedItemIds.delete(id);
      }
      refreshStorageTabContent();
    });
  });

  // 7. Flat Table View: Deselect All Rows Button
  const btnDeselectRows = container.querySelector('#btn-deselect-all-rows');
  if (btnDeselectRows) {
    btnDeselectRows.addEventListener('click', (e) => {
      e.preventDefault();
      selectedItemIds.clear();
      refreshStorageTabContent();
    });
  }

  // 8. Flat Table View: Delete Selected Rows Button
  const btnDeleteSelectedRows = container.querySelector('#btn-delete-selected-rows');
  if (btnDeleteSelectedRows) {
    btnDeleteSelectedRows.addEventListener('click', async (e) => {
      e.preventDefault();
      if (selectedItemIds.size === 0) return;
      const confirmed = confirm(`Are you sure you want to permanently delete ${selectedItemIds.size} selected model specifications from the database?`);
      if (!confirmed) return;

      btnDeleteSelectedRows.disabled = true;
      btnDeleteSelectedRows.innerHTML = '⏳ Deleting...';

      try {
        await smartStorageService.deleteStorageItemsBatch(Array.from(selectedItemIds));
        selectedItemIds.clear();
        if (typeof notificationService !== 'undefined' && notificationService.success) {
          notificationService.success('Selected model specifications deleted from database.');
        }
        refreshStorageTabContent();
      } catch (err) {
        console.error('Failed to delete selected rows:', err);
        alert('Error deleting records: ' + err.message);
      }
    });
  }

  // Single Model Delete Button
  container.querySelectorAll('.btn-delete-storage-item').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = btn.dataset.id;
      const modelName = btn.dataset.model || 'this model';
      if (confirm(`Delete model "${modelName}"?`)) {
        await smartStorageService.deleteStorageItem(id);
        selectedItemIds.delete(id);
        refreshStorageTabContent();
      }
    });
  });

  // Single Model Edit Button
  container.querySelectorAll('.btn-edit-model-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      activeModalState = {
        type: 'EDIT_MODEL_SPEC',
        data: {
          id: btn.dataset.id || '',
          model: btn.dataset.model || '',
          machineName: btn.dataset.machine || '',
          brand: btn.dataset.brand || 'JUKI',
          status: btn.dataset.status || 'ACTIVE'
        }
      };
      updateModalLayer();
    });
  });

  // Single Machine Group Rename Button
  container.querySelectorAll('.btn-edit-machine-group').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      activeModalState = {
        type: 'EDIT_MACHINE_NAME',
        machineName: btn.dataset.machine || ''
      };
      updateModalLayer();
    });
  });

  // Single Machine Group Delete Button
  container.querySelectorAll('.btn-delete-machine-group').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const machineName = btn.dataset.machine;
      if (confirm(`Delete machine type "${machineName}" and all its registered models?`)) {
        await smartStorageService.deleteMachineNameAndModels(machineName);
        selectedMachineNames.delete(machineName);
        refreshStorageTabContent();
      }
    });
  });

  // Machine View Switcher (Grouped vs Flat)
  container.querySelectorAll('.btn-machine-view-toggle').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      machineViewMode = btn.dataset.mode;
      refreshStorageTabContent();
    });
  });

  // Fast Brand & Model Importer Button
  const btnOpenFastImporter = container.querySelector('#btn-open-fast-brand-model-importer');
  if (btnOpenFastImporter) {
    btnOpenFastImporter.addEventListener('click', (e) => {
      e.preventDefault();
      activeModalState = { type: 'BULK_ADD_MODELS', machineName: '' };
      updateModalLayer();
    });
  }

  // Add Machine Name Button
  const btnOpenAddMn = container.querySelector('#btn-open-add-machine-name');
  if (btnOpenAddMn) {
    btnOpenAddMn.addEventListener('click', (e) => {
      e.preventDefault();
      activeModalState = { type: 'ADD_MACHINE_NAME', data: {} };
      updateModalLayer();
    });
  }

  // Mid Toolbar Excel Sheet Input/Export Button
  container.querySelectorAll('.btn-open-excel-master-modal, #btn-open-excel-master-modal-mid').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      activeModalState = { type: 'EXCEL_IMPORT_EXPORT', data: {} };
      updateModalLayer();
    });
  });

  // Bulk Import Machine Names Button
  const btnOpenBulkMn = container.querySelector('#btn-open-bulk-import-machine-names');
  if (btnOpenBulkMn) {
    btnOpenBulkMn.addEventListener('click', (e) => {
      e.preventDefault();
      activeModalState = { type: 'BULK_IMPORT_MACHINE_NAMES', data: {} };
      updateModalLayer();
    });
  }

  const btnOpenBulkMnEmpty = container.querySelector('#btn-open-bulk-import-machine-names-empty');
  if (btnOpenBulkMnEmpty) {
    btnOpenBulkMnEmpty.addEventListener('click', (e) => {
      e.preventDefault();
      activeModalState = { type: 'BULK_IMPORT_MACHINE_NAMES', data: {} };
      updateModalLayer();
    });
  }

  // Open Bulk Add Models under specific machine
  container.querySelectorAll('.btn-open-bulk-add-models').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const machineName = btn.dataset.machine;
      activeModalState = { type: 'BULK_ADD_MODELS', machineName };
      updateModalLayer();
    });
  });

  // Delete Correction Rule Button
  container.querySelectorAll('.btn-delete-correction-rule').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const id = btn.dataset.id;
      if (confirm('Delete this correction rule?')) {
        smartStorageService.deleteCorrectionRule(id);
        refreshStorageTabContent();
      }
    });
  });

  // Schema Builder: Category Select (In-place)
  container.querySelectorAll('.builder-cat-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const cat = item.dataset.cat;
      if (cat && cat !== activeBuilderCategory) {
        activeBuilderCategory = cat;

        // Update active class on items in-place
        container.querySelectorAll('.builder-cat-item').forEach(el => {
          if (el.dataset.cat === cat) {
            el.classList.add('active');
            el.style.borderColor = '#38bdf8';
            el.style.background = 'rgba(56, 189, 248, 0.1)';
          } else {
            el.classList.remove('active');
            el.style.borderColor = 'var(--border-color)';
            el.style.background = 'transparent';
          }
        });

        // Update right details panel in-place
        const detailsPanel = container.querySelector('#builder-details-panel');
        if (detailsPanel) {
          const schema = storageSchemaService.getSchema(cat);
          detailsPanel.innerHTML = renderBuilderDetailsHtml(schema);
          rebindBuilderPanelEvents();
        }
      }
    });
  });

  rebindBuilderPanelEvents();

  // Health Scanner Scan Runner
  const btnRunScan = container.querySelector('#btn-run-health-scan');
  if (btnRunScan) {
    btnRunScan.addEventListener('click', (e) => {
      e.preventDefault();
      isScanning = true;
      refreshStorageTabContent();
      setTimeout(() => {
        scanResults = smartStorageService.scanExistingDatabase();
        isScanning = false;
        refreshStorageTabContent();
      }, 300);
    });
  }

  // Health Scanner Batch Fix Buttons
  const bindBatchFix = (btnSelector) => {
    const btn = container.querySelector(btnSelector);
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        if (!scanResults || !scanResults.issues.length) return;
        if (confirm(`Auto-correct all ${scanResults.issues.length} records to canonical standards?`)) {
          const count = smartStorageService.fixAllIssues(scanResults.issues);
          alert(`✅ Auto-corrected ${count} physical records!`);
          scanResults = smartStorageService.scanExistingDatabase();
          refreshStorageTabContent();
        }
      });
    }
  };
  bindBatchFix('#btn-batch-fix-all-issues');
  bindBatchFix('#btn-batch-fix-all-issues-top');

  // Health Scanner Single Fix
  container.querySelectorAll('.btn-fix-single-issue').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const issueId = btn.dataset.issueId;
      if (!scanResults) return;
      const issue = scanResults.issues.find(i => i.id === issueId);
      if (issue) {
        smartStorageService.promptCorrection({
          original: issue.original,
          suggested: issue.suggested,
          issueTitle: issue.issueTitle,
          context: issue.fieldLabel,
          onConfirm: () => {
            smartStorageService.fixRecordIssue(issue);
            scanResults = smartStorageService.scanExistingDatabase();
            refreshStorageTabContent();
          }
        });
      }
    });
  });
}

function rebindBuilderPanelEvents() {
  const container = document.getElementById('main-view-container');
  if (!container) return;

  const btnOpenAddCat = container.querySelector('#btn-open-add-category');
  if (btnOpenAddCat) {
    btnOpenAddCat.addEventListener('click', (e) => {
      e.preventDefault();
      activeModalState = { type: 'ADD_CATEGORY', data: {} };
      updateModalLayer();
    });
  }

  const btnOpenAddField = container.querySelector('#btn-open-add-field') || container.querySelector('#btn-open-add-field-2');
  if (btnOpenAddField) {
    btnOpenAddField.addEventListener('click', (e) => {
      e.preventDefault();
      activeModalState = { type: 'ADD_CUSTOM_FIELD', data: { category: activeBuilderCategory } };
      updateModalLayer();
    });
  }

  const btnSchemaDl = container.querySelector('#btn-schema-dl-template');
  if (btnSchemaDl) {
    btnSchemaDl.addEventListener('click', (e) => {
      e.preventDefault();
      smartStorageService.downloadTemplate(activeBuilderCategory);
    });
  }

  container.querySelectorAll('.btn-toggle-field-table').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const cat = btn.dataset.cat;
      const field = btn.dataset.field;
      storageSchemaService.toggleFieldTableDisplay(cat, field);
      const detailsPanel = container.querySelector('#builder-details-panel');
      if (detailsPanel) {
        detailsPanel.innerHTML = renderBuilderDetailsHtml(storageSchemaService.getSchema(cat));
        rebindBuilderPanelEvents();
      }
    });
  });

  container.querySelectorAll('.btn-delete-custom-field').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const cat = btn.dataset.cat;
      const field = btn.dataset.field;
      if (confirm(`Remove custom attribute "${field}" from category "${cat}"?`)) {
        storageSchemaService.deleteCustomField(cat, field);
        const detailsPanel = container.querySelector('#builder-details-panel');
        if (detailsPanel) {
          detailsPanel.innerHTML = renderBuilderDetailsHtml(storageSchemaService.getSchema(cat));
          rebindBuilderPanelEvents();
        }
      }
    });
  });

  container.querySelectorAll('.btn-delete-custom-category').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const cat = btn.dataset.cat;
      if (confirm(`Delete custom reference category "${cat}"?`)) {
        storageSchemaService.deleteCustomCategory(cat);
        activeBuilderCategory = 'MACHINE';
        if (activeTab === cat) activeTab = 'MACHINE';
        renderPage();
      }
    });
  });
}

function initModalInteractions() {
  const modalLayer = document.getElementById('storage-modal-layer') || document.getElementById('main-view-container');
  if (!modalLayer || !activeModalState) return;

  const closeModal = () => {
    activeModalState = null;
    qualityGateData = null;
    excelImportParsedRows = [];
    excelImportFileName = '';
    excelImportActiveTab = 'UPLOAD';
    updateModalLayer();
  };

  const closeBtn = modalLayer.querySelector('#btn-close-storage-modal');
  const cancelBtn = modalLayer.querySelector('#btn-cancel-storage-modal');
  const footerCloseBtn = modalLayer.querySelector('#btn-close-storage-modal-footer');
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
  if (footerCloseBtn) footerCloseBtn.addEventListener('click', closeModal);

  // Overlay click to dismiss
  const modalOverlay = modalLayer.querySelector('.modal-overlay');
  if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeModal();
    });
  }

  // 00. Excel Sheet Input / Export Studio Handlers
  if (activeModalState.type === 'EXCEL_IMPORT_EXPORT') {
    // 1. Download Template
    const btnDlTemplate = modalLayer.querySelector('#btn-excel-modal-download-template');
    if (btnDlTemplate) {
      btnDlTemplate.addEventListener('click', (e) => {
        e.preventDefault();
        try {
          smartStorageService.downloadMachineImportTemplate();
          if (typeof notificationService !== 'undefined' && notificationService.success) {
            notificationService.success('Template Ready', 'Downloaded Machine_Brand_Model_Excel_Import_Template.xlsx');
          }
        } catch (err) {
          alert('Template download failed: ' + err.message);
        }
      });
    }

    // 2. Export Master Data
    const btnExpMaster = modalLayer.querySelector('#btn-excel-modal-export');
    if (btnExpMaster) {
      btnExpMaster.addEventListener('click', (e) => {
        e.preventDefault();
        try {
          const res = smartStorageService.exportMachinesToExcel();
          if (typeof notificationService !== 'undefined' && notificationService.success) {
            notificationService.success('Export Complete', `Exported ${res.totalExported} rows to ${res.fileName}.`);
          }
        } catch (err) {
          alert('Export failed: ' + err.message);
        }
      });
    }

    // 3. Tab switching between UPLOAD and PASTE
    modalLayer.querySelectorAll('.btn-excel-mode-tab').forEach(tabBtn => {
      tabBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = tabBtn.dataset.tab;
        if (tab && tab !== excelImportActiveTab) {
          excelImportActiveTab = tab;
          updateModalLayer();
        }
      });
    });

    // Helper: Parse rows from raw objects or 2D array
    const processRawRows = (rawRows, sourceName) => {
      if (!Array.isArray(rawRows) || rawRows.length === 0) {
        alert('No data rows found in spreadsheet.');
        return;
      }

      const parsed = [];
      let currentMachineName = '';
      const lastBrandByMachine = new Map();

      rawRows.forEach((row) => {
        if (!row || typeof row !== 'object') return;

        let machineName = '';
        let brand = '';
        let model = '';
        let remarks = '';

        for (const [k, v] of Object.entries(row)) {
          const cleanK = String(k).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
          const cleanV = String(v ?? '').trim();

          if (cleanK === 'machinename' || cleanK === 'machine' || cleanK === 'machinetype' || cleanK === 'name') {
            machineName = cleanV;
          } else if (cleanK === 'brand' || cleanK === 'machinerybrand' || cleanK === 'make') {
            brand = cleanV;
          } else if (cleanK === 'model' || cleanK === 'modelno' || cleanK === 'modelnumber' || cleanK === 'specification' || cleanK === 'spec') {
            model = cleanV;
          } else if (cleanK === 'remarks' || cleanK === 'remark' || cleanK === 'description' || cleanK === 'note') {
            remarks = cleanV;
          }
        }

        if (Array.isArray(row)) {
          const isFirstNum = /^\d+$/.test(String(row[0] || '').trim());
          if (isFirstNum) {
            machineName = String(row[1] || '').trim();
            brand = String(row[2] || '').trim();
            model = String(row[3] || '').trim();
            remarks = String(row[4] || '').trim();
          } else {
            machineName = String(row[0] || '').trim();
            brand = String(row[1] || '').trim();
            model = String(row[2] || '').trim();
            remarks = String(row[3] || '').trim();
          }
        }

        const mLower = machineName.toLowerCase();
        if (mLower === 'machinename' || mLower === 'machine name' || mLower === 'machine' || mLower === 'slno' || mLower === 'sl') return;

        // Carry forward machine name across rows with merged/blank machine cells
        if (machineName) {
          currentMachineName = machineName;
        } else if (currentMachineName && (model || brand)) {
          machineName = currentMachineName;
        }

        if (!machineName && !brand && !model) return;

        // Split brand if multiple comma-separated brands exist (e.g. "JUKI, TYPICAL, ZUSAN")
        let brandList = [brand];
        if (brand.includes(',')) {
          brandList = brand.split(',').map(b => b.trim()).filter(Boolean);
        }
        if (brandList.length === 0) brandList = [''];

        // Split model if multiple models exist (e.g. comma, newline, semicolon)
        let modelList = [model];
        if (/[\r\n;]/.test(model)) {
          modelList = model.split(/[\r\n;]+/).map(s => s.trim()).filter(Boolean);
        } else if (model.includes(',') && !/\(.*\)/.test(model)) {
          const parts = model.split(',').map(s => s.trim()).filter(Boolean);
          if (parts.length > 1 && parts.every(p => p.length >= 2)) {
            modelList = parts;
          }
        }
        if (modelList.length === 0) modelList = [''];

        // If brand has multiple brands and model is empty, each brand is registered as a specification!
        if (brandList.length > 1 && (!model || model.trim() === '')) {
          for (const singleBrand of brandList) {
            const bUpper = singleBrand.toUpperCase();
            parsed.push({
              machineName,
              brand: bUpper,
              model: singleBrand,
              remarks
            });
            lastBrandByMachine.set(machineName.toLowerCase(), bUpper);
          }
        } else {
          for (const singleBrand of brandList) {
            let finalBrand = singleBrand ? singleBrand.toUpperCase() : (lastBrandByMachine.get(machineName.toLowerCase()) || 'JUKI');
            for (const singleModel of modelList) {
              let finalModel = singleModel;
              // If model is empty but brand is given (e.g. JACK, KANSAI SPECIAL), use brand as model spec!
              if (!finalModel && finalBrand) {
                finalModel = finalBrand;
              }
              if (finalModel) {
                parsed.push({
                  machineName,
                  brand: finalBrand,
                  model: finalModel,
                  remarks
                });
                if (finalBrand) lastBrandByMachine.set(machineName.toLowerCase(), finalBrand);
              }
            }
          }
        }
      });

      if (parsed.length === 0) {
        alert('Could not find valid Machine rows. Please ensure your Excel file has headers: "Machine Name", "Brand", "Model".');
        return;
      }

      excelImportParsedRows = parsed;
      excelImportFileName = sourceName || 'Spreadsheet Data';
      updateModalLayer();
    };

    // 4. File input & Dropzone
    const fileInp = modalLayer.querySelector('#inp-excel-master-file');
    const dropzone = modalLayer.querySelector('#excel-dropzone');
    const btnBrowse = modalLayer.querySelector('#btn-browse-excel-file');

    if (btnBrowse && fileInp) {
      btnBrowse.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        fileInp.click();
      });
    }

    if (dropzone && fileInp) {
      dropzone.addEventListener('click', () => fileInp.click());

      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.style.borderColor = '#10b981';
        dropzone.style.background = 'rgba(16, 185, 129, 0.15)';
      });

      dropzone.addEventListener('dragleave', () => {
        dropzone.style.borderColor = excelImportParsedRows.length > 0 ? '#10b981' : 'rgba(56, 189, 248, 0.4)';
        dropzone.style.background = excelImportParsedRows.length > 0 ? 'rgba(16, 185, 129, 0.05)' : 'rgba(15, 23, 42, 0.6)';
      });

      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
          handleFile(files[0]);
        }
      });

      fileInp.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) handleFile(file);
      });

      const handleFile = (file) => {
        if (typeof XLSX === 'undefined') {
          alert('Excel reader library (SheetJS) is loading. Please try again in a moment.');
          return;
        }

        const reader = new FileReader();
        reader.onload = (evt) => {
          try {
            const data = new Uint8Array(evt.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];

            // Propagate merged cells so merged machine names are available on all rows
            if (worksheet && worksheet['!merges']) {
              worksheet['!merges'].forEach(range => {
                const firstCellRef = XLSX.utils.encode_cell(range.s);
                const firstCell = worksheet[firstCellRef];
                if (firstCell && firstCell.v !== undefined) {
                  for (let R = range.s.r; R <= range.e.r; ++R) {
                    for (let C = range.s.c; C <= range.e.c; ++C) {
                      const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
                      if (!worksheet[cellRef] || worksheet[cellRef].v === undefined || worksheet[cellRef].v === '') {
                        worksheet[cellRef] = { ...firstCell };
                      }
                    }
                  }
                }
              });
            }

            const jsonRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
            processRawRows(jsonRows, file.name);
          } catch (err) {
            console.error('Excel parse error:', err);
            alert('Failed to read Excel file: ' + err.message);
          }
        };
        reader.readAsArrayBuffer(file);
      };
    }

    // 5. Parse Pasted Data
    const btnParsePaste = modalLayer.querySelector('#btn-parse-pasted-excel');
    if (btnParsePaste) {
      btnParsePaste.addEventListener('click', (e) => {
        e.preventDefault();
        const txtArea = modalLayer.querySelector('#txt-excel-paste-input');
        const text = (txtArea?.value || '').trim();
        if (!text) {
          alert('Please paste some Excel rows into the text area first.');
          return;
        }

        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        if (lines.length === 0) return;

        // Check if clipboard contains multiple distinct machine names in column 1 or column 2
        const tabLines = lines.filter(l => l.includes('\t'));
        if (tabLines.length > 0 && activeModalState.type === 'BULK_ADD_MODELS') {
          activeModalState = { type: 'EXCEL_IMPORT_EXPORT', data: {} };
          excelImportActiveTab = 'PASTE';
          updateModalLayer();
          setTimeout(() => {
            const pasteBox = document.querySelector('#txt-excel-paste-input');
            if (pasteBox) {
              pasteBox.value = text;
              const parseBtn = document.querySelector('#btn-parse-pasted-excel');
              if (parseBtn) parseBtn.click();
            }
          }, 50);
          return;
        }

        const rows = [];
        let headerMachineIdx = -1;
        let headerBrandIdx = -1;
        let headerModelIdx = -1;
        let headerRemarksIdx = -1;

        lines.forEach((line, lineIdx) => {
          const delimiter = line.includes('\t') ? '\t' : (line.includes(',') ? ',' : '\t');
          const cols = line.split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''));

          if (lineIdx === 0) {
            cols.forEach((col, cIdx) => {
              const cNorm = col.toLowerCase().replace(/[^a-z0-9]/g, '');
              if (cNorm === 'machinename' || cNorm === 'machine' || cNorm === 'name') headerMachineIdx = cIdx;
              else if (cNorm === 'brand' || cNorm === 'make') headerBrandIdx = cIdx;
              else if (cNorm === 'model' || cNorm === 'modelno' || cNorm === 'modelnumber' || cNorm === 'spec' || cNorm === 'specification') headerModelIdx = cIdx;
              else if (cNorm === 'remarks' || cNorm === 'remark' || cNorm === 'description') headerRemarksIdx = cIdx;
            });

            if (headerMachineIdx !== -1 || headerBrandIdx !== -1 || headerModelIdx !== -1) {
              return;
            }
          }

          let machineName = '';
          let brand = '';
          let model = '';
          let remarks = '';

          if (headerMachineIdx !== -1) {
            machineName = cols[headerMachineIdx] || '';
            brand = headerBrandIdx !== -1 ? (cols[headerBrandIdx] || '') : (cols[1] || '');
            model = headerModelIdx !== -1 ? (cols[headerModelIdx] || '') : (cols[2] || '');
            remarks = headerRemarksIdx !== -1 ? (cols[headerRemarksIdx] || '') : (cols[3] || '');
          } else {
            // First column is numeric Sl No (e.g. 1, 2, 8, 14, 18, 20)
            const isFirstColNumber = /^\d+$/.test(cols[0]);
            if (isFirstColNumber) {
              machineName = cols[1] || '';
              brand = cols[2] || '';
              model = cols[3] || '';
              remarks = cols[4] || '';
            } else {
              machineName = cols[0] || '';
              brand = cols[1] || '';
              model = cols[2] || '';
              remarks = cols[3] || '';
            }
          }

          if (machineName || brand || model) {
            rows.push({ machineName, brand, model, remarks });
          }
        });

        processRawRows(rows, `Pasted Clipboard (${rows.length} rows)`);
      });
    }

    // 6. Clear Table Preview
    const btnClearPreview = modalLayer.querySelector('#btn-clear-excel-preview');
    if (btnClearPreview) {
      btnClearPreview.addEventListener('click', (e) => {
        e.preventDefault();
        excelImportParsedRows = [];
        excelImportFileName = '';
        updateModalLayer();
      });
    }

    // 7. Execute Bulk Import
    const btnExecuteImport = modalLayer.querySelector('#btn-excel-modal-execute-import');
    if (btnExecuteImport) {
      btnExecuteImport.addEventListener('click', async (e) => {
        e.preventDefault();
        if (excelImportParsedRows.length === 0) return;

        const replaceExisting = modalLayer.querySelector('#chk-excel-replace-existing')?.checked !== false;
        const autoBrands = modalLayer.querySelector('#chk-excel-auto-brands')?.checked !== false;
        const autoMachines = modalLayer.querySelector('#chk-excel-auto-machines')?.checked !== false;
        const cleanNames = modalLayer.querySelector('#chk-excel-clean-names')?.checked !== false;

        const origHtml = btnExecuteImport.innerHTML;
        btnExecuteImport.disabled = true;
        btnExecuteImport.innerHTML = '<span>⏳</span> Saving to Database...';

        try {
          const result = await smartStorageService.bulkImportMachinesFromExcel(excelImportParsedRows, {
            replaceExistingForImportedMachines: replaceExisting,
            autoCreateBrands: autoBrands,
            autoCreateMachines: autoMachines,
            cleanNames
          });

          if (typeof notificationService !== 'undefined' && notificationService.success) {
            notificationService.success(
              'Import Successful!',
              `Imported ${result.inserted} model records across ${result.uniqueMachines} machines and ${result.uniqueBrands} brands.`
            );
          } else {
            alert(`✅ Import Successful!\n\nImported: ${result.inserted} model specifications\nMachines: ${result.uniqueMachines}\nBrands: ${result.uniqueBrands}`);
          }

          closeModal();
          refreshStorageTabContent();
        } catch (err) {
          console.error('Excel bulk import error:', err);
          alert('Import failed: ' + err.message);
          btnExecuteImport.disabled = false;
          btnExecuteImport.innerHTML = origHtml;
        }
      });
    }
  }

  // Manage Brands Modal Handlers
  if (activeModalState.type === 'MANAGE_BRANDS') {
    const formQuickBrand = modalLayer.querySelector('#form-quick-add-brand');
    if (formQuickBrand) {
      formQuickBrand.addEventListener('submit', async (e) => {
        e.preventDefault();
        const inp = modalLayer.querySelector('#inp-quick-brand-name');
        const val = (inp?.value || '').trim();
        if (!val) return;

        const curBrands = storage.getTable(TABLE_NAMES.BRANDS) || [];
        const exists = curBrands.some(b => b.name && b.name.trim().toLowerCase() === val.toLowerCase());
        if (exists) {
          alert(`Brand "${val}" is already registered!`);
          return;
        }

        storage.insert(TABLE_NAMES.BRANDS, {
          name: val.toUpperCase(),
          code: val.toUpperCase().replace(/\s+/g, '_'),
          status: 'ACTIVE'
        });
        storage.saveTable(TABLE_NAMES.BRANDS);
        if (typeof storage.persistToServerDatabase === 'function') {
          try { await storage.persistToServerDatabase(); } catch (_) {}
        }

        if (inp) inp.value = '';
        updateModalLayer();
        refreshStorageTabContent();
      });
    }

    // Edit single brand record
    modalLayer.querySelectorAll('.btn-edit-brand-record').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        activeModalState = {
          type: 'EDIT_BRAND_NAME',
          brandId: btn.dataset.id || '',
          brandName: btn.dataset.name || ''
        };
        updateModalLayer();
      });
    });

    modalLayer.querySelectorAll('.btn-delete-brand-record').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const bId = btn.dataset.id;
        const bName = btn.dataset.name;
        if (!bId && !bName) return;

        const confirmed = confirm(`Are you sure you want to delete brand "${bName}"?`);
        if (!confirmed) return;

        if (bId) {
          storage.delete(TABLE_NAMES.BRANDS, bId);
        }
        const curBrands = storage.getTable(TABLE_NAMES.BRANDS) || [];
        const filtered = curBrands.filter(b => b.name?.toUpperCase() !== bName?.toUpperCase());
        storage.setTable(TABLE_NAMES.BRANDS, filtered);
        storage.saveTable(TABLE_NAMES.BRANDS);

        // Also remove this brand from any models
        const allModels = storage.getTable(TABLE_NAMES.MODELS) || [];
        let modelsChanged = false;
        allModels.forEach(m => {
          if (m.brandId === bId || (m.brand && m.brand.toUpperCase() === bName?.toUpperCase())) {
            m.brand = '';
            m.brandId = '';
            modelsChanged = true;
          }
        });
        if (modelsChanged) {
          storage.setTable(TABLE_NAMES.MODELS, allModels);
          storage.saveTable(TABLE_NAMES.MODELS);
        }

        if (typeof storage.persistToServerDatabase === 'function') {
          try { await storage.persistToServerDatabase(); } catch (_) {}
        }

        updateModalLayer();
        refreshStorageTabContent();
      });
    });

    const btnWipeAllBrands = modalLayer.querySelector('#btn-wipe-all-brands');
    if (btnWipeAllBrands) {
      btnWipeAllBrands.addEventListener('click', async (e) => {
        e.preventDefault();
        const confirmed = confirm(
          '⚠️ DELETE ALL BRANDS?\n\n' +
          'This will permanently delete all registered machinery brands from the database.\n\n' +
          'Are you sure you want to proceed?'
        );
        if (!confirmed) return;

        storage.setTable(TABLE_NAMES.BRANDS, []);
        storage.saveTable(TABLE_NAMES.BRANDS);

        const allModels = storage.getTable(TABLE_NAMES.MODELS) || [];
        let modelsChanged = false;
        allModels.forEach(m => {
          if (m.brand || m.brandId) {
            m.brand = '';
            m.brandId = '';
            modelsChanged = true;
          }
        });
        if (modelsChanged) {
          storage.setTable(TABLE_NAMES.MODELS, allModels);
          storage.saveTable(TABLE_NAMES.MODELS);
        }

        if (typeof storage.persistToServerDatabase === 'function') {
          try { await storage.persistToServerDatabase(); } catch (_) {}
        }

        updateModalLayer();
        refreshStorageTabContent();
      });
    }
  }

  // Form Submit for Add/Edit Storage Item
  const formItem = modalLayer.querySelector('#form-storage-item');
  if (formItem) {
    formItem.addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(formItem);
      const data = Object.fromEntries(formData.entries());

      if (typeof data.aliases === 'string') {
        data.aliases = data.aliases.split(',').map(s => s.trim().toLowerCase()).filter(s => s.length > 0);
      }

      if (data.id) {
        smartStorageService.updateStorageItem(data.id, data);
      } else {
        smartStorageService.addStorageItem(data);
      }

      closeModal();
      refreshStorageTabContent();
    });
  }

  // Form Controller for Step 2: Dropdown System + 2 Boxes (Brand & Model Number)
  const formBulkModels = modalLayer.querySelector('#form-bulk-add-models');
  if (formBulkModels) {
    const selMachine = modalLayer.querySelector('#sel-target-machine-name');
    const txtBrand = modalLayer.querySelector('#txt-col-brand');
    const txtModel = modalLayer.querySelector('#txt-col-model');
    const cntBrand = modalLayer.querySelector('#cnt-box-brand');
    const cntModel = modalLayer.querySelector('#cnt-box-model');
    const previewContainer = modalLayer.querySelector('#bulk-models-live-preview-box');
    const countBadge = modalLayer.querySelector('#lbl-live-model-counter');
    const submitBtn = modalLayer.querySelector('#btn-submit-bulk-models');

    // Inline New Machine Elements
    const btnToggleInline = modalLayer.querySelector('#btn-toggle-inline-new-machine');
    const boxInline = modalLayer.querySelector('#box-inline-new-machine');
    const inpInline = modalLayer.querySelector('#inp-inline-new-machine-name');
    const btnSaveInline = modalLayer.querySelector('#btn-save-inline-new-machine');
    const btnCancelInline = modalLayer.querySelector('#btn-cancel-inline-new-machine');
    const btnSwitchToBulkMn = modalLayer.querySelector('#btn-switch-to-bulk-machine-input');

    const btnSampleModels = modalLayer.querySelector('#btn-quick-sample-models');
    const btnClearBoxes = modalLayer.querySelector('#btn-clear-model-boxes');

    let currentParsed = { records: [] };

    // Toggle inline new machine
    if (btnToggleInline && boxInline) {
      btnToggleInline.addEventListener('click', (e) => {
        e.preventDefault();
        boxInline.style.display = boxInline.style.display === 'none' ? 'flex' : 'none';
        if (boxInline.style.display === 'flex' && inpInline) {
          inpInline.focus({ preventScroll: true });
        }
      });
    }

    if (btnCancelInline && boxInline) {
      btnCancelInline.addEventListener('click', (e) => {
        e.preventDefault();
        boxInline.style.display = 'none';
      });
    }

    if (btnSaveInline && inpInline && selMachine) {
      btnSaveInline.addEventListener('click', (e) => {
        e.preventDefault();
        const val = inpInline.value.trim();
        if (!val) return;
        const res = smartStorageService.addMachineName(val);
        const canonical = (res && res.name) ? res.name : smartStorageService.resolveCanonicalMachineName(val);
        
        // Select or add in dropdown
        let opt = Array.from(selMachine.options).find(o => o.value.toLowerCase() === canonical.toLowerCase());
        if (!opt) {
          opt = document.createElement('option');
          opt.value = canonical;
          opt.textContent = canonical;
          selMachine.appendChild(opt);
        }
        opt.selected = true;
        selMachine.appendChild(opt);
        inpInline.value = '';
        if (boxInline) boxInline.style.display = 'none';
        updateLivePreview();
      });
    }

    // Switch to Step 1 (Bulk Machine Names)
    if (btnSwitchToBulkMn) {
      btnSwitchToBulkMn.addEventListener('click', (e) => {
        e.preventDefault();
        activeModalState = { type: 'BULK_IMPORT_MACHINE_NAMES', data: {} };
        updateModalLayer();
      });
    }

    // Smart Multi-Column Tab Delimited Clipboard Paste Detection
    const handleSmartPaste = (e) => {
      const clipboardData = e.clipboardData || window.clipboardData;
      if (!clipboardData) return;
      const text = clipboardData.getData('text');
      if (!text) return;
      const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
      const tabLines = lines.filter(l => l.includes('\t'));
      if (tabLines.length > 0 && tabLines.length >= lines.length * 0.4) {
        e.preventDefault();

        // Check if clipboard contains multiple distinct machine names in column 1
        const machinesInClipboard = new Set(
          lines.map(l => l.split('\t')[0].trim()).filter(m => m && !/^(machine|machinename|name|sl|no)$/i.test(m))
        );
        if (machinesInClipboard.size > 1) {
          // Auto-switch to Excel Sheet Studio where each machine gets its own models cleanly
          activeModalState = { type: 'EXCEL_IMPORT_EXPORT', data: {} };
          excelImportActiveTab = 'PASTE';
          updateModalLayer();
          setTimeout(() => {
            const pasteBox = document.querySelector('#txt-excel-paste-input');
            if (pasteBox) {
              pasteBox.value = text;
              const parseBtn = document.querySelector('#btn-parse-pasted-excel');
              if (parseBtn) parseBtn.click();
            }
          }, 50);
          return;
        }

        const colBrand = [];
        const colModel = [];
        lines.forEach(l => {
          const parts = l.split('\t').map(p => p.trim());
          if (parts.length >= 3) {
            // If 3 columns (Machine, Brand, Model), auto-select machine if found
            if (selMachine && parts[0]) {
              let matched = Array.from(selMachine.options).find(o => o.value.toLowerCase() === parts[0].toLowerCase());
              if (!matched) {
                const newOpt = document.createElement('option');
                newOpt.value = parts[0];
                newOpt.textContent = parts[0];
                selMachine.appendChild(newOpt);
                matched = newOpt;
              }
              selMachine.value = matched.value;
            }
            colBrand.push(parts[1]);
            colModel.push(parts[2]);
          } else if (parts.length === 2) {
            colBrand.push(parts[0]);
            colModel.push(parts[1]);
          } else {
            colModel.push(parts[0]);
          }
        });
        if (colBrand.length > 0 && txtBrand) txtBrand.value = colBrand.join('\n');
        if (colModel.length > 0 && txtModel) txtModel.value = colModel.join('\n');
        updateLivePreview();
      }
    };

    if (txtBrand) txtBrand.addEventListener('paste', handleSmartPaste);
    if (txtModel) txtModel.addEventListener('paste', handleSmartPaste);

    // Quick Brand Chips
    modalLayer.querySelectorAll('.btn-col-brand-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        e.preventDefault();
        if (txtBrand && chip.dataset.brand) {
          txtBrand.value = chip.dataset.brand;
          updateLivePreview();
        }
      });
    });

    // Sample Models
    if (btnSampleModels) {
      btnSampleModels.addEventListener('click', (e) => {
        e.preventDefault();
        if (txtModel) {
          txtModel.value = "DDL-8700\nDDL-9000C\nDDL-900BB & C\nS-7200C\nMO-6814S";
        }
        if (txtBrand && !txtBrand.value.trim()) {
          txtBrand.value = "JUKI";
        }
        updateLivePreview();
      });
    }

    // Clear Models
    if (btnClearBoxes) {
      btnClearBoxes.addEventListener('click', (e) => {
        e.preventDefault();
        if (txtModel) txtModel.value = '';
        updateLivePreview();
      });
    }

    const updateLivePreview = () => {
      const targetMachine = selMachine ? selMachine.value.trim() : '';
      const bVal = txtBrand ? txtBrand.value : '';
      const modelVal = txtModel ? txtModel.value : '';

      currentParsed = smartStorageService.parseTwoColumnBrandModel(bVal, modelVal, 'JUKI', targetMachine);

      if (cntBrand) cntBrand.innerText = `${currentParsed.brands.length} ${currentParsed.brands.length === 1 ? 'line' : 'lines'}`;
      if (cntModel) cntModel.innerText = `${currentParsed.models.length} ${currentParsed.models.length === 1 ? 'model' : 'models'}`;

      if (!targetMachine || currentParsed.records.length === 0) {
        if (previewContainer) {
          previewContainer.innerHTML = `
            <div style="text-align: center; padding: 18px; color: var(--text-muted); font-size: 12px; border: 1.5px dashed rgba(255,255,255,0.1); border-radius: var(--radius-sm); background: rgba(0,0,0,0.15);">
              ${!targetMachine 
                ? '👉 Please select a Machine Name from the dropdown above.' 
                : '✍️ Paste or type model numbers in Box 2 (one per line).'}
            </div>
          `;
        }
        if (countBadge) countBadge.innerHTML = '<span style="color: var(--text-muted);">0 Models Ready</span>';
        if (submitBtn) {
          submitBtn.innerText = targetMachine ? `💾 Save Models to "${targetMachine}"` : '💾 Submit & Save Models';
          submitBtn.disabled = true;
        }
        return;
      }

      const totalCount = currentParsed.records.length;
      const existingCount = currentParsed.records.filter(r => r.isExisting).length;
      const newCount = totalCount - existingCount;

      if (countBadge) {
        countBadge.innerHTML = `
          <span style="color: #38bdf8; font-weight: 800;">Target: ${targetMachine}</span> &bull; 
          <span style="color: #34d399; font-weight: 800;">${totalCount} Models Ready</span>
          ${existingCount > 0 ? ` &bull; <span style="color: #fbbf24; font-weight: 700;">(${newCount} New, ${existingCount} Update)</span>` : ''}
        `;
      }

      if (submitBtn) {
        submitBtn.innerText = `💾 Save ${totalCount} Models under "${targetMachine}"`;
        submitBtn.disabled = totalCount === 0;
      }

      if (!previewContainer) return;

      let tableHtml = `
        <div style="max-height: 220px; overflow-y: auto; border: 1px solid rgba(255,255,255,0.1); border-radius: var(--radius-sm); background: rgba(0,0,0,0.2);">
          <table class="table" style="width: 100%; font-size: 11.5px; margin: 0;">
            <thead style="position: sticky; top: 0; background: #0f172a; z-index: 1; border-bottom: 1px solid var(--border-color);">
              <tr>
                <th style="padding: 6px 10px; width: 45px; text-align: center; color: #38bdf8;">SL #</th>
                <th style="padding: 6px 10px; color: #38bdf8;">Selected Machine (Dropdown)</th>
                <th style="padding: 6px 10px; width: 130px; color: #34d399;">Brand (Box 1)</th>
                <th style="padding: 6px 10px; color: #fbbf24;">Model Number (Box 2)</th>
                <th style="padding: 6px 10px; width: 110px; text-align: right; color: #94a3b8;">Status</th>
              </tr>
            </thead>
            <tbody>
      `;

      currentParsed.records.forEach((item, idx) => {
        tableHtml += `
          <tr style="border-bottom: 1px solid rgba(255,255,255,0.04); background: ${item.isExisting ? 'rgba(56, 189, 248, 0.04)' : 'transparent'};">
            <td style="padding: 5px 10px; text-align: center; color: #38bdf8; font-weight: 800; font-family: var(--font-mono); font-size: 11px;">#${idx + 1}</td>
            <td style="padding: 5px 10px; font-weight: 700; color: #e2e8f0;">${targetMachine}</td>
            <td style="padding: 5px 10px;">
              <span class="badge" style="background: rgba(52, 211, 153, 0.15); color: #34d399; font-weight: 800; font-size: 10px;">${item.brand}</span>
            </td>
            <td style="padding: 5px 10px; font-family: var(--font-mono); font-weight: 700; color: #fff;">${item.model}</td>
            <td style="padding: 5px 10px; text-align: right;">
              ${item.isExisting ? `
                <span class="badge" style="background: rgba(56, 189, 248, 0.2); color: #38bdf8; font-size: 9.5px; padding: 2px 6px; font-weight: 700;">🔄 Update</span>
              ` : `
                <span class="badge badge-active" style="font-size: 9.5px; padding: 2px 6px; font-weight: 700;">✅ Ready</span>
              `}
            </td>
          </tr>
        `;
      });

      tableHtml += `
            </tbody>
          </table>
        </div>
      `;

      previewContainer.innerHTML = tableHtml;
    };

    if (selMachine) selMachine.addEventListener('change', updateLivePreview);
    if (txtBrand) {
      txtBrand.addEventListener('input', updateLivePreview);
      txtBrand.addEventListener('change', updateLivePreview);
    }
    if (txtModel) {
      txtModel.addEventListener('input', updateLivePreview);
      txtModel.addEventListener('change', updateLivePreview);
    }

    // Initial calculation
    updateLivePreview();

    // Form Submit
    formBulkModels.addEventListener('submit', async (e) => {
      e.preventDefault();
      const targetMachine = selMachine ? selMachine.value.trim() : '';
      if (!targetMachine) {
        alert('Please select a Machine Name from the dropdown.');
        if (selMachine) selMachine.focus({ preventScroll: true });
        return;
      }
      if (!currentParsed.records || currentParsed.records.length === 0) {
        alert('Please enter at least one Model Number in Box 2.');
        if (txtModel) txtModel.focus({ preventScroll: true });
        return;
      }

      closeModal();
      try {
        const res = smartStorageService.saveModelsForMachine(targetMachine, currentParsed.records);
        const savedCount = (res && typeof res.totalSaved === 'number') ? res.totalSaved : (currentParsed.records.length);
        const msg = `Successfully saved ${savedCount} models under "${targetMachine}" in exact serial order to Database!`;
        if (typeof notificationService !== 'undefined' && notificationService.success) {
          notificationService.success(msg);
        }
        refreshStorageTabContent();
      } catch (err) {
        console.error('Failed to save models to database:', err);
        alert('Error saving models to database: ' + (err.message || 'Unknown error'));
      }
    });
  }

  // Form Submit for Add Machine Name
  const formAddMn = modalLayer.querySelector('#form-add-machine-name');
  if (formAddMn) {
    formAddMn.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = modalLayer.querySelector('#inp-new-machine-name').value;
      if (!name || !name.trim()) return;
      const clean = name.trim();
      closeModal();
      try {
        const res = smartStorageService.addMachineName(clean);
        if (typeof storage.persistToServerDatabase === 'function') {
          storage.persistToServerDatabase();
        }
        if (res && res.added) {
          const msg = `✅ Machine Name "${clean}" registered and saved to Database!`;
          if (typeof notificationService !== 'undefined' && notificationService.success) {
            notificationService.success(msg);
          }
        } else {
          const existName = res?.name || clean;
          const msg = `ℹ️ Machine Name "${clean}" already exists as "${existName}". Duplicate entry was skipped.`;
          if (typeof notificationService !== 'undefined' && notificationService.info) {
            notificationService.info(msg);
          }
        }
        refreshStorageTabContent();
      } catch (err) {
        console.error('Failed to save machine name:', err);
        alert('Error saving machine name: ' + (err.message || 'Unknown error'));
      }
    });
  }

  // Form Controller for Step 1: Bulk Import Machine Names
  const formBulkMn = modalLayer.querySelector('#form-bulk-machine-names');
  if (formBulkMn) {
    const txtMn = modalLayer.querySelector('#txt-bulk-machine-names');
    const cntMn = modalLayer.querySelector('#cnt-bulk-mn-lines');
    const btnSampleMn = modalLayer.querySelector('#btn-load-sample-mn');
    const btnSaveAndAddModels = modalLayer.querySelector('#btn-save-mn-and-open-models');
    const btnPurgeDummy = modalLayer.querySelector('#btn-purge-empty-dummy-names');

    const updateMnCount = () => {
      if (!txtMn || !cntMn) return;
      const lines = txtMn.value.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      if (lines.length === 0) {
        cntMn.className = 'badge';
        cntMn.style.background = 'rgba(56, 189, 248, 0.15)';
        cntMn.style.color = '#38bdf8';
        cntMn.innerText = '0 lines';
        return;
      }

      let mnTable = [];
      try {
        mnTable = storage.getTable(TABLE_NAMES.MACHINE_NAMES) || [];
      } catch (_) {}

      const seen = new Set();
      let newCount = 0;
      let dupeCount = 0;

      lines.forEach(l => {
        const norm = smartStorageService.normalizePureAlphanumeric(l);
        if (seen.has(norm)) {
          dupeCount++;
          return;
        }
        seen.add(norm);

        const canon = smartStorageService.resolveCanonicalMachineName(l);
        const canonNorm = smartStorageService.normalizePureAlphanumeric(canon);
        const exists = mnTable.some(m => {
          if (!m || !m.name) return false;
          const mLower = m.name.trim().toLowerCase();
          const mNorm = smartStorageService.normalizePureAlphanumeric(m.name);
          return (
            mLower === l.toLowerCase() ||
            mLower === canon.toLowerCase() ||
            mNorm === norm ||
            mNorm === canonNorm
          );
        });

        if (exists) {
          dupeCount++;
        } else {
          newCount++;
        }
      });

      if (dupeCount > 0) {
        cntMn.className = 'badge';
        cntMn.style.background = 'rgba(245, 158, 11, 0.2)';
        cntMn.style.color = '#fbbf24';
        cntMn.style.border = '1px solid rgba(245, 158, 11, 0.4)';
        cntMn.innerText = `${lines.length} lines: ${newCount} New, ${dupeCount} Duplicate(s) will be skipped`;
      } else {
        cntMn.className = 'badge badge-active';
        cntMn.style.background = 'rgba(16, 185, 129, 0.2)';
        cntMn.style.color = '#34d399';
        cntMn.style.border = '1px solid rgba(16, 185, 129, 0.4)';
        cntMn.innerText = `${newCount} New Machine Name(s) Ready to Add`;
      }
    };

    if (txtMn) {
      txtMn.addEventListener('input', updateMnCount);
      txtMn.addEventListener('change', updateMnCount);
      updateMnCount();
    }

    if (btnSampleMn && txtMn) {
      btnSampleMn.addEventListener('click', (e) => {
        e.preventDefault();
        txtMn.value = "Plane Machine\nOverlock Machine\nVertical Machine\nInterlock Machine\nButton Hole Machine\nButton Attach Machine\nFeed Off The Arm Machine";
        updateMnCount();
      });
    }

    // Edit single registered machine name
    modalLayer.querySelectorAll('.btn-edit-single-mn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const name = btn.dataset.name;
        activeModalState = {
          type: 'EDIT_MACHINE_NAME',
          machineName: name,
          returnTo: 'BULK_IMPORT_MACHINE_NAMES'
        };
        updateModalLayer();
      });
    });

    // Delete single registered machine name
    modalLayer.querySelectorAll('.btn-delete-single-mn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const name = btn.dataset.name;
        if (confirm(`Remove machine name "${name}" from registered list?`)) {
          smartStorageService.deleteMachineNameOnly(name);
          if (typeof storage.persistToServerDatabase === 'function') {
            await storage.persistToServerDatabase();
          }
          updateModalLayer();
        }
      });
    });

    // Clear 0-model dummy names
    if (btnPurgeDummy) {
      btnPurgeDummy.addEventListener('click', async (e) => {
        e.preventDefault();
        if (confirm('Clear all unused dummy machine names that have 0 models?')) {
          const purged = smartStorageService.purgeUnusedMachineNames();
          if (typeof storage.persistToServerDatabase === 'function') {
            await storage.persistToServerDatabase();
          }
          alert(`Cleaned ${purged} unused machine names!`);
          updateModalLayer();
        }
      });
    }

    // Save & Go to Step 2
    if (btnSaveAndAddModels) {
      btnSaveAndAddModels.addEventListener('click', async (e) => {
        e.preventDefault();
        const text = txtMn ? txtMn.value.trim() : '';
        let targetMachine = '';
        if (text) {
          btnSaveAndAddModels.disabled = true;
          btnSaveAndAddModels.innerHTML = '⏳ Saving to Database...';
          const res = await smartStorageService.addMultipleMachineNames(text);
          if (typeof storage.persistToServerDatabase === 'function') {
            await storage.persistToServerDatabase();
          }

          if (res.addedNames && res.addedNames.length > 0) {
            targetMachine = res.addedNames[0];
          } else {
            const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
            if (lines.length > 0) {
              targetMachine = smartStorageService.resolveCanonicalMachineName(lines[0]);
            }
          }

          let msg = '';
          if (res.addedCount > 0 && res.skippedCount > 0) {
            msg = `✅ Added ${res.addedCount} new machine names. ℹ️ Skipped ${res.skippedCount} duplicate(s).`;
          } else if (res.addedCount > 0) {
            msg = `✅ Added ${res.addedCount} new machine names!`;
          } else {
            msg = `ℹ️ Skipped ${res.skippedCount} duplicate(s) (already registered in database). Selected "${targetMachine}" in Step 2.`;
          }

          if (typeof notificationService !== 'undefined') {
            if (res.addedCount > 0) notificationService.success(msg);
            else notificationService.info(msg);
          }
        }
        activeModalState = { type: 'BULK_ADD_MODELS', machineName: targetMachine };
        updateModalLayer();
      });
    }

    // Save only
    formBulkMn.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = txtMn ? txtMn.value.trim() : '';
      if (!text) return;
      closeModal();
      try {
        const res = await smartStorageService.addMultipleMachineNames(text);
        if (typeof storage.persistToServerDatabase === 'function') {
          storage.persistToServerDatabase();
        }

        let msg = '';
        if (res.addedCount > 0 && res.skippedCount > 0) {
          msg = `✅ Added ${res.addedCount} new machine names. ℹ️ Skipped ${res.skippedCount} duplicate(s) that already exist in database.`;
        } else if (res.addedCount > 0) {
          msg = `✅ Successfully registered and saved ${res.addedCount} new Machine Names to Database!`;
        } else {
          msg = `ℹ️ All ${res.skippedCount} machine names already exist in the database (0 duplicates added).`;
        }

        if (typeof notificationService !== 'undefined') {
          if (res.addedCount > 0) {
            notificationService.success(msg);
          } else {
            notificationService.info(msg);
          }
        }
        refreshStorageTabContent();
      } catch (err) {
        console.error('Failed to save machine names:', err);
        alert('Error saving machine names: ' + (err.message || 'Unknown error'));
      }
    });
  }

  // Bulk Paste Inspection -> Opens Quality Gate
  const btnInspectPaste = modalLayer.querySelector('#btn-execute-bulk-paste-inspect');
  if (btnInspectPaste) {
    btnInspectPaste.addEventListener('click', (e) => {
      e.preventDefault();
      const textarea = modalLayer.querySelector('#txt-bulk-paste-input');
      const text = textarea ? textarea.value : '';
      if (!text.trim()) {
        alert('Please paste some text to inspect.');
        return;
      }
      const cat = (activeTab === 'SCHEMA_BUILDER' || activeTab === 'HEALTH_SCANNER' || activeTab === 'RULES') ? 'MACHINE' : activeTab;
      qualityGateData = smartStorageService.stageAndValidateImport(cat, text);
      qualityGateData.filter = 'ALL';
      activeModalState = { type: 'QUALITY_GATE', data: qualityGateData };
      updateModalLayer();
    });
  }

  // File Upload Selection -> Inspect in Quality Gate
  const dropZone = modalLayer.querySelector('#storage-drop-zone');
  const fileInput = modalLayer.querySelector('#storage-file-input');
  const fileNameDisplay = modalLayer.querySelector('#storage-selected-file-name');
  const btnExecInspect = modalLayer.querySelector('#btn-execute-file-inspect');
  let selectedFile = null;

  if (dropZone && fileInput) {
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        selectedFile = e.target.files[0];
        if (fileNameDisplay) fileNameDisplay.innerText = `Selected: ${selectedFile.name} (${Math.round(selectedFile.size / 1024)} KB)`;
        if (btnExecInspect) btnExecInspect.disabled = false;
      }
    });
  }

  if (btnExecInspect) {
    btnExecInspect.addEventListener('click', (e) => {
      e.preventDefault();
      if (!selectedFile) return;
      const cat = (activeTab === 'SCHEMA_BUILDER' || activeTab === 'HEALTH_SCANNER' || activeTab === 'RULES') ? 'MACHINE' : activeTab;

      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const content = ev.target.result;
          let parsedRows = [];
          if (selectedFile.name.endsWith('.csv') || typeof content === 'string') {
            const lines = content.split(/\r?\n/).slice(1).filter(l => l.trim().length > 0);
            parsedRows = lines.map(line => line.split(',').map(c => c.replace(/^["']|["']$/g, '').trim()));
          } else if (typeof XLSX !== 'undefined') {
            const data = new Uint8Array(content);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonRows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            parsedRows = jsonRows.slice(1);
          } else {
            alert('Spreadsheet engine not loaded. Please upload CSV format.');
            return;
          }

          qualityGateData = smartStorageService.stageAndValidateImport(cat, parsedRows);
          qualityGateData.filter = 'ALL';
          activeModalState = { type: 'QUALITY_GATE', data: qualityGateData };
          updateModalLayer();
        } catch (err) {
          alert(`Quality Gate inspection failed: ${err.message}`);
        }
      };

      if (selectedFile.name.endsWith('.csv')) {
        reader.readAsText(selectedFile);
      } else {
        reader.readAsArrayBuffer(selectedFile);
      }
    });
  }

  // Quality Gate Filters
  modalLayer.querySelectorAll('.btn-qg-filter').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (qualityGateData) {
        qualityGateData.filter = btn.dataset.filter;
        updateModalLayer();
      }
    });
  });

  // Quality Gate Auto-Fix All
  const btnQgAutoFixAll = modalLayer.querySelector('#btn-qg-autofix-all');
  if (btnQgAutoFixAll) {
    btnQgAutoFixAll.addEventListener('click', (e) => {
      e.preventDefault();
      if (qualityGateData) {
        smartStorageService.autoFixAllStagedRows(qualityGateData.stagedRows);
        qualityGateData.readyCount = qualityGateData.stagedRows.filter(r => r.status === 'READY').length;
        qualityGateData.warningCount = qualityGateData.stagedRows.filter(r => r.status === 'WARNING').length;
        qualityGateData.fatalCount = qualityGateData.stagedRows.filter(r => r.status === 'FATAL').length;
        updateModalLayer();
      }
    });
  }

  // Quality Gate Discard Invalid Rows
  const btnQgDiscardInvalid = modalLayer.querySelector('#btn-qg-discard-invalid');
  if (btnQgDiscardInvalid) {
    btnQgDiscardInvalid.addEventListener('click', (e) => {
      e.preventDefault();
      if (qualityGateData) {
        qualityGateData.stagedRows = qualityGateData.stagedRows.filter(r => r.status !== 'FATAL');
        qualityGateData.totalCount = qualityGateData.stagedRows.length;
        qualityGateData.readyCount = qualityGateData.stagedRows.filter(r => r.status === 'READY').length;
        qualityGateData.warningCount = qualityGateData.stagedRows.filter(r => r.status === 'WARNING').length;
        qualityGateData.fatalCount = 0;
        updateModalLayer();
      }
    });
  }

  // Quality Gate Single Row Auto-Fix
  modalLayer.querySelectorAll('.btn-qg-autofix-row').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const rowId = btn.dataset.rowId;
      if (qualityGateData) {
        const row = qualityGateData.stagedRows.find(r => r.rowId === rowId);
        if (row) {
          smartStorageService.autoFixStagedRow(row);
          qualityGateData.readyCount = qualityGateData.stagedRows.filter(r => r.status === 'READY').length;
          qualityGateData.warningCount = qualityGateData.stagedRows.filter(r => r.status === 'WARNING').length;
          updateModalLayer();
        }
      }
    });
  });

  // Quality Gate Single Row Discard
  modalLayer.querySelectorAll('.btn-qg-discard-row').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const rowId = btn.dataset.rowId;
      if (qualityGateData) {
        qualityGateData.stagedRows = qualityGateData.stagedRows.filter(r => r.rowId !== rowId);
        qualityGateData.totalCount = qualityGateData.stagedRows.length;
        qualityGateData.readyCount = qualityGateData.stagedRows.filter(r => r.status === 'READY').length;
        qualityGateData.warningCount = qualityGateData.stagedRows.filter(r => r.status === 'WARNING').length;
        qualityGateData.fatalCount = qualityGateData.stagedRows.filter(r => r.status === 'FATAL').length;
        updateModalLayer();
      }
    });
  });

  // Quality Gate Commit Import
  const btnQgCommit = modalLayer.querySelector('#btn-qg-commit-import');
  if (btnQgCommit) {
    btnQgCommit.addEventListener('click', (e) => {
      e.preventDefault();
      if (qualityGateData) {
        const res = smartStorageService.commitStagedRows(qualityGateData.category, qualityGateData.stagedRows);
        alert(`✅ Committed ${res.importedCount} verified records into Master Storage!`);
        closeModal();
        refreshStorageTabContent();
      }
    });
  }

  // --- EDIT MODEL SPECIFICATION FORM HANDLER ---
  if (activeModalState.type === 'EDIT_MODEL_SPEC') {
    const formEditModel = modalLayer.querySelector('#form-edit-model-spec');
    if (formEditModel) {
      formEditModel.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = modalLayer.querySelector('#inp-edit-model-id')?.value;
        const machineName = modalLayer.querySelector('#inp-edit-machine-name')?.value?.trim();
        const brand = modalLayer.querySelector('#inp-edit-brand-name')?.value?.trim()?.toUpperCase();
        const model = modalLayer.querySelector('#inp-edit-model-number')?.value?.trim();
        const status = modalLayer.querySelector('#sel-edit-model-status')?.value || 'ACTIVE';
        const oldMachine = modalLayer.querySelector('#inp-orig-machine')?.value;
        const oldBrand = modalLayer.querySelector('#inp-orig-brand')?.value;
        const oldModel = modalLayer.querySelector('#inp-orig-model')?.value;

        if (!machineName || !brand || !model) {
          alert('Please fill in Machine Name, Brand, and Model Number.');
          return;
        }

        const submitBtn = modalLayer.querySelector('#btn-submit-edit-model-spec');
        const origHtml = submitBtn ? submitBtn.innerHTML : '';
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '⏳ Saving...';
        }

        try {
          const res = await smartStorageService.updateModelSpecification(id, {
            machineName,
            brand,
            model,
            status,
            oldMachineName: oldMachine,
            oldBrand,
            oldModel
          });

          const invMsg = (res && res.invUpdatedCount > 0) ? ` & auto-updated ${res.invUpdatedCount} machine(s) in Inventory!` : '';
          if (typeof notificationService !== 'undefined' && notificationService.success) {
            notificationService.success('Model Specification Saved', `"${model}" under "${machineName}" (${brand}) updated.${invMsg}`);
          }

          closeModal();
          refreshStorageTabContent();
        } catch (err) {
          console.error('Failed to update model spec:', err);
          alert('Error saving changes: ' + err.message);
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = origHtml;
          }
        }
      });
    }
  }

  // --- EDIT / RENAME MACHINE TYPE FORM HANDLER ---
  if (activeModalState.type === 'EDIT_MACHINE_NAME') {
    const formEditMachine = modalLayer.querySelector('#form-edit-machine-name');
    if (formEditMachine) {
      formEditMachine.addEventListener('submit', async (e) => {
        e.preventDefault();
        const oldName = modalLayer.querySelector('#inp-orig-machine-name')?.value?.trim();
        const newName = modalLayer.querySelector('#inp-new-renamed-machine-name')?.value?.trim();
        const newCode = modalLayer.querySelector('#inp-machine-short-code')?.value?.trim() || null;
        const returnTo = modalLayer.querySelector('#inp-return-to')?.value?.trim();

        if (!newName) {
          alert('Machine name cannot be empty.');
          return;
        }

        const submitBtn = modalLayer.querySelector('#btn-submit-rename-machine');
        const origHtml = submitBtn ? submitBtn.innerHTML : '';
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '⏳ Saving...';
        }

        try {
          const res = await smartStorageService.renameMachineName(oldName, newName, newCode);

          const invMsg = (res && res.invUpdatedCount > 0) ? ` & auto-renamed ${res.invUpdatedCount} machine(s) in Inventory!` : '';
          if (typeof notificationService !== 'undefined' && notificationService.success) {
            notificationService.success('Machine Type Renamed', `"${oldName}" renamed to "${newName}".${invMsg}`);
          }

          if (returnTo === 'BULK_IMPORT_MACHINE_NAMES') {
            activeModalState = { type: 'BULK_IMPORT_MACHINE_NAMES', data: {} };
            updateModalLayer();
          } else {
            closeModal();
          }
          refreshStorageTabContent();
        } catch (err) {
          console.error('Failed to rename machine:', err);
          alert('Error renaming machine: ' + err.message);
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = origHtml;
          }
        }
      });
    }
  }

  // --- EDIT / RENAME BRAND FORM HANDLER ---
  if (activeModalState.type === 'EDIT_BRAND_NAME') {
    const formEditBrand = modalLayer.querySelector('#form-edit-brand-name');
    if (formEditBrand) {
      const btnCancelBrand = modalLayer.querySelector('#btn-cancel-edit-brand');
      if (btnCancelBrand) {
        btnCancelBrand.addEventListener('click', (e) => {
          e.preventDefault();
          activeModalState = { type: 'MANAGE_BRANDS', data: {} };
          updateModalLayer();
        });
      }

      formEditBrand.addEventListener('submit', async (e) => {
        e.preventDefault();
        const oldBrand = modalLayer.querySelector('#inp-orig-brand-name')?.value?.trim();
        const newBrand = modalLayer.querySelector('#inp-new-renamed-brand-name')?.value?.trim()?.toUpperCase();

        if (!newBrand) {
          alert('Brand name cannot be empty.');
          return;
        }

        const submitBtn = modalLayer.querySelector('#btn-submit-rename-brand');
        const origHtml = submitBtn ? submitBtn.innerHTML : '';
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '⏳ Saving...';
        }

        try {
          const res = await smartStorageService.renameBrand(oldBrand, newBrand);

          const invMsg = (res && res.invUpdatedCount > 0) ? ` & auto-updated ${res.invUpdatedCount} machine(s) in Inventory!` : '';
          if (typeof notificationService !== 'undefined' && notificationService.success) {
            notificationService.success('Brand Renamed', `"${oldBrand}" renamed to "${newBrand}".${invMsg}`);
          }

          activeModalState = { type: 'MANAGE_BRANDS', data: {} };
          updateModalLayer();
          refreshStorageTabContent();
        } catch (err) {
          console.error('Failed to rename brand:', err);
          alert('Error renaming brand: ' + err.message);
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = origHtml;
          }
        }
      });
    }
  }

  // Add Custom Field Submit
  const formCustomField = modalLayer.querySelector('#form-add-custom-field');
  if (formCustomField) {
    const selType = formCustomField.querySelector('#sel-custom-field-type');
    const optGroup = formCustomField.querySelector('#group-field-options');
    if (selType && optGroup) {
      selType.addEventListener('change', () => {
        optGroup.style.display = selType.value === 'select' ? 'block' : 'none';
      });
    }

    formCustomField.addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(formCustomField);
      const data = Object.fromEntries(formData.entries());
      data.required = Boolean(formData.get('required'));
      data.showInTable = Boolean(formData.get('showInTable'));

      storageSchemaService.addCustomField(activeBuilderCategory, data);
      alert(`✅ Custom attribute "${data.label}" added!`);
      closeModal();
      refreshStorageTabContent();
    });
  }

  // Add Custom Category Submit
  const formCustomCat = modalLayer.querySelector('#form-add-custom-category');
  if (formCustomCat) {
    formCustomCat.addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(formCustomCat);
      const data = Object.fromEntries(formData.entries());

      try {
        const cat = storageSchemaService.createCustomCategory(data);
        activeTab = cat.categoryKey;
        activeBuilderCategory = cat.categoryKey;
        alert(`✅ Reference Category "${cat.title}" created!`);
        closeModal();
        renderPage();
      } catch (err) {
        alert(err.message);
      }
    });
  }

  // Add Correction Rule Submit
  const formRule = modalLayer.querySelector('#form-correction-rule');
  if (formRule) {
    formRule.addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(formRule);
      const data = Object.fromEntries(formData.entries());
      smartStorageService.addCorrectionRule(data);
      closeModal();
      refreshStorageTabContent();
    });
  }

  // Live Test Bench Runner
  const testInput = modalLayer.querySelector('#inp-test-bench-input');
  const btnRunTest = modalLayer.querySelector('#btn-run-test-bench-check');
  const testResultContainer = modalLayer.querySelector('#test-bench-result-container');

  const executeTest = () => {
    if (!testInput || !testResultContainer) return;
    const val = testInput.value.trim();
    if (!val) {
      testResultContainer.innerHTML = `<div style="color: #f87171; font-size: 12px;">Please enter some text to test.</div>`;
      return;
    }

    const check = smartStorageService.checkCorrection('ANY', val);
    if (!check || !check.hasIssue) {
      testResultContainer.innerHTML = `
        <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid #10b981; border-radius: var(--radius-sm); padding: 8px 12px; color: #34d399; font-size: 12px;">
          ✅ "${val}" - Matches canonical standard.
        </div>
      `;
    } else {
      testResultContainer.innerHTML = `
        <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.35); border-radius: var(--radius-sm); padding: 10px 12px; display: flex; flex-direction: column; gap: 6px;">
          <div style="font-weight: 700; color: #fbbf24; font-size: 12px;">
            ⚠️ Typo Detected: ${check.issueTitle}
          </div>
          <div style="font-size: 11.5px; color: #fff;">
            Input: <span style="color: #f87171; font-family: var(--font-mono); font-weight: 700;">"${check.original}"</span> &rarr; 
            Standard: <span style="color: #34d399; font-family: var(--font-mono); font-weight: 800;">"${check.suggested}"</span>
          </div>
          <button type="button" id="btn-trigger-interactive-dialog" class="btn btn-warning btn-sm" style="font-weight: 800; align-self: flex-start; margin-top: 3px; font-size: 11px;">
            💬 Test Auto-Correct Dialog
          </button>
        </div>
      `;

      const btnDialog = testResultContainer.querySelector('#btn-trigger-interactive-dialog');
      if (btnDialog) {
        btnDialog.addEventListener('click', () => {
          smartStorageService.promptCorrection({
            original: check.original,
            suggested: check.suggested,
            issueTitle: check.issueTitle,
            context: 'Live Test Bench',
            onConfirm: (fixedVal) => {
              testInput.value = fixedVal;
              executeTest();
            }
          });
        });
      }
    }
  };

  if (btnRunTest) btnRunTest.addEventListener('click', executeTest);
  if (testInput) {
    testInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') executeTest();
    });
  }
}

/**
 * Full View Render with Guaranteed Scroll Position Restoration
 */
function renderPage(preserveScroll = true) {
  const container = document.getElementById('main-view-container');
  if (!container) return;

  const savedScroll = {
    container: container.scrollTop,
    table: document.getElementById('storage-table-container')?.scrollTop || 0,
    details: document.getElementById('builder-details-panel')?.scrollTop || 0
  };

  container.innerHTML = renderStorageView();
  initStorageEvents();

  if (preserveScroll) {
    requestAnimationFrame(() => {
      if (savedScroll.container > 0) container.scrollTop = savedScroll.container;
      const tbl = document.getElementById('storage-table-container');
      if (tbl && savedScroll.table > 0) tbl.scrollTop = savedScroll.table;
      const pnl = document.getElementById('builder-details-panel');
      if (pnl && savedScroll.details > 0) pnl.scrollTop = savedScroll.details;
    });
  }
}
