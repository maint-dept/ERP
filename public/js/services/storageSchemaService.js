/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Master Data Storage Custom Schema & Category Builder Service
 * 
 * Provides flexible schema customization for Master Reference Storage:
 * - Standard core categories: MACHINE, SPARE_PART, TOOL, LOCATION
 * - Custom user-defined reference categories (e.g. ATTACHMENTS, ELECTRICAL, LUBRICANTS)
 * - Custom field management with data types (Text, Number, Select Dropdown, Date, Boolean)
 * - Dynamic column generation, validation rules, and custom Excel template generator
 */

const STORAGE_SCHEMAS_KEY = 'erp_storage_custom_schemas';

// Default initial schemas for standard ERP categories
const DEFAULT_SCHEMAS = {
  MACHINE: {
    categoryKey: 'MACHINE',
    title: 'Machine & Models',
    icon: '🧵',
    description: 'Master sewing and finishing machine models and brand standards',
    isSystem: true,
    standardFields: [
      { key: 'machineName', label: 'Machine Name', type: 'text', required: true, showInTable: true, placeholder: 'e.g. Plain Machine 1-Needle' },
      { key: 'brand', label: 'Brand', type: 'text', required: true, showInTable: true, placeholder: 'e.g. JUKI, BROTHER' },
      { key: 'model', label: 'Model Number', type: 'text', required: true, showInTable: true, placeholder: 'e.g. DDL-8700, S-7200C' },
      { key: 'requiredNeedleBrand', label: 'Needle Brand', type: 'text', required: false, showInTable: true, placeholder: 'e.g. ORGAN, GROZ-BECKERT' },
      { key: 'needleType', label: 'Needle Type / Size', type: 'text', required: false, showInTable: true, placeholder: 'e.g. DBx1 #14, DCx27 #11, DPx5 #14' },
      { key: 'requiredNeedles', label: 'Required Needles', type: 'number', required: false, showInTable: true, placeholder: 'e.g. 1, 2, 3' }
    ],
    customFields: []
  },
  SPARE_PART: {
    categoryKey: 'SPARE_PART',
    title: 'Spare Parts',
    icon: '⚙️',
    description: 'Mechanical, electrical, and consumable spare parts catalogue',
    isSystem: true,
    standardFields: [
      { key: 'name', label: 'Part Name', type: 'text', required: true, showInTable: true, placeholder: 'e.g. Bobbin Case' },
      { key: 'code', label: 'Part Code / Number', type: 'text', required: true, showInTable: true, placeholder: 'e.g. BC-DB1-NBL' },
      { key: 'partCategory', label: 'Category', type: 'select', required: false, showInTable: true, options: ['Mechanical', 'Electrical', 'Consumable', 'Pneumatic'] },
      { key: 'compatibleModels', label: 'Compatible Models', type: 'text', required: false, showInTable: true, placeholder: 'e.g. JUKI DDL-8700, BROTHER S-7200C' }
    ],
    customFields: [
      { key: 'supplier', label: 'Preferred Supplier', type: 'text', required: false, showInTable: true, placeholder: 'e.g. JUKI Genuine Parts BD' },
      { key: 'standardCost', label: 'Standard Cost (BDT)', type: 'number', required: false, showInTable: false, placeholder: 'e.g. 450' },
      { key: 'reorderLevel', label: 'Reorder Safety Level', type: 'number', required: false, showInTable: false, placeholder: 'e.g. 10' }
    ]
  },
  TOOL: {
    categoryKey: 'TOOL',
    title: 'Tools & Equipment',
    icon: '🧰',
    description: 'Mechanic toolkit items, specialized gauges, and diagnostic tools',
    isSystem: true,
    standardFields: [
      { key: 'name', label: 'Tool Name', type: 'text', required: true, showInTable: true, placeholder: 'e.g. Flat Screw Driver' },
      { key: 'code', label: 'Tool Code', type: 'text', required: true, showInTable: true, placeholder: 'e.g. TL-SD-002' },
      { key: 'specs', label: 'Specifications', type: 'text', required: false, showInTable: true, placeholder: 'e.g. 150mm Chrome Vanadium' },
      { key: 'kit', label: 'Standard Kit', type: 'text', required: false, showInTable: true, placeholder: 'e.g. Mechanic Standard Kit' }
    ],
    customFields: [
      { key: 'toolBrand', label: 'Brand / Maker', type: 'text', required: false, showInTable: true, placeholder: 'e.g. Stanley, SATA' },
      { key: 'warrantyMonths', label: 'Warranty (Months)', type: 'number', required: false, showInTable: false, placeholder: 'e.g. 12' }
    ]
  },
  LOCATION: {
    categoryKey: 'LOCATION',
    title: 'Plant Locations',
    icon: '🏢',
    description: 'Factory units, floor plans, and production lines',
    isSystem: true,
    standardFields: [
      { key: 'unitName', label: 'Unit / Factory', type: 'text', required: true, showInTable: true, placeholder: 'e.g. Unit-01, Unit-02' },
      { key: 'floorName', label: 'Floor', type: 'text', required: true, showInTable: true, placeholder: 'e.g. 1st Floor, Meghna Floor' },
      { key: 'lineName', label: 'Production Line', type: 'text', required: true, showInTable: true, placeholder: 'e.g. Line-A, MG-A' }
    ],
    customFields: [
      { key: 'supervisorName', label: 'Floor Supervisor', type: 'text', required: false, showInTable: true, placeholder: 'e.g. Md. Rafiqul Islam' },
      { key: 'lineCapacity', label: 'Target Machine Capacity', type: 'number', required: false, showInTable: false, placeholder: 'e.g. 45' }
    ]
  }
};

