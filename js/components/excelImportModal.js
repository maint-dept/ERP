/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Multi-Worksheet Excel Import Wizard with Automatic Sheet Detection,
 * Cross-Sheet Validation, Error Report Exporter & Create/Update Bulk Engine
 */

import { excelService } from '../services/excelService.js';
import { customFieldService } from '../services/customFieldService.js';
import { DUPLICATE_POLICIES } from '../db/schema.js';
import { authService } from '../services/authService.js';
import { smartStorageService } from '../services/smartStorageService.js?v=4.22.19';
import { state } from '../state.js';

let importState = {
  stage: 1, // 1: Upload, 2: Sheets & Mapping, 3: Master Data Resolver, 4: Pre-Import Preview & Errors, 5: Result Summary
  fileName: '',
  workbookData: null, // { fileName, sheetNames, sheets, totalRows }
  activeSheetTab: '', // Active worksheet in Stage 2 & 4
  sheetMappings: {}, // { [sheetName]: { [sysField]: colName } }
  duplicatePolicy: DUPLICATE_POLICIES.UPDATE_EXISTING,
  unknownResolutions: {},
  validationResult: null,
  importResult: null,
  errorSearchFilter: ''
};

export function renderExcelImportModal() {
  return `
    <div class="modal-overlay" id="modal-import-excel-overlay">
      <div class="modal-dialog modal-dialog-xl" style="max-width: 1050px;">
        <div class="modal-header" style="background: var(--bg-card); border-bottom: 1px solid var(--border-color); padding: 16px 22px;">
          <div class="modal-title" style="display: flex; align-items: center; gap: 10px;">
            <span>📥 Multi-Worksheet Excel Machine Import Engine</span>
            <span style="font-size: 11px; background: var(--primary-light); color: #38bdf8; font-weight: 700; padding: 3px 10px; border-radius: var(--radius-sm);">
              Stage ${importState.stage} of 5 &bull; ${importState.fileName || 'No File Selected'}
            </span>
          </div>
          <button id="btn-close-import-modal" class="btn btn-ghost btn-sm" style="font-size: 18px;">✕</button>
        </div>

        <div class="modal-body" id="import-modal-body-container" style="padding: 22px; max-height: 80vh; overflow-y: auto; flex: 1; min-height: 0;">
          ${renderImportStageContent()}
        </div>

        <div class="modal-footer" id="import-modal-footer-container" style="background: var(--bg-card); border-top: 1px solid var(--border-color); padding: 14px 22px; display: flex; justify-content: space-between; align-items: center;">
          ${renderImportStageFooter()}
        </div>
      </div>
    </div>
  `;
}

function detectStorageFixableErrors(validationResult, workbookData, sheetMappings) {
  if (!validationResult || !validationResult.allErrors || !workbookData || !workbookData.sheets) return [];
  const fixable = [];

  validationResult.allErrors.forEach(err => {
    const val = err.enteredValue || err.rawValue;
    if (!val || typeof val !== 'string' || val.trim().length < 2) return;

    let category = 'ANY';
    const colLower = (err.column || '').toLowerCase();
    if (colLower.includes('brand')) category = 'BRAND';
    else if (colLower.includes('model')) category = 'MODEL';
    else if (colLower.includes('name')) category = 'MACHINE_NAME';
    else if (colLower.includes('serial')) category = 'SERIAL';

    const corr = smartStorageService.checkCorrection(category, val);
    if (corr && corr.hasIssue) {
      fixable.push({
        errorRef: err,
        sheetName: err.sheetName,
        rowNumber: err.rowNumber,
        column: err.column,
        original: val,
        suggested: corr.suggested,
        issueType: corr.issueType,
        issueTitle: corr.issueTitle,
        category: corr.category
      });
    }
  });

  return fixable;
}

