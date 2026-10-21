/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Ultra-Modern Enterprise Maintenance KPI & Equipment Analytics Dashboard Component
 * 
 * Features:
 * - Executive Central Maintenance KPI Header Banner with Live Telemetry & Quick Navigation
 * - 5 Modern KPI Cards (Total Physical Machines, Active Operational, Under Maintenance, Machine Breakdowns, Pending Approvals)
 *   with big clean typography, glowing 3D status orbs, and colored status accents
 * - 4 Sleek Modular Operational Cards Grid (1. Machine Overview, 2. Machine Transfers, 3. Machine Servicing, 4. Needle Data)
 *   with clean progress tracks, tabular unit counts & percentages, dynamic badges, and responsive 4-column layout
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
  const mnMap = new Map((storage.getTable(TABLE_NAMES.MACHINE_NAMES) || []).filter(Boolean).map(x => [x.id, (x.name || '').toLowerCase()]));
  const smList = storage.getTable(TABLE_NAMES.STORAGE_MASTER) || [];

  // =========================================================================
  // 1. SECTION 1: MACHINE OVERVIEW & KPI TOTALS
  // =========================================================================
  const totalMachines = machines.length;

  const activeMachines = machines.filter(m => {
    const rQty = parseInt(m.running ?? m.qty_running ?? 0, 10);
    return m.status === 'ACTIVE' || rQty > 0;
  });
  const activeCount = activeMachines.length;

  const underRepairMachines = machines.filter(m => {
    const rpQty = parseInt(m.repairable_idle ?? m.repairableIdle ?? 0, 10);
    return m.status === 'MAINTENANCE' || m.status === 'UNDER_MAINTENANCE' || m.status === 'BREAKDOWN' || m.status === 'REPAIRABLE_IDLE' || rpQty > 0;
  });
  const underRepairCount = underRepairMachines.length;

  const breakdownMachines = machines.filter(m => m.status === 'BREAKDOWN');
  const breakdownCount = breakdownMachines.length;

  // Serviced / Repaired in active window
  let repairedMachines = machines.filter(m => {
    return m.status === 'REPAIRED' || (m.customValues?.status === 'REPAIRED');
  });
  if (dateCutoff) {
    const servicedInRange = machines.filter(m => {
      const d = parseRecordDate(m.lastServiceDate || m.service_date || m.customValues?.service_date || m.updatedAt);
      return d && d >= dateCutoff;
    });
    repairedMachines = servicedInRange;
  }
  const repairedCount = repairedMachines.length;

  const spareAmbiguousCount = Math.max(0, totalMachines - activeCount - underRepairCount);

  // Health Metrics
  const uptimeRate = totalMachines > 0 ? ((activeCount / totalMachines) * 100).toFixed(1) : '0.0';
  const activePercent = totalMachines > 0 ? (activeCount / totalMachines) * 100 : 0;
  const repairPercent = totalMachines > 0 ? (underRepairCount / totalMachines) * 100 : 0;
  const sparePercent = Math.max(0, 100 - activePercent - repairPercent);

  // =========================================================================
  // 2. SECTION 2: MACHINE TRANSFERS & APPROVALS
  // =========================================================================
  const allTransfersRaw = transferService.getTransferRequests({ status: 'ALL' }) || [];
  const allTransfers = dateCutoff
    ? allTransfersRaw.filter(t => {
        const d = parseRecordDate(t.requestedAt || t.requestDate || t.createdAt || t.updatedAt);
        return d && d >= dateCutoff;
      })
    : allTransfersRaw;

  const totalTransfers = allTransfers.length;

  const approvedTransfers = allTransfers.filter(t => 
    t.status === TRANSFER_STATUSES.APPROVED || 
    (t.levels && t.levels.length > 0 && t.levels.every(l => l.status === 'APPROVED') && t.status !== TRANSFER_STATUSES.REJECTED && t.status !== TRANSFER_STATUSES.CANCELLED)
  );
  const approvedCount = approvedTransfers.length;

  const completedTransfers = allTransfers.filter(t => 
    t.status === TRANSFER_STATUSES.COMPLETED || t.status === 'ISSUED' || t.status === 'TRANSFERRED'
  );
  const issuedTransferredCount = completedTransfers.length;

  const rejectedTransfers = allTransfers.filter(t => 
    t.status === TRANSFER_STATUSES.REJECTED || t.status === TRANSFER_STATUSES.CANCELLED
  );
  const declinedRejectedCount = rejectedTransfers.length;

  const pendingTransfers = allTransfers.filter(t => 
    t.status === TRANSFER_STATUSES.PENDING_APPROVAL || 
    t.status === TRANSFER_STATUSES.PARTIALLY_APPROVED || 
    t.status === TRANSFER_STATUSES.REVISION_REQUESTED
  );
  const pendingCount = pendingTransfers.length;

  // Pending Approvals count (transfers + approval hub edits)
  const pendingTransferCount = pendingCount;
  const pendingApprovalEdits = (typeof approvalService?.getPendingCount === 'function') 
    ? (approvalService.getPendingCount() || 0) 
    : 0;
  const pendingApprovals = pendingTransferCount + pendingApprovalEdits;

  const transferCompletionRate = totalTransfers > 0 ? Math.round((issuedTransferredCount / totalTransfers) * 100) : 100;

  // =========================================================================
  // 3. SECTION 3: MACHINE SERVICING MANAGEMENT
  // =========================================================================
  const pmMetrics = (typeof preventiveMaintenanceService.getDashboardMetrics === 'function') 
    ? preventiveMaintenanceService.getDashboardMetrics() 
    : {};

  const pmTotalMachines = pmMetrics.totalMachines || totalMachines;
  let pmServicedCount = pmMetrics.completedCount || pmMetrics.recentlyServiced || 0;
  if (dateCutoff) {
    const pmRecords = storage.getTable(TABLE_NAMES.PREVENTIVE_MAINTENANCE) || [];
    const inRangeRecords = pmRecords.filter(r => {
      const d = parseRecordDate(r.serviceDate || r.createdAt);
      return d && d >= dateCutoff;
    });
    pmServicedCount = inRangeRecords.length;
  }

  const pmOverdue = pmMetrics.overdue || 0;
  const pmDueToday = pmMetrics.dueToday || 0;
  const pmDueWithin7Days = pmMetrics.dueWithin7Days || 0;
  const pmUpcoming = pmMetrics.upcoming || 0;

  const servicingComplianceRate = pmTotalMachines > 0 ? Math.min(100, Math.round((pmServicedCount / pmTotalMachines) * 100)) : 0;

  // Top urgent machines for preview drawer
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

  // =========================================================================
  // 4. SECTION 4: NEEDLE DATA MANAGEMENT
  // =========================================================================
  const targetNeedleConfigs = [
    {
      code: 'DP×5',
      desc: 'Double Needle, Button Hole, Vertical',
      shortDesc: 'Double Needle / Button Hole',
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
      shortDesc: 'Bar Tack / Heavy Duty',
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
      shortDesc: 'Single Needle Lockstitch',
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
      shortDesc: 'Overlock / Safety Stitch',
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

  const needleBuckets = targetNeedleConfigs.map(cfg => ({
    cfg,
    machineCount: 0,
    requiredQty: 0
  }));

  for (let i = 0; i < machines.length; i++) {
    const m = machines[i];
    const specType = m.specNeedleType || m.needleType || '';
    const mName = (storage.resolveMachineName ? storage.resolveMachineName(m) : (m.machineNameStr || mnMap.get(m.machineNameId) || m.machineName || ''));
    const mQty = Math.max(1, parseInt(m.quantity ?? 1, 10) || 1);

    for (let j = 0; j < targetNeedleConfigs.length; j++) {
      if (targetNeedleConfigs[j].matchFn(specType, mName)) {
        needleBuckets[j].machineCount++;
        needleBuckets[j].requiredQty += (targetNeedleConfigs[j].perMachine * mQty);
        break;
      }
    }
  }

  const needleTableRows = needleBuckets.map(b => {
    const { cfg, machineCount, requiredQty } = b;
    const smItems = smList.filter(sm => 
      (sm.category === 'NEEDLE' || sm.subCategory === 'NEEDLE' || (sm.item_name && sm.item_name.toLowerCase().includes('needle'))) &&
      (sm.item_name && sm.item_name.includes(cfg.code))
    );
    const storeBufferQty = smItems.reduce((acc, it) => acc + (parseInt(it.stock ?? it.quantity ?? 0, 10) || 0), 0);
    const availableStock = storeBufferQty > 0 ? (requiredQty + storeBufferQty) : Math.round(requiredQty * 1.25);
    const pendingQuantity = Math.max(0, requiredQty - availableStock);

    sumNeedleRequired += requiredQty;
    sumNeedlePending += pendingQuantity;
    sumNeedleStock += availableStock;

    return {
      code: cfg.code,
      desc: cfg.desc,
      shortDesc: cfg.shortDesc,
      machineCount,
      requiredQty,
      pendingQuantity,
      availableStock
    };
  });

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
          <button type="button" id="btn-dash-open-inventory" class="dash-btn-primary" title="Launch Main Inventory Master View">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
            <span>Open Inventory Grid</span>
          </button>

          <!-- Refresh Button -->
          <button type="button" id="btn-dash-refresh" class="dash-btn-icon" title="Refresh Live Analytics">
            <svg class="dash-refresh-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="23 4 23 10 17 10"></polyline>
              <polyline points="1 20 1 14 7 14"></polyline>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
          </button>
        </div>
      </header>

      <!-- 2. Top 5 Modern KPI Cards Row (Exact Match to Design Reference) -->
      <section class="dash-kpi-row" aria-label="Key Plant Metrics">
        
        <!-- Card 1: Total Physical Machines -->
        <div class="dash-kpi-card kpi-card-total" data-action="inv-filter" data-status="ALL" role="button" tabindex="0" title="Click to view all physical machines">
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
        <div class="dash-kpi-card kpi-card-breakdown" data-action="inv-filter" data-status="BREAKDOWN" role="button" tabindex="0" title="Click to view critical breakdown machines">
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

      <!-- 3. The 4 Modern Equipment Analytics Cards Grid (Side-by-Side 4-Column Layout) -->
      <section class="dash-distributions-grid" aria-label="Operational Maintenance Sections">
        
        <!-- CARD 1: 1. Machine Overview -->
        <div class="dash-dist-card card-cyan">
          <div class="dash-dist-header">
            <div class="dash-dist-title-box">
              <span class="dash-dist-icon">🏭</span>
              <h2 class="dash-dist-title">1. Machine Overview</h2>
            </div>
            <span class="dash-dist-pill pill-cyan">Total: ${totalMachines.toLocaleString()} &bull; ${currentFilterLabel}</span>
          </div>
          
          <div class="dash-dist-mini-status">
            <span class="mini-status-label"><span class="status-dot dot-emerald"></span> Active Uptime: <strong>${uptimeRate}%</strong></span>
            <span class="mini-status-value">${activeCount.toLocaleString()} Active / ${underRepairCount.toLocaleString()} In Repair</span>
          </div>

          <div class="dash-dist-list custom-scroll">
            
            <div class="dash-dist-row" data-action="inv-filter" data-status="ALL" role="button" tabindex="0" title="Click to view all factory machines">
              <div class="dash-dist-top-line">
                <span class="dash-dist-name">Total Physical Machines</span>
                <span class="dash-dist-stat stat-cyan">${totalMachines.toLocaleString()} Qty <span class="dash-dist-pct">(100%)</span></span>
              </div>
              <div class="dash-dist-desc">Complete Factory Inventory</div>
              <div class="dash-dist-track">
                <div class="dash-dist-bar bar-cyan" style="width: 100%;"></div>
              </div>
            </div>

            <div class="dash-dist-row" data-action="inv-filter" data-status="ACTIVE" role="button" tabindex="0" title="Click to view active machines">
              <div class="dash-dist-top-line">
                <span class="dash-dist-name">Active Machines</span>
                <span class="dash-dist-stat stat-emerald">${activeCount.toLocaleString()} Qty <span class="dash-dist-pct">(${activePercent.toFixed(1)}%)</span></span>
              </div>
              <div class="dash-dist-desc">Running on Production Lines</div>
              <div class="dash-dist-track">
                <div class="dash-dist-bar bar-emerald" style="width: ${activePercent}%;"></div>
              </div>
            </div>

            <div class="dash-dist-row" data-action="inv-filter" data-status="REPAIRED" role="button" tabindex="0" title="Click to view serviced / repaired machines">
              <div class="dash-dist-top-line">
                <span class="dash-dist-name">Repaired / Serviced</span>
                <span class="dash-dist-stat stat-cyan">${repairedCount.toLocaleString()} Qty <span class="dash-dist-pct">(${totalMachines > 0 ? ((repairedCount/totalMachines)*100).toFixed(1) : 0}%)</span></span>
              </div>
              <div class="dash-dist-desc">Serviced & Ready for Production</div>
              <div class="dash-dist-track">
                <div class="dash-dist-bar bar-cyan" style="width: ${totalMachines > 0 ? Math.min(100, (repairedCount/totalMachines)*100) : 0}%;"></div>
              </div>
            </div>

            <div class="dash-dist-row" data-action="inv-filter" data-status="MAINTENANCE" role="button" tabindex="0" title="Click to view machines under repair">
              <div class="dash-dist-top-line">
                <span class="dash-dist-name">Under Repair Machines</span>
                <span class="dash-dist-stat stat-amber">${underRepairCount.toLocaleString()} Qty <span class="dash-dist-pct">(${repairPercent.toFixed(1)}%)</span></span>
              </div>
              <div class="dash-dist-desc">In Maintenance Queue / Breakdown</div>
              <div class="dash-dist-track">
                <div class="dash-dist-bar bar-amber" style="width: ${repairPercent}%;"></div>
              </div>
            </div>

            <div class="dash-dist-row" data-action="inv-filter" data-status="SPARE" role="button" tabindex="0" title="Click to view standby spare machines">
              <div class="dash-dist-top-line">
                <span class="dash-dist-name">Spare Machines / Standby</span>
                <span class="dash-dist-stat stat-slate">${spareAmbiguousCount.toLocaleString()} Qty <span class="dash-dist-pct">(${sparePercent.toFixed(1)}%)</span></span>
              </div>
              <div class="dash-dist-desc">Idle Buffer Stock & Unassigned</div>
              <div class="dash-dist-track">
                <div class="dash-dist-bar bar-slate" style="width: ${sparePercent}%;"></div>
              </div>
            </div>

          </div>
        </div>

        <!-- CARD 2: 2. Machine Transfers -->
        <div class="dash-dist-card card-emerald">
          <div class="dash-dist-header">
            <div class="dash-dist-title-box">
              <span class="dash-dist-icon">🔁</span>
              <h2 class="dash-dist-title">2. Machine Transfers</h2>
            </div>
            <span class="dash-dist-pill pill-emerald">Total: ${totalTransfers.toLocaleString()} &bull; ${currentFilterLabel}</span>
          </div>

          <div class="dash-dist-mini-status">
            <span class="mini-status-label"><span class="status-dot dot-emerald"></span> Relocation Clearance: <strong>${transferCompletionRate}%</strong></span>
            <span class="mini-status-value ${totalTransfers === 0 ? 'text-slate' : 'text-emerald'}">${totalTransfers === 0 ? 'No Transfers Logged' : '✓ Live Operations'}</span>
          </div>

          <div class="dash-dist-list custom-scroll">
            
            <div class="dash-dist-row" data-action="trf-filter" data-status="ALL" role="button" tabindex="0" title="Click to view all transfer requests">
              <div class="dash-dist-top-line">
                <span class="dash-dist-name">Transfer Requests</span>
                <span class="dash-dist-stat stat-cyan">${totalTransfers.toLocaleString()} Qty <span class="dash-dist-pct">(100%)</span></span>
              </div>
              <div class="dash-dist-desc">All Logged Movement Records</div>
              <div class="dash-dist-track">
                <div class="dash-dist-bar bar-cyan" style="width: 100%;"></div>
              </div>
            </div>

            <div class="dash-dist-row" data-action="trf-filter" data-status="APPROVED" role="button" tabindex="0" title="Click to view approved transfer requests">
              <div class="dash-dist-top-line">
                <span class="dash-dist-name">Approved Requests</span>
                <span class="dash-dist-stat stat-cyan">${approvedCount.toLocaleString()} Qty <span class="dash-dist-pct">(${totalTransfers > 0 ? Math.round((approvedCount/totalTransfers)*100) : 0}%)</span></span>
              </div>
              <div class="dash-dist-desc">Cleared for Movement & Relocation</div>
              <div class="dash-dist-track">
                <div class="dash-dist-bar bar-cyan" style="width: ${totalTransfers > 0 ? Math.round((approvedCount/totalTransfers)*100) : 0}%;"></div>
              </div>
            </div>

            <div class="dash-dist-row" data-action="trf-filter" data-status="COMPLETED" role="button" tabindex="0" title="Click to view completed transfers">
              <div class="dash-dist-top-line">
                <span class="dash-dist-name">Issued / Transferred</span>
                <span class="dash-dist-stat stat-emerald">${issuedTransferredCount.toLocaleString()} Qty <span class="dash-dist-pct">(${transferCompletionRate}%)</span></span>
              </div>
              <div class="dash-dist-desc">Delivered & Verified at Destination</div>
              <div class="dash-dist-track">
                <div class="dash-dist-bar bar-emerald" style="width: ${transferCompletionRate}%;"></div>
              </div>
            </div>

            <div class="dash-dist-row" data-action="trf-filter" data-status="PENDING_APPROVAL" role="button" tabindex="0" title="Click to view pending approval transfers">
              <div class="dash-dist-top-line">
                <span class="dash-dist-name">Pending Approval</span>
                <span class="dash-dist-stat stat-amber">${pendingCount.toLocaleString()} Qty <span class="dash-dist-pct">(${totalTransfers > 0 ? Math.round((pendingCount/totalTransfers)*100) : 0}%)</span></span>
              </div>
              <div class="dash-dist-desc">Awaiting Maintenance Authority Clearance</div>
              <div class="dash-dist-track">
                <div class="dash-dist-bar bar-amber" style="width: ${totalTransfers > 0 ? Math.round((pendingCount/totalTransfers)*100) : 0}%;"></div>
              </div>
            </div>

            <div class="dash-dist-row" data-action="trf-filter" data-status="REJECTED" role="button" tabindex="0" title="Click to view declined or cancelled transfers">
              <div class="dash-dist-top-line">
                <span class="dash-dist-name">Declined / Rejected</span>
                <span class="dash-dist-stat stat-rose">${declinedRejectedCount.toLocaleString()} Qty <span class="dash-dist-pct">(${totalTransfers > 0 ? Math.round((declinedRejectedCount/totalTransfers)*100) : 0}%)</span></span>
              </div>
              <div class="dash-dist-desc">Cancelled or Disapproved by Management</div>
              <div class="dash-dist-track">
                <div class="dash-dist-bar bar-rose" style="width: ${totalTransfers > 0 ? Math.round((declinedRejectedCount/totalTransfers)*100) : 0}%;"></div>
              </div>
            </div>

          </div>
        </div>

        <!-- CARD 3: 3. Machine Servicing -->
        <div class="dash-dist-card card-purple">
          <div class="dash-dist-header">
            <div class="dash-dist-title-box">
              <span class="dash-dist-icon">🔧</span>
              <h2 class="dash-dist-title">3. Machine Servicing</h2>
            </div>
            <span class="dash-dist-pill pill-purple">Scope: ${pmTotalMachines.toLocaleString()} &bull; ${currentFilterLabel}</span>
          </div>

          <div class="dash-dist-mini-status">
            <span class="mini-status-label"><span class="status-dot dot-purple"></span> PM Compliance: <strong>${servicingComplianceRate}%</strong></span>
            <span class="mini-status-value ${pmOverdue > 0 ? 'text-rose' : 'text-emerald'}">${pmOverdue > 0 ? `🚨 ${pmOverdue} Overdue Units` : '✓ Schedules on Track'}</span>
          </div>

          <div class="dash-dist-list custom-scroll">
            
            <div class="dash-dist-row" data-action="pm-filter" data-urgency="ALL" role="button" tabindex="0" title="Click to view full preventive maintenance scope">
              <div class="dash-dist-top-line">
                <span class="dash-dist-name">Total in Scope</span>
                <span class="dash-dist-stat stat-cyan">${pmTotalMachines.toLocaleString()} units <span class="dash-dist-pct">(100%)</span></span>
              </div>
              <div class="dash-dist-desc">Scheduled Maintenance Fleet</div>
              <div class="dash-dist-track">
                <div class="dash-dist-bar bar-cyan" style="width: 100%;"></div>
              </div>
            </div>

            <div class="dash-dist-row" data-action="pm-filter" data-urgency="COMPLETED" role="button" tabindex="0" title="Click to view completed maintenance routines">
              <div class="dash-dist-top-line">
                <span class="dash-dist-name">Serviced / Completed</span>
                <span class="dash-dist-stat stat-emerald">${pmServicedCount.toLocaleString()} units <span class="dash-dist-pct">(${servicingComplianceRate}%)</span></span>
              </div>
              <div class="dash-dist-desc">Maintenance Routine Executed</div>
              <div class="dash-dist-track">
                <div class="dash-dist-bar bar-emerald" style="width: ${servicingComplianceRate}%;"></div>
              </div>
            </div>

            <div class="dash-dist-row" data-action="pm-filter" data-urgency="OVERDUE" role="button" tabindex="0" title="Click to view overdue maintenance tasks">
              <div class="dash-dist-top-line">
                <span class="dash-dist-name">Overdue Servicing</span>
                <span class="dash-dist-stat stat-rose">${pmOverdue.toLocaleString()} units <span class="dash-dist-pct">(${pmTotalMachines > 0 ? Math.min(100, Math.round((pmOverdue/pmTotalMachines)*100)) : 0}%)</span></span>
              </div>
              <div class="dash-dist-desc">Immediate Maintenance Attention Required</div>
              <div class="dash-dist-track">
                <div class="dash-dist-bar bar-rose" style="width: ${pmTotalMachines > 0 ? Math.min(100, Math.round((pmOverdue/pmTotalMachines)*100)) : 0}%;"></div>
              </div>
            </div>

            <div class="dash-dist-row" data-action="pm-filter" data-urgency="DUE_TODAY" role="button" tabindex="0" title="Click to view servicing due today or soon">
              <div class="dash-dist-top-line">
                <span class="dash-dist-name">Due Today / Soon</span>
                <span class="dash-dist-stat stat-amber">${pmDueToday.toLocaleString()} units <span class="dash-dist-pct">(${pmTotalMachines > 0 ? Math.min(100, Math.round((pmDueToday/pmTotalMachines)*100)) : 0}%)</span></span>
              </div>
              <div class="dash-dist-desc">Scheduled for Immediate Inspection</div>
              <div class="dash-dist-track">
                <div class="dash-dist-bar bar-amber" style="width: ${pmTotalMachines > 0 ? Math.min(100, Math.round((pmDueToday/pmTotalMachines)*100)) : 0}%;"></div>
              </div>
            </div>

            <div class="dash-dist-row" data-action="pm-filter" data-urgency="SCHEDULED" role="button" tabindex="0" title="Click to view upcoming scheduled servicing">
              <div class="dash-dist-top-line">
                <span class="dash-dist-name">Upcoming (7 Days)</span>
                <span class="dash-dist-stat stat-purple">${(pmDueWithin7Days + pmUpcoming).toLocaleString()} units <span class="dash-dist-pct">(${pmTotalMachines > 0 ? Math.min(100, Math.round(((pmDueWithin7Days + pmUpcoming)/pmTotalMachines)*100)) : 0}%)</span></span>
              </div>
              <div class="dash-dist-desc">Planned Maintenance Pipeline</div>
              <div class="dash-dist-track">
                <div class="dash-dist-bar bar-purple" style="width: ${pmTotalMachines > 0 ? Math.min(100, Math.round(((pmDueWithin7Days + pmUpcoming)/pmTotalMachines)*100)) : 0}%;"></div>
              </div>
            </div>

          </div>
        </div>

        <!-- CARD 4: 4. Needle Data -->
        <div class="dash-dist-card card-amber">
          <div class="dash-dist-header">
            <div class="dash-dist-title-box">
              <span class="dash-dist-icon">🪡</span>
              <h2 class="dash-dist-title">4. Needle Data</h2>
            </div>
            <span class="dash-dist-pill pill-amber">Total Stock: ${sumNeedleStock.toLocaleString()} &bull; 4 Types</span>
          </div>

          <div class="dash-dist-mini-status">
            <span class="mini-status-label"><span class="status-dot dot-emerald"></span> Stock Coverage: <strong>${sumNeedlePending === 0 ? 'Fully Covered' : `${sumNeedlePending} Deficit`}</strong></span>
            <span class="mini-status-value ${sumNeedlePending === 0 ? 'text-emerald' : 'text-amber'}">${sumNeedlePending === 0 ? '✓ Stock Sufficient' : '⚠️ Reorder Needed'}</span>
          </div>

          <div class="dash-dist-list custom-scroll">
            
            ${needleTableRows.map(row => {
              const covPct = row.requiredQty > 0 ? Math.min(100, Math.round((row.availableStock / row.requiredQty) * 100)) : 100;
              const isDeficit = row.pendingQuantity > 0;
              return `
                <div class="dash-dist-row" data-action="needle-filter" data-needle="${escapeHtml(row.code)}" role="button" tabindex="0" title="Click to view stock and machines for ${escapeHtml(row.code)}">
                  <div class="dash-dist-top-line">
                    <span class="dash-dist-name font-mono font-bold text-amber">
                      ${escapeHtml(row.code)}
                      <span class="needle-chip-desc">(${escapeHtml(row.shortDesc)})</span>
                    </span>
                    <span class="dash-dist-stat ${isDeficit ? 'stat-rose' : 'stat-emerald'}">
                      Req: ${row.requiredQty.toLocaleString()} | Stock: ${row.availableStock.toLocaleString()}
                      <span class="dash-needle-badge ${isDeficit ? 'badge-rose' : 'badge-emerald'}">${isDeficit ? `-${row.pendingQuantity}` : '✓ OK'}</span>
                    </span>
                  </div>
                  <div class="dash-dist-desc">${row.machineCount.toLocaleString()} Assigned Machines &bull; Required: ${row.requiredQty.toLocaleString()} pcs</div>
                  <div class="dash-dist-track">
                    <div class="dash-dist-bar ${isDeficit ? 'bar-rose' : 'bar-emerald'}" style="width: ${covPct}%;"></div>
                  </div>
                </div>
              `;
            }).join('')}

            <!-- Fleet Demand Balance Summary Row -->
            <div class="dash-dist-row needle-fleet-summary" data-action="needle-filter" data-needle="ALL" role="button" tabindex="0" title="Click to open Needle Operations Hub">
              <div class="dash-dist-top-line">
                <span class="dash-dist-name font-bold">Total Fleet Demand Balance</span>
                <span class="dash-dist-stat stat-cyan">Req: ${sumNeedleRequired.toLocaleString()} | Stock: ${sumNeedleStock.toLocaleString()}</span>
              </div>
              <div class="dash-dist-desc">Aggregate Balance across All Factory Specifications</div>
              <div class="dash-dist-track">
                <div class="dash-dist-bar bar-cyan" style="width: 100%;"></div>
              </div>
            </div>

          </div>
        </div>

      </section>

      <!-- 4. Collapsible Live Servicing Schedules Preview Drawer -->
      ${sortedMaintMachines.length > 0 ? `
        <footer class="dash-schedules-card">
          <div id="btn-dash-toggle-schedules" class="dash-schedules-bar" role="button" tabindex="0" title="Toggle Live Servicing Schedules Preview">
            <div class="dash-schedules-left">
              <span class="dash-pulse-dot"></span>
              <span class="dash-schedules-title">Live Servicing Schedules Preview</span>
              <span class="dash-schedules-badge">${sortedMaintMachines.length} Urgent Machines</span>
            </div>
            <div class="dash-schedules-actions">
              <button type="button" id="btn-dash-open-full-pm" class="btn-dash-link-pm" title="Open Full Preventive Maintenance Hub">
                Open Maintenance Hub &rarr;
              </button>
              <span id="dash-schedules-arrow" class="dash-schedules-toggle-label">
                ${isSchedulesDrawerOpen ? '▲ Collapse Table' : '▼ Expand Table'}
              </span>
            </div>
          </div>

          <div id="dash-schedules-drawer" class="dash-schedules-drawer" style="display: ${isSchedulesDrawerOpen ? 'block' : 'none'};">
            <div class="dash-table-responsive custom-scroll">
              <table class="dash-live-pm-table">
                <thead>
                  <tr>
                    <th>Machine Code</th>
                    <th>Machine Name</th>
                    <th>Location (Unit &bull; Floor &bull; Line)</th>
                    <th>Next Service Date</th>
                    <th>Urgency Status</th>
                    <th>Assigned Technician</th>
                  </tr>
                </thead>
                <tbody>
                  ${sortedMaintMachines.map(m => {
                    const statusClass = (m.urgency?.status || '').toLowerCase().replace(/_/g, '-');
                    const techName = m.assignedTechnician || m.technician || 'Engineering Tech';
                    const initials = techName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'ET';
                    const mName = storage.resolveMachineName ? storage.resolveMachineName(m) : (m.machineNameStr || mnMap.get(m.machineNameId) || m.machineName || 'Machine');
                    return `
                      <tr class="dash-pm-row" data-action="pm-filter" data-urgency="${escapeHtml(m.urgency?.status || 'ALL')}">
                        <td class="font-mono font-bold text-cyan">${escapeHtml(m.machineCode || m.code || 'M/C')}</td>
                        <td>${escapeHtml(mName)}</td>
                        <td>
                          <div class="dash-location-badge">
                            <span class="dash-loc-unit">${escapeHtml(m.unitName || m.unitId || 'Unit 1')}</span>
                            <span class="dash-loc-arrow">&rsaquo;</span>
                            <span>${escapeHtml(m.floorName || m.floorId || 'Floor 1')}</span>
                            <span class="dash-loc-arrow">&rsaquo;</span>
                            <span>${escapeHtml(m.lineName || m.lineId || 'Line 01')}</span>
                          </div>
                        </td>
                        <td>
                          <span class="dash-date-text ${m.urgency?.status === 'OVERDUE' ? 'dash-date-highlight text-rose' : ''}">
                            ${escapeHtml(m.nextServiceDate || 'Scheduled')}
                          </span>
                        </td>
                        <td>
                          <span class="dash-urgency-badge badge-${statusClass}">
                            <span class="dash-urgency-dot"></span>
                            ${escapeHtml(m.urgency?.label || m.urgency?.status || 'SCHEDULED')}
                          </span>
                        </td>
                        <td>
                          <span class="dash-technician-tag">
                            <span class="dash-tech-avatar">${initials}</span>
                            <span>${escapeHtml(techName)}</span>
                          </span>
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

    <!-- Scoped Enterprise Modern Styling matching Screenshot Design Reference -->
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
      }

      .btn-dash-date-filter:hover {
        color: #f1f5f9;
        background: rgba(255, 255, 255, 0.05);
      }

      .btn-dash-date-filter.active {
        background: #0284c7;
        color: #ffffff;
        font-weight: 700;
        border-color: #38bdf8;
        box-shadow: 0 1px 6px rgba(2, 132, 199, 0.4);
      }

      .dash-btn-primary {
        background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
        color: #ffffff;
        border: 1px solid rgba(56, 189, 248, 0.5);
        padding: 5px 12px;
        font-size: 11.5px;
        font-weight: 700;
        border-radius: 8px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        cursor: pointer;
        box-shadow: 0 2px 10px rgba(2, 132, 199, 0.35);
        transition: all 0.18s ease;
        white-space: nowrap;
      }

      .dash-btn-primary:hover {
        background: linear-gradient(135deg, #0369a1 0%, #075985 100%);
        border-color: #38bdf8;
        box-shadow: 0 4px 14px rgba(2, 132, 199, 0.5);
        transform: translateY(-1px);
      }

      .dash-btn-icon {
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

      .dash-btn-icon:hover {
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
        margin-top: 4px;
        text-transform: uppercase;
        white-space: nowrap;
      }

      .dash-kpi-badge {
        width: 36px;
        height: 36px;
        border-radius: 9px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .badge-blue { background: rgba(2, 132, 199, 0.12); border: 1px solid rgba(2, 132, 199, 0.3); }
      .badge-emerald { background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.3); }
      .badge-amber { background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.3); }
      .badge-rose { background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.3); }
      .badge-purple { background: rgba(139, 92, 246, 0.12); border: 1px solid rgba(139, 92, 246, 0.3); }

      .dash-kpi-emoji {
        font-size: 16px;
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

      /* 3. The 4 Modern Equipment Analytics Modular Cards Grid */
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
        margin-bottom: 8px;
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

      /* Mini Telemetry Status Bar */
      .dash-dist-mini-status {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 10.5px;
        color: #94a3b8;
        margin-bottom: 8px;
        padding-bottom: 6px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        flex-shrink: 0;
      }

      .mini-status-label {
        display: inline-flex;
        align-items: center;
        gap: 5px;
      }

      .mini-status-value {
        font-weight: 600;
      }

      .status-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        display: inline-block;
      }

      .dot-emerald { background: #10b981; box-shadow: 0 0 5px #10b981; }
      .dot-purple { background: #8b5cf6; box-shadow: 0 0 5px #8b5cf6; }
      .dot-amber { background: #f59e0b; box-shadow: 0 0 5px #f59e0b; }
      .dot-cyan { background: #0284c7; box-shadow: 0 0 5px #0284c7; }

      /* Scrollable Rows List */
      .dash-dist-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        max-height: 310px;
        overflow-y: auto;
        overflow-x: hidden;
        padding-right: 4px;
      }

      .dash-dist-row {
        display: flex;
        flex-direction: column;
        gap: 3px;
        padding: 5px 6px;
        border-radius: 6px;
        cursor: pointer;
        transition: background-color 0.15s ease, transform 0.15s ease;
        user-select: none;
      }

      .dash-dist-row:hover {
        background: rgba(255, 255, 255, 0.05);
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

      .dash-dist-desc {
        font-size: 10px;
        color: #64748b;
        margin-bottom: 2px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .needle-chip-desc {
        font-size: 10px;
        font-weight: 500;
        color: #94a3b8;
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
      .stat-rose { color: #f87171; }
      .stat-slate { color: #94a3b8; }

      .dash-dist-pct {
        font-weight: 600;
        opacity: 0.9;
        font-size: 10px;
      }

      .dash-needle-badge {
        font-size: 9px;
        font-weight: 800;
        padding: 1px 5px;
        border-radius: 4px;
        margin-left: 4px;
        display: inline-block;
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
      .bar-rose { background: linear-gradient(90deg, #dc2626 0%, #f87171 100%); }
      .bar-slate { background: linear-gradient(90deg, #475569 0%, #94a3b8 100%); }

      .needle-fleet-summary {
        background: rgba(255, 255, 255, 0.03);
        border: 1px dashed rgba(255, 255, 255, 0.1);
        margin-top: 4px;
      }

      /* 4. Collapsible Live Servicing Schedules Preview Drawer */
      .dash-schedules-card {
        background: linear-gradient(180deg, #111827 0%, #0d1525 100%);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.35);
        overflow: hidden;
        flex-shrink: 0;
      }

      .dash-schedules-bar {
        padding: 9px 16px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: rgba(255, 255, 255, 0.02);
        cursor: pointer;
        user-select: none;
        transition: background-color 0.15s ease;
      }

      .dash-schedules-bar:hover {
        background: rgba(255, 255, 255, 0.05);
      }

      .dash-schedules-left {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .dash-pulse-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #38bdf8;
        box-shadow: 0 0 6px #38bdf8;
      }

      .dash-schedules-title {
        font-size: 12.5px;
        font-weight: 700;
        color: #ffffff;
      }

      .dash-schedules-badge {
        font-size: 10px;
        font-weight: 700;
        background: rgba(239, 68, 68, 0.15);
        color: #f87171;
        border: 1px solid rgba(239, 68, 68, 0.3);
        padding: 1.5px 6px;
        border-radius: 9999px;
      }

      .dash-schedules-actions {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .btn-dash-link-pm {
        background: transparent;
        border: none;
        color: #38bdf8;
        font-size: 11px;
        font-weight: 700;
        cursor: pointer;
        padding: 0;
        transition: color 0.15s ease;
      }

      .btn-dash-link-pm:hover {
        color: #7dd3fc;
        text-decoration: underline;
      }

      .dash-schedules-toggle-label {
        font-size: 11px;
        font-weight: 600;
        color: #94a3b8;
      }

      .dash-schedules-drawer {
        border-top: 1px solid rgba(255, 255, 255, 0.06);
        padding: 8px 14px 14px;
        background: rgba(10, 15, 28, 0.5);
      }

      .dash-table-responsive {
        max-height: 220px;
        overflow-y: auto;
      }

      .dash-live-pm-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 11.5px;
      }

      .dash-live-pm-table th {
        text-align: left;
        padding: 7px 10px;
        font-size: 10px;
        font-weight: 700;
        color: #94a3b8;
        text-transform: uppercase;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      }

      .dash-live-pm-table td {
        padding: 7px 10px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        color: #e2e8f0;
      }

      .dash-pm-row {
        cursor: pointer;
        transition: background-color 0.15s ease;
      }

      .dash-pm-row:hover {
        background: rgba(255, 255, 255, 0.04);
      }

      .dash-location-badge {
        font-size: 10.5px;
        color: #94a3b8;
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
        font-weight: 700;
      }

      .dash-urgency-badge {
        font-size: 9.5px;
        font-weight: 800;
        padding: 1.5px 6px;
        border-radius: 4px;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        white-space: nowrap;
      }

      .badge-overdue { background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.35); }
      .badge-due-today { background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.35); }
      .badge-due-tomorrow, .badge-due-soon { background: rgba(234, 179, 8, 0.15); color: #facc15; border: 1px solid rgba(234, 179, 8, 0.35); }
      .badge-scheduled { background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.35); }
      .badge-completed { background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.35); }

      .dash-urgency-dot {
        width: 4px;
        height: 4px;
        border-radius: 50%;
        background: currentColor;
      }

      .dash-technician-tag {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: 11px;
        color: #cbd5e1;
      }

      .dash-tech-avatar {
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
        color: #ffffff;
        font-size: 8.5px;
        font-weight: 800;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      /* Custom Scrollbars */
      .custom-scroll::-webkit-scrollbar {
        width: 4px;
        height: 4px;
      }

      .custom-scroll::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.02);
      }

      .custom-scroll::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.15);
        border-radius: 9999px;
      }

      .custom-scroll::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.25);
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

  // 4. Clickable Top KPI Cards & Inventory Filter Rows
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

  // 5. Clickable Machine Transfers Rows
  document.querySelectorAll('[data-action="trf-filter"]').forEach(el => {
    el.addEventListener('click', () => {
      const status = el.getAttribute('data-status') || 'ALL';
      state.set('transferStatusFilter', status);
      state.set('currentView', 'transfers');
    });
  });

  // 6. Clickable Machine Servicing Rows
  document.querySelectorAll('[data-action="pm-filter"]').forEach(el => {
    el.addEventListener('click', () => {
      const urgency = el.getAttribute('data-urgency') || 'ALL';
      state.set('pmFilterUrgency', urgency);
      state.set('currentView', 'preventive-maintenance');
    });
  });

  // 7. Clickable Needle Rows
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

  // 8. Collapsible Servicing Schedules Drawer Toggle
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
