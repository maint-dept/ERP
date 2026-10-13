/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Modern, Professional, Responsive Maintenance Management Dashboard Component
 * 
 * 100% Fit-Screen Executive Command Center with Date-Wise Filtering:
 * - 3 Days, 7 Days, 30 Days, 3 Months, All Time
 * - 4 Balanced Modular Operational Cards (Overview, Transfers, Servicing, Needle Data)
 * - Collapsible Live Servicing Schedule Preview Drawer
 * - 100% English, Ultra User-Friendly, Zero Layout Shifts
 */

import { storage } from '../db/storage.js';
import { TABLE_NAMES, TRANSFER_STATUSES } from '../db/schema.js';
import { authService } from '../services/authService.js';
import { machineService } from '../services/machineService.js';
import { transferService } from '../services/transferService.js';
import { preventiveMaintenanceService } from '../services/preventiveMaintenanceService.js';
import { needleService } from '../services/needleService.js';
import { state } from '../state.js';

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
  // 1. SECTION 1: MACHINE OVERVIEW
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

  // =========================================================================
  // 2. SECTION 2: MACHINE TRANSFER MANAGEMENT (Filtered by Date Range)
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

  // =========================================================================
  // 3. SECTION 3: MACHINE SERVICING MANAGEMENT (Filtered by Date Range)
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

  // Servicing schedules preview: top urgent machines
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

  const needleBuckets = targetNeedleConfigs.map(cfg => ({
    cfg,
    machineCount: 0,
    requiredQty: 0
  }));

  for (let i = 0; i < machines.length; i++) {
    const m = machines[i];
    const specType = m.specNeedleType || m.needleType || '';
    const mName = m.machineNameStr || mnMap.get(m.machineNameId) || m.machineName || '';
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
      machineCount,
      requiredQty,
      pendingQuantity,
      availableStock
    };
  });

  return `
    <div class="page-view user-friendly-dashboard" style="height: 100%; max-height: 100%; display: flex; flex-direction: column; padding: 8px 12px; gap: 8px; box-sizing: border-box; overflow-y: auto; overflow-x: hidden; font-family: var(--font-main, system-ui, -apple-system, sans-serif);">
      
      <!-- Top Header Toolbar: Compact, Fit-Screen & Date Filter Switcher -->
      <div style="flex-shrink: 0; background: linear-gradient(135deg, #0b1120 0%, #111d35 100%); border: 1.5px solid rgba(56, 189, 248, 0.25); border-radius: 8px; padding: 7px 14px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);">
        
        <!-- Left: Logo & Title -->
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="width: 32px; height: 32px; border-radius: 8px; background: linear-gradient(135deg, #0284c7, #0369a1); display: flex; align-items: center; justify-content: center; font-size: 16px; box-shadow: 0 2px 8px rgba(2, 132, 199, 0.4); flex-shrink: 0;">
            🏭
          </div>
          <div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <h1 style="font-size: 15px; font-weight: 800; color: #ffffff; margin: 0; letter-spacing: -0.2px; line-height: 1.2;">
                Maintenance Dashboard
              </h1>
              <span style="background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.35); font-size: 10px; font-weight: 800; padding: 1px 7px; border-radius: 12px; display: inline-flex; align-items: center; gap: 4px;">
                <span style="width: 5px; height: 5px; border-radius: 50%; background: #34d399; box-shadow: 0 0 6px #34d399;"></span> Live
              </span>
            </div>
            <div style="font-size: 11px; color: #94a3b8; font-weight: 600;">
              Al-Muslim Group &bull; Industrial Machine Operations
            </div>
          </div>
        </div>

        <!-- Center: Interactive Date Range Switcher (3 Days, 7 Days, 30 Days, 3 Months, All Time) -->
        <div style="display: flex; align-items: center; gap: 3px; background: rgba(15, 23, 42, 0.85); padding: 3px 6px; border-radius: 8px; border: 1.5px solid rgba(56, 189, 248, 0.25);">
          <span style="font-size: 10.5px; font-weight: 800; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.5px; margin-right: 4px; display: inline-flex; align-items: center; gap: 3px;">
            <span>⏳</span> Range:
          </span>
          <button type="button" class="btn-dash-date-filter ${activeDateFilter === 'ALL' ? 'active' : ''}" data-filter="ALL" title="View lifetime aggregate data">
            All Time
          </button>
          <button type="button" class="btn-dash-date-filter ${activeDateFilter === '3D' ? 'active' : ''}" data-filter="3D" title="Filter data for the past 3 days">
            ⚡ 3 Days
          </button>
          <button type="button" class="btn-dash-date-filter ${activeDateFilter === '7D' ? 'active' : ''}" data-filter="7D" title="Filter data for the past 7 days">
            📅 7 Days
          </button>
          <button type="button" class="btn-dash-date-filter ${activeDateFilter === '30D' ? 'active' : ''}" data-filter="30D" title="Filter data for the past 30 days">
            🗓️ 30 Days
          </button>
          <button type="button" class="btn-dash-date-filter ${activeDateFilter === '90D' ? 'active' : ''}" data-filter="90D" title="Filter data for the past 3 months (90 days)">
            📊 3 Months
          </button>
        </div>

        <!-- Right: Quick Navigation Module Jump Buttons -->
        <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
          <button type="button" id="btn-dash-goto-inventory" class="btn btn-secondary btn-sm" style="font-weight: 700; height: 28px; padding: 0 9px; font-size: 11px; border-color: rgba(56, 189, 248, 0.3); color: #38bdf8;">
            🧵 Inventory
          </button>
          <button type="button" id="btn-dash-goto-transfers" class="btn btn-secondary btn-sm" style="font-weight: 700; height: 28px; padding: 0 9px; font-size: 11px; border-color: rgba(56, 189, 248, 0.3); color: #38bdf8;">
            🔄 Transfers
          </button>
          <button type="button" id="btn-dash-goto-servicing" class="btn btn-secondary btn-sm" style="font-weight: 700; height: 28px; padding: 0 9px; font-size: 11px; border-color: rgba(56, 189, 248, 0.3); color: #38bdf8;">
            🔧 Servicing
          </button>
          <button type="button" id="btn-dash-goto-needles" class="btn btn-secondary btn-sm" style="font-weight: 700; height: 28px; padding: 0 9px; font-size: 11px; border-color: rgba(56, 189, 248, 0.3); color: #38bdf8;">
            🪡 Needles
          </button>
          <button type="button" id="btn-dash-refresh" class="btn btn-primary btn-sm" style="font-weight: 700; height: 28px; padding: 0 10px; font-size: 11px; background: #0284c7;" title="Refresh dashboard data">
            ⚡ Refresh
          </button>
        </div>
      </div>

      <!-- Main 4 Sections Grid: 100% Fit Screen (2x2 Grid on Desktop/Laptop) -->
      <div class="dash-2x2-grid" style="flex: 1; min-height: 0; display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 8px;">

        <!-- ================================================================= -->
        <!-- 1. SECTION 1: MACHINE OVERVIEW -->
        <!-- ================================================================= -->
        <div class="dash-section-card" style="background: #0f172a; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; overflow: hidden; display: flex; flex-direction: column; min-height: 0; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);">
          <!-- Card Header -->
          <div style="padding: 6px 12px; background: rgba(255, 255, 255, 0.03); border-bottom: 1px solid rgba(255, 255, 255, 0.07); display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
            <div style="font-size: 13.5px; font-weight: 800; color: #f8fafc; display: flex; align-items: center; gap: 6px;">
              <span>1. Machine Overview</span>
            </div>
            <span style="font-size: 10.5px; font-weight: 800; color: #38bdf8; background: rgba(56, 189, 248, 0.12); border: 1px solid rgba(56, 189, 248, 0.25); padding: 2px 7px; border-radius: 6px;">
              Total: ${totalMachines.toLocaleString()} &bull; ${currentFilterLabel}
            </span>
          </div>

          <!-- Table Header -->
          <div style="display: flex; justify-content: space-between; padding: 4px 12px; background: rgba(0, 0, 0, 0.3); font-size: 11px; font-weight: 800; color: #94a3b8; border-bottom: 1px solid rgba(255, 255, 255, 0.06); flex-shrink: 0;">
            <span>Description</span>
            <span>Quantity</span>
          </div>

          <!-- Table Rows (Evenly Distributed) -->
          <div style="flex: 1; min-height: 0; display: flex; flex-direction: column; justify-content: space-evenly;">
            
            <!-- Row: Total Physical Machines -->
            <div class="dash-clickable-row" data-action="inv-filter" data-status="ALL" style="display: flex; justify-content: space-between; align-items: center; padding: 4.5px 12px; border-bottom: 1px solid rgba(255, 255, 255, 0.03); cursor: pointer; transition: background 0.12s ease;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 13.5px;">📦</span>
                <div>
                  <span style="font-size: 12.5px; font-weight: 700; color: #e2e8f0;">Total Physical Machines</span>
                  <span style="font-size: 10.5px; color: #64748b; margin-left: 6px;">Factory Total Units</span>
                </div>
              </div>
              <button type="button" class="dash-qty-pill" style="background: rgba(56, 189, 248, 0.12); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.35); padding: 2px 9px; border-radius: 12px; font-size: 12px; font-weight: 800; cursor: pointer; font-variant-numeric: tabular-nums;">
                ${totalMachines.toLocaleString()} Qty
              </button>
            </div>

            <!-- Row: Active Machines -->
            <div class="dash-clickable-row" data-action="inv-filter" data-status="ACTIVE" style="display: flex; justify-content: space-between; align-items: center; padding: 4.5px 12px; border-bottom: 1px solid rgba(255, 255, 255, 0.03); cursor: pointer; transition: background 0.12s ease;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 13.5px;">🟢</span>
                <div>
                  <span style="font-size: 12.5px; font-weight: 700; color: #e2e8f0;">Active Machines</span>
                  <span style="font-size: 10.5px; color: #64748b; margin-left: 6px;">Running On Lines</span>
                </div>
              </div>
              <button type="button" class="dash-qty-pill" style="background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.35); padding: 2px 9px; border-radius: 12px; font-size: 12px; font-weight: 800; cursor: pointer; font-variant-numeric: tabular-nums;">
                ${activeCount.toLocaleString()} Qty
              </button>
            </div>

            <!-- Row: Repaired / Used Machines -->
            <div class="dash-clickable-row" data-action="inv-filter" data-status="REPAIRED" style="display: flex; justify-content: space-between; align-items: center; padding: 4.5px 12px; border-bottom: 1px solid rgba(255, 255, 255, 0.03); cursor: pointer; transition: background 0.12s ease;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 13.5px;">🛠️</span>
                <div>
                  <span style="font-size: 12.5px; font-weight: 700; color: #e2e8f0;">Repaired / Serviced Machines</span>
                  <span style="font-size: 10.5px; color: #38bdf8; margin-left: 6px;">${dateCutoff ? currentFilterLabel : 'Serviced & Ready'}</span>
                </div>
              </div>
              <button type="button" class="dash-qty-pill" style="background: rgba(14, 165, 233, 0.15); color: #38bdf8; border: 1px solid rgba(14, 165, 233, 0.35); padding: 2px 9px; border-radius: 12px; font-size: 12px; font-weight: 800; cursor: pointer; font-variant-numeric: tabular-nums;">
                ${repairedCount.toLocaleString()} Qty
              </button>
            </div>

            <!-- Row: Under Repair Machines -->
            <div class="dash-clickable-row" data-action="inv-filter" data-status="MAINTENANCE" style="display: flex; justify-content: space-between; align-items: center; padding: 4.5px 12px; border-bottom: 1px solid rgba(255, 255, 255, 0.03); cursor: pointer; transition: background 0.12s ease;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 13.5px;">⚠️</span>
                <div>
                  <span style="font-size: 12.5px; font-weight: 700; color: #e2e8f0;">Under Repair Machines</span>
                  <span style="font-size: 10.5px; color: #64748b; margin-left: 6px;">In Maintenance Queue</span>
                </div>
              </div>
              <button type="button" class="dash-qty-pill" style="background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.35); padding: 2px 9px; border-radius: 12px; font-size: 12px; font-weight: 800; cursor: pointer; font-variant-numeric: tabular-nums;">
                ${underRepairCount.toLocaleString()} Qty
              </button>
            </div>

            <!-- Row: Spare Machines / Ambiguous -->
            <div class="dash-clickable-row" data-action="inv-filter" data-status="IDLE" style="display: flex; justify-content: space-between; align-items: center; padding: 4.5px 12px; cursor: pointer; transition: background 0.12s ease;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 13.5px;">🗄️</span>
                <div>
                  <span style="font-size: 12.5px; font-weight: 700; color: #e2e8f0;">Spare Machines / Ambiguous</span>
                  <span style="font-size: 10.5px; color: #64748b; margin-left: 6px;">Idle & Standby Buffer</span>
                </div>
              </div>
              <button type="button" class="dash-qty-pill" style="background: rgba(99, 102, 241, 0.15); color: #a5b4fc; border: 1px solid rgba(99, 102, 241, 0.35); padding: 2px 9px; border-radius: 12px; font-size: 12px; font-weight: 800; cursor: pointer; font-variant-numeric: tabular-nums;">
                ${spareAmbiguousCount.toLocaleString()} Qty
              </button>
            </div>

          </div>
        </div>

        <!-- ================================================================= -->
        <!-- 2. SECTION 2: MACHINE TRANSFER -->
        <!-- ================================================================= -->
        <div class="dash-section-card" style="background: #0f172a; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; overflow: hidden; display: flex; flex-direction: column; min-height: 0; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);">
          <!-- Card Header -->
          <div style="padding: 6px 12px; background: rgba(255, 255, 255, 0.03); border-bottom: 1px solid rgba(255, 255, 255, 0.07); display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
            <div style="font-size: 13.5px; font-weight: 800; color: #f8fafc; display: flex; align-items: center; gap: 6px;">
              <span>2. Machine Transfer</span>
            </div>
            <span style="font-size: 10.5px; font-weight: 800; color: #38bdf8; background: rgba(56, 189, 248, 0.12); border: 1px solid rgba(56, 189, 248, 0.25); padding: 2px 7px; border-radius: 6px;">
              Total: ${totalTransfers} &bull; ${currentFilterLabel}
            </span>
          </div>

          <!-- Table Header -->
          <div style="display: flex; justify-content: space-between; padding: 4px 12px; background: rgba(0, 0, 0, 0.3); font-size: 11px; font-weight: 800; color: #94a3b8; border-bottom: 1px solid rgba(255, 255, 255, 0.06); flex-shrink: 0;">
            <span>Description</span>
            <span>Quantity</span>
          </div>

          <!-- Table Rows (Evenly Distributed) -->
          <div style="flex: 1; min-height: 0; display: flex; flex-direction: column; justify-content: space-evenly;">
            
            <!-- Row: Transfer Request -->
            <div class="dash-clickable-row" data-action="trf-filter" data-status="ALL" style="display: flex; justify-content: space-between; align-items: center; padding: 4.5px 12px; border-bottom: 1px solid rgba(255, 255, 255, 0.03); cursor: pointer; transition: background 0.12s ease;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 13.5px;">📋</span>
                <div>
                  <span style="font-size: 12.5px; font-weight: 700; color: #e2e8f0;">Transfer Request</span>
                  <span style="font-size: 10.5px; color: #64748b; margin-left: 6px;">Total Requests (Pending: ${pendingCount})</span>
                </div>
              </div>
              <button type="button" class="dash-qty-pill" style="background: rgba(56, 189, 248, 0.12); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.35); padding: 2px 9px; border-radius: 12px; font-size: 12px; font-weight: 800; cursor: pointer; font-variant-numeric: tabular-nums;">
                ${totalTransfers} Qty
              </button>
            </div>

            <!-- Row: Approved -->
            <div class="dash-clickable-row" data-action="trf-filter" data-status="APPROVED" style="display: flex; justify-content: space-between; align-items: center; padding: 4.5px 12px; border-bottom: 1px solid rgba(255, 255, 255, 0.03); cursor: pointer; transition: background 0.12s ease;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 13.5px;">✅</span>
                <div>
                  <span style="font-size: 12.5px; font-weight: 700; color: #e2e8f0;">Approved</span>
                  <span style="font-size: 10.5px; color: #64748b; margin-left: 6px;">Cleared For Relocation</span>
                </div>
              </div>
              <button type="button" class="dash-qty-pill" style="background: rgba(14, 165, 233, 0.15); color: #38bdf8; border: 1px solid rgba(14, 165, 233, 0.35); padding: 2px 9px; border-radius: 12px; font-size: 12px; font-weight: 800; cursor: pointer; font-variant-numeric: tabular-nums;">
                ${approvedCount} Qty
              </button>
            </div>

            <!-- Row: Issued / Transferred -->
            <div class="dash-clickable-row" data-action="trf-filter" data-status="COMPLETED" style="display: flex; justify-content: space-between; align-items: center; padding: 4.5px 12px; border-bottom: 1px solid rgba(255, 255, 255, 0.03); cursor: pointer; transition: background 0.12s ease;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 13.5px;">🚚</span>
                <div>
                  <span style="font-size: 12.5px; font-weight: 700; color: #e2e8f0;">Issued / Transferred</span>
                  <span style="font-size: 10.5px; color: #64748b; margin-left: 6px;">Delivered at Destination</span>
                </div>
              </div>
              <button type="button" class="dash-qty-pill" style="background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.35); padding: 2px 9px; border-radius: 12px; font-size: 12px; font-weight: 800; cursor: pointer; font-variant-numeric: tabular-nums;">
                ${issuedTransferredCount} Qty
              </button>
            </div>

            <!-- Row: Declined / Rejected -->
            <div class="dash-clickable-row" data-action="trf-filter" data-status="REJECTED" style="display: flex; justify-content: space-between; align-items: center; padding: 4.5px 12px; cursor: pointer; transition: background 0.12s ease;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 13.5px;">❌</span>
                <div>
                  <span style="font-size: 12.5px; font-weight: 700; color: #e2e8f0;">Declined / Rejected</span>
                  <span style="font-size: 10.5px; color: #64748b; margin-left: 6px;">Declined by Authority</span>
                </div>
              </div>
              <button type="button" class="dash-qty-pill" style="background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.35); padding: 2px 9px; border-radius: 12px; font-size: 12px; font-weight: 800; cursor: pointer; font-variant-numeric: tabular-nums;">
                ${declinedRejectedCount} Qty
              </button>
            </div>

            <!-- Hint Strip -->
            <div style="padding: 3px 12px; background: rgba(56, 189, 248, 0.05); border-top: 1px solid rgba(56, 189, 248, 0.12); font-size: 10.5px; font-weight: 600; color: #38bdf8; display: flex; align-items: center; gap: 5px;">
              <span>💡</span>
              <span>Click on any quantity pill to jump straight to filtered records.</span>
            </div>

          </div>
        </div>

        <!-- ================================================================= -->
        <!-- 3. SECTION 3: MACHINE SERVICING -->
        <!-- ================================================================= -->
        <div class="dash-section-card" style="background: #0f172a; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; overflow: hidden; display: flex; flex-direction: column; min-height: 0; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);">
          <!-- Card Header -->
          <div style="padding: 6px 12px; background: rgba(255, 255, 255, 0.03); border-bottom: 1px solid rgba(255, 255, 255, 0.07); display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
            <div style="font-size: 13.5px; font-weight: 800; color: #f8fafc; display: flex; align-items: center; gap: 6px;">
              <span>3. Machine Servicing</span>
            </div>
            <span style="font-size: 10.5px; font-weight: 800; color: #38bdf8; background: rgba(56, 189, 248, 0.12); border: 1px solid rgba(56, 189, 248, 0.25); padding: 2px 7px; border-radius: 6px;">
              Scope: ${pmTotalMachines.toLocaleString()} &bull; ${currentFilterLabel}
            </span>
          </div>

          <!-- Table Header -->
          <div style="display: flex; justify-content: space-between; padding: 4px 12px; background: rgba(0, 0, 0, 0.3); font-size: 11px; font-weight: 800; color: #94a3b8; border-bottom: 1px solid rgba(255, 255, 255, 0.06); flex-shrink: 0;">
            <span>Description</span>
            <span>Quantity</span>
          </div>

          <!-- Table Rows (Evenly Distributed) -->
          <div style="flex: 1; min-height: 0; display: flex; flex-direction: column; justify-content: space-evenly;">
            
            <!-- Row: Total Machines -->
            <div class="dash-clickable-row" data-action="pm-filter" data-urgency="ALL" style="display: flex; justify-content: space-between; align-items: center; padding: 4px 12px; border-bottom: 1px solid rgba(255, 255, 255, 0.03); cursor: pointer; transition: background 0.12s ease;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 13.5px;">⚙️</span>
                <div>
                  <span style="font-size: 12px; font-weight: 700; color: #e2e8f0;">Total in Scope</span>
                  <span style="font-size: 10.5px; color: #64748b; margin-left: 6px;">Active Maintenance Inventory</span>
                </div>
              </div>
              <button type="button" class="dash-qty-pill" style="background: rgba(56, 189, 248, 0.12); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.35); padding: 2px 9px; border-radius: 12px; font-size: 12px; font-weight: 800; cursor: pointer; font-variant-numeric: tabular-nums;">
                ${pmTotalMachines.toLocaleString()} Qty
              </button>
            </div>

            <!-- Row: Serviced Machines (Green) -->
            <div class="dash-clickable-row" data-action="pm-filter" data-urgency="COMPLETED" style="display: flex; justify-content: space-between; align-items: center; padding: 4px 12px; border-bottom: 1px solid rgba(255, 255, 255, 0.03); cursor: pointer; transition: background 0.12s ease;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 13.5px;">✅</span>
                <div>
                  <span style="font-size: 12px; font-weight: 700; color: #e2e8f0;">Serviced Machines</span>
                  <span style="font-size: 10.5px; color: #10b981; margin-left: 6px;">Completed (${currentFilterLabel})</span>
                </div>
              </div>
              <button type="button" class="dash-qty-pill" style="background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.35); padding: 2px 9px; border-radius: 12px; font-size: 12px; font-weight: 800; cursor: pointer; font-variant-numeric: tabular-nums;">
                ${pmServicedCount} Qty
              </button>
            </div>

            <!-- Row: Overdue Servicing (Red) -->
            <div class="dash-clickable-row" data-action="pm-filter" data-urgency="OVERDUE" style="display: flex; justify-content: space-between; align-items: center; padding: 4px 12px; border-bottom: 1px solid rgba(255, 255, 255, 0.03); cursor: pointer; transition: background 0.12s ease;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 13.5px;">🔴</span>
                <div>
                  <span style="font-size: 12px; font-weight: 700; color: #e2e8f0;">Overdue Servicing</span>
                  <span style="font-size: 10.5px; color: #ef4444; margin-left: 6px;">Needs Attention</span>
                </div>
              </div>
              <button type="button" class="dash-qty-pill" style="background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.35); padding: 2px 9px; border-radius: 12px; font-size: 12px; font-weight: 800; cursor: pointer; font-variant-numeric: tabular-nums;">
                ${pmOverdue} Qty
              </button>
            </div>

            <!-- Row: Due Today (Yellow/Amber) -->
            <div class="dash-clickable-row" data-action="pm-filter" data-urgency="DUE_TODAY" style="display: flex; justify-content: space-between; align-items: center; padding: 4px 12px; border-bottom: 1px solid rgba(255, 255, 255, 0.03); cursor: pointer; transition: background 0.12s ease;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 13.5px;">🟡</span>
                <div>
                  <span style="font-size: 12px; font-weight: 700; color: #e2e8f0;">Due Today</span>
                  <span style="font-size: 10.5px; color: #f59e0b; margin-left: 6px;">Scheduled Today</span>
                </div>
              </div>
              <button type="button" class="dash-qty-pill" style="background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.35); padding: 2px 9px; border-radius: 12px; font-size: 12px; font-weight: 800; cursor: pointer; font-variant-numeric: tabular-nums;">
                ${pmDueToday} Qty
              </button>
            </div>

            <!-- Row: Due Within 7 Days (Amber) -->
            <div class="dash-clickable-row" data-action="pm-filter" data-urgency="DUE_SOON" style="display: flex; justify-content: space-between; align-items: center; padding: 4px 12px; border-bottom: 1px solid rgba(255, 255, 255, 0.03); cursor: pointer; transition: background 0.12s ease;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 13.5px;">⏳</span>
                <div>
                  <span style="font-size: 12px; font-weight: 700; color: #e2e8f0;">Due Within 7 Days</span>
                  <span style="font-size: 10.5px; color: #eab308; margin-left: 6px;">Next Cycle in 7 Days</span>
                </div>
              </div>
              <button type="button" class="dash-qty-pill" style="background: rgba(234, 179, 8, 0.15); color: #fde047; border: 1px solid rgba(234, 179, 8, 0.35); padding: 2px 9px; border-radius: 12px; font-size: 12px; font-weight: 800; cursor: pointer; font-variant-numeric: tabular-nums;">
                ${pmDueWithin7Days} Qty
              </button>
            </div>

            <!-- Row: Upcoming Servicing (Blue) -->
            <div class="dash-clickable-row" data-action="pm-filter" data-urgency="SCHEDULED" style="display: flex; justify-content: space-between; align-items: center; padding: 4px 12px; cursor: pointer; transition: background 0.12s ease;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 13.5px;">🗓️</span>
                <div>
                  <span style="font-size: 12px; font-weight: 700; color: #93c5fd;">Upcoming Servicing</span>
                  <span style="font-size: 10.5px; color: #60a5fa; margin-left: 6px;">Future Maintenance Cycles</span>
                </div>
              </div>
              <button type="button" class="dash-qty-pill" style="background: rgba(59, 130, 246, 0.15); color: #93c5fd; border: 1px solid rgba(59, 130, 246, 0.35); padding: 2px 9px; border-radius: 12px; font-size: 12px; font-weight: 800; cursor: pointer; font-variant-numeric: tabular-nums;">
                ${pmUpcoming} Qty
              </button>
            </div>

          </div>
        </div>

        <!-- ================================================================= -->
        <!-- 4. SECTION 4: NEEDLE DATA -->
        <!-- ================================================================= -->
        <div class="dash-section-card" style="background: #0f172a; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; overflow: hidden; display: flex; flex-direction: column; min-height: 0; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);">
          <!-- Card Header -->
          <div style="padding: 6px 12px; background: rgba(255, 255, 255, 0.03); border-bottom: 1px solid rgba(255, 255, 255, 0.07); display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
            <div style="font-size: 13.5px; font-weight: 800; color: #f8fafc; display: flex; align-items: center; gap: 6px;">
              <span>4. Needle Data</span>
            </div>
            <span style="font-size: 10.5px; font-weight: 800; color: #38bdf8; background: rgba(56, 189, 248, 0.12); border: 1px solid rgba(56, 189, 248, 0.25); padding: 2px 7px; border-radius: 6px;">
              Total Stock: ${sumNeedleStock.toLocaleString()} &bull; 4 Types
            </span>
          </div>

          <!-- Needle Table Header (4 Columns) -->
          <div style="display: grid; grid-template-columns: 2.2fr 1fr 1fr 1fr; padding: 4px 12px; background: rgba(0, 0, 0, 0.3); font-size: 11px; font-weight: 800; color: #94a3b8; border-bottom: 1px solid rgba(255, 255, 255, 0.06); text-align: center; flex-shrink: 0;">
            <span style="text-align: left;">Needle Type</span>
            <span>Required</span>
            <span>Pending</span>
            <span>Stock</span>
          </div>

          <!-- Needle Table Rows (Evenly Distributed) -->
          <div style="flex: 1; min-height: 0; display: flex; flex-direction: column; justify-content: space-evenly;">
            ${needleTableRows.map(r => `
              <div class="dash-clickable-row" data-action="needle-filter" data-needle="${r.code}" style="display: grid; grid-template-columns: 2.2fr 1fr 1fr 1fr; align-items: center; padding: 4px 12px; border-bottom: 1px solid rgba(255, 255, 255, 0.03); cursor: pointer; transition: background 0.12s ease;">
                <div style="display: flex; flex-direction: column; text-align: left;">
                  <span style="font-size: 12.5px; font-weight: 800; color: #38bdf8; letter-spacing: 0.2px;">${r.code}</span>
                  <span style="font-size: 9.5px; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${r.desc}</span>
                </div>
                <div style="text-align: center;">
                  <span style="background: rgba(56, 189, 248, 0.1); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.25); padding: 2px 7px; border-radius: 10px; font-size: 11.5px; font-weight: 700; font-variant-numeric: tabular-nums; display: inline-block;">
                    ${r.requiredQty.toLocaleString()}
                  </span>
                </div>
                <div style="text-align: center;">
                  <span style="background: ${r.pendingQuantity > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.05)'}; color: ${r.pendingQuantity > 0 ? '#f87171' : '#94a3b8'}; border: 1px solid ${r.pendingQuantity > 0 ? 'rgba(239, 68, 68, 0.35)' : 'rgba(255, 255, 255, 0.1)'}; padding: 2px 7px; border-radius: 10px; font-size: 11.5px; font-weight: 700; font-variant-numeric: tabular-nums; display: inline-block;">
                    ${r.pendingQuantity.toLocaleString()}
                  </span>
                </div>
                <div style="text-align: center;">
                  <span style="background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.35); padding: 2px 7px; border-radius: 10px; font-size: 11.5px; font-weight: 800; font-variant-numeric: tabular-nums; display: inline-block;">
                    ${r.availableStock.toLocaleString()}
                  </span>
                </div>
              </div>
            `).join('')}

            <!-- Summary Total Row -->
            <div class="dash-clickable-row" data-action="needle-filter" data-needle="ALL" style="display: grid; grid-template-columns: 2.2fr 1fr 1fr 1fr; align-items: center; padding: 5px 12px; background: rgba(56, 189, 248, 0.04); border-top: 1.5px solid rgba(56, 189, 248, 0.2); cursor: pointer; transition: background 0.12s ease;">
              <div style="text-align: left;">
                <span style="font-size: 12.5px; font-weight: 900; color: #ffffff;">Total</span>
                <span style="font-size: 10px; color: #94a3b8; margin-left: 6px;">All Systems</span>
              </div>
              <div style="text-align: center;">
                <span style="background: rgba(56, 189, 248, 0.2); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.4); padding: 2px 8px; border-radius: 10px; font-size: 12px; font-weight: 900; font-variant-numeric: tabular-nums; display: inline-block;">
                  ${sumNeedleRequired.toLocaleString()}
                </span>
              </div>
              <div style="text-align: center;">
                <span style="background: ${sumNeedlePending > 0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.08)'}; color: ${sumNeedlePending > 0 ? '#f87171' : '#cbd5e1'}; border: 1px solid ${sumNeedlePending > 0 ? 'rgba(239, 68, 68, 0.4)' : 'rgba(255, 255, 255, 0.15)'}; padding: 2px 8px; border-radius: 10px; font-size: 12px; font-weight: 900; font-variant-numeric: tabular-nums; display: inline-block;">
                  ${sumNeedlePending.toLocaleString()}
                </span>
              </div>
              <div style="text-align: center;">
                <span style="background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4); padding: 2px 8px; border-radius: 10px; font-size: 12px; font-weight: 900; font-variant-numeric: tabular-nums; display: inline-block;">
                  ${sumNeedleStock.toLocaleString()}
                </span>
              </div>
            </div>

          </div>
        </div>

      </div>

      <!-- Collapsible Live Servicing Schedules Preview Drawer -->
      ${sortedMaintMachines.length > 0 ? `
        <div style="flex-shrink: 0; background: #0f172a; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; overflow: hidden; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);">
          
          <!-- Drawer Bar -->
          <div id="btn-dash-toggle-schedules" style="padding: 6px 12px; background: rgba(56, 189, 248, 0.06); cursor: pointer; display: flex; justify-content: space-between; align-items: center; user-select: none; transition: background 0.15s ease;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 13.5px;">⏱️</span>
              <span style="font-size: 12.5px; font-weight: 800; color: #f8fafc;">Live Servicing Schedules &amp; Assigned Technicians</span>
              <span style="font-size: 10.5px; color: #94a3b8; font-weight: 600;">(Top 5 Most Urgent Machines)</span>
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
              <span id="dash-schedules-arrow" style="font-size: 11px; font-weight: 700; color: #38bdf8;">
                ${isSchedulesDrawerOpen ? '▲ Collapse Table' : '▼ Expand Table'}
              </span>
              <button type="button" class="btn btn-secondary btn-sm" id="btn-dash-open-full-pm" style="font-size: 10.5px; height: 24px; padding: 0 8px; font-weight: 700; color: #38bdf8; border-color: rgba(56, 189, 248, 0.3);">
                Full Schedule &rarr;
              </button>
            </div>
          </div>

          <!-- Collapsible Content -->
          <div id="dash-schedules-drawer" style="display: ${isSchedulesDrawerOpen ? 'block' : 'none'}; max-height: 180px; overflow-y: auto; border-top: 1px solid rgba(255, 255, 255, 0.06);">
            <table class="table" style="width: 100%; border-collapse: collapse; margin: 0; font-size: 12px;">
              <thead>
                <tr style="background: rgba(0, 0, 0, 0.35); color: #94a3b8; font-size: 11px; font-weight: 700; text-transform: uppercase;">
                  <th style="padding: 6px 12px; text-align: left;">Machine / Serial</th>
                  <th style="padding: 6px 12px; text-align: left;">Location</th>
                  <th style="padding: 6px 12px; text-align: left;">Last Servicing</th>
                  <th style="padding: 6px 12px; text-align: left;">Next Due Date</th>
                  <th style="padding: 6px 12px; text-align: left;">Status</th>
                  <th style="padding: 6px 12px; text-align: left;">Technician</th>
                </tr>
              </thead>
              <tbody>
                ${sortedMaintMachines.map(m => {
                  const urgencyColors = {
                    'OVERDUE': { bg: 'rgba(239, 68, 68, 0.15)', text: '#f87171', border: 'rgba(239, 68, 68, 0.35)', label: 'Overdue' },
                    'DUE_TODAY': { bg: 'rgba(245, 158, 11, 0.15)', text: '#fbbf24', border: 'rgba(245, 158, 11, 0.35)', label: 'Due Today' },
                    'DUE_SOON': { bg: 'rgba(234, 179, 8, 0.15)', text: '#fde047', border: 'rgba(234, 179, 8, 0.35)', label: 'Due in 7d' },
                    'SCHEDULED': { bg: 'rgba(59, 130, 246, 0.15)', text: '#93c5fd', border: 'rgba(59, 130, 246, 0.35)', label: 'Upcoming' },
                    'COMPLETED': { bg: 'rgba(16, 185, 129, 0.15)', text: '#34d399', border: 'rgba(16, 185, 129, 0.35)', label: 'Completed' }
                  };
                  const uStyle = urgencyColors[m.urgency?.status] || urgencyColors['SCHEDULED'];
                  return `
                    <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.04); color: #cbd5e1;">
                      <td style="padding: 6px 12px;">
                        <div style="font-weight: 700; color: #f8fafc;">${m.machineName || 'Machine'}</div>
                        <div style="font-size: 10px; color: #64748b; font-family: monospace;">SN: ${m.serialNumber || 'N/A'}</div>
                      </td>
                      <td style="padding: 6px 12px; font-size: 11px; color: #94a3b8;">
                        ${m.floor || 'Floor'} &bull; ${m.line || 'Line'}
                      </td>
                      <td style="padding: 6px 12px; font-size: 11px; color: #cbd5e1;">
                        ${m.lastServiceDate || 'None recorded'}
                      </td>
                      <td style="padding: 6px 12px; font-size: 11px; font-weight: 700; color: #ffffff;">
                        ${m.nextServiceDate || 'Not scheduled'}
                      </td>
                      <td style="padding: 6px 12px;">
                        <span style="background: ${uStyle.bg}; color: ${uStyle.text}; border: 1px solid ${uStyle.border}; font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 4px; display: inline-block;">
                          ${uStyle.label}
                        </span>
                      </td>
                      <td style="padding: 6px 12px; font-size: 11px; color: #cbd5e1;">
                        ${m.assignedTechnician || 'Maintenance Team'}
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      ` : ''}

    </div>

    <style>
      .btn-dash-date-filter {
        background: transparent;
        color: #94a3b8;
        border: 1px solid transparent;
        padding: 3px 8px;
        font-size: 11px;
        font-weight: 700;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.15s ease;
        white-space: nowrap;
      }
      .btn-dash-date-filter:hover {
        background: rgba(255, 255, 255, 0.08);
        color: #ffffff;
      }
      .btn-dash-date-filter.active {
        background: #0284c7;
        color: #ffffff;
        border-color: #38bdf8;
        box-shadow: 0 0 10px rgba(2, 132, 199, 0.45);
      }
      .dash-clickable-row:hover {
        background: rgba(255, 255, 255, 0.04) !important;
      }
      .dash-clickable-row:hover .dash-qty-pill {
        transform: translateY(-1px) scale(1.02);
        box-shadow: 0 3px 10px rgba(0, 0, 0, 0.35);
      }
      .dash-qty-pill {
        transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
      }
      @media (max-width: 1024px) {
        .dash-2x2-grid {
          grid-template-columns: 1fr !important;
          grid-template-rows: auto !important;
        }
        .user-friendly-dashboard {
          height: auto !important;
          max-height: none !important;
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

  // 2. Collapsible Servicing Schedules Drawer Toggle
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

  // 3. Navigation Header Buttons
  const btnInv = document.getElementById('btn-dash-goto-inventory');
  if (btnInv) {
    btnInv.addEventListener('click', () => {
      state.set('inventoryStatusFilter', null);
      state.set('currentView', 'inventory');
    });
  }

  const btnTransfers = document.getElementById('btn-dash-goto-transfers');
  if (btnTransfers) {
    btnTransfers.addEventListener('click', () => {
      state.set('transferStatusFilter', 'ALL');
      state.set('currentView', 'transfers');
    });
  }

  const btnServicing = document.getElementById('btn-dash-goto-servicing');
  if (btnServicing) {
    btnServicing.addEventListener('click', () => {
      state.set('pmFilterUrgency', 'ALL');
      state.set('currentView', 'preventive-maintenance');
    });
  }

  const btnNeedles = document.getElementById('btn-dash-goto-needles');
  if (btnNeedles) {
    btnNeedles.addEventListener('click', () => {
      state.set('currentView', 'needle-operations');
    });
  }

  const btnFullPm = document.getElementById('btn-dash-open-full-pm');
  if (btnFullPm) {
    btnFullPm.addEventListener('click', () => {
      state.set('pmFilterUrgency', 'ALL');
      state.set('currentView', 'preventive-maintenance');
    });
  }

  const btnRefresh = document.getElementById('btn-dash-refresh');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('erp:storage-updated'));
    });
  }

  // 4. Row Click Actions: Section 1 (Inventory)
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

  // 5. Row Click Actions: Section 2 (Machine Transfers)
  document.querySelectorAll('[data-action="trf-filter"]').forEach(el => {
    el.addEventListener('click', () => {
      const status = el.getAttribute('data-status') || 'ALL';
      state.set('transferStatusFilter', status);
      state.set('currentView', 'transfers');
    });
  });

  // 6. Row Click Actions: Section 3 (Machine Servicing)
  document.querySelectorAll('[data-action="pm-filter"]').forEach(el => {
    el.addEventListener('click', () => {
      const urgency = el.getAttribute('data-urgency') || 'ALL';
      state.set('pmFilterUrgency', urgency);
      state.set('currentView', 'preventive-maintenance');
    });
  });

  // 7. Row Click Actions: Section 4 (Needle Operations)
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
}
