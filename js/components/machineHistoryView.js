/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Machine Complete History & Spare Parts Tracking Dashboard
 * Search by Machine Serial Number Only (No Model or Asset ID Required)
 * Permanent Location Movement Trail, Service & Repair Logs, Spare Parts Replacements & Printable Passport
 */

import { storage } from '../db/storage.js';
import { TABLE_NAMES, ACTIVITY_TYPES, SERVICE_TYPES } from '../db/schema.js';
import { historyService } from '../services/historyService.js';
import { authService } from '../services/authService.js';
import { masterDataService } from '../services/masterDataService.js';
import { employeeService } from '../services/employeeService.js';
import { notificationService } from '../services/notificationService.js';
import { etLabService } from '../services/etLabService.js';
import { state } from '../state.js';

// Local view state
let searchedSerial = ''; // Default to empty (no auto-selected machine)
let historySelectedGroupId = 'ALL';
let historySelectedUnitId = 'ALL';
let historySelectedFloorId = 'ALL';
let historySelectedLineId = 'ALL';
let activeTab = 'timeline'; // 'timeline', 'locations', 'service-repairs', 'spare-parts', 'admin-log'
let serviceTypeFilter = 'ALL'; // 'ALL', 'REPAIR', 'SERVICING', 'PREVENTIVE_MAINTENANCE', 'BREAKDOWN'
let historyFilters = {
  startDate: '',
  endDate: '',
  actionType: 'ALL',
  search: ''
};

