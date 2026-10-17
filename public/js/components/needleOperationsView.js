/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Machine Operation -> Needle Flow (Usage & Adjustment) Component
 * 
 * Features:
 * - Machine Selection from Inventory with auto-fill of Machine Name, Brand, Model, Group, Unit, Floor, Line, and Specs
 * - Auto-fill of Needle Brand, Type/Size, and Required Needle from Master Storage & Rules
 * - Real-time Plus/Minus calculation: deducting used/broken needles and increasing returned/added needles
 * - Bi-directional real-time synchronization with Relocate & Verify PRESENT Needle
 * - Floor-wise and Line-wise tracking of Required, Present, Issued, Used, Returned, and Balance
 * - Full Transaction Audit History with Unique Transaction IDs and Excel export
 * - Validation guards preventing unauthorized negative balances
 */

import { storage } from '../db/storage.js';
import { TABLE_NAMES } from '../db/schema.js';
import { masterDataService } from '../services/masterDataService.js';
import { needleService } from '../services/needleService.js';
import { notificationService } from '../services/notificationService.js';
import { authService } from '../services/authService.js';
import { state } from '../state.js';
import { renderQrScannerModal, initQrScannerModalEvents } from './qrScannerModal.js';

let activeTransactionModalOpen = false;
let selectedMachineId = '';
let smartMachineSearchQuery = '';
let filterFloorId = 'ALL';
let filterLineId = 'ALL';
let filterActionType = 'ALL';
let searchQuery = '';
let txActionType = 'USAGE_REPLACE'; // 'USAGE_REPLACE' | 'USAGE_CONSUMED' | 'ADD_INSTALLED' | 'RETURN_STORE' | 'BALANCE_ADJUST'
let txQuantity = 1;
let floorOverviewCollapsed = true; // Default collapsed to maximize workspace table area

