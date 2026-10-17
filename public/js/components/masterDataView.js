/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Enterprise Master Data Configuration & 7-Level Cascading Hierarchy Manager
 * 1. Groups -> 2. Units/Factories -> 3. Floors -> 4. Lines -> 5. Machine Names -> 6. Brands -> 7. Models
 */

import { storage } from '../db/storage.js';
import { TABLE_NAMES } from '../db/schema.js';
import { masterDataService, KNOWN_NAMED_SECTIONS, formatLineName } from '../services/masterDataService.js';
import { qrCodeService } from '../services/qrCodeService.js';
import { authService } from '../services/authService.js';
import { notificationService } from '../services/notificationService.js';
import { state } from '../state.js';

let activeTab = 'fast-entry'; // 'fast-entry', 'tree', 'groups', 'units', 'floors', 'lines', 'machinenames', 'brands', 'models'
let cascadeGroupId = '';
let cascadeUnitId = '';
let cascadeFloorId = '';
let cascadeLineId = '';
let searchFilter = '';
let parentFilter = '';
let statusFilter = 'ALL'; // 'ALL', 'ACTIVE', 'INACTIVE'
let selectedItemIds = new Set();
let selectedStep3LineIds = new Set();
let step3LineTargetScope = 'INDIVIDUAL'; // 'INDIVIDUAL' or 'ALL_FLOORS'
let activeModalState = null; // { type: 'ADD'|'EDIT'|'VIEW'|'DELETE_DEP', entityType: 'group'|'unit'|..., item: {...}, dependencies: {...} }

export function renderMasterDataView() {
  const requestedTab = state.get('masterDataActiveTab');
  if (requestedTab) {
    activeTab = requestedTab;
    state.set('masterDataActiveTab', null);
  }

  const isAdmin = authService.isAdmin();

  const groups = masterDataService.getGroups(true);
  const units = masterDataService.getUnits(null, true);
  const floors = masterDataService.getFloors(null, null, true);
  const lines = masterDataService.getLines(null, null, null, true);
  const machineNames = masterDataService.getMachineNames(null, null, true);
  const brands = masterDataService.getBrands(true);
  const models = masterDataService.getModels(null, null, true);

  return `
    <div class="page-view" style="padding: 8px 14px; display: flex; flex-direction: column; gap: 8px; box-sizing: border-box;">
      
      <!-- Unified Compact Top Header: Title, Main Views, Tables & Action -->
      <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 8px 14px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; flex-shrink: 0;">
        
        <!-- Left: Title & Main Workflow Tabs -->
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <div style="font-size: 16px; background: rgba(56, 189, 248, 0.12); border: 1px solid #38bdf8; border-radius: var(--radius-sm); width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
              🏢
            </div>
            <h1 style="font-size: 14.5px; font-weight: 800; color: #fff; margin: 0; white-space: nowrap;">
              Plant Hierarchy &amp; Master Data
            </h1>
          </div>

          <!-- Primary View Mode Tabs -->
          <div style="display: flex; gap: 4px; align-items: center; background: rgba(0,0,0,0.25); padding: 2px 4px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
            <button class="btn ${activeTab === 'fast-entry' ? 'btn-primary' : 'btn-ghost'}" data-master-tab="fast-entry" style="font-weight: 800; font-size: 11.5px; padding: 4px 10px; border-radius: 4px; ${activeTab === 'fast-entry' ? 'background: linear-gradient(135deg, #0284c7, #2563eb); color: #fff;' : 'color: #38bdf8;'}">
              ⚡ 3-Step Guided Setup
            </button>
            <button class="btn ${activeTab === 'tree' ? 'btn-primary' : 'btn-ghost'}" data-master-tab="tree" style="font-weight: 700; font-size: 11.5px; padding: 4px 10px; border-radius: 4px;">
              🌳 Tree View
            </button>
          </div>

          <!-- Compact Tables Segment -->
          <div style="display: flex; gap: 3px; align-items: center; flex-wrap: wrap;">
            <span style="font-size: 10px; font-weight: 800; color: var(--text-muted); text-transform: uppercase; margin-left: 4px;">Tables:</span>
            <button class="btn ${activeTab === 'groups' ? 'btn-primary' : 'btn-ghost'}" data-master-tab="groups" style="font-weight: 700; font-size: 10.5px; padding: 3px 7px; border-radius: 4px;">
              Groups (${groups.length})
            </button>
            <button class="btn ${activeTab === 'units' ? 'btn-primary' : 'btn-ghost'}" data-master-tab="units" style="font-weight: 700; font-size: 10.5px; padding: 3px 7px; border-radius: 4px;">
              Units (${units.length})
            </button>
            <button class="btn ${activeTab === 'floors' ? 'btn-primary' : 'btn-ghost'}" data-master-tab="floors" style="font-weight: 700; font-size: 10.5px; padding: 3px 7px; border-radius: 4px;">
              Floors (${floors.length})
            </button>
            <button class="btn ${activeTab === 'lines' ? 'btn-primary' : 'btn-ghost'}" data-master-tab="lines" style="font-weight: 700; font-size: 10.5px; padding: 3px 7px; border-radius: 4px;">
              Lines (${lines.length})
            </button>
            <button class="btn ${activeTab === 'machinenames' ? 'btn-primary' : 'btn-ghost'}" data-master-tab="machinenames" style="font-weight: 700; font-size: 10.5px; padding: 3px 7px; border-radius: 4px;">
              Machines (${machineNames.length})
            </button>
            <button class="btn ${activeTab === 'brands' ? 'btn-primary' : 'btn-ghost'}" data-master-tab="brands" style="font-weight: 700; font-size: 10.5px; padding: 3px 7px; border-radius: 4px;">
              Brands (${brands.length})
            </button>
            <button class="btn ${activeTab === 'models' ? 'btn-primary' : 'btn-ghost'}" data-master-tab="models" style="font-weight: 700; font-size: 10.5px; padding: 3px 7px; border-radius: 4px;">
              Models (${models.length})
            </button>
          </div>
        </div>

        <!-- Right: Primary Action -->
        <div style="display: flex; gap: 6px; align-items: center;">
          ${isAdmin ? `
            <button id="btn-master-add-new" class="btn btn-primary btn-sm" style="font-weight: 800; background: linear-gradient(135deg, #0284c7, #0369a1); font-size: 11.5px; padding: 5px 12px; box-shadow: 0 2px 8px rgba(2, 132, 199, 0.3);">
              ➕ Add ${getEntityDisplayName(activeTab === 'tree' ? 'groups' : activeTab)}
            </button>
          ` : ''}
        </div>
      </div>

      <!-- Tab Content Area -->
      ${renderTabContent()}

      <!-- Modal Layer (Add / Edit / View / Dependency Dialog) -->
      ${renderMasterModalDOM()}
    </div>
  `;
}

function getEntityDisplayName(tab) {
  switch (tab) {
    case 'fast-entry': return 'Group';
    case 'groups': return 'Group';
    case 'units': return 'Factory / Unit';
    case 'floors': return 'Floor';
    case 'lines': return 'Line';
    case 'machinenames': return 'Machine Name';
    case 'brands': return 'Brand';
    case 'models': return 'Model';
    default: return 'Record';
  }
}

function getEntityType(tab) {
  switch (tab) {
    case 'fast-entry': return 'group';
    case 'groups': return 'group';
    case 'units': return 'unit';
    case 'floors': return 'floor';
    case 'lines': return 'line';
    case 'machinenames': return 'machinename';
    case 'brands': return 'brand';
    case 'models': return 'model';
    default: return 'group';
  }
}

