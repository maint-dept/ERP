/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Dynamic Custom Fields Engine for Manpower / Employee Management
 * Admin Full Control: Add, Edit, Delete, Toggle, Reorder, Dropdown Options, Filter Integration
 */

import { storage } from '../db/storage.js';
import { TABLE_NAMES, FIELD_TYPES } from '../db/schema.js';
import { authService } from './authService.js?v=4.45.0';
import { auditService } from './auditService.js';

const INITIAL_EMPLOYEE_FIELDS = [
  {
    id: 'emp-cf-1',
    code: 'national_id',
    label: 'National ID / NID Number',
    type: 'TEXT',
    required: false,
    showInTable: true,
    showInFilter: true,
    order: 1,
    status: 'ACTIVE',
    options: []
  },
  {
    id: 'emp-cf-2',
    code: 'blood_group',
    label: 'Blood Group',
    type: 'DROPDOWN',
    required: false,
    showInTable: true,
    showInFilter: true,
    order: 2,
    status: 'ACTIVE',
    options: ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']
  },
  {
    id: 'emp-cf-3',
    code: 'skill_grade',
    label: 'Skill Grade / Level',
    type: 'DROPDOWN',
    required: false,
    showInTable: true,
    showInFilter: true,
    order: 3,
    status: 'ACTIVE',
    options: ['Grade A (Master/Expert)', 'Grade B (Senior)', 'Grade C (Standard)', 'Grade D (Trainee/Helper)']
  },
  {
    id: 'emp-cf-4',
    code: 'emergency_contact',
    label: 'Emergency Contact Phone',
    type: 'TEXT',
    required: false,
    showInTable: true,
    showInFilter: true,
    order: 4,
    status: 'ACTIVE',
    options: []
  },
  {
    id: 'emp-cf-5',
    code: 'overtime_eligible',
    label: 'Overtime (OT) Eligible',
    type: 'BOOLEAN',
    required: false,
    showInTable: true,
    showInFilter: true,
    order: 5,
    status: 'ACTIVE',
    options: ['Yes', 'No']
  }
];

class EmployeeCustomFieldService {

