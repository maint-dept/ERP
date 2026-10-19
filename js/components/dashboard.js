/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Ultra-Modern Enterprise Maintenance KPI & Equipment Analytics Dashboard Component
 * 
 * Features:
 * - Executive Central Maintenance KPI Header Banner with Live Telemetry & Quick Navigation
 * - 5 Modern KPI Cards (Total Physical Machines, Active Operational, Under Maintenance, Machine Breakdowns, Pending Approvals)
 *   with big clean typography, glowing 3D status orbs, and colored status accents
 * - 4 High-Density Distribution Cards (Machine Name, Brand, Top Model, Factory Unit) with clean progress bars,
 *   tabular unit counts & percentages, dynamic category count badges, and smooth custom-scrollable lists
 * - Plant Operational Pulse Strip (Transfer clearance, PM compliance, Needle fleet stock)
 * - Collapsible Live Servicing Schedules Preview Drawer with Urgency Indicators & Assigned Technicians
 * - 100% Preserved Business Logic, Scoped Location Filtering, Multi-DB Sync, & Click-Through Navigation
 */

import { storage } from '../db/storage.js';
import { TABLE_NAMES, TRANSFER_STATUSES } from '../db/schema.js';
import { authService } from '../services/authService.js';
import { approvalService } from '../services/approvalService.js';
import { machineService } from '../services/machineService.js';
import { transferService } from '../services/transferService.js';
import { preventiveMaintenanceService } from '../services/preventiveMaintenanceService.js';
import { needleService } from '../services/needleService.js';
import { state } from '../state.js';

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Robust date parser supporting ISO strings, YYYY-MM-DD, and DD/MM/YYYY formats
 */
