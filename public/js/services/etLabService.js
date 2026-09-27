/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * ENT Lab Management Service
 * 
 * Manages ENT Lab Board/PCB Master Inventory, Machine Attachments & Removals,
 * In-House & External Company Repairs, Duplicate-Billing Prevention, and Board Lifecycles.
 */

import { storage, CloudSaveError } from '../db/storage.js';
import { TABLE_NAMES, ET_BOARD_STATUSES, ET_ACTIONS } from '../db/schema.js';
import { authService } from './authService.js';
import { auditService } from './auditService.js';
import { historyService } from './historyService.js';

class EtLabService {

  // ============================================================
  // 1. BOARD MASTER QUERY & SEARCH METHODS
  // ============================================================

  /**
   * Get all boards with optional multi-criteria filters
   */
  getBoards(filters = {}) {
    let boards = storage.getTable(TABLE_NAMES.ET_BOARDS) || [];

    if (filters.search) {
      const q = filters.search.toLowerCase().trim();
      boards = boards.filter(b => {
        const serial = (b.boardSerial || '').toLowerCase();
        const partName = (b.partName || '').toLowerCase();
        const modelNo = (b.modelNo || '').toLowerCase();
        const partNo = (b.partNo || '').toLowerCase();
        const slNo = (b.slNo || '').toLowerCase();
        const jukiSlNo = (b.jukiSlNo || '').toLowerCase();
        const billNo = (b.billNo || '').toLowerCase();
        const machine = (b.currentMachineSerial || '').toLowerCase();
        const category = (b.category || '').toLowerCase();

        return serial.includes(q) || partName.includes(q) || modelNo.includes(q) ||
               partNo.includes(q) || slNo.includes(q) || jukiSlNo.includes(q) ||
               billNo.includes(q) || machine.includes(q) || category.includes(q);
      });
    }

    if (filters.status && filters.status !== 'ALL') {
      boards = boards.filter(b => b.status === filters.status);
    }

    if (filters.category && filters.category !== 'ALL') {
      boards = boards.filter(b => (b.category || '').toUpperCase() === filters.category.toUpperCase());
    }

    if (filters.machineSerial) {
      const mQ = filters.machineSerial.toUpperCase().trim();
      boards = boards.filter(b => (b.currentMachineSerial || '').toUpperCase() === mQ);
    }

    if (filters.hasBill === 'YES') {
      boards = boards.filter(b => Boolean(b.billNo && b.billNo.trim()));
    } else if (filters.hasBill === 'NO') {
      boards = boards.filter(b => !b.billNo || !b.billNo.trim());
    }

    return boards;
  }

  getBoardById(id) {
    if (!id) return null;
    return storage.getItem(TABLE_NAMES.ET_BOARDS, id);
  }

  getBoardBySerial(boardSerial) {
    if (!boardSerial) return null;
    const clean = boardSerial.trim().toUpperCase();
    const boards = storage.getTable(TABLE_NAMES.ET_BOARDS) || [];
    return boards.find(b => (b.boardSerial || '').toUpperCase() === clean);
  }

  /**
   * Quick fuzzy search across Board SL, Name, P.No, Model, JUKI SL
   */
  searchBoardsFuzzy(query, limit = 15) {
    if (!query) return (storage.getTable(TABLE_NAMES.ET_BOARDS) || []).slice(0, limit);
    const q = query.trim().toLowerCase();
    const all = storage.getTable(TABLE_NAMES.ET_BOARDS) || [];
    return all.filter(b => {
      const s = (b.boardSerial || '').toLowerCase();
      const n = (b.partName || '').toLowerCase();
      const m = (b.modelNo || '').toLowerCase();
      const p = (b.partNo || '').toLowerCase();
      const j = (b.jukiSlNo || '').toLowerCase();
      const sl = (b.slNo || '').toLowerCase();
      const mach = (b.currentMachineSerial || '').toLowerCase();
      return s.includes(q) || n.includes(q) || m.includes(q) || p.includes(q) || j.includes(q) || sl.includes(q) || mach.includes(q);
    }).slice(0, limit);
  }

  // ============================================================
  // 2. BOARD MASTER CRUD
  // ============================================================

  generateNextBoardSerial() {
    const boards = storage.getTable(TABLE_NAMES.ET_BOARDS) || [];
    let maxNum = 0;
    boards.forEach(b => {
      if (b.boardSerial && b.boardSerial.startsWith('BRD-')) {
        const numPart = parseInt(b.boardSerial.replace('BRD-', ''), 10);
        if (!isNaN(numPart) && numPart > maxNum) maxNum = numPart;
      }
    });
    return `BRD-${String(maxNum + 1).padStart(5, '0')}`;
  }

