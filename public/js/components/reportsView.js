/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Comprehensive Reports & Excel Export Hub Component
 * 
 * Supported Report Sections:
 * 1. Machine Reports (Inventory, Floor Distribution, Brands/Models, Statuses)
 * 2. Transfer Reports (Movement Ledger, Pending Requests, Relocations)
 * 3. Spare Parts Reports (Replacements by Machine, Usage Frequency, Master Catalog)
 * 4. 1-Click Export to Excel Center
 */

import { storage } from '../db/storage.js';
import { TABLE_NAMES, TRANSFER_STATUSES } from '../db/schema.js';
import { INITIAL_DATA } from '../db/initialData.js';
import { machineService } from '../services/machineService.js';
import { masterDataService } from '../services/masterDataService.js';
import { excelService, formatDisplayLine } from '../services/excelService.js';
import { pdfService } from '../services/pdfService.js?v=4.7.7';
import { transferService } from '../services/transferService.js';
import { historyService } from '../services/historyService.js';
import { auditService } from '../services/auditService.js';
import { authService } from '../services/authService.js';
import { notificationService } from '../services/notificationService.js';
import { etLabService } from '../services/etLabService.js';
import { updateSidebarActiveState } from './sidebar.js';
import { state } from '../state.js';

let currentReportTab = 'machines'; // 'machines', 'transfers', 'spareparts', 'export'
let filterFloor = 'ALL';
let filterStatus = 'ALL';

let spareFilterState = {
  groupId: '',
  unitId: '',
  floorId: '',
  lineId: '',
  machineId: '',
  sparePart: '',
  status: 'ALL',
  dateFrom: '',
  dateTo: '',
  search: '',
  viewMode: 'SUMMARY' // 'SUMMARY' or 'LEDGER'
};

export function renderReportsView() {
  const requestedTab = state.get('reportActiveTab');
  if (requestedTab) {
    currentReportTab = requestedTab;
  } else {
    state.set('reportActiveTab', currentReportTab);
  }

  const allMachines = machineService.getMachines({ limit: 'ALL' }).items || [];
  const allTransfers = transferService.getTransferRequests({ status: 'ALL' }) || [];
  const completedTransfers = storage.getTable(TABLE_NAMES.TRANSFERS) || [];
  const allHistory = historyService.getMachineHistory() || [];
  const sparePartsMaster = historyService.getSparePartsMaster() || [];
  const etLabBoards = etLabService.getBoards() || [];
  const floors = storage.getTable(TABLE_NAMES.FLOORS) || [];

  // Spare parts replacement logs
  const replacementLogs = allHistory.filter(h => h.actionType === 'SPARE_PART_REPLACEMENT' || h.sparePart);

  return `
    <div class="page-view" style="display: flex; flex-direction: column; gap: 8px; height: 100%; overflow: hidden; box-sizing: border-box; padding: 8px 14px;">
      
      <!-- Top Title Bar (Ultra Compact Header) -->
      <div class="reports-top-bar" style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 5px 12px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; flex-shrink: 0;">
        <div style="display: flex; align-items: center; gap: 8px; min-width: 0;">
          <span style="font-size: 16px;">📊</span>
          <h1 style="font-size: 15px; font-weight: 800; color: #fff; margin: 0; white-space: nowrap;">
            Reports &amp; Analytics
          </h1>
          <span class="badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); font-size: 10px; padding: 1px 6px; white-space: nowrap;">
            Summary Reports &amp; Excel Export Hub
          </span>
        </div>

        <div style="display: flex; gap: 6px; flex-wrap: wrap; align-items: center;">
          <button id="btn-toggle-reports-guide" class="btn btn-secondary btn-xs" style="font-weight: 700; height: 26px; font-size: 11px; padding: 0 8px; white-space: nowrap;" title="View section purpose and module functions">
            ℹ️ Purpose &amp; Guide
          </button>
          <button id="btn-quick-export-all-excel" class="btn btn-primary btn-xs" style="font-weight: 700; height: 26px; font-size: 11px; padding: 0 10px; background: linear-gradient(135deg, #0284c7, #0369a1); box-shadow: 0 2px 8px rgba(2, 132, 199, 0.35); white-space: nowrap;">
            📥 Download Complete Excel Workbook
          </button>
        </div>
      </div>

      <!-- Collapsible Section Guide Drawer -->
      <div id="reports-guide-drawer" style="display: none; background: rgba(15, 23, 42, 0.95); border: 1.5px solid #0284c7; border-radius: var(--radius-md); padding: 8px 12px; box-shadow: 0 6px 20px rgba(0,0,0,0.4); flex-shrink: 0;">
        <div style="display: justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 4px; margin-bottom: 6px;">
          <div style="font-weight: 800; color: #38bdf8; font-size: 12px; display: flex; align-items: center; gap: 6px;">
            <span>💡</span> Purpose &amp; Overview of Reports &amp; Analytics Modules
          </div>
          <button id="btn-close-reports-guide" class="btn btn-ghost btn-xs" style="color: #94a3b8; font-size: 12px;">✕</button>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 6px; font-size: 10.5px; color: #cbd5e1; line-height: 1.35;">
          <div style="background: rgba(56, 189, 248, 0.08); border-left: 3px solid #38bdf8; padding: 4px 6px; border-radius: 4px;">
            <strong style="color: #38bdf8;">🧵 1. Machine Summary:</strong> Fleet breakdown across Groups, Units, Floors &amp; Lines by model.
          </div>
          <div style="background: rgba(168, 85, 247, 0.08); border-left: 3px solid #c084fc; padding: 4px 6px; border-radius: 4px;">
            <strong style="color: #c084fc;">🔄 2. Transfer Reports:</strong> Relocation logs, pending approvals, dispatch &amp; receiving status.
          </div>
          <div style="background: rgba(251, 191, 36, 0.08); border-left: 3px solid #fbbf24; padding: 4px 6px; border-radius: 4px;">
            <strong style="color: #fbbf24;">⚙️ 3. Spare Parts Reports:</strong> Replacement logs, consumption volume, unreturned parts &amp; valuations.
          </div>
          <div style="background: rgba(52, 211, 153, 0.08); border-left: 3px solid #34d399; padding: 4px 6px; border-radius: 4px;">
            <strong style="color: #34d399;">🔬 4. ENT Lab Management:</strong> Circuit board diagnostics, in-house &amp; external vendor repairs.
          </div>
          <div style="background: rgba(244, 63, 94, 0.08); border-left: 3px solid #fb7185; padding: 4px 6px; border-radius: 4px;">
            <strong style="color: #fb7185;">📤 5. 1-Click Excel Export:</strong> Download comprehensive multi-sheet spreadsheets with live formulas.
          </div>
        </div>
      </div>

      <!-- Navigation Tabs (Compact Buttons Bar, Fixed Height 30px) -->
      <div id="reports-nav-tabs-bar" style="display: flex; gap: 6px; border-bottom: 2px solid var(--border-color); padding-bottom: 3px; flex-wrap: nowrap; flex-shrink: 0; overflow-x: auto; scrollbar-width: none; height: 30px; align-items: center;">
        <button class="btn btn-xs ${currentReportTab === 'machines' ? 'btn-primary' : 'btn-ghost'}" data-report-tab-btn="machines" style="font-weight: 700; font-size: 11px; padding: 3px 8px; height: 26px; white-space: nowrap;">
          🧵 Machine Summary (${allMachines.length})
        </button>
        <button class="btn btn-xs ${currentReportTab === 'transfers' ? 'btn-primary' : 'btn-ghost'}" data-report-tab-btn="transfers" style="font-weight: 700; font-size: 11px; padding: 3px 8px; height: 26px; white-space: nowrap;">
          🔄 Transfer Reports (${allTransfers.length})
        </button>
        <button class="btn btn-xs ${currentReportTab === 'spareparts' ? 'btn-primary' : 'btn-ghost'}" data-report-tab-btn="spareparts" style="font-weight: 700; font-size: 11px; padding: 3px 8px; height: 26px; white-space: nowrap;">
          ⚙️ Spare Parts Reports (${replacementLogs.length})
        </button>
        <button class="btn btn-xs ${currentReportTab === 'etlab' ? 'btn-primary' : 'btn-ghost'}" data-report-tab-btn="etlab" style="font-weight: 700; font-size: 11px; padding: 3px 8px; height: 26px; white-space: nowrap;">
          🔬 ENT Lab Report (${etLabBoards.length})
        </button>
        <button class="btn btn-xs ${currentReportTab === 'export' ? 'btn-primary' : 'btn-ghost'}" data-report-tab-btn="export" style="font-weight: 700; font-size: 11px; padding: 3px 8px; height: 26px; white-space: nowrap; color: ${currentReportTab === 'export' ? '#fff' : '#38bdf8'};">
          📤 1-Click Excel Export Center
        </button>
      </div>

      <!-- Tab Content Area (Flex 1, scrollable within tabs) -->
      <div id="reports-tab-content" style="display: flex; flex-direction: column; gap: 6px; flex: 1; min-height: 0; overflow-y: auto;">
        ${renderActiveTabHtml({ allMachines, allTransfers, completedTransfers, replacementLogs, sparePartsMaster, etLabBoards, floors })}
      </div>
    </div>
  `;
}

function renderActiveTabHtml({ allMachines, allTransfers, completedTransfers, replacementLogs, sparePartsMaster, etLabBoards, floors }) {
  if (currentReportTab === 'machines') {
    return renderMachineReportsTab(allMachines, floors);
  } else if (currentReportTab === 'transfers') {
    return renderTransferReportsTab(allTransfers, completedTransfers || []);
  } else if (currentReportTab === 'spareparts') {
    return renderSparePartsReportsTab(replacementLogs, sparePartsMaster);
  } else if (currentReportTab === 'etlab') {
    return renderEtLabReportsTab(etLabBoards);
  } else if (currentReportTab === 'export') {
    return renderExportCenterTab(allMachines, allTransfers, replacementLogs, sparePartsMaster);
  }
  return '';
}

let entReportFilterState = {
  dateFrom: '',
  dateTo: '',
  boardSerial: '',
  partName: '',
  modelNo: '',
  machineSerial: '',
  unitId: '',
  floorId: '',
  lineId: '',
  status: 'ALL',
  repairType: 'ALL',
  companyName: 'ALL',
  repairResult: 'ALL',
  search: ''
};

export function getEtLabReportRows(boards) {
  const allHistory = storage.getTable(TABLE_NAMES.ET_BOARD_HISTORY) || [];

  return boards.map(b => {
    const connectedMachine = b.currentMachineSerial ?
      etLabService.getMachineDetailsForBoard(b.currentMachineSerial) : null;
    const history = allHistory.filter(h => h.boardSerial === b.boardSerial).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Find latest removal
    const removeEvent = history.find(h => h.action === 'REMOVE' || (h.actionLabel && h.actionLabel.toLowerCase().includes('remove')));
    const removeDate = removeEvent ? (removeEvent.timestamp ? removeEvent.timestamp.split('T')[0] : '') : (b.removeDate || '—');

    // Repair history & stats
    const repairEvents = history.filter(h => h.action === 'INHOUSE_REPAIR' || h.action === 'SEND_OUTSIDE' || h.action === 'RECEIVE' || h.repairAttempt);
    const repairCount = repairEvents.length;
    const lastRepair = repairEvents[0];

    // Repair Type
    let repairType = '—';
    if (b.status === 'SENT_EXTERNAL' || b.externalRepair || (lastRepair && lastRepair.companyName)) {
      repairType = 'External';
    } else if (b.status === 'UNDER_INHOUSE_REPAIR' || b.inhouseRepair || (lastRepair && lastRepair.action === 'INHOUSE_REPAIR')) {
      repairType = 'In-House';
    }

    // External Company
    const externalCompany = b.externalRepair?.companyName || (lastRepair && lastRepair.companyName) || '—';

    // Send Date & Return Date
    const sendDate = b.externalRepair?.sendDate || (lastRepair && lastRepair.action === 'SEND_OUTSIDE' ? (lastRepair.timestamp ? lastRepair.timestamp.split('T')[0] : '') : '—');
    let returnDate = '—';
    const receiveEvent = history.find(h => h.action === 'RECEIVE');
    if (receiveEvent) {
      returnDate = receiveEvent.timestamp ? receiveEvent.timestamp.split('T')[0] : '';
    } else if (b.lastExternalRepair?.returnDate) {
      returnDate = b.lastExternalRepair.returnDate;
    }

    // Repair Result
    const repairResult = b.lastExternalRepair?.acceptanceStatus || (receiveEvent && receiveEvent.acceptanceStatus) || (lastRepair && (lastRepair.acceptanceStatus || lastRepair.repairResult)) || '—';

    return {
      boardSerial: b.boardSerial,
      partName: b.partName,
      modelNo: b.modelNo || '—',
      serialNo: b.jukiSlNo || b.slNo || '—',
      status: b.status,
      currentMachine: b.currentMachineSerial ? `🧵 ${b.currentMachineSerial}` : '— (In Stock)',
      machineSerial: connectedMachine ? connectedMachine.serialNumber : (b.currentMachineSerial || '—'),
      unitId: connectedMachine ? connectedMachine.unitId : '',
      unitName: connectedMachine ? connectedMachine.unitName : '—',
      floorId: connectedMachine ? connectedMachine.floorId : '',
      floorName: connectedMachine ? connectedMachine.floorName : '—',
      lineId: connectedMachine ? connectedMachine.lineId : '',
      lineName: connectedMachine ? connectedMachine.lineName : '—',
      installDate: b.installedDate || '—',
      removeDate: removeDate,
      repairType: repairType,
      externalCompany: externalCompany,
      sendDate: sendDate,
      returnDate: returnDate,
      repairResult: repairResult,
      repairCount: repairCount,
      previousBill: b.billNo ? 'YES' : 'NO',
      billNo: b.billNo || '',
      remarks: b.remarks || '—',
      comeDate: b.comeDate || ''
    };
  });
}

