/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Machine Transfers Hub View Component
 * Complete overview of relocation requests, approval workflows, gate passes & history
 */

import { storage } from '../db/storage.js';
import { TABLE_NAMES, TRANSFER_STATUSES } from '../db/schema.js';
import { transferService } from '../services/transferService.js';
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
  const pendingCount = allRequests.filter(r => r.status === TRANSFER_STATUSES.PENDING_APPROVAL || r.status === TRANSFER_STATUSES.PARTIALLY_APPROVED).length;
  const completedCount = allRequests.filter(r => r.status === TRANSFER_STATUSES.COMPLETED).length;
  const rejectedCount = allRequests.filter(r => r.status === TRANSFER_STATUSES.REJECTED).length;

  return `
    <div class="page-view">
      <!-- Header -->
      <div class="view-header-row" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 12px;">
        <div style="min-width: 0; flex: 1;">
          <h1 style="font-size: 20px; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 8px; margin: 0 0 4px 0; word-break: break-word;">
            <span>🔄 Machine Relocation &amp; Transfer Management</span>
          </h1>
          <p style="font-size: 12px; color: var(--text-secondary); margin: 0;">
            Track plant machinery movement, multi-stage approval workflows, management permission letters, and official gate passes.
          </p>
        </div>

        <div class="view-header-actions" style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button id="btn-export-transfers-excel" class="btn btn-secondary" title="Export filtered transfer records to Excel">
            📊 Export Excel
          </button>
          ${authService.isAdmin() ? `
            <button id="btn-nav-workflow-config" class="btn btn-secondary">
              ⚙️ Configure Workflows
            </button>
          ` : ''}
          <button id="btn-quick-new-transfer" class="btn btn-primary">
            🚀 Request Machine Transfer
          </button>
        </div>
      </div>

      <!-- KPI Summary Cards -->
      <div class="kpi-grid" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px;">
        <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 16px; display: flex; align-items: center; gap: 14px;">
          <div style="font-size: 28px; background: rgba(56, 189, 248, 0.1); width: 50px; height: 50px; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-md);">
            🔄
          </div>
          <div>
            <div style="font-size: 22px; font-weight: 800; color: #fff;">${allRequests.length}</div>
            <div style="font-size: 11.5px; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">Total Transfer Requests</div>
          </div>
        </div>

        <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 16px; display: flex; align-items: center; gap: 14px;">
          <div style="font-size: 28px; background: rgba(245, 158, 11, 0.1); width: 50px; height: 50px; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-md);">
            ⏳
          </div>
          <div>
            <div style="font-size: 22px; font-weight: 800; color: #fbbf24;">${pendingCount}</div>
            <div style="font-size: 11.5px; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">Awaiting Approval</div>
          </div>
        </div>

        <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 16px; display: flex; align-items: center; gap: 14px;">
          <div style="font-size: 28px; background: rgba(16, 185, 129, 0.1); width: 50px; height: 50px; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-md);">
            ✅
          </div>
          <div>
            <div style="font-size: 22px; font-weight: 800; color: #34d399;">${completedCount}</div>
            <div style="font-size: 11.5px; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">Completed Transfers</div>
          </div>
        </div>

        <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 16px; display: flex; align-items: center; gap: 14px;">
          <div style="font-size: 28px; background: rgba(239, 68, 68, 0.1); width: 50px; height: 50px; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-md);">
            ✕
          </div>
          <div>
            <div style="font-size: 22px; font-weight: 800; color: #f87171;">${rejectedCount}</div>
            <div style="font-size: 11.5px; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">Rejected Requests</div>
          </div>
        </div>
      </div>

      <!-- Filter Bar & Search -->
      <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 12px 14px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;">
        <!-- Search Input -->
        <div style="flex: 1 1 260px; min-width: 0; width: 100%; position: relative;">
          <input 
            type="text" 
            id="transfers-search-input" 
            class="form-control" 
            placeholder="Search by Request ID, Serial Number, Line, Floor, Requester..." 
            value="${transferSearchQuery}"
          />
        </div>

        <!-- Status Filter Pills -->
        <div style="display: flex; gap: 6px; flex-wrap: wrap;">
          ${[
            { id: 'ALL', label: 'All Transfers' },
            { id: TRANSFER_STATUSES.PENDING_APPROVAL, label: '⏳ Pending Approval' },
            { id: TRANSFER_STATUSES.PARTIALLY_APPROVED, label: '🔄 In Progress' },
            { id: TRANSFER_STATUSES.COMPLETED, label: '✅ Completed' },
            { id: TRANSFER_STATUSES.REJECTED, label: '✕ Rejected' },
            { id: TRANSFER_STATUSES.REVISION_REQUESTED, label: '✏️ Revision' }
          ].map(f => `
            <button class="btn btn-sm btn-filter-status ${transferStatusFilter === f.id ? 'btn-primary' : 'btn-secondary'}" data-status="${f.id}" style="font-size: 11.5px; font-weight: 700;">
              ${f.label}
            </button>
          `).join('')}
        </div>
      </div>

      <!-- Main Transfers Table (Scrollable & Clickable) -->
      <div class="transfers-table-container">
        ${requests.length === 0 ? `
          <div style="padding: 45px 20px; text-align: center; color: var(--text-muted);">
            <div style="font-size: 36px; margin-bottom: 10px;">🔄</div>
            <div style="font-size: 15px; font-weight: 700; color: #fff;">No machine transfer requests found</div>
            <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">No transfer records match your search query or filter criteria.</div>
          </div>
        ` : `
          <table class="transfers-table" style="width: 100% !important; margin: 0;">
            <thead>
              <tr>
                <th style="width: 10.5%;">Request ID</th>
                <th style="width: 16%;">Equipment Details</th>
                <th style="width: 13%;">Source (From)</th>
                <th style="width: 13%;">Destination (To)</th>
                <th style="width: 13%;">Requester &amp; Date</th>
                <th style="width: 13.5%;">Approval Stage</th>
                <th style="width: 4.5%; text-align: center;">Docs</th>
                <th style="width: 7.5%; text-align: center;">Status</th>
                <th style="width: 9%; text-align: center; background: #0b1329;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${requests.map(req => {
                const isCompleted = req.status === TRANSFER_STATUSES.COMPLETED;
                const isRejected = req.status === TRANSFER_STATUSES.REJECTED;
                const isRevision = req.status === TRANSFER_STATUSES.REVISION_REQUESTED;
                const isPending = req.status === TRANSFER_STATUSES.PENDING_APPROVAL || req.status === TRANSFER_STATUSES.PARTIALLY_APPROVED;
                const currentUser = authService.getCurrentUser();
                const canApprove = isPending && workflowService.canUserApproveStep(req, currentUser);

                const statusBadge = isCompleted ? 'badge-active' : (isRejected ? 'badge-breakdown' : (isRevision ? 'badge-maint' : 'badge-idle'));

                // Parse requester name & role cleanly
                const rawRequester = req.requestedByName || 'Requester';
                const nameMatch = rawRequester.match(/^(.*?)(?:\s*\((.*?)\))?$/);
                const personName = nameMatch ? nameMatch[1].trim() : rawRequester;
                const personRole = nameMatch && nameMatch[2] ? nameMatch[2].trim() : null;
                const formattedDate = new Date(req.requestedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

                // Current Stage Title
                const stageTitle = isCompleted ? 'Final Gate Pass Approved' : (req.levels?.[req.currentLevel - 1]?.title || 'In Review');

                return `
                  <tr class="transfer-row-item" data-id="${req.id}" title="Click row to view complete transfer details and audit trail">
                    <!-- Request ID -->
                    <td>
                      <div class="transfer-id-badge">
                        <span>${req.requestNumber}</span>
                      </div>
                      <div style="font-size: 10px; color: var(--text-muted); margin-top: 3px;" title="Full Internal ID: ${req.id}">
                        Ref #${(req.id || '').replace(/^trq-/, '').slice(-7)}
                      </div>
                    </td>

                    <!-- Equipment Details -->
                    <td>
                      <div style="font-weight: 700; color: #fff; font-size: 12px; line-height: 1.3; margin-bottom: 2px;">
                        ${req.machineInfo.machineName || 'Machine'}
                      </div>
                      <div style="font-size: 10.5px; color: var(--text-secondary); margin-bottom: 3px;">
                        ${req.machineInfo.brand || '—'} &bull; ${req.machineInfo.model || '—'}
                      </div>
                      <div>
                        <span style="font-family: var(--font-mono); font-size: 10px; color: #38bdf8; font-weight: 700; background: rgba(56,189,248,0.1); border: 1px solid rgba(56,189,248,0.25); padding: 1px 5px; border-radius: 3px; display: inline-block;">
                          SN: ${req.machineInfo.serialNumber}
                        </span>
                      </div>
                    </td>

                    <!-- Source Location (From) -->
                    <td>
                      <div style="display: flex; align-items: center; gap: 4px; margin-bottom: 2px;">
                        <span class="loc-tag loc-tag-from">FROM</span>
                        <span style="font-size: 11.5px; font-weight: 700; color: #f1f5f9;">${req.sourceLocation?.line || 'Line —'}</span>
                      </div>
                      <div style="font-size: 10.5px; color: #cbd5e1; line-height: 1.3;" title="${req.sourceLocation?.unit || ''}">
                        ${req.sourceLocation?.floor || '—'}
                      </div>
                      ${req.sourceLocation?.unit ? `
                        <div style="font-size: 9.5px; color: #64748b; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${req.sourceLocation.unit}">
                          ${req.sourceLocation.unit}
                        </div>
                      ` : ''}
                    </td>

                    <!-- Destination Location (To) -->
                    <td>
                      <div style="display: flex; align-items: center; gap: 4px; margin-bottom: 2px;">
                        <span class="loc-tag loc-tag-to">TO</span>
                        <span style="font-size: 11.5px; font-weight: 700; color: #34d399;">${req.destLocation?.line || 'Line —'}</span>
                      </div>
                      <div style="font-size: 10.5px; color: #cbd5e1; line-height: 1.3;" title="${req.destLocation?.unit || ''}">
                        ${req.destLocation?.floor || '—'}
                      </div>
                      ${req.destLocation?.unit ? `
                        <div style="font-size: 9.5px; color: #64748b; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${req.destLocation.unit}">
                          ${req.destLocation.unit}
                        </div>
                      ` : ''}
                    </td>

                    <!-- Requester & Date -->
                    <td>
                      <div style="font-weight: 700; color: #f8fafc; font-size: 11.5px; line-height: 1.25;">
                        ${personName}
                      </div>
                      ${personRole ? `
                        <div style="font-size: 9.5px; color: #94a3b8; margin-top: 1px;">
                          ${personRole}
                        </div>
                      ` : ''}
                      <div style="font-size: 10px; color: #64748b; margin-top: 3px; display: flex; align-items: center; gap: 3px;">
                        📅 ${formattedDate}
                      </div>
                    </td>

                    <!-- Approval Stage -->
                    <td>
                      <div style="margin-bottom: 3px;">
                        <span class="stage-pill ${isCompleted ? 'stage-pill-completed' : 'stage-pill-pending'}" style="font-size: 10px; padding: 2px 6px;">
                          ${isCompleted ? '✓ Completed' : `⏳ Stage ${req.currentLevel}/${req.totalLevels}`}
                        </span>
                      </div>
                      <div style="font-size: 10px; color: var(--text-secondary); line-height: 1.3;" title="${stageTitle}">
                        ${stageTitle}
                      </div>
                    </td>

                    <!-- Attached Documents -->
                    <td style="text-align: center;">
                      <span class="badge badge-idle" style="font-size: 10px; padding: 2px 5px; font-weight: 600;">
                        📄 ${(req.documents || []).length}
                      </span>
                    </td>

                    <!-- Status -->
                    <td style="text-align: center;">
                      <span class="badge ${statusBadge}" style="font-size: 9.5px; padding: 3px 6px; font-weight: 700; letter-spacing: 0.2px;">
                        ${req.status === 'PENDING_APPROVAL' ? 'Pending' : (req.status === 'PARTIALLY_APPROVED' ? 'In Progress' : req.status.replace(/_/g, ' '))}
                      </span>
                      ${isRejected && req.rejectionReason ? `
                        <div style="font-size: 9px; color: #f87171; margin-top: 2px; line-height: 1.2;" title="${req.rejectionReason}">
                          ⚠️ ${req.rejectionReason}
                        </div>
                      ` : ''}
                    </td>

                    <!-- Actions -->
                    <td style="text-align: center;" onclick="event.stopPropagation();">
                      <div style="display: flex; justify-content: center; gap: 4px; align-items: center;">
                        ${isPending && canApprove ? `
                          <button class="btn btn-success btn-sm btn-quick-approve-transfer" data-id="${req.id}" title="One-Click Instant Approval" style="font-size: 10px; padding: 4px 7px; font-weight: 800; background: linear-gradient(135deg, #10b981, #059669); border-color: #10b981; box-shadow: 0 2px 6px rgba(16, 185, 129, 0.4); white-space: nowrap; cursor: pointer;">
                            ⚡ 1-Click Approve
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
