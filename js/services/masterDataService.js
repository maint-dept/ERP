/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Enterprise Master Data Service & 7-Level Cascading Hierarchy Engine
 * Hierarchy: Group -> Unit/Factory -> Floor -> Line -> Machine Name -> Brand -> Model
 */

import { storage } from '../db/storage.js';
import { CloudSaveError } from '../db/storage.js';
import { TABLE_NAMES } from '../db/schema.js';
import { INITIAL_DATA } from '../db/initialData.js';
import { authService } from './authService.js';
import { auditService } from './auditService.js';
import { state } from '../state.js';

export const KNOWN_NAMED_SECTIONS = {
  'cutting': 'Cutting',
  'finishing': 'Finishing',
  'sample': 'Sample',
  'idle': 'Idle',
  'size set': 'Size Set',
  'sizeset': 'Size Set',
  'size-set': 'Size Set',
  'eyelet & apw room': 'Eyelet & APW Room',
  'eyelet & apw': 'Eyelet & APW Room',
  'eyelet and apw room': 'Eyelet & APW Room',
  'eyelet and apw': 'Eyelet & APW Room',
  'eyelet/apw': 'Eyelet & APW Room',
  'eyelet / apw': 'Eyelet & APW Room',
  'eyelet-apw': 'Eyelet & APW Room',
  'eyelet-apw room': 'Eyelet & APW Room',
  'eyelet': 'Eyelet & APW Room',
  'apw room': 'Eyelet & APW Room',
  'apw': 'Eyelet & APW Room'
};

/**
 * Standard Garments Factory Production Line Sequence:
 * A -> N, P (skips O), Q -> Z, Size Set, Eyelet & APW Room
 */
export const FACTORY_STANDARD_LINES = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'P',
  'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
  'Size Set',
  'Eyelet & APW Room'
];

export function getLineSequenceWeight(lineName) {
  if (!lineName) return 999;
  const clean = String(lineName).replace(/^[A-Za-z0-9]+-/, '').trim();
  const upper = clean.toUpperCase();

  // Primary Standard Garments Line Sequence: A -> N, P (skipping O)
  const standardAlphabet = [
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'P',
    'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'
  ];
  const alphaIdx = standardAlphabet.indexOf(upper);
  if (alphaIdx !== -1) {
    return alphaIdx + 1; // 1 to 25
  }

  // If letter 'O' exists, place it after N (14.5)
  if (upper === 'O') return 14.5;

  // Single letters fallback
  if (/^[A-Z]$/.test(upper)) {
    return 50 + (upper.charCodeAt(0) - 65);
  }

  // Size Set and Eyelet & APW Room come immediately after alphabet lines
  if (upper === 'SIZE SET' || upper === 'SIZESET' || upper === 'SIZE-SET') {
    return 100;
  }
  if (upper.includes('EYELET') || upper.includes('APW')) {
    return 101;
  }

  // Other named process sections
  if (upper === 'CUTTING') return 110;
  if (upper === 'FINISHING') return 111;
  if (upper === 'SAMPLE') return 112;
  if (upper === 'IDLE') return 113;

  // Numeric lines fallback
  const numMatch = clean.match(/^(\d+)$/);
  if (numMatch) {
    return 200 + parseInt(numMatch[1], 10);
  }

  return 300;
}

export function sortLinesByStandardSequence(lines) {
  if (!Array.isArray(lines)) return [];
  return [...lines].sort((a, b) => {
    // If lines belong to different floors, group by floor
    if (a.floorId && b.floorId && a.floorId !== b.floorId) {
      return (a.floorId || '').localeCompare(b.floorId || '');
    }
    const wA = getLineSequenceWeight(a.name || a.code);
    const wB = getLineSequenceWeight(b.name || b.code);
    if (wA !== wB) return wA - wB;
    return (a.name || '').localeCompare(b.name || '');
  });
}

export function formatLineName(raw, floorCode) {
  let trimmed = (raw || '').trim();
  if (/(?:^|-)\d+$/.test(trimmed)) {
    throw new Error(`Numeric line values (e.g. "${raw}") are strictly not allowed. Line names must be alphabetic or standard process sections (e.g. A to Z, Cutting, Finishing, Size Set, Eyelet & APW Room).`);
  }

  let letterMatch = trimmed.match(/^(?:LINE[-_ ]*)?([A-Za-z])$/i);
  if (letterMatch) {
    return `${floorCode}-${letterMatch[1].toUpperCase()}`;
  }

  if (trimmed.toUpperCase().startsWith(`${floorCode}-`)) {
    const rest = trimmed.substring(floorCode.length + 1).trim();
    const mappedRest = KNOWN_NAMED_SECTIONS[rest.toLowerCase()];
    return `${floorCode}-${mappedRest || (rest.length === 1 ? rest.toUpperCase() : rest)}`;
  }

  const mapped = KNOWN_NAMED_SECTIONS[trimmed.toLowerCase()];
  if (mapped) {
    return `${floorCode}-${mapped}`;
  }

  const formatted = trimmed.length === 1 ? trimmed.toUpperCase() : (trimmed.charAt(0).toUpperCase() + trimmed.slice(1));
  return `${floorCode}-${formatted}`;
}

class MasterDataService {
  constructor() {
    setTimeout(() => {
      try {
        this.syncMachinesHierarchy(false);
      } catch (_) {}
    }, 150);
  }

  // ==========================================
  // 1. CASCADING QUERY METHODS (STATUS-AWARE)
  // ==========================================

  /**
   * Level 1: Groups
   */
  getGroups(includeInactive = false) {
    const allGroups = storage.getTable(TABLE_NAMES.GROUPS) || [];
    if (allGroups.some(g => g.id === 'grp-2' || (g.name && g.name.toUpperCase().includes('ABC')))) {
      this.cleanAndSyncAlMuslimHierarchy();
    }
    const list = storage.getTable(TABLE_NAMES.GROUPS) || [];
    return includeInactive ? list : list.filter(g => g.status === 'ACTIVE');
  }

  getGroupById(id) {
    return storage.getItem(TABLE_NAMES.GROUPS, id);
  }

  /**
   * Level 2: Units / Factories (Filtered by Group & Location Scope)
   */
  getUnits(groupId = null, includeInactive = false, ignoreScope = false) {
    let list = storage.getTable(TABLE_NAMES.UNITS) || [];
    if (!includeInactive) {
      list = list.filter(u => u.status === 'ACTIVE');
    }
    if (groupId) {
      list = list.filter(u => u.groupId === groupId);
    }
    if (!ignoreScope && !includeInactive) {
      const scoped = authService.getScopedFilter();
      if (scoped && Array.isArray(scoped.unitIds) && scoped.unitIds.length > 0) {
        list = list.filter(u => scoped.unitIds.includes(u.id));
      }
    }
    return list;
  }

  getUnitById(id) {
    return storage.getItem(TABLE_NAMES.UNITS, id);
  }

  /**
   * Level 3: Floors (Filtered by Unit, Group & Location Scope)
   */
  getFloors(unitId = null, groupId = null, includeInactive = false, ignoreScope = false) {
    let list = storage.getTable(TABLE_NAMES.FLOORS) || [];
    if (!includeInactive) {
      list = list.filter(f => f.status === 'ACTIVE');
    }

    if (unitId) {
      list = list.filter(f => f.unitId === unitId);
    } else if (groupId) {
      const groupUnitIds = new Set(this.getUnits(groupId, includeInactive, true).map(u => u.id));
      list = list.filter(f => groupUnitIds.has(f.unitId));
    }

    if (!ignoreScope && !includeInactive) {
      const scoped = authService.getScopedFilter();
      if (scoped) {
        if (Array.isArray(scoped.unitIds) && scoped.unitIds.length > 0) {
          list = list.filter(f => scoped.unitIds.includes(f.unitId));
        }
        if (Array.isArray(scoped.floorIds) && scoped.floorIds.length > 0) {
          list = list.filter(f => scoped.floorIds.includes(f.id));
        }
      }
    }

    return list;
  }

  getFloorById(id) {
    return storage.getItem(TABLE_NAMES.FLOORS, id);
  }

  /**
   * Level 4: Lines (Filtered by Floor, Unit, Group & Location Scope)
   */
  getLines(floorId = null, unitId = null, groupId = null, includeInactive = false, ignoreScope = false) {
    let list = storage.getTable(TABLE_NAMES.LINES) || [];
    if (list.some(l => /(?:^|-)\d+$/.test(l.name))) {
      this.cleanAndSyncAlMuslimHierarchy();
      list = storage.getTable(TABLE_NAMES.LINES) || [];
    }
    if (!includeInactive) {
      list = list.filter(l => l.status === 'ACTIVE');
    }

    let result = list;
    if (floorId) {
      result = list.filter(l => l.floorId === floorId);
    } else if (unitId) {
      const unitFloorIds = new Set(this.getFloors(unitId, null, includeInactive, true).map(f => f.id));
      result = list.filter(l => unitFloorIds.has(l.floorId));
    } else if (groupId) {
      const groupFloorIds = new Set(this.getFloors(null, groupId, includeInactive, true).map(f => f.id));
      result = list.filter(l => groupFloorIds.has(l.floorId));
    }

    if (!ignoreScope && !includeInactive) {
      const scoped = authService.getScopedFilter();
      if (scoped) {
        if (Array.isArray(scoped.floorIds) && scoped.floorIds.length > 0) {
          result = result.filter(l => scoped.floorIds.includes(l.floorId));
        }
        if (Array.isArray(scoped.lineIds) && scoped.lineIds.length > 0) {
          result = result.filter(l => scoped.lineIds.includes(l.id));
        }
      }
    }

    return sortLinesByStandardSequence(result);
  }

  getLineById(id) {
    return storage.getItem(TABLE_NAMES.LINES, id);
  }

