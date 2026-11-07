/**
 * Global Delete Confirmation System – Centralized Component & Service
 * 
 * Mandatory DELETE Confirmation Rule:
 * 1. Disable Instant Delete: No data can be deleted immediately.
 * 2. Mandatory DELETE Confirmation: User must type exactly "DELETE" (case-sensitive)
 *    before the final Delete button becomes enabled.
 * 3. Shows exact number of records/items to be deleted (single & bulk).
 * 4. Provides Cancel, Loading State, and Success/Error notifications.
 * 5. Reusable across the entire project (machines, parts, tools, users, master data, etc.).
 */

import { notificationService } from '../services/notificationService.js';
import { icon } from './icons.js?v=4.47.0';

let activeDeleteModalOverlay = null;

/**
 * Opens the centralized Delete Confirmation Modal.
 * 
 * @param {Object} options
 * @param {string} [options.title='Confirm Deletion'] - Modal title
 * @param {string} [options.message] - Warning message
 * @param {string} [options.itemName] - Name or code of the item being deleted
 * @param {string} [options.itemType='record'] - Type of entity (e.g. 'Machine', 'User Account')
 * @param {number} [options.count=1] - Number of items/records to be deleted
 * @param {string} [options.details] - Extra details or warning notes
 * @param {string} [options.confirmButtonText] - Custom label for the delete button
 * @param {string} [options.cancelButtonText='Cancel'] - Custom label for cancel button
 * @param {Function} [options.onConfirm] - Async function executed on confirmation
 * @param {Function} [options.onCancel] - Function executed on cancellation
 * @returns {Promise<boolean>} Resolves to true if confirmed and executed, false if cancelled
 */
