/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Unified Central Approval Center Component
 * Tab 1: Machine Relocation Transfers with Multi-Stage Approvals & Document Verification
 * Tab 2: Inventory Parameter Updates with Side-by-Side Visual Diffs
 */

import { storage } from '../db/storage.js';
import { TABLE_NAMES, TRANSFER_STATUSES, APPROVAL_STATUSES } from '../db/schema.js';
import { approvalService } from '../services/approvalService.js';
import { transferService } from '../services/transferService.js';
import { workflowService } from '../services/workflowService.js';
import { authService } from '../services/authService.js';
import { pdfService } from '../services/pdfService.js';
import { notificationService } from '../services/notificationService.js';
import { state } from '../state.js';

let activeApprovalTab = 'transfers'; // 'transfers' | 'edits'
let transferFilter = 'PENDING'; // 'ALL' | 'PENDING' | 'COMPLETED' | 'REJECTED'

export function renderApprovalCenter() {
  const user = authService.getCurrentUser();
  const isAdmin = authService.isAdmin();

  // Transfers
  const allTransfers = transferService.getTransferRequests({ status: 'ALL' });
  const pendingTransfers = allTransfers.filter(t => {
    const isPending = t.status === TRANSFER_STATUSES.PENDING_APPROVAL || t.status === TRANSFER_STATUSES.PARTIALLY_APPROVED;
    return isPending && workflowService.canUserApproveStep(t, user);
  });

  let displayTransfers = allTransfers;
  if (transferFilter === 'PENDING') {
    displayTransfers = allTransfers.filter(t => t.status === TRANSFER_STATUSES.PENDING_APPROVAL || t.status === TRANSFER_STATUSES.PARTIALLY_APPROVED);
  } else if (transferFilter !== 'ALL') {
    displayTransfers = allTransfers.filter(t => t.status === transferFilter);
  }

  // Edit Requests
  const editRequests = approvalService.getRequests();
  const pendingEditsCount = approvalService.getPendingCount();

  return `
    <div class="page-view">
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <div>
          <h1 style="font-size: 22px; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 8px;">
            <span>🛡️ Central Management Approval Center</span>
          </h1>
          <p style="font-size: 12.5px; color: var(--text-secondary);">
            Review and authorize machine relocation requests, management permission documents, and physical equipment modifications.
          </p>
        </div>

        <div style="display: flex; gap: 10px;">
          <span class="badge badge-maint" style="font-size: 12.5px; padding: 6px 14px;">
            ${pendingTransfers.length} Transfers Pending Your Action
          </span>
        </div>
      </div>

      <!-- Main Navigation Tabs -->
      <div style="display: flex; gap: 8px; border-bottom: 2px solid var(--border-color); margin-bottom: 20px;">
        <button class="btn btn-ghost btn-approval-tab ${activeApprovalTab === 'transfers' ? 'active-tab' : ''}" data-tab="transfers" style="font-size: 13.5px; font-weight: 800; padding: 10px 18px; border-radius: var(--radius-md) var(--radius-md) 0 0; border-bottom: ${activeApprovalTab === 'transfers' ? '3px solid #38bdf8' : 'none'}; color: ${activeApprovalTab === 'transfers' ? '#38bdf8' : 'var(--text-secondary)'};">
          🔄 Machine Transfers (${allTransfers.filter(t => t.status === TRANSFER_STATUSES.PENDING_APPROVAL || t.status === TRANSFER_STATUSES.PARTIALLY_APPROVED).length} Pending)
        </button>

        <button class="btn btn-ghost btn-approval-tab ${activeApprovalTab === 'edits' ? 'active-tab' : ''}" data-tab="edits" style="font-size: 13.5px; font-weight: 800; padding: 10px 18px; border-radius: var(--radius-md) var(--radius-md) 0 0; border-bottom: ${activeApprovalTab === 'edits' ? '3px solid #38bdf8' : 'none'}; color: ${activeApprovalTab === 'edits' ? '#38bdf8' : 'var(--text-secondary)'};">
          ✏️ Inventory Parameter Edits (${pendingEditsCount} Pending)
        </button>
      </div>

      <!-- TAB 1: MACHINE RELOCATION TRANSFERS -->
      ${activeApprovalTab === 'transfers' ? `
        <div>
          <!-- Sub-Filter Pills for Transfers -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 10px;">
            <div style="display: flex; gap: 6px;">
              ${[
                { id: 'ALL', label: 'All Transfers' },
                { id: 'PENDING', label: 'Pending Action' },
                { id: TRANSFER_STATUSES.COMPLETED, label: 'Completed' },
                { id: TRANSFER_STATUSES.REJECTED, label: 'Rejected' },
                { id: TRANSFER_STATUSES.REVISION_REQUESTED, label: 'Revision Requested' }
              ].map(f => `
                <button class="btn btn-sm btn-transfer-filter ${transferFilter === f.id ? 'btn-primary' : 'btn-secondary'}" data-filter="${f.id}" style="font-size: 11.5px;">
                  ${f.label}
                </button>
              `).join('')}
            </div>

            <div style="font-size: 11.5px; color: var(--text-muted);">
              Showing <strong>${displayTransfers.length}</strong> Transfer Records
            </div>
          </div>

          <!-- Transfers Cards List -->
          ${displayTransfers.length === 0 ? `
            <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 40px; text-align: center; color: var(--text-muted);">
              ✅ No transfer requests matching this filter criteria.
            </div>
          ` : `
            <div style="display: flex; flex-direction: column; gap: 16px;">
              ${displayTransfers.map(req => {
                if (!req) return '';
                const safeStatus = (req.status || TRANSFER_STATUSES.PENDING_APPROVAL).toString();
                const canUserApproveThis = (safeStatus === TRANSFER_STATUSES.PENDING_APPROVAL || safeStatus === TRANSFER_STATUSES.PARTIALLY_APPROVED) &&
                                           workflowService.canUserApproveStep(req, user);

                const isCompleted = safeStatus === TRANSFER_STATUSES.COMPLETED;
                const isRejected = safeStatus === TRANSFER_STATUSES.REJECTED;
                const isRevision = safeStatus === TRANSFER_STATUSES.REVISION_REQUESTED;

                const statusBadge = isCompleted ? 'badge-active' : (isRejected ? 'badge-breakdown' : (isRevision ? 'badge-maint' : 'badge-idle'));

                return `
                  <div style="background: var(--bg-surface); border: 1px solid ${canUserApproveThis ? '#38bdf8' : 'var(--border-color)'}; border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-sm);">
                    
                    <!-- Card Header -->
                    <div style="background: var(--bg-card); padding: 14px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); flex-wrap: wrap; gap: 10px;">
                      <div style="display: flex; align-items: center; gap: 12px;">
                        <span class="badge ${statusBadge}">${safeStatus.replace(/_/g, ' ')}</span>
                        <span style="font-family: var(--font-mono); font-size: 14px; font-weight: 800; color: #38bdf8;">
                          ${req.requestNumber || req.id || 'TR-REQ'}
                        </span>
                        <span style="font-weight: 700; color: #fff; font-size: 13.5px;">
                          ${req.machineInfo?.machineName || req.machineName || 'Machine'} (${req.machineInfo?.brand || '—'} ${req.machineInfo?.model || '—'})
                        </span>
                        <span style="font-family: var(--font-mono); font-size: 12px; color: #38bdf8; font-weight: 700;">
                          SN: ${req.machineInfo?.serialNumber || req.serialNumber || req.machineSerial || 'N/A'}
                        </span>
                      </div>

                      <div style="font-size: 11.5px; color: var(--text-muted);">
                        Requested by <strong>${req.requestedByName}</strong> (${req.requestedByRole}) &bull; ${new Date(req.requestedAt).toLocaleString()}
                      </div>
                    </div>

                    <!-- Card Body -->
                    <div style="padding: 18px 20px; display: flex; flex-direction: column; gap: 14px;">
                      <!-- Route Path -->
                      <div style="display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap;">
                        <div style="flex: 1; min-width: 220px; background: rgba(239, 68, 68, 0.08); border-left: 3px solid #ef4444; padding: 8px 12px; border-radius: var(--radius-sm);">
                          <div style="font-size: 10px; color: #f87171; font-weight: 800; text-transform: uppercase;">Source (Current Machine Location)</div>
                          <div style="font-size: 12px; font-weight: 700; color: #fff; margin-top: 2px;">${req.sourcePath}</div>
                        </div>

                        <div style="font-size: 18px; color: #38bdf8; font-weight: 800;">&rarr;</div>

                        <div style="flex: 1; min-width: 220px; background: rgba(16, 185, 129, 0.08); border-left: 3px solid #10b981; padding: 8px 12px; border-radius: var(--radius-sm);">
                          <div style="font-size: 10px; color: #34d399; font-weight: 800; text-transform: uppercase;">Target Destination Location</div>
                          <div style="font-size: 12px; font-weight: 700; color: #fff; margin-top: 2px;">${req.destPath}</div>
                        </div>
                      </div>

                      <!-- Reason & Notes -->
                      <div style="font-size: 12px; color: var(--text-secondary);">
                        <strong>Transfer Reason:</strong> "${req.reason}"<br/>
                        ${req.remarks ? `<strong>Staff Notes:</strong> <em>"${req.remarks}"</em><br/>` : ''}
                        <strong>Workflow:</strong> ${req.workflowName || 'Standard Protocol'}
                      </div>

                      <!-- Step-by-Step Approval Stepper Progress -->
                      <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 12px 14px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                          <div style="font-size: 11px; font-weight: 800; color: #fbbf24; text-transform: uppercase;">
                            Approval Progress (Stage ${isCompleted ? req.totalLevels : req.currentLevel} of ${req.totalLevels})
                          </div>
                          <div style="font-size: 11px; color: var(--text-muted);">
                            ${(req.documents || []).length} Management Document(s) Attached
                          </div>
                        </div>

                        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                          ${(req.levels || []).map(lvl => {
                            const isPast = lvl.status === 'APPROVED';
                            const isCurrent = (req.currentLevel === lvl.level) && !isCompleted && !isRejected;
                            const isLvlRej = lvl.status === 'REJECTED';

                            let color = '#64748b';
                            let icon = '🔒';
                            if (isPast) { color = '#34d399'; icon = '✓'; }
                            else if (isLvlRej) { color = '#f87171'; icon = '✕'; }
                            else if (isCurrent) { color = '#38bdf8'; icon = '⏳'; }

                            return `
                              <div style="background: var(--bg-surface); border: 1px solid ${color}; border-radius: var(--radius-sm); padding: 4px 10px; font-size: 11px; display: flex; align-items: center; gap: 6px;">
                                <span style="font-weight: 800; color: ${color}; font-family: var(--font-mono);">L-${lvl.level}:</span>
                                <span style="color: #fff; font-weight: 600;">${lvl.title}</span>
                                <span style="color: ${color}; font-weight: 700;">${icon}</span>
                              </div>
                            `;
                          }).join('')}
                        </div>
                      </div>
                    </div>

                    <!-- Card Footer Actions -->
                    <div style="background: var(--bg-card); padding: 12px 20px; border-top: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
                      <div>
                        <button class="btn btn-ghost btn-sm btn-print-transfer-quick" data-id="${req.id}" style="color: #38bdf8;">
                          🖨️ Official Gate Pass PDF
                        </button>
                      </div>

                      <div style="display: flex; gap: 8px;">
                        <button class="btn btn-secondary btn-sm btn-inspect-transfer" data-id="${req.id}">
                          👁️ View Full Details &amp; Documents
                        </button>

                        ${canUserApproveThis ? `
                          <button class="btn btn-warning btn-sm btn-transfer-action-revise" data-id="${req.id}">
                            ✏️ Request Revision
                          </button>
                          <button class="btn btn-danger btn-sm btn-transfer-action-reject" data-id="${req.id}">
                            ✕ Reject
                          </button>
                          <button class="btn btn-success btn-sm btn-transfer-action-approve" data-id="${req.id}" style="font-weight: 800;">
                            ✓ Approve Level ${req.currentLevel}
                          </button>
                        ` : ''}
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>
      ` : `
        <!-- TAB 2: INVENTORY PARAMETER EDITS -->
        <div>
          ${editRequests.length === 0 ? `
            <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 40px; text-align: center; color: var(--text-muted);">
              ✅ No parameter edit requests currently pending. All maintenance records are up to date.
            </div>
          ` : `
            <div style="display: flex; flex-direction: column; gap: 18px;">
              ${editRequests.map(req => {
                const isPending = req.status === 'PENDING';
                const statusClass = isPending ? 'badge-breakdown' : (req.status === 'APPROVED' ? 'badge-active' : 'badge-idle');

                return `
                  <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-sm);">
                    <!-- Request Card Header -->
                    <div style="background: var(--bg-card); padding: 14px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color);">
                      <div style="display: flex; align-items: center; gap: 12px;">
                        <span class="badge ${statusClass}">${req.status}</span>
                        <span style="font-size: 14px; font-weight: 700; color: #fff;">${req.type.replace('_', ' ')}</span>
                        <span style="font-family: var(--font-mono); font-size: 13px; color: #38bdf8; font-weight: 700;">
                          SN: ${req.machineInfo?.serialNumber || 'N/A'}
                        </span>
                        <span style="font-size: 12px; color: var(--text-secondary);">
                          (${req.machineInfo?.machineName} — ${req.machineInfo?.brand} ${req.machineInfo?.model})
                        </span>
                      </div>

                      <div style="font-size: 11.5px; color: var(--text-muted);">
                        Requested by <strong>${req.requestedByName}</strong> (${req.requestedByRole}) • ${new Date(req.requestedAt).toLocaleString()}
                      </div>
                    </div>

                    <!-- Visual Diff Table -->
                    <div style="padding: 20px; display: flex; flex-direction: column; gap: 14px;">
                      <div style="font-size: 12.5px; color: var(--text-secondary);">
                        <strong>Location Scope:</strong> ${req.targetLocation?.unit || '—'} &rarr; ${req.targetLocation?.floor || '—'} &rarr; ${req.targetLocation?.line || '—'}<br/>
                        <strong>Staff Notes:</strong> <em>"${req.remarks || 'None provided'}"</em>
                      </div>

                      <h5 style="font-size: 12px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">
                        📊 Side-by-Side Visual Parameter Diff
                      </h5>

                      <table class="diff-table">
                        <thead>
                          <tr>
                            <th style="width: 25%;">Modified Field</th>
                            <th style="width: 37.5%; color: #f87171;">Previous Value in Live Database</th>
                            <th style="width: 37.5%; color: #34d399;">Proposed New Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${(req.diffs || []).map(d => `
                            <tr>
                              <td style="font-weight: 600;">${d.label || d.field}</td>
                              <td class="diff-old-val">${d.oldValue}</td>
                              <td class="diff-new-val">${d.newValue}</td>
                            </tr>
                          `).join('')}
                        </tbody>
                      </table>
                    </div>

                    <!-- Footer -->
                    ${isPending && (isAdmin || authService.hasAccess('transfers', 'APPROVE')) ? `
                      <div style="background: var(--bg-card); padding: 12px 20px; border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end; gap: 10px;">
                        <button class="btn btn-warning btn-sm btn-action-revise-edit" data-id="${req.id}">
                          ✏️ Request Revision
                        </button>
                        <button class="btn btn-danger btn-sm btn-action-reject-edit" data-id="${req.id}">
                          ✕ Reject Request
                        </button>
                        <button class="btn btn-success btn-sm btn-action-approve-edit" data-id="${req.id}">
                          ✓ Approve &amp; Commit to Live Database
                        </button>
                      </div>
                    ` : ''}
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>
      `}
    </div>
  `;
}

export function initApprovalCenterEvents() {
  // Switch tabs
  document.querySelectorAll('.btn-approval-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activeApprovalTab = btn.getAttribute('data-tab');
      state.emit('inventory:updated');
    });
  });

  // Transfer filter buttons
  document.querySelectorAll('.btn-transfer-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      transferFilter = btn.getAttribute('data-filter');
      state.emit('inventory:updated');
    });
  });

  // Inspect transfer modal trigger
  document.querySelectorAll('.btn-inspect-transfer').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      state.set('activeTransferRequestId', id);
      state.set('activeModal', 'transfer-details');
    });
  });

  // Quick print PDF
  document.querySelectorAll('.btn-print-transfer-quick').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const req = transferService.getTransferRequestById(id);
      if (req) {
        pdfService.generateTransferGatePassPDF(req);
      }
    });
  });

  // Quick Approve Transfer from Card (1-Click Instant Approval)
  document.querySelectorAll('.btn-transfer-action-approve').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const req = transferService.getTransferRequestById(id);
      if (!req) return;
      const originalText = btn.innerHTML;
      try {
        btn.disabled = true;
        btn.innerHTML = '⚡ Approved!';
        await transferService.approveStep(id, 'Approved for relocation.');
        notificationService.success(`Transfer Request ${req.requestNumber} approved successfully!`);
        state.emit('inventory:updated');
        window.dispatchEvent(new CustomEvent('erp:transfers-updated'));
      } catch (e) {
        btn.disabled = false;
        btn.innerHTML = originalText;
        notificationService.error('Error: ' + e.message);
      }
    });
  });

  // Quick Reject Transfer
  document.querySelectorAll('.btn-transfer-action-reject').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const reason = prompt('Please enter the mandatory rejection reason:');
      if (reason !== null) {
        if (!reason.trim()) {
          alert('Rejection reason cannot be empty.');
          return;
        }
        try {
          btn.disabled = true;
          await transferService.rejectTransfer(id, reason);
          alert('Transfer rejected.');
          state.emit('inventory:updated');
          window.dispatchEvent(new CustomEvent('erp:transfers-updated'));
        } catch (e) {
          btn.disabled = false;
          alert('Error: ' + e.message);
        }
      }
    });
  });

  // Quick Return for Revision
  document.querySelectorAll('.btn-transfer-action-revise').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const comments = prompt('Enter required adjustments / missing permission note for technician:');
      if (comments !== null) {
        if (!comments.trim()) {
          alert('Revision comments cannot be empty.');
          return;
        }
        try {
          btn.disabled = true;
          await transferService.returnForRevision(id, comments);
          alert('Revision request sent to technician.');
          state.emit('inventory:updated');
          window.dispatchEvent(new CustomEvent('erp:transfers-updated'));
        } catch (e) {
          btn.disabled = false;
          alert('Error: ' + e.message);
        }
      }
    });
  });

  // Parameter Edit Actions
  document.querySelectorAll('.btn-action-approve-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const remarks = prompt('Approval remarks (optional):', 'Approved for production line deployment.');
      if (remarks !== null) {
        try {
          approvalService.approveRequest(id, remarks);
          alert('Request approved and changes successfully committed to the live inventory.');
          state.emit('inventory:updated');
        } catch (e) {
          alert('Error: ' + e.message);
        }
      }
    });
  });

  document.querySelectorAll('.btn-action-reject-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const remarks = prompt('Please enter rejection reason:');
      if (remarks !== null) {
        try {
          approvalService.rejectRequest(id, remarks);
          alert('Request rejected.');
          state.emit('inventory:updated');
        } catch (e) {
          alert('Error: ' + e.message);
        }
      }
    });
  });

  document.querySelectorAll('.btn-action-revise-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const remarks = prompt('Please specify the required adjustments for the technician:');
      if (remarks !== null) {
        try {
          approvalService.requestRevision(id, remarks);
          alert('Revision request sent to technician.');
          state.emit('inventory:updated');
        } catch (e) {
          alert('Error: ' + e.message);
        }
      }
    });
  });
}