function filterEtLabReportRows(allRows) {
  return allRows.filter(r => {
    if (entReportFilterState.status !== 'ALL' && r.status !== entReportFilterState.status) return false;
    if (entReportFilterState.repairType !== 'ALL' && !r.repairType.toLowerCase().includes(entReportFilterState.repairType.toLowerCase())) return false;
    if (entReportFilterState.companyName !== 'ALL' && r.externalCompany !== entReportFilterState.companyName) return false;
    if (entReportFilterState.repairResult !== 'ALL' && !r.repairResult.toLowerCase().includes(entReportFilterState.repairResult.toLowerCase())) return false;
    if (entReportFilterState.unitId && r.unitId !== entReportFilterState.unitId) return false;
    if (entReportFilterState.floorId && r.floorId !== entReportFilterState.floorId) return false;
    if (entReportFilterState.lineId && r.lineId !== entReportFilterState.lineId) return false;

    if (entReportFilterState.dateFrom) {
      const dates = [r.installDate, r.removeDate, r.sendDate, r.returnDate, r.comeDate].filter(d => d && d !== '—');
      if (dates.length > 0 && !dates.some(d => d >= entReportFilterState.dateFrom)) return false;
    }
    if (entReportFilterState.dateTo) {
      const dates = [r.installDate, r.removeDate, r.sendDate, r.returnDate, r.comeDate].filter(d => d && d !== '—');
      if (dates.length > 0 && !dates.some(d => d <= entReportFilterState.dateTo)) return false;
    }

    if (entReportFilterState.boardSerial && !r.boardSerial.toLowerCase().includes(entReportFilterState.boardSerial.toLowerCase().trim()) && !r.serialNo.toLowerCase().includes(entReportFilterState.boardSerial.toLowerCase().trim())) return false;
    if (entReportFilterState.partName && !r.partName.toLowerCase().includes(entReportFilterState.partName.toLowerCase().trim())) return false;
    if (entReportFilterState.modelNo && !r.modelNo.toLowerCase().includes(entReportFilterState.modelNo.toLowerCase().trim())) return false;
    if (entReportFilterState.machineSerial && !r.currentMachine.toLowerCase().includes(entReportFilterState.machineSerial.toLowerCase().trim()) && !r.machineSerial.toLowerCase().includes(entReportFilterState.machineSerial.toLowerCase().trim())) return false;

    if (entReportFilterState.search) {
      const q = entReportFilterState.search.toLowerCase().trim();
      const match = r.boardSerial.toLowerCase().includes(q) ||
        r.partName.toLowerCase().includes(q) ||
        r.modelNo.toLowerCase().includes(q) ||
        r.serialNo.toLowerCase().includes(q) ||
        r.currentMachine.toLowerCase().includes(q) ||
        r.unitName.toLowerCase().includes(q) ||
        r.externalCompany.toLowerCase().includes(q) ||
        r.remarks.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });
}

function renderEtLabReportsTab(boards) {
  const kpi = etLabService.getGlobalStats();
  const allRows = getEtLabReportRows(boards);
  const filteredRows = filterEtLabReportRows(allRows);

  const units = storage.getTable(TABLE_NAMES.UNITS) || [];
  const floors = storage.getTable(TABLE_NAMES.FLOORS) || [];
  const lines = storage.getTable(TABLE_NAMES.LINES) || [];
  const companies = etLabService.getCompanies() || [];

  return `
    <div style="display: flex; flex-direction: column; gap: 6px; height: 100%; flex: 1; min-height: 0;">
      
      <!-- 1. Sleek Inline KPI Ribbon (Height 28px) -->
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px; background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: var(--radius-md); padding: 4px 10px; flex-shrink: 0;">
        <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
          <div style="display: inline-flex; align-items: center; gap: 4px; background: rgba(56, 189, 248, 0.12); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 4px; padding: 2px 8px; font-size: 11px;">
            <span style="font-weight: 700; color: #38bdf8;">MATCHING:</span>
            <span style="font-weight: 900; color: #fff; font-family: var(--font-mono); font-size: 12px;">${filteredRows.length} Units</span>
          </div>

          <div style="display: inline-flex; align-items: center; gap: 4px; background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 4px; padding: 2px 8px; font-size: 11px;">
            <span style="font-weight: 700; color: #34d399;">INSTALLED:</span>
            <span style="font-weight: 900; color: #34d399; font-family: var(--font-mono); font-size: 12px;">${filteredRows.filter(r => r.status === 'INSTALLED').length}</span>
          </div>

          <div style="display: inline-flex; align-items: center; gap: 4px; background: rgba(2, 132, 199, 0.12); border: 1px solid rgba(2, 132, 199, 0.3); border-radius: 4px; padding: 2px 8px; font-size: 11px;">
            <span style="font-weight: 700; color: #38bdf8;">SPARES:</span>
            <span style="font-weight: 900; color: #38bdf8; font-family: var(--font-mono); font-size: 12px;">${filteredRows.filter(r => r.status === 'AVAILABLE_SPARE' || r.status === 'REPAIR_ACCEPTED').length}</span>
          </div>

          <div style="display: inline-flex; align-items: center; gap: 4px; background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 4px; padding: 2px 8px; font-size: 11px;">
            <span style="font-weight: 700; color: #fbbf24;">IN-HOUSE REPAIR:</span>
            <span style="font-weight: 900; color: #fbbf24; font-family: var(--font-mono); font-size: 12px;">${filteredRows.filter(r => r.status === 'UNDER_INHOUSE_REPAIR' || r.status === 'REPAIR_REJECTED').length}</span>
          </div>

          <div style="display: inline-flex; align-items: center; gap: 4px; background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 4px; padding: 2px 8px; font-size: 11px;">
            <span style="font-weight: 700; color: #f87171;">EXTERNAL:</span>
            <span style="font-weight: 900; color: #f87171; font-family: var(--font-mono); font-size: 12px;">${filteredRows.filter(r => r.status === 'SENT_EXTERNAL').length}</span>
          </div>
        </div>

        <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
          <button id="btn-ent-rep-export-excel" class="btn btn-secondary btn-xs" style="font-weight: 700; border-color: #38bdf8; color: #38bdf8; height: 26px; font-size: 11px; padding: 0 8px;" title="Export filtered records to Excel">
            📊 Excel
          </button>
          <button id="btn-ent-rep-export-pdf" class="btn btn-secondary btn-xs" style="font-weight: 700; border-color: #ec4899; color: #f472b6; height: 26px; font-size: 11px; padding: 0 8px;" title="Export PDF document">
            📄 PDF
          </button>
          <button id="btn-ent-rep-print" class="btn btn-secondary btn-xs" style="font-weight: 700; border-color: #34d399; color: #34d399; height: 26px; font-size: 11px; padding: 0 8px;" title="Print Report">
            🖨️ Print
          </button>
          <button id="btn-ent-rep-apply-filters" class="btn btn-primary btn-xs" style="font-weight: 800; height: 26px; padding: 0 10px; font-size: 11px; background: linear-gradient(135deg, #0284c7, #0369a1);">
            🔍 Apply
          </button>
          <button id="btn-ent-rep-reset-filters" class="btn btn-ghost btn-xs" style="height: 26px; font-weight: 600; font-size: 11px; padding: 0 8px; color: #cbd5e1; border: 1px solid rgba(255,255,255,0.15);">
            🔄 Reset
          </button>
        </div>
      </div>

      <!-- 2. Compact High-Density Filters Grid -->
      <div style="background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: var(--radius-md); padding: 6px 10px; display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 6px; box-shadow: var(--shadow-sm); flex-shrink: 0;">
        
        <!-- Date From -->
        <div style="display: flex; flex-direction: column; gap: 2px;">
          <label style="font-size: 10px; font-weight: 700; color: #38bdf8;">📅 From:</label>
          <input type="date" id="ent-filter-date-from" class="form-control" style="height: 26px; font-size: 11px; padding: 2px 4px;" value="${entReportFilterState.dateFrom}" />
        </div>

        <!-- Date To -->
        <div style="display: flex; flex-direction: column; gap: 2px;">
          <label style="font-size: 10px; font-weight: 700; color: #38bdf8;">📅 To:</label>
          <input type="date" id="ent-filter-date-to" class="form-control" style="height: 26px; font-size: 11px; padding: 2px 4px;" value="${entReportFilterState.dateTo}" />
        </div>

        <!-- Board ID / SL No. -->
        <div style="display: flex; flex-direction: column; gap: 2px;">
          <label style="font-size: 10px; font-weight: 700; color: #cbd5e1;">Board ID / SL:</label>
          <input type="text" id="ent-filter-board-serial" class="form-control" placeholder="BRD-..., JUK-..." value="${entReportFilterState.boardSerial}" style="height: 26px; font-size: 11px; padding: 2px 6px;" />
        </div>

        <!-- Board Name -->
        <div style="display: flex; flex-direction: column; gap: 2px;">
          <label style="font-size: 10px; font-weight: 700; color: #cbd5e1;">Board Name:</label>
          <input type="text" id="ent-filter-part-name" class="form-control" placeholder="CPU, Power..." value="${entReportFilterState.partName}" style="height: 26px; font-size: 11px; padding: 2px 6px;" />
        </div>

        <!-- Model -->
        <div style="display: flex; flex-direction: column; gap: 2px;">
          <label style="font-size: 10px; font-weight: 700; color: #cbd5e1;">Model:</label>
          <input type="text" id="ent-filter-model" class="form-control" placeholder="CP-180A..." value="${entReportFilterState.modelNo}" style="height: 26px; font-size: 11px; padding: 2px 6px;" />
        </div>

        <!-- Machine -->
        <div style="display: flex; flex-direction: column; gap: 2px;">
          <label style="font-size: 10px; font-weight: 700; color: #cbd5e1;">Machine / Serial:</label>
          <input type="text" id="ent-filter-machine" class="form-control" placeholder="TS-01, JA-01..." value="${entReportFilterState.machineSerial}" style="height: 26px; font-size: 11px; padding: 2px 6px;" />
        </div>

        <!-- Unit / Factory -->
        <div style="display: flex; flex-direction: column; gap: 2px;">
          <label style="font-size: 10px; font-weight: 700; color: #cbd5e1;">Unit / Factory:</label>
          <select id="ent-filter-unit" class="form-control" style="height: 26px; font-size: 11px; padding: 2px 4px;">
            <option value="">All Units</option>
            ${units.map(u => `<option value="${u.id}" ${entReportFilterState.unitId === u.id ? 'selected' : ''}>${u.name}</option>`).join('')}
          </select>
        </div>

        <!-- Floor -->
        <div style="display: flex; flex-direction: column; gap: 2px;">
          <label style="font-size: 10px; font-weight: 700; color: #cbd5e1;">Floor:</label>
          <select id="ent-filter-floor" class="form-control" style="height: 26px; font-size: 11px; padding: 2px 4px;">
            <option value="">All Floors</option>
            ${floors.map(f => `<option value="${f.id}" ${entReportFilterState.floorId === f.id ? 'selected' : ''}>${f.name}</option>`).join('')}
          </select>
        </div>

        <!-- Line -->
        <div style="display: flex; flex-direction: column; gap: 2px;">
          <label style="font-size: 10px; font-weight: 700; color: #cbd5e1;">Line:</label>
          <select id="ent-filter-line" class="form-control" style="height: 26px; font-size: 11px; padding: 2px 4px;">
            <option value="">All Lines</option>
            ${lines.map(l => `<option value="${l.id}" ${entReportFilterState.lineId === l.id ? 'selected' : ''}>${l.name}</option>`).join('')}
          </select>
        </div>

        <!-- Status -->
        <div style="display: flex; flex-direction: column; gap: 2px;">
          <label style="font-size: 10px; font-weight: 700; color: #cbd5e1;">Current Status:</label>
          <select id="ent-filter-status" class="form-control" style="height: 26px; font-size: 11px; padding: 2px 4px;">
            <option value="ALL" ${entReportFilterState.status === 'ALL' ? 'selected' : ''}>All Statuses</option>
            <option value="INSTALLED" ${entReportFilterState.status === 'INSTALLED' ? 'selected' : ''}>🟢 Installed</option>
            <option value="AVAILABLE_SPARE" ${entReportFilterState.status === 'AVAILABLE_SPARE' ? 'selected' : ''}>🔵 Available / Spare</option>
            <option value="UNDER_INHOUSE_REPAIR" ${entReportFilterState.status === 'UNDER_INHOUSE_REPAIR' ? 'selected' : ''}>🟠 Under Repair</option>
            <option value="SENT_EXTERNAL" ${entReportFilterState.status === 'SENT_EXTERNAL' ? 'selected' : ''}>🔴 Sent Outside</option>
            <option value="RETURNED" ${entReportFilterState.status === 'RETURNED' ? 'selected' : ''}>🟣 Returned</option>
            <option value="DAMAGED_SCRAP" ${entReportFilterState.status === 'DAMAGED_SCRAP' ? 'selected' : ''}>❌ Damaged / Scrap</option>
          </select>
        </div>

        <!-- Repair Type -->
        <div style="display: flex; flex-direction: column; gap: 2px;">
          <label style="font-size: 10px; font-weight: 700; color: #cbd5e1;">Repair Type:</label>
          <select id="ent-filter-repair-type" class="form-control" style="height: 26px; font-size: 11px; padding: 2px 4px;">
            <option value="ALL" ${entReportFilterState.repairType === 'ALL' ? 'selected' : ''}>All Types</option>
            <option value="In-House" ${entReportFilterState.repairType === 'In-House' ? 'selected' : ''}>🛠️ In-House</option>
            <option value="External" ${entReportFilterState.repairType === 'External' ? 'selected' : ''}>🚚 External</option>
          </select>
        </div>

        <!-- External Company -->
        <div style="display: flex; flex-direction: column; gap: 2px;">
          <label style="font-size: 10px; font-weight: 700; color: #cbd5e1;">Company:</label>
          <select id="ent-filter-company" class="form-control" style="height: 26px; font-size: 11px; padding: 2px 4px;">
            <option value="ALL" ${entReportFilterState.companyName === 'ALL' ? 'selected' : ''}>All Companies</option>
            ${companies.map(c => `<option value="${c.name}" ${entReportFilterState.companyName === c.name ? 'selected' : ''}>${c.name}</option>`).join('')}
          </select>
        </div>

        <!-- Search -->
        <div style="display: flex; flex-direction: column; gap: 2px; grid-column: span 2;">
          <label style="font-size: 10px; font-weight: 700; color: #38bdf8;">🔍 Live Keyword Search:</label>
          <input type="text" id="ent-filter-search" class="form-control" placeholder="Search any board ID, name, machine, company, remarks..." value="${entReportFilterState.search}" style="height: 26px; font-size: 11px; padding: 2px 6px;" />
        </div>

      </div>

      <!-- 3. DATA REPORT TABLE (Flex 1, Maximize Viewport) -->
      <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); overflow: hidden; display: flex; flex-direction: column; flex: 1; min-height: 0;">
        <div style="padding: 5px 12px; background: rgba(15, 23, 42, 0.9); border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px; flex-shrink: 0;">
          <div style="font-weight: 800; font-size: 12px; color: #38bdf8; display: flex; align-items: center; gap: 6px;">
            <span>📊 ENT Lab Master &amp; Movement Report</span>
            <span class="badge badge-info" style="font-size: 10px; padding: 1px 5px;">${filteredRows.length} Boards</span>
          </div>
          <div style="font-size: 10.5px; color: var(--text-muted);">
            Machine connection, installation, external repairs, verification &amp; turnaround
          </div>
        </div>

        <div class="table-responsive" style="flex: 1; min-height: 0; overflow-y: auto;">
          <table class="data-table" style="width: 100%; border-collapse: collapse; font-size: 11px;">
            <thead>
              <tr style="background: rgba(15, 23, 42, 0.95); border-bottom: 1px solid var(--border-color); font-size: 10px; text-transform: uppercase; color: #94a3b8; position: sticky; top: 0; z-index: 2; white-space: nowrap;">
                <th style="padding: 6px 8px; text-align: center; width: 30px;">Sl</th>
                <th style="padding: 6px 8px; text-align: left;">Board / Item ID</th>
                <th style="padding: 6px 8px; text-align: left;">Board Name</th>
                <th style="padding: 6px 8px; text-align: left;">Model</th>
                <th style="padding: 6px 8px; text-align: left;">Serial No.</th>
                <th style="padding: 6px 8px; text-align: center;">Status</th>
                <th style="padding: 6px 8px; text-align: left;">Current Machine</th>
                <th style="padding: 6px 8px; text-align: left;">Machine Serial</th>
                <th style="padding: 6px 8px; text-align: left;">Unit / Factory</th>
                <th style="padding: 6px 8px; text-align: left;">Floor</th>
                <th style="padding: 6px 8px; text-align: left;">Line</th>
                <th style="padding: 6px 8px; text-align: left;">Install Date</th>
                <th style="padding: 6px 8px; text-align: left;">Remove Date</th>
                <th style="padding: 6px 8px; text-align: left;">Repair Type</th>
                <th style="padding: 6px 8px; text-align: left;">External Company</th>
                <th style="padding: 6px 8px; text-align: left;">Send Date</th>
                <th style="padding: 6px 8px; text-align: left;">Return Date</th>
                <th style="padding: 6px 8px; text-align: left;">Repair Result</th>
                <th style="padding: 6px 8px; text-align: center;">Repairs</th>
                <th style="padding: 6px 8px; text-align: center;">Bill</th>
                <th style="padding: 6px 8px; text-align: left;">Remarks</th>
              </tr>
            </thead>
            <tbody>
              ${filteredRows.length === 0 ? `
                <tr><td colspan="21" style="text-align: center; padding: 24px; color: var(--text-muted);">No records found matching the specified report filters.</td></tr>
              ` : filteredRows.map((r, idx) => {
                let resultBadge = '—';
                if (r.repairResult && r.repairResult !== '—') {
                  if (r.repairResult.includes('Accepted')) {
                    resultBadge = `<span style="background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid #10b981; font-size: 9.5px; font-weight: 800; padding: 1px 5px; border-radius: 3px;">✅ Accepted</span>`;
                  } else if (r.repairResult.includes('Rejected') || r.repairResult.includes('Not Successful')) {
                    resultBadge = `<span style="background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid #ef4444; font-size: 9.5px; font-weight: 800; padding: 1px 5px; border-radius: 3px;">❌ Rejected</span>`;
                  } else if (r.repairResult.includes('Partially')) {
                    resultBadge = `<span style="background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid #f59e0b; font-size: 9.5px; font-weight: 800; padding: 1px 5px; border-radius: 3px;">⚠️ Partial</span>`;
                  } else if (r.repairResult.includes('Send Again')) {
                    resultBadge = `<span style="background: rgba(168, 85, 247, 0.2); color: #c084fc; border: 1px solid #a855f7; font-size: 9.5px; font-weight: 800; padding: 1px 5px; border-radius: 3px;">🔄 Send Again</span>`;
                  } else {
                    resultBadge = `<span style="font-size: 10px; color: #cbd5e1;">${r.repairResult}</span>`;
                  }
                }

                return `
                  <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);" class="hover-row">
                    <td style="padding: 5px 8px; text-align: center; color: var(--text-muted); font-size: 10.5px;">${idx + 1}</td>
                    <td style="padding: 5px 8px; font-family: var(--font-mono); font-weight: 800; color: #38bdf8; white-space: nowrap; font-size: 10.5px;">${r.boardSerial}</td>
                    <td style="padding: 5px 8px; font-weight: 700; color: #fff; white-space: nowrap; font-size: 10.5px;">${r.partName}</td>
                    <td style="padding: 5px 8px; font-family: var(--font-mono); color: #cbd5e1; white-space: nowrap; font-size: 10.5px;">${r.modelNo}</td>
                    <td style="padding: 5px 8px; font-family: var(--font-mono); color: #cbd5e1; white-space: nowrap; font-size: 10.5px;">${r.serialNo}</td>
                    <td style="padding: 5px 8px; text-align: center; white-space: nowrap;">
                      <span class="badge ${r.status === 'INSTALLED' ? 'badge-info' : r.status === 'AVAILABLE_SPARE' ? 'badge-active' : 'badge-warning'}" style="font-size: 9.5px; padding: 1px 5px;">
                        ${r.status}
                      </span>
                    </td>
                    <td style="padding: 5px 8px; font-family: var(--font-mono); font-weight: 700; color: #38bdf8; white-space: nowrap; font-size: 10.5px;">${r.currentMachine}</td>
                    <td style="padding: 5px 8px; font-family: var(--font-mono); color: #cbd5e1; white-space: nowrap; font-size: 10.5px;">${r.machineSerial}</td>
                    <td style="padding: 5px 8px; color: #cbd5e1; white-space: nowrap; font-size: 10.5px;">${r.unitName}</td>
                    <td style="padding: 5px 8px; color: #cbd5e1; white-space: nowrap; font-size: 10.5px;">${r.floorName}</td>
                    <td style="padding: 5px 8px; color: #86efac; font-weight: 600; white-space: nowrap; font-size: 10.5px;">${r.lineName}</td>
                    <td style="padding: 5px 8px; font-family: var(--font-mono); color: #86efac; white-space: nowrap; font-size: 10.5px;">${r.installDate}</td>
                    <td style="padding: 5px 8px; font-family: var(--font-mono); color: #f87171; white-space: nowrap; font-size: 10.5px;">${r.removeDate}</td>
                    <td style="padding: 5px 8px; color: #cbd5e1; white-space: nowrap; font-size: 10.5px;">${r.repairType}</td>
                    <td style="padding: 5px 8px; color: #c084fc; font-weight: 600; white-space: nowrap; font-size: 10.5px;">${r.externalCompany}</td>
                    <td style="padding: 5px 8px; font-family: var(--font-mono); color: #fbbf24; white-space: nowrap; font-size: 10.5px;">${r.sendDate}</td>
                    <td style="padding: 5px 8px; font-family: var(--font-mono); color: #34d399; white-space: nowrap; font-size: 10.5px;">${r.returnDate}</td>
                    <td style="padding: 5px 8px; white-space: nowrap;">${resultBadge}</td>
                    <td style="padding: 5px 8px; text-align: center; font-family: var(--font-mono); font-weight: 800; color: #fbbf24; font-size: 10.5px;">${r.repairCount}</td>
                    <td style="padding: 5px 8px; text-align: center; white-space: nowrap;">
                      ${r.previousBill === 'YES' ? `
                        <span style="background: rgba(239,68,68,0.2); color: #fca5a5; font-family: var(--font-mono); padding: 1px 4px; border-radius: 3px; font-weight: 700; font-size: 9.5px;" title="Bill: ${r.billNo}">
                          ⚠️ YES
                        </span>
                      ` : `
                        <span style="color: #34d399; font-size: 10px; font-weight: 600;">NO</span>
                      `}
                    </td>
                    <td style="padding: 5px 8px; color: #94a3b8; font-size: 10.5px; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${r.remarks}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `;
}

let machineReportFilterState = {
  groupId: '',
  unitId: '',
  floorId: '',
  lineId: '',
  status: 'ALL'
};

// Helper function to extract and aggregate Machine Inventory into Machine Name -> Model grouped structure
export function getMachineSummaryGroupedData(allMachines) {
  const groups = storage.getTable(TABLE_NAMES.GROUPS) || [];
  const units = storage.getTable(TABLE_NAMES.UNITS) || [];
  const floors = storage.getTable(TABLE_NAMES.FLOORS) || [];
  const lines = storage.getTable(TABLE_NAMES.LINES) || [];
  const machineNames = storage.getTable(TABLE_NAMES.MACHINE_NAMES) || [];
  const brands = storage.getTable(TABLE_NAMES.BRANDS) || [];
  const models = storage.getTable(TABLE_NAMES.MODELS) || [];
  const storageMaster = storage.getTable(TABLE_NAMES.STORAGE_MASTER) || [];

  const grpMap = new Map(groups.map(g => [g.id, g]));
  const untMap = new Map(units.map(u => [u.id, u]));
  const flrMap = new Map(floors.map(f => [f.id, f]));
  const linMap = new Map(lines.map(l => [l.id, l]));

  // Build high-resilience Machine Name Map (storage table -> INITIAL_DATA fallback)
  const mnMap = new Map();
  if (typeof INITIAL_DATA !== 'undefined' && Array.isArray(INITIAL_DATA.machine_names)) {
    INITIAL_DATA.machine_names.forEach(mn => {
      if (mn && mn.id && mn.name) mnMap.set(mn.id, mn.name);
    });
  }
  machineNames.forEach(mn => {
    if (mn && mn.id && mn.name) mnMap.set(mn.id, mn.name);
  });

  // Build high-resilience Brand Map (storage table -> INITIAL_DATA fallback)
  const brdMap = new Map();
  if (typeof INITIAL_DATA !== 'undefined' && Array.isArray(INITIAL_DATA.brands)) {
    INITIAL_DATA.brands.forEach(b => {
      if (b && b.id && b.name) brdMap.set(b.id, b.name);
    });
  }
  brands.forEach(b => {
    if (b && b.id && b.name) brdMap.set(b.id, b.name);
  });

  // Build high-resilience Model Map (storage table -> INITIAL_DATA -> STORAGE_MASTER fallback)
  const mdlMap = new Map();
  if (typeof INITIAL_DATA !== 'undefined' && Array.isArray(INITIAL_DATA.models)) {
    INITIAL_DATA.models.forEach(m => {
      if (m && m.id && m.name) mdlMap.set(m.id, m.name);
    });
  }
  models.forEach(m => {
    if (m && m.id && m.name) mdlMap.set(m.id, m.name);
  });
  storageMaster.forEach(sm => {
    if (sm && sm.category === 'MACHINE' && sm.id && sm.model) {
      if (!mdlMap.has(sm.id)) mdlMap.set(sm.id, sm.model);
    }
  });

  // Resolve hierarchy for filtering
  function resolveHierarchy(m) {
    let line = linMap.get(m.lineId) || null;
    let floor = flrMap.get(m.floorId) || (line ? flrMap.get(line.floorId) : null);
    let unit = untMap.get(m.unitId) || (floor ? untMap.get(floor.unitId) : null);
    let group = grpMap.get(m.groupId) || (unit ? grpMap.get(unit.groupId) : null);

    return {
      groupId: group?.id || m.groupId || '',
      unitId: unit?.id || m.unitId || '',
      floorId: floor?.id || m.floorId || '',
      lineId: line?.id || m.lineId || ''
    };
  }

  // 1. Filter machines by selected Location (Group -> Unit -> Floor -> Line) and Status
  const filteredMachines = allMachines.filter(m => {
    const h = resolveHierarchy(m);
    if (machineReportFilterState.groupId && h.groupId !== machineReportFilterState.groupId) return false;
    if (machineReportFilterState.unitId && h.unitId !== machineReportFilterState.unitId) return false;
    if (machineReportFilterState.floorId && h.floorId !== machineReportFilterState.floorId) return false;
    if (machineReportFilterState.lineId && h.lineId !== machineReportFilterState.lineId) return false;
    if (machineReportFilterState.status !== 'ALL' && m.status !== machineReportFilterState.status) return false;
    return true;
  });

  let grandTotalRunning = 0;
  let grandTotalUsableIdle = 0;
  let grandTotalRepairableIdle = 0;
  let grandTotal = 0;

  const machineNameGroupsMap = new Map();

  // 2. Aggregate counts dynamically into Machine Name -> Model
  filteredMachines.forEach(m => {
    // Resolve Machine Name & Model with multi-tier fallback
    let rawMachName = (mnMap.get(m.machineNameId) || m.machineName || m.name || brdMap.get(m.brandId) || (m.brand ? m.brand + ' Machine' : '') || 'Plane Machine').trim();
    let rawModel = (mdlMap.get(m.modelId) || m.model || m.modelName || 'Standard').trim();

    const r = parseInt(m.running ?? m.qty_running ?? (m.status === 'ACTIVE' ? (m.quantity ?? 1) : 0), 10) || 0;
    const u = parseInt(m.usable_idle ?? m.usableIdle ?? (m.status === 'IDLE' ? (m.quantity ?? 1) : 0), 10) || 0;
    const rp = parseInt(m.repairable_idle ?? m.repairableIdle ?? ((m.status === 'MAINTENANCE' || m.status === 'BREAKDOWN' || m.status === 'UNDER_MAINTENANCE') ? (m.quantity ?? 1) : 0), 10) || 0;
    const tot = r + u + rp;

    grandTotalRunning += r;
    grandTotalUsableIdle += u;
    grandTotalRepairableIdle += rp;
    grandTotal += tot;

    const groupKey = rawMachName.toLowerCase();
    if (!machineNameGroupsMap.has(groupKey)) {
      machineNameGroupsMap.set(groupKey, {
        machineName: rawMachName,
        running: 0,
        usableIdle: 0,
        repairableIdle: 0,
        total: 0,
        modelsMap: new Map()
      });
    }

    const grp = machineNameGroupsMap.get(groupKey);
    grp.running += r;
    grp.usableIdle += u;
    grp.repairableIdle += rp;
    grp.total += tot;

    const modelKey = rawModel.toLowerCase();
    if (!grp.modelsMap.has(modelKey)) {
      grp.modelsMap.set(modelKey, {
        model: rawModel,
        running: 0,
        usableIdle: 0,
        repairableIdle: 0,
        total: 0
      });
    }

    const mod = grp.modelsMap.get(modelKey);
    mod.running += r;
    mod.usableIdle += u;
    mod.repairableIdle += rp;
    mod.total += tot;
  });

  // Lookup sequential sortOrder from MACHINE_NAMES, MODELS, and STORAGE_MASTER
  const mnTable = storage.getTable(TABLE_NAMES.MACHINE_NAMES) || [];
  const mnOrderMap = new Map();
  mnTable.forEach((mn, idx) => {
    if (mn && mn.name) {
      const order = (mn.sortOrder !== undefined && mn.sortOrder !== null) ? Number(mn.sortOrder) : (idx + 1);
      mnOrderMap.set(mn.name.trim().toLowerCase(), order);
    }
  });

  const mdlTable = storage.getTable(TABLE_NAMES.MODELS) || [];
  const mdlOrderMap = new Map();
  mdlTable.forEach((mdl, idx) => {
    if (mdl && mdl.name) {
      const order = (mdl.sortOrder !== undefined && mdl.sortOrder !== null) ? Number(mdl.sortOrder) : (idx + 1);
      const key = `${(mdl.machineName || '').trim().toLowerCase()}:::${mdl.name.trim().toLowerCase()}`;
      mdlOrderMap.set(key, order);
      mdlOrderMap.set(mdl.name.trim().toLowerCase(), order);
    }
  });

  const smTable = storage.getTable(TABLE_NAMES.STORAGE_MASTER) || [];
  smTable.forEach((sm, idx) => {
    if (sm && sm.model) {
      const order = (sm.sortOrder !== undefined && sm.sortOrder !== null) ? Number(sm.sortOrder) : (idx + 1);
      const key = `${(sm.machineName || '').trim().toLowerCase()}:::${sm.model.trim().toLowerCase()}`;
      if (!mdlOrderMap.has(key)) mdlOrderMap.set(key, order);
      if (!mdlOrderMap.has(sm.model.trim().toLowerCase())) mdlOrderMap.set(sm.model.trim().toLowerCase(), order);
    }
  });

  // Convert to strictly sorted array of groups and models (Fixed Serial Sequence)
  let groupedList = Array.from(machineNameGroupsMap.values()).map(grp => {
    const machKey = grp.machineName.toLowerCase();
    const grpOrder = mnOrderMap.has(machKey) ? mnOrderMap.get(machKey) : 9999;

    const models = Array.from(grp.modelsMap.values()).sort((a, b) => {
      const keyA = `${machKey}:::${a.model.toLowerCase()}`;
      const keyB = `${machKey}:::${b.model.toLowerCase()}`;
      const ordA = mdlOrderMap.has(keyA) ? mdlOrderMap.get(keyA) : (mdlOrderMap.has(a.model.toLowerCase()) ? mdlOrderMap.get(a.model.toLowerCase()) : 9999);
      const ordB = mdlOrderMap.has(keyB) ? mdlOrderMap.get(keyB) : (mdlOrderMap.has(b.model.toLowerCase()) ? mdlOrderMap.get(b.model.toLowerCase()) : 9999);
      if (ordA !== ordB) return ordA - ordB;
      return a.model.localeCompare(b.model);
    }).map((m, mIdx) => ({
      ...m,
      serialNo: mIdx + 1
    }));

    return {
      machineName: grp.machineName,
      sortOrder: grpOrder,
      running: grp.running,
      usableIdle: grp.usableIdle,
      repairableIdle: grp.repairableIdle,
      total: grp.total,
      models
    };
  });

  // Sort groups strictly by their fixed sequential order (sortOrder), NEVER scramble by total!
  groupedList.sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.machineName.localeCompare(b.machineName);
  });

  // Assign fixed 1-based serial number to machine groups
  groupedList = groupedList.map((g, idx) => ({
    ...g,
    serialNo: idx + 1
  }));

  return {
    filteredMachines,
    groupedList,
    grandTotals: {
      running: grandTotalRunning,
      usableIdle: grandTotalUsableIdle,
      repairableIdle: grandTotalRepairableIdle,
      total: grandTotal
    },
    lookups: { grpMap, untMap, flrMap, linMap, groups, units, floors, lines }
  };
}