export function openDeleteConfirmationModal(options = {}) {
  const {
    title = 'Confirm Permanent Deletion',
    message = 'Are you sure you want to permanently delete this data? This action cannot be undone.',
    itemName = '',
    itemType = 'record',
    count = 1,
    details = '',
    confirmButtonText = '',
    cancelButtonText = 'Cancel',
    onConfirm = null,
    onCancel = null
  } = options;

  return new Promise((resolve) => {
    // Clean up any existing delete modal
    if (activeDeleteModalOverlay && activeDeleteModalOverlay.parentNode) {
      activeDeleteModalOverlay.parentNode.removeChild(activeDeleteModalOverlay);
      activeDeleteModalOverlay = null;
    }

    const overlay = document.createElement('div');
    overlay.id = 'erp-delete-confirmation-overlay';
    overlay.className = 'modal-overlay active';
    overlay.style.zIndex = '100005';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.backgroundColor = 'rgba(5, 8, 16, 0.88)';
    overlay.style.backdropFilter = 'blur(6px)';

    const isBulk = count > 1;
    const finalConfirmLabel = confirmButtonText || (isBulk ? `Permanently Delete ${count} Records` : 'Permanently Delete');

    overlay.innerHTML = `
      <style>
        @keyframes deleteModalPop {
          0% { transform: scale(0.94); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
      </style>
      <div class="modal-card delete-confirmation-card" style="
        max-width: 480px;
        width: 92%;
        margin: auto;
        border-radius: 14px;
        background: #0f172a;
        border: 1.5px solid rgba(239, 68, 68, 0.45);
        box-shadow: 0 25px 60px -10px rgba(0, 0, 0, 0.9), 0 0 25px rgba(239, 68, 68, 0.2);
        color: #ffffff;
        animation: deleteModalPop 0.22s cubic-bezier(0.16, 1, 0.3, 1);
        overflow: hidden;
        height: auto !important;
        min-height: auto !important;
        max-height: 94vh;
        display: flex;
        flex-direction: column;
      ">
        <!-- Modal Header -->
        <div style="
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          background: linear-gradient(180deg, rgba(239, 68, 68, 0.15) 0%, rgba(239, 68, 68, 0.03) 100%);
          border-bottom: 1px solid rgba(239, 68, 68, 0.25);
        ">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="
              width: 36px;
              height: 36px;
              border-radius: 8px;
              background: rgba(239, 68, 68, 0.2);
              border: 1px solid rgba(239, 68, 68, 0.4);
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 18px;
            ">${icon('trash', { size: 18, color: '#f87171' })}</div>
            <div>
              <h3 style="margin: 0; font-size: 16px; font-weight: 800; color: #f87171; letter-spacing: -0.2px;">
                ${escapeHtml(title)}
              </h3>
              <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">
                Mandatory Authorization Check &bull; Permanent Removal
              </div>
            </div>
          </div>
          <button type="button" class="btn btn-ghost btn-sm" id="btn-delete-confirm-x" style="
            color: #94a3b8;
            border: none;
            background: transparent;
            font-size: 16px;
            cursor: pointer;
            padding: 4px 8px;
            line-height: 1;
            border-radius: 6px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
          " title="Cancel & Close">${icon('close', { size: 16, color: '#94a3b8' })}</button>
        </div>

        <!-- Modal Body -->
        <div style="padding: 20px; overflow-y: auto; max-height: 70vh;">
          <!-- Warning Banner -->
          <div style="
            background: rgba(239, 68, 68, 0.1);
            border: 1px solid rgba(239, 68, 68, 0.35);
            border-radius: 8px;
            padding: 12px 14px;
            margin-bottom: 16px;
            display: flex;
            align-items: flex-start;
            gap: 10px;
          ">
            <span style="font-size: 16px; line-height: 1; margin-top: 2px;">${icon('alertTriangle', { size: 16, color: '#ef4444' })}</span>
            <div style="font-size: 12.5px; color: #fca5a5; line-height: 1.5;">
              <strong>Irreversible Action:</strong> Once confirmed, this data will be permanently wiped from the database. Deleted records cannot be recovered.
            </div>
          </div>

          <!-- Impact Metrics Badge -->
          <div style="
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: rgba(15, 23, 42, 0.6);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 8px;
            padding: 10px 14px;
            margin-bottom: 14px;
          ">
            <span style="font-size: 12px; color: #94a3b8; font-weight: 600;">
              Total Records to Delete:
            </span>
            <span style="
              font-size: 12px;
              font-weight: 800;
              padding: 3px 10px;
              border-radius: 20px;
              background: ${isBulk ? 'rgba(239, 68, 68, 0.25)' : 'rgba(245, 158, 11, 0.2)'};
              border: 1px solid ${isBulk ? 'rgba(239, 68, 68, 0.5)' : 'rgba(245, 158, 11, 0.4)'};
              color: ${isBulk ? '#fca5a5' : '#fcd34d'};
            ">
              ${count} ${escapeHtml(itemType)}${count > 1 ? 's' : ''}
            </span>
          </div>

          <!-- Item Details or Custom Message -->
          ${itemName ? `
            <div style="
              background: rgba(255, 255, 255, 0.03);
              border-left: 3px solid #ef4444;
              padding: 8px 12px;
              margin-bottom: 14px;
              border-radius: 0 6px 6px 0;
            ">
              <div style="font-size: 11px; color: #94a3b8; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Target Entity:</div>
              <div style="font-size: 13px; font-weight: 700; color: #f8fafc; font-family: var(--font-mono, monospace); word-break: break-all; margin-top: 2px;">
                ${escapeHtml(itemName)}
              </div>
            </div>
          ` : ''}

          <div style="font-size: 13px; color: #cbd5e1; line-height: 1.5; margin-bottom: 16px;">
            ${message}
          </div>

          ${details ? `
            <div style="font-size: 12px; color: #94a3b8; line-height: 1.4; margin-bottom: 16px; font-style: italic;">
              ${details}
            </div>
          ` : ''}

          <!-- Mandatory Typed DELETE Input Verification Field -->
          <div style="
            background: rgba(0, 0, 0, 0.35);
            border: 1px dashed rgba(239, 68, 68, 0.45);
            border-radius: 8px;
            padding: 14px;
          ">
            <label for="erp-delete-confirm-input" style="
              display: block;
              font-size: 12px;
              font-weight: 700;
              color: #e2e8f0;
              margin-bottom: 8px;
              line-height: 1.4;
            ">
              To prevent accidental deletion, type <strong style="
                color: #ef4444;
                font-family: var(--font-mono, monospace);
                background: rgba(239, 68, 68, 0.15);
                padding: 2px 6px;
                border-radius: 4px;
                letter-spacing: 1px;
              ">DELETE</strong> to confirm:
            </label>

            <input
              type="text"
              id="erp-delete-confirm-input"
              class="form-control"
              placeholder="Type DELETE to confirm"
              autocomplete="off"
              autocorrect="off"
              autocapitalize="off"
              spellcheck="false"
              style="
                width: 100%;
                background: #090e1a;
                border: 1.5px solid #334155;
                border-radius: 6px;
                color: #ffffff;
                font-size: 14px;
                font-weight: 700;
                font-family: var(--font-mono, monospace);
                padding: 10px 12px;
                box-sizing: border-box;
                letter-spacing: 1px;
                transition: border-color 0.15s ease, box-shadow 0.15s ease;
              "
            />

            <!-- Real-time Live Match Helper Status -->
            <div id="erp-delete-confirm-feedback" style="
              margin-top: 6px;
              font-size: 11px;
              font-weight: 600;
              display: flex;
              align-items: center;
              gap: 4px;
              color: #64748b;
              min-height: 18px;
            ">
              <span>Type exact uppercase word: <code>DELETE</code></span>
            </div>
          </div>
        </div>

        <!-- Modal Footer Actions -->
        <div style="
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
          padding: 14px 20px;
          background: rgba(15, 23, 42, 0.95);
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        ">
          <button type="button" class="btn btn-secondary" id="btn-delete-confirm-cancel" style="
            font-size: 13px;
            font-weight: 600;
            padding: 8px 16px;
            min-height: 38px;
            border-radius: 6px;
          ">
            ${escapeHtml(cancelButtonText)}
          </button>

          <button
            type="button"
            class="btn btn-danger"
            id="btn-delete-confirm-submit"
            disabled
            style="
              font-size: 13px;
              font-weight: 800;
              padding: 8px 20px;
              min-height: 38px;
              border-radius: 6px;
              background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%);
              border: 1px solid #ef4444;
              color: #ffffff;
              opacity: 0.45;
              cursor: not-allowed;
              transition: opacity 0.15s ease, box-shadow 0.15s ease, transform 0.1s ease;
              display: inline-flex;
              align-items: center;
              gap: 8px;
            "
          >
            <span id="delete-btn-spinner" style="display: none;" class="btn-spinner"></span>
            <span id="delete-btn-label">${escapeHtml(finalConfirmLabel)}</span>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    activeDeleteModalOverlay = overlay;

    const inputEl = overlay.querySelector('#erp-delete-confirm-input');
    const submitBtn = overlay.querySelector('#btn-delete-confirm-submit');
    const cancelBtn = overlay.querySelector('#btn-delete-confirm-cancel');
    const closeXBtn = overlay.querySelector('#btn-delete-confirm-x');
    const feedbackEl = overlay.querySelector('#erp-delete-confirm-feedback');
    const spinnerEl = overlay.querySelector('#delete-btn-spinner');
    const labelEl = overlay.querySelector('#delete-btn-label');

    // Auto-focus input
    setTimeout(() => {
      try { inputEl?.focus(); } catch (_) {}
    }, 60);

    const closeModal = (confirmed) => {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
      activeDeleteModalOverlay = null;
      if (!confirmed && typeof onCancel === 'function') {
        try { onCancel(); } catch (_) {}
      }
      resolve(confirmed);
    };

    // Real-time verification listener
    inputEl?.addEventListener('input', () => {
      const val = inputEl.value;
      const isExactMatch = (val === 'DELETE');

      if (isExactMatch) {
        submitBtn.disabled = false;
        submitBtn.style.opacity = '1';
        submitBtn.style.cursor = 'pointer';
        submitBtn.style.boxShadow = '0 0 14px rgba(239, 68, 68, 0.55)';
        inputEl.style.borderColor = '#22c55e';
        inputEl.style.boxShadow = '0 0 0 2px rgba(34, 197, 94, 0.2)';
        feedbackEl.innerHTML = `<span style="color: #4ade80; display: inline-flex; align-items: center; gap: 5px;">${icon('checkCircle', { size: 14, color: '#4ade80' })} Exact match verified: Click button below to delete</span>`;
      } else {
        submitBtn.disabled = true;
        submitBtn.style.opacity = '0.45';
        submitBtn.style.cursor = 'not-allowed';
        submitBtn.style.boxShadow = 'none';

        if (val.length === 0) {
          inputEl.style.borderColor = '#334155';
          inputEl.style.boxShadow = 'none';
          feedbackEl.innerHTML = '<span style="color: #64748b;">Type exact uppercase word: <code>DELETE</code></span>';
        } else if (val.toUpperCase() === 'DELETE' && val !== 'DELETE') {
          inputEl.style.borderColor = '#f59e0b';
          inputEl.style.boxShadow = '0 0 0 2px rgba(245, 158, 11, 0.2)';
          feedbackEl.innerHTML = `<span style="color: #fbbf24; display: inline-flex; align-items: center; gap: 5px;">${icon('alertTriangle', { size: 14, color: '#fbbf24' })} Must be uppercase: Type <code>DELETE</code> (not lowercase)</span>`;
        } else {
          inputEl.style.borderColor = '#ef4444';
          inputEl.style.boxShadow = '0 0 0 2px rgba(239, 68, 68, 0.2)';
          feedbackEl.innerHTML = `<span style="color: #f87171; display: inline-flex; align-items: center; gap: 5px;">${icon('xCircle', { size: 14, color: '#f87171' })} Does not match: Type exact word <code>DELETE</code></span>`;
        }
      }
    });

    // Enter key submits if exact match
    inputEl?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (!submitBtn.disabled) {
          submitBtn.click();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeModal(false);
      }
    });

    // Handle Confirm Deletion
    submitBtn?.addEventListener('click', async () => {
      if (inputEl.value !== 'DELETE') return;

      // Enter loading state
      submitBtn.disabled = true;
      cancelBtn.disabled = true;
      closeXBtn.disabled = true;
      inputEl.disabled = true;
      if (spinnerEl) spinnerEl.style.display = 'inline-block';
      if (labelEl) labelEl.textContent = 'Deleting...';

      try {
        if (typeof onConfirm === 'function') {
          await onConfirm();
        }
        closeModal(true);
      } catch (err) {
        console.error('[Delete System Error]', err);
        notificationService.error(err.message || 'Deletion failed. Please try again.');
        // Re-enable in case user wants to retry or cancel
        submitBtn.disabled = false;
        cancelBtn.disabled = false;
        closeXBtn.disabled = false;
        inputEl.disabled = false;
        if (spinnerEl) spinnerEl.style.display = 'none';
        if (labelEl) labelEl.textContent = finalConfirmLabel;
      }
    });

    cancelBtn?.addEventListener('click', () => closeModal(false));
    closeXBtn?.addEventListener('click', () => closeModal(false));

    // Backdrop click cancels
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeModal(false);
      }
    });

    // Global Escape handler
    const escListener = (e) => {
      if (e.key === 'Escape' && activeDeleteModalOverlay === overlay) {
        window.removeEventListener('keydown', escListener);
        closeModal(false);
      }
    };
    window.addEventListener('keydown', escListener);
  });
}

/**
 * Global convenience helper for async delete confirmation.
 * Can be called with either options object or shorthand (title, message, count, itemName).
 */
export async function confirmDelete(options = {}) {
  return openDeleteConfirmationModal(options);
}

// Attach to window for seamless global availability across all modules
if (typeof window !== 'undefined') {
  window.openDeleteConfirmationModal = openDeleteConfirmationModal;
  window.confirmDelete = confirmDelete;

  // Global safety net: intercept and block any legacy or direct synchronous window.confirm calls
  // that attempt destructive operations without typed DELETE verification.
  if (window.confirm) {
    const _nativeConfirm = window.confirm.bind(window);
    window.confirm = function(message) {
      const msg = String(message || '').toLowerCase();
      if (
        msg.includes('delete') ||
        msg.includes('permanently') ||
        msg.includes('purge') ||
        msg.includes('wipe') ||
        (msg.includes('clear') && msg.includes('all'))
      ) {
        console.warn(
          '[Global Safety Enforcement] Direct synchronous window.confirm delete blocked. ' +
          'All destructive actions MUST use notificationService.confirmDelete(). Intercepted message:',
          message
        );
        if (window.notificationService?.error) {
          window.notificationService.error(
            'Direct deletion blocked: All delete actions require typed DELETE confirmation modal.'
          );
        }
        return false;
      }
      return _nativeConfirm(message);
    };
  }
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