export function renderMachineHistoryView() {
  const allMachines = storage.getTable(TABLE_NAMES.MACHINES) || [];
  const allGroups = masterDataService.getGroups(true);
  const allUnits = masterDataService.getUnits(null, true);
  const allFloors = masterDataService.getFloors(null, null, true);
  const allLines = masterDataService.getLines(null, null, null, true);
  
  // Real-time live counts per Unit and per Floor directly from Master Data
  const unitMachineCounts = {};
  const floorMachineCounts = {};
  allMachines.forEach(m => {
    if (m.unitId) unitMachineCounts[m.unitId] = (unitMachineCounts[m.unitId] || 0) + 1;
    if (m.floorId) floorMachineCounts[m.floorId] = (floorMachineCounts[m.floorId] || 0) + 1;
  });

  // If global activeMachineId is set, sync searchedSerial
  const globalActiveId = state.get('activeMachineId');
  if (globalActiveId && globalActiveId !== 'ALL') {
    const matched = storage.getItem(TABLE_NAMES.MACHINES, globalActiveId);
    if (matched && matched.serialNumber) {
      searchedSerial = matched.serialNumber;
    }
    state.set('activeMachineId', null); // Consumed once, reset
  }

  // Look up machine strictly by Machine Serial Number if provided
  let matchedMachine = searchedSerial ? historyService.findMachineBySerialOnly(searchedSerial) : null;

  // Enrich matched machine details using Master Data
  let enrichedMachine = null;
  if (matchedMachine) {
    const grp = storage.getItem(TABLE_NAMES.GROUPS, matchedMachine.groupId) || masterDataService.getGroupById(matchedMachine.groupId);
    const unt = storage.getItem(TABLE_NAMES.UNITS, matchedMachine.unitId) || masterDataService.getUnitById(matchedMachine.unitId);
    const flr = storage.getItem(TABLE_NAMES.FLOORS, matchedMachine.floorId) || masterDataService.getFloorById(matchedMachine.floorId);
    const lin = storage.getItem(TABLE_NAMES.LINES, matchedMachine.lineId) || masterDataService.getLineById(matchedMachine.lineId);
    const mn = storage.getItem(TABLE_NAMES.MACHINE_NAMES, matchedMachine.machineNameId) || masterDataService.getMachineNameById(matchedMachine.machineNameId);
    const brd = storage.getItem(TABLE_NAMES.BRANDS, matchedMachine.brandId) || masterDataService.getBrandById(matchedMachine.brandId);
    const mdl = storage.getItem(TABLE_NAMES.MODELS, matchedMachine.modelId) || masterDataService.getModelById(matchedMachine.modelId);

    enrichedMachine = {
      ...matchedMachine,
      group: grp,
      unit: unt,
      floor: flr,
      line: lin,
      machineName: mn,
      brand: brd,
      model: mdl
    };
  }

  // Filter Units based on selected Group
  const availableUnits = (historySelectedGroupId && historySelectedGroupId !== 'ALL')
    ? allUnits.filter(u => u.groupId === historySelectedGroupId)
    : allUnits;

  // Filter Floors based on selected Unit and Group
  let availableFloors = allFloors;
  if (historySelectedUnitId && historySelectedUnitId !== 'ALL') {
    availableFloors = availableFloors.filter(f => f.unitId === historySelectedUnitId);
  } else if (historySelectedGroupId && historySelectedGroupId !== 'ALL') {
    const unitIds = new Set(availableUnits.map(u => u.id));
    availableFloors = availableFloors.filter(f => unitIds.has(f.unitId));
  }

  // Filter Lines based on selected Floor and Unit
  let availableLines = allLines;
  if (historySelectedFloorId && historySelectedFloorId !== 'ALL') {
    availableLines = availableLines.filter(l => l.floorId === historySelectedFloorId);
  } else if (historySelectedUnitId && historySelectedUnitId !== 'ALL') {
    const floorIds = new Set(availableFloors.map(f => f.id));
    availableLines = availableLines.filter(l => floorIds.has(l.floorId));
  }

  // Filter Machines for the Matching Machine Dropdown
  let filteredMachines = allMachines;
  if (historySelectedUnitId && historySelectedUnitId !== 'ALL') {
    filteredMachines = filteredMachines.filter(m => m.unitId === historySelectedUnitId);
  }
  if (historySelectedFloorId && historySelectedFloorId !== 'ALL') {
    filteredMachines = filteredMachines.filter(m => m.floorId === historySelectedFloorId);
  }
  if (historySelectedLineId && historySelectedLineId !== 'ALL') {
    filteredMachines = filteredMachines.filter(m => m.lineId === historySelectedLineId);
  }

  // Build Options for Cascading Dropdowns
  // 1. Group Dropdown Options
  const groupOptions = `
    <option value="ALL">All Groups (${allGroups.length})</option>
    ${allGroups.map(g => `<option value="${g.id}" ${historySelectedGroupId === g.id ? 'selected' : ''}>${g.name} (${g.code || 'GRP'})</option>`).join('')}
  `;

  // 2. Unit Dropdown Options
  const unitOptions = `
    <option value="ALL">All Units / Factories (${allMachines.length} Machines)</option>
    ${availableUnits.map(u => {
      const count = unitMachineCounts[u.id] || 0;
      return `<option value="${u.id}" ${historySelectedUnitId === u.id ? 'selected' : ''}>${u.name} (${u.code || ''}) [${count}]</option>`;
    }).join('')}
  `;

  // 3. Floor Dropdown Options
  const floorOptions = `
    <option value="ALL">All Floors (${availableFloors.length})</option>
    ${availableFloors.map(f => {
      const count = floorMachineCounts[f.id] || 0;
      return `<option value="${f.id}" ${historySelectedFloorId === f.id ? 'selected' : ''}>${f.name} [${f.code || 'FL'}] (${count} machines)</option>`;
    }).join('')}
  `;

  // 4. Line Dropdown Options
  const lineOptions = `
    <option value="ALL">All Lines / Sections (${availableLines.length})</option>
    ${availableLines.map(l => `<option value="${l.id}" ${historySelectedLineId === l.id ? 'selected' : ''}>${l.name}</option>`).join('')}
  `;

  // 5. Machine Dropdown Options
  const machineOptions = filteredMachines.map(m => {
    const mName = storage.getItem(TABLE_NAMES.MACHINE_NAMES, m.machineNameId)?.name || m.machineName || 'Machine';
    const mBrand = storage.getItem(TABLE_NAMES.BRANDS, m.brandId)?.name || m.brand || '';
    const mFloor = storage.getItem(TABLE_NAMES.FLOORS, m.floorId)?.name?.replace(/ Floor$/i, '') || '';
    const mLine = storage.getItem(TABLE_NAMES.LINES, m.lineId)?.name || '';
    const locStr = [mFloor, mLine].filter(Boolean).join(' • ');
    return `<option value="${m.serialNumber}" ${m.serialNumber === searchedSerial ? 'selected' : ''}>${m.serialNumber} — ${mName} • ${mBrand} [${locStr}]</option>`;
  }).join('');

  // Sample quick pick machines
  const sampleSerials = ['5369', '4712', '76', '4288', 'TS-01'];
  const sampleMachineButtons = sampleSerials
    .filter(sn => allMachines.some(m => m.serialNumber === sn))
    .map(sn => {
      const isCur = (searchedSerial || '').toUpperCase() === sn.toUpperCase();
      const m = allMachines.find(m => m.serialNumber === sn);
      const flr = storage.getItem(TABLE_NAMES.FLOORS, m?.floorId)?.name?.replace(/ Floor$/i, '') || '';
      return `
        <button type="button" class="btn btn-ghost btn-sm btn-quick-serial ${isCur ? 'active' : ''}" data-serial="${sn}" style="font-family: var(--font-mono); font-size: 11px; padding: 2px 8px; border-radius: 4px; border: 1px solid ${isCur ? '#38bdf8' : 'rgba(255,255,255,0.15)'}; ${isCur ? 'background: rgba(56, 189, 248, 0.25); color: #38bdf8; font-weight: 800;' : 'color: #94a3b8;'}">
          ${isCur ? '⚡ ' : ''}${sn} ${flr ? `<span style="opacity: 0.7; font-size: 9.5px;">(${flr})</span>` : ''}
        </button>
      `;
    }).join('');

  // Query Data for this Machine Serial
  const historyList = enrichedMachine ? 
    historyService.getMachineHistory(enrichedMachine.serialNumber, historyFilters) : [];
  const locationTrail = enrichedMachine ? 
    historyService.getLocationHistory(enrichedMachine.serialNumber) : [];
  const serviceRepairsList = enrichedMachine ? 
    historyService.getServiceAndRepairHistory(enrichedMachine.serialNumber, { ...historyFilters, serviceType: serviceTypeFilter }) : [];
  const sparePartsList = enrichedMachine ? 
    historyService.getSparePartsHistory(enrichedMachine.serialNumber, historyFilters) : [];
  const boardHistory = enrichedMachine ? 
    etLabService.getBoardHistoryForMachine(enrichedMachine.serialNumber) : [];

  return `
    <div class="page-view history-page-wrapper" style="gap: 12px; padding: 16px;">
      
      <!-- Top Action Command Bar -->
      <div class="view-header-row" style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; box-shadow: var(--shadow-sm);">
        <div style="min-width: 0; flex: 1;">
          <div style="font-weight: 800; font-size: 16px; color: var(--text-primary); display: flex; align-items: center; gap: 8px; word-break: break-word;">
            <span style="font-size: 20px;">📜</span>
            <span>Machine History &amp; Maintenance Ledger</span>
          </div>
          <div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">
            Search by <strong>Machine Serial Number</strong> (Format: <code>[Floor Short Code]-[Machine Number]</code>, e.g. <code>JA-01</code>, <code>BG-01</code>, <code>TT-01</code>, <code>5369</code>).
          </div>
        </div>

        <!-- Machine History Actions -->
        <div class="view-header-actions" style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          ${authService.hasAccess('service_repair', 'ADD') ? `
            <button id="btn-open-service-modal" class="btn btn-primary btn-sm" style="font-weight: 700; height: 36px; background: linear-gradient(135deg, #0284c7, #0369a1); box-shadow: 0 2px 10px rgba(2, 132, 199, 0.35);">
              🛠️ Log Service &amp; Repair
            </button>
          ` : ''}
          ${(authService.hasAccess('spare_parts', 'ADD') || authService.hasAccess('service_repair', 'ADD')) ? `
            <button id="btn-add-spare-part-manual" class="btn btn-secondary btn-sm" style="height: 36px; font-weight: 600;">
              ⚙️ Log Spare Part Replacement
            </button>
          ` : ''}
          <button id="btn-print-machine-passport" class="btn btn-secondary btn-sm" style="height: 36px; border-color: #38bdf8; color: #38bdf8; font-weight: 700;" title="Generate & Print Official Machine History Passport">
            🖨️ Print Machine Passport
          </button>
          ${authService.hasAccess('excel_export', 'EXPORT') ? `
            <button id="btn-export-history-excel" class="btn btn-secondary btn-sm" style="height: 36px;" title="Export complete multi-sheet Excel history report">
              📊 Export (.xlsx)
            </button>
          ` : ''}
        </div>
      </div>

      <!-- Ultra-Clean, Organized Cascading Dropdowns Command Hub (Group, Unit, Floor, Line, Machine) -->
      <div class="hist-command-hub" style="background: linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.95)); border: 1px solid rgba(56, 189, 248, 0.35); border-radius: var(--radius-lg); padding: 18px 22px; display: flex; flex-direction: column; gap: 14px; box-shadow: 0 6px 24px rgba(0, 0, 0, 0.35);">
        
        <!-- Header Bar: Title, Auto-Sync Status, Master Data Config Bridge -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); padding-bottom: 12px;">
          <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
            <div style="font-size: 14.5px; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 19px;">🏢</span>
              <span>Plant Hierarchy &amp; Machine Selector</span>
            </div>
            <span style="display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: 20px; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.4); font-size: 11px; color: #34d399; font-weight: 700;">
              <span style="width: 7px; height: 7px; border-radius: 50%; background: #10b981; box-shadow: 0 0 6px #10b981; display: inline-block;"></span>
              Auto-Synced from Master Data
            </span>
          </div>

          <div style="display: flex; align-items: center; gap: 8px;">
            <button id="btn-goto-master-data" class="btn btn-secondary btn-sm" style="display: inline-flex; align-items: center; gap: 6px; font-weight: 700; height: 32px; border-color: rgba(56, 189, 248, 0.5); color: #38bdf8; background: rgba(15, 23, 42, 0.85); box-shadow: 0 2px 8px rgba(0,0,0,0.2);" title="Open Plant Hierarchy & Master Data Configuration view">
              <span>🏢 Plant Hierarchy &amp; Master Data Configuration</span>
              <span style="font-size: 12px;">&rarr;</span>
            </button>
          </div>
        </div>

        <!-- Row 1: Cascading Dropdowns (Group -> Unit -> Floor -> Line) in One Aligned Grid -->
        <div class="history-filters-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr)); gap: 10px; align-items: flex-end;">
          
          <!-- 1. Group Dropdown -->
          <div style="display: flex; flex-direction: column; gap: 5px;">
            <label for="filter-hist-group" style="font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 5px;">
              <span>🏢 Group:</span>
            </label>
            <select id="filter-hist-group" class="filter-select" style="height: 38px; font-size: 12px; background: #080d1a; color: #e2e8f0; border: 1.5px solid rgba(255, 255, 255, 0.15); border-radius: 6px;">
              ${groupOptions}
            </select>
          </div>

          <!-- 2. Unit Dropdown -->
          <div style="display: flex; flex-direction: column; gap: 5px;">
            <label for="filter-hist-unit" style="font-size: 11px; font-weight: 800; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 5px;">
              <span>🏭 Unit / Factory:</span>
            </label>
            <select id="filter-hist-unit" class="filter-select" style="height: 38px; font-size: 12px; background: #080d1a; color: #38bdf8; font-weight: 700; border: 1.5px solid rgba(56, 189, 248, 0.5); border-radius: 6px;">
              ${unitOptions}
            </select>
          </div>

          <!-- 3. Floor Dropdown -->
          <div style="display: flex; flex-direction: column; gap: 5px;">
            <label for="filter-hist-floor" style="font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 5px;">
              <span>📍 Production Floor:</span>
            </label>
            <select id="filter-hist-floor" class="filter-select" style="height: 38px; font-size: 12px; background: #080d1a; color: #e2e8f0; border: 1.5px solid rgba(255, 255, 255, 0.15); border-radius: 6px;">
              ${floorOptions}
            </select>
          </div>

          <!-- 4. Line Dropdown -->
          <div style="display: flex; flex-direction: column; gap: 5px;">
            <label for="filter-hist-line" style="font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 5px;">
              <span>🧵 Line / Section:</span>
            </label>
            <select id="filter-hist-line" class="filter-select" style="height: 38px; font-size: 12px; background: #080d1a; color: #e2e8f0; border: 1.5px solid rgba(255, 255, 255, 0.15); border-radius: 6px;">
              ${lineOptions}
            </select>
          </div>

        </div>

        <!-- Row 2: Direct Search on Left + Filtered Matching Machine Dropdown on Right -->
        <div class="history-search-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)); gap: 12px; align-items: flex-end; padding-top: 8px; border-top: 1px solid rgba(255, 255, 255, 0.07);">
          
          <!-- Direct Machine Serial Search Input -->
          <div style="display: flex; flex-direction: column; gap: 5px;">
            <label for="history-serial-search-input" style="font-size: 11px; font-weight: 800; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 6px;">
              <span>🎯 Search Machine Serial:</span>
              <span style="font-size: 10.5px; font-weight: 500; color: var(--text-muted); text-transform: none;">(Type serial or scan barcode)</span>
            </label>
            <div style="display: flex; gap: 8px; position: relative; flex-wrap: wrap;">
              <div style="position: relative; flex: 1; min-width: 180px;">
                <span style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); font-size: 14px; color: #38bdf8;">🔍</span>
                <input 
                  type="text" 
                  id="history-serial-search-input" 
                  list="machine-serials-datalist"
                  class="form-control" 
                  placeholder="Enter Serial (e.g. 5369, 4712, 76, JA-01)..." 
                  value="${searchedSerial || ''}"
                  style="padding-left: 36px; padding-right: 32px; font-family: var(--font-mono); font-size: 13.5px; font-weight: 700; height: 38px; background: #080d1a; border: 1.5px solid rgba(56, 189, 248, 0.5); color: #38bdf8; border-radius: 6px; width: 100%; box-sizing: border-box;"
                />
                <datalist id="machine-serials-datalist">
                  ${allMachines.slice(0, 300).map(m => `<option value="${m.serialNumber}">${m.serialNumber} — ${(storage.getItem(TABLE_NAMES.MACHINE_NAMES, m.machineNameId)?.name) || m.machineName || 'Machine'} • ${(storage.getItem(TABLE_NAMES.FLOORS, m.floorId)?.name) || 'Floor'}</option>`).join('')}
                </datalist>
                ${searchedSerial ? `
                  <button id="btn-clear-serial-search" type="button" class="btn btn-ghost btn-sm" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); padding: 2px 6px; font-size: 12px; color: var(--text-muted);" title="Clear Search">✕</button>
                ` : ''}
              </div>
              <button id="btn-execute-serial-search" class="btn btn-primary" style="font-weight: 700; height: 38px; padding: 0 16px; white-space: nowrap; box-shadow: 0 2px 10px rgba(2, 132, 199, 0.4); font-size: 12.5px;">
                Search Machine
              </button>
            </div>
          </div>

          <!-- Matching Machine Dropdown in Selected Hierarchy -->
          <div style="display: flex; flex-direction: column; gap: 5px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <label for="select-history-machine-dropdown" style="font-size: 11px; font-weight: 800; color: #cbd5e1; text-transform: uppercase; letter-spacing: 0.5px;">
                <span>⚡ Matching Machines in Filter:</span>
              </label>
              <span style="font-size: 11px; font-weight: 700; color: #38bdf8;">${filteredMachines.length} Found</span>
            </div>
            <select id="select-history-machine-dropdown" class="filter-select" style="height: 38px; font-size: 12px; width: 100%; background: #080d1a; color: ${searchedSerial ? '#38bdf8' : '#94a3b8'}; font-weight: 600; border: 1.5px solid rgba(56, 189, 248, 0.4); border-radius: 6px;">
              <option value="" ${!searchedSerial ? 'selected' : ''}>⚡ Select a Machine (${filteredMachines.length} in this filter)...</option>
              ${machineOptions}
            </select>
          </div>

        </div>

        <!-- Row 3: Quick Picks + Reset Filter Buttons -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; padding-top: 4px;">
          <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
            <span style="font-size: 11px; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">⭐ Quick Sample Machines:</span>
            ${sampleMachineButtons}
          </div>

          ${(historySelectedGroupId !== 'ALL' || historySelectedUnitId !== 'ALL' || historySelectedFloorId !== 'ALL' || historySelectedLineId !== 'ALL') ? `
            <button id="btn-reset-plant-filters" type="button" class="btn btn-ghost btn-sm" style="font-size: 11px; color: #fca5a5; padding: 3px 10px; border: 1px solid rgba(239, 68, 68, 0.35); border-radius: 4px; font-weight: 600;">
              ↺ Reset Location Filters (Show All)
            </button>
          ` : ''}
        </div>

      </div>

      <!-- Machine Profile Card (Displayed after searching by Serial Number) -->
      ${enrichedMachine ? `
        <div class="machine-profile-card" style="background: linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.95)); border: 1px solid rgba(56, 189, 248, 0.35); border-left: 5px solid #0284c7; border-radius: var(--radius-lg); padding: 18px 24px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 18px; box-shadow: 0 6px 24px rgba(0, 0, 0, 0.35);">
          
          <!-- Machine Identity & Current Location -->
          <div style="display: flex; align-items: center; gap: 18px;">
            <div style="width: 58px; height: 58px; border-radius: 14px; background: rgba(2, 132, 199, 0.2); border: 1.5px solid rgba(56, 189, 248, 0.45); display: flex; align-items: center; justify-content: center; font-size: 30px; flex-shrink: 0; box-shadow: 0 0 18px rgba(2, 132, 199, 0.25);">
              🧵
            </div>
            <div style="display: flex; flex-direction: column; gap: 4px;">
              <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                <span style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Machine Serial:</span>
                <span style="font-family: var(--font-mono); font-size: 20px; font-weight: 800; color: #38bdf8; letter-spacing: 0.5px; text-shadow: 0 0 10px rgba(56, 189, 248, 0.4);">${enrichedMachine.serialNumber}</span>
                <span class="badge badge-${(enrichedMachine.status || 'ACTIVE').toLowerCase().replace('_', '')}" style="font-size: 11.5px; padding: 3px 10px; font-weight: 800;">${(enrichedMachine.status || 'ACTIVE').replace('_', ' ')}</span>
              </div>
              <div style="font-size: 14px; color: #f1f5f9; display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 12px; font-weight: 600; color: var(--text-muted); text-transform: uppercase;">Type &amp; Brand:</span>
                <strong style="color: #ffffff; font-weight: 700;">${enrichedMachine.machineName?.name || 'Sewing Machine'}</strong>
                <span style="color: var(--text-muted);">&bull;</span>
                <span style="color: #38bdf8; font-weight: 600;">${enrichedMachine.brand?.name || 'JUKI'} (${enrichedMachine.model?.name || 'DDL-8700-7'})</span>
              </div>
              
              <!-- CURRENT LOCATION HIGHLIGHT BADGE -->
              <div style="margin-top: 4px; display: inline-flex; align-items: center; gap: 8px; background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.35); padding: 4px 12px; border-radius: 6px; font-size: 13px;">
                <span style="color: #34d399; font-weight: 800; font-size: 12px; text-transform: uppercase;">📍 Current Location:</span>
                <strong style="color: #86efac; font-weight: 700;">${enrichedMachine.unit?.name || 'Unit'} &rarr; ${enrichedMachine.floor?.name || 'Floor'} &rarr; ${enrichedMachine.line?.name || 'Line'}</strong>
              </div>
            </div>
          </div>

          <!-- Machine Quick Lifetime Counters -->
          <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
            <div class="hist-stat-counter-card" data-target-tab="locations" style="background: rgba(15, 23, 42, 0.9); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 10px; padding: 10px 18px; text-align: center; min-width: 105px; cursor: pointer; transition: all 0.2s;" title="Click to view Locations History">
              <div style="font-size: 20px; font-weight: 800; color: #38bdf8;">${locationTrail.length}</div>
              <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-top: 2px;">📍 Locations</div>
            </div>

            <div class="hist-stat-counter-card" data-target-tab="service-repairs" style="background: rgba(15, 23, 42, 0.9); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 10px; padding: 10px 18px; text-align: center; min-width: 105px; cursor: pointer; transition: all 0.2s;" title="Click to view Service & Repair History">
              <div style="font-size: 20px; font-weight: 800; color: #f59e0b;">${serviceRepairsList.length}</div>
              <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-top: 2px;">🛠️ Services</div>
            </div>

            <div class="hist-stat-counter-card" data-target-tab="spare-parts" style="background: rgba(15, 23, 42, 0.9); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 10px; padding: 10px 18px; text-align: center; min-width: 105px; cursor: pointer; transition: all 0.2s;" title="Click to view Spare Parts History">
              <div style="font-size: 20px; font-weight: 800; color: #10b981;">${sparePartsList.length}</div>
              <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-top: 2px;">⚙️ Parts Replaced</div>
            </div>

            <div class="hist-stat-counter-card" data-target-tab="et-boards" style="background: rgba(15, 23, 42, 0.9); border: 1px solid rgba(56, 189, 248, 0.35); border-radius: 10px; padding: 10px 18px; text-align: center; min-width: 105px; cursor: pointer; transition: all 0.2s;" title="Click to view Connected ENT Lab Boards">
              <div style="font-size: 20px; font-weight: 800; color: #38bdf8;">${boardHistory.length}</div>
              <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-top: 2px;">⚡ ENT Boards</div>
            </div>

            <div class="hist-stat-counter-card" data-target-tab="timeline" style="background: rgba(15, 23, 42, 0.9); border: 1px solid rgba(168, 85, 247, 0.25); border-radius: 10px; padding: 10px 18px; text-align: center; min-width: 105px; cursor: pointer; transition: all 0.2s;" title="Click to view Complete Lifetime Timeline">
              <div style="font-size: 20px; font-weight: 800; color: #c084fc;">${historyList.length}</div>
              <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-top: 2px;">📜 Total Events</div>
            </div>
          </div>

        </div>
      ` : (searchedSerial ? `
        <div style="padding: 36px 20px; text-align: center; background: var(--bg-surface); border: 1px dashed rgba(239, 68, 68, 0.4); border-radius: var(--radius-lg); display: flex; flex-direction: column; align-items: center; gap: 10px;">
          <div style="font-size: 38px;">🔍</div>
          <div style="font-size: 16px; font-weight: 700; color: #fca5a5;">No machine found for Serial Number: "${searchedSerial}"</div>
          <div style="font-size: 13px; color: var(--text-secondary); max-width: 500px;">
            Please check the serial number, or select a machine from the dropdown filter above:
          </div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; margin-top: 6px;">
            <button type="button" class="btn btn-secondary btn-sm btn-quick-serial" data-serial="5369" style="font-family: var(--font-mono); font-weight: 700;">⚡ 5369 (Tista)</button>
            <button type="button" class="btn btn-secondary btn-sm btn-quick-serial" data-serial="4712" style="font-family: var(--font-mono); font-weight: 700;">⚡ 4712 (Jamuna)</button>
            <button type="button" class="btn btn-secondary btn-sm btn-quick-serial" data-serial="76" style="font-family: var(--font-mono); font-weight: 700;">⚡ 76 (Buriganga)</button>
            <button type="button" class="btn btn-secondary btn-sm btn-quick-serial" data-serial="4288" style="font-family: var(--font-mono); font-weight: 700;">⚡ 4288 (Surma)</button>
          </div>
        </div>
      ` : `
        <div style="padding: 38px 24px; text-align: center; background: linear-gradient(135deg, rgba(15, 23, 42, 0.85), rgba(30, 41, 59, 0.85)); border: 1.5px dashed rgba(56, 189, 248, 0.35); border-radius: var(--radius-lg); display: flex; flex-direction: column; align-items: center; gap: 12px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);">
          <div style="width: 56px; height: 56px; border-radius: 50%; background: rgba(56, 189, 248, 0.12); border: 1px solid rgba(56, 189, 248, 0.35); display: flex; align-items: center; justify-content: center; font-size: 26px;">
            🔍
          </div>
          <div style="font-size: 17px; font-weight: 800; color: #f8fafc; letter-spacing: 0.3px;">
            Select or Search a Machine to View Lifetime History &amp; Passport
          </div>
          <div style="font-size: 13.5px; color: #94a3b8; max-width: 560px; line-height: 1.6;">
            No machine is currently selected. Pick any machine from the <strong>Matching Machines</strong> dropdown above, or type a <strong>Machine Serial Number</strong> to view its complete lifetime timeline, locations, and maintenance ledger.
          </div>
        </div>
      `)}

      <!-- 6-Tab Navigation Ribbon -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid var(--border-color); padding-bottom: 8px; flex-wrap: wrap; gap: 8px; margin-top: 4px;">
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button class="btn history-tab-btn ${activeTab === 'timeline' ? 'btn-primary' : 'btn-ghost'}" data-tab="timeline" style="font-size: 13px; font-weight: 700; padding: 7px 16px;">
            🕒 Complete Lifetime Timeline (${historyList.length})
          </button>
          <button class="btn history-tab-btn ${activeTab === 'locations' ? 'btn-primary' : 'btn-ghost'}" data-tab="locations" style="font-size: 13px; font-weight: 700; padding: 7px 16px;">
            📍 Location Movement History (${locationTrail.length})
          </button>
          <button class="btn history-tab-btn ${activeTab === 'service-repairs' ? 'btn-primary' : 'btn-ghost'}" data-tab="service-repairs" style="font-size: 13px; font-weight: 700; padding: 7px 16px;">
            🛠️ Service &amp; Repair History (${serviceRepairsList.length})
          </button>
          <button class="btn history-tab-btn ${activeTab === 'spare-parts' ? 'btn-primary' : 'btn-ghost'}" data-tab="spare-parts" style="font-size: 13px; font-weight: 700; padding: 7px 16px;">
            ⚙️ Spare Parts History (${sparePartsList.length})
          </button>
          <button class="btn history-tab-btn ${activeTab === 'et-boards' ? 'btn-primary' : 'btn-ghost'}" data-tab="et-boards" style="font-size: 13px; font-weight: 700; padding: 7px 16px;">
            ⚡ ENT Lab Boards (${boardHistory.length})
          </button>
          <button class="btn history-tab-btn ${activeTab === 'admin-log' ? 'btn-primary' : 'btn-ghost'}" data-tab="admin-log" style="font-size: 13px; font-weight: 700; padding: 7px 16px;">
            📜 Admin Activity Log (${historyList.length})
          </button>
        </div>

        <!-- Filter Controls -->
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 4px;">
          ${activeTab === 'service-repairs' ? `
            <select id="filter-service-type" class="filter-select" style="width: auto; height: 32px; font-size: 12px; padding: 2px 8px; font-weight: 600; border-color: #f59e0b;">
              <option value="ALL" ${serviceTypeFilter === 'ALL' ? 'selected' : ''}>All Service Types</option>
              <option value="REPAIR" ${serviceTypeFilter === 'REPAIR' ? 'selected' : ''}>🔧 Repair</option>
              <option value="SERVICING" ${serviceTypeFilter === 'SERVICING' ? 'selected' : ''}>🛠️ Servicing</option>
              <option value="PREVENTIVE_MAINTENANCE" ${serviceTypeFilter === 'PREVENTIVE_MAINTENANCE' ? 'selected' : ''}>🛡️ Preventive Maintenance</option>
              <option value="BREAKDOWN" ${serviceTypeFilter === 'BREAKDOWN' ? 'selected' : ''}>⚡ Breakdown</option>
            </select>
          ` : ''}

          <input 
            type="text" 
            id="tab-inner-search-input" 
            class="form-control" 
            placeholder="🔍 Filter tab records..." 
            value="${historyFilters.search || ''}" 
            style="width: 190px; height: 32px; font-size: 12px; background: rgba(15, 23, 42, 0.7);"
          />

          <input 
            type="date" 
            id="filter-history-start-date" 
            class="filter-input" 
            title="Start Date" 
            value="${historyFilters.startDate || ''}" 
            style="width: 125px; height: 32px; font-size: 11.5px;"
          />
          <span style="font-size: 11px; color: var(--text-muted);">&rarr;</span>
          <input 
            type="date" 
            id="filter-history-end-date" 
            class="filter-input" 
            title="End Date" 
            value="${historyFilters.endDate || ''}" 
            style="width: 125px; height: 32px; font-size: 11.5px;"
          />

          <button id="btn-reset-history-filters" class="btn btn-ghost btn-sm" style="height: 32px; font-size: 11.5px; padding: 0 8px;" title="Reset Filters">
            ↺ Reset
          </button>
        </div>
      </div>

      <!-- Tab Content Area -->
      <div class="history-content-container" style="flex: 1; overflow-y: auto; min-height: 420px;">
        ${renderActiveTabContent(activeTab, enrichedMachine, historyList, locationTrail, serviceRepairsList, sparePartsList, boardHistory)}
      </div>

    </div>
  `;
}

/**
 * Tab Router
 */
