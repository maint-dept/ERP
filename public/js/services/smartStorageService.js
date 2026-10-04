/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Smart Storage Library & Intelligent Auto-Correction Service
 * 
 * Features:
 * 1. Segregated Storage for different ERP features: Machines/Models, Spare Parts, Tools, Locations
 * 2. Multi-strategy Auto-Correction Engine (Casing, Hyphens/Formatting, Spelling/Levenshtein, Aliases)
 * 3. User-Friendly Interactive Confirmation Prompt
 * 4. Database Health Scanner to audit existing records and 1-click batch fix
 * 5. Excel/CSV & Bulk Multiline Text Importer & Template Generator
 */

import { storage, CloudSaveError } from '../db/storage.js';
import { TABLE_NAMES } from '../db/schema.js';
import { auditService } from './auditService.js';
import { notificationService } from './notificationService.js';
import { storageSchemaService } from './storageSchemaService.js';
import { state } from '../state.js';

class SmartStorageService {
  constructor() {
    this._activePromptModal = null;
  }

  // ==========================================
  // 1. Storage Master Items CRUD & Access
  // ==========================================

  getStorageItems(category = null) {
    const all = storage.getTable(TABLE_NAMES.STORAGE_MASTER) || [];
    if (!category || category === 'ALL') return all;
    return all.filter(it => it.category === category);
  }

  getStorageItem(id) {
    return storage.getItem(TABLE_NAMES.STORAGE_MASTER, id);
  }

  async addStorageItem(item) {
    if (!item.id) {
      item.id = 'sm-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
    }
    item.createdAt = item.createdAt || new Date().toISOString();
    item.updatedAt = new Date().toISOString();
    item.status = item.status || 'ACTIVE';
    item.aliases = Array.isArray(item.aliases) ? item.aliases : this.generateAutoAliases(item);

    // CONFIRMED WRITE: await Database write
    await storage.writeAndConfirm(TABLE_NAMES.STORAGE_MASTER, (tbl) => { tbl.push(item); });
    this._broadcastStorageChange();
    return item;
  }

  async updateStorageItem(id, updates) {
    const existing = this.getStorageItem(id);
    if (!existing) throw new Error('Storage record not found');
    const updated = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    // CONFIRMED WRITE: await Database write
    await storage.writeAndConfirm(TABLE_NAMES.STORAGE_MASTER, (tbl) => {
      const idx = tbl.findIndex(it => it.id === id);
      if (idx !== -1) tbl[idx] = updated;
    });
    this._broadcastStorageChange();
    return updated;
  }

  async deleteStorageItem(id) {
    // CONFIRMED WRITE: await Database write
    await storage.writeAndConfirm(TABLE_NAMES.STORAGE_MASTER, (tbl) => {
      const idx = tbl.findIndex(it => it.id === id);
      if (idx !== -1) tbl.splice(idx, 1);
    });
    // Also remove from MODELS if duplicated there
    try { await storage.writeAndConfirm(TABLE_NAMES.MODELS, (tbl) => {
      const idx = tbl.findIndex(it => it.id === id);
      if (idx !== -1) tbl.splice(idx, 1);
    }); } catch (_) {}
    this._broadcastStorageChange();
    return true;
  }

  async deleteStorageItemsBatch(ids) {
    if (!Array.isArray(ids) || ids.length === 0) return 0;
    let count = 0;
    // CONFIRMED WRITE: remove from STORAGE_MASTER
    await storage.writeAndConfirm(TABLE_NAMES.STORAGE_MASTER, (tbl) => {
      ids.forEach(id => {
        const idx = tbl.findIndex(it => it.id === id);
        if (idx !== -1) { tbl.splice(idx, 1); count++; }
      });
    });
    // Also remove from MODELS
    try {
      await storage.writeAndConfirm(TABLE_NAMES.MODELS, (tbl) => {
        ids.forEach(id => {
          const idx = tbl.findIndex(it => it.id === id);
          if (idx !== -1) tbl.splice(idx, 1);
        });
      });
    } catch (_) {}
    this._broadcastStorageChange();
    auditService.log('STORAGE_BATCH_DELETE', `Bulk deleted ${count} storage records`, { deletedCount: count });
    return count;
  }

  // ==========================================
  // Machine Hierarchy & Bulk Model Management
  // ==========================================

  /**
   * Resolves any machine name alias, legacy name, or raw string to its canonical registered machine name.
   */
  resolveCanonicalMachineName(rawName) {
    const clean = String(rawName || '').trim();
    if (!clean) return '';

    const lower = clean.toLowerCase();

    // 1. Static Alias & Typo Mappings (Garments Factory Domain Specific)
    const staticAliases = {
      'plain machine 1-needle': 'Plane Machine',
      'plain machine 1 needle': 'Plane Machine',
      'plain machine': 'Plane Machine',
      'plane mashin': 'Plane Machine',
      'single needle lockstitch': 'Plane Machine',
      'single needle': 'Plane Machine',
      'snls': 'Plane Machine',
      'lockstitch': 'Plane Machine',
      'overlock 4-thread': 'Over Lock Machine',
      'overlock 4 thread': 'Over Lock Machine',
      'overlock 5-thread': 'Over Lock Machine',
      'overlock 5 thread': 'Over Lock Machine',
      'overlock machine': 'Over Lock Machine',
      'overlock': 'Over Lock Machine',
      'over lock': 'Over Lock Machine',
      'flatlock cylinder bed': 'Flat Lock Machine',
      'flatlock machine': 'Flat Lock Machine',
      'flat lock': 'Flat Lock Machine',
      'flatlock': 'Flat Lock Machine',
      'interlock': 'Interlock Machine',
      'bar tack machine': 'Bar tak Machine',
      'bar tack': 'Bar tak Machine',
      'bartack': 'Bar tak Machine',
      'bartak': 'Bar tak Machine',
      'feed off the arm': 'Feed of The Arm Machine',
      'feed of the arm': 'Feed of The Arm Machine',
      'feed-off-the-arm': 'Feed of The Arm Machine',
      'feed of arm': 'Feed of The Arm Machine',
      'foa': 'Feed of The Arm Machine',
      'button hole': 'Button Hole Machine',
      'buttonhole': 'Button Hole Machine',
      'button attach': 'Button Attach Machine',
      'button stitch': 'Button Stitch',
      'eyelet hole': 'Eye let Hole Machine',
      'eye let hole': 'Eye let Hole Machine',
      'double needle': 'Double Needle Machine',
      'double needle auto': 'Double Needle Machine',
      'double needle auto machine': 'Double Needle Machine',
      'double needle manual': 'Double Needle Machine',
      'double needle manual machine': 'Double Needle Machine',
      'over lock mechine': 'Over Lock Machine',
      'overlock mechine': 'Over Lock Machine',
      'chain stitch': 'Chain Stitch Machine',
      'multi needle chain stitch': 'Multi Needle Chain Stitch Machine',
      'zipper joint': 'Zipper Joint Machine',
      'zipper joint machine': 'Zipper Joint Machine',
      'vertical machine': 'Vertical Machine',
      'vertical bedoly': 'Vertical Machine',
      'sleeve joint': 'Sleeve Joint Machine',
      'sleeve joint machine': 'Sleeve Joint Machine',
      'snap button': 'Snap Button Machine',
      'snap button hydrolic': 'Snap Button Machine',
      'snap button hydraulic': 'Snap Button Machine',
      'feed of the arm-brother': 'Feed of The Arm Machine',
      'feed of the arm - brother': 'Feed of The Arm Machine',
      'feed of the arm-narrow': 'Feed of The Arm Machine',
      'feed of the arm - narrow': 'Feed of The Arm Machine',
      'loop attach': 'Loop Attach Machine',
      'loop attach machine': 'Loop Attach Machine',
      'feed of the arm-agm': 'Feed of The Arm Machine',
      'feed of the arm - agm': 'Feed of The Arm Machine',
      'botton hole': 'Button Hole Machine',
      'botton hole machine': 'Button Hole Machine',
      'safety stitch': 'Safety Stitch M/C',
      'safety stitch machine': 'Safety Stitch M/C',
      'pocket facing machine': 'Pocket Facing',
      'ham blind stitch': 'Ham  Blind Stitch Machine',
      'ham blind stitch machine': 'Ham  Blind Stitch Machine',
      'bottom hemming lock stitch': 'Bottom Hamming Lock Stitch Machine',
      'bottom hemming chain stitch': 'Bottom Hamming Chain Stitch Machine'
    };

    if (staticAliases[lower]) {
      return staticAliases[lower];
    }

    // 2. Check existing MACHINE_NAMES table
    let mnTable = [];
    try {
      mnTable = storage.getTable(TABLE_NAMES.MACHINE_NAMES) || [];
    } catch (_) {}

    // Direct case-insensitive match
    const directMatch = mnTable.find(m => m.name && m.name.trim().toLowerCase() === lower);
    if (directMatch) return directMatch.name.trim();

    // Normalized alphanumeric match (removes all spaces, hyphens, slashes, punctuation)
    const norm = this.normalizePureAlphanumeric(clean);
    const normMatch = mnTable.find(m => m.name && this.normalizePureAlphanumeric(m.name) === norm);
    if (normMatch) return normMatch.name.trim();

    // Normalized without trailing "machine" or "mc"
    const stripMachine = (str) => this.normalizePureAlphanumeric(str).replace(/machines?$|mcs?$/g, '');
    const strippedClean = stripMachine(clean);
    if (strippedClean.length >= 3) {
      const strippedMatch = mnTable.find(m => m.name && stripMachine(m.name) === strippedClean);
      if (strippedMatch) return strippedMatch.name.trim();
    }

    return clean;
  }

  getMachineModelsHierarchy() {
    const mnTable = storage.getTable(TABLE_NAMES.MACHINE_NAMES) || [];
    const smTable = storage.getTable(TABLE_NAMES.STORAGE_MASTER) || [];
    const mdlTable = storage.getTable(TABLE_NAMES.MODELS) || [];
    const brdTable = storage.getTable(TABLE_NAMES.BRANDS) || [];

    const brdMap = new Map();
    brdTable.forEach(b => { if (b && b.id) brdMap.set(b.id, b.name); });

    const mnOrderMap = new Map();
    const map = new Map();

    // 1. Seed from registered MACHINE_NAMES table (Preserves User Input Sequence)
    mnTable.forEach((mn, idx) => {
      if (!mn || !mn.name) return;
      const cleanName = mn.name.trim();
      const lower = cleanName.toLowerCase();
      const order = (mn.sortOrder !== undefined && mn.sortOrder !== null) ? Number(mn.sortOrder) : (idx + 1);
      mnOrderMap.set(lower, order);
      if (!map.has(lower)) {
        map.set(lower, {
          id: mn.id,
          machineName: cleanName,
          sortOrder: order,
          code: mn.code || '',
          models: []
        });
      }
    });

    // 2. Gather models from STORAGE_MASTER (Category: MACHINE)
    const seenModelNorms = new Map(); // lower(machineName) -> Set of normalized model strings
    smTable.filter(it => it && it.category === 'MACHINE').forEach(it => {
      const rawMName = (it.machineName || '').trim();
      if (!rawMName || !it.model) return;
      const mName = this.resolveCanonicalMachineName(rawMName);
      const lower = mName.toLowerCase();
      if (!map.has(lower)) {
        const order = mnOrderMap.has(lower) ? mnOrderMap.get(lower) : (1000 + map.size);
        map.set(lower, {
          id: 'mn-' + lower,
          machineName: mName,
          sortOrder: order,
          code: '',
          models: []
        });
      }
      if (!seenModelNorms.has(lower)) seenModelNorms.set(lower, new Set());
      const norm = this.normalizePureAlphanumeric(it.model);
      if (!seenModelNorms.get(lower).has(norm)) {
        seenModelNorms.get(lower).add(norm);
        map.get(lower).models.push({
          id: it.id,
          model: it.model,
          brand: (it.brand || 'JUKI').toUpperCase(),
          sortOrder: (it.sortOrder !== undefined && it.sortOrder !== null) ? Number(it.sortOrder) : 9999,
          createdAt: it.createdAt || ''
        });
      }
    });

    // 3. ALSO gather models from core MODELS table (linked to machineName or machineNameId)
    mdlTable.forEach(mdl => {
      if (!mdl || !mdl.name) return;
      let rawMName = (mdl.machineName || '').trim();
      if (!rawMName && mdl.machineNameId) {
        const matchedMn = mnTable.find(m => m.id === mdl.machineNameId);
        if (matchedMn) rawMName = matchedMn.name.trim();
      }
      if (!rawMName) return;
      const mName = this.resolveCanonicalMachineName(rawMName);
      const lower = mName.toLowerCase();
      if (!map.has(lower)) {
        const order = mnOrderMap.has(lower) ? mnOrderMap.get(lower) : (1000 + map.size);
        map.set(lower, {
          id: 'mn-' + lower,
          machineName: mName,
          sortOrder: order,
          code: '',
          models: []
        });
      }
      if (!seenModelNorms.has(lower)) seenModelNorms.set(lower, new Set());
      const norm = this.normalizePureAlphanumeric(mdl.name);
      if (!seenModelNorms.get(lower).has(norm)) {
        seenModelNorms.get(lower).add(norm);
        const brandName = mdl.brandName || brdMap.get(mdl.brandId) || 'JUKI';
        map.get(lower).models.push({
          id: mdl.id,
          model: mdl.name,
          brand: String(brandName).toUpperCase(),
          sortOrder: (mdl.sortOrder !== undefined && mdl.sortOrder !== null) ? Number(mdl.sortOrder) : 9999,
          createdAt: mdl.createdAt || ''
        });
      }
    });

    // 4. Sort models within each machine group strictly by sortOrder
    const result = Array.from(map.values()).map(group => {
      group.models.sort((a, b) => {
        const ordA = (a.sortOrder !== undefined && a.sortOrder !== null) ? Number(a.sortOrder) : 9999;
        const ordB = (b.sortOrder !== undefined && b.sortOrder !== null) ? Number(b.sortOrder) : 9999;
        if (ordA !== ordB) return ordA - ordB;
        return (a.createdAt || '').localeCompare(b.createdAt || '');
      });

      group.models = group.models.map((m, mIdx) => ({
        ...m,
        serialNo: mIdx + 1
      }));

      return {
        ...group,
        count: group.models.length
      };
    });

    // 5. Sort machine groups strictly by their fixed sortOrder, NEVER alphabetically or randomly!
    result.sort((a, b) => {
      const ordA = (a.sortOrder !== undefined && a.sortOrder !== null) ? Number(a.sortOrder) : 9999;
      const ordB = (b.sortOrder !== undefined && b.sortOrder !== null) ? Number(b.sortOrder) : 9999;
      return ordA - ordB;
    });

    // Assign fixed 1-based serialNo to each machine group
    return result.map((g, idx) => ({
      ...g,
      serialNo: idx + 1
    }));
  }

