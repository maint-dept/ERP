/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Official Preventive Machine Maintenance Report & Print System Module
 * 
 * Exact Replica of Official Al-Muslim Group Form:
 * 1. Company Name & Department: Al-Muslim Group / MAINTENANCE DEPARTMENT
 * 2. Report Title: PREVENTIVE MACHINE MAINTENANCE (Bordered Header Box)
 * 3. Associate Companies List
 * 4. Header Metadata: Unit, Floor / Area, Servicing Date, Next Servicing Date
 * 5. Exact 10-Column Sequence:
 *    [1] Sl. No. (01, 02, 03...)
 *    [2] M/C Name
 *    [3] M/C Number
 *    [4] M/C Model/Type
 *    [5] Previous Servicing Date:
 *    [6] Sticker Sl. No.
 *    [7] Line or Section
 *    [8] Work Summary (Wide column)
 *    [9] Servicer Name
 *    [10] Signature
 * 6. Four Bottom Approval Signatures:
 *    - Engineer
 *    - Manager
 *    - Sr. Manager/AGM
 *    - General Manager
 * 7. Complete Actions:
 *    - Save Maintenance Records to Database & History Sync
 *    - Export PDF (A4 Landscape)
 *    - Export Excel (.xlsx) with SheetJS
 *    - Export CSV
 *    - Direct Print Dialog (window.print)
 *    - Live Interactive Report Preview & In-Table Editing
 *    - Search & Filter Integration (Unit, Floor, Line, Machine No, Date, Servicer)
 *    - Auto-fill from Machine Inventory with Previous Servicing Date Lookup
 *    - Blank 10-Row Form Printing for Factory Floor Clipboard Use
 */

import { storage } from '../db/storage.js';
import { TABLE_NAMES } from '../db/schema.js';
import { authService } from '../services/authService.js';
import { masterDataService } from '../services/masterDataService.js';
import { preventiveMaintenanceService } from '../services/preventiveMaintenanceService.js';
import { machineService } from '../services/machineService.js';
import { employeeService } from '../services/employeeService.js';
import { historyService } from '../services/historyService.js';
import { notificationService } from '../services/notificationService.js';
import { auditService } from '../services/auditService.js';
import { state } from '../state.js';

// Local State for the Preventive Maintenance Report Module
let reportState = {
  unitId: 'ALL',
  unitName: '',
  floorId: 'ALL',
  floorName: '',
  lineId: 'ALL',
  lineName: '',
  servicingDate: new Date().toISOString().split('T')[0],
  nextServicingDate: '',
  defaultServicer: '',
  defaultServicerCard: '',
  previewMode: false, // false = interactive edit mode; true = clean printable preview
  rows: [], // Array of row items
  activeSearchQuery: '',
  padToTenRows: true // ensure minimum 10 rows on standard A4 page
};

/**
 * Associate Companies of Al-Muslim Group as listed in official header
 */
export const ASSOCIATE_COMPANIES = [
  'A.K.M Knit Wear Ltd.',
  'Pacific Blue (Smart Wear) Ltd.',
  'Al-Muslim Washing Ltd.',
  'Al-Muslim Garments Accessories Ltd.',
  'Al-Muslim Yarn Dyeing Ltd.',
  'Al-Muslim Apparels Ltd.'
];

/**
 * Common quick checklist actions to insert into Work Summary
 */
export const WORK_SUMMARY_PRESETS = [
  'Full cleaning, oiling & loop timing adjusted',
  'Needle bar alignment & timing adjusted',
  'Belt tension, motor inspection & oil pump check',
  'Thread trimmer adjusted & safety guard checked',
  'Feed dog, presser foot & tension disc adjusted',
  'Full preventive inspection & electrical wiring check',
  'Complete overhaul, motor bearing & oil replacement'
];

/**
 * Standard DD-MM-YYYY Date Formatter
 */
function formatDMY(dateStr) {
  if (!dateStr || dateStr === 'N/A' || dateStr === 'Never' || dateStr === '-' || dateStr === '—') return '—';
  try {
    const parts = String(dateStr).split('T')[0].split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
      return `${parts[0]}-${parts[1]}-${parts[2]}`;
    }
    return dateStr;
  } catch (_) {
    return dateStr;
  }
}

/**
 * Escape HTML for safe rendering
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Initialize / Reset Default 10 Rows
 */
function getInitialRows() {
  const rows = [];
  for (let i = 1; i <= 10; i++) {
    rows.push({
      id: `row-${Date.now()}-${i}`,
      slNo: String(i).padStart(2, '0'),
      machineId: '',
      machineName: '',
      machineNumber: '',
      machineModel: '',
      previousServicingDate: '',
      stickerSerial: '',
      lineOrSection: '',
      workSummary: '',
      servicerName: '',
      servicerCard: '',
      signature: '',
      isExistingSaved: false,
      isAutoFilled: false
    });
  }
  return rows;
}

/**
 * Calculates Next Servicing Date based on servicing date and days interval
 */
function computeNextDate(servicingDate, days = 90) {
  if (!servicingDate) return '';
  try {
    const d = new Date(servicingDate);
    if (isNaN(d.getTime())) return '';
    d.setDate(d.getDate() + parseInt(days, 10));
    return d.toISOString().split('T')[0];
  } catch (_) {
    return '';
  }
}

/**
 * Main Render Function for Preventive Machine Maintenance Report View
 */
