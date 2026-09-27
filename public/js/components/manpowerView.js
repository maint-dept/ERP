/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Comprehensive Manpower & Workforce Management View Component
 * 
 * Clean, Simple & User-Friendly Workflow:
 * 1. Active Manpower — Dedicated list of active workforce
 * 2. Inactive Manpower — Inactive / Resigned / On-Leave workforce with 1-click reactivate
 * 3. Employee Transfer — Historical relocation & movement ledger
 * 4. Leave Records — Active and past employee leaves & attendance
 * 5. Custom Fields — Admin dynamic field configuration
 */

import { storage } from '../db/storage.js';
import { TABLE_NAMES } from '../db/schema.js';
import { employeeService, DEPARTMENTS, DESIGNATIONS, LEAVE_TYPES } from '../services/employeeService.js';
import { employeeCustomFieldService } from '../services/employeeCustomFieldService.js';
import { masterDataService } from '../services/masterDataService.js';
import { excelService } from '../services/excelService.js';
import { authService } from '../services/authService.js';
import { notificationService } from '../services/notificationService.js';
import { state } from '../state.js';
import { renderEmployeeModal, initEmployeeModalEvents } from './employeeModal.js';

let activeManpowerTab = 'active'; // 'active', 'inactive', 'transfers', 'leaves', 'custom-fields'
let activeCustomFieldModal = null; // { type: 'ADD'|'EDIT', field: Object }
let selectedEmployeeIds = new Set();

// Multi-Filter State
let filterState = {
  search: '',
  department: 'ALL',
  designation: 'ALL',
  unitId: 'ALL',
  floorId: 'ALL'
};

function formatEmployeesForExport(employees) {
  const customFields = employeeCustomFieldService.getActiveFields();
  return employees.map((emp, index) => {
    const row = {
      'Sl.': index + 1,
      'Employee / Card ID': emp.cardNumber || emp.id,
      'Full Name': emp.name,
      'Designation': emp.designation,
      'Department': emp.department,
      'Factory / Unit': emp.unitName || 'AKM Knitwear Ltd.',
      'Plant Floor': emp.floorName || emp.floor || '',
      'Line / Working Area': emp.workingArea || emp.lineName || '',
      'Phone Number': emp.phone || '',
      'Joining Date': emp.joinDate || '',
      'Status': emp.status
    };
    customFields.forEach(cf => {
      row[cf.label] = emp.customFields?.[cf.code] ?? '';
    });
    return row;
  });
}

export function renderManpowerView() {
  const requestedTab = state.get('manpowerActiveTab');
  if (requestedTab) {
    activeManpowerTab = requestedTab;
  } else {
    state.set('manpowerActiveTab', activeManpowerTab);
  }

  const stats = employeeService.getManpowerStats();
  const isAdmin = authService.isAdmin();

  // Active employees list
  const activeEmployees = employeeService.getAllEmployees({
    ...filterState,
    status: 'ACTIVE'
  });

  // Inactive employees list (Includes INACTIVE, ON_LEAVE, TERMINATED)
  const allFiltered = employeeService.getAllEmployees(filterState);
  const inactiveEmployees = allFiltered.filter(e => e.status !== 'ACTIVE');

  const transfers = employeeService.getEmployeeTransfers();
  const leaves = employeeService.getEmployeeLeaves();
  const customFields = employeeCustomFieldService.getAllFields();

  return `
    <div class="page-view" style="display: flex; flex-direction: column; gap: 12px; width: 100%; max-width: 100%; height: 100%; overflow: hidden; box-sizing: border-box; padding: 12px 20px;">
      
      <!-- Top Title Bar (Responsive) -->
      <div class="view-header-row" style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; flex-shrink: 0;">
        <div style="min-width: 0; flex: 1;">
          <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
            <span style="font-size: 22px;">👥</span>
            <h1 style="font-size: 18px; font-weight: 800; color: #fff; margin: 0; word-break: break-word;">
              Manpower Management
            </h1>
            <span class="badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); font-size: 11px; padding: 2px 8px; white-space: nowrap;">
              ${stats.total} Total Workforce
            </span>
          </div>
          <p style="font-size: 11.5px; color: var(--text-secondary); margin-top: 2px; margin-bottom: 0;">
            Manage plant mechanics, technicians, line supervisors, floor allocations, and leave rosters.
          </p>
        </div>

        <div class="view-header-actions" style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
          <button id="btn-manpower-add-emp" class="btn btn-primary btn-sm" style="font-weight: 700; background: linear-gradient(135deg, #0284c7, #0369a1); box-shadow: 0 2px 10px rgba(2, 132, 199, 0.35); white-space: nowrap;">
            ➕ Add Employee
          </button>
          <button id="btn-manpower-import-excel" class="btn btn-secondary btn-sm" style="font-weight: 700; white-space: nowrap;">
            📥 Excel Import
          </button>
          <button id="btn-manpower-export-excel" class="btn btn-secondary btn-sm" style="font-weight: 700; white-space: nowrap;">
            📤 Excel Export (.xlsx)
          </button>
        </div>
      </div>

      <!-- Navigation Tabs (Clean Button Pills, Fixed Height) -->
      <div id="manpower-nav-tabs-bar" style="display: flex; gap: 8px; border-bottom: 2px solid var(--border-color); padding-bottom: 6px; flex-wrap: nowrap; flex-shrink: 0; overflow-x: auto; scrollbar-width: none; height: 38px; align-items: center;">
        <button class="btn btn-sm ${activeManpowerTab === 'active' ? 'btn-primary' : 'btn-ghost'}" data-manpower-tab="active" style="font-size: 12.5px; font-weight: 700; white-space: nowrap;">
          🟢 Active Manpower (${stats.active})
        </button>
        <button class="btn btn-sm ${activeManpowerTab === 'inactive' ? 'btn-primary' : 'btn-ghost'}" data-manpower-tab="inactive" style="font-size: 12.5px; font-weight: 700; white-space: nowrap;">
          🔴 Inactive Manpower (${stats.inactive + stats.onLeave})
        </button>
        <button class="btn btn-sm ${activeManpowerTab === 'transfers' ? 'btn-primary' : 'btn-ghost'}" data-manpower-tab="transfers" style="font-size: 12.5px; font-weight: 700; white-space: nowrap;">
          🔄 Employee Transfer (${transfers.length})
        </button>
        <button class="btn btn-sm ${activeManpowerTab === 'leaves' ? 'btn-primary' : 'btn-ghost'}" data-manpower-tab="leaves" style="font-size: 12.5px; font-weight: 700; white-space: nowrap;">
          🏖️ Leave Records (${leaves.length})
        </button>
        ${isAdmin ? `
          <button class="btn btn-sm ${activeManpowerTab === 'custom-fields' ? 'btn-primary' : 'btn-ghost'}" data-manpower-tab="custom-fields" style="font-size: 12.5px; font-weight: 700; white-space: nowrap; color: ${activeManpowerTab === 'custom-fields' ? '#fff' : '#fbbf24'};">
            ⚙️ Custom Fields (${customFields.length})
          </button>
        ` : ''}
      </div>

      <!-- Active Tab Content (Screen-Fit Container) -->
      <div id="manpower-tab-container" style="display: flex; flex-direction: column; gap: 10px; flex: 1 1 0; min-height: 0; overflow: hidden;">
        ${renderActiveTabContent({ stats, activeEmployees, inactiveEmployees, transfers, leaves, customFields, isAdmin })}
      </div>

      <!-- Employee Modal Layer -->
      ${renderEmployeeModal()}

      <!-- Custom Field Designer Modal (if open) -->
      ${renderCustomFieldDesignerModal()}

    </div>
  `;
}

