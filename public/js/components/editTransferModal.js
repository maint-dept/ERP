/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Edit Machine Transfer Request Modal Component
 * 
 * Allows requesters or Administrators to correct destination location (Group -> Unit -> Floor -> Line),
 * reason, remarks, and documents BEFORE the transfer request is approved.
 */

import { storage } from '../db/storage.js';
import { TABLE_NAMES, TRANSFER_STATUSES } from '../db/schema.js';
import { masterDataService } from '../services/masterDataService.js';
import { transferService, resolveTransferMachineDetails } from '../services/transferService.js';
import { authService } from '../services/authService.js';
import { notificationService } from '../services/notificationService.js';
import { state } from '../state.js';

let editSelectedDest = {
  groupId: '',
  unitId: '',
  floorId: '',
  lineId: '',
  searchQuery: ''
};
let editAttachedDocs = [];

export function renderEditTransferModal() {
  const requestId = state.get('activeTransferRequestId');
  if (!requestId) {
    return `
      <div class="modal-overlay" id="modal-edit-transfer-overlay">
        <div class="modal-dialog" style="max-width: 500px; padding: 24px; text-align: center;">
          <div style="font-size: 32px; margin-bottom: 8px;">⚠️</div>
          <div style="font-size: 15px; font-weight: 700; color: #fff;">Transfer Request Not Selected</div>
          <button type="button" id="btn-close-edit-transfer-fallback" class="btn btn-secondary btn-sm" style="margin-top: 14px;">Close</button>
        </div>
      </div>
    `;
  }

  const req = transferService.getTransferRequestById(requestId);
  if (!req) {
    return `
      <div class="modal-overlay" id="modal-edit-transfer-overlay">
        <div class="modal-dialog" style="max-width: 500px; padding: 24px; text-align: center;">
          <div style="font-size: 32px; margin-bottom: 8px;">❌</div>
          <div style="font-size: 15px; font-weight: 700; color: #f87171;">Transfer Request #${requestId} Not Found</div>
          <button type="button" id="btn-close-edit-transfer-fallback" class="btn btn-secondary btn-sm" style="margin-top: 14px;">Close</button>
        </div>
      </div>
    `;
  }

  const eq = resolveTransferMachineDetails(req);
  const user = authService.getCurrentUser();
  const safeStatus = (req.status || TRANSFER_STATUSES.PENDING_APPROVAL).toString();
  const isCompleted = safeStatus === TRANSFER_STATUSES.COMPLETED;
  const isRejected = safeStatus === TRANSFER_STATUSES.REJECTED;

  if (isCompleted || isRejected) {
    return `
      <div class="modal-overlay" id="modal-edit-transfer-overlay">
        <div class="modal-dialog" style="max-width: 540px; padding: 24px; text-align: center; background: #0f172a; border: 1.5px solid #ef4444;">
          <div style="font-size: 36px; margin-bottom: 8px;">🔒</div>
          <div style="font-size: 16px; font-weight: 800; color: #f87171;">Transfer Request Already Finalized</div>
          <div style="font-size: 12.5px; color: #cbd5e1; margin-top: 8px; line-height: 1.5;">
            Transfer Request <strong>#${req.requestNumber || req.id || 'TR-REQ'}</strong> is in <strong>${safeStatus.replace(/_/g, ' ')}</strong> state. 
            Destination location can only be edited before official approval is completed.
          </div>
          <button type="button" id="btn-close-edit-transfer-fallback" class="btn btn-secondary" style="margin-top: 16px;">
            Return to Details
          </button>
        </div>
      </div>
    `;
  }

  // Pre-seed selected destination from existing request if not already modified
  if (!editSelectedDest.groupId && !editSelectedDest.unitId) {
    editSelectedDest.groupId = req.destGroupId || '';
    editSelectedDest.unitId = req.destUnitId || '';
    editSelectedDest.floorId = req.destFloorId || '';
    editSelectedDest.lineId = req.destLineId || '';
  }
  editAttachedDocs = [...(req.documents || [])];

  const groups = masterDataService.getGroups();
  const destGroupId = editSelectedDest.groupId || req.destGroupId || '';
  const units = destGroupId ? masterDataService.getUnits(destGroupId, false, true) : [];
  const destUnitId = editSelectedDest.unitId || req.destUnitId || '';
  const floors = destUnitId ? masterDataService.getFloors(destUnitId, null, false, true) : [];
  const destFloorId = editSelectedDest.floorId || req.destFloorId || '';
  const lines = destFloorId ? masterDataService.getLines(destFloorId, null, null, false, true) : [];
  const destLineId = editSelectedDest.lineId || req.destLineId || '';

  return `
    <div class="modal-overlay" id="modal-edit-transfer-overlay">
      <div class="modal-dialog modal-dialog-lg" style="max-width: 880px; max-height: 90vh; display: flex; flex-direction: column; min-height: 0;">
        
        <!-- Modal Header -->
        <div class="modal-header" style="background: var(--bg-card); border-bottom: 1px solid var(--border-color); padding: 16px 22px;">
          <div class="modal-title" style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 20px;">✏️</span>
            <div>
              <div style="font-size: 16px; font-weight: 800; color: #fff;">
                Edit Transfer Request — <span style="color: #38bdf8; font-family: var(--font-mono);">${req.requestNumber}</span>
              </div>
              <div style="font-size: 11px; color: #fbbf24; font-weight: 600;">
                Correct Target Destination Location &bull; Update Setup Remarks &bull; Allowed Before Approval
              </div>
            </div>
          </div>
          <button id="btn-close-edit-transfer-modal" class="btn btn-ghost btn-sm" style="font-size: 18px;">✕</button>
        </div>

        <form id="form-edit-transfer-request" class="modal-body" style="padding: 20px 24px; display: flex; flex-direction: column; gap: 16px; overflow-y: auto; flex: 1; min-height: 0;">
          
          <!-- Machine & Source Location (Locked Read-Only) -->
          <div style="background: rgba(15, 23, 42, 0.7); border: 1.5px solid rgba(56, 189, 248, 0.35); border-radius: var(--radius-lg); padding: 14px 16px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px;">
              <div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="font-size: 15px; font-weight: 800; color: #fff;">${eq.machineName}</span>
                  <span class="badge" style="background: rgba(2, 132, 199, 0.3); color: #38bdf8; font-family: var(--font-mono); font-weight: 800; font-size: 12px; border: 1px solid rgba(56, 189, 248, 0.4);">
                    SN: ${eq.serialNumber}
                  </span>
                  <span class="badge badge-idle" style="font-size: 10px;">
                    ${safeStatus.replace(/_/g, ' ')}
                  </span>
                </div>
                <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">
                  <strong>Brand &amp; Model:</strong> ${eq.brandModelText} | 
                  <strong>Category:</strong> ${eq.category}
                </div>
              </div>

              <!-- Locked Source Location -->
              <div style="text-align: right;">
                <div style="font-size: 10px; font-weight: 700; color: #f87171; text-transform: uppercase;">
                  🔒 Source Location (Locked Current Physical Location)
                </div>
                <div style="font-size: 13px; font-weight: 800; color: #fff; margin-top: 2px;">
                  ${req.sourcePath}
                </div>
              </div>
            </div>
          </div>

          <!-- Route Visualizer -->
          <div style="background: rgba(0,0,0,0.3); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; gap: 10px;">
            <div style="flex: 1;">
              <div style="font-size: 10px; color: #f87171; font-weight: 700; text-transform: uppercase;">Current Source</div>
              <div style="font-size: 12.5px; font-weight: 800; color: #fff; line-height: 1.4;">${req.sourcePath}</div>
            </div>
            <div style="font-size: 20px; color: #fbbf24; font-weight: 800;">➔</div>
            <div style="flex: 1; text-align: right;">
              <div style="font-size: 10px; color: #34d399; font-weight: 700; text-transform: uppercase;">New Destination (To)</div>
              <div id="edit-transfer-target-preview" style="font-size: 12.5px; font-weight: 800; color: #34d399; line-height: 1.4;">
                ${req.destPath}
              </div>
            </div>
          </div>

          <!-- STEP 2: SELECT NEW DESTINATION LOCATION (GROUP -> UNIT -> FLOOR -> LINE) -->
          <div style="background: var(--bg-card); border: 1.5px solid var(--border-color); border-radius: var(--radius-lg); padding: 16px 18px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <div style="font-size: 12.5px; font-weight: 800; color: #34d399; text-transform: uppercase; display: flex; align-items: center; gap: 6px;">
                <span>📍 Correct Target Destination (Group &rarr; Unit &rarr; Floor &rarr; Line)</span>
              </div>
              <span class="badge badge-active" style="font-size: 10px;">4-Tier Plant Hierarchy</span>
            </div>

            <!-- Quick Location Search Bar -->
            <div style="background: rgba(15, 23, 42, 0.65); border: 1px solid rgba(56, 189, 248, 0.35); border-radius: var(--radius-md); padding: 12px 14px; margin-bottom: 14px; position: relative;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <label for="inp-edit-loc-search" style="font-size: 12px; font-weight: 700; color: #38bdf8; display: flex; align-items: center; gap: 6px; margin: 0;">
                  <span>🔍 Quick Location Search</span>
                  <span style="font-size: 11px; font-weight: 400; color: #94a3b8;">(Search any Floor or Line name)</span>
                </label>
                <span style="font-size: 10.5px; color: #34d399; font-weight: 600;">✨ Auto fills 4 dropdowns below</span>
              </div>
              <div style="position: relative;">
                <span style="position: absolute; left: 14px; top: 50%; transform: translateY(-50%); font-size: 15px; pointer-events: none; z-index: 5; line-height: 1;">📍</span>
                <input 
                  type="text" 
                  id="inp-edit-loc-search" 
                  class="form-control has-icon-left" 
                  placeholder="Type Floor or Line (e.g. Jamuna, Size Set, Eyelet, APW)..." 
                  autocomplete="off"
                  style="font-size: 13.5px; font-weight: 600; color: #ffffff !important; background: rgba(15, 23, 42, 0.9); border: 1.5px solid rgba(56, 189, 248, 0.5); padding-left: 44px !important; padding-right: 36px !important; height: 40px;"
                />
                <button type="button" id="btn-clear-edit-loc-search" title="Clear search" style="display: none; position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.4); color: #f87171; border-radius: 4px; font-size: 11px; cursor: pointer; padding: 3px 8px; z-index: 5; font-weight: 700;">✕</button>
              </div>

              <!-- Floating Suggestions Dropdown -->
              <div id="edit-location-suggestions" style="display: none; position: absolute; left: 14px; right: 14px; top: 100%; z-index: 1000; background: #0b1329; border: 1.5px solid #38bdf8; border-radius: var(--radius-md); max-height: 220px; overflow-y: auto; box-shadow: 0 12px 36px rgba(0,0,0,0.85); margin-top: 4px;"></div>
            </div>

            <!-- 4 Dropdowns -->
            <div class="form-grid-2">
              <div class="form-group">
                <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">1. Destination Group <span class="req">*</span></label>
                <select id="edit-dest-group" class="filter-select" required style="background: #0f172a; color: #ffffff; border: 1.5px solid #475569; font-size: 13.5px; font-weight: 600; height: 40px; border-radius: 6px;">
                  <option value="" disabled ${!destGroupId ? 'selected' : ''}>-- Select Destination Group --</option>
                  ${groups.map(g => `<option value="${g.id}" ${destGroupId === g.id ? 'selected' : ''}>${g.name}</option>`).join('')}
                </select>
              </div>

              <div class="form-group">
                <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">2. Destination Factory / Unit <span class="req">*</span></label>
                <select id="edit-dest-unit" class="filter-select" required ${!destGroupId ? "disabled" : ""} style="background: #0f172a; color: #ffffff; border: 1.5px solid #475569; font-size: 13.5px; font-weight: 600; height: 40px; border-radius: 6px;">
                  <option value="" disabled ${!destUnitId ? 'selected' : ''}>${destGroupId ? '-- Select Factory / Unit --' : '-- Select Group First --'}</option>
                  ${units.map(u => `<option value="${u.id}" ${destUnitId === u.id ? 'selected' : ''}>${u.name}</option>`).join('')}
                </select>
              </div>

              <div class="form-group">
                <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">3. Destination Floor <span class="req">*</span></label>
                <select id="edit-dest-floor" class="filter-select" required ${!destUnitId ? "disabled" : ""} style="background: #0f172a; color: #ffffff; border: 1.5px solid #475569; font-size: 13.5px; font-weight: 600; height: 40px; border-radius: 6px;">
                  <option value="" disabled ${!destFloorId ? 'selected' : ''}>${destUnitId ? '-- Select Floor --' : '-- Select Unit First --'}</option>
                  ${floors.map(f => `<option value="${f.id}" ${destFloorId === f.id ? 'selected' : ''}>${f.name}</option>`).join('')}
                </select>
              </div>

              <div class="form-group">
                <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">4. Destination Production Line <span class="req">*</span></label>
                <select id="edit-dest-line" class="filter-select" required ${!destFloorId ? "disabled" : ""} style="background: #0f172a; color: #ffffff; border: 1.5px solid #475569; font-size: 13.5px; font-weight: 600; height: 40px; border-radius: 6px;">
                  <option value="" disabled ${!destLineId ? 'selected' : ''}>${destFloorId ? '-- Select Production Line --' : '-- Select Floor First --'}</option>
                  ${lines.map(l => `<option value="${l.id}" ${destLineId === l.id ? 'selected' : ''}>${l.name}</option>`).join('')}
                </select>
              </div>

              <div class="form-group full-width">
                <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Transfer Reason / Order Reference</label>
                <input type="text" id="edit-transfer-reason" class="form-control" value="${req.reason || ''}" placeholder="e.g. Line re-balancing for jacket production order" style="background: #0f172a; color: #ffffff; border: 1.5px solid #475569; font-size: 13.5px; font-weight: 600; height: 40px; border-radius: 6px;" />
              </div>

              <div class="form-group full-width">
                <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Remarks / Setup Instructions (Optional)</label>
                <textarea id="edit-transfer-remarks" class="form-control" rows="2" placeholder="e.g. Requires 380V heavy line setup, attachment folder pre-installed" style="background: #0f172a; color: #ffffff; border: 1.5px solid #475569; font-size: 13.5px; font-weight: 600; border-radius: 6px;">${req.remarks || ''}</textarea>
              </div>
            </div>
          </div>

          <!-- Supporting Documents Section -->
          <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 14px 18px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span style="font-size: 12px; font-weight: 700; color: #38bdf8;">
                📎 Attached Documents (${(req.documents || []).length})
              </span>
              <label class="btn btn-secondary btn-sm" style="cursor: pointer; font-size: 11px; padding: 4px 10px;">
                ➕ Attach File
                <input type="file" id="inp-edit-attach-doc" accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls" multiple style="display: none;" />
              </label>
            </div>
            <div id="edit-attached-docs-list" style="display: flex; flex-direction: column; gap: 6px;">
              ${renderEditAttachedDocsHtml()}
            </div>
          </div>
        </form>

        <!-- Modal Footer -->
        <div class="modal-footer" style="background: var(--bg-card); border-top: 1px solid var(--border-color); padding: 14px 22px; display: flex; justify-content: space-between; align-items: center;">
          <div style="font-size: 11.5px; color: var(--text-muted);">
            Original Requester: <strong style="color: #38bdf8;">${req.requestedByName || 'User'}</strong> &bull; Current Stage: <strong style="color: #fbbf24;">Level ${req.currentLevel}/${req.totalLevels}</strong>
          </div>
          <div style="display: flex; gap: 10px;">
            <button type="button" id="btn-cancel-edit-transfer" class="btn btn-secondary">Cancel</button>
            <button type="submit" form="form-edit-transfer-request" id="btn-save-edit-transfer" class="btn btn-primary" style="font-weight: 800; padding: 8px 22px; background: linear-gradient(135deg, #0284c7, #0369a1); border-color: #38bdf8;">
              💾 Save &amp; Update Transfer Request
            </button>
          </div>
        </div>

      </div>
    </div>
  `;
}