  async createBoard(boardData) {
    const user = authService.getCurrentUser();
    const boardSerial = (boardData.boardSerial || this.generateNextBoardSerial()).trim().toUpperCase();

    // Enforce Rule 1: One Board must have one permanent SL No. / Unit No.
    const existing = this.getBoardBySerial(boardSerial);
    if (existing) {
      throw new Error(`Board Serial "${boardSerial}" already exists in ENT Lab. Each board must have a unique permanent Serial Number.`);
    }

    const newBoard = {
      id: `brd-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      boardSerial,
      modelNo: boardData.modelNo || '',
      partName: boardData.partName || '',
      partNo: boardData.partNo || '',
      slNo: boardData.slNo || '',
      qty: parseInt(boardData.qty, 10) || 1,
      comeDate: boardData.comeDate || new Date().toISOString().split('T')[0],
      gpNo: boardData.gpNo || '',
      billNo: boardData.billNo || '',
      remarks: boardData.remarks || '',
      jukiSlNo: boardData.jukiSlNo || '',
      category: boardData.category || 'Main CPU Control Board',
      status: boardData.status || 'AVAILABLE_SPARE',
      currentMachineSerial: null,
      currentMachineId: null,
      installedDate: null,
      installedBy: null,
      location: boardData.location || 'ENT Lab Stock Shelf',
      createdAt: new Date().toISOString(),
      createdBy: user?.name || 'System Admin'
    };

    // CONFIRMED WRITE: use writeAndConfirm for atomic insert + cloud confirmation
    await storage.writeAndConfirm(TABLE_NAMES.ET_BOARDS, (tbl) => { tbl.push(newBoard); });

    // Record initial creation history
    this.addHistoryRecord({
      boardSerial: newBoard.boardSerial,
      action: 'CREATE',
      actionLabel: 'Registered in ENT Lab',
      machineSerial: null,
      location: newBoard.location,
      remarks: `Board registered with Model: ${newBoard.modelNo}, Part No: ${newBoard.partNo}, Bill No: ${newBoard.billNo || 'N/A'}`
    });

    auditService.log('CREATE', 'ET_LAB', newBoard.id, `Created ENT Lab Board [${newBoard.boardSerial}]: ${newBoard.partName}`);
    window.dispatchEvent(new CustomEvent('erp:et-lab-updated', { detail: { board: newBoard } }));
    return newBoard;
  }

  async updateBoard(id, updates) {
    const existing = storage.getItem(TABLE_NAMES.ET_BOARDS, id);
    if (!existing) throw new Error('Board record not found.');

    // If changing serial, check uniqueness
    if (updates.boardSerial && updates.boardSerial.trim().toUpperCase() !== existing.boardSerial.toUpperCase()) {
      const conflict = this.getBoardBySerial(updates.boardSerial);
      if (conflict && conflict.id !== id) {
        throw new Error(`Board Serial "${updates.boardSerial}" is already assigned to another board.`);
      }
    }

    const updated = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    // CONFIRMED WRITE: await Firebase HTTP 200 before success
    await storage.writeAndConfirm(TABLE_NAMES.ET_BOARDS, (tbl) => {
      const idx = tbl.findIndex(b => b.id === id);
      if (idx !== -1) tbl[idx] = updated;
    });

    this.addHistoryRecord({
      boardSerial: updated.boardSerial,
      action: 'EDIT',
      actionLabel: 'Board Specs Updated',
      machineSerial: updated.currentMachineSerial || null,
      location: updated.location || 'ENT Lab',
      remarks: updates.editReason || 'Board specifications or metadata updated by admin'
    });

    auditService.log('UPDATE', 'ET_LAB', id, `Updated ENT Lab Board [${updated.boardSerial}]`);
    window.dispatchEvent(new CustomEvent('erp:et-lab-updated', { detail: { board: updated } }));
    return updated;
  }

  async deleteBoard(id) {
    const existing = storage.getItem(TABLE_NAMES.ET_BOARDS, id);
    if (!existing) throw new Error('Board not found.');

    if (existing.status === 'INSTALLED') {
      throw new Error(`Cannot delete board [${existing.boardSerial}] because it is currently installed on machine ${existing.currentMachineSerial}. Please remove it first.`);
    }

    // CONFIRMED WRITE: await Firebase HTTP 200 before success
    await storage.writeAndConfirm(TABLE_NAMES.ET_BOARDS, (tbl) => {
      const idx = tbl.findIndex(b => b.id === id);
      if (idx !== -1) tbl.splice(idx, 1);
    });
    auditService.log('DELETE', 'ET_LAB', id, `Deleted ENT Lab Board [${existing.boardSerial}]`);
    window.dispatchEvent(new CustomEvent('erp:et-lab-updated', { detail: { deletedId: id } }));
    return true;
  }

  // ============================================================
  // 3. MACHINE INVENTORY INTEGRATION & AUTO-LOOKUP
  // ============================================================

  /**
   * Get all machines formatted for dropdown / datalist selection
   */
  getAllMachinesForSelect() {
    const machines = storage.getTable(TABLE_NAMES.MACHINES) || [];
    const unitMap = new Map((storage.getTable(TABLE_NAMES.UNITS) || []).map(u => [u.id, u.name]));
    const floorMap = new Map((storage.getTable(TABLE_NAMES.FLOORS) || []).map(f => [f.id, f.name]));
    const lineMap = new Map((storage.getTable(TABLE_NAMES.LINES) || []).map(l => [l.id, l.name]));
    const nameMap = new Map((storage.getTable(TABLE_NAMES.MACHINE_NAMES) || []).map(n => [n.id, n.name]));
    const brandMap = new Map((storage.getTable(TABLE_NAMES.BRANDS) || []).map(b => [b.id, b.name]));
    const modelMap = new Map((storage.getTable(TABLE_NAMES.MODELS) || []).map(m => [m.id, m.name]));

    return machines.map(m => {
      const uName = unitMap.get(m.unitId) || m.unitStr || 'Unit';
      const fName = floorMap.get(m.floorId) || m.floorStr || 'Floor';
      const lName = lineMap.get(m.lineId) || m.lineStr || 'Line';
      const mName = nameMap.get(m.machineNameId) || m.machineNameStr || 'Machine';
      const bName = brandMap.get(m.brandId) || m.brandStr || m.brand || '';
      const modName = modelMap.get(m.modelId) || m.modelStr || '';

      const brandModelStr = [bName, modName].filter(Boolean).join(' ');
      return {
        id: m.id,
        serialNumber: m.serialNumber,
        machineName: mName,
        brand: bName,
        model: modName,
        unitName: uName,
        floorName: fName,
        lineName: lName,
        displayText: `${m.serialNumber} — ${mName} ${brandModelStr ? `(${brandModelStr})` : ''} [${fName} • ${lName}]`
      };
    });
  }

  /**
   * Lookup machine info strictly from Machine Inventory
   * Automatically extracts Unit, Floor, Line, Machine Name, Brand, Model
   */
  getMachineDetailsForBoard(machineSerialOrId) {
    if (!machineSerialOrId) return null;
    let clean = machineSerialOrId.trim().toUpperCase();
    if (clean.includes('—')) clean = clean.split('—')[0].trim();
    else if (clean.includes(' - ')) clean = clean.split(' - ')[0].trim();
    const cleanNoDash = clean.replace(/[\s\-_]/g, '');
    const machines = storage.getTable(TABLE_NAMES.MACHINES) || [];
    
    const matched = machines.find(m => {
      const s = (m.serialNumber || '').toUpperCase();
      const sNoDash = s.replace(/[\s\-_]/g, '');
      const id = (m.id || '').toUpperCase();
      return s === clean || sNoDash === cleanNoDash || id === clean;
    }) || machines.find(m => {
      const mStr = (m.modelStr || '').toUpperCase();
      const nStr = (m.machineNameStr || '').toUpperCase();
      return (mStr && mStr === clean) || (nStr && nStr === clean);
    });
    if (!matched) return null;

    const group = storage.getItem(TABLE_NAMES.GROUPS, matched.groupId);
    const unit = storage.getItem(TABLE_NAMES.UNITS, matched.unitId);
    const floor = storage.getItem(TABLE_NAMES.FLOORS, matched.floorId);
    const line = storage.getItem(TABLE_NAMES.LINES, matched.lineId);
    const machineName = storage.getItem(TABLE_NAMES.MACHINE_NAMES, matched.machineNameId);
    const brand = storage.getItem(TABLE_NAMES.BRANDS, matched.brandId);
    const model = storage.getItem(TABLE_NAMES.MODELS, matched.modelId);

    return {
      id: matched.id,
      serialNumber: matched.serialNumber,
      machineName: machineName?.name || matched.machineNameStr || 'Sewing Machine',
      brand: brand?.name || matched.brandStr || matched.brand || '—',
      model: model?.name || matched.modelStr || matched.model || '—',
      groupName: group?.name || 'Al-Muslim Group',
      unitName: unit?.name || matched.unitStr || 'Pacific Blue (Jeans Wear) Ltd.',
      floorName: floor?.name || matched.floorStr || 'Jamuna Floor',
      lineName: line?.name || matched.lineStr || 'Line PB-01',
      status: matched.status || 'ACTIVE',
      fullLocationText: `${unit?.name || 'Unit'} -> ${floor?.name || 'Floor'} -> ${line?.name || 'Line'}`
    };
  }

  // ============================================================
  // 4. INSTALL / ASSIGN BOARD TO MACHINE
  // ============================================================

  installBoardToMachine({
    boardId = null,
    boardSerial = null,
    machineSerial,
    installDate = null,
    installedBy = null,
    installedByCard = null,
    installedByArea = null,
    installedDate = null,
    partsSerial = null,
    remarks = ''
  }) {
    const user = authService.getCurrentUser();
    let board = boardId ? this.getBoardById(boardId) : this.getBoardBySerial(boardSerial);
    if (!board) throw new Error('Board record not found.');

    if (!machineSerial) throw new Error('Machine Serial Number is required.');
    const machineInfo = this.getMachineDetailsForBoard(machineSerial);
    if (!machineInfo) {
      throw new Error(`Machine with Serial Number "${machineSerial}" does not exist in Machine Inventory. Please select a valid machine.`);
    }

    const previousMachine = board.currentMachineSerial;
    const finalDate = installDate || installedDate || new Date().toISOString().split('T')[0];
    const finalInstalledBy = installedBy || user?.name || 'Engr. Tanvir Ahmed';
    const finalCard = installedByCard || '1001';
    const finalArea = installedByArea || 'Central ENT Lab';

    // Update board state
    const updatedBoard = {
      ...board,
      status: 'INSTALLED',
      currentMachineSerial: machineInfo.serialNumber,
      currentMachineId: machineInfo.id,
      installedDate: finalDate,
      installedBy: finalInstalledBy,
      installedByCard: finalCard,
      installedByArea: finalArea,
      location: machineInfo.fullLocationText,
      inhouseRepair: null,
      externalRepair: null,
      updatedAt: new Date().toISOString()
    };

    if (partsSerial !== undefined && partsSerial !== null && partsSerial.trim() !== '') {
      updatedBoard.slNo = partsSerial.trim();
      updatedBoard.jukiSlNo = partsSerial.trim();
    }

    storage.update(TABLE_NAMES.ET_BOARDS, board.id, updatedBoard);

    // 1. Add record to immutable ENT Board History
    this.addHistoryRecord({
      boardSerial: board.boardSerial,
      action: 'INSTALL',
      actionLabel: 'Installed on Machine',
      timestamp: new Date().toISOString(),
      machineSerial: machineInfo.serialNumber,
      machineId: machineInfo.id,
      location: machineInfo.fullLocationText,
      performedBy: user?.id || 'usr-super-admin',
      performedByName: finalInstalledBy,
      performedByCard: finalCard,
      performedByArea: finalArea,
      partsSerial: partsSerial ? partsSerial.trim() : (board.jukiSlNo || board.slNo || ''),
      remarks: remarks || `Installed on ${machineInfo.machineName} (${machineInfo.model}) at ${machineInfo.fullLocationText}`
    });

    // 2. Add record to central Machine History so Machine Lifetime automatically connects
    historyService.recordActivity({
      machineId: machineInfo.id,
      serialNumber: machineInfo.serialNumber,
      actionType: 'SERVICE_REPAIR',
      title: `⚡ ENT Lab Board Installed: ${board.boardSerial} (${board.partName})`,
      details: `Installed ENT Lab Board [${board.boardSerial} - ${board.partName}] by ${finalInstalledBy} (Card: ${finalCard}, Area: ${finalArea}). Remarks: ${remarks || 'Operational installation'}`,
      performedBy: user?.id || 'system',
      performedByName: finalInstalledBy,
      serviceRecord: {
        serviceDate: finalDate,
        floorLocation: machineInfo.floorName,
        serviceType: 'REPAIR',
        problemComplaint: 'Board replacement / installation',
        workPerformed: `Installed Board ${board.boardSerial} (${board.partName})`,
        sparePartsUsed: board.partName,
        sparePartSerial: partsSerial ? partsSerial.trim() : (board.jukiSlNo || board.slNo || board.boardSerial),
        sparePartQty: 1,
        technician: finalInstalledBy,
        remarks: remarks || 'Board assigned via ENT Lab Management'
      },
      remarks: `Board ${board.boardSerial} assigned`
    });

    auditService.log('INSTALL', 'ET_LAB', board.id, `Installed Board [${board.boardSerial}] on Machine [${machineInfo.serialNumber}] by ${finalInstalledBy} [${finalCard}]`);
    window.dispatchEvent(new CustomEvent('erp:et-lab-updated', { detail: { board: updatedBoard } }));
    return updatedBoard;
  }

  // ============================================================
  // 5. REMOVE BOARD FROM MACHINE
  // ============================================================

  removeBoardFromMachine({
    boardId = null,
    boardSerial = null,
    removalDate = null,
    removedBy = null,
    removedByCard = null,
    removedByArea = null,
    removalReason = '',
    nextStatus = 'AVAILABLE_SPARE', // 'AVAILABLE_SPARE', 'UNDER_INHOUSE_REPAIR', 'SENT_EXTERNAL'
    nextLocation = 'ENT Lab Shelf (Removed)',
    remarks = ''
  }) {
    const user = authService.getCurrentUser();
    let board = boardId ? this.getBoardById(boardId) : this.getBoardBySerial(boardSerial);
    if (!board) throw new Error('Board record not found.');

    const currentMachineSerial = board.currentMachineSerial || 'Unknown Machine';
    const currentMachineId = board.currentMachineId;
    const finalDate = removalDate || new Date().toISOString().split('T')[0];
    const finalRemovedBy = removedBy || user?.name || 'Engr. Tanvir Ahmed';
    const finalCard = removedByCard || '1001';
    const finalArea = removedByArea || 'Central ENT Lab';

    const updatedBoard = {
      ...board,
      status: nextStatus,
      currentMachineSerial: null,
      currentMachineId: null,
      installedDate: null,
      installedBy: null,
      installedByCard: null,
      installedByArea: null,
      location: nextLocation || 'ENT Lab Diagnostics',
      updatedAt: new Date().toISOString()
    };

    storage.update(TABLE_NAMES.ET_BOARDS, board.id, updatedBoard);

    // 1. Add record to ENT Board History (Never overwrite previous installation history)
    this.addHistoryRecord({
      boardSerial: board.boardSerial,
      action: 'REMOVE',
      actionLabel: 'Removed from Machine',
      timestamp: new Date().toISOString(),
      machineSerial: currentMachineSerial,
      machineId: currentMachineId,
      location: 'ENT Lab Diagnostics & Storage',
      performedBy: user?.id || 'usr-super-admin',
      performedByName: finalRemovedBy,
      performedByCard: finalCard,
      performedByArea: finalArea,
      removalReason: removalReason || 'Routine maintenance / issue detected',
      remarks: remarks || `Removed from Machine ${currentMachineSerial}. Reason: ${removalReason || 'N/A'}`
    });

    // 2. Add record to Machine History
    if (currentMachineSerial) {
      historyService.recordActivity({
        machineId: currentMachineId || 'global',
        serialNumber: currentMachineSerial,
        actionType: 'SERVICE_REPAIR',
        title: `📤 ENT Lab Board Removed: ${board.boardSerial} (${board.partName})`,
        details: `Removed Board [${board.boardSerial}] from machine by ${finalRemovedBy} (Card: ${finalCard}, Area: ${finalArea}). Reason: ${removalReason || 'Not specified'}. Remarks: ${remarks}`,
        performedBy: user?.id || 'system',
        performedByName: finalRemovedBy,
        remarks: `Board ${board.boardSerial} removed: ${removalReason}`
      });
    }

    auditService.log('REMOVE', 'ET_LAB', board.id, `Removed Board [${board.boardSerial}] from Machine [${currentMachineSerial}] by ${finalRemovedBy} [${finalCard}]`);
    window.dispatchEvent(new CustomEvent('erp:et-lab-updated', { detail: { board: updatedBoard } }));
    return updatedBoard;
  }

  // ============================================================
  // 5.1 REASSIGN BOARD TO ANOTHER MACHINE (Direct Transfer)
  // ============================================================

  reassignBoardToAnotherMachine({
    boardSerial,
    targetMachineSerial,
    assignDate = null,
    assignedBy = null,
    assignedByCard = null,
    assignedByArea = null,
    partsSerial = null,
    removalReason = '',
    remarks = ''
  }) {
    const board = this.getBoardBySerial(boardSerial);
    if (!board) throw new Error(`Board [${boardSerial}] not found.`);
    
    const prevMachine = board.currentMachineSerial;
    if (prevMachine && prevMachine.toUpperCase() === targetMachineSerial.toUpperCase()) {
      throw new Error(`Board [${boardSerial}] is already installed on Machine ${targetMachineSerial}.`);
    }

    // 1. If currently on a machine, log removal
    if (prevMachine) {
      this.removeBoardFromMachine({
        boardSerial: board.boardSerial,
        removalDate: assignDate,
        removedBy: assignedBy,
        removedByCard: assignedByCard,
        removedByArea: assignedByArea,
        removalReason: removalReason || `Reassigned directly to Machine ${targetMachineSerial}`,
        nextStatus: 'AVAILABLE_SPARE',
        nextLocation: 'Transfer in progress',
        remarks: `Auto-removed during transfer from ${prevMachine} to ${targetMachineSerial}`
      });
    }

    // 2. Install to new target machine
    return this.installBoardToMachine({
      boardSerial: board.boardSerial,
      machineSerial: targetMachineSerial,
      installedDate: assignDate,
      installedBy: assignedBy,
      installedByCard: assignedByCard,
      installedByArea: assignedByArea,
      partsSerial: partsSerial,
      remarks: remarks || (prevMachine ? `Transferred from Machine ${prevMachine} to ${targetMachineSerial}` : `Assigned to Machine ${targetMachineSerial}`)
    });
  }

  // ============================================================
  // 6. IN-HOUSE REPAIR MANAGEMENT
  // ============================================================

  startInHouseRepair({
    boardId = null,
    boardSerial = null,
    problem = '',
    startDate = null,
    repairedBy = null,
    repairedByCard = null,
    repairedByArea = null,
    details = '',
    remarks = ''
  }) {
    const user = authService.getCurrentUser();
    let board = boardId ? this.getBoardById(boardId) : this.getBoardBySerial(boardSerial);
    if (!board) throw new Error('Board record not found.');

    const finalStartDate = startDate || new Date().toISOString().split('T')[0];
    const finalTech = repairedBy || user?.name || 'Engr. Delwar Hossain';
    const finalCard = repairedByCard || '1005';
    const finalArea = repairedByArea || 'ENT Lab';

    const updatedBoard = {
      ...board,
      status: 'UNDER_INHOUSE_REPAIR',
      location: 'ENT Lab Workstation (In-House Repair)',
      inhouseRepair: {
        problem: problem || 'Component defect / signal fault',
        startDate: finalStartDate,
        repairedBy: finalTech,
        repairedByCard: finalCard,
        repairedByArea: finalArea,
        details: details || '',
        remarks: remarks || ''
      },
      updatedAt: new Date().toISOString()
    };

    storage.update(TABLE_NAMES.ET_BOARDS, board.id, updatedBoard);

    this.addHistoryRecord({
      boardSerial: board.boardSerial,
      action: 'INHOUSE_START',
      actionLabel: 'Started In-House Repair',
      timestamp: new Date().toISOString(),
      machineSerial: null,
      location: 'ENT Lab Workstation',
      repairType: 'In-House',
      problem: problem || 'In-House repair diagnosis',
      performedBy: user?.id || 'usr-super-admin',
      performedByName: finalTech,
      performedByCard: finalCard,
      performedByArea: finalArea,
      remarks: remarks || `In-House Repair started. Problem: ${problem || 'N/A'}`
    });

    auditService.log('REPAIR_START', 'ET_LAB', board.id, `Started In-House repair for Board [${board.boardSerial}] by ${finalTech} [${finalCard}]`);
    window.dispatchEvent(new CustomEvent('erp:et-lab-updated', { detail: { board: updatedBoard } }));
    return updatedBoard;
  }

  completeInHouseRepair({
    boardId = null,
    boardSerial = null,
    completeDate = null,
    repairedBy = null,
    repairedByCard = null,
    repairedByArea = null,
    repairDetails = '',
    remarks = ''
  }) {
    const user = authService.getCurrentUser();
    let board = boardId ? this.getBoardById(boardId) : this.getBoardBySerial(boardSerial);
    if (!board) throw new Error('Board record not found.');

    const finalCompleteDate = completeDate || new Date().toISOString().split('T')[0];
    const finalTech = repairedBy || board.inhouseRepair?.repairedBy || user?.name || 'Engr. Delwar Hossain';
    const finalCard = repairedByCard || board.inhouseRepair?.repairedByCard || '1005';
    const finalArea = repairedByArea || board.inhouseRepair?.repairedByArea || 'ENT Lab';

    const updatedBoard = {
      ...board,
      status: 'AVAILABLE_SPARE',
      location: 'ENT Lab Shelf A-01 (Tested & Ready)',
      lastInhouseRepair: {
        problem: board.inhouseRepair?.problem || 'Internal Repair',
        startDate: board.inhouseRepair?.startDate || finalCompleteDate,
        completeDate: finalCompleteDate,
        repairedBy: finalTech,
        repairedByCard: finalCard,
        repairedByArea: finalArea,
        repairDetails: repairDetails || 'Repaired and bench-tested',
        remarks: remarks || ''
      },
      inhouseRepair: null,
      updatedAt: new Date().toISOString()
    };

    storage.update(TABLE_NAMES.ET_BOARDS, board.id, updatedBoard);

    this.addHistoryRecord({
      boardSerial: board.boardSerial,
      action: 'INHOUSE_COMPLETE',
      actionLabel: 'Completed In-House Repair',
      timestamp: new Date().toISOString(),
      machineSerial: null,
      location: 'ENT Lab Ready Stock',
      repairType: 'In-House',
      repairDetails: repairDetails || 'In-house repair completed & tested',
      performedBy: user?.id || 'usr-super-admin',
      performedByName: finalTech,
      performedByCard: finalCard,
      performedByArea: finalArea,
      remarks: remarks || `In-House repair completed successfully by ${finalTech} [${finalCard}]`
    });

    auditService.log('REPAIR_COMPLETE', 'ET_LAB', board.id, `Completed In-House repair for Board [${board.boardSerial}]`);
    window.dispatchEvent(new CustomEvent('erp:et-lab-updated', { detail: { board: updatedBoard } }));
    return updatedBoard;
  }

  // ============================================================
  // 7. EXTERNAL COMPANY REPAIR MANAGEMENT
  // ============================================================

  sendExternalRepair({
    boardId = null,
    boardSerial = null,
    companyName,
    problem = '',
    sendDate = null,
    expectedReturnDate = '',
    sentBy = null,
    sentByCard = null,
    sentByArea = null,
    performedByName = null,
    remarks = ''
  }) {
    const user = authService.getCurrentUser();
    let board = boardId ? this.getBoardById(boardId) : this.getBoardBySerial(boardSerial);
    if (!board) throw new Error('Board record not found.');

    if (!companyName || !companyName.trim()) {
      throw new Error('External Company Name is required.');
    }

    const finalSendDate = sendDate || new Date().toISOString().split('T')[0];
    const finalSentBy = sentBy || performedByName || user?.name || 'Engr. Tanvir Ahmed';
    const finalCard = sentByCard || '1001';
    const finalArea = sentByArea || 'Central ENT Lab';
    const billCheck = this.checkPreviousBill(board);

    const updatedBoard = {
      ...board,
      status: 'SENT_EXTERNAL',
      location: `External: ${companyName}`,
      externalRepair: {
        companyName: companyName.trim(),
        problem: problem || 'External specialized diagnosis',
        sendDate: finalSendDate,
        expectedReturnDate: expectedReturnDate || '',
        sentBy: finalSentBy,
        sentByCard: finalCard,
        sentByArea: finalArea,
        remarks: remarks || '',
        previousBillChecked: billCheck.hasPreviousBill,
        previousBillNo: billCheck.billNo || null
      },
      updatedAt: new Date().toISOString()
    };

    storage.update(TABLE_NAMES.ET_BOARDS, board.id, updatedBoard);

    this.addHistoryRecord({
      boardSerial: board.boardSerial,
      action: 'SEND_EXTERNAL',
      actionLabel: 'Sent to External Company',
      timestamp: new Date().toISOString(),
      machineSerial: null,
      location: `External: ${companyName}`,
      companyName: companyName.trim(),
      repairType: 'External Company',
      problem: problem || 'Dispatched for external repair',
      performedBy: user?.id || 'usr-super-admin',
      performedByName: finalSentBy,
      performedByCard: finalCard,
      performedByArea: finalArea,
      remarks: `${remarks ? remarks + '. ' : ''}Sent to ${companyName} by ${finalSentBy} [${finalCard}]. Previous Bill: ${billCheck.hasPreviousBill ? billCheck.billNo : 'None'}`
    });

    auditService.log('SEND_EXTERNAL', 'ET_LAB', board.id, `Sent Board [${board.boardSerial}] to external repair company [${companyName}] by ${finalSentBy} [${finalCard}]`);
    window.dispatchEvent(new CustomEvent('erp:et-lab-updated', { detail: { board: updatedBoard } }));
    return updatedBoard;
  }

  sendToExternalCompany(data) {
    return this.sendExternalRepair(data);
  }

  receiveExternalRepair({
    boardId = null,
    boardSerial = null,
    returnDate = null,
    receivedBy = null,
    receivedByCard = null,
    receivedByArea = null,
    verifiedBy = null,
    verifiedByCard = null,
    verifiedByArea = null,
    verificationDate = null,
    repairResult = 'SUCCESSFUL',
    repairDetails = '',
    remarks = '',
    resendCompany = null,
    resendExpectedDate = null
  }) {
    const user = authService.getCurrentUser();
    let board = boardId ? this.getBoardById(boardId) : this.getBoardBySerial(boardSerial);
    if (!board) throw new Error('Board record not found.');

    const extInfo = board.externalRepair || {};
    const companyName = extInfo.companyName || 'External Repair Center';
    const sendDate = extInfo.sendDate || board.comeDate || new Date().toISOString().split('T')[0];
    const finalReturnDate = returnDate || new Date().toISOString().split('T')[0];
    const finalReceivedBy = receivedBy || user?.name || 'Engr. Tanvir Ahmed';
    const finalRecCard = receivedByCard || '1001';
    const finalRecArea = receivedByArea || 'Central ENT Lab';
    const finalVerifier = verifiedBy || finalReceivedBy;
    const finalVerCard = verifiedByCard || finalRecCard;
    const finalVerArea = verifiedByArea || finalRecArea;
    const finalVerificationDate = verificationDate || finalReturnDate;

    // Calculate attempt number from past history
    const pastHistory = this.getBoardHistory(board.boardSerial) || [];
    const pastReceivesCount = pastHistory.filter(h => h.action === 'RECEIVE_EXTERNAL').length;
    const attemptNumber = pastReceivesCount + 1;

    // Automatically calculate: Repair Duration = Return Date - Send Date
    let durationDays = 0;
    try {
      const d1 = new Date(sendDate);
      const d2 = new Date(finalReturnDate);
      const diffMs = d2.getTime() - d1.getTime();
      durationDays = Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
    } catch (e) {
      durationDays = 0;
    }

    // Determine status & acceptance labels based on user selection
    let nextStatus = 'AVAILABLE_SPARE';
    let acceptanceLabel = 'Accepted / Repair Successful';
    let resultDisplay = 'Successfully Repaired';

    if (repairResult === 'SUCCESSFUL' || repairResult === 'ACCEPTED' || repairResult.includes('Successful') || repairResult.includes('Repaired & Verified')) {
      nextStatus = 'AVAILABLE_SPARE';
      acceptanceLabel = 'Accepted / Repair Successful';
      resultDisplay = 'Successfully Repaired';
    } else if (repairResult === 'NOT_REPAIRED' || repairResult === 'REJECTED' || repairResult.includes('Not Solved') || repairResult.includes('Not Repaired')) {
      nextStatus = 'UNDER_INHOUSE_REPAIR';
      acceptanceLabel = 'Rejected / Repair Not Successful';
      resultDisplay = 'Not Repaired / Problem Not Solved';
    } else if (repairResult === 'PARTIALLY_REPAIRED' || repairResult.includes('Partially')) {
      nextStatus = 'UNDER_INHOUSE_REPAIR';
      acceptanceLabel = 'Partially Repaired';
      resultDisplay = 'Partially Repaired';
    } else if (repairResult === 'SEND_AGAIN' || repairResult.includes('Send Again')) {
      nextStatus = 'SENT_EXTERNAL';
      acceptanceLabel = 'Rejected / Send Again';
      resultDisplay = 'Send Again';
    }

    const updatedBoard = {
      ...board,
      status: nextStatus,
      location: nextStatus === 'SENT_EXTERNAL' ? `External: ${resendCompany || companyName}` : 
                nextStatus === 'UNDER_INHOUSE_REPAIR' ? 'ENT Lab Workstation (Repair Rejected/Unresolved)' : 
                'ENT Lab Shelf B-01 (Tested & Ready in Spares)',
      lastExternalRepair: {
        attemptNumber,
        companyName,
        problem: extInfo.problem || 'External repair',
        sendDate,
        returnDate: finalReturnDate,
        durationDays,
        repairResult: resultDisplay,
        acceptanceStatus: acceptanceLabel,
        receivedBy: finalReceivedBy,
        receivedByCard: finalRecCard,
        receivedByArea: finalRecArea,
        verifiedBy: finalVerifier,
        verifiedByCard: finalVerCard,
        verifiedByArea: finalVerArea,
        verificationDate: finalVerificationDate,
        repairDetails: repairDetails || '',
        remarks: remarks || ''
      },
      externalRepair: (repairResult === 'SEND_AGAIN' || repairResult.includes('Send Again')) ? {
        attemptNumber: attemptNumber + 1,
        companyName: (resendCompany || companyName).trim(),
        problem: repairDetails || extInfo.problem || 'Resent after verification rejection',
        sendDate: finalReturnDate,
        expectedReturnDate: resendExpectedDate || '',
        sentBy: finalReceivedBy,
        sentByCard: finalRecCard,
        sentByArea: finalRecArea,
        remarks: `Resent after rejection. Previous Attempt: #${attemptNumber}`,
        previousBillChecked: true,
        previousBillNo: board.billNo || null
      } : null,
      updatedAt: new Date().toISOString()
    };

