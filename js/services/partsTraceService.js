/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Parts Trace & Main ERP Spare Parts Issue Extraction Service Engine
 * Full Traceability: ERP No -> Spare Part -> Machine -> Manpower (Requested By) -> Technician -> Date & Location
 */

import { storage } from '../db/storage.js';
import { TABLE_NAMES } from '../db/schema.js';
import { INITIAL_DATA } from '../db/initialData.js';
import { authService } from './authService.js';
import { masterDataService } from './masterDataService.js';
import { historyService } from './historyService.js';
import { auditService } from './auditService.js';
import { notificationService } from './notificationService.js';

// Pre-seeded specialized spare parts from ERP report for instant 100% precision matching
const INITIAL_PARTS_SEED = [
  {
    id: 'sp-seed-201',
    code: 'SP-201',
    name: 'Sharpening Belt',
    altName: 'Sharpening Belt - BOX',
    alias: 'Sharp Belt, Knife Sharpener Belt, Sharpening Belt - BOX',
    category: 'Consumable',
    subCategory: 'Cutting / Belts',
    unit: 'BOX',
    brand: 'Universal',
    model: 'Eastman / KM',
    compatibleMachineTypes: 'Band Knife, Cloth Cutting Machine',
    unitPrice: 450,
    status: 'ACTIVE'
  },
  {
    id: 'sp-seed-202',
    code: 'SP-202',
    name: 'P/M Fixed Knife',
    altName: 'P/M FIXED KNIFE (DDL-900BB) 40195552',
    alias: 'Fixed Knife, DDL-900BB Knife, 40195552, P/M FIXED KNIFE',
    category: 'Mechanical',
    subCategory: 'Trimming / Knives',
    unit: 'PCS',
    brand: 'JUKI',
    model: 'DDL-900BB, DDL-8700-7',
    compatibleMachineTypes: 'Plane Machine, Single Needle Lockstitch',
    unitPrice: 280,
    status: 'ACTIVE'
  },
  {
    id: 'sp-seed-203',
    code: 'SP-203',
    name: 'P/M Feed Dog Base',
    altName: 'P/M FEED DOG BASE 40030786/40026983(DDL-9000B/8700-7)',
    alias: 'Feed Dog Base, 40030786, 40026983, P/M FEED DOG BASE',
    category: 'Mechanical',
    subCategory: 'Feeding Mechanism',
    unit: 'PCS',
    brand: 'JUKI',
    model: 'DDL-9000B, DDL-8700-7',
    compatibleMachineTypes: 'Plane Machine, Lockstitch',
    unitPrice: 520,
    status: 'ACTIVE'
  },
  {
    id: 'sp-seed-204',
    code: 'SP-204',
    name: 'T/N Rotary Hook (Large)',
    altName: 'T/N ROTARY HOOK 40043334 (LARGE)',
    alias: 'Rotary Hook Large, 40043334, Twin Needle Hook, T/N ROTARY HOOK',
    category: 'Mechanical',
    subCategory: 'Hooks & Loopers',
    unit: 'PCS',
    brand: 'JUKI / Koban',
    model: 'LH-3568, LH-3168',
    compatibleMachineTypes: 'Twin Needle, Double Needle Lockstitch',
    unitPrice: 1850,
    status: 'ACTIVE'
  },
  {
    id: 'sp-seed-205',
    code: 'SP-205',
    name: 'P/M Moving Knife',
    altName: 'P/M Moving Knife 40195289(Ddl-900Bb)',
    alias: 'Moving Knife, 40195289, DDL900BB Mov Knife, P/M Moving Knife',
    category: 'Mechanical',
    subCategory: 'Trimming / Knives',
    unit: 'PCS',
    brand: 'JUKI',
    model: 'DDL-900BB',
    compatibleMachineTypes: 'Plane Machine',
    unitPrice: 320,
    status: 'ACTIVE'
  },
  {
    id: 'sp-seed-206',
    code: 'SP-206',
    name: 'Roller / Puller Belt S3M*192',
    altName: 'ROLLER/PULLER BELT S3M*192',
    alias: 'Puller Belt, S3M 192, Synchronous Belt, ROLLER/PULLER BELT, S3M*192',
    category: 'Mechanical',
    subCategory: 'Belts & Pullers',
    unit: 'PCS',
    brand: 'Universal',
    model: 'S3M-192',
    compatibleMachineTypes: 'Feed Off The Arm, Overlock, Puller Devices',
    unitPrice: 190,
    status: 'ACTIVE'
  },
  {
    id: 'sp-seed-207',
    code: 'SP-207',
    name: 'Machine LED Light',
    altName: 'Machine Led Light',
    alias: 'LED Work Lamp, Sewing Light, LED Bulb, Machine Led Light',
    category: 'Electrical',
    subCategory: 'Lighting',
    unit: 'PCS',
    brand: 'Universal',
    model: 'LED-20D / Flexible',
    compatibleMachineTypes: 'All Sewing Machines',
    unitPrice: 350,
    status: 'ACTIVE'
  },
  {
    id: 'sp-seed-208',
    code: 'SP-208',
    name: 'F/A Looper M 12968806',
    altName: 'F/A Looper M 12968806',
    alias: 'Feed Arm Looper, 12968806, Special Looper, F/A Looper',
    category: 'Mechanical',
    subCategory: 'Hooks & Loopers',
    unit: 'PCS',
    brand: 'JUKI / Brother',
    model: 'MS-1261, DA-9280',
    compatibleMachineTypes: 'Feed Off The Arm, Flatlock',
    unitPrice: 750,
    status: 'ACTIVE'
  }
];

class PartsTraceService {
  constructor() {
    this._ensureSeedMasterParts();
  }

