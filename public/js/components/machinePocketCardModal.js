/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Offline Machine Pocket Card Component
 * Instantaneous, Zero-Internet Local HUD Profile for Factory Floor Operators
 */

import { storage } from '../db/storage.js?v=4.46.1';
import { TABLE_NAMES } from '../db/schema.js?v=4.46.1';
import { authService } from '../services/authService.js?v=4.46.1';
import { router } from '../services/router.js?v=4.46.1';
import { state } from '../state.js?v=4.46.1';
import { icon, replaceEmojiInHtml } from './icons.js?v=4.47.0';

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
 * Resolves the official, clean Machine Asset ID (e.g. AMG-MNT-005551)
 */
export function getMachineAssetId(machine) {
  if (!machine) return '';
  let assetId = machine.systemAssetId;
  if (assetId && /^MID-/i.test(assetId)) {
    assetId = assetId.replace(/^MID-/i, 'AMG-MNT-');
  }
  if (!assetId && machine.permanentMachineId) {
    assetId = String(machine.permanentMachineId).trim().replace(/^MID-/i, 'AMG-MNT-');
  }
  if (!assetId && machine.machineAssetCode) {
    assetId = String(machine.machineAssetCode).trim();
  }
  if (!assetId && machine.sl) {
    assetId = `AMG-MNT-${String(machine.sl).padStart(6, '0')}`;
  }
  if (!assetId && machine.serialNumber) {
    const numOnly = String(machine.serialNumber).replace(/[^0-9]/g, '');
    if (numOnly) {
      assetId = `AMG-MNT-${numOnly.padStart(6, '0')}`;
    }
  }
  return assetId || '';
}

/**
 * Robust machine resolution by Asset ID, Machine Number, Serial Number, Barcode, or QR text
 */
