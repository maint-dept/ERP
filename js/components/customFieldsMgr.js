/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Dynamic Custom Fields Builder Component - Full Admin Control
 */

import { customFieldService } from '../services/customFieldService.js';
import { FIELD_TYPES } from '../db/schema.js';
import { state } from '../state.js';
import { notificationService } from '../services/notificationService.js';

export function renderCustomFieldsMgr() {
  const fields = customFieldService.getAllFields();

  return `
    <div class="page-view">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h1 style="font-size: 22px; font-weight: 800; color: #fff;">⚙️ Dynamic Custom Technical Parameters</h1>
          <p style="font-size: 12.5px; color: var(--text-secondary);">
            Admin Control: Add, edit, rename, reorder, or toggle parameters without writing code. Changes automatically synchronize across Add/Edit modal, Excel table, filters, Excel templates, and PDF reports.
          </p>
        </div>
        <button id="btn-open-create-cf-modal" class="btn btn-primary">➕ Create New Parameter</button>
      </div>

      <!-- Custom Fields Table / List -->
      <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-sm);">
        <table class="excel-grid-table">
          <thead>
            <tr>
              <th style="width: 60px; text-align: center;">Order</th>
              <th>Field Label</th>
              <th>Internal Code</th>
              <th>Data Type</th>
              <th>Dropdown Options</th>
              <th style="text-align: center;">Required</th>
              <th style="text-align: center;">Grid Column</th>
              <th style="text-align: center;">Filterable</th>
              <th style="text-align: center;">Status</th>
              <th style="width: 140px; text-align: center;">Reorder</th>
              <th style="width: 130px; text-align: center;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${fields.map((f, idx) => `
              <tr>
                <td style="text-align: center; color: var(--text-muted);">${f.order || idx + 1}</td>
                <td>
                  <span style="font-weight: 700; color: #fff; font-size: 13.5px;">${f.label}</span>
                </td>
                <td style="font-family: var(--font-mono); font-size: 11.5px; color: #38bdf8;">${f.code}</td>
                <td><span class="badge badge-idle">${f.type}</span></td>
                <td style="font-size: 11px; color: var(--text-secondary); max-width: 180px; overflow: hidden; text-overflow: ellipsis;">
                  ${f.options && f.options.length > 0 ? f.options.join(', ') : '—'}
                </td>
                <td style="text-align: center;">
                  <button class="btn btn-ghost btn-sm btn-toggle-req" data-id="${f.id}" title="Toggle Required">
                    ${f.required ? '🔴 Required' : '⚪ Optional'}
                  </button>
                </td>
                <td style="text-align: center;">
                  <button class="btn btn-ghost btn-sm btn-toggle-table-vis" data-id="${f.id}" title="Toggle Table Visibility">
                    ${f.showInTable ? '👁️ Shown' : '🚫 Hidden'}
                  </button>
                </td>
                <td style="text-align: center;">
                  <button class="btn btn-ghost btn-sm btn-toggle-filter-vis" data-id="${f.id}" title="Toggle Filter Visibility">
                    ${f.showInFilter ? '🔍 Active' : '⚪ Off'}
                  </button>
                </td>
                <td style="text-align: center;">
                  <button class="btn btn-ghost btn-sm btn-toggle-status" data-id="${f.id}">
                    <span class="badge ${f.status === 'ACTIVE' ? 'badge-active' : 'badge-inactive'}">${f.status}</span>
                  </button>
                </td>
                <td style="text-align: center;">
                  <div style="display: flex; gap: 4px; justify-content: center;">
                    <button class="btn btn-secondary btn-sm btn-cf-up" data-id="${f.id}" ${idx === 0 ? 'disabled' : ''}>▲</button>
                    <button class="btn btn-secondary btn-sm btn-cf-down" data-id="${f.id}" ${idx === fields.length - 1 ? 'disabled' : ''}>▼</button>
                  </div>
                </td>
                <td style="text-align: center;">
                  <div style="display: flex; gap: 4px; justify-content: center;">
                    <button class="btn btn-secondary btn-sm btn-edit-cf" data-id="${f.id}" title="Edit / Rename Parameter">✏️</button>
                    <button class="btn btn-danger btn-sm btn-delete-cf" data-id="${f.id}" title="Delete Parameter">🗑️</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export function initCustomFieldsEvents() {
  const btnCreate = document.getElementById('btn-open-create-cf-modal');
  if (btnCreate) {
    btnCreate.addEventListener('click', async () => {
      const label = prompt('Enter Field Label (e.g. Motor Brand, Lubricant Type, Needle System):');
      if (!label || !label.trim()) return;

      const type = prompt('Select Field Type (TEXT, NUMBER, DECIMAL, DATE, DROPDOWN, MULTI_SELECT, LONG_TEXT):', 'DROPDOWN');
      let options = [];
      if (type && (type.toUpperCase() === 'DROPDOWN' || type.toUpperCase() === 'MULTI_SELECT')) {
        const optsStr = prompt('Enter comma-separated options (e.g. 220V Single Phase, 380V 3-Phase, 415V 3-Phase):');
        if (optsStr) options = optsStr.split(',').map(s => s.trim()).filter(Boolean);
      }

      try {
        await customFieldService.createField({
          label: label.trim(),
          type: (type || 'TEXT').toUpperCase().trim(),
          required: false,
          showInTable: true,
          showInFilter: true,
          options: options
        });
        alert(`Parameter '${label}' created successfully and synchronized across ERP.`);
        state.emit('inventory:updated');
      } catch (err) {
        alert('Error: ' + err.message);
      }
    });
  }

  // Edit / Rename Parameter
  document.querySelectorAll('.btn-edit-cf').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const field = customFieldService.getAllFields().find(f => f.id === id);
      if (!field) return;

      const newLabel = prompt(`Edit / Rename Field Label (Current: ${field.label}):`, field.label);
      if (!newLabel || !newLabel.trim()) return;

      let newOptions = field.options || [];
      if (field.type === 'DROPDOWN' || field.type === 'MULTI_SELECT') {
        const optsStr = prompt('Edit dropdown options (comma-separated):', newOptions.join(', '));
        if (optsStr !== null) {
          newOptions = optsStr.split(',').map(s => s.trim()).filter(Boolean);
        }
      }

      try {
        await customFieldService.updateField(id, {
          label: newLabel.trim(),
          options: newOptions
        });
        alert(`Custom parameter '${newLabel}' updated.`);
        state.emit('inventory:updated');
      } catch (err) {
        alert('Error: ' + err.message);
      }
    });
  });

  // Toggle Toggles
  document.querySelectorAll('.btn-toggle-req').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const field = customFieldService.getAllFields().find(f => f.id === id);
      if (field) {
        customFieldService.updateField(id, { required: !field.required });
        state.emit('inventory:updated');
      }
    });
  });

  document.querySelectorAll('.btn-toggle-table-vis').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      customFieldService.toggleTableVisibility(id);
      state.emit('inventory:updated');
    });
  });

  document.querySelectorAll('.btn-toggle-filter-vis').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      customFieldService.toggleFilterVisibility(id);
      state.emit('inventory:updated');
    });
  });

  document.querySelectorAll('.btn-toggle-status').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      customFieldService.toggleFieldStatus(id);
      state.emit('inventory:updated');
    });
  });

  // Reorder
  document.querySelectorAll('.btn-cf-up').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      customFieldService.moveFieldOrder(id, 'up');
      state.emit('inventory:updated');
    });
  });

  document.querySelectorAll('.btn-cf-down').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      customFieldService.moveFieldOrder(id, 'down');
      state.emit('inventory:updated');
    });
  });

  document.querySelectorAll('.btn-delete-cf').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const allFields = customFieldService.getAllFields();
      const targetField = allFields.find(f => f.id === id);
      const confirmed = await notificationService.confirmDelete({
        title: 'Delete Custom Parameter Field',
        message: 'Are you sure you want to permanently delete this dynamic custom field? Existing values stored under this field will no longer be visible.',
        itemName: targetField ? `${targetField.label} (${targetField.name})` : id,
        itemType: 'Custom Field',
        count: 1,
        isDestructive: true
      });
      if (confirmed) {
        try {
          await customFieldService.deleteField(id);
          notificationService.success('Custom field deleted successfully.');
          state.emit('inventory:updated');
        } catch (err) {
          notificationService.error('Error: ' + err.message);
        }
      }
    });
  });
}
