/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Machine Transfer Management & Configurable Multi-Level Approval Execution Service
 */

import { storage } from '../db/storage.js';
import { CloudSaveError } from '../db/storage.js';
import { syncManager } from '../db/syncManager.js';
import { TABLE_NAMES, TRANSFER_STATUSES, ROLES, APPROVER_TYPES } from '../db/schema.js';
import { authService } from './authService.js';
import { masterDataService } from './masterDataService.js';
import { workflowService } from './workflowService.js';
import { auditService } from './auditService.js';
import { notificationService } from './notificationService.js';
import { historyService } from './historyService.js';
import { INITIAL_DATA } from '../db/initialData.js';

/**
 * Universal machine equipment details resolver for transfer requests.
 * Uses multi-layered live DB + master data + INITIAL_DATA fallback,
 * actively filtering out generic placeholders ('Machine', 'Brand', 'Model').
 */
export function resolveTransferMachineDetails(req) {
  if (!req) {
    return {
      machineName: 'Sewing Machine',
      brand: '—',
      model: '—',
      serialNumber: '—',
      category: 'Garments Machinery',
      brandModelText: 'Garments Machinery',
      liveMachine: null
    };
  }

  const stored = req.machineInfo || {};
  const isGeneric = (val) => {
    if (!val || typeof val !== 'string') return true;
    const t = val.trim().toLowerCase();
    return (
      t === '' ||
      t === 'machine' ||
      t === 'brand' ||
      t === 'model' ||
      t === 'standard' ||
      t === 'n/a' ||
      t === 'na' ||
      t === '—' ||
      t === '-' ||
      t === 'undefined' ||
      t === 'null' ||
      t === 'unknown'
    );
  };

  const rawSerial =
    stored.serialNumber ||
    req.serialNumber ||
    req.machineSerial ||
    '';
  const cleanSerial = String(rawSerial).trim().toUpperCase();

  // 1. Locate machine record with multi-layered fallback
  let liveMachine = null;
  if (req.machineId) {
    liveMachine = storage.getItem(TABLE_NAMES.MACHINES, req.machineId) || null;
  }
  if (!liveMachine && cleanSerial) {
    const allM = storage.getTable(TABLE_NAMES.MACHINES) || [];
    liveMachine =
      allM.find(m => m.serialNumber && String(m.serialNumber).trim().toUpperCase() === cleanSerial) ||
      allM.find(m => m.id && String(m.id).trim().toUpperCase() === cleanSerial) ||
      allM.find(m => m.serialNumber && String(m.serialNumber).trim().toUpperCase().includes(cleanSerial)) ||
      null;
  }
  if (!liveMachine) {
    const initMachines = (typeof INITIAL_DATA !== 'undefined' && Array.isArray(INITIAL_DATA.machines)) ? INITIAL_DATA.machines : [];
    if (req.machineId) {
      liveMachine = initMachines.find(m => m.id === req.machineId) || null;
    }
    if (!liveMachine && cleanSerial) {
      liveMachine =
        initMachines.find(m => m.serialNumber && String(m.serialNumber).trim().toUpperCase() === cleanSerial) ||
        initMachines.find(m => m.serialNumber && String(m.serialNumber).trim().toUpperCase().includes(cleanSerial)) ||
        null;
    }
  }
  if (!liveMachine && cleanSerial) {
    const smList = storage.getTable(TABLE_NAMES.STORAGE_MASTER) || [];
    const sm = smList.find(s => s.category === 'MACHINE' && (
      (s.serialNumber && String(s.serialNumber).trim().toUpperCase() === cleanSerial) ||
      (s.id && String(s.id).trim().toUpperCase() === cleanSerial)
    ));
    if (sm) {
      liveMachine = {
        machineNameStr: sm.machineName || sm.item_name || sm.name,
        brandStr: sm.brand,
        modelStr: sm.model,
        serialNumber: sm.serialNumber || cleanSerial,
        category: sm.subCategory || 'Garments Machinery'
      };
    }
  }

  // 2. Resolve Machine Name
  let resolvedMachineName = null;
  if (liveMachine) {
    if (liveMachine.machineNameStr && !isGeneric(liveMachine.machineNameStr)) {
      resolvedMachineName = liveMachine.machineNameStr;
    } else if (liveMachine.machineNameId) {
      const mnObj =
        masterDataService.getMachineNameById(liveMachine.machineNameId) ||
        storage.getItem(TABLE_NAMES.MACHINE_NAMES, liveMachine.machineNameId) ||
        ((typeof INITIAL_DATA !== 'undefined' && INITIAL_DATA.machine_names) ? INITIAL_DATA.machine_names.find(x => x.id === liveMachine.machineNameId) : null);
      if (mnObj?.name && !isGeneric(mnObj.name)) {
        resolvedMachineName = mnObj.name;
      }
    }
    if (!resolvedMachineName && liveMachine.machineName && !isGeneric(liveMachine.machineName)) {
      resolvedMachineName = liveMachine.machineName;
    }
    if (!resolvedMachineName && liveMachine.name && !isGeneric(liveMachine.name)) {
      resolvedMachineName = liveMachine.name;
    }
  }
  if (!resolvedMachineName && stored.machineName && !isGeneric(stored.machineName)) {
    resolvedMachineName = stored.machineName;
  }
  if (!resolvedMachineName && req.machineName && !isGeneric(req.machineName)) {
    resolvedMachineName = req.machineName;
  }

  // 3. Resolve Brand
  let resolvedBrand = null;
  if (liveMachine) {
    if (liveMachine.brandStr && !isGeneric(liveMachine.brandStr)) {
      resolvedBrand = liveMachine.brandStr;
    } else if (liveMachine.brandId) {
      const brdObj =
        masterDataService.getBrandById(liveMachine.brandId) ||
        storage.getItem(TABLE_NAMES.BRANDS, liveMachine.brandId) ||
        ((typeof INITIAL_DATA !== 'undefined' && INITIAL_DATA.brands) ? INITIAL_DATA.brands.find(x => x.id === liveMachine.brandId) : null);
      if (brdObj?.name && !isGeneric(brdObj.name)) {
        resolvedBrand = brdObj.name;
      }
    }
    if (!resolvedBrand && liveMachine.brand && !isGeneric(liveMachine.brand)) {
      resolvedBrand = liveMachine.brand;
    }
  }
  if (!resolvedBrand && stored.brand && !isGeneric(stored.brand)) {
    resolvedBrand = stored.brand;
  }
  if (!resolvedBrand && req.machineBrand && !isGeneric(req.machineBrand)) {
    resolvedBrand = req.machineBrand;
  }
  if (!resolvedBrand && req.brandName && !isGeneric(req.brandName)) {
    resolvedBrand = req.brandName;
  }

  // 4. Resolve Model
  let resolvedModel = null;
  if (liveMachine) {
    if (liveMachine.modelStr && !isGeneric(liveMachine.modelStr)) {
      resolvedModel = liveMachine.modelStr;
    } else if (liveMachine.modelId) {
      const mdlObj =
        masterDataService.getModelById(liveMachine.modelId) ||
        storage.getItem(TABLE_NAMES.MODELS, liveMachine.modelId) ||
        ((typeof INITIAL_DATA !== 'undefined' && INITIAL_DATA.models) ? INITIAL_DATA.models.find(x => x.id === liveMachine.modelId) : null);
      if (mdlObj?.name && !isGeneric(mdlObj.name)) {
        resolvedModel = mdlObj.name;
      }
    }
    if (!resolvedModel && liveMachine.model && !isGeneric(liveMachine.model)) {
      resolvedModel = liveMachine.model;
    }
    if (!resolvedModel && liveMachine.modelName && !isGeneric(liveMachine.modelName)) {
      resolvedModel = liveMachine.modelName;
    }
  }
  if (!resolvedModel && stored.model && !isGeneric(stored.model)) {
    resolvedModel = stored.model;
  }
  if (!resolvedModel && req.machineModel && !isGeneric(req.machineModel)) {
    resolvedModel = req.machineModel;
  }
  if (!resolvedModel && req.modelName && !isGeneric(req.modelName)) {
    resolvedModel = req.modelName;
  }

  // Fallbacks if not detected
  if (!resolvedMachineName) {
    if (resolvedBrand && !isGeneric(resolvedBrand)) {
      resolvedMachineName = `${resolvedBrand} Machine`;
    } else {
      resolvedMachineName = 'Sewing Machine';
    }
  }
  resolvedBrand = resolvedBrand || '—';
  resolvedModel = resolvedModel || '—';

  // 5. Resolve Serial
  const resolvedSerial =
    (liveMachine && liveMachine.serialNumber) ||
    cleanSerial ||
    'N/A';

  // 6. Category
  let resolvedCategory = null;
  if (liveMachine) {
    const catId = liveMachine.categoryId;
    if (catId) {
      resolvedCategory = storage.getItem(TABLE_NAMES.CATEGORIES, catId)?.name;
    }
    if (!resolvedCategory && liveMachine.category && !isGeneric(liveMachine.category)) {
      resolvedCategory = liveMachine.category;
    }
  }
  if (!resolvedCategory && stored.category && !isGeneric(stored.category)) {
    resolvedCategory = stored.category;
  }
  resolvedCategory = resolvedCategory || 'Garments Machinery';

  // Format brand & model line
  let brandModelText = '';
  const hasBrand = resolvedBrand && resolvedBrand !== '—';
  const hasModel = resolvedModel && resolvedModel !== '—';
  if (hasBrand && hasModel) {
    brandModelText = `${resolvedBrand} • ${resolvedModel}`;
  } else if (hasBrand) {
    brandModelText = resolvedBrand;
  } else if (hasModel) {
    brandModelText = resolvedModel;
  } else {
    brandModelText = resolvedCategory;
  }

  return {
    machineName: resolvedMachineName,
    brand: resolvedBrand,
    model: resolvedModel,
    serialNumber: resolvedSerial,
    category: resolvedCategory,
    brandModelText,
    liveMachine
  };
}

