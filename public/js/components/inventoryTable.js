/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Redesigned Machine Inventory Component - Simple, Clean, User-Friendly & Fast
 * Tailored specifically for maintenance staff & plant engineers
 */

import { storage } from '../db/storage.js';
import { TABLE_NAMES } from '../db/schema.js';
import { INITIAL_DATA } from '../db/initialData.js';
import { machineService } from '../services/machineService.js';
import { masterDataService } from '../services/masterDataService.js';
import { customFieldService } from '../services/customFieldService.js';
import { authService } from '../services/authService.js';
import { excelService, formatDisplayLine } from '../services/excelService.js';
import { pdfService } from '../services/pdfService.js';
import { notificationService } from '../services/notificationService.js';
import { qrCodeService } from '../services/qrCodeService.js';
import { renderQrScannerModal, initQrScannerModalEvents } from './qrScannerModal.js?v=4.7.4';
import { state } from '../state.js';

// Local UI state for collapsible advanced filters
let showAdvancedFilters = false;

export function renderInventoryTable() {
  const filters = state.get('filters') || {};
  const selectedIds = state.get('selectedMachineIds') || new Set();
  const visibleCols = state.get('visibleColumns') || new Set();
  const customFields = customFieldService.getTableFields();
  const user = authService.getCurrentUser();

  // 1. Fetch filtered machine dataset
  const queryResult = machineService.getMachines(filters);
  const machines = queryResult.items;

  // 2. Summary Metric Indicators (Total Machines, Running, Usable Idle, Repairable Idle)
  const allMachines = storage.getTable(TABLE_NAMES.MACHINES) || [];
  const countTotalMachines = allMachines.length;

  let totalRunning = 0;
  let totalUsableIdle = 0;
  let totalRepairableIdle = 0;

  allMachines.forEach(m => {
    const r = parseInt(m.running ?? m.qty_running ?? (m.status === 'ACTIVE' ? (m.quantity ?? 1) : 0), 10) || 0;
    const u = parseInt(m.usable_idle ?? m.usableIdle ?? (m.status === 'IDLE' ? (m.quantity ?? 1) : 0), 10) || 0;
    const rp = parseInt(m.repairable_idle ?? m.repairableIdle ?? ((m.status === 'MAINTENANCE' || m.status === 'BREAKDOWN') ? (m.quantity ?? 1) : 0), 10) || 0;
    totalRunning += r;
    totalUsableIdle += u;
    totalRepairableIdle += rp;
  });

  // 3. Hierarchical Cascading Dropdown Options (Group -> Unit -> Floor -> Line)
  const groups = masterDataService.getGroups();
  const units = masterDataService.getUnits(filters.groupId);
  const floors = masterDataService.getFloors(filters.unitId, filters.groupId);
  const lines = masterDataService.getLines(filters.floorId, filters.unitId, filters.groupId);
  const machineNames = masterDataService.getMachineNames();
  const brands = masterDataService.getBrandsForMachineName(filters.machineNameId);
  const models = masterDataService.getModels(filters.brandId, filters.machineNameId);

  // Helper map lookups for high performance rendering with INITIAL_DATA and STORAGE_MASTER fallbacks
  const grpMap = new Map();
  (INITIAL_DATA.groups || []).forEach(x => x && x.id && grpMap.set(x.id, x.name));
  (storage.getTable(TABLE_NAMES.GROUPS) || []).forEach(x => x && x.id && grpMap.set(x.id, x.name));

  const mnMap = new Map();
  (INITIAL_DATA.machine_names || []).forEach(x => x && x.id && mnMap.set(x.id, x.name));
  (storage.getTable(TABLE_NAMES.MACHINE_NAMES) || []).forEach(x => x && x.id && mnMap.set(x.id, x.name));

  const brdMap = new Map();
  (INITIAL_DATA.brands || []).forEach(x => x && x.id && brdMap.set(x.id, x.name));
  (storage.getTable(TABLE_NAMES.BRANDS) || []).forEach(x => x && x.id && brdMap.set(x.id, x.name));

  const mdlMap = new Map();
  (INITIAL_DATA.models || []).forEach(x => x && x.id && mdlMap.set(x.id, x.name));
  (storage.getTable(TABLE_NAMES.MODELS) || []).forEach(x => x && x.id && mdlMap.set(x.id, x.name));
  const storageMaster = storage.getTable(TABLE_NAMES.STORAGE_MASTER) || [];
  storageMaster.forEach(sm => {
    if (sm && sm.category === 'MACHINE' && sm.id && sm.model) {
      if (!mdlMap.has(sm.id)) mdlMap.set(sm.id, sm.model);
    }
  });

  const untMap = new Map();
  (INITIAL_DATA.units || []).forEach(x => x && x.id && untMap.set(x.id, x.name));
  (storage.getTable(TABLE_NAMES.UNITS) || []).forEach(x => x && x.id && untMap.set(x.id, x.name));

  const flrMap = new Map();
  (INITIAL_DATA.floors || []).forEach(x => x && x.id && flrMap.set(x.id, x.name));
  (storage.getTable(TABLE_NAMES.FLOORS) || []).forEach(x => x && x.id && flrMap.set(x.id, x.name));

  const linMap = new Map();
  (INITIAL_DATA.lines || []).forEach(x => x && x.id && linMap.set(x.id, x.name));
  (storage.getTable(TABLE_NAMES.LINES) || []).forEach(x => x && x.id && linMap.set(x.id, x.name));

  // Active Filter Tags List
  const activeTags = [];
  if (filters.search) activeTags.push({ key: 'search', label: `Search: "${filters.search}"` });
  if (filters.groupId) {
    const grp = masterDataService.getGroupById(filters.groupId);
    activeTags.push({ key: 'groupId', label: `Group: ${grp?.name || filters.groupId}` });
  }
  if (filters.unitId) {
    const unt = masterDataService.getUnitById(filters.unitId);
    activeTags.push({ key: 'unitId', label: `Unit: ${unt?.name || filters.unitId}` });
  }
  if (filters.floorId) {
    const flr = masterDataService.getFloorById(filters.floorId);
    activeTags.push({ key: 'floorId', label: `Floor: ${flr?.name || filters.floorId}` });
  }
  if (filters.lineId) {
    const lin = masterDataService.getLineById(filters.lineId);
    activeTags.push({ key: 'lineId', label: `Line: ${lin?.name || filters.lineId}` });
  }
  if (filters.machineNameId) {
    const mn = masterDataService.getMachineNameById(filters.machineNameId);
    activeTags.push({ key: 'machineNameId', label: `Machine: ${mn?.name || filters.machineNameId}` });
  }
  if (filters.brandId) {
    const brd = masterDataService.getBrandById(filters.brandId);
    activeTags.push({ key: 'brandId', label: `Brand: ${brd?.name || filters.brandId}` });
  }
  if (filters.modelId) {
    const mdl = masterDataService.getModelById(filters.modelId);
    activeTags.push({ key: 'modelId', label: `Model: ${mdl?.name || filters.modelId}` });
  }
  if (filters.status && filters.status !== 'ALL') {
    activeTags.push({ key: 'status', label: `Status: ${filters.status.replace(/_/g, ' ')}` });
  }

  const hasActiveFilters = activeTags.length > 0;

  // 4. Dynamic Frozen Columns Layout Calculation
  const frozenColKeys = state.get('frozenColumns') || ['machineName', 'model', 'serialNumber'];

  // Base Column Definitions
  const allColDefs = [
    {
      key: 'machineName',
      label: 'Machine Name',
      width: 180,
      renderTh: (thStyle, thClass) => `<th class="th-sortable ${thClass}" data-sort="machineName" style="width: 180px; min-width: 180px; max-width: 180px; cursor: pointer; ${thStyle}">Machine Name</th>`,
      renderTd: (m, meta, tdStyle, tdClass) => {
        const name = (mnMap.get(m.machineNameId) || m.machineName || m.name || brdMap.get(m.brandId) || (m.brand ? m.brand + ' Machine' : '') || '—').trim();
        return `<td class="${tdClass}" style="font-weight: 600; color: #fff; overflow: hidden; text-overflow: ellipsis; ${tdStyle}">${name}</td>`;
      }
    },
    {
      key: 'model',
      label: 'Model',
      width: 150,
      renderTh: (thStyle, thClass) => `<th class="th-sortable ${thClass}" data-sort="model" style="width: 150px; min-width: 150px; max-width: 150px; cursor: pointer; ${thStyle}">Model</th>`,
      renderTd: (m, meta, tdStyle, tdClass) => {
        const mdl = (mdlMap.get(m.modelId) || m.model || m.modelName || '—').trim();
        return `<td class="${tdClass}" style="overflow: hidden; text-overflow: ellipsis; font-family: var(--font-mono); font-weight: 600; ${tdStyle}">${mdl}</td>`;
      }
    },
    {
      key: 'serialNumber',
      label: 'Serial Number',
      width: 160,
      renderTh: (thStyle, thClass) => `<th class="th-sortable ${thClass}" data-sort="serialNumber" style="width: 160px; min-width: 160px; max-width: 160px; cursor: pointer; ${thStyle}">Serial Number</th>`,
      renderTd: (m, meta, tdStyle, tdClass) => `<td class="${tdClass}" style="${tdStyle}"><a href="javascript:void(0)" class="machine-serial-link btn-inspect-machine" data-id="${m.id}" title="Click to view full machine lifetime & specifications">${m.serialNumber || '—'}</a></td>`
    },
    {
      key: 'brand',
      label: 'Brand',
      width: 130,
      renderTh: (thStyle, thClass) => `<th class="th-sortable ${thClass}" data-sort="brand" style="width: 130px; min-width: 130px; max-width: 130px; cursor: pointer; ${thStyle}">Brand</th>`,
      renderTd: (m, meta, tdStyle, tdClass) => {
        const brd = (brdMap.get(m.brandId) || m.brand || '—').trim();
        return `<td class="${tdClass}" style="overflow: hidden; text-overflow: ellipsis; ${tdStyle}">${brd}</td>`;
      }
    },
    {
      key: 'group',
      label: 'Group',
      width: 150,
      renderTh: (thStyle, thClass) => `<th class="th-sortable ${thClass}" data-sort="group" style="width: 150px; min-width: 150px; max-width: 150px; cursor: pointer; ${thStyle}">Group</th>`,
      renderTd: (m, meta, tdStyle, tdClass) => `<td class="${tdClass}" style="overflow: hidden; text-overflow: ellipsis; ${tdStyle}">${grpMap.get(m.groupId) || m.group || '—'}</td>`
    },
    {
      key: 'unit',
      label: 'Unit / Factory',
      width: 190,
      renderTh: (thStyle, thClass) => `<th class="th-sortable ${thClass}" data-sort="unit" style="width: 190px; min-width: 190px; max-width: 190px; cursor: pointer; ${thStyle}">Unit / Factory</th>`,
      renderTd: (m, meta, tdStyle, tdClass) => `<td class="${tdClass}" style="overflow: hidden; text-overflow: ellipsis; ${tdStyle}">${untMap.get(m.unitId) || m.unit || '—'}</td>`
    },
    {
      key: 'floor',
      label: 'Floor',
      width: 130,
      renderTh: (thStyle, thClass) => `<th class="th-sortable ${thClass}" data-sort="floor" style="width: 130px; min-width: 130px; max-width: 130px; cursor: pointer; ${thStyle}">Floor</th>`,
      renderTd: (m, meta, tdStyle, tdClass) => `<td class="${tdClass}" style="overflow: hidden; text-overflow: ellipsis; ${tdStyle}">${flrMap.get(m.floorId) || m.floor || '—'}</td>`
    },
    {
      key: 'line',
      label: 'Line',
      width: 130,
      renderTh: (thStyle, thClass) => `<th class="th-sortable ${thClass}" data-sort="line" style="width: 130px; min-width: 130px; max-width: 130px; cursor: pointer; ${thStyle}">Line</th>`,
      renderTd: (m, meta, tdStyle, tdClass) => {
        const fullLine = linMap.get(m.lineId) || m.line || '—';
        const cleanLine = formatDisplayLine(fullLine, 'NORMAL');
        const isPrefixed = fullLine.includes('-') && cleanLine !== fullLine;
        return `<td class="${tdClass}" style="overflow: hidden; text-overflow: ellipsis; ${tdStyle}" title="Line: ${cleanLine} (Full Code: ${fullLine})"><span style="font-weight: 800; color: #38bdf8; font-size: 12px;">${cleanLine}</span>${isPrefixed ? `<span style="font-size: 10px; color: var(--text-muted); margin-left: 4px; font-weight: 500;">(${fullLine})</span>` : ''}</td>`;
      }
    },
    {
      key: 'running',
      label: 'Running',
      width: 100,
      renderTh: (thStyle, thClass) => `<th class="${thClass}" style="width: 100px; min-width: 100px; max-width: 100px; text-align: center; ${thStyle}">Running</th>`,
      renderTd: (m, meta, tdStyle, tdClass) => `<td class="${tdClass}" style="text-align: center; ${tdStyle}"><span class="qty-badge qty-running">${meta.rQty}</span></td>`
    },
    {
      key: 'usable_idle',
      label: 'Usable Idle',
      width: 110,
      renderTh: (thStyle, thClass) => `<th class="${thClass}" style="width: 110px; min-width: 110px; max-width: 110px; text-align: center; ${thStyle}">Usable Idle</th>`,
      renderTd: (m, meta, tdStyle, tdClass) => `<td class="${tdClass}" style="text-align: center; ${tdStyle}"><span class="qty-badge qty-usable">${meta.uQty}</span></td>`
    },
    {
      key: 'repairable_idle',
      label: 'Repairable Idle',
      width: 130,
      renderTh: (thStyle, thClass) => `<th class="${thClass}" style="width: 130px; min-width: 130px; max-width: 130px; text-align: center; ${thStyle}">Repairable Idle</th>`,
      renderTd: (m, meta, tdStyle, tdClass) => `<td class="${tdClass}" style="text-align: center; ${tdStyle}"><span class="qty-badge qty-repair">${meta.rpQty}</span></td>`
    },
    {
      key: 'total_quantity',
      label: 'Total',
      width: 100,
      renderTh: (thStyle, thClass) => `<th class="${thClass}" style="width: 100px; min-width: 100px; max-width: 100px; text-align: center; ${thStyle}">Total</th>`,
      renderTd: (m, meta, tdStyle, tdClass) => `<td class="${tdClass}" style="text-align: center; ${tdStyle}"><span class="qty-badge qty-total">${meta.totalQty}</span></td>`
    },
    {
      key: 'status',
      label: 'Status',
      width: 120,
      renderTh: (thStyle, thClass) => `<th class="th-sortable ${thClass}" data-sort="status" style="width: 120px; min-width: 120px; max-width: 120px; text-align: center; cursor: pointer; ${thStyle}">Status</th>`,
      renderTd: (m, meta, tdStyle, tdClass) => `<td class="${tdClass}" style="text-align: center; ${tdStyle}"><span class="badge ${meta.statusBadgeClass}">${(m.status || 'ACTIVE').replace('_', ' ')}</span></td>`
    },
    {
      key: 'purchase_date',
      label: 'Purchase Date',
      width: 120,
      renderTh: (thStyle, thClass) => `<th class="${thClass}" style="width: 120px; min-width: 120px; max-width: 120px; ${thStyle}">Purchase Date</th>`,
      renderTd: (m, meta, tdStyle, tdClass) => `<td class="${tdClass}" style="${tdStyle}">${m.purchase_date || m.purchaseDate || '—'}</td>`
    },
    {
      key: 'installation_date',
      label: 'Install Date',
      width: 120,
      renderTh: (thStyle, thClass) => `<th class="${thClass}" style="width: 120px; min-width: 120px; max-width: 120px; ${thStyle}">Install Date</th>`,
      renderTd: (m, meta, tdStyle, tdClass) => `<td class="${tdClass}" style="${tdStyle}">${m.installation_date || m.installationDate || '—'}</td>`
    },
    {
      key: 'supplier_name',
      label: 'Supplier',
      width: 140,
      renderTh: (thStyle, thClass) => `<th class="${thClass}" style="width: 140px; min-width: 140px; max-width: 140px; ${thStyle}">Supplier</th>`,
      renderTd: (m, meta, tdStyle, tdClass) => `<td class="${tdClass}" style="${tdStyle}">${m.supplier_name || m.supplier || '—'}</td>`
    },
    {
      key: 'country_of_origin',
      label: 'Origin',
      width: 120,
      renderTh: (thStyle, thClass) => `<th class="${thClass}" style="width: 120px; min-width: 120px; max-width: 120px; ${thStyle}">Origin</th>`,
      renderTd: (m, meta, tdStyle, tdClass) => `<td class="${tdClass}" style="${tdStyle}">${m.country_of_origin || m.origin || '—'}</td>`
    },
    {
      key: 'machine_capacity',
      label: 'Capacity',
      width: 130,
      renderTh: (thStyle, thClass) => `<th class="${thClass}" style="width: 130px; min-width: 130px; max-width: 130px; ${thStyle}">Capacity</th>`,
      renderTd: (m, meta, tdStyle, tdClass) => `<td class="${tdClass}" style="${tdStyle}">${m.machine_capacity || m.capacity || '—'}</td>`
    },
    {
      key: 'remarks',
      label: 'Remarks',
      width: 230,
      renderTh: (thStyle, thClass) => `<th class="${thClass}" style="width: 230px; min-width: 230px; max-width: 230px; ${thStyle}">Remarks</th>`,
      renderTd: (m, meta, tdStyle, tdClass) => `<td class="${tdClass}" style="font-size: 11.5px; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; ${tdStyle}" title="${m.remarks || ''}">${m.remarks || '—'}</td>`
    }
  ];

  // Dynamic Custom Fields
  customFields.forEach(cf => {
    allColDefs.push({
      key: cf.code,
      label: cf.label,
      width: 130,
      renderTh: (thStyle, thClass) => `<th class="${thClass}" style="width: 130px; min-width: 130px; max-width: 130px; ${thStyle}">${cf.label}</th>`,
      renderTd: (m, meta, tdStyle, tdClass) => `<td class="${tdClass}" style="${tdStyle}">${m.customValues?.[cf.code] ?? '—'}</td>`
    });
  });

  // Actions Menu Column
  allColDefs.push({
    key: 'actions',
    label: 'Actions',
    width: 110,
    renderTh: (thStyle, thClass) => `<th class="${thClass}" style="width: 110px; min-width: 110px; max-width: 110px; text-align: center; ${thStyle}">Actions</th>`,
    renderTd: (m, meta, tdStyle, tdClass) => `
      <td class="${tdClass}" style="text-align: center; ${tdStyle}">
        <div class="actions-dropdown-container">
          <button type="button" class="btn-actions-trigger btn-trigger-row-actions" data-id="${m.id}" title="Open Action Menu">
            ⋮ Actions ▾
          </button>
          <div id="actions-menu-${m.id}" class="actions-dropdown-menu table-row-actions-menu">
            <button type="button" class="actions-menu-item btn-inspect-machine" data-id="${m.id}">
              🔍 Machine Details &amp; Lifetime
            </button>
            <button type="button" class="actions-menu-item btn-history-machine" data-id="${m.id}">
              🕒 Timeline &amp; Transfer Log
            </button>
            <button type="button" class="actions-menu-item btn-spare-parts-machine" data-id="${m.id}">
              ⚙️ Spare Parts Usage
            </button>
            ${authService.hasAccess('transfers', 'ADD') ? `
              <button type="button" class="actions-menu-item btn-transfer-machine" data-id="${m.id}">
                🔄 Transfer Machine
              </button>
            ` : ''}
            ${authService.hasAccess('machines', 'EDIT') ? `
              <div class="actions-menu-divider"></div>
              <button type="button" class="actions-menu-item btn-edit-machine" data-id="${m.id}">
                ✏️ Edit Machine
              </button>
            ` : ''}
            ${authService.hasAccess('machines', 'DELETE') ? `
              <button type="button" class="actions-menu-item danger-item btn-delete-machine" data-id="${m.id}">
                🗑️ Delete Machine
              </button>
            ` : ''}
          </div>
        </div>
      </td>
    `
  });

  // Filter only visible columns
  const visibleColDefs = allColDefs.filter(c => visibleCols.has(c.key));

  // Partition: Frozen columns pinned to left in configured order, followed by unfrozen columns
  const frozenList = [];
  const frozenSet = new Set(frozenColKeys);
  frozenColKeys.forEach(k => {
    const found = visibleColDefs.find(c => c.key === k);
    if (found) frozenList.push(found);
  });
  const unfrozenList = visibleColDefs.filter(c => !frozenSet.has(c.key));
  const orderedCols = [...frozenList, ...unfrozenList];

  // Dynamic sticky left offset calculation
  let stickyOffset = 94; // SL (50px) + Check (44px)
  const columnLayout = orderedCols.map((c, idx) => {
    const isFrozen = frozenSet.has(c.key);
    let leftOffset = 0;
    if (isFrozen) {
      leftOffset = stickyOffset;
      stickyOffset += c.width;
    }
    const isLastFrozen = isFrozen && (idx === frozenList.length - 1);
    return {
      ...c,
      isFrozen,
      isLastFrozen,
      leftOffset
    };
  });

  const checkIsLastFrozen = frozenList.length === 0;

  // Build Table Header Columns
  let headerHtml = `
    <tr>
      <th class="col-freeze-sl" style="width: 50px; min-width: 50px; max-width: 50px; text-align: center;">SL</th>
      <th class="col-freeze-check ${checkIsLastFrozen ? 'col-frozen-boundary' : ''}" style="width: 44px; min-width: 44px; max-width: 44px; text-align: center;">
        <input type="checkbox" id="check-select-all" title="Select all visible machines" ${machines.length > 0 && selectedIds.size >= machines.length ? 'checked' : ''} />
      </th>
  `;

  columnLayout.forEach(col => {
    const thStyle = col.isFrozen 
      ? `position: sticky !important; left: ${col.leftOffset}px !important; z-index: 30 !important; background-color: #070d1e !important;` 
      : '';
    const boundaryClass = col.isLastFrozen ? 'col-frozen-boundary' : '';
    const thClass = col.isFrozen ? `col-frozen-cell ${boundaryClass}` : '';
    headerHtml += col.renderTh(thStyle, thClass);
  });

  headerHtml += `</tr>`;

  // 5. Render Table Rows
  let rowsHtml = '';
  if (machines.length === 0) {
    rowsHtml = `
      <tr>
        <td colspan="${columnLayout.length + 2}" style="text-align: center; padding: 48px 20px;">
          <div style="font-size: 32px; margin-bottom: 8px;">🔍</div>
          <div style="font-size: 15px; font-weight: 700; color: var(--text-primary);">No machines found</div>
          <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px; max-width: 380px; margin-left: auto; margin-right: auto;">
            No machines match your current search or location filters. Try resetting the filters.
          </div>
          <div style="margin-top: 14px; display: flex; gap: 8px; justify-content: center;">
            <button id="btn-empty-reset-filters" class="btn btn-secondary btn-sm">↺ Reset Filters</button>
            ${authService.hasAccess('machines', 'ADD') ? `
              <button id="btn-empty-add-machine" class="btn btn-primary btn-sm">➕ Add Machine</button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  } else {
    machines.forEach((m, idx) => {
      const isSelected = selectedIds.has(m.id);
      const slNo = (queryResult.page - 1) * (queryResult.limit === 'ALL' ? 0 : queryResult.limit) + idx + 1;
      const displaySlNo = String(slNo).padStart(2, '0');
      const statusBadgeClass = `badge-${(m.status || 'ACTIVE').toLowerCase().replace('_', '')}`;

      // Quantities
      const rQty = parseInt(m.running ?? m.qty_running ?? (m.status === 'ACTIVE' ? (m.quantity ?? 1) : 0), 10) || 0;
      const uQty = parseInt(m.usable_idle ?? m.usableIdle ?? (m.status === 'IDLE' ? (m.quantity ?? 1) : 0), 10) || 0;
      const rpQty = parseInt(m.repairable_idle ?? m.repairableIdle ?? ((m.status === 'MAINTENANCE' || m.status === 'BREAKDOWN') ? (m.quantity ?? 1) : 0), 10) || 0;
      const totalQty = m.totalQuantity || m.total_quantity || (rQty + uQty + rpQty > 0 ? (rQty + uQty + rpQty) : (m.quantity ?? 1));

      let row = `<tr class="${isSelected ? 'selected' : ''}" data-id="${m.id}">`;

      // 1. SL (Sticky Left: 0px)
      row += `<td class="col-freeze-sl" style="text-align: center; color: var(--text-muted); font-weight: 700; font-family: var(--font-mono); font-size: 11.5px;">${displaySlNo}</td>`;

      // 2. Selection Checkbox (Sticky Left: 50px)
      row += `<td class="col-freeze-check ${checkIsLastFrozen ? 'col-frozen-boundary' : ''}" style="text-align: center;"><input type="checkbox" class="machine-row-check" data-id="${m.id}" ${isSelected ? 'checked' : ''}/></td>`;

      // Render columns in calculated sequence
      columnLayout.forEach(col => {
        const tdStyle = col.isFrozen 
          ? `position: sticky !important; left: ${col.leftOffset}px !important; z-index: 10 !important; background-color: var(--bg-surface) !important;` 
          : '';
        const boundaryClass = col.isLastFrozen ? 'col-frozen-boundary' : '';
        const tdClass = col.isFrozen ? `col-frozen-cell ${boundaryClass}` : '';
        row += col.renderTd(m, { rQty, uQty, rpQty, totalQty, statusBadgeClass }, tdStyle, tdClass);
      });

      row += `</tr>`;
      rowsHtml += row;
    });
  }

  // 6. Pagination Page Numbers Generation
  const totalPages = Math.max(1, queryResult.totalPages || 1);
  const curPage = queryResult.page || 1;
  const startItem = queryResult.total === 0 ? 0 : (curPage - 1) * (queryResult.limit === 'ALL' ? 0 : queryResult.limit) + 1;
  const endItem = queryResult.limit === 'ALL' ? queryResult.total : Math.min(curPage * queryResult.limit, queryResult.total);

  let pageButtonsHtml = '';
  const maxButtons = 5;
  let startP = Math.max(1, curPage - 2);
  let endP = Math.min(totalPages, startP + maxButtons - 1);
  if (endP - startP < maxButtons - 1) {
    startP = Math.max(1, endP - maxButtons + 1);
  }

  for (let p = startP; p <= endP; p++) {
    pageButtonsHtml += `
      <button class="page-btn btn-page-number ${p === curPage ? 'active' : ''}" data-page="${p}">
        ${p}
      </button>
    `;
  }

  // 7. Assemble Complete Redesigned Component Layout
  return `
    <div class="page-view inventory-page-wrapper" style="display: flex; flex-direction: column; gap: 8px;">
      
      <!-- 1. Ultra-Compact Top Bar (Title + KPI Status Badges + Action Buttons) -->
      <div class="inventory-top-unified-bar">
        
        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
          <h1 style="font-size: 16px; font-weight: 800; color: #fff; margin: 0; display: flex; align-items: center; gap: 6px;">
            <span>📦</span> Machine Inventory
          </h1>
          
          <!-- Inline KPI Pills -->
          <div class="inventory-inline-kpis">
            <div class="kpi-pill kpi-total" title="Total machines registered">
              <span class="kpi-dot">🏭</span>
              <strong class="kpi-val">${countTotalMachines}</strong>
              <span class="kpi-lbl">Total</span>
            </div>
            <div class="kpi-pill kpi-running" title="Operational active machines">
              <span class="kpi-dot">🟢</span>
              <strong class="kpi-val" style="color: #34d399;">${totalRunning}</strong>
              <span class="kpi-lbl">Running</span>
            </div>
            <div class="kpi-pill kpi-usable" title="Ready-to-use standby machines">
              <span class="kpi-dot">🔵</span>
              <strong class="kpi-val" style="color: #38bdf8;">${totalUsableIdle}</strong>
              <span class="kpi-lbl">Usable</span>
            </div>
            <div class="kpi-pill kpi-repair" title="Machines under maintenance or repair">
              <span class="kpi-dot">🟡</span>
              <strong class="kpi-val" style="color: #fbbf24;">${totalRepairableIdle}</strong>
              <span class="kpi-lbl">Repairable</span>
            </div>
          </div>
        </div>

        <!-- Action Buttons (+ Add Machine | Delete Selected | Import | Export | Template | More) -->
        <div class="inventory-top-actions-group" style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
          
          ${authService.hasAccess('machines', 'ADD') ? `
            <button id="btn-add-machine-modal" class="btn btn-primary btn-sm" style="font-weight: 700; padding: 5px 12px; font-size: 12px;">
              ➕ Add Machine
            </button>
          ` : ''}

          <button id="btn-inventory-relocate" class="btn btn-secondary btn-sm" style="font-weight: 800; padding: 5px 12px; font-size: 12px; border: 1.5px solid #38bdf8; color: #38bdf8; background: rgba(56, 189, 248, 0.12);" title="Physical Machine Verification &amp; Relocation">
            📍 Relocate &amp; Verify
          </button>

          <button id="btn-inventory-qr-codes" class="btn btn-secondary btn-sm" style="font-weight: 800; padding: 5px 12px; font-size: 12px; border: 1.5px solid #a855f7; color: #c084fc; background: rgba(168, 85, 247, 0.12);" title="QR Code &amp; Label Studio: Generate, Preview, A4 Print">
            🏁 QR Codes
          </button>

          ${authService.hasAccess('machines', 'DELETE') ? `
            <button id="btn-top-bulk-delete" class="btn btn-danger btn-sm" style="font-weight: 700; padding: 5px 12px; font-size: 12px; background: ${selectedIds.size > 0 ? '#dc2626' : 'rgba(220, 38, 38, 0.18)'}; border: 1px solid ${selectedIds.size > 0 ? '#ef4444' : 'rgba(239, 68, 68, 0.35)'}; color: ${selectedIds.size > 0 ? '#fff' : '#fca5a5'}; cursor: ${selectedIds.size > 0 ? 'pointer' : 'not-allowed'}; opacity: ${selectedIds.size > 0 ? '1' : '0.6'};" ${selectedIds.size === 0 ? 'disabled' : ''} title="${selectedIds.size > 0 ? `Delete ${selectedIds.size} selected machine(s)` : 'Select machines to delete'}">
              🗑️ Delete Selected ${selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
            </button>
          ` : ''}

          ${(authService.hasAccess('excel_import', 'IMPORT') || authService.hasAccess('machines', 'IMPORT')) ? `
            <button id="btn-import-excel-modal" class="btn btn-secondary btn-sm" style="font-weight: 600; padding: 5px 10px; font-size: 12px;" title="Upload Excel file">
              📥 Import
            </button>
          ` : ''}

          ${(authService.hasAccess('excel_export', 'EXPORT') || authService.hasAccess('machines', 'EXPORT')) ? `
            <button id="btn-export-excel" class="btn btn-secondary btn-sm" style="font-weight: 600; padding: 5px 10px; font-size: 12px;" title="Export filtered machines to Excel">
              📤 Export
            </button>
          ` : ''}

          <button id="btn-download-template" class="btn btn-secondary btn-sm" style="font-weight: 600; padding: 5px 10px; font-size: 12px;" title="Download Excel template">
            📋 Template
          </button>

          <!-- More Dropdown -->
          <div class="actions-dropdown-container">
            <button id="btn-more-actions-trigger" class="btn btn-secondary btn-sm" style="font-weight: 600; padding: 5px 10px; font-size: 12px;">
              ⋯ More ▾
            </button>
            <div id="more-actions-dropdown-menu" class="actions-dropdown-menu" style="min-width: 170px;">
              <button type="button" class="actions-menu-item" id="btn-export-csv">
                📄 Export CSV
              </button>
              <button type="button" class="actions-menu-item" id="btn-generate-pdf">
                🖨️ Print Inventory
              </button>
              <button type="button" class="actions-menu-item" id="btn-column-visibility-toggle">
                👁️ Columns (${visibleCols.size})
              </button>
              ${(authService.hasAccess('machines', 'DELETE') && queryResult.total > 0 && hasActiveFilters) ? `
                <div class="actions-menu-divider"></div>
                <button type="button" class="actions-menu-item danger-item" id="btn-delete-all-filtered">
                  🗑️ Delete Filtered (${queryResult.total})
                </button>
              ` : ''}
            </div>
          </div>

        </div>
      </div>

      <!-- 2. Robust 2-Tier Structured Filter Bar (Zero Squishing, Perfect Readability) -->
      <div class="compact-filter-bar" style="padding: 10px 14px; display: flex; flex-direction: column; gap: 8px; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); box-shadow: var(--shadow-sm);">
        
        <!-- Row 1: Search Bar & Primary Hierarchy Dropdowns -->
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; width: 100%;">
          
          <!-- Unified Search Input -->
          <div class="filter-search-wrap" style="flex: 2 1 260px; min-width: 240px; position: relative;">
            <span class="filter-search-icon" style="left: 12px; font-size: 13px;">🔍</span>
            <input 
              type="text" 
              id="filter-search-input" 
              class="filter-search-input has-icon-left" 
              placeholder="Search machine, serial, brand..." 
              value="${filters.search || ''}"
              style="height: 34px; font-size: 12.5px; padding-left: 44px !important; padding-right: ${filters.search ? '64px' : '36px'} !important;"
            />
            <div class="filter-search-actions" style="right: 6px;">
              <button id="btn-inventory-scan-qr" type="button" class="filter-search-btn qr-btn" style="height: 24px; width: 26px; font-size: 13px;" title="Scan Machine QR Code / Barcode with Camera">📷</button>
              ${filters.search ? `
                <button id="btn-clear-search" type="button" class="filter-search-btn" style="height: 24px; width: 24px; font-size: 12px;" title="Clear Search">✕</button>
              ` : ''}
            </div>
          </div>

          <!-- Group -->
          <div class="filter-select-item" style="flex: 1 1 130px; min-width: 125px;">
            <select id="filter-group" class="filter-select-compact" style="height: 34px; font-size: 12px; width: 100%;">
              <option value="">All Groups (${groups.length})</option>
              ${groups.map(g => `<option value="${g.id}" ${filters.groupId === g.id ? 'selected' : ''}>${g.name}</option>`).join('')}
            </select>
          </div>

          <!-- Unit / Factory -->
          <div class="filter-select-item" style="flex: 1 1 140px; min-width: 135px;">
            <select id="filter-unit" class="filter-select-compact" style="height: 34px; font-size: 12px; width: 100%;">
              <option value="">All Units (${units.length})</option>
              ${units.map(u => `<option value="${u.id}" ${filters.unitId === u.id ? 'selected' : ''}>${u.name}</option>`).join('')}
            </select>
          </div>

          <!-- Floor -->
          <div class="filter-select-item" style="flex: 1 1 130px; min-width: 125px;">
            <select id="filter-floor" class="filter-select-compact" style="height: 34px; font-size: 12px; width: 100%;">
              <option value="">All Floors (${floors.length})</option>
              ${floors.map(f => `<option value="${f.id}" ${filters.floorId === f.id ? 'selected' : ''}>${f.name}</option>`).join('')}
            </select>
          </div>

          <!-- Line -->
          <div class="filter-select-item" style="flex: 1 1 130px; min-width: 125px;">
            <select id="filter-line" class="filter-select-compact" style="height: 34px; font-size: 12px; width: 100%;">
              <option value="">All Lines (${lines.length})</option>
              ${lines.map(l => {
                const clean = formatDisplayLine(l.name, 'NORMAL');
                const label = clean !== l.name ? `${clean} (${l.name})` : l.name;
                return `<option value="${l.id}" ${filters.lineId === l.id ? 'selected' : ''}>${label}</option>`;
              }).join('')}
            </select>
          </div>

        </div>

        <!-- Row 2: Machine Details, Status Filter & Table Action Tools -->
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; width: 100%;">
          
          <!-- Machine Name -->
          <div class="filter-select-item" style="flex: 1.5 1 160px; min-width: 145px;">
            <select id="filter-machine-name" class="filter-select-compact" style="height: 32px; font-size: 12px; width: 100%;">
              <option value="">All Machines (${machineNames.length})</option>
              ${machineNames.map(mn => `<option value="${mn.id}" ${filters.machineNameId === mn.id ? 'selected' : ''}>${mn.name}</option>`).join('')}
            </select>
          </div>

          <!-- Status -->
          <div class="filter-select-item" style="flex: 1 1 130px; min-width: 120px;">
            <select id="filter-status-select" class="filter-select-compact" style="height: 32px; font-size: 12px; width: 100%;">
              <option value="ALL" ${!filters.status || filters.status === 'ALL' ? 'selected' : ''}>All Status</option>
              <option value="ACTIVE" ${filters.status === 'ACTIVE' ? 'selected' : ''}>🟢 Active</option>
              <option value="IDLE" ${filters.status === 'IDLE' ? 'selected' : ''}>💤 Idle</option>
              <option value="MAINTENANCE" ${filters.status === 'MAINTENANCE' ? 'selected' : ''}>🟡 Maint</option>
              <option value="BREAKDOWN" ${filters.status === 'BREAKDOWN' ? 'selected' : ''}>🔴 Breakdown</option>
            </select>
          </div>

          <!-- Action Buttons Group -->
          <div style="display: flex; align-items: center; gap: 6px; margin-left: auto; flex-wrap: wrap;">
            <button id="btn-toggle-advanced-filters" class="btn btn-ghost btn-sm" style="font-size: 11.5px; padding: 4px 10px; color: #38bdf8; height: 32px; border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 6px;" title="Toggle Brand and Model filters">
              ${showAdvancedFilters ? '▲ Less' : 'More Filters ▾'}
            </button>
            
            <button id="btn-reset-filters" class="btn btn-secondary btn-sm" style="font-weight: 700; font-size: 11.5px; padding: 4px 12px; height: 32px; border-radius: 6px;" title="Reset filters">
              ↺ Reset
            </button>

            <button id="btn-column-picker-inline" class="btn btn-ghost btn-sm" style="font-size: 11.5px; padding: 4px 12px; color: #38bdf8; height: 32px; display: inline-flex; align-items: center; gap: 6px; border: 1px solid rgba(56, 189, 248, 0.4); border-radius: 6px; background: rgba(56, 189, 248, 0.1);" title="Configure visible and frozen columns">
              <span>❄️ Columns &amp; Freeze ▾</span>
              ${frozenColKeys.length > 0 ? `<span class="badge" style="background: rgba(56, 189, 248, 0.3); color: #fff; font-size: 10px; padding: 1px 6px; font-weight: 800; border-radius: 10px;">${frozenColKeys.length}</span>` : ''}
            </button>
          </div>

        </div>

        <!-- Active filter tags badge strip if active -->
        ${hasActiveFilters ? `
          <div style="display: flex; align-items: center; gap: 5px; flex-wrap: wrap; margin-top: 4px; padding-top: 4px; border-top: 1px solid rgba(255, 255, 255, 0.06);">
            <span style="font-size: 10.5px; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Active Filters:</span>
            ${activeTags.map(tag => `
              <span class="active-filter-tag" data-key="${tag.key}" style="display: inline-flex; align-items: center; gap: 4px; background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 4px; padding: 1px 6px; font-size: 11px; color: #38bdf8; cursor: pointer;" title="Click to remove">
                ${tag.label} <span style="color: #f87171; font-weight: bold; margin-left: 2px;">✕</span>
              </span>
            `).join('')}
          </div>
        ` : ''}

        <!-- Collapsible Advanced Filters Panel (Brand, Model) -->
        ${showAdvancedFilters ? `
          <div class="advanced-filters-panel" style="padding: 6px 8px; margin-top: 4px; display: flex; gap: 10px;">
            <div style="flex: 1;">
              <label style="font-size: 10px; font-weight: 700; color: var(--text-secondary); margin-bottom: 2px; display: block;">Brand</label>
              <select id="filter-brand" class="filter-select-compact" style="height: 28px; font-size: 11px;">
                <option value="">All Brands (${brands.length})</option>
                ${brands.map(b => `<option value="${b.id}" ${filters.brandId === b.id ? 'selected' : ''}>${b.name}</option>`).join('')}
              </select>
            </div>

            <div style="flex: 1;">
              <label style="font-size: 10px; font-weight: 700; color: var(--text-secondary); margin-bottom: 2px; display: block;">Model</label>
              <select id="filter-model" class="filter-select-compact" style="height: 28px; font-size: 11px;">
                <option value="">All Models (${models.length})</option>
                ${models.map(m => `<option value="${m.id}" ${filters.modelId === m.id ? 'selected' : ''}>${m.name}</option>`).join('')}
              </select>
            </div>
          </div>
        ` : ''}

      </div>

      <!-- 4. Bulk Selection Action Bar (when rows are selected) -->
      <div id="inventory-bulk-actions-bar" style="display: ${selectedIds.size > 0 ? 'flex' : 'none'}; background: rgba(15, 23, 42, 0.98); border: 1.5px solid #ef4444; border-radius: var(--radius-md); padding: 8px 14px; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; box-shadow: 0 4px 14px rgba(220, 38, 38, 0.25);">
        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
          <span style="font-weight: 800; color: #fff; font-size: 13px; display: flex; align-items: center; gap: 6px;">
            <span>☑️</span> <strong id="bulk-selected-count" style="color: #38bdf8;">${selectedIds.size}</strong> machine(s) selected
          </span>
          <button id="btn-select-all-filtered" class="btn btn-ghost btn-sm" style="display: ${selectedIds.size < queryResult.total ? 'inline-block' : 'none'}; color: #38bdf8; font-size: 11.5px; font-weight: 700; text-decoration: underline; padding: 2px 6px;">
            Select all ${queryResult.total} machines in current filter
          </button>
        </div>
        <div style="display: flex; gap: 8px; align-items: center;">
          ${authService.hasAccess('machines', 'DELETE') ? `
            <button id="btn-bulk-delete" class="btn btn-danger btn-sm" style="font-weight: 800; background: #dc2626; border-color: #ef4444; color: #fff; padding: 5px 14px; box-shadow: 0 2px 8px rgba(220, 38, 38, 0.4);">
              🗑️ Delete Selected (${selectedIds.size})
            </button>
          ` : ''}
          <button id="btn-bulk-clear" class="btn btn-secondary btn-sm" style="padding: 5px 10px; font-size: 12px;">✕ Clear Selection</button>
        </div>
      </div>

      <!-- 5. Real Excel-Style Machine Data Grid with Native Horizontal & Vertical Scroll -->
      <div class="inventory-table-scroll-container" id="inventory-table-scroll-viewport">
        <table class="excel-grid-table">
          <thead>
            ${headerHtml}
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>

      <!-- 6. Simplified Clean Pagination Bar -->
      <div class="inventory-pagination-bar">
        
        <!-- Left: Showing 1–50 of 178 machines -->
        <div class="pagination-counter">
          Showing <strong style="color: #fff;">${startItem}–${endItem}</strong> of <strong style="color: #38bdf8;">${queryResult.total}</strong> machines
        </div>

        <!-- Middle: Rows per page: [ 25 | 50 | 100 ] -->
        <div style="display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--text-secondary);">
          <span>Rows per page:</span>
          <select id="select-per-page" class="filter-select-compact" style="width: 80px; height: 32px; font-size: 12px;">
            <option value="25" ${queryResult.limit === 25 ? 'selected' : ''}>25</option>
            <option value="50" ${queryResult.limit === 50 ? 'selected' : ''}>50</option>
            <option value="100" ${queryResult.limit === 100 ? 'selected' : ''}>100</option>
            <option value="ALL" ${queryResult.limit === 'ALL' ? 'selected' : ''}>All</option>
          </select>
        </div>

        <!-- Right: Previous | 1 | 2 | 3 | Next -->
        <div class="pagination-controls">
          <button id="btn-prev-page" class="page-btn" ${curPage <= 1 ? 'disabled' : ''} title="Previous page">
            ◀ Previous
          </button>
          
          ${pageButtonsHtml}

          <button id="btn-next-page" class="page-btn" ${curPage >= totalPages ? 'disabled' : ''} title="Next page">
            Next ▶
          </button>
        </div>

      </div>

    </div>
  `;
}

export function initInventoryTableEvents() {
  // Relocate Page Navigation
  const btnRelocate = document.getElementById('btn-inventory-relocate');
  if (btnRelocate) {
    btnRelocate.addEventListener('click', () => {
      state.set('currentView', 'relocate');
    });
  }

  // QR Codes & Studio Page Navigation
  const btnQrCodes = document.getElementById('btn-inventory-qr-codes');
  if (btnQrCodes) {
    btnQrCodes.addEventListener('click', () => {
      state.set('currentView', 'qr-codes');
    });
  }

  // 1. Live Instant Search Input
  const searchInput = document.getElementById('filter-search-input');
  if (searchInput) {
    let timeout = null;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        state.updateFilters({ search: e.target.value, page: 1 });
      }, 150);
    });

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        clearTimeout(timeout);
        state.updateFilters({ search: e.target.value, page: 1 });
      }
    });
  }

  const clearSearchBtn = document.getElementById('btn-clear-search');
  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      state.updateFilters({ search: '', page: 1 });
    });
  }

  // Camera QR & Barcode Scanner for Inventory Quick Search
  const btnScanSearch = document.getElementById('btn-inventory-scan-qr');
  if (btnScanSearch) {
    btnScanSearch.addEventListener('click', () => {
      let scannerSlot = document.getElementById('inventory-qr-scanner-slot');
      if (!scannerSlot) {
        scannerSlot = document.createElement('div');
        scannerSlot.id = 'inventory-qr-scanner-slot';
        document.body.appendChild(scannerSlot);
      }
      scannerSlot.innerHTML = renderQrScannerModal();
      initQrScannerModalEvents({
        onScanSuccess: (decodedText) => {
          scannerSlot.innerHTML = '';
          const parsed = qrCodeService.parseQrPayload(decodedText);
          const idOrSerial = (parsed.identifier || decodedText || '').trim();
          if (!idOrSerial) return;
          const allMachines = storage.getTable(TABLE_NAMES.MACHINES) || [];
          const match = allMachines.find(m => 
            (m.id && m.id.toLowerCase() === idOrSerial.toLowerCase()) ||
            (m.permanentMachineId && m.permanentMachineId.toLowerCase() === idOrSerial.toLowerCase()) ||
            (m.serialNumber && m.serialNumber.toString().toLowerCase() === idOrSerial.toLowerCase())
          );
          const targetSerial = match ? match.serialNumber : idOrSerial;
          state.updateFilters({ search: targetSerial, page: 1 });
          notificationService.success(`Scanned machine: ${targetSerial}`);
        },
        onManualSearchRequest: () => {
          scannerSlot.innerHTML = '';
          if (searchInput) searchInput.focus();
        },
        onClose: () => {
          scannerSlot.innerHTML = '';
        }
      });
    });
  }

  // 2. Status Dropdown
  const statusSelect = document.getElementById('filter-status-select');
  if (statusSelect) {
    statusSelect.addEventListener('change', (e) => {
      state.updateFilters({ status: e.target.value, page: 1 });
    });
  }

  // 3. Hierarchical Cascading Dropdown Handlers (Group -> Unit -> Floor -> Line)
  const groupSelect = document.getElementById('filter-group');
  if (groupSelect) {
    groupSelect.addEventListener('change', (e) => {
      state.updateFilters({ 
        groupId: e.target.value, 
        unitId: '', 
        floorId: '', 
        lineId: '', 
        page: 1 
      });
    });
  }

  const unitSelect = document.getElementById('filter-unit');
  if (unitSelect) {
    unitSelect.addEventListener('change', (e) => {
      const uid = e.target.value;
      const unit = uid ? masterDataService.getUnitById(uid) : null;
      state.updateFilters({ 
        unitId: uid, 
        groupId: unit?.groupId || state.get('filters')?.groupId || '',
        floorId: '', 
        lineId: '', 
        page: 1 
      });
    });
  }

  const floorSelect = document.getElementById('filter-floor');
  if (floorSelect) {
    floorSelect.addEventListener('change', (e) => {
      const fid = e.target.value;
      const floor = fid ? masterDataService.getFloorById(fid) : null;
      const unit = floor ? masterDataService.getUnitById(floor.unitId) : null;
      state.updateFilters({ 
        floorId: fid, 
        unitId: unit?.id || state.get('filters')?.unitId || '',
        groupId: unit?.groupId || state.get('filters')?.groupId || '',
        lineId: '', 
        page: 1 
      });
    });
  }

  const lineSelect = document.getElementById('filter-line');
  if (lineSelect) {
    lineSelect.addEventListener('change', (e) => {
      const lid = e.target.value;
      if (lid) {
        const line = masterDataService.getLineById(lid);
        const floor = line ? masterDataService.getFloorById(line.floorId) : null;
        const unit = floor ? masterDataService.getUnitById(floor.unitId) : null;
        state.updateFilters({ 
          lineId: lid,
          floorId: floor?.id || state.get('filters')?.floorId || '',
          unitId: unit?.id || state.get('filters')?.unitId || '',
          groupId: unit?.groupId || state.get('filters')?.groupId || '',
          page: 1 
        });
      } else {
        state.updateFilters({ 
          lineId: '', 
          page: 1 
        });
      }
    });
  }

  // Machine Name Dropdown
  const mnSelect = document.getElementById('filter-machine-name');
  if (mnSelect) {
    mnSelect.addEventListener('change', (e) => {
      state.updateFilters({ 
        machineNameId: e.target.value, 
        brandId: '', 
        modelId: '', 
        page: 1 
      });
    });
  }

  // Advanced Filters (Brand, Model)
  const brandSelect = document.getElementById('filter-brand');
  if (brandSelect) {
    brandSelect.addEventListener('change', (e) => {
      state.updateFilters({ 
        brandId: e.target.value, 
        modelId: '', 
        page: 1 
      });
    });
  }

  const modelSelect = document.getElementById('filter-model');
  if (modelSelect) {
    modelSelect.addEventListener('change', (e) => {
      state.updateFilters({ 
        modelId: e.target.value, 
        page: 1 
      });
    });
  }

  // Toggle Advanced Filters Panel
  const btnToggleAdv = document.getElementById('btn-toggle-advanced-filters');
  if (btnToggleAdv) {
    btnToggleAdv.addEventListener('click', () => {
      showAdvancedFilters = !showAdvancedFilters;
      state.emit('filters:changed', state.get('filters'));
    });
  }

  // 4. Reset Filters Buttons
  const resetBtn = document.getElementById('btn-reset-filters');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      state.resetFilters();
      notificationService.info('All filters reset. Showing full machine inventory.');
    });
  }

  const emptyResetBtn = document.getElementById('btn-empty-reset-filters');
  if (emptyResetBtn) {
    emptyResetBtn.addEventListener('click', () => {
      state.resetFilters();
    });
  }

  // 5. Active Filter Tag Removal
  document.querySelectorAll('.active-filter-tag').forEach(tag => {
    tag.addEventListener('click', () => {
      const key = tag.getAttribute('data-key');
      if (key) {
        if (key === 'search') state.updateFilters({ search: '', page: 1 });
        else if (key === 'groupId') state.updateFilters({ groupId: '', unitId: '', floorId: '', lineId: '', page: 1 });
        else if (key === 'unitId') state.updateFilters({ unitId: '', floorId: '', lineId: '', page: 1 });
        else if (key === 'floorId') state.updateFilters({ floorId: '', lineId: '', page: 1 });
        else if (key === 'lineId') state.updateFilters({ lineId: '', page: 1 });
        else if (key === 'machineNameId') state.updateFilters({ machineNameId: '', brandId: '', modelId: '', page: 1 });
        else if (key === 'brandId') state.updateFilters({ brandId: '', modelId: '', page: 1 });
        else if (key === 'modelId') state.updateFilters({ modelId: '', page: 1 });
        else if (key === 'status') state.updateFilters({ status: 'ALL', page: 1 });
      }
    });
  });

  // 6. Top Bar Action Buttons
  const btnAdd = document.getElementById('btn-add-machine-modal');
  if (btnAdd) {
    btnAdd.addEventListener('click', () => {
      state.set('activeMachineId', null);
      state.set('activeModal', 'machine-form');
    });
  }

  const emptyAddBtn = document.getElementById('btn-empty-add-machine');
  if (emptyAddBtn) {
    emptyAddBtn.addEventListener('click', () => {
      state.set('activeMachineId', null);
      state.set('activeModal', 'machine-form');
    });
  }

  const btnImport = document.getElementById('btn-import-excel-modal');
  if (btnImport) {
    btnImport.addEventListener('click', () => {
      state.set('activeModal', 'import-excel');
    });
  }

  const btnTemplate = document.getElementById('btn-download-template');
  if (btnTemplate) {
    btnTemplate.addEventListener('click', () => {
      notificationService.withLoading(btnTemplate, async () => {
        await excelService.generateTemplate();
      }, 'Generating Template...', 'Excel template downloaded successfully!');
    });
  }

  const btnExportExcel = document.getElementById('btn-export-excel');
  if (btnExportExcel) {
    btnExportExcel.addEventListener('click', async () => {
      notificationService.withLoading(btnExportExcel, async () => {
        const filters = state.get('filters') || {};
        const qRes = machineService.getMachines({ ...filters, limit: 'ALL' });
        
        if (qRes.items.length === 0) {
          notificationService.warning('No machines match current filters to export.');
          return;
        }

        const dateStr = new Date().toISOString().split('T')[0];
        const fileName = `AlMuslim_Machine_Inventory_${dateStr}.xlsx`;
        await excelService.exportFilteredMachinesToExcel(qRes.items, fileName);
      }, 'Exporting Excel...', `Exported ${machineService.getMachines({ ...state.get('filters'), limit: 'ALL' }).total} machines to Excel!`);
    });
  }

  // More Dropdown Handler
  const btnMoreTrigger = document.getElementById('btn-more-actions-trigger');
  const moreMenu = document.getElementById('more-actions-dropdown-menu');
  if (btnMoreTrigger && moreMenu) {
    btnMoreTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = moreMenu.classList.contains('show');
      closeAllActionMenus();
      if (!isOpen) {
        moreMenu.classList.add('show');
        window.__isActionMenuOpen = true;
      }
    });
  }

  // Helper to cleanly close all action menus
  const closeAllActionMenus = () => {
    window.__isActionMenuOpen = false;
    if (moreMenu) moreMenu.classList.remove('show');
    document.querySelectorAll('.actions-dropdown-menu.show').forEach(m => {
      m.classList.remove('show');
      m.style.display = 'none';
    });
    document.querySelectorAll('.btn-actions-trigger.active').forEach(b => {
      b.classList.remove('active');
      b.innerHTML = '⋮ Actions ▾';
    });
    document.querySelectorAll('tr.row-actions-active').forEach(r => r.classList.remove('row-actions-active'));
    document.querySelectorAll('td.td-actions-active').forEach(d => d.classList.remove('td-actions-active'));
    window.dispatchEvent(new CustomEvent('erp:menu-closed'));
  };

  // Helper to dynamically track and reposition the open menu on table scroll without closing it abruptly
  const repositionOpenMenu = () => {
    const activeBtn = document.querySelector('.btn-trigger-row-actions.active');
    if (!activeBtn) return;
    const id = activeBtn.getAttribute('data-id');
    const menu = document.getElementById(`actions-menu-${id}`);
    if (!menu || !menu.classList.contains('show')) return;

    const rect = activeBtn.getBoundingClientRect();
    const vp = document.getElementById('inventory-table-scroll-viewport');
    if (vp) {
      const vpRect = vp.getBoundingClientRect();
      // If the row scrolled completely out of the viewport top/bottom by >15px, close cleanly
      if (rect.bottom < vpRect.top - 15 || rect.top > vpRect.bottom + 15) {
        closeAllActionMenus();
        return;
      }
    }

    const menuWidth = 215;
    const menuHeight = menu.offsetHeight || 235;

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    let isDropup = false;
    let top;

    if (spaceBelow < (menuHeight + 15) && spaceAbove > spaceBelow) {
      isDropup = true;
      top = Math.max(10, rect.top - menuHeight - 4);
    } else {
      isDropup = false;
      top = rect.bottom + 4;
      if (top + menuHeight > window.innerHeight - 10) {
        if (spaceAbove > menuHeight) {
          isDropup = true;
          top = Math.max(10, rect.top - menuHeight - 4);
        } else {
          top = Math.max(10, window.innerHeight - menuHeight - 10);
        }
      }
    }

    let left = rect.right - menuWidth;
    if (left < 10) left = 10;
    if (left + menuWidth > window.innerWidth - 10) {
      left = window.innerWidth - menuWidth - 10;
    }

    menu.style.position = 'fixed';
    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;
    menu.style.right = 'auto';
    menu.style.bottom = 'auto';
    menu.style.width = `${menuWidth}px`;
    menu.style.zIndex = '999999';

    activeBtn.innerHTML = isDropup ? '⋮ Actions ▴' : '⋮ Actions ▾';
  };

  window.__closeAllActionMenus = closeAllActionMenus;
  window.__repositionOpenActionMenu = repositionOpenMenu;

  // Single idempotent registration of global document/window listeners
  if (!window.__inventoryActionsGlobalListenersAttached) {
    window.__inventoryActionsGlobalListenersAttached = true;

    // Close menus on outside click
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.actions-dropdown-container') && !e.target.closest('.actions-dropdown-menu')) {
        if (window.__closeAllActionMenus) window.__closeAllActionMenus();
      }
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (window.__closeAllActionMenus) window.__closeAllActionMenus();
      }
    });

    // Smoothly reposition menu on window resize
    window.addEventListener('resize', () => {
      if (window.__repositionOpenActionMenu) window.__repositionOpenActionMenu();
    }, { passive: true });
  }

  // Table horizontal and vertical scroll: dynamically repositions floating menu instead of abruptly closing it
  const scrollViewport = document.getElementById('inventory-table-scroll-viewport');
  if (scrollViewport) {
    scrollViewport.addEventListener('scroll', repositionOpenMenu, { passive: true });
  }

  const btnExportCsv = document.getElementById('btn-export-csv');
  if (btnExportCsv) {
    btnExportCsv.addEventListener('click', () => {
      const filters = state.get('filters') || {};
      const qRes = machineService.getMachines({ ...filters, limit: 'ALL' });

      if (qRes.items.length === 0) {
        notificationService.warning('No machines match current filters to export.');
        return;
      }

      const dateStr = new Date().toISOString().split('T')[0];
      const fileName = `AlMuslim_Machine_Inventory_${dateStr}.csv`;
      excelService.exportFilteredMachinesToCsv(qRes.items, fileName);
      notificationService.success(`Exported ${qRes.items.length} machines to CSV!`);
    });
  }

  const btnPdf = document.getElementById('btn-generate-pdf');
  if (btnPdf) {
    btnPdf.addEventListener('click', () => {
      notificationService.withLoading(btnPdf, async () => {
        const filters = state.get('filters') || {};
        const qRes = machineService.getMachines({ ...filters, limit: 'ALL' });

        if (qRes.items.length === 0) {
          notificationService.warning('No machines match current filters to generate PDF.');
          return;
        }

        pdfService.generateReport({
          title: 'Machine Inventory Report',
          subtitle: 'Central Maintenance Department Machine Register',
          filterSummary: `Filtered Dataset: ${qRes.total} Machines`,
          machines: qRes.items
        });
      }, 'Generating Report...', 'Machine inventory PDF report generated successfully!');
    });
  }

  const btnColVis = document.getElementById('btn-column-visibility-toggle');
  if (btnColVis) {
    btnColVis.addEventListener('click', () => {
      state.set('activeModal', 'column-visibility');
    });
  }

  const btnColPickerInline = document.getElementById('btn-column-picker-inline');
  if (btnColPickerInline) {
    btnColPickerInline.addEventListener('click', () => {
      state.set('activeModal', 'column-visibility');
    });
  }

  // 7. Table Header Sorting Handler
  document.querySelectorAll('.th-sortable').forEach(th => {
    th.addEventListener('click', () => {
      const sortField = th.getAttribute('data-sort');
      const curFilters = state.get('filters') || {};
      const curField = curFilters.sortField;
      const curOrder = curFilters.sortOrder || 'asc';

      let newOrder = 'asc';
      if (curField === sortField) {
        newOrder = curOrder === 'asc' ? 'desc' : 'asc';
      }

      state.updateFilters({ sortField: sortField, sortOrder: newOrder, page: 1 });
    });
  });

  // 8. Pagination Handlers
  const perPageSelect = document.getElementById('select-per-page');
  if (perPageSelect) {
    perPageSelect.addEventListener('change', (e) => {
      const val = e.target.value === 'ALL' ? 'ALL' : parseInt(e.target.value, 10);
      state.updateFilters({ limit: val, page: 1 });
    });
  }

  const btnPrev = document.getElementById('btn-prev-page');
  if (btnPrev) {
    btnPrev.addEventListener('click', () => {
      const curPage = state.get('filters')?.page || 1;
      if (curPage > 1) state.updateFilters({ page: curPage - 1 });
    });
  }

  const btnNext = document.getElementById('btn-next-page');
  if (btnNext) {
    btnNext.addEventListener('click', () => {
      const curPage = state.get('filters')?.page || 1;
      state.updateFilters({ page: curPage + 1 });
    });
  }

  document.querySelectorAll('.btn-page-number').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = parseInt(btn.getAttribute('data-page'), 10);
      if (p) state.updateFilters({ page: p });
    });
  });


  // 9. Row Actions Dropdown Toggle with Smart Floating Positioning & Auto-Flip
  document.querySelectorAll('.btn-trigger-row-actions').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const menu = document.getElementById(`actions-menu-${id}`);
      const tr = btn.closest('tr');
      const td = btn.closest('td');
      const wasOpen = menu && menu.classList.contains('show');
      
      // Close other open menus
      closeAllActionMenus();

      if (menu && !wasOpen) {
        menu.classList.add('show');
        menu.style.display = 'flex';
        btn.classList.add('active');
        if (tr) tr.classList.add('row-actions-active');
        if (td) td.classList.add('td-actions-active');
        window.__isActionMenuOpen = true;

        // Smart floating coordinates: completely escapes table overflow-y/x clipping
        const rect = btn.getBoundingClientRect();
        const menuWidth = 215;
        const menuHeight = menu.offsetHeight || 235;

        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;

        let isDropup = false;
        let top;

        // If not enough room below (less than menuHeight + 15px) and there's more room above:
        if (spaceBelow < (menuHeight + 15) && spaceAbove > spaceBelow) {
          isDropup = true;
          top = Math.max(10, rect.top - menuHeight - 4);
        } else {
          isDropup = false;
          top = rect.bottom + 4;
          // Guard against viewport overflow
          if (top + menuHeight > window.innerHeight - 10) {
            if (spaceAbove > menuHeight) {
              isDropup = true;
              top = Math.max(10, rect.top - menuHeight - 4);
            } else {
              top = Math.max(10, window.innerHeight - menuHeight - 10);
            }
          }
        }

        // Horizontal alignment: right-align with button, bounded within viewport
        let left = rect.right - menuWidth;
        if (left < 10) left = 10;
        if (left + menuWidth > window.innerWidth - 10) {
          left = window.innerWidth - menuWidth - 10;
        }

        menu.style.position = 'fixed';
        menu.style.top = `${top}px`;
        menu.style.left = `${left}px`;
        menu.style.right = 'auto';
        menu.style.bottom = 'auto';
        menu.style.width = `${menuWidth}px`;
        menu.style.zIndex = '999999';

        btn.innerHTML = isDropup ? '⋮ Actions ▴' : '⋮ Actions ▾';
      }
    });
  });

  // 10. Inspect Machine (Click on Serial Number or View Details)
  document.querySelectorAll('.btn-inspect-machine').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeAllActionMenus();
      const id = btn.getAttribute('data-id');
      if (id) {
        state.set('activeMachineId', id);
        state.set('activeModal', 'machine-details');
      }
    });
  });

  // Machine History & Timeline
  document.querySelectorAll('.btn-history-machine').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeAllActionMenus();
      const id = btn.getAttribute('data-id');
      if (id) {
        state.set('activeMachineId', id);
        state.set('currentView', 'machine-history');
      }
    });
  });

  // Spare Parts History
  document.querySelectorAll('.btn-spare-parts-machine').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeAllActionMenus();
      const id = btn.getAttribute('data-id');
      if (id) {
        state.set('activeMachineId', id);
        state.set('currentView', 'machine-history');
      }
    });
  });

  // Edit Machine
  document.querySelectorAll('.btn-edit-machine').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeAllActionMenus();
      const id = btn.getAttribute('data-id');
      if (id) {
        state.set('activeMachineId', id);
        state.set('activeModal', 'machine-form');
      }
    });
  });

  // Transfer Machine
  document.querySelectorAll('.btn-transfer-machine').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeAllActionMenus();
      const id = btn.getAttribute('data-id');
      if (id) {
        state.set('activeMachineId', id);
        state.set('activeModal', 'transfer-machine');
      }
    });
  });

  // Delete Machine
  document.querySelectorAll('.btn-delete-machine').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      closeAllActionMenus();
      const id = btn.getAttribute('data-id');
      if (id) {
        const m = storage.getItem(TABLE_NAMES.MACHINES, id);
        const confirmed = await notificationService.confirm({
          title: 'Delete Machine',
          message: `Permanently delete machine <strong>${m?.serialNumber || id}</strong>?`,
          icon: '🗑️',
          confirmText: 'Delete Machine',
          isDestructive: true
        });
        if (confirmed) {
          try {
            machineService.deleteMachine(id);
            state.emit('inventory:updated');
            notificationService.success('Machine deleted successfully.');
          } catch (err) {
            notificationService.error(err.message);
          }
        }
      }
    });
  });

  // Delete All Filtered
  const btnDeleteAllFiltered = document.getElementById('btn-delete-all-filtered');
  if (btnDeleteAllFiltered) {
    btnDeleteAllFiltered.addEventListener('click', async () => {
      const filters = state.get('filters') || {};
      const qRes = machineService.getMachines(filters);
      
      const confirmed = await notificationService.confirm({
        title: 'Delete All Filtered Machines',
        message: `Permanently delete all <strong>${qRes.total}</strong> machines currently matching the active filters? This action cannot be undone.`,
        icon: '🗑️',
        confirmText: 'Delete All Filtered',
        isDestructive: true
      });

      if (confirmed) {
        try {
          const allFiltered = machineService.getMachines({ ...filters, limit: 'ALL' });
          const idsToDelete = allFiltered.items.map(m => m.id);
          const res = await machineService.bulkPermanentDelete(idsToDelete, 'Admin mass delete filtered');
          state.clearSelection();
          state.resetFilters();
          state.emit('inventory:updated');
          notificationService.success(`✅ Deleted ${res.deletedCount} machines and saved to cloud.`);
        } catch (err) {
          if (err.name === 'CloudSaveError') {
            notificationService.error(err.message || '❌ Cloud Save Failed: Bulk deletion not confirmed.');
          } else {
            notificationService.error(err.message);
          }
        }
      }
    });
  }

  // 11. Checkboxes & Bulk Selection Handlers
  const selectAll = document.getElementById('check-select-all');
  if (selectAll) {
    selectAll.addEventListener('change', (e) => {
      const curFilters = state.get('filters') || {};
      const allFiltered = machineService.getMachines({ ...curFilters, limit: 'ALL' });
      const ids = (allFiltered.items || []).map(m => m.id);

      if (e.target.checked) {
        // Select ALL machines currently matching the active filters
        state.selectAllMachines(ids);
        notificationService.info(`Selected all ${ids.length} machine(s) matching current filters.`);
      } else {
        state.clearSelection();
      }
    });
  }

  const btnSelectAllFiltered = document.getElementById('btn-select-all-filtered');
  if (btnSelectAllFiltered) {
    btnSelectAllFiltered.addEventListener('click', () => {
      const curFilters = state.get('filters') || {};
      const allFiltered = machineService.getMachines({ ...curFilters, limit: 'ALL' });
      const ids = (allFiltered.items || []).map(m => m.id);
      state.selectAllMachines(ids);
      notificationService.info(`Selected all ${ids.length} machine(s) in current filtered view.`);
    });
  }

  document.querySelectorAll('.machine-row-check').forEach(chk => {
    chk.addEventListener('change', (e) => {
      const id = e.target.getAttribute('data-id');
      if (id) state.toggleSelectMachine(id);
    });
  });

  const clearSelBtn = document.getElementById('btn-bulk-clear');
  if (clearSelBtn) {
    clearSelBtn.addEventListener('click', () => state.clearSelection());
  }

  // Common Reusable Bulk Delete Function
  const executeBulkDelete = async () => {
    const selIds = state.get('selectedMachineIds');
    if (!selIds || selIds.size === 0) {
      notificationService.warning('Please select at least one machine to delete.');
      return;
    }

    const count = selIds.size;
    const confirmed = await notificationService.confirm({
      title: 'Delete Selected Machines',
      message: `Are you sure you want to permanently delete <strong>${count}</strong> selected machine(s)? This action cannot be undone.`,
      icon: '🗑️',
      confirmText: `Delete ${count} Machine(s)`,
      isDestructive: true
    });

    if (confirmed) {
      try {
        const idList = Array.from(selIds);
        const result = await machineService.bulkPermanentDelete(idList, 'Admin selected bulk deletion');
        state.clearSelection();
        state.emit('inventory:updated');
        notificationService.success(`✅ Successfully deleted ${result.deletedCount} machine(s) and saved to cloud.`);
      } catch (err) {
        if (err.name === 'CloudSaveError') {
          notificationService.error(err.message || '❌ Cloud Save Failed: Bulk deletion not confirmed.');
        } else {
          notificationService.error(err.message || 'Failed to delete selected machines.');
        }
      }
    }
  };

  const btnBulkDelete = document.getElementById('btn-bulk-delete');
  if (btnBulkDelete) {
    btnBulkDelete.addEventListener('click', executeBulkDelete);
  }

  const btnTopBulkDelete = document.getElementById('btn-top-bulk-delete');
  if (btnTopBulkDelete) {
    btnTopBulkDelete.addEventListener('click', executeBulkDelete);
  }

  // Initial synchronization of selection state on load
  syncInventorySelectionDOM();
}