export function findMachineByQuery(query) {
  if (!query) return null;
  const cleanQ = String(query).trim();
  const lowerQ = cleanQ.toLowerCase();
  const machines = storage.getTable(TABLE_NAMES.MACHINES) || [];

  // 1. Check if query is JSON
  if (cleanQ.startsWith('{') && cleanQ.endsWith('}')) {
    try {
      const parsed = JSON.parse(cleanQ);
      if (parsed.id) {
        const m = machines.find(x => x.id === parsed.id);
        if (m) return m;
      }
      if (parsed.machineId) {
        const m = machines.find(x => x.machineId?.toLowerCase() === String(parsed.machineId).toLowerCase());
        if (m) return m;
      }
      if (parsed.systemAssetId || parsed.permanentMachineId) {
        const target = String(parsed.systemAssetId || parsed.permanentMachineId).toLowerCase();
        const m = machines.find(x => (x.systemAssetId && x.systemAssetId.toLowerCase() === target) || (x.permanentMachineId && x.permanentMachineId.toLowerCase() === target));
        if (m) return m;
      }
    } catch (_) {}
  }

  // 2. Check if URL containing ID or machineId or assetId
  if (lowerQ.includes('#') || lowerQ.includes('?') || lowerQ.includes('/')) {
    const match = lowerQ.match(/[?&#](?:id|machineid|assetid)=([a-z0-9\-]+)/i);
    if (match && match[1]) {
      const m = machines.find(x => 
        x.id === match[1] || 
        x.machineId?.toLowerCase() === match[1].toLowerCase() ||
        x.systemAssetId?.toLowerCase() === match[1].toLowerCase() ||
        x.permanentMachineId?.toLowerCase() === match[1].toLowerCase()
      );
      if (m) return m;
    }
  }

  // Handle standard ERP QR format: AL-MUSLIM-ERP://MC/{payload}
  let queryText = lowerQ;
  if (queryText.includes('://mc/')) {
    queryText = queryText.split('://mc/')[1].trim();
  }

  // 3. Exact System Asset ID or Permanent Machine ID match (e.g. AMG-MNT-005551 or MID-005551)
  let found = machines.find(m => 
    (m.systemAssetId && m.systemAssetId.toLowerCase() === queryText) ||
    (m.permanentMachineId && m.permanentMachineId.toLowerCase() === queryText) ||
    (m.systemAssetId && m.systemAssetId.replace(/^mid-/i, 'amg-mnt-').toLowerCase() === queryText) ||
    (m.permanentMachineId && m.permanentMachineId.replace(/^mid-/i, 'amg-mnt-').toLowerCase() === queryText)
  );
  if (found) return found;

  // Numeric asset sequence match (e.g. searching '5551' -> matches 'AMG-MNT-005551')
  if (/^\d+$/.test(queryText)) {
    const padded = queryText.padStart(6, '0');
    found = machines.find(m => 
      (m.systemAssetId && m.systemAssetId.includes(padded)) ||
      (m.permanentMachineId && m.permanentMachineId.includes(padded)) ||
      (m.sl && String(m.sl) === queryText)
    );
    if (found) return found;
  }

  // 4. Exact Machine Asset Code match (e.g. MC-095)
  found = machines.find(m => m.machineAssetCode?.toLowerCase() === queryText);
  if (found) return found;

  // 5. Exact Serial Number match
  found = machines.find(m => m.serialNumber?.toLowerCase() === queryText);
  if (found) return found;

  // 6. Barcode match
  found = machines.find(m => m.barcode?.toLowerCase() === queryText);
  if (found) return found;

  // 7. Exact ID match
  found = machines.find(m => m.id === cleanQ || m.id?.toLowerCase() === queryText);
  if (found) return found;

  // 8. Exact Machine Number (machineId) match
  found = machines.find(m => m.machineId?.toLowerCase() === queryText);
  if (found) return found;

  // 9. Case-insensitive substring match on Machine Number
  found = machines.find(m => m.machineId && m.machineId.toLowerCase().includes(queryText));
  if (found) return found;

  // 10. Case-insensitive substring match on Serial Number
  found = machines.find(m => m.serialNumber && m.serialNumber.toLowerCase().includes(queryText));
  if (found) return found;

  return null;
}

/**
 * Opens the Instant Machine Pocket Card Modal
 */
export function openMachinePocketCard(machineOrQuery) {
  let machine = null;
  if (typeof machineOrQuery === 'object' && machineOrQuery !== null) {
    machine = machineOrQuery;
  } else if (machineOrQuery) {
    machine = storage.getItem(TABLE_NAMES.MACHINES, machineOrQuery) || findMachineByQuery(machineOrQuery);
  }

  // Remove existing modal if open
  closeMachinePocketCard();

  if (!machine) {
    showNotFoundPocketCard(machineOrQuery);
    return;
  }

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
  const floorName = floorObj?.name || machine.floor || machine.floorName || 'Unassigned';
  const lineName = lineObj?.name || machine.line || machine.lineName || 'Unassigned';
  const machineName = nameObj?.name || machine.machineName || machine.name || 'Industrial Machine';
  const brandName = brandObj?.name || machine.brand || machine.brandName || 'Standard';
  const modelName = modelObj?.name || machine.model || machine.modelName || 'Standard Model';

  const isOnline = navigator.onLine !== false;
  const status = (machine.status || 'ACTIVE').toUpperCase();

  let statusBadgeStyle = 'background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4);';
  let statusIcon = '🟢';
  let statusText = 'Active / Operational';

  if (status.includes('MAINT') || status.includes('BREAKDOWN') || status.includes('REPAIR')) {
    statusBadgeStyle = 'background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4);';
    statusIcon = '🔴';
    statusText = 'Under Breakdown / Maintenance';
  } else if (status.includes('IDLE') || status.includes('STORAGE') || status.includes('RELOCAT')) {
    statusBadgeStyle = 'background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4);';
    statusIcon = '🟡';
    statusText = 'Idle / In Transit / Storage';
  } else if (status.includes('SCRAP') || status.includes('DISPOSE')) {
    statusBadgeStyle = 'background: rgba(100, 116, 139, 0.2); color: #94a3b8; border: 1px solid rgba(100, 116, 139, 0.4);';
    statusIcon = '⚪';
    statusText = 'Scrapped / Retired';
  }

  // Preventive Maintenance Info
  const lastServiced = machine.lastServicingDate || machine.lastServiceDate || 'Not Recorded';
  const nextServiced = machine.nextServicingDate || machine.nextServiceDate || 'Schedule Pending';

  // Resolve Official Machine Asset ID (e.g. AMG-MNT-005551)
  const assetId = getMachineAssetId(machine);

  // Determine top hero identifier:
  // Strictly prioritize the official Machine Asset ID.
  let displayHeroId = assetId || (machine.machineId && !String(machine.machineId).startsWith('mac-') ? machine.machineId : '') || machine.serialNumber || 'AMG-MNT-PENDING';

  // Machine Asset ID / Tag display:
  // User explicitly requested to prioritize official Machine Asset ID for barcode/tag:
  let displayTagId = assetId || (machine.serialNumber ? `AMG-MNT-${machine.serialNumber}` : 'Pending Tag');
  let secondaryBarcode = (machine.barcode && !String(machine.barcode).startsWith('mac-') && machine.barcode !== displayTagId) ? String(machine.barcode).trim() : '';

  const modalHtml = `
    <div id="machine-pocket-card-modal" class="modal-overlay" style="z-index: 10060; background: rgba(0, 0, 0, 0.85); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; padding: 12px; touch-action: pan-y;">
      <div class="pocket-card-sheet" style="background: #0f172a; border: 1.5px solid #38bdf8; border-radius: 16px; width: 100%; max-width: 540px; max-height: calc(100dvh - 24px); overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.9), 0 0 30px rgba(56, 189, 248, 0.25); display: flex; flex-direction: column;">
        
        <!-- Header Strip -->
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-bottom: 1px solid rgba(255,255,255,0.1); background: rgba(30, 41, 59, 0.6); gap: 10px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 20px;">🏷️</span>
            <div>
              <h3 style="margin: 0; font-size: 14px; font-weight: 800; color: #fff; letter-spacing: 0.5px; text-transform: uppercase;">Machine Pocket Card</h3>
              <div style="font-size: 11px; color: #94a3b8; margin-top: 1px;">Instantaneous Zero-Latency Floor HUD</div>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 8px;">
            <!-- Connection Pill -->
            <span id="pocket-conn-pill" style="font-size: 10.5px; font-weight: 700; padding: 3px 8px; border-radius: 20px; display: inline-flex; align-items: center; gap: 4px; ${isOnline ? 'background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16,185,129,0.3);' : 'background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245,158,11,0.3);'}">
              <span style="width: 6px; height: 6px; border-radius: 50%; background: ${isOnline ? '#10b981' : '#f59e0b'};"></span>
              <span>${isOnline ? 'Cloud Synced' : 'Offline Floor Mode'}</span>
            </span>

            <button id="btn-close-pocket-card" type="button" class="btn btn-ghost" style="width: 32px; height: 32px; border-radius: 50%; color: #94a3b8; padding: 0; display: flex; align-items: center; justify-content: center; font-size: 18px;" aria-label="Close">
              ✕
            </button>
          </div>
        </div>

        <!-- Body Details -->
        <div style="padding: 16px 18px; display: flex; flex-direction: column; gap: 14px;">
          
          <!-- Machine Identity Hero Banner -->
          <div style="background: linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.95)); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 12px; padding: 14px 16px; position: relative; overflow: hidden;">
            <div style="position: absolute; right: -10px; top: -10px; font-size: 64px; opacity: 0.06; pointer-events: none; user-select: none;">⚙️</div>
            
            <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
              <div>
                <div style="font-size: 10px; font-weight: 800; color: #38bdf8; text-transform: uppercase; letter-spacing: 1px;">Machine Asset ID</div>
                <div style="font-size: 22px; font-weight: 900; color: #fff; font-family: monospace; letter-spacing: 0.5px; margin: 2px 0 4px;">
                  ${escapeHtml(displayHeroId)}
                </div>
                <div style="font-size: 14px; font-weight: 700; color: #cbd5e1;">
                  ${escapeHtml(machineName)} <span style="font-size: 12px; color: #94a3b8; font-weight: 600;">(S/N: ${escapeHtml(machine.serialNumber || 'N/A')})</span>
                </div>
              </div>

              <div style="text-align: right;">
                <span style="font-size: 11.5px; font-weight: 800; padding: 4px 10px; border-radius: 8px; display: inline-flex; align-items: center; gap: 6px; ${statusBadgeStyle}">
                  <span>${statusIcon}</span>
                  <span>${escapeHtml(statusText)}</span>
                </span>
                <div style="font-size: 11px; color: #94a3b8; margin-top: 6px;">
                  Brand: <strong style="color: #f1f5f9;">${escapeHtml(brandName)}</strong> | Model: <strong style="color: #f1f5f9;">${escapeHtml(modelName)}</strong>
                </div>
              </div>
            </div>
          </div>

          <!-- Location Hierarchy Grid -->
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
            <div style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 10px 12px;">
              <div style="font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase;">🏢 Unit</div>
              <div style="font-size: 12.5px; font-weight: 800; color: #38bdf8; margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(unitName)}">
                ${escapeHtml(unitName)}
              </div>
            </div>

            <div style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 10px 12px;">
              <div style="font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase;">🗺️ Floor</div>
              <div style="font-size: 12.5px; font-weight: 800; color: #a78bfa; margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(floorName)}">
                ${escapeHtml(floorName)}
              </div>
            </div>

            <div style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 10px 12px;">
              <div style="font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase;">📍 Line / Area</div>
              <div style="font-size: 12.5px; font-weight: 900; color: #34d399; margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(lineName)}">
                ${escapeHtml(lineName)}
              </div>
            </div>
          </div>

          <!-- Technical Specs & Asset Tag -->
          <div style="background: rgba(15, 23, 42, 0.5); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 12px 14px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; font-size: 11.5px;">
            <div>
              <span style="color: #64748b; font-size: 10.5px; text-transform: uppercase; font-weight: 700;">Serial Number:</span>
              <div style="color: #f8fafc; font-weight: 700; font-family: monospace; font-size: 12.5px; margin-top: 2px;">
                ${escapeHtml(machine.serialNumber || 'N/A')}
              </div>
            </div>

            <div>
              <span style="color: #64748b; font-size: 10.5px; text-transform: uppercase; font-weight: 700;">Barcode / Asset Tag:</span>
              <div style="color: #38bdf8; font-weight: 800; font-family: monospace; font-size: 12px; margin-top: 2px;">
                ${escapeHtml(displayTagId)}
                ${secondaryBarcode ? `<span style="color: #94a3b8; font-size: 10px; font-weight: 400; margin-left: 4px;">(${escapeHtml(secondaryBarcode)})</span>` : ''}
              </div>
            </div>

            <div>
              <span style="color: #64748b; font-size: 10.5px; text-transform: uppercase; font-weight: 700;">🕒 Last Servicing:</span>
              <div style="color: #38bdf8; font-weight: 700; margin-top: 2px;">
                ${escapeHtml(lastServiced)}
              </div>
            </div>

            <div>
              <span style="color: #64748b; font-size: 10.5px; text-transform: uppercase; font-weight: 700;">📅 Next Due (PM):</span>
              <div style="color: #34d399; font-weight: 700; margin-top: 2px;">
                ${escapeHtml(nextServiced)}
              </div>
            </div>
          </div>

          <!-- Floor Operator Action Buttons -->
          <div>
            <div style="font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
              ⚡ Quick Floor Actions
            </div>

            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
              <!-- 1. Quick Relocate -->
              <button id="btn-pocket-action-relocate" type="button" class="btn btn-sm" style="background: rgba(56, 189, 248, 0.15); border: 1.5px solid #38bdf8; color: #38bdf8; font-weight: 700; font-size: 11.5px; padding: 8px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; transition: all 0.2s;">
                <span>🔄</span>
                <span>Relocate Machine</span>
              </button>

              <!-- 2. Log PM / Maintenance -->
              <button id="btn-pocket-action-pm" type="button" class="btn btn-sm" style="background: rgba(16, 185, 129, 0.15); border: 1.5px solid #10b981; color: #34d399; font-weight: 700; font-size: 11.5px; padding: 8px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; transition: all 0.2s;">
                <span>🕒</span>
                <span>PM Servicing</span>
              </button>

              <!-- 3. Full Lifetime Passport -->
              <button id="btn-pocket-action-history" type="button" class="btn btn-sm" style="background: rgba(168, 85, 247, 0.15); border: 1.5px solid #a855f7; color: #c084fc; font-weight: 700; font-size: 11.5px; padding: 8px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; transition: all 0.2s;">
                <span>📜</span>
                <span>Lifetime Passport</span>
              </button>

              <!-- 4. Machine Details -->
              <button id="btn-pocket-action-details" type="button" class="btn btn-sm" style="background: rgba(255, 255, 255, 0.08); border: 1.5px solid rgba(255, 255, 255, 0.2); color: #f8fafc; font-weight: 700; font-size: 11.5px; padding: 8px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; transition: all 0.2s;">
                <span>🔍</span>
                <span>Specs Drawer</span>
              </button>

              <!-- 5. Edit Machine Specifications -->
              <button id="btn-pocket-action-edit" type="button" class="btn btn-sm" style="grid-column: span 2; background: rgba(59, 130, 246, 0.18); border: 1.5px solid #3b82f6; color: #60a5fa; font-weight: 700; font-size: 11.5px; padding: 8px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; transition: all 0.2s;">
                <span>✏️</span>
                <span>Edit Machine Specifications</span>
              </button>
            </div>
          </div>

          <!-- Offline Guarantee Footnote -->
          <div style="background: rgba(0, 0, 0, 0.35); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 8px; padding: 8px 10px; font-size: 10.5px; color: #64748b; line-height: 1.4; display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 14px;">📡</span>
            <span>Zero-Internet Local Mode: Cached in browser memory. Even in deep basements with no network, all machine info remains accessible.</span>
          </div>

        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', replaceEmojiInHtml(modalHtml));

  // Bind Events
  const modalEl = document.getElementById('machine-pocket-card-modal');
  const closeBtn = document.getElementById('btn-close-pocket-card');

  const closeHandler = () => closeMachinePocketCard();
  if (closeBtn) closeBtn.addEventListener('click', closeHandler);

  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) closeHandler();
  });

  const escHandler = (e) => {
    if (e.key === 'Escape') {
      closeMachinePocketCard();
      window.removeEventListener('keydown', escHandler);
    }
  };
  window.addEventListener('keydown', escHandler);

  // Online / Offline dynamic listener
  const connPill = document.getElementById('pocket-conn-pill');
  const updateConnStatus = () => {
    if (!connPill) return;
    const nowOnline = navigator.onLine !== false;
    if (nowOnline) {
      connPill.style.background = 'rgba(16, 185, 129, 0.15)';
      connPill.style.color = '#34d399';
      connPill.style.border = '1px solid rgba(16,185,129,0.3)';
      connPill.innerHTML = '<span style="width: 6px; height: 6px; border-radius: 50%; background: #10b981;"></span><span>Cloud Synced</span>';
    } else {
      connPill.style.background = 'rgba(245, 158, 11, 0.15)';
      connPill.style.color = '#fbbf24';
      connPill.style.border = '1px solid rgba(245,158,11,0.3)';
      connPill.innerHTML = '<span style="width: 6px; height: 6px; border-radius: 50%; background: #f59e0b;"></span><span>Offline Floor Mode</span>';
    }
  };
  window.addEventListener('online', updateConnStatus);
  window.addEventListener('offline', updateConnStatus);

  // Action Button Handlers
  const relocateBtn = document.getElementById('btn-pocket-action-relocate');
  if (relocateBtn) {
    relocateBtn.addEventListener('click', () => {
      closeMachinePocketCard();
      try {
        state.set('activeMachineId', machine.id);
        state.set('activeMachineSerial', machine.serialNumber || null);
        state.set('activeModal', 'transfer-machine');
      } catch (_) {}
    });
  }

  const pmBtn = document.getElementById('btn-pocket-action-pm');
  if (pmBtn) {
    pmBtn.addEventListener('click', () => {
      closeMachinePocketCard();
      try {
        state.set('preSelectedPMMachineId', machine.id);
        state.set('pmFilterMachineSerial', machine.serialNumber);
        state.set('pmActiveTab', 'machine-profile');
        router.navigate('preventive-maintenance');
      } catch (_) {}
    });
  }

  const historyBtn = document.getElementById('btn-pocket-action-history');
  if (historyBtn) {
    historyBtn.addEventListener('click', () => {
      closeMachinePocketCard();
      try {
        state.set('activeMachineId', machine.id);
        state.set('historySearchedSerial', machine.serialNumber || assetId || machine.id);
        state.set('historyActiveTab', 'all');
        router.navigate('machine-history', { tab: 'all' });
      } catch (_) {}
    });
  }

  const detailsBtn = document.getElementById('btn-pocket-action-details');
  if (detailsBtn) {
    detailsBtn.addEventListener('click', () => {
      closeMachinePocketCard();
      try {
        state.set('activeMachineId', machine.id);
        state.set('activeModal', 'machine-details');
      } catch (_) {}
    });
  }

  const editBtn = document.getElementById('btn-pocket-action-edit');
  if (editBtn) {
    editBtn.addEventListener('click', () => {
      closeMachinePocketCard();
      try {
        state.set('activeMachineId', machine.id);
        state.set('activeModal', 'machine-form');
      } catch (_) {}
    });
  }
}

/**
 * Fallback popup when a scanned code does not match any machine
 */
function showNotFoundPocketCard(query) {
  const notFoundHtml = `
    <div id="machine-pocket-card-modal" class="modal-overlay" style="z-index: 10060; background: rgba(0, 0, 0, 0.85); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; padding: 12px;">
      <div style="background: #0f172a; border: 1.5px solid #ef4444; border-radius: 14px; width: 100%; max-width: 440px; padding: 22px; text-align: center; box-shadow: 0 25px 60px -15px rgba(0,0,0,0.9);">
        <div style="font-size: 38px; margin-bottom: 8px;">🔍⚠️</div>
        <h3 style="margin: 0; font-size: 16px; font-weight: 800; color: #fff;">Machine Not Found</h3>
        <p style="font-size: 12.5px; color: #94a3b8; margin: 8px 0 16px;">
          No machine matches the scanned code:
          <br>
          <code style="color: #f87171; background: rgba(239,68,68,0.15); padding: 3px 8px; border-radius: 4px; font-size: 13px; font-weight: 700; word-break: break-all; margin-top: 6px; display: inline-block;">
            ${escapeHtml(String(query || ''))}
          </code>
        </p>
        <div style="display: flex; gap: 8px; justify-content: center;">
          <button id="btn-close-not-found-card" class="btn btn-primary btn-sm" style="padding: 6px 18px; font-weight: 700;">
            Close
          </button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', replaceEmojiInHtml(notFoundHtml));
  const closeBtn = document.getElementById('btn-close-not-found-card');
  if (closeBtn) closeBtn.addEventListener('click', () => closeMachinePocketCard());
  const modalEl = document.getElementById('machine-pocket-card-modal');
  if (modalEl) modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) closeMachinePocketCard();
  });
}

/**
 * Closes the Machine Pocket Card
 */
export function closeMachinePocketCard() {
  const existing = document.getElementById('machine-pocket-card-modal');
  if (existing) {
    existing.remove();
  }
}

// Global attachment for seamless cross-component invocation
if (typeof window !== 'undefined') {
  window.openMachinePocketCard = openMachinePocketCard;
}

