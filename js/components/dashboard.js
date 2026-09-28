/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Dashboard & Analytics Component - Physical Machine Distribution Breakdown
 */

import { storage } from '../db/storage.js';
import { TABLE_NAMES } from '../db/schema.js';
import { authService } from '../services/authService.js';
import { approvalService } from '../services/approvalService.js';
import { transferService } from '../services/transferService.js';
import { state } from '../state.js';

export function renderDashboard() {
  const scopedFilter = authService.getScopedFilter();
  let machines = storage.getTable(TABLE_NAMES.MACHINES);

  // Apply location scoping
  if (scopedFilter) {
    if (scopedFilter.unitIds?.length > 0) machines = machines.filter(m => scopedFilter.unitIds.includes(m.unitId));
    if (scopedFilter.floorIds?.length > 0) machines = machines.filter(m => scopedFilter.floorIds.includes(m.floorId));
    if (scopedFilter.lineIds?.length > 0) machines = machines.filter(m => scopedFilter.lineIds.includes(m.lineId));
  }

  const totalMachines = machines.length;
  const activeCount = machines.filter(m => m.status === 'ACTIVE').length;
  const maintCount = machines.filter(m => m.status === 'MAINTENANCE' || m.status === 'UNDER_MAINTENANCE').length;
  const breakdownCount = machines.filter(m => m.status === 'BREAKDOWN').length;
  const idleCount = machines.filter(m => m.status === 'IDLE').length;
  const pendingApprovals = (approvalService.getPendingCount() || 0) + (transferService.getPendingCount() || 0);

  const mnMap = new Map(storage.getTable(TABLE_NAMES.MACHINE_NAMES).map(x => [x.id, x.name]));
  const brdMap = new Map(storage.getTable(TABLE_NAMES.BRANDS).map(x => [x.id, x.name]));
  const mdlMap = new Map(storage.getTable(TABLE_NAMES.MODELS).map(x => [x.id, x.name]));
  const untMap = new Map(storage.getTable(TABLE_NAMES.UNITS).map(x => [x.id, x.name]));

  // 1. Machine Name-wise counts
  const mnCounts = {};
  machines.forEach(m => {
    const name = mnMap.get(m.machineNameId) || 'Other';
    mnCounts[name] = (mnCounts[name] || 0) + 1;
  });

  // 2. Brand-wise counts
  const brandCounts = {};
  machines.forEach(m => {
    const brand = brdMap.get(m.brandId) || 'Other';
    brandCounts[brand] = (brandCounts[brand] || 0) + 1;
  });

  // 3. Model-wise counts
  const modelCounts = {};
  machines.forEach(m => {
    const model = mdlMap.get(m.modelId) || 'Other';
    modelCounts[model] = (modelCounts[model] || 0) + 1;
  });

  // 4. Factory Unit-wise counts
  const unitCounts = {};
  machines.forEach(m => {
    const unit = untMap.get(m.unitId) || 'Other';
    unitCounts[unit] = (unitCounts[unit] || 0) + 1;
  });

  return `
    <div class="page-view">
      <!-- Title Bar -->
      <div class="view-header-row" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
        <div style="min-width: 0; flex: 1;">
          <h1 style="font-size: 20px; font-weight: 800; color: #fff; margin: 0 0 4px 0; word-break: break-word;">📊 Central Maintenance KPI & Equipment Analytics</h1>
          <p style="font-size: 12px; color: var(--text-secondary); margin: 0;">
            Real-time physical asset health across Groups, Factories, Floors, and Production Lines.
          </p>
        </div>
        <div class="view-header-actions" style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button id="btn-dash-inventory" class="btn btn-primary btn-sm">🧵 Open Inventory Grid</button>
        </div>
      </div>

      <!-- Top Primary Metric Cards -->
      <div class="kpi-grid">
        <div class="kpi-card">
          <div>
            <div class="kpi-value">${totalMachines}</div>
            <div class="kpi-label">Total Physical Machines</div>
          </div>
          <div class="kpi-icon-badge">🏭</div>
        </div>

        <div class="kpi-card" style="border-left: 3px solid var(--success);">
          <div>
            <div class="kpi-value" style="color: #34d399;">${activeCount}</div>
            <div class="kpi-label">Active Operational</div>
          </div>
          <div class="kpi-icon-badge" style="color: #34d399;">🟢</div>
        </div>

        <div class="kpi-card" style="border-left: 3px solid var(--warning);">
          <div>
            <div class="kpi-value" style="color: #fbbf24;">${maintCount}</div>
            <div class="kpi-label">Under Maintenance</div>
          </div>
          <div class="kpi-icon-badge" style="color: #fbbf24;">🟡</div>
        </div>

        <div class="kpi-card" style="border-left: 3px solid var(--danger);">
          <div>
            <div class="kpi-value" style="color: #f87171;">${breakdownCount}</div>
            <div class="kpi-label">Machine Breakdowns</div>
          </div>
          <div class="kpi-icon-badge" style="color: #f87171;">🔴</div>
        </div>

        <div class="kpi-card" style="border-left: 3px solid var(--info);">
          <div>
            <div class="kpi-value" style="color: #c084fc;">${pendingApprovals}</div>
            <div class="kpi-label">Pending Approvals</div>
          </div>
          <div class="kpi-icon-badge" style="color: #c084fc;">🛡️</div>
        </div>
      </div>

      <!-- Equipment Distribution Breakdown Grid -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); gap: 14px;">
        <!-- Card 1: Machine Name-wise Distribution -->
        <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 18px;">
          <h3 style="font-size: 15px; font-weight: 700; color: #38bdf8; margin-bottom: 12px; display: flex; justify-content: space-between;">
            <span>🧵 Machine Name Distribution</span>
            <span style="font-size: 12px; color: var(--text-muted);">${Object.keys(mnCounts).length} Types</span>
          </h3>
          <div style="display: flex; flex-direction: column; gap: 8px; max-height: 240px; overflow-y: auto;">
            ${Object.entries(mnCounts).sort((a, b) => b[1] - a[1]).map(([name, count]) => {
              const pct = Math.round((count / totalMachines) * 100) || 0;
              return `
                <div>
                  <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 3px;">
                    <span style="font-weight: 600; color: var(--text-primary);">${name}</span>
                    <strong style="color: #38bdf8;">${count} units (${pct}%)</strong>
                  </div>
                  <div style="height: 6px; background: var(--bg-card); border-radius: 3px; overflow: hidden;">
                    <div style="height: 100%; width: ${pct}%; background: #0284c7; border-radius: 3px;"></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Card 2: Brand-wise Distribution -->
        <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 18px;">
          <h3 style="font-size: 15px; font-weight: 700; color: #34d399; margin-bottom: 12px; display: flex; justify-content: space-between;">
            <span>🏷️ Brand Distribution</span>
            <span style="font-size: 12px; color: var(--text-muted);">${Object.keys(brandCounts).length} Brands</span>
          </h3>
          <div style="display: flex; flex-direction: column; gap: 8px; max-height: 240px; overflow-y: auto;">
            ${Object.entries(brandCounts).sort((a, b) => b[1] - a[1]).map(([brand, count]) => {
              const pct = Math.round((count / totalMachines) * 100) || 0;
              return `
                <div>
                  <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 3px;">
                    <span style="font-weight: 600; color: var(--text-primary);">${brand}</span>
                    <strong style="color: #34d399;">${count} units (${pct}%)</strong>
                  </div>
                  <div style="height: 6px; background: var(--bg-card); border-radius: 3px; overflow: hidden;">
                    <div style="height: 100%; width: ${pct}%; background: #10b981; border-radius: 3px;"></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Card 3: Top Model Distribution -->
        <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 18px;">
          <h3 style="font-size: 15px; font-weight: 700; color: #c084fc; margin-bottom: 12px; display: flex; justify-content: space-between;">
            <span>⚙️ Top Model Distribution</span>
            <span style="font-size: 12px; color: var(--text-muted);">${Object.keys(modelCounts).length} Models</span>
          </h3>
          <div style="display: flex; flex-direction: column; gap: 8px; max-height: 240px; overflow-y: auto;">
            ${Object.entries(modelCounts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([model, count]) => {
              const pct = Math.round((count / totalMachines) * 100) || 0;
              return `
                <div>
                  <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 3px;">
                    <span style="font-weight: 600; color: var(--text-primary);">${model}</span>
                    <strong style="color: #c084fc;">${count} units (${pct}%)</strong>
                  </div>
                  <div style="height: 6px; background: var(--bg-card); border-radius: 3px; overflow: hidden;">
                    <div style="height: 100%; width: ${pct}%; background: #a855f7; border-radius: 3px;"></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Card 4: Factory Unit Breakdown -->
        <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 18px;">
          <h3 style="font-size: 15px; font-weight: 700; color: #fbbf24; margin-bottom: 12px; display: flex; justify-content: space-between;">
            <span>🏢 Factory Unit Breakdown</span>
            <span style="font-size: 12px; color: var(--text-muted);">${Object.keys(unitCounts).length} Units</span>
          </h3>
          <div style="display: flex; flex-direction: column; gap: 8px; max-height: 240px; overflow-y: auto;">
            ${Object.entries(unitCounts).sort((a, b) => b[1] - a[1]).map(([unit, count]) => {
              const pct = Math.round((count / totalMachines) * 100) || 0;
              return `
                <div>
                  <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 3px;">
                    <span style="font-weight: 600; color: var(--text-primary);">${unit}</span>
                    <strong style="color: #fbbf24;">${count} units (${pct}%)</strong>
                  </div>
                  <div style="height: 6px; background: var(--bg-card); border-radius: 3px; overflow: hidden;">
                    <div style="height: 100%; width: ${pct}%; background: #f59e0b; border-radius: 3px;"></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
}

export function initDashboardEvents() {
  const btnInv = document.getElementById('btn-dash-inventory');
  if (btnInv) {
    btnInv.addEventListener('click', () => {
      state.set('currentView', 'inventory');
    });
  }
}