class StorageSchemaService {
  constructor() {
    this._schemas = this._loadSchemas();
  }

  // Load schemas from LocalStorage with fallback to DEFAULT_SCHEMAS
  _loadSchemas() {
    try {
      const stored = localStorage.getItem(STORAGE_SCHEMAS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Ensure all default categories exist
        Object.keys(DEFAULT_SCHEMAS).forEach(k => {
          if (!parsed[k]) {
            parsed[k] = JSON.parse(JSON.stringify(DEFAULT_SCHEMAS[k]));
          } else {
            // Ensure standard fields are preserved and strictly aligned with current definitions
            parsed[k].standardFields = DEFAULT_SCHEMAS[k].standardFields;
            // For MACHINE, clean out legacy default custom fields so only user-created fields exist
            if (k === 'MACHINE' && Array.isArray(parsed[k].customFields)) {
              parsed[k].customFields = parsed[k].customFields.filter(f => 
                f.key !== 'powerRating' && f.key !== 'needleSystem' && f.key !== 'motorType' && f.key !== 'serialFormat' &&
                f.key !== 'requiredNeedleBrand' && f.key !== 'needleBrand' && f.key !== 'needleType' && f.key !== 'requiredNeedles'
              );
            }
            parsed[k].customFields = parsed[k].customFields || [];
          }
        });
        this._saveSchemas(parsed);
        return parsed;
      }
    } catch (e) {
      console.warn('Failed to load custom schemas, resetting to defaults', e);
    }
    const def = JSON.parse(JSON.stringify(DEFAULT_SCHEMAS));
    this._saveSchemas(def);
    return def;
  }

  _saveSchemas(schemas = this._schemas) {
    try {
      localStorage.setItem(STORAGE_SCHEMAS_KEY, JSON.stringify(schemas));
      window.dispatchEvent(new CustomEvent('erp:storage-schema-updated'));
    } catch (e) {
      console.error('Failed to save storage schemas to localStorage', e);
    }
  }

  /**
   * Get all registered category schemas (Standard + Custom)
   */
  getAllCategories() {
    return Object.values(this._schemas);
  }

  /**
   * Get schema for a specific category
   */
  getSchema(categoryKey) {
    const key = (categoryKey || '').toUpperCase();
    return this._schemas[key] || this._schemas.MACHINE;
  }

  /**
   * Get all fields (standard + custom) for a category
   */
  getCategoryFields(categoryKey) {
    const schema = this.getSchema(categoryKey);
    return [...(schema.standardFields || []), ...(schema.customFields || [])];
  }

  /**
   * Get fields that should be displayed in the master data table
   */
  getTableColumns(categoryKey) {
    const fields = this.getCategoryFields(categoryKey);
    return fields.filter(f => f.showInTable !== false);
  }