function renderActiveTabContent(tab, enrichedMachine, historyList, locationTrail, serviceRepairsList, sparePartsList, boardHistory = []) {
  if (!enrichedMachine) {
    return `
      <div style="text-align: center; padding: 48px 20px; background: var(--bg-surface); border: 1px dashed var(--border-color); border-radius: var(--radius-lg); margin-top: 10px; display: flex; flex-direction: column; align-items: center; gap: 8px;">
        <div style="font-size: 34px; opacity: 0.6;">🧵</div>
        <div style="font-size: 15px; font-weight: 700; color: var(--text-primary);">No Machine Selected</div>
        <div style="font-size: 12.5px; color: var(--text-muted);">Please select a machine from the dropdown or search a Serial Number above to view records.</div>
      </div>
    `;
  }

  switch (tab) {
    case 'timeline':
      return renderTimelineTab(historyList, enrichedMachine);
    case 'locations':
      return renderLocationsTab(locationTrail, enrichedMachine);
    case 'service-repairs':
      return renderServiceRepairsTab(serviceRepairsList, enrichedMachine);
    case 'spare-parts':
      return renderSparePartsTab(sparePartsList, enrichedMachine);
    case 'et-boards':
      return renderEtBoardsTab(boardHistory, enrichedMachine);
    case 'admin-log':
      return renderAdminLogTab(historyList, enrichedMachine);
    default:
      return renderTimelineTab(historyList, enrichedMachine);
  }
}

/**
 * Tab 1: Interactive Unified Lifetime Timeline
 */
function renderTimelineTab(historyList, machine) {
  if (historyList.length === 0) {
    return `
      <div style="text-align: center; padding: 48px 24px; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); margin-top: 10px; display: flex; flex-direction: column; align-items: center; gap: 12px;">
        <div style="font-size: 40px;">🕒</div>
        <div style="font-size: 16px; font-weight: 700; color: var(--text-primary);">No Lifetime Timeline Events Recorded for Machine [${machine.serialNumber}]</div>
        <div style="font-size: 12.5px; color: var(--text-secondary); max-width: 520px;">
          This machine is currently stationed at <strong>${machine.floor?.name || 'Factory Floor'} (${machine.line?.name || 'Line'})</strong>. Start recording its maintenance ledger below.
        </div>
        <div style="display: flex; gap: 10px; margin-top: 6px; flex-wrap: wrap; justify-content: center;">
          <button type="button" class="btn btn-primary btn-sm btn-empty-log-service" style="font-weight: 700; height: 34px;">
            🛠️ Log Service &amp; Repair
          </button>
          <button type="button" class="btn btn-secondary btn-sm btn-empty-log-part" style="font-weight: 600; height: 34px;">
            ⚙️ Log Spare Part Replacement
          </button>
          <button type="button" class="btn btn-secondary btn-sm btn-empty-req-transfer" style="font-weight: 600; height: 34px;">
            📦 Relocate / Transfer Machine
          </button>
        </div>
      </div>
    `;
  }

  let html = `<div class="timeline-feed" style="position: relative; padding: 16px 10px 16px 20px; display: flex; flex-direction: column; gap: 16px;">`;

  historyList.forEach((h, idx) => {
    const act = ACTIVITY_TYPES[h.actionType] || { label: h.actionType, icon: '📋', color: '#38bdf8' };
    const dateObj = new Date(h.timestamp);
    const dateFormatted = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeFormatted = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let detailContent = `<p style="font-size: 13px; color: #cbd5e1; margin-top: 6px; line-height: 1.5;">${h.details || h.title}</p>`;

    // Render Location Diff if transfer / relocation
    if (h.fromLocation || h.toLocation) {
      const fromStr = h.fromLocation ? `${h.fromLocation.unitName || ''} > ${h.fromLocation.floorName || ''} > ${h.fromLocation.lineName || ''}` : 'Factory Commissioning';
      const toStr = h.toLocation ? `${h.toLocation.unitName || ''} > ${h.toLocation.floorName || ''} > ${h.toLocation.lineName || ''}` : 'N/A';
      detailContent += `
        <div style="display: flex; align-items: center; gap: 10px; margin-top: 8px; background: rgba(15, 23, 42, 0.7); border: 1px solid var(--border-color); border-radius: 6px; padding: 8px 12px; font-size: 12px;">
          <div><span style="color: #f87171; font-weight: 700;">FROM:</span> ${fromStr}</div>
          <div style="color: #38bdf8; font-weight: 800; font-size: 14px;">&rarr;</div>
          <div><span style="color: #34d399; font-weight: 700;">TO:</span> ${toStr}</div>
        </div>
      `;
    }

    // Render Service & Repair Details
    if (h.serviceRecord) {
      const sr = h.serviceRecord;
      const sType = (sr.serviceType || 'REPAIR').toUpperCase();
      const meta = SERVICE_TYPES[sType] || SERVICE_TYPES.REPAIR;
      detailContent += `
        <div style="margin-top: 8px; background: ${meta.bg}; border: 1px solid ${meta.borderColor}44; border-radius: 6px; padding: 10px 14px; font-size: 12.5px;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px;">
            <div style="font-weight: 800; color: ${meta.color}; display: flex; align-items: center; gap: 6px;">
              <span>${meta.icon}</span>
              <span>${meta.label}</span>
              <span style="font-weight: 600; color: var(--text-muted);">&bull; Location: <strong style="color: #fff;">${sr.floorLocation || 'Floor'}</strong></span>
            </div>
            <div style="font-size: 11.5px; color: var(--text-secondary);">
              Technician: <strong style="color: #fff;">${sr.technician || h.performedByName}</strong>
            </div>
          </div>
          ${sr.problemComplaint ? `<div style="font-size: 12px; color: #fca5a5; margin-top: 5px;"><strong>Problem:</strong> ${sr.problemComplaint}</div>` : ''}
          ${sr.workPerformed ? `<div style="font-size: 12px; color: #86efac; margin-top: 3px;"><strong>Work Performed:</strong> ${sr.workPerformed}</div>` : ''}
          ${sr.sparePartsUsed ? `
            <div style="font-size: 12px; color: #93c5fd; margin-top: 3px;">
              <strong>Spare Parts Used:</strong> ${sr.sparePartsUsed} ${sr.sparePartSerial ? `(S/N: ${sr.sparePartSerial})` : ''} &bull; Qty: ${sr.sparePartQty || 1}
            </div>
          ` : ''}
        </div>
      `;
    }

    // Render Spare Part details if not already covered
    if (h.sparePart && !h.serviceRecord) {
      detailContent += `
        <div style="margin-top: 8px; background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 6px; padding: 8px 12px; font-size: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <div>
              <strong style="color: #34d399;">⚙️ ${h.sparePart.partName}</strong> 
              ${h.sparePart.partSerialNumber ? `<span style="font-family: var(--font-mono); color: #38bdf8;">(S/N: ${h.sparePart.partSerialNumber})</span>` : ''} 
              &bull; Qty: <strong>${h.sparePart.quantity || 1}</strong>
              &bull; Location: <strong style="color: #fff;">${h.sparePart.floorLocation || 'Floor'}</strong>
            </div>
            <div style="color: var(--text-secondary); font-size: 11px;">
              Technician: <strong style="color: #fff;">${h.sparePart.technician || h.performedByName}</strong>
            </div>
          </div>
          ${h.sparePart.replacementReason ? `<div style="font-size: 11.5px; color: #94a3b8; margin-top: 4px;">Reason: ${h.sparePart.replacementReason}</div>` : ''}
        </div>
      `;
    }

    if (h.remarks) {
      detailContent += `<div style="font-size: 11.5px; color: var(--text-muted); font-style: italic; margin-top: 6px;">Note: "${h.remarks}"</div>`;
    }

    html += `
      <div class="timeline-item" style="position: relative; display: flex; gap: 16px;">
        
        <!-- Timeline Node Circle -->
        <div style="display: flex; flex-direction: column; align-items: center; width: 36px; flex-shrink: 0;">
          <div style="width: 34px; height: 34px; border-radius: 50%; background: ${act.color}22; border: 2px solid ${act.color}; display: flex; align-items: center; justify-content: center; font-size: 16px; z-index: 2; box-shadow: 0 0 12px ${act.color}44;">
            ${act.icon}
          </div>
          ${idx < historyList.length - 1 ? `<div style="width: 2px; flex: 1; background: var(--border-color); margin-top: 4px;"></div>` : ''}
        </div>

        <!-- Timeline Event Card -->
        <div style="flex: 1; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px 18px; margin-bottom: 4px; box-shadow: var(--shadow-sm);">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-weight: 800; font-size: 14px; color: #fff;">${h.title}</span>
              <span style="font-family: var(--font-mono); font-size: 11.5px; background: rgba(56, 189, 248, 0.15); color: #38bdf8; padding: 2px 7px; border-radius: 4px; font-weight: 700;">${h.serialNumber}</span>
              <span class="badge" style="background: ${act.color}22; color: ${act.color}; border: 1px solid ${act.color}44; font-size: 10px;">${act.label}</span>
            </div>

            <div style="font-size: 12px; color: var(--text-secondary); display: flex; align-items: center; gap: 12px;">
              <span>👤 <strong>${h.performedByName}</strong></span>
              <span>📅 ${dateFormatted} at ${timeFormatted}</span>
            </div>
          </div>

          ${detailContent}
        </div>

      </div>
    `;
  });

  html += `</div>`;
  return html;
}

/**
 * Tab 2: Machine Location Movement History (Flow Trail + Detailed Table)
 */