    storage.update(TABLE_NAMES.ET_BOARDS, board.id, updatedBoard);

    // 1. Add record to immutable ENT Board History for this completed repair attempt
    this.addHistoryRecord({
      boardSerial: board.boardSerial,
      action: 'RECEIVE_EXTERNAL',
      actionLabel: `Received & Verified (Attempt #${attemptNumber})`,
      timestamp: new Date().toISOString(),
      machineSerial: null,
      location: updatedBoard.location,
      companyName,
      repairType: 'External Company',
      repairDurationDays: durationDays,
      repairAttempt: attemptNumber,
      repairResult: resultDisplay,
      acceptanceStatus: acceptanceLabel,
      verifiedBy: finalVerifier,
      verificationDate: finalVerificationDate,
      repairDetails: repairDetails || `Received from ${companyName}`,
      performedBy: user?.id || 'usr-super-admin',
      performedByName: finalReceivedBy,
      remarks: `[Repair #${attemptNumber}] Result: ${resultDisplay} → Status: ${acceptanceLabel}. Received By: ${finalReceivedBy}, Verified By: ${finalVerifier} (${finalVerificationDate}). ${remarks || ''}`
    });

    // 2. If "Send Again" selected, immediately record a NEW SEND_EXTERNAL history record for the new attempt!
    if (repairResult === 'SEND_AGAIN' || repairResult.includes('Send Again')) {
      const nextAttempt = attemptNumber + 1;
      const nextCompany = (resendCompany || companyName).trim();
      this.addHistoryRecord({
        boardSerial: board.boardSerial,
        action: 'SEND_EXTERNAL',
        actionLabel: `Sent to External Company (Attempt #${nextAttempt})`,
        timestamp: new Date(Date.now() + 1000).toISOString(),
        machineSerial: null,
        location: `External: ${nextCompany}`,
        companyName: nextCompany,
        repairType: 'External Company',
        repairAttempt: nextAttempt,
        problem: `Resent to ${nextCompany} after Attempt #${attemptNumber} was rejected. Details: ${repairDetails || 'Problem not solved'}`,
        performedBy: user?.id || 'usr-super-admin',
        performedByName: finalVerifier,
        remarks: `Repair Attempt #${nextAttempt} initiated by ${finalVerifier}. Previous attempt #${attemptNumber} returned unresolved.`
      });
    }

