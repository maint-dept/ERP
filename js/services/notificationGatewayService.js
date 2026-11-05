/**
 * Al-Muslim Group Garments Factory Maintenance Machine ERP
 * Production WhatsApp & SMS Floor Notification Gateway Service
 * 1-Click floor in-charge, supervisor & mechanic mobile dispatch alerts
 */

export class NotificationGatewayService {
  /**
   * Clean and normalize Bangladesh or international phone numbers
   */
  normalizePhoneNumber(raw) {
    if (!raw) return '';
    let cleaned = String(raw).replace(/[\s\-\(\)\.]/g, '');
    if (cleaned.startsWith('+')) {
      cleaned = cleaned.substring(1);
    }
    // If standard BD local mobile '01XXXXXXXXX' -> convert to international '8801XXXXXXXXX'
    if (/^01[3-9]\d{8}$/.test(cleaned)) {
      cleaned = '88' + cleaned;
    }
    return cleaned;
  }

  /**
   * Construct WhatsApp Web / Mobile deep link
   */
  buildWhatsAppUrl(phone, text) {
    const cleanPhone = this.normalizePhoneNumber(phone);
    const encoded = encodeURIComponent(text || '');
    if (cleanPhone) {
      return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encoded}`;
    }
    return `https://api.whatsapp.com/send?text=${encoded}`;
  }

  /**
   * Construct native SMS scheme URL
   */
  buildSmsUrl(phone, text) {
    const cleanPhone = this.normalizePhoneNumber(phone);
    const encoded = encodeURIComponent(text || '');
    if (cleanPhone) {
      return `sms:${cleanPhone}?body=${encoded}`;
    }
    return `sms:?body=${encoded}`;
  }

  /**
   * Format breakdown ticket alert message
   */
  generateBreakdownMessage({ machine = {}, location = '', reportedBy = '', issue = '', remarks = '', date = '' }) {
    const mName = machine.machineNameStr || machine.machineName || machine.name || 'Sewing Machine';
    const sNo = machine.serialNumber || 'N/A';
    const bm = [machine.brandStr || machine.brand || '', machine.modelStr || machine.model || ''].filter(Boolean).join(' ');
    const loc = location || [machine.unitStr || machine.unitName || '', machine.floorStr || machine.floorName || '', machine.lineStr || machine.lineName || ''].filter(Boolean).join(' > ') || 'Floor Line';
    const rep = reportedBy || 'Floor Technician';
    const time = date || new Date().toLocaleString();
    const prob = issue || remarks || 'Urgent technician attendance required to avoid line stoppage.';

    return `🚨 *AMG MAINTENANCE BREAKDOWN ALERT*
━━━━━━━━━━━━━━━━━━━━━
🏷️ *Machine:* ${mName}
🔢 *Serial No:* ${sNo}${bm ? `\n⚙️ *Brand/Model:* ${bm}` : ''}
🏭 *Location:* ${loc}
⚠️ *Status:* BREAKDOWN / MAINTENANCE REQUIRED
👤 *Reported By:* ${rep}
⏰ *Time:* ${time}
💬 *Problem Details:* ${prob}
━━━━━━━━━━━━━━━━━━━━━
🌐 *Al-Muslim Group Maintenance ERP*`;
  }

  /**
   * Format machine transfer & gate pass alert message
   */
  generateTransferMessage({ req = {}, details = {} }) {
    const pNo = req.requestNumber || req.id || 'TR-PASS';
    const mName = details.machineName || req.machineName || 'Machine';
    const bm = details.brandModelText || [req.brand, req.model].filter(Boolean).join(' ');
    const sNo = details.serialNumber || req.serialNumber || 'N/A';
    const src = req.sourcePath || 'Current Line';
    const dst = req.destPath || 'Target Line';
    const status = (req.status || 'APPROVED').replace(/_/g, ' ');
    const by = req.approvedByName || req.requestedByName || 'Supervisor';
    const reason = req.reason || 'Line rebalance';

    return `🔄 *AMG ERP TRANSFER PASS — Machine Relocation*
━━━━━━━━━━━━━━━━━━━━━
🎫 *Pass No:* ${pNo}
🏷️ *Machine:* ${mName}${bm ? ` (${bm})` : ''}
🔢 *Serial No:* ${sNo}
📍 *From (Source):* ${src}
🎯 *To (Target):* ${dst}
✅ *Status:* ${status}
👤 *Authorized By:* ${by}
⏰ *Time:* ${new Date().toLocaleString()}
📝 *Reason:* ${reason}
━━━━━━━━━━━━━━━━━━━━━
🌐 *Al-Muslim Group Maintenance ERP*`;
  }

