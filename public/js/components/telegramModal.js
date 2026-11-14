/**
 * Al-Muslim Group Maintenance ERP
 * Telegram Bot & Alerts Integration Modal
 * 
 * Allows users to link their ERP account to @MainterpBot for
 * real-time push alerts, transfer gate pass approvals, and machinery controls.
 */

import { authService } from '../services/authService.js';
import { notificationService } from '../services/notificationService.js';

let pollTimer = null;

export async function openTelegramModal() {
  const user = authService.getCurrentUser();
  if (!user) {
    notificationService.error('Please log in to manage Telegram alerts.');
    return;
  }

  // Remove any existing modal
  closeTelegramModal();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modal-telegram-overlay';
  overlay.style.cssText = 'z-index: 10095; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(0, 0, 0, 0.75); backdrop-filter: blur(6px);';

  overlay.innerHTML = `
    <div class="modal-dialog custom-scrollbar" style="max-width: 520px; width: 100%; max-height: 90vh; overflow-y: auto; background: var(--bg-card, #111827); border: 1.5px solid var(--border-color, #1e293b); border-radius: 12px; box-shadow: var(--shadow-lg, 0 20px 40px rgba(0,0,0,0.5)); display: flex; flex-direction: column;">
      
      <!-- Modal Header -->
      <div style="padding: 16px 20px; border-bottom: 1px solid var(--border-color, #1e293b); display: flex; align-items: center; justify-content: space-between; background: var(--bg-surface, #1e293b);">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 36px; height: 36px; border-radius: 8px; background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.3); display: flex; align-items: center; justify-content: center; font-size: 20px;">
            ✈️
          </div>
          <div>
            <h3 style="margin: 0; font-size: 15px; font-weight: 800; color: var(--text-main, #f8fafc);">Telegram Bot & Alerts</h3>
            <div style="font-size: 11.5px; color: var(--text-muted, #94a3b8); margin-top: 1px;">@MainterpBot • Role-Based Factory Floor Control</div>
          </div>
        </div>
        <button type="button" id="btn-close-telegram-modal" class="btn btn-ghost btn-sm" style="font-size: 18px; line-height: 1; padding: 4px 8px; color: var(--text-muted); cursor: pointer;" title="Close">&times;</button>
      </div>

      <!-- Modal Body -->
      <div id="telegram-modal-body" style="padding: 20px; display: flex; flex-direction: column; gap: 16px;">
        <div style="text-align: center; padding: 24px 0;">
          <div class="spinner" style="margin: 0 auto 12px auto;"></div>
          <div style="font-size: 12px; color: var(--text-muted);">Loading Telegram connection status...</div>
        </div>
      </div>

    </div>
  `;

  document.body.appendChild(overlay);

  // Close triggers
  const btnClose = overlay.querySelector('#btn-close-telegram-modal');
  if (btnClose) btnClose.addEventListener('click', closeTelegramModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeTelegramModal();
  });

  // Fetch status and render
  await loadTelegramStatus(user);
}

export function closeTelegramModal() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  const el = document.getElementById('modal-telegram-overlay');
  if (el) el.remove();
}

async function loadTelegramStatus(user) {
  const container = document.getElementById('telegram-modal-body');
  if (!container) return;

  try {
    const res = await fetch(`/api/telegram/status?userId=${encodeURIComponent(user.id)}`).then(r => r.json());
    
    if (res.linked) {
      renderConnectedView(container, user, res);
    } else {
      renderConnectView(container, user, res);
    }
  } catch (err) {
    container.innerHTML = `
      <div style="padding: 14px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; color: #f87171; font-size: 12px;">
        ⚠️ Failed to reach backend Telegram service: ${err.message}
      </div>
    `;
  }
}

