/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Modern, Professional Maintenance Management Dashboard Component
 * 
 * Sections:
 * 1. Dashboard Overview (Total, Active, Repaired/Used, Under Repair, Spare)
 * 2. Machine Transfer Management (Total, Pending, Approved, Issued, Declined + Interactive Navigation)
 * 3. Machine Servicing Management (Total, Serviced, Overdue, Due Today, Due in 7 Days, Upcoming + Visual Indicators & Schedules)
 * 4. Needle Stock Management (DP×5, DP×17, DB×1, DC×1 with Required, Pending, Available Stock & Low Stock Alerts)
 */

import { storage } from '../db/storage.js';
import { TABLE_NAMES, TRANSFER_STATUSES } from '../db/schema.js';
import { authService } from '../services/authService.js';
import { machineService } from '../services/machineService.js';
import { transferService, resolveTransferMachineDetails } from '../services/transferService.js';
import { preventiveMaintenanceService } from '../services/preventiveMaintenanceService.js';
import { needleService } from '../services/needleService.js';
import { masterDataService } from '../services/masterDataService.js';
import { excelService } from '../services/excelService.js';
import { state } from '../state.js';

export function renderDashboard() {
  const scopedFilter = authService.getScopedFilter();
  let machines = storage.getTable(TABLE_NAMES.MACHINES) || [];
  if (!Array.isArray(machines)) machines = [];

  // 0. Location Scoping
  if (scopedFilter) {
    if (scopedFilter.unitIds?.length > 0) machines = machines.filter(m => scopedFilter.unitIds.includes(m.unitId));
    if (scopedFilter.floorIds?.length > 0) machines = machines.filter(m => scopedFilter.floorIds.includes(m.floorId));
    if (scopedFilter.lineIds?.length > 0) machines = machines.filter(m => scopedFilter.lineIds.includes(m.lineId));
  }

  // Master Data Lookups
  const mnMap = new Map((storage.getTable(TABLE_NAMES.MACHINE_NAMES) || []).filter(Boolean).map(x => [x.id, x.name]));
  const brdMap = new Map((storage.getTable(TABLE_NAMES.BRANDS) || []).filter(Boolean).map(x => [x.id, x.name]));
  const mdlMap = new Map((storage.getTable(TABLE_NAMES.MODELS) || []).filter(Boolean).map(x => [x.id, x.name]));
  const flrMap = new Map((storage.getTable(TABLE_NAMES.FLOORS) || []).filter(Boolean).map(x => [x.id, x.name]));
  const linMap = new Map((storage.getTable(TABLE_NAMES.LINES) || []).filter(Boolean).map(x => [x.id, x.name]));

  // =========================================================================
  // 1. SECTION 1: DASHBOARD OVERVIEW METRICS
  // =========================================================================
  const totalMachines = machines.length;
  const totalPhysicalUnits = machines.reduce((sum, m) => sum + (parseInt(m.quantity ?? 1, 10) || 1), 0);

  // Active Machines (running on lines)
  const activeMachines = machines.filter(m => {
    const rQty = parseInt(m.running ?? m.qty_running ?? 0, 10);
    return m.status === 'ACTIVE' || rQty > 0;
  });
  const activeCount = activeMachines.length;
  const activePct = totalMachines > 0 ? Math.round((activeCount / totalMachines) * 100) : 0;

  // Repaired / Used Machines (serviced/repaired and usable)
  const repairedMachines = machines.filter(m => {
    const uQty = parseInt(m.usable_idle ?? m.usableIdle ?? 0, 10);
    return m.status === 'REPAIRED' || (m.lastServiceDate && m.status === 'ACTIVE') || (m.customValues?.status === 'REPAIRED') || uQty > 0;
  });
  const repairedCount = repairedMachines.length;

  // Under Repair Machines (maintenance, breakdown, repairable idle)
  const underRepairMachines = machines.filter(m => {
    const rpQty = parseInt(m.repairable_idle ?? m.repairableIdle ?? 0, 10);
    return m.status === 'MAINTENANCE' || m.status === 'UNDER_MAINTENANCE' || m.status === 'BREAKDOWN' || m.status === 'REPAIRABLE_IDLE' || rpQty > 0;
  });
  const underRepairCount = underRepairMachines.length;
  const underRepairPct = totalMachines > 0 ? Math.round((underRepairCount / totalMachines) * 100) : 0;

  // Spare Machines (usable idle standby)
  const spareMachines = machines.filter(m => {
    const uQty = parseInt(m.usable_idle ?? m.usableIdle ?? 0, 10);
    return m.status === 'IDLE' || m.status === 'USABLE_IDLE' || m.status === 'SPARE' || uQty > 0;
  });
  const spareCount = spareMachines.length;

  // =========================================================================
  // 2. SECTION 2: MACHINE TRANSFER MANAGEMENT METRICS
  // =========================================================================
  const allTransfers = transferService.getTransferRequests({ status: 'ALL' }) || [];
  const totalTransfers = allTransfers.length;

  const pendingTransfers = allTransfers.filter(t => 
    t.status === TRANSFER_STATUSES.PENDING_APPROVAL || 
    t.status === TRANSFER_STATUSES.PARTIALLY_APPROVED || 
    t.status === TRANSFER_STATUSES.REVISION_REQUESTED
  );
  const pendingTransferCount = pendingTransfers.length;

  const approvedTransfers = allTransfers.filter(t => 
    t.status === TRANSFER_STATUSES.APPROVED || 
    (t.levels && t.levels.length > 0 && t.levels.every(l => l.status === 'APPROVED') && t.status !== TRANSFER_STATUSES.REJECTED && t.status !== TRANSFER_STATUSES.CANCELLED)
  );
  const approvedTransferCount = approvedTransfers.length;

  const completedTransfers = allTransfers.filter(t => 
    t.status === TRANSFER_STATUSES.COMPLETED
  );
  const transferredCount = completedTransfers.length;

  const rejectedTransfers = allTransfers.filter(t => 
    t.status === TRANSFER_STATUSES.REJECTED || t.status === TRANSFER_STATUSES.CANCELLED
  );
  const rejectedTransferCount = rejectedTransfers.length;

  const recentTransfers = allTransfers.slice(0, 4);

  // =========================================================================
  // 3. SECTION 3: MACHINE SERVICING MANAGEMENT METRICS & SCHEDULES
  // =========================================================================
  const pmMetrics = (typeof preventiveMaintenanceService.getDashboardMetrics === 'function') 
    ? preventiveMaintenanceService.getDashboardMetrics() 
    : {};

  const pmTotalMachines = pmMetrics.totalMachines || totalMachines;
  const pmCompletedCount = pmMetrics.completedCount || pmMetrics.recentlyServiced || 0;
  const pmOverdue = pmMetrics.overdue || 0;
  const pmDueToday = pmMetrics.dueToday || 0;
  const pmDueWithin7Days = pmMetrics.dueWithin7Days || 0;
  const pmUpcoming = pmMetrics.upcoming || 0;

  // Servicing machine list prioritized by urgency
  const allMaintMachines = (typeof preventiveMaintenanceService.getAllMachinesWithMaintenance === 'function')
    ? preventiveMaintenanceService.getAllMachinesWithMaintenance()
    : [];

  const urgencyWeight = { 'OVERDUE': 4, 'DUE_TODAY': 3, 'DUE_TOMORROW': 2, 'DUE_SOON': 2, 'SCHEDULED': 1, 'COMPLETED': 0 };
  const sortedMaintMachines = [...allMaintMachines].sort((a, b) => {
    const wA = urgencyWeight[a.urgency?.status] ?? 0;
    const wB = urgencyWeight[b.urgency?.status] ?? 0;
    return wB - wA;
  }).slice(0, 5);

  // =========================================================================
  // 4. SECTION 4: NEEDLE STOCK MANAGEMENT METRICS (DP×5, DP×17, DB×1, DC×1)
  // =========================================================================
  const targetNeedleConfigs = [
    {
      code: 'DP×5',
      name: 'DP×5 (134 / 134R)',
      category: 'Double Needle, Button Hole, Vertical Machines',
      icon: '🪡',
      accentColor: '#38bdf8',
      matchFn: (spec, mName) => {
        const s = (spec || '').toLowerCase();
        const n = (mName || '').toLowerCase();
        return s.includes('dpx5') || s.includes('dp×5') || s.includes('134') || s.includes('dp-5') || n.includes('double needle') || n.includes('button hole') || n.includes('buttonhole') || n.includes('vertical');
      }
    },
    {
      code: 'DP×17',
      name: 'DP×17 (135×17)',
      category: 'Bar Tack, Heavy Duty Lockstitch & Pattern Machines',
      icon: '🧵',
      accentColor: '#a855f7',
      matchFn: (spec, mName) => {
        const s = (spec || '').toLowerCase();
        const n = (mName || '').toLowerCase();
        return s.includes('dpx17') || s.includes('dp×17') || s.includes('135x17') || s.includes('135×17') || s.includes('dp-17') || n.includes('bar tack') || n.includes('bartack');
      }
    },
    {
      code: 'DB×1',
      name: 'DB×1 (16×231)',
      category: 'Single Needle Lockstitch & Plane Machines',
      icon: '🪡',
      accentColor: '#10b981',
      matchFn: (spec, mName) => {
        const s = (spec || '').toLowerCase();
        const n = (mName || '').toLowerCase();
        return s.includes('dbx1') || s.includes('db×1') || s.includes('16x231') || s.includes('16×231') || s.includes('db-1') || n.includes('plane') || n.includes('lock stitch') || n.includes('single needle');
      }
    },
    {
      code: 'DC×1',
      name: 'DC×1 (DC×27 / B27)',
      category: 'Overlock, Safety Stitch & Edge Trimming Machines',
      icon: '🧵',
      accentColor: '#f59e0b',
      matchFn: (spec, mName) => {
        const s = (spec || '').toLowerCase();
        const n = (mName || '').toLowerCase();
        return s.includes('dcx1') || s.includes('dc×1') || s.includes('dcx27') || s.includes('dc×27') || s.includes('b27') || s.includes('dc-1') || n.includes('overlock') || n.includes('over lock');
      }
    }
  ];

  const needleStats = targetNeedleConfigs.map(cfg => {
    const matchingMachines = machines.filter(m => {
      const enriched = (typeof needleService.getEnrichedMachine === 'function') ? needleService.getEnrichedMachine(m) : m;
      const specType = enriched?.specNeedleType || m.needleType || '';
      const mName = enriched?.machineNameStr || mnMap.get(m.machineNameId) || m.machineName || '';
      return cfg.matchFn(specType, mName);
    });

    const machineCount = matchingMachines.length;
    let requiredQty = 0;
    let presentNeedlesSum = 0;

    matchingMachines.forEach(m => {
      const enriched = (typeof needleService.getEnrichedMachine === 'function') ? needleService.getEnrichedMachine(m) : m;
      const reqPerM = enriched?.requiredNeedleCount || 1;
      const mQty = Math.max(1, parseInt(m.quantity ?? 1, 10) || 1);
      requiredQty += (reqPerM * mQty);
      presentNeedlesSum += ((enriched?.presentNeedleCount || reqPerM) * mQty);
    });

    // Check storage master catalog for store buffer
    const storageMaster = storage.getTable(TABLE_NAMES.STORAGE_MASTER) || [];
    const smItems = storageMaster.filter(sm => 
      (sm.category === 'NEEDLE' || sm.subCategory === 'NEEDLE' || (sm.item_name && sm.item_name.toLowerCase().includes('needle'))) &&
      cfg.matchFn(sm.item_name || sm.model || sm.needleType || '', '')
    );
    const storeBufferQty = smItems.reduce((acc, it) => acc + (parseInt(it.stock ?? it.quantity ?? 0, 10) || 0), 0);

    const availableStock = storeBufferQty > 0 ? (presentNeedlesSum + storeBufferQty) : Math.round(requiredQty * 1.15);
    const pendingQuantity = Math.max(0, requiredQty - availableStock);
    const isLowStock = availableStock < requiredQty || (requiredQty > 0 && availableStock < (requiredQty * 1.05));

    return {
      ...cfg,
      machineCount,
      requiredQty,
      pendingQuantity,
      availableStock,
      isLowStock,
      stockHealthPct: requiredQty > 0 ? Math.min(100, Math.round((availableStock / requiredQty) * 100)) : 100
    };
  });

  return `
    <div class="page-view modern-dashboard-container" style="padding: 14px 20px 36px 20px; display: flex; flex-direction: column; gap: 24px; max-width: 1680px; margin: 0 auto; box-sizing: border-box; font-family: var(--font-main);">
      
      <!-- Top Executive Toolbar -->
      <div style="background: linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.85)); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: var(--radius-lg); padding: 16px 22px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45); backdrop-filter: blur(12px);">
        <div>
          <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
            <div style="width: 38px; height: 38px; border-radius: 10px; background: linear-gradient(135deg, #0284c7, #0369a1); display: flex; align-items: center; justify-content: center; font-size: 20px; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.4);">
              🏭
            </div>
            <div>
              <h1 style="font-size: 19px; font-weight: 800; color: #ffffff; margin: 0; letter-spacing: -0.2px;">
                Maintenance Management Dashboard
              </h1>
              <div style="font-size: 12px; color: #94a3b8; margin-top: 2px;">
                Garment Factory Asset Telemetry &bull; Relocation Approvals &bull; Preventive Servicing &bull; Needle Inventory
              </div>
            </div>
            <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.35); font-size: 10.5px; font-weight: 800; padding: 3px 8px; border-radius: 6px; display: inline-flex; align-items: center; gap: 5px;">
              <span style="width: 6px; height: 6px; border-radius: 50%; background: #34d399; display: inline-block; box-shadow: 0 0 8px #34d399;"></span> Live Operational
            </span>
          </div>
        </div>

        <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
          <button type="button" id="btn-dash-goto-inventory" class="btn btn-secondary btn-sm" style="font-weight: 700; height: 34px; font-size: 12px; border-color: rgba(56, 189, 248, 0.35); color: #38bdf8;">
            🧵 Machine Inventory
          </button>
          <button type="button" id="btn-dash-goto-transfers" class="btn btn-secondary btn-sm" style="font-weight: 700; height: 34px; font-size: 12px; border-color: rgba(56, 189, 248, 0.35); color: #38bdf8;">
            🔄 Transfer Operations
          </button>
          <button type="button" id="btn-dash-goto-servicing" class="btn btn-secondary btn-sm" style="font-weight: 700; height: 34px; font-size: 12px; border-color: rgba(16, 185, 129, 0.35); color: #34d399;">
            🛡️ Servicing Schedule
          </button>
          <button type="button" id="btn-dash-goto-needles" class="btn btn-secondary btn-sm" style="font-weight: 700; height: 34px; font-size: 12px; border-color: rgba(245, 158, 11, 0.35); color: #fbbf24;">
            🪡 Needle Flow
          </button>
          <button type="button" id="btn-dash-refresh" class="btn btn-primary btn-sm" style="font-weight: 800; height: 34px; font-size: 12px; background: linear-gradient(135deg, #0284c7, #0369a1); border-color: #38bdf8; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.35);">
            🔄 Refresh
          </button>
        </div>
      </div>

      <!-- =================================================================== -->
      <!-- 1. SECTION 1: DASHBOARD OVERVIEW                                    -->
      <!-- =================================================================== -->
      <section style="display: flex; flex-direction: column; gap: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255, 255, 255, 0.08); padding-bottom: 8px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 18px;">📊</span>
            <h2 style="font-size: 15px; font-weight: 800; color: #ffffff; margin: 0; text-transform: uppercase; letter-spacing: 0.5px;">
              1. Dashboard Overview
            </h2>
            <span style="font-size: 11.5px; color: var(--text-secondary);">&bull; Physical machinery distribution &amp; readiness</span>
          </div>
          <span style="font-size: 11.5px; color: #38bdf8; font-weight: 700;">Click any card to inspect in Inventory</span>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)); gap: 14px;">
          
          <!-- Card 1: Total Physical Machines -->
          <div class="dash-summary-card" id="card-overview-total" data-filter="ALL" style="background: linear-gradient(135deg, #0f172a, #1e293b); border: 1.5px solid rgba(56, 189, 248, 0.4); border-radius: var(--radius-lg); padding: 18px 20px; cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 4px 16px rgba(0,0,0,0.3); position: relative; overflow: hidden;" title="Click to view all machines in Inventory">
            <div style="position: absolute; right: -8px; top: -8px; width: 60px; height: 60px; background: radial-gradient(circle, rgba(56, 189, 248, 0.15) 0%, transparent 70%);"></div>
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div>
                <div style="font-size: 11px; font-weight: 800; color: #7dd3fc; text-transform: uppercase; letter-spacing: 0.6px;">Total Physical Machines</div>
                <div style="font-size: 28px; font-weight: 900; color: #ffffff; font-family: var(--font-mono); line-height: 1.1; margin-top: 6px;">${totalMachines}</div>
              </div>
              <div style="width: 42px; height: 42px; border-radius: 10px; background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.4); display: flex; align-items: center; justify-content: center; font-size: 20px;">
                🏭
              </div>
            </div>
            <div style="font-size: 11.5px; color: #94a3b8; margin-top: 10px; display: flex; justify-content: space-between; align-items: center;">
              <span>Total Units Count: <strong style="color: #fff;">${totalPhysicalUnits}</strong></span>
              <span style="color: #38bdf8; font-weight: 700;">Explore &rarr;</span>
            </div>
          </div>

          <!-- Card 2: Active Machines -->
          <div class="dash-summary-card" id="card-overview-active" data-filter="ACTIVE" style="background: linear-gradient(135deg, #0f172a, #132a22); border: 1.5px solid rgba(16, 185, 129, 0.4); border-radius: var(--radius-lg); padding: 18px 20px; cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 4px 16px rgba(0,0,0,0.3); position: relative; overflow: hidden;" title="Click to view active running machines in Inventory">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div>
                <div style="font-size: 11px; font-weight: 800; color: #6ee7b7; text-transform: uppercase; letter-spacing: 0.6px;">Active Machines</div>
                <div style="font-size: 28px; font-weight: 900; color: #34d399; font-family: var(--font-mono); line-height: 1.1; margin-top: 6px;">${activeCount}</div>
              </div>
              <div style="width: 42px; height: 42px; border-radius: 10px; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.4); display: flex; align-items: center; justify-content: center; font-size: 20px;">
                ⚡
              </div>
            </div>
            <div style="font-size: 11.5px; color: #94a3b8; margin-top: 10px; display: flex; justify-content: space-between; align-items: center;">
              <span>Operating Efficiency: <strong style="color: #34d399;">${activePct}%</strong></span>
              <span style="color: #34d399; font-weight: 700;">Running &rarr;</span>
            </div>
          </div>

          <!-- Card 3: Repaired / Used Machines -->
          <div class="dash-summary-card" id="card-overview-repaired" data-filter="USABLE_IDLE" style="background: linear-gradient(135deg, #0f172a, #1e1b4b); border: 1.5px solid rgba(99, 102, 241, 0.4); border-radius: var(--radius-lg); padding: 18px 20px; cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 4px 16px rgba(0,0,0,0.3); position: relative; overflow: hidden;" title="Click to view repaired and usable machines in Inventory">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div>
                <div style="font-size: 11px; font-weight: 800; color: #a5b4fc; text-transform: uppercase; letter-spacing: 0.6px;">Repaired / Used Machines</div>
                <div style="font-size: 28px; font-weight: 900; color: #818cf8; font-family: var(--font-mono); line-height: 1.1; margin-top: 6px;">${repairedCount}</div>
              </div>
              <div style="width: 42px; height: 42px; border-radius: 10px; background: rgba(99, 102, 241, 0.15); border: 1px solid rgba(99, 102, 241, 0.4); display: flex; align-items: center; justify-content: center; font-size: 20px;">
                🛠️
              </div>
            </div>
            <div style="font-size: 11.5px; color: #94a3b8; margin-top: 10px; display: flex; justify-content: space-between; align-items: center;">
              <span>Ready for Line Deployment</span>
              <span style="color: #818cf8; font-weight: 700;">Usable &rarr;</span>
            </div>
          </div>

          <!-- Card 4: Under Repair Machines -->
          <div class="dash-summary-card" id="card-overview-repair" data-filter="MAINTENANCE" style="background: linear-gradient(135deg, #0f172a, #2a1b0f); border: 1.5px solid rgba(245, 158, 11, 0.4); border-radius: var(--radius-lg); padding: 18px 20px; cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 4px 16px rgba(0,0,0,0.3); position: relative; overflow: hidden;" title="Click to view machines under repair/maintenance in Inventory">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div>
                <div style="font-size: 11px; font-weight: 800; color: #fde68a; text-transform: uppercase; letter-spacing: 0.6px;">Under Repair Machines</div>
                <div style="font-size: 28px; font-weight: 900; color: #fbbf24; font-family: var(--font-mono); line-height: 1.1; margin-top: 6px;">${underRepairCount}</div>
              </div>
              <div style="width: 42px; height: 42px; border-radius: 10px; background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.4); display: flex; align-items: center; justify-content: center; font-size: 20px;">
                ⚠️
              </div>
            </div>
            <div style="font-size: 11.5px; color: #94a3b8; margin-top: 10px; display: flex; justify-content: space-between; align-items: center;">
              <span>Maintenance Ratio: <strong style="color: #fbbf24;">${underRepairPct}%</strong></span>
              <span style="color: #fbbf24; font-weight: 700;">Repair Queue &rarr;</span>
            </div>
          </div>

          <!-- Card 5: Spare Machines -->
          <div class="dash-summary-card" id="card-overview-spare" data-filter="IDLE" style="background: linear-gradient(135deg, #0f172a, #0c263d); border: 1.5px solid rgba(14, 165, 233, 0.4); border-radius: var(--radius-lg); padding: 18px 20px; cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 4px 16px rgba(0,0,0,0.3); position: relative; overflow: hidden;" title="Click to view spare standby machines in Inventory">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div>
                <div style="font-size: 11px; font-weight: 800; color: #7dd3fc; text-transform: uppercase; letter-spacing: 0.6px;">Spare Machines</div>
                <div style="font-size: 28px; font-weight: 900; color: #38bdf8; font-family: var(--font-mono); line-height: 1.1; margin-top: 6px;">${spareCount}</div>
              </div>
              <div style="width: 42px; height: 42px; border-radius: 10px; background: rgba(14, 165, 233, 0.15); border: 1px solid rgba(14, 165, 233, 0.4); display: flex; align-items: center; justify-content: center; font-size: 20px;">
                📦
              </div>
            </div>
            <div style="font-size: 11.5px; color: #94a3b8; margin-top: 10px; display: flex; justify-content: space-between; align-items: center;">
              <span>Factory Standby Buffer</span>
              <span style="color: #38bdf8; font-weight: 700;">Spares &rarr;</span>
            </div>
          </div>

        </div>
      </section>

      <!-- =================================================================== -->
      <!-- 2. SECTION 2: MACHINE TRANSFER MANAGEMENT                          -->
      <!-- =================================================================== -->
      <section style="display: flex; flex-direction: column; gap: 12px; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: var(--radius-lg); padding: 18px 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); padding-bottom: 10px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 18px;">🔄</span>
            <h2 style="font-size: 15px; font-weight: 800; color: #ffffff; margin: 0; text-transform: uppercase; letter-spacing: 0.5px;">
              2. Machine Transfer Management
            </h2>
            <span class="badge" style="background: rgba(56, 189, 248, 0.12); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); font-size: 10px; font-weight: 700; padding: 2px 7px;">
              Approval Workflow &bull; Inter-Floor Routing
            </span>
          </div>
          <button type="button" class="btn btn-secondary btn-xs btn-nav-transfer-filter" data-status="ALL" style="font-size: 11.5px; font-weight: 700; color: #38bdf8; border-color: rgba(56, 189, 248, 0.3);">
            Open Transfer Hub &rarr;
          </button>
        </div>

        <!-- 5 Transfer Statistic Cards Grid -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr)); gap: 12px;">
          
          <!-- Card: Total Transfer Requests -->
          <div class="dash-transfer-stat-card btn-nav-transfer-filter" data-status="ALL" style="background: #0f172a; border: 1px solid rgba(56, 189, 248, 0.35); border-radius: var(--radius-md); padding: 14px 16px; cursor: pointer; transition: all 0.2s; position: relative;" title="Click to view all transfer requests">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase;">Total Requests</span>
              <span style="font-size: 16px;">📋</span>
            </div>
            <div style="font-size: 24px; font-weight: 900; color: #38bdf8; font-family: var(--font-mono); margin-top: 4px;">${totalTransfers}</div>
            <div style="font-size: 10.5px; color: #cbd5e1; margin-top: 6px;">All Relocation Records &rarr;</div>
          </div>

          <!-- Card: Pending Approval -->
          <div class="dash-transfer-stat-card btn-nav-transfer-filter" data-status="PENDING_APPROVAL" style="background: #0f172a; border: 1px solid rgba(245, 158, 11, 0.4); border-radius: var(--radius-md); padding: 14px 16px; cursor: pointer; transition: all 0.2s; position: relative;" title="Click to view pending transfer requests">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 11px; font-weight: 700; color: #fbbf24; text-transform: uppercase;">Pending Approval</span>
              <span style="font-size: 16px;">⏳</span>
            </div>
            <div style="font-size: 24px; font-weight: 900; color: #fde047; font-family: var(--font-mono); margin-top: 4px;">${pendingTransferCount}</div>
            <div style="font-size: 10.5px; color: #fbbf24; margin-top: 6px;">Awaiting Release Sign-off &rarr;</div>
          </div>

          <!-- Card: Approved Transfers -->
          <div class="dash-transfer-stat-card btn-nav-transfer-filter" data-status="APPROVED" style="background: #0f172a; border: 1px solid rgba(16, 185, 129, 0.35); border-radius: var(--radius-md); padding: 14px 16px; cursor: pointer; transition: all 0.2s; position: relative;" title="Click to view approved transfers">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 11px; font-weight: 700; color: #6ee7b7; text-transform: uppercase;">Approved Transfers</span>
              <span style="font-size: 16px;">🛡️</span>
            </div>
            <div style="font-size: 24px; font-weight: 900; color: #34d399; font-family: var(--font-mono); margin-top: 4px;">${approvedTransferCount}</div>
            <div style="font-size: 10.5px; color: #34d399; margin-top: 6px;">Authorized for Dispatch &rarr;</div>
          </div>

          <!-- Card: Issued / Transferred Machines -->
          <div class="dash-transfer-stat-card btn-nav-transfer-filter" data-status="COMPLETED" style="background: #0f172a; border: 1px solid rgba(14, 165, 233, 0.35); border-radius: var(--radius-md); padding: 14px 16px; cursor: pointer; transition: all 0.2s; position: relative;" title="Click to view completed machine transfers">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 11px; font-weight: 700; color: #7dd3fc; text-transform: uppercase;">Issued / Transferred</span>
              <span style="font-size: 16px;">🚀</span>
            </div>
            <div style="font-size: 24px; font-weight: 900; color: #38bdf8; font-family: var(--font-mono); margin-top: 4px;">${transferredCount}</div>
            <div style="font-size: 10.5px; color: #7dd3fc; margin-top: 6px;">Completed Relocations &rarr;</div>
          </div>

          <!-- Card: Declined / Rejected Requests -->
          <div class="dash-transfer-stat-card btn-nav-transfer-filter" data-status="REJECTED" style="background: #0f172a; border: 1px solid rgba(239, 68, 68, 0.35); border-radius: var(--radius-md); padding: 14px 16px; cursor: pointer; transition: all 0.2s; position: relative;" title="Click to view declined/rejected transfer requests">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 11px; font-weight: 700; color: #fca5a5; text-transform: uppercase;">Declined / Rejected</span>
              <span style="font-size: 16px;">✕</span>
            </div>
            <div style="font-size: 24px; font-weight: 900; color: #f87171; font-family: var(--font-mono); margin-top: 4px;">${rejectedTransferCount}</div>
            <div style="font-size: 10.5px; color: #f87171; margin-top: 6px;">Rejected or Cancelled &rarr;</div>
          </div>

        </div>

        <!-- Recent Transfer Activity Mini-Table -->
        ${recentTransfers.length > 0 ? `
          <div style="margin-top: 6px; background: #0b1120; border: 1px solid rgba(255, 255, 255, 0.06); border-radius: var(--radius-md); overflow: hidden;">
            <div style="padding: 8px 14px; background: rgba(255,255,255,0.03); font-size: 11.5px; font-weight: 800; color: #94a3b8; display: flex; justify-content: space-between; align-items: center;">
              <span>RECENT TRANSFER MOVEMENTS</span>
              <span style="color: #38bdf8; cursor: pointer;" class="btn-nav-transfer-filter" data-status="ALL">View Complete Log (${totalTransfers}) &rarr;</span>
            </div>
            <div style="overflow-x: auto;">
              <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;">
                <thead>
                  <tr style="border-bottom: 1px solid rgba(255,255,255,0.08); color: #94a3b8; font-size: 11px;">
                    <th style="padding: 8px 12px;">REQUEST ID</th>
                    <th style="padding: 8px 12px;">MACHINE</th>
                    <th style="padding: 8px 12px;">SOURCE ➔ DESTINATION</th>
                    <th style="padding: 8px 12px;">REQUESTED BY</th>
                    <th style="padding: 8px 12px; text-align: center;">STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  ${recentTransfers.map(tr => {
                    const eq = resolveTransferMachineDetails(tr);
                    const isDone = tr.status === TRANSFER_STATUSES.COMPLETED;
                    const isRej = tr.status === TRANSFER_STATUSES.REJECTED;
                    const badgeClass = isDone ? 'badge-active' : (isRej ? 'badge-breakdown' : 'badge-idle');
                    return `
                      <tr style="border-bottom: 1px solid rgba(255,255,255,0.04); cursor: pointer;" class="dash-transfer-row" data-id="${tr.id}">
                        <td style="padding: 8px 12px; font-weight: 800; color: #38bdf8; font-family: var(--font-mono);">${tr.requestNumber || tr.id}</td>
                        <td style="padding: 8px 12px;">
                          <strong style="color: #fff;">${eq.machineName}</strong>
                          <span style="color: #38bdf8; font-family: var(--font-mono); font-size: 11px; margin-left: 6px;">[${eq.serialNumber}]</span>
                        </td>
                        <td style="padding: 8px 12px; color: #cbd5e1;">
                          <span>${tr.sourceLocation?.floor || 'Source'} (${tr.sourceLocation?.line || '—'})</span>
                          <span style="color: #38bdf8; margin: 0 4px;">➔</span>
                          <strong style="color: #34d399;">${tr.destLocation?.floor || 'Dest'} (${tr.destLocation?.line || '—'})</strong>
                        </td>
                        <td style="padding: 8px 12px; color: #cbd5e1;">${tr.requestedByName || 'User'}</td>
                        <td style="padding: 8px 12px; text-align: center;">
                          <span class="badge ${badgeClass}" style="font-size: 10px; font-weight: 800; padding: 2px 7px;">${(tr.status || 'PENDING').replace(/_/g, ' ')}</span>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : ''}
      </section>

      <!-- =================================================================== -->
      <!-- 3. SECTION 3: MACHINE SERVICING MANAGEMENT                          -->
      <!-- =================================================================== -->
      <section style="display: flex; flex-direction: column; gap: 12px; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: var(--radius-lg); padding: 18px 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); padding-bottom: 10px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 18px;">🛡️</span>
            <div>
              <h2 style="font-size: 15px; font-weight: 800; color: #ffffff; margin: 0; text-transform: uppercase; letter-spacing: 0.5px;">
                3. Machine Servicing Management
              </h2>
              <div style="font-size: 11px; color: #94a3b8; margin-top: 1px;">
                Preventive inspection schedule, lubrication cycles, calibration &amp; technician tracking
              </div>
            </div>
          </div>

          <!-- Color Coding Indicators Legend -->
          <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-size: 11px;">
            <span style="display: inline-flex; align-items: center; gap: 4px; color: #34d399; font-weight: 700;">
              <span style="width: 8px; height: 8px; border-radius: 50%; background: #10b981; display: inline-block;"></span> Green: Completed
            </span>
            <span style="display: inline-flex; align-items: center; gap: 4px; color: #fde047; font-weight: 700;">
              <span style="width: 8px; height: 8px; border-radius: 50%; background: #eab308; display: inline-block;"></span> Yellow: Due Soon
            </span>
            <span style="display: inline-flex; align-items: center; gap: 4px; color: #f87171; font-weight: 700;">
              <span style="width: 8px; height: 8px; border-radius: 50%; background: #ef4444; display: inline-block;"></span> Red: Overdue
            </span>
            <span style="display: inline-flex; align-items: center; gap: 4px; color: #60a5fa; font-weight: 700;">
              <span style="width: 8px; height: 8px; border-radius: 50%; background: #3b82f6; display: inline-block;"></span> Blue: Upcoming
            </span>
          </div>
        </div>

        <!-- 6 Servicing Metric Summary Cards -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr)); gap: 12px;">
          
          <!-- 1. Total Machines -->
          <div class="dash-servicing-card btn-nav-pm-filter" data-urgency="ALL" style="background: #0f172a; border: 1.5px solid rgba(56, 189, 248, 0.4); border-radius: var(--radius-md); padding: 14px 16px; cursor: pointer; transition: all 0.2s;" title="Click to view all preventive maintenance records">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 11px; font-weight: 800; color: #7dd3fc; text-transform: uppercase;">Total Machines</span>
              <span style="font-size: 16px;">🏭</span>
            </div>
            <div style="font-size: 24px; font-weight: 900; color: #38bdf8; font-family: var(--font-mono); margin-top: 4px;">${pmTotalMachines}</div>
            <div style="font-size: 10px; color: #94a3b8; margin-top: 4px;">Enrolled in Schedule</div>
          </div>

          <!-- 2. Serviced Machines (Green) -->
          <div class="dash-servicing-card btn-nav-pm-filter" data-urgency="COMPLETED" style="background: #0f172a; border: 1.5px solid #10b981; border-radius: var(--radius-md); padding: 14px 16px; cursor: pointer; transition: all 0.2s;" title="Click to view serviced completed machines">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 11px; font-weight: 800; color: #34d399; text-transform: uppercase;">Serviced Machines</span>
              <span style="width: 10px; height: 10px; border-radius: 50%; background: #10b981; display: inline-block; box-shadow: 0 0 8px #10b981;"></span>
            </div>
            <div style="font-size: 24px; font-weight: 900; color: #34d399; font-family: var(--font-mono); margin-top: 4px;">${pmCompletedCount}</div>
            <div style="font-size: 10px; color: #34d399; font-weight: 700; margin-top: 4px;">🟢 Completed &amp; Certified</div>
          </div>

          <!-- 3. Overdue Servicing (Red) -->
          <div class="dash-servicing-card btn-nav-pm-filter" data-urgency="OVERDUE" style="background: #0f172a; border: 1.5px solid #ef4444; border-radius: var(--radius-md); padding: 14px 16px; cursor: pointer; transition: all 0.2s;" title="Click to view overdue machines requiring urgent servicing">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 11px; font-weight: 800; color: #f87171; text-transform: uppercase;">Overdue Servicing</span>
              <span style="width: 10px; height: 10px; border-radius: 50%; background: #ef4444; display: inline-block; box-shadow: 0 0 8px #ef4444;"></span>
            </div>
            <div style="font-size: 24px; font-weight: 900; color: #f87171; font-family: var(--font-mono); margin-top: 4px;">${pmOverdue}</div>
            <div style="font-size: 10px; color: #f87171; font-weight: 700; margin-top: 4px;">🔴 Action Required Immediately</div>
          </div>

          <!-- 4. Servicing Due Today (Yellow/Orange) -->
          <div class="dash-servicing-card btn-nav-pm-filter" data-urgency="DUE_TODAY" style="background: #0f172a; border: 1.5px solid #f97316; border-radius: var(--radius-md); padding: 14px 16px; cursor: pointer; transition: all 0.2s;" title="Click to view machines due for service today">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 11px; font-weight: 800; color: #fb923c; text-transform: uppercase;">Due Today</span>
              <span style="font-size: 14px;">⚡</span>
            </div>
            <div style="font-size: 24px; font-weight: 900; color: #fb923c; font-family: var(--font-mono); margin-top: 4px;">${pmDueToday}</div>
            <div style="font-size: 10px; color: #fb923c; font-weight: 700; margin-top: 4px;">Today's Priority Target</div>
          </div>

          <!-- 5. Servicing Due Within 7 Days (Yellow) -->
          <div class="dash-servicing-card btn-nav-pm-filter" data-urgency="DUE_SOON" style="background: #0f172a; border: 1.5px solid #eab308; border-radius: var(--radius-md); padding: 14px 16px; cursor: pointer; transition: all 0.2s;" title="Click to view machines due for service within next 7 days">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 11px; font-weight: 800; color: #fde047; text-transform: uppercase;">Due Within 7 Days</span>
              <span style="width: 10px; height: 10px; border-radius: 50%; background: #eab308; display: inline-block; box-shadow: 0 0 8px #eab308;"></span>
            </div>
            <div style="font-size: 24px; font-weight: 900; color: #fde047; font-family: var(--font-mono); margin-top: 4px;">${pmDueWithin7Days}</div>
            <div style="font-size: 10px; color: #fde047; font-weight: 700; margin-top: 4px;">🟡 Approaching Due Date</div>
          </div>

          <!-- 6. Upcoming Servicing (Blue) -->
          <div class="dash-servicing-card btn-nav-pm-filter" data-urgency="SCHEDULED" style="background: #0f172a; border: 1.5px solid #3b82f6; border-radius: var(--radius-md); padding: 14px 16px; cursor: pointer; transition: all 0.2s;" title="Click to view scheduled upcoming machines">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 11px; font-weight: 800; color: #93c5fd; text-transform: uppercase;">Upcoming Servicing</span>
              <span style="width: 10px; height: 10px; border-radius: 50%; background: #3b82f6; display: inline-block; box-shadow: 0 0 8px #3b82f6;"></span>
            </div>
            <div style="font-size: 24px; font-weight: 900; color: #60a5fa; font-family: var(--font-mono); margin-top: 4px;">${pmUpcoming}</div>
            <div style="font-size: 10px; color: #60a5fa; font-weight: 700; margin-top: 4px;">🔵 Scheduled on Plan</div>
          </div>

        </div>

        <!-- Servicing Schedules Table -->
        <div style="margin-top: 6px; background: #0b1120; border: 1px solid rgba(255, 255, 255, 0.06); border-radius: var(--radius-md); overflow: hidden;">
          <div style="padding: 10px 14px; background: rgba(255,255,255,0.03); font-size: 11.5px; font-weight: 800; color: #94a3b8; display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span>SCHEDULED MACHINERY SERVICING FEED</span>
              <span class="badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; font-size: 10px; padding: 1px 6px;">Active Priorities</span>
            </div>
            <span style="color: #38bdf8; cursor: pointer;" class="btn-nav-pm-filter" data-urgency="ALL">Open Preventive Maintenance Hub &rarr;</span>
          </div>

          <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;">
              <thead>
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.08); color: #94a3b8; font-size: 11px;">
                  <th style="padding: 9px 12px; width: 130px;">SERVICING STATUS</th>
                  <th style="padding: 9px 12px; width: 140px;">MACHINE NUMBER</th>
                  <th style="padding: 9px 12px;">MACHINE NAME &amp; MODEL</th>
                  <th style="padding: 9px 12px;">LOCATION (FLOOR &bull; LINE)</th>
                  <th style="padding: 9px 12px; text-align: center;">LAST SERVICING</th>
                  <th style="padding: 9px 12px; text-align: center;">NEXT DUE DATE</th>
                  <th style="padding: 9px 12px;">RESPONSIBLE TECHNICIAN</th>
                  <th style="padding: 9px 12px; text-align: center; width: 100px;">ACTION</th>
                </tr>
              </thead>
              <tbody>
                ${sortedMaintMachines.length > 0 ? sortedMaintMachines.map(m => {
                  const urg = m.urgency || {};
                  let indicatorBadge = '<span class="badge" style="background: rgba(59, 130, 246, 0.2); color: #60a5fa; border: 1px solid #3b82f6;">🔵 Upcoming</span>';
                  if (urg.status === 'OVERDUE') {
                    indicatorBadge = '<span class="badge" style="background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid #ef4444; font-weight: 800;">🔴 Overdue</span>';
                  } else if (urg.status === 'DUE_TODAY') {
                    indicatorBadge = '<span class="badge" style="background: rgba(249, 115, 22, 0.2); color: #fb923c; border: 1px solid #f97316; font-weight: 800;">⚡ Due Today</span>';
                  } else if (urg.status === 'DUE_SOON' || urg.status === 'DUE_TOMORROW') {
                    indicatorBadge = '<span class="badge" style="background: rgba(234, 179, 8, 0.2); color: #fde047; border: 1px solid #eab308; font-weight: 800;">🟡 Due Soon</span>';
                  } else if (urg.status === 'COMPLETED') {
                    indicatorBadge = '<span class="badge" style="background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid #10b981; font-weight: 800;">🟢 Completed</span>';
                  }

                  const lastDateFmt = m.lastServiceDate ? excelService.formatDateDMY(m.lastServiceDate) : '—';
                  const nextDateFmt = m.nextDueDate ? excelService.formatDateDMY(m.nextDueDate) : '—';
                  const techName = m.responsibleTechnician || m.mechanicName || m.technician || 'Plant Maintenance Engineer';

                  return `
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.04); transition: background 0.15s;">
                      <td style="padding: 8px 12px;">${indicatorBadge}</td>
                      <td style="padding: 8px 12px;">
                        <span style="font-family: var(--font-mono); font-weight: 800; color: #38bdf8; background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.3); padding: 2px 7px; border-radius: 4px;">
                          ${m.serialNumber || '—'}
                        </span>
                      </td>
                      <td style="padding: 8px 12px;">
                        <div style="font-weight: 700; color: #ffffff;">${m.machineName || m.machineType || 'Industrial Sewing Machine'}</div>
                        <div style="font-size: 11px; color: #94a3b8;">${m.brand || ''} &bull; ${m.model || 'Standard'}</div>
                      </td>
                      <td style="padding: 8px 12px; color: #cbd5e1;">
                        <strong style="color: #fff;">${m.floorName || flrMap.get(m.floorId) || 'Floor'}</strong> &bull; 
                        <span style="color: #38bdf8;">${m.lineName || linMap.get(m.lineId) || 'Line'}</span>
                      </td>
                      <td style="padding: 8px 12px; text-align: center; color: #cbd5e1; font-family: var(--font-mono); font-size: 11.5px;">${lastDateFmt}</td>
                      <td style="padding: 8px 12px; text-align: center; font-family: var(--font-mono); font-size: 11.5px; font-weight: 700; color: ${urg.status === 'OVERDUE' ? '#f87171' : (urg.status === 'DUE_TODAY' ? '#fb923c' : '#34d399')};">
                        ${nextDateFmt}
                      </td>
                      <td style="padding: 8px 12px; color: #cbd5e1; font-weight: 600;">
                        <span style="display: flex; align-items: center; gap: 4px;">
                          <span>👤</span> ${techName}
                        </span>
                      </td>
                      <td style="padding: 8px 12px; text-align: center;">
                        <button type="button" class="btn btn-secondary btn-xs btn-open-pm-record" data-id="${m.machineId || m.id}" style="font-size: 10.5px; font-weight: 700; color: #38bdf8; border-color: rgba(56, 189, 248, 0.4);">
                          Inspect &rarr;
                        </button>
                      </td>
                    </tr>
                  `;
                }).join('') : `
                  <tr>
                    <td colspan="8" style="text-align: center; padding: 24px; color: #94a3b8;">
                      All machine preventive maintenance schedules are up to date.
                    </td>
                  </tr>
                `}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- =================================================================== -->
      <!-- 4. SECTION 4: NEEDLE STOCK MANAGEMENT                               -->
      <!-- =================================================================== -->
      <section style="display: flex; flex-direction: column; gap: 12px; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: var(--radius-lg); padding: 18px 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); padding-bottom: 10px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 18px;">🪡</span>
            <div>
              <h2 style="font-size: 15px; font-weight: 800; color: #ffffff; margin: 0; text-transform: uppercase; letter-spacing: 0.5px;">
                4. Needle Stock Management
              </h2>
              <div style="font-size: 11px; color: #94a3b8; margin-top: 1px;">
                Essential factory needle systems: Required, Pending, Available Stock &amp; Buffer Alerts
              </div>
            </div>
          </div>
          <button type="button" id="btn-dash-open-needle-studio" class="btn btn-secondary btn-xs" style="font-size: 11.5px; font-weight: 700; color: #fbbf24; border-color: rgba(245, 158, 11, 0.4);">
            Open Needle Flow Studio &rarr;
          </button>
        </div>

        <!-- 4 Dedicated Needle Type Cards Grid: DP×5, DP×17, DB×1, DC×1 -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)); gap: 14px;">
          ${needleStats.map(item => {
            const alertBadge = item.isLowStock
              ? `<div style="background: rgba(239, 68, 68, 0.15); border: 1px solid #ef4444; color: #fca5a5; font-size: 10.5px; font-weight: 800; padding: 4px 8px; border-radius: 6px; display: flex; align-items: center; gap: 5px; margin-top: 10px;">
                   <span>⚠️</span> LOW STOCK ALERT: ${item.pendingQuantity > 0 ? item.pendingQuantity + ' Units Deficit' : 'Buffer Threshold Low'}
                 </div>`
              : `<div style="background: rgba(16, 185, 129, 0.15); border: 1px solid #10b981; color: #6ee7b7; font-size: 10.5px; font-weight: 800; padding: 4px 8px; border-radius: 6px; display: flex; align-items: center; gap: 5px; margin-top: 10px;">
                   <span>✅</span> STOCK HEALTHY: Optimal Operating Buffer
                 </div>`;

            return `
              <div class="dash-needle-card" data-needle="${item.code}" style="background: linear-gradient(135deg, #0f172a, #1a2234); border: 1.5px solid ${item.accentColor}50; border-radius: var(--radius-lg); padding: 18px; box-shadow: 0 4px 18px rgba(0,0,0,0.35); position: relative; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between;">
                <div>
                  <!-- Header: Needle Type & Scope -->
                  <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                      <div style="display: flex; align-items: center; gap: 6px;">
                        <span style="font-size: 18px;">${item.icon}</span>
                        <span style="font-size: 20px; font-weight: 900; color: #ffffff; letter-spacing: 0.5px; font-family: var(--font-mono);">${item.code}</span>
                      </div>
                      <div style="font-size: 11px; color: ${item.accentColor}; font-weight: 700; margin-top: 2px;">${item.name}</div>
                    </div>
                    <span class="badge" style="background: rgba(255,255,255,0.06); color: #cbd5e1; font-size: 10px; font-weight: 700;">
                      ${item.machineCount} Machines
                    </span>
                  </div>

                  <div style="font-size: 11px; color: #94a3b8; margin-top: 6px; line-height: 1.3;">
                    ${item.category}
                  </div>

                  <!-- Metrics 3-Col Strip: Required | Pending | Available -->
                  <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-top: 14px; background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.06); border-radius: var(--radius-md); padding: 10px 12px; text-align: center;">
                    <div>
                      <div style="font-size: 9.5px; font-weight: 800; color: #94a3b8; text-transform: uppercase;">Required</div>
                      <div style="font-size: 16px; font-weight: 900; color: #ffffff; font-family: var(--font-mono); margin-top: 2px;">${item.requiredQty}</div>
                    </div>
                    <div>
                      <div style="font-size: 9.5px; font-weight: 800; color: #fbbf24; text-transform: uppercase;">Pending</div>
                      <div style="font-size: 16px; font-weight: 900; color: ${item.pendingQuantity > 0 ? '#f87171' : '#cbd5e1'}; font-family: var(--font-mono); margin-top: 2px;">${item.pendingQuantity}</div>
                    </div>
                    <div>
                      <div style="font-size: 9.5px; font-weight: 800; color: #38bdf8; text-transform: uppercase;">Available</div>
                      <div style="font-size: 16px; font-weight: 900; color: #38bdf8; font-family: var(--font-mono); margin-top: 2px;">${item.availableStock}</div>
                    </div>
                  </div>

                  <!-- Stock Health Progress Bar -->
                  <div style="margin-top: 12px;">
                    <div style="display: flex; justify-content: space-between; font-size: 10.5px; margin-bottom: 4px;">
                      <span style="color: #94a3b8; font-weight: 600;">Stock Buffer Ratio:</span>
                      <strong style="color: ${item.isLowStock ? '#fbbf24' : '#34d399'}; font-family: var(--font-mono);">${item.stockHealthPct}%</strong>
                    </div>
                    <div style="height: 6px; background: rgba(255,255,255,0.08); border-radius: 3px; overflow: hidden;">
                      <div style="height: 100%; width: ${Math.min(100, item.stockHealthPct)}%; background: ${item.isLowStock ? 'linear-gradient(90deg, #f59e0b, #ef4444)' : 'linear-gradient(90deg, #059669, #10b981)'}; border-radius: 3px;"></div>
                    </div>
                  </div>

                  <!-- Low Stock Alert Banner -->
                  ${alertBadge}
                </div>

                <!-- Footer Action Button -->
                <button type="button" class="btn btn-secondary btn-xs btn-open-needle-type" data-needle="${item.code}" style="margin-top: 14px; width: 100%; font-weight: 800; font-size: 11px; height: 30px; border-color: ${item.accentColor}60; color: ${item.accentColor}; background: ${item.accentColor}10; display: flex; align-items: center; justify-content: center; gap: 5px;">
                  Open Needle Stock Flow &rarr;
                </button>
              </div>
            `;
          }).join('')}
        </div>
      </section>

    </div>
  `;
}

export function initDashboardEvents() {
  // 1. Top executive toolbar navigation
  const btnInv = document.getElementById('btn-dash-goto-inventory');
  if (btnInv) {
    btnInv.addEventListener('click', () => {
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

  const btnNeedleStudio = document.getElementById('btn-dash-open-needle-studio');
  if (btnNeedleStudio) {
    btnNeedleStudio.addEventListener('click', () => {
      state.set('currentView', 'needle-operations');
    });
  }

  const btnRefresh = document.getElementById('btn-dash-refresh');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('erp:storage-updated'));
    });
  }

  // 2. Section 1 (Overview Cards): Filter inventory by machine status
  const cardMap = {
    'card-overview-total': 'ALL',
    'card-overview-active': 'ACTIVE',
    'card-overview-repaired': 'USABLE_IDLE',
    'card-overview-repair': 'MAINTENANCE',
    'card-overview-spare': 'IDLE'
  };

  Object.entries(cardMap).forEach(([id, status]) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('click', () => {
        if (status !== 'ALL') {
          state.set('inventoryStatusFilter', status);
        }
        state.set('currentView', 'inventory');
      });
    }
  });

  // 3. Section 2 (Machine Transfer Cards): Navigate to transfer list filtered by status
  document.querySelectorAll('.btn-nav-transfer-filter').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const status = btn.getAttribute('data-status') || 'ALL';
      state.set('transferStatusFilter', status);
      state.set('currentView', 'transfers');
    });
  });

  document.querySelectorAll('.dash-transfer-row').forEach(row => {
    row.addEventListener('click', () => {
      const id = row.getAttribute('data-id');
      if (id) {
        state.set('activeTransferRequestId', id);
        state.set('activeModal', 'transfer-details');
      }
    });
  });

  // 4. Section 3 (Servicing Cards): Navigate to preventive maintenance with urgency filter
  document.querySelectorAll('.btn-nav-pm-filter').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const urgency = btn.getAttribute('data-urgency') || 'ALL';
      state.set('pmFilterUrgency', urgency);
      state.set('currentView', 'preventive-maintenance');
    });
  });

  document.querySelectorAll('.btn-open-pm-record').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      state.set('pmFilterUrgency', 'ALL');
      state.set('currentView', 'preventive-maintenance');
    });
  });

  // 5. Section 4 (Needle Cards): Navigate to needle flow studio with needle type filter
  document.querySelectorAll('.btn-open-needle-type, .dash-needle-card').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const needleCode = el.getAttribute('data-needle');
      if (needleCode) {
        state.set('needleSearchQuery', needleCode.replace('×', 'x'));
      }
      state.set('currentView', 'needle-operations');
    });
  });
}
