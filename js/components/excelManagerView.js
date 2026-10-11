/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Admin Excel Structure Builder, Template Designer & Bulk Update Center Component
 */

import { storage } from '../db/storage.js';
import { TABLE_NAMES } from '../db/schema.js';
import { excelService } from '../services/excelService.js';
import { customFieldService } from '../services/customFieldService.js';
import { authService } from '../services/authService.js';
import { state } from '../state.js';

let activeTab = 'structure'; // 'structure', 'template', 'history'

export function renderExcelManagerView() {
  const struct = excelService.getActiveStructure();
  const columns = [...(struct.columns || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
  const customFields = customFieldService.getAllFields();
  const importHistory = storage.getTable(TABLE_NAMES.IMPORT_HISTORY) || [];

  return `
    <div class="page-view" style="padding: 10px 14px; gap: 10px;">
      <!-- Title Bar -->
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
        <div style="display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap;">
          <h1 style="font-size: 17px; font-weight: 800; color: #fff; margin: 0;">📊 Excel Structure &amp; Template Designer</h1>
          <span style="font-size: 11.5px; color: var(--text-muted);">Configure layout headers, database field mappings, and custom specifications.</span>
        </div>

        <div style="display: flex; gap: 6px;">
          <button id="btn-mgr-download-template" class="btn btn-success btn-sm" style="font-size: 11.5px; padding: 4px 10px;">📋 Download Template (.xlsx)</button>
          <button id="btn-mgr-launch-import" class="btn btn-primary btn-sm" style="font-size: 11.5px; padding: 4px 10px;">📥 Import Wizard</button>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div style="display: flex; gap: 6px; border-bottom: 2px solid var(--border-color); padding-bottom: 4px; flex-wrap: wrap;">
        <button class="btn ${activeTab === 'structure' ? 'btn-primary' : 'btn-ghost'}" data-tab="structure" style="font-size: 12px; font-weight: 700; padding: 4px 14px; border-radius: 4px;">
          📐 1. Structure Builder
        </button>
        <button class="btn ${activeTab === 'template' ? 'btn-primary' : 'btn-ghost'}" data-tab="template" style="font-size: 12px; font-weight: 700; padding: 4px 14px; border-radius: 4px;">
          👁️ 2. Template Preview
        </button>
        <button class="btn ${activeTab === 'history' ? 'btn-primary' : 'btn-ghost'}" data-tab="history" style="font-size: 12px; font-weight: 700; padding: 4px 14px; border-radius: 4px;">
          📜 3. Import History (${importHistory.length})
        </button>
      </div>

      <!-- Tab Content Area -->
      ${renderTabContent(activeTab, struct, columns, customFields, importHistory)}
    </div>
  `;
}

function renderTabContent(tab, struct, columns, customFields, importHistory) {
  if (tab === 'structure') {
    return `
      <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 12px 14px; display: flex; flex-direction: column; gap: 10px;">
        <!-- Compact Layout Toolbar -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 8px; flex-wrap: wrap; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <h3 style="font-size: 14px; font-weight: 700; color: #38bdf8; margin: 0; display: flex; align-items: center; gap: 6px;">
              📐 Current Layout: <span style="color: #fff; font-weight: 800;">${struct.name}</span>
            </h3>
            <span class="badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; font-size: 11px; padding: 2px 7px;">${columns.length} Columns</span>
            <span style="color: var(--text-muted); font-size: 11px;">(Drag rows to reorder &bull; Live database mapping)</span>
          </div>
          <div style="display: flex; gap: 6px;">
            <button id="btn-add-excel-column" class="btn btn-secondary btn-sm" style="font-size: 11.5px; padding: 4px 10px;">➕ Add Column</button>
            <button id="btn-save-excel-structure" class="btn btn-primary btn-sm" style="font-size: 11.5px; padding: 4px 12px;">💾 Save Layout</button>
            <button id="btn-reset-excel-structure" class="btn btn-ghost btn-sm" style="color: #94a3b8; border: 1px solid rgba(255,255,255,0.12); font-size: 11px; padding: 4px 8px;" title="Reset back to standard factory default">🔄 Reset</button>
          </div>
        </div>

        <!-- Compact Collapsible Layout Guide -->
        <div style="background: rgba(56, 189, 248, 0.05); border: 1px solid rgba(56, 189, 248, 0.18); border-radius: var(--radius-sm); padding: 6px 12px; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 6px; font-size: 11.5px; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            <span style="font-size: 13px;">💡</span>
            <strong style="color: #38bdf8;">Rules Guide:</strong>
            <span style="color: var(--text-muted);">Serial Number customizable &bull; Total Qty auto-calculated (Running+Idle) &bull; Location: Unit &rarr; Floor &rarr; Line</span>
          </div>
          <button id="btn-toggle-layout-rules" class="btn btn-ghost btn-sm" style="font-size: 11px; padding: 2px 8px; color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.25); white-space: nowrap;">
            ℹ️ View Details &darr;
          </button>
        </div>

        <!-- Collapsible Rules Details -->
        <div id="layout-rules-details" style="display: none; background: rgba(15, 23, 42, 0.65); border: 1px solid rgba(56, 189, 248, 0.15); border-radius: var(--radius-sm); padding: 8px 12px; font-size: 11px; color: var(--text-secondary); line-height: 1.5;">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 8px;">
            <div>
              &bull; <strong>Header Sequence:</strong> <code>Machine Name | Brand | Model | Serial | Unit | Floor | Line | Running | Usable Idle | Repairable Idle | Total Qty | Status | Remarks | Service Date</code><br />
              &bull; <strong>Serial Number:</strong> Unique identifier. Display name, mandatory status, default value, order, and visibility are fully customizable by Admin.<br />
              &bull; <strong>Manufacturing Specs:</strong> Optional manufacturing details, serial number, and year can be added via <code>+ Add Column</code>.
            </div>
            <div>
              &bull; <strong>Auto-Calculated Total:</strong> <code>Total Quantity = Running + Usable Idle + Repairable Idle</code> (Read-only in Excel).<br />
              &bull; <strong>Preventive Maintenance:</strong> <code>Last Service Date</code> automatically synchronizes and schedules next service (+91 Days).<br />
              &bull; <strong>Location Hierarchy:</strong> <code>Unit/Factory &rarr; Floor &rarr; Line</code> cascading dependency is strictly maintained.
            </div>
          </div>
        </div>

        <!-- Compact Excel Columns Table with Screen-Fit Width -->
        <div style="overflow-x: auto; border: 1px solid var(--border-color); border-radius: var(--radius-sm);">
          <table class="excel-grid-table table-screen-fit" id="excel-structure-table" style="width: 100% !important; min-width: 900px !important; margin: 0;">
            <thead>
              <tr style="height: 32px; background: rgba(15, 23, 42, 0.9);">
                <th style="width: 36px; text-align: center; padding: 4px;" title="Drag &amp; drop rows to reorder">⠿</th>
                <th style="width: 44px; text-align: center; padding: 4px;">Order</th>
                <th style="min-width: 180px; padding: 4px 8px;">Excel Column Header (Display Label)</th>
                <th style="width: 220px; padding: 4px 8px;">Permanent Field Key (Database Mapping)</th>
                <th style="width: 75px; text-align: center; padding: 4px;">Mandatory</th>
                <th style="width: 140px; text-align: center; padding: 4px 8px;">Default Value</th>
                <th style="width: 65px; text-align: center; padding: 4px;">Included</th>
                <th style="width: 75px; text-align: center; padding: 4px;">Reorder</th>
                <th style="width: 55px; text-align: center; padding: 4px;">Action</th>
              </tr>
            </thead>
            <tbody id="excel-structure-tbody">
              ${columns.map((col, idx) => {
                const isCalculated = col.fieldKey === 'total_quantity';
                return `
                <tr class="draggable-row" draggable="true" data-id="${col.id}" data-idx="${idx}" style="height: 34px;">
                  <td style="text-align: center; padding: 2px 4px;" class="drag-handle-cell">
                    <span class="drag-handle" title="Drag &amp; drop to reorder column position" style="cursor: grab; font-size: 13px; color: var(--text-muted);">⠿</span>
                  </td>
                  <td style="text-align: center; color: var(--text-muted); font-weight: 700; font-size: 11.5px; padding: 2px 4px;">${col.order || idx + 1}</td>
                  <td style="padding: 2px 6px;">
                    <input type="text" class="form-control col-header-input" data-id="${col.id}" value="${col.header}" style="height: 27px; padding: 2px 8px; font-weight: 600; font-size: 12px; border-radius: 4px; background: rgba(15, 23, 42, 0.5);" />
                  </td>
                  <td style="padding: 2px 6px;">
                    <code style="background: rgba(56, 189, 248, 0.1); color: #38bdf8; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 700;">
                      ${col.fieldKey || col.systemField}
                    </code>
                    ${isCalculated ? `<span class="badge badge-idle" style="font-size: 9px; margin-left: 3px; color: #38bdf8; padding: 1px 4px;">⚙️ Auto</span>` : ''}
                    ${col.fieldKey === 'machine_serial' || col.fieldKey === 'serial_number' ? `<span class="badge" style="font-size: 9px; margin-left: 3px; background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid #38bdf8; padding: 1px 4px;" title="Admin can customize header label, mandatory requirement, default value, order, or visibility">✏️ Custom</span>` : ''}
                    ${col.fieldKey === 'manufacturing' || col.fieldKey === 'manufacturing_serial' || col.fieldKey === 'manufacturing_year' ? `<span class="badge" style="font-size: 9px; margin-left: 3px; background: rgba(168, 85, 247, 0.15); color: #c084fc; border: 1px solid #a855f7; padding: 1px 4px;">🏭 Mfg</span>` : ''}
                  </td>
                  <td style="text-align: center; padding: 2px 4px;">
                    ${isCalculated ? `
                      <input type="checkbox" disabled title="Total Quantity is system-generated / read-only" style="width: 14px; height: 14px; opacity: 0.5;" />
                    ` : `
                      <input type="checkbox" class="col-req-check" data-id="${col.id}" ${col.required ? 'checked' : ''} style="width: 14px; height: 14px; cursor: pointer; accent-color: #38bdf8;" />
                    `}
                  </td>
                  <td style="padding: 2px 6px;">
                    ${isCalculated ? `
                      <input type="text" class="form-control col-def-input" data-id="${col.id}" value="— (Auto: Running+Usable+Repairable)" disabled readonly title="Total Quantity = Running + Usable Idle + Repairable Idle" style="height: 27px; padding: 2px 6px; font-size: 10.5px; text-align: center; background: rgba(56, 189, 248, 0.08); color: #38bdf8; border-color: rgba(56, 189, 248, 0.25); font-weight: 600; border-radius: 4px;" />
                    ` : `
                      <input type="text" class="form-control col-def-input" data-id="${col.id}" value="${col.defaultValue || ''}" placeholder="—" style="height: 27px; padding: 2px 6px; font-size: 11px; text-align: center; border-radius: 4px; background: rgba(15, 23, 42, 0.5);" />
                    `}
                  </td>
                  <td style="text-align: center; padding: 2px 4px;">
                    <input type="checkbox" class="col-vis-check" data-id="${col.id}" ${col.visible ? 'checked' : ''} style="width: 14px; height: 14px; cursor: pointer; accent-color: #38bdf8;" />
                  </td>
                  <td style="text-align: center; padding: 2px 4px;">
                    <div style="display: flex; gap: 3px; justify-content: center;">
                      <button class="btn btn-secondary btn-sm btn-col-up" data-id="${col.id}" ${idx === 0 ? 'disabled' : ''} title="Move Up" style="padding: 1px 5px; font-size: 9px; line-height: 1.2;">▲</button>
                      <button class="btn btn-secondary btn-sm btn-col-down" data-id="${col.id}" ${idx === columns.length - 1 ? 'disabled' : ''} title="Move Down" style="padding: 1px 5px; font-size: 9px; line-height: 1.2;">▼</button>
                    </div>
                  </td>
                  <td style="text-align: center; padding: 2px 4px;">
                    <button class="btn btn-ghost btn-sm btn-del-col" data-id="${col.id}" title="Remove Column" style="padding: 1px 5px; font-size: 11px; color: #f87171;">🗑️</button>
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

  if (tab === 'template') {
    const visibleCols = columns.filter(c => c.visible && c.fieldKey !== 'sl' && c.fieldKey !== 'sl_no');

    // Realistic garments machinery records mapped strictly to the 13 columns
    const sampleRecords = [
      {
        machine_name: 'Lock Stitch Machine',
        machine_brand: 'Juki',
        machine_model: 'DDL-8700',
        machine_serial: 'SN-10001',
        unit_factory: 'AKM Knitwear Ltd.',
        floor: 'Titas Floor',
        line: 'Line JA-A',
        running: 10,
        usable_idle: 3,
        repairable_idle: 2,
        total_quantity: 15,
        machine_status: 'ACTIVE',
        remarks: 'Lock Stitch with direct drive servo motor'
      },
      {
        machine_name: 'Lock Stitch Machine',
        machine_brand: 'Juki',
        machine_model: 'DDL-9000C',
        machine_serial: 'SN-10002',
        unit_factory: 'AKM Knitwear Ltd.',
        floor: 'Titas Floor',
        line: 'Line JA-A',
        running: 8,
        usable_idle: 2,
        repairable_idle: 1,
        total_quantity: 11,
        machine_status: 'ACTIVE',
        remarks: 'Auto thread trimming & digital tension'
      },
      {
        machine_name: 'Overlock Machine',
        machine_brand: 'Pegasus',
        machine_model: 'M-700 Series',
        machine_serial: 'SN-10003',
        unit_factory: 'AKM Knitwear Ltd.',
        floor: 'Teesta Floor',
        line: 'Line JAF-A',
        running: 12,
        usable_idle: 0,
        repairable_idle: 1,
        total_quantity: 13,
        machine_status: 'ACTIVE',
        remarks: '4-thread overedge differential feed'
      },
      {
        machine_name: 'Flatlock Machine',
        machine_brand: 'Kansai',
        machine_model: 'WX-8803',
        machine_serial: 'SN-10004',
        unit_factory: 'AKM Knitwear Ltd.',
        floor: 'Jamuna Floor',
        line: 'Line JAF-C',
        running: 5,
        usable_idle: 1,
        repairable_idle: 0,
        total_quantity: 6,
        machine_status: 'ACTIVE',
        remarks: 'Cylinder bed bottom hemming & coverstitch'
      },
      {
        machine_name: 'Button Hole Machine',
        machine_brand: 'Brother',
        machine_model: 'HE-800B Electronic',
        machine_serial: 'SN-10005',
        unit_factory: 'AKM Knitwear Ltd.',
        floor: 'Jamuna Floor',
        line: 'Line JA-B',
        running: 4,
        usable_idle: 1,
        repairable_idle: 1,
        total_quantity: 6,
        machine_status: 'ACTIVE',
        remarks: 'Electronic lockstitch buttonhole'
      }
    ];

    return `
      <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 12px 14px; display: flex; flex-direction: column; gap: 10px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
          <div>
            <h3 style="font-size: 14px; font-weight: 700; color: #34d399; margin: 0;">👁️ Single-Sheet Machine Inventory Template Structure &amp; Live Preview</h3>
            <p style="font-size: 11.5px; color: var(--text-secondary); margin: 2px 0 0 0;">
              All machines across all categories are entered into the single <strong>Machine Inventory</strong> sheet. <strong>Total Quantity</strong> is automatically calculated.
            </p>
          </div>
          <button id="btn-preview-download-template" class="btn btn-success btn-sm" style="font-size: 11.5px; padding: 4px 10px;">
            📥 Download Template (.xlsx)
          </button>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 8px;">
          <div style="background: var(--bg-card); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: var(--radius-sm); padding: 8px 12px;">
            <div style="font-size: 12.5px; font-weight: 800; color: #38bdf8;">📄 Sheet 1: Machine Inventory (Main Data)</div>
            <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">
              Enter all machine records in this single sheet. Row-by-row validation &amp; partial bulk import supported.
            </div>
          </div>
          <div style="background: var(--bg-card); border: 1px solid rgba(192, 132, 252, 0.3); border-radius: var(--radius-sm); padding: 8px 12px;">
            <div style="font-size: 12.5px; font-weight: 800; color: #c084fc;">📋 Sheet 2: Master Reference (Lookups)</div>
            <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">
              Admin reference guidelines for Location Hierarchy (Unit &rarr; Floor &rarr; Line), Brands, Models, and Status Codes.
            </div>
          </div>
        </div>

        <!-- Dynamic Live Preview Grid -->
        <div style="overflow-x: auto; border: 1px solid var(--border-color); border-radius: var(--radius-sm);">
          <table class="excel-grid-table table-screen-fit" style="width: 100% !important; margin: 0;">
            <thead>
              <tr style="height: 30px;">
                ${visibleCols.map(c => `<th style="padding: 4px 8px; font-size: 12px;">${c.header}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${sampleRecords.map((rec, idx) => `
                <tr style="height: 32px;">
                  ${visibleCols.map(col => {
                    const val = excelService.getFieldValue(rec, col.fieldKey || col.systemField, idx);
                    if (col.fieldKey === 'machine_serial') {
                      return `<td style="font-family: var(--font-mono); color: #38bdf8; font-weight: 700; padding: 3px 8px; font-size: 11.5px;">${val}</td>`;
                    }
                    if (col.fieldKey === 'machine_status') {
                      return `<td style="text-align: center; padding: 3px 6px;"><span class="badge badge-active" style="font-size: 10px; padding: 2px 6px;">${val}</span></td>`;
                    }
                    if (col.fieldKey === 'running' || col.fieldKey === 'usable_idle' || col.fieldKey === 'repairable_idle') {
                      return `<td style="text-align: center; font-weight: 600; padding: 3px 6px; font-size: 11.5px;">${val}</td>`;
                    }
                    if (col.fieldKey === 'total_quantity' || col.fieldKey === 'quantity') {
                      return `<td style="text-align: center; font-weight: 800; color: #34d399; background: rgba(52, 211, 153, 0.1); padding: 3px 6px; font-size: 11.5px;">${val}</td>`;
                    }
                    return `<td style="padding: 3px 8px; font-size: 12px;">${val}</td>`;
                  }).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  if (tab === 'history') {
    return `
      <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); overflow: hidden; box-shadow: var(--shadow-sm);">
        <table class="excel-grid-table table-screen-fit" style="width: 100% !important; margin: 0;">
          <thead>
            <tr style="height: 32px;">
              <th style="width: 160px; padding: 4px 8px;">Import Date &amp; Time</th>
              <th style="padding: 4px 8px;">Spreadsheet File</th>
              <th style="padding: 4px 8px;">Imported By</th>
              <th style="padding: 4px 8px;">Mode</th>
              <th style="text-align: center; padding: 4px 8px;">Total Rows</th>
              <th style="text-align: center; color: #34d399; padding: 4px 8px;">Created</th>
              <th style="text-align: center; color: #c084fc; padding: 4px 8px;">Updated</th>
              <th style="text-align: center; color: #f87171; padding: 4px 8px;">Failed</th>
              <th style="text-align: center; padding: 4px 8px;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${importHistory.length === 0 ? `
              <tr><td colspan="9" style="text-align: center; color: var(--text-muted); padding: 24px;">No bulk import logs recorded yet.</td></tr>
            ` : importHistory.map(h => `
              <tr style="height: 34px;">
                <td style="font-family: var(--font-mono); font-size: 11px; color: var(--text-muted); padding: 4px 8px;">${new Date(h.importedAt).toLocaleString()}</td>
                <td style="padding: 4px 8px;">
                  <div style="font-weight: 700; color: #fff; font-size: 12px;">📊 ${h.fileName}</div>
                  ${h.sheetStats ? `<div style="font-size: 10px; color: var(--text-secondary);">${h.sheetStats.length} Sheet(s) processed</div>` : ''}
                </td>
                <td style="color: #38bdf8; font-weight: 600; font-size: 12px; padding: 4px 8px;">${h.importedBy}</td>
                <td style="padding: 4px 8px;"><span class="badge badge-idle" style="font-size: 10px;">${(h.mode || 'INSERT').replace(/_/g, ' ')}</span></td>
                <td style="text-align: center; font-weight: 700; font-size: 12px; padding: 4px 8px;">${h.totalRows || h.validRows || 0}</td>
                <td style="text-align: center; color: #34d399; font-weight: 700; font-size: 12px; padding: 4px 8px;">${h.insertedRows || 0}</td>
                <td style="text-align: center; color: #c084fc; font-weight: 700; font-size: 12px; padding: 4px 8px;">${h.updatedRows || 0}</td>
                <td style="text-align: center; color: ${h.failedRows > 0 ? '#f87171' : 'var(--text-muted)'}; font-weight: 700; font-size: 12px; padding: 4px 8px;">${h.failedRows || 0}</td>
                <td style="text-align: center; padding: 4px 8px;">
                  <span class="badge ${h.status === 'SUCCESS' ? 'badge-active' : (h.status === 'PARTIAL_SUCCESS' ? 'badge-maint' : 'badge-breakdown')}" style="font-size: 10.5px;">
                    ${h.status || 'COMPLETED'}
                  </span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  return '';
}

export function initExcelManagerEvents() {
  document.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      activeTab = btn.getAttribute('data-tab');
      const view = document.getElementById('main-view-container');
      if (view) {
        view.innerHTML = renderExcelManagerView();
        initExcelManagerEvents();
      }
    });
  });

  const btnToggleRules = document.getElementById('btn-toggle-layout-rules');
  const rulesDetails = document.getElementById('layout-rules-details');
  if (btnToggleRules && rulesDetails) {
    btnToggleRules.addEventListener('click', () => {
      const isHidden = rulesDetails.style.display === 'none';
      rulesDetails.style.display = isHidden ? 'block' : 'none';
      btnToggleRules.innerHTML = isHidden ? 'ℹ️ Hide Details &uarr;' : 'ℹ️ View Details &darr;';
    });
  }

  const btnDownload = document.getElementById('btn-mgr-download-template');
  if (btnDownload) {
    btnDownload.addEventListener('click', async () => {
      try {
        await excelService.generateTemplate();
      } catch (err) {
        alert('Failed to generate template: ' + err.message);
      }
    });
  }

  const btnPrevDownload = document.getElementById('btn-preview-download-template');
  if (btnPrevDownload) {
    btnPrevDownload.addEventListener('click', async () => {
      try {
        await excelService.generateTemplate();
      } catch (err) {
        alert('Failed to generate template: ' + err.message);
      }
    });
  }

  const btnLaunch = document.getElementById('btn-mgr-launch-import');
  if (btnLaunch) {
    btnLaunch.addEventListener('click', () => {
      state.set('activeModal', 'import-excel');
    });
  }

  // Helper to persist current in-memory edits before reordering
  const syncInputsToActiveStruct = () => {
    const struct = excelService.getActiveStructure();
    document.querySelectorAll('.col-header-input').forEach(inp => {
      const id = inp.getAttribute('data-id');
      const col = (struct.columns || []).find(c => c.id === id);
      if (col) col.header = inp.value.trim();
    });
    document.querySelectorAll('.col-def-input').forEach(inp => {
      const id = inp.getAttribute('data-id');
      const col = (struct.columns || []).find(c => c.id === id);
      if (col) col.defaultValue = inp.value.trim();
    });
    document.querySelectorAll('.col-req-check').forEach(chk => {
      const id = chk.getAttribute('data-id');
      const col = (struct.columns || []).find(c => c.id === id);
      if (col) col.required = chk.checked;
    });
    document.querySelectorAll('.col-vis-check').forEach(chk => {
      const id = chk.getAttribute('data-id');
      const col = (struct.columns || []).find(c => c.id === id);
      if (col) col.visible = chk.checked;
    });
    excelService.saveStructure(struct);
  };

  const refreshStructureView = () => {
    const view = document.getElementById('main-view-container');
    if (view) {
      view.innerHTML = renderExcelManagerView();
      initExcelManagerEvents();
    }
  };

  // HTML5 Drag and Drop Row Reordering Engine
  const dragRows = document.querySelectorAll('#excel-structure-tbody .draggable-row');
  let draggedRow = null;
  let draggedId = null;

  dragRows.forEach(row => {
    row.addEventListener('dragstart', (e) => {
      draggedRow = row;
      draggedId = row.getAttribute('data-id');
      row.classList.add('is-dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', draggedId);
    });

    row.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (!draggedRow || draggedRow === row) return;

      const rect = row.getBoundingClientRect();
      const midPoint = rect.top + rect.height / 2;
      if (e.clientY < midPoint) {
        row.classList.add('drag-over-top');
        row.classList.remove('drag-over-bottom');
      } else {
        row.classList.add('drag-over-bottom');
        row.classList.remove('drag-over-top');
      }
    });

    row.addEventListener('dragleave', () => {
      row.classList.remove('drag-over-top', 'drag-over-bottom');
    });

    row.addEventListener('drop', (e) => {
      e.preventDefault();
      row.classList.remove('drag-over-top', 'drag-over-bottom');
      if (!draggedRow || draggedRow === row) return;

      const sourceId = draggedId || e.dataTransfer.getData('text/plain');
      const targetId = row.getAttribute('data-id');
      if (!sourceId || !targetId || sourceId === targetId) return;

      syncInputsToActiveStruct();

      const struct = excelService.getActiveStructure();
      const cols = [...(struct.columns || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
      const sourceIndex = cols.findIndex(c => c.id === sourceId);
      const targetIndex = cols.findIndex(c => c.id === targetId);

      if (sourceIndex !== -1 && targetIndex !== -1) {
        const [movedCol] = cols.splice(sourceIndex, 1);
        
        const rect = row.getBoundingClientRect();
        const midPoint = rect.top + rect.height / 2;
        const insertAfter = e.clientY >= midPoint;

        let newTargetIndex = cols.findIndex(c => c.id === targetId);
        if (insertAfter) {
          newTargetIndex += 1;
        }

        cols.splice(newTargetIndex, 0, movedCol);

        excelService.reorderColumns(struct.id, cols.map(c => c.id));
        state.emit('inventory:updated');
        refreshStructureView();
      }
    });

    row.addEventListener('dragend', () => {
      dragRows.forEach(r => r.classList.remove('is-dragging', 'drag-over-top', 'drag-over-bottom'));
      draggedRow = null;
      draggedId = null;
    });
  });

  // Column Reorder (Up / Down)
  document.querySelectorAll('.btn-col-up').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      syncInputsToActiveStruct();
      const id = btn.getAttribute('data-id');
      const struct = excelService.getActiveStructure();
      const cols = [...(struct.columns || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
      const idx = cols.findIndex(c => c.id === id);
      if (idx > 0) {
        const temp = cols[idx];
        cols[idx] = cols[idx - 1];
        cols[idx - 1] = temp;
        excelService.reorderColumns(struct.id, cols.map(c => c.id));
        refreshStructureView();
      }
    });
  });

  document.querySelectorAll('.btn-col-down').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      syncInputsToActiveStruct();
      const id = btn.getAttribute('data-id');
      const struct = excelService.getActiveStructure();
      const cols = [...(struct.columns || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
      const idx = cols.findIndex(c => c.id === id);
      if (idx < cols.length - 1) {
        const temp = cols[idx];
        cols[idx] = cols[idx + 1];
        cols[idx + 1] = temp;
        excelService.reorderColumns(struct.id, cols.map(c => c.id));
        refreshStructureView();
      }
    });
  });

  // Save Column Headers, Default Values, Required & Visibility Changes
  const btnSave = document.getElementById('btn-save-excel-structure');
  if (btnSave) {
    btnSave.addEventListener('click', () => {
      try {
        const struct = excelService.getActiveStructure();
        document.querySelectorAll('.col-header-input').forEach(inp => {
          const id = inp.getAttribute('data-id');
          const col = (struct.columns || []).find(c => c.id === id);
          if (col) col.header = inp.value.trim();
        });

        document.querySelectorAll('.col-def-input').forEach(inp => {
          const id = inp.getAttribute('data-id');
          const col = (struct.columns || []).find(c => c.id === id);
          if (col) col.defaultValue = inp.value.trim();
        });

        document.querySelectorAll('.col-req-check').forEach(chk => {
          const id = chk.getAttribute('data-id');
          const col = (struct.columns || []).find(c => c.id === id);
          if (col) col.required = chk.checked;
        });

        document.querySelectorAll('.col-vis-check').forEach(chk => {
          const id = chk.getAttribute('data-id');
          const col = (struct.columns || []).find(c => c.id === id);
          if (col) col.visible = chk.checked;
        });

        excelService.saveStructure(struct);
        alert('Excel column structure layout saved successfully.');
        state.emit('inventory:updated');
      } catch (err) {
        alert('Validation Error: ' + err.message);
      }
    });
  }

  // Reset Structure back to standard default
  const btnReset = document.getElementById('btn-reset-excel-structure');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      if (confirm('Reset Excel layout back to standard factory default? Any custom columns will be restored to default.')) {
        excelService.resetToDefaultStructure();
        refreshStructureView();
      }
    });
  }

  // Add Column with Preset or Custom Field Key
  const btnAddCol = document.getElementById('btn-add-excel-column');
  if (btnAddCol) {
    btnAddCol.addEventListener('click', () => {
      openAddExcelColumnModal();
    });
  }

  // Remove Column
  document.querySelectorAll('.btn-del-col').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      if (confirm('Remove this column from the Excel layout?')) {
        const struct = excelService.getActiveStructure();
        struct.columns = (struct.columns || []).filter(c => c.id !== id);
        excelService.saveStructure(struct);
        state.emit('inventory:updated');
        refreshStructureView();
      }
    });
  });
}