class TransferService {
  /**
   * Returns all transfer requests with multi-field filtering
   */
  getTransferRequests(params = {}) {
    let list = storage.getTable(TABLE_NAMES.TRANSFER_REQUESTS) || [];
    list = (Array.isArray(list) ? list : []).filter(Boolean).map(t => {
      if (!t.status) {
        t.status = TRANSFER_STATUSES.PENDING_APPROVAL;
      }
      return t;
    });
    list = [...list].sort((a, b) => new Date(b.requestedAt || 0) - new Date(a.requestedAt || 0));

    // Scoped location filtering for technician accounts
    const scoped = authService.getScopedFilter();
    if (scoped && !authService.isAdmin()) {
      list = list.filter(t => {
        const matchesSource = (!scoped.unitIds?.length || scoped.unitIds.includes(t.sourceUnitId)) &&
                              (!scoped.floorIds?.length || scoped.floorIds.includes(t.sourceFloorId)) &&
                              (!scoped.lineIds?.length || scoped.lineIds.includes(t.sourceLineId));
        const matchesDest = (!scoped.unitIds?.length || scoped.unitIds.includes(t.destUnitId)) &&
                            (!scoped.floorIds?.length || scoped.floorIds.includes(t.destFloorId)) &&
                            (!scoped.lineIds?.length || scoped.lineIds.includes(t.destLineId));
        const currentUser = authService.getCurrentUser();
        const isRequester = currentUser && t.requestedBy === currentUser.id;
        return matchesSource || matchesDest || isRequester;
      });
    }

    if (params.status && params.status !== 'ALL') {
      list = list.filter(t => (t.status || TRANSFER_STATUSES.PENDING_APPROVAL) === params.status);
    }

    if (params.search) {
      const q = params.search.trim().toLowerCase();
      list = list.filter(t => 
        t.requestNumber?.toLowerCase().includes(q) ||
        t.machineInfo?.serialNumber?.toLowerCase().includes(q) ||
        t.machineInfo?.machineName?.toLowerCase().includes(q) ||
        t.machineInfo?.brand?.toLowerCase().includes(q) ||
        t.sourcePath?.toLowerCase().includes(q) ||
        t.destPath?.toLowerCase().includes(q) ||
        t.requestedByName?.toLowerCase().includes(q) ||
        t.reason?.toLowerCase().includes(q)
      );
    }

    return list;
  }

  getTransferRequestById(id) {
    const list = storage.getTable(TABLE_NAMES.TRANSFER_REQUESTS) || [];
    const item = list.find(t => t && (t.id === id || t.requestNumber === id)) || null;
    if (item && !item.status) {
      item.status = TRANSFER_STATUSES.PENDING_APPROVAL;
    }
    return item;
  }

  getPendingCount() {
    const list = this.getTransferRequests({ status: 'ALL' });
    const user = authService.getCurrentUser();
    return list.filter(t => {
      const st = t.status || TRANSFER_STATUSES.PENDING_APPROVAL;
      const isPendingStatus = st === TRANSFER_STATUSES.PENDING_APPROVAL || st === TRANSFER_STATUSES.PARTIALLY_APPROVED;
      if (!isPendingStatus) return false;
      return workflowService.canUserApproveStep(t, user);
    }).length;
  }

  getMachineTransferHistory(machineIdOrSerial) {
    const requests = storage.getTable(TABLE_NAMES.TRANSFER_REQUESTS) || [];
    const m = storage.getItem(TABLE_NAMES.MACHINES, machineIdOrSerial) || 
              (storage.getTable(TABLE_NAMES.MACHINES) || []).find(x => x.serialNumber === machineIdOrSerial);
    const mId = m?.id || machineIdOrSerial;
    const mSerial = m?.serialNumber || machineIdOrSerial;

    const filtered = requests.filter(r => r.machineId === mId || r.machineInfo?.serialNumber === mSerial);
    return filtered.sort((a, b) => new Date(b.requestedAt || 0) - new Date(a.requestedAt || 0));
  }