/**
 * Fast in-place DOM synchronization for machine selection state without destroying scroll position
 */
export function syncInventorySelectionDOM(selectedIdsInput) {
  const selectedIds = selectedIdsInput instanceof Set ? selectedIdsInput : new Set(selectedIdsInput || state.get('selectedMachineIds') || []);
  const curFilters = state.get('filters') || {};
  const qRes = machineService.getMachines({ ...curFilters, limit: 'ALL' });
  const totalFiltered = qRes.total || 0;

  // 1. Update row checkboxes and <tr> selected class in the current table viewport
  const rowCheckboxes = document.querySelectorAll('.machine-row-check');
  let visibleSelectedCount = 0;

  rowCheckboxes.forEach(chk => {
    const id = chk.getAttribute('data-id');
    const isChecked = selectedIds.has(id);
    chk.checked = isChecked;
    if (isChecked) visibleSelectedCount++;
    const tr = chk.closest('tr');
    if (tr) tr.classList.toggle('selected', isChecked);
  });

  // 2. Update Header Select All Checkbox (#check-select-all)
  const selectAll = document.getElementById('check-select-all');
  if (selectAll) {
    if (rowCheckboxes.length > 0 && visibleSelectedCount === rowCheckboxes.length) {
      selectAll.checked = true;
      selectAll.indeterminate = false;
    } else if (visibleSelectedCount > 0 || (selectedIds.size > 0 && rowCheckboxes.length > 0)) {
      selectAll.checked = false;
      selectAll.indeterminate = true;
    } else {
      selectAll.checked = false;
      selectAll.indeterminate = false;
    }
  }

  // 3. Update Persistent Bulk Action Bar
  const bulkBar = document.getElementById('inventory-bulk-actions-bar');
  if (bulkBar) {
    if (selectedIds.size > 0) {
      bulkBar.style.display = 'flex';
      const countEl = document.getElementById('bulk-selected-count');
      if (countEl) countEl.textContent = selectedIds.size;
      const selectAllFilteredBtn = document.getElementById('btn-select-all-filtered');
      if (selectAllFilteredBtn) {
        if (selectedIds.size < totalFiltered) {
          selectAllFilteredBtn.style.display = 'inline-block';
          selectAllFilteredBtn.textContent = `Select all ${totalFiltered} machines in current filter`;
        } else {
          selectAllFilteredBtn.style.display = 'none';
        }
      }
      const bulkDelBtn = document.getElementById('btn-bulk-delete');
      if (bulkDelBtn) bulkDelBtn.innerHTML = `🗑️ Delete Selected (${selectedIds.size})`;
    } else {
      bulkBar.style.display = 'none';
    }
  }

  // 4. Update Top Bar Delete Button
  const topBulkDelBtn = document.getElementById('btn-top-bulk-delete');
  if (topBulkDelBtn) {
    if (selectedIds.size > 0) {
      topBulkDelBtn.removeAttribute('disabled');
      topBulkDelBtn.style.opacity = '1';
      topBulkDelBtn.style.cursor = 'pointer';
      topBulkDelBtn.style.background = '#dc2626';
      topBulkDelBtn.style.borderColor = '#ef4444';
      topBulkDelBtn.style.color = '#fff';
      topBulkDelBtn.innerHTML = `🗑️ Delete Selected (${selectedIds.size})`;
      topBulkDelBtn.title = `Delete ${selectedIds.size} selected machine(s)`;
    } else {
      topBulkDelBtn.setAttribute('disabled', 'true');
      topBulkDelBtn.style.opacity = '0.6';
      topBulkDelBtn.style.cursor = 'not-allowed';
      topBulkDelBtn.style.background = 'rgba(220, 38, 38, 0.18)';
      topBulkDelBtn.style.borderColor = 'rgba(239, 68, 68, 0.35)';
      topBulkDelBtn.style.color = '#fca5a5';
      topBulkDelBtn.innerHTML = '🗑️ Delete Selected';
      topBulkDelBtn.title = 'Select machines to delete';
    }
  }
}
