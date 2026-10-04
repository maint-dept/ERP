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

  _extractCell(row, aliases) {
    if (!row || typeof row !== 'object') return '';
    // 1. Direct key match
    for (const key of aliases) {
      if (row[key] !== undefined && row[key] !== null) {
        const val = String(row[key]).trim();
        if (val !== '') return val;
      }
    }
    // 2. Normalized key match (alphanumeric only, lowercase)
    const entries = Object.entries(row);
    for (const key of aliases) {
      const cleanTarget = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!cleanTarget) continue;
      for (const [rKey, rVal] of entries) {
        if (rVal === undefined || rVal === null) continue;
        const cleanRKey = rKey.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (cleanRKey === cleanTarget) {
          const val = String(rVal).trim();
          if (val !== '') return val;
        }
      }
    }
    return '';
  }

  /**
   * Match Manpower Employee STRICTLY by Card Number or Employee ID ONLY.
   * Never matches by Name.
   */
  getStaffByCardOnly(card) {
    if (!card) return null;
    const raw = String(card).trim();
    if (!raw) return null;

    // 1. Try flexible card matching in employeeService
    if (typeof employeeService !== 'undefined' && employeeService.findEmployeeByFlexibleCard) {
      const found = employeeService.findEmployeeByFlexibleCard(raw);
      if (found) return found;
    }

    // 2. Direct check on all employees in database
    const all = (typeof employeeService !== 'undefined' && employeeService.getAllEmployees)
      ? employeeService.getAllEmployees()
      : (storage.getTable(TABLE_NAMES.EMPLOYEES) || []);

    const cleanLower = raw.toLowerCase();
    const cleanAlpha = cleanLower.replace(/[^a-z0-9]/g, '');
    const cleanDigits = cleanLower.replace(/[^\d]/g, '');

    // Exact card or ID match
    let match = all.find(e => {
      const eCard = String(e.cardNumber || '').trim().toLowerCase();
      const eId = String(e.id || '').trim().toLowerCase();
      return eCard === cleanLower || eId === cleanLower;
    });
    if (match) {
      return (typeof employeeService !== 'undefined' && employeeService.enrichEmployee)
        ? employeeService.enrichEmployee(match)
        : match;
    }

    // Alphanumeric match ignoring punctuation/spaces (e.g. AMG0144906 vs AMG-0144906)
    if (cleanAlpha.length >= 3) {
      match = all.find(e => {
        const eCardAlpha = String(e.cardNumber || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const eIdAlpha = String(e.id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        return eCardAlpha === cleanAlpha || eIdAlpha === cleanAlpha;
      });
      if (match) {
        return (typeof employeeService !== 'undefined' && employeeService.enrichEmployee)
          ? employeeService.enrichEmployee(match)
          : match;
      }
    }

    // Numeric digits match (e.g. '144906' or '0144906')
    if (cleanDigits.length >= 3) {
      const digitsNoZero = cleanDigits.replace(/^0+/, '');
      match = all.find(e => {
        const eCardDigits = String(e.cardNumber || '').replace(/[^\d]/g, '');
        const eIdDigits = String(e.id || '').replace(/[^\d]/g, '');
        const eCardNoZero = eCardDigits.replace(/^0+/, '');
        const eIdNoZero = eIdDigits.replace(/^0+/, '');
        return eCardDigits === cleanDigits ||
          eIdDigits === cleanDigits ||
          (digitsNoZero && (eCardNoZero === digitsNoZero || eIdNoZero === digitsNoZero)) ||
          (cleanDigits.length >= 4 && (eCardDigits.endsWith(cleanDigits) || eIdDigits.endsWith(cleanDigits)));
      });
      if (match) {
        return (typeof employeeService !== 'undefined' && employeeService.enrichEmployee)
          ? employeeService.enrichEmployee(match)
          : match;
      }
    }

    return null;
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

    function fromExcelSerial(num) {
      const val = parseFloat(num);
      if (!isNaN(val) && val >= 10000 && val <= 90000) {
        const utcDays = Math.floor(val - 25569);
        const dt = new Date(utcDays * 86400 * 1000);
        if (!isNaN(dt.getTime())) {
          const dd = String(dt.getUTCDate()).padStart(2, '0');
          const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
          const yyyy = dt.getUTCFullYear();
          return `${dd}-${mm}-${yyyy}`;
        }
      }
      return null;
    }

    // 1. Check if raw input is pure Excel serial number (e.g. 45859 or 45859.5)
    if (/^\d{5}(\.\d+)?$/.test(str)) {
      const res = fromExcelSerial(str);
      if (res) return res;
    }

    // 2. Check if corrupted format where Excel serial ended up as a 5-digit year (e.g. 01-01-45859 or 45859-01-01)
    const fiveDigitEnd = str.match(/[-/](\d{5})$/);
    if (fiveDigitEnd) {
      const res = fromExcelSerial(fiveDigitEnd[1]);
      if (res) return res;
    }
    const fiveDigitStart = str.match(/^(\d{5})[-/]/);
    if (fiveDigitStart) {
      const res = fromExcelSerial(fiveDigitStart[1]);
      if (res) return res;
    }

    // 3. If YYYY-MM-DD (e.g. 2025-10-25)
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      const [yyyy, mm, dd] = str.split('-');
      return `${dd}-${mm}-${yyyy}`;
    }

    // 4. If DD-MM-YYYY or DD/MM/YYYY with 4-digit year
    if (/^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/.test(str)) {
      const parts = str.split(/[-/]/);
      const dd = parts[0].padStart(2, '0');
      const mm = parts[1].padStart(2, '0');
      const yyyy = parts[2];
      return `${dd}-${mm}-${yyyy}`;
    }

    // 5. If DD-MMM-YYYY (e.g. 25-Oct-2025)
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
      const yyyy = dt.getFullYear();
      if (yyyy >= 10000 && yyyy <= 90000) {
        const res = fromExcelSerial(yyyy);
        if (res) return res;
      }
      const dd = String(dt.getDate()).padStart(2, '0');
      const mm = String(dt.getMonth() + 1).padStart(2, '0');
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
   * STRICT CARD NUMBER MATCHING ONLY: Never matches by employee name.
   * Updates: userName (Name), jobTitle (Designation/deg), floor, and workingArea.
   * Leaves non-matching records completely untouched.
   */
  async syncAllocationsWithManpower() {
    let allocations = storage.getTable(TABLE_NAMES.TOOL_ALLOCATIONS) || [];
    if (allocations.length === 0) return { updatedCount: 0 };

    let updatedCount = 0;
    let modified = false;

    allocations.forEach(alloc => {
      const cardToMatch = String(alloc.userId || '').trim();
      if (!cardToMatch || cardToMatch === 'UNASSIGNED' || cardToMatch === 'AMG-UNKNOWN') return;

      // STRICT CARD NUMBER ONLY MATCHING
      const emp = this.getStaffByCardOnly(cardToMatch);
      if (!emp) return; // Keep as is if no match found in Manpower

      let changed = false;
      const latestCard = emp.cardNumber || emp.id;
      const latestName = emp.name;
      const latestTitle = emp.designation;
      const latestFloor = emp.floorName || emp.floor;
      const latestArea = emp.workingArea || (latestFloor ? `${latestFloor} - ${emp.department || ''}` : emp.department);

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
      if (latestFloor && alloc.floor !== latestFloor) {
        alloc.floor = latestFloor;
        changed = true;
      }
      if (latestArea && alloc.workingArea !== latestArea) {
        alloc.workingArea = latestArea;
        changed = true;
      }

      if (changed) {
        alloc.syncedWithManpowerAt = new Date().toISOString();
        alloc.manpowerMatched = true;
        updatedCount++;
        modified = true;
      }
    });

    if (modified) {
      await storage.saveTable(TABLE_NAMES.TOOL_ALLOCATIONS, allocations);
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
    // Match STRICTLY by card number only so imported mechanic records are preserved!
    const latestEmp = (first && first.userId) ? this.getStaffByCardOnly(first.userId) : (emp || null);

    const resolvedUserId = (latestEmp && latestEmp.cardNumber) ? latestEmp.cardNumber : (first.userId || raw);
    const resolvedUserName = (latestEmp && latestEmp.name) ? latestEmp.name : (first.userName || '');
    const resolvedJobTitle = (latestEmp && latestEmp.designation) ? latestEmp.designation : (first.jobTitle || '');
    const resolvedFloor = (latestEmp && (latestEmp.floorName || latestEmp.floor)) ? (latestEmp.floorName || latestEmp.floor) : (first.floor || '');
    const resolvedWorkingArea = (latestEmp && (latestEmp.workingArea || latestEmp.department)) ? (latestEmp.workingArea || (resolvedFloor ? `${resolvedFloor} - ${latestEmp.department || ''}` : latestEmp.department)) : (first.workingArea || '');
    const isStaff = String(resolvedUserId).includes('-');

    return {
      regNo: String(first.regNo || raw).replace(/^[#\s]+/, '').trim(),
      issueDate: first.issueDate || new Date().toISOString().split('T')[0],
      userId: resolvedUserId,
      userName: resolvedUserName,
      jobTitle: resolvedJobTitle,
      floor: resolvedFloor,
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

  cleanAllocationRequisitions() {
    const list = storage.getTable(TABLE_NAMES.TOOL_ALLOCATIONS) || [];
    let changed = false;

    list.forEach(a => {
      // 1. If requisitionNo is missing, extract clean IR number from remarks if available
      if (!a.requisitionNo) {
        const reqMatch = String(a.remarks || '').match(/IR\d+/i) || String(a.remarks || '').match(/ERP\s*Req\s*#?([A-Za-z0-9_-]+)/i);
        if (reqMatch) {
          const cleanReq = (reqMatch[1] || reqMatch[0]).replace(/^[#\s]+/, '').trim();
          if (cleanReq) {
            a.requisitionNo = cleanReq;
            changed = true;
          }
        }
      }

      // 2. If remarks has auto-generated ERP Req text, clean it up!
      if (a.remarks && (/ERP\s*Req/i.test(a.remarks) || /Auto-imported from ERP/i.test(a.remarks))) {
        let cleanedRemarks = String(a.remarks).replace(/ERP\s*Req\s*#?[A-Za-z0-9_-]+[:\s]*[^\n,]*/gi, '').trim();
        cleanedRemarks = cleanedRemarks.replace(/^Auto-imported from ERP PDF[:\s]*[^\n,]*/gi, '').trim();
        cleanedRemarks = cleanedRemarks.replace(/^[:\-\s,]+|[:\-\s,]+$/g, '').trim();
        if (a.remarks !== cleanedRemarks) {
          a.remarks = cleanedRemarks;
          changed = true;
        }
      }

      // 3. Fix corrupted Excel serial dates in issueDate (e.g. 45859 or 01-01-45859)
      if (a.issueDate) {
        const fixedDate = this.formatDateDMY(a.issueDate);
        if (fixedDate && fixedDate !== a.issueDate && !fixedDate.includes('45859')) {
          a.issueDate = fixedDate;
          changed = true;
        }
      }

      // 4. Fix corrupted Excel serial dates in changeDate if present
      if (a.changeDate) {
        const fixedChangeDate = this.formatDateDMY(a.changeDate);
        if (fixedChangeDate && fixedChangeDate !== a.changeDate && !fixedChangeDate.includes('45859')) {
          a.changeDate = fixedChangeDate;
          changed = true;
        }
      }
    });

    if (changed) {
      storage.saveTable(TABLE_NAMES.TOOL_ALLOCATIONS, list);
    }

    // Also sanitize tool change history table
    const historyList = storage.getTable(TABLE_NAMES.TOOL_CHANGE_HISTORY) || [];
    let historyChanged = false;
    historyList.forEach(h => {
      if (h.issueDate) {
        const fixedDate = this.formatDateDMY(h.issueDate);
        if (fixedDate && fixedDate !== h.issueDate && !fixedDate.includes('45859')) {
          h.issueDate = fixedDate;
          historyChanged = true;
        }
      }
      if (h.changeDate) {
        const fixedChangeDate = this.formatDateDMY(h.changeDate);
        if (fixedChangeDate && fixedChangeDate !== h.changeDate && !fixedChangeDate.includes('45859')) {
          h.changeDate = fixedChangeDate;
          historyChanged = true;
        }
      }
    });
    if (historyChanged) {
      storage.saveTable(TABLE_NAMES.TOOL_CHANGE_HISTORY, historyList);
    }
  }

  getAllocations(filters = {}) {
    this.syncAllocationsWithManpower();
    this.cleanAllocationRequisitions();
    let list = storage.getTable(TABLE_NAMES.TOOL_ALLOCATIONS) || [];

    if (filters.search && filters.search.trim()) {
      const q = filters.search.toLowerCase().trim();
      list = list.filter(a =>
        (a.userName && a.userName.toLowerCase().includes(q)) ||
        (a.userId && String(a.userId).toLowerCase().includes(q)) ||
        (a.regNo && String(a.regNo).toLowerCase().includes(q)) ||
        (a.requisitionNo && String(a.requisitionNo).toLowerCase().includes(q)) ||
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

  _restoreItemStock(item, masterTools, masterAccs) {
    if (!item) return false;
    const qty = parseInt(item.quantity, 10) || 1;
    let changed = false;
    if (item.itemType === 'TOOL') {
      const idx = masterTools.findIndex(t =>
        (item.itemCode && String(t.code).trim() === String(item.itemCode).trim()) ||
        (item.itemName && String(t.name).trim().toLowerCase() === String(item.itemName).trim().toLowerCase())
      );
      if (idx !== -1 && typeof masterTools[idx].totalStock === 'number') {
        masterTools[idx].totalStock += qty;
        changed = true;
      }
    } else if (item.itemType === 'ACCESSORY') {
      const idx = masterAccs.findIndex(a =>
        (item.itemCode && String(a.code).trim() === String(item.itemCode).trim()) ||
        (item.itemName && String(a.name).trim().toLowerCase() === String(item.itemName).trim().toLowerCase())
      );
      if (idx !== -1 && typeof masterAccs[idx].totalStock === 'number') {
        masterAccs[idx].totalStock += qty;
        changed = true;
      }
    }
    return changed;
  }

  async updateAllocationItem(id, updates) {
    const list = storage.getTable(TABLE_NAMES.TOOL_ALLOCATIONS) || [];
    const idx = list.findIndex(a => a.id === id);
    if (idx === -1) throw new Error('Allocation record not found.');

    const oldItem = { ...list[idx] };
    const newItem = {
      ...oldItem,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    list[idx] = newItem;

    // Adjust master inventory if quantity or item identity changed
    const masterTools = storage.getTable(TABLE_NAMES.TOOLS_MASTER) || [];
    const masterAccs = storage.getTable(TABLE_NAMES.ACCESSORIES_MASTER) || [];
    let toolsChanged = false;
    let accsChanged = false;

    const oldQty = parseInt(oldItem.quantity, 10) || 1;
    const newQty = parseInt(newItem.quantity, 10) || 1;
    const sameItem = (oldItem.itemType === newItem.itemType) &&
      (String(oldItem.itemCode || '').trim() === String(newItem.itemCode || '').trim());

    if (sameItem) {
      const diff = newQty - oldQty; // e.g. was 2, now 1 -> diff = -1 (return 1 to stock)
      if (diff !== 0) {
        if (newItem.itemType === 'TOOL') {
          const tIdx = masterTools.findIndex(t => String(t.code).trim() === String(newItem.itemCode).trim());
          if (tIdx !== -1 && typeof masterTools[tIdx].totalStock === 'number') {
            masterTools[tIdx].totalStock = Math.max(0, masterTools[tIdx].totalStock - diff);
            toolsChanged = true;
          }
        } else if (newItem.itemType === 'ACCESSORY') {
          const aIdx = masterAccs.findIndex(a => String(a.name).trim().toLowerCase() === String(newItem.itemName).trim().toLowerCase());
          if (aIdx !== -1 && typeof masterAccs[aIdx].totalStock === 'number') {
            masterAccs[aIdx].totalStock = Math.max(0, masterAccs[aIdx].totalStock - diff);
            accsChanged = true;
          }
        }
      }
    } else {
      // Swapped items: restore old item stock, deduct new item stock
      if (this._restoreItemStock(oldItem, masterTools, masterAccs)) {
        if (oldItem.itemType === 'TOOL') toolsChanged = true;
        if (oldItem.itemType === 'ACCESSORY') accsChanged = true;
      }
      if (newItem.itemType === 'TOOL') {
        const tIdx = masterTools.findIndex(t => String(t.code).trim() === String(newItem.itemCode).trim());
        if (tIdx !== -1 && typeof masterTools[tIdx].totalStock === 'number') {
          masterTools[tIdx].totalStock = Math.max(0, masterTools[tIdx].totalStock - newQty);
          toolsChanged = true;
        }
      } else if (newItem.itemType === 'ACCESSORY') {
        const aIdx = masterAccs.findIndex(a => String(a.name).trim().toLowerCase() === String(newItem.itemName).trim().toLowerCase());
        if (aIdx !== -1 && typeof masterAccs[aIdx].totalStock === 'number') {
          masterAccs[aIdx].totalStock = Math.max(0, masterAccs[aIdx].totalStock - newQty);
          accsChanged = true;
        }
      }
    }

    // CONFIRMED WRITE: await Database write
    const ok = await storage.saveTable(TABLE_NAMES.TOOL_ALLOCATIONS, list);
    if (!ok) throw new CloudSaveError('❌ Cloud Save Failed: Tool allocation update was not confirmed by the cloud.');

    if (toolsChanged) await storage.saveTable(TABLE_NAMES.TOOLS_MASTER, masterTools);
    if (accsChanged) await storage.saveTable(TABLE_NAMES.ACCESSORIES_MASTER, masterAccs);

    auditService.log({
      action: 'UPDATE_TOOL_ALLOCATION',
      details: `Updated allocation item #${id} (${newItem.itemName}, Qty: ${newItem.quantity}, Status: ${newItem.changeStatus})`,
      targetId: id
    });

    return list[idx];
  }

  async deleteAllocationItem(id) {
    let list = storage.getTable(TABLE_NAMES.TOOL_ALLOCATIONS) || [];
    const target = list.find(a => a.id === id);
    if (!target) throw new Error('Allocation record not found.');

    list = list.filter(a => a.id !== id);

    // Restore stock in master catalog
    const masterTools = storage.getTable(TABLE_NAMES.TOOLS_MASTER) || [];
    const masterAccs = storage.getTable(TABLE_NAMES.ACCESSORIES_MASTER) || [];
    const changed = this._restoreItemStock(target, masterTools, masterAccs);

    // CONFIRMED WRITE: await Database write
    const ok = await storage.saveTable(TABLE_NAMES.TOOL_ALLOCATIONS, list);
    if (!ok) throw new CloudSaveError('❌ Cloud Save Failed: Tool allocation deletion was not confirmed by the cloud.');

    if (changed) {
      if (target.itemType === 'TOOL') await storage.saveTable(TABLE_NAMES.TOOLS_MASTER, masterTools);
      if (target.itemType === 'ACCESSORY') await storage.saveTable(TABLE_NAMES.ACCESSORIES_MASTER, masterAccs);
    }

    auditService.log({
      action: 'DELETE_TOOL_ALLOCATION_ITEM',
      details: `Deleted allocation item ${target.itemName} from Reg No #${target.regNo}`,
      targetId: id
    });

    return true;
  }

  async deleteRegistrationBatch(regNo) {
    let list = storage.getTable(TABLE_NAMES.TOOL_ALLOCATIONS) || [];
    const cleanReg = String(regNo).trim();
    const toDelete = list.filter(a => String(a.regNo).trim() === cleanReg);
    const count = toDelete.length;
    list = list.filter(a => String(a.regNo).trim() !== cleanReg);

    // Restore stock in master catalog
    const masterTools = storage.getTable(TABLE_NAMES.TOOLS_MASTER) || [];
    const masterAccs = storage.getTable(TABLE_NAMES.ACCESSORIES_MASTER) || [];
    let toolsChanged = false;
    let accsChanged = false;

    toDelete.forEach(item => {
      if (this._restoreItemStock(item, masterTools, masterAccs)) {
        if (item.itemType === 'TOOL') toolsChanged = true;
        if (item.itemType === 'ACCESSORY') accsChanged = true;
      }
    });

    // CONFIRMED WRITE: await Database write
    const ok = await storage.saveTable(TABLE_NAMES.TOOL_ALLOCATIONS, list);
    if (!ok) throw new CloudSaveError('❌ Cloud Save Failed: Registration batch deletion was not confirmed by the cloud.');

    if (toolsChanged) await storage.saveTable(TABLE_NAMES.TOOLS_MASTER, masterTools);
    if (accsChanged) await storage.saveTable(TABLE_NAMES.ACCESSORIES_MASTER, masterAccs);

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
    const toDelete = list.filter(a => idSet.has(a.id));
    list = list.filter(a => !idSet.has(a.id));
    const deletedCount = initialCount - list.length;

    // Restore stock in master catalog for all deleted items
    const masterTools = storage.getTable(TABLE_NAMES.TOOLS_MASTER) || [];
    const masterAccs = storage.getTable(TABLE_NAMES.ACCESSORIES_MASTER) || [];
    let toolsChanged = false;
    let accsChanged = false;

    toDelete.forEach(item => {
      if (this._restoreItemStock(item, masterTools, masterAccs)) {
        if (item.itemType === 'TOOL') toolsChanged = true;
        if (item.itemType === 'ACCESSORY') accsChanged = true;
      }
    });

    // CONFIRMED WRITE: await Database write
    const ok = await storage.saveTable(TABLE_NAMES.TOOL_ALLOCATIONS, list);
    if (!ok) throw new CloudSaveError('❌ Cloud Save Failed: Bulk tool allocation deletion was not confirmed by the cloud.');

    if (toolsChanged) await storage.saveTable(TABLE_NAMES.TOOLS_MASTER, masterTools);
    if (accsChanged) await storage.saveTable(TABLE_NAMES.ACCESSORIES_MASTER, masterAccs);

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
      'Floor',
      'Working Area',
      'Item Type (TOOL/ACCESSORY)',
      'Tool / Item Name',
      'Quantity',
      'Change Status (NEW_ISSUE/REPLACED/RETURNED)',
      'Change Date (Optional)',
      'Remarks'
    ];

    const sampleRows = [
      ['1196', '2025-10-25', 'AMG-0147075', 'Ashraful Alam Shahed', 'Senior Mechanic', '4th Floor', 'Sewing - Jamuna', 'TOOL', '001.Flat Screw Driver (Large)', '1', 'NEW_ISSUE', '', ''],
      ['1196', '2025-10-25', 'AMG-0147075', 'Ashraful Alam Shahed', 'Senior Mechanic', '4th Floor', 'Sewing - Jamuna', 'TOOL', '014.Pliers (Long Nose)', '1', 'NEW_ISSUE', '', ''],
      ['1196', '2025-10-25', 'AMG-0147075', 'Ashraful Alam Shahed', 'Senior Mechanic', '4th Floor', 'Sewing - Jamuna', 'ACCESSORY', 'Super Glue', '01 Pcs', 'NEW_ISSUE', '', '#01'],
      ['1195', '2025-10-23', 'AMG0072256', 'Md. Jabad', 'Junior Mechanic (W)', '1st Floor', 'Embroidery Section', 'TOOL', '021.Hex Allen Key (01.50mm)', '1', 'NEW_ISSUE', '', '']
    ];

    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
    ws['!cols'] = [
      { wch: 16 }, { wch: 22 }, { wch: 18 }, { wch: 25 }, { wch: 22 },
      { wch: 16 }, { wch: 22 }, { wch: 26 }, { wch: 32 }, { wch: 12 }, { wch: 28 },
      { wch: 22 }, { wch: 20 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Tool_Allocations_Template');
    XLSX.writeFile(wb, 'Al_Muslim_Tools_Allocation_Import_Template.xlsx');
    return true;
  }

  async importAllocationsFromExcel(dataRows) {
    if (!Array.isArray(dataRows) || dataRows.length === 0) {
      throw new Error('No data rows found in uploaded file.');
    }

    const list = storage.getTable(TABLE_NAMES.TOOL_ALLOCATIONS) || [];
    let insertedCount = 0;
    const errors = [];
    const currentUser = authService.getCurrentUser()?.username || 'admin';
    const now = new Date().toISOString();

    let currentBatchRegNo = null;
    let lastBatchUserId = null;

    for (let idx = 0; idx < dataRows.length; idx++) {
      const row = dataRows[idx];
      try {
        const getVal = (aliases) => this._extractCell(row, aliases);

        // Extract raw values using rich alias dictionary
        const regNo = getVal(['Registration No', 'Reg. No', 'Reg No', 'regNo', 'Registration', 'Reg', 'Sl No', 'Sl. No', 'Sl', 'Record No']);
        const userId = getVal(['Card Number', 'Card No', 'Card No.', 'Card', 'ID Number', 'ID No', 'ID No.', 'User ID', 'Emp ID', 'Employee ID', 'Staff ID', 'userId', 'Punch ID', 'AC No', 'Token No', 'Token']);
        const userName = getVal(['User Name', 'Employee Name', 'Mechanic Name', 'Staff Name', 'Worker Name', 'Name', 'userName', 'Technician']);
        const jobTitleRaw = getVal(['Job Title', 'Designation', 'Desig', 'Deg', 'Title', 'Role', 'Position', 'Post']);
        const floorRaw = getVal(['Floor', 'Floor Name', 'Working Floor', 'Level']);
        const workingAreaRaw = getVal(['Working Area', 'Area', 'Line', 'Section', 'Department', 'Dept', 'Location', 'Line / Section', 'Work Area']);

        // Extract tool / item name
        let rawItemName = getVal([
          'Tool / Item Name', 'Equipment / Item Name', 'Tool/Item Name', 'Equipment Name',
          'Item Name', 'Tool Name', 'Tools Name', 'Item', 'Tool', 'Equipment',
          'Item Description', 'Description', 'Tools Description', 'Particulars',
          'Name of Tool', 'Name of Tools', 'Name of Equipment'
        ]);

        // Fallback: search row keys for any item/tool indicator
        if (!rawItemName) {
          for (const [k, v] of Object.entries(row)) {
            const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (v && String(v).trim() && (cleanK.includes('item') || cleanK.includes('tool') || cleanK.includes('equip') || cleanK.includes('desc') || cleanK.includes('partic'))) {
              rawItemName = String(v).trim();
              break;
            }
          }
        }

        // If still no item name found, check code or skip truly blank lines
        let code = getVal(['Item Code', 'Code', 'Tool Code', 'Item No']);
        if (!rawItemName) {
          if (code) {
            rawItemName = `Tool / Item ${code}`;
          } else {
            continue; // Skip blank line
          }
        }

        // Resolve code and clean item name (e.g. "001.Flat Screw Driver (Large)")
        let cleanName = rawItemName;
        const dotMatch = rawItemName.match(/^(\d{1,3})\s*[\.\-]\s*(.*)$/);
        if (dotMatch) {
          if (!code) code = dotMatch[1].padStart(3, '0');
          cleanName = dotMatch[2].trim();
        }

        const rawType = getVal(['Item Type', 'Type', 'Category']);
        const itemType = String(
          rawType ||
          (code ||
           cleanName.toLowerCase().includes('screw') ||
           cleanName.toLowerCase().includes('allen') ||
           cleanName.toLowerCase().includes('spanner') ||
           cleanName.toLowerCase().includes('plier') ||
           cleanName.toLowerCase().includes('file') ||
           cleanName.toLowerCase().includes('wrench') ||
           cleanName.toLowerCase().includes('hammer') ||
           cleanName.toLowerCase().includes('cutter') ||
           cleanName.toLowerCase().includes('tester')
           ? 'TOOL' : 'ACCESSORY')
        ).toUpperCase();

        // Registration number determination:
        // If provided in row, use it. Otherwise, keep consecutive items for same user under same reg number.
        let finalRegNo = regNo;
        if (!finalRegNo) {
          if (userId && userId === lastBatchUserId && currentBatchRegNo) {
            finalRegNo = currentBatchRegNo;
          } else {
            finalRegNo = this.getNextRegistrationNumber();
            currentBatchRegNo = finalRegNo;
            lastBatchUserId = userId;
          }
        }

        // STRICT CARD NUMBER ONLY MATCHING WITH MANPOWER
        // 1. If card number matches an employee in Manpower:
        //    Update name, designation (jobTitle), floor, and workingArea from Manpower!
        // 2. If card number does NOT match:
        //    KEEP the imported values from Excel (userId, userName, jobTitle, workingArea, floor) untouched!
        let resolvedUserId = userId;
        let resolvedUserName = userName;
        let resolvedJobTitle = jobTitleRaw;
        let resolvedFloor = floorRaw;
        let resolvedWorkingArea = workingAreaRaw;
        let isManpowerMatched = false;

        if (userId) {
          const emp = this.getStaffByCardOnly(userId);
          if (emp) {
            isManpowerMatched = true;
            resolvedUserId = emp.cardNumber || emp.id || userId;
            resolvedUserName = emp.name || userName;
            resolvedJobTitle = emp.designation || jobTitleRaw || 'Mechanic';
            resolvedFloor = emp.floorName || emp.floor || floorRaw || '';
            resolvedWorkingArea = emp.workingArea || (resolvedFloor ? `${resolvedFloor} - ${emp.department || ''}` : emp.department) || workingAreaRaw || 'General';
          }
        }

        // If not matched, preserve Excel data
        if (!resolvedUserId) resolvedUserId = 'UNASSIGNED';
        if (!resolvedUserName) resolvedUserName = (resolvedUserId !== 'UNASSIGNED' ? `Mechanic #${resolvedUserId}` : 'Unassigned Mechanic');
        if (!resolvedJobTitle) resolvedJobTitle = 'Mechanic';
        if (!resolvedWorkingArea) resolvedWorkingArea = resolvedFloor || 'General';

        const rawDate = getVal(['Issue Date', 'Issue Date (YYYY-MM-DD)', 'Date', 'Date of Issue', 'Allocation Date']);
        const issueDate = this.formatDateDMY(rawDate || new Date().toISOString().split('T')[0]);
        const reqNoRaw = getVal(['ERP Req #', 'ERP Req No', 'ERP Requisition', 'Requisition No', 'Requisition', 'Req No', 'Req. No', 'Req', 'requisitionNo']);
        const requisitionNo = reqNoRaw ? reqNoRaw.replace(/^[#\s]+/, '').trim() : '';
        const qty = getVal(['Quantity', 'Qty', 'Qty.', 'Pcs', 'Count']) || '1';
        const rawStatus = getVal(['Change Status', 'Status', 'Condition']);
        const changeStatus = (rawStatus || 'NEW_ISSUE').toUpperCase().replace(/\s+/g, '_');
        const changeDate = getVal(['Change Date', 'Return Date', 'Change Date (Optional)']) || null;
        const remarks = getVal(['Remarks', 'Remark', 'Note', 'Comments', 'Comment']) || '';

        const newEntry = {
          id: `alloc-imp-${Date.now()}-${idx + 1}`,
          regNo: finalRegNo,
          requisitionNo: requisitionNo || '',
          issueDate,
          userId: resolvedUserId,
          userName: resolvedUserName,
          jobTitle: resolvedJobTitle,
          floor: resolvedFloor,
          workingArea: resolvedWorkingArea,
          itemType: ['TOOL', 'ACCESSORY', 'SPARE_PART'].includes(itemType) ? itemType : 'TOOL',
          itemCode: code || (itemType === 'TOOL' ? '001' : 'ACC-01'),
          itemName: cleanName,
          quantity: qty,
          changeStatus: ['NEW_ISSUE', 'REPLACED', 'RETURNED', 'LOST'].includes(changeStatus) ? changeStatus : 'NEW_ISSUE',
          changeDate,
          remarks,
          status: 'ACTIVE',
          manpowerMatched: isManpowerMatched,
          createdAt: now,
          createdBy: currentUser
        };

        list.push(newEntry);
        insertedCount++;
      } catch (err) {
        errors.push(`Row ${idx + 1}: ${err.message}`);
      }
    }

    if (insertedCount > 0) {
      await storage.saveTable(TABLE_NAMES.TOOL_ALLOCATIONS, list);
      auditService.log({
        action: 'IMPORT_TOOL_ALLOCATIONS_EXCEL',
        details: `Imported ${insertedCount} tool allocations via Excel import`,
        targetId: 'EXCEL_IMPORT'
      });
    }

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
      'ERP Req #': a.requisitionNo || '-',
      'Issue Date': a.issueDate,
      'Card Number / ID': a.userId,
      'Mechanic Name': a.userName,
      'Job Title / Designation': a.jobTitle,
      'Floor': a.floor || '',
      'Working Area': a.workingArea,
      'Item Type': a.itemType,
      'Item Code': a.itemCode,
      'Tool / Item Name': a.itemName,
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

  async importMasterToolsFromExcel(dataRows) {
    if (!Array.isArray(dataRows) || dataRows.length === 0) {
      throw new Error('No data rows found in uploaded file.');
    }
    const list = storage.getTable(TABLE_NAMES.TOOLS_MASTER) || [];
    let insertedCount = 0;
    let updatedCount = 0;

    dataRows.forEach((row, idx) => {
      const getVal = (aliases) => this._extractCell(row, aliases);
      const rawCode = getVal(['Tool Code (e.g. 001)', 'Tool Code', 'Item Code', 'Code', 'code']);
      const rawName = getVal(['Tool Name', 'Equipment Name', 'Item Name', 'Name', 'name']);
      const stock = parseInt(getVal(['Total Stock', 'Stock', 'Quantity', 'totalStock']) || '50', 10);
      const unit = getVal(['Unit', 'unit']) || 'Pcs';
      const remarks = getVal(['Remarks', 'remarks', 'Note']);

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

    await storage.saveTable(TABLE_NAMES.TOOLS_MASTER, list);
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

  async importMasterAccessoriesFromExcel(dataRows) {
    if (!Array.isArray(dataRows) || dataRows.length === 0) {
      throw new Error('No data rows found in uploaded file.');
    }
    const list = storage.getTable(TABLE_NAMES.ACCESSORIES_MASTER) || [];
    let insertedCount = 0;
    let updatedCount = 0;

    dataRows.forEach((row, idx) => {
      const getVal = (aliases) => this._extractCell(row, aliases);
      const rawCode = getVal(['Accessory Code', 'Item Code', 'Code', 'code']);
      const rawName = getVal(['Accessory Name', 'Item Name', 'Name', 'name']);
      const defaultQty = getVal(['Default Qty', 'Default Quantity', 'Qty']) || '01 Pcs';
      const defaultRemarks = getVal(['Default Remarks', 'Remarks', 'remarks']) || '';
      const stock = parseInt(getVal(['Total Stock', 'Stock', 'Quantity']) || '100', 10);
      const unit = getVal(['Unit', 'unit']) || 'Pcs';

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

    await storage.saveTable(TABLE_NAMES.ACCESSORIES_MASTER, list);
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