  getAllMachineNames() {
    let mnTable = [];
    try {
      mnTable = storage.getTable(TABLE_NAMES.MACHINE_NAMES) || [];
    } catch (_) {}

    const sortedTable = [...mnTable].sort((a, b) => {
      const ordA = a.sortOrder !== undefined ? Number(a.sortOrder) : 9999;
      const ordB = b.sortOrder !== undefined ? Number(b.sortOrder) : 9999;
      return ordA - ordB;
    });

    const set = new Set();
    const list = [];

    const addName = (name) => {
      const canonical = this.resolveCanonicalMachineName(name);
      const clean = String(canonical || name || '').trim();
      const norm = this.normalizePureAlphanumeric(clean);
      if (clean && !set.has(norm)) {
        set.add(norm);
        list.push(clean);
      }
    };

    // 1. First add from MACHINE_NAMES in their exact sortOrder sequence
    sortedTable.forEach(mn => {
      if (mn && mn.name) addName(mn.name);
    });

    // 2. Then add any other machine names from STORAGE_MASTER
    const storageItems = this.getStorageItems('MACHINE');
    storageItems.forEach(it => {
      if (it.machineName) addName(it.machineName);
    });

    return list;
  }

  deleteMachineNameOnly(name) {
    const clean = String(name || '').trim().toLowerCase();
    if (!clean) return;
    try {
      const mnTable = storage.getTable(TABLE_NAMES.MACHINE_NAMES) || [];
      const found = mnTable.find(m => m.name && m.name.trim().toLowerCase() === clean);
      if (found) {
        storage.delete(TABLE_NAMES.MACHINE_NAMES, found.id);
      }
      this._broadcastStorageChange();
    } catch (_) {}
  }

  purgeUnusedMachineNames() {
    try {
      const allMachines = this.getStorageItems('MACHINE');
      const usedNames = new Set(allMachines.map(m => (m.machineName || '').trim().toLowerCase()).filter(Boolean));
      const mnList = storage.getTable(TABLE_NAMES.MACHINE_NAMES) || [];
      let deleted = 0;
      mnList.forEach(mn => {
        if (mn && mn.name && !usedNames.has(mn.name.trim().toLowerCase())) {
          storage.delete(TABLE_NAMES.MACHINE_NAMES, mn.id);
          deleted++;
        }
      });
      this._broadcastStorageChange();
      return deleted;
    } catch (_) {
      return 0;
    }
  }

  cleanEmptyMachineNames() {
    return this.purgeUnusedMachineNames();
  }

  addMachineName(name, code = '', sortOrder = null) {
    const cleanName = String(name || '').trim();
    if (!cleanName) throw new Error('Machine Name is required');

    let mnList = [];
    try {
      mnList = storage.getTable(TABLE_NAMES.MACHINE_NAMES) || [];
    } catch (_) {}

    // Check if this machine name or an alias already exists (case-insensitive & alphanumeric normalized)
    const canonical = this.resolveCanonicalMachineName(cleanName);
    const normClean = this.normalizePureAlphanumeric(cleanName);
    const normCanon = this.normalizePureAlphanumeric(canonical);

    const existing = mnList.find(m => {
      if (!m || !m.name) return false;
      const mLower = m.name.trim().toLowerCase();
      const mNorm = this.normalizePureAlphanumeric(m.name);
      return (
        mLower === cleanName.toLowerCase() ||
        mLower === canonical.toLowerCase() ||
        mNorm === normClean ||
        mNorm === normCanon
      );
    });

    if (existing) {
      if (sortOrder !== null && sortOrder !== undefined) {
        storage.update(TABLE_NAMES.MACHINE_NAMES, existing.id, { sortOrder: Number(sortOrder) });
      }
      return { added: false, name: existing.name, existingId: existing.id, message: 'Already registered' };
    }

    const maxOrder = mnList.reduce((max, m) => Math.max(max, Number(m.sortOrder || 0)), 0);
    const assignedOrder = (sortOrder !== null && sortOrder !== undefined) ? Number(sortOrder) : (maxOrder + 1);
    const newRecord = storage.insert(TABLE_NAMES.MACHINE_NAMES, {
      id: 'mn-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      name: cleanName,
      code: code || cleanName.substring(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, ''),
      sortOrder: assignedOrder,
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    });

    this._broadcastStorageChange();
    return { added: true, name: cleanName, id: newRecord.id, sortOrder: assignedOrder };
  }

  async addMultipleMachineNames(rawInput) {
    let rawLines = [];
    if (typeof rawInput === 'string') {
      rawLines = rawInput.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    } else if (Array.isArray(rawInput)) {
      rawLines = rawInput.map(n => String(n).trim()).filter(Boolean);
    }

    if (rawLines.length === 0) {
      return { addedCount: 0, skippedCount: 0, skippedNames: [], totalInput: 0, addedNames: [] };
    }

    let mnList = [];
    try {
      mnList = storage.getTable(TABLE_NAMES.MACHINE_NAMES) || [];
    } catch (_) {}
    let currentMaxOrder = mnList.reduce((max, m) => Math.max(max, Number(m.sortOrder || 0)), 0);

    const seenInBatch = new Set();
    const addedNames = [];
    const skippedNames = [];

    rawLines.forEach(line => {
      const clean = String(line || '').trim();
      if (!clean) return;

      const norm = this.normalizePureAlphanumeric(clean);
      if (seenInBatch.has(norm)) {
        skippedNames.push(`${clean} (duplicate in input)`);
        return;
      }
      seenInBatch.add(norm);

      const res = this.addMachineName(clean, '', currentMaxOrder + addedNames.length + 1);
      if (res && res.added) {
        addedNames.push(clean);
      } else {
        const existName = res?.name || clean;
        skippedNames.push(`${clean} (already registered: "${existName}")`);
      }
    });

    if (addedNames.length > 0) {
      storage.saveTable(TABLE_NAMES.MACHINE_NAMES);
      if (typeof storage.persistToServerDatabase === 'function') {
        try {
          await storage.persistToServerDatabase();
        } catch (_) {}
      }
      this._broadcastStorageChange();
    }

    return {
      addedCount: addedNames.length,
      skippedCount: skippedNames.length,
      skippedNames,
      totalInput: rawLines.length,
      addedNames
    };
  }

  async deleteMachineNameAndModels(machineName) {
    const cleanName = String(machineName || '').trim();
    if (!cleanName) return 0;

    // 1. Delete all models under this machineName in storage_master
    const all = this.getStorageItems('MACHINE');
    const toDelete = all.filter(it => (it.machineName || '').trim().toLowerCase() === cleanName.toLowerCase());
    let deletedCount = 0;
    toDelete.forEach(it => {
      try {
        storage.delete(TABLE_NAMES.STORAGE_MASTER, it.id);
        deletedCount++;
      } catch (_) {}
    });

    // 2. Also delete from MODELS table
    try {
      const mdlList = storage.getTable(TABLE_NAMES.MODELS) || [];
      const mnList = storage.getTable(TABLE_NAMES.MACHINE_NAMES) || [];
      const mn = mnList.find(m => m.name && m.name.trim().toLowerCase() === cleanName.toLowerCase());
      const toDeleteMdl = mdlList.filter(m => 
        (m.machineName && m.machineName.trim().toLowerCase() === cleanName.toLowerCase()) ||
        (mn && m.machineNameId === mn.id)
      );
      toDeleteMdl.forEach(m => {
        storage.delete(TABLE_NAMES.MODELS, m.id);
      });
      if (mn) {
        storage.delete(TABLE_NAMES.MACHINE_NAMES, mn.id);
      }
    } catch (_) {}

    // 3. Guaranteed persistence to disk
    if (typeof storage.persistToServerDatabase === 'function') {
      try {
        await storage.persistToServerDatabase();
      } catch (_) {}
    }

    this._broadcastStorageChange();
    auditService.log('STORAGE_DELETE_MACHINE_GROUP', `Deleted machine group "${cleanName}" and ${deletedCount} models`);
    return deletedCount;
  }

  async deleteMachineGroupsBatch(machineNames) {
    if (!Array.isArray(machineNames) || machineNames.length === 0) return 0;
    let totalDeleted = 0;
    for (const name of machineNames) {
      totalDeleted += await this.deleteMachineNameAndModels(name);
    }
    return totalDeleted;
  }

  async clearAllMachineCatalogData() {
    // 1. Wipe all MACHINE_NAMES
    storage.setTable(TABLE_NAMES.MACHINE_NAMES, []);

    // 2. Wipe all MACHINE category items in STORAGE_MASTER (preserves non-machine records if any)
    const allSm = storage.getTable(TABLE_NAMES.STORAGE_MASTER) || [];
    const nonMachineSm = allSm.filter(it => it.category !== 'MACHINE');
    storage.setTable(TABLE_NAMES.STORAGE_MASTER, nonMachineSm);

    // 3. Wipe all MODELS
    storage.setTable(TABLE_NAMES.MODELS, []);

    // 4. Wipe all BRANDS
    storage.setTable(TABLE_NAMES.BRANDS, []);

    // 5. Save tables to LocalStorage
    storage.saveTable(TABLE_NAMES.MACHINE_NAMES);
    storage.saveTable(TABLE_NAMES.STORAGE_MASTER);
    storage.saveTable(TABLE_NAMES.MODELS);
    storage.saveTable(TABLE_NAMES.BRANDS);

    // 5. Guaranteed disk write to data/erp_database.json
    if (typeof storage.persistToServerDatabase === 'function') {
      try {
        await storage.persistToServerDatabase();
      } catch (e) {
        console.warn('Clear catalog persist error:', e);
      }
    }

    this._broadcastStorageChange();
    auditService.log('STORAGE_CLEAR_CATALOG', 'Completely wiped all machine names, models, and machine storage master records for a 100% fresh start');
    return true;
  }