function renderTabContent() {
  if (activeTab === 'fast-entry') {
    return renderFastCascadingEntryView();
  }
  if (activeTab === 'tree') {
    return renderHierarchyTreeView();
  }

  const entityType = getEntityType(activeTab);
  let items = [];
  let parentLabel = '';
  let parentOptions = [];

  switch (activeTab) {
    case 'groups':
      items = masterDataService.getGroups(true);
      break;
    case 'units':
      items = masterDataService.getUnits(null, true);
      parentLabel = 'Parent Group';
      parentOptions = masterDataService.getGroups(true);
      break;
    case 'floors':
      items = masterDataService.getFloors(null, null, true);
      parentLabel = 'Parent Factory/Unit';
      parentOptions = masterDataService.getUnits(null, true);
      break;
    case 'lines':
      items = masterDataService.getLines(null, null, null, true);
      parentLabel = 'Parent Floor';
      parentOptions = masterDataService.getFloors(null, null, true);
      break;
    case 'machinenames':
      items = masterDataService.getMachineNames(null, null, true);
      parentLabel = 'Category';
      parentOptions = masterDataService.getCategories(true);
      break;
    case 'brands':
      items = masterDataService.getBrands(true);
      break;
    case 'models':
      items = masterDataService.getModels(null, null, true);
      parentLabel = 'Machine Name';
      parentOptions = masterDataService.getMachineNames(null, null, true);
      break;
  }

  // Filter Items
  let filtered = items;
  if (searchFilter.trim()) {
    const q = searchFilter.toLowerCase().trim();
    filtered = filtered.filter(it => 
      (it.name && it.name.toLowerCase().includes(q)) ||
      (it.code && it.code.toLowerCase().includes(q)) ||
      (it.location && it.location.toLowerCase().includes(q)) ||
      (it.supervisor && it.supervisor.toLowerCase().includes(q)) ||
      (it.country && it.country.toLowerCase().includes(q)) ||
      (it.description && it.description.toLowerCase().includes(q))
    );
  }

  if (parentFilter) {
    switch (activeTab) {
      case 'units': filtered = filtered.filter(u => u.groupId === parentFilter); break;
      case 'floors': filtered = filtered.filter(f => f.unitId === parentFilter); break;
      case 'lines': filtered = filtered.filter(l => l.floorId === parentFilter); break;
      case 'machinenames': filtered = filtered.filter(m => m.categoryId === parentFilter); break;
      case 'models': filtered = filtered.filter(m => m.machineNameId === parentFilter); break;
    }
  }

  if (statusFilter !== 'ALL') {
    filtered = filtered.filter(it => it.status === statusFilter);
  }

  const activeCount = items.filter(it => it.status === 'ACTIVE').length;
  const inactiveCount = items.filter(it => it.status === 'INACTIVE').length;

  return `
    <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 10px 14px; display: flex; flex-direction: column; gap: 8px;">
      
      <!-- Compact KPI Stats Bar -->
      <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
        <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 4px 10px; display: inline-flex; align-items: center; gap: 6px;">
          <span style="font-size: 11px; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Total ${getEntityDisplayName(activeTab)}s:</span>
          <strong style="font-size: 13px; color: #fff;">${items.length}</strong>
        </div>
        <div style="background: rgba(52, 211, 153, 0.1); border: 1px solid rgba(52, 211, 153, 0.3); border-radius: var(--radius-sm); padding: 4px 10px; display: inline-flex; align-items: center; gap: 6px;">
          <span style="font-size: 11px; color: #34d399; font-weight: 700; text-transform: uppercase;">🟢 Active:</span>
          <strong style="font-size: 13px; color: #34d399;">${activeCount}</strong>
        </div>
        <div style="background: ${inactiveCount > 0 ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-card)'}; border: 1px solid ${inactiveCount > 0 ? 'rgba(239, 68, 68, 0.3)' : 'var(--border-color)'}; border-radius: var(--radius-sm); padding: 4px 10px; display: inline-flex; align-items: center; gap: 6px;">
          <span style="font-size: 11px; color: ${inactiveCount > 0 ? '#f87171' : 'var(--text-muted)'}; font-weight: 700; text-transform: uppercase;">🔴 Inactive:</span>
          <strong style="font-size: 13px; color: ${inactiveCount > 0 ? '#f87171' : 'var(--text-muted)'};">${inactiveCount}</strong>
        </div>
      </div>

      <!-- Search & Filtering Toolbar -->
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; background: var(--bg-card); padding: 12px 16px; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap; flex: 1;">
          <input 
            type="text" 
            id="inp-master-search" 
            class="form-control" 
            placeholder="Search by Name or Code..." 
            value="${searchFilter}" 
            style="width: 240px; font-size: 12.5px;" 
          />

          ${parentOptions.length > 0 ? `
            <select id="sel-master-parent-filter" class="filter-select" style="width: auto; font-size: 12.5px;">
              <option value="">All ${parentLabel}s</option>
              ${parentOptions.map(p => `<option value="${p.id}" ${parentFilter === p.id ? 'selected' : ''}>${p.name}</option>`).join('')}
            </select>
          ` : ''}

          <select id="sel-master-status-filter" class="filter-select" style="width: auto; font-size: 12.5px;">
            <option value="ALL" ${statusFilter === 'ALL' ? 'selected' : ''}>All Statuses</option>
            <option value="ACTIVE" ${statusFilter === 'ACTIVE' ? 'selected' : ''}>Active Only</option>
            <option value="INACTIVE" ${statusFilter === 'INACTIVE' ? 'selected' : ''}>Inactive Only</option>
          </select>

          ${(searchFilter || parentFilter || statusFilter !== 'ALL') ? `
            <button id="btn-master-clear-filters" class="btn btn-ghost btn-sm" style="color: #f87171; font-weight: 600; font-size: 12px;">
              ✕ Reset Filters
            </button>
          ` : ''}
        </div>

        ${selectedItemIds.size > 0 ? `
          <div id="master-bulk-bar" style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; background: rgba(15, 23, 42, 0.9); border: 1.5px solid #0284c7; padding: 8px 14px; border-radius: var(--radius-md); box-shadow: 0 4px 16px rgba(2, 132, 199, 0.25);">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 14px;">☑️</span>
              <span style="font-size: 13px; color: #38bdf8; font-weight: 800;">
                ${selectedItemIds.size} ${getEntityDisplayName(activeTab)}${selectedItemIds.size > 1 ? 's' : ''} Selected
              </span>
            </div>
            <div style="height: 18px; width: 1px; background: var(--border-color); margin: 0 4px;"></div>
            <button id="btn-master-bulk-delete" class="btn btn-danger btn-sm" style="font-weight: 800; background: linear-gradient(135deg, #ef4444, #dc2626); box-shadow: 0 2px 8px rgba(239, 68, 68, 0.4); padding: 5px 14px; font-size: 12.5px; border: none; border-radius: 6px; display: flex; align-items: center; gap: 5px;" title="Permanently delete selected records">
              <span>🗑️</span> Delete Selected (${selectedItemIds.size})
            </button>
            <button id="btn-master-bulk-activate" class="btn btn-success btn-sm" style="font-weight: 700; padding: 5px 10px; font-size: 12px;" title="Set selected to ACTIVE">
              🟢 Activate
            </button>
            <button id="btn-master-bulk-deactivate" class="btn btn-secondary btn-sm" style="font-weight: 700; padding: 5px 10px; font-size: 12px;" title="Set selected to INACTIVE">
              ⏸️ Deactivate
            </button>
            <button id="btn-master-deselect-all" class="btn btn-ghost btn-sm" style="color: var(--text-muted); font-size: 11.5px; padding: 4px 8px; margin-left: auto;" title="Deselect all">
              ✕ Clear
            </button>
          </div>
        ` : `
          <div style="display: flex; align-items: center; gap: 8px;">
            <button id="btn-master-select-all-btn" class="btn btn-ghost btn-sm" style="font-size: 11.5px; color: #38bdf8; border: 1px dashed rgba(56, 189, 248, 0.4); padding: 4px 12px; font-weight: 700;" title="Select all visible records in this table">
              ☑️ Select All Visible (${filtered.length})
            </button>
          </div>
        `}
      </div>

      <!-- Data Table -->
      <div style="overflow-x: auto; border: 1px solid var(--border-color); border-radius: var(--radius-md);">
        <table class="excel-grid-table" style="margin: 0; width: 100%;">
          <thead>
            <tr>
              <th style="width: 44px; text-align: center;">
                <input 
                  type="checkbox" 
                  id="chk-master-select-all" 
                  ${filtered.length > 0 && selectedItemIds.size === filtered.length ? 'checked' : ''} 
                  style="width: 17px; height: 17px; cursor: pointer; accent-color: #0284c7;" 
                  title="Select or deselect all visible records"
                />
              </th>
              <th style="width: 45px; text-align: center;">Sl.</th>
              <th>Name &amp; Code</th>
              ${activeTab !== 'groups' && activeTab !== 'brands' ? `<th>Parent Relationship</th>` : ''}
              ${activeTab === 'brands' ? `<th>Country &amp; Details</th>` : ''}
              <th style="text-align: center;">Subordinates / Machines</th>
              <th style="text-align: center; width: 140px;">Status / Toggle</th>
              <th style="text-align: center; width: 140px;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.length === 0 ? `
              <tr>
                <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 36px 20px;">
                  <div style="font-size: 28px; margin-bottom: 6px;">🔍</div>
                  <div style="font-size: 14px; font-weight: 700; color: #fff;">No ${getEntityDisplayName(activeTab)} records found</div>
                  <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">Try adjusting your search query or status filter.</div>
                </td>
              </tr>
            ` : filtered.map((it, idx) => {
              const isChecked = selectedItemIds.has(it.id);
              const dep = masterDataService.checkDependencies(entityType, it.id);
              const isActive = it.status === 'ACTIVE';

              return `
                <tr style="background: ${isChecked ? 'rgba(2, 132, 199, 0.12)' : (!isActive ? 'rgba(239, 68, 68, 0.03)' : 'transparent')}; transition: background 0.15s ease;">
                  <td style="text-align: center;">
                    <input 
                      type="checkbox" 
                      class="chk-master-row" 
                      data-id="${it.id}" 
                      ${isChecked ? 'checked' : ''} 
                      style="width: 17px; height: 17px; cursor: pointer; accent-color: #0284c7;" 
                    />
                  </td>
                  <td style="text-align: center; color: var(--text-muted); font-family: var(--font-mono); font-size: 12px;">${idx + 1}</td>
                  <td>
                    <div style="font-weight: 700; color: ${isActive ? '#fff' : 'var(--text-muted)'}; font-size: 13.5px;">
                      ${it.name}
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px; margin-top: 3px; flex-wrap: wrap;">
                      <span style="font-family: var(--font-mono); font-size: 11px; color: #38bdf8; font-weight: 700;">
                        CODE: ${it.code || '—'}
                      </span>
                      ${activeTab === 'floors' ? `
                        <span style="background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.4); color: #38bdf8; font-size: 11px; font-weight: 800; padding: 1px 7px; border-radius: 4px;" title="QR Machine Tag Header Text (Admin Customizable)">
                          🏷️ Sticker: <strong style="color: #fff;">${it.locationTag || qrCodeService.getLocationTag(it.unitId, it.id)}</strong>
                        </span>
                      ` : ''}
                      ${it.location ? `<span style="font-size: 11px; color: var(--text-muted);">📍 ${it.location}</span>` : ''}
                      ${it.building ? `<span style="font-size: 11px; color: var(--text-muted);">🏢 ${it.building}</span>` : ''}
                    </div>
                  </td>

                  ${activeTab !== 'groups' && activeTab !== 'brands' ? `
                    <td>
                      ${renderParentBadge(activeTab, it)}
                    </td>
                  ` : ''}

                  ${activeTab === 'brands' ? `
                    <td>
                      <div style="font-size: 12.5px; color: #fff;">${it.country || 'Global'}</div>
                      <div style="font-size: 11px; color: var(--text-secondary);">${it.website || '—'}</div>
                    </td>
                  ` : ''}

                  <td style="text-align: center;">
                    <span style="font-size: 12px; font-weight: 600; color: ${dep.machineCount > 0 ? '#38bdf8' : 'var(--text-muted)'};">
                      ${dep.details.join(' • ') || '0 Dependencies'}
                    </span>
                  </td>

                  <!-- Clearly Visible ON/OFF Toggle Switch & Badge -->
                  <td style="text-align: center;">
                    <button 
                      class="btn-master-toggle" 
                      data-type="${entityType}" 
                      data-id="${it.id}" 
                      title="${isActive ? 'Click to Deactivate record' : 'Click to Activate record'}" 
                      style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 800; cursor: pointer; border: 1.5px solid ${isActive ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}; background: ${isActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)'}; color: ${isActive ? '#34d399' : '#f87171'}; transition: all 0.2s ease;"
                    >
                      <span style="font-size: 12px;">${isActive ? '🟢' : '🔴'}</span>
                      <span>${isActive ? 'ACTIVE' : 'INACTIVE'}</span>
                    </button>
                  </td>

                  <!-- Actions: View, Edit, Delete -->
                  <td style="text-align: center;">
                    <div style="display: flex; gap: 4px; justify-content: center; align-items: center;">
                      <button class="btn btn-ghost btn-sm btn-master-view" data-type="${entityType}" data-id="${it.id}" title="View Details" style="padding: 5px 8px; font-size: 13px;">
                        👁️
                      </button>
                      <button class="btn btn-secondary btn-sm btn-master-edit" data-type="${entityType}" data-id="${it.id}" title="Edit Record" style="padding: 5px 8px; font-size: 13px;">
                        ✏️
                      </button>
                      <button class="btn btn-ghost btn-sm btn-master-delete" data-type="${entityType}" data-id="${it.id}" title="Delete Record" style="color: #f87171; padding: 5px 8px; font-size: 13px;">
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
    </div>
  `;
}

function renderParentBadge(tab, item) {
  switch (tab) {
    case 'units': {
      const grp = masterDataService.getGroupById(item.groupId);
      return `<span style="font-weight: 600; color: #fbbf24; font-size: 12.5px;">🏢 ${grp?.name || '—'}</span>`;
    }
    case 'floors': {
      const unt = masterDataService.getUnitById(item.unitId);
      return `<span style="font-weight: 600; color: #34d399; font-size: 12.5px;">🏭 ${unt?.name || '—'}</span>`;
    }
    case 'lines': {
      const flr = masterDataService.getFloorById(item.floorId);
      return `<span style="font-weight: 600; color: #38bdf8; font-size: 12.5px;">🏗️ ${flr?.name || '—'}</span>`;
    }
    case 'machinenames': {
      const cat = storage.getItem(TABLE_NAMES.CATEGORIES, item.categoryId);
      return `<span style="font-weight: 600; color: #c084fc; font-size: 12.5px;">📁 ${cat?.name || 'Sewing Machines'}</span>`;
    }
    case 'models': {
      const mn = masterDataService.getMachineNameById(item.machineNameId);
      const brd = masterDataService.getBrandById(item.brandId);
      return `
        <div style="font-size: 12px;">
          <div><strong style="color: #38bdf8;">Machine:</strong> ${mn?.name || '—'}</div>
          <div><strong style="color: #fbbf24;">Brand:</strong> ${brd?.name || '—'}</div>
        </div>
      `;
    }
    default: return '—';
  }
}

function renderFastCascadingEntryView() {
  const isAdmin = authService.isAdmin();
  const groups = masterDataService.getGroups(true);
  if (!cascadeGroupId || !groups.some(g => g.id === cascadeGroupId)) {
    cascadeGroupId = groups[0]?.id || '';
  }

  const unitsOfGroup = cascadeGroupId ? masterDataService.getUnits(cascadeGroupId, true) : [];
  if (!cascadeUnitId || !unitsOfGroup.some(u => u.id === cascadeUnitId)) {
    cascadeUnitId = unitsOfGroup[0]?.id || '';
  }

  const floorsOfUnit = cascadeUnitId ? masterDataService.getFloors(cascadeUnitId, null, true) : [];
  if (cascadeFloorId && cascadeFloorId !== 'all' && !floorsOfUnit.some(f => f.id === cascadeFloorId)) {
    cascadeFloorId = floorsOfUnit[0]?.id || '';
  }

  // Active Floor & Code calculation
  const selectedFloor = (cascadeFloorId && cascadeFloorId !== 'all')
    ? floorsOfUnit.find(f => f.id === cascadeFloorId)
    : null;
  const activeFloor = selectedFloor || floorsOfUnit[0] || null;
  const activeFloorCode = (activeFloor?.code || (activeFloor?.name ? activeFloor.name.substring(0, 2) : 'JA')).toUpperCase().trim();

  // All lines in the system
  const allLines = storage.getTable(TABLE_NAMES.LINES) || [];
  const floorsMap = new Map(floorsOfUnit.map(f => [f.id, f.name]));
  const linesOfUnit = allLines.filter(l => floorsMap.has(l.floorId));
  const linesOfFloor = (cascadeFloorId && cascadeFloorId !== 'all')
    ? linesOfUnit.filter(l => l.floorId === cascadeFloorId)
    : linesOfUnit;

  if (cascadeLineId && cascadeLineId !== 'all' && !linesOfFloor.some(l => l.id === cascadeLineId)) {
    cascadeLineId = '';
  }

  const selectedGroup = groups.find(g => g.id === cascadeGroupId);
  const selectedUnit = unitsOfGroup.find(u => u.id === cascadeUnitId);
  const selectedLine = linesOfFloor.find(l => l.id === cascadeLineId);

  const linesToShow = (cascadeLineId && cascadeLineId !== 'all')
    ? linesOfFloor.filter(l => l.id === cascadeLineId)
    : linesOfFloor;

  // Calculate line counts per unit
  const unitLineCounts = new Map();
  unitsOfGroup.forEach(u => {
    const uFloors = masterDataService.getFloors(u.id, null, true);
    const uFloorIds = new Set(uFloors.map(f => f.id));
    const count = allLines.filter(l => uFloorIds.has(l.floorId)).length;
    unitLineCounts.set(u.id, count);
  });

  const isAllFloorsTarget = (step3LineTargetScope === 'ALL_FLOORS') || (cascadeFloorId === 'all');

  // Active Floor Lines (specifically for active target floor)
  const activeFloorLines = activeFloor ? allLines.filter(l => l.floorId === activeFloor.id) : [];
  const activeFloorLineNames = new Set(activeFloorLines.map(l => (l.name || '').trim().toUpperCase()));
  const activeFloorLineCodes = new Set(activeFloorLines.map(l => (l.code || '').trim().toUpperCase()));

  // Line availability status calculation for A to Z and named sections
  const isLineConfiguredOnActiveFloor = (token) => {
    const raw = (token || '').trim();
    if (!raw) return false;
    const upper = raw.toUpperCase();
    if (activeFloorLineNames.has(upper) || activeFloorLineCodes.has(upper)) return true;
    const prefixed = `${activeFloorCode}-${upper}`;
    if (activeFloorLineNames.has(prefixed) || activeFloorLineCodes.has(prefixed)) return true;
    return false;
  };

  const alphabetList = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const alphabetStatusList = alphabetList.map(letter => {
    if (isAllFloorsTarget) {
      const totalF = floorsOfUnit.length;
      const count = floorsOfUnit.filter(f => {
        const fCode = (f.code || f.name.substring(0, 2)).toUpperCase().trim();
        const expected = `${fCode}-${letter}`;
        return allLines.some(l => l.floorId === f.id && (
          l.name.toUpperCase() === expected || 
          (l.code && l.code.toUpperCase() === expected) ||
          l.name.toUpperCase() === letter
        ));
      }).length;
      const isAdded = totalF > 0 && count === totalF;
      const isPartial = count > 0 && count < totalF;
      return {
        letter,
        isAdded,
        isPartial,
        floorCount: count,
        totalFloors: totalF,
        tooltip: isAdded 
          ? `Letter ${letter} is already configured on ALL ${totalF} floors in this unit.` 
          : isPartial 
            ? `Letter ${letter} is configured on ${count}/${totalF} floors.` 
            : `Letter ${letter} is available across all floors.`
      };
    } else {
      const isAdded = isLineConfiguredOnActiveFloor(letter);
      return {
        letter,
        isAdded,
        isPartial: false,
        floorCount: isAdded ? 1 : 0,
        totalFloors: 1,
        tooltip: isAdded 
          ? `Line ${activeFloorCode}-${letter} is already added on ${activeFloor?.name || 'this floor'}.` 
          : `Line ${activeFloorCode}-${letter} is available to add.`
      };
    }
  });

  const missingAlphabetLetters = alphabetStatusList.filter(s => !s.isAdded).map(s => s.letter);
  const addedAlphabetCount = alphabetStatusList.filter(s => s.isAdded).length;

  const namedSections = ['Size Set', 'Eyelet & APW Room', 'Cutting', 'Finishing', 'Sample', 'Idle'];
  const namedSectionsStatus = namedSections.map(sec => {
    if (isAllFloorsTarget) {
      const totalF = floorsOfUnit.length;
      const count = floorsOfUnit.filter(f => {
        const fCode = (f.code || f.name.substring(0, 2)).toUpperCase().trim();
        const expected = `${fCode}-${sec}`.toUpperCase();
        return allLines.some(l => l.floorId === f.id && (
          l.name.toUpperCase() === expected || 
          (l.code && l.code.toUpperCase() === expected) ||
          l.name.toUpperCase() === sec.toUpperCase()
        ));
      }).length;
      const isAdded = totalF > 0 && count === totalF;
      const isPartial = count > 0 && count < totalF;
      return {
        name: sec,
        isAdded,
        isPartial,
        floorCount: count,
        totalFloors: totalF,
        tooltip: isAdded 
          ? `"${sec}" is already configured on ALL ${totalF} floors in this unit.` 
          : isPartial 
            ? `"${sec}" is configured on ${count}/${totalF} floors.` 
            : `Click to queue "${sec}" across all floors.`
      };
    } else {
      const isAdded = isLineConfiguredOnActiveFloor(sec);
      return {
        name: sec,
        isAdded,
        isPartial: false,
        floorCount: isAdded ? 1 : 0,
        totalFloors: 1,
        tooltip: isAdded 
          ? `Line ${activeFloorCode}-${sec} is already added on ${activeFloor?.name || 'this floor'}.` 
          : `Click to add ${sec} (${activeFloorCode}-${sec}).`
      };
    }
  });

  return `
    <div style="display: flex; flex-direction: column; gap: 8px;">

      <!-- TOP BREADCRUMB & HEADER (COMPACT STRIP) -->
      <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 6px 12px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
        <div style="display: flex; align-items: center; gap: 6px;">
          <span style="font-size: 15px;">⚡</span>
          <span style="font-size: 13px; font-weight: 800; color: #fff;">
            3-Step Plant Setup: Group &rarr; Unit &rarr; Line
          </span>
        </div>
        
        <!-- Active Path Breadcrumb -->
        <div style="font-size: 11px; font-weight: 700; background: rgba(15, 23, 42, 0.8); border: 1px solid var(--border-color); padding: 3px 10px; border-radius: 9999px; display: flex; align-items: center; gap: 6px;">
          <span style="color: #fbbf24;">🏢 ${selectedGroup?.name || 'No Group'}</span>
          <span style="color: var(--text-muted);">&rarr;</span>
          <span style="color: #34d399;">🏭 ${selectedUnit?.name || 'No Unit'}</span>
          <span style="color: var(--text-muted);">&rarr;</span>
          <span style="color: #38bdf8;">🏗️ ${activeFloor ? `${activeFloor.name} [${activeFloorCode}]` : 'Ground Floor'}</span>
          <span style="color: var(--text-muted);">&rarr;</span>
          <span style="color: #c084fc; font-weight: 800;">${linesOfFloor.length} Lines</span>
        </div>
      </div>

      <!-- STEP 1: GROUP ENTRY & SELECTION (COMPACT INLINE BAR) -->
      <div style="background: var(--bg-surface); border: 1px solid ${cascadeGroupId ? 'rgba(251, 191, 36, 0.35)' : 'var(--border-color)'}; border-radius: var(--radius-md); padding: 6px 10px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px;">
        <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap; flex: 1 1 auto;">
          <span class="badge" style="background: #fbbf24; color: #000; font-weight: 900; font-size: 10.5px; padding: 2px 7px; border-radius: 4px;">STEP 1</span>
          <span style="font-size: 12px; font-weight: 800; color: #fbbf24;">🏢 Group:</span>
          
          <!-- Select Existing Group -->
          <div style="display: inline-flex; align-items: center; gap: 4px;">
            <select id="fast-sel-group" class="filter-select" style="min-width: 180px; max-width: 240px; font-weight: 700; font-size: 11.5px; padding: 3px 6px; height: 28px; border-color: rgba(251, 191, 36, 0.4);">
              ${groups.length === 0 ? `<option value="">(No groups created yet)</option>` : 
                groups.map(g => `<option value="${g.id}" ${g.id === cascadeGroupId ? 'selected' : ''}>🏢 ${g.name} (${g.code})</option>`).join('')}
            </select>
            ${selectedGroup ? `
              <button type="button" id="btn-fast-edit-group" class="btn btn-secondary btn-sm" style="font-size: 11px; padding: 2px 7px; height: 28px;" title="Edit Selected Group">
                ✏️
              </button>
              <button type="button" id="btn-fast-delete-group" class="btn btn-danger btn-sm" style="font-size: 11px; padding: 2px 7px; height: 28px;" title="Delete Selected Group">
                🗑️
              </button>
            ` : ''}
          </div>

          <span style="color: var(--border-color); margin: 0 2px;">|</span>

          <!-- Direct New Group Entry -->
          <div style="display: inline-flex; align-items: center; gap: 4px; flex: 1 1 180px; max-width: 320px;">
            <input 
              type="text" 
              id="inp-quick-group-name" 
              class="form-control" 
              placeholder="Type new Group Name..." 
              style="font-size: 11.5px; padding: 3px 8px; height: 28px;" 
            />
            <button id="btn-quick-create-group" class="btn btn-primary btn-sm" style="font-weight: 800; background: linear-gradient(135deg, #f59e0b, #d97706); color: #000; white-space: nowrap; padding: 3px 8px; font-size: 11px; height: 28px;">
              ➕ Add
            </button>
          </div>
        </div>

        <span style="font-size: 11px; color: var(--text-muted); white-space: nowrap;">
          Total Groups: <strong style="color: #fff;">${groups.length}</strong>
        </span>
      </div>

      <!-- STEP 2: CONNECT UNITS TO GROUP (COMPACT INLINE CARD) -->
      <div style="background: var(--bg-surface); border: 1px solid ${cascadeUnitId ? 'rgba(52, 211, 153, 0.35)' : 'var(--border-color)'}; border-radius: var(--radius-md); padding: 6px 10px; display: flex; flex-direction: column; gap: 6px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px;">
          <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
            <span class="badge" style="background: #10b981; color: #fff; font-weight: 900; font-size: 10.5px; padding: 2px 7px; border-radius: 4px;">STEP 2</span>
            <span style="font-size: 12px; font-weight: 800; color: #34d399;">
              🏭 Units in <span style="color: #fff;">${selectedGroup?.name || 'Group'}</span> (${unitsOfGroup.length}):
            </span>
          </div>

          <button type="button" id="btn-fast-add-unit" class="btn btn-ghost btn-sm" style="color: #34d399; font-size: 11px; font-weight: 700; padding: 1px 6px; height: 24px;">
            + Single Unit Form
          </button>
        </div>

        <!-- Input & Presets Row -->
        <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
          <div style="display: flex; gap: 4px; flex: 1 1 240px;">
            <input 
              type="text" 
              id="inp-batch-units-text" 
              class="form-control" 
              placeholder="Type Unit Names (comma separated: Unit-01, Unit-02, Washing Plant)..." 
              style="font-size: 11.5px; font-weight: 600; padding: 3px 8px; height: 28px; border-color: rgba(52, 211, 153, 0.4);" 
            />
            <button id="btn-save-batch-units" class="btn btn-primary btn-sm" style="font-weight: 800; background: linear-gradient(135deg, #10b981, #059669); white-space: nowrap; padding: 3px 10px; font-size: 11px; height: 28px;">
              ➕ Add All
            </button>
          </div>

          <div style="display: inline-flex; align-items: center; gap: 3px; flex-wrap: wrap;">
            <span style="font-size: 10px; color: var(--text-secondary); font-weight: 700;">PRESETS:</span>
            <button type="button" class="btn btn-ghost btn-sm btn-unit-preset" data-preset="AKM Knit Wear Ltd., Al-Muslim Apparels Ltd., Al-Muslim Fashion &amp; Specilized Ltd., Al-Muslim Garments Accessories Ltd, Pacific Blue (Jeans Wear) Ltd." style="font-size: 10px; padding: 1px 6px; height: 24px; border: 1px solid rgba(52, 211, 153, 0.5); color: #34d399; font-weight: 800; background: rgba(52, 211, 153, 0.12);">⚡ All 5 AMG Units</button>
            <button type="button" class="btn btn-ghost btn-sm btn-unit-preset" data-preset="Unit-01, Unit-02, Unit-03" style="font-size: 10px; padding: 1px 5px; height: 24px; border: 1px solid rgba(52, 211, 153, 0.3);">+ 01-03</button>
            <button type="button" class="btn btn-ghost btn-sm btn-unit-preset" data-preset="Unit-04, Unit-05, Unit-06" style="font-size: 10px; padding: 1px 5px; height: 24px; border: 1px solid rgba(52, 211, 153, 0.3);">+ 04-06</button>
            <button type="button" class="btn btn-ghost btn-sm btn-unit-preset" data-preset="Washing Plant" style="font-size: 10px; padding: 1px 5px; height: 24px; border: 1px solid rgba(52, 211, 153, 0.3);">+ Washing</button>
            <button type="button" class="btn btn-ghost btn-sm btn-unit-preset" data-preset="Cutting Section" style="font-size: 10px; padding: 1px 5px; height: 24px; border: 1px solid rgba(52, 211, 153, 0.3);">+ Cutting</button>
            <button type="button" class="btn btn-ghost btn-sm btn-unit-preset" data-preset="Finishing Section" style="font-size: 10px; padding: 1px 5px; height: 24px; border: 1px solid rgba(52, 211, 153, 0.3);">+ Finishing</button>
          </div>
        </div>

        <!-- Unit Tiles / Chips -->
        <div style="display: flex; gap: 4px; flex-wrap: wrap;">
          ${unitsOfGroup.length === 0 ? `
            <div style="font-size: 11px; color: var(--text-muted); padding: 3px 6px; background: rgba(15, 23, 42, 0.4); border-radius: var(--radius-sm);">
              No units connected yet. Type names in the box above.
            </div>
          ` : unitsOfGroup.map(u => {
            const isCurrent = u.id === cascadeUnitId;
            const lineCnt = unitLineCounts.get(u.id) || 0;
            return `
              <div 
                class="btn-tile-select-unit" 
                data-id="${u.id}" 
                style="display: inline-flex; align-items: center; gap: 5px; padding: 3px 7px; border-radius: 6px; cursor: pointer; transition: all 0.15s; background: ${isCurrent ? 'rgba(52, 211, 153, 0.18)' : 'var(--bg-card)'}; border: 1.5px solid ${isCurrent ? '#34d399' : 'var(--border-color)'};"
              >
                <span style="font-size: 11px;">${isCurrent ? '🟢' : '🏭'}</span>
                <span style="font-weight: 800; font-size: 11px; color: ${isCurrent ? '#34d399' : '#fff'};">
                  ${u.name}
                </span>
                <span class="badge" style="font-size: 9.5px; background: rgba(56, 189, 248, 0.15); color: #38bdf8; padding: 1px 4px;">
                  ${lineCnt} Lines
                </span>
                <div style="display: inline-flex; gap: 1px; margin-left: 2px;">
                  <button type="button" class="btn btn-ghost btn-sm btn-tile-edit-unit" data-id="${u.id}" title="Edit Unit ${u.name}" style="padding: 0 2px; font-size: 10px; height: 16px; line-height: 1;">✏️</button>
                  <button type="button" class="btn btn-ghost btn-sm btn-tile-delete-unit" data-id="${u.id}" title="Delete Unit ${u.name}" style="padding: 0 2px; font-size: 10px; color: #ef4444; height: 16px; line-height: 1;">🗑️</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- STEP 3: SELECT UNIT & ADD LINES (COMPACT CARD) -->
      <div style="background: var(--bg-surface); border: 1px solid rgba(56, 189, 248, 0.35); border-radius: var(--radius-md); padding: 6px 10px; display: flex; flex-direction: column; gap: 6px;">
        <!-- Step 3 Header with Dropdowns and Controls -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px; border-bottom: 1px solid var(--border-color); padding-bottom: 5px;">
          <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
            <span class="badge" style="background: #0284c7; color: #fff; font-weight: 900; font-size: 10.5px; padding: 2px 7px; border-radius: 4px;">STEP 3</span>
            <span style="font-size: 12px; font-weight: 800; color: #38bdf8;">
              🧵 Lines for <span style="color: #34d399;">${selectedUnit?.name || 'Unit'}</span>:
            </span>

            <!-- Unit Selector Dropdown -->
            <select id="fast-sel-unit" class="filter-select" style="font-weight: 700; font-size: 11px; height: 26px; padding: 2px 5px; border-color: rgba(52, 211, 153, 0.4);">
              ${unitsOfGroup.map(u => `<option value="${u.id}" ${u.id === cascadeUnitId ? 'selected' : ''}>🏭 ${u.name} (${unitLineCounts.get(u.id) || 0} Lines)</option>`).join('')}
            </select>
            
            <!-- Floor Selector Dropdown -->
            <select id="fast-sel-floor" class="filter-select" style="font-weight: 700; font-size: 11px; height: 26px; padding: 2px 5px; border-color: rgba(56, 189, 248, 0.4);">
              <option value="all" ${cascadeFloorId === 'all' || !cascadeFloorId ? 'selected' : ''}>🌐 All Floors (${linesOfUnit.length} Lines)</option>
              ${floorsOfUnit.map(f => `<option value="${f.id}" ${f.id === (cascadeFloorId || activeFloor?.id) ? 'selected' : ''}>🏗️ ${f.name} [${f.code || 'FL'}] (${linesOfUnit.filter(l => l.floorId === f.id).length} Lines)</option>`).join('')}
            </select>

            <!-- Active Floor Code Badge -->
            <span style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.4); font-weight: 800; font-size: 10.5px; padding: 2px 5px; border-radius: 4px;" title="Floor Code">
              Code: <strong style="color: #fff;">${activeFloorCode}</strong>
            </span>

            ${activeFloor ? `
              <span style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid #38bdf8; font-weight: 800; font-size: 10.5px; padding: 2px 5px; border-radius: 4px;" title="Customizable Floor Sticker Tag">
                🏷️ ${activeFloor.locationTag || qrCodeService.getLocationTag(cascadeUnitId, activeFloor.id)}
              </span>
            ` : ''}
          </div>

          <div style="display: flex; align-items: center; gap: 4px;">
            ${isAdmin && activeFloor ? `
              <button type="button" id="btn-fast-edit-floor" data-id="${activeFloor.id}" class="btn btn-secondary btn-sm" style="color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.4); font-size: 10.5px; font-weight: 700; padding: 2px 6px; height: 26px;" title="Edit Floor">
                ✏️ Edit [${activeFloorCode}]
              </button>
            ` : ''}
            ${isAdmin ? `
              <button type="button" id="btn-fast-add-floor" class="btn btn-ghost btn-sm" style="color: #34d399; border: 1px solid rgba(52, 211, 153, 0.4); font-size: 10.5px; font-weight: 700; padding: 2px 6px; height: 26px;" title="Add Floor">
                ➕ Add Floor
              </button>
            ` : ''}
          </div>
        </div>

        <!-- Compact Quick Floor Presets + System Selector Bar -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 4px; background: rgba(15, 23, 42, 0.5); border: 1px solid rgba(56, 189, 248, 0.2); border-radius: 4px; padding: 4px 6px;">
          <!-- Quick Floor Presets -->
          <div style="display: flex; align-items: center; gap: 3px; flex-wrap: wrap;">
            <span style="font-size: 9.5px; font-weight: 800; color: #38bdf8; text-transform: uppercase;">FLOORS:</span>
            ${[
              { name: 'Jamuna Floor', code: 'JA' },
              { name: 'Buriganga Floor', code: 'BG' },
              { name: 'Chitra Floor', code: 'CH' },
              { name: 'Padma Floor', code: 'PD' },
              { name: 'Titas Floor', code: 'TT' },
              { name: 'Tista Floor', code: 'TS' },
              { name: 'Surma Floor', code: 'SU' },
              { name: 'Meghna Floor', code: 'MG' },
              { name: 'Pilot', code: 'PT' },
              { name: 'Model Line', code: 'ML' },
              { name: 'Sample', code: 'SM' }
            ].map(fp => {
              const isMatch = activeFloor && (activeFloor.code === fp.code || activeFloor.name.toLowerCase().includes(fp.name.toLowerCase()));
              return `
                <button 
                  type="button" 
                  class="btn btn-ghost btn-sm btn-quick-floor-preset" 
                  data-name="${fp.name}" 
                  data-code="${fp.code}" 
                  style="font-size: 10px; padding: 1px 5px; height: 22px; border-radius: 4px; border: 1px solid ${isMatch ? '#38bdf8' : 'rgba(56, 189, 248, 0.3)'}; background: ${isMatch ? 'rgba(56, 189, 248, 0.2)' : 'rgba(15, 23, 42, 0.5)'}; color: ${isMatch ? '#fff' : '#94a3b8'}; font-weight: ${isMatch ? '800' : '600'};" 
                  title="Floor ${fp.name} (${fp.code})"
                >
                  ${isMatch ? '🟢' : ''}${fp.name.split(' ')[0]} <strong>[${fp.code}]</strong>
                </button>
              `;
            }).join('')}
          </div>

          <!-- Scope Switcher Buttons -->
          <div style="display: flex; align-items: center; gap: 4px;">
            <button 
              type="button" 
              id="btn-scope-individual" 
              class="btn btn-sm ${!isAllFloorsTarget ? 'btn-primary' : 'btn-ghost'}" 
              style="font-size: 10.5px; font-weight: 800; padding: 2px 7px; height: 22px; border-radius: 4px; ${!isAllFloorsTarget ? 'background: #0284c7; color: #fff;' : 'color: #94a3b8; border: 1px solid rgba(148, 163, 184, 0.3);'}"
              title="Add lines to current floor [${activeFloorCode}]"
            >
              🎯 Single (${activeFloorCode})
            </button>
            <button 
              type="button" 
              id="btn-scope-all-floors" 
              class="btn btn-sm ${isAllFloorsTarget ? 'btn-success' : 'btn-ghost'}" 
              style="font-size: 10.5px; font-weight: 800; padding: 2px 7px; height: 22px; border-radius: 4px; ${isAllFloorsTarget ? 'background: #10b981; color: #fff;' : 'color: #34d399; border: 1px solid rgba(52, 211, 153, 0.3);'}"
              title="Add lines across all ${floorsOfUnit.length} floors"
            >
              🌐 All Floors (${floorsOfUnit.length})
            </button>
          </div>
        </div>

        <!-- COMPACT AVAILABILITY MATRIX & QUICK FILL -->
        <div style="background: rgba(15, 23, 42, 0.4); border: 1px solid ${isAllFloorsTarget ? 'rgba(52, 211, 153, 0.3)' : 'rgba(56, 189, 248, 0.25)'}; border-radius: 4px; padding: 4px 8px; display: flex; flex-direction: column; gap: 4px;">
          <!-- Matrix Summary & Letter Chips -->
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 4px;">
            <div style="display: flex; align-items: center; gap: 3px; flex-wrap: wrap;" id="matrix-alphabet-chips">
              <span style="font-size: 9.5px; font-weight: 800; color: #38bdf8; text-transform: uppercase; margin-right: 2px;">MATRIX:</span>
              ${alphabetStatusList.map(item => `
                <button 
                  type="button" 
                  class="btn-matrix-letter-chip" 
                  data-letter="${item.letter}" 
                  data-added="${item.isAdded ? 'true' : 'false'}"
                  title="${item.tooltip}"
                  style="min-width: 22px; height: 20px; padding: 0 3px; font-size: 10.5px; font-weight: 800; border-radius: 3px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.15s ease; ${
                    item.isAdded 
                      ? 'background: rgba(16, 185, 129, 0.2); border: 1px solid #10b981; color: #34d399;' 
                      : item.isPartial 
                        ? 'background: rgba(251, 191, 36, 0.15); border: 1px dashed #fbbf24; color: #fbbf24;' 
                        : 'background: rgba(15, 23, 42, 0.6); border: 1px dashed rgba(56, 189, 248, 0.35); color: #cbd5e1;'
                  }"
                >
                  ${item.isAdded ? '✓' : item.isPartial ? '◐' : ''}${item.letter}
                </button>
              `).join('')}
            </div>

            <div style="display: inline-flex; align-items: center; gap: 6px; font-size: 10.5px; font-weight: 700;">
              <span style="color: #34d399;">✓ ${addedAlphabetCount}/26</span>
              <span style="color: #38bdf8;">⚪ ${missingAlphabetLetters.length} Miss</span>
            </div>
          </div>

          <!-- Section Chips + 1-Click Fast Fill Actions in a neat row -->
          <div style="display: flex; align-items: center; gap: 3px; flex-wrap: wrap; border-top: 1px dashed rgba(255,255,255,0.06); padding-top: 4px;">
            <span style="font-size: 9.5px; font-weight: 800; color: #38bdf8; text-transform: uppercase;">FILL:</span>
            
            <button 
              type="button" 
              id="btn-fill-missing-lines" 
              class="btn btn-sm" 
              data-missing="${missingAlphabetLetters.join(', ')}"
              style="font-size: 10px; height: 22px; ${
                missingAlphabetLetters.length > 0 
                  ? 'background: linear-gradient(135deg, #10b981, #059669); color: #fff; border: none;' 
                  : 'background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid #10b981;'
              } font-weight: 800; padding: 1px 6px; border-radius: 3px;" 
              title="Auto-populate unconfigured lines"
            >
              ${missingAlphabetLetters.length > 0 ? `✨ Fill Missing (${missingAlphabetLetters.length})` : `✅ All A-Z Done`}
            </button>

            <button type="button" id="btn-quick-gen-atp" class="btn btn-sm" style="font-size: 10px; height: 22px; background: #0284c7; color: #fff; padding: 1px 6px; border: none; font-weight: 800; border-radius: 3px;" title="Garments Lines A to N, P (15 lines)">A-N, P (15)</button>
            <button type="button" id="btn-quick-gen-atoz" class="btn btn-ghost btn-sm" style="font-size: 10px; height: 22px; color: #38bdf8; padding: 1px 5px; border: 1px solid rgba(56, 189, 248, 0.4); font-weight: 700;">A-Z (26)</button>
            <button type="button" id="btn-quick-gen-atoj" class="btn btn-ghost btn-sm" style="font-size: 10px; height: 22px; color: #38bdf8; padding: 1px 5px; border: 1px solid rgba(56, 189, 248, 0.4); font-weight: 700;">A-J</button>
            <button type="button" id="btn-quick-gen-ktot" class="btn btn-ghost btn-sm" style="font-size: 10px; height: 22px; color: #38bdf8; padding: 1px 5px; border: 1px solid rgba(56, 189, 248, 0.4); font-weight: 700;">K-T</button>
            <button type="button" id="btn-quick-gen-utoz" class="btn btn-ghost btn-sm" style="font-size: 10px; height: 22px; color: #38bdf8; padding: 1px 5px; border: 1px solid rgba(56, 189, 248, 0.4); font-weight: 700;">U-Z</button>

            ${namedSectionsStatus.map(sec => `
              <button 
                type="button" 
                class="btn-matrix-section-chip" 
                data-val="${sec.name}" 
                data-added="${sec.isAdded ? 'true' : 'false'}"
                title="${sec.tooltip}"
                style="font-size: 10px; height: 22px; font-weight: 700; padding: 1px 5px; border-radius: 3px; cursor: pointer; ${
                  sec.isAdded 
                    ? 'background: rgba(16, 185, 129, 0.2); border: 1px solid #10b981; color: #34d399;' 
                    : sec.isPartial
                      ? 'background: rgba(245, 158, 11, 0.2); border: 1px solid #f59e0b; color: #fbbf24;'
                      : 'background: rgba(15, 23, 42, 0.6); border: 1px dashed rgba(52, 211, 153, 0.4); color: #34d399;'
                }"
              >
                ${sec.isAdded ? '✓ ' : '+ '}${sec.name}
              </button>
            `).join('')}

            <button type="button" class="btn btn-ghost btn-sm btn-quick-append-line" data-val="Idle" style="font-size: 10px; height: 22px; color: #f87171; padding: 1px 5px; border: 1px solid rgba(239, 68, 68, 0.4); font-weight: 700;" title="Add Idle Section">+ Idle</button>
            <button type="button" id="btn-clear-lines-input" class="btn btn-ghost btn-sm" style="font-size: 10px; height: 22px; color: #94a3b8; padding: 1px 5px; border: 1px solid rgba(148, 163, 184, 0.3); font-weight: 700;" title="Clear input">✕</button>
            <button type="button" id="btn-fast-add-line" class="btn btn-ghost btn-sm" style="font-size: 10px; height: 22px; color: #c084fc; padding: 1px 6px; border: 1px solid rgba(192, 132, 252, 0.35); font-weight: 700; margin-left: auto;">+ Single Line Form</button>
          </div>
        </div>

        <!-- Input Bar & Action Buttons -->
        <div style="display: flex; gap: 4px; flex-wrap: wrap;">
          <input 
            type="text" 
            id="inp-batch-lines-text" 
            class="form-control" 
            placeholder="${isAllFloorsTarget ? `Type lines or click Fill buttons to add across ALL ${floorsOfUnit.length} floors...` : `Type lines or click Fill buttons for ${activeFloor?.name || 'floor'} [${activeFloorCode}]...`}" 
            style="flex: 1; min-width: 200px; font-size: 11.5px; font-weight: 600; padding: 3px 8px; height: 28px; border: 1.5px solid ${isAllFloorsTarget ? 'rgba(52, 211, 153, 0.5)' : 'rgba(56, 189, 248, 0.4)'};" 
          />
          
          <button 
            type="button" 
            id="btn-save-batch-lines-single" 
            class="btn ${!isAllFloorsTarget ? 'btn-primary' : 'btn-ghost'} btn-sm" 
            style="font-weight: 800; ${!isAllFloorsTarget ? 'background: #0284c7; color: #fff;' : 'color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.5);'} white-space: nowrap; padding: 3px 10px; font-size: 11px; height: 28px;"
            title="Add lines only to ${activeFloor?.name || 'floor'} [${activeFloorCode}]"
          >
            🎯 Add to ${activeFloorCode}
          </button>

          <button 
            type="button" 
            id="btn-save-batch-lines-all" 
            class="btn ${isAllFloorsTarget ? 'btn-success' : 'btn-ghost'} btn-sm" 
            style="font-weight: 800; ${isAllFloorsTarget ? 'background: #10b981; color: #fff;' : 'color: #34d399; border: 1px solid rgba(52, 211, 153, 0.5); background: rgba(52, 211, 153, 0.08);'} white-space: nowrap; padding: 3px 10px; font-size: 11px; height: 28px;"
            title="1-Click Add to ALL floors"
          >
            🌐 Add to ALL (${floorsOfUnit.length} Floors)
          </button>
        </div>

        <!-- Live Preview -->
        <div id="batch-lines-live-preview" style="min-height: 20px; padding: 2px 6px; border-radius: 4px; background: rgba(15, 23, 42, 0.4); border: 1px dashed var(--border-color); display: flex; align-items: center; flex-wrap: wrap; gap: 4px; font-size: 10.5px;">
          <span style="color: var(--text-muted);">
            💡 Enter line letters or click chips above. Existing lines will automatically be detected and duplicates skipped.
          </span>
        </div>

        <!-- ACTIVE CONFIGURED LINES SUMMARY STRIP (if any) -->
        ${activeFloorLines.length > 0 ? `
          <div style="background: rgba(15, 23, 42, 0.4); border: 1px solid var(--border-color); border-radius: 4px; padding: 3px 6px; display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">
            <span style="font-size: 10px; font-weight: 800; color: #10b981; display: inline-flex; align-items: center; gap: 2px;">
              ✓ ACTIVE ON [${activeFloorCode}] (${activeFloorLines.length}):
            </span>
            <div style="display: flex; flex-wrap: wrap; gap: 3px;">
              ${activeFloorLines.map(l => `
                <span style="background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.35); color: #34d399; font-size: 10.5px; font-weight: 700; padding: 1px 5px; border-radius: 3px;" title="Configured Line: ${l.name}">
                  ${l.name}
                </span>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Configured Production Lines Table for this Unit -->
        <div style="margin-top: 2px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; flex-wrap: wrap; gap: 4px;">
            <div style="display: flex; align-items: center; gap: 4px;">
              <span style="font-size: 12.5px; font-weight: 800; color: #fff;">
                📋 Lines for: <span style="color: #34d399;">${selectedUnit?.name || 'Unit'}</span>
              </span>
              <span class="badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; font-size: 10px; font-weight: 800; padding: 1px 5px;">
                Total: ${linesToShow.length}
              </span>
            </div>

            ${selectedStep3LineIds.size > 0 ? `
              <div style="display: flex; align-items: center; gap: 4px; background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.4); padding: 2px 6px; border-radius: 4px;">
                <span style="font-size: 11px; color: #f87171; font-weight: 800;">☑️ ${selectedStep3LineIds.size} Selected</span>
                <button type="button" id="btn-step3-bulk-delete" class="btn btn-danger btn-sm" style="font-size: 10.5px; font-weight: 800; padding: 1px 6px; height: 22px;">
                  🗑️ Delete (${selectedStep3LineIds.size})
                </button>
                <button type="button" id="btn-step3-deselect" class="btn btn-ghost btn-sm" style="font-size: 10.5px; color: var(--text-muted); padding: 1px 4px; height: 22px;">
                  ✕ Clear
                </button>
              </div>
            ` : `
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="font-size: 10.5px; color: var(--text-muted);">
                  Floor: <strong style="color: #38bdf8;">${activeFloor ? `${activeFloor.name} [${activeFloorCode}]` : 'All Floors'}</strong>
                </span>
                ${linesToShow.length > 0 ? `
                  <button type="button" id="btn-step3-select-all-btn" class="btn btn-ghost btn-sm" style="font-size: 10.5px; color: #38bdf8; border: 1px dashed rgba(56, 189, 248, 0.4); padding: 1px 6px; height: 22px; font-weight: 700;">
                    ☑️ Select All (${linesToShow.length})
                  </button>
                ` : ''}
              </div>
            `}
          </div>

          <div class="table-responsive" style="border: 1px solid var(--border-color); border-radius: var(--radius-md); overflow-x: auto;">
            <table class="excel-grid" style="width: 100%; text-align: left; border-collapse: collapse;">
              <thead>
                <tr style="background: var(--bg-card); border-bottom: 2px solid var(--border-color);">
                  <th style="width: 44px; text-align: center;">
                    <input 
                      type="checkbox" 
                      id="chk-step3-select-all" 
                      ${linesToShow.length > 0 && selectedStep3LineIds.size === linesToShow.length ? 'checked' : ''} 
                      style="width: 17px; height: 17px; cursor: pointer; accent-color: #0284c7;" 
                      title="Select / Deselect all lines"
                    />
                  </th>
                  <th style="width: 48px; text-align: center;">SL</th>
                  <th>LINE NAME</th>
                  <th>CODE</th>
                  <th>PARENT HIERARCHY</th>
                  <th style="text-align: center;">MACHINES</th>
                  <th style="text-align: center;">STATUS</th>
                  <th style="text-align: center; width: 120px;">ADMIN ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                ${linesToShow.length === 0 ? `
                  <tr>
                    <td colspan="8" style="text-align: center; padding: 32px 16px; color: var(--text-muted);">
                      <div style="font-size: 28px; margin-bottom: 6px;">🧵</div>
                      <div style="font-weight: 700; color: #cbd5e1; font-size: 13.5px;">No lines configured for ${selectedUnit?.name || 'this unit'} yet.</div>
                      <div style="font-size: 12px; margin-top: 4px; color: #94a3b8;">Click <strong>⚡ A to Z</strong> above and click <strong>🚀 Add All Lines (1-Click)</strong>!</div>
                    </td>
                  </tr>
                ` : linesToShow.map((line, idx) => {
                  const machines = storage.getTable(TABLE_NAMES.MACHINES) || [];
                  const lineMachinesCount = machines.filter(m => m.lineId === line.id).length;
                  const floorName = floorsMap.get(line.floorId) || 'Ground Floor';
                  const isLineActive = line.status === 'ACTIVE';
                  const isChecked = selectedStep3LineIds.has(line.id);
                  return `
                    <tr style="border-bottom: 1px solid var(--border-color); background: ${isChecked ? 'rgba(2, 132, 199, 0.12)' : 'transparent'}; transition: background 0.15s ease;">
                      <td style="text-align: center;">
                        <input 
                          type="checkbox" 
                          class="chk-step3-line-row" 
                          data-id="${line.id}" 
                          ${isChecked ? 'checked' : ''} 
                          style="width: 17px; height: 17px; cursor: pointer; accent-color: #0284c7;" 
                        />
                      </td>
                      <td style="text-align: center; color: var(--text-muted); font-weight: 700; font-size: 11.5px;">${String(idx + 1).padStart(2, '0')}</td>
                      <td style="font-weight: 800; color: #fff;">🧵 ${line.name}</td>
                      <td><span style="font-family: var(--font-mono); font-size: 11.5px; color: #38bdf8;">${line.code || line.name}</span></td>
                      <td style="font-size: 11.5px;">
                        <span style="color: #fbbf24;">${selectedGroup?.name || ''}</span> &rarr;
                        <span style="color: #34d399;">${selectedUnit?.name || ''}</span> &rarr;
                        <span style="color: #38bdf8;">${floorName}</span>
                      </td>
                      <td style="text-align: center;">
                        <span class="badge ${lineMachinesCount > 0 ? 'badge-active' : 'badge-idle'}" style="font-size: 11px;">
                          ${lineMachinesCount} Machines
                        </span>
                      </td>
                      <td style="text-align: center;">
                        <button 
                          class="btn-master-toggle" 
                          data-type="line" 
                          data-id="${line.id}" 
                          style="border: 1.5px solid ${isLineActive ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}; background: ${isLineActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)'}; color: ${isLineActive ? '#34d399' : '#f87171'}; border-radius: 9999px; padding: 3px 10px; cursor: pointer; font-size: 11px; font-weight: 800;" 
                          title="Click to toggle status"
                        >
                          ${isLineActive ? '🟢 ACTIVE' : '🔴 INACTIVE'}
                        </button>
                      </td>
                      <td style="text-align: center;">
                        <div style="display: inline-flex; gap: 4px;">
                          <button class="btn btn-secondary btn-sm btn-master-edit" data-type="line" data-id="${line.id}" title="Edit Line Name / Code" style="padding: 3px 8px; font-size: 12px;">
                            ✏️ Edit
                          </button>
                          <button class="btn btn-ghost btn-sm btn-master-delete" data-type="line" data-id="${line.id}" title="Delete Line" style="color: #ef4444; padding: 3px 6px; font-size: 12px;">
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
        </div>

      </div>

    </div>
  `;
}

function renderHierarchyTreeView() {
  const plantTree = masterDataService.getHierarchyTree();
  const equipmentTree = masterDataService.getEquipmentTree();

  return `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
      <!-- Plant Hierarchy: Group -> Unit -> Floor -> Line -->
      <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 18px; display: flex; flex-direction: column; gap: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h3 style="font-size: 15px; font-weight: 700; color: #38bdf8; margin: 0;">🏭 Plant &amp; Location Hierarchy (1 &rarr; 2 &rarr; 3 &rarr; 4)</h3>
            <p style="font-size: 11.5px; color: var(--text-muted); margin-top: 2px; margin-bottom: 0;">Group &rarr; Factory Unit &rarr; Floor &rarr; Production Line</p>
          </div>
          <button id="btn-tree-add-group" class="btn btn-secondary btn-sm" style="font-weight: 700;">
            ➕ Add Group
          </button>
        </div>

        <div style="display: flex; flex-direction: column; gap: 12px; max-height: 580px; overflow-y: auto; padding-right: 4px;">
          ${plantTree.length === 0 ? `
            <div style="padding: 24px; text-align: center; color: var(--text-muted);">No groups created yet. Click '+ Add Group' to begin.</div>
          ` : plantTree.map(grp => `
            <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px 16px;">
              <div style="display: flex; justify-content: space-between; align-items: center; font-weight: 800; color: #fbbf24; font-size: 13.5px;">
                <span>🏢 ${grp.name} (${grp.code})</span>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <button class="btn-master-toggle" data-type="group" data-id="${grp.id}" style="border: none; background: transparent; cursor: pointer; font-size: 11px;" title="Toggle Group status">
                    ${grp.status === 'ACTIVE' ? '🟢 Active' : '🔴 Inactive'}
                  </button>
                  <span class="badge ${grp.status === 'ACTIVE' ? 'badge-active' : 'badge-idle'}">${grp.unitsCount} Units</span>
                </div>
              </div>

              <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 10px; padding-left: 12px; border-left: 2px solid rgba(251, 191, 36, 0.25);">
                ${grp.units.map(unt => `
                  <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 10px 12px;">
                    <div style="display: flex; justify-content: space-between; font-weight: 700; color: #fff; font-size: 12.5px;">
                      <span>🏭 ${unt.name}</span>
                      <div style="display: flex; align-items: center; gap: 6px;">
                        <button class="btn-master-toggle" data-type="unit" data-id="${unt.id}" style="border: none; background: transparent; cursor: pointer; font-size: 11px;" title="Toggle Unit status">
                          ${unt.status === 'ACTIVE' ? '🟢' : '🔴'}
                        </button>
                        <span style="font-size: 11px; color: var(--text-muted);">${unt.floorsCount} Floors</span>
                      </div>
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 6px; padding-left: 10px; border-left: 2px solid rgba(56, 189, 248, 0.25);">
                      ${unt.floors.map(flr => `
                        <div style="font-size: 12px;">
                          <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-weight: 600; color: #38bdf8;">🏗️ ${flr.name} (${flr.linesCount} lines)</span>
                            <button class="btn-master-toggle" data-type="floor" data-id="${flr.id}" style="border: none; background: transparent; cursor: pointer; font-size: 10px;" title="Toggle Floor status">
                              ${flr.status === 'ACTIVE' ? '🟢' : '🔴'}
                            </button>
                          </div>
                          <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px;">
                            ${flr.lines.map(lin => `
                              <span class="badge ${lin.status === 'ACTIVE' ? 'badge-idle' : 'badge-danger'}" style="font-size: 10px; display: inline-flex; align-items: center; gap: 4px;">
                                🧵 ${lin.name} (${lin.machineCount} machines)
                              </span>
                            `).join('')}
                          </div>
                        </div>
                      `).join('')}
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Equipment Hierarchy: Machine Name -> Brand -> Model -->
      <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 18px; display: flex; flex-direction: column; gap: 14px;">
        <div>
          <h3 style="font-size: 15px; font-weight: 700; color: #34d399; margin: 0;">⚙️ Equipment Specification Hierarchy (5 &rarr; 6 &rarr; 7)</h3>
          <p style="font-size: 11.5px; color: var(--text-muted); margin-top: 2px; margin-bottom: 0;">Category &rarr; Machine Name &rarr; Multiple Brands &rarr; Multiple Models</p>
        </div>

        <div style="display: flex; flex-direction: column; gap: 12px; max-height: 580px; overflow-y: auto; padding-right: 4px;">
          ${equipmentTree.map(cat => `
            <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px 16px;">
              <div style="display: flex; justify-content: space-between; align-items: center; font-weight: 800; color: #c084fc; font-size: 13.5px;">
                <span>📁 ${cat.name}</span>
                <span class="badge badge-idle">${cat.machineNamesCount} Machine Types</span>
              </div>

              <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 10px; padding-left: 12px; border-left: 2px solid rgba(192, 132, 252, 0.25);">
                ${cat.machineNames.map(mn => `
                  <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 10px 12px;">
                    <div style="display: flex; justify-content: space-between; font-weight: 700; color: #fff; font-size: 12.5px;">
                      <span>✂️ ${mn.name}</span>
                      <span style="color: #34d399; font-weight: 700; font-size: 11px;">${mn.machineCount} Physical Machines</span>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 6px;">
                      ${mn.brands.map(brd => `
                        <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 4px; padding: 6px 8px;">
                          <div style="font-weight: 700; color: #fbbf24; font-size: 11.5px;">🏷️ ${brd.name}</div>
                          <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">
                            ${brd.models.map(m => `<div>• ${m.name} (${m.machineCount} units)</div>`).join('')}
                          </div>
                        </div>
                      `).join('')}
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

function renderMasterModalDOM() {
  if (!activeModalState) return '';

  // 1. VIEW DETAILS MODAL
  if (activeModalState.type === 'VIEW') {
    const { item, entityType } = activeModalState;
    const dep = masterDataService.checkDependencies(entityType, item.id);
    const isActive = item.status === 'ACTIVE';

    return `
      <div class="modal-overlay" id="master-modal-overlay" style="display: flex; align-items: center; justify-content: center; z-index: 9999;">
        <div class="modal-card" style="max-width: 520px; width: 90%; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 24px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 12px; margin-bottom: 16px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 20px;">👁️</span>
              <h3 style="font-size: 16px; font-weight: 800; color: #fff; margin: 0;">
                ${getEntityDisplayName(activeTab)} Details
              </h3>
            </div>
            <button id="btn-modal-close" style="background: none; border: none; font-size: 18px; color: var(--text-muted); cursor: pointer;">✕</button>
          </div>

          <div style="display: flex; flex-direction: column; gap: 12px; font-size: 13px;">
            <div style="background: var(--bg-card); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
              <div style="font-size: 11px; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Name</div>
              <div style="font-size: 16px; font-weight: 800; color: #fff; margin-top: 2px;">${item.name}</div>
              <div style="font-family: var(--font-mono); font-size: 12px; color: #38bdf8; font-weight: 700; margin-top: 4px;">
                CODE: ${item.code || '—'}
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div style="background: var(--bg-card); padding: 10px 12px; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
                <div style="font-size: 11px; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Status</div>
                <div style="margin-top: 4px;">
                  <span class="badge ${isActive ? 'badge-active' : 'badge-idle'}">
                    ${isActive ? '🟢 ACTIVE' : '🔴 INACTIVE'}
                  </span>
                </div>
              </div>
              <div style="background: var(--bg-card); padding: 10px 12px; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
                <div style="font-size: 11px; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Dependencies</div>
                <div style="font-weight: 700; color: #38bdf8; margin-top: 4px;">${dep.details.join(', ') || '0 linked items'}</div>
              </div>
            </div>

            ${item.description ? `
              <div style="background: var(--bg-card); padding: 10px 12px; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
                <div style="font-size: 11px; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Description / Notes</div>
                <div style="color: var(--text-secondary); margin-top: 4px;">${item.description}</div>
              </div>
            ` : ''}
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; border-top: 1px solid var(--border-color); padding-top: 14px;">
            <button id="btn-modal-cancel" class="btn btn-secondary">Close</button>
            <button id="btn-view-edit-direct" class="btn btn-primary" data-type="${entityType}" data-id="${item.id}" style="font-weight: 700;">
              ✏️ Edit Record
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // 2. DELETE DEPENDENCY WARNING DIALOG
  if (activeModalState.type === 'DELETE_DEP') {
    const { item, dependencies, entityType } = activeModalState;
    return `
      <div class="modal-overlay" id="master-modal-overlay" style="display: flex; align-items: center; justify-content: center; z-index: 9999;">
        <div class="modal-card" style="max-width: 520px; width: 90%; background: var(--bg-card); border: 1.5px solid #ef4444; border-radius: var(--radius-lg); padding: 24px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
            <span style="font-size: 28px;">⚠️</span>
            <div>
              <h3 style="font-size: 16px; font-weight: 800; color: #f87171; margin: 0;">Cannot Delete: Active Dependencies</h3>
              <p style="font-size: 12px; color: var(--text-secondary); margin-top: 2px; margin-bottom: 0;">Integrity Protection</p>
            </div>
          </div>

          <p style="font-size: 13px; color: #fff; margin-bottom: 12px;">
            <strong>${item.name}</strong> cannot be deleted because it is linked to the following existing records:
          </p>

          <div style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: var(--radius-md); padding: 12px; margin-bottom: 16px;">
            <ul style="margin: 0; padding-left: 20px; font-size: 12px; color: #fca5a5;">
              ${dependencies.details.map(d => `<li style="margin-bottom: 4px;"><strong>${d}</strong></li>`).join('')}
            </ul>
          </div>

          <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 20px;">
            As an Administrator, you can either <strong>Deactivate</strong> this record safely, or <strong>Cascade Delete / Admin Purge</strong> to permanently remove this record along with all its child units, floors, and lines (and detach linked machinery).
          </p>

          <div style="display: flex; justify-content: flex-end; gap: 10px; flex-wrap: wrap;">
            <button id="btn-modal-cancel" class="btn btn-secondary">Cancel</button>
            <button id="btn-modal-deactivate-safe" class="btn btn-secondary" style="font-weight: 700;">
              ⏸️ Deactivate Instead
            </button>
            <button id="btn-modal-cascade-delete" class="btn btn-danger" style="font-weight: 700; background: #ef4444; color: #fff;">
              🔥 Cascade Delete / Purge (Admin)
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // 3. ADD or EDIT MODAL
  const isEdit = activeModalState.type === 'EDIT';
  const entityType = activeModalState.entityType;
  const item = activeModalState.item || {};
  const title = `${isEdit ? 'Edit' : 'Add New'} ${getEntityDisplayName(entityType || (activeTab === 'tree' || activeTab === 'fast-entry' ? 'groups' : activeTab))}`;

  return `
    <div class="modal-overlay" id="master-modal-overlay" style="display: flex; align-items: center; justify-content: center; z-index: 9999;">
      <div class="modal-card" style="max-width: 540px; width: 90%; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 24px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 12px; margin-bottom: 16px;">
          <h3 style="font-size: 16px; font-weight: 800; color: #fff; margin: 0;">${title}</h3>
          <button id="btn-modal-close" style="background: none; border: none; font-size: 18px; color: var(--text-muted); cursor: pointer;">✕</button>
        </div>

        <form id="form-master-entity" style="display: flex; flex-direction: column; gap: 14px; overflow-y: auto; flex: 1; min-height: 0; padding-right: 4px;">
          <!-- Name Field -->
          <div class="form-group">
            <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">${getEntityDisplayName(entityType)} Name *</label>
            <input type="text" id="inp-entity-name" class="form-control" required value="${item.name || ''}" placeholder="${entityType === 'line' ? 'e.g. A, B, Size Set, Eyelet, APW Room...' : 'Enter name...'}" />
          </div>

          <!-- Code Field -->
          <div class="form-group">
            <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Code / Identifier *</label>
            <input type="text" id="inp-entity-code" class="form-control" required value="${item.code || ''}" placeholder="e.g. AMG, FL-01, JUK" />
          </div>

          <!-- Dynamic Parent Selectors based on Level -->
          ${renderParentFormFields(entityType, item)}

          <!-- Status Selector -->
          <div class="form-group">
            <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Status</label>
            <select id="inp-entity-status" class="filter-select">
              <option value="ACTIVE" ${item.status !== 'INACTIVE' ? 'selected' : ''}>ACTIVE (Available in operational dropdowns)</option>
              <option value="INACTIVE" ${item.status === 'INACTIVE' ? 'selected' : ''}>INACTIVE (Hidden from operational dropdowns)</option>
            </select>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 10px; border-top: 1px solid var(--border-color); padding-top: 14px;">
            <button type="button" id="btn-modal-cancel" class="btn btn-secondary">Cancel</button>
            <button type="submit" class="btn btn-primary" style="font-weight: 700; background: linear-gradient(135deg, #0284c7, #0369a1);">
              💾 Save Record
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function renderParentFormFields(type, item) {
  switch (type) {
    case 'unit': {
      const groups = masterDataService.getGroups(true);
      return `
        <div class="form-group">
          <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Parent Group *</label>
          <select id="inp-entity-group" class="filter-select" required>
            <option value="">Select Group...</option>
            ${groups.map(g => `<option value="${g.id}" ${item.groupId === g.id ? 'selected' : ''}>${g.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Factory Complex Location</label>
          <input type="text" id="inp-entity-location" class="form-control" value="${item.location || ''}" placeholder="e.g. Savar, Dhaka" />
        </div>
      `;
    }
    case 'floor': {
      const groups = masterDataService.getGroups(true);
      const curUnit = item.unitId ? masterDataService.getUnitById(item.unitId) : null;
      const initialGroupId = curUnit?.groupId || (groups[0]?.id || '');
      const units = masterDataService.getUnits(initialGroupId, true);

      return `
        <div class="form-group">
          <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">1. Filter by Group</label>
          <select id="inp-entity-floor-group" class="filter-select">
            <option value="">All Groups</option>
            ${groups.map(g => `<option value="${g.id}" ${initialGroupId === g.id ? 'selected' : ''}>${g.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">2. Parent Factory / Unit *</label>
          <select id="inp-entity-unit" class="filter-select" required>
            <option value="">Select Unit...</option>
            ${units.map(u => `<option value="${u.id}" ${item.unitId === u.id ? 'selected' : ''}>${u.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Building Name / Number</label>
          <input type="text" id="inp-entity-building" class="form-control" value="${item.building || ''}" placeholder="e.g. Building 1, Denim Plant" />
        </div>
        <div class="form-group">
          <label class="form-label" style="font-size: 12px; font-weight: 700; color: #38bdf8; display: flex; align-items: center; gap: 6px;">
            <span>🏷️ Floor Sticker Tag / QR Header Name (Admin Customizable)</span>
          </label>
          <input 
            type="text" 
            id="inp-entity-location-tag" 
            class="form-control" 
            value="${item.locationTag || ''}" 
            placeholder="e.g. AKM-TISTA (Shown on top-right of QR stickers)" 
            style="text-transform: uppercase; font-weight: 700; font-size: 13px;"
          />
          <div style="font-size: 11px; color: #94a3b8; margin-top: 4px; line-height: 1.4;">
            💡 <strong>Marked in red on machine QR stickers</strong>: Customize the exact floor text printed on the top-right of stickers (e.g. <strong>AKM-TISTA</strong>). If left empty, it will default automatically to <code>UnitCode-FloorName</code>.
          </div>
        </div>
      `;
    }
    case 'line': {
      const groups = masterDataService.getGroups(true);
      const curFloor = item.floorId ? masterDataService.getFloorById(item.floorId) : null;
      const curUnit = curFloor?.unitId ? masterDataService.getUnitById(curFloor.unitId) : null;
      const initialGroupId = curUnit?.groupId || (groups[0]?.id || '');
      const units = masterDataService.getUnits(initialGroupId, true);
      const initialUnitId = curUnit?.id || (units[0]?.id || '');
      const floors = masterDataService.getFloors(initialUnitId, null, true);

      return `
        <div class="form-group">
          <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">1. Filter by Group</label>
          <select id="inp-entity-line-group" class="filter-select">
            <option value="">All Groups</option>
            ${groups.map(g => `<option value="${g.id}" ${initialGroupId === g.id ? 'selected' : ''}>${g.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">2. Filter by Unit</label>
          <select id="inp-entity-line-unit" class="filter-select">
            <option value="">All Units</option>
            ${units.map(u => `<option value="${u.id}" ${initialUnitId === u.id ? 'selected' : ''}>${u.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">3. Parent Floor *</label>
          <select id="inp-entity-floor" class="filter-select" required>
            <option value="">Select Floor...</option>
            ${floors.map(f => `<option value="${f.id}" ${item.floorId === f.id ? 'selected' : ''}>${f.name}</option>`).join('')}
          </select>
        </div>
      `;
    }
    case 'machinename': {
      const categories = masterDataService.getCategories(true);
      return `
        <div class="form-group">
          <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Category *</label>
          <select id="inp-entity-category" class="filter-select" required>
            ${categories.map(c => `<option value="${c.id}" ${item.categoryId === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Description</label>
          <input type="text" id="inp-entity-desc" class="form-control" value="${item.description || ''}" placeholder="e.g. Single Needle Direct Drive Plain Lockstitch" />
        </div>
      `;
    }
    case 'brand': {
      return `
        <div class="form-group">
          <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Country of Origin</label>
          <input type="text" id="inp-entity-country" class="form-control" value="${item.country || ''}" placeholder="e.g. Japan, Germany, USA, China" />
        </div>
        <div class="form-group">
          <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Official Website</label>
          <input type="text" id="inp-entity-website" class="form-control" value="${item.website || ''}" placeholder="e.g. www.juki.co.jp" />
        </div>
      `;
    }
    case 'model': {
      const machineNames = masterDataService.getMachineNames(null, null, true);
      const brands = masterDataService.getBrands(true);
      return `
        <div class="form-group">
          <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Related Machine Name *</label>
          <select id="inp-entity-mn" class="filter-select" required>
            <option value="">Select Machine Name...</option>
            ${machineNames.map(m => `<option value="${m.id}" ${item.machineNameId === m.id ? 'selected' : ''}>${m.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Brand Manufacturer *</label>
          <select id="inp-entity-brand" class="filter-select" required>
            <option value="">Select Brand...</option>
            ${brands.map(b => `<option value="${b.id}" ${item.brandId === b.id ? 'selected' : ''}>${b.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Technical Description</label>
          <input type="text" id="inp-entity-desc" class="form-control" value="${item.description || ''}" placeholder="e.g. Direct Drive Computer Controlled High Speed" />
        </div>
      `;
    }
    default: {
      return `
        <div class="form-group">
          <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Description</label>
          <input type="text" id="inp-entity-desc" class="form-control" value="${item.description || ''}" placeholder="Optional details..." />
        </div>
      `;
    }
  }
}

export function initMasterDataEvents() {
  const refreshView = () => {
    const view = document.getElementById('main-view-container');
    if (!view) return;

    // Capture exact viewport, page, and inner element scroll positions
    const pageView = document.querySelector('.page-view');
    const appMain = document.querySelector('.app-main');
    const activeEl = document.activeElement;
    const tables = Array.from(document.querySelectorAll('.table-responsive, .excel-grid-container, .excel-grid')).map(el => ({
      el,
      scrollTop: el.scrollTop,
      scrollLeft: el.scrollLeft
    }));

    const savedState = {
      windowY: window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0,
      windowX: window.scrollX || document.documentElement.scrollLeft || document.body.scrollLeft || 0,
      pageViewY: pageView ? pageView.scrollTop : 0,
      pageViewX: pageView ? pageView.scrollLeft : 0,
      containerY: view.scrollTop || 0,
      containerX: view.scrollLeft || 0,
      appMainY: appMain ? appMain.scrollTop : 0,
      appMainX: appMain ? appMain.scrollLeft : 0,
      tables,
      focusedId: activeEl && activeEl.id ? activeEl.id : null,
      selectionStart: activeEl && typeof activeEl.selectionStart === 'number' ? activeEl.selectionStart : null,
      selectionEnd: activeEl && typeof activeEl.selectionEnd === 'number' ? activeEl.selectionEnd : null
    };

    view.innerHTML = renderMasterDataView();
    initMasterDataEvents();

    const restore = () => {
      if (savedState.windowY > 0 || savedState.windowX > 0) {
        window.scrollTo(savedState.windowX, savedState.windowY);
        if (document.documentElement) document.documentElement.scrollTop = savedState.windowY;
        if (document.body) document.body.scrollTop = savedState.windowY;
      }
      const curPageView = document.querySelector('.page-view');
      if (curPageView && savedState.pageViewY > 0) {
        curPageView.scrollTop = savedState.pageViewY;
        curPageView.scrollLeft = savedState.pageViewX;
      }
      if (savedState.containerY > 0) {
        view.scrollTop = savedState.containerY;
        view.scrollLeft = savedState.containerX;
      }
      const curAppMain = document.querySelector('.app-main');
      if (curAppMain && savedState.appMainY > 0) {
        curAppMain.scrollTop = savedState.appMainY;
        curAppMain.scrollLeft = savedState.appMainX;
      }
      const curTables = document.querySelectorAll('.table-responsive, .excel-grid-container, .excel-grid');
      savedState.tables.forEach((t, i) => {
        if (curTables[i] && t.scrollTop > 0) {
          curTables[i].scrollTop = t.scrollTop;
          curTables[i].scrollLeft = t.scrollLeft;
        }
      });
      if (savedState.focusedId) {
        const el = document.getElementById(savedState.focusedId);
        if (el && typeof el.focus === 'function' && document.activeElement !== el) {
          try {
            el.focus({ preventScroll: true });
            if (typeof savedState.selectionStart === 'number' && typeof savedState.selectionEnd === 'number' && typeof el.setSelectionRange === 'function') {
              el.setSelectionRange(savedState.selectionStart, savedState.selectionEnd);
            }
          } catch (_) {}
        }
      }
    };

    restore();
    requestAnimationFrame(restore);
    setTimeout(restore, 20);
    setTimeout(restore, 60);
    setTimeout(restore, 120);
  };

  // 1. Tab Navigation
  document.querySelectorAll('[data-master-tab]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      activeTab = btn.getAttribute('data-master-tab');
      selectedItemIds.clear();
      searchFilter = '';
      parentFilter = '';
      statusFilter = 'ALL';
      refreshView();
    });
  });

  // Fast Cascading Dropdown Listeners
  const fastSelGroup = document.getElementById('fast-sel-group');
  if (fastSelGroup) {
    fastSelGroup.addEventListener('change', (e) => {
      cascadeGroupId = e.target.value;
      cascadeUnitId = '';
      cascadeFloorId = '';
      cascadeLineId = '';
      refreshView();
    });
  }

  const fastSelUnit = document.getElementById('fast-sel-unit');
  if (fastSelUnit) {
    fastSelUnit.addEventListener('change', (e) => {
      cascadeUnitId = e.target.value;
      cascadeFloorId = '';
      cascadeLineId = '';
      refreshView();
    });
  }

  const fastSelFloor = document.getElementById('fast-sel-floor');
  if (fastSelFloor) {
    fastSelFloor.addEventListener('change', (e) => {
      cascadeFloorId = e.target.value;
      cascadeLineId = '';
      if (cascadeFloorId === 'all') {
        step3LineTargetScope = 'ALL_FLOORS';
      } else {
        step3LineTargetScope = 'INDIVIDUAL';
      }
      refreshView();
    });
  }

  const fastSelLine = document.getElementById('fast-sel-line');
  if (fastSelLine) {
    fastSelLine.addEventListener('change', (e) => {
      cascadeLineId = e.target.value;
      refreshView();
    });
  }

  const btnShowAllLines = document.getElementById('btn-show-all-lines');
  if (btnShowAllLines) {
    btnShowAllLines.addEventListener('click', () => {
      cascadeLineId = 'all';
      refreshView();
    });
  }

  // Quick Group Creation (Step 1)
  const btnQuickCreateGroup = document.getElementById('btn-quick-create-group');
  if (btnQuickCreateGroup) {
    btnQuickCreateGroup.addEventListener('click', () => {
      const name = document.getElementById('inp-quick-group-name')?.value?.trim();
      if (!name) {
        notificationService.error('Please type a Group name.');
        return;
      }
      try {
        const created = masterDataService.createGroup({
          name,
          code: name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 4).toUpperCase() || 'GRP',
          status: 'ACTIVE'
        });
        cascadeGroupId = created.id;
        cascadeUnitId = '';
        cascadeFloorId = '';
        cascadeLineId = '';
        notificationService.success(`Group "${created.name}" created and selected!`);
        state.emit('inventory:updated');
        refreshView();
      } catch (err) {
        notificationService.error('Failed to create group: ' + err.message);
      }
    });
  }

  const inpQuickGroupName = document.getElementById('inp-quick-group-name');
  if (inpQuickGroupName) {
    inpQuickGroupName.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('btn-quick-create-group')?.click();
      }
    });
  }

  // Unit Tiles Selection (Step 2)
  document.querySelectorAll('.btn-tile-select-unit').forEach(tile => {
    tile.addEventListener('click', (e) => {
      if (e.target.closest('.btn-tile-edit-unit') || e.target.closest('.btn-tile-delete-unit')) return;
      const id = tile.getAttribute('data-id');
      if (id) {
        cascadeUnitId = id;
        cascadeFloorId = '';
        cascadeLineId = '';
        refreshView();
      }
    });
  });

  // Unit Tile Edit
  document.querySelectorAll('.btn-tile-edit-unit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      if (id) {
        const item = storage.getItem(TABLE_NAMES.UNITS, id);
        if (item) {
          activeModalState = { type: 'EDIT', entityType: 'unit', item };
          refreshView();
        }
      }
    });
  });

  // Unit Tile Delete
  document.querySelectorAll('.btn-tile-delete-unit').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      if (!id) return;
      const item = storage.getItem(TABLE_NAMES.UNITS, id);
      if (!item) return;

      const depCheck = masterDataService.checkDependencies('unit', id);
      if (depCheck.hasDependencies) {
        activeModalState = {
          type: 'DELETE_DEP',
          entityType: 'unit',
          item,
          dependencies: depCheck
        };
        refreshView();
      } else {
        const confirmed = await notificationService.confirm({
          title: 'Delete Unit',
          message: `Are you sure you want to permanently delete Unit <strong>${item.name}</strong>?`,
          icon: '🗑️',
          confirmText: 'Delete Unit',
          isDestructive: true
        });
        if (confirmed) {
          masterDataService.deleteItem('unit', id, false);
          if (cascadeUnitId === id) {
            cascadeUnitId = '';
            cascadeFloorId = '';
            cascadeLineId = '';
          }
          notificationService.success(`Deleted Unit ${item.name}`);
          state.emit('inventory:updated');
          refreshView();
        }
      }
    });
  });

  // Enter key shortcuts for 1-click batch inputs
  const inpBatchUnitsText = document.getElementById('inp-batch-units-text');
  if (inpBatchUnitsText) {
    inpBatchUnitsText.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('btn-save-batch-units')?.click();
      }
    });
  }

  const inpBatchLinesText = document.getElementById('inp-batch-lines-text');
  if (inpBatchLinesText) {
    inpBatchLinesText.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (step3LineTargetScope === 'ALL_FLOORS') {
          document.getElementById('btn-save-batch-lines-all')?.click();
        } else {
          document.getElementById('btn-save-batch-lines-single')?.click();
        }
      }
    });
  }

  // Fast Group Actions
  const btnFastAddGroup = document.getElementById('btn-fast-add-group');
  if (btnFastAddGroup) {
    btnFastAddGroup.addEventListener('click', () => {
      activeModalState = {
        type: 'ADD',
        entityType: 'group',
        item: { status: 'ACTIVE' }
      };
      refreshView();
    });
  }

  const btnFastEditGroup = document.getElementById('btn-fast-edit-group');
  if (btnFastEditGroup) {
    btnFastEditGroup.addEventListener('click', () => {
      if (!cascadeGroupId) return;
      const item = storage.getItem(TABLE_NAMES.GROUPS, cascadeGroupId);
      if (item) {
        activeModalState = {
          type: 'EDIT',
          entityType: 'group',
          item
        };
        refreshView();
      }
    });
  }

  const btnFastDeleteGroup = document.getElementById('btn-fast-delete-group');
  if (btnFastDeleteGroup) {
    btnFastDeleteGroup.addEventListener('click', async () => {
      if (!cascadeGroupId) return;
      const item = storage.getItem(TABLE_NAMES.GROUPS, cascadeGroupId);
      if (!item) return;

      const depCheck = masterDataService.checkDependencies('group', cascadeGroupId);
      if (depCheck.hasDependencies) {
        activeModalState = {
          type: 'DELETE_DEP',
          entityType: 'group',
          item,
          dependencies: depCheck
        };
        refreshView();
      } else {
        const confirmed = await notificationService.confirm({
          title: 'Delete Group',
          message: `Are you sure you want to permanently delete Group <strong>${item.name}</strong>?`,
          icon: '🗑️',
          confirmText: 'Delete Group',
          isDestructive: true
        });
        if (confirmed) {
          masterDataService.deleteItem('group', cascadeGroupId, false);
          cascadeGroupId = '';
          cascadeUnitId = '';
          cascadeFloorId = '';
          notificationService.success(`Deleted Group ${item.name}`);
          state.emit('inventory:updated');
          refreshView();
        }
      }
    });
  }

  // Fast Unit Actions
  const btnFastAddUnit = document.getElementById('btn-fast-add-unit');
  if (btnFastAddUnit) {
    btnFastAddUnit.addEventListener('click', () => {
      activeModalState = {
        type: 'ADD',
        entityType: 'unit',
        item: { groupId: cascadeGroupId, status: 'ACTIVE' }
      };
      refreshView();
    });
  }

  const btnFastEditUnit = document.getElementById('btn-fast-edit-unit');
  if (btnFastEditUnit) {
    btnFastEditUnit.addEventListener('click', () => {
      if (!cascadeUnitId) return;
      const item = storage.getItem(TABLE_NAMES.UNITS, cascadeUnitId);
      if (item) {
        activeModalState = {
          type: 'EDIT',
          entityType: 'unit',
          item
        };
        refreshView();
      }
    });
  }

  const btnFastDeleteUnit = document.getElementById('btn-fast-delete-unit');
  if (btnFastDeleteUnit) {
    btnFastDeleteUnit.addEventListener('click', async () => {
      if (!cascadeUnitId) return;
      const item = storage.getItem(TABLE_NAMES.UNITS, cascadeUnitId);
      if (!item) return;

      const depCheck = masterDataService.checkDependencies('unit', cascadeUnitId);
      if (depCheck.hasDependencies) {
        activeModalState = {
          type: 'DELETE_DEP',
          entityType: 'unit',
          item,
          dependencies: depCheck
        };
        refreshView();
      } else {
        const confirmed = await notificationService.confirm({
          title: 'Delete Unit',
          message: `Are you sure you want to permanently delete Unit <strong>${item.name}</strong>?`,
          icon: '🗑️',
          confirmText: 'Delete Unit',
          isDestructive: true
        });
        if (confirmed) {
          masterDataService.deleteItem('unit', cascadeUnitId, false);
          cascadeUnitId = '';
          cascadeFloorId = '';
          notificationService.success(`Deleted Unit ${item.name}`);
          state.emit('inventory:updated');
          refreshView();
        }
      }
    });
  }

  // Fast Floor Actions
  const btnFastEditFloor = document.getElementById('btn-fast-edit-floor');
  if (btnFastEditFloor) {
    btnFastEditFloor.addEventListener('click', () => {
      const floorId = btnFastEditFloor.getAttribute('data-id') || (cascadeFloorId && cascadeFloorId !== 'all' ? cascadeFloorId : null);
      if (!floorId) {
        notificationService.error('Please select a specific Floor to edit.');
        return;
      }
      const item = storage.getItem(TABLE_NAMES.FLOORS, floorId);
      if (item) {
        activeModalState = {
          type: 'EDIT',
          entityType: 'floor',
          item
        };
        refreshView();
      }
    });
  }

  const btnFastDeleteFloor = document.getElementById('btn-fast-delete-floor');
  if (btnFastDeleteFloor) {
    btnFastDeleteFloor.addEventListener('click', async () => {
      if (!cascadeFloorId || cascadeFloorId === 'all') return;
      const item = storage.getItem(TABLE_NAMES.FLOORS, cascadeFloorId);
      if (!item) return;

      const depCheck = masterDataService.checkDependencies('floor', cascadeFloorId);
      if (depCheck.hasDependencies) {
        activeModalState = {
          type: 'DELETE_DEP',
          entityType: 'floor',
          item,
          dependencies: depCheck
        };
        refreshView();
      } else {
        const confirmed = await notificationService.confirm({
          title: 'Delete Floor',
          message: `Are you sure you want to permanently delete Floor <strong>${item.name}</strong>?`,
          icon: '🗑️',
          confirmText: 'Delete Floor',
          isDestructive: true
        });
        if (confirmed) {
          masterDataService.deleteItem('floor', cascadeFloorId, false);
          cascadeFloorId = '';
          notificationService.success(`Deleted Floor ${item.name}`);
          state.emit('inventory:updated');
          refreshView();
        }
      }
    });
  }

  // Fast Add Floor
  const btnFastAddFloor = document.getElementById('btn-fast-add-floor');
  if (btnFastAddFloor) {
    btnFastAddFloor.addEventListener('click', () => {
      if (!cascadeUnitId) {
        notificationService.error('Please select a Unit first.');
        return;
      }
      activeModalState = {
        type: 'ADD',
        entityType: 'floor',
        item: { unitId: cascadeUnitId, status: 'ACTIVE' }
      };
      refreshView();
    });
  }

  // Fast Quick Floor Preset Buttons (1-Click Selection & Auto-Creation)
  document.querySelectorAll('.btn-quick-floor-preset').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!cascadeUnitId) {
        notificationService.error('Please select a Unit first.');
        return;
      }
      const name = btn.getAttribute('data-name');
      const code = btn.getAttribute('data-code');
      const unitFloors = masterDataService.getFloors(cascadeUnitId, null, true);
      const existing = unitFloors.find(f => (f.code && f.code.toUpperCase() === code.toUpperCase()) || f.name.toLowerCase() === name.toLowerCase());
      if (existing) {
        cascadeFloorId = existing.id;
        cascadeLineId = 'all';
        // Ensure primary line {code}-A exists on this floor
        const flLines = masterDataService.getLines(existing.id, true);
        if (!flLines.some(l => l.name.toUpperCase() === `${code}-A`.toUpperCase())) {
          try {
            masterDataService.createLine({
              floorId: existing.id,
              name: `${code}-A`,
              code: `${code}-A`,
              supervisor: 'Line Incharge'
            });
          } catch (err) {}
        }
        notificationService.info(`Selected ${existing.name} [Code: ${existing.code}]`);
        refreshView();
      } else {
        try {
          const created = masterDataService.createFloor({
            unitId: cascadeUnitId,
            name,
            code,
            building: 'Production Complex'
          });
          cascadeFloorId = created.id;
          cascadeLineId = 'all';
          notificationService.success(`Created & selected floor: ${name} [Code: ${code}] with line ${code}-A`);
          state.emit('inventory:updated');
          refreshView();
        } catch (err) {
          notificationService.error('Failed to create floor: ' + err.message);
        }
      }
    });
  });

  // Fast Line Actions
  const btnFastAddLine = document.getElementById('btn-fast-add-line');
  if (btnFastAddLine) {
    btnFastAddLine.addEventListener('click', () => {
      if (!cascadeUnitId) {
        notificationService.error('Please select a Unit first.');
        return;
      }
      const existingFloors = masterDataService.getFloors(cascadeUnitId, null, true);
      let targetFId = (cascadeFloorId && cascadeFloorId !== 'all') ? cascadeFloorId : (existingFloors[0]?.id || '');
      activeModalState = {
        type: 'ADD',
        entityType: 'line',
        item: { floorId: targetFId, status: 'ACTIVE' }
      };
      refreshView();
    });
  }

  const btnFastEditLine = document.getElementById('btn-fast-edit-line');
  if (btnFastEditLine) {
    btnFastEditLine.addEventListener('click', () => {
      if (!cascadeLineId || cascadeLineId === 'all') return;
      const item = storage.getItem(TABLE_NAMES.LINES, cascadeLineId);
      if (item) {
        activeModalState = {
          type: 'EDIT',
          entityType: 'line',
          item
        };
        refreshView();
      }
    });
  }

  const btnFastDeleteLine = document.getElementById('btn-fast-delete-line');
  if (btnFastDeleteLine) {
    btnFastDeleteLine.addEventListener('click', async () => {
      if (!cascadeLineId || cascadeLineId === 'all') return;
      const item = storage.getItem(TABLE_NAMES.LINES, cascadeLineId);
      if (!item) return;

      const depCheck = masterDataService.checkDependencies('line', cascadeLineId);
      if (depCheck.hasDependencies) {
        activeModalState = {
          type: 'DELETE_DEP',
          entityType: 'line',
          item,
          dependencies: depCheck
        };
        refreshView();
      } else {
        const confirmed = await notificationService.confirm({
          title: 'Delete Line',
          message: `Are you sure you want to permanently delete Line <strong>${item.name}</strong>?`,
          icon: '🗑️',
          confirmText: 'Delete Line',
          isDestructive: true
        });
        if (confirmed) {
          masterDataService.deleteItem('line', cascadeLineId, false);
          cascadeLineId = '';
          notificationService.success(`Deleted Line ${item.name}`);
          state.emit('inventory:updated');
          refreshView();
        }
      }
    });
  }



  // Preset Unit Buttons
  document.querySelectorAll('.btn-unit-preset').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const preset = btn.getAttribute('data-preset');
      const textarea = document.getElementById('inp-batch-units-text');
      if (textarea && preset) {
        if (textarea.value.trim()) {
          textarea.value = textarea.value.trim() + ', ' + preset;
        } else {
          textarea.value = preset;
        }
        textarea.focus({ preventScroll: true });
      }
    });
  });

  // Save Batch Units
  const btnSaveBatchUnits = document.getElementById('btn-save-batch-units');
  if (btnSaveBatchUnits) {
    btnSaveBatchUnits.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const textarea = document.getElementById('inp-batch-units-text');
      const locInput = document.getElementById('inp-batch-units-location');
      const text = textarea?.value?.trim();
      const location = locInput?.value?.trim() || 'Factory Complex';

      if (!cascadeGroupId) {
        notificationService.error('Please select or create a Group first.');
        return;
      }
      if (!text) {
        notificationService.error('Please write at least one Unit name.');
        return;
      }

      try {
        const created = masterDataService.createUnitsBatch(cascadeGroupId, text, location);
        if (created.length > 0) {
          notificationService.success(`Successfully created ${created.length} Units!`);
          if (textarea) textarea.value = '';
          cascadeUnitId = created[0].id;
          cascadeFloorId = '';
          cascadeLineId = '';
          state.emit('inventory:updated');
          refreshView();
        } else {
          notificationService.info('All provided units already exist.');
        }
      } catch (err) {
        notificationService.error('Failed to create units: ' + err.message);
      }
    });
  }

  // Quick Floor Presets
  document.querySelectorAll('.btn-quick-add-floor').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const name = btn.getAttribute('data-name');
      if (!cascadeUnitId) {
        notificationService.error('Please select a Unit first.');
        return;
      }
      try {
        const created = masterDataService.createFloor({ unitId: cascadeUnitId, name });
        notificationService.success(`Created floor ${name}`);
        cascadeFloorId = created.id;
        state.emit('inventory:updated');
        refreshView();
      } catch (err) {
        notificationService.error('Error: ' + err.message);
      }
    });
  });

  // Create Floor Quick from input
  const btnCreateFloorQuick = document.getElementById('btn-create-floor-quick');
  if (btnCreateFloorQuick) {
    btnCreateFloorQuick.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const name = document.getElementById('inp-new-floor-name')?.value?.trim();
      if (!cascadeUnitId) {
        notificationService.error('Please select a Unit first.');
        return;
      }
      if (!name) {
        notificationService.error('Please enter a Floor name.');
        return;
      }
      try {
        const created = masterDataService.createFloor({ unitId: cascadeUnitId, name });
        notificationService.success(`Created floor ${name}`);
        cascadeFloorId = created.id;
        state.emit('inventory:updated');
        refreshView();
      } catch (err) {
        notificationService.error('Error: ' + err.message);
      }
    });
  }

  // Helper function: Live Duplicate Detection & Preview under line input
  const updateLiveDuplicatePreview = () => {
    const input = document.getElementById('inp-batch-lines-text');
    const previewContainer = document.getElementById('batch-lines-live-preview');
    if (!input || !previewContainer) return;

    const val = input.value.trim();
    if (!val) {
      previewContainer.innerHTML = `
        <span style="color: var(--text-muted);">
          💡 Enter line letters or click chips above. Existing lines will automatically be detected and duplicate entries skipped.
        </span>
      `;
      return;
    }

    const isAll = (step3LineTargetScope === 'ALL_FLOORS') || (cascadeFloorId === 'all');
    let targetFloor = (cascadeFloorId && cascadeFloorId !== 'all') 
      ? masterDataService.getFloorById(cascadeFloorId) 
      : (masterDataService.getFloors(cascadeUnitId, null, true)[0] || null);
    const floorCode = (targetFloor?.code || (targetFloor?.name ? targetFloor.name.substring(0, 2) : 'FL')).toUpperCase().trim();

    const currentLines = targetFloor ? masterDataService.getLines(targetFloor.id, null, null, true) : [];
    const existingSet = new Set(currentLines.map(l => (l.name || '').toUpperCase()));
    currentLines.forEach(l => {
      if (l.code) existingSet.add(l.code.toUpperCase());
    });

    const tokens = val.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
    if (tokens.length === 0) {
      previewContainer.innerHTML = `<span style="color: var(--text-muted);">💡 Enter line letters...</span>`;
      return;
    }

    const newItems = [];
    const duplicateItems = [];
    const seenInInput = new Set();

    tokens.forEach(raw => {
      let trimmed = raw.trim();
      let lineName = '';
      try {
        lineName = formatLineName(trimmed, floorCode);
      } catch (err) {
        lineName = `${floorCode}-${trimmed}`;
      }

      const upper = lineName.toUpperCase();
      if (existingSet.has(upper) || seenInInput.has(upper)) {
        duplicateItems.push({ raw: trimmed, targetName: lineName });
      } else {
        seenInInput.add(upper);
        newItems.push({ raw: trimmed, targetName: lineName });
      }
    });

    let html = '';
    if (newItems.length > 0) {
      html += `
        <div style="display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">
          <span style="font-size: 11px; font-weight: 800; color: #34d399;">
            🆕 New to Add (${newItems.length}):
          </span>
          ${newItems.map(item => `
            <span style="background: rgba(16, 185, 129, 0.2); border: 1px solid #10b981; color: #34d399; font-size: 11px; font-weight: 800; padding: 2px 7px; border-radius: 4px;">
              + ${item.targetName}
            </span>
          `).join('')}
        </div>
      `;
    }

    if (duplicateItems.length > 0) {
      html += `
        <div style="display: flex; align-items: center; gap: 4px; flex-wrap: wrap; margin-top: ${newItems.length > 0 ? '4px' : '0'};">
          <span style="font-size: 11px; font-weight: 800; color: #f87171;">
            ⚠️ Already Added / Skipped (${duplicateItems.length}):
          </span>
          ${duplicateItems.map(item => `
            <span style="background: rgba(239, 68, 68, 0.15); border: 1px solid #ef4444; color: #f87171; font-size: 11px; font-weight: 700; padding: 2px 7px; border-radius: 4px; text-decoration: line-through;" title="Already configured on this floor - will be skipped automatically">
              ${item.targetName}
            </span>
          `).join('')}
          <span style="font-size: 10.5px; color: #fbbf24; font-style: italic; margin-left: 4px;">
            (Duplicate protection active: duplicate entries will be skipped!)
          </span>
        </div>
      `;
    }

    if (newItems.length === 0 && duplicateItems.length > 0) {
      html += `
        <div style="width: 100%; font-size: 11.5px; color: #fbbf24; font-weight: 700; margin-top: 4px;">
          🚫 Notice: All entered lines already exist. Nothing new will be created if submitted.
        </div>
      `;
    }

    previewContainer.innerHTML = html;
  };

  // Real-time input listener on batch lines text
  const liveInpBatchLinesText = document.getElementById('inp-batch-lines-text');
  if (liveInpBatchLinesText) {
    liveInpBatchLinesText.addEventListener('input', () => {
      updateLiveDuplicatePreview();
    });
    updateLiveDuplicatePreview();
  }

  // Interactive Visual Matrix Letter Chips
  document.querySelectorAll('.btn-matrix-letter-chip').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const letter = btn.getAttribute('data-letter');
      const isAdded = btn.getAttribute('data-added') === 'true';
      const textarea = document.getElementById('inp-batch-lines-text');
      
      if (isAdded) {
        notificationService.info(`Line "${letter}" is already configured on this floor. Duplicate entry is blocked.`);
        return;
      }

      if (textarea && letter) {
        if (textarea.value.trim()) {
          textarea.value = textarea.value.trim().replace(/,\s*$/, '') + ', ' + letter;
        } else {
          textarea.value = letter;
        }
        updateLiveDuplicatePreview();
        textarea.focus({ preventScroll: true });
        notificationService.info(`Queued Line "${letter}" to batch`);
      }
    });
  });

  // Interactive Visual Matrix Section Chips
  document.querySelectorAll('.btn-matrix-section-chip').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const val = btn.getAttribute('data-val');
      const isAdded = btn.getAttribute('data-added') === 'true';
      const textarea = document.getElementById('inp-batch-lines-text');

      if (isAdded) {
        notificationService.info(`Section "${val}" is already configured on this floor. Duplicate entry is blocked.`);
        return;
      }

      if (textarea && val) {
        if (textarea.value.trim()) {
          textarea.value = textarea.value.trim().replace(/,\s*$/, '') + ', ' + val;
        } else {
          textarea.value = val;
        }
        updateLiveDuplicatePreview();
        textarea.focus({ preventScroll: true });
        notificationService.info(`Queued Section "${val}" to batch`);
      }
    });
  });

  // Smart Fill Button: Populate only missing lines
  const btnFillMissingLines = document.getElementById('btn-fill-missing-lines');
  if (btnFillMissingLines) {
    btnFillMissingLines.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const missing = btnFillMissingLines.getAttribute('data-missing')?.trim();
      const textarea = document.getElementById('inp-batch-lines-text');
      if (!missing) {
        notificationService.info('All lines from A through Z are already configured on this floor! No missing lines.');
        return;
      }

      if (textarea) {
        textarea.value = missing;
        updateLiveDuplicatePreview();
        textarea.focus({ preventScroll: true });
        const count = missing.split(',').length;
        notificationService.success(`Populated ${count} missing line(s) (${missing})! Click Add to save.`);
      }
    });
  }

  // Clear Input Button
  const btnClearLinesInput = document.getElementById('btn-clear-lines-input');
  if (btnClearLinesInput) {
    btnClearLinesInput.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const textarea = document.getElementById('inp-batch-lines-text');
      if (textarea) {
        textarea.value = '';
        updateLiveDuplicatePreview();
        textarea.focus({ preventScroll: true });
      }
    });
  }

  // Standard Garments Lines Generator: A through N, P (15 lines, skips O)
  const btnQuickGenAtP = document.getElementById('btn-quick-gen-atp');
  if (btnQuickGenAtP) {
    btnQuickGenAtP.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const textarea = document.getElementById('inp-batch-lines-text');
      if (textarea) {
        const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'P'];
        textarea.value = letters.join(', ');
        updateLiveDuplicatePreview();
        textarea.focus({ preventScroll: true });
        notificationService.success('Filled Standard Garments Lines A through N, P (15 lines)!');
      }
    });
  }

  // Quick Line Generators (1-Click Fill - Alphabetic A to Z and Named Sections)
  const btnQuickGenAtoZ = document.getElementById('btn-quick-gen-atoz');
  if (btnQuickGenAtoZ) {
    btnQuickGenAtoZ.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const textarea = document.getElementById('inp-batch-lines-text');
      if (textarea) {
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
        textarea.value = letters.join(', ');
        updateLiveDuplicatePreview();
        textarea.focus({ preventScroll: true });
        notificationService.success('Filled A through Z (26 lines)! Duplicate checking active.');
      }
    });
  }

  const btnQuickGenAtoJ = document.getElementById('btn-quick-gen-atoj');
  if (btnQuickGenAtoJ) {
    btnQuickGenAtoJ.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const textarea = document.getElementById('inp-batch-lines-text');
      if (textarea) {
        textarea.value = 'A, B, C, D, E, F, G, H, I, J';
        updateLiveDuplicatePreview();
        textarea.focus({ preventScroll: true });
        notificationService.success('Filled A through J (10 lines)!');
      }
    });
  }

  const btnQuickGenKtoT = document.getElementById('btn-quick-gen-ktot');
  if (btnQuickGenKtoT) {
    btnQuickGenKtoT.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const textarea = document.getElementById('inp-batch-lines-text');
      if (textarea) {
        textarea.value = 'K, L, M, N, O, P, Q, R, S, T';
        updateLiveDuplicatePreview();
        textarea.focus({ preventScroll: true });
        notificationService.success('Filled K through T (10 lines)!');
      }
    });
  }

  const btnQuickGenUtoZ = document.getElementById('btn-quick-gen-utoz');
  if (btnQuickGenUtoZ) {
    btnQuickGenUtoZ.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const textarea = document.getElementById('inp-batch-lines-text');
      if (textarea) {
        textarea.value = 'U, V, W, X, Y, Z';
        updateLiveDuplicatePreview();
        textarea.focus({ preventScroll: true });
        notificationService.success('Filled U through Z (6 lines)!');
      }
    });
  }

  // Quick Append Line Sections (+ Cutting, + Finishing, + Sample, + Idle)
  document.querySelectorAll('.btn-quick-append-line').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const val = btn.getAttribute('data-val');
      const textarea = document.getElementById('inp-batch-lines-text');
      if (textarea && val) {
        if (textarea.value.trim()) {
          textarea.value = textarea.value.trim().replace(/,\s*$/, '') + ', ' + val;
        } else {
          textarea.value = val;
        }
        updateLiveDuplicatePreview();
        textarea.focus({ preventScroll: true });
        notificationService.info(`Added "${val}" to line batch`);
      }
    });
  });

  // Dual Line Creation System: Scope Selectors
  const btnScopeIndividual = document.getElementById('btn-scope-individual');
  if (btnScopeIndividual) {
    btnScopeIndividual.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      step3LineTargetScope = 'INDIVIDUAL';
      if (cascadeFloorId === 'all') {
        const unitFloors = masterDataService.getFloors(cascadeUnitId, null, true);
        if (unitFloors.length > 0) {
          cascadeFloorId = unitFloors[0].id;
        }
      }
      refreshView();
    });
  }

  const btnScopeAllFloors = document.getElementById('btn-scope-all-floors');
  if (btnScopeAllFloors) {
    btnScopeAllFloors.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      step3LineTargetScope = 'ALL_FLOORS';
      cascadeFloorId = 'all';
      refreshView();
    });
  }

  // System 1: Save Batch Lines for Individual Floor
  const btnSaveBatchLinesSingle = document.getElementById('btn-save-batch-lines-single');
  if (btnSaveBatchLinesSingle) {
    btnSaveBatchLinesSingle.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!cascadeUnitId) {
        notificationService.error('Please select a Unit first.');
        return;
      }

      const text = document.getElementById('inp-batch-lines-text')?.value?.trim();
      if (!text) {
        notificationService.error('Please enter line names or letters (e.g. A to Z or A, B, C...)');
        return;
      }

      let targetFloorId = '';
      if (cascadeFloorId && cascadeFloorId !== 'all') {
        targetFloorId = cascadeFloorId;
      } else {
        const existingFloors = masterDataService.getFloors(cascadeUnitId, null, true);
        if (existingFloors.length > 0) {
          targetFloorId = existingFloors[0].id;
        } else {
          try {
            const autoFloor = masterDataService.createFloor({ unitId: cascadeUnitId, name: 'Ground Floor' });
            targetFloorId = autoFloor.id;
            cascadeFloorId = autoFloor.id;
          } catch (err) {
            notificationService.error('Error creating default floor: ' + err.message);
            return;
          }
        }
      }

      const targetFloor = masterDataService.getFloorById(targetFloorId);
      try {
        const created = masterDataService.createLinesBatch(targetFloorId, text);
        const skippedCount = created.skippedLines ? created.skippedLines.length : 0;
        if (created.length > 0) {
          let successMsg = `Successfully created ${created.length} new Line(s) for ${targetFloor?.name || 'Floor'} [${targetFloor?.code || 'FL'}]!`;
          if (skippedCount > 0) {
            successMsg += ` (${skippedCount} duplicate line(s) skipped: ${created.skippedLines.join(', ')})`;
          }
          notificationService.success(successMsg);
          const textEl = document.getElementById('inp-batch-lines-text');
          if (textEl) textEl.value = '';
          cascadeFloorId = targetFloorId;
          cascadeLineId = 'all';
          state.emit('inventory:updated');
          refreshView();
        } else {
          const skippedMsg = skippedCount > 0
            ? `All ${skippedCount} entered line(s) already exist on ${targetFloor?.name || 'this floor'} (${created.skippedLines.join(', ')}). No duplicate lines created.`
            : `All provided line names already exist on floor ${targetFloor?.name || ''}.`;
          notificationService.info(skippedMsg);
        }
      } catch (err) {
        notificationService.error('Failed to create lines: ' + err.message);
      }
    });
  }

  // System 2: Save Batch Lines for ALL Floors at Once (1-Click Multi-Floor)
  const btnSaveBatchLinesAll = document.getElementById('btn-save-batch-lines-all');
  if (btnSaveBatchLinesAll) {
    btnSaveBatchLinesAll.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!cascadeUnitId) {
        notificationService.error('Please select a Unit first.');
        return;
      }

      const text = document.getElementById('inp-batch-lines-text')?.value?.trim();
      if (!text) {
        notificationService.error('Please enter line names or letters (e.g. A to Z or A, B, C...)');
        return;
      }

      const unit = masterDataService.getUnitById(cascadeUnitId);
      const unitFloors = masterDataService.getFloors(cascadeUnitId, null, true);
      if (unitFloors.length === 0) {
        notificationService.error('No floors exist in this unit. Please create a floor first.');
        return;
      }

      try {
        const res = masterDataService.createLinesBatchForAllFloors(cascadeUnitId, text);
        if (res.totalCreated > 0) {
          const activeFloorsCount = res.results.filter(r => r.count > 0).length;
          let successMsg = `🎉 Created ${res.totalCreated} Lines across ${activeFloorsCount} Floors in ${unit?.name || 'Unit'}!`;
          if (res.totalSkipped > 0) {
            successMsg += ` (${res.totalSkipped} duplicate line instances skipped across floors)`;
          }
          notificationService.success(successMsg);
          const textEl = document.getElementById('inp-batch-lines-text');
          if (textEl) textEl.value = '';
          cascadeFloorId = 'all';
          cascadeLineId = 'all';
          step3LineTargetScope = 'ALL_FLOORS';
          state.emit('inventory:updated');
          refreshView();
        } else {
          notificationService.info(`All provided lines already exist across all floors in ${unit?.name || 'this unit'} (${res.totalSkipped} duplicates skipped). No duplicate lines created.`);
        }
      } catch (err) {
        notificationService.error('Failed to create lines across all floors: ' + err.message);
      }
    });
  }

  // Generic Save Batch Lines alias
  const btnSaveBatchLines = document.getElementById('btn-save-batch-lines');
  if (btnSaveBatchLines) {
    btnSaveBatchLines.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (step3LineTargetScope === 'ALL_FLOORS' || cascadeFloorId === 'all') {
        document.getElementById('btn-save-batch-lines-all')?.click();
      } else {
        document.getElementById('btn-save-batch-lines-single')?.click();
      }
    });
  }

  // 2. Search Filter Input
  const inpSearch = document.getElementById('inp-master-search');
  if (inpSearch) {
    inpSearch.addEventListener('input', (e) => {
      searchFilter = e.target.value;
      refreshView();
    });
  }

  // 3. Parent Filter Select
  const selParent = document.getElementById('sel-master-parent-filter');
  if (selParent) {
    selParent.addEventListener('change', (e) => {
      parentFilter = e.target.value;
      refreshView();
    });
  }

  // 4. Status Filter Select
  const selStatus = document.getElementById('sel-master-status-filter');
  if (selStatus) {
    selStatus.addEventListener('change', (e) => {
      statusFilter = e.target.value;
      refreshView();
    });
  }

  // 5. Clear Filters Button
  const btnClearFilters = document.getElementById('btn-master-clear-filters');
  if (btnClearFilters) {
    btnClearFilters.addEventListener('click', () => {
      searchFilter = '';
      parentFilter = '';
      statusFilter = 'ALL';
      refreshView();
    });
  }

  // 6. Checkbox Row Selection for Master Tables
  const chkAll = document.getElementById('chk-master-select-all');
  if (chkAll) {
    chkAll.addEventListener('change', (e) => {
      if (e.target.checked) {
        document.querySelectorAll('.chk-master-row').forEach(c => {
          const id = c.getAttribute('data-id');
          if (id) selectedItemIds.add(id);
        });
      } else {
        selectedItemIds.clear();
      }
      refreshView();
    });
  }

  document.querySelectorAll('.chk-master-row').forEach(c => {
    c.addEventListener('change', (e) => {
      e.stopPropagation();
      const id = e.target.getAttribute('data-id');
      if (e.target.checked) selectedItemIds.add(id);
      else selectedItemIds.delete(id);
      refreshView();
    });
  });

  const btnMasterSelectAll = document.getElementById('btn-master-select-all-btn');
  if (btnMasterSelectAll) {
    btnMasterSelectAll.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('.chk-master-row').forEach(c => {
        const id = c.getAttribute('data-id');
        if (id) selectedItemIds.add(id);
      });
      refreshView();
    });
  }

  const btnMasterDeselectAll = document.getElementById('btn-master-deselect-all');
  if (btnMasterDeselectAll) {
    btnMasterDeselectAll.addEventListener('click', (e) => {
      e.stopPropagation();
      selectedItemIds.clear();
      refreshView();
    });
  }

  // Checkbox Selection for Step 3 Lines Table
  const chkStep3All = document.getElementById('chk-step3-select-all');
  if (chkStep3All) {
    chkStep3All.addEventListener('change', (e) => {
      if (e.target.checked) {
        document.querySelectorAll('.chk-step3-line-row').forEach(c => {
          const id = c.getAttribute('data-id');
          if (id) selectedStep3LineIds.add(id);
        });
      } else {
        selectedStep3LineIds.clear();
      }
      refreshView();
    });
  }

  document.querySelectorAll('.chk-step3-line-row').forEach(c => {
    c.addEventListener('change', (e) => {
      e.stopPropagation();
      const id = e.target.getAttribute('data-id');
      if (e.target.checked) selectedStep3LineIds.add(id);
      else selectedStep3LineIds.delete(id);
      refreshView();
    });
  });

  const btnStep3SelectAll = document.getElementById('btn-step3-select-all-btn');
  if (btnStep3SelectAll) {
    btnStep3SelectAll.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('.chk-step3-line-row').forEach(c => {
        const id = c.getAttribute('data-id');
        if (id) selectedStep3LineIds.add(id);
      });
      refreshView();
    });
  }

  const btnStep3Deselect = document.getElementById('btn-step3-deselect');
  if (btnStep3Deselect) {
    btnStep3Deselect.addEventListener('click', (e) => {
      e.stopPropagation();
      selectedStep3LineIds.clear();
      refreshView();
    });
  }

  const btnStep3BulkDelete = document.getElementById('btn-step3-bulk-delete');
  if (btnStep3BulkDelete) {
    btnStep3BulkDelete.addEventListener('click', async (e) => {
      e.stopPropagation();
      const count = selectedStep3LineIds.size;
      if (count === 0) return;

      const confirmed = await notificationService.confirm({
        title: `🗑️ Delete ${count} Selected Line${count > 1 ? 's' : ''}`,
        message: `Are you sure you want to <strong>permanently delete</strong> the <strong>${count}</strong> selected line(s)?<br><br><span style="color: #f87171; font-size: 12px;">⚠️ Any machinery currently allocated to these lines will be safely detached to unallocated standby inventory.</span>`,
        icon: '🗑️',
        confirmText: `Permanently Delete (${count})`,
        isDestructive: true
      });

      if (confirmed) {
        masterDataService.bulkCascadeDelete('line', Array.from(selectedStep3LineIds));
        notificationService.success(`Successfully deleted ${count} line(s)!`);
        selectedStep3LineIds.clear();
        state.emit('inventory:updated');
        refreshView();
      }
    });
  }

  // 7. Add New Button
  const btnAddNew = document.getElementById('btn-master-add-new');
  if (btnAddNew) {
    btnAddNew.addEventListener('click', () => {
      activeModalState = {
        type: 'ADD',
        entityType: getEntityType(activeTab === 'tree' ? 'groups' : activeTab),
        item: { status: 'ACTIVE' }
      };
      refreshView();
    });
  }

  const btnTreeAddGroup = document.getElementById('btn-tree-add-group');
  if (btnTreeAddGroup) {
    btnTreeAddGroup.addEventListener('click', () => {
      activeModalState = {
        type: 'ADD',
        entityType: 'group',
        item: { status: 'ACTIVE' }
      };
      refreshView();
    });
  }

  // 8. ON/OFF Toggle Status Button (Explicit, Click-Isolated)
  document.querySelectorAll('.btn-master-toggle').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const type = btn.getAttribute('data-type');
      const id = btn.getAttribute('data-id');
      try {
        const newStatus = masterDataService.toggleStatus(type, id);
        notificationService.success(`Status changed to ${newStatus}`);
        state.emit('inventory:updated');
        refreshView();
      } catch (err) {
        notificationService.error('Failed to change status: ' + err.message);
      }
    });
  });

  // 9. View Details Button
  document.querySelectorAll('.btn-master-view').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const type = btn.getAttribute('data-type');
      const id = btn.getAttribute('data-id');
      const table = masterDataService._getTableForType(type);
      const item = storage.getItem(table, id);
      if (item) {
        activeModalState = {
          type: 'VIEW',
          entityType: type,
          item: { ...item }
        };
        refreshView();
      }
    });
  });

  // Direct Edit from View Modal
  const btnViewEditDirect = document.getElementById('btn-view-edit-direct');
  if (btnViewEditDirect) {
    btnViewEditDirect.addEventListener('click', (e) => {
      e.stopPropagation();
      const type = btnViewEditDirect.getAttribute('data-type');
      const id = btnViewEditDirect.getAttribute('data-id');
      const table = masterDataService._getTableForType(type);
      const item = storage.getItem(table, id);
      if (item) {
        activeModalState = {
          type: 'EDIT',
          entityType: type,
          item: { ...item }
        };
        refreshView();
      }
    });
  }

  // 10. Edit Button
  document.querySelectorAll('.btn-master-edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const type = btn.getAttribute('data-type');
      const id = btn.getAttribute('data-id');
      const table = masterDataService._getTableForType(type);
      const item = storage.getItem(table, id);
      if (item) {
        activeModalState = {
          type: 'EDIT',
          entityType: type,
          item: { ...item }
        };
        refreshView();
      }
    });
  });

  // 11. Delete Button (Triggers Dependency Check)
  document.querySelectorAll('.btn-master-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const type = btn.getAttribute('data-type');
      const id = btn.getAttribute('data-id');

      const table = masterDataService._getTableForType(type);
      const item = storage.getItem(table, id);
      if (!item) return;

      const depCheck = masterDataService.checkDependencies(type, id);
      if (depCheck.hasDependencies) {
        activeModalState = {
          type: 'DELETE_DEP',
          entityType: type,
          item: item,
          dependencies: depCheck
        };
        refreshView();
      } else {
        const confirmed = await notificationService.confirm({
          title: `Delete ${getEntityDisplayName(type)}`,
          message: `Are you sure you want to permanently delete <strong>${item.name}</strong>? This action cannot be undone.`,
          icon: '🗑️',
          confirmText: 'Delete Record',
          isDestructive: true
        });

        if (confirmed) {
          masterDataService.cascadeDelete(type, id);
          selectedItemIds.delete(id);
          notificationService.success(`Deleted ${item.name}`);
          state.emit('inventory:updated');
          refreshView();
        }
      }
    });
  });

  // 12. Bulk Actions
  const btnBulkAct = document.getElementById('btn-master-bulk-activate');
  if (btnBulkAct) {
    btnBulkAct.addEventListener('click', (e) => {
      e.stopPropagation();
      const type = getEntityType(activeTab);
      masterDataService.bulkToggleStatus(type, Array.from(selectedItemIds), 'ACTIVE');
      notificationService.success(`Activated ${selectedItemIds.size} records`);
      selectedItemIds.clear();
      state.emit('inventory:updated');
      refreshView();
    });
  }

  const btnBulkDeact = document.getElementById('btn-master-bulk-deactivate');
  if (btnBulkDeact) {
    btnBulkDeact.addEventListener('click', (e) => {
      e.stopPropagation();
      const type = getEntityType(activeTab);
      masterDataService.bulkToggleStatus(type, Array.from(selectedItemIds), 'INACTIVE');
      notificationService.success(`Deactivated ${selectedItemIds.size} records`);
      selectedItemIds.clear();
      state.emit('inventory:updated');
      refreshView();
    });
  }

  const btnBulkDel = document.getElementById('btn-master-bulk-delete');
  if (btnBulkDel) {
    btnBulkDel.addEventListener('click', async (e) => {
      e.stopPropagation();
      const type = getEntityType(activeTab);
      const count = selectedItemIds.size;
      if (count === 0) return;
      const entityLabel = getEntityDisplayName(activeTab);

      const confirmed = await notificationService.confirm({
        title: `🗑️ Permanently Delete ${count} Selected ${entityLabel}${count > 1 ? 's' : ''}`,
        message: `Are you sure you want to <strong>permanently delete</strong> the <strong>${count}</strong> selected ${entityLabel}(s) from the database?<br><br><span style="color: #f87171; font-size: 12px;">⚠️ Any allocated machinery will be safely detached to unassigned status, and child records will be cleanly removed.</span>`,
        icon: '🗑️',
        confirmText: `Permanently Delete (${count})`,
        isDestructive: true
      });

      if (confirmed) {
        try {
          masterDataService.bulkCascadeDelete(type, Array.from(selectedItemIds));
          notificationService.success(`Permanently deleted ${count} ${entityLabel}(s) successfully!`);
          selectedItemIds.clear();
          state.emit('inventory:updated');
          refreshView();
        } catch (err) {
          notificationService.error('Failed to delete records: ' + err.message);
        }
      }
    });
  }

  // 13. Modal Close / Cancel
  const btnModalClose = document.getElementById('btn-modal-close');
  const btnModalCancel = document.getElementById('btn-modal-cancel');
  const overlay = document.getElementById('master-modal-overlay');

  const closeModal = () => {
    activeModalState = null;
    refreshView();
  };

  if (btnModalClose) btnModalClose.addEventListener('click', closeModal);
  if (btnModalCancel) btnModalCancel.addEventListener('click', closeModal);
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
  }

  // Deactivate Safe button from Dependency Dialog
  const btnDeactSafe = document.getElementById('btn-modal-deactivate-safe');
  if (btnDeactSafe && activeModalState) {
    btnDeactSafe.addEventListener('click', () => {
      const { entityType, item } = activeModalState;
      masterDataService.toggleStatus(entityType, item.id);
      activeModalState = null;
      notificationService.success(`Deactivated ${item.name}`);
      state.emit('inventory:updated');
      refreshView();
    });
  }

  // Cascade Delete / Force Purge button from Dependency Dialog
  const btnCascadeDel = document.getElementById('btn-modal-cascade-delete');
  if (btnCascadeDel && activeModalState) {
    btnCascadeDel.addEventListener('click', () => {
      const { entityType, item } = activeModalState;
      masterDataService.cascadeDelete(entityType, item.id);
      activeModalState = null;
      if (entityType === 'group' && cascadeGroupId === item.id) {
        cascadeGroupId = '';
        cascadeUnitId = '';
        cascadeFloorId = '';
      } else if (entityType === 'unit' && cascadeUnitId === item.id) {
        cascadeUnitId = '';
        cascadeFloorId = '';
      } else if (entityType === 'floor' && cascadeFloorId === item.id) {
        cascadeFloorId = '';
      }
      notificationService.success(`Permanently deleted ${item.name} and unlinked child assets.`);
      state.emit('inventory:updated');
      refreshView();
    });
  }

  // 14. Cascading in Floor Modal (Group -> Unit)
  const floorGroupSel = document.getElementById('inp-entity-floor-group');
  const floorUnitSel = document.getElementById('inp-entity-unit');
  if (floorGroupSel && floorUnitSel) {
    floorGroupSel.addEventListener('change', () => {
      const units = masterDataService.getUnits(floorGroupSel.value || null, true);
      floorUnitSel.innerHTML = '<option value="">Select Unit...</option>' + units.map(u => `<option value="${u.id}">${u.name}</option>`).join('');
    });
  }

  // 15. Cascading in Line Modal (Group -> Unit -> Floor)
  const lineGroupSel = document.getElementById('inp-entity-line-group');
  const lineUnitSel = document.getElementById('inp-entity-line-unit');
  const lineFloorSel = document.getElementById('inp-entity-floor');
  if (lineGroupSel && lineUnitSel && lineFloorSel) {
    lineGroupSel.addEventListener('change', () => {
      const units = masterDataService.getUnits(lineGroupSel.value || null, true);
      lineUnitSel.innerHTML = '<option value="">Select Unit...</option>' + units.map(u => `<option value="${u.id}">${u.name}</option>`).join('');
      lineUnitSel.dispatchEvent(new Event('change'));
    });

    lineUnitSel.addEventListener('change', () => {
      const floors = masterDataService.getFloors(lineUnitSel.value || null, lineGroupSel.value || null, true);
      lineFloorSel.innerHTML = '<option value="">Select Floor...</option>' + floors.map(f => `<option value="${f.id}">${f.name}</option>`).join('');
    });
  }

  // 16. Form Submit Handler (Add / Edit)
  const form = document.getElementById('form-master-entity');
  if (form && activeModalState) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const entityType = activeModalState.entityType;
      const isEdit = activeModalState.type === 'EDIT';
      const existingId = activeModalState.item?.id;

      const name = document.getElementById('inp-entity-name')?.value?.trim();
      const code = document.getElementById('inp-entity-code')?.value?.trim();
      const status = document.getElementById('inp-entity-status')?.value || 'ACTIVE';

      if (!name) {
        notificationService.error('Name is required');
        return;
      }

      const payload = { name, code, status };

      // Append level-specific parent fields
      if (entityType === 'unit') {
        payload.groupId = document.getElementById('inp-entity-group')?.value;
        payload.location = document.getElementById('inp-entity-location')?.value?.trim();
        if (!payload.groupId) {
          notificationService.error('Parent Group is required');
          return;
        }
      } else if (entityType === 'floor') {
        payload.unitId = document.getElementById('inp-entity-unit')?.value;
        payload.building = document.getElementById('inp-entity-building')?.value?.trim();
        payload.locationTag = document.getElementById('inp-entity-location-tag')?.value?.trim().toUpperCase() || '';
        if (!payload.unitId) {
          notificationService.error('Parent Unit is required');
          return;
        }
      } else if (entityType === 'line') {
        payload.floorId = document.getElementById('inp-entity-floor')?.value;
        payload.supervisor = '';
        if (!payload.floorId) {
          notificationService.error('Parent Floor is required');
          return;
        }
      } else if (entityType === 'machinename') {
        payload.categoryId = document.getElementById('inp-entity-category')?.value;
        payload.description = document.getElementById('inp-entity-desc')?.value?.trim();
      } else if (entityType === 'brand') {
        payload.country = document.getElementById('inp-entity-country')?.value?.trim();
        payload.website = document.getElementById('inp-entity-website')?.value?.trim();
      } else if (entityType === 'model') {
        payload.machineNameId = document.getElementById('inp-entity-mn')?.value;
        payload.brandId = document.getElementById('inp-entity-brand')?.value;
        payload.description = document.getElementById('inp-entity-desc')?.value?.trim();
        if (!payload.machineNameId || !payload.brandId) {
          notificationService.error('Machine Name and Brand are required');
          return;
        }
      }

      try {
        if (isEdit) {
          switch (entityType) {
            case 'group': masterDataService.updateGroup(existingId, payload); break;
            case 'unit': masterDataService.updateUnit(existingId, payload); break;
            case 'floor': masterDataService.updateFloor(existingId, payload); break;
            case 'line': masterDataService.updateLine(existingId, payload); break;
            case 'machinename': masterDataService.updateMachineName(existingId, payload); break;
            case 'brand': masterDataService.updateBrand(existingId, payload); break;
            case 'model': masterDataService.updateModel(existingId, payload); break;
          }
          notificationService.success(`Updated ${name}`);
        } else {
          switch (entityType) {
            case 'group': masterDataService.createGroup(payload); break;
            case 'unit': masterDataService.createUnit(payload); break;
            case 'floor': masterDataService.createFloor(payload); break;
            case 'line': masterDataService.createLine(payload); break;
            case 'machinename': masterDataService.createMachineName(payload); break;
            case 'brand': masterDataService.createBrand(payload); break;
            case 'model': masterDataService.createModel(payload); break;
          }
          notificationService.success(`Created ${name}`);
        }

        activeModalState = null;
        state.emit('inventory:updated');
        refreshView();
      } catch (err) {
        notificationService.error('Error saving record: ' + err.message);
      }
    });
  }
}
