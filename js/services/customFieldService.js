/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Dynamic Custom Fields Engine - Admin Full Control & Global Synchronization
 */

import { storage, CloudSaveError } from '../db/storage.js';
import { TABLE_NAMES, FIELD_TYPES } from '../db/schema.js';
import { authService } from './authService.js';
import { auditService } from './auditService.js';

class CustomFieldService {
  getAllFields() {
    const fields = storage.getTable(TABLE_NAMES.CUSTOM_FIELDS) || [];
    return [...fields].sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  getActiveFields() {
    return this.getAllFields().filter(f => f.status === 'ACTIVE');
  }

  getTableFields() {
    return this.getActiveFields().filter(f => f.showInTable);
  }

  getFilterFields() {
    return this.getActiveFields().filter(f => f.showInFilter);
  }

  getFieldTypes() {
    return FIELD_TYPES;
  }

  async createField(fieldData) {
    if (!authService.canManageFields()) {
      throw new Error('Only authorized administrators can create custom fields.');
    }

    if (!fieldData.label || !fieldData.label.trim()) {
      throw new Error('Field Label is required.');
    }

    // Generate unique code if not provided
    if (!fieldData.code) {
      fieldData.code = fieldData.label.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    }

    // Check duplicate code
    const existing = this.getAllFields().find(f => f.code === fieldData.code);
    if (existing) {
      fieldData.code = `${fieldData.code}_${Date.now().toString().slice(-4)}`;
    }

    const maxOrder = this.getAllFields().reduce((max, f) => Math.max(max, f.order || 0), 0);
    fieldData.order = fieldData.order || (maxOrder + 1);
    fieldData.status = fieldData.status || 'ACTIVE';
    fieldData.options = Array.isArray(fieldData.options) ? fieldData.options.map(o => String(o).trim()).filter(Boolean) : [];
    fieldData.showInTable = fieldData.showInTable !== undefined ? fieldData.showInTable : true;
    fieldData.showInFilter = fieldData.showInFilter !== undefined ? fieldData.showInFilter : true;
    fieldData.required = Boolean(fieldData.required);

    // CONFIRMED WRITE: await Database write
    await storage.writeAndConfirm(TABLE_NAMES.CUSTOM_FIELDS, (tbl) => { tbl.push(fieldData); });
    const created = fieldData;
    
    // Auto-update Excel structure with new column
    this._syncFieldToExcelStructure(created);

    auditService.log('CUSTOM_FIELD_CREATED', 'CUSTOM_FIELD', created.id, `Created dynamic custom field: ${created.label} (${created.type})`);
    window.dispatchEvent(new CustomEvent('erp:fields-updated'));
    return created;
  }

  async updateField(id, updates) {
    if (!authService.canManageFields()) {
      throw new Error('Only authorized administrators can modify custom fields.');
    }

    const existing = storage.getItem(TABLE_NAMES.CUSTOM_FIELDS, id);
    if (!existing) throw new Error('Custom field not found.');

    if (updates.options && Array.isArray(updates.options)) {
      updates.options = updates.options.map(o => String(o).trim()).filter(Boolean);
    }

    // CONFIRMED WRITE: await Database write
    let updated;
    await storage.writeAndConfirm(TABLE_NAMES.CUSTOM_FIELDS, (tbl) => {
      const idx = tbl.findIndex(f => f.id === id);
      if (idx !== -1) { tbl[idx] = { ...tbl[idx], ...updates, updatedAt: new Date().toISOString() }; updated = tbl[idx]; }
    });

    // If code or label changed, update Excel structures
    if (updates.label || updates.code) {
      this._updateExcelStructureColumn(existing.code, updated);
    }

    auditService.log('CUSTOM_FIELD_UPDATED', 'CUSTOM_FIELD', id, `Updated custom field: ${updated?.label}`);
    window.dispatchEvent(new CustomEvent('erp:fields-updated'));
    return updated;
  }

  toggleFieldStatus(id) {
    if (!authService.canManageFields()) throw new Error('Unauthorized.');
    const field = storage.getItem(TABLE_NAMES.CUSTOM_FIELDS, id);
    if (!field) return null;

    const newStatus = field.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const updated = storage.update(TABLE_NAMES.CUSTOM_FIELDS, id, { status: newStatus });
    auditService.log('CUSTOM_FIELD_STATUS_TOGGLED', 'CUSTOM_FIELD', id, `Toggled field ${field.label} to ${newStatus}`);
    window.dispatchEvent(new CustomEvent('erp:fields-updated'));
    return updated;
  }

  toggleTableVisibility(id) {
    if (!authService.canManageFields()) throw new Error('Unauthorized.');
    const field = storage.getItem(TABLE_NAMES.CUSTOM_FIELDS, id);
    if (!field) return null;

    const updated = storage.update(TABLE_NAMES.CUSTOM_FIELDS, id, { showInTable: !field.showInTable });
    window.dispatchEvent(new CustomEvent('erp:fields-updated'));
    return updated;
  }

  toggleFilterVisibility(id) {
    if (!authService.canManageFields()) throw new Error('Unauthorized.');
    const field = storage.getItem(TABLE_NAMES.CUSTOM_FIELDS, id);
    if (!field) return null;

    const updated = storage.update(TABLE_NAMES.CUSTOM_FIELDS, id, { showInFilter: !field.showInFilter });
    window.dispatchEvent(new CustomEvent('erp:fields-updated'));
    return updated;
  }

  async deleteField(id) {
    if (!authService.canManageFields()) {
      throw new Error('Only administrators can delete custom fields.');
    }

    const field = storage.getItem(TABLE_NAMES.CUSTOM_FIELDS, id);
    if (!field) return false;

    // Remove from Excel structures
    this._removeExcelStructureColumn(field.code);

    // CONFIRMED WRITE: await Database write
    await storage.writeAndConfirm(TABLE_NAMES.CUSTOM_FIELDS, (tbl) => {
      const idx = tbl.findIndex(f => f.id === id);
      if (idx !== -1) tbl.splice(idx, 1);
    });
    auditService.log('CUSTOM_FIELD_DELETED', 'CUSTOM_FIELD', id, `Deleted custom field: ${field.label}`);
    window.dispatchEvent(new CustomEvent('erp:fields-updated'));
    return true;
  }

  moveFieldOrder(id, direction = 'up') {
    if (!authService.canManageFields()) return;
    const fields = this.getAllFields();
    const idx = fields.findIndex(f => f.id === id);
    if (idx === -1) return;

    if (direction === 'up' && idx > 0) {
      const prev = fields[idx - 1];
      const curr = fields[idx];
      storage.update(TABLE_NAMES.CUSTOM_FIELDS, curr.id, { order: prev.order });
      storage.update(TABLE_NAMES.CUSTOM_FIELDS, prev.id, { order: curr.order });
    } else if (direction === 'down' && idx < fields.length - 1) {
      const next = fields[idx + 1];
      const curr = fields[idx];
      storage.update(TABLE_NAMES.CUSTOM_FIELDS, curr.id, { order: next.order });
      storage.update(TABLE_NAMES.CUSTOM_FIELDS, next.id, { order: curr.order });
    }

    window.dispatchEvent(new CustomEvent('erp:fields-updated'));
  }

  _syncFieldToExcelStructure(newField) {
    const structures = storage.getTable(TABLE_NAMES.EXCEL_STRUCTURES) || [];
    structures.forEach(struct => {
      const existingCol = (struct.columns || []).find(c => c.systemField === `cf_${newField.code}`);
      if (!existingCol) {
        struct.columns.push({
          id: `col-cf-${newField.id}`,
          header: newField.label,
          systemField: `cf_${newField.code}`,
          required: Boolean(newField.required),
          order: struct.columns.length + 1,
          visible: true
        });
      }
    });
    storage.saveTable(TABLE_NAMES.EXCEL_STRUCTURES);
  }

  _updateExcelStructureColumn(oldCode, updatedField) {
    const structures = storage.getTable(TABLE_NAMES.EXCEL_STRUCTURES) || [];
    structures.forEach(struct => {
      const col = (struct.columns || []).find(c => c.systemField === `cf_${oldCode}`);
      if (col) {
        col.header = updatedField.label;
        col.systemField = `cf_${updatedField.code}`;
        col.required = Boolean(updatedField.required);
      }
    });
    storage.saveTable(TABLE_NAMES.EXCEL_STRUCTURES);
  }

  _removeExcelStructureColumn(fieldCode) {
    const structures = storage.getTable(TABLE_NAMES.EXCEL_STRUCTURES) || [];
    structures.forEach(struct => {
      struct.columns = (struct.columns || []).filter(c => c.systemField !== `cf_${fieldCode}`);
    });
    storage.saveTable(TABLE_NAMES.EXCEL_STRUCTURES);
  }

  validateCustomValues(customValues = {}) {
    const activeFields = this.getActiveFields();
    const errors = [];

    for (const field of activeFields) {
      const val = customValues[field.code];
      if (field.required && (val === undefined || val === null || val === '')) {
        errors.push(`Field '${field.label}' is required.`);
      }
      if (val !== undefined && val !== null && val !== '') {
        if (field.type === 'NUMBER' && isNaN(parseInt(val, 10))) {
          errors.push(`Field '${field.label}' must be an integer.`);
        } else if (field.type === 'DECIMAL' && isNaN(parseFloat(val))) {
          errors.push(`Field '${field.label}' must be a numeric decimal.`);
        }
      }
    }

    return { isValid: errors.length === 0, errors };
  }
}

export const customFieldService = new CustomFieldService();
