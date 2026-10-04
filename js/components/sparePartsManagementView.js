/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Spare Parts Management System — Admin Configuration Component
 * 
 * Capabilities:
 * - Full Master Data CRUD (Add, Edit, Remove, Activate, Deactivate)
 * - Clean 3-Column Excel Import with Duplicate Detection
 * - 1-Click Excel Export with Machine Usage Counters
 * - Spare Parts Usage History & Connected Machines Inspector
 * - Preserved History Integrity Rule (Safe Deactivation if used in machine maintenance)
 * - Multi-attribute Search & Multi-criteria Filters (Category, Status, Usage)
 * - Bulk Operations (Bulk Activate, Deactivate, Bulk Edit, Safe Bulk Delete)
 */

import { historyService } from '../services/historyService.js';
import { authService } from '../services/authService.js';
import { storage } from '../db/storage.js';
import { TABLE_NAMES } from '../db/schema.js';
import { notificationService } from '../services/notificationService.js';
import { smartStorageService } from '../services/smartStorageService.js?v=4.22.19';
import { state } from '../state.js';
import { openSparePartsImportModal } from './machineHistoryView.js';

let searchFilter = '';
let statusFilter = 'ALL';
let categoryFilter = 'ALL';
let usageFilter = 'ALL';
let selectedItemIds = new Set();
let activeModalState = null; // { type: 'ADD'|'EDIT'|'USAGE_HISTORY'|'PRESERVED_NOTICE'|'BULK_EDIT', item: {}, usageStats: {} }

