/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Add & Edit Machine Modal Component
 * Dynamic 5-Step Cascading Logic: Category -> Machine Name -> Multiple Brands -> Multiple Models -> Physical Machine
 */

import { storage } from '../db/storage.js';
import { TABLE_NAMES, MACHINE_STATUSES } from '../db/schema.js';
import { masterDataService } from '../services/masterDataService.js';
import { customFieldService } from '../services/customFieldService.js';
import { machineService } from '../services/machineService.js';
import { authService } from '../services/authService.js';
import { notificationService } from '../services/notificationService.js';
import { smartStorageService } from '../services/smartStorageService.js?v=4.22.19';
import { formatDisplayLine } from '../services/excelService.js';
import { CloudSaveError } from '../db/storage.js';
import { qrCodeService } from '../services/qrCodeService.js';
import { renderQrScannerModal, initQrScannerModalEvents } from './qrScannerModal.js?v=4.7.4';
import { state } from '../state.js';

export function renderMachineModal() {
  const machineId = state.get('activeMachineId');
  const isEdit = Boolean(machineId);
  const machine = isEdit ? storage.getItem(TABLE_NAMES.MACHINES, machineId) : null;
  const isViewOnly = Boolean(isEdit && machine && authService.isMachineViewOnlyForUser(machine));

  const categories = masterDataService.getCategories();
  const groups = masterDataService.getGroups();
  const customFields = customFieldService.getActiveFields();

  // Determine current hierarchy IDs
  const initialMachineName = machine ? storage.getItem(TABLE_NAMES.MACHINE_NAMES, machine.machineNameId) : null;
  const currentCategoryId = initialMachineName?.categoryId || categories[0]?.id || 'cat-1';
  const rawMachineNames = masterDataService.getMachineNames(); // All machine names across all categories
  const seenMachineNames = new Set();
  const machineNames = [];
  rawMachineNames.forEach(mn => {
    if (!mn || !mn.name) return;
    let canonical = mn.name.trim();
    try {
      if (typeof smartStorageService !== 'undefined' && smartStorageService?.resolveCanonicalMachineName) {
        canonical = smartStorageService.resolveCanonicalMachineName(canonical) || canonical;
      }
    } catch (_) {}
    const norm = canonical.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!seenMachineNames.has(norm)) {
      seenMachineNames.add(norm);
      machineNames.push(mn);
    }
  });

  const currentMachineNameId = machine?.machineNameId || machineNames[0]?.id || '';
  const brands = masterDataService.getBrandsForMachineName(currentMachineNameId);

  const currentBrandId = machine?.brandId || '';
  // Load models: first try brand+machineName, fallback to machineName only
  let models = currentBrandId ? masterDataService.getModels(currentBrandId, currentMachineNameId) : [];
  if (!models.length && currentMachineNameId) {
    models = masterDataService.getModels(null, currentMachineNameId);
  }

  const currentGroupId = (machine?.groupId && groups.some(g => g.id === machine.groupId)) ? machine.groupId : (groups[0]?.id || 'grp-1');
  const units = masterDataService.getUnits(currentGroupId);
  const currentUnitId = (machine?.unitId && units.some(u => u.id === machine.unitId)) ? machine.unitId : (units[0]?.id || 'unt-1');
  const floors = masterDataService.getFloors(currentUnitId);
  const currentFloorId = (machine?.floorId && floors.some(f => f.id === machine.floorId)) ? machine.floorId : (floors[0]?.id || 'flr-1');
  const lines = masterDataService.getLines(currentFloorId);
  const currentLineId = (machine?.lineId && lines.some(l => l.id === machine.lineId)) ? machine.lineId : (lines[0]?.id || 'lin-1');

  return `
    <div class="modal-overlay" id="modal-machine-overlay">
      <div class="modal-dialog modal-dialog-lg">
        <div class="modal-header">
          <div class="modal-title">
            <span>${isViewOnly ? '👁️ Machine Details (View-Only)' : (isEdit ? '✏️ Edit Machine Record' : '➕ New Machine')}</span>
            ${isEdit ? `<span class="serial-number-badge">${machine.serialNumber}</span>` : ''}
          </div>
          <button id="btn-close-machine-modal" class="btn btn-ghost btn-sm" style="font-size: 18px;">✕</button>
        </div>

        <form id="form-machine" class="modal-body" style="display: flex; flex-direction: column; gap: 14px; flex: 1; min-height: 0; overflow-y: auto;">

          ${isViewOnly ? `
            <div style="background: rgba(56, 189, 248, 0.12); border: 1px solid rgba(56, 189, 248, 0.35); border-radius: var(--radius-md); padding: 10px 14px; font-size: 12.5px; color: #38bdf8; display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 20px;">🔒</span>
              <div>
                <strong>View-Only Machine:</strong> This machine belongs to another floor or Central Idle. You have read-only access to view its specifications, but cannot edit, relocate, or save changes.
              </div>
            </div>
          ` : ''}

          <!-- Row 1: Machine Name & Brand -->
          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Machine Name <span class="req">*</span></label>
              <select id="modal-field-machine-name" class="form-control" ${isViewOnly ? 'disabled style="opacity: 0.75; cursor: not-allowed;"' : 'required'}>
                ${machineNames.map(mn => `<option value="${mn.id}" ${currentMachineNameId === mn.id ? 'selected' : ''}>${mn.name}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Brand <span style="font-size: 11px; color: var(--text-muted); font-weight: normal;">(Optional)</span></label>
              <select id="modal-field-brand" class="form-control" ${isViewOnly ? 'disabled style="opacity: 0.75; cursor: not-allowed;"' : ''}>
                <option value="">-- No Brand (Blank) --</option>
                ${brands.map(b => `<option value="${b.id}" ${currentBrandId === b.id ? 'selected' : ''}>${b.name}</option>`).join('')}
              </select>
            </div>
          </div>

          <!-- Row 2: Model & Serial Number -->
          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Model <span style="font-size: 11px; color: var(--text-muted); font-weight: normal;">(Optional)</span></label>
              <select id="modal-field-model" class="form-control" ${isViewOnly ? 'disabled style="opacity: 0.75; cursor: not-allowed;"' : ''}>
                <option value="">-- No Model (Blank) --</option>
                ${models.map(m => `<option value="${m.id}" ${machine?.modelId === m.id ? 'selected' : ''}>${m.name}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" style="display: flex; justify-content: space-between; align-items: center;">
                <span>Serial Number <span class="req">*</span></span>
              </label>
              <div style="display: flex; gap: 8px;">
                <input
                  type="text"
                  id="modal-field-serial-number"
                  class="form-control"
                  placeholder="e.g. 1234, JA-01"
                  value="${machine?.serialNumber || ''}"
                  ${isViewOnly ? 'disabled style="opacity: 0.75; cursor: not-allowed; font-family: var(--font-mono); font-size: 14px; font-weight: 700; color: #38bdf8; flex: 1;"' : 'required style="font-family: var(--font-mono); font-size: 14px; font-weight: 700; color: #38bdf8; flex: 1;"'}
                />
                ${!isViewOnly ? `
                  <button type="button" id="btn-modal-scan-serial-qr" class="btn btn-secondary" style="border-color: #38bdf8; color: #38bdf8; font-weight: 700; white-space: nowrap; display: inline-flex; align-items: center; gap: 4px; padding: 0 12px;" title="Scan Machine QR Code / Barcode with Camera">
                    <span style="font-size: 15px;">📷</span> Scan
                  </button>
                ` : ''}
              </div>
              <div id="serial-conflict-alert" style="display: none; margin-top: 6px; font-size: 12px; color: #f87171; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 4px; padding: 6px 10px;"></div>
            </div>
          </div>

          <!-- Row 3: Unit & Floor -->
          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Unit / Factory <span class="req">*</span></label>
              <select id="modal-field-unit" class="form-control" ${isViewOnly || (isEdit && !authService.isSuperAdmin()) ? 'disabled style="opacity: 0.7; cursor: not-allowed;"' : 'required'}>
                ${units.map(u => `<option value="${u.id}" ${currentUnitId === u.id ? 'selected' : ''}>${u.name}</option>`).join('')}
              </select>
              ${isEdit && !authService.isSuperAdmin() ? `<input type="hidden" name="unitId" value="${currentUnitId}" />` : ''}
            </div>
            <div class="form-group">
              <label class="form-label">Floor <span class="req">*</span></label>
              <select id="modal-field-floor" class="form-control" ${isViewOnly || (isEdit && !authService.isSuperAdmin()) ? 'disabled style="opacity: 0.7; cursor: not-allowed;"' : 'required'}>
                ${floors.map(f => `<option value="${f.id}" ${currentFloorId === f.id ? 'selected' : ''}>${f.name}</option>`).join('')}
              </select>
              ${isEdit && !authService.isSuperAdmin() ? `<input type="hidden" name="floorId" value="${currentFloorId}" />` : ''}
            </div>
          </div>

          <!-- Row 4: Line & Status -->
          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Production Line <span class="req">*</span></label>
              <select id="modal-field-line" class="form-control" ${isViewOnly || (isEdit && !authService.isSuperAdmin()) ? 'disabled style="opacity: 0.7; cursor: not-allowed;"' : 'required'}>
                ${lines.map(l => {
                  const clean = formatDisplayLine(l.name, 'NORMAL');
                  const label = clean !== l.name ? `${clean} (${l.name})` : l.name;
                  return `<option value="${l.id}" ${currentLineId === l.id ? 'selected' : ''}>${label}</option>`;
                }).join('')}
              </select>
              ${isEdit && !authService.isSuperAdmin() ? `<input type="hidden" name="lineId" value="${currentLineId}" />` : ''}
            </div>
            <div class="form-group">
              <label class="form-label">Status <span class="req">*</span></label>
              <select id="modal-field-status" class="form-control" ${isViewOnly ? 'disabled style="opacity: 0.75; cursor: not-allowed;"' : 'required'}>
                ${MACHINE_STATUSES.map(s => `<option value="${s.id}" ${machine?.status === s.id ? 'selected' : ''}>${s.label}</option>`).join('')}
              </select>
            </div>
          </div>

          <!-- Row 5: Quantity -->
          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Quantity</label>
              <input type="number" id="modal-field-quantity" class="form-control" value="${machine?.quantity || 1}" min="1" ${isViewOnly ? 'disabled style="opacity: 0.75; cursor: not-allowed;"' : ''} />
            </div>
            <div></div>
          </div>

          <!-- Hidden fields -->
          <input type="hidden" id="modal-field-category" value="${currentCategoryId}" />
          <input type="hidden" id="modal-field-group" value="${currentGroupId}" />

        </form>

        <div class="modal-footer">
          <button type="button" id="btn-cancel-machine" class="btn btn-secondary">${isViewOnly ? 'Close' : 'Cancel'}</button>
          ${!isViewOnly ? `
            <button type="submit" form="form-machine" id="btn-save-machine" class="btn btn-primary">
              💾 ${isEdit ? 'Save Changes' : 'Register Machine'}
            </button>
          ` : ''}
        </div>
      </div>
    </div>
  `;
}

export function initMachineModalEvents() {
  const machineId = state.get('activeMachineId');
  const isEdit = Boolean(machineId);
  const machine = machineId ? storage.getItem(TABLE_NAMES.MACHINES, machineId) : null;
  const overlay = document.getElementById('modal-machine-overlay');
  const closeBtn = document.getElementById('btn-close-machine-modal');
  const cancelBtn = document.getElementById('btn-cancel-machine');

  const closeModal = () => {
    const scannerSlot = document.getElementById('machine-modal-qr-scanner-slot');
    if (scannerSlot) scannerSlot.remove();
    document.getElementById('modal-qr-scanner-overlay')?.remove();
    state.set('activeModal', null);
  };

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
  }

  // 1. Cascading Machine Name -> Brands -> Models
  const mnSelect = document.getElementById('modal-field-machine-name');
  const brandSelect = document.getElementById('modal-field-brand');
  const modelSelect = document.getElementById('modal-field-model');

  // Reload models based on current brand & machine name
  // If brand+machineName gives no results, fallback to machineName only
  const reloadModels = (preserveSelected = false) => {
    if (!modelSelect) return;
    const bId = brandSelect ? brandSelect.value : '';
    const mnId = mnSelect ? mnSelect.value : '';
    const curModelId = preserveSelected ? modelSelect.value : '';
    let models = [];
    if (bId && mnId) {
      models = masterDataService.getModels(bId, mnId);
    }
    if (!models.length && mnId) {
      models = masterDataService.getModels(null, mnId);
    }
    if (!models.length && bId) {
      models = masterDataService.getModels(bId, null);
    }
    const options = ['<option value="">-- No Model (Blank) --</option>'];
    models.forEach(m => {
      options.push(`<option value="${m.id}" ${m.id === curModelId ? 'selected' : ''}>${m.name}</option>`);
    });
    modelSelect.innerHTML = options.join('');
  };

  // Reload brands for selected machine name, then reload models
  const reloadBrands = (preserveSelected = false) => {
    if (!brandSelect) return;
    const mnId = mnSelect ? mnSelect.value : '';
    const brands = mnId ? masterDataService.getBrandsForMachineName(mnId) : masterDataService.getBrands();
    const curBrandId = preserveSelected ? brandSelect.value : '';
    const options = ['<option value="">-- No Brand (Blank) --</option>'];
    brands.forEach(b => {
      options.push(`<option value="${b.id}" ${b.id === curBrandId ? 'selected' : ''}>${b.name}</option>`);
    });
    brandSelect.innerHTML = options.join('');
    reloadModels(preserveSelected);
  };

  if (mnSelect) mnSelect.addEventListener('change', () => reloadBrands(false));
  if (brandSelect) brandSelect.addEventListener('change', () => reloadModels(false));

  // On form open: ensure models are populated while preserving selected model
  reloadModels(true);

  // Quick Add Model in Modal with Smart Auto-Correction
  const btnQuickModel = document.getElementById('btn-quick-add-model');
  if (btnQuickModel) {
    btnQuickModel.addEventListener('click', () => {
      const mnId = mnSelect.value;
      const brdId = brandSelect.value;
      const rawInput = prompt('Enter New Model Name for this Brand & Machine:');
      if (!rawInput || !rawInput.trim()) return;

      const doCreateModel = (finalModelName) => {
        try {
          const created = masterDataService.createModel({
            name: finalModelName.trim(),
            machineNameId: mnId,
            brandId: brdId,
            description: 'Created via Machine Entry Form'
          });
          const models = masterDataService.getModels(brdId, mnId);
          modelSelect.innerHTML = models.map(m => `<option value="${m.id}" ${m.id === created.id ? 'selected' : ''}>${m.name}</option>`).join('');
          notificationService.notifySuccess('Model Created', `Model '${finalModelName}' registered successfully under ${brandSelect.options[brandSelect.selectedIndex]?.text || ''}!`);
        } catch (err) {
          alert('Error: ' + err.message);
        }
      };

      const check = smartStorageService.checkCorrection('MODEL', rawInput);
      if (check && check.hasIssue) {
        smartStorageService.promptCorrection({
          original: check.original,
          suggested: check.suggested,
          issueTitle: check.issueTitle,
          context: 'Machine Model Entry',
          onConfirm: (fixed) => doCreateModel(fixed),
          onCancel: (orig) => doCreateModel(orig)
        });
      } else {
        doCreateModel(rawInput);
      }
    });
  }

  // Serial number and conflict alert elements
  const serialInp = document.getElementById('modal-field-serial-number');
  const conflictAlert = document.getElementById('serial-conflict-alert');
  const btnScanSerial = document.getElementById('btn-modal-scan-serial-qr');

  // Camera QR & Barcode Scanner for Serial Number
  if (btnScanSerial && serialInp) {
    btnScanSerial.addEventListener('click', () => {
      let scannerSlot = document.getElementById('machine-modal-qr-scanner-slot');
      if (!scannerSlot) {
        scannerSlot = document.createElement('div');
        scannerSlot.id = 'machine-modal-qr-scanner-slot';
        document.body.appendChild(scannerSlot);
      }
      scannerSlot.innerHTML = renderQrScannerModal();
      initQrScannerModalEvents({
        onScanSuccess: (decodedText) => {
          scannerSlot.innerHTML = '';
          const parsed = qrCodeService.parseQrPayload(decodedText);
          const rawId = (parsed.identifier || decodedText || '').trim();
          const allMachines = storage.getTable(TABLE_NAMES.MACHINES) || [];
          const existing = allMachines.find(m => 
            (m.id && m.id.toLowerCase() === rawId.toLowerCase()) ||
            (m.permanentMachineId && m.permanentMachineId.toLowerCase() === rawId.toLowerCase()) ||
            (m.serialNumber && m.serialNumber.toString().toLowerCase() === rawId.toLowerCase())
          );
          const scannedSerial = existing ? existing.serialNumber : rawId;
          serialInp.value = scannedSerial;
          serialInp.dispatchEvent(new Event('input'));
          serialInp.dispatchEvent(new Event('change'));
          serialInp.focus();
          notificationService.success(`Scanned Serial Number: ${scannedSerial}`);
        },
        onManualSearchRequest: () => {
          scannerSlot.innerHTML = '';
          serialInp.focus();
        },
        onClose: () => {
          scannerSlot.innerHTML = '';
        }
      });
    });
  }

  // Smart Serial Auto-Correction on Blur
  if (serialInp) {
    serialInp.addEventListener('blur', () => {
      const val = serialInp.value.trim();
      if (!val) return;

      let suggested = null;
      let issueTitle = null;

      if (val !== val.toUpperCase()) {
        suggested = val.toUpperCase();
        issueTitle = 'Lowercase letters detected in Serial Number';
      } else if (/^[A-Z]{2}\d+$/.test(val)) {
        suggested = val.slice(0, 2) + '-' + val.slice(2);
        issueTitle = 'Standard hyphen (-) missing in Serial Number';
      }

      if (suggested && suggested !== val) {
        smartStorageService.promptCorrection({
          original: val,
          suggested: suggested,
          issueTitle: issueTitle,
          context: 'Machine Serial Number',
          onConfirm: (fixed) => {
            serialInp.value = fixed;
            serialInp.dispatchEvent(new Event('input'));
          }
        });
      }
    });
  }

  // Cascading Plant Hierarchy: Group -> Unit -> Floor -> Line
  const groupSelect = document.getElementById('modal-field-group');
  const unitSelect = document.getElementById('modal-field-unit');
  const floorSelect = document.getElementById('modal-field-floor');
  const lineSelect = document.getElementById('modal-field-line');

  if (groupSelect && unitSelect) {
    groupSelect.addEventListener('change', () => {
      const units = masterDataService.getUnits(groupSelect.value);
      if (units.length > 0) {
        unitSelect.innerHTML = units.map(u => `<option value="${u.id}">${u.name}</option>`).join('');
      } else {
        unitSelect.innerHTML = '<option value="">No units under this group</option>';
      }
      unitSelect.dispatchEvent(new Event('change'));
    });
  }

  if (unitSelect && floorSelect) {
    unitSelect.addEventListener('change', () => {
      const floors = masterDataService.getFloors(unitSelect.value);
      if (floors.length > 0) {
        floorSelect.innerHTML = floors.map(f => `<option value="${f.id}">${f.name}</option>`).join('');
      } else {
        floorSelect.innerHTML = '<option value="">No floors under this unit</option>';
      }
      floorSelect.dispatchEvent(new Event('change'));
    });
  }

  if (floorSelect && lineSelect) {
    floorSelect.addEventListener('change', () => {
      const lines = masterDataService.getLines(floorSelect.value);
      if (lines.length > 0) {
        lineSelect.innerHTML = lines.map(l => {
          const clean = formatDisplayLine(l.name, 'NORMAL');
          const label = clean !== l.name ? `${clean} (${l.name})` : l.name;
          return `<option value="${l.id}">${label}</option>`;
        }).join('');
      } else {
        lineSelect.innerHTML = '<option value="">No lines under this floor</option>';
      }
      // Note: Auto serial-number generation on floor change has been intentionally removed.
      // Serial Number must always be entered manually by the user.
    });
  }

  // Auto-Generate Serial Button Click
  const btnAutoGen = document.getElementById('btn-auto-gen-serial');
  if (btnAutoGen && serialInp && floorSelect) {
    btnAutoGen.addEventListener('click', () => {
      const generated = machineService.generateNextSerialNumber(floorSelect.value);
      if (generated) {
        serialInp.value = generated;
        serialInp.dispatchEvent(new Event('input'));
        serialInp.focus({ preventScroll: true });
      }
    });
  }

  // Real-Time Duplicate Check (Composite: Machine Name + Brand + Model + Serial Number)
  // Rule: Serial Number is globally unique. All four fields matching together = Duplicate.
  if (serialInp && conflictAlert) {
    const runDuplicateCheck = () => {
      const sn = serialInp.value.trim();
      if (!sn) {
        conflictAlert.style.display = 'none';
        return;
      }

      const mnSelect = document.getElementById('modal-field-machine-name');
      const bSelect = document.getElementById('modal-field-brand');
      const mSelect = document.getElementById('modal-field-model');

      const dupCheck = machineService.checkDuplicateMachine({
        serialNumber: sn,
        machineNameId: mnSelect?.value || '',
        brandId: bSelect?.value || '',
        modelId: mSelect?.value || ''
      }, machineId);

      if (dupCheck.isDuplicate) {
        conflictAlert.style.display = 'block';
        const c = dupCheck.conflict || {};
        if (dupCheck.isCompositeDuplicate) {
          conflictAlert.innerHTML = `
            🛡️ <strong>Duplicate Record:</strong> Machine Name (${c.machineName}), Brand (${c.brand}), Model (${c.model}), Serial '${sn}' — all four fields match an existing record in the database (ID: ${c.id}) at ${c.unit} &gt; ${c.floor} &gt; ${c.line}. New entry not allowed.
          `;
        } else {
          conflictAlert.innerHTML = `
            ⚠️ <strong>Serial Number Conflict:</strong> Serial '${sn}' is already assigned to another machine (ID: ${c.id} — ${c.machineName}, ${c.model}) at ${c.unit} &gt; ${c.line}. Serial Number must be unique.
          `;
        }
      } else {
        conflictAlert.style.display = 'none';
      }
    };

    serialInp.addEventListener('input', runDuplicateCheck);
    document.getElementById('modal-field-machine-name')?.addEventListener('change', runDuplicateCheck);
    document.getElementById('modal-field-brand')?.addEventListener('change', runDuplicateCheck);
    document.getElementById('modal-field-model')?.addEventListener('change', runDuplicateCheck);
  }



  // Quick Switch to Transfer from Edit form
  const btnSwitchTransfer = document.getElementById('btn-quick-switch-to-transfer');
  if (btnSwitchTransfer) {
    btnSwitchTransfer.addEventListener('click', () => {
      closeModal();
      state.set('activeModal', 'transfer-machine');
    });
  }

  // Form Submit — Async, confirmed cloud write before closing modal
  const form = document.getElementById('form-machine');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (isEdit && machine && authService.isMachineViewOnlyForUser(machine)) {
        notificationService.error('Access Denied: You cannot modify machines outside your assigned floor.');
        return;
      }

      const saveBtn = document.getElementById('btn-save-machine');
      const originalBtnText = saveBtn ? saveBtn.innerHTML : '';

      const existingMachine = isEdit ? (machine || storage.getItem(TABLE_NAMES.MACHINES, machineId)) : null;
      const serialNumber = (document.getElementById('modal-field-serial-number')?.value || '').trim();
      const machineNameId = document.getElementById('modal-field-machine-name')?.value || '';
      const brandId = document.getElementById('modal-field-brand')?.value || '';
      const modelId = document.getElementById('modal-field-model')?.value || '';

      const groupId = document.getElementById('modal-field-group')?.value || existingMachine?.groupId || 'grp-1';
      const unitId = document.getElementById('modal-field-unit')?.value || existingMachine?.unitId || 'unt-1';
      const floorId = document.getElementById('modal-field-floor')?.value || existingMachine?.floorId || 'flr-4';
      const lineId = document.getElementById('modal-field-line')?.value || existingMachine?.lineId || 'lin-1';

      const status = document.getElementById('modal-field-status')?.value || 'ACTIVE';
      const quantity = Number(document.getElementById('modal-field-quantity')?.value) || 1;
      const remarks = document.getElementById('modal-field-remarks')?.value?.trim() || '';

      const customValues = {};
      document.querySelectorAll('.custom-field-input').forEach(inp => {
        const code = inp.getAttribute('data-code');
        if (code && inp.value !== '') {
          customValues[code] = inp.value;
        }
      });

      // ── Client-side validation BEFORE closing modal ──────────────────────────
      // Serial Number is mandatory. Show error inline so the modal stays open.
      if (!serialNumber) {
        if (conflictAlert) {
          conflictAlert.style.display = 'block';
          conflictAlert.innerHTML = '❌ <strong>Serial Number is required.</strong> Please enter a Serial Number before saving.';
        }
        const inp = document.getElementById('modal-field-serial-number');
        if (inp) { inp.focus(); inp.classList.add('input-error'); }
        return; // stop — modal stays open
      }
      if (!machineNameId) {
        if (conflictAlert) {
          conflictAlert.style.display = 'block';
          conflictAlert.innerHTML = '❌ <strong>Machine Name is required.</strong> Please select a Machine Name before saving.';
        }
        const inp = document.getElementById('modal-field-machine-name');
        if (inp) inp.focus();
        return; // stop — modal stays open
      }

      // Clear any inline error once validation passes
      if (conflictAlert) conflictAlert.style.display = 'none';
      const snInp = document.getElementById('modal-field-serial-number');
      if (snInp) snInp.classList.remove('input-error');
      // ─────────────────────────────────────────────────────────────────────────

      const machineData = {
        serialNumber,
        machineNameId,
        brandId,
        modelId,
        groupId,
        unitId,
        floorId,
        lineId,
        status,
        quantity,
        remarks,
        customValues
      };

      // Close modal only after passing client-side validation
      closeModal();

      try {
        if (isEdit) {
          const res = await machineService.updateMachine(machineId, machineData);
          if (res.pendingApproval) {
            notificationService.info(`Submitted for Admin Approval (#${res.requestId})`);
          } else {
            notificationService.success(`Machine #${serialNumber} updated`);
          }
        } else {
          await machineService.addMachine(machineData);
          notificationService.success(`Machine #${serialNumber} registered`);
          state.updateFilters({
            search: '',
            page: 1,
            sortField: 'updatedAt',
            sortOrder: 'desc'
          });
        }

        state.set('currentView', 'inventory');
        state.emit('inventory:updated');

      } catch (err) {
        // 4. Keep modal open on failure — re-enable button, show error
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.innerHTML = originalBtnText;
        }

        if (err.name === 'CloudSaveError') {
          // Distinct cloud save failure — data was not persisted to Database
          notificationService.error(err.message || '❌ Cloud Save Failed: Database write was not confirmed.');
        } else {
          // Validation errors, duplicate serial, permission errors etc.
          notificationService.error(err.message || 'Failed to save machine record.');
        }
      }
    });
  }
}