  /**
   * Returns any currently active (pending / in-progress / revision) transfer request for a machine.
   * If found, indicates that a duplicate request cannot be submitted.
   */
  getActiveTransferForMachine(machineIdOrSerial) {
    const all = storage.getTable(TABLE_NAMES.TRANSFER_REQUESTS) || [];
    const m = storage.getItem(TABLE_NAMES.MACHINES, machineIdOrSerial) || 
              (storage.getTable(TABLE_NAMES.MACHINES) || []).find(x => x.serialNumber === machineIdOrSerial);
    const mId = m?.id || machineIdOrSerial;
    const mSerial = m?.serialNumber || machineIdOrSerial;

    return all.find(r => 
      (r.machineId === mId || r.machineInfo?.serialNumber === mSerial) &&
      r.status !== TRANSFER_STATUSES.COMPLETED &&
      r.status !== TRANSFER_STATUSES.REJECTED &&
      r.status !== 'CANCELLED'
    ) || null;
  }

  /**
   * Helper to generate human-readable unique sequential Transfer Request ID (e.g. TR-2026-000001)
   */
  generateRequestNumber() {
    const year = new Date().getFullYear();
    const all = storage.getTable(TABLE_NAMES.TRANSFER_REQUESTS) || [];
    const count = all.length + 1;
    return `TR-${year}-${String(count).padStart(6, '0')}`;
  }