  parseBrandModelLines(rawInput, defaultBrand = 'JUKI') {
    let lines = [];
    if (typeof rawInput === 'string') {
      lines = rawInput.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    } else if (Array.isArray(rawInput)) {
      lines = rawInput;
    }

    const existingMachines = this.getStorageItems('MACHINE');
    const existingModelNorms = new Set(
      existingMachines.map(m => this.normalizePureAlphanumeric(m.model)).filter(Boolean)
    );

    const knownBrands = [
      'JUKI', 'BROTHER', 'PEGASUS', 'SIRUBA', 'YAMATO', 'KANSAI', 'KANSAI SPECIAL', 
      'JACK', 'SUNSTAR', 'HASHIMA', 'KM', 'EASTMAN', 'SINGER', 'PFAFF', 'DURKOPP ADLER',
      'TYPICAL', 'ZUSAN', 'BEDOLY', 'MAUSER', 'GOLDEN WHEEL', 'BRUCE', 'HIKARI', 'ZOJE'
    ];

    const results = [];

    const pushItem = (rawM, rawB, rawTxt) => {
      let model = String(rawM || '').trim();
      let brand = String(rawB || defaultBrand || 'JUKI').trim();

      if (!model) return;

      const norm = this.normalizePureAlphanumeric(model);
      const isDuplicate = existingModelNorms.has(norm);

      // Casing corrections
      const brandCheck = this.checkCorrection('BRAND', brand);
      if (brandCheck && brandCheck.hasIssue) {
        brand = brandCheck.suggested;
      }

      const modelCheck = this.checkCorrection('MODEL', model);
      if (modelCheck && modelCheck.hasIssue) {
        model = modelCheck.suggested;
      }

      results.push({
        model,
        brand: brand.toUpperCase(),
        norm,
        isDuplicate,
        rawText: rawTxt
      });
    };

    lines.forEach(line => {
      const text = typeof line === 'object' && line !== null ? (line.model || '') : String(line).trim();
      if (!text) return;

      if (typeof line === 'object' && line !== null && line.brand) {
        pushItem(line.model, line.brand, text);
        return;
      }

      // Check if line is a comma-separated list of known brands (e.g. "JUKI, TYPICAL, ZUSAN")
      const commaParts = text.split(',').map(p => p.trim()).filter(Boolean);
      if (commaParts.length > 1 && commaParts.every(p => knownBrands.includes(p.toUpperCase()))) {
        commaParts.forEach(cp => {
          pushItem('Standard Auto', cp.toUpperCase(), text);
        });
        return;
      }

      let model = '';
      let brand = defaultBrand || 'JUKI';

      if (text.includes('|') || text.includes('\t')) {
        // Tab or pipe delimited: e.g. "JUKI\tDDL-9000Series" or "TYPICAL | GC-6720"
        const parts = text.split(/[|\t]/).map(p => p.trim()).filter(Boolean);
        if (parts.length >= 2) {
          const p0Upper = parts[0].toUpperCase();
          const p1Upper = parts[1].toUpperCase();
          if (knownBrands.includes(p0Upper)) {
            brand = parts[0];
            model = parts.slice(1).join(' ');
          } else if (knownBrands.includes(p1Upper)) {
            brand = parts[1];
            model = parts[0];
          } else {
            brand = parts[0];
            model = parts.slice(1).join(' ');
          }
        } else if (parts.length === 1) {
          model = parts[0];
        }
      } else if (/\(([^)]+)\)/.test(text)) {
        // Parentheses format from Excel: e.g. "JUKI (DDL-9000Series)", "TYPICAL (GC-6720)", "Bedoly BDL-B7491B (For Pipping)"
        const m = text.match(/^(.*?)\s*\(([^)]+)\)$/);
        if (m) {
          const part1 = m[1].trim();
          const part2 = m[2].trim();
          const p1Upper = part1.toUpperCase();
          const p2Upper = part2.toUpperCase();

          const matchedBrandP1 = knownBrands.find(b => p1Upper === b || p1Upper.startsWith(b + ' ') || p1Upper.startsWith(b + '-'));
          const matchedBrandP2 = knownBrands.find(b => p2Upper === b);

          if (matchedBrandP1) {
            brand = matchedBrandP1;
            if (p1Upper === matchedBrandP1) {
              model = part2;
            } else {
              model = `${part1.substring(matchedBrandP1.length).trim()} (${part2})`;
            }
          } else if (matchedBrandP2) {
            brand = matchedBrandP2;
            model = part1;
          } else if (/\d/.test(part2) && !/\d/.test(part1)) {
            brand = part1;
            model = part2;
          } else if (/\d/.test(part1) && !/\d/.test(part2)) {
            model = `${part1} (${part2})`;
            brand = defaultBrand || 'JUKI';
          } else {
            brand = defaultBrand || 'JUKI';
            model = `${part1} (${part2})`;
          }
        } else {
          model = text;
        }
      } else {
        // Plain text model line: e.g. "DDL-9000Series", "DDL-900BB & C", "JACK"
        const tUpper = text.toUpperCase();
        if (knownBrands.includes(tUpper) && text.length <= 15 && !/\d/.test(text)) {
          brand = text;
          model = 'Standard Auto';
        } else {
          model = text;
          brand = defaultBrand || 'JUKI';
        }
      }

      pushItem(model, brand, text);
    });

    return results;
  }

  addModelsToMachine(machineName, rawInput, defaultBrand = 'JUKI') {
    const cleanMachineName = String(machineName || '').trim();
    if (!cleanMachineName) throw new Error('Target Machine Name is required');

    this.addMachineName(cleanMachineName);

    const parsed = this.parseBrandModelLines(rawInput, defaultBrand);
    const existingMachines = this.getStorageItems('MACHINE');
    const existingModelNorms = new Set(
      existingMachines.map(m => this.normalizePureAlphanumeric(m.model)).filter(Boolean)
    );

    const added = [];
    const skipped = [];

    parsed.forEach(item => {
      if (existingModelNorms.has(item.norm)) {
        skipped.push({ model: item.model, reason: 'Already exists in Master Storage' });
        return;
      }

      const record = {
        category: 'MACHINE',
        machineName: cleanMachineName,
        brand: item.brand,
        model: item.model,
        status: 'ACTIVE'
      };

      const saved = this.addStorageItem(record);
      added.push(saved);
      existingModelNorms.add(item.norm);
    });

    return {
      success: true,
      addedCount: added.length,
      skippedCount: skipped.length,
      added,
      skipped
    };
  }

  parseThreeColumnInput(machineText = '', brandText = '', modelText = '', defaultMachine = 'Plane Machine', defaultBrand = 'JUKI') {
    // Check if any box contains tab-delimited Excel paste
    const checkForTabs = (txt) => {
      const lines = String(txt || '').split(/\r?\n/).filter(l => l.trim().length > 0);
      const tabLines = lines.filter(l => l.includes('\t'));
      return tabLines.length > 0 && tabLines.length >= lines.length * 0.4;
    };

    let mLines = String(machineText || '').split(/\r?\n/).map(l => l.trim());
    let bLines = String(brandText || '').split(/\r?\n/).map(l => l.trim());
    let modelLines = String(modelText || '').split(/\r?\n/).map(l => l.trim());

    // Auto-detect multi-column paste if user pasted 3 columns into one box
    const tabSource = [machineText, brandText, modelText].find(checkForTabs);
    if (tabSource && (mLines.filter(Boolean).length <= 1 || bLines.filter(Boolean).length <= 1 || modelLines.filter(Boolean).length <= 1)) {
      const parsedLines = String(tabSource).split(/\r?\n/).filter(l => l.trim().length > 0);
      const col1 = [];
      const col2 = [];
      const col3 = [];
      parsedLines.forEach(l => {
        const parts = l.split('\t').map(p => p.trim());
        if (parts.length >= 3) {
          col1.push(parts[0]);
          col2.push(parts[1]);
          col3.push(parts[2]);
        } else if (parts.length === 2) {
          col1.push(defaultMachine || 'Plane Machine');
          col2.push(parts[0]);
          col3.push(parts[1]);
        }
      });
      if (col3.length > 0) {
        mLines = col1;
        bLines = col2;
        modelLines = col3;
      }
    }

    while (mLines.length > 0 && !mLines[mLines.length - 1]) mLines.pop();
    while (bLines.length > 0 && !bLines[bLines.length - 1]) bLines.pop();
    while (modelLines.length > 0 && !modelLines[modelLines.length - 1]) modelLines.pop();

    const mNonEmpty = mLines.filter(Boolean);
    const bNonEmpty = bLines.filter(Boolean);
    const totalRows = Math.max(mLines.length, bLines.length, modelLines.length);

    const existingMachines = this.getStorageItems('MACHINE');
    const existingModelNorms = new Set(
      existingMachines.map(m => this.normalizePureAlphanumeric(m.model)).filter(Boolean)
    );

    const knownBrands = [
      'JUKI', 'BROTHER', 'PEGASUS', 'SIRUBA', 'YAMATO', 'KANSAI', 'KANSAI SPECIAL', 
      'JACK', 'SUNSTAR', 'HASHIMA', 'KM', 'EASTMAN', 'SINGER', 'PFAFF', 'DURKOPP ADLER',
      'TYPICAL', 'ZUSAN', 'BEDOLY', 'MAUSER', 'GOLDEN WHEEL', 'BRUCE', 'HIKARI', 'ZOJE'
    ];

    const records = [];
    const seenBatchNorms = new Set();

    for (let i = 0; i < totalRows; i++) {
      let machine = '';
      if (mNonEmpty.length === 1) {
        machine = mNonEmpty[0];
      } else if (i < mLines.length && mLines[i]) {
        machine = mLines[i];
      } else if (mNonEmpty.length > 0) {
        machine = mNonEmpty[mNonEmpty.length - 1];
      } else {
        machine = defaultMachine || 'Plane Machine';
      }

      let brand = '';
      if (bNonEmpty.length === 1) {
        brand = bNonEmpty[0];
      } else if (i < bLines.length && bLines[i]) {
        brand = bLines[i];
      } else if (bNonEmpty.length > 0) {
        brand = bNonEmpty[bNonEmpty.length - 1];
      } else {
        brand = defaultBrand || 'JUKI';
      }

      let model = i < modelLines.length ? modelLines[i] : '';

      // Check for parentheses brand format if model has e.g. "TYPICAL (GC-6720)"
      if (/\(([^)]+)\)/.test(model)) {
        const m = model.match(/^(.*?)\s*\(([^)]+)\)$/);
        if (m) {
          const p1Upper = m[1].trim().toUpperCase();
          const p2Upper = m[2].trim().toUpperCase();
          const matchP1 = knownBrands.find(b => p1Upper === b || p1Upper.startsWith(b + ' '));
          const matchP2 = knownBrands.find(b => p2Upper === b);
          if (matchP1) {
            brand = matchP1;
            model = p1Upper === matchP1 ? m[2].trim() : `${m[1].trim().substring(matchP1.length).trim()} (${m[2].trim()})`;
          } else if (matchP2) {
            brand = matchP2;
            model = m[1].trim();
          }
        }
      }

      machine = String(machine || '').trim();
      brand = String(brand || defaultBrand || 'JUKI').trim().toUpperCase();
      model = String(model || '').trim();

      if (!model && !machine) continue;
      if (!model) model = 'Standard Auto';

      // Brand correction check
      const brandCheck = this.checkCorrection('BRAND', brand);
      if (brandCheck && brandCheck.hasIssue) {
        brand = brandCheck.suggested;
      }

      const modelCheck = this.checkCorrection('MODEL', model);
      if (modelCheck && modelCheck.hasIssue) {
        model = modelCheck.suggested;
      }

      const norm = this.normalizePureAlphanumeric(model);
      const isDuplicate = existingModelNorms.has(norm) || seenBatchNorms.has(norm);
      if (norm) seenBatchNorms.add(norm);

      records.push({
        row: i + 1,
        machineName: machine,
        brand: brand.toUpperCase(),
        model,
        norm,
        isDuplicate
      });
    }

    return records;
  }

  addThreeColumnRecords(records) {
    if (!Array.isArray(records)) return { addedCount: 0, skippedCount: 0, added: [], skipped: [] };

    const existingMachines = this.getStorageItems('MACHINE');
    const existingModelNorms = new Set(
      existingMachines.map(m => this.normalizePureAlphanumeric(m.model)).filter(Boolean)
    );

    const added = [];
    const skipped = [];

    records.forEach(rec => {
      const machineName = String(rec.machineName || '').trim();
      const brand = String(rec.brand || 'JUKI').trim().toUpperCase();
      const model = String(rec.model || '').trim();
      const norm = this.normalizePureAlphanumeric(model);

      if (!model || !machineName) {
        skipped.push({ model, reason: 'Missing Machine Name or Model' });
        return;
      }

      if (existingModelNorms.has(norm)) {
        skipped.push({ model, reason: 'Already exists in database' });
        return;
      }

      // Ensure machine name registered
      this.addMachineName(machineName);

      const saved = this.addStorageItem({
        category: 'MACHINE',
        machineName,
        brand,
        model,
        status: 'ACTIVE'
      });

      added.push(saved);
      existingModelNorms.add(norm);
    });

    return {
      success: true,
      addedCount: added.length,
      skippedCount: skipped.length,
      added,
      skipped
    };
  }

  // ==========================================
  // 2-Box Model Importer (Brand & Model Number)
  // Under Selected Machine Name Dropdown
  // ==========================================

  parseTwoColumnBrandModel(brandText = '', modelText = '', defaultBrand = 'JUKI', targetMachineName = '') {
    let bLines = String(brandText || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    let mLines = String(modelText || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    // Auto-detect tabbed clipboard paste if user pasted Excel 2 columns into one box
    const checkTabbed = (lines) => lines.some(l => l.includes('\t'));
    if (checkTabbed(bLines) && mLines.length === 0) {
      const bCol = [];
      const mCol = [];
      bLines.forEach(l => {
        const parts = l.split('\t').map(p => p.trim());
        if (parts.length >= 2) {
          bCol.push(parts[0]);
          mCol.push(parts[1]);
        } else {
          mCol.push(parts[0]);
        }
      });
      bLines = bCol;
      mLines = mCol;
    } else if (checkTabbed(mLines) && bLines.length === 0) {
      const bCol = [];
      const mCol = [];
      mLines.forEach(l => {
        const parts = l.split('\t').map(p => p.trim());
        if (parts.length >= 2) {
          bCol.push(parts[0]);
          mCol.push(parts[1]);
        } else {
          mCol.push(parts[0]);
        }
      });
      bLines = bCol;
      mLines = mCol;
    }

    const singleBrand = bLines.length === 1 ? bLines[0] : (bLines.length === 0 ? (defaultBrand || 'JUKI') : null);

    // Check existing models under targetMachineName specifically
    const cleanTarget = String(targetMachineName || '').trim().toLowerCase();
    const allMachines = this.getStorageItems('MACHINE');
    const existingUnderMachine = cleanTarget
      ? allMachines.filter(m => (m.machineName || '').trim().toLowerCase() === cleanTarget)
      : [];
    const existingModelNorms = new Set(
      existingUnderMachine.map(m => this.normalizePureAlphanumeric(m.model)).filter(Boolean)
    );

    const records = [];
    const seenBatchNorms = new Set();

    mLines.forEach((model, idx) => {
      let brand = singleBrand || bLines[idx] || defaultBrand || 'JUKI';
      const mClean = model.trim();
      if (!mClean) return;

      // Brand correction check
      const brandCheck = this.checkCorrection('BRAND', brand);
      if (brandCheck && brandCheck.hasIssue) {
        brand = brandCheck.suggested;
      }

      // Model correction check
      let modelFinal = mClean;
      const modelCheck = this.checkCorrection('MODEL', modelFinal);
      if (modelCheck && modelCheck.hasIssue) {
        modelFinal = modelCheck.suggested;
      }

      const norm = this.normalizePureAlphanumeric(modelFinal);
      const isExisting = existingModelNorms.has(norm);
      const isDuplicateInBatch = seenBatchNorms.has(norm);
      if (norm) seenBatchNorms.add(norm);

      records.push({
        row: idx + 1,
        brand: brand.toUpperCase(),
        model: modelFinal,
        norm,
        isExisting,
        isDuplicate: isDuplicateInBatch
      });
    });

    return {
      brands: bLines,
      models: mLines,
      records
    };
  }

  async saveModelsForMachine(machineName, records) {
    const cleanMachine = String(machineName || '').trim();
    if (!cleanMachine) throw new Error('Target Machine Name is required');

    // 1. Ensure machine name registered in MACHINE_NAMES table
    this.addMachineName(cleanMachine);
    let mnList = storage.getTable(TABLE_NAMES.MACHINE_NAMES) || [];
    let mnItem = mnList.find(m => m.name && m.name.toLowerCase() === cleanMachine.toLowerCase());

    // 2. Get current items for this machine in STORAGE_MASTER
    const allMachines = this.getStorageItems('MACHINE');
    const machineItems = allMachines.filter(
      m => (m.machineName || '').trim().toLowerCase() === cleanMachine.toLowerCase()
    );

    // Find current maximum sortOrder for this machine
    let currentMaxOrder = machineItems.reduce((max, m) => {
      const ord = (m.sortOrder !== undefined && m.sortOrder !== null) ? Number(m.sortOrder) : 0;
      return Math.max(max, ord);
    }, 0);

    const added = [];
    const updated = [];
    const seenNormsInSave = new Set();

    records.forEach((item, idx) => {
      const model = String(item.model || '').trim();
      if (!model) return;
      const brand = String(item.brand || 'JUKI').trim().toUpperCase();
      const norm = this.normalizePureAlphanumeric(model);

      if (seenNormsInSave.has(norm)) return;
      seenNormsInSave.add(norm);

      // A. Save / Update in STORAGE_MASTER table
      const existingItem = machineItems.find(
        m => this.normalizePureAlphanumeric(m.model) === norm
      );

      if (existingItem) {
        // Update brand and sequential sortOrder
        const updatedItem = this.updateStorageItem(existingItem.id, {
          brand,
          sortOrder: currentMaxOrder + idx + 1,
          status: 'ACTIVE'
        });
        updated.push(updatedItem);
      } else {
        // Insert new record with sequential sortOrder
        const record = {
          category: 'MACHINE',
          machineName: cleanMachine,
          brand,
          model,
          sortOrder: currentMaxOrder + idx + 1,
          status: 'ACTIVE'
        };
        const saved = this.addStorageItem(record);
        added.push(saved);
      }

      // B. Sync to BRANDS table so brand is recognized everywhere in ERP
      let brdList = storage.getTable(TABLE_NAMES.BRANDS) || [];
      let brdItem = brdList.find(b => b.name && b.name.toLowerCase() === brand.toLowerCase());
      if (!brdItem) {
        brdItem = storage.insert(TABLE_NAMES.BRANDS, {
          id: 'brd-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
          name: brand,
          country: brand === 'JUKI' ? 'Japan' : (brand === 'BROTHER' ? 'Japan' : 'International'),
          status: 'ACTIVE',
          createdAt: new Date().toISOString()
        });
      }

      // C. Sync to MODELS table (Core Database for Inventory, Reports, and Add Machine)
      let mdlList = storage.getTable(TABLE_NAMES.MODELS) || [];
      let mdlItem = mdlList.find(m => 
        m.name && m.name.toLowerCase() === model.toLowerCase() &&
        (m.machineNameId === mnItem?.id || (m.machineName && m.machineName.toLowerCase() === cleanMachine.toLowerCase()))
      );
      if (mdlItem) {
        storage.update(TABLE_NAMES.MODELS, mdlItem.id, {
          brandId: brdItem?.id || mdlItem.brandId,
          brandName: brand,
          machineNameId: mnItem?.id || mdlItem.machineNameId,
          machineName: cleanMachine,
          sortOrder: currentMaxOrder + idx + 1,
          status: 'ACTIVE'
        });
      } else {
        storage.insert(TABLE_NAMES.MODELS, {
          id: 'mdl-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
          name: model,
          brandId: brdItem?.id || '',
          brandName: brand,
          machineNameId: mnItem?.id || '',
          machineName: cleanMachine,
          sortOrder: currentMaxOrder + idx + 1,
          description: `${brand} ${model} under ${cleanMachine}`,
          status: 'ACTIVE',
          createdAt: new Date().toISOString()
        });
      }
    });

    // Save all synchronized database tables
    storage.saveTable(TABLE_NAMES.STORAGE_MASTER);
    storage.saveTable(TABLE_NAMES.MACHINE_NAMES);
    storage.saveTable(TABLE_NAMES.BRANDS);
    storage.saveTable(TABLE_NAMES.MODELS);

    // Guaranteed immediate disk write to data/erp_database.json
    if (typeof storage.persistToServerDatabase === 'function') {
      try {
        await storage.persistToServerDatabase();
      } catch (e) {
        console.warn('Persistence error:', e);
      }
    }

    this._broadcastStorageChange();
    auditService.log('STORAGE_BULK_MODELS_ADD', `Saved ${added.length + updated.length} models (${added.length} new, ${updated.length} updated) under machine "${cleanMachine}" to database`, {
      machineName: cleanMachine,
      addedCount: added.length,
      updatedCount: updated.length
    });

    return {
      success: true,
      totalSaved: added.length + updated.length,
      addedCount: added.length,
      updatedCount: updated.length,
      added,
      updated
    };
  }

  // ==========================================
  // Data Integrity Audit & Flawed Entry Marking
  // ==========================================

  auditStorageItemIntegrity(item, allItems = null) {
    if (!item) return { integrityStatus: 'FLAWED', issues: ['Empty record'], primaryIssue: 'Empty record' };
    const issues = [];
    const category = item.category || 'MACHINE';
    const fields = storageSchemaService.getCategoryFields(category);
    const requiredFields = fields.filter(f => f.required);

    // 1. Check Mandatory Fields
    requiredFields.forEach(f => {
      const val = item[f.key];
      if (val === undefined || val === null || String(val).trim() === '') {
        issues.push({
          type: 'MISSING_REQUIRED',
          field: f.key,
          label: f.label,
          message: `Missing required ${f.label}`
        });
      }
    });

    // 2. Check for Duplicate Model / Code Conflicts
    if (allItems && Array.isArray(allItems)) {
      if (category === 'MACHINE' && item.model) {
        const itemModelNorm = this.normalizePureAlphanumeric(item.model);
        const duplicate = allItems.find(other => 
          other.id !== item.id && 
          other.category === 'MACHINE' && 
          (other.machineName || '').trim().toLowerCase() === (item.machineName || '').trim().toLowerCase() &&
          other.model && 
          this.normalizePureAlphanumeric(other.model) === itemModelNorm
        );
        if (duplicate) {
          issues.push({
            type: 'DUPLICATE',
            field: 'model',
            label: 'Model Number',
            message: `Duplicate Model (${item.model}) conflicts with existing record`
          });
        }
      } else if (category === 'SPARE_PART' && item.code) {
        const codeNorm = this.normalizePureAlphanumeric(item.code);
        const duplicate = allItems.find(other => 
          other.id !== item.id && 
          other.category === 'SPARE_PART' && 
          other.code && 
          this.normalizePureAlphanumeric(other.code) === codeNorm
        );
        if (duplicate) {
          issues.push({
            type: 'DUPLICATE',
            field: 'code',
            label: 'Part Code',
            message: `Duplicate Part Code (${item.code})`
          });
        }
      }
    }

    // 3. Check for Casing or Formatting Anomalies
    if (category === 'MACHINE') {
      if (item.brand) {
        const brandCheck = this.checkCorrection('BRAND', item.brand);
        if (brandCheck && brandCheck.hasIssue) {
          issues.push({
            type: 'CASING_ANOMALY',
            field: 'brand',
            label: 'Brand',
            message: `Brand casing typo: "${item.brand}" should be "${brandCheck.suggested}"`,
            suggested: brandCheck.suggested
          });
        }
      }
      if (item.model) {
        const modelCheck = this.checkCorrection('MODEL', item.model);
        if (modelCheck && modelCheck.hasIssue) {
          issues.push({
            type: 'FORMAT_ANOMALY',
            field: 'model',
            label: 'Model Number',
            message: `Model formatting typo: "${item.model}" should be "${modelCheck.suggested}"`,
            suggested: modelCheck.suggested
          });
        }
      }
    }

    // Determine status
    const hasFatal = issues.some(i => i.type === 'MISSING_REQUIRED' || i.type === 'DUPLICATE');
    const hasWarning = issues.some(i => i.type === 'CASING_ANOMALY' || i.type === 'FORMAT_ANOMALY');

    let integrityStatus = 'CLEAN';
    if (hasFatal) integrityStatus = 'FLAWED';
    else if (hasWarning) integrityStatus = 'WARNING';

    return {
      integrityStatus,
      issues,
      primaryIssue: issues.length > 0 ? issues[0].message : null
    };
  }

  auditAllStorageItems(category = null) {
    const items = this.getStorageItems(category);
    let cleanCount = 0;
    let warningCount = 0;
    let flawedCount = 0;

    const enriched = items.map(item => {
      const integrity = this.auditStorageItemIntegrity(item, items);
      if (integrity.integrityStatus === 'CLEAN') cleanCount++;
      else if (integrity.integrityStatus === 'WARNING') warningCount++;
      else flawedCount++;

      return {
        ...item,
        _integrity: integrity
      };
    });

    return {
      total: enriched.length,
      cleanCount,
      warningCount,
      flawedCount,
      items: enriched
    };
  }

  purgeFlawedItems(category = null) {
    const auditResult = this.auditAllStorageItems(category);
    const flawedIds = auditResult.items
      .filter(it => it._integrity.integrityStatus === 'FLAWED')
      .map(it => it.id);

    return this.deleteStorageItemsBatch(flawedIds);
  }

  batchAutoFixStorageItems(category = null) {
    const auditResult = this.auditAllStorageItems(category);
    const warningItems = auditResult.items.filter(it => it._integrity.integrityStatus === 'WARNING');
    let fixedCount = 0;

    warningItems.forEach(item => {
      const updates = {};
      let changed = false;
      item._integrity.issues.forEach(iss => {
        if (iss.suggested && iss.field) {
          updates[iss.field] = iss.suggested;
          changed = true;
        }
      });

      if (changed) {
        this.updateStorageItem(item.id, updates);
        fixedCount++;
      }
    });

    return fixedCount;
  }

  // ==========================================
  // 2. Correction Rules & Alias Dictionary CRUD
  // ==========================================

  getCorrectionRules(category = null) {
    const all = storage.getTable(TABLE_NAMES.STORAGE_CORRECTION_RULES) || [];
    if (!category || category === 'ALL') return all;
    return all.filter(r => r.category === category);
  }

  addCorrectionRule(rule) {
    if (!rule.id) {
      rule.id = 'scr-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
    }
    rule.createdAt = new Date().toISOString();
    storage.insert(TABLE_NAMES.STORAGE_CORRECTION_RULES, rule);
    this._broadcastStorageChange();
    return rule;
  }

  updateCorrectionRule(id, updates) {
    const existing = storage.getItem(TABLE_NAMES.STORAGE_CORRECTION_RULES, id);
    if (!existing) throw new Error('Correction rule not found');
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    storage.update(TABLE_NAMES.STORAGE_CORRECTION_RULES, id, updated);
    this._broadcastStorageChange();
    return updated;
  }

  deleteCorrectionRule(id) {
    storage.delete(TABLE_NAMES.STORAGE_CORRECTION_RULES, id);
    this._broadcastStorageChange();
    return true;
  }

  // ==========================================
  // 3. String Normalization & Similarity Engine
  // ==========================================

  normalizeRaw(str) {
    if (!str) return '';
    return String(str).trim();
  }

  normalizeForComparison(str) {
    if (!str) return '';
    return String(str)
      .toLowerCase()
      .trim()
      .replace(/[\s\-_/\\.:,;]+/g, ' '); // collapse dividers
  }

  normalizePureAlphanumeric(str) {
    if (!str) return '';
    return String(str).toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  calculateLevenshteinDistance(a, b) {
    if (!a || !b) return (a || b || '').length;
    const al = a.length;
    const bl = b.length;
    const matrix = [];

    for (let i = 0; i <= al; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= bl; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= al; i++) {
      for (let j = 1; j <= bl; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,      // deletion
          matrix[i][j - 1] + 1,      // insertion
          matrix[i - 1][j - 1] + cost // substitution
        );
      }
    }
    return matrix[al][bl];
  }

  calculateSimilarity(strA, strB) {
    const s1 = this.normalizeForComparison(strA);
    const s2 = this.normalizeForComparison(strB);
    if (s1 === s2) return 1.0;
    if (!s1 || !s2) return 0.0;

    const maxLen = Math.max(s1.length, s2.length);
    if (maxLen === 0) return 1.0;
    const dist = this.calculateLevenshteinDistance(s1, s2);
    return Math.max(0, (maxLen - dist) / maxLen);
  }

  generateAutoAliases(item) {
    const aliases = new Set();
    const addVar = (val) => {
      if (!val) return;
      const s = String(val).trim();
      if (!s) return;
      aliases.add(s.toLowerCase());
      aliases.add(s.replace(/[\s\-_/]/g, '').toLowerCase());
      aliases.add(s.replace(/[\-_/]/g, ' ').toLowerCase());
    };

    if (item.category === 'MACHINE') {
      addVar(item.brand);
      addVar(item.model);
      addVar(item.machineName);
      if (item.brand && item.model) {
        addVar(`${item.brand} ${item.model}`);
        addVar(`${item.brand}-${item.model}`);
      }
    } else if (item.category === 'SPARE_PART') {
      addVar(item.name);
      addVar(item.code);
    } else if (item.category === 'TOOL') {
      addVar(item.name);
      addVar(item.code);
    } else if (item.category === 'LOCATION') {
      addVar(item.lineName);
      addVar(item.floorName);
    }
    return Array.from(aliases);
  }

  // ==========================================
  // 4. Intelligent Auto-Correction Inspector
  // ==========================================

  /**
   * Checks whether an input string has casing, punctuation, formatting, or spelling errors
   * against the Storage Master catalog and Correction Rules.
   * 
   * @param {string} category - 'MACHINE_NAME' | 'BRAND' | 'MODEL' | 'SPARE_PART' | 'TOOL' | 'LOCATION' | 'ANY'
   * @param {string} inputStr - The raw text entered or imported
   * @returns {Object|null} Correction detail or null if input is already valid/exact match
   */
  checkCorrection(category, inputStr) {
    if (!inputStr || typeof inputStr !== 'string') return null;
    const raw = inputStr.trim();
    if (raw.length < 2) return null;

    const pureAlpha = this.normalizePureAlphanumeric(raw);
    const normComp = this.normalizeForComparison(raw);

    // Strategy 1: Check explicit correction rules first
    const rules = this.getCorrectionRules();
    for (const rule of rules) {
      if (category !== 'ANY' && rule.category && rule.category !== category) continue;
      const rulePatternNorm = this.normalizeForComparison(rule.rawPattern);
      const rulePure = this.normalizePureAlphanumeric(rule.rawPattern);

      if (normComp === rulePatternNorm || pureAlpha === rulePure) {
        // If raw is already exactly the targetValue, no correction needed
        if (raw === rule.targetValue) return null;

        let issueType = rule.issueType || 'formatting';
        let issueTitle = 'Casing Mismatch (Capital / Small Letters)';
        if (issueType === 'spelling') issueTitle = 'Spelling Typo Detected';
        if (issueType === 'formatting') issueTitle = 'Hyphen or Punctuation Format Mismatch';
        if (issueType === 'slang') issueTitle = 'Factory Alias / Slang Matched';

        return {
          hasIssue: true,
          original: raw,
          suggested: rule.targetValue,
          issueType,
          issueTitle,
          confidence: 99,
          ruleMatched: rule,
          explanation: `Canonical standard in Storage Dictionary: "${rule.targetValue}"`
        };
      }
    }

    // Strategy 2: Check against Storage Master items
    const masterItems = this.getStorageItems();
    let bestMatch = null;
    let highestScore = 0;

    for (const item of masterItems) {
      const candidates = [];

      if (item.category === 'MACHINE') {
        if (!category || category === 'ANY' || category === 'BRAND') {
          candidates.push({ field: 'brand', text: item.brand, role: 'BRAND' });
        }
        if (!category || category === 'ANY' || category === 'MODEL') {
          candidates.push({ field: 'model', text: item.model, role: 'MODEL' });
          if (item.brand && item.model) {
            candidates.push({ field: 'full', text: `${item.brand} ${item.model}`, role: 'BRAND_MODEL' });
          }
        }
        if (!category || category === 'ANY' || category === 'MACHINE_NAME') {
          candidates.push({ field: 'machineName', text: item.machineName, role: 'MACHINE_NAME' });
        }
      } else if (item.category === 'SPARE_PART') {
        if (!category || category === 'ANY' || category === 'SPARE_PART') {
          candidates.push({ field: 'name', text: item.name, role: 'SPARE_PART' });
          if (item.code) candidates.push({ field: 'code', text: item.code, role: 'SPARE_PART_CODE' });
        }
      } else if (item.category === 'TOOL') {
        if (!category || category === 'ANY' || category === 'TOOL') {
          candidates.push({ field: 'name', text: item.name, role: 'TOOL' });
        }
      } else if (item.category === 'LOCATION') {
        if (!category || category === 'ANY' || category === 'LOCATION') {
          candidates.push({ field: 'lineName', text: item.lineName, role: 'LOCATION_LINE' });
          candidates.push({ field: 'floorName', text: item.floorName, role: 'LOCATION_FLOOR' });
        }
      }

      // Also check configured aliases
      if (Array.isArray(item.aliases)) {
        item.aliases.forEach(alias => {
          let canonical = item.model || item.name || item.brand || item.lineName;
          candidates.push({ field: 'alias', text: canonical, aliasTarget: alias, isAlias: true });
        });
      }

      for (const cand of candidates) {
        const candText = cand.text;
        if (!candText) continue;

        // Exact match -> no correction needed
        if (raw === candText) return null;

        const candPure = this.normalizePureAlphanumeric(cand.isAlias ? cand.aliasTarget : candText);
        const candNorm = this.normalizeForComparison(cand.isAlias ? cand.aliasTarget : candText);

        // Subcase A: Exact match ignoring case (Capital/Small letter difference)
        if (normComp === candNorm || pureAlpha === candPure) {
          const isOnlyCasing = raw.toLowerCase() === candText.toLowerCase();
          return {
            hasIssue: true,
            original: raw,
            suggested: candText,
            issueType: isOnlyCasing ? 'casing' : 'formatting',
            issueTitle: isOnlyCasing 
              ? 'Casing Mismatch (Capital / Lowercase)' 
              : 'Hyphen or Formatting Mismatch',
            confidence: 98,
            matchedItem: item,
            explanation: `Canonical form in Master Storage: "${candText}"`
          };
        }

        // Subcase B: Fuzzy spelling / Levenshtein similarity
        const score = this.calculateSimilarity(raw, cand.isAlias ? cand.aliasTarget : candText);
        if (score > highestScore && score >= 0.75) {
          highestScore = score;
          bestMatch = {
            candidateText: candText,
            score,
            item,
            role: cand.role
          };
        }
      }
    }

    if (bestMatch && highestScore >= 0.75) {
      const dist = this.calculateLevenshteinDistance(raw.toLowerCase(), bestMatch.candidateText.toLowerCase());
      return {
        hasIssue: true,
        original: raw,
        suggested: bestMatch.candidateText,
        issueType: 'spelling',
        issueTitle: 'Spelling Typo / Inconsistency Detected',
        confidence: Math.round(highestScore * 100),
        matchedItem: bestMatch.item,
        explanation: `Spelling variation (${dist} character difference). Canonical Storage Reference: "${bestMatch.candidateText}"`
      };
    }

    return null;
  }

  // ==========================================
  // 5. Interactive Confirmation Modal Dialog
  // ==========================================

  /**
   * Prompts the user with an interactive confirmation modal:
   * "An issue was found with this entry. Would you like to auto-correct it?"
   * 
   * @param {Object} options
   * @param {string} options.original - User's entered text
   * @param {string} options.suggested - Corrected canonical storage text
   * @param {string} [options.issueTitle] - Brief title of detected issue
   * @param {string} [options.context] - Additional context e.g. "Machine Model"
   * @param {Function} options.onConfirm - Callback when user clicks "Yes, Auto-Correct"
   * @param {Function} [options.onCancel] - Callback when user clicks "Keep As Entered"
   */
  promptCorrection({ original, suggested, issueTitle, context = '', onConfirm, onCancel }) {
    // Remove existing prompt if any
    this.closePromptModal();

    const overlay = document.createElement('div');
    overlay.id = 'smart-storage-correction-overlay';
    overlay.className = 'modal-overlay';
    overlay.style.zIndex = '10050';

    overlay.innerHTML = `
      <div class="modal-dialog" style="max-width: 520px; border: 1.5px solid #38bdf8; box-shadow: 0 20px 40px rgba(0,0,0,0.6); animation: scaleUp 0.18s cubic-bezier(0.16, 1, 0.3, 1);">
        <!-- Header -->
        <div class="modal-header" style="background: linear-gradient(135deg, rgba(56, 189, 248, 0.15), rgba(14, 165, 233, 0.05)); border-bottom: 1px solid rgba(56, 189, 248, 0.3); padding: 14px 20px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="font-size: 22px;">💡</div>
            <div>
              <div style="font-weight: 800; color: #38bdf8; font-size: 15px; letter-spacing: -0.2px;">
                Smart Auto-Correction Proposal (Validation Alert)
              </div>
              <div style="font-size: 11px; color: var(--text-muted);">
                ${context ? `Field: ${context} &bull; ` : ''}Master Storage Reference
              </div>
            </div>
          </div>
          <button type="button" id="btn-modal-correction-close" class="btn btn-ghost btn-sm" style="font-size: 16px;">✕</button>
        </div>

        <!-- Body -->
        <div class="modal-body" style="padding: 20px 22px; display: flex; flex-direction: column; gap: 14px;">
          
          <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.35); border-left: 4px solid #f59e0b; border-radius: var(--radius-md); padding: 12px 14px;">
            <div style="font-size: 13px; font-weight: 700; color: #fbbf24;">
              ⚠️ ${issueTitle || 'Inconsistency detected in spelling or casing'}
            </div>
            <div style="font-size: 12px; color: var(--text-secondary); margin-top: 3px;">
              The entered value does not match the canonical master storage reference. You can auto-align it now.
            </div>
          </div>

          <!-- Comparison Box -->
          <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px 16px; display: flex; flex-direction: column; gap: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 8px; border-bottom: 1px dashed var(--border-color);">
              <span style="font-size: 11.5px; color: var(--text-muted); font-weight: 600;">Your Input (Entered):</span>
              <span style="font-family: var(--font-mono); font-size: 13px; font-weight: 700; color: #f87171; background: rgba(239, 68, 68, 0.12); padding: 3px 8px; border-radius: 4px; border: 1px solid rgba(239, 68, 68, 0.25);">
                "${original}"
              </span>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 11.5px; color: #38bdf8; font-weight: 700;">Storage Canonical (Suggested):</span>
              <span style="font-family: var(--font-mono); font-size: 14px; font-weight: 800; color: #34d399; background: rgba(52, 211, 153, 0.15); padding: 4px 10px; border-radius: 4px; border: 1px solid rgba(52, 211, 153, 0.35);">
                "${suggested}"
              </span>
            </div>
          </div>

          <!-- Core Prompt Question -->
          <div style="text-align: center; padding: 6px 10px; background: rgba(56, 189, 248, 0.08); border-radius: var(--radius-md); border: 1px solid rgba(56, 189, 248, 0.2);">
            <div style="font-size: 14px; font-weight: 800; color: #fff;">
              "An issue was found with this entry. Would you like to auto-correct it?"
            </div>
            <div style="font-size: 11px; color: #38bdf8; margin-top: 3px;">
              Clicking [Yes, Auto-Correct] replaces the value with the canonical standard.
            </div>
          </div>

        </div>

        <!-- Footer Actions -->
        <div class="modal-footer" style="padding: 12px 20px; background: var(--bg-card); border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end; gap: 10px;">
          <button type="button" id="btn-correction-cancel" class="btn btn-secondary btn-sm" style="font-weight: 600;">
            ✕ Keep As Entered
          </button>
          <button type="button" id="btn-correction-confirm" class="btn btn-success btn-sm" style="font-weight: 800; font-size: 13px; display: flex; align-items: center; gap: 6px;">
            <span>✓ Yes, Auto-Correct</span>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    this._activePromptModal = overlay;

    // Focus primary button for fast Enter keypress
    setTimeout(() => {
      const confirmBtn = document.getElementById('btn-correction-confirm');
      if (confirmBtn) confirmBtn.focus({ preventScroll: true });
    }, 50);

    const handleConfirm = () => {
      this.closePromptModal();
      if (typeof onConfirm === 'function') onConfirm(suggested);
    };

    const handleCancel = () => {
      this.closePromptModal();
      if (typeof onCancel === 'function') onCancel(original);
    };

    const confirmBtn = overlay.querySelector('#btn-correction-confirm');
    const cancelBtn = overlay.querySelector('#btn-correction-cancel');
    const closeBtn = overlay.querySelector('#btn-modal-correction-close');

    if (confirmBtn) confirmBtn.addEventListener('click', handleConfirm);
    if (cancelBtn) cancelBtn.addEventListener('click', handleCancel);
    if (closeBtn) closeBtn.addEventListener('click', handleCancel);

    // Escape or Enter key listener
    const keyHandler = (e) => {
      if (e.key === 'Escape') {
        window.removeEventListener('keydown', keyHandler);
        handleCancel();
      } else if (e.key === 'Enter') {
        window.removeEventListener('keydown', keyHandler);
        handleConfirm();
      }
    };
    window.addEventListener('keydown', keyHandler);
  }

  closePromptModal() {
    if (this._activePromptModal && this._activePromptModal.parentNode) {
      this._activePromptModal.parentNode.removeChild(this._activePromptModal);
    }
    this._activePromptModal = null;
  }

  // ==========================================
  // 6. Input Field Smart Auto-Correction Binder
  // ==========================================

  /**
   * Attaches smart auto-correction listener to any input or select field in DOM
   * @param {HTMLElement|string} target - Input element or selector
   * @param {string} category - 'MACHINE_NAME' | 'BRAND' | 'MODEL' | 'SPARE_PART' | 'TOOL' | 'LOCATION'
   * @param {string} contextLabel - User-friendly field name for the message
   * @param {Function} [onAppliedCallback] - Optional callback after correction is applied
   */
  bindInputAutoCorrection(target, category, contextLabel, onAppliedCallback) {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el) return;

    const checkAndPrompt = () => {
      const val = el.value;
      if (!val || val.trim().length < 2) return;

      const issue = this.checkCorrection(category, val);
      if (issue && issue.hasIssue) {
        this.promptCorrection({
          original: issue.original,
          suggested: issue.suggested,
          issueTitle: issue.issueTitle,
          context: contextLabel,
          onConfirm: (correctedVal) => {
            el.value = correctedVal;
            // Visual pulse highlight
            el.style.borderColor = '#34d399';
            el.style.boxShadow = '0 0 0 3px rgba(52, 211, 153, 0.3)';
            setTimeout(() => {
              el.style.borderColor = '';
              el.style.boxShadow = '';
            }, 1200);

            // Trigger change event so any cascading listeners update
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));

            if (typeof onAppliedCallback === 'function') {
              onAppliedCallback(correctedVal);
            }
          }
        });
      }
    };

    el.addEventListener('blur', checkAndPrompt);
  }

  // ==========================================
  // 7. Database Health Scanner & Auto-Fix Engine
  // ==========================================

  /**
   * Audits all physical machines, spare parts, and tools in the ERP
   * against the Storage Master library.
   * Finds records with casing mismatches, punctuation typos, or unstandardized names.
   */
  scanExistingDatabase() {
    const machines = storage.getTable(TABLE_NAMES.MACHINES) || [];
    const spareParts = storage.getTable(TABLE_NAMES.SPARE_PARTS_MASTER) || [];
    const tools = storage.getTable(TABLE_NAMES.TOOLS_MASTER) || [];

    const issues = [];

    // 1. Audit Machines
    machines.forEach((m, idx) => {
      // Check Brand
      if (m.brand) {
        const checkBrand = this.checkCorrection('BRAND', m.brand);
        if (checkBrand && checkBrand.hasIssue) {
          issues.push({
            id: `iss-m-brd-${m.id}`,
            entityType: 'MACHINE',
            recordId: m.id,
            serialNumber: m.serialNumber,
            field: 'brand',
            fieldLabel: 'Machine Brand',
            original: m.brand,
            suggested: checkBrand.suggested,
            issueType: checkBrand.issueType,
            issueTitle: checkBrand.issueTitle,
            itemRef: m
          });
        }
      }

      // Check Model
      if (m.model) {
        const checkModel = this.checkCorrection('MODEL', m.model);
        if (checkModel && checkModel.hasIssue) {
          issues.push({
            id: `iss-m-mdl-${m.id}`,
            entityType: 'MACHINE',
            recordId: m.id,
            serialNumber: m.serialNumber,
            field: 'model',
            fieldLabel: 'Machine Model',
            original: m.model,
            suggested: checkModel.suggested,
            issueType: checkModel.issueType,
            issueTitle: checkModel.issueTitle,
            itemRef: m
          });
        }
      }

      // Check Machine Name
      if (m.machineName) {
        const checkName = this.checkCorrection('MACHINE_NAME', m.machineName);
        if (checkName && checkName.hasIssue) {
          issues.push({
            id: `iss-m-nam-${m.id}`,
            entityType: 'MACHINE',
            recordId: m.id,
            serialNumber: m.serialNumber,
            field: 'machineName',
            fieldLabel: 'Machine Name',
            original: m.machineName,
            suggested: checkName.suggested,
            issueType: checkName.issueType,
            issueTitle: checkName.issueTitle,
            itemRef: m
          });
        }
      }
    });

    // 2. Audit Spare Parts
    spareParts.forEach(sp => {
      if (sp.name) {
        const checkPart = this.checkCorrection('SPARE_PART', sp.name);
        if (checkPart && checkPart.hasIssue) {
          issues.push({
            id: `iss-sp-nam-${sp.id}`,
            entityType: 'SPARE_PART',
            recordId: sp.id,
            serialNumber: sp.code || sp.id,
            field: 'name',
            fieldLabel: 'Spare Part Name',
            original: sp.name,
            suggested: checkPart.suggested,
            issueType: checkPart.issueType,
            issueTitle: checkPart.issueTitle,
            itemRef: sp
          });
        }
      }
    });

    // 3. Audit Tools
    tools.forEach(tl => {
      if (tl.name) {
        const checkTool = this.checkCorrection('TOOL', tl.name);
        if (checkTool && checkTool.hasIssue) {
          issues.push({
            id: `iss-tl-nam-${tl.id}`,
            entityType: 'TOOL',
            recordId: tl.id,
            serialNumber: tl.code || tl.id,
            field: 'name',
            fieldLabel: 'Tool Name',
            original: tl.name,
            suggested: checkTool.suggested,
            issueType: checkTool.issueType,
            issueTitle: checkTool.issueTitle,
            itemRef: tl
          });
        }
      }
    });

    return {
      totalRecordsScanned: machines.length + spareParts.length + tools.length,
      totalIssuesFound: issues.length,
      issues
    };
  }

  /**
   * Fixes a single detected issue on a database record
   */
  fixRecordIssue(issue) {
    if (!issue || !issue.entityType || !issue.recordId) return false;

    if (issue.entityType === 'MACHINE') {
      const machine = storage.getItem(TABLE_NAMES.MACHINES, issue.recordId);
      if (machine) {
        machine[issue.field] = issue.suggested;
        machine.updatedAt = new Date().toISOString();
        storage.update(TABLE_NAMES.MACHINES, machine.id, machine);
      }
    } else if (issue.entityType === 'SPARE_PART') {
      const part = storage.getItem(TABLE_NAMES.SPARE_PARTS_MASTER, issue.recordId);
      if (part) {
        part[issue.field] = issue.suggested;
        part.updatedAt = new Date().toISOString();
        storage.update(TABLE_NAMES.SPARE_PARTS_MASTER, part.id, part);
      }
    } else if (issue.entityType === 'TOOL') {
      const tool = storage.getItem(TABLE_NAMES.TOOLS_MASTER, issue.recordId);
      if (tool) {
        tool[issue.field] = issue.suggested;
        tool.updatedAt = new Date().toISOString();
        storage.update(TABLE_NAMES.TOOLS_MASTER, tool.id, tool);
      }
    }

    storage.rebuildAllIndexes();
    state.emit('inventory:updated');
    return true;
  }

  /**
   * Fixes all detected issues across the ERP in 1 click
   */
  fixAllIssues(issuesList) {
    if (!Array.isArray(issuesList) || issuesList.length === 0) return 0;
    let fixedCount = 0;

    issuesList.forEach(issue => {
      if (this.fixRecordIssue(issue)) {
        fixedCount++;
      }
    });

    storage.saveTable(TABLE_NAMES.MACHINES);
    storage.saveTable(TABLE_NAMES.SPARE_PARTS_MASTER);
    storage.saveTable(TABLE_NAMES.TOOLS_MASTER);
    storage.rebuildAllIndexes();
    state.emit('inventory:updated');

    auditService.log(
      'STORAGE_BATCH_AUTOCORRECT',
      `Auto-corrected ${fixedCount} data anomalies across machines, spare parts, and tools.`,
      { fixedCount }
    );

    return fixedCount;
  }

  // ==========================================
  // 8. Bulk Multiline Text Import & Excel Importer
  // ==========================================

  // ==========================================
  // 8. Pre-Import Quality Gate & Verification Studio
  // ==========================================

  /**
   * Pre-validates rows from Excel, CSV, or text paste before committing to Main Data.
   * Guarantees that only 100% correct data is entered into Master Reference Storage.
   */
  stageAndValidateImport(category, rawInput) {
    let rows = [];
    if (typeof rawInput === 'string') {
      const lines = rawInput.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
      rows = lines.map(line => {
        let parts = line.split('|');
        if (parts.length === 1) parts = line.split('\t');
        if (parts.length === 1 && line.includes(',')) parts = line.split(',');
        return parts.map(p => p.trim());
      });
    } else if (Array.isArray(rawInput)) {
      rows = rawInput;
    }

    const fields = storageSchemaService.getCategoryFields(category);
    const existingItems = this.getStorageItems(category);
    const stagedRows = [];
    const seenBatchKeys = new Set();

    rows.forEach((cols, idx) => {
      if (!cols || cols.length === 0 || cols.every(c => !c || String(c).trim() === '')) return;

      const rowData = { category };
      // Map columns in sequence to schema fields
      fields.forEach((f, cIdx) => {
        if (cols[cIdx] !== undefined) {
          rowData[f.key] = String(cols[cIdx]).trim();
        }
      });

      // Derive fallback fields only for single-column quick paste (e.g. just a model pasted)
      if (category === 'MACHINE' && cols.length === 1 && cols[0]) {
        rowData.model = cols[0];
        rowData.machineName = 'Sewing Machine';
        rowData.brand = 'JUKI';
      }

      const issues = [];
      const autoFixes = [];

      // 1. Mandatory Field Check
      fields.filter(f => f.required).forEach(f => {
        const val = rowData[f.key];
        if (!val || String(val).trim() === '') {
          issues.push({
            severity: 'FATAL',
            field: f.key,
            fieldLabel: f.label,
            message: `Missing mandatory ${f.label}`
          });
        }
      });

      // 2. Duplicate Detection (Batch & Existing DB)
      const primaryKey = category === 'MACHINE' ? 'model' : (category === 'LOCATION' ? 'lineName' : 'code');
      const primaryVal = rowData[primaryKey] ? this.normalizePureAlphanumeric(rowData[primaryKey]) : '';

      if (primaryVal) {
        if (seenBatchKeys.has(primaryVal)) {
          issues.push({
            severity: 'FATAL',
            field: primaryKey,
            fieldLabel: fields.find(f => f.key === primaryKey)?.label || primaryKey,
            message: `Duplicate in import spreadsheet: "${rowData[primaryKey]}"`
          });
        } else {
          seenBatchKeys.add(primaryVal);
        }

        const dbDup = existingItems.find(it => {
          const itVal = it[primaryKey] ? this.normalizePureAlphanumeric(it[primaryKey]) : '';
          return itVal && itVal === primaryVal;
        });
        if (dbDup) {
          issues.push({
            severity: 'FATAL',
            field: primaryKey,
            fieldLabel: fields.find(f => f.key === primaryKey)?.label || primaryKey,
            message: `Already exists in Master Data: "${rowData[primaryKey]}"`
          });
        }
      }

      // 3. Auto-Correction & Cross-Reference Check (Fixable Casing, Formatting, Typos, Mismatches)
      if (category === 'MACHINE') {
        // Intelligent Model-Machine Cross-Referencing
        if (rowData.model) {
          const modelNorm = this.normalizePureAlphanumeric(rowData.model);
          const masterMatch = existingItems.find(it => 
            it.model && this.normalizePureAlphanumeric(it.model) === modelNorm
          );

          if (masterMatch) {
            // Verify if machineName matches canonical Master Machine Name
            const currentMnNorm = this.normalizePureAlphanumeric(rowData.machineName || '');
            const masterMnNorm = this.normalizePureAlphanumeric(masterMatch.machineName || '');

            if (!rowData.machineName || (currentMnNorm && currentMnNorm !== masterMnNorm)) {
              autoFixes.push({
                field: 'machineName',
                fieldLabel: 'Machine Name',
                original: rowData.machineName || '(empty)',
                suggested: masterMatch.machineName,
                issueTitle: `Model "${rowData.model}" is mapped under "${masterMatch.machineName}"`
              });
            }

            // Verify if brand matches canonical Master Brand
            if (masterMatch.brand) {
              const currentBrdNorm = this.normalizePureAlphanumeric(rowData.brand || '');
              const masterBrdNorm = this.normalizePureAlphanumeric(masterMatch.brand);
              if (!rowData.brand || (currentBrdNorm && currentBrdNorm !== masterBrdNorm)) {
                autoFixes.push({
                  field: 'brand',
                  fieldLabel: 'Brand',
                  original: rowData.brand || '(empty)',
                  suggested: masterMatch.brand,
                  issueTitle: `Canonical brand for "${rowData.model}" is "${masterMatch.brand}"`
                });
              }
            }
          }
        }

        if (rowData.brand && !autoFixes.some(f => f.field === 'brand')) {
          const brandCheck = this.checkCorrection('BRAND', rowData.brand);
          if (brandCheck && brandCheck.hasIssue) {
            autoFixes.push({
              field: 'brand',
              fieldLabel: 'Brand',
              original: rowData.brand,
              suggested: brandCheck.suggested,
              issueTitle: brandCheck.issueTitle
            });
          }
        }
        if (rowData.model && !autoFixes.some(f => f.field === 'model')) {
          const modelCheck = this.checkCorrection('MODEL', rowData.model);
          if (modelCheck && modelCheck.hasIssue) {
            autoFixes.push({
              field: 'model',
              fieldLabel: 'Model Number',
              original: rowData.model,
              suggested: modelCheck.suggested,
              issueTitle: modelCheck.issueTitle
            });
          }
        }
      } else if (category === 'SPARE_PART' && rowData.name) {
        const partCheck = this.checkCorrection('SPARE_PART', rowData.name);
        if (partCheck && partCheck.hasIssue) {
          autoFixes.push({
            field: 'name',
            fieldLabel: 'Part Name',
            original: rowData.name,
            suggested: partCheck.suggested,
            issueTitle: partCheck.issueTitle
          });
        }
      }

      // Classify Row Status
      const hasFatal = issues.some(i => i.severity === 'FATAL');
      const hasFixable = autoFixes.length > 0;

      let status = 'READY';
      if (hasFatal) status = 'FATAL';
      else if (hasFixable) status = 'WARNING';

      stagedRows.push({
        rowId: `stg-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
        rowNum: idx + 1,
        status,
        data: rowData,
        issues,
        autoFixes
      });
    });

    const readyCount = stagedRows.filter(r => r.status === 'READY').length;
    const warningCount = stagedRows.filter(r => r.status === 'WARNING').length;
    const fatalCount = stagedRows.filter(r => r.status === 'FATAL').length;

    return {
      category,
      stagedRows,
      totalCount: stagedRows.length,
      readyCount,
      warningCount,
      fatalCount,
      canCommit: fatalCount === 0 && (readyCount + warningCount) > 0
    };
  }

  /**
   * Applies auto-fixes to a single staged row in memory
   */
  autoFixStagedRow(stagedRow) {
    if (!stagedRow || !stagedRow.autoFixes) return stagedRow;
    stagedRow.autoFixes.forEach(fix => {
      stagedRow.data[fix.field] = fix.suggested;
    });
    stagedRow.autoFixes = [];
    if (!stagedRow.issues.some(i => i.severity === 'FATAL')) {
      stagedRow.status = 'READY';
    }
    return stagedRow;
  }

  /**
   * Batch auto-fixes all staged warning rows
   */
  autoFixAllStagedRows(stagedRows) {
    if (!Array.isArray(stagedRows)) return 0;
    let count = 0;
    stagedRows.forEach(r => {
      if (r.status === 'WARNING') {
        this.autoFixStagedRow(r);
        count++;
      }
    });
    return count;
  }

  /**
   * Commits only verified (READY) rows into Master Data Storage
   */
  commitStagedRows(category, stagedRows) {
    if (!Array.isArray(stagedRows)) return { importedCount: 0, skippedCount: 0 };
    const readyRows = stagedRows.filter(r => r.status === 'READY');
    let importedCount = 0;

    readyRows.forEach(r => {
      const item = {
        ...r.data,
        category: category || r.data.category || 'MACHINE',
        status: 'ACTIVE'
      };
      this.addStorageItem(item);
      importedCount++;
    });

    const skippedCount = stagedRows.length - importedCount;
    auditService.log(
      'STORAGE_QUALITY_GATE_IMPORT',
      `Imported ${importedCount} verified pristine records into Master Storage (${category}). Skipped/discarded ${skippedCount} non-conforming rows.`,
      { importedCount, skippedCount }
    );

    return { importedCount, skippedCount };
  }

  // ==========================================
  // 9. Schema-Aware Template Downloader & CSV Export
  // ==========================================

  downloadTemplate(category) {
    const config = storageSchemaService.getTemplateConfig(category);
    const csvContent = '\uFEFF' + config.headers.join(',') + '\n' + config.sample.map(s => `"${s}"`).join(',') + '\n';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = config.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  exportStorageToCSV(category = 'ALL') {
    const items = this.getStorageItems(category);
    if (!items || items.length === 0) {
      alert('No storage records found to export.');
      return;
    }

    const headers = ['ID', 'Category', 'Name / Model', 'Brand', 'Code / Serial', 'Details / Compatible', 'Status'];
    const rows = items.map(it => {
      const name = it.model || it.name || it.lineName || '';
      const brand = it.brand || it.unitName || '';
      const code = it.code || it.serialFormat || it.floorName || '';
      const details = it.compatibleModels || it.description || it.specs || '';
      return [it.id, it.category, `"${name}"`, `"${brand}"`, `"${code}"`, `"${details}"`, it.status].join(',');
    });

    const csvContent = '\uFEFF' + headers.join(',') + '\n' + rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AlMuslim_ERP_StorageMaster_${category}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  /**
   * Bulk Import Machine Names, Brands, and Models from Excel / CSV Data Rows
   * @param {Array<Object>} dataRows - Array of row objects parsed by SheetJS
   * @param {Object} options - { overwriteExisting: boolean }
   * @returns {Promise<Object>} - Summary with created counts: { totalRows, addedMachines, addedBrands, addedModels, updatedModels, errors }
   */
  async bulkImportMachinesFromExcel(dataRows, options = {}) {
    if (!Array.isArray(dataRows) || dataRows.length === 0) {
      throw new Error('No data rows found to import.');
    }

    const overwriteExisting = options.overwriteExisting !== false;
    let mnList = storage.getTable(TABLE_NAMES.MACHINE_NAMES) || [];
    let brdList = storage.getTable(TABLE_NAMES.BRANDS) || [];
    let mdlList = storage.getTable(TABLE_NAMES.MODELS) || [];
    let smList = storage.getTable(TABLE_NAMES.STORAGE_MASTER) || [];

    const existingMachines = this.getStorageItems('MACHINE');
    const existingModelNormMap = new Map();
    existingMachines.forEach(m => {
      const norm = this.normalizePureAlphanumeric(m.model);
      if (norm) existingModelNormMap.set(norm, m);
    });

    const knownBrands = [
      'JUKI', 'BROTHER', 'PEGASUS', 'SIRUBA', 'YAMATO', 'KANSAI', 'KANSAI SPECIAL', 
      'JACK', 'SUNSTAR', 'HASHIMA', 'KM', 'EASTMAN', 'SINGER', 'PFAFF', 'DURKOPP ADLER',
      'TYPICAL', 'ZUSAN', 'BEDOLY', 'MAUSER', 'GOLDEN WHEEL', 'BRUCE', 'HIKARI', 'ZOJE'
    ];

    let addedMachinesCount = 0;
    let addedBrandsCount = 0;
    let addedModelsCount = 0;
    let updatedModelsCount = 0;
    const errors = [];

    const getCell = (row, aliases) => {
      for (const alias of aliases) {
        if (row[alias] !== undefined && row[alias] !== null && String(row[alias]).trim() !== '') {
          return String(row[alias]).trim();
        }
        const lowerAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
        for (const [k, v] of Object.entries(row)) {
          const lowerK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (lowerK === lowerAlias && v !== undefined && v !== null && String(v).trim() !== '') {
            return String(v).trim();
          }
        }
      }
      return '';
    };

    for (let idx = 0; idx < dataRows.length; idx++) {
      const row = dataRows[idx];
      try {
        let machineName = getCell(row, ['Machine Name', 'Machine', 'Machine Type', 'Machinery Name', 'Type', 'Category']);
        let brand = getCell(row, ['Brand', 'Brand Name', 'Make', 'Manufacturer', 'Company']);
        let model = getCell(row, ['Model', 'Model Number', 'Model No', 'Model #', 'Spec', 'Specification']);
        let remarks = getCell(row, ['Remarks', 'Remark', 'Note', 'Description']);

        // Fallbacks: if only 2 or 3 columns exist without standard headers
        if (!machineName && !model) {
          const vals = Object.values(row).map(v => String(v || '').trim()).filter(Boolean);
          if (vals.length >= 3) {
            machineName = vals[0];
            brand = vals[1];
            model = vals[2];
          } else if (vals.length === 2) {
            machineName = vals[0];
            model = vals[1];
          }
        }

        machineName = String(machineName || '').trim();
        brand = String(brand || 'JUKI').trim().toUpperCase();
        model = String(model || '').trim();

        if (!machineName && !model) continue; // Skip completely blank line

        if (!machineName && model) {
          machineName = 'Plane Machine'; // Safe fallback
        }

        // Auto-extract brand from parentheses if model has e.g. "TYPICAL (GC-6720)"
        if (/\(([^)]+)\)/.test(model)) {
          const m = model.match(/^(.*?)\s*\(([^)]+)\)$/);
          if (m) {
            const p1Upper = m[1].trim().toUpperCase();
            const p2Upper = m[2].trim().toUpperCase();
            const matchP1 = knownBrands.find(b => p1Upper === b || p1Upper.startsWith(b + ' '));
            const matchP2 = knownBrands.find(b => p2Upper === b);
            if (matchP1) {
              brand = matchP1;
              model = p1Upper === matchP1 ? m[2].trim() : `${m[1].trim().substring(matchP1.length).trim()} (${m[2].trim()})`;
            } else if (matchP2) {
              brand = matchP2;
              model = m[1].trim();
            }
          }
        }

        // Apply intelligent corrections
        const cleanMachine = this.resolveCanonicalMachineName(machineName) || machineName;
        const brandCheck = this.checkCorrection('BRAND', brand);
        if (brandCheck && brandCheck.hasIssue) {
          brand = brandCheck.suggested;
        }
        const modelCheck = this.checkCorrection('MODEL', model);
        if (modelCheck && modelCheck.hasIssue) {
          model = modelCheck.suggested;
        }

        // 1. Ensure Machine Name is in MACHINE_NAMES table
        let mnItem = mnList.find(m => m && m.name && m.name.toLowerCase() === cleanMachine.toLowerCase());
        if (!mnItem) {
          const maxOrder = mnList.reduce((max, m) => Math.max(max, Number(m.sortOrder || 0)), 0);
          mnItem = storage.insert(TABLE_NAMES.MACHINE_NAMES, {
            id: 'mn-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
            name: cleanMachine,
            code: cleanMachine.substring(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, ''),
            sortOrder: maxOrder + 1,
            status: 'ACTIVE',
            createdAt: new Date().toISOString()
          });
          mnList = storage.getTable(TABLE_NAMES.MACHINE_NAMES) || [];
          addedMachinesCount++;
        }

        // 2. Ensure Brand is in BRANDS table
        let brdItem = brdList.find(b => b && b.name && b.name.toLowerCase() === brand.toLowerCase());
        if (!brdItem) {
          brdItem = storage.insert(TABLE_NAMES.BRANDS, {
            id: 'brd-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
            name: brand,
            country: ['JUKI', 'BROTHER', 'PEGASUS', 'YAMATO', 'HASHIMA', 'KM', 'EASTMAN'].includes(brand) ? 'Japan' : 'International',
            status: 'ACTIVE',
            createdAt: new Date().toISOString()
          });
          brdList = storage.getTable(TABLE_NAMES.BRANDS) || [];
          addedBrandsCount++;
        }

        // If row has no model (e.g. user just imported machine names list), we're done with this row
        if (!model) continue;

        // 3. Process Model in STORAGE_MASTER and MODELS
        const norm = this.normalizePureAlphanumeric(model);
        const existingSmItem = existingModelNormMap.get(norm);

        if (existingSmItem) {
          if (overwriteExisting) {
            storage.update(TABLE_NAMES.STORAGE_MASTER, existingSmItem.id, {
              machineName: cleanMachine,
              brand,
              model,
              remarks: remarks || existingSmItem.remarks || '',
              status: 'ACTIVE',
              updatedAt: new Date().toISOString()
            });
            updatedModelsCount++;
          }
        } else {
          const maxSmOrder = smList.reduce((max, m) => Math.max(max, Number(m.sortOrder || 0)), 0);
          const newSmItem = storage.insert(TABLE_NAMES.STORAGE_MASTER, {
            id: 'sm-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
            category: 'MACHINE',
            machineName: cleanMachine,
            brand,
            model,
            sortOrder: maxSmOrder + 1,
            remarks: remarks || '',
            status: 'ACTIVE',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
          smList = storage.getTable(TABLE_NAMES.STORAGE_MASTER) || [];
          existingModelNormMap.set(norm, newSmItem);
          addedModelsCount++;
        }

        // 4. Also synchronize into MODELS table for Inventory/Reports
        let mdlItem = mdlList.find(m => 
          m && m.name && m.name.toLowerCase() === model.toLowerCase() &&
          (m.machineNameId === mnItem?.id || (m.machineName && m.machineName.toLowerCase() === cleanMachine.toLowerCase()))
        );
        if (mdlItem) {
          if (overwriteExisting) {
            storage.update(TABLE_NAMES.MODELS, mdlItem.id, {
              brandId: brdItem?.id || mdlItem.brandId,
              brandName: brand,
              machineNameId: mnItem?.id || mdlItem.machineNameId,
              machineName: cleanMachine,
              description: remarks || `${brand} ${model} under ${cleanMachine}`,
              status: 'ACTIVE'
            });
          }
        } else {
          const maxMdlOrder = mdlList.reduce((max, m) => Math.max(max, Number(m.sortOrder || 0)), 0);
          storage.insert(TABLE_NAMES.MODELS, {
            id: 'mdl-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
            name: model,
            brandId: brdItem?.id || '',
            brandName: brand,
            machineNameId: mnItem?.id || '',
            machineName: cleanMachine,
            sortOrder: maxMdlOrder + 1,
            description: remarks || `${brand} ${model} under ${cleanMachine}`,
            status: 'ACTIVE',
            createdAt: new Date().toISOString()
          });
          mdlList = storage.getTable(TABLE_NAMES.MODELS) || [];
        }
      } catch (rowErr) {
        errors.push(`Row ${idx + 1}: ${rowErr.message}`);
      }
    }

    // High-capacity IndexedDB write & MySQL Confirmed Save
    try {
      const { idbCache } = await import('../db/idbCache.js');
      await idbCache.setTable(TABLE_NAMES.STORAGE_MASTER, storage.getTable(TABLE_NAMES.STORAGE_MASTER));
      await idbCache.setTable(TABLE_NAMES.MACHINE_NAMES, storage.getTable(TABLE_NAMES.MACHINE_NAMES));
      await idbCache.setTable(TABLE_NAMES.BRANDS, storage.getTable(TABLE_NAMES.BRANDS));
      await idbCache.setTable(TABLE_NAMES.MODELS, storage.getTable(TABLE_NAMES.MODELS));
    } catch (_) {}

    await storage.saveTable(TABLE_NAMES.STORAGE_MASTER, true);
    await storage.saveTable(TABLE_NAMES.MACHINE_NAMES, true);
    await storage.saveTable(TABLE_NAMES.BRANDS, true);
    await storage.saveTable(TABLE_NAMES.MODELS, true);

    if (typeof storage.persistToServerDatabase === 'function') {
      try {
        await storage.persistToServerDatabase();
      } catch (_) {}
    }

    this._broadcastStorageChange();

    try {
      auditService.log({
        action: 'EXCEL_IMPORT_MACHINES_BRANDS_MODELS',
        details: `Imported ${addedModelsCount} new models, ${addedMachinesCount} new machines, ${addedBrandsCount} new brands via Excel`,
        targetId: 'EXCEL_MASTER_IMPORT'
      });
    } catch (_) {}

    return {
      totalRows: dataRows.length,
      addedMachines: addedMachinesCount,
      addedBrands: addedBrandsCount,
      addedModels: addedModelsCount,
      updatedModels: updatedModelsCount,
      errors
    };
  }

  /**
   * Export all Machine Names, Brands, and Models to an Excel (.xlsx) file
   */
  exportMachinesToExcel() {
    if (typeof XLSX === 'undefined') {
      throw new Error('SheetJS (XLSX) library is not loaded. Please check your internet connection.');
    }

    const allMachines = this.getStorageItems('MACHINE');
    const mnList = storage.getTable(TABLE_NAMES.MACHINE_NAMES) || [];
    
    // Sort machine names in order
    const sortedMnList = [...mnList].sort((a, b) => (Number(a.sortOrder) || 9999) - (Number(b.sortOrder) || 9999));
    
    const exportRows = [];
    let sl = 1;

    // First, export registered models grouped by machine name
    const grouped = new Map();
    allMachines.forEach(item => {
      const mn = item.machineName || 'Unassigned Machine';
      if (!grouped.has(mn)) grouped.set(mn, []);
      grouped.get(mn).push(item);
    });

    // Output according to machine name sort order
    sortedMnList.forEach(mn => {
      const mName = mn.name;
      const models = grouped.get(mName) || [];
      if (models.length > 0) {
        models.forEach(mod => {
          exportRows.push({
            'Sl No': sl++,
            'Machine Name': mName,
            'Brand': mod.brand || 'JUKI',
            'Model': mod.model || '',
            'Remarks': mod.remarks || ''
          });
        });
      } else {
        // Machine name with no models yet
        exportRows.push({
          'Sl No': sl++,
          'Machine Name': mName,
          'Brand': '',
          'Model': '',
          'Remarks': 'Registered Machine Type'
        });
      }
      grouped.delete(mName);
    });

    // Any remaining machines
    for (const [mName, models] of grouped.entries()) {
      models.forEach(mod => {
        exportRows.push({
          'Sl No': sl++,
          'Machine Name': mName,
          'Brand': mod.brand || 'JUKI',
          'Model': mod.model || '',
          'Remarks': mod.remarks || ''
        });
      });
    }

    if (exportRows.length === 0) {
      exportRows.push({
        'Sl No': 1,
        'Machine Name': 'Plane Machine',
        'Brand': 'JUKI',
        'Model': 'DDL-8700',
        'Remarks': 'Sample'
      });
    }

    const ws = XLSX.utils.json_to_sheet(exportRows);
    ws['!cols'] = [
      { wch: 8 },  // Sl No
      { wch: 30 }, // Machine Name
      { wch: 18 }, // Brand
      { wch: 25 }, // Model
      { wch: 35 }  // Remarks
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Machines_Brands_Models');

    const dateStr = new Date().toISOString().split('T')[0];
    const fileName = `Al_Muslim_ERP_Machine_Brand_Model_Master_${dateStr}.xlsx`;
    XLSX.writeFile(wb, fileName);
    return { success: true, totalExported: exportRows.length, fileName };
  }

  /**
   * Download a clean Excel template with sample Machine Name, Brand, and Model rows
   */
  downloadMachineImportTemplate() {
    if (typeof XLSX === 'undefined') {
      throw new Error('SheetJS (XLSX) library is not loaded.');
    }

    const templateData = [
      { 'Sl No': 1, 'Machine Name': 'Plane Machine', 'Brand': 'JUKI', 'Model': 'DDL-8700', 'Remarks': 'Single Needle High Speed Lockstitch' },
      { 'Sl No': 2, 'Machine Name': 'Plane Machine', 'Brand': 'JUKI', 'Model': 'DDL-9000C', 'Remarks': 'Direct-Drive Computerized Lockstitch' },
      { 'Sl No': 3, 'Machine Name': 'Plane Machine', 'Brand': 'BROTHER', 'Model': 'S-7200C', 'Remarks': 'Direct Drive Electronic Lockstitch' },
      { 'Sl No': 4, 'Machine Name': 'Plane Machine', 'Brand': 'JACK', 'Model': 'A4', 'Remarks': 'Computerized Lockstitch Machine' },
      { 'Sl No': 5, 'Machine Name': 'Overlock Machine', 'Brand': 'PEGASUS', 'Model': 'M952-52', 'Remarks': '4-Thread High Speed Overlock' },
      { 'Sl No': 6, 'Machine Name': 'Overlock Machine', 'Brand': 'JUKI', 'Model': 'MO-6814S', 'Remarks': '4-Thread Super High Speed Overlock' },
      { 'Sl No': 7, 'Machine Name': 'Overlock Machine', 'Brand': 'SIRUBA', 'Model': '747K-514M2-24', 'Remarks': 'High Speed Overlock Machine' },
      { 'Sl No': 8, 'Machine Name': 'Vertical Machine', 'Brand': 'BEDOLY', 'Model': 'BD-801', 'Remarks': 'Vertical Machine Heavy Duty' },
      { 'Sl No': 9, 'Machine Name': 'Button Hole Machine', 'Brand': 'JUKI', 'Model': 'LBH-1790', 'Remarks': 'Computer Controlled Buttonhole' },
      { 'Sl No': 10, 'Machine Name': 'Button Attach Machine', 'Brand': 'JUKI', 'Model': 'MB-1377', 'Remarks': 'Single Thread Chainstitch Button Sew' },
      { 'Sl No': 11, 'Machine Name': 'Bar Tack Machine', 'Brand': 'JUKI', 'Model': 'LK-1900', 'Remarks': 'Computer Controlled Bartacking' },
      { 'Sl No': 12, 'Machine Name': 'Feed of The Arm Machine', 'Brand': 'BROTHER', 'Model': 'DA-9270', 'Remarks': '3-Needle Feed of the Arm Machine' },
      { 'Sl No': 13, 'Machine Name': 'Double Needle Machine', 'Brand': 'JUKI', 'Model': 'LH-3568', 'Remarks': '2-Needle Semi-Dry Head Lockstitch' }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    ws['!cols'] = [
      { wch: 8 },  // Sl No
      { wch: 28 }, // Machine Name
      { wch: 16 }, // Brand
      { wch: 22 }, // Model
      { wch: 42 }  // Remarks
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Import_Template');

    XLSX.writeFile(wb, 'Machine_Brand_Model_Excel_Import_Template.xlsx');
    return true;
  }

  _broadcastStorageChange() {
    window.dispatchEvent(new CustomEvent('erp:storage-updated'));
    try {
      state.emit('storage:updated');
    } catch (_) {}
  }
}

export const smartStorageService = new SmartStorageService();
if (typeof window !== 'undefined') {
  window.smartStorageService = smartStorageService;
}