function renderActiveTabContent({ stats, activeEmployees, inactiveEmployees, transfers, leaves, customFields, isAdmin }) {
  switch (activeManpowerTab) {
    case 'active':
      return renderEmployeeListTable({
        title: '🟢 Active Workforce Roster',
        subtitle: 'Currently active and operational personnel deployed across factory lines',
        employees: activeEmployees,
        isInactiveView: false
      });
    case 'inactive':
      return renderEmployeeListTable({
        title: '🔴 Inactive / On-Leave / Resigned Workforce',
        subtitle: 'Inactive, suspended, on-leave, or resigned personnel. Click Activate (▶️) to restore to Active status.',
        employees: inactiveEmployees,
        isInactiveView: true
      });
    case 'transfers':
      return renderEmployeeTransfersTab(transfers);
    case 'leaves':
      return renderEmployeeLeavesTab(leaves);
    case 'custom-fields':
      return renderCustomFieldsTab(customFields);
    default:
      return renderEmployeeListTable({
        title: '🟢 Active Workforce Roster',
        subtitle: 'Currently active and operational personnel',
        employees: activeEmployees,
        isInactiveView: false
      });
  }
}

// ---------------------------------------------------------------------------
// 1. ACTIVE & INACTIVE EMPLOYEE TABLE
// ---------------------------------------------------------------------------
function renderEmployeeListTable({ title, subtitle, employees, isInactiveView }) {
  const units = masterDataService.getUnits(null, true);
  const floors = masterDataService.getFloors(filterState.unitId !== 'ALL' ? filterState.unitId : null, null, true);

  const flrMap = new Map((storage.getTable(TABLE_NAMES.FLOORS) || []).map(x => [x.id, x.name]));
  const untMap = new Map((storage.getTable(TABLE_NAMES.UNITS) || []).map(x => [x.id, x.name]));
  const linMap = new Map((storage.getTable(TABLE_NAMES.LINES) || []).map(x => [x.id, x.name]));

  // Reconcile selectedEmployeeIds with the currently visible employees
  const currentEmpIdSet = new Set(employees.map(e => e.id));
  const activeSelectedIds = Array.from(selectedEmployeeIds).filter(id => currentEmpIdSet.has(id));
  const selectedCount = activeSelectedIds.length;
  const allSelected = employees.length > 0 && selectedCount === employees.length;
  const someSelected = selectedCount > 0 && selectedCount < employees.length;

  return `
    <div style="display: flex; flex-direction: column; gap: 10px; flex: 1 1 0; min-height: 0; overflow: hidden;">
      
      <!-- Search & Filters Toolbar -->
      <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 10px 14px; display: flex; flex-direction: column; gap: 8px; flex-shrink: 0;">
        <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
          
          <!-- Prominent Instant Search -->
          <div style="flex: 1.5; min-width: 220px;">
            <input 
              type="text" 
              id="mp-filter-search" 
              class="form-control" 
              placeholder="🔍 Search by Card #, Name, Dept, Phone..." 
              value="${filterState.search}" 
              style="font-size: 12.5px; height: 34px;"
            />
          </div>

          <!-- Department Filter -->
          <div style="flex: 1; min-width: 140px;">
            <select id="mp-filter-dept" class="filter-select" style="font-size: 12px; height: 34px;">
              <option value="ALL">All Departments</option>
              ${DEPARTMENTS.map(d => `<option value="${d}" ${filterState.department === d ? 'selected' : ''}>${d}</option>`).join('')}
            </select>
          </div>

          <!-- Designation Filter -->
          <div style="flex: 1; min-width: 140px;">
            <select id="mp-filter-desig" class="filter-select" style="font-size: 12px; height: 34px;">
              <option value="ALL">All Designations</option>
              ${DESIGNATIONS.map(d => `<option value="${d}" ${filterState.designation === d ? 'selected' : ''}>${d}</option>`).join('')}
            </select>
          </div>

          <!-- Unit / Factory Filter -->
          <div style="flex: 1; min-width: 130px;">
            <select id="mp-filter-unit" class="filter-select" style="font-size: 12px; height: 34px;">
              <option value="ALL">All Factories / Units</option>
              ${units.map(u => `<option value="${u.id}" ${filterState.unitId === u.id ? 'selected' : ''}>${u.name}</option>`).join('')}
            </select>
          </div>

          <!-- Floor Filter -->
          <div style="flex: 1; min-width: 130px;">
            <select id="mp-filter-floor" class="filter-select" style="font-size: 12px; height: 34px;">
              <option value="ALL">All Floors</option>
              ${floors.map(f => `<option value="${f.id}" ${filterState.floorId === f.id ? 'selected' : ''}>${f.name}</option>`).join('')}
            </select>
          </div>

          <!-- Reset Button -->
          <button id="btn-mp-reset-filters" class="btn btn-ghost btn-sm" style="font-weight: 700; color: #f87171; font-size: 11.5px; height: 34px;" title="Reset all filters">
            ↺ Reset
          </button>
        </div>
      </div>

      <!-- Bulk Actions Bar (Shown when 1 or more employees are selected) -->
      ${selectedCount > 0 ? `
        <div class="manpower-bulk-bar" style="flex-shrink: 0;">
          <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
            <span class="badge" style="background: #0284c7; color: #fff; font-size: 12px; font-weight: 800; padding: 4px 10px; border-radius: 6px; box-shadow: 0 0 10px rgba(2, 132, 199, 0.4);">
              ✓ ${selectedCount} employee(s) selected
            </span>
            <span style="font-size: 12px; color: var(--text-secondary); display: inline-block;">
              Bulk actions for selected records:
            </span>
          </div>

          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <!-- Bulk Activate / Deactivate -->
            ${isInactiveView ? `
              <button id="btn-mp-bulk-toggle" class="btn btn-success btn-xs" style="font-weight: 700; padding: 5px 12px; font-size: 11.5px;">
                ▶️ Activate Selected (${selectedCount})
              </button>
            ` : `
              <button id="btn-mp-bulk-toggle" class="btn btn-secondary btn-xs" style="font-weight: 700; color: #fbbf24; border-color: rgba(251, 191, 36, 0.4); padding: 5px 12px; font-size: 11.5px;">
                ⏸️ Deactivate Selected (${selectedCount})
              </button>
            `}

            <!-- Bulk Delete -->
            <button id="btn-mp-bulk-delete" class="btn btn-ghost btn-xs" style="font-weight: 700; color: #f87171; border: 1px solid rgba(248, 113, 113, 0.4); background: rgba(239, 68, 68, 0.12); padding: 5px 12px; font-size: 11.5px;">
              🗑️ Delete Selected (${selectedCount})
            </button>

            <!-- Bulk Export -->
            <button id="btn-mp-bulk-export" class="btn btn-secondary btn-xs" style="font-weight: 700; padding: 5px 12px; font-size: 11.5px;">
              📤 Export Selected (.xlsx)
            </button>

            <!-- Deselect All -->
            <button id="btn-mp-clear-selection" class="btn btn-ghost btn-xs" style="color: var(--text-muted); font-size: 11.5px; padding: 4px 8px;">
              ✕ Deselect
            </button>
          </div>
        </div>
      ` : ''}

      <!-- Employee Table Card (Fills Remaining Viewport Space) -->
      <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); flex: 1 1 0; min-height: 0; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);">
        
        <!-- Table Header Bar -->
        <div style="padding: 10px 16px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; flex-shrink: 0; background: rgba(15, 23, 42, 0.5);">
          <div>
            <h3 style="margin: 0; font-size: 14.5px; font-weight: 800; color: #fff;">${title}</h3>
            <p style="margin: 2px 0 0 0; font-size: 11.5px; color: var(--text-muted);">${subtitle}</p>
          </div>
          <div style="display: flex; align-items: center; gap: 10px;">
            ${selectedCount > 0 ? `
              <span style="font-size: 12px; font-weight: 700; color: #38bdf8;">
                ${selectedCount} of ${employees.length} selected
              </span>
            ` : `
              <span style="font-size: 12px; color: #38bdf8; font-weight: 700;">
                ${employees.length} record(s) listed
              </span>
            `}
          </div>
        </div>

        <!-- Table Scroll Container (Sticky Headers & Immediate Bottom Horizontal Scrollbar) -->
        <div class="manpower-table-scroll-container">
          <table class="excel-grid-table manpower-grid-table" style="margin: 0; width: 100%;">
            <thead>
              <tr>
                <th style="width: 44px; text-align: center; vertical-align: middle;">
                  <input 
                    type="checkbox" 
                    id="mp-select-all" 
                    ${allSelected ? 'checked' : ''} 
                    ${someSelected ? 'data-indeterminate="true"' : ''}
                    title="Select all listed employees" 
                    style="cursor: pointer; width: 15px; height: 15px; accent-color: #0284c7; vertical-align: middle;" 
                  />
                </th>
                <th style="width: 45px; text-align: center;">SL</th>
                <th style="width: 125px;">Card #</th>
                <th style="min-width: 175px;">Employee Name</th>
                <th style="min-width: 155px;">Department</th>
                <th style="min-width: 160px;">Designation</th>
                <th style="min-width: 170px;">Floor / Unit</th>
                <th style="text-align: center; width: 110px;">Joining Date</th>
                <th style="text-align: center; width: 105px;">Status</th>
                <th style="text-align: center; width: 160px;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${employees.length === 0 ? `
                <tr>
                  <td colspan="10" style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
                    <div style="font-size: 32px; margin-bottom: 8px;">🔍</div>
                    <div style="font-size: 15px; font-weight: 700; color: #fff;">No employees found</div>
                    <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">
                      ${isInactiveView ? 'Zero inactive employees. All registered personnel are currently Active!' : 'No active employees matched your search query or filters.'}
                    </div>
                  </td>
                </tr>
              ` : employees.map((emp, idx) => {
                const isActive = emp.status === 'ACTIVE';
                const isSelected = selectedEmployeeIds.has(emp.id);
                const floorName = flrMap.get(emp.floorId) || emp.floorName || '';
                const unitName = untMap.get(emp.unitId) || emp.unitName || '';
                const lineName = linMap.get(emp.lineId) || emp.lineName || '';
                const locationStr = unitName || floorName ? `${unitName}${floorName ? ' • ' + floorName : ''}${lineName ? ' (' + lineName + ')' : ''}` : (emp.workingArea || '—');

                const statusBadge = isActive ? 'badge-active' : (emp.status === 'ON_LEAVE' ? 'badge-maint' : 'badge-breakdown');

                return `
                  <tr class="${isSelected ? 'manpower-row-selected' : ''}" style="background: ${isSelected ? 'rgba(2, 132, 199, 0.16) !important;' : (!isActive ? 'rgba(239, 68, 68, 0.03)' : 'transparent')}; cursor: pointer;" data-row-emp-id="${emp.id}">
                    <!-- Checkbox -->
                    <td style="text-align: center; vertical-align: middle;" onclick="event.stopPropagation();">
                      <input 
                        type="checkbox" 
                        class="mp-row-checkbox" 
                        data-emp-id="${emp.id}" 
                        ${isSelected ? 'checked' : ''} 
                        style="cursor: pointer; width: 15px; height: 15px; accent-color: #0284c7; vertical-align: middle;" 
                      />
                    </td>

                    <!-- SL -->
                    <td style="text-align: center; color: var(--text-muted); font-family: var(--font-mono); font-size: 12px; vertical-align: middle;">
                      ${idx + 1}
                    </td>
                    
                    <!-- Card # / ID: distinct pill/badge for instant eye recognition -->
                    <td style="vertical-align: middle;">
                      <span style="display: inline-block; font-family: var(--font-mono); font-weight: 800; color: #38bdf8; background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.28); padding: 3px 8px; border-radius: 4px; font-size: 12px; letter-spacing: 0.4px;">
                        #${emp.cardNumber || emp.id}
                      </span>
                    </td>

                    <!-- Name: bold white with phone underneath -->
                    <td style="vertical-align: middle;">
                      <div style="font-weight: 700; color: ${isActive ? '#fff' : 'var(--text-muted)'}; font-size: 13.5px; line-height: 1.3;">
                        ${emp.name}
                      </div>
                      ${emp.phone ? `<div style="font-size: 11px; color: var(--text-muted); font-family: var(--font-mono); margin-top: 2px;">📞 ${emp.phone}</div>` : ''}
                    </td>

                    <!-- Department: clear pill badge -->
                    <td style="vertical-align: middle;">
                      <span style="display: inline-flex; align-items: center; gap: 4px; background: rgba(255, 255, 255, 0.06); color: #e2e8f0; border: 1px solid rgba(255, 255, 255, 0.1); padding: 3px 8px; border-radius: 4px; font-size: 11.5px; font-weight: 600;">
                        🏢 ${emp.department || 'General'}
                      </span>
                    </td>

                    <!-- Designation: distinct crisp font -->
                    <td style="vertical-align: middle; font-size: 12.5px; color: #cbd5e1; font-weight: 600;">
                      ${emp.designation || 'Technician'}
                    </td>

                    <!-- Floor / Unit -->
                    <td style="vertical-align: middle; font-size: 12px; color: #e2e8f0;">
                      <span style="color: var(--text-muted); margin-right: 3px;">📍</span>${locationStr}
                    </td>

                    <!-- Joining Date -->
                    <td style="text-align: center; vertical-align: middle; font-family: var(--font-mono); font-size: 12px; color: var(--text-secondary);">
                      ${emp.joinDate || '—'}
                    </td>

                    <!-- Status -->
                    <td style="text-align: center; vertical-align: middle;">
                      <span class="badge ${statusBadge}" style="font-size: 10.5px; font-weight: 700; padding: 3px 8px;">
                        ${emp.status}
                      </span>
                    </td>

                    <!-- Actions -->
                    <td style="text-align: center; vertical-align: middle;" onclick="event.stopPropagation();">
                      <div style="display: flex; gap: 5px; justify-content: center; align-items: center;">
                        
                        <!-- View / ID Badge -->
                        <button class="btn btn-ghost btn-xs btn-emp-card" data-emp-id="${emp.id}" title="View Details &amp; Digital ID Card" style="padding: 4px 7px; font-size: 13px;">
                          👁️
                        </button>

                        <!-- Edit -->
                        <button class="btn btn-secondary btn-xs btn-emp-edit" data-emp-id="${emp.id}" title="Edit Employee Profile" style="padding: 4px 7px; font-size: 13px;">
                          ✏️
                        </button>

                        <!-- Transfer -->
                        <button class="btn btn-secondary btn-xs btn-emp-transfer" data-emp-id="${emp.id}" title="Transfer / Relocate Employee" style="padding: 4px 7px; font-size: 13px;">
                          🔄
                        </button>

                        <!-- Activate / Deactivate Toggle -->
                        ${isInactiveView ? `
                          <button class="btn btn-success btn-xs btn-emp-quick-toggle" data-emp-id="${emp.id}" data-target-status="ACTIVE" title="Reactivate to Active" style="padding: 4px 8px; font-size: 11px; font-weight: 700;">
                            ▶️ Activate
                          </button>
                        ` : `
                          <button class="btn btn-ghost btn-xs btn-emp-quick-toggle" data-emp-id="${emp.id}" data-target-status="INACTIVE" title="Deactivate / Move to Inactive" style="color: #fbbf24; padding: 4px 8px; font-size: 11px; font-weight: 700; border: 1px solid rgba(251,191,36,0.3);">
                            ⏸️ Deactivate
                          </button>
                        `}

                        <!-- Delete Record with Confirmation -->
                        <button class="btn btn-ghost btn-xs btn-emp-delete" data-emp-id="${emp.id}" title="Delete Record" style="color: #f87171; padding: 4px 7px; font-size: 13px;">
                          🗑️
                        </button>

                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>

        <!-- Table Footer -->
        <div style="padding: 9px 16px; font-size: 11.5px; color: var(--text-muted); display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-color); flex-shrink: 0; background: rgba(15, 23, 42, 0.4);">
          <span>Showing <strong>${employees.length}</strong> workforce records${selectedCount > 0 ? ` (${selectedCount} selected)` : ''}</span>
          <span>⚡ Select rows to perform bulk actions: Delete, Deactivate/Activate, or Export</span>
        </div>

      </div>

    </div>
  `;
}

// ---------------------------------------------------------------------------
// 2. EMPLOYEE TRANSFERS TAB
// ---------------------------------------------------------------------------
function renderEmployeeTransfersTab(transfers) {
  return `
    <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); flex: 1 1 0; min-height: 0; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);">
      <div style="padding: 12px 18px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; background: rgba(15, 23, 42, 0.5);">
        <div>
          <h3 style="margin: 0; font-size: 15px; font-weight: 800; color: #fff;">🔄 Employee Movement &amp; Relocation Ledger</h3>
          <p style="margin: 2px 0 0 0; font-size: 12px; color: var(--text-muted);">Historical records of inter-floor, unit, and department relocations</p>
        </div>
        <span style="font-size: 12px; color: #38bdf8; font-weight: 700;">
          ${transfers.length} record(s) listed
        </span>
      </div>

      <div class="manpower-table-scroll-container">
        <table class="excel-grid-table manpower-grid-table" style="margin: 0; width: 100%;">
          <thead>
            <tr>
              <th style="width: 45px; text-align: center;">SL</th>
              <th style="width: 120px;">Transfer Date</th>
              <th style="min-width: 175px;">Employee</th>
              <th style="min-width: 180px;">Source Location</th>
              <th style="min-width: 180px;">Destination Location</th>
              <th style="min-width: 160px;">Transfer Reason</th>
              <th style="width: 130px;">Authorized By</th>
            </tr>
          </thead>
          <tbody>
            ${transfers.length === 0 ? `
              <tr>
                <td colspan="7" style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
                  <div style="font-size: 28px; margin-bottom: 6px;">🔄</div>
                  <div style="font-size: 14px; font-weight: 700; color: #fff;">No employee transfers recorded yet</div>
                  <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">Transfers initiated from workforce cards will appear here.</div>
                </td>
              </tr>
            ` : transfers.map((tr, idx) => `
              <tr>
                <td style="text-align: center; color: var(--text-muted); font-family: var(--font-mono); font-size: 12px;">${idx + 1}</td>
                <td style="font-family: var(--font-mono); font-size: 12px; color: #38bdf8;">${tr.transferDate || '—'}</td>
                <td>
                  <div style="font-weight: 700; color: #fff;">${tr.employeeName}</div>
                  <div style="font-family: var(--font-mono); color: var(--text-muted); font-size: 11px;">#${tr.cardNumber || ''}</div>
                </td>
                <td style="font-size: 12px; color: #f87171;">
                  ${tr.fromLocation?.locationPath || '—'} <span style="color: var(--text-muted);">(${tr.fromLocation?.department || '—'})</span>
                </td>
                <td style="font-size: 12px; color: #34d399; font-weight: 600;">
                  &rarr; ${tr.toLocation?.locationPath || '—'} <span style="color: var(--text-muted);">(${tr.toLocation?.department || '—'})</span>
                </td>
                <td style="font-size: 12px; color: #fff;">${tr.reason || '—'}</td>
                <td style="font-size: 11.5px; color: var(--text-muted);">${tr.transferredBy || 'Admin'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div style="padding: 9px 16px; font-size: 11.5px; color: var(--text-muted); border-top: 1px solid var(--border-color); flex-shrink: 0; background: rgba(15, 23, 42, 0.4);">
        <span>Total <strong>${transfers.length}</strong> transfers recorded</span>
      </div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// 3. LEAVE MANAGEMENT TAB
// ---------------------------------------------------------------------------
function renderEmployeeLeavesTab(leaves) {
  return `
    <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); flex: 1 1 0; min-height: 0; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);">
      <div style="padding: 12px 18px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; background: rgba(15, 23, 42, 0.5);">
        <div>
          <h3 style="margin: 0; font-size: 15px; font-weight: 800; color: #fff;">🏖️ Employee Leave Records &amp; Attendance</h3>
          <p style="margin: 2px 0 0 0; font-size: 12px; color: var(--text-muted);">Active leaves automatically synchronize employee status</p>
        </div>
        <span style="font-size: 12px; color: #38bdf8; font-weight: 700;">
          ${leaves.length} record(s) listed
        </span>
      </div>

      <div class="manpower-table-scroll-container">
        <table class="excel-grid-table manpower-grid-table" style="margin: 0; width: 100%;">
          <thead>
            <tr>
              <th style="width: 45px; text-align: center;">SL</th>
              <th style="min-width: 175px;">Employee</th>
              <th style="width: 135px;">Leave Type</th>
              <th style="width: 115px; text-align: center;">Start Date</th>
              <th style="width: 115px; text-align: center;">End Date</th>
              <th style="text-align: center; width: 75px;">Days</th>
              <th style="min-width: 160px;">Reason</th>
              <th style="text-align: center; width: 105px;">Status</th>
              <th style="text-align: center; width: 100px;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${leaves.length === 0 ? `
              <tr>
                <td colspan="9" style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
                  <div style="font-size: 28px; margin-bottom: 6px;">🏖️</div>
                  <div style="font-size: 14px; font-weight: 700; color: #fff;">No employee leave records found</div>
                  <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">Leaves registered via workforce actions will be tracked here.</div>
                </td>
              </tr>
            ` : leaves.map((lv, idx) => `
              <tr>
                <td style="text-align: center; color: var(--text-muted); font-family: var(--font-mono); font-size: 12px;">${idx + 1}</td>
                <td>
                  <div style="font-weight: 700; color: #fff;">${lv.employeeName}</div>
                  <div style="font-family: var(--font-mono); color: var(--text-muted); font-size: 11px;">#${lv.cardNumber || ''}</div>
                </td>
                <td style="font-size: 12px; color: #38bdf8; font-weight: 600;">${lv.leaveType}</td>
                <td style="font-family: var(--font-mono); font-size: 12px; text-align: center;">${lv.startDate}</td>
                <td style="font-family: var(--font-mono); font-size: 12px; text-align: center;">${lv.endDate}</td>
                <td style="text-align: center; font-weight: 700; color: #fbbf24; font-size: 12.5px;">${lv.totalDays}d</td>
                <td style="font-size: 12px; color: var(--text-secondary);">${lv.reason || '—'}</td>
                <td style="text-align: center;">
                  <span class="badge badge-active" style="font-size: 10px;">APPROVED</span>
                </td>
                <td style="text-align: center;">
                  <button class="btn btn-ghost btn-xs btn-delete-leave" data-leave-id="${lv.id}" title="Cancel Leave" style="color: #f87171;">
                    ✕ Cancel
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div style="padding: 9px 16px; font-size: 11.5px; color: var(--text-muted); border-top: 1px solid var(--border-color); flex-shrink: 0; background: rgba(15, 23, 42, 0.4);">
        <span>Total <strong>${leaves.length}</strong> leave records</span>
      </div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// 4. CUSTOM FIELDS TAB