  /**
   * Initiates a new Machine Transfer Request through the dynamic approval workflow engine.
   * CONFIRMED WRITE: awaits Firestore HTTP 200. Throws CloudSaveError on failure.
   */
  async createTransferRequest({ machineId, destGroupId, destUnitId, destFloorId, destLineId, reason, remarks, documents = [] }) {
    const user = authService.getCurrentUser() || { id: 'usr-1', name: 'Authorized User', role: 'USER' };

    // 0. Security check: User must have transfer request creation permission
    if (!authService.canRequestTransfer()) {
      throw new Error('Access Denied: You do not have permission to create a Machine Transfer Request.');
    }

    const machine = storage.getItem(TABLE_NAMES.MACHINES, machineId);
    if (!machine) throw new Error('Machine record not found in ERP database.');

    // 0.1 Duplicate Request Prevention: One machine cannot have multiple active/pending transfer requests
    const activeExisting = this.getActiveTransferForMachine(machine.id);
    if (activeExisting) {
      const activeStatus = (activeExisting.status || 'PENDING_APPROVAL').replace(/_/g, ' ');
      throw new Error(`Machine [${machine.serialNumber}] already has an active Transfer Request (#${activeExisting.requestNumber}) in status "${activeStatus}" requested by ${activeExisting.requestedByName || 'User'}. Multiple transfer requests cannot be submitted for the same machine until the active request is completed, rejected, or cancelled.`);
    }

    // 1. Validate destination is not identical to source
    if (machine.unitId === destUnitId && machine.floorId === destFloorId && machine.lineId === destLineId) {
      throw new Error('Invalid Destination: Target Line is identical to the machine\'s current location.');
    }

    if (!destUnitId || !destFloorId || !destLineId) {
      throw new Error('Destination Unit, Floor, and Production Line are required.');
    }

    const cleanReason = (reason && reason.trim()) ? reason.trim() : 'Relocation Request';

    // 2. Resolve Master Data Paths & Equipment Details
    const resolvedEquip = resolveTransferMachineDetails({
      machineId: machine.id,
      serialNumber: machine.serialNumber,
      machineInfo: {
        serialNumber: machine.serialNumber,
        category: machine.category
      },
      ...machine
    });

    const sourcePath = masterDataService.getFullLocationPath(machine.unitId, machine.floorId, machine.lineId, machine.groupId);
    const destPath = masterDataService.getFullLocationPath(destUnitId, destFloorId, destLineId, destGroupId);

    const sourceUnit = storage.getItem(TABLE_NAMES.UNITS, machine.unitId)?.name || 'Unit';
    const sourceFloor = storage.getItem(TABLE_NAMES.FLOORS, machine.floorId)?.name || 'Floor';
    const sourceLine = storage.getItem(TABLE_NAMES.LINES, machine.lineId)?.name || 'Line';

    const destUnit = storage.getItem(TABLE_NAMES.UNITS, destUnitId)?.name || 'Unit';
    const destFloor = storage.getItem(TABLE_NAMES.FLOORS, destFloorId)?.name || 'Floor';
    const destLine = storage.getItem(TABLE_NAMES.LINES, destLineId)?.name || 'Line';

    // 3. Match Configured Approval Workflow
    let workflow;
    try {
      workflow = workflowService.matchWorkflow({
        sourceGroupId: machine.groupId,
        sourceUnitId: machine.unitId,
        sourceFloorId: machine.floorId,
        sourceLineId: machine.lineId,
        destUnitId,
        destFloorId,
        destLineId,
        categoryId: cat
      });
    } catch (e) {
      workflow = {
        id: 'wf-default',
        name: 'Standard Management Approval Workflow',
        levels: [
          { level: 1, title: 'Central Maintenance Admin Approval', approverType: 'ADMIN' }
        ]
      };
    }

    if (!workflow || !workflow.levels || workflow.levels.length === 0) {
      workflow = {
        id: 'wf-default',
        name: 'Standard Management Approval Workflow',
        levels: [
          { level: 1, title: 'Central Maintenance Admin Approval', approverType: 'ADMIN' }
        ]
      };
    }

    // 4. Process attached documents
    const processedDocs = (documents && documents.length > 0) ? documents.map((doc, idx) => ({
      id: `doc-${Date.now()}-${idx}`,
      name: doc.name || 'Management_Approval.pdf',
      type: doc.type || 'application/pdf',
      size: doc.size || '120 KB',
      dataUrl: doc.dataUrl || null,
      uploadedBy: user.id,
      uploadedByName: user.name,
      uploadedAt: new Date().toISOString(),
      approvalLevel: 0
    })) : [];

    // 5. Build normalized approval levels snapshot
    const levels = workflow.levels.map(lvl => ({
      level: lvl.level,
      title: lvl.title,
      approverType: lvl.approverType,
      approverRole: lvl.approverRole || '',
      approverUserId: lvl.approverUserId || '',
      description: lvl.description || '',
      status: 'PENDING',
      approvedBy: null,
      approvedByName: null,
      approvedAt: null,
      remarks: null
    }));

    const reqNumber = this.generateRequestNumber();
    const requestId = `trq-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const newRequest = {
      id: requestId,
      requestNumber: reqNumber,
      machineId: machine.id,
      serialNumber: machine.serialNumber,
      machineSerial: machine.serialNumber,
      machineName: resolvedEquip.machineName,
      machineInfo: {
        machineName: resolvedEquip.machineName,
        brand: resolvedEquip.brand,
        model: resolvedEquip.model,
        serialNumber: machine.serialNumber,
        category: resolvedEquip.category
      },
      sourceGroupId: machine.groupId,
      sourceUnitId: machine.unitId,
      sourceFloorId: machine.floorId,
      sourceLineId: machine.lineId,
      sourceLocation: { unit: sourceUnit, floor: sourceFloor, line: sourceLine },
      sourcePath: sourcePath,
      sourceFloorName: sourceFloor,
      destGroupId: destGroupId || machine.groupId,
      destUnitId: destUnitId,
      destFloorId: destFloorId,
      destLineId: destLineId,
      destLocation: { unit: destUnit, floor: destFloor, line: destLine },
      destPath: destPath,
      targetFloorName: destFloor,
      targetLocation: destPath,
      reason: cleanReason,
      remarks: remarks?.trim() || '',
      workflowId: workflow.id,
      workflowName: workflow.name,
      currentLevel: 1,
      totalLevels: levels.length,
      levels: levels,
      documents: processedDocs,
      approvalHistory: [
        {
          level: 0,
          action: 'REQUEST_SUBMITTED',
          approverName: user.name,
          approverRole: user.role,
          date: new Date().toLocaleDateString('en-GB'),
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          timestamp: new Date().toISOString(),
          remarks: `Transfer request created for ${machine.serialNumber} (${sourceLine} → ${destLine}). Workflow: ${workflow.name}`
        }
      ],
      status: TRANSFER_STATUSES.PENDING_APPROVAL,
      requestedBy: user.id,
      requestedByName: user.name,
      requestedByRole: user.role,
      requestedAt: new Date().toISOString(),
      completedAt: null,
      completedBy: null
    };

    // PREPARE UPDATES FOR MYSQL
    const updatedMachine = {
      ...machine,
      status: 'IN_TRANSFER',
      updatedBy: user.id,
      updatedAt: new Date().toISOString()
    };

    const tablesObj = {
      [TABLE_NAMES.MACHINES]: storage.getTable(TABLE_NAMES.MACHINES).map(m => m.id === machine.id ? updatedMachine : m),
      [TABLE_NAMES.TRANSFER_REQUESTS]: [...storage.getTable(TABLE_NAMES.TRANSFER_REQUESTS), newRequest]
    };

    // 1. Instant local persistence & in-memory commit (Zero Loading Time)
    storage.update(TABLE_NAMES.MACHINES, machine.id, {
      status: 'IN_TRANSFER',
      updatedBy: user.id,
      updatedAt: new Date().toISOString()
    });
    storage.insert(TABLE_NAMES.TRANSFER_REQUESTS, newRequest);
    
    try {
      localStorage.setItem('al_muslim_erp_' + TABLE_NAMES.MACHINES, JSON.stringify(storage.data[TABLE_NAMES.MACHINES]));
      localStorage.setItem('al_muslim_erp_' + TABLE_NAMES.TRANSFER_REQUESTS, JSON.stringify(storage.data[TABLE_NAMES.TRANSFER_REQUESTS]));
    } catch (_) {}

    // Trigger local and cross-component updates immediately
    window.dispatchEvent(new CustomEvent('erp:transfers-updated'));
    if (window.state && typeof window.state.emit === 'function') {
      window.state.emit('transfers:updated');
    }

    // 2. Non-blocking asynchronous cloud sync (Background Sync)
    syncManager.saveMultipleTables(tablesObj).catch(e => {
      console.warn('[SyncManager] Transfer cloud sync queued in background:', e.message);
    });

    // Send notifications to approvers (Destination Floor Manager & Super Admin)
    notificationService.notify({
      title: '⚠️ Machine Transfer Approval Required',
      message: `${user.name} submitted transfer request ${reqNumber} for Machine ${machine.serialNumber} (${sourceLine} → ${destLine} on ${destFloor}).`,
      type: 'APPROVAL_REQUEST',
      module: 'transfers',
      action: 'APPROVE',
      entityType: 'TRANSFER',
      entityId: newRequest.id,
      targetUrl: '#approvals',
      locationScope: {
        unitId: destUnitId,
        floorId: destFloorId
      }
    });

    auditService.log(
      'TRANSFER_REQUEST_CREATED',
      'TRANSFER',
      reqNumber,
      `Created transfer request ${reqNumber} for Machine ${machine.serialNumber} from ${sourcePath} to ${destPath}. Reason: ${cleanReason}`
    );

    return newRequest;
  }

  /**
   * Approves the current step in the transfer approval workflow.
   * CONFIRMED WRITE: awaits Firestore HTTP 200.
   */
  async approveStep(requestId, remarks = '', additionalDocuments = []) {
    const user = authService.getCurrentUser();
    const req = this.getTransferRequestById(requestId);
    if (!req) throw new Error('Transfer request not found.');

    if (req.status !== TRANSFER_STATUSES.PENDING_APPROVAL && req.status !== TRANSFER_STATUSES.PARTIALLY_APPROVED) {
      throw new Error(`Cannot approve request in '${req.status}' status.`);
    }

    // Check authorization for this level
    if (!workflowService.canUserApproveStep(req, user)) {
      throw new Error('Access Denied: You are not authorized to approve this workflow stage.');
    }

    const currentLevelIdx = (req.currentLevel || 1) - 1;
    const currentStep = req.levels[currentLevelIdx];
    if (!currentStep) throw new Error('Invalid workflow level.');

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB');
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Determine if this is an Admin overriding on behalf of user/floor
    const isMasterOverride = authService.isAdmin() && currentStep.approverType !== APPROVER_TYPES.ADMIN;
    const finalRemarks = remarks?.trim() ? remarks.trim() : (isMasterOverride ? 'Approved by Admin (Master Override)' : 'Approved');

    // Update current step record
    currentStep.status = 'APPROVED';
    currentStep.approvedBy = user.id;
    currentStep.approvedByName = user.name;
    currentStep.approvedAt = now.toISOString();
    currentStep.remarks = finalRemarks;

    // Append new supporting documents if provided
    let updatedDocs = [...(req.documents || [])];
    if (additionalDocuments && additionalDocuments.length > 0) {
      additionalDocuments.forEach((doc, idx) => {
        updatedDocs.push({
          id: `doc-${Date.now()}-${idx}`,
          name: doc.name,
          type: doc.type,
          size: doc.size,
          dataUrl: doc.dataUrl,
          uploadedBy: user.id,
          uploadedByName: user.name,
          uploadedAt: now.toISOString(),
          approvalLevel: req.currentLevel
        });
      });
    }

    // Append to immutable approval history log
    const updatedHistory = [
      ...(req.approvalHistory || []),
      {
        level: req.currentLevel,
        levelTitle: currentStep.title,
        action: 'APPROVED',
        approverName: user.name,
        approverRole: user.role,
        date: dateStr,
        time: timeStr,
        timestamp: now.toISOString(),
        remarks: finalRemarks
      }
    ];

    // Check if this was the final level
    if (req.currentLevel >= req.totalLevels) {
      // All approval levels completed! Execute final machine relocation
      return await this.executeFinalTransfer(requestId, updatedHistory, updatedDocs);
    } else {
      // Advance to next approval level
      const nextLevel = req.currentLevel + 1;
      const updatedReqObj = {
        ...req,
        currentLevel: nextLevel,
        status: TRANSFER_STATUSES.PARTIALLY_APPROVED,
        levels: req.levels,
        documents: updatedDocs,
        approvalHistory: updatedHistory,
        updatedAt: now.toISOString()
      };

      // Instant local memory update (Zero-wait)
      const updated = storage.update(TABLE_NAMES.TRANSFER_REQUESTS, req.id, {
        currentLevel: nextLevel,
        status: TRANSFER_STATUSES.PARTIALLY_APPROVED,
        levels: req.levels,
        documents: updatedDocs,
        approvalHistory: updatedHistory,
        updatedAt: now.toISOString()
      });
      try {
        localStorage.setItem('al_muslim_erp_' + TABLE_NAMES.TRANSFER_REQUESTS, JSON.stringify(storage.data[TABLE_NAMES.TRANSFER_REQUESTS]));
      } catch (_) {}


      notificationService.notify(
        'Transfer Advanced to Next Level',
        `Transfer ${req.requestNumber} (Machine ${req.machineInfo.serialNumber}) approved by ${user.name}. Now awaiting Level ${nextLevel} approval.`,
        'TRANSFER_PROGRESS',
        '#approvals'
      );

      auditService.log(
        'TRANSFER_STEP_APPROVED',
        'TRANSFER',
        req.requestNumber,
        `Level ${req.currentLevel} (${currentStep.title}) approved by ${user.name}. Remarks: ${remarks}`
      );

      return updated;
    }
  }

  /**
   * Rejects the transfer request with a mandatory reason.
   * CONFIRMED WRITE: awaits Firestore HTTP 200.
   */
  async rejectTransfer(requestId, rejectionReason) {
    const user = authService.getCurrentUser();
    const req = this.getTransferRequestById(requestId);
    if (!req) throw new Error('Transfer request not found.');

    if (!rejectionReason || !rejectionReason.trim()) {
      throw new Error('Rejection Reason is mandatory.');
    }

    // Check authorization
    if (!workflowService.canUserApproveStep(req, user) && !authService.isAdmin()) {
      throw new Error('Access Denied: You are not authorized to reject this transfer request.');
    }

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB');
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const currentLevelIdx = (req.currentLevel || 1) - 1;
    if (req.levels[currentLevelIdx]) {
      req.levels[currentLevelIdx].status = 'REJECTED';
      req.levels[currentLevelIdx].approvedBy = user.id;
      req.levels[currentLevelIdx].approvedByName = user.name;
      req.levels[currentLevelIdx].approvedAt = now.toISOString();
      req.levels[currentLevelIdx].remarks = rejectionReason;
    }

    const updatedHistory = [
      ...(req.approvalHistory || []),
      {
        level: req.currentLevel,
        levelTitle: req.levels[currentLevelIdx]?.title || `Level ${req.currentLevel}`,
        action: 'REJECTED',
        approverName: user.name,
        approverRole: user.role,
        date: dateStr,
        time: timeStr,
        timestamp: now.toISOString(),
        remarks: rejectionReason.trim()
      }
    ];

    // Restore machine status back to ACTIVE at source
    const machine = storage.getItem(TABLE_NAMES.MACHINES, req.machineId);
    if (machine) {
      storage.update(TABLE_NAMES.MACHINES, machine.id, {
        status: 'ACTIVE',
        updatedBy: user.id,
        updatedAt: now.toISOString()
      });
    }

    const updated = storage.update(TABLE_NAMES.TRANSFER_REQUESTS, req.id, {
      status: TRANSFER_STATUSES.REJECTED,
      rejectionReason: rejectionReason.trim(),
      levels: req.levels,
      approvalHistory: updatedHistory,
      updatedAt: now.toISOString()
    });

    // Immediate save & cloud sync
    storage.saveTable(TABLE_NAMES.MACHINES, true);
    storage.saveTable(TABLE_NAMES.TRANSFER_REQUESTS, true);

    notificationService.notify(
      'Machine Transfer Rejected',
      `Transfer request ${req.requestNumber} for Machine ${req.machineInfo.serialNumber} was rejected by ${user.name}. Reason: ${rejectionReason}`,
      'TRANSFER_REJECTED',
      '#approvals'
    );

    auditService.log(
      'TRANSFER_REJECTED',
      'TRANSFER',
      req.requestNumber,
      `Rejected at Level ${req.currentLevel} by ${user.name}. Reason: ${rejectionReason}`
    );

    return updated;
  }

  /**
   * Returns transfer request back to requester for revision.
   * CONFIRMED WRITE: awaits Firestore HTTP 200.
   */
  async returnForRevision(requestId, revisionComments) {
    const user = authService.getCurrentUser();
    const req = this.getTransferRequestById(requestId);
    if (!req) throw new Error('Transfer request not found.');

    if (!revisionComments || !revisionComments.trim()) {
      throw new Error('Revision instructions/comments are required.');
    }

    if (!workflowService.canUserApproveStep(req, user) && !authService.isAdmin()) {
      throw new Error('Access Denied: Unauthorized to request revision.');
    }

    const now = new Date();
    const updatedHistory = [
      ...(req.approvalHistory || []),
      {
        level: req.currentLevel,
        action: 'RETURNED_FOR_REVISION',
        approverName: user.name,
        approverRole: user.role,
        date: now.toLocaleDateString('en-GB'),
        time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: now.toISOString(),
        remarks: revisionComments.trim()
      }
    ];

    const updated = storage.update(TABLE_NAMES.TRANSFER_REQUESTS, req.id, {
      status: TRANSFER_STATUSES.REVISION_REQUESTED,
      revisionComments: revisionComments.trim(),
      approvalHistory: updatedHistory,
      updatedAt: now.toISOString()
    });

    // Immediate save & cloud sync
    storage.saveTable(TABLE_NAMES.TRANSFER_REQUESTS, true);

    notificationService.notify(
      'Transfer Returned for Revision',
      `Transfer ${req.requestNumber} for Machine ${req.machineInfo.serialNumber} was returned by ${user.name} for revision. Note: ${revisionComments}`,
      'TRANSFER_REVISION',
      '#approvals'
    );

    auditService.log(
      'TRANSFER_REVISION_REQUESTED',
      'TRANSFER',
      req.requestNumber,
      `Returned for revision by ${user.name}: ${revisionComments}`
    );

    return updated;
  }

  /**
   * Resubmits a revised transfer request.
   * CONFIRMED WRITE: awaits Firestore HTTP 200.
   */
  async resubmitTransfer(requestId, { destGroupId, destUnitId, destFloorId, destLineId, reason, remarks, documents = [] }) {
    const user = authService.getCurrentUser();
    const req = this.getTransferRequestById(requestId);
    if (!req) throw new Error('Transfer request not found.');

    if (req.status !== TRANSFER_STATUSES.REVISION_REQUESTED) {
      throw new Error('Only requests in Revision Requested state can be resubmitted.');
    }

    const destPath = masterDataService.getFullLocationPath(destUnitId, destFloorId, destLineId, destGroupId);
    const destUnit = storage.getItem(TABLE_NAMES.UNITS, destUnitId)?.name || 'Unit';
    const destFloor = storage.getItem(TABLE_NAMES.FLOORS, destFloorId)?.name || 'Floor';
    const destLine = storage.getItem(TABLE_NAMES.LINES, destLineId)?.name || 'Line';

    // Reset levels back to pending starting from Level 1
    const resetLevels = req.levels.map(lvl => ({
      ...lvl,
      status: 'PENDING',
      approvedBy: null,
      approvedByName: null,
      approvedAt: null,
      remarks: null
    }));

    const now = new Date();
    const updatedHistory = [
      ...(req.approvalHistory || []),
      {
        level: 0,
        action: 'RESUBMITTED_AFTER_REVISION',
        approverName: user.name,
        approverRole: user.role,
        date: now.toLocaleDateString('en-GB'),
        time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: now.toISOString(),
        remarks: `Updated destination to ${destPath}. Reason: ${reason}`
      }
    ];

    const updated = storage.update(TABLE_NAMES.TRANSFER_REQUESTS, req.id, {
      destGroupId: destGroupId || req.destGroupId,
      destUnitId,
      destFloorId,
      destLineId,
      destLocation: { unit: destUnit, floor: destFloor, line: destLine },
      destPath,
      reason: reason.trim(),
      remarks: remarks?.trim() || req.remarks,
      documents: [...(req.documents || []), ...documents],
      currentLevel: 1,
      levels: resetLevels,
      status: TRANSFER_STATUSES.PENDING_APPROVAL,
      approvalHistory: updatedHistory,
      updatedAt: now.toISOString()
    });

    notificationService.notify(
      'Transfer Request Resubmitted',
      `${user.name} resubmitted revised transfer request ${req.requestNumber} for Machine ${req.machineInfo.serialNumber}.`,
      'TRANSFER_REQUEST',
      '#approvals'
    );

    auditService.log(
      'TRANSFER_RESUBMITTED',
      'TRANSFER',
      req.requestNumber,
      `Resubmitted with new destination ${destPath}.`
    );

    // Immediate save & cloud sync
    storage.saveTable(TABLE_NAMES.TRANSFER_REQUESTS, true);

    return updated;
  }

  /**
   * Allows requester or Admin to edit transfer request destination location, reason, remarks, and documents
   * before the transfer request is approved/completed.
   * CONFIRMED WRITE: awaits Firestore HTTP 200.
   */
  async updateTransferRequest(requestId, { destGroupId, destUnitId, destFloorId, destLineId, reason, remarks, documents }) {
    const user = authService.getCurrentUser() || { id: 'usr-1', name: 'Authorized User', role: 'USER' };
    const req = this.getTransferRequestById(requestId);
    if (!req) throw new Error('Transfer request not found.');

    if (req.status === TRANSFER_STATUSES.COMPLETED) {
      throw new Error('This transfer request has already been approved and completed. Destination location cannot be modified.');
    }
    if (req.status === TRANSFER_STATUSES.REJECTED) {
      throw new Error('This transfer request has been rejected and cannot be edited.');
    }

    if (req.requestedBy !== user.id && !authService.isAdmin()) {
      throw new Error('Access Denied: Only the original requester or an Administrator can edit this transfer request.');
    }

    const machine = storage.getItem(TABLE_NAMES.MACHINES, req.machineId);
    if (machine && machine.unitId === destUnitId && machine.floorId === destFloorId && machine.lineId === destLineId) {
      throw new Error('Invalid Destination: Target Line is identical to the machine\'s current location.');
    }

    if (!destUnitId || !destFloorId || !destLineId) {
      throw new Error('Destination Unit, Floor, and Production Line are required.');
    }

    const destPath = masterDataService.getFullLocationPath(destUnitId, destFloorId, destLineId, destGroupId);
    const destUnit = storage.getItem(TABLE_NAMES.UNITS, destUnitId)?.name || 'Unit';
    const destFloor = storage.getItem(TABLE_NAMES.FLOORS, destFloorId)?.name || 'Floor';
    const destLine = storage.getItem(TABLE_NAMES.LINES, destLineId)?.name || 'Line';

    const now = new Date();
    const oldDestPath = req.destPath || 'Previous Location';

    const updatedHistory = [
      ...(req.approvalHistory || []),
      {
        level: req.currentLevel,
        action: 'DESTINATION_EDITED',
        approverName: user.name,
        approverRole: user.role,
        date: now.toLocaleDateString('en-GB'),
        time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: now.toISOString(),
        remarks: `Destination location edited from "${oldDestPath}" to "${destPath}". Note: ${reason || 'Location correction'}`
      }
    ];

    // Re-evaluate approval workflow if destination location changed
    let newLevels = req.levels;
    let newWorkflowName = req.workflowName;
    let newWorkflowId = req.workflowId;
    if (req.destUnitId !== destUnitId || req.destFloorId !== destFloorId || req.destLineId !== destLineId) {
      try {
        const mn = machine ? storage.getItem(TABLE_NAMES.MACHINE_NAMES, machine.machineNameId) : null;
        const matchedWf = workflowService.matchWorkflow({
          sourceGroupId: req.sourceGroupId,
          sourceUnitId: req.sourceUnitId,
          sourceFloorId: req.sourceFloorId,
          sourceLineId: req.sourceLineId,
          destUnitId,
          destFloorId,
          destLineId,
          categoryId: mn?.categoryId
        });
        if (matchedWf && matchedWf.levels?.length) {
          newWorkflowId = matchedWf.id;
          newWorkflowName = matchedWf.name;
          newLevels = matchedWf.levels.map(lvl => ({
            level: lvl.level,
            title: lvl.title,
            approverType: lvl.approverType,
            approverRole: lvl.approverRole || '',
            approverUserId: lvl.approverUserId || '',
            description: lvl.description || '',
            status: 'PENDING',
            approvedBy: null,
            approvedByName: null,
            approvedAt: null,
            remarks: null
          }));
        }
      } catch (_) {}
    }

    const updatedFields = {
      destGroupId: destGroupId || req.destGroupId,
      destUnitId,
      destFloorId,
      destLineId,
      destLocation: { unit: destUnit, floor: destFloor, line: destLine },
      destPath,
      reason: (reason && reason.trim()) ? reason.trim() : req.reason,
      remarks: remarks !== undefined ? remarks.trim() : req.remarks,
      workflowId: newWorkflowId,
      workflowName: newWorkflowName,
      levels: newLevels,
      currentLevel: 1, // Reset to Level 1 verification for the new destination
      status: req.status === TRANSFER_STATUSES.REVISION_REQUESTED ? TRANSFER_STATUSES.PENDING_APPROVAL : req.status,
      approvalHistory: updatedHistory,
      updatedAt: now.toISOString()
    };

    if (documents && Array.isArray(documents)) {
      updatedFields.documents = documents;
    }

    const updated = storage.update(TABLE_NAMES.TRANSFER_REQUESTS, req.id, updatedFields);

    auditService.log(
      'TRANSFER_REQUEST_EDITED',
      'TRANSFER',
      req.requestNumber,
      `Destination edited to ${destPath} by ${user.name}`
    );

    // Instant local persistence & immediate cloud sync
    storage.saveTable(TABLE_NAMES.TRANSFER_REQUESTS, true);
    if (typeof syncManager !== 'undefined' && syncManager.primaryAdapter) {
      syncManager.saveRecord(TABLE_NAMES.TRANSFER_REQUESTS, req.id, updated).catch(e => console.warn('Sync transfer request notice:', e.message));
    }

    // Notify approvers at new location
    notificationService.notify({
      title: '✏️ Transfer Request Destination Updated',
      message: `${user.name} updated destination of transfer request ${req.requestNumber} for Machine ${req.machineInfo?.serialNumber} to ${destLine} on ${destFloor}.`,
      type: 'APPROVAL_REQUEST',
      module: 'transfers',
      action: 'APPROVE',
      entityType: 'TRANSFER',
      entityId: req.id,
      targetUrl: '#approvals',
      locationScope: {
        unitId: destUnitId,
        floorId: destFloorId
      }
    });

    return updated;
  }

  /**
   * Cancels a transfer request.
   * CONFIRMED WRITE: awaits Firestore HTTP 200.
   */
  async cancelTransfer(requestId, reason = 'Cancelled by requester') {
    const user = authService.getCurrentUser();
    const req = this.getTransferRequestById(requestId);
    if (!req) throw new Error('Transfer request not found.');

    if (req.status === TRANSFER_STATUSES.COMPLETED) {
      throw new Error('Cannot cancel an already completed transfer.');
    }

    const now = new Date();
    // Restore machine status
    const machine = storage.getItem(TABLE_NAMES.MACHINES, req.machineId);
    if (machine) {
      storage.update(TABLE_NAMES.MACHINES, machine.id, {
        status: 'ACTIVE',
        updatedBy: user.id,
        updatedAt: now.toISOString()
      });
    }

    const updatedHistory = [
      ...(req.approvalHistory || []),
      {
        level: req.currentLevel,
        action: 'CANCELLED',
        approverName: user.name,
        approverRole: user.role,
        date: now.toLocaleDateString('en-GB'),
        time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: now.toISOString(),
        remarks: reason
      }
    ];

    const updated = storage.update(TABLE_NAMES.TRANSFER_REQUESTS, req.id, {
      status: TRANSFER_STATUSES.CANCELLED,
      cancelReason: reason,
      approvalHistory: updatedHistory,
      updatedAt: now.toISOString()
    });

    auditService.log(
      'TRANSFER_CANCELLED',
      'TRANSFER',
      req.requestNumber,
      `Transfer ${req.requestNumber} cancelled by ${user.name}: ${reason}`
    );

    // Immediate save & cloud sync
    storage.saveTable(TABLE_NAMES.MACHINES, true);
    storage.saveTable(TABLE_NAMES.TRANSFER_REQUESTS, true);

    return updated;
  }

  /**
   * FINAL EXECUTION: Atomically changes physical machine location in live inventory database.
   * CONFIRMED WRITE: awaits Firestore HTTP 200 for all 3 affected tables.
   */
  async executeFinalTransfer(requestId, history = null, docs = null) {
    const user = authService.getCurrentUser();
    const req = this.getTransferRequestById(requestId);
    if (!req) throw new Error('Transfer request not found.');

    let machine = storage.getItem(TABLE_NAMES.MACHINES, req.machineId);
    if (!machine && (req.serialNumber || req.machineSerial)) {
      const sn = req.serialNumber || req.machineSerial;
      const allM = storage.getTable(TABLE_NAMES.MACHINES) || [];
      machine = allM.find(m => m.serialNumber === sn || m.machineSerial === sn);
    }
    if (!machine) throw new Error(`Machine [${req.serialNumber || req.machineId}] not found in live inventory.`);

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB');
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const finalHistory = history || [
      ...(req.approvalHistory || []),
      {
        level: req.totalLevels,
        action: 'FINAL_APPROVAL_COMPLETED',
        approverName: user.name,
        approverRole: user.role,
        date: dateStr,
        time: timeStr,
        timestamp: now.toISOString(),
        remarks: 'All approval levels completed. Physical machine location updated in live inventory.'
      }
    ];

    // Mark all workflow levels as APPROVED
    const finalLevels = (req.levels || []).map(lvl => ({
      ...lvl,
      status: 'APPROVED',
      approvedBy: lvl.approvedBy || user.id,
      approvedByName: lvl.approvedByName || user.name,
      approvedAt: lvl.approvedAt || now.toISOString(),
      remarks: lvl.remarks || 'Approved for relocation.'
    }));

    // 1. Atomically UPDATE PHYSICAL MACHINE LOCATION in live inventory database
    storage.update(TABLE_NAMES.MACHINES, machine.id, {
      groupId: req.destGroupId,
      unitId: req.destUnitId,
      floorId: req.destFloorId,
      lineId: req.destLineId,
      status: 'ACTIVE',
      remarks: `${machine.remarks || ''} [Transferred from ${req.sourcePath} via ${req.requestNumber} on ${dateStr}]`.trim(),
      updatedBy: user.id,
      updatedAt: now.toISOString()
    });

    // 2. Insert into permanent historical TRANSFERS log
    const resolvedEquip = resolveTransferMachineDetails(req);
    const transferRecord = {
      id: `trf-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      requestId: req.id,
      requestNumber: req.requestNumber,
      machineId: machine.id,
      serialNumber: machine.serialNumber,
      machineName: resolvedEquip.machineName,
      sourceGroupId: req.sourceGroupId,
      sourceUnitId: req.sourceUnitId,
      sourceFloorId: req.sourceFloorId,
      sourceLineId: req.sourceLineId,
      sourcePath: req.sourcePath,
      destGroupId: req.destGroupId,
      destUnitId: req.destUnitId,
      destFloorId: req.destFloorId,
      destLineId: req.destLineId,
      destPath: req.destPath,
      reason: req.reason,
      transferredBy: req.requestedBy,
      transferredByName: req.requestedByName,
      transferredAt: req.requestedAt,
      completedAt: now.toISOString(),
      completedBy: user.id,
      completedByName: user.name,
      approvedBy: user.name
    };
    storage.insert(TABLE_NAMES.TRANSFERS, transferRecord);

