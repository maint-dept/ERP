/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Machine Inventory Core Service (Supports Infinite Machines with Unique Serials)
 */

import { storage } from '../db/storage.js';
import { CloudSaveError } from '../db/storage.js';
import { TABLE_NAMES } from '../db/schema.js';
import { INITIAL_DATA } from '../db/initialData.js';
import { authService } from './authService.js';
import { masterDataService } from './masterDataService.js';
import { approvalService } from './approvalService.js';
import { auditService } from './auditService.js';
import { notificationService } from './notificationService.js';
import { historyService } from './historyService.js';
import { syncManager } from '../db/syncManager.js';

class MachineService {
  /**
   * Comprehensive Composite Duplicate Check for Machine Inventory:
   *
   * Rules:
   * 1. Serial Number is globally unique — the same Serial Number cannot exist on two machines.
   * 2. Composite Duplicate: Machine Name + Brand + Model + Serial Number — if all four match, it is a Duplicate.
   *
   * - Serial + Name + Brand + Model all match  -> isDuplicate: true, isCompositeDuplicate: true
   * - Only Serial matches (Name/Brand/Model differ) -> isDuplicate: true, isCompositeDuplicate: false (Serial Conflict)
   * - Serial is different -> isDuplicate: false (new entry accepted)
   */
  checkDuplicateMachine(machineData, excludeMachineId = null) {
    if (!machineData) return { isDuplicate: false };
    const serial = machineData.serialNumber ? String(machineData.serialNumber).trim().toUpperCase() : '';
    if (!serial) return { isDuplicate: false };

    const cleanSerial = serial;
    const existing = storage.findMachineBySerial(cleanSerial);

    if (existing && existing.id !== excludeMachineId) {
      const unit = storage.getItem(TABLE_NAMES.UNITS, existing.unitId);
      const floor = storage.getItem(TABLE_NAMES.FLOORS, existing.floorId);
      const line = storage.getItem(TABLE_NAMES.LINES, existing.lineId);
      const mn = storage.getItem(TABLE_NAMES.MACHINE_NAMES, existing.machineNameId);
      const brand = storage.getItem(TABLE_NAMES.BRANDS, existing.brandId);
      const model = storage.getItem(TABLE_NAMES.MODELS, existing.modelId);

      // Composite check: compare all four fields when they are explicitly provided
      const mnMatches = machineData.machineNameId
        ? machineData.machineNameId === existing.machineNameId
        : true;
      const brandMatches = machineData.brandId !== undefined && machineData.brandId !== null && machineData.brandId !== ''
        ? machineData.brandId === existing.brandId
        : !existing.brandId; // both have no brand -> match
      const modelMatches = machineData.modelId !== undefined && machineData.modelId !== null && machineData.modelId !== ''
        ? machineData.modelId === existing.modelId
        : !existing.modelId; // both have no model -> match

      const isCompositeMatch = mnMatches && brandMatches && modelMatches;

      return {
        isDuplicate: true,
        isCompositeDuplicate: isCompositeMatch,
        message: isCompositeMatch
          ? `Duplicate Record: Machine Name (${mn?.name || ''}), Brand (${brand?.name || 'N/A'}), Model (${model?.name || 'N/A'}), Serial '${cleanSerial}' — all four fields match an existing machine in the database.`
          : `Serial Number Conflict: Serial '${cleanSerial}' is already assigned to another machine (ID: ${existing.id}, ${mn?.name || ''} - ${model?.name || ''}). Serial Number must be unique.`,
        conflict: {
          id: existing.id,
          serialNumber: existing.serialNumber,
          machineName: mn?.name || 'N/A',
          brand: brand?.name || 'N/A',
          model: model?.name || 'N/A',
          unit: unit?.name || 'N/A',
          floor: floor?.name || 'N/A',
          line: line?.name || 'N/A',
          status: existing.status,
          isCompositeMatch
        }
      };
    }

    return { isDuplicate: false };
  }

  /**
   * Check for duplicate serial number or machine object with comprehensive conflict report
   */
  checkDuplicateSerial(serialNumberOrData, excludeMachineId = null) {
    if (typeof serialNumberOrData === 'object' && serialNumberOrData !== null) {
      return this.checkDuplicateMachine(serialNumberOrData, excludeMachineId);
    }
    return this.checkDuplicateMachine({ serialNumber: serialNumberOrData }, excludeMachineId);
  }

