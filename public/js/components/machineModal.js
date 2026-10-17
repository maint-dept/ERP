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
import { excelService, formatDisplayLine } from '../services/excelService.js';
import { CloudSaveError } from '../db/storage.js';
import { qrCodeService } from '../services/qrCodeService.js';
import { renderQrScannerModal, initQrScannerModalEvents } from './qrScannerModal.js?v=4.7.4';
import { state } from '../state.js';

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatForDateInput(rawVal) {
  if (!rawVal) return '';
  const s = String(rawVal).trim();
  if (!s || s === '—' || s === 'N/A' || s === 'None' || s === '-') return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  try {
    // 1. Matches YYYY-MM-DD or YYYY/MM/DD
    let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:T.*)?$/);
    if (m) {
      return `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
    }
    // 2. Matches DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
    m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (m) {
      const p1 = parseInt(m[1], 10);
      const p2 = parseInt(m[2], 10);
      const yr = m[3];
      if (p2 > 12 && p1 <= 12) {
        return `${yr}-${String(p1).padStart(2, '0')}-${String(p2).padStart(2, '0')}`;
      }
      return `${yr}-${String(p2).padStart(2, '0')}-${String(p1).padStart(2, '0')}`;
    }
    const dt = new Date(s);
    if (!isNaN(dt.getTime())) {
      const yyyy = dt.getFullYear();
      const mm = String(dt.getMonth() + 1).padStart(2, '0');
      const dd = String(dt.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
  } catch (_) {}
  return '';
}

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
  // Load models: first try brand+machineName, fallback to machineName only, fallback to brand only
  let models = currentBrandId ? masterDataService.getModels(currentBrandId, currentMachineNameId) : [];
  if (!models.length && currentMachineNameId) {
    models = masterDataService.getModels(null, currentMachineNameId);
  }
  if (!models.length && currentBrandId) {
    models = masterDataService.getModels(currentBrandId, null);
  }

  // Resolve machine's existing model (by modelId or by model name string)
  let activeModelId = machine?.modelId || '';
  const activeModelName = String(machine?.model || machine?.modelName || machine?.modelStr || machine?.customValues?.model || '').trim();

  const allModelsTable = storage.getTable(TABLE_NAMES.MODELS) || [];
  let existingModelObj = activeModelId ? (storage.getItem(TABLE_NAMES.MODELS, activeModelId) || masterDataService.getModelById(activeModelId)) : null;
  if (!existingModelObj && activeModelName) {
    existingModelObj = allModelsTable.find(m => (m.name || '').trim().toLowerCase() === activeModelName.toLowerCase() && (!currentBrandId || m.brandId === currentBrandId));
    if (!existingModelObj) {
      existingModelObj = allModelsTable.find(m => (m.name || '').trim().toLowerCase() === activeModelName.toLowerCase());
    }
  }
  if (existingModelObj) {
    activeModelId = existingModelObj.id;
  }

  // Deduplicate and ensure existing model is included in models list
  const seenModelNames = new Set();
  const uniqueModels = [];

  if (existingModelObj) {
    seenModelNames.add((existingModelObj.name || '').trim().toLowerCase());
    uniqueModels.push(existingModelObj);
  } else if (activeModelName) {
    seenModelNames.add(activeModelName.toLowerCase());
    uniqueModels.push({
      id: activeModelId || activeModelName,
      name: activeModelName,
      brandId: currentBrandId
    });
    if (!activeModelId) activeModelId = activeModelName;
  }

  models.forEach(m => {
    if (!m || !m.name) return;
    const norm = m.name.trim().toLowerCase();
    if (!seenModelNames.has(norm)) {
      seenModelNames.add(norm);
      uniqueModels.push(m);
    }
  });
  models = uniqueModels;

  const currentGroupId = (machine?.groupId && groups.some(g => g.id === machine.groupId)) ? machine.groupId : (groups[0]?.id || 'grp-1');
  const units = masterDataService.getUnits(currentGroupId);
  const currentUnitId = (machine?.unitId && units.some(u => u.id === machine.unitId)) ? machine.unitId : (units[0]?.id || 'unt-1');
  const floors = masterDataService.getFloors(currentUnitId);
  const currentFloorId = (machine?.floorId && floors.some(f => f.id === machine.floorId)) ? machine.floorId : (floors[0]?.id || 'flr-1');
  const lines = masterDataService.getLines(currentFloorId);
  const currentLineId = (machine?.lineId && lines.some(l => l.id === machine.lineId)) ? machine.lineId : (lines[0]?.id || 'lin-1');

  // Extract all extended specifications & serials
  const mfgSerialNumber = machine?.manufacturing_serial || machine?.manufacturingSerial || machine?.customValues?.manufacturing_serial || machine?.customValues?.manufacturingSerial || machine?.manufacturingNo || machine?.mfgSerial || machine?.manufacturing || '';
  const mfgYear = machine?.manufacturing_year || machine?.manufacturingYear || machine?.mfgYear || machine?.customValues?.manufacturing_year || '';
  const countryOfOrigin = machine?.country_of_origin || machine?.origin || machine?.customValues?.country_of_origin || '';
  const machineCapacity = machine?.machine_capacity || machine?.capacity || machine?.customValues?.machine_capacity || '';

  // Extract maintenance & service history
  let rawServiceDate = machine?.lastServiceDate || machine?.service_date || machine?.serviceDate || machine?.customValues?.service_date || '';
  if (!rawServiceDate && machine && (machine.id || machine.serialNumber)) {
    const pmTable = storage.getTable(TABLE_NAMES.PREVENTIVE_MAINTENANCE) || [];
    const pm = pmTable.filter(r => (r.machineId === machine.id || (r.serialNumber && machine.serialNumber && String(r.serialNumber).trim().toUpperCase() === String(machine.serialNumber).trim().toUpperCase())))
                      .sort((a, b) => (b.serviceDate || '').localeCompare(a.serviceDate || ''))[0];
    if (pm?.serviceDate) rawServiceDate = pm.serviceDate;
  }
  const lastServiceDateVal = formatForDateInput(rawServiceDate);
  const nextServiceDateVal = formatForDateInput(machine?.nextServiceDate || machine?.customValues?.nextServiceDate);
  const lastServicedBy = machine?.lastServicedBy || machine?.assignedManpower || machine?.customValues?.lastServicedBy || '';
  const serviceStickerSerial = machine?.serviceStickerSerial || machine?.customValues?.serviceStickerSerial || '';

  // Extract procurement & commercial data
  const purchaseDateVal = formatForDateInput(machine?.purchase_date || machine?.purchaseDate || machine?.customValues?.purchase_date);
  const installDateVal = formatForDateInput(machine?.installation_date || machine?.installationDate || machine?.customValues?.installation_date);
  const supplierName = machine?.supplier_name || machine?.supplier || machine?.customValues?.supplier_name || '';

  // Quantities breakdown
  const rQty = parseInt(machine?.running ?? machine?.qty_running ?? (machine?.status === 'ACTIVE' ? (machine?.quantity ?? 1) : 0), 10) || 0;
  const uQty = parseInt(machine?.usable_idle ?? machine?.usableIdle ?? (machine?.status === 'IDLE' ? (machine?.quantity ?? 1) : 0), 10) || 0;
  const rpQty = parseInt(machine?.repairable_idle ?? machine?.repairableIdle ?? ((machine?.status === 'MAINTENANCE' || machine?.status === 'BREAKDOWN') ? (machine?.quantity ?? 1) : 0), 10) || 0;
  const totalQty = parseInt(machine?.totalQuantity || machine?.total_quantity || (rQty + uQty + rpQty > 0 ? (rQty + uQty + rpQty) : (machine?.quantity ?? 1)), 10) || 1;

  const remarks = machine?.remarks || '';
  const rawAssetId = machine?.systemAssetId || (machine?.permanentMachineId ? String(machine.permanentMachineId).replace(/^MID-/i, 'AMG-MNT-') : '');
  const currentSystemAssetId = rawAssetId || (isEdit ? '—' : nextAssetIdPreview);

  return `
    <div class="modal-overlay" id="modal-machine-overlay">
      <div class="modal-dialog modal-dialog-lg" style="max-width: 960px; width: 100%; max-height: 92vh; display: flex; flex-direction: column;">
        <div class="modal-header" style="background: linear-gradient(135deg, #0f172a, #1e293b); border-bottom: 1px solid rgba(56, 189, 248, 0.2); padding: 14px 22px;">
          <div class="modal-title" style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 16px; font-weight: 800; color: #fff;">${isViewOnly ? '👁️ Machine Details (View-Only)' : (isEdit ? '✏️ Edit Machine Record' : '➕ New Machine Registration')}</span>
            ${isEdit ? `
              <span class="serial-number-badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.35); font-family: var(--font-mono); font-size: 13px; font-weight: 800; padding: 2px 10px; border-radius: 6px;">${escapeHtml(machine.serialNumber)}</span>
              ${rawAssetId ? `<span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.35); font-family: var(--font-mono); font-size: 12px; font-weight: 800; padding: 2px 8px; border-radius: 6px;">${escapeHtml(rawAssetId)}</span>` : ''}
            ` : ''}
          </div>
          <button id="btn-close-machine-modal" class="btn btn-ghost btn-sm" style="font-size: 18px;" title="Close">✕</button>
        </div>

        <form id="form-machine" class="modal-body" style="display: flex; flex-direction: column; gap: 16px; flex: 1; min-height: 0; overflow-y: auto; padding: 20px 24px;">

          ${isViewOnly ? `
            <div style="background: rgba(56, 189, 248, 0.12); border: 1px solid rgba(56, 189, 248, 0.35); border-radius: var(--radius-md); padding: 10px 14px; font-size: 12.5px; color: #38bdf8; display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 20px;">🔒</span>
              <div>
                <strong>View-Only Machine:</strong> This machine belongs to another floor or Central Idle. You have read-only access to view its specifications, but cannot edit, relocate, or save changes.
              </div>
            </div>
          ` : ''}

          <!-- Section 1: Technical Identity & Specifications -->
          <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; padding: 14px 16px; display: flex; flex-direction: column; gap: 12px;">
            <div style="font-size: 12px; font-weight: 800; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 6px;">
              <span>🏷️ Machine Identification &amp; Specifications</span>
            </div>

            <!-- Row 1: Machine Name & Brand -->
            <div class="form-grid-2">
              <div class="form-group">
                <label class="form-label">Machine Name <span class="req">*</span></label>
                <select id="modal-field-machine-name" class="form-control" ${isViewOnly ? 'disabled style="opacity: 0.75; cursor: not-allowed;"' : 'required'}>
                  ${machineNames.map(mn => `<option value="${mn.id}" ${currentMachineNameId === mn.id ? 'selected' : ''}>${escapeHtml(mn.name)}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Brand <span style="font-size: 11px; color: var(--text-muted); font-weight: normal;">(Optional)</span></label>
                <select id="modal-field-brand" class="form-control" ${isViewOnly ? 'disabled style="opacity: 0.75; cursor: not-allowed;"' : ''}>
                  <option value="">-- No Brand (Blank) --</option>
                  ${brands.map(b => `<option value="${b.id}" ${currentBrandId === b.id ? 'selected' : ''}>${escapeHtml(b.name)}</option>`).join('')}
                </select>
              </div>
            </div>

            <!-- Row 2: Model & Serial Number -->
            <div class="form-grid-2">
              <div class="form-group">
                <label class="form-label">Model <span style="font-size: 11px; color: var(--text-muted); font-weight: normal;">(Optional)</span></label>
                <select id="modal-field-model" class="form-control" ${isViewOnly ? 'disabled style="opacity: 0.75; cursor: not-allowed;"' : ''}>
                  <option value="">-- No Model (Blank) --</option>
                  ${models.map(m => {
                    const isSelected = (activeModelId && m.id === activeModelId) || 
                                       (activeModelName && m.name && m.name.trim().toLowerCase() === activeModelName.toLowerCase());
                    return `<option value="${m.id}" ${isSelected ? 'selected' : ''}>${escapeHtml(m.name)}</option>`;
                  }).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label" style="display: flex; justify-content: space-between; align-items: center;">
                  <span>Machine Serial Number <span class="req">*</span></span>
                </label>
                <div style="display: flex; gap: 8px;">
                  <input
                    type="text"
                    id="modal-field-serial-number"
                    class="form-control"
                    placeholder="e.g. 1234, JA-01, F/L-886"
                    value="${escapeHtml(machine?.serialNumber || '')}"
                    ${isViewOnly ? 'disabled style="opacity: 0.75; cursor: not-allowed; font-family: var(--font-mono); font-size: 13.5px; font-weight: 700; color: #38bdf8; flex: 1;"' : 'required style="font-family: var(--font-mono); font-size: 13.5px; font-weight: 700; color: #38bdf8; flex: 1;"'}
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

            <!-- Row 3: System Asset ID & Manufacturing Serial Number -->
            <div class="form-grid-2">
              <div class="form-group">
                <label class="form-label" style="display: flex; justify-content: space-between; align-items: center;">
                  <span>System Asset ID <span style="font-size: 11px; color: #10b981; font-weight: 700;">(Permanent Unique ID)</span></span>
                  <span class="badge" style="font-size: 9.5px; padding: 1px 6px; background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.35);">${isEdit || isViewOnly ? 'PERMANENT' : 'AUTO-GENERATED'}</span>
                </label>
                <input
                  type="text"
                  id="modal-field-system-asset-id"
                  class="form-control"
                  value="${escapeHtml(currentSystemAssetId)}"
                  disabled
                  style="background: rgba(15, 23, 42, 0.7); color: #10b981; font-family: var(--font-mono); font-size: 13.5px; font-weight: 800; border-color: rgba(16, 185, 129, 0.35); cursor: not-allowed; letter-spacing: 0.5px;"
                  title="Permanent System-Generated Unique Asset ID"
                />
              </div>
              <div class="form-group">
                <label class="form-label" style="display: flex; justify-content: space-between; align-items: center;">
                  <span>Manufacturing Serial Number <span style="font-size: 11px; color: #38bdf8; font-weight: 600;">(OEM / Maker Serial)</span></span>
                </label>
                <input
                  type="text"
                  id="modal-field-mfg-serial"
                  class="form-control"
                  placeholder="e.g. SN-MFG-98421, MF-01"
                  value="${escapeHtml(mfgSerialNumber)}"
                  style="font-family: var(--font-mono); font-size: 13.5px; font-weight: 600; color: #38bdf8;"
                  ${isViewOnly ? 'disabled style="opacity: 0.75; cursor: not-allowed;"' : ''}
                />
              </div>
            </div>

            <!-- Row 4: Manufacturing Year & Motor Specs -->
            <div class="form-grid-2">
              <div class="form-group">
                <label class="form-label">Manufacturing Year <span style="font-size: 11px; color: var(--text-muted); font-weight: normal;">(Mfg Year)</span></label>
                <input
                  type="text"
                  id="modal-field-mfg-year"
                  class="form-control"
                  placeholder="e.g. 2018, 2022"
                  value="${escapeHtml(mfgYear)}"
                  ${isViewOnly ? 'disabled style="opacity: 0.75; cursor: not-allowed;"' : ''}
                />
              </div>

            <!-- Row 4: Machine Capacity & Country of Origin -->
            <div class="form-grid-2">
              <div class="form-group">
                <label class="form-label">Capacity / Motor Specs <span style="font-size: 11px; color: var(--text-muted); font-weight: normal;">(e.g. 550W / 4000 RPM)</span></label>
                <input
                  type="text"
                  id="modal-field-capacity"
                  class="form-control"
                  placeholder="e.g. 550W, 4000 RPM, Direct Drive"
                  value="${escapeHtml(machineCapacity)}"
                  ${isViewOnly ? 'disabled style="opacity: 0.75; cursor: not-allowed;"' : ''}
                />
              </div>
              <div class="form-group">
                <label class="form-label">Country of Origin <span style="font-size: 11px; color: var(--text-muted); font-weight: normal;">(Origin)</span></label>
                <input
                  type="text"
                  id="modal-field-origin"
                  class="form-control"
                  placeholder="e.g. Japan, China, Germany, Taiwan"
                  value="${escapeHtml(countryOfOrigin)}"
                  ${isViewOnly ? 'disabled style="opacity: 0.75; cursor: not-allowed;"' : ''}
                />
              </div>
            </div>
          </div>

          <!-- Section 2: Factory Location & Operational Status -->
          <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; padding: 14px 16px; display: flex; flex-direction: column; gap: 12px;">
            <div style="font-size: 12px; font-weight: 800; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 6px;">
              <span>📍 Plant Location &amp; Operational Status</span>
            </div>

            <!-- Row 1: Unit & Floor -->
            <div class="form-grid-2">
              <div class="form-group">
                <label class="form-label">Unit / Factory <span class="req">*</span></label>
                <select id="modal-field-unit" class="form-control" ${isViewOnly || (isEdit && !authService.isSuperAdmin()) ? 'disabled style="opacity: 0.7; cursor: not-allowed;"' : 'required'}>
                  ${units.map(u => `<option value="${u.id}" ${currentUnitId === u.id ? 'selected' : ''}>${escapeHtml(u.name)}</option>`).join('')}
                </select>
                ${isEdit && !authService.isSuperAdmin() ? `<input type="hidden" name="unitId" value="${currentUnitId}" />` : ''}
              </div>
              <div class="form-group">
                <label class="form-label">Floor <span class="req">*</span></label>
                <select id="modal-field-floor" class="form-control" ${isViewOnly || (isEdit && !authService.isSuperAdmin()) ? 'disabled style="opacity: 0.7; cursor: not-allowed;"' : 'required'}>
                  ${floors.map(f => `<option value="${f.id}" ${currentFloorId === f.id ? 'selected' : ''}>${escapeHtml(f.name)}</option>`).join('')}
                </select>
                ${isEdit && !authService.isSuperAdmin() ? `<input type="hidden" name="floorId" value="${currentFloorId}" />` : ''}
              </div>
            </div>

            <!-- Row 2: Production Line & Status -->
            <div class="form-grid-2">
              <div class="form-group">
                <label class="form-label">Production Line <span class="req">*</span></label>
                <select id="modal-field-line" class="form-control" ${isViewOnly || (isEdit && !authService.isSuperAdmin()) ? 'disabled style="opacity: 0.7; cursor: not-allowed;"' : 'required'}>
                  ${lines.map(l => {
                    const clean = formatDisplayLine(l.name, 'NORMAL');
                    const label = clean !== l.name ? `${clean} (${l.name})` : l.name;
                    return `<option value="${l.id}" ${currentLineId === l.id ? 'selected' : ''}>${escapeHtml(label)}</option>`;
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
          </div>

          <!-- Section 3: Inventory Quantities Breakdown -->
          <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; padding: 14px 16px; display: flex; flex-direction: column; gap: 12px;">
            <div style="font-size: 12px; font-weight: 800; color: #34d399; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; justify-content: space-between;">
              <span>🔢 Inventory Quantities Breakdown</span>
              <span style="font-size: 11px; color: var(--text-muted); font-weight: normal;">Running + Usable Idle + Repairable Idle = Total Qty</span>
            </div>

            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;">
              <div class="form-group">
                <label class="form-label" style="color: #34d399; font-weight: 700;">Running Qty</label>
                <input type="number" id="modal-field-running" class="form-control" value="${rQty}" min="0" ${isViewOnly ? 'disabled style="opacity: 0.75; cursor: not-allowed;"' : ''} />
              </div>
              <div class="form-group">
                <label class="form-label" style="color: #38bdf8; font-weight: 700;">Usable Idle Qty</label>
                <input type="number" id="modal-field-usable-idle" class="form-control" value="${uQty}" min="0" ${isViewOnly ? 'disabled style="opacity: 0.75; cursor: not-allowed;"' : ''} />
              </div>
              <div class="form-group">
                <label class="form-label" style="color: #fbbf24; font-weight: 700;">Repairable Idle Qty</label>
                <input type="number" id="modal-field-repairable-idle" class="form-control" value="${rpQty}" min="0" ${isViewOnly ? 'disabled style="opacity: 0.75; cursor: not-allowed;"' : ''} />
              </div>
              <div class="form-group">
                <label class="form-label" style="color: #fff; font-weight: 700;">Total Quantity</label>
                <input type="number" id="modal-field-quantity" class="form-control" value="${totalQty}" min="1" ${isViewOnly ? 'disabled style="opacity: 0.75; cursor: not-allowed;"' : ''} />
              </div>
            </div>
          </div>

          <!-- Section 4: Preventive Maintenance & Servicing -->
          <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; padding: 14px 16px; display: flex; flex-direction: column; gap: 12px;">
            <div style="font-size: 12px; font-weight: 800; color: #f59e0b; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; justify-content: space-between;">
              <span>🛠️ Preventive Maintenance &amp; Servicing</span>
              <span style="font-size: 11px; color: #38bdf8; font-weight: 600;">Synchronized with PM Registry &amp; Passport</span>
            </div>

            <div class="form-grid-2">
              <div class="form-group">
                <label class="form-label" style="color: #f59e0b; font-weight: 700;">Last Servicing Date <span style="font-size: 11px; color: var(--text-muted); font-weight: normal;">(Service Date)</span></label>
                <input
                  type="date"
                  id="modal-field-service-date"
                  class="form-control"
                  value="${lastServiceDateVal}"
                  ${isViewOnly ? 'disabled style="opacity: 0.75; cursor: not-allowed;"' : ''}
                />
              </div>
              <div class="form-group">
                <label class="form-label">Next Due Service Date <span style="font-size: 11px; color: var(--text-muted); font-weight: normal;">(Auto / Manual)</span></label>
                <input
                  type="date"
                  id="modal-field-next-service-date"
                  class="form-control"
                  value="${nextServiceDateVal}"
                  ${isViewOnly ? 'disabled style="opacity: 0.75; cursor: not-allowed;"' : ''}
                />
              </div>
            </div>

            <div class="form-grid-2">
              <div class="form-group">
                <label class="form-label">Serviced By (Technician / Card #) <span style="font-size: 11px; color: var(--text-muted); font-weight: normal;">(Assigned Manpower)</span></label>
                <input
                  type="text"
                  id="modal-field-serviced-by"
                  class="form-control"
                  placeholder="e.g. Rahim Uddin / Card # 1088"
                  value="${escapeHtml(lastServicedBy)}"
                  ${isViewOnly ? 'disabled style="opacity: 0.75; cursor: not-allowed;"' : ''}
                />
              </div>
              <div class="form-group">
                <label class="form-label">Service Sticker Serial <span style="font-size: 11px; color: var(--text-muted); font-weight: normal;">(Sticker No)</span></label>
                <input
                  type="text"
                  id="modal-field-sticker-serial"
                  class="form-control"
                  placeholder="e.g. STK-2026-06-0042, 855555141"
                  value="${escapeHtml(serviceStickerSerial)}"
                  ${isViewOnly ? 'disabled style="opacity: 0.75; cursor: not-allowed;"' : ''}
                />
              </div>
            </div>
          </div>

          <!-- Section 5: Procurement & Supplier Details -->
          <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; padding: 14px 16px; display: flex; flex-direction: column; gap: 12px;">
            <div style="font-size: 12px; font-weight: 800; color: #a78bfa; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 6px;">
              <span>📦 Procurement &amp; Supplier Details</span>
            </div>

            <div class="form-grid-3">
              <div class="form-group">
                <label class="form-label">Purchase Date</label>
                <input
                  type="date"
                  id="modal-field-purchase-date"
                  class="form-control"
                  value="${purchaseDateVal}"
                  ${isViewOnly ? 'disabled style="opacity: 0.75; cursor: not-allowed;"' : ''}
                />
              </div>
              <div class="form-group">
                <label class="form-label">Installation Date</label>
                <input
                  type="date"
                  id="modal-field-install-date"
                  class="form-control"
                  value="${installDateVal}"
                  ${isViewOnly ? 'disabled style="opacity: 0.75; cursor: not-allowed;"' : ''}
                />
              </div>
              <div class="form-group">
                <label class="form-label">Supplier / Vendor</label>
                <input
                  type="text"
                  id="modal-field-supplier"
                  class="form-control"
                  placeholder="e.g. Juki Singapore, Brother BD"
                  value="${escapeHtml(supplierName)}"
                  ${isViewOnly ? 'disabled style="opacity: 0.75; cursor: not-allowed;"' : ''}
                />
              </div>
            </div>
          </div>

          <!-- Section 6: Dynamic Custom Fields (if active) -->
          ${customFields.length > 0 ? `
            <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; padding: 14px 16px; display: flex; flex-direction: column; gap: 12px;">
              <div style="font-size: 12px; font-weight: 800; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.5px;">
                ⚙️ Custom Specifications &amp; Parameters
              </div>
              <div class="form-grid-2">
                ${customFields.map(cf => {
                  const cfVal = machine?.customValues?.[cf.code] ?? '';
                  const cfDisabled = isViewOnly ? 'disabled style="opacity: 0.75; cursor: not-allowed;"' : '';
                  if (cf.type === 'DROPDOWN' && Array.isArray(cf.options) && cf.options.length > 0) {
                    return `
                      <div class="form-group">
                        <label class="form-label">${escapeHtml(cf.label)} ${cf.required ? '<span class="req">*</span>' : ''}</label>
                        <select class="form-control custom-field-input" data-code="${escapeHtml(cf.code)}" ${cf.required ? 'required' : ''} ${cfDisabled}>
                          <option value="">-- Select ${escapeHtml(cf.label)} --</option>
                          ${cf.options.map(opt => `<option value="${escapeHtml(opt)}" ${String(cfVal) === String(opt) ? 'selected' : ''}>${escapeHtml(opt)}</option>`).join('')}
                        </select>
                      </div>
                    `;
                  }
                  const inputType = cf.type === 'NUMBER' || cf.type === 'DECIMAL' ? 'number' : (cf.type === 'DATE' ? 'date' : 'text');
                  const stepAttr = cf.type === 'DECIMAL' ? 'step="0.01"' : '';
                  return `
                    <div class="form-group">
                      <label class="form-label">${escapeHtml(cf.label)} ${cf.required ? '<span class="req">*</span>' : ''}</label>
                      <input
                        type="${inputType}"
                        class="form-control custom-field-input"
                        data-code="${escapeHtml(cf.code)}"
                        value="${escapeHtml(cfVal)}"
                        placeholder="Enter ${escapeHtml(cf.label)}"
                        ${stepAttr}
                        ${cf.required ? 'required' : ''}
                        ${cfDisabled}
                      />
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Section 7: Technical Remarks & Notes -->
          <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; padding: 14px 16px; display: flex; flex-direction: column; gap: 8px;">
            <label class="form-label" style="font-size: 12px; font-weight: 800; color: #fbbf24; text-transform: uppercase; letter-spacing: 0.5px;">
              📝 Technical Remarks &amp; Historical Notes
            </label>
            <textarea
              id="modal-field-remarks"
              class="form-control"
              rows="3"
              placeholder="Enter machine condition, mechanical history, special overhaul notes..."
              ${isViewOnly ? 'disabled style="opacity: 0.75; cursor: not-allowed; resize: none;"' : 'style="resize: vertical; min-height: 60px;"'}
            >${escapeHtml(remarks)}</textarea>
          </div>

          <!-- Hidden fields -->
          <input type="hidden" id="modal-field-category" value="${currentCategoryId}" />
          <input type="hidden" id="modal-field-group" value="${currentGroupId}" />

        </form>

        <div class="modal-footer" style="background: var(--bg-card); padding: 14px 22px; border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end; gap: 12px;">
          <button type="button" id="btn-cancel-machine" class="btn btn-secondary">${isViewOnly ? 'Close' : 'Cancel'}</button>
          ${!isViewOnly ? `
            <button type="submit" form="form-machine" id="btn-save-machine" class="btn btn-primary" style="font-weight: 700; padding: 8px 20px;">
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

  // Resolve active machine's model for event preservation
  const activeMachine = state.get('activeMachineId') ? storage.getItem(TABLE_NAMES.MACHINES, state.get('activeMachineId')) : null;
  let activeMachineModelId = activeMachine?.modelId || '';
  const activeMachineModelName = String(activeMachine?.model || activeMachine?.modelName || activeMachine?.modelStr || activeMachine?.customValues?.model || '').trim();
  if (!activeMachineModelId && activeMachineModelName) {
    const matched = (storage.getTable(TABLE_NAMES.MODELS) || []).find(m => (m.name || '').trim().toLowerCase() === activeMachineModelName.toLowerCase());
    if (matched) activeMachineModelId = matched.id;
  }

  // Reload models based on current brand & machine name
  // If brand+machineName gives no results, fallback to machineName only, fallback to brand only
  const reloadModels = (preserveSelected = false, defaultModelId = null) => {
    if (!modelSelect) return;
    const bId = brandSelect ? brandSelect.value : '';
    const mnId = mnSelect ? mnSelect.value : '';
    let curModelId = preserveSelected ? (modelSelect.value || defaultModelId || activeMachineModelId || '') : (defaultModelId || '');
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

    const seenModelNames = new Set();
    const uniqueModels = [];

    // Ensure target model is present
    const targetModelObj = curModelId 
      ? (storage.getItem(TABLE_NAMES.MODELS, curModelId) || masterDataService.getModelById(curModelId))
      : (activeMachineModelName ? (storage.getTable(TABLE_NAMES.MODELS) || []).find(m => (m.name || '').trim().toLowerCase() === activeMachineModelName.toLowerCase()) : null);

    if (targetModelObj) {
      seenModelNames.add((targetModelObj.name || '').trim().toLowerCase());
      uniqueModels.push(targetModelObj);
      if (!curModelId) curModelId = targetModelObj.id;
    } else if (curModelId || (preserveSelected && activeMachineModelName)) {
      const name = activeMachineModelName || curModelId;
      seenModelNames.add(name.toLowerCase());
      uniqueModels.push({ id: curModelId || name, name: name, brandId: bId });
    }

    models.forEach(m => {
      if (!m || !m.name) return;
      const norm = m.name.trim().toLowerCase();
      if (!seenModelNames.has(norm)) {
        seenModelNames.add(norm);
        uniqueModels.push(m);
      }
    });

    const options = ['<option value="">-- No Model (Blank) --</option>'];
    uniqueModels.forEach(m => {
      const isSel = (curModelId && m.id === curModelId) || 
                    (activeMachineModelName && m.name && m.name.trim().toLowerCase() === activeMachineModelName.toLowerCase());
      options.push(`<option value="${m.id}" ${isSel ? 'selected' : ''}>${escapeHtml(m.name)}</option>`);
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
      options.push(`<option value="${b.id}" ${b.id === curBrandId ? 'selected' : ''}>${escapeHtml(b.name)}</option>`);
    });
    brandSelect.innerHTML = options.join('');
    reloadModels(preserveSelected);
  };

  if (mnSelect) mnSelect.addEventListener('change', () => reloadBrands(false));
  if (brandSelect) brandSelect.addEventListener('change', () => reloadModels(false));

  // On form open: ensure models are populated while preserving selected model
  reloadModels(true, activeMachineModelId);

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
            (m.systemAssetId && m.systemAssetId.toLowerCase() === rawId.toLowerCase()) ||
            (m.permanentMachineId && m.permanentMachineId.toLowerCase() === rawId.toLowerCase()) ||
            (m.permanentMachineId && m.permanentMachineId.toLowerCase().replace(/^mid-/i, 'amg-mnt-') === rawId.toLowerCase()) ||
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
  // Dynamic Quantity Real-Time Sync & Status Reaction
  const runningInp = document.getElementById('modal-field-running');
  const usableInp = document.getElementById('modal-field-usable-idle');
  const repairableInp = document.getElementById('modal-field-repairable-idle');
  const totalQtyInp = document.getElementById('modal-field-quantity');
  const statusSelect = document.getElementById('modal-field-status');

  const syncTotalQuantity = () => {
    if (!totalQtyInp) return;
    const r = parseInt(runningInp?.value, 10) || 0;
    const u = parseInt(usableInp?.value, 10) || 0;
    const rp = parseInt(repairableInp?.value, 10) || 0;
    const sum = r + u + rp;
    if (sum > 0) {
      totalQtyInp.value = sum;
    }
  };

  if (runningInp) runningInp.addEventListener('input', syncTotalQuantity);
  if (usableInp) usableInp.addEventListener('input', syncTotalQuantity);
  if (repairableInp) repairableInp.addEventListener('input', syncTotalQuantity);

  if (statusSelect) {
    statusSelect.addEventListener('change', () => {
      const curStatus = statusSelect.value;
      const curQty = parseInt(totalQtyInp?.value, 10) || 1;
      if (curStatus === 'ACTIVE') {
        if (runningInp) runningInp.value = curQty;
        if (usableInp) usableInp.value = 0;
        if (repairableInp) repairableInp.value = 0;
      } else if (curStatus === 'IDLE') {
        if (usableInp) usableInp.value = curQty;
        if (runningInp) runningInp.value = 0;
        if (repairableInp) repairableInp.value = 0;
      } else if (curStatus === 'MAINTENANCE' || curStatus === 'BREAKDOWN') {
        if (repairableInp) repairableInp.value = curQty;
        if (runningInp) runningInp.value = 0;
        if (usableInp) usableInp.value = 0;
      }
      syncTotalQuantity();
    });
  }

  // Dynamic Next Service Date Calculation (+91 days standard cycle)
  const serviceDateInp = document.getElementById('modal-field-service-date');
  const nextServiceDateInp = document.getElementById('modal-field-next-service-date');
  if (serviceDateInp && nextServiceDateInp) {
    serviceDateInp.addEventListener('change', () => {
      const val = serviceDateInp.value;
      if (val && !nextServiceDateInp.value) {
        try {
          const d = new Date(val);
          if (!isNaN(d.getTime())) {
            d.setDate(d.getDate() + 91);
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            nextServiceDateInp.value = `${yyyy}-${mm}-${dd}`;
          }
        } catch (_) {}
      }
    });
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

      // Machine Technical Specifications
      const serialNumber = (document.getElementById('modal-field-serial-number')?.value || '').trim();
      const mfgSerial = (document.getElementById('modal-field-mfg-serial')?.value || '').trim();
      const mfgYear = (document.getElementById('modal-field-mfg-year')?.value || '').trim();
      const capacity = (document.getElementById('modal-field-capacity')?.value || '').trim();
      const origin = (document.getElementById('modal-field-origin')?.value || '').trim();

      const machineNameId = document.getElementById('modal-field-machine-name')?.value || '';
      const brandId = document.getElementById('modal-field-brand')?.value || '';
      const modelId = document.getElementById('modal-field-model')?.value || '';

      // Factory Location Hierarchy
      const groupId = document.getElementById('modal-field-group')?.value || existingMachine?.groupId || 'grp-1';
      const unitId = document.getElementById('modal-field-unit')?.value || existingMachine?.unitId || 'unt-1';
      const floorId = document.getElementById('modal-field-floor')?.value || existingMachine?.floorId || 'flr-4';
      const lineId = document.getElementById('modal-field-line')?.value || existingMachine?.lineId || 'lin-1';

      // Status & Quantities Breakdown
      const status = document.getElementById('modal-field-status')?.value || 'ACTIVE';
      const running = parseInt(document.getElementById('modal-field-running')?.value, 10) || 0;
      const usableIdle = parseInt(document.getElementById('modal-field-usable-idle')?.value, 10) || 0;
      const repairableIdle = parseInt(document.getElementById('modal-field-repairable-idle')?.value, 10) || 0;
      const quantity = parseInt(document.getElementById('modal-field-quantity')?.value, 10) || (running + usableIdle + repairableIdle) || 1;

      // Preventive Maintenance & Servicing
      const serviceDate = document.getElementById('modal-field-service-date')?.value || '';
      const nextServiceDate = document.getElementById('modal-field-next-service-date')?.value || '';
      const servicedBy = (document.getElementById('modal-field-serviced-by')?.value || '').trim();
      const stickerSerial = (document.getElementById('modal-field-sticker-serial')?.value || '').trim();

      // Procurement & Commercial
      const purchaseDate = document.getElementById('modal-field-purchase-date')?.value || '';
      const installDate = document.getElementById('modal-field-install-date')?.value || '';
      const supplier = (document.getElementById('modal-field-supplier')?.value || '').trim();

      // Remarks
      const remarks = document.getElementById('modal-field-remarks')?.value?.trim() || '';

      // Custom dynamic fields
      const customValues = { ...(existingMachine?.customValues || {}) };
      if (mfgSerial) {
        customValues.manufacturing_serial = mfgSerial;
        customValues.manufacturingSerial = mfgSerial;
      }
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

      // Resolve model string name from modelId if available
      let modelStrVal = existingMachine?.model || '';
      if (modelId) {
        const selectedModelObj = storage.getItem(TABLE_NAMES.MODELS, modelId) || masterDataService.getModelById(modelId);
        if (selectedModelObj?.name) {
          modelStrVal = selectedModelObj.name;
        } else {
          modelStrVal = modelId;
        }
      } else if (modelId === '') {
        modelStrVal = '';
      }

      const machineData = {
        serialNumber,
        machineNameId,
        brandId,
        modelId,
        model: modelStrVal,
        modelName: modelStrVal,
        modelStr: modelStrVal,
        manufacturing_serial: mfgSerial,
        manufacturingSerial: mfgSerial,
        mfgSerial: mfgSerial,
        manufacturingNo: mfgSerial,
        manufacturing_year: mfgYear,
        manufacturingYear: mfgYear,
        mfgYear: mfgYear,
        machine_capacity: capacity,
        capacity,
        country_of_origin: origin,
        origin,
        groupId,
        unitId,
        floorId,
        lineId,
        status,
        running,
        usable_idle: usableIdle,
        repairable_idle: repairableIdle,
        quantity,
        lastServiceDate: serviceDate || null,
        service_date: serviceDate || null,
        serviceDate: serviceDate || null,
        nextServiceDate: nextServiceDate || null,
        lastServicedBy: servicedBy,
        assignedManpower: servicedBy,
        serviceStickerSerial: stickerSerial,
        purchase_date: purchaseDate || null,
        purchaseDate: purchaseDate || null,
        installation_date: installDate || null,
        installationDate: installDate || null,
        supplier_name: supplier,
        systemAssetId: machine?.systemAssetId || (machine?.permanentMachineId ? String(machine.permanentMachineId).replace(/^MID-/i, 'AMG-MNT-') : undefined),
        permanentMachineId: machine?.systemAssetId || (machine?.permanentMachineId ? String(machine.permanentMachineId).replace(/^MID-/i, 'AMG-MNT-') : undefined),
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
            notificationService.success(`Machine #${serialNumber} updated successfully`);
          }
        } else {
          await machineService.addMachine(machineData);
          notificationService.success(`Machine #${serialNumber} registered successfully`);
          state.updateFilters({
            search: '',
            page: 1,
            sortField: 'updatedAt',
            sortOrder: 'desc'
          });
        }

        // Also sync PM table if serviceDate is present
        if (serviceDate) {
          try {
            const pmTable = storage.getTable(TABLE_NAMES.PREVENTIVE_MAINTENANCE) || [];
            const targetId = isEdit ? machineId : null;
            const existingPm = pmTable.find(r => 
              (targetId && r.machineId === targetId) || 
              (r.serialNumber && String(r.serialNumber).trim().toUpperCase() === String(serialNumber).trim().toUpperCase())
            );
            if (existingPm) {
              existingPm.serviceDate = serviceDate;
              existingPm.lastServiceDate = serviceDate;
              if (nextServiceDate) existingPm.nextServiceDate = nextServiceDate;
              if (servicedBy) {
                existingPm.servicedBy = servicedBy;
                existingPm.assignedManpower = servicedBy;
              }
              if (stickerSerial) existingPm.serviceStickerSerial = stickerSerial;
              existingPm.updatedAt = new Date().toISOString();
              storage.saveTable(TABLE_NAMES.PREVENTIVE_MAINTENANCE, pmTable);
            }
          } catch (_) {}
        }

        state.set('currentView', 'inventory');
        state.emit('inventory:updated');

      } catch (err) {
        // Keep modal open on failure — re-enable button, show error
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.innerHTML = originalBtnText;
        }

        if (err.name === 'CloudSaveError') {
          notificationService.error(err.message || '❌ Cloud Save Failed: Database write was not confirmed.');
        } else {
          notificationService.error(err.message || 'Failed to save machine record.');
        }
      }
    });
  }
}