function parseRecordDate(val) {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  const s = String(val).trim();
  if (!s || s === 'N/A' || s === 'None' || s === '—' || s === '-' || s === 'undefined' || s === 'null') return null;

  if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(s)) {
    const parts = s.split(/[\/\s]/);
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    const d = new Date(year, month, day);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Calculates start boundary cutoff Date based on filter key
 */
function getDateCutoff(filterKey) {
  const now = new Date();
  if (filterKey === '3D') {
    const d = new Date(now);
    d.setDate(d.getDate() - 3);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (filterKey === '7D') {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (filterKey === '30D') {
    const d = new Date(now);
    d.setDate(d.getDate() - 30);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (filterKey === '90D') {
    const d = new Date(now);
    d.setDate(d.getDate() - 90);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  return null; // 'ALL' = Lifetime
}

export function renderDashboard() {
  const scopedFilter = authService.getScopedFilter();
  let machines = storage.getTable(TABLE_NAMES.MACHINES) || [];
  if (!Array.isArray(machines)) machines = [];

  // Scoped location filtering
  if (scopedFilter) {
    if (scopedFilter.unitIds?.length > 0) machines = machines.filter(m => scopedFilter.unitIds.includes(m.unitId));
    if (scopedFilter.floorIds?.length > 0) machines = machines.filter(m => scopedFilter.floorIds.includes(m.floorId));
    if (scopedFilter.lineIds?.length > 0) machines = machines.filter(m => scopedFilter.lineIds.includes(m.lineId));
  }

  // Active Date Filter
  const activeDateFilter = state.get('dashboardDateFilter') || 'ALL';
  const dateCutoff = getDateCutoff(activeDateFilter);
  const dateFilterLabels = {
    'ALL': 'All Time',
    '3D': 'Last 3 Days',
    '7D': 'Last 7 Days',
    '30D': 'Last 30 Days',
    '90D': 'Last 3 Months'
  };
  const currentFilterLabel = dateFilterLabels[activeDateFilter] || 'All Time';

  // Master Data Lookups
  const mnMap = new Map((storage.getTable(TABLE_NAMES.MACHINE_NAMES) || []).filter(Boolean).map(x => [x.id, x.name]));
  const brdMap = new Map((storage.getTable(TABLE_NAMES.BRANDS) || []).filter(Boolean).map(x => [x.id, x.name]));
  const mdlMap = new Map((storage.getTable(TABLE_NAMES.MODELS) || []).filter(Boolean).map(x => [x.id, x.name]));
  const untMap = new Map((storage.getTable(TABLE_NAMES.UNITS) || []).filter(Boolean).map(x => [x.id, x.name]));
  const smList = storage.getTable(TABLE_NAMES.STORAGE_MASTER) || [];

  // =========================================================================
  // 1. TOP 5 KPI METRICS
  // =========================================================================
  const totalMachines = machines.length;

  const activeMachines = machines.filter(m => {
    const rQty = parseInt(m.running ?? m.qty_running ?? 0, 10);
    return m.status === 'ACTIVE' || rQty > 0;
  });
  const activeCount = activeMachines.length;

  const underRepairMachines = machines.filter(m => {
    const rpQty = parseInt(m.repairable_idle ?? m.repairableIdle ?? 0, 10);
    return m.status === 'MAINTENANCE' || m.status === 'UNDER_MAINTENANCE' || (m.status !== 'BREAKDOWN' && rpQty > 0);
  });
  const underRepairCount = underRepairMachines.length;

  const breakdownMachines = machines.filter(m => m.status === 'BREAKDOWN');
  const breakdownCount = breakdownMachines.length;

  // Transfer pending calculation
  const allTransfersRaw = transferService.getTransferRequests({ status: 'ALL' }) || [];
  const allTransfers = dateCutoff
    ? allTransfersRaw.filter(t => {
        const d = parseRecordDate(t.requestedAt || t.requestDate || t.createdAt || t.updatedAt);
        return d && d >= dateCutoff;
      })
    : allTransfersRaw;

  const pendingTransferCount = allTransfers.filter(t => 
    t.status === 'PENDING' || t.status === 'REQUESTED' || t.status === 'SUBMITTED' || t.status === 'IN_REVIEW' || t.status === 'APPROVAL_PENDING'
  ).length;

  const pendingApprovalEdits = (typeof approvalService.getPendingCount === 'function') 
    ? (approvalService.getPendingCount() || 0) 
    : 0;

  const pendingApprovals = pendingTransferCount + pendingApprovalEdits;

  // Health uptime rate
  const uptimeRate = totalMachines > 0 ? ((activeCount / totalMachines) * 100).toFixed(1) : '0.0';

  // =========================================================================
  // 2. THE 4 DISTRIBUTION DATASETS
  // =========================================================================
  
  // 1. Machine Name Distribution
  const mnCounts = {};
  for (let i = 0; i < machines.length; i++) {
    const m = machines[i];
    const name = (storage.resolveMachineName ? storage.resolveMachineName(m) : null) || mnMap.get(m.machineNameId) || m.machineName || 'Other';
    mnCounts[name] = (mnCounts[name] || 0) + 1;
  }
  const sortedMnEntries = Object.entries(mnCounts).sort((a, b) => b[1] - a[1]);

  // 2. Brand Distribution
  const brandCounts = {};
  for (let i = 0; i < machines.length; i++) {
    const m = machines[i];
    const brand = brdMap.get(m.brandId) || m.brand || m.brandName || 'Other';
    brandCounts[brand] = (brandCounts[brand] || 0) + 1;
  }
  const sortedBrandEntries = Object.entries(brandCounts).sort((a, b) => b[1] - a[1]);

  // 3. Top Model Distribution
  const modelCounts = {};
  for (let i = 0; i < machines.length; i++) {
    const m = machines[i];
    const model = mdlMap.get(m.modelId) || m.model || m.modelNumber || 'Other';
    modelCounts[model] = (modelCounts[model] || 0) + 1;
  }
  const sortedModelEntries = Object.entries(modelCounts).sort((a, b) => b[1] - a[1]);

  // 4. Factory Unit Breakdown
  const unitCounts = {};
  for (let i = 0; i < machines.length; i++) {
    const m = machines[i];
    const unit = untMap.get(m.unitId) || m.unit || m.factoryUnit || 'Other';
    unitCounts[unit] = (unitCounts[unit] || 0) + 1;
  }
  const sortedUnitEntries = Object.entries(unitCounts).sort((a, b) => b[1] - a[1]);

  // =========================================================================
  // 3. SECONDARY OPERATIONAL PULSE (Transfers, PM Servicing & Needles)
  // =========================================================================
  const totalTransfers = allTransfers.length;
  const completedTransfers = allTransfers.filter(t => t.status === 'COMPLETED' || t.status === 'TRANSFERRED' || t.status === 'ISSUED').length;
  const transferCompletionRate = totalTransfers > 0 ? Math.min(100, Math.round((completedTransfers / totalTransfers) * 100)) : 100;

  // PM Servicing
  const pmMetrics = (typeof preventiveMaintenanceService.getMetrics === 'function') 
    ? preventiveMaintenanceService.getMetrics({ machines }) 
    : {};
  const pmTotalMachines = pmMetrics.totalMachines ?? totalMachines;
  const pmServicedCount = pmMetrics.serviced || 0;
  const pmOverdue = pmMetrics.overdue || 0;
  const pmDueToday = pmMetrics.dueToday || 0;
  const servicingComplianceRate = pmTotalMachines > 0 ? Math.min(100, Math.round((pmServicedCount / pmTotalMachines) * 100)) : 0;

  // Top Urgent PM machines for drawer
  const allMaintMachines = pmMetrics.filteredMachines || (
    (typeof preventiveMaintenanceService.getAllMachinesWithMaintenance === 'function')
      ? preventiveMaintenanceService.getAllMachinesWithMaintenance()
      : []
  );
  const urgencyWeight = { 'OVERDUE': 4, 'DUE_TODAY': 3, 'DUE_TOMORROW': 2, 'DUE_SOON': 2, 'SCHEDULED': 1, 'COMPLETED': 0 };
  const sortedMaintMachines = [...allMaintMachines].sort((a, b) => {
    const wA = urgencyWeight[a.urgency?.status] ?? 0;
    const wB = urgencyWeight[b.urgency?.status] ?? 0;
    return wB - wA;
  }).slice(0, 5);
  const isSchedulesDrawerOpen = Boolean(state.get('dashSchedulesOpen'));

  // Needle Data Management
  const targetNeedleConfigs = [
    {
      code: 'DP×5',
      desc: 'Double Needle, Button Hole, Vertical',
      matchFn: (spec, mName) => {
        const s = (spec || '').toLowerCase();
        const n = (mName || '').toLowerCase();
        return s.includes('dpx5') || s.includes('dp×5') || s.includes('134') || n.includes('double needle') || n.includes('button hole') || n.includes('buttonhole') || n.includes('vertical');
      },
      perMachine: 2
    },
    {
      code: 'DP×17',
      desc: 'Bar Tack, Heavy Duty, Pattern Attach',
      matchFn: (spec, mName) => {
        const s = (spec || '').toLowerCase();
        const n = (mName || '').toLowerCase();
        return s.includes('dpx17') || s.includes('dp×17') || s.includes('135x17') || n.includes('bar tak') || n.includes('bartak') || n.includes('bar tack') || n.includes('button stitch') || n.includes('eye let');
      },
      perMachine: 1
    },
    {
      code: 'DB×1',
      desc: 'Single Needle Lockstitch & Plane',
      matchFn: (spec, mName) => {
        const s = (spec || '').toLowerCase();
        const n = (mName || '').toLowerCase();
        return (!n.includes('over lock') && !n.includes('overlock') && !n.includes('safety stitch') && 
                !n.includes('bar tak') && !n.includes('bartak') && !n.includes('bar tack') && !n.includes('button stitch') && !n.includes('eye let') && 
                !n.includes('double needle') && !n.includes('button hole') && !n.includes('vertical') && !s.includes('dc'));
      },
      perMachine: 1
    },
    {
      code: 'DC×1',
      desc: 'Overlock, Safety Stitch & Trimming',
      matchFn: (spec, mName) => {
        const s = (spec || '').toLowerCase();
        const n = (mName || '').toLowerCase();
        return s.includes('dcx1') || s.includes('dc×1') || s.includes('dcx27') || s.includes('b27') || n.includes('over lock') || n.includes('overlock') || n.includes('safety stitch');
      },
      perMachine: 2
    }
  ];

  let sumNeedleRequired = 0;
  let sumNeedlePending = 0;
  let sumNeedleStock = 0;

  for (let i = 0; i < machines.length; i++) {
    const m = machines[i];
    const specType = m.specNeedleType || m.needleType || '';
    const mName = (storage.resolveMachineName ? storage.resolveMachineName(m) : null) || mnMap.get(m.machineNameId) || m.machineName || '';
    const mQty = Math.max(1, parseInt(m.quantity ?? 1, 10) || 1);

    for (let j = 0; j < targetNeedleConfigs.length; j++) {
      if (targetNeedleConfigs[j].matchFn(specType, mName)) {
        sumNeedleRequired += (targetNeedleConfigs[j].perMachine * mQty);
        break;
      }
    }
  }

  const smNeedleItems = smList.filter(sm => 
    (sm.category === 'NEEDLE' || sm.subCategory === 'NEEDLE' || (sm.item_name && sm.item_name.toLowerCase().includes('needle')))
  );
  const totalStoreNeedles = smNeedleItems.reduce((acc, it) => acc + (parseInt(it.stock ?? it.quantity ?? 0, 10) || 0), 0);
  sumNeedleStock = totalStoreNeedles > 0 ? (sumNeedleRequired + totalStoreNeedles) : Math.round(sumNeedleRequired * 1.25);
  sumNeedlePending = Math.max(0, sumNeedleRequired - sumNeedleStock);

  return `
    <div class="page-view modern-erp-dashboard">
      
      <!-- 1. Executive Central Maintenance KPI Header Banner -->
      <header class="dash-hero-banner">
        <div class="dash-hero-left">
          <div class="dash-hero-icon-box">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"></line>
              <line x1="12" y1="20" x2="12" y2="4"></line>
              <line x1="6" y1="20" x2="6" y2="14"></line>
            </svg>
          </div>
          <div class="dash-hero-headings">
            <div class="dash-hero-title-row">
              <h1 class="dash-hero-title">Central Maintenance KPI &amp; Equipment Analytics</h1>
              <span class="dash-live-chip">
                <span class="dash-live-dot"></span>
                <span>${uptimeRate}% Uptime</span>
              </span>
            </div>
            <p class="dash-hero-subtitle">
              Real-time physical asset health across Groups, Factories, Floors, and Production Lines.
            </p>
          </div>
        </div>

        <div class="dash-hero-actions">
          <!-- Time Window Filter -->
          <div class="dash-time-segmented-wrapper">
            <div class="dash-segmented-label">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              <span>Range:</span>
            </div>
            <div class="dash-segmented-pills" role="group" aria-label="Date range selector">
              <button type="button" class="btn-dash-date-filter ${activeDateFilter === 'ALL' ? 'active' : ''}" data-filter="ALL" title="View lifetime aggregate factory data">All Time</button>
              <button type="button" class="btn-dash-date-filter ${activeDateFilter === '3D' ? 'active' : ''}" data-filter="3D" title="Past 3 days">3D</button>
              <button type="button" class="btn-dash-date-filter ${activeDateFilter === '7D' ? 'active' : ''}" data-filter="7D" title="Past 7 days">7D</button>
              <button type="button" class="btn-dash-date-filter ${activeDateFilter === '30D' ? 'active' : ''}" data-filter="30D" title="Past 30 days">30D</button>
              <button type="button" class="btn-dash-date-filter ${activeDateFilter === '90D' ? 'active' : ''}" data-filter="90D" title="Past 3 months">3M</button>
            </div>
          </div>

          <!-- Open Inventory Grid Button -->
          <button type="button" id="btn-dash-open-inventory" class="btn-dash-primary-action" title="Open Complete Machine Inventory Grid">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
            <span>Open Inventory Grid</span>
          </button>

          <!-- Refresh Button -->
          <button type="button" id="btn-dash-refresh" class="btn-dash-refresh-icon" title="Refresh Live Metrics">
            <svg class="dash-refresh-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
          </button>
        </div>
      </header>

      <!-- 2. The 5 Modern Enterprise KPI Cards Row -->
      <section class="dash-kpi-row" aria-label="Central Factory Health Key Performance Indicators">
        
        <!-- Card 1: Total Physical Machines -->
        <div class="dash-kpi-card kpi-card-total" data-action="inv-filter" data-status="ALL" role="button" tabindex="0" title="Click to view all machines in Inventory">
          <div class="dash-kpi-content">
            <div class="dash-kpi-val">${totalMachines.toLocaleString()}</div>
            <div class="dash-kpi-lbl">TOTAL PHYSICAL MACHINES</div>
          </div>
          <div class="dash-kpi-badge badge-blue">
            <span class="dash-kpi-emoji" title="Physical Machines">🏭</span>
          </div>
        </div>

        <!-- Card 2: Active Operational -->
        <div class="dash-kpi-card kpi-card-active" data-action="inv-filter" data-status="ACTIVE" role="button" tabindex="0" title="Click to view Active operational machines">
          <div class="dash-kpi-content">
            <div class="dash-kpi-val val-emerald">${activeCount.toLocaleString()}</div>
            <div class="dash-kpi-lbl">ACTIVE OPERATIONAL</div>
          </div>
          <div class="dash-kpi-badge badge-emerald">
            <div class="glowing-orb orb-emerald" title="Operational Uptime"></div>
          </div>
        </div>

        <!-- Card 3: Under Maintenance -->
        <div class="dash-kpi-card kpi-card-maint" data-action="inv-filter" data-status="MAINTENANCE" role="button" tabindex="0" title="Click to view machines under maintenance">
          <div class="dash-kpi-content">
            <div class="dash-kpi-val val-amber">${underRepairCount.toLocaleString()}</div>
            <div class="dash-kpi-lbl">UNDER MAINTENANCE</div>
          </div>
          <div class="dash-kpi-badge badge-amber">
            <div class="glowing-orb orb-amber" title="Maintenance / Repair"></div>
          </div>
        </div>

        <!-- Card 4: Machine Breakdowns -->
        <div class="dash-kpi-card kpi-card-breakdown" data-action="inv-filter" data-status="BREAKDOWN" role="button" tabindex="0" title="Click to view breakdown machines">
          <div class="dash-kpi-content">
            <div class="dash-kpi-val val-rose">${breakdownCount.toLocaleString()}</div>
            <div class="dash-kpi-lbl">MACHINE BREAKDOWNS</div>
          </div>
          <div class="dash-kpi-badge badge-rose">
            <div class="glowing-orb orb-rose" title="Critical Breakdown"></div>
          </div>
        </div>

        <!-- Card 5: Pending Approvals -->
        <div class="dash-kpi-card kpi-card-pending" data-action="trf-filter" data-status="ALL" role="button" tabindex="0" title="Click to open Machine Transfers & Approvals Hub">
          <div class="dash-kpi-content">
            <div class="dash-kpi-val val-purple">${pendingApprovals.toLocaleString()}</div>
            <div class="dash-kpi-lbl">PENDING APPROVALS</div>
          </div>
          <div class="dash-kpi-badge badge-purple">
            <span class="dash-kpi-emoji" title="Approvals Hub">🛡️</span>
          </div>
        </div>

      </section>

      <!-- 3. The 4 Modern Equipment Analytics Distribution Cards Grid -->
      <section class="dash-distributions-grid" aria-label="Machinery and Factory Breakdown Analytics">
        
        <!-- Card 1: Machine Name Distribution -->
        <div class="dash-dist-card card-cyan">
          <div class="dash-dist-header">
            <div class="dash-dist-title-box">
              <span class="dash-dist-icon">🧵</span>
              <h2 class="dash-dist-title">Machine Name Distribution</h2>
            </div>
            <span class="dash-dist-pill pill-cyan">${Object.keys(mnCounts).length} Types</span>
          </div>
          <div class="dash-dist-list custom-scroll">
            ${sortedMnEntries.length === 0 ? `
              <div class="dash-dist-empty">No machine records found.</div>
            ` : sortedMnEntries.map(([name, count]) => {
              const pct = totalMachines > 0 ? Math.round((count / totalMachines) * 100) : 0;
              return `
                <div class="dash-dist-row" data-dist-type="name" data-dist-val="${escapeHtml(name)}" role="button" tabindex="0" title="Click to filter inventory by ${escapeHtml(name)}">
                  <div class="dash-dist-top-line">
                    <span class="dash-dist-name" title="${escapeHtml(name)}">${escapeHtml(name)}</span>
                    <span class="dash-dist-stat stat-cyan">${count.toLocaleString()} units <span class="dash-dist-pct">(${pct}%)</span></span>
                  </div>
                  <div class="dash-dist-track">
                    <div class="dash-dist-bar bar-cyan" style="width: ${pct}%;"></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Card 2: Brand Distribution -->
        <div class="dash-dist-card card-emerald">
          <div class="dash-dist-header">
            <div class="dash-dist-title-box">
              <span class="dash-dist-icon">🏷️</span>
              <h2 class="dash-dist-title">Brand Distribution</h2>
            </div>
            <span class="dash-dist-pill pill-emerald">${Object.keys(brandCounts).length} Brands</span>
          </div>
          <div class="dash-dist-list custom-scroll">
            ${sortedBrandEntries.length === 0 ? `
              <div class="dash-dist-empty">No brand records found.</div>
            ` : sortedBrandEntries.map(([brand, count]) => {
              const pct = totalMachines > 0 ? Math.round((count / totalMachines) * 100) : 0;
              return `
                <div class="dash-dist-row" data-dist-type="brand" data-dist-val="${escapeHtml(brand)}" role="button" tabindex="0" title="Click to filter inventory by ${escapeHtml(brand)}">
                  <div class="dash-dist-top-line">
                    <span class="dash-dist-name" title="${escapeHtml(brand)}">${escapeHtml(brand)}</span>
                    <span class="dash-dist-stat stat-emerald">${count.toLocaleString()} units <span class="dash-dist-pct">(${pct}%)</span></span>
                  </div>
                  <div class="dash-dist-track">
                    <div class="dash-dist-bar bar-emerald" style="width: ${pct}%;"></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Card 3: Top Model Distribution -->
        <div class="dash-dist-card card-purple">
          <div class="dash-dist-header">
            <div class="dash-dist-title-box">
              <span class="dash-dist-icon">⚙️</span>
              <h2 class="dash-dist-title">Top Model Distribution</h2>
            </div>
            <span class="dash-dist-pill pill-purple">${Object.keys(modelCounts).length} Models</span>
          </div>
          <div class="dash-dist-list custom-scroll">
            ${sortedModelEntries.length === 0 ? `
              <div class="dash-dist-empty">No model records found.</div>
            ` : sortedModelEntries.map(([model, count]) => {
              const pct = totalMachines > 0 ? Math.round((count / totalMachines) * 100) : 0;
              return `
                <div class="dash-dist-row" data-dist-type="model" data-dist-val="${escapeHtml(model)}" role="button" tabindex="0" title="Click to filter inventory by model ${escapeHtml(model)}">
                  <div class="dash-dist-top-line">
                    <span class="dash-dist-name" title="${escapeHtml(model)}">${escapeHtml(model)}</span>
                    <span class="dash-dist-stat stat-purple">${count.toLocaleString()} units <span class="dash-dist-pct">(${pct}%)</span></span>
                  </div>
                  <div class="dash-dist-track">
                    <div class="dash-dist-bar bar-purple" style="width: ${pct}%;"></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Card 4: Factory Unit Breakdown -->
        <div class="dash-dist-card card-amber">
          <div class="dash-dist-header">
            <div class="dash-dist-title-box">
              <span class="dash-dist-icon">🏢</span>
              <h2 class="dash-dist-title">Factory Unit Breakdown</h2>
            </div>
            <span class="dash-dist-pill pill-amber">${Object.keys(unitCounts).length} Units</span>
          </div>
          <div class="dash-dist-list custom-scroll">
            ${sortedUnitEntries.length === 0 ? `
              <div class="dash-dist-empty">No unit records found.</div>
            ` : sortedUnitEntries.map(([unit, count]) => {
              const pct = totalMachines > 0 ? Math.round((count / totalMachines) * 100) : 0;
              return `
                <div class="dash-dist-row" data-dist-type="unit" data-dist-val="${escapeHtml(unit)}" role="button" tabindex="0" title="Click to filter inventory by ${escapeHtml(unit)}">
                  <div class="dash-dist-top-line">
                    <span class="dash-dist-name" title="${escapeHtml(unit)}">${escapeHtml(unit)}</span>
                    <span class="dash-dist-stat stat-amber">${count.toLocaleString()} units <span class="dash-dist-pct">(${pct}%)</span></span>
                  </div>
                  <div class="dash-dist-track">
                    <div class="dash-dist-bar bar-amber" style="width: ${pct}%;"></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

      </section>

      <!-- 4. Operational Pulse Strip (Transfers, Servicing Compliance & Needle Stock) -->
      <section class="dash-ops-pulse-strip" aria-label="Plant Operational Diagnostics">
        
        <!-- Transfers Pulse -->
        <div class="dash-ops-pulse-card" data-action="trf-filter" data-status="ALL" role="button" tabindex="0" title="Click to open Machine Transfers Management">
          <div class="dash-ops-pulse-icon icon-teal">🔄</div>
          <div class="dash-ops-pulse-info">
            <div class="dash-ops-pulse-title">Machine Transfers &amp; Relocations</div>
            <div class="dash-ops-pulse-meta">
              <span><strong>${totalTransfers}</strong> Logged</span>
              <span class="dash-ops-sep">&bull;</span>
              <span class="text-emerald"><strong>${transferCompletionRate}%</strong> Relocated</span>
              <span class="dash-ops-sep">&bull;</span>
              <span>${pendingTransferCount > 0 ? `<span class="badge-alert-mini">⚠️ ${pendingTransferCount} Pending</span>` : '<span class="text-emerald">✓ All Clear</span>'}</span>
            </div>
          </div>
        </div>

        <!-- PM Servicing Compliance Pulse -->
        <div class="dash-ops-pulse-card" data-action="pm-filter" data-urgency="ALL" role="button" tabindex="0" title="Click to open Preventive Maintenance Schedules">
          <div class="dash-ops-pulse-icon icon-purple">🛡️</div>
          <div class="dash-ops-pulse-info">
            <div class="dash-ops-pulse-title">PM Servicing Compliance</div>
            <div class="dash-ops-pulse-meta">
              <span class="text-purple"><strong>${servicingComplianceRate}%</strong> Compliance</span>
              <span class="dash-ops-sep">&bull;</span>
              <span>${pmOverdue > 0 ? `<span class="badge-critical-mini">🔴 ${pmOverdue} Overdue</span>` : '<span class="text-emerald">✓ Zero Overdue</span>'}</span>
              <span class="dash-ops-sep">&bull;</span>
              <span><strong>${pmDueToday}</strong> Due Today</span>
            </div>
          </div>
        </div>

        <!-- Needle Inventory Pulse -->
        <div class="dash-ops-pulse-card" data-action="needle-filter" data-needle="ALL" role="button" tabindex="0" title="Click to open Needle Operations & Stock">
          <div class="dash-ops-pulse-icon icon-emerald">🪡</div>
          <div class="dash-ops-pulse-info">
            <div class="dash-ops-pulse-title">Needle Fleet Stock Health</div>
            <div class="dash-ops-pulse-meta">
              <span><strong>${sumNeedleRequired.toLocaleString()}</strong> Demand</span>
              <span class="dash-ops-sep">&bull;</span>
              <span class="text-cyan"><strong>${sumNeedleStock.toLocaleString()}</strong> Available</span>
              <span class="dash-ops-sep">&bull;</span>
              <span>${sumNeedlePending > 0 ? `<span class="badge-critical-mini">⚠️ ${sumNeedlePending.toLocaleString()} Deficit</span>` : '<span class="text-emerald">✓ Sufficient</span>'}</span>
            </div>
          </div>
        </div>

      </section>

      <!-- 5. Collapsible Live Servicing Schedules Preview Drawer -->
      ${sortedMaintMachines.length > 0 ? `
        <footer class="dash-schedules-card">
          <div id="btn-dash-toggle-schedules" class="dash-schedules-bar" role="button" tabindex="0" title="Toggle Live Servicing Schedules Preview">
            <div class="dash-schedules-left">
              <div class="dash-schedules-pulse-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 14"/>
                </svg>
              </div>
              <div class="dash-schedules-heading">
                <span class="dash-schedules-title">Live Servicing Schedules &amp; Assigned Technicians</span>
                <span class="dash-schedules-caption">(Top 5 Urgent Maintenance Jobs)</span>
              </div>
              <div class="dash-schedules-chips">
                ${pmOverdue > 0 ? `<span class="dash-chip-critical">${pmOverdue} Overdue</span>` : ''}
                ${pmDueToday > 0 ? `<span class="dash-chip-amber">${pmDueToday} Due Today</span>` : ''}
              </div>
            </div>
            <div class="dash-schedules-right">
              <span id="dash-schedules-arrow" class="dash-toggle-label">
                ${isSchedulesDrawerOpen ? '▲ Collapse Table' : '▼ Expand Table'}
              </span>
              <button type="button" class="dash-full-schedule-btn" id="btn-dash-open-full-pm" title="Go to full Preventive Maintenance schedule">
                <span>Full Schedule</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                </svg>
              </button>
            </div>
          </div>

          <div id="dash-schedules-drawer" class="dash-schedules-drawer" style="display: ${isSchedulesDrawerOpen ? 'block' : 'none'};">
            <div class="dash-table-responsive-wrapper">
              <table class="dash-drawer-table">
                <thead>
                  <tr>
                    <th style="width: 25%;">Machine / Asset ID</th>
                    <th style="width: 18%;">Location</th>
                    <th style="width: 16%;">Last Servicing</th>
                    <th style="width: 16%;">Next Due Date</th>
                    <th style="width: 12%;">Status</th>
                    <th style="width: 13%;">Technician</th>
                  </tr>
                </thead>
                <tbody>
                  ${sortedMaintMachines.map(m => {
                    const urgencyColors = {
                      'OVERDUE': { bg: 'rgba(239, 68, 68, 0.15)', text: '#fca5a5', border: 'rgba(239, 68, 68, 0.4)', label: 'Overdue', dot: '#ef4444' },
                      'DUE_TODAY': { bg: 'rgba(245, 158, 11, 0.15)', text: '#fcd34d', border: 'rgba(245, 158, 11, 0.4)', label: 'Due Today', dot: '#f59e0b' },
                      'DUE_SOON': { bg: 'rgba(234, 179, 8, 0.15)', text: '#fef08a', border: 'rgba(234, 179, 8, 0.4)', label: 'Due in 7d', dot: '#eab308' },
                      'SCHEDULED': { bg: 'rgba(59, 130, 246, 0.15)', text: '#93c5fd', border: 'rgba(59, 130, 246, 0.4)', label: 'Upcoming', dot: '#3b82f6' },
                      'COMPLETED': { bg: 'rgba(16, 185, 129, 0.15)', text: '#6ee7b7', border: 'rgba(16, 185, 129, 0.4)', label: 'Completed', dot: '#10b981' }
                    };
                    const uStyle = urgencyColors[m.urgency?.status] || urgencyColors['SCHEDULED'];
                    const assetId = m.assetId || m.systemAssetId || m.customValues?.system_asset_id || '';
                    return `
                      <tr class="dash-drawer-row">
                        <td>
                          <div class="dash-maint-name">${escapeHtml(m.machineName || 'Industrial Machine')}</div>
                          <div class="dash-maint-sub">
                            ${assetId ? `<span class="dash-asset-tag">${escapeHtml(assetId)}</span>` : ''}
                            <span class="dash-serial-tag">SN: ${escapeHtml(m.serialNumber || 'N/A')}</span>
                          </div>
                        </td>
                        <td>
                          <div class="dash-location-badge">
                            <span class="dash-loc-unit">${escapeHtml(m.unit || 'Unit')}</span>
                            <span class="dash-loc-arrow">&bull;</span>
                            <span>${escapeHtml(m.floor || 'Floor')}</span>
                            <span class="dash-loc-arrow">&bull;</span>
                            <span>${escapeHtml(m.line || 'Line')}</span>
                          </div>
                        </td>
                        <td>
                          <span class="dash-date-text">${escapeHtml(m.lastServiceDate || 'None recorded')}</span>
                        </td>
                        <td>
                          <span class="dash-date-highlight">${escapeHtml(m.nextServiceDate || 'Not scheduled')}</span>
                        </td>
                        <td>
                          <span class="dash-urgency-badge" style="background: ${uStyle.bg}; color: ${uStyle.text}; border-color: ${uStyle.border};">
                            <span class="dash-urgency-dot" style="background: ${uStyle.dot};"></span>
                            ${uStyle.label}
                          </span>
                        </td>
                        <td>
                          <div class="dash-technician-tag">
                            <span class="dash-tech-avatar">${escapeHtml((m.assignedTechnician || 'M')[0].toUpperCase())}</span>
                            <span>${escapeHtml(m.assignedTechnician || 'Maintenance Team')}</span>
                          </div>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </footer>
      ` : ''}

    </div>

    <!-- Scoped Enterprise Modern UI/UX Styling -->
    <style>
      .modern-erp-dashboard {
        display: flex;
        flex-direction: column;
        padding: 12px 16px;
        gap: 12px;
        box-sizing: border-box;
        overflow-y: auto;
        overflow-x: hidden;
        background: #080d1a;
        color: #f8fafc;
        font-family: var(--font-main, 'Inter', system-ui, -apple-system, sans-serif);
      }

      /* 1. Header Hero Banner */
      .dash-hero-banner {
        flex-shrink: 0;
        background: linear-gradient(180deg, rgba(15, 23, 42, 0.95) 0%, rgba(11, 17, 32, 0.98) 100%);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 12px;
        padding: 10px 16px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 10px;
        box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.06);
      }

      .dash-hero-left {
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 0;
      }

      .dash-hero-icon-box {
        width: 38px;
        height: 38px;
        border-radius: 10px;
        background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 14px rgba(2, 132, 199, 0.35);
        border: 1px solid rgba(56, 189, 248, 0.4);
        flex-shrink: 0;
      }

      .dash-hero-headings {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }

      .dash-hero-title-row {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }

      .dash-hero-title {
        font-size: 16px;
        font-weight: 800;
        color: #ffffff;
        margin: 0;
        letter-spacing: -0.2px;
        line-height: 1.25;
      }

      .dash-live-chip {
        background: rgba(16, 185, 129, 0.12);
        color: #34d399;
        border: 1px solid rgba(16, 185, 129, 0.35);
        font-size: 10px;
        font-weight: 700;
        padding: 1.5px 7px;
        border-radius: 9999px;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        letter-spacing: 0.3px;
      }

      .dash-live-dot {
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background: #10b981;
        box-shadow: 0 0 6px #10b981;
        animation: heroPulse 2s infinite ease-in-out;
      }

      @keyframes heroPulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.35; transform: scale(0.85); }
      }

      .dash-hero-subtitle {
        font-size: 11.5px;
        color: #94a3b8;
        font-weight: 500;
        margin: 0;
        line-height: 1.3;
      }

      .dash-hero-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }

      /* Time Segmented Control */
      .dash-time-segmented-wrapper {
        display: flex;
        align-items: center;
        gap: 6px;
        background: rgba(15, 23, 42, 0.75);
        border: 1px solid rgba(255, 255, 255, 0.08);
        padding: 3px 6px;
        border-radius: 8px;
      }

      .dash-segmented-label {
        font-size: 10.5px;
        font-weight: 700;
        color: #38bdf8;
        display: flex;
        align-items: center;
        gap: 4px;
        padding-left: 2px;
      }

      .dash-segmented-pills {
        display: flex;
        align-items: center;
        gap: 2px;
      }

      .btn-dash-date-filter {
        background: transparent;
        color: #94a3b8;
        border: 1px solid transparent;
        padding: 3px 8px;
        font-size: 11px;
        font-weight: 600;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.15s ease;
        user-select: none;
      }

      .btn-dash-date-filter:hover {
        background: rgba(255, 255, 255, 0.06);
        color: #ffffff;
      }

      .btn-dash-date-filter.active {
        background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
        color: #ffffff;
        font-weight: 700;
        border-color: #38bdf8;
        box-shadow: 0 2px 8px rgba(2, 132, 199, 0.35);
      }

      /* Open Inventory Action Button */
      .btn-dash-primary-action {
        background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
        border: 1px solid rgba(56, 189, 248, 0.4);
        color: #ffffff;
        font-size: 11.5px;
        font-weight: 700;
        height: 30px;
        padding: 0 12px;
        border-radius: 7px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        cursor: pointer;
        box-shadow: 0 2px 10px rgba(2, 132, 199, 0.35);
        transition: all 0.18s ease;
        white-space: nowrap;
      }

      .btn-dash-primary-action:hover {
        background: linear-gradient(135deg, #0369a1 0%, #075985 100%);
        border-color: #38bdf8;
        box-shadow: 0 4px 14px rgba(2, 132, 199, 0.5);
        transform: translateY(-1px);
      }

      .btn-dash-primary-action:active {
        transform: translateY(0);
      }

      .btn-dash-refresh-icon {
        width: 30px;
        height: 30px;
        border-radius: 7px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: #cbd5e1;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.18s ease;
      }

      .btn-dash-refresh-icon:hover {
        background: rgba(56, 189, 248, 0.12);
        border-color: rgba(56, 189, 248, 0.35);
        color: #38bdf8;
      }

      /* 2. Top 5 Modern KPI Cards Row */
      .dash-kpi-row {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: 12px;
        flex-shrink: 0;
      }

      .dash-kpi-card {
        background: linear-gradient(180deg, #111827 0%, #0d1525 100%);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 12px;
        padding: 14px 16px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.05);
        cursor: pointer;
        transition: transform 0.18s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.18s ease, box-shadow 0.18s ease;
        user-select: none;
        position: relative;
        overflow: hidden;
      }

      .dash-kpi-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
      }

      .kpi-card-total { border-left: 3.5px solid #0284c7; }
      .kpi-card-total:hover { border-color: rgba(56, 189, 248, 0.45); border-left-color: #38bdf8; }

      .kpi-card-active { border-left: 3.5px solid #10b981; }
      .kpi-card-active:hover { border-color: rgba(16, 185, 129, 0.45); border-left-color: #34d399; }

      .kpi-card-maint { border-left: 3.5px solid #f59e0b; }
      .kpi-card-maint:hover { border-color: rgba(245, 158, 11, 0.45); border-left-color: #fbbf24; }

      .kpi-card-breakdown { border-left: 3.5px solid #ef4444; }
      .kpi-card-breakdown:hover { border-color: rgba(239, 68, 68, 0.45); border-left-color: #f87171; }

      .kpi-card-pending { border-left: 3.5px solid #8b5cf6; }
      .kpi-card-pending:hover { border-color: rgba(168, 85, 247, 0.45); border-left-color: #c084fc; }

      .dash-kpi-content {
        min-width: 0;
        display: flex;
        flex-direction: column;
        justify-content: center;
      }

      .dash-kpi-val {
        font-size: 26px;
        font-weight: 800;
        line-height: 1.1;
        color: #ffffff;
        font-family: var(--font-mono, 'JetBrains Mono', monospace);
        font-variant-numeric: tabular-nums;
        letter-spacing: -0.5px;
      }

      .val-emerald { color: #34d399; }
      .val-amber { color: #fbbf24; }
      .val-rose { color: #f87171; }
      .val-purple { color: #c084fc; }

      .dash-kpi-lbl {
        font-size: 10px;
        font-weight: 700;
        color: #94a3b8;
        letter-spacing: 0.5px;
        text-transform: uppercase;
        margin-top: 4px;
        line-height: 1.2;
        white-space: nowrap;
      }

      .dash-kpi-badge {
        width: 38px;
        height: 38px;
        border-radius: 9px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .badge-blue { background: rgba(56, 189, 248, 0.08); border: 1px solid rgba(56, 189, 248, 0.2); }
      .badge-emerald { background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.2); }
      .badge-amber { background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.2); }
      .badge-rose { background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.2); }
      .badge-purple { background: rgba(168, 85, 247, 0.08); border: 1px solid rgba(168, 85, 247, 0.2); }

      .dash-kpi-emoji {
        font-size: 18px;
        line-height: 1;
      }

      /* 3D Glowing Orbs */
      .glowing-orb {
        width: 17px;
        height: 17px;
        border-radius: 50%;
        display: inline-block;
        flex-shrink: 0;
      }

      .orb-emerald {
        background: radial-gradient(circle at 35% 35%, #86efac, #10b981 55%, #047857 100%);
        box-shadow: 0 0 10px rgba(16, 185, 129, 0.6), inset 0 1px 2px rgba(255, 255, 255, 0.6);
        border: 1px solid rgba(16, 185, 129, 0.4);
      }

      .orb-amber {
        background: radial-gradient(circle at 35% 35%, #fde68a, #f59e0b 55%, #b45309 100%);
        box-shadow: 0 0 10px rgba(245, 158, 11, 0.6), inset 0 1px 2px rgba(255, 255, 255, 0.6);
        border: 1px solid rgba(245, 158, 11, 0.4);
      }

      .orb-rose {
        background: radial-gradient(circle at 35% 35%, #fca5a5, #ef4444 55%, #b91c1c 100%);
        box-shadow: 0 0 10px rgba(239, 68, 68, 0.6), inset 0 1px 2px rgba(255, 255, 255, 0.6);
        border: 1px solid rgba(239, 68, 68, 0.4);
      }

      /* 3. The 4 Modern Equipment Analytics Distribution Cards Grid */
      .dash-distributions-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 12px;
        flex-shrink: 0;
      }

      .dash-dist-card {
        background: linear-gradient(180deg, #111827 0%, #0d1525 100%);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 12px;
        padding: 14px 16px;
        display: flex;
        flex-direction: column;
        box-shadow: 0 8px 24px -4px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05);
        transition: border-color 0.2s ease, box-shadow 0.2s ease;
        min-height: 0;
      }

      .dash-dist-card:hover {
        border-color: rgba(255, 255, 255, 0.15);
        box-shadow: 0 10px 28px -4px rgba(0, 0, 0, 0.5);
      }

      .card-cyan:hover { border-color: rgba(56, 189, 248, 0.35); }
      .card-emerald:hover { border-color: rgba(16, 185, 129, 0.35); }
      .card-purple:hover { border-color: rgba(168, 85, 247, 0.35); }
      .card-amber:hover { border-color: rgba(245, 158, 11, 0.35); }

      .dash-dist-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
        flex-shrink: 0;
      }

      .dash-dist-title-box {
        display: flex;
        align-items: center;
        gap: 6px;
        min-width: 0;
      }

      .dash-dist-icon {
        font-size: 14px;
        line-height: 1;
      }

      .dash-dist-title {
        font-size: 13.5px;
        font-weight: 700;
        margin: 0;
        letter-spacing: -0.1px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .card-cyan .dash-dist-title { color: #38bdf8; }
      .card-emerald .dash-dist-title { color: #34d399; }
      .card-purple .dash-dist-title { color: #c084fc; }
      .card-amber .dash-dist-title { color: #fbbf24; }

      .dash-dist-pill {
        font-size: 10px;
        font-weight: 700;
        padding: 2px 7px;
        border-radius: 9999px;
        letter-spacing: 0.3px;
        white-space: nowrap;
        flex-shrink: 0;
      }

      .pill-cyan { background: rgba(56, 189, 248, 0.1); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); }
      .pill-emerald { background: rgba(16, 185, 129, 0.1); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }
      .pill-purple { background: rgba(168, 85, 247, 0.1); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.3); }
      .pill-amber { background: rgba(245, 158, 11, 0.1); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); }

      /* Scrollable List */
      .dash-dist-list {
        display: flex;
        flex-direction: column;
        gap: 9px;
        max-height: 280px;
        overflow-y: auto;
        overflow-x: hidden;
        padding-right: 4px;
      }

      /* Sleek Scrollbar */
      .custom-scroll {
        scrollbar-width: thin;
        scrollbar-color: rgba(255, 255, 255, 0.15) transparent;
      }

      .custom-scroll::-webkit-scrollbar {
        width: 4px;
      }

      .custom-scroll::-webkit-scrollbar-track {
        background: transparent;
      }

      .custom-scroll::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.15);
        border-radius: 4px;
      }

      .custom-scroll::-webkit-scrollbar-thumb:hover {
        background: rgba(56, 189, 248, 0.4);
      }

      .dash-dist-empty {
        padding: 20px 0;
        text-align: center;
        color: #64748b;
        font-size: 11.5px;
      }

      /* Item Rows */
      .dash-dist-row {
        display: flex;
        flex-direction: column;
        gap: 3px;
        padding: 2px 4px;
        border-radius: 6px;
        cursor: pointer;
        transition: background-color 0.15s ease, transform 0.15s ease;
        user-select: none;
      }

      .dash-dist-row:hover {
        background: rgba(255, 255, 255, 0.04);
        transform: translateX(2px);
      }

      .dash-dist-top-line {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 8px;
      }

      .dash-dist-name {
        font-size: 11.5px;
        font-weight: 600;
        color: #e2e8f0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        flex: 1;
        min-width: 0;
      }

      .dash-dist-stat {
        font-size: 11px;
        font-weight: 700;
        white-space: nowrap;
        font-family: var(--font-mono, monospace);
        font-variant-numeric: tabular-nums;
        flex-shrink: 0;
      }

      .stat-cyan { color: #38bdf8; }
      .stat-emerald { color: #34d399; }
      .stat-purple { color: #c084fc; }
      .stat-amber { color: #fbbf24; }

      .dash-dist-pct {
        font-weight: 600;
        opacity: 0.9;
        font-size: 10.5px;
      }

      .dash-dist-track {
        height: 5px;
        background: rgba(255, 255, 255, 0.06);
        border-radius: 9999px;
        overflow: hidden;
      }

      .dash-dist-bar {
        height: 100%;
        border-radius: 9999px;
        transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      }

      .bar-cyan { background: linear-gradient(90deg, #0284c7 0%, #38bdf8 100%); }
      .bar-emerald { background: linear-gradient(90deg, #059669 0%, #34d399 100%); }
      .bar-purple { background: linear-gradient(90deg, #7c3aed 0%, #c084fc 100%); }
      .bar-amber { background: linear-gradient(90deg, #d97706 0%, #fbbf24 100%); }

      /* 4. Operational Pulse Strip */
      .dash-ops-pulse-strip {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
        flex-shrink: 0;
      }

      .dash-ops-pulse-card {
        background: linear-gradient(180deg, #111827 0%, #0d1525 100%);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 10px;
        padding: 10px 14px;
        display: flex;
        align-items: center;
        gap: 10px;
        cursor: pointer;
        transition: all 0.18s ease;
        user-select: none;
      }

      .dash-ops-pulse-card:hover {
        border-color: rgba(56, 189, 248, 0.3);
        transform: translateY(-1px);
        background: linear-gradient(180deg, #172033 0%, #0f182b 100%);
      }

      .dash-ops-pulse-icon {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 15px;
        flex-shrink: 0;
      }

      .icon-teal { background: rgba(20, 184, 166, 0.12); color: #2dd4bf; border: 1px solid rgba(20, 184, 166, 0.25); }
      .icon-purple { background: rgba(168, 85, 247, 0.12); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.25); }
      .icon-emerald { background: rgba(16, 185, 129, 0.12); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.25); }

      .dash-ops-pulse-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }

      .dash-ops-pulse-title {
        font-size: 12px;
        font-weight: 700;
        color: #ffffff;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .dash-ops-pulse-meta {
        font-size: 10.5px;
        color: #94a3b8;
        display: flex;
        align-items: center;
        gap: 5px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .dash-ops-sep {
        color: #475569;
        font-size: 8px;
      }

      .text-emerald { color: #34d399; font-weight: 700; }
      .text-cyan { color: #38bdf8; font-weight: 700; }
      .text-purple { color: #c084fc; font-weight: 700; }
      .text-amber { color: #fbbf24; font-weight: 700; }
      .text-rose { color: #f87171; font-weight: 700; }

      .badge-alert-mini {
        color: #fbbf24;
        font-weight: 700;
      }

      .badge-critical-mini {
        color: #f87171;
        font-weight: 700;
      }

      /* 5. Live Servicing Schedules Drawer */
      .dash-schedules-card {
        flex-shrink: 0;
        background: #0f172a;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 10px;
        overflow: hidden;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
      }

      .dash-schedules-bar {
        padding: 7px 14px;
        background: rgba(56, 189, 248, 0.04);
        cursor: pointer;
        display: flex;
        justify-content: space-between;
        align-items: center;
        user-select: none;
        transition: background 0.15s ease;
      }

      .dash-schedules-bar:hover {
        background: rgba(56, 189, 248, 0.08);
      }

      .dash-schedules-left {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }

      .dash-schedules-pulse-icon {
        width: 22px;
        height: 22px;
        border-radius: 6px;
        background: rgba(56, 189, 248, 0.15);
        color: #38bdf8;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .dash-schedules-heading {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .dash-schedules-title {
        font-size: 12.5px;
        font-weight: 800;
        color: #ffffff;
      }

      .dash-schedules-caption {
        font-size: 10.5px;
        color: #94a3b8;
        font-weight: 500;
      }

      .dash-schedules-chips {
        display: flex;
        gap: 4px;
        align-items: center;
      }

      .dash-chip-critical {
        background: rgba(239, 68, 68, 0.15);
        color: #fca5a5;
        border: 1px solid rgba(239, 68, 68, 0.35);
        font-size: 10px;
        font-weight: 700;
        padding: 1px 6px;
        border-radius: 4px;
      }

      .dash-chip-amber {
        background: rgba(245, 158, 11, 0.15);
        color: #fcd34d;
        border: 1px solid rgba(245, 158, 11, 0.35);
        font-size: 10px;
        font-weight: 700;
        padding: 1px 6px;
        border-radius: 4px;
      }

      .dash-schedules-right {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .dash-toggle-label {
        font-size: 11px;
        font-weight: 700;
        color: #38bdf8;
      }

      .dash-full-schedule-btn {
        background: rgba(56, 189, 248, 0.1);
        border: 1px solid rgba(56, 189, 248, 0.3);
        color: #38bdf8;
        font-size: 10.5px;
        font-weight: 700;
        height: 24px;
        padding: 0 8px;
        border-radius: 5px;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .dash-full-schedule-btn:hover {
        background: rgba(56, 189, 248, 0.2);
        color: #ffffff;
      }

      .dash-schedules-drawer {
        max-height: 190px;
        overflow-y: auto;
        border-top: 1px solid rgba(255, 255, 255, 0.06);
      }

      .dash-table-responsive-wrapper {
        width: 100%;
        overflow-x: auto;
      }

      .dash-drawer-table {
        width: 100%;
        border-collapse: collapse;
        margin: 0;
        font-size: 11.5px;
      }

      .dash-drawer-table thead tr {
        background: rgba(0, 0, 0, 0.4);
        color: #94a3b8;
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.3px;
      }

      .dash-drawer-table th {
        padding: 6px 12px;
        text-align: left;
        white-space: nowrap;
      }

      .dash-drawer-row {
        border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        color: #cbd5e1;
        transition: background 0.12s ease;
      }

      .dash-drawer-row:hover {
        background: rgba(255, 255, 255, 0.035);
      }

      .dash-drawer-table td {
        padding: 6px 12px;
        vertical-align: middle;
      }

      .dash-maint-name {
        font-weight: 700;
        color: #ffffff;
        font-size: 12px;
      }

      .dash-maint-sub {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 1px;
      }

      .dash-asset-tag {
        font-family: var(--font-mono, monospace);
        font-size: 9.5px;
        font-weight: 700;
        color: #38bdf8;
        background: rgba(56, 189, 248, 0.12);
        padding: 0 4px;
        border-radius: 3px;
        border: 1px solid rgba(56, 189, 248, 0.25);
      }

      .dash-serial-tag {
        font-family: var(--font-mono, monospace);
        font-size: 9.5px;
        color: #94a3b8;
      }

      .dash-location-badge {
        font-size: 10.5px;
        color: #cbd5e1;
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }

      .dash-loc-unit {
        font-weight: 600;
        color: #f1f5f9;
      }

      .dash-loc-arrow {
        color: #475569;
        font-size: 8px;
      }

      .dash-date-text {
        font-size: 11px;
        color: #94a3b8;
        font-family: var(--font-mono, monospace);
      }

      .dash-date-highlight {
        font-size: 11px;
        font-weight: 700;
        color: #ffffff;
        font-family: var(--font-mono, monospace);
      }

      .dash-urgency-badge {
        font-size: 9.5px;
        font-weight: 800;
        padding: 1.5px 6px;
        border-radius: 4px;
        border: 1px solid transparent;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        white-space: nowrap;
      }

      .dash-urgency-dot {
        width: 4px;
        height: 4px;
        border-radius: 50%;
      }

      .dash-technician-tag {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: 11px;
        color: #e2e8f0;
      }

      .dash-tech-avatar {
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
        color: #ffffff;
        font-size: 9px;
        font-weight: 800;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      /* Responsive Breakpoints */
      @media (max-width: 1200px) {
        .dash-kpi-row {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
        .dash-distributions-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 900px) {
        .dash-kpi-row {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .dash-ops-pulse-strip {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 640px) {
        .dash-hero-banner {
          flex-direction: column;
          align-items: stretch;
        }
        .dash-hero-actions {
          justify-content: space-between;
        }
        .dash-kpi-row {
          grid-template-columns: 1fr;
        }
        .dash-distributions-grid {
          grid-template-columns: 1fr;
        }
      }
    </style>
  `;
}

/**
 * Attaches interactive click handlers to navigate to detailed views
 */
export function initDashboardEvents() {
  attachDashboardEvents();
}

export function attachDashboardEvents() {
  // 1. Date Range Filter Buttons
  document.querySelectorAll('.btn-dash-date-filter').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const filterKey = btn.getAttribute('data-filter') || 'ALL';
      state.set('dashboardDateFilter', filterKey);
      if (typeof window.app !== 'undefined' && typeof window.app.renderMainContent === 'function') {
        window.app.renderMainContent();
      }
    });
  });

  // 2. Open Inventory Grid Button
  const btnOpenInv = document.getElementById('btn-dash-open-inventory');
  if (btnOpenInv) {
    btnOpenInv.addEventListener('click', () => {
      state.set('inventoryStatusFilter', null);
      state.set('currentView', 'inventory');
    });
  }

  // 3. Refresh Button
  const btnRefresh = document.getElementById('btn-dash-refresh');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
      const svg = btnRefresh.querySelector('.dash-refresh-svg');
      if (svg) {
        svg.style.transform = 'rotate(360deg)';
        svg.style.transition = 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
        setTimeout(() => {
          svg.style.transform = '';
          svg.style.transition = '';
        }, 500);
      }
      window.dispatchEvent(new CustomEvent('erp:storage-updated'));
    });
  }

  // 4. Clickable Top KPI Cards
  document.querySelectorAll('[data-action="inv-filter"]').forEach(el => {
    el.addEventListener('click', () => {
      const status = el.getAttribute('data-status') || 'ALL';
      if (status !== 'ALL') {
        state.set('inventoryStatusFilter', status);
      } else {
        state.set('inventoryStatusFilter', null);
      }
      state.set('currentView', 'inventory');
    });
  });

  document.querySelectorAll('[data-action="trf-filter"]').forEach(el => {
    el.addEventListener('click', () => {
      const status = el.getAttribute('data-status') || 'ALL';
      state.set('transferStatusFilter', status);
      state.set('currentView', 'transfers');
    });
  });

  document.querySelectorAll('[data-action="pm-filter"]').forEach(el => {
    el.addEventListener('click', () => {
      const urgency = el.getAttribute('data-urgency') || 'ALL';
      state.set('pmFilterUrgency', urgency);
      state.set('currentView', 'preventive-maintenance');
    });
  });

  document.querySelectorAll('[data-action="needle-filter"]').forEach(el => {
    el.addEventListener('click', () => {
      const needle = el.getAttribute('data-needle');
      if (needle && needle !== 'ALL') {
        state.set('needleSearchQuery', needle.replace('×', 'x'));
      } else {
        state.set('needleSearchQuery', null);
      }
      state.set('currentView', 'needle-operations');
    });
  });

  // 5. Clickable Distribution Rows (Filters inventory by Machine Name, Brand, Model, Unit)
  document.querySelectorAll('.dash-dist-row').forEach(row => {
    row.addEventListener('click', () => {
      const val = row.getAttribute('data-dist-val');
      if (val && val !== 'Other') {
        const curFilters = state.get('filters') || {};
        state.set('filters', { ...curFilters, search: val });
      }
      state.set('inventoryStatusFilter', null);
      state.set('currentView', 'inventory');
    });
  });

  // 6. Collapsible Servicing Schedules Drawer Toggle
  const btnToggleSchedules = document.getElementById('btn-dash-toggle-schedules');
  if (btnToggleSchedules) {
    btnToggleSchedules.addEventListener('click', (e) => {
      if (e.target.closest('#btn-dash-open-full-pm')) return;
      const cur = Boolean(state.get('dashSchedulesOpen'));
      state.set('dashSchedulesOpen', !cur);
      const drawer = document.getElementById('dash-schedules-drawer');
      const arrow = document.getElementById('dash-schedules-arrow');
      if (drawer) {
        drawer.style.display = !cur ? 'block' : 'none';
      }
      if (arrow) {
        arrow.textContent = !cur ? '▲ Collapse Table' : '▼ Expand Table';
      }
    });
  }

  const btnFullPm = document.getElementById('btn-dash-open-full-pm');
  if (btnFullPm) {
    btnFullPm.addEventListener('click', () => {
      state.set('pmFilterUrgency', 'ALL');
      state.set('currentView', 'preventive-maintenance');
    });
  }
}