function renderImportStageContent() {
  // STAGE 1: File Upload & Template Download
  if (importState.stage === 1) {
    return `
      <div style="text-align: center; padding: 24px 20px; display: flex; flex-direction: column; align-items: center; gap: 16px;">
        <div style="width: 76px; height: 76px; border-radius: 50%; background: rgba(56, 189, 248, 0.1); border: 2px solid #38bdf8; display: flex; align-items: center; justify-content: center; font-size: 36px;">
          📊
        </div>
        <div>
          <h3 style="font-size: 19px; font-weight: 800; color: #fff;">
            Upload Multi-Worksheet Excel Workbook (.xlsx / .xls)
          </h3>
          <p style="font-size: 12.5px; color: var(--text-secondary); max-width: 600px; margin-top: 4px;">
            The system automatically detects all worksheets (e.g. <em>Plain Machines, Overlock, 3rd Floor, Sewing Dept</em>), validates cross-sheet serial numbers, and updates existing records or registers new machines in bulk.
          </p>
        </div>

        <!-- Upload Drop Zone -->
        <div style="border: 2px dashed #38bdf8; border-radius: var(--radius-lg); padding: 36px 20px; width: 100%; max-width: 580px; background: rgba(56, 189, 248, 0.04); cursor: pointer; transition: all 0.2s;" id="drop-zone">
          <input type="file" id="excel-file-input" accept=".xlsx, .xls, .csv" style="display: none;" />
          <div style="font-size: 32px; margin-bottom: 8px;">📂</div>
          <div style="font-size: 15px; font-weight: 700; color: #fff;">Click or Drag &amp; Drop Excel Workbook Here</div>
          <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 6px;">Supports Microsoft Excel (.xlsx, .xls) with multiple worksheets &amp; CSV</div>
        </div>

        <!-- Download Template Card -->
        <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px 20px; display: flex; align-items: center; justify-content: space-between; gap: 20px; width: 100%; max-width: 580px;">
          <div style="text-align: left;">
            <div style="font-size: 12.5px; font-weight: 700; color: #fff;">Need the official Maintenance Department ERP template?</div>
            <div style="font-size: 11px; color: var(--text-muted);">Includes sample category sheets and Master Data reference codes.</div>
          </div>
          <button id="btn-download-import-template" class="btn btn-success btn-sm" style="font-weight: 700; white-space: nowrap;">
            📋 Download Template (.xlsx)
          </button>
        </div>
      </div>
    `;
  }

  // STAGE 2: Multi-Worksheet Detection & Column Mapping
  if (importState.stage === 2) {
    const wb = importState.workbookData;
    const activeSheetName = importState.activeSheetTab || wb.sheets[0]?.name;
    const currentSheet = wb.sheets.find(s => s.name === activeSheetName) || wb.sheets[0];
    const customFields = customFieldService.getActiveFields();

    const activeStruct = excelService.getActiveStructure();
    const structCols = (activeStruct?.columns || []).filter(c => c.fieldKey !== 'sl' && c.fieldKey !== 'sl_no');
    
    // Dynamically build systemFields from configured structure
    const systemFields = structCols.map(col => ({
      key: col.fieldKey,
      label: `${col.header} (${col.fieldKey})`,
      required: !!col.required
    }));

    // Add canonical recommended fields if not already in active structure
    const canonicalDefaults = [
      { key: 'machine_name', label: 'Machine Name (machine_name)', required: true },
      { key: 'machine_brand', label: 'Machine Brand (machine_brand)', required: false },
      { key: 'machine_model', label: 'Machine Model (machine_model)', required: false },
      { key: 'machine_serial', label: 'Machine Serial / Machine Number (machine_serial)', required: false },
      { key: 'machine_short_code', label: 'Machine Short Code / Sort Form (machine_short_code)', required: false },
      { key: 'unit_factory', label: 'Unit/Factory (unit_factory)', required: true },
      { key: 'floor', label: 'Floor (floor)', required: true },
      { key: 'line', label: 'Line (line)', required: true },
      { key: 'running', label: 'Running (running)', required: false },
      { key: 'usable_idle', label: 'Usable Idle (usable_idle)', required: false },
      { key: 'repairable_idle', label: 'Repairable Idle (repairable_idle)', required: false },
      { key: 'total_quantity', label: 'Total Quantity [Auto-Calculated] (total_quantity)', required: false },
      { key: 'machine_status', label: 'Machine Status (machine_status)', required: false },
      { key: 'remarks', label: 'Remarks (remarks)', required: false }
    ];

    canonicalDefaults.forEach(def => {
      if (!systemFields.some(f => f.key === def.key)) {
        systemFields.push(def);
      }
    });

    customFields.forEach(cf => {
      const cfKey = `cf_${cf.code}`;
      if (!systemFields.some(f => f.key === cfKey)) {
        systemFields.push({ key: cfKey, label: `Custom: ${cf.label} (${cfKey})`, required: cf.required });
      }
    });

    const currentMapping = importState.sheetMappings[currentSheet.name] || currentSheet.suggestedMapping || {};

    return `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <!-- Header Info Bar -->
        <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
          <div>
            <div style="font-weight: 800; color: #38bdf8; font-size: 14px;">
              📑 Detected ${wb.sheets.length} Worksheet(s) in Workbook (${wb.totalRows} Total Data Rows)
            </div>
            <div style="font-size: 11.5px; color: var(--text-secondary); margin-top: 2px;">
              Verify column mapping connections and configure how duplicate machine records are processed.
            </div>
          </div>

          <!-- Duplicate Policy Choice -->
          <div style="display: flex; align-items: center; gap: 8px;">
            <label style="font-size: 12px; font-weight: 700; color: #fbbf24; white-space: nowrap;">🛡️ Duplicate Policy:</label>
            <select id="select-duplicate-policy" class="form-control" style="font-weight: 700; font-size: 12px; width: auto;">
              <option value="${DUPLICATE_POLICIES.UPDATE_EXISTING}" ${importState.duplicatePolicy === DUPLICATE_POLICIES.UPDATE_EXISTING ? 'selected' : ''}>
                🔄 Update Existing Machines &amp; Create New (Recommended)
              </option>
              <option value="${DUPLICATE_POLICIES.REPLACE_ALL}" ${importState.duplicatePolicy === DUPLICATE_POLICIES.REPLACE_ALL ? 'selected' : ''}>
                🧹 Replace All Existing Machines (Clean Re-Import from this Excel)
              </option>
              <option value="${DUPLICATE_POLICIES.REJECT}" ${importState.duplicatePolicy === DUPLICATE_POLICIES.REJECT ? 'selected' : ''}>
                🚫 Strict Mode: Block &amp; Reject Duplicate Serials
              </option>
              <option value="${DUPLICATE_POLICIES.SKIP}" ${importState.duplicatePolicy === DUPLICATE_POLICIES.SKIP ? 'selected' : ''}>
                ⏩ Skip Existing Machines (Insert New Only)
              </option>
            </select>
          </div>
        </div>

        <!-- Worksheets Tab Switcher -->
        <div style="display: flex; gap: 8px; border-bottom: 2px solid var(--border-color); padding-bottom: 4px; overflow-x: auto;">
          ${wb.sheets.map(s => {
            const isTabActive = s.name === currentSheet.name;
            return `
              <button type="button" class="btn btn-sm btn-sheet-tab ${isTabActive ? 'btn-primary' : 'btn-secondary'}" data-sheet="${s.name}" style="font-size: 12px; font-weight: 700; display: flex; align-items: center; gap: 6px;">
                <span>📄 ${s.name}</span>
                <span class="badge ${isTabActive ? 'badge-active' : 'badge-idle'}" style="font-size: 10px;">${s.rowCount} rows</span>
              </button>
            `;
          }).join('')}
        </div>

        <!-- Column Auto-Mapping Grid for Active Worksheet -->
        <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 16px 18px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <div>
              <h4 style="font-size: 13.5px; font-weight: 800; color: #38bdf8; margin: 0;">
                🔗 Column Mapping for Worksheet: <span style="color: #fff;">${currentSheet.name}</span> (${currentSheet.rowCount} Rows)
              </h4>
              <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
                Headers found: ${currentSheet.headers.join(', ')}
              </div>
            </div>
            <button type="button" id="btn-apply-mapping-all-sheets" class="btn btn-ghost btn-sm" style="color: #38bdf8; font-size: 11.5px;">
              ⚡ Apply this mapping to all worksheets
            </button>
          </div>

          <div class="form-grid-2" style="max-height: 320px; overflow-y: auto; padding-right: 6px;">
            ${systemFields.map(sf => {
              const selectedCol = currentMapping[sf.key] || '';
              return `
                <div class="form-group">
                  <label class="form-label" style="font-size: 11.5px;">
                    ${sf.label} ${sf.required ? '<span class="req">*</span>' : ''}
                  </label>
                  <select class="form-control mapping-select" data-sys-field="${sf.key}" style="font-size: 12px;">
                    <option value="">-- Do Not Import / Auto-Fill --</option>
                    ${currentSheet.headers.map(h => `
                      <option value="${h}" ${selectedCol === h ? 'selected' : ''}>
                        Excel Column: ${h}
                      </option>
                    `).join('')}
                  </select>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;
  }

  // STAGE 3: Unknown Master Data Auto-Resolver
  if (importState.stage === 3) {
    const unknowns = importState.validationResult.unknownEntities;
    const canCreateMD = authService.isAdmin() || authService.hasPermission('MASTER_DATA');

    return `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.4); border-left: 4px solid var(--warning); border-radius: var(--radius-md); padding: 14px 18px;">
          <div style="font-weight: 800; color: #fbbf24; font-size: 14px;">⚠️ New / Unregistered Master Data Detected in Spreadsheet</div>
          <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">
            The workbook contains machine categories, brands, or models not yet registered in your Master Data. The system can automatically register and link them cleanly.
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 12px; max-height: 320px; overflow-y: auto;">
          ${unknowns.machineNames.length > 0 ? `
            <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 12px 16px;">
              <div style="color: #38bdf8; font-size: 12.5px; font-weight: 700; margin-bottom: 6px;">New Machine Names / Categories (${unknowns.machineNames.length}):</div>
              <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                ${unknowns.machineNames.map(name => `<span class="badge badge-idle" style="font-size: 11px;">🧵 ${name}</span>`).join('')}
              </div>
            </div>
          ` : ''}

          ${unknowns.brands.length > 0 ? `
            <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 12px 16px;">
              <div style="color: #34d399; font-size: 12.5px; font-weight: 700; margin-bottom: 6px;">New Machine Brands (${unknowns.brands.length}):</div>
              <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                ${unknowns.brands.map(name => `<span class="badge badge-active" style="font-size: 11px;">🏷️ ${name}</span>`).join('')}
              </div>
            </div>
          ` : ''}

          ${unknowns.models.length > 0 ? `
            <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 12px 16px;">
              <div style="color: #c084fc; font-size: 12.5px; font-weight: 700; margin-bottom: 6px;">New Models (${unknowns.models.length}):</div>
              <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                ${unknowns.models.map(name => `<span class="badge badge-maint" style="font-size: 11px;">⚙️ ${name}</span>`).join('')}
              </div>
            </div>
          ` : ''}
        </div>

        ${canCreateMD ? `
          <div style="display: flex; justify-content: flex-end; margin-top: 10px;">
            <button id="btn-auto-create-master-data" class="btn btn-success" style="font-weight: 800;">
              ✨ Auto-Create All Missing Master Data &amp; Re-Validate
            </button>
          </div>
        ` : ''}
      </div>
    `;
  }

  // STAGE 4: Multi-Worksheet Import Preview & Error Inspector
  if (importState.stage === 4) {
    const res = importState.validationResult;
    const isUpdateMode = importState.duplicatePolicy === DUPLICATE_POLICIES.UPDATE_EXISTING;
    const errorsList = res.allErrors || [];
    const fixableErrors = detectStorageFixableErrors(res, importState.workbookData, importState.sheetMappings);
    const filteredErrors = importState.errorSearchFilter ?
      errorsList.filter(e => e.sheetName.toLowerCase().includes(importState.errorSearchFilter.toLowerCase()) ||
                             e.error.toLowerCase().includes(importState.errorSearchFilter.toLowerCase()) ||
                             e.column.toLowerCase().includes(importState.errorSearchFilter.toLowerCase())) :
      errorsList;

    const dupSummary = res.duplicatesSummary || { count: res.duplicateRows || 0, cellList: [] };
    const errSummary = res.errorsSummary || { count: res.invalidRows || 0, cellList: [] };
    const autoFixSummary = res.autoFixedSummary || { count: 0, cellList: [] };

    return `
      <div style="display: flex; flex-direction: column; gap: 14px;">

        <!-- 🚨 Top Notification Center (Duplicates, Errors, and Auto-Fixes with exact Cell Addresses) -->
        <div style="display: flex; flex-direction: column; gap: 10px;">
          <!-- 1. Duplicate Records Notification Banner -->
          ${dupSummary.count > 0 ? `
            <div style="background: rgba(245, 158, 11, 0.12); border: 1.5px solid #f59e0b; border-left: 5px solid #f59e0b; border-radius: var(--radius-md); padding: 14px 18px;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; flex-wrap: wrap;">
                <div>
                  <div style="font-weight: 800; color: #fbbf24; font-size: 14px; display: flex; align-items: center; gap: 8px;">
                    <span>🛡️ Duplicate Notification: <strong>${dupSummary.count} Duplicate Record(s)</strong> Detected!</span>
                  </div>
                  <div style="font-size: 11.5px; color: var(--text-secondary); margin-top: 3px;">
                    Rule: Verified by matching <strong>Machine Name + Brand + Model + Serial Number</strong>. Duplicates found in the following cells:
                  </div>
                </div>
                <span class="badge" style="background: rgba(245, 158, 11, 0.25); color: #fbbf24; border: 1px solid #f59e0b; font-size: 11.5px; font-weight: 800; padding: 4px 10px;">
                  ${dupSummary.count} Duplicates
                </span>
              </div>
              <div style="margin-top: 10px; display: flex; flex-wrap: wrap; gap: 6px; max-height: 90px; overflow-y: auto;">
                ${dupSummary.cellList.slice(0, 40).map(c => `
                  <span class="badge" style="background: rgba(245, 158, 11, 0.18); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4); font-family: var(--font-mono); font-size: 11px; padding: 3px 8px;" title="${c.reason || ''}">
                    📍 ${c.sheetName ? `${c.sheetName} &bull; ` : ''}Cell <strong>${c.cell}</strong> (${c.serialNumber || 'SN'})
                  </span>
                `).join('')}
                ${dupSummary.cellList.length > 40 ? `
                  <span style="font-size: 11px; color: var(--text-muted); align-self: center;">+${dupSummary.cellList.length - 40} more cells</span>
                ` : ''}
              </div>
            </div>
          ` : `
            <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.3); border-left: 4px solid #10b981; border-radius: var(--radius-md); padding: 10px 16px; display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 16px;">✅</span>
              <span style="font-size: 12px; color: #34d399; font-weight: 700;">
                Duplicate Check Passed: No duplicate records found (0 Duplicates). All records are unique.
              </span>
            </div>
          `}

          <!-- 2. Errors Notification Banner -->
          ${errSummary.count > 0 ? `
            <div style="background: rgba(239, 68, 68, 0.12); border: 1.5px solid #ef4444; border-left: 5px solid #ef4444; border-radius: var(--radius-md); padding: 14px 18px;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; flex-wrap: wrap;">
                <div>
                  <div style="font-weight: 800; color: #f87171; font-size: 14px; display: flex; align-items: center; gap: 8px;">
                    <span>⚠️ Error Notification: <strong>${errSummary.count} Issue(s) / Error(s)</strong> Detected!</span>
                  </div>
                  <div style="font-size: 11.5px; color: var(--text-secondary); margin-top: 3px;">
                    Required fields missing or invalid data found in the following cells (you may correct these directly in Excel):
                  </div>
                </div>
                <span class="badge" style="background: rgba(239, 68, 68, 0.25); color: #f87171; border: 1px solid #ef4444; font-size: 11.5px; font-weight: 800; padding: 4px 10px;">
                  ${errSummary.count} Errors
                </span>
              </div>
              <div style="margin-top: 10px; display: flex; flex-wrap: wrap; gap: 6px; max-height: 90px; overflow-y: auto;">
                ${errSummary.cellList.slice(0, 40).map(c => `
                  <span class="badge" style="background: rgba(239, 68, 68, 0.18); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4); font-family: var(--font-mono); font-size: 11px; padding: 3px 8px;" title="${c.error || ''}">
                    ❌ ${c.sheetName ? `${c.sheetName} &bull; ` : ''}Cell <strong>${c.cell}</strong> (${c.column})
                  </span>
                `).join('')}
                ${errSummary.cellList.length > 40 ? `
                  <span style="font-size: 11px; color: var(--text-muted); align-self: center;">+${errSummary.cellList.length - 40} more cells</span>
                ` : ''}
              </div>
            </div>
          ` : ''}

          <!-- 3. Master Data Auto-Fix Banner -->
          ${autoFixSummary.count > 0 ? `
            <div style="background: rgba(56, 189, 248, 0.1); border: 1.5px solid rgba(56, 189, 248, 0.45); border-left: 5px solid #38bdf8; border-radius: var(--radius-md); padding: 12px 18px;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; flex-wrap: wrap;">
                <div>
                  <div style="font-weight: 800; color: #38bdf8; font-size: 13.5px; display: flex; align-items: center; gap: 8px;">
                    <span>✨ Master Data Auto-Fix: <strong>${autoFixSummary.count} Cell(s)</strong> normalized automatically!</span>
                  </div>
                  <div style="font-size: 11.5px; color: var(--text-secondary); margin-top: 3px;">
                    Excess spaces and casing differences were automatically matched and standardized against master data records.
                  </div>
                </div>
                <span class="badge" style="background: rgba(56, 189, 248, 0.2); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.4); font-size: 11px; font-weight: 800; padding: 3px 8px;">
                  ${autoFixSummary.count} Auto-Fixed
                </span>
              </div>
              <div style="margin-top: 8px; display: flex; flex-wrap: wrap; gap: 6px; max-height: 70px; overflow-y: auto;">
                ${autoFixSummary.cellList.slice(0, 25).map(c => `
                  <span class="badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); font-family: var(--font-mono); font-size: 10.5px; padding: 2px 7px;">
                    ⚡ Cell <strong>${c.cell}</strong> (${c.column}: "${c.original}" ➔ "${c.fixed}")
                  </span>
                `).join('')}
                ${autoFixSummary.cellList.length > 25 ? `
                  <span style="font-size: 11px; color: var(--text-muted); align-self: center;">+${autoFixSummary.cellList.length - 25} more cells auto-fixed</span>
                ` : ''}
              </div>
            </div>
          ` : ''}\n\n          <!-- 4. AUTOGEN Serial Warning Banner (shown if any records will get auto-generated serial) -->
          ${(() => {
            const allSheets = res.sheets || res.validatedSheets || [];
            const autoGenRows = allSheets.flatMap(s => s.records || []).filter(r => {
              const sn = r.data?.serialNumber || '';
              return sn.includes('AUTOGEN') || sn === '';
            });
            if (autoGenRows.length === 0) return '';
            return `
              <div style="background: rgba(239, 68, 68, 0.15); border: 2px solid #ef4444; border-left: 6px solid #dc2626; border-radius: var(--radius-md); padding: 14px 18px;">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                  <div>
                    <div style="font-weight: 900; color: #f87171; font-size: 14px;">
                      🚨 WARNING: ${autoGenRows.length} machine(s) have NO serial number in Excel!
                    </div>
                    <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">
                      These rows will receive auto-generated serial numbers (e.g. <code style="background:rgba(239,68,68,0.2);padding:1px 5px;border-radius:3px;">JA-001</code>).
                      <strong style="color:#fca5a5;">Go back to Excel → fill the "Machine Serial" column → re-import.</strong>
                    </div>
                  </div>
                  <span class="badge" style="background:rgba(239,68,68,0.3);color:#f87171;border:1px solid #ef4444;font-weight:800;padding:5px 12px;font-size:12px;">${autoGenRows.length} Missing Serials</span>
                </div>
              </div>
            `;
          })()}

          <!-- 5. Running / Usable Idle / Repairable Breakdown Summary -->
          ${(() => {
            const allSheets = res.sheets || res.validatedSheets || [];
            const allRecords = allSheets.flatMap(s => s.records || []).filter(r => r.isValid !== false);
            if (allRecords.length === 0) return '';
            const totalRunning = allRecords.reduce((s, r) => s + (Number(r.data?.running) || 0), 0);
            const totalUsable = allRecords.reduce((s, r) => s + (Number(r.data?.usableIdle) || 0), 0);
            const totalRepairable = allRecords.reduce((s, r) => s + (Number(r.data?.repairableIdle) || 0), 0);
            const totalQty = allRecords.reduce((s, r) => s + (Number(r.data?.totalQuantity) || 0), 0);
            const zeroQtyRows = allRecords.filter(r => (Number(r.data?.running) || 0) === 0 && (Number(r.data?.usableIdle) || 0) === 0 && (Number(r.data?.repairableIdle) || 0) === 0);
            return `
              <div style="background: rgba(56, 189, 248, 0.07); border: 1px solid rgba(56,189,248,0.3); border-left: 5px solid #38bdf8; border-radius: var(--radius-md); padding: 12px 18px;">
                <div style="font-weight: 800; color: #38bdf8; font-size: 13px; margin-bottom: 8px;">📊 Quantity Summary (all valid records)</div>
                <div style="display: flex; flex-wrap: wrap; gap: 12px; font-size: 12.5px;">
                  <span style="color:#34d399;font-weight:700;">🟢 Running: <strong>${totalRunning}</strong></span>
                  <span style="color:#fbbf24;font-weight:700;">🟡 Usable Idle: <strong>${totalUsable}</strong></span>
                  <span style="color:#f87171;font-weight:700;">🔴 Repairable Idle: <strong>${totalRepairable}</strong></span>
                  <span style="color:#c084fc;font-weight:700;">📦 Total Qty: <strong>${totalQty}</strong></span>
                  ${zeroQtyRows.length > 0 ? `<span style="color:#fb923c;font-weight:700;">⚠️ ${zeroQtyRows.length} rows with all-zero quantities (Running/Idle columns may be blank in Excel)</span>` : ''}
                </div>
              </div>
            `;
          })()}
        </div>
        
        <!-- Summary KPI Metrics Grid -->
        <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px;">
          <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 10px 12px; text-align: center;">
            <div style="font-size: 18px; font-weight: 800; color: #38bdf8;">${res.totalSheets}</div>
            <div style="font-size: 10.5px; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Sheets</div>
          </div>

          <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 10px 12px; text-align: center;">
            <div style="font-size: 18px; font-weight: 800; color: #fff;">${res.totalRows}</div>
            <div style="font-size: 10.5px; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Total Rows</div>
          </div>

          <div style="background: var(--bg-card); border: 1px solid rgba(16, 185, 129, 0.4); border-radius: var(--radius-md); padding: 10px 12px; text-align: center;">
            <div style="font-size: 18px; font-weight: 800; color: #34d399;">${res.newRows}</div>
            <div style="font-size: 10.5px; color: #34d399; font-weight: 700; text-transform: uppercase;">New Machines</div>
          </div>

          <div style="background: var(--bg-card); border: 1px solid rgba(192, 132, 252, 0.4); border-radius: var(--radius-md); padding: 10px 12px; text-align: center;">
            <div style="font-size: 18px; font-weight: 800; color: #c084fc;">${res.updateRows}</div>
            <div style="font-size: 10.5px; color: #c084fc; font-weight: 700; text-transform: uppercase;">Updates</div>
          </div>

          <div style="background: var(--bg-card); border: 1px solid rgba(245, 158, 11, 0.4); border-radius: var(--radius-md); padding: 10px 12px; text-align: center;">
            <div style="font-size: 18px; font-weight: 800; color: #fbbf24;">${res.duplicateRows}</div>
            <div style="font-size: 10.5px; color: #fbbf24; font-weight: 700; text-transform: uppercase;">Duplicates</div>
          </div>

          <div style="background: var(--bg-card); border: 1px solid rgba(239, 68, 68, 0.4); border-radius: var(--radius-md); padding: 10px 12px; text-align: center;">
            <div style="font-size: 18px; font-weight: 800; color: #f87171;">${res.invalidRows}</div>
            <div style="font-size: 10.5px; color: #f87171; font-weight: 700; text-transform: uppercase;">Errors</div>
          </div>
        </div>

        <!-- Sheet Breakdown Table -->
        <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 12px 16px;">
          <div style="font-size: 12px; font-weight: 700; color: #38bdf8; text-transform: uppercase; margin-bottom: 8px;">
            📑 Sheet-by-Sheet Breakdown
          </div>
          <table class="excel-grid-table" style="font-size: 11.5px;">
            <thead>
              <tr>
                <th>Worksheet Name</th>
                <th style="text-align: center;">Total Rows</th>
                <th style="text-align: center; color: #34d399;">New Machines</th>
                <th style="text-align: center; color: #c084fc;">Updates</th>
                <th style="text-align: center; color: #f87171;">Errors / Blocked</th>
              </tr>
            </thead>
            <tbody>
              ${res.sheets.map(s => `
                <tr>
                  <td style="font-weight: 700; color: #fff;">📄 ${s.name}</td>
                  <td style="text-align: center;">${s.totalRows}</td>
                  <td style="text-align: center; color: #34d399; font-weight: 700;">${s.newRows}</td>
                  <td style="text-align: center; color: #c084fc; font-weight: 700;">${s.updateRows}</td>
                  <td style="text-align: center; color: ${s.invalidRows > 0 ? '#f87171' : 'var(--text-muted)'}; font-weight: 700;">
                    ${s.invalidRows}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Smart Storage Auto-Correction Banner -->
        ${fixableErrors.length > 0 ? `
          <div style="background: rgba(245, 158, 11, 0.12); border: 1.5px solid rgba(245, 158, 11, 0.45); border-left: 5px solid #f59e0b; border-radius: var(--radius-md); padding: 14px 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
            <div>
              <div style="font-weight: 800; color: #fbbf24; font-size: 13.5px; display: flex; align-items: center; gap: 8px;">
                <span>💡 Smart Storage Auto-Correction: ${fixableErrors.length} row(s) with casing or spelling issues detected!</span>
              </div>
              <div style="font-size: 11.5px; color: var(--text-secondary); margin-top: 2px;">
                Auto-fix machine names, models, brands, or serial numbers matching reference storage in 1-click.
              </div>
            </div>
            <button type="button" id="btn-auto-fix-all-import-errors" class="btn btn-success btn-sm" style="font-weight: 800; font-size: 12.5px; padding: 6px 14px; display: flex; align-items: center; gap: 6px;">
              <span>✨ Auto-Fix All (${fixableErrors.length})</span>
            </button>
          </div>
        ` : ''}

        <!-- Partial Import Alert Banner -->
        <div style="background: rgba(56, 189, 248, 0.08); border: 1px solid rgba(56, 189, 248, 0.3); border-left: 4px solid #38bdf8; border-radius: var(--radius-md); padding: 12px 16px;">
          <div style="font-weight: 800; color: #38bdf8; font-size: 13px;">⚡ Partial Import Mode Active</div>
          <div style="font-size: 11.5px; color: var(--text-secondary); margin-top: 2px;">
            The system will <strong>import all valid rows (${res.validRows})</strong> directly. Only invalid rows (${res.invalidRows}) will be skipped and can be downloaded as an Error Report for correction.
          </div>
        </div>

        <!-- Detailed Validation Error Inspector & Download Error Report -->
        <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 12px 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 12px; font-weight: 700; color: #f87171; text-transform: uppercase;">
                ⚠️ Validation Errors &amp; Diagnostic Log (${errorsList.length})
              </span>
            </div>

            <div style="display: flex; gap: 8px;">
              <input type="text" id="inp-filter-errors" class="form-control" placeholder="Filter errors..." value="${importState.errorSearchFilter}" style="font-size: 11px; padding: 3px 8px; width: 180px;" />
              ${errorsList.length > 0 ? `
                <button type="button" id="btn-download-error-report" class="btn btn-danger btn-sm" style="font-size: 11px; font-weight: 700;">
                  📥 Download Error Report (.xlsx)
                </button>
              ` : ''}
            </div>
          </div>

          <div style="max-height: 220px; overflow-y: auto;">
            ${filteredErrors.length === 0 ? `
              <div style="color: #34d399; font-size: 12px; padding: 12px; text-align: center; font-weight: 600;">
                ✅ Perfect! All records passed validation checks with 0 errors.
              </div>
            ` : `
              <table class="excel-grid-table" style="font-size: 11px;">
                <thead>
                  <tr>
                    <th style="width: 85px; text-align: center;">Excel Cell</th>
                    <th style="width: 65px; text-align: center;">Row</th>
                    <th>Column</th>
                    <th>Entered Value</th>
                    <th>Error Reason</th>
                    <th>Suggested Correction</th>
                  </tr>
                </thead>
                <tbody>
                  ${filteredErrors.map(err => {
                    const fixMatch = fixableErrors.find(f => f.rowNumber === err.rowNumber && f.column === err.column);
                    return `
                      <tr style="background: ${fixMatch ? 'rgba(245, 158, 11, 0.07)' : 'rgba(239, 68, 68, 0.04)'};">
                        <td style="text-align: center; font-family: var(--font-mono); font-weight: 800; color: #38bdf8;">
                          <span class="badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); font-size: 10.5px; padding: 2px 6px;">
                            ${err.cell || ('Row ' + err.rowNumber)}
                          </span>
                        </td>
                        <td style="text-align: center; font-family: var(--font-mono); font-weight: 700; color: var(--text-muted);">Row ${err.rowNumber}</td>
                        <td style="font-weight: 700; color: #fbbf24;">${err.column}</td>
                        <td style="font-family: var(--font-mono); color: #fff;">${err.enteredValue || err.rawValue || '—'}</td>
                        <td style="color: #f87171; font-weight: 600;">${err.error}</td>
                        <td style="color: #34d399; font-size: 10.5px;">
                          ${fixMatch ? `
                            <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px;">
                              <span style="font-weight: 800; color: #34d399; font-family: var(--font-mono); font-size: 11px;">${fixMatch.suggested}</span>
                              <button type="button" class="btn btn-ghost btn-sm btn-fix-single-excel-cell" data-sheet="${err.sheetName || ''}" data-row="${err.rowNumber}" data-col="${err.column}" data-fixed="${fixMatch.suggested}" style="font-size: 10px; color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); padding: 1px 6px; font-weight: 700;">
                                ⚡ Fix
                              </button>
                            </div>
                          ` : (err.suggestedCorrection || 'Check reference data')}
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            `}
          </div>
        </div>
      </div>
    `;
  }

  // STAGE 5: Result Summary with Row-wise Error Reporting
  if (importState.stage === 5) {
    const res = importState.importResult || {};
    const failedRows = res.failedRows || [];

    return `
      <div style="text-align: center; padding: 20px 16px; display: flex; flex-direction: column; align-items: center; gap: 16px;">
        <div style="width: 64px; height: 64px; border-radius: 50%; background: rgba(16, 185, 129, 0.15); border: 2px solid #10b981; display: flex; align-items: center; justify-content: center; font-size: 32px;">
          ${res.failedCount === 0 ? '✅' : '⚡'}
        </div>

        <div>
          <h3 style="font-size: 19px; font-weight: 800; color: ${res.failedCount === 0 ? '#34d399' : '#38bdf8'}; margin: 0;">
            ${res.failedCount === 0 ? 'Excel Import Completed Successfully!' : 'Import Completed with Row-Wise Reporting'}
          </h3>
          <p style="font-size: 12.5px; color: var(--text-secondary); max-width: 580px; margin-top: 4px;">
            All valid rows were imported into the database. Problematic rows were skipped and logged below for easy correction and re-import.
          </p>
        </div>

        <!-- Metric KPI Cards -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; width: 100%; max-width: 760px;">
          <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 12px; text-align: center;">
            <div style="font-size: 20px; font-weight: 800; color: #fff;">${res.totalProcessed || 0}</div>
            <div style="font-size: 11px; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Total Rows</div>
          </div>

          <div style="background: var(--bg-card); border: 1.5px solid rgba(16, 185, 129, 0.5); border-radius: var(--radius-md); padding: 12px; text-align: center;">
            <div style="font-size: 20px; font-weight: 800; color: #34d399;">${res.totalImported || 0}</div>
            <div style="font-size: 11px; color: #34d399; font-weight: 700; text-transform: uppercase;">
              Successfully Imported (${res.insertedCount || 0} New, ${res.updatedCount || 0} Updated)
            </div>
          </div>

          <div style="background: var(--bg-card); border: 1.5px solid ${res.failedCount > 0 ? 'rgba(239, 68, 68, 0.5)' : 'var(--border-color)'}; border-radius: var(--radius-md); padding: 12px; text-align: center;">
            <div style="font-size: 20px; font-weight: 800; color: ${res.failedCount > 0 ? '#f87171' : 'var(--text-muted)'};">${res.failedCount || 0}</div>
            <div style="font-size: 11px; color: ${res.failedCount > 0 ? '#f87171' : 'var(--text-muted)'}; font-weight: 700; text-transform: uppercase;">Failed Rows</div>
          </div>

          <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 12px; text-align: center;">
            <div style="font-size: 20px; font-weight: 800; color: #fbbf24;">${res.skippedCount || res.failedCount || 0}</div>
            <div style="font-size: 11px; color: #fbbf24; font-weight: 700; text-transform: uppercase;">Skipped Rows</div>
          </div>
        </div>

        <!-- Row-by-Row Error Detail Table (When rows failed) -->
        <div style="text-align: left; width: 100%; max-width: 760px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px 18px;">
          
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <div>
              <div style="font-size: 13.5px; font-weight: 800; color: #fff;">
                📋 Import Status &amp; Error Report
              </div>
              <div style="font-size: 11.5px; color: var(--text-secondary); margin-top: 2px;">
                ${res.failedCount > 0 ? 'Review the exact row numbers, columns, and error reasons below. You can download the error report, correct the cells in Excel, and re-import.' : 'All rows passed without errors.'}
              </div>
            </div>

            ${failedRows.length > 0 ? `
              <button id="btn-download-error-report-final" class="btn btn-danger btn-sm" style="font-weight: 700; font-size: 11.5px; padding: 5px 12px;">
                📥 Download Error Report (.xlsx)
              </button>
            ` : ''}
          </div>

          ${failedRows.length > 0 ? `
            <div style="max-height: 220px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 6px;">
              <table class="excel-grid-table" style="font-size: 11.5px; width: 100%;">
                <thead>
                  <tr>
                    <th style="width: 85px; text-align: center;">Excel Cell</th>
                    <th style="width: 65px; text-align: center;">Row</th>
                    <th>Column</th>
                    <th>Entered Value</th>
                    <th>Error</th>
                    <th>Suggested Correction</th>
                  </tr>
                </thead>
                <tbody>
                  ${failedRows.map(f => `
                    <tr style="background: rgba(239, 68, 68, 0.04);">
                      <td style="text-align: center; font-family: var(--font-mono); font-weight: 800; color: #38bdf8;">
                        <span class="badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); font-size: 10.5px; padding: 2px 6px;">
                          ${f.cell || ('Row ' + f.rowNumber)}
                        </span>
                      </td>
                      <td style="text-align: center; font-family: var(--font-mono); font-weight: 700; color: var(--text-muted);">Row ${f.rowNumber}</td>
                      <td style="font-weight: 700; color: #fbbf24;">${f.column || 'General'}</td>
                      <td style="font-family: var(--font-mono); color: #fff;">${f.enteredValue || f.serialNumber || '—'}</td>
                      <td style="color: #f87171; font-weight: 600;">${f.error}</td>
                      <td style="color: #34d399; font-size: 11px;">${f.suggestedCorrection || 'Check master data reference sheet'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : `
            <div style="color: #34d399; font-size: 12.5px; font-weight: 700; padding: 12px 0; text-align: center;">
              ✨ All ${res.totalImported} machine records were successfully imported with 0 errors!
            </div>
          `}
        </div>

        <div style="display: flex; gap: 10px; margin-top: 6px;">
          <button id="btn-finish-import-view-inventory" class="btn btn-primary" style="font-weight: 800; padding: 8px 20px;">
            🧵 Go to Machine Inventory
          </button>
        </div>
      </div>
    `;
  }

  return '';
}

function renderImportStageFooter() {
  if (importState.stage === 1) {
    return `<button id="btn-cancel-import" class="btn btn-secondary">Cancel</button>`;
  }
  if (importState.stage === 2) {
    return `
      <button id="btn-back-stage-1" class="btn btn-secondary">◀ Back to Upload</button>
      <button id="btn-run-validation" class="btn btn-primary" style="font-weight: 800;">
        Validate All Worksheets Data ▶
      </button>
    `;
  }
  if (importState.stage === 3) {
    return `
      <button id="btn-back-stage-2" class="btn btn-secondary">◀ Back to Mapping</button>
      <button id="btn-skip-unknowns-proceed" class="btn btn-secondary">Skip Unknown Rows &amp; Proceed ▶</button>
    `;
  }
  if (importState.stage === 4) {
    const res = importState.validationResult;
    const canCommit = res.validRows > 0;
    return `
      <button id="btn-back-stage-2" class="btn btn-secondary">◀ Adjust Mapping</button>
      <div style="display: flex; gap: 10px;">
        <button id="btn-commit-import-execution" class="btn btn-success" ${canCommit ? '' : 'disabled'} style="font-weight: 800;">
          🚀 Confirm &amp; Import (${res.validRows} Records)
        </button>
      </div>
    `;
  }
  if (importState.stage === 5) {
    return `<button id="btn-close-import-final" class="btn btn-secondary">Close</button>`;
  }
  return '';
}

export function initExcelImportEvents() {
  const overlay = document.getElementById('modal-import-excel-overlay');
  const closeBtn = document.getElementById('btn-close-import-modal');
  const cancelBtn = document.getElementById('btn-cancel-import');

  const closeModal = () => {
    importState = { stage: 1, fileName: '', workbookData: null, activeSheetTab: '', sheetMappings: {}, duplicatePolicy: DUPLICATE_POLICIES.UPDATE_EXISTING, unknownResolutions: {}, validationResult: null, importResult: null, errorSearchFilter: '' };
    state.set('activeModal', null);
  };

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
  }

  // Upload File & Dropzone
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('excel-file-input');

  const processSelectedFile = (file) => {
    if (!file) return;

    importState.fileName = file.name;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const parsedWb = await excelService.parseMultiSheetWorkbook(evt.target.result, file.name);
        importState.workbookData = parsedWb;
        importState.activeSheetTab = parsedWb.sheets[0]?.name || '';

        // Initialize sheet mappings
        parsedWb.sheets.forEach(s => {
          importState.sheetMappings[s.name] = { ...s.suggestedMapping };
        });

        importState.stage = 2;
        updateModalDOM();
      } catch (err) {
        alert('Failed to process Excel workbook: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  if (dropZone && fileInput) {
    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.style.borderColor = '#34d399';
      dropZone.style.background = 'rgba(52, 211, 153, 0.08)';
    });

    dropZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dropZone.style.borderColor = '#38bdf8';
      dropZone.style.background = 'rgba(56, 189, 248, 0.04)';
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.style.borderColor = '#38bdf8';
      dropZone.style.background = 'rgba(56, 189, 248, 0.04)';
      const file = e.dataTransfer?.files?.[0];
      if (file) processSelectedFile(file);
    });

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) processSelectedFile(file);
    });
  }

  // Download Template
  const btnTemplate = document.getElementById('btn-download-import-template');
  if (btnTemplate) {
    btnTemplate.addEventListener('click', async () => {
      try {
        await excelService.generateMultiSheetTemplate();
      } catch (err) {
        alert('Failed to generate template: ' + err.message);
      }
    });
  }

  // Duplicate Policy
  const policySelect = document.getElementById('select-duplicate-policy');
  if (policySelect) {
    policySelect.addEventListener('change', (e) => {
      importState.duplicatePolicy = e.target.value;
    });
  }

  // Sheet Tabs
  document.querySelectorAll('.btn-sheet-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      saveCurrentSheetMapping();
      importState.activeSheetTab = btn.getAttribute('data-sheet');
      updateModalDOM();
    });
  });

  const saveCurrentSheetMapping = () => {
    const sheetName = importState.activeSheetTab;
    if (!sheetName) return;
    const mapping = {};
    document.querySelectorAll('.mapping-select').forEach(sel => {
      const sysField = sel.getAttribute('data-sys-field');
      if (sel.value) mapping[sysField] = sel.value;
    });
    importState.sheetMappings[sheetName] = mapping;
  };

  // Apply mapping to all sheets
  const btnApplyAll = document.getElementById('btn-apply-mapping-all-sheets');
  if (btnApplyAll) {
    btnApplyAll.addEventListener('click', () => {
      saveCurrentSheetMapping();
      const currentMapping = importState.sheetMappings[importState.activeSheetTab] || {};
      importState.workbookData.sheets.forEach(s => {
        importState.sheetMappings[s.name] = { ...currentMapping };
      });
      alert('Current column mapping applied to all worksheets.');
    });
  }

  // Run Validation across all worksheets
  const btnRunValidation = document.getElementById('btn-run-validation');
  if (btnRunValidation) {
    btnRunValidation.addEventListener('click', () => {
      saveCurrentSheetMapping();

      const valRes = excelService.validateMultiSheetWorkbook(
        importState.workbookData.sheets,
        importState.sheetMappings,
        importState.duplicatePolicy,
        importState.unknownResolutions
      );

      importState.validationResult = valRes;

      const hasUnknowns = valRes.unknownEntities.machineNames.length > 0 ||
                          valRes.unknownEntities.brands.length > 0 ||
                          valRes.unknownEntities.models.length > 0;

      if (hasUnknowns) {
        importState.stage = 3;
      } else {
        importState.stage = 4;
      }
      updateModalDOM();
    });
  }

  // Auto-Create Missing Master Data
  const btnAutoCreateMD = document.getElementById('btn-auto-create-master-data');
  if (btnAutoCreateMD) {
    btnAutoCreateMD.addEventListener('click', () => {
      try {
        const created = excelService.createMissingMasterData(importState.validationResult.unknownEntities);
        importState.unknownResolutions = { ...importState.unknownResolutions, ...created };

        // Re-validate
        importState.validationResult = excelService.validateMultiSheetWorkbook(
          importState.workbookData.sheets,
          importState.sheetMappings,
          importState.duplicatePolicy,
          importState.unknownResolutions
        );
        importState.stage = 4;
        updateModalDOM();
      } catch (err) {
        alert('Error: ' + err.message);
      }
    });
  }

  // Skip Unknowns & Proceed
  const btnSkipUnknowns = document.getElementById('btn-skip-unknowns-proceed');
  if (btnSkipUnknowns) {
    btnSkipUnknowns.addEventListener('click', () => {
      importState.stage = 4;
      updateModalDOM();
    });
  }

  // Back Navigation
  const btnBackStage1 = document.getElementById('btn-back-stage-1');
  if (btnBackStage1) {
    btnBackStage1.addEventListener('click', () => {
      importState.stage = 1;
      updateModalDOM();
    });
  }

  const btnBackStage2 = document.getElementById('btn-back-stage-2');
  if (btnBackStage2) {
    btnBackStage2.addEventListener('click', () => {
      importState.stage = 2;
      updateModalDOM();
    });
  }

  // Error Report Filter
  const inpFilterErrors = document.getElementById('inp-filter-errors');
  if (inpFilterErrors) {
    inpFilterErrors.addEventListener('input', (e) => {
      importState.errorSearchFilter = e.target.value;
      updateModalDOM();
    });
  }

  // Smart Storage Auto-Fix All Errors in Excel Import
  const btnAutoFixAll = document.getElementById('btn-auto-fix-all-import-errors');
  if (btnAutoFixAll) {
    btnAutoFixAll.addEventListener('click', () => {
      const fixableErrors = detectStorageFixableErrors(importState.validationResult, importState.workbookData, importState.sheetMappings);
      if (!fixableErrors.length) return;

      smartStorageService.promptCorrection({
        original: `${fixableErrors.length} row(s) with casing or spelling issues`,
        suggested: 'Standard Canonical Storage Values',
        issueTitle: `${fixableErrors.length} Inconsistent Records Found in Excel`,
        context: 'Excel Import Wizard Auto-Correction',
        onConfirm: () => {
          let count = 0;
          fixableErrors.forEach(fix => {
            const sheet = (importState.workbookData.sheets || []).find(s => s.name === fix.sheetName) || importState.workbookData.sheets[0];
            if (sheet && sheet.rows) {
              const rowObj = sheet.rows[fix.rowNumber - 2] || sheet.rows[fix.rowNumber - 1] || sheet.rows.find(r => r[fix.column] === fix.original);
              if (rowObj && rowObj[fix.column] !== undefined) {
                rowObj[fix.column] = fix.suggested;
                count++;
              }
            }
          });

          // Re-validate sheets immediately
          importState.validationResult = excelService.validateMultiSheetWorkbook(
            importState.workbookData.sheets,
            importState.sheetMappings,
            importState.duplicatePolicy,
            importState.unknownResolutions
          );
          updateModalDOM();
          alert(`✅ Successfully auto-corrected ${count} field(s) with standard storage values!`);
        }
      });
    });
  }

  // Single Cell Auto-Fix in Excel Import Table
  document.querySelectorAll('.btn-fix-single-excel-cell').forEach(btn => {
    btn.addEventListener('click', () => {
      const sheetName = btn.dataset.sheet;
      const rowNum = parseInt(btn.dataset.row, 10);
      const col = btn.dataset.col;
      const fixedVal = btn.dataset.fixed;

      const sheet = (importState.workbookData.sheets || []).find(s => s.name === sheetName) || importState.workbookData.sheets[0];
      if (sheet && sheet.rows) {
        const rowObj = sheet.rows[rowNum - 2] || sheet.rows[rowNum - 1] || sheet.rows.find(r => r[col] !== undefined);
        if (rowObj && rowObj[col] !== undefined) {
          rowObj[col] = fixedVal;
        }
      }

      // Re-validate sheets
      importState.validationResult = excelService.validateMultiSheetWorkbook(
        importState.workbookData.sheets,
        importState.sheetMappings,
        importState.duplicatePolicy,
        importState.unknownResolutions
      );
      updateModalDOM();
    });
  });

  // Download Error Report
  const btnDownErr = document.getElementById('btn-download-error-report');
  const btnDownErrFinal = document.getElementById('btn-download-error-report-final');
  const triggerDownloadError = () => {
    excelService.exportErrorReport({
      validationResult: importState.validationResult,
      importResult: importState.importResult,
      failedRows: importState.importResult?.failedRows,
      fileName: importState.fileName || 'Machine_Import.xlsx'
    }, importState.fileName || 'Machine_Import.xlsx');
  };
  if (btnDownErr) btnDownErr.addEventListener('click', triggerDownloadError);
  if (btnDownErrFinal) btnDownErrFinal.addEventListener('click', triggerDownloadError);

  // Execute Commit Import
  const btnCommit = document.getElementById('btn-commit-import-execution');
  if (btnCommit) {
    btnCommit.addEventListener('click', () => {
      try {
        const res = excelService.commitMultiSheetImport(importState.validationResult.sheets, {
          fileName: importState.fileName,
          duplicatePolicy: importState.duplicatePolicy,
          replaceExisting: importState.duplicatePolicy === DUPLICATE_POLICIES.REPLACE_ALL
        });
        importState.importResult = res;
        importState.stage = 5;
        updateModalDOM();
        state.emit('inventory:updated');
      } catch (err) {
        alert('Commit Error: ' + err.message);
      }
    });
  }

  // Finish and go to inventory
  const btnGoInv = document.getElementById('btn-finish-import-view-inventory');
  if (btnGoInv) {
    btnGoInv.addEventListener('click', () => {
      closeModal();
      state.set('currentView', 'inventory');
    });
  }

  const btnCloseFinal = document.getElementById('btn-close-import-final');
  if (btnCloseFinal) btnCloseFinal.addEventListener('click', closeModal);
}

function updateModalDOM() {
  const body = document.getElementById('import-modal-body-container');
  const footer = document.getElementById('import-modal-footer-container');
  if (body) body.innerHTML = renderImportStageContent();
  if (footer) footer.innerHTML = renderImportStageFooter();
  initExcelImportEvents();
}
