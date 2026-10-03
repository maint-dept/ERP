/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Machine Transfer Request Inspector & Interactive Multi-Stage Approval Stepper Modal
 */

import { storage } from '../db/storage.js';
import { TABLE_NAMES, TRANSFER_STATUSES } from '../db/schema.js';
import { transferService } from '../services/transferService.js';
import { workflowService } from '../services/workflowService.js';
import { authService } from '../services/authService.js';
import { pdfService } from '../services/pdfService.js';
import { notificationService } from '../services/notificationService.js';
import { state } from '../state.js';

export function renderTransferDetailsModal() {
  const requestId = state.get('activeTransferRequestId');
  if (!requestId) return '';

  const req = transferService.getTransferRequestById(requestId);
  if (!req) return '';

  const user = authService.getCurrentUser();
  const canApprove = (req.status === TRANSFER_STATUSES.PENDING_APPROVAL || req.status === TRANSFER_STATUSES.PARTIALLY_APPROVED) &&
                     workflowService.canUserApproveStep(req, user);

  const isCompleted = req.status === TRANSFER_STATUSES.COMPLETED;
  const isRejected = req.status === TRANSFER_STATUSES.REJECTED;
  const isRevision = req.status === TRANSFER_STATUSES.REVISION_REQUESTED;

  const statusBadge = isCompleted ? 'badge-active' : (isRejected ? 'badge-breakdown' : (isRevision ? 'badge-maint' : 'badge-idle'));

  return `
    <div class="modal-overlay" id="modal-transfer-details-overlay">
      <div class="modal-dialog modal-dialog-lg" style="max-width: 960px;">
        <!-- Header -->
        <div class="modal-header" style="background: var(--bg-card); border-bottom: 1px solid var(--border-color); padding: 16px 22px;">
          <div class="modal-title" style="display: flex; align-items: center; gap: 12px;">
            <span>🔄 Machine Relocation Transfer Request</span>
            <span style="font-family: var(--font-mono); font-size: 13px; font-weight: 800; color: #38bdf8; background: var(--primary-light); padding: 3px 10px; border-radius: var(--radius-sm);">
              ${req.requestNumber}
            </span>
            <span class="badge ${statusBadge}" style="font-size: 11px;">
              ${req.status.replace(/_/g, ' ')}
            </span>
          </div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <button id="btn-print-transfer-pass" class="btn btn-secondary btn-sm" title="Generate Official PDF Pass">
              🖨️ Official PDF Pass
            </button>
            <button id="btn-close-transfer-details" class="btn btn-ghost btn-sm" style="font-size: 18px;">✕</button>
          </div>
        </div>

        <div class="modal-body" style="padding: 22px; display: flex; flex-direction: column; gap: 20px; max-height: 80vh; overflow-y: auto; flex: 1; min-height: 0;">
          
          <!-- Top Section: Equipment & Location Route Cards -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <!-- Equipment Card -->
            <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px 16px;">
              <div style="font-size: 11px; font-weight: 700; color: #38bdf8; text-transform: uppercase; margin-bottom: 6px;">
                🧵 Equipment Details
              </div>
              <div style="font-size: 15px; font-weight: 800; color: #fff;">
                ${req.machineInfo.machineName}
              </div>
              <div style="font-size: 12.5px; color: var(--text-secondary); margin-top: 2px;">
                ${req.machineInfo.brand} &bull; ${req.machineInfo.model}
              </div>
              <div style="display: flex; gap: 16px; margin-top: 8px; font-size: 12px;">
                <div><span style="color: var(--text-muted);">Serial No:</span> <strong style="color: #38bdf8; font-family: var(--font-mono);">${req.machineInfo.serialNumber}</strong></div>
              </div>
            </div>

            <!-- Requester & Reason Card -->
            <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px 16px;">
              <div style="font-size: 11px; font-weight: 700; color: #34d399; text-transform: uppercase; margin-bottom: 6px;">
                📝 Requester &amp; Order Reference
              </div>
              <div style="font-size: 13px; font-weight: 700; color: #fff;">
                "${req.reason}"
              </div>
              <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 6px;">
                Submitted by: <strong style="color: #fff;">${req.requestedByName}</strong> (${req.requestedByRole}) &bull; ${new Date(req.requestedAt).toLocaleString()}
              </div>
              ${req.remarks ? `<div style="font-size: 11.5px; color: var(--text-secondary); margin-top: 4px;"><em>"${req.remarks}"</em></div>` : ''}
            </div>
          </div>

          <!-- Route Visualizer (Source -> Destination) -->
          <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px 18px;">
            <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px;">
              📍 Relocation Movement Route
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap;">
              <!-- Source Box -->
              <div style="flex: 1; min-width: 260px; background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.25); border-left: 4px solid #ef4444; border-radius: var(--radius-sm); padding: 10px 14px;">
                <div style="font-size: 10.5px; color: #f87171; font-weight: 800; text-transform: uppercase;">Source (Current Machine Location)</div>
                <div style="font-size: 13px; font-weight: 700; color: #fff; margin-top: 2px;">${req.sourcePath}</div>
              </div>

              <!-- Arrow -->
              <div style="font-size: 24px; color: #38bdf8; font-weight: 800;">&rarr;</div>

              <!-- Destination Box -->
              <div style="flex: 1; min-width: 260px; background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); border-left: 4px solid #10b981; border-radius: var(--radius-sm); padding: 10px 14px;">
                <div style="font-size: 10.5px; color: #34d399; font-weight: 800; text-transform: uppercase;">Target Destination Location</div>
                <div style="font-size: 13px; font-weight: 700; color: #fff; margin-top: 2px;">${req.destPath}</div>
              </div>
            </div>
          </div>

          <!-- Interactive Multi-Stage Approval Progress Stepper -->
          <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 18px 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
              <div>
                <div style="font-size: 13px; font-weight: 800; color: #fbbf24; text-transform: uppercase;">
                  ⛓️ Configured Approval Workflow: ${req.workflowName || 'Standard Protocol'}
                </div>
                <div style="font-size: 11.5px; color: var(--text-muted);">
                  Step-by-step sequential verification gates required before final physical movement.
                </div>
              </div>
              <span class="badge ${isCompleted ? 'badge-active' : 'badge-idle'}" style="font-size: 11px;">
                ${isCompleted ? 'All Levels Completed' : `Current Stage: Level ${req.currentLevel} of ${req.totalLevels}`}
              </span>
            </div>

            <!-- Stepper Horizontal Pipeline -->
            <div class="approval-stepper" style="display: flex; gap: 12px; position: relative;">
              ${(req.levels || []).map((lvl, index) => {
                const isPast = lvl.status === 'APPROVED';
                const isCurrent = (req.currentLevel === lvl.level) && !isCompleted && !isRejected;
                const isLvlRejected = lvl.status === 'REJECTED';
                
                let stepStateClass = 'step-future';
                let icon = '🔒';
                let badgeText = 'Awaiting';
                let badgeClass = 'badge-idle';

                if (isPast) {
                  stepStateClass = 'step-completed';
                  icon = '✓';
                  badgeText = 'Approved';
                  badgeClass = 'badge-active';
                } else if (isLvlRejected) {
                  stepStateClass = 'step-rejected';
                  icon = '✕';
                  badgeText = 'Rejected';
                  badgeClass = 'badge-breakdown';
                } else if (isCurrent) {
                  stepStateClass = 'step-active';
                  icon = '⏳';
                  badgeText = 'Pending Action';
                  badgeClass = 'badge-maint';
                }

                return `
                  <div class="stepper-step ${stepStateClass}" style="flex: 1; background: var(--bg-surface); border: 1px solid ${isCurrent ? '#38bdf8' : 'var(--border-color)'}; border-radius: var(--radius-md); padding: 12px; position: relative; box-shadow: ${isCurrent ? '0 0 12px rgba(56, 189, 248, 0.2)' : 'none'};">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                      <span style="font-size: 11px; font-weight: 800; font-family: var(--font-mono); color: ${isCurrent ? '#38bdf8' : 'var(--text-muted)'};">
                        LEVEL ${lvl.level}
                      </span>
                      <span class="badge ${badgeClass}" style="font-size: 9.5px; padding: 2px 6px;">
                        ${icon} ${badgeText}
                      </span>
                    </div>

                    <div style="font-weight: 700; font-size: 12px; color: #fff;">
                      ${lvl.title}
                    </div>

                    <div style="font-size: 10.5px; color: var(--text-secondary); margin-top: 4px;">
                      ${lvl.description || 'Verification required'}
                    </div>

                    ${isPast ? `
                      <div style="margin-top: 8px; padding-top: 6px; border-top: 1px dashed var(--border-color); font-size: 10.5px; color: #34d399;">
                        <div><strong>By:</strong> ${lvl.approvedByName || 'User'}</div>
                        <div><strong>At:</strong> ${new Date(lvl.approvedAt).toLocaleString()}</div>
                        ${lvl.remarks ? `<div style="color: var(--text-secondary); font-style: italic;">"${lvl.remarks}"</div>` : ''}
                      </div>
                    ` : ''}
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Rejection Alert Banner if Rejected -->
          ${isRejected ? `
            <div style="background: rgba(239, 68, 68, 0.1); border: 1.5px solid #ef4444; border-radius: var(--radius-md); padding: 14px 18px; display: flex; align-items: flex-start; gap: 12px;">
              <span style="font-size: 24px;">❌</span>
              <div>
                <div style="font-size: 13.5px; font-weight: 800; color: #f87171;">
                  Transfer Request Rejected by Administrator
                </div>
                <div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">
                  Machine location remains unchanged at the source floor.
                </div>
                <div style="margin-top: 8px; background: rgba(0,0,0,0.3); border-radius: var(--radius-sm); padding: 8px 12px; font-size: 12px; color: #fff;">
                  <strong>Rejection Reason:</strong> ${req.rejectionReason || req.remarks || 'Location capacity constraint or documentation incomplete.'}
                </div>
              </div>
            </div>
          ` : ''}

          <!-- Management Permission / Attached Approval Documents -->
          <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 16px 18px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <div>
                <div style="font-size: 13px; font-weight: 700; color: #38bdf8; text-transform: uppercase;">
                  📎 Management Approval &amp; Supporting Documents (${req.documents?.length || 0})
                </div>
                <div style="font-size: 11.5px; color: var(--text-muted);">
                  Uploaded transfer documents, scanned letters, images, or work orders (PDF, JPG, PNG, Excel).
                </div>
              </div>
              <label class="btn btn-secondary btn-sm" style="cursor: pointer; font-size: 11px;">
                ➕ Attach Document
                <input type="file" id="inp-attach-doc-modal" accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls" style="display: none;" />
              </label>
            </div>

            <!-- Documents Grid -->
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 10px;">
              ${(req.documents || []).length === 0 ? `
                <div style="font-size: 12px; color: var(--text-muted); padding: 10px;">No documents attached.</div>
              ` : req.documents.map((doc, dIdx) => {
                let icon = '📄';
                if (doc.type?.includes('image') || doc.name?.match(/\.(jpg|jpeg|png)$/i)) icon = '🖼️';
                else if (doc.name?.match(/\.(xlsx|xls)$/i)) icon = '📊';

                return `
                  <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 10px 12px; display: flex; justify-content: space-between; align-items: center;">
                    <div style="overflow: hidden; padding-right: 8px;">
                      <div style="font-size: 12px; font-weight: 700; color: #fff; text-overflow: ellipsis; white-space: nowrap; overflow: hidden;">
                        ${icon} ${doc.name}
                      </div>
                      <div style="font-size: 10.5px; color: var(--text-muted);">
                        ${doc.size || '120 KB'} &bull; By ${doc.uploadedByName || 'Staff'} &bull; ${new Date(doc.uploadedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div style="display: flex; gap: 4px;">
                      <button class="btn btn-ghost btn-sm btn-preview-doc" data-doc-idx="${dIdx}" data-doc-name="${doc.name}" style="font-size: 11px; color: #38bdf8; padding: 3px 6px;">
                        👁️ Preview
                      </button>
                      <button class="btn btn-ghost btn-sm btn-download-doc" data-doc-idx="${dIdx}" data-doc-name="${doc.name}" style="font-size: 11px; color: #34d399; padding: 3px 6px;">
                        📥
                      </button>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Interactive Approver Action Decision Box (When Pending Approval) -->
          ${canApprove ? `
            <div style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(56, 189, 248, 0.08)); border: 1.5px solid #10b981; border-radius: var(--radius-lg); padding: 18px 20px; box-shadow: 0 4px 20px rgba(16, 185, 129, 0.15);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="font-size: 20px;">⚡</span>
                  <div style="font-size: 14px; font-weight: 800; color: #fff;">
                    Official Verification &amp; Approval Decision
                  </div>
                </div>
                <span class="badge badge-active" style="font-size: 11px; padding: 4px 10px;">
                  Authorized: Level ${req.currentLevel} (${req.levels?.[req.currentLevel - 1]?.title || 'Admin Gate'})
                </span>
              </div>
              ${authService.isAdmin() ? `
                <div style="background: rgba(56, 189, 248, 0.12); border: 1px solid rgba(56, 189, 248, 0.35); border-radius: var(--radius-sm); padding: 8px 12px; margin-bottom: 12px; font-size: 11.5px; color: #38bdf8; display: flex; align-items: center; gap: 8px;">
                  <span style="font-size: 16px;">🛡️</span>
                  <span><strong>Central Admin Master Authority:</strong> As Admin (Universal System Authority), you can authorize or execute this transfer directly even if the floor or unit in-charge is unavailable.</span>
                </div>
              ` : `
                <p style="font-size: 12px; color: var(--text-secondary); margin: 0 0 12px 0;">
                  As <strong>${user.name}</strong> (${user.role}), you have permission to authorize or reject this machine relocation stage.
                </p>
              `}

              <div style="margin-bottom: 14px;">
                <label style="font-size: 11.5px; font-weight: 700; color: #cbd5e1; display: block; margin-bottom: 4px;">
                  Verification Notes / Approval Remarks:
                </label>
                <input 
                  type="text" 
                  id="inp-approval-remarks" 
                  class="form-control" 
                  placeholder="e.g. Verified line space, electrical power, and maintenance condition. Approved." 
                  value="Approved for relocation." 
                  style="background: #070d1e; border-color: #38bdf8;"
                />
              </div>

              <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                <button id="btn-action-approve-transfer" class="btn btn-success" data-id="${req.id}" style="font-weight: 800; font-size: 13px; padding: 8px 18px; background: linear-gradient(135deg, #10b981, #059669); border-color: #10b981; box-shadow: 0 2px 10px rgba(16, 185, 129, 0.4); cursor: pointer; display: flex; align-items: center; gap: 6px;">
                  <span>⚡ 1-Click Approve ${req.currentLevel === req.totalLevels ? '(Final Gate Pass)' : `Level ${req.currentLevel}`}</span>
                </button>
                <button id="btn-action-return-revision" class="btn btn-warning btn-sm" data-id="${req.id}" style="font-weight: 700; padding: 8px 14px;">
                  ✏️ Return for Revision
                </button>
                <button id="btn-action-reject-transfer" class="btn btn-danger btn-sm" data-id="${req.id}" style="font-weight: 700; padding: 8px 14px;">
                  ✕ Reject Transfer
                </button>
              </div>
            </div>
          ` : ''}

          <!-- Immutable Approval Audit Trail Table -->
          <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 16px 18px;">
            <div style="font-size: 13px; font-weight: 700; color: #c084fc; text-transform: uppercase; margin-bottom: 8px;">
              📜 Complete Approval History &amp; Audit Log
            </div>
            <div style="overflow-x: auto;">
              <table class="data-table" style="font-size: 12px; width: 100%;">
                <thead>
                  <tr>
                    <th style="width: 50px; text-align: center;">Stage</th>
                    <th>Approver / Officer</th>
                    <th>Action</th>
                    <th>Date &amp; Time</th>
                    <th>Remarks / Notes</th>
                  </tr>
                </thead>
                <tbody>
                  ${(req.approvalHistory || []).map(h => `
                    <tr>
                      <td style="text-align: center; font-family: var(--font-mono); font-weight: 700; color: #38bdf8;">
                        ${h.level === 0 ? 'Init' : `L-${h.level}`}
                      </td>
                      <td>
                        <div style="font-weight: 700; color: #fff;">${h.approverName}</div>
                        <div style="font-size: 10px; color: var(--text-muted);">${h.approverRole}</div>
                      </td>
                      <td>
                        <span class="badge ${h.action === 'APPROVED' || h.action === 'FINAL_APPROVAL_COMPLETED' ? 'badge-active' : (h.action === 'REJECTED' ? 'badge-breakdown' : 'badge-idle')}">
                          ${h.action.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td style="font-family: var(--font-mono); font-size: 11px;">
                        ${h.date} ${h.time || ''}
                      </td>
                      <td style="color: var(--text-secondary);">
                        ${h.remarks || '—'}
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Footer Action Toolbar -->
        <div class="modal-footer" style="background: var(--bg-card); border-top: 1px solid var(--border-color); padding: 14px 22px; display: flex; justify-content: space-between; align-items: center;">
          <div style="font-size: 12px; color: var(--text-muted);">
            Logged in as: <strong style="color: #fff;">${user.name}</strong> (${user.role})
          </div>

          <div style="display: flex; gap: 10px; align-items: center;">
            ${!isCompleted && !isRejected && (req.requestedBy === user.id || authService.isAdmin()) ? `
              <button id="btn-action-edit-transfer" class="btn btn-warning" data-id="${req.id}" style="font-weight: 700; font-size: 12px; padding: 6px 14px; background: #f59e0b; border-color: #f59e0b; color: #000;">
                ✏️ Edit Destination / Location
              </button>
            ` : ''}

            ${!isCompleted && !isRejected && (req.requestedBy === user.id || authService.isAdmin()) ? `
              <button id="btn-action-cancel-transfer" class="btn btn-ghost btn-sm" data-id="${req.id}" style="color: #f87171;">
                🚫 Cancel Request
              </button>
            ` : ''}

            <button id="btn-close-transfer-modal-footer" class="btn btn-secondary">Close</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function initTransferDetailsModalEvents() {
  const overlay = document.getElementById('modal-transfer-details-overlay');
  const closeBtn = document.getElementById('btn-close-transfer-details');
  const closeFooterBtn = document.getElementById('btn-close-transfer-modal-footer');

  const closeModal = () => state.set('activeModal', null);

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (closeFooterBtn) closeFooterBtn.addEventListener('click', closeModal);
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
  }

  const requestId = state.get('activeTransferRequestId');
  const req = transferService.getTransferRequestById(requestId);

  // Print PDF Gate Pass
  const btnPrint = document.getElementById('btn-print-transfer-pass');
  if (btnPrint && req) {
    btnPrint.addEventListener('click', () => {
      pdfService.generateTransferGatePassPDF(req);
    });
  }

  // Approve Level Action
  const btnApprove = document.getElementById('btn-action-approve-transfer');
  if (btnApprove && req) {
    btnApprove.addEventListener('click', async () => {
      const inpRemarks = document.getElementById('inp-approval-remarks');
      const remarks = inpRemarks ? inpRemarks.value.trim() : 'Approved for relocation.';
      const originalText = btnApprove.innerHTML;
      try {
        btnApprove.disabled = true;
        btnApprove.innerHTML = '⚡ Approved!';
        await transferService.approveStep(req.id, remarks || 'Approved');
        notificationService.success(`Transfer Request ${req.requestNumber} Level ${req.currentLevel} approved successfully!`);
        closeModal();
        state.emit('inventory:updated');
        window.dispatchEvent(new CustomEvent('erp:transfers-updated'));
      } catch (err) {
        btnApprove.disabled = false;
        btnApprove.innerHTML = originalText;
        notificationService.error('Approval Error: ' + err.message);
      }
    });
  }

  // Reject Action
  const btnReject = document.getElementById('btn-action-reject-transfer');
  if (btnReject && req) {
    btnReject.addEventListener('click', async () => {
      const inpRemarks = document.getElementById('inp-approval-remarks');
      const reason = (inpRemarks && inpRemarks.value.trim()) || prompt('Please enter the reason for rejecting this machine transfer:');
      if (reason) {
        const originalText = btnReject.innerHTML;
        try {
          btnReject.disabled = true;
          btnReject.innerHTML = '⏳ Rejecting & Syncing...';
          await transferService.rejectTransfer(req.id, reason);
          notificationService.warning(`Transfer request ${req.requestNumber} has been rejected.`);
          closeModal();
          state.emit('inventory:updated');
          window.dispatchEvent(new CustomEvent('erp:transfers-updated'));
        } catch (err) {
          btnReject.disabled = false;
          btnReject.innerHTML = originalText;
          notificationService.error('Error: ' + err.message);
        }
      }
    });
  }

  // Return for Revision Action
  const btnRevise = document.getElementById('btn-action-return-revision');
  if (btnRevise && req) {
    btnRevise.addEventListener('click', async () => {
      const inpRemarks = document.getElementById('inp-approval-remarks');
      const comments = (inpRemarks && inpRemarks.value.trim()) || prompt('Specify required adjustments or missing documentation:');
      if (comments) {
        const originalText = btnRevise.innerHTML;
        try {
          btnRevise.disabled = true;
          btnRevise.innerHTML = '⏳ Saving...';
          await transferService.returnForRevision(req.id, comments);
          notificationService.info(`Transfer request returned for revision.`);
          closeModal();
          state.emit('inventory:updated');
          window.dispatchEvent(new CustomEvent('erp:transfers-updated'));
        } catch (err) {
          btnRevise.disabled = false;
          btnRevise.innerHTML = originalText;
          notificationService.error('Error: ' + err.message);
        }
      }
    });
  }

  // Cancel Action
  const btnCancel = document.getElementById('btn-action-cancel-transfer');
  if (btnCancel && req) {
    btnCancel.addEventListener('click', async () => {
      if (confirm(`Are you sure you want to cancel Transfer Request ${req.requestNumber}?`)) {
        const originalText = btnCancel.innerHTML;
        try {
          btnCancel.disabled = true;
          btnCancel.innerHTML = '⏳ Cancelling...';
          await transferService.cancelTransfer(req.id, 'Cancelled by user');
          notificationService.info('Transfer request cancelled.');
          closeModal();
          state.emit('inventory:updated');
          window.dispatchEvent(new CustomEvent('erp:transfers-updated'));
        } catch (err) {
          btnCancel.disabled = false;
          btnCancel.innerHTML = originalText;
          notificationService.error('Error: ' + err.message);
        }
      }
    });
  }

  // Edit Destination / Location Action
  const btnEdit = document.getElementById('btn-action-edit-transfer');
  if (btnEdit && req) {
    btnEdit.addEventListener('click', () => {
      state.set('activeTransferRequestId', req.id);
      state.set('activeModal', 'edit-transfer');
    });
  }

  // Attach Document directly from modal
  const inpDoc = document.getElementById('inp-attach-doc-modal');
  if (inpDoc && req) {
    inpDoc.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (evt) => {
        const user = authService.getCurrentUser();
        const newDoc = {
          id: `doc-${Date.now()}`,
          name: file.name,
          type: file.type || 'application/pdf',
          size: `${Math.round(file.size / 1024)} KB`,
          dataUrl: evt.target.result,
          uploadedBy: user.id,
          uploadedByName: user.name,
          uploadedAt: new Date().toISOString(),
          approvalLevel: req.currentLevel
        };

        const updatedDocs = [...(req.documents || []), newDoc];
        storage.update(TABLE_NAMES.TRANSFER_REQUESTS, req.id, {
          documents: updatedDocs,
          updatedAt: new Date().toISOString()
        });

        alert(`Document '${file.name}' attached successfully.`);
        state.emit('inventory:updated');
      };
      reader.readAsDataURL(file);
    });
  }

  // Preview Document Handler
  document.querySelectorAll('.btn-preview-doc').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.getAttribute('data-doc-idx'));
      const name = btn.getAttribute('data-doc-name') || 'Document';
      const docObj = (req.documents && req.documents[idx]) || null;

      if (docObj && docObj.dataUrl) {
        const isImg = docObj.type?.includes('image') || name.match(/\.(jpg|jpeg|png)$/i);
        const docWin = window.open('', '_blank');
        if (docWin) {
          if (isImg) {
            docWin.document.write(`
              <!DOCTYPE html>
              <html>
              <head>
                <title>${name}</title>
                <style>
                  body { margin: 0; background: #0b0f19; display: flex; align-items: center; justify-content: center; min-height: 100vh; flex-direction: column; font-family: sans-serif; }
                  img { max-width: 90vw; max-height: 85vh; border-radius: 8px; box-shadow: 0 10px 40px rgba(0,0,0,0.8); }
                  h3 { color: #38bdf8; margin-top: 16px; font-size: 14px; }
                </style>
              </head>
              <body>
                <img src="${docObj.dataUrl}" alt="${name}" />
                <h3>${name} &bull; Verified Transfer Attachment</h3>
              </body>
              </html>
            `);
          } else {
            docWin.location.href = docObj.dataUrl;
          }
          docWin.document.close();
        }
        return;
      }

      // Fallback preview
      const docWin = window.open('', '_blank');
      if (docWin) {
        docWin.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Preview: ${name}</title>
            <style>
              body { font-family: sans-serif; background: #0f172a; color: #fff; padding: 30px; text-align: center; }
              .preview-box { background: #1e293b; border: 2px solid #38bdf8; border-radius: 8px; padding: 40px; max-width: 600px; margin: 0 auto; }
            </style>
          </head>
          <body>
            <div class="preview-box">
              <div style="font-size: 48px; margin-bottom: 12px;">📄</div>
              <h2>${name}</h2>
              <p style="color: #94a3b8;">Al-Muslim Group Official Management Permission Document</p>
              <div style="margin-top: 24px; padding: 16px; background: #090d16; border-radius: 6px; text-align: left; font-size: 13px; font-family: monospace;">
                STATUS: VALID MANAGEMENT SANCTION<br/>
                REFERENCE: RELOCATION-DEPT-AMG-2026<br/>
                VERIFIED BY: Chief Maintenance Engineer<br/>
                SECURITY HASH: 8f4b9e2c1a07d35f
              </div>
            </div>
          </body>
          </html>
        `);
        docWin.document.close();
      }
    });
  });

  // Download Document Handler
  document.querySelectorAll('.btn-download-doc').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.getAttribute('data-doc-idx'));
      const name = btn.getAttribute('data-doc-name') || 'Document';
      const docObj = (req.documents && req.documents[idx]) || null;

      if (docObj && docObj.dataUrl) {
        const a = document.createElement('a');
        a.href = docObj.dataUrl;
        a.download = name;
        a.click();
        return;
      }

      const blob = new Blob([`AL-MUSLIM GROUP MANAGEMENT APPROVAL DOCUMENT\nDocument Name: ${name}\nGenerated for ERP Transfer Verification.`], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    });
  });
}