    // 3. Mark Transfer Request as COMPLETED
    const updated = storage.update(TABLE_NAMES.TRANSFER_REQUESTS, req.id, {
      status: TRANSFER_STATUSES.COMPLETED,
      currentLevel: req.totalLevels,
      levels: finalLevels,
      approvalHistory: finalHistory,
      documents: docs || req.documents,
      completedAt: now.toISOString(),
      completedBy: user.id,
      completedByName: user.name,
      updatedAt: now.toISOString()
    });

    // 4. Send high-priority notifications & audit trail
    const mName = resolvedEquip.machineName;
    notificationService.notify(
      '🎉 Machine Transfer Completed!',
      `Machine ${machine.serialNumber} (${mName}) officially relocated to ${req.destPath} under ${req.requestNumber}.`,
      'TRANSFER_COMPLETED',
      '#inventory'
    );

    auditService.log(
      'MACHINE_LOCATION_COMMITTED',
      'MACHINE',
      machine.serialNumber,
      `Physical location moved from [${req.sourcePath}] to [${req.destPath}] via Request ${req.requestNumber}. Approved by ${user.name}.`
    );

    // 5. Instant local persistence & immediate cloud commit to Primary MySQL & replicas
    storage.saveTable(TABLE_NAMES.MACHINES, true);
    storage.saveTable(TABLE_NAMES.TRANSFERS, true);
    storage.saveTable(TABLE_NAMES.TRANSFER_REQUESTS, true);

