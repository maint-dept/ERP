/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Smart Search, QR/Barcode Scanner & Role-Based Quick Action System
 * Universal Floor Command HUD with Strict Location & Permission Scoping
 */

import { storage } from '../db/storage.js?v=4.52.0';
import { TABLE_NAMES } from '../db/schema.js?v=4.52.0';
import { authService } from '../services/authService.js?v=4.52.0';
import { router } from '../services/router.js?v=4.52.0';
import { state } from '../state.js?v=4.52.0';
import { playScanBeep } from './qrScannerModal.js?v=4.52.0';
import { openMachinePocketCard } from './machinePocketCardModal.js?v=4.52.0';
import { openMachinePassportModal } from './machineHistoryView.js?v=4.52.0';
import { icon, replaceEmojiInHtml } from './icons.js?v=4.52.0';

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Returns the human-readable physical machine identifier tag.
 * Prioritizes physical factory serial number and permanent asset ID.
 * Strictly NEVER outputs internal database UUIDs (e.g. 'mac-179...').
 */
export function getMachineDisplayId(machine) {
  if (!machine) return 'N/A';
  if (machine.serialNumber && String(machine.serialNumber).trim()) {
    return String(machine.serialNumber).trim();
  }
  if (machine.systemAssetId && String(machine.systemAssetId).trim()) {
    return String(machine.systemAssetId).trim();
  }
  if (machine.permanentMachineId && String(machine.permanentMachineId).trim()) {
    return String(machine.permanentMachineId).trim();
  }
  if (machine.machineId && !String(machine.machineId).startsWith('mac-')) {
    return String(machine.machineId).trim();
  }
  if (machine.barcode && !String(machine.barcode).startsWith('mac-')) {
    return String(machine.barcode).trim();
  }
  return machine.machineAssetCode || machine.machineShortCode || 'Machine';
}

/**
 * Returns the permanent factory asset ID (e.g. AMG-MNT-000013)
 */
export function getMachineAssetId(machine) {
  if (!machine) return '';
  return machine.systemAssetId || machine.permanentMachineId || machine.machineAssetCode || '';
}

/**
 * Searches machines across the ERP with intelligent multi-field matching
 * and attaches user location-scope authorization metadata to each result.
 * Matches physical serial numbers, permanent asset IDs, and machine attributes.
 * Excludes internal database UUID timestamps to guarantee relevant results.
 */