  /**
   * Format preventive maintenance reminder message
   */
  generatePmAlertMessage({ machine = {}, schedule = {}, assignedTo = '' }) {
    const mName = machine.machineName || machine.machineNameStr || 'Sewing Machine';
    const sNo = machine.serialNumber || 'N/A';
    const loc = [machine.floor || machine.floorStr || '', machine.line || machine.lineStr || ''].filter(Boolean).join(' / ') || 'Production Floor';
    const pDate = schedule.date || schedule.scheduledDate || 'Today';
    const task = schedule.task || schedule.serviceType || 'Scheduled Lubrication & Safety Clearance Audit';
    const tech = assignedTo || schedule.assignedMechanic || 'Line Mechanic';

    return `🛠️ *AMG ERP — Preventive Maintenance Schedule*
━━━━━━━━━━━━━━━━━━━━━
🏷️ *Machine:* ${mName}
🔢 *Serial No:* ${sNo}
🏭 *Location:* ${loc}
📅 *Scheduled Date:* ${pDate}
🔧 *Service Action:* ${task}
👤 *Assigned Mechanic:* ${tech}
━━━━━━━━━━━━━━━━━━━━━
🌐 *Al-Muslim Group Maintenance ERP*`;
  }

  /**
   * Render interactive modal to send via WhatsApp, SMS, or Copy text
   */
  openNotificationGatewayModal({
    title = 'Floor Alert & Dispatch Gateway',
    defaultPhone = '',
    message = '',
    onSent = null
  } = {}) {
    // Remove any existing instance
    const existing = document.getElementById('modal-gateway-notif-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'modal-gateway-notif-overlay';
    overlay.style.cssText = 'z-index: 10070; background: rgba(0, 0, 0, 0.88); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; padding: 16px;';

    const safeMessage = message || '';

    overlay.innerHTML = `
      <div class="modal-dialog" style="max-width: 540px; width: 100%; background: #0f172a; border: 1.5px solid #22c55e; border-radius: 14px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.85); overflow: hidden; display: flex; flex-direction: column;">
        
        <!-- Header -->
        <div style="padding: 14px 18px; background: linear-gradient(135deg, #0f172a, #14532d); border-bottom: 1px solid rgba(34, 197, 94, 0.3); display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="font-size: 20px; width: 36px; height: 36px; border-radius: 8px; background: rgba(34, 197, 94, 0.2); border: 1px solid #22c55e; display: flex; align-items: center; justify-content: center;">
              📲
            </div>
            <div>
              <h3 style="margin: 0; font-size: 15px; font-weight: 800; color: #fff;">${title}</h3>
              <div style="font-size: 11px; color: #86efac; margin-top: 1px;">Instant WhatsApp &amp; SMS Dispatch</div>
            </div>
          </div>
          <button type="button" id="btn-close-gateway-modal" class="btn btn-ghost btn-sm" style="font-size: 18px; color: #cbd5e1; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">✕</button>
        </div>

        <!-- Body -->
        <div style="padding: 18px 20px; display: flex; flex-direction: column; gap: 14px; max-height: 75vh; overflow-y: auto;">
          
          <!-- Recipient Mobile Number -->
          <div>
            <label style="display: block; font-size: 12px; font-weight: 800; color: #cbd5e1; margin-bottom: 6px;">
              📞 Recipient Phone Number <span style="font-size: 11px; color: #86efac; font-weight: normal;">(Floor In-Charge / Mechanic)</span>
            </label>
            <div style="display: flex; gap: 8px;">
              <input
                type="tel"
                id="gateway-phone-input"
                class="form-control"
                placeholder="017XXXXXXXX or +8801XXXXXXXXX"
                value="${defaultPhone || ''}"
                style="height: 42px; font-size: 13.5px; font-family: monospace; background: #1e293b; border: 1.5px solid #334155; color: #fff;"
              />
            </div>
            <div style="display: flex; gap: 6px; margin-top: 6px; flex-wrap: wrap;">
              <span style="font-size: 10.5px; color: #94a3b8; align-self: center;">Quick Preset:</span>
              <button type="button" class="btn btn-ghost btn-xs btn-preset-phone" data-phone="+8801711000001" style="font-size: 10.5px; padding: 2px 7px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: #cbd5e1; border-radius: 4px;">In-Charge 1</button>
              <button type="button" class="btn btn-ghost btn-xs btn-preset-phone" data-phone="+8801711000002" style="font-size: 10.5px; padding: 2px 7px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: #cbd5e1; border-radius: 4px;">Central Maint.</button>
            </div>
          </div>

          <!-- Message Text Preview & Editor -->
          <div>
            <label style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; font-weight: 800; color: #cbd5e1; margin-bottom: 6px;">
              <span>💬 Message Preview <span style="font-size: 11px; color: #94a3b8; font-weight: normal;">(WhatsApp formatted)</span></span>
              <button type="button" id="btn-gateway-copy" class="btn btn-ghost btn-xs" style="font-size: 11px; color: #38bdf8; padding: 2px 8px; border: 1px solid rgba(56, 189, 248, 0.4); border-radius: 4px;">
                📋 Copy Text
              </button>
            </label>
            <textarea
              id="gateway-msg-input"
              class="form-control"
              rows="7"
              style="font-family: monospace; font-size: 12px; line-height: 1.45; background: #0b1120; border: 1.5px solid #334155; color: #e2e8f0; resize: vertical;"
            >${safeMessage}</textarea>
          </div>

          <!-- Action Buttons Bar -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 4px;">
            <!-- WhatsApp Button -->
            <button
              type="button"
              id="btn-gateway-send-wa"
              class="btn btn-success"
              style="min-height: 44px; font-size: 13px; font-weight: 800; background: #16a34a; border: 1.5px solid #4ade80; color: #fff; display: inline-flex; align-items: center; justify-content: center; gap: 8px; border-radius: 8px; box-shadow: 0 4px 12px rgba(22, 163, 74, 0.35);"
            >
              <span style="font-size: 16px;">🟢</span> Open WhatsApp
            </button>

            <!-- SMS Button -->
            <button
              type="button"
              id="btn-gateway-send-sms"
              class="btn btn-secondary"
              style="min-height: 44px; font-size: 13px; font-weight: 800; background: #1e293b; border: 1.5px solid #38bdf8; color: #38bdf8; display: inline-flex; align-items: center; justify-content: center; gap: 8px; border-radius: 8px;"
            >
              <span style="font-size: 16px;">💬</span> Send via SMS
            </button>
          </div>

        </div>

      </div>
    `;

    document.body.appendChild(overlay);

    const closeBtn = overlay.querySelector('#btn-close-gateway-modal');
    const sendWaBtn = overlay.querySelector('#btn-gateway-send-wa');
    const sendSmsBtn = overlay.querySelector('#btn-gateway-send-sms');
    const copyBtn = overlay.querySelector('#btn-gateway-copy');
    const phoneInput = overlay.querySelector('#gateway-phone-input');
    const msgInput = overlay.querySelector('#gateway-msg-input');
    const presetBtns = overlay.querySelectorAll('.btn-preset-phone');

    const closeModal = () => {
      overlay.remove();
    };

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });

    presetBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const p = btn.getAttribute('data-phone');
        if (phoneInput && p) phoneInput.value = p;
      });
    });

    // Copy to clipboard
    if (copyBtn) {
      copyBtn.addEventListener('click', async () => {
        try {
          const textToCopy = msgInput ? msgInput.value : safeMessage;
          await navigator.clipboard.writeText(textToCopy);
          copyBtn.textContent = '✓ Copied!';
          copyBtn.style.color = '#4ade80';
          setTimeout(() => {
            copyBtn.textContent = '📋 Copy Text';
            copyBtn.style.color = '#38bdf8';
          }, 2000);
        } catch (_) {
          alert('Copied message to clipboard.');
        }
      });
    }

    // Send WhatsApp
    if (sendWaBtn) {
      sendWaBtn.addEventListener('click', () => {
        const ph = phoneInput ? phoneInput.value.trim() : '';
        const msg = msgInput ? msgInput.value : safeMessage;
        const waUrl = this.buildWhatsAppUrl(ph, msg);
        window.open(waUrl, '_blank');
        if (onSent) onSent('WHATSAPP', ph);
      });
    }

    // Send SMS
    if (sendSmsBtn) {
      sendSmsBtn.addEventListener('click', () => {
        const ph = phoneInput ? phoneInput.value.trim() : '';
        const msg = msgInput ? msgInput.value : safeMessage;
        const smsUrl = this.buildSmsUrl(ph, msg);
        window.location.href = smsUrl;
        if (onSent) onSent('SMS', ph);
      });
    }
  }
}

export const notificationGateway = new NotificationGatewayService();
