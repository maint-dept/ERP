/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Tools, Equipment & Accessories Management Service
 * 
 * Features:
 * - Master Tools & Accessories Catalog & Stock Management
 * - Integration with Manpower Module (Active & Inactive Staff)
 * - Allocation Registry, Unique Registration Numbers, Date of Issue vs Change
 * - Tool Replacement & Return History Tracking
 * - Excel Bulk Import / Export Engine (SheetJS)
 * - Receipt Aggregation for Printable SOP Sheets & Pocket Bag Slips
 */

import { storage, CloudSaveError } from '../db/storage.js';
import { TABLE_NAMES } from '../db/schema.js';
import { auditService } from './auditService.js';
import { employeeService } from './employeeService.js';
import { authService } from './authService.js';

class ToolService {
  constructor() {
    this._ensureSeedData();
  }

  _ensureSeedData() {
    let tools = storage.getTable(TABLE_NAMES.TOOLS_MASTER) || [];
    let accs = storage.getTable(TABLE_NAMES.ACCESSORIES_MASTER) || [];
    let allocs = storage.getTable(TABLE_NAMES.TOOL_ALLOCATIONS) || [];

    if (tools.length === 0 || accs.length === 0 || allocs.length === 0) {
      // Re-seed from initial storage if empty
      const freshTools = storage.getTable(TABLE_NAMES.TOOLS_MASTER);
      const freshAccs = storage.getTable(TABLE_NAMES.ACCESSORIES_MASTER);
      const freshAllocs = storage.getTable(TABLE_NAMES.TOOL_ALLOCATIONS);

      if (!freshTools || freshTools.length === 0) {
        // Will be populated by storage reset if needed
      }
    }
  }

  // =========================================================================
  // 1. MASTER TOOLS CATALOG & STOCK
  // =========================================================================