function renderLocationsTab(locationTrail, machine) {
  return `
    <div style="display: flex; flex-direction: column; gap: 14px; margin-top: 8px;">
      
      <!-- Visual Movement Trail Banner -->
      <div style="background: linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.9)); border: 1px solid rgba(56, 189, 248, 0.35); border-radius: var(--radius-lg); padding: 18px 24px; box-shadow: var(--shadow-sm);">
        <div style="font-weight: 800; font-size: 14px; color: #38bdf8; text-transform: uppercase; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
          <span>📍 Lifetime Movement Trail:</span>
          <span style="font-family: var(--font-mono); color: #fff;">${machine.serialNumber}</span>
        </div>

        <!-- Horizontal Flow Arrow Visualization -->
        <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 10px;">
          ${locationTrail.map((loc, idx) => {
            const dateStr = new Date(loc.timestamp).toLocaleDateString('en-GB');
            const targetFloor = loc.toLocation?.floorName || loc.toLocation?.lineName || 'Commissioning';
            const isCurrent = idx === locationTrail.length - 1;

            return `
              <div style="display: flex; align-items: center; gap: 10px;">
                <div style="background: ${isCurrent ? 'rgba(16, 185, 129, 0.2)' : 'rgba(15, 23, 42, 0.9)'}; border: 1.5px solid ${isCurrent ? '#10b981' : 'rgba(56, 189, 248, 0.4)'}; border-radius: 8px; padding: 8px 14px; display: flex; flex-direction: column; gap: 2px;">
                  <div style="font-weight: 800; font-size: 13.5px; color: ${isCurrent ? '#86efac' : '#fff'}; display: flex; align-items: center; gap: 6px;">
                    <span>📍 ${targetFloor}</span>
                    ${isCurrent ? `<span class="badge" style="background: #10b981; color: #fff; font-size: 9.5px; padding: 1px 6px;">Current</span>` : ''}
                  </div>
                  <div style="font-size: 11px; color: var(--text-muted); font-family: var(--font-mono);">
                    📅 ${dateStr}
                  </div>
                </div>

                ${idx < locationTrail.length - 1 ? `
                  <div style="color: #38bdf8; font-size: 18px; font-weight: 800;">&rarr;</div>
                ` : ''}
              </div>
            `;
          }).join('')}
        </div>

        <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 12px; font-style: italic;">
          ℹ️ The system permanently preserves every previous location and movement record. Location history is never deleted upon transfer.
        </div>
      </div>

      <!-- Comprehensive Location Relocations Table -->
      <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); overflow-x: auto; -webkit-overflow-scrolling: touch;">
        <table class="excel-grid-table" style="width: 100%; min-width: 860px; border-collapse: collapse;">
          <thead>
            <tr>
              <th style="width: 50px; text-align: center;">Sl.</th>
              <th style="width: 130px;">Transfer Date</th>
              <th style="width: 140px;">Machine Serial</th>
              <th style="width: 220px;">From Location</th>
              <th style="width: 220px;">To Location</th>
              <th style="width: 240px;">Reason / Transfer Order</th>
              <th style="width: 160px;">Authorized By</th>
            </tr>
          </thead>
          <tbody>
            ${locationTrail.map((t, idx) => {
              const fromStr = t.fromLocation ? `${t.fromLocation.unitName || ''} > ${t.fromLocation.floorName || ''} > ${t.fromLocation.lineName || ''}` : 'Factory Initial Commissioning';
              const toStr = t.toLocation ? `${t.toLocation.unitName || ''} > ${t.toLocation.floorName || ''} > ${t.toLocation.lineName || ''}` : 'N/A';
              const isCurrent = idx === locationTrail.length - 1;

              return `
                <tr style="${isCurrent ? 'background: rgba(16, 185, 129, 0.04);' : ''}">
                  <td style="text-align: center; font-family: var(--font-mono); color: var(--text-muted);">${String(idx + 1).padStart(2, '0')}</td>
                  <td style="font-size: 12px; font-weight: 600;">${new Date(t.timestamp).toLocaleDateString('en-GB')}</td>
                  <td style="font-family: var(--font-mono); font-weight: 700; color: #38bdf8;">${t.serialNumber}</td>
                  <td style="color: #fca5a5; font-size: 12px;">${fromStr}</td>
                  <td style="color: #86efac; font-size: 12px; font-weight: 700;">
                    ${toStr} ${isCurrent ? `<span class="badge" style="background: #10b981; color: #fff; font-size: 9px; margin-left: 4px;">Active</span>` : ''}
                  </td>
                  <td style="font-size: 12px; color: var(--text-secondary);">${t.remarks || t.details || '—'}</td>
                  <td style="font-size: 12px; font-weight: 600;">${t.performedByName}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

    </div>
  `;
}

/**
 * Tab 3: Service & Repair History (Filterable by Repair, Servicing, Preventive Maintenance, Breakdown)
 */
function renderServiceRepairsTab(serviceRepairsList, machine) {
  if (serviceRepairsList.length === 0) {
    return `
      <div style="text-align: center; padding: 48px 20px; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); margin-top: 10px;">
        <div style="font-size: 38px; margin-bottom: 8px;">🛠️</div>
        <div style="font-size: 16px; font-weight: 700; color: var(--text-primary);">No service or repair records found</div>
        <div style="font-size: 12.5px; color: var(--text-secondary); margin-top: 4px;">
          Click <strong>🛠️ Log Service &amp; Repair</strong> above to record maintenance activities for ${machine.serialNumber}.
        </div>
      </div>
    `;
  }

  return `
    <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); overflow-x: auto; -webkit-overflow-scrolling: touch; margin-top: 8px;">
      <table class="excel-grid-table" style="width: 100%; min-width: 950px; border-collapse: collapse;">
        <thead>
          <tr>
            <th style="width: 45px; text-align: center;">Sl.</th>
            <th style="width: 110px;">Service Date</th>
            <th style="width: 130px;">Machine Serial</th>
            <th style="width: 140px;">Floor / Location</th>
            <th style="width: 150px;">Service Type</th>
            <th style="width: 220px;">Problem / Complaint</th>
            <th style="width: 220px;">Work Performed</th>
            <th style="width: 180px;">Spare Parts Used</th>
            <th style="width: 130px;">Part S/N</th>
            <th style="width: 50px; text-align: center;">Qty</th>
            <th style="width: 150px;">Technician / Engineer</th>
            <th style="width: 150px;">Remarks</th>
            <th style="width: 130px;">Added By</th>
          </tr>
        </thead>
        <tbody>
          ${serviceRepairsList.map((item, idx) => {
            const sr = item.serviceRecord || {};
            const sType = (sr.serviceType || item.maintenance?.serviceType || 'REPAIR').toUpperCase();
            const meta = SERVICE_TYPES[sType] || SERVICE_TYPES.REPAIR;

            return `
              <tr>
                <td style="text-align: center; font-family: var(--font-mono); color: var(--text-muted);">${String(idx + 1).padStart(2, '0')}</td>
                <td style="font-size: 12px; font-weight: 600;">${sr.serviceDate || new Date(item.timestamp).toLocaleDateString('en-GB')}</td>
                <td style="font-family: var(--font-mono); font-weight: 700; color: #38bdf8;">${item.serialNumber}</td>
                <td style="font-size: 12px; font-weight: 600; color: #f1f5f9;">📍 ${sr.floorLocation || 'Production Floor'}</td>
                <td>
                  <span class="badge" style="background: ${meta.bg}; color: ${meta.color}; border: 1px solid ${meta.borderColor}66; font-weight: 700; font-size: 11px;">
                    ${meta.icon} ${meta.label}
                  </span>
                </td>
                <td style="font-size: 12px; color: #fca5a5;">${sr.problemComplaint || item.details || '—'}</td>
                <td style="font-size: 12px; color: #86efac;">${sr.workPerformed || item.remarks || '—'}</td>
                <td style="font-size: 12px; font-weight: 600; color: #93c5fd;">${sr.sparePartsUsed || item.sparePart?.partName || 'None'}</td>
                <td style="font-family: var(--font-mono); font-size: 11.5px; color: #cbd5e1;">${sr.sparePartSerial || item.sparePart?.partSerialNumber || '—'}</td>
                <td style="text-align: center; font-weight: 700;">${sr.sparePartQty || item.sparePart?.quantity || 0}</td>
                <td style="font-size: 12px; font-weight: 600; color: #fff;">${sr.technician || item.performedByName}</td>
                <td style="font-size: 11.5px; color: var(--text-muted);">${sr.remarks || item.remarks || '—'}</td>
                <td style="font-size: 11.5px; color: var(--text-secondary);">${sr.addedBy || item.performedByName}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

/**
 * Tab 4: Spare Parts Replacement History (Formatted Summary + Detailed Table)
 */
function renderSparePartsTab(sparePartsList, machine) {
  if (sparePartsList.length === 0) {
    return `
      <div style="text-align: center; padding: 48px 20px; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); margin-top: 10px;">
        <div style="font-size: 38px; margin-bottom: 8px;">⚙️</div>
        <div style="font-size: 16px; font-weight: 700; color: var(--text-primary);">No spare parts installed or replaced</div>
        <div style="font-size: 12.5px; color: var(--text-secondary); margin-top: 4px;">
          Use <strong>⚙️ Log Spare Part Replacement</strong> or <strong>📥 Import Spare Parts (Excel)</strong> to add records.
        </div>
      </div>
    `;
  }

  return `
    <div style="display: flex; flex-direction: column; gap: 14px; margin-top: 8px;">
      
      <!-- Spare Parts Tracking Highlights Box (Matching User Format) -->
      <div style="background: linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.9)); border: 1px solid rgba(16, 185, 129, 0.35); border-radius: var(--radius-lg); padding: 18px 22px;">
        <div style="font-weight: 800; font-size: 14px; color: #34d399; text-transform: uppercase; margin-bottom: 10px; display: flex; align-items: center; gap: 8px;">
          <span>⚙️ Installed / Replaced Spare Parts Summary:</span>
          <span style="font-family: var(--font-mono); color: #38bdf8;">${machine.serialNumber}</span>
        </div>

        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${sparePartsList.map(p => `
            <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 6px; padding: 8px 14px; font-size: 13px;">
              <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                <span style="font-family: var(--font-mono); font-weight: 700; color: #38bdf8;">📅 ${p.replacementDate || new Date(p.createdAt).toLocaleDateString('en-GB')}</span>
                <span style="color: var(--text-muted);">&mdash;</span>
                <span style="font-weight: 700; color: #fbbf24;">📍 ${p.floorLocation || 'Production Floor'}</span>
                <span style="color: var(--text-muted);">&mdash;</span>
                <span style="font-weight: 700; color: #86efac;">${p.partName} ${p.partSerialNumber ? `<span style="font-family: var(--font-mono); color: #cbd5e1; font-weight: normal;">(S/N: ${p.partSerialNumber})</span>` : ''}</span>
                <span class="badge" style="background: rgba(16, 185, 129, 0.2); color: #34d399; font-size: 10.5px;">Qty: ${p.quantity || 1}</span>
              </div>

              <div style="font-size: 12px; color: var(--text-secondary);">
                Technician: <strong style="color: #fff;">${p.technician || p.createdByName}</strong>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Detailed Spare Parts Table -->
      <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); overflow-x: auto; -webkit-overflow-scrolling: touch;">
        <table class="excel-grid-table" style="width: 100%; min-width: 900px; border-collapse: collapse;">
          <thead>
            <tr>
              <th style="width: 45px; text-align: center;">Sl.</th>
              <th style="width: 120px;">Replaced Date</th>
              <th style="width: 130px;">Machine Serial</th>
              <th style="width: 150px;">Floor / Location</th>
              <th style="width: 200px;">Spare Part Name</th>
              <th style="width: 140px;">Part Serial Number</th>
              <th style="width: 50px; text-align: center;">Qty</th>
              <th style="width: 220px;">Reason / Work Performed</th>
              <th style="width: 150px;">Technician / Engineer</th>
              <th style="width: 180px;">Remarks</th>
            </tr>
          </thead>
          <tbody>
            ${sparePartsList.map((p, idx) => `
              <tr>
                <td style="text-align: center; font-family: var(--font-mono); color: var(--text-muted);">${String(idx + 1).padStart(2, '0')}</td>
                <td style="font-size: 12px; font-weight: 600;">${p.replacementDate || new Date(p.createdAt).toLocaleDateString('en-GB')}</td>
                <td style="font-family: var(--font-mono); font-weight: 700; color: #38bdf8;">${p.serialNumber}</td>
                <td style="font-size: 12px; font-weight: 600; color: #fbbf24;">📍 ${p.floorLocation || 'Production Floor'}</td>
                <td style="font-weight: 700; color: #34d399; font-size: 12.5px;">${p.partName}</td>
                <td style="font-family: var(--font-mono); font-size: 12px; color: #38bdf8;">${p.partSerialNumber || p.partNumber || '—'}</td>
                <td style="text-align: center; font-weight: 700;">${p.quantity || 1}</td>
                <td style="font-size: 12px; color: var(--text-secondary);">${p.replacementReason || '—'}</td>
                <td style="font-size: 12px; font-weight: 600; color: #fff;">${p.technician || p.createdByName}</td>
                <td style="font-size: 11.5px; color: var(--text-muted);">${p.remarks || '—'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

    </div>
  `;
}

/**
 * Tab 5: Admin Activity Log Table
 */
function renderAdminLogTab(historyList) {
  return `
    <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); overflow-x: auto; -webkit-overflow-scrolling: touch; margin-top: 8px;">
      <table class="excel-grid-table" style="width: 100%; min-width: 900px; border-collapse: collapse;">
        <thead>
          <tr>
            <th style="width: 50px; text-align: center;">Sl.</th>
            <th style="width: 150px;">Timestamp</th>
            <th style="width: 130px;">Machine Serial</th>
            <th style="width: 140px;">Activity Type</th>
            <th style="width: 220px;">Title &amp; Summary</th>
            <th style="width: 280px;">Details</th>
            <th style="width: 150px;">Admin User</th>
            <th style="width: 180px;">Remarks</th>
          </tr>
        </thead>
        <tbody>
          ${historyList.map((h, idx) => {
            const act = ACTIVITY_TYPES[h.actionType] || { label: h.actionType, icon: '📋', color: '#38bdf8' };
            return `
              <tr>
                <td style="text-align: center; font-family: var(--font-mono); color: var(--text-muted);">${String(idx + 1).padStart(2, '0')}</td>
                <td style="font-size: 12px;">${new Date(h.timestamp).toLocaleString()}</td>
                <td style="font-family: var(--font-mono); font-weight: 700; color: #38bdf8;">${h.serialNumber}</td>
                <td><span class="badge" style="background: ${act.color}22; color: ${act.color}; border: 1px solid ${act.color}44;">${act.icon} ${act.label}</span></td>
                <td style="font-weight: 600; font-size: 12.5px; color: #fff;">${h.title}</td>
                <td style="font-size: 12px; color: var(--text-secondary);">${h.details || '—'}</td>
                <td style="font-size: 12px; font-weight: 600;">${h.performedByName}</td>
                <td style="font-size: 11.5px; color: var(--text-muted);">${h.remarks || '—'}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

/**
 * Tab 6: Connected ENT Lab Boards Lifetime Ledger (Rule 13)
 */
function renderEtBoardsTab(boardHistory, machine) {
  const allBoards = etLabService.getBoards();
  const currentBoard = allBoards.find(b => (b.currentMachineSerial || '').toUpperCase() === (machine.serialNumber || '').toUpperCase() && b.status === 'INSTALLED');

  return `
    <div style="display: flex; flex-direction: column; gap: 14px; margin-top: 6px;">
      
      <!-- Currently Installed Board Highlight -->
      <div style="background: rgba(15, 23, 42, 0.85); border: 1.5px solid rgba(56, 189, 248, 0.4); border-radius: var(--radius-lg); padding: 16px 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
          <div style="display: flex; align-items: center; gap: 14px;">
            <div style="width: 50px; height: 50px; border-radius: 12px; background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.4); display: flex; align-items: center; justify-content: center; font-size: 24px;">
              ⚡
            </div>
            <div>
              <div style="font-size: 11px; font-weight: 800; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.5px;">
                Current Active Board on Machine [${machine.serialNumber}]
              </div>
              ${currentBoard ? `
                <div style="font-size: 16px; font-weight: 800; color: #fff; margin-top: 2px;">
                  <span style="font-family: var(--font-mono); color: #38bdf8;">${currentBoard.boardSerial}</span> &bull; ${currentBoard.partName}
                </div>
                <div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">
                  Model: <strong style="color: #cbd5e1;">${currentBoard.modelNo || 'N/A'}</strong> &bull; 
                  P.No: <strong style="color: #cbd5e1;">${currentBoard.partNo || 'N/A'}</strong> &bull; 
                  JUKI SL: <strong style="color: #38bdf8;">${currentBoard.jukiSlNo || 'N/A'}</strong> &bull; 
                  Installed: <strong style="color: #86efac;">${currentBoard.installedDate || 'Active'}</strong> &bull;
                  By: <strong style="color: #fff;">${currentBoard.installedBy || 'Engineer'}</strong>
                </div>
              ` : `
                <div style="font-size: 14px; font-weight: 700; color: #94a3b8; margin-top: 2px;">
                  No board currently assigned in ENT Lab.
                </div>
                <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
                  You can assign an existing board to this machine via ENT Lab Management.
                </div>
              `}
            </div>
          </div>

          <div style="display: flex; gap: 8px;">
            <button class="btn btn-primary btn-sm btn-open-et-lab-view" style="font-weight: 700;">
              ⚡ Open ENT Lab Management
            </button>
          </div>
        </div>
      </div>

      <!-- Chronological Board Attachment & Removal Ledger for this Machine -->
      <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); overflow: hidden;">
        <div style="padding: 12px 18px; background: rgba(15, 23, 42, 0.85); border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
          <div style="font-weight: 800; font-size: 14px; color: #fff;">
            📜 Board History for Machine [${machine.serialNumber}] (${boardHistory.length} Events)
          </div>
          <div style="font-size: 12px; color: var(--text-muted);">
            Includes all past installations, removals, and replacements
          </div>
        </div>

        <div class="table-responsive">
          <table class="data-table" style="width: 100%; border-collapse: collapse; font-size: 12.5px;">
            <thead>
              <tr style="background: rgba(15, 23, 42, 0.95); border-bottom: 1px solid var(--border-color); font-size: 11px; text-transform: uppercase; color: #94a3b8;">
                <th style="padding: 10px 12px; text-align: center; width: 100px;">Date</th>
                <th style="padding: 10px 12px; text-align: left;">Board ID / SL No.</th>
                <th style="padding: 10px 12px; text-align: left;">Action</th>
                <th style="padding: 10px 12px; text-align: left;">Location / Line</th>
                <th style="padding: 10px 12px; text-align: left;">Authorized Technician</th>
                <th style="padding: 10px 12px; text-align: left;">Remarks / Reason</th>
              </tr>
            </thead>
            <tbody>
              ${boardHistory.length === 0 ? `
                <tr><td colspan="6" style="padding: 24px; text-align: center; color: var(--text-muted);">No board history recorded for this machine yet.</td></tr>
              ` : boardHistory.map(h => `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);" class="hover-row">
                  <td style="padding: 10px 12px; text-align: center; font-family: var(--font-mono); color: #cbd5e1;">
                    ${h.timestamp.split('T')[0]}
                  </td>
                  <td style="padding: 10px 12px;">
                    <a href="javascript:void(0)" class="link-view-board-in-et" data-serial="${h.boardSerial}" style="font-family: var(--font-mono); font-weight: 800; color: #38bdf8; text-decoration: none;">
                      ⚡ ${h.boardSerial}
                    </a>
                  </td>
                  <td style="padding: 10px 12px;">
                    <span style="font-weight: 800; color: ${h.action === 'INSTALL' ? '#10b981' : '#f59e0b'};">
                      ${h.action === 'INSTALL' ? '📥 Installed' : '📤 Removed'}
                    </span>
                  </td>
                  <td style="padding: 10px 12px; color: #86efac; font-size: 12px;">
                    ${h.location || 'Factory Floor'}
                  </td>
                  <td style="padding: 10px 12px; color: #cbd5e1;">
                    ${h.performedByName || 'Maintenance Engineer'}
                  </td>
                  <td style="padding: 10px 12px; color: var(--text-secondary);">
                    ${h.remarks || h.removalReason || '—'}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `;
}

/**
 * Event Initializer
 */
export function initMachineHistoryEvents() {

  // Open ENT Lab Navigation
  document.querySelectorAll('.btn-open-et-lab-view, .link-view-board-in-et').forEach(btn => {
    btn.addEventListener('click', () => {
      state.set('currentView', 'et-lab');
    });
  });

  // Serial Number Search Submit
  const executeSearch = () => {
    const input = document.getElementById('history-serial-search-input');
    if (!input) return;
    const val = input.value.trim();
    if (!val) {
      alert('Please enter a Machine Serial Number.');
      input.focus({ preventScroll: true });
      return;
    }
    searchedSerial = val;
    state.set('activeMachineId', null); // Reset active machine ID to let serial lookup drive view
    window.dispatchEvent(new CustomEvent('erp:master-data-updated'));
  };

  document.getElementById('btn-execute-serial-search')?.addEventListener('click', executeSearch);
  document.getElementById('history-serial-search-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      executeSearch();
    }
  });

  // Clear Search
  document.getElementById('btn-clear-serial-search')?.addEventListener('click', () => {
    searchedSerial = '';
    state.set('activeMachineId', null);
    const input = document.getElementById('history-serial-search-input');
    if (input) {
      input.value = '';
      input.focus({ preventScroll: true });
    }
    window.dispatchEvent(new CustomEvent('erp:master-data-updated'));
  });

  // Quick Serial Buttons
  document.querySelectorAll('.btn-quick-serial').forEach(btn => {
    btn.addEventListener('click', () => {
      const sn = btn.getAttribute('data-serial');
      if (sn) {
        searchedSerial = sn;
        const input = document.getElementById('history-serial-search-input');
        if (input) input.value = sn;
        executeSearch();
      }
    });
  });

  // 1. Group Filter Dropdown
  document.getElementById('filter-hist-group')?.addEventListener('change', (e) => {
    historySelectedGroupId = e.target.value;
    historySelectedUnitId = 'ALL';
    historySelectedFloorId = 'ALL';
    historySelectedLineId = 'ALL';
    window.dispatchEvent(new CustomEvent('erp:master-data-updated'));
  });

  // 2. Unit Filter Dropdown
  document.getElementById('filter-hist-unit')?.addEventListener('change', (e) => {
    historySelectedUnitId = e.target.value;
    historySelectedFloorId = 'ALL';
    historySelectedLineId = 'ALL';
    window.dispatchEvent(new CustomEvent('erp:master-data-updated'));
  });

  // 3. Floor Filter Dropdown
  document.getElementById('filter-hist-floor')?.addEventListener('change', (e) => {
    historySelectedFloorId = e.target.value;
    historySelectedLineId = 'ALL';
    window.dispatchEvent(new CustomEvent('erp:master-data-updated'));
  });

  // 4. Line Filter Dropdown
  document.getElementById('filter-hist-line')?.addEventListener('change', (e) => {
    historySelectedLineId = e.target.value;
    window.dispatchEvent(new CustomEvent('erp:master-data-updated'));
  });

  // 5. Reset Location Filters Button
  document.getElementById('btn-reset-plant-filters')?.addEventListener('click', () => {
    historySelectedGroupId = 'ALL';
    historySelectedUnitId = 'ALL';
    historySelectedFloorId = 'ALL';
    historySelectedLineId = 'ALL';
    window.dispatchEvent(new CustomEvent('erp:master-data-updated'));
  });

  // Open Master Data Configuration View
  document.getElementById('btn-goto-master-data')?.addEventListener('click', () => {
    state.set('currentView', 'master-data');
  });

  // Open Master Data Floors Configuration Tab
  document.querySelectorAll('.btn-quick-goto-master-floors').forEach(btn => {
    btn.addEventListener('click', () => {
      state.set('masterDataActiveTab', 'floors');
      state.set('currentView', 'master-data');
    });
  });

  // Clickable Stat Counter Cards to switch tabs
  document.querySelectorAll('.hist-stat-counter-card').forEach(card => {
    card.addEventListener('click', () => {
      const target = card.getAttribute('data-target-tab');
      if (target) {
        activeTab = target;
        window.dispatchEvent(new CustomEvent('erp:master-data-updated'));
      }
    });
  });

  // Action Buttons from Empty State Cards
  document.querySelectorAll('.btn-empty-log-service').forEach(btn => {
    btn.addEventListener('click', () => openLogServiceModal());
  });
  document.querySelectorAll('.btn-empty-log-part').forEach(btn => {
    btn.addEventListener('click', () => openAddSparePartModal());
  });
  document.querySelectorAll('.btn-empty-req-transfer').forEach(btn => {
    btn.addEventListener('click', () => {
      const machine = historyService.findMachineBySerialOnly(searchedSerial);
      if (machine) state.set('activeMachineId', machine.id);
      state.set('activeModal', 'transfer-machine');
    });
  });

  // Serial Dropdown Selection
  document.getElementById('select-history-machine-dropdown')?.addEventListener('change', (e) => {
    const sn = (e.target.value || '').trim();
    searchedSerial = sn;
    state.set('activeMachineId', null);
    const input = document.getElementById('history-serial-search-input');
    if (input) input.value = sn;
    window.dispatchEvent(new CustomEvent('erp:master-data-updated'));
  });

  // Tab Switching
  document.querySelectorAll('.history-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.history-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeTab = btn.getAttribute('data-tab');
      window.dispatchEvent(new CustomEvent('erp:master-data-updated'));
    });
  });

  // Service Type Filter
  document.getElementById('filter-service-type')?.addEventListener('change', (e) => {
    serviceTypeFilter = e.target.value;
    window.dispatchEvent(new CustomEvent('erp:master-data-updated'));
  });

  // Inner Search Filter
  const innerSearchInput = document.getElementById('tab-inner-search-input');
  if (innerSearchInput) {
    let timeout = null;
    innerSearchInput.addEventListener('input', (e) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        historyFilters.search = e.target.value;
        window.dispatchEvent(new CustomEvent('erp:master-data-updated'));
      }, 250);
    });
  }

  // Date Filters
  document.getElementById('filter-history-start-date')?.addEventListener('change', (e) => {
    historyFilters.startDate = e.target.value;
    window.dispatchEvent(new CustomEvent('erp:master-data-updated'));
  });
  document.getElementById('filter-history-end-date')?.addEventListener('change', (e) => {
    historyFilters.endDate = e.target.value;
    window.dispatchEvent(new CustomEvent('erp:master-data-updated'));
  });

  // Reset Filters
  document.getElementById('btn-reset-history-filters')?.addEventListener('click', () => {
    historyFilters = { startDate: '', endDate: '', actionType: 'ALL', search: '' };
    serviceTypeFilter = 'ALL';
    window.dispatchEvent(new CustomEvent('erp:master-data-updated'));
  });

  // Action: Log Service & Repair Modal
  document.getElementById('btn-open-service-modal')?.addEventListener('click', () => {
    openLogServiceModal();
  });

  // Action: Log Spare Part Replacement Modal
  document.getElementById('btn-add-spare-part-manual')?.addEventListener('click', () => {
    openAddSparePartModal();
  });

  // Action: Import Spare Parts Excel
  document.getElementById('btn-open-spare-import')?.addEventListener('click', () => {
    openSparePartsImportModal();
  });

  // Action: Export History Excel
  const btnExportHist = document.getElementById('btn-export-history-excel');
  if (btnExportHist) {
    btnExportHist.addEventListener('click', () => {
      notificationService.withLoading(btnExportHist, async () => {
        const machine = historyService.findMachineBySerialOnly(searchedSerial);
        const list = machine ? 
          historyService.getMachineHistory(machine.serialNumber, historyFilters) : 
          historyService.getGlobalActivityLog(historyFilters);
        await historyService.exportHistoryToExcel(list, machine);
      }, 'Exporting History...', 'Machine history exported to Excel successfully!');
    });
  }

  // Action: Request Machine Transfer
  document.getElementById('btn-history-request-transfer')?.addEventListener('click', () => {
    const machine = historyService.findMachineBySerialOnly(searchedSerial);
    if (machine) {
      state.set('activeMachineId', machine.id);
    }
    state.set('activeModal', 'transfer-machine');
  });

  // Action: Print Machine Passport
  document.getElementById('btn-print-machine-passport')?.addEventListener('click', () => {
    if (!searchedSerial) {
      alert('Please select or search a Machine Serial Number first to view its passport.');
      return;
    }
    openMachinePassportModal(searchedSerial);
  });
}

