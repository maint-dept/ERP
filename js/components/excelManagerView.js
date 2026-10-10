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
    <div class="page-view">
      <!-- Title Bar -->
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
        <div>
          <h1 style="font-size: 22px; font-weight: 800; color: #fff;">📊 Admin Excel Structure &amp; Data Management</h1>
          <p style="font-size: 12.5px; color: var(--text-secondary);">
            Design custom Excel layouts, configure field mappings, download dynamic multi-sheet templates, and inspect bulk import history.
          </p>
        </div>

        <div style="display: flex; gap: 10px;">
          <button id="btn-mgr-download-template" class="btn btn-success">📋 Download Live Template (.xlsx)</button>
          <button id="btn-mgr-launch-import" class="btn btn-primary">📥 Launch Import Wizard</button>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div style="display: flex; gap: 8px; border-bottom: 2px solid var(--border-color); padding-bottom: 8px; flex-wrap: wrap;">
        <button class="btn ${activeTab === 'structure' ? 'btn-primary' : 'btn-ghost'}" data-tab="structure" style="font-size: 13px; font-weight: 700; padding: 7px 16px;">
          📐 1. Excel Structure Builder
        </button>
        <button class="btn ${activeTab === 'template' ? 'btn-primary' : 'btn-ghost'}" data-tab="template" style="font-size: 13px; font-weight: 700; padding: 7px 16px;">
          👁️ 2. Template Preview
        </button>
        <button class="btn ${activeTab === 'history' ? 'btn-primary' : 'btn-ghost'}" data-tab="history" style="font-size: 13px; font-weight: 700; padding: 7px 16px;">
          📜 3. Import &amp; Bulk Update History (${importHistory.length})
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
      <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 20px; display: flex; flex-direction: column; gap: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 10px; flex-wrap: wrap; gap: 10px;">
          <div>
            <h3 style="font-size: 16px; font-weight: 700; color: #38bdf8;">Current Layout: ${struct.name}</h3>
            <p style="font-size: 11.5px; color: var(--text-muted);">
              Move columns up or down to reorder them in generated templates, preview, and export files. Data mapping is tied to permanent field keys.
            </p>
          </div>
          <div style="display: flex; gap: 8px;">
            <button id="btn-add-excel-column" class="btn btn-secondary btn-sm">➕ Add Column</button>
            <button id="btn-save-excel-structure" class="btn btn-primary btn-sm">💾 Save Layout</button>
          </div>
        </div>

        <div style="background: rgba(56, 189, 248, 0.08); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: var(--radius-md); padding: 12px 16px; display: flex; align-items: flex-start; gap: 12px;">
          <span style="font-size: 20px; line-height: 1;">💡</span>
          <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.5;">
            <strong style="color: #38bdf8;">Standard 14-Column Structure &amp; Business Rules:</strong><br />
            &bull; <strong>Header Sequence:</strong> <code>Machine Name | Machine Brand | Machine Model | Machine Serial | Unit/Factory | Floor | Line | Running | Usable Idle | Repairable Idle | Total Quantity | Machine Status | Remarks | Last Service Date</code><br />
            &bull; <strong>Auto-Calculated Total Quantity:</strong> <code>Total Quantity = Running + Usable Idle + Repairable Idle</code> (System-generated / Read-only in Excel).<br />
            &bull; <strong>Preventive Maintenance Auto-Sync:</strong> Entering <code>Last Service Date</code> automatically synchronizes records to Preventive Maintenance and schedules the next service (+91 Days).<br />
            &bull; <strong>Location Hierarchy:</strong> <code>Unit/Factory &rarr; Floor &rarr; Line</code> cascading dependency is strictly maintained.<br />
            &bull; <strong>Machine Serial:</strong> Unique machine identifier. (If auto-generated in software, manual Excel entry is optional).
          </div>
        </div>

        <!-- Excel Columns List Table with Drag & Drop Reordering -->
        <div style="overflow-x: auto;">
          <table class="excel-grid-table" id="excel-structure-table">
            <thead>
              <tr>
                <th style="width: 44px; text-align: center;" title="Drag &amp; drop rows to reorder">⠿</th>
                <th style="width: 50px; text-align: center;">Order</th>
                <th>Excel Column Header (Display Label)</th>
                <th>Permanent Field Key (Database Mapping)</th>
                <th style="text-align: center; width: 90px;">Mandatory</th>
                <th style="text-align: center; width: 140px;">Default Value</th>
                <th style="text-align: center; width: 80px;">Included</th>
                <th style="width: 110px; text-align: center;">Reorder</th>
                <th style="width: 70px; text-align: center;">Actions</th>
              </tr>
            </thead>
            <tbody id="excel-structure-tbody">
              ${columns.map((col, idx) => {
                const isCalculated = col.fieldKey === 'total_quantity';
                return `
                <tr class="draggable-row" draggable="true" data-id="${col.id}" data-idx="${idx}">
                  <td style="text-align: center;" class="drag-handle-cell">
                    <span class="drag-handle" title="Drag &amp; drop to reorder column position">⠿</span>
                  </td>
                  <td style="text-align: center; color: var(--text-muted); font-weight: 700;">${col.order || idx + 1}</td>
                  <td>
                    <input type="text" class="form-control col-header-input" data-id="${col.id}" value="${col.header}" style="padding: 4px 8px; font-weight: 600; font-size: 12.5px;" />
                  </td>
                  <td>
                    <code style="background: rgba(56, 189, 248, 0.1); color: #38bdf8; padding: 2px 6px; border-radius: 4px; font-size: 11.5px; font-weight: 700;">
                      ${col.fieldKey || col.systemField}
                    </code>
                    ${isCalculated ? `<span class="badge badge-idle" style="font-size: 10px; margin-left: 4px; color: #38bdf8;">⚙️ Auto-Calculated</span>` : ''}
                  </td>
                  <td style="text-align: center;">
                    ${isCalculated ? `
                      <input type="checkbox" disabled title="Total Quantity is system-generated / read-only" />
                    ` : `
                      <input type="checkbox" class="col-req-check" data-id="${col.id}" ${col.required ? 'checked' : ''} />
                    `}
                  </td>
                  <td>
                    ${isCalculated ? `
                      <input type="text" class="form-control col-def-input" data-id="${col.id}" value="— (= Running + Usable Idle + Repairable Idle)" disabled readonly title="Total Quantity = Running + Usable Idle + Repairable Idle" style="padding: 3px 6px; font-size: 11px; text-align: center; background: rgba(56, 189, 248, 0.08); color: #38bdf8; border-color: rgba(56, 189, 248, 0.3); font-weight: 600;" />
                    ` : `
                      <input type="text" class="form-control col-def-input" data-id="${col.id}" value="${col.defaultValue || ''}" placeholder="—" style="padding: 3px 6px; font-size: 11.5px; text-align: center;" />
                    `}
                  </td>
                  <td style="text-align: center;">
                    <input type="checkbox" class="col-vis-check" data-id="${col.id}" ${col.visible ? 'checked' : ''} />
                  </td>
                  <td style="text-align: center;">
                    <div style="display: flex; gap: 4px; justify-content: center;">
                      <button class="btn btn-secondary btn-sm btn-col-up" data-id="${col.id}" ${idx === 0 ? 'disabled' : ''} title="Move Up">▲</button>
                      <button class="btn btn-secondary btn-sm btn-col-down" data-id="${col.id}" ${idx === columns.length - 1 ? 'disabled' : ''} title="Move Down">▼</button>
                    </div>
                  </td>
                  <td style="text-align: center;">
                    <button class="btn btn-ghost btn-sm btn-del-col" data-id="${col.id}" title="Remove Column">🗑️</button>
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
      <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 20px; display: flex; flex-direction: column; gap: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
          <div>
            <h3 style="font-size: 16px; font-weight: 700; color: #34d399;">Single-Sheet Machine Inventory Template Structure &amp; Live Preview</h3>
            <p style="font-size: 12px; color: var(--text-secondary);">
              All machines across all categories are entered into the single <strong>Machine Inventory</strong> sheet with unlimited rows. <strong>Total Quantity = Running + Usable Idle + Repairable Idle</strong> is automatically calculated.
            </p>
          </div>
          <button id="btn-preview-download-template" class="btn btn-success">
            📥 Download Official Template (.xlsx)
          </button>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; margin-bottom: 6px;">
          <div style="background: var(--bg-card); border: 1.5px solid rgba(56, 189, 248, 0.4); border-radius: var(--radius-md); padding: 14px;">
            <div style="font-size: 14px; font-weight: 800; color: #38bdf8;">📄 Sheet 1: Machine Inventory (Main Data Sheet)</div>
            <div style="font-size: 11.5px; color: var(--text-secondary); margin-top: 4px;">
              Enter all machine records (Plain Sewing, Overlock, Flatlock, Heavy &amp; Special, etc.) in this single sheet. Supports unlimited rows with row-by-row validation &amp; partial import.
            </div>
          </div>
          <div style="background: var(--bg-card); border: 1.5px solid rgba(192, 132, 252, 0.4); border-radius: var(--radius-md); padding: 14px;">
            <div style="font-size: 14px; font-weight: 800; color: #c084fc;">📋 Sheet 2: Master Data Reference (Lookup Sheet)</div>
            <div style="font-size: 11.5px; color: var(--text-secondary); margin-top: 4px;">
              Admin reference guidelines for Location Hierarchy (Unit/Factory &rarr; Floor &rarr; Line), Machine Brands, Models, and Valid Status Codes.
            </div>
          </div>
        </div>

        <!-- Dynamic Live Preview Grid -->
        <div style="overflow-x: auto; border: 1px solid var(--border-color); border-radius: var(--radius-md);">
          <table class="excel-grid-table" style="margin: 0;">
            <thead>
              <tr>
                ${visibleCols.map(c => `<th>${c.header}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${sampleRecords.map((rec, idx) => `
                <tr>
                  ${visibleCols.map(col => {
                    const val = excelService.getFieldValue(rec, col.fieldKey || col.systemField, idx);
                    if (col.fieldKey === 'machine_serial') {
                      return `<td style="font-family: var(--font-mono); color: #38bdf8; font-weight: 700;">${val}</td>`;
                    }
                    if (col.fieldKey === 'machine_status') {
                      return `<td style="text-align: center;"><span class="badge badge-active">${val}</span></td>`;
                    }
                    if (col.fieldKey === 'running' || col.fieldKey === 'usable_idle' || col.fieldKey === 'repairable_idle') {
                      return `<td style="text-align: center; font-weight: 600;">${val}</td>`;
                    }
                    if (col.fieldKey === 'total_quantity' || col.fieldKey === 'quantity') {
                      return `<td style="text-align: center; font-weight: 800; color: #34d399; background: rgba(52, 211, 153, 0.1);">${val}</td>`;
                    }
                    return `<td>${val}</td>`;
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
      <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-sm);">
        <table class="excel-grid-table">
          <thead>
            <tr>
              <th style="width: 160px;">Import Date &amp; Time</th>
              <th>Spreadsheet File</th>
              <th>Imported By</th>
              <th>Mode</th>
              <th style="text-align: center;">Total Rows</th>
              <th style="text-align: center; color: #34d399;">Created</th>
              <th style="text-align: center; color: #c084fc;">Updated</th>
              <th style="text-align: center; color: #f87171;">Failed</th>
              <th style="text-align: center;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${importHistory.length === 0 ? `
              <tr><td colspan="9" style="text-align: center; color: var(--text-muted); padding: 30px;">No bulk import logs recorded yet.</td></tr>
            ` : importHistory.map(h => `
              <tr>
                <td style="font-family: var(--font-mono); font-size: 11.5px; color: var(--text-muted);">${new Date(h.importedAt).toLocaleString()}</td>
                <td>
                  <div style="font-weight: 700; color: #fff;">📊 ${h.fileName}</div>
                  ${h.sheetStats ? `<div style="font-size: 10.5px; color: var(--text-secondary);">${h.sheetStats.length} Sheet(s) processed</div>` : ''}
                </td>
                <td style="color: #38bdf8; font-weight: 600;">${h.importedBy}</td>
                <td><span class="badge badge-idle">${(h.mode || 'INSERT').replace(/_/g, ' ')}</span></td>
                <td style="text-align: center; font-weight: 700;">${h.totalRows || h.validRows || 0}</td>
                <td style="text-align: center; color: #34d399; font-weight: 700;">${h.insertedRows || 0}</td>
                <td style="text-align: center; color: #c084fc; font-weight: 700;">${h.updatedRows || 0}</td>
                <td style="text-align: center; color: ${h.failedRows > 0 ? '#f87171' : 'var(--text-muted)'}; font-weight: 700;">${h.failedRows || 0}</td>
                <td style="text-align: center;">
                  <span class="badge ${h.status === 'SUCCESS' ? 'badge-active' : (h.status === 'PARTIAL_SUCCESS' ? 'badge-maint' : 'badge-breakdown')}">
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
    { key: 'machine_serial', header: 'Machine Serial', required: false, def: '', desc: 'Unique Machine Identifier' },
    { key: 'unit_factory', header: 'Unit/Factory', required: true, def: 'AKM Knitwear Ltd.', desc: 'Unit / Factory Location' },
    { key: 'floor', header: 'Floor', required: true, def: '3rd Floor', desc: 'Floor Location' },
    { key: 'line', header: 'Line', required: true, def: 'Line JA-A', desc: 'Section / Sewing Line' },
    { key: 'running', header: 'Running', required: false, def: '1', desc: 'Operational Machines Count' },
    { key: 'usable_idle', header: 'Usable Idle', required: false, def: '0', desc: 'Ready-to-use Idle Count' },
    { key: 'repairable_idle', header: 'Repairable Idle', required: false, def: '0', desc: 'Under Maintenance/Repair Count' },
    { key: 'total_quantity', header: 'Total Quantity', required: false, def: '— (Auto-Calculated)', desc: 'Auto-Calculated Total (Running + Usable Idle + Repairable Idle)' },
    { key: 'machine_status', header: 'Machine Status', required: false, def: 'ACTIVE', desc: 'Machine Status' },
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
        alert(`A column with field key '${fieldKey}' already exists.`);
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
      state.emit('inventory:updated');
    } catch (err) {
      alert('Error: ' + err.message);
    }
  });
}