export function renderPreventiveMaintenanceReportView() {
  const isAdmin = authService.isAdmin();
  const canSave = isAdmin || (typeof authService.hasAccess === 'function' ? authService.hasAccess('preventive_maintenance', 'CREATE_SERVICE') : true);
  const canExport = isAdmin || (typeof authService.hasAccess === 'function' ? authService.hasAccess('preventive_maintenance', 'EXPORT') : true);

  // Initialize rows if empty
  if (!reportState.rows || reportState.rows.length === 0) {
    reportState.rows = getInitialRows();
  }

  // Calculate default next servicing date if not set
  if (!reportState.nextServicingDate && reportState.servicingDate) {
    reportState.nextServicingDate = computeNextDate(reportState.servicingDate, 90);
  }

  // Preload Master Data
  const units = masterDataService.getUnits ? masterDataService.getUnits() : [];
  const floors = masterDataService.getFloors ? masterDataService.getFloors(reportState.unitId === 'ALL' ? null : reportState.unitId) : [];
  const lines = masterDataService.getLines ? masterDataService.getLines(reportState.floorId === 'ALL' ? null : reportState.floorId) : [];
  const mechanics = employeeService.getEmployees ? employeeService.getEmployees({ role: 'MECHANIC', status: 'ACTIVE' }) : [];

  // Active Display Labels
  let activeUnitLabel = reportState.unitName;
  if (!activeUnitLabel && reportState.unitId !== 'ALL') {
    const u = units.find(x => x.id === reportState.unitId);
    activeUnitLabel = u?.name || reportState.unitId;
  }
  let activeFloorLabel = reportState.floorName;
  if (!activeFloorLabel && reportState.floorId !== 'ALL') {
    const f = floors.find(x => x.id === reportState.floorId);
    activeFloorLabel = f?.name || reportState.floorId;
  }

  // Prepare Printable Rows (ensure pad to 10 rows if setting enabled)
  let displayRows = [...reportState.rows];
  if (reportState.padToTenRows && displayRows.length < 10) {
    const startIdx = displayRows.length + 1;
    for (let i = startIdx; i <= 10; i++) {
      displayRows.push({
        id: `pad-row-${i}`,
        slNo: String(i).padStart(2, '0'),
        machineId: '',
        machineName: '',
        machineNumber: '',
        machineModel: '',
        previousServicingDate: '',
        stickerSerial: '',
        lineOrSection: '',
        workSummary: '',
        servicerName: '',
        servicerCard: '',
        signature: '',
        isPad: true
      });
    }
  }

  const filledCount = reportState.rows.filter(r => r.machineNumber && r.machineNumber.trim()).length;

  return `
    <div class="pm-report-module-wrapper" style="display: flex; flex-direction: column; gap: 8px; width: 100%; box-sizing: border-box;">
      
      <!-- 1. TOP INTERACTIVE TOOLBAR (HIDDEN IN PRINT) -->
      <div class="pm-report-toolbar no-print" style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 8px 12px; display: flex; flex-direction: column; gap: 8px; box-shadow: var(--shadow-sm);">
        
        <!-- Filter Row & Document Parameters -->
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap;">
          
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <span style="font-size: 16px;">📑</span>
            <div style="display: flex; flex-direction: column;">
              <div style="display: flex; align-items: center; gap: 6px;">
                <h2 style="font-size: 14px; font-weight: 800; color: #fff; margin: 0;">Official Maintenance Report &amp; Print System</h2>
                <span class="badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); font-size: 10px; padding: 1px 6px;">
                  Al-Muslim Standard
                </span>
                <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); font-size: 10px; padding: 1px 6px;">
                  ${filledCount} M/C Loaded
                </span>
              </div>
              <span style="font-size: 11px; color: var(--text-muted);">
                Exact replica of factory maintenance physical sheet with 10 columns, header metadata &amp; 4 bottom approval signatures.
              </span>
            </div>
          </div>

          <!-- Action Buttons Group (Export, Print, Save, Preview) -->
          <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-left: auto;">
            ${canSave ? `
              <button id="btn-pm-report-save-record" class="btn btn-primary btn-sm" style="font-weight: 800; background: #10b981; border-color: #059669; color: #fff; height: 30px; font-size: 12px; display: inline-flex; align-items: center; gap: 4px;" title="Save filled rows into database & update machine maintenance history">
                <span>💾</span> Save Record
              </button>
            ` : ''}

            <button id="btn-pm-report-print-direct" class="btn btn-secondary btn-sm" style="font-weight: 700; height: 30px; font-size: 12px; display: inline-flex; align-items: center; gap: 4px;" title="Print official A4 Landscape report or save as PDF">
              <span>🖨️</span> Print Report
            </button>

            ${canExport ? `
              <button id="btn-pm-report-export-pdf" class="btn btn-secondary btn-sm" style="font-weight: 700; height: 30px; font-size: 12px; display: inline-flex; align-items: center; gap: 4px;" title="Export official PDF document">
                <span>📄</span> Export PDF
              </button>
              <button id="btn-pm-report-export-excel" class="btn btn-secondary btn-sm" style="font-weight: 700; color: #10b981; border-color: rgba(16, 185, 129, 0.4); height: 30px; font-size: 12px; display: inline-flex; align-items: center; gap: 4px;" title="Export to official Excel (.xlsx) file">
                <span>📊</span> Export Excel
              </button>
              <button id="btn-pm-report-export-csv" class="btn btn-secondary btn-sm" style="font-weight: 700; height: 30px; font-size: 12px; display: inline-flex; align-items: center; gap: 4px;" title="Download CSV file">
                <span>📥</span> Export CSV
              </button>
            ` : ''}

            <button id="btn-pm-report-toggle-preview" class="btn btn-secondary btn-sm" style="font-weight: 700; height: 30px; font-size: 12px; display: inline-flex; align-items: center; gap: 4px;" title="Toggle between Edit and Preview mode">
              <span>${reportState.previewMode ? '✏️ Edit Mode' : '👁️ Preview'}</span>
            </button>
          </div>
        </div>

        <!-- Secondary Controls Bar: Parameter Inputs & Quick Row Actions -->
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding-top: 6px; border-top: 1px solid rgba(255, 255, 255, 0.06); font-size: 11.5px;">
          
          <!-- Unit Selector -->
          <div style="display: flex; align-items: center; gap: 4px;">
            <label style="color: var(--text-muted); font-weight: 600;">Unit:</label>
            <select id="pm-rep-filter-unit" class="filter-select-compact" style="height: 28px; width: 130px; font-size: 11.5px;">
              <option value="ALL" ${reportState.unitId === 'ALL' ? 'selected' : ''}>All Units</option>
              ${units.map(u => `<option value="${u.id}" ${reportState.unitId === u.id ? 'selected' : ''}>${escapeHtml(u.name)}</option>`).join('')}
            </select>
          </div>

          <!-- Floor / Area Selector -->
          <div style="display: flex; align-items: center; gap: 4px;">
            <label style="color: var(--text-muted); font-weight: 600;">Floor / Area:</label>
            <select id="pm-rep-filter-floor" class="filter-select-compact" style="height: 28px; width: 130px; font-size: 11.5px;">
              <option value="ALL" ${reportState.floorId === 'ALL' ? 'selected' : ''}>All Floors</option>
              ${floors.map(f => `<option value="${f.id}" ${reportState.floorId === f.id ? 'selected' : ''}>${escapeHtml(f.name)}</option>`).join('')}
            </select>
          </div>

          <!-- Line / Section Selector -->
          <div style="display: flex; align-items: center; gap: 4px;">
            <label style="color: var(--text-muted); font-weight: 600;">Line / Section:</label>
            <select id="pm-rep-filter-line" class="filter-select-compact" style="height: 28px; width: 120px; font-size: 11.5px;">
              <option value="ALL" ${reportState.lineId === 'ALL' ? 'selected' : ''}>All Lines</option>
              ${lines.map(l => `<option value="${l.id}" ${reportState.lineId === l.id ? 'selected' : ''}>${escapeHtml(l.name)}</option>`).join('')}
            </select>
          </div>

          <!-- Servicing Date -->
          <div style="display: flex; align-items: center; gap: 4px;">
            <label style="color: var(--text-muted); font-weight: 600;">Servicing Date:</label>
            <input type="date" id="pm-rep-servicing-date" class="filter-search-input" value="${reportState.servicingDate || ''}" style="height: 28px; width: 125px; font-size: 11px; padding: 2px 6px;" />
          </div>

          <!-- Next Servicing Date -->
          <div style="display: flex; align-items: center; gap: 4px;">
            <label style="color: var(--text-muted); font-weight: 600;">Next Servicing Date:</label>
            <input type="date" id="pm-rep-next-servicing-date" class="filter-search-input" value="${reportState.nextServicingDate || ''}" style="height: 28px; width: 125px; font-size: 11px; padding: 2px 6px;" />
          </div>

          <!-- Quick Load & Row Builder Buttons -->
          <div style="display: flex; align-items: center; gap: 5px; margin-left: auto; flex-wrap: wrap;">
            <button id="btn-pm-rep-autoload" class="btn btn-secondary btn-sm" style="font-weight: 700; font-size: 11px; height: 26px; padding: 0 8px; color: #38bdf8;" title="Auto-load machines from Machine Inventory matching the current Unit/Floor/Line filter">
              ⚡ Auto-Load Machines
            </button>
            <button id="btn-pm-rep-load-due" class="btn btn-secondary btn-sm" style="font-weight: 700; font-size: 11px; height: 26px; padding: 0 8px; color: #fbbf24;" title="Auto-load machines currently Overdue or Due Today/Soon">
              🚨 Load Due Machines
            </button>
            <button id="btn-pm-rep-add-row" class="btn btn-secondary btn-sm" style="font-weight: 700; font-size: 11px; height: 26px; padding: 0 8px;" title="Add a new row to the table">
              ➕ Add Row
            </button>
            <button id="btn-pm-rep-print-blank" class="btn btn-secondary btn-sm" style="font-weight: 700; font-size: 11px; height: 26px; padding: 0 8px;" title="Reset and print a blank official 10-row sheet for hand-written floor logs">
              📝 Blank 10-Row Form
            </button>
            <button id="btn-pm-rep-clear-table" class="btn btn-ghost btn-sm" style="font-size: 11px; height: 26px; color: #f87171;" title="Clear all loaded machines">
              ↺ Reset
            </button>
          </div>

        </div>

      </div>

      <!-- 2. OFFICIAL PRINTABLE SHEET CONTAINER (A4 LANDSCAPE WYSIWYG) -->
      <div id="pm-official-report-printable" class="pm-official-sheet-wrapper" style="overflow-x: auto; padding: 10px 0; display: flex; justify-content: center; background: #525659; border-radius: 6px;">
        
        <div class="pm-official-sheet" style="
          width: 297mm; 
          min-height: 210mm; 
          background: #ffffff; 
          color: #000000; 
          box-sizing: border-box; 
          padding: 8mm 10mm; 
          box-shadow: 0 4px 15px rgba(0,0,0,0.35); 
          font-family: 'Segoe UI', Arial, Helvetica, sans-serif; 
          font-size: 11px; 
          line-height: 1.3;
          margin: 0 auto;
          position: relative;
        ">

          <!-- A. OFFICIAL REPORT HEADER -->
          <div class="pm-official-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
            
            <!-- Left: Company Monogram Logo & Department -->
            <div style="flex: 1 1 280px; min-width: 250px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <!-- Stylized AM Triangle Logo -->
                <svg width="34" height="34" viewBox="0 0 100 100" style="display: block; flex-shrink: 0;">
                  <polygon points="50,8 92,88 8,88" fill="none" stroke="#000000" stroke-width="7" />
                  <text x="50" y="68" font-size="34" font-weight="900" font-family="'Segoe UI', Arial, sans-serif" text-anchor="middle" fill="#000000">AM</text>
                </svg>
                <div style="display: flex; flex-direction: column;">
                  <span style="font-size: 21px; font-weight: 800; font-style: italic; font-family: 'Times New Roman', Georgia, serif; letter-spacing: -0.5px; color: #000000; line-height: 1;">
                    al-muslim group
                  </span>
                  <span style="font-size: 12px; font-weight: 800; letter-spacing: 0.6px; font-family: Arial, Helvetica, sans-serif; color: #000000; text-transform: uppercase; margin-top: 2px;">
                    MAINTENANCE DEPARTMENT
                  </span>
                </div>
              </div>
            </div>

            <!-- Center: Distinct Bordered Title Box -->
            <div style="flex: 1 1 340px; text-align: center; display: flex; justify-content: center; align-items: center; padding-top: 2px;">
              <div style="
                border: 1.5px solid #000000; 
                padding: 4px 22px; 
                display: inline-block; 
                border-radius: 2px;
                background: #ffffff;
              ">
                <h1 style="
                  font-size: 16px; 
                  font-weight: 800; 
                  letter-spacing: 1px; 
                  text-transform: uppercase; 
                  color: #000000; 
                  margin: 0; 
                  font-family: Arial, Helvetica, sans-serif;
                ">
                  PREVENTIVE MACHINE MAINTENANCE
                </h1>
              </div>
            </div>

            <!-- Right: Associate Companies List -->
            <div style="flex: 1 1 240px; text-align: right; display: flex; justify-content: flex-end;">
              <div style="font-size: 8.5px; line-height: 1.25; color: #111111; text-align: left; max-width: 210px;">
                <div style="font-weight: 700; text-decoration: underline; margin-bottom: 2px;">Our Associate Companies are:</div>
                ${ASSOCIATE_COMPANIES.map(comp => `<div>• ${escapeHtml(comp)}</div>`).join('')}
              </div>
            </div>

          </div>

          <!-- B. HEADER METADATA 2x2 STRUCTURED GRID BOX (Unit, Floor/Area, Servicing Date, Next Servicing Date) -->
          <div class="pm-official-meta-box" style="
            border: 1.5px solid #000000; 
            margin-bottom: 6px; 
            background: #ffffff;
            display: grid;
            grid-template-columns: 1fr 1fr;
          ">
            <!-- Row 1 Left: Unit -->
            <div style="border-right: 1.5px solid #000000; border-bottom: 1.5px solid #000000; padding: 4px 8px; display: flex; align-items: center; min-height: 24px;">
              <span style="font-weight: 800; font-size: 12px; margin-right: 6px; white-space: nowrap;">Unit :</span>
              ${reportState.previewMode ? `
                <span style="font-weight: 700; font-size: 12px;">${escapeHtml(activeUnitLabel || '—')}</span>
              ` : `
                <input type="text" id="pm-meta-input-unit" class="pm-sheet-inline-input" placeholder="Enter Unit (e.g. Unit-01, Pacific Blue)" value="${escapeHtml(activeUnitLabel || '')}" style="border: none; border-bottom: 1px dotted #999; width: 100%; font-size: 12px; font-weight: 600; padding: 1px 4px; outline: none; background: transparent; color: #000;" />
              `}
            </div>

            <!-- Row 1 Right: Floor / Area -->
            <div style="border-bottom: 1.5px solid #000000; padding: 4px 8px; display: flex; align-items: center; min-height: 24px;">
              <span style="font-weight: 800; font-size: 12px; margin-right: 6px; white-space: nowrap;">Floor / Area :</span>
              ${reportState.previewMode ? `
                <span style="font-weight: 700; font-size: 12px;">${escapeHtml(activeFloorLabel || '—')}</span>
              ` : `
                <input type="text" id="pm-meta-input-floor" class="pm-sheet-inline-input" placeholder="Enter Floor / Area (e.g. 3rd Floor / Sewing Area)" value="${escapeHtml(activeFloorLabel || '')}" style="border: none; border-bottom: 1px dotted #999; width: 100%; font-size: 12px; font-weight: 600; padding: 1px 4px; outline: none; background: transparent; color: #000;" />
              `}
            </div>

            <!-- Row 2 Left: Servicing Date -->
            <div style="border-right: 1.5px solid #000000; padding: 4px 8px; display: flex; align-items: center; min-height: 24px;">
              <span style="font-weight: 800; font-size: 12px; margin-right: 6px; white-space: nowrap;">Servicing Date :</span>
              ${reportState.previewMode ? `
                <span style="font-weight: 700; font-size: 12px;">${formatDMY(reportState.servicingDate)}</span>
              ` : `
                <input type="text" id="pm-meta-input-date" class="pm-sheet-inline-input" placeholder="DD-MM-YYYY" value="${formatDMY(reportState.servicingDate)}" style="border: none; border-bottom: 1px dotted #999; width: 100%; font-size: 12px; font-weight: 600; padding: 1px 4px; outline: none; background: transparent; color: #000;" />
              `}
            </div>

            <!-- Row 2 Right: Next Servicing Date -->
            <div style="padding: 4px 8px; display: flex; align-items: center; min-height: 24px;">
              <span style="font-weight: 800; font-size: 12px; margin-right: 6px; white-space: nowrap;">Next Servicing Date :</span>
              ${reportState.previewMode ? `
                <span style="font-weight: 700; font-size: 12px;">${formatDMY(reportState.nextServicingDate)}</span>
              ` : `
                <input type="text" id="pm-meta-input-next-date" class="pm-sheet-inline-input" placeholder="DD-MM-YYYY" value="${formatDMY(reportState.nextServicingDate)}" style="border: none; border-bottom: 1px dotted #999; width: 100%; font-size: 12px; font-weight: 600; padding: 1px 4px; outline: none; background: transparent; color: #000;" />
              `}
            </div>
          </div>

          <!-- C. MAIN REPORT DATA TABLE (EXACT 10 COLUMNS SEQUENCE) -->
          <table class="pm-official-table" style="
            width: 100%; 
            border-collapse: collapse; 
            table-layout: fixed; 
            border: 1.5px solid #000000;
            font-size: 10px;
          ">
            <colgroup>
              <col style="width: 4%;" />    <!-- 1. Sl. No. -->
              <col style="width: 11%;" />   <!-- 2. M/C Name -->
              <col style="width: 10%;" />   <!-- 3. M/C Number -->
              <col style="width: 10%;" />   <!-- 4. M/C Model/Type -->
              <col style="width: 9%;" />    <!-- 5. Previous Servicing Date: -->
              <col style="width: 8%;" />    <!-- 6. Sticker Sl. No. -->
              <col style="width: 9%;" />    <!-- 7. Line or Section -->
              <col style="width: 23%;" />   <!-- 8. Work Summary (Wider Column) -->
              <col style="width: 8%;" />    <!-- 9. Servicer Name -->
              <col style="width: 8%;" />    <!-- 10. Signature -->
            </colgroup>

            <thead>
              <tr style="border-bottom: 1.5px solid #000000;">
                <th style="border: 1px solid #000000; padding: 5px 2px; text-align: center; vertical-align: middle; font-weight: 700; font-size: 9.5px; background: #fff; color: #000;">Sl.<br/>No.</th>
                <th style="border: 1px solid #000000; padding: 5px 4px; text-align: center; vertical-align: middle; font-weight: 700; font-size: 9.5px; background: #fff; color: #000;">M/C Name</th>
                <th style="border: 1px solid #000000; padding: 5px 4px; text-align: center; vertical-align: middle; font-weight: 700; font-size: 9.5px; background: #fff; color: #000;">M/C<br/>Number</th>
                <th style="border: 1px solid #000000; padding: 5px 4px; text-align: center; vertical-align: middle; font-weight: 700; font-size: 9.5px; background: #fff; color: #000;">M/C Model/Type</th>
                <th style="border: 1px solid #000000; padding: 5px 4px; text-align: center; vertical-align: middle; font-weight: 700; font-size: 9.5px; background: #fff; color: #000;">Previous<br/>Servicing<br/>Date:</th>
                <th style="border: 1px solid #000000; padding: 5px 4px; text-align: center; vertical-align: middle; font-weight: 700; font-size: 9.5px; background: #fff; color: #000;">Sticker Sl.<br/>No.</th>
                <th style="border: 1px solid #000000; padding: 5px 4px; text-align: center; vertical-align: middle; font-weight: 700; font-size: 9.5px; background: #fff; color: #000;">Line or<br/>Section</th>
                <th style="border: 1px solid #000000; padding: 5px 6px; text-align: center; vertical-align: middle; font-weight: 700; font-size: 9.5px; background: #fff; color: #000;">Work Summary</th>
                <th style="border: 1px solid #000000; padding: 5px 4px; text-align: center; vertical-align: middle; font-weight: 700; font-size: 9.5px; background: #fff; color: #000;">Servicer Name</th>
                <th style="border: 1px solid #000000; padding: 5px 4px; text-align: center; vertical-align: middle; font-weight: 700; font-size: 9.5px; background: #fff; color: #000;">Signature</th>
              </tr>
            </thead>

            <tbody>
              ${displayRows.map((row, index) => {
                const slFormatted = String(index + 1).padStart(2, '0');
                const isBlankRow = !row.machineNumber && !row.machineName && !row.workSummary;

                if (reportState.previewMode) {
                  // Clean Print / Preview Mode (No form controls)
                  return `
                    <tr style="min-height: 38px; height: 38px;">
                      <td style="border: 1px solid #000000; text-align: center; font-weight: 700; font-size: 10px; padding: 4px 2px; vertical-align: middle;">
                        ${slFormatted}
                      </td>
                      <td style="border: 1px solid #000000; text-align: left; padding: 4px 6px; vertical-align: middle; font-size: 9.5px; word-break: break-word;">
                        ${escapeHtml(row.machineName || '')}
                      </td>
                      <td style="border: 1px solid #000000; text-align: center; font-weight: 700; padding: 4px; vertical-align: middle; font-size: 10px; font-family: monospace;">
                        ${escapeHtml(row.machineNumber || '')}
                      </td>
                      <td style="border: 1px solid #000000; text-align: center; padding: 4px; vertical-align: middle; font-size: 9.5px; word-break: break-word;">
                        ${escapeHtml(row.machineModel || '')}
                      </td>
                      <td style="border: 1px solid #000000; text-align: center; padding: 4px; vertical-align: middle; font-size: 9.5px; white-space: nowrap;">
                        ${escapeHtml(row.previousServicingDate ? formatDMY(row.previousServicingDate) : '')}
                      </td>
                      <td style="border: 1px solid #000000; text-align: center; font-weight: 600; padding: 4px; vertical-align: middle; font-size: 9.5px; font-family: monospace;">
                        ${escapeHtml(row.stickerSerial || '')}
                      </td>
                      <td style="border: 1px solid #000000; text-align: center; padding: 4px; vertical-align: middle; font-size: 9.5px; word-break: break-word;">
                        ${escapeHtml(row.lineOrSection || '')}
                      </td>
                      <td style="border: 1px solid #000000; text-align: left; padding: 4px 6px; vertical-align: middle; font-size: 9.5px; line-height: 1.25; word-break: break-word;">
                        ${escapeHtml(row.workSummary || '')}
                      </td>
                      <td style="border: 1px solid #000000; text-align: center; padding: 4px; vertical-align: middle; font-size: 9.5px; word-break: break-word;">
                        ${escapeHtml(row.servicerName || '')}
                      </td>
                      <td style="border: 1px solid #000000; text-align: center; padding: 4px; vertical-align: middle; font-size: 9.5px;">
                        ${row.signature ? `<span style="font-family: cursive; font-size: 11px; color: #1e3a8a;">${escapeHtml(row.signature)}</span>` : ''}
                      </td>
                    </tr>
                  `;
                }

                // Interactive Edit Mode (Inputs with Live Auto-Fill and Helper Chips)
                return `
                  <tr data-row-id="${row.id}" data-row-idx="${index}" style="min-height: 42px; background: ${index % 2 === 0 ? '#ffffff' : '#fafafa'};">
                    <!-- 1. Sl. No. -->
                    <td style="border: 1px solid #000000; text-align: center; font-weight: 700; font-size: 10px; vertical-align: middle;">
                      ${slFormatted}
                    </td>

                    <!-- 2. M/C Name -->
                    <td style="border: 1px solid #000000; padding: 2px 3px; vertical-align: middle;">
                      <input 
                        type="text" 
                        class="pm-row-input pm-row-mach-name" 
                        data-field="machineName" 
                        value="${escapeHtml(row.machineName || '')}" 
                        placeholder="M/C Name"
                        style="width: 100%; border: none; font-size: 10px; background: transparent; padding: 2px; outline: none; color: #000;"
                      />
                    </td>

                    <!-- 3. M/C Number (Live Autocomplete trigger) -->
                    <td style="border: 1px solid #000000; padding: 2px 3px; vertical-align: middle; position: relative;">
                      <div style="display: flex; align-items: center; gap: 2px;">
                        <input 
                          type="text" 
                          class="pm-row-input pm-row-mach-num" 
                          data-field="machineNumber" 
                          value="${escapeHtml(row.machineNumber || '')}" 
                          placeholder="Type serial..."
                          title="Type machine number to search and auto-fill details"
                          style="width: 100%; border: none; font-size: 10px; font-weight: 700; font-family: monospace; background: transparent; padding: 2px; outline: none; color: #000;"
                        />
                        <button type="button" class="btn-pm-row-pick-mach no-print" data-row-idx="${index}" title="Pick machine from inventory" style="border: 1px solid #ccc; background: #eee; border-radius: 2px; font-size: 8px; padding: 1px 3px; cursor: pointer; color: #333;">🔍</button>
                      </div>
                    </td>

                    <!-- 4. M/C Model/Type -->
                    <td style="border: 1px solid #000000; padding: 2px 3px; vertical-align: middle;">
                      <input 
                        type="text" 
                        class="pm-row-input" 
                        data-field="machineModel" 
                        value="${escapeHtml(row.machineModel || '')}" 
                        placeholder="Model"
                        style="width: 100%; border: none; font-size: 9.5px; background: transparent; padding: 2px; outline: none; color: #000;"
                      />
                    </td>

                    <!-- 5. Previous Servicing Date: -->
                    <td style="border: 1px solid #000000; padding: 2px 3px; vertical-align: middle;">
                      <input 
                        type="text" 
                        class="pm-row-input" 
                        data-field="previousServicingDate" 
                        value="${escapeHtml(row.previousServicingDate ? formatDMY(row.previousServicingDate) : '')}" 
                        placeholder="DD-MM-YYYY"
                        title="Previous servicing date from history or manual"
                        style="width: 100%; border: none; font-size: 9.5px; text-align: center; background: transparent; padding: 2px; outline: none; color: #000;"
                      />
                    </td>

                    <!-- 6. Sticker Sl. No. -->
                    <td style="border: 1px solid #000000; padding: 2px 3px; vertical-align: middle;">
                      <input 
                        type="text" 
                        class="pm-row-input" 
                        data-field="stickerSerial" 
                        value="${escapeHtml(row.stickerSerial || '')}" 
                        placeholder="Sticker #"
                        style="width: 100%; border: none; font-size: 9.5px; font-family: monospace; font-weight: 600; text-align: center; background: transparent; padding: 2px; outline: none; color: #000;"
                      />
                    </td>

                    <!-- 7. Line or Section -->
                    <td style="border: 1px solid #000000; padding: 2px 3px; vertical-align: middle;">
                      <input 
                        type="text" 
                        class="pm-row-input" 
                        data-field="lineOrSection" 
                        value="${escapeHtml(row.lineOrSection || '')}" 
                        placeholder="Line"
                        style="width: 100%; border: none; font-size: 9.5px; text-align: center; background: transparent; padding: 2px; outline: none; color: #000;"
                      />
                    </td>

                    <!-- 8. Work Summary (Wide column with quick preset chip helper) -->
                    <td style="border: 1px solid #000000; padding: 2px 4px; vertical-align: middle; position: relative;">
                      <div style="display: flex; flex-direction: column; gap: 2px;">
                        <input 
                          type="text" 
                          class="pm-row-input pm-row-work-summary" 
                          data-field="workSummary" 
                          value="${escapeHtml(row.workSummary || '')}" 
                          placeholder="Maintenance work summary..."
                          style="width: 100%; border: none; font-size: 9.5px; background: transparent; padding: 2px; outline: none; color: #000;"
                        />
                        <div class="no-print" style="display: flex; gap: 3px; flex-wrap: wrap;">
                          <button type="button" class="btn-quick-work-chip" data-row-idx="${index}" data-text="Cleaning &amp; Oiling" style="font-size: 8px; background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; border-radius: 2px; padding: 0 3px; cursor: pointer;">+ Clean/Oil</button>
                          <button type="button" class="btn-quick-work-chip" data-row-idx="${index}" data-text="Timing Adjustment" style="font-size: 8px; background: #fef3c7; color: #b45309; border: 1px solid #fde68a; border-radius: 2px; padding: 0 3px; cursor: pointer;">+ Timing</button>
                          <button type="button" class="btn-quick-work-chip" data-row-idx="${index}" data-text="Needle Bar Check" style="font-size: 8px; background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; border-radius: 2px; padding: 0 3px; cursor: pointer;">+ Needle</button>
                          <button type="button" class="btn-quick-work-chip" data-row-idx="${index}" data-text="Belt Tension &amp; Motor Inspection" style="font-size: 8px; background: #f3e8ff; color: #7e22ce; border: 1px solid #e9d5ff; border-radius: 2px; padding: 0 3px; cursor: pointer;">+ Belt/Motor</button>
                        </div>
                      </div>
                    </td>

                    <!-- 9. Servicer Name -->
                    <td style="border: 1px solid #000000; padding: 2px 3px; vertical-align: middle;">
                      <input 
                        type="text" 
                        class="pm-row-input" 
                        data-field="servicerName" 
                        value="${escapeHtml(row.servicerName || '')}" 
                        placeholder="Technician"
                        style="width: 100%; border: none; font-size: 9.5px; text-align: center; background: transparent; padding: 2px; outline: none; color: #000;"
                      />
                    </td>

                    <!-- 10. Signature & Delete Row Action -->
                    <td style="border: 1px solid #000000; padding: 2px 3px; vertical-align: middle; text-align: center;">
                      <div style="display: flex; align-items: center; justify-content: center; gap: 4px;">
                        <input 
                          type="text" 
                          class="pm-row-input" 
                          data-field="signature" 
                          value="${escapeHtml(row.signature || '')}" 
                          placeholder="Sign"
                          style="width: 45px; border: none; font-size: 9px; font-family: cursive; text-align: center; background: transparent; padding: 2px; outline: none; color: #000;"
                        />
                        <button type="button" class="btn-pm-del-row no-print" data-row-idx="${index}" title="Remove this row" style="border: none; background: transparent; color: #ef4444; font-size: 11px; cursor: pointer; padding: 0 2px;">✕</button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <!-- D. FOUR APPROVAL SIGNATURE POSITIONS (Bottom of Official Sheet) -->
          <div class="pm-official-signatures" style="
            display: flex; 
            justify-content: space-between; 
            align-items: flex-end; 
            margin-top: 45px; 
            width: 100%;
            page-break-inside: avoid;
            break-inside: avoid;
          ">
            
            <!-- 1. Engineer -->
            <div style="width: 20%; text-align: center;">
              <div style="min-height: 38px; display: flex; align-items: center; justify-content: center;">
                <span class="digital-sign-placeholder" style="font-family: cursive; font-size: 13px; color: #1e3a8a;"></span>
              </div>
              <div style="border-top: 1.5px solid #000000; padding-top: 4px; font-weight: 800; font-size: 11px; color: #000000;">
                Engineer
              </div>
            </div>

            <!-- 2. Manager -->
            <div style="width: 20%; text-align: center;">
              <div style="min-height: 38px; display: flex; align-items: center; justify-content: center;">
                <span class="digital-sign-placeholder" style="font-family: cursive; font-size: 13px; color: #1e3a8a;"></span>
              </div>
              <div style="border-top: 1.5px solid #000000; padding-top: 4px; font-weight: 800; font-size: 11px; color: #000000;">
                Manager
              </div>
            </div>

            <!-- 3. Sr. Manager / AGM -->
            <div style="width: 20%; text-align: center;">
              <div style="min-height: 38px; display: flex; align-items: center; justify-content: center;">
                <span class="digital-sign-placeholder" style="font-family: cursive; font-size: 13px; color: #1e3a8a;"></span>
              </div>
              <div style="border-top: 1.5px solid #000000; padding-top: 4px; font-weight: 800; font-size: 11px; color: #000000;">
                Sr. Manager/AGM
              </div>
            </div>

            <!-- 4. General Manager -->
            <div style="width: 20%; text-align: center;">
              <div style="min-height: 38px; display: flex; align-items: center; justify-content: center;">
                <span class="digital-sign-placeholder" style="font-family: cursive; font-size: 13px; color: #1e3a8a;"></span>
              </div>
              <div style="border-top: 1.5px solid #000000; padding-top: 4px; font-weight: 800; font-size: 11px; color: #000000;">
                General Manager
              </div>
            </div>

          </div>

          <!-- Bottom Footer Note for Official Print -->
          <div style="margin-top: 18px; display: flex; justify-content: space-between; align-items: center; font-size: 8.5px; color: #555555; border-top: 1px dotted #cccccc; padding-top: 3px;">
            <span>Form Ref: AM-MNT-PMM-01 (A4 Landscape)</span>
            <span>Generated from Al-Muslim Central Maintenance Department ERP System</span>
            <span>Page 1 of 1</span>
          </div>

        </div>

      </div>

      <!-- MACHINE SELECTOR MODAL (FOR ROW AUTOCOMPLETE) -->
      <div id="pm-rep-mach-picker-modal" class="modal-overlay" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 9999; align-items: center; justify-content: center; padding: 20px;">
        <div style="background: var(--bg-surface, #1e293b); border: 1px solid var(--border-color, #334155); border-radius: 8px; width: 680px; max-width: 95%; max-height: 85vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5);">
          <div style="padding: 12px 16px; border-bottom: 1px solid var(--border-color, #334155); display: flex; justify-content: space-between; align-items: center;">
            <h3 style="margin: 0; font-size: 14px; font-weight: 700; color: #fff;">🔍 Select Machine from Inventory</h3>
            <button id="btn-pm-close-mach-picker" style="background: none; border: none; color: #94a3b8; font-size: 16px; cursor: pointer;">✕</button>
          </div>
          <div style="padding: 10px 16px; border-bottom: 1px solid var(--border-color, #334155); background: rgba(0,0,0,0.15);">
            <input type="text" id="pm-picker-search-input" placeholder="Search by machine number, name, brand, line..." style="width: 100%; height: 32px; font-size: 12px; padding: 0 10px; border-radius: 4px; border: 1px solid #475569; background: #0f172a; color: #fff;" />
          </div>
          <div id="pm-picker-mach-list" style="flex: 1; overflow-y: auto; padding: 8px 16px; max-height: 400px; display: flex; flex-direction: column; gap: 4px;">
            <!-- Populated dynamically -->
          </div>
        </div>
      </div>

    </div>
  `;
}

/**
 * Initialize all event listeners for the Preventive Machine Maintenance Report Module
 */
export function initPreventiveMaintenanceReportEvents(container = document) {
  const root = container.querySelector('.pm-report-module-wrapper') || container;
  if (!root) return;

  let activePickerRowIdx = null;

  // 1. Unit Selector Change
  const unitSelect = root.querySelector('#pm-rep-filter-unit');
  if (unitSelect) {
    unitSelect.addEventListener('change', (e) => {
      reportState.unitId = e.target.value;
      const opt = e.target.options[e.target.selectedIndex];
      reportState.unitName = reportState.unitId === 'ALL' ? '' : (opt?.text || '');
      // Update floor dropdown if available
      rerenderReport();
    });
  }

  // 2. Floor Selector Change
  const floorSelect = root.querySelector('#pm-rep-filter-floor');
  if (floorSelect) {
    floorSelect.addEventListener('change', (e) => {
      reportState.floorId = e.target.value;
      const opt = e.target.options[e.target.selectedIndex];
      reportState.floorName = reportState.floorId === 'ALL' ? '' : (opt?.text || '');
      rerenderReport();
    });
  }

  // 3. Line Selector Change
  const lineSelect = root.querySelector('#pm-rep-filter-line');
  if (lineSelect) {
    lineSelect.addEventListener('change', (e) => {
      reportState.lineId = e.target.value;
      const opt = e.target.options[e.target.selectedIndex];
      reportState.lineName = reportState.lineId === 'ALL' ? '' : (opt?.text || '');
      rerenderReport();
    });
  }

  // 4. Servicing Date & Next Servicing Date
  const sDateInput = root.querySelector('#pm-rep-servicing-date');
  if (sDateInput) {
    sDateInput.addEventListener('change', (e) => {
      reportState.servicingDate = e.target.value;
      reportState.nextServicingDate = computeNextDate(reportState.servicingDate, 90);
      const nextInput = root.querySelector('#pm-rep-next-servicing-date');
      if (nextInput) nextInput.value = reportState.nextServicingDate;
      const metaDate = root.querySelector('#pm-meta-input-date');
      if (metaDate) metaDate.value = formatDMY(reportState.servicingDate);
      const metaNext = root.querySelector('#pm-meta-input-next-date');
      if (metaNext) metaNext.value = formatDMY(reportState.nextServicingDate);
    });
  }

  const nDateInput = root.querySelector('#pm-rep-next-servicing-date');
  if (nDateInput) {
    nDateInput.addEventListener('change', (e) => {
      reportState.nextServicingDate = e.target.value;
      const metaNext = root.querySelector('#pm-meta-input-next-date');
      if (metaNext) metaNext.value = formatDMY(reportState.nextServicingDate);
    });
  }

  // Inline Meta Inputs (Header Box)
  const metaUnit = root.querySelector('#pm-meta-input-unit');
  if (metaUnit) {
    metaUnit.addEventListener('input', (e) => {
      reportState.unitName = e.target.value;
    });
  }
  const metaFloor = root.querySelector('#pm-meta-input-floor');
  if (metaFloor) {
    metaFloor.addEventListener('input', (e) => {
      reportState.floorName = e.target.value;
    });
  }
  const metaDate = root.querySelector('#pm-meta-input-date');
  if (metaDate) {
    metaDate.addEventListener('change', (e) => {
      reportState.servicingDate = e.target.value;
    });
  }
  const metaNext = root.querySelector('#pm-meta-input-next-date');
  if (metaNext) {
    metaNext.addEventListener('change', (e) => {
      reportState.nextServicingDate = e.target.value;
    });
  }

  // 5. Toggle Preview Mode / Edit Mode
  const togglePreviewBtn = root.querySelector('#btn-pm-report-toggle-preview');
  if (togglePreviewBtn) {
    togglePreviewBtn.addEventListener('click', () => {
      reportState.previewMode = !reportState.previewMode;
      rerenderReport();
    });
  }

  // 6. Direct Print Report (window.print)
  const printDirectBtn = root.querySelector('#btn-pm-report-print-direct');
  if (printDirectBtn) {
    printDirectBtn.addEventListener('click', () => {
      triggerOfficialPrint();
    });
  }

  // 7. Export PDF
  const exportPdfBtn = root.querySelector('#btn-pm-report-export-pdf');
  if (exportPdfBtn) {
    exportPdfBtn.addEventListener('click', () => {
      triggerOfficialPrint();
    });
  }

  // 8. Export Excel (.xlsx)
  const exportExcelBtn = root.querySelector('#btn-pm-report-export-excel');
  if (exportExcelBtn) {
    exportExcelBtn.addEventListener('click', () => {
      exportReportToExcel();
    });
  }

  // 9. Export CSV
  const exportCsvBtn = root.querySelector('#btn-pm-report-export-csv');
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      exportReportToCsv();
    });
  }

  // 10. Save Maintenance Record
  const saveRecordBtn = root.querySelector('#btn-pm-report-save-record');
  if (saveRecordBtn) {
    saveRecordBtn.addEventListener('click', async () => {
      await saveMaintenanceRecordsFromReport();
    });
  }

  // 11. Auto-Load Machines from Filter
  const autoLoadBtn = root.querySelector('#btn-pm-rep-autoload');
  if (autoLoadBtn) {
    autoLoadBtn.addEventListener('click', () => {
      loadMachinesByFilter();
    });
  }

  // 12. Load Due Machines
  const loadDueBtn = root.querySelector('#btn-pm-rep-load-due');
  if (loadDueBtn) {
    loadDueBtn.addEventListener('click', () => {
      loadDueOrOverdueMachines();
    });
  }

  // 13. Add Row
  const addRowBtn = root.querySelector('#btn-pm-rep-add-row');
  if (addRowBtn) {
    addRowBtn.addEventListener('click', () => {
      const nextSl = reportState.rows.length + 1;
      reportState.rows.push({
        id: `row-${Date.now()}-${nextSl}`,
        slNo: String(nextSl).padStart(2, '0'),
        machineId: '',
        machineName: '',
        machineNumber: '',
        machineModel: '',
        previousServicingDate: '',
        stickerSerial: '',
        lineOrSection: reportState.lineName || '',
        workSummary: '',
        servicerName: reportState.defaultServicer || '',
        signature: ''
      });
      rerenderReport();
    });
  }

  // 14. Reset to Blank 10-Row Form
  const printBlankBtn = root.querySelector('#btn-pm-rep-print-blank');
  if (printBlankBtn) {
    printBlankBtn.addEventListener('click', () => {
      if (confirm('Reset to a blank official 10-row sheet for hand-written factory logging?')) {
        reportState.rows = getInitialRows();
        reportState.previewMode = true; // immediately show print-ready preview
        rerenderReport();
      }
    });
  }

  // 15. Clear / Reset Table
  const clearBtn = root.querySelector('#btn-pm-rep-clear-table');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (confirm('Clear all loaded rows and reset table?')) {
        reportState.rows = getInitialRows();
        rerenderReport();
      }
    });
  }

  // 16. In-Table Cell Input Changes
  root.querySelectorAll('.pm-row-input').forEach(input => {
    input.addEventListener('input', (e) => {
      const tr = e.target.closest('tr');
      if (!tr) return;
      const rowIdx = parseInt(tr.getAttribute('data-row-idx'), 10);
      const field = e.target.getAttribute('data-field');
      if (reportState.rows[rowIdx] && field) {
        reportState.rows[rowIdx][field] = e.target.value;
      }
    });

    // Auto-search when typing machine number
    if (input.classList.contains('pm-row-mach-num')) {
      input.addEventListener('change', (e) => {
        const tr = e.target.closest('tr');
        if (!tr) return;
        const rowIdx = parseInt(tr.getAttribute('data-row-idx'), 10);
        const query = e.target.value?.trim();
        if (query) {
          autoFillMachineInRow(rowIdx, query);
        }
      });
    }
  });

  // 17. Delete Row Button
  root.querySelectorAll('.btn-pm-del-row').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const rowIdx = parseInt(e.target.getAttribute('data-row-idx'), 10);
      if (!isNaN(rowIdx) && reportState.rows[rowIdx]) {
        reportState.rows.splice(rowIdx, 1);
        // renumber
        reportState.rows.forEach((r, i) => {
          r.slNo = String(i + 1).padStart(2, '0');
        });
        rerenderReport();
      }
    });
  });

  // 18. Quick Work Summary Chip
  root.querySelectorAll('.btn-quick-work-chip').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const rowIdx = parseInt(e.target.getAttribute('data-row-idx'), 10);
      const textToAppend = e.target.getAttribute('data-text');
      if (!isNaN(rowIdx) && reportState.rows[rowIdx] && textToAppend) {
        const current = reportState.rows[rowIdx].workSummary || '';
        reportState.rows[rowIdx].workSummary = current ? `${current}, ${textToAppend}` : textToAppend;
        const input = root.querySelector(`tr[data-row-idx="${rowIdx}"] .pm-row-work-summary`);
        if (input) input.value = reportState.rows[rowIdx].workSummary;
      }
    });
  });

  // 19. Machine Picker Modal Trigger
  root.querySelectorAll('.btn-pm-row-pick-mach').forEach(btn => {
    btn.addEventListener('click', (e) => {
      activePickerRowIdx = parseInt(e.target.getAttribute('data-row-idx'), 10);
      openMachinePickerModal();
    });
  });

  // Machine Picker Modal Internal Logic
  const pickerModal = root.querySelector('#pm-rep-mach-picker-modal');
  const pickerCloseBtn = root.querySelector('#btn-pm-close-mach-picker');
  const pickerSearchInput = root.querySelector('#pm-picker-search-input');
  const pickerListContainer = root.querySelector('#pm-picker-mach-list');

  function openMachinePickerModal() {
    if (!pickerModal) return;
    pickerModal.style.display = 'flex';
    if (pickerSearchInput) {
      pickerSearchInput.value = '';
      pickerSearchInput.focus();
    }
    renderPickerList('');
  }

  function closeMachinePickerModal() {
    if (pickerModal) pickerModal.style.display = 'none';
    activePickerRowIdx = null;
  }

  if (pickerCloseBtn) {
    pickerCloseBtn.addEventListener('click', closeMachinePickerModal);
  }
  if (pickerModal) {
    pickerModal.addEventListener('click', (e) => {
      if (e.target === pickerModal) closeMachinePickerModal();
    });
  }

  if (pickerSearchInput) {
    pickerSearchInput.addEventListener('input', (e) => {
      renderPickerList(e.target.value);
    });
  }

  function renderPickerList(searchStr = '') {
    if (!pickerListContainer) return;
    const all = preventiveMaintenanceService.getAllMachinesWithMaintenance ? 
      preventiveMaintenanceService.getAllMachinesWithMaintenance({
        floorId: reportState.floorId,
        lineId: reportState.lineId,
        search: searchStr
      }) : [];

    if (all.length === 0) {
      pickerListContainer.innerHTML = `
        <div style="text-align: center; padding: 20px; color: #94a3b8; font-size: 12px;">
          No machines found matching "${escapeHtml(searchStr)}".
        </div>
      `;
      return;
    }

    pickerListContainer.innerHTML = all.slice(0, 50).map(m => `
      <div class="pm-picker-item" data-mach-id="${m.machineId}" data-mach-serial="${escapeHtml(m.serialNumber)}" style="
        display: flex; 
        align-items: center; 
        justify-content: space-between; 
        padding: 8px 10px; 
        background: #0f172a; 
        border: 1px solid #334155; 
        border-radius: 4px; 
        cursor: pointer;
        transition: background 0.15s;
      ">
        <div style="display: flex; flex-direction: column; gap: 2px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <strong style="color: #38bdf8; font-family: monospace; font-size: 13px;">${escapeHtml(m.serialNumber)}</strong>
            <span style="font-weight: 600; font-size: 12px; color: #fff;">${escapeHtml(m.machineName)}</span>
          </div>
          <div style="font-size: 10.5px; color: #94a3b8;">
            Model: <span style="color: #cbd5e1;">${escapeHtml(m.model || '—')}</span> | 
            Location: <span style="color: #cbd5e1;">${escapeHtml(m.floor || '')} - ${escapeHtml(m.line || '')}</span>
          </div>
        </div>
        <div style="text-align: right; font-size: 10.5px;">
          <div style="color: #a78bfa;">Prev: ${m.lastServiceDate ? formatDMY(m.lastServiceDate) : 'Never'}</div>
          <button type="button" class="btn btn-primary btn-xs" style="padding: 1px 6px; font-size: 10px; margin-top: 2px;">Select</button>
        </div>
      </div>
    `).join('');

    pickerListContainer.querySelectorAll('.pm-picker-item').forEach(el => {
      el.addEventListener('click', () => {
        const machSerial = el.getAttribute('data-mach-serial');
        if (activePickerRowIdx !== null && machSerial) {
          autoFillMachineInRow(activePickerRowIdx, machSerial);
          closeMachinePickerModal();
        }
      });
    });
  }

  /**
   * Auto-Fills machine details in a specific row given machine serial or ID
   */
  function autoFillMachineInRow(rowIdx, queryStr) {
    if (isNaN(rowIdx) || !reportState.rows[rowIdx]) return;
    const profile = preventiveMaintenanceService.getMachinePreventiveProfile ? 
      preventiveMaintenanceService.getMachinePreventiveProfile(queryStr) : null;

    if (profile) {
      const nextSticker = profile.serviceStickerSerial && profile.serviceStickerSerial !== 'STK-PENDING' 
        ? profile.serviceStickerSerial 
        : (preventiveMaintenanceService.getNextServiceStickerSerial ? preventiveMaintenanceService.getNextServiceStickerSerial() : '245232');

      reportState.rows[rowIdx].machineId = profile.machineId || '';
      reportState.rows[rowIdx].machineNumber = profile.serialNumber || queryStr;
      reportState.rows[rowIdx].machineName = profile.machineName || '';
      reportState.rows[rowIdx].machineModel = profile.model || profile.brand || '';
      reportState.rows[rowIdx].lineOrSection = profile.line || '';
      reportState.rows[rowIdx].previousServicingDate = profile.lastServiceDate || '';
      reportState.rows[rowIdx].stickerSerial = nextSticker;
      reportState.rows[rowIdx].servicerName = reportState.rows[rowIdx].servicerName || profile.assignedManpower || profile.lastServicedBy || reportState.defaultServicer || '';
      reportState.rows[rowIdx].workSummary = reportState.rows[rowIdx].workSummary || 'Full servicing, oiling, loop timing & needle alignment';
      reportState.rows[rowIdx].isAutoFilled = true;

      rerenderReport();
    } else {
      // Manual entry accepted per requirement
      reportState.rows[rowIdx].machineNumber = queryStr;
    }
  }

  /**
   * Loads machines matching current active filter (Unit, Floor, Line)
   */
  function loadMachinesByFilter() {
    const filters = {};
    if (reportState.floorId && reportState.floorId !== 'ALL') filters.floorId = reportState.floorId;
    if (reportState.lineId && reportState.lineId !== 'ALL') filters.lineId = reportState.lineId;

    const list = preventiveMaintenanceService.getAllMachinesWithMaintenance ? 
      preventiveMaintenanceService.getAllMachinesWithMaintenance(filters) : [];

    if (list.length === 0) {
      alert('No machines found in the selected filter.');
      return;
    }

    const loadedRows = list.slice(0, 30).map((m, i) => {
      const nextStk = m.serviceStickerSerial && m.serviceStickerSerial !== 'STK-PENDING' 
        ? m.serviceStickerSerial 
        : String(245230 + i + 1);

      return {
        id: `row-${Date.now()}-${i + 1}`,
        slNo: String(i + 1).padStart(2, '0'),
        machineId: m.machineId || '',
        machineName: m.machineName || '',
        machineNumber: m.serialNumber || '',
        machineModel: m.model || m.brand || '',
        previousServicingDate: m.lastServiceDate || '',
        stickerSerial: nextStk,
        lineOrSection: m.line || '',
        workSummary: 'Routine maintenance servicing, oiling & inspection',
        servicerName: m.assignedManpower || m.lastServicedBy || reportState.defaultServicer || '',
        servicerCard: '',
        signature: ''
      };
    });

    reportState.rows = loadedRows;
    rerenderReport();
    notificationService.showToast ? notificationService.showToast(`Loaded ${loadedRows.length} machines into maintenance report`, 'success') : null;
  }

  /**
   * Loads machines that are Due Today or Overdue
   */
  function loadDueOrOverdueMachines() {
    const list = preventiveMaintenanceService.getUpcomingMaintenance ? 
      preventiveMaintenanceService.getUpcomingMaintenance({
        floorId: reportState.floorId,
        lineId: reportState.lineId
      }) : [];

    const dueList = list.filter(m => m.urgency?.status === 'OVERDUE' || m.urgency?.status === 'DUE_TODAY' || m.urgency?.status === 'DUE_SOON');

    if (dueList.length === 0) {
      alert('No overdue or upcoming maintenance machines found in the current scope.');
      return;
    }

    reportState.rows = dueList.slice(0, 20).map((m, i) => ({
      id: `row-${Date.now()}-${i + 1}`,
      slNo: String(i + 1).padStart(2, '0'),
      machineId: m.machineId || '',
      machineName: m.machineName || '',
      machineNumber: m.serialNumber || '',
      machineModel: m.model || m.brand || '',
      previousServicingDate: m.lastServiceDate || '',
      stickerSerial: m.serviceStickerSerial && m.serviceStickerSerial !== 'STK-PENDING' ? m.serviceStickerSerial : String(245240 + i + 1),
      lineOrSection: m.line || '',
      workSummary: `Urgent preventive servicing (${m.urgency?.displayBadge ? m.urgency.status : 'Due'})`,
      servicerName: m.assignedManpower || m.lastServicedBy || reportState.defaultServicer || '',
      signature: ''
    }));

    rerenderReport();
  }

  /**
   * Helper to Re-render this view dynamically
   */
  function rerenderReport() {
    const containerEl = document.querySelector('.pm-report-module-wrapper');
    if (containerEl && containerEl.parentElement) {
      const parent = containerEl.parentElement;
      parent.innerHTML = renderPreventiveMaintenanceReportView();
      initPreventiveMaintenanceReportEvents(parent);
    }
  }

  /**
   * Direct Official Print Function
   */
  function triggerOfficialPrint() {
    const sheetEl = document.querySelector('.pm-official-sheet');
    if (!sheetEl) {
      window.print();
      return;
    }

    // Build standalone clean printable HTML document for 100% faithful print/PDF rendering
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Preventive_Machine_Maintenance_Report_${reportState.servicingDate || 'Al-Muslim'}</title>
        <meta charset="utf-8">
        <style>
          @page {
            size: A4 landscape;
            margin: 6mm 8mm 6mm 8mm;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            font-family: 'Segoe UI', Arial, Helvetica, sans-serif;
            background: #ffffff;
            color: #000000;
            margin: 0;
            padding: 0;
            font-size: 11px;
          }
          .pm-official-sheet {
            width: 100%;
            padding: 0;
            background: #fff;
          }
          table {
            border-collapse: collapse;
            width: 100%;
          }
          thead {
            display: table-header-group;
          }
          tr {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .no-print {
            display: none !important;
          }
        </style>
      </head>
      <body>
        <div style="padding: 4px 6px;">
          ${sheetEl.outerHTML}
        </div>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.focus();
              window.print();
            }, 250);
          };
        </script>
      </body>
      </html>
    `;

    const printWin = window.open('', '_blank');
    if (printWin) {
      try {
        printWin.document.open();
        printWin.document.write(html);
        printWin.document.close();
      } catch (_) {
        window.print();
      }
    } else {
      window.print();
    }

    auditService.log('PRINT_PREVENTIVE_REPORT', 'PREVENTIVE_MAINTENANCE', 'REPORT', `Printed official Preventive Machine Maintenance Report (${reportState.rows.length} rows)`);
  }

  /**
   * Export to Excel (.xlsx) matching exact columns & header
   */
  function exportReportToExcel() {
    if (typeof window.XLSX === 'undefined') {
      alert('Excel export library is loading. Please try again in a few moments.');
      return;
    }

    const rowsToExport = reportState.rows.filter(r => (r.machineNumber && r.machineNumber.trim()) || (r.machineName && r.machineName.trim()));
    if (rowsToExport.length === 0) {
      alert('No filled machine records to export. Please add or load machines first.');
      return;
    }

    const aoa = [
      ['AL-MUSLIM GROUP'],
      ['MAINTENANCE DEPARTMENT'],
      ['PREVENTIVE MACHINE MAINTENANCE REPORT'],
      [],
      [
        `Unit: ${reportState.unitName || 'All Units'}`,
        '',
        `Floor/Area: ${reportState.floorName || 'All Floors'}`,
        '',
        `Servicing Date: ${formatDMY(reportState.servicingDate)}`,
        '',
        `Next Servicing Date: ${formatDMY(reportState.nextServicingDate)}`
      ],
      [],
      [
        'Sl. No.',
        'M/C Name',
        'M/C Number',
        'M/C Model/Type',
        'Previous Servicing Date',
        'Sticker Sl. No.',
        'Line or Section',
        'Work Summary',
        'Servicer Name',
        'Signature'
      ]
    ];

    rowsToExport.forEach((r, idx) => {
      aoa.push([
        String(idx + 1).padStart(2, '0'),
        r.machineName || '',
        r.machineNumber || '',
        r.machineModel || '',
        r.previousServicingDate ? formatDMY(r.previousServicingDate) : '',
        r.stickerSerial || '',
        r.lineOrSection || '',
        r.workSummary || '',
        r.servicerName || '',
        r.signature || ''
      ]);
    });

    // Signatures footer rows
    aoa.push([]);
    aoa.push([]);
    aoa.push([
      'Engineer',
      '',
      'Manager',
      '',
      'Sr. Manager/AGM',
      '',
      'General Manager'
    ]);

    const wb = window.XLSX.utils.book_new();
    const ws = window.XLSX.utils.aoa_to_sheet(aoa);

    // Set Column Widths
    ws['!cols'] = [
      { wch: 8 },  // Sl. No.
      { wch: 26 }, // M/C Name
      { wch: 16 }, // M/C Number
      { wch: 18 }, // M/C Model/Type
      { wch: 16 }, // Previous Servicing Date
      { wch: 16 }, // Sticker Sl. No.
      { wch: 18 }, // Line or Section
      { wch: 38 }, // Work Summary
      { wch: 20 }, // Servicer Name
      { wch: 16 }  // Signature
    ];

    window.XLSX.utils.book_append_sheet(wb, ws, 'Preventive Maintenance');
    const fileName = `Preventive_Machine_Maintenance_${reportState.servicingDate || 'Report'}.xlsx`;
    window.XLSX.writeFile(wb, fileName);

    auditService.log('EXPORT_PREVENTIVE_REPORT_EXCEL', 'PREVENTIVE_MAINTENANCE', fileName, `Exported ${rowsToExport.length} records to Excel.`);
  }

  /**
   * Export to CSV (.csv) matching exact columns
   */
  function exportReportToCsv() {
    const rowsToExport = reportState.rows.filter(r => (r.machineNumber && r.machineNumber.trim()) || (r.machineName && r.machineName.trim()));
    if (rowsToExport.length === 0) {
      alert('No filled machine records to export. Please add or load machines first.');
      return;
    }

    const headers = [
      'Sl. No.',
      'M/C Name',
      'M/C Number',
      'M/C Model/Type',
      'Previous Servicing Date',
      'Sticker Sl. No.',
      'Line or Section',
      'Work Summary',
      'Servicer Name',
      'Signature'
    ];

    const csvRows = [];
    csvRows.push(['AL-MUSLIM GROUP - MAINTENANCE DEPARTMENT - PREVENTIVE MACHINE MAINTENANCE']);
    csvRows.push([`Unit: ${reportState.unitName || 'All'}`, `Floor: ${reportState.floorName || 'All'}`, `Servicing Date: ${formatDMY(reportState.servicingDate)}`, `Next Servicing Date: ${formatDMY(reportState.nextServicingDate)}`]);
    csvRows.push([]);
    csvRows.push(headers);

    rowsToExport.forEach((r, idx) => {
      csvRows.push([
        String(idx + 1).padStart(2, '0'),
        r.machineName || '',
        r.machineNumber || '',
        r.machineModel || '',
        r.previousServicingDate ? formatDMY(r.previousServicingDate) : '',
        r.stickerSerial || '',
        r.lineOrSection || '',
        r.workSummary || '',
        r.servicerName || '',
        r.signature || ''
      ]);
    });

    const csvContent = '\uFEFF' + csvRows.map(row => 
      row.map(field => `"${String(field || '').replace(/"/g, '""')}"`).join(',')
    ).join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Preventive_Machine_Maintenance_${reportState.servicingDate || 'Report'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    auditService.log('EXPORT_PREVENTIVE_REPORT_CSV', 'PREVENTIVE_MAINTENANCE', 'CSV', `Exported ${rowsToExport.length} records to CSV.`);
  }

  /**
   * Saves filled maintenance records directly to database & synchronizes lifetime machine history
   */
  async function saveMaintenanceRecordsFromReport() {
    const validRows = reportState.rows.filter(r => r.machineNumber && r.machineNumber.trim());
    if (validRows.length === 0) {
      alert('⚠️ No valid machine entries found to save. Please enter or pick at least one machine.');
      return;
    }

    // Validation Check: ensure required fields are present
    const missingFields = [];
    validRows.forEach((r, i) => {
      const rowNum = i + 1;
      if (!r.stickerSerial || !r.stickerSerial.trim()) {
        missingFields.push(`Row ${rowNum} (${r.machineNumber}): Physical Sticker Sl. No. is required.`);
      }
      if (!r.servicerName || !r.servicerName.trim()) {
        missingFields.push(`Row ${rowNum} (${r.machineNumber}): Servicer Name is required.`);
      }
    });

    if (missingFields.length > 0) {
      alert(`⚠️ Please correct the following before saving:\n\n${missingFields.slice(0, 5).join('\n')}${missingFields.length > 5 ? `\n...and ${missingFields.length - 5} more` : ''}`);
      return;
    }

    const serviceDate = reportState.servicingDate || new Date().toISOString().split('T')[0];
    const nextServiceDate = reportState.nextServicingDate || computeNextDate(serviceDate, 90);

    // Duplicate Check: Check if any record was already saved on this service date
    const existingPmRecords = storage.getTable(TABLE_NAMES.PREVENTIVE_MAINTENANCE) || [];
    const duplicates = validRows.filter(r => {
      return existingPmRecords.some(ep => 
        (ep.serialNumber && ep.serialNumber.trim().toUpperCase() === r.machineNumber.trim().toUpperCase()) &&
        (ep.serviceDate === serviceDate)
      );
    });

    if (duplicates.length > 0) {
      const proceed = confirm(`⚠️ Notice: ${duplicates.length} machine(s) already have a recorded servicing entry for ${serviceDate}:\n\n${duplicates.slice(0, 3).map(d => `• ${d.machineNumber}`).join('\n')}\n\nDo you want to proceed and save?`);
      if (!proceed) return;
    }

    try {
      let savedCount = 0;
      const user = authService.getCurrentUser();

      for (const row of validRows) {
        // Use service to create entry with complete validation & history record
        try {
          await preventiveMaintenanceService.createServiceEntry({
            serialNumber: row.machineNumber,
            machineId: row.machineId || null,
            serviceDate,
            serviceStickerSerial: row.stickerSerial.trim(),
            servicedBy: row.servicerName.trim(),
            serviceRemarks: row.workSummary || 'Routine preventive maintenance',
            serviceType: 'PREVENTIVE_SERVICE'
          });
          row.isExistingSaved = true;
          savedCount++;
        } catch (subErr) {
          console.warn(`Error saving row for machine ${row.machineNumber}:`, subErr);
        }
      }

      alert(`✅ Success: Successfully saved ${savedCount} preventive maintenance records to the database and updated machine history!`);
      
      // Notify ERP components
      window.dispatchEvent(new CustomEvent('erp:preventive-maintenance-updated'));
      rerenderReport();

    } catch (err) {
      console.error('Save report error:', err);
      alert(`❌ Error saving records: ${err.message || 'Storage error'}`);
    }
  }

}