export function searchMachinesWithScope(query, limit = 8) {
  if (!query || !query.trim()) return [];
  const cleanQ = query.trim().toLowerCase();
  const terms = cleanQ.split(/\s+/).filter(Boolean);

  const machines = storage.getTable(TABLE_NAMES.MACHINES) || [];
  const units = storage.getTable(TABLE_NAMES.UNITS) || [];
  const floors = storage.getTable(TABLE_NAMES.FLOORS) || [];
  const lines = storage.getTable(TABLE_NAMES.LINES) || [];
  const names = storage.getTable(TABLE_NAMES.MACHINE_NAMES) || [];
  const brands = storage.getTable(TABLE_NAMES.BRANDS) || [];
  const models = storage.getTable(TABLE_NAMES.MODELS) || [];

  const unitMap = new Map(units.map(u => [u.id, u.name]));
  const floorMap = new Map(floors.map(f => [f.id, f.name]));
  const lineMap = new Map(lines.map(l => [l.id, l.name]));
  const nameMap = new Map(names.map(n => [n.id, n.name]));
  const brandMap = new Map(brands.map(b => [b.id, b.name]));
  const modelMap = new Map(models.map(m => [m.id, m.name]));

  const currentUser = authService.getCurrentUser();
  const results = [];
  const isNumericOnly = /^\d+$/.test(cleanQ);

  for (let i = 0; i < machines.length; i++) {
    const m = machines[i];
    const sNo = (m.serialNumber || '').toLowerCase();
    const assetId = (m.systemAssetId || m.permanentMachineId || '').toLowerCase();
    const userMachineId = (m.machineId && !m.machineId.startsWith('mac-')) ? m.machineId.toLowerCase() : '';
    const bCode = (m.barcode && !m.barcode.startsWith('mac-')) ? m.barcode.toLowerCase() : '';
    const mName = (nameMap.get(m.machineNameId) || m.machineName || m.name || '').toLowerCase();
    const bName = (brandMap.get(m.brandId) || m.brand || m.brandName || '').toLowerCase();
    const modName = (modelMap.get(m.modelId) || m.model || m.modelName || '').toLowerCase();
    const uName = (unitMap.get(m.unitId) || m.unit || m.unitName || '').toLowerCase();
    const fName = (floorMap.get(m.floorId) || m.floor || m.floorName || '').toLowerCase();
    const lName = (lineMap.get(m.lineId) || m.line || m.lineName || '').toLowerCase();

    // Scoring: Physical factory Serial Number gets highest priority
    let score = 0;
    if (sNo === cleanQ) score += 120;
    else if (sNo.startsWith(cleanQ)) score += 80;
    else if (sNo.includes(cleanQ)) score += 55;

    // Asset ID (e.g. AMG-MNT-000450)
    if (assetId === cleanQ) score += 110;
    else if (assetId.includes(cleanQ)) score += 70;
    else if (isNumericOnly) {
      const numPad = cleanQ.padStart(6, '0');
      if (assetId.includes(numPad)) score += 65;
    }

    // Custom user Machine ID (not mac- uuid)
    if (userMachineId) {
      if (userMachineId === cleanQ) score += 100;
      else if (userMachineId.includes(cleanQ)) score += 50;
    }

    // Barcode
    if (bCode) {
      if (bCode === cleanQ) score += 95;
      else if (bCode.includes(cleanQ)) score += 40;
    }

    // Model Name
    if (modName === cleanQ) score += 60;
    else if (modName.includes(cleanQ)) score += 35;

    // Machine Name / Brand / Line / Floor
    if (mName.includes(cleanQ)) score += 30;
    if (bName.includes(cleanQ)) score += 25;
    if (lName.includes(cleanQ)) score += 20;
    if (fName.includes(cleanQ)) score += 15;

    // Multi-term check against real searchable corpus (strictly excluding internal mac- DB UUIDs)
    const searchableCorpus = `${sNo} ${assetId} ${userMachineId} ${bCode} ${mName} ${bName} ${modName} ${uName} ${fName} ${lName}`;
    const allTermsMatch = terms.every(t => searchableCorpus.includes(t));

    if (allTermsMatch || score > 0) {
      if (score === 0) score = 10;

      // Check User Location Scope & Permissions
      const canOperate = authService.canOperateMachine(m, currentUser);
      const isViewOnly = authService.isMachineViewOnlyForUser(m, currentUser, true);
      const canView = canOperate || isViewOnly;

      // Only display machines user has rights to at least view
      if (canView) {
        results.push({
          machine: m,
          score,
          canOperate,
          isViewOnly,
          displayId: getMachineDisplayId(m),
          displayAssetId: getMachineAssetId(m),
          unitName: unitMap.get(m.unitId) || m.unit || m.unitName || 'Central Plant',
          floorName: floorMap.get(m.floorId) || m.floor || m.floorName || 'Unassigned',
          lineName: lineMap.get(m.lineId) || m.line || m.lineName || 'Unassigned',
          machineNameStr: nameMap.get(m.machineNameId) || m.machineName || m.name || 'Industrial Machine',
          brandStr: brandMap.get(m.brandId) || m.brand || m.brandName || 'Standard',
          modelStr: modelMap.get(m.modelId) || m.model || m.modelName || 'Standard Model'
        });
      }
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

/**
 * Opens the Role-Based Smart Machine Quick Action Sheet HUD
 */
export function openSmartMachineActionModal(machineOrQuery) {
  let machine = null;
  if (typeof machineOrQuery === 'object' && machineOrQuery !== null) {
    machine = machineOrQuery;
  } else {
    // Resolve by query
    const matches = searchMachinesWithScope(machineOrQuery, 1);
    if (matches && matches.length > 0) {
      machine = matches[0].machine;
    }
  }

  // Close any existing action modal
  closeSmartMachineActionModal();

  if (!machine) {
    showNotFoundActionDialog(machineOrQuery);
    return;
  }

  const currentUser = authService.getCurrentUser();
  const isSuperAdmin = authService.isSuperAdmin(currentUser);
  const isAdmin = authService.isAdmin(currentUser);

  // Compute Location Scopes
  const canOperate = authService.canOperateMachine(machine, currentUser);
  const isViewOnly = authService.isMachineViewOnlyForUser(machine, currentUser, true);

  // Resolve Master Names
  const units = storage.getTable(TABLE_NAMES.UNITS) || [];
  const floors = storage.getTable(TABLE_NAMES.FLOORS) || [];
  const lines = storage.getTable(TABLE_NAMES.LINES) || [];
  const names = storage.getTable(TABLE_NAMES.MACHINE_NAMES) || [];
  const brands = storage.getTable(TABLE_NAMES.BRANDS) || [];
  const models = storage.getTable(TABLE_NAMES.MODELS) || [];

  const unitObj = units.find(u => u.id === machine.unitId);
  const floorObj = floors.find(f => f.id === machine.floorId);
  const lineObj = lines.find(l => l.id === machine.lineId);
  const nameObj = names.find(n => n.id === machine.machineNameId);
  const brandObj = brands.find(b => b.id === machine.brandId);
  const modelObj = models.find(m => m.id === machine.modelId);

  const unitName = unitObj?.name || machine.unit || machine.unitName || 'Central Plant';
  const floorName = floorObj?.name || machine.floor || machine.floorName || 'Unassigned Floor';
  const lineName = lineObj?.name || machine.line || machine.lineName || 'Unassigned Line';
  const machineName = nameObj?.name || machine.machineName || machine.name || 'Industrial Machine';
  const brandName = brandObj?.name || machine.brand || machine.brandName || 'Standard Brand';
  const modelName = modelObj?.name || machine.model || machine.modelName || 'Standard Model';

  const status = (machine.status || 'ACTIVE').toUpperCase();
  let statusBadgeColor = '#34d399';
  let statusBg = 'rgba(16, 185, 129, 0.15)';
  let statusBorder = 'rgba(16, 185, 129, 0.4)';
  let statusIcon = '🟢';
  let statusText = 'Operational / Active';

  if (status.includes('MAINT') || status.includes('BREAKDOWN') || status.includes('REPAIR')) {
    statusBadgeColor = '#f87171';
    statusBg = 'rgba(239, 68, 68, 0.15)';
    statusBorder = 'rgba(239, 68, 68, 0.4)';
    statusIcon = '🔴';
    statusText = 'Under Breakdown / Maintenance';
  } else if (status.includes('IDLE') || status.includes('STORAGE') || status.includes('RELOCAT')) {
    statusBadgeColor = '#fbbf24';
    statusBg = 'rgba(245, 158, 11, 0.15)';
    statusBorder = 'rgba(245, 158, 11, 0.4)';
    statusIcon = '🟡';
    statusText = 'Idle / Relocation Pending';
  }

  // Permission Checks per user's exact roles & assigned scopes
  const canTransferRequest = authService.canRequestTransfer(currentUser);
  const canDirectTransfer = isSuperAdmin || isAdmin || authService.hasAccess('transfers', 'DIRECT_TRANSFER', currentUser);
  const canRelocate = canOperate && (isSuperAdmin || isAdmin || authService.hasAccess('machines', 'EDIT', currentUser) || canDirectTransfer);
  const canLogRepair = canOperate && (isSuperAdmin || isAdmin || authService.hasAccess('machine_history', 'ADD_SERVICE', currentUser) || currentUser?.role?.includes('MECHANIC') || currentUser?.role?.includes('TECH'));
  const canLogPM = canOperate && (isSuperAdmin || isAdmin || authService.hasAccess('preventive_maintenance', 'CREATE_SERVICE', currentUser));
  const canReplaceParts = canOperate && (isSuperAdmin || isAdmin || authService.hasAccess('spare_parts', 'ADD_REPLACEMENT', currentUser));
  const canEditMaster = canOperate && (isSuperAdmin || isAdmin || authService.hasAccess('machines', 'EDIT', currentUser));
  const canViewLifetime = authService.canViewLifetimeHistory(currentUser);

  // User Scope Text
  let scopeStatusHtml = '';
  if (isSuperAdmin) {
    scopeStatusHtml = `<span style="color: #38bdf8; font-weight: 700;">🛡️ Super Admin &bull; Global Plant Authority</span>`;
  } else if (isAdmin) {
    scopeStatusHtml = `<span style="color: #f59e0b; font-weight: 700;">👑 Admin &bull; Factory Operations Authority</span>`;
  } else if (canOperate) {
    scopeStatusHtml = `<span style="color: #34d399; font-weight: 700;">✓ Authorized Scope &bull; Location: ${escapeHtml(floorName)} / ${escapeHtml(lineName)}</span>`;
  } else {
    scopeStatusHtml = `<span style="color: #f87171; font-weight: 700;">🔒 View-Only Mode &bull; Outside Your Assigned Location Scope</span>`;
  }

  const displaySerial = getMachineDisplayId(machine);
  const displayAsset = getMachineAssetId(machine);

  const modalHtml = `
    <div id="smart-action-modal-overlay" class="modal-overlay" style="z-index: 10070; background: rgba(0, 0, 0, 0.88); backdrop-filter: blur(10px); display: flex; align-items: center; justify-content: center; padding: 12px;">
      <div class="smart-action-sheet">
        
        <!-- Header Strip -->
        <div class="modal-header smart-action-header">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 38px; height: 38px; border-radius: 10px; background: rgba(56, 189, 248, 0.15); border: 1.5px solid #38bdf8; display: flex; align-items: center; justify-content: center; font-size: 20px;">
              ⚡
            </div>
            <div>
              <h3 style="margin: 0; font-size: 15px; font-weight: 900; color: #fff; letter-spacing: 0.5px; text-transform: uppercase;">Smart Machine Action Hub</h3>
              <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">One-Touch Emergency &amp; Operational Execution</div>
            </div>
          </div>

          <button id="btn-close-smart-action-modal" type="button" class="btn btn-ghost" style="width: 36px; height: 36px; border-radius: 50%; color: #94a3b8; padding: 0; display: flex; align-items: center; justify-content: center; font-size: 20px;" aria-label="Close">
            ✕
          </button>
        </div>

        <!-- Body with dedicated custom scrolling -->
        <div class="modal-body smart-action-modal-body custom-scrollbar">
          
          <!-- Machine Identity Hero Card -->
          <div style="background: linear-gradient(135deg, rgba(15, 23, 42, 0.98), rgba(30, 41, 59, 0.95)); border: 1px solid rgba(56, 189, 248, 0.35); border-radius: 14px; padding: 16px; position: relative; overflow: hidden; flex-shrink: 0;">
            <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; flex-wrap: wrap;">
              <div>
                <div style="font-size: 11px; font-weight: 800; color: #38bdf8; text-transform: uppercase; letter-spacing: 1px; display: flex; align-items: center; gap: 8px;">
                  <span>🏷️ Machine Serial Number</span>
                  ${displayAsset ? `<span style="font-size: 10px; background: rgba(56,189,248,0.15); border: 1px solid rgba(56,189,248,0.3); color: #7dd3fc; padding: 1px 7px; border-radius: 4px; font-family: monospace;">Asset: ${escapeHtml(displayAsset)}</span>` : ''}
                </div>
                <div style="font-size: 24px; font-weight: 900; color: #fff; font-family: monospace; letter-spacing: 0.5px; margin: 4px 0 6px; display: flex; align-items: center; gap: 8px;">
                  <span>${escapeHtml(displaySerial)}</span>
                  <button type="button" id="btn-copy-machine-id" title="Copy Machine Serial Tag" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; color: #38bdf8; cursor: pointer; font-size: 12px; font-weight: 700; padding: 3px 8px; display: inline-flex; align-items: center; gap: 4px;">
                    <span>📋</span>
                    <span>Copy</span>
                  </button>
                </div>
                <div style="font-size: 15px; font-weight: 700; color: #f1f5f9;">
                  ${escapeHtml(machineName)}
                </div>
                <div style="font-size: 12px; color: #94a3b8; margin-top: 4px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                  <span>Brand: <strong style="color: #f8fafc;">${escapeHtml(brandName)}</strong></span>
                  <span>&bull;</span>
                  <span>Model: <strong style="color: #f8fafc;">${escapeHtml(modelName)}</strong></span>
                </div>
              </div>

              <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 6px;">
                <span style="font-size: 12px; font-weight: 800; padding: 5px 12px; border-radius: 8px; display: inline-flex; align-items: center; gap: 6px; background: ${statusBg}; color: ${statusBadgeColor}; border: 1px solid ${statusBorder};">
                  <span>${statusIcon}</span>
                  <span>${escapeHtml(statusText)}</span>
                </span>
                <span style="font-size: 11px; color: #64748b;">
                  Tag / Barcode: <code style="color: #cbd5e1; font-family: monospace;">${escapeHtml(machine.barcode || displayAsset || displaySerial)}</code>
                </span>
              </div>
            </div>

            <!-- Current Location Trail -->
            <div style="margin-top: 14px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; font-size: 11.5px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="color: #94a3b8; font-weight: 700;">CURRENT LOCATION:</span>
                <span style="background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.35); color: #38bdf8; padding: 2px 8px; border-radius: 6px; font-weight: 800;">
                  🏢 ${escapeHtml(unitName)}
                </span>
                <span style="background: rgba(168, 85, 247, 0.15); border: 1px solid rgba(168, 85, 247, 0.35); color: #c084fc; padding: 2px 8px; border-radius: 6px; font-weight: 800;">
                  🗺️ ${escapeHtml(floorName)}
                </span>
                <span style="background: rgba(34, 197, 94, 0.15); border: 1px solid rgba(34, 197, 94, 0.35); color: #4ade80; padding: 2px 8px; border-radius: 6px; font-weight: 800;">
                  📍 Line: ${escapeHtml(lineName)}
                </span>
              </div>

              <!-- Scope pill -->
              <div>${scopeStatusHtml}</div>
            </div>
          </div>

          <!-- Quick Action Tiles Grid (Filtered by Role & Scope) -->
          <div style="flex-shrink: 0;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
              <div style="font-size: 11.5px; font-weight: 900; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px;">
                ⚡ Select Authorized Action
              </div>
              <div style="font-size: 11px; color: #64748b;">
                Actions strictly reflect your user role &amp; floor boundary
              </div>
            </div>

            <div class="smart-actions-grid">
              
              <!-- 1. Relocate Machine -->
              <button type="button" id="act-btn-relocate" class="action-tile-btn ${canRelocate ? '' : 'disabled'}" style="${canRelocate ? 'border-color: #38bdf8;' : 'opacity: 0.45; pointer-events: none; border-color: rgba(255,255,255,0.08);'}" title="${canRelocate ? 'Move this machine to a new Line or Floor' : 'Restricted: Relocation requires Floor/Admin access for this machine location'}">
                <div class="action-tile-icon" style="font-size: 22px; margin-bottom: 4px;">🔄</div>
                <div class="action-tile-title" style="font-size: 12.5px; font-weight: 800; color: #f8fafc;">Relocate Machine</div>
                <div class="action-tile-desc" style="font-size: 10.5px; color: #94a3b8;">Change Line / Floor</div>
              </button>

              <!-- 2. Transfer Request -->
              <button type="button" id="act-btn-transfer" class="action-tile-btn ${canTransferRequest ? '' : 'disabled'}" style="${canTransferRequest ? 'border-color: #60a5fa;' : 'opacity: 0.45; pointer-events: none; border-color: rgba(255,255,255,0.08);'}" title="${canTransferRequest ? 'Initiate multi-tier Machine Transfer Request' : 'No Transfer Permission'}">
                <div class="action-tile-icon" style="font-size: 22px; margin-bottom: 4px;">🔁</div>
                <div class="action-tile-title" style="font-size: 12.5px; font-weight: 800; color: #f8fafc;">Machine Transfer</div>
                <div class="action-tile-desc" style="font-size: 10.5px; color: #94a3b8;">Inter-Unit / Floor Gate Pass</div>
              </button>

              <!-- 3. Log Servicing / Breakdown Repair -->
              <button type="button" id="act-btn-service" class="action-tile-btn ${canLogRepair ? '' : 'disabled'}" style="${canLogRepair ? 'border-color: #f87171;' : 'opacity: 0.45; pointer-events: none; border-color: rgba(255,255,255,0.08);'}" title="${canLogRepair ? 'Log repair work or report breakdown defect' : 'Restricted: Mechanic / Service permission required'}">
                <div class="action-tile-icon" style="font-size: 22px; margin-bottom: 4px;">🛠️</div>
                <div class="action-tile-title" style="font-size: 12.5px; font-weight: 800; color: #f8fafc;">Machine Servicing</div>
                <div class="action-tile-desc" style="font-size: 10.5px; color: #94a3b8;">Log Repair / Breakdown</div>
              </button>

              <!-- 4. Preventive Maintenance (PM) -->
              <button type="button" id="act-btn-pm" class="action-tile-btn ${canLogPM ? '' : 'disabled'}" style="${canLogPM ? 'border-color: #34d399;' : 'opacity: 0.45; pointer-events: none; border-color: rgba(255,255,255,0.08);'}" title="${canLogPM ? 'Mark PM Servicing Done & Advance Next 90d Cycle' : 'Restricted: PM Service permission required'}">
                <div class="action-tile-icon" style="font-size: 22px; margin-bottom: 4px;">🛡️</div>
                <div class="action-tile-title" style="font-size: 12.5px; font-weight: 800; color: #f8fafc;">Preventive Maint.</div>
                <div class="action-tile-desc" style="font-size: 10.5px; color: #94a3b8;">90-Day Audit Cycle</div>
              </button>

              <!-- 5. Spare Parts Replacement -->
              <button type="button" id="act-btn-parts" class="action-tile-btn ${canReplaceParts ? '' : 'disabled'}" style="${canReplaceParts ? 'border-color: #f59e0b;' : 'opacity: 0.45; pointer-events: none; border-color: rgba(255,255,255,0.08);'}" title="${canReplaceParts ? 'Record replacement spare parts consumption' : 'Restricted: Spare Parts permission required'}">
                <div class="action-tile-icon" style="font-size: 22px; margin-bottom: 4px;">⚙️</div>
                <div class="action-tile-title" style="font-size: 12.5px; font-weight: 800; color: #f8fafc;">Spare Parts Log</div>
                <div class="action-tile-desc" style="font-size: 10.5px; color: #94a3b8;">Log Replacement Part</div>
              </button>

              <!-- 6. Machine Report & Official Documentation -->
              <button type="button" id="act-btn-report" class="action-tile-btn" style="border-color: #38bdf8;" title="View & Print Official Machine PM Sheet or Lifetime Passport">
                <div class="action-tile-icon" style="font-size: 22px; margin-bottom: 4px;">📑</div>
                <div class="action-tile-title" style="font-size: 12.5px; font-weight: 800; color: #f8fafc;">Machine Report</div>
                <div class="action-tile-desc" style="font-size: 10.5px; color: #94a3b8;">PM &amp; Audit Sheet</div>
              </button>

              <!-- 7. Machine Lifetime Passport -->
              <button type="button" id="act-btn-passport" class="action-tile-btn ${canViewLifetime ? '' : 'disabled'}" style="${canViewLifetime ? 'border-color: #a855f7;' : 'opacity: 0.45; pointer-events: none; border-color: rgba(255,255,255,0.08);'}" title="View Complete Lifetime History Passport & PDF">
                <div class="action-tile-icon" style="font-size: 22px; margin-bottom: 4px;">📜</div>
                <div class="action-tile-title" style="font-size: 12.5px; font-weight: 800; color: #f8fafc;">Lifetime Passport</div>
                <div class="action-tile-desc" style="font-size: 10.5px; color: #94a3b8;">Transfers &amp; Repair History</div>
              </button>

              <!-- 8. Machine Technical Details -->
              <button type="button" id="act-btn-details" class="action-tile-btn" style="border-color: rgba(255,255,255,0.2);" title="Open Machine Specifications Drawer">
                <div class="action-tile-icon" style="font-size: 22px; margin-bottom: 4px;">🔍</div>
                <div class="action-tile-title" style="font-size: 12.5px; font-weight: 800; color: #f8fafc;">Technical Details</div>
                <div class="action-tile-desc" style="font-size: 10.5px; color: #94a3b8;">Specs &amp; Parameters</div>
              </button>

              <!-- 9. Edit Machine Master -->
              <button type="button" id="act-btn-edit" class="action-tile-btn ${canEditMaster ? '' : 'disabled'}" style="${canEditMaster ? 'border-color: #ec4899;' : 'opacity: 0.45; pointer-events: none; border-color: rgba(255,255,255,0.08);'}" title="${canEditMaster ? 'Edit Machine Master Specifications' : 'Restricted: Edit Machine permission required'}">
                <div class="action-tile-icon" style="font-size: 22px; margin-bottom: 4px;">✏️</div>
                <div class="action-tile-title" style="font-size: 12.5px; font-weight: 800; color: #f8fafc;">Edit Master Data</div>
                <div class="action-tile-desc" style="font-size: 10.5px; color: #94a3b8;">Update Attributes</div>
              </button>

            </div>
          </div>

          <!-- Dynamic Action Sub-Form Container (Rendered on Demand) -->
          <div id="smart-action-subform-box" style="display: none; background: rgba(15, 23, 42, 0.9); border: 1.5px solid #38bdf8; border-radius: 12px; padding: 14px 16px; flex-shrink: 0;"></div>

          <!-- Footer Guidance -->
          <div style="display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: #64748b; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.06); flex-shrink: 0; flex-wrap: wrap; gap: 6px;">
            <span>💡 Press <strong>Esc</strong> to close &bull; Selected machine automatically binds to action forms</span>
            <button type="button" id="btn-smart-action-pocket" class="btn btn-ghost btn-xs" style="color: #38bdf8; font-weight: 700; text-decoration: underline;">
              View Pocket HUD Card ↗
            </button>
          </div>

        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', replaceEmojiInHtml(modalHtml));

  // Wire Events
  const overlay = document.getElementById('smart-action-modal-overlay');
  const closeBtn = document.getElementById('btn-close-smart-action-modal');

  const closeHandler = () => closeSmartMachineActionModal();
  if (closeBtn) closeBtn.addEventListener('click', closeHandler);
  if (overlay) overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeHandler();
  });

  const escHandler = (e) => {
    if (e.key === 'Escape') {
      closeSmartMachineActionModal();
      window.removeEventListener('keydown', escHandler);
    }
  };
  window.addEventListener('keydown', escHandler);

  // Copy Machine ID button
  const copyBtn = document.getElementById('btn-copy-machine-id');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const text = displaySerial || displayAsset || machine.id;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text);
        copyBtn.innerHTML = '<span>✓</span><span>Copied</span>';
        setTimeout(() => { if (copyBtn) copyBtn.innerHTML = '<span>📋</span><span>Copy</span>'; }, 1500);
      }
    });
  }

  // Pocket HUD card link
  const pocketBtn = document.getElementById('btn-smart-action-pocket');
  if (pocketBtn) {
    pocketBtn.addEventListener('click', () => {
      closeSmartMachineActionModal();
      if (typeof window.openMachinePocketCard === 'function') {
        window.openMachinePocketCard(machine);
      }
    });
  }

  // 1. Relocate Action
  const actRelocate = document.getElementById('act-btn-relocate');
  if (actRelocate && canRelocate) {
    actRelocate.addEventListener('click', () => {
      renderInlineQuickRelocateForm(machine, floorName, lineName);
    });
  }

  // 2. Transfer Action
  const actTransfer = document.getElementById('act-btn-transfer');
  if (actTransfer && canTransferRequest) {
    actTransfer.addEventListener('click', () => {
      closeSmartMachineActionModal();
      try {
        state.set('activeMachineId', machine.id);
        state.set('activeMachineSerial', machine.serialNumber || machine.systemAssetId || '');
        state.set('transferMachineId', machine.id);
        state.set('activeModal', 'transfer-machine');
      } catch (_) {}
    });
  }

  // 3. Servicing / Repair Action
  const actService = document.getElementById('act-btn-service');
  if (actService && canLogRepair) {
    actService.addEventListener('click', () => {
      renderInlineQuickServiceForm(machine);
    });
  }

  // 4. Preventive Maintenance Action (Opens only the selected machine's PM Profile & Schedule)
  const actPM = document.getElementById('act-btn-pm');
  if (actPM && canLogPM) {
    actPM.addEventListener('click', () => {
      closeSmartMachineActionModal();
      try {
        state.set('preSelectedPMMachineId', machine.id);
        state.set('activeMachineId', machine.id);
        state.set('pmFilterMachineSerial', machine.serialNumber);
        state.set('pmActiveTab', 'machine-profile');
        state.set('currentView', 'preventive-maintenance');
        if (typeof window.app !== 'undefined' && typeof window.app.switchView === 'function') {
          window.app._currentRenderedView = null;
          window.app.switchView('preventive-maintenance', { tab: 'machine-profile' });
        } else {
          router.navigate('preventive-maintenance', { tab: 'machine-profile' });
        }
      } catch (_) {}
    });
  }

  // 5. Spare Parts Replacement Action (Opens only the selected machine's Spare Parts History & Log)
  const actParts = document.getElementById('act-btn-parts');
  if (actParts && canReplaceParts) {
    actParts.addEventListener('click', () => {
      closeSmartMachineActionModal();
      try {
        state.set('activeMachineId', machine.id);
        state.set('historyActiveTab', 'spare-parts');
        state.set('historySearchedSerial', machine.serialNumber);
        state.set('currentView', 'machine-history');
        if (typeof window.app !== 'undefined' && typeof window.app.switchView === 'function') {
          window.app._currentRenderedView = null;
          window.app.switchView('machine-history', { tab: 'spare-parts' });
        } else {
          router.navigate('machine-history', { tab: 'spare-parts' });
        }
      } catch (_) {}
    });
  }

  // 6. Machine Report & Official Documentation Selector
  const actReport = document.getElementById('act-btn-report');
  if (actReport) {
    actReport.addEventListener('click', () => {
      renderInlineQuickReportOptions(machine);
    });
  }

  // 7. Machine Lifetime Passport
  const actPassport = document.getElementById('act-btn-passport');
  if (actPassport && canViewLifetime) {
    actPassport.addEventListener('click', () => {
      closeSmartMachineActionModal();
      if (typeof openMachinePassportModal === 'function') {
        openMachinePassportModal(machine.serialNumber);
      } else if (typeof window.openMachinePassportModal === 'function') {
        window.openMachinePassportModal(machine.serialNumber);
      } else {
        try {
          state.set('activeMachineId', machine.id);
          state.set('currentView', 'machine-history');
          router.navigate('machine-history');
        } catch (_) {}
      }
    });
  }

  // 8. Technical Details
  const actDetails = document.getElementById('act-btn-details');
  if (actDetails) {
    actDetails.addEventListener('click', () => {
      closeSmartMachineActionModal();
      try {
        state.set('activeMachineId', machine.id);
        state.set('activeModal', 'machine-details');
        const drawer = document.getElementById('machine-details-drawer');
        if (drawer) drawer.classList.add('open');
      } catch (_) {}
    });
  }

  // 9. Edit Master Data
  const actEdit = document.getElementById('act-btn-edit');
  if (actEdit && canEditMaster) {
    actEdit.addEventListener('click', () => {
      closeSmartMachineActionModal();
      try {
        state.set('editingMachineId', machine.id);
        state.set('activeMachineId', machine.id);
        state.set('activeModal', 'edit-machine');
      } catch (_) {}
    });
  }
}

/**
 * In-Modal Machine Report & Official Documentation Selector
 * Directly opens:
 * 1. Official PM Maintenance Report & Print Sheet (A4 Sheet scoped to this machine)
 * 2. Lifetime Machine Passport & Audit PDF (complete history of movement, repairs, parts)
 * 3. Offline Machine Pocket Card HUD (mobile quick-glance card)
 */
function renderInlineQuickReportOptions(machine) {
  const box = document.getElementById('smart-action-subform-box');
  if (!box) return;

  // Toggle behavior: if already open with report options, close it
  if (box.style.display !== 'none' && box.dataset.activeForm === 'report') {
    box.style.display = 'none';
    box.dataset.activeForm = '';
    return;
  }

  box.dataset.activeForm = 'report';
  box.style.display = 'block';

  const serial = machine.serialNumber || getMachineDisplayId(machine);

  box.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 8px;">
      <div style="font-size: 13px; font-weight: 800; color: #38bdf8; display: flex; align-items: center; gap: 6px;">
        <span>📑</span> Machine Reports &amp; Official Documentation
      </div>
      <button type="button" id="btn-cancel-report-box" class="btn btn-ghost btn-xs" style="color: #94a3b8;">✕ Close</button>
    </div>

    <div style="display: flex; flex-direction: column; gap: 8px;">
      
      <!-- Option 1: Official PM Report Sheet -->
      <button type="button" id="btn-quick-rep-pm-sheet" class="btn" style="background: rgba(56, 189, 248, 0.08); border: 1.5px solid rgba(56, 189, 248, 0.4); border-radius: 10px; padding: 10px 12px; display: flex; align-items: center; justify-content: space-between; text-align: left; cursor: pointer; transition: all 0.2s; gap: 10px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(56, 189, 248, 0.15); border: 1px solid #38bdf8; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0;">
            📄
          </div>
          <div>
            <div style="font-size: 12px; font-weight: 800; color: #f8fafc;">Official PM Maintenance Report &amp; Print Sheet</div>
            <div style="font-size: 10.5px; color: #94a3b8;">Al-Muslim standard A4 preventive servicing checklist scoped to this machine</div>
          </div>
        </div>
        <span style="color: #38bdf8; font-size: 13px; font-weight: 800; flex-shrink: 0;">Open ➔</span>
      </button>

      <!-- Option 2: Lifetime Passport & Audit PDF -->
      <button type="button" id="btn-quick-rep-passport" class="btn" style="background: rgba(168, 85, 247, 0.08); border: 1.5px solid rgba(168, 85, 247, 0.4); border-radius: 10px; padding: 10px 12px; display: flex; align-items: center; justify-content: space-between; text-align: left; cursor: pointer; transition: all 0.2s; gap: 10px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(168, 85, 247, 0.15); border: 1px solid #c084fc; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0;">
            📜
          </div>
          <div>
            <div style="font-size: 12px; font-weight: 800; color: #f8fafc;">Lifetime Machine Passport &amp; Audit PDF</div>
            <div style="font-size: 10.5px; color: #94a3b8;">Complete lifetime audit trail: location movements, repairs, and replaced spare parts</div>
          </div>
        </div>
        <span style="color: #c084fc; font-size: 13px; font-weight: 800; flex-shrink: 0;">View ➔</span>
      </button>

      <!-- Option 3: Pocket HUD Card -->
      <button type="button" id="btn-quick-rep-pocket" class="btn" style="background: rgba(34, 197, 94, 0.08); border: 1.5px solid rgba(34, 197, 94, 0.4); border-radius: 10px; padding: 10px 12px; display: flex; align-items: center; justify-content: space-between; text-align: left; cursor: pointer; transition: all 0.2s; gap: 10px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(34, 197, 94, 0.15); border: 1px solid #4ade80; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0;">
            🏷️
          </div>
          <div>
            <div style="font-size: 12px; font-weight: 800; color: #f8fafc;">Offline Machine Pocket Card (HUD)</div>
            <div style="font-size: 10.5px; color: #94a3b8;">High-density offline quick-glance card with QR scanner tag and technical specs</div>
          </div>
        </div>
        <span style="color: #4ade80; font-size: 13px; font-weight: 800; flex-shrink: 0;">Display ➔</span>
      </button>

    </div>
  `;

  // Scroll subform smoothly into view within modal body
  setTimeout(() => {
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 50);

  // Wire buttons
  const btnClose = document.getElementById('btn-cancel-report-box');
  if (btnClose) {
    btnClose.addEventListener('click', () => {
      box.style.display = 'none';
      box.dataset.activeForm = '';
    });
  }

  const btnPmSheet = document.getElementById('btn-quick-rep-pm-sheet');
  if (btnPmSheet) {
    btnPmSheet.addEventListener('click', () => {
      closeSmartMachineActionModal();
      try {
        state.set('pmReportFilterSerial', serial);
        state.set('pmActiveTab', 'maintenance-report');
        state.set('currentView', 'preventive-maintenance');
        if (typeof window.app !== 'undefined' && typeof window.app.switchView === 'function') {
          window.app._currentRenderedView = null;
          window.app.switchView('preventive-maintenance', { tab: 'maintenance-report' });
        } else {
          router.navigate('preventive-maintenance', { tab: 'maintenance-report' });
        }
      } catch (_) {}
    });
  }

  const btnPassport = document.getElementById('btn-quick-rep-passport');
  if (btnPassport) {
    btnPassport.addEventListener('click', () => {
      closeSmartMachineActionModal();
      if (typeof openMachinePassportModal === 'function') {
        openMachinePassportModal(machine.serialNumber);
      } else if (typeof window.openMachinePassportModal === 'function') {
        window.openMachinePassportModal(machine.serialNumber);
      } else {
        state.set('activeMachineId', machine.id);
        state.set('currentView', 'machine-history');
        router.navigate('machine-history');
      }
    });
  }

  const btnPocket = document.getElementById('btn-quick-rep-pocket');
  if (btnPocket) {
    btnPocket.addEventListener('click', () => {
      closeSmartMachineActionModal();
      if (typeof openMachinePocketCard === 'function') {
        openMachinePocketCard(machine);
      } else if (typeof window.openMachinePocketCard === 'function') {
        window.openMachinePocketCard(machine);
      }
    });
  }
}

/**
 * In-Modal Instant Relocation Execution
 * Allows changing machine Floor / Line directly without navigating to other modules!
 */
function renderInlineQuickRelocateForm(machine, currentFloorStr, currentLineStr) {
  const box = document.getElementById('smart-action-subform-box');
  if (!box) return;

  if (box.style.display !== 'none' && box.dataset.activeForm === 'relocate') {
    box.style.display = 'none';
    box.dataset.activeForm = '';
    return;
  }
  box.dataset.activeForm = 'relocate';
  box.style.display = 'block';
  setTimeout(() => {
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 50);

  const floors = storage.getTable(TABLE_NAMES.FLOORS) || [];
  const lines = storage.getTable(TABLE_NAMES.LINES) || [];

  const floorOptionsHtml = floors.map(f => `
    <option value="${f.id}" ${f.id === machine.floorId ? 'selected' : ''}>${escapeHtml(f.name)}</option>
  `).join('');

  const targetLines = lines.filter(l => !machine.floorId || l.floorId === machine.floorId);
  const lineOptionsHtml = targetLines.map(l => `
    <option value="${l.id}" ${l.id === machine.lineId ? 'selected' : ''}>${escapeHtml(l.name)}</option>
  `).join('');

  box.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 8px;">
      <div style="font-size: 13px; font-weight: 800; color: #38bdf8; display: flex; align-items: center; gap: 6px;">
        <span>🔄</span> Quick Floor &amp; Line Relocation
      </div>
      <button type="button" id="btn-cancel-inline-relocate" class="btn btn-ghost btn-xs" style="color: #94a3b8;">Cancel</button>
    </div>

    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 12px;">
      <div>
        <label style="font-size: 11px; font-weight: 700; color: #94a3b8; display: block; margin-bottom: 4px;">Target Floor</label>
        <select id="quick-relocate-floor" class="form-control" style="width: 100%; height: 34px; font-size: 12px; font-weight: 700; background: #0b1120; border: 1px solid rgba(56,189,248,0.4); border-radius: 6px; color: #fff; padding: 0 8px;">
          ${floorOptionsHtml}
        </select>
      </div>

      <div>
        <label style="font-size: 11px; font-weight: 700; color: #94a3b8; display: block; margin-bottom: 4px;">Target Line</label>
        <select id="quick-relocate-line" class="form-control" style="width: 100%; height: 34px; font-size: 12px; font-weight: 700; background: #0b1120; border: 1px solid rgba(56,189,248,0.4); border-radius: 6px; color: #fff; padding: 0 8px;">
          ${lineOptionsHtml}
        </select>
      </div>
    </div>

    <div style="margin-bottom: 12px;">
      <label style="font-size: 11px; font-weight: 700; color: #94a3b8; display: block; margin-bottom: 4px;">Movement Reason / Operator Note</label>
      <input type="text" id="quick-relocate-reason" class="form-control" placeholder="e.g. Production line rebalancing or urgent style change" style="width: 100%; height: 32px; font-size: 12px; background: #0b1120; border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; color: #fff; padding: 0 10px;" />
    </div>

    <div style="display: flex; justify-content: flex-end; gap: 8px;">
      <button type="button" id="btn-save-inline-relocate" class="btn btn-primary btn-sm" style="font-weight: 800; font-size: 12px; padding: 6px 18px; border-radius: 6px; background: #0284c7; border: 1px solid #38bdf8;">
        ✓ Confirm Relocation Now
      </button>
    </div>
  `;
  box.style.display = 'block';

  // Floor change cascades lines
  const floorSel = document.getElementById('quick-relocate-floor');
  const lineSel = document.getElementById('quick-relocate-line');
  if (floorSel && lineSel) {
    floorSel.addEventListener('change', () => {
      const selectedFId = floorSel.value;
      const filteredLines = lines.filter(l => l.floorId === selectedFId);
      lineSel.innerHTML = filteredLines.map(l => `<option value="${l.id}">${escapeHtml(l.name)}</option>`).join('');
    });
  }

  const cancelBtn = document.getElementById('btn-cancel-inline-relocate');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      box.style.display = 'none';
      box.dataset.activeForm = '';
    });
  }

  const saveBtn = document.getElementById('btn-save-inline-relocate');
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const newFloorId = floorSel.value;
      const newLineId = lineSel.value;
      const reason = document.getElementById('quick-relocate-reason')?.value || 'Quick Relocation via Smart Command Hub';

      const targetFloorObj = floors.find(f => f.id === newFloorId);
      const targetLineObj = lines.find(l => l.id === newLineId);

      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';

      try {
        await storage.update(TABLE_NAMES.MACHINES, machine.id, {
          floorId: newFloorId,
          lineId: newLineId,
          floor: targetFloorObj?.name || machine.floor,
          line: targetLineObj?.name || machine.line,
          updatedAt: new Date().toISOString(),
          updatedBy: authService.getCurrentUser()?.id
        });

        // Add history audit record
        const historyTable = storage.getTable(TABLE_NAMES.MACHINE_HISTORY) || [];
        storage.insert(TABLE_NAMES.MACHINE_HISTORY, {
          id: `hist-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          machineId: machine.id,
          serialNumber: machine.serialNumber,
          actionType: 'RELOCATION',
          title: 'Machine Relocated via Smart Quick Action',
          details: `Machine relocated from ${currentFloorStr} (${currentLineStr}) to ${targetFloorObj?.name || 'Floor'} (${targetLineObj?.name || 'Line'}). Reason: ${reason}`,
          performedBy: authService.getCurrentUser()?.id,
          performedByName: authService.getCurrentUser()?.name || 'User',
          previousFloor: currentFloorStr,
          previousLine: currentLineStr,
          newFloor: targetFloorObj?.name || 'Floor',
          newLine: targetLineObj?.name || 'Line',
          reason,
          timestamp: new Date().toISOString()
        });

        playScanBeep('success');
        box.innerHTML = `
          <div style="color: #34d399; font-weight: 800; font-size: 13px; text-align: center; padding: 10px;">
            ✓ Successfully Relocated to ${escapeHtml(targetFloorObj?.name || '')} / ${escapeHtml(targetLineObj?.name || '')}!
          </div>
        `;
        setTimeout(() => {
          closeSmartMachineActionModal();
          // Notify views of machine change
          window.dispatchEvent(new CustomEvent('erp:machine-updated', { detail: { id: machine.id } }));
        }, 1200);

      } catch (err) {
        alert('Relocation failed: ' + (err.message || 'Unknown error'));
        saveBtn.disabled = false;
        saveBtn.textContent = '✓ Confirm Relocation Now';
      }
    });
  }
}