  // Location Scoping helpers
  getScopedUnits(groupId = null) {
    return this.getUnits(groupId, false, false);
  }

  getScopedFloors(unitId = null, groupId = null) {
    return this.getFloors(unitId, groupId, false, false);
  }

  getScopedLines(floorId = null, unitId = null, groupId = null) {
    return this.getLines(floorId, unitId, groupId, false, false);
  }

  getAllUnits(groupId = null, includeInactive = true) {
    return this.getUnits(groupId, includeInactive, true);
  }

  getAllFloors(unitId = null, groupId = null, includeInactive = true) {
    return this.getFloors(unitId, groupId, includeInactive, true);
  }

  getAllLines(floorId = null, unitId = null, groupId = null, includeInactive = true) {
    return this.getLines(floorId, unitId, groupId, includeInactive, true);
  }

  /**
   * Constructs full breadcrumb location path string (Group > Unit > Floor > Line)
   */
  getFullLocationPath(unitId, floorId, lineId, groupId = null) {
    let groupName = '';
    if (groupId) {
      groupName = this.getGroupById(groupId)?.name || '';
    } else if (unitId) {
      const unit = this.getUnitById(unitId);
      if (unit?.groupId) {
        groupName = this.getGroupById(unit.groupId)?.name || '';
      }
    }

    const unitName = this.getUnitById(unitId)?.name || '';
    const floorName = this.getFloorById(floorId)?.name || '';
    const lineName = this.getLineById(lineId)?.name || '';

    const parts = [groupName, unitName, floorName, lineName].filter(Boolean);
    return parts.length > 0 ? parts.join(' > ') : 'Unknown Location';
  }

  /**
   * Level 5: Machine Names / Types
   */
  getMachineNames(categoryId = null, lineId = null, includeInactive = false) {
    let list = storage.getTable(TABLE_NAMES.MACHINE_NAMES) || [];
    if (list.length === 0 && typeof INITIAL_DATA !== 'undefined' && Array.isArray(INITIAL_DATA.machine_names)) {
      list = INITIAL_DATA.machine_names;
    }
    if (!includeInactive) {
      list = list.filter(m => m.status === 'ACTIVE');
    }
    if (categoryId) {
      list = list.filter(m => m.categoryId === categoryId);
    }
    if (lineId) {
      const machinesOnLine = (storage.getTable(TABLE_NAMES.MACHINES) || []).filter(m => m.lineId === lineId);
      const usedMnIds = new Set(machinesOnLine.map(m => m.machineNameId));
      if (usedMnIds.size > 0) {
        return list.filter(m => usedMnIds.has(m.id));
      }
    }
    return list;
  }

  getMachineNameById(id) {
    if (!id) return null;
    let found = storage.getItem(TABLE_NAMES.MACHINE_NAMES, id);
    if (!found && typeof INITIAL_DATA !== 'undefined' && Array.isArray(INITIAL_DATA.machine_names)) {
      found = INITIAL_DATA.machine_names.find(m => m.id === id);
    }
    return found || null;
  }

  /**
   * Level 6: Brands (Filtered by Machine Name)
   */
  getBrands(includeInactive = false) {
    let list = storage.getTable(TABLE_NAMES.BRANDS) || [];
    if (list.length === 0 && typeof INITIAL_DATA !== 'undefined' && Array.isArray(INITIAL_DATA.brands)) {
      list = INITIAL_DATA.brands;
    }
    return includeInactive ? list : list.filter(b => b.status === 'ACTIVE');
  }

  getBrandById(id) {
    if (!id) return null;
    let found = storage.getItem(TABLE_NAMES.BRANDS, id);
    if (!found && typeof INITIAL_DATA !== 'undefined' && Array.isArray(INITIAL_DATA.brands)) {
      found = INITIAL_DATA.brands.find(b => b.id === id);
    }
    return found || null;
  }

  getBrandsForMachineName(machineNameId = null, includeInactive = false) {
    const allBrands = this.getBrands(includeInactive);
    if (!machineNameId) return allBrands;

    let models = storage.getTable(TABLE_NAMES.MODELS) || [];
    if (models.length === 0 && typeof INITIAL_DATA !== 'undefined' && Array.isArray(INITIAL_DATA.models)) {
      models = INITIAL_DATA.models;
    }
    const filteredModels = models.filter(m => {
      const matchMn = m.machineNameId === machineNameId;
      return includeInactive ? matchMn : (matchMn && m.status === 'ACTIVE');
    });

    const brandIds = new Set(filteredModels.map(m => m.brandId));
    const matched = allBrands.filter(b => brandIds.has(b.id));
    return matched.length > 0 ? matched : allBrands;
  }

  /**
   * Level 7: Models (Filtered by Machine Name and Brand)
   */
  getModels(brandId = null, machineNameId = null, includeInactive = false) {
    let list = storage.getTable(TABLE_NAMES.MODELS) || [];
    if (list.length === 0 && typeof INITIAL_DATA !== 'undefined' && Array.isArray(INITIAL_DATA.models)) {
      list = INITIAL_DATA.models;
    }
    if (!includeInactive) {
      list = list.filter(m => m.status === 'ACTIVE');
    }
    if (brandId) {
      list = list.filter(m => m.brandId === brandId);
    }
    if (machineNameId) {
      list = list.filter(m => m.machineNameId === machineNameId);
    }
    return list;
  }

  getModelById(id) {
    if (!id) return null;
    let found = storage.getItem(TABLE_NAMES.MODELS, id);
    if (!found && typeof INITIAL_DATA !== 'undefined' && Array.isArray(INITIAL_DATA.models)) {
      found = INITIAL_DATA.models.find(m => m.id === id);
    }
    return found || null;
  }

  getCategories(includeInactive = false) {
    const list = storage.getTable(TABLE_NAMES.CATEGORIES) || [];
    return includeInactive ? list : list.filter(c => c.status === 'ACTIVE');
  }

  // ==========================================
  // 2. COMPLETE HIERARCHY TREE
  // ==========================================
  getHierarchyTree() {
    const groups = this.getGroups(true);
    const units = storage.getTable(TABLE_NAMES.UNITS) || [];
    const floors = storage.getTable(TABLE_NAMES.FLOORS) || [];
    const lines = storage.getTable(TABLE_NAMES.LINES) || [];
    const machines = storage.getTable(TABLE_NAMES.MACHINES) || [];

    return groups.map(grp => {
      const grpUnits = units.filter(u => u.groupId === grp.id);
      return {
        ...grp,
        unitsCount: grpUnits.length,
        units: grpUnits.map(unt => {
          const untFloors = floors.filter(f => f.unitId === unt.id);
          return {
            ...unt,
            floorsCount: untFloors.length,
            floors: untFloors.map(flr => {
              const flrLines = lines.filter(l => l.floorId === flr.id);
              return {
                ...flr,
                linesCount: flrLines.length,
                lines: flrLines.map(lin => {
                  const lineMachines = machines.filter(m => m.lineId === lin.id);
                  return {
                    ...lin,
                    machineCount: lineMachines.length
                  };
                })
              };
            })
          };
        })
      };
    });
  }

  getEquipmentTree() {
    const categories = this.getCategories(true);
    const machineNames = storage.getTable(TABLE_NAMES.MACHINE_NAMES) || [];
    const brands = storage.getTable(TABLE_NAMES.BRANDS) || [];
    const models = storage.getTable(TABLE_NAMES.MODELS) || [];
    const machines = storage.getTable(TABLE_NAMES.MACHINES) || [];

    return categories.map(cat => {
      const catMNs = machineNames.filter(mn => mn.categoryId === cat.id);
      return {
        ...cat,
        machineNamesCount: catMNs.length,
        machineNames: catMNs.map(mn => {
          const mnModels = models.filter(mdl => mdl.machineNameId === mn.id);
          const brandIds = Array.from(new Set(mnModels.map(m => m.brandId)));
          const mnBrands = brands.filter(b => brandIds.includes(b.id));

          return {
            ...mn,
            machineCount: machines.filter(mc => mc.machineNameId === mn.id).length,
            brands: mnBrands.map(brd => {
              const brdModels = mnModels.filter(mdl => mdl.brandId === brd.id);
              return {
                ...brd,
                models: brdModels.map(mdl => ({
                  ...mdl,
                  machineCount: machines.filter(mc => mc.modelId === mdl.id).length
                }))
              };
            })
          };
        })
      };
    });
  }