export function renderNeedleOperationsView() {
  const needleQ = state.get('needleSearchQuery');
  if (needleQ !== undefined && needleQ !== null) {
    searchQuery = needleQ;
    state.set('needleSearchQuery', null);
  }

  const allMachines = storage.getTable(TABLE_NAMES.MACHINES) || [];
  const floors = masterDataService.getFloors() || [];
  const units = masterDataService.getUnits() || [];
  const transactions = needleService.getAllTransactions() || [];

  // Filter transactions
  const filteredTx = transactions.filter(tx => {
    if (filterFloorId !== 'ALL' && tx.floorId !== filterFloorId) return false;
    if (filterLineId !== 'ALL' && tx.lineId !== filterLineId) return false;
    if (filterActionType !== 'ALL' && tx.actionType !== filterActionType) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchSerial = (tx.serialNumber || '').toLowerCase().includes(q);
      const matchModel = (tx.modelStr || '').toLowerCase().includes(q);
      const matchTech = (tx.technician || '').toLowerCase().includes(q);
      const matchIssuer = (tx.needleIssuer || '').toLowerCase().includes(q);
      const matchTx = (tx.txId || '').toLowerCase().includes(q);
      const matchMName = (tx.machineNameStr || '').toLowerCase().includes(q);
      if (!matchSerial && !matchModel && !matchTech && !matchIssuer && !matchTx && !matchMName) return false;
    }
    return true;
  });

  // Calculate Overall Live Stats
  let totalUsed = 0;
  let totalAdded = 0;
  let totalReturned = 0;
  transactions.forEach(t => {
    const q = Number(t.quantity) || 0;
    if (t.actionType === 'USAGE_REPLACE' || t.actionType === 'USAGE_CONSUMED') totalUsed += q;
    if (t.actionType === 'ADD_INSTALLED') totalAdded += q;
    if (t.actionType === 'RETURN_STORE') totalReturned += q;
  });

  // Available lines for filter if floor is chosen
  const filterLines = filterFloorId !== 'ALL' ? masterDataService.getLines(filterFloorId) : [];

  return `
    <div class="page-view needle-ops-root" id="needle-ops-page-root" style="padding: 8px 12px 20px 12px; display: flex; flex-direction: column; gap: 8px; height: 100%; overflow-y: auto; box-sizing: border-box; font-family: var(--font-main);">
      
      <!-- Top Header & Primary Navigation Bar (Ultra-Compact & Space Efficient) -->
      <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 6px 12px; display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; min-height: 38px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="font-size: 16px; background: rgba(56, 189, 248, 0.12); border: 1px solid #38bdf8; border-radius: 6px; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            🪡
          </div>
          <div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <h1 style="font-size: 14px; font-weight: 800; color: #fff; margin: 0; line-height: 1.1;">
                Needle Flow Studio
              </h1>
              <span class="badge badge-active" style="font-size: 9px; padding: 1px 6px; font-weight: 800;">Real-Time Sync</span>
            </div>
            <div style="font-size: 10px; color: #38bdf8; margin-top: 1px; line-height: 1.1;">
              Machine Operation &bull; Plus/Minus Balance Tracking &bull; Relocate &amp; Verify Integration
            </div>
          </div>
        </div>

        <!-- Quick Top Action Buttons -->
        <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
          <button type="button" id="btn-open-needle-tx-modal" class="btn btn-primary btn-sm" style="font-weight: 800; font-size: 11.5px; padding: 4px 12px; height: 30px; background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); border-color: #38bdf8; display: inline-flex; align-items: center; gap: 5px; box-shadow: 0 2px 8px rgba(2, 132, 199, 0.35);">
            <span>➕</span> New Needle Entry
          </button>
          <button type="button" id="btn-sync-needle-master-now" class="btn btn-secondary btn-sm" style="font-weight: 700; font-size: 11px; padding: 4px 10px; height: 30px; border: 1px solid #38bdf8; color: #38bdf8; background: rgba(56, 189, 248, 0.08); display: inline-flex; align-items: center; gap: 4px;" title="Synchronize Needle Master specifications with all inventory machines">
            <span>🔄</span> Sync Needle Master
          </button>
          <button type="button" id="btn-nav-goto-storage-needle" class="btn btn-secondary btn-sm" style="font-weight: 700; font-size: 11px; padding: 4px 10px; height: 30px; border: 1px solid #a855f7; color: #c084fc; background: rgba(168, 85, 247, 0.08); display: inline-flex; align-items: center; gap: 4px;" title="Open Master Storage & Rules to manage Machine Models and Needle Requirements">
            <span>📦</span> Needle Master Setup
          </button>
          <button type="button" id="btn-export-needle-ops-excel" class="btn btn-secondary btn-sm" style="font-weight: 700; font-size: 11px; padding: 4px 10px; height: 30px; border: 1px solid #10b981; color: #34d399; background: rgba(16, 185, 129, 0.08); display: inline-flex; align-items: center; gap: 4px;">
            <span>📊</span> Export Excel
          </button>
          <button type="button" id="btn-nav-goto-relocate-needle" class="btn btn-ghost btn-sm" style="font-weight: 700; font-size: 11px; padding: 4px 10px; height: 30px; border: 1px solid rgba(255,255,255,0.15); color: #cbd5e1; display: inline-flex; align-items: center; gap: 4px;" title="Open Relocate & Verify Needle Tracker">
            <span>📍</span> Relocate &amp; Verify
          </button>
        </div>
      </div>

      <!-- Live Metric Summary KPI Cards (Compact & High-Density) -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 6px;">
        <div style="background: var(--bg-surface); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 6px; padding: 6px 10px; display: flex; align-items: center; justify-content: space-between; gap: 6px;">
          <div>
            <div style="font-size: 9.5px; color: var(--text-secondary); text-transform: uppercase; font-weight: 800;">Machines Tracked</div>
            <div style="font-size: 17px; font-weight: 900; color: #fff; font-family: var(--font-mono); line-height: 1.1; margin-top: 1px;">
              ${allMachines.length}
            </div>
            <div style="font-size: 9.5px; color: #38bdf8;">In Production Inventory</div>
          </div>
          <span style="font-size: 18px; opacity: 0.85;">🧵</span>
        </div>

        <div style="background: var(--bg-surface); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: 6px; padding: 6px 10px; display: flex; align-items: center; justify-content: space-between; gap: 6px;">
          <div>
            <div style="font-size: 9.5px; color: var(--text-secondary); text-transform: uppercase; font-weight: 800;">Needles Used / Broken</div>
            <div style="font-size: 17px; font-weight: 900; color: #f87171; font-family: var(--font-mono); line-height: 1.1; margin-top: 1px;">
              ${totalUsed} <span style="font-size: 10px; font-weight: 600; color: #cbd5e1;">Pcs</span>
            </div>
            <div style="font-size: 9.5px; color: #f87171;">Deducted / Consumed</div>
          </div>
          <span style="font-size: 18px; opacity: 0.85;">⚠️</span>
        </div>

        <div style="background: var(--bg-surface); border: 1px solid rgba(52, 211, 153, 0.25); border-radius: 6px; padding: 6px 10px; display: flex; align-items: center; justify-content: space-between; gap: 6px;">
          <div>
            <div style="font-size: 9.5px; color: var(--text-secondary); text-transform: uppercase; font-weight: 800;">Added / Installed</div>
            <div style="font-size: 17px; font-weight: 900; color: #34d399; font-family: var(--font-mono); line-height: 1.1; margin-top: 1px;">
              ${totalAdded} <span style="font-size: 10px; font-weight: 600; color: #cbd5e1;">Pcs</span>
            </div>
            <div style="font-size: 9.5px; color: #34d399;">Added from Store</div>
          </div>
          <span style="font-size: 18px; opacity: 0.85;">📥</span>
        </div>

        <div style="background: var(--bg-surface); border: 1.5px solid rgba(251, 191, 36, 0.4); border-radius: 6px; padding: 6px 10px; display: flex; align-items: center; justify-content: space-between; gap: 6px; box-shadow: 0 0 10px rgba(251, 191, 36, 0.08);">
          <div>
            <div style="font-size: 9.5px; color: #fbbf24; text-transform: uppercase; font-weight: 800;">Returned to Store (Needle Issuer)</div>
            <div style="font-size: 17px; font-weight: 900; color: #fbbf24; font-family: var(--font-mono); line-height: 1.1; margin-top: 1px;">
              ${totalReturned} <span style="font-size: 10px; font-weight: 600; color: #cbd5e1;">Pcs</span>
            </div>
            <div style="font-size: 9.5px; color: #fbbf24;">Unused / Store Inflow</div>
          </div>
          <span style="font-size: 18px; opacity: 0.85;">🔄</span>
        </div>

        <div style="background: var(--bg-surface); border: 1px solid rgba(168, 85, 247, 0.25); border-radius: 6px; padding: 6px 10px; display: flex; align-items: center; justify-content: space-between; gap: 6px;">
          <div>
            <div style="font-size: 9.5px; color: var(--text-secondary); text-transform: uppercase; font-weight: 800;">Total Transactions</div>
            <div style="font-size: 17px; font-weight: 900; color: #c084fc; font-family: var(--font-mono); line-height: 1.1; margin-top: 1px;">
              ${transactions.length}
            </div>
            <div style="font-size: 9.5px; color: #c084fc;">Logged Audit Entries</div>
          </div>
          <span style="font-size: 18px; opacity: 0.85;">📜</span>
        </div>
      </div>

      <!-- Floor Balance Overview (Space-Saving Collapsible) -->
      <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 6px 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 13px;">🏢</span>
            <span style="font-size: 12px; font-weight: 800; color: #fff;">Floor-wise Needle Balance Overview</span>
            <span class="badge" style="background: rgba(56, 189, 248, 0.1); color: #38bdf8; font-size: 10px; padding: 1px 6px;">${floors.length} Floors</span>
          </div>
          <button type="button" id="btn-toggle-floor-overview" class="btn btn-ghost btn-sm" style="font-size: 10.5px; font-weight: 700; padding: 2px 8px; color: #38bdf8; border: 1px solid rgba(56,189,248,0.25); display: inline-flex; align-items: center; gap: 4px;">
            ${floorOverviewCollapsed ? '👁️ Show Floor Details ▾' : '▴ Hide Floor Details'}
          </button>
        </div>

        ${!floorOverviewCollapsed ? `
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 6px; margin-top: 6px;">
            ${floors.slice(0, 8).map(flr => {
              const metrics = needleService.getFloorNeedleMetrics(flr.id);
              const isShort = metrics.shortageExcess < 0;
              return `
                <div style="background: rgba(0,0,0,0.25); border: 1px solid ${isShort ? 'rgba(239,68,68,0.3)' : 'rgba(56,189,248,0.2)'}; border-radius: 6px; padding: 6px 10px; display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <div style="font-weight: 800; font-size: 11.5px; color: #fff;">${flr.name}</div>
                    <div style="font-size: 9.5px; color: var(--text-muted); margin-top: 1px;">
                      Req: <strong style="color: #cbd5e1;">${metrics.requiredQuantity}</strong> &bull; Present: <strong style="color: #38bdf8;">${metrics.presentQuantity}</strong>
                    </div>
                  </div>
                  <div style="text-align: right;">
                    <span class="badge ${isShort ? 'badge-danger' : 'badge-active'}" style="font-size: 9.5px; font-weight: 800;">
                      ${isShort ? `${metrics.shortageExcess} Short` : `+${metrics.shortageExcess} Balanced`}
                    </span>
                    <div style="font-size: 9.5px; color: var(--text-secondary); margin-top: 1px;">
                      Stock: <strong>${metrics.balanceQuantity}</strong>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        ` : `
          <!-- Compact Single-Row Horizontal Preview Strip When Collapsed (Zero Space Waste) -->
          <div style="display: flex; gap: 6px; overflow-x: auto; padding-top: 4px; padding-bottom: 2px;">
            ${floors.slice(0, 8).map(flr => {
              const metrics = needleService.getFloorNeedleMetrics(flr.id);
              const isShort = metrics.shortageExcess < 0;
              return `
                <div style="background: rgba(0,0,0,0.25); border: 1px solid ${isShort ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.08)'}; border-radius: 6px; padding: 2px 7px; font-size: 10.5px; white-space: nowrap; display: inline-flex; align-items: center; gap: 5px;">
                  <strong style="color: #fff;">${flr.name}:</strong>
                  <span style="color: #38bdf8; font-weight: 700;">${metrics.presentQuantity} Prs</span>
                  <span class="badge ${isShort ? 'badge-danger' : 'badge-active'}" style="font-size: 9px; padding: 0 4px;">
                    ${isShort ? `${metrics.shortageExcess}` : `+${metrics.shortageExcess}`}
                  </span>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>

      <!-- Filters & Transaction History Section -->
      <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; flex: 1; min-height: 0;">
        
        <!-- Filter Bar -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
          <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap; flex: 1;">
            
            <!-- Search Input -->
            <div style="min-width: 200px; flex: 1; max-width: 280px;">
              <input 
                type="text" 
                id="inp-needle-ops-search" 
                class="form-control" 
                placeholder="🔍 Search Serial, Model, Tx ID..." 
                value="${searchQuery}" 
                style="font-size: 12px; padding: 6px 10px;"
              />
            </div>

            <!-- Floor Filter -->
            <select id="sel-needle-ops-floor" class="form-control" style="font-size: 12px; padding: 6px 10px; width: auto; font-weight: 700;">
              <option value="ALL" ${filterFloorId === 'ALL' ? 'selected' : ''}>🏢 All Production Floors</option>
              ${floors.map(f => `<option value="${f.id}" ${filterFloorId === f.id ? 'selected' : ''}>${f.name}</option>`).join('')}
            </select>

            <!-- Line Filter (if floor selected) -->
            ${filterFloorId !== 'ALL' ? `
              <select id="sel-needle-ops-line" class="form-control" style="font-size: 12px; padding: 6px 10px; width: auto; font-weight: 700;">
                <option value="ALL" ${filterLineId === 'ALL' ? 'selected' : ''}>📍 All Lines</option>
                ${filterLines.map(l => `<option value="${l.id}" ${filterLineId === l.id ? 'selected' : ''}>${l.name}</option>`).join('')}
              </select>
            ` : ''}

            <!-- Action Type Filter -->
            <select id="sel-needle-ops-action" class="form-control" style="font-size: 12px; padding: 6px 10px; width: auto; font-weight: 700;">
              <option value="ALL" ${filterActionType === 'ALL' ? 'selected' : ''}>⚙️ All Action Types</option>
              <option value="USAGE_REPLACE" ${filterActionType === 'USAGE_REPLACE' ? 'selected' : ''}>Breakage &amp; Replace</option>
              <option value="USAGE_CONSUMED" ${filterActionType === 'USAGE_CONSUMED' ? 'selected' : ''}>Used / Broken (-)</option>
              <option value="ADD_INSTALLED" ${filterActionType === 'ADD_INSTALLED' ? 'selected' : ''}>Added / Installed (+)</option>
              <option value="RETURN_STORE" ${filterActionType === 'RETURN_STORE' ? 'selected' : ''}>Returned to Store (Needle Issuer)</option>
              <option value="BALANCE_ADJUST" ${filterActionType === 'BALANCE_ADJUST' ? 'selected' : ''}>Calibration / Audit</option>
            </select>

          </div>

          <div style="font-size: 11px; color: var(--text-muted);">
            Showing <strong>${filteredTx.length}</strong> of ${transactions.length} records
          </div>
        </div>

        <!-- Transactions Table -->
        <div style="overflow-x: auto; flex: 1; border: 1px solid rgba(255,255,255,0.06); border-radius: var(--radius-sm); max-height: 520px;">
          <table class="table" style="width: 100%; font-size: 11.5px; border-collapse: collapse; margin: 0;">
            <thead style="background: rgba(255,255,255,0.03); position: sticky; top: 0; z-index: 2;">
              <tr style="border-bottom: 1.5px solid var(--border-color); text-align: left; color: #cbd5e1;">
                <th style="padding: 8px 10px; width: 45px; text-align: center;">#</th>
                <th style="padding: 8px 10px; width: 120px;">Tx ID</th>
                <th style="padding: 8px 10px; width: 130px;">Machine Serial</th>
                <th style="padding: 8px 10px; width: 160px;">Machine Model</th>
                <th style="padding: 8px 10px; width: 150px;">Floor &bull; Line</th>
                <th style="padding: 8px 10px; width: 130px;">Action Type</th>
                <th style="padding: 8px 10px; width: 130px;">Needle Brand / Type</th>
                <th style="padding: 8px 10px; text-align: center; width: 70px;">Req Spec</th>
                <th style="padding: 8px 10px; text-align: center; width: 75px;">Prev Bal</th>
                <th style="padding: 8px 10px; text-align: center; width: 85px;">Change</th>
                <th style="padding: 8px 10px; text-align: center; width: 80px;">Present Bal</th>
                <th style="padding: 8px 10px; width: 140px;">Technician / Issuer</th>
                <th style="padding: 8px 10px; width: 130px;">Date &amp; Time</th>
                <th style="padding: 8px 10px;">Remarks</th>
              </tr>
            </thead>
            <tbody>
              ${filteredTx.length === 0 ? `
                <tr>
                  <td colspan="14" style="text-align: center; padding: 40px 10px; color: var(--text-muted);">
                    <div style="font-size: 28px; margin-bottom: 6px;">🪡</div>
                    <div style="font-size: 13px; font-weight: 700; color: #fff;">No Needle Transactions Found</div>
                    <div style="font-size: 11px; margin-top: 2px;">Click "+ New Needle Entry / Adjustment" above to log needle usage or changes.</div>
                  </td>
                </tr>
              ` : filteredTx.map((tx, idx) => {
                let badgeClass = 'badge-idle';
                let actionLabel = tx.actionType;
                let deltaColor = '#cbd5e1';
                let deltaStr = `${tx.quantity}`;

                if (tx.actionType === 'USAGE_REPLACE') {
                  badgeClass = 'badge-maint';
                  actionLabel = '🔄 In-Line Replace';
                  deltaStr = `±${tx.quantity}`;
                  deltaColor = '#38bdf8';
                } else if (tx.actionType === 'USAGE_CONSUMED') {
                  badgeClass = 'badge-danger';
                  actionLabel = '⚠️ Broken / Used';
                  deltaStr = `-${tx.quantity}`;
                  deltaColor = '#f87171';
                } else if (tx.actionType === 'ADD_INSTALLED') {
                  badgeClass = 'badge-active';
                  actionLabel = '📥 Added / New';
                  deltaStr = `+${tx.quantity}`;
                  deltaColor = '#34d399';
                } else if (tx.actionType === 'RETURN_STORE') {
                  badgeClass = 'badge-warning';
                  actionLabel = '🔄 Store Return (Issuer)';
                  deltaStr = `-${tx.quantity}`;
                  deltaColor = '#fbbf24';
                } else if (tx.actionType === 'BALANCE_ADJUST') {
                  badgeClass = 'badge-active';
                  actionLabel = '⚖️ Audit Calibrated';
                  deltaStr = `=${tx.quantity}`;
                  deltaColor = '#c084fc';
                }

                return `
                  <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); background: ${idx % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent'};">
                    <td style="padding: 7px 10px; text-align: center; color: var(--text-muted);">${idx + 1}</td>
                    <td style="padding: 7px 10px;">
                      <span style="font-family: var(--font-mono); font-size: 11px; font-weight: 800; color: #38bdf8;">${tx.txId}</span>
                    </td>
                    <td style="padding: 7px 10px;">
                      <span style="font-family: var(--font-mono); font-weight: 900; color: #fff; background: rgba(56,189,248,0.1); border: 1px solid rgba(56,189,248,0.25); border-radius: 4px; padding: 2px 6px;">
                        ${tx.serialNumber}
                      </span>
                    </td>
                    <td style="padding: 7px 10px;">
                      <div style="font-weight: 700; color: #fff;">${tx.modelStr || 'Standard Model'}</div>
                      <div style="font-size: 10px; color: var(--text-secondary);">${tx.machineNameStr || ''}</div>
                    </td>
                    <td style="padding: 7px 10px;">
                      <div style="color: #cbd5e1; font-weight: 600;">${tx.floorStr || tx.floorId || '—'}</div>
                      <div style="font-size: 10px; color: var(--text-muted);">${tx.lineStr || tx.lineId || '—'}</div>
                    </td>
                    <td style="padding: 7px 10px;">
                      <span class="badge ${badgeClass}" style="font-size: 10px; font-weight: 700;">
                        ${actionLabel}
                      </span>
                    </td>
                    <td style="padding: 7px 10px;">
                      <div style="font-weight: 700; color: #38bdf8;">${tx.needleBrand || 'ORGAN'}</div>
                      <div style="font-size: 10.5px; font-family: monospace; color: #cbd5e1;">${tx.needleType || 'DBx1 #14'}</div>
                    </td>
                    <td style="padding: 7px 10px; text-align: center; color: var(--text-secondary); font-weight: 700;">
                      ${tx.requiredNeedles ?? 1}
                    </td>
                    <td style="padding: 7px 10px; text-align: center; color: #94a3b8; font-weight: 700;">
                      ${tx.previousBalance}
                    </td>
                    <td style="padding: 7px 10px; text-align: center; font-weight: 900; font-family: var(--font-mono); color: ${deltaColor}; font-size: 12.5px;">
                      ${deltaStr}
                    </td>
                    <td style="padding: 7px 10px; text-align: center;">
                      <strong style="color: #38bdf8; font-size: 13px; font-family: var(--font-mono); background: rgba(56,189,248,0.12); padding: 2px 7px; border-radius: 4px; border: 1px solid rgba(56,189,248,0.3);">
                        ${tx.presentBalance}
                      </strong>
                    </td>
                    <td style="padding: 7px 10px;">
                      <div style="color: #fff; font-weight: 700;">${tx.technician || 'Technician'}</div>
                      ${tx.needleIssuer ? `<div style="font-size: 10px; color: #fbbf24; font-weight: 700;">Issuer: ${tx.needleIssuer}</div>` : ''}
                      <div style="font-size: 9.5px; color: var(--text-muted);">${tx.updatedBy}</div>
                    </td>
                    <td style="padding: 7px 10px; color: var(--text-secondary); font-size: 10.5px; font-family: var(--font-mono);">
                      ${tx.date ? new Date(tx.date).toLocaleDateString() + ' ' + new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td style="padding: 7px 10px; font-size: 11px; color: #cbd5e1;">
                      ${tx.remarks ? `💬 ${tx.remarks}` : '<span style="color: var(--text-muted); font-style: italic;">None</span>'}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>

      </div>

      <!-- Transaction Modal Slot -->
      ${activeTransactionModalOpen ? renderTransactionModal() : ''}

    </div>
  `;
}

/**
 * Interactive New Needle Operation Modal
 */
function renderTransactionModal() {
  const allMachines = storage.getTable(TABLE_NAMES.MACHINES) || [];
  const selectedMachine = selectedMachineId ? needleService.getEnrichedMachine(selectedMachineId) : null;
  const spec = selectedMachine || {
    machineNameStr: '—',
    brandStr: '—',
    modelStr: '—',
    unitStr: '—',
    floorStr: '—',
    lineStr: '—',
    specNeedleBrand: 'ORGAN',
    specNeedleType: 'DBx1 #14/90',
    requiredNeedleCount: 1,
    presentNeedleCount: 1
  };

  const prevBal = selectedMachine ? selectedMachine.presentNeedleCount : 1;
  let calcNewBal = prevBal;
  if (txActionType === 'USAGE_CONSUMED' || txActionType === 'RETURN_STORE') {
    calcNewBal = Math.max(0, prevBal - txQuantity);
  } else if (txActionType === 'ADD_INSTALLED') {
    calcNewBal = prevBal + txQuantity;
  } else if (txActionType === 'BALANCE_ADJUST') {
    calcNewBal = txQuantity;
  } else {
    calcNewBal = prevBal; // USAGE_REPLACE: replaced in-line
  }

  return `
    <div class="modal-overlay" id="modal-needle-tx-overlay" style="z-index: 10050;">
      <div class="modal-dialog" style="max-width: 580px; width: 95%; max-height: 90vh; display: flex; flex-direction: column;">
        
        <!-- Modal Header -->
        <div class="modal-header" style="background: linear-gradient(135deg, #0369a1 0%, #075985 100%); border-bottom: 2px solid #38bdf8; padding: 14px 18px;">
          <div class="modal-title" style="display: flex; align-items: center; gap: 10px;">
            <div style="font-size: 22px; background: rgba(56, 189, 248, 0.2); width: 38px; height: 38px; border-radius: 8px; display: flex; align-items: center; justify-content: center; border: 1px solid #38bdf8;">
              🪡
            </div>
            <div>
              <div style="font-weight: 800; font-size: 15px; color: #fff; line-height: 1.2;">
                Record Needle Flow &amp; Adjustment
              </div>
              <div style="font-size: 11px; color: #bae6fd; margin-top: 2px;">
                Plus/Minus Balance updates instantly &amp; syncs with Relocate &amp; Verify
              </div>
            </div>
          </div>
          <button type="button" id="btn-close-needle-tx-modal" class="btn btn-ghost btn-sm" style="color: #fff; font-size: 16px;">✕</button>
        </div>

        <!-- Modal Body Form -->
        <form id="form-needle-tx-submit" class="modal-body" style="padding: 16px 18px; display: flex; flex-direction: column; gap: 12px; overflow-y: auto; flex: 1;">
          
          <!-- Smart Machine Search & Instant Auto-Fill -->
          <div class="form-group" style="position: relative;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
              <label class="form-label" style="font-weight: 800; font-size: 12px; color: #38bdf8; margin: 0; display: flex; align-items: center; gap: 6px;">
                <span>⚡ Smart Machine Search &amp; Auto-Fill</span>
                <span class="badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid #38bdf8; font-size: 9.5px; padding: 1px 6px;">Live Lookup</span>
              </label>
              ${selectedMachine ? `
                <button type="button" id="btn-clear-tx-machine" style="background: rgba(239, 68, 68, 0.18); border: 1px solid #ef4444; color: #fca5a5; font-size: 11px; cursor: pointer; padding: 2px 8px; border-radius: 4px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;" title="Clear selection to search another machine">
                  <span>✕</span> Clear &amp; Re-search
                </button>
              ` : ''}
            </div>

            <div style="display: flex; gap: 6px; align-items: center;">
              <div style="position: relative; flex: 1;">
                <input 
                  type="text" 
                  id="modal-inp-tx-machine-search" 
                  class="form-control" 
                  placeholder="🔍 Type Serial #, Barcode, Model, Brand, Line, Floor..." 
                  value="${selectedMachine ? `${selectedMachine.serialNumber} — ${spec.machineNameStr} (${spec.brandStr} ${spec.modelStr})` : (smartMachineSearchQuery || '')}" 
                  autocomplete="off"
                  style="font-size: 13.5px; font-weight: 700; border: 1.5px solid ${selectedMachine ? '#10b981' : '#38bdf8'}; padding-right: 32px; height: 42px; border-radius: 6px;"
                />
                <span style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); font-size: 14px; pointer-events: none;">
                  ${selectedMachine ? '✅' : '🔍'}
                </span>
              </div>
              <button type="button" id="btn-tx-machine-scan-qr" class="btn btn-primary" style="font-weight: 800; height: 42px; padding: 0 14px; font-size: 12.5px; display: inline-flex; align-items: center; gap: 5px; border-radius: 6px; white-space: nowrap; background: linear-gradient(135deg, #0284c7, #0369a1); border: 1.5px solid #38bdf8;" title="Scan Machine Barcode / QR Code">
                <span>📷</span> Scan QR
              </button>
            </div>

            <!-- Floating Smart Search Autocomplete Results Panel -->
            <div id="modal-tx-machine-suggestions" style="display: none; position: absolute; left: 0; right: 0; top: 100%; z-index: 1050; background: #090e1a; border: 1.5px solid #38bdf8; border-radius: 8px; max-height: 260px; overflow-y: auto; box-shadow: 0 14px 40px rgba(0,0,0,0.95); margin-top: 4px;"></div>
          </div>

          <!-- Secondary/Fallback Fast Dropdown Selector (Synced) -->
          <div class="form-group" style="margin-top: -4px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
              <span style="font-size: 10px; color: var(--text-muted); font-weight: 600;">
                Or select directly from list (${allMachines.length} machines):
              </span>
            </div>
            <select id="modal-sel-tx-machine" class="form-control" style="font-size: 11.5px; height: 32px; padding: 2px 8px; background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(255,255,255,0.15); color: #cbd5e1; border-radius: 6px;">
              <option value="">-- Choose Machine from List --</option>
              ${allMachines.map(m => {
                const en = needleService.getEnrichedMachine(m);
                return `
                  <option value="${m.id}" ${m.id === selectedMachineId ? 'selected' : ''}>
                    ${m.serialNumber} — ${en.machineNameStr || 'Machine'} | ${en.brandStr} ${en.modelStr} (${en.floorStr} / ${en.lineStr})
                  </option>
                `;
              }).join('')}
            </select>
          </div>

          <!-- AUTO ALL FILLUP MACHINE PASSPORT CARD -->
          ${selectedMachine ? `
            <div style="background: linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(11, 19, 41, 0.98) 100%); border: 1.5px solid #0284c7; border-radius: 10px; padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.5);">
              
              <!-- Header Bar: Serial Number & Machine Type & Balance Badges -->
              <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 8px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="font-size: 18px;">🧵</span>
                  <div>
                    <div style="display: flex; align-items: center; gap: 6px;">
                      <span style="font-family: var(--font-mono); font-weight: 900; font-size: 16px; color: #fff;">${spec.serialNumber}</span>
                      <span style="font-size: 10px; color: #38bdf8; background: rgba(56,189,248,0.15); border: 1px solid #38bdf8; padding: 1px 6px; border-radius: 4px; font-weight: 800;">
                        ${spec.permanentMachineId || spec.id}
                      </span>
                      <span class="badge ${spec.status === 'ACTIVE' ? 'badge-active' : 'badge-idle'}" style="font-size: 9.5px; padding: 1px 6px;">
                        ${spec.status || 'ACTIVE'}
                      </span>
                    </div>
                    <div style="font-size: 11.5px; font-weight: 700; color: #f1f5f9; margin-top: 1px;">
                      ${spec.machineNameStr} &bull; <span style="color: #38bdf8;">${spec.brandStr} ${spec.modelStr}</span>
                    </div>
                  </div>
                </div>

                <!-- Needle Balance Badges -->
                <div style="display: flex; gap: 6px; align-items: center;">
                  <span class="badge" style="background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid #10b981; font-size: 11px; font-weight: 800; padding: 3px 8px;">
                    Present: ${prevBal} Pcs
                  </span>
                  <span class="badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid #38bdf8; font-size: 11px; font-weight: 800; padding: 3px 8px;">
                    Req: ${spec.requiredNeedleCount} Pcs
                  </span>
                </div>
              </div>

              <!-- 4-Grid Information Strip (Auto-Filled Specifications) -->
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 6px; font-size: 11px;">
                <div style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.06); border-radius: 6px; padding: 5px 8px;">
                  <div style="color: var(--text-muted); font-size: 9.5px; text-transform: uppercase; font-weight: 700;">Machine Brand</div>
                  <div style="color: #fff; font-weight: 800; font-size: 12px; margin-top: 1px;">${spec.brandStr || '—'}</div>
                </div>
                <div style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.06); border-radius: 6px; padding: 5px 8px;">
                  <div style="color: var(--text-muted); font-size: 9.5px; text-transform: uppercase; font-weight: 700;">Model Number</div>
                  <div style="color: #38bdf8; font-family: var(--font-mono); font-weight: 800; font-size: 12px; margin-top: 1px;">${spec.modelStr || '—'}</div>
                </div>
                <div style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.06); border-radius: 6px; padding: 5px 8px;">
                  <div style="color: var(--text-muted); font-size: 9.5px; text-transform: uppercase; font-weight: 700;">Floor &amp; Line</div>
                  <div style="color: #fbbf24; font-weight: 800; font-size: 11.5px; margin-top: 1px;">${spec.floorStr} &bull; ${spec.lineStr}</div>
                </div>
                <div style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.06); border-radius: 6px; padding: 5px 8px;">
                  <div style="color: var(--text-muted); font-size: 9.5px; text-transform: uppercase; font-weight: 700;">Master Needle Spec</div>
                  <div style="color: #a7f3d0; font-weight: 800; font-size: 11.5px; margin-top: 1px;">${spec.specNeedleBrand} (${spec.specNeedleType})</div>
                </div>
              </div>

            </div>
          ` : `
            <div style="background: rgba(56, 189, 248, 0.04); border: 1px dashed rgba(56, 189, 248, 0.3); border-radius: 8px; padding: 12px 14px; font-size: 12px; color: #94a3b8; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 3px;">
              <span style="font-size: 20px;">🔍</span>
              <div>
                <strong style="color: #fff;">Search Machine Above to Auto-Fill All Details</strong>
              </div>
              <div style="font-size: 11px; color: var(--text-muted);">
                Type Serial #, Model, Brand, Line or Scan QR to auto-populate specifications, required needles, and current present balance.
              </div>
            </div>
          `}

          <!-- Transaction Action Type Selection -->
          <div class="form-group">
            <label class="form-label" style="font-weight: 800; font-size: 12px; color: #38bdf8;">
              Needle Operation Action: <span class="req">*</span>
            </label>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
              <label style="background: ${txActionType === 'USAGE_REPLACE' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.03)'}; border: 1px solid ${txActionType === 'USAGE_REPLACE' ? '#38bdf8' : 'rgba(255,255,255,0.1)'}; border-radius: 6px; padding: 8px 10px; cursor: pointer; display: flex; align-items: center; gap: 6px; font-size: 11.5px; color: #fff; margin: 0;">
                <input type="radio" name="tx-action-type-radio" value="USAGE_REPLACE" ${txActionType === 'USAGE_REPLACE' ? 'checked' : ''} style="accent-color: #38bdf8;" />
                <div>
                  <strong>🔄 In-Line Replace</strong>
                  <div style="font-size: 10px; color: var(--text-muted);">Broken &amp; Replaced (Floor stock -)</div>
                </div>
              </label>

              <label style="background: ${txActionType === 'USAGE_CONSUMED' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255,255,255,0.03)'}; border: 1px solid ${txActionType === 'USAGE_CONSUMED' ? '#f87171' : 'rgba(255,255,255,0.1)'}; border-radius: 6px; padding: 8px 10px; cursor: pointer; display: flex; align-items: center; gap: 6px; font-size: 11.5px; color: #fff; margin: 0;">
                <input type="radio" name="tx-action-type-radio" value="USAGE_CONSUMED" ${txActionType === 'USAGE_CONSUMED' ? 'checked' : ''} style="accent-color: #f87171;" />
                <div>
                  <strong>⚠️ Broken / Used (-)</strong>
                  <div style="font-size: 10px; color: var(--text-muted);">Machine balance drops</div>
                </div>
              </label>

              <label style="background: ${txActionType === 'ADD_INSTALLED' ? 'rgba(52, 211, 153, 0.2)' : 'rgba(255,255,255,0.03)'}; border: 1px solid ${txActionType === 'ADD_INSTALLED' ? '#34d399' : 'rgba(255,255,255,0.1)'}; border-radius: 6px; padding: 8px 10px; cursor: pointer; display: flex; align-items: center; gap: 6px; font-size: 11.5px; color: #fff; margin: 0;">
                <input type="radio" name="tx-action-type-radio" value="ADD_INSTALLED" ${txActionType === 'ADD_INSTALLED' ? 'checked' : ''} style="accent-color: #34d399;" />
                <div>
                  <strong>📥 Added / Installed (+)</strong>
                  <div style="font-size: 10px; color: var(--text-muted);">New needle added to machine</div>
                </div>
              </label>

              <label style="background: ${txActionType === 'RETURN_STORE' ? 'rgba(251, 191, 36, 0.2)' : 'rgba(255,255,255,0.03)'}; border: 1px solid ${txActionType === 'RETURN_STORE' ? '#fbbf24' : 'rgba(255,255,255,0.1)'}; border-radius: 6px; padding: 8px 10px; cursor: pointer; display: flex; align-items: center; gap: 6px; font-size: 11.5px; color: #fff; margin: 0;">
                <input type="radio" name="tx-action-type-radio" value="RETURN_STORE" ${txActionType === 'RETURN_STORE' ? 'checked' : ''} style="accent-color: #fbbf24;" />
                <div>
                  <strong>🔄 Return to Store (Needle Issuer)</strong>
                  <div style="font-size: 10px; color: var(--text-muted);">Unused needle returned to store</div>
                </div>
              </label>
            </div>
          </div>

          <!-- Quantity & Real-Time Calculation Preview -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div class="form-group">
              <label class="form-label" style="font-weight: 800; font-size: 12px; color: #38bdf8;">
                Quantity (Pcs): <span class="req">*</span>
              </label>
              <input 
                type="number" 
                id="modal-inp-tx-quantity" 
                class="form-control" 
                min="1" 
                value="${txQuantity}" 
                required 
                style="font-size: 16px; font-weight: 800; color: #38bdf8; min-height: 42px;"
              />
            </div>

            <!-- Dynamic Balance Effect Preview -->
            <div style="background: rgba(56, 189, 248, 0.08); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 6px; padding: 8px 12px; display: flex; flex-direction: column; justify-content: center;">
              <span style="font-size: 10px; color: #94a3b8; text-transform: uppercase; font-weight: 700;">Live Balance Impact</span>
              <div style="font-size: 13px; font-weight: 900; color: #fff; margin-top: 2px;">
                Prev: <span style="color: #cbd5e1;">${prevBal}</span> ➔ New: <span id="live-tx-balance-impact-new" style="color: #38bdf8; font-size: 15px;">${calcNewBal}</span>
              </div>
            </div>
          </div>

          <!-- Needle Brand & Type Inputs (Auto-populated from Master Storage & Rules) -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div class="form-group">
              <label class="form-label" style="font-size: 11.5px; color: var(--text-secondary);">Needle Brand:</label>
              <input 
                type="text" 
                id="modal-inp-tx-needle-brand" 
                class="form-control" 
                value="${spec.specNeedleBrand}" 
                placeholder="e.g. ORGAN, GROZ-BECKERT" 
                style="font-size: 13px; font-weight: 700;"
              />
            </div>

            <div class="form-group">
              <label class="form-label" style="font-size: 11.5px; color: var(--text-secondary);">Needle Type / Size:</label>
              <input 
                type="text" 
                id="modal-inp-tx-needle-type" 
                class="form-control" 
                value="${spec.specNeedleType}" 
                placeholder="e.g. DBx1 #14, DPx5 #16" 
                style="font-size: 13px; font-weight: 700;"
              />
            </div>
          </div>

          <!-- Technician & Reason/Remarks -->
          <!-- Technician & Needle Issuer & Date -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div class="form-group">
              <label class="form-label" style="font-size: 11.5px; color: var(--text-secondary);">Technician / Operator:</label>
              <input 
                type="text" 
                id="modal-inp-tx-technician" 
                class="form-control" 
                placeholder="Operator / Tech Name" 
                value="Engr. Motaher Hossain" 
                style="font-size: 13px;"
              />
            </div>

            <div class="form-group">
              <label class="form-label" style="font-size: 11.5px; color: #fbbf24; font-weight: 700;">Needle Issuer / Receiver (Store Staff):</label>
              <input 
                type="text" 
                id="modal-inp-tx-issuer" 
                class="form-control" 
                placeholder="e.g. Needle Store Keeper / Issuer Name" 
                value="" 
                style="font-size: 13px;"
              />
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div class="form-group">
              <label class="form-label" style="font-size: 11.5px; color: var(--text-secondary);">Transaction Date:</label>
              <input 
                type="date" 
                id="modal-inp-tx-date" 
                class="form-control" 
                value="${new Date().toISOString().split('T')[0]}" 
                style="font-size: 13px;"
              />
            </div>

            <div class="form-group">
              <label class="form-label" style="font-size: 11.5px; color: var(--text-secondary);">Reason / Remarks:</label>
              <input 
                type="text" 
                id="modal-inp-tx-remarks" 
                class="form-control" 
                placeholder="e.g. Returned unused needle to store issuer" 
                style="font-size: 13px;"
              />
            </div>
          </div>

          <!-- Negative Balance Warning Override (if applicable) -->
          <div id="negative-balance-alert" style="display: ${calcNewBal < 0 ? 'block' : 'none'}; background: rgba(239, 68, 68, 0.15); border: 1px solid #ef4444; border-radius: 6px; padding: 8px 12px; font-size: 11.5px; color: #fca5a5;">
            ⚠️ This action results in a negative needle balance (${calcNewBal}). Supervisor override required.
            <label style="display: flex; align-items: center; gap: 6px; margin-top: 4px; font-weight: 700; color: #fff; cursor: pointer;">
              <input type="checkbox" id="chk-allow-negative-balance" style="accent-color: #ef4444;" />
              <span>I confirm supervisor authorization for negative balance</span>
            </label>
          </div>

          <!-- Modal Footer Actions -->
          <div class="modal-footer" style="padding: 0; margin-top: 8px; display: flex; gap: 8px;">
            <button type="button" id="btn-cancel-needle-tx" class="btn btn-secondary" style="flex: 1; min-height: 42px; font-weight: 700;">
              Cancel
            </button>
            <button type="submit" id="btn-submit-needle-tx" class="btn btn-primary" style="flex: 2; min-height: 42px; font-weight: 800; font-size: 14px; background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); border-color: #38bdf8;" ${!selectedMachine ? 'disabled' : ''}>
              ✓ Save &amp; Synchronize Needle Balance
            </button>
          </div>

        </form>

      </div>
    </div>
  `;
}

/**
 * Event Controller for Needle Operations View
 */
export function initNeedleOperationsEvents() {
  const root = document.getElementById('needle-ops-page-root');
  if (!root) return;

  const refreshView = () => {
    const container = document.getElementById('main-view-container');
    if (!container) return;
    container.innerHTML = renderNeedleOperationsView();
    initNeedleOperationsEvents();
  };

  // 1. Open New Needle Entry Modal
  root.querySelector('#btn-open-needle-tx-modal')?.addEventListener('click', () => {
    activeTransactionModalOpen = true;
    refreshView();
  });

  // 2. Close Modal
  const closeModal = () => {
    activeTransactionModalOpen = false;
    smartMachineSearchQuery = '';
    refreshView();
  };
  root.querySelector('#btn-close-needle-tx-modal')?.addEventListener('click', closeModal);
  root.querySelector('#btn-cancel-needle-tx')?.addEventListener('click', closeModal);

  const overlay = root.querySelector('#modal-needle-tx-overlay');
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
  }

  // Helper: Select machine and trigger auto-fill
  const selectMachine = (machine) => {
    if (!machine) {
      selectedMachineId = '';
      smartMachineSearchQuery = '';
    } else {
      selectedMachineId = machine.id;
      smartMachineSearchQuery = '';
    }
    refreshView();
  };

  // 3a. Clear Selected Machine
  root.querySelector('#btn-clear-tx-machine')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    selectMachine(null);
    setTimeout(() => {
      const inp = document.getElementById('modal-inp-tx-machine-search');
      if (inp) inp.focus();
    }, 50);
  });

  // 3b. Smart Machine Search Input & Live Autocomplete
  const inpMachineSearch = root.querySelector('#modal-inp-tx-machine-search');
  const suggestionsBox = root.querySelector('#modal-tx-machine-suggestions');
  const allMachines = storage.getTable(TABLE_NAMES.MACHINES) || [];

  if (inpMachineSearch && suggestionsBox) {
    // Auto-focus search input when modal opens and machine is not pre-selected
    if (!selectedMachineId && activeTransactionModalOpen && window.innerWidth > 768) {
      setTimeout(() => inpMachineSearch.focus({ preventScroll: true }), 60);
    }

    inpMachineSearch.addEventListener('input', (e) => {
      const q = (e.target.value || '').trim().toLowerCase();
      smartMachineSearchQuery = e.target.value;

      if (!q) {
        suggestionsBox.style.display = 'none';
        return;
      }

      // Filter machines by Serial, ID, Asset Tag, Name, Brand, Model, Floor, Line
      const matches = allMachines.filter(m => {
        if (!m) return false;
        const en = needleService.getEnrichedMachine(m);
        const sn = String(m.serialNumber || '').toLowerCase();
        const tag = String(m.permanentMachineId || m.id || '').toLowerCase();
        const mName = String(en.machineNameStr || '').toLowerCase();
        const brd = String(en.brandStr || '').toLowerCase();
        const mdl = String(en.modelStr || '').toLowerCase();
        const flr = String(en.floorStr || '').toLowerCase();
        const lin = String(en.lineStr || '').toLowerCase();
        return sn.includes(q) || tag.includes(q) || mName.includes(q) || brd.includes(q) || mdl.includes(q) || flr.includes(q) || lin.includes(q);
      }).slice(0, 10);

      if (matches.length === 0) {
        suggestionsBox.innerHTML = `
          <div style="padding: 12px 14px; font-size: 12px; color: var(--text-muted); text-align: center;">
            No machines found matching "<strong style="color: #cbd5e1;">${e.target.value}</strong>".
          </div>
        `;
        suggestionsBox.style.display = 'block';
        return;
      }

      suggestionsBox.innerHTML = matches.map((m, idx) => {
        const en = needleService.getEnrichedMachine(m);
        return `
          <div class="machine-suggest-item" data-id="${m.id}" style="padding: 9px 12px; border-bottom: 1px solid rgba(255,255,255,0.06); cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: background 0.15s; ${idx % 2 === 0 ? 'background: rgba(255,255,255,0.02);' : ''}">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-family: var(--font-mono); font-weight: 900; color: #38bdf8; font-size: 13px; background: rgba(56,189,248,0.12); border: 1px solid rgba(56,189,248,0.3); border-radius: 4px; padding: 2px 7px;">
                ${m.serialNumber}
              </span>
              <div>
                <div style="font-weight: 800; color: #ffffff; font-size: 12px;">
                  ${en.machineNameStr || 'Machine'} &bull; <span style="color: #38bdf8;">${en.brandStr} ${en.modelStr}</span>
                </div>
                <div style="font-size: 10px; color: var(--text-muted); margin-top: 1px;">
                  📍 ${en.floorStr} &bull; ${en.lineStr} | Needle: <span style="color: #a7f3d0;">${en.specNeedleType || 'DBx1 #14'}</span>
                </div>
              </div>
            </div>
            <div style="text-align: right; flex-shrink: 0;">
              <span class="badge" style="background: rgba(16, 185, 129, 0.2); color: #34d399; font-size: 10px; font-weight: 800; border: 1px solid #10b981;">
                Present: ${en.presentNeedleCount}
              </span>
            </div>
          </div>
        `;
      }).join('');

      suggestionsBox.style.display = 'block';

      // Item click selection
      suggestionsBox.querySelectorAll('.machine-suggest-item').forEach(el => {
        el.addEventListener('click', (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          const id = el.getAttribute('data-id');
          const m = allMachines.find(x => x && x.id === id);
          if (m) {
            suggestionsBox.style.display = 'none';
            selectMachine(m);
            notificationService.success('Machine Loaded', `Loaded [${m.serialNumber}] ${m.model || ''}. All specs auto-filled.`);
          }
        });
        el.addEventListener('mouseenter', () => {
          el.style.background = 'rgba(2, 132, 199, 0.3)';
        });
        el.addEventListener('mouseleave', () => {
          el.style.background = '';
        });
      });
    });

    // Enter Key Search / Instant Pick
    inpMachineSearch.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const q = (inpMachineSearch.value || '').trim().toLowerCase();
        if (!q) return;

        // Try exact serial / ID match first
        const exact = allMachines.find(m => 
          m && (String(m.serialNumber || '').toLowerCase() === q ||
          String(m.permanentMachineId || '').toLowerCase() === q ||
          String(m.id || '').toLowerCase() === q)
        );

        if (exact) {
          suggestionsBox.style.display = 'none';
          selectMachine(exact);
          notificationService.success('Machine Loaded', `Loaded [${exact.serialNumber}]. All specs auto-filled.`);
          return;
        }

        // Partial match top candidate
        const partial = allMachines.find(m => {
          if (!m) return false;
          const en = needleService.getEnrichedMachine(m);
          return String(m.serialNumber || '').toLowerCase().includes(q) ||
            String(en.modelStr || '').toLowerCase().includes(q) ||
            String(en.brandStr || '').toLowerCase().includes(q) ||
            String(en.machineNameStr || '').toLowerCase().includes(q);
        });

        if (partial) {
          suggestionsBox.style.display = 'none';
          selectMachine(partial);
          notificationService.success('Machine Loaded', `Loaded [${partial.serialNumber}]. All specs auto-filled.`);
        } else {
          notificationService.warning('Machine Not Found', `No machine matching "${inpMachineSearch.value}".`);
        }
      }
    });

    // Close suggestions dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (suggestionsBox && !suggestionsBox.contains(e.target) && e.target !== inpMachineSearch) {
        suggestionsBox.style.display = 'none';
      }
    });
  }

  // 3c. Camera QR / Barcode Scanner Trigger
  root.querySelector('#btn-tx-machine-scan-qr')?.addEventListener('click', (e) => {
    e.preventDefault();
    let scannerSlot = document.getElementById('needle-ops-qr-scanner-slot');
    if (!scannerSlot) {
      scannerSlot = document.createElement('div');
      scannerSlot.id = 'needle-ops-qr-scanner-slot';
      document.body.appendChild(scannerSlot);
    }
    scannerSlot.innerHTML = renderQrScannerModal();
    initQrScannerModalEvents({
      onScanSuccess: (decodedText) => {
        scannerSlot.innerHTML = '';
        const cleanText = String(decodedText || '').trim().toLowerCase();
        const matched = allMachines.find(m => 
          m && (String(m.serialNumber || '').toLowerCase() === cleanText ||
          String(m.permanentMachineId || '').toLowerCase() === cleanText ||
          String(m.id || '').toLowerCase() === cleanText)
        );
        if (matched) {
          selectMachine(matched);
          notificationService.success('QR Scanned', `Machine [${matched.serialNumber}] auto-loaded.`);
        } else {
          notificationService.warning('QR Not Found', `Machine with code "${decodedText}" not found in inventory.`);
        }
      },
      onClose: () => {
        scannerSlot.innerHTML = '';
      }
    });
  });

  // 3d. Fallback Dropdown Selection Change (Synced)
  root.querySelector('#modal-sel-tx-machine')?.addEventListener('change', (e) => {
    const id = e.target.value;
    const m = allMachines.find(x => x && x.id === id);
    selectMachine(m || null);
  });

  // 4. Action Type Radio Change
  root.querySelectorAll('input[name="tx-action-type-radio"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      txActionType = e.target.value;
      refreshView();
    });
  });

  // 5. Quantity Change (Reactive Calculation)
  root.querySelector('#modal-inp-tx-quantity')?.addEventListener('input', (e) => {
    const val = Number(e.target.value);
    if (!isNaN(val) && val > 0) {
      txQuantity = val;
      const impactEl = root.querySelector('#live-tx-balance-impact-new');
      if (impactEl) {
        const selectedMachine = selectedMachineId ? needleService.getEnrichedMachine(selectedMachineId) : null;
        const prev = selectedMachine ? selectedMachine.presentNeedleCount : 1;
        let nw = prev;
        if (txActionType === 'USAGE_CONSUMED' || txActionType === 'RETURN_STORE') {
          nw = Math.max(0, prev - val);
        } else if (txActionType === 'ADD_INSTALLED') {
          nw = prev + val;
        } else if (txActionType === 'BALANCE_ADJUST') {
          nw = val;
        } else {
          nw = prev;
        }
        impactEl.textContent = nw;
      }
    }
  });

  // 6. Form Submission: Save Needle Transaction
  root.querySelector('#form-needle-tx-submit')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!selectedMachineId) {
      notificationService.warning('Please select a machine first.');
      return;
    }

    const qty = Number(root.querySelector('#modal-inp-tx-quantity')?.value) || 1;
    const needleBrand = root.querySelector('#modal-inp-tx-needle-brand')?.value || '';
    const needleType = root.querySelector('#modal-inp-tx-needle-type')?.value || '';
    const technician = root.querySelector('#modal-inp-tx-technician')?.value || '';
    const needleIssuer = root.querySelector('#modal-inp-tx-issuer')?.value || '';
    const remarks = root.querySelector('#modal-inp-tx-remarks')?.value || '';
    const dateVal = root.querySelector('#modal-inp-tx-date')?.value || null;
    const allowNegative = root.querySelector('#chk-allow-negative-balance')?.checked || false;

    try {
      const res = await needleService.recordNeedleTransaction({
        machineId: selectedMachineId,
        actionType: txActionType,
        quantity: qty,
        needleBrand,
        needleType,
        remarks,
        technician,
        needleIssuer,
        customDate: dateVal,
        allowNegative
      });

      notificationService.success(
        'Needle Transaction Saved',
        `Updated [${res.transaction.serialNumber}] Present Needle to ${res.newPresentBalance}.`
      );

      activeTransactionModalOpen = false;
      selectedMachineId = '';
      smartMachineSearchQuery = '';
      refreshView();
    } catch (err) {
      notificationService.error('Save Failed', err.message || err);
    }
  });

  // 7. Filter Controls
  root.querySelector('#sel-needle-ops-floor')?.addEventListener('change', (e) => {
    filterFloorId = e.target.value;
    filterLineId = 'ALL';
    refreshView();
  });

  root.querySelector('#sel-needle-ops-line')?.addEventListener('change', (e) => {
    filterLineId = e.target.value;
    refreshView();
  });

  root.querySelector('#sel-needle-ops-action')?.addEventListener('change', (e) => {
    filterActionType = e.target.value;
    refreshView();
  });

  root.querySelector('#inp-needle-ops-search')?.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    refreshView();
  });

  // Toggle Floor Overview collapse/expand
  root.querySelector('#btn-toggle-floor-overview')?.addEventListener('click', () => {
    floorOverviewCollapsed = !floorOverviewCollapsed;
    refreshView();
  });

  // 8. Excel Export
  root.querySelector('#btn-export-needle-ops-excel')?.addEventListener('click', () => {
    needleService.exportNeedleReportToExcel({
      floorId: filterFloorId !== 'ALL' ? filterFloorId : null,
      lineId: filterLineId !== 'ALL' ? filterLineId : null
    });
  });

  // 9. Quick Link to Relocate & Verify
  root.querySelector('#btn-nav-goto-relocate-needle')?.addEventListener('click', () => {
    state.set('currentView', 'relocate');
  });

  // 10. Sync Needle Master to Inventory Machines
  root.querySelector('#btn-sync-needle-master-now')?.addEventListener('click', async () => {
    try {
      const res = await needleService.syncNeedleMasterToInventory({ syncPresentNeedlesIfDefault: false });
      notificationService.success(
        'Needle Master Synchronized',
        `Successfully updated ${res.updatedCount} machine(s) across inventory with Master specifications.`
      );
      refreshView();
    } catch (err) {
      notificationService.error('Sync Failed', err.message || err);
    }
  });

  // 11. Navigate to Master Storage & Rules (Needle Master Setup)
  root.querySelector('#btn-nav-goto-storage-needle')?.addEventListener('click', () => {
    state.set('currentView', 'storage');
  });
}