  /**
   * Auto-generate unique sequential serial number formatted as:
   * [Floor Short Code]-[Machine Number]
   * Examples: JA-01, JA-02, BG-01, TT-01, TS-01, CH-01, PD-01, PT-01, ML-01
   */
  generateNextSerialNumber(floorId, customPrefix = null, padding = 2) {
    let floorCode = customPrefix;
    if (!floorCode && floorId) {
      const floorObj = storage.getItem(TABLE_NAMES.FLOORS, floorId);
      floorCode = floorObj?.code || (floorObj?.name ? floorObj.name.substring(0, 2).toUpperCase() : 'MC');
    }
    if (!floorCode) floorCode = 'JA';

    const cleanPrefix = floorCode.trim().toUpperCase();
    const allMachines = storage.getTable(TABLE_NAMES.MACHINES) || [];
    
    let maxSeq = 0;
    const pattern = new RegExp(`^${cleanPrefix}[-_]?(\\d+)$`, 'i');

    allMachines.forEach(m => {
      if (m.serialNumber) {
        const match = m.serialNumber.trim().toUpperCase().match(pattern);
        if (match && match[1]) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxSeq) {
            maxSeq = num;
          }
        }
      }
    });

    const nextNum = maxSeq + 1;
    const padWidth = Math.max(2, parseInt(padding, 10) || 2);
    return `${cleanPrefix}-${String(nextNum).padStart(padWidth, '0')}`;
  }

  /**
   * Parse potential floor short code from serial number
   */
  parseFloorFromSerial(serialNumber) {
    if (!serialNumber) return null;
    const parts = serialNumber.trim().split(/[-_]/);
    if (parts.length >= 2) {
      const code = parts[0].toUpperCase();
      const allFloors = storage.getTable(TABLE_NAMES.FLOORS) || [];
      return allFloors.find(f => f.code && f.code.toUpperCase() === code) || null;
    }
    return null;
  }

  /**
   * High-Performance Scoped Query Engine (Handles infinite records with pagination & multi-filter)
   */
  getMachines(params = {}) {
    let allMachines = storage.getTable(TABLE_NAMES.MACHINES) || [];

    // 1. Strict Backend / Storage-level Organization Scoping with Cross-Floor Idle Visibility
    const scoped = authService.getScopedFilter();
    if (scoped) {
      allMachines = allMachines.filter(m => authService.canViewMachine(m));
    }

    // 2. Cascading Primary Organization Filters
    if (params.groupId) {
      allMachines = allMachines.filter(m => m.groupId === params.groupId);
    }
    if (params.unitId) {
      allMachines = allMachines.filter(m => m.unitId === params.unitId);
    }
    if (params.floorId) {
      allMachines = allMachines.filter(m => m.floorId === params.floorId);
    }
    if (params.lineId) {
      allMachines = allMachines.filter(m => m.lineId === params.lineId);
    }

    // 3. Machine Technical Hierarchy Filters
    if (params.machineNameId) {
      allMachines = allMachines.filter(m => m.machineNameId === params.machineNameId);
    }
    if (params.brandId) {
      allMachines = allMachines.filter(m => m.brandId === params.brandId);
    }
    if (params.modelId) {
      allMachines = allMachines.filter(m => m.modelId === params.modelId);
    }
    if (params.status && params.status !== 'ALL') {
      allMachines = allMachines.filter(m => m.status === params.status);
    }

    // 4. Global Multi-Field Search (Serial, Asset ID, Remarks, Model, Brand, Name, Line, Floor, Unit)
    if (params.search) {
      const q = params.search.trim().toLowerCase();
      
      // Look up master data maps for ultra-fast text matching
      const grpMap = new Map(storage.getTable(TABLE_NAMES.GROUPS).map(x => [x.id, x.name.toLowerCase()]));
      const mnMap = new Map(storage.getTable(TABLE_NAMES.MACHINE_NAMES).map(x => [x.id, x.name.toLowerCase()]));
      const brdMap = new Map(storage.getTable(TABLE_NAMES.BRANDS).map(x => [x.id, x.name.toLowerCase()]));
      const mdlMap = new Map(storage.getTable(TABLE_NAMES.MODELS).map(x => [x.id, x.name.toLowerCase()]));
      const linMap = new Map(storage.getTable(TABLE_NAMES.LINES).map(x => [x.id, x.name.toLowerCase()]));
      const flrMap = new Map(storage.getTable(TABLE_NAMES.FLOORS).map(x => [x.id, x.name.toLowerCase()]));
      const untMap = new Map(storage.getTable(TABLE_NAMES.UNITS).map(x => [x.id, x.name.toLowerCase()]));

      allMachines = allMachines.filter(m => {
        if (m.serialNumber?.toLowerCase().includes(q)) return true;
        if (m.remarks?.toLowerCase().includes(q)) return true;
        if (mnMap.get(m.machineNameId)?.includes(q)) return true;
        if (brdMap.get(m.brandId)?.includes(q)) return true;
        if (mdlMap.get(m.modelId)?.includes(q)) return true;
        const lName = linMap.get(m.lineId) || m.line?.toLowerCase() || '';
        if (lName.includes(q)) return true;
        const cleanL = lName.replace(/^[a-z]{2,3}-/i, '').trim();
        if (cleanL && (cleanL === q || `line ${cleanL}`.includes(q) || cleanL.includes(q))) return true;
        if (flrMap.get(m.floorId)?.includes(q) || m.floor?.toLowerCase().includes(q)) return true;
        if (untMap.get(m.unitId)?.includes(q) || m.unit?.toLowerCase().includes(q)) return true;
        if (grpMap.get(m.groupId)?.includes(q) || m.group?.toLowerCase().includes(q)) return true;
        // Check dynamic custom field values
        if (m.customValues) {
          for (const key in m.customValues) {
            if (String(m.customValues[key]).toLowerCase().includes(q)) return true;
          }
        }
        return false;
      });
    }

    // 5. Dynamic Custom Field Filters
    if (params.customFilters) {
      for (const [key, val] of Object.entries(params.customFilters)) {
        if (val !== undefined && val !== null && val !== '' && val !== 'ALL') {
          allMachines = allMachines.filter(m => m.customValues && String(m.customValues[key]) === String(val));
        }
      }
    }

    const totalRecords = allMachines.length;

    // Calculate accurate dynamic KPI summary metrics for this filtered & scoped dataset
    let runningQty = 0;
    let usableIdleQty = 0;
    let repairableIdleQty = 0;

    allMachines.forEach(m => {
      const r = parseInt(m.running ?? m.qty_running ?? (m.status === 'ACTIVE' ? (m.quantity ?? 1) : 0), 10) || 0;
      const u = parseInt(m.usable_idle ?? m.usableIdle ?? (m.status === 'IDLE' ? (m.quantity ?? 1) : 0), 10) || 0;
      const rp = parseInt(m.repairable_idle ?? m.repairableIdle ?? ((m.status === 'MAINTENANCE' || m.status === 'BREAKDOWN') ? (m.quantity ?? 1) : 0), 10) || 0;
      runningQty += r;
      usableIdleQty += u;
      repairableIdleQty += rp;
    });

    const metrics = {
      total: totalRecords,
      running: runningQty,
      usable: usableIdleQty,
      repairable: repairableIdleQty
    };

    // 6. Multi-Column Sorting
    const sortField = params.sortField || 'sl';
    const sortOrder = params.sortOrder === 'desc' ? -1 : 1;

    allMachines.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      // Handle nested master data sort
      if (sortField === 'machineName') {
        const nameA = storage.getItem(TABLE_NAMES.MACHINE_NAMES, a.machineNameId)?.name || '';
        const nameB = storage.getItem(TABLE_NAMES.MACHINE_NAMES, b.machineNameId)?.name || '';
        return nameA.localeCompare(nameB) * sortOrder;
      }
      if (sortField === 'brand') {
        const bA = storage.getItem(TABLE_NAMES.BRANDS, a.brandId)?.name || '';
        const bB = storage.getItem(TABLE_NAMES.BRANDS, b.brandId)?.name || '';
        return bA.localeCompare(bB) * sortOrder;
      }
      if (sortField === 'model') {
        const mA = storage.getItem(TABLE_NAMES.MODELS, a.modelId)?.name || '';
        const mB = storage.getItem(TABLE_NAMES.MODELS, b.modelId)?.name || '';
        return mA.localeCompare(mB) * sortOrder;
      }
      if (sortField === 'group') {
        const gA = storage.getItem(TABLE_NAMES.GROUPS, a.groupId)?.name || a.group || '';
        const gB = storage.getItem(TABLE_NAMES.GROUPS, b.groupId)?.name || b.group || '';
        return gA.localeCompare(gB) * sortOrder;
      }
      if (sortField === 'unit') {
        const uA = storage.getItem(TABLE_NAMES.UNITS, a.unitId)?.name || a.unit || '';
        const uB = storage.getItem(TABLE_NAMES.UNITS, b.unitId)?.name || b.unit || '';
        return uA.localeCompare(uB) * sortOrder;
      }
      if (sortField === 'floor') {
        const fA = storage.getItem(TABLE_NAMES.FLOORS, a.floorId)?.name || a.floor || '';
        const fB = storage.getItem(TABLE_NAMES.FLOORS, b.floorId)?.name || b.floor || '';
        return fA.localeCompare(fB) * sortOrder;
      }
      if (sortField === 'line') {
        const lA = storage.getItem(TABLE_NAMES.LINES, a.lineId)?.name || a.line || '';
        const lB = storage.getItem(TABLE_NAMES.LINES, b.lineId)?.name || b.line || '';
        return lA.localeCompare(lB) * sortOrder;
      }
      if (sortField.startsWith('cf_')) {
        const cfKey = sortField.replace('cf_', '');
        valA = a.customValues?.[cfKey] || '';
        valB = b.customValues?.[cfKey] || '';
      }

      if (valA === undefined || valA === null) valA = '';
      if (valB === undefined || valB === null) valB = '';

      if (typeof valA === 'number' && typeof valB === 'number') {
        return (valA - valB) * sortOrder;
      }
      return String(valA).localeCompare(String(valB), undefined, { numeric: true }) * sortOrder;
    });

    // 7. High Performance Pagination
    const page = Math.max(1, parseInt(params.page, 10) || 1);
    const limit = params.limit === 'ALL' ? totalRecords : Math.max(1, parseInt(params.limit, 10) || 50);
    const totalPages = Math.ceil(totalRecords / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginatedItems = params.limit === 'ALL' ? allMachines : allMachines.slice(startIndex, startIndex + limit);

    return {
      items: paginatedItems,
      total: totalRecords,
      page: page,
      limit: limit,
      totalPages: totalPages,
      metrics
    };
  }

  getMachineById(id) {
    const machine = storage.getItem(TABLE_NAMES.MACHINES, id);
    if (!machine) return null;

    // Check location scoping & cross-floor view permissions
    if (!authService.canViewMachine(machine)) {
      throw new Error('Access Denied: You do not have permission to view this machine record.');
    }

    return machine;
  }

  getEnrichedMachine(id) {
    const m = this.getMachineById(id);
    if (!m) return null;

    const grp = storage.getItem(TABLE_NAMES.GROUPS, m.groupId) || (INITIAL_DATA.groups || []).find(x => x.id === m.groupId) || { id: m.groupId, name: m.group || m.groupName || '' };
    const unt = storage.getItem(TABLE_NAMES.UNITS, m.unitId) || (INITIAL_DATA.units || []).find(x => x.id === m.unitId) || { id: m.unitId, name: m.unit || m.unitName || '' };
    const flr = storage.getItem(TABLE_NAMES.FLOORS, m.floorId) || (INITIAL_DATA.floors || []).find(x => x.id === m.floorId) || { id: m.floorId, name: m.floor || m.floorName || '' };
    const lin = storage.getItem(TABLE_NAMES.LINES, m.lineId) || (INITIAL_DATA.lines || []).find(x => x.id === m.lineId) || { id: m.lineId, name: m.line || m.lineName || '' };

    const mnObj = storage.getItem(TABLE_NAMES.MACHINE_NAMES, m.machineNameId) || 
                  (INITIAL_DATA.machine_names || []).find(x => x.id === m.machineNameId) || 
                  { id: m.machineNameId, name: m.machineName || m.name || (m.brand ? m.brand + ' Machine' : 'Plane Machine') };

    const brdObj = m.brandId 
      ? (storage.getItem(TABLE_NAMES.BRANDS, m.brandId) || (INITIAL_DATA.brands || []).find(x => x.id === m.brandId) || { id: m.brandId, name: m.brand || '' })
      : { id: '', name: m.brand || '' };

    const mdlObj = m.modelId 
      ? (storage.getItem(TABLE_NAMES.MODELS, m.modelId) || (INITIAL_DATA.models || []).find(x => x.id === m.modelId) || { id: m.modelId, name: m.model || m.modelName || '' })
      : { id: '', name: m.model || m.modelName || '' };

    return {
      ...m,
      group: grp,
      unit: unt,
      floor: flr,
      line: lin,
      machineName: mnObj,
      brand: brdObj,
      model: mdlObj,
      machineNameStr: mnObj.name || (typeof m.machineName === 'string' ? m.machineName : ''),
      brandStr: brdObj.name || m.brand || '',
      modelStr: mdlObj.name || m.model || m.modelName || ''
    };
  }

  /**
   * Add new machine with duplicate verification & approval workflow.
   * CONFIRMED WRITE: awaits Firestore HTTP 200 before returning. Throws CloudSaveError on failure.
   */
  async addMachine(machineData) {
    const user = authService.getCurrentUser();

    // Check action authorization
    if (!authService.hasAccess('machines', 'ADD')) {
      throw new Error('Access Denied: You do not have permission to add new machines.');
    }

    // Check location authorization
    if (!authService.isLocationAllowed(machineData.unitId, machineData.floorId, machineData.lineId)) {
      throw new Error('Access Denied: You are not authorized to add machines to this location.');
    }

    // Required fields check: Machine Name and Serial Number are mandatory; Brand & Model are optional
    if (!machineData.machineNameId || !machineData.serialNumber) {
      throw new Error('Machine Name and Serial Number are required.');
    }

    // Composite Duplicate Check (Machine Name + Brand + Model + Serial Number)
    // Rule: Serial Number is globally unique; all four fields matching together = Duplicate
    const dupCheck = this.checkDuplicateMachine(machineData);
    if (dupCheck.isDuplicate) {
      const err = new Error(dupCheck.message);
      err.conflict = dupCheck.conflict;
      err.isCompositeDuplicate = dupCheck.isCompositeDuplicate;
      throw err;
    }

    const allMachines = storage.getTable(TABLE_NAMES.MACHINES);
    const sl = allMachines.length + 1;

    const grpObj = storage.getItem(TABLE_NAMES.GROUPS, machineData.groupId);
    const untObj = storage.getItem(TABLE_NAMES.UNITS, machineData.unitId);
    const flrObj = storage.getItem(TABLE_NAMES.FLOORS, machineData.floorId);
    const linObj = storage.getItem(TABLE_NAMES.LINES, machineData.lineId);
    const mnObj = storage.getItem(TABLE_NAMES.MACHINE_NAMES, machineData.machineNameId);
    const brdObj = machineData.brandId ? storage.getItem(TABLE_NAMES.BRANDS, machineData.brandId) : null;
    const mdlObj = machineData.modelId ? storage.getItem(TABLE_NAMES.MODELS, machineData.modelId) : null;

    const qty = machineData.quantity !== undefined ? Number(machineData.quantity) : 1;
    const status = machineData.status || 'ACTIVE';

    // Use explicitly provided running/idle values (e.g. from Excel import), else derive from status
    let running, usable_idle, repairable_idle;
    if (machineData.running !== undefined || machineData.usable_idle !== undefined || machineData.repairable_idle !== undefined) {
      running = Number(machineData.running ?? 0);
      usable_idle = Number(machineData.usable_idle ?? 0);
      repairable_idle = Number(machineData.repairable_idle ?? 0);
    } else {
      running = (status === 'ACTIVE') ? qty : 0;
      usable_idle = (status === 'IDLE') ? qty : 0;
      repairable_idle = (status === 'MAINTENANCE' || status === 'BREAKDOWN') ? qty : 0;
    }
    // Ensure total quantity matches sum of the three fields when provided explicitly
    const finalQty = (machineData.running !== undefined || machineData.usable_idle !== undefined || machineData.repairable_idle !== undefined)
      ? (running + usable_idle + repairable_idle) || qty
      : qty;

    const newMachine = {
      ...machineData,
      sl: sl,
      quantity: finalQty,
      status: status,
      running,
      usable_idle,
      repairable_idle,
      group: grpObj?.name || 'Al-Muslim Group',
      groupName: grpObj?.name || 'Al-Muslim Group',
      unit: untObj?.name || '',
      unitName: untObj?.name || '',
      floor: flrObj?.name || '',
      floorName: flrObj?.name || '',
      line: linObj?.name || '',
      lineName: linObj?.name || '',
      machineName: mnObj?.name || '',
      brand: brdObj?.name || '',
      model: mdlObj?.name || '',
      customValues: machineData.customValues || {},
      createdBy: user?.id || 'usr-super-admin',
      createdAt: new Date().toISOString(),
      updatedBy: user?.id || 'usr-super-admin',
      updatedAt: new Date().toISOString()
    };

    // Approval routing for scoped maintenance staff
    if (authService.requiresApproval()) {
      newMachine.status = 'PENDING_APPROVAL';
      // Insert in-memory only for approval workflow — full cloud save happens via approval flow
      const created = storage.insert(TABLE_NAMES.MACHINES, newMachine);
      const ok = await storage.saveTable(TABLE_NAMES.MACHINES, true);
      if (!ok) {
        // Rollback insert
        const machines = storage.getTable(TABLE_NAMES.MACHINES);
        const idx = machines.findIndex(m => m.id === created.id);
        if (idx !== -1) machines.splice(idx, 1);
        storage.rebuildAllIndexes();
        throw new CloudSaveError('❌ Cloud Save Failed: Machine could not be submitted for approval. Check your connection.');
      }

      approvalService.createRequest({
        machineId: created.id,
        type: 'NEW_MACHINE',
        remarks: machineData.remarks || 'New machine added by maintenance user.',
        diffs: [
          { field: 'status', label: 'Status', oldValue: 'NEW', newValue: 'ACTIVE' }
        ]
      });

      notificationService.notify(
        'New Machine Pending Approval',
        `${user.name} registered Machine ${created.serialNumber} which requires admin approval.`,
        'APPROVAL_REQUEST',
        '#approval-center'
      );

      auditService.log('MACHINE_SUBMITTED_FOR_APPROVAL', 'MACHINE', created.serialNumber, `New machine ${created.serialNumber} created pending approval.`);
      return { machine: created, pendingApproval: true };
    }

    // Pre-generate ID and timestamps so we can write to MySQL first
    if (!newMachine.id) {
      newMachine.id = `mac-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    }
    newMachine.createdAt = newMachine.createdAt || new Date().toISOString();
    newMachine.updatedAt = new Date().toISOString();

    // 1. Instant local cache and memory update (Zero-wait)
    if (!storage.data[TABLE_NAMES.MACHINES]) {
      storage.data[TABLE_NAMES.MACHINES] = [];
    }
    storage.data[TABLE_NAMES.MACHINES].push(newMachine);
    storage.rebuildAllIndexes();
    try {
      localStorage.setItem('al_muslim_erp_' + TABLE_NAMES.MACHINES, JSON.stringify(storage.data[TABLE_NAMES.MACHINES]));
    } catch (_) {}

    // 2. Background non-blocking cloud sync
    syncManager.saveRecord(TABLE_NAMES.MACHINES, newMachine.id, newMachine).catch(e => {
      console.warn('[SyncManager] Add machine cloud sync queued in background:', e.message);
    });
    if (!storage.data[TABLE_NAMES.MACHINES]) {
      storage.data[TABLE_NAMES.MACHINES] = [];
    }
    storage.data[TABLE_NAMES.MACHINES].push(newMachine);
    storage.rebuildAllIndexes();
    try {
      localStorage.setItem('al_muslim_erp_' + TABLE_NAMES.MACHINES, JSON.stringify(storage.data[TABLE_NAMES.MACHINES]));
    } catch (_) {}
    const created = newMachine;

    auditService.log('MACHINE_ADDED', 'MACHINE', created.serialNumber, `Added machine: ${created.serialNumber}`);

    // Automatic History Tracking
    historyService.recordActivity({
      machineId: created.id,
      serialNumber: created.serialNumber,
      actionType: 'ADD_MACHINE',
      title: `Machine Registered (${mnObj?.name || 'Sewing Machine'})`,
      details: `Commissioned machine ${created.serialNumber} into ${untObj?.name || ''} > ${flrObj?.name || ''} > ${linObj?.name || ''}`,
      toLocation: {
        groupId: created.groupId,
        unitId: created.unitId,
        floorId: created.floorId,
        lineId: created.lineId,
        unitName: untObj?.name,
        floorName: flrObj?.name,
        lineName: linObj?.name
      },
      newValue: { status: created.status, line: linObj?.name },
      remarks: created.remarks || 'Machine commissioned and registered'
    });

    return { machine: created, pendingApproval: false };
  }

  /**
   * Update machine with inline/form validation and visual diff approval.
   * CONFIRMED WRITE: awaits Firestore HTTP 200 before returning. Throws CloudSaveError on failure.
   */
  async updateMachine(id, updates) {
    const user = authService.getCurrentUser();
    const existing = this.getMachineById(id);
    if (!existing) throw new Error('Machine not found.');

    // Check action authorization
    if (!authService.hasAccess('machines', 'EDIT')) {
      throw new Error('Access Denied: You do not have permission to modify machine records.');
    }

    if (!authService.canOperateMachine(existing)) {
      throw new Error('Access Denied: You cannot modify machines outside your assigned floor.');
    }

    // If moving location, verify target location is authorized
    if (updates.unitId || updates.floorId || updates.lineId) {
      const targetUnit = updates.unitId || existing.unitId;
      const targetFloor = updates.floorId || existing.floorId;
      const targetLine = updates.lineId || existing.lineId;
      if (!authService.isLocationAllowed(targetUnit, targetFloor, targetLine)) {
        throw new Error('Access Denied: You are not authorized to move machines to this target location.');
      }
    }

    // Composite Duplicate Check on Edit (when Serial or other spec fields change)
    // Rule: Serial Number is globally unique; Name+Brand+Model+Serial all matching = Duplicate
    const mergedForDupCheck = { ...existing, ...updates };
    if (updates.serialNumber || updates.machineNameId || updates.brandId !== undefined || updates.modelId !== undefined) {
      const dupCheck = this.checkDuplicateMachine(mergedForDupCheck, id);
      if (dupCheck.isDuplicate) {
        const err = new Error(dupCheck.message);
        err.conflict = dupCheck.conflict;
        err.isCompositeDuplicate = dupCheck.isCompositeDuplicate;
        throw err;
      }
    }

    // Approval routing for scoped maintenance staff
    if (authService.requiresApproval()) {
      const diffs = approvalService.calculateDiffs(existing, updates);
      if (diffs.length === 0) return { machine: existing, message: 'No changes detected.' };

      const req = approvalService.createRequest({
        machineId: id,
        type: 'EDIT_MACHINE',
        remarks: updates.editReason || 'Machine parameters modified by maintenance user.',
        proposedUpdates: updates,
        diffs: diffs
      });

      notificationService.notify(
        'Machine Edit Request Submitted',
        `${user.name} submitted edits for Machine ${existing.serialNumber}.`,
        'APPROVAL_REQUEST',
        '#approval-center'
      );

      auditService.log('MACHINE_EDIT_REQUESTED', 'MACHINE', existing.serialNumber, `Edit request submitted for ${existing.serialNumber}.`, existing, updates);
      return { machine: existing, pendingApproval: true, requestId: req.id };
    }

    const grpObj = updates.groupId ? storage.getItem(TABLE_NAMES.GROUPS, updates.groupId) : storage.getItem(TABLE_NAMES.GROUPS, existing.groupId);
    const untObj = updates.unitId ? storage.getItem(TABLE_NAMES.UNITS, updates.unitId) : storage.getItem(TABLE_NAMES.UNITS, existing.unitId);
    const flrObj = updates.floorId ? storage.getItem(TABLE_NAMES.FLOORS, updates.floorId) : storage.getItem(TABLE_NAMES.FLOORS, existing.floorId);
    const linObj = updates.lineId ? storage.getItem(TABLE_NAMES.LINES, updates.lineId) : storage.getItem(TABLE_NAMES.LINES, existing.lineId);
    const mnObj = updates.machineNameId ? storage.getItem(TABLE_NAMES.MACHINE_NAMES, updates.machineNameId) : storage.getItem(TABLE_NAMES.MACHINE_NAMES, existing.machineNameId);
    const brdObj = updates.brandId !== undefined
      ? (updates.brandId ? storage.getItem(TABLE_NAMES.BRANDS, updates.brandId) : null)
      : (existing.brandId ? storage.getItem(TABLE_NAMES.BRANDS, existing.brandId) : null);
    const mdlObj = updates.modelId !== undefined
      ? (updates.modelId ? storage.getItem(TABLE_NAMES.MODELS, updates.modelId) : null)
      : (existing.modelId ? storage.getItem(TABLE_NAMES.MODELS, existing.modelId) : null);

    const qty = updates.quantity !== undefined ? Number(updates.quantity) : (existing.quantity || 1);
    const status = updates.status || existing.status || 'ACTIVE';

    const enrichedUpdates = {
      ...updates,
      quantity: qty,
      status,
      running: (status === 'ACTIVE') ? qty : 0,
      usable_idle: (status === 'IDLE') ? qty : 0,
      repairable_idle: (status === 'MAINTENANCE' || status === 'BREAKDOWN') ? qty : 0,
      group: grpObj?.name || existing.group || 'Al-Muslim Group',
      groupName: grpObj?.name || existing.groupName || 'Al-Muslim Group',
      unit: untObj?.name || existing.unit || '',
      unitName: untObj?.name || existing.unitName || '',
      floor: flrObj?.name || existing.floor || '',
      floorName: flrObj?.name || existing.floorName || '',
      line: linObj?.name || existing.line || '',
      lineName: linObj?.name || existing.lineName || '',
      machineName: mnObj?.name || existing.machineName || '',
      brand: brdObj ? brdObj.name : (updates.brandId === '' ? '' : (existing.brand || '')),
      model: mdlObj ? mdlObj.name : (updates.modelId === '' ? '' : (existing.model || '')),
      updatedBy: user?.id || 'usr-super-admin',
      updatedAt: new Date().toISOString()
    };

    // PREPARE UPDATED OBJECT
    const targetUpdateObj = { ...existing, ...enrichedUpdates };

    // 1. Instant local memory & cache update (Zero-wait)
    const updated = storage.update(TABLE_NAMES.MACHINES, id, enrichedUpdates);
    try {
      localStorage.setItem('al_muslim_erp_' + TABLE_NAMES.MACHINES, JSON.stringify(storage.data[TABLE_NAMES.MACHINES]));
    } catch (_) {}

    // 2. Background non-blocking cloud sync
    syncManager.saveRecord(TABLE_NAMES.MACHINES, id, targetUpdateObj).catch(e => {
      console.warn('[SyncManager] Update machine cloud sync queued in background:', e.message);
    });

    auditService.log('MACHINE_UPDATED', 'MACHINE', updated.serialNumber, `Updated machine ${updated.serialNumber}`, existing, updated);

    // Automatic History Tracking
    const locChanged = (updates.unitId && updates.unitId !== existing.unitId) ||
                       (updates.floorId && updates.floorId !== existing.floorId) ||
                       (updates.lineId && updates.lineId !== existing.lineId);
    const statusChanged = updates.status && updates.status !== existing.status;

    if (locChanged) {
      const fromUnit = storage.getItem(TABLE_NAMES.UNITS, existing.unitId);
      const fromFloor = storage.getItem(TABLE_NAMES.FLOORS, existing.floorId);
      const fromLine = storage.getItem(TABLE_NAMES.LINES, existing.lineId);
      const toUnit = storage.getItem(TABLE_NAMES.UNITS, updated.unitId);
      const toFloor = storage.getItem(TABLE_NAMES.FLOORS, updated.floorId);
      const toLine = storage.getItem(TABLE_NAMES.LINES, updated.lineId);

      historyService.recordActivity({
        machineId: updated.id,
        serialNumber: updated.serialNumber,
        actionType: 'LOCATION_CHANGE',
        title: `Location Changed to ${toLine?.name || toFloor?.name}`,
        details: `Relocated from ${fromUnit?.name || ''} > ${fromFloor?.name || ''} > ${fromLine?.name || ''} to ${toUnit?.name || ''} > ${toFloor?.name || ''} > ${toLine?.name || ''}`,
        fromLocation: { unitId: existing.unitId, floorId: existing.floorId, lineId: existing.lineId, unitName: fromUnit?.name, floorName: fromFloor?.name, lineName: fromLine?.name },
        toLocation: { unitId: updated.unitId, floorId: updated.floorId, lineId: updated.lineId, unitName: toUnit?.name, floorName: toFloor?.name, lineName: toLine?.name },
        previousValue: { location: `${fromUnit?.name} > ${fromFloor?.name} > ${fromLine?.name}` },
        newValue: { location: `${toUnit?.name} > ${toFloor?.name} > ${toLine?.name}` },
        remarks: updates.remarks || 'Manual admin location modification'
      });
    }

    if (statusChanged) {
      historyService.recordActivity({
        machineId: updated.id,
        serialNumber: updated.serialNumber,
        actionType: 'STATUS_CHANGE',
        title: `Status Changed: ${existing.status} → ${updated.status}`,
        details: `Machine status modified from ${existing.status} to ${updated.status}`,
        previousValue: { status: existing.status },
        newValue: { status: updated.status },
        remarks: updates.remarks || ''
      });
    }

    if (!locChanged && !statusChanged) {
      historyService.recordActivity({
        machineId: updated.id,
        serialNumber: updated.serialNumber,
        actionType: 'EDIT_MACHINE',
        title: `Machine Specifications Updated`,
        details: `Admin modified parameters for machine ${updated.serialNumber}`,
        previousValue: existing,
        newValue: updated,
        remarks: updates.remarks || ''
      });
    }

    return { machine: updated, pendingApproval: false };
  }

  /**
   * Safe Archival / Deletion with policy checks
   */
  archiveOrDeleteMachine(id, reason = '') {
    const user = authService.getCurrentUser();
    const existing = this.getMachineById(id);
    if (!existing) throw new Error('Machine not found.');

    if (!authService.hasAccess('machines', 'DELETE')) {
      throw new Error('Access Denied: You do not have permission to delete or archive machines.');
    }

    // Check if delete approval is required
    const settings = storage.getTable(TABLE_NAMES.SETTINGS);
    if (settings.requireDeleteApproval && !authService.isSuperAdmin()) {
      approvalService.createRequest({
        machineId: id,
        type: 'ARCHIVE_MACHINE',
        remarks: reason || 'Machine decommission / archive requested.',
        diffs: [
          { field: 'status', label: 'Status', oldValue: existing.status, newValue: 'ARCHIVED' }
        ]
      });

      notificationService.notify('Machine Deletion Request', `${user.name} requested to archive Machine ${existing.serialNumber}.`, 'APPROVAL_REQUEST', '#approval-center');
      return { action: 'PENDING_APPROVAL', message: 'Archive request sent to Super Admin for approval.' };
    }

    // Switch to ARCHIVED
    const updated = storage.update(TABLE_NAMES.MACHINES, id, {
      status: 'ARCHIVED',
      remarks: `${existing.remarks || ''} [Archived on ${new Date().toLocaleDateString()}: ${reason}]`.trim(),
      updatedBy: user.id
    });

    auditService.log('MACHINE_ARCHIVED', 'MACHINE', existing.serialNumber, `Archived machine ${existing.serialNumber}: ${reason}`);
    
    historyService.recordActivity({
      machineId: existing.id,
      serialNumber: existing.serialNumber,
      actionType: 'DELETE_MACHINE',
      title: `Machine Archived / Decommissioned`,
      details: `Machine status switched to ARCHIVED. Reason: ${reason}`,
      previousValue: { status: existing.status },
      newValue: { status: 'ARCHIVED' },
      remarks: reason
    });

    return { action: 'ARCHIVED', machine: updated };
  }

  // Bulk Operations
  bulkUpdateStatus(machineIds, newStatus, remarks = '') {
    const user = authService.getCurrentUser();
    let updatedCount = 0;

    machineIds.forEach(id => {
      const m = storage.getItem(TABLE_NAMES.MACHINES, id);
      if (m && authService.canOperateMachine(m)) {
        const oldStatus = m.status;
        storage.update(TABLE_NAMES.MACHINES, id, {
          status: newStatus,
          remarks: remarks ? `${m.remarks || ''} | ${remarks}` : m.remarks,
          updatedBy: user.id
        });
        updatedCount++;

        historyService.recordActivity({
          machineId: m.id,
          serialNumber: m.serialNumber,
          actionType: 'STATUS_CHANGE',
          title: `Bulk Status Update: ${oldStatus} → ${newStatus}`,
          details: `Bulk status update executed by ${user.name}`,
          previousValue: { status: oldStatus },
          newValue: { status: newStatus },
          remarks: remarks || 'Bulk status modification'
        });
      }
    });

    auditService.log('BULK_STATUS_CHANGE', 'MACHINE', `${updatedCount} records`, `Bulk changed status to ${newStatus}`);
    return { updatedCount };
  }

  bulkArchive(machineIds, reason = 'Bulk decommission') {
    const user = authService.getCurrentUser();
    let archivedCount = 0;

    machineIds.forEach(id => {
      const m = storage.getItem(TABLE_NAMES.MACHINES, id);
      if (m && authService.canOperateMachine(m)) {
        const oldStatus = m.status;
        storage.update(TABLE_NAMES.MACHINES, id, {
          status: 'ARCHIVED',
          remarks: `${m.remarks || ''} [Bulk Archived: ${reason}]`.trim(),
          updatedBy: user.id
        });
        archivedCount++;

        historyService.recordActivity({
          machineId: m.id,
          serialNumber: m.serialNumber,
          actionType: 'DELETE_MACHINE',
          title: `Machine Bulk Archived`,
          details: `Machine bulk archived. Reason: ${reason}`,
          previousValue: { status: oldStatus },
          newValue: { status: 'ARCHIVED' },
          remarks: reason
        });
      }
    });

    auditService.log('BULK_ARCHIVE', 'MACHINE', `${archivedCount} records`, `Bulk archived machines. Reason: ${reason}`);
    return { archivedCount };
  }

  /**
   * Delete Machine - Alias to permanent delete machine record from database
   */
  deleteMachine(id, reason = 'Admin manual deletion') {
    return this.permanentDeleteMachine(id, reason);
  }

  /**
   * Bulk Delete Machines - Alias to bulk permanent delete machines
   */
  bulkDeleteMachines(machineIds = [], reason = 'Admin bulk deletion') {
    return this.bulkPermanentDelete(machineIds, reason);
  }

  /**
   * Permanent Delete Machine - Completely removes machine record from database.
   * CONFIRMED WRITE: awaits Firestore HTTP 200.
   */
  async permanentDeleteMachine(id, reason = 'Admin manual deletion') {
    const user = authService.getCurrentUser();
    const existing = this.getMachineById(id);
    if (!existing) throw new Error('Machine not found.');

    if (!authService.canOperateMachine(existing)) {
      throw new Error('Access Denied: You cannot delete machines outside your assigned floor.');
    }

    if (!authService.isAdmin() && !authService.hasPermission('DELETE')) {
      throw new Error('Access Denied: You do not have permission to delete machines.');
    }

    // CONFIRMED CLOUD WRITE FIRST (MySQL Single Source of Truth)
    const dbResult = await syncManager.primaryAdapter.deleteRecord(TABLE_NAMES.MACHINES, id);
    if (!dbResult.success) {
      throw new CloudSaveError('❌ Database Transaction Failed: ' + dbResult.error);
    }

    // Direct Admin update (in-memory & cache only AFTER cloud success)
    const removed = storage.delete(TABLE_NAMES.MACHINES, id);
    if (removed) {
      storage.rebuildAllIndexes();
      try {
        localStorage.setItem('al_muslim_erp_' + TABLE_NAMES.MACHINES, JSON.stringify(storage.data[TABLE_NAMES.MACHINES]));
      } catch (_) {}

      auditService.log(
        'MACHINE_PERMANENT_DELETED',
        'MACHINE',
        existing.serialNumber,
        `Permanently deleted machine ${existing.serialNumber} (${existing.id}). Reason: ${reason}`
      );

      historyService.recordActivity({
        machineId: existing.id,
        serialNumber: existing.serialNumber,
        actionType: 'DELETE_MACHINE',
        title: `Machine Permanently Deleted`,
        details: `Machine ${existing.serialNumber} (${existing.id}) was permanently purged from database. Reason: ${reason}`,
        previousValue: existing,
        remarks: reason
      });
    }
    return { success: !!removed, machine: existing };
  }

  /**
   * Bulk Permanent Delete - Completely removes multiple machines from database.
   * CONFIRMED WRITE: awaits Firestore HTTP 200.
   */
  async bulkPermanentDelete(machineIds = [], reason = 'Admin bulk deletion') {
    if (!authService.isAdmin() && !authService.hasPermission('DELETE')) {
      throw new Error('Access Denied: You do not have permission to delete machines.');
    }

    let deletedCount = 0;
    const deletedSerials = [];
    const deletedRecords = [];

    machineIds.forEach(id => {
      const m = storage.getItem(TABLE_NAMES.MACHINES, id);
      if (m && authService.canOperateMachine(m)) {
        const ok = storage.delete(TABLE_NAMES.MACHINES, id);
        if (ok) {
          deletedCount++;
          deletedSerials.push(m.serialNumber);
          deletedRecords.push(m);
        }
      }
    });

    if (deletedCount > 0) {
      // PREPARE UPDATED TABLE IN MEMORY FIRST
      const newTable = storage.getTable(TABLE_NAMES.MACHINES).filter(m => !machineIds.includes(m.id));

      // CONFIRMED CLOUD WRITE FIRST (MySQL Single Source of Truth)
      const dbResult = await syncManager.primaryAdapter.saveTable(TABLE_NAMES.MACHINES, newTable);
      if (!dbResult.success) {
        throw new CloudSaveError('❌ Database Transaction Failed: ' + dbResult.error);
      }

      // NOW update local memory & cache
      storage.data[TABLE_NAMES.MACHINES] = newTable;
      storage.rebuildAllIndexes();
      try {
        localStorage.setItem('al_muslim_erp_' + TABLE_NAMES.MACHINES, JSON.stringify(newTable));
      } catch (_) {}

      auditService.log(
        'BULK_MACHINE_PERMANENT_DELETED',
        'MACHINE',
        `${deletedCount} records`,
        `Permanently deleted ${deletedCount} machines: ${deletedSerials.slice(0, 10).join(', ')}${deletedSerials.length > 10 ? '...' : ''}. Reason: ${reason}`
      );
    }

    return { deletedCount, deletedSerials };
  }

  /**
   * Delete All Filtered - Permanently deletes all machines matching the active filter query.
   * CONFIRMED WRITE: awaits Firestore HTTP 200.
   */
  async deleteAllFiltered(filterParams = {}, reason = 'Admin filtered mass deletion') {
    if (!authService.isAdmin() && !authService.hasPermission('DELETE')) {
      throw new Error('Access Denied: You do not have permission to delete machines.');
    }

    const matchedMachines = this.getMachines({ ...filterParams, limit: 'ALL' }).items;
    const matchedIds = matchedMachines.map(m => m.id);

    if (matchedIds.length === 0) {
      return { deletedCount: 0, totalMatched: 0 };
    }

    const result = await this.bulkPermanentDelete(matchedIds, reason);
    return {
      deletedCount: result.deletedCount,
      totalMatched: matchedIds.length,
      deletedSerials: result.deletedSerials
    };
  }
}

export const machineService = new MachineService();