/**
 * In-Modal Quick Breakdown / Repair Logging
 */
function renderInlineQuickServiceForm(machine) {
  const box = document.getElementById('smart-action-subform-box');
  if (!box) return;

  if (box.style.display !== 'none' && box.dataset.activeForm === 'service') {
    box.style.display = 'none';
    box.dataset.activeForm = '';
    return;
  }
  box.dataset.activeForm = 'service';
  box.style.display = 'block';
  setTimeout(() => {
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 50);

  box.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 8px;">
      <div style="font-size: 13px; font-weight: 800; color: #f87171; display: flex; align-items: center; gap: 6px;">
        <span>🛠️</span> Quick Service / Repair Entry
      </div>
      <button type="button" id="btn-cancel-inline-service" class="btn btn-ghost btn-xs" style="color: #94a3b8;">Cancel</button>
    </div>

    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 12px;">
      <div>
        <label style="font-size: 11px; font-weight: 700; color: #94a3b8; display: block; margin-bottom: 4px;">Defect Category</label>
        <select id="quick-service-category" class="form-control" style="width: 100%; height: 34px; font-size: 12px; font-weight: 700; background: #0b1120; border: 1px solid rgba(248,113,113,0.4); border-radius: 6px; color: #fff; padding: 0 8px;">
          <option value="MECHANICAL">Mechanical / Timing / Jam</option>
          <option value="ELECTRICAL">Electrical / Motor / Sensor</option>
          <option value="NEEDLE_LOOPER">Needle / Thread / Looper Breakage</option>
          <option value="PNEUMATIC">Pneumatic / Air Pressure</option>
          <option value="ELECTRONICS">Electronic Circuit Board (ET-Lab)</option>
          <option value="ROUTINE">Routine Servicing / Oil Change</option>
        </select>
      </div>

      <div>
        <label style="font-size: 11px; font-weight: 700; color: #94a3b8; display: block; margin-bottom: 4px;">Service Resolution Status</label>
        <select id="quick-service-status" class="form-control" style="width: 100%; height: 34px; font-size: 12px; font-weight: 700; background: #0b1120; border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; color: #fff; padding: 0 8px;">
          <option value="RESOLVED">Repaired &amp; Restored to Active</option>
          <option value="IN_PROGRESS">Work In Progress (Keep Under Maintenance)</option>
        </select>
      </div>
    </div>

    <div style="margin-bottom: 12px;">
      <label style="font-size: 11px; font-weight: 700; color: #94a3b8; display: block; margin-bottom: 4px;">Repair Action Description / Spare Parts Used</label>
      <input type="text" id="quick-service-notes" class="form-control" placeholder="e.g. Adjusted timing, replaced bobbin case and tension spring" style="width: 100%; height: 32px; font-size: 12px; background: #0b1120; border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; color: #fff; padding: 0 10px;" />
    </div>

    <div style="display: flex; justify-content: flex-end; gap: 8px;">
      <button type="button" id="btn-save-inline-service" class="btn btn-primary btn-sm" style="font-weight: 800; font-size: 12px; padding: 6px 18px; border-radius: 6px; background: #dc2626; border: 1px solid #f87171;">
        ✓ Log Repair Record
      </button>
    </div>
  `;
  box.style.display = 'block';

  const cancelBtn = document.getElementById('btn-cancel-inline-service');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      box.style.display = 'none';
      box.dataset.activeForm = '';
    });
  }

  const saveBtn = document.getElementById('btn-save-inline-service');
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const category = document.getElementById('quick-service-category')?.value || 'MECHANICAL';
      const resolution = document.getElementById('quick-service-status')?.value || 'RESOLVED';
      const notes = document.getElementById('quick-service-notes')?.value || 'Quick Repair via Smart Hub';

      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';

      try {
        const todayStr = new Date().toISOString().split('T')[0];
        const newStatus = resolution === 'RESOLVED' ? 'ACTIVE' : 'UNDER_MAINTENANCE';

        // Update Machine
        await storage.update(TABLE_NAMES.MACHINES, machine.id, {
          status: newStatus,
          lastServicingDate: todayStr,
          updatedAt: new Date().toISOString(),
          updatedBy: authService.getCurrentUser()?.id
        });

        // Log Service Record
        const serviceTable = storage.getTable(TABLE_NAMES.MACHINE_HISTORY) || [];
        storage.insert(TABLE_NAMES.MACHINE_HISTORY, {
          id: `hist-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          machineId: machine.id,
          serialNumber: machine.serialNumber,
          actionType: 'SERVICE_REPAIR',
          title: `Repair Logged: ${category}`,
          details: `Service performed: ${category}. Resolution: ${resolution}. Notes: ${notes}`,
          performedBy: authService.getCurrentUser()?.id,
          performedByName: authService.getCurrentUser()?.name || 'Mechanic',
          category,
          resolution,
          notes,
          servicingDate: todayStr,
          timestamp: new Date().toISOString()
        });

        playScanBeep('success');
        box.innerHTML = `
          <div style="color: #34d399; font-weight: 800; font-size: 13px; text-align: center; padding: 10px;">
            ✓ Repair Logged Successfully! Machine is now ${newStatus}.
          </div>
        `;
        setTimeout(() => {
          closeSmartMachineActionModal();
          window.dispatchEvent(new CustomEvent('erp:machine-updated', { detail: { id: machine.id } }));
        }, 1200);

      } catch (err) {
        alert('Service record failed: ' + (err.message || 'Unknown error'));
        saveBtn.disabled = false;
        saveBtn.textContent = '✓ Log Repair Record';
      }
    });
  }
}