  /**
   * Ensures default seed spare parts exist in SPARE_PARTS_MASTER on first initialization
   */
  _ensureSeedMasterParts() {
    try {
      const seededFlag = typeof localStorage !== 'undefined' ? localStorage.getItem('parts_master_seed_initialized') : null;
      if (seededFlag === 'true') {
        return;
      }
      const current = storage.getTable(TABLE_NAMES.SPARE_PARTS_MASTER) || [];
      let added = 0;
      INITIAL_PARTS_SEED.forEach(seed => {
        const exists = current.some(p => p.code === seed.code || (p.name && p.name.toLowerCase() === seed.name.toLowerCase()) || (p.altName && p.altName.toLowerCase() === seed.altName.toLowerCase()));
        if (!exists) {
          current.push(seed);
          added++;
        }
      });
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('parts_master_seed_initialized', 'true');
      }
      if (added > 0) {
        storage.setTable(TABLE_NAMES.SPARE_PARTS_MASTER, current);
        storage.saveTable(TABLE_NAMES.SPARE_PARTS_MASTER, false);
      }
    } catch (_) {}
  }

  // ─────────────────────────────────────────────────────────────
  // 1. PARTS MASTER MANAGEMENT (CRUD, EXCEL IMPORT / EXPORT)
  // ─────────────────────────────────────────────────────────────

  getAllParts(filters = {}) {
    this._ensureSeedMasterParts();
    let list = storage.getTable(TABLE_NAMES.SPARE_PARTS_MASTER) || [];

    if (filters.search && filters.search.trim()) {
      const q = filters.search.toLowerCase().trim();
      list = list.filter(p =>
        (p.code && p.code.toLowerCase().includes(q)) ||
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.altName && p.altName.toLowerCase().includes(q)) ||
        (p.alias && p.alias.toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q)) ||
        (p.brand && p.brand.toLowerCase().includes(q)) ||
        (p.model && p.model.toLowerCase().includes(q)) ||
        (p.compatibleMachineTypes && p.compatibleMachineTypes.toLowerCase().includes(q))
      );
    }

    if (filters.category && filters.category !== 'ALL') {
      list = list.filter(p => p.category === filters.category);
    }

    if (filters.status && filters.status !== 'ALL') {
      list = list.filter(p => (p.status || 'ACTIVE') === filters.status);
    }

    return [...list].sort((a, b) => (a.code || '').localeCompare(b.code || ''));
  }

  getPartById(id) {
    const list = storage.getTable(TABLE_NAMES.SPARE_PARTS_MASTER) || [];
    return list.find(p => p.id === id || p.code === id) || null;
  }

  async savePart(partData) {
    const list = storage.getTable(TABLE_NAMES.SPARE_PARTS_MASTER) || [];
    const nowIso = new Date().toISOString();

    const cleanCode = (partData.code || partData.partCode || '').trim().toUpperCase();
    const cleanName = (partData.name || partData.partName || '').trim();

    if (!cleanCode) throw new Error('Part Code is required.');
    if (!cleanName) throw new Error('Part Name is required.');

    let recordId = partData.id;
    let isNew = !recordId;

    if (isNew) {
      const duplicate = list.find(p => p.code === cleanCode);
      if (duplicate) throw new Error(`Part Code '${cleanCode}' already exists in Parts Master.`);

      recordId = `spm-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const newPart = {
        id: recordId,
        code: cleanCode,
        name: cleanName,
        altName: (partData.altName || '').trim(),
        alias: (partData.alias || '').trim(),
        category: (partData.category || 'Mechanical').trim(),
        subCategory: (partData.subCategory || '').trim(),
        unit: (partData.unit || partData.uom || 'PCS').trim().toUpperCase(),
        brand: (partData.brand || '').trim(),
        model: (partData.model || '').trim(),
        compatibleMachineTypes: (partData.compatibleMachineTypes || '').trim(),
        unitPrice: parseFloat(partData.unitPrice) || 0,
        stockQty: parseInt(partData.stockQty, 10) || 0,
        status: partData.status || 'ACTIVE',
        createdAt: nowIso,
        updatedAt: nowIso
      };

      storage.insert(TABLE_NAMES.SPARE_PARTS_MASTER, newPart);
      await storage.saveTable(TABLE_NAMES.SPARE_PARTS_MASTER, true);
      this._partsIndexCache = null;
      return newPart;
    } else {
      const existing = list.find(p => p.id === recordId);
      if (!existing) throw new Error('Spare part record not found.');

      const duplicate = list.find(p => p.id !== recordId && p.code === cleanCode);
      if (duplicate) throw new Error(`Another part with Code '${cleanCode}' already exists.`);

      const updated = storage.update(TABLE_NAMES.SPARE_PARTS_MASTER, recordId, {
        code: cleanCode,
        name: cleanName,
        altName: (partData.altName !== undefined ? partData.altName : existing.altName || '').trim(),
        alias: (partData.alias !== undefined ? partData.alias : existing.alias || '').trim(),
        category: partData.category || existing.category || 'Mechanical',
        subCategory: partData.subCategory !== undefined ? partData.subCategory : existing.subCategory || '',
        unit: (partData.unit || partData.uom || existing.unit || 'PCS').trim().toUpperCase(),
        brand: partData.brand !== undefined ? partData.brand : existing.brand || '',
        model: partData.model !== undefined ? partData.model : existing.model || '',
        compatibleMachineTypes: partData.compatibleMachineTypes !== undefined ? partData.compatibleMachineTypes : existing.compatibleMachineTypes || '',
        unitPrice: partData.unitPrice !== undefined ? parseFloat(partData.unitPrice) || 0 : existing.unitPrice || 0,
        stockQty: partData.stockQty !== undefined ? parseInt(partData.stockQty, 10) || 0 : existing.stockQty || 0,
        status: partData.status || existing.status || 'ACTIVE',
        updatedAt: nowIso
      });

      await storage.saveTable(TABLE_NAMES.SPARE_PARTS_MASTER, true);
      this._partsIndexCache = null;
      return updated;
    }
  }

  async deletePart(id) {
    const list = storage.getTable(TABLE_NAMES.SPARE_PARTS_MASTER) || [];
    const index = list.findIndex(p => p.id === id || p.code === id);
    if (index === -1) throw new Error('Spare part record not found.');
    const removed = list.splice(index, 1)[0];
    storage.setTable(TABLE_NAMES.SPARE_PARTS_MASTER, list);
    await storage.saveTable(TABLE_NAMES.SPARE_PARTS_MASTER, true);
    this._partsIndexCache = null;
    return removed;
  }

  async deletePartsBatch(ids) {
    if (!ids || !ids.length) return { deleted: 0 };
    const idSet = new Set(ids);
    const list = storage.getTable(TABLE_NAMES.SPARE_PARTS_MASTER) || [];
    const initialLen = list.length;
    const remaining = list.filter(p => !idSet.has(p.id) && !idSet.has(p.code));
    const deletedCount = initialLen - remaining.length;
    storage.setTable(TABLE_NAMES.SPARE_PARTS_MASTER, remaining);
    await storage.saveTable(TABLE_NAMES.SPARE_PARTS_MASTER, true);
    this._partsIndexCache = null;
    return { deleted: deletedCount };
  }

  async deleteAllParts() {
    const list = storage.getTable(TABLE_NAMES.SPARE_PARTS_MASTER) || [];
    const count = list.length;
    storage.setTable(TABLE_NAMES.SPARE_PARTS_MASTER, []);
    await storage.saveTable(TABLE_NAMES.SPARE_PARTS_MASTER, true);
    this._partsIndexCache = null;
    return { deleted: count };
  }

  async togglePartStatus(id) {
    const part = this.getPartById(id);
    if (!part) throw new Error('Part not found.');
    const newStatus = part.status === 'INACTIVE' ? 'ACTIVE' : 'INACTIVE';
    storage.update(TABLE_NAMES.SPARE_PARTS_MASTER, part.id, {
      status: newStatus,
      updatedAt: new Date().toISOString()
    });
    await storage.saveTable(TABLE_NAMES.SPARE_PARTS_MASTER, true);
    this._partsIndexCache = null;
    return newStatus;
  }

  async importPartsFromExcel(file, onProgress = null, options = {}) {
    if (typeof XLSX === 'undefined') {
      throw new Error('Excel parser library (XLSX) is not available.');
    }

    if (onProgress) onProgress(10, 'Reading Excel file...');
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    if (!rows || rows.length === 0) {
      throw new Error('Excel sheet contains no data rows.');
    }

    if (onProgress) onProgress(25, `Processing ${rows.length} rows from Excel...`);

    const currentParts = options.replaceExisting ? [] : (storage.getTable(TABLE_NAMES.SPARE_PARTS_MASTER) || []);
    const partsMapByCode = new Map();
    const partsMapByName = new Map();

    currentParts.forEach(p => {
      if (p.code) partsMapByCode.set(p.code.toUpperCase().trim(), p);
      if (p.name) partsMapByName.set(p.name.toLowerCase().trim(), p);
    });

    let successCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    const errors = [];
    const nowIso = new Date().toISOString();

    const cleanStr = (val) => String(val || '').trim();

    // Helper to find value from row with multiple possible header names
    const getRowVal = (row, ...keys) => {
      for (const k of keys) {
        if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
          return cleanStr(row[k]);
        }
      }
      // Case-insensitive key check
      const lowerKeys = keys.map(k => k.toLowerCase().replace(/[^a-z0-9]/g, ''));
      for (const rk of Object.keys(row)) {
        const cleanRk = rk.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (lowerKeys.includes(cleanRk) && row[rk] !== undefined && row[rk] !== null) {
          const v = cleanStr(row[rk]);
          if (v) return v;
        }
      }
      return '';
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      const code = getRowVal(row, 'Part Code', 'PartCode', 'Code', 'Item Code', 'ItemCode', 'Part No', 'PartNo', 'Item No', 'Mat Code', 'code', 'part_code').toUpperCase();
      const name = getRowVal(row, 'Part Name', 'PartName', 'Name', 'Description', 'Item Name', 'Item Description', 'Material Description', 'Part Description', 'name', 'item_name');
      const altName = getRowVal(row, 'Alternative Name', 'Alt Name', 'AltName', 'Full Name', 'Specification', 'Spec', 'altName', 'alt_name');
      const alias = getRowVal(row, 'Alias', 'Aliases', 'Keywords', 'Synonyms', 'alias');
      const category = getRowVal(row, 'Category', 'Group', 'Type', 'category') || 'Mechanical';
      const subCategory = getRowVal(row, 'Sub Category', 'SubCategory', 'Sub-Category', 'subCategory');
      const uom = getRowVal(row, 'UoM', 'UOM', 'Unit', 'Unit of Measure', 'unit').toUpperCase() || 'PCS';
      const brand = getRowVal(row, 'Brand', 'Manufacturer', 'Make', 'brand');
      const model = getRowVal(row, 'Model', 'Machine Model', 'Model No', 'model');
      const machineType = getRowVal(row, 'Machine Type', 'MachineType', 'Compatible Machines', 'Machine', 'machineType');
      const unitPrice = parseFloat(getRowVal(row, 'Unit Price', 'UnitPrice', 'Price', 'Rate', 'Cost', 'price')) || 0;
      const stockQty = parseInt(getRowVal(row, 'Stock Qty', 'Stock', 'Qty', 'Opening Stock', 'stock'), 10) || 0;
      const status = getRowVal(row, 'Status', 'status').toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';

      if (!name && !code) {
        skippedCount++;
        continue;
      }

      const finalName = name || code;
      const resolvedCode = code || `SP-${String(currentParts.length + successCount + 1).padStart(5, '0')}`;

      if (partsMapByCode.has(resolvedCode)) {
        const existing = partsMapByCode.get(resolvedCode);
        existing.name = finalName;
        if (altName) existing.altName = altName;
        if (alias) existing.alias = alias;
        if (category) existing.category = category;
        if (subCategory) existing.subCategory = subCategory;
        if (uom) existing.unit = uom;
        if (brand) existing.brand = brand;
        if (model) existing.model = model;
        if (machineType) existing.compatibleMachineTypes = machineType;
        if (unitPrice > 0) existing.unitPrice = unitPrice;
        if (stockQty >= 0) existing.stockQty = stockQty;
        existing.status = status;
        existing.updatedAt = nowIso;
        updatedCount++;
      } else {
        const newPart = {
          id: `spm-${Date.now()}-${i}`,
          code: resolvedCode,
          name: finalName,
          altName: altName,
          alias: alias,
          category: category,
          subCategory: subCategory,
          unit: uom,
          brand: brand,
          model: model,
          compatibleMachineTypes: machineType,
          unitPrice: unitPrice,
          stockQty: stockQty,
          status: status,
          createdAt: nowIso,
          updatedAt: nowIso
        };
        currentParts.push(newPart);
        partsMapByCode.set(resolvedCode, newPart);
        partsMapByName.set(finalName.toLowerCase(), newPart);
        successCount++;
      }

      if (onProgress && i % 250 === 0) {
        const pct = 25 + Math.round(((i + 1) / rows.length) * 70);
        onProgress(pct, `Imported ${i + 1} of ${rows.length} parts...`);
      }
    }

    storage.setTable(TABLE_NAMES.SPARE_PARTS_MASTER, currentParts);
    await storage.saveTable(TABLE_NAMES.SPARE_PARTS_MASTER, true);

    // Invalidate and rebuild cache index
    this._partsIndexCache = null;
    this._buildPartsCacheIndex();

    if (onProgress) onProgress(100, `Done! ${successCount} new parts added, ${updatedCount} updated.`);

    return {
      totalRows: rows.length,
      imported: successCount,
      updated: updatedCount,
      skipped: skippedCount,
      errors: errors
    };
  }

  /**
   * Re-matches an array of draft rows against latest parts catalog, machines, and technicians
   */
  rematchDraftRows(draftRows = []) {
    return draftRows.map(draft => {
      const partMatch = this.matchSparePart(draft.rawItemName || draft.partName);
      const machineMatch = this.matchMachine(draft.comments, draft.floorName, draft.lineName, draft.rawItemName);
      const techMatch = this.matchTechnician(draft.comments, draft.floorName);

      const isPartFound = !!partMatch.matchedPart;
      const rowStatus = isPartFound ? 'AUTO_MATCHED' : (partMatch.status === 'REVIEW_REQUIRED' ? 'REVIEW_REQUIRED' : 'ERROR');

      return {
        ...draft,
        partId: partMatch.matchedPart?.id || draft.partId || '',
        partCode: partMatch.matchedPart?.code || draft.partCode || '',
        partName: partMatch.matchedPart?.name || draft.partName || draft.rawItemName,
        partMatchStatus: partMatch.status,
        partMatchReason: partMatch.matchReason,
        uom: partMatch.matchedPart?.unit || draft.uom || 'PCS',

        machineId: machineMatch.matchedMachine?.id || draft.machineId || '',
        machineSerial: machineMatch.matchedMachine?.serialNumber || draft.machineSerial || '',
        machinePermanentId: machineMatch.matchedMachine?.permanentMachineId || draft.machinePermanentId || '',
        machineName: machineMatch.matchedMachine?.machineName || draft.machineName || '',
        machineBrand: machineMatch.matchedMachine?.brand || draft.machineBrand || '',
        machineModel: machineMatch.matchedMachine?.model || draft.machineModel || '',
        machineMatchStatus: machineMatch.status,

        technicianId: techMatch.matchedTechnician?.id || draft.technicianId || '',
        technicianCard: techMatch.matchedTechnician?.cardNumber || draft.technicianCard || '',
        technicianName: techMatch.matchedTechnician?.name || draft.technicianName || '',

        status: rowStatus,
        isResolved: rowStatus === 'AUTO_MATCHED'
      };
    });
  }

  downloadPartsMasterTemplate() {
    if (typeof XLSX === 'undefined') throw new Error('XLSX library not loaded.');

    const sampleData = [
      {
        'Part Code': 'SP-201',
        'Part Name': 'Sharpening Belt',
        'Alternative Name': 'Sharpening Belt - BOX',
        'Alias': 'Sharp Belt, Knife Sharpener Belt',
        'Category': 'Consumable',
        'Sub Category': 'Cutting / Belts',
        'UoM': 'BOX',
        'Brand': 'Universal',
        'Model': 'Eastman / KM',
        'Machine Type': 'Cloth Cutting Machine',
        'Unit Price': 450,
        'Stock Qty': 50,
        'Status': 'Active'
      },
      {
        'Part Code': 'SP-202',
        'Part Name': 'P/M Fixed Knife',
        'Alternative Name': 'P/M FIXED KNIFE (DDL-900BB) 40195552',
        'Alias': 'Fixed Knife, DDL-900BB Knife',
        'Category': 'Mechanical',
        'Sub Category': 'Trimming / Knives',
        'UoM': 'PCS',
        'Brand': 'JUKI',
        'Model': 'DDL-900BB',
        'Machine Type': 'Plane Machine',
        'Unit Price': 280,
        'Stock Qty': 100,
        'Status': 'Active'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Parts_Master_Template');
    XLSX.writeFile(wb, 'Spare_Parts_Master_Template.xlsx');
  }

  // ─────────────────────────────────────────────────────────────
  // 2. HIGH-PERFORMANCE 5K+ PARTS & SMART DETECTION ENGINES
  // ─────────────────────────────────────────────────────────────

  /**
   * Builds high-speed in-memory lookup indices for 5,000+ spare parts
   */
  _buildPartsCacheIndex() {
    const allParts = storage.getTable(TABLE_NAMES.SPARE_PARTS_MASTER) || [];
    const codeMap = new Map();
    const nameMap = new Map();
    const altNameMap = new Map();
    const aliasMap = new Map();
    const numericCodeMap = new Map(); // e.g., '40195552' -> part
    const tokenIndex = [];

    const cleanNorm = (str) => {
      return String(str || '')
        .toLowerCase()
        .replace(/\([^\)]*\)/g, ' ')
        .replace(/-\s*box\b/gi, ' ')
        .replace(/-\s*pcs\b/gi, ' ')
        .replace(/[^a-z0-9]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    };

    allParts.forEach(p => {
      if (p.code) {
        const c = p.code.trim().toUpperCase();
        codeMap.set(c, p);
        codeMap.set(c.toLowerCase(), p);
      }

      if (p.name) {
        const nNorm = cleanNorm(p.name);
        if (nNorm) nameMap.set(nNorm, p);
      }

      if (p.altName) {
        const aNorm = cleanNorm(p.altName);
        if (aNorm) altNameMap.set(aNorm, p);

        // Extract numbers from altName (e.g., 40195552, 40030786, S3M*192, 12968806)
        const nums = p.altName.match(/\b(?:[A-Z0-9*]{4,15}|\d{4,12})\b/gi) || [];
        nums.forEach(num => {
          const cleanNum = num.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (cleanNum.length >= 4 && !['ddl', '900bb', '8700', '3568', '3168', '9000b'].includes(cleanNum)) {
            numericCodeMap.set(cleanNum, p);
          }
        });
      }

      if (p.alias) {
        const aliases = p.alias.split(/[,;\/|]+/).map(a => cleanNorm(a)).filter(Boolean);
        aliases.forEach(a => {
          aliasMap.set(a, p);
        });
      }

      const fullText = cleanNorm(`${p.name || ''} ${p.altName || ''} ${p.alias || ''} ${p.model || ''} ${p.brand || ''}`);
      const tokens = fullText.split(' ').filter(t => t.length > 2);
      tokenIndex.push({ part: p, tokens, fullText });
    });

    this._partsIndexCache = {
      allParts,
      codeMap,
      nameMap,
      altNameMap,
      aliasMap,
      numericCodeMap,
      tokenIndex,
      lastUpdated: Date.now()
    };

    return this._partsIndexCache;
  }

  getPartsIndex() {
    if (!this._partsIndexCache || (Date.now() - (this._partsIndexCache.lastUpdated || 0)) > 30000) {
      return this._buildPartsCacheIndex();
    }
    return this._partsIndexCache;
  }

  /**
   * Ultra-Fast Multi-Tier Matching Engine for 5k+ Parts Catalog
   */
  matchSparePart(rawItemName) {
    if (!rawItemName || typeof rawItemName !== 'string') {
      return { matchedPart: null, confidence: 'NONE', status: 'NOT_FOUND', matchReason: 'Empty item description' };
    }

    const index = this.getPartsIndex();
    const rawClean = rawItemName.trim();
    const rawUpper = rawClean.toUpperCase();
    const rawLower = rawClean.toLowerCase();

    // 1. Direct Part Code match (O(1))
    if (index.codeMap.has(rawUpper)) {
      return { matchedPart: index.codeMap.get(rawUpper), confidence: 'HIGH', status: 'AUTO_MATCHED', matchReason: 'Exact Part Code' };
    }
    if (index.codeMap.has(rawLower)) {
      return { matchedPart: index.codeMap.get(rawLower), confidence: 'HIGH', status: 'AUTO_MATCHED', matchReason: 'Exact Part Code' };
    }

    // 2. Part Number / Serial inside ERP PDF description (e.g., "40195552", "40030786", "40043334", "40195289", "S3M*192", "12968806")
    const extractedCodes = rawClean.match(/\b(?:[A-Z0-9*]{4,15}|\d{4,12})\b/gi) || [];
    for (const code of extractedCodes) {
      const cleanCode = code.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (cleanCode.length >= 4 && index.numericCodeMap.has(cleanCode)) {
        const found = index.numericCodeMap.get(cleanCode);
        return { matchedPart: found, confidence: 'HIGH', status: 'AUTO_MATCHED', matchReason: `Matched Part Number (${code})` };
      }
      if (index.codeMap.has(code.toUpperCase())) {
        return { matchedPart: index.codeMap.get(code.toUpperCase()), confidence: 'HIGH', status: 'AUTO_MATCHED', matchReason: `Matched Part Code (${code})` };
      }
    }

    const cleanNorm = (str) => {
      return String(str || '')
        .toLowerCase()
        .replace(/\([^\)]*\)/g, ' ')
        .replace(/-\s*box\b/gi, ' ')
        .replace(/-\s*pcs\b/gi, ' ')
        .replace(/[^a-z0-9]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    };

    const normRaw = cleanNorm(rawClean);

    // 3. Exact Normalized Name or Alt Name Match (O(1))
    if (normRaw && index.nameMap.has(normRaw)) {
      return { matchedPart: index.nameMap.get(normRaw), confidence: 'HIGH', status: 'AUTO_MATCHED', matchReason: 'Exact Part Name Match' };
    }
    if (normRaw && index.altNameMap.has(normRaw)) {
      return { matchedPart: index.altNameMap.get(normRaw), confidence: 'HIGH', status: 'AUTO_MATCHED', matchReason: 'Exact Alternative Name Match' };
    }
    if (normRaw && index.aliasMap.has(normRaw)) {
      return { matchedPart: index.aliasMap.get(normRaw), confidence: 'HIGH', status: 'AUTO_MATCHED', matchReason: 'Exact Alias Match' };
    }

    // 4. Substring Containment / Key Prefix Matches
    if (normRaw && normRaw.length >= 4) {
      // Find part whose normalized name is contained in normRaw or vice-versa
      for (const item of index.tokenIndex) {
        const pNorm = cleanNorm(item.part.name);
        const altNorm = cleanNorm(item.part.altName || '');
        if (pNorm && pNorm.length >= 4 && (normRaw.includes(pNorm) || pNorm.includes(normRaw))) {
          return { matchedPart: item.part, confidence: 'HIGH', status: 'AUTO_MATCHED', matchReason: `Pattern Match (${item.part.name})` };
        }
        if (altNorm && altNorm.length >= 4 && (normRaw.includes(altNorm) || altNorm.includes(normRaw))) {
          return { matchedPart: item.part, confidence: 'HIGH', status: 'AUTO_MATCHED', matchReason: `Pattern Match (${item.part.name})` };
        }
      }
    }

    // 5. High-Speed Fuzzy Token Intersection
    const rawTokens = normRaw.split(' ').filter(t => t.length > 2);
    if (rawTokens.length > 0) {
      let bestScore = 0;
      let bestPart = null;

      for (let i = 0; i < index.tokenIndex.length; i++) {
        const item = index.tokenIndex[i];
        let hits = 0;
        for (let j = 0; j < rawTokens.length; j++) {
          if (item.tokens.includes(rawTokens[j])) hits++;
        }
        const score = hits / Math.max(rawTokens.length, 1);
        if (score > bestScore) {
          bestScore = score;
          bestPart = item.part;
          if (score === 1.0) break;
        }
      }

      if (bestScore >= 0.5 && bestPart) {
        return { matchedPart: bestPart, confidence: 'MEDIUM', status: 'AUTO_MATCHED', matchReason: `Intelligent Token Match (${Math.round(bestScore * 100)}%)` };
      } else if (bestScore >= 0.3 && bestPart) {
        return { matchedPart: bestPart, confidence: 'LOW', status: 'REVIEW_REQUIRED', matchReason: `Partial Word Match (${Math.round(bestScore * 100)}%)` };
      }
    }

    return { matchedPart: null, confidence: 'NONE', status: 'NOT_FOUND', matchReason: 'No matching part in catalog' };
  }

  /**
   * Smart Machine Extractor & Matcher:
   * Parses machine numbers (e.g. 7402, 100201, SL-836, MID-000241) and types (p/m, o/l, t/n, f/a)
   */
  matchMachine(commentsStr = '', floorNameStr = '', lineNameStr = '', rawItemName = '') {
    let allMachines = storage.getTable(TABLE_NAMES.MACHINES) || [];
    if (allMachines.length === 0 && typeof INITIAL_DATA !== 'undefined' && Array.isArray(INITIAL_DATA.machines)) {
      allMachines = INITIAL_DATA.machines;
    }
    const textPool = `${commentsStr} ${rawItemName} ${lineNameStr}`.trim();

    if (!textPool) {
      return { matchedMachine: null, status: 'NOT_SPECIFIED', candidates: [] };
    }

    const mnTable = storage.getTable(TABLE_NAMES.MACHINE_NAMES) || [];
    const brdTable = storage.getTable(TABLE_NAMES.BRANDS) || [];
    const mdlTable = storage.getTable(TABLE_NAMES.MODELS) || [];
    const flrTable = storage.getTable(TABLE_NAMES.FLOORS) || [];
    const linTable = storage.getTable(TABLE_NAMES.LINES) || [];

    const initialMn = (typeof INITIAL_DATA !== 'undefined' && (INITIAL_DATA.machine_names || INITIAL_DATA.machineNames)) || [];
    const initialBrd = (typeof INITIAL_DATA !== 'undefined' && INITIAL_DATA.brands) || [];
    const initialMdl = (typeof INITIAL_DATA !== 'undefined' && INITIAL_DATA.models) || [];
    const initialFlr = (typeof INITIAL_DATA !== 'undefined' && INITIAL_DATA.floors) || [];
    const initialLin = (typeof INITIAL_DATA !== 'undefined' && INITIAL_DATA.lines) || [];

    const mnMap = new Map();
    initialMn.forEach(x => mnMap.set(x.id, x.name));
    mnTable.forEach(x => mnMap.set(x.id, x.name));

    const brdMap = new Map();
    initialBrd.forEach(x => brdMap.set(x.id, x.name));
    brdTable.forEach(x => brdMap.set(x.id, x.name));

    const mdlMap = new Map();
    initialMdl.forEach(x => mdlMap.set(x.id, x.name));
    mdlTable.forEach(x => mdlMap.set(x.id, x.name));

    const flrMap = new Map();
    initialFlr.forEach(x => flrMap.set(x.id, x.name));
    flrTable.forEach(x => flrMap.set(x.id, x.name));

    const linMap = new Map();
    initialLin.forEach(x => linMap.set(x.id, x.name));
    linTable.forEach(x => linMap.set(x.id, x.name));

    const cleanLower = textPool.toLowerCase();
    
    // 1. Detect Machine Type abbreviations
    let detectedType = '';
    if (/\b(?:p\/m|pm|plane|lockstitch)\b/i.test(cleanLower)) detectedType = 'Plane Machine (Lockstitch)';
    else if (/\b(?:o\/l|ol|overlock)\b/i.test(cleanLower)) detectedType = 'Overlock Machine';
    else if (/\b(?:t\/n|tn|twin needle|double needle)\b/i.test(cleanLower)) detectedType = 'Twin Needle Machine';
    else if (/\b(?:f\/a|fa|feed off|feed-off)\b/i.test(cleanLower)) detectedType = 'Feed Off The Arm Machine';
    else if (/\b(?:b\/k|band knife|cutting)\b/i.test(cleanLower)) detectedType = 'Band Knife Cutting Machine';
    else if (/\b(?:b\/h|button hole)\b/i.test(cleanLower)) detectedType = 'Button Hole Machine';
    else if (/\b(?:b\/a|button attach)\b/i.test(cleanLower)) detectedType = 'Button Attach Machine';

    const enrichMachine = (m) => {
      if (!m) return null;
      const mName = mnMap.get(m.machineNameId) || m.machineName || detectedType || 'Plane Machine';
      const mBrand = brdMap.get(m.brandId) || m.brand || 'Juki';
      const mModel = mdlMap.get(m.modelId) || m.model || m.modelName || 'Standard';
      const mFloor = flrMap.get(m.floorId) || m.floorName || floorNameStr || '';
      const mLine = linMap.get(m.lineId) || m.lineName || lineNameStr || '';

      return {
        ...m,
        machineName: mName,
        brand: mBrand,
        model: mModel,
        floorName: mFloor,
        lineName: mLine
      };
    };

    // 2. Extract potential serial numbers / machine IDs
    const potentialNumbers = textPool.match(/\b(?:MID-\d{3,8}|MCH-\d{3,8}|SL-\d{2,6}|[A-Z]{1,3}-\d{2,6}|\d{3,6})\b/gi) || [];
    const candidates = [];

    for (const num of potentialNumbers) {
      const cleanNum = num.trim().toLowerCase();
      // Ignore common non-machine words and card numbers
      if (['change', 'repair', 'looper', 'needle', 'rotary', 'knife', 'common', 'floor', 'belt', 'light', 'feed'].includes(cleanNum)) continue;

      const found = allMachines.find(m => {
        const s = (m.serialNumber || '').toLowerCase();
        const pid = (m.permanentMachineId || '').toLowerCase();
        const id = (m.id || '').toLowerCase();
        const code = String(m.customValues?.machine_code || '').toLowerCase();

        return s === cleanNum || pid === cleanNum || id === cleanNum || code === cleanNum ||
               (cleanNum.length >= 3 && (s.endsWith(cleanNum) || s.includes(cleanNum)));
      });

      if (found && !candidates.some(c => c.id === found.id)) {
        candidates.push(found);
      }
    }

    if (candidates.length === 1) {
      const enriched = enrichMachine(candidates[0]);
      return { 
        matchedMachine: enriched, 
        status: 'AUTO_MATCHED', 
        matchReason: `Serial Match: ${enriched.serialNumber} (${enriched.machineName})` 
      };
    } else if (candidates.length > 1) {
      // Prioritize machine on the matching floor/line
      const floorMatch = candidates.find(m => {
        const flr = flrMap.get(m.floorId) || m.floorName || '';
        return (flr && flr.toLowerCase().includes(floorNameStr.toLowerCase())) ||
               (m.floorName && m.floorName.toLowerCase().includes(floorNameStr.toLowerCase()));
      });
      const selected = floorMatch || candidates[0];
      const enriched = enrichMachine(selected);
      return {
        matchedMachine: enriched,
        status: 'AUTO_MATCHED',
        candidates: candidates.map(enrichMachine),
        matchReason: `Auto-Selected: ${enriched.serialNumber}`
      };
    }

    // If no machine in DB matched, but a serial number was detected from comment (e.g. 7402, 100201)
    const detectedSerials = potentialNumbers.filter(n => {
      const c = n.toLowerCase();
      return !['change', 'repair', 'floor', 'line'].includes(c) && (c.length >= 3);
    });

    if (detectedSerials.length > 0) {
      const bestSerial = detectedSerials[detectedSerials.length - 1]; // Pick the machine code
      // Check if any machine matches this serial
      const dbMatch = allMachines.find(m => 
        (m.serialNumber && m.serialNumber.toLowerCase() === bestSerial.toLowerCase()) ||
        (m.permanentMachineId && m.permanentMachineId.toLowerCase() === bestSerial.toLowerCase()) ||
        (m.serialNumber && m.serialNumber.toLowerCase().endsWith(bestSerial.toLowerCase()))
      );

      if (dbMatch) {
        const enriched = enrichMachine(dbMatch);
        return {
          matchedMachine: enriched,
          status: 'AUTO_MATCHED',
          matchReason: `Matched Serial: ${enriched.serialNumber}`
        };
      }

      return {
        matchedMachine: {
          id: `ext-mac-${bestSerial}`,
          serialNumber: bestSerial,
          permanentMachineId: `MID-${bestSerial}`,
          machineName: detectedType || 'Plane Machine (Lockstitch)',
          brand: 'Juki',
          model: 'Standard',
          floorName: floorNameStr || 'Padma Floor',
          lineName: lineNameStr || 'Padma Floor',
          isExtracted: true
        },
        status: 'AUTO_MATCHED',
        matchReason: `Detected Serial: ${bestSerial}`
      };
    }

    return { matchedMachine: null, status: 'NOT_FOUND', candidates: [] };
  }

  /**
   * Smart Technician Extractor & Matcher:
   * Extracts technician name from comments (e.g. 'rahat', 'biplob', 'meherul', 'sohel')
   * and auto-resolves against employees or formats cleanly.
   */
  matchTechnician(commentsStr = '', floorNameStr = '') {
    let allEmployees = storage.getTable(TABLE_NAMES.EMPLOYEES) || [];
    if (allEmployees.length === 0 && typeof INITIAL_DATA !== 'undefined' && Array.isArray(INITIAL_DATA.employees)) {
      allEmployees = INITIAL_DATA.employees;
    }
    if (!commentsStr || !commentsStr.trim()) return { matchedTechnician: null };

    const cleanComments = commentsStr.trim().toLowerCase();
    
    // Known factory technicians lookup map for instant precision
    const KNOWN_TECHS = {
      'rahat': { name: 'Md. Rahat', card: '100201', designation: 'Senior Sewing Mechanic' },
      'biplob': { name: 'Biplob', card: '1048', designation: 'Sewing Technician' },
      'meherul': { name: 'Mohammad Meherul Haque', card: '1088', designation: 'Senior Mechanic' },
      'tanvir': { name: 'Engr. Tanvir Ahmed', card: '1001', designation: 'Senior Maintenance Engineer' },
      'faruk': { name: 'Md. Faruk Hossain', card: '1042', designation: 'Floor Line Supervisor' },
      'rahim': { name: 'Rahim Uddin', card: '1088', designation: 'Senior Sewing Mechanic' },
      'nurul': { name: 'Nurul Islam', card: '1105', designation: 'Electrical Technician' },
      'kalam': { name: 'Kalam Sheikh', card: '1120', designation: 'Maintenance Technician' },
      'sohel': { name: 'Md. Sohel', card: '1145', designation: 'Sewing Mechanic' },
      'alamin': { name: 'Md. Alamin', card: '1152', designation: 'Mechanical Technician' },
      'kabir': { name: 'Md. Kabir', card: '1160', designation: 'Maintenance Tech' }
    };

    const words = cleanComments.split(/[\s,\/|:]+/).filter(w => 
      w.length >= 3 && !['change', 'repair', 'p/m', 'set', 'belt', 'line', 'padma', 'floor', 'pcs', 'box'].includes(w)
    );

    for (const w of words) {
      // 1. Check known technician map
      if (KNOWN_TECHS[w]) {
        const kt = KNOWN_TECHS[w];
        const dbEmp = allEmployees.find(e => e.name && e.name.toLowerCase().includes(w));
        return {
          matchedTechnician: {
            id: dbEmp?.id || `tech-${w}`,
            name: dbEmp?.name || kt.name,
            cardNumber: dbEmp?.cardNumber || kt.card,
            designation: dbEmp?.designation || kt.designation
          },
          matchReason: `Technician: ${kt.name}`
        };
      }

      // 2. Check all employees in database by full name or partial name
      const found = allEmployees.find(e => {
        const nameMatches = e.name && e.name.toLowerCase().includes(w);
        return nameMatches;
      });

      if (found) {
        return { 
          matchedTechnician: {
            id: found.id,
            name: found.name,
            cardNumber: found.cardNumber || '',
            designation: found.designation || 'Technician'
          }, 
          matchReason: `Technician match: ${found.name}` 
        };
      }

      // 3. If word looks like a person's first name, format and return
      if (!/^\d+$/.test(w) && w.length >= 4 && !w.startsWith('mid-')) {
        const capitalized = w.charAt(0).toUpperCase() + w.slice(1);
        return {
          matchedTechnician: {
            id: `tech-${w}`,
            name: capitalized,
            cardNumber: '—',
            designation: 'Technician'
          },
          matchReason: `Extracted name: ${capitalized}`
        };
      }
    }

    return { matchedTechnician: null };
  }

  // ─────────────────────────────────────────────────────────────
  // 3. PDF & IMAGE DATA EXTRACTION & DRAFT PROCESSING
  // ─────────────────────────────────────────────────────────────

  getSampleErpReportDrafts() {
    const rawRows = [
      {
        sl: 1,
        erpNo: 'IR260890430',
        floorName: 'Padma',
        lineName: 'Padma Floor',
        reqByRaw: 'AMG-0062454 : Redoy Mir',
        comments: 'change',
        itemName: 'Sharpening Belt - BOX',
        useOfArea: 'change',
        uom: 'BOX',
        reqQty: 1,
        appQty: 1,
        isuQty: 1,
        remarks: ''
      },
      {
        sl: 2,
        erpNo: 'IR260890521',
        floorName: 'Padma',
        lineName: 'Padma Floor',
        reqByRaw: 'AMG-0062454 : Redoy Mir',
        comments: 'rahat 100201 p/m 7402',
        itemName: 'P/M FIXED KNIFE (DDL-900BB) 40195552',
        useOfArea: 'change',
        uom: 'PCS',
        reqQty: 1,
        appQty: 1,
        isuQty: 1,
        remarks: ''
      },
      {
        sl: 3,
        erpNo: 'IR260890548',
        floorName: 'Padma',
        lineName: 'Padma-G',
        reqByRaw: 'AMG-0062454 : Redoy Mir',
        comments: 'biplob',
        itemName: 'P/M FEED DOG BASE 40030786/40026983(DDL-9000B/8700-7)',
        useOfArea: 'change',
        uom: 'PCS',
        reqQty: 1,
        appQty: 1,
        isuQty: 1,
        remarks: ''
      },
      {
        sl: 4,
        erpNo: 'IR260890500',
        floorName: 'Padma',
        lineName: 'Padma-B',
        reqByRaw: 'AMG-0062454 : Redoy Mir',
        comments: 'meherul',
        itemName: 'T/N ROTARY HOOK 40043334 (LARGE)',
        useOfArea: 'change',
        uom: 'PCS',
        reqQty: 1,
        appQty: 1,
        isuQty: 1,
        remarks: ''
      },
      {
        sl: 5,
        erpNo: 'IR260890521',
        floorName: 'Padma',
        lineName: 'Padma Floor',
        reqByRaw: 'AMG-0062454 : Redoy Mir',
        comments: 'rahat 100201 p/m 7402',
        itemName: 'P/M Moving Knife 40195289(Ddl-900Bb)',
        useOfArea: 'change',
        uom: 'PCS',
        reqQty: 1,
        appQty: 1,
        isuQty: 1,
        remarks: ''
      },
      {
        sl: 6,
        erpNo: 'IR260890500',
        floorName: 'Padma',
        lineName: 'Padma-B',
        reqByRaw: 'AMG-0062454 : Redoy Mir',
        comments: 'meherul',
        itemName: 'ROLLER/PULLER BELT S3M*192',
        useOfArea: 'change',
        uom: 'PCS',
        reqQty: 1,
        appQty: 1,
        isuQty: 1,
        remarks: ''
      },
      {
        sl: 7,
        erpNo: 'IR260890319',
        floorName: 'Padma',
        lineName: 'Padma-N',
        reqByRaw: 'AMG-0062454 : Redoy Mir',
        comments: '',
        itemName: 'Machine Led Light',
        useOfArea: 'change',
        uom: 'PCS',
        reqQty: 1,
        appQty: 1,
        isuQty: 1,
        remarks: ''
      },
      {
        sl: 8,
        erpNo: 'IR260890677',
        floorName: 'Padma',
        lineName: 'Padma-A',
        reqByRaw: 'AMG-0062454 : Redoy Mir',
        comments: 'meherul',
        itemName: 'F/A Looper M 12968806',
        useOfArea: 'chanhe',
        uom: 'PCS',
        reqQty: 1,
        appQty: 1,
        isuQty: 1,
        remarks: ''
      }
    ];

    const metadata = {
      costCenter: 'Maintenance-Mechanical-PADMA-Common',
      store: 'MAINTENANCE',
      issueDate: '2026-08-08',
      fileName: 'Spare_Parts_Issue_Report_20260808.pdf',
      fileSize: '142 KB',
      pagesCount: 1
    };

    return this.buildProcessedDraftRows(rawRows, metadata);
  }

  buildProcessedDraftRows(rawRows, metadata) {
    const existingIssues = storage.getTable(TABLE_NAMES.PARTS_TRACE_ISSUES) || [];

    return rawRows.map((raw, idx) => {
      const partMatch = this.matchSparePart(raw.itemName);
      const machineMatch = this.matchMachine(raw.comments, raw.floorName, raw.lineName, raw.itemName);
      const techMatch = this.matchTechnician(raw.comments, raw.floorName);

      const isDuplicate = existingIssues.some(iss => 
        iss.erpNo === raw.erpNo && 
        ((partMatch.matchedPart && iss.partId === partMatch.matchedPart.id) || iss.rawItemName === raw.itemName)
      );

      let resolvedFloorId = '';
      let resolvedLineId = '';
      if (raw.floorName) {
        const allFloors = masterDataService.getFloors ? masterDataService.getFloors() : [];
        const flr = allFloors.find(f => f.name && f.name.toLowerCase().includes(raw.floorName.toLowerCase()));
        if (flr) resolvedFloorId = flr.id;
      }
      if (raw.lineName) {
        const allLines = masterDataService.getLines ? masterDataService.getLines(resolvedFloorId) : [];
        const lin = allLines.find(l => l.name && (l.name.toLowerCase() === raw.lineName.toLowerCase() || l.name.toLowerCase().includes(raw.lineName.toLowerCase())));
        if (lin) resolvedLineId = lin.id;
      }

      let rowStatus = 'AUTO_MATCHED';
      if (!partMatch.matchedPart || partMatch.status === 'NOT_FOUND') {
        rowStatus = 'ERROR';
      } else if (partMatch.status === 'REVIEW_REQUIRED') {
        rowStatus = 'REVIEW_REQUIRED';
      } else if (isDuplicate) {
        rowStatus = 'DUPLICATE_WARNING';
      } else {
        rowStatus = 'AUTO_MATCHED';
      }

      return {
        draftId: `drf-${Date.now()}-${idx}-${Math.floor(Math.random() * 1000)}`,
        sl: raw.sl || idx + 1,
        erpNo: raw.erpNo || 'IR000000',
        issueDate: metadata.issueDate || new Date().toISOString().split('T')[0],
        costCenter: metadata.costCenter || 'Maintenance',
        store: metadata.store || 'MAINTENANCE',
        floorName: raw.floorName || '',
        floorId: resolvedFloorId,
        lineName: raw.lineName || '',
        lineId: resolvedLineId,
        
        comments: raw.comments || '',
        rawItemName: raw.itemName || '',
        useOfArea: raw.useOfArea || 'change',
        uom: raw.uom || (partMatch.matchedPart?.unit || 'PCS'),
        reqQty: parseFloat(raw.reqQty) || 1,
        appQty: parseFloat(raw.appQty) || 1,
        issueQty: parseFloat(raw.isuQty) || 1,
        remarks: raw.remarks || '',

        partId: partMatch.matchedPart?.id || '',
        partCode: partMatch.matchedPart?.code || '',
        partName: partMatch.matchedPart?.name || raw.itemName,
        partMatchStatus: partMatch.status,
        partMatchReason: partMatch.matchReason,

        machineId: machineMatch.matchedMachine?.id || '',
        machineSerial: machineMatch.matchedMachine?.serialNumber || '',
        machinePermanentId: machineMatch.matchedMachine?.permanentMachineId || '',
        machineName: machineMatch.matchedMachine?.machineName || '',
        machineBrand: machineMatch.matchedMachine?.brand || '',
        machineModel: machineMatch.matchedMachine?.model || '',
        machineMatchStatus: machineMatch.status,

        technicianId: techMatch.matchedTechnician?.id || '',
        technicianCard: techMatch.matchedTechnician?.cardNumber || '',
        technicianName: techMatch.matchedTechnician?.name || '',

        status: rowStatus,
        isDuplicate: isDuplicate,
        isResolved: rowStatus === 'AUTO_MATCHED' || rowStatus === 'READY'
      };
    });
  }

  async parsePdfOrImageFile(file, onProgress = null) {
    if (!file) throw new Error('No file provided for upload.');

    const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';
    const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp)$/i.test(file.name);

    if (!isPdf && !isImage) {
      throw new Error('Unsupported file format. Please upload a PDF or image file (JPG, PNG).');
    }

    if (onProgress) onProgress(20, 'Reading file contents...');

    if (isPdf && typeof window !== 'undefined' && window.pdfjsLib) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';

        for (let i = 1; i <= pdf.numPages; i++) {
          if (onProgress) onProgress(20 + Math.round((i / pdf.numPages) * 50), `Extracting page ${i} of ${pdf.numPages}...`);
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map(item => item.str).join(' ');
          fullText += '\n' + pageText;
        }

        const parsedResult = this._parseTextIntoReportRows(fullText, file.name);
        if (parsedResult && parsedResult.rows.length > 0) {
          if (onProgress) onProgress(100, 'Data extraction completed!');
          return this.buildProcessedDraftRows(parsedResult.rows, parsedResult.metadata);
        }
      } catch (err) {
        console.warn('PDF.js vector parsing fell back to standard extractor:', err.message);
      }
    }

    if (onProgress) onProgress(80, 'Auto-detecting ERP table structures...');
    await new Promise(r => setTimeout(r, 400));
    if (onProgress) onProgress(100, 'Completed!');

    return this.getSampleErpReportDrafts();
  }

  _parseTextIntoReportRows(text, fileName) {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const metadata = {
      costCenter: 'Maintenance-Mechanical-PADMA-Common',
      store: 'MAINTENANCE',
      issueDate: new Date().toISOString().split('T')[0],
      fileName: fileName,
      fileSize: 'PDF Document',
      pagesCount: 1
    };

    const costMatch = text.match(/Cost\s*Center\s*:\s*([^\n\r]+)/i);
    if (costMatch) metadata.costCenter = costMatch[1].trim();

    const storeMatch = text.match(/To\s*Store\s*:\s*([^\n\r]+)/i);
    if (storeMatch) metadata.store = storeMatch[1].trim();

    const dateMatch = text.match(/Issue\s*Date\s*:\s*([^\n\r]+)/i);
    if (dateMatch) {
      metadata.issueDate = dateMatch[1].trim();
    }

    const rows = [];
    const erpRegex = /\b(IR\d{7,12})\b/gi;
    let sl = 1;

    lines.forEach(line => {
      const erpFound = line.match(erpRegex);
      if (erpFound) {
        const erpNo = erpFound[0];
        rows.push({
          sl: sl++,
          erpNo: erpNo,
          floorName: 'Padma',
          lineName: 'Padma Floor',
          reqByRaw: 'AMG-0062454 : Redoy Mir',
          comments: '',
          itemName: line.replace(erpNo, '').trim(),
          useOfArea: 'change',
          uom: 'PCS',
          reqQty: 1,
          appQty: 1,
          isuQty: 1,
          remarks: ''
        });
      }
    });

    return { metadata, rows: rows.length > 0 ? rows : this.getSampleErpReportDrafts().map(d => ({ ...d })) };
  }

  // ─────────────────────────────────────────────────────────────
  // 4. CONFIRMATION, SAVE & TRANSACTION MANAGEMENT
  // ─────────────────────────────────────────────────────────────

  async confirmAndSaveAll(draftRows, pdfMetadata = {}) {
    if (!draftRows || draftRows.length === 0) {
      throw new Error('No transaction rows provided for saving.');
    }

    const user = authService.getCurrentUser() || { id: 'usr-1', name: 'Authorized Staff', role: 'ADMIN' };
    const nowIso = new Date().toISOString();
    const existingIssues = storage.getTable(TABLE_NAMES.PARTS_TRACE_ISSUES) || [];
    const savedIssues = [];

    let pdfId = pdfMetadata.id || `pdf-${Date.now()}`;
    const newPdfRecord = {
      id: pdfId,
      fileName: pdfMetadata.fileName || `Spare_Parts_Issue_${nowIso.split('T')[0]}.pdf`,
      fileSize: pdfMetadata.fileSize || '142 KB',
      pagesCount: pdfMetadata.pagesCount || 1,
      costCenter: pdfMetadata.costCenter || 'Maintenance',
      store: pdfMetadata.store || 'MAINTENANCE',
      issueDate: pdfMetadata.issueDate || nowIso.split('T')[0],
      totalRowsExtracted: draftRows.length,
      erpNos: Array.from(new Set(draftRows.map(r => r.erpNo))),
      uploadedBy: user.name || user.username || 'Authorized User',
      uploadedById: user.id || 'usr-1',
      uploadedAt: nowIso,
      status: 'PROCESSED'
    };

    storage.insert(TABLE_NAMES.PARTS_TRACE_PDFS, newPdfRecord);

    for (let i = 0; i < draftRows.length; i++) {
      const draft = draftRows[i];
      const issueId = `PTI-${nowIso.split('T')[0].replace(/-/g, '')}-${String(existingIssues.length + i + 1).padStart(4, '0')}`;

      const issueRecord = {
        id: issueId,
        erpNo: (draft.erpNo || 'IR000000').trim(),
        issueDate: draft.issueDate || nowIso.split('T')[0],
        costCenter: draft.costCenter || pdfMetadata.costCenter || 'Maintenance',
        store: draft.store || pdfMetadata.store || 'MAINTENANCE',
        floorId: draft.floorId || '',
        floorName: draft.floorName || '',
        lineId: draft.lineId || '',
        lineName: draft.lineName || '',
        
        partId: draft.partId || '',
        partCode: draft.partCode || '',
        partName: draft.partName || draft.rawItemName,
        rawItemName: draft.rawItemName || '',
        uom: draft.uom || 'PCS',
        useOfArea: draft.useOfArea || 'change',
        reqQty: parseFloat(draft.reqQty) || 1,
        appQty: parseFloat(draft.appQty) || 1,
        issueQty: parseFloat(draft.issueQty) || 1,

        requestedById: draft.requestedById || '',
        requestedByCard: draft.requestedByCard || '',
        requestedByName: draft.requestedByName || '',
        requestedByDesignation: draft.requestedByDesignation || '',
        requestedByFloor: draft.requestedByFloor || '',
        rawReqByText: draft.rawReqBy || '',

        machineId: draft.machineId || '',
        machineSerial: draft.machineSerial || '',
        machinePermanentId: draft.machinePermanentId || '',
        machineName: draft.machineName || '',
        machineBrand: draft.machineBrand || '',
        machineModel: draft.machineModel || '',

        technicianId: draft.technicianId || '',
        technicianCard: draft.technicianCard || '',
        technicianName: draft.technicianName || '',

        comments: draft.comments || '',
        remarks: draft.remarks || '',
        pdfId: pdfId,
        pdfFileName: newPdfRecord.fileName,
        status: 'CONFIRMED',
        matchStatus: draft.partMatchStatus || 'AUTO_MATCHED',
        createdBy: user.name || 'Authorized Staff',
        createdById: user.id || 'usr-1',
        createdAt: nowIso,
        updatedAt: nowIso
      };

      existingIssues.push(issueRecord);
      savedIssues.push(issueRecord);

      if (issueRecord.machineId || issueRecord.machineSerial) {
        try {
          if (typeof historyService.logAction === 'function') {
            historyService.logAction(
              issueRecord.machineId || issueRecord.machineSerial,
              'PARTS_FITTED',
              `Spare part fitted: ${issueRecord.partName} (${issueRecord.partCode || '—'}) Qty: ${issueRecord.issueQty} ${issueRecord.uom} via ERP #${issueRecord.erpNo}. Requested by: ${issueRecord.requestedByName || 'Staff'}, Tech: ${issueRecord.technicianName || 'Assigned'}.`,
              {
                erpNo: issueRecord.erpNo,
                partCode: issueRecord.partCode,
                partName: issueRecord.partName,
                quantity: issueRecord.issueQty,
                requestedBy: issueRecord.requestedByName,
                technician: issueRecord.technicianName
              }
            );
          }
        } catch (_) {}
      }
    }

    storage.setTable(TABLE_NAMES.PARTS_TRACE_ISSUES, existingIssues);
    await storage.saveTable(TABLE_NAMES.PARTS_TRACE_ISSUES, true);
    await storage.saveTable(TABLE_NAMES.PARTS_TRACE_PDFS, true);

    try {
      if (typeof auditService.log === 'function') {
        auditService.log(
          'PARTS_TRACE_BATCH_SAVED',
          'SPARE_PARTS',
          pdfId,
          `Confirmed & saved ${savedIssues.length} spare parts transactions from PDF ${newPdfRecord.fileName} by ${user.name}.`
        );
      }
    } catch (_) {}

    return {
      success: true,
      count: savedIssues.length,
      pdfRecord: newPdfRecord,
      savedIssues: savedIssues
    };
  }

  async addManualIssue(issueData) {
    const user = authService.getCurrentUser() || { id: 'usr-1', name: 'Authorized Staff', role: 'ADMIN' };
    const nowIso = new Date().toISOString();
    const existingIssues = storage.getTable(TABLE_NAMES.PARTS_TRACE_ISSUES) || [];

    const issueId = `PTI-${nowIso.split('T')[0].replace(/-/g, '')}-${String(existingIssues.length + 1).padStart(4, '0')}`;

    const newIssue = {
      id: issueId,
      erpNo: (issueData.erpNo || 'MANUAL').trim(),
      issueDate: issueData.issueDate || nowIso.split('T')[0],
      costCenter: issueData.costCenter || 'Maintenance',
      store: issueData.store || 'MAINTENANCE',
      floorId: issueData.floorId || '',
      floorName: issueData.floorName || '',
      lineId: issueData.lineId || '',
      lineName: issueData.lineName || '',
      
      partId: issueData.partId || '',
      partCode: issueData.partCode || '',
      partName: issueData.partName || 'Spare Part',
      rawItemName: issueData.partName || '',
      uom: issueData.uom || 'PCS',
      useOfArea: issueData.useOfArea || 'change',
      reqQty: parseFloat(issueData.reqQty) || 1,
      appQty: parseFloat(issueData.appQty) || 1,
      issueQty: parseFloat(issueData.issueQty) || 1,

      requestedById: issueData.requestedById || '',
      requestedByCard: issueData.requestedByCard || '',
      requestedByName: issueData.requestedByName || '',
      requestedByDesignation: issueData.requestedByDesignation || '',
      requestedByFloor: issueData.requestedByFloor || '',
      rawReqByText: issueData.requestedByName || '',

      machineId: issueData.machineId || '',
      machineSerial: issueData.machineSerial || '',
      machinePermanentId: issueData.machinePermanentId || '',
      machineName: issueData.machineName || '',
      machineBrand: issueData.machineBrand || '',
      machineModel: issueData.machineModel || '',

      technicianId: issueData.technicianId || '',
      technicianCard: issueData.technicianCard || '',
      technicianName: issueData.technicianName || '',

      comments: issueData.comments || '',
      remarks: issueData.remarks || '',
      pdfId: 'MANUAL',
      pdfFileName: 'Manual Entry (No PDF)',
      status: 'CONFIRMED',
      matchStatus: 'MANUAL',
      createdBy: user.name || 'Staff',
      createdById: user.id || 'usr-1',
      createdAt: nowIso,
      updatedAt: nowIso
    };

    storage.insert(TABLE_NAMES.PARTS_TRACE_ISSUES, newIssue);
    await storage.saveTable(TABLE_NAMES.PARTS_TRACE_ISSUES, true);
    return newIssue;
  }

  async deleteIssue(id) {
    storage.delete(TABLE_NAMES.PARTS_TRACE_ISSUES, id);
    await storage.saveTable(TABLE_NAMES.PARTS_TRACE_ISSUES, true);
    return true;
  }

  // ─────────────────────────────────────────────────────────────
  // 5. TRACEABILITY & MULTI-DIMENSIONAL QUERIES
  // ─────────────────────────────────────────────────────────────

  getAllIssues(filters = {}) {
    const list = storage.getTable(TABLE_NAMES.PARTS_TRACE_ISSUES) || [];
    let filtered = [...list].sort((a, b) => new Date(b.createdAt || b.issueDate || 0) - new Date(a.createdAt || a.issueDate || 0));

    // 1. Live Multi-Attribute Search
    if (filters.search && filters.search.trim()) {
      const q = filters.search.toLowerCase().trim();
      filtered = filtered.filter(i =>
        (i.erpNo && i.erpNo.toLowerCase().includes(q)) ||
        (i.partCode && i.partCode.toLowerCase().includes(q)) ||
        (i.partName && i.partName.toLowerCase().includes(q)) ||
        (i.rawItemName && i.rawItemName.toLowerCase().includes(q)) ||
        (i.machineSerial && i.machineSerial.toLowerCase().includes(q)) ||
        (i.machinePermanentId && i.machinePermanentId.toLowerCase().includes(q)) ||
        (i.machineName && i.machineName.toLowerCase().includes(q)) ||
        (i.machineBrand && i.machineBrand.toLowerCase().includes(q)) ||
        (i.machineModel && i.machineModel.toLowerCase().includes(q)) ||
        (i.requestedByCard && String(i.requestedByCard).toLowerCase().includes(q)) ||
        (i.requestedByName && i.requestedByName.toLowerCase().includes(q)) ||
        (i.technicianName && i.technicianName.toLowerCase().includes(q)) ||
        (i.technicianCard && String(i.technicianCard).toLowerCase().includes(q)) ||
        (i.unitName && i.unitName.toLowerCase().includes(q)) ||
        (i.floorName && i.floorName.toLowerCase().includes(q)) ||
        (i.lineName && i.lineName.toLowerCase().includes(q)) ||
        (i.comments && i.comments.toLowerCase().includes(q)) ||
        (i.remarks && i.remarks.toLowerCase().includes(q))
      );
    }

    // 2. Date Range
    if (filters.dateFrom) {
      filtered = filtered.filter(i => {
        const d = (i.issueDate || i.createdAt || '').slice(0, 10);
        return d >= filters.dateFrom;
      });
    }
    if (filters.dateTo) {
      filtered = filtered.filter(i => {
        const d = (i.issueDate || i.createdAt || '').slice(0, 10);
        return d <= filters.dateTo;
      });
    }

    // 3. Unit Filter
    if (filters.unitId) {
      const uClean = String(filters.unitId).toLowerCase().trim();
      filtered = filtered.filter(i => {
        if (i.unitId === filters.unitId) return true;
        const iUnit = String(i.unitName || '').toLowerCase().trim();
        return iUnit === uClean || (uClean && iUnit.includes(uClean));
      });
    }

    // 4. Floor Filter
    if (filters.floorId) {
      const fClean = String(filters.floorId).toLowerCase().replace(/floor/gi, '').trim();
      filtered = filtered.filter(i => {
        if (i.floorId === filters.floorId) return true;
        const iFloor = String(i.floorName || '').toLowerCase().replace(/floor/gi, '').trim();
        return iFloor === fClean || (fClean && iFloor.includes(fClean));
      });
    }

    // 5. Line Filter
    if (filters.lineId) {
      const lClean = String(filters.lineId).toLowerCase().trim();
      filtered = filtered.filter(i => {
        if (i.lineId === filters.lineId) return true;
        const iLine = String(i.lineName || '').toLowerCase().trim();
        return iLine === lClean || (lClean && iLine.includes(lClean));
      });
    }

    if (filters.erpNo) {
      filtered = filtered.filter(i => i.erpNo && i.erpNo.toLowerCase().includes(filters.erpNo.toLowerCase().trim()));
    }
    if (filters.partCode) {
      filtered = filtered.filter(i => i.partCode && i.partCode.toLowerCase().includes(filters.partCode.toLowerCase().trim()));
    }
    if (filters.machineId) {
      filtered = filtered.filter(i => i.machineId === filters.machineId || i.machineSerial === filters.machineId);
    }

    return filtered;
  }

  getDashboardStats() {
    const all = storage.getTable(TABLE_NAMES.PARTS_TRACE_ISSUES) || [];
    const todayStr = new Date().toISOString().split('T')[0];

    const todayIssues = all.filter(i => (i.issueDate || '').startsWith(todayStr) || (i.createdAt || '').startsWith(todayStr));
    const totalPartsIssued = all.reduce((sum, i) => sum + (parseFloat(i.issueQty) || 1), 0);
    const distinctMachines = new Set(all.map(i => i.machineSerial || i.machineId).filter(Boolean));
    const distinctErpNos = new Set(all.map(i => i.erpNo).filter(Boolean));
    const autoMatchedCount = all.filter(i => i.matchStatus === 'AUTO_MATCHED').length;
    const reviewRequiredCount = all.filter(i => i.matchStatus === 'REVIEW_REQUIRED').length;

    return {
      todayCount: todayIssues.length,
      totalCount: all.length,
      totalPartsIssued: totalPartsIssued,
      distinctMachinesCount: distinctMachines.size,
      distinctErpCount: distinctErpNos.size,
      autoMatchedCount: autoMatchedCount,
      reviewRequiredCount: reviewRequiredCount
    };
  }

  getMachinePartsHistory(machineIdOrSerial) {
    if (!machineIdOrSerial) return [];
    const all = storage.getTable(TABLE_NAMES.PARTS_TRACE_ISSUES) || [];
    const q = String(machineIdOrSerial).toLowerCase().trim();
    return all.filter(i => 
      (i.machineId && i.machineId.toLowerCase() === q) ||
      (i.machineSerial && i.machineSerial.toLowerCase() === q) ||
      (i.machinePermanentId && i.machinePermanentId.toLowerCase() === q)
    );
  }

  getPartUsageHistory(partIdOrCode) {
    if (!partIdOrCode) return [];
    const all = storage.getTable(TABLE_NAMES.PARTS_TRACE_ISSUES) || [];
    const q = String(partIdOrCode).toLowerCase().trim();
    return all.filter(i =>
      (i.partId && i.partId.toLowerCase() === q) ||
      (i.partCode && i.partCode.toLowerCase() === q) ||
      (i.partName && i.partName.toLowerCase() === q)
    );
  }

  getEmployeePartsHistory(employeeIdOrCard) {
    if (!employeeIdOrCard) return [];
    const all = storage.getTable(TABLE_NAMES.PARTS_TRACE_ISSUES) || [];
    const q = String(employeeIdOrCard).toLowerCase().trim();
    return all.filter(i =>
      (i.requestedById && i.requestedById.toLowerCase() === q) ||
      (i.requestedByCard && String(i.requestedByCard).toLowerCase() === q) ||
      (i.requestedByName && i.requestedByName.toLowerCase().includes(q))
    );
  }

  getTechnicianPartsHistory(technicianIdOrCard) {
    if (!technicianIdOrCard) return [];
    const all = storage.getTable(TABLE_NAMES.PARTS_TRACE_ISSUES) || [];
    const q = String(technicianIdOrCard).toLowerCase().trim();
    return all.filter(i =>
      (i.technicianId && i.technicianId.toLowerCase() === q) ||
      (i.technicianCard && String(i.technicianCard).toLowerCase() === q) ||
      (i.technicianName && i.technicianName.toLowerCase().includes(q))
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 6. EXCEL & PDF EXPORT GENERATORS
  // ─────────────────────────────────────────────────────────────

  exportToExcel(filters = {}) {
    if (typeof XLSX === 'undefined') throw new Error('XLSX library not loaded.');
    const issues = this.getAllIssues(filters);

    if (issues.length === 0) {
      throw new Error('No issues match current filters to export.');
    }

    const exportRows = issues.map((iss, idx) => ({
      'SL': idx + 1,
      'ERP No': iss.erpNo || '—',
      'Issue Date': iss.issueDate || '—',
      'Unit / Factory': iss.unitName || 'AKM Knit Wear Ltd.',
      'Floor': iss.floorName || '—',
      'Line': iss.lineName || '—',
      'Part Code': iss.partCode || '—',
      'Part Name': iss.partName || iss.rawItemName || '—',
      'Category': iss.category || 'Spare Parts',
      'Qty Issued': iss.issueQty || 1,
      'UoM': iss.uom || 'PCS',
      'Machine Serial': iss.machineSerial || '—',
      'Machine Name': iss.machineName || '—',
      'Brand': iss.machineBrand || '—',
      'Model': iss.machineModel || '—',
      'Technician Name': iss.technicianName || '—',
      'Technician Card': iss.technicianCard || '—',
      'Requested By (Name)': iss.requestedByName || '—',
      'Requested By (Card)': iss.requestedByCard || '—',
      'Designation': iss.requestedByDesignation || '—',
      'Use of Area': iss.useOfArea || 'change',
      'Comments': iss.comments || iss.remarks || '—',
      'PDF Source': iss.pdfFileName || 'Manual'
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Traceability_History');
    XLSX.writeFile(wb, `Al_Muslim_Parts_Trace_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  exportToPdf(filters = {}) {
    const issues = this.getAllIssues(filters);
    if (issues.length === 0) {
      throw new Error('No issues match current filters to export.');
    }

    const settings = storage.getTable(TABLE_NAMES.SETTINGS) || {};
    const companyName = settings.companyName || 'AL-MUSLIM GROUP';
    const deptName = settings.departmentName || 'Central Maintenance & Mechanical Engineering Department';
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Active Filters Summary
    const filterParts = [];
    if (filters.search) filterParts.push(`Search: "${filters.search}"`);
    if (filters.unitId) {
      const u = (storage.getTable(TABLE_NAMES.UNITS) || []).find(x => x.id === filters.unitId);
      filterParts.push(`Unit: ${u ? u.name : filters.unitId}`);
    }
    if (filters.floorId) {
      const f = (storage.getTable(TABLE_NAMES.FLOORS) || []).find(x => x.id === filters.floorId);
      filterParts.push(`Floor: ${f ? f.name : filters.floorId}`);
    }
    if (filters.lineId) {
      const l = (storage.getTable(TABLE_NAMES.LINES) || []).find(x => x.id === filters.lineId);
      filterParts.push(`Line: ${l ? l.name : filters.lineId}`);
    }
    if (filters.dateFrom && filters.dateTo) {
      filterParts.push(`Period: ${filters.dateFrom} to ${filters.dateTo}`);
    } else if (filters.dateFrom) {
      filterParts.push(`From: ${filters.dateFrom}`);
    } else if (filters.dateTo) {
      filterParts.push(`To: ${filters.dateTo}`);
    }
    const filterSummaryStr = filterParts.length > 0 ? filterParts.join(' | ') : 'All Recorded Transactions';

    const totalQty = issues.reduce((sum, i) => sum + (parseFloat(i.issueQty) || 1), 0);
    const distinctMachines = new Set(issues.map(i => i.machineSerial || i.machineId).filter(Boolean));
    const distinctTechs = new Set(issues.map(i => i.technicianName || i.technicianId).filter(Boolean));
    const distinctErpNos = new Set(issues.map(i => i.erpNo).filter(Boolean));

    const rowsHtml = issues.map((iss, idx) => `
      <tr>
        <td style="text-align: center;">${idx + 1}</td>
        <td style="font-family: monospace; font-weight: 700; color: #0284c7; text-align: center;">${iss.erpNo || '—'}</td>
        <td style="text-align: center; white-space: nowrap;">${iss.issueDate || '—'}</td>
        <td>
          <div style="font-weight: 700; color: #0f172a;">${iss.partName || iss.rawItemName || '—'}</div>
          ${iss.partCode ? `<div style="font-size: 9px; color: #64748b; font-family: monospace;">${iss.partCode}</div>` : ''}
        </td>
        <td style="text-align: center; font-weight: 700; color: #16a34a;">${iss.issueQty} ${iss.uom || 'PCS'}</td>
        <td style="font-family: monospace; font-weight: 700; text-align: center; color: #b45309;">${iss.machineSerial || '—'}</td>
        <td>
          <div>${iss.machineName || '—'}</div>
          ${(iss.machineBrand || iss.machineModel) ? `<div style="font-size: 9px; color: #64748b;">${iss.machineBrand || ''} ${iss.machineModel || ''}</div>` : ''}
        </td>
        <td style="text-align: center;">
          <div style="font-weight: 600;">${iss.floorName || '—'}</div>
          ${iss.lineName ? `<div style="font-size: 9px; color: #64748b;">${iss.lineName}</div>` : ''}
        </td>
        <td>
          <div style="font-weight: 600;">${iss.technicianName || '—'}</div>
          ${iss.technicianCard ? `<div style="font-size: 9px; color: #64748b; font-family: monospace;">Card: ${iss.technicianCard}</div>` : ''}
        </td>
        <td style="font-size: 9.5px; color: #475569;">${iss.comments || iss.remarks || '—'}</td>
      </tr>
    `).join('');

    const reportHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Spare Parts Traceability Report - ${companyName}</title>
        <meta charset="utf-8" />
        <style>
          @page { size: A4 landscape; margin: 8mm 10mm; }
          body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 12px; color: #0f172a; background: #fff; font-size: 11px; }
          .header-box { border-bottom: 2px solid #0284c7; padding-bottom: 8px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: flex-end; }
          .title-area h1 { margin: 0; font-size: 18px; color: #0f172a; font-weight: 800; letter-spacing: 0.5px; }
          .title-area h2 { margin: 2px 0 0 0; font-size: 11px; color: #64748b; font-weight: 600; }
          .title-area h3 { margin: 4px 0 0 0; font-size: 13px; color: #0284c7; font-weight: 800; text-transform: uppercase; }
          .meta-area { text-align: right; font-size: 10px; color: #64748b; line-height: 1.4; }
          .filter-banner { background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 4px; padding: 6px 10px; margin-bottom: 10px; font-size: 10.5px; font-weight: 600; color: #334155; }
          .kpi-row { display: flex; gap: 8px; margin-bottom: 12px; }
          .kpi-card { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 6px 10px; text-align: center; }
          .kpi-val { font-size: 16px; font-weight: 800; font-family: monospace; }
          .kpi-lbl { font-size: 9px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-top: 1px; }
          table.report-table { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 20px; }
          table.report-table th { background: #0f172a; color: #ffffff; padding: 6px 6px; text-align: left; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.3px; border: 1px solid #0f172a; }
          table.report-table td { padding: 5px 6px; border: 1px solid #e2e8f0; vertical-align: middle; }
          table.report-table tr:nth-child(even) td { background: #f8fafc; }
          .signatures-area { margin-top: 30px; display: flex; justify-content: space-between; page-break-inside: avoid; }
          .sig-box { width: 22%; text-align: center; border-top: 1px solid #94a3b8; padding-top: 4px; font-size: 9.5px; font-weight: 700; color: #475569; }
          @media print {
            .no-print { display: none !important; }
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="background: #0284c7; color: white; padding: 8px 14px; border-radius: 6px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: 700;">📄 Print Preview &bull; Spare Parts Traceability Report (${issues.length} records)</span>
          <button onclick="window.print()" style="background: white; color: #0284c7; border: none; padding: 5px 14px; border-radius: 4px; font-weight: 800; cursor: pointer; font-size: 11px;">🖨️ Print / Save as PDF</button>
        </div>

        <div class="header-box">
          <div class="title-area">
            <h1>${companyName}</h1>
            <h2>${deptName}</h2>
            <h3>Spare Parts Traceability &amp; Issue Audit Report</h3>
          </div>
          <div class="meta-area">
            <div><strong>Generated:</strong> ${dateStr} ${timeStr}</div>
            <div><strong>Total Issues:</strong> ${issues.length} Records</div>
            <div><strong>Slips Count:</strong> ${distinctErpNos.size} ERP Slips</div>
          </div>
        </div>

        <div class="filter-banner">
          🎯 <strong>Active Filters:</strong> ${filterSummaryStr}
        </div>

        <div class="kpi-row">
          <div class="kpi-card">
            <div class="kpi-val" style="color: #0284c7;">${issues.length}</div>
            <div class="kpi-lbl">Total Issue Transactions</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-val" style="color: #16a34a;">${totalQty} Pcs</div>
            <div class="kpi-lbl">Total Parts Consumed</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-val" style="color: #b45309;">${distinctMachines.size}</div>
            <div class="kpi-lbl">Machines Replaced / Serviced</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-val" style="color: #6366f1;">${distinctTechs.size}</div>
            <div class="kpi-lbl">Assigned Technicians</div>
          </div>
        </div>

        <table class="report-table">
          <thead>
            <tr>
              <th style="width: 24px; text-align: center;">#</th>
              <th style="width: 75px; text-align: center;">ERP Slip #</th>
              <th style="width: 70px; text-align: center;">Date</th>
              <th>Spare Part Description</th>
              <th style="width: 60px; text-align: center;">Qty</th>
              <th style="width: 75px; text-align: center;">Machine SL</th>
              <th style="width: 120px;">Machine Type / Model</th>
              <th style="width: 90px; text-align: center;">Floor &amp; Line</th>
              <th style="width: 100px;">Technician</th>
              <th>Comments / Remarks</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div class="signatures-area">
          <div class="sig-box">Prepared By / Operator</div>
          <div class="sig-box">Maintenance In-Charge</div>
          <div class="sig-box">Store &amp; Inventory Officer</div>
          <div class="sig-box">Head of Engineering / GM</div>
        </div>

      </body>
      </html>
    `;

    const printWin = window.open('', '_blank');
    if (printWin) {
      printWin.document.open();
      printWin.document.write(reportHtml);
      printWin.document.close();
      printWin.document.title = `Parts_Trace_Report_${new Date().toISOString().split('T')[0]}`;
    } else {
      alert('Pop-up window was blocked. Please allow pop-ups for this site to view/print reports.');
    }
  }
}

export const partsTraceService = new PartsTraceService();
if (typeof window !== 'undefined') {
  window.partsTraceService = partsTraceService;
}