    auditService.log('RECEIVE_EXTERNAL', 'ET_LAB', board.id, `Received Board [${board.boardSerial}] from [${companyName}] (Attempt #${attemptNumber}: ${acceptanceLabel})`);
    window.dispatchEvent(new CustomEvent('erp:et-lab-updated', { detail: { board: updatedBoard } }));
    return updatedBoard;
  }

  receiveFromExternalCompany(data) {
    return this.receiveExternalRepair(data);
  }

  markScrapBoard({ boardId = null, boardSerial = null, reason = '', remarks = '' }) {
    const user = authService.getCurrentUser();
    let board = boardId ? this.getBoardById(boardId) : this.getBoardBySerial(boardSerial);
    if (!board) throw new Error('Board record not found.');

    const updatedBoard = {
      ...board,
      status: 'DAMAGED_SCRAP',
      location: 'ENT Lab Scrap Archive',
      currentMachineSerial: null,
      currentMachineId: null,
      updatedAt: new Date().toISOString()
    };

    storage.update(TABLE_NAMES.ET_BOARDS, board.id, updatedBoard);

    this.addHistoryRecord({
      boardSerial: board.boardSerial,
      action: 'MARK_SCRAP',
      actionLabel: 'Marked as Damaged / Scrap',
      timestamp: new Date().toISOString(),
      machineSerial: null,
      location: 'Scrap Bin Archive',
      performedBy: user?.id || 'usr-super-admin',
      performedByName: user?.name || 'Super Administrator',
      remarks: `Board scrapped. Reason: ${reason || 'Irreparable board damage'}. ${remarks || ''}`
    });

    auditService.log('MARK_SCRAP', 'ET_LAB', board.id, `Marked Board [${board.boardSerial}] as Damaged/Scrap`);
    window.dispatchEvent(new CustomEvent('erp:et-lab-updated', { detail: { board: updatedBoard } }));
    return updatedBoard;
  }

  // ============================================================
  // 8. PREVIOUS BILL CHECK (DUPLICATE-BILLING PREVENTION)
  // ============================================================

  checkPreviousBill(boardOrSerial) {
    let board = typeof boardOrSerial === 'string' ? this.getBoardBySerial(boardOrSerial) : boardOrSerial;
    if (!board) return { hasPreviousBill: false, billNo: null, warningMessage: '' };

    const history = this.getBoardHistory(board.boardSerial) || [];
    const billList = new Set();

    if (board.billNo && board.billNo.trim()) {
      billList.add(board.billNo.trim());
    }

    history.forEach(h => {
      if (h.billNo && h.billNo.trim()) billList.add(h.billNo.trim());
      // Check remarks for bill mentions
      if (h.remarks && h.remarks.includes('Bill No:')) {
        const match = h.remarks.match(/Bill No:\s*([A-Za-z0-9\-_]+)/i);
        if (match && match[1]) billList.add(match[1]);
      }
    });

    const bills = Array.from(billList);
    const hasPreviousBill = bills.length > 0;
    const primaryBill = bills[0] || null;

    return {
      hasPreviousBill,
      billNo: primaryBill,
      allBills: bills,
      warningMessage: hasPreviousBill ? 
        `⚠️ THIS BOARD HAS PREVIOUS BILL HISTORY (${bills.join(', ')}). PLEASE CHECK BEFORE PROCESSING ANOTHER BILL.` : 
        'No previous billing records detected for this board.'
    };
  }

  // ============================================================
  // 9. COMPLETE BOARD LIFETIME & HISTORY ENGINE
  // ============================================================

  addHistoryRecord(record) {
    const historyTable = storage.getTable(TABLE_NAMES.ET_BOARD_HISTORY) || [];
    const newRecord = {
      id: `eth-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: record.timestamp || new Date().toISOString(),
      boardSerial: record.boardSerial,
      action: record.action || 'STATUS_CHANGE',
      actionLabel: record.actionLabel || ET_ACTIONS[record.action]?.label || 'Board Event',
      machineSerial: record.machineSerial || null,
      machineId: record.machineId || null,
      location: record.location || 'ENT Lab',
      repairType: record.repairType || null,
      companyName: record.companyName || null,
      problem: record.problem || null,
      repairDurationDays: record.repairDurationDays || null,
      repairAttempt: record.repairAttempt || null,
      repairResult: record.repairResult || null,
      acceptanceStatus: record.acceptanceStatus || null,
      repairDetails: record.repairDetails || null,
      removalReason: record.removalReason || null,
      performedBy: record.performedBy || 'usr-super-admin',
      performedByName: record.performedByName || 'Engr. Tanvir Ahmed',
      performedByCard: record.performedByCard || '1001',
      performedByArea: record.performedByArea || 'Central ENT Lab',
      verifiedBy: record.verifiedBy || null,
      verifiedByName: record.verifiedByName || record.verifiedBy || null,
      verifiedByCard: record.verifiedByCard || null,
      verifiedByArea: record.verifiedByArea || null,
      billNo: record.billNo || null,
      remarks: record.remarks || ''
    };

    historyTable.push(newRecord);
    storage.saveTable(TABLE_NAMES.ET_BOARD_HISTORY);
    return newRecord;
  }

  getBoardHistory(boardSerial) {
    if (!boardSerial) return [];
    const clean = boardSerial.trim().toUpperCase();
    const history = storage.getTable(TABLE_NAMES.ET_BOARD_HISTORY) || [];
    return history
      .filter(h => (h.boardSerial || '').toUpperCase() === clean)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); // Most recent first for complete history
  }

  getBoardHistoryForMachine(machineSerial) {
    if (!machineSerial) return [];
    const clean = machineSerial.trim().toUpperCase();
    const history = storage.getTable(TABLE_NAMES.ET_BOARD_HISTORY) || [];
    return history
      .filter(h => (h.machineSerial || '').toUpperCase() === clean)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  /**
   * Get lifetime summary statistics for a board
   */
  getBoardStats(boardSerial) {
    const history = this.getBoardHistory(boardSerial);
    const board = this.getBoardBySerial(boardSerial);

    let installCount = 0;
    let removeCount = 0;
    let inhouseRepairCount = 0;
    let externalSendCount = 0;
    let externalReturnCount = 0;
    const externalCompanies = new Set();
    const machinesConnected = new Map();

    history.forEach(h => {
      if (h.machineSerial) {
        machinesConnected.set(h.machineSerial, {
          serial: h.machineSerial,
          location: h.location,
          lastActionDate: h.timestamp
        });
      }

      if (h.action === 'INSTALL') {
        installCount++;
      } else if (h.action === 'REMOVE') {
        removeCount++;
      } else if (h.action === 'ASSIGN_ANOTHER') {
        installCount++;
        removeCount++;
      } else if (h.action === 'INHOUSE_REPAIR') {
        if (h.acceptanceStatus || h.repairResult) {
          inhouseRepairCount++;
        }
      } else if (h.action === 'INHOUSE_COMPLETE' || h.action === 'INHOUSE_START') {
        if (h.action === 'INHOUSE_COMPLETE') inhouseRepairCount++;
      } else if (h.action === 'SEND_EXTERNAL') {
        externalSendCount++;
      } else if (h.action === 'RECEIVE_EXTERNAL') {
        externalReturnCount++;
        if (h.companyName) externalCompanies.add(h.companyName);
      }
    });

    const totalRepairs = inhouseRepairCount + externalReturnCount;

    return {
      boardSerial,
      board,
      totalEvents: history.length,
      installCount,
      installationsCount: installCount,
      removeCount,
      totalRepairs,
      inhouseRepairCount,
      inhouseRepairsCount: inhouseRepairCount,
      externalSendCount,
      externalReturnCount,
      externalRepairsCount: externalReturnCount || externalSendCount,
      externalCompaniesList: Array.from(externalCompanies),
      externalCompaniesCount: externalCompanies.size,
      connectedMachines: Array.from(machinesConnected.values()),
      currentMachine: board?.currentMachineSerial || null,
      currentStatus: board?.status || 'AVAILABLE_SPARE'
    };
  }

  /**
   * Get global ENT Lab high-level KPI metrics
   */
  getGlobalStats() {
    const boards = storage.getTable(TABLE_NAMES.ET_BOARDS) || [];
    const history = storage.getTable(TABLE_NAMES.ET_BOARD_HISTORY) || [];

    const totalBoards = boards.length;
    const installedCount = boards.filter(b => b.status === 'INSTALLED').length;
    const availableSpareCount = boards.filter(b => b.status === 'AVAILABLE_SPARE' || b.status === 'RETURNED').length;
    const inhouseRepairCount = boards.filter(b => b.status === 'UNDER_INHOUSE_REPAIR').length;
    const sentExternalCount = boards.filter(b => b.status === 'SENT_EXTERNAL').length;
    const returnedCount = boards.filter(b => b.status === 'RETURNED').length;
    const damagedScrapCount = boards.filter(b => b.status === 'DAMAGED_SCRAP').length;
    const billedBoardsCount = boards.filter(b => Boolean(b.billNo && b.billNo.trim())).length;

    return {
      totalBoards,
      installedCount,
      availableSpareCount,
      inhouseRepairCount,
      sentExternalCount,
      returnedCount,
      damagedScrapCount,
      billedBoardsCount,
      totalHistoryLogs: history.length
    };
  }

  // ============================================================
  // 10. ADMIN CONFIGURATION (COMPANIES & CATEGORIES)
  // ============================================================

  getCompanies() {
    return storage.getTable(TABLE_NAMES.ET_COMPANIES) || [];
  }

  async addCompany(companyData, contactPerson = '', phone = '') {
    const name = typeof companyData === 'string' ? companyData : companyData.name;
    const contact = typeof companyData === 'string' ? contactPerson : (companyData.contactPerson || '');
    const ph = typeof companyData === 'string' ? phone : (companyData.phone || '');
    const newComp = {
      id: `etc-${Date.now()}`,
      name: (name || '').trim(),
      contactPerson: contact,
      phone: ph,
      email: typeof companyData === 'object' ? (companyData.email || '') : '',
      address: typeof companyData === 'object' ? (companyData.address || '') : '',
      status: 'ACTIVE'
    };
    if (typeof companyData === 'object' && companyData.email) newComp.email = companyData.email;
    if (typeof companyData === 'object' && companyData.address) newComp.address = companyData.address;
    // CONFIRMED WRITE
    await storage.writeAndConfirm(TABLE_NAMES.ET_COMPANIES, (tbl) => { tbl.push(newComp); });
    auditService.log('CONFIG', 'ET_LAB', newComp.id, `Added external repair company: ${newComp.name}`);
    return newComp;
  }

  async updateCompany(id, updates) {
    const list = this.getCompanies();
    const idx = list.findIndex(c => c.id === id);
    if (idx === -1) throw new Error('Company not found.');
    // CONFIRMED WRITE
    let updated;
    await storage.writeAndConfirm(TABLE_NAMES.ET_COMPANIES, (tbl) => {
      const i = tbl.findIndex(c => c.id === id);
      if (i !== -1) { tbl[i] = { ...tbl[i], ...updates }; updated = tbl[i]; }
    });
    auditService.log('CONFIG', 'ET_LAB', id, `Updated external repair company: ${updated?.name || id}`);
    return updated;
  }

  deleteCompany(id) {
    let list = this.getCompanies();
    const comp = list.find(c => c.id === id);
    list = list.filter(c => c.id !== id);
    storage.setTable(TABLE_NAMES.ET_COMPANIES, list);
    if (comp) {
      auditService.log('CONFIG', 'ET_LAB', id, `Deleted external repair company: ${comp.name}`);
    }
    return true;
  }

  getCategories() {
    return storage.getTable(TABLE_NAMES.ET_CATEGORIES) || [];
  }

  async addCategory(categoryData) {
    const name = typeof categoryData === 'string' ? categoryData : categoryData.name;
    const newCat = {
      id: `etcat-${Date.now()}`,
      name: (name || '').trim(),
      code: typeof categoryData === 'object' && categoryData.code ? categoryData.code : (name || '').toUpperCase().replace(/\s+/g, '_'),
      description: typeof categoryData === 'object' ? (categoryData.description || '') : '',
      status: 'ACTIVE'
    };
    // CONFIRMED WRITE
    await storage.writeAndConfirm(TABLE_NAMES.ET_CATEGORIES, (tbl) => { tbl.push(newCat); });
    auditService.log('CONFIG', 'ET_LAB', newCat.id, `Added category: ${newCat.name}`);
    return newCat;
  }

  async updateCategory(id, updates) {
    let updated;
    // CONFIRMED WRITE
    await storage.writeAndConfirm(TABLE_NAMES.ET_CATEGORIES, (tbl) => {
      const idx = tbl.findIndex(c => c.id === id);
      if (idx === -1) throw new Error('Category not found.');
      tbl[idx] = { ...tbl[idx], ...updates };
      updated = tbl[idx];
    });
    auditService.log('CONFIG', 'ET_LAB', id, `Updated category: ${updated?.name || id}`);
    return updated;
  }

  deleteCategory(id) {
    let list = this.getCategories();
    const cat = list.find(c => c.id === id);
    list = list.filter(c => c.id !== id);
    storage.setTable(TABLE_NAMES.ET_CATEGORIES, list);
    if (cat) {
      auditService.log('CONFIG', 'ET_LAB', id, `Deleted category: ${cat.name}`);
    }
    return true;
  }

  // ============================================================
  // 11. ENT LAB SECTION-WISE TECHNICIANS & MANPOWER LINKAGE
  // ============================================================

  getTechnicians() {
    const table = storage.getTable(TABLE_NAMES.ET_TECHNICIANS) || [];
    if (table.length === 0) {
      // Seed with initial dedicated ENT technicians from Manpower
      const initial = [
        {
          id: 'ett-1',
          name: 'Engr. Tanvir Ahmed',
          cardNumber: '1001',
          role: 'Lead ENT Lab Engineer',
          section: 'Central ENT Electronics Lab',
          phone: '+880 1711-234567',
          status: 'ACTIVE'
        },
        {
          id: 'ett-2',
          name: 'Md. Delwar Hossain',
          cardNumber: '1005',
          role: 'Senior PCB Technician',
          section: 'ENT Repair & Diagnostics',
          phone: '+880 1712-345678',
          status: 'ACTIVE'
        },
        {
          id: 'ett-3',
          name: 'Md. Karim',
          cardNumber: '1012',
          role: 'In-House Electronics Mechanic',
          section: 'In-House Testing Bay',
          phone: '+880 1713-456789',
          status: 'ACTIVE'
        }
      ];
      storage.setTable(TABLE_NAMES.ET_TECHNICIANS, initial);
      return initial;
    }
    // Clean up any old E&T in stored records and persist cleaned version
    let modified = false;
    const cleaned = table.map(t => {
      let r = t.role || 'ENT Lab Technician';
      let s = t.section || 'Central ENT Lab';
      if (r.includes('E&T') || r.includes('E&amp;T')) {
        r = r.replace(/E&amp;T|E&T/g, 'ENT');
        modified = true;
      }
      if (s.includes('E&T') || s.includes('E&amp;T')) {
        s = s.replace(/E&amp;T|E&T/g, 'ENT');
        modified = true;
      }
      return { ...t, role: r, section: s };
    });
    if (modified) {
      storage.setTable(TABLE_NAMES.ET_TECHNICIANS, cleaned);
    }
    return cleaned;
  }

  async addTechnician(data) {
    const list = this.getTechnicians();
    const name = (typeof data === 'string' ? data : data.name || '').trim();
    if (!name) {
      throw new Error('Technician name is required.');
    }

    const erpEmployees = storage.getTable(TABLE_NAMES.EMPLOYEES) || [];
    const empMatch = erpEmployees.find(e =>
      (e.name && e.name.trim().toLowerCase() === name.toLowerCase()) ||
      (data.cardNumber && e.cardNumber && e.cardNumber.toString().trim() === data.cardNumber.toString().trim())
    );

    const resolvedCard = data.cardNumber || empMatch?.cardNumber || '';
    const resolvedPhone = data.phone || empMatch?.phone || '';

    // Check for duplicate
    const exists = list.some(t =>
      (resolvedCard && t.cardNumber && t.cardNumber.toString().trim() === resolvedCard.toString().trim()) ||
      t.name.trim().toLowerCase() === name.toLowerCase()
    );
    if (exists) {
      throw new Error(`Technician "${name}" ${resolvedCard ? `[Card: ${resolvedCard}] ` : ''}is already in ENT Lab staff list.`);
    }

    const newTech = {
      id: `ett-${Date.now()}`,
      name,
      cardNumber: resolvedCard,
      role: (data.role || data.designation || empMatch?.designation || 'ENT Lab Technician').replace(/E&amp;T|E&T/g, 'ENT'),
      section: (data.section || data.department || empMatch?.workingArea || empMatch?.department || 'Central ENT Lab').replace(/E&amp;T|E&T/g, 'ENT'),
      phone: resolvedPhone,
      status: 'ACTIVE'
    };
    // CONFIRMED WRITE
    await storage.writeAndConfirm(TABLE_NAMES.ET_TECHNICIANS, (tbl) => { tbl.push(newTech); });
    auditService.log('CONFIG', 'ET_LAB', newTech.id, `Added ENT Lab technician: ${newTech.name}`);
    return newTech;
  }

  deleteTechnician(id) {
    let list = this.getTechnicians();
    list = list.filter(t => t.id !== id);
    storage.setTable(TABLE_NAMES.ET_TECHNICIANS, list);
    return true;
  }

  /**
   * Retrieves all personnel from Manpower Management, ERP Users, and ENT Techs
   * formatted for instant search, live auto-fill, and multi-field identification
   * Preserves identical names with distinct Card Numbers and Working Areas!
   */
  getAllPersonnelForSelect() {
    const erpUsers = storage.getTable(TABLE_NAMES.USERS) || [];
    const erpEmployees = storage.getTable(TABLE_NAMES.EMPLOYEES) || [];
    const entTechs = this.getTechnicians() || [];

    const map = new Map();

    // 1. Add ENT Dedicated Technicians (Highest priority)
    entTechs.forEach(t => {
      if (t.name && t.name.trim()) {
        const key = `tech_${t.id || t.cardNumber || t.name}`;
        map.set(key, {
          id: t.id,
          name: t.name.trim(),
          cardNumber: t.cardNumber || '1001',
          workingArea: t.section || 'ENT Lab',
          designation: t.role || 'ENT Specialist',
          department: t.section || 'Central ENT Lab',
          phone: t.phone || '',
          isEntSpecialist: true,
          displayText: `Card No. ${t.cardNumber || '1001'} | Name: ${t.name.trim()} | Working Area: ${t.section || 'ENT Lab'}`
        });
      }
    });

    // 2. Add Manpower Employees (All registered technicians/mechanics/engineers - preserving identical names with unique card numbers)
    erpEmployees.forEach(e => {
      if (e.name && e.name.trim()) {
        const key = `emp_${e.id || e.cardNumber || (e.name + Math.random())}`;
        const area = e.workingArea || e.department || 'Production Floor';
        map.set(key, {
          id: e.id,
          name: e.name.trim(),
          cardNumber: e.cardNumber || '—',
          workingArea: area,
          designation: e.designation || 'Technician',
          department: e.department || 'Maintenance',
          phone: e.phone || '',
          isEntSpecialist: false,
          displayText: `Card No. ${e.cardNumber || '—'} | Name: ${e.name.trim()} | Working Area: ${area}`
        });
      }
    });

    // 3. Add ERP Users
    erpUsers.forEach(u => {
      if (u.name && u.name.trim()) {
        const key = `usr_${u.id || u.name}`;
        if (!map.has(key)) {
          map.set(key, {
            id: u.id,
            name: u.name.trim(),
            cardNumber: u.cardNumber || '1001',
            workingArea: 'Administration / Central Plant',
            designation: u.role || 'System User',
            department: 'System Administration',
            phone: '',
            isEntSpecialist: false,
            displayText: `Card No. ${u.cardNumber || '1001'} | Name: ${u.name.trim()} | Working Area: Administration`
          });
        }
      }
    });

    return Array.from(map.values());
  }
}

export const etLabService = new EtLabService();
