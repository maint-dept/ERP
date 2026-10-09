/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Multi-Worksheet Excel Engine, Field-Key Mapping, Dynamic Template Generator & Transactional Bulk Importer
 */

import { storage } from '../db/storage.js';
import { TABLE_NAMES, DUPLICATE_POLICIES, GARMENT_MACHINE_SHORT_CODES } from '../db/schema.js';
import { authService } from './authService.js';
import { customFieldService } from './customFieldService.js';
import { auditService } from './auditService.js';
import { smartStorageService } from './smartStorageService.js?v=4.22.19';

export function calculateLevenshtein(a, b) {
  if (a === b) return 0;
  if (!a) return b ? b.length : 0;
  if (!b) return a.length;
  const s1 = String(a).toLowerCase();
  const s2 = String(b).toLowerCase();
  if (s1 === s2) return 0;
  const m = s1.length;
  const n = s2.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

export function calculateSimilarity(a, b) {
  const s1 = String(a || '').trim().toLowerCase();
  const s2 = String(b || '').trim().toLowerCase();
  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0.0;
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1.0;
  const dist = calculateLevenshtein(s1, s2);
  return (maxLen - dist) / maxLen;
}

export function normalizePureAlphanumeric(str) {
  return String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function extractCoreLineDesignation(rawLine, floorCode = '') {
  if (!rawLine) return '';
  let str = String(rawLine).trim();
  if (!str) return '';

  // If starts with floor code and separator (e.g. "TS-G", "TS_G", "TS G", "TS:G", "TS-Size Set")
  if (floorCode) {
    const fcLower = floorCode.toLowerCase();
    if (str.toLowerCase().startsWith(fcLower + '-') || str.toLowerCase().startsWith(fcLower + '_') || str.toLowerCase().startsWith(fcLower + ' ') || str.toLowerCase().startsWith(fcLower + ':')) {
      str = str.substring(floorCode.length + 1).trim();
    }
  }

  // If starts with any other 2-letter uppercase floor code and hyphen (e.g. "JA-A", "BG-B")
  const mFloor = str.match(/^[a-z]{2,3}[-_:\s]+(.*)$/i);
  if (mFloor && mFloor[1]) {
    str = mFloor[1].trim();
  }

  // If starts with "Line" or "line" (e.g. "Line A", "Line-A", "line G")
  if (/^line[\s\-_]*/i.test(str)) {
    str = str.replace(/^line[\s\-_]*/i, '').trim();
  }

  return str;
}

export function formatCanonicalLineName(floorCode, coreDesignation) {
  const cleanCore = String(coreDesignation || '').trim();
  if (!cleanCore) return '';
  const formattedCore = cleanCore.length <= 3 ? cleanCore.toUpperCase() : cleanCore;
  if (!floorCode) return formattedCore;
  return `${floorCode.toUpperCase()}-${formattedCore}`;
}

export function formatDisplayLine(fullLineName, mode = 'NORMAL') {
  if (!fullLineName) return '—';
  const str = String(fullLineName).trim();
  if (!str) return '—';

  if (mode === 'FULL') return str;

  // If pattern is [FLOOR_CODE]-[LINE_NAME] where FLOOR_CODE is 2-3 uppercase letters
  const match = str.match(/^[A-Z]{2,3}-(.*)$/i);
  if (match && match[1]) {
    return match[1].trim();
  }
  return str;
}

export function resolveFloorSmart(rawFloor, floorsList, unitObj = null) {
  if (!rawFloor) return null;
  const raw = String(rawFloor).trim();
  if (!raw) return null;
  const rawLower = raw.toLowerCase();
  const rawNorm = normalizePureAlphanumeric(raw);

  // 1. Direct ID match
  let matched = floorsList.find(f => f.id === raw);
  if (matched) return matched;

  // 2. Direct Code match (e.g. "TS", "JA", "BG", "PD", "SU", "TT", "CH", "MG", "SM", "ML", "PT")
  matched = floorsList.find(f => f.code && f.code.toUpperCase() === raw.toUpperCase());
  if (matched) return matched;

  // 3. Exact Name case-insensitive (e.g. "Tista Floor")
  matched = floorsList.find(f => f.name && f.name.toLowerCase() === rawLower);
  if (matched) return matched;

  // 4. Name prefix match without "Floor" (e.g. "TISTA" matches "Tista Floor", "JAMUNA" matches "Jamuna Floor")
  matched = floorsList.find(f => {
    if (!f.name) return false;
    const cleanName = f.name.toLowerCase().replace(/\bfloor\b/g, '').trim();
    return cleanName === rawLower || rawLower.startsWith(cleanName) || cleanName.startsWith(rawLower);
  });
  if (matched) return matched;

  // 5. Normalized alphanumeric match
  matched = floorsList.find(f => {
    const fNorm = normalizePureAlphanumeric(f.name);
    const fCleanNorm = normalizePureAlphanumeric(f.name.replace(/\bfloor\b/i, ''));
    return fNorm === rawNorm || fCleanNorm === rawNorm;
  });
  if (matched) return matched;

  // 6. Fuzzy spelling similarity match (>= 0.75 or Levenshtein <= 2)
  let bestFloor = null;
  let bestScore = 0;
  floorsList.forEach(f => {
    const fClean = f.name.replace(/\bfloor\b/i, '').trim().toLowerCase();
    const score1 = calculateSimilarity(rawLower, fClean);
    const score2 = calculateSimilarity(rawLower, f.name.toLowerCase());
    const score = Math.max(score1, score2);
    if (score > bestScore && (score >= 0.75 || calculateLevenshtein(rawLower, fClean) <= 2)) {
      bestScore = score;
      bestFloor = f;
    }
  });

  return bestFloor;
}

export function resolveLineSmart(rawLine, floorObj, linesList) {
  if (!rawLine) return null;
  const raw = String(rawLine).trim();
  if (!raw) return null;

  const floorCode = floorObj?.code ? floorObj.code.toUpperCase() : '';
  const core = extractCoreLineDesignation(raw, floorCode);
  const canonicalName = formatCanonicalLineName(floorCode, core);

  // Filter candidate lines belonging to this floor if floor is known
  const floorLines = floorObj ? linesList.filter(l => l.floorId === floorObj.id) : linesList;

  // 1. Direct ID match
  let matched = floorLines.find(l => l.id === raw);
  if (matched) return matched;

  // 2. Match exact canonical name (e.g. "TS-G" matches "TS-G")
  matched = floorLines.find(l => 
    l.name && (l.name.toUpperCase() === canonicalName.toUpperCase() || (l.code && l.code.toUpperCase() === canonicalName.toUpperCase()))
  );
  if (matched) return matched;

  // 3. Match by raw string case-insensitive
  matched = floorLines.find(l => 
    l.name && (l.name.toLowerCase() === raw.toLowerCase() || (l.code && l.code.toLowerCase() === raw.toLowerCase()))
  );
  if (matched) return matched;

  // 4. Match by core designation (e.g. line is "TS-G" and core is "G")
  if (core) {
    matched = floorLines.find(l => {
      const lCore = extractCoreLineDesignation(l.name, floorCode);
      return lCore.toUpperCase() === core.toUpperCase();
    });
    if (matched) return matched;
  }

  // 5. Match by pure alphanumeric normalization
  const rawNorm = normalizePureAlphanumeric(raw);
  const canonNorm = normalizePureAlphanumeric(canonicalName);
  matched = floorLines.find(l => {
    const lNorm = normalizePureAlphanumeric(l.name);
    return lNorm === rawNorm || lNorm === canonNorm;
  });
  if (matched) return matched;

  // 6. If not found in floorLines, but floorObj is known:
  // AUTO-CREATE the missing line in storage!
  if (floorObj && canonicalName) {
    const newLine = storage.insert(TABLE_NAMES.LINES, {
      floorId: floorObj.id,
      name: canonicalName,
      code: canonicalName,
      supervisor: 'Line Master',
      status: 'ACTIVE'
    });
    storage.saveTable(TABLE_NAMES.LINES);
    return newLine;
  }

  return null;
}

export function resolveMachineNameSmart(rawName, machineNamesList) {
  if (!rawName) return null;
  const raw = String(rawName).trim();
  if (!raw) return null;

  // 1. Direct ID match
  let matched = machineNamesList.find(m => m.id === raw);
  if (matched) return matched;

  // 2. Exact name / code match (case-insensitive)
  matched = machineNamesList.find(m => 
    m.name && (m.name.toLowerCase() === raw.toLowerCase() || (m.code && m.code.toLowerCase() === raw.toLowerCase()))
  );
  if (matched) return matched;

  // 3. Canonical dictionary resolution (e.g. "Over Lock Mechine" -> "Over Lock Machine", "Plain Machine" -> "Plane Machine", "Bartak Machine" -> "Bar tak Machine")
  const canonical = (typeof smartStorageService !== 'undefined' && smartStorageService?.resolveCanonicalMachineName)
    ? smartStorageService.resolveCanonicalMachineName(raw)
    : raw;

  if (canonical && canonical.toLowerCase() !== raw.toLowerCase()) {
    matched = machineNamesList.find(m => m.name && m.name.toLowerCase() === canonical.toLowerCase());
    if (matched) return matched;
  }

  // 4. Pure alphanumeric normalized match
  const rawNorm = normalizePureAlphanumeric(raw);
  const canonNorm = normalizePureAlphanumeric(canonical);
  matched = machineNamesList.find(m => {
    const mNorm = normalizePureAlphanumeric(m.name);
    return mNorm === rawNorm || mNorm === canonNorm;
  });
  if (matched) return matched;

  // 5. Fuzzy similarity match (>= 0.80 similarity / Levenshtein <= 2)
  let bestMN = null;
  let bestScore = 0;
  machineNamesList.forEach(m => {
    const score = calculateSimilarity(raw, m.name);
    if (score > bestScore && (score >= 0.80 || calculateLevenshtein(raw.toLowerCase(), m.name.toLowerCase()) <= 2)) {
      bestScore = score;
      bestMN = m;
    }
  });
  if (bestMN) return bestMN;

  // 6. Auto-register if new valid name
  if (typeof smartStorageService !== 'undefined' && smartStorageService?.addMachineName) {
    const newMN = smartStorageService.addMachineName(canonical || raw);
    if (newMN && newMN.id) {
      return storage.getItem(TABLE_NAMES.MACHINE_NAMES, newMN.id) || { id: newMN.id, name: canonical || raw };
    }
  }

  return null;
}

export function resolveBrandSmart(rawBrand, brandsList) {
  if (!rawBrand) return null;
  const raw = String(rawBrand).trim();
  if (!raw) return null;

  // 1. Direct ID match
  let matched = brandsList.find(b => b.id === raw);
  if (matched) return matched;

  // 2. Exact name / code match (case-insensitive)
  matched = brandsList.find(b => 
    b.name && (b.name.toLowerCase() === raw.toLowerCase() || (b.code && b.code.toLowerCase() === raw.toLowerCase()))
  );
  if (matched) return matched;

  // 3. Known brand aliases / typos dictionary
  const brandAliasMap = {
    'kansai specil': 'KANSAI SPECIAL',
    'kansai': 'KANSAI SPECIAL',
    'zuson': 'ZUSAN',
    'juki': 'JUKI',
    'brother': 'BROTHER',
    'zoje': 'ZOJE',
    'pegasus': 'PEGASUS',
    'siruba': 'SIRUBA',
    'typical': 'TYPICAL',
    'jack': 'JACK',
    'yamato': 'YAMATO',
    'sunstar': 'SUNSTAR',
    'hashima': 'HASHIMA',
    'eastman': 'EASTMAN',
    'singer': 'SINGER',
    'bedoly': 'BEDOLY',
    'ngai shing': 'NGAI SHING',
    'jam international': 'JAM INTERNATIONAL',
    'sggemsy': 'SGGEMSY',
    'agm': 'AGM'
  };
  const aliasTarget = brandAliasMap[raw.toLowerCase()];
  if (aliasTarget) {
    matched = brandsList.find(b => b.name && b.name.toUpperCase() === aliasTarget);
    if (matched) return matched;
  }

  // 4. Pure alphanumeric normalized match
  const rawNorm = normalizePureAlphanumeric(raw);
  matched = brandsList.find(b => normalizePureAlphanumeric(b.name) === rawNorm);
  if (matched) return matched;

  // 5. Fuzzy similarity match (>= 0.80 or Levenshtein <= 2)
  let bestBrand = null;
  let bestScore = 0;
  brandsList.forEach(b => {
    const score = calculateSimilarity(raw, b.name);
    if (score > bestScore && (score >= 0.80 || calculateLevenshtein(raw.toLowerCase(), b.name.toLowerCase()) <= 2)) {
      bestScore = score;
      bestBrand = b;
    }
  });
  if (bestBrand) return bestBrand;

  // 6. Auto-register brand if not found
  const newBrand = storage.insert(TABLE_NAMES.BRANDS, {
    name: (aliasTarget || raw).toUpperCase(),
    code: (aliasTarget || raw).toUpperCase().replace(/[^A-Z0-9]/g, '_'),
    country: 'Global',
    status: 'ACTIVE'
  });
  storage.saveTable(TABLE_NAMES.BRANDS);
  return newBrand;
}

export function resolveModelSmart(rawModel, brandObj, machineNameObj, modelsList) {
  if (!rawModel) return null;
  const raw = String(rawModel).trim();
  if (!raw) return null;

  // 1. Direct ID match
  let matched = modelsList.find(m => m.id === raw);
  if (matched) return matched;

  // 2. Filter candidates by brand and/or machine name if known
  const candidates = modelsList.filter(m => {
    if (brandObj && m.brandId && m.brandId !== brandObj.id) return false;
    if (machineNameObj && m.machineNameId && m.machineNameId !== machineNameObj.id) return false;
    return true;
  });

  const pool = candidates.length > 0 ? candidates : modelsList;

  // Exact match case-insensitive
  matched = pool.find(m => m.name && m.name.toLowerCase() === raw.toLowerCase());
  if (matched) return matched;

  // Pure alphanumeric normalized match (e.g. "DDL900BB" matches "DDL-900BB")
  const rawNorm = normalizePureAlphanumeric(raw);
  matched = pool.find(m => normalizePureAlphanumeric(m.name) === rawNorm);
  if (matched) return matched;

  // Fuzzy similarity match
  let bestModel = null;
  let bestScore = 0;
  pool.forEach(m => {
    const score = calculateSimilarity(raw, m.name);
    if (score > bestScore && (score >= 0.80 || calculateLevenshtein(raw.toLowerCase(), m.name.toLowerCase()) <= 2)) {
      bestScore = score;
      bestModel = m;
    }
  });
  if (bestModel) return bestModel;

  // Auto-create model linked to brand and machine name
  if (brandObj && machineNameObj) {
    const newMdl = storage.insert(TABLE_NAMES.MODELS, {
      name: raw,
      brandId: brandObj.id,
      machineNameId: machineNameObj.id,
      status: 'ACTIVE'
    });
    storage.saveTable(TABLE_NAMES.MODELS);
    return newMdl;
  }

  return null;
}

class ExcelService {
  getStructures() {
    return storage.getTable(TABLE_NAMES.EXCEL_STRUCTURES) || [];
  }

  getActiveStructure() {
    const list = this.getStructures();
    let active = list.find(s => s.isDefault) || list[0] || this._getDefaultStructure();
    
    // Check if active structure needs migration to standard 13-column format
    const requiredKeys = [
      'machine_name', 'machine_brand', 'machine_model', 'machine_serial',
      'unit_factory', 'floor', 'line', 'running', 'usable_idle',
      'repairable_idle', 'total_quantity', 'machine_status', 'remarks'
    ];

    const currentKeys = (active.columns || []).map(c => c.fieldKey);
    const hasAllKeys = requiredKeys.every(k => currentKeys.includes(k));

    if (!hasAllKeys || (active.columns || []).length !== 13) {
      active = this._getDefaultStructure();
      const existing = storage.getItem(TABLE_NAMES.EXCEL_STRUCTURES, active.id);
      if (existing) {
        storage.update(TABLE_NAMES.EXCEL_STRUCTURES, active.id, active);
      } else {
        storage.insert(TABLE_NAMES.EXCEL_STRUCTURES, active);
      }
    }

    return active;
  }

  getVisibleColumns(structureId = null) {
    const struct = structureId ? storage.getItem(TABLE_NAMES.EXCEL_STRUCTURES, structureId) : this.getActiveStructure();
    return (struct?.columns || [])
      .filter(c => c.visible && c.fieldKey !== 'sl' && c.fieldKey !== 'sl_no')
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  saveStructure(structure) {
    if (!authService.canManageTemplates()) {
      throw new Error('Unauthorized to modify Excel structures.');
    }

    // Filter out sl and assetId
    structure.columns = (structure.columns || []).filter(c => 
      c.fieldKey !== 'assetId' && c.fieldKey !== 'asset_id' &&
      c.fieldKey !== 'sl' && c.fieldKey !== 'sl_no'
    );

    // Validate duplicate field keys
    const seenKeys = new Set();
    for (const col of structure.columns) {
      if (!col.fieldKey || !col.fieldKey.trim()) {
        throw new Error(`Column '${col.header}' is missing an internal field key.`);
      }
      const k = col.fieldKey.trim().toLowerCase();
      if (seenKeys.has(k)) {
        throw new Error(`Duplicate field key detected: '${col.fieldKey}'. Each column must map to a unique internal field key.`);
      }
      seenKeys.add(k);
    }

    const existing = storage.getItem(TABLE_NAMES.EXCEL_STRUCTURES, structure.id);
    if (existing) {
      storage.update(TABLE_NAMES.EXCEL_STRUCTURES, structure.id, structure);
    } else {
      storage.insert(TABLE_NAMES.EXCEL_STRUCTURES, structure);
    }
    auditService.log('EXCEL_STRUCTURE_SAVED', 'EXCEL_STRUCTURE', structure.id, `Saved Excel column structure: ${structure.name}`);
    window.dispatchEvent(new CustomEvent('erp:excel-structure-updated'));
    return structure;
  }

  reorderColumns(structureId, orderedColIds) {
    const struct = storage.getItem(TABLE_NAMES.EXCEL_STRUCTURES, structureId) || this.getActiveStructure();
    if (!struct || !struct.columns) return;

    const colMap = new Map(struct.columns.map(c => [c.id, c]));
    struct.columns = orderedColIds.map((id, index) => {
      const col = colMap.get(id);
      if (col) col.order = index + 1;
      return col;
    }).filter(Boolean);

    const existing = storage.getItem(TABLE_NAMES.EXCEL_STRUCTURES, struct.id);
    if (existing) {
      storage.update(TABLE_NAMES.EXCEL_STRUCTURES, struct.id, struct);
    } else {
      storage.insert(TABLE_NAMES.EXCEL_STRUCTURES, struct);
    }
    window.dispatchEvent(new CustomEvent('erp:excel-structure-updated'));
  }

  _getDefaultStructure() {
    return {
      id: 'ex-struct-default',
      name: 'Standard Garments Machinery Layout',
      isDefault: true,
      columns: [
        { id: 'col-1', header: 'Machine Name', fieldKey: 'machine_name', required: true, defaultValue: '', order: 1, visible: true },
        { id: 'col-2', header: 'Machine Brand', fieldKey: 'machine_brand', required: false, defaultValue: '', order: 2, visible: true },
        { id: 'col-3', header: 'Machine Model', fieldKey: 'machine_model', required: false, defaultValue: '', order: 3, visible: true },
        { id: 'col-4', header: 'Machine Serial', fieldKey: 'machine_serial', required: false, defaultValue: '', order: 4, visible: true },
        { id: 'col-5', header: 'Unit/Factory', fieldKey: 'unit_factory', required: true, defaultValue: 'AKM Knitwear Ltd.', order: 5, visible: true },
        { id: 'col-6', header: 'Floor', fieldKey: 'floor', required: true, defaultValue: '3rd Floor', order: 6, visible: true },
        { id: 'col-7', header: 'Line', fieldKey: 'line', required: true, defaultValue: 'Line JA-A', order: 7, visible: true },
        { id: 'col-8', header: 'Running', fieldKey: 'running', required: false, defaultValue: '1', order: 8, visible: true },
        { id: 'col-9', header: 'Usable Idle', fieldKey: 'usable_idle', required: false, defaultValue: '0', order: 9, visible: true },
        { id: 'col-10', header: 'Repairable Idle', fieldKey: 'repairable_idle', required: false, defaultValue: '0', order: 10, visible: true },
        { id: 'col-11', header: 'Total Quantity', fieldKey: 'total_quantity', required: false, defaultValue: '— (Auto-Calculated)', order: 11, visible: true, isCalculated: true, readOnly: true },
        { id: 'col-12', header: 'Machine Status', fieldKey: 'machine_status', required: false, defaultValue: 'ACTIVE', order: 12, visible: true },
        { id: 'col-13', header: 'Remarks', fieldKey: 'remarks', required: false, defaultValue: '', order: 13, visible: true }
      ]
    };
  }

  /**
   * UNIVERSAL VALUE RESOLVER:
   * Maps any data object (live machine record or sample template record) to a specific fieldKey.
   * Guaranteed to be order-independent!
   */
  getFieldValue(record, fieldKey, rowIndex = 0, lookups = null) {
    if (!record || !fieldKey) return '';

    const key = fieldKey.trim().toLowerCase();

    // 1. Sequence / Row Number
    if (key === 'sl' || key === 'sl_no') {
      return rowIndex + 1;
    }

    // 2. Machine Name / Category
    if (key === 'machine_name' || key === 'machinename') {
      if (record.machine_name) return record.machine_name;
      if (record.machineName) return record.machineName;
      if (lookups?.mnMap && record.machineNameId) return lookups.mnMap.get(record.machineNameId) || 'Plane Machine';
      return record.machineNameStr || 'Plane Machine';
    }

    // 3. Brand
    if (key === 'machine_brand' || key === 'brand') {
      if (record.machine_brand) return record.machine_brand;
      if (record.brand) return record.brand;
      if (lookups?.brdMap && record.brandId) return lookups.brdMap.get(record.brandId) || 'JUKI';
      return record.brandStr || 'JUKI';
    }

    // 4. Model
    if (key === 'machine_model' || key === 'model') {
      if (record.machine_model) return record.machine_model;
      if (record.model) return record.model;
      if (lookups?.mdlMap && record.modelId) return lookups.mdlMap.get(record.modelId) || 'DDL-9000';
      return record.modelStr || 'DDL-9000';
    }

    // 5. Serial Number
    if (key === 'machine_serial' || key === 'serialnumber' || key === 'serial') {
      return record.machine_serial || record.serialNumber || record.serial || '';
    }

    // 6. Machine Category
    if (key === 'machine_category' || key === 'category') {
      return record.machine_category || record.category || record.customValues?.category || 'Sewing Machines';
    }

    // 7. Current Location / Unit / Factory
    if (key === 'unit_factory' || key === 'unit' || key === 'factory' || key === 'current_location' || key === 'location') {
      if (record.current_location) return record.current_location;
      if (record.unit_factory) return record.unit_factory;
      if (record.unit) return record.unit;
      if (lookups?.untMap && record.unitId) return lookups.untMap.get(record.unitId) || '';
      return record.unitStr || 'AKM Knitwear Ltd.';
    }

    // 8. Floor
    if (key === 'floor') {
      if (record.floor) return record.floor;
      if (lookups?.flrMap && record.floorId) return lookups.flrMap.get(record.floorId) || '';
      return record.floorStr || '3rd Floor';
    }

    // 9. Section / Line / Department
    if (key === 'section' || key === 'line' || key === 'dept' || key === 'department') {
      let rawLine = '';
      if (record.section) rawLine = record.section;
      else if (record.line) rawLine = record.line;
      else if (lookups?.linMap && record.lineId) rawLine = lookups.linMap.get(record.lineId) || '';
      else rawLine = record.lineStr || '';
      const clean = formatDisplayLine(rawLine, 'NORMAL');
      return clean || rawLine || 'A';
    }

    if (key === 'line_code' || key === 'full_line' || key === 'linecode') {
      if (record.line) return record.line;
      if (lookups?.linMap && record.lineId) return lookups.linMap.get(record.lineId) || '';
      return record.lineStr || 'TS-A';
    }

    // 8. Running Quantity
    if (key === 'running' || key === 'qty_running' || key === 'running_qty') {
      if (record.running !== undefined && record.running !== null) return record.running;
      if (record.qty_running !== undefined && record.qty_running !== null) return record.qty_running;
      return record.status === 'ACTIVE' ? (record.quantity ?? 1) : 0;
    }

    // 9. Usable Idle Quantity
    if (key === 'usable_idle' || key === 'usableidle' || key === 'qty_usable_idle') {
      if (record.usable_idle !== undefined && record.usable_idle !== null) return record.usable_idle;
      if (record.usableIdle !== undefined && record.usableIdle !== null) return record.usableIdle;
      if (record.qty_usable_idle !== undefined && record.qty_usable_idle !== null) return record.qty_usable_idle;
      return record.status === 'IDLE' ? (record.quantity ?? 1) : 0;
    }

    // 10. Repairable Idle Quantity
    if (key === 'repairable_idle' || key === 'repairableidle' || key === 'qty_repairable_idle') {
      if (record.repairable_idle !== undefined && record.repairable_idle !== null) return record.repairable_idle;
      if (record.repairableIdle !== undefined && record.repairableIdle !== null) return record.repairableIdle;
      if (record.qty_repairable_idle !== undefined && record.qty_repairable_idle !== null) return record.qty_repairable_idle;
      return (record.status === 'MAINTENANCE' || record.status === 'BREAKDOWN') ? (record.quantity ?? 1) : 0;
    }

    // 11. Total Quantity (Auto-Calculated = Running + Usable Idle + Repairable Idle)
    if (key === 'total_quantity' || key === 'totalquantity' || key === 'total_qty' || key === 'quantity' || key === 'qty') {
      if (record.total_quantity !== undefined && record.total_quantity !== null) return record.total_quantity;
      if (record.totalQuantity !== undefined && record.totalQuantity !== null) return record.totalQuantity;
      const r = parseInt(record.running ?? record.qty_running ?? 0, 10) || 0;
      const u = parseInt(record.usable_idle ?? record.usableIdle ?? record.qty_usable_idle ?? 0, 10) || 0;
      const rp = parseInt(record.repairable_idle ?? record.repairableIdle ?? record.qty_repairable_idle ?? 0, 10) || 0;
      const sum = r + u + rp;
      return sum > 0 ? sum : (record.quantity ?? 1);
    }

    // 12. Status
    if (key === 'machine_status' || key === 'status') {
      return record.machine_status || record.status || 'ACTIVE';
    }

    // 13. Purchase Date
    if (key === 'purchase_date' || key === 'purchasedate') {
      return record.purchase_date || record.purchaseDate || record.customValues?.purchase_date || '2023-01-15';
    }

    // 14. Installation Date
    if (key === 'installation_date' || key === 'installationdate') {
      return record.installation_date || record.installationDate || record.customValues?.installation_date || '2023-01-20';
    }

    // 15. Supplier Name
    if (key === 'supplier_name' || key === 'supplier') {
      return record.supplier_name || record.supplier || record.customValues?.supplier || 'Pacific Associates Ltd.';
    }

    // 16. Country of Origin
    if (key === 'country_of_origin' || key === 'origin') {
      return record.country_of_origin || record.origin || record.customValues?.country_of_origin || 'Japan';
    }

    // 17. Machine Capacity
    if (key === 'machine_capacity' || key === 'capacity') {
      return record.machine_capacity || record.capacity || record.customValues?.capacity || record.customValues?.max_rpm || '5000 RPM';
    }

    // 18. Remarks
    if (key === 'remarks' || key === 'description' || key === 'notes') {
      return record.remarks || record.description || record.notes || '';
    }

    // 19. Dynamic Custom Fields (e.g. cf_voltage, cf_max_rpm)
    if (key.startsWith('cf_')) {
      const code = key.replace('cf_', '');
      return record.customValues?.[code] ?? record[code] ?? record[key] ?? '';
    }

    // Direct object key fallback
    return record[fieldKey] ?? record[key] ?? '';
  }

  async ensureXlsx() {
    if (typeof XLSX !== 'undefined') return window.XLSX;
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'lib/xlsx.full.min.js';
      script.onload = () => {
        if (typeof XLSX !== 'undefined') resolve(window.XLSX);
        else reject(new Error('SheetJS failed to initialize.'));
      };
      script.onerror = () => {
        const cdnScript = document.createElement('script');
        cdnScript.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
        cdnScript.onload = () => resolve(window.XLSX);
        cdnScript.onerror = () => reject(new Error('Failed to load SheetJS library.'));
        document.head.appendChild(cdnScript);
      };
      document.head.appendChild(script);
    });
  }

  /**
   * Parse an Excel workbook containing one or multiple worksheets
   */
  async parseMultiSheetWorkbook(arrayBuffer, fileName = 'Spreadsheet.xlsx') {
    if (typeof XLSX === 'undefined') {
      await this.ensureXlsx();
    }

    const data = new Uint8Array(arrayBuffer);
    const workbook = XLSX.read(data, { type: 'array' });
    const sheetNames = workbook.SheetNames || [];

    if (sheetNames.length === 0) {
      throw new Error('The uploaded Excel file does not contain any worksheets.');
    }

    const parsedSheets = [];
    let totalRowsCount = 0;

    sheetNames.forEach((sheetName, sIdx) => {
      // Ignore reference/guideline sheets by default if named Master Data Reference
      const isRefSheet = sheetName.toLowerCase().includes('reference') || sheetName.toLowerCase().includes('guideline') || sheetName.toLowerCase().includes('master data');
      const worksheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      if (json && json.length > 0) {
        const headers = Object.keys(json[0] || {});
        const suggestedMapping = this.suggestColumnMapping(headers, sheetName);
        totalRowsCount += json.length;

        parsedSheets.push({
          name: sheetName,
          rows: json,
          headers: headers,
          rowCount: json.length,
          suggestedMapping: suggestedMapping,
          selected: !isRefSheet && (parsedSheets.length === 0 || sheetName.toLowerCase().includes('machine') || sheetName.toLowerCase().includes('inventory'))
        });
      }
    });

    if (parsedSheets.length === 0) {
      throw new Error('The uploaded workbook contains no data rows in any worksheet.');
    }

    // Ensure at least one data sheet is selected
    if (!parsedSheets.some(s => s.selected)) {
      parsedSheets[0].selected = true;
    }

    return {
      fileName: fileName,
      sheetNames: parsedSheets.map(s => s.name),
      sheets: parsedSheets,
      totalRows: totalRowsCount
    };
  }

  /**
   * Resolve garment machine short code
   */
  getGarmentMachineShortCode(rawMachineName) {
    if (!rawMachineName) return '';
    const clean = String(rawMachineName).trim().toLowerCase();
    if (GARMENT_MACHINE_SHORT_CODES[clean]) return GARMENT_MACHINE_SHORT_CODES[clean];
    for (const [key, code] of Object.entries(GARMENT_MACHINE_SHORT_CODES)) {
      if (clean.includes(key) || key.includes(clean)) {
        return code;
      }
    }
    return '';
  }

  /**
   * Normalize machine serial with short code prefix according to user rules:
   * 1. If pure numbers (e.g. 400035, 01) -> P/M-400035
   * 2. If already starts with exact short code (e.g. P/M-400035) -> preserve
   * 3. If typo in short code (e.g. PM-400035, p/m-400035) -> fix to P/M-400035
   * 4. If already custom format (e.g. SN-10001, C/S-19) -> preserve
   */
  normalizeMachineSerialWithShortCode(rawSerial, shortCode) {
    if (!rawSerial) return '';
    const serial = String(rawSerial).trim();
    if (!serial) return '';
    if (!shortCode) return serial;

    const scClean = String(shortCode).trim();
    if (!scClean) return serial;

    // Exact prefix match: already starts with `${scClean}-`
    if (serial.toUpperCase().startsWith(`${scClean.toUpperCase()}-`)) {
      const rest = serial.substring(scClean.length + 1).trim();
      return `${scClean}-${rest}`;
    }

    // Already starts with `${scClean}` followed by separator or space
    if (serial.toUpperCase().startsWith(scClean.toUpperCase())) {
      const after = serial.substring(scClean.length).trim();
      const cleanRest = after.replace(/^[-_\s/:.]+/, '');
      if (cleanRest) {
        return `${scClean}-${cleanRest}`;
      }
    }

    // Check typo/variation in short code: e.g. short code is "P/M", but user wrote "PM-400035" or "p-m-400035"
    const scAlpha = scClean.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (scAlpha.length >= 2) {
      const match = serial.match(/^([A-Za-z0-9\/\-_.]+?)[\s\-_:/]+(\d.*)$/);
      if (match) {
        const prefixAlpha = match[1].toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (prefixAlpha === scAlpha) {
          return `${scClean}-${match[2].trim()}`;
        }
      }
    }

    // Pure digits or simple serial number (e.g. 400035, 01, 192, 12, 1237):
    if (/^\d+$/.test(serial)) {
      return `${scClean}-${serial}`;
    }

    // If serial already starts with a letter followed by a dash or letters (distinct custom prefix like SN-10001, MO-755, JUKI-01)
    if (/^[A-Za-z]{2,}[-_]/.test(serial)) {
      return serial;
    }

    // If serial already starts with another short code format (e.g. D/N-A-01, C/S-19, O/L-1237)
    if (/^[A-Za-z][/][A-Za-z]/.test(serial)) {
      return serial;
    }

    // Otherwise attach short code prefix
    return `${scClean}-${serial}`;
  }

  /**
   * Suggest smart column mapping matching common garments inventory naming conventions
   */
  suggestColumnMapping(fileHeaders, sheetName = '') {
    const mapping = {};
    const lowerHeaders = fileHeaders.map(h => ({ raw: h, clean: h.toLowerCase().replace(/[^a-z0-9]/g, '') }));

    const patterns = {
      machine_name: ['machinename', 'machinetype', 'mcname', 'itemname', 'machinedescription', 'type', 'machine'],
      machine_brand: ['machinebrand', 'brand', 'mcbrand', 'make', 'manufacturer', 'company'],
      machine_model: ['machinemodel', 'model', 'mcmodel', 'modelno', 'modelnumber', 'specification', 'spec'],
      machine_serial: [
        'machinenumber', 'machineno', 'machinenoonlynumber', 'machinenum',
        'machineserial', 'machineserialnumber', 'machineserialno',
        'serialnumber', 'serialno', 'serialnum', 'serial',
        'mcserial', 'mcserialnumber', 'mcserialno', 'mcnumber', 'mcno',
        'm/cno', 'm/cnumber', 'm/cserial', 'm/cserialno',
        'manufacturingserialnumber', 'manufacturingserial', 'manufacturingno',
        'sn', 'msn', 'machinecode', 'machinesl', 'mcsl',
        'assetno', 'assetid', 'assettag', 'barcode'
      ],
      machine_short_code: [
        'machinenamesortform', 'machinesortform', 'sortform', 'shortcode',
        'machineshortcode', 'mcshortcode'
      ],
      unit_factory: ['currentlocation', 'unitfactory', 'factoryunit', 'unit', 'factory', 'location', 'plant', 'factoryname'],
      floor: ['floor', 'floorno', 'buildingfloor', 'floorname', 'level'],
      line: ['section', 'line', 'lineno', 'productionline', 'sewingline', 'linename', 'department', 'dept'],
      running: ['running', 'runningqty', 'qtyrunning', 'runningquantity', 'activeqty', 'inuse', 'runqty'],
      usable_idle: ['usableidle', 'usableidleqty', 'idleusable', 'usable', 'usableqty'],
      repairable_idle: ['repairableidle', 'repairableidleqty', 'idlerepairable', 'repairable', 'repairidle', 'repairqty'],
      total_quantity: ['totalquantity', 'totalqty', 'total', 'quantity', 'qty', 'count', 'pcs'],
      machine_status: ['machinestatus', 'status', 'condition', 'state', 'operationalstatus'],
      purchase_date: ['purchasedate', 'dateofpurchase', 'buyingdate', 'pdate'],
      installation_date: ['installationdate', 'commissioningdate', 'setupdate', 'instdate'],
      supplier_name: ['suppliername', 'supplier', 'vendor', 'vendorname'],
      country_of_origin: ['countryoforigin', 'origin', 'country', 'madein'],
      machine_capacity: ['machinecapacity', 'capacity', 'maxrpm', 'speed', 'rpm'],
      remarks: ['remarks', 'notes', 'comments', 'description', 'remark', 'specs']
    };

    const customFields = customFieldService.getAllFields();
    customFields.forEach(cf => {
      const cfKey = `cf_${cf.code}`;
      const cleanLabel = cf.label.toLowerCase().replace(/[^a-z0-9]/g, '');
      const cleanCode = cf.code.toLowerCase().replace(/[^a-z0-9]/g, '');
      patterns[cfKey] = [cleanLabel, cleanCode, `custom${cleanCode}`, `custom${cleanLabel}`];
    });

    for (const [sysField, matchWords] of Object.entries(patterns)) {
      for (const h of lowerHeaders) {
        // Skip sl/slno from matching machine_serial IF another candidate header exists in file
        if ((h.clean === 'sl' || h.clean === 'slno') && sysField === 'machine_serial') {
          const hasOtherSerial = lowerHeaders.some(other =>
            other.clean !== 'sl' && other.clean !== 'slno' &&
            matchWords.some(w => other.clean === w || other.clean.includes(w) || w.includes(other.clean))
          );
          if (hasOtherSerial) continue;
        } else if (h.clean === 'sl' || h.clean === 'slno') {
          continue;
        }

        if (matchWords.some(w => h.clean === w || h.clean.includes(w) || w.includes(h.clean))) {
          mapping[sysField] = h.raw;
          break;
        }
      }
    }

    // Fallback: If machine_serial is still unmapped and the file contains SL / SL NO, map it!
    if (!mapping.machine_serial) {
      const slCol = lowerHeaders.find(h => h.clean === 'sl' || h.clean === 'slno' || h.clean === 'sno' || h.clean === 'sino');
      if (slCol) {
        mapping.machine_serial = slCol.raw;
      }
    }

    return mapping;
  }

  /**
   * Validate all sheets in a multi-worksheet workbook with cross-sheet duplicate detection,
   * cell-level coordinates, Master Data auto-fix (spaces & casing), and composite duplicate rules:
   * (Machine Name + Brand + Model + Serial Number).
   */
  validateMultiSheetWorkbook(parsedSheets, sheetMappings = {}, duplicatePolicy = DUPLICATE_POLICIES.UPDATE_EXISTING, unknownResolutions = {}) {
    const customFields = customFieldService.getActiveFields();
    const existingMachines = storage.getTable(TABLE_NAMES.MACHINES) || [];
    const existingSerialsMap = new Map(existingMachines.map(m => [m.serialNumber.trim().toUpperCase(), m]));

    const units = storage.getTable(TABLE_NAMES.UNITS) || [];
    const floors = storage.getTable(TABLE_NAMES.FLOORS) || [];
    const lines = storage.getTable(TABLE_NAMES.LINES) || [];
    const groups = storage.getTable(TABLE_NAMES.GROUPS) || [];
    const machineNames = storage.getTable(TABLE_NAMES.MACHINE_NAMES) || [];
    const brands = storage.getTable(TABLE_NAMES.BRANDS) || [];
    const models = storage.getTable(TABLE_NAMES.MODELS) || [];

    // Pre-build Master Data Name Maps for fast ID lookup
    const mnMap = new Map(machineNames.map(x => [x.id, x.name]));
    const brdMap = new Map(brands.map(x => [x.id, x.name]));
    const mdlMap = new Map(models.map(x => [x.id, x.name]));

    const normKey = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    // Existing Database Composite Key Map: Machine Name + Brand + Model + Serial Number
    const existingCompositeMap = new Map();
    existingMachines.forEach(m => {
      const mMN = mnMap.get(m.machineNameId) || m.machineNameStr || '';
      const mBrd = brdMap.get(m.brandId) || m.brandStr || '';
      const mMdl = mdlMap.get(m.modelId) || m.modelStr || '';
      const mSN = m.serialNumber || '';
      const comp = `${normKey(mMN)}|${normKey(mBrd)}|${normKey(mMdl)}|${normKey(mSN)}`;
      if (!existingCompositeMap.has(comp)) {
        existingCompositeMap.set(comp, m);
      }
    });

    // Helper: Excel Column Index (0 -> A, 1 -> B, 25 -> Z, 26 -> AA)
    const getExcelColLetter = (colIdx) => {
      let letter = '';
      let temp = colIdx;
      while (temp >= 0) {
        letter = String.fromCharCode((temp % 26) + 65) + letter;
        temp = Math.floor(temp / 26) - 1;
      }
      return letter;
    };

    // Global in-file composite duplicate tracker: compKey -> { sheetName, rowNumber, cell, serialNumber, machineName, brand, model }
    const globalSeenCompositeInFile = new Map();
    const globalSeenSerialsInFile = new Map(); // SN -> { sheetName, rowNumber, cell }

    const validatedSheets = [];
    const allValidationErrors = []; // Diagnostic errors list: { sheetName, rowNumber, cell, column, enteredValue, error, severity, suggestedCorrection }
    const grandDuplicatesList = []; // [{ sheetName, cell, rowNumber, column, serialNumber, machineName, brand, model, reason }]
    const grandErrorsList = []; // [{ sheetName, cell, rowNumber, column, enteredValue, error, severity }]
    const grandAutoFixedList = []; // [{ sheetName, cell, rowNumber, column, original, fixed, type, reason }]

    const unknownEntities = {
      machineNames: new Set(),
      brands: new Set(),
      models: new Set(),
      units: new Set(),
      floors: new Set(),
      lines: new Set()
    };

    let grandTotalRows = 0;
    let grandValidRows = 0;
    let grandInvalidRows = 0;
    let grandDuplicateRows = 0;
    let grandUpdateRows = 0;
    let grandNewRows = 0;

    // Helper to sanitize and normalize multiple whitespace/tabs
    const cleanSpaces = (val) => {
      if (val === undefined || val === null) return '';
      return String(val).trim().replace(/\s+/g, ' ');
    };

    parsedSheets.forEach(sheet => {
      if (!sheet.selected) return;

      const mapping = sheetMappings[sheet.name] || sheet.suggestedMapping || {};
      const sheetRecords = [];
      let sheetValidCount = 0;
      let sheetInvalidCount = 0;
      let sheetUpdateCount = 0;
      let sheetDuplicateCount = 0;
      let sheetNewCount = 0;

      // Map column headers to Excel letters
      const headerColIndexMap = new Map();
      (sheet.headers || []).forEach((h, idx) => {
        headerColIndexMap.set(h, idx);
      });

      const getCellAddress = (colName, rowNum) => {
        if (!colName) return `Row ${rowNum}`;
        const idx = headerColIndexMap.get(colName);
        if (idx !== undefined && idx >= 0) {
          return `${getExcelColLetter(idx)}${rowNum}`;
        }
        return `Row ${rowNum}`;
      };

      sheet.rows.forEach((row, rowIndex) => {
        const rowNumber = rowIndex + 2; // Row 1 is header
        const rowErrors = [];
        const rowWarnings = [];

        // Extract and clean field values using mapped fieldKey
        const mapped = {};
        for (const [fieldKey, fileCol] of Object.entries(mapping)) {
          if (fileCol && row[fileCol] !== undefined) {
            mapped[fieldKey] = cleanSpaces(row[fileCol]);
          }
        }

        // Canonical Raw Fields
        let machineNameStr = mapped.machine_name || mapped.machineName || '';
        let brandStr = mapped.machine_brand || mapped.brand || '';
        let modelStr = mapped.machine_model || mapped.model || '';
        let serialNumber = mapped.machine_serial || mapped.serialNumber || mapped.serial || '';
        let unitStr = mapped.unit_factory || mapped.unit || '';
        let floorStr = mapped.floor || '';
        let lineStr = mapped.line || '';

        // Fallback search across all possible columns in raw row if serialNumber is still empty
        if (!serialNumber) {
          const serialCandidates = [
            'Machine Number', 'Machine No.', 'Machine No', 'Machine No. (Only Number)',
            'Machine Serial', 'Machine Serial Number', 'Serial Number', 'Serial No', 'Serial No.',
            'Serial', 'M/C No.', 'M/C No', 'MC No.', 'MC No', 'MC Number', 'M/C Serial', 'MC Serial',
            'Manufacturing Serial Number', 'Manufacturing Serial', 'S/N', 'SN', 'MSN',
            'Machine SL', 'MC SL', 'Sl No', 'SL No', 'SL. NO.', 'SL NO', 'SL', 'Sl'
          ];
          for (const cand of serialCandidates) {
            if (row[cand] !== undefined && row[cand] !== null && String(row[cand]).trim() !== '') {
              serialNumber = cleanSpaces(row[cand]);
              break;
            }
          }
          if (!serialNumber) {
            for (const [k, v] of Object.entries(row)) {
              if (v !== undefined && v !== null && String(v).trim() !== '') {
                const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
                if (cleanK.includes('serial') || cleanK.includes('machinenumber') || cleanK.includes('machineno') || cleanK.includes('mcno')) {
                  serialNumber = cleanSpaces(v);
                  break;
                }
              }
            }
          }
        }

        // -------------------------------------------------------------------------
        // 1. Master Data Auto-Fix & Normalization (Spaces, Casing & Canonical Match)
        // -------------------------------------------------------------------------
        // Machine Name
        let foundMN = machineNameStr ? resolveMachineNameSmart(machineNameStr, machineNames) : null;
        if (foundMN && foundMN.name) {
          if (foundMN.name !== machineNameStr) {
            const cell = getCellAddress(mapping.machine_name, rowNumber);
            grandAutoFixedList.push({
              sheetName: sheet.name,
              cell,
              rowNumber,
              column: mapping.machine_name || 'Machine Name',
              original: machineNameStr,
              fixed: foundMN.name,
              type: 'MACHINE_NAME',
              reason: 'Normalized space/casing to canonical Master Machine Name'
            });
            if (mapping.machine_name && row[mapping.machine_name] !== undefined) {
              row[mapping.machine_name] = foundMN.name;
            }
            machineNameStr = foundMN.name;
            mapped.machine_name = foundMN.name;
          }
        } else if (machineNameStr && !foundMN) {
          unknownEntities.machineNames.add(machineNameStr);
        }

        // Brand
        let foundBrand = brandStr ? resolveBrandSmart(brandStr, brands) : null;
        if (foundBrand && foundBrand.name) {
          if (foundBrand.name !== brandStr) {
            const cell = getCellAddress(mapping.machine_brand, rowNumber);
            grandAutoFixedList.push({
              sheetName: sheet.name,
              cell,
              rowNumber,
              column: mapping.machine_brand || 'Machine Brand',
              original: brandStr,
              fixed: foundBrand.name,
              type: 'BRAND',
              reason: 'Normalized space/casing to canonical Master Brand'
            });
            if (mapping.machine_brand && row[mapping.machine_brand] !== undefined) {
              row[mapping.machine_brand] = foundBrand.name;
            }
            brandStr = foundBrand.name;
            mapped.machine_brand = foundBrand.name;
          }
        } else if (brandStr && !foundBrand) {
          unknownEntities.brands.add(brandStr);
        }

        // Model
        let foundModel = modelStr ? resolveModelSmart(modelStr, foundBrand, foundMN, models) : null;
        if (foundModel && foundModel.name) {
          if (foundModel.name !== modelStr) {
            const cell = getCellAddress(mapping.machine_model, rowNumber);
            grandAutoFixedList.push({
              sheetName: sheet.name,
              cell,
              rowNumber,
              column: mapping.machine_model || 'Machine Model',
              original: modelStr,
              fixed: foundModel.name,
              type: 'MODEL',
              reason: 'Normalized space/casing to canonical Master Model'
            });
            if (mapping.machine_model && row[mapping.machine_model] !== undefined) {
              row[mapping.machine_model] = foundModel.name;
            }
            modelStr = foundModel.name;
            mapped.machine_model = foundModel.name;
          }
        } else if (modelStr && !foundModel) {
          unknownEntities.models.add(modelStr);
        }

        // Location Hierarchy Resolution & Auto-Fix
        let foundUnit = unitStr ? (units.find(u => u.name.toLowerCase() === unitStr.toLowerCase() || u.code.toLowerCase() === unitStr.toLowerCase()) || null) : null;
        const foundFloor = floorStr ? resolveFloorSmart(floorStr, floors, foundUnit) : (floors[0] || null);

        if (!foundUnit && foundFloor && foundFloor.unitId) {
          foundUnit = units.find(u => u.id === foundFloor.unitId) || null;
        }
        if (!foundUnit) {
          foundUnit = units[0] || null;
        }

        const foundLine = lineStr ? resolveLineSmart(lineStr, foundFloor, lines) : null;
        if (lineStr && !foundLine) {
          unknownEntities.lines.add(lineStr);
        }

        // Auto-fix Location fields in row
        if (foundFloor && floorStr && foundFloor.name !== floorStr) {
          const cell = getCellAddress(mapping.floor, rowNumber);
          grandAutoFixedList.push({
            sheetName: sheet.name,
            cell,
            rowNumber,
            column: mapping.floor || 'Floor',
            original: floorStr,
            fixed: foundFloor.name,
            type: 'FLOOR',
            reason: 'Normalized Floor to canonical Master Data'
          });
          if (mapping.floor && row[mapping.floor] !== undefined) row[mapping.floor] = foundFloor.name;
          floorStr = foundFloor.name;
        }
        if (foundLine && lineStr && foundLine.name !== lineStr) {
          const cell = getCellAddress(mapping.line, rowNumber);
          grandAutoFixedList.push({
            sheetName: sheet.name,
            cell,
            rowNumber,
            column: mapping.line || 'Line',
            original: lineStr,
            fixed: foundLine.name,
            type: 'LINE',
            reason: 'Normalized Line to canonical Master Data'
          });
          if (mapping.line && row[mapping.line] !== undefined) row[mapping.line] = foundLine.name;
          lineStr = foundLine.name;
        }

        // Quantities
        const runningVal = parseInt(mapped.running, 10) || 0;
        const usableIdleVal = parseInt(mapped.usable_idle, 10) || 0;
        const repairableIdleVal = parseInt(mapped.repairable_idle, 10) || 0;
        let totalQtyVal = runningVal + usableIdleVal + repairableIdleVal;
        if (totalQtyVal === 0) {
          if (mapped.total_quantity) totalQtyVal = parseInt(mapped.total_quantity, 10) || 0;
          else if (mapped.quantity) totalQtyVal = parseInt(mapped.quantity, 10) || 0;
        }
        if (totalQtyVal === 0) totalQtyVal = 1;

        const statusStr = (mapped.machine_status || mapped.status || (runningVal > 0 ? 'ACTIVE' : (usableIdleVal > 0 ? 'IDLE' : (repairableIdleVal > 0 ? 'MAINTENANCE' : 'ACTIVE')))).trim().toUpperCase();

        // -------------------------------------------------------------------------
        // 2. Mandatory Field Validations with Exact Cell Coordinates
        // -------------------------------------------------------------------------
        if (!machineNameStr) {
          const err = 'Machine Name is required and cannot be empty.';
          const cell = getCellAddress(mapping.machine_name, rowNumber);
          rowErrors.push(err);
          allValidationErrors.push({
            sheetName: sheet.name,
            rowNumber: rowNumber,
            cell: cell,
            column: mapping.machine_name || 'Machine Name',
            enteredValue: '— (Empty)',
            error: err,
            suggestedCorrection: 'Enter a valid Machine Name (e.g. Lock Stitch Machine, Overlock Machine, Flatlock Machine).',
            severity: 'ERROR'
          });
          grandErrorsList.push({
            sheetName: sheet.name,
            cell: cell,
            rowNumber: rowNumber,
            column: mapping.machine_name || 'Machine Name',
            enteredValue: '—',
            error: err,
            severity: 'ERROR'
          });
        }

        // Machine Brand and Machine Model are optional. If blank in Excel, they remain blank for future editing.

        // -------------------------------------------------------------------------
        // 2B. Machine Short Code & Serial Normalization / Preservation
        // -------------------------------------------------------------------------
        const explicitShortCode = mapped.machine_short_code || 
          cleanSpaces(row['Machine Name (Sort Form)'] || row['Sort Form'] || row['Short Code'] || row['Machine Short Code'] || '');
        
        let resolvedShortCode = explicitShortCode || '';
        if (!resolvedShortCode && foundMN && foundMN.code && !/^[A-Z]{4}$/.test(foundMN.code)) {
          resolvedShortCode = foundMN.code;
        }
        if (!resolvedShortCode && machineNameStr) {
          resolvedShortCode = this.getGarmentMachineShortCode(machineNameStr) || (foundMN?.code && !/^[A-Z]{4}$/.test(foundMN.code) ? foundMN.code : '');
        }

        if (serialNumber) {
          // PRESERVE user-provided serial number exactly as entered.
          // Only apply normalization if the serial is purely numeric (e.g. 001, 400035)
          // and a short code exists — in all other cases, keep the user's value as-is.
          const origSerial = serialNumber;
          if (/^\d+$/.test(serialNumber.trim()) && resolvedShortCode) {
            // Pure digits: prepend short code prefix (e.g. 001 -> DDL-001)
            serialNumber = `${resolvedShortCode}-${serialNumber.trim()}`;
            grandAutoFixedList.push({
              sheetName: sheet.name,
              cell: getCellAddress(mapping.machine_serial || 'Machine Serial', rowNumber),
              rowNumber,
              column: mapping.machine_serial || 'Machine Serial',
              original: origSerial,
              fixed: serialNumber,
              type: 'SERIAL_PREFIX',
              reason: `Applied machine short code '${resolvedShortCode}' prefix to numeric serial`
            });
          }
          // Otherwise: preserve the user's serial number exactly as entered (no modification)
        } else {
          // Auto-generate serial number only if truly blank across all columns in Excel
          const prefix = resolvedShortCode || (foundFloor?.code || (foundFloor?.name ? foundFloor.name.substring(0, 2).toUpperCase() : 'MC'));
          serialNumber = `${prefix}-${String(rowIndex + 1).padStart(3, '0')}`;
          rowWarnings.push(`Machine Serial was blank in Excel; assigned '${serialNumber}'.`);
        }

        // -------------------------------------------------------------------------
        // 3. Composite Duplicate Check: Machine Name + Brand + Model + Serial
        // -------------------------------------------------------------------------
        // Rules:
        // - Record is duplicate IF AND ONLY IF (Machine Name + Brand + Model + Serial) match!
        // - If any of the composite items differ, it is NOT considered duplicate.
        const compKey = `${normKey(machineNameStr)}|${normKey(brandStr)}|${normKey(modelStr)}|${normKey(serialNumber)}`;
        const serialCell = getCellAddress(mapping.machine_serial || mapping.machine_model, rowNumber);

        // A. Intra-file & Cross-Sheet Composite Duplicate Check
        if (globalSeenCompositeInFile.has(compKey)) {
          const prev = globalSeenCompositeInFile.get(compKey);
          const err = `Duplicate Machine Record: Name ('${machineNameStr}'), Brand ('${brandStr}'), Model ('${modelStr}'), and Serial ('${serialNumber}') match another row in file (First seen in sheet '${prev.sheetName}', Cell ${prev.cell}).`;
          rowErrors.push(err);
          allValidationErrors.push({
            sheetName: sheet.name,
            rowNumber: rowNumber,
            cell: serialCell,
            column: mapping.machine_serial || 'Machine Serial',
            enteredValue: serialNumber,
            error: err,
            suggestedCorrection: `Ensure each machine has unique specs or serial. Check row ${prev.rowNumber} (${prev.sheetName}: Cell ${prev.cell}).`,
            severity: 'ERROR'
          });
          grandDuplicatesList.push({
            sheetName: sheet.name,
            cell: serialCell,
            rowNumber: rowNumber,
            column: mapping.machine_serial || 'Machine Serial',
            serialNumber: serialNumber,
            machineName: machineNameStr,
            brand: brandStr,
            model: modelStr,
            reason: err
          });
          sheetDuplicateCount++;
          grandDuplicateRows++;
        } else {
          globalSeenCompositeInFile.set(compKey, {
            sheetName: sheet.name,
            rowNumber: rowNumber,
            cell: serialCell,
            serialNumber: serialNumber,
            machineName: machineNameStr,
            brand: brandStr,
            model: modelStr
          });
        }

        // B. Database Existence & Composite Duplicate Check
        const existingMachineByComposite = existingCompositeMap.get(compKey);
        const existingMachineBySerial = serialNumber ? existingSerialsMap.get(serialNumber.toUpperCase()) : null;
        const existingMachine = existingMachineByComposite || existingMachineBySerial;
        let isUpdate = false;

        if (existingMachine) {
          if (existingMachineByComposite) {
            // Full composite duplicate (Name, Brand, Model, Serial all match)
            if (duplicatePolicy === DUPLICATE_POLICIES.REJECT || duplicatePolicy === 'REJECT') {
              const err = `Machine already exists in database with matching Name ('${machineNameStr}'), Brand ('${brandStr}'), Model ('${modelStr}'), and Serial ('${serialNumber}') (ID: ${existingMachine.id}). Duplicate record blocked.`;
              rowErrors.push(err);
              allValidationErrors.push({
                sheetName: sheet.name,
                rowNumber: rowNumber,
                cell: serialCell,
                column: mapping.machine_serial || 'Machine Serial',
                enteredValue: serialNumber,
                error: err,
                suggestedCorrection: 'Use a new unique Serial Number or switch import mode to "Update Existing Machines".',
                severity: 'ERROR'
              });
              grandDuplicatesList.push({
                sheetName: sheet.name,
                cell: serialCell,
                rowNumber: rowNumber,
                column: mapping.machine_serial || 'Machine Serial',
                serialNumber: serialNumber,
                machineName: machineNameStr,
                brand: brandStr,
                model: modelStr,
                reason: err
              });
              sheetDuplicateCount++;
              grandDuplicateRows++;
            } else if (duplicatePolicy === DUPLICATE_POLICIES.UPDATE_EXISTING) {
              isUpdate = true;
              sheetUpdateCount++;
              grandUpdateRows++;
            } else if (duplicatePolicy === DUPLICATE_POLICIES.SKIP) {
              rowWarnings.push(`Machine '${machineNameStr} - ${modelStr} (${serialNumber})' already exists in database and will be skipped.`);
              sheetDuplicateCount++;
              grandDuplicateRows++;
            }
          } else {
            // Serial exists in DB but Name, Brand, or Model differ:
            // Under user rule ("If Name, Brand, or Model differ, it is not considered duplicate"),
            // this is NOT a duplicate of the same machine.
            if (duplicatePolicy === DUPLICATE_POLICIES.UPDATE_EXISTING) {
              isUpdate = true;
              sheetUpdateCount++;
              grandUpdateRows++;
            } else {
              sheetNewCount++;
              grandNewRows++;
            }
          }
        } else {
          sheetNewCount++;
          grandNewRows++;
        }

        // 5. Custom Fields Validation
        const customValues = {};
        customFields.forEach(cf => {
          const cfCol = mapping[`cf_${cf.code}`];
          if (cfCol && row[cfCol] !== undefined) {
            const rawVal = cleanSpaces(row[cfCol]);
            if (rawVal) customValues[cf.code] = rawVal;
          }
        });

        // Calculate Diff for Updates
        let diffs = [];
        if (isUpdate && existingMachine) {
          diffs = this._calculateBulkUpdateDiff(existingMachine, mapped, customValues, foundMN, foundBrand, foundModel, foundUnit, foundFloor, foundLine);
        }

        const isValid = rowErrors.length === 0;
        if (isValid) {
          sheetValidCount++;
          grandValidRows++;
        } else {
          sheetInvalidCount++;
          grandInvalidRows++;
        }

        sheetRecords.push({
          sheetName: sheet.name,
          rowNumber: rowNumber,
          cell: serialCell,
          rawRow: row,
          isValid: isValid,
          isUpdate: isUpdate,
          existingMachineId: existingMachine?.id || null,
          errors: rowErrors,
          warnings: rowWarnings,
          diffs: diffs,
          data: {
            serialNumber: serialNumber,
            machineNameId: foundMN?.id || (machineNames[0]?.id || 'mn-1'),
            machineNameStr: foundMN?.name || machineNameStr,
            brandId: foundBrand?.id || '',
            brandStr: foundBrand?.name || brandStr || '',
            modelId: foundModel?.id || '',
            modelStr: foundModel?.name || modelStr || '',
            groupId: foundUnit?.groupId || (groups[0]?.id || 'grp-1'),
            unitId: foundUnit?.id || (units[0]?.id || 'unt-1'),
            unitStr: foundUnit?.name || unitStr || 'AKM Knitwear Ltd.',
            floorId: foundFloor?.id || (floors[0]?.id || 'flr-1'),
            floorStr: foundFloor?.name || floorStr || 'Tista Floor',
            lineId: foundLine?.id || (lines[0]?.id || 'lin-1'),
            lineStr: foundLine?.name || lineStr || 'TS-A',
            running: runningVal,
            usableIdle: usableIdleVal,
            repairableIdle: repairableIdleVal,
            totalQuantity: totalQtyVal,
            quantity: totalQtyVal,
            status: statusStr,
            remarks: mapped.remarks || '',
            customValues: customValues
          }
        });
      });

      grandTotalRows += sheet.rows.length;

      validatedSheets.push({
        name: sheet.name,
        totalRows: sheet.rows.length,
        validRows: sheetValidCount,
        invalidRows: sheetInvalidCount,
        updateRows: sheetUpdateCount,
        duplicateRows: sheetDuplicateCount,
        newRows: sheetNewCount,
        records: sheetRecords
      });
    });

    return {
      totalSheets: validatedSheets.length,
      totalRows: grandTotalRows,
      validRows: grandValidRows,
      invalidRows: grandInvalidRows,
      duplicateRows: grandDuplicateRows,
      updateRows: grandUpdateRows,
      newRows: grandNewRows,
      duplicatePolicy: duplicatePolicy,
      sheets: validatedSheets,
      allErrors: allValidationErrors,
      duplicatesSummary: {
        count: grandDuplicateRows,
        cellList: grandDuplicatesList
      },
      errorsSummary: {
        count: grandInvalidRows,
        cellList: grandErrorsList
      },
      autoFixedSummary: {
        count: grandAutoFixedList.length,
        cellList: grandAutoFixedList
      },
      unknownEntities: {
        machineNames: Array.from(unknownEntities.machineNames),
        brands: Array.from(unknownEntities.brands),
        models: Array.from(unknownEntities.models),
        units: Array.from(unknownEntities.units),
        floors: Array.from(unknownEntities.floors),
        lines: Array.from(unknownEntities.lines)
      }
    };
  }

  _inferNameFromSheet(sheetName) {
    const clean = (sheetName || '').trim();
    if (clean.toLowerCase().includes('plain')) return 'Plane Machine';
    if (clean.toLowerCase().includes('overlock')) return 'Overlock Machine';
    if (clean.toLowerCase().includes('interlock') || clean.toLowerCase().includes('flatlock')) return 'Flat Lock Machine';
    if (clean.toLowerCase().includes('button')) return 'Button Hole Machine';
    if (clean.toLowerCase().includes('bar tack') || clean.toLowerCase().includes('bartack')) return 'Bar Tack Machine';
    if (clean.toLowerCase().includes('feed')) return 'Feed Off The Arm';
    return clean;
  }

  _calculateBulkUpdateDiff(existing, mapped, customValues, foundMN, foundBrand, foundModel, foundUnit, foundFloor, foundLine) {
    const diffs = [];
    const mnMap = new Map(storage.getTable(TABLE_NAMES.MACHINE_NAMES).map(x => [x.id, x.name]));
    const brdMap = new Map(storage.getTable(TABLE_NAMES.BRANDS).map(x => [x.id, x.name]));
    const mdlMap = new Map(storage.getTable(TABLE_NAMES.MODELS).map(x => [x.id, x.name]));
    const untMap = new Map(storage.getTable(TABLE_NAMES.UNITS).map(x => [x.id, x.name]));
    const flrMap = new Map(storage.getTable(TABLE_NAMES.FLOORS).map(x => [x.id, x.name]));
    const linMap = new Map(storage.getTable(TABLE_NAMES.LINES).map(x => [x.id, x.name]));

    const checkField = (field, label, oldVal, newVal) => {
      if (newVal !== undefined && newVal !== null && String(newVal).trim() !== '' && String(oldVal) !== String(newVal)) {
        diffs.push({ field, label, oldValue: oldVal || '—', newValue: newVal });
      }
    };

    if (foundMN && foundMN.id !== existing.machineNameId) {
      checkField('machineNameId', 'Machine Name', mnMap.get(existing.machineNameId), foundMN.name);
    }
    if (foundBrand && foundBrand.id !== existing.brandId) {
      checkField('brandId', 'Brand', brdMap.get(existing.brandId), foundBrand.name);
    }
    if (foundModel && foundModel.id !== existing.modelId) {
      checkField('modelId', 'Model', mdlMap.get(existing.modelId), foundModel.name);
    }
    if (foundUnit && foundUnit.id !== existing.unitId) {
      checkField('unitId', 'Unit / Factory', untMap.get(existing.unitId), foundUnit.name);
    }
    if (foundFloor && foundFloor.id !== existing.floorId) {
      checkField('floorId', 'Floor', flrMap.get(existing.floorId), foundFloor.name);
    }
    if (foundLine && foundLine.id !== existing.lineId) {
      checkField('lineId', 'Line', linMap.get(existing.lineId), foundLine.name);
    }
    if (mapped.machine_status && mapped.machine_status.toUpperCase() !== existing.status) {
      checkField('status', 'Machine Status', existing.status, mapped.machine_status.toUpperCase());
    }
    if (mapped.remarks && mapped.remarks !== existing.remarks) {
      checkField('remarks', 'Remarks', existing.remarks, mapped.remarks);
    }

    return diffs;
  }

  /**
   * Auto-create missing master data (categories, brands, models, units)
   */
  createMissingMasterData(unknowns) {
    if (!authService.isAdmin() && !authService.hasPermission('MASTER_DATA')) {
      throw new Error('Unauthorized to create Master Data during import.');
    }

    const createdResolutions = {};

    // 1. Machine Names
    (unknowns.machineNames || []).forEach(name => {
      const clean = (name || '').trim();
      if (!clean) return;

      let canonical = clean;
      try {
        if (typeof smartStorageService !== 'undefined' && smartStorageService?.resolveCanonicalMachineName) {
          canonical = smartStorageService.resolveCanonicalMachineName(clean) || clean;
        }
      } catch (_) {}

      const normClean = clean.toLowerCase().replace(/[^a-z0-9]/g, '');
      const normCanon = canonical.toLowerCase().replace(/[^a-z0-9]/g, '');

      let mn = storage.getTable(TABLE_NAMES.MACHINE_NAMES).find(m => {
        if (!m || !m.name) return false;
        const mLower = m.name.trim().toLowerCase();
        const mNorm = mLower.replace(/[^a-z0-9]/g, '');
        return mLower === clean.toLowerCase() ||
               mLower === canonical.toLowerCase() ||
               mNorm === normClean ||
               mNorm === normCanon;
      });

      if (!mn) {
        mn = storage.insert(TABLE_NAMES.MACHINE_NAMES, {
          name: canonical || clean,
          categoryId: 'cat-1',
          code: (canonical || clean).substring(0, 3).toUpperCase(),
          status: 'ACTIVE'
        });
      }
      createdResolutions[`mn_${name}`] = mn.id;
    });

    // 2. Brands
    (unknowns.brands || []).forEach(name => {
      let brd = storage.getTable(TABLE_NAMES.BRANDS).find(b => b.name.toLowerCase() === name.toLowerCase());
      if (!brd) {
        brd = storage.insert(TABLE_NAMES.BRANDS, {
          name: name.trim(),
          country: 'Global',
          status: 'ACTIVE'
        });
      }
      createdResolutions[`brd_${name}`] = brd.id;
    });

    // 3. Models
    (unknowns.models || []).forEach(entry => {
      const parts = entry.split('>').map(s => s.trim());
      const mnName = parts[0];
      const brdName = parts[1];
      const mdlName = parts[2] || parts[0];

      const mn = storage.getTable(TABLE_NAMES.MACHINE_NAMES).find(m => m.name.toLowerCase() === mnName?.toLowerCase()) || storage.getTable(TABLE_NAMES.MACHINE_NAMES)[0];
      const brd = storage.getTable(TABLE_NAMES.BRANDS).find(b => b.name.toLowerCase() === brdName?.toLowerCase()) || storage.getTable(TABLE_NAMES.BRANDS)[0];

      let mdl = storage.getTable(TABLE_NAMES.MODELS).find(m => m.name.toLowerCase() === mdlName.toLowerCase() && m.brandId === brd.id && m.machineNameId === mn.id);
      if (!mdl) {
        mdl = storage.insert(TABLE_NAMES.MODELS, {
          name: mdlName,
          machineNameId: mn.id,
          brandId: brd.id,
          description: 'Auto-created from Excel import',
          status: 'ACTIVE'
        });
      }

      createdResolutions[`mdl_${mnName}_${brdName}_${mdlName}`] = mdl.id;
    });

    // 4. Units
    (unknowns.units || []).forEach(name => {
      let unt = storage.getTable(TABLE_NAMES.UNITS).find(u => u.name.toLowerCase() === name.toLowerCase());
      if (!unt) {
        unt = storage.insert(TABLE_NAMES.UNITS, {
          name: name.trim(),
          groupId: 'grp-1',
          code: name.substring(0, 3).toUpperCase(),
          location: 'Factory Plant',
          status: 'ACTIVE'
        });
      }
      createdResolutions[`unt_${name}`] = unt.id;
    });

    auditService.log('MASTER_DATA_AUTO_CREATED_ON_IMPORT', 'MASTER_DATA', 'IMPORT', 'Auto-created missing master data during Excel import.');
    return createdResolutions;
  }

  /**
   * Commit Multi-Worksheet Batch Import with Row-Level Transaction Isolation & Error Recording
   * Guarantees that valid rows are always imported, and failed rows are isolated with exact Row # and reason.
   */
  commitMultiSheetImport(validatedSheets, metadata = {}) {
    const user = authService.getCurrentUser() || { id: 'admin-1', fullName: 'Administrator' };

    let newInsertedCount = 0;
    let updatedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    const sheetStats = [];
    const failedRows = [];

    validatedSheets.forEach(sheet => {
      let sheetInserted = 0;
      let sheetUpdated = 0;
      let sheetFailed = 0;
      let sheetSkipped = 0;
      const sheetNewMachines = [];

      sheet.records.forEach((item, recIdx) => {
        const rowNumber = item.rowNumber || (recIdx + 2);

        // 1. If row was flagged invalid during validation phase
        if (!item.isValid) {
          sheetFailed++;
          failedCount++;
          failedRows.push({
            rowNumber: rowNumber,
            cell: item.cell || `Row ${rowNumber}`,
            sheetName: sheet.name,
            serialNumber: item.data?.serialNumber || item.rawRow?.serial || item.rawRow?.serialNumber || '—',
            status: '❌ Failed',
            error: item.errors?.join('; ') || item.error || 'Validation error in row fields',
            errors: item.errors || (item.error ? [item.error] : []),
            rawRow: item.rawRow || {},
            data: item.data || {}
          });
          return;
        }

        const d = item.data;

        try {
          if (item.isUpdate && item.existingMachineId) {
            const existing = storage.getItem(TABLE_NAMES.MACHINES, item.existingMachineId);
            if (existing) {
              const updates = {
                updatedBy: user.id,
                updatedAt: new Date().toISOString()
              };

              if (d.unitId) updates.unitId = d.unitId;
              if (d.groupId) updates.groupId = d.groupId;
              if (d.floorId) updates.floorId = d.floorId;
              if (d.lineId) updates.lineId = d.lineId;
              if (d.machineNameId) updates.machineNameId = d.machineNameId;
              if (d.brandId) updates.brandId = d.brandId;
              if (d.modelId) updates.modelId = d.modelId;
              if (d.status) updates.status = d.status;
              if (d.remarks) updates.remarks = d.remarks;
              if (d.quantity) updates.quantity = d.quantity;
              if (Object.keys(d.customValues || {}).length > 0) {
                updates.customValues = { ...(existing.customValues || {}), ...d.customValues };
              }

              storage.update(TABLE_NAMES.MACHINES, existing.id, updates);
              sheetUpdated++;
              updatedCount++;
            } else {
              throw new Error(`Machine record ${item.existingMachineId} not found`);
            }
          } else {
            // New Machine Insert
            let modelId = d.modelId || '';
            if (!modelId && d.brandId && d.machineNameId && d.modelStr) {
              const newModel = storage.insert(TABLE_NAMES.MODELS, {
                brandId: d.brandId,
                machineNameId: d.machineNameId,
                name: d.modelStr,
                status: 'ACTIVE'
              });
              modelId = newModel.id;
            }

            const unitObj = storage.getItem(TABLE_NAMES.UNITS, d.unitId || 'unt-1');
            const resolvedGroupId = unitObj?.groupId || d.groupId || 'grp-1';

            sheetNewMachines.push({
              machineNameId: d.machineNameId || 'mn-1',
              brandId: d.brandId || '',
              modelId: modelId || '',
              serialNumber: d.serialNumber,
              groupId: resolvedGroupId,
              unitId: d.unitId || 'unt-1',
              floorId: d.floorId || 'flr-4',
              lineId: d.lineId || 'lin-1',
              quantity: d.quantity || 1,
              status: d.status || 'ACTIVE',
              remarks: d.remarks || `Imported from sheet '${sheet.name}'`,
              customValues: d.customValues || {},
              createdBy: user.id,
              updatedBy: user.id
            });

            sheetInserted++;
            newInsertedCount++;
          }
        } catch (rowErr) {
          sheetFailed++;
          failedCount++;
          failedRows.push({
            rowNumber: rowNumber,
            sheetName: sheet.name,
            serialNumber: d?.serialNumber || '—',
            status: '❌ Failed',
            error: rowErr.message || 'Error occurred while saving machine record',
            errors: [rowErr.message || 'Error occurred while saving machine record'],
            rawRow: item.rawRow || {},
            data: item.data || {}
          });
        }
      });

      // Batch insert all new machines for this sheet in a single high-speed pass
      if (sheetNewMachines.length > 0) {
        storage.insertMany(TABLE_NAMES.MACHINES, sheetNewMachines);
      }

      sheetStats.push({
        sheetName: sheet.name,
        total: sheet.records.length,
        inserted: sheetInserted,
        updated: sheetUpdated,
        failed: sheetFailed,
        skipped: sheetSkipped
      });
    });

    const totalImported = newInsertedCount + updatedCount;
    const totalProcessed = totalImported + failedCount + skippedCount;

    // Log Import History
    const historyRecord = {
      fileName: metadata.fileName || 'Spreadsheet.xlsx',
      importedAt: new Date().toISOString(),
      importedBy: user.fullName || user.username || 'Administrator',
      mode: metadata.duplicatePolicy || 'ROW_LEVEL_IMPORT',
      totalRows: totalProcessed,
      validRows: totalImported,
      insertedRows: newInsertedCount,
      updatedRows: updatedCount,
      failedRows: failedCount,
      skippedRows: skippedCount,
      sheetStats: sheetStats,
      status: failedCount === 0 ? 'SUCCESS' : (totalImported > 0 ? 'PARTIAL_SUCCESS' : 'FAILED')
    };

    storage.insert(TABLE_NAMES.IMPORT_HISTORY, historyRecord);
    auditService.log('EXCEL_ROW_LEVEL_IMPORTED', 'MACHINE_INVENTORY', `${totalImported} of ${totalProcessed} rows`, `Excel import completed: ${totalImported} imported successfully (${newInsertedCount} created, ${updatedCount} updated), ${failedCount} failed.`);
    window.dispatchEvent(new CustomEvent('erp:master-data-updated'));

    return {
      success: totalImported > 0 || totalProcessed === 0,
      totalProcessed: totalProcessed,
      totalImported: totalImported,
      insertedCount: newInsertedCount,
      updatedCount: updatedCount,
      failedCount: failedCount,
      skippedCount: skippedCount,
      sheetStats: sheetStats,
      failedRows: failedRows
    };
  }

  /**
   * Export Error Report spreadsheet (.xlsx) formatted with the EXACT standard raw import template columns
   * (Machine Name, Machine Brand, Machine Model, Machine Serial, Unit/Factory, Floor, Line, Running, Usable Idle,
   * Repairable Idle, Total Quantity, Machine Status, Remarks) PLUS Error Reason and Suggested Correction columns.
   * This allows users to review, fix errors right inside Excel, and directly re-upload the file to complete the import!
   */
  async exportErrorReport(failedRowsOrContext, originalFileName = 'Machine_Import.xlsx') {
    await this.ensureXlsx();

    const wb = XLSX.utils.book_new();

    // 1. Resolve failed records and errors
    let rawFailedList = [];
    let allValidationErrors = [];
    let fileName = originalFileName;

    if (failedRowsOrContext && typeof failedRowsOrContext === 'object' && !Array.isArray(failedRowsOrContext)) {
      fileName = failedRowsOrContext.fileName || originalFileName;
      allValidationErrors = failedRowsOrContext.validationResult?.allErrors || [];

      // Extract all invalid records from validation sheets
      if (failedRowsOrContext.validationResult?.sheets) {
        failedRowsOrContext.validationResult.sheets.forEach(sheet => {
          (sheet.records || []).forEach(rec => {
            if (!rec.isValid) {
              rawFailedList.push({
                ...rec,
                sheetName: sheet.name
              });
            }
          });
        });
      }

      // If already committed, also incorporate failedRows from importResult
      if (rawFailedList.length === 0 && failedRowsOrContext.importResult?.failedRows) {
        rawFailedList = failedRowsOrContext.importResult.failedRows;
      }
      if (rawFailedList.length === 0 && Array.isArray(failedRowsOrContext.failedRows)) {
        rawFailedList = failedRowsOrContext.failedRows;
      }
    } else if (Array.isArray(failedRowsOrContext)) {
      rawFailedList = failedRowsOrContext;
    }

    // 2. Group & Deduplicate records by sheetName + rowNumber so each failed machine appears EXACTLY ONCE
    const uniqueRecordsMap = new Map();

    rawFailedList.forEach((item, idx) => {
      const sheetName = item.sheetName || 'Sheet1';
      const rowNum = item.rowNumber || item.excelRow || idx + 2;
      const key = `${sheetName}___${rowNum}`;

      if (!uniqueRecordsMap.has(key)) {
        uniqueRecordsMap.set(key, {
          sheetName,
          rowNumber: rowNum,
          cell: item.cell || `Row ${rowNum}`,
          data: item.data || {},
          rawRow: item.rawRow || {},
          errors: Array.isArray(item.errors) ? [...item.errors] : (item.error ? [item.error] : []),
          suggestions: Array.isArray(item.suggestions) ? [...item.suggestions] : (item.suggestedCorrection ? [item.suggestedCorrection] : [])
        });
      } else {
        const existing = uniqueRecordsMap.get(key);
        if (item.error && !existing.errors.includes(item.error)) existing.errors.push(item.error);
        if (Array.isArray(item.errors)) {
          item.errors.forEach(e => { if (!existing.errors.includes(e)) existing.errors.push(e); });
        }
        if (item.suggestedCorrection && !existing.suggestions.includes(item.suggestedCorrection)) {
          existing.suggestions.push(item.suggestedCorrection);
        }
        if (Array.isArray(item.suggestions)) {
          item.suggestions.forEach(s => { if (!existing.suggestions.includes(s)) existing.suggestions.push(s); });
        }
        if (!Object.keys(existing.data).length && item.data) existing.data = item.data;
        if (!Object.keys(existing.rawRow).length && item.rawRow) existing.rawRow = item.rawRow;
      }
    });

    // Also attach matching diagnostics from allValidationErrors if available
    if (allValidationErrors.length > 0) {
      allValidationErrors.forEach(err => {
        const key = `${err.sheetName || 'Sheet1'}___${err.rowNumber}`;
        const record = uniqueRecordsMap.get(key);
        if (record) {
          if (err.error && !record.errors.includes(err.error)) {
            record.errors.push(err.error);
          }
          if (err.suggestedCorrection && !record.suggestions.includes(err.suggestedCorrection)) {
            record.suggestions.push(err.suggestedCorrection);
          }
        }
      });
    }

    // 3. Define Standard Raw File Headers + Diagnostic Fix Columns
    // Columns A-M are EXACTLY identical to the official Import Template!
    const headers = [
      'Machine Name',         // Col A
      'Machine Brand',        // Col B
      'Machine Model',        // Col C
      'Machine Serial',       // Col D
      'Unit/Factory',         // Col E
      'Floor',                // Col F
      'Line',                 // Col G
      'Running',              // Col H
      'Usable Idle',          // Col I
      'Repairable Idle',      // Col J
      'Total Quantity',       // Col K
      'Machine Status',       // Col L
      'Remarks',              // Col M
      'Error Reason',         // Col N - Detailed error description
      'Suggested Correction', // Col O - Step-by-step fix suggestion
      'Original Sheet',       // Col P - Reference sheet name in original file
      'Original Row'          // Col Q - Row number in original file
    ];

    const reportRows = [headers];

    uniqueRecordsMap.forEach(rec => {
      const d = rec.data || {};
      const r = rec.rawRow || {};

      // Robust field extraction falling back from parsed data to raw row properties
      const getVal = (parsedVal, rawKeys, defaultVal = '') => {
        if (parsedVal !== undefined && parsedVal !== null && String(parsedVal).trim() !== '' && !String(parsedVal).startsWith('—')) {
          return parsedVal;
        }
        for (const k of rawKeys) {
          if (r[k] !== undefined && r[k] !== null && String(r[k]).trim() !== '') {
            return r[k];
          }
        }
        return defaultVal;
      };

      const machineName = getVal(d.machineNameStr, ['Machine Name', 'machine_name', 'MachineName', 'Machine', 'Item Name', 'mc_name', 'itemname']);
      const machineBrand = getVal(d.brandStr, ['Machine Brand', 'machine_brand', 'Brand', 'brand', 'mcbrand', 'make']);
      const machineModel = getVal(d.modelStr, ['Machine Model', 'machine_model', 'Model', 'model', 'mcmodel', 'modelno']);
      const machineSerial = getVal(d.serialNumber, ['Machine Serial', 'machine_serial', 'Serial Number', 'serial_number', 'Serial', 'serial', 'SN', 'sn']);
      const unitFactory = getVal(d.unitStr, ['Unit/Factory', 'unit_factory', 'Unit', 'Factory', 'Plant', 'Location', 'unit', 'factory'], 'AKM Knitwear Ltd.');
      const floor = getVal(d.floorStr, ['Floor', 'floor', 'Floor Name', 'floor_name', 'Level', 'level']);
      const line = getVal(d.lineStr, ['Line', 'line', 'Line Name', 'line_name', 'Section', 'Line No', 'lineno']);

      const runningVal = d.running !== undefined ? d.running : (r['Running'] ?? r['running'] ?? 0);
      const usableIdleVal = d.usableIdle !== undefined ? d.usableIdle : (r['Usable Idle'] ?? r['usable_idle'] ?? 0);
      const repairableIdleVal = d.repairableIdle !== undefined ? d.repairableIdle : (r['Repairable Idle'] ?? r['repairable_idle'] ?? 0);
      const totalQtyVal = d.totalQuantity !== undefined ? d.totalQuantity : (r['Total Quantity'] ?? r['total_quantity'] ?? (Number(runningVal) + Number(usableIdleVal) + Number(repairableIdleVal)));

      const machineStatus = getVal(d.status, ['Machine Status', 'machine_status', 'Status', 'status', 'condition'], 'ACTIVE');
      const remarks = getVal(d.remarks, ['Remarks', 'remarks', 'Comments', 'Notes', 'notes', 'description']);

      // Error reason & suggestion
      const errorReason = rec.errors.length > 0 ? rec.errors.join(' | ') : 'Validation check failed';

      let suggestedCorrection = rec.suggestions.length > 0 ? rec.suggestions.join(' | ') : '';
      if (!suggestedCorrection) {
        const suggestions = [];
        if (!machineName || errorReason.includes('Machine Name')) {
          suggestions.push('Enter a valid Machine Name (e.g. Lock Stitch Machine, Overlock Machine, Flatlock Machine)');
        }
        if (errorReason.toLowerCase().includes('duplicate')) {
          suggestions.push('Serial Number already exists - update to a unique Serial Number');
        }
        if (errorReason.toLowerCase().includes('floor') || !floor) {
          suggestions.push('Enter valid Floor name matching Master Data (e.g. Titas Floor, Teesta Floor)');
        }
        if (errorReason.toLowerCase().includes('line') || !line) {
          suggestions.push('Enter valid Line name matching Floor (e.g. Line JA-A, Line PB-01)');
        }
        if (errorReason.toLowerCase().includes('unit') || !unitFactory) {
          suggestions.push('Enter valid Unit/Factory (e.g. AKM Knitwear Ltd.)');
        }
        suggestedCorrection = suggestions.length > 0 ? suggestions.join(' | ') : 'Check master data reference sheet, correct values in this row, and re-upload file.';
      }

      reportRows.push([
        machineName,
        machineBrand,
        machineModel,
        machineSerial,
        unitFactory,
        floor,
        line,
        runningVal,
        usableIdleVal,
        repairableIdleVal,
        totalQtyVal,
        machineStatus,
        remarks,
        errorReason,
        suggestedCorrection,
        rec.sheetName,
        rec.rowNumber
      ]);
    });

    // Build Sheet 1: Error Machine Records
    const wsReport = XLSX.utils.aoa_to_sheet(reportRows);
    wsReport['!cols'] = [
      { wch: 25 }, // Col A: Machine Name
      { wch: 18 }, // Col B: Machine Brand
      { wch: 20 }, // Col C: Machine Model
      { wch: 20 }, // Col D: Machine Serial
      { wch: 22 }, // Col E: Unit/Factory
      { wch: 18 }, // Col F: Floor
      { wch: 18 }, // Col G: Line
      { wch: 10 }, // Col H: Running
      { wch: 12 }, // Col I: Usable Idle
      { wch: 14 }, // Col J: Repairable Idle
      { wch: 14 }, // Col K: Total Quantity
      { wch: 14 }, // Col L: Machine Status
      { wch: 26 }, // Col M: Remarks
      { wch: 45 }, // Col N: Error Reason
      { wch: 55 }, // Col O: Suggested Correction
      { wch: 18 }, // Col P: Original Sheet
      { wch: 14 }  // Col Q: Original Row
    ];

    XLSX.utils.book_append_sheet(wb, wsReport, 'Failed Machines (Fix & Upload)');

    // Build Sheet 2: Master Reference & Guidelines (so users can reference valid names when fixing)
    const refData = [
      ['AL-MUSLIM GROUP - MAINTENANCE DEPARTMENT ERP - MASTER DATA REFERENCE & ERROR FIX GUIDE'],
      [''],
      ['HOW TO FIX AND RE-IMPORT YOUR ERROR FILE:'],
      ['1. Fix incorrect values in columns A through M on sheet "Failed Machines (Fix & Upload)".'],
      ['2. Check the "Error Reason" and "Suggested Correction" columns (Col N & O) for exact instructions.'],
      ['3. Save this Excel file, return to ERP -> Machine Inventory -> Import Excel, and upload this file.'],
      ['4. All fixed machines will be imported smoothly into the system!'],
      [''],
      ['LOCATION HIERARCHY REFERENCE (Unit/Factory -> Floor -> Line):'],
      ['Unit / Factory', 'Floor', 'Available Production Lines'],
      ['AKM Knitwear Ltd.', 'Titas Floor', 'Line JA-A, Line JA-B'],
      ['AKM Knitwear Ltd.', 'Teesta Floor', 'Line JAF-A, Line JAF-B'],
      ['AKM Knitwear Ltd.', 'Jamuna Floor', 'Line JAF-C, Line PB-01'],
      ['AKM Knitwear Ltd.', 'Padma Floor', 'Line PB-02, Line PB-03'],
      ['Knitwear Unit 2', 'Meghna Floor', 'Line ML-01, Line ML-02'],
      ['Knitwear Unit 2', 'Karnaphuli Floor', 'Line KL-01, Line KL-02'],
      [''],
      ['VALID MACHINE STATUS CODES:'],
      ['Status Code', 'Description'],
      ['ACTIVE', 'Machine is running actively on the production floor'],
      ['IDLE', 'Machine is operational and ready for use but currently idle'],
      ['MAINTENANCE', 'Machine is under routine service or periodic overhaul'],
      ['BREAKDOWN', 'Machine is broken down and requires mechanical/electrical repair']
    ];
    const wsRef = XLSX.utils.aoa_to_sheet(refData);
    wsRef['!cols'] = [{ wch: 28 }, { wch: 25 }, { wch: 45 }];
    XLSX.utils.book_append_sheet(wb, wsRef, 'Master Data Reference');

    const cleanBaseName = fileName.replace(/\.[^/.]+$/, '');
    const outFileName = `${cleanBaseName}_Failed_Records_Report.xlsx`;
    XLSX.writeFile(wb, outFileName);
    auditService.log('ERROR_REPORT_DOWNLOADED', 'IMPORT', `${uniqueRecordsMap.size} failed machines`, `Downloaded full template error report for ${outFileName}`);
  }

  /**
   * Helper to build a styled worksheet with dynamic Excel formulas for Total Quantity & Summary Total Row
   */
  buildTemplateWorksheet(records, visibleCols) {
    const headers = visibleCols.map(c => c.header);
    const ws = XLSX.utils.aoa_to_sheet([headers]);

    const runningColIdx = visibleCols.findIndex(c => c.fieldKey === 'running');
    const usableIdleColIdx = visibleCols.findIndex(c => c.fieldKey === 'usable_idle');
    const repairableIdleColIdx = visibleCols.findIndex(c => c.fieldKey === 'repairable_idle');
    const totalQtyColIdx = visibleCols.findIndex(c => c.fieldKey === 'total_quantity');

    const getColLetter = (colIdx) => {
      let letter = '';
      let temp = colIdx;
      while (temp >= 0) {
        letter = String.fromCharCode((temp % 26) + 65) + letter;
        temp = Math.floor(temp / 26) - 1;
      }
      return letter;
    };

    records.forEach((rec, rIdx) => {
      const rowNum = rIdx + 2;
      visibleCols.forEach((col, cIdx) => {
        const cellAddress = XLSX.utils.encode_cell({ r: rowNum - 1, c: cIdx });
        const val = this.getFieldValue(rec, col.fieldKey, rIdx);

        if (cIdx === totalQtyColIdx && runningColIdx !== -1 && repairableIdleColIdx !== -1) {
          const startCol = getColLetter(runningColIdx);
          const endCol = getColLetter(repairableIdleColIdx);
          const r = parseInt(rec.running ?? rec.qty_running ?? (rec.status === 'ACTIVE' ? 1 : 0), 10) || 0;
          const u = parseInt(rec.usable_idle ?? rec.usableIdle ?? (rec.status === 'IDLE' ? 1 : 0), 10) || 0;
          const rp = parseInt(rec.repairable_idle ?? rec.repairableIdle ?? (rec.status === 'MAINTENANCE' || rec.status === 'BREAKDOWN' ? 1 : 0), 10) || 0;
          const totalVal = r + u + rp > 0 ? (r + u + rp) : 1;
          ws[cellAddress] = { t: 'n', v: totalVal, f: `SUM(${startCol}${rowNum}:${endCol}${rowNum})` };
        } else if (cIdx === runningColIdx || cIdx === usableIdleColIdx || cIdx === repairableIdleColIdx) {
          const numVal = parseInt(val, 10);
          ws[cellAddress] = { t: 'n', v: isNaN(numVal) ? 0 : numVal };
        } else {
          ws[cellAddress] = { t: 's', v: String(val ?? '') };
        }
      });
    });

    // Append GRAND TOTAL Summary Row at the bottom with live Excel formulas
    if (records.length > 0) {
      const grandRow = records.length + 2;
      const lastDataRow = records.length + 1;

      visibleCols.forEach((col, cIdx) => {
        const cellAddress = XLSX.utils.encode_cell({ r: grandRow - 1, c: cIdx });
        const colLetter = getColLetter(cIdx);

        if (cIdx === 0) {
          ws[cellAddress] = { t: 's', v: 'GRAND TOTAL' };
        } else if (cIdx === runningColIdx || cIdx === usableIdleColIdx || cIdx === repairableIdleColIdx || cIdx === totalQtyColIdx) {
          ws[cellAddress] = {
            t: 'n',
            f: `SUM(${colLetter}2:${colLetter}${lastDataRow})`
          };
        } else {
          ws[cellAddress] = { t: 's', v: '—' };
        }
      });

      const range = { s: { r: 0, c: 0 }, e: { r: grandRow - 1, c: headers.length - 1 } };
      ws['!ref'] = XLSX.utils.encode_range(range);
    } else {
      const range = { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } };
      ws['!ref'] = XLSX.utils.encode_range(range);
    }

    ws['!cols'] = headers.map(() => ({ wch: 22 }));
    return ws;
  }

  /**
   * Generate Official Multi-Worksheet Template with Realistic Garments Machinery
   * Fully synchronized with Admin column order, visibility & fieldKey mapping!
   */
  async generateTemplate() {
    await this.generateMultiSheetTemplate();
  }

  async generateMultiSheetTemplate() {
    await this.ensureXlsx();

    const wb = XLSX.utils.book_new();
    const visibleCols = this.getVisibleColumns();

    // SINGLE Main Data Sheet for All Machine Types (Unlimited rows)
    const machineInventoryRecords = [
      { machine_name: 'Lock Stitch Machine', machine_brand: 'Juki', machine_model: 'DDL-8700', machine_serial: 'SN-10001', unit_factory: 'AKM Knitwear Ltd.', floor: 'Titas Floor', line: 'Line JA-A', running: 20, usable_idle: 3, repairable_idle: 1, total_quantity: 24, machine_status: 'ACTIVE', remarks: 'Lock Stitch with direct drive servo motor' },
      { machine_name: 'Lock Stitch Machine', machine_brand: 'Juki', machine_model: 'DDL-9000C', machine_serial: 'SN-10002', unit_factory: 'AKM Knitwear Ltd.', floor: 'Titas Floor', line: 'Line JA-A', running: 15, usable_idle: 2, repairable_idle: 0, total_quantity: 17, machine_status: 'ACTIVE', remarks: 'Auto thread trimming & digital tension' },
      { machine_name: 'Lock Stitch Machine', machine_brand: 'Jack', machine_model: 'A4 Direct Drive', machine_serial: 'SN-10003', unit_factory: 'AKM Knitwear Ltd.', floor: 'Titas Floor', line: 'Line JA-B', running: 10, usable_idle: 1, repairable_idle: 2, total_quantity: 13, machine_status: 'ACTIVE', remarks: 'Smart computer control voice guide' },
      { machine_name: 'Overlock Machine', machine_brand: 'Pegasus', machine_model: 'M-700 Series', machine_serial: 'SN-10004', unit_factory: 'AKM Knitwear Ltd.', floor: 'Teesta Floor', line: 'Line JAF-A', running: 12, usable_idle: 0, repairable_idle: 1, total_quantity: 13, machine_status: 'ACTIVE', remarks: '4-thread overedge differential feed' },
      { machine_name: 'Overlock Machine', machine_brand: 'Siruba', machine_model: '747K (5-Thread)', machine_serial: 'SN-10005', unit_factory: 'AKM Knitwear Ltd.', floor: 'Teesta Floor', line: 'Line JAF-B', running: 7, usable_idle: 2, repairable_idle: 1, total_quantity: 10, machine_status: 'ACTIVE', remarks: 'Safety stitch for heavy fabric' },
      { machine_name: 'Flatlock Machine', machine_brand: 'Kansai', machine_model: 'WX-8803', machine_serial: 'SN-10006', unit_factory: 'AKM Knitwear Ltd.', floor: 'Jamuna Floor', line: 'Line JAF-C', running: 5, usable_idle: 1, repairable_idle: 0, total_quantity: 6, machine_status: 'ACTIVE', remarks: 'Cylinder bed bottom hemming & coverstitch' },
      { machine_name: 'Button Hole Machine', machine_brand: 'Brother', machine_model: 'HE-800B Electronic', machine_serial: 'SN-10007', unit_factory: 'AKM Knitwear Ltd.', floor: 'Jamuna Floor', line: 'Line JA-B', running: 4, usable_idle: 1, repairable_idle: 1, total_quantity: 6, machine_status: 'ACTIVE', remarks: 'Electronic lockstitch buttonhole' },
      { machine_name: 'Bar Tack Machine', machine_brand: 'Juki', machine_model: 'LK-1900BN Electronic', machine_serial: 'SN-10008', unit_factory: 'AKM Knitwear Ltd.', floor: 'Padma Floor', line: 'Line PB-03', running: 6, usable_idle: 0, repairable_idle: 0, total_quantity: 6, machine_status: 'ACTIVE', remarks: 'Computer controlled bartacking' },
      { machine_name: 'Feed Off The Arm', machine_brand: 'Kansai Special', machine_model: 'DLR-1508PR', machine_serial: 'SN-10009', unit_factory: 'AKM Knitwear Ltd.', floor: 'Jamuna Floor', line: 'Line PB-01', running: 3, usable_idle: 1, repairable_idle: 0, total_quantity: 4, machine_status: 'ACTIVE', remarks: 'Multi-needle waistband attaching' }
    ];

    const wsMain = this.buildTemplateWorksheet(machineInventoryRecords, visibleCols);
    XLSX.utils.book_append_sheet(wb, wsMain, 'Machine Inventory');

    // Sheet 2: Master Reference & Guidelines (Lookup sheet only)
    const refData = [
      ['AL-MUSLIM GROUP - MAINTENANCE DEPARTMENT ERP - EXCEL STRUCTURE & MASTER DATA REFERENCE'],
      [''],
      ['1. COLUMN STRUCTURE & AUTO-CALCULATION RULES:'],
      ['Field #', 'Header Label', 'Field Key', 'Type / Logic', 'Mandatory?'],
      ['1', 'Machine Name', 'machine_name', 'Text / Master Machine Type', 'YES'],
      ['2', 'Machine Brand', 'machine_brand', 'Text / Brand Name', 'NO (Optional - blank allowed)'],
      ['3', 'Machine Model', 'machine_model', 'Text / Model Number', 'NO (Optional - blank allowed)'],
      ['4', 'Machine Serial', 'machine_serial', 'Unique Identifier (Auto-generated if empty)', 'NO (Optional)'],
      ['5', 'Unit/Factory', 'unit_factory', 'Plant / Factory Name', 'YES'],
      ['6', 'Floor', 'floor', 'Building Floor (Must belong to Unit/Factory)', 'YES'],
      ['7', 'Line', 'line', 'Sewing Line (Must belong to Floor)', 'YES'],
      ['8', 'Running', 'running', 'Quantity of currently operational machines', 'NO (Default 0)'],
      ['9', 'Usable Idle', 'usable_idle', 'Quantity of machines idle but ready to run', 'NO (Default 0)'],
      ['10', 'Repairable Idle', 'repairable_idle', 'Quantity of machines idle under repair/maintenance', 'NO (Default 0)'],
      ['11', 'Total Quantity', 'total_quantity', 'FORMULA: =SUM(Running..Repairable Idle) - AUTO LINKED', 'SYSTEM-GENERATED'],
      ['12', 'Machine Status', 'machine_status', 'ACTIVE / IDLE / MAINTENANCE / BREAKDOWN', 'NO (Default ACTIVE)'],
      ['13', 'Remarks', 'remarks', 'Technical notes, attachments or remarks', 'NO (Optional)'],
      [''],
      ['2. LOCATION HIERARCHY REFERENCE (Unit/Factory -> Floor -> Line):'],
      ['Unit / Factory', 'Floor', 'Available Production Lines'],
      ['AKM Knitwear Ltd.', 'Titas Floor', 'Line JA-A, Line JA-B'],
      ['AKM Knitwear Ltd.', 'Teesta Floor', 'Line JAF-A, Line JAF-B'],
      ['AKM Knitwear Ltd.', 'Jamuna Floor', 'Line JAF-C, Line PB-01'],
      ['AKM Knitwear Ltd.', 'Padma Floor', 'Line PB-02, Line PB-03'],
      ['Knitwear Unit 2', 'Meghna Floor', 'Line ML-01, Line ML-02'],
      ['Knitwear Unit 2', 'Karnaphuli Floor', 'Line KL-01, Line KL-02'],
      [''],
      ['3. VALID MACHINE STATUS CODES:'],
      ['Status Code', 'Description'],
      ['ACTIVE', 'Machine is running actively on the production floor'],
      ['IDLE', 'Machine is operational and ready for use but currently idle'],
      ['MAINTENANCE', 'Machine is under routine service or periodic overhaul'],
      ['BREAKDOWN', 'Machine is broken down and requires mechanical/electrical repair']
    ];
    const wsRef = XLSX.utils.aoa_to_sheet(refData);
    wsRef['!cols'] = [{ wch: 30 }, { wch: 30 }, { wch: 45 }, { wch: 30 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsRef, 'Master Data Reference');

    XLSX.writeFile(wb, 'Machine_Inventory_Import_Template.xlsx');
    auditService.log('TEMPLATE_DOWNLOADED', 'TEMPLATE', 'SINGLE_SHEET', 'Generated official Machine Inventory Excel template with single data sheet.');
  }

  /**
   * Export all machines or filtered list to Excel
  /**
   * Export data to Excel (.xlsx)
   * Handles both machine inventory records and arbitrary tabular data (e.g. Manpower roster)
   */
  async exportToExcel(data, fileName = 'Garments_Export.xlsx') {
    if (Array.isArray(data) && data.length > 0) {
      const first = data[0];
      // If tabular object without machine entity ID properties, use generic sheet export
      if (first && (first['Employee / Card ID'] || first['Card ID'] || first['Full Name'] || !('machineNameId' in first || 'serialNumber' in first))) {
        return this.exportAnyDataToExcel(data, fileName, 'Data');
      }
    }
    return this.exportFilteredMachinesToExcel(data, fileName);
  }

  /**
   * Export any plain array of objects to Excel
   */
  async exportAnyDataToExcel(data, fileName = 'Export.xlsx', sheetName = 'Sheet1') {
    await this.ensureXlsx();
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, fileName);
  }

  /**
   * Parse an uploaded Excel file (.xlsx, .xls, .csv) into an array of row objects
   */
  async parseExcelFile(file) {
    await this.ensureXlsx();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          if (!firstSheetName) {
            return resolve([]);
          }
          const worksheet = workbook.Sheets[firstSheetName];
          const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
          resolve(rows || []);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Dedicated Filtered Machine Export to Excel (.xlsx) with exact standard columns and live formula linking
   */
  async exportFilteredMachinesToExcel(machines, fileName = 'Filtered_Machine_Inventory.xlsx') {
    await this.ensureXlsx();

    const visibleCols = this.getVisibleColumns();
    const ws = this.buildTemplateWorksheet(machines, visibleCols);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Machine Inventory');

    XLSX.writeFile(wb, fileName);
    auditService.log('EXCEL_EXPORTED', 'MACHINE', `${machines.length} records`, `Exported ${machines.length} filtered machine records with live formulas to ${fileName}.`);
  }

  /**
   * Dedicated Filtered Machine Export to CSV (.csv)
   */
  exportFilteredMachinesToCsv(machines, fileName = 'Filtered_Machine_Inventory.csv') {
    const grpMap = new Map(storage.getTable(TABLE_NAMES.GROUPS).map(x => [x.id, x.name]));
    const untMap = new Map(storage.getTable(TABLE_NAMES.UNITS).map(x => [x.id, x.name]));
    const flrMap = new Map(storage.getTable(TABLE_NAMES.FLOORS).map(x => [x.id, x.name]));
    const linMap = new Map(storage.getTable(TABLE_NAMES.LINES).map(x => [x.id, x.name]));
    const mnMap = new Map(storage.getTable(TABLE_NAMES.MACHINE_NAMES).map(x => [x.id, x.name]));
    const brdMap = new Map(storage.getTable(TABLE_NAMES.BRANDS).map(x => [x.id, x.name]));
    const mdlMap = new Map(storage.getTable(TABLE_NAMES.MODELS).map(x => [x.id, x.name]));

    const headers = [
      'SL', 'Machine ID', 'Machine Name', 'Machine Number', 'Group',
      'Unit / Factory', 'Floor', 'Line', 'Line Code', 'Brand', 'Model',
      'Machine Status', 'Installation Date', 'Remarks'
    ];

    const escapeCsv = (val) => {
      const str = String(val ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvRows = [headers.map(escapeCsv).join(',')];

    machines.forEach((m, i) => {
      const fullLine = linMap.get(m.lineId) || m.lineStr || '—';
      const cleanLine = formatDisplayLine(fullLine, 'NORMAL');
      const row = [
        i + 1,
        m.id || `MCH-${String(i + 1).padStart(3, '0')}`,
        mnMap.get(m.machineNameId) || m.machineNameStr || '—',
        m.serialNumber || '—',
        grpMap.get(m.groupId) || 'Al-Muslim Group',
        untMap.get(m.unitId) || m.unitStr || '—',
        flrMap.get(m.floorId) || m.floorStr || '—',
        cleanLine,
        fullLine,
        brdMap.get(m.brandId) || m.brandStr || '—',
        mdlMap.get(m.modelId) || m.modelStr || '—',
        (m.status || 'ACTIVE').replace(/_/g, ' '),
        m.installationDate || m.customValues?.installation_date || '—',
        m.remarks || ''
      ];
      csvRows.push(row.map(escapeCsv).join(','));
    });

    const csvContent = '\uFEFF' + csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    auditService.log('CSV_EXPORTED', 'MACHINE', `${machines.length} records`, `Exported ${machines.length} filtered machine records to CSV.`);
  }

  /**
   * Export Machine Summary Grouped Report to Excel with native live formulas (Total = SUM(Running..Idle), Grand Total = SUM)
   */
  async exportMachineSummaryReportExcel(groupedList, grandTotals, fileName = `Machine_Summary_Report_${new Date().toISOString().split('T')[0]}.xlsx`) {
    await this.ensureXlsx();

    const headers = ['Sl.', 'Machine Name', 'Model', 'Running', 'Usable Idle', 'Repairable Idle', 'Total', 'Grand Total'];
    const ws = XLSX.utils.aoa_to_sheet([headers]);

    const merges = [];
    let currentRowIdx = 2; // Row 1 is header
    let groupSl = 1;

    groupedList.forEach(group => {
      const startRow = currentRowIdx;
      const endRow = startRow + group.models.length - 1;
      const currentSl = groupSl++;

      group.models.forEach((mod, idx) => {
        const rowNum = currentRowIdx;

        // Sl. (col A) - only set on the first row of each machine category (merged across models)
        if (idx === 0) {
          ws[`A${rowNum}`] = { t: 'n', v: currentSl };
        }

        // Machine Name (col B)
        ws[`B${rowNum}`] = { t: 's', v: idx === 0 ? group.machineName : '' };

        // Model (col C)
        ws[`C${rowNum}`] = { t: 's', v: mod.model };

        // Running (col D)
        ws[`D${rowNum}`] = { t: 'n', v: Number(mod.running) || 0 };

        // Usable Idle (col E)
        ws[`E${rowNum}`] = { t: 'n', v: Number(mod.usableIdle) || 0 };

        // Repairable Idle (col F)
        ws[`F${rowNum}`] = { t: 'n', v: Number(mod.repairableIdle) || 0 };

        // Total (col G) -> FORMULA: =SUM(D{row}:F{row})
        ws[`G${rowNum}`] = {
          t: 'n',
          v: Number(mod.total) || 0,
          f: `SUM(D${rowNum}:F${rowNum})`
        };

        // Grand Total (col H) -> FORMULA: =SUM(G{startRow}:G{endRow}) (only placed on startRow)
        if (idx === 0) {
          ws[`H${rowNum}`] = {
            t: 'n',
            v: Number(group.total) || 0,
            f: `SUM(G${startRow}:G${endRow})`
          };
        }

        currentRowIdx++;
      });

      if (endRow > startRow) {
        merges.push({ s: { r: startRow - 1, c: 0 }, e: { r: endRow - 1, c: 0 } }); // Merge Col A (Sl.)
        merges.push({ s: { r: startRow - 1, c: 1 }, e: { r: endRow - 1, c: 1 } }); // Merge Col B (Machine Name)
        merges.push({ s: { r: startRow - 1, c: 7 }, e: { r: endRow - 1, c: 7 } }); // Merge Col H (Grand Total)
      }
    });

    // Add GRAND TOTAL Row at the bottom
    const lastDataRow = currentRowIdx - 1;
    const grandRow = currentRowIdx;

    ws[`A${grandRow}`] = { t: 's', v: '—' };
    ws[`B${grandRow}`] = { t: 's', v: 'GRAND TOTAL' };
    ws[`C${grandRow}`] = { t: 's', v: '—' };
    ws[`D${grandRow}`] = { t: 'n', v: Number(grandTotals.running) || 0, f: `SUM(D2:D${lastDataRow})` };
    ws[`E${grandRow}`] = { t: 'n', v: Number(grandTotals.usableIdle) || 0, f: `SUM(E2:E${lastDataRow})` };
    ws[`F${grandRow}`] = { t: 'n', v: Number(grandTotals.repairableIdle) || 0, f: `SUM(F2:F${lastDataRow})` };
    ws[`G${grandRow}`] = { t: 'n', v: Number(grandTotals.total) || 0, f: `SUM(G2:G${lastDataRow})` };
    ws[`H${grandRow}`] = { t: 'n', v: Number(grandTotals.total) || 0, f: `SUM(D${grandRow}:F${grandRow})` };

    const totalRange = { s: { r: 0, c: 0 }, e: { r: grandRow - 1, c: 7 } };
    ws['!ref'] = XLSX.utils.encode_range(totalRange);
    ws['!merges'] = merges;
    ws['!cols'] = [
      { wch: 6 },  // Sl.
      { wch: 28 }, // Machine Name
      { wch: 22 }, // Model
      { wch: 14 }, // Running
      { wch: 16 }, // Usable Idle
      { wch: 18 }, // Repairable Idle
      { wch: 14 }, // Total
      { wch: 16 }  // Grand Total
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Machine_Summary');
    XLSX.writeFile(wb, fileName);
    auditService.log('MACHINE_SUMMARY_EXCEL_EXPORTED', 'REPORT', `${groupedList.length} groups`, `Exported Machine Summary with dynamic formulas to ${fileName}.`);
  }

  /**
   * Export Full Enterprise Multi-Worksheet Comprehensive ERP Workbook
   */
  async exportCompleteErpWorkbook(fileName = 'AlMuslim_Enterprise_ERP_Master_Workbook.xlsx') {
    await this.ensureXlsx();

    const wb = XLSX.utils.book_new();

    // 1. Sheet 1: Machine Inventory with Auto-Calculation Formulas
    const machines = storage.getTable(TABLE_NAMES.MACHINES) || [];
    const visibleCols = this.getVisibleColumns();
    const wsMachines = this.buildTemplateWorksheet(machines, visibleCols);
    XLSX.utils.book_append_sheet(wb, wsMachines, 'Machine Inventory');

    // 2. Sheet 2: Machine Transfers Ledger
    const transfers = storage.getTable(TABLE_NAMES.TRANSFERS) || [];
    const transferRows = transfers.map((t, idx) => ({
      'Sl': idx + 1,
      'Tracking Number': t.trackingNumber || t.id,
      'Machine Serial': t.machineSerial || t.serialNumber || '—',
      'From Location': t.sourceFloorName || t.sourceLocation || '—',
      'To Location': t.targetFloorName || t.targetLocation || '—',
      'Status': t.status,
      'Requested Date': t.requestedAt || t.requestDate || '—',
      'Reason / Remarks': t.reason || t.remarks || '—'
    }));
    const wsTransfers = XLSX.utils.json_to_sheet(transferRows);
    wsTransfers['!cols'] = [{ wch: 6 }, { wch: 20 }, { wch: 18 }, { wch: 24 }, { wch: 24 }, { wch: 16 }, { wch: 18 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, wsTransfers, 'Transfer History');

    // 3. Sheet 3: Spare Parts Replacements
    const history = storage.getTable(TABLE_NAMES.MACHINE_HISTORY) || [];
    const spareRows = history.filter(h => h.actionType === 'SPARE_PART_REPLACEMENT' || h.sparePart).map((h, idx) => ({
      'Sl': idx + 1,
      'Date': h.timestamp ? h.timestamp.split('T')[0] : '—',
      'Machine Serial': h.machineSerial || '—',
      'Spare Part Name': h.sparePart || h.partName || '—',
      'Action': 'REPLACED',
      'Quantity': h.quantity || 1,
      'Technician': h.technicianName || h.performedBy || '—',
      'Remarks': h.remarks || '—'
    }));
    const wsSpare = XLSX.utils.json_to_sheet(spareRows);
    wsSpare['!cols'] = [{ wch: 6 }, { wch: 14 }, { wch: 18 }, { wch: 26 }, { wch: 14 }, { wch: 10 }, { wch: 20 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, wsSpare, 'Spare Parts Replacements');

    // 4. Sheet 4: Workforce & Manpower Roster
    const employees = storage.getTable(TABLE_NAMES.EMPLOYEES) || [];
    const empRows = employees.map((e, idx) => ({
      'Sl': idx + 1,
      'Card Number': e.cardNumber,
      'Employee Name': e.name,
      'Designation': e.designation,
      'Department': e.department,
      'Location': e.locationPath || '—',
      'Phone': e.phone || '—',
      'Joining Date': e.joinDate || '—',
      'Status': e.status
    }));
    const wsEmp = XLSX.utils.json_to_sheet(empRows);
    wsEmp['!cols'] = [{ wch: 6 }, { wch: 14 }, { wch: 24 }, { wch: 22 }, { wch: 20 }, { wch: 30 }, { wch: 16 }, { wch: 14 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, wsEmp, 'Manpower Roster');

    // 5. Sheet 5: Master Catalog
    const catalog = storage.getTable(TABLE_NAMES.SPARE_PARTS) || [];
    const catRows = catalog.map((c, idx) => ({
      'Sl': idx + 1,
      'Part Number': c.partNumber || c.code || '—',
      'Part Name': c.name,
      'Category': c.category || 'General',
      'Applicable Machinery': c.machineCategory || 'All Machinery',
      'Stock Level': c.stock || 0,
      'Unit Price (BDT)': c.unitPrice || '—'
    }));
    const wsCat = XLSX.utils.json_to_sheet(catRows);
    wsCat['!cols'] = [{ wch: 6 }, { wch: 16 }, { wch: 26 }, { wch: 18 }, { wch: 24 }, { wch: 12 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, wsCat, 'Spare Parts Catalog');

    // 6. Sheet 6: ENT Lab Board Master Inventory
    const etBoards = storage.getTable(TABLE_NAMES.ET_BOARDS) || [];
    const etBoardRows = etBoards.map((b, idx) => ({
      'Sl': idx + 1,
      'Board ID / Unit No': b.boardSerial,
      'Part Name': b.partName,
      'Item Type / Category': b.category || 'General PCB',
      'Model No': b.modelNo || '',
      'Part No (P. No)': b.partNo || '',
      'Serial No (JUKI S/N)': b.jukiSlNo || b.slNo || '',
      'Current Status': b.status,
      'Current Machine': b.currentMachineSerial || 'N/A (In Lab)',
      'Installed Date': b.installedDate || '',
      'Installed By': b.installedBy || '',
      'Previous Bill No': b.billNo || '',
      'Previous Bill Status': b.billNo ? 'YES' : 'NO',
      'Come Date': b.comeDate || '',
      'Location': b.location || 'ENT Lab Stock',
      'Remarks': b.remarks || ''
    }));
    const wsEtBoards = XLSX.utils.json_to_sheet(etBoardRows);
    wsEtBoards['!cols'] = [{ wch: 6 }, { wch: 18 }, { wch: 26 }, { wch: 20 }, { wch: 16 }, { wch: 16 }, { wch: 20 }, { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 20 }, { wch: 24 }];
    XLSX.utils.book_append_sheet(wb, wsEtBoards, 'ENT Lab Boards');

    // 7. Sheet 7: ENT Lab Complete Movement & Repair History
    const etHistory = storage.getTable(TABLE_NAMES.ET_BOARD_HISTORY) || [];
    const etHistRows = etHistory.map((h, idx) => ({
      'Sl': idx + 1,
      'Date': h.timestamp ? h.timestamp.split('T')[0] : '',
      'Board ID': h.boardSerial,
      'Action': h.actionLabel || h.action,
      'Machine Serial': h.machineSerial || '',
      'External Company': h.companyName || '',
      'Problem Reported': h.problem || '',
      'Repair Details': h.repairDetails || '',
      'Repair Duration (Days)': h.repairDurationDays || '',
      'Removal Reason': h.removalReason || '',
      'Authorized By': h.performedByName || '',
      'Location': h.location || '',
      'Remarks': h.remarks || ''
    }));
    const wsEtHist = XLSX.utils.json_to_sheet(etHistRows);
    wsEtHist['!cols'] = [{ wch: 6 }, { wch: 14 }, { wch: 16 }, { wch: 24 }, { wch: 16 }, { wch: 20 }, { wch: 28 }, { wch: 28 }, { wch: 16 }, { wch: 24 }, { wch: 20 }, { wch: 20 }, { wch: 24 }];
    XLSX.utils.book_append_sheet(wb, wsEtHist, 'ENT Lab Movement History');

    XLSX.writeFile(wb, fileName);
    auditService.log('ERP_MASTER_WORKBOOK_EXPORTED', 'EXCEL_EXPORT', 'FULL_ERP', `Downloaded full 7-sheet ERP Master Workbook including ENT Lab.`);
  }

  /**
   * Export Dedicated ENT Lab Excel Workbook
   */
  async exportEtLabExcel(fileName = `ET_Lab_Management_Ledger_${new Date().toISOString().split('T')[0]}.xlsx`) {
    await this.ensureXlsx();

    const wb = XLSX.utils.book_new();

    const etBoards = storage.getTable(TABLE_NAMES.ET_BOARDS) || [];
    const etBoardRows = etBoards.map((b, idx) => ({
      'Sl': idx + 1,
      'Board ID / Unit No': b.boardSerial,
      'Part Name': b.partName,
      'Item Type / Category': b.category || 'General PCB',
      'Model No': b.modelNo || '',
      'Part No (P. No)': b.partNo || '',
      'Serial No (JUKI S/N)': b.jukiSlNo || b.slNo || '',
      'Current Status': b.status,
      'Current Machine': b.currentMachineSerial || 'N/A (In Lab Stock)',
      'Install Date': b.installedDate || '',
      'Installed By': b.installedBy || '',
      'Come / Entry Date': b.comeDate || '',
      'Current Location': b.location || 'ENT Lab Stock Shelf',
      'Previous Bill No': b.billNo || '',
      'Previous Bill Status': b.billNo ? 'YES' : 'NO',
      'Gate Pass No': b.gpNo || '',
      'Remarks': b.remarks || ''
    }));
    const wsBoards = XLSX.utils.json_to_sheet(etBoardRows);
    wsBoards['!cols'] = [{ wch: 6 }, { wch: 18 }, { wch: 26 }, { wch: 20 }, { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 15 }, { wch: 22 }, { wch: 15 }, { wch: 35 }, { wch: 16 }, { wch: 12 }, { wch: 16 }, { wch: 25 }];
    XLSX.utils.book_append_sheet(wb, wsBoards, 'Board Master Inventory');

    const etHistory = storage.getTable(TABLE_NAMES.ET_BOARD_HISTORY) || [];
    const etHistRows = etHistory.map((h, idx) => ({
      'Sl': idx + 1,
      'Movement Date': h.timestamp ? h.timestamp.split('T')[0] : '',
      'Board ID': h.boardSerial,
      'Action Performed': h.actionLabel || h.action,
      'Repair Attempt': h.repairAttempt ? `Attempt #${h.repairAttempt}` : '—',
      'Machine Connected': h.machineSerial || '—',
      'Destination / Location': h.location || 'ENT Lab',
      'External Repair Company': h.companyName || '—',
      'Repair Result / Status': h.acceptanceStatus || h.repairResult || h.repairType || '—',
      'Problem Reported': h.problem || '',
      'Repair Details / Work Done': h.repairDetails || '',
      'Turnaround Days': h.repairDurationDays !== undefined ? h.repairDurationDays : '',
      'Removal Reason': h.removalReason || '',
      'Verified By': h.verifiedBy || '',
      'Authorized By': h.performedByName || '',
      'Remarks': h.remarks || ''
    }));
    const wsHist = XLSX.utils.json_to_sheet(etHistRows);
    wsHist['!cols'] = [{ wch: 6 }, { wch: 16 }, { wch: 16 }, { wch: 24 }, { wch: 14 }, { wch: 18 }, { wch: 32 }, { wch: 24 }, { wch: 22 }, { wch: 25 }, { wch: 30 }, { wch: 14 }, { wch: 25 }, { wch: 20 }, { wch: 20 }, { wch: 28 }];
    XLSX.utils.book_append_sheet(wb, wsHist, 'Complete Movement Ledger');

    XLSX.writeFile(wb, fileName);
    auditService.log('ET_LAB_EXPORTED', 'EXCEL_EXPORT', 'ET_LAB', `Exported ENT Lab Master & Movement History to Excel.`);
  }

  /**
   * Export dedicated filtered ENT Lab Report table to Excel with all 20 specified columns
   */
  async exportEtLabManagementReportExcel(rows, fileName = `ENT_Lab_Report_${new Date().toISOString().split('T')[0]}.xlsx`) {
    await this.ensureXlsx();

    const wb = XLSX.utils.book_new();
    const excelRows = rows.map((r, idx) => ({
      'Sl': idx + 1,
      'Board / Item ID': r.boardSerial,
      'Board Name': r.partName,
      'Model': r.modelNo || '',
      'Serial No.': r.serialNo || '',
      'Current Status': r.status,
      'Current Machine': r.currentMachine || '',
      'Machine Serial': r.machineSerial || '',
      'Unit / Factory': r.unitName || '',
      'Floor': r.floorName || '',
      'Line': r.lineName || '',
      'Install Date': r.installDate || '',
      'Remove Date': r.removeDate || '',
      'Repair Type': r.repairType || '',
      'External Company': r.externalCompany || '',
      'Send Date': r.sendDate || '',
      'Return Date': r.returnDate || '',
      'Repair Result': r.repairResult || '',
      'Repair Count': r.repairCount || 0,
      'Previous Bill: Yes / No': r.previousBill || 'NO',
      'Remarks': r.remarks || ''
    }));

    const ws = XLSX.utils.json_to_sheet(excelRows);
    ws['!cols'] = [
      { wch: 6 },
      { wch: 18 },
      { wch: 26 },
      { wch: 16 },
      { wch: 18 },
      { wch: 18 },
      { wch: 20 },
      { wch: 16 },
      { wch: 24 },
      { wch: 16 },
      { wch: 16 },
      { wch: 14 },
      { wch: 14 },
      { wch: 16 },
      { wch: 24 },
      { wch: 14 },
      { wch: 14 },
      { wch: 22 },
      { wch: 14 },
      { wch: 14 },
      { wch: 30 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'ENT Lab Report');
    XLSX.writeFile(wb, fileName);
    auditService.log('ET_LAB_REPORT_EXCEL_EXPORTED', 'EXCEL_EXPORT', 'ET_LAB', `Exported filtered ENT Lab Report (${rows.length} records) to Excel.`);
  }
}

export const excelService = new ExcelService();
if (typeof window !== 'undefined') {
  window.excelService = excelService;
}