function renderEditAttachedDocsHtml() {
  if (editAttachedDocs.length === 0) {
    return `<div style="font-size: 11px; color: var(--text-muted); font-style: italic;">No documents attached.</div>`;
  }
  return editAttachedDocs.map((doc, idx) => `
    <div style="background: var(--bg-surface); border: 1px solid rgba(56, 189, 248, 0.2); border-radius: 4px; padding: 6px 10px; display: flex; justify-content: space-between; align-items: center; font-size: 11.5px;">
      <div>
        <strong style="color: #fff;">📄 ${doc.name}</strong>
        <span style="color: var(--text-muted); margin-left: 6px;">(${doc.size || 'Attachment'})</span>
      </div>
      <button type="button" class="btn-remove-edit-doc" data-idx="${idx}" style="background: none; border: none; color: #f87171; cursor: pointer; font-weight: 800; font-size: 13px;" title="Remove attachment">✕</button>
    </div>
  `).join('');
}

export function initEditTransferModalEvents() {
  const overlay = document.getElementById('modal-edit-transfer-overlay');
  const closeBtn = document.getElementById('btn-close-edit-transfer-modal');
  const cancelBtn = document.getElementById('btn-cancel-edit-transfer');
  const fallbackCloseBtn = document.getElementById('btn-close-edit-transfer-fallback');

  const closeModal = () => {
    editSelectedDest = { groupId: '', unitId: '', floorId: '', lineId: '', searchQuery: '' };
    editAttachedDocs = [];
    state.set('activeModal', 'transfer-details');
  };

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
  if (fallbackCloseBtn) fallbackCloseBtn.addEventListener('click', () => state.set('activeModal', null));

  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
  }

  const requestId = state.get('activeTransferRequestId');
  const req = transferService.getTransferRequestById(requestId);
  if (!req) return;

  const groupSelect = document.getElementById('edit-dest-group');
  const unitSelect = document.getElementById('edit-dest-unit');
  const floorSelect = document.getElementById('edit-dest-floor');
  const lineSelect = document.getElementById('edit-dest-line');
  const targetPreview = document.getElementById('edit-transfer-target-preview');
  const inpLocSearch = document.getElementById('inp-edit-loc-search');
  const btnClearLocSearch = document.getElementById('btn-clear-edit-loc-search');
  const locSuggestionsBox = document.getElementById('edit-location-suggestions');

  const updatePreview = () => {
    if (targetPreview) {
      const gName = groupSelect?.options[groupSelect.selectedIndex]?.text || '';
      const uName = unitSelect?.options[unitSelect.selectedIndex]?.text || '';
      const fName = floorSelect?.options[floorSelect.selectedIndex]?.text || '';
      const lName = lineSelect?.options[lineSelect.selectedIndex]?.text || '';
      const path = [gName, uName, fName, lName].filter(x => x && !x.startsWith('--')).join(' > ');
      targetPreview.innerText = path || req.destPath || 'Select Destination Below';
    }
  };

  // Group change
  if (groupSelect) {
    groupSelect.addEventListener('change', () => {
      editSelectedDest.groupId = groupSelect.value;
      editSelectedDest.unitId = '';
      editSelectedDest.floorId = '';
      editSelectedDest.lineId = '';

      const units = masterDataService.getUnits(groupSelect.value, false, true);
      if (unitSelect) {
        unitSelect.disabled = false;
        unitSelect.innerHTML = `
          <option value="" disabled selected>-- Select Factory / Unit --</option>
          ${units.map(u => `<option value="${u.id}">${u.name}</option>`).join('')}
        `;
      }
      if (floorSelect) {
        floorSelect.disabled = true;
        floorSelect.innerHTML = '<option value="" disabled selected>-- Select Unit First --</option>';
      }
      if (lineSelect) {
        lineSelect.disabled = true;
        lineSelect.innerHTML = '<option value="" disabled selected>-- Select Floor First --</option>';
      }
      updatePreview();
    });
  }

  // Unit change
  if (unitSelect) {
    unitSelect.addEventListener('change', () => {
      editSelectedDest.unitId = unitSelect.value;
      editSelectedDest.floorId = '';
      editSelectedDest.lineId = '';

      const floors = masterDataService.getFloors(unitSelect.value, null, false, true);
      if (floorSelect) {
        floorSelect.disabled = false;
        floorSelect.innerHTML = `
          <option value="" disabled selected>-- Select Floor --</option>
          ${floors.map(f => `<option value="${f.id}">${f.name}</option>`).join('')}
        `;
      }
      if (lineSelect) {
        lineSelect.disabled = true;
        lineSelect.innerHTML = '<option value="" disabled selected>-- Select Floor First --</option>';
      }
      updatePreview();
    });
  }

  // Floor change
  if (floorSelect) {
    floorSelect.addEventListener('change', () => {
      editSelectedDest.floorId = floorSelect.value;
      editSelectedDest.lineId = '';

      const lines = masterDataService.getLines(floorSelect.value, null, null, false, true);
      if (lineSelect) {
        lineSelect.disabled = false;
        lineSelect.innerHTML = `
          <option value="" disabled selected>-- Select Production Line --</option>
          ${lines.map(l => `<option value="${l.id}">${l.name}</option>`).join('')}
        `;
      }
      updatePreview();
    });
  }

  // Line change
  if (lineSelect) {
    lineSelect.addEventListener('change', () => {
      editSelectedDest.lineId = lineSelect.value;
      updatePreview();
    });
  }

  // Quick Location Search
  const applyQuickLoc = ({ groupId, unitId, floorId, lineId, displayLabel }) => {
    editSelectedDest.groupId = groupId;
    editSelectedDest.unitId = unitId;
    editSelectedDest.floorId = floorId;
    editSelectedDest.lineId = lineId;

    if (inpLocSearch) inpLocSearch.value = displayLabel;
    if (btnClearLocSearch) btnClearLocSearch.style.display = 'block';
    if (locSuggestionsBox) locSuggestionsBox.style.display = 'none';

    if (groupSelect) groupSelect.value = groupId;

    const units = masterDataService.getUnits(groupId, false, true);
    if (unitSelect) {
      unitSelect.disabled = false;
      unitSelect.innerHTML = `
        <option value="" disabled>-- Select Factory / Unit --</option>
        ${units.map(u => `<option value="${u.id}" ${u.id === unitId ? 'selected' : ''}>${u.name}</option>`).join('')}
      `;
      unitSelect.value = unitId;
    }

    const floors = masterDataService.getFloors(unitId, null, false, true);
    if (floorSelect) {
      floorSelect.disabled = false;
      floorSelect.innerHTML = `
        <option value="" disabled>-- Select Floor --</option>
        ${floors.map(f => `<option value="${f.id}" ${f.id === floorId ? 'selected' : ''}>${f.name}</option>`).join('')}
      `;
      floorSelect.value = floorId;
    }

    const lines = masterDataService.getLines(floorId, null, null, false, true);
    let targetLineId = lineId;
    if (!targetLineId && lines.length > 0) targetLineId = lines[0].id;
    editSelectedDest.lineId = targetLineId;

    if (lineSelect) {
      lineSelect.disabled = false;
      lineSelect.innerHTML = `
        <option value="" disabled ${!targetLineId ? 'selected' : ''}>-- Select Production Line --</option>
        ${lines.map(l => `<option value="${l.id}" ${l.id === targetLineId ? 'selected' : ''}>${l.name}</option>`).join('')}
      `;
      if (targetLineId) lineSelect.value = targetLineId;
    }

    updatePreview();
  };

  const getSearchableLocs = () => {
    const allGroups = masterDataService.getGroups(false);
    const allUnits = masterDataService.getUnits(null, false, true);
    const allFloors = masterDataService.getFloors(null, null, false, true);
    const allLines = masterDataService.getLines(null, null, null, false, true);

    const groupMap = new Map(allGroups.map(g => [g.id, g]));
    const unitMap = new Map(allUnits.map(u => [u.id, u]));
    const floorMap = new Map(allFloors.map(f => [f.id, f]));

    const list = [];
    allFloors.forEach(f => {
      const u = unitMap.get(f.unitId);
      const g = u ? groupMap.get(u.groupId) : null;
      list.push({
        type: 'FLOOR',
        typeBadge: '📍 FLOOR',
        id: f.id,
        name: f.name,
        floorId: f.id,
        unitId: u?.id || '',
        groupId: g?.id || '',
        displayPath: `${g ? g.name + ' > ' : ''}${u ? u.name + ' > ' : ''}${f.name}`
      });
    });

    allLines.forEach(l => {
      const f = floorMap.get(l.floorId);
      const u = f ? unitMap.get(f.unitId) : null;
      const g = u ? groupMap.get(u.groupId) : null;
      list.push({
        type: 'LINE',
        typeBadge: '🧵 LINE',
        id: l.id,
        name: l.name,
        lineId: l.id,
        floorId: f?.id || '',
        unitId: u?.id || '',
        groupId: g?.id || '',
        displayPath: `${u ? u.name + ' > ' : ''}${f ? f.name + ' > ' : ''}${l.name}`
      });
    });

    return list;
  };

  if (inpLocSearch && locSuggestionsBox) {
    const allLocs = getSearchableLocs();

    inpLocSearch.addEventListener('input', (e) => {
      const term = e.target.value.trim().toLowerCase();
      if (!term) {
        locSuggestionsBox.style.display = 'none';
        if (btnClearLocSearch) btnClearLocSearch.style.display = 'none';
        return;
      }
      if (btnClearLocSearch) btnClearLocSearch.style.display = 'block';

      const matches = allLocs.filter(loc =>
        loc.name.toLowerCase().includes(term) || loc.displayPath.toLowerCase().includes(term)
      ).slice(0, 8);

      if (matches.length === 0) {
        locSuggestionsBox.innerHTML = `
          <div style="padding: 10px 14px; font-size: 11.5px; color: var(--text-muted); text-align: center;">
            No locations matching "${e.target.value}".
          </div>
        `;
        locSuggestionsBox.style.display = 'block';
        return;
      }

      locSuggestionsBox.innerHTML = matches.map(m => `
        <div class="edit-loc-suggest-item" data-type="${m.type}" data-group="${m.groupId}" data-unit="${m.unitId}" data-floor="${m.floorId}" data-line="${m.lineId || ''}" data-label="${m.name}" style="padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,0.06); cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: background 0.15s;">
          <div>
            <span style="font-size: 10px; font-weight: 800; padding: 1px 5px; border-radius: 3px; background: rgba(56, 189, 248, 0.15); color: #38bdf8; margin-right: 6px;">${m.typeBadge}</span>
            <strong style="font-size: 12.5px; color: #fff;">${m.name}</strong>
            <div style="font-size: 10.5px; color: #94a3b8; margin-top: 1px;">${m.displayPath}</div>
          </div>
        </div>
      `).join('');

      locSuggestionsBox.style.display = 'block';

      locSuggestionsBox.querySelectorAll('.edit-loc-suggest-item').forEach(el => {
        el.addEventListener('mouseenter', () => el.style.background = 'rgba(56, 189, 248, 0.15)');
        el.addEventListener('mouseleave', () => el.style.background = 'transparent');
        el.addEventListener('click', () => {
          applyQuickLoc({
            groupId: el.getAttribute('data-group'),
            unitId: el.getAttribute('data-unit'),
            floorId: el.getAttribute('data-floor'),
            lineId: el.getAttribute('data-line'),
            displayLabel: el.getAttribute('data-label')
          });
        });
      });
    });

    if (btnClearLocSearch) {
      btnClearLocSearch.addEventListener('click', () => {
        inpLocSearch.value = '';
        btnClearLocSearch.style.display = 'none';
        locSuggestionsBox.style.display = 'none';
      });
    }

    document.addEventListener('click', (e) => {
      if (!e.target.closest('#inp-edit-loc-search') && !e.target.closest('#edit-location-suggestions')) {
        locSuggestionsBox.style.display = 'none';
      }
    });
  }

  // Documents
  const bindDocsList = () => {
    const listEl = document.getElementById('edit-attached-docs-list');
    if (listEl) {
      listEl.innerHTML = renderEditAttachedDocsHtml();
      listEl.querySelectorAll('.btn-remove-edit-doc').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = Number(btn.getAttribute('data-idx'));
          editAttachedDocs.splice(idx, 1);
          bindDocsList();
        });
      });
    }
  };
  bindDocsList();

  const inpAttach = document.getElementById('inp-edit-attach-doc');
  if (inpAttach) {
    inpAttach.addEventListener('change', (e) => {
      const files = Array.from(e.target.files || []);
      const user = authService.getCurrentUser();
      files.forEach(f => {
        const reader = new FileReader();
        reader.onload = (evt) => {
          editAttachedDocs.push({
            id: `doc-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            name: f.name,
            type: f.type || 'application/octet-stream',
            size: `${Math.round(f.size / 1024)} KB`,
            dataUrl: evt.target.result,
            uploadedBy: user?.id || 'usr-1',
            uploadedByName: user?.name || 'User',
            uploadedAt: new Date().toISOString(),
            approvalLevel: req.currentLevel || 1
          });
          bindDocsList();
        };
        reader.readAsDataURL(f);
      });
    });
  }

  // Form Submit
  let isSubmittingEdit = false;
  const form = document.getElementById('form-edit-transfer-request');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (isSubmittingEdit) return;

      const submitBtn = document.getElementById('btn-save-edit-transfer');
      const cancelBtn = document.getElementById('btn-cancel-edit-transfer');
      const closeBtn = document.getElementById('btn-close-edit-transfer-modal');
      const originalText = submitBtn ? submitBtn.innerHTML : '💾 Save & Update Transfer Request';

      try {
        const destGroupId = groupSelect?.value;
        const destUnitId = unitSelect?.value;
        const destFloorId = floorSelect?.value;
        const destLineId = lineSelect?.value;
        const reason = document.getElementById('edit-transfer-reason')?.value?.trim() || '';
        const remarks = document.getElementById('edit-transfer-remarks')?.value?.trim() || '';

        if (!destGroupId || !destUnitId || !destFloorId || !destLineId) {
          notificationService.warning('Please select Destination Group, Unit, Floor, and Production Line.');
          return;
        }

        // Check if target is identical to machine's current location
        const machine = storage.getItem(TABLE_NAMES.MACHINES, req.machineId);
        if (machine && machine.unitId === destUnitId && machine.floorId === destFloorId && machine.lineId === destLineId) {
          notificationService.error('Invalid Destination: Target Line is identical to the machine\'s current physical location.');
          return;
        }

        const docsToSubmit = [...editAttachedDocs];
        editSelectedDest = { groupId: '', unitId: '', floorId: '', lineId: '', searchQuery: '' };
        editAttachedDocs = [];

        // 1. Close modal instantly
        closeModal();

        // 2. Execute update (<1ms)
        const updated = await transferService.updateTransferRequest(req.id, {
          destGroupId,
          destUnitId,
          destFloorId,
          destLineId,
          reason,
          remarks,
          documents: docsToSubmit
        });

        notificationService.success(`Destination updated to ${updated.destPath}`);
        state.set('activeModal', 'transfer-details');
        state.emit('inventory:updated');
      } catch (err) {
        isSubmittingEdit = false;
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.style.opacity = '1';
          submitBtn.style.cursor = 'pointer';
          submitBtn.innerHTML = originalText;
        }
        if (cancelBtn) cancelBtn.disabled = false;
        if (closeBtn) closeBtn.disabled = false;

        notificationService.error('Update Error: ' + err.message);
      } finally {
        isSubmittingEdit = false;
      }
    });
  }
}