/**
 * Quick Add / Register Employee / Mechanic Modal
 */
export function openQuickAddEmployeeModal(onSaved = null) {
  const modalHtml = `
    <div class="modal-overlay" id="quick-add-emp-overlay" style="z-index: 10001; background: rgba(8, 13, 26, 0.85); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center;">
      <div class="modal-dialog" style="max-width: 540px; background: linear-gradient(145deg, #0f172a, #1e293b); border: 1.5px solid rgba(56, 189, 248, 0.4); border-radius: var(--radius-xl); box-shadow: 0 20px 60px rgba(0,0,0,0.8); overflow: hidden;">
        
        <div class="modal-header" style="background: linear-gradient(135deg, #0284c7, #0369a1); padding: 14px 20px; display: flex; justify-content: space-between; align-items: center;">
          <div class="modal-title" style="display: flex; align-items: center; gap: 8px; color: #fff; font-size: 15px; font-weight: 800;">
            <span>👨‍🔧 Quick Register Mechanic / Technician</span>
          </div>
          <button type="button" class="btn btn-ghost btn-sm btn-close-quick-emp" style="color: #fff; font-size: 16px; padding: 2px 8px;">✕</button>
        </div>

        <form id="form-quick-add-emp" style="padding: 20px; display: flex; flex-direction: column; gap: 14px;">
          
          <div style="display: grid; grid-template-columns: 1.3fr 1fr; gap: 10px;">
            <div class="form-group">
              <label class="form-label required" style="font-size: 12px; font-weight: 700; color: #fff;">Employee Full Name</label>
              <input type="text" id="quick-emp-name" class="form-control" placeholder="e.g. Md. Kabir Hossain" required />
            </div>

            <div class="form-group">
              <label class="form-label required" style="font-size: 12px; font-weight: 700; color: #38bdf8;">Card Number / ID</label>
              <input type="text" id="quick-emp-card" class="form-control" placeholder="e.g. 1042, 1055, AMG-201" required style="font-family: var(--font-mono); font-weight: 700;" />
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div class="form-group">
              <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Role / Designation</label>
              <select id="quick-emp-desig" class="filter-select">
                <option value="Senior Mechanic">Senior Mechanic</option>
                <option value="Line Mechanic">Line Mechanic</option>
                <option value="Maintenance Engineer">Maintenance Engineer</option>
                <option value="Electrical Technician">Electrical Technician</option>
                <option value="Mechanical Technician">Mechanical Technician</option>
                <option value="Floor Supervisor">Floor Supervisor</option>
                <option value="Overlock Specialist">Overlock Specialist</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Assigned Floor</label>
              <input type="text" id="quick-emp-floor" class="form-control" placeholder="e.g. Jamuna Floor, Titas Floor" value="Jamuna Floor" />
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div class="form-group">
              <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Joining Date</label>
              <input type="date" id="quick-emp-joindate" class="form-control" value="${new Date().toISOString().split('T')[0]}" />
            </div>

            <div class="form-group">
              <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Mobile / Phone</label>
              <input type="text" id="quick-emp-phone" class="form-control" placeholder="+88017..." />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Technical Notes / Specialization</label>
            <input type="text" id="quick-emp-spec" class="form-control" placeholder="e.g. Juki Single Needle & Overlock Specialist" />
          </div>

          <div class="modal-footer" style="padding: 12px 0 0; display: flex; justify-content: flex-end; gap: 8px; border-top: 1px solid var(--border-color); margin-top: 6px;">
            <button type="button" class="btn btn-secondary btn-close-quick-emp">Cancel</button>
            <button type="submit" class="btn btn-primary" style="font-weight: 800; background: linear-gradient(135deg, #10b981, #059669);">
              💾 Register &amp; Assign
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  const overlay = document.getElementById('quick-add-emp-overlay');
  const close = () => overlay?.remove();

  overlay?.querySelectorAll('.btn-close-quick-emp').forEach(b => b.addEventListener('click', close));

  document.getElementById('form-quick-add-emp')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('quick-emp-name')?.value.trim();
    const cardNumber = document.getElementById('quick-emp-card')?.value.trim();
    const designation = document.getElementById('quick-emp-desig')?.value;
    const floor = document.getElementById('quick-emp-floor')?.value.trim();
    const joinDate = document.getElementById('quick-emp-joindate')?.value;
    const phone = document.getElementById('quick-emp-phone')?.value.trim();
    const specialization = document.getElementById('quick-emp-spec')?.value.trim();

    try {
      const newEmp = employeeService.createEmployee({
        name,
        cardNumber,
        designation,
        floor,
        joinDate,
        phone,
        specialization
      });
      alert(`✅ Employee '${newEmp.name}' [Card #${newEmp.cardNumber}] registered successfully!`);
      close();
      if (onSaved) onSaved(newEmp);
    } catch (err) {
      alert('Registration failed: ' + err.message);
    }
  });
}

/**
 * Reusable Technician Card Search UI Component
 */
function renderTechnicianSearchSection({ idPrefix, label = 'Assigned Technician / Mechanic / Engineer', required = false, defaultVal = '' }) {
  return `
    <div style="background: rgba(15, 23, 42, 0.75); border: 1.5px solid rgba(56, 189, 248, 0.35); border-radius: var(--radius-md); padding: 14px 16px; display: flex; flex-direction: column; gap: 10px;">
      
      <!-- Top Title & Quick Add -->
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
        <div>
          <label class="form-label ${required ? 'required' : ''}" style="margin: 0; font-weight: 800; color: #38bdf8; font-size: 13px; display: flex; align-items: center; gap: 6px;">
            <span>👨‍🔧</span>
            <span>${label}</span>
          </label>
          <div style="font-size: 11px; color: #94a3b8; margin-top: 1px;">
            Search by <strong>Card Number</strong> (e.g. <code>1042</code>, <code>1055</code>) or <strong>Name</strong> &bull; Suggest &bull; Select
          </div>
        </div>
        <button type="button" class="btn btn-secondary btn-sm btn-open-quick-emp-${idPrefix}" style="font-size: 11px; font-weight: 700; color: #34d399; border-color: rgba(52, 211, 153, 0.4); padding: 3px 10px;">
          ➕ Quick Add Employee / Card
        </button>
      </div>

      <!-- Live Search Box with Icon -->
      <div style="position: relative;">
        <input 
          type="text" 
          id="${idPrefix}-tech-search" 
          class="form-control" 
          placeholder="🔍 Type Card Number (e.g. 1042) or Mechanic Name..." 
          value="${defaultVal || ''}"
          autocomplete="off"
          style="font-size: 13px; font-weight: 600; padding-left: 12px; background: rgba(30, 41, 59, 0.95); border-color: rgba(56, 189, 248, 0.3); color: #fff;"
        />
        <input type="hidden" id="${idPrefix}-tech" value="${defaultVal || ''}" />

        <!-- Floating Autocomplete Box -->
        <div 
          id="${idPrefix}-tech-autocomplete" 
          style="display: none; position: absolute; top: calc(100% + 4px); left: 0; right: 0; background: #0b1329; border: 1.5px solid #0284c7; border-radius: 8px; max-height: 260px; overflow-y: auto; z-index: 10000; box-shadow: 0 12px 35px rgba(0,0,0,0.9);"
        ></div>
      </div>

      <!-- Selected Employee Details Summary Badge -->
      <div id="${idPrefix}-tech-selected-card" style="display: none; background: rgba(2, 132, 199, 0.12); border: 1px dashed rgba(56, 189, 248, 0.4); border-radius: 8px; padding: 10px 14px;">
        <!-- Dynamically rendered on selection -->
      </div>

    </div>
  `;
}

