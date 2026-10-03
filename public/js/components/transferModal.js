/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Machine Transfer Request Creation Modal Component
 * 
 * Flow:
 * 1. User enters Machine Serial Number (e.g. JA-01)
 * 2. System automatically loads all machine details (Name, Type, Brand, Model, Current Location [Locked], Status, History, Specs)
 * 3. User selects New Location / Floor from dropdown
 * 4. User uploads Supporting Document (PDF, JPG, PNG, Excel) with preview & remove/replace
 * 5. Submit Transfer Request (Status: Pending) -> Admin Review -> Approve / Reject
 */

import { storage } from '../db/storage.js';
import { TABLE_NAMES } from '../db/schema.js';
import { machineService } from '../services/machineService.js';
import { masterDataService } from '../services/masterDataService.js';
import { workflowService } from '../services/workflowService.js';
import { transferService } from '../services/transferService.js';
import { historyService } from '../services/historyService.js';
import { authService } from '../services/authService.js';
import { notificationService } from '../services/notificationService.js';
import { qrCodeService } from '../services/qrCodeService.js';
import { renderQrScannerModal, initQrScannerModalEvents } from './qrScannerModal.js?v=4.7.4';
import { state } from '../state.js';

let attachedDocuments = [];
let serialSearchQuery = '';
let selectedDest = {
  groupId: '',
  unitId: '',
  floorId: '',
  lineId: '',
  searchQuery: ''
};