// ---------------------------------------------------------------------------
function renderCustomFieldsTab(customFields) {
  return `
    <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 20px; flex: 1 1 0; min-height: 0; overflow-y: auto;">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 14px; margin-bottom: 16px;">
        <div>
          <h3 style="margin: 0; font-size: 16px; font-weight: 800; color: #fff;">⚙️ Manpower Custom Parameters Configuration</h3>
          <p style="margin: 2px 0 0 0; font-size: 12px; color: var(--text-muted);">Dynamic fields for NID, blood group, skill grades, and enterprise HR tracking</p>
        </div>
        <button id="btn-add-custom-field" class="btn btn-primary btn-sm" style="font-weight: 700;">
          ➕ Add Custom Field
        </button>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px;">
        ${customFields.map(cf => `
          <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div>
                <div style="font-weight: 800; font-size: 13.5px; color: #fff;">${cf.label}</div>
                <div style="font-family: var(--font-mono); font-size: 11px; color: #38bdf8; margin-top: 2px;">CODE: ${cf.code}</div>
              </div>
              <span class="badge ${cf.status === 'ACTIVE' ? 'badge-active' : 'badge-idle'}" style="font-size: 10px;">${cf.status}</span>
            </div>

            <div style="font-size: 11.5px; color: var(--text-secondary); margin-top: 10px;">
              <div><strong>Type:</strong> ${cf.type}</div>
              <div><strong>Required:</strong> ${cf.required ? 'Yes' : 'No'}</div>
            </div>

            <div style="display: flex; gap: 6px; justify-content: flex-end; margin-top: 12px; border-top: 1px solid var(--border-color); padding-top: 8px;">
              <button class="btn btn-ghost btn-xs btn-cf-edit" data-cf-id="${cf.id}">✏️ Edit</button>
              <button class="btn btn-ghost btn-xs btn-cf-toggle" data-cf-id="${cf.id}" style="color: #fbbf24;">
                ${cf.status === 'ACTIVE' ? '⏸️ Disable' : '▶️ Enable'}
              </button>
              <button class="btn btn-ghost btn-xs btn-cf-delete" data-cf-id="${cf.id}" style="color: #f87171;">🗑️ Delete</button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderCustomFieldDesignerModal() {
  if (!activeCustomFieldModal) return '';
  const isEdit = activeCustomFieldModal.type === 'EDIT';
  const cf = isEdit ? activeCustomFieldModal.field : { type: 'TEXT', status: 'ACTIVE', showInFilter: true, showInTable: true };

  return `
    <div class="modal-overlay active" id="modal-cf-designer-overlay">
      <div class="modal-card" style="max-width: 500px;">
        <div class="modal-header" style="border-bottom: 1px solid var(--border-color); padding-bottom: 12px;">
          <h3 style="margin: 0; font-size: 16px; font-weight: 800; color: #fff;">
            ${isEdit ? 'Edit Custom Parameter' : 'Create Custom Parameter'}
          </h3>
          <button class="btn btn-ghost btn-sm" id="btn-close-cf-modal">✕</button>
        </div>

        <form id="form-cf-designer-submit" style="padding-top: 14px; display: flex; flex-direction: column; gap: 12px;">
          <div class="form-group">
            <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Field Label *</label>
            <input type="text" id="inp-cf-label" class="form-control" value="${cf.label || ''}" required placeholder="e.g. National ID / NID" />
          </div>

          <div class="form-group">
            <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Field Type *</label>
            <select id="inp-cf-type" class="filter-select">
              <option value="TEXT" ${cf.type === 'TEXT' ? 'selected' : ''}>Text Input</option>
              <option value="NUMBER" ${cf.type === 'NUMBER' ? 'selected' : ''}>Numeric</option>
              <option value="DATE" ${cf.type === 'DATE' ? 'selected' : ''}>Date Picker</option>
              <option value="DROPDOWN" ${cf.type === 'DROPDOWN' ? 'selected' : ''}>Dropdown Select</option>
              <option value="BOOLEAN" ${cf.type === 'BOOLEAN' ? 'selected' : ''}>Yes / No Toggle</option>
            </select>
          </div>

          <div class="form-group" id="cf-options-group" style="display: ${cf.type === 'DROPDOWN' ? 'block' : 'none'};">
            <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Options (comma-separated)</label>
            <input type="text" id="inp-cf-options" class="form-control" value="${(cf.options || []).join(', ')}" placeholder="e.g. Grade A, Grade B, Grade C" />
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 10px; border-top: 1px solid var(--border-color); padding-top: 14px;">
            <button type="button" id="btn-cancel-cf-modal" class="btn btn-secondary">Cancel</button>
            <button type="submit" class="btn btn-primary" style="font-weight: 700;">💾 Save Parameter</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

export function initManpowerEvents() {
  const refreshView = () => {
    const view = document.getElementById('main-view-container');
    if (view) {
      view.innerHTML = renderManpowerView();
      initManpowerEvents();
    }
  };

  // 1. Tab Switching (Clean Tab Navigation)
  document.querySelectorAll('[data-manpower-tab]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      activeManpowerTab = btn.getAttribute('data-manpower-tab');
      state.set('manpowerActiveTab', activeManpowerTab);
      selectedEmployeeIds.clear();
      refreshView();
    });
  });

  // 1b. Multi-Select & Bulk Action Listeners
  const selectAllEle = document.getElementById('mp-select-all');
  if (selectAllEle) {
    if (selectAllEle.hasAttribute('data-indeterminate')) {
      selectAllEle.indeterminate = true;
    }
    selectAllEle.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      const currentList = activeManpowerTab === 'active'
        ? employeeService.getAllEmployees({ ...filterState, status: 'ACTIVE' })
        : employeeService.getAllEmployees(filterState).filter(x => x.status !== 'ACTIVE');

      if (isChecked) {
        currentList.forEach(emp => selectedEmployeeIds.add(emp.id));
      } else {
        selectedEmployeeIds.clear();
      }
      refreshView();
    });
  }

  document.querySelectorAll('.mp-row-checkbox').forEach(cb => {
    cb.addEventListener('change', (e) => {
      e.stopPropagation();
      const empId = cb.getAttribute('data-emp-id');
      if (cb.checked) {
        selectedEmployeeIds.add(empId);
      } else {
        selectedEmployeeIds.delete(empId);
      }
      refreshView();
    });
  });

  document.querySelectorAll('tr[data-row-emp-id]').forEach(tr => {
    tr.addEventListener('click', (e) => {
      if (e.target.closest('button') || e.target.closest('input') || e.target.closest('a')) return;
      const empId = tr.getAttribute('data-row-emp-id');
      if (selectedEmployeeIds.has(empId)) {
        selectedEmployeeIds.delete(empId);
      } else {
        selectedEmployeeIds.add(empId);
      }
      refreshView();
    });
  });

  const btnBulkDelete = document.getElementById('btn-mp-bulk-delete');
  if (btnBulkDelete) {
    btnBulkDelete.addEventListener('click', async (e) => {
      e.stopPropagation();
      const count = selectedEmployeeIds.size;
      if (count === 0) return;

      const confirmed = await notificationService.confirm({
        title: 'Delete Selected Employees',
        message: `Are you sure you want to delete the selected employee(s)?<br><br><span style="color: #f87171; font-weight: bold;">This will permanently remove ${count} employee record(s). This action cannot be undone.</span>`,
        icon: '🗑️',
        confirmText: `Delete ${count} Employee(s)`,
        isDestructive: true
      });

      if (confirmed) {
        notificationService.withLoading(btnBulkDelete, async () => {
          for (const id of Array.from(selectedEmployeeIds)) {
            try {
              await employeeService.deleteEmployee(id);
            } catch (err) {
              console.error('Failed to delete employee ' + id, err);
            }
          }
          selectedEmployeeIds.clear();
          refreshView();
        }, 'Deleting Employees...', `Successfully deleted ${count} employee(s).`);
      }
    });
  }

  const btnBulkToggle = document.getElementById('btn-mp-bulk-toggle');
  if (btnBulkToggle) {
    btnBulkToggle.addEventListener('click', async (e) => {
      e.stopPropagation();
      const count = selectedEmployeeIds.size;
      if (count === 0) return;
      const isActivating = activeManpowerTab === 'inactive';
      const targetStatus = isActivating ? 'ACTIVE' : 'INACTIVE';
      const actionLabel = isActivating ? 'activate' : 'deactivate';

      const confirmed = await notificationService.confirm({
        title: `${isActivating ? 'Activate' : 'Deactivate'} Selected Employees`,
        message: `Are you sure you want to ${actionLabel} ${count} selected employee(s)?`,
        icon: isActivating ? '▶️' : '⏸️',
        confirmText: `${isActivating ? 'Activate' : 'Deactivate'} ${count} Employee(s)`
      });

      if (confirmed) {
        notificationService.withLoading(btnBulkToggle, async () => {
          for (const id of Array.from(selectedEmployeeIds)) {
            try {
              await employeeService.updateEmployee(id, { status: targetStatus });
            } catch (err) {
              console.error('Failed to update employee status ' + id, err);
            }
          }
          selectedEmployeeIds.clear();
          refreshView();
        }, 'Updating Status...', `Successfully updated ${count} employee(s) to ${targetStatus}.`);
      }
    });
  }

  const btnBulkExport = document.getElementById('btn-mp-bulk-export');
  if (btnBulkExport) {
    btnBulkExport.addEventListener('click', async (e) => {
      e.stopPropagation();
      const selectedList = Array.from(selectedEmployeeIds)
        .map(id => employeeService.getEmployeeById(id))
        .filter(Boolean);
      if (selectedList.length === 0) return;

      notificationService.withLoading(btnBulkExport, async () => {
        const exportData = formatEmployeesForExport(selectedList);
        await excelService.exportToExcel(
          exportData,
          `AlMuslim_Manpower_Selected_${selectedList.length}_${new Date().toISOString().split('T')[0]}.xlsx`
        );
      }, 'Exporting Selected...', `${selectedList.length} employee(s) exported to Excel!`);
    });
  }

  const btnClearSelection = document.getElementById('btn-mp-clear-selection');
  if (btnClearSelection) {
    btnClearSelection.addEventListener('click', (e) => {
      e.stopPropagation();
      selectedEmployeeIds.clear();
      refreshView();
    });
  }

  // 2. Top Action Buttons
  const btnAdd = document.getElementById('btn-manpower-add-emp');
  if (btnAdd) {
    btnAdd.addEventListener('click', (e) => {
      e.stopPropagation();
      state.set('activeEmployeeModal', { type: 'ADD' });
      refreshView();
    });
  }

  const btnImport = document.getElementById('btn-manpower-import-excel');
  if (btnImport) {
    btnImport.addEventListener('click', (e) => {
      e.stopPropagation();
      state.set('activeEmployeeModal', { type: 'IMPORT' });
      refreshView();
    });
  }

  const btnExport = document.getElementById('btn-manpower-export-excel');
  if (btnExport) {
    btnExport.addEventListener('click', (e) => {
      e.stopPropagation();
      notificationService.withLoading(btnExport, async () => {
        const data = employeeService.exportManpowerData(filterState);
        await excelService.exportToExcel(data, `AlMuslim_Manpower_Roster_${new Date().toISOString().split('T')[0]}.xlsx`);
      }, 'Exporting Workforce...', 'Manpower roster exported to Excel successfully!');
    });
  }

  // 3. Quick Status Toggle (Active <-> Inactive)
  document.querySelectorAll('.btn-emp-quick-toggle').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const empId = btn.getAttribute('data-emp-id');
      const targetStatus = btn.getAttribute('data-target-status');
      try {
        await employeeService.updateEmployee(empId, { status: targetStatus });
        notificationService.success(`Employee status updated to ${targetStatus}`);
        refreshView();
      } catch (err) {
        notificationService.error('Failed to update status: ' + err.message);
      }
    });
  });

  // 4. Row Action Handlers
  document.querySelectorAll('.btn-emp-card').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const empId = btn.getAttribute('data-emp-id');
      state.set('activeEmployeeModal', { type: 'ID_CARD', employeeId: empId });
      refreshView();
    });
  });

  document.querySelectorAll('.btn-emp-transfer').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const empId = btn.getAttribute('data-emp-id');
      state.set('activeEmployeeModal', { type: 'TRANSFER', employeeId: empId });
      refreshView();
    });
  });

  document.querySelectorAll('.btn-emp-edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const empId = btn.getAttribute('data-emp-id');
      state.set('activeEmployeeModal', { type: 'EDIT', employeeId: empId });
      refreshView();
    });
  });

  document.querySelectorAll('.btn-emp-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const empId = btn.getAttribute('data-emp-id');
      const emp = employeeService.getEmployeeById(empId);
      if (!emp) return;

      const confirmed = await notificationService.confirm({
        title: 'Delete Employee Record',
        message: `Are you sure you want to delete <strong>${emp.name}</strong> [#${emp.cardNumber || emp.id}]? This action cannot be undone.`,
        icon: '🗑️',
        confirmText: 'Delete Employee',
        isDestructive: true
      });

      if (confirmed) {
        await employeeService.deleteEmployee(empId);
        selectedEmployeeIds.delete(empId);
        notificationService.success(`Deleted record for ${emp.name}`);
        refreshView();
      }
    });
  });

  // 5. Delete Leave
  document.querySelectorAll('.btn-delete-leave').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-leave-id');
      const confirmed = await notificationService.confirm({
        title: 'Cancel Leave Record',
        message: 'Are you sure you want to cancel this leave record?',
        icon: '🏖️',
        confirmText: 'Cancel Leave',
        isDestructive: true
      });

      if (confirmed) {
        await employeeService.deleteLeave(id);
        notificationService.success('Leave record cancelled');
        refreshView();
      }
    });
  });

  // 6. Search & Filter Listeners (Instant Search on Input with Focus Preservation)
  const inpSearch = document.getElementById('mp-filter-search');
  if (inpSearch) {
    inpSearch.addEventListener('input', (e) => {
      filterState.search = e.target.value;
      const start = e.target.selectionStart;
      const end = e.target.selectionEnd;
      refreshView();
      const newInp = document.getElementById('mp-filter-search');
      if (newInp) {
        newInp.focus();
        try {
          newInp.setSelectionRange(start, end);
        } catch (_) {}
      }
    });
  }

  const selDept = document.getElementById('mp-filter-dept');
  if (selDept) {
    selDept.addEventListener('change', (e) => {
      filterState.department = e.target.value;
      refreshView();
    });
  }

  const selDesig = document.getElementById('mp-filter-desig');
  if (selDesig) {
    selDesig.addEventListener('change', (e) => {
      filterState.designation = e.target.value;
      refreshView();
    });
  }

  const selUnit = document.getElementById('mp-filter-unit');
  if (selUnit) {
    selUnit.addEventListener('change', (e) => {
      filterState.unitId = e.target.value;
      filterState.floorId = 'ALL';
      refreshView();
    });
  }

  const selFloor = document.getElementById('mp-filter-floor');
  if (selFloor) {
    selFloor.addEventListener('change', (e) => {
      filterState.floorId = e.target.value;
      refreshView();
    });
  }

  const btnReset = document.getElementById('btn-mp-reset-filters');
  if (btnReset) {
    btnReset.addEventListener('click', (e) => {
      e.stopPropagation();
      filterState = {
        search: '',
        department: 'ALL',
        designation: 'ALL',
        unitId: 'ALL',
        floorId: 'ALL'
      };
      refreshView();
    });
  }

  // 7. Custom Field Handlers
  const btnAddCf = document.getElementById('btn-add-custom-field');
  if (btnAddCf) {
    btnAddCf.addEventListener('click', (e) => {
      e.stopPropagation();
      activeCustomFieldModal = { type: 'ADD' };
      refreshView();
    });
  }

  document.querySelectorAll('.btn-cf-edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-cf-id');
      const field = employeeCustomFieldService.getAllFields().find(f => f.id === id);
      if (field) {
        activeCustomFieldModal = { type: 'EDIT', field };
        refreshView();
      }
    });
  });

  document.querySelectorAll('.btn-cf-toggle').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-cf-id');
      employeeCustomFieldService.toggleFieldStatus(id);
      notificationService.success('Custom field status updated');
      refreshView();
    });
  });

  document.querySelectorAll('.btn-cf-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-cf-id');
      const field = employeeCustomFieldService.getAllFields().find(f => f.id === id);
      if (!field) return;

      const confirmed = await notificationService.confirm({
        title: 'Delete Custom Parameter',
        message: `Delete custom parameter <strong>${field.label}</strong>?`,
        icon: '⚙️',
        confirmText: 'Delete Field',
        isDestructive: true
      });

      if (confirmed) {
        employeeCustomFieldService.deleteField(id);
        notificationService.success(`Deleted parameter '${field.label}'`);
        refreshView();
      }
    });
  });

  const btnCloseCfModal = document.getElementById('btn-close-cf-modal');
  const btnCancelCfModal = document.getElementById('btn-cancel-cf-modal');
  const closeCfModal = () => {
    activeCustomFieldModal = null;
    refreshView();
  };
  if (btnCloseCfModal) btnCloseCfModal.addEventListener('click', closeCfModal);
  if (btnCancelCfModal) btnCancelCfModal.addEventListener('click', closeCfModal);

  // Type change in CF Modal
  const inpCfType = document.getElementById('inp-cf-type');
  const optsGroup = document.getElementById('cf-options-group');
  if (inpCfType && optsGroup) {
    inpCfType.addEventListener('change', () => {
      optsGroup.style.display = inpCfType.value === 'DROPDOWN' ? 'block' : 'none';
    });
  }

  // Submit CF Form
  const formCf = document.getElementById('form-cf-designer-submit');
  if (formCf) {
    formCf.addEventListener('submit', (e) => {
      e.preventDefault();
      const label = document.getElementById('inp-cf-label')?.value?.trim();
      const type = document.getElementById('inp-cf-type')?.value;
      const rawOpts = document.getElementById('inp-cf-options')?.value || '';
      const options = rawOpts.split(',').map(s => s.trim()).filter(Boolean);

      if (!label) return;

      if (activeCustomFieldModal.type === 'EDIT') {
        employeeCustomFieldService.updateField(activeCustomFieldModal.field.id, { label, type, options });
        notificationService.success(`Updated parameter '${label}'`);
      } else {
        employeeCustomFieldService.createField({ label, type, options });
        notificationService.success(`Created parameter '${label}'`);
      }

      activeCustomFieldModal = null;
      refreshView();
    });
  }

  // 8. Bind Employee Modal Events (Add, Edit, Transfer, Leave, ID Card, Import)
  initEmployeeModalEvents(() => {
    state.set('activeEmployeeModal', null);
    refreshView();
  });
}
