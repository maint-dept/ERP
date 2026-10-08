/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Machine Details / Machine Lifetime Drawer Component
 * Displays Complete Machine Information, Current Location, Status, Quantities,
 * Location History, Spare Parts History, Transfer History, Service History & Remarks.
 */

import { storage } from '../db/storage.js';
import { TABLE_NAMES } from '../db/schema.js';
import { customFieldService } from '../services/customFieldService.js';
import { barcodeService } from '../services/barcodeService.js';
import { transferService } from '../services/transferService.js';
import { historyService } from '../services/historyService.js';
import { authService } from '../services/authService.js';
import { state } from '../state.js';

let activeDetailsTab = 'overview'; // 'overview', 'location-history', 'spare-parts', 'service-history', 'transfers'

export function renderMachineDetails() {
  const machineId = state.get('activeMachineId');
  if (!machineId) return '';

  const machine = storage.getItem(TABLE_NAMES.MACHINES, machineId);
  if (!machine) return '';

  const mn = storage.getItem(TABLE_NAMES.MACHINE_NAMES, machine.machineNameId);
  const brd = storage.getItem(TABLE_NAMES.BRANDS, machine.brandId);
  const mdl = storage.getItem(TABLE_NAMES.MODELS, machine.modelId);
  const unt = storage.getItem(TABLE_NAMES.UNITS, machine.unitId);
  const flr = storage.getItem(TABLE_NAMES.FLOORS, machine.floorId);
  const lin = storage.getItem(TABLE_NAMES.LINES, machine.lineId);

  const customFields = customFieldService.getActiveFields();
  const transferHistory = transferService.getMachineTransferHistory(machine.id);
  const locationHistory = historyService.getLocationHistory ? historyService.getLocationHistory(machine.serialNumber) : [];
  const serviceHistory = historyService.getServiceRepairHistory ? historyService.getServiceRepairHistory(machine.serialNumber) : [];
  const sparePartsHistory = historyService.getSparePartsHistory ? historyService.getSparePartsHistory(machine.serialNumber) : [];

  // Quantities
  const rQty = parseInt(machine.running ?? machine.qty_running ?? (machine.status === 'ACTIVE' ? (machine.quantity ?? 1) : 0), 10) || 0;
  const uQty = parseInt(machine.usable_idle ?? machine.usableIdle ?? (machine.status === 'IDLE' ? (machine.quantity ?? 1) : 0), 10) || 0;
  const rpQty = parseInt(machine.repairable_idle ?? machine.repairableIdle ?? ((machine.status === 'MAINTENANCE' || machine.status === 'BREAKDOWN') ? (machine.quantity ?? 1) : 0), 10) || 0;
  const totalQty = machine.totalQuantity || machine.total_quantity || (rQty + uQty + rpQty > 0 ? (rQty + uQty + rpQty) : (machine.quantity ?? 1));

  const barcodeSvg = barcodeService.generateBarcodeSVG(machine.serialNumber, { width: 1.8, height: 38 });
  const qrSvg = barcodeService.generateQRCodeSVG(`AL-MUSLIM-ERP://MC/${machine.serialNumber}`, { size: 90 });

  return `
    <div class="drawer-overlay" id="drawer-machine-details-overlay">
      <div class="drawer-panel" style="max-width: 680px; width: 100%;">
        
        <!-- Header -->
        <div class="drawer-header" style="background: var(--bg-surface); padding: 16px 22px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: 11px; color: #38bdf8; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">
              Machine Lifetime &amp; Details
            </div>
            <div style="font-size: 17px; font-weight: 800; color: #fff; margin-top: 2px;">
              ${mn?.name || machine.machineName || 'Machine'} — ${brd?.name || machine.brand || ''} ${mdl?.name || machine.model || ''}
            </div>
          </div>
          <button id="btn-close-details-drawer" class="btn btn-ghost btn-sm" style="font-size: 18px;">✕</button>
        </div>

        <!-- Subheader Tabs -->
        <div style="display: flex; gap: 4px; padding: 10px 20px; background: var(--bg-card); border-bottom: 1px solid var(--border-color); overflow-x: auto;">
          <button class="btn btn-sm btn-details-tab ${activeDetailsTab === 'overview' ? 'btn-primary' : 'btn-ghost'}" data-tab="overview" style="font-size: 12px; font-weight: 700; white-space: nowrap;">
            📋 Overview
          </button>
          <button class="btn btn-sm btn-details-tab ${activeDetailsTab === 'location-history' ? 'btn-primary' : 'btn-ghost'}" data-tab="location-history" style="font-size: 12px; font-weight: 700; white-space: nowrap;">
            📍 Location History (${locationHistory.length})
          </button>
          <button class="btn btn-sm btn-details-tab ${activeDetailsTab === 'spare-parts' ? 'btn-primary' : 'btn-ghost'}" data-tab="spare-parts" style="font-size: 12px; font-weight: 700; white-space: nowrap;">
            🔧 Spare Parts (${sparePartsHistory.length})
          </button>
          <button class="btn btn-sm btn-details-tab ${activeDetailsTab === 'service-history' ? 'btn-primary' : 'btn-ghost'}" data-tab="service-history" style="font-size: 12px; font-weight: 700; white-space: nowrap;">
            🛠️ Service History (${serviceHistory.length})
          </button>
          <button class="btn btn-sm btn-details-tab ${activeDetailsTab === 'transfers' ? 'btn-primary' : 'btn-ghost'}" data-tab="transfers" style="font-size: 12px; font-weight: 700; white-space: nowrap;">
            🔄 Transfers (${transferHistory.length})
          </button>
        </div>

        <div class="drawer-body drawer-content" style="padding: 20px; display: flex; flex-direction: column; gap: 16px; overflow-y: auto; flex: 1; max-height: calc(100vh - 115px);">
          
          ${authService.isMachineViewOnlyForUser(machine) ? `
            <div style="background: rgba(56, 189, 248, 0.12); border: 1px solid rgba(56, 189, 248, 0.35); border-radius: var(--radius-md); padding: 10px 14px; font-size: 12px; color: #38bdf8; display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 16px;">🔒</span>
              <div><strong>View-Only Machine:</strong> Located outside your assigned floor or Central Idle. Technical specifications are viewable, but operational modifications are restricted.</div>
            </div>
          ` : ''}

          <!-- Top Action Shortcuts -->
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button id="btn-drawer-full-history" class="btn btn-secondary btn-sm" style="flex: 1; font-weight: 600;">
              📜 Full Lifetime Passport
            </button>
            <button id="btn-drawer-preventive" class="btn btn-secondary btn-sm" style="flex: 1; font-weight: 700; color: #38bdf8; border-color: #0284c7;">
              🛡️ Preventive Maintenance
            </button>
            <button id="btn-print-asset-tag" class="btn btn-secondary btn-sm" style="flex: 1;">
              🏷️ Print Asset Tag
            </button>
            ${(authService.hasAccess('transfers', 'ADD') && authService.canOperateMachine(machine)) ? `
              <button id="btn-drawer-transfer" class="btn btn-secondary btn-sm" style="flex: 1;">
                🔄 Relocate
              </button>
            ` : ''}
            ${(authService.hasAccess('machines', 'EDIT') && authService.canOperateMachine(machine)) ? `
              <button id="btn-drawer-edit" class="btn btn-primary btn-sm" style="flex: 1;">
                ✏️ Edit Machine
              </button>
            ` : ''}
          </div>

          ${activeDetailsTab === 'overview' ? `
            <!-- Overview Tab Content -->
            
            <!-- Printable Asset Tag Box Preview -->
            <div id="printable-asset-tag" style="background: #fff; color: #000; border-radius: var(--radius-md); padding: 14px; border: 2px solid #38bdf8; box-shadow: var(--shadow-md);">
              <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 4px; margin-bottom: 8px;">
                <div>
                  <div style="font-weight: 900; font-size: 13px; letter-spacing: 0.5px; color: #000;">AL-MUSLIM GROUP</div>
                  <div style="font-size: 9.5px; font-weight: 700; color: #333;">CENTRAL MAINTENANCE ASSET TAG</div>
                </div>
                <div style="font-weight: 800; font-size: 11px; background: #000; color: #fff; padding: 2px 6px; border-radius: 3px;">
                  ${unt?.name || machine.unit || 'PLANT'}
                </div>
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px;">
                <div style="flex: 1;">
                  <div style="font-size: 12px; font-weight: 800;">${mn?.name || machine.machineName || ''} (${brd?.name || machine.brand || ''} ${mdl?.name || machine.model || ''})</div>
                  <div style="font-size: 10.5px; color: #444; margin-top: 2px;"><strong>Loc:</strong> ${flr?.name || machine.floor || ''} &rarr; ${lin?.name || machine.line || ''}</div>
                  <div style="font-family: var(--font-mono); font-size: 13px; font-weight: 900; color: #0284c7; margin-top: 4px;">
                    SN: ${machine.serialNumber}
                  </div>
                </div>
                <div style="display: flex; flex-direction: column; align-items: center;">
                  ${qrSvg}
                  <span style="font-size: 8px; color: #666; margin-top: 2px;">SCAN ASSET</span>
                </div>
              </div>

              <div style="text-align: center; margin-top: 8px; border-top: 1px dashed #999; padding-top: 6px;">
                ${barcodeSvg}
              </div>
            </div>

            <!-- Machine Information & Current Location -->
            <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px;">
              <h4 style="font-size: 13px; font-weight: 700; color: #38bdf8; margin-bottom: 10px;">
                📋 Machine Information &amp; Current Location
              </h4>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 12.5px;">
                <div><span style="color: var(--text-muted);">Machine Serial Number:</span> <strong style="color: #38bdf8; font-family: var(--font-mono);">${machine.serialNumber}</strong></div>
                <div><span style="color: var(--text-muted);">Machine Status:</span> <span class="badge badge-${(machine.status || 'ACTIVE').toLowerCase()}">${machine.status || 'ACTIVE'}</span></div>
                <div><span style="color: var(--text-muted);">Machine Name:</span> <strong style="color: #fff;">${mn?.name || machine.machineName || '—'}</strong></div>
                <div><span style="color: var(--text-muted);">Brand &amp; Model:</span> <strong style="color: #fff;">${brd?.name || machine.brand || '—'} ${mdl?.name || machine.model || ''}</strong></div>
                <div><span style="color: var(--text-muted);">Unit / Factory:</span> <strong style="color: #fff;">${unt?.name || machine.unit || '—'}</strong></div>
                <div><span style="color: var(--text-muted);">Floor:</span> <strong style="color: #fff;">${flr?.name || machine.floor || '—'}</strong></div>
                <div><span style="color: var(--text-muted);">Line / Dept:</span> <strong style="color: #38bdf8;">${lin?.name || machine.line || '—'}</strong></div>
                <div><span style="color: var(--text-muted);">Purchase Date:</span> <strong style="color: #fff;">${machine.purchase_date || machine.purchaseDate || '—'}</strong></div>
              </div>
            </div>

            <!-- Quantities (Running | Usable Idle | Repairable Idle | Total) -->
            <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px;">
              <h4 style="font-size: 13px; font-weight: 700; color: #34d399; margin-bottom: 10px;">
                🔢 Quantities Breakdown
              </h4>
              <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; text-align: center;">
                <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 6px; padding: 8px;">
                  <div style="font-size: 16px; font-weight: 800; color: #34d399;">${rQty}</div>
                  <div style="font-size: 10.5px; color: var(--text-muted); text-transform: uppercase;">Running</div>
                </div>
                <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 6px; padding: 8px;">
                  <div style="font-size: 16px; font-weight: 800; color: #38bdf8;">${uQty}</div>
                  <div style="font-size: 10.5px; color: var(--text-muted); text-transform: uppercase;">Usable Idle</div>
                </div>
                <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 6px; padding: 8px;">
                  <div style="font-size: 16px; font-weight: 800; color: #fbbf24;">${rpQty}</div>
                  <div style="font-size: 10.5px; color: var(--text-muted); text-transform: uppercase;">Repairable Idle</div>
                </div>
                <div style="background: rgba(56, 189, 248, 0.12); border: 1px solid rgba(56, 189, 248, 0.35); border-radius: 6px; padding: 8px;">
                  <div style="font-size: 16px; font-weight: 900; color: #fff;">${totalQty}</div>
                  <div style="font-size: 10.5px; color: #38bdf8; text-transform: uppercase; font-weight: 700;">Total Qty</div>
                </div>
              </div>
            </div>

            <!-- Remarks -->
            <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px;">
              <h4 style="font-size: 13px; font-weight: 700; color: #fbbf24; margin-bottom: 6px;">
                📝 Technical Remarks &amp; Notes
              </h4>
              <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.5;">
                ${machine.remarks || 'No special remarks recorded for this machine.'}
              </div>
            </div>
          ` : ''}

          ${activeDetailsTab === 'location-history' ? `
            <!-- Location History Tab -->
            <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px;">
              <h4 style="font-size: 13px; font-weight: 700; color: #38bdf8; margin-bottom: 12px;">
                📍 Permanent Location Movement Trail (${locationHistory.length})
              </h4>
              ${locationHistory.length === 0 ? `
                <div style="font-size: 12px; color: var(--text-muted); padding: 12px 0; text-align: center;">
                  No historical movements. Machine is at its original commissioned location (${unt?.name || ''} &rarr; ${flr?.name || ''} &rarr; ${lin?.name || ''}).
                </div>
              ` : `
                <div class="timeline-container">
                  ${locationHistory.map(lh => `
                    <div class="timeline-item" style="padding-bottom: 12px;">
                      <div class="timeline-dot"></div>
                      <div style="font-size: 11px; color: var(--text-muted);">${new Date(lh.timestamp).toLocaleString()}</div>
                      <div style="font-size: 12px; font-weight: 700; color: #fff; margin-top: 2px;">
                        ${lh.fromLocation || 'Initial Plant'} &rarr; <span style="color: #34d399;">${lh.toLocation || 'New Assigned Floor'}</span>
                      </div>
                      <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">
                        ${lh.details || lh.title} &bull; Performed by: ${lh.performedByName}
                      </div>
                    </div>
                  `).join('')}
                </div>
              `}
            </div>
          ` : ''}

          ${activeDetailsTab === 'spare-parts' ? `
            <!-- Spare Parts History Tab -->
            <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px;">
              <h4 style="font-size: 13px; font-weight: 700; color: #34d399; margin-bottom: 12px;">
                🔧 Spare Parts Replacements (${sparePartsHistory.length})
              </h4>
              ${sparePartsHistory.length === 0 ? `
                <div style="font-size: 12px; color: var(--text-muted); padding: 12px 0; text-align: center;">
                  No spare parts have been replaced on this machine yet.
                </div>
              ` : `
                <div style="display: flex; flex-direction: column; gap: 8px;">
                  ${sparePartsHistory.map(sp => `
                    <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 6px; padding: 10px 12px; display: flex; justify-content: space-between; align-items: center;">
                      <div>
                        <div style="font-weight: 700; color: #fff; font-size: 12.5px;">${sp.sparePart?.partName || sp.title}</div>
                        <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">
                          Qty: ${sp.sparePart?.quantity || 1} &bull; Serial: ${sp.sparePart?.partSerialNumber || '—'} &bull; Mechanic: ${sp.performedByName}
                        </div>
                      </div>
                      <div style="font-size: 11px; color: var(--text-muted); text-align: right;">
                        ${new Date(sp.timestamp).toLocaleDateString()}
                      </div>
                    </div>
                  `).join('')}
                </div>
              `}
            </div>
          ` : ''}

          ${activeDetailsTab === 'service-history' ? `
            <!-- Service & Repair History Tab -->
            <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px;">
              <h4 style="font-size: 13px; font-weight: 700; color: #fbbf24; margin-bottom: 12px;">
                🛠️ Maintenance &amp; Repair Logs (${serviceHistory.length})
              </h4>
              ${serviceHistory.length === 0 ? `
                <div style="font-size: 12px; color: var(--text-muted); padding: 12px 0; text-align: center;">
                  No maintenance or repair service records logged.
                </div>
              ` : `
                <div style="display: flex; flex-direction: column; gap: 8px;">
                  ${serviceHistory.map(sr => `
                    <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 6px; padding: 10px 12px;">
                      <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-weight: 700; color: #fbbf24; font-size: 12px;">${sr.serviceRecord?.serviceType || 'SERVICING'}</span>
                        <span style="font-size: 11px; color: var(--text-muted);">${new Date(sr.timestamp).toLocaleDateString()}</span>
                      </div>
                      <div style="font-size: 12px; color: #fff; margin-top: 4px; font-weight: 600;">
                        ${sr.serviceRecord?.problemComplaint || sr.title}
                      </div>
                      <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">
                        ${sr.serviceRecord?.workPerformed || sr.details} &bull; Mechanic: ${sr.performedByName}
                      </div>
                    </div>
                  `).join('')}
                </div>
              `}
            </div>
          ` : ''}

          ${activeDetailsTab === 'transfers' ? `
            <!-- Transfers History Tab -->
            <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <h4 style="font-size: 13px; font-weight: 700; color: #c084fc; margin: 0;">
                  🔄 Inter-Floor &amp; Line Relocation Requests (${transferHistory.length})
                </h4>
                ${authService.hasAccess('transfers', 'ADD') ? `
                  <button id="btn-details-new-transfer" class="btn btn-ghost btn-sm" style="color: #38bdf8; font-size: 11px;">
                    ➕ New Transfer Request
                  </button>
                ` : ''}
              </div>

              ${transferHistory.length === 0 ? `
                <div style="font-size: 12px; color: var(--text-muted); padding: 12px 0; text-align: center;">
                  No transfer requests recorded for this machine.
                </div>
              ` : `
                <div class="timeline-container">
                  ${transferHistory.map(t => `
                    <div class="timeline-item" style="padding-bottom: 12px;">
                      <div class="timeline-dot"></div>
                      <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="font-size: 11px; color: var(--text-muted);">${new Date(t.requestedAt || t.transferredAt).toLocaleString()}</div>
                        <span class="badge ${t.status === 'COMPLETED' ? 'badge-active' : 'badge-idle'}" style="font-size: 9.5px;">
                          ${t.status || 'COMPLETED'}
                        </span>
                      </div>
                      <div style="font-size: 12px; font-weight: 700; color: #fff; margin-top: 2px;">
                        ${t.sourcePath} &rarr; <span style="color: #34d399;">${t.destPath}</span>
                      </div>
                      <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">
                        Reason: ${t.reason}
                      </div>
                      <div style="margin-top: 6px; display: flex; gap: 8px; align-items: center;">
                        <span style="font-family: var(--font-mono); font-size: 10.5px; font-weight: 700; color: #38bdf8; background: var(--primary-light); padding: 1px 6px; border-radius: 3px;">
                          ${t.requestNumber || t.id}
                        </span>
                        <button class="btn btn-ghost btn-sm btn-view-hist-transfer" data-id="${t.id}" style="font-size: 10.5px; color: #38bdf8; padding: 0 4px;">
                          👁️ View Approval Stepper
                        </button>
                      </div>
                    </div>
                  `).join('')}
                </div>
              `}
            </div>
          ` : ''}

        </div>
      </div>
    </div>
  `;
}