/**
 * Fallback dialog when searched code does not exist
 */
function showNotFoundActionDialog(query) {
  const notFoundHtml = `
    <div id="smart-action-modal-overlay" class="modal-overlay" style="z-index: 10070; background: rgba(0, 0, 0, 0.88); backdrop-filter: blur(10px); display: flex; align-items: center; justify-content: center; padding: 12px;">
      <div style="background: #0f172a; border: 1.5px solid #ef4444; border-radius: 16px; width: 100%; max-width: 440px; padding: 24px; text-align: center; box-shadow: 0 25px 60px -15px rgba(0,0,0,0.95);">
        <div style="font-size: 40px; margin-bottom: 10px;">🔍⚠️</div>
        <h3 style="margin: 0; font-size: 16px; font-weight: 800; color: #fff;">Machine Not Found</h3>
        <p style="font-size: 12.5px; color: #94a3b8; margin: 10px 0 18px; line-height: 1.5;">
          No registered machine matched your search:
          <br>
          <code style="color: #f87171; background: rgba(239,68,68,0.15); padding: 3px 8px; border-radius: 4px; font-size: 13px; font-weight: 700; word-break: break-all; margin-top: 6px; display: inline-block;">
            ${escapeHtml(String(query || ''))}
          </code>
        </p>
        <button id="btn-close-not-found-smart" class="btn btn-primary btn-sm" style="padding: 6px 20px; font-weight: 700;">
          Close
        </button>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', replaceEmojiInHtml(notFoundHtml));
  const closeBtn = document.getElementById('btn-close-not-found-smart');
  if (closeBtn) closeBtn.addEventListener('click', () => closeSmartMachineActionModal());
  const overlay = document.getElementById('smart-action-modal-overlay');
  if (overlay) overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeSmartMachineActionModal();
  });
}

/**
 * Closes the Smart Machine Action Hub Modal
 */
export function closeSmartMachineActionModal() {
  const existing = document.getElementById('smart-action-modal-overlay');
  if (existing) {
    existing.remove();
  }
}

// Global attachment for seamless invocation
if (typeof window !== 'undefined') {
  window.openSmartMachineActionModal = openSmartMachineActionModal;
  window.searchMachinesWithScope = searchMachinesWithScope;
  window.getMachineDisplayId = getMachineDisplayId;
  window.getMachineAssetId = getMachineAssetId;
  window.openQuickFeaturesHub = openQuickFeaturesHub;
  window.closeQuickFeaturesHub = closeQuickFeaturesHub;
}

/**
 * ⚡ Quick Features Hub • কুইক ফিচার হাব
 * 1-Click Operations HUD with Scoped Servicing KPIs, Fast Relocation / Transfer,
 * and Live Instant Machine Search.
 */
export function openQuickFeaturesHub() {
  closeQuickFeaturesHub();
  closeSmartMachineActionModal();

  const currentUser = authService.getCurrentUser() || { name: 'Staff', role: 'OPERATOR' };
  const isSuperAdmin = authService.isSuperAdmin(currentUser);
  const isAdmin = authService.isAdmin(currentUser);

  const machines = storage.getTable(TABLE_NAMES.MACHINES) || [];
  const pms = storage.getTable(TABLE_NAMES.PREVENTIVE_MAINTENANCE) || [];
  const transferRequests = storage.getTable(TABLE_NAMES.TRANSFER_REQUESTS) || [];

  // Scoped Machines
  const scopedMachines = machines.filter(m => {
    if (isSuperAdmin) return true;
    return authService.canOperateMachine(m, currentUser) || !authService.isMachineViewOnlyForUser(m, currentUser, true);
  });

  const machineIdSet = new Set(scopedMachines.map(m => m.id));
  const serialSet = new Set(scopedMachines.map(m => (m.serialNumber || '').toLowerCase()));

  // Dates
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const d7 = new Date(); d7.setDate(now.getDate() - 7);
  const d7Str = d7.toISOString().split('T')[0];
  const d30 = new Date(); d30.setDate(now.getDate() - 30);
  const d30Str = d30.toISOString().split('T')[0];

  // Scoped PM Records
  const scopedPms = pms.filter(p => {
    if (isSuperAdmin) return true;
    if (p.machineId && machineIdSet.has(p.machineId)) return true;
    if (p.serialNumber && serialSet.has(p.serialNumber.toLowerCase())) return true;
    return false;
  });

  // KPI 1: Serviced Last 7 Days & 30 Days
  const servicedLast7 = scopedPms.filter(p => {
    const sDate = p.serviceDate || (p.createdAt ? p.createdAt.split('T')[0] : '');
    return sDate >= d7Str && (p.serviceStatus === 'COMPLETED' || p.status === 'COMPLETED');
  });
  const servicedLast30 = scopedPms.filter(p => {
    const sDate = p.serviceDate || (p.createdAt ? p.createdAt.split('T')[0] : '');
    return sDate >= d30Str && (p.serviceStatus === 'COMPLETED' || p.status === 'COMPLETED');
  });

  // KPI 2: Service Due & Overdue
  const dueItems = [];
  const overdueItems = [];
  const processedSerials = new Set();

  scopedPms.forEach(p => {
    const s = (p.serialNumber || '').toLowerCase();
    if (!s || processedSerials.has(s)) return;
    const nextDate = p.nextServiceDate;
    if (p.serviceStatus === 'OVERDUE' || (nextDate && nextDate < todayStr && p.serviceStatus !== 'COMPLETED')) {
      processedSerials.add(s);
      overdueItems.push(p);
    } else if (p.serviceStatus === 'DUE' || (nextDate && nextDate <= todayStr && p.serviceStatus !== 'COMPLETED')) {
      processedSerials.add(s);
      dueItems.push(p);
    }
  });

  // Also check machines
  scopedMachines.forEach(m => {
    const s = (m.serialNumber || '').toLowerCase();
    if (!s || processedSerials.has(s)) return;
    const nextDate = m.nextServiceDate || m.nextPmDate || m.pmDueDate;
    if (nextDate) {
      if (nextDate < todayStr) {
        processedSerials.add(s);
        overdueItems.push(m);
      } else if (nextDate <= todayStr) {
        processedSerials.add(s);
        dueItems.push(m);
      }
    }
  });

  // Pending Transfers in scope
  const pendingTransfers = transferRequests.filter(r => {
    if (r.status !== 'PENDING' && r.status !== 'IN_PROGRESS') return false;
    if (isSuperAdmin) return true;
    const isOwner = r.requestedBy === currentUser.name || r.requestedBy === currentUser.username || r.userId === currentUser.id;
    if (isOwner) return true;
    return false;
  });

  // User scope description
  let scopeLabel = 'All Factory Units (Super Admin)';
  if (!isSuperAdmin) {
    const parts = [];
    if (currentUser.assignedUnit || currentUser.unit) parts.push(currentUser.assignedUnit || currentUser.unit);
    if (currentUser.assignedFloor || currentUser.floor) parts.push(currentUser.assignedFloor || currentUser.floor);
    if (currentUser.assignedLine || currentUser.line) parts.push(currentUser.assignedLine || currentUser.line);
    scopeLabel = parts.length > 0 ? parts.join(' • ') : 'Restricted Assigned Floor';
  }

  const modalHtml = `
    <div id="quick-features-modal-overlay" class="modal-overlay" style="z-index: 10080; background: rgba(5, 10, 20, 0.88); backdrop-filter: blur(12px); display: flex; align-items: center; justify-content: center; padding: 12px; position: fixed; inset: 0;">
      <div class="quick-features-container custom-scrollbar" style="background: #0b1329; border: 1.5px solid rgba(56, 189, 248, 0.35); border-radius: 18px; width: 100%; max-width: 820px; max-height: 90vh; overflow-y: auto; padding: 22px; box-shadow: 0 25px 60px -15px rgba(0,0,0,0.95); color: #f8fafc; font-family: var(--font-main);">
        
        <!-- Header -->
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(56, 189, 248, 0.15); padding-bottom: 14px; margin-bottom: 16px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 22px; line-height: 1;">⚡</span>
              <h2 style="margin: 0; font-size: 18px; font-weight: 800; color: #fff; letter-spacing: -0.2px;">Quick Features Hub • কুইক ফিচার হাব</h2>
              <span style="background: rgba(2, 132, 199, 0.2); border: 1px solid rgba(56, 189, 248, 0.4); color: #38bdf8; font-size: 11px; font-weight: 700; padding: 2px 7px; border-radius: 6px;">Live Scope</span>
            </div>
            <p style="margin: 4px 0 0; font-size: 12px; color: #94a3b8;">
              👤 <b>${escapeHtml(currentUser.name)}</b> (${escapeHtml(currentUser.presetName || currentUser.role)}) &nbsp;|&nbsp; 📍 <i>${escapeHtml(scopeLabel)}</i>
            </p>
          </div>
          <button id="btn-close-quick-features" class="btn btn-secondary btn-xs" style="border-radius: 8px; width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; color: #94a3b8; font-size: 16px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); cursor: pointer;" title="Close (Esc)">
            ✕
          </button>
        </div>

        <!-- Scoped KPI Cards (Clickable) -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; margin-bottom: 18px;">
          <div class="qf-kpi-card" id="qf-kpi-serviced" style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-left: 3.5px solid #10b981; border-radius: 10px; padding: 10px 12px; cursor: pointer; transition: all 0.2s;">
            <div style="font-size: 10.5px; font-weight: 700; color: #6ee7b7; text-transform: uppercase; letter-spacing: 0.3px; display: flex; align-items: center; justify-content: space-between;">
              <span>🛠️ Serviced (${servicedLast7.length} in 7d)</span>
              <span id="qf-toggle-serviced-days" style="text-decoration: underline; font-size: 9.5px; opacity: 0.85;" title="Click to view 30 days">30d: ${servicedLast30.length}</span>
            </div>
            <div style="font-size: 22px; font-weight: 800; color: #34d399; font-family: var(--font-mono); margin-top: 3px;" id="qf-val-serviced">${servicedLast7.length}</div>
            <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">মেশিন গত ৭ দিনে সার্ভিসিং সম্পন্ন</div>
          </div>

          <div class="qf-kpi-card" id="qf-kpi-due" style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-left: 3.5px solid #f59e0b; border-radius: 10px; padding: 10px 12px; cursor: pointer; transition: all 0.2s;">
            <div style="font-size: 10.5px; font-weight: 700; color: #fcd34d; text-transform: uppercase; letter-spacing: 0.3px;">⏰ Due Today / Schedule</div>
            <div style="font-size: 22px; font-weight: 800; color: #fbbf24; font-family: var(--font-mono); margin-top: 3px;">${dueItems.length}</div>
            <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">আজ বা শিডিউলে ডিউ থাকা সার্ভিস</div>
          </div>

          <div class="qf-kpi-card" id="qf-kpi-overdue" style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-left: 3.5px solid #ef4444; border-radius: 10px; padding: 10px 12px; cursor: pointer; transition: all 0.2s;">
            <div style="font-size: 10.5px; font-weight: 700; color: #fca5a5; text-transform: uppercase; letter-spacing: 0.3px;">🔴 Overdue Alert</div>
            <div style="font-size: 22px; font-weight: 800; color: #f87171; font-family: var(--font-mono); margin-top: 3px;">${overdueItems.length}</div>
            <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">জরুরি ওভারডিউ সার্ভিসিং প্রয়োজন</div>
          </div>

          <div class="qf-kpi-card" id="qf-kpi-transfers" style="background: rgba(139, 92, 246, 0.1); border: 1px solid rgba(139, 92, 246, 0.3); border-left: 3.5px solid #8b5cf6; border-radius: 10px; padding: 10px 12px; cursor: pointer; transition: all 0.2s;">
            <div style="font-size: 10.5px; font-weight: 700; color: #c4b5fd; text-transform: uppercase; letter-spacing: 0.3px;">🚚 Pending Transfers</div>
            <div style="font-size: 22px; font-weight: 800; color: #a78bfa; font-family: var(--font-mono); margin-top: 3px;">${pendingTransfers.length}</div>
            <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">চলমান স্থানান্তর গেটপাস রিকোয়েস্ট</div>
          </div>
        </div>

        <!-- 1-Click Operations Launcher Grid -->
        <div style="margin-bottom: 18px;">
          <div style="font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
            ⚡ 1-Click Fast Actions (এক ক্লিকে মূল ফিচারসমূহ)
          </div>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 8px;">
            <button id="btn-qf-action-transfer" class="btn" style="background: rgba(14, 165, 233, 0.12); border: 1px solid rgba(56, 189, 248, 0.3); color: #38bdf8; padding: 10px 12px; border-radius: 10px; font-size: 12.5px; font-weight: 700; display: flex; align-items: center; gap: 8px; text-align: left; cursor: pointer;">
              <span style="font-size: 18px;">🚚</span>
              <div>
                <div>Request Transfer</div>
                <div style="font-size: 10px; font-weight: 500; color: #7dd3fc;">স্থানান্তর রিকোয়েস্ট পাঠান</div>
              </div>
            </button>

            <button id="btn-qf-action-service" class="btn" style="background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.3); color: #34d399; padding: 10px 12px; border-radius: 10px; font-size: 12.5px; font-weight: 700; display: flex; align-items: center; gap: 8px; text-align: left; cursor: pointer;">
              <span style="font-size: 18px;">🛠️</span>
              <div>
                <div>Quick Service Entry</div>
                <div style="font-size: 10px; font-weight: 500; color: #86efac;">সার্ভিস ও স্টিকার এন্ট্রি</div>
              </div>
            </button>

            <button id="btn-qf-action-breakdown" class="btn" style="background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.3); color: #f87171; padding: 10px 12px; border-radius: 10px; font-size: 12.5px; font-weight: 700; display: flex; align-items: center; gap: 8px; text-align: left; cursor: pointer;">
              <span style="font-size: 18px;">🚨</span>
              <div>
                <div>Report Breakdown</div>
                <div style="font-size: 10px; font-weight: 500; color: #fca5a5;">জরুরি ব্রেকডাউন নোটিশ</div>
              </div>
            </button>

            <button id="btn-qf-action-pm" class="btn" style="background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.3); color: #fbbf24; padding: 10px 12px; border-radius: 10px; font-size: 12.5px; font-weight: 700; display: flex; align-items: center; gap: 8px; text-align: left; cursor: pointer;">
              <span style="font-size: 18px;">📋</span>
              <div>
                <div>PM Hub & Checklist</div>
                <div style="font-size: 10px; font-weight: 500; color: #fde68a;">প্রিভেন্টিভ মেইনটেন্যান্স</div>
              </div>
            </button>

            <button id="btn-qf-action-relocate" class="btn" style="background: rgba(168, 85, 247, 0.12); border: 1px solid rgba(168, 85, 247, 0.3); color: #c084fc; padding: 10px 12px; border-radius: 10px; font-size: 12.5px; font-weight: 700; display: flex; align-items: center; gap: 8px; text-align: left; cursor: pointer;">
              <span style="font-size: 18px;">🔄</span>
              <div>
                <div>Relocate & Verify</div>
                <div style="font-size: 10px; font-weight: 500; color: #d8b4fe;">লোকেশন ভেরিফিকেশন হাব</div>
              </div>
            </button>

            <button id="btn-qf-action-qr" class="btn" style="background: rgba(56, 189, 248, 0.12); border: 1px solid rgba(56, 189, 248, 0.3); color: #38bdf8; padding: 10px 12px; border-radius: 10px; font-size: 12.5px; font-weight: 700; display: flex; align-items: center; gap: 8px; text-align: left; cursor: pointer;">
              <span style="font-size: 18px;">📷</span>
              <div>
                <div>QR / Barcode Scanner</div>
                <div style="font-size: 10px; font-weight: 500; color: #7dd3fc;">ক্যামেরা দিয়ে স্ক্যান</div>
              </div>
            </button>
          </div>
        </div>

        <!-- Integrated Fast Machine Finder Input -->
        <div style="border-top: 1px solid rgba(56, 189, 248, 0.15); padding-top: 14px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <label for="inp-qf-search" style="font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px;">
              🔍 Instant Machine Finder (মেশিন সার্চ ও লাইভ স্ট্যাটাস)
            </label>
            <span style="font-size: 11px; color: #38bdf8;">${scopedMachines.length} machines in scope</span>
          </div>
          <div style="position: relative;">
            <input 
              type="text" 
              id="inp-qf-search" 
              placeholder="Type Serial (e.g. D/N-A-92), Model (LK-1900), Asset ID, Line or Name..." 
              autocomplete="off"
              style="width: 100%; background: #070d1e; border: 1.5px solid rgba(56, 189, 248, 0.3); border-radius: 10px; padding: 10px 14px 10px 38px; color: #fff; font-size: 13.5px; font-weight: 600; outline: none; transition: border-color 0.2s;"
            />
            <span style="position: absolute; left: 12px; top: 11px; font-size: 14px; pointer-events: none; color: #38bdf8;">🔍</span>
          </div>

          <!-- Dynamic Results Container -->
          <div id="qf-search-results-list" class="custom-scrollbar" style="margin-top: 10px; max-height: 250px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px;">
            <div style="text-align: center; padding: 18px; color: #64748b; font-size: 12px;">
              উপরে সার্চ বক্সে মেশিনের সিরিয়াল নম্বর, মডেল বা লাইন লিখে সরাসরি এক ক্লিকে কাজ করুন।
            </div>
          </div>
        </div>

      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', replaceEmojiInHtml(modalHtml));

  const overlay = document.getElementById('quick-features-modal-overlay');
  const closeBtn = document.getElementById('btn-close-quick-features');
  const searchInput = document.getElementById('inp-qf-search');
  const resultsList = document.getElementById('qf-search-results-list');

  // Focus search
  if (searchInput) {
    setTimeout(() => searchInput.focus(), 80);
  }

  // Close handlers
  if (closeBtn) closeBtn.addEventListener('click', closeQuickFeaturesHub);
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeQuickFeaturesHub();
    });
  }

  const handleEsc = (e) => {
    if (e.key === 'Escape') {
      closeQuickFeaturesHub();
      window.removeEventListener('keydown', handleEsc);
    }
  };
  window.addEventListener('keydown', handleEsc);

  // 1-Click Action Handlers
  document.getElementById('btn-qf-action-transfer')?.addEventListener('click', () => {
    closeQuickFeaturesHub();
    router.navigate('transfers');
    state.set('currentView', 'transfers');
  });

  document.getElementById('btn-qf-action-service')?.addEventListener('click', () => {
    closeQuickFeaturesHub();
    router.navigate('preventive_maintenance');
    state.set('currentView', 'preventive_maintenance');
  });

  document.getElementById('btn-qf-action-breakdown')?.addEventListener('click', () => {
    if (searchInput) {
      searchInput.value = '';
      searchInput.placeholder = 'Type Serial of breakdown machine...';
      searchInput.focus();
    }
  });

  document.getElementById('btn-qf-action-pm')?.addEventListener('click', () => {
    closeQuickFeaturesHub();
    router.navigate('preventive_maintenance');
    state.set('currentView', 'preventive_maintenance');
  });

  document.getElementById('btn-qf-action-relocate')?.addEventListener('click', () => {
    closeQuickFeaturesHub();
    router.navigate('relocate_verify');
    state.set('currentView', 'relocate_verify');
  });

  document.getElementById('btn-qf-action-qr')?.addEventListener('click', () => {
    closeQuickFeaturesHub();
    if (typeof window.triggerGlobalQuickScanner === 'function') {
      window.triggerGlobalQuickScanner();
    }
  });

  // KPI Click Filters
  document.getElementById('qf-kpi-serviced')?.addEventListener('click', () => {
    renderFilteredMachineList(servicedLast7.map(p => ({
      serialNumber: p.serialNumber,
      machineName: p.machineName,
      line: p.line,
      floor: p.floor,
      status: 'SERVICED',
      badge: '🟢 SERVICED (7D)',
      notes: p.serviceRemarks || `Serviced: ${p.serviceDate}`
    })));
  });

  document.getElementById('qf-kpi-due')?.addEventListener('click', () => {
    renderFilteredMachineList(dueItems.map(p => ({
      serialNumber: p.serialNumber,
      machineName: p.machineName || p.name,
      line: p.line,
      floor: p.floor,
      status: 'DUE',
      badge: '🟡 SERVICE DUE',
      notes: `Next: ${p.nextServiceDate || todayStr}`
    })));
  });

  document.getElementById('qf-kpi-overdue')?.addEventListener('click', () => {
    renderFilteredMachineList(overdueItems.map(p => ({
      serialNumber: p.serialNumber,
      machineName: p.machineName || p.name,
      line: p.line,
      floor: p.floor,
      status: 'OVERDUE',
      badge: '🔴 OVERDUE ALERT',
      notes: `Due was: ${p.nextServiceDate || 'Past date'}`
    })));
  });

  document.getElementById('qf-kpi-transfers')?.addEventListener('click', () => {
    closeQuickFeaturesHub();
    router.navigate('transfers');
    state.set('currentView', 'transfers');
  });

  function renderFilteredMachineList(items) {
    if (!resultsList) return;
    if (items.length === 0) {
      resultsList.innerHTML = `<div style="text-align: center; padding: 14px; color: #94a3b8; font-size: 12px;">কোনো রেকর্ড পাওয়া যায়নি।</div>`;
      return;
    }
    resultsList.innerHTML = items.slice(0, 15).map(item => `
      <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 8px 12px;">
        <div>
          <div style="font-weight: 700; font-size: 13px; color: #fff;">
            ${escapeHtml(item.machineName || 'Machine')} 
            <code style="color: #38bdf8; background: rgba(56,189,248,0.12); padding: 1px 5px; border-radius: 4px; font-size: 11.5px; font-weight: 700;">${escapeHtml(item.serialNumber || '—')}</code>
          </div>
          <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">
            Floor: ${escapeHtml(item.floor || '—')}, Line: <b>${escapeHtml(item.line || '—')}</b> &nbsp;|&nbsp; <i>${escapeHtml(item.notes || '')}</i>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 6px;">
          <span style="font-size: 11px; font-weight: 700; padding: 3px 7px; border-radius: 5px; ${item.badge.includes('🔴') ? 'background: rgba(239,68,68,0.2); color: #f87171;' : (item.badge.includes('🟡') ? 'background: rgba(245,158,11,0.2); color: #fbbf24;' : 'background: rgba(16,185,129,0.2); color: #34d399;')}">
            ${item.badge}
          </span>
          <button class="btn btn-xs btn-primary qf-btn-inspect" data-serial="${escapeHtml(item.serialNumber || '')}" style="font-size: 11px; padding: 3px 8px;">Action</button>
        </div>
      </div>
    `).join('');

    resultsList.querySelectorAll('.qf-btn-inspect').forEach(btn => {
      btn.addEventListener('click', () => {
        const serial = btn.getAttribute('data-serial');
        if (serial) {
          closeQuickFeaturesHub();
          openSmartMachineActionModal(serial);
        }
      });
    });
  }

  // Live Instant Machine Search Handler
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const q = searchInput.value.trim().toLowerCase();
      if (!q) {
        resultsList.innerHTML = `<div style="text-align: center; padding: 18px; color: #64748b; font-size: 12px;">উপরে সার্চ বক্সে মেশিনের সিরিয়াল নম্বর, মডেল বা লাইন লিখে সরাসরি এক ক্লিকে কাজ করুন।</div>`;
        return;
      }

      const matches = scopedMachines.filter(m => {
        const sn = (m.serialNumber || '').toLowerCase();
        const mn = (m.machineName || m.name || '').toLowerCase();
        const mod = (m.model || '').toLowerCase();
        const ln = (m.line || '').toLowerCase();
        const id = (m.systemAssetId || m.permanentMachineId || '').toLowerCase();
        return sn.includes(q) || mn.includes(q) || mod.includes(q) || ln.includes(q) || id.includes(q);
      }).slice(0, 10);

      if (matches.length === 0) {
        resultsList.innerHTML = `<div style="text-align: center; padding: 16px; color: #f87171; font-size: 12px;">❌ '<code>${escapeHtml(q)}</code>' দিয়ে আপনার অ্যাক্সেস এরিয়ায় কোনো মেশিন পাওয়া যায়নি।</div>`;
        return;
      }

      resultsList.innerHTML = matches.map(m => {
        const status = (m.status || 'ACTIVE').toUpperCase();
        const isRunning = m.running || status === 'RUNNING';
        const isMaint = status.includes('MAINT') || status.includes('BREAKDOWN');
        const isAmb = m.isAmbulance;

        let badge = '🟢 RUNNING';
        let badgeStyle = 'background: rgba(16,185,129,0.2); color: #34d399;';
        if (isMaint) {
          badge = '🔴 BREAKDOWN';
          badgeStyle = 'background: rgba(239,68,68,0.2); color: #f87171;';
        } else if (isAmb) {
          badge = '🚑 AMBULANCE';
          badgeStyle = 'background: rgba(168,85,247,0.2); color: #c084fc;';
        } else if (!isRunning) {
          badge = '🟡 USABLE / IDLE';
          badgeStyle = 'background: rgba(245,158,11,0.2); color: #fbbf24;';
        }

        return `
          <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 8px 12px;">
            <div>
              <div style="font-weight: 700; font-size: 13px; color: #fff;">
                ${escapeHtml(m.machineName || m.name || 'Machine')} 
                <code style="color: #38bdf8; background: rgba(56,189,248,0.12); padding: 1px 5px; border-radius: 4px; font-size: 11.5px; font-weight: 700;">${escapeHtml(m.serialNumber || '—')}</code>
              </div>
              <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">
                Model: <b>${escapeHtml(m.model || '—')}</b> &nbsp;|&nbsp; Line: <b>${escapeHtml(m.line || '—')}</b>, Floor: ${escapeHtml(m.floor || '—')}
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 11px; font-weight: 700; padding: 3px 7px; border-radius: 5px; ${badgeStyle}">
                ${badge}
              </span>
              <button class="btn btn-xs btn-primary qf-btn-inspect" data-serial="${escapeHtml(m.serialNumber || '')}" style="font-size: 11px; padding: 3px 8px;">Quick Action</button>
            </div>
          </div>
        `;
      }).join('');

      resultsList.querySelectorAll('.qf-btn-inspect').forEach(btn => {
        btn.addEventListener('click', () => {
          const serial = btn.getAttribute('data-serial');
          if (serial) {
            closeQuickFeaturesHub();
            openSmartMachineActionModal(serial);
          }
        });
      });
    });
  }
}

/**
 * Closes the Quick Features Hub Modal
 */
export function closeQuickFeaturesHub() {
  const existing = document.getElementById('quick-features-modal-overlay');
  if (existing) existing.remove();
}