  // ==========================================
  // 3. SAFE DEPENDENCY CHECKER
  // ==========================================
  checkDependencies(type, id) {
    const machines = storage.getTable(TABLE_NAMES.MACHINES) || [];
    let childCount = 0;
    let childType = '';
    let machineCount = 0;
    let details = [];

    switch (type) {
      case 'group': {
        const units = (storage.getTable(TABLE_NAMES.UNITS) || []).filter(u => u.groupId === id);
        const unitIds = new Set(units.map(u => u.id));
        const floors = (storage.getTable(TABLE_NAMES.FLOORS) || []).filter(f => unitIds.has(f.unitId));
        const floorIds = new Set(floors.map(f => f.id));
        const lines = (storage.getTable(TABLE_NAMES.LINES) || []).filter(l => floorIds.has(l.floorId));
        const mcs = machines.filter(m => m.groupId === id || unitIds.has(m.unitId));

        childCount = units.length;
        childType = 'Units / Factories';
        machineCount = mcs.length;
        details = [
          `${units.length} Unit(s)`,
          `${floors.length} Floor(s)`,
          `${lines.length} Line(s)`,
          `${mcs.length} Physical Machine(s)`
        ];
        break;
      }
      case 'unit': {
        const floors = (storage.getTable(TABLE_NAMES.FLOORS) || []).filter(f => f.unitId === id);
        const floorIds = new Set(floors.map(f => f.id));
        const lines = (storage.getTable(TABLE_NAMES.LINES) || []).filter(l => floorIds.has(l.floorId));
        const mcs = machines.filter(m => m.unitId === id);

        childCount = floors.length;
        childType = 'Floors';
        machineCount = mcs.length;
        details = [
          `${floors.length} Floor(s)`,
          `${lines.length} Line(s)`,
          `${mcs.length} Physical Machine(s)`
        ];
        break;
      }
      case 'floor': {
        const lines = (storage.getTable(TABLE_NAMES.LINES) || []).filter(l => l.floorId === id);
        const mcs = machines.filter(m => m.floorId === id);

        childCount = lines.length;
        childType = 'Lines';
        machineCount = mcs.length;
        details = [
          `${lines.length} Line(s)`,
          `${mcs.length} Physical Machine(s)`
        ];
        break;
      }
      case 'line': {
        const mcs = machines.filter(m => m.lineId === id);
        childCount = 0;
        childType = 'None';
        machineCount = mcs.length;
        details = [`${mcs.length} Physical Machine(s)`];
        break;
      }
      case 'machinename': {
        const models = (storage.getTable(TABLE_NAMES.MODELS) || []).filter(m => m.machineNameId === id);
        const mcs = machines.filter(m => m.machineNameId === id);

        childCount = models.length;
        childType = 'Models';
        machineCount = mcs.length;
        details = [
          `${models.length} Model(s)`,
          `${mcs.length} Physical Machine(s)`
        ];
        break;
      }
      case 'brand': {
        const models = (storage.getTable(TABLE_NAMES.MODELS) || []).filter(m => m.brandId === id);
        const mcs = machines.filter(m => m.brandId === id);

        childCount = models.length;
        childType = 'Models';
        machineCount = mcs.length;
        details = [
          `${models.length} Model(s)`,
          `${mcs.length} Physical Machine(s)`
        ];
        break;
      }
      case 'model': {
        const mcs = machines.filter(m => m.modelId === id);
        childCount = 0;
        childType = 'None';
        machineCount = mcs.length;
        details = [`${mcs.length} Physical Machine(s)`];
        break;
      }
    }

    const hasDependencies = childCount > 0 || machineCount > 0;
    return {
      hasDependencies,
      childCount,
      childType,
      machineCount,
      details,
      canSafelyDelete: !hasDependencies
    };
  }

  // ==========================================
  // 4. CRUD OPERATIONS FOR ALL 7 LEVELS
  // ==========================================

  // --- 1. GROUP ---
  async createGroup(data) {
    if (!authService.isAdmin()) throw new Error('Admin authorization required.');
    if (!data.name || !data.name.trim()) throw new Error('Group Name is required.');
    const code = data.code?.trim() || data.name.substring(0, 4).toUpperCase();
    const created = storage.insert(TABLE_NAMES.GROUPS, {
      name: data.name.trim(),
      code: code,
      description: data.description?.trim() || '',
      status: data.status || 'ACTIVE'
    });
    const ok = await storage.saveTable(TABLE_NAMES.GROUPS, true);
    if (!ok) { storage.delete(TABLE_NAMES.GROUPS, created.id); throw new CloudSaveError('❌ Cloud Save Failed: Group creation not confirmed.'); }
    auditService.log('MASTER_GROUP_CREATED', 'GROUP', created.id, `Created Group: ${created.name}`);
    this._broadcastChange();
    return created;
  }

  async updateGroup(id, updates) {
    if (!authService.isAdmin()) throw new Error('Admin authorization required.');
    const updated = storage.update(TABLE_NAMES.GROUPS, id, updates);
    const ok = await storage.saveTable(TABLE_NAMES.GROUPS, true);
    if (!ok) throw new CloudSaveError('❌ Cloud Save Failed: Group update not confirmed.');
    auditService.log('MASTER_GROUP_UPDATED', 'GROUP', id, `Updated Group: ${updated.name}`);
    this._broadcastChange();
    return updated;
  }

  // --- 2. UNIT / FACTORY ---
  async createUnit(data) {
    if (!authService.isAdmin()) throw new Error('Admin authorization required.');
    if (!data.name || !data.name.trim()) throw new Error('Factory / Unit Name is required.');
    if (!data.groupId) throw new Error('Parent Group is required.');
    const code = data.code?.trim() || data.name.substring(0, 3).toUpperCase();
    const created = storage.insert(TABLE_NAMES.UNITS, {
      groupId: data.groupId,
      name: data.name.trim(),
      code: code,
      location: data.location?.trim() || 'Factory Complex',
      status: data.status || 'ACTIVE'
    });
    const ok = await storage.saveTable(TABLE_NAMES.UNITS, true);
    if (!ok) { storage.delete(TABLE_NAMES.UNITS, created.id); throw new CloudSaveError('❌ Cloud Save Failed: Unit creation not confirmed.'); }
    auditService.log('MASTER_UNIT_CREATED', 'UNIT', created.id, `Created Unit: ${created.name}`);
    this._broadcastChange();
    return created;
  }

  async updateUnit(id, updates) {
    if (!authService.isAdmin()) throw new Error('Admin authorization required.');
    const updated = storage.update(TABLE_NAMES.UNITS, id, updates);
    const ok = await storage.saveTable(TABLE_NAMES.UNITS, true);
    if (!ok) throw new CloudSaveError('❌ Cloud Save Failed: Unit update not confirmed.');
    auditService.log('MASTER_UNIT_UPDATED', 'UNIT', id, `Updated Unit: ${updated.name}`);
    this._broadcastChange();
    return updated;
  }

  createUnitsBatch(groupId, namesList, location = 'Factory Complex') {
    if (!authService.isAdmin()) throw new Error('Admin authorization required.');
    if (!groupId) throw new Error('Parent Group is required.');
    const names = Array.isArray(namesList) 
      ? namesList 
      : namesList.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
    if (names.length === 0) throw new Error('Please provide at least one Unit name.');

    const existingUnits = this.getUnits(groupId, true);
    const existingNames = new Set(existingUnits.map(u => u.name.toLowerCase()));

    const newUnits = [];
    names.forEach(name => {
      if (!existingNames.has(name.toLowerCase())) {
        existingNames.add(name.toLowerCase());
        const code = name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 4).toUpperCase() || 'UNT';
        newUnits.push({
          groupId,
          name,
          code,
          location: location || 'Factory Complex',
          status: 'ACTIVE'
        });
      }
    });