  getAllMasterTools(category = 'ALL', search = '') {
    let list = storage.getTable(TABLE_NAMES.TOOLS_MASTER) || [];
    if (category && category !== 'ALL') {
      list = list.filter(t => t.category === category);
    }
    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(t =>
        (t.name && t.name.toLowerCase().includes(q)) ||
        (t.code && String(t.code).toLowerCase().includes(q)) ||
        (t.remarks && t.remarks.toLowerCase().includes(q))
      );
    }
    return list.sort((a, b) => (parseInt(a.code, 10) || 0) - (parseInt(b.code, 10) || 0));
  }

  getMasterToolById(id) {
    const list = storage.getTable(TABLE_NAMES.TOOLS_MASTER) || [];
    return list.find(t => t.id === id) || null;
  }

  getMasterToolByCode(code) {
    if (!code) return null;
    const cleanCode = String(code).trim().toLowerCase();
    const list = storage.getTable(TABLE_NAMES.TOOLS_MASTER) || [];
    return list.find(t => String(t.code).trim().toLowerCase() === cleanCode) || null;
  }

  async addMasterTool(data) {
    const list = storage.getTable(TABLE_NAMES.TOOLS_MASTER) || [];
    const id = 'tool-' + (data.code || Date.now());

    // Check duplicate code
    if (list.some(t => String(t.code).trim() === String(data.code).trim())) {
      throw new Error(`A tool with code "${data.code}" already exists.`);
    }

    const newTool = {
      id,
      code: String(data.code || '').padStart(3, '0'),
      name: String(data.name || '').trim(),
      category: data.category || 'TOOLS',
      totalStock: Number(data.totalStock) || 0,
      unit: data.unit || 'Pcs',
      minStock: Number(data.minStock) || 10,
      status: data.status || 'ACTIVE',
      remarks: data.remarks || '',
      createdAt: new Date().toISOString()
    };

    list.push(newTool);
    // CONFIRMED WRITE: await Database write
    const ok = await storage.saveTable(TABLE_NAMES.TOOLS_MASTER, list);
    if (!ok) throw new CloudSaveError('❌ Cloud Save Failed: Tool master record was not confirmed by the cloud.');

    auditService.log({
      action: 'ADD_TOOL_MASTER',
      details: `Created new master tool: ${newTool.code} - ${newTool.name} (Stock: ${newTool.totalStock})`,
      targetId: id
    });

    return newTool;
  }

  async updateMasterTool(id, updates) {
    const list = storage.getTable(TABLE_NAMES.TOOLS_MASTER) || [];
    const idx = list.findIndex(t => t.id === id);
    if (idx === -1) throw new Error('Master tool not found.');

    list[idx] = {
      ...list[idx],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    // CONFIRMED WRITE: await Database write
    const ok = await storage.saveTable(TABLE_NAMES.TOOLS_MASTER, list);
    if (!ok) throw new CloudSaveError('❌ Cloud Save Failed: Tool master update was not confirmed by the cloud.');
    return list[idx];
  }

  async deleteMasterTool(id) {
    let list = storage.getTable(TABLE_NAMES.TOOLS_MASTER) || [];
    const target = list.find(t => t.id === id);
    if (!target) throw new Error('Master tool not found.');

    list = list.filter(t => t.id !== id);
    // CONFIRMED WRITE: await Database write
    const ok = await storage.saveTable(TABLE_NAMES.TOOLS_MASTER, list);
    if (!ok) throw new CloudSaveError('❌ Cloud Save Failed: Tool deletion was not confirmed by the cloud.');

    auditService.log({
      action: 'DELETE_TOOL_MASTER',
      details: `Deleted master tool: ${target.code} - ${target.name}`,
      targetId: id
    });

    return true;
  }

  // =========================================================================
  // 2. MASTER ACCESSORIES CATALOG & STOCK
  // =========================================================================

  getAllMasterAccessories(search = '') {
    let list = storage.getTable(TABLE_NAMES.ACCESSORIES_MASTER) || [];
    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(a =>
        (a.name && a.name.toLowerCase().includes(q)) ||
        (a.code && String(a.code).toLowerCase().includes(q)) ||
        (a.defaultRemarks && a.defaultRemarks.toLowerCase().includes(q))
      );
    }
    return list;
  }

  getMasterAccessoryById(id) {
    const list = storage.getTable(TABLE_NAMES.ACCESSORIES_MASTER) || [];
    return list.find(a => a.id === id) || null;
  }

  async addMasterAccessory(data) {
    const list = storage.getTable(TABLE_NAMES.ACCESSORIES_MASTER) || [];
    const id = 'acc-' + (data.code || Date.now());

    const newAcc = {
      id,
      code: String(data.code || 'ACC-' + (list.length + 1)),
      name: String(data.name || '').trim(),
      category: 'ACCESSORIES',
      defaultQty: data.defaultQty || '01 Pcs',
      defaultRemarks: data.defaultRemarks || '',
      unit: data.unit || 'Pcs',
      totalStock: Number(data.totalStock) || 100,
      status: data.status || 'ACTIVE',
      createdAt: new Date().toISOString()
    };

    list.push(newAcc);
    // CONFIRMED WRITE: await Database write
    const ok = await storage.saveTable(TABLE_NAMES.ACCESSORIES_MASTER, list);
    if (!ok) throw new CloudSaveError('❌ Cloud Save Failed: Accessory master record was not confirmed by the cloud.');
    return newAcc;
  }

  async updateMasterAccessory(id, updates) {
    const list = storage.getTable(TABLE_NAMES.ACCESSORIES_MASTER) || [];
    const idx = list.findIndex(a => a.id === id);
    if (idx === -1) throw new Error('Master accessory not found.');

    list[idx] = {
      ...list[idx],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    // CONFIRMED WRITE: await Database write
    const ok = await storage.saveTable(TABLE_NAMES.ACCESSORIES_MASTER, list);
    if (!ok) throw new CloudSaveError('❌ Cloud Save Failed: Accessory update was not confirmed by the cloud.');
    return list[idx];
  }

  async deleteMasterAccessory(id) {
    let list = storage.getTable(TABLE_NAMES.ACCESSORIES_MASTER) || [];
    const target = list.find(a => a.id === id);
    list = list.filter(a => a.id !== id);
    // CONFIRMED WRITE: await Database write
    const ok = await storage.saveTable(TABLE_NAMES.ACCESSORIES_MASTER, list);
    if (!ok) throw new CloudSaveError('❌ Cloud Save Failed: Accessory deletion was not confirmed by the cloud.');

    auditService.log({
      action: 'DELETE_ACCESSORY_MASTER',
      details: `Deleted master accessory: ${target ? (target.code + ' - ' + target.name) : id}`,
      targetId: id
    });

    return true;
  }

  // =========================================================================
  // 3. MANPOWER MODULE INTEGRATION & SEARCH
  // =========================================================================

  searchManpowerStaff(search = '') {
    const all = employeeService.getAllEmployees() || [];
    if (!search || !search.trim()) {
      return all.slice(0, 30);
    }
    const q = search.toLowerCase().trim();
    return all.filter(e =>
      (e.cardNumber && String(e.cardNumber).toLowerCase().includes(q)) ||
      (e.name && e.name.toLowerCase().includes(q)) ||
      (e.designation && e.designation.toLowerCase().includes(q)) ||
      (e.workingArea && e.workingArea.toLowerCase().includes(q))
    );
  }

  searchPrintMechanics(search = '') {
    const raw = String(search || '').trim();
    if (!raw) return [];
    const query = raw.toLowerCase();
    const cleanAlphaNum = query.replace(/[^a-z0-9]/g, '');

    const allocs = storage.getTable(TABLE_NAMES.TOOL_ALLOCATIONS) || [];
    const emps = employeeService.getAllEmployees() || [];

    const regMap = new Map();
    allocs.forEach(a => {
      const key = String(a.regNo || a.userId || '').trim();
      if (!key) return;
      if (!regMap.has(key)) {
        regMap.set(key, {
          regNo: a.regNo || '',
          userId: a.userId || '',
          userName: a.userName || '',
          jobTitle: a.jobTitle || '',
          workingArea: a.workingArea || '',
          issueDate: a.issueDate || '',
          toolCount: 0,
          hasAllocation: true
        });
      }
      if (a.itemType === 'TOOL') {
        regMap.get(key).toolCount++;
      }
    });

    const results = [];
    const seenCards = new Set();
    const seenRegs = new Set();

    // 1. Search saved allocations
    const cleanDigits = query.replace(/[^\d]/g, '');
    const queryNormReg = query.replace(/^[#\s]+/, '');
    for (const item of regMap.values()) {
      const uCard = String(item.userId || '').toLowerCase();
      const uReg = String(item.regNo || '').toLowerCase();
      const uName = String(item.userName || '').toLowerCase();
      const uAlpha = uCard.replace(/[^a-z0-9]/g, '');
      const uDigits = uCard.replace(/[^\d]/g, '');
      const normReg = uReg.replace(/^[#\s]+/, '');

      const matchReg = (uReg && uReg.includes(query)) || (normReg && normReg.includes(queryNormReg));
      const matchCard = (uCard && uCard.includes(query)) ||
        (cleanAlphaNum.length >= 2 && uAlpha.includes(cleanAlphaNum)) ||
        (cleanDigits.length >= 3 && (uDigits.includes(cleanDigits) || cleanDigits.includes(uDigits)));
      const matchName = uName && uName.includes(query);

      if (matchReg || matchCard || matchName) {
        results.push(item);
        if (uCard) seenCards.add(uCard);
        if (uAlpha) seenCards.add(uAlpha);
        if (uReg) seenRegs.add(uReg);
      }
    }

    // 2. Search manpower employees
    for (const e of emps) {
      const cCard = String(e.cardNumber || e.id || '').toLowerCase();
      const cAlpha = cCard.replace(/[^a-z0-9]/g, '');
      const cName = String(e.name || '').toLowerCase();

      if (seenCards.has(cCard) || seenCards.has(cAlpha)) continue;

      const matchCard = (cCard && cCard.includes(query)) || (cleanAlphaNum.length >= 2 && cAlpha.includes(cleanAlphaNum));
      const matchName = cName && cName.includes(query);

      if (matchCard || matchName) {
        results.push({
          regNo: '',
          userId: e.cardNumber || e.id,
          userName: e.name || '',
          jobTitle: e.designation || 'Mechanic',
          workingArea: e.workingArea || e.department || '',
          issueDate: '',
          toolCount: 0,
          hasAllocation: false
        });
        seenCards.add(cCard);
        if (cAlpha) seenCards.add(cAlpha);
      }
    }

    // Sort: Exact startsWith gets highest priority
    results.sort((a, b) => {
      const aRegStart = a.regNo && a.regNo.toLowerCase().startsWith(query);
      const bRegStart = b.regNo && b.regNo.toLowerCase().startsWith(query);
      if (aRegStart && !bRegStart) return -1;
      if (!aRegStart && bRegStart) return 1;

      const aCardStart = a.userId && a.userId.toLowerCase().startsWith(query);
      const bCardStart = b.userId && b.userId.toLowerCase().startsWith(query);
      if (aCardStart && !bCardStart) return -1;
      if (!aCardStart && bCardStart) return 1;

      const aNameStart = a.userName && a.userName.toLowerCase().startsWith(query);
      const bNameStart = b.userName && b.userName.toLowerCase().startsWith(query);
      if (aNameStart && !bNameStart) return -1;
      if (!aNameStart && bNameStart) return 1;

      return 0;
    });

    return results.slice(0, 10);
  }

  getStaffByIdOrCard(idOrCard) {
    if (!idOrCard) return null;
    const raw = String(idOrCard).trim();
    if (!raw) return null;

    const cleanLower = raw.toLowerCase();
    const cleanAlphaNum = cleanLower.replace(/[^a-z0-9]/g, '');
    const cleanDigits = cleanLower.replace(/[^\d]/g, '');

    const all = employeeService.getAllEmployees() || [];

    // 1. Exact match by cardNumber, id, or name
    let match = all.find(e =>
      String(e.cardNumber || '').trim().toLowerCase() === cleanLower ||
      String(e.id || '').trim().toLowerCase() === cleanLower ||
      String(e.name || '').trim().toLowerCase() === cleanLower
    );
    if (match) return match;

    // 2. Alphanumeric match ignoring dashes/spaces (e.g. AMG0147075 matches AMG-0147075)
    if (cleanAlphaNum.length >= 3) {
      match = all.find(e => {
        const cCard = String(e.cardNumber || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const cId = String(e.id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        return cCard === cleanAlphaNum || cId === cleanAlphaNum;
      });
      if (match) return match;
    }

    // 3. Digits match if numeric (e.g. 0147075 or 72256)
    if (cleanDigits.length >= 4) {
      match = all.find(e => {
        const dCard = String(e.cardNumber || '').replace(/[^\d]/g, '');
        const dId = String(e.id || '').replace(/[^\d]/g, '');
        return (dCard && dCard.endsWith(cleanDigits)) || (dId && dId.endsWith(cleanDigits)) || (cleanDigits.length >= 5 && (dCard.includes(cleanDigits) || dId.includes(cleanDigits)));
      });
      if (match) return match;
    }

    // 4. Name substring match
    if (cleanLower.length >= 3) {
      match = all.find(e => String(e.name || '').toLowerCase().includes(cleanLower));
      if (match) return match;
    }

    return null;
  }

  // =========================================================================
  // 4. REGISTRATION NUMBERS & ALLOCATIONS
  // =========================================================================

  formatDateDMY(d) {
    if (!d) return '25-10-2025';
    const str = String(d).trim();
    if (!str) return '25-10-2025';

    // If YYYY-MM-DD (e.g. 2025-10-25)
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      const [yyyy, mm, dd] = str.split('-');
      return `${dd}-${mm}-${yyyy}`;
    }

    // If DD-MM-YYYY or DD/MM/YYYY
    if (/^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/.test(str)) {
      const parts = str.split(/[-/]/);
      const dd = parts[0].padStart(2, '0');
      const mm = parts[1].padStart(2, '0');
      const yyyy = parts[2];
      return `${dd}-${mm}-${yyyy}`;
    }

    // If DD-MMM-YYYY (e.g. 25-Oct-2025)
    const monthNames = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
    };
    const mmmMatch = str.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
    if (mmmMatch) {
      const dd = mmmMatch[1].padStart(2, '0');
      const mStr = mmmMatch[2].toLowerCase();
      const mm = monthNames[mStr] || '10';
      const yyyy = mmmMatch[3];
      return `${dd}-${mm}-${yyyy}`;
    }

    const dt = new Date(str);
    if (!isNaN(dt.getTime())) {
      const dd = String(dt.getDate()).padStart(2, '0');
      const mm = String(dt.getMonth() + 1).padStart(2, '0');
      const yyyy = dt.getFullYear();
      return `${dd}-${mm}-${yyyy}`;
    }
    return str;
  }

  getNextRegistrationNumber() {
    const list = storage.getTable(TABLE_NAMES.TOOL_ALLOCATIONS) || [];
    let maxReg = 1180;

    // Check all active allocations in storage
    list.forEach(a => {
      if (a && a.regNo) {
        const cleanDigits = String(a.regNo).replace(/[^\d]/g, '');
        const num = parseInt(cleanDigits, 10);
        if (!isNaN(num) && num > maxReg) {
          maxReg = num;
        }
      }
    });

    // Also check change history records for any higher historical reg numbers
    const historyList = storage.getTable(TABLE_NAMES.TOOL_CHANGE_HISTORY) || [];
    historyList.forEach(h => {
      if (h && h.regNo) {
        const cleanDigits = String(h.regNo).replace(/[^\d]/g, '');
        const num = parseInt(cleanDigits, 10);
        if (!isNaN(num) && num > maxReg) {
          maxReg = num;
        }
      }
    });

    return String(maxReg + 1);
  }

  isRegistrationNumberAvailable(regNo, excludeUserId = null) {
    if (!regNo) return false;
    const cleanReg = String(regNo).trim().toLowerCase();
    const list = storage.getTable(TABLE_NAMES.TOOL_ALLOCATIONS) || [];

    const existing = list.find(a => String(a.regNo || '').trim().toLowerCase() === cleanReg);
    if (!existing) return true;

    // If excludeUserId is provided (editing the same user's existing registration), it is allowed
    if (excludeUserId && String(existing.userId || '').trim().toLowerCase() === String(excludeUserId).trim().toLowerCase()) {
      return true;
    }

    return false;
  }

  getRecentRegistrations(limit = 10) {
    this.syncAllocationsWithManpower();
    const list = storage.getTable(TABLE_NAMES.TOOL_ALLOCATIONS) || [];
    const regMap = new Map();

    list.forEach(item => {
      const r = String(item.regNo || 'UNKNOWN');
      if (!regMap.has(r)) {
        regMap.set(r, {
          regNo: r,
          issueDate: item.issueDate || '2025-10-25',
          userId: item.userId || 'N/A',
          userName: item.userName || 'N/A',
          jobTitle: item.jobTitle || 'N/A',
          workingArea: item.workingArea || 'N/A',
          totalItems: 0,
          toolsCount: 0,
          accessoriesCount: 0,
          replacedCount: 0,
          lastCreatedAt: item.createdAt || ''
        });
      }
      const entry = regMap.get(r);
      entry.totalItems += 1;
      if (item.itemType === 'TOOL') entry.toolsCount += 1;
      if (item.itemType === 'ACCESSORY') entry.accessoriesCount += 1;
      if (item.changeStatus === 'REPLACED') entry.replacedCount += 1;
    });

    const sorted = Array.from(regMap.values()).sort((a, b) => {
      const numA = parseInt(a.regNo, 10) || 0;
      const numB = parseInt(b.regNo, 10) || 0;
      return numB - numA;
    });

    return limit ? sorted.slice(0, limit) : sorted;
  }

  /**
   * Automatically synchronizes stored Tool Allocations with the latest Manpower data.
   * Handles promotions (designation/jobTitle changes), floor/line transfers (workingArea changes),
   * and worker-to-staff card upgrades (AMG0000000 -> AMG-0000000, hyphen rule).
   */
  syncAllocationsWithManpower() {
    let allocations = storage.getTable(TABLE_NAMES.TOOL_ALLOCATIONS) || [];
    if (allocations.length === 0) return { updatedCount: 0 };

    let updatedCount = 0;
    let modified = false;

    allocations.forEach(alloc => {
      const emp = this.getStaffByIdOrCard(alloc.userId || alloc.userName);
      if (!emp) return;

      let changed = false;
      const latestCard = emp.cardNumber || emp.id;
      const latestName = emp.name;
      const latestTitle = emp.designation;
      const latestArea = emp.workingArea || emp.department;

      if (latestCard && alloc.userId !== latestCard) {
        alloc.userId = latestCard;
        changed = true;
      }
      if (latestName && alloc.userName !== latestName) {
        alloc.userName = latestName;
        changed = true;
      }
      if (latestTitle && alloc.jobTitle !== latestTitle) {
        alloc.jobTitle = latestTitle;
        changed = true;
      }
      if (latestArea && alloc.workingArea !== latestArea) {
        alloc.workingArea = latestArea;
        changed = true;
      }

      if (changed) {
        alloc.syncedWithManpowerAt = new Date().toISOString();
        updatedCount++;
        modified = true;
      }
    });

    if (modified) {
      storage.saveTable(TABLE_NAMES.TOOL_ALLOCATIONS, allocations);
      console.log(`[ToolService] Auto-synced ${updatedCount} tool allocation records with latest Manpower data.`);
    }

    return { updatedCount };
  }

  getRegistrationDetails(regNoOrCard) {
    if (!regNoOrCard) return null;
    const raw = String(regNoOrCard).trim();
    if (!raw) return null;

    // Ensure allocations are synchronized with latest Manpower employee updates
    try {
      this.syncAllocationsWithManpower();
    } catch (e) {
      console.warn('[ToolService] Auto-sync in getRegistrationDetails non-critical warning:', e);
    }

    const cleanLower = raw.toLowerCase();
    const normReg = cleanLower.replace(/^[#\s]+/, '').trim();
    const cleanAlphaNum = cleanLower.replace(/[^a-z0-9]/g, '');
    const cleanDigits = cleanLower.replace(/[^\d]/g, '');

    const list = storage.getTable(TABLE_NAMES.TOOL_ALLOCATIONS) || [];

    // 1. Match by registration number (ignoring leading #, whitespace, case)
    let items = list.filter(a => {
      const aReg = String(a.regNo || '').replace(/^[#\s]+/, '').trim().toLowerCase();
      return aReg && aReg === normReg;
    });

    // 2. Match by exact userId / Employee Card Number (e.g. AMG-0051370 or AMG0051370)
    if (items.length === 0) {
      items = list.filter(a => String(a.userId || '').trim().toLowerCase() === cleanLower);
    }

    // 3. Match by normalized alphanumeric Card Number (ignoring hyphens: AMG-0051370 vs AMG0051370)
    if (items.length === 0 && cleanAlphaNum.length >= 3) {
      items = list.filter(a => {
        const uAlphaNum = String(a.userId || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        return uAlphaNum === cleanAlphaNum;
      });
    }

    // 4. Match by pure digits (e.g. 0051370 vs 51370, endsWith, integer match)
    if (items.length === 0 && cleanDigits.length >= 3) {
      items = list.filter(a => {
        const uDigits = String(a.userId || '').replace(/[^\d]/g, '');
        if (!uDigits) return false;
        return (
          uDigits === cleanDigits ||
          uDigits.endsWith(cleanDigits) ||
          cleanDigits.endsWith(uDigits) ||
          (parseInt(uDigits, 10) === parseInt(cleanDigits, 10))
        );
      });
    }

    // 5. Match by employee name substring
    if (items.length === 0 && cleanLower.length >= 3) {
      items = list.filter(a => String(a.userName || '').toLowerCase().includes(cleanLower));
    }

    // 6. Cross-reference with Manpower master employee profile if not directly found in raw allocations
    let emp = null;
    if (items.length === 0) {
      emp = this.getStaffByIdOrCard(raw);
      if (emp) {
        const empCard = String(emp.cardNumber || '').trim().toLowerCase();
        const empId = String(emp.id || '').trim().toLowerCase();
        const empName = String(emp.name || '').trim().toLowerCase();
        const empDigits = empCard.replace(/[^\d]/g, '') || empId.replace(/[^\d]/g, '');

        items = list.filter(a => {
          const aUser = String(a.userId || '').trim().toLowerCase();
          const aName = String(a.userName || '').trim().toLowerCase();
          const aDigits = aUser.replace(/[^\d]/g, '');

          if (empCard && (aUser === empCard || aUser.replace(/[^a-z0-9]/g, '') === empCard.replace(/[^a-z0-9]/g, ''))) return true;
          if (empId && aUser === empId) return true;
          if (empName && (aName === empName || (empName.length >= 4 && aName.includes(empName)))) return true;
          if (empDigits && aDigits && (
            empDigits === aDigits ||
            empDigits.endsWith(aDigits) ||
            aDigits.endsWith(empDigits) ||
            parseInt(empDigits, 10) === parseInt(aDigits, 10)
          )) return true;
          return false;
        });
      }
    }

    // If still 0 allocations, and employee was found in Manpower, return active template for this employee
    if (items.length === 0) {
      if (!emp) emp = this.getStaffByIdOrCard(raw);
      if (emp) {
        return {
          regNo: '',
          issueDate: new Date().toISOString().split('T')[0],
          userId: emp.cardNumber || emp.id || raw,
          userName: emp.name || '',
          jobTitle: emp.designation || '',
          workingArea: emp.workingArea || emp.department || '',
          items: [],
          tools: [],
          accessories: [],
          spareParts: [],
          totalItems: 0,
          totalTools: 0
        };
      }
      return null;
    }

    // If matching by employee resulted in multiple historical registration batches, pick the latest one
    const uniqueRegs = [...new Set(items.map(i => String(i.regNo || '').trim()).filter(Boolean))];
    if (uniqueRegs.length > 1 && !raw.startsWith('#') && isNaN(parseInt(raw, 10))) {
      uniqueRegs.sort((rA, rB) => {
        const numA = parseInt(String(rA).replace(/[^\d]/g, ''), 10) || 0;
        const numB = parseInt(String(rB).replace(/[^\d]/g, ''), 10) || 0;
        return numB - numA;
      });
      const latestReg = uniqueRegs[0];
      items = items.filter(i => String(i.regNo || '').trim() === latestReg);
    }

    const first = items[0];
    const tools = items.filter(i => (i.itemType === 'TOOL' || !i.itemType || i.itemType === 'TOOLS')).sort((a, b) => {
      const codeA = parseInt(a.itemCode, 10) || 0;
      const codeB = parseInt(b.itemCode, 10) || 0;
      return codeA - codeB;
    });
    const accessories = items.filter(i => i.itemType === 'ACCESSORY' || i.itemType === 'ACCESSORIES');
    const spareParts = items.filter(i => i.itemType === 'SPARE_PART' || i.itemType === 'SPARE_PARTS');

    // LIVE DYNAMIC AUTO-SYNC WITH LATEST MANPOWER PROFILE
    // If employee got promoted, transferred floors, or upgraded to staff (with hyphen),
    // always return their live Manpower data on print documents!
    const latestEmp = emp || this.getStaffByIdOrCard(first.userId || first.userName || raw);

    const resolvedUserId = (latestEmp && latestEmp.cardNumber) ? latestEmp.cardNumber : (first.userId || raw);
    const resolvedUserName = (latestEmp && latestEmp.name) ? latestEmp.name : (first.userName || '');
    const resolvedJobTitle = (latestEmp && latestEmp.designation) ? latestEmp.designation : (first.jobTitle || '');
    const resolvedWorkingArea = (latestEmp && (latestEmp.workingArea || latestEmp.department)) ? (latestEmp.workingArea || latestEmp.department) : (first.workingArea || '');
    const isStaff = resolvedUserId.includes('-');

    return {
      regNo: String(first.regNo || raw).replace(/^[#\s]+/, '').trim(),
      issueDate: first.issueDate || new Date().toISOString().split('T')[0],
      userId: resolvedUserId,
      userName: resolvedUserName,
      jobTitle: resolvedJobTitle,
      workingArea: resolvedWorkingArea,
      items,
      tools,
      accessories,
      spareParts,
      totalItems: items.length,
      totalTools: tools.length,
      totalAccessories: accessories.length,
      isStaff
    };
  }

  getAllocations(filters = {}) {
    this.syncAllocationsWithManpower();
    let list = storage.getTable(TABLE_NAMES.TOOL_ALLOCATIONS) || [];

    if (filters.search && filters.search.trim()) {
      const q = filters.search.toLowerCase().trim();
      list = list.filter(a =>
        (a.userName && a.userName.toLowerCase().includes(q)) ||
        (a.userId && String(a.userId).toLowerCase().includes(q)) ||
        (a.regNo && String(a.regNo).toLowerCase().includes(q)) ||
        (a.itemName && a.itemName.toLowerCase().includes(q)) ||
        (a.itemCode && String(a.itemCode).toLowerCase().includes(q)) ||
        (a.workingArea && a.workingArea.toLowerCase().includes(q)) ||
        (a.remarks && a.remarks.toLowerCase().includes(q))
      );
    }

    if (filters.regNo && filters.regNo !== 'ALL' && filters.regNo.trim()) {
      const r = String(filters.regNo).trim();
      list = list.filter(a => String(a.regNo).trim() === r);
    }

    if (filters.userId && filters.userId !== 'ALL' && filters.userId.trim()) {
      const u = String(filters.userId).trim().toLowerCase();
      list = list.filter(a => String(a.userId).trim().toLowerCase() === u);
    }

    if (filters.itemType && filters.itemType !== 'ALL') {
      list = list.filter(a => a.itemType === filters.itemType);
    }

    if (filters.changeStatus && filters.changeStatus !== 'ALL') {
      list = list.filter(a => {
        if (filters.changeStatus === 'LOST') {
          return a.changeStatus === 'LOST' || a.changeStatus === 'RETURNED';
        }
        return a.changeStatus === filters.changeStatus;
      });
    }

    if (filters.dateFrom) {
      list = list.filter(a => a.issueDate >= filters.dateFrom);
    }
    if (filters.dateTo) {
      list = list.filter(a => a.issueDate <= filters.dateTo);
    }

    return list.sort((a, b) => {
      const regA = parseInt(a.regNo, 10) || 0;
      const regB = parseInt(b.regNo, 10) || 0;
      if (regA !== regB) return regB - regA;
      return (parseInt(a.itemCode, 10) || 0) - (parseInt(b.itemCode, 10) || 0);
    });
  }

  async saveAllocationBatch({ regNo, issueDate, user, items, forceNextRegIfDuplicate = false }) {
    if (!regNo) throw new Error('Registration number is required.');
    if (!user || !user.userId) throw new Error('User / Employee Information is required.');
    if (!items || items.length === 0) throw new Error('Please add at least one tool or accessory to allocate.');

    const list = storage.getTable(TABLE_NAMES.TOOL_ALLOCATIONS) || [];
    const masterTools = storage.getTable(TABLE_NAMES.TOOLS_MASTER) || [];
    const masterAccs = storage.getTable(TABLE_NAMES.ACCESSORIES_MASTER) || [];
    const currentUser = authService.getCurrentUser()?.username || 'admin';
    const now = new Date().toISOString();

    const cleanReg = String(regNo).trim();
    const cleanUserId = String(user.userId).trim();

    // Check if this regNo is already assigned to a DIFFERENT mechanic (collision prevention)
    const existingOther = list.find(a =>
      String(a.regNo || '').trim() === cleanReg &&
      String(a.userId || '').trim().toLowerCase() !== cleanUserId.toLowerCase()
    );

    let finalRegNo = cleanReg;
    if (existingOther) {
      if (forceNextRegIfDuplicate) {
        finalRegNo = this.getNextRegistrationNumber();
      } else {
        throw new Error(`Registration No #${cleanReg} is already assigned to ${existingOther.userName} (${existingOther.userId}). Duplicate registration numbers are strictly prevented. Next available dynamic Reg No is #${this.getNextRegistrationNumber()}.`);
      }
    }

    const createdItems = [];

    items.forEach((item, index) => {
      const allocId = `alloc-${finalRegNo}-${item.itemType === 'TOOL' ? 't' : 'a'}-${Date.now()}-${index + 1}`;
      const newAlloc = {
        id: allocId,
        regNo: finalRegNo,
        requisitionNo: String(item.requisitionNo || user.requisitionNo || '').trim(),
        issueDate: this.formatDateDMY(issueDate || item.issueDate),
        userId: String(user.userId).trim(),
        userName: String(user.userName || '').trim(),
        jobTitle: String(user.jobTitle || '').trim(),
        workingArea: String(user.workingArea || '').trim(),
        itemType: item.itemType || 'TOOL',
        itemCode: String(item.itemCode || '').trim(),
        itemName: String(item.itemName || '').trim(),
        quantity: item.quantity || '1',
        changeStatus: item.changeStatus || 'NEW_ISSUE',
        changeDate: item.changeDate || null,
        remarks: item.remarks || '',
        status: item.status || 'ACTIVE',
        createdAt: now,
        createdBy: currentUser
      };

      list.push(newAlloc);
      createdItems.push(newAlloc);

      // Decrement stock in master catalog if numeric
      const numericQty = parseInt(item.quantity, 10) || 1;
      if (item.itemType === 'TOOL') {
        const tIdx = masterTools.findIndex(t => String(t.code).trim() === String(item.itemCode).trim());
        if (tIdx !== -1 && masterTools[tIdx].totalStock > 0) {
          masterTools[tIdx].totalStock = Math.max(0, masterTools[tIdx].totalStock - numericQty);
        }
      } else if (item.itemType === 'ACCESSORY') {
        const aIdx = masterAccs.findIndex(a => a.name.toLowerCase() === item.itemName.toLowerCase());
        if (aIdx !== -1 && typeof masterAccs[aIdx].totalStock === 'number') {
          masterAccs[aIdx].totalStock = Math.max(0, masterAccs[aIdx].totalStock - numericQty);
        }
      }
    });

    // CONFIRMED WRITE: await Database write for all 3 tables
    const allocOk = await storage.saveTable(TABLE_NAMES.TOOL_ALLOCATIONS, list);
    const toolsOk = await storage.saveTable(TABLE_NAMES.TOOLS_MASTER, masterTools);
    const accsOk = await storage.saveTable(TABLE_NAMES.ACCESSORIES_MASTER, masterAccs);
    if (!allocOk || !toolsOk || !accsOk) {
      throw new CloudSaveError('❌ Cloud Save Failed: Tool allocation batch was not fully confirmed by the cloud.');
    }

    auditService.log({
      action: 'SAVE_TOOL_ALLOCATION_BATCH',
      details: `Saved ${createdItems.length} tool/accessory items for Reg No #${regNo} (${user.userName} - ${user.userId})`,
      targetId: regNo
    });

    return {
      regNo,
      count: createdItems.length,
      items: createdItems
    };
  }

  async updateAllocationItem(id, updates) {
    const list = storage.getTable(TABLE_NAMES.TOOL_ALLOCATIONS) || [];
    const idx = list.findIndex(a => a.id === id);
    if (idx === -1) throw new Error('Allocation record not found.');

    list[idx] = {
      ...list[idx],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    // CONFIRMED WRITE: await Database write
    const ok = await storage.saveTable(TABLE_NAMES.TOOL_ALLOCATIONS, list);
    if (!ok) throw new CloudSaveError('❌ Cloud Save Failed: Tool allocation update was not confirmed by the cloud.');

    auditService.log({
      action: 'UPDATE_TOOL_ALLOCATION',
      details: `Updated allocation item #${id} (Status: ${updates.changeStatus || list[idx].changeStatus})`,
      targetId: id
    });

    return list[idx];
  }

  async deleteAllocationItem(id) {
    let list = storage.getTable(TABLE_NAMES.TOOL_ALLOCATIONS) || [];
    const target = list.find(a => a.id === id);
    if (!target) throw new Error('Allocation record not found.');

    list = list.filter(a => a.id !== id);
    // CONFIRMED WRITE: await Database write
    const ok = await storage.saveTable(TABLE_NAMES.TOOL_ALLOCATIONS, list);
    if (!ok) throw new CloudSaveError('❌ Cloud Save Failed: Tool allocation deletion was not confirmed by the cloud.');

    auditService.log({
      action: 'DELETE_TOOL_ALLOCATION_ITEM',
      details: `Deleted allocation item ${target.itemName} from Reg No #${target.regNo}`,
      targetId: id
    });

    return true;
  }

  async deleteRegistrationBatch(regNo) {
    let list = storage.getTable(TABLE_NAMES.TOOL_ALLOCATIONS) || [];
    const count = list.filter(a => String(a.regNo).trim() === String(regNo).trim()).length;
    list = list.filter(a => String(a.regNo).trim() !== String(regNo).trim());
    // CONFIRMED WRITE: await Database write
    const ok = await storage.saveTable(TABLE_NAMES.TOOL_ALLOCATIONS, list);
    if (!ok) throw new CloudSaveError('❌ Cloud Save Failed: Registration batch deletion was not confirmed by the cloud.');

    auditService.log({
      action: 'DELETE_TOOL_REGISTRATION_BATCH',
      details: `Deleted full registration batch Reg No #${regNo} (${count} items)`,
      targetId: regNo
    });

    return count;
  }

  async deleteAllocationsBatch(ids) {
    if (!Array.isArray(ids) || ids.length === 0) return 0;
    let list = storage.getTable(TABLE_NAMES.TOOL_ALLOCATIONS) || [];
    const idSet = new Set(ids);
    const initialCount = list.length;
    list = list.filter(a => !idSet.has(a.id));
    const deletedCount = initialCount - list.length;
    // CONFIRMED WRITE: await Database write
    const ok = await storage.saveTable(TABLE_NAMES.TOOL_ALLOCATIONS, list);
    if (!ok) throw new CloudSaveError('❌ Cloud Save Failed: Bulk tool allocation deletion was not confirmed by the cloud.');

    auditService.log({
      action: 'BULK_DELETE_TOOL_ALLOCATIONS',
      details: `Admin bulk deleted ${deletedCount} tool allocation records.`,
      targetId: 'BULK'
    });

    return deletedCount;
  }

  // =========================================================================
  // 4B. TOOL CHANGE & REPLACEMENT HISTORY TRACKING
  // =========================================================================

  recordToolChangeHistory({
    allocationId,
    regNo,
    userId,
    userName,
    workingArea,
    itemType = 'TOOL',
    itemCode,
    itemName,
    changeType = 'REPLACED',
    changeDate = null,
    reason = 'Broken / Worn Out',
    oldCondition = 'Broken (Returned)',
    remarks = '',
    changedBy = 'admin'
  }) {
    const historyList = storage.getTable(TABLE_NAMES.TOOL_CHANGE_HISTORY) || [];
    const cleanUserId = String(userId || '').trim();
    const cleanCode = String(itemCode || '').trim();
    const formattedDate = this.formatDateDMY(changeDate || new Date().toISOString().split('T')[0]);

    // Calculate prior replacement count for this user and itemCode
    const userPriorReplacements = historyList.filter(h =>
      String(h.userId || '').trim().toLowerCase() === cleanUserId.toLowerCase() &&
      String(h.itemCode || '').trim().toLowerCase() === cleanCode.toLowerCase() &&
      h.changeType === 'REPLACED'
    );
    const newReplacementCount = userPriorReplacements.length + 1;

    const historyRecord = {
      id: `thist-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      allocationId: allocationId || '',
      regNo: regNo || '',
      userId: cleanUserId,
      userName: userName || '',
      workingArea: workingArea || '',
      itemType: itemType || 'TOOL',
      itemCode: cleanCode,
      itemName: itemName || '',
      changeType: changeType || 'REPLACED',
      replacementCount: newReplacementCount,
      changeDate: formattedDate,
      reason: reason || 'Broken / Worn Out',
      oldCondition: oldCondition || 'Broken',
      remarks: remarks || '',
      changedBy: changedBy || 'admin',
      createdAt: new Date().toISOString()
    };

    historyList.unshift(historyRecord);
    storage.saveTable(TABLE_NAMES.TOOL_CHANGE_HISTORY, historyList);

    // If allocationId is provided, also update the allocation item
    let updatedAllocation = null;
    if (allocationId) {
      const allocList = storage.getTable(TABLE_NAMES.TOOL_ALLOCATIONS) || [];
      const idx = allocList.findIndex(a => a.id === allocationId);
      if (idx !== -1) {
        allocList[idx].changeStatus = changeType;
        allocList[idx].changeDate = formattedDate;
        allocList[idx].replacementCount = newReplacementCount;
        allocList[idx].remarks = remarks ? `${remarks} (Replaced #${newReplacementCount} on ${formattedDate})` : `Replaced #${newReplacementCount} on ${formattedDate}`;
        allocList[idx].updatedAt = new Date().toISOString();
        updatedAllocation = allocList[idx];
        storage.saveTable(TABLE_NAMES.TOOL_ALLOCATIONS, allocList);
      }
    }

    auditService.log({
      action: 'RECORD_TOOL_CHANGE_HISTORY',
      details: `Logged tool replacement (#${newReplacementCount}) for ${userName} (${cleanUserId}) - Tool: ${itemName} (${cleanCode}) on ${formattedDate}`,
      targetId: historyRecord.id
    });

    return {
      success: true,
      historyRecord,
      updatedAllocation,
      replacementCount: newReplacementCount
    };
  }

  getToolChangeHistory(filters = {}) {
    let list = storage.getTable(TABLE_NAMES.TOOL_CHANGE_HISTORY) || [];

    if (filters.userId && filters.userId.trim()) {
      const u = filters.userId.trim().toLowerCase();
      list = list.filter(h =>
        String(h.userId || '').toLowerCase().includes(u) ||
        String(h.userName || '').toLowerCase().includes(u)
      );
    }

    if (filters.regNo && filters.regNo.trim()) {
      const r = filters.regNo.trim().toLowerCase();
      list = list.filter(h => String(h.regNo || '').toLowerCase().includes(r));
    }

    if (filters.itemCode && filters.itemCode.trim()) {
      const c = filters.itemCode.trim().toLowerCase();
      list = list.filter(h => String(h.itemCode || '').toLowerCase() === c);
    }

    if (filters.changeType && filters.changeType !== 'ALL') {
      list = list.filter(h => h.changeType === filters.changeType);
    }

    if (filters.search && filters.search.trim()) {
      const q = filters.search.trim().toLowerCase();
      list = list.filter(h =>
        String(h.userName || '').toLowerCase().includes(q) ||
        String(h.userId || '').toLowerCase().includes(q) ||
        String(h.itemName || '').toLowerCase().includes(q) ||
        String(h.itemCode || '').toLowerCase().includes(q) ||
        String(h.reason || '').toLowerCase().includes(q) ||
        String(h.remarks || '').toLowerCase().includes(q) ||
        String(h.regNo || '').toLowerCase().includes(q)
      );
    }

    return list;
  }

  getUserToolChangeSummary(userIdOrCard) {
    if (!userIdOrCard) return null;
    const cleanId = String(userIdOrCard).trim().toLowerCase();
    const historyList = storage.getTable(TABLE_NAMES.TOOL_CHANGE_HISTORY) || [];
    const allocList = storage.getTable(TABLE_NAMES.TOOL_ALLOCATIONS) || [];

    // Filter history for this user
    const userHistory = historyList.filter(h =>
      String(h.userId || '').trim().toLowerCase() === cleanId ||
      String(h.userName || '').trim().toLowerCase() === cleanId
    );

    // Filter allocations for this user
    const userAllocations = allocList.filter(a =>
      String(a.userId || '').trim().toLowerCase() === cleanId ||
      String(a.userName || '').trim().toLowerCase() === cleanId
    );

    // Group frequency by itemCode
    const frequencyMap = new Map();
    userHistory.forEach(h => {
      const code = String(h.itemCode || 'UNKNOWN').trim();
      if (!frequencyMap.has(code)) {
        frequencyMap.set(code, {
          itemCode: code,
          itemName: h.itemName || code,
          itemType: h.itemType || 'TOOL',
          replaceCount: 0,
          lastChangeDate: h.changeDate || '',
          lastReason: h.reason || '',
          events: []
        });
      }
      const entry = frequencyMap.get(code);
      if (h.changeType === 'REPLACED') {
        entry.replaceCount += 1;
      }
      entry.events.push(h);
    });

    const toolBreakdown = Array.from(frequencyMap.values()).sort((a, b) => b.replaceCount - a.replaceCount);

    const totalReplacements = userHistory.filter(h => h.changeType === 'REPLACED').length;
    const mostReplacedTool = toolBreakdown.length > 0 && toolBreakdown[0].replaceCount > 0 ? toolBreakdown[0] : null;

    const firstItem = userAllocations[0] || userHistory[0] || {};

    return {
      userId: firstItem.userId || userIdOrCard,
      userName: firstItem.userName || 'Unknown Mechanic',
      workingArea: firstItem.workingArea || 'N/A',
      totalAllocated: userAllocations.length,
      totalReplacements,
      distinctToolsChanged: toolBreakdown.filter(t => t.replaceCount > 0).length,
      mostReplacedTool,
      toolBreakdown,
      history: userHistory
    };
  }

  getToolReplacementCount(userIdOrCard, itemCode) {
    if (!userIdOrCard || !itemCode) return 0;
    const cleanId = String(userIdOrCard).trim().toLowerCase();
    const cleanCode = String(itemCode).trim().toLowerCase();
    const historyList = storage.getTable(TABLE_NAMES.TOOL_CHANGE_HISTORY) || [];

    return historyList.filter(h =>
      (String(h.userId || '').trim().toLowerCase() === cleanId || String(h.userName || '').trim().toLowerCase() === cleanId) &&
      String(h.itemCode || '').trim().toLowerCase() === cleanCode &&
      h.changeType === 'REPLACED'
    ).length;
  }

  // =========================================================================
  // 5. STANDARD MECHANIC KIT PRESETS (28 Tools + 10 Accessories)
  // =========================================================================

  getStandardMechanicKit() {
    const tools = this.getAllMasterTools();
    const accessories = this.getAllMasterAccessories();

    const kitItems = [];

    tools.forEach((t, i) => {
      kitItems.push({
        itemType: 'TOOL',
        itemCode: t.code,
        itemName: `${t.code}.${t.name}`,
        rawName: t.name,
        quantity: '1',
        changeStatus: 'NEW_ISSUE',
        changeDate: null,
        remarks: ''
      });
    });

    accessories.forEach((a, i) => {
      kitItems.push({
        itemType: 'ACCESSORY',
        itemCode: a.code || `ACC-${i + 1}`,
        itemName: a.name,
        rawName: a.name,
        quantity: a.defaultQty || '01 Pcs',
        changeStatus: 'NEW_ISSUE',
        changeDate: null,
        remarks: a.defaultRemarks || ''
      });
    });

    return kitItems;
  }

  // =========================================================================
  // 6. EXCEL BULK IMPORT & EXPORT ENGINE
  // =========================================================================

  generateAllocationTemplateExcel() {
    if (typeof XLSX === 'undefined') {
      throw new Error('SheetJS library is not available.');
    }

    const headers = [
      'Registration No',
      'Issue Date (YYYY-MM-DD)',
      'ID Number',
      'User Name',
      'Job Title',
      'Working Area',
      'Item Type (TOOL/ACCESSORY)',
      'Equipment / Item Name',
      'Quantity',
      'Change Status (NEW_ISSUE/REPLACED/RETURNED)',
      'Change Date (Optional)',
      'Remarks'
    ];

    const sampleRows = [
      ['1196', '2025-10-25', 'AMG-0147075', 'Ashraful Alam Shahed', 'Senior Mechanic', 'Sewing - Jamuna', 'TOOL', '001.Flat Screw Driver (Large)', '1', 'NEW_ISSUE', '', ''],
      ['1196', '2025-10-25', 'AMG-0147075', 'Ashraful Alam Shahed', 'Senior Mechanic', 'Sewing - Jamuna', 'TOOL', '014.Pliers (Long Nose)', '1', 'NEW_ISSUE', '', ''],
      ['1196', '2025-10-25', 'AMG-0147075', 'Ashraful Alam Shahed', 'Senior Mechanic', 'Sewing - Jamuna', 'ACCESSORY', 'Super Glue', '01 Pcs', 'NEW_ISSUE', '', '#01'],
      ['1195', '2025-10-23', 'AMG0072256', 'Md. Jabad', 'Junior Mechanic (W)', 'Embroidery Section', 'TOOL', '021.Hex Allen Key (01.50mm)', '1', 'NEW_ISSUE', '', '']
    ];

    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
    ws['!cols'] = [
      { wch: 16 }, { wch: 22 }, { wch: 18 }, { wch: 25 }, { wch: 22 },
      { wch: 22 }, { wch: 26 }, { wch: 32 }, { wch: 12 }, { wch: 28 },
      { wch: 22 }, { wch: 20 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Tool_Allocations_Template');
    XLSX.writeFile(wb, 'Al_Muslim_Tools_Allocation_Import_Template.xlsx');
    return true;
  }

  importAllocationsFromExcel(dataRows) {
    if (!Array.isArray(dataRows) || dataRows.length === 0) {
      throw new Error('No data rows found in uploaded file.');
    }

    const list = storage.getTable(TABLE_NAMES.TOOL_ALLOCATIONS) || [];
    let insertedCount = 0;
    const errors = [];
    const currentUser = authService.getCurrentUser()?.username || 'admin';
    const now = new Date().toISOString();

    dataRows.forEach((row, idx) => {
      try {
        const regNo = String(row['Registration No'] || row['Reg. No'] || row['Reg No'] || row['regNo'] || '').trim();
        const userId = String(row['ID Number'] || row['User ID'] || row['Card Number'] || row['userId'] || '').trim();
        const userName = String(row['User Name'] || row['Employee Name'] || row['userName'] || '').trim();
        const rawItemName = String(row['Equipment / Item Name'] || row['Equipment Name'] || row['Item Name'] || row['Tool Name'] || '').trim();

        if (!rawItemName) {
          return; // Skip blank lines
        }

        // Try to resolve code and clean item name (e.g. "001.Flat Screw Driver (Large)" -> code "001", name "Flat Screw Driver (Large)")
        let code = '';
        let cleanName = rawItemName;
        const dotMatch = rawItemName.match(/^(\d{1,3})\s*[\.\-]\s*(.*)$/);
        if (dotMatch) {
          code = dotMatch[1].padStart(3, '0');
          cleanName = dotMatch[2].trim();
        }

        const itemType = String(row['Item Type'] || (code || rawItemName.toLowerCase().includes('screw') || rawItemName.toLowerCase().includes('allen') || rawItemName.toLowerCase().includes('spanner') || rawItemName.toLowerCase().includes('plier') || rawItemName.toLowerCase().includes('file') ? 'TOOL' : 'ACCESSORY')).toUpperCase();

        const finalRegNo = regNo || this.getNextRegistrationNumber();

        // Check if employee exists in Manpower or resolve
        const emp = this.getStaffByIdOrCard(userId) || this.getStaffByIdOrCard(userName);
        const resolvedUserId = userId || emp?.cardNumber || emp?.id || 'AMG-UNKNOWN';
        const resolvedUserName = userName || emp?.name || 'Unknown Mechanic';
        const jobTitle = String(row['Job Title'] || emp?.designation || 'Mechanic').trim();
        const workingArea = String(row['Working Area'] || row['Area'] || row['Line'] || emp?.workingArea || emp?.department || 'General').trim();
        const issueDate = this.formatDateDMY(String(row['Issue Date'] || row['Issue Date (YYYY-MM-DD)'] || '25-10-2025').trim());
        const qty = String(row['Quantity'] || row['Qty'] || '1').trim();
        const changeStatus = String(row['Change Status'] || 'NEW_ISSUE').toUpperCase();
        const changeDate = row['Change Date'] ? String(row['Change Date']).trim() : null;
        const remarks = String(row['Remarks'] || '').trim();

        const newEntry = {
          id: `alloc-imp-${Date.now()}-${idx + 1}`,
          regNo: finalRegNo,
          issueDate,
          userId: resolvedUserId,
          userName: resolvedUserName,
          jobTitle,
          workingArea,
          itemType,
          itemCode: code || (itemType === 'TOOL' ? '001' : 'ACC-01'),
          itemName: cleanName,
          quantity: qty,
          changeStatus: ['NEW_ISSUE', 'REPLACED', 'RETURNED', 'LOST'].includes(changeStatus) ? changeStatus : 'NEW_ISSUE',
          changeDate,
          remarks,
          status: 'ACTIVE',
          createdAt: now,
          createdBy: currentUser
        };

        list.push(newEntry);
        insertedCount++;
      } catch (err) {
        errors.push(`Row ${idx + 2}: ${err.message}`);
      }
    });

    storage.saveTable(TABLE_NAMES.TOOL_ALLOCATIONS, list);

    auditService.log({
      action: 'IMPORT_TOOL_ALLOCATIONS_EXCEL',
      details: `Imported ${insertedCount} tool allocations via Excel import`,
      targetId: 'EXCEL_IMPORT'
    });

    return {
      total: dataRows.length,
      inserted: insertedCount,
      errors
    };
  }

  exportAllocationsToExcel(filters = {}) {
    if (typeof XLSX === 'undefined') {
      throw new Error('SheetJS library is not available.');
    }

    const items = this.getAllocations(filters);
    if (items.length === 0) {
      throw new Error('No allocation records found to export.');
    }

    const data = items.map((a, i) => ({
      'Sl No': i + 1,
      'Reg No': a.regNo,
      'Issue Date': a.issueDate,
      'User ID': a.userId,
      'User Name': a.userName,
      'Job Title': a.jobTitle,
      'Working Area': a.workingArea,
      'Item Type': a.itemType,
      'Item Code': a.itemCode,
      'Equipment / Item Name': a.itemName,
      'Quantity': a.quantity,
      'Change Status': a.changeStatus,
      'Change Date': a.changeDate || '-',
      'Remarks': a.remarks || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Tool_Allocations');
    XLSX.writeFile(wb, `Al_Muslim_Tools_Allocations_${new Date().toISOString().split('T')[0]}.xlsx`);
    return true;
  }

  exportMasterStockToExcel() {
    if (typeof XLSX === 'undefined') {
      throw new Error('SheetJS library is not available.');
    }

    const tools = this.getAllMasterTools();
    const accs = this.getAllMasterAccessories();

    const toolsData = tools.map((t, i) => ({
      'Sl': i + 1,
      'Item Code': t.code,
      'Tool Name': t.name,
      'Category': t.category,
      'Total Stock': t.totalStock,
      'Unit': t.unit,
      'Min Stock Alert': t.minStock,
      'Status': t.status,
      'Remarks': t.remarks
    }));

    const accsData = accs.map((a, i) => ({
      'Sl': i + 1,
      'Item Code': a.code,
      'Accessory Name': a.name,
      'Default Qty': a.defaultQty,
      'Default Remarks': a.defaultRemarks,
      'Total Stock': a.totalStock,
      'Unit': a.unit,
      'Status': a.status
    }));

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(toolsData);
    const ws2 = XLSX.utils.json_to_sheet(accsData);
    XLSX.utils.book_append_sheet(wb, ws1, 'Master_Tools');
    XLSX.utils.book_append_sheet(wb, ws2, 'Master_Accessories');

    XLSX.writeFile(wb, `Al_Muslim_Tools_Master_Catalog_${new Date().toISOString().split('T')[0]}.xlsx`);
    return true;
  }

  generateMasterToolsTemplateExcel() {
    if (typeof XLSX === 'undefined') {
      throw new Error('SheetJS library is not available.');
    }
    const headers = ['Tool Code (e.g. 001)', 'Tool Name', 'Category', 'Total Stock', 'Unit', 'Remarks'];
    const sampleRows = [
      ['001', 'Flat Screw Driver (Large)', 'TOOLS', '50', 'Pcs', 'Standard large flat screwdriver'],
      ['002', 'Flat Screw Driver (Medium)', 'TOOLS', '50', 'Pcs', 'Standard medium flat screwdriver'],
      ['014', 'Pliers (Long Nose)', 'TOOLS', '40', 'Pcs', 'Insulated nose pliers'],
      ['021', 'Hex Allen Key (01.50mm)', 'TOOLS', '60', 'Pcs', '1.5mm metric hex key'],
      ['111', 'File (Dimond File)', 'TOOLS', '35', 'Pcs', 'Diamond coated file']
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
    ws['!cols'] = [{ wch: 22 }, { wch: 32 }, { wch: 15 }, { wch: 14 }, { wch: 10 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Master_Tools_Template');
    XLSX.writeFile(wb, 'Al_Muslim_Master_Tools_Import_Template.xlsx');
    return true;
  }

  importMasterToolsFromExcel(dataRows) {
    if (!Array.isArray(dataRows) || dataRows.length === 0) {
      throw new Error('No data rows found in uploaded file.');
    }
    const list = storage.getTable(TABLE_NAMES.TOOLS_MASTER) || [];
    let insertedCount = 0;
    let updatedCount = 0;

    dataRows.forEach((row, idx) => {
      const rawCode = String(row['Tool Code (e.g. 001)'] || row['Tool Code'] || row['Item Code'] || row['Code'] || row['code'] || '').trim();
      const rawName = String(row['Tool Name'] || row['Equipment Name'] || row['Item Name'] || row['name'] || '').trim();
      const stock = parseInt(row['Total Stock'] || row['Stock'] || row['Quantity'] || row['totalStock'] || '50', 10);
      const unit = String(row['Unit'] || row['unit'] || 'Pcs').trim();
      const remarks = String(row['Remarks'] || row['remarks'] || '').trim();

      if (!rawName) return;

      const code = rawCode ? rawCode.padStart(3, '0') : `00${list.length + 1}`.slice(-3);
      const existing = list.find(t => String(t.code).trim() === code || t.name.toLowerCase() === rawName.toLowerCase());

      if (existing) {
        existing.name = rawName;
        existing.totalStock = isNaN(stock) ? existing.totalStock : stock;
        existing.unit = unit;
        existing.remarks = remarks;
        updatedCount++;
      } else {
        list.push({
          id: `tool-${Date.now()}-${idx + 1}`,
          code,
          name: rawName,
          category: 'TOOLS',
          totalStock: isNaN(stock) ? 50 : stock,
          unit,
          minStock: 5,
          status: 'ACTIVE',
          remarks
        });
        insertedCount++;
      }
    });

    storage.saveTable(TABLE_NAMES.TOOLS_MASTER, list);
    auditService.log({
      action: 'IMPORT_MASTER_TOOLS_EXCEL',
      details: `Imported/Updated ${insertedCount + updatedCount} master tools from Excel (${insertedCount} new, ${updatedCount} updated)`,
      targetId: 'TOOLS_MASTER'
    });

    return { total: dataRows.length, inserted: insertedCount, updated: updatedCount };
  }

  generateMasterAccessoriesTemplateExcel() {
    if (typeof XLSX === 'undefined') {
      throw new Error('SheetJS library is not available.');
    }
    const headers = ['Accessory Code', 'Accessory Name', 'Default Qty', 'Default Remarks', 'Total Stock', 'Unit'];
    const sampleRows = [
      ['ACC-01', 'Super Glue', '01 Pcs', '±01', '100', 'Pcs'],
      ['ACC-02', 'Sand Paper', 'Required', '', '200', 'Pcs'],
      ['ACC-03', 'Take-up Spring', '05 Pcs', '±03', '150', 'Pcs'],
      ['ACC-04', 'Wiper Stick', '05 Pcs', '±03', '120', 'Pcs'],
      ['ACC-05', 'Eye/Safety Guard', '02 Pcs', '±01', '80', 'Pcs']
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
    ws['!cols'] = [{ wch: 18 }, { wch: 28 }, { wch: 15 }, { wch: 18 }, { wch: 14 }, { wch: 10 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Master_Accessories_Template');
    XLSX.writeFile(wb, 'Al_Muslim_Master_Accessories_Import_Template.xlsx');
    return true;
  }

  importMasterAccessoriesFromExcel(dataRows) {
    if (!Array.isArray(dataRows) || dataRows.length === 0) {
      throw new Error('No data rows found in uploaded file.');
    }
    const list = storage.getTable(TABLE_NAMES.ACCESSORIES_MASTER) || [];
    let insertedCount = 0;
    let updatedCount = 0;

    dataRows.forEach((row, idx) => {
      const rawCode = String(row['Accessory Code'] || row['Item Code'] || row['Code'] || row['code'] || '').trim();
      const rawName = String(row['Accessory Name'] || row['Item Name'] || row['Name'] || row['name'] || '').trim();
      const defaultQty = String(row['Default Qty'] || row['Default Quantity'] || row['Qty'] || '01 Pcs').trim();
      const defaultRemarks = String(row['Default Remarks'] || row['Remarks'] || row['remarks'] || '').trim();
      const stock = parseInt(row['Total Stock'] || row['Stock'] || row['Quantity'] || '100', 10);
      const unit = String(row['Unit'] || row['unit'] || 'Pcs').trim();

      if (!rawName) return;

      const code = rawCode || `ACC-${String(list.length + 1).padStart(2, '0')}`;
      const existing = list.find(a => a.code === code || a.name.toLowerCase() === rawName.toLowerCase());

      if (existing) {
        existing.name = rawName;
        existing.defaultQty = defaultQty;
        existing.defaultRemarks = defaultRemarks;
        existing.totalStock = isNaN(stock) ? existing.totalStock : stock;
        existing.unit = unit;
        updatedCount++;
      } else {
        list.push({
          id: `acc-${Date.now()}-${idx + 1}`,
          code,
          name: rawName,
          defaultQty,
          defaultRemarks,
          totalStock: isNaN(stock) ? 100 : stock,
          unit,
          status: 'ACTIVE'
        });
        insertedCount++;
      }
    });

    storage.saveTable(TABLE_NAMES.ACCESSORIES_MASTER, list);
    auditService.log({
      action: 'IMPORT_MASTER_ACCESSORIES_EXCEL',
      details: `Imported/Updated ${insertedCount + updatedCount} master accessories from Excel (${insertedCount} new, ${updatedCount} updated)`,
      targetId: 'ACCESSORIES_MASTER'
    });

    return { total: dataRows.length, inserted: insertedCount, updated: updatedCount };
  }

  // =========================================================================
  // 6. ADMIN PRINT TEMPLATE CUSTOMIZATION (LEFT SIDE MASTER CONFIG)
  // =========================================================================

  getDefaultPrintTemplateConfig() {
    return {
      // 1. Full Page A4 Form Configuration
      a4: {
        paperSize: 'A4', // 'A4' | 'Letter' | 'Legal'
        orientation: 'portrait', // 'portrait' | 'landscape'
        fontScaling: 'standard', // 'compact' | 'standard' | 'large'
        marginSize: 'standard', // 'tight' | 'standard' | 'wide'
        extraBlankRows: 3,
        showStampBox: false, // STAMP & SIGN removed
        signatureMarginTop: '35px', // Lowered down user friendly signature gap
        columnSplit: '46-54' // '46-54' | '50-50' | '40-60'
      },

      // 2. Pocket Size Bag Slip (2-Card Side-by-Side ID Card Layout)
      pocket: {
        cardDimensions: 'standard', // 'standard' | 'compact' | 'large' | 'custom' | 'id-card'
        sizePreset: 'standard', // 'standard' (125x170mm) | 'a6' (105x148mm) | 'badge' (100x75mm) | 'cr80' (86x54mm) | 'custom'
        cardWidth: 125, // mm per card (Side 1 & Side 2 placed side-by-side)
        cardHeight: 170, // mm per card
        cardBorderRadius: 10, // 0 | 6 | 10 | 14
        fontScaling: 'standard', // 'compact' (8px) | 'standard' (9px) | 'large' (10px)
        toolsSplitCount: 20, // 18 | 20 | 22 (tools on Card 1, remainder on Card 2)
        cardGap: 8, // in mm
        signatureMarginTop: '25px', // Lowered down signature spacing
        showStampBox: false, // STAMP & SIGN removed
        showAccessories: true,
        showSignatures: true
      },

      // Root fallbacks for backward compatibility
      paperSize: 'A4',
      orientation: 'portrait',
      fontScaling: 'standard',
      marginSize: 'standard',
      extraBlankRows: 3,
      showStampBox: false,
      signatureMarginTop: '35px',

      // Company & Global Header Settings
      useDynamicEmployeeUnit: true, // Dynamic Factory Unit from Employee Card in Group Manpower
      companyName: 'A.K.M Knit Wear Ltd.',
      companySubtitle: '(A sister concern of Al-Muslim Group)',
      companyAddress: '14, Gadda, Karnapara, Ulail, Savar, Dhaka.',
      listTitle: 'Maintenance Tools / Equipment List',
      departmentName: 'Maintenance Department',
      sopEnglish: 'Follow the SOP and use tools and equipment,\nmaintaining a good working environment.',
      sopBengali: '',
      accessories: [
        { name: 'Super Glue', qty: '01 Pcs', remarks: '±01' },
        { name: 'Sand Paper', qty: 'Required', remarks: '' },
        { name: 'Take-up Spring', qty: '05 Pcs', remarks: '±03' },
        { name: 'Wiper Stick', qty: '05 Pcs', remarks: '±03' },
        { name: 'Eye/Safety Guard', qty: '02 Pcs', remarks: '±01' },
        { name: 'Safety Glass', qty: '01 Pcs', remarks: '±01' },
        { name: 'Screw, Nut-Bolt, & Washer', qty: '30 Pcs', remarks: '±10' },
        { name: 'Cable Tie', qty: '10 Pcs', remarks: '±05' },
        { name: 'P/M Needle Plate', qty: '02 Pcs', remarks: '±01' },
        { name: 'P/M Feed Dog', qty: '02 Pcs', remarks: '±01' }
      ],
      signatories: [
        { title: 'Registered By' },
        { title: 'AGM/Sr. AGM' },
        { title: 'General Manager' }
      ]
    };
  }

  getResolvedCompanyHeader(employeeIdOrCard, template = null) {
    const tpl = template || this.getPrintTemplateConfig();
    let companyName = tpl.companyName || 'A.K.M Knit Wear Ltd.';
    let companySubtitle = tpl.companySubtitle || '(A sister concern of Al-Muslim Group)';
    let companyAddress = tpl.companyAddress || '14, Gadda, Karnapara, Ulail, Savar, Dhaka.';
    let departmentName = tpl.departmentName || 'Maintenance Department';
    let unitCode = '';
    let unitName = companyName;
    let groupName = 'Al-Muslim Group';
    let isDynamic = false;

    if (tpl.useDynamicEmployeeUnit !== false && employeeIdOrCard) {
      const emp = this.getStaffByIdOrCard(employeeIdOrCard);
      if (emp) {
        const units = storage.getTable(TABLE_NAMES.UNITS) || [];
        const groups = storage.getTable(TABLE_NAMES.GROUPS) || [];

        let unit = null;
        if (emp.unitId) {
          unit = units.find(u => u.id === emp.unitId);
        }
        if (!unit && emp.unit) {
          unit = units.find(u =>
            String(u.name || '').toLowerCase() === String(emp.unit).toLowerCase() ||
            String(u.code || '').toLowerCase() === String(emp.unit).toLowerCase()
          );
        }

        if (unit) {
          // If unit name is "AKM Knitwear Ltd.", format as standard "A.K.M Knit Wear Ltd." or unit.name
          companyName = unit.code === 'AKM' ? 'A.K.M Knit Wear Ltd.' : unit.name;
          unitName = unit.name;
          unitCode = unit.code || '';
          isDynamic = true;
          if (unit.location) {
            companyAddress = unit.location.includes('14, Gadda') ? unit.location : `14, Gadda, Karnapara, Ulail, ${unit.location}`;
          }
          const grp = groups.find(g => g.id === unit.groupId || g.id === emp.groupId);
          if (grp && grp.name) {
            groupName = grp.name;
            companySubtitle = `(A sister concern of ${grp.name})`;
          }
        } else if (emp.companyName || emp.unitName || emp.unit) {
          companyName = emp.companyName || emp.unitName || emp.unit;
          unitName = companyName;
          isDynamic = true;
        }

        if (emp.department) {
          departmentName = emp.department;
        }
      }
    }

    return {
      companyName,
      companySubtitle,
      companyAddress,
      departmentName,
      listTitle: tpl.listTitle || 'Maintenance Tools / Equipment List',
      unitCode,
      unitName,
      groupName,
      isDynamic
    };
  }

  getPrintTemplateConfig() {
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem('al_muslim_erp_tools_print_template');
        if (saved) {
          const parsed = JSON.parse(saved);
          return { ...this.getDefaultPrintTemplateConfig(), ...parsed };
        }
      }
    } catch (e) {
      console.warn('Failed to load custom print template:', e);
    }
    return this.getDefaultPrintTemplateConfig();
  }

  savePrintTemplateConfig(config) {
    if (!authService.isSuperAdmin() && !authService.isAdmin() && !authService.isManager()) {
      // Allow if authorized or store in session
    }
    const merged = { ...this.getDefaultPrintTemplateConfig(), ...config, updatedAt: new Date().toISOString() };
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('al_muslim_erp_tools_print_template', JSON.stringify(merged));
    }
    auditService.log({
      action: 'UPDATE_PRINT_TEMPLATE',
      entity: 'Tools Print Template',
      details: 'Updated left-side fixed template configuration (Accessories and SOP text)'
    });
    return merged;
  }

  resetPrintTemplateConfig() {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('al_muslim_erp_tools_print_template');
    }
    return this.getDefaultPrintTemplateConfig();
  }
}

export const toolService = new ToolService();
if (typeof window !== 'undefined') {
  window.toolService = toolService;
}
