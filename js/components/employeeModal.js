/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Employee Modals Component:
 * 1. Add / Edit Employee (with Dynamic Custom Fields & Plant Hierarchy Cascading)
 * 2. Employee Transfer (Relocation) Modal
 * 3. Employee Leave Logging Modal
 * 4. Digital Employee ID Card & Printable Profile (with QR Code & Barcode)
 * 5. Excel Import Modal for Manpower
 */

import { employeeService, DEPARTMENTS, DESIGNATIONS, LEAVE_TYPES } from '../services/employeeService.js';
import { employeeCustomFieldService } from '../services/employeeCustomFieldService.js';
import { masterDataService } from '../services/masterDataService.js';
import { barcodeService } from '../services/barcodeService.js';
import { excelService } from '../services/excelService.js';
import { authService } from '../services/authService.js';
import { notificationService } from '../services/notificationService.js';
import { state } from '../state.js';

export function renderEmployeeModal() {
  const activeModal = state.get('activeEmployeeModal'); // { type: 'ADD'|'EDIT'|'TRANSFER'|'LEAVE'|'ID_CARD'|'IMPORT', employeeId: string }
  if (!activeModal) return '';

  switch (activeModal.type) {
    case 'ADD':
    case 'EDIT':
      return renderAddEditEmployeeModal(activeModal);
    case 'TRANSFER':
      return renderTransferEmployeeModal(activeModal);
    case 'LEAVE':
      return renderLeaveEmployeeModal(activeModal);
    case 'ID_CARD':
      return renderEmployeeIdCardModal(activeModal);
    case 'IMPORT':
      return renderEmployeeImportModal();
    default:
      return '';
  }
}