// 1. MACHINE SUMMARY TAB – Dynamic Grouped Layout (Machine Name -> Model)
function renderMachineReportsTab(allMachines) {
  const { groupedList, grandTotals, lookups } = getMachineSummaryGroupedData(allMachines);
  const { grpMap, untMap, flrMap, linMap, groups, units, floors, lines } = lookups;

  // Available cascading dropdown options based on current selection
  const availUnits = units.filter(u => !machineReportFilterState.groupId || u.groupId === machineReportFilterState.groupId);
  const availUnitIds = new Set(availUnits.map(u => u.id));
  const availFloors = floors.filter(f => {
    if (machineReportFilterState.unitId) return f.unitId === machineReportFilterState.unitId;
    if (machineReportFilterState.groupId) return availUnitIds.has(f.unitId);
    return true;
  });
  const availFloorIds = new Set(availFloors.map(f => f.id));
  const availLines = lines.filter(l => {
    if (machineReportFilterState.lineId && l.id === machineReportFilterState.lineId) return true;
    if (machineReportFilterState.floorId) return l.floorId === machineReportFilterState.floorId;
    if (machineReportFilterState.unitId || machineReportFilterState.groupId) return availFloorIds.has(l.floorId);
    return true;
  });

  // Active location label
  const currentGroup = grpMap.get(machineReportFilterState.groupId);
  const currentUnit = untMap.get(machineReportFilterState.unitId);
  const currentFloor = flrMap.get(machineReportFilterState.floorId);
  const currentLine = linMap.get(machineReportFilterState.lineId);

  let locationBadgeTitle = 'All Enterprise (All Groups & Units)';
  if (currentLine) {
    locationBadgeTitle = `Line: ${currentLine.name} (${currentFloor?.name || ''}, ${currentUnit?.name || ''})`;
  } else if (currentFloor) {
    locationBadgeTitle = `Floor: ${currentFloor.name} (${currentUnit?.name || ''})`;
  } else if (currentUnit) {
    locationBadgeTitle = `Unit/Factory: ${currentUnit.name} (${currentGroup?.name || ''})`;
  } else if (currentGroup) {
    locationBadgeTitle = `Group: ${currentGroup.name}`;
  }

  // Active operational rate
  const activeRate = grandTotals.total > 0 ? Math.round((grandTotals.running / grandTotals.total) * 100) : 0;

  // Build Grouped Table Body Rows with merged Sl. column per Machine category
  let tableBodyHtml = '';
  if (groupedList.length === 0) {
    tableBodyHtml = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 24px; color: var(--text-muted);">
          No machines found matching the selected location or filters.
        </td>
      </tr>
    `;
  } else {
    tableBodyHtml = groupedList.map((group, groupIdx) => {
      const modelCount = group.models.length;
      const serialNum = groupIdx + 1;
      return group.models.map((mod, idx) => {
        const isFirstRow = idx === 0;
        return `
          <tr class="${isFirstRow ? 'mach-group-first-row' : ''}">
            ${isFirstRow ? `
              <td rowspan="${modelCount}" class="mach-group-cell" style="text-align: center; font-family: var(--font-mono); font-weight: 800; color: #94a3b8; font-size: 12px; border-right: 1px solid var(--border-color); vertical-align: middle;">
                ${serialNum}
              </td>
              <td rowspan="${modelCount}" class="mach-group-cell">
                <div class="mach-group-title" style="display: flex; align-items: center;">
                  <span><strong>${group.machineName}</strong></span>
                </div>
              </td>
            ` : ''}
            <td class="mach-model-name" style="border-right: 1px solid var(--border-color); vertical-align: middle;">
              ${mod.model}
            </td>
            <td class="mach-num-cell mach-num-running" style="text-align: center; border-right: 1px solid var(--border-color); font-size: 12px;">${mod.running}</td>
            <td class="mach-num-cell mach-num-usable" style="text-align: center; border-right: 1px solid var(--border-color); font-size: 12px;">${mod.usableIdle}</td>
            <td class="mach-num-cell mach-num-repair" style="text-align: center; border-right: 1px solid var(--border-color); font-size: 12px;">${mod.repairableIdle}</td>
            <td class="mach-num-cell mach-num-total" style="text-align: center; border-right: 1.5px solid var(--border-color); font-size: 12px;">${mod.total}</td>
            ${isFirstRow ? `
              <td rowspan="${modelCount}" class="mach-group-cell mach-num-cell" style="text-align: center; vertical-align: middle; font-weight: 800; font-size: 13px; color: #38bdf8; border-left: 1.5px solid var(--border-color);">
                ${group.total}
              </td>
            ` : ''}
          </tr>
        `;
      }).join('');
    }).join('');
  }

  return `
    <div style="display: flex; flex-direction: column; gap: 6px; height: 100%; flex: 1; min-height: 0;">
      
      <!-- 1. Ultra Compact Filter Toolbar -->
      <div class="reports-filter-toolbar" style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 6px 10px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px; box-shadow: var(--shadow-sm); flex-shrink: 0;">
        
        <!-- Filter Controls -->
        <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap; flex: 1; min-width: 0;">
          <span style="font-size: 11px; font-weight: 800; color: #38bdf8; text-transform: uppercase; white-space: nowrap;">
            📍 Filters:
          </span>

          <!-- Group Filter -->
          <select id="mr-filter-group" class="form-control" style="height: 28px; font-size: 11.5px; font-weight: 600; color: #fff; background: rgba(15, 23, 42, 0.85); border: 1px solid var(--border-color); border-radius: 4px; padding: 2px 6px; min-width: 110px; max-width: 140px;">
            <option value="" style="background: #0f172a; color: #fff;">All Groups (${groups.length})</option>
            ${groups.map(g => `<option value="${g.id}" ${machineReportFilterState.groupId === g.id ? 'selected' : ''} style="background: #0f172a; color: #fff;">${g.name}</option>`).join('')}
          </select>

          <!-- Unit Filter -->
          <select id="mr-filter-unit" class="form-control" style="height: 28px; font-size: 11.5px; font-weight: 600; color: #fff; background: rgba(15, 23, 42, 0.85); border: 1px solid var(--border-color); border-radius: 4px; padding: 2px 6px; min-width: 110px; max-width: 140px;">
            <option value="" style="background: #0f172a; color: #fff;">All Units (${availUnits.length})</option>
            ${availUnits.map(u => `<option value="${u.id}" ${machineReportFilterState.unitId === u.id ? 'selected' : ''} style="background: #0f172a; color: #fff;">${u.name}</option>`).join('')}
          </select>

          <!-- Floor Filter -->
          <select id="mr-filter-floor" class="form-control" style="height: 28px; font-size: 11.5px; font-weight: 600; color: #fff; background: rgba(15, 23, 42, 0.85); border: 1px solid var(--border-color); border-radius: 4px; padding: 2px 6px; min-width: 110px; max-width: 140px;">
            <option value="" style="background: #0f172a; color: #fff;">All Floors (${availFloors.length})</option>
            ${availFloors.map(f => `<option value="${f.id}" ${machineReportFilterState.floorId === f.id ? 'selected' : ''} style="background: #0f172a; color: #fff;">${f.name}</option>`).join('')}
          </select>

          <!-- Line Filter -->
          <select id="mr-filter-line" class="form-control" style="height: 28px; font-size: 11.5px; font-weight: 600; color: #fff; background: rgba(15, 23, 42, 0.85); border: 1px solid var(--border-color); border-radius: 4px; padding: 2px 6px; min-width: 110px; max-width: 140px;">
            <option value="" style="background: #0f172a; color: #fff;">All Lines (${availLines.length})</option>
            ${availLines.map(l => {
              const clean = formatDisplayLine(l.name);
              const label = clean !== l.name ? `Line ${clean} (${l.name})` : l.name;
              return `<option value="${l.id}" ${machineReportFilterState.lineId === l.id ? 'selected' : ''} style="background: #0f172a; color: #fff;">${label}</option>`;
            }).join('')}
          </select>

          <!-- Status Filter -->
          <select id="mr-filter-status" class="form-control" style="height: 28px; font-size: 11.5px; font-weight: 600; color: #fff; background: rgba(15, 23, 42, 0.85); border: 1px solid var(--border-color); border-radius: 4px; padding: 2px 6px; min-width: 100px; max-width: 120px;">
            <option value="ALL" ${machineReportFilterState.status === 'ALL' ? 'selected' : ''} style="background: #0f172a; color: #fff;">All Status</option>
            <option value="ACTIVE" ${machineReportFilterState.status === 'ACTIVE' ? 'selected' : ''} style="background: #0f172a; color: #fff;">🟢 Active</option>
            <option value="IDLE" ${machineReportFilterState.status === 'IDLE' ? 'selected' : ''} style="background: #0f172a; color: #fff;">🔵 Idle</option>
            <option value="MAINTENANCE" ${machineReportFilterState.status === 'MAINTENANCE' ? 'selected' : ''} style="background: #0f172a; color: #fff;">🟡 Maintenance</option>
            <option value="BREAKDOWN" ${machineReportFilterState.status === 'BREAKDOWN' ? 'selected' : ''} style="background: #0f172a; color: #fff;">🔴 Breakdown</option>
          </select>

          <!-- Reset Filters -->
          <button id="mr-btn-reset-filters" class="btn btn-ghost btn-xs" style="height: 28px; padding: 0 8px; font-size: 11px; font-weight: 700; color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.35); background: rgba(2, 132, 199, 0.1); border-radius: 4px; white-space: nowrap;" title="Reset all location and status filters">
            ↺ Reset
          </button>
        </div>

        <!-- Action Tools (Excel & Print) -->
        <div style="display: flex; gap: 6px; align-items: center; flex-shrink: 0;">
          <button id="btn-export-machine-report-excel" class="btn btn-primary btn-xs" style="font-weight: 800; background: linear-gradient(135deg, #0284c7, #0369a1); height: 28px; padding: 0 10px; white-space: nowrap; border-radius: 4px; font-size: 11.5px; display: inline-flex; align-items: center; gap: 4px;">
            <span>📊</span> Export Excel
          </button>
          <button id="btn-print-machine-report-pdf" class="btn btn-secondary btn-xs" style="font-weight: 700; height: 28px; padding: 0 10px; white-space: nowrap; border-radius: 4px; font-size: 11.5px; display: inline-flex; align-items: center; gap: 4px;">
            <span>🖨️</span> Print / PDF
          </button>
        </div>

      </div>

      <!-- 2. Consolidated Breadcrumb & High-Density KPI Ribbon (Takes only 28px height) -->
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px; background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(56, 189, 248, 0.2); border-radius: var(--radius-md); padding: 4px 10px; flex-shrink: 0;">
        
        <!-- Breadcrumbs & Scope -->
        <div style="font-size: 11px; color: var(--text-secondary); display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">
          <a href="javascript:void(0)" class="mr-crumb-link" data-level="all" style="color: #38bdf8; font-weight: 700; text-decoration: none;">🏠 All Groups</a>
          ${currentGroup ? `
            <span style="color: #64748b;">❯</span>
            <a href="javascript:void(0)" class="mr-crumb-link" data-level="group" data-id="${currentGroup.id}" style="color: #38bdf8; font-weight: 700; text-decoration: none;">🏢 ${currentGroup.name}</a>
          ` : ''}
          ${currentUnit ? `
            <span style="color: #64748b;">❯</span>
            <a href="javascript:void(0)" class="mr-crumb-link" data-level="unit" data-id="${currentUnit.id}" style="color: #38bdf8; font-weight: 700; text-decoration: none;">🏭 ${currentUnit.name}</a>
          ` : ''}
          ${currentFloor ? `
            <span style="color: #64748b;">❯</span>
            <a href="javascript:void(0)" class="mr-crumb-link" data-level="floor" data-id="${currentFloor.id}" style="color: #38bdf8; font-weight: 700; text-decoration: none;">🏬 ${currentFloor.name}</a>
          ` : ''}
          ${currentLine ? `
            <span style="color: #64748b;">❯</span>
            <span style="color: #fff; font-weight: 800;">🧵 ${currentLine.name}</span>
          ` : ''}
        </div>

        <!-- Metric Pills Strip -->
        <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
          <div style="display: inline-flex; align-items: center; gap: 4px; background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(52, 211, 153, 0.35); border-radius: 4px; padding: 2px 8px; font-size: 11px;" title="Operational running machines">
            <span style="font-weight: 800; color: #34d399;">RUNNING:</span>
            <span style="font-weight: 900; color: #34d399; font-family: var(--font-mono); font-size: 12.5px;">${grandTotals.running}</span>
            <span style="font-size: 10px; color: #a7f3d0;">(${activeRate}%)</span>
          </div>

          <div style="display: inline-flex; align-items: center; gap: 4px; background: rgba(2, 132, 199, 0.12); border: 1px solid rgba(56, 189, 248, 0.35); border-radius: 4px; padding: 2px 8px; font-size: 11px;" title="Standby idle machines ready for lines">
            <span style="font-weight: 800; color: #38bdf8;">USABLE IDLE:</span>
            <span style="font-weight: 900; color: #38bdf8; font-family: var(--font-mono); font-size: 12.5px;">${grandTotals.usableIdle}</span>
          </div>

          <div style="display: inline-flex; align-items: center; gap: 4px; background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(251, 191, 36, 0.35); border-radius: 4px; padding: 2px 8px; font-size: 11px;" title="Under scheduled servicing or repair">
            <span style="font-weight: 800; color: #fbbf24;">REPAIRABLE:</span>
            <span style="font-weight: 900; color: #fbbf24; font-family: var(--font-mono); font-size: 12.5px;">${grandTotals.repairableIdle}</span>
          </div>

          <div style="display: inline-flex; align-items: center; gap: 4px; background: rgba(56, 189, 248, 0.18); border: 1.5px solid #38bdf8; border-radius: 4px; padding: 2px 8px; font-size: 11px;" title="Total machine asset fleet">
            <span style="font-weight: 800; color: #e2e8f0;">TOTAL:</span>
            <span style="font-weight: 900; color: #fff; font-family: var(--font-mono); font-size: 13px;">${grandTotals.total}</span>
          </div>
        </div>

      </div>

      <!-- 3. Dynamic Grouped Machine Summary Data Grid (Flex 1, Maximize Viewport) -->
      <div id="mr-table-container" style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); overflow: hidden; box-shadow: var(--shadow-sm); display: flex; flex-direction: column; flex: 1; min-height: 0;">
        <div style="padding: 6px 12px; border-bottom: 1px solid var(--border-color); background: #0b1329; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px; flex-shrink: 0;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-weight: 800; color: #fff; font-size: 12.5px;">📊 Machine Summary Report</span>
            <span style="font-size: 11px; color: #38bdf8;">(${groupedList.length} Machine Types)</span>
          </div>
          <span style="font-size: 11px; color: #94a3b8;">${locationBadgeTitle}</span>
        </div>

        <div class="responsive-table-wrapper" style="flex: 1; min-height: 0; overflow-y: auto;">
          <table class="mach-summary-table">
            <thead>
              <tr>
                <th style="width: 5%; text-align: center;">Sl.</th>
                <th style="width: 24%; text-align: left;">Machine Name</th>
                <th style="width: 23%; text-align: left;">Model</th>
                <th style="width: 10%; text-align: center; color: #34d399;">Running</th>
                <th style="width: 10%; text-align: center; color: #38bdf8;">Usable Idle</th>
                <th style="width: 10%; text-align: center; color: #fbbf24;">Repairable Idle</th>
                <th style="width: 9%; text-align: center; color: #ffffff;">Total</th>
                <th style="width: 9%; text-align: center; color: #38bdf8;">Grand Total</th>
              </tr>
            </thead>
            <tbody>
              ${tableBodyHtml}
            </tbody>
            <tfoot>
              <tr>
                <td style="color: var(--text-muted); font-weight: 700; text-align: center;">—</td>
                <td style="color: #ffffff; font-weight: 800; text-align: left;">GRAND TOTAL</td>
                <td style="color: var(--text-muted); font-weight: 700; text-align: center;">—</td>
                <td class="mach-num-cell mach-num-running" style="font-size: 13px; font-weight: 800; text-align: center;">${grandTotals.running}</td>
                <td class="mach-num-cell mach-num-usable" style="font-size: 13px; font-weight: 800; text-align: center;">${grandTotals.usableIdle}</td>
                <td class="mach-num-cell mach-num-repair" style="font-size: 13px; font-weight: 800; text-align: center;">${grandTotals.repairableIdle}</td>
                <td class="mach-num-cell mach-num-total" style="font-size: 13px; font-weight: 800; text-align: center;">${grandTotals.total}</td>
                <td class="mach-num-cell mach-num-total" style="font-size: 13.5px; color: #38bdf8; font-weight: 800; text-align: center;">${grandTotals.total}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

    </div>
  `;
}


// 2. TRANSFER REPORTS TAB
// Builds a unified audit log from both TRANSFER_REQUESTS and TRANSFERS tables.
// TRANSFER_REQUESTS = all states (pending/approved/completed/rejected).
// TRANSFERS = permanent completed-transfer ledger written on final approval.
// We merge both tables; for completed transfers the TRANSFERS record has flatter fields.
function buildTransferAuditLog(allRequests, completedTransfers) {
  const units  = storage.getTable(TABLE_NAMES.UNITS)  || [];
  const floors = storage.getTable(TABLE_NAMES.FLOORS) || [];
  const lines  = storage.getTable(TABLE_NAMES.LINES)  || [];

  const unitMap  = new Map(units.map(u  => [u.id, u.name]));
  const floorMap = new Map(floors.map(f => [f.id, f.name]));
  const lineMap  = new Map(lines.map(l  => [l.id, l.name]));

  // Resolve any location representation to a readable string (100% immune to [object Object])
  function resolveLocation(locObj, unitId, floorId, lineId, path) {
    if (path && typeof path === 'string' && path.trim() && path !== '[object Object]') return path;
    if (locObj) {
      if (typeof locObj === 'string' && locObj.trim() && locObj !== '[object Object]') return locObj;
      if (typeof locObj === 'object') {
        const parts = [locObj.unit, locObj.floor, locObj.line].filter(p => p && typeof p === 'string' && p.trim() && p !== '[object Object]');
        if (parts.length) return parts.join(' > ');
      }
    }
    const u = unitMap.get(unitId) || '';
    const f = floorMap.get(floorId) || '';
    const l = lineMap.get(lineId) || '';
    const joined = [u, f, l].filter(Boolean).join(' > ');
    return joined || '\u2014';
  }

  function resolveFloor(floorId, locObj) {
    if (floorMap.has(floorId)) return floorMap.get(floorId);
    if (locObj && typeof locObj === 'object' && typeof locObj.floor === 'string' && locObj.floor.trim()) return locObj.floor;
    if (typeof locObj === 'string' && locObj.trim() && locObj !== '[object Object]') return locObj;
    return '\u2014';
  }

  function resolveLine(lineId, locObj) {
    if (lineMap.has(lineId)) return lineMap.get(lineId);
    if (locObj && typeof locObj === 'object' && typeof locObj.line === 'string' && locObj.line.trim()) return locObj.line;
    if (typeof locObj === 'string' && locObj.trim() && locObj !== '[object Object]') return locObj;
    return '\u2014';
  }

  // Index completed transfer records by requestId for fast lookup
  const completedMap = new Map();
  (completedTransfers || []).forEach(ct => {
    if (ct.requestId) completedMap.set(ct.requestId, ct);
  });

  const rows = [];
  const seenRequestIds = new Set();

  // Process all TRANSFER_REQUESTS as the primary source
  (allRequests || []).forEach(req => {
    seenRequestIds.add(req.id);
    const ct = completedMap.get(req.id);
    rows.push({
      id:            req.requestNumber || req.id || '\u2014',
      machineSerial: req.machineInfo?.serialNumber || req.serialNumber || req.machineSerial || ct?.serialNumber || ct?.machineSerial || '\u2014',
      machineName:   req.machineInfo?.machineName  || req.machineName   || ct?.machineName   || '\u2014',
      machineBrand:  req.machineInfo?.brand        || req.brandName     || '\u2014',
      machineModel:  req.machineInfo?.model        || req.modelName     || '\u2014',
      sourceLocation: resolveLocation(req.sourceLocation, req.sourceUnitId, req.sourceFloorId, req.sourceLineId, req.sourcePath),
      destLocation:   resolveLocation(req.destLocation || req.targetLocation, req.destUnitId, req.destFloorId, req.destLineId, req.destPath),
      prevFloor:     resolveFloor(req.sourceFloorId, req.sourceLocation),
      newFloor:      resolveFloor(req.destFloorId,   req.destLocation || req.targetLocation),
      prevLine:      resolveLine(req.sourceLineId,  req.sourceLocation),
      newLine:       resolveLine(req.destLineId,    req.destLocation || req.targetLocation),
      requestedAt:   req.requestedAt || ct?.transferredAt || '\u2014',
      completedAt:   req.completedAt || ct?.completedAt   || null,
      transferredBy: req.requestedByName  || ct?.transferredByName  || '\u2014',
      approvedBy:    req.completedByName  || ct?.completedByName    || (req.approvalHistory || []).find(h => h.action === 'APPROVED' || h.action === 'FINAL_APPROVAL_COMPLETED')?.approverName || '\u2014',
      reason:        req.reason   || ct?.reason   || '\u2014',
      remarks:       req.remarks  || ct?.remarks  || '',
      status:        req.status   || 'PENDING_APPROVAL'
    });
  });

  // Add any completed TRANSFERS records that have no matching request (orphaned legacy records)
  (completedTransfers || []).forEach(ct => {
    if (!ct.requestId || !seenRequestIds.has(ct.requestId)) {
      rows.push({
        id:            ct.requestNumber || ct.id || '\u2014',
        machineSerial: ct.serialNumber || ct.machineSerial || '\u2014',
        machineName:   ct.machineName  || '\u2014',
        machineBrand:  '\u2014', machineModel: '\u2014',
        sourceLocation: resolveLocation(ct.sourceLocation, ct.sourceUnitId, ct.sourceFloorId, ct.sourceLineId, ct.sourcePath),
        destLocation:   resolveLocation(ct.destLocation || ct.targetLocation, ct.destUnitId, ct.destFloorId, ct.destLineId, ct.destPath),
        prevFloor:     floorMap.get(ct.sourceFloorId) || '\u2014',
        newFloor:      floorMap.get(ct.destFloorId)   || '\u2014',
        prevLine:      lineMap.get(ct.sourceLineId)   || '\u2014',
        newLine:       lineMap.get(ct.destLineId)     || '\u2014',
        requestedAt:   ct.transferredAt || ct.completedAt || '\u2014',
        completedAt:   ct.completedAt   || null,
        transferredBy: ct.transferredByName || '\u2014',
        approvedBy:    ct.completedByName  || ct.approvedBy || '\u2014',
        reason:        ct.reason  || '\u2014',
        remarks:       ct.remarks || '',
        status:        'COMPLETED'
      });
    }
  });

  // Sort most-recent first
  rows.sort((a, b) => new Date(b.requestedAt || 0) - new Date(a.requestedAt || 0));
  return rows;
}

let transferReportFilterState = {
  groupId: '',
  unitId: '',
  floorId: '',
  lineId: '',
  prevFloor: '',
  newFloor: '',
  prevLine: '',
  newLine: '',
  status: 'ALL',
  transferredBy: 'ALL',
  dateFrom: '',
  dateTo: '',
  search: '',
  sortField: 'requestedAt',
  sortDirection: 'desc',
  page: 1,
  pageSize: 25,
  viewMode: 'TABLE' // 'TABLE' or 'CARDS'
};

function filterTransferAuditRows(allRows) {
  return allRows.filter(r => {
    // Status
    if (transferReportFilterState.status !== 'ALL') {
      const st = (r.status || '').toUpperCase();
      if (st !== transferReportFilterState.status) return false;
    }

    // Transferred By
    if (transferReportFilterState.transferredBy !== 'ALL' && r.transferredBy !== transferReportFilterState.transferredBy) {
      return false;
    }

    // Previous Floor / New Floor
    if (transferReportFilterState.prevFloor && r.prevFloor !== transferReportFilterState.prevFloor) return false;
    if (transferReportFilterState.newFloor && r.newFloor !== transferReportFilterState.newFloor) return false;

    // Previous Line / New Line
    if (transferReportFilterState.prevLine && r.prevLine !== transferReportFilterState.prevLine) return false;
    if (transferReportFilterState.newLine && r.newLine !== transferReportFilterState.newLine) return false;

    // Hierarchy Filter: Group / Unit / Floor / Line
    if (transferReportFilterState.groupId) {
      const grp = masterDataService.getGroupById(transferReportFilterState.groupId);
      if (grp && !r.sourceLocation.includes(grp.name) && !r.destLocation.includes(grp.name)) return false;
    }
    if (transferReportFilterState.unitId) {
      const unt = masterDataService.getUnitById(transferReportFilterState.unitId);
      if (unt && !r.sourceLocation.includes(unt.name) && !r.destLocation.includes(unt.name)) return false;
    }
    if (transferReportFilterState.floorId) {
      const flr = masterDataService.getFloorById(transferReportFilterState.floorId);
      if (flr && r.prevFloor !== flr.name && r.newFloor !== flr.name && !r.sourceLocation.includes(flr.name) && !r.destLocation.includes(flr.name)) return false;
    }
    if (transferReportFilterState.lineId) {
      const lin = masterDataService.getLineById(transferReportFilterState.lineId);
      if (lin && r.prevLine !== lin.name && r.newLine !== lin.name && !r.sourceLocation.includes(lin.name) && !r.destLocation.includes(lin.name)) return false;
    }

    // Date Range: dateFrom / dateTo
    if (transferReportFilterState.dateFrom) {
      const rowDate = r.requestedAt && r.requestedAt !== '\u2014' ? r.requestedAt.split('T')[0] : '';
      if (rowDate && rowDate < transferReportFilterState.dateFrom) return false;
    }
    if (transferReportFilterState.dateTo) {
      const rowDate = r.requestedAt && r.requestedAt !== '\u2014' ? r.requestedAt.split('T')[0] : '';
      if (rowDate && rowDate > transferReportFilterState.dateTo) return false;
    }

    // Global Search
    if (transferReportFilterState.search) {
      const q = transferReportFilterState.search.toLowerCase().trim();
      const match = (r.id || '').toLowerCase().includes(q) ||
        (r.machineSerial || '').toLowerCase().includes(q) ||
        (r.machineName || '').toLowerCase().includes(q) ||
        (r.machineBrand || '').toLowerCase().includes(q) ||
        (r.machineModel || '').toLowerCase().includes(q) ||
        (r.sourceLocation || '').toLowerCase().includes(q) ||
        (r.destLocation || '').toLowerCase().includes(q) ||
        (r.prevFloor || '').toLowerCase().includes(q) ||
        (r.newFloor || '').toLowerCase().includes(q) ||
        (r.prevLine || '').toLowerCase().includes(q) ||
        (r.newLine || '').toLowerCase().includes(q) ||
        (r.transferredBy || '').toLowerCase().includes(q) ||
        (r.reason || '').toLowerCase().includes(q) ||
        (r.remarks || '').toLowerCase().includes(q) ||
        (r.status || '').toLowerCase().includes(q);
      if (!match) return false;
    }

    return true;
  });
}

function sortTransferAuditRows(rows) {
  const { sortField, sortDirection } = transferReportFilterState;
  const factor = sortDirection === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const valA = a[sortField] || '';
    const valB = b[sortField] || '';
    if (sortField === 'requestedAt') {
      const dateA = new Date(valA || 0).getTime() || 0;
      const dateB = new Date(valB || 0).getTime() || 0;
      return (dateA - dateB) * factor;
    }
    return String(valA).localeCompare(String(valB)) * factor;
  });
}

function paginateTransferAuditRows(rows) {
  const { page, pageSize } = transferReportFilterState;
  if (pageSize === 'ALL') {
    return { paginatedRows: rows, totalPages: 1, currentPage: 1, startIdx: 0, endIdx: rows.length };
  }
  const size = parseInt(pageSize, 10) || 25;
  const totalPages = Math.max(1, Math.ceil(rows.length / size));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  transferReportFilterState.page = currentPage;
  const startIdx = (currentPage - 1) * size;
  const endIdx = Math.min(startIdx + size, rows.length);
  const paginatedRows = rows.slice(startIdx, endIdx);
  return { paginatedRows, totalPages, currentPage, startIdx, endIdx };
}

function renderTransferReportsTab(allRequests, completedTransfers) {
  const allAuditRows = buildTransferAuditLog(allRequests, completedTransfers);
  const filteredRows = filterTransferAuditRows(allAuditRows);
  const sortedRows = sortTransferAuditRows(filteredRows);
  const { paginatedRows, totalPages, currentPage, startIdx, endIdx } = paginateTransferAuditRows(sortedRows);

  // Extract distinct values for dropdown filters
  const allLocationStrings = allAuditRows.flatMap(r => [r.sourceLocation, r.destLocation]).filter(Boolean).join('|||');
  const groups = (masterDataService.getGroups() || []).filter(g => allLocationStrings.includes(g.name));
  const units = (masterDataService.getUnits(transferReportFilterState.groupId) || []).filter(u => allLocationStrings.includes(u.name));
  const floors = (masterDataService.getFloors(transferReportFilterState.unitId, transferReportFilterState.groupId) || []).filter(f => allLocationStrings.includes(f.name));
  const lines = (masterDataService.getLines(transferReportFilterState.floorId, transferReportFilterState.unitId, transferReportFilterState.groupId) || []).filter(l => allLocationStrings.includes(l.name));

  const distinctPrevFloors = Array.from(new Set(allAuditRows.map(r => r.prevFloor).filter(f => f && f !== '\u2014'))).sort();
  const distinctNewFloors = Array.from(new Set(allAuditRows.map(r => r.newFloor).filter(f => f && f !== '\u2014'))).sort();
  const distinctPrevLines = Array.from(new Set(allAuditRows
      .filter(r => !transferReportFilterState.prevFloor || r.prevFloor === transferReportFilterState.prevFloor)
      .map(r => r.prevLine).filter(l => l && l !== '\u2014'))).sort();
  const distinctNewLines = Array.from(new Set(allAuditRows
      .filter(r => !transferReportFilterState.newFloor || r.newFloor === transferReportFilterState.newFloor)
      .map(r => r.newLine).filter(l => l && l !== '\u2014'))).sort();
  const distinctUsers = Array.from(new Set(allAuditRows.map(r => r.transferredBy).filter(u => u && u !== '\u2014'))).sort();
  const distinctStatuses = Array.from(new Set(allAuditRows.map(r => r.status).filter(s => s && s !== '\u2014'))).sort();

  // KPI Metrics Counts
  const totalCount = allAuditRows.length;
  const completedCount = allAuditRows.filter(r => r.status === 'COMPLETED' || r.status === 'APPROVED').length;
  const pendingCount = allAuditRows.filter(r => r.status === 'PENDING_APPROVAL' || r.status === 'PARTIALLY_APPROVED' || r.status === 'REVISION_REQUESTED').length;
  const rejectedCount = allAuditRows.filter(r => r.status === 'REJECTED').length;
  const cancelledCount = allAuditRows.filter(r => r.status === 'CANCELLED').length;

  const statusBadge = (status) => {
    const map = {
      'COMPLETED':          { cls: 'badge-active',    label: 'COMPLETED'  },
      'APPROVED':           { cls: 'badge-active',    label: 'APPROVED'   },
      'REJECTED':           { cls: 'badge-breakdown', label: 'REJECTED'   },
      'CANCELLED':          { cls: 'badge-breakdown', label: 'CANCELLED'  },
      'PENDING_APPROVAL':   { cls: 'badge-maint',     label: 'PENDING'    },
      'PARTIALLY_APPROVED': { cls: 'badge-maint',     label: 'PARTIAL'    },
      'REVISION_REQUESTED': { cls: 'badge-maint',     label: 'REVISION'   },
    };
    const s = map[status] || { cls: 'badge-maint', label: (status || '\u2014').replace(/_/g, ' ') };
    return `<span class="badge ${s.cls}" style="font-size: 10px; padding: 2px 6px; white-space: nowrap;">${s.label}</span>`;
  };

  const getSortIndicator = (field) => {
    if (transferReportFilterState.sortField !== field) return '<span style="color: #64748b; font-size: 10px;">↕</span>';
    return `<span style="color: #38bdf8; font-size: 10px; font-weight: 800;">${transferReportFilterState.sortDirection === 'asc' ? '▲' : '▼'}</span>`;
  };

  return `
    <div style="display: flex; flex-direction: column; gap: 10px; width: 100%;">

      <!-- 1. COMPACT INLINE KPI BAR + ACTION BUTTONS -->
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 8px 14px; box-shadow: var(--shadow-sm);">
        
        <!-- KPI Chips (clickable status filters) -->
        <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
          <div class="tr-kpi-card" data-tr-kpi-status="ALL" style="display:flex;align-items:center;gap:6px;background:${transferReportFilterState.status === 'ALL' ? 'rgba(56,189,248,0.15)' : 'rgba(56,189,248,0.05)'};border:1.5px solid ${transferReportFilterState.status === 'ALL' ? '#38bdf8' : 'rgba(56,189,248,0.2)'};border-radius:20px;padding:3px 12px;cursor:pointer;transition:all 0.2s;" title="All Transfers">
            <span style="font-size:10px;font-weight:700;color:#38bdf8;">ALL</span>
            <span style="font-size:15px;font-weight:800;color:#fff;">${totalCount}</span>
          </div>
          <div class="tr-kpi-card" data-tr-kpi-status="COMPLETED" style="display:flex;align-items:center;gap:6px;background:${transferReportFilterState.status === 'COMPLETED' ? 'rgba(52,211,153,0.15)' : 'rgba(52,211,153,0.05)'};border:1.5px solid ${transferReportFilterState.status === 'COMPLETED' ? '#34d399' : 'rgba(52,211,153,0.2)'};border-radius:20px;padding:3px 12px;cursor:pointer;transition:all 0.2s;" title="Completed">
            <span style="font-size:10px;font-weight:700;color:#34d399;">✅ DONE</span>
            <span style="font-size:15px;font-weight:800;color:#34d399;">${completedCount}</span>
          </div>
          <div class="tr-kpi-card" data-tr-kpi-status="PENDING" style="display:flex;align-items:center;gap:6px;background:${transferReportFilterState.status === 'PENDING' ? 'rgba(251,191,36,0.15)' : 'rgba(251,191,36,0.05)'};border:1.5px solid ${transferReportFilterState.status === 'PENDING' ? '#fbbf24' : 'rgba(251,191,36,0.2)'};border-radius:20px;padding:3px 12px;cursor:pointer;transition:all 0.2s;" title="Pending Approval">
            <span style="font-size:10px;font-weight:700;color:#fbbf24;">⏳ PENDING</span>
            <span style="font-size:15px;font-weight:800;color:#fbbf24;">${pendingCount}</span>
          </div>
          <div class="tr-kpi-card" data-tr-kpi-status="REJECTED" style="display:flex;align-items:center;gap:6px;background:${(transferReportFilterState.status === 'REJECTED' || transferReportFilterState.status === 'CANCELLED') ? 'rgba(244,63,94,0.15)' : 'rgba(244,63,94,0.05)'};border:1.5px solid ${(transferReportFilterState.status === 'REJECTED' || transferReportFilterState.status === 'CANCELLED') ? '#f43f5e' : 'rgba(244,63,94,0.2)'};border-radius:20px;padding:3px 12px;cursor:pointer;transition:all 0.2s;" title="Rejected/Cancelled">
            <span style="font-size:10px;font-weight:700;color:#f43f5e;">❌ REJ/CXL</span>
            <span style="font-size:15px;font-weight:800;color:#f43f5e;">${rejectedCount + cancelledCount}</span>
          </div>
          <span style="font-size:11px;color:var(--text-muted);padding-left:4px;">${filteredRows.length} of ${allAuditRows.length} shown</span>
        </div>

        <!-- Action Buttons -->
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
          <span style="font-size:10px;color:#34d399;background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.3);border-radius:4px;padding:2px 8px;font-weight:700;">🔴 Live</span>
          <button id="btn-export-transfer-report-excel" class="btn btn-primary btn-sm" style="font-weight:700;background:linear-gradient(135deg,#0284c7,#0369a1);height:30px;font-size:11px;">📊 Excel</button>
          <button id="btn-export-transfer-report-pdf" class="btn btn-secondary btn-sm" style="font-weight:700;height:30px;font-size:11px;">🖨️ Print</button>
          <div style="display:flex;border:1px solid var(--border-color);border-radius:6px;overflow:hidden;height:30px;">
            <button class="btn btn-xs ${transferReportFilterState.viewMode === 'TABLE' ? 'btn-primary' : 'btn-ghost'}" data-tr-view-mode="TABLE" style="padding:0 10px;font-size:11px;">▦ Table</button>
            <button class="btn btn-xs ${transferReportFilterState.viewMode === 'CARDS' ? 'btn-primary' : 'btn-ghost'}" data-tr-view-mode="CARDS" style="padding:0 10px;font-size:11px;">🗂️ Cards</button>
          </div>
        </div>
      </div>

      <!-- 2. COMPACT FILTER TOOLBAR (single row, always visible) -->
      <div style="background: var(--bg-surface); border: 1px solid rgba(56,189,248,0.25); border-radius: var(--radius-lg); padding: 8px 12px; box-shadow: var(--shadow-sm);">
        
        <!-- Main filter row -->
        <div style="display: flex; align-items: flex-end; gap: 8px; flex-wrap: wrap;">
          
          <div style="display: flex; flex-direction: column; gap: 3px; min-width: 120px; flex: 1;">
            <label style="font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase;">Status</label>
            <select id="tr-filter-status" class="filter-select" style="height: 32px; font-size: 11.5px; width: 100%;">
              <option value="ALL" ${transferReportFilterState.status === 'ALL' ? 'selected' : ''}>All Statuses</option>
              ${distinctStatuses.map(s => `<option value="${s.toUpperCase()}" ${transferReportFilterState.status === s.toUpperCase() ? 'selected' : ''}>${s.replace(/_/g, ' ')}</option>`).join('')}
            </select>
          </div>

          <div style="display: flex; flex-direction: column; gap: 3px; min-width: 130px; flex: 1;">
            <label style="font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase;">Staff</label>
            <select id="tr-filter-by" class="filter-select" style="height: 32px; font-size: 11.5px; width: 100%;">
              <option value="ALL" ${transferReportFilterState.transferredBy === 'ALL' ? 'selected' : ''}>All Staff (${distinctUsers.length})</option>
              ${distinctUsers.map(u => `<option value="${u}" ${transferReportFilterState.transferredBy === u ? 'selected' : ''}>${u}</option>`).join('')}
            </select>
          </div>

          <div style="display: flex; flex-direction: column; gap: 3px; min-width: 120px; flex: 1;">
            <label style="font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase;">From Date</label>
            <input type="date" id="tr-filter-date-from" class="form-control" value="${transferReportFilterState.dateFrom || ''}" style="height: 32px; font-size: 11.5px; padding: 4px 8px; width: 100%; box-sizing: border-box;" />
          </div>

          <div style="display: flex; flex-direction: column; gap: 3px; min-width: 120px; flex: 1;">
            <label style="font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase;">To Date</label>
            <input type="date" id="tr-filter-date-to" class="form-control" value="${transferReportFilterState.dateTo || ''}" style="height: 32px; font-size: 11.5px; padding: 4px 8px; width: 100%; box-sizing: border-box;" />
          </div>

          <div style="display: flex; flex-direction: column; gap: 3px; min-width: 200px; flex: 3;">
            <label style="font-size: 10px; font-weight: 700; color: #38bdf8; text-transform: uppercase;">🔍 Search</label>
            <input type="text" id="tr-filter-search" class="form-control" placeholder="Machine serial, name, location, staff, reason..." value="${transferReportFilterState.search || ''}" style="height: 32px; font-size: 11.5px; padding: 4px 10px; width: 100%; box-sizing: border-box;" />
          </div>

          <div style="display: flex; gap: 6px; flex-shrink: 0;">
            <button id="tr-btn-clear-filters" class="btn btn-ghost btn-sm" style="height: 32px; font-weight: 700; color: #94a3b8; white-space: nowrap;" title="Reset all filters">↺ Clear</button>
            <button id="tr-btn-toggle-advanced" onclick="const adv = document.getElementById('tr-advanced-filters'); const isHidden = adv.style.display === 'none'; adv.style.display = isHidden ? 'block' : 'none'; this.textContent = isHidden ? '▲ Less' : '▼ Advanced'; transferReportFilterState.isExpanded = isHidden;" class="btn btn-ghost btn-sm" style="height: 32px; font-weight: 700; color: #64748b; border: 1px solid rgba(255,255,255,0.08); white-space: nowrap; font-size: 11px;">
              ${transferReportFilterState.isExpanded ? '▲ Less' : '▼ Advanced'}
            </button>
          </div>
        </div>

        <!-- ADVANCED FILTERS: Location + Movement (hidden by default) -->
        <div id="tr-advanced-filters" style="display: ${transferReportFilterState.isExpanded ? 'block' : 'none'}; margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.08);">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px;">
            
            <div style="display: flex; flex-direction: column; gap: 3px;">
              <label style="font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase;">🏢 Group</label>
              <select id="tr-filter-group" class="filter-select" style="height: 32px; font-size: 11px; width: 100%;">
                <option value="">All Groups (${groups.length})</option>
                ${groups.map(g => `<option value="${g.id}" ${transferReportFilterState.groupId === g.id ? 'selected' : ''}>${g.name}</option>`).join('')}
              </select>
            </div>

            <div style="display: flex; flex-direction: column; gap: 3px;">
              <label style="font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase;">🏭 Unit</label>
              <select id="tr-filter-unit" class="filter-select" style="height: 32px; font-size: 11px; width: 100%;">
                <option value="">All Units (${units.length})</option>
                ${units.map(u => `<option value="${u.id}" ${transferReportFilterState.unitId === u.id ? 'selected' : ''}>${u.name}</option>`).join('')}
              </select>
            </div>

            <div style="display: flex; flex-direction: column; gap: 3px;">
              <label style="font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase;">Floor</label>
              <select id="tr-filter-floor" class="filter-select" style="height: 32px; font-size: 11px; width: 100%;">
                <option value="">All Floors (${floors.length})</option>
                ${floors.map(f => `<option value="${f.id}" ${transferReportFilterState.floorId === f.id ? 'selected' : ''}>${f.name}</option>`).join('')}
              </select>
            </div>

            <div style="display: flex; flex-direction: column; gap: 3px;">
              <label style="font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase;">Line</label>
              <select id="tr-filter-line" class="filter-select" style="height: 32px; font-size: 11px; width: 100%;">
                <option value="">All Lines (${lines.length})</option>
                ${lines.map(l => `<option value="${l.id}" ${transferReportFilterState.lineId === l.id ? 'selected' : ''}>${l.name}</option>`).join('')}
              </select>
            </div>

            <div style="display: flex; flex-direction: column; gap: 3px;">
              <label style="font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase;">📍 From Floor</label>
              <select id="tr-filter-prev-floor" class="filter-select" style="height: 32px; font-size: 11px; width: 100%;">
                <option value="">All Source Floors</option>
                ${distinctPrevFloors.map(f => `<option value="${f}" ${transferReportFilterState.prevFloor === f ? 'selected' : ''}>${f}</option>`).join('')}
              </select>
            </div>

            <div style="display: flex; flex-direction: column; gap: 3px;">
              <label style="font-size: 10px; font-weight: 700; color: #86efac; text-transform: uppercase;">→ To Floor</label>
              <select id="tr-filter-new-floor" class="filter-select" style="height: 32px; font-size: 11px; width: 100%; border-color: rgba(134,239,172,0.4);">
                <option value="">All Dest Floors</option>
                ${distinctNewFloors.map(f => `<option value="${f}" ${transferReportFilterState.newFloor === f ? 'selected' : ''}>${f}</option>`).join('')}
              </select>
            </div>

            <div style="display: flex; flex-direction: column; gap: 3px;">
              <label style="font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase;">📍 From Line</label>
              <select id="tr-filter-prev-line" class="filter-select" style="height: 32px; font-size: 11px; width: 100%;">
                <option value="">All Source Lines</option>
                ${distinctPrevLines.map(l => `<option value="${l}" ${transferReportFilterState.prevLine === l ? 'selected' : ''}>${l}</option>`).join('')}
              </select>
            </div>

            <div style="display: flex; flex-direction: column; gap: 3px;">
              <label style="font-size: 10px; font-weight: 700; color: #86efac; text-transform: uppercase;">→ To Line</label>
              <select id="tr-filter-new-line" class="filter-select" style="height: 32px; font-size: 11px; width: 100%; border-color: rgba(134,239,172,0.4);">
                <option value="">All Dest Lines</option>
                ${distinctNewLines.map(l => `<option value="${l}" ${transferReportFilterState.newLine === l ? 'selected' : ''}>${l}</option>`).join('')}
              </select>
            </div>

          </div>
        </div>

      </div>



      <!-- 3. AUDIT LOG DATA TABLE CONTAINER (RESPONSIVE, NO HORIZONTAL SCROLL) -->
      <div id="tr-table-container">
      ${transferReportFilterState.viewMode === 'CARDS' ? `
        <!-- CARDS VIEW -->
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 12px;">
          ${paginatedRows.length === 0 ? `
            <div style="grid-column: 1 / -1; text-align: center; padding: 50px 20px; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); color: var(--text-muted);">
              <div style="font-size: 32px; margin-bottom: 8px;">🚫</div>
              <div style="font-size: 14px; font-weight: 700; color: #fff;">No Transfer Records Match the Selected Filters</div>
              <div style="font-size: 12px; margin-top: 4px;">Click "Clear Filters" or adjust your query criteria.</div>
            </div>
          ` : paginatedRows.map((row, idx) => {
            const dateStr = row.requestedAt && row.requestedAt !== '\u2014'
              ? (() => {
                  try {
                    const d = new Date(row.requestedAt);
                    return d.toLocaleDateString('en-GB') + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  } catch (_) { return row.requestedAt; }
                })()
              : '\u2014';
            return `
              <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; box-shadow: var(--shadow-sm);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 8px;">
                  <div>
                    <div style="font-family: var(--font-mono); font-weight: 800; color: #38bdf8; font-size: 13px;">🧵 ${row.machineSerial}</div>
                    <div style="font-size: 11px; color: #e2e8f0; font-weight: 600;">${row.machineName}</div>
                  </div>
                  <div>${statusBadge(row.status)}</div>
                </div>

                <div style="display: flex; flex-direction: column; gap: 6px; font-size: 11.5px;">
                  <div style="background: rgba(15,23,42,0.6); padding: 6px 8px; border-radius: 4px; border-left: 3px solid #64748b;">
                    <div style="font-size: 9.5px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">From Location:</div>
                    <div style="font-weight: 600; color: #cbd5e1;">${row.prevFloor} <span style="color: #64748b;">›</span> ${row.prevLine}</div>
                  </div>

                  <div style="background: rgba(16,185,129,0.08); padding: 6px 8px; border-radius: 4px; border-left: 3px solid #34d399;">
                    <div style="font-size: 9.5px; color: #86efac; font-weight: 700; text-transform: uppercase;">➔ To Location:</div>
                    <div style="font-weight: 700; color: #86efac;">${row.newFloor} <span style="color: rgba(134,239,172,0.6);">›</span> ${row.newLine}</div>
                  </div>
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 8px; font-size: 11px;">
                  <span style="color: #fbbf24; font-family: var(--font-mono);">${dateStr}</span>
                  <span style="color: #c084fc; font-weight: 600;">👤 ${row.transferredBy}</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      ` : `
        <!-- TABLE VIEW (CLEAN, NO HORIZONTAL SCROLL ON DESKTOP) -->
        <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-sm); width: 100%;">
          <div class="responsive-table-wrapper">
            <table class="data-table" style="width: 100%; border-collapse: collapse; margin: 0; table-layout: fixed;">
              <thead>
                <tr style="background: rgba(15,23,42,0.98); border-bottom: 2px solid var(--border-color); font-size: 11px; text-transform: uppercase; color: #94a3b8; user-select: none;">
                  <th style="width: 48px; text-align: center; padding: 10px 4px;">SL</th>
                  <th style="width: 16%; text-align: left; padding: 10px 8px; cursor: pointer;" data-tr-sort="machineSerial" title="Click to sort by Machine Serial">
                    Machine &amp; Serial ${getSortIndicator('machineSerial')}
                  </th>
                  <th style="width: 20%; text-align: left; padding: 10px 8px;">
                    Previous Location (From)
                  </th>
                  <th style="width: 22%; text-align: left; padding: 10px 8px; cursor: pointer;" data-tr-sort="destLocation" title="Click to sort by Destination">
                    <span style="color: #86efac; font-weight: 700;">➔ New Location (To)</span> ${getSortIndicator('destLocation')}
                  </th>
                  <th style="width: 14%; text-align: left; padding: 10px 8px; cursor: pointer;" data-tr-sort="requestedAt" title="Click to sort by Transfer Date">
                    Date &amp; Time ${getSortIndicator('requestedAt')}
                  </th>
                  <th style="width: 12%; text-align: left; padding: 10px 8px; cursor: pointer;" data-tr-sort="transferredBy" title="Click to sort by Requester">
                    Transferred By ${getSortIndicator('transferredBy')}
                  </th>
                  <th style="width: 9%; text-align: center; padding: 10px 6px; cursor: pointer;" data-tr-sort="status" title="Click to sort by Status">
                    Status ${getSortIndicator('status')}
                  </th>
                  <th style="width: 7%; text-align: left; padding: 10px 8px;">Reason</th>
                </tr>
              </thead>
              <tbody>
                ${paginatedRows.length === 0 ? `
                  <tr>
                    <td colspan="8" style="text-align: center; padding: 45px 20px; color: var(--text-muted);">
                      <div style="font-size: 32px; margin-bottom: 8px;">🚫</div>
                      <div style="font-size: 14px; font-weight: 700; color: #fff; margin-bottom: 4px;">No Transfer Records Match the Selected Filters</div>
                      <div style="font-size: 12px;">Click "Clear Filters" or adjust your query criteria.</div>
                    </td>
                  </tr>
                ` : paginatedRows.map((row, idx) => {
                  let dDate = '\u2014';
                  let dTime = '';
                  if (row.requestedAt && row.requestedAt !== '\u2014') {
                    try {
                      const dt = new Date(row.requestedAt);
                      dDate = dt.toLocaleDateString('en-GB');
                      dTime = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    } catch (_) { dDate = row.requestedAt; }
                  }
                  const reasonStr = row.reason || '\u2014';
                  const remarksStr = row.remarks ? ` (${row.remarks})` : '';
                  const rowNum = (currentPage - 1) * (transferReportFilterState.pageSize === 'ALL' ? totalCount : parseInt(transferReportFilterState.pageSize, 10)) + idx + 1;
                  return `
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);" class="hover-row">
                      <td style="text-align: center; color: var(--text-muted); font-weight: 700; padding: 8px 4px; font-size: 11px;">
                        <div>${rowNum}</div>
                        <div style="font-family: var(--font-mono); font-size: 9px; color: #64748b;" title="Ref ID: ${row.id}">${row.id.replace(/^trq-/, '').slice(-6)}</div>
                      </td>
                      <td style="padding: 8px 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        <div style="font-family: var(--font-mono); font-weight: 800; color: #38bdf8; font-size: 11.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="Machine Serial: ${row.machineSerial}">🧵 ${row.machineSerial}</div>
                        <div style="font-size: 10.5px; color: #cbd5e1; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${row.machineName} (${row.machineBrand} ${row.machineModel})">${row.machineName}</div>
                      </td>
                      <td style="padding: 8px 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        <div style="font-size: 11px; font-weight: 600; color: #cbd5e1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${row.sourceLocation}">🏢 ${row.prevFloor} <span style="color: #64748b;">›</span> ${row.prevLine}</div>
                        <div style="font-size: 9.5px; color: #64748b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${row.sourceLocation}">${row.sourceLocation}</div>
                      </td>
                      <td style="padding: 8px 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        <div style="font-size: 11.5px; font-weight: 700; color: #86efac; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${row.destLocation}">➔ ${row.newFloor} <span style="color: rgba(134,239,172,0.6);">›</span> ${row.newLine}</div>
                        <div style="font-size: 9.5px; color: rgba(134,239,172,0.7); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${row.destLocation}">${row.destLocation}</div>
                      </td>
                      <td style="padding: 8px 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        <div style="font-family: var(--font-mono); font-size: 11px; color: #fbbf24; font-weight: 600; white-space: nowrap;">📅 ${dDate}</div>
                        <div style="font-size: 10px; color: #94a3b8; white-space: nowrap;">⏰ ${dTime}</div>
                      </td>
                      <td style="padding: 8px 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        <div style="font-size: 11px; color: #c084fc; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${row.transferredBy}">👤 ${row.transferredBy}</div>
                      </td>
                      <td style="text-align: center; padding: 8px 4px; white-space: nowrap;">
                        ${statusBadge(row.status)}
                      </td>
                      <td style="padding: 8px 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        <div style="font-size: 10.5px; color: #94a3b8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${reasonStr}${remarksStr}">
                          ${reasonStr}${remarksStr}
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>

          <!-- 4. PAGINATION BAR -->
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 18px; border-top: 1px solid var(--border-color); background: rgba(15, 23, 42, 0.95); flex-wrap: wrap; gap: 10px; font-size: 11.5px;">
            <div style="color: var(--text-muted);">
              Showing <strong style="color: #fff;">${filteredRows.length === 0 ? 0 : startIdx + 1}</strong> to <strong style="color: #fff;">${endIdx}</strong> of <strong style="color: #38bdf8;">${filteredRows.length}</strong> records (Page ${currentPage} of ${totalPages})
            </div>

            <div style="display: flex; align-items: center; gap: 14px;">
              <div style="display: flex; align-items: center; gap: 6px;">
                <label style="color: #94a3b8; font-size: 11px;">Per page:</label>
                <select id="tr-page-size" class="filter-select" style="height: 28px; font-size: 11px; padding: 2px 6px;">
                  <option value="25" ${transferReportFilterState.pageSize === 25 || transferReportFilterState.pageSize === '25' ? 'selected' : ''}>25</option>
                  <option value="50" ${transferReportFilterState.pageSize === 50 || transferReportFilterState.pageSize === '50' ? 'selected' : ''}>50</option>
                  <option value="100" ${transferReportFilterState.pageSize === 100 || transferReportFilterState.pageSize === '100' ? 'selected' : ''}>100</option>
                  <option value="ALL" ${transferReportFilterState.pageSize === 'ALL' ? 'selected' : ''}>All</option>
                </select>
              </div>

              <div style="display: flex; gap: 4px;">
                <button class="btn btn-xs ${currentPage === 1 ? 'btn-ghost' : 'btn-secondary'}" data-tr-page="1" ${currentPage === 1 ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''} title="First page">« First</button>
                <button class="btn btn-xs ${currentPage === 1 ? 'btn-ghost' : 'btn-secondary'}" data-tr-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''} title="Previous page">‹ Prev</button>
                <span style="padding: 2px 8px; font-weight: 700; color: #38bdf8; background: rgba(56, 189, 248, 0.1); border-radius: 4px; display: inline-flex; align-items: center;">${currentPage} / ${totalPages}</span>
                <button class="btn btn-xs ${currentPage >= totalPages ? 'btn-ghost' : 'btn-secondary'}" data-tr-page="${currentPage + 1}" ${currentPage >= totalPages ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''} title="Next page">Next ›</button>
                <button class="btn btn-xs ${currentPage >= totalPages ? 'btn-ghost' : 'btn-secondary'}" data-tr-page="${totalPages}" ${currentPage >= totalPages ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''} title="Last page">Last »</button>
              </div>
            </div>
          </div>
        </div>
      `}
      </div>

    </div>
  `;
}

// 3. SPARE PARTS REPORTS & CONSUMPTION ANALYTICS TAB
function renderSparePartsReportsTab() {
  const groups = masterDataService.getGroups();
  const units = masterDataService.getUnits(spareFilterState.groupId);
  const floors = masterDataService.getFloors(spareFilterState.unitId, spareFilterState.groupId);
  const lines = masterDataService.getLines(spareFilterState.floorId, spareFilterState.unitId, spareFilterState.groupId);

  const allMachines = storage.getTable(TABLE_NAMES.MACHINES) || [];
  let availableMachines = allMachines;
  if (spareFilterState.lineId) {
    availableMachines = allMachines.filter(m => m.lineId === spareFilterState.lineId);
  } else if (spareFilterState.floorId) {
    availableMachines = allMachines.filter(m => m.floorId === spareFilterState.floorId);
  } else if (spareFilterState.unitId) {
    availableMachines = allMachines.filter(m => m.unitId === spareFilterState.unitId);
  }

  const sparePartsCatalog = historyService.getSparePartsMaster() || [];
  const analytics = historyService.getSparePartsConsumptionAnalytics(spareFilterState);
  const { kpi, aggregatedList, transactions } = analytics;

  return `
    <div style="display: flex; flex-direction: column; gap: 6px; height: 100%; flex: 1; min-height: 0;">
      
      <!-- 1. Compact Filter Toolbar -->
      <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 6px 10px; display: flex; flex-direction: column; gap: 6px; box-shadow: var(--shadow-sm); flex-shrink: 0;">
        
        <!-- Row 1: Location & Parts Filter Selects -->
        <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
          <span style="font-size: 11px; font-weight: 800; color: #38bdf8; text-transform: uppercase; white-space: nowrap;">
            🔍 Filters:
          </span>

          <!-- Group -->
          <select id="sp-filter-group" class="filter-select" style="height: 28px; font-size: 11.5px; padding: 2px 6px; min-width: 105px; max-width: 130px;">
            <option value="">All Groups (${groups.length})</option>
            ${groups.map(g => `<option value="${g.id}" ${spareFilterState.groupId === g.id ? 'selected' : ''}>${g.name}</option>`).join('')}
          </select>

          <!-- Unit -->
          <select id="sp-filter-unit" class="filter-select" style="height: 28px; font-size: 11.5px; padding: 2px 6px; min-width: 105px; max-width: 130px;">
            <option value="">All Units (${units.length})</option>
            ${units.map(u => `<option value="${u.id}" ${spareFilterState.unitId === u.id ? 'selected' : ''}>${u.name}</option>`).join('')}
          </select>

          <!-- Floor -->
          <select id="sp-filter-floor" class="filter-select" style="height: 28px; font-size: 11.5px; padding: 2px 6px; min-width: 105px; max-width: 130px;">
            <option value="">All Floors (${floors.length})</option>
            ${floors.map(f => `<option value="${f.id}" ${spareFilterState.floorId === f.id ? 'selected' : ''}>${f.name}</option>`).join('')}
          </select>

          <!-- Line -->
          <select id="sp-filter-line" class="filter-select" style="height: 28px; font-size: 11.5px; padding: 2px 6px; min-width: 105px; max-width: 130px;">
            <option value="">All Lines (${lines.length})</option>
            ${lines.map(l => `<option value="${l.id}" ${spareFilterState.lineId === l.id ? 'selected' : ''}>${l.name}</option>`).join('')}
          </select>

          <!-- Machine -->
          <select id="sp-filter-machine" class="filter-select" style="height: 28px; font-size: 11.5px; padding: 2px 6px; min-width: 120px; max-width: 160px;">
            <option value="">All Machines (${availableMachines.length})</option>
            ${availableMachines.slice(0, 100).map(m => `
              <option value="${m.id}" ${spareFilterState.machineId === m.id ? 'selected' : ''}>
                ${m.serialNumber} (${m.name || 'Machine'})
              </option>
            `).join('')}
          </select>

          <!-- Spare Part -->
          <select id="sp-filter-part" class="filter-select" style="height: 28px; font-size: 11.5px; padding: 2px 6px; min-width: 120px; max-width: 160px;">
            <option value="">All Spare Parts (${sparePartsCatalog.length})</option>
            ${sparePartsCatalog.map(p => `
              <option value="${p.name}" ${spareFilterState.sparePart === p.name ? 'selected' : ''}>
                ${p.name}
              </option>
            `).join('')}
          </select>

          <!-- Status -->
          <select id="sp-filter-status" class="filter-select" style="height: 28px; font-size: 11.5px; padding: 2px 6px; min-width: 100px; max-width: 125px;">
            <option value="ALL" ${spareFilterState.status === 'ALL' ? 'selected' : ''}>All Statuses</option>
            <option value="USED" ${spareFilterState.status === 'USED' ? 'selected' : ''}>🟢 Used / Installed</option>
            <option value="RETURNED" ${spareFilterState.status === 'RETURNED' ? 'selected' : ''}>🔄 Returned</option>
            <option value="CANCELLED" ${spareFilterState.status === 'CANCELLED' ? 'selected' : ''}>❌ Cancelled</option>
            <option value="ISSUED" ${spareFilterState.status === 'ISSUED' ? 'selected' : ''}>📦 Issued</option>
          </select>
        </div>

        <!-- Row 2: Date Range, Search & Action Buttons -->
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 6px; flex: 1; min-width: 0; flex-wrap: wrap;">
            <input type="date" id="sp-filter-date-from" class="form-control" title="From Date" value="${spareFilterState.dateFrom || ''}" style="height: 28px; font-size: 11px; padding: 2px 6px; width: 120px;" />
            <span style="color: #64748b; font-size: 11px;">to</span>
            <input type="date" id="sp-filter-date-to" class="form-control" title="To Date" value="${spareFilterState.dateTo || ''}" style="height: 28px; font-size: 11px; padding: 2px 6px; width: 120px;" />
            <input 
              type="text" 
              id="sp-filter-search" 
              class="form-control" 
              placeholder="🔍 Search part, code, slip #, tech..." 
              value="${spareFilterState.search || ''}"
              style="height: 28px; font-size: 11.5px; padding: 2px 8px; min-width: 180px; flex: 1;"
            />
            <button id="sp-btn-clear-filters" class="btn btn-ghost btn-xs" style="height: 28px; padding: 0 8px; font-size: 11px; font-weight: 700; color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.35); border-radius: 4px; white-space: nowrap;">
              ↺ Clear
            </button>
          </div>

          <div style="display: flex; gap: 6px; align-items: center; flex-shrink: 0;">
            <div style="display: flex; border: 1px solid var(--border-color); border-radius: 4px; overflow: hidden; height: 28px;">
              <button class="btn btn-xs ${spareFilterState.viewMode === 'SUMMARY' ? 'btn-primary' : 'btn-ghost'}" data-sp-mode="SUMMARY" style="padding: 0 8px; font-size: 11px; height: 100%;">
                📊 Summary (${aggregatedList.length})
              </button>
              <button class="btn btn-xs ${spareFilterState.viewMode === 'LEDGER' ? 'btn-primary' : 'btn-ghost'}" data-sp-mode="LEDGER" style="padding: 0 8px; font-size: 11px; height: 100%;">
                📜 Ledger (${transactions.length})
              </button>
            </div>
            <button id="sp-btn-export-excel" class="btn btn-primary btn-xs" style="font-weight: 700; background: linear-gradient(135deg, #0284c7, #0369a1); height: 28px; padding: 0 10px; font-size: 11.5px; border-radius: 4px; white-space: nowrap;">
              📥 Export Excel
            </button>
          </div>
        </div>

      </div>

      <!-- 2. Sleek KPI Metrics Ribbon Strip (Takes only 28px height) -->
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px; background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(56, 189, 248, 0.2); border-radius: var(--radius-md); padding: 4px 10px; flex-shrink: 0;">
        
        <!-- Active Scope -->
        <div style="display: flex; align-items: center; gap: 6px; font-size: 11px;">
          <span style="font-weight: 700; color: #94a3b8;">🏢 Scope:</span>
          <span style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 700; border: 1px solid rgba(56, 189, 248, 0.3);">
            ${kpi.locationSummaryText}
          </span>
          <span style="color: #64748b; font-size: 10.5px;">(${kpi.distinctPartsCount} parts / ${kpi.recordsCount} txns)</span>
        </div>

        <!-- 5 KPI Pills -->
        <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
          <div style="display: inline-flex; align-items: center; gap: 4px; background: rgba(2, 132, 199, 0.12); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 4px; padding: 2px 6px; font-size: 11px;" title="Gross store issues">
            <span style="font-weight: 700; color: #38bdf8;">ISSUED:</span>
            <span style="font-weight: 900; color: #fff; font-family: var(--font-mono); font-size: 12px;">${kpi.totalIssued} pcs</span>
          </div>

          <div style="display: inline-flex; align-items: center; gap: 4px; background: rgba(16, 185, 129, 0.15); border: 1.5px solid #10b981; border-radius: 4px; padding: 2px 6px; font-size: 11px;" title="Successfully installed on machines">
            <span style="font-weight: 800; color: #34d399;">USED:</span>
            <span style="font-weight: 900; color: #34d399; font-family: var(--font-mono); font-size: 12.5px;">${kpi.totalUsed} pcs</span>
          </div>

          <div style="display: inline-flex; align-items: center; gap: 4px; background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(251, 191, 36, 0.3); border-radius: 4px; padding: 2px 6px; font-size: 11px;" title="Returned to store">
            <span style="font-weight: 700; color: #fbbf24;">RETURNED:</span>
            <span style="font-weight: 900; color: #fbbf24; font-family: var(--font-mono); font-size: 12px;">${kpi.totalReturned} pcs</span>
          </div>

          <div style="display: inline-flex; align-items: center; gap: 4px; background: rgba(139, 92, 246, 0.12); border: 1px solid rgba(167, 139, 250, 0.3); border-radius: 4px; padding: 2px 6px; font-size: 11px;" title="In floor inventory">
            <span style="font-weight: 700; color: #c084fc;">UNRETURNED:</span>
            <span style="font-weight: 900; color: #c084fc; font-family: var(--font-mono); font-size: 12px;">${kpi.currentUnreturned} pcs</span>
          </div>

          <div style="display: inline-flex; align-items: center; gap: 4px; background: rgba(244, 63, 94, 0.12); border: 1px solid rgba(251, 113, 133, 0.3); border-radius: 4px; padding: 2px 6px; font-size: 11px;" title="Total consumption replacement value">
            <span style="font-weight: 700; color: #fb7185;">VALUE:</span>
            <span style="font-weight: 900; color: #fff; font-family: var(--font-mono); font-size: 12px;">BDT ${kpi.totalValue.toLocaleString()}</span>
          </div>
        </div>

      </div>

      <!-- 3. DATA TABLES (Flex 1, Maximize Viewport) -->
      ${spareFilterState.viewMode === 'SUMMARY' ? `
        <!-- Aggregated Summary Table Grouped by Location & Part -->
        <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); overflow: hidden; box-shadow: var(--shadow-sm); display: flex; flex-direction: column; flex: 1; min-height: 0;">
          <div class="table-responsive" style="flex: 1; min-height: 0; overflow-y: auto;">
            <table class="data-table" style="width: 100%; min-width: 1100px; border-collapse: collapse; margin: 0; font-size: 11.5px;">
              <thead>
                <tr style="position: sticky; top: 0; z-index: 2; background: #0b1329;">
                  <th style="width: 40px; text-align: center; padding: 6px 8px;">SL</th>
                  <th style="min-width: 220px; text-align: left; padding: 6px 8px;">Location Hierarchy</th>
                  <th style="min-width: 160px; text-align: left; padding: 6px 8px;">Spare Part Name</th>
                  <th style="min-width: 110px; text-align: left; padding: 6px 8px;">Part Number</th>
                  <th style="min-width: 100px; text-align: left; padding: 6px 8px;">Category</th>
                  <th style="text-align: center; width: 75px; color: #38bdf8; padding: 6px 8px;">Issued</th>
                  <th style="text-align: center; width: 85px; color: #34d399; font-weight: 800; padding: 6px 8px;">Used</th>
                  <th style="text-align: center; width: 80px; color: #fbbf24; padding: 6px 8px;">Returned</th>
                  <th style="text-align: center; width: 85px; color: #c084fc; padding: 6px 8px;">Unreturned</th>
                  <th style="text-align: right; width: 100px; padding: 6px 8px;">Unit Price</th>
                  <th style="text-align: right; width: 110px; color: #38bdf8; padding: 6px 8px;">Total Value</th>
                  <th style="text-align: center; width: 90px; padding: 6px 8px;">Machines</th>
                </tr>
              </thead>
              <tbody>
                ${aggregatedList.length === 0 ? `
                  <tr><td colspan="12" style="text-align: center; padding: 24px; color: var(--text-muted);">No spare parts consumption records found for the selected filter criteria.</td></tr>
                ` : aggregatedList.map((agg, idx) => `
                  <tr style="border-bottom: 1px solid rgba(255,255,255,0.06);" class="hover-row">
                    <td style="text-align: center; color: var(--text-muted); font-weight: 700; padding: 5px 8px;">${idx + 1}</td>
                    <td style="padding: 5px 8px;">
                      <div style="display: flex; flex-direction: column; gap: 1px;">
                        <div style="font-size: 11.5px; font-weight: 700; color: #38bdf8; display: flex; align-items: center; gap: 3px; white-space: nowrap;">
                          <span>🏢 ${agg.unitName || 'Unit'}</span>
                          <span style="color: #64748b;">›</span>
                          <span style="color: #f1f5f9;">${agg.floorName || 'Floor'}</span>
                        </div>
                        <div style="font-size: 10px; color: #94a3b8; display: flex; align-items: center; gap: 3px; white-space: nowrap;">
                          <span style="color: #34d399; font-weight: 600;">⚡ ${agg.lineName || 'Line'}</span>
                          <span style="color: #475569;">|</span>
                          <span>${agg.groupName || 'Group'}</span>
                        </div>
                      </div>
                    </td>
                    <td style="font-weight: 800; color: #fff; font-size: 12px; padding: 5px 8px;">
                      ${agg.partName}
                    </td>
                    <td style="padding: 5px 8px;">
                      <code style="background: rgba(56, 189, 248, 0.12); color: #38bdf8; padding: 1px 5px; border-radius: 3px; font-size: 11px; font-weight: 700; border: 1px solid rgba(56, 189, 248, 0.25); white-space: nowrap;">
                        ${agg.partNumber}
                      </code>
                    </td>
                    <td style="padding: 5px 8px;">
                      <span class="badge badge-idle" style="font-size: 10px; padding: 2px 6px; white-space: nowrap;">
                        ${agg.category}
                      </span>
                    </td>
                    <td style="text-align: center; font-weight: 700; color: #fff; padding: 5px 8px;">${agg.totalIssued}</td>
                    <td style="text-align: center; font-weight: 900; color: #34d399; font-size: 12.5px; background: rgba(16, 185, 129, 0.08); padding: 5px 8px;">${agg.totalUsed}</td>
                    <td style="text-align: center; font-weight: 700; color: #fbbf24; padding: 5px 8px;">${agg.totalReturned}</td>
                    <td style="text-align: center; font-weight: 700; color: #c084fc; padding: 5px 8px;">${agg.currentUnreturned}</td>
                    <td style="text-align: right; font-family: var(--font-mono); font-size: 11.5px; color: #cbd5e1; white-space: nowrap; padding: 5px 8px;">BDT ${agg.unitPrice.toLocaleString()}</td>
                    <td style="text-align: right; font-family: var(--font-mono); font-weight: 800; color: #38bdf8; font-size: 12px; white-space: nowrap; padding: 5px 8px;">BDT ${agg.totalValue.toLocaleString()}</td>
                    <td style="text-align: center; white-space: nowrap; padding: 5px 8px;">
                      <span class="badge badge-active" style="font-size: 10px; padding: 2px 6px;">${agg.machinesUsedCount} Unit(s)</span>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
              ${aggregatedList.length > 0 ? `
                <tfoot style="position: sticky; bottom: 0; z-index: 2;">
                  <tr style="background: #0b1329; font-weight: 800; border-top: 2px solid #38bdf8;">
                    <td colspan="5" style="text-align: right; color: #fff; font-size: 11.5px; letter-spacing: 0.5px; padding: 6px 12px;">TOTAL:</td>
                    <td style="text-align: center; color: #38bdf8; font-size: 12px; font-weight: 800; padding: 6px 8px;">${kpi.totalIssued} pcs</td>
                    <td style="text-align: center; color: #34d399; font-size: 13px; font-weight: 900; background: rgba(16, 185, 129, 0.15); padding: 6px 8px;">${kpi.totalUsed} pcs</td>
                    <td style="text-align: center; color: #fbbf24; font-size: 12px; font-weight: 800; padding: 6px 8px;">${kpi.totalReturned} pcs</td>
                    <td style="text-align: center; color: #c084fc; font-size: 12px; font-weight: 800; padding: 6px 8px;">${kpi.currentUnreturned} pcs</td>
                    <td></td>
                    <td style="text-align: right; color: #38bdf8; font-size: 12.5px; font-family: var(--font-mono); font-weight: 800; white-space: nowrap; padding: 6px 8px;">BDT ${kpi.totalValue.toLocaleString()}</td>
                    <td></td>
                  </tr>
                </tfoot>
              ` : ''}
            </table>
          </div>
        </div>
      ` : `
        <!-- Detailed Transaction Ledger Table -->
        <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); overflow: hidden; box-shadow: var(--shadow-sm); display: flex; flex-direction: column; flex: 1; min-height: 0;">
          <div class="table-responsive" style="flex: 1; min-height: 0; overflow-y: auto;">
            <table class="data-table" style="width: 100%; min-width: 1200px; border-collapse: collapse; margin: 0; font-size: 11px;">
              <thead>
                <tr style="position: sticky; top: 0; z-index: 2; background: #0b1329;">
                  <th style="width: 35px; text-align: center; padding: 6px 8px;">SL</th>
                  <th style="width: 85px; text-align: left; padding: 6px 8px;">Date</th>
                  <th style="width: 100px; text-align: left; padding: 6px 8px;">Requisition #</th>
                  <th style="min-width: 200px; text-align: left; padding: 6px 8px;">Location Hierarchy</th>
                  <th style="width: 110px; text-align: left; padding: 6px 8px;">Machine Serial</th>
                  <th style="min-width: 150px; text-align: left; padding: 6px 8px;">Spare Part Name</th>
                  <th style="text-align: center; width: 80px; padding: 6px 8px;">Status</th>
                  <th style="text-align: center; width: 60px; padding: 6px 8px;">Issued</th>
                  <th style="text-align: center; width: 60px; color: #34d399; padding: 6px 8px;">Used</th>
                  <th style="text-align: center; width: 65px; color: #fbbf24; padding: 6px 8px;">Returned</th>
                  <th style="min-width: 120px; text-align: left; padding: 6px 8px;">Technician</th>
                  <th style="min-width: 100px; text-align: left; padding: 6px 8px;">Issued By</th>
                  <th style="min-width: 140px; text-align: left; padding: 6px 8px;">Reason / Remarks</th>
                </tr>
              </thead>
              <tbody>
                ${transactions.length === 0 ? `
                  <tr><td colspan="13" style="text-align: center; padding: 24px; color: var(--text-muted);">No transaction logs match the active filter criteria.</td></tr>
                ` : transactions.map((t, idx) => `
                  <tr style="border-bottom: 1px solid rgba(255,255,255,0.06);" class="hover-row">
                    <td style="text-align: center; color: var(--text-muted); font-weight: 700; padding: 5px 8px;">${idx + 1}</td>
                    <td style="font-family: var(--font-mono); font-size: 11px; color: #38bdf8; white-space: nowrap; padding: 5px 8px;">${t.date}</td>
                    <td style="font-family: var(--font-mono); font-weight: 700; color: #fff; font-size: 11px; white-space: nowrap; padding: 5px 8px;">${t.reqNumber}</td>
                    <td style="font-size: 11px; color: var(--text-secondary); padding: 5px 8px;">
                      <div style="display: flex; flex-direction: column; gap: 1px;">
                        <span style="font-weight: 700; color: #38bdf8; font-size: 11px; white-space: nowrap;">${t.unitName || 'Unit'} › ${t.floorName || 'Floor'}</span>
                        <span style="color: #94a3b8; font-size: 10px; white-space: nowrap;">${t.lineName || 'Line'} (${t.groupName || 'Group'})</span>
                      </div>
                    </td>
                    <td style="font-family: var(--font-mono); font-weight: 700; color: #38bdf8; white-space: nowrap; padding: 5px 8px;">${t.machineSerial}</td>
                    <td style="font-weight: 700; color: #fff; padding: 5px 8px;">
                      ${t.partName} <span style="font-size: 10px; color: var(--text-muted); font-family: var(--font-mono);">(${t.partNumber})</span>
                    </td>
                    <td style="text-align: center; white-space: nowrap; padding: 5px 8px;">
                      <span class="badge ${t.status === 'USED' ? 'badge-active' : (t.status === 'RETURNED' ? 'badge-maint' : (t.status === 'CANCELLED' ? 'badge-breakdown' : 'badge-idle'))}" style="font-size: 10px; padding: 1px 5px;">
                        ${t.status}
                      </span>
                    </td>
                    <td style="text-align: center; font-weight: 700; padding: 5px 8px;">${t.issuedQty}</td>
                    <td style="text-align: center; font-weight: 800; color: #34d399; padding: 5px 8px;">${t.usedQty}</td>
                    <td style="text-align: center; font-weight: 700; color: #fbbf24; padding: 5px 8px;">${t.returnedQty}</td>
                    <td style="font-size: 11px; color: #fff; padding: 5px 8px;">${t.technician}</td>
                    <td style="font-size: 11px; color: var(--text-secondary); padding: 5px 8px;">${t.issuedBy}</td>
                    <td style="font-size: 10.5px; color: var(--text-secondary); padding: 5px 8px;">${t.reason || t.remarks || '—'}</td>
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

// 4. 1-CLICK EXPORT CENTER TAB
function renderExportCenterTab(machines, transfers, logs, catalog) {
  return `
    <div style="display: flex; flex-direction: column; gap: 8px; height: 100%; flex: 1; min-height: 0; overflow-y: auto;">
      
      <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 10px 14px; flex-shrink: 0;">
        <h3 style="margin: 0 0 2px 0; font-size: 14px; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 6px;">
          <span>📦</span> 1-Click Excel Export &amp; Analytics Hub
        </h3>
        <p style="margin: 0; font-size: 11.5px; color: var(--text-secondary);">
          Download production-ready, perfectly formatted <strong>.xlsx</strong> workbooks containing complete datasets, calculated metrics, and full audit trails.
        </p>
      </div>

      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
        
        <!-- Card 1: Complete Machine Inventory -->
        <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 12px 14px; display: flex; flex-direction: column; justify-content: space-between; gap: 8px;">
          <div>
            <div style="font-size: 14px; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 6px;">
              <span>🧵</span> Complete Machinery Inventory
            </div>
            <div style="font-size: 11px; color: var(--text-secondary); margin-top: 3px; line-height: 1.35;">
              Full corporate machine asset database (${machines.length} machines) including brand, model, factory, floor, line, and custom fields.
            </div>
          </div>
          <button id="btn-center-export-machines" class="btn btn-primary btn-sm" style="font-weight: 700; height: 30px; font-size: 11.5px; background: linear-gradient(135deg, #0284c7, #0369a1);">
            📊 Download Machine Inventory Excel
          </button>
        </div>

        <!-- Card 2: Transfers & Movement Logs -->
        <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 12px 14px; display: flex; flex-direction: column; justify-content: space-between; gap: 8px;">
          <div>
            <div style="font-size: 14px; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 6px;">
              <span>🔄</span> Machine Transfers Ledger
            </div>
            <div style="font-size: 11px; color: var(--text-secondary); margin-top: 3px; line-height: 1.35;">
              Comprehensive relocation history (${transfers.length} records) with source/destination units, tracking numbers, gate passes, and approvals.
            </div>
          </div>
          <button id="btn-center-export-transfers" class="btn btn-secondary btn-sm" style="font-weight: 700; height: 30px; font-size: 11.5px; border-color: #38bdf8; color: #38bdf8;">
            📊 Download Transfers Ledger Excel
          </button>
        </div>

        <!-- Card 3: Spare Parts Replacements -->
        <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 12px 14px; display: flex; flex-direction: column; justify-content: space-between; gap: 8px;">
          <div>
            <div style="font-size: 14px; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 6px;">
              <span>⚙️</span> Spare Parts History Export
            </div>
            <div style="font-size: 11px; color: var(--text-secondary); margin-top: 3px; line-height: 1.35;">
              Spare parts replacement logs, machine wear-and-tear histories, and maintenance service records (${logs.length} records).
            </div>
          </div>
          <button id="btn-center-export-spareparts" class="btn btn-secondary btn-sm" style="font-weight: 700; height: 30px; font-size: 11.5px; border-color: #34d399; color: #34d399;">
            📊 Download Spare Parts Excel
          </button>
        </div>

        <!-- Card 4: ENT Lab Boards -->
        <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 12px 14px; display: flex; flex-direction: column; justify-content: space-between; gap: 8px;">
          <div>
            <div style="font-size: 14px; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 6px;">
              <span>⚡</span> ENT Lab Boards &amp; Movement Ledger
            </div>
            <div style="font-size: 11px; color: var(--text-secondary); margin-top: 3px; line-height: 1.35;">
              Full Board/PCB master inventory, machine installation trails, in-house &amp; external repair turnarounds, and audit history.
            </div>
          </div>
          <button id="btn-center-export-etlab" class="btn btn-secondary btn-sm" style="font-weight: 700; height: 30px; font-size: 11.5px; border-color: #38bdf8; color: #38bdf8;">
            📊 Download ENT Lab Excel
          </button>
        </div>

        <!-- Card 5: Complete Master ERP Workbook -->
        <div style="grid-column: span 2; background: linear-gradient(135deg, rgba(2, 132, 199, 0.12), rgba(15, 23, 42, 0.8)); border: 1.5px solid rgba(56, 189, 248, 0.4); border-radius: var(--radius-md); padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
          <div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 18px;">📜</span>
              <div style="font-size: 14px; font-weight: 800; color: #fff;">Complete Corporate Master ERP Workbook</div>
            </div>
            <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px; line-height: 1.35;">
              Multi-sheet workbook containing Machinery Inventory, Transfers, Spare Parts, ENT Lab Boards, and Catalog.
            </div>
          </div>
          <button id="btn-center-export-lifetime" class="btn btn-primary btn-sm" style="font-weight: 800; height: 30px; font-size: 11.5px; background: linear-gradient(135deg, #0284c7, #0369a1); box-shadow: 0 2px 8px rgba(2, 132, 199, 0.35);">
            📥 Download Master 7-Sheet ERP Excel
          </button>
        </div>

      </div>
    </div>
  `;
}

export function initReportsEvents() {
  const refreshReportsView = () => {
    const container = document.getElementById('main-view-container');
    if (container) {
      container.innerHTML = renderReportsView();
      initReportsEvents();
    }
  };

  const switchReportTab = (tab) => {
    if (!tab) return;
    currentReportTab = tab;
    state.set('reportActiveTab', tab);

    // 1. Update tab buttons in-place
    document.querySelectorAll('[data-report-tab-btn]').forEach(btn => {
      if (btn.getAttribute('data-report-tab-btn') === tab) {
        btn.classList.remove('btn-ghost');
        btn.classList.add('btn-primary');
      } else {
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-ghost');
      }
    });

    // 2. Synchronize left sidebar active subitem highlight
    try {
      updateSidebarActiveState('reports', null);
    } catch (err) { }

    // 3. Update #reports-tab-content in-place with zero scroll jumping
    const tabContent = document.getElementById('reports-tab-content');
    if (tabContent) {
      const allMachines = machineService.getMachines({ limit: 'ALL' }).items || [];
      const allTransfers = transferService.getTransferRequests({ status: 'ALL' }) || [];
      const completedTransfers = storage.getTable(TABLE_NAMES.TRANSFERS) || [];
      const allHistory = historyService.getMachineHistory() || [];
      const sparePartsMaster = historyService.getSparePartsMaster() || [];
      const etLabBoards = etLabService.getBoards() || [];
      const floors = storage.getTable(TABLE_NAMES.FLOORS) || [];
      const replacementLogs = allHistory.filter(h => h.actionType === 'SPARE_PART_REPLACEMENT' || h.sparePart);

      tabContent.innerHTML = renderActiveTabHtml({ allMachines, allTransfers, completedTransfers, replacementLogs, sparePartsMaster, etLabBoards, floors });
      initReportsEvents();
    } else {
      refreshReportsView();
    }
  };

  // Guide Drawer Toggle Listeners
  const btnToggleGuide = document.getElementById('btn-toggle-reports-guide');
  const btnCloseGuide = document.getElementById('btn-close-reports-guide');
  const guideDrawer = document.getElementById('reports-guide-drawer');
  if (btnToggleGuide && guideDrawer) {
    btnToggleGuide.addEventListener('click', (e) => {
      e.preventDefault();
      const isHidden = guideDrawer.style.display === 'none';
      guideDrawer.style.display = isHidden ? 'block' : 'none';
      btnToggleGuide.classList.toggle('btn-primary', isHidden);
      btnToggleGuide.classList.toggle('btn-secondary', !isHidden);
    });
  }
  if (btnCloseGuide && guideDrawer) {
    btnCloseGuide.addEventListener('click', (e) => {
      e.preventDefault();
      guideDrawer.style.display = 'none';
      if (btnToggleGuide) {
        btnToggleGuide.classList.remove('btn-primary');
        btnToggleGuide.classList.add('btn-secondary');
      }
    });
  }

  // Tab buttons click handler (In-place, Zero-Jump)
  document.querySelectorAll('[data-report-tab-btn]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const tab = btn.getAttribute('data-report-tab-btn');
      switchReportTab(tab);
    });
  });

  // Spare Parts Filter Events
  const spGrp = document.getElementById('sp-filter-group');
  if (spGrp) {
    spGrp.addEventListener('change', (e) => {
      spareFilterState.groupId = e.target.value;
      spareFilterState.unitId = '';
      spareFilterState.floorId = '';
      spareFilterState.lineId = '';
      spareFilterState.machineId = '';
      refreshReportsView();
    });
  }

  const spUnt = document.getElementById('sp-filter-unit');
  if (spUnt) {
    spUnt.addEventListener('change', (e) => {
      const unitId = e.target.value;
      spareFilterState.unitId = unitId;
      spareFilterState.floorId = '';
      spareFilterState.lineId = '';
      spareFilterState.machineId = '';
      if (unitId) {
        const unit = masterDataService.getUnitById(unitId) || storage.getItem(TABLE_NAMES.UNITS, unitId);
        if (unit && unit.groupId) {
          spareFilterState.groupId = unit.groupId;
        }
      }
      refreshReportsView();
    });
  }

  const spFlr = document.getElementById('sp-filter-floor');
  if (spFlr) {
    spFlr.addEventListener('change', (e) => {
      const floorId = e.target.value;
      spareFilterState.floorId = floorId;
      spareFilterState.lineId = '';
      spareFilterState.machineId = '';
      if (floorId) {
        const floor = masterDataService.getFloorById(floorId) || storage.getItem(TABLE_NAMES.FLOORS, floorId);
        if (floor && floor.unitId) {
          spareFilterState.unitId = floor.unitId;
          const unit = masterDataService.getUnitById(floor.unitId) || storage.getItem(TABLE_NAMES.UNITS, floor.unitId);
          if (unit && unit.groupId) {
            spareFilterState.groupId = unit.groupId;
          }
        }
      }
      refreshReportsView();
    });
  }

  const spLin = document.getElementById('sp-filter-line');
  if (spLin) {
    spLin.addEventListener('change', (e) => {
      const lineId = e.target.value;
      spareFilterState.lineId = lineId;
      spareFilterState.machineId = '';
      if (lineId) {
        const line = masterDataService.getLineById(lineId) || storage.getItem(TABLE_NAMES.LINES, lineId);
        if (line && line.floorId) {
          spareFilterState.floorId = line.floorId;
          const floor = masterDataService.getFloorById(line.floorId) || storage.getItem(TABLE_NAMES.FLOORS, line.floorId);
          if (floor && floor.unitId) {
            spareFilterState.unitId = floor.unitId;
            const unit = masterDataService.getUnitById(floor.unitId) || storage.getItem(TABLE_NAMES.UNITS, floor.unitId);
            if (unit && unit.groupId) {
              spareFilterState.groupId = unit.groupId;
            }
          }
        }
      }
      refreshReportsView();
    });
  }

  const spMach = document.getElementById('sp-filter-machine');
  if (spMach) {
    spMach.addEventListener('change', (e) => {
      spareFilterState.machineId = e.target.value;
      refreshReportsView();
    });
  }

  const spPart = document.getElementById('sp-filter-part');
  if (spPart) {
    spPart.addEventListener('change', (e) => {
      spareFilterState.sparePart = e.target.value;
      refreshReportsView();
    });
  }

  const spStat = document.getElementById('sp-filter-status');
  if (spStat) {
    spStat.addEventListener('change', (e) => {
      spareFilterState.status = e.target.value;
      refreshReportsView();
    });
  }

  const spDateFrom = document.getElementById('sp-filter-date-from');
  if (spDateFrom) {
    spDateFrom.addEventListener('change', (e) => {
      spareFilterState.dateFrom = e.target.value;
      refreshReportsView();
    });
  }

  const spDateTo = document.getElementById('sp-filter-date-to');
  if (spDateTo) {
    spDateTo.addEventListener('change', (e) => {
      spareFilterState.dateTo = e.target.value;
      refreshReportsView();
    });
  }

  const spSearch = document.getElementById('sp-filter-search');
  if (spSearch) {
    spSearch.addEventListener('input', (e) => {
      spareFilterState.search = e.target.value;
      clearTimeout(window._spSearchTimer);
      window._spSearchTimer = setTimeout(() => {
        refreshReportsView();
      }, 300);
    });
  }

  const spClear = document.getElementById('sp-btn-clear-filters');
  if (spClear) {
    spClear.addEventListener('click', () => {
      spareFilterState = {
        groupId: '',
        unitId: '',
        floorId: '',
        lineId: '',
        machineId: '',
        sparePart: '',
        status: 'ALL',
        dateFrom: '',
        dateTo: '',
        search: '',
        viewMode: spareFilterState.viewMode || 'SUMMARY'
      };
      notificationService.info('Spare parts filters cleared.');
      refreshReportsView();
    });
  }

  const spExport = document.getElementById('sp-btn-export-excel');
  if (spExport) {
    spExport.addEventListener('click', () => {
      notificationService.withLoading(spExport, async () => {
        await historyService.exportSparePartsConsumptionExcel(spareFilterState);
      }, 'Exporting Spare Parts Report...', 'Spare parts consumption report exported to Excel!');
    });
  }

  document.querySelectorAll('[data-sp-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      spareFilterState.viewMode = btn.getAttribute('data-sp-mode');
      refreshReportsView();
    });
  });

  // ==========================================
  // MACHINE SUMMARY INTERACTIVE ENGINE HANDLERS
  // ==========================================

  const mrGrp = document.getElementById('mr-filter-group');
  if (mrGrp) {
    mrGrp.addEventListener('change', (e) => {
      machineReportFilterState.groupId = e.target.value;
      machineReportFilterState.unitId = '';
      machineReportFilterState.floorId = '';
      machineReportFilterState.lineId = '';
      refreshReportsView();
    });
  }

  const mrUnt = document.getElementById('mr-filter-unit');
  if (mrUnt) {
    mrUnt.addEventListener('change', (e) => {
      const unitId = e.target.value;
      machineReportFilterState.unitId = unitId;
      machineReportFilterState.floorId = '';
      machineReportFilterState.lineId = '';
      if (unitId) {
        const unit = masterDataService.getUnitById(unitId) || storage.getItem(TABLE_NAMES.UNITS, unitId);
        if (unit && unit.groupId) {
          machineReportFilterState.groupId = unit.groupId;
        }
      }
      refreshReportsView();
    });
  }

  const mrFlr = document.getElementById('mr-filter-floor');
  if (mrFlr) {
    mrFlr.addEventListener('change', (e) => {
      const floorId = e.target.value;
      machineReportFilterState.floorId = floorId;
      machineReportFilterState.lineId = '';
      if (floorId) {
        const floor = masterDataService.getFloorById(floorId) || storage.getItem(TABLE_NAMES.FLOORS, floorId);
        if (floor && floor.unitId) {
          machineReportFilterState.unitId = floor.unitId;
          const unit = masterDataService.getUnitById(floor.unitId) || storage.getItem(TABLE_NAMES.UNITS, floor.unitId);
          if (unit && unit.groupId) {
            machineReportFilterState.groupId = unit.groupId;
          }
        }
      }
      refreshReportsView();
    });
  }

  const mrLin = document.getElementById('mr-filter-line');
  if (mrLin) {
    mrLin.addEventListener('change', (e) => {
      const lineId = e.target.value;
      machineReportFilterState.lineId = lineId;
      if (lineId) {
        const line = masterDataService.getLineById(lineId) || storage.getItem(TABLE_NAMES.LINES, lineId);
        if (line && line.floorId) {
          machineReportFilterState.floorId = line.floorId;
          const floor = masterDataService.getFloorById(line.floorId) || storage.getItem(TABLE_NAMES.FLOORS, line.floorId);
          if (floor && floor.unitId) {
            machineReportFilterState.unitId = floor.unitId;
            const unit = masterDataService.getUnitById(floor.unitId) || storage.getItem(TABLE_NAMES.UNITS, floor.unitId);
            if (unit && unit.groupId) {
              machineReportFilterState.groupId = unit.groupId;
            }
          }
        }
      }
      refreshReportsView();
    });
  }

  const mrStat = document.getElementById('mr-filter-status');
  if (mrStat) {
    mrStat.addEventListener('change', (e) => {
      machineReportFilterState.status = e.target.value;
      refreshReportsView();
    });
  }

  const mrReset = document.getElementById('mr-btn-reset-filters');
  if (mrReset) {
    mrReset.addEventListener('click', () => {
      machineReportFilterState = { groupId: '', unitId: '', floorId: '', lineId: '', status: 'ALL' };
      refreshReportsView();
    });
  }

  document.querySelectorAll('.mr-crumb-link').forEach(el => {
    el.addEventListener('click', () => {
      const level = el.getAttribute('data-level');
      const id = el.getAttribute('data-id');
      if (level === 'all') {
        machineReportFilterState.groupId = '';
        machineReportFilterState.unitId = '';
        machineReportFilterState.floorId = '';
        machineReportFilterState.lineId = '';
      } else if (level === 'group') {
        machineReportFilterState.groupId = id;
        machineReportFilterState.unitId = '';
        machineReportFilterState.floorId = '';
        machineReportFilterState.lineId = '';
      } else if (level === 'unit') {
        machineReportFilterState.unitId = id;
        machineReportFilterState.floorId = '';
        machineReportFilterState.lineId = '';
        if (id) {
          const unit = masterDataService.getUnitById(id) || storage.getItem(TABLE_NAMES.UNITS, id);
          if (unit && unit.groupId) {
            machineReportFilterState.groupId = unit.groupId;
          }
        }
      } else if (level === 'floor') {
        machineReportFilterState.floorId = id;
        machineReportFilterState.lineId = '';
        if (id) {
          const floor = masterDataService.getFloorById(id) || storage.getItem(TABLE_NAMES.FLOORS, id);
          if (floor && floor.unitId) {
            machineReportFilterState.unitId = floor.unitId;
            const unit = masterDataService.getUnitById(floor.unitId) || storage.getItem(TABLE_NAMES.UNITS, floor.unitId);
            if (unit && unit.groupId) {
              machineReportFilterState.groupId = unit.groupId;
            }
          }
        }
      }
      refreshReportsView();
    });
  });

  // Machine Summary Excel
  const btnExpMach = document.getElementById('btn-export-machine-report-excel');
  if (btnExpMach) {
    btnExpMach.addEventListener('click', () => {
      notificationService.withLoading(btnExpMach, async () => {
        const allMachines = machineService.getMachines({ limit: 'ALL' }).items || [];
        const { groupedList, grandTotals } = getMachineSummaryGroupedData(allMachines);
        const fileName = `Machine_Summary_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
        await excelService.exportMachineSummaryReportExcel(groupedList, grandTotals, fileName);
      }, 'Exporting Machine Summary Report...', 'Machine Summary exported to Excel with live formulas!');
    });
  }

  // Machine Summary PDF / Print
  const btnPrintMach = document.getElementById('btn-print-machine-report-pdf');
  if (btnPrintMach) {
    btnPrintMach.addEventListener('click', () => {
      const allMachines = machineService.getMachines({ limit: 'ALL' }).items || [];
      const { groupedList, grandTotals, lookups } = getMachineSummaryGroupedData(allMachines);
      const { grpMap, untMap, flrMap, linMap } = lookups;

      const currentGroup = grpMap.get(machineReportFilterState.groupId);
      const currentUnit = untMap.get(machineReportFilterState.unitId);
      const currentFloor = flrMap.get(machineReportFilterState.floorId);
      const currentLine = linMap.get(machineReportFilterState.lineId);

      let locSummary = 'All Enterprise';
      if (currentLine) locSummary = `Line: ${currentLine.name} (${currentFloor?.name || ''}, ${currentUnit?.name || ''})`;
      else if (currentFloor) locSummary = `Floor: ${currentFloor.name} (${currentUnit?.name || ''})`;
      else if (currentUnit) locSummary = `Unit: ${currentUnit.name} (${currentGroup?.name || ''})`;
      else if (currentGroup) locSummary = `Group: ${currentGroup.name}`;

      pdfService.generateMachineSummaryPDF({
        title: 'Machine Summary Report',
        subtitle: 'Al-Muslim Group Central Engineering & Maintenance Department',
        filterSummary: `Location: ${locSummary} | Status: ${machineReportFilterState.status}`,
        groupedData: groupedList,
        grandTotals
      });
    });
  }

  // Real-time database & local listeners for Transfer Reports tab —
  // Fires when any device writes to TRANSFERS or TRANSFER_REQUESTS or locally.
  const handleTransfersUpdated = () => {
    if (currentReportTab === 'transfers') {
      const tabContent = document.getElementById('reports-tab-content');
      if (tabContent) {
        const allMachines = machineService.getMachines({ limit: 'ALL' }).items || [];
        const allTransfers = transferService.getTransferRequests({ status: 'ALL' }) || [];
        const completedTransfers = storage.getTable(TABLE_NAMES.TRANSFERS) || [];
        const allHistory = historyService.getMachineHistory() || [];
        const sparePartsMaster = historyService.getSparePartsMaster() || [];
        const etLabBoards = etLabService.getBoards() || [];
        const floors = storage.getTable(TABLE_NAMES.FLOORS) || [];
        const replacementLogs = allHistory.filter(h => h.actionType === 'SPARE_PART_REPLACEMENT' || h.sparePart);
        tabContent.innerHTML = renderActiveTabHtml({ allMachines, allTransfers, completedTransfers, replacementLogs, sparePartsMaster, etLabBoards, floors });
        initReportsEvents();
      }
    }
  };

  if (window._reportsTransferListener) {
    window.removeEventListener('erp:transfers-updated', window._reportsTransferListener);
    window.removeEventListener('erp:inventory-updated', window._reportsTransferListener);
    window.removeEventListener('erp:storage-updated', window._reportsTransferListener);
  }
  window._reportsTransferListener = handleTransfersUpdated;
  window.addEventListener('erp:transfers-updated', handleTransfersUpdated);
  window.addEventListener('erp:inventory-updated', handleTransfersUpdated);
  window.addEventListener('erp:storage-updated', handleTransfersUpdated);

  // Helper to re-render Transfer Reports tab in place without page jump
  const refreshTransferReportsTabInPlace = () => {
    if (currentReportTab === 'transfers') {
      const tabContent = document.getElementById('reports-tab-content');
      if (tabContent) {
        const allMachines = machineService.getMachines({ limit: 'ALL' }).items || [];
        const allTransfers = transferService.getTransferRequests({ status: 'ALL' }) || [];
        const completedTransfers = storage.getTable(TABLE_NAMES.TRANSFERS) || [];
        const allHistory = historyService.getMachineHistory() || [];
        const sparePartsMaster = historyService.getSparePartsMaster() || [];
        const etLabBoards = etLabService.getBoards() || [];
        const floors = storage.getTable(TABLE_NAMES.FLOORS) || [];
        const replacementLogs = allHistory.filter(h => h.actionType === 'SPARE_PART_REPLACEMENT' || h.sparePart);
        
        const newHtml = renderActiveTabHtml({ allMachines, allTransfers, completedTransfers, replacementLogs, sparePartsMaster, etLabBoards, floors });
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = newHtml;

        const kpiOld = document.getElementById('tr-kpi-container');
        const kpiNew = tempDiv.querySelector('#tr-kpi-container');
        if (kpiOld && kpiNew) kpiOld.innerHTML = kpiNew.innerHTML;

        const tableOld = document.getElementById('tr-table-container');
        const tableNew = tempDiv.querySelector('#tr-table-container');
        if (tableOld && tableNew) tableOld.innerHTML = tableNew.innerHTML;

        const headerOld = document.getElementById('tr-filter-header-count');
        const headerNew = tempDiv.querySelector('#tr-filter-header-count');
        if (headerOld && headerNew) headerOld.innerHTML = headerNew.innerHTML;

        const filterIds = [
          'tr-filter-group', 'tr-filter-unit', 'tr-filter-floor', 'tr-filter-line',
          'tr-filter-prev-floor', 'tr-filter-new-floor', 'tr-filter-prev-line', 'tr-filter-new-line',
          'tr-filter-status', 'tr-filter-by'
        ];
        filterIds.forEach(id => {
          const oldSelect = document.getElementById(id);
          const newSelect = tempDiv.querySelector('#' + id);
          if (oldSelect && newSelect && document.activeElement !== oldSelect) {
            oldSelect.innerHTML = newSelect.innerHTML;
            oldSelect.value = newSelect.value;
          }
        });

        document.querySelectorAll('#tr-kpi-container [data-tr-kpi-status]').forEach(card => {
          card.addEventListener('click', () => {
            const st = card.getAttribute('data-tr-kpi-status');
            transferReportFilterState.status = st === 'ALL' ? 'ALL' : st;
            transferReportFilterState.page = 1;
            refreshTransferReportsTabInPlace();
          });
        });

        document.querySelectorAll('#tr-table-container [data-tr-sort]').forEach(th => {
          th.addEventListener('click', () => {
            const field = th.getAttribute('data-tr-sort');
            if (transferReportFilterState.sortField === field) {
              transferReportFilterState.sortDirection = transferReportFilterState.sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
              transferReportFilterState.sortField = field;
              transferReportFilterState.sortDirection = 'asc';
            }
            refreshTransferReportsTabInPlace();
          });
        });

        document.querySelectorAll('#tr-table-container [data-tr-page]').forEach(btn => {
          btn.addEventListener('click', () => {
            const targetPage = parseInt(btn.getAttribute('data-tr-page'), 10);
            if (targetPage && !isNaN(targetPage) && targetPage !== transferReportFilterState.page) {
              transferReportFilterState.page = targetPage;
              refreshTransferReportsTabInPlace();
            }
          });
        });

        const trPageSize = document.getElementById('tr-page-size');
        if (trPageSize && !trPageSize.dataset.boundForTr) {
          trPageSize.dataset.boundForTr = 'true';
          trPageSize.addEventListener('change', (e) => {
            transferReportFilterState.pageSize = e.target.value === 'ALL' ? 'ALL' : parseInt(e.target.value, 10);
            transferReportFilterState.page = 1;
            refreshTransferReportsTabInPlace();
          });
        }
      } else {
        refreshReportsView();
      }
    } else {
      refreshReportsView();
    }
  };

  // ==========================================
  // TRANSFER REPORTS INTERACTIVE ENGINE HANDLERS
  // ==========================================
  // 1. Plant Location Hierarchy:
  const trGrp = document.getElementById('tr-filter-group');
  if (trGrp) {
    trGrp.addEventListener('change', (e) => {
      transferReportFilterState.groupId = e.target.value;
      transferReportFilterState.unitId = '';
      transferReportFilterState.floorId = '';
      transferReportFilterState.lineId = '';
      transferReportFilterState.page = 1;
      refreshTransferReportsTabInPlace();
    });
  }

  const trUnt = document.getElementById('tr-filter-unit');
  if (trUnt) {
    trUnt.addEventListener('change', (e) => {
      const unitId = e.target.value;
      transferReportFilterState.unitId = unitId;
      transferReportFilterState.floorId = '';
      transferReportFilterState.lineId = '';
      transferReportFilterState.page = 1;
      if (unitId) {
        const unit = masterDataService.getUnitById(unitId) || storage.getItem(TABLE_NAMES.UNITS, unitId);
        if (unit && unit.groupId) {
          transferReportFilterState.groupId = unit.groupId;
        }
      }
      refreshTransferReportsTabInPlace();
    });
  }

  const trFlr = document.getElementById('tr-filter-floor');
  if (trFlr) {
    trFlr.addEventListener('change', (e) => {
      const floorId = e.target.value;
      transferReportFilterState.floorId = floorId;
      transferReportFilterState.lineId = '';
      transferReportFilterState.page = 1;
      if (floorId) {
        const floor = masterDataService.getFloorById(floorId) || storage.getItem(TABLE_NAMES.FLOORS, floorId);
        if (floor && floor.unitId) {
          transferReportFilterState.unitId = floor.unitId;
          const unit = masterDataService.getUnitById(floor.unitId) || storage.getItem(TABLE_NAMES.UNITS, floor.unitId);
          if (unit && unit.groupId) {
            transferReportFilterState.groupId = unit.groupId;
          }
        }
      }
      refreshTransferReportsTabInPlace();
    });
  }

  const trLin = document.getElementById('tr-filter-line');
  if (trLin) {
    trLin.addEventListener('change', (e) => {
      const lineId = e.target.value;
      transferReportFilterState.lineId = lineId;
      transferReportFilterState.page = 1;
      if (lineId) {
        const line = masterDataService.getLineById(lineId) || storage.getItem(TABLE_NAMES.LINES, lineId);
        if (line && line.floorId) {
          transferReportFilterState.floorId = line.floorId;
          const floor = masterDataService.getFloorById(line.floorId) || storage.getItem(TABLE_NAMES.FLOORS, line.floorId);
          if (floor && floor.unitId) {
            transferReportFilterState.unitId = floor.unitId;
            const unit = masterDataService.getUnitById(floor.unitId) || storage.getItem(TABLE_NAMES.UNITS, floor.unitId);
            if (unit && unit.groupId) {
              transferReportFilterState.groupId = unit.groupId;
            }
          }
        }
      }
      refreshTransferReportsTabInPlace();
    });
  }

  // 2. Movement Specific Filters:
  const trPrevFlr = document.getElementById('tr-filter-prev-floor');
  if (trPrevFlr) {
    trPrevFlr.addEventListener('change', (e) => {
      transferReportFilterState.prevFloor = e.target.value;
      transferReportFilterState.prevLine = ''; // cascade clear
      transferReportFilterState.page = 1;
      refreshTransferReportsTabInPlace();
    });
  }

  const trNewFlr = document.getElementById('tr-filter-new-floor');
  if (trNewFlr) {
    trNewFlr.addEventListener('change', (e) => {
      transferReportFilterState.newFloor = e.target.value;
      transferReportFilterState.newLine = ''; // cascade clear
      transferReportFilterState.page = 1;
      refreshTransferReportsTabInPlace();
    });
  }

  const trPrevLin = document.getElementById('tr-filter-prev-line');
  if (trPrevLin) {
    trPrevLin.addEventListener('change', (e) => {
      transferReportFilterState.prevLine = e.target.value;
      transferReportFilterState.page = 1;
      refreshTransferReportsTabInPlace();
    });
  }

  const trNewLin = document.getElementById('tr-filter-new-line');
  if (trNewLin) {
    trNewLin.addEventListener('change', (e) => {
      transferReportFilterState.newLine = e.target.value;
      transferReportFilterState.page = 1;
      refreshTransferReportsTabInPlace();
    });
  }

  // 3. Status, Transferred By, Date Range & Global Search:
  const trStat = document.getElementById('tr-filter-status');
  if (trStat) {
    trStat.addEventListener('change', (e) => {
      transferReportFilterState.status = e.target.value;
      transferReportFilterState.page = 1;
      refreshTransferReportsTabInPlace();
    });
  }

  const trBy = document.getElementById('tr-filter-by');
  if (trBy) {
    trBy.addEventListener('change', (e) => {
      transferReportFilterState.transferredBy = e.target.value;
      transferReportFilterState.page = 1;
      refreshTransferReportsTabInPlace();
    });
  }

  const trDateFrom = document.getElementById('tr-filter-date-from');
  if (trDateFrom) {
    trDateFrom.addEventListener('change', (e) => {
      transferReportFilterState.dateFrom = e.target.value;
      transferReportFilterState.page = 1;
      refreshTransferReportsTabInPlace();
    });
  }

  const trDateTo = document.getElementById('tr-filter-date-to');
  if (trDateTo) {
    trDateTo.addEventListener('change', (e) => {
      transferReportFilterState.dateTo = e.target.value;
      transferReportFilterState.page = 1;
      refreshTransferReportsTabInPlace();
    });
  }

  const trSearch = document.getElementById('tr-filter-search');
  if (trSearch) {
    trSearch.addEventListener('input', (e) => {
      transferReportFilterState.search = e.target.value;
      transferReportFilterState.page = 1;
      clearTimeout(window._trSearchTimer);
      window._trSearchTimer = setTimeout(() => {
        refreshTransferReportsTabInPlace();
      }, 300);
    });
  }

  // 4. Reset / Clear Filters Button:
  const trClearBtn = document.getElementById('tr-btn-clear-filters');
  if (trClearBtn) {
    trClearBtn.addEventListener('click', () => {
      transferReportFilterState = {
        groupId: '',
        unitId: '',
        floorId: '',
        lineId: '',
        prevFloor: '',
        newFloor: '',
        prevLine: '',
        newLine: '',
        status: 'ALL',
        transferredBy: 'ALL',
        dateFrom: '',
        dateTo: '',
        search: '',
        sortField: 'requestedAt',
        sortDirection: 'desc',
        page: 1,
        pageSize: 25,
        viewMode: transferReportFilterState.viewMode || 'TABLE'
      };
      notificationService.info('Transfer report filters cleared.');
      refreshTransferReportsTabInPlace();
    });
  }

  // 5. Top KPI Card Click Handlers:
  document.querySelectorAll('[data-tr-kpi-status]').forEach(card => {
    card.addEventListener('click', () => {
      const st = card.getAttribute('data-tr-kpi-status');
      if (transferReportFilterState.status === st && st !== 'ALL') {
        transferReportFilterState.status = 'ALL';
      } else {
        transferReportFilterState.status = st;
      }
      transferReportFilterState.page = 1;
      refreshTransferReportsTabInPlace();
    });
  });

  // 6. Sortable Column Headers:
  document.querySelectorAll('[data-tr-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const field = th.getAttribute('data-tr-sort');
      if (transferReportFilterState.sortField === field) {
        transferReportFilterState.sortDirection = transferReportFilterState.sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        transferReportFilterState.sortField = field;
        transferReportFilterState.sortDirection = 'asc';
      }
      refreshTransferReportsTabInPlace();
    });
  });

  // 7. Pagination Controls:
  document.querySelectorAll('[data-tr-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetPage = parseInt(btn.getAttribute('data-tr-page'), 10);
      if (targetPage && !isNaN(targetPage) && targetPage !== transferReportFilterState.page) {
        transferReportFilterState.page = targetPage;
        refreshTransferReportsTabInPlace();
      }
    });
  });

  const trPageSize = document.getElementById('tr-page-size');
  if (trPageSize) {
    trPageSize.addEventListener('change', (e) => {
      transferReportFilterState.pageSize = e.target.value === 'ALL' ? 'ALL' : parseInt(e.target.value, 10);
      transferReportFilterState.page = 1;
      refreshTransferReportsTabInPlace();
    });
  }

  // 8. View Mode Toggle (Table vs Cards):
  document.querySelectorAll('[data-tr-view-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      transferReportFilterState.viewMode = btn.getAttribute('data-tr-view-mode');
      refreshTransferReportsTabInPlace();
    });
  });

  // 9. Excel Export of Filtered Records:
  const btnExpTrans = document.getElementById('btn-export-transfer-report-excel');
  if (btnExpTrans) {
    btnExpTrans.addEventListener('click', () => {
      notificationService.withLoading(btnExpTrans, async () => {
        const allTransfers = transferService.getTransferRequests({ status: 'ALL' }) || [];
        const completedTransfers = storage.getTable(TABLE_NAMES.TRANSFERS) || [];
        const allRows = buildTransferAuditLog(allTransfers, completedTransfers);
        const filteredRows = filterTransferAuditRows(allRows);
        const sortedRows = sortTransferAuditRows(filteredRows);
        await transferService.exportTransfersToExcel(sortedRows);
      }, 'Exporting Transfers...', 'Transfer records exported to Excel successfully!');
    });
  }

  // 10. PDF / Print Export:
  const btnExpTransPdf = document.getElementById('btn-export-transfer-report-pdf');
  if (btnExpTransPdf) {
    btnExpTransPdf.addEventListener('click', () => {
      const allTransfers = transferService.getTransferRequests({ status: 'ALL' }) || [];
      const completedTransfers = storage.getTable(TABLE_NAMES.TRANSFERS) || [];
      const allRows = buildTransferAuditLog(allTransfers, completedTransfers);
      const filteredRows = filterTransferAuditRows(allRows);
      const sortedRows = sortTransferAuditRows(filteredRows);

      let filterSummary = `Status: ${transferReportFilterState.status}`;
      if (transferReportFilterState.transferredBy !== 'ALL') filterSummary += ` | Requester: ${transferReportFilterState.transferredBy}`;
      if (transferReportFilterState.prevFloor) filterSummary += ` | From: ${transferReportFilterState.prevFloor}`;
      if (transferReportFilterState.newFloor) filterSummary += ` | To: ${transferReportFilterState.newFloor}`;
      if (transferReportFilterState.dateFrom) filterSummary += ` | From Date: ${transferReportFilterState.dateFrom}`;
      if (transferReportFilterState.dateTo) filterSummary += ` | To Date: ${transferReportFilterState.dateTo}`;
      if (transferReportFilterState.search) filterSummary += ` | Search: "${transferReportFilterState.search}"`;

      pdfService.generateTransferReportPDF({
        rows: sortedRows,
        filterSummary: `${filterSummary} | Total: ${sortedRows.length} records`
      });
    });
  }

  // Spare Parts Report Excel Export
  const btnExpSpare = document.getElementById('btn-export-spare-report-excel');
  if (btnExpSpare) {
    btnExpSpare.addEventListener('click', () => {
      notificationService.withLoading(btnExpSpare, async () => {
        await historyService.exportSparePartsConsumptionExcel(spareFilterState);
      }, 'Exporting Spare Parts...', 'Spare parts replacement history exported!');
    });
  }

  // ============================================================
  // ENT LAB MANAGEMENT REPORT EVENT LISTENERS
  // ============================================================
  const syncEntFilterStateFromDOM = () => {
    const dFrom = document.getElementById('ent-filter-date-from');
    const dTo = document.getElementById('ent-filter-date-to');
    const bSerial = document.getElementById('ent-filter-board-serial');
    const pName = document.getElementById('ent-filter-part-name');
    const pModel = document.getElementById('ent-filter-model');
    const mSerial = document.getElementById('ent-filter-machine');
    const uSelect = document.getElementById('ent-filter-unit');
    const fSelect = document.getElementById('ent-filter-floor');
    const lSelect = document.getElementById('ent-filter-line');
    const sSelect = document.getElementById('ent-filter-status');
    const rTypeSelect = document.getElementById('ent-filter-repair-type');
    const compSelect = document.getElementById('ent-filter-company');
    const rResultSelect = document.getElementById('ent-filter-repair-result');
    const searchInput = document.getElementById('ent-filter-search');

    if (dFrom) entReportFilterState.dateFrom = dFrom.value;
    if (dTo) entReportFilterState.dateTo = dTo.value;
    if (bSerial) entReportFilterState.boardSerial = bSerial.value;
    if (pName) entReportFilterState.partName = pName.value;
    if (pModel) entReportFilterState.modelNo = pModel.value;
    if (mSerial) entReportFilterState.machineSerial = mSerial.value;
    if (uSelect) entReportFilterState.unitId = uSelect.value;
    if (fSelect) entReportFilterState.floorId = fSelect.value;
    if (lSelect) entReportFilterState.lineId = lSelect.value;
    if (sSelect) entReportFilterState.status = sSelect.value;
    if (rTypeSelect) entReportFilterState.repairType = rTypeSelect.value;
    if (compSelect) entReportFilterState.companyName = compSelect.value;
    if (rResultSelect) entReportFilterState.repairResult = rResultSelect.value;
    if (searchInput) entReportFilterState.search = searchInput.value;
  };

  // Live filter on select changes
  [
    'ent-filter-date-from',
    'ent-filter-date-to',
    'ent-filter-unit',
    'ent-filter-floor',
    'ent-filter-line',
    'ent-filter-status',
    'ent-filter-repair-type',
    'ent-filter-company',
    'ent-filter-repair-result'
  ].forEach(id => {
    document.getElementById(id)?.addEventListener('change', () => {
      syncEntFilterStateFromDOM();
      refreshReportsView();
    });
  });

  // Debounced input search for text fields
  [
    'ent-filter-board-serial',
    'ent-filter-part-name',
    'ent-filter-model',
    'ent-filter-machine',
    'ent-filter-search'
  ].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => {
      syncEntFilterStateFromDOM();
      clearTimeout(window._entRepTimer);
      window._entRepTimer = setTimeout(refreshReportsView, 350);
    });
  });

  // Apply Filter Button
  document.getElementById('btn-ent-rep-apply-filters')?.addEventListener('click', () => {
    syncEntFilterStateFromDOM();
    refreshReportsView();
  });

  // Reset Filters Button
  document.getElementById('btn-ent-rep-reset-filters')?.addEventListener('click', () => {
    entReportFilterState = {
      dateFrom: '',
      dateTo: '',
      boardSerial: '',
      partName: '',
      modelNo: '',
      machineSerial: '',
      unitId: '',
      floorId: '',
      lineId: '',
      status: 'ALL',
      repairType: 'ALL',
      companyName: 'ALL',
      repairResult: 'ALL',
      search: ''
    };
    refreshReportsView();
  });

  // Excel Export Action
  const btnEntExpExcel = document.getElementById('btn-ent-rep-export-excel');
  if (btnEntExpExcel) {
    btnEntExpExcel.addEventListener('click', () => {
      syncEntFilterStateFromDOM();
      notificationService.withLoading(btnEntExpExcel, async () => {
        const etBoards = etLabService.getBoards() || [];
        const allRows = getEtLabReportRows(etBoards);
        const filteredRows = filterEtLabReportRows(allRows);
        await excelService.exportEtLabManagementReportExcel(filteredRows);
      }, 'Exporting ENT Lab Report to Excel...', 'ENT Lab Report exported successfully!');
    });
  }

  // PDF Export Action
  const btnEntExpPdf = document.getElementById('btn-ent-rep-export-pdf');
  if (btnEntExpPdf) {
    btnEntExpPdf.addEventListener('click', () => {
      syncEntFilterStateFromDOM();
      const etBoards = etLabService.getBoards() || [];
      const allRows = getEtLabReportRows(etBoards);
      const filteredRows = filterEtLabReportRows(allRows);
      pdfService.generateEtLabManagementReportPDF({
        rows: filteredRows,
        filterSummary: `Status: ${entReportFilterState.status} | Repair Type: ${entReportFilterState.repairType} | Records: ${filteredRows.length}`
      });
    });
  }

  // Print Action
  const btnEntPrint = document.getElementById('btn-ent-rep-print');
  if (btnEntPrint) {
    btnEntPrint.addEventListener('click', () => {
      syncEntFilterStateFromDOM();
      const etBoards = etLabService.getBoards() || [];
      const allRows = getEtLabReportRows(etBoards);
      const filteredRows = filterEtLabReportRows(allRows);
      pdfService.generateEtLabManagementReportPDF({
        rows: filteredRows,
        filterSummary: `Status: ${entReportFilterState.status} | Repair Type: ${entReportFilterState.repairType} | Records: ${filteredRows.length}`
      });
    });
  }

  // Export Center Buttons
  const btnCentMach = document.getElementById('btn-center-export-machines');
  if (btnCentMach) {
    btnCentMach.addEventListener('click', () => {
      notificationService.withLoading(btnCentMach, async () => {
        const qRes = machineService.getMachines({ limit: 'ALL' });
        await excelService.exportToExcel(qRes.items, `Machine_Inventory_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
      }, 'Exporting Machines...', 'Machine inventory exported successfully!');
    });
  }

  const btnCentTrans = document.getElementById('btn-center-export-transfers');
  if (btnCentTrans) {
    btnCentTrans.addEventListener('click', () => {
      notificationService.withLoading(btnCentTrans, async () => {
        const allTransfers = transferService.getTransferRequests({ status: 'ALL' });
        await transferService.exportTransfersToExcel(allTransfers);
      }, 'Exporting Transfers...', 'Transfer records exported successfully!');
    });
  }

  const btnCentSpare = document.getElementById('btn-center-export-spareparts');
  if (btnCentSpare) {
    btnCentSpare.addEventListener('click', () => {
      notificationService.withLoading(btnCentSpare, async () => {
        await historyService.exportSparePartsConsumptionExcel(spareFilterState);
      }, 'Exporting Spare Parts...', 'Spare parts replacement history exported!');
    });
  }

  const btnCentEtLab = document.getElementById('btn-center-export-etlab');
  if (btnCentEtLab) {
    btnCentEtLab.addEventListener('click', () => {
      notificationService.withLoading(btnCentEtLab, async () => {
        await excelService.exportEtLabExcel();
      }, 'Exporting ENT Lab Data...', 'ENT Lab Excel workbook downloaded successfully!');
    });
  }

  const btnCentLife = document.getElementById('btn-center-export-lifetime');
  if (btnCentLife) {
    btnCentLife.addEventListener('click', () => {
      notificationService.withLoading(btnCentLife, async () => {
        await excelService.exportCompleteErpWorkbook(`AlMuslim_Master_ERP_Workbook_${new Date().toISOString().split('T')[0]}.xlsx`);
      }, 'Exporting Full ERP Workbook...', 'Full 7-sheet ERP workbook exported successfully!');
    });
  }

  // Top Complete Workbook Download Button
  const btnQuickAll = document.getElementById('btn-quick-export-all-excel');
  if (btnQuickAll) {
    btnQuickAll.addEventListener('click', () => {
      notificationService.withLoading(btnQuickAll, async () => {
        await excelService.exportCompleteErpWorkbook(`AlMuslim_Master_ERP_Workbook_${new Date().toISOString().split('T')[0]}.xlsx`);
      }, 'Exporting Full ERP Workbook...', 'Complete ERP workbook downloaded successfully!');
    });
  }
}