function renderConnectView(container, user, meta) {
  container.innerHTML = `
    <div style="background: var(--bg-surface, rgba(255,255,255,0.03)); border: 1px solid var(--border-color, #1e293b); border-radius: 8px; padding: 14px; display: flex; flex-direction: column; gap: 8px;">
      <div style="font-size: 13px; font-weight: 700; color: var(--text-main);">
        Connect your ERP account to Telegram
      </div>
      <div style="font-size: 12px; color: var(--text-muted); line-height: 1.55;">
        By connecting <strong>@${meta.botUsername || 'MainterpBot'}</strong>, you will receive real-time alerts for machine breakdowns, approve transfer gate passes with 1-click, and check machinery status on your phone.
      </div>
    </div>

    <!-- Generating code area -->
    <div id="tg-code-box" style="text-align: center; padding: 14px; background: var(--bg-hover, rgba(56, 189, 248, 0.05)); border: 1.5px dashed var(--color-primary, #0284c7); border-radius: 8px;">
      <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); font-weight: 700;">Your 6-Digit Link Code</div>
      <div id="tg-display-code" style="font-family: var(--font-mono, monospace); font-size: 26px; font-weight: 800; color: #38bdf8; letter-spacing: 4px; margin: 8px 0;">
        ------
      </div>
      <div style="font-size: 11px; color: var(--text-muted);">Valid for 15 minutes</div>
    </div>

    <!-- Action Buttons -->
    <div style="display: flex; flex-direction: column; gap: 10px;">
      <a id="btn-tg-open-app" href="#" target="_blank" class="btn btn-primary" style="display: flex; align-items: center; justify-content: center; gap: 8px; text-decoration: none; min-height: 42px; font-weight: 800; font-size: 13px;">
        <span>✈️</span> Open in Telegram (@${meta.botUsername || 'MainterpBot'})
      </a>
      <button type="button" id="btn-tg-copy-code" class="btn btn-secondary" style="font-size: 12px; font-weight: 700;">
        📋 Copy Link Code
      </button>
    </div>

    <div style="font-size: 11.5px; color: var(--text-muted); border-top: 1px solid var(--border-color, #1e293b); padding-top: 12px;">
      💡 <strong>Alternative:</strong> Open Telegram, search for <code>@${meta.botUsername || 'MainterpBot'}</code>, and send:
      <div style="margin-top: 4px; font-family: monospace; background: var(--bg-surface); padding: 4px 8px; border-radius: 4px; display: inline-block;">
        /link <span id="tg-span-code">...</span>
      </div>
    </div>
  `;

  // Fetch actual code
  fetch('/api/telegram/generate-link-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: user.id })
  })
    .then(r => r.json())
    .then(data => {
      if (data.status === 'ok') {
        const codeEl = document.getElementById('tg-display-code');
        const spanCode = document.getElementById('tg-span-code');
        const openBtn = document.getElementById('btn-tg-open-app');
        const copyBtn = document.getElementById('btn-tg-copy-code');

        if (codeEl) codeEl.textContent = data.code;
        if (spanCode) spanCode.textContent = data.code;
        if (openBtn) openBtn.href = data.deepLink;

        if (copyBtn) {
          copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(data.code);
            notificationService.success(`Code ${data.code} copied to clipboard!`);
          });
        }

        // Start polling to detect when user links
        startPollingForConnection(user);
      }
    })
    .catch(err => {
      console.error('Failed to generate code:', err);
    });
}

function renderConnectedView(container, user, meta) {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }

  const linkedDate = meta.telegramLinkedAt ? new Date(meta.telegramLinkedAt).toLocaleDateString() : 'Active';

  container.innerHTML = `
    <div style="background: rgba(16, 185, 129, 0.08); border: 1.5px solid #10b981; border-radius: 8px; padding: 14px; display: flex; align-items: center; gap: 12px;">
      <div style="font-size: 28px;">✅</div>
      <div>
        <div style="font-size: 13.5px; font-weight: 800; color: #10b981;">Telegram Connected</div>
        <div style="font-size: 12px; color: var(--text-main); margin-top: 2px;">
          Linked as: <strong>@${meta.telegramUsername || 'Telegram User'}</strong>
        </div>
        <div style="font-size: 11px; color: var(--text-muted); margin-top: 1px;">
          Connected since: ${linkedDate}
        </div>
      </div>
    </div>

    <!-- Capabilities based on role -->
    <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 8px; padding: 12px;">
      <div style="font-size: 11.5px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px;">
        Active Features on Telegram:
      </div>
      <ul style="margin: 0; padding-left: 18px; font-size: 12px; color: var(--text-main); line-height: 1.6;">
        <li>🔍 <strong>Machine Search:</strong> Query any of 6,450 machines with <code>/find &lt;serial&gt;</code></li>
        <li>🚚 <strong>Gate Pass Approvals:</strong> Receive instant transfer requests with 1-click Approve/Reject</li>
        <li>🚑 <strong>Emergency Ambulance:</strong> Standby machine alerts for zero line downtime</li>
        <li>🛠️ <strong>PM Checklists:</strong> Preventive Maintenance task lists & quick sign-off</li>
      </ul>
    </div>

    <!-- Actions -->
    <div style="display: flex; gap: 10px; margin-top: 4px;">
      <a href="https://t.me/${meta.botUsername || 'MainterpBot'}" target="_blank" class="btn btn-primary" style="flex: 1; text-decoration: none; display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 12.5px; font-weight: 700;">
        <span>💬</span> Chat with Bot
      </a>
      <button type="button" id="btn-tg-unlink" class="btn btn-danger" style="font-size: 12px; font-weight: 700; padding: 0 14px;">
        Disconnect
      </button>
    </div>
  `;

  const btnUnlink = document.getElementById('btn-tg-unlink');
  if (btnUnlink) {
    btnUnlink.addEventListener('click', async () => {
      if (confirm('Are you sure you want to disconnect Telegram alerts?')) {
        try {
          const res = await fetch('/api/telegram/unlink', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id })
          }).then(r => r.json());

          if (res.status === 'ok') {
            notificationService.success('Telegram disconnected.');
            loadTelegramStatus(user);
          }
        } catch (err) {
          notificationService.error('Failed to unlink: ' + err.message);
        }
      }
    });
  }
}

function startPollingForConnection(user) {
  if (pollTimer) clearInterval(pollTimer);

  pollTimer = setInterval(async () => {
    try {
      const res = await fetch(`/api/telegram/status?userId=${encodeURIComponent(user.id)}`).then(r => r.json());
      if (res && res.linked) {
        clearInterval(pollTimer);
        pollTimer = null;
        notificationService.success(`🎉 Telegram linked successfully as @${res.telegramUsername || 'User'}!`);
        const container = document.getElementById('telegram-modal-body');
        if (container) {
          renderConnectedView(container, user, res);
        }
      }
    } catch (_) {}
  }, 3000);
}
