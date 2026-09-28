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
import { machineService } from '../services/machineService.js';
import { masterDataService } from '../services/masterDataService.js';
import { excelService, formatDisplayLine } from '../services/excelService.js';
import { pdfService } from '../services/pdfService.js';
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
    <div class="page-view" style="display: flex; flex-direction: column; gap: 12px; height: 100%; overflow: hidden; box-sizing: border-box; padding: 12px 20px;">
      
      <!-- Top Title Bar (Fixed Height) -->
      <div class="reports-top-bar" style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 12px 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px; flex-shrink: 0;">
        <div style="min-width: 0;">
          <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
            <span style="font-size: 22px;">📊</span>
            <h1 style="font-size: 18px; font-weight: 800; color: #fff; margin: 0; white-space: nowrap;">
              Reports &amp; Excel Export Center
            </h1>
            <span class="badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); font-size: 11px; padding: 2px 8px; white-space: nowrap;">
              Enterprise Analytics
            </span>
          </div>
          <p style="font-size: 11.5px; color: var(--text-secondary); margin-top: 2px; margin-bottom: 0; overflow: hidden; text-overflow: ellipsis;">
            Comprehensive reporting across Machine Inventory, Inter-Floor Transfers, Spare Parts Replacements, and ENT Lab Diagnostics.
          </p>
        </div>

        <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
          <button id="btn-toggle-reports-guide" class="btn btn-secondary btn-sm" style="font-weight: 700; white-space: nowrap;" title="View section purpose and module functions">
            ℹ️ Purpose &amp; Guide
          </button>
          <button id="btn-quick-export-all-excel" class="btn btn-primary btn-sm" style="font-weight: 700; background: linear-gradient(135deg, #0284c7, #0369a1); box-shadow: 0 2px 10px rgba(2, 132, 199, 0.35); white-space: nowrap;">
            📥 Download Complete Excel Workbook
          </button>
        </div>
      </div>

      <!-- Collapsible Section Guide Drawer -->
      <div id="reports-guide-drawer" style="display: none; background: rgba(15, 23, 42, 0.95); border: 1.5px solid #0284c7; border-radius: var(--radius-lg); padding: 14px 18px; box-shadow: 0 6px 20px rgba(0,0,0,0.4);">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 8px; margin-bottom: 10px;">
          <div style="font-weight: 800; color: #38bdf8; font-size: 13.5px; display: flex; align-items: center; gap: 6px;">
            <span>💡</span> Purpose &amp; Overview of Reports &amp; Analytics Modules
          </div>
          <button id="btn-close-reports-guide" class="btn btn-ghost btn-xs" style="color: #94a3b8; font-size: 14px;">✕</button>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; font-size: 11.5px; color: #cbd5e1; line-height: 1.45;">
          <div style="background: rgba(56, 189, 248, 0.08); border-left: 3px solid #38bdf8; padding: 8px 10px; border-radius: 4px;">
            <strong style="color: #38bdf8;">🧵 1. Machine Summary:</strong><br/>
            Inspect total machinery fleet across Groups, Units, Floors, and Lines. View breakdowns by brand and model with live Running vs. Idle rates.
          </div>
          <div style="background: rgba(168, 85, 247, 0.08); border-left: 3px solid #c084fc; padding: 8px 10px; border-radius: 4px;">
            <strong style="color: #c084fc;">🔄 2. Transfer Reports:</strong><br/>
            Track machine movements and floor reassignments. View requisition statuses, pending approvals, dispatch dates, and receiving acknowledgments.
          </div>
          <div style="background: rgba(251, 191, 36, 0.08); border-left: 3px solid #fbbf24; padding: 8px 10px; border-radius: 4px;">
            <strong style="color: #fbbf24;">⚙️ 3. Spare Parts Reports:</strong><br/>
            Monitor parts replacement logs by machine serial. Analyze consumption volume, unreturned store parts, technician slips, and financial cost valuations.
          </div>
          <div style="background: rgba(52, 211, 153, 0.08); border-left: 3px solid #34d399; padding: 8px 10px; border-radius: 4px;">
            <strong style="color: #34d399;">🔬 4. ENT Lab Management:</strong><br/>
            Diagnostic history of control boxes, circuit boards, and motor drives. Tracks in-house electronics repairs vs. external vendor service timelines.
          </div>
          <div style="background: rgba(244, 63, 94, 0.08); border-left: 3px solid #fb7185; padding: 8px 10px; border-radius: 4px;">
            <strong style="color: #fb7185;">📤 5. 1-Click Excel Export:</strong><br/>
            Download enterprise-grade multi-sheet spreadsheets with live formulas, audited metadata, and print-ready formatting for executive management.
          </div>
        </div>
      </div>

      <!-- Navigation Tabs (Clean, Modern Buttons, Fixed Height) -->
      <div id="reports-nav-tabs-bar" style="display: flex; gap: 8px; border-bottom: 2px solid var(--border-color); padding-bottom: 6px; flex-wrap: nowrap; flex-shrink: 0; overflow-x: auto; scrollbar-width: none; height: 38px; align-items: center;">
        <button class="btn btn-sm ${currentReportTab === 'machines' ? 'btn-primary' : 'btn-ghost'}" data-report-tab-btn="machines" style="font-weight: 700; font-size: 12.5px; white-space: nowrap;">
          🧵 Machine Summary (${allMachines.length})
        </button>
        <button class="btn btn-sm ${currentReportTab === 'transfers' ? 'btn-primary' : 'btn-ghost'}" data-report-tab-btn="transfers" style="font-weight: 700; font-size: 12.5px; white-space: nowrap;">
          🔄 Transfer Reports (${allTransfers.length})
        </button>
        <button class="btn btn-sm ${currentReportTab === 'spareparts' ? 'btn-primary' : 'btn-ghost'}" data-report-tab-btn="spareparts" style="font-weight: 700; font-size: 12.5px; white-space: nowrap;">
          ⚙️ Spare Parts Reports (${replacementLogs.length})
        </button>
        <button class="btn btn-sm ${currentReportTab === 'etlab' ? 'btn-primary' : 'btn-ghost'}" data-report-tab-btn="etlab" style="font-weight: 700; font-size: 12.5px; white-space: nowrap;">
          🔬 ENT Lab Management Report (${etLabBoards.length})
        </button>
        <button class="btn btn-sm ${currentReportTab === 'export' ? 'btn-primary' : 'btn-ghost'}" data-report-tab-btn="export" style="font-weight: 700; font-size: 12.5px; white-space: nowrap; color: ${currentReportTab === 'export' ? '#fff' : '#38bdf8'};">
          📤 1-Click Excel Export Center
        </button>
      </div>

      <!-- Tab Content Area (Scrollable flex 1) -->
      <div id="reports-tab-content" style="display: flex; flex-direction: column; gap: 14px; flex: 1; min-height: 0; overflow-y: auto;">
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
    <div style="display: flex; flex-direction: column; gap: 14px;">
      
      <!-- Top Metrics KPIs -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px;">
        <div style="background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 8px; padding: 12px 16px;">
          <div style="font-size: 11px; font-weight: 700; color: #38bdf8; text-transform: uppercase;">Total Matching Boards</div>
          <div style="font-size: 22px; font-weight: 800; color: #fff; margin-top: 4px;">${filteredRows.length} Units</div>
        </div>

        <div style="background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; padding: 12px 16px;">
          <div style="font-size: 11px; font-weight: 700; color: #34d399; text-transform: uppercase;">Installed on Machine</div>
          <div style="font-size: 22px; font-weight: 800; color: #34d399; margin-top: 4px;">${filteredRows.filter(r => r.status === 'INSTALLED').length} Units</div>
        </div>

        <div style="background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(2, 132, 199, 0.3); border-radius: 8px; padding: 12px 16px;">
          <div style="font-size: 11px; font-weight: 700; color: #38bdf8; text-transform: uppercase;">Available Spares</div>
          <div style="font-size: 22px; font-weight: 800; color: #38bdf8; margin-top: 4px;">${filteredRows.filter(r => r.status === 'AVAILABLE_SPARE' || r.status === 'REPAIR_ACCEPTED').length} Units</div>
        </div>

        <div style="background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 8px; padding: 12px 16px;">
          <div style="font-size: 11px; font-weight: 700; color: #fbbf24; text-transform: uppercase;">Under In-House Repair</div>
          <div style="font-size: 22px; font-weight: 800; color: #fbbf24; margin-top: 4px;">${filteredRows.filter(r => r.status === 'UNDER_INHOUSE_REPAIR' || r.status === 'REPAIR_REJECTED').length} Units</div>
        </div>

        <div style="background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; padding: 12px 16px;">
          <div style="font-size: 11px; font-weight: 700; color: #f87171; text-transform: uppercase;">Sent to External Co.</div>
          <div style="font-size: 22px; font-weight: 800; color: #f87171; margin-top: 4px;">${filteredRows.filter(r => r.status === 'SENT_EXTERNAL').length} Units</div>
        </div>
      </div>

      <!-- ============================================================ -->
      <!-- FILTERS BAR & REPORT ACTIONS                                -->
      <!-- ============================================================ -->
      <div style="background: rgba(15, 23, 42, 0.9); border: 1.5px solid rgba(56, 189, 248, 0.4); border-radius: var(--radius-lg); padding: 16px 20px; display: flex; flex-direction: column; gap: 14px; box-shadow: var(--shadow-sm);">
        
        <!-- Header & Action Buttons -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 12px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 20px;">📊</span>
            <div>
              <div style="font-size: 15px; font-weight: 800; color: #fff;">ENT Lab Management Report Filter</div>
              <div style="font-size: 11.5px; color: var(--text-secondary);">Filter boards by dates, machine, hierarchy, status &amp; external repair result</div>
            </div>
          </div>

          <!-- Report Action Buttons: Export Excel, PDF, Print, Apply, Reset -->
          <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
            <button id="btn-ent-rep-export-excel" class="btn btn-secondary btn-sm" style="font-weight: 700; border-color: #38bdf8; color: #38bdf8; height: 36px;" title="Export filtered records to Excel">
              📊 Export Excel
            </button>
            <button id="btn-ent-rep-export-pdf" class="btn btn-secondary btn-sm" style="font-weight: 700; border-color: #ec4899; color: #f472b6; height: 36px;" title="Export PDF document">
              📄 PDF
            </button>
            <button id="btn-ent-rep-print" class="btn btn-secondary btn-sm" style="font-weight: 700; border-color: #34d399; color: #34d399; height: 36px;" title="Print Report">
              🖨️ Print
            </button>
            <button id="btn-ent-rep-apply-filters" class="btn btn-primary btn-sm" style="font-weight: 800; height: 36px; padding: 0 16px; background: linear-gradient(135deg, #0284c7, #0369a1);">
              🔍 Apply Filters
            </button>
            <button id="btn-ent-rep-reset-filters" class="btn btn-ghost btn-sm" style="height: 36px; font-weight: 600; color: #cbd5e1; border: 1px solid rgba(255,255,255,0.15);">
              🔄 Reset Filters
            </button>
          </div>
        </div>

        <!-- Filter Grid (Responsive) -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px;">
          
          <!-- Date From -->
          <div class="form-group" style="margin: 0;">
            <label class="form-label" style="font-size: 11px; font-weight: 800; color: #38bdf8;">📅 Date From:</label>
            <input type="date" id="ent-filter-date-from" class="form-control" style="height: 36px; font-size: 12px;" value="${entReportFilterState.dateFrom}" />
          </div>

          <!-- Date To -->
          <div class="form-group" style="margin: 0;">
            <label class="form-label" style="font-size: 11px; font-weight: 800; color: #38bdf8;">📅 Date To:</label>
            <input type="date" id="ent-filter-date-to" class="form-control" style="height: 36px; font-size: 12px;" value="${entReportFilterState.dateTo}" />
          </div>

          <!-- Board ID / SL No. -->
          <div class="form-group" style="margin: 0;">
            <label class="form-label" style="font-size: 11px; font-weight: 700; color: #cbd5e1;">Board ID / SL No.:</label>
            <input type="text" id="ent-filter-board-serial" class="form-control" placeholder="BRD-00025, JUK-..." value="${entReportFilterState.boardSerial}" style="height: 36px; font-size: 12px;" />
          </div>

          <!-- Board Name -->
          <div class="form-group" style="margin: 0;">
            <label class="form-label" style="font-size: 11px; font-weight: 700; color: #cbd5e1;">Board Name:</label>
            <input type="text" id="ent-filter-part-name" class="form-control" placeholder="Main CPU, Power..." value="${entReportFilterState.partName}" style="height: 36px; font-size: 12px;" />
          </div>

          <!-- Model -->
          <div class="form-group" style="margin: 0;">
            <label class="form-label" style="font-size: 11px; font-weight: 700; color: #cbd5e1;">Model:</label>
            <input type="text" id="ent-filter-model" class="form-control" placeholder="CP-180A, DDL-..." value="${entReportFilterState.modelNo}" style="height: 36px; font-size: 12px;" />
          </div>

          <!-- Machine -->
          <div class="form-group" style="margin: 0;">
            <label class="form-label" style="font-size: 11px; font-weight: 700; color: #cbd5e1;">Machine / Serial:</label>
            <input type="text" id="ent-filter-machine" class="form-control" placeholder="TS-01, JA-01..." value="${entReportFilterState.machineSerial}" style="height: 36px; font-size: 12px;" />
          </div>

          <!-- Unit / Factory -->
          <div class="form-group" style="margin: 0;">
            <label class="form-label" style="font-size: 11px; font-weight: 700; color: #cbd5e1;">Unit / Factory:</label>
            <select id="ent-filter-unit" class="form-control" style="height: 36px; font-size: 12px;">
              <option value="">All Units</option>
              ${units.map(u => `<option value="${u.id}" ${entReportFilterState.unitId === u.id ? 'selected' : ''}>${u.name}</option>`).join('')}
            </select>
          </div>

          <!-- Floor -->
          <div class="form-group" style="margin: 0;">
            <label class="form-label" style="font-size: 11px; font-weight: 700; color: #cbd5e1;">Floor:</label>
            <select id="ent-filter-floor" class="form-control" style="height: 36px; font-size: 12px;">
              <option value="">All Floors</option>
              ${floors.map(f => `<option value="${f.id}" ${entReportFilterState.floorId === f.id ? 'selected' : ''}>${f.name}</option>`).join('')}
            </select>
          </div>

          <!-- Line -->
          <div class="form-group" style="margin: 0;">
            <label class="form-label" style="font-size: 11px; font-weight: 700; color: #cbd5e1;">Line:</label>
            <select id="ent-filter-line" class="form-control" style="height: 36px; font-size: 12px;">
              <option value="">All Lines</option>
              ${lines.map(l => `<option value="${l.id}" ${entReportFilterState.lineId === l.id ? 'selected' : ''}>${l.name}</option>`).join('')}
            </select>
          </div>

          <!-- Status -->
          <div class="form-group" style="margin: 0;">
            <label class="form-label" style="font-size: 11px; font-weight: 700; color: #cbd5e1;">Current Status:</label>
            <select id="ent-filter-status" class="form-control" style="height: 36px; font-size: 12px;">
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
          <div class="form-group" style="margin: 0;">
            <label class="form-label" style="font-size: 11px; font-weight: 700; color: #cbd5e1;">Repair Type:</label>
            <select id="ent-filter-repair-type" class="form-control" style="height: 36px; font-size: 12px;">
              <option value="ALL" ${entReportFilterState.repairType === 'ALL' ? 'selected' : ''}>All Repair Types</option>
              <option value="In-House" ${entReportFilterState.repairType === 'In-House' ? 'selected' : ''}>🛠️ In-House Repair</option>
              <option value="External" ${entReportFilterState.repairType === 'External' ? 'selected' : ''}>🚚 External Outside Repair</option>
            </select>
          </div>

          <!-- External Company -->
          <div class="form-group" style="margin: 0;">
            <label class="form-label" style="font-size: 11px; font-weight: 700; color: #cbd5e1;">External Company:</label>
            <select id="ent-filter-company" class="form-control" style="height: 36px; font-size: 12px;">
              <option value="ALL" ${entReportFilterState.companyName === 'ALL' ? 'selected' : ''}>All Companies</option>
              ${companies.map(c => `<option value="${c.name}" ${entReportFilterState.companyName === c.name ? 'selected' : ''}>${c.name}</option>`).join('')}
            </select>
          </div>

          <!-- Repair Result -->
          <div class="form-group" style="margin: 0;">
            <label class="form-label" style="font-size: 11px; font-weight: 700; color: #cbd5e1;">Repair Result:</label>
            <select id="ent-filter-repair-result" class="form-control" style="height: 36px; font-size: 12px;">
              <option value="ALL" ${entReportFilterState.repairResult === 'ALL' ? 'selected' : ''}>All Repair Results</option>
              <option value="Accepted" ${entReportFilterState.repairResult === 'Accepted' ? 'selected' : ''}>✅ Accepted / Repair Successful</option>
              <option value="Rejected" ${entReportFilterState.repairResult === 'Rejected' ? 'selected' : ''}>❌ Rejected / Not Solved</option>
              <option value="Partially" ${entReportFilterState.repairResult === 'Partially' ? 'selected' : ''}>⚠️ Partially Repaired</option>
              <option value="Send Again" ${entReportFilterState.repairResult === 'Send Again' ? 'selected' : ''}>🔄 Send Again</option>
            </select>
          </div>

          <!-- Quick Global Search -->
          <div class="form-group" style="margin: 0; grid-column: span 2;">
            <label class="form-label" style="font-size: 11px; font-weight: 700; color: #cbd5e1;">🔍 Live Keyword Search:</label>
            <input type="text" id="ent-filter-search" class="form-control" placeholder="Search any board ID, name, machine, company, remarks..." value="${entReportFilterState.search}" style="height: 36px; font-size: 12px;" />
          </div>

        </div>

      </div>

      <!-- ============================================================ -->
      <!-- DATA REPORT TABLE (20 SPECIFIED COLUMNS)                     -->
      <!-- ============================================================ -->
      <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); overflow: hidden;">
        <div style="padding: 12px 18px; background: rgba(15, 23, 42, 0.9); border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
          <div style="font-weight: 800; font-size: 13.5px; color: #38bdf8; display: flex; align-items: center; gap: 8px;">
            <span>📊 ENT Lab Management Master &amp; Movement Report</span>
            <span class="badge badge-info" style="font-size: 11px;">${filteredRows.length} Boards</span>
          </div>
          <div style="font-size: 11.5px; color: var(--text-muted);">
            Complete tracking: Machine connection, installation, external repairs, verification &amp; turnaround
          </div>
        </div>

        <div class="table-responsive" style="max-height: 540px; overflow-y: auto;">
          <table class="data-table" style="width: 100%; border-collapse: collapse; font-size: 11.5px;">
            <thead>
              <tr style="background: rgba(15, 23, 42, 0.95); border-bottom: 1px solid var(--border-color); font-size: 10.5px; text-transform: uppercase; color: #94a3b8; position: sticky; top: 0; z-index: 2; white-space: nowrap;">
                <th style="padding: 8px 10px; text-align: center; width: 35px;">Sl</th>
                <th style="padding: 8px 10px; text-align: left;">Board / Item ID</th>
                <th style="padding: 8px 10px; text-align: left;">Board Name</th>
                <th style="padding: 8px 10px; text-align: left;">Model</th>
                <th style="padding: 8px 10px; text-align: left;">Serial No.</th>
                <th style="padding: 8px 10px; text-align: center;">Current Status</th>
                <th style="padding: 8px 10px; text-align: left;">Current Machine</th>
                <th style="padding: 8px 10px; text-align: left;">Machine Serial</th>
                <th style="padding: 8px 10px; text-align: left;">Unit / Factory</th>
                <th style="padding: 8px 10px; text-align: left;">Floor</th>
                <th style="padding: 8px 10px; text-align: left;">Line</th>
                <th style="padding: 8px 10px; text-align: left;">Install Date</th>
                <th style="padding: 8px 10px; text-align: left;">Remove Date</th>
                <th style="padding: 8px 10px; text-align: left;">Repair Type</th>
                <th style="padding: 8px 10px; text-align: left;">External Company</th>
                <th style="padding: 8px 10px; text-align: left;">Send Date</th>
                <th style="padding: 8px 10px; text-align: left;">Return Date</th>
                <th style="padding: 8px 10px; text-align: left;">Repair Result</th>
                <th style="padding: 8px 10px; text-align: center;">Repair Count</th>
                <th style="padding: 8px 10px; text-align: center;">Previous Bill</th>
                <th style="padding: 8px 10px; text-align: left;">Remarks</th>
              </tr>
            </thead>
            <tbody>
              ${filteredRows.length === 0 ? `
                <tr><td colspan="21" style="text-align: center; padding: 30px; color: var(--text-muted);">No records found matching the specified report filters.</td></tr>
              ` : filteredRows.map((r, idx) => {
    let resultBadge = '—';
    if (r.repairResult && r.repairResult !== '—') {
      if (r.repairResult.includes('Accepted')) {
        resultBadge = `<span style="background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid #10b981; font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 4px;">✅ Accepted</span>`;
      } else if (r.repairResult.includes('Rejected') || r.repairResult.includes('Not Successful')) {
        resultBadge = `<span style="background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid #ef4444; font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 4px;">❌ Rejected</span>`;
      } else if (r.repairResult.includes('Partially')) {
        resultBadge = `<span style="background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid #f59e0b; font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 4px;">⚠️ Partial</span>`;
      } else if (r.repairResult.includes('Send Again')) {
        resultBadge = `<span style="background: rgba(168, 85, 247, 0.2); color: #c084fc; border: 1px solid #a855f7; font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 4px;">🔄 Send Again</span>`;
      } else {
        resultBadge = `<span style="font-size: 10.5px; color: #cbd5e1;">${r.repairResult}</span>`;
      }
    }

    return `
                  <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);" class="hover-row">
                    <td style="padding: 7px 10px; text-align: center; color: var(--text-muted);">${idx + 1}</td>
                    <td style="padding: 7px 10px; font-family: var(--font-mono); font-weight: 800; color: #38bdf8; white-space: nowrap;">${r.boardSerial}</td>
                    <td style="padding: 7px 10px; font-weight: 700; color: #fff; white-space: nowrap;">${r.partName}</td>
                    <td style="padding: 7px 10px; font-family: var(--font-mono); color: #cbd5e1; white-space: nowrap;">${r.modelNo}</td>
                    <td style="padding: 7px 10px; font-family: var(--font-mono); color: #cbd5e1; white-space: nowrap;">${r.serialNo}</td>
                    <td style="padding: 7px 10px; text-align: center; white-space: nowrap;">
                      <span class="badge ${r.status === 'INSTALLED' ? 'badge-info' : r.status === 'AVAILABLE_SPARE' ? 'badge-active' : 'badge-warning'}" style="font-size: 10px; padding: 2px 6px;">
                        ${r.status}
                      </span>
                    </td>
                    <td style="padding: 7px 10px; font-family: var(--font-mono); font-weight: 700; color: #38bdf8; white-space: nowrap;">${r.currentMachine}</td>
                    <td style="padding: 7px 10px; font-family: var(--font-mono); color: #cbd5e1; white-space: nowrap;">${r.machineSerial}</td>
                    <td style="padding: 7px 10px; color: #cbd5e1; white-space: nowrap;">${r.unitName}</td>
                    <td style="padding: 7px 10px; color: #cbd5e1; white-space: nowrap;">${r.floorName}</td>
                    <td style="padding: 7px 10px; color: #86efac; font-weight: 600; white-space: nowrap;">${r.lineName}</td>
                    <td style="padding: 7px 10px; font-family: var(--font-mono); color: #86efac; white-space: nowrap;">${r.installDate}</td>
                    <td style="padding: 7px 10px; font-family: var(--font-mono); color: #f87171; white-space: nowrap;">${r.removeDate}</td>
                    <td style="padding: 7px 10px; color: #cbd5e1; white-space: nowrap;">${r.repairType}</td>
                    <td style="padding: 7px 10px; color: #c084fc; font-weight: 600; white-space: nowrap;">${r.externalCompany}</td>
                    <td style="padding: 7px 10px; font-family: var(--font-mono); color: #fbbf24; white-space: nowrap;">${r.sendDate}</td>
                    <td style="padding: 7px 10px; font-family: var(--font-mono); color: #34d399; white-space: nowrap;">${r.returnDate}</td>
                    <td style="padding: 7px 10px; white-space: nowrap;">${resultBadge}</td>
                    <td style="padding: 7px 10px; text-align: center; font-family: var(--font-mono); font-weight: 800; color: #fbbf24;">${r.repairCount}</td>
                    <td style="padding: 7px 10px; text-align: center; white-space: nowrap;">
                      ${r.previousBill === 'YES' ? `
                        <span style="background: rgba(239,68,68,0.2); color: #fca5a5; font-family: var(--font-mono); padding: 2px 6px; border-radius: 4px; font-weight: 700; font-size: 10px;" title="Bill: ${r.billNo}">
                          ⚠️ YES
                        </span>
                      ` : `
                        <span style="color: #34d399; font-size: 10.5px; font-weight: 600;">NO</span>
                      `}
                    </td>
                    <td style="padding: 7px 10px; color: #94a3b8; font-size: 11px; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${r.remarks}</td>
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

  const grpMap = new Map(groups.map(g => [g.id, g]));
  const untMap = new Map(units.map(u => [u.id, u]));
  const flrMap = new Map(floors.map(f => [f.id, f]));
  const linMap = new Map(lines.map(l => [l.id, l]));
  const mnMap = new Map(machineNames.map(x => [x.id, x.name]));
  const brdMap = new Map(brands.map(x => [x.id, x.name]));
  const mdlMap = new Map(models.map(x => [x.id, x.name]));

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
    // Resolve Machine Name & Model
    const rawMachName = (mnMap.get(m.machineNameId) || m.machineName || m.name || brdMap.get(m.brandId) || m.brand || 'Sewing Machine').trim();
    const rawModel = (mdlMap.get(m.modelId) || m.model || m.modelName || 'Standard').trim();

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
        <td colspan="8" style="text-align: center; padding: 36px; color: var(--text-muted);">
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
              <td rowspan="${modelCount}" class="mach-group-cell" style="text-align: center; font-family: var(--font-mono); font-weight: 800; color: #94a3b8; font-size: 13px; border-right: 1px solid var(--border-color); vertical-align: middle;">
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
            <td class="mach-num-cell mach-num-running" style="text-align: center; border-right: 1px solid var(--border-color);">${mod.running}</td>
            <td class="mach-num-cell mach-num-usable" style="text-align: center; border-right: 1px solid var(--border-color);">${mod.usableIdle}</td>
            <td class="mach-num-cell mach-num-repair" style="text-align: center; border-right: 1px solid var(--border-color);">${mod.repairableIdle}</td>
            <td class="mach-num-cell mach-num-total" style="text-align: center; border-right: 1.5px solid var(--border-color);">${mod.total}</td>
            ${isFirstRow ? `
              <td rowspan="${modelCount}" class="mach-group-cell mach-num-cell" style="text-align: center; vertical-align: middle; font-weight: 800; font-size: 14px; color: #38bdf8; border-left: 1.5px solid var(--border-color);">
                ${group.total}
              </td>
            ` : ''}
          </tr>
        `;
      }).join('');
    }).join('');
  }

  return `
    <div style="display: flex; flex-direction: column; gap: 14px;">
      
      <!-- 1. Sleek Filter Toolbar (Compact Horizontal Bar) -->
      <div class="reports-filter-toolbar" style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 10px 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; box-shadow: 0 2px 6px rgba(0,0,0,0.2);">
        
        <!-- Left: Filters Grouped with Clear Mini-Labels -->
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; flex: 1; min-width: 0;">
          <span style="font-size: 11.5px; font-weight: 800; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 4px; white-space: nowrap; margin-right: 2px;">
            <span>📍</span> Filters:
          </span>

          <!-- Group Filter -->
          <div style="display: inline-flex; align-items: center; gap: 6px; background: rgba(15, 23, 42, 0.85); border: 1px solid var(--border-color); border-radius: 6px; padding: 2px 8px;">
            <span style="font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase;">Group</span>
            <select id="mr-filter-group" style="height: 28px; font-size: 12px; font-weight: 600; color: #fff; background: transparent; border: none; outline: none; cursor: pointer; width: auto; min-width: 105px; max-width: 150px;">
              <option value="" style="background: #0f172a; color: #fff;">All Groups (${groups.length})</option>
              ${groups.map(g => `<option value="${g.id}" ${machineReportFilterState.groupId === g.id ? 'selected' : ''} style="background: #0f172a; color: #fff;">${g.name}</option>`).join('')}
            </select>
          </div>

          <!-- Unit / Factory Filter -->
          <div style="display: inline-flex; align-items: center; gap: 6px; background: rgba(15, 23, 42, 0.85); border: 1px solid var(--border-color); border-radius: 6px; padding: 2px 8px;">
            <span style="font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase;">Unit</span>
            <select id="mr-filter-unit" style="height: 28px; font-size: 12px; font-weight: 600; color: #fff; background: transparent; border: none; outline: none; cursor: pointer; width: auto; min-width: 120px; max-width: 170px;">
              <option value="" style="background: #0f172a; color: #fff;">All Units (${availUnits.length})</option>
              ${availUnits.map(u => `<option value="${u.id}" ${machineReportFilterState.unitId === u.id ? 'selected' : ''} style="background: #0f172a; color: #fff;">${u.name}</option>`).join('')}
            </select>
          </div>

          <!-- Floor Filter -->
          <div style="display: inline-flex; align-items: center; gap: 6px; background: rgba(15, 23, 42, 0.85); border: 1px solid var(--border-color); border-radius: 6px; padding: 2px 8px;">
            <span style="font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase;">Floor</span>
            <select id="mr-filter-floor" style="height: 28px; font-size: 12px; font-weight: 600; color: #fff; background: transparent; border: none; outline: none; cursor: pointer; width: auto; min-width: 110px; max-width: 150px;">
              <option value="" style="background: #0f172a; color: #fff;">All Floors (${availFloors.length})</option>
              ${availFloors.map(f => `<option value="${f.id}" ${machineReportFilterState.floorId === f.id ? 'selected' : ''} style="background: #0f172a; color: #fff;">${f.name}</option>`).join('')}
            </select>
          </div>

          <!-- Line Filter -->
          <div style="display: inline-flex; align-items: center; gap: 6px; background: rgba(15, 23, 42, 0.85); border: 1px solid var(--border-color); border-radius: 6px; padding: 2px 8px;">
            <span style="font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase;">Line</span>
            <select id="mr-filter-line" style="height: 28px; font-size: 12px; font-weight: 600; color: #fff; background: transparent; border: none; outline: none; cursor: pointer; width: auto; min-width: 100px; max-width: 140px;">
              <option value="" style="background: #0f172a; color: #fff;">All Lines (${availLines.length})</option>
              ${availLines.map(l => {
    const clean = formatDisplayLine(l.name);
    const label = clean !== l.name ? `Line ${clean} (${l.name})` : l.name;
    return `<option value="${l.id}" ${machineReportFilterState.lineId === l.id ? 'selected' : ''} style="background: #0f172a; color: #fff;">${label}</option>`;
  }).join('')}
            </select>
          </div>

          <!-- Status Filter -->
          <div style="display: inline-flex; align-items: center; gap: 6px; background: rgba(15, 23, 42, 0.85); border: 1px solid var(--border-color); border-radius: 6px; padding: 2px 8px;">
            <span style="font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase;">Status</span>
            <select id="mr-filter-status" style="height: 28px; font-size: 12px; font-weight: 600; color: #fff; background: transparent; border: none; outline: none; cursor: pointer; width: auto; min-width: 90px; max-width: 125px;">
              <option value="ALL" ${machineReportFilterState.status === 'ALL' ? 'selected' : ''} style="background: #0f172a; color: #fff;">All Status</option>
              <option value="ACTIVE" ${machineReportFilterState.status === 'ACTIVE' ? 'selected' : ''} style="background: #0f172a; color: #fff;">🟢 Active</option>
              <option value="IDLE" ${machineReportFilterState.status === 'IDLE' ? 'selected' : ''} style="background: #0f172a; color: #fff;">🔵 Idle</option>
              <option value="MAINTENANCE" ${machineReportFilterState.status === 'MAINTENANCE' ? 'selected' : ''} style="background: #0f172a; color: #fff;">🟡 Maintenance</option>
              <option value="BREAKDOWN" ${machineReportFilterState.status === 'BREAKDOWN' ? 'selected' : ''} style="background: #0f172a; color: #fff;">🔴 Breakdown</option>
            </select>
          </div>

          <!-- Reset Filter Button -->
          <button id="mr-btn-reset-filters" class="btn btn-ghost btn-sm" style="height: 32px; padding: 0 10px; font-size: 11.5px; font-weight: 700; color: #94a3b8; border: 1px solid var(--border-color); border-radius: 6px; white-space: nowrap;" title="Reset all location and status filters">
            ↺ Reset
          </button>
        </div>

        <!-- Right: Export & Print Actions -->
        <div class="reports-filter-actions" style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
          <button id="btn-export-machine-report-excel" class="btn btn-primary btn-sm" style="font-weight: 700; background: linear-gradient(135deg, #0284c7, #0369a1); box-shadow: 0 2px 8px rgba(2, 132, 199, 0.35); height: 32px; white-space: nowrap;">
            📊 Export Excel (.xlsx)
          </button>
          <button id="btn-print-machine-report-pdf" class="btn btn-secondary btn-sm" style="font-weight: 700; height: 32px; white-space: nowrap;">
            🖨️ Print / PDF
          </button>
        </div>

      </div>

      <!-- 2. Location Breadcrumbs -->
      <div style="font-size: 12px; color: var(--text-secondary); display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
        <a href="javascript:void(0)" class="mr-crumb-link" data-level="all" style="color: #38bdf8; font-weight: 700; text-decoration: none;">🏠 All Groups</a>
        ${currentGroup ? `
          <span>❯</span>
          <a href="javascript:void(0)" class="mr-crumb-link" data-level="group" data-id="${currentGroup.id}" style="color: #38bdf8; font-weight: 700; text-decoration: none;">🏢 ${currentGroup.name}</a>
        ` : ''}
        ${currentUnit ? `
          <span>❯</span>
          <a href="javascript:void(0)" class="mr-crumb-link" data-level="unit" data-id="${currentUnit.id}" style="color: #38bdf8; font-weight: 700; text-decoration: none;">🏭 ${currentUnit.name}</a>
        ` : ''}
        ${currentFloor ? `
          <span>❯</span>
          <a href="javascript:void(0)" class="mr-crumb-link" data-level="floor" data-id="${currentFloor.id}" style="color: #38bdf8; font-weight: 700; text-decoration: none;">🏬 ${currentFloor.name}</a>
        ` : ''}
        ${currentLine ? `
          <span>❯</span>
          <span style="color: #fff; font-weight: 800;">🧵 ${currentLine.name}</span>
        ` : ''}
      </div>

      <!-- 3. Top Overall Summary Cards (Running | Usable Idle | Repairable Idle | Total) -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;">
        
        <div style="background: linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.85)); border: 1px solid rgba(52, 211, 153, 0.3); border-top: 3px solid #10b981; border-radius: var(--radius-md); padding: 12px 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.25);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 11px; color: #34d399; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">🟢 Running Machines</span>
            <span class="badge badge-active" style="font-size: 10px; padding: 1px 6px;">Operational</span>
          </div>
          <div style="font-size: 26px; font-weight: 900; color: #34d399; margin-top: 4px; font-family: var(--font-mono);">${grandTotals.running}</div>
          <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">${activeRate}% of total machinery deployed</div>
        </div>

        <div style="background: linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.85)); border: 1px solid rgba(56, 189, 248, 0.3); border-top: 3px solid #0284c7; border-radius: var(--radius-md); padding: 12px 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.25);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 11px; color: #38bdf8; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">🔵 Usable Idle</span>
            <span class="badge badge-idle" style="font-size: 10px; padding: 1px 6px;">Standby</span>
          </div>
          <div style="font-size: 26px; font-weight: 900; color: #38bdf8; margin-top: 4px; font-family: var(--font-mono);">${grandTotals.usableIdle}</div>
          <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">Standby machines ready for lines</div>
        </div>

        <div style="background: linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.85)); border: 1px solid rgba(251, 191, 36, 0.3); border-top: 3px solid #f59e0b; border-radius: var(--radius-md); padding: 12px 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.25);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 11px; color: #fbbf24; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">🟡 Repairable Idle</span>
            <span class="badge badge-maint" style="font-size: 10px; padding: 1px 6px;">Servicing</span>
          </div>
          <div style="font-size: 26px; font-weight: 900; color: #fbbf24; margin-top: 4px; font-family: var(--font-mono);">${grandTotals.repairableIdle}</div>
          <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">Under scheduled servicing or repair</div>
        </div>

        <div style="background: linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.85)); border: 1px solid rgba(148, 163, 184, 0.3); border-top: 3px solid #38bdf8; border-radius: var(--radius-md); padding: 12px 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.25);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 11px; color: #e2e8f0; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">🏭 Total Machinery</span>
            <span class="badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; font-size: 10px; padding: 1px 6px; border: 1px solid rgba(56, 189, 248, 0.3);">Enterprise</span>
          </div>
          <div style="font-size: 26px; font-weight: 900; color: #fff; margin-top: 4px; font-family: var(--font-mono);">${grandTotals.total}</div>
          <div style="font-size: 11px; color: #38bdf8; margin-top: 2px;">Running + Usable + Repairable fleet</div>
        </div>

      </div>

      <!-- 4. Dynamic Grouped Machine Summary Data Grid (Exact Screenshot-Style Layout) -->
      <div id="mr-table-container" style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-sm);">
        <div style="padding: 14px 18px; border-bottom: 1px solid var(--border-color); background: #0b1329; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
          <div>
            <div style="font-weight: 800; color: #fff; font-size: 14px; display: flex; align-items: center; gap: 8px;">
              <span>📊</span> Machine Summary Report
            </div>
            <div style="font-size: 11.5px; color: #38bdf8; margin-top: 2px;">
              Location: <strong>${locationBadgeTitle}</strong> (${groupedList.length} Machine Types)
            </div>
          </div>
          <span style="font-size: 12px; color: #cbd5e1; font-weight: 600;">Auto-calculated dynamically from Machine Inventory</span>
        </div>

        <div style="overflow-x: auto;">
          <table class="mach-summary-table">
            <thead>
              <tr>
                <th style="width: 5%; text-align: center;">Sl.</th>
                <th style="width: 22%; text-align: left;">Machine Name</th>
                <th style="width: 21%; text-align: left;">Model</th>
                <th style="width: 10.5%; text-align: center; color: #34d399;">Running</th>
                <th style="width: 10.5%; text-align: center; color: #38bdf8;">Usable Idle</th>
                <th style="width: 10.5%; text-align: center; color: #fbbf24;">Repairable Idle</th>
                <th style="width: 10.5%; text-align: center; color: #ffffff;">Total</th>
                <th style="width: 10%; text-align: center; color: #38bdf8;">Grand Total</th>
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
                <td class="mach-num-cell mach-num-running" style="font-size: 14px; font-weight: 800; text-align: center;">${grandTotals.running}</td>
                <td class="mach-num-cell mach-num-usable" style="font-size: 14px; font-weight: 800; text-align: center;">${grandTotals.usableIdle}</td>
                <td class="mach-num-cell mach-num-repair" style="font-size: 14px; font-weight: 800; text-align: center;">${grandTotals.repairableIdle}</td>
                <td class="mach-num-cell mach-num-total" style="font-size: 14px; font-weight: 800; text-align: center;">${grandTotals.total}</td>
                <td class="mach-num-cell mach-num-total" style="font-size: 15px; color: #38bdf8; font-weight: 800; text-align: center;">${grandTotals.total}</td>
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

  // Resolve any location representation to a readable string
  function resolveLocation(locObj, unitId, floorId, lineId, path) {
    if (path && typeof path === 'string') return path;
    if (locObj && typeof locObj === 'object') {
      const parts = [locObj.unit, locObj.floor, locObj.line].filter(Boolean);
      if (parts.length) return parts.join(' > ');
    }
    const u = unitMap.get(unitId) || '';
    const f = floorMap.get(floorId) || '';
    const l = lineMap.get(lineId) || '';
    return [u, f, l].filter(Boolean).join(' > ') || '\u2014';
  }

  function resolveFloor(floorId, locObj) {
    return floorMap.get(floorId) || (locObj && typeof locObj === 'object' ? locObj.floor : null) || '\u2014';
  }

  function resolveLine(lineId, locObj) {
    return lineMap.get(lineId) || (locObj && typeof locObj === 'object' ? locObj.line : null) || '\u2014';
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
      machineSerial: req.machineInfo?.serialNumber || req.serialNumber || ct?.serialNumber || '\u2014',
      machineName:   req.machineInfo?.machineName  || ct?.machineName  || '\u2014',
      machineBrand:  req.machineInfo?.brand        || '\u2014',
      machineModel:  req.machineInfo?.model        || '\u2014',
      sourceLocation: resolveLocation(req.sourceLocation, req.sourceUnitId, req.sourceFloorId, req.sourceLineId, req.sourcePath),
      destLocation:   resolveLocation(req.destLocation,   req.destUnitId,   req.destFloorId,   req.destLineId,   req.destPath),
      prevFloor:     resolveFloor(req.sourceFloorId, req.sourceLocation),
      newFloor:      resolveFloor(req.destFloorId,   req.destLocation),
      prevLine:      resolveLine(req.sourceLineId,  req.sourceLocation),
      newLine:       resolveLine(req.destLineId,    req.destLocation),
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
        machineSerial: ct.serialNumber  || '\u2014',
        machineName:   ct.machineName   || '\u2014',
        machineBrand:  '\u2014', machineModel: '\u2014',
        sourceLocation: resolveLocation(null, ct.sourceUnitId, ct.sourceFloorId, ct.sourceLineId, ct.sourcePath),
        destLocation:   resolveLocation(null, ct.destUnitId,   ct.destFloorId,   ct.destLineId,   ct.destPath),
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

function renderTransferReportsTab(allRequests, completedTransfers) {
  const auditRows = buildTransferAuditLog(allRequests, completedTransfers);

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

  return `
    <div style="display: flex; flex-direction: column; gap: 16px;">

      <!-- Action Bar -->
      <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
        <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
          <span style="font-size: 13px; font-weight: 700; color: #fff;">🔄 Machine Transfer &amp; Relocation Audit Log</span>
          <span style="font-size: 12px; color: var(--text-muted);">(${auditRows.length} record${auditRows.length !== 1 ? 's' : ''})</span>
          <span style="font-size: 11px; color: #34d399; background: rgba(52,211,153,0.1); border: 1px solid rgba(52,211,153,0.3); border-radius: 4px; padding: 2px 8px; font-weight: 700;">🔴 Live Firebase Data</span>
        </div>
        <div style="display: flex; gap: 8px;">
          <button id="btn-export-transfer-report-excel" class="btn btn-secondary btn-sm" style="font-weight: 700;">
            📊 Export Transfers (Excel)
          </button>
        </div>
      </div>

      <!-- Audit Log Table -->
      <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); overflow-x: auto; box-shadow: var(--shadow-sm);">
        <table class="data-table" style="width: 100%; min-width: 1400px; border-collapse: collapse; margin: 0;">
          <thead>
            <tr style="background: rgba(15,23,42,0.95); border-bottom: 2px solid var(--border-color); font-size: 10.5px; text-transform: uppercase; color: #94a3b8; white-space: nowrap;">
              <th style="width: 44px; text-align: center; padding: 9px 8px;">SL</th>
              <th style="min-width: 140px; text-align: left; padding: 9px 10px;">Transfer ID / Ref #</th>
              <th style="min-width: 130px; text-align: left; padding: 9px 10px;">Machine ID / Serial</th>
              <th style="min-width: 120px; text-align: left; padding: 9px 10px;">Machine Name</th>
              <th style="min-width: 180px; text-align: left; padding: 9px 10px;">Previous Location</th>
              <th style="min-width: 180px; text-align: left; padding: 9px 10px;">New Location</th>
              <th style="min-width: 100px; text-align: left; padding: 9px 10px;">Prev Floor</th>
              <th style="min-width: 100px; text-align: left; padding: 9px 10px;">New Floor</th>
              <th style="min-width: 100px; text-align: left; padding: 9px 10px;">Prev Line</th>
              <th style="min-width: 100px; text-align: left; padding: 9px 10px;">New Line</th>
              <th style="min-width: 145px; text-align: left; padding: 9px 10px;">Transfer Date &amp; Time</th>
              <th style="min-width: 130px; text-align: left; padding: 9px 10px;">Transferred By</th>
              <th style="min-width: 120px; text-align: center; padding: 9px 10px;">Status</th>
              <th style="min-width: 180px; text-align: left; padding: 9px 10px;">Reason / Notes</th>
            </tr>
          </thead>
          <tbody>
            ${auditRows.length === 0 ? `
              <tr>
                <td colspan="14" style="text-align: center; padding: 40px; color: var(--text-muted);">
                  <div style="font-size: 32px; margin-bottom: 8px;">🚫</div>
                  <div style="font-size: 14px; font-weight: 700; color: #fff; margin-bottom: 4px;">No Transfer Records Found</div>
                  <div style="font-size: 12px;">Transfer records will appear here in real time after a machine is transferred.</div>
                </td>
              </tr>
            ` : auditRows.map((row, idx) => {
              const dateStr = row.requestedAt && row.requestedAt !== '\u2014'
                ? (() => {
                    try {
                      const d = new Date(row.requestedAt);
                      return d.toLocaleDateString('en-GB') + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    } catch (_) { return row.requestedAt; }
                  })()
                : '\u2014';
              const reasonStr = row.reason || '\u2014';
              const remarksStr = row.remarks ? ` <span style="color: #64748b;">(${row.remarks})</span>` : '';
              return `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);" class="hover-row">
                  <td style="text-align: center; color: var(--text-muted); font-weight: 700; padding: 8px;">${idx + 1}</td>
                  <td style="font-family: var(--font-mono); font-weight: 800; color: #38bdf8; white-space: nowrap; padding: 8px 10px; font-size: 11.5px;">${row.id}</td>
                  <td style="font-family: var(--font-mono); font-weight: 700; color: #fff; white-space: nowrap; padding: 8px 10px; font-size: 11.5px;">${row.machineSerial}</td>
                  <td style="font-weight: 600; color: #e2e8f0; padding: 8px 10px; font-size: 11.5px; white-space: nowrap;">${row.machineName}</td>
                  <td style="font-size: 11px; color: #94a3b8; padding: 8px 10px; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${row.sourceLocation}">${row.sourceLocation}</td>
                  <td style="font-size: 11px; color: #86efac; font-weight: 600; padding: 8px 10px; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${row.destLocation}">${row.destLocation}</td>
                  <td style="font-size: 11.5px; color: #94a3b8; padding: 8px 10px; white-space: nowrap;">${row.prevFloor}</td>
                  <td style="font-size: 11.5px; color: #86efac; font-weight: 600; padding: 8px 10px; white-space: nowrap;">${row.newFloor}</td>
                  <td style="font-size: 11.5px; color: #94a3b8; padding: 8px 10px; white-space: nowrap;">${row.prevLine}</td>
                  <td style="font-size: 11.5px; color: #86efac; font-weight: 600; padding: 8px 10px; white-space: nowrap;">${row.newLine}</td>
                  <td style="font-family: var(--font-mono); font-size: 11px; color: #fbbf24; padding: 8px 10px; white-space: nowrap;">${dateStr}</td>
                  <td style="font-size: 11.5px; color: #c084fc; font-weight: 600; padding: 8px 10px; white-space: nowrap;">${row.transferredBy}</td>
                  <td style="text-align: center; padding: 8px;">${statusBadge(row.status)}</td>
                  <td style="font-size: 11px; color: #94a3b8; padding: 8px 10px; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${reasonStr}">${reasonStr}${remarksStr}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
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
    <div style="display: flex; flex-direction: column; gap: 16px;">
      
      <!-- 1. COMPREHENSIVE FILTER TOOLBAR CONTAINER -->
      <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 18px 20px; display: flex; flex-direction: column; gap: 14px; box-shadow: var(--shadow-sm);">
        
        <!-- Filter Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 10px; flex-wrap: wrap; gap: 10px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 16px;">🔍</span>
            <span style="font-size: 13.5px; font-weight: 800; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.5px;">
              Spare Parts History &amp; Consumption Filters
            </span>
          </div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <button id="sp-btn-export-excel" class="btn btn-primary btn-sm" style="font-weight: 700; background: linear-gradient(135deg, #0284c7, #0369a1); height: 32px;">
              📥 Export Excel (.xlsx)
            </button>
            <button id="sp-btn-clear-filters" class="btn btn-secondary btn-sm" style="height: 32px; font-weight: 700;">
              ↺ Clear Filters
            </button>
          </div>
        </div>

        <!-- Row 1: Plant Hierarchy Cascading Filters (Group -> Unit -> Floor -> Line) -->
        <div>
          <div style="font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
            🏢 1. Plant Location Hierarchy:
          </div>
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;">
            
            <!-- Group -->
            <div class="filter-group">
              <label class="filter-label" style="font-size: 10.5px; font-weight: 700; color: #cbd5e1; margin-bottom: 3px;">Group</label>
              <select id="sp-filter-group" class="filter-select" style="height: 36px; font-size: 12px;">
                <option value="">All Groups (${groups.length})</option>
                ${groups.map(g => `<option value="${g.id}" ${spareFilterState.groupId === g.id ? 'selected' : ''}>${g.name}</option>`).join('')}
              </select>
            </div>

            <!-- Unit / Factory -->
            <div class="filter-group">
              <label class="filter-label" style="font-size: 10.5px; font-weight: 700; color: #cbd5e1; margin-bottom: 3px;">Unit / Factory</label>
              <select id="sp-filter-unit" class="filter-select" style="height: 36px; font-size: 12px;">
                <option value="">All Units (${units.length})</option>
                ${units.map(u => `<option value="${u.id}" ${spareFilterState.unitId === u.id ? 'selected' : ''}>${u.name}</option>`).join('')}
              </select>
            </div>

            <!-- Floor -->
            <div class="filter-group">
              <label class="filter-label" style="font-size: 10.5px; font-weight: 700; color: #cbd5e1; margin-bottom: 3px;">Floor</label>
              <select id="sp-filter-floor" class="filter-select" style="height: 36px; font-size: 12px;">
                <option value="">All Floors (${floors.length})</option>
                ${floors.map(f => `<option value="${f.id}" ${spareFilterState.floorId === f.id ? 'selected' : ''}>${f.name}</option>`).join('')}
              </select>
            </div>

            <!-- Line / Section -->
            <div class="filter-group">
              <label class="filter-label" style="font-size: 10.5px; font-weight: 700; color: #cbd5e1; margin-bottom: 3px;">Line / Section</label>
              <select id="sp-filter-line" class="filter-select" style="height: 36px; font-size: 12px;">
                <option value="">All Lines (${lines.length})</option>
                ${lines.map(l => `<option value="${l.id}" ${spareFilterState.lineId === l.id ? 'selected' : ''}>${l.name}</option>`).join('')}
              </select>
            </div>

          </div>
        </div>

        <!-- Row 2: Machine, Spare Part, Status, Date Range & Search -->
        <div>
          <div style="font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
            ⚙️ 2. Technical, Spare Part, Date &amp; Status Criteria:
          </div>
          <div style="display: grid; grid-template-columns: 1.5fr 1.5fr 1.2fr 1.2fr 1.2fr 1.8fr; gap: 10px; align-items: flex-end;">
            
            <!-- Machine Selector -->
            <div class="filter-group">
              <label class="filter-label" style="font-size: 10.5px; font-weight: 700; color: #cbd5e1; margin-bottom: 3px;">Machine (Serial / Type)</label>
              <select id="sp-filter-machine" class="filter-select" style="height: 36px; font-size: 12px;">
                <option value="">All Machines in Scope (${availableMachines.length})</option>
                ${availableMachines.slice(0, 100).map(m => `
                  <option value="${m.id}" ${spareFilterState.machineId === m.id ? 'selected' : ''}>
                    ${m.serialNumber} (${m.name || 'Machine'})
                  </option>
                `).join('')}
              </select>
            </div>

            <!-- Spare Part Selector -->
            <div class="filter-group">
              <label class="filter-label" style="font-size: 10.5px; font-weight: 700; color: #cbd5e1; margin-bottom: 3px;">Spare Part Item</label>
              <select id="sp-filter-part" class="filter-select" style="height: 36px; font-size: 12px;">
                <option value="">All Spare Parts (${sparePartsCatalog.length})</option>
                ${sparePartsCatalog.map(p => `
                  <option value="${p.name}" ${spareFilterState.sparePart === p.name ? 'selected' : ''}>
                    ${p.name} [${p.code || 'SP'}]
                  </option>
                `).join('')}
              </select>
            </div>

            <!-- Status Filter -->
            <div class="filter-group">
              <label class="filter-label" style="font-size: 10.5px; font-weight: 700; color: #cbd5e1; margin-bottom: 3px;">Status</label>
              <select id="sp-filter-status" class="filter-select" style="height: 36px; font-size: 12px;">
                <option value="ALL" ${spareFilterState.status === 'ALL' ? 'selected' : ''}>All Statuses</option>
                <option value="USED" ${spareFilterState.status === 'USED' ? 'selected' : ''}>🟢 Used / Installed</option>
                <option value="RETURNED" ${spareFilterState.status === 'RETURNED' ? 'selected' : ''}>🔄 Returned to Store</option>
                <option value="CANCELLED" ${spareFilterState.status === 'CANCELLED' ? 'selected' : ''}>❌ Cancelled / Scrapped</option>
                <option value="ISSUED" ${spareFilterState.status === 'ISSUED' ? 'selected' : ''}>📦 Issued / Pending</option>
              </select>
            </div>

            <!-- Date From -->
            <div class="filter-group">
              <label class="filter-label" style="font-size: 10.5px; font-weight: 700; color: #cbd5e1; margin-bottom: 3px;">Date From</label>
              <input type="date" id="sp-filter-date-from" class="form-control" value="${spareFilterState.dateFrom || ''}" style="height: 36px; font-size: 12px; padding: 4px 8px;" />
            </div>

            <!-- Date To -->
            <div class="filter-group">
              <label class="filter-label" style="font-size: 10.5px; font-weight: 700; color: #cbd5e1; margin-bottom: 3px;">Date To</label>
              <input type="date" id="sp-filter-date-to" class="form-control" value="${spareFilterState.dateTo || ''}" style="height: 36px; font-size: 12px; padding: 4px 8px;" />
            </div>

            <!-- Unified Search Box -->
            <div class="filter-group">
              <label class="filter-label" style="font-size: 10.5px; font-weight: 700; color: #cbd5e1; margin-bottom: 3px;">Search</label>
              <div style="position: relative;">
                <input 
                  type="text" 
                  id="sp-filter-search" 
                  class="form-control" 
                  placeholder="🔍 Search part, code, slip #, tech..." 
                  value="${spareFilterState.search || ''}"
                  style="height: 36px; font-size: 12px; padding-left: 10px;"
                />
              </div>
            </div>

          </div>
        </div>

      </div>

      <!-- 2. SUMMARY KPI & SCOPE BANNER -->
      <div style="background: linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.9)); border: 1.5px solid rgba(56, 189, 248, 0.35); border-radius: var(--radius-lg); padding: 18px 22px; display: flex; flex-direction: column; gap: 14px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
        
        <!-- Top Scope Breadcrumb -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 10px;">
          <div style="display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; color: #fff;">
            <span>🏢 Active Scope Summary:</span>
            <code style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; padding: 3px 10px; border-radius: 6px; font-size: 12.5px; font-weight: 800; border: 1px solid rgba(56, 189, 248, 0.3);">
              ${kpi.locationSummaryText}
            </code>
          </div>
          <div style="font-size: 12px; color: var(--text-secondary);">
            Showing <strong>${kpi.distinctPartsCount}</strong> distinct spare parts across <strong>${kpi.recordsCount}</strong> transactions
          </div>
        </div>

        <!-- KPI Metrics Grid -->
        <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 14px;">
          
          <!-- Card 1: Total Issued -->
          <div style="background: rgba(2, 132, 199, 0.12); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: var(--radius-md); padding: 12px 16px;">
            <div style="font-size: 11px; font-weight: 700; color: #38bdf8; text-transform: uppercase;">Total Issued</div>
            <div style="font-size: 24px; font-weight: 900; color: #fff; margin-top: 4px;">
              ${kpi.totalIssued} <span style="font-size: 12px; color: #94a3b8; font-weight: 600;">pcs</span>
            </div>
            <div style="font-size: 10.5px; color: var(--text-muted); margin-top: 2px;">Gross Store Issues</div>
          </div>

          <!-- Card 2: Total Used (Highlight) -->
          <div style="background: rgba(16, 185, 129, 0.15); border: 1.5px solid #10b981; border-radius: var(--radius-md); padding: 12px 16px; box-shadow: 0 0 15px rgba(16, 185, 129, 0.15);">
            <div style="font-size: 11px; font-weight: 800; color: #34d399; text-transform: uppercase;">Total Spare Parts Used</div>
            <div style="font-size: 26px; font-weight: 900; color: #34d399; margin-top: 4px;">
              ${kpi.totalUsed} <span style="font-size: 13px; color: #a7f3d0; font-weight: 700;">pcs</span>
            </div>
            <div style="font-size: 10.5px; color: #a7f3d0; margin-top: 2px;">🟢 Successfully Installed</div>
          </div>

          <!-- Card 3: Total Returned -->
          <div style="background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(251, 191, 36, 0.3); border-radius: var(--radius-md); padding: 12px 16px;">
            <div style="font-size: 11px; font-weight: 700; color: #fbbf24; text-transform: uppercase;">Total Returned</div>
            <div style="font-size: 24px; font-weight: 900; color: #fbbf24; margin-top: 4px;">
              ${kpi.totalReturned} <span style="font-size: 12px; color: #94a3b8; font-weight: 600;">pcs</span>
            </div>
            <div style="font-size: 10.5px; color: var(--text-muted); margin-top: 2px;">Returned to Store</div>
          </div>

          <!-- Card 4: Current / Unreturned -->
          <div style="background: rgba(139, 92, 246, 0.12); border: 1px solid rgba(167, 139, 250, 0.3); border-radius: var(--radius-md); padding: 12px 16px;">
            <div style="font-size: 11px; font-weight: 700; color: #c084fc; text-transform: uppercase;">Current / Unreturned</div>
            <div style="font-size: 24px; font-weight: 900; color: #c084fc; margin-top: 4px;">
              ${kpi.currentUnreturned} <span style="font-size: 12px; color: #94a3b8; font-weight: 600;">pcs</span>
            </div>
            <div style="font-size: 10.5px; color: var(--text-muted); margin-top: 2px;">In Floor Inventory</div>
          </div>

          <!-- Card 5: Estimated Cost / Value -->
          <div style="background: rgba(244, 63, 94, 0.12); border: 1px solid rgba(251, 113, 133, 0.3); border-radius: var(--radius-md); padding: 12px 16px;">
            <div style="font-size: 11px; font-weight: 700; color: #fb7185; text-transform: uppercase;">Total Consumption Value</div>
            <div style="font-size: 22px; font-weight: 900; color: #fff; margin-top: 4px;">
              BDT ${kpi.totalValue.toLocaleString()}
            </div>
            <div style="font-size: 10.5px; color: var(--text-muted); margin-top: 2px;">Replacement Valuation</div>
          </div>

        </div>

      </div>

      <!-- 3. VIEW MODE SWITCHER TABS -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid var(--border-color); padding-bottom: 6px; flex-wrap: wrap; gap: 10px;">
        <div style="display: flex; gap: 8px;">
          <button class="btn ${spareFilterState.viewMode === 'SUMMARY' ? 'btn-primary' : 'btn-ghost'}" data-sp-mode="SUMMARY" style="font-size: 12.5px; font-weight: 700; padding: 6px 16px;">
            📊 Location &amp; Spare Part Aggregated Summary (${aggregatedList.length})
          </button>
          <button class="btn ${spareFilterState.viewMode === 'LEDGER' ? 'btn-primary' : 'btn-ghost'}" data-sp-mode="LEDGER" style="font-size: 12.5px; font-weight: 700; padding: 6px 16px;">
            📜 Detailed Transaction Ledger (${transactions.length})
          </button>
        </div>
      </div>

      <!-- 4. DATA TABLES -->
      ${spareFilterState.viewMode === 'SUMMARY' ? `
        <!-- Aggregated Summary Table Grouped by Location & Part -->
        <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); overflow-x: auto; box-shadow: var(--shadow-sm);">
          <table class="data-table" style="width: 100%; min-width: 1150px; border-collapse: collapse; margin: 0;">
            <thead>
              <tr>
                <th style="width: 48px; text-align: center;">SL</th>
                <th style="min-width: 260px; text-align: left;">Location Hierarchy</th>
                <th style="min-width: 180px; text-align: left;">Spare Part Name</th>
                <th style="min-width: 130px; text-align: left;">Part Number</th>
                <th style="min-width: 130px; text-align: left;">Category</th>
                <th style="text-align: center; width: 90px; color: #38bdf8;">Issued</th>
                <th style="text-align: center; width: 105px; color: #34d399; font-weight: 800;">Total Used</th>
                <th style="text-align: center; width: 95px; color: #fbbf24;">Returned</th>
                <th style="text-align: center; width: 100px; color: #c084fc;">Unreturned</th>
                <th style="text-align: right; width: 115px;">Unit Price</th>
                <th style="text-align: right; width: 130px; color: #38bdf8;">Total Value</th>
                <th style="text-align: center; width: 100px;">Machines</th>
              </tr>
            </thead>
            <tbody>
              ${aggregatedList.length === 0 ? `
                <tr><td colspan="12" style="text-align: center; padding: 36px; color: var(--text-muted);">No spare parts consumption records found for the selected filter criteria.</td></tr>
              ` : aggregatedList.map((agg, idx) => `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.06);" class="hover-row">
                  <td style="text-align: center; color: var(--text-muted); font-weight: 700;">${idx + 1}</td>
                  <td>
                    <div style="display: flex; flex-direction: column; gap: 2px;">
                      <div style="font-size: 12px; font-weight: 700; color: #38bdf8; display: flex; align-items: center; gap: 4px; white-space: nowrap;">
                        <span>🏢 ${agg.unitName || 'Unit'}</span>
                        <span style="color: #64748b;">›</span>
                        <span style="color: #f1f5f9;">${agg.floorName || 'Floor'}</span>
                      </div>
                      <div style="font-size: 11px; color: #94a3b8; display: flex; align-items: center; gap: 4px; white-space: nowrap;">
                        <span style="color: #34d399; font-weight: 600;">⚡ ${agg.lineName || 'Line'}</span>
                        <span style="color: #475569;">|</span>
                        <span>${agg.groupName || 'Group'}</span>
                      </div>
                    </div>
                  </td>
                  <td style="font-weight: 800; color: #fff; font-size: 13px;">
                    ${agg.partName}
                  </td>
                  <td>
                    <code style="background: rgba(56, 189, 248, 0.12); color: #38bdf8; padding: 2px 7px; border-radius: 4px; font-size: 11.5px; font-weight: 700; border: 1px solid rgba(56, 189, 248, 0.25); white-space: nowrap;">
                      ${agg.partNumber}
                    </code>
                  </td>
                  <td>
                    <span class="badge badge-idle" style="font-size: 11px; padding: 3px 8px; white-space: nowrap;">
                      ${agg.category}
                    </span>
                  </td>
                  <td style="text-align: center; font-weight: 700; color: #fff;">${agg.totalIssued}</td>
                  <td style="text-align: center; font-weight: 900; color: #34d399; font-size: 13.5px; background: rgba(16, 185, 129, 0.08);">${agg.totalUsed}</td>
                  <td style="text-align: center; font-weight: 700; color: #fbbf24;">${agg.totalReturned}</td>
                  <td style="text-align: center; font-weight: 700; color: #c084fc;">${agg.currentUnreturned}</td>
                  <td style="text-align: right; font-family: var(--font-mono); font-size: 12px; color: #cbd5e1; white-space: nowrap;">BDT ${agg.unitPrice.toLocaleString()}</td>
                  <td style="text-align: right; font-family: var(--font-mono); font-weight: 800; color: #38bdf8; font-size: 12.5px; white-space: nowrap;">BDT ${agg.totalValue.toLocaleString()}</td>
                  <td style="text-align: center; white-space: nowrap;">
                    <span class="badge badge-active" style="font-size: 10.5px; padding: 2px 7px;">${agg.machinesUsedCount} Unit(s)</span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
            ${aggregatedList.length > 0 ? `
              <tfoot>
                <tr style="background: #0b1329; font-weight: 800; border-top: 2px solid #38bdf8;">
                  <td colspan="5" style="text-align: right; color: #fff; font-size: 12.5px; letter-spacing: 0.5px; padding-right: 16px;">TOTAL CONSUMPTION:</td>
                  <td style="text-align: center; color: #38bdf8; font-size: 13px; font-weight: 800;">${kpi.totalIssued} pcs</td>
                  <td style="text-align: center; color: #34d399; font-size: 14px; font-weight: 900; background: rgba(16, 185, 129, 0.15);">${kpi.totalUsed} pcs</td>
                  <td style="text-align: center; color: #fbbf24; font-size: 13px; font-weight: 800;">${kpi.totalReturned} pcs</td>
                  <td style="text-align: center; color: #c084fc; font-size: 13px; font-weight: 800;">${kpi.currentUnreturned} pcs</td>
                  <td></td>
                  <td style="text-align: right; color: #38bdf8; font-size: 13.5px; font-family: var(--font-mono); font-weight: 800; white-space: nowrap;">BDT ${kpi.totalValue.toLocaleString()}</td>
                  <td></td>
                </tr>
              </tfoot>
            ` : ''}
          </table>
        </div>
      ` : `
        <!-- Detailed Transaction Ledger Table -->
        <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); overflow-x: auto; box-shadow: var(--shadow-sm);">
          <table class="data-table" style="width: 100%; min-width: 1280px; border-collapse: collapse; margin: 0;">
            <thead>
              <tr>
                <th style="width: 48px; text-align: center;">SL</th>
                <th style="width: 100px; text-align: left;">Date</th>
                <th style="width: 120px; text-align: left;">Requisition #</th>
                <th style="min-width: 240px; text-align: left;">Location Hierarchy</th>
                <th style="width: 130px; text-align: left;">Machine Serial</th>
                <th style="min-width: 170px; text-align: left;">Spare Part Name</th>
                <th style="text-align: center; width: 95px;">Status</th>
                <th style="text-align: center; width: 80px;">Issued</th>
                <th style="text-align: center; width: 80px; color: #34d399;">Used</th>
                <th style="text-align: center; width: 80px; color: #fbbf24;">Returned</th>
                <th style="min-width: 140px; text-align: left;">Mechanic / Technician</th>
                <th style="min-width: 120px; text-align: left;">Issued By</th>
                <th style="min-width: 160px; text-align: left;">Reason / Remarks</th>
              </tr>
            </thead>
            <tbody>
              ${transactions.length === 0 ? `
                <tr><td colspan="13" style="text-align: center; padding: 36px; color: var(--text-muted);">No transaction logs match the active filter criteria.</td></tr>
              ` : transactions.map((t, idx) => `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.06);" class="hover-row">
                  <td style="text-align: center; color: var(--text-muted); font-weight: 700;">${idx + 1}</td>
                  <td style="font-family: var(--font-mono); font-size: 11.5px; color: #38bdf8; white-space: nowrap;">${t.date}</td>
                  <td style="font-family: var(--font-mono); font-weight: 700; color: #fff; font-size: 11.5px; white-space: nowrap;">${t.reqNumber}</td>
                  <td style="font-size: 11.5px; color: var(--text-secondary);">
                    <div style="display: flex; flex-direction: column; gap: 2px;">
                      <span style="font-weight: 700; color: #38bdf8; font-size: 11.5px; white-space: nowrap;">${t.unitName || 'Unit'} › ${t.floorName || 'Floor'}</span>
                      <span style="color: #94a3b8; font-size: 10.5px; white-space: nowrap;">${t.lineName || 'Line'} (${t.groupName || 'Group'})</span>
                    </div>
                  </td>
                  <td style="font-family: var(--font-mono); font-weight: 700; color: #38bdf8; white-space: nowrap;">${t.machineSerial}</td>
                  <td style="font-weight: 700; color: #fff;">
                    ${t.partName} <span style="font-size: 11px; color: var(--text-muted); font-family: var(--font-mono);">(${t.partNumber})</span>
                  </td>
                  <td style="text-align: center; white-space: nowrap;">
                    <span class="badge ${t.status === 'USED' ? 'badge-active' : (t.status === 'RETURNED' ? 'badge-maint' : (t.status === 'CANCELLED' ? 'badge-breakdown' : 'badge-idle'))}">
                      ${t.status}
                    </span>
                  </td>
                  <td style="text-align: center; font-weight: 700;">${t.issuedQty}</td>
                  <td style="text-align: center; font-weight: 800; color: #34d399;">${t.usedQty}</td>
                  <td style="text-align: center; font-weight: 700; color: #fbbf24;">${t.returnedQty}</td>
                  <td style="font-size: 12px; color: #fff;">${t.technician}</td>
                  <td style="font-size: 12px; color: var(--text-secondary);">${t.issuedBy}</td>
                  <td style="font-size: 11.5px; color: var(--text-secondary);">${t.reason || t.remarks || '—'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `}

    </div>
  `;
}

// 4. 1-CLICK EXPORT CENTER TAB
function renderExportCenterTab(machines, transfers, logs, catalog) {
  return `
    <div style="display: flex; flex-direction: column; gap: 16px;">
      
      <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 22px;">
        <h3 style="margin: 0 0 6px 0; font-size: 16px; font-weight: 800; color: #fff;">
          📦 1-Click Excel Export &amp; Analytics Hub
        </h3>
        <p style="margin: 0; font-size: 12.5px; color: var(--text-secondary);">
          Download production-ready, perfectly formatted <strong>.xlsx</strong> workbooks containing complete datasets, calculated metrics, and full audit trails.
        </p>
      </div>

      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;">
        
        <!-- Card 1: Complete Machine Inventory -->
        <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 20px; display: flex; flex-direction: column; justify-content: space-between; gap: 14px;">
          <div>
            <div style="font-size: 20px; margin-bottom: 6px;">🧵</div>
            <div style="font-size: 15px; font-weight: 800; color: #fff;">Complete Machinery Inventory</div>
            <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px; line-height: 1.4;">
              Full corporate machine asset database (${machines.length} machines) including brand, model, factory, floor, line, and technical custom fields.
            </div>
          </div>
          <button id="btn-center-export-machines" class="btn btn-primary" style="font-weight: 700; background: linear-gradient(135deg, #0284c7, #0369a1);">
            📊 Download Machine Inventory Excel
          </button>
        </div>

        <!-- Card 2: Transfers & Movement Logs -->
        <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 20px; display: flex; flex-direction: column; justify-content: space-between; gap: 14px;">
          <div>
            <div style="font-size: 20px; margin-bottom: 6px;">🔄</div>
            <div style="font-size: 15px; font-weight: 800; color: #fff;">Machine Transfers Ledger</div>
            <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px; line-height: 1.4;">
              Comprehensive relocation history (${transfers.length} records) with source/destination units, tracking numbers, gate passes, and approvals.
            </div>
          </div>
          <button id="btn-center-export-transfers" class="btn btn-secondary" style="font-weight: 700; border-color: #38bdf8; color: #38bdf8;">
            📊 Download Transfers Ledger Excel
          </button>
        </div>

        <!-- Card 3: Spare Parts Replacements -->
        <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 20px; display: flex; flex-direction: column; justify-content: space-between; gap: 14px;">
          <div>
            <div style="font-size: 20px; margin-bottom: 6px;">⚙️</div>
          <!-- Card 4: Spare Parts Replacements -->
          <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 20px; display: flex; flex-direction: column; justify-content: space-between; gap: 14px;">
            <div>
              <div style="font-size: 20px; margin-bottom: 6px;">⚙️</div>
              <div style="font-size: 15px; font-weight: 800; color: #fff;">Spare Parts History Export</div>
              <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px; line-height: 1.4;">
                Spare parts replacement logs, machine wear-and-tear histories, and maintenance service records (${logs.length} records).
              </div>
            </div>
            <button id="btn-center-export-spareparts" class="btn btn-secondary" style="font-weight: 700; border-color: #34d399; color: #34d399;">
              📊 Download Spare Parts Excel
            </button>
          </div>

          <!-- Card 4: ENT Lab Boards -->
          <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 20px; display: flex; flex-direction: column; justify-content: space-between; gap: 14px;">
            <div>
              <div style="font-size: 20px; margin-bottom: 6px;">⚡</div>
              <div style="font-size: 15px; font-weight: 800; color: #fff;">ENT Lab Boards &amp; Movement Ledger</div>
              <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px; line-height: 1.4;">
                Full Board/PCB master inventory, machine installation trails, in-house &amp; external repair turnarounds, and duplicate-bill audit history.
              </div>
            </div>
            <button id="btn-center-export-etlab" class="btn btn-secondary" style="font-weight: 700; border-color: #38bdf8; color: #38bdf8;">
              📊 Download ENT Lab Excel
            </button>
          </div>

          <!-- Card 5: Complete Master ERP Workbook -->
          <div style="grid-column: span 2; background: linear-gradient(135deg, rgba(2, 132, 199, 0.12), rgba(15, 23, 42, 0.8)); border: 1.5px solid rgba(56, 189, 248, 0.4); border-radius: var(--radius-lg); padding: 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 22px;">📜</span>
                <div style="font-size: 16px; font-weight: 800; color: #fff;">Complete Corporate Master ERP Workbook</div>
              </div>
              <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px; line-height: 1.4;">
                Comprehensive multi-sheet workbook containing Machine Inventory, Transfers, Spare Parts, ENT Lab Boards &amp; History, Manpower, and Master Catalog.
              </div>
            </div>
            <button id="btn-center-export-lifetime" class="btn btn-primary" style="font-weight: 800; background: linear-gradient(135deg, #0284c7, #0369a1); box-shadow: 0 2px 10px rgba(2, 132, 199, 0.35);">
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

  // Real-time Firebase listener for Transfer Reports tab —
  // Fires when any device writes to TRANSFERS or TRANSFER_REQUESTS in Firestore.
  // Remove any stale listener before attaching a new one.
  if (window._reportsTransferListener) {
    window.removeEventListener('erp:transfers-updated', window._reportsTransferListener);
  }
  window._reportsTransferListener = () => {
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
  window.addEventListener('erp:transfers-updated', window._reportsTransferListener);

  // Transfer Report Excel Export
  const btnExpTrans = document.getElementById('btn-export-transfer-report-excel');
  if (btnExpTrans) {
    btnExpTrans.addEventListener('click', () => {
      notificationService.withLoading(btnExpTrans, async () => {
        const allTransfers = transferService.getTransferRequests({ status: 'ALL' });
        await transferService.exportTransfersToExcel(allTransfers);
      }, 'Exporting Transfers...', 'Transfer records exported successfully!');
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