// ---------------------------------------------------------------------------
// 1. ADD / EDIT EMPLOYEE MODAL
// ---------------------------------------------------------------------------
function renderAddEditEmployeeModal({ type, employeeId }) {
  const isEdit = type === 'EDIT';
  const emp = isEdit ? employeeService.getEmployeeById(employeeId) : { status: 'ACTIVE', customFields: {} };
  if (isEdit && !emp) return '';

  const groups = masterDataService.getGroups(true);
  const initialGroupId = emp.groupId || (groups[0]?.id || '');
  const units = masterDataService.getUnits(initialGroupId, true);
  const initialUnitId = emp.unitId || (units[0]?.id || '');
  const floors = masterDataService.getFloors(initialUnitId, null, true);
  const initialFloorId = emp.floorId || (floors[0]?.id || '');
  const lines = masterDataService.getLines(initialFloorId, null, null, true);

  const customFields = employeeCustomFieldService.getActiveFields();

  return `
    <div class="modal-overlay active" id="modal-employee-overlay">
      <div class="modal-card" style="max-width: 850px; max-height: 90vh; display: flex; flex-direction: column; min-height: 0; overflow: hidden;">
        
        <div class="modal-header" style="border-bottom: 1px solid var(--border-color); padding-bottom: 14px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 22px;">${isEdit ? '✏️' : '➕'}</span>
            <div>
              <h3 style="margin: 0; font-size: 17px; font-weight: 800; color: #fff;">
                ${isEdit ? `Edit Employee Profile: ${emp.name}` : 'Register New Employee / Manpower'}
              </h3>
              <p style="margin: 2px 0 0 0; font-size: 12px; color: var(--text-muted);">
                ${isEdit ? `Update employee card #${emp.cardNumber}, location, and technical parameters` : 'Enter employee particulars, department assignment, and custom specs'}
              </p>
            </div>
          </div>
          <button class="btn btn-ghost btn-sm" id="btn-close-employee-modal" style="font-size: 16px;">✕</button>
        </div>

        <form id="form-employee-submit" class="modal-body" style="padding: 16px 20px; overflow-y: auto; flex: 1; min-height: 0;">
          
          <!-- Basic Particulars -->
          <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 16px; margin-bottom: 16px;">
            <h4 style="font-size: 13px; font-weight: 700; color: #38bdf8; margin: 0 0 12px 0;">👤 1. Primary Identification</h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
              
              <div class="form-group">
                <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Full Name *</label>
                <input type="text" id="emp-field-name" class="form-control" value="${emp.name || ''}" placeholder="e.g. Md. Faruk Hossain" required />
              </div>

              <div class="form-group" style="position: relative;">
                <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Employee / Card ID *</label>
                <div style="position: relative;">
                  <input type="text" id="emp-field-card" class="form-control font-mono" value="${emp.cardNumber || ''}" placeholder="e.g. 1042" autocomplete="off" required />
                  <!-- Auto-search Dropdown -->
                  <div id="emp-card-search-dropdown" style="display: none; position: absolute; top: calc(100% + 4px); left: 0; right: 0; background: #0f172a; border: 1.5px solid #38bdf8; border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.8); z-index: 1100; max-height: 230px; overflow-y: auto;"></div>
                </div>
                <div id="emp-card-conflict-alert" style="display: none; font-size: 11.5px; margin-top: 6px; border-radius: 6px; padding: 6px 10px;"></div>
              </div>

              <div class="form-group">
                <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Designation *</label>
                <select id="emp-field-designation" class="filter-select" required>
                  ${(() => { const desigs = employeeService.getDistinctDesignations(); const cur = emp.designation || ''; if (cur && !desigs.includes(cur)) desigs.unshift(cur); return desigs.map(d => `<option value="${d}" ${emp.designation === d ? 'selected' : ''}>${d}</option>`).join(''); })()}
                </select>
              </div>

              <div class="form-group">
                <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Department *</label>
                <select id="emp-field-department" class="filter-select" required>
                  ${(() => { const depts = employeeService.getDistinctDepartments(); const cur = emp.department || ''; if (cur && !depts.includes(cur)) depts.unshift(cur); return depts.map(d => `<option value="${d}" ${emp.department === d ? 'selected' : ''}>${d}</option>`).join(''); })()}
                </select>
              </div>

              <div class="form-group">
                <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Contact Phone Number</label>
                <input type="text" id="emp-field-phone" class="form-control" value="${emp.phone || ''}" placeholder="e.g. +880 1711-000000" />
              </div>

              <div class="form-group">
                <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Joining Date</label>
                <input type="date" id="emp-field-joindate" class="form-control" value="${emp.joinDate || new Date().toISOString().split('T')[0]}" />
              </div>

              <div class="form-group" style="grid-column: span 2;">
                <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Employment Status *</label>
                <select id="emp-field-status" class="filter-select">
                  <option value="ACTIVE" ${emp.status === 'ACTIVE' ? 'selected' : ''}>🟢 ACTIVE (Operational)</option>
                  <option value="ON_LEAVE" ${emp.status === 'ON_LEAVE' ? 'selected' : ''}>🟡 ON LEAVE</option>
                  <option value="INACTIVE" ${emp.status === 'INACTIVE' ? 'selected' : ''}>⚪ INACTIVE / Suspended</option>
                  <option value="TERMINATED" ${emp.status === 'TERMINATED' ? 'selected' : ''}>🔴 TERMINATED / Resigned</option>
                </select>
              </div>

            </div>
          </div>

          <!-- Dynamic Plant Location Cascading (Group -> Unit -> Floor -> Line) -->
          <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 16px; margin-bottom: 16px;">
            <h4 style="font-size: 13px; font-weight: 700; color: #34d399; margin: 0 0 12px 0;">🏢 2. Plant Location Placement (Group &rarr; Unit &rarr; Floor &rarr; Line)</h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
              
              <div class="form-group">
                <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Corporate Group *</label>
                <select id="emp-modal-group" class="filter-select" required>
                  ${groups.map(g => `<option value="${g.id}" ${initialGroupId === g.id ? 'selected' : ''}>${g.name}</option>`).join('')}
                </select>
              </div>

              <div class="form-group">
                <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Factory / Unit *</label>
                <select id="emp-modal-unit" class="filter-select" required>
                  ${units.map(u => `<option value="${u.id}" ${initialUnitId === u.id ? 'selected' : ''}>${u.name}</option>`).join('')}
                </select>
              </div>

              <div class="form-group">
                <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Production Floor *</label>
                <select id="emp-modal-floor" class="filter-select" required>
                  ${floors.map(f => `<option value="${f.id}" ${initialFloorId === f.id ? 'selected' : ''}>${f.name}</option>`).join('')}
                </select>
              </div>

              <div class="form-group">
                <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Production Line / Working Bay</label>
                <select id="emp-modal-line" class="filter-select">
                  <option value="">Select Line / Bay...</option>
                  ${lines.map(l => `<option value="${l.id}" ${emp.lineId === l.id ? 'selected' : ''}>${l.name}</option>`).join('')}
                </select>
              </div>

              <div class="form-group" style="grid-column: span 2;">
                <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Specific Work Area Details</label>
                <input type="text" id="emp-field-workingarea" class="form-control" value="${emp.workingArea || ''}" placeholder="e.g. 3rd Floor Maintenance Desk / Machine Row 4" />
              </div>

            </div>
          </div>

          <!-- Dynamic Custom Fields Section -->
          ${customFields.length > 0 ? `
            <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 16px; margin-bottom: 16px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <h4 style="font-size: 13px; font-weight: 700; color: #fbbf24; margin: 0;">⚙️ 3. Dynamic Custom Parameters (Admin Defined)</h4>
                <span style="font-size: 11px; color: var(--text-muted);">${customFields.length} active custom fields</span>
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
                ${customFields.map(cf => renderCustomFieldInput(cf, emp.customFields ? emp.customFields[cf.code] : '')).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Modal Action Buttons -->
          <div style="display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid var(--border-color); padding-top: 14px;">
            <button type="button" class="btn btn-secondary" id="btn-cancel-employee-modal">Cancel</button>
            <button type="submit" class="btn btn-primary" style="font-weight: 700;">
              ${isEdit ? '💾 Update Employee Profile' : '➕ Save & Register Employee'}
            </button>
          </div>

        </form>

      </div>
    </div>
  `;
}

function renderCustomFieldInput(field, currentValue = '') {
  const reqStr = field.required ? 'required' : '';
  const val = currentValue !== undefined ? currentValue : '';

  switch (field.type) {
    case 'DROPDOWN':
      return `
        <div class="form-group">
          <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">${field.label} ${field.required ? '*' : ''}</label>
          <select id="emp-cf-${field.code}" class="filter-select" data-emp-cf-code="${field.code}" ${reqStr}>
            <option value="">Select ${field.label}...</option>
            ${(field.options || []).map(opt => `<option value="${opt}" ${String(val) === String(opt) ? 'selected' : ''}>${opt}</option>`).join('')}
          </select>
        </div>
      `;
    case 'BOOLEAN':
      return `
        <div class="form-group">
          <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">${field.label} ${field.required ? '*' : ''}</label>
          <select id="emp-cf-${field.code}" class="filter-select" data-emp-cf-code="${field.code}" ${reqStr}>
            <option value="">Select...</option>
            <option value="Yes" ${String(val).toLowerCase() === 'yes' ? 'selected' : ''}>Yes</option>
            <option value="No" ${String(val).toLowerCase() === 'no' ? 'selected' : ''}>No</option>
          </select>
        </div>
      `;
    case 'NUMBER':
      return `
        <div class="form-group">
          <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">${field.label} ${field.required ? '*' : ''}</label>
          <input type="number" id="emp-cf-${field.code}" class="form-control" data-emp-cf-code="${field.code}" value="${val}" placeholder="0" ${reqStr} />
        </div>
      `;
    case 'DATE':
      return `
        <div class="form-group">
          <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">${field.label} ${field.required ? '*' : ''}</label>
          <input type="date" id="emp-cf-${field.code}" class="form-control" data-emp-cf-code="${field.code}" value="${val}" ${reqStr} />
        </div>
      `;
    default: // TEXT
      return `
        <div class="form-group">
          <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">${field.label} ${field.required ? '*' : ''}</label>
          <input type="text" id="emp-cf-${field.code}" class="form-control" data-emp-cf-code="${field.code}" value="${val}" placeholder="Enter ${field.label}..." ${reqStr} />
        </div>
      `;
  }
}

// ---------------------------------------------------------------------------
// 2. EMPLOYEE TRANSFER (RELOCATION) MODAL
// ---------------------------------------------------------------------------
function renderTransferEmployeeModal({ employeeId }) {
  const emp = employeeService.getEmployeeById(employeeId);
  if (!emp) return '';

  const groups = masterDataService.getGroups(true);
  const initialGroupId = emp.groupId || (groups[0]?.id || '');
  const units = masterDataService.getUnits(initialGroupId, true);
  const initialUnitId = emp.unitId || (units[0]?.id || '');
  const floors = masterDataService.getFloors(initialUnitId, null, true);
  const initialFloorId = emp.floorId || (floors[0]?.id || '');
  const lines = masterDataService.getLines(initialFloorId, null, null, true);

  return `
    <div class="modal-overlay active" id="modal-employee-overlay">
      <div class="modal-card" style="max-width: 720px; max-height: 90vh; overflow-y: auto;">
        <div class="modal-header" style="border-bottom: 1px solid var(--border-color); padding-bottom: 14px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 24px;">🔄</span>
            <div>
              <h3 style="margin: 0; font-size: 17px; font-weight: 800; color: #fff;">Employee Relocation &amp; Transfer</h3>
              <p style="margin: 2px 0 0 0; font-size: 12px; color: var(--text-muted);">
                Transfer <strong>${emp.name}</strong> [Card #${emp.cardNumber}] from current assignment to a new plant location
              </p>
            </div>
          </div>
          <button class="btn btn-ghost btn-sm" id="btn-close-employee-modal" style="font-size: 16px;">✕</button>
        </div>

        <form id="form-employee-transfer-submit" style="padding-top: 16px; display: flex; flex-direction: column; gap: 16px;">
          
          <!-- SECTION 1: TRANSFER FROM (CURRENT SOURCE LOCATION) -->
          <div style="background: rgba(239, 68, 68, 0.06); border: 1.5px solid rgba(239, 68, 68, 0.25); border-radius: var(--radius-md); padding: 14px 18px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
              <span style="font-size: 14px;">📍</span>
              <h4 style="margin: 0; font-size: 12.5px; font-weight: 800; color: #f87171; text-transform: uppercase; letter-spacing: 0.5px;">
                TRANSFER FROM (Current Source Assignment)
              </h4>
            </div>

            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; font-size: 12px; background: rgba(0,0,0,0.25); padding: 10px 14px; border-radius: 6px;">
              <div>
                <span style="color: var(--text-muted); font-size: 11px;">Employee:</span>
                <div style="font-weight: 700; color: #fff;">${emp.name}</div>
              </div>
              <div>
                <span style="color: var(--text-muted); font-size: 11px;">Card ID:</span>
                <div style="font-family: var(--font-mono); font-weight: 800; color: #38bdf8;">#${emp.cardNumber}</div>
              </div>
              <div>
                <span style="color: var(--text-muted); font-size: 11px;">Current Dept:</span>
                <div style="font-weight: 700; color: #fff;">${emp.department}</div>
              </div>
              <div style="grid-column: span 3; border-top: 1px dashed rgba(255,255,255,0.08); padding-top: 6px;">
                <span style="color: var(--text-muted); font-size: 11px;">Current Location Path:</span>
                <div style="font-weight: 700; color: #fca5a5; margin-top: 1px;">
                  ${emp.locationPath || 'Corporate Plant'} &bull; Area: ${emp.lineName || emp.workingArea || 'General'}
                </div>
              </div>
            </div>
          </div>

          <!-- SECTION 2: TRANSFER TO (DESTINATION LOCATION) -->
          <div style="background: rgba(56, 189, 248, 0.06); border: 1.5px solid rgba(56, 189, 248, 0.25); border-radius: var(--radius-md); padding: 14px 18px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
              <span style="font-size: 14px;">🎯</span>
              <h4 style="margin: 0; font-size: 12.5px; font-weight: 800; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.5px;">
                TRANSFER TO (New Destination Assignment)
              </h4>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              
              <div class="form-group">
                <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Destination Group *</label>
                <select id="emp-tr-group" class="filter-select" required>
                  ${groups.map(g => `<option value="${g.id}" ${initialGroupId === g.id ? 'selected' : ''}>${g.name}</option>`).join('')}
                </select>
              </div>

              <div class="form-group">
                <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Destination Factory / Unit *</label>
                <select id="emp-tr-unit" class="filter-select" required>
                  ${units.map(u => `<option value="${u.id}" ${initialUnitId === u.id ? 'selected' : ''}>${u.name}</option>`).join('')}
                </select>
              </div>

              <div class="form-group">
                <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Destination Floor *</label>
                <select id="emp-tr-floor" class="filter-select" required>
                  ${floors.map(f => `<option value="${f.id}" ${initialFloorId === f.id ? 'selected' : ''}>${f.name}</option>`).join('')}
                </select>
              </div>

              <div class="form-group">
                <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Destination Line / Bay</label>
                <select id="emp-tr-line" class="filter-select">
                  <option value="">Select Line / Bay...</option>
                  ${lines.map(l => `<option value="${l.id}">${l.name}</option>`).join('')}
                </select>
              </div>

              <div class="form-group">
                <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Department *</label>
                <select id="emp-tr-department" class="filter-select" required>
                  ${(() => { const depts = employeeService.getDistinctDepartments(); const cur = emp.department || ''; if (cur && !depts.includes(cur)) depts.unshift(cur); return depts.map(d => `<option value="${d}" ${emp.department === d ? 'selected' : ''}>${d}</option>`).join(''); })()}
                </select>
              </div>

              <div class="form-group">
                <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Designation *</label>
                <select id="emp-tr-designation" class="filter-select" required>
                  ${(() => { const desigs = employeeService.getDistinctDesignations(); const cur = emp.designation || ''; if (cur && !desigs.includes(cur)) desigs.unshift(cur); return desigs.map(d => `<option value="${d}" ${emp.designation === d ? 'selected' : ''}>${d}</option>`).join(''); })()}
                </select>
              </div>

              <div class="form-group" style="grid-column: span 2;">
                <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Effective Transfer Date *</label>
                <input type="date" id="emp-tr-date" class="form-control" value="${new Date().toISOString().split('T')[0]}" required />
              </div>

              <div class="form-group" style="grid-column: span 2;">
                <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Transfer Reason / Remarks *</label>
                <input type="text" id="emp-tr-reason" class="form-control" placeholder="e.g. Line balancing, emergency reallocation, floor transfer" required />
              </div>

            </div>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid var(--border-color); padding-top: 14px;">
            <button type="button" class="btn btn-secondary" id="btn-cancel-employee-modal">Cancel</button>
            <button type="submit" class="btn btn-primary" style="font-weight: 700; background: linear-gradient(135deg, #0284c7, #0369a1); box-shadow: 0 2px 10px rgba(2, 132, 199, 0.35);">
              🔄 Execute Employee Transfer
            </button>
          </div>

        </form>
      </div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// 3. EMPLOYEE LEAVE MODAL
// ---------------------------------------------------------------------------
function renderLeaveEmployeeModal({ employeeId }) {
  const emp = employeeService.getEmployeeById(employeeId);
  if (!emp) return '';

  return `
    <div class="modal-overlay active" id="modal-employee-overlay">
      <div class="modal-card" style="max-width: 580px;">
        <div class="modal-header" style="border-bottom: 1px solid var(--border-color); padding-bottom: 14px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 22px;">🏖️</span>
            <div>
              <h3 style="margin: 0; font-size: 17px; font-weight: 800; color: #fff;">Log Employee Leave</h3>
              <p style="margin: 2px 0 0 0; font-size: 12px; color: var(--text-muted);">
                Record authorized absence for <strong>${emp.name}</strong> [ID #${emp.cardNumber}]
              </p>
            </div>
          </div>
          <button class="btn btn-ghost btn-sm" id="btn-close-employee-modal" style="font-size: 16px;">✕</button>
        </div>

        <form id="form-employee-leave-submit" style="padding-top: 16px;">
          <div style="display: flex; flex-direction: column; gap: 14px; margin-bottom: 16px;">
            
            <div class="form-group">
              <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Leave Category *</label>
              <select id="emp-lv-type" class="filter-select" required>
                ${LEAVE_TYPES.map(l => `<option value="${l.code}">${l.label}</option>`).join('')}
              </select>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div class="form-group">
                <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Start Date *</label>
                <input type="date" id="emp-lv-start" class="form-control" value="${new Date().toISOString().split('T')[0]}" required />
              </div>
              <div class="form-group">
                <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">End Date *</label>
                <input type="date" id="emp-lv-end" class="form-control" value="${new Date().toISOString().split('T')[0]}" required />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Total Calendar Days</label>
              <input type="number" id="emp-lv-days" class="form-control" value="1" min="1" required />
            </div>

            <div class="form-group">
              <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Reason for Leave *</label>
              <input type="text" id="emp-lv-reason" class="form-control" placeholder="e.g. Family medical emergency / Personal reasons" required />
            </div>

          </div>

          <div style="display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid var(--border-color); padding-top: 14px;">
            <button type="button" class="btn btn-secondary" id="btn-cancel-employee-modal">Cancel</button>
            <button type="submit" class="btn btn-primary" style="font-weight: 700;">
              🏖️ Confirm &amp; Log Leave
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// 4. DIGITAL EMPLOYEE ID CARD & PRINTABLE PROFILE
// ---------------------------------------------------------------------------
function renderEmployeeIdCardModal({ employeeId }) {
  const emp = employeeService.getEmployeeById(employeeId);
  if (!emp) return '';

  const barcodeSvg = barcodeService.generateBarcodeSVG(emp.cardNumber, { width: 1.8, height: 40 });
  const qrSvg = barcodeService.generateQRCodeSVG(`AL-MUSLIM-ERP://EMP/${emp.cardNumber}/${emp.id}`, { size: 90 });
  const customFields = employeeCustomFieldService.getActiveFields();

  return `
    <div class="modal-overlay active" id="modal-employee-overlay">
      <div class="modal-card" style="max-width: 600px;">
        <div class="modal-header" style="border-bottom: 1px solid var(--border-color); padding-bottom: 14px;">
          <div>
            <h3 style="margin: 0; font-size: 17px; font-weight: 800; color: #fff;">Digital Employee ID Card</h3>
            <p style="margin: 2px 0 0 0; font-size: 12px; color: var(--text-muted);">Official Al-Muslim Group Workforce Identification</p>
          </div>
          <button class="btn btn-ghost btn-sm" id="btn-close-employee-modal" style="font-size: 16px;">✕</button>
        </div>

        <div style="padding: 16px 0;">
          <!-- Printable Badge Container -->
          <div id="printable-employee-badge" style="background: #ffffff; color: #0f172a; border-radius: 12px; padding: 20px; border: 2px solid #38bdf8; box-shadow: 0 4px 20px rgba(0,0,0,0.3); font-family: sans-serif;">
            
            <!-- Header -->
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0284c7; padding-bottom: 8px; margin-bottom: 12px;">
              <div>
                <div style="font-size: 14px; font-weight: 900; color: #0284c7; letter-spacing: 0.5px;">AL-MUSLIM GROUP</div>
                <div style="font-size: 9.5px; font-weight: 700; color: #475569;">EMPLOYEE IDENTITY PASS</div>
              </div>
              <div style="font-size: 10px; font-weight: 800; background: #0284c7; color: #fff; padding: 3px 8px; border-radius: 4px;">
                ${emp.unitName}
              </div>
            </div>

            <!-- Body Details -->
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 16px;">
              <div style="flex: 1;">
                <div style="font-size: 16px; font-weight: 900; color: #0f172a;">${emp.name}</div>
                <div style="font-size: 12px; font-weight: 700; color: #0284c7; margin-top: 2px;">${emp.designation}</div>
                <div style="font-size: 11px; color: #475569; margin-top: 2px;"><strong>Dept:</strong> ${emp.department}</div>
                <div style="font-size: 11px; color: #475569;"><strong>Loc:</strong> ${emp.floorName} &bull; ${emp.lineName}</div>
                <div style="font-family: monospace; font-size: 14px; font-weight: 900; color: #0f172a; margin-top: 6px;">
                  CARD ID: ${emp.cardNumber}
                </div>
              </div>
              <div style="display: flex; flex-direction: column; align-items: center;">
                ${qrSvg}
                <span style="font-size: 8px; color: #64748b; margin-top: 3px;">SCAN VERIFY</span>
              </div>
            </div>

            <!-- Custom Field Badges -->
            ${customFields.length > 0 ? `
              <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; padding-top: 8px; border-top: 1px dashed #cbd5e1; font-size: 10px; color: #334155;">
                ${customFields.filter(cf => emp.customFields && emp.customFields[cf.code]).map(cf => `
                  <span style="background: #f1f5f9; padding: 2px 6px; border-radius: 3px;">
                    <strong>${cf.label}:</strong> ${emp.customFields[cf.code]}
                  </span>
                `).join('')}
              </div>
            ` : ''}

            <!-- Barcode Footer -->
            <div style="text-align: center; margin-top: 12px; border-top: 1px solid #e2e8f0; padding-top: 8px;">
              ${barcodeSvg}
            </div>

          </div>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid var(--border-color); padding-top: 14px;">
          <button class="btn btn-secondary" id="btn-cancel-employee-modal">Close</button>
          <button class="btn btn-primary" id="btn-print-employee-card-action" style="font-weight: 700;">
            🖨️ Print Employee ID Badge
          </button>
        </div>

      </div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// 5. EXCEL IMPORT MODAL
// ---------------------------------------------------------------------------
function renderEmployeeImportModal() {
  return `
    <div class="modal-overlay active" id="modal-employee-overlay">
      <div class="modal-card" style="max-width: 680px;">
        <div class="modal-header" style="border-bottom: 1px solid var(--border-color); padding-bottom: 14px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 24px;">📥</span>
            <div>
              <h3 style="margin: 0; font-size: 17px; font-weight: 800; color: #fff;">Batch Manpower Excel Import &amp; Auto-Update</h3>
              <p style="margin: 2px 0 0 0; font-size: 12px; color: var(--text-muted);">
                Bulk import workforce changes, designations/promotions, floor transfers, and new recruits
              </p>
            </div>
          </div>
          <button class="btn btn-ghost btn-sm" id="btn-close-employee-modal" style="font-size: 16px;">✕</button>
        </div>

        <div style="padding: 16px 0; display: flex; flex-direction: column; gap: 14px;">
          
          <!-- Smart Auto-Detection Info Banner -->
          <div style="background: rgba(56, 189, 248, 0.08); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 8px; padding: 10px 14px; font-size: 12px; color: #bae6fd; display: flex; gap: 10px; align-items: flex-start; line-height: 1.5;">
            <span style="font-size: 18px; line-height: 1;">💡</span>
            <div>
              <strong style="color: #38bdf8;">Smart Card ID Normalization &amp; Auto-Sync Engine:</strong><br/>
              Matches employees by Card ID whether formatted as <strong>Worker (AMG0000000)</strong>, <strong>Staff (AMG-0000000)</strong>, or numeric digits. Existing personnel are auto-updated with promotions &amp; floor transfers; new personnel are added. All changes automatically sync to <strong>Tools Management</strong>!
            </div>
          </div>

          <!-- Dropzone -->
          <div style="background: var(--bg-card); border: 2px dashed #0284c7; border-radius: var(--radius-md); padding: 28px 20px; text-align: center; cursor: pointer; transition: all 0.2s ease;" id="emp-import-dropzone" onmouseover="this.style.background='rgba(2, 132, 199, 0.08)'" onmouseout="this.style.background='var(--bg-card)'">
            <span style="font-size: 38px; display: block; margin-bottom: 6px;">📊</span>
            <div style="font-weight: 800; color: #fff; font-size: 14px;">Click or Drag &amp; Drop Excel file (.xlsx, .xls, .csv)</div>
            <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 4px;">
              Auto-maps: Card Number / ID, Full Name, Designation, Department, Working Area, Floor, Phone
            </div>
            <input type="file" id="inp-employee-import-file" accept=".xlsx, .xls, .csv" style="display: none;" />
          </div>

          <!-- Live Preview & Status Box -->
          <div id="emp-import-preview-status" style="display: none; padding: 14px; border-radius: var(--radius-md); font-size: 12.5px;"></div>

        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-color); padding-top: 14px; flex-wrap: wrap; gap: 10px;">
          <button class="btn btn-ghost btn-sm" id="btn-download-emp-template" style="color: #38bdf8; font-weight: 800; display: flex; align-items: center; gap: 6px;">
            📥 Download Sample Template (.xlsx)
          </button>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-secondary" id="btn-cancel-employee-modal">Cancel</button>
            <button class="btn btn-primary" id="btn-confirm-emp-import" style="font-weight: 800; background: linear-gradient(135deg, #0284c7, #0369a1); box-shadow: 0 2px 8px rgba(2, 132, 199, 0.4);" disabled>
              Confirm Import &amp; Auto-Update
            </button>
          </div>
        </div>

      </div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// EVENT BINDINGS FOR MODALS
// ---------------------------------------------------------------------------
export function initEmployeeModalEvents(refreshParentCallback) {
  const closeModal = () => {
    state.set('activeEmployeeModal', null);
    if (refreshParentCallback) refreshParentCallback();
  };

  const btnClose = document.getElementById('btn-close-employee-modal');
  const btnCancel = document.getElementById('btn-cancel-employee-modal');
  const overlay = document.getElementById('modal-employee-overlay');

  if (btnClose) btnClose.addEventListener('click', closeModal);
  if (btnCancel) btnCancel.addEventListener('click', closeModal);
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
  }

  // 1. Add / Edit Form Cascading Listeners
  const groupSel = document.getElementById('emp-modal-group');
  const unitSel = document.getElementById('emp-modal-unit');
  const floorSel = document.getElementById('emp-modal-floor');
  const lineSel = document.getElementById('emp-modal-line');

  if (groupSel && unitSel) {
    groupSel.addEventListener('change', () => {
      const units = masterDataService.getUnits(groupSel.value, true);
      unitSel.innerHTML = units.length > 0 
        ? units.map(u => `<option value="${u.id}">${u.name}</option>`).join('')
        : '<option value="">No units under group</option>';
      unitSel.dispatchEvent(new Event('change'));
    });
  }

  if (unitSel && floorSel) {
    unitSel.addEventListener('change', () => {
      const floors = masterDataService.getFloors(unitSel.value, null, true);
      floorSel.innerHTML = floors.length > 0
        ? floors.map(f => `<option value="${f.id}">${f.name}</option>`).join('')
        : '<option value="">No floors under unit</option>';
      floorSel.dispatchEvent(new Event('change'));
    });
  }

  if (floorSel && lineSel) {
    floorSel.addEventListener('change', () => {
      const lines = masterDataService.getLines(floorSel.value, null, null, true);
      lineSel.innerHTML = '<option value="">Select Line / Bay...</option>' + 
        lines.map(l => `<option value="${l.id}">${l.name}</option>`).join('');
    });
  }

  // Submit Add / Edit Form
  const formAddEdit = document.getElementById('form-employee-submit');
  const btnSubmitForm = formAddEdit?.querySelector('button[type="submit"]');

  // Real-time Card ID Auto-Search & Duplicate Prevention
  const cardInp = document.getElementById('emp-field-card');
  const cardDropdown = document.getElementById('emp-card-search-dropdown');
  const conflictAlert = document.getElementById('emp-card-conflict-alert');
  const activeModal = state.get('activeEmployeeModal');
  const isEditMode = activeModal?.type === 'EDIT';
  const excludeId = isEditMode ? activeModal.employeeId : null;

  if (cardInp && cardDropdown && conflictAlert) {
    const handleCardSearch = () => {
      const val = cardInp.value.trim();

      if (!val) {
        cardDropdown.style.display = 'none';
        conflictAlert.style.display = 'none';
        if (btnSubmitForm) btnSubmitForm.disabled = false;
        return;
      }

      // 1. Search existing employees matching Card ID / query
      const allMatches = employeeService.searchEmployees(val);
      const isExactDuplicate = employeeService.checkDuplicateCardNumber(val, excludeId);

      // Render Dropdown List
      if (allMatches.length > 0) {
        cardDropdown.style.display = 'block';
        cardDropdown.innerHTML = `
          <div style="padding: 6px 12px; font-size: 11px; font-weight: 700; color: #38bdf8; border-bottom: 1px solid rgba(255,255,255,0.08); background: rgba(56,189,248,0.08);">
            🔍 Matching Existing Employee Cards (${allMatches.length}):
          </div>
          ${allMatches.map(emp => `
            <div class="emp-card-search-item" data-card="${emp.cardNumber}" style="padding: 9px 14px; border-bottom: 1px solid rgba(255,255,255,0.04); cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: background 0.15s;" onmouseover="this.style.background='rgba(56,189,248,0.15)'" onmouseout="this.style.background='transparent'">
              <div>
                <span style="font-family: var(--font-mono); font-weight: 900; color: #38bdf8; font-size: 13px;">#${emp.cardNumber}</span>
                <span style="font-weight: 700; color: #fff; margin-left: 8px;">${emp.name}</span>
                <div style="font-size: 11px; color: var(--text-muted); margin-top: 1px;">
                  ${emp.designation} &bull; ${emp.department} (${emp.floorName || 'General Floor'})
                </div>
              </div>
              <span class="badge ${emp.status === 'ACTIVE' ? 'badge-active' : 'badge-maint'}" style="font-size: 10px;">${emp.status}</span>
            </div>
          `).join('')}
        `;

        // Bind item click in dropdown
        cardDropdown.querySelectorAll('.emp-card-search-item').forEach(item => {
          item.addEventListener('click', (e) => {
            e.stopPropagation();
            const selectedCard = item.getAttribute('data-card');
            cardInp.value = selectedCard;
            cardDropdown.style.display = 'none';
            handleCardSearch();
          });
        });
      } else {
        cardDropdown.style.display = 'block';
        cardDropdown.innerHTML = `
          <div style="padding: 12px 14px; font-size: 12px; color: #94a3b8; text-align: center;">
            ℹ️ No existing employee found with Card ID '<strong>${val}</strong>'<br>
            <span style="color: #34d399; font-size: 11px; font-weight: 700;">✓ Available to register as new employee ID</span>
          </div>
        `;
      }

      // 2. Real-Time Duplicate Validation & Submit Button Blocker
      if (isExactDuplicate) {
        const owner = employeeService.getEmployeeByCardNumber(val);
        conflictAlert.style.display = 'block';
        conflictAlert.style.background = 'rgba(239, 68, 68, 0.12)';
        conflictAlert.style.border = '1.5px solid #ef4444';
        conflictAlert.style.color = '#f87171';
        conflictAlert.innerHTML = `
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <div>
              🚫 <strong>Duplicate Card ID Conflict:</strong> Card <strong>#${val}</strong> already belongs to <strong>${owner?.name || 'Existing Employee'}</strong> (${owner?.designation || ''}, ${owner?.department || ''}).
            </div>
            <div style="font-size: 11px; color: #fca5a5;">
              📍 Current Location: ${owner?.locationPath || 'Corporate Plant'} &bull; Area: ${owner?.lineName || owner?.workingArea || 'General'}
            </div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 2px;">
              <button type="button" class="btn btn-primary btn-xs" id="btn-alert-transfer-emp" data-emp-id="${owner?.id}" style="background: linear-gradient(135deg, #0284c7, #0369a1); font-weight: 700; border: none; padding: 4px 10px;">
                🔄 Transfer this Employee (TRANSFER FROM)
              </button>
              <button type="button" class="btn btn-secondary btn-xs" id="btn-alert-edit-emp" data-emp-id="${owner?.id}" style="padding: 4px 10px;">
                ✏️ Edit Employee Profile
              </button>
            </div>
          </div>
        `;
        if (btnSubmitForm) btnSubmitForm.disabled = true;

        // Bind quick transfer button
        const btnTr = conflictAlert.querySelector('#btn-alert-transfer-emp');
        if (btnTr && owner) {
          btnTr.addEventListener('click', () => {
            state.set('activeEmployeeModal', { type: 'TRANSFER', employeeId: owner.id });
            if (refreshParentCallback) refreshParentCallback();
          });
        }

        // Bind quick edit button
        const btnEd = conflictAlert.querySelector('#btn-alert-edit-emp');
        if (btnEd && owner) {
          btnEd.addEventListener('click', () => {
            state.set('activeEmployeeModal', { type: 'EDIT', employeeId: owner.id });
            if (refreshParentCallback) refreshParentCallback();
          });
        }
      } else {
        conflictAlert.style.display = 'block';
        conflictAlert.style.background = 'rgba(52, 211, 153, 0.15)';
        conflictAlert.style.border = '1px solid #10b981';
        conflictAlert.style.color = '#34d399';
        conflictAlert.innerHTML = `
          ✅ <strong>Valid Card ID:</strong> Card #${val} is unique and available.
        `;
        if (btnSubmitForm) btnSubmitForm.disabled = false;
      }
    };

    cardInp.addEventListener('input', handleCardSearch);
    cardInp.addEventListener('focus', handleCardSearch);

    // Hide dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!cardInp.contains(e.target) && !cardDropdown.contains(e.target)) {
        cardDropdown.style.display = 'none';
      }
    });
  }

  if (formAddEdit && activeModal) {
    formAddEdit.addEventListener('submit', (e) => {
      e.preventDefault();
      try {
        const name = document.getElementById('emp-field-name')?.value?.trim();
        const cardNumber = document.getElementById('emp-field-card')?.value?.trim();
        const designation = document.getElementById('emp-field-designation')?.value;
        const department = document.getElementById('emp-field-department')?.value;
        const phone = document.getElementById('emp-field-phone')?.value?.trim();
        const joinDate = document.getElementById('emp-field-joindate')?.value;
        const status = document.getElementById('emp-field-status')?.value || 'ACTIVE';

        const groupId = document.getElementById('emp-modal-group')?.value;
        const unitId = document.getElementById('emp-modal-unit')?.value;
        const floorId = document.getElementById('emp-modal-floor')?.value;
        const lineId = document.getElementById('emp-modal-line')?.value;
        const workingArea = document.getElementById('emp-field-workingarea')?.value?.trim();

        // Extract Custom Field Values
        const customFields = {};
        document.querySelectorAll('[data-emp-cf-code]').forEach(inp => {
          const code = inp.getAttribute('data-emp-cf-code');
          if (code) {
            customFields[code] = inp.value;
          }
        });

        const payload = {
          name,
          cardNumber,
          designation,
          department,
          phone,
          joinDate,
          status,
          groupId,
          unitId,
          floorId,
          lineId,
          workingArea,
          customFields
        };

        if (activeModal.type === 'EDIT') {
          employeeService.updateEmployee(activeModal.employeeId, payload);
          notificationService.success(`Updated profile for ${name}`);
        } else {
          employeeService.createEmployee(payload);
          notificationService.success(`Registered new employee ${name} [#${cardNumber}]`);
        }

        closeModal();
      } catch (err) {
        notificationService.error('Failed to save employee: ' + err.message);
      }
    });
  }

  // 2. Submit Transfer Form
  const formTransfer = document.getElementById('form-employee-transfer-submit');
  if (formTransfer && activeModal?.employeeId) {
    // Cascading in transfer modal
    const trGroup = document.getElementById('emp-tr-group');
    const trUnit = document.getElementById('emp-tr-unit');
    const trFloor = document.getElementById('emp-tr-floor');
    const trLine = document.getElementById('emp-tr-line');

    if (trGroup && trUnit) {
      trGroup.addEventListener('change', () => {
        const units = masterDataService.getUnits(trGroup.value, true);
        trUnit.innerHTML = units.map(u => `<option value="${u.id}">${u.name}</option>`).join('');
        trUnit.dispatchEvent(new Event('change'));
      });
    }
    if (trUnit && trFloor) {
      trUnit.addEventListener('change', () => {
        const floors = masterDataService.getFloors(trUnit.value, null, true);
        trFloor.innerHTML = floors.map(f => `<option value="${f.id}">${f.name}</option>`).join('');
        trFloor.dispatchEvent(new Event('change'));
      });
    }
    if (trFloor && trLine) {
      trFloor.addEventListener('change', () => {
        const lines = masterDataService.getLines(trFloor.value, null, null, true);
        trLine.innerHTML = '<option value="">Select Line / Bay...</option>' + lines.map(l => `<option value="${l.id}">${l.name}</option>`).join('');
      });
    }

    formTransfer.addEventListener('submit', (e) => {
      e.preventDefault();
      try {
        employeeService.transferEmployee({
          employeeId: activeModal.employeeId,
          toGroupId: trGroup?.value,
          toUnitId: trUnit?.value,
          toFloorId: trFloor?.value,
          toLineId: trLine?.value,
          toDepartment: document.getElementById('emp-tr-department')?.value,
          toDesignation: document.getElementById('emp-tr-designation')?.value,
          transferDate: document.getElementById('emp-tr-date')?.value,
          reason: document.getElementById('emp-tr-reason')?.value
        });
        notificationService.success('Employee relocated successfully');
        closeModal();
      } catch (err) {
        notificationService.error('Transfer failed: ' + err.message);
      }
    });
  }

  // 3. Submit Leave Form
  const formLeave = document.getElementById('form-employee-leave-submit');
  if (formLeave && activeModal?.employeeId) {
    formLeave.addEventListener('submit', (e) => {
      e.preventDefault();
      try {
        employeeService.addLeave({
          employeeId: activeModal.employeeId,
          leaveType: document.getElementById('emp-lv-type')?.value,
          startDate: document.getElementById('emp-lv-start')?.value,
          endDate: document.getElementById('emp-lv-end')?.value,
          totalDays: document.getElementById('emp-lv-days')?.value,
          reason: document.getElementById('emp-lv-reason')?.value
        });
        notificationService.success('Leave recorded successfully');
        closeModal();
      } catch (err) {
        notificationService.error('Failed to log leave: ' + err.message);
      }
    });
  }

  // 4. Print ID Card Action
  const btnPrintCard = document.getElementById('btn-print-employee-card-action');
  if (btnPrintCard) {
    btnPrintCard.addEventListener('click', () => {
      const cardEl = document.getElementById('printable-employee-badge');
      if (cardEl) {
        const printWin = window.open('', '', 'width=650,height=750');
        printWin.document.write(`
          <html>
            <head>
              <title>Employee ID Badge - Al-Muslim Group</title>
              <style>
                body { font-family: Arial, sans-serif; padding: 20px; text-align: center; }
                #printable-employee-badge { max-width: 480px; margin: 0 auto; border: 2px solid #0284c7; padding: 20px; border-radius: 12px; }
              </style>
            </head>
            <body>
              ${cardEl.outerHTML}
              <script>
                window.onload = function() { window.print(); window.close(); };
              <\/script>
            </body>
          </html>
        `);
        printWin.document.close();
      }
    });
  }

  // 5. Excel Import Handlers
  let parsedImportRows = [];
  const dropzone = document.getElementById('emp-import-dropzone');
  const fileInp = document.getElementById('inp-employee-import-file');
  const btnConfirmImport = document.getElementById('btn-confirm-emp-import');
  const statusBox = document.getElementById('emp-import-preview-status');
  const btnDownloadTemplate = document.getElementById('btn-download-emp-template');

  if (dropzone && fileInp) {
    dropzone.addEventListener('click', () => fileInp.click());

    // Drag and drop visual feedback
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.style.background = 'rgba(2, 132, 199, 0.15)';
      dropzone.style.borderColor = '#38bdf8';
    });
    dropzone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dropzone.style.background = 'var(--bg-card)';
      dropzone.style.borderColor = '#0284c7';
    });
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.style.background = 'var(--bg-card)';
      dropzone.style.borderColor = '#0284c7';
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        fileInp.files = e.dataTransfer.files;
        fileInp.dispatchEvent(new Event('change'));
      }
    });

    fileInp.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const rows = await excelService.parseExcelFile(file);
        parsedImportRows = rows;

        if (rows.length === 0) {
          if (statusBox) {
            statusBox.style.display = 'block';
            statusBox.style.background = 'rgba(248, 113, 113, 0.1)';
            statusBox.style.border = '1px solid rgba(248, 113, 113, 0.3)';
            statusBox.style.color = '#f87171';
            statusBox.innerHTML = `⚠️ The file '<strong>${file.name}</strong>' has no data rows.`;
          }
          if (btnConfirmImport) btnConfirmImport.disabled = true;
          return;
        }

        const preview = employeeService.previewManpowerImport(rows);

        if (statusBox && btnConfirmImport) {
          statusBox.style.display = 'block';
          statusBox.style.background = 'rgba(15, 23, 42, 0.9)';
          statusBox.style.border = '1.5px solid #0284c7';
          statusBox.style.color = '#fff';

          statusBox.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px; margin-bottom: 10px;">
              <div style="font-weight: 800; color: #38bdf8; font-size: 13px; display: flex; align-items: center; gap: 6px;">
                <span>📄</span> <span>File Loaded: <strong>${file.name}</strong> (${rows.length} total rows)</span>
              </div>
              <span class="badge badge-active" style="font-size: 11px;">Ready to Process</span>
            </div>

            <!-- Metric Summary Grid -->
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 10px;">
              <div style="background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 6px; padding: 8px 6px; text-align: center;">
                <div style="font-size: 18px; font-weight: 900; color: #38bdf8;">${preview.updatedCount}</div>
                <div style="font-size: 10.5px; color: #94a3b8; margin-top: 2px;">Update Existing</div>
              </div>
              <div style="background: rgba(251, 191, 36, 0.1); border: 1px solid rgba(251, 191, 36, 0.3); border-radius: 6px; padding: 8px 6px; text-align: center;">
                <div style="font-size: 18px; font-weight: 900; color: #fbbf24;">${preview.promotedCount}</div>
                <div style="font-size: 10.5px; color: #94a3b8; margin-top: 2px;">Promotions</div>
              </div>
              <div style="background: rgba(168, 85, 247, 0.1); border: 1px solid rgba(168, 85, 247, 0.3); border-radius: 6px; padding: 8px 6px; text-align: center;">
                <div style="font-size: 18px; font-weight: 900; color: #c084fc;">${preview.transferredCount}</div>
                <div style="font-size: 10.5px; color: #94a3b8; margin-top: 2px;">Floor Transfers</div>
              </div>
              <div style="background: rgba(52, 211, 153, 0.1); border: 1px solid rgba(52, 211, 153, 0.3); border-radius: 6px; padding: 8px 6px; text-align: center;">
                <div style="font-size: 18px; font-weight: 900; color: #34d399;">${preview.addedCount}</div>
                <div style="font-size: 10.5px; color: #94a3b8; margin-top: 2px;">New Recruits</div>
              </div>
            </div>

            ${preview.samplePromotions && preview.samplePromotions.length > 0 ? `
              <div style="background: rgba(251, 191, 36, 0.08); border-left: 3px solid #fbbf24; border-radius: 4px; padding: 6px 10px; font-size: 11.5px; margin-bottom: 8px; color: #fde68a;">
                <strong>🎯 Promotion Samples Detected:</strong>
                <div style="margin-top: 4px; display: flex; flex-direction: column; gap: 3px;">
                  ${preview.samplePromotions.map(p => `
                    <div>&bull; <strong>${p.name}</strong> [Card #${p.card}]: <span style="text-decoration: line-through; color: #94a3b8;">${p.from}</span> &rarr; <span style="color: #34d399; font-weight: 800;">${p.to}</span></div>
                  `).join('')}
                </div>
              </div>
            ` : ''}

            ${preview.sampleTransfers && preview.sampleTransfers.length > 0 ? `
              <div style="background: rgba(168, 85, 247, 0.08); border-left: 3px solid #c084fc; border-radius: 4px; padding: 6px 10px; font-size: 11.5px; margin-bottom: 8px; color: #e9d5ff;">
                <strong>📍 Floor / Area Transfer Samples:</strong>
                <div style="margin-top: 4px; display: flex; flex-direction: column; gap: 3px;">
                  ${preview.sampleTransfers.map(t => `
                    <div>&bull; <strong>${t.name}</strong> [Card #${t.card}]: <span style="color: #94a3b8;">${t.fromLoc}</span> &rarr; <span style="color: #38bdf8; font-weight: 800;">${t.toLoc}</span></div>
                  `).join('')}
                </div>
              </div>
            ` : ''}

            <div style="font-size: 11px; color: #38bdf8; display: flex; align-items: center; gap: 6px; padding-top: 4px;">
              <span>⚡</span> <span>All updates will automatically synchronize with <strong>Tools Management</strong> registrations &amp; ID card printouts.</span>
            </div>
          `;
          btnConfirmImport.disabled = false;
        }
      } catch (err) {
        if (statusBox) {
          statusBox.style.display = 'block';
          statusBox.style.background = 'rgba(248, 113, 113, 0.1)';
          statusBox.style.border = '1px solid rgba(248, 113, 113, 0.3)';
          statusBox.style.color = '#f87171';
          statusBox.innerHTML = `❌ Failed to parse Excel: ${err.message}`;
        }
        if (btnConfirmImport) btnConfirmImport.disabled = true;
      }
    });
  }

  if (btnConfirmImport) {
    btnConfirmImport.addEventListener('click', () => {
      if (parsedImportRows.length === 0) return;
      btnConfirmImport.disabled = true;
      btnConfirmImport.innerText = 'Processing Import...';

      try {
        const res = employeeService.importManpowerData(parsedImportRows);

        // Also ensure tool service sync is run if loaded
        if (typeof window !== 'undefined' && window.toolService && typeof window.toolService.syncAllocationsWithManpower === 'function') {
          window.toolService.syncAllocationsWithManpower();
        }

        notificationService.success(
          `Import & Auto-Update Successful! Updated: ${res.updatedCount} (${res.promotedCount} promotions, ${res.transferredCount} transfers), Added: ${res.addedCount} new employees. Tools Management synchronized!`
        );
        closeModal();
      } catch (err) {
        notificationService.error('Import failed: ' + err.message);
        btnConfirmImport.disabled = false;
        btnConfirmImport.innerText = 'Confirm Import & Auto-Update';
      }
    });
  }

  if (btnDownloadTemplate) {
    btnDownloadTemplate.addEventListener('click', async () => {
      const templateData = employeeService.generateManpowerTemplateData();
      await excelService.exportToExcel(templateData, 'AlMuslim_Manpower_Import_Template.xlsx');
      notificationService.success('Sample Manpower Import Template downloaded successfully.');
    });
  }
}