export function renderSparePartsManagementView() {
  const master = historyService.getSparePartsMaster() || [];
  const kpis = historyService.getSparePartsSummaryStats();
  const isAdmin = authService.isAdmin();
  const canEdit = authService.hasAccess('spare_parts', 'edit') || isAdmin;
  const canDelete = authService.hasAccess('spare_parts', 'delete') || isAdmin;

  // Filter Items
  const filtered = master.filter(it => {
    // 1. Search Query
    if (searchFilter) {
      const q = searchFilter.toLowerCase().trim();
      const name = (it.name || '').toLowerCase();
      const code = (it.code || '').toLowerCase();
      const area = (it.areaOfUse || it.description || '').toLowerCase();
      const bmo = (it.brandModelOrigin || '').toLowerCase();
      const cat = (it.category || '').toLowerCase();
      const matches = name.includes(q) || code.includes(q) || area.includes(q) || bmo.includes(q) || cat.includes(q);
      if (!matches) return false;
    }

    // 2. Status Filter
    if (statusFilter !== 'ALL') {
      if (it.status !== statusFilter) return false;
    }

    // 3. Category Filter
    if (categoryFilter !== 'ALL') {
      if ((it.category || 'Mechanical').toUpperCase() !== categoryFilter.toUpperCase()) return false;
    }

    // 4. Usage Filter
    if (usageFilter !== 'ALL') {
      const stats = historyService.getSparePartUsageStats(it.id);
      if (usageFilter === 'USED' && stats.usageCount === 0) return false;
      if (usageFilter === 'UNUSED' && stats.usageCount > 0) return false;
    }

    return true;
  });

  return `
    <div class="spare-parts-view-container" style="display: flex; flex-direction: column; gap: 8px; height: 100%; min-height: 0; overflow: hidden; width: 100%;">
      
      <!-- Top Title & KPI Cards Header -->
      <div class="view-header-row" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; flex-shrink: 0;">
        <div style="min-width: 0; flex: 1;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="font-size: 20px;">⚙️</div>
            <div>
              <h1 style="font-size: 16px; font-weight: 800; color: #fff; margin: 0; letter-spacing: -0.3px; word-break: break-word;">
                Spare Parts Management &amp; Configuration
              </h1>
              <div style="font-size: 11px; color: #38bdf8; font-weight: 600; margin-top: 1px;">
                Enterprise Master Catalog, Machine Usage Ledger &amp; Maintenance History Linkage
              </div>
            </div>
          </div>
        </div>

        <!-- Quick Summary KPI Pills -->
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <div style="background: rgba(2, 132, 199, 0.15); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: var(--radius-md); padding: 4px 10px; text-align: center; min-width: 80px; flex: 1 1 auto;">
            <div style="font-size: 9px; font-weight: 700; color: #38bdf8; text-transform: uppercase;">Total Master Items</div>
            <div style="font-size: 15px; font-weight: 800; color: #fff; line-height: 1.2;">${kpis.totalParts}</div>
          </div>
          <div style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(52, 211, 153, 0.3); border-radius: var(--radius-md); padding: 4px 10px; text-align: center; min-width: 80px; flex: 1 1 auto;">
            <div style="font-size: 9px; font-weight: 700; color: #34d399; text-transform: uppercase;">Active (Searchable)</div>
            <div style="font-size: 15px; font-weight: 800; color: #34d399; line-height: 1.2;">${kpis.activeParts}</div>
          </div>
          <div style="background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(251, 191, 36, 0.3); border-radius: var(--radius-md); padding: 4px 10px; text-align: center; min-width: 80px; flex: 1 1 auto;">
            <div style="font-size: 9px; font-weight: 700; color: #fbbf24; text-transform: uppercase;">Inactive / Preserved</div>
            <div style="font-size: 15px; font-weight: 800; color: #fbbf24; line-height: 1.2;">${kpis.inactiveParts}</div>
          </div>
          <div style="background: rgba(139, 92, 246, 0.15); border: 1px solid rgba(167, 139, 250, 0.3); border-radius: var(--radius-md); padding: 4px 10px; text-align: center; min-width: 80px; flex: 1 1 auto;">
            <div style="font-size: 9px; font-weight: 700; color: #c084fc; text-transform: uppercase;">Lifetime Replacements</div>
            <div style="font-size: 15px; font-weight: 800; color: #c084fc; line-height: 1.2;">${kpis.totalReplacements} <span style="font-size: 10px;">PCS</span></div>
          </div>
        </div>
      </div>

      <!-- Action Toolbar -->
      <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 8px 12px; display: flex; flex-direction: column; gap: 8px; flex-shrink: 0;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
          
          <!-- Filters (Search, Category, Status, Usage) -->
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; flex: 1; min-width: 0; width: 100%;">
            <!-- Live Search -->
            <div style="position: relative; flex: 1 1 180px; min-width: 0; max-width: 100%;">
              <input type="text" id="inp-spare-search" class="form-control" placeholder="Search Item Name, Brand, Code..." value="${searchFilter}" style="padding-left: 28px; font-size: 12px; height: 32px;" />
              <span style="position: absolute; left: 8px; top: 50%; transform: translateY(-50%); font-size: 11px; opacity: 0.5;">🔍</span>
            </div>

            <!-- Category Filter -->
            <select id="sel-spare-category" class="filter-select" style="width: auto; min-width: 110px; font-size: 11.5px; height: 32px; padding: 4px 8px; flex: 1 1 auto;">
              <option value="ALL" ${categoryFilter === 'ALL' ? 'selected' : ''}>All Categories</option>
              <option value="Mechanical" ${categoryFilter === 'Mechanical' ? 'selected' : ''}>Mechanical</option>
              <option value="Electrical" ${categoryFilter === 'Electrical' ? 'selected' : ''}>Electrical</option>
              <option value="Pneumatic" ${categoryFilter === 'Pneumatic' ? 'selected' : ''}>Pneumatic</option>
              <option value="Optical" ${categoryFilter === 'Optical' ? 'selected' : ''}>Optical</option>
            </select>

            <!-- Status Filter -->
            <select id="sel-spare-status" class="filter-select" style="width: auto; min-width: 100px; font-size: 11.5px; height: 32px; padding: 4px 8px; flex: 1 1 auto;">
              <option value="ALL" ${statusFilter === 'ALL' ? 'selected' : ''}>All Statuses</option>
              <option value="ACTIVE" ${statusFilter === 'ACTIVE' ? 'selected' : ''}>🟢 Active</option>
              <option value="INACTIVE" ${statusFilter === 'INACTIVE' ? 'selected' : ''}>⏸️ Inactive</option>
            </select>

            <!-- Usage Filter -->
            <select id="sel-spare-usage" class="filter-select" style="width: auto; min-width: 120px; font-size: 11.5px; height: 32px; padding: 4px 8px; flex: 1 1 auto;">
              <option value="ALL" ${usageFilter === 'ALL' ? 'selected' : ''}>All Machine Usage</option>
              <option value="USED" ${usageFilter === 'USED' ? 'selected' : ''}>🧵 Used in Machines (>0)</option>
              <option value="UNUSED" ${usageFilter === 'UNUSED' ? 'selected' : ''}>📦 Unused in Machines (0)</option>
            </select>
          </div>

          <!-- Action Buttons -->
          <div class="view-header-actions" style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
            <button id="btn-spare-consumption-report" class="btn btn-primary btn-sm" style="font-weight: 700; background: linear-gradient(135deg, #0284c7, #0369a1); font-size: 11.5px; padding: 6px 11px;" title="View Hierarchical Consumption & Usage Analytics">
              📊 Usage Report
            </button>
            ${canEdit ? `
              <button id="btn-spare-add-new" class="btn btn-secondary btn-sm" style="font-weight: 700; font-size: 11.5px; padding: 6px 11px;">
                ➕ Add Spare Part
              </button>
            ` : ''}
            <button id="btn-spare-excel-import" class="btn btn-secondary btn-sm" style="font-size: 11.5px; padding: 6px 11px;" title="Upload Clean 3-Column Excel Master">
              📥 Excel Import
            </button>
            <button id="btn-spare-excel-export" class="btn btn-secondary btn-sm" style="font-size: 11.5px; padding: 6px 11px;" title="Download Master Catalog to Excel with Usage Counters">
              📤 Export Excel
            </button>
          </div>
        </div>

        <!-- Bulk Action Strip (Visible when rows selected) -->
        ${selectedItemIds.size > 0 ? `
          <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(2, 132, 199, 0.12); border: 1px dashed #38bdf8; border-radius: var(--radius-sm); padding: 6px 12px; margin-top: 2px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 12px; font-weight: 700; color: #38bdf8;">
                ✓ ${selectedItemIds.size} spare part(s) selected
              </span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <button id="btn-spare-bulk-activate" class="btn btn-success btn-sm" style="font-size: 11px; padding: 4px 8px;">Activate</button>
              <button id="btn-spare-bulk-deactivate" class="btn btn-secondary btn-sm" style="font-size: 11px; padding: 4px 8px;">Deactivate</button>
              <button id="btn-spare-bulk-edit" class="btn btn-primary btn-sm" style="font-size: 11px; padding: 4px 8px;">Bulk Edit</button>
              ${canDelete ? `
                <button id="btn-spare-bulk-delete" class="btn btn-danger btn-sm" style="font-size: 11px; padding: 4px 8px;">Safe Delete</button>
              ` : ''}
            </div>
          </div>
        ` : ''}
      </div>

      <!-- Spare Parts Data Table Container (Screen Fit 100% Flex Viewport) -->
      <div class="spare-parts-table-container" id="spare-parts-table-scroll-viewport">
        <table class="excel-grid-table spare-parts-table" style="margin: 0; width: 100%; min-width: 980px; table-layout: auto;">
          <thead>
            <tr style="position: sticky; top: 0; z-index: 20;">
              <th style="width: 40px; text-align: center; position: sticky; top: 0; z-index: 20; background-color: #0b1329;">
                <input type="checkbox" id="chk-spare-select-all" ${filtered.length > 0 && selectedItemIds.size === filtered.length ? 'checked' : ''} />
              </th>
              <th style="width: 55px; text-align: center; position: sticky; top: 0; z-index: 20; background-color: #0b1329;">SL</th>
              <th style="min-width: 180px; position: sticky; top: 0; z-index: 20; background-color: #0b1329;">Item Name &amp; Code</th>
              <th style="min-width: 220px; position: sticky; top: 0; z-index: 20; background-color: #0b1329;">Area of Use / Description</th>
              <th style="min-width: 160px; position: sticky; top: 0; z-index: 20; background-color: #0b1329;">Brand / Model / Origin</th>
              <th style="text-align: center; width: 130px; position: sticky; top: 0; z-index: 20; background-color: #0b1329;">Machine Usage</th>
              <th style="text-align: center; width: 90px; position: sticky; top: 0; z-index: 20; background-color: #0b1329;">Status</th>
              <th style="text-align: center; width: 140px; position: sticky; top: 0; z-index: 20; background-color: #0b1329;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.length === 0 ? `
              <tr>
                <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 40px;">
                  <div style="font-size: 32px; margin-bottom: 8px;">📦</div>
                  <div style="font-weight: 700; color: var(--text-secondary);">No spare parts found matching your query.</div>
                  <div style="font-size: 11.5px; margin-top: 4px; opacity: 0.7;">Try clearing filters or click 'Add Spare Part' to create a new master item.</div>
                </td>
              </tr>
            ` : filtered.map((it, idx) => {
              const isChecked = selectedItemIds.has(it.id);
              const stats = historyService.getSparePartUsageStats(it.id);
              const slCode = String(idx + 1).padStart(3, '0');

              return `
                <tr style="background: ${it.status === 'INACTIVE' ? 'rgba(255,255,255,0.02)' : 'transparent'};">
                  <td style="text-align: center;">
                    <input type="checkbox" class="chk-spare-row" data-id="${it.id}" ${isChecked ? 'checked' : ''} />
                  </td>
                  
                  <!-- SL Column (001, 002) -->
                  <td style="text-align: center; color: var(--text-muted); font-family: var(--font-mono); font-weight: 700; font-size: 12px;">
                    ${slCode}
                  </td>

                  <!-- Item Name & Code -->
                  <td>
                    <div style="font-weight: 800; color: ${it.status === 'ACTIVE' ? '#fff' : 'var(--text-muted)'}; font-size: 13.5px;">
                      ${it.name}
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px; margin-top: 3px;">
                      <span class="badge" style="background: rgba(2, 132, 199, 0.2); color: #38bdf8; font-family: var(--font-mono); font-size: 10.5px; border: 1px solid rgba(56, 189, 248, 0.3);">
                        ${it.code || `SP-${slCode}`}
                      </span>
                      ${it.unit ? `<span style="font-size: 10.5px; color: var(--text-muted);">(${it.unit})</span>` : ''}
                    </div>
                  </td>

                  <!-- Area of Use / Description -->
                  <td>
                    <div style="font-size: 12.5px; color: var(--text-primary); font-weight: 600;">
                      ${it.areaOfUse || it.description || '—'}
                    </div>
                    ${it.category ? `
                      <span class="badge" style="background: rgba(52, 211, 153, 0.12); color: #34d399; font-size: 10px; margin-top: 3px; border: 1px solid rgba(52, 211, 153, 0.25);">
                        ${it.category}
                      </span>
                    ` : ''}
                  </td>

                  <!-- Brand / Model / Origin -->
                  <td>
                    <span class="badge" style="background: rgba(56, 189, 248, 0.12); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.25); font-size: 11px;">
                      ${it.brandModelOrigin || 'Universal'}
                    </span>
                    ${it.defaultPrice ? `
                      <div style="font-size: 11px; color: #fbbf24; font-family: var(--font-mono); margin-top: 3px;">
                        BDT ${it.defaultPrice.toLocaleString()}
                      </div>
                    ` : ''}
                  </td>

                  <!-- Machine Usage Count (Clickable link to Usage Inspector) -->
                  <td style="text-align: center;">
                    ${stats.usageCount > 0 ? `
                      <button class="btn-spare-view-history" data-id="${it.id}" style="background: rgba(2, 132, 199, 0.18); border: 1px solid rgba(56, 189, 248, 0.4); color: #38bdf8; padding: 3px 8px; border-radius: var(--radius-sm); font-size: 11px; font-weight: 700; cursor: pointer;" title="Click to view all ${stats.distinctMachinesCount} machines using this part">
                        🧵 Used ${stats.usageCount}× <span style="font-size: 10px; opacity: 0.8;">(${stats.totalQuantity} PCS)</span>
                      </button>
                    ` : `
                      <span class="badge" style="background: rgba(255,255,255,0.05); color: var(--text-muted); font-size: 10.5px;">
                        0 Used
                      </span>
                    `}
                  </td>

                  <!-- Status -->
                  <td style="text-align: center;">
                    <span class="badge ${it.status === 'ACTIVE' ? 'badge-active' : 'badge-idle'}" style="font-size: 10px; font-weight: 700;">
                      ${it.status}
                    </span>
                  </td>

                  <!-- Actions -->
                  <td style="text-align: center;">
                    <div style="display: flex; gap: 4px; justify-content: center; align-items: center;">
                      <button class="btn btn-secondary btn-sm btn-spare-view-history" data-id="${it.id}" title="View Machine Usage History" style="padding: 4px 7px; font-size: 11.5px;">
                        📊
                      </button>
                      ${canEdit ? `
                        <button class="btn btn-secondary btn-sm btn-spare-edit" data-id="${it.id}" title="Edit Item Details" style="padding: 4px 7px; font-size: 11.5px;">
                          ✏️
                        </button>
                        <button class="btn btn-secondary btn-sm btn-spare-toggle" data-id="${it.id}" title="Toggle Active / Inactive" style="padding: 4px 7px; font-size: 11.5px;">
                          ${it.status === 'ACTIVE' ? '⏸️' : '▶️'}
                        </button>
                      ` : ''}
                      ${canDelete ? `
                        <button class="btn btn-danger btn-sm btn-spare-delete" data-id="${it.id}" title="Delete or Deactivate Record" style="padding: 4px 7px; font-size: 11.5px;">
                          🗑️
                        </button>
                      ` : ''}
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <!-- Compact Footer Status Strip (Screen Fit Indicator) -->
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 14px; background: rgba(15, 23, 42, 0.7); border: 1px solid var(--border-color); border-radius: var(--radius-sm); font-size: 11.5px; color: var(--text-muted); flex-shrink: 0;">
        <div>
          Showing <strong style="color: #fff;">${filtered.length}</strong> of <strong style="color: #38bdf8;">${master.length}</strong> master items
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: #34d399; box-shadow: 0 0 6px rgba(52, 211, 153, 0.6);"></span>
          <span>Screen Fit 100% Active</span>
        </div>
      </div>

      <!-- Active Modal Rendering Layer -->
      ${renderSpareModalLayer()}
    </div>
  `;
}

function renderSpareModalLayer() {
  if (!activeModalState) return '';

  const { type, item, usageStats } = activeModalState;

  // 1. ADD / EDIT SPARE PART MODAL
  if (type === 'ADD' || type === 'EDIT') {
    const isEdit = type === 'EDIT';
    return `
      <div id="spare-mgmt-modal-overlay" class="modal-overlay" style="position: fixed; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(4px); z-index: 10000; display: flex; align-items: center; justify-content: center; padding: 20px; overflow-y: auto;">
        <div class="modal-card" style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-xl); width: 100%; max-width: 580px; max-height: 90vh; display: flex; flex-direction: column; min-height: 0; box-shadow: 0 20px 60px rgba(0,0,0,0.6); overflow: hidden;">
          
          <div style="padding: 16px 20px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.02);">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 18px;">${isEdit ? '✏️' : '➕'}</span>
              <h3 style="font-size: 16px; font-weight: 800; color: #fff; margin: 0;">
                ${isEdit ? `Edit Spare Part: ${item.name}` : 'Add New Master Spare Part'}
              </h3>
            </div>
            <button id="btn-spare-modal-close" class="btn btn-ghost" style="font-size: 16px;">✕</button>
          </div>

          <form id="form-spare-part-mgmt" style="padding: 20px; display: flex; flex-direction: column; gap: 14px;">
            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 12px;">
              <div class="form-group">
                <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Item Name *</label>
                <input type="text" id="inp-sp-name" class="form-control" value="${item.name || ''}" placeholder="e.g. Motor Belt, Needle Plate" required />
              </div>
              <div class="form-group">
                <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Part Number / Code</label>
                <input type="text" id="inp-sp-code" class="form-control" value="${item.code || ''}" placeholder="e.g. SP-001 (Auto if blank)" />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Area of Use / Description</label>
              <input type="text" id="inp-sp-area" class="form-control" value="${item.areaOfUse || item.description || ''}" placeholder="e.g. Plain Machine / Overlock / Motor assembly" />
            </div>

            <div class="form-group">
              <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Brand / Model / Origin</label>
              <input type="text" id="inp-sp-bmo" class="form-control" value="${item.brandModelOrigin || ''}" placeholder="e.g. JUKI / DDL-8700-7 / Japan" />
            </div>

            <div style="display: grid; grid-template-columns: 1.2fr 1fr 1fr; gap: 10px;">
              <div class="form-group">
                <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Category</label>
                <select id="inp-sp-category" class="filter-select">
                  <option value="Mechanical" ${item.category === 'Mechanical' ? 'selected' : ''}>Mechanical</option>
                  <option value="Electrical" ${item.category === 'Electrical' ? 'selected' : ''}>Electrical</option>
                  <option value="Pneumatic" ${item.category === 'Pneumatic' ? 'selected' : ''}>Pneumatic</option>
                  <option value="Optical" ${item.category === 'Optical' ? 'selected' : ''}>Optical</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Unit (UOM)</label>
                <input type="text" id="inp-sp-unit" class="form-control" value="${item.unit || 'PCS'}" placeholder="PCS, SET" />
              </div>
              <div class="form-group">
                <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Default Price (BDT)</label>
                <input type="number" id="inp-sp-price" class="form-control" value="${item.defaultPrice || 0}" placeholder="0.00" />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Status</label>
              <select id="inp-sp-status" class="filter-select">
                <option value="ACTIVE" ${item.status !== 'INACTIVE' ? 'selected' : ''}>🟢 ACTIVE (Available in Autocomplete &amp; Maintenance)</option>
                <option value="INACTIVE" ${item.status === 'INACTIVE' ? 'selected' : ''}>⏸️ INACTIVE (Hidden from New Entries, Preserves Old History)</option>
              </select>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 10px;">
              <button type="button" id="btn-spare-modal-cancel" class="btn btn-secondary">Cancel</button>
              <button type="submit" class="btn btn-primary" style="font-weight: 700;">
                💾 ${isEdit ? 'Update Spare Part' : 'Save New Part'}
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  // 2. USAGE HISTORY & CONNECTED MACHINES MODAL
  if (type === 'USAGE_HISTORY') {
    const logs = usageStats?.activityLogs || [];
    return `
      <div id="spare-mgmt-modal-overlay" class="modal-overlay" style="position: fixed; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(4px); z-index: 10000; display: flex; align-items: center; justify-content: center; padding: 20px; overflow-y: auto;">
        <div class="modal-card" style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-xl); width: 100%; max-width: 820px; max-height: 85vh; display: flex; flex-direction: column; min-height: 0; box-shadow: 0 20px 60px rgba(0,0,0,0.6); overflow: hidden;">
          
          <!-- Header -->
          <div style="padding: 16px 20px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.02);">
            <div>
              <div style="font-size: 16px; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 8px;">
                <span>⚙️ ${item.name}</span>
                <span class="badge" style="background: rgba(2, 132, 199, 0.2); color: #38bdf8; font-family: monospace;">${item.code}</span>
              </div>
              <div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">
                ${item.areaOfUse || item.description || 'General Sewing'} &bull; ${item.brandModelOrigin || 'Universal'}
              </div>
            </div>
            <button id="btn-spare-modal-close" class="btn btn-ghost" style="font-size: 16px;">✕</button>
          </div>

          <!-- Summary Badges -->
          <div style="padding: 12px 20px; background: rgba(2, 132, 199, 0.08); border-bottom: 1px solid var(--border-color); display: flex; gap: 14px; flex-wrap: wrap;">
            <div style="font-size: 12px; color: #38bdf8;">
              <strong>Total Times Replaced:</strong> ${usageStats.usageCount} events
            </div>
            <div style="font-size: 12px; color: #34d399;">
              <strong>Total Quantity Installed:</strong> ${usageStats.totalQuantity} PCS
            </div>
            <div style="font-size: 12px; color: #fbbf24;">
              <strong>Unique Machines:</strong> ${usageStats.distinctMachinesCount} machines (${usageStats.distinctMachines.join(', ') || 'None'})
            </div>
          </div>

          <!-- Usage Activity Timeline Table -->
          <div style="flex: 1; overflow-y: auto; padding: 16px 20px;">
            ${logs.length === 0 ? `
              <div style="text-align: center; padding: 40px; color: var(--text-muted);">
                <div style="font-size: 32px; margin-bottom: 8px;">📦</div>
                <div style="font-weight: 700; color: var(--text-secondary);">No machine replacement records for this spare part yet.</div>
                <div style="font-size: 11.5px; margin-top: 4px;">When a technician logs a repair or spare part replacement on a machine, it will appear here automatically.</div>
              </div>
            ` : `
              <table class="excel-grid-table" style="width: 100%; margin: 0;">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Machine Serial &amp; Model</th>
                    <th>Floor / Location</th>
                    <th style="text-align: center;">Qty</th>
                    <th>Problem / Reason</th>
                    <th>Technician</th>
                  </tr>
                </thead>
                <tbody>
                  ${logs.map(log => `
                    <tr>
                      <td style="font-family: monospace; font-size: 11.5px; color: #fff;">${log.date}</td>
                      <td>
                        <div style="font-weight: 800; color: #38bdf8; font-size: 13px; cursor: pointer;" class="link-jump-machine-history" data-serial="${log.machineSerial}" title="Click to view full machine history">
                          ${log.machineSerial} ↗
                        </div>
                        <div style="font-size: 11px; color: var(--text-secondary);">${log.machineName} (${log.brand} ${log.model})</div>
                      </td>
                      <td style="font-size: 12px; color: var(--text-primary);">${log.floor}</td>
                      <td style="text-align: center; font-weight: 800; color: #34d399; font-size: 12.5px;">${log.quantity}</td>
                      <td style="font-size: 12px; color: var(--text-secondary); max-width: 200px;">
                        ${log.problemReason}
                        ${log.partSerialNo && log.partSerialNo !== '—' ? `<div style="font-size: 10.5px; color: #fbbf24; font-family: monospace;">S/N: ${log.partSerialNo}</div>` : ''}
                      </td>
                      <td style="font-size: 11.5px; color: #fff;">${log.technician}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            `}
          </div>

          <!-- Footer -->
          <div style="padding: 12px 20px; border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end; background: rgba(255,255,255,0.02);">
            <button type="button" id="btn-spare-modal-cancel" class="btn btn-secondary">Close</button>
          </div>
        </div>
      </div>
    `;
  }

  // 3. PRESERVED HISTORY NOTICE MODAL (Delete Rule Interception)
  if (type === 'PRESERVED_NOTICE') {
    return `
      <div id="spare-mgmt-modal-overlay" class="modal-overlay" style="position: fixed; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(4px); z-index: 10000; display: flex; align-items: center; justify-content: center; padding: 20px; overflow-y: auto;">
        <div class="modal-card" style="background: var(--bg-surface); border: 1.5px solid #fbbf24; border-radius: var(--radius-xl); width: 100%; max-width: 520px; max-height: 90vh; display: flex; flex-direction: column; min-height: 0; box-shadow: 0 20px 60px rgba(0,0,0,0.6); overflow: hidden;">
          
          <div style="padding: 20px; text-align: center;">
            <div style="font-size: 40px; margin-bottom: 8px;">🛡️</div>
            <h3 style="font-size: 17px; font-weight: 800; color: #fbbf24; margin: 0 0 8px 0;">
              Preserved Maintenance History Integrity
            </h3>
            <p style="font-size: 13px; color: var(--text-secondary); line-height: 1.6; margin-bottom: 16px;">
              Spare part <strong>${item.name} (${item.code})</strong> has already been used in <strong>${usageStats.usageCount} maintenance events</strong> across machine(s): <strong>${usageStats.distinctMachines.join(', ')}</strong>.
            </p>
            <div style="background: rgba(251, 191, 36, 0.1); border: 1px solid rgba(251, 191, 36, 0.3); border-radius: var(--radius-md); padding: 12px; text-align: left; font-size: 12px; color: #fde68a; line-height: 1.5; margin-bottom: 20px;">
              <strong>Important Rule:</strong> To keep old machine lifetime history and audits connected properly, this record has been marked as <strong>INACTIVE</strong> instead of permanent deletion. It is now hidden from new entries while preserving old machine records intact.
            </div>

            <div style="display: flex; justify-content: center; gap: 10px;">
              <button id="btn-spare-modal-close" class="btn btn-primary" style="font-weight: 700; padding: 8px 24px;">
                Understood
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // 4. BULK EDIT MODAL
  if (type === 'BULK_EDIT') {
    return `
      <div id="spare-mgmt-modal-overlay" class="modal-overlay" style="position: fixed; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(4px); z-index: 10000; display: flex; align-items: center; justify-content: center; padding: 20px; overflow-y: auto;">
        <div class="modal-card" style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-xl); width: 100%; max-width: 500px; max-height: 90vh; display: flex; flex-direction: column; min-height: 0; box-shadow: 0 20px 60px rgba(0,0,0,0.6); overflow: hidden;">
          
          <div style="padding: 16px 20px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
            <h3 style="font-size: 16px; font-weight: 800; color: #fff; margin: 0;">
              Batch Edit ${selectedItemIds.size} Spare Parts
            </h3>
            <button id="btn-spare-modal-close" class="btn btn-ghost">✕</button>
          </div>

          <form id="form-spare-bulk-edit" style="padding: 20px; display: flex; flex-direction: column; gap: 14px;">
            <div class="form-group">
              <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Set Category (Optional)</label>
              <select id="inp-bulk-category" class="filter-select">
                <option value="">-- Keep Current Categories --</option>
                <option value="Mechanical">Mechanical</option>
                <option value="Electrical">Electrical</option>
                <option value="Pneumatic">Pneumatic</option>
                <option value="Optical">Optical</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Set Brand / Model / Origin (Optional)</label>
              <input type="text" id="inp-bulk-bmo" class="form-control" placeholder="Leave empty to keep existing" />
            </div>

            <div class="form-group">
              <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Set Status</label>
              <select id="inp-bulk-status" class="filter-select">
                <option value="">-- Keep Current Status --</option>
                <option value="ACTIVE">🟢 Set to ACTIVE</option>
                <option value="INACTIVE">⏸️ Set to INACTIVE</option>
              </select>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 10px;">
              <button type="button" id="btn-spare-modal-cancel" class="btn btn-secondary">Cancel</button>
              <button type="submit" class="btn btn-primary" style="font-weight: 700;">Apply to ${selectedItemIds.size} Parts</button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  return '';
}

export function initSparePartsManagementEvents() {
  const refresh = () => {
    const activeEl = document.activeElement;
    const isSearchFocused = activeEl && activeEl.id === 'inp-spare-search';
    const cursorStart = isSearchFocused ? activeEl.selectionStart : null;
    const cursorEnd = isSearchFocused ? activeEl.selectionEnd : null;

    const entContainer = document.getElementById('ent-tab-content-area');
    const mainContainer = document.getElementById('main-view-container');
    if (entContainer) {
      entContainer.innerHTML = renderSparePartsManagementView();
      initSparePartsManagementEvents();
    } else if (mainContainer) {
      mainContainer.innerHTML = renderSparePartsManagementView();
      initSparePartsManagementEvents();
    }

    if (isSearchFocused) {
      const newSearch = document.getElementById('inp-spare-search');
      if (newSearch) {
        newSearch.focus();
        if (cursorStart !== null && cursorEnd !== null) {
          try { newSearch.setSelectionRange(cursorStart, cursorEnd); } catch(_) {}
        }
      }
    }
  };

  // Search Input
  const inpSearch = document.getElementById('inp-spare-search');
  if (inpSearch) {
    inpSearch.addEventListener('input', (e) => {
      searchFilter = e.target.value;
      refresh();
    });
  }

  // Category Filter
  const selCat = document.getElementById('sel-spare-category');
  if (selCat) {
    selCat.addEventListener('change', (e) => {
      categoryFilter = e.target.value;
      refresh();
    });
  }

  // Status Filter
  const selStatus = document.getElementById('sel-spare-status');
  if (selStatus) {
    selStatus.addEventListener('change', (e) => {
      statusFilter = e.target.value;
      refresh();
    });
  }

  // Usage Filter
  const selUsage = document.getElementById('sel-spare-usage');
  if (selUsage) {
    selUsage.addEventListener('change', (e) => {
      usageFilter = e.target.value;
      refresh();
    });
  }

  // Excel Import Trigger
  const btnImport = document.getElementById('btn-spare-excel-import');
  if (btnImport) {
    btnImport.addEventListener('click', () => {
      openSparePartsImportModal();
    });
  }

  // Excel Export Trigger
  const btnExport = document.getElementById('btn-spare-excel-export');
  if (btnExport) {
    btnExport.addEventListener('click', () => {
      notificationService.withLoading(btnExport, async () => {
        await historyService.exportSparePartsMasterExcel();
      }, 'Exporting Catalog...', 'Spare parts catalog exported to Excel successfully!');
    });
  }

  // Consumption Report Trigger
  const btnCons = document.getElementById('btn-spare-consumption-report');
  if (btnCons) {
    btnCons.addEventListener('click', () => {
      state.set('reportActiveTab', 'spareparts');
      state.set('currentView', 'reports');
    });
  }

  // Add New Trigger
  const btnAdd = document.getElementById('btn-spare-add-new');
  if (btnAdd) {
    btnAdd.addEventListener('click', () => {
      activeModalState = {
        type: 'ADD',
        item: { status: 'ACTIVE', category: 'Mechanical', unit: 'PCS' }
      };
      refresh();
    });
  }

  // Select All Checkbox
  const chkAll = document.getElementById('chk-spare-select-all');
  if (chkAll) {
    chkAll.addEventListener('change', (e) => {
      if (e.target.checked) {
        document.querySelectorAll('.chk-spare-row').forEach(c => {
          const id = c.getAttribute('data-id');
          if (id) selectedItemIds.add(id);
        });
      } else {
        selectedItemIds.clear();
      }
      refresh();
    });
  }

  // Row selection checkboxes
  document.querySelectorAll('.chk-spare-row').forEach(c => {
    c.addEventListener('change', (e) => {
      const id = e.target.getAttribute('data-id');
      if (e.target.checked) selectedItemIds.add(id);
      else selectedItemIds.delete(id);
      refresh();
    });
  });

  // 1-Click Toggle Status
  document.querySelectorAll('.btn-spare-toggle-status').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const master = storage.getTable(TABLE_NAMES.SPARE_PARTS_MASTER) || [];
      const it = master.find(m => m.id === id);
      if (it) {
        it.status = it.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
        storage.saveTable(TABLE_NAMES.SPARE_PARTS_MASTER, master);
        notificationService.success(`Status updated for ${it.name}`);
        refresh();
      }
    });
  });

  // Edit Item Trigger
  document.querySelectorAll('.btn-spare-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const master = storage.getTable(TABLE_NAMES.SPARE_PARTS_MASTER) || [];
      const item = master.find(m => m.id === id);
      if (item) {
        activeModalState = {
          type: 'EDIT',
          item: { ...item }
        };
        refresh();
      }
    });
  });

  // View Usage History Trigger
  document.querySelectorAll('.btn-spare-view-history').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const master = storage.getTable(TABLE_NAMES.SPARE_PARTS_MASTER) || [];
      const item = master.find(m => m.id === id);
      if (item) {
        const usageStats = historyService.getSparePartUsageStats(item.id);
        activeModalState = {
          type: 'USAGE_HISTORY',
          item: item,
          usageStats: usageStats
        };
        refresh();
      }
    });
  });

  // Delete Item Trigger (Enforces History Preservation Rule)
  document.querySelectorAll('.btn-spare-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const master = storage.getTable(TABLE_NAMES.SPARE_PARTS_MASTER) || [];
      const item = master.find(m => m.id === id);
      if (!item) return;

      const usageStats = historyService.getSparePartUsageStats(item.id);

      if (usageStats.usageCount > 0) {
        // Intercept and preserve machine history integrity
        historyService.deleteSparePartMaster(id, false);
        activeModalState = {
          type: 'PRESERVED_NOTICE',
          item: item,
          usageStats: usageStats
        };
        refresh();
      } else {
        const confirmed = await notificationService.confirm({
          title: 'Delete Master Spare Part',
          message: `Are you sure you want to permanently delete master spare part <strong>${item.name}</strong>? This item has 0 machine dependencies.`,
          icon: '🗑️',
          confirmText: 'Delete Part',
          isDestructive: true
        });

        if (confirmed) {
          historyService.deleteSparePartMaster(id, false);
          selectedItemIds.delete(id);
          notificationService.success(`Deleted spare part '${item.name}'`);
          refresh();
        }
      }
    });
  });

  // Jump to Machine History from Timeline link
  document.querySelectorAll('.link-jump-machine-history').forEach(el => {
    el.addEventListener('click', () => {
      const serial = el.getAttribute('data-serial');
      activeModalState = null;
      state.set('historySearchQuery', serial);
      state.set('currentView', 'machine-history');
    });
  });

  // Bulk Activate / Deactivate / Delete / Edit
  const btnBulkAct = document.getElementById('btn-spare-bulk-activate');
  if (btnBulkAct) {
    btnBulkAct.addEventListener('click', () => {
      historyService.bulkToggleSparePartsStatus(Array.from(selectedItemIds), 'ACTIVE');
      selectedItemIds.clear();
      refresh();
    });
  }

  const btnBulkDeact = document.getElementById('btn-spare-bulk-deactivate');
  if (btnBulkDeact) {
    btnBulkDeact.addEventListener('click', () => {
      historyService.bulkToggleSparePartsStatus(Array.from(selectedItemIds), 'INACTIVE');
      selectedItemIds.clear();
      refresh();
    });
  }

  const btnBulkEdit = document.getElementById('btn-spare-bulk-edit');
  if (btnBulkEdit) {
    btnBulkEdit.addEventListener('click', () => {
      activeModalState = {
        type: 'BULK_EDIT'
      };
      refresh();
    });
  }

  const btnBulkDel = document.getElementById('btn-spare-bulk-delete');
  if (btnBulkDel) {
    btnBulkDel.addEventListener('click', () => {
      if (confirm(`Process ${selectedItemIds.size} records? Items with machine maintenance history will be safely deactivated; unused items will be deleted.`)) {
        historyService.bulkDeleteSpareParts(Array.from(selectedItemIds));
        selectedItemIds.clear();
        refresh();
      }
    });
  }

  // Modal Cancel / Close triggers
  const btnClose = document.getElementById('btn-spare-modal-close');
  const btnCancel = document.getElementById('btn-spare-modal-cancel');
  const overlay = document.getElementById('spare-mgmt-modal-overlay');

  const closeModal = () => {
    activeModalState = null;
    refresh();
  };

  if (btnClose) btnClose.addEventListener('click', closeModal);
  if (btnCancel) btnCancel.addEventListener('click', closeModal);
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
  }

  // Form Submit Handler (Add / Edit) with Smart Auto-Correction
  const formAddEdit = document.getElementById('form-spare-part-mgmt');
  if (formAddEdit && activeModalState) {
    // Attach smart auto-correction on blur
    smartStorageService.bindInputAutoCorrection('#inp-sp-name', 'SPARE_PART', 'Spare Part Name');
    smartStorageService.bindInputAutoCorrection('#inp-sp-bmo', 'MODEL', 'Brand / Model');

    formAddEdit.addEventListener('submit', (e) => {
      e.preventDefault();
      const isEdit = activeModalState.type === 'EDIT';
      const existingId = activeModalState.item?.id;

      const name = document.getElementById('inp-sp-name')?.value?.trim();
      const code = document.getElementById('inp-sp-code')?.value?.trim();
      const area = document.getElementById('inp-sp-area')?.value?.trim();
      const bmo = document.getElementById('inp-sp-bmo')?.value?.trim();
      const category = document.getElementById('inp-sp-category')?.value || 'Mechanical';
      const unit = document.getElementById('inp-sp-unit')?.value?.trim() || 'PCS';
      const price = Number(document.getElementById('inp-sp-price')?.value) || 0;
      const status = document.getElementById('inp-sp-status')?.value || 'ACTIVE';

      if (isEdit) {
        historyService.updateSparePartInMaster(existingId, {
          name, code, areaOfUse: area, brandModelOrigin: bmo, category, unit, defaultPrice: price, status
        });
      } else {
        historyService.addSparePartToMaster({
          name, code, areaOfUse: area, brandModelOrigin: bmo, category, unit, defaultPrice: price, status
        });
      }

      activeModalState = null;
      refresh();
    });
  }

  // Form Bulk Edit Submit
  const formBulk = document.getElementById('form-spare-bulk-edit');
  if (formBulk) {
    formBulk.addEventListener('submit', (e) => {
      e.preventDefault();
      const cat = document.getElementById('inp-bulk-category')?.value;
      const bmo = document.getElementById('inp-bulk-bmo')?.value;
      const stat = document.getElementById('inp-bulk-status')?.value;

      const patch = {};
      if (cat) patch.category = cat;
      if (bmo) patch.brandModelOrigin = bmo;
      if (stat) patch.status = stat;

      historyService.bulkEditSpareParts(Array.from(selectedItemIds), patch);
      selectedItemIds.clear();
      activeModalState = null;
      refresh();
    });
  }
}