function bindTechnicianSearchEvents({ idPrefix, onSelected = null }) {
  const searchInp = document.getElementById(`${idPrefix}-tech-search`);
  const hiddenInp = document.getElementById(`${idPrefix}-tech`);
  const autoBox = document.getElementById(`${idPrefix}-tech-autocomplete`);
  const cardBox = document.getElementById(`${idPrefix}-tech-selected-card`);
  const btnQuickAdd = document.querySelector(`.btn-open-quick-emp-${idPrefix}`);

  let activeHighlight = -1;
  let currentList = [];

  const updateSelectedCard = (emp) => {
    if (!cardBox) return;
    if (!emp) {
      cardBox.style.display = 'none';
      cardBox.innerHTML = '';
      return;
    }
    cardBox.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="background: rgba(56, 189, 248, 0.25); border: 1px solid rgba(56, 189, 248, 0.5); color: #38bdf8; font-family: var(--font-mono); font-weight: 800; font-size: 12px; padding: 4px 8px; border-radius: 6px;">
            🪪 Card #${emp.cardNumber}
          </div>
          <div>
            <div style="font-size: 13px; font-weight: 800; color: #fff;">${emp.name}</div>
            <div style="font-size: 11px; color: var(--text-secondary); margin-top: 1px;">
              🏷️ ${emp.designation} &bull; 🏢 ${emp.floor} &bull; 📅 Joined: ${emp.joinDate || 'N/A'} ${emp.phone ? `&bull; 📞 ${emp.phone}` : ''}
            </div>
          </div>
        </div>
        <button type="button" class="btn btn-ghost btn-sm btn-clear-tech" style="font-size: 11px; color: #f87171; padding: 2px 6px;" title="Clear Assignment">
          ✕ Change
        </button>
      </div>
    `;
    cardBox.style.display = 'block';

    cardBox.querySelector('.btn-clear-tech')?.addEventListener('click', () => {
      searchInp.value = '';
      hiddenInp.value = '';
      updateSelectedCard(null);
      searchInp.focus({ preventScroll: true });
    });
  };

  const selectEmployee = (emp) => {
    if (!emp) return;
    const formatted = `${emp.name} [Card: ${emp.cardNumber}] (${emp.designation || 'Technician'})`;
    hiddenInp.value = formatted;
    searchInp.value = `${emp.name} (Card #${emp.cardNumber})`;
    autoBox.style.display = 'none';
    updateSelectedCard(emp);
    if (onSelected) onSelected(emp);
  };

  const renderEmpSuggestions = (list) => {
    currentList = list;
    activeHighlight = -1;
    if (!list || list.length === 0) {
      autoBox.innerHTML = `
        <div style="padding: 12px 14px; font-size: 12px; color: var(--text-muted); text-align: center;">
          No matching employee found. Click <strong>"➕ Quick Add Employee / Card"</strong> to register new.
        </div>
      `;
      autoBox.style.display = 'block';
      return;
    }

    autoBox.innerHTML = list.map((emp, idx) => `
      <div class="emp-suggest-row" data-idx="${idx}" style="padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,0.06); cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: background 0.15s;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="background: rgba(56, 189, 248, 0.2); border: 1px solid rgba(56, 189, 248, 0.35); color: #38bdf8; font-family: var(--font-mono); font-weight: 800; font-size: 12px; padding: 3px 8px; border-radius: 5px;">
            🪪 #${emp.cardNumber}
          </div>
          <div>
            <div style="font-weight: 700; font-size: 13px; color: #fff;">${emp.name}</div>
            <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">
              🏷️ ${emp.designation} &bull; 🏢 ${emp.floor}
            </div>
          </div>
        </div>
        <div style="text-align: right; font-size: 10.5px; color: var(--text-muted);">
          <div>📅 ${emp.joinDate || 'Joined'}</div>
          ${emp.phone ? `<div style="color: #38bdf8;">${emp.phone}</div>` : ''}
        </div>
      </div>
    `).join('');

    autoBox.style.display = 'block';

    autoBox.querySelectorAll('.emp-suggest-row').forEach(row => {
      row.addEventListener('click', () => {
        const idx = Number(row.getAttribute('data-idx'));
        selectEmployee(currentList[idx]);
      });
      row.addEventListener('mouseenter', () => {
        row.style.background = 'rgba(2, 132, 199, 0.25)';
      });
      row.addEventListener('mouseleave', () => {
        row.style.background = 'transparent';
      });
    });
  };

  searchInp?.addEventListener('input', (e) => {
    hiddenInp.value = e.target.value;
    const matches = employeeService.searchEmployees(e.target.value);
    renderEmpSuggestions(matches);
  });

  searchInp?.addEventListener('focus', () => {
    const matches = employeeService.searchEmployees(searchInp.value);
    renderEmpSuggestions(matches);
  });

  document.addEventListener('click', (evt) => {
    if (!searchInp?.contains(evt.target) && !autoBox?.contains(evt.target)) {
      if (autoBox) autoBox.style.display = 'none';
    }
  });

  // Quick add button
  btnQuickAdd?.addEventListener('click', () => {
    openQuickAddEmployeeModal((newEmp) => {
      selectEmployee(newEmp);
    });
  });

  // Pre-match initial value if present
  if (hiddenInp && hiddenInp.value) {
    const existing = employeeService.searchEmployees(hiddenInp.value)[0];
    if (existing) {
      updateSelectedCard(existing);
    }
  }
}

/**
 * Log Service & Repair Modal
 */
function openLogServiceModal() {
  const user = authService.getCurrentUser();
  const machine = historyService.findMachineBySerialOnly(searchedSerial);
  const curSerial = machine ? machine.serialNumber : (searchedSerial || '');
  const curFloor = machine ? storage.getItem(TABLE_NAMES.FLOORS, machine.floorId)?.name || 'Jamuna Floor' : 'Jamuna Floor';

  const modalHtml = `
    <div class="modal-overlay" id="service-repair-modal-overlay">
      <div class="modal-dialog" style="max-width: 680px; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.7);">
        <div class="modal-header" style="background: var(--bg-card); border-bottom: 1px solid var(--border-color); padding: 14px 20px;">
          <div class="modal-title" style="display: flex; align-items: center; gap: 8px;">
            <span>🛠️ Log Machine Service &amp; Repair Record</span>
          </div>
          <button class="btn btn-ghost btn-sm btn-close-svc-modal">✕</button>
        </div>

        <form id="form-log-service-repair" style="display: flex; flex-direction: column; min-height: 0; flex: 1; overflow: hidden;">
          <div class="modal-body" style="padding: 20px; display: flex; flex-direction: column; gap: 14px; max-height: 80vh; overflow-y: auto; flex: 1; min-height: 0;">
            
            <!-- Machine Serial & Location at that time -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div class="form-group">
                <label class="form-label required" style="font-weight: 700; color: #38bdf8;">Machine Serial Number</label>
                <input type="text" id="svc-serial-number" class="form-control" value="${curSerial}" placeholder="e.g. MCH-00125" required style="font-family: var(--font-mono); font-weight: 700;" />
              </div>
              <div class="form-group">
                <label class="form-label required" style="font-weight: 700; color: #fbbf24;">Location / Floor at that time</label>
                <input type="text" id="svc-floor-location" class="form-control" value="${curFloor}" placeholder="e.g. Jamuna Floor, Titas Floor, Chitra Floor" required />
              </div>
            </div>

            <!-- Service Date & Service Type -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div class="form-group">
                <label class="form-label required">Service / Repair Date</label>
                <input type="date" id="svc-date" class="form-control" value="${new Date().toISOString().split('T')[0]}" required />
              </div>

              <div class="form-group">
                <label class="form-label required">Service Type</label>
                <select id="svc-type-select" class="form-control" required style="font-weight: 700;">
                  <option value="REPAIR" selected>🔧 Repair</option>
                  <option value="SERVICING">🛠️ Servicing</option>
                  <option value="PREVENTIVE_MAINTENANCE">🛡️ Preventive Maintenance</option>
                  <option value="BREAKDOWN">⚡ Breakdown</option>
                </select>
              </div>
            </div>

            <!-- Problem / Complaint -->
            <div class="form-group">
              <label class="form-label required">Problem / Complaint</label>
              <textarea id="svc-problem" class="form-control" rows="2" placeholder="Describe the fault or symptom (e.g. Motor overheating, needle deflection, power error E-01)..." required></textarea>
            </div>

            <!-- Work Performed -->
            <div class="form-group">
              <label class="form-label required">Work Performed</label>
              <textarea id="svc-work" class="form-control" rows="2" placeholder="Details of mechanical / electrical actions taken..." required></textarea>
            </div>

            <!-- Spare Parts Used section -->
            <div style="background: rgba(15, 23, 42, 0.7); border: 1px solid var(--border-color); border-radius: 8px; padding: 14px; display: flex; flex-direction: column; gap: 10px;">
              <div style="font-weight: 700; font-size: 13px; color: #34d399; display: flex; align-items: center; gap: 6px;">
                <span>⚙️ Spare Parts Details (If Replaced / Installed)</span>
              </div>

              <div style="display: grid; grid-template-columns: 2fr 1.5fr 0.8fr; gap: 10px;">
                <div class="form-group" style="margin-bottom: 0; position: relative;">
                  <label class="form-label" style="font-size: 11.5px;">Spare Parts Used (Smart Search)</label>
                  <input type="text" id="svc-part-name" class="form-control" placeholder="Type e.g. 'mo', 'nee', 'SP-001'..." autocomplete="off" />
                  <div 
                    id="svc-spare-autocomplete-results" 
                    style="display: none; position: absolute; top: calc(100% + 2px); left: 0; right: 0; background: #0b1329; border: 1.5px solid #0284c7; border-radius: 8px; max-height: 200px; overflow-y: auto; z-index: 10000; box-shadow: 0 10px 30px rgba(0,0,0,0.8);"
                  ></div>
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                  <label class="form-label" style="font-size: 11.5px;">Spare Part Serial Number</label>
                  <input type="text" id="svc-part-serial" class="form-control" placeholder="e.g. MOT-9921, PCB-8800A" style="font-family: var(--font-mono);" />
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                  <label class="form-label" style="font-size: 11.5px;">Quantity</label>
                  <input type="number" id="svc-part-qty" class="form-control" value="1" min="0" />
                </div>
              </div>
            </div>

            <!-- Smart Technician Card Search Component -->
            ${renderTechnicianSearchSection({
              idPrefix: 'svc',
              label: 'Assigned Technician / Mechanic / Engineer',
              required: true,
              defaultVal: user?.name || ''
            })}

            <div class="form-group">
              <label class="form-label">Remarks / Quality Notes</label>
              <textarea id="svc-remarks" class="form-control" rows="2" placeholder="Test sewing results, fabric type notes, clearance calibration..."></textarea>
            </div>

          </div>

          <div class="modal-footer" style="padding: 14px 20px; display: flex; justify-content: space-between; align-items: center; background: var(--bg-card); border-top: 1px solid var(--border-color);">
            <button type="button" class="btn btn-secondary btn-close-svc-modal">Cancel</button>
            <button type="submit" class="btn btn-primary" style="font-weight: 700; box-shadow: 0 2px 10px rgba(2, 132, 199, 0.4);">
              Save Service &amp; Repair Record
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  const overlay = document.getElementById('service-repair-modal-overlay');
  const close = () => overlay?.remove();

  overlay.querySelectorAll('.btn-close-svc-modal').forEach(b => b.addEventListener('click', close));

  // Initialize Technician Card Search Events
  bindTechnicianSearchEvents({ idPrefix: 'svc' });

  // Smart Autocomplete for Service Modal Spare Part
  const svcPartNameInp = document.getElementById('svc-part-name');
  const svcPartAutoBox = document.getElementById('svc-spare-autocomplete-results');
  const svcPartQtyInp = document.getElementById('svc-part-qty');

  if (svcPartNameInp && svcPartAutoBox) {
    const renderSvcSuggestions = (list) => {
      if (!list || list.length === 0) {
        svcPartAutoBox.style.display = 'none';
        return;
      }
      svcPartAutoBox.innerHTML = list.map((item, idx) => `
        <div class="svc-spare-item" data-idx="${idx}" style="padding: 6px 10px; border-bottom: 1px solid rgba(255,255,255,0.06); cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-weight: 700; font-size: 12px; color: #fff;">${item.name}</div>
            <div style="font-size: 10px; color: var(--text-secondary);">${item.category}</div>
          </div>
          <span class="badge" style="background: rgba(2, 132, 199, 0.2); color: #38bdf8; font-size: 10px;">${item.code}</span>
        </div>
      `).join('');
      svcPartAutoBox.style.display = 'block';

      svcPartAutoBox.querySelectorAll('.svc-spare-item').forEach(el => {
        el.addEventListener('click', () => {
          const idx = Number(el.getAttribute('data-idx'));
          const it = list[idx];
          if (it) {
            svcPartNameInp.value = it.name;
            svcPartAutoBox.style.display = 'none';
            if (svcPartQtyInp) svcPartQtyInp.focus({ preventScroll: true });
          }
        });
        el.addEventListener('mouseenter', () => el.style.background = 'rgba(2, 132, 199, 0.25)');
        el.addEventListener('mouseleave', () => el.style.background = 'transparent');
      });
    };

    svcPartNameInp.addEventListener('input', (e) => {
      renderSvcSuggestions(historyService.searchSparePartsMaster(e.target.value));
    });
    svcPartNameInp.addEventListener('focus', () => {
      renderSvcSuggestions(historyService.searchSparePartsMaster(svcPartNameInp.value));
    });
    document.addEventListener('click', (evt) => {
      if (!svcPartNameInp.contains(evt.target) && !svcPartAutoBox.contains(evt.target)) {
        svcPartAutoBox.style.display = 'none';
      }
    });
  }

  document.getElementById('form-log-service-repair')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const sn = document.getElementById('svc-serial-number').value.trim();
    const floor = document.getElementById('svc-floor-location').value.trim();
    const sDate = document.getElementById('svc-date').value;
    const sType = document.getElementById('svc-type-select').value;
    const problem = document.getElementById('svc-problem').value.trim();
    const work = document.getElementById('svc-work').value.trim();
    const partName = document.getElementById('svc-part-name').value.trim();
    const partSerial = document.getElementById('svc-part-serial').value.trim();
    const partQty = document.getElementById('svc-part-qty').value;
    const tech = document.getElementById('svc-tech').value.trim() || document.getElementById('svc-tech-search')?.value.trim();
    const remarks = document.getElementById('svc-remarks').value.trim();

    try {
      historyService.addServiceRecord({
        serialNumber: sn,
        serviceDate: sDate,
        floorLocation: floor,
        serviceType: sType,
        problemComplaint: problem,
        workPerformed: work,
        sparePartsUsed: partName,
        sparePartSerial: partSerial,
        sparePartQty: partQty,
        technician: tech,
        remarks: remarks
      });

      searchedSerial = sn;
      close();
      window.dispatchEvent(new CustomEvent('erp:master-data-updated'));
    } catch (err) {
      alert('Failed to save service record: ' + err.message);
    }
  });
}

/**
 * Log Spare Part Replacement Modal
 */
function openAddSparePartModal() {
  const user = authService.getCurrentUser();
  const machine = historyService.findMachineBySerialOnly(searchedSerial);
  const defaultSerial = machine ? machine.serialNumber : (searchedSerial || '');
  const defaultFloor = machine ? storage.getItem(TABLE_NAMES.FLOORS, machine.floorId)?.name || 'Jamuna Floor' : 'Jamuna Floor';

  const modalHtml = `
    <div class="modal-overlay" id="add-spare-modal-overlay">
      <div class="modal-dialog" style="max-width: 680px; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.7);">
        
        <!-- Header -->
        <div class="modal-header" style="background: linear-gradient(135deg, #0284c7, #0369a1); padding: 16px 22px; display: flex; justify-content: space-between; align-items: center;">
          <div class="modal-title" style="display: flex; align-items: center; gap: 10px; color: #fff;">
            <span style="font-size: 22px;">⚙️</span>
            <div>
              <div style="font-size: 16px; font-weight: 800; color: #fff;">Log Machine Spare Part Replacement</div>
              <div style="font-size: 11px; color: #e0f2fe; margin-top: 2px;">
                Record component replacement, spare part serials &amp; mechanic assignment
              </div>
            </div>
          </div>
          <button class="btn btn-ghost btn-sm btn-close-spare-modal" style="color: #fff; font-size: 18px;">✕</button>
        </div>

        <form id="form-add-spare-part" style="display: flex; flex-direction: column; min-height: 0; flex: 1; overflow: hidden;">
          <div class="modal-body" style="padding: 20px 22px; display: flex; flex-direction: column; gap: 14px; max-height: 82vh; overflow-y: auto; flex: 1; min-height: 0;">
            
            <!-- SECTION 1: TARGET MACHINE & LOCATION -->
            <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 12px 14px;">
              <div style="font-size: 11px; font-weight: 800; color: #38bdf8; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.5px;">
                📍 1. Target Machine &amp; Location
              </div>

              <div class="form-group" style="margin-bottom: 10px;">
                <label class="form-label required" style="font-weight: 700; color: #fff; font-size: 12px; margin-bottom: 4px;">
                  Machine Serial Number(s) <span style="font-weight: normal; color: #94a3b8;">(One per line, up to 500)</span>
                </label>
                <textarea 
                  id="modal-spare-serials" 
                  class="form-control" 
                  rows="2" 
                  placeholder="e.g. JA-02&#10;JK-PM-00001" 
                  style="font-family: var(--font-mono); font-size: 13px; font-weight: 700; background: #080d1a; color: #38bdf8;"
                  required
                >${defaultSerial}</textarea>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div class="form-group" style="margin-bottom: 0;">
                  <label class="form-label required" style="font-weight: 700; color: #fbbf24; font-size: 12px;">Floor / Location</label>
                  <input type="text" id="modal-spare-floor" class="form-control" value="${defaultFloor}" placeholder="e.g. Jamuna Floor, Titas Floor, Chitra Floor" required />
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                  <label class="form-label required" style="font-size: 12px;">Replacement Date</label>
                  <input type="date" id="modal-spare-date" class="form-control" value="${new Date().toISOString().split('T')[0]}" required />
                </div>
              </div>
            </div>

            <!-- SECTION 2: SPARE PART INFORMATION (SMART AUTOCOMPLETE) -->
            <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 12px 14px;">
              <div style="font-size: 11px; font-weight: 800; color: #34d399; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.5px;">
                ⚙️ 2. Spare Part Information &amp; Autocomplete
              </div>

              <div style="display: grid; grid-template-columns: 1.4fr 1fr; gap: 10px; margin-bottom: 10px;">
                <div class="form-group" style="margin-bottom: 0; position: relative;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <label class="form-label required" style="margin: 0; font-weight: 700; color: #34d399; font-size: 12px;">
                      Spare Part Name (Smart Search)
                    </label>
                    <span style="font-size: 10.5px; color: #38bdf8; font-family: var(--font-mono);">
                      Type &rarr; Suggest &rarr; Select
                    </span>
                  </div>
                  <input 
                    type="text" 
                    id="modal-spare-name" 
                    class="form-control" 
                    placeholder="Type e.g. 'mo' (Motor), 'nee' (Needle Bar), 'SP-001'..." 
                    autocomplete="off"
                    required 
                    style="font-weight: 700; color: #38bdf8; font-size: 13px;"
                  />
                  <!-- Floating Autocomplete Dropdown -->
                  <div 
                    id="spare-autocomplete-results" 
                    style="display: none; position: absolute; top: calc(100% + 2px); left: 0; right: 0; background: #0b1329; border: 1.5px solid #0284c7; border-radius: 8px; max-height: 240px; overflow-y: auto; z-index: 10000; box-shadow: 0 10px 30px rgba(0,0,0,0.8);"
                  ></div>
                </div>

                <div class="form-group" style="margin-bottom: 0; position: relative;">
                  <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Spare Part Serial Number</label>
                  <input 
                    type="text" 
                    id="modal-spare-part-sn" 
                    class="form-control" 
                    placeholder="e.g. MOT-9921, PCB-8800A, SP-001" 
                    autocomplete="off"
                    style="font-family: var(--font-mono); color: #fff; font-size: 13px;" 
                  />
                  <!-- Floating Autocomplete for Serial -->
                  <div 
                    id="spare-sn-autocomplete-results" 
                    style="display: none; position: absolute; top: calc(100% + 2px); left: 0; right: 0; background: #0b1329; border: 1.5px solid #0284c7; border-radius: 8px; max-height: 200px; overflow-y: auto; z-index: 10000; box-shadow: 0 10px 30px rgba(0,0,0,0.8);"
                  ></div>
                </div>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1.5fr; gap: 10px;">
                <div class="form-group" style="margin-bottom: 0;">
                  <label class="form-label required" style="font-size: 12px;">Quantity</label>
                  <input type="number" id="modal-spare-qty" class="form-control" value="1" min="1" required style="font-weight: 800; font-size: 14px;" />
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                  <label class="form-label" style="font-size: 12px;">Part Number / Code</label>
                  <input type="text" id="modal-spare-number" class="form-control" placeholder="e.g. SP-001, MOT-550W-DD" style="font-family: var(--font-mono);" />
                </div>
              </div>
            </div>

            <!-- SECTION 3: OLD PART VS NEW PART & REASON -->
            <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 12px 14px;">
              <div style="font-size: 11px; font-weight: 800; color: #fbbf24; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.5px;">
                🔍 3. Specifications &amp; Replacement Reason
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                <div class="form-group" style="margin-bottom: 0;">
                  <label class="form-label" style="font-size: 11.5px;">Old Part Condition / Serial</label>
                  <input type="text" id="modal-spare-old-part" class="form-control" placeholder="e.g. Defective burnt coil (Old S/N: MOT-8812)" />
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                  <label class="form-label" style="font-size: 11.5px;">New Part Specification</label>
                  <input type="text" id="modal-spare-new-part" class="form-control" placeholder="e.g. Genuine OEM JUKI 550W (New S/N: MOT-9921)" />
                </div>
              </div>

              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label" style="font-size: 11.5px;">Reason for Replacement</label>
                <input type="text" id="modal-spare-reason" class="form-control" placeholder="e.g. Motor replaced due to coil overheating" />
              </div>
            </div>

            <!-- SECTION 4: ASSIGNED TECHNICIAN / MECHANIC (SMART CARD & NAME SEARCH) -->
            ${renderTechnicianSearchSection({
              idPrefix: 'modal-spare',
              label: 'Assigned Technician / Mechanic / Engineer',
              required: false,
              defaultVal: user?.name || ''
            })}

            <!-- SECTION 5: REMARKS -->
            <div class="form-group">
              <label class="form-label" style="font-size: 12px; font-weight: 700; color: #fff;">Remarks / Quality Notes</label>
              <textarea id="modal-spare-remarks" class="form-control" rows="2" placeholder="e.g. 10-01-2025 — Jamuna Floor — Motor replaced and test run verified."></textarea>
            </div>

          </div>

          <div class="modal-footer" style="padding: 14px 22px; display: flex; justify-content: space-between; align-items: center; background: var(--bg-card); border-top: 1px solid var(--border-color);">
            <button type="button" class="btn btn-secondary btn-close-spare-modal">Cancel</button>
            <button type="submit" class="btn btn-primary" style="font-weight: 800; padding: 9px 24px; box-shadow: 0 4px 15px rgba(2, 132, 199, 0.4);">
              💾 Save Spare Part Record
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  const overlay = document.getElementById('add-spare-modal-overlay');
  const close = () => overlay?.remove();

  overlay.querySelectorAll('.btn-close-spare-modal').forEach(b => b.addEventListener('click', close));

  // Initialize Technician Card Search Events
  bindTechnicianSearchEvents({ idPrefix: 'modal-spare' });

  // Smart Autocomplete Logic for Spare Parts Search
  const spareNameInp = document.getElementById('modal-spare-name');
  const spareAutoBox = document.getElementById('spare-autocomplete-results');
  const partSnInp = document.getElementById('modal-spare-part-sn');
  const partSnAutoBox = document.getElementById('spare-sn-autocomplete-results');
  const partNoInp = document.getElementById('modal-spare-number');
  const newPartInp = document.getElementById('modal-spare-new-part');
  const qtyInp = document.getElementById('modal-spare-qty');

  let activeHighlightIndex = -1;
  let currentSuggestions = [];

  const renderSuggestions = (list, targetBox = spareAutoBox) => {
    currentSuggestions = list;
    activeHighlightIndex = -1;
    if (!list || list.length === 0) {
      targetBox.innerHTML = `
        <div style="padding: 10px 14px; font-size: 12px; color: var(--text-muted); text-align: center;">
          No matching parts. You can enter a custom name or serial.
        </div>
      `;
      targetBox.style.display = 'block';
      return;
    }

    targetBox.innerHTML = list.map((item, idx) => `
      <div class="spare-suggest-item" data-idx="${idx}" style="padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,0.06); cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: background 0.15s;">
        <div style="flex: 1; padding-right: 8px;">
          <div style="font-weight: 700; font-size: 13px; color: #fff; display: flex; align-items: center; gap: 8px;">
            <span>${item.name}</span>
            ${item.partSerialNumber ? `<span style="font-family: var(--font-mono); color: #38bdf8; font-size: 11px;">[S/N: ${item.partSerialNumber}]</span>` : ''}
            ${item.brandModelOrigin ? `<span class="badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; font-size: 10px;">${item.brandModelOrigin}</span>` : ''}
          </div>
          <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">
            ${item.areaOfUse || item.description || 'General Sewing'}
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 6px;">
          <span class="badge" style="background: rgba(2, 132, 199, 0.2); color: #38bdf8; font-family: monospace; font-size: 10.5px; border: 1px solid rgba(56, 189, 248, 0.3);">${item.code || 'N/A'}</span>
          ${item.category ? `<span class="badge" style="background: rgba(52, 211, 153, 0.15); color: #34d399; font-size: 10px;">${item.category}</span>` : ''}
        </div>
      </div>
    `).join('');

    targetBox.style.display = 'block';

    // Click handler for suggestion items
    targetBox.querySelectorAll('.spare-suggest-item').forEach(el => {
      el.addEventListener('click', () => {
        const idx = Number(el.getAttribute('data-idx'));
        selectSpareSuggestion(currentSuggestions[idx]);
      });
      el.addEventListener('mouseenter', () => {
        el.style.background = 'rgba(2, 132, 199, 0.25)';
      });
      el.addEventListener('mouseleave', () => {
        el.style.background = 'transparent';
      });
    });
  };

  const selectSpareSuggestion = (item) => {
    if (!item) return;
    if (spareNameInp) spareNameInp.value = item.name;
    if (partNoInp && item.code) partNoInp.value = item.code;
    if (partSnInp && item.partSerialNumber) {
      partSnInp.value = item.partSerialNumber;
    }
    const originSpec = item.brandModelOrigin ? ` [${item.brandModelOrigin}]` : '';
    if (newPartInp) newPartInp.value = `Genuine ${item.name} (${item.code || 'N/A'})${originSpec} - ${item.areaOfUse || item.description || ''}`;
    
    if (spareAutoBox) spareAutoBox.style.display = 'none';
    if (partSnAutoBox) partSnAutoBox.style.display = 'none';

    // Flow: focus serial number if empty, else focus quantity
    if (partSnInp && !partSnInp.value) {
      partSnInp.focus({ preventScroll: true });
    } else if (qtyInp) {
      qtyInp.focus({ preventScroll: true });
      qtyInp.select();
    }
  };

  // Autocomplete for Spare Part Name
  spareNameInp?.addEventListener('input', (e) => {
    const q = e.target.value;
    const matches = historyService.searchSparePartsMaster(q);
    renderSuggestions(matches, spareAutoBox);
  });

  spareNameInp?.addEventListener('focus', () => {
    const matches = historyService.searchSparePartsMaster(spareNameInp.value);
    renderSuggestions(matches, spareAutoBox);
  });

  // Autocomplete for Spare Part Serial Number
  partSnInp?.addEventListener('input', (e) => {
    const q = e.target.value;
    const matches = historyService.searchSparePartsMaster(q);
    renderSuggestions(matches, partSnAutoBox);
  });

  partSnInp?.addEventListener('focus', () => {
    if (partSnInp.value) {
      const matches = historyService.searchSparePartsMaster(partSnInp.value);
      renderSuggestions(matches, partSnAutoBox);
    }
  });

  // Keyboard Navigation: ArrowDown, ArrowUp, Enter, Escape
  spareNameInp?.addEventListener('keydown', (e) => {
    if (spareAutoBox.style.display !== 'block' || currentSuggestions.length === 0) return;

    const items = spareAutoBox.querySelectorAll('.spare-suggest-item');

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeHighlightIndex = (activeHighlightIndex + 1) % currentSuggestions.length;
      updateHighlight(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeHighlightIndex = (activeHighlightIndex - 1 + currentSuggestions.length) % currentSuggestions.length;
      updateHighlight(items);
    } else if (e.key === 'Enter') {
      if (activeHighlightIndex >= 0 && activeHighlightIndex < currentSuggestions.length) {
        e.preventDefault();
        selectSpareSuggestion(currentSuggestions[activeHighlightIndex]);
      }
    } else if (e.key === 'Escape') {
      spareAutoBox.style.display = 'none';
    }
  });

  const updateHighlight = (items) => {
    items.forEach((it, idx) => {
      if (idx === activeHighlightIndex) {
        it.style.background = 'rgba(2, 132, 199, 0.4)';
        it.scrollIntoView({ block: 'nearest' });
      } else {
        it.style.background = 'transparent';
      }
    });
  };

  // Close dropdown on outside click
  document.addEventListener('click', (evt) => {
    if (!spareNameInp?.contains(evt.target) && !spareAutoBox?.contains(evt.target)) {
      if (spareAutoBox) spareAutoBox.style.display = 'none';
    }
    if (!partSnInp?.contains(evt.target) && !partSnAutoBox?.contains(evt.target)) {
      if (partSnAutoBox) partSnAutoBox.style.display = 'none';
    }
  });

  document.getElementById('form-add-spare-part')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const rawSerials = document.getElementById('modal-spare-serials').value.split(/\r?\n/).map(s => s.trim()).filter(s => s.length > 0);
    if (rawSerials.length === 0) {
      alert('Please enter at least one valid Machine Serial Number.');
      return;
    }

    const floor = document.getElementById('modal-spare-floor').value.trim();
    const rDate = document.getElementById('modal-spare-date').value;
    const partName = document.getElementById('modal-spare-name').value.trim();
    const partSN = document.getElementById('modal-spare-part-sn').value.trim();
    const partNo = document.getElementById('modal-spare-number').value.trim();
    const oldPart = document.getElementById('modal-spare-old-part')?.value.trim() || '';
    const newPart = document.getElementById('modal-spare-new-part')?.value.trim() || '';
    const qty = document.getElementById('modal-spare-qty').value;
    const reason = document.getElementById('modal-spare-reason').value.trim();
    const tech = document.getElementById('modal-spare-tech').value.trim() || document.getElementById('modal-spare-tech-search')?.value.trim();
    const remarks = document.getElementById('modal-spare-remarks').value.trim();

    try {
      historyService.addBatchSparePartReplacements({
        serialNumbers: rawSerials,
        partName: partName,
        partNumber: partNo,
        partSerialNumber: partSN,
        oldPart: oldPart,
        newPart: newPart,
        quantity: qty,
        floorLocation: floor,
        replacementDate: rDate,
        replacementReason: reason,
        technician: tech,
        remarks: remarks
      });

      searchedSerial = rawSerials[0];
      close();
      window.dispatchEvent(new CustomEvent('erp:master-data-updated'));
    } catch (err) {
      alert('Failed to log spare parts: ' + err.message);
    }
  });
}