  /**
   * Add a custom field to a category schema
   */
  addCustomField(categoryKey, fieldData) {
    const key = (categoryKey || '').toUpperCase();
    if (!this._schemas[key]) {
      throw new Error(`Category "${categoryKey}" does not exist`);
    }

    if (!fieldData.label || !fieldData.label.trim()) {
      throw new Error('Field label is required');
    }

    // Auto-generate key if missing
    let fieldKey = fieldData.key || fieldData.label.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    fieldKey = fieldKey.replace(/^_+|_+$/g, '');
    if (!fieldKey) fieldKey = 'custom_' + Date.now();

    // Check if key already exists in standard or custom
    const allFields = this.getCategoryFields(key);
    if (allFields.some(f => f.key === fieldKey)) {
      fieldKey = `${fieldKey}_${Date.now().toString().slice(-4)}`;
    }

    const newField = {
      key: fieldKey,
      label: fieldData.label.trim(),
      type: fieldData.type || 'text',
      required: Boolean(fieldData.required),
      showInTable: fieldData.showInTable !== undefined ? Boolean(fieldData.showInTable) : true,
      options: Array.isArray(fieldData.options) ? fieldData.options : (typeof fieldData.options === 'string' ? fieldData.options.split(',').map(s => s.trim()).filter(Boolean) : []),
      placeholder: fieldData.placeholder || `Enter ${fieldData.label}`,
      isCustom: true
    };

    this._schemas[key].customFields = this._schemas[key].customFields || [];
    this._schemas[key].customFields.push(newField);
    this._saveSchemas();
    return newField;
  }

  /**
   * Remove a custom field from a category
   */
  deleteCustomField(categoryKey, fieldKey) {
    const key = (categoryKey || '').toUpperCase();
    if (!this._schemas[key] || !this._schemas[key].customFields) return false;

    this._schemas[key].customFields = this._schemas[key].customFields.filter(f => f.key !== fieldKey);
    this._saveSchemas();
    return true;
  }

  /**
   * Toggle a field's visibility in the master table
   */
  toggleFieldTableDisplay(categoryKey, fieldKey, show) {
    const key = (categoryKey || '').toUpperCase();
    if (!this._schemas[key]) return false;

    const cf = (this._schemas[key].customFields || []).find(f => f.key === fieldKey);
    if (cf) {
      cf.showInTable = show !== undefined ? Boolean(show) : !cf.showInTable;
      this._saveSchemas();
      return true;
    }

    const sf = (this._schemas[key].standardFields || []).find(f => f.key === fieldKey);
    if (sf) {
      sf.showInTable = show !== undefined ? Boolean(show) : !sf.showInTable;
      this._saveSchemas();
      return true;
    }
    return false;
  }

  /**
   * Create a brand new Custom Reference Category
   */
  createCustomCategory({ categoryKey, title, icon = '📁', description = '' }) {
    if (!title || !title.trim()) throw new Error('Category title is required');

    let key = (categoryKey || title).toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    key = key.replace(/^_+|_+$/g, '');
    if (!key) key = 'CAT_' + Date.now();

    if (this._schemas[key]) {
      throw new Error(`Category key "${key}" already exists`);
    }

    this._schemas[key] = {
      categoryKey: key,
      title: title.trim(),
      icon: icon || '📁',
      description: description.trim() || `Master reference catalog for ${title}`,
      isSystem: false,
      standardFields: [
        { key: 'name', label: 'Item Name', type: 'text', required: true, showInTable: true, placeholder: 'e.g. Standard Item' },
        { key: 'code', label: 'Item Code / Standard ID', type: 'text', required: true, showInTable: true, placeholder: 'e.g. STD-001' },
        { key: 'description', label: 'Description / Details', type: 'text', required: false, showInTable: true, placeholder: 'Technical specifications' }
      ],
      customFields: []
    };

    this._saveSchemas();
    return this._schemas[key];
  }

  /**
   * Delete a user-created custom category
   */
  deleteCustomCategory(categoryKey) {
    const key = (categoryKey || '').toUpperCase();
    if (!this._schemas[key]) return false;
    if (this._schemas[key].isSystem) {
      throw new Error('Standard system categories cannot be deleted');
    }

    delete this._schemas[key];
    this._saveSchemas();
    return true;
  }

  /**
   * Generate header row and sample row for dynamic CSV template
   */
  getTemplateConfig(categoryKey) {
    const schema = this.getSchema(categoryKey);
    const fields = this.getCategoryFields(categoryKey);

    const headers = fields.map(f => f.label + (f.required ? ' *' : ''));
    const sample = fields.map(f => {
      if (f.placeholder && f.placeholder.startsWith('e.g. ')) {
        return f.placeholder.replace('e.g. ', '').split(',')[0].trim();
      }
      if (f.type === 'number') return '10';
      if (f.type === 'select' && f.options && f.options.length) return f.options[0];
      return `Sample ${f.label}`;
    });

    return {
      headers,
      sample,
      fileName: `Storage_Template_${schema.categoryKey}.csv`
    };
  }
}

export const storageSchemaService = new StorageSchemaService();
if (typeof window !== 'undefined') {
  window.storageSchemaService = storageSchemaService;
}
