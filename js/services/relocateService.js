/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Machine Relocation, Physical Verification, Idle Identification & Reconciliation Service
 */

import { storage, CloudSaveError } from '../db/storage.js';
import { TABLE_NAMES, MACHINE_STATUSES } from '../db/schema.js';
import { authService } from './authService.js';
import { masterDataService } from './masterDataService.js';
import { auditService } from './auditService.js';
import { notificationService } from './notificationService.js';
import { historyService } from './historyService.js';
import { qrCodeService } from './qrCodeService.js';

class RelocateService {
  /**
   * Generates formatted session ID e.g. REL-20260910-001
   */
  generateSessionId() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const datePrefix = `REL-${y}${m}${d}`;
    
    const sessions = storage.getTable(TABLE_NAMES.RELOCATE_SESSIONS) || [];
    const todaySessions = sessions.filter(s => s && s.id && s.id.startsWith(datePrefix));
    const seq = String(todaySessions.length + 1).padStart(3, '0');
    return `${datePrefix}-${seq}`;
  }

  /**
   * Retrieves all relocation sessions
   */
  getAllSessions() {
    const list = storage.getTable(TABLE_NAMES.RELOCATE_SESSIONS) || [];
    return [...list].sort((a, b) => new Date(b.startedAt || 0) - new Date(a.startedAt || 0));
  }

  /**
   * Gets single session by ID
   */
  getSessionById(id) {
    const list = storage.getTable(TABLE_NAMES.RELOCATE_SESSIONS) || [];
    return list.find(s => s.id === id) || null;
  }

  /**
   * Returns current active in-progress session if any
   */
  getActiveSession() {
    const list = storage.getTable(TABLE_NAMES.RELOCATE_SESSIONS) || [];
    return list.find(s => s.status === 'IN_PROGRESS') || null;
  }

  /**
   * Starts a new physical verification and relocation session.
   * Takes an instant PREVIOUS INVENTORY SNAPSHOT of the target floor/lines.
   */
  async startSession({ unitId, floorId, lineIds = [], isFullFloor = false, notes = '' }) {
    if (!unitId || !floorId) {
      throw new Error('Unit and Floor are required to start a relocation scan session.');
    }

    if (!authService.isLocationAllowed(unitId, floorId)) {
      throw new Error('Access Denied: You are not authorized to start a relocation session on this floor.');
    }

    const user = authService.getCurrentUser() || { id: 'usr-1', name: 'Authorized Staff', role: 'ADMIN' };
    const allMachines = storage.getTable(TABLE_NAMES.MACHINES) || [];
    const allLines = masterDataService.getLines(floorId);

    // Determine target lines
    const targetLineIds = isFullFloor ? allLines.map(l => l.id) : (Array.isArray(lineIds) ? lineIds : [lineIds]);

    // 1. Snapshot: All machines assigned to this floor in current ERP database
    const floorMachines = allMachines.filter(m => m && m.floorId === floorId);

    // 2. Expected target machines: either entire floor or selected lines
    const targetMachines = isFullFloor 
      ? floorMachines 
      : floorMachines.filter(m => targetLineIds.includes(m.lineId));

    const sessionId = this.generateSessionId();

    const snapshot = targetMachines.map(m => ({
      id: m.id,
      serialNumber: m.serialNumber,
      machineNameId: m.machineNameId,
      brandId: m.brandId,
      modelId: m.modelId,
      unitId: m.unitId,
      floorId: m.floorId,
      lineId: m.lineId,
      status: m.status || 'ACTIVE',
      running: m.running ?? 1,
      usableIdle: m.usable_idle ?? 0,
      repairableIdle: m.repairable_idle ?? 0,
      needleQuantity: m.needleQuantity || m.customValues?.needle_quantity || ''
    }));

    const newSession = {
      id: sessionId,
      unitId,
      floorId,
      lineIds: isFullFloor ? 'ALL' : targetLineIds,
      isFullFloor: Boolean(isFullFloor),
      notes: notes || '',
      startedAt: new Date().toISOString(),
      startedBy: user.name || user.username || 'Authorized User',
      startedById: user.id || 'usr-1',
      status: 'IN_PROGRESS',
      snapshotTotal: snapshot.length,
      floorSnapshotTotal: floorMachines.length,
      snapshot: snapshot,
      scanned: [],
      completedAt: null,
      reconciliation: null
    };

    // CONFIRMED WRITE: await Database write before success
    const ok = await storage.saveTable(TABLE_NAMES.RELOCATE_SESSIONS,
      [...(storage.getTable(TABLE_NAMES.RELOCATE_SESSIONS) || []), newSession]
    );
    if (!ok) throw new CloudSaveError('❌ Cloud Save Failed: Relocation session could not be saved to the cloud.');
    auditService.log(
      'RELOCATE_SESSION_STARTED',
      'RELOCATE',
      sessionId,
      `Started physical scan session ${sessionId} for Floor: ${floorId} (${snapshot.length} expected machines).`
    );

    this._broadcastChange();
    return newSession;
  }

  /**
   * Looks up a machine by QR scan payload, Serial number, or search query
   */
  lookupMachine(rawIdentifier) {
    if (!rawIdentifier) return null;
    let clean = String(rawIdentifier).trim();

    // Clean standard ERP QR format: AL-MUSLIM-ERP://MC/{serial}
    if (clean.includes('://MC/')) {
      clean = clean.split('://MC/')[1].trim();
    } else if (clean.includes('://')) {
      const parts = clean.split('/');
      clean = parts[parts.length - 1].trim();
    }

    // Uses qrCodeService to parse potential QR payloads
    const parsed = qrCodeService.parseQrPayload(clean);
    const targetIdentifier = parsed.identifier || clean;
    const cleanLower = targetIdentifier.toLowerCase();

    const allMachines = storage.getTable(TABLE_NAMES.MACHINES) || [];

    // 1. Primary: Exact Immutable Machine ID or Permanent Machine ID match
    let match = allMachines.find(m => {
      if (!m) return false;
      const permId = (m.permanentMachineId || '').toLowerCase();
      const machId = (m.id || '').toLowerCase();
      return machId === cleanLower || permId === cleanLower;
    });

    // 2. Secondary: Exact Serial Number Match (Backward compatibility for legacy tags)
    if (!match) {
      match = allMachines.find(m => m && m.serialNumber && m.serialNumber.trim().toLowerCase() === cleanLower);
    }

    // 3. Normal alphanumeric match
    if (!match) {
      const normClean = cleanLower.replace(/[^a-z0-9]/g, '');
      if (normClean.length >= 2) {
        match = allMachines.find(m => {
          if (!m) return false;
          const permNorm = (m.permanentMachineId || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const idNorm = (m.id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const snNorm = (m.serialNumber || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          return permNorm === normClean || idNorm === normClean || snNorm === normClean;
        });
      }
    }

    if (!match) return null;

    // Ensure permanent ID is set
    qrCodeService.getPermanentMachineId(match);

    // Enrich with master data readable names
    const mn = storage.getItem(TABLE_NAMES.MACHINE_NAMES, match.machineNameId);
    const brd = storage.getItem(TABLE_NAMES.BRANDS, match.brandId);
    const mdl = storage.getItem(TABLE_NAMES.MODELS, match.modelId);
    const unt = storage.getItem(TABLE_NAMES.UNITS, match.unitId);
    const flr = storage.getItem(TABLE_NAMES.FLOORS, match.floorId);
    const lin = storage.getItem(TABLE_NAMES.LINES, match.lineId);

    return {
      ...match,
      machineNameStr: mn?.name || match.machineName || 'Machine',
      brandStr: brd?.name || match.brand || 'Brand',
      modelStr: mdl?.name || match.model || 'Model',
      unitStr: unt?.name || match.unit || 'Unit',
      floorStr: flr?.name || match.floor || 'Floor',
      lineStr: lin?.name || match.line || 'Line'
    };
  }

  /**
   * Helper to parse and extract Location QR parameters (Unit + Floor)
   */
  parseLocationQr(rawInput) {
    const parsed = qrCodeService.parseQrPayload(rawInput);
    if (parsed.type === 'LOCATION') {
      const unt = masterDataService.getUnitById(parsed.unitId);
      const flr = masterDataService.getFloorById(parsed.floorId);
      const locationTag = qrCodeService.getLocationTag(parsed.unitId, parsed.floorId);
      return {
        isLocationQr: true,
        unitId: parsed.unitId,
        unitName: unt?.name || parsed.unitId,
        floorId: parsed.floorId,
        floorName: flr?.name || parsed.floorId,
        locationTag
      };
    }
    return { isLocationQr: false };
  }

  /**
   * Evaluates machine location against target session parameters
   */
  evaluateLocation(session, machine, physicalLineId) {
    const isSameFloor = machine.floorId === session.floorId;
    const isSameUnit = machine.unitId === session.unitId;
    const isTargetLine = physicalLineId ? machine.lineId === physicalLineId : false;

    // Check if in initial snapshot
    const inSnapshot = Array.isArray(session.snapshot) && session.snapshot.some(s => s.id === machine.id);

    if (isSameUnit && isSameFloor) {
      if (isTargetLine) {
        return {
          matchType: 'CORRECT',
          label: 'Location Verified',
          badgeClass: 'badge-active',
          color: '#34d399',
          icon: '✓',
          relocationRequired: false,
          approvalRequired: false,
          description: 'Machine is at its registered inventory location.'
        };
      } else {
        return {
          matchType: 'LINE_MISMATCH',
          label: 'Line Relocation (Same Floor)',
          badgeClass: 'badge-idle',
          color: '#38bdf8',
          icon: '⚠️',
          relocationRequired: true,
          approvalRequired: false, // Same floor line move doesn't block inventory
          description: `Machine belongs to this floor but registered at another line.`
        };
      }
    } else {
      return {
        matchType: 'FLOOR_MISMATCH',
        label: 'Inter-Floor Relocation Pending',
        badgeClass: 'badge-breakdown',
        color: '#fbbf24',
        icon: '⏳',
        relocationRequired: true,
        approvalRequired: true, // Inter-floor moves MUST be approved
        description: `Machine is registered on a different floor (${machine.floorStr || machine.floorId})! Approval required.`
      };
    }
  }

  /**
   * Records a confirmed machine scan in the active session
   */
  recordScan(sessionId, machineId, { scannedLineId, needleQuantity = '', remarks = '' }) {
    const session = this.getSessionById(sessionId);
    if (!session) throw new Error('Relocation session not found.');
    if (session.status !== 'IN_PROGRESS') throw new Error('Cannot scan in a completed or cancelled session.');

    const machine = this.lookupMachine(machineId);
    if (!machine) throw new Error('Machine record not found.');

    // 1. Duplicate Scan Protection
    const existingScanIndex = session.scanned.findIndex(s => s.machineId === machine.id);
    if (existingScanIndex !== -1) {
      return {
        success: false,
        duplicate: true,
        scannedItem: session.scanned[existingScanIndex],
        message: `Machine [${machine.serialNumber}] was already scanned in this session!`
      };
    }

    // 2. Evaluate location
    const evalResult = this.evaluateLocation(session, machine, scannedLineId);

    const scanRecord = {
      scanId: `SCN-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      machineId: machine.id,
      serialNumber: machine.serialNumber,
      machineNameStr: machine.machineNameStr,
      brandStr: machine.brandStr,
      modelStr: machine.modelStr,
      previousUnitId: machine.unitId,
      previousFloorId: machine.floorId,
      previousLineId: machine.lineId,
      previousUnitStr: machine.unitStr,
      previousFloorStr: machine.floorStr,
      previousLineStr: machine.lineStr,
      scannedUnitId: session.unitId,
      scannedFloorId: session.floorId,
      scannedLineId: scannedLineId || machine.lineId,
      needleQuantity: needleQuantity ? String(needleQuantity).trim() : (machine.needleQuantity || ''),
      remarks: remarks || '',
      matchType: evalResult.matchType,
      evalResult: evalResult,
      scannedAt: new Date().toISOString()
    };

    session.scanned.push(scanRecord);
    storage.update(TABLE_NAMES.RELOCATE_SESSIONS, session.id, { scanned: session.scanned });

    this._broadcastChange();

    return {
      success: true,
      duplicate: false,
      scanRecord: scanRecord,
      evalResult: evalResult
    };
  }

  /**
   * Updates an existing scan record in the active session (e.g. line, needle quantity, remarks)
   */
  updateScan(sessionId, scanIdOrMachineId, { scannedLineId, needleQuantity, remarks }) {
    const session = this.getSessionById(sessionId);
    if (!session) throw new Error('Relocation session not found.');
    if (session.status !== 'IN_PROGRESS') throw new Error('Cannot edit scan in a completed or cancelled session.');

    const scanIndex = session.scanned.findIndex(s => s.scanId === scanIdOrMachineId || s.machineId === scanIdOrMachineId);
    if (scanIndex === -1) throw new Error('Scanned machine record not found.');

    const oldScan = session.scanned[scanIndex];
    const machine = this.lookupMachine(oldScan.machineId);
    if (!machine) throw new Error('Machine record not found.');

    const targetLineId = scannedLineId !== undefined ? scannedLineId : oldScan.scannedLineId;
    const evalResult = this.evaluateLocation(session, machine, targetLineId);

    const updatedScan = {
      ...oldScan,
      scannedLineId: targetLineId,
      needleQuantity: needleQuantity !== undefined ? String(needleQuantity).trim() : oldScan.needleQuantity,
      remarks: remarks !== undefined ? String(remarks).trim() : oldScan.remarks,
      matchType: evalResult.matchType,
      evalResult: evalResult,
      updatedAt: new Date().toISOString()
    };

    session.scanned[scanIndex] = updatedScan;
    storage.update(TABLE_NAMES.RELOCATE_SESSIONS, session.id, { scanned: session.scanned });
    this._broadcastChange();

    return {
      success: true,
      updatedScan
    };
  }

  /**
   * Removes a scanned machine record from the active session (reverting it to unscanned / idle)
   */
  removeScan(sessionId, scanIdOrMachineId) {
    const session = this.getSessionById(sessionId);
    if (!session) throw new Error('Relocation session not found.');
    if (session.status !== 'IN_PROGRESS') throw new Error('Cannot remove scan from a completed session.');

    const scanIndex = session.scanned.findIndex(s => s.scanId === scanIdOrMachineId || s.machineId === scanIdOrMachineId);
    if (scanIndex === -1) throw new Error('Scanned machine record not found.');

    const [removedScan] = session.scanned.splice(scanIndex, 1);
    storage.update(TABLE_NAMES.RELOCATE_SESSIONS, session.id, { scanned: session.scanned });
    this._broadcastChange();

    return {
      success: true,
      removedScan
    };
  }

  /**
   * Computes live reconciliation metrics for a session
   */
  getReconciliationMetrics(session) {
    if (!session) return null;

    const snapshot = session.snapshot || [];
    const scanned = session.scanned || [];

    const scannedMachineIds = new Set(scanned.map(s => s.machineId));

    // A. Scanned & Verified (Correct Location)
    const verifiedScans = scanned.filter(s => s.matchType === 'CORRECT');

    // B. Line Relocations (Same floor, different line)
    const lineRelocations = scanned.filter(s => s.matchType === 'LINE_MISMATCH');

    // C. Inter-Floor Pending Relocations (From another floor/unit)
    const pendingRelocations = scanned.filter(s => s.matchType === 'FLOOR_MISMATCH');

    // D. Audited Lines: Lines where scanning was performed OR explicitly targeted
    const auditedLineIds = new Set();
    if (Array.isArray(session.lineIds) && session.lineIds !== 'ALL' && session.lineIds.length > 0) {
      session.lineIds.forEach(id => auditedLineIds.add(id));
    } else {
      // Full floor session: audited lines are lines where scans were actually conducted
      scanned.forEach(s => {
        if (s.scannedLineId) auditedLineIds.add(s.scannedLineId);
        if (s.previousLineId && s.previousFloorId === session.floorId) auditedLineIds.add(s.previousLineId);
      });
    }

    // E. Same-Floor Idle Machines:
    // ONLY machines whose previous registered line was audited, but was NOT found/scanned anywhere in this session.
    // Machines in lines that were NOT scanned/audited remain active and untouched on their respective lines.
    const idleMachines = snapshot.filter(snap => 
      auditedLineIds.has(snap.lineId) && !scannedMachineIds.has(snap.id)
    );

    // Per-line breakdown
    const lineMap = new Map();
    const allFloorLines = masterDataService.getLines(session.floorId);
    
    // Initialize lines
    allFloorLines.forEach(l => {
      if (session.isFullFloor || (Array.isArray(session.lineIds) && session.lineIds.includes(l.id))) {
        lineMap.set(l.id, {
          lineId: l.id,
          lineName: l.name,
          expected: 0,
          scanned: 0,
          idle: 0,
          isAudited: auditedLineIds.has(l.id)
        });
      }
    });

    snapshot.forEach(snap => {
      if (lineMap.has(snap.lineId)) {
        lineMap.get(snap.lineId).expected++;
      }
    });

    scanned.forEach(s => {
      if (lineMap.has(s.scannedLineId)) {
        lineMap.get(s.scannedLineId).scanned++;
      }
    });

    idleMachines.forEach(snap => {
      if (lineMap.has(snap.lineId)) {
        lineMap.get(snap.lineId).idle++;
      }
    });

    return {
      expectedTotal: snapshot.length,
      scannedTotal: scanned.length,
      verifiedCount: verifiedScans.length,
      lineRelocationCount: lineRelocations.length,
      pendingRelocationCount: pendingRelocations.length,
      idleCount: idleMachines.length,
      idleMachines: idleMachines,
      verifiedScans: verifiedScans,
      lineRelocations: lineRelocations,
      pendingRelocations: pendingRelocations,
      auditedLineIds: Array.from(auditedLineIds),
      lineBreakdown: Array.from(lineMap.values())
    };
  }

  /**
   * Completes a scan session and performs AUTOMATIC RECONCILIATION:
   * 1. Same-Floor Not Found in Line -> Automatically marked as IDLE
   * 2. Same-Floor Line Moves -> Updated directly and logged to History
   * 3. Inter-Floor Mismatches -> Sent to Relocation Approval queue
   */
  async completeSession(sessionId, finalNotes = '') {
    const session = this.getSessionById(sessionId);
    if (!session) throw new Error('Relocation session not found.');
    if (session.status !== 'IN_PROGRESS') throw new Error('Session is already finalized.');

    const metrics = this.getReconciliationMetrics(session);
    const user = authService.getCurrentUser() || { id: 'usr-1', name: 'Authorized Staff', role: 'ADMIN' };
    const nowIso = new Date().toISOString();

    const allMachines = storage.getTable(TABLE_NAMES.MACHINES) || [];
    let machinesUpdated = 0;
    let idleClassified = 0;
    let pendingCreated = 0;
    let lineMovesCount = 0;

    // 1. Process Same-Floor Idle Machines (Not Found in Line)
    metrics.idleMachines.forEach(idleSnap => {
      const machine = allMachines.find(m => m.id === idleSnap.id);
      if (machine) {
        machine.status = 'IDLE';
        machine.usable_idle = 1;
        machine.usableIdle = 1;
        machine.running = 0;
        machine.qty_running = 0;
        machine.lastVerifiedDate = nowIso;
        machine.remarks = machine.remarks 
          ? `${machine.remarks} | Verified Idle (${session.id})`
          : `Verified Idle during physical scan session ${session.id}`;

        try {
          if (typeof historyService.logAction === 'function') {
            historyService.logAction(
              machine.id,
              'STATUS_CHANGE',
              `Automated reconciliation: Machine marked as IDLE because it was not found in active running lines during session ${session.id}.`,
              {
                previousStatus: idleSnap.status,
                newStatus: 'IDLE',
                sessionId: session.id,
                verifiedBy: user.name
              }
            );
          }
        } catch (_) {}

        idleClassified++;
        machinesUpdated++;
      }
    });

    // 2. Process Same-Floor Line Moves (Immediate Update)
    metrics.lineRelocations.forEach(move => {
      const machine = allMachines.find(m => m.id === move.machineId);
      if (machine) {
        const prevLineId = machine.lineId;
        machine.lineId = move.scannedLineId;
        machine.status = 'ACTIVE';
        machine.running = 1;
        machine.usable_idle = 0;
        machine.lastVerifiedDate = nowIso;
        if (move.needleQuantity) {
          machine.needleQuantity = move.needleQuantity;
        }

        // Record in Relocation History
        const relHistRecord = {
          id: `RH-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          machineId: machine.id,
          serialNumber: machine.serialNumber,
          sessionId: session.id,
          date: nowIso,
          previousUnitId: move.previousUnitId,
          previousFloorId: move.previousFloorId,
          previousLineId: prevLineId,
          newUnitId: move.scannedUnitId,
          newFloorId: move.scannedFloorId,
          newLineId: move.scannedLineId,
          status: 'APPROVED',
          approvedBy: user.name,
          approvalType: 'SAME_FLOOR_AUTO',
          notes: move.remarks || `Physical scan line relocation during ${session.id}`
        };
        storage.insert(TABLE_NAMES.RELOCATION_HISTORY, relHistRecord);

        try {
          if (typeof historyService.logAction === 'function') {
            historyService.logAction(
              machine.id,
              'TRANSFER',
              `Line relocated on same floor during session ${session.id} to Line ${move.scannedLineId}`,
              { sessionId: session.id, movedBy: user.name }
            );
          }
        } catch (_) {}

        lineMovesCount++;
        machinesUpdated++;
      }
    });

    // 3. Process Inter-Floor Scans (Relocation Pending Approval)
    metrics.pendingRelocations.forEach(pending => {
      const approvalRecord = {
        id: `APP-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        sessionId: session.id,
        machineId: pending.machineId,
        serialNumber: pending.serialNumber,
        machineNameStr: pending.machineNameStr,
        brandStr: pending.brandStr,
        modelStr: pending.modelStr,
        previousUnitId: pending.previousUnitId,
        previousFloorId: pending.previousFloorId,
        previousLineId: pending.previousLineId,
        destUnitId: pending.scannedUnitId,
        destFloorId: pending.scannedFloorId,
        destLineId: pending.scannedLineId,
        needleQuantity: pending.needleQuantity,
        remarks: pending.remarks || 'Scanned on different floor during physical audit',
        status: 'PENDING',
        requestedBy: user.name,
        requestedAt: nowIso,
        reviewedBy: null,
        reviewedAt: null,
        reviewNotes: ''
      };

      storage.insert(TABLE_NAMES.RELOCATION_APPROVALS, approvalRecord);

      notificationService.notifyWarning(
        'Relocation Approval Required',
        `Machine [${pending.serialNumber}] registered at ${pending.previousFloorStr} was physically found on ${session.floorId}. Approval required to update location.`
      );

      pendingCreated++;
    });

    // 4. Update machines where correct location was verified
    metrics.verifiedScans.forEach(ver => {
      const machine = allMachines.find(m => m.id === ver.machineId);
      if (machine) {
        machine.lastVerifiedDate = nowIso;
        if (ver.needleQuantity) {
          machine.needleQuantity = ver.needleQuantity;
        }
        machinesUpdated++;
      }
    });

    // Save updated machines table — CONFIRMED WRITE
    const machinesOk = await storage.saveTable(TABLE_NAMES.MACHINES);
    if (!machinesOk) throw new CloudSaveError('❌ Cloud Save Failed: Machine location updates during relocation session were not confirmed by the cloud.');

    // Finalize session
    const reconciliationSummary = {
      expectedTotal: metrics.expectedTotal,
      scannedTotal: metrics.scannedTotal,
      verifiedCount: metrics.verifiedCount,
      lineRelocationCount: lineMovesCount,
      pendingRelocationCount: pendingCreated,
      idleCount: idleClassified,
      completedAt: nowIso
    };

    session.status = 'COMPLETED';
    session.completedAt = nowIso;
    session.reconciliation = reconciliationSummary;
    if (finalNotes) {
      session.notes = session.notes ? `${session.notes}\n${finalNotes}` : finalNotes;
    }

    // CONFIRMED WRITE: session finalization
    const sessionOk = await storage.writeAndConfirm(TABLE_NAMES.RELOCATE_SESSIONS, (tbl) => {
      const idx = tbl.findIndex(s => s.id === session.id);
      if (idx !== -1) tbl[idx] = session;
    });

    auditService.log(
      'RELOCATE_SESSION_COMPLETED',
      'RELOCATE',
      session.id,
      `Session ${session.id} completed. Verified: ${metrics.verifiedCount}, Line Relocated: ${lineMovesCount}, Idle Classified: ${idleClassified}, Pending Approval: ${pendingCreated}.`
    );

    this._broadcastChange();

    return {
      session: session,
      metrics: reconciliationSummary
    };
  }

  /**
   * Cancels an in-progress session
   */
  cancelSession(sessionId, reason = '') {
    const session = this.getSessionById(sessionId);
    if (!session) throw new Error('Relocation session not found.');
    if (session.status !== 'IN_PROGRESS') throw new Error('Only active sessions can be cancelled.');

    session.status = 'CANCELLED';
    session.completedAt = new Date().toISOString();
    session.notes = session.notes ? `${session.notes}\nCancelled: ${reason}` : `Cancelled: ${reason}`;

    storage.update(TABLE_NAMES.RELOCATE_SESSIONS, session.id, session);
    auditService.log('RELOCATE_SESSION_CANCELLED', 'RELOCATE', session.id, `Session ${session.id} cancelled. Reason: ${reason}`);

    this._broadcastChange();
    return session;
  }

  // ─── RELOCATION APPROVALS ───

  getPendingApprovals() {
    const list = storage.getTable(TABLE_NAMES.RELOCATION_APPROVALS) || [];
    return list.filter(a => a && a.status === 'PENDING').sort((a, b) => new Date(b.requestedAt || 0) - new Date(a.requestedAt || 0));
  }

  getAllApprovals() {
    const list = storage.getTable(TABLE_NAMES.RELOCATION_APPROVALS) || [];
    return [...list].sort((a, b) => new Date(b.requestedAt || 0) - new Date(a.requestedAt || 0));
  }

  async approveRelocation(approvalId, reviewerNotes = '') {
    const canApprove = authService.isSuperAdmin() || 
                       authService.isAdmin() || 
                       authService.hasAccess('relocate', 'APPROVE') || 
                       authService.hasPermission('relocate', 'APPROVE') || 
                       authService.hasPermission('RELOCATE_APPROVE') ||
                       authService.hasAccess('transfers', 'APPROVE');

    if (!canApprove) {
      throw new Error('Unauthorized. Only Super Admin, Admin, or authorized managers with Relocate Approval permission can approve inter-floor relocations.');
    }

    const approvals = storage.getTable(TABLE_NAMES.RELOCATION_APPROVALS) || [];
    const app = approvals.find(a => a.id === approvalId);
    if (!app) throw new Error('Relocation request not found.');
    if (app.status !== 'PENDING') throw new Error('Request has already been processed.');

    const user = authService.getCurrentUser() || { name: 'Admin', role: 'ADMIN' };
    const nowIso = new Date().toISOString();

    const machine = storage.getItem(TABLE_NAMES.MACHINES, app.machineId);
    if (!machine) throw new Error('Machine record not found in inventory.');

    const prevLocationStr = `${machine.floorId} / ${machine.lineId}`;

    // Update Official Machine Location
    machine.unitId = app.destUnitId;
    machine.floorId = app.destFloorId;
    machine.lineId = app.destLineId;
    machine.lastVerifiedDate = nowIso;
    if (app.needleQuantity) {
      machine.needleQuantity = app.needleQuantity;
    }
    // CONFIRMED WRITE: Update machine location
    await storage.writeAndConfirm(TABLE_NAMES.MACHINES, (tbl) => {
      const idx = tbl.findIndex(m => m.id === machine.id);
      if (idx !== -1) tbl[idx] = machine;
    });

    // Record in History
    const relHistRecord = {
      id: `RH-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      machineId: machine.id,
      serialNumber: machine.serialNumber,
      sessionId: app.sessionId,
      date: nowIso,
      previousUnitId: app.previousUnitId,
      previousFloorId: app.previousFloorId,
      previousLineId: app.previousLineId,
      newUnitId: app.destUnitId,
      newFloorId: app.destFloorId,
      newLineId: app.destLineId,
      status: 'APPROVED',
      approvedBy: user.name,
      approvalType: 'INTER_FLOOR_ADMIN',
      notes: reviewerNotes || app.remarks || 'Inter-floor relocation approved'
    };
    // CONFIRMED WRITE: Save relocation history
    await storage.writeAndConfirm(TABLE_NAMES.RELOCATION_HISTORY, (tbl) => { tbl.push(relHistRecord); });

    try {
      if (typeof historyService.logAction === 'function') {
        historyService.logAction(
          machine.id,
          'TRANSFER',
          `Inter-floor relocation approved from ${prevLocationStr} to ${app.destFloorId} / ${app.destLineId}. Approved by ${user.name}.`,
          { previousLocation: prevLocationStr, newFloor: app.destFloorId, newLine: app.destLineId, approvedBy: user.name }
        );
      } else if (typeof historyService.recordActivity === 'function') {
        historyService.recordActivity({
          machineId: machine.id,
          serialNumber: machine.serialNumber,
          actionType: 'TRANSFER',
          title: 'Inter-Floor Relocation Approved',
          details: `Inter-floor relocation approved from ${prevLocationStr} to ${app.destFloorId} / ${app.destLineId}. Approved by ${user.name}.`,
          fromLocation: prevLocationStr,
          toLocation: `${app.destFloorId} / ${app.destLineId}`,
          performedByName: user.name
        });
      }
    } catch (histErr) {
      console.warn('History logging non-critical notice:', histErr);
    }

    // Update approval status — CONFIRMED WRITE
    app.status = 'APPROVED';
    app.reviewedBy = user.name;
    app.reviewedAt = nowIso;
    app.reviewNotes = reviewerNotes;
    await storage.writeAndConfirm(TABLE_NAMES.RELOCATION_APPROVALS, (tbl) => {
      const idx = tbl.findIndex(a => a.id === app.id);
      if (idx !== -1) tbl[idx] = app;
    });

    auditService.log('RELOCATION_APPROVED', 'RELOCATE', app.id, `Relocation approved for Machine ${app.serialNumber} to Floor ${app.destFloorId}`);
    this._broadcastChange();

    return app;
  }

  async rejectRelocation(approvalId, reason = '') {
    const canReject = authService.isSuperAdmin() || 
                      authService.isAdmin() || 
                      authService.hasAccess('relocate', 'APPROVE') || 
                      authService.hasPermission('relocate', 'APPROVE') || 
                      authService.hasPermission('RELOCATE_APPROVE') ||
                      authService.hasAccess('transfers', 'APPROVE');

    if (!canReject) {
      throw new Error('Unauthorized. Only Super Admin, Admin, or authorized managers with Relocate Approval permission can reject relocations.');
    }

    const approvals = storage.getTable(TABLE_NAMES.RELOCATION_APPROVALS) || [];
    const app = approvals.find(a => a.id === approvalId);
    if (!app) throw new Error('Relocation request not found.');
    if (app.status !== 'PENDING') throw new Error('Request has already been processed.');

    const user = authService.getCurrentUser() || { name: 'Admin', role: 'ADMIN' };
    const nowIso = new Date().toISOString();

    app.status = 'REJECTED';
    app.reviewedBy = user.name;
    app.reviewedAt = nowIso;
    app.reviewNotes = reason || 'Rejected by reviewer';
    // CONFIRMED WRITE: await Database write
    await storage.writeAndConfirm(TABLE_NAMES.RELOCATION_APPROVALS, (tbl) => {
      const idx = tbl.findIndex(a => a.id === app.id);
      if (idx !== -1) tbl[idx] = app;
    });

    // Record in History — CONFIRMED WRITE
    const relHistRecord = {
      id: `RH-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      machineId: app.machineId,
      serialNumber: app.serialNumber,
      sessionId: app.sessionId,
      date: nowIso,
      previousUnitId: app.previousUnitId,
      previousFloorId: app.previousFloorId,
      previousLineId: app.previousLineId,
      newUnitId: app.destUnitId,
      newFloorId: app.destFloorId,
      newLineId: app.destLineId,
      status: 'REJECTED',
      approvedBy: user.name,
      approvalType: 'INTER_FLOOR_REJECTED',
      notes: reason || 'Relocation rejected by reviewer; location unchanged'
    };
    await storage.writeAndConfirm(TABLE_NAMES.RELOCATION_HISTORY, (tbl) => { tbl.push(relHistRecord); });

    auditService.log('RELOCATION_REJECTED', 'RELOCATE', app.id, `Relocation rejected for Machine ${app.serialNumber}. Reason: ${reason}`);
    this._broadcastChange();

    return app;
  }

  // ─── IDLE MACHINES LIST ───

  getIdleMachines() {
    const allMachines = storage.getTable(TABLE_NAMES.MACHINES) || [];
    return allMachines.filter(m => {
      if (!m) return false;
      const st = String(m.status || '').toUpperCase();
      const u = parseInt(m.usable_idle ?? m.usableIdle ?? 0, 10);
      const rp = parseInt(m.repairable_idle ?? m.repairableIdle ?? 0, 10);
      return st === 'IDLE' || st === 'MAINTENANCE' || st === 'BREAKDOWN' || u > 0 || rp > 0;
    }).map(m => {
      const mn = storage.getItem(TABLE_NAMES.MACHINE_NAMES, m.machineNameId);
      const brd = storage.getItem(TABLE_NAMES.BRANDS, m.brandId);
      const mdl = storage.getItem(TABLE_NAMES.MODELS, m.modelId);
      const flr = storage.getItem(TABLE_NAMES.FLOORS, m.floorId);
      const lin = storage.getItem(TABLE_NAMES.LINES, m.lineId);
      return {
        ...m,
        machineNameStr: mn?.name || m.machineName || 'Machine',
        brandStr: brd?.name || m.brand || 'Brand',
        modelStr: mdl?.name || m.model || 'Model',
        floorStr: flr?.name || m.floor || 'Floor',
        lineStr: lin?.name || m.line || 'Line'
      };
    });
  }

  // ─── RELOCATION HISTORY ───

  getRelocationHistory(filters = {}) {
    const list = storage.getTable(TABLE_NAMES.RELOCATION_HISTORY) || [];
    let filtered = [...list].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    if (filters.search) {
      const q = filters.search.toLowerCase().trim();
      filtered = filtered.filter(h => 
        h.serialNumber?.toLowerCase().includes(q) ||
        h.sessionId?.toLowerCase().includes(q) ||
        h.approvedBy?.toLowerCase().includes(q) ||
        h.notes?.toLowerCase().includes(q)
      );
    }

    return filtered;
  }

  _broadcastChange() {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('erp:relocate-updated'));
      window.dispatchEvent(new CustomEvent('erp:inventory-updated'));
    }
  }
}

export const relocateService = new RelocateService();
