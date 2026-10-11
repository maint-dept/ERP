/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Needle Management Service
 * 
 * Handles:
 * - Machine Model Needle Specifications (Brand, Type, Size, Required Quantity)
 * - Machine Operation Needle Usage, Breakage, Return & Adjustment Transactions
 * - Real-time Plus/Minus Synchronization with Machine presentNeedle and Floor Balance
 * - Floor-wise and Line-wise Requirement, Budget, Issued, Used, Returned & Balance Tracking
 */

import { storage } from '../db/storage.js';
import { TABLE_NAMES } from '../db/schema.js';
import { masterDataService } from './masterDataService.js';
import { auditService } from './auditService.js';
import { notificationService } from './notificationService.js';

class NeedleService {
  /**
   * Generates a unique transaction identifier
   */
  generateTransactionId() {
    return `NTX-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  }

  /**
   * Resolves the Needle Specification (Brand, Type/Size, Required Count) for any machine model
   */
  getModelNeedleSpec(modelId, brandId = null, machineNameId = null) {
    const models = storage.getTable(TABLE_NAMES.MODELS) || [];
    let mod = modelId ? models.find(m => m.id === modelId) : null;
    
    // Fallback: search by name/code
    if (!mod && modelId) {
      const lower = String(modelId).trim().toLowerCase();
      mod = models.find(m => (m.name && m.name.toLowerCase() === lower) || (m.code && m.code.toLowerCase() === lower));
    }

    // Check storage master catalog for enriched specs
    const storageMaster = storage.getTable(TABLE_NAMES.STORAGE_MASTER) || [];
    let smItem = null;
    if (mod) {
      smItem = storageMaster.find(sm => sm.model && mod.name && sm.model.trim().toLowerCase() === mod.name.trim().toLowerCase());
    }

    const mnItem = machineNameId ? storage.getItem(TABLE_NAMES.MACHINE_NAMES, machineNameId) : null;
    const mnName = mnItem?.name || '';

    // 1. Check explicit fields on model or storage master
    let requiredNeedles = Number(mod?.requiredNeedles || mod?.needleQuantity || smItem?.requiredNeedles || smItem?.needleQuantity);
    let needleBrand = mod?.requiredNeedleBrand || mod?.needleBrand || smItem?.requiredNeedleBrand || smItem?.needleBrand || '';
    let needleType = mod?.needleType || mod?.needleSystem || smItem?.needleType || smItem?.needleSystem || '';

    // 2. Intelligent Garments Machinery Heuristic Defaults if unconfigured
    const lowerName = (mod?.name || mnName || '').toLowerCase();
    
    if (!requiredNeedles || isNaN(requiredNeedles) || requiredNeedles <= 0) {
      if (lowerName.includes('double needle') || lowerName.includes('twin needle') || lowerName.includes('2 needle') || lowerName.includes('2-needle')) {
        requiredNeedles = 2;
      } else if (lowerName.includes('feed of the arm') || lowerName.includes('feed of arm') || lowerName.includes('3-needle') || lowerName.includes('flatlock') || lowerName.includes('flat lock')) {
        requiredNeedles = 3;
      } else if (lowerName.includes('multi needle') || lowerName.includes('kansai') || lowerName.includes('4-needle')) {
        requiredNeedles = 4;
      } else if (lowerName.includes('overlock') || lowerName.includes('over lock')) {
        requiredNeedles = 2; // Standard 4-thread overlock uses 2 needles
      } else {
        requiredNeedles = 1; // Default single needle lockstitch
      }
    }

    if (!needleBrand) {
      needleBrand = 'ORGAN'; // Industry standard default in Bangladesh garments
    }

    if (!needleType) {
      if (lowerName.includes('overlock') || lowerName.includes('over lock')) {
        needleType = 'DCx27 #11/75';
      } else if (lowerName.includes('double needle')) {
        needleType = 'DPx5 #14/90';
      } else if (lowerName.includes('button hole') || lowerName.includes('buttonhole')) {
        needleType = 'DPx5 #14/90';
      } else if (lowerName.includes('button attach')) {
        needleType = 'TQx1 #16/100';
      } else if (lowerName.includes('bar tack') || lowerName.includes('bartack')) {
        needleType = 'DPx17 #16/100';
      } else if (lowerName.includes('feed of the arm') || lowerName.includes('flat lock') || lowerName.includes('flatlock')) {
        needleType = 'UY128GAS #11/75';
      } else {
        needleType = 'DBx1 #14/90'; // Standard single needle lockstitch
      }
    }

    return {
      requiredNeedles,
      needleBrand,
      needleType
    };
  }

  /**
   * Enriches a machine object with needle specifications and location labels
   */
  getEnrichedMachine(machineOrId) {
    const machine = typeof machineOrId === 'string' ? storage.getItem(TABLE_NAMES.MACHINES, machineOrId) : machineOrId;
    if (!machine) return null;

    const mn = storage.getItem(TABLE_NAMES.MACHINE_NAMES, machine.machineNameId);
    const brd = storage.getItem(TABLE_NAMES.BRANDS, machine.brandId);
    const mdl = storage.getItem(TABLE_NAMES.MODELS, machine.modelId);
    const unt = storage.getItem(TABLE_NAMES.UNITS, machine.unitId);
    const flr = storage.getItem(TABLE_NAMES.FLOORS, machine.floorId);
    const lin = storage.getItem(TABLE_NAMES.LINES, machine.lineId);

    const spec = this.getModelNeedleSpec(machine.modelId, machine.brandId, machine.machineNameId);

    const requiredNeedle = Number(machine.requiredNeedles || machine.requiredNeedle || spec.requiredNeedles) || 1;
    const presentNeedle = machine.presentNeedle !== undefined && machine.presentNeedle !== ''
      ? Number(machine.presentNeedle)
      : (machine.needleQuantity !== undefined && machine.needleQuantity !== '' ? Number(machine.needleQuantity) : requiredNeedle);

    return {
      ...machine,
      machineNameStr: mn?.name || machine.machineName || 'Sewing Machine',
      brandStr: brd?.name || machine.brand || 'Brand',
      modelStr: mdl?.name || machine.model || 'Model',
      unitStr: unt?.name || machine.unit || 'Unit',
      floorStr: flr?.name || machine.floor || 'Floor',
      lineStr: lin?.name || machine.line || 'Line',
      specNeedleBrand: machine.needleBrand || spec.needleBrand,
      specNeedleType: machine.needleType || spec.needleType,
      requiredNeedleCount: requiredNeedle,
      presentNeedleCount: isNaN(presentNeedle) ? requiredNeedle : presentNeedle
    };
  }

  /**
   * Retrieves all needle transactions
   */
  getAllTransactions() {
    const list = storage.getTable(TABLE_NAMES.NEEDLE_TRANSACTIONS) || [];
    return [...list].sort((a, b) => new Date(b.timestamp || b.date) - new Date(a.timestamp || a.date));
  }

  /**
   * Records a needle operation transaction:
   * Updates machine presentNeedle, logs transaction with unique ID, and recalculates floor balances.
   */
  async recordNeedleTransaction({
    machineId,
    actionType = 'USAGE_REPLACE', // 'USAGE_REPLACE' | 'USAGE_CONSUMED' | 'ADD_INSTALLED' | 'RETURN_STORE' | 'BALANCE_ADJUST'
    quantity = 1,
    needleBrand = '',
    needleType = '',
    remarks = '',
    technician = '',
    needleIssuer = '',
    customDate = null,
    allowNegative = false
  }) {
    const machine = storage.getItem(TABLE_NAMES.MACHINES, machineId);
    if (!machine) {
      throw new Error(`Machine [${machineId}] not found in inventory.`);
    }

    const qty = Math.abs(Number(quantity));
    if (isNaN(qty) || qty <= 0) {
      throw new Error('Please enter a valid needle quantity greater than 0.');
    }

    const enriched = this.getEnrichedMachine(machine);
    const prevBalance = enriched.presentNeedleCount;
    let newBalance = prevBalance;
    let delta = 0; // Effect on machine present balance
    let floorStockDelta = 0; // Effect on floor store balance

    switch (actionType) {
      case 'USAGE_REPLACE':
        // Needle broken & replaced from floor stock: Machine balance stays current, floor stock decreases
        delta = 0;
        floorStockDelta = -qty;
        break;

      case 'USAGE_CONSUMED':
        // Needle removed / broken without immediate replacement: Machine present balance decreases
        delta = -qty;
        floorStockDelta = -qty;
        newBalance = prevBalance - qty;
        break;

      case 'ADD_INSTALLED':
        // New needle added to machine from store: Machine present balance increases
        delta = qty;
        floorStockDelta = -qty;
        newBalance = prevBalance + qty;
        break;

      case 'RETURN_STORE':
        // Unused/excess needle returned from machine to store: Machine present balance decreases
        delta = -qty;
        floorStockDelta = qty;
        newBalance = Math.max(0, prevBalance - qty);
        break;

      case 'BALANCE_ADJUST':
        // Direct physical verification calibration
        newBalance = qty;
        delta = newBalance - prevBalance;
        floorStockDelta = 0;
        break;

      default:
        delta = -qty;
        newBalance = Math.max(0, prevBalance - qty);
        break;
    }

    if (newBalance < 0 && !allowNegative) {
      throw new Error(`Cannot complete transaction: Machine balance would drop below 0 (Attempted: ${newBalance}).`);
    }

    const txId = this.generateTransactionId();
    const nowIso = customDate ? new Date(customDate).toISOString() : new Date().toISOString();

    const currentUser = (typeof window !== 'undefined' && window.authService?.getCurrentUser)
      ? window.authService.getCurrentUser()
      : { name: 'Engr. Motaher Hossain', username: 'superadmin' };

    const txRecord = {
      id: txId,
      txId: txId,
      machineId: machine.id,
      serialNumber: machine.serialNumber,
      permanentMachineId: machine.permanentMachineId || machine.id,
      machineNameStr: enriched.machineNameStr,
      brandStr: enriched.brandStr,
      modelStr: enriched.modelStr,
      unitId: machine.unitId,
      floorId: machine.floorId,
      lineId: machine.lineId,
      unitStr: enriched.unitStr,
      floorStr: enriched.floorStr,
      lineStr: enriched.lineStr,
      actionType,
      quantity: qty,
      needleBrand: needleBrand || enriched.specNeedleBrand,
      needleType: needleType || enriched.specNeedleType,
      requiredNeedles: enriched.requiredNeedleCount,
      previousBalance: prevBalance,
      delta: delta,
      presentBalance: newBalance,
      floorStockDelta: floorStockDelta,
      remarks: remarks.trim(),
      technician: technician.trim() || currentUser.name || 'Technician',
      needleIssuer: needleIssuer ? needleIssuer.trim() : '',
      updatedBy: currentUser.name || currentUser.username || 'Authorized User',
      date: nowIso,
      timestamp: nowIso
    };

    // 1. Insert Transaction into Storage
    storage.insert(TABLE_NAMES.NEEDLE_TRANSACTIONS, txRecord);

    // 2. Update Machine's Present Needle in Machines Table
    machine.presentNeedle = newBalance;
    machine.needleQuantity = newBalance; // backward compatibility
    machine.needleBrand = txRecord.needleBrand;
    machine.needleType = txRecord.needleType;
    machine.lastNeedleAdjustDate = nowIso;
    machine.lastNeedleAdjustTxId = txId;

    await storage.saveTable(TABLE_NAMES.MACHINES);

    // 3. Log Audit & History
    try {
      auditService.log(
        'NEEDLE_ADJUSTMENT',
        'MACHINES',
        machine.id,
        `Tx ${txId}: ${actionType} of ${qty} needles on [${machine.serialNumber}]. Balance: ${prevBalance} ➔ ${newBalance}`
      );
    } catch (_) {}

    this._broadcastNeedleChange();

    return {
      success: true,
      transaction: txRecord,
      newPresentBalance: newBalance
    };
  }

  /**
   * Retrieves or initializes floor needle budget & store allocations
   */
  getFloorBudgetRecord(floorId) {
    if (!floorId) return null;
    const budgets = storage.getTable(TABLE_NAMES.NEEDLE_FLOOR_BUDGETS) || [];
    return budgets.find(b => b.floorId === floorId) || null;
  }

  /**
   * Sets or updates needle budget and issued store quantities for a floor
   */
  async setFloorBudget(floorId, { budgetQuantity = 0, issuedQuantity = 0, unitId = null, notes = '' }) {
    if (!floorId) throw new Error('Floor ID is required.');
    
    const budgets = storage.getTable(TABLE_NAMES.NEEDLE_FLOOR_BUDGETS) || [];
    const existingIdx = budgets.findIndex(b => b.floorId === floorId);

    const record = {
      id: existingIdx !== -1 ? budgets[existingIdx].id : `NFB-${floorId}`,
      floorId,
      unitId: unitId || (existingIdx !== -1 ? budgets[existingIdx].unitId : null),
      budgetQuantity: Math.max(0, Number(budgetQuantity) || 0),
      issuedQuantity: Math.max(0, Number(issuedQuantity) || 0),
      notes: notes || '',
      updatedAt: new Date().toISOString()
    };

    if (existingIdx !== -1) {
      budgets[existingIdx] = record;
    } else {
      budgets.push(record);
    }

    await storage.saveTable(TABLE_NAMES.NEEDLE_FLOOR_BUDGETS, budgets);
    this._broadcastNeedleChange();
    return record;
  }

  /**
   * Calculates comprehensive Floor-wise and Line-wise Needle Metrics:
   * 1. Required Quantity (Total machines × Model spec)
   * 2. Budget Quantity (Approved floor allocation)
   * 3. Present Quantity (Real-time sum of Present Needles on machines on this floor)
   * 4. Issued Quantity (Issued to floor from store)
   * 5. Used Quantity (Total consumed / broken)
   * 6. Returned Quantity (Unused needles returned to store)
   * 7. Balance Quantity (Issued - Used + Returned)
   * 8. Shortage / Excess (Present vs Required)
   */
  getFloorNeedleMetrics(floorId, lineId = null, unitId = null) {
    const allMachines = storage.getTable(TABLE_NAMES.MACHINES) || [];
    const allTx = storage.getTable(TABLE_NAMES.NEEDLE_TRANSACTIONS) || [];

    // Filter machines by floor (and optionally line / unit)
    const machines = allMachines.filter(m => {
      if (!m) return false;
      if (unitId && m.unitId !== unitId) return false;
      if (floorId && m.floorId !== floorId) return false;
      if (lineId && lineId !== 'ALL' && m.lineId !== lineId) return false;
      return true;
    });

    // Filter transactions
    const transactions = allTx.filter(tx => {
      if (!tx) return false;
      if (unitId && tx.unitId !== unitId) return false;
      if (floorId && tx.floorId !== floorId) return false;
      if (lineId && lineId !== 'ALL' && tx.lineId !== lineId) return false;
      return true;
    });

    let requiredQuantity = 0;
    let presentQuantity = 0;

    machines.forEach(m => {
      const enriched = this.getEnrichedMachine(m);
      const mQty = Math.max(1, Number(m.quantity) || 1);
      requiredQuantity += (enriched.requiredNeedleCount * mQty);
      presentQuantity += (enriched.presentNeedleCount * mQty);
    });

    // Calculate usage from transactions
    let usedQuantity = 0;
    let returnedQuantity = 0;
    let addedQuantity = 0;

    transactions.forEach(tx => {
      const q = Number(tx.quantity) || 0;
      if (tx.actionType === 'USAGE_REPLACE' || tx.actionType === 'USAGE_CONSUMED') {
        usedQuantity += q;
      } else if (tx.actionType === 'RETURN_STORE') {
        returnedQuantity += q;
      } else if (tx.actionType === 'ADD_INSTALLED') {
        addedQuantity += q;
      }
    });

    // Floor budget record
    const bRecord = floorId ? this.getFloorBudgetRecord(floorId) : null;
    const budgetQuantity = bRecord?.budgetQuantity || Math.round(requiredQuantity * 1.25);
    const issuedQuantity = bRecord?.issuedQuantity || Math.round(requiredQuantity * 1.15) + addedQuantity;

    // Balance in floor stock: Issued - Used + Returned
    const balanceQuantity = Math.max(0, issuedQuantity - usedQuantity + returnedQuantity);

    // Shortage / Excess: Difference between Present on machines and Required
    const shortageExcess = presentQuantity - requiredQuantity;

    return {
      machineCount: machines.length,
      requiredQuantity,
      budgetQuantity,
      presentQuantity,
      issuedQuantity,
      usedQuantity,
      returnedQuantity,
      balanceQuantity,
      shortageExcess,
      status: shortageExcess < 0 ? 'SHORTAGE' : (shortageExcess > 0 ? 'EXCESS' : 'BALANCED')
    };
  }

  /**
   * Generates model-wise breakdown table for reports and floor audit views
   */
  getFloorModelBreakdown(floorId, lineId = null, unitId = null, needleBrandFilter = '', needleTypeFilter = '') {
    const allMachines = storage.getTable(TABLE_NAMES.MACHINES) || [];
    const allTx = storage.getTable(TABLE_NAMES.NEEDLE_TRANSACTIONS) || [];

    const machines = allMachines.filter(m => {
      if (!m) return false;
      if (unitId && m.unitId !== unitId) return false;
      if (floorId && m.floorId !== floorId) return false;
      if (lineId && lineId !== 'ALL' && m.lineId !== lineId) return false;
      return true;
    });

    const groups = new Map();

    machines.forEach(m => {
      const enriched = this.getEnrichedMachine(m);
      const key = `${enriched.machineNameStr}:::${enriched.brandStr}:::${enriched.modelStr}:::${enriched.specNeedleBrand}:::${enriched.specNeedleType}`;

      if (!groups.has(key)) {
        groups.set(key, {
          machineName: enriched.machineNameStr,
          brand: enriched.brandStr,
          model: enriched.modelStr,
          needleBrand: enriched.specNeedleBrand,
          needleType: enriched.specNeedleType,
          requiredPerMachine: enriched.requiredNeedleCount,
          machineCount: 0,
          machines: [],
          presentCount: 0
        });
      }

      const g = groups.get(key);
      const mQty = Math.max(1, Number(m.quantity) || 1);
      g.machineCount += mQty;
      g.presentCount += (enriched.presentNeedleCount * mQty);
      g.machines.push(enriched);
    });

    const rows = [];
    for (const [, g] of groups.entries()) {
      if (needleBrandFilter && !g.needleBrand.toLowerCase().includes(needleBrandFilter.toLowerCase())) {
        continue;
      }
      if (needleTypeFilter && !g.needleType.toLowerCase().includes(needleTypeFilter.toLowerCase())) {
        continue;
      }

      const required = g.machineCount * g.requiredPerMachine;
      const budget = Math.round(required * 1.25);
      
      // Calculate used and returned for this model from transactions
      let used = 0;
      let returned = 0;
      allTx.forEach(tx => {
        if (tx.modelStr === g.model && (!floorId || tx.floorId === floorId)) {
          if (tx.actionType === 'USAGE_REPLACE' || tx.actionType === 'USAGE_CONSUMED') used += Number(tx.quantity || 0);
          if (tx.actionType === 'RETURN_STORE') returned += Number(tx.quantity || 0);
        }
      });

      const issued = Math.round(required * 1.15);
      const balance = Math.max(0, issued - used + returned);
      const shortageExcess = g.presentCount - required;

      rows.push({
        machineModel: `${g.brand} ${g.model}`,
        modelName: g.model,
        machineName: g.machineName,
        machineQuantity: g.machineCount,
        needleBrand: g.needleBrand,
        needleType: g.needleType,
        needleSpecStr: `${g.needleBrand} ${g.needleType}`,
        required,
        budget,
        issued,
        used,
        returned,
        present: g.presentCount,
        balance,
        shortageExcess,
        status: shortageExcess < 0 ? 'SHORTAGE' : (shortageExcess > 0 ? 'EXCESS' : 'BALANCED')
      });
    }

    return rows.sort((a, b) => b.machineQuantity - a.machineQuantity);
  }

  /**
   * Export complete Needle Report to Excel (.xlsx)
   */
  exportNeedleReportToExcel(filters = {}) {
    if (typeof XLSX === 'undefined') {
      notificationService.error('SheetJS (XLSX) library is not available.');
      return;
    }

    const { unitId, floorId, lineId } = filters;
    const metrics = this.getFloorNeedleMetrics(floorId, lineId, unitId);
    const breakdown = this.getFloorModelBreakdown(floorId, lineId, unitId);
    const transactions = this.getAllTransactions().slice(0, 500);

    const flr = floorId ? masterDataService.getFloorById(floorId) : null;
    const unt = unitId ? masterDataService.getUnitById(unitId) : null;

    // Sheet 1: Floor Summary & Model Breakdown
    const modelRows = [
      ['AL-MUSLIM GROUP — NEEDLE REQUIREMENT, USAGE & BALANCE REPORT'],
      [`Unit: ${unt?.name || 'All Units'} | Floor: ${flr?.name || 'All Floors'} | Generated: ${new Date().toLocaleString()}`],
      [],
      ['KPI METRICS SUMMARY'],
      ['Total Machines', 'Required Needles', 'Present on Machines', 'Floor Budget', 'Store Issued', 'Used / Broken', 'Returned', 'Floor Balance', 'Shortage / Excess'],
      [
        metrics.machineCount,
        metrics.requiredQuantity,
        metrics.presentQuantity,
        metrics.budgetQuantity,
        metrics.issuedQuantity,
        metrics.usedQuantity,
        metrics.returnedQuantity,
        metrics.balanceQuantity,
        metrics.shortageExcess
      ],
      [],
      ['MODEL-WISE NEEDLE ALLOCATION & BALANCE BREAKDOWN'],
      ['#', 'Machine Name', 'Machine Model', 'Machine Qty', 'Needle Brand', 'Needle Type / Size', 'Required Qty', 'Floor Budget', 'Store Issued', 'Used Qty', 'Returned', 'Present on Machines', 'Floor Balance', 'Shortage / Excess']
    ];

    breakdown.forEach((row, idx) => {
      modelRows.push([
        idx + 1,
        row.machineName,
        row.machineModel,
        row.machineQuantity,
        row.needleBrand,
        row.needleType,
        row.required,
        row.budget,
        row.issued,
        row.used,
        row.returned,
        row.present,
        row.balance,
        row.shortageExcess
      ]);
    });

    // Sheet 2: Transaction History
    const txRows = [
      ['NEEDLE TRANSACTION & USAGE AUDIT HISTORY'],
      ['Tx ID', 'Date & Time', 'Serial #', 'Machine Model', 'Floor', 'Line', 'Action Type', 'Needle Brand / Type', 'Req Spec', 'Prev Balance', 'Quantity', 'New Balance', 'Technician', 'Needle Issuer', 'Remarks']
    ];

    transactions.forEach(tx => {
      txRows.push([
        tx.txId || tx.id,
        tx.date ? new Date(tx.date).toLocaleString() : '',
        tx.serialNumber,
        tx.modelStr,
        tx.floorStr,
        tx.lineStr,
        tx.actionType,
        `${tx.needleBrand} ${tx.needleType}`,
        tx.requiredNeedles,
        tx.previousBalance,
        (tx.delta < 0 ? `-${tx.quantity}` : (tx.delta > 0 ? `+${tx.quantity}` : tx.quantity)),
        tx.presentBalance,
        tx.technician,
        tx.needleIssuer || '',
        tx.remarks
      ]);
    });

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.aoa_to_sheet(modelRows);
    ws1['!cols'] = [
      { wch: 5 }, { wch: 22 }, { wch: 22 }, { wch: 12 }, { wch: 16 }, { wch: 18 },
      { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 14 }, { wch: 16 }
    ];
    XLSX.utils.book_append_sheet(wb, ws1, 'Needle_Balance_Summary');

    const ws2 = XLSX.utils.aoa_to_sheet(txRows);
    ws2['!cols'] = [
      { wch: 18 }, { wch: 20 }, { wch: 14 }, { wch: 18 }, { wch: 16 }, { wch: 16 },
      { wch: 16 }, { wch: 22 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 28 }
    ];
    XLSX.utils.book_append_sheet(wb, ws2, 'Transaction_History');

    const dateStr = new Date().toISOString().split('T')[0];
    const fileName = `Al_Muslim_ERP_Needle_Usage_Report_${dateStr}.xlsx`;
    XLSX.writeFile(wb, fileName);
    notificationService.success('Excel Report Exported', `Downloaded ${fileName}`);
  }

  /**
   * Synchronizes Needle specifications from Master Storage & Models to all matching machines in Inventory.
   * Updates machine requiredNeedles, needleType, needleBrand based on model setup.
   */
  async syncNeedleMasterToInventory({ syncPresentNeedlesIfDefault = false } = {}) {
    const allMachines = storage.getTable(TABLE_NAMES.MACHINES) || [];

    let updatedCount = 0;
    allMachines.forEach(machine => {
      if (!machine) return;
      const spec = this.getModelNeedleSpec(machine.modelId, machine.brandId, machine.machineNameId);
      if (!spec) return;

      let changed = false;
      const targetReq = Number(spec.requiredNeedles) || 1;
      const targetType = spec.needleType || 'DBx1 #14';
      const targetBrand = spec.needleBrand || 'ORGAN';

      if (Number(machine.requiredNeedles) !== targetReq) {
        machine.requiredNeedles = targetReq;
        changed = true;
      }
      if (Number(machine.requiredNeedle) !== targetReq) {
        machine.requiredNeedle = targetReq;
        changed = true;
      }
      if (machine.needleType !== targetType) {
        machine.needleType = targetType;
        changed = true;
      }
      if (machine.needleBrand !== targetBrand) {
        machine.needleBrand = targetBrand;
        machine.requiredNeedleBrand = targetBrand;
        changed = true;
      }

      if (syncPresentNeedlesIfDefault && (machine.presentNeedle === undefined || machine.presentNeedle === null || machine.presentNeedle === '')) {
        machine.presentNeedle = targetReq;
        changed = true;
      }

      if (changed) {
        machine.updatedAt = new Date().toISOString();
        updatedCount++;
      }
    });

    if (updatedCount > 0) {
      await storage.saveTable(TABLE_NAMES.MACHINES, true);
      if (typeof storage.persistToServerDatabase === 'function') {
        try { await storage.persistToServerDatabase(); } catch (_) {}
      }
    }

    this._broadcastNeedleChange();
    return { success: true, updatedCount };
  }

  _broadcastNeedleChange() {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('erp:needle-updated'));
      window.dispatchEvent(new CustomEvent('erp:relocate-updated'));
      window.dispatchEvent(new CustomEvent('erp:inventory-updated'));
    }
  }
}

export const needleService = new NeedleService();
if (typeof window !== 'undefined') {
  window.needleService = needleService;
}
