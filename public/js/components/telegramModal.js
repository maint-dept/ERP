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
  const isExecutive = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN' || user.id === 'usr-super-admin';
  const roleBadge = isExecutive 
    ? '<span class="badge" style="background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3); font-size: 10px; padding: 2px 6px; border-radius: 4px;">👑 Executive Sentinel &amp; Operations</span>'
    : '<span class="badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); font-size: 10px; padding: 2px 6px; border-radius: 4px;">🔧 Operations &amp; Mechanics</span>';

  const executiveExplanation = isExecutive ? `
    <div style="background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 8px; padding: 10px 12px; font-size: 11.5px; color: var(--text-main); line-height: 1.5;">
      👑 <strong>Dual-Bot Executive Sync:</strong> Entering this 6-digit code in either bot will activate full unrestricted access across both <strong>@MaintAdminbot</strong> (Executive Approvals &amp; Sirens) and <strong>@MainterpBot</strong> (Machinery &amp; Floor Operations).
    </div>
  ` : '';

  const buttonsHtml = isExecutive ? `
    <div style="display: flex; flex-direction: column; gap: 8px;">
      <a id="btn-tg-open-app" href="https://t.me/MaintAdminbot" target="_blank" class="btn btn-primary" style="display: flex; align-items: center; justify-content: center; gap: 8px; text-decoration: none; min-height: 40px; font-weight: 800; font-size: 12.5px; background: linear-gradient(135deg, #f59e0b, #d97706); border-color: #d97706; color: #fff;">
        <span>👑</span> Open Executive Sentinel (@MaintAdminbot)
      </a>
      <a id="btn-tg-open-userbot" href="https://t.me/MainterpBot" target="_blank" class="btn btn-secondary" style="display: flex; align-items: center; justify-content: center; gap: 8px; text-decoration: none; min-height: 38px; font-weight: 700; font-size: 12px;">
        <span>⚙️</span> Open Operations Bot (@MainterpBot)
      </a>
      <button type="button" id="btn-tg-copy-code" class="btn btn-ghost" style="font-size: 12px; font-weight: 700; border: 1px solid var(--border-color);">
        📋 Copy 6-Digit Link Code
      </button>
    </div>
  ` : `
    <div style="display: flex; flex-direction: column; gap: 8px;">
      <a id="btn-tg-open-app" href="https://t.me/MainterpBot" target="_blank" class="btn btn-primary" style="display: flex; align-items: center; justify-content: center; gap: 8px; text-decoration: none; min-height: 42px; font-weight: 800; font-size: 13px;">
        <span>✈️</span> Open in Telegram (@MainterpBot)
      </a>
      <button type="button" id="btn-tg-copy-code" class="btn btn-secondary" style="font-size: 12px; font-weight: 700;">
        📋 Copy Link Code
      </button>
    </div>
  `;

  container.innerHTML = `
    <div style="background: var(--bg-surface, rgba(255,255,255,0.03)); border: 1px solid var(--border-color, #1e293b); border-radius: 8px; padding: 14px; display: flex; flex-direction: column; gap: 8px;">
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <div style="font-size: 13px; font-weight: 700; color: var(--text-main);">
          ${isExecutive ? 'Connect Executive Sentinel & Operations' : 'Connect Operations Bot'}
        </div>
        ${roleBadge}
      </div>
      <div style="font-size: 12px; color: var(--text-muted); line-height: 1.55;">
        ${isExecutive 
          ? 'Link your account to receive live factory breakdown sirens, authorize gate passes with 1-click, and query any machinery.'
          : 'Connect <strong>@MainterpBot</strong> to look up machine locations, complete daily PM checklists, and check your assigned tools.'}
      </div>
      ${executiveExplanation}
    </div>

    <!-- Generating code area -->
    <div id="tg-code-box" style="text-align: center; padding: 14px; background: var(--bg-hover, rgba(56, 189, 248, 0.05)); border: 1.5px dashed var(--color-primary, #0284c7); border-radius: 8px;">
      <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); font-weight: 700;">Your 6-Digit Link Code</div>
      <div id="tg-display-code" style="font-family: var(--font-mono, monospace); font-size: 28px; font-weight: 800; color: #38bdf8; letter-spacing: 5px; margin: 8px 0;">
        ------
      </div>
      <div style="font-size: 11px; color: var(--text-muted);">Valid for 15 minutes • Auto-activating on code receipt</div>
    </div>

    <!-- Action Buttons -->
    ${buttonsHtml}

    <div style="font-size: 11.5px; color: var(--text-muted); border-top: 1px solid var(--border-color, #1e293b); padding-top: 12px;">
      💡 <strong>Quick Instructions:</strong> Open Telegram and send the 6-digit code (e.g. <code id="tg-span-code">...</code> or <code>/link <span id="tg-span-code2">...</span></code>) to activate immediately.
      ${isExecutive ? '<div style="font-size: 11px; color: var(--color-warning, #f59e0b); margin-top: 6px;">👑 <strong>Instant Super Admin Claim:</strong> You can also send <code>/claim motaher</code> to <strong>@MaintAdminbot</strong> to link immediately.</div>' : ''}
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
        const spanCode2 = document.getElementById('tg-span-code2');
        const openBtn = document.getElementById('btn-tg-open-app');
        const openUserBtn = document.getElementById('btn-tg-open-userbot');
        const copyBtn = document.getElementById('btn-tg-copy-code');

        if (codeEl) codeEl.textContent = data.code;
        if (spanCode) spanCode.textContent = data.code;
        if (spanCode2) spanCode2.textContent = data.code;
        if (openBtn) openBtn.href = data.adminBotDeepLink || data.deepLink;
        if (openUserBtn) openUserBtn.href = data.userBotDeepLink || `https://t.me/MainterpBot?start=AMG_${data.code}`;

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

  const isExecutive = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN' || user.id === 'usr-super-admin';
  const linkedDate = meta.telegramLinkedAt ? new Date(meta.telegramLinkedAt).toLocaleDateString() : 'Active';

  container.innerHTML = `
    <div style="background: rgba(16, 185, 129, 0.08); border: 1.5px solid #10b981; border-radius: 8px; padding: 14px; display: flex; align-items: center; gap: 12px;">
      <div style="font-size: 28px;">✅</div>
      <div>
        <div style="font-size: 13.5px; font-weight: 800; color: #10b981;">Telegram Connected</div>
        <div style="font-size: 12px; color: var(--text-main); margin-top: 2px;">
          Linked as: <strong>@${meta.telegramUsername || 'Telegram User'}</strong>
          ${isExecutive ? ' <span class="badge" style="background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3); font-size: 10px; padding: 1px 5px; border-radius: 4px;">Super Admin (Dual Bot)</span>' : ''}
        </div>
        <div style="font-size: 11px; color: var(--text-muted); margin-top: 1px;">
          Connected since: ${linkedDate} • Factory-Wide Full Access
        </div>
      </div>
    </div>

    <!-- Capabilities based on role -->
    <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 8px; padding: 12px;">
      <div style="font-size: 11.5px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px;">
        Active Features on Telegram:
      </div>
      <ul style="margin: 0; padding-left: 18px; font-size: 12px; color: var(--text-main); line-height: 1.6;">
        <li>🔍 <strong>Factory-Wide Machine Search:</strong> Query any machine with <code>/find &lt;serial&gt;</code> in both bots</li>
        <li>🚚 <strong>Machine Transfer &amp; Relocation:</strong> Request or execute transfers with <code>/transfer &lt;serial&gt; &lt;line&gt;</code></li>
        <li>🛠️ <strong>Machine Servicing &amp; PM:</strong> Log repairs and restore running status with <code>/service &lt;serial&gt; &lt;work&gt;</code></li>
        ${isExecutive ? `
          <li>👑 <strong>Executive Gate Pass Approvals:</strong> 1-click Approve/Reject with digital cryptographic slip</li>
          <li>🛡️ <strong>Live Security & Audit Trail:</strong> Real-time streaming of system events & breakdowns</li>
          <li>📢 <strong>Broadcast Announcements:</strong> Send factory-wide push notices via <code>/broadcast</code></li>
        ` : `
          <li>📋 <strong>PM Checklists:</strong> Preventive Maintenance task lists via <code>/pm</code></li>
          <li>🔧 <strong>My Tools:</strong> Check all tools issued to your ID</li>
        `}
        <li>🚑 <strong>Emergency Ambulance Fleet:</strong> Standby machine alerts for zero line downtime</li>
      </ul>
    </div>

    <!-- Actions -->
    <div style="display: flex; gap: 8px; margin-top: 4px;">
      ${isExecutive ? `
        <a href="https://t.me/MaintAdminbot" target="_blank" class="btn btn-primary" style="flex: 1; text-decoration: none; display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 12px; font-weight: 700; background: linear-gradient(135deg, #f59e0b, #d97706); border-color: #d97706; color: #fff;">
          <span>👑</span> @MaintAdminbot
        </a>
        <a href="https://t.me/MainterpBot" target="_blank" class="btn btn-secondary" style="flex: 1; text-decoration: none; display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 12px; font-weight: 700;">
          <span>⚙️</span> @MainterpBot
        </a>
      ` : `
        <a href="https://t.me/${meta.botUsername || 'MainterpBot'}" target="_blank" class="btn btn-primary" style="flex: 1; text-decoration: none; display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 12.5px; font-weight: 700;">
          <span>💬</span> Chat with Bot
        </a>
      `}
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
