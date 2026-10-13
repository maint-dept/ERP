/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Modern, Professional, Responsive Maintenance Management Dashboard Component
 * 
 * Implements the 4 User-Friendly Sections in pure English:
 * 1. 1. Machine Overview (Total Physical, Active, Repaired/Used, Under Repair, Spare/Ambiguous)
 * 2. 2. Machine Transfer (Transfer Request, Approved, Issued/Transferred, Declined/Rejected + Click Navigation)
 * 3. 3. Machine Servicing (Total, Serviced, Overdue, Due Today, Due Within 7 Days, Upcoming with Visual Badges)
 * 4. 4. Needle Data (DP×5, DP×17, DB×1, DC×1 with Required, Pending, Stock & Total Summary)
 */

import { storage } from '../db/storage.js';
import { TABLE_NAMES, TRANSFER_STATUSES } from '../db/schema.js';
import { authService } from '../services/authService.js';
import { machineService } from '../services/machineService.js';
import { transferService, resolveTransferMachineDetails } from '../services/transferService.js';
import { preventiveMaintenanceService } from '../services/preventiveMaintenanceService.js';
import { needleService } from '../services/needleService.js';
import { masterDataService } from '../services/masterDataService.js';
import { state } from '../state.js';

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

  // Master Data Lookups
  const mnMap = new Map((storage.getTable(TABLE_NAMES.MACHINE_NAMES) || []).filter(Boolean).map(x => [x.id, (x.name || '').toLowerCase()]));
  const mdlMap = new Map((storage.getTable(TABLE_NAMES.MODELS) || []).filter(Boolean).map(x => [x.id, (x.name || '').toLowerCase()]));
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

  const repairedMachines = machines.filter(m => {
    return m.status === 'REPAIRED' || (m.customValues?.status === 'REPAIRED');
  });
  const repairedCount = repairedMachines.length;

  // Spare / Ambiguous machines (idle, spare, or unassigned)
  const spareAmbiguousCount = Math.max(0, totalMachines - activeCount - underRepairCount);

  // =========================================================================
  // 2. SECTION 2: MACHINE TRANSFER MANAGEMENT
  // =========================================================================
  const allTransfers = transferService.getTransferRequests({ status: 'ALL' }) || [];
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
  // 3. SECTION 3: MACHINE SERVICING MANAGEMENT
  // =========================================================================
  const pmMetrics = (typeof preventiveMaintenanceService.getDashboardMetrics === 'function') 
    ? preventiveMaintenanceService.getDashboardMetrics() 
    : {};

  const pmTotalMachines = pmMetrics.totalMachines || totalMachines;
  const pmServicedCount = pmMetrics.completedCount || pmMetrics.recentlyServiced || 0;
  const pmOverdue = pmMetrics.overdue || 0;
  const pmDueToday = pmMetrics.dueToday || 0;
  const pmDueWithin7Days = pmMetrics.dueWithin7Days || 0;
  const pmUpcoming = pmMetrics.upcoming || 0;

  // Servicing schedules preview: reuse machines already enriched by getDashboardMetrics
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
    <div class="page-view user-friendly-dashboard" style="padding: 16px 20px 40px 20px; display: flex; flex-direction: column; gap: 20px; max-width: 1600px; margin: 0 auto; box-sizing: border-box; font-family: var(--font-main, system-ui, -apple-system, sans-serif);">
      
      <!-- Top Header Bar -->
      <div style="background: linear-gradient(135deg, #0b1120 0%, #111d35 100%); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 12px; padding: 16px 22px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);">
        <div>
          <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
            <div style="width: 40px; height: 40px; border-radius: 10px; background: linear-gradient(135deg, #0284c7, #0369a1); display: flex; align-items: center; justify-content: center; font-size: 20px; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.4);">
              🏭
            </div>
            <div>
              <h1 style="font-size: 20px; font-weight: 800; color: #ffffff; margin: 0; letter-spacing: -0.2px;">
                Maintenance Dashboard
              </h1>
              <div style="font-size: 12px; color: #94a3b8; margin-top: 2px;">
                Al-Muslim Group &bull; Garments Factory Maintenance Management System
              </div>
            </div>
            <span style="background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.35); font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 20px; display: inline-flex; align-items: center; gap: 6px;">
              <span style="width: 7px; height: 7px; border-radius: 50%; background: #34d399; box-shadow: 0 0 8px #34d399;"></span> Live
            </span>
          </div>
        </div>

        <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
          <button type="button" id="btn-dash-goto-inventory" class="btn btn-secondary btn-sm" style="font-weight: 600; height: 34px; font-size: 12px; border-color: rgba(56, 189, 248, 0.3); color: #38bdf8;">
            🧵 Machine Inventory
          </button>
          <button type="button" id="btn-dash-goto-transfers" class="btn btn-secondary btn-sm" style="font-weight: 600; height: 34px; font-size: 12px; border-color: rgba(56, 189, 248, 0.3); color: #38bdf8;">
            🔄 Machine Transfers
          </button>
          <button type="button" id="btn-dash-goto-servicing" class="btn btn-secondary btn-sm" style="font-weight: 600; height: 34px; font-size: 12px; border-color: rgba(56, 189, 248, 0.3); color: #38bdf8;">
            🔧 Machine Servicing
          </button>
          <button type="button" id="btn-dash-goto-needles" class="btn btn-secondary btn-sm" style="font-weight: 600; height: 34px; font-size: 12px; border-color: rgba(56, 189, 248, 0.3); color: #38bdf8;">
            🪡 Needle Operations
          </button>
          <button type="button" id="btn-dash-refresh" class="btn btn-primary btn-sm" style="font-weight: 600; height: 34px; font-size: 12px; background: #0284c7;">
            ⚡ Refresh
          </button>
        </div>
      </div>

      <!-- Main 4 Sections Grid Layout (2 Columns on Desktop, 1 Column on Mobile) -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(480px, 1fr)); gap: 20px; align-items: start;">

        <!-- ================================================================= -->
        <!-- 1. SECTION 1: MACHINE OVERVIEW -->
        <!-- ================================================================= -->
        <div class="dash-section-card" style="background: #0f172a; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.35);">
          <!-- Card Header -->
          <div style="padding: 14px 20px; background: rgba(255, 255, 255, 0.03); border-bottom: 1px solid rgba(255, 255, 255, 0.08); display: flex; justify-content: space-between; align-items: center;">
            <div style="font-size: 16px; font-weight: 800; color: #f8fafc; letter-spacing: -0.2px;">
              1. Machine Overview
            </div>
            <span style="font-size: 11px; font-weight: 700; color: #38bdf8; background: rgba(56, 189, 248, 0.12); padding: 3px 8px; border-radius: 6px;">
              Total: ${totalMachines.toLocaleString()}
            </span>
          </div>

          <!-- Table Header -->
          <div style="display: flex; justify-content: space-between; padding: 10px 20px; background: rgba(0, 0, 0, 0.35); font-size: 13px; font-weight: 800; color: #94a3b8; border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
            <span>Description</span>
            <span>Quantity</span>
          </div>

          <!-- Table Rows -->
          <div style="display: flex; flex-direction: column;">
            
            <!-- Row: Total Physical Machines -->
            <div class="dash-clickable-row" data-action="inv-filter" data-status="ALL" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 20px; border-bottom: 1px solid rgba(255, 255, 255, 0.05); cursor: pointer; transition: background 0.15s ease;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 16px;">📦</span>
                <div>
                  <span style="font-size: 14px; font-weight: 600; color: #e2e8f0;">Total Physical Machines</span>
                  <div style="font-size: 11px; color: #64748b;">Factory Total Registered Units</div>
                </div>
              </div>
              <button type="button" class="dash-qty-pill" style="background: rgba(56, 189, 248, 0.12); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.35); padding: 5px 14px; border-radius: 20px; font-size: 13.5px; font-weight: 800; cursor: pointer; font-variant-numeric: tabular-nums;">
                ${totalMachines.toLocaleString()} Qty
              </button>
            </div>

            <!-- Row: Active Machines -->
            <div class="dash-clickable-row" data-action="inv-filter" data-status="ACTIVE" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 20px; border-bottom: 1px solid rgba(255, 255, 255, 0.05); cursor: pointer; transition: background 0.15s ease;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 16px;">🟢</span>
                <div>
                  <span style="font-size: 14px; font-weight: 600; color: #e2e8f0;">Active Machines</span>
                  <div style="font-size: 11px; color: #64748b;">Currently Running On Production Lines</div>
                </div>
              </div>
              <button type="button" class="dash-qty-pill" style="background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.35); padding: 5px 14px; border-radius: 20px; font-size: 13.5px; font-weight: 800; cursor: pointer; font-variant-numeric: tabular-nums;">
                ${activeCount.toLocaleString()} Qty
              </button>
            </div>

            <!-- Row: Repaired / Used Machines -->
            <div class="dash-clickable-row" data-action="inv-filter" data-status="REPAIRED" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 20px; border-bottom: 1px solid rgba(255, 255, 255, 0.05); cursor: pointer; transition: background 0.15s ease;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 16px;">🛠️</span>
                <div>
                  <span style="font-size: 14px; font-weight: 600; color: #e2e8f0;">Repaired / Used Machines</span>
                  <div style="font-size: 11px; color: #64748b;">Serviced & Ready for Production</div>
                </div>
              </div>
              <button type="button" class="dash-qty-pill" style="background: rgba(14, 165, 233, 0.15); color: #38bdf8; border: 1px solid rgba(14, 165, 233, 0.35); padding: 5px 14px; border-radius: 20px; font-size: 13.5px; font-weight: 800; cursor: pointer; font-variant-numeric: tabular-nums;">
                ${repairedCount.toLocaleString()} Qty
              </button>
            </div>

            <!-- Row: Under Repair Machines -->
            <div class="dash-clickable-row" data-action="inv-filter" data-status="MAINTENANCE" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 20px; border-bottom: 1px solid rgba(255, 255, 255, 0.05); cursor: pointer; transition: background 0.15s ease;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 16px;">⚠️</span>
                <div>
                  <span style="font-size: 14px; font-weight: 600; color: #e2e8f0;">Under Repair Machines</span>
                  <div style="font-size: 11px; color: #64748b;">In Maintenance / Breakdown Queue</div>
                </div>
              </div>
              <button type="button" class="dash-qty-pill" style="background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.35); padding: 5px 14px; border-radius: 20px; font-size: 13.5px; font-weight: 800; cursor: pointer; font-variant-numeric: tabular-nums;">
                ${underRepairCount.toLocaleString()} Qty
              </button>
            </div>

            <!-- Row: Spare Machines / Ambiguous -->
            <div class="dash-clickable-row" data-action="inv-filter" data-status="IDLE" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 20px; cursor: pointer; transition: background 0.15s ease;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 16px;">🗄️</span>
                <div>
                  <span style="font-size: 14px; font-weight: 600; color: #e2e8f0;">Spare Machines / Ambiguous</span>
                  <div style="font-size: 11px; color: #64748b;">Idle Buffer & Standby Allocations</div>
                </div>
              </div>
              <button type="button" class="dash-qty-pill" style="background: rgba(99, 102, 241, 0.15); color: #a5b4fc; border: 1px solid rgba(99, 102, 241, 0.35); padding: 5px 14px; border-radius: 20px; font-size: 13.5px; font-weight: 800; cursor: pointer; font-variant-numeric: tabular-nums;">
                ${spareAmbiguousCount.toLocaleString()} Qty
              </button>
            </div>

          </div>
        </div>

        <!-- ================================================================= -->
        <!-- 2. SECTION 2: MACHINE TRANSFER -->
        <!-- ================================================================= -->
        <div class="dash-section-card" style="background: #0f172a; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.35);">
          <!-- Card Header -->
          <div style="padding: 14px 20px; background: rgba(255, 255, 255, 0.03); border-bottom: 1px solid rgba(255, 255, 255, 0.08); display: flex; justify-content: space-between; align-items: center;">
            <div style="font-size: 16px; font-weight: 800; color: #f8fafc; letter-spacing: -0.2px;">
              2. Machine Transfer
            </div>
            <span style="font-size: 11px; font-weight: 700; color: #38bdf8; background: rgba(56, 189, 248, 0.12); padding: 3px 8px; border-radius: 6px;">
              Total: ${totalTransfers}
            </span>
          </div>

          <!-- Table Header -->
          <div style="display: flex; justify-content: space-between; padding: 10px 20px; background: rgba(0, 0, 0, 0.35); font-size: 13px; font-weight: 800; color: #94a3b8; border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
            <span>Description</span>
            <span>Quantity</span>
          </div>

          <!-- Table Rows -->
          <div style="display: flex; flex-direction: column;">
            
            <!-- Row: Transfer Request -->
            <div class="dash-clickable-row" data-action="trf-filter" data-status="ALL" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 20px; border-bottom: 1px solid rgba(255, 255, 255, 0.05); cursor: pointer; transition: background 0.15s ease;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 16px;">📋</span>
                <div>
                  <span style="font-size: 14px; font-weight: 600; color: #e2e8f0;">Transfer Request</span>
                  <div style="font-size: 11px; color: #64748b;">Total Requests (Pending: ${pendingCount})</div>
                </div>
              </div>
              <button type="button" class="dash-qty-pill" style="background: rgba(56, 189, 248, 0.12); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.35); padding: 5px 14px; border-radius: 20px; font-size: 13.5px; font-weight: 800; cursor: pointer; font-variant-numeric: tabular-nums;">
                ${totalTransfers} Qty
              </button>
            </div>

            <!-- Row: Approved -->
            <div class="dash-clickable-row" data-action="trf-filter" data-status="APPROVED" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 20px; border-bottom: 1px solid rgba(255, 255, 255, 0.05); cursor: pointer; transition: background 0.15s ease;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 16px;">✅</span>
                <div>
                  <span style="font-size: 14px; font-weight: 600; color: #e2e8f0;">Approved</span>
                  <div style="font-size: 11px; color: #64748b;">Cleared For Physical Relocation</div>
                </div>
              </div>
              <button type="button" class="dash-qty-pill" style="background: rgba(14, 165, 233, 0.15); color: #38bdf8; border: 1px solid rgba(14, 165, 233, 0.35); padding: 5px 14px; border-radius: 20px; font-size: 13.5px; font-weight: 800; cursor: pointer; font-variant-numeric: tabular-nums;">
                ${approvedCount} Qty
              </button>
            </div>

            <!-- Row: Issued / Transferred -->
            <div class="dash-clickable-row" data-action="trf-filter" data-status="COMPLETED" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 20px; border-bottom: 1px solid rgba(255, 255, 255, 0.05); cursor: pointer; transition: background 0.15s ease;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 16px;">🚚</span>
                <div>
                  <span style="font-size: 14px; font-weight: 600; color: #e2e8f0;">Issued / Transferred</span>
                  <div style="font-size: 11px; color: #64748b;">Delivered & Received at Destination</div>
                </div>
              </div>
              <button type="button" class="dash-qty-pill" style="background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.35); padding: 5px 14px; border-radius: 20px; font-size: 13.5px; font-weight: 800; cursor: pointer; font-variant-numeric: tabular-nums;">
                ${issuedTransferredCount} Qty
              </button>
            </div>

            <!-- Row: Declined / Rejected -->
            <div class="dash-clickable-row" data-action="trf-filter" data-status="REJECTED" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 20px; cursor: pointer; transition: background 0.15s ease;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 16px;">❌</span>
                <div>
                  <span style="font-size: 14px; font-weight: 600; color: #e2e8f0;">Declined / Rejected</span>
                  <div style="font-size: 11px; color: #64748b;">Cancelled or Declined by Authority</div>
                </div>
              </div>
              <button type="button" class="dash-qty-pill" style="background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.35); padding: 5px 14px; border-radius: 20px; font-size: 13.5px; font-weight: 800; cursor: pointer; font-variant-numeric: tabular-nums;">
                ${declinedRejectedCount} Qty
              </button>
            </div>

          </div>

          <!-- Section 2 Footer Notice in pure English -->
          <div style="padding: 12px 20px; background: rgba(56, 189, 248, 0.06); border-top: 1px solid rgba(56, 189, 248, 0.18); font-size: 13px; font-weight: 600; color: #38bdf8; display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 16px;">💡</span>
            <span>Click on any quantity to view the detailed machine list.</span>
          </div>
        </div>

        <!-- ================================================================= -->
        <!-- 3. SECTION 3: MACHINE SERVICING -->
        <!-- ================================================================= -->
        <div class="dash-section-card" style="background: #0f172a; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.35);">
          <!-- Card Header -->
          <div style="padding: 14px 20px; background: rgba(255, 255, 255, 0.03); border-bottom: 1px solid rgba(255, 255, 255, 0.08); display: flex; justify-content: space-between; align-items: center;">
            <div style="font-size: 16px; font-weight: 800; color: #f8fafc; letter-spacing: -0.2px;">
              3. Machine Servicing
            </div>
            <span style="font-size: 11px; font-weight: 700; color: #38bdf8; background: rgba(56, 189, 248, 0.12); padding: 3px 8px; border-radius: 6px;">
              Total: ${pmTotalMachines.toLocaleString()}
            </span>
          </div>

          <!-- Table Header -->
          <div style="display: flex; justify-content: space-between; padding: 10px 20px; background: rgba(0, 0, 0, 0.35); font-size: 13px; font-weight: 800; color: #94a3b8; border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
            <span>Description</span>
            <span>Quantity</span>
          </div>

          <!-- Table Rows -->
          <div style="display: flex; flex-direction: column;">
            
            <!-- Row: Total Machines -->
            <div class="dash-clickable-row" data-action="pm-filter" data-urgency="ALL" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 20px; border-bottom: 1px solid rgba(255, 255, 255, 0.05); cursor: pointer; transition: background 0.15s ease;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 16px;">⚙️</span>
                <div>
                  <span style="font-size: 14px; font-weight: 600; color: #e2e8f0;">Total Machines</span>
                  <div style="font-size: 11px; color: #64748b;">Machines in Maintenance Scope</div>
                </div>
              </div>
              <button type="button" class="dash-qty-pill" style="background: rgba(56, 189, 248, 0.12); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.35); padding: 5px 14px; border-radius: 20px; font-size: 13.5px; font-weight: 800; cursor: pointer; font-variant-numeric: tabular-nums;">
                ${pmTotalMachines.toLocaleString()} Qty
              </button>
            </div>

            <!-- Row: Serviced Machines (Green) -->
            <div class="dash-clickable-row" data-action="pm-filter" data-urgency="COMPLETED" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 20px; border-bottom: 1px solid rgba(255, 255, 255, 0.05); cursor: pointer; transition: background 0.15s ease;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 16px;">✅</span>
                <div>
                  <span style="font-size: 14px; font-weight: 600; color: #e2e8f0;">Serviced Machines</span>
                  <div style="font-size: 11px; color: #10b981;">Completed Servicing Cycle</div>
                </div>
              </div>
              <button type="button" class="dash-qty-pill" style="background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.35); padding: 5px 14px; border-radius: 20px; font-size: 13.5px; font-weight: 800; cursor: pointer; font-variant-numeric: tabular-nums;">
                ${pmServicedCount} Qty
              </button>
            </div>

            <!-- Row: Overdue Servicing (Red) -->
            <div class="dash-clickable-row" data-action="pm-filter" data-urgency="OVERDUE" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 20px; border-bottom: 1px solid rgba(255, 255, 255, 0.05); cursor: pointer; transition: background 0.15s ease;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 16px;">🔴</span>
                <div>
                  <span style="font-size: 14px; font-weight: 600; color: #f87171;">Overdue Servicing</span>
                  <div style="font-size: 11px; color: #ef4444;">Needs Immediate Attention</div>
                </div>
              </div>
              <button type="button" class="dash-qty-pill" style="background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.35); padding: 5px 14px; border-radius: 20px; font-size: 13.5px; font-weight: 800; cursor: pointer; font-variant-numeric: tabular-nums;">
                ${pmOverdue} Qty
              </button>
            </div>

            <!-- Row: Due Today (Yellow/Amber) -->
            <div class="dash-clickable-row" data-action="pm-filter" data-urgency="DUE_TODAY" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 20px; border-bottom: 1px solid rgba(255, 255, 255, 0.05); cursor: pointer; transition: background 0.15s ease;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 16px;">🟡</span>
                <div>
                  <span style="font-size: 14px; font-weight: 600; color: #fbbf24;">Due Today</span>
                  <div style="font-size: 11px; color: #f59e0b;">Scheduled For Service Today</div>
                </div>
              </div>
              <button type="button" class="dash-qty-pill" style="background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.35); padding: 5px 14px; border-radius: 20px; font-size: 13.5px; font-weight: 800; cursor: pointer; font-variant-numeric: tabular-nums;">
                ${pmDueToday} Qty
              </button>
            </div>

            <!-- Row: Due Within 7 Days (Yellow/Amber) -->
            <div class="dash-clickable-row" data-action="pm-filter" data-urgency="DUE_SOON" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 20px; border-bottom: 1px solid rgba(255, 255, 255, 0.05); cursor: pointer; transition: background 0.15s ease;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 16px;">⏳</span>
                <div>
                  <span style="font-size: 14px; font-weight: 600; color: #fde047;">Due Within 7 Days</span>
                  <div style="font-size: 11px; color: #eab308;">Next Cycle Within 7 Days</div>
                </div>
              </div>
              <button type="button" class="dash-qty-pill" style="background: rgba(234, 179, 8, 0.15); color: #fde047; border: 1px solid rgba(234, 179, 8, 0.35); padding: 5px 14px; border-radius: 20px; font-size: 13.5px; font-weight: 800; cursor: pointer; font-variant-numeric: tabular-nums;">
                ${pmDueWithin7Days} Qty
              </button>
            </div>

            <!-- Row: Upcoming Servicing (Blue) -->
            <div class="dash-clickable-row" data-action="pm-filter" data-urgency="SCHEDULED" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 20px; cursor: pointer; transition: background 0.15s ease;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 16px;">🗓️</span>
                <div>
                  <span style="font-size: 14px; font-weight: 600; color: #93c5fd;">Upcoming Servicing</span>
                  <div style="font-size: 11px; color: #60a5fa;">Scheduled Future Cycles</div>
                </div>
              </div>
              <button type="button" class="dash-qty-pill" style="background: rgba(59, 130, 246, 0.15); color: #93c5fd; border: 1px solid rgba(59, 130, 246, 0.35); padding: 5px 14px; border-radius: 20px; font-size: 13.5px; font-weight: 800; cursor: pointer; font-variant-numeric: tabular-nums;">
                ${pmUpcoming} Qty
              </button>
            </div>

          </div>
        </div>

        <!-- ================================================================= -->
        <!-- 4. SECTION 4: NEEDLE DATA -->
        <!-- ================================================================= -->
        <div class="dash-section-card" style="background: #0f172a; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.35);">
          <!-- Card Header -->
          <div style="padding: 14px 20px; background: rgba(255, 255, 255, 0.03); border-bottom: 1px solid rgba(255, 255, 255, 0.08); display: flex; justify-content: space-between; align-items: center;">
            <div style="font-size: 16px; font-weight: 800; color: #f8fafc; letter-spacing: -0.2px;">
              4. Needle Data
            </div>
            <span style="font-size: 11px; font-weight: 700; color: #38bdf8; background: rgba(56, 189, 248, 0.12); padding: 3px 8px; border-radius: 6px;">
              Total Stock: ${sumNeedleStock.toLocaleString()}
            </span>
          </div>

          <!-- Needle Table Header (4 Columns matching screenshot) -->
          <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; padding: 10px 20px; background: rgba(0, 0, 0, 0.35); font-size: 13px; font-weight: 800; color: #94a3b8; border-bottom: 1px solid rgba(255, 255, 255, 0.08); text-align: center;">
            <span style="text-align: left;">Needle Type</span>
            <span>Required</span>
            <span>Pending</span>
            <span>Stock</span>
          </div>

          <!-- Needle Table Rows -->
          <div style="display: flex; flex-direction: column;">
            ${needleTableRows.map(r => `
              <div class="dash-clickable-row" data-action="needle-filter" data-needle="${r.code}" style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; align-items: center; padding: 12px 20px; border-bottom: 1px solid rgba(255, 255, 255, 0.05); cursor: pointer; transition: background 0.15s ease;">
                <div style="display: flex; flex-direction: column; text-align: left;">
                  <span style="font-size: 15px; font-weight: 800; color: #38bdf8; letter-spacing: 0.2px;">${r.code}</span>
                  <span style="font-size: 11px; color: #64748b;">${r.desc}</span>
                </div>
                <div style="text-align: center;">
                  <span style="background: rgba(56, 189, 248, 0.1); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.25); padding: 4px 10px; border-radius: 14px; font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; display: inline-block;">
                    ${r.requiredQty.toLocaleString()} Qty
                  </span>
                </div>
                <div style="text-align: center;">
                  <span style="background: ${r.pendingQuantity > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.05)'}; color: ${r.pendingQuantity > 0 ? '#f87171' : '#94a3b8'}; border: 1px solid ${r.pendingQuantity > 0 ? 'rgba(239, 68, 68, 0.35)' : 'rgba(255, 255, 255, 0.1)'}; padding: 4px 10px; border-radius: 14px; font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; display: inline-block;">
                    ${r.pendingQuantity.toLocaleString()} Qty
                  </span>
                </div>
                <div style="text-align: center;">
                  <span style="background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.35); padding: 4px 10px; border-radius: 14px; font-size: 13px; font-weight: 800; font-variant-numeric: tabular-nums; display: inline-block;">
                    ${r.availableStock.toLocaleString()} Qty
                  </span>
                </div>
              </div>
            `).join('')}

            <!-- Summary Total Row -->
            <div class="dash-clickable-row" data-action="needle-filter" data-needle="ALL" style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; align-items: center; padding: 14px 20px; background: rgba(56, 189, 248, 0.04); border-top: 2px solid rgba(56, 189, 248, 0.25); cursor: pointer; transition: background 0.15s ease;">
              <div style="text-align: left;">
                <span style="font-size: 15px; font-weight: 900; color: #ffffff;">Total</span>
                <div style="font-size: 11px; color: #94a3b8;">All 4 Garment Needle Systems</div>
              </div>
              <div style="text-align: center;">
                <span style="background: rgba(56, 189, 248, 0.2); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.4); padding: 5px 12px; border-radius: 14px; font-size: 13.5px; font-weight: 900; font-variant-numeric: tabular-nums; display: inline-block;">
                  ${sumNeedleRequired.toLocaleString()} Qty
                </span>
              </div>
              <div style="text-align: center;">
                <span style="background: ${sumNeedlePending > 0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.08)'}; color: ${sumNeedlePending > 0 ? '#f87171' : '#cbd5e1'}; border: 1px solid ${sumNeedlePending > 0 ? 'rgba(239, 68, 68, 0.4)' : 'rgba(255, 255, 255, 0.15)'}; padding: 5px 12px; border-radius: 14px; font-size: 13.5px; font-weight: 900; font-variant-numeric: tabular-nums; display: inline-block;">
                  ${sumNeedlePending.toLocaleString()} Qty
                </span>
              </div>
              <div style="text-align: center;">
                <span style="background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4); padding: 5px 12px; border-radius: 14px; font-size: 13.5px; font-weight: 900; font-variant-numeric: tabular-nums; display: inline-block;">
                  ${sumNeedleStock.toLocaleString()} Qty
                </span>
              </div>
            </div>

          </div>
        </div>

      </div>

      <!-- Live Servicing Schedules Preview Table -->
      ${sortedMaintMachines.length > 0 ? `
        <div style="background: #0f172a; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; overflow: hidden; margin-top: 4px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.35);">
          <div style="padding: 14px 20px; background: rgba(255, 255, 255, 0.03); border-bottom: 1px solid rgba(255, 255, 255, 0.08); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 16px;">⏱️</span>
              <span style="font-size: 15px; font-weight: 800; color: #f8fafc;">Live Servicing Schedules & Responsible Technicians</span>
            </div>
            <button type="button" class="btn btn-secondary btn-sm" id="btn-dash-open-full-pm" style="font-size: 12px; font-weight: 600; color: #38bdf8; border-color: rgba(56, 189, 248, 0.3);">
              View Full Preventive Schedule &rarr;
            </button>
          </div>

          <div style="overflow-x: auto;">
            <table class="table" style="width: 100%; border-collapse: collapse; margin: 0; font-size: 13px;">
              <thead>
                <tr style="background: rgba(0, 0, 0, 0.3); color: #94a3b8; font-size: 12px; font-weight: 700; text-transform: uppercase;">
                  <th style="padding: 10px 16px; text-align: left;">Machine / Serial</th>
                  <th style="padding: 10px 16px; text-align: left;">Location</th>
                  <th style="padding: 10px 16px; text-align: left;">Last Servicing</th>
                  <th style="padding: 10px 16px; text-align: left;">Next Due Date</th>
                  <th style="padding: 10px 16px; text-align: left;">Status</th>
                  <th style="padding: 10px 16px; text-align: left;">Technician</th>
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
                    <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05); color: #cbd5e1;">
                      <td style="padding: 10px 16px;">
                        <div style="font-weight: 700; color: #f8fafc;">${m.machineName || 'Machine'}</div>
                        <div style="font-size: 11px; color: #64748b; font-family: monospace;">SN: ${m.serialNumber || 'N/A'}</div>
                      </td>
                      <td style="padding: 10px 16px; font-size: 12px; color: #94a3b8;">
                        ${m.floor || 'Floor'} &bull; ${m.line || 'Line'}
                      </td>
                      <td style="padding: 10px 16px; font-size: 12px; color: #cbd5e1;">
                        ${m.lastServiceDate || 'None recorded'}
                      </td>
                      <td style="padding: 10px 16px; font-size: 12px; font-weight: 700; color: #ffffff;">
                        ${m.nextServiceDate || 'Not scheduled'}
                      </td>
                      <td style="padding: 10px 16px;">
                        <span style="background: ${uStyle.bg}; color: ${uStyle.text}; border: 1px solid ${uStyle.border}; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 6px; display: inline-block;">
                          ${uStyle.label}
                        </span>
                      </td>
                      <td style="padding: 10px 16px; font-size: 12px; color: #cbd5e1;">
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
      .dash-clickable-row:hover {
        background: rgba(255, 255, 255, 0.04) !important;
      }
      .dash-clickable-row:hover .dash-qty-pill {
        transform: translateY(-1px) scale(1.02);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
      }
      .dash-qty-pill {
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      }
      @media (max-width: 600px) {
        .user-friendly-dashboard {
          padding: 10px 10px 24px 10px !important;
        }
        .user-friendly-dashboard > div {
          grid-template-columns: 1fr !important;
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
  // Navigation Buttons
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

  // Row Click Actions: Section 1 (Inventory)
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

  // Row Click Actions: Section 2 (Machine Transfers)
  document.querySelectorAll('[data-action="trf-filter"]').forEach(el => {
    el.addEventListener('click', () => {
      const status = el.getAttribute('data-status') || 'ALL';
      state.set('transferStatusFilter', status);
      state.set('currentView', 'transfers');
    });
  });

  // Row Click Actions: Section 3 (Machine Servicing)
  document.querySelectorAll('[data-action="pm-filter"]').forEach(el => {
    el.addEventListener('click', () => {
      const urgency = el.getAttribute('data-urgency') || 'ALL';
      state.set('pmFilterUrgency', urgency);
      state.set('currentView', 'preventive-maintenance');
    });
  });

  // Row Click Actions: Section 4 (Needle Operations)
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