  getAllFields() {
    let fields = storage.getTable(TABLE_NAMES.EMPLOYEE_CUSTOM_FIELDS) || [];
    if (!fields || fields.length === 0) {
      fields = JSON.parse(JSON.stringify(INITIAL_EMPLOYEE_FIELDS));
      storage.saveTable(TABLE_NAMES.EMPLOYEE_CUSTOM_FIELDS, fields);
    }
    return [...fields].sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  getActiveFields() {
    return this.getAllFields().filter(f => f.status === 'ACTIVE');
  }

  getTableFields() {
    return this.getActiveFields().filter(f => f.showInTable !== false);
  }

  getFilterFields() {
    return this.getActiveFields().filter(f => f.showInFilter !== false);
  }

  /**
   * Matches any Excel header, column name, or field key to an existing Custom Field
   * Supports exact, normalized, and rich Bangladeshi garment industry synonyms
   */
  matchField(headerOrKey) {
    if (!headerOrKey) return null;
    const raw = String(headerOrKey).trim();
    const clean = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
    const fields = this.getAllFields();

    // 1. Exact code or label match
    for (const f of fields) {
      if (f.code.toLowerCase() === raw.toLowerCase() || f.label.toLowerCase() === raw.toLowerCase()) {
        return f;
      }
    }

    // 2. Alphanumeric normalized match
    for (const f of fields) {
      const fCodeNorm = f.code.toLowerCase().replace(/[^a-z0-9]/g, '');
      const fLabelNorm = f.label.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (clean === fCodeNorm || clean === fLabelNorm) {
        return f;
      }
    }

    // 3. Known garment industry synonyms & abbreviations
    const aliases = {
      national_id: ['nid', 'nationalid', 'nidnumber', 'nationalidnumber', 'nationalidcard', 'nidno', 'voterid'],
      blood_group: ['blood', 'bloodgroup', 'bloodgrp', 'bg', 'bloodtype'],
      skill_grade: ['skill', 'grade', 'skillgrade', 'skilllevel', 'level', 'techgrade', 'operatorgrade'],
      emergency_contact: ['emergencycontact', 'emergencyphone', 'emergencycell', 'emergencyno', 'emergencytel', 'guardianphone'],
      overtime_eligible: ['ot', 'overtime', 'oteligible', 'overtimeeligible', 'otstatus', 'workerorstaff', 'empcategory', 'category', 'workertype']
    };

    for (const [code, syns] of Object.entries(aliases)) {
      if (syns.includes(clean)) {
        const found = fields.find(f => f.code === code);
        if (found) return found;
      }
    }

    return null;
  }

  /**
   * Automatically discovers and registers custom fields from incoming Excel columns or database records
   * Ensures every extra column entered or imported is permanently tracked and visible
   */
  autoRegisterFieldFromHeader(headerName) {
    if (!headerName || !String(headerName).trim()) return null;
    const cleanLabel = String(headerName).trim();
    
    // Check if matches an existing field first
    const matched = this.matchField(cleanLabel);
    if (matched) return matched;

    const cleanCode = cleanLabel.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '') || `cf_${Date.now()}`;
    const fields = this.getAllFields();
    const existing = fields.find(f => f.code === cleanCode);
    if (existing) return existing;

    // Create and register new field definition
    const maxOrder = fields.reduce((max, f) => Math.max(max, f.order || 0), 0);
    const newField = {
      id: `emp-cf-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      code: cleanCode,
      label: cleanLabel,
      type: 'TEXT',
      required: false,
      showInTable: true,
      showInFilter: true,
      order: maxOrder + 1,
      status: 'ACTIVE',
      options: []
    };

    const updatedList = [...fields, newField];
    storage.saveTable(TABLE_NAMES.EMPLOYEE_CUSTOM_FIELDS, updatedList);
    window.dispatchEvent(new CustomEvent('erp:emp-fields-updated'));
    return newField;
  }

  getFieldTypes() {
    return FIELD_TYPES;
  }

  createField(fieldData) {
    if (!authService.isAdmin()) {
      throw new Error('Only authorized administrators can create employee custom fields.');
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

    const created = storage.insert(TABLE_NAMES.EMPLOYEE_CUSTOM_FIELDS, fieldData);

    auditService.log(
      'EMP_CUSTOM_FIELD_CREATED',
      'ADMIN',
      created.id,
      `Created dynamic manpower custom field: ${created.label} (${created.type})`
    );

    window.dispatchEvent(new CustomEvent('erp:emp-fields-updated'));
    return created;
  }

  updateField(id, updates) {
    if (!authService.isAdmin()) {
      throw new Error('Only authorized administrators can modify employee custom fields.');
    }

    const existing = storage.getItem(TABLE_NAMES.EMPLOYEE_CUSTOM_FIELDS, id);
    if (!existing) throw new Error('Employee custom field not found.');

    if (updates.options && Array.isArray(updates.options)) {
      updates.options = updates.options.map(o => String(o).trim()).filter(Boolean);
    }

    const updated = storage.update(TABLE_NAMES.EMPLOYEE_CUSTOM_FIELDS, id, updates);

    auditService.log(
      'EMP_CUSTOM_FIELD_UPDATED',
      'ADMIN',
      id,
      `Updated employee custom field: ${updated?.label}`
    );

    window.dispatchEvent(new CustomEvent('erp:emp-fields-updated'));
    return updated;
  }

  toggleFieldStatus(id) {
    if (!authService.isAdmin()) throw new Error('Unauthorized.');
    const field = storage.getItem(TABLE_NAMES.EMPLOYEE_CUSTOM_FIELDS, id);
    if (!field) return null;

    const newStatus = field.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    return this.updateField(id, { status: newStatus });
  }

  deleteField(id) {
    if (!authService.isAdmin()) throw new Error('Unauthorized.');
    const field = storage.getItem(TABLE_NAMES.EMPLOYEE_CUSTOM_FIELDS, id);
    if (!field) return false;

    // Delete field definition
    storage.delete(TABLE_NAMES.EMPLOYEE_CUSTOM_FIELDS, id);

    // Clean up field value from existing employees to prevent orphaned data
    const employees = storage.getTable(TABLE_NAMES.EMPLOYEES) || [];
    employees.forEach(emp => {
      if (emp.customFields && emp.customFields[field.code] !== undefined) {
        delete emp.customFields[field.code];
      }
    });
    storage.saveTable(TABLE_NAMES.EMPLOYEES, employees);

    auditService.log(
      'EMP_CUSTOM_FIELD_DELETED',
      'ADMIN',
      id,
      `Deleted employee custom field: ${field.label} (${field.code})`
    );

    window.dispatchEvent(new CustomEvent('erp:emp-fields-updated'));
    return true;
  }

  reorderFields(fieldIdsOrder) {
    if (!authService.isAdmin()) throw new Error('Unauthorized.');
    const fields = this.getAllFields();
    
    fieldIdsOrder.forEach((id, index) => {
      const field = fields.find(f => f.id === id);
      if (field) {
        field.order = index + 1;
      }
    });

    storage.saveTable(TABLE_NAMES.EMPLOYEE_CUSTOM_FIELDS, fields);
    auditService.log('EMP_CUSTOM_FIELDS_REORDERED', 'ADMIN', 'SYSTEM', 'Reordered employee custom fields.');
    window.dispatchEvent(new CustomEvent('erp:emp-fields-updated'));
    return fields;
  }
}

export const employeeCustomFieldService = new EmployeeCustomFieldService();
if (typeof window !== 'undefined') {
  window.employeeCustomFieldService = employeeCustomFieldService;
}
