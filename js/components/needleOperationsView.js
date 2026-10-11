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

let activeTransactionModalOpen = false;
let selectedMachineId = '';
let filterFloorId = 'ALL';
let filterLineId = 'ALL';
let filterActionType = 'ALL';
let searchQuery = '';
let txActionType = 'USAGE_REPLACE'; // 'USAGE_REPLACE' | 'USAGE_CONSUMED' | 'ADD_INSTALLED' | 'RETURN_STORE' | 'BALANCE_ADJUST'
let txQuantity = 1;

export function renderNeedleOperationsView() {
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
      const matchTx = (tx.txId || '').toLowerCase().includes(q);
      const matchMName = (tx.machineNameStr || '').toLowerCase().includes(q);
      if (!matchSerial && !matchModel && !matchTech && !matchTx && !matchMName) return false;
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
    <div class="page-view needle-ops-root" id="needle-ops-page-root" style="padding: 10px 14px 24px 14px; display: flex; flex-direction: column; gap: 10px; height: 100%; overflow-y: auto; box-sizing: border-box; font-family: var(--font-main);">
      
      <!-- Top Header & Primary Navigation Card -->
      <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 10px 16px; display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="font-size: 22px; background: rgba(56, 189, 248, 0.12); border: 1px solid #38bdf8; border-radius: 8px; width: 38px; height: 38px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            🪡
          </div>
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <h1 style="font-size: 16px; font-weight: 800; color: #fff; margin: 0; letter-spacing: -0.2px;">
                Needle Flow Studio
              </h1>
              <span class="badge badge-active" style="font-size: 10px; font-weight: 800;">Real-Time Sync</span>
            </div>
            <div style="font-size: 11px; color: #38bdf8; margin-top: 2px;">
              Machine Operation &bull; Plus/Minus Balance Tracking &bull; Relocate &amp; Verify Integration
            </div>
          </div>
        </div>

        <!-- Quick Top Action Buttons -->
        <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
          <button type="button" id="btn-open-needle-tx-modal" class="btn btn-primary btn-sm" style="font-weight: 800; font-size: 12px; padding: 6px 14px; background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); border-color: #38bdf8; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 10px rgba(2, 132, 199, 0.4);">
            <span>➕</span> New Needle Entry / Adjustment
          </button>
          <button type="button" id="btn-export-needle-ops-excel" class="btn btn-secondary btn-sm" style="font-weight: 700; font-size: 12px; padding: 6px 12px; border: 1px solid #10b981; color: #34d399; background: rgba(16, 185, 129, 0.08); display: inline-flex; align-items: center; gap: 5px;">
            <span>📊</span> Export Excel Report
          </button>
          <button type="button" id="btn-nav-goto-relocate-needle" class="btn btn-ghost btn-sm" style="font-weight: 700; font-size: 11.5px; border: 1px solid rgba(255,255,255,0.15); color: #cbd5e1; display: inline-flex; align-items: center; gap: 5px;" title="Open Relocate & Verify Needle Tracker">
            <span>📍</span> Relocate &amp; Verify
          </button>
        </div>
      </div>

      <!-- Live Metric Summary KPI Cards -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px;">
        <div style="background: var(--bg-surface); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: var(--radius-md); padding: 10px 14px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase; font-weight: 700;">Machines Tracked</span>
            <span style="font-size: 16px;">🧵</span>
          </div>
          <div style="font-size: 22px; font-weight: 900; color: #fff; font-family: var(--font-mono); margin-top: 4px;">
            ${allMachines.length}
          </div>
          <div style="font-size: 10.5px; color: #38bdf8; margin-top: 2px;">In Production Inventory</div>
        </div>

        <div style="background: var(--bg-surface); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: var(--radius-md); padding: 10px 14px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase; font-weight: 700;">Needles Used / Broken</span>
            <span style="font-size: 16px;">⚠️</span>
          </div>
          <div style="font-size: 22px; font-weight: 900; color: #f87171; font-family: var(--font-mono); margin-top: 4px;">
            ${totalUsed} <span style="font-size: 12px; font-weight: 600; color: #cbd5e1;">Pcs</span>
          </div>
          <div style="font-size: 10.5px; color: #f87171; margin-top: 2px;">Deducted / Consumed</div>
        </div>

        <div style="background: var(--bg-surface); border: 1px solid rgba(52, 211, 153, 0.25); border-radius: var(--radius-md); padding: 10px 14px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase; font-weight: 700;">Added / Installed</span>
            <span style="font-size: 16px;">📥</span>
          </div>
          <div style="font-size: 22px; font-weight: 900; color: #34d399; font-family: var(--font-mono); margin-top: 4px;">
            ${totalAdded} <span style="font-size: 12px; font-weight: 600; color: #cbd5e1;">Pcs</span>
          </div>
          <div style="font-size: 10.5px; color: #34d399; margin-top: 2px;">Added from Store</div>
        </div>

        <div style="background: var(--bg-surface); border: 1px solid rgba(251, 191, 36, 0.25); border-radius: var(--radius-md); padding: 10px 14px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase; font-weight: 700;">Returned to Store</span>
            <span style="font-size: 16px;">🔄</span>
          </div>
          <div style="font-size: 22px; font-weight: 900; color: #fbbf24; font-family: var(--font-mono); margin-top: 4px;">
            ${totalReturned} <span style="font-size: 12px; font-weight: 600; color: #cbd5e1;">Pcs</span>
          </div>
          <div style="font-size: 10.5px; color: #fbbf24; margin-top: 2px;">Unused / Recovered</div>
        </div>

        <div style="background: var(--bg-surface); border: 1px solid rgba(168, 85, 247, 0.25); border-radius: var(--radius-md); padding: 10px 14px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase; font-weight: 700;">Total Transactions</span>
            <span style="font-size: 16px;">📜</span>
          </div>
          <div style="font-size: 22px; font-weight: 900; color: #c084fc; font-family: var(--font-mono); margin-top: 4px;">
            ${transactions.length}
          </div>
          <div style="font-size: 10.5px; color: #c084fc; margin-top: 2px;">Logged Audit Entries</div>
        </div>
      </div>

      <!-- Floor Balance Overview Quick Strip -->
      <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 10px 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 8px;">
          <div style="font-size: 13px; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 6px;">
            <span>🏢 Floor-wise Needle PRESENT &amp; Balance Overview</span>
          </div>
          <div style="font-size: 11px; color: var(--text-muted);">
            Auto-calculated from Machine Specifications &bull; Synchronized with Relocate &amp; Verify
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 8px;">
          ${floors.slice(0, 8).map(flr => {
            const metrics = needleService.getFloorNeedleMetrics(flr.id);
            const isShort = metrics.shortageExcess < 0;
            return `
              <div style="background: rgba(0,0,0,0.25); border: 1px solid ${isShort ? 'rgba(239,68,68,0.3)' : 'rgba(56,189,248,0.2)'}; border-radius: 8px; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <div style="font-weight: 800; font-size: 12.5px; color: #fff;">${flr.name}</div>
                  <div style="font-size: 10.5px; color: var(--text-muted); margin-top: 2px;">
                    Req: <strong style="color: #cbd5e1;">${metrics.requiredQuantity}</strong> &bull; Present: <strong style="color: #38bdf8;">${metrics.presentQuantity}</strong>
                  </div>
                </div>
                <div style="text-align: right;">
                  <span class="badge ${isShort ? 'badge-danger' : 'badge-active'}" style="font-size: 10px; font-weight: 800;">
                    ${isShort ? `${metrics.shortageExcess} Short` : `+${metrics.shortageExcess} Balanced`}
                  </span>
                  <div style="font-size: 10px; color: var(--text-secondary); margin-top: 2px;">
                    Stock: <strong>${metrics.balanceQuantity}</strong>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
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
              <option value="RETURN_STORE" ${filterActionType === 'RETURN_STORE' ? 'selected' : ''}>Returned to Store</option>
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
                <th style="padding: 8px 10px; width: 130px;">Technician / User</th>
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
                  actionLabel = '🔄 Store Return';
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
                      <div style="color: #fff; font-weight: 600;">${tx.technician || 'Technician'}</div>
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
          
          <!-- Machine Selection (Live Search & Select) -->
          <div class="form-group">
            <label class="form-label" style="font-weight: 800; font-size: 12px; color: #38bdf8;">
              Select Machine from Inventory: <span class="req">*</span>
            </label>
            <select id="modal-sel-tx-machine" class="form-control" required style="font-size: 14px; font-weight: 700; min-height: 42px;">
              <option value="">-- Choose Machine (Serial # / Model) --</option>
              ${allMachines.map(m => {
                const en = needleService.getEnrichedMachine(m);
                return `
                  <option value="${m.id}" ${m.id === selectedMachineId ? 'selected' : ''}>
                    ${m.serialNumber} — ${en.modelStr} (${en.floorStr} / ${en.lineStr})
                  </option>
                `;
              }).join('')}
            </select>
          </div>

          <!-- Machine Auto-Filled Information Card -->
          ${selectedMachine ? `
            <div style="background: rgba(0,0,0,0.35); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 8px; padding: 10px 14px; display: flex; flex-direction: column; gap: 6px;">
              <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="font-family: var(--font-mono); font-weight: 900; font-size: 15px; color: #fff;">${spec.serialNumber}</span>
                  <span style="font-size: 11px; color: #38bdf8; background: rgba(56,189,248,0.15); border: 1px solid #38bdf8; padding: 1px 6px; border-radius: 4px; font-weight: 700;">
                    ${spec.permanentMachineId || spec.id}
                  </span>
                </div>
                <div style="display: flex; gap: 6px;">
                  <span class="badge badge-active" style="font-size: 10.5px;">Present: ${prevBal} Needles</span>
                  <span class="badge badge-idle" style="font-size: 10.5px;">Req: ${spec.requiredNeedleCount}</span>
                </div>
              </div>
              
              <div style="font-size: 13px; font-weight: 700; color: #fff;">
                ${spec.machineNameStr} &bull; <span style="color: #38bdf8;">${spec.brandStr} ${spec.modelStr}</span>
              </div>

              <div style="font-size: 11px; color: var(--text-secondary); border-top: 1px solid rgba(255,255,255,0.06); padding-top: 4px; display: flex; justify-content: space-between;">
                <span>Location: <strong style="color: #cbd5e1;">${spec.unitStr} &gt; ${spec.floorStr} &gt; ${spec.lineStr}</strong></span>
                <span>Spec: <strong style="color: #38bdf8;">${spec.specNeedleBrand} ${spec.specNeedleType}</strong></span>
              </div>
            </div>
          ` : `
            <div style="background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.15); border-radius: 8px; padding: 10px; font-size: 11.5px; color: var(--text-muted); text-align: center;">
              Select a machine above to auto-populate specifications, required needles, and present balance.
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
                  <strong>🔄 Return to Store</strong>
                  <div style="font-size: 10px; color: var(--text-muted);">Unused needle returned</div>
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
                Prev: <span style="color: #cbd5e1;">${prevBal}</span> ➔ New: <span style="color: #38bdf8; font-size: 15px;">${calcNewBal}</span>
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
              <label class="form-label" style="font-size: 11.5px; color: var(--text-secondary);">Transaction Date:</label>
              <input 
                type="date" 
                id="modal-inp-tx-date" 
                class="form-control" 
                value="${new Date().toISOString().split('T')[0]}" 
                style="font-size: 13px;"
              />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" style="font-size: 11.5px; color: var(--text-secondary);">Reason / Remarks:</label>
            <input 
              type="text" 
              id="modal-inp-tx-remarks" 
              class="form-control" 
              placeholder="e.g. Needle tip snapped on waist seam, Replaced with OEM Organ needle" 
              style="font-size: 13px;"
            />
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

  // 3. Machine Selection Change
  root.querySelector('#modal-sel-tx-machine')?.addEventListener('change', (e) => {
    selectedMachineId = e.target.value;
    refreshView();
  });

  // 4. Action Type Radio Change
  root.querySelectorAll('input[name="tx-action-type-radio"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      txActionType = e.target.value;
      refreshView();
    });
  });

  // 5. Quantity Change
  root.querySelector('#modal-inp-tx-quantity')?.addEventListener('input', (e) => {
    const val = Number(e.target.value);
    if (!isNaN(val) && val > 0) {
      txQuantity = val;
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
        customDate: dateVal,
        allowNegative
      });

      notificationService.success(
        'Needle Transaction Saved',
        `Updated [${res.transaction.serialNumber}] Present Needle to ${res.newPresentBalance}.`
      );

      activeTransactionModalOpen = false;
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
}