    if (newUnits.length > 0) {
      storage.insertMany(TABLE_NAMES.UNITS, newUnits);
      // Auto-create default Ground Floor for every newly created unit
      const defaultFloors = newUnits.map(u => ({
        unitId: u.id,
        name: 'Ground Floor',
        code: 'GF',
        building: 'Main Building',
        status: 'ACTIVE'
      }));
      storage.insertMany(TABLE_NAMES.FLOORS, defaultFloors);
      auditService.log('MASTER_UNIT_BATCH_CREATED', 'UNIT', groupId, `Batch created ${newUnits.length} Units with default Ground Floor`);
      this._broadcastChange();
    }
    return newUnits;
  }

  // --- 3. FLOOR ---
  async createFloor(data) {
    if (!authService.isAdmin()) throw new Error('Admin authorization required.');
    if (!data.name || !data.name.trim()) throw new Error('Floor Name is required.');
    if (!data.unitId) throw new Error('Parent Factory/Unit is required.');
    let code = data.code?.trim();
    if (!code) {
      const lower = data.name.trim().toLowerCase();
      const codeMap = {
        'jamuna': 'JA', 'jamuna floor': 'JA', 'buriganga': 'BG', 'buriganga floor': 'BG',
        'chitra': 'CH', 'chitra floor': 'CH', 'padma': 'PD', 'padma floor': 'PD',
        'titas': 'TT', 'titas floor': 'TT', 'titash': 'TT', 'titash floor': 'TT',
        'tista': 'TS', 'tista floor': 'TS', 'surma': 'SU', 'surma floor': 'SU',
        'meghna': 'MG', 'meghna floor': 'MG', 'pilot': 'PT', 'model line': 'ML', 'sample': 'SM'
      };
      code = codeMap[lower] || data.name.substring(0, 2).toUpperCase();
    }
    const created = storage.insert(TABLE_NAMES.FLOORS, {
      unitId: data.unitId, name: data.name.trim(), code: code,
      locationTag: data.locationTag ? String(data.locationTag).trim().toUpperCase() : '',
      building: data.building?.trim() || 'Main Building', status: data.status || 'ACTIVE'
    });

    // Auto-create {FLOOR_CODE}-A primary line and {FLOOR_CODE}-Idle line
    const primaryLineName = `${code}-A`;
    storage.insert(TABLE_NAMES.LINES, { floorId: created.id, name: primaryLineName, code: primaryLineName, supervisor: 'Line Incharge', status: 'ACTIVE' });
    const idleName = `${code}-Idle`;
    storage.insert(TABLE_NAMES.LINES, { floorId: created.id, name: idleName, code: idleName, supervisor: 'Standby / Maintenance Pool', status: 'ACTIVE' });

    // Confirmed cloud writes for floors + lines
    const [floorsOk, linesOk] = await Promise.all([
      storage.saveTable(TABLE_NAMES.FLOORS, true),
      storage.saveTable(TABLE_NAMES.LINES, true)
    ]);
    if (!floorsOk || !linesOk) { storage.delete(TABLE_NAMES.FLOORS, created.id); throw new CloudSaveError('❌ Cloud Save Failed: Floor creation not confirmed.'); }

    auditService.log('MASTER_FLOOR_CREATED', 'FLOOR', created.id, `Created Floor: ${created.name} [${code}] with lines ${primaryLineName} and ${idleName}`);
    this._broadcastChange();
    return created;
  }

  async updateFloor(id, updates) {
    if (!authService.isAdmin()) throw new Error('Admin authorization required.');
    const oldFloor = storage.getItem(TABLE_NAMES.FLOORS, id);
    const oldCode = oldFloor?.code?.toUpperCase().trim();
    if (updates.locationTag !== undefined) {
      updates.locationTag = updates.locationTag ? String(updates.locationTag).trim().toUpperCase() : '';
    }
    const updated = storage.update(TABLE_NAMES.FLOORS, id, updates);
    const newCode = updated?.code?.toUpperCase().trim();

    // If floor short code changed, update child line names to keep {FLOOR_CODE}-{LINE} format
    if (oldCode && newCode && oldCode !== newCode) {
      const childLines = (storage.getTable(TABLE_NAMES.LINES) || []).filter(l => l.floorId === id);
      childLines.forEach(l => {
        if (l.name.toUpperCase().startsWith(oldCode + '-')) {
          const suffix = l.name.substring(oldCode.length + 1);
          storage.update(TABLE_NAMES.LINES, l.id, { name: `${newCode}-${suffix}`, code: `${newCode}-${suffix}` });
        }
      });
      // Save lines after rename
      await storage.saveTable(TABLE_NAMES.LINES, true);
    }

    const ok = await storage.saveTable(TABLE_NAMES.FLOORS, true);
    if (!ok) throw new CloudSaveError('❌ Cloud Save Failed: Floor update not confirmed.');
    auditService.log('MASTER_FLOOR_UPDATED', 'FLOOR', id, `Updated Floor: ${updated.name} [${updated.code}] [Tag: ${updated.locationTag || 'Auto'}]`);
    this._broadcastChange();
    return updated;
  }

  async createFloorsBatch(unitId, namesList, building = 'Main Building') {
    if (!authService.isAdmin()) throw new Error('Admin authorization required.');
    if (!unitId) throw new Error('Parent Factory/Unit is required.');
    const names = Array.isArray(namesList) 
      ? namesList 
      : namesList.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
    if (names.length === 0) throw new Error('Please provide at least one Floor name.');

    const existingFloors = this.getFloors(unitId, null, true);
    const existingNames = new Set(existingFloors.map(f => f.name.toLowerCase()));

    const codeMap = {
      'jamuna': 'JA',
      'jamuna floor': 'JA',
      'buriganga': 'BG',
      'buriganga floor': 'BG',
      'chitra': 'CH',
      'chitra floor': 'CH',
      'padma': 'PD',
      'padma floor': 'PD',
      'titas': 'TT',
      'titas floor': 'TT',
      'titash': 'TT',
      'titash floor': 'TT',
      'tista': 'TS',
      'tista floor': 'TS',
      'surma': 'SU',
      'surma floor': 'SU',
      'meghna': 'MG',
      'meghna floor': 'MG',
      'pilot': 'PT',
      'model line': 'ML',
      'sample': 'SM'
    };

    const newFloors = [];
    names.forEach(name => {
      if (!existingNames.has(name.toLowerCase())) {
        existingNames.add(name.toLowerCase());
        const lower = name.toLowerCase();
        const code = codeMap[lower] || name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toUpperCase() || 'FLR';
        newFloors.push({
          unitId,
          name,
          code,
          building: building || 'Main Building',
          status: 'ACTIVE'
        });
      }
    });

    if (newFloors.length > 0) {
      storage.insertMany(TABLE_NAMES.FLOORS, newFloors);
      // Auto-create {code}-A and {code}-Idle for each batch created floor
      const newLines = [];
      newFloors.forEach(nf => {
        newLines.push({
          floorId: nf.id,
          name: `${nf.code}-A`,
          code: `${nf.code}-A`,
          supervisor: 'Line Incharge',
          status: 'ACTIVE'
        });
        newLines.push({
          floorId: nf.id,
          name: `${nf.code}-Idle`,
          code: `${nf.code}-Idle`,
          supervisor: 'Standby / Maintenance Pool',
          status: 'ACTIVE'
        });
      });
      storage.insertMany(TABLE_NAMES.LINES, newLines);
      await Promise.all([
        storage.saveTable(TABLE_NAMES.FLOORS, true),
        storage.saveTable(TABLE_NAMES.LINES, true)
      ]);
      auditService.log('MASTER_FLOOR_BATCH_CREATED', 'FLOOR', unitId, `Batch created ${newFloors.length} Floors with initial lines`);
      this._broadcastChange();
    }
    return newFloors;
  }

  // --- 4. LINE ---
  async createLine(data) {
    if (!authService.isAdmin()) throw new Error('Admin authorization required.');
    if (!data.name || !data.name.trim()) throw new Error('Line Name / Letter is required.');
    if (!data.floorId) throw new Error('Parent Floor is required.');
    const floor = this.getFloorById(data.floorId);
    const floorCode = (floor?.code || 'FL').toUpperCase().trim();

    let trimmed = data.name.trim();
    const finalName = formatLineName(trimmed, floorCode);
    const code = data.code?.trim() || finalName;

    // Strict duplicate check: prevent multiple entries of the same line on this floor
    const existingLines = this.getLines(data.floorId, null, null, true);
    const isDuplicate = existingLines.some(l =>
      l.name.toUpperCase() === finalName.toUpperCase() ||
      (l.code && l.code.toUpperCase() === code.toUpperCase())
    );
    if (isDuplicate) {
      throw new Error(`Line "${finalName}" is already configured on floor "${floor?.name || 'this floor'}". Multiple entries are strictly prevented.`);
    }

    const created = storage.insert(TABLE_NAMES.LINES, {
      floorId: data.floorId, name: finalName, code: code,
      supervisor: data.supervisor?.trim() || '', status: data.status || 'ACTIVE'
    });
    const ok = await storage.saveTable(TABLE_NAMES.LINES, true);
    if (!ok) { storage.delete(TABLE_NAMES.LINES, created.id); throw new CloudSaveError('❌ Cloud Save Failed: Line creation not confirmed.'); }
    auditService.log('MASTER_LINE_CREATED', 'LINE', created.id, `Created Line: ${created.name}`);
    this._broadcastChange();
    return created;
  }

  async updateLine(id, updates) {
    if (!authService.isAdmin()) throw new Error('Admin authorization required.');
    const line = storage.getItem(TABLE_NAMES.LINES, id);
    const floor = line ? this.getFloorById(line.floorId) : null;
    const floorCode = (floor?.code || 'FL').toUpperCase().trim();

    if (updates.name && /(?:^|-)\d+$/.test(updates.name.trim().toUpperCase())) {
      throw new Error(`Numeric line values (e.g. "${updates.name}") are strictly not allowed.`);
    }

    if (updates.name && line) {
      const formattedName = updates.name.trim().toUpperCase();
      const existingLines = this.getLines(line.floorId, null, null, true);
      const isDuplicate = existingLines.some(l => l.id !== id && (l.name.toUpperCase() === formattedName || (l.code && l.code.toUpperCase() === formattedName)));
      if (isDuplicate) throw new Error(`Line "${updates.name}" already exists on floor "${floor?.name || 'this floor'}".`);
    }

    const updated = storage.update(TABLE_NAMES.LINES, id, updates);
    const ok = await storage.saveTable(TABLE_NAMES.LINES, true);
    if (!ok) throw new CloudSaveError('❌ Cloud Save Failed: Line update not confirmed.');
    auditService.log('MASTER_LINE_UPDATED', 'LINE', id, `Updated Line: ${updated.name}`);
    this._broadcastChange();
    return updated;
  }

  async createLinesBatch(floorId, namesList, supervisor = '') {
    if (!authService.isAdmin()) throw new Error('Admin authorization required.');
    if (!floorId) throw new Error('Parent Floor is required.');
    const floor = this.getFloorById(floorId);
    const floorCode = (floor?.code || 'FL').toUpperCase().trim();

    const rawNames = Array.isArray(namesList) 
      ? namesList 
      : namesList.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
    if (rawNames.length === 0) throw new Error('Please provide at least one Line letter or name.');

    const existingLines = this.getLines(floorId, null, null, true);
    const existingNames = new Set(existingLines.map(l => l.name.toUpperCase()));

    const newLines = [];
    const skippedLines = [];
    rawNames.forEach(raw => {
      let trimmed = raw.trim();
      const lineName = formatLineName(trimmed, floorCode);

      if (!existingNames.has(lineName.toUpperCase())) {
        existingNames.add(lineName.toUpperCase());
        newLines.push({
          floorId,
          name: lineName,
          code: lineName,
          supervisor: supervisor || '',
          status: 'ACTIVE'
        });
      } else {
        skippedLines.push(lineName);
      }
    });

    if (newLines.length > 0) {
      storage.insertMany(TABLE_NAMES.LINES, newLines);
      await storage.saveTable(TABLE_NAMES.LINES, true);
      auditService.log('MASTER_LINE_BATCH_CREATED', 'LINE', floorId, `Batch created ${newLines.length} Lines for Floor ${floor?.name || floorId} (Skipped ${skippedLines.length} duplicates)`);
      this._broadcastChange();
    }
    newLines.skippedLines = skippedLines;
    return newLines;
  }

  async createLinesForUnitBatch(unitId, namesList, floorName = 'Ground Floor') {
    if (!authService.isAdmin()) throw new Error('Admin authorization required.');
    if (!unitId) throw new Error('Parent Factory/Unit is required.');

    let floors = this.getFloors(unitId, null, true);
    let targetFloor = null;

    if (floorName) {
      targetFloor = floors.find(f => f.name.toLowerCase() === floorName.toLowerCase());
    }
    if (!targetFloor && floors.length > 0) {
      targetFloor = floors[0];
    }
    if (!targetFloor) {
      targetFloor = await this.createFloor({
        unitId,
        name: floorName || 'Ground Floor',
        building: 'Main Building'
      });
    }

    return await this.createLinesBatch(targetFloor.id, namesList);
  }

  /**
   * 1-Click Multi-Floor System: Batch create lines across ALL floors in a unit simultaneously.
   * Each floor receives its own proper {FLOOR_CODE}-{LINE} naming (e.g. JA-A, BG-A, CH-A, SU-A...)
   */
  async createLinesBatchForAllFloors(unitId, namesList, supervisor = '') {
    if (!authService.isAdmin()) throw new Error('Admin authorization required.');
    if (!unitId) throw new Error('Parent Factory/Unit is required.');

    const floors = this.getFloors(unitId, null, true);
    if (floors.length === 0) {
      throw new Error('No floors exist in this unit. Please create or select a floor first.');
    }

    const rawNames = Array.isArray(namesList) 
      ? namesList 
      : namesList.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
    if (rawNames.length === 0) {
      throw new Error('Please provide at least one Line letter or name.');
    }

    let totalCreated = 0;
    let totalSkipped = 0;
    const results = [];

    for (const floor of floors) {
      const created = await this.createLinesBatch(floor.id, rawNames, supervisor);
      totalCreated += created.length;
      const skippedCount = created.skippedLines ? created.skippedLines.length : 0;
      totalSkipped += skippedCount;
      results.push({ floor, count: created.length, skipped: created.skippedLines || [] });
    }

    auditService.log('MASTER_LINE_ALL_FLOORS_BATCH_CREATED', 'UNIT', unitId, `Batch created ${totalCreated} Lines across ${floors.length} Floors (Skipped ${totalSkipped} duplicates)`);
    this._broadcastChange();
    return { totalCreated, totalSkipped, results, floorCount: floors.length };
  }

  // --- 5. MACHINE NAME / TYPE ---
  async createMachineName(data) {
    if (!authService.isAdmin()) throw new Error('Admin authorization required.');
    if (!data.name || !data.name.trim()) throw new Error('Machine Name is required.');
    const cleanName = data.name.trim();
    const existingList = storage.getTable(TABLE_NAMES.MACHINE_NAMES) || [];

    // Resolve canonical name if available
    let canonical = cleanName;
    try {
      if (typeof smartStorageService !== 'undefined' && smartStorageService?.resolveCanonicalMachineName) {
        canonical = smartStorageService.resolveCanonicalMachineName(cleanName) || cleanName;
      }
    } catch (_) {}

    const normClean = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normCanon = canonical.toLowerCase().replace(/[^a-z0-9]/g, '');

    const found = existingList.find(m => {
      if (!m || !m.name) return false;
      const mLower = m.name.trim().toLowerCase();
      const mNorm = mLower.replace(/[^a-z0-9]/g, '');
      return mLower === cleanName.toLowerCase() ||
             mLower === canonical.toLowerCase() ||
             mNorm === normClean ||
             mNorm === normCanon;
    });
    if (found) {
      return found;
    }
    let canonicalId = null;
    if (typeof INITIAL_DATA !== 'undefined' && Array.isArray(INITIAL_DATA.machine_names)) {
      const canonMn = INITIAL_DATA.machine_names.find(m => {
        if (!m || !m.name) return false;
        const mLower = m.name.trim().toLowerCase();
        const mNorm = this.normalizePureAlphanumeric(m.name);
        return mLower === cleanName.toLowerCase() || mLower === (canonical || '').toLowerCase() || mNorm === normClean || mNorm === normCanon;
      });
      if (canonMn && canonMn.id && !existingList.some(m => m.id === canonMn.id)) {
        canonicalId = canonMn.id;
      }
    }

    const created = storage.insert(TABLE_NAMES.MACHINE_NAMES, {
      id: canonicalId || undefined,
      categoryId: data.categoryId || 'cat-1',
      name: canonical || cleanName,
      code: data.code?.trim() || cleanName.substring(0, 3).toUpperCase(),
      description: data.description?.trim() || '',
      status: data.status || 'ACTIVE'
    });
    const ok = await storage.saveTable(TABLE_NAMES.MACHINE_NAMES, true);
    if (!ok) {
      storage.delete(TABLE_NAMES.MACHINE_NAMES, created.id);
      throw new CloudSaveError('❌ Cloud Save Failed: Machine Name creation not confirmed.');
    }
    auditService.log('MASTER_MACHINENAME_CREATED', 'MACHINE_NAME', created.id, `Created Machine Name: ${created.name}`);
    this._broadcastChange();
    return created;
  }

  async updateMachineName(id, updates) {
    if (!authService.isAdmin()) throw new Error('Admin authorization required.');
    const updated = storage.update(TABLE_NAMES.MACHINE_NAMES, id, updates);
    const ok = await storage.saveTable(TABLE_NAMES.MACHINE_NAMES, true);
    if (!ok) throw new CloudSaveError('❌ Cloud Save Failed: Machine Name update not confirmed.');
    auditService.log('MASTER_MACHINENAME_UPDATED', 'MACHINE_NAME', id, `Updated Machine Name: ${updated.name}`);
    this._broadcastChange();
    return updated;
  }

  // --- 6. BRAND ---
  async createBrand(data) {
    if (!authService.isAdmin()) throw new Error('Admin authorization required.');
    if (!data.name || !data.name.trim()) throw new Error('Brand Name is required.');
    const created = storage.insert(TABLE_NAMES.BRANDS, {
      name: data.name.trim(), country: data.country?.trim() || 'Global',
      website: data.website?.trim() || '', status: data.status || 'ACTIVE'
    });
    const ok = await storage.saveTable(TABLE_NAMES.BRANDS, true);
    if (!ok) { storage.delete(TABLE_NAMES.BRANDS, created.id); throw new CloudSaveError('❌ Cloud Save Failed: Brand creation not confirmed.'); }
    auditService.log('MASTER_BRAND_CREATED', 'BRAND', created.id, `Created Brand: ${created.name}`);
    this._broadcastChange();
    return created;
  }

  async updateBrand(id, updates) {
    if (!authService.isAdmin()) throw new Error('Admin authorization required.');
    const updated = storage.update(TABLE_NAMES.BRANDS, id, updates);
    const ok = await storage.saveTable(TABLE_NAMES.BRANDS, true);
    if (!ok) throw new CloudSaveError('❌ Cloud Save Failed: Brand update not confirmed.');
    auditService.log('MASTER_BRAND_UPDATED', 'BRAND', id, `Updated Brand: ${updated.name}`);
    this._broadcastChange();
    return updated;
  }

  // --- 7. MODEL ---
  async createModel(data) {
    if (!authService.isAdmin()) throw new Error('Admin authorization required.');
    if (!data.name || !data.name.trim()) throw new Error('Model Name is required.');
    if (!data.machineNameId) throw new Error('Related Machine Name is required.');
    if (!data.brandId) throw new Error('Related Brand is required.');
    const created = storage.insert(TABLE_NAMES.MODELS, {
      machineNameId: data.machineNameId, brandId: data.brandId, name: data.name.trim(),
      description: data.description?.trim() || '', status: data.status || 'ACTIVE'
    });
    const ok = await storage.saveTable(TABLE_NAMES.MODELS, true);
    if (!ok) { storage.delete(TABLE_NAMES.MODELS, created.id); throw new CloudSaveError('❌ Cloud Save Failed: Model creation not confirmed.'); }
    auditService.log('MASTER_MODEL_CREATED', 'MODEL', created.id, `Created Model: ${created.name}`);
    this._broadcastChange();
    return created;
  }

  async updateModel(id, updates) {
    if (!authService.isAdmin()) throw new Error('Admin authorization required.');
    const updated = storage.update(TABLE_NAMES.MODELS, id, updates);
    const ok = await storage.saveTable(TABLE_NAMES.MODELS, true);
    if (!ok) throw new CloudSaveError('❌ Cloud Save Failed: Model update not confirmed.');
    auditService.log('MASTER_MODEL_UPDATED', 'MODEL', id, `Updated Model: ${updated.name}`);
    this._broadcastChange();
    return updated;
  }

  // ==========================================
  // 5. UNIFIED STATUS TOGGLE & DELETE LOGIC
  // ==========================================
  _getTableForType(type) {
    switch (type) {
      case 'group': return TABLE_NAMES.GROUPS;
      case 'unit': return TABLE_NAMES.UNITS;
      case 'floor': return TABLE_NAMES.FLOORS;
      case 'line': return TABLE_NAMES.LINES;
      case 'machinename': return TABLE_NAMES.MACHINE_NAMES;
      case 'brand': return TABLE_NAMES.BRANDS;
      case 'model': return TABLE_NAMES.MODELS;
      default: throw new Error(`Unknown master data type: ${type}`);
    }
  }

  async toggleStatus(type, id) {
    if (!authService.isAdmin()) throw new Error('Admin authorization required.');
    const table = this._getTableForType(type);
    const item = storage.getItem(table, id);
    if (!item) throw new Error('Item not found.');
    const newStatus = item.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    storage.update(table, id, { status: newStatus });
    await storage.saveTable(table, true); // Best-effort; non-critical toggle
    auditService.log('MASTER_STATUS_TOGGLED', type.toUpperCase(), id, `Toggled status of ${item.name} to ${newStatus}`);
    this._broadcastChange();
    return newStatus;
  }

  async deleteItem(type, id, force = false) {
    if (!authService.isAdmin()) throw new Error('Admin authorization required.');
    const table = this._getTableForType(type);
    const item = storage.getItem(table, id);
    if (!item) throw new Error('Item not found.');

    const depCheck = this.checkDependencies(type, id);
    if (depCheck.hasDependencies && !force) {
      return {
        blocked: true,
        message: `Cannot delete '${item.name}' because it contains ${depCheck.details.join(', ')}.`,
        dependencies: depCheck
      };
    }

    if (depCheck.hasDependencies && force) {
      storage.update(table, id, { status: 'INACTIVE' });
      const ok = await storage.saveTable(table, true);
      if (!ok) throw new CloudSaveError('❌ Cloud Save Failed: Item deactivation not confirmed.');
      auditService.log('MASTER_ITEM_DEACTIVATED', type.toUpperCase(), id, `Item had dependencies; soft deactivated '${item.name}'`);
      this._broadcastChange();
      return { softDeactivated: true, message: `'${item.name}' was deactivated to preserve existing machine records.` };
    }

    storage.delete(table, id);
    const ok = await storage.saveTable(table, true);
    if (!ok) {
      // Rollback: re-insert
      storage.insert(table, item);
      throw new CloudSaveError('❌ Cloud Save Failed: Item deletion not confirmed.');
    }
    auditService.log('MASTER_ITEM_DELETED', type.toUpperCase(), id, `Deleted '${item.name}'`);
    this._broadcastChange();
    return { deleted: true, message: `'${item.name}' was successfully deleted.` };
  }

  async bulkToggleStatus(type, ids, targetStatus) {
    if (!authService.isAdmin()) throw new Error('Admin authorization required.');
    const table = this._getTableForType(type);
    let count = 0;
    ids.forEach(id => {
      storage.update(table, id, { status: targetStatus });
      count++;
    });
    await storage.saveTable(table, true);
    auditService.log('MASTER_BULK_STATUS', type.toUpperCase(), `${count} items`, `Bulk set status to ${targetStatus}`);
    this._broadcastChange();
    return count;
  }

  async bulkDelete(type, ids, force = false) {
    if (!authService.isAdmin()) throw new Error('Admin authorization required.');
    if (force) {
      return await this.bulkCascadeDelete(type, ids);
    }
    const table = this._getTableForType(type);
    let deletedCount = 0;
    let deactivatedCount = 0;

    ids.forEach(id => {
      const depCheck = this.checkDependencies(type, id);
      if (depCheck.hasDependencies) {
        storage.update(table, id, { status: 'INACTIVE' });
        deactivatedCount++;
      } else {
        storage.delete(table, id);
        deletedCount++;
      }
    });
    await storage.saveTable(table, true);

    auditService.log('MASTER_BULK_DELETE', type.toUpperCase(), `${ids.length} items`, `Bulk processed: ${deletedCount} removed, ${deactivatedCount} deactivated`);
    this._broadcastChange();
    return { deletedCount, deactivatedCount };
  }

  bulkCascadeDelete(type, ids) {
    if (!authService.isAdmin()) throw new Error('Admin authorization required.');
    let count = 0;
    ids.forEach(id => {
      this.cascadeDelete(type, id);
      count++;
    });
    auditService.log('MASTER_BULK_CASCADE_DELETE', type.toUpperCase(), `${count} items`, `Bulk permanently deleted ${count} ${type} records`);
    this._broadcastChange();
    return { deletedCount: count };
  }

  cascadeDelete(type, id) {
    if (!authService.isAdmin()) throw new Error('Admin authorization required.');
    const machines = storage.getTable(TABLE_NAMES.MACHINES) || [];

    switch (type) {
      case 'group': {
        const units = (storage.getTable(TABLE_NAMES.UNITS) || []).filter(u => u.groupId === id);
        const unitIds = new Set(units.map(u => u.id));
        const floors = (storage.getTable(TABLE_NAMES.FLOORS) || []).filter(f => unitIds.has(f.unitId));
        const floorIds = new Set(floors.map(f => f.id));
        const lines = (storage.getTable(TABLE_NAMES.LINES) || []).filter(l => floorIds.has(l.floorId));
        const lineIds = new Set(lines.map(l => l.id));

        // Detach machines
        machines.forEach(m => {
          if (m.groupId === id || unitIds.has(m.unitId) || floorIds.has(m.floorId) || lineIds.has(m.lineId)) {
            storage.update(TABLE_NAMES.MACHINES, m.id, {
              groupId: null,
              unitId: null,
              floorId: null,
              lineId: null
            });
          }
        });

        // Delete lines, floors, units, group
        lines.forEach(l => storage.delete(TABLE_NAMES.LINES, l.id));
        floors.forEach(f => storage.delete(TABLE_NAMES.FLOORS, f.id));
        units.forEach(u => storage.delete(TABLE_NAMES.UNITS, u.id));
        storage.delete(TABLE_NAMES.GROUPS, id);

        auditService.log('MASTER_CASCADE_DELETE', 'GROUP', id, `Cascade deleted Group ${id} along with ${units.length} units, ${floors.length} floors, ${lines.length} lines`);
        this._broadcastChange();
        return { units: units.length, floors: floors.length, lines: lines.length };
      }

      case 'unit': {
        const floors = (storage.getTable(TABLE_NAMES.FLOORS) || []).filter(f => f.unitId === id);
        const floorIds = new Set(floors.map(f => f.id));
        const lines = (storage.getTable(TABLE_NAMES.LINES) || []).filter(l => floorIds.has(l.floorId));
        const lineIds = new Set(lines.map(l => l.id));

        // Detach machines
        machines.forEach(m => {
          if (m.unitId === id || floorIds.has(m.floorId) || lineIds.has(m.lineId)) {
            storage.update(TABLE_NAMES.MACHINES, m.id, {
              unitId: null,
              floorId: null,
              lineId: null
            });
          }
        });

        // Delete lines, floors, unit
        lines.forEach(l => storage.delete(TABLE_NAMES.LINES, l.id));
        floors.forEach(f => storage.delete(TABLE_NAMES.FLOORS, f.id));
        storage.delete(TABLE_NAMES.UNITS, id);

        auditService.log('MASTER_CASCADE_DELETE', 'UNIT', id, `Cascade deleted Unit ${id} along with ${floors.length} floors, ${lines.length} lines`);
        this._broadcastChange();
        return { floors: floors.length, lines: lines.length };
      }

      case 'floor': {
        const lines = (storage.getTable(TABLE_NAMES.LINES) || []).filter(l => l.floorId === id);
        const lineIds = new Set(lines.map(l => l.id));

        // Detach machines
        machines.forEach(m => {
          if (m.floorId === id || lineIds.has(m.lineId)) {
            storage.update(TABLE_NAMES.MACHINES, m.id, {
              floorId: null,
              lineId: null
            });
          }
        });

        lines.forEach(l => storage.delete(TABLE_NAMES.LINES, l.id));
        storage.delete(TABLE_NAMES.FLOORS, id);

        auditService.log('MASTER_CASCADE_DELETE', 'FLOOR', id, `Cascade deleted Floor ${id} along with ${lines.length} lines`);
        this._broadcastChange();
        return { lines: lines.length };
      }

      case 'line': {
        machines.forEach(m => {
          if (m.lineId === id) {
            storage.update(TABLE_NAMES.MACHINES, m.id, { lineId: null });
          }
        });
        storage.delete(TABLE_NAMES.LINES, id);
        auditService.log('MASTER_LINE_DELETED', 'LINE', id, `Permanently deleted Line ${id} and detached machines`);
        this._broadcastChange();
        return { success: true };
      }

      case 'machinename': {
        // Detach physical machines
        machines.forEach(m => {
          if (m.machineNameId === id) {
            storage.update(TABLE_NAMES.MACHINES, m.id, { machineNameId: null, modelId: null });
          }
        });
        // Delete child models
        const models = (storage.getTable(TABLE_NAMES.MODELS) || []).filter(m => m.machineNameId === id);
        models.forEach(mdl => storage.delete(TABLE_NAMES.MODELS, mdl.id));
        storage.delete(TABLE_NAMES.MACHINE_NAMES, id);
        auditService.log('MASTER_CASCADE_DELETE', 'MACHINE_NAME', id, `Cascade deleted Machine Name ${id} and ${models.length} child models`);
        this._broadcastChange();
        return { models: models.length };
      }

      case 'brand': {
        // Detach physical machines
        machines.forEach(m => {
          if (m.brandId === id) {
            storage.update(TABLE_NAMES.MACHINES, m.id, { brandId: null, modelId: null });
          }
        });
        // Delete child models
        const models = (storage.getTable(TABLE_NAMES.MODELS) || []).filter(m => m.brandId === id);
        models.forEach(mdl => storage.delete(TABLE_NAMES.MODELS, mdl.id));
        storage.delete(TABLE_NAMES.BRANDS, id);
        auditService.log('MASTER_CASCADE_DELETE', 'BRAND', id, `Cascade deleted Brand ${id} and ${models.length} child models`);
        this._broadcastChange();
        return { models: models.length };
      }

      case 'model': {
        // Detach physical machines
        machines.forEach(m => {
          if (m.modelId === id) {
            storage.update(TABLE_NAMES.MACHINES, m.id, { modelId: null });
          }
        });
        storage.delete(TABLE_NAMES.MODELS, id);
        auditService.log('MASTER_CASCADE_DELETE', 'MODEL', id, `Permanently deleted Model ${id} and detached machines`);
        this._broadcastChange();
        return { success: true };
      }

      default: {
        const table = this._getTableForType(type);
        storage.delete(table, id);
        this._broadcastChange();
        return { success: true };
      }
    }
  }

  purgeMockHierarchy() {
    if (!authService.isAdmin()) throw new Error('Admin authorization required.');

    const mockGroupIds = new Set(['grp-1', 'grp-2']);
    const mockUnitIds = new Set(['unt-1', 'unt-2', 'unt-3', 'unt-4', 'unt-5', 'unt-6']);
    const mockFloorIds = new Set([
      'flr-1', 'flr-2', 'flr-3', 'flr-4', 'flr-5', 'flr-6', 'flr-7', 'flr-8',
      'flr-9', 'flr-10', 'flr-11', 'flr-12', 'flr-13', 'flr-14', 'flr-15',
      'flr-16', 'flr-17', 'flr-18', 'flr-19'
    ]);
    const mockLineIds = new Set([
      'lin-1', 'lin-2', 'lin-3', 'lin-4', 'lin-5', 'lin-6', 'lin-7', 'lin-8',
      'lin-9', 'lin-10', 'lin-11', 'lin-12', 'lin-13', 'lin-14', 'lin-15',
      'lin-16', 'lin-17', 'lin-18', 'lin-19', 'lin-20', 'lin-21', 'lin-22'
    ]);

    // Detach any machines pointing to these mock locations
    const machines = storage.getTable(TABLE_NAMES.MACHINES) || [];
    machines.forEach(m => {
      if (mockGroupIds.has(m.groupId) || mockUnitIds.has(m.unitId) || mockFloorIds.has(m.floorId) || mockLineIds.has(m.lineId)) {
        storage.update(TABLE_NAMES.MACHINES, m.id, {
          groupId: null,
          unitId: null,
          floorId: null,
          lineId: null
        });
      }
    });

    // Delete mock lines
    const currentLines = storage.getTable(TABLE_NAMES.LINES) || [];
    currentLines.forEach(l => {
      if (mockLineIds.has(l.id) || mockFloorIds.has(l.floorId)) {
        storage.delete(TABLE_NAMES.LINES, l.id);
      }
    });

    // Delete mock floors
    const currentFloors = storage.getTable(TABLE_NAMES.FLOORS) || [];
    currentFloors.forEach(f => {
      if (mockFloorIds.has(f.id) || mockUnitIds.has(f.unitId)) {
        storage.delete(TABLE_NAMES.FLOORS, f.id);
      }
    });

    // Delete mock units
    const currentUnits = storage.getTable(TABLE_NAMES.UNITS) || [];
    currentUnits.forEach(u => {
      if (mockUnitIds.has(u.id) || mockGroupIds.has(u.groupId)) {
        storage.delete(TABLE_NAMES.UNITS, u.id);
      }
    });

    // Delete mock groups
    const currentGroups = storage.getTable(TABLE_NAMES.GROUPS) || [];
    currentGroups.forEach(g => {
      if (mockGroupIds.has(g.id)) {
        storage.delete(TABLE_NAMES.GROUPS, g.id);
      }
    });

    auditService.log('MASTER_MOCK_PURGED', 'HIERARCHY', 'ALL', 'Purged all default mock groups, units, floors, and lines');
    this._broadcastChange();
    return { success: true };
  }

  cleanAndSyncAlMuslimHierarchy() {
    // 1. Ensure Al-Muslim Group (grp-1)
    const grp1 = storage.getItem(TABLE_NAMES.GROUPS, 'grp-1');
    if (grp1) {
      storage.update(TABLE_NAMES.GROUPS, 'grp-1', {
        name: 'Al-Muslim Group',
        code: 'AMG',
        status: 'ACTIVE'
      });
    } else {
      storage.insert(TABLE_NAMES.GROUPS, {
        id: 'grp-1',
        name: 'Al-Muslim Group',
        code: 'AMG',
        description: 'Premier Garments & Textile Conglomerate',
        status: 'ACTIVE'
      });
    }

    // 2. Delete mock ABC group (grp-2)
    storage.delete(TABLE_NAMES.GROUPS, 'grp-2');

    // 3. Clean up ABC units or units pointing to grp-2
    const currentUnits = storage.getTable(TABLE_NAMES.UNITS) || [];
    currentUnits.forEach(u => {
      if (u.groupId === 'grp-2' || (u.name && u.name.toUpperCase().includes('ABC')) || u.id === 'unt-6') {
        storage.delete(TABLE_NAMES.UNITS, u.id);
      }
    });

    // 4. Ensure the 5 official units under Al-Muslim Group
    const officialUnits = [
      { id: 'unt-1', groupId: 'grp-1', name: 'AKM Knit Wear Ltd.', code: 'AKM', location: 'Savar, Dhaka', status: 'ACTIVE' },
      { id: 'unt-2', groupId: 'grp-1', name: 'Pacific Blue (Jeans Wear) Ltd.', code: 'PBJ', location: 'Ashulia, Dhaka', status: 'ACTIVE' },
      { id: 'unt-3', groupId: 'grp-1', name: 'Al-Muslim Apparels Ltd.', code: 'AMA', location: 'Savar, Dhaka', status: 'ACTIVE' },
      { id: 'unt-4', groupId: 'grp-1', name: 'Al-Muslim Garments Accessories Ltd', code: 'AGA', location: 'Gazipur, Dhaka', status: 'ACTIVE' },
      { id: 'unt-5', groupId: 'grp-1', name: 'Al-Muslim Fashion & Specilized Ltd.', code: 'AMFS', location: 'Savar, Dhaka', status: 'ACTIVE' }
    ];

    officialUnits.forEach(ou => {
      const existing = storage.getItem(TABLE_NAMES.UNITS, ou.id);
      if (existing) {
        storage.update(TABLE_NAMES.UNITS, ou.id, {
          groupId: 'grp-1',
          name: ou.name,
          code: ou.code,
          location: ou.location || 'Savar, Dhaka',
          status: 'ACTIVE'
        });
      } else {
        storage.insert(TABLE_NAMES.UNITS, ou);
      }
    });

    // 5. Clean up ABC floors and ensure official floors with exact short codes
    const currentFloors = storage.getTable(TABLE_NAMES.FLOORS) || [];
    currentFloors.forEach(f => {
      if (f.unitId === 'unt-6' || (f.name && f.name.toUpperCase().includes('ABC'))) {
        storage.delete(TABLE_NAMES.FLOORS, f.id);
      }
    });

    const officialFloors = [
      { id: 'flr-1', unitId: 'unt-1', name: 'Ground Floor', code: 'GF', building: 'Building 1', status: 'ACTIVE' },
      { id: 'flr-2', unitId: 'unt-1', name: '1st Floor', code: '1F', building: 'Building 1', status: 'ACTIVE' },
      { id: 'flr-3', unitId: 'unt-1', name: '2nd Floor', code: '2F', building: 'Building 1', status: 'ACTIVE' },
      { id: 'flr-4', unitId: 'unt-1', name: '3rd Floor', code: '3F', building: 'Building 1', status: 'ACTIVE' },
      { id: 'flr-5', unitId: 'unt-1', name: '4th Floor', code: '4F', building: 'Building 1', status: 'ACTIVE' },
      { id: 'flr-6', unitId: 'unt-1', name: '5th Floor', code: '5F', building: 'Building 1', status: 'ACTIVE' },
      { id: 'flr-7', unitId: 'unt-2', name: 'Jamuna Floor', code: 'JA', building: 'Denim Plant', status: 'ACTIVE' },
      { id: 'flr-8', unitId: 'unt-2', name: 'Buriganga Floor', code: 'BG', building: 'Denim Plant', status: 'ACTIVE' },
      { id: 'flr-9', unitId: 'unt-2', name: 'Padma Floor', code: 'PD', building: 'Denim Plant', status: 'ACTIVE' },
      { id: 'flr-15', unitId: 'unt-2', name: 'Titas Floor', code: 'TT', building: 'Denim Plant', status: 'ACTIVE' },
      { id: 'flr-16', unitId: 'unt-2', name: 'Chitra Floor', code: 'CH', building: 'Denim Plant', status: 'ACTIVE' },
      { id: 'flr-17', unitId: 'unt-2', name: 'Tista Floor', code: 'TS', building: 'Denim Plant', status: 'ACTIVE' },
      { id: 'flr-20', unitId: 'unt-2', name: 'Surma Floor', code: 'SU', building: 'Denim Plant', status: 'ACTIVE' },
      { id: 'flr-21', unitId: 'unt-2', name: 'Meghna Floor', code: 'MG', building: 'Denim Plant', status: 'ACTIVE' },
      { id: 'flr-10', unitId: 'unt-3', name: 'Main Production Floor', code: 'MPF', building: 'Apparel Complex', status: 'ACTIVE' },
      { id: 'flr-11', unitId: 'unt-3', name: 'Sample', code: 'SM', building: 'Design Wing', status: 'ACTIVE' },
      { id: 'flr-18', unitId: 'unt-3', name: 'Pilot', code: 'PT', building: 'Apparel Complex', status: 'ACTIVE' },
      { id: 'flr-19', unitId: 'unt-3', name: 'Model Line', code: 'ML', building: 'Apparel Complex', status: 'ACTIVE' },
      { id: 'flr-12', unitId: 'unt-4', name: 'Finishing & Utility Floor', code: 'FUF', building: 'Auxiliary Wing', status: 'ACTIVE' },
      { id: 'flr-13', unitId: 'unt-5', name: 'Specialized Sewing Floor', code: 'SSF', building: 'Fashion Complex', status: 'ACTIVE' },
      { id: 'flr-14', unitId: 'unt-5', name: 'Fashion & Finishing Floor', code: 'FFF', building: 'Fashion Complex', status: 'ACTIVE' }
    ];

    officialFloors.forEach(ofl => {
      const existing = storage.getItem(TABLE_NAMES.FLOORS, ofl.id);
      if (existing) {
        storage.update(TABLE_NAMES.FLOORS, ofl.id, {
          unitId: ofl.unitId,
          name: ofl.name,
          code: ofl.code,
          locationTag: existing.locationTag || ofl.locationTag || '',
          building: ofl.building || 'Production Complex',
          status: 'ACTIVE'
        });
      } else {
        storage.insert(TABLE_NAMES.FLOORS, ofl);
      }
    });

    // 6. Clean up ABC lines and format lines to {FLOOR_CODE}-{LINE} format
    const currentLines = storage.getTable(TABLE_NAMES.LINES) || [];
    currentLines.forEach(l => {
      if (l.name && l.name.toUpperCase().includes('ABC')) {
        storage.delete(TABLE_NAMES.LINES, l.id);
      } else {
        const f = storage.getItem(TABLE_NAMES.FLOORS, l.floorId);
        const fCode = (f?.code || 'FL').toUpperCase().trim();
        let newName = l.name;

        if (/idle/i.test(l.name)) {
          newName = `${fCode}-Idle`;
        } else if (/cutting/i.test(l.name)) {
          newName = `${fCode}-Cutting`;
        } else if (/finishing/i.test(l.name)) {
          newName = `${fCode}-Finishing`;
        } else if (/sample/i.test(l.name)) {
          newName = `${fCode}-Sample`;
        } else if (/size\s*set/i.test(l.name)) {
          newName = `${fCode}-Size Set`;
        } else if (/eyelet|apw/i.test(l.name)) {
          newName = `${fCode}-Eyelet & APW Room`;
        } else {
          // Convert any numeric lines (e.g. 01, 1 -> A; 02, 2 -> B; 03, 3 -> C)
          const numMatch = l.name.match(/(?:-|\s+)?0*([1-9][0-9]*)$/);
          if (numMatch) {
            const num = parseInt(numMatch[1], 10);
            if (num >= 1 && num <= 26) {
              const letter = String.fromCharCode(64 + num);
              newName = `${fCode}-${letter}`;
            } else {
              newName = `${fCode}-A`;
            }
          } else {
            const letterMatch = l.name.match(/([A-Z])$/i);
            if (letterMatch) {
              newName = `${fCode}-${letterMatch[1].toUpperCase()}`;
            } else {
              newName = `${fCode}-A`;
            }
          }
        }

        if (newName !== l.name) {
          storage.update(TABLE_NAMES.LINES, l.id, {
            name: newName,
            code: newName
          });
        }
      }
    });

    // 7. Ensure official primary lines (e.g. SU-A) and {FLOOR_CODE}-Idle lines exist
    const requiredPrimaryLines = [
      { id: 'lin-23', floorId: 'flr-20', name: 'SU-A', code: 'SU-A', supervisor: 'Md. Enamul Haque', status: 'ACTIVE' }
    ];
    requiredPrimaryLines.forEach(pl => {
      const allLines = storage.getTable(TABLE_NAMES.LINES) || [];
      const hasLine = allLines.some(l => l.floorId === pl.floorId && l.name.toUpperCase() === pl.name.toUpperCase());
      if (!hasLine) {
        storage.insert(TABLE_NAMES.LINES, pl);
      }
    });

    // Ensure every official floor has its {FLOOR_CODE}-Idle line for standby machinery
    officialFloors.forEach(ofl => {
      const allLines = storage.getTable(TABLE_NAMES.LINES) || [];
      const idleName = `${ofl.code}-Idle`;
      const hasIdle = allLines.some(l => l.floorId === ofl.id && l.name.toUpperCase() === idleName.toUpperCase());
      if (!hasIdle) {
        storage.insert(TABLE_NAMES.LINES, {
          floorId: ofl.id,
          name: idleName,
          code: idleName,
          supervisor: 'Standby / Maintenance Pool',
          status: 'ACTIVE'
        });
      }
    });

    auditService.log('MASTER_MOCK_PURGED', 'HIERARCHY', 'ALL', 'Purged old mock ABC data and synced official floors and alphabetic lines');
    this._broadcastChange();
    return { success: true };
  }

  /**
   * Automatic Hierarchy Synchronization to Machine Inventory
   * Resolves and denormalizes parent hierarchy relationships:
   * lineId -> floorId -> unitId -> groupId
   * Keeps m.line, m.floor, m.unit, m.group names strictly updated in storage
   */
  syncMachinesHierarchy(persistToCloud = false) {
    try {
      const machines = storage.getTable(TABLE_NAMES.MACHINES) || [];
      if (!machines || machines.length === 0) return { updatedCount: 0 };

      const groups = storage.getTable(TABLE_NAMES.GROUPS) || [];
      const units = storage.getTable(TABLE_NAMES.UNITS) || [];
      const floors = storage.getTable(TABLE_NAMES.FLOORS) || [];
      const lines = storage.getTable(TABLE_NAMES.LINES) || [];

      const groupMap = new Map(groups.map(g => [g.id, g]));
      const unitMap = new Map(units.map(u => [u.id, u]));
      const floorMap = new Map(floors.map(f => [f.id, f]));
      const lineMap = new Map(lines.map(l => [l.id, l]));

      let updatedCount = 0;

      machines.forEach(m => {
        let isChanged = false;

        // 1. Resolve Line
        let line = m.lineId ? lineMap.get(m.lineId) : null;
        if (!line && m.line) {
          line = lines.find(l => l.name.toLowerCase() === String(m.line).toLowerCase());
          if (line) {
            m.lineId = line.id;
            isChanged = true;
          }
        }

        // 2. Resolve Floor (cascade from Line if available, or match floorId/floor)
        let floor = null;
        if (line && line.floorId) {
          floor = floorMap.get(line.floorId);
          if (floor && m.floorId !== line.floorId) {
            m.floorId = line.floorId;
            isChanged = true;
          }
        } else if (m.floorId) {
          floor = floorMap.get(m.floorId);
        } else if (m.floor) {
          floor = floors.find(f => f.name.toLowerCase() === String(m.floor).toLowerCase());
          if (floor) {
            m.floorId = floor.id;
            isChanged = true;
          }
        }

        // 3. Resolve Unit (cascade from Floor if available, or match unitId/unit)
        let unit = null;
        if (floor && floor.unitId) {
          unit = unitMap.get(floor.unitId);
          if (unit && m.unitId !== floor.unitId) {
            m.unitId = floor.unitId;
            isChanged = true;
          }
        } else if (m.unitId) {
          unit = unitMap.get(m.unitId);
        } else if (m.unit) {
          unit = units.find(u => u.name.toLowerCase() === String(m.unit).toLowerCase());
          if (unit) {
            m.unitId = unit.id;
            isChanged = true;
          }
        }

        // 4. Resolve Group (cascade from Unit if available, or match groupId/group)
        let group = null;
        if (unit && unit.groupId) {
          group = groupMap.get(unit.groupId);
          if (group && m.groupId !== unit.groupId) {
            m.groupId = unit.groupId;
            isChanged = true;
          }
        } else if (m.groupId) {
          group = groupMap.get(m.groupId);
        } else if (m.group) {
          group = groups.find(g => g.name.toLowerCase() === String(m.group).toLowerCase());
          if (group) {
            m.groupId = group.id;
            isChanged = true;
          }
        }

        if (!m.groupId && groups.length > 0) {
          m.groupId = groups[0].id;
          group = groups[0];
          isChanged = true;
        }

        // 5. Keep denormalized string names strictly up-to-date
        const curLineName = line?.name || (m.lineId ? (lineMap.get(m.lineId)?.name || '') : '');
        const curFloorName = floor?.name || (m.floorId ? (floorMap.get(m.floorId)?.name || '') : '');
        const curUnitName = unit?.name || (m.unitId ? (unitMap.get(m.unitId)?.name || '') : '');
        const curGroupName = group?.name || (m.groupId ? (groupMap.get(m.groupId)?.name || '') : '');

        if (curLineName && (m.line !== curLineName || m.lineName !== curLineName)) {
          m.line = curLineName;
          m.lineName = curLineName;
          isChanged = true;
        }
        if (curFloorName && (m.floor !== curFloorName || m.floorName !== curFloorName)) {
          m.floor = curFloorName;
          m.floorName = curFloorName;
          isChanged = true;
        }
        if (curUnitName && (m.unit !== curUnitName || m.unitName !== curUnitName)) {
          m.unit = curUnitName;
          m.unitName = curUnitName;
          isChanged = true;
        }
        if (curGroupName && (m.group !== curGroupName || m.groupName !== curGroupName)) {
          m.group = curGroupName;
          m.groupName = curGroupName;
          isChanged = true;
        }

        if (isChanged) {
          m.updatedAt = new Date().toISOString();
          updatedCount++;
        }
      });

      if (updatedCount > 0) {
        if (persistToCloud) {
          storage.saveTable(TABLE_NAMES.MACHINES);
        } else {
          try {
            localStorage.setItem('al_muslim_erp_' + TABLE_NAMES.MACHINES, JSON.stringify(machines));
          } catch (_) {}
        }
        storage.rebuildAllIndexes();
        console.log(`[Master Hierarchy Sync] Synchronized ${updatedCount} machine records with latest Master Data.`);
      }

      return { updatedCount };
    } catch (err) {
      console.warn('Hierarchy auto-sync error:', err);
      return { updatedCount: 0 };
    }
  }

  /**
   * Cleanses current filter state if filtered entity was removed/deleted in Master Data
   */
  validateAndCleanFilters() {
    try {
      const filters = state.get('filters');
      if (!filters) return;
      let changed = false;
      const newFilters = { ...filters };

      if (newFilters.groupId && !storage.getItem(TABLE_NAMES.GROUPS, newFilters.groupId)) {
        newFilters.groupId = '';
        changed = true;
      }
      if (newFilters.unitId && !storage.getItem(TABLE_NAMES.UNITS, newFilters.unitId)) {
        newFilters.unitId = '';
        changed = true;
      }
      if (newFilters.floorId && !storage.getItem(TABLE_NAMES.FLOORS, newFilters.floorId)) {
        newFilters.floorId = '';
        changed = true;
      }
      if (newFilters.lineId && !storage.getItem(TABLE_NAMES.LINES, newFilters.lineId)) {
        newFilters.lineId = '';
        changed = true;
      }

      if (changed) {
        state.set('filters', newFilters);
      }
    } catch (_) {}
  }

  _broadcastChange() {
    this.syncMachinesHierarchy(true);
    this.validateAndCleanFilters();
    window.dispatchEvent(new CustomEvent('erp:master-data-updated'));
    try {
      state.emit('inventory:updated');
    } catch (_) {}
  }
}

export const masterDataService = new MasterDataService();

