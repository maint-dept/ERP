/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Machine Transfers Hub View Component
 * Complete overview of relocation requests, approval workflows, gate passes & history
 */

import { storage } from '../db/storage.js';
import { TABLE_NAMES, TRANSFER_STATUSES } from '../db/schema.js';
import { transferService, resolveTransferMachineDetails } from '../services/transferService.js';
import { masterDataService } from '../services/masterDataService.js';
import { pdfService } from '../services/pdfService.js';
import { authService } from '../services/authService.js';
import { workflowService } from '../services/workflowService.js';
import { notificationService } from '../services/notificationService.js';
import { state } from '../state.js';

let transferSearchQuery = '';
let transferStatusFilter = 'ALL';

export function renderTransfersView() {
  const requests = transferService.getTransferRequests({
    search: transferSearchQuery,
    status: transferStatusFilter
  });

  const allRequests = storage.getTable(TABLE_NAMES.TRANSFER_REQUESTS) || [];
  const pendingCount = allRequests.filter(r => (r?.status || TRANSFER_STATUSES.PENDING_APPROVAL) === TRANSFER_STATUSES.PENDING_APPROVAL || (r?.status || '') === TRANSFER_STATUSES.PARTIALLY_APPROVED).length;
  const completedCount = allRequests.filter(r => (r?.status || '') === TRANSFER_STATUSES.COMPLETED).length;
  const rejectedCount = allRequests.filter(r => (r?.status || '') === TRANSFER_STATUSES.REJECTED).length;

  return `
    <div class="page-view" style="padding: 6px 12px;">

      <!-- ── Single Tight Toolbar Row: Title + KPIs + Actions ── -->
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px; flex-wrap: wrap;">

        <!-- Title block -->
        <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
          <span style="font-size: 16px; line-height: 1;">🔄</span>
          <span style="font-size: 14px; font-weight: 800; color: #ffffff; letter-spacing: -0.2px; white-space: nowrap;">Machine Transfers</span>
        </div>

        <!-- Separator -->
        <div style="width: 1px; height: 22px; background: rgba(255,255,255,0.12); flex-shrink: 0;"></div>

        <!-- KPI Chips (inline, very compact) -->
        <div style="display: flex; gap: 5px; flex-wrap: wrap; align-items: center; flex: 1; min-width: 0;">

          <div class="kpi-chip ${transferStatusFilter === 'ALL' ? 'kpi-chip-active' : ''}" data-status="ALL"
            style="display: inline-flex; align-items: center; gap: 5px; background: rgba(56,189,248,0.1); border: 1px solid ${transferStatusFilter === 'ALL' ? '#38bdf8' : 'rgba(56,189,248,0.25)'}; border-radius: 6px; padding: 3px 9px; cursor: pointer; white-space: nowrap;" title="All transfers">
            <span style="font-size: 13px; font-weight: 800; color: #fff;">${allRequests.length}</span>
            <span style="font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase;">Total</span>
          </div>

          <div class="kpi-chip ${transferStatusFilter === TRANSFER_STATUSES.PENDING_APPROVAL ? 'kpi-chip-active' : ''}" data-status="${TRANSFER_STATUSES.PENDING_APPROVAL}"
            style="display: inline-flex; align-items: center; gap: 5px; background: rgba(245,158,11,0.1); border: 1px solid ${transferStatusFilter === TRANSFER_STATUSES.PENDING_APPROVAL ? '#fbbf24' : 'rgba(245,158,11,0.25)'}; border-radius: 6px; padding: 3px 9px; cursor: pointer; white-space: nowrap;" title="Awaiting approval">
            <span style="font-size: 13px; font-weight: 800; color: #fbbf24;">⏳ ${pendingCount}</span>
            <span style="font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase;">Pending</span>
          </div>

          <div class="kpi-chip ${transferStatusFilter === TRANSFER_STATUSES.COMPLETED ? 'kpi-chip-active' : ''}" data-status="${TRANSFER_STATUSES.COMPLETED}"
            style="display: inline-flex; align-items: center; gap: 5px; background: rgba(16,185,129,0.1); border: 1px solid ${transferStatusFilter === TRANSFER_STATUSES.COMPLETED ? '#34d399' : 'rgba(16,185,129,0.25)'}; border-radius: 6px; padding: 3px 9px; cursor: pointer; white-space: nowrap;" title="Completed transfers">
            <span style="font-size: 13px; font-weight: 800; color: #34d399;">✅ ${completedCount}</span>
            <span style="font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase;">Done</span>
          </div>

          <div class="kpi-chip ${transferStatusFilter === TRANSFER_STATUSES.REJECTED ? 'kpi-chip-active' : ''}" data-status="${TRANSFER_STATUSES.REJECTED}"
            style="display: inline-flex; align-items: center; gap: 5px; background: rgba(239,68,68,0.1); border: 1px solid ${transferStatusFilter === TRANSFER_STATUSES.REJECTED ? '#f87171' : 'rgba(239,68,68,0.25)'}; border-radius: 6px; padding: 3px 9px; cursor: pointer; white-space: nowrap;" title="Rejected requests">
            <span style="font-size: 13px; font-weight: 800; color: #f87171;">✕ ${rejectedCount}</span>
            <span style="font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase;">Rejected</span>
          </div>
        </div>

        <!-- Action Buttons (right side) -->
        <div style="display: flex; gap: 5px; align-items: center; flex-shrink: 0; margin-left: auto;">
          <button id="btn-export-transfers-excel" class="btn btn-secondary btn-sm" title="Export to Excel"
            style="height: 28px; font-size: 11px; font-weight: 700; padding: 0 9px; display: inline-flex; align-items: center; gap: 4px; color: #f1f5f9;">
            📊 Export
          </button>
          ${authService.isAdmin() ? `
            <button id="btn-nav-workflow-config" class="btn btn-secondary btn-sm"
              style="height: 28px; font-size: 11px; font-weight: 700; padding: 0 9px; display: inline-flex; align-items: center; gap: 4px; color: #f1f5f9;">
              ⚙️ Workflows
            </button>
          ` : ''}
          <button id="btn-quick-new-transfer" class="btn btn-primary btn-sm"
            style="height: 28px; font-size: 11px; font-weight: 800; padding: 0 11px; display: inline-flex; align-items: center; gap: 4px; background: linear-gradient(135deg, #0284c7, #0369a1); box-shadow: 0 2px 6px rgba(2,132,199,0.35); color: #fff;">
            🚀 Request Transfer
          </button>
        </div>
      </div>

      <!-- ── Search + Filter Pills (single compact row) ── -->
      <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px; flex-wrap: wrap; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 7px; padding: 4px 8px;">
        <input
          type="text"
          id="transfers-search-input"
          class="form-control"
          placeholder="🔍 Search Request ID, Serial No, Line, Floor, Requester..."
          value="${transferSearchQuery}"
          style="flex: 1 1 220px; height: 26px; font-size: 11.5px; padding: 2px 8px; color: #f8fafc; font-weight: 600; background: rgba(15,23,42,0.6); border: 1px solid rgba(255,255,255,0.1); border-radius: 5px; min-width: 0;"
        />
        <div style="display: flex; gap: 3px; flex-wrap: wrap; align-items: center; flex-shrink: 0;">
          ${[
            { id: 'ALL', label: 'All' },
            { id: TRANSFER_STATUSES.PENDING_APPROVAL, label: '⏳ Pending' },
            { id: TRANSFER_STATUSES.PARTIALLY_APPROVED, label: '🔄 In Progress' },
            { id: TRANSFER_STATUSES.COMPLETED, label: '✅ Completed' },
            { id: TRANSFER_STATUSES.REJECTED, label: '✕ Rejected' },
            { id: TRANSFER_STATUSES.REVISION_REQUESTED, label: '✏️ Revision' }
          ].map(f => `
            <button class="btn btn-sm btn-filter-status ${transferStatusFilter === f.id ? 'btn-primary' : 'btn-secondary'}" data-status="${f.id}"
              style="height: 24px; font-size: 10.5px; font-weight: 700; padding: 1px 7px; border-radius: 4px; white-space: nowrap; ${transferStatusFilter === f.id ? 'background: #0284c7; color: #fff; border-color: #38bdf8;' : 'color: #cbd5e1;'}">
              ${f.label}
            </button>
          `).join('')}
        </div>
      </div>

      <!-- ── Main Transfers Table ── -->
      <div class="transfers-table-container" style="-webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-rendering: optimizeLegibility;">
        ${requests.length === 0 ? `
          <div style="padding: 40px 20px; text-align: center; color: var(--text-muted);">
            <div style="font-size: 32px; margin-bottom: 8px;">🔄</div>
            <div style="font-size: 14px; font-weight: 800; color: #fff;">No machine transfer requests found</div>
            <div style="font-size: 11.5px; color: #94a3b8; margin-top: 3px;">No transfer records match your search query or filter criteria.</div>
          </div>
        ` : `
          <table class="transfers-table" style="width: 100% !important; margin: 0; -webkit-font-smoothing: antialiased;">
            <thead>
              <tr style="background: #0d1527;">
                <th style="width: 11%; padding: 7px 8px; font-size: 11px; font-weight: 800; color: #ffffff; letter-spacing: 0.3px;">Request ID</th>
                <th style="width: 17%; padding: 7px 8px; font-size: 11px; font-weight: 800; color: #ffffff; letter-spacing: 0.3px;">Equipment Details</th>
                <th style="width: 13%; padding: 7px 8px; font-size: 11px; font-weight: 800; color: #ffffff; letter-spacing: 0.3px;">Source (From)</th>
                <th style="width: 13%; padding: 7px 8px; font-size: 11px; font-weight: 800; color: #ffffff; letter-spacing: 0.3px;">Destination (To)</th>
                <th style="width: 13%; padding: 7px 8px; font-size: 11px; font-weight: 800; color: #ffffff; letter-spacing: 0.3px;">Requester &amp; Date</th>
                <th style="width: 13.5%; padding: 7px 8px; font-size: 11px; font-weight: 800; color: #ffffff; letter-spacing: 0.3px;">Approval Stage</th>
                <th style="width: 4.5%; padding: 7px 6px; font-size: 11px; font-weight: 800; color: #ffffff; text-align: center;">Docs</th>
                <th style="width: 7.5%; padding: 7px 6px; font-size: 11px; font-weight: 800; color: #ffffff; text-align: center;">Status</th>
                <th style="width: 9%; padding: 7px 6px; font-size: 11px; font-weight: 800; color: #ffffff; text-align: center; background: #0b1329;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${requests.map(req => {
                if (!req) return '';
                const safeStatus = (req.status || TRANSFER_STATUSES.PENDING_APPROVAL).toString();
                const isCompleted = safeStatus === TRANSFER_STATUSES.COMPLETED;
                const isRejected = safeStatus === TRANSFER_STATUSES.REJECTED;
                const isRevision = safeStatus === TRANSFER_STATUSES.REVISION_REQUESTED;
                const isPending = safeStatus === TRANSFER_STATUSES.PENDING_APPROVAL || safeStatus === TRANSFER_STATUSES.PARTIALLY_APPROVED;
                const currentUser = authService.getCurrentUser();
                const canApprove = isPending && workflowService.canUserApproveStep(req, currentUser);

                const statusBadge = isCompleted ? 'badge-active' : (isRejected ? 'badge-breakdown' : (isRevision ? 'badge-maint' : 'badge-idle'));

                // Parse requester name & role cleanly
                const rawRequester = req.requestedByName || 'Requester';
                const nameMatch = rawRequester.match(/^(.*?)(?:\s*\((.*?)\))?$/);
                const personName = nameMatch ? nameMatch[1].trim() : rawRequester;
                const personRole = nameMatch && nameMatch[2] ? nameMatch[2].trim() : null;
                const formattedDate = req.requestedAt ? new Date(req.requestedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

                // Current Stage Title
                const currentLvl = Number(req.currentLevel) || 1;
                const stageTitle = isCompleted ? 'Final Gate Pass Approved' : (req.levels?.[currentLvl - 1]?.title || 'In Review');
                const displayStatus = safeStatus === 'PENDING_APPROVAL' ? 'Pending' : (safeStatus === 'PARTIALLY_APPROVED' ? 'In Progress' : safeStatus.replace(/_/g, ' '));

                // Resolve equipment details using comprehensive engine
                const eq = resolveTransferMachineDetails(req);

                return `
                  <tr class="transfer-row-item" data-id="${req.id}" title="Click row to view complete transfer details and audit trail" style="border-bottom: 1px solid rgba(255, 255, 255, 0.07);">
                    <!-- Request ID -->
                    <td>
                      <div class="transfer-id-badge">
                        <span style="font-weight: 800; font-size: 12px; color: #38bdf8; font-family: var(--font-mono); letter-spacing: 0.3px;">${req.requestNumber || req.id || 'TR-REQ'}</span>
                      </div>
                      <div style="font-size: 10px; color: #94a3b8; font-weight: 600; margin-top: 2px;" title="Full Internal ID: ${req.id}">
                        Ref #${(req.id || '').replace(/^trq-/, '').slice(-7)}
                      </div>
                    </td>

                    <!-- Equipment Details (Sharp, High Contrast) -->
                    <td>
                      <div style="font-weight: 800; color: #ffffff; font-size: 12.5px; line-height: 1.25; margin-bottom: 2px;">
                        ${eq.machineName}
                      </div>
                      <div style="font-size: 11px; color: #cbd5e1; font-weight: 600; margin-bottom: 3px;">
                        ${eq.brandModelText}
                      </div>
                      <div>
                        <span style="font-family: var(--font-mono); font-size: 10px; color: #38bdf8; font-weight: 800; background: rgba(56,189,248,0.14); border: 1px solid rgba(56,189,248,0.35); padding: 1px 6px; border-radius: 3px; display: inline-block;">
                          SN: ${eq.serialNumber}
                        </span>
                      </div>
                    </td>

                    <!-- Source Location (From) -->
                    <td>
                      <div style="display: flex; align-items: center; gap: 5px; margin-bottom: 2px;">
                        <span style="font-size: 9px; font-weight: 800; background: rgba(239, 68, 68, 0.22); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.45); padding: 1px 4px; border-radius: 3px;">FROM</span>
                        <span style="font-size: 12px; font-weight: 800; color: #f8fafc;">${req.sourceLocation?.line || 'Line —'}</span>
                      </div>
                      <div style="font-size: 11px; color: #cbd5e1; font-weight: 600; line-height: 1.25;" title="${req.sourceLocation?.unit || ''}">
                        ${req.sourceLocation?.floor || '—'}
                      </div>
                      ${req.sourceLocation?.unit ? `
                        <div style="font-size: 9.5px; color: #94a3b8; margin-top: 1px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${req.sourceLocation.unit}">
                          ${req.sourceLocation.unit}
                        </div>
                      ` : ''}
                    </td>

                    <!-- Destination Location (To) -->
                    <td>
                      <div style="display: flex; align-items: center; gap: 5px; margin-bottom: 2px;">
                        <span style="font-size: 9px; font-weight: 800; background: rgba(16, 185, 129, 0.22); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.45); padding: 1px 4px; border-radius: 3px;">TO</span>
                        <span style="font-size: 12px; font-weight: 800; color: #34d399;">${req.destLocation?.line || 'Line —'}</span>
                      </div>
                      <div style="font-size: 11px; color: #cbd5e1; font-weight: 600; line-height: 1.25;" title="${req.destLocation?.unit || ''}">
                        ${req.destLocation?.floor || '—'}
                      </div>
                      ${req.destLocation?.unit ? `
                        <div style="font-size: 9.5px; color: #94a3b8; margin-top: 1px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${req.destLocation.unit}">
                          ${req.destLocation.unit}
                        </div>
                      ` : ''}
                    </td>

                    <!-- Requester & Date -->
                    <td>
                      <div style="font-weight: 800; color: #ffffff; font-size: 12px; line-height: 1.25;">
                        ${personName}
                      </div>
                      ${personRole ? `
                        <div style="font-size: 10px; color: #cbd5e1; font-weight: 600; margin-top: 1px;">
                          ${personRole}
                        </div>
                      ` : ''}
                      <div style="font-size: 10.5px; color: #38bdf8; font-weight: 700; margin-top: 2px; display: flex; align-items: center; gap: 3px;">
                        📅 ${formattedDate}
                      </div>
                    </td>

                    <!-- Approval Stage -->
                    <td>
                      <div style="margin-bottom: 2px;">
                        <span class="stage-pill ${isCompleted ? 'stage-pill-completed' : 'stage-pill-pending'}" style="font-size: 10px; font-weight: 800; padding: 2px 7px; border-radius: 4px;">
                          ${isCompleted ? '✓ Completed' : `⏳ Stage ${req.currentLevel || 1}/${req.totalLevels || 1}`}
                        </span>
                      </div>
                      <div style="font-size: 10.5px; color: #cbd5e1; font-weight: 600; line-height: 1.25;" title="${stageTitle}">
                        ${stageTitle}
                      </div>
                    </td>

                    <!-- Attached Documents -->
                    <td style="text-align: center;">
                      <span class="badge badge-idle" style="font-size: 10px; padding: 2px 6px; font-weight: 700; color: #f1f5f9;">
                        📄 ${(req.documents || []).length}
                      </span>
                    </td>

                    <!-- Status -->
                    <td style="text-align: center;">
                      <span class="badge ${statusBadge}" style="font-size: 10px; padding: 3px 8px; font-weight: 800; letter-spacing: 0.2px;">
                        ${displayStatus}
                      </span>
                      ${isRejected && req.rejectionReason ? `
                        <div style="font-size: 9px; color: #f87171; margin-top: 2px; line-height: 1.2; font-weight: 600;" title="${req.rejectionReason}">
                          ⚠️ ${req.rejectionReason}
                        </div>
                      ` : ''}
                    </td>

                    <!-- Actions -->
                    <td style="text-align: center;" onclick="event.stopPropagation();">
                      <div style="display: flex; justify-content: center; gap: 4px; align-items: center;">
                        ${isPending && canApprove ? `
                          <button class="btn btn-success btn-sm btn-quick-approve-transfer" data-id="${req.id}" title="One-Click Instant Approval" style="font-size: 10px; padding: 4px 7px; font-weight: 800; background: linear-gradient(135deg, #10b981, #059669); border-color: #10b981; box-shadow: 0 2px 6px rgba(16, 185, 129, 0.4); white-space: nowrap; cursor: pointer;">
                            ⚡ Approve
                          </button>
                        ` : ''}
                        <button class="btn ${isPending && !canApprove ? 'btn-primary' : 'btn-secondary'} btn-sm btn-view-transfer-details" data-id="${req.id}" style="font-size: 10px; padding: 4px 7px; font-weight: 700; white-space: nowrap;">
                          ${isPending ? 'Details' : 'View'}
                        </button>
                        ${!isCompleted && !isRejected && (req.requestedBy === authService.getCurrentUser()?.id || authService.isAdmin()) ? `
                          <button class="btn btn-warning btn-sm btn-edit-transfer-row" data-id="${req.id}" title="Edit destination location before approval" style="font-size: 10px; padding: 4px 7px; font-weight: 700; white-space: nowrap; background: rgba(245, 158, 11, 0.2); border: 1px solid #f59e0b; color: #fbbf24;">
                            ✏️ Edit
                          </button>
                        ` : ''}
                        <button class="btn btn-ghost btn-sm btn-print-transfer-row" data-id="${req.id}" title="Print Official PDF Gate Pass" style="font-size: 11px; padding: 4px 6px; color: #38bdf8;">
                          🖨️
                        </button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        `}
      </div>
    </div>
  `;
}

export function initTransfersViewEvents() {
  // Search filter
  const searchInput = document.getElementById('transfers-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      transferSearchQuery = e.target.value;
      state.emit('inventory:updated');
    });
  }

  // Status pills
  document.querySelectorAll('.btn-filter-status').forEach(btn => {
    btn.addEventListener('click', () => {
      transferStatusFilter = btn.getAttribute('data-status');
      state.emit('inventory:updated');
    });
  });

  // Clickable KPI chips filter status
  document.querySelectorAll('.kpi-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const status = chip.getAttribute('data-status');
      if (status) {
        transferStatusFilter = status;
        state.emit('inventory:updated');
      }
    });
  });

  // 1-Click Quick Approve from Table Row
  document.querySelectorAll('.btn-quick-approve-transfer').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const req = transferService.getTransferRequestById(id);
      if (!req) return;
      const originalText = btn.innerHTML;
      try {
        btn.disabled = true;
        btn.innerHTML = '⚡ Approved!';
        await transferService.approveStep(id, '1-Click Approved for relocation.');
        notificationService.success(`Transfer Request ${req.requestNumber} approved successfully!`);
        state.emit('inventory:updated');
        window.dispatchEvent(new CustomEvent('erp:transfers-updated'));
      } catch (err) {
        btn.disabled = false;
        btn.innerHTML = originalText;
        notificationService.error('Approval Error: ' + err.message);
      }
    });
  });

  // View transfer details button & row click
  document.querySelectorAll('.btn-view-transfer-details, .transfer-row-item').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.getAttribute('data-id');
      if (id) {
        state.set('activeTransferRequestId', id);
        state.set('activeModal', 'transfer-details');
      }
    });
  });

  // Edit transfer request button
  document.querySelectorAll('.btn-edit-transfer-row').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      if (id) {
        state.set('activeTransferRequestId', id);
        state.set('activeModal', 'edit-transfer');
      }
    });
  });

  // Print PDF row button
  document.querySelectorAll('.btn-print-transfer-row').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const req = transferService.getTransferRequestById(id);
      if (req) {
        pdfService.generateTransferGatePassPDF(req);
      }
    });
  });

  // Export filtered transfers to Excel
  const btnExport = document.getElementById('btn-export-transfers-excel');
  if (btnExport) {
    btnExport.addEventListener('click', () => {
      const filtered = transferService.getTransferRequests({
        search: transferSearchQuery,
        status: transferStatusFilter
      });
      transferService.exportTransfersToExcel(filtered);
    });
  }

  // Quick new transfer button
  const btnNew = document.getElementById('btn-quick-new-transfer');
  if (btnNew) {
    btnNew.addEventListener('click', () => {
      state.set('activeMachineId', null);
      state.set('activeModal', 'transfer-machine');
    });
  }

  // Nav to workflow config button
  const btnWfConfig = document.getElementById('btn-nav-workflow-config');
  if (btnWfConfig) {
    btnWfConfig.addEventListener('click', () => {
      state.set('currentView', 'transfer-workflows');
    });
  }
}