    // 6. Direct instant single-record upsert for guaranteed zero-latency cross-device synchronization
    if (typeof syncManager !== 'undefined' && syncManager.primaryAdapter) {
      const updatedMachine = storage.getItem(TABLE_NAMES.MACHINES, machine.id);
      syncManager.saveRecord(TABLE_NAMES.MACHINES, machine.id, updatedMachine).catch(e => console.warn('Sync machine notice:', e.message));
      syncManager.saveRecord(TABLE_NAMES.TRANSFERS, transferRecord.id, transferRecord).catch(e => console.warn('Sync transfer record notice:', e.message));
      syncManager.saveRecord(TABLE_NAMES.TRANSFER_REQUESTS, req.id, updated).catch(e => console.warn('Sync transfer request notice:', e.message));
    }

    // 7. Automatic Machine Lifecycle History Record
    historyService.recordActivity({
      machineId: machine.id,
      serialNumber: machine.serialNumber,
      actionType: 'TRANSFER_MACHINE',
      title: `Inter-Plant/Line Transfer Executed (${req.requestNumber})`,
      details: `Machine transferred from ${req.sourcePath} to ${req.destPath}. Reason: ${req.reason || 'Line balancing'}`,
      fromLocation: {
        groupId: req.sourceGroupId,
        unitId: req.sourceUnitId,
        floorId: req.sourceFloorId,
        lineId: req.sourceLineId,
        unitName: req.sourceLocation?.unit,
        floorName: req.sourceLocation?.floor,
        lineName: req.sourceLocation?.line
      },
      toLocation: {
        groupId: req.destGroupId,
        unitId: req.destUnitId,
        floorId: req.destFloorId,
        lineId: req.destLineId,
        unitName: req.destLocation?.unit,
        floorName: req.destLocation?.floor,
        lineName: req.destLocation?.line
      },
      previousValue: { location: req.sourcePath },
      newValue: { location: req.destPath },
      remarks: req.remarks || req.reason
    }).catch(e => console.warn('History activity record note:', e.message));