function openAddExcelColumnModal() {
  const customFields = customFieldService.getAllFields();
  const presets = [
    { key: 'machine_name', header: 'Machine Name', required: true, def: '', desc: 'Machine Classification / Type' },
    { key: 'machine_brand', header: 'Machine Brand', required: true, def: '', desc: 'Brand / Manufacturer' },
    { key: 'machine_model', header: 'Machine Model', required: true, def: '', desc: 'Machine Model' },
    { key: 'machine_serial', header: 'Serial Number', required: false, def: '', desc: 'Machine Serial Number (Admin Customizable)' },
    { key: 'manufacturing', header: 'Manufacturing', required: false, def: '', desc: 'Machine Manufacturing Specification' },
    { key: 'manufacturing_serial', header: 'Manufacturing Serial Number', required: false, def: '', desc: 'Manufacturer / Engraved Serial No' },
    { key: 'manufacturing_year', header: 'Manufacturing Year', required: false, def: '', desc: 'Year / Date of Manufacture (e.g. 2023)' },
    { key: 'unit_factory', header: 'Unit/Factory', required: true, def: 'AKM Knitwear Ltd.', desc: 'Unit / Factory Location' },
    { key: 'floor', header: 'Floor', required: true, def: '3rd Floor', desc: 'Floor Location' },
    { key: 'line', header: 'Line', required: true, def: 'Line JA-A', desc: 'Section / Sewing Line' },
    { key: 'running', header: 'Running', required: false, def: '1', desc: 'Operational Machines Count' },
    { key: 'usable_idle', header: 'Usable Idle', required: false, def: '0', desc: 'Ready-to-use Idle Count' },
    { key: 'repairable_idle', header: 'Repairable Idle', required: false, def: '0', desc: 'Under Maintenance/Repair Count' },
    { key: 'total_quantity', header: 'Total Quantity', required: false, def: '— (Auto-Calculated)', desc: 'Auto-Calculated Total (Running + Usable Idle + Repairable Idle)' },
    { key: 'machine_status', header: 'Machine Status', required: false, def: 'ACTIVE', desc: 'Machine Status' },
    { key: 'service_date', header: 'Last Service Date', required: false, def: '', desc: 'Preventive Maintenance Service Date' },
    { key: 'country_of_origin', header: 'Country of Origin (Made in)', required: false, def: '', desc: 'Country / Place of Manufacture' },
    { key: 'supplier_name', header: 'Supplier Name', required: false, def: '', desc: 'Machine Supplier / Vendor' },
    { key: 'purchase_date', header: 'Purchase Date', required: false, def: '', desc: 'Equipment Purchase Date' },
    { key: 'remarks', header: 'Remarks', required: false, def: '', desc: 'Remarks & Notes' },
    ...customFields.map(cf => ({
      key: `cf_${cf.code}`,
      header: cf.label,
      required: !!cf.required,
      def: '',
      desc: `Custom Field: ${cf.label}`
    }))
  ];

  const modalHtml = `
    <div class="modal-overlay" id="modal-add-excel-col-overlay" style="z-index: 1050;">
      <div class="modal-dialog" style="max-width: 520px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-lg);">
        <div class="modal-header" style="background: var(--bg-surface); padding: 14px 20px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
          <h3 style="font-size: 15px; font-weight: 700; color: #fff; margin: 0;">➕ Add Excel Column</h3>
          <button id="btn-close-add-col-modal" class="btn btn-ghost btn-sm" style="font-size: 16px;">✕</button>
        </div>

        <div class="modal-body" style="padding: 20px; display: flex; flex-direction: column; gap: 14px;">
          <div class="form-group">
            <label class="form-label" style="font-size: 12px; font-weight: 700;">Select Predefined Machine Field or Custom:</label>
            <select id="modal-select-field-preset" class="form-control" style="font-size: 12px; font-weight: 600;">
              <option value="__custom__">-- Custom Field Key --</option>
              ${presets.map(p => `
                <option value="${p.key}" data-header="${p.header}" data-req="${p.required ? 'true' : 'false'}" data-def="${p.def}">
                  ${p.header} &bull; (${p.key}) ${p.required ? '[Required]' : '[Optional]'}
                </option>
              `).join('')}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label" style="font-size: 12px; font-weight: 700;">Excel Column Header (Display Name):</label>
            <input type="text" id="modal-inp-col-header" class="form-control" placeholder="e.g. Machine Category, Voltage" />
          </div>

          <div class="form-group">
            <label class="form-label" style="font-size: 12px; font-weight: 700;">Permanent Internal Field Key:</label>
            <input type="text" id="modal-inp-col-key" class="form-control" placeholder="e.g. machine_category, cf_voltage" />
            <div style="font-size: 10.5px; color: var(--text-muted); margin-top: 3px;">Unique internal identifier for database binding (lowercase, alphanumeric, underscores).</div>
          </div>

          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label" style="font-size: 12px; font-weight: 700;">Default Value (Optional):</label>
              <input type="text" id="modal-inp-col-def" class="form-control" placeholder="e.g. ACTIVE, 220V" />
            </div>
            <div class="form-group" style="display: flex; align-items: center; gap: 8px; margin-top: 24px;">
              <input type="checkbox" id="modal-chk-col-req" style="width: 16px; height: 16px;" />
              <label for="modal-chk-col-req" style="font-size: 12px; font-weight: 700; color: #fbbf24; cursor: pointer;">Is Mandatory (Required)?</label>
            </div>
          </div>
        </div>

        <div class="modal-footer" style="background: var(--bg-surface); padding: 12px 20px; border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end; gap: 10px;">
          <button id="btn-cancel-add-col" class="btn btn-secondary btn-sm">Cancel</button>
          <button id="btn-confirm-add-col" class="btn btn-primary btn-sm">➕ Add to Structure</button>
        </div>
      </div>
    </div>
  `;

  const existingOverlay = document.getElementById('modal-add-excel-col-overlay');
  if (existingOverlay) existingOverlay.remove();

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  const selPreset = document.getElementById('modal-select-field-preset');
  const inpHdr = document.getElementById('modal-inp-col-header');
  const inpKey = document.getElementById('modal-inp-col-key');
  const inpDef = document.getElementById('modal-inp-col-def');
  const chkReq = document.getElementById('modal-chk-col-req');

  selPreset.addEventListener('change', () => {
    const val = selPreset.value;
    if (val !== '__custom__') {
      const opt = selPreset.selectedOptions[0];
      inpHdr.value = opt.getAttribute('data-header') || '';
      inpKey.value = val;
      chkReq.checked = opt.getAttribute('data-req') === 'true';
      inpDef.value = opt.getAttribute('data-def') || '';
    }
  });

  const closeModal = () => {
    const el = document.getElementById('modal-add-excel-col-overlay');
    if (el) el.remove();
  };

  document.getElementById('btn-close-add-col-modal').addEventListener('click', closeModal);
  document.getElementById('btn-cancel-add-col').addEventListener('click', closeModal);

  document.getElementById('btn-confirm-add-col').addEventListener('click', () => {
    const header = inpHdr.value.trim();
    let fieldKey = inpKey.value.trim().toLowerCase();
    const defaultValue = inpDef.value.trim();
    const required = chkReq.checked;

    if (!header) {
      alert('Please enter a column header name.');
      return;
    }
    if (!fieldKey) {
      fieldKey = header.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    }

    if (fieldKey === 'sl' || fieldKey === 'sl_no') {
      alert('Sl. No. is automatically generated by the software and should not be added as an Excel column.');
      return;
    }

    try {
      const struct = excelService.getActiveStructure();
      if ((struct.columns || []).some(c => c.fieldKey === fieldKey)) {
        alert(`A column with field key '${fieldKey}' already exists in your layout. You can customize its display label, mandatory rule, or position directly in the table.`);
        return;
      }

      struct.columns.push({
        id: `col-${Date.now()}`,
        header: header,
        fieldKey: fieldKey,
        defaultValue: defaultValue,
        required: required,
        order: (struct.columns || []).length + 1,
        visible: true
      });

      excelService.saveStructure(struct);
      closeModal();
      const view = document.getElementById('main-view-container');
      if (view) {
        view.innerHTML = renderExcelManagerView();
        initExcelManagerEvents();
      }
      state.emit('inventory:updated');
    } catch (err) {
      alert('Error: ' + err.message);
    }
  });
}

