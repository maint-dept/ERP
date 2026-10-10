/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Multi-Stage Approval Workflow & Visual Diff Engine
 */

import { storage } from '../db/storage.js';
import { CloudSaveError } from '../db/storage.js';
import { TABLE_NAMES, APPROVAL_STATUSES } from '../db/schema.js';
import { authService } from './authService.js';
import { auditService } from './auditService.js';
import { notificationService } from './notificationService.js';

class ApprovalService {
  getRequests(status = null) {
    let list = storage.getTable(TABLE_NAMES.APPROVAL_REQUESTS) || [];
    list = [...list].sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));

    if (status && status !== 'ALL') {
      list = list.filter(r => r.status === status);
    }

    return list;
  }

  getPendingCount() {
    return this.getRequests(APPROVAL_STATUSES.PENDING).length;
  }

  calculateDiffs(existing, updates) {
    const diffs = [];
    const fieldLabels = {
      machineNameId: 'Machine Name',
      brandId: 'Machine Brand',
      modelId: 'Machine Model',
      serialNumber: 'Serial Number',
      unitId: 'Unit/Factory',
      floorId: 'Floor',
      lineId: 'Production Line',
      quantity: 'Quantity',
      status: 'Machine Status',
      remarks: 'Remarks'
    };

    // Standard fields
    for (const key of Object.keys(fieldLabels)) {
      if (updates[key] !== undefined && updates[key] !== existing[key]) {
        let oldVal = existing[key];
        let newVal = updates[key];

        // Resolve names for master data IDs
        if (key === 'machineNameId') {
          oldVal = storage.getItem(TABLE_NAMES.MACHINE_NAMES, oldVal)?.name || oldVal;
          newVal = storage.getItem(TABLE_NAMES.MACHINE_NAMES, newVal)?.name || newVal;
        } else if (key === 'brandId') {
          oldVal = storage.getItem(TABLE_NAMES.BRANDS, oldVal)?.name || oldVal;
          newVal = storage.getItem(TABLE_NAMES.BRANDS, newVal)?.name || newVal;
        } else if (key === 'modelId') {
          oldVal = storage.getItem(TABLE_NAMES.MODELS, oldVal)?.name || oldVal;
          newVal = storage.getItem(TABLE_NAMES.MODELS, newVal)?.name || newVal;
        } else if (key === 'unitId') {
          oldVal = storage.getItem(TABLE_NAMES.UNITS, oldVal)?.name || oldVal;
          newVal = storage.getItem(TABLE_NAMES.UNITS, newVal)?.name || newVal;
        } else if (key === 'floorId') {
          oldVal = storage.getItem(TABLE_NAMES.FLOORS, oldVal)?.name || oldVal;
          newVal = storage.getItem(TABLE_NAMES.FLOORS, newVal)?.name || newVal;
        } else if (key === 'lineId') {
          oldVal = storage.getItem(TABLE_NAMES.LINES, oldVal)?.name || oldVal;
          newVal = storage.getItem(TABLE_NAMES.LINES, newVal)?.name || newVal;
        }

        diffs.push({
          field: key,
          label: fieldLabels[key],
          oldValue: oldVal ?? '—',
          newValue: newVal ?? '—'
        });
      }
    }

    // Dynamic custom fields
    if (updates.customValues) {
      const allCustom = storage.getTable(TABLE_NAMES.CUSTOM_FIELDS) || [];
      const oldCustom = existing.customValues || {};
      const newCustom = updates.customValues || {};

      allCustom.forEach(cf => {
        const oV = oldCustom[cf.code];
        const nV = newCustom[cf.code];
        if (nV !== undefined && nV !== oV) {
          diffs.push({
            field: `customValues.${cf.code}`,
            label: cf.label,
            oldValue: oV ?? '—',
            newValue: nV ?? '—'
          });
        }
      });
    }

    return diffs;
  }

  createRequest({ machineId, type, remarks, proposedUpdates, diffs }) {
    const user = authService.getCurrentUser();
    const machine = storage.getItem(TABLE_NAMES.MACHINES, machineId);
    const mn = machine ? storage.getItem(TABLE_NAMES.MACHINE_NAMES, machine.machineNameId)?.name : 'Machine';
    const brd = machine ? storage.getItem(TABLE_NAMES.BRANDS, machine.brandId)?.name : '';
    const mdl = machine ? storage.getItem(TABLE_NAMES.MODELS, machine.modelId)?.name : '';
    const unt = machine ? storage.getItem(TABLE_NAMES.UNITS, machine.unitId)?.name : '';
    const flr = machine ? storage.getItem(TABLE_NAMES.FLOORS, machine.floorId)?.name : '';
    const lin = machine ? storage.getItem(TABLE_NAMES.LINES, machine.lineId)?.name : '';

    const req = {
      id: `appr-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      machineId,
      type: type || 'EDIT_MACHINE',
      requestedBy: user.id,
      requestedByName: user.name,
      requestedByRole: user.role,
      requestedAt: new Date().toISOString(),
      status: APPROVAL_STATUSES.PENDING,
      remarks: remarks || '',
      proposedUpdates: proposedUpdates || {},
      targetLocation: {
        unit: unt,
        floor: flr,
        line: lin
      },
      machineInfo: {
        machineName: mn,
        brand: brd,
        model: mdl,
        serialNumber: machine?.serialNumber || 'N/A'
      },
      diffs: diffs || []
    };

    storage.insert(TABLE_NAMES.APPROVAL_REQUESTS, req);
    return req;
  }

  async approveRequest(requestId, adminRemarks = '') {
    if (!authService.isAdmin() && !authService.hasPermission('APPROVE')) {
      throw new Error('Unauthorized to approve workflow requests.');
    }

    const req = storage.getItem(TABLE_NAMES.APPROVAL_REQUESTS, requestId);
    if (!req || req.status !== APPROVAL_STATUSES.PENDING) {
      throw new Error('Request not found or not in pending state.');
    }

    const user = authService.getCurrentUser();
    const machine = storage.getItem(TABLE_NAMES.MACHINES, req.machineId);

    if (req.type === 'NEW_MACHINE' && machine) {
      storage.update(TABLE_NAMES.MACHINES, machine.id, {
        status: 'ACTIVE',
        updatedBy: user.id
      });
    } else if (req.type === 'ARCHIVE_MACHINE' && machine) {
      storage.update(TABLE_NAMES.MACHINES, machine.id, {
        status: 'ARCHIVED',
        remarks: `${machine.remarks || ''} [Approved Decommission on ${new Date().toLocaleDateString()}]`.trim(),
        updatedBy: user.id
      });
    } else if (req.proposedUpdates && machine) {
      storage.update(TABLE_NAMES.MACHINES, machine.id, {
        ...req.proposedUpdates,
        updatedBy: user.id
      });
    }

    const updated = storage.update(TABLE_NAMES.APPROVAL_REQUESTS, requestId, {
      status: APPROVAL_STATUSES.APPROVED,
      reviewedBy: user.id,
      reviewedByName: user.name,
      reviewedAt: new Date().toISOString(),
      adminRemarks: adminRemarks
    });

    // Confirmed cloud writes
    const [approvalOk, machinesOk] = await Promise.all([
      storage.saveTable(TABLE_NAMES.APPROVAL_REQUESTS, true),
      machine ? storage.saveTable(TABLE_NAMES.MACHINES, true) : Promise.resolve(true)
    ]);
    if (!approvalOk || !machinesOk) throw new CloudSaveError('❌ Cloud Save Failed: Approval could not be confirmed by the cloud.');

    const machine = storage.getItem(TABLE_NAMES.MACHINES, req.machineId);
    notificationService.notify({
      title: 'Approval Request Approved',
      message: `Changes for Machine ${req.machineInfo?.serialNumber || machine?.serialNumber || ''} have been officially approved by ${user.name}.`,
      type: 'APPROVAL_RESULT',
      module: 'machines',
      action: 'VIEW',
      entityType: 'MACHINE',
      entityId: req.machineId,
      targetUserId: req.requestedBy || null,
      targetUrl: '#inventory',
      locationScope: machine ? {
        unitId: machine.unitId || null,
        floorId: machine.floorId || null,
        lineId: machine.lineId || null
      } : null
    });

    auditService.log('APPROVAL_APPROVED', 'APPROVAL_REQUEST', requestId, `Approved edit request for Machine ${req.machineInfo.serialNumber}`);
    return updated;
  }

  async rejectRequest(requestId, adminRemarks = '') {
    if (!authService.isAdmin() && !authService.hasPermission('APPROVE')) {
      throw new Error('Unauthorized to reject workflow requests.');
    }

    const req = storage.getItem(TABLE_NAMES.APPROVAL_REQUESTS, requestId);
    if (!req) throw new Error('Request not found.');

    const user = authService.getCurrentUser();
    const machine = storage.getItem(TABLE_NAMES.MACHINES, req.machineId);

    // If new machine was rejected, remove or mark inactive
    if (req.type === 'NEW_MACHINE' && machine) {
      storage.update(TABLE_NAMES.MACHINES, machine.id, {
        status: 'INACTIVE',
        remarks: `${machine.remarks || ''} [Registration Rejected by ${user.name}: ${adminRemarks}]`.trim()
      });
    }

    const updated = storage.update(TABLE_NAMES.APPROVAL_REQUESTS, requestId, {
      status: APPROVAL_STATUSES.REJECTED,
      reviewedBy: user.id,
      reviewedByName: user.name,
      reviewedAt: new Date().toISOString(),
      adminRemarks: adminRemarks
    });

    // Confirmed cloud writes
    const [approvalOk, machinesOk] = await Promise.all([
      storage.saveTable(TABLE_NAMES.APPROVAL_REQUESTS, true),
      machine ? storage.saveTable(TABLE_NAMES.MACHINES, true) : Promise.resolve(true)
    ]);
    if (!approvalOk || !machinesOk) throw new CloudSaveError('❌ Cloud Save Failed: Rejection could not be confirmed by the cloud.');

    notificationService.notify({
      title: 'Approval Request Rejected',
      message: `Request for Machine ${req.machineInfo?.serialNumber || machine?.serialNumber || ''} was rejected by ${user.name}. Reason: ${adminRemarks || 'None given'}`,
      type: 'APPROVAL_RESULT',
      module: 'machines',
      action: 'VIEW',
      entityType: 'MACHINE',
      entityId: req.machineId,
      targetUserId: req.requestedBy || null,
      targetUrl: '#inventory',
      locationScope: machine ? {
        unitId: machine.unitId || null,
        floorId: machine.floorId || null,
        lineId: machine.lineId || null
      } : null
    });

    auditService.log('APPROVAL_REJECTED', 'APPROVAL_REQUEST', requestId, `Rejected edit request for Machine ${req.machineInfo.serialNumber}: ${adminRemarks}`);
    return updated;
  }

  async requestRevision(requestId, adminRemarks = '') {
    if (!authService.isAdmin() && !authService.hasPermission('APPROVE')) {
      throw new Error('Unauthorized to request revision.');
    }

    const req = storage.getItem(TABLE_NAMES.APPROVAL_REQUESTS, requestId);
    if (!req) throw new Error('Request not found.');

    const user = authService.getCurrentUser();
    const updated = storage.update(TABLE_NAMES.APPROVAL_REQUESTS, requestId, {
      status: APPROVAL_STATUSES.REVISION_REQUESTED,
      reviewedBy: user.id,
      reviewedByName: user.name,
      reviewedAt: new Date().toISOString(),
      adminRemarks: adminRemarks
    });

    // Confirmed cloud write
    const ok = await storage.saveTable(TABLE_NAMES.APPROVAL_REQUESTS, true);
    if (!ok) throw new CloudSaveError('❌ Cloud Save Failed: Revision request could not be confirmed by the cloud.');

    const machine = storage.getItem(TABLE_NAMES.MACHINES, req.machineId);
    notificationService.notify({
      title: 'Revision Requested',
      message: `Admin requested revision for Machine ${req.machineInfo?.serialNumber || machine?.serialNumber || ''}. Note: ${adminRemarks}`,
      type: 'APPROVAL_RESULT',
      module: 'machines',
      action: 'VIEW',
      entityType: 'MACHINE',
      entityId: req.machineId,
      targetUserId: req.requestedBy || null,
      targetUrl: '#approval-center',
      locationScope: machine ? {
        unitId: machine.unitId || null,
        floorId: machine.floorId || null,
        lineId: machine.lineId || null
      } : null
    });

    auditService.log('APPROVAL_REVISION_REQUESTED', 'APPROVAL_REQUEST', requestId, `Requested revision for ${req.machineInfo.serialNumber}: ${adminRemarks}`);
    return updated;
  }
}

export const approvalService = new ApprovalService();