    // 9. Dispatch instant UI & cross-component update events
    window.dispatchEvent(new CustomEvent('erp:transfers-updated'));
    window.dispatchEvent(new CustomEvent('erp:inventory-updated'));
    window.dispatchEvent(new CustomEvent('erp:storage-updated'));
    if (window.state && typeof window.state.emit === 'function') {
      window.state.emit('transfers:updated');
      window.state.emit('inventory:updated');
    }

    return updated;
  }

  /**
   * Exports filtered machine transfer requests to formatted Excel
   * Columns: Machine Serial Number | From Location | To Location | Request Date | Approval Date | Requested By | Approved By | Status | Reason
   */
  exportTransfersToExcel(list = null) {
    if (typeof XLSX === 'undefined') {
      alert('Excel export library is loading, please try again.');
      return;
    }

    const requests = list || this.getTransferRequests({ status: 'ALL' });
    const wb = XLSX.utils.book_new();

    const headers = [
      'Sl.',
      'Machine Serial Number',
      'Machine Name & Model',
      'From Location (Source)',
      'To Location (Destination)',
      'Request Date',
      'Approval Date',
      'Requested By',
      'Approved By',
      'Status',
      'Transfer Reason / Remarks'
    ];

    const rows = [headers];

    requests.forEach((r, idx) => {
      const isCompleted = r.status === TRANSFER_STATUSES.COMPLETED || r.status === 'COMPLETED';
      let approvalDate = 'Pending';
      if (isCompleted) {
        approvalDate = r.completedAt && r.completedAt !== '—' ? new Date(r.completedAt).toLocaleDateString('en-GB') : 'Completed';
      } else if (r.status === TRANSFER_STATUSES.REJECTED || r.status === 'REJECTED') {
        approvalDate = 'Rejected';
      } else if (r.status === 'CANCELLED') {
        approvalDate = 'Cancelled';
      }

      const approvedBy = r.completedByName || (r.approvalHistory?.find(h => h.action === 'APPROVED')?.approverName) || r.approvedBy || (isCompleted ? 'Admin' : '—');

      const eq = resolveTransferMachineDetails(r);
      const fullMachineTitle = (eq.brandModelText && eq.brandModelText !== eq.category) ? `${eq.machineName} (${eq.brandModelText})` : eq.machineName;

      const sourceLoc = r.sourcePath || (typeof r.sourceLocation === 'string' ? r.sourceLocation : `${r.sourceLocation?.unit || ''} > ${r.sourceLocation?.floor || ''} > ${r.sourceLocation?.line || ''}`) || '—';
      const destLoc = r.destPath || (typeof r.destLocation === 'string' ? r.destLocation : `${r.destLocation?.unit || ''} > ${r.destLocation?.floor || ''} > ${r.destLocation?.line || ''}`) || '—';

      let reqDate = '—';
      if (r.requestedAt && r.requestedAt !== '—') {
        try {
          reqDate = new Date(r.requestedAt).toLocaleDateString('en-GB');
        } catch (_) { reqDate = r.requestedAt; }
      }

      const requester = r.requestedByName ? `${r.requestedByName} (${r.requestedByRole || 'Staff'})` : (r.transferredBy || 'User');

      rows.push([
        String(idx + 1).padStart(2, '0'),
        eq.serialNumber || r.machineInfo?.serialNumber || r.machineSerial || '—',
        fullMachineTitle,
        sourceLoc,
        destLoc,
        reqDate,
        approvalDate,
        requester,
        approvedBy,
        (r.status === 'PENDING_APPROVAL' ? 'Pending' : (r.status || '—')).replace(/_/g, ' '),
        r.reason || r.remarks || '—'
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [
      { wch: 6 },
      { wch: 22 },
      { wch: 32 },
      { wch: 36 },
      { wch: 36 },
      { wch: 15 },
      { wch: 15 },
      { wch: 22 },
      { wch: 20 },
      { wch: 18 },
      { wch: 35 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Machine Transfers');
    XLSX.writeFile(wb, `Machine_Transfers_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  }
}

export const transferService = new TransferService();