export function initMachineDetailsEvents() {
  const overlay = document.getElementById('drawer-machine-details-overlay');
  const closeBtn = document.getElementById('btn-close-details-drawer');

  const closeDrawer = () => {
    state.set('activeModal', null);
    document.removeEventListener('keydown', handleKeydown);
  };

  const handleKeydown = (e) => {
    if (e.key === 'Escape') closeDrawer();
  };
  document.addEventListener('keydown', handleKeydown);

  if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeDrawer();
    });
  }

  // Tabs switching
  document.querySelectorAll('.btn-details-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      if (tab) {
        activeDetailsTab = tab;
        const modalLayer = document.getElementById('modal-layer');
        if (modalLayer) {
          modalLayer.innerHTML = renderMachineDetails();
          initMachineDetailsEvents();
        }
      }
    });
  });

  const btnFullHistory = document.getElementById('btn-drawer-full-history');
  if (btnFullHistory) {
    btnFullHistory.addEventListener('click', () => {
      state.set('activeModal', null);
      state.set('currentView', 'machine-history');
    });
  }

  const btnPreventive = document.getElementById('btn-drawer-preventive');
  if (btnPreventive) {
    btnPreventive.addEventListener('click', () => {
      state.set('activeModal', null);
      state.set('currentView', 'preventive-maintenance');
    });
  }

  const btnEdit = document.getElementById('btn-drawer-edit');
  if (btnEdit) {
    btnEdit.addEventListener('click', () => {
      state.set('activeModal', 'machine-form');
    });
  }

  const btnTransfer = document.getElementById('btn-drawer-transfer');
  if (btnTransfer) {
    btnTransfer.addEventListener('click', () => {
      state.set('activeModal', 'transfer-machine');
    });
  }

  const btnDetailsNewTransfer = document.getElementById('btn-details-new-transfer');
  if (btnDetailsNewTransfer) {
    btnDetailsNewTransfer.addEventListener('click', () => {
      state.set('activeModal', 'transfer-machine');
    });
  }

  // View transfer from timeline
  document.querySelectorAll('.btn-view-hist-transfer').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      state.set('activeTransferRequestId', id);
      state.set('activeModal', 'transfer-details');
    });
  });

  const btnPrintTag = document.getElementById('btn-print-asset-tag');
  if (btnPrintTag) {
    btnPrintTag.addEventListener('click', () => {
      window.print();
    });
  }
}