export function renderTransferModal() {
  let activeMachineId = state.get('activeMachineId');
  const allMachines = storage.getTable(TABLE_NAMES.MACHINES) || [];

  const machine = activeMachineId ? machineService.getEnrichedMachine(activeMachineId) : null;
  const groups = masterDataService.getGroups();
  const destGroupId = selectedDest.groupId || '';
  const units = destGroupId ? masterDataService.getUnits(destGroupId, false, true) : [];
  const destUnitId = selectedDest.unitId || '';
  const floors = destUnitId ? masterDataService.getFloors(destUnitId, null, false, true) : [];
  const destFloorId = selectedDest.floorId || '';
  const lines = destFloorId ? masterDataService.getLines(destFloorId, null, null, false, true) : [];
  const destLineId = selectedDest.lineId || '';

  // Machine Lifetime History count for verification card
  const historyRecords = machine?.serialNumber ? historyService.getMachineHistory(machine.serialNumber) : [];
  const locationChangesCount = historyRecords.filter(h => h.actionType === 'TRANSFER_MACHINE' || h.type === 'LOCATION_CHANGE').length;
  const servicesCount = historyRecords.filter(h => h.type === 'SERVICE_REPAIR' || h.actionType === 'SERVICE').length;
  const sparePartsCount = historyRecords.filter(h => h.type === 'SPARE_PART_REPLACEMENT').length;

  // Active transfer request check for duplicate prevention
  const activeExistingTransfer = machine ? transferService.getActiveTransferForMachine(machine.id) : null;

  const currentGroupName = machine?.group?.name || groups.find(g => g.id === machine?.groupId)?.name || '';
  const currentPath = machine ? `${currentGroupName ? currentGroupName + ' > ' : ''}${machine.unit?.name || 'Unit'} > ${machine.floor?.name || 'Floor'} > ${machine.line?.name || 'Line'}` : 'Not Selected';
  const currentFloorName = machine?.floor?.name || 'Current Floor';

  return `
    <div class="modal-overlay" id="modal-transfer-overlay">
      <div class="modal-dialog modal-dialog-lg" style="max-width: 880px; max-height: 90vh; display: flex; flex-direction: column; min-height: 0;">
        
        <!-- Modal Header -->
        <div class="modal-header" style="background: var(--bg-card); border-bottom: 1px solid var(--border-color); padding: 16px 22px;">
          <div class="modal-title" style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 20px;">🔄</span>
            <div>
              <div style="font-size: 16px; font-weight: 800; color: #fff;">Initiate Machine Transfer Request</div>
              <div style="font-size: 11px; color: #38bdf8; font-weight: 600;">Zero-Manual-Entry &bull; Auto-Filled Machine Passport &bull; Management Approval Routing</div>
            </div>
          </div>
          <button id="btn-close-transfer-modal" class="btn btn-ghost btn-sm" style="font-size: 18px;">✕</button>
        </div>

        <form id="form-transfer-request" class="modal-body" style="padding: 20px 24px; display: flex; flex-direction: column; gap: 18px; overflow-y: auto; flex: 1; min-height: 0;">
          
          <!-- STEP 1: SEARCH MACHINE SERIAL NUMBER -->
          <div style="background: var(--bg-surface); border: 1.5px solid var(--primary); border-radius: var(--radius-lg); padding: 16px 18px; box-shadow: 0 4px 20px rgba(0,0,0,0.25);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
              <div style="font-size: 12.5px; font-weight: 800; color: #38bdf8; text-transform: uppercase; display: flex; align-items: center; gap: 6px;">
                <span>🔍 1. Search Machine by Serial Number Only</span>
              </div>
              ${machine ? '<span class="badge badge-active" style="font-size: 10.5px;">Machine Loaded</span>' : '<span class="badge" style="background: rgba(148, 163, 184, 0.2); color: #94a3b8; font-size: 10.5px;">Awaiting Input</span>'}
            </div>

            <!-- Serial Search Input & Dropdown -->
            <div style="position: relative;">
              <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                <div style="position: relative; flex: 1; min-width: 220px;">
                  <input 
                    type="text" 
                    id="inp-transfer-search-serial" 
                    class="form-control" 
                    placeholder="Enter or search Machine Serial Number (e.g. 5369, 76, JK-01)..." 
                    value="${machine?.serialNumber || ''}" 
                    style="font-size: 14px; font-weight: 700; color: #fff; background: rgba(0,0,0,0.4); border: 1px solid rgba(56, 189, 248, 0.5); padding-left: 36px; padding-right: ${machine ? '75px' : '12px'};"
                    autocomplete="off"
                  />
                  <span style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); font-size: 16px; opacity: 0.6;">🧵</span>
                  ${machine ? `
                    <button type="button" id="btn-clear-transfer-machine" title="Clear and search another machine" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.35); color: #f87171; font-size: 11px; cursor: pointer; padding: 3px 8px; border-radius: 4px; font-weight: 700;">✕ Clear</button>
                  ` : ''}
                </div>
                <button type="button" id="btn-search-serial-trigger" class="btn btn-primary" style="font-weight: 700; white-space: nowrap;">
                  Find Machine
                </button>
                <button type="button" id="btn-transfer-scan-qr" class="btn" style="background: linear-gradient(135deg, #0284c7, #0369a1); border: 1.5px solid #38bdf8; color: #fff; font-weight: 800; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 10px rgba(2, 132, 199, 0.4); white-space: nowrap;" title="Scan Machine QR Code or Barcode with Camera">
                  <span style="font-size: 16px;">📷</span> Scan QR
                </button>
              </div>

              <!-- Floating Serial Suggestions Dropdown -->
              <div id="transfer-serial-suggestions" style="display: none; position: absolute; left: 0; right: 0; top: 100%; z-index: 1000; background: #0f172a; border: 1px solid #38bdf8; border-radius: var(--radius-md); max-height: 220px; overflow-y: auto; box-shadow: 0 10px 30px rgba(0,0,0,0.7); margin-top: 4px;"></div>
            </div>

            <!-- AUTO-LOADED MACHINE DETAILS CARD (User verifies, does not manually type) -->
            ${machine ? `
              <div style="margin-top: 14px; background: rgba(2, 132, 199, 0.08); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: var(--radius-md); padding: 14px 16px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px;">
                  <div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <span style="font-size: 15px; font-weight: 800; color: #fff;">${machine.machineName?.name || 'Sewing Machine'}</span>
                      <span class="badge" style="background: rgba(2, 132, 199, 0.3); color: #38bdf8; font-family: var(--font-mono); font-weight: 800; font-size: 12px; border: 1px solid rgba(56, 189, 248, 0.4);">
                        ${machine.serialNumber}
                      </span>
                      <span class="badge ${machine.status === 'ACTIVE' ? 'badge-active' : 'badge-idle'}" style="font-size: 10px;">
                        ${machine.status}
                      </span>
                    </div>
                    <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">
                      <strong>Brand &amp; Model:</strong> ${machine.brand?.name || '—'} &bull; ${machine.model?.name || '—'} | 
                      <strong>Type:</strong> ${machine.machineName?.categoryName || 'Standard Machine'}
                    </div>
                  </div>

                  <!-- Lock Current Location Tag -->
                  <div style="text-align: right;">
                    <div style="font-size: 10px; font-weight: 700; color: #fbbf24; text-transform: uppercase;">
                      🔒 Current Location (Locked &bull; Read Only)
                    </div>
                    <div style="font-size: 13.5px; font-weight: 800; color: #fff; margin-top: 2px;">
                      ${currentPath}
                    </div>
                  </div>
                </div>

                <!-- Specs & History Verification Strip -->
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 12px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.08); font-size: 11px;">
                  <div>
                    <span style="color: var(--text-muted);">Asset Tag:</span> <strong style="color: #fff;">${machine.customFields?.assetTag || machine.id}</strong>
                  </div>
                  <div>
                    <span style="color: var(--text-muted);">Motor / Voltage:</span> <strong style="color: #fff;">${machine.customFields?.motorType || 'Servo 220V'}</strong>
                  </div>
                  <div>
                    <span style="color: var(--text-muted);">Past Transfers:</span> <strong style="color: #38bdf8;">${locationChangesCount} recorded</strong>
                  </div>
                  <div>
                    <span style="color: var(--text-muted);">Service / Repairs:</span> <strong style="color: #34d399;">${servicesCount + sparePartsCount} events</strong>
                  </div>
                </div>

                ${activeExistingTransfer ? `
                  <div style="margin-top: 12px; background: rgba(239, 68, 68, 0.12); border: 1.5px solid #ef4444; border-radius: var(--radius-md); padding: 12px 14px; display: flex; align-items: center; justify-content: space-between; gap: 12px;">
                    <div style="display: flex; align-items: flex-start; gap: 10px;">
                      <span style="font-size: 20px;">⚠️</span>
                      <div>
                        <div style="font-size: 13px; font-weight: 800; color: #f87171;">
                          Active Transfer Request Already in Progress (#${activeExistingTransfer.requestNumber})
                        </div>
                        <div style="font-size: 11.5px; color: #cbd5e1; margin-top: 2px; line-height: 1.4;">
                          Machine <strong>${machine.serialNumber}</strong> is currently awaiting transfer: 
                          <span class="badge badge-maint" style="font-size: 10px; padding: 1px 6px;">${activeExistingTransfer.status.replace(/_/g, ' ')}</span>
                          &bull; Requested by <strong>${activeExistingTransfer.requestedByName || 'User'}</strong> on ${new Date(activeExistingTransfer.requestedAt).toLocaleDateString()}.
                          <br/><span style="color: #fca5a5; font-weight: 600;">A machine cannot have multiple transfer requests at the same time.</span>
                        </div>
                      </div>
                    </div>
                    <button type="button" class="btn btn-sm btn-secondary btn-view-existing-active-transfer" data-id="${activeExistingTransfer.id}" style="font-size: 11px; font-weight: 700; white-space: nowrap; border-color: #38bdf8; color: #38bdf8;">
                      👁️ View Active Request
                    </button>
                  </div>
                ` : ''}
              </div>
            ` : `
              <div style="margin-top: 14px; background: rgba(15, 23, 42, 0.45); border: 1.5px dashed rgba(56, 189, 248, 0.25); border-radius: var(--radius-md); padding: 18px 20px; text-align: center;">
                <div style="font-size: 26px; margin-bottom: 4px; opacity: 0.85;">🔍</div>
                <div style="font-size: 13.5px; font-weight: 700; color: #f8fafc;">Awaiting Machine Serial Input</div>
                <div style="font-size: 11.5px; color: var(--text-secondary); margin-top: 4px; max-width: 480px; margin-left: auto; margin-right: auto; line-height: 1.5;">
                  Please enter or search a Machine Serial Number above (e.g. <strong>5369</strong>, <strong>76</strong>) or click <strong>Find Machine</strong> to load passport and current location.
                </div>
              </div>
            `}
          </div>

          <!-- STEP 2: SELECT NEW LOCATION / FLOOR (GROUP -> UNIT -> FLOOR -> LINE) -->
          <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 16px 18px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <div style="font-size: 12.5px; font-weight: 800; color: #34d399; text-transform: uppercase; display: flex; align-items: center; gap: 6px;">
                <span>📍 2. Select Requested New Location (Group &rarr; Unit &rarr; Floor &rarr; Line)</span>
              </div>
              <span class="badge badge-active" style="font-size: 10px;">4-Tier Plant Hierarchy</span>
            </div>

            <!-- Route Visualizer Banner -->
            <div style="background: rgba(0,0,0,0.3); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 10px 14px; margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between; gap: 10px;">
              <div style="flex: 1;">
                <div style="font-size: 10px; color: #f87171; font-weight: 700; text-transform: uppercase;">Current Location</div>
                <div style="font-size: 12.5px; font-weight: 800; color: #fff; line-height: 1.4;">${machine ? currentPath : '<span style="color: #94a3b8; font-style: italic; font-weight: 500;">(Awaiting Machine Serial Input)</span>'}</div>
              </div>
              <div style="font-size: 20px; color: #38bdf8; font-weight: 800;">➔</div>
              <div style="flex: 1; text-align: right;">
                <div style="font-size: 10px; color: #34d399; font-weight: 700; text-transform: uppercase;">Transfer To (Destination Path)</div>
                <div id="transfer-target-path-preview" style="font-size: 12.5px; font-weight: 800; color: #94a3b8; line-height: 1.4;"><span style="font-style: italic; font-weight: 500;">(Select Destination Below)</span></div>
              </div>
            </div>

            <!-- Location Search Bar -->
            <div style="background: rgba(15, 23, 42, 0.65); border: 1px solid rgba(56, 189, 248, 0.35); border-radius: var(--radius-md); padding: 12px 14px; margin-bottom: 14px; position: relative;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <label for="inp-transfer-location-search" style="font-size: 12px; font-weight: 700; color: #38bdf8; display: flex; align-items: center; gap: 6px; margin: 0;">
                  <span>🔍 Quick Location Search</span>
                  <span style="font-size: 11px; font-weight: 400; color: #94a3b8;">(Search any Floor or Line across all Units)</span>
                </label>
                <span style="font-size: 10.5px; color: #34d399; font-weight: 600;">✨ Auto fills 4 dropdowns below</span>
              </div>
              <div style="position: relative;">
                <input 
                  type="text" 
                  id="inp-transfer-location-search" 
                  class="form-control" 
                  placeholder="Type to search Floor or Line name (e.g. Jamuna, Size Set, BG-A, Eyelet, Cutting)..." 
                  value="${selectedDest.searchQuery || ''}"
                  autocomplete="off"
                  style="font-size: 13px; font-weight: 600; color: #fff; background: rgba(0,0,0,0.4); border: 1px solid rgba(56, 189, 248, 0.4); padding-left: 36px; padding-right: 32px;"
                />
                <span style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); font-size: 14px; opacity: 0.7;">📍</span>
                <button type="button" id="btn-clear-location-search" title="Clear search" style="${selectedDest.searchQuery ? 'display: block;' : 'display: none;'} position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); color: #f87171; border-radius: 4px; font-size: 11px; cursor: pointer; padding: 2px 6px;">✕</button>
              </div>

              <!-- Floating Suggestions Dropdown -->
              <div id="transfer-location-suggestions" style="display: none; position: absolute; left: 14px; right: 14px; top: 100%; z-index: 1000; background: #0b1329; border: 1.5px solid #38bdf8; border-radius: var(--radius-md); max-height: 240px; overflow-y: auto; box-shadow: 0 12px 36px rgba(0,0,0,0.85); margin-top: 4px;"></div>
            </div>

            <div class="form-grid-2">
              <div class="form-group">
                <label class="form-label" style="font-size: 12.5px; font-weight: 700; color: #f8fafc;">1. Destination Group <span class="req">*</span></label>
                <select id="transfer-dest-group" class="filter-select" required style="background: #0b1329; color: #ffffff; border: 1.5px solid #475569; font-size: 13.5px;">
                  <option value="" disabled ${!destGroupId ? 'selected' : ''}>-- Select Destination Group --</option>
                  ${groups.map(g => `<option value="${g.id}" ${destGroupId === g.id ? 'selected' : ''}>${g.name}</option>`).join('')}
                </select>
              </div>

              <div class="form-group">
                <label class="form-label" style="font-size: 12.5px; font-weight: 700; color: #f8fafc;">2. Destination Factory / Unit <span class="req">*</span></label>
                <select id="transfer-dest-unit" class="filter-select" required ${!destGroupId ? 'disabled' : ''} style="background: #0b1329; color: #ffffff; border: 1.5px solid #475569; font-size: 13.5px;">
                  <option value="" disabled ${!destUnitId ? 'selected' : ''}>${destGroupId ? '-- Select Factory / Unit --' : '-- Select Group First --'}</option>
                  ${units.map(u => `<option value="${u.id}" ${destUnitId === u.id ? 'selected' : ''}>${u.name}</option>`).join('')}
                </select>
              </div>

              <div class="form-group">
                <label class="form-label" style="font-size: 12.5px; font-weight: 700; color: #f8fafc;">3. Destination Floor <span class="req">*</span></label>
                <select id="transfer-dest-floor" class="filter-select" required ${!destUnitId ? 'disabled' : ''} style="background: #0b1329; color: #ffffff; border: 1.5px solid #475569; font-size: 13.5px;">
                  <option value="" disabled ${!destFloorId ? 'selected' : ''}>${destUnitId ? '-- Select Floor --' : '-- Select Unit First --'}</option>
                  ${floors.map(f => `<option value="${f.id}" ${destFloorId === f.id ? 'selected' : ''}>${f.name}</option>`).join('')}
                </select>
              </div>

              <div class="form-group">
                <label class="form-label" style="font-size: 12.5px; font-weight: 700; color: #f8fafc;">4. Destination Production Line <span class="req">*</span></label>
                <select id="transfer-dest-line" class="filter-select" required ${!destFloorId ? 'disabled' : ''} style="background: #0b1329; color: #ffffff; border: 1.5px solid #475569; font-size: 13.5px;">
                  <option value="" disabled ${!destLineId ? 'selected' : ''}>${destFloorId ? '-- Select Production Line --' : '-- Select Floor First --'}</option>
                  ${lines.map(l => `<option value="${l.id}" ${destLineId === l.id ? 'selected' : ''}>${l.name}</option>`).join('')}
                </select>
              </div>

              <div class="form-group full-width">
                <label class="form-label" style="font-size: 12.5px; font-weight: 700; color: #f8fafc;">Transfer Reason / Order Reference</label>
                <input type="text" id="transfer-reason" class="form-control" placeholder="e.g. Line re-balancing for jacket production order" style="background: #0b1329; color: #ffffff; border: 1.5px solid #475569; font-size: 13.5px;" />
              </div>

              <div class="form-group full-width">
                <label class="form-label" style="font-size: 12.5px; font-weight: 700; color: #f8fafc;">Remarks / Setup Instructions (Optional)</label>
                <textarea id="transfer-remarks" class="form-control" rows="2" placeholder="e.g. Requires 380V heavy line setup, attachment folder pre-installed" style="background: #0b1329; color: #ffffff; border: 1.5px solid #475569; font-size: 13.5px;"></textarea>
              </div>
            </div>
          </div>

          <!-- STEP 3: UPLOAD SUPPORTING DOCUMENT (PDF, JPG, PNG, EXCEL) -->
          <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 16px 18px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
              <div>
                <div style="font-size: 12.5px; font-weight: 800; color: #fbbf24; text-transform: uppercase; display: flex; align-items: center; gap: 6px;">
                  <span>📎 3. Upload Supporting / Transfer Document</span>
                </div>
                <div style="font-size: 12px; color: #cbd5e1; margin-top: 2px;">
                  Attach transfer sanction, management approval letter, or gate pass request.
                </div>
              </div>
              <span class="badge" style="background: rgba(251, 191, 36, 0.15); color: #fbbf24; font-size: 11px; font-weight: 700;">
                PDF &bull; JPG &bull; PNG &bull; EXCEL
              </span>
            </div>

            <!-- Upload Drop Zone -->
            <div id="transfer-doc-dropzone" style="border: 2px dashed #38bdf8; border-radius: var(--radius-md); padding: 20px; text-align: center; background: rgba(56, 189, 248, 0.06); cursor: pointer; transition: all 0.2s;">
              <div style="font-size: 32px; margin-bottom: 6px;">📂</div>
              <div style="font-size: 13.5px; font-weight: 700; color: #ffffff;">
                Click or Drag &amp; Drop to Upload Supporting Document
              </div>
              <div style="font-size: 12px; color: #cbd5e1; margin-top: 5px;">
                Supported formats: <strong style="color: #38bdf8;">PDF (.pdf)</strong>, <strong style="color: #34d399;">Images (.jpg, .jpeg, .png)</strong>, <strong style="color: #fbbf24;">Excel (.xlsx, .xls)</strong>
              </div>
              <input type="file" id="inp-transfer-document" accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls" multiple style="display: none;" />
            </div>

            <!-- Uploaded Files Preview & Replace Card -->
            <div id="transfer-attached-docs-list" style="margin-top: 12px; display: flex; flex-direction: column; gap: 8px;">
              ${renderAttachedDocsHtml()}
            </div>
          </div>
        </form>

        <!-- Modal Footer -->
        <div class="modal-footer" style="background: var(--bg-card); border-top: 1px solid var(--border-color); padding: 14px 22px; display: flex; justify-content: space-between; align-items: center;">
          <div style="font-size: 12.5px; color: #cbd5e1;">
            Requester: <strong style="color: #38bdf8;">${authService.getCurrentUser()?.name || 'User'}</strong> &bull; Status will be: <strong style="color: #fbbf24;">Pending Admin Approval</strong>
          </div>
          <div style="display: flex; gap: 10px;">
            <button type="button" id="btn-cancel-transfer" class="btn btn-secondary">Cancel</button>
            <button type="submit" form="form-transfer-request" id="btn-submit-transfer-request" class="btn btn-primary" style="font-weight: 800; padding: 9px 22px; ${activeExistingTransfer ? 'opacity: 0.45; cursor: not-allowed;' : ''}" ${activeExistingTransfer ? 'disabled title="Cannot submit: An active transfer request already exists for this machine."' : ''}>
              🚀 Submit Transfer Request
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderAttachedDocsHtml() {
  if (attachedDocuments.length === 0) {
    return `
      <div style="font-size: 12px; color: #cbd5e1; font-style: italic; text-align: center; padding: 6px;">
        No supporting documents uploaded yet. (You may upload permission letters or transfer approvals).
      </div>
    `;
  }

  return attachedDocuments.map((doc, idx) => {
    let icon = '📄';
    if (doc.type?.includes('image') || doc.name?.match(/\.(jpg|jpeg|png)$/i)) icon = '🖼️';
    else if (doc.name?.match(/\.(xlsx|xls)$/i)) icon = '📊';

    return `
      <div style="background: var(--bg-surface); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: var(--radius-md); padding: 10px 14px; display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 20px;">${icon}</span>
          <div>
            <div style="font-size: 12.5px; font-weight: 700; color: #fff;">${doc.name}</div>
            <div style="font-size: 11px; color: var(--text-secondary); margin-top: 1px;">
              Size: ${doc.size} &bull; Ready for submission
            </div>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 6px;">
          <button type="button" class="btn btn-ghost btn-sm btn-replace-doc" data-idx="${idx}" title="Replace this document" style="font-size: 11.5px; color: #38bdf8;">
            🔄 Replace
          </button>
          <button type="button" class="btn btn-ghost btn-sm btn-remove-doc" data-idx="${idx}" title="Remove document" style="color: #f87171; font-size: 14px;">
            🗑️
          </button>
        </div>
      </div>
    `;
  }).join('');
}

export function initTransferModalEvents() {
  const overlay = document.getElementById('modal-transfer-overlay');
  const closeBtn = document.getElementById('btn-close-transfer-modal');
  const cancelBtn = document.getElementById('btn-cancel-transfer');

  const closeModal = () => {
    const scannerSlot = document.getElementById('transfer-qr-scanner-slot');
    if (scannerSlot) scannerSlot.remove();
    document.getElementById('modal-qr-scanner-overlay')?.remove();
    attachedDocuments = [];
    selectedDest = { groupId: '', unitId: '', floorId: '', lineId: '', searchQuery: '' };
    state.set('activeMachineId', null);
    state.set('activeModal', null);
  };

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
  }

  // Live Serial Number Search & Autocomplete
  const inpSerial = document.getElementById('inp-transfer-search-serial');
  const btnFindSerial = document.getElementById('btn-search-serial-trigger');
  const btnClearSerial = document.getElementById('btn-clear-transfer-machine');
  const suggestionsBox = document.getElementById('transfer-serial-suggestions');
  const allMachines = storage.getTable(TABLE_NAMES.MACHINES) || [];

  const updateSelectedMachine = (foundMachine) => {
    if (foundMachine) {
      state.set('activeMachineId', foundMachine.id);
    } else {
      state.set('activeMachineId', null);
    }
    // Re-render modal with auto-loaded machine details
    const modalLayer = document.getElementById('modal-layer');
    if (modalLayer) {
      modalLayer.innerHTML = renderTransferModal();
      initTransferModalEvents();
      const updatedInp = document.getElementById('inp-transfer-search-serial');
      if (updatedInp) {
        if (!foundMachine) {
          updatedInp.focus({ preventScroll: true });
        }
      }
    }
  };

  if (btnClearSerial) {
    btnClearSerial.addEventListener('click', (e) => {
      e.stopPropagation();
      updateSelectedMachine(null);
    });
  }

  const performSearch = (rawVal) => {
    const q = (rawVal || '').trim().toLowerCase();
    if (!q) {
      notificationService.warning('Please enter a Machine Serial Number first.');
      if (inpSerial) inpSerial.focus({ preventScroll: true });
      return;
    }

    const exactMatch = allMachines.find(m => 
      (m.serialNumber && m.serialNumber.toString().toLowerCase() === q) ||
      (m.permanentMachineId && m.permanentMachineId.toLowerCase() === q) ||
      (m.id && m.id.toLowerCase() === q)
    );

    if (exactMatch) {
      if (suggestionsBox) suggestionsBox.style.display = 'none';
      updateSelectedMachine(exactMatch);
      notificationService.success(`Machine ${exactMatch.serialNumber} loaded successfully.`);
      return;
    }

    const partialMatch = allMachines.find(m => 
      (m.serialNumber && m.serialNumber.toString().toLowerCase().includes(q)) ||
      (m.permanentMachineId && m.permanentMachineId.toLowerCase().includes(q))
    );

    if (partialMatch) {
      if (suggestionsBox) suggestionsBox.style.display = 'none';
      updateSelectedMachine(partialMatch);
      notificationService.success(`Machine ${partialMatch.serialNumber} loaded successfully.`);
      return;
    }

    notificationService.warning(`Machine with serial number "${rawVal}" not found.`);
  };

  if (inpSerial) {
    if (!state.get('activeMachineId')) {
      // Only autofocus on desktop — on mobile this triggers keyboard-slam jitter
      if (window.innerWidth > 768) {
        setTimeout(() => inpSerial.focus({ preventScroll: true }), 50);
      }
    }

    if (suggestionsBox) {
      inpSerial.addEventListener('input', (e) => {
        const q = e.target.value.trim().toLowerCase();
        if (!q) {
          suggestionsBox.style.display = 'none';
          return;
        }

        const matches = allMachines.filter(m => 
          (m.serialNumber && m.serialNumber.toString().toLowerCase().includes(q)) ||
          (m.id && m.id.toLowerCase().includes(q)) ||
          (m.permanentMachineId && m.permanentMachineId.toLowerCase().includes(q))
        ).slice(0, 8);

        if (matches.length === 0) {
          suggestionsBox.innerHTML = `
            <div style="padding: 10px 14px; font-size: 12px; color: var(--text-muted); text-align: center;">
              No machines matching serial '${e.target.value}'.
            </div>
          `;
          suggestionsBox.style.display = 'block';
          return;
        }

        suggestionsBox.innerHTML = matches.map(m => {
          const enriched = machineService.getEnrichedMachine(m.id);
          const loc = enriched?.floor?.name || m.floor || 'Floor';
          return `
            <div class="serial-suggest-item" data-id="${m.id}" style="padding: 8px 14px; border-bottom: 1px solid rgba(255,255,255,0.06); cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: background 0.15s;">
              <div>
                <div style="font-weight: 800; color: #38bdf8; font-size: 13px; font-family: monospace;">${m.serialNumber}</div>
                <div style="font-size: 11px; color: var(--text-secondary);">${enriched?.machineName?.name || m.lineName || 'Machine'} (${enriched?.brand?.name || ''})</div>
              </div>
              <span class="badge" style="background: rgba(255,255,255,0.08); font-size: 10.5px;">📍 ${loc}</span>
            </div>
          `;
        }).join('');

        suggestionsBox.style.display = 'block';

        suggestionsBox.querySelectorAll('.serial-suggest-item').forEach(el => {
          el.addEventListener('click', () => {
            const id = el.getAttribute('data-id');
            const m = allMachines.find(x => x.id === id);
            if (m) {
              suggestionsBox.style.display = 'none';
              updateSelectedMachine(m);
            }
          });
          el.addEventListener('mouseenter', () => {
            el.style.background = 'rgba(2, 132, 199, 0.25)';
          });
          el.addEventListener('mouseleave', () => {
            el.style.background = 'transparent';
          });
        });
      });
    }

    if (btnFindSerial) {
      btnFindSerial.addEventListener('click', () => {
        performSearch(inpSerial.value);
      });
    }

    const btnScanQr = document.getElementById('btn-transfer-scan-qr');
    if (btnScanQr) {
      btnScanQr.addEventListener('click', () => {
        let scannerSlot = document.getElementById('transfer-qr-scanner-slot');
        if (!scannerSlot) {
          scannerSlot = document.createElement('div');
          scannerSlot.id = 'transfer-qr-scanner-slot';
          document.body.appendChild(scannerSlot);
        }
        scannerSlot.innerHTML = renderQrScannerModal();
        initQrScannerModalEvents({
          onScanSuccess: (decodedText) => {
            scannerSlot.innerHTML = '';
            const parsed = qrCodeService.parseQrPayload(decodedText);
            const idOrSerial = (parsed.identifier || decodedText || '').trim();
            if (!idOrSerial) return;
            const match = allMachines.find(m => 
              (m.id && m.id.toLowerCase() === idOrSerial.toLowerCase()) ||
              (m.permanentMachineId && m.permanentMachineId.toLowerCase() === idOrSerial.toLowerCase()) ||
              (m.serialNumber && m.serialNumber.toString().toLowerCase() === idOrSerial.toLowerCase())
            );
            const targetSerial = match ? match.serialNumber : idOrSerial;
            if (inpSerial) {
              inpSerial.value = targetSerial;
            }
            performSearch(targetSerial);
          },
          onManualSearchRequest: () => {
            scannerSlot.innerHTML = '';
            if (inpSerial) inpSerial.focus({ preventScroll: true });
          },
          onClose: () => {
            scannerSlot.innerHTML = '';
          }
        });
      });
    }

    inpSerial.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        performSearch(inpSerial.value);
      }
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('#inp-transfer-search-serial') && !e.target.closest('#transfer-serial-suggestions')) {
        if (suggestionsBox) suggestionsBox.style.display = 'none';
      }
    });
  }

  // 4-Tier Cascading Location Handlers & Quick Search
  const groupSelect = document.getElementById('transfer-dest-group');
  const unitSelect = document.getElementById('transfer-dest-unit');
  const floorSelect = document.getElementById('transfer-dest-floor');
  const lineSelect = document.getElementById('transfer-dest-line');
  const targetPathPreview = document.getElementById('transfer-target-path-preview');
  const inpLocSearch = document.getElementById('inp-transfer-location-search');
  const btnClearLocSearch = document.getElementById('btn-clear-location-search');
  const locSuggestionsBox = document.getElementById('transfer-location-suggestions');

  const updateTargetPathPreview = () => {
    if (targetPathPreview) {
      const gVal = groupSelect?.value;
      const uVal = unitSelect?.value;
      const fVal = floorSelect?.value;
      const lVal = lineSelect?.value;

      if (!gVal || !uVal || !fVal || !lVal) {
        targetPathPreview.style.color = '#94a3b8';
        targetPathPreview.innerHTML = '<span style="font-style: italic; font-weight: 500;">(Select Destination Below)</span>';
      } else {
        const gName = groupSelect.options[groupSelect.selectedIndex]?.text || '';
        const uName = unitSelect.options[unitSelect.selectedIndex]?.text || '';
        const fName = floorSelect.options[floorSelect.selectedIndex]?.text || '';
        const lName = lineSelect.options[lineSelect.selectedIndex]?.text || '';
        const path = [gName, uName, fName, lName].filter(Boolean).join(' > ');
        targetPathPreview.style.color = '#34d399';
        targetPathPreview.innerText = path || 'Select Destination Below';
      }
    }
  };

  const applyLocationSelection = ({ groupId, unitId, floorId, lineId, displayLabel }) => {
    selectedDest.groupId = groupId || '';
    selectedDest.unitId = unitId || '';
    selectedDest.floorId = floorId || '';
    selectedDest.lineId = lineId || '';
    selectedDest.searchQuery = displayLabel || '';

    if (inpLocSearch) {
      inpLocSearch.value = displayLabel || '';
    }
    if (btnClearLocSearch) {
      btnClearLocSearch.style.display = displayLabel ? 'block' : 'none';
    }
    if (locSuggestionsBox) {
      locSuggestionsBox.style.display = 'none';
    }

    // 1. Group
    if (groupSelect) {
      groupSelect.value = groupId;
    }

    // 2. Unit
    const units = masterDataService.getUnits(groupId, false, true);
    if (unitSelect) {
      unitSelect.disabled = false;
      unitSelect.innerHTML = `
        <option value="" disabled>-- Select Factory / Unit --</option>
        ${units.map(u => `<option value="${u.id}" ${u.id === unitId ? 'selected' : ''}>${u.name}</option>`).join('')}
      `;
      unitSelect.value = unitId;
    }

    // 3. Floor
    const floors = masterDataService.getFloors(unitId, null, false, true);
    if (floorSelect) {
      floorSelect.disabled = false;
      floorSelect.innerHTML = `
        <option value="" disabled>-- Select Floor --</option>
        ${floors.map(f => `<option value="${f.id}" ${f.id === floorId ? 'selected' : ''}>${f.name}</option>`).join('')}
      `;
      floorSelect.value = floorId;
    }

    // 4. Line
    const lines = masterDataService.getLines(floorId, null, null, false, true);
    let targetLineId = lineId;
    // If Floor was chosen and no specific line passed, auto-select first line so all 4 boxes are populated
    if (!targetLineId && lines.length > 0) {
      targetLineId = lines[0].id;
      selectedDest.lineId = targetLineId;
    }

    if (lineSelect) {
      lineSelect.disabled = false;
      lineSelect.innerHTML = `
        <option value="" disabled ${!targetLineId ? 'selected' : ''}>-- Select Production Line --</option>
        ${lines.map(l => `<option value="${l.id}" ${l.id === targetLineId ? 'selected' : ''}>${l.name}</option>`).join('')}
      `;
      if (targetLineId) {
        lineSelect.value = targetLineId;
      }
    }

    updateTargetPathPreview();
  };

  const getAllSearchableLocations = () => {
    const allGroups = masterDataService.getGroups(false);
    const allUnits = masterDataService.getUnits(null, false, true);
    const allFloors = masterDataService.getFloors(null, null, false, true);
    const allLines = masterDataService.getLines(null, null, null, false, true);

    const groupMap = new Map(allGroups.map(g => [g.id, g]));
    const unitMap = new Map(allUnits.map(u => [u.id, u]));
    const floorMap = new Map(allFloors.map(f => [f.id, f]));

    const locList = [];

    // Add Floors
    allFloors.forEach(f => {
      const u = unitMap.get(f.unitId);
      const g = u ? groupMap.get(u.groupId) : null;
      locList.push({
        type: 'FLOOR',
        typeBadge: '📍 FLOOR',
        id: f.id,
        name: f.name,
        code: f.code || '',
        floorId: f.id,
        floorName: f.name,
        unitId: u?.id || '',
        unitName: u?.name || 'Unit',
        groupId: g?.id || 'grp-1',
        groupName: g?.name || 'Group',
        lineId: '',
        lineName: '',
        searchTerms: `${f.name} ${f.code || ''} ${u?.name || ''} ${u?.code || ''}`.toLowerCase()
      });
    });

    // Add Lines
    allLines.forEach(l => {
      const f = floorMap.get(l.floorId);
      const u = f ? unitMap.get(f.unitId) : null;
      const g = u ? groupMap.get(u.groupId) : null;
      locList.push({
        type: 'LINE',
        typeBadge: '🧵 LINE',
        id: l.id,
        name: l.name,
        code: l.code || '',
        floorId: f?.id || '',
        floorName: f?.name || 'Floor',
        unitId: u?.id || '',
        unitName: u?.name || 'Unit',
        groupId: g?.id || 'grp-1',
        groupName: g?.name || 'Group',
        lineId: l.id,
        lineName: l.name,
        searchTerms: `${l.name} ${l.code || ''} ${f?.name || ''} ${u?.name || ''}`.toLowerCase()
      });
    });

    return locList;
  };

  // Quick Location Search Input & Suggestions
  if (inpLocSearch && locSuggestionsBox) {
    inpLocSearch.addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      selectedDest.searchQuery = e.target.value;
      if (btnClearLocSearch) {
        btnClearLocSearch.style.display = e.target.value ? 'block' : 'none';
      }

      if (!q) {
        locSuggestionsBox.style.display = 'none';
        return;
      }

      const allLocations = getAllSearchableLocations();
      const matches = allLocations.filter(loc => loc.searchTerms.includes(q)).slice(0, 15);

      if (matches.length === 0) {
        locSuggestionsBox.innerHTML = `
          <div style="padding: 12px 14px; font-size: 12px; color: var(--text-muted); text-align: center;">
            No floors or lines found matching "${e.target.value}".
          </div>
        `;
        locSuggestionsBox.style.display = 'block';
        return;
      }

      locSuggestionsBox.innerHTML = matches.map((item, idx) => {
        const isLine = item.type === 'LINE';
        const badgeColor = isLine ? '#38bdf8' : '#34d399';
        const badgeBg = isLine ? 'rgba(56, 189, 248, 0.15)' : 'rgba(52, 211, 153, 0.15)';
        const pathSubtitle = isLine
          ? `${item.unitName} &bull; ${item.floorName}`
          : `${item.unitName} &bull; ${item.groupName}`;

        return `
          <div class="loc-suggest-item" data-idx="${idx}" style="padding: 9px 14px; border-bottom: 1px solid rgba(255,255,255,0.06); cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: background 0.15s;">
            <div>
              <div style="font-weight: 700; color: #fff; font-size: 13px;">${item.name}</div>
              <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">
                ${pathSubtitle}
              </div>
            </div>
            <span class="badge" style="font-size: 10px; font-weight: 700; background: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeColor}40;">
              ${item.typeBadge}
            </span>
          </div>
        `;
      }).join('');

      locSuggestionsBox.style.display = 'block';

      locSuggestionsBox.querySelectorAll('.loc-suggest-item').forEach(el => {
        const itemIdx = Number(el.getAttribute('data-idx'));
        const item = matches[itemIdx];

        el.addEventListener('click', () => {
          const displayLabel = item.type === 'LINE'
            ? `${item.name} (${item.floorName} - ${item.unitName})`
            : `${item.name} (${item.unitName})`;
          applyLocationSelection({
            groupId: item.groupId,
            unitId: item.unitId,
            floorId: item.floorId,
            lineId: item.lineId,
            displayLabel
          });
        });

        el.addEventListener('mouseenter', () => {
          el.style.background = 'rgba(2, 132, 199, 0.25)';
        });
        el.addEventListener('mouseleave', () => {
          el.style.background = 'transparent';
        });
      });
    });

    if (btnClearLocSearch) {
      btnClearLocSearch.addEventListener('click', () => {
        inpLocSearch.value = '';
        btnClearLocSearch.style.display = 'none';
        locSuggestionsBox.style.display = 'none';
        selectedDest = { groupId: '', unitId: '', floorId: '', lineId: '', searchQuery: '' };

        if (groupSelect) groupSelect.value = '';
        if (unitSelect) {
          unitSelect.disabled = true;
          unitSelect.innerHTML = '<option value="" disabled selected>-- Select Group First --</option>';
        }
        if (floorSelect) {
          floorSelect.disabled = true;
          floorSelect.innerHTML = '<option value="" disabled selected>-- Select Unit First --</option>';
        }
        if (lineSelect) {
          lineSelect.disabled = true;
          lineSelect.innerHTML = '<option value="" disabled selected>-- Select Floor First --</option>';
        }
        updateTargetPathPreview();
      });
    }

    document.addEventListener('click', (e) => {
      if (!e.target.closest('#inp-transfer-location-search') && !e.target.closest('#transfer-location-suggestions') && !e.target.closest('#btn-clear-location-search')) {
        if (locSuggestionsBox) locSuggestionsBox.style.display = 'none';
      }
    });
  }

  // Manual Dropdown Cascading Changes
  if (groupSelect) {
    groupSelect.addEventListener('change', () => {
      selectedDest.groupId = groupSelect.value;
      selectedDest.unitId = '';
      selectedDest.floorId = '';
      selectedDest.lineId = '';
      selectedDest.searchQuery = '';
      if (inpLocSearch) inpLocSearch.value = '';
      if (btnClearLocSearch) btnClearLocSearch.style.display = 'none';

      const units = masterDataService.getUnits(groupSelect.value, false, true);
      if (unitSelect) {
        unitSelect.disabled = false;
        if (units.length > 0) {
          unitSelect.innerHTML = `
            <option value="" disabled selected>-- Select Factory / Unit --</option>
            ${units.map(u => `<option value="${u.id}">${u.name}</option>`).join('')}
          `;
        } else {
          unitSelect.innerHTML = '<option value="" disabled selected>No units under this group</option>';
        }
      }

      if (floorSelect) {
        floorSelect.disabled = true;
        floorSelect.innerHTML = '<option value="" disabled selected>-- Select Unit First --</option>';
      }
      if (lineSelect) {
        lineSelect.disabled = true;
        lineSelect.innerHTML = '<option value="" disabled selected>-- Select Floor First --</option>';
      }

      updateTargetPathPreview();
    });
  }

  if (unitSelect) {
    unitSelect.addEventListener('change', () => {
      selectedDest.unitId = unitSelect.value;
      selectedDest.floorId = '';
      selectedDest.lineId = '';
      selectedDest.searchQuery = '';
      if (inpLocSearch) inpLocSearch.value = '';
      if (btnClearLocSearch) btnClearLocSearch.style.display = 'none';

      const floors = masterDataService.getFloors(unitSelect.value, null, false, true);
      if (floorSelect) {
        floorSelect.disabled = false;
        if (floors.length > 0) {
          floorSelect.innerHTML = `
            <option value="" disabled selected>-- Select Floor --</option>
            ${floors.map(f => `<option value="${f.id}">${f.name}</option>`).join('')}
          `;
        } else {
          floorSelect.innerHTML = '<option value="" disabled selected>No floors under this unit</option>';
        }
      }

      if (lineSelect) {
        lineSelect.disabled = true;
        lineSelect.innerHTML = '<option value="" disabled selected>-- Select Floor First --</option>';
      }

      updateTargetPathPreview();
    });
  }

  if (floorSelect) {
    floorSelect.addEventListener('change', () => {
      selectedDest.floorId = floorSelect.value;
      selectedDest.lineId = '';
      selectedDest.searchQuery = '';
      if (inpLocSearch) inpLocSearch.value = '';
      if (btnClearLocSearch) btnClearLocSearch.style.display = 'none';

      const lines = masterDataService.getLines(floorSelect.value, null, null, false, true);
      if (lineSelect) {
        lineSelect.disabled = false;
        if (lines.length > 0) {
          lineSelect.innerHTML = `
            <option value="" disabled selected>-- Select Production Line --</option>
            ${lines.map(l => `<option value="${l.id}">${l.name}</option>`).join('')}
          `;
        } else {
          lineSelect.innerHTML = '<option value="" disabled selected>No lines under this floor</option>';
        }
      }

      updateTargetPathPreview();
    });
  }

  if (lineSelect) {
    lineSelect.addEventListener('change', () => {
      selectedDest.lineId = lineSelect.value;
      updateTargetPathPreview();
    });
  }

  updateTargetPathPreview();

  // Document Upload Dropzone & FileReader
  const dropzone = document.getElementById('transfer-doc-dropzone');
  const fileInput = document.getElementById('inp-transfer-document');
  const docsList = document.getElementById('transfer-attached-docs-list');

  const refreshDocsUI = () => {
    if (docsList) {
      docsList.innerHTML = renderAttachedDocsHtml();
      bindDocActionButtons();
    }
  };

  const handleFiles = (files) => {
    Array.from(files).forEach(f => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        attachedDocuments.push({
          name: f.name,
          size: `${Math.round(f.size / 1024)} KB`,
          type: f.type || 'application/octet-stream',
          dataUrl: ev.target.result,
          uploadedAt: new Date().toISOString()
        });
        refreshDocsUI();
      };
      reader.readAsDataURL(f);
    });
  };

  if (dropzone && fileInput) {
    dropzone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      handleFiles(e.target.files);
    });

    // Drag & Drop
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.style.background = 'rgba(56, 189, 248, 0.15)';
    });
    dropzone.addEventListener('dragleave', () => {
      dropzone.style.background = 'rgba(56, 189, 248, 0.04)';
    });
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.style.background = 'rgba(56, 189, 248, 0.04)';
      if (e.dataTransfer.files?.length) {
        handleFiles(e.dataTransfer.files);
      }
    });
  }

  const bindDocActionButtons = () => {
    document.querySelectorAll('.btn-remove-doc').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = Number(btn.getAttribute('data-idx'));
        attachedDocuments.splice(idx, 1);
        refreshDocsUI();
      });
    });

    document.querySelectorAll('.btn-replace-doc').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = Number(btn.getAttribute('data-idx'));
        attachedDocuments.splice(idx, 1);
        if (fileInput) fileInput.click();
      });
    });
  };

  bindDocActionButtons();

  // Bind View Existing Active Request button (if machine already has ongoing transfer)
  document.querySelectorAll('.btn-view-existing-active-transfer').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const reqId = btn.getAttribute('data-id');
      if (reqId) {
        closeModal();
        state.set('activeTransferRequestId', reqId);
        state.set('activeModal', 'transfer-details');
      }
    });
  });

  // Submit Request Form — Async, protected against double-click and duplicate requests
  let isSubmittingTransfer = false;
  const form = document.getElementById('form-transfer-request');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (isSubmittingTransfer) {
        console.warn('Transfer request submission already in progress.');
        return;
      }

      const submitBtn = document.getElementById('btn-submit-transfer-request') || form.querySelector('button[type="submit"]');
      const cancelBtn = document.getElementById('btn-cancel-transfer');
      const closeBtn = document.getElementById('btn-close-transfer-modal');
      const originalBtnText = submitBtn ? submitBtn.innerHTML : '🚀 Submit Transfer Request';

      let machineId = state.get('activeMachineId');
      const allM = storage.getTable(TABLE_NAMES.MACHINES) || [];

      if (!machineId) {
        const inpS = document.getElementById('inp-transfer-search-serial')?.value.trim().toLowerCase();
        if (inpS) {
          const matched = allM.find(m =>
            (m.serialNumber && m.serialNumber.toString().toLowerCase() === inpS) ||
            (m.permanentMachineId && m.permanentMachineId.toLowerCase() === inpS) ||
            (m.id && m.id.toLowerCase() === inpS)
          );
          if (matched) machineId = matched.id;
        }
      }

      if (!machineId) {
        notificationService.warning('Please enter or select a valid Machine Serial Number first.');
        const inpS = document.getElementById('inp-transfer-search-serial');
        if (inpS) inpS.focus({ preventScroll: true });
        return;
      }

      // Check if machine already has an active transfer request before proceeding
      const activeExisting = transferService.getActiveTransferForMachine(machineId);
      if (activeExisting) {
        notificationService.error(`Machine already has an active Transfer Request (#${activeExisting.requestNumber}) in status "${activeExisting.status.replace(/_/g, ' ')}". Multiple requests for the same machine are not allowed.`);
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.style.opacity = '0.5';
          submitBtn.style.cursor = 'not-allowed';
        }
        return;
      }

      if (!authService.canRequestTransfer()) {
        notificationService.error('Access Denied: You do not have permission to create a Machine Transfer Request.');
        return;
      }

      const destGroupId = groupSelect?.value;
      const destUnitId = unitSelect?.value;
      const destFloorId = floorSelect?.value;
      const destLineId = lineSelect?.value;
      const reason = document.getElementById('transfer-reason')?.value?.trim() || '';
      const remarks = document.getElementById('transfer-remarks')?.value?.trim() || '';

      if (!destGroupId || !destUnitId || !destFloorId || !destLineId) {
        notificationService.warning('Please select the Target Destination Group, Factory/Unit, Floor, and Production Line.');
        return;
      }

      // 1. Instantly disable duplicate double-clicks
      isSubmittingTransfer = true;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>⚡ Submitting...</span>';
      }

      try {
        // 2. Instant optimistic request creation
        const createdRequest = await transferService.createTransferRequest({
          machineId,
          destGroupId,
          destUnitId,
          destFloorId,
          destLineId,
          reason,
          remarks,
          documents: attachedDocuments
        });

        // 3. Close modal INSTANTLY and emit updates
        notificationService.success(`✅ Transfer Request #${createdRequest.requestNumber} submitted and saved!`, 'Transfer Request Created');
        attachedDocuments = [];
        closeModal();
        state.emit('inventory:updated');
        state.emit('transfers:updated');
        window.dispatchEvent(new CustomEvent('erp:transfers-updated'));

      } catch (err) {
        isSubmittingTransfer = false;
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalBtnText;
        }
        if (cancelBtn) cancelBtn.disabled = false;
        if (closeBtn) closeBtn.disabled = false;
        notificationService.error('Transfer Request Error: ' + err.message);
      } finally {
        isSubmittingTransfer = false;
      }
    });
  }
}