/**
 * Spare Parts Excel Import Modal (Master Catalog & Replacement Logs)
 */
export function openSparePartsImportModal() {
  const modalHtml = `
    <div class="modal-overlay" id="spare-import-modal-overlay">
      <div class="modal-dialog" style="max-width: 720px;">
        <div class="modal-header" style="background: var(--bg-card); border-bottom: 1px solid var(--border-color); padding: 14px 20px;">
          <div class="modal-title" style="display: flex; align-items: center; gap: 8px;">
            <span>📥 Import Spare Parts from Excel</span>
          </div>
          <button class="btn btn-ghost btn-sm btn-close-spare-import">✕</button>
        </div>

        <div class="modal-body" style="padding: 20px; display: flex; flex-direction: column; gap: 14px;">
          
          <!-- Mode Selection -->
          <div style="background: rgba(15, 23, 42, 0.8); border: 1px solid var(--border-color); border-radius: 8px; padding: 12px 16px;">
            <div style="font-size: 11px; color: var(--text-muted); font-weight: 700; text-transform: uppercase; margin-bottom: 8px;">
              Select Import Type
            </div>
            <div style="display: flex; gap: 16px;">
              <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 13px; font-weight: 700; color: #38bdf8;">
                <input type="radio" name="spare-import-mode" value="MASTER" checked />
                <span>📚 1. Spare Parts Master Catalog (For Autocomplete Search)</span>
              </label>
              <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 13px; font-weight: 600; color: var(--text-primary);">
                <input type="radio" name="spare-import-mode" value="REPLACEMENTS" />
                <span>⚙️ 2. Machine Replacement Logs (Lifetime History)</span>
              </label>
            </div>
          </div>

          <!-- Description & Template download -->
          <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(2, 132, 199, 0.08); border: 1px solid rgba(2, 132, 199, 0.3); border-radius: 6px; padding: 10px 14px;">
            <div style="font-size: 12px; color: var(--text-secondary);" id="spare-import-desc-text">
              Upload master catalog to enable auto-suggestions (Fields: <code>Spare Part Name, Part Code, Category, Unit, Description</code>).
            </div>
            <button id="btn-dl-spare-template" class="btn btn-secondary btn-sm" style="white-space: nowrap; font-size: 11px; font-weight: 700; border-color: #38bdf8; color: #38bdf8;">
              📋 Download Template
            </button>
          </div>

          <div id="spare-excel-dropzone" style="border: 2px dashed #38bdf8; border-radius: var(--radius-md); padding: 28px 20px; text-align: center; background: rgba(56, 189, 248, 0.04); cursor: pointer; transition: all 0.2s;">
            <div style="font-size: 36px; margin-bottom: 6px;">📊</div>
            <div style="font-size: 14px; font-weight: 700; color: #fff;">Click to select or drag &amp; drop Excel file (.xlsx / .xls)</div>
            <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 4px;">Supports all standard Excel workbooks &amp; sheets</div>
            <input type="file" id="spare-file-input" accept=".xlsx, .xls" style="display: none;" />
          </div>

          <div id="spare-import-feedback" style="display: none; padding: 12px; border-radius: 6px; font-size: 12.5px;"></div>
        </div>

        <div class="modal-footer" style="display: flex; justify-content: space-between; align-items: center; padding: 14px 20px; background: var(--bg-card); border-top: 1px solid var(--border-color);">
          <button class="btn btn-secondary btn-sm btn-close-spare-import">Cancel</button>
          <button id="btn-execute-spare-import" class="btn btn-primary" disabled style="font-weight: 700;">Commit Excel Import</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  const overlay = document.getElementById('spare-import-modal-overlay');
  const close = () => overlay?.remove();

  overlay.querySelectorAll('.btn-close-spare-import').forEach(b => b.addEventListener('click', close));

  const dropzone = document.getElementById('spare-excel-dropzone');
  const fileInput = document.getElementById('spare-file-input');
  const feedback = document.getElementById('spare-import-feedback');
  const btnCommit = document.getElementById('btn-execute-spare-import');
  const btnDlTemplate = document.getElementById('btn-dl-spare-template');
  const descText = document.getElementById('spare-import-desc-text');

  let fileBuffer = null;

  document.querySelectorAll('input[name="spare-import-mode"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.value === 'MASTER') {
        descText.innerHTML = `Clean 3-column structure: <code>Item Name | Area of Use / Description | Brand / Model / Origin</code>. SL. No. is generated automatically. Duplicates are detected before saving.`;
      } else {
        descText.innerHTML = `Upload historical replacement activity logs (Fields: <code>Machine Serial, Floor, Part Name, Part S/N, Quantity, Date, Reason, Technician</code>).`;
      }
    });
  });

  btnDlTemplate.addEventListener('click', () => {
    const isMaster = document.querySelector('input[name="spare-import-mode"]:checked')?.value === 'MASTER';
    if (typeof XLSX === 'undefined') {
      alert('Excel library not loaded.');
      return;
    }

    const wb = XLSX.utils.book_new();
    if (isMaster) {
      const data = [
        ['Item Name', 'Area of Use / Description', 'Brand / Model / Origin'],
        ['Motor', 'Main Drive Unit / Machine Motor', 'JUKI / DDL-8700-7 / Japan'],
        ['Motor Belt', 'Motor Power Transmission', 'Universal / M-38 / China'],
        ['Motor Pulley', 'Motor Shaft Drive Assembly', 'JUKI / 65mm / Japan'],
        ['Motor Coupling', 'Direct Drive Shaft Connector', 'JACK / A4 / China'],
        ['Motor Carbon Brush', 'Clutch Motor Commutator', 'National / Standard / Taiwan'],
        ['Needle Bar', 'Plane & Overlock Needle Assembly', 'JUKI / DDL-9000 / Japan'],
        ['Needle Clamp', 'Needle Holding Clamp Mechanism', 'Brother / S-7200C / Japan'],
        ['Needle Plate', 'Bed Throat Plate for Fabric Feeding', 'JUKI / E-18 / Japan'],
        ['Needle Feed Dog', 'Fabric Feeding Dog Mechanism', 'JUKI / B-24 / Japan'],
        ['Needle Thread Guide', 'Upper Needle Bar Thread Eyelet', 'JUKI / Standard / Japan'],
        ['Rotary Hook / Shuttle', 'Lower Stitch Formation & Bobbin', 'Hirose / Koban / Japan'],
        ['Bobbin Case & Bobbin', 'Under-thread Bobbin Housing', 'Towa / Standard / Japan'],
        ['Main Control PCB Board', 'Main Machine Control Box Electronics', 'JUKI / SC-920 / Japan'],
        ['Upper & Lower Knife Blades', 'Overlock & Interlock Fabric Trimming', 'Pegasus / M700 / Japan']
      ];
      const ws = XLSX.utils.aoa_to_sheet(data);
      ws['!cols'] = [{ wch: 28 }, { wch: 42 }, { wch: 34 }];
      XLSX.utils.book_append_sheet(wb, ws, 'Spare Parts Master');
      XLSX.writeFile(wb, 'Spare_Parts_Master_Template.xlsx');
    } else {
      const data = [
        ['Machine Serial', 'Floor / Location', 'Replacement Date', 'Spare Part Name', 'Part Serial Number', 'Part Code', 'Quantity', 'Replacement Reason', 'Technician', 'Remarks'],
        ['JA-01', 'Jamuna Floor', new Date().toISOString().split('T')[0], 'Motor', 'MOT-9921', 'SP-001', 1, 'Coil burnt due to voltage spike', 'Rahim Tech', 'Motor replaced & calibrated'],
        ['BG-01', 'Buriganga Floor', new Date().toISOString().split('T')[0], 'Needle Bar', 'NB-4410', 'SP-003', 1, 'Worn needle clamp thread', 'Karim Engineer', 'Routine overhaul']
      ];
      const ws = XLSX.utils.aoa_to_sheet(data);
      ws['!cols'] = [{ wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 22 }, { wch: 18 }, { wch: 14 }, { wch: 10 }, { wch: 30 }, { wch: 18 }, { wch: 26 }];
      XLSX.utils.book_append_sheet(wb, ws, 'Replacements');
      XLSX.writeFile(wb, 'Spare_Parts_Replacements_Template.xlsx');
    }
  });

  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (re) => {
        fileBuffer = re.target.result;
        dropzone.innerHTML = `
          <div style="font-size: 32px; color: #10b981; margin-bottom: 4px;">✅</div>
          <div style="font-weight: 700; color: #fff; font-size: 14px;">${file.name}</div>
          <div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">File loaded (${(file.size / 1024).toFixed(1)} KB). Ready to import.</div>
        `;
        btnCommit.disabled = false;
      };
      reader.readAsArrayBuffer(file);
    }
  });

  btnCommit.addEventListener('click', () => {
    if (!fileBuffer) return;
    const isMaster = document.querySelector('input[name="spare-import-mode"]:checked')?.value === 'MASTER';

    try {
      btnCommit.disabled = true;
      btnCommit.innerText = 'Processing Import...';

      if (isMaster) {
        // Read sheets and rows
        const wb = XLSX.read(fileBuffer, { type: 'array' });
        const sheetName = wb.SheetNames[0];
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });

        const res = historyService.importSparePartsMasterFromRows(rows);
        feedback.style.display = 'block';
        feedback.style.background = 'rgba(16, 185, 129, 0.15)';
        feedback.style.border = '1px solid #10b981';
        feedback.style.color = '#86efac';
        feedback.innerHTML = `
          <div style="font-weight: 800; font-size: 13.5px; margin-bottom: 4px;">🎉 Spare Parts Master Imported Successfully!</div>
          <div>• <strong>${res.importedCount} new spare parts</strong> added with automated SL codes.</div>
          <div>• <strong>${res.duplicateCount} duplicate items</strong> detected and merged/updated.</div>
          <div style="margin-top: 4px; font-weight: 700; color: #38bdf8;">Total Catalog: ${res.totalInCatalog} items now instantly searchable in Autocomplete.</div>
        `;
        setTimeout(() => {
          close();
          window.dispatchEvent(new CustomEvent('erp:master-data-updated'));
        }, 2000);
      } else {
        const results = historyService.importSparePartsExcel(fileBuffer);
        feedback.style.display = 'block';
        if (results.errors.length === 0) {
          feedback.style.background = 'rgba(16, 185, 129, 0.15)';
          feedback.style.border = '1px solid #10b981';
          feedback.style.color = '#86efac';
          feedback.innerHTML = `<strong>🎉 Import Successful!</strong><br/>Successfully imported and linked <strong>${results.insertedRows} spare part records</strong> to machine lifetime histories.`;
          setTimeout(() => {
            close();
            window.dispatchEvent(new CustomEvent('erp:master-data-updated'));
          }, 1500);
        } else {
          feedback.style.background = 'rgba(239, 68, 68, 0.15)';
          feedback.style.border = '1px solid #ef4444';
          feedback.style.color = '#fca5a5';
          feedback.innerHTML = `<strong>⚠️ Import Completed with Warnings (${results.insertedRows} inserted, ${results.failedRows} failed):</strong><ul style="margin-top: 6px; padding-left: 20px; font-size: 11.5px;">${results.errors.slice(0, 5).map(err => `<li>Row ${err.row}: ${err.reason}</li>`).join('')}</ul>`;
          btnCommit.innerText = 'Done';
          btnCommit.disabled = false;
        }
      }
    } catch (err) {
      feedback.style.display = 'block';
      feedback.style.background = 'rgba(239, 68, 68, 0.15)';
      feedback.style.border = '1px solid #ef4444';
      feedback.style.color = '#fca5a5';
      feedback.innerHTML = `<strong>Error:</strong> ${err.message}`;
      btnCommit.disabled = false;
    }
  });
}

/**
 * Official Printable Machine History Passport Modal
 */
function openMachinePassportModal(serialNumber) {
  const machine = historyService.findMachineBySerialOnly(serialNumber);
  if (!machine) {
    alert('Machine not found for serial: ' + serialNumber);
    return;
  }

  const group = storage.getItem(TABLE_NAMES.GROUPS, machine.groupId);
  const unit = storage.getItem(TABLE_NAMES.UNITS, machine.unitId);
  const floor = storage.getItem(TABLE_NAMES.FLOORS, machine.floorId);
  const line = storage.getItem(TABLE_NAMES.LINES, machine.lineId);
  const mn = storage.getItem(TABLE_NAMES.MACHINE_NAMES, machine.machineNameId);
  const brand = storage.getItem(TABLE_NAMES.BRANDS, machine.brandId);
  const model = storage.getItem(TABLE_NAMES.MODELS, machine.modelId);

  const locationTrail = historyService.getLocationHistory(machine.serialNumber);
  const serviceList = historyService.getServiceAndRepairHistory(machine.serialNumber, { serviceType: 'ALL' });
  const partsList = historyService.getSparePartsHistory(machine.serialNumber);

  const modalHtml = `
    <div class="modal-overlay" id="machine-passport-modal-overlay">
      <div class="modal-dialog" style="max-width: 860px; max-height: 90vh; display: flex; flex-direction: column;">
        <div class="modal-header" style="background: var(--bg-card); padding: 14px 20px;">
          <div class="modal-title" style="display: flex; align-items: center; gap: 8px;">
            <span>📜 Official Machine Lifetime History Passport</span>
          </div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <button id="btn-trigger-print-passport" class="btn btn-primary btn-sm" style="font-weight: 700;">
              🖨️ Print / Save as PDF
            </button>
            <button class="btn btn-ghost btn-sm btn-close-passport-modal">✕</button>
          </div>
        </div>

        <div class="modal-body passport-printable-area" id="passport-print-content" style="padding: 24px; overflow-y: auto; background: #ffffff; color: #0f172a; font-family: sans-serif;">
          
          <!-- Passport Header -->
          <div style="border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-size: 18px; font-weight: 800; color: #0284c7; letter-spacing: 0.5px;">AL-MUSLIM GROUP</div>
              <div style="font-size: 13px; font-weight: 700; color: #1e293b;">Central Maintenance &amp; Mechanical Engineering Department</div>
              <div style="font-size: 11px; color: #64748b;">Official Lifetime Machine Maintenance &amp; Movement Passport</div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 11px; font-weight: 600; color: #64748b;">PASSPORT PRINT DATE</div>
              <div style="font-size: 12px; font-weight: 800; color: #0f172a;">${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
            </div>
          </div>

          <!-- Machine Specifications Box -->
          <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 14px; margin-bottom: 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 12px;">
            <div><strong>Machine Serial Number:</strong> <span style="font-family: monospace; font-size: 13px; font-weight: 800; color: #0284c7;">${machine.serialNumber}</span></div>
            <div><strong>Machine Status:</strong> <span style="font-weight: 800; color: #10b981;">${machine.status || 'ACTIVE'}</span></div>
            <div><strong>Machine Type / Category:</strong> ${mn?.name || 'Plane Machine'}</div>
            <div><strong>Brand &amp; Model:</strong> ${brand?.name || 'JUKI'} &bull; ${model?.name || 'DDL-8700-7'}</div>
            <div style="grid-column: span 2; background: #ecfdf5; border: 1px solid #a7f3d0; padding: 6px 10px; border-radius: 4px;">
              <strong>Current Location:</strong> ${unit?.name || 'Unit'} &rarr; <strong>${floor?.name || 'Floor'}</strong> &rarr; ${line?.name || 'Line'}
            </div>
          </div>

          <!-- 1. Location Movement History -->
          <div style="margin-bottom: 18px;">
            <div style="font-size: 13px; font-weight: 800; color: #0f172a; border-bottom: 1.5px solid #cbd5e1; padding-bottom: 4px; margin-bottom: 8px;">
              1. Location Movement History (Never Deleted)
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 11.5px;">
              <thead>
                <tr style="background: #f1f5f9; text-align: left;">
                  <th style="border: 1px solid #cbd5e1; padding: 6px;">Sl.</th>
                  <th style="border: 1px solid #cbd5e1; padding: 6px;">Date</th>
                  <th style="border: 1px solid #cbd5e1; padding: 6px;">From Location</th>
                  <th style="border: 1px solid #cbd5e1; padding: 6px;">To Location</th>
                  <th style="border: 1px solid #cbd5e1; padding: 6px;">Transfer Reason</th>
                  <th style="border: 1px solid #cbd5e1; padding: 6px;">Authorized By</th>
                </tr>
              </thead>
              <tbody>
                ${locationTrail.map((loc, idx) => `
                  <tr>
                    <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center;">${idx + 1}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 6px;">${new Date(loc.timestamp).toLocaleDateString('en-GB')}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 6px;">${loc.fromLocation ? `${loc.fromLocation.floorName || ''} > ${loc.fromLocation.lineName || ''}` : 'Commissioning'}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 6px; font-weight: 700; color: #0284c7;">${loc.toLocation ? `${loc.toLocation.floorName || ''} > ${loc.toLocation.lineName || ''}` : 'N/A'}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 6px;">${loc.remarks || loc.details || '—'}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 6px;">${loc.performedByName}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <!-- 2. Service & Repair History -->
          <div style="margin-bottom: 18px;">
            <div style="font-size: 13px; font-weight: 800; color: #0f172a; border-bottom: 1.5px solid #cbd5e1; padding-bottom: 4px; margin-bottom: 8px;">
              2. Service &amp; Repair History
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 11.5px;">
              <thead>
                <tr style="background: #f1f5f9; text-align: left;">
                  <th style="border: 1px solid #cbd5e1; padding: 6px;">Date</th>
                  <th style="border: 1px solid #cbd5e1; padding: 6px;">Floor / Location</th>
                  <th style="border: 1px solid #cbd5e1; padding: 6px;">Type</th>
                  <th style="border: 1px solid #cbd5e1; padding: 6px;">Problem Reported</th>
                  <th style="border: 1px solid #cbd5e1; padding: 6px;">Work Done &amp; Spare Parts</th>
                  <th style="border: 1px solid #cbd5e1; padding: 6px;">Technician</th>
                </tr>
              </thead>
              <tbody>
                ${serviceList.map(s => {
                  const sr = s.serviceRecord || {};
                  return `
                    <tr>
                      <td style="border: 1px solid #cbd5e1; padding: 6px;">${sr.serviceDate || new Date(s.timestamp).toLocaleDateString('en-GB')}</td>
                      <td style="border: 1px solid #cbd5e1; padding: 6px; font-weight: 600;">${sr.floorLocation || 'Floor'}</td>
                      <td style="border: 1px solid #cbd5e1; padding: 6px; font-weight: 700;">${sr.serviceType || s.title}</td>
                      <td style="border: 1px solid #cbd5e1; padding: 6px;">${sr.problemComplaint || s.details || '—'}</td>
                      <td style="border: 1px solid #cbd5e1; padding: 6px;">
                        ${sr.workPerformed || '—'} 
                        ${sr.sparePartsUsed ? `<br/><small><strong>Part:</strong> ${sr.sparePartsUsed} (S/N: ${sr.sparePartSerial || 'N/A'})</small>` : ''}
                      </td>
                      <td style="border: 1px solid #cbd5e1; padding: 6px;">${sr.technician || s.performedByName}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>

          <!-- 3. Spare Parts Replacement History -->
          <div>
            <div style="font-size: 13px; font-weight: 800; color: #0f172a; border-bottom: 1.5px solid #cbd5e1; padding-bottom: 4px; margin-bottom: 8px;">
              3. Spare Parts Replacement History
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 11.5px;">
              <thead>
                <tr style="background: #f1f5f9; text-align: left;">
                  <th style="border: 1px solid #cbd5e1; padding: 6px;">Date</th>
                  <th style="border: 1px solid #cbd5e1; padding: 6px;">Floor / Location</th>
                  <th style="border: 1px solid #cbd5e1; padding: 6px;">Part Name</th>
                  <th style="border: 1px solid #cbd5e1; padding: 6px;">Part S/N</th>
                  <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: center;">Qty</th>
                  <th style="border: 1px solid #cbd5e1; padding: 6px;">Technician</th>
                  <th style="border: 1px solid #cbd5e1; padding: 6px;">Remarks</th>
                </tr>
              </thead>
              <tbody>
                ${partsList.map(p => `
                  <tr>
                    <td style="border: 1px solid #cbd5e1; padding: 6px;">${p.replacementDate || new Date(p.createdAt).toLocaleDateString('en-GB')}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 6px; font-weight: 600;">${p.floorLocation || 'Floor'}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 6px; font-weight: 700; color: #059669;">${p.partName}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 6px; font-family: monospace;">${p.partSerialNumber || p.partNumber || '—'}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center;">${p.quantity || 1}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 6px;">${p.technician || p.createdByName}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 6px;">${p.remarks || p.replacementReason || '—'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

        </div>

        <div class="modal-footer" style="padding: 12px 20px; background: var(--bg-card); display: flex; justify-content: flex-end;">
          <button class="btn btn-secondary btn-close-passport-modal">Close</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  const overlay = document.getElementById('machine-passport-modal-overlay');
  const close = () => overlay?.remove();

  overlay.querySelectorAll('.btn-close-passport-modal').forEach(b => b.addEventListener('click', close));

  document.getElementById('btn-trigger-print-passport')?.addEventListener('click', () => {
    const printContent = document.getElementById('passport-print-content')?.innerHTML;
    if (!printContent) return;

    const printWin = window.open('', '_blank', 'width=900,height=700');
    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Machine Passport - ${machine.serialNumber}</title>
          <style>
            body { font-family: sans-serif; padding: 20px; color: #0f172a; }
            table { width: 100%; border-collapse: collapse; margin-top: 6px; }
            th, td { border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 11px; text-align: left; }
            th { background: #f1f5f9; font-weight: 700; }
            @media print {
              body { padding: 0; }
              @page { margin: 15mm; }
            }
          </style>
        </head>
        <body>
          ${printContent}
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWin.document.close();
  });
}
